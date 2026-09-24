import {mkdtemp} from "fs/promises";
import {tmpdir} from "os";
import {join} from "path";
import {mock, describe, test, expect, beforeAll} from "bun:test";
import {SQLRequest} from "@/types.ts";
import {sendSQL} from "./sql.ts";
import {buildReadTableQuery, describeTable, listTables, testSQLSource, updateTableRows} from "./sql_source.ts";
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

describe("updateTableRows (sqlite)", () => {
  let dir = "";
  let dsn = "";

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "sqlite-update-rows"));
    dsn = join(dir, "apiary-sql-update.db");
    await sendSQL(req({dsn, query: "CREATE TABLE t (id INT PRIMARY KEY, v TEXT)"}));
    // sqlite permits NULL values in (non-INTEGER) PRIMARY KEY columns
    await sendSQL(req({dsn, query: "INSERT INTO t (v) VALUES ('x')"}));
    await sendSQL(req({dsn, query: "INSERT INTO t (id, v) VALUES (1, 'y')"}));
  });

  test("null pk updates via IS NULL", async () => {
    await updateTableRows({dsn, database: "sqlite", readOnly: false}, "t", ["id"],
      [{pkValues: [null], column: "v", value: "z"}]);
    const res = await sendSQL(req({dsn, query: "SELECT v FROM t WHERE id IS NULL"}));
    expect(res.rows).toEqual([["z"]]);
  });

  test("update matching no rows throws", async () => {
    let failed = false;
    try {
      await updateTableRows({dsn, database: "sqlite", readOnly: false}, "t", ["id"],
        [{pkValues: [7], column: "v", value: "nope"}]);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});

describe("buildReadTableQuery (sqlite)", () => {
  let dir = "";
  let dsn = "";

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "sqlite-read-table"));
    dsn = join(dir, "apiary-sql-read-table.db");
    await sendSQL(req({dsn, query: "CREATE TABLE t (a TEXT, b INT, v TEXT, PRIMARY KEY (b, a))"}));
    await sendSQL(req({dsn, query: "INSERT INTO t (a, b, v) VALUES ('x', 1, '1x'), ('y', 1, '1y'), ('x', 0, '0x')"}));
  });

  test("builds pk-ordered pagination query", async () => {
    const query = await buildReadTableQuery(req({dsn}), {table: "t", orderBy: [], limit: 2, offset: 0});
    expect(query).toBe("SELECT * FROM `t` ORDER BY `b` ASC, `a` ASC LIMIT 2 OFFSET 0");
    const res = await sendSQL(req({dsn, query}));
    expect(res.rows.map(r => r[2])).toEqual(["0x", "1x"]); // (b, a) key order
  });

  test("appends pk as tiebreaker after user sort", async () => {
    const query = await buildReadTableQuery(req({dsn}), {table: "t", orderBy: [{column: "a", direction: "desc"}], limit: 2, offset: 0});
    expect(query).toBe("SELECT * FROM `t` ORDER BY `a` DESC, `b` ASC, `a` ASC LIMIT 2 OFFSET 0");
    const res = await sendSQL(req({dsn, query}));
    // a DESC puts 'y' first; the two rows tied on a='x' are broken by b ASC
    expect(res.rows.map(r => r[2])).toEqual(["1y", "0x"]);
  });
});

describe("describeTable (sqlite)", () => {
  test("composite primary key returned as a single ordered entry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-describe-pk"));
    const dsn = join(dir, "apiary-sql-describe.db");
    await sendSQL(req({dsn, query: "CREATE TABLE t (a TEXT, b INT, v TEXT, PRIMARY KEY (b, a))"}));
    const schema = await describeTable({dsn, database: "sqlite"}, "t");
    const pks = schema.constraints.filter(c => c.type === "PRIMARY KEY");
    expect(pks.length).toBe(1);
    // key order (b, a), not table column order (a, b)
    expect(pks[0].columns).toEqual(["b", "a"]);
    // column list lives in `columns`, not in the definition
    expect(pks[0].definition).toBe("PRIMARY KEY");
  });
});
