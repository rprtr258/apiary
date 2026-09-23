import pg from "pg";
import {setTypeParser, TypeId, builtins as typeIDs} from "pg-types";
import {ColumnType, SQLRequest, SQLResponse} from "@/types.ts";

// JS Date holds only millisecond precision, so pg's default parsing of date /
// timestamp columns into Date objects loses microseconds and shifts DATE across
// timezones. Table editing identifies rows by these values, so keep the raw
// server text, which round-trips exactly into UPDATE WHERE clauses.
setTypeParser(typeIDs.DATE, (v: string) => v);
setTypeParser(typeIDs.TIMESTAMP, (v: string) => v);
setTypeParser(typeIDs.TIMESTAMPTZ, (v: string) => v);

/*
SELECT t.oid::integer as typeid, t.typname as typename
FROM pg_type t
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'pg_catalog'
ORDER BY t.oid
*/
const pg_types: Partial<Record<TypeId, ColumnType>> = {
  [typeIDs.BOOL]: ColumnType.BOOLEAN,
  [typeIDs.INT8]: ColumnType.NUMBER,
  [typeIDs.INT4]: ColumnType.NUMBER,
  [19 as TypeId]: ColumnType.STRING,
  [typeIDs.TEXT]: ColumnType.STRING,
  [typeIDs.JSON]: ColumnType.JSON,
  [typeIDs.JSONB]: ColumnType.JSON,
  [typeIDs.DATE]: ColumnType.TIME,
  [typeIDs.TIME]: ColumnType.TIME,
  [typeIDs.TIMESTAMP]: ColumnType.TIME,
  [typeIDs.TIMESTAMPTZ]: ColumnType.TIME,
};
const pg_typenames: Partial<Record<TypeId, string>> = {
  [typeIDs.BOOL]: "bool",
  [typeIDs.INT8]: "int8",
  [typeIDs.INT4]: "int4",
  [19 as TypeId]: "name",
  [typeIDs.TEXT]: "text",
  [typeIDs.JSON]: "json",
  [typeIDs.JSONB]: "json",
  [typeIDs.DATE]: "date",
  [typeIDs.TIME]: "time",
  [typeIDs.TIMESTAMP]: "timestamp",
  [typeIDs.TIMESTAMPTZ]: "timestamptz",
};

export async function send(request: SQLRequest): Promise<SQLResponse> {
  let {dsn} = request;
  if (!dsn.startsWith("postgres://"))
    dsn = `postgres://${dsn}`;

  // Use libpq sslmode semantics so sslmode=require/prefer accept self-signed
  // certs instead of pg's non-standard default that treats them as verify-full.
  dsn += (dsn.includes("?") ? "&" : "?") + "uselibpqcompat=true";

  // TODO: parse dsn like host=localhost user=postgres password=password port=5432 dbname=postgres sslmode=disable
  const client = new pg.Client({connectionString: dsn});
  try {
    await client.connect();
  } catch (err) {
    await client.end().catch(() => undefined); // release socket even if connection never established
    const e = err as Error & {code?: string};
    throw new Error(`postgres connection failed${e.code === undefined ? "" : ` (${e.code})`}: ${e.message}`);
  }
  try {
    if (request.readOnly ?? false)
      await client.query("BEGIN READ ONLY");
    let result;
    try {
      result = await client.query(request.query);
    } finally {
      if (request.readOnly ?? false)
        await client.query("ROLLBACK").catch(() => undefined); // keep the original error
    }
    const fields = result.fields;
    return {
      columns: fields.map(f => f.name),
      typenames: fields.map((f): TypeId => f.dataTypeID).map(f => pg_typenames[f] ?? `${f}`), // TODO: fix number shit casting // TODO: use lib enum
      types: fields.map((f): TypeId => f.dataTypeID).map(f => pg_types[f] ?? ColumnType.UNKNOWN), // "unknown ${f}" string breaks frontend icon lookup; TODO: use lib enum
      rows: result.rows.map(r => Object.values(r as Record<string, unknown>)),
    };
  } finally {
    await client.end();
  }
}

export async function sendBatch(request: Omit<SQLRequest, "query">, statements: string[]): Promise<SQLResponse> {
  let {dsn} = request;
  if (!dsn.startsWith("postgres://"))
    dsn = `postgres://${dsn}`;
  dsn += (dsn.includes("?") ? "&" : "?") + "uselibpqcompat=true";

  const client = new pg.Client({connectionString: dsn});
  try {
    await client.connect();
  } catch (err) {
    await client.end().catch(() => undefined); // release socket even if connection never established
    const e = err as Error & {code?: string};
    throw new Error(`postgres connection failed${e.code === undefined ? "" : ` (${e.code})`}: ${e.message}`);
  }
  try {
    await client.query(request.readOnly ?? false ? "BEGIN READ ONLY" : "BEGIN");
    try {
      const affectedRows: number[] = [];
      for (const statement of statements) {
        const result = await client.query(statement);
        affectedRows.push(result.rowCount ?? 0);
      }
      await client.query("COMMIT");
      return {columns: [], typenames: [], types: [], rows: [], affectedRows};
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined); // keep the original error
      throw err;
    }
  } finally {
    await client.end();
  }
}
