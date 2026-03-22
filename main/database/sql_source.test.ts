import {mkdtemp} from "fs/promises";
import {tmpdir} from "os";
import {join} from "path";
import {mock, describe, test, expect} from "bun:test";
import {SQLRequest} from "@/types.ts";
import {sendSQL} from "./sql.ts";
import {listTables, testSQLSource} from "./sql_source.ts";
import {BetterLikeDB} from "./sql.test.ts";

mock.module("better-sqlite3", () => ({
  default: BetterLikeDB,
}));

function req(overrides?: Partial<SQLRequest>): SQLRequest {
  return {dsn: ":memory:", database: "sqlite", query: "SELECT 1", ...overrides};
}

describe("listTables", () => {
  test("sqlite", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-list-tables"));
    const TEST_DB = dir + "/apiary-sql-test.db";

    const result1 = await sendSQL(req({dsn: TEST_DB, query: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"}));
    expect(result1).toEqual({typenames: [], types: [], columns: [], rows: []});

    const result2 = await sendSQL(req({dsn: TEST_DB, query: "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, user_id INTEGER)"}));
    expect(result2).toEqual({typenames: [], types: [], columns: [], rows: []});

    const result = await listTables({database: "sqlite", dsn: TEST_DB});
    expect(result).toEqual([
      {name: "posts", rowCount: 0, sizeBytes: 0},
      {name: "users", rowCount: 0, sizeBytes: 0},
    ]);
  });
});

describe("testSQLSource", () => {
  test("sqlite", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-list-tables"));
    const TEST_DB = dir + "/apiary-sql-test.db";
    await testSQLSource(req({dsn: TEST_DB}));
  });
});
