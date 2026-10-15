import * as t from "@/types.ts";
import * as postgres from "./sql.postgres.ts";
import * as mysql from "./sql.mysql.ts";
import * as sqlite from "./sql.sqlite.ts";
import * as clickhouse from "./sql.ch.ts";
import * as redis from "./sql.redis.ts";

export const EmptyRequest: t.SQLRequest = {
  dsn: ":memory:", // TODO: insert last dsn used
  database: "sqlite",
  query: "SELECT 1",
};

type SQLDatabase = {
  send(request: t.SQLRequest): Promise<t.SQLResponse>,
  explain(request: t.SQLRequest): Promise<t.SQLExplain>,
  sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse>,
  describe(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema>,
  listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]>,
  quoteIdent(s: string): string,
};

const router: Record<t.Database, SQLDatabase> = {
  postgres,
  mysql,
  sqlite,
  clickhouse,
  redis,
};

export async function send(request: t.SQLRequest): Promise<t.SQLResponse> {
  return router[request.database].send(request);
}

// Identifier quoting rules per database (mirrors the renderer's buildQuery).
export function quoteIdent(db: t.Database, s: string): string {
  return router[db].quoteIdent(s);
}

// EXPLAIN output of the query, as plain text, for every database. Not saved to
// history; the Explain tab fetches it on open.
export async function explain(request: t.SQLRequest): Promise<t.SQLExplain> {
  return router[request.database].explain(request);
}

// Run several statements on one connection inside one transaction. Used for
// table cell edits: a failing statement rolls back the whole batch.
export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  return router[request.database].sendBatch(request, statements);
}

export async function describeTable(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema> {
  return router[request.database].describe(request, tableName);
}

export async function listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]> {
  const tables = await router[request.database].listTables(request);
  return tables.toSorted((a, b) => a.name.localeCompare(b.name));
}
