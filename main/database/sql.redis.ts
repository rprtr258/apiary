import {TableSchema, ColumnInfo, SQLRequest, ColumnType, SQLResponse, TableInfo} from "@/types.ts";
import {quoteIdent, sendSQL} from "./sql.ts";
import {querySqlOverRedis} from "../redissql.ts";

// go-mysql-server has no session read-only switch over the redis bridge, so
// write statements are rejected by their leading keyword. This is a seatbelt,
// not a security boundary: the standalone SQL request kind runs without
// readOnly and reaches the engine unchecked (its tables reject writes anyway).
const writeKeywords = new Set([
  "INSERT", "UPDATE", "DELETE", "REPLACE",
  "CREATE", "DROP", "ALTER", "TRUNCATE", "RENAME",
  "GRANT", "REVOKE", "SET", "LOAD", "CALL", "KILL", "LOCK", "UNLOCK",
  "OPTIMIZE", "REPAIR", "FLUSH", "SHUTDOWN", "RESET", "PURGE",
  "START", "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE",
]);

function leadingKeyword(query: string): string {
  const stripped = query
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ")
    .trimStart();
  const match = /^[A-Za-z]+/.exec(stripped);
  return match === null ? "" : match[0].toUpperCase();
}

/** Map a go-mysql-server type name (e.g. "text", "bigint", "datetime") to a
 * column type for the UI. */
export function mapColumnType(typename: string): ColumnType {
  const t = typename.toLowerCase();
  if (t === "boolean" || t === "bool") {
    return ColumnType.BOOLEAN;
  }
  if (t === "datetime" || t === "date" || t === "timestamp") {
    return ColumnType.TIME;
  }
  if (t.startsWith("enum(") || t.startsWith("set(")) {
    return ColumnType.STRING;
  }
  if (t.includes("json")) {
    return ColumnType.JSON;
  }
  if (t.includes("int") || t.includes("float") || t.includes("double") || t.includes("decimal")) {
    return ColumnType.NUMBER;
  }
  return ColumnType.STRING;
}

export async function send(request: SQLRequest): Promise<SQLResponse> {
  if (request.readOnly === true && writeKeywords.has(leadingKeyword(request.query))) {
    throw new Error(`write statements are rejected in read-only mode: ${leadingKeyword(request.query)}`);
  }

  const result = await querySqlOverRedis(request.dsn, request.query);
  return {
    columns: result.columns,
    typenames: result.typenames,
    types: result.typenames.map(mapColumnType),
    rows: result.rows,
  };
}

export async function sendBatch(request: Omit<SQLRequest, "query">, statements: string[]): Promise<SQLResponse> {
  // go-mysql-server has no transactions over the redis bridge; statements run
  // sequentially. Table editing is unreachable for redis (tables are read-only
  // projections of live redis data and describeRedis reports no constraints),
  // this is a safety net.
  for (const statement of statements) {
    await send({...request, query: statement});
  }
  return {columns: [], typenames: [], types: [], rows: []};
}

export async function describe(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  // Redis tables are read-only projections of live redis data. Columns come
  // from the engine's information_schema; constraints and indexes are not
  // reported — a primary key would make the table viewer offer cell editing,
  // which the engine rejects ("table doesn't support UPDATE").
  const colResult = await sendSQL({...request, query: `SELECT
  column_name,
  column_type,
  is_nullable = 'YES',
  column_default
FROM information_schema.COLUMNS
WHERE table_name = '${tableName}' AND table_schema = DATABASE()
ORDER BY ordinal_position`});
  const columns: ColumnInfo[] = colResult.rows.map(([name, typ, nullable, defaultVal]): ColumnInfo => ({
    name: name as string,
    typename: typ as string,
    type: mapColumnType(typ as string),
    nullable: nullable === true,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));
  return {columns, constraints: [], foreign_keys: [], indexes: []};
}

export async function listTables(request: Omit<SQLRequest, "query">): Promise<TableInfo[]> {
  // The engine's information_schema reports no row statistics for redis
  // tables, so counts are collected with one COUNT(*) per table; redis has
  // no per-table storage size.
  const tableNames = (await sendSQL({...request, query: `SELECT
  table_name
FROM information_schema.TABLES
WHERE table_schema = DATABASE()`})).rows.map(r => String(r[0]));
  const tables: TableInfo[] = [];
  const q = quoteIdent.redis;
  for (const table of tableNames) {
    const rows = (await sendSQL({...request, query: `SELECT COUNT(*) FROM ${q(table)}`})).rows;
    tables.push({name: table, rowCount: Number(rows[0]?.[0] ?? 0), sizeBytes: 0});
  }
  return tables;
}
