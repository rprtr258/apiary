import {SQLRequest, SQLResponse} from "@/types.ts";
import * as pg from "./sql.postgres.ts";
import * as mysql from "./sql.mysql.ts";
import * as sqlite from "./sql.sqlite.ts";
import * as ch from "./sql.ch.ts";

export const EmptyRequest: SQLRequest = {
  dsn: ":memory:", // TODO: insert last dsn used
  database: "sqlite",
  query: "SELECT 1",
};

export async function sendSQL(request: SQLRequest): Promise<SQLResponse> {
  return {
    "postgres":   pg.send,
    "mysql":      mysql.send,
    "sqlite":     sqlite.send,
    "clickhouse": ch.send,
  }[request.database](request);
}

// Run several statements on one connection inside one transaction. Used for
// table cell edits: a failing statement rolls back the whole batch.
export async function sendSQLBatch(request: Omit<SQLRequest, "query">, statements: string[]): Promise<SQLResponse> {
  return {
    "postgres":   pg.sendBatch,
    "mysql":      mysql.sendBatch,
    "sqlite":     sqlite.sendBatch,
    "clickhouse": ch.sendBatch,
  }[request.database](request, statements);
}
