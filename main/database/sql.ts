import pg from "pg";
import mysql from "mysql2/promise.js";
import sqlite3 from "sqlite3";
import {open} from "sqlite";
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

  return Array(columns).map((_, i) => {
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

async function sendPostgres(request: SQLRequest): Promise<SQLResponse> {
  // TODO: parse dsn like host=localhost user=postgres password=password port=5432 dbname=postgres sslmode=disable
  const client = new pg.Client({connectionString: request.dsn});
  await client.connect();
  try {
    const result = await client.query(request.query);
    const fields = result.fields;
    return {
      columns: fields.map(f => f.name),
      types: fields.map(f => f.dataTypeID.toString()),
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
      return {columns: fields.map(f => f.name), types: [], rows: []}; // TODO: get column metadata
    }
    return {
      columns: fields.map(f => f.name),
      types: fields.map(f => String(f.type ?? "")),
      rows: rows.map(r => Object.values(r)),
    };
  } finally {
    await connection.end();
  }
}

async function sendSQLite(request: SQLRequest): Promise<SQLResponse> {
  const db = await open({filename: request.dsn, driver: sqlite3.Database});
  try {
    const rows: Record<string, unknown>[] = await db.all(request.query);
    if (rows.length === 0) {
      return {columns: [], types: [], rows: []}; // TODO: get column metadata
    }
    const columns = Object.keys(rows[0]);
    return {
      columns,
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
      return {columns: [], types: [], rows: []}; // TODO: get column metadata
    }
    const columns = Object.keys(rows[0]);
    return {
      columns,
      types: convertTypes(columns.length, rows.map(Object.values)),
      rows: rows.map(r => Object.values(r)),
    };
  } finally {
    await client.close();
  }
}
