import mysql, {type Connection, type ResultSetHeader} from "mysql2/promise.js";
import {createClientPool} from "./connection_pool.ts";
import * as t from "@/types.ts";
import {buildTree, metricsFromGroups, node, PlanLine, splitMetricGroups} from "./sql_plan.ts";

// dateStrings: keep DATETIME/TIMESTAMP as raw server text (µs precision) —
// table editing identifies rows by these values, and JS Date would truncate them.
function connect(dsn: string) {
  return mysql.createConnection({uri: dsn, dateStrings: true});
}

const pool = createClientPool<Connection, string>({
  keyOf: dsn => dsn,
  connect: async dsn => {
    const connection = await connect(dsn);
    // The session's transaction read-only mode is reset in every op's finally;
    // a dropped connection errors the next op, which evicts the client.
    connection.on("error", () => pool.evict(dsn, connection));
    return connection;
  },
  close: connection => connection.end(),
});

export async function send(request: t.SQLRequest): Promise<t.SQLResponse> {
  return await pool.run(request.dsn, async connection => {
    try {
      if (request.readOnly ?? false)
        await connection.execute("SET SESSION TRANSACTION READ ONLY");
      const [rows, fields] = await connection.execute(request.query) as [Record<string, unknown>[], {name: string, type?: number}[]];
      if (rows.length === 0) {
        return {columns: fields.map(f => f.name), typenames: [], types: [], rows: []}; // TODO: get column metadata
      }
      return {
        columns: fields.map(f => f.name),
        typenames: fields.map(f => f.type === undefined ? "???" : String(f.type)),
        types: fields.map(f => f.type === undefined ? t.ColumnType.UNKNOWN : String(f.type) as t.ColumnType),
        rows: rows.map(r => Object.values(r)),
      };
    } finally {
      if (request.readOnly ?? false)
        await connection.execute("SET SESSION TRANSACTION READ WRITE").catch(() => undefined); // keep the original error
    }
  });
}

export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  // Deliberately not pooled: concurrent batches sharing one connection could
  // interleave statements inside a single transaction.
  const connection = await connect(request.dsn);
  try {
    if (request.readOnly ?? false)
      await connection.execute("SET SESSION TRANSACTION READ ONLY");
    await connection.beginTransaction();
    try {
      // mysql2 prepared `execute` cannot run arbitrary statement batches; use plain query.
      const affectedRows: number[] = [];
      for (const statement of statements) {
        const [result] = await connection.query(statement);
        affectedRows.push((result as ResultSetHeader).affectedRows);
      }
      await connection.commit();
      return {columns: [], typenames: [], types: [], rows: [], affectedRows};
    } catch (err) {
      await connection.rollback().catch(() => undefined); // keep the original error
      throw err;
    }
    return {columns: [], typenames: [], types: [], rows: []};
  } finally {
    if (request.readOnly ?? false)
      await connection.execute("SET SESSION TRANSACTION READ WRITE").catch(() => undefined); // keep the original error
    await connection.end();
  }
}

// EXPLAIN ANALYZE executes the statement on the pooled session (mysql has no
// read-only switch that composes with it), so effects of write queries persist
// exactly as when running the query from the editor.
export async function explain(request: t.SQLRequest): Promise<t.SQLExplain> {
  return await pool.run(request.dsn, async connection => {
    // mysql2 prepared `execute` rejects EXPLAIN ANALYZE; use plain query.
    const [rows] = await connection.query(`EXPLAIN ANALYZE ${request.query}`) as [{[column: string]: string}[], unknown];
    const raw = rows.map(r => Object.values(r).join(" ")).join("\n");
    return {raw, plan: parsePlan(raw)};
  });
}

export async function describe(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema> {
  const colResult = await send({...request, query: `SELECT
  column_name,
  column_type,
  is_nullable = 'YES',
  column_default
FROM information_schema.columns
WHERE table_name = '${tableName}' AND table_schema = DATABASE()
ORDER BY ordinal_position`});
  const columns: t.ColumnInfo[] = colResult.rows.map(([name, typ, nullable, defaultVal]) => ({
    name: name as string,
    typename: typ as string,
    type: typ as t.ColumnType,
    nullable: nullable as boolean,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));

  // Get constraints (simplified - PRIMARY KEY only). key_column_usage has one
  // row per PK column; ordinal_position restores composite key order, so the
  // whole key is returned as a single ordered entry.
  const constraints: t.ConstraintInfo[] = [];
  try {
    const conResult = await send({...request, query: `SELECT
  column_name
FROM information_schema.key_column_usage
WHERE table_name = '${tableName}' AND table_schema = DATABASE() AND constraint_name = 'PRIMARY'
ORDER BY ordinal_position`}); // TODO: pass tableName as arg
    const pkColumns = conResult.rows.map(r => String(r[0]));
    if (pkColumns.length > 0)
      constraints.push({name: "PRIMARY KEY", type: "PRIMARY KEY", definition: "PRIMARY KEY", columns: pkColumns});
  } catch (_e) {
    // Constraints query is best-effort
  }

  // Get foreign keys (one row per column pair; ordinal_position keeps
  // composite keys ordered). rc carries the update/delete rules, kcu the
  // referenced table/schema/columns.
  const foreign_keys: t.ForeignKey[] = [];
  try {
    const fkResult = await send({...request, query: `SELECT
  kcu.constraint_name,
  kcu.column_name,
  kcu.referenced_table_schema,
  kcu.referenced_table_name,
  kcu.referenced_column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = kcu.constraint_schema AND rc.constraint_name = kcu.constraint_name
WHERE kcu.table_name = '${tableName}' AND kcu.table_schema = DATABASE() AND kcu.referenced_table_name IS NOT NULL
ORDER BY kcu.constraint_name, kcu.ordinal_position`}); // TODO: pass tableName as arg
    for (const r of fkResult.rows) {
      foreign_keys.push({
        name: String(r[0]),
        column: String(r[1]),
        schema: String(r[2]),
        table: String(r[3]),
        to: String(r[4]),
        onUpdate: String(r[5]),
        onDelete: String(r[6]),
      });
    }
  } catch (_e) {
    // Foreign keys query is best-effort
  }

  // TODO: Get indexes
  return {columns, constraints, foreign_keys, indexes: []};
}

export async function listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]> {
  const dbName = (await send({...request, query: "SELECT DATABASE()"})).rows[0][0] as string;
  const tablesResult = await send({...request, query: `SELECT
table_name,
table_rows,
data_length + index_length
FROM information_schema.TABLES
WHERE table_schema = '${dbName}'`}); // TODO: pass dbname as arg
  return tablesResult.rows.map(([name, rowCount, sizeBytes]): t.TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
}

export function quoteIdent(s: string): string {
  return "`" + s + "`";
}

// `EXPLAIN ANALYZE` tree format: one `->` line per operator, indented a fixed
// number of spaces per level (varies between mysql versions, detected as the
// smallest nonzero indent). Everything sits on the operator line.
export function parsePlan(raw: string): t.SQLPlan | undefined {
  const lines = raw.split("\n").filter(l => l.trim() !== "");
  const indents = lines
    .map(l => /^(\s*)->\s+/.exec(l))
    .filter(m => m !== null)
    .map(m => m[1].length)
    .filter(n => n > 0);
  if (indents.length === 0 && !/^(\s*)->\s+/.test(lines[0] ?? ""))
    return undefined; // traditional tabular format or garbage
  const unit = indents.length === 0 ? 1 : Math.min(...indents);
  const parsed: PlanLine[] = [];
  for (const line of lines) {
    const arrow = /^(\s*)->\s+(.*)$/.exec(line);
    if (arrow === null) {
      parsed.push({operator: false, text: line.trim()});
      continue;
    }
    const {title, groups} = splitMetricGroups(arrow[2]);
    const parts = splitTitle(title);
    const n = node(parts.label);
    n.metrics = metricsFromGroups(groups);
    n.kind = mysqlKind(title);
    if (parts.table !== undefined)
      n.table = parts.table;
    if (parts.index !== undefined)
      n.index = parts.index;
    parsed.push({operator: true, depth: Math.floor(arrow[1].length / unit), n});
  }
  return buildTree(parsed);
}

// Operator titles carry the scan qualifiers inline:
// "<head> on <table>[ using <index>][ (<cond>)]". Conditions are not
// qualifiers and stay in the label. MySQL prints the alias, when any, in
// place of the table name, so it cannot be reported separately.
function splitTitle(title: string): {label: string, table?: string, index?: string} {
  const m = /^(?<head>.+?)\s+on\s+(?<table>\S+)(?:\s+using\s+(?<index>\S+))?(?<cond>\s*\(.*\))?$/.exec(title);
  if (m === null)
    return {label: title};
  const g: Record<string, string | undefined> = m.groups!;
  const head = g.head!;
  const {index, table, cond} = g;
  return {label: cond !== undefined ? `${head}${cond}` : head, table, index};
}

function mysqlKind(title: string): t.SQLPlanKind {
  if (/join/i.test(title))
    return "join";
  if (/^Index (lookup|range scan|scan)|^(Primary|Secondary|Unique) (key|index)|^Covering index/.test(title))
    return "index";
  if (/^Table scan/.test(title))
    return "scan";
  if (/^Sort/.test(title))
    return "sort";
  if (/^Limit/.test(title))
    return "limit";
  if (/^Filter/.test(title))
    return "filter";
  if (/aggregate/i.test(title))
    return "aggregate";
  if (/^(Insert|Update|Delete)\b/.test(title))
    return "write";
  if (/^Union|^Duplicates elimination/.test(title))
    return "setop";
  return "other";
}
