import {mkdtemp} from "fs/promises";
import {tmpdir} from "os";
import {join} from "path";
import {mock, describe, test, expect} from "bun:test";
import {SQLRequest, ColumnType} from "@/types.ts";
import {send} from "./sql.ts";
import {BetterLikeDB} from "./mock_better_sqlite3.ts";

mock.module("better-sqlite3", () => ({
  default: BetterLikeDB,
}));

function req(overrides?: Partial<SQLRequest>): SQLRequest {
  return {dsn: ":memory:", database: "sqlite", query: "SELECT 1", ...overrides};
}

describe("sendSQL sqlite", () => {
  test("creates tables and lists them via sqlite_master", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-list-tables"));
    const TEST_DB = dir + "/apiary-sql-test.db";

    const result1 = await send(req({dsn: TEST_DB, query: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"}));
    expect(result1).toEqual({typenames: [], types: [], columns: [], rows: []});

    const result2 = await send(req({dsn: TEST_DB, query: "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, user_id INTEGER)"}));
    expect(result2).toEqual({typenames: [], types: [], columns: [], rows: []});

    const result = await send(req({dsn: TEST_DB, query: "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"}));
    expect(result).toEqual({typenames: ["string"], types: [ColumnType.STRING], columns: ["name"], rows: [["posts"], ["users"]]});
  });
});
