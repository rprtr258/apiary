import mysql, {type ResultSetHeader} from "mysql2/promise.js";
import {ColumnType, SQLRequest, SQLResponse} from "@/types.ts";

// dateStrings: keep DATETIME/TIMESTAMP as raw server text (µs precision) —
// table editing identifies rows by these values, and JS Date would truncate them.
function connect(dsn: string) {
  return mysql.createConnection({uri: dsn, dateStrings: true});
}

export async function send(request: SQLRequest): Promise<SQLResponse> {
  const connection = await connect(request.dsn);
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
      types: fields.map(f => f.type === undefined ? ColumnType.UNKNOWN : String(f.type) as ColumnType),
      rows: rows.map(r => Object.values(r)),
    };
  } finally {
    if (request.readOnly ?? false)
      await connection.execute("SET SESSION TRANSACTION READ WRITE").catch(() => undefined); // keep the original error
    await connection.end();
  }
}

export async function sendBatch(request: Omit<SQLRequest, "query">, statements: string[]): Promise<SQLResponse> {
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
