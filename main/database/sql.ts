import {Database, SQLRequest, SQLResponse, TableInfo, TableSchema} from "@/types.ts";
import * as pg from "./sql.postgres.ts";
import * as mysql from "./sql.mysql.ts";
import * as sqlite from "./sql.sqlite.ts";
import * as ch from "./sql.ch.ts";

export const EmptyRequest: SQLRequest = {
  dsn: ":memory:", // TODO: insert last dsn used
  database: "sqlite",
  query: "SELECT 1",
};

export async function send(request: SQLRequest): Promise<SQLResponse> {
  return {
    postgres:   pg.send,
    mysql:      mysql.send,
    sqlite:     sqlite.send,
    clickhouse: ch.send,
  }[request.database](request);
}

// Run several statements on one connection inside one transaction. Used for
// table cell edits: a failing statement rolls back the whole batch.
export async function sendBatch(request: Omit<SQLRequest, "query">, statements: string[]): Promise<SQLResponse> {
  return {
    postgres:   pg.sendBatch,
    mysql:      mysql.sendBatch,
    sqlite:     sqlite.sendBatch,
    clickhouse: ch.sendBatch,
  }[request.database](request, statements);
}

// Identifier quoting rules per database (mirrors the renderer's buildQuery).
export const quoteIdent: Record<Database, (s: string) => string> = {
  postgres:   (s: string) => `"${s}"`,
  mysql:      (s: string) => "`" + s + "`",
  sqlite:     (s: string) => "`" + s + "`",
  clickhouse: (s: string) => "`" + s.replaceAll("`", "\\`") + "`",
};

export async function describeTable(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  return {
    postgres:   pg.describe,
    mysql:      mysql.describe,
    sqlite:     sqlite.describe,
    clickhouse: ch.describe,
  }[request.database](request, tableName);
}

export async function listTables(request: Omit<SQLRequest, "query">): Promise<TableInfo[]> {
  const tables = await {
    postgres: pg.listTables,
    mysql: mysql.listTables,
    sqlite: sqlite.listTables,
    clickhouse: ch.listTables,
  }[request.database](request);
  return tables.toSorted((a, b) => a.name.localeCompare(b.name));
}
