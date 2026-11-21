import {mkdtemp} from "fs/promises";
import {tmpdir} from "os";
import {join} from "path";
import {mock, describe, test, expect} from "bun:test";
import {SQLRequest, ColumnType} from "@/types.ts";
import {send, sendBatch, explain} from "./sql.ts";
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
    expect(result).toEqual({typenames: ["TEXT"], types: [ColumnType.STRING], columns: ["name"], rows: [["posts"], ["users"]]});
  });

  test("reports declared column types for empty result sets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-empty-types"));
    const TEST_DB = dir + "/apiary-sql-test.db";
    await send(req({dsn: TEST_DB, query: "CREATE TABLE t (id INTEGER, name TEXT, flag BOOLEAN, created DATETIME)"}));

    const result = await send(req({dsn: TEST_DB, query: "SELECT id, name, flag, created FROM t WHERE 0"}));
    expect(result.columns).toEqual(["id", "name", "flag", "created"]);
    expect(result.typenames).toEqual(["INTEGER", "TEXT", "BOOLEAN", "DATETIME"]);
    expect(result.types).toEqual([ColumnType.NUMBER, ColumnType.STRING, ColumnType.BOOLEAN, ColumnType.TIME]);
    expect(result.rows).toEqual([]);
  });

  test("expression columns fall back to value shape, then UNKNOWN", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-expr-types"));
    const TEST_DB = dir + "/apiary-sql-test.db";
    await send(req({dsn: TEST_DB, query: "CREATE TABLE t (id INTEGER)"}));
    await send(req({dsn: TEST_DB, query: "INSERT INTO t VALUES (1)"}));
    await send(req({dsn: TEST_DB, query: "INSERT INTO t VALUES (NULL)"}));

    const result = await send(req({dsn: TEST_DB, query: "SELECT id * 2 AS dbl, COUNT(*) AS n FROM t"}));
    expect(result.typenames).toEqual(["number", "number"]);
    expect(result.types).toEqual([ColumnType.NUMBER, ColumnType.NUMBER]);

    const empty = await send(req({dsn: TEST_DB, query: "SELECT id * 2 AS dbl FROM t WHERE 0"}));
    expect(empty.typenames).toEqual(["unknown"]);
    expect(empty.types).toEqual([ColumnType.UNKNOWN]);
  });
  test("reports affected rows for writes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-affected-rows"));
    const TEST_DB = dir + "/apiary-sql-test.db";
    await sendBatch(req({dsn: TEST_DB}), ["CREATE TABLE t (id INTEGER, val TEXT)"]);

    const insert = await sendBatch(req({dsn: TEST_DB}), [
      "INSERT INTO t VALUES (1, 'a'), (2, 'b')",
    ]);
    expect(insert.affectedRows).toEqual([2]);

    const update = await sendBatch(req({dsn: TEST_DB}), [
      "UPDATE t SET val = 'x' WHERE id >= 1",
      "UPDATE t SET val = 'y' WHERE id = 2",
    ]);
    expect(update.affectedRows).toEqual([2, 1]);
  });
});

describe("explainSQL sqlite", () => {
  test("returns raw details and the parsed plan tree", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-explain"));
    const TEST_DB = dir + "/apiary-sql-test.db";
    await send(req({dsn: TEST_DB, query: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"}));

    const plan = await explain(req({dsn: TEST_DB, query: "SELECT name FROM users WHERE id = 1"}));
    expect(plan).toMatchSnapshot();
  });

  test("explains write statements without executing them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-explain-write"));
    const TEST_DB = dir + "/apiary-sql-test.db";
    await send(req({dsn: TEST_DB, query: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"}));

    await explain(req({dsn: TEST_DB, query: "INSERT INTO users (id, name) VALUES (1, 'a')"}));
    const result = await send(req({dsn: TEST_DB, query: "SELECT COUNT(*) FROM users"}));
    expect(result.rows).toEqual([[0]]);
  });
});
