import Database from "better-sqlite3";
import {ColumnType, SQLRequest, SQLResponse} from "@/types.ts";

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

export function send(request: SQLRequest): SQLResponse {
  const db = new Database(request.dsn, {readonly: request.readOnly ?? false});
  try {
    const rows = db.prepare(request.query).all() as Record<string, unknown>[];
    if (rows.length === 0) {
      return {columns: [], typenames: [], types: [], rows: []}; // TODO: get column metadata
    }
    const columns = Object.keys(rows[0]);
    const typenames = convertTypes(columns.length, rows.map(Object.values));
    return {
      columns,
      typenames: typenames,
      types: typenames,
      rows: rows.map(r => Object.values(r)),
    };
  } finally {
    db.close();
  }
}

export function sendBatch(request: Omit<SQLRequest, "query">, statements: string[]): SQLResponse {
  const db = new Database(request.dsn, {readonly: request.readOnly ?? false});
  try {
    const affectedRows: number[] = [];
    db.transaction(() => {
      // prepare().run() (not exec) so per-statement affected counts are available.
      for (const statement of statements)
        affectedRows.push(Number(db.prepare(statement).run().changes));
    })();
    return {columns: [], typenames: [], types: [], rows: [], affectedRows};
  } finally {
    db.close();
  }
}
