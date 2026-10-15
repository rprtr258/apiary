import {createClient, type ClickHouseClient} from "@clickhouse/client";
import {createClientPool} from "./connection_pool.ts";
import * as t from "@/types.ts";

// TODO: fix get types
function convertTypes(columns: number, rows: unknown[][]): t.ColumnType[] {
  if (rows.length === 0) {
    return new Array<t.ColumnType>(columns).fill(t.ColumnType.STRING); // TODO: unknown fallback
  }

  return Array.from({length: columns}).map((_, i) => {
    const row = rows.map(r => r[i]).filter(r => r !== null);
    return ((): t.ColumnType => {
      switch (typeof row[0]) {
      case "string": return t.ColumnType.STRING;
      case "number": return t.ColumnType.NUMBER;
      case "boolean": return t.ColumnType.BOOLEAN;
      case "object": if (row[0] instanceof Date) return t.ColumnType.TIME;
      }
      return t.ColumnType.STRING; // TODO: unknown fallback
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

export async function send(request: t.SQLRequest): Promise<t.SQLResponse> {
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

export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  // ClickHouse has no transactions; statements run sequentially. Table editing
  // is unreachable for ClickHouse (no PK introspection), this is a safety net.
  return await pool.run(request.dsn, async client => {
    for (const statement of statements)
      await client.exec({query: statement, clickhouse_settings: request.readOnly ?? false ? {readonly: "1"} : {}});
    return {columns: [], typenames: [], types: [], rows: []};
  });
}

// EXPLAIN PLAN does not execute the query; the plan prints as text lines, so
// the raw TSV response is the text form (no JSON parsing round-trip).
export async function explain(request: t.SQLRequest): Promise<t.SQLExplain> {
  return await pool.run(request.dsn, async client => {
    const resultSet = await client.query({query: `EXPLAIN PLAN ${request.query}`, format: "TabSeparated"});
    const raw = (await resultSet.text()).trimEnd();
    return {raw};
  });
}

export async function describe(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema> {
  // Get columns
  const colResult = await send({...request, query: `SELECT
  name,
  type,
  default_kind != '',
  default_expression
FROM system.columns
WHERE database = currentDatabase() AND table = '${tableName}'`});
  const columns: t.ColumnInfo[] = colResult.rows.map(r => ({
    name: String(r[0]),
    typename: String(r[1]),
    type: String(r[1]) as t.ColumnType,
    nullable: String(r[1]).includes("Nullable"),
    defaultValue: ["YES" as unknown, 1, true].includes(r[2]) ? JSON.stringify(r[3] ?? "") : "",
  }));

  // TODO: get rest
  return {columns, constraints: [], foreign_keys: [], indexes: []};
}

export async function listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]> {
  return (await send({...request, query: `SELECT
  name,
  total_rows,
  total_bytes
FROM system.tables
WHERE database = currentDatabase()`})).rows.map(([name, rowCount, sizeBytes]): t.TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
}

export function quoteIdent(s: string): string {
  return "`" + s.replaceAll("`", "\\`") + "`";
}
