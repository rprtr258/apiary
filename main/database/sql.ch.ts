import {createClient} from "@clickhouse/client";
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

export async function send(request: SQLRequest): Promise<SQLResponse> {
  const client = createClient({url: request.dsn, max_open_connections: 10});
  const ping = await client.ping();
  if (!ping.success) {
    throw new Error(`ClickHouse ping failed: ${ping.error}`);
  }

  try {
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
  } finally {
    await client.close();
  }
}

export async function sendBatch(request: Omit<SQLRequest, "query">, statements: string[]): Promise<SQLResponse> {
  // ClickHouse has no transactions; statements run sequentially. Table editing
  // is unreachable for ClickHouse (no PK introspection), this is a safety net.
  const client = createClient({url: request.dsn, max_open_connections: 10});
  try {
    for (const statement of statements)
      await client.exec({query: statement, clickhouse_settings: request.readOnly ?? false ? {readonly: "1"} : {}});
    return {columns: [], typenames: [], types: [], rows: []};
  } finally {
    await client.close();
  }
}
