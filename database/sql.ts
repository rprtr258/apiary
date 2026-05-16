import pg from "pg";
import mysql from "mysql2/promise.js";
import sqlite3 from "sqlite3";
import {open} from "sqlite";
import {createClient} from "@clickhouse/client";
import {Database, type SQLRequest, type SQLResponse} from "../types/models.ts";

export async function sendSQL(request: SQLRequest): Promise<SQLResponse> {
  switch (request.database) {
  case Database.POSTGRES:   return sendPostgres(request);
  case Database.MYSQL:      return sendMySQL(request);
  case Database.SQLITE:     return sendSQLite(request);
  case Database.CLICKHOUSE: return sendClickHouse(request);
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
      rows: result.rows.map(r => Object.values(r)),
    };
  } finally {
    await client.end();
  }
}

async function sendMySQL(request: SQLRequest): Promise<SQLResponse> {
  const connection = await mysql.createConnection(request.dsn);
  try {
    const [rows, fields] = await connection.execute(request.query);
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
      types: columns.map(() => "text"),
      rows: rows.map(r => Object.values(r)),
    };
  } finally {
    db.close();
  }
}

async function sendClickHouse(request: SQLRequest): Promise<SQLResponse> {
  const client = createClient({url: request.dsn});
  try {
    const resultSet = await client.query({query: request.query, format: "JSONEachRow"});
    const rows = await resultSet.json();
    if (rows.length === 0) {
      return {columns: [], types: [], rows: []}; // TODO: get column metadata
    }
    const columns = Object.keys(rows[0]);
    return {
      columns,
      types: columns.map(() => "text"),
      rows: rows.map(r => Object.values(r)),
    };
  } finally {
    await client.close();
  }
}
