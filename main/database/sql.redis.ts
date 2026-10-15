import * as t from "@/types.ts";
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
export function mapColumnType(typename: string): t.ColumnType {
  const ty = typename.toLowerCase();
  if (ty === "boolean" || ty === "bool") {
    return t.ColumnType.BOOLEAN;
  }
  if (ty === "datetime" || ty === "date" || ty === "timestamp") {
    return t.ColumnType.TIME;
  }
  if (ty.startsWith("enum(") || ty.startsWith("set(")) {
    return t.ColumnType.STRING;
  }
  if (ty.includes("json")) {
    return t.ColumnType.JSON;
  }
  if (ty.includes("int") || ty.includes("float") || ty.includes("double") || ty.includes("decimal")) {
    return t.ColumnType.NUMBER;
  }
  return t.ColumnType.STRING;
}

export async function send(request: t.SQLRequest): Promise<t.SQLResponse> {
  if ((request.readOnly ?? false) && writeKeywords.has(leadingKeyword(request.query))) {
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

export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  // go-mysql-server has no transactions over the redis bridge; statements run
  // sequentially. Table editing is unreachable for redis (tables are read-only
  // projections of live redis data and describeRedis reports no constraints),
  // this is a safety net.
  for (const statement of statements) {
    await send({...request, query: statement});
  }
  return {columns: [], typenames: [], types: [], rows: []};
}

// EXPLAIN ANALYZE rides go-mysql-server's native EXPLAIN support (the mysql
// shim parses and plans it; no redis-specific engine code involved). The
// instrumented execution is safe: the engine's tables reject writes anyway.
export async function explain(request: t.SQLRequest): Promise<t.SQLExplain> {
  const result = await querySqlOverRedis(request.dsn, `EXPLAIN ANALYZE ${request.query}`);
  const raw = result.rows.map(row => row.map(String).join(" ")).join("\n");
  return {raw};
}

export async function describe(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema> {
  // Redis tables are read-only projections of live redis data. Columns come
  // from the engine's information_schema; constraints and indexes are not
  // reported — a primary key would make the table viewer offer cell editing,
  // which the engine rejects ("table doesn't support UPDATE").
  const colResult = await send({...request, query: `SELECT
  column_name,
  column_type,
  is_nullable = 'YES',
  column_default
FROM information_schema.COLUMNS
WHERE table_name = '${tableName}' AND table_schema = DATABASE()
ORDER BY ordinal_position`});
  const columns: t.ColumnInfo[] = colResult.rows.map(([name, typ, nullable, defaultVal]): t.ColumnInfo => ({
    name: name as string,
    typename: typ as string,
    type: mapColumnType(typ as string),
    nullable: nullable === true,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));
  return {columns, constraints: [], foreign_keys: [], indexes: []};
}

export async function listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]> {
  // The engine's information_schema reports no row statistics for redis
  // tables, so counts are collected with one COUNT(*) per table; redis has
  // no per-table storage size.
  const tableNames = (await send({...request, query: `SELECT
  table_name
FROM information_schema.TABLES
WHERE table_schema = DATABASE()`})).rows.map(r => String(r[0]));
  const tables: t.TableInfo[] = [];
  for (const table of tableNames) {
    const rows = (await send({...request, query: `SELECT COUNT(*) FROM ${quoteIdent(table)}`})).rows;
    tables.push({name: table, rowCount: Number(rows[0]?.[0] ?? 0), sizeBytes: 0});
  }
  return tables;
}

export function quoteIdent(s: string): string {
  return "`" + s.replaceAll("`", "``") + "`";
}
