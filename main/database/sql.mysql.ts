import mysql, {type Connection, type ResultSetHeader} from "mysql2/promise.js";
import {createClientPool} from "./connection_pool.ts";
import {ColumnInfo, ColumnType, ConstraintInfo, ForeignKey, SQLRequest, SQLResponse, TableInfo, TableSchema} from "@/types.ts";

// dateStrings: keep DATETIME/TIMESTAMP as raw server text (µs precision) —
// table editing identifies rows by these values, and JS Date would truncate them.
function connect(dsn: string) {
  return mysql.createConnection({uri: dsn, dateStrings: true});
}

const pool = createClientPool<Connection, string>({
  keyOf: dsn => dsn,
  connect: async dsn => {
    const connection = await connect(dsn);
    // The session's transaction read-only mode is reset in every op's finally;
    // a dropped connection errors the next op, which evicts the client.
    connection.on("error", () => pool.evict(dsn, connection)); // dropped connection: drop the client, next request reconnects
    return connection;
  },
  close: connection => connection.end(),
});

export async function send(request: SQLRequest): Promise<SQLResponse> {
  return await pool.run(request.dsn, async connection => {
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
    }
  });
}

export async function sendBatch(request: Omit<SQLRequest, "query">, statements: string[]): Promise<SQLResponse> {
  // Deliberately not pooled: concurrent batches sharing one connection could
  // interleave statements inside a single transaction.
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

export async function describe(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await send({...request, query: `SELECT
  column_name,
  column_type,
  is_nullable = 'YES',
  column_default
FROM information_schema.columns
WHERE table_name = '${tableName}' AND table_schema = DATABASE()
ORDER BY ordinal_position`});
  const columns: ColumnInfo[] = colResult.rows.map(([name, typ, nullable, defaultVal]) => ({
    name: name as string,
    typename: typ as string,
    type: typ as ColumnType,
    nullable: nullable as boolean,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));

  // Get constraints (simplified - PRIMARY KEY only). key_column_usage has one
  // row per PK column; ordinal_position restores composite key order, so the
  // whole key is returned as a single ordered entry.
  const constraints: ConstraintInfo[] = [];
  try {
    const conResult = await send({...request, query: `SELECT
  column_name
FROM information_schema.key_column_usage
WHERE table_name = '${tableName}' AND table_schema = DATABASE() AND constraint_name = 'PRIMARY'
ORDER BY ordinal_position`}); // TODO: pass tableName as arg
    const pkColumns = conResult.rows.map(r => String(r[0]));
    if (pkColumns.length > 0)
      constraints.push({name: "PRIMARY KEY", type: "PRIMARY KEY", definition: "PRIMARY KEY", columns: pkColumns});
  } catch (_e) {
    // Constraints query is best-effort
  }

  // Get foreign keys (one row per column pair; ordinal_position keeps
  // composite keys ordered). rc carries the update/delete rules, kcu the
  // referenced table/schema/columns.
  const foreign_keys: ForeignKey[] = [];
  try {
    const fkResult = await send({...request, query: `SELECT
  kcu.constraint_name,
  kcu.column_name,
  kcu.referenced_table_schema,
  kcu.referenced_table_name,
  kcu.referenced_column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = kcu.constraint_schema AND rc.constraint_name = kcu.constraint_name
WHERE kcu.table_name = '${tableName}' AND kcu.table_schema = DATABASE() AND kcu.referenced_table_name IS NOT NULL
ORDER BY kcu.constraint_name, kcu.ordinal_position`}); // TODO: pass tableName as arg
    for (const r of fkResult.rows) {
      foreign_keys.push({
        name: String(r[0]),
        column: String(r[1]),
        schema: String(r[2]),
        table: String(r[3]),
        to: String(r[4]),
        onUpdate: String(r[5]),
        onDelete: String(r[6]),
      });
    }
  } catch (_e) {
    // Foreign keys query is best-effort
  }

  // TODO: Get indexes
  return {columns, constraints, foreign_keys, indexes: []};
}

export async function listTables(request: Omit<SQLRequest, "query">): Promise<TableInfo[]> {
  const dbName = (await send({...request, query: "SELECT DATABASE()"})).rows[0][0] as string;
  const tablesResult = await send({...request, query: `SELECT
table_name,
table_rows,
data_length + index_length
FROM information_schema.TABLES
WHERE table_schema = '${dbName}'`}); // TODO: pass dbname as arg
  return tablesResult.rows.map(([name, rowCount, sizeBytes]): TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
}
