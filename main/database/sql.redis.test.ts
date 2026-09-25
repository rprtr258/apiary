import {describe, test, expect, mock} from "bun:test";
import {SQLSourceRequest, ColumnType} from "@/types.ts";
import {send, sendBatch} from "./sql.redis.ts";
import {listTables, describeTable, countRowsSQLSource, testSQLSource} from "./sql_source.ts";

// Fake wasm engine behind querySqlOverRedis; replies keyed by query shape.
const counts: Record<string, number> = {rstring: 2, rhash: 5};
const columns: Record<string, [string, string, boolean, string][]> = {
  rstring: [["key", "text", false, ""], ["value", "blob", false, ""]],
  rhash: [["key", "text", false, ""], ["field", "text", false, ""], ["value", "text", true, ""]],
};

const queryCalls: string[] = [];
mock.module("../redissql.ts", () => ({
  querySqlOverRedis: async (_dsn: string, query: string) => {
    queryCalls.push(query);
    const q = query.replace(/\s+/g, " ");
    if (q.startsWith("SELECT table_name FROM information_schema.TABLES")) {
      return {columns: ["TABLE_NAME"], typenames: ["text"], rows: Object.keys(counts).map(t => [t])};
    }
    if (q.startsWith("SELECT COUNT(*)")) {
      const table = /FROM `([^`]+)`/.exec(query)?.[1] ?? "";
      return {columns: ["COUNT(*)"], typenames: ["bigint"], rows: [[counts[table] ?? 0]]};
    }
    if (q.startsWith("SELECT column_name")) {
      const table = /table_name = '([^']+)'/.exec(query)?.[1] ?? "";
      return {
        columns: ["COLUMN_NAME", "COLUMN_TYPE", "IS_NULLABLE = 'YES'", "COLUMN_DEFAULT"],
        typenames: ["text", "text", "boolean", "text"],
        rows: (columns[table] ?? []).map(([n, t, nullable, d]) => [n, t, nullable, d === "" ? null : d]),
      };
    }
    if (query === "SELECT 1") {
      return {columns: ["1"], typenames: ["int"], rows: [[1]]};
    }
    return {columns: ["a", "b", "c", "d", "e", "f", "g"], typenames: ["text", "bigint", "datetime", "boolean", "json", "double", "enum('x')"], rows: []};
  },
}));

describe("sql.redis send", () => {
  test("rejects write statements in read-only mode", async () => {
    for (const query of ["UPDATE rstring SET value = 'x'", "  DELETE FROM rstring", "-- comment\nINSERT INTO rstring VALUES (1)", "/* c */ DROP TABLE rstring", "SET @a = 1", "TRUNCATE TABLE rstring"]) {
      expect(send({dsn: "localhost:6379", database: "redis", query, readOnly: true})).rejects.toThrow("read-only");
    }
  });

  test("allows reads in read-only mode", async () => {
    for (const query of ["SELECT * FROM rstring", "SHOW TABLES", "DESCRIBE rstring", "EXPLAIN SELECT 1", "/* c */ SELECT 1"]) {
      expect(send({dsn: "localhost:6379", database: "redis", query, readOnly: true})).resolves.toBeDefined();
    }
  });

  test("allows writes when not read-only", async () => {
    expect(send({dsn: "localhost:6379", database: "redis", query: "UPDATE rstring SET value = 'x'"})).resolves.toBeDefined();
  });

  test("maps engine typenames to column types", async () => {
    const res = await send({dsn: "localhost:6379", database: "redis", query: "SELECT * FROM everything"});
    expect(res.types).toEqual([
      ColumnType.STRING, // text
      ColumnType.NUMBER, // bigint
      ColumnType.TIME, // datetime
      ColumnType.BOOLEAN, // boolean
      ColumnType.JSON, // json
      ColumnType.NUMBER, // double
      ColumnType.STRING, // enum
    ]);
  });
});

describe("sql.redis sendBatch", () => {
  test("runs statements sequentially", async () => {
    queryCalls.length = 0;
    const res = await sendBatch({dsn: "localhost:6379", database: "redis"}, ["SELECT 1", "SELECT 2"]);
    expect(res.rows).toEqual([]);
    expect(queryCalls).toEqual(["SELECT 1", "SELECT 2"]);
  });

  test("rejects writes when read-only", async () => {
    expect(sendBatch({dsn: "localhost:6379", database: "redis", readOnly: true}, ["UPDATE rstring SET value = 'x'"])).rejects.toThrow("read-only");
  });
});

describe("sql_source redis", () => {
  const source: SQLSourceRequest = {database: "redis", dsn: "localhost:6379", readOnly: true};

  test("lists tables with per-table counts", async () => {
    const tables = await listTables(source);
    expect(tables).toEqual([
      {name: "rhash", rowCount: 5, sizeBytes: 0},
      {name: "rstring", rowCount: 2, sizeBytes: 0},
    ]);
  });

  test("describes table columns from information_schema", async () => {
    const schema = await describeTable(source, "rhash");
    expect(schema.columns).toEqual([
      {name: "key", typename: "text", type: ColumnType.STRING, nullable: false, defaultValue: "\"\""},
      {name: "field", typename: "text", type: ColumnType.STRING, nullable: false, defaultValue: "\"\""},
      {name: "value", typename: "text", type: ColumnType.STRING, nullable: true, defaultValue: "\"\""},
    ]);
    // no constraints: table editing stays unreachable for read-only tables
    expect(schema.constraints).toEqual([]);
    expect(schema.foreign_keys).toEqual([]);
    expect(schema.indexes).toEqual([]);
  });

  test("counts rows with backtick quoting", async () => {
    queryCalls.length = 0;
    const n = await countRowsSQLSource(source, "rstring");
    expect(n).toEqual(2);
    expect(queryCalls[0]).toContain("FROM `rstring`");
  });

  test("connection test passes", async () => {
    expect(testSQLSource(source)).resolves.toBeUndefined();
  });
});
