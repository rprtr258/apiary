import {createClient, type ClickHouseClient} from "@clickhouse/client";
import {createClientPool} from "./connection_pool.ts";
import {ColumnInfo, ColumnType, SQLRequest, SQLResponse, TableInfo, TableSchema} from "@/types.ts";

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

// Stateless HTTP client (readonly is a per-query setting), so every entry
// point rides the pool.
const pool = createClientPool<ClickHouseClient, string>({
  keyOf: dsn => dsn,
  connect: async dsn => createClient({url: dsn, max_open_connections: 10}),
  close: client => client.close(),
});

export async function send(request: SQLRequest): Promise<SQLResponse> {
  return await pool.run(request.dsn, async client => {
    const ping = await client.ping();
    if (!ping.success) {
      throw new Error(`ClickHouse ping failed: ${ping.error}`);
    }

    const resultSet = await client.query({query: request.query, format: "JSONEachRow", clickhouse_settings: request.readOnly ?? false ? {readonly: "1"} : {}});
    const rows: Record<string, unknown>[] = await resultSet.json();
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
  });
}

export async function sendBatch(request: Omit<SQLRequest, "query">, statements: string[]): Promise<SQLResponse> {
  // ClickHouse has no transactions; statements run sequentially. Table editing
  // is unreachable for ClickHouse (no PK introspection), this is a safety net.
  return await pool.run(request.dsn, async client => {
    for (const statement of statements)
      await client.exec({query: statement, clickhouse_settings: request.readOnly ?? false ? {readonly: "1"} : {}});
    return {columns: [], typenames: [], types: [], rows: []};
  });
}

export async function describe(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await send({...request, query: `SELECT
  name,
  type,
  default_kind != '',
  default_expression
FROM system.columns
WHERE database = currentDatabase() AND table = '${tableName}'`});
  const columns: ColumnInfo[] = colResult.rows.map(r => ({
    name: String(r[0]),
    typename: String(r[1]),
    type: String(r[1]) as ColumnType,
    nullable: String(r[1]).includes("Nullable"),
    defaultValue: ["YES" as unknown, 1, true].includes(r[2]) ? JSON.stringify(r[3] ?? "") : "",
  }));

  // TODO: get rest
  return {columns, constraints: [], foreign_keys: [], indexes: []};
}

export async function listTables(request: Omit<SQLRequest, "query">): Promise<TableInfo[]> {
  return (await send({...request, query: `SELECT
  name,
  total_rows,
  total_bytes
FROM system.tables
WHERE database = currentDatabase()`})).rows.map(([name, rowCount, sizeBytes]): TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
}
