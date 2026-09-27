import Database from "better-sqlite3";
import {ColumnInfo, ColumnType, ConstraintInfo, ForeignKey, IndexInfo, SQLRequest, SQLResponse, TableInfo, TableSchema} from "@/types.ts";

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

export async function send(request: SQLRequest): Promise<SQLResponse> {
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

export async function describe(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  const columns: ColumnInfo[] = [];
  const constraints: ConstraintInfo[] = [];

  // Get columns via PRAGMA table_info (returns: cid, name, type, notnull, dflt, pk)
  const colResult = await send({...request, query: `PRAGMA table_info('${tableName}')`});
  const pkRows: {name: string, pos: number}[] = [];
  for (const r of colResult.rows) {
    const name = String(r[1]);
    const typ = String(r[2]);
    const notnull = [1 as unknown, true, "1"].includes(r[3]);
    const defaultVal = JSON.stringify(r[4] ?? "");
    const pk = Number(r[5]); // 1-based position within a composite key

    columns.push({name, typename: typ, type: typ as ColumnType, nullable: !notnull, defaultValue: defaultVal});
    if (pk > 0)
      pkRows.push({name, pos: pk});
  }
  if (pkRows.length > 0) {
    const pkColumns = pkRows.sort((a, b) => a.pos - b.pos).map(r => r.name);
    constraints.push({name: "PRIMARY KEY", type: "PRIMARY KEY", definition: "PRIMARY KEY", columns: pkColumns});
  }

  // Get indexes
  const idxResult = await send({...request, query: `SELECT name, sql
FROM sqlite_master
WHERE type = 'index' AND tbl_name = '${tableName}'
ORDER BY name`}); // TODO: pass tableName as arg
  const indexes: IndexInfo[] = idxResult.rows.map(r => ({
    name: String(r[0]),
    definition: JSON.stringify(r[1] ?? ""),
  }));

  // Get foreign keys via PRAGMA foreign_key_list (returns: id, seq, table, from, to, on_update, on_delete, match).
  // SQLite FKs are anonymous and resolve within the same database, so name
  // and schema are empty; `to` is null for implicit-PK references.
  let foreign_keys: ForeignKey[] = [];
  try {
    const fkResult = await send({...request, query: `PRAGMA foreign_key_list('${tableName}')`});
    foreign_keys = fkResult.rows.map(r => ({name: "", column: String(r[3]), schema: "", table: String(r[2]), to: String((r[4] as string | null) ?? ""), onUpdate: String(r[5]), onDelete: String(r[6])}));
  } catch (_e) {
    // Foreign keys query is best-effort
  }

  return {columns, constraints, foreign_keys, indexes};
}

export async function listTables(request: Omit<SQLRequest, "query">): Promise<TableInfo[]> {
  const tableNames = (await send({...request, query: `SELECT name FROM sqlite_master WHERE type='table'`})).rows.map(r => String(r[0]));
  const tables: TableInfo[] = [];
  // TODO: async map
  for (const table of tableNames) {
    // Approximate size (rough estimate)
    const colRows = (await send({...request, query: `PRAGMA table_info(${table})`})).rows.map(([_cid, name, _ctype, _notnull, _dflt, _pk]) => name as string);
    const lengthExpr = colRows.map(c => `COALESCE(LENGTH("${c}"),0)`).join(" + ");
    const [rowCount, sizeBytes] = (await send({...request, query: `SELECT COUNT(*) AS rows, COALESCE(SUM(${lengthExpr}), 0) AS payload FROM "${table}"`})).rows[0];
    tables.push({name: table, rowCount: rowCount as number, sizeBytes: sizeBytes as number});
  }
  return tables;
}
