import {createClient, type ClickHouseClient} from "@clickhouse/client";
import {createClientPool} from "./connection_pool.ts";
import * as t from "@/types.ts";
import {buildTree, node, PlanLine} from "./sql_plan.ts";

// TODO: fix get types
function convertTypes(columns: number, rows: unknown[][]): t.ColumnType[] {
  if (rows.length === 0) {
    return new Array<t.ColumnType>(columns).fill(t.ColumnType.STRING); // TODO: unknown fallback
  }

  return Array.from({length: columns}).map((_, i) => {
    const row = rows.map(r => r[i]).filter(r => r !== null);
    return ((): t.ColumnType => {
      switch (typeof row[0]) {
      case "string": return t.ColumnType.STRING;
      case "number": return t.ColumnType.NUMBER;
      case "boolean": return t.ColumnType.BOOLEAN;
      case "object": if (row[0] instanceof Date) return t.ColumnType.TIME;
      }
      return t.ColumnType.STRING; // TODO: unknown fallback
    })();
  });
}

// Stateless HTTP client (readonly is a per-query setting), so every entry
// point rides the pool.
const pool = createClientPool<ClickHouseClient, string>({
  keyOf: dsn => dsn,
  connect: async dsn => createClient({url: dsn, max_open_connections: 10}),
  close: client => client.close(),
});

export async function send(request: t.SQLRequest): Promise<t.SQLResponse> {
  return await pool.run(request.dsn, async client => {
    const ping = await client.ping();
    if (!ping.success) {
      throw new Error(`ClickHouse ping failed: ${ping.error}`);
    }

    const resultSet = await client.query({query: request.query, format: "JSONEachRow", clickhouse_settings: request.readOnly ?? false ? {readonly: "1"} : {}});
    const rows: Record<string, unknown>[] = await resultSet.json();
    if (rows.length === 0) {
      return {columns: [], typenames: [], types: [], rows: []}; // TODO: get column metadata
    }
    const columns = Object.keys(rows[0]);
    const typenames = convertTypes(columns.length, rows.map(Object.values));
    return {
      columns,
      typenames: typenames,
      types: typenames,
      rows: rows.map(r => Object.values(r)),
    };
  });
}

export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  // ClickHouse has no transactions; statements run sequentially. Table editing
  // is unreachable for ClickHouse (no PK introspection), this is a safety net.
  return await pool.run(request.dsn, async client => {
    for (const statement of statements)
      await client.exec({query: statement, clickhouse_settings: request.readOnly ?? false ? {readonly: "1"} : {}});
    return {columns: [], typenames: [], types: [], rows: []};
  });
}

// EXPLAIN PLAN does not execute the query; the plan prints as text lines, so
// the raw TSV response is the text form (no JSON parsing round-trip).
export async function explain(request: t.SQLRequest): Promise<t.SQLExplain> {
  return await pool.run(request.dsn, async client => {
    const resultSet = await client.query({query: `EXPLAIN PLAN ${request.query}`, format: "TabSeparated"});
    const raw = (await resultSet.text()).trimEnd();
    return {raw, plan: parsePlan(raw)};
  });
}

export async function describe(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema> {
  const colResult = await send({...request, query: `SELECT
  name,
  type,
  default_kind != '',
  default_expression
FROM system.columns
WHERE database = currentDatabase() AND table = '${tableName}'`});
  const columns: t.ColumnInfo[] = colResult.rows.map(r => ({
    name: String(r[0]),
    typename: String(r[1]),
    type: String(r[1]) as t.ColumnType,
    nullable: String(r[1]).includes("Nullable"),
    defaultValue: ["YES" as unknown, 1, true].includes(r[2]) ? JSON.stringify(r[3] ?? "") : "",
  }));

  // TODO: get rest
  return {columns, constraints: [], foreign_keys: [], indexes: []};
}

export async function listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]> {
  return (await send({...request, query: `SELECT
  name,
  total_rows,
  total_bytes
FROM system.tables
WHERE database = currentDatabase()`})).rows.map(([name, rowCount, sizeBytes]): t.TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
}

export function quoteIdent(s: string): string {
  return "`" + s.replaceAll("`", "\\`") + "`";
}

// `EXPLAIN PLAN` text: operators marked with `├─`/`└─` (plus a bare root
// line), indented 3 columns per level; `│`-marked lines are details of the
// preceding operator. Older versions print a plain 2-space indented tree of
// operators without box characters.
const CH_ARROW = /^([\s│]*)([├└])(.*)$/;
const CH_BAR = /^[\s│]*│(.*)$/;

export function parsePlan(raw: string): t.SQLPlan | undefined {
  const hasBox = /[│├└]/.test(raw);
  const unit = hasBox ? 3 : 2;
  const lines: PlanLine[] = [];
  for (const line of raw.split("\n")) {
    if (line.trim() === "")
      continue;
    const arrow = CH_ARROW.exec(line);
    const bar = CH_BAR.exec(line);
    if (arrow !== null) {
      // The arrow marker occupies 3 columns (├/└ + dashes), details occupy
      // one `│` column: both are part of the 3-column indent step.
      const leading = arrow[1].length + 3;
      const text = arrow[3].replace(/^─+/, "").trim();
      if (text !== "")
        lines.push(chLine(text, Math.floor(leading / unit)));
      continue;
    }
    if (bar !== null) {
      const text = bar[1].trim();
      if (text !== "")
        lines.push({operator: false, text});
      continue;
    }
    // Plain line: the root in the box format, any operator in the legacy one.
    const indent = line.length - line.trimStart().length;
    lines.push(chLine(line.trim(), Math.floor(indent / unit)));
  }
  return buildTree(lines);
}

function chLine(text: string, depth: number): PlanLine {
  // "Sorting (Sorting for ORDER BY)" -> title "Sorting", description "Sorting
  // for ORDER BY" (kept without the outer parens).
  const open = text.indexOf("(");
  let title = text;
  let description: string | null = null;
  if (open >= 0) {
    let depthParen = 0;
    for (let i = open; i < text.length; i++) {
      if (text[i] === "(")
        depthParen++;
      else if (text[i] === ")") {
        depthParen--;
        if (depthParen === 0) {
          if (i === text.length - 1) {
            title = text.slice(0, open).trim();
            description = text.slice(open + 1, i).trim();
          }
          break;
        }
      }
    }
  }
  const n = node(title);
  if (description !== null)
    n.details.push(description);
  n.kind = clickhouseKind(title);
  return {operator: true, depth, n};
}

function clickhouseKind(title: string): t.SQLPlanKind {
  if (/^Read/.test(title))
    return "scan";
  if (/Join/.test(title))
    return "join";
  if (/^Sorting/.test(title))
    return "sort";
  if (/^Limit/.test(title))
    return "limit";
  if (/^Filter|^Where/.test(title))
    return "filter";
  if (/^Expression|^Projection/.test(title))
    return "project";
  if (/^Union|^Intersect|^Except/.test(title))
    return "setop";
  if (/Aggregat/.test(title))
    return "aggregate";
  return "other";
}
