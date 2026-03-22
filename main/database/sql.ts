import pg from "pg";
import {TypeId, builtins as typeIDs} from "pg-types";
import mysql from "mysql2/promise.js";
import Database from "better-sqlite3";
import {createClient} from "@clickhouse/client";
import {ColumnType, type SQLRequest, type SQLResponse} from "@/types.ts";

export const EmptyRequest: SQLRequest = {
  dsn: ":memory:", // TODO: insert last dsn used
  database: "sqlite",
  query: "SELECT 1",
};

// TODO: fix get types
function convertTypes(columns: number, rows: unknown[][]): ColumnType[] {
  if (rows.length === 0) {
    return new Array<ColumnType>(columns).fill(ColumnType.STRING); // TODO: unknown fallback
  }

  return Array.from({length: columns}).map((_, i) => {
    const row = rows.map(r => r[i]).filter(r => r !== null);
    return ((): ColumnType => {
      switch (typeof row[0]) {
      case "string": return ColumnType.STRING;
      case "number": return ColumnType.NUMBER;
      case "boolean": return ColumnType.BOOLEAN;
      case "object": if (row[0] instanceof Date) return ColumnType.TIME;
      }
      return ColumnType.STRING; // TODO: unknown fallback
    })();
  });
}

export async function sendSQL(request: SQLRequest): Promise<SQLResponse> {
  switch (request.database) {
  case "postgres":   return sendPostgres(request);
  case "mysql":      return sendMySQL(request);
  case "sqlite":     return sendSQLite(request);
  case "clickhouse": return sendClickHouse(request);
  default:
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`unsupported database type: ${request.database}`);
  }
}

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
};

async function sendPostgres(request: SQLRequest): Promise<SQLResponse> {
  let {dsn} = request;
  if (!dsn.startsWith("postgres://"))
    dsn = `postgres://${dsn}`;

  // TODO: parse dsn like host=localhost user=postgres password=password port=5432 dbname=postgres sslmode=disable
  const client = new pg.Client({connectionString: dsn, ssl: false});
  await client.connect();
  try {
    const result = await client.query(request.query);
    const fields = result.fields;
    return {
      columns: fields.map(f => f.name),
      typenames: fields.map((f): TypeId => f.dataTypeID).map(f => pg_typenames[f] ?? `${f}`), // TODO: fix number shit casting // TODO: use lib enum
      types: fields.map((f): TypeId => f.dataTypeID).map(f => pg_types[f] ?? ColumnType.UNKNOWN + ` ${f}` as ColumnType), // TODO: fix number shit casting
      rows: result.rows.map(r => Object.values(r as Record<string, unknown>)),
    };
  } finally {
    await client.end();
  }
}

async function sendMySQL(request: SQLRequest): Promise<SQLResponse> {
  const connection = await mysql.createConnection(request.dsn);
  try {
    const [rows, fields] = await connection.execute(request.query) as [Record<string, unknown>[], {name: string, type?: number}[]];
    if (rows.length === 0) {
      return {columns: fields.map(f => f.name), typenames: [], types: [], rows: []}; // TODO: get column metadata
    }
    return {
      columns: fields.map(f => f.name),
      typenames: fields.map(f => f.type === undefined ? "???" : String(f.type)),
      types: fields.map(f => f.type === undefined ? ColumnType.UNKNOWN : String(f.type) as ColumnType),
      rows: rows.map(r => Object.values(r)),
    };
  } finally {
    await connection.end();
  }
}

function sendSQLite(request: SQLRequest): SQLResponse {
  const db = new Database(request.dsn);
  try {
    const rows = db.prepare(request.query).all() as Record<string, unknown>[];
    if (rows.length === 0) {
      return {columns: [], typenames: [], types: [], rows: []}; // TODO: get column metadata
    }
    const columns = Object.keys(rows[0]);
    return {
      columns,
      typenames: convertTypes(columns.length, rows.map(Object.values)),
      types: convertTypes(columns.length, rows.map(Object.values)),
      rows: rows.map(r => Object.values(r)),
    };
  } finally {
    db.close();
  }
}

async function sendClickHouse(request: SQLRequest): Promise<SQLResponse> {
  const client = createClient({url: request.dsn, max_open_connections: 10});
  const ping = await client.ping();
  if (!ping.success) {
    throw new Error(`ClickHouse ping failed: ${ping.error}`);
  }

  try {
    const resultSet = await client.query({query: request.query, format: "JSONEachRow"});
    const rows: Record<string, unknown>[] = await resultSet.json();
    if (rows.length === 0) {
      return {columns: [], typenames: [], types: [], rows: []}; // TODO: get column metadata
    }
    const columns = Object.keys(rows[0]);
    return {
      columns,
      typenames: convertTypes(columns.length, rows.map(Object.values)),
      types: convertTypes(columns.length, rows.map(Object.values)),
      rows: rows.map(r => Object.values(r)),
    };
  } finally {
    await client.close();
  }
}