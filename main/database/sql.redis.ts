import {ColumnType, SQLRequest, SQLResponse} from "@/types.ts";
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
