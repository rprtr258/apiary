import {createClient, type ClickHouseClient} from "@clickhouse/client";
import {createClientPool} from "./connection_pool.ts";
import * as t from "@/types.ts";
import {buildTree, node, PlanLine} from "./sql_plan.ts";

// ClickHouse server column type classified for the UI; Nullable and
// LowCardinality wrappers carry no kind of their own and are stripped first.
export function columnType(typename: string): t.ColumnType {
  const up = typename.replace(/^(?:Nullable|LowCardinality)\((.*)\)$/, "$1").toUpperCase();
  if (/^UINT|^INT|^FLOAT|^DECIMAL/.test(up)) return t.ColumnType.NUMBER;
  if (/^DATE|^TIME/.test(up)) return t.ColumnType.TIME;
  if (["BOOL", "BOOLEAN"].includes(up)) return t.ColumnType.BOOLEAN;
  if (up === "JSON") return t.ColumnType.JSON;
  if (/^STRING|^FIXEDSTRING|^ENUM|^UUID|^IPV/.test(up)) return t.ColumnType.STRING;
  return t.ColumnType.UNKNOWN;
}

// Stateless HTTP client (readonly is a per-query setting), so every entry
// point rides the pool.
const pool = createClientPool<ClickHouseClient, string>({
  keyOf: dsn => dsn,
  connect: async dsn => createClient({url: dsn, max_open_connections: 10}),
  close: client => client.close(),
});

// Statements without a result set go through exec(), which sends the SQL
// verbatim; query() requests a formatted result set, and INSERT ... VALUES
// must not carry any FORMAT request - the server (async inserts are the
// default on recent versions) parses it as VALUES data.
const NO_RESULT_SET = /^\s*(INSERT|CREATE|DROP|ALTER|TRUNCATE|RENAME|OPTIMIZE|SET|SYSTEM|GRANT|REVOKE|KILL|ATTACH|DETACH|EXCHANGE|UNDROP|USE)\b/i;

export async function send(request: t.SQLRequest, params?: Record<string, unknown>): Promise<t.SQLResponse> {
  return await pool.run(request.dsn, async client => {
    const ping = await client.ping();
    if (!ping.success) {
      throw new Error(`ClickHouse ping failed: ${ping.error}`);
    }

    if (NO_RESULT_SET.test(request.query)) {
      await client.exec({query: request.query, query_params: params, clickhouse_settings: request.readOnly ?? false ? {readonly: "1"} : {}});
      return {columns: [], typenames: [], types: [], rows: []};
    }

    // Server type names/types ride the two header rows of this format and
    // survive empty result sets, unlike JSONEachRow (no metadata) or value
    // sniffing (all-NULL columns).
    const resultSet = await client.query({query: request.query, format: "JSONCompactEachRowWithNamesAndTypes", query_params: params, clickhouse_settings: request.readOnly ?? false ? {readonly: "1"} : {}});
    return parseResponse(await resultSet.text());
  });
}

// NDJSON of the format: names row, types row, then one data row per line.
export function parseResponse(text: string): t.SQLResponse {
  const parsed = text.split("\n").filter(l => l.trim() !== "").map(l => JSON.parse(l) as unknown[]);
  const names = parsed[0] ?? [];
  const serverTypes = parsed[1] ?? [];
  return {
    columns: names.map(String),
    typenames: serverTypes.map(String),
    types: serverTypes.map(String).map(columnType),
    rows: parsed.slice(2),
  };
}

export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  // ClickHouse has no transactions; statements run sequentially.
  return await pool.run(request.dsn, async client => {
    const affectedRows: number[] = [];
    for (const statement of statements) {
      // wait_end_of_query: the streamed response's X-ClickHouse-Summary counters
      // are only complete once the server has buffered the full response
      const result = await client.exec({
        query: statement,
        clickhouse_settings: {
          ...(request.readOnly ?? false ? {readonly: "1"} : {}),
          wait_end_of_query: 1,
        },
      });
      affectedRows.push(Number(result.summary?.written_rows ?? 0));
    }
    return {columns: [], typenames: [], types: [], rows: [], affectedRows};
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
WHERE database = currentDatabase() AND table = {table:String}`}, {table: tableName});
  const columns: t.ColumnInfo[] = colResult.rows.map(r => ({
    name: String(r[0]),
    typename: String(r[1]),
    type: columnType(String(r[1])),
    nullable: String(r[1]).includes("Nullable"),
    defaultValue: ["YES" as unknown, 1, true].includes(r[2]) ? JSON.stringify(r[3] ?? "") : "",
  }));

  // MergeTree tables report their key as an ORDER BY prefix expression; plain
  // column names become the PRIMARY KEY constraint, non-column expressions are
  // dropped later by the viewer's PK detection. ClickHouse has no foreign keys.
  const tablesResult = await send({...request, query: "SELECT primary_key FROM system.tables WHERE database = currentDatabase() AND name = {table:String}"}, {table: tableName});
  const pkRaw = tablesResult.rows[0]?.[0];
  const pk = (typeof pkRaw === "string" ? pkRaw : "").trim();
  const constraints: t.ConstraintInfo[] = pk === "" ? [] : [{
    name: "PRIMARY KEY",
    type: "PRIMARY KEY",
    definition: `PRIMARY KEY (${pk})`,
    columns: pk.split(",").map(c => c.trim()),
  }];

  const idxResult = await send({...request, query: `SELECT name, expr, type, granularity
FROM system.data_skipping_indices
WHERE database = currentDatabase() AND table = {table:String}`}, {table: tableName});
  const indexes: t.IndexInfo[] = idxResult.rows.map(([name, expr, type, granularity]) => ({
    name: String(name),
    definition: `INDEX ${String(name)} ${String(expr)} TYPE ${String(type)} GRANULARITY ${String(granularity)}`,
  }));

  return {columns, constraints, foreign_keys: [], indexes};
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
    // ClickHouse 26.x prints an "Output: <columns>" list before the tree and
    // under every operator; kept as operator lines they yield a second root
    // (the pre-tree header) and the whole plan is discarded. As details the
    // per-operator ones attach to their operator; the header has no owner yet
    // and buildTree drops it.
    if (/^\s*Output: /.test(line)) {
      lines.push({operator: false, text: line.trim()});
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
