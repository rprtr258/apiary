import {mkdtemp} from "fs/promises";
import {tmpdir} from "os";
import {join} from "path";
import {mock, describe, test, expect} from "bun:test";
import {SQLRequest, TableFilter, TableRead} from "@/types.ts";
import {describeTable, sendSQL, listTables} from "./sql.ts";
import {buildReadTableQuery, buildFilterCondition, countRowsSQLSource, testSQLSource, updateTableRows} from "./sql_source.ts";
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

async function use_sqlite_update_rows(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sqlite-update-rows"));
  const dsn = join(dir, "apiary-sql-update.db");
  await sendSQL(req({dsn, query: "CREATE TABLE t (id INT PRIMARY KEY, v TEXT)"}));
  // sqlite permits NULL values in (non-INTEGER) PRIMARY KEY columns
  await sendSQL(req({dsn, query: "INSERT INTO t (v) VALUES ('x')"}));
  await sendSQL(req({dsn, query: "INSERT INTO t (id, v) VALUES (1, 'y')"}));
  return dsn;
}

describe("updateTableRows (sqlite)", () => {
  test("null pk updates via IS NULL", async () => {
    const dsn = await use_sqlite_update_rows();
    await updateTableRows({dsn, database: "sqlite", readOnly: false}, "t", ["id"],
      [{pkValues: [null], column: "v", value: "z"}]);
    const res = await sendSQL(req({dsn, query: "SELECT v FROM t WHERE id IS NULL"}));
    expect(res.rows).toEqual([["z"]]);
  });

  test("update matching no rows throws", async () => {
    const dsn = await use_sqlite_update_rows();
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

describe("buildFilterCondition", () => {
  const pg: Omit<SQLRequest, "query"> = {dsn: "", database: "postgres"};
  const sq: Omit<SQLRequest, "query"> = {dsn: "", database: "sqlite"};

  test("simple operators build engine-correct conditions", () => {
    expect(buildFilterCondition(sq, {kind: "simple", column: "age", op: "=", value: "18"})).toBe("`age` = 18");
    expect(buildFilterCondition(pg, {kind: "simple", column: "age", op: "!=", value: "18"})).toBe(`"age" != 18`);
    expect(buildFilterCondition(sq, {kind: "simple", column: "age", op: "<", value: "18"})).toBe("`age` < 18");
    expect(buildFilterCondition(sq, {kind: "simple", column: "age", op: "<=", value: "18"})).toBe("`age` <= 18");
    expect(buildFilterCondition(pg, {kind: "simple", column: "age", op: ">", value: "18"})).toBe(`"age" > 18`);
    expect(buildFilterCondition(pg, {kind: "simple", column: "age", op: ">=", value: "18"})).toBe(`"age" >= 18`);
    expect(buildFilterCondition(sq, {kind: "simple", column: "name", op: "like", value: "a%"})).toBe("`name` LIKE 'a%'");
    expect(buildFilterCondition(sq, {kind: "simple", column: "name", op: "not like", value: "a%"})).toBe("`name` NOT LIKE 'a%'");
    expect(buildFilterCondition(sq, {kind: "simple", column: "id", op: "in", value: "1, 2, 3"})).toBe("`id` IN (1, 2, 3)");
    expect(buildFilterCondition(sq, {kind: "simple", column: "name", op: "is null", value: null})).toBe("`name` IS NULL");
    expect(buildFilterCondition(sq, {kind: "simple", column: "name", op: "is not null", value: null})).toBe("`name` IS NOT NULL");
  });

  test("parses raw string values into literals", () => {
    expect(buildFilterCondition(sq, {kind: "simple", column: "name", op: "=", value: "apple"})).toBe("`name` = 'apple'");
    expect(buildFilterCondition(sq, {kind: "simple", column: "flag", op: "=", value: "TRUE"})).toBe("`flag` = TRUE");
    expect(buildFilterCondition(sq, {kind: "simple", column: "id", op: "in", value: "1, x ,2"})).toBe("`id` IN (1, 'x', 2)");
  });

  test("escapes quotes in values", () => {
    expect(buildFilterCondition(sq, {kind: "simple", column: "name", op: "=", value: "o'brien"})).toBe("`name` = 'o''brien'");
  });

  test("manual filters are embedded as a parenthesized WHERE condition", () => {
    expect(buildFilterCondition(sq, {kind: "manual", expr: "id >= 2 AND name != 'x'"})).toBe("(id >= 2 AND name != 'x')");
  });

  test("value shape must match the operator", () => {
    expect(() => buildFilterCondition(sq, {kind: "simple", column: "id", op: "in", value: " , "})).toThrow();
    expect(() => buildFilterCondition(sq, {kind: "simple", column: "id", op: "=", value: null})).toThrow();
  });
});

async function use_sqlite_table_filter(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sqlite-table-filter"));
  const dsn = join(dir, "apiary-sql-filter.db");
  await sendSQL(req({dsn, query: "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, score INT)"}));
  await sendSQL(req({dsn, query: "INSERT INTO t (name, score) VALUES ('apple', 1), ('banana', 2), ('Cherry', 3), (NULL, 4)"}));
  return dsn;
}

describe("table reads with filter (sqlite)", () => {
  const request = {dsn: "", database: "sqlite" as const};
  const read = (filter: TableFilter | null): TableRead => ({table: "t", orderBy: [], filter, limit: 10, offset: 0});

  test("read query filters rows", async () => {
    const dsn = await use_sqlite_table_filter();
    request.dsn = dsn;
    const q = await buildReadTableQuery(request, read({kind: "simple", column: "score", op: ">", value: "1"}));
    const res = await sendSQL(req({dsn, query: q}));
    expect(res.rows.map(r => r[1])).toEqual(["banana", "Cherry", null]);
  });

  test("manual condition filters rows and an invalid one fails the query", async () => {
    const dsn = await use_sqlite_table_filter();
    const q = await buildReadTableQuery(request, read({kind: "manual", expr: "score >= 2 AND name IS NOT NULL"}));
    expect((await sendSQL(req({dsn, query: q}))).rows.map(r => r[1])).toEqual(["banana", "Cherry"]);
    const bad = await buildReadTableQuery(request, read({kind: "manual", expr: "score >="}));
    let failed = false;
    try {
      await sendSQL(req({dsn, query: bad}));
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  test("countRowsSQLSource respects the filter", async () => {
    expect(await countRowsSQLSource(request, "t", null)).toBe(4);
    expect(await countRowsSQLSource(request, "t", {kind: "simple", column: "name", op: "is not null", value: null})).toBe(3);
    expect(await countRowsSQLSource(request, "t", {kind: "manual", expr: "score < 3"})).toBe(2);
  });
});

async function use_sqlite_read_table(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sqlite-read-table"));
  const dsn = join(dir, "apiary-sql-read-table.db");
  await sendSQL(req({dsn, query: "CREATE TABLE t (a TEXT, b INT, v TEXT, PRIMARY KEY (b, a))"}));
  await sendSQL(req({dsn, query: "INSERT INTO t (a, b, v) VALUES ('x', 1, '1x'), ('y', 1, '1y'), ('x', 0, '0x')"}));
  return dsn;
}

describe("buildReadTableQuery (sqlite)", () => {
  test("builds pk-ordered pagination query", async () => {
    const dsn = await use_sqlite_read_table();
    const query = await buildReadTableQuery(req({dsn}), {table: "t", orderBy: [], filter: null, limit: 2, offset: 0});
    expect(query).toBe("SELECT * FROM `t` ORDER BY `b` ASC, `a` ASC LIMIT 2 OFFSET 0");
    const res = await sendSQL(req({dsn, query}));
    expect(res.rows.map(r => r[2])).toEqual(["0x", "1x"]); // (b, a) key order
  });

  test("appends pk as tiebreaker after user sort", async () => {
    const dsn = await use_sqlite_read_table();
    const query = await buildReadTableQuery(req({dsn}), {table: "t", orderBy: [{column: "a", direction: "desc"}], filter: null, limit: 2, offset: 0});
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

  test("foreign keys carry referenced table, columns, and actions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sqlite-describe-fk"));
    const dsn = join(dir, "apiary-sql-describe-fk.db");
    await sendSQL(req({dsn, query: "CREATE TABLE users (id INTEGER PRIMARY KEY)"}));
    await sendSQL(req({dsn, query: "CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users (id) ON DELETE CASCADE ON UPDATE SET NULL)"}));
    const schema = await describeTable({dsn, database: "sqlite"}, "posts");
    expect(schema.foreign_keys).toEqual([
      {name: "", column: "user_id", schema: "", table: "users", to: "id", onUpdate: "SET NULL", onDelete: "CASCADE"},
    ]);
  });
});
