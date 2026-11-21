import {describe, test, expect, beforeAll, afterAll} from "bun:test";
import {existsSync} from "node:fs";
import path from "node:path";
import {SQLRequest, RedisRequest, ColumnType, SQLPlanNode} from "@/types.ts";
import * as sql from "./database/sql.ts";
import * as sql_source from "./database/sql_source.ts";
import * as redis from "./database/redis.ts";
import * as grpc from "./database/grpc.ts";

const IS_INTEGRATION = Boolean(process.env["INTEGRATION"]);
const pgDSN = process.env["PG_DSN"] ?? "postgres://postgres:password@localhost:5432/postgres";

function pgRequest(query?: string): SQLRequest {
  return {dsn: pgDSN, database: "postgres", query: query ?? ""};
}

describe.if(IS_INTEGRATION)("sql.send (postgres)", () => {
  test("multiple rows", async () => {
    const result = await sql.send(pgRequest("SELECT * FROM (VALUES (1,'a'),(2,'b')) AS t(id, name)"));
    expect(result.rows).toHaveLength(2);
    expect(result.columns).toHaveLength(2);
  });

  test("empty result", async () => {
    const result = await sql.send(pgRequest("SELECT 1 WHERE false"));
    expect(result.rows).toHaveLength(0);
  });

  test("SELECT 1 returns one row", async () => {
    const result = await sql.send(pgRequest("SELECT 1 AS num"));
    expect(result).toEqual({
      columns: ["num"],
      typenames: ["int4"],
      types: [ColumnType.NUMBER],
      rows: [[1]],
    });
  });
});

describe.if(IS_INTEGRATION)("SQLSource (postgres)", () => {
  const tableName = "test_sql_source";

  beforeAll(async () => {
    await sql.send(pgRequest(`DROP TABLE IF EXISTS ${tableName}`));
    await sql.send(pgRequest(`CREATE TABLE ${tableName} (id INT, name TEXT)`));
    await sql.send(pgRequest(`INSERT INTO ${tableName} VALUES (1, 'a'), (2, 'b')`));
  });

  test("lists tables", async () => {
    const tables = await sql.listTables(pgRequest());
    expect(tables.some(t => t.name === tableName)).toBe(true);
    expect(tables).toEqual([
      {name: "departments", rowCount: 3, sizeBytes: 49152},
      {name: "employees", rowCount: 4, sizeBytes: 32768},
      {name: "test_sql_source", rowCount: 2, sizeBytes: 16384},
    ]);
  });

  test("counts rows", async () => {
    const count = await sql_source.countRowsSQLSource(pgRequest(), tableName, null);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("describes table", async () => {
    const schema = await sql.describeTable(pgRequest(), tableName);
    expect(schema.columns).toEqual([
      {
        name: "id",
        typename: "int4",
        type: ColumnType.NUMBER,
        nullable: true,
        defaultValue: `""`,
      },
      {
        name: "name",
        typename: "text",
        type: ColumnType.STRING,
        nullable: true,
        defaultValue: `""`,
      },
    ]);
  });

  test("pings with SELECT 1", async () => {
    await sql_source.testSQLSource(pgRequest());
  });
});

const chDSN = process.env["CH_DSN"] ?? "http://default:alpha@localhost:8123";

function chRequest(query?: string): SQLRequest {
  return {dsn: chDSN, database: "clickhouse", query: query ?? ""};
}

function chNodeTitles(node: SQLPlanNode): string[] {
  return [node.title, ...node.children.flatMap(chNodeTitles)];
}

describe.if(IS_INTEGRATION)("sql.send (clickhouse)", () => {
  test("multiple rows", async () => {
    const result = await sql.send(chRequest("SELECT * FROM (SELECT 1 AS id, 'a' AS name UNION ALL SELECT 2, 'b')"));
    expect(result.rows).toHaveLength(2);
    expect(result.columns).toHaveLength(2);
  });

  test("empty result", async () => {
    const result = await sql.send(chRequest("SELECT 1 WHERE 0"));
    expect(result).toEqual({columns: ["1"], typenames: ["UInt8"], types: [ColumnType.NUMBER], rows: []});
  });

  test("SELECT 1 returns one row", async () => {
    const result = await sql.send(chRequest("SELECT 1 AS num"));
    expect(result).toEqual({
      columns: ["num"],
      typenames: ["UInt8"],
      types: [ColumnType.NUMBER],
      rows: [[1]],
    });
  });
});

describe.if(IS_INTEGRATION)("SQLSource (clickhouse)", () => {
  const tableName = "test_sql_source";

  beforeAll(async () => {
    await sql.send(chRequest(`DROP TABLE IF EXISTS ${tableName}`));
    // Memory rejects data-skipping indexes, so exercising describeTable's index
    // path needs a MergeTree fixture.
    await sql.send(chRequest(`CREATE TABLE ${tableName} (id UInt8, name String, n Nullable(UInt8), v UInt8 DEFAULT 7, INDEX idx_v v TYPE minmax GRANULARITY 2, INDEX idx_name name TYPE bloom_filter(0.01) GRANULARITY 1) ENGINE = MergeTree ORDER BY (id, name)`));
    await sql.send(chRequest(`INSERT INTO ${tableName} VALUES (1, 'a', NULL, 100), (2, 'b', NULL, 200)`));
  });

  test("lists tables", async () => {
    const tables = await sql.listTables(chRequest());
    expect(tables.some(t => t.name === tableName)).toBe(true);
    expect(tables.find(t => t.name === tableName)).toMatchObject({name: tableName, rowCount: 2});
  });

  test("counts rows", async () => {
    const count = await sql_source.countRowsSQLSource(chRequest(), tableName, null);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("describes table", async () => {
    const schema = await sql.describeTable(chRequest(), tableName);
    schema.indexes.sort((a, b) => a.name.localeCompare(b.name));
    expect(schema).toEqual({
      columns: [
        {name: "id", typename: "UInt8", type: ColumnType.NUMBER, nullable: false, defaultValue: ""},
        {name: "name", typename: "String", type: ColumnType.STRING, nullable: false, defaultValue: ""},
        {name: "n", typename: "Nullable(UInt8)", type: ColumnType.NUMBER, nullable: true, defaultValue: ""},
        {name: "v", typename: "UInt8", type: ColumnType.NUMBER, nullable: false, defaultValue: `"7"`},
      ],
      constraints: [
        {name: "PRIMARY KEY", type: "PRIMARY KEY", definition: "PRIMARY KEY (id, name)", columns: ["id", "name"]},
      ],
      // Definitions build from the bare type column, not type_full, so
      // bloom_filter(0.01) loses its parameter.
      indexes: [
        {name: "idx_name", definition: "INDEX idx_name name TYPE bloom_filter GRANULARITY 1"},
        {name: "idx_v", definition: "INDEX idx_v v TYPE minmax GRANULARITY 2"},
      ],
      foreign_keys: [],
    });
  });

  test("pings with SELECT 1", async () => {
    await sql_source.testSQLSource(chRequest());
  });
});

describe.if(IS_INTEGRATION)("sql.explain (clickhouse)", () => {
  test("parses the plan of a real query", async () => {
    const {raw, plan} = await sql.explain(chRequest("SELECT number FROM system.numbers LIMIT 5"));
    expect(raw).toContain("Limit");
    expect(plan).toBeDefined();
    const titles = plan === undefined ? [] : chNodeTitles(plan.root);
    expect(titles.some(title => /^Limit/.test(title))).toBe(true);
    expect(titles.some(title => /^Read/.test(title))).toBe(true);
  });
});

const mysqlDSN = process.env["MYSQL_DSN"] ?? "mysql://root:my-secret-pw@localhost:3306/mysql";

function mysqlRequest(query?: string): SQLRequest {
  return {dsn: mysqlDSN, database: "mysql", query: query ?? ""};
}

async function mysqlValues(query: string): Promise<unknown[][]> {
  const result = await sql.send(mysqlRequest(query));
  return result.rows;
}

// Must be called at describe top level (during collection), like beforeAll itself — never inside a test.
function useMysqlTable(
  name: string,
  definition: string,
  ...seed: string[]
) {
  beforeAll(async () => {
    await sql.send(mysqlRequest(`DROP TABLE IF EXISTS ${name}`));
    await sql.send(mysqlRequest(`CREATE TABLE ${name} ${definition}`));
    await sql.send(mysqlRequest(`INSERT INTO ${name} VALUES ${seed.join(",")}`));
  });
  afterAll(async () => {
    await sql.send(mysqlRequest(`DROP TABLE IF EXISTS ${name}`));
  });
}

describe.if(IS_INTEGRATION)("sql.send (mysql)", () => {
  test("SELECT 1 returns one row", async () => {
    const result = await sql.send(mysqlRequest("SELECT 1 AS num"));
    expect(result).toEqual({
      columns: ["num"],
      typenames: ["bigint"],
      types: [ColumnType.NUMBER],
      rows: [[1]],
    });
  });

  test("multiple rows", async () => {
    const result = await sql.send(mysqlRequest("SELECT * FROM (SELECT 1 AS id, 'a' AS name UNION ALL SELECT 2, 'b') AS t"));
    expect(result.rows).toHaveLength(2);
    expect(result.columns).toHaveLength(2);
  });

  test("empty result", async () => {
    const result = await sql.send(mysqlRequest("SELECT 1 FROM dual WHERE 1 = 0"));
    expect(result.rows).toHaveLength(0);
  });

  // mysql2 resolves writes/DDL to a stats packet instead of a result set
  test("writes and DDL return an empty result", async () => {
    await sql.send(mysqlRequest("CREATE TABLE test_send_writes (id INT PRIMARY KEY)"));
    try {
      const insert = await sql.send(mysqlRequest("INSERT INTO test_send_writes VALUES (1), (2)"));
      expect(insert).toEqual({columns: [], typenames: [], types: [], rows: []});
      const update = await sql.send(mysqlRequest("UPDATE test_send_writes SET id = id"));
      expect(update.rows).toEqual([]);
    } finally {
      await sql.send(mysqlRequest("DROP TABLE test_send_writes"));
    }
  });

  test("datetime comes back as a string and null survives", async () => {
    const result = await sql.send(mysqlRequest("SELECT CAST('2024-01-01 12:34:56' AS DATETIME) AS ts, CAST(NULL AS CHAR) AS n"));
    expect(result.rows).toEqual([["2024-01-01 12:34:56", null]]);
  });
});

describe.if(IS_INTEGRATION)("SQLSource (mysql)", () => {
  const tableName = "test_sql_source_mysql";

  beforeAll(async () => {
    await sql.send(mysqlRequest(`DROP TABLE IF EXISTS ${tableName}`));
    await sql.send(mysqlRequest(`CREATE TABLE ${tableName} (id INT PRIMARY KEY, name VARCHAR(50) NOT NULL DEFAULT 'anon', score INT NULL)`));
    await sql.send(mysqlRequest(`INSERT INTO ${tableName} VALUES (1, 'a', 10), (2, 'b', NULL)`));
  });

  afterAll(async () => {
    await sql.send(mysqlRequest(`DROP TABLE IF EXISTS ${tableName}`));
  });

  test("lists tables", async () => {
    const tables = await sql.listTables(mysqlRequest());
    const self = tables.find(t => t.name === tableName);
    expect(self?.name).toBe(tableName);
    // table_rows is an InnoDB estimate; only presence and shape are stable
    expect(self?.rowCount).toBeGreaterThanOrEqual(0);
    expect(self?.sizeBytes).toBeGreaterThanOrEqual(0);
  });

  test("counts rows", async () => {
    const count = await sql_source.countRowsSQLSource(mysqlRequest(), tableName, null);
    expect(count).toBe(2);
  });

  test("describes table", async () => {
    const schema = await sql.describeTable(mysqlRequest(), tableName);
    expect(schema.columns).toEqual([
      {name: "id", typename: "int", type: ColumnType.NUMBER, nullable: false, defaultValue: `""`},
      {name: "name", typename: "varchar", type: ColumnType.STRING, nullable: false, defaultValue: `"anon"`},
      {name: "score", typename: "int", type: ColumnType.NUMBER, nullable: true, defaultValue: `""`},
    ]);
    expect(schema.constraints).toEqual([
      {name: "PRIMARY KEY", type: "PRIMARY KEY", definition: "PRIMARY KEY", columns: ["id"]},
    ]);
    expect(schema.foreign_keys).toEqual([]);
  });

  test("pings with SELECT 1", async () => {
    await sql_source.testSQLSource(mysqlRequest());
  });
});

describe.if(IS_INTEGRATION)("sql.explain (mysql)", () => {
  const tableName = "test_sql_explain_mysql";
  useMysqlTable(
    tableName,
    "(id INT PRIMARY KEY, name VARCHAR(50), KEY name_idx (name))",
    "(1, 'a')",
    "(2, 'b')",
    "(3, 'c')",
  );

  test("parses the plan of a real query", async () => {
    const {raw, plan} = await sql.explain(mysqlRequest(`SELECT id FROM ${tableName} WHERE name = 'a'`));
    expect(raw).toContain("name_idx");
    expect(plan?.root.kind).toBe("index");
    expect(plan?.root.table).toBe(tableName);
    expect(plan?.root.index).toBe("name_idx");
  });

  test("single-node plans parse too", async () => {
    const {plan} = await sql.explain(mysqlRequest("SELECT 1"));
    expect(plan?.root.title).toBe("Rows fetched before execution");
    expect(plan?.root.kind).toBe("other");
  });
});

const redisDSN = process.env["REDIS_DSN"] ?? "redis://localhost:6379";

// redissql wasm artifact (built by bun run build:wasm); sql-over-redis tests
// skip when missing, mirroring main/redissql.test.ts
const wasmPath = path.resolve(import.meta.dirname, "..", "dist-electron", "redissql.wasm");
const wasmExecPath = path.resolve(import.meta.dirname, "..", "dist-electron", "redissql-wasm-exec.js");

function req(query: string): RedisRequest {
  return {dsn: redisDSN, query};
}

describe.if(IS_INTEGRATION)("redis.send", () => {
  test("PING returns PONG", async () => {
    const result = await redis.send(req("PING"));
    expect(result.response).toContain("PONG");
  });

  test("SET and GET a key", async () => {
    await redis.send(req("SET test:key hello"));
    const result = await redis.send(req("GET test:key"));
    expect(result.response).toContain("hello");
  });

  test("KEYS returns array", async () => {
    const result = await redis.send(req("KEYS *"));
    expect(typeof result.response).toBe("string");
  });

  afterAll(async () => {
    await redis.send(req("DEL test:quotes"));
  });

  // Command splitting (redis-cli-style quoting) verified by round-tripping a
  // value through the real server: SET parses the query, GET reads back what
  // was stored. result.response is JSON.stringify(reply), so JSON.parse
  // restores the exact stored value.
  test("strips double quotes around a value", async () => {
    await redis.send(req("SET test:quotes \"héllo\""));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("héllo");
  });

  test("keeps whitespace inside quoted multi-word value", async () => {
    await redis.send(req("SET test:quotes \"barabem barabum\""));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("barabem barabum");
  });

  test("takes single-quoted values literally", async () => {
    await redis.send(req("SET test:quotes 'a b\\nc'"));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("a b\\nc");
  });

  test("processes double-quote escapes", async () => {
    await redis.send(req("SET test:quotes \"a\\nb\\t\\rc:\\\\path \\\"q\\\" \\\\ \\x41\""));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("a\nb\t\rc:\\path \"q\" \\ A");
  });

  test("concatenates adjacent quoted and bare segments", async () => {
    await redis.send(req("SET test:quotes foo\"bar baz\"'!'"));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("foobar baz!");
  });

  test("keeps empty quoted argument", async () => {
    await redis.send(req("SET test:quotes \"\""));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("");
  });

  test("rejects unbalanced quotes", async () => {
    await expect(redis.send(req("SET test:quotes \"unterminated"))).rejects.toThrow("unbalanced");
  });

  test("rejects double-quoted value ending in a bare backslash", async () => {
    await expect(redis.send(req("SET test:quotes \"abc\\\""))).rejects.toThrow("unbalanced");
  });

  test("rejects whitespace-only query", async () => {
    await expect(redis.send(req("   "))).rejects.toThrow("empty query");
  });
});

describe.if(IS_INTEGRATION)("sql.send (redis)", () => {
  function sqlReq(query: string): SQLRequest {
    return {dsn: redisDSN, database: "redis", query, readOnly: true};
  }

  test("zset scores of ±inf round-trip as strings", async () => {
    if (!existsSync(wasmPath) || !existsSync(wasmExecPath)) {
      console.warn("skipping sql-over-redis integration: artifact missing, run bun run build:wasm");
      return;
    }
    await redis.send(req("ZADD test:zinf +inf first -inf second"));
    try {
      const result = await sql.send(sqlReq("SELECT `rank`, score, value FROM rzset WHERE `key` = 'test:zinf' ORDER BY value"));
      // json has no infinity: scores cross the bridge as the redis score strings
      expect(result.rows).toEqual([[1, "+inf", "first"], [0, "-inf", "second"]]);
    } finally {
      await redis.send(req("DEL test:zinf"));
    }
  });
});

describe.if(IS_INTEGRATION)("grpc", () => {
  test("list methods", async () => {
    const methods = await grpc.grpcMethods("localhost:50051");
    expect(methods).toEqual({"helloworld.Greeter": ["SayHello"]});
  });
});

async function pgValues(query: string): Promise<unknown[][]> {
  const result = await sql.send(pgRequest(query));
  return result.rows;
}

// Must be called at describe top level (during collection), like beforeAll itself — never inside a test.
function useTable(
  name: string,
  definition: string,
  ...seed: string[]
) {
  beforeAll(async () => {
    await sql.send(pgRequest(`CREATE TABLE ${name} ${definition}`));
    await sql.send(pgRequest(`INSERT INTO ${name} VALUES ${seed.join(",")}`));
  });
  afterAll(async () => {
    await sql.send(pgRequest(`DROP TABLE IF EXISTS ${name}`));
  });
}

describe.if(IS_INTEGRATION)("table row updates (postgres)", () => {
  const tableName = "test_table_edit";
  const compTableName = "test_table_edit_comp";

  useTable(
    tableName,
    "(id INT PRIMARY KEY, name TEXT, score INT NOT NULL)",
    "(1, 'a', 10)",
    "(2, 'b', 20)",
    "(3, 'c', 30)",
  );
  useTable(
    compTableName,
    "(a INT, b INT, val TEXT, PRIMARY KEY (a, b))",
    "(1, 1, 'x')",
    "(1, 2, 'y')",
  );

  test("builds one UPDATE per row", () => {
    const statements = sql_source.buildTableUpdateStatements(
      {dsn: pgDSN, database: "postgres"},
      tableName,
      ["id"],
      [
        {pkValues: [1], column: "name", value: "x"},
        {pkValues: [1], column: "score", value: 11},
        {pkValues: [2], column: "name", value: "O'Brien"},
        {pkValues: [3], column: "name", value: null},
      ],
    );
    expect(statements).toEqual([
      `UPDATE "${tableName}" SET "name" = 'x', "score" = 11 WHERE "id" = 1`,
      `UPDATE "${tableName}" SET "name" = 'O''Brien' WHERE "id" = 2`,
      `UPDATE "${tableName}" SET "name" = NULL WHERE "id" = 3`,
    ]);
  });

  test("null pk values compare with IS NULL", () => {
    const statements = sql_source.buildTableUpdateStatements(
      {dsn: pgDSN, database: "postgres"},
      tableName,
      ["id"],
      [{pkValues: [null], column: "name", value: "x"}],
    );
    expect(statements).toEqual([`UPDATE "${tableName}" SET "name" = 'x' WHERE "id" IS NULL`]);
  });

  test("single cell update", async () => {
    await sql_source.updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
      [{pkValues: [1], column: "name", value: "updated"}]);
    expect(await pgValues(`SELECT name FROM ${tableName} WHERE id = 1`)).toEqual([["updated"]]);
  });

  test("multi-row multi-column update in one batch", async () => {
    await sql_source.updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
      [
        {pkValues: [2], column: "name", value: "b2"},
        {pkValues: [2], column: "score", value: 21},
        {pkValues: [3], column: "score", value: 31},
      ]);
    expect(await pgValues(`SELECT name, score FROM ${tableName} WHERE id IN (2, 3) ORDER BY id`)).toEqual([["b2", 21], ["c", 31]]);
  });

  test("composite primary key", async () => {
    await sql_source.updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, compTableName, ["a", "b"],
      [{pkValues: [1, 2], column: "val", value: "y2"}]);
    expect(await pgValues(`SELECT val FROM ${compTableName} WHERE a = 1 AND b = 2`)).toEqual([["y2"]]);
  });

  test("string escaping and NULL", async () => {
    await sql_source.updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
      [
        {pkValues: [1], column: "name", value: "O'Brien \"quoted\""},
        {pkValues: [2], column: "name", value: null},
      ]);
    expect(await pgValues(`SELECT name FROM ${tableName} WHERE id = 1`)).toEqual([["O'Brien \"quoted\""]]);
    expect(await pgValues(`SELECT name FROM ${tableName} WHERE id = 2`)).toEqual([[null]]);
  });

  test("failing statement rolls back the whole batch", async () => {
    // score is NOT NULL: this batch must fail and leave row 1 unchanged
    let failed = false;
    try {
      await sql_source.updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
        [
          {pkValues: [1], column: "name", value: "rolled_back"},
          {pkValues: [2], column: "score", value: null},
        ]);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    expect(await pgValues(`SELECT name FROM ${tableName} WHERE id = 1`)).toEqual([["O'Brien \"quoted\""]]);
  });

  test("update matching no rows throws", async () => {
    let failed = false;
    try {
      await sql_source.updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
        [{pkValues: [999], column: "name", value: "ghost"}]);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  describe("timestamptz pk round-trips", () => {
    const tsTable = `${tableName}_ts`;
    useTable(
      tsTable,
      "(ts TIMESTAMPTZ PRIMARY KEY, v TEXT)",
      "('2024-01-01T00:00:00.123456+00', 'x')",
    );

    test("timestamptz pk round-trips with microseconds", async () => {
      const read = await sql.send(pgRequest(`SELECT ts FROM ${tsTable}`));
      expect(String(read.rows[0][0])).toContain(".123456"); // raw server text, not a ms-truncated Date
      await sql_source.updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tsTable,
        ["ts"],
        [{pkValues: [read.rows[0][0] as string], column: "v", value: "y"}],
      );
      expect(await pgValues(`SELECT v FROM ${tsTable}`)).toEqual([["y"]]);
    });
  });

  describe("date pk round-trips", () => {
    const dTable = `${tableName}_date`;
    useTable(
      dTable,
      "(d DATE PRIMARY KEY, v TEXT)",
      "('2024-01-01', 'x')",
    );

    test("date pk round-trips without timezone shift", async () => {
      const read = await sql.send(pgRequest(`SELECT d FROM ${dTable}`));
      expect(read.rows[0][0]).toBe("2024-01-01");
      await sql_source.updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, dTable,
        ["d"],
        [{pkValues: [read.rows[0][0] as string], column: "v", value: "y"}],
      );
      expect(await pgValues(`SELECT v FROM ${dTable}`)).toEqual([["y"]]);
    });
  });
});

// sendBatch is the only surface reporting write counts; single send() calls
// return an empty result for writes on every backend
describe.if(IS_INTEGRATION)("affected rows (postgres)", () => {
  const tableName = "test_affected_rows_pg";
  useTable(tableName, "(id INT, val TEXT)", "(1, 'a')", "(2, 'b')");

  test("insert reports the inserted row count", async () => {
    const result = await sql.sendBatch({dsn: pgDSN, database: "postgres", readOnly: false}, [
      `INSERT INTO ${tableName} VALUES (3, 'c'), (4, 'd')`,
    ]);
    expect(result.affectedRows).toEqual([2]);
  });

  test("update reports the matched row count", async () => {
    const result = await sql.sendBatch({dsn: pgDSN, database: "postgres", readOnly: false}, [
      `UPDATE ${tableName} SET val = 'x' WHERE id >= 3`,
      `UPDATE ${tableName} SET val = 'y' WHERE id = 4`,
    ]);
    expect(result.affectedRows).toEqual([2, 1]);
  });
});

describe.if(IS_INTEGRATION)("affected rows (clickhouse)", () => {
  const tableName = "test_affected_rows_ch";
  // ClickHouse has no UPDATE statement (only ALTER TABLE mutations, whose row
  // counts are not part of the statement response), so only inserts assert
  beforeAll(async () => {
    await sql.send(chRequest(`DROP TABLE IF EXISTS ${tableName}`));
    await sql.send(chRequest(`CREATE TABLE ${tableName} (id UInt32, val String) ENGINE = Memory`));
  });
  afterAll(async () => {
    await sql.send(chRequest(`DROP TABLE IF EXISTS ${tableName}`));
  });

  test("insert reports the inserted row count", async () => {
    const result = await sql.sendBatch({dsn: chDSN, database: "clickhouse", readOnly: false}, [
      `INSERT INTO ${tableName} VALUES (1, 'a'), (2, 'b')`,
    ]);
    expect(result.affectedRows).toEqual([2]);
  });
});

describe.if(IS_INTEGRATION)("affected rows (mysql)", () => {
  const tableName = "test_affected_rows_mysql";
  useMysqlTable(tableName, "(id INT PRIMARY KEY, val TEXT)", "(1, 'a')", "(2, 'b')");

  test("insert reports the inserted row count", async () => {
    const result = await sql.sendBatch({dsn: mysqlDSN, database: "mysql", readOnly: false}, [
      `INSERT INTO ${tableName} VALUES (3, 'c'), (4, 'd')`,
    ]);
    expect(result.affectedRows).toEqual([2]);
  });

  test("update reports the changed row count", async () => {
    const result = await sql.sendBatch({dsn: mysqlDSN, database: "mysql", readOnly: false}, [
      `UPDATE ${tableName} SET val = 'x' WHERE id >= 3`,
      `UPDATE ${tableName} SET val = 'y' WHERE id = 4`,
    ]);
    expect(result.affectedRows).toEqual([2, 1]);
  });
});

describe.if(IS_INTEGRATION)("table row updates (mysql)", () => {
  const tableName = "test_table_edit_mysql";
  const compTableName = "test_table_edit_comp_mysql";

  useMysqlTable(
    tableName,
    "(id INT PRIMARY KEY, name TEXT, score INT NOT NULL)",
    "(1, 'a', 10)",
    "(2, 'b', 20)",
    "(3, 'c', 30)",
  );
  useMysqlTable(
    compTableName,
    "(a INT, b INT, val TEXT, PRIMARY KEY (a, b))",
    "(1, 1, 'x')",
    "(1, 2, 'y')",
  );

  test("builds one UPDATE per row", () => {
    const statements = sql_source.buildTableUpdateStatements(
      {dsn: mysqlDSN, database: "mysql"},
      tableName,
      ["id"],
      [
        {pkValues: [1], column: "name", value: "x"},
        {pkValues: [1], column: "score", value: 11},
        {pkValues: [2], column: "name", value: "O'Brien"},
        {pkValues: [3], column: "name", value: null},
      ],
    );
    expect(statements).toEqual([
      `UPDATE \`${tableName}\` SET \`name\` = 'x', \`score\` = 11 WHERE \`id\` = 1`,
      `UPDATE \`${tableName}\` SET \`name\` = 'O''Brien' WHERE \`id\` = 2`,
      `UPDATE \`${tableName}\` SET \`name\` = NULL WHERE \`id\` = 3`,
    ]);
  });

  test("null pk values compare with IS NULL", () => {
    const statements = sql_source.buildTableUpdateStatements(
      {dsn: mysqlDSN, database: "mysql"},
      tableName,
      ["id"],
      [{pkValues: [null], column: "name", value: "x"}],
    );
    expect(statements).toEqual([`UPDATE \`${tableName}\` SET \`name\` = 'x' WHERE \`id\` IS NULL`]);
  });

  test("single cell update", async () => {
    await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, tableName, ["id"],
      [{pkValues: [1], column: "name", value: "updated"}]);
    expect(await mysqlValues(`SELECT name FROM ${tableName} WHERE id = 1`)).toEqual([["updated"]]);
  });

  test("multi-row multi-column update in one batch", async () => {
    await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, tableName, ["id"],
      [
        {pkValues: [2], column: "name", value: "b2"},
        {pkValues: [2], column: "score", value: 21},
        {pkValues: [3], column: "score", value: 31},
      ]);
    expect(await mysqlValues(`SELECT name, score FROM ${tableName} WHERE id IN (2, 3) ORDER BY id`)).toEqual([["b2", 21], ["c", 31]]);
  });

  test("composite primary key", async () => {
    await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, compTableName, ["a", "b"],
      [{pkValues: [1, 2], column: "val", value: "y2"}]);
    expect(await mysqlValues(`SELECT val FROM ${compTableName} WHERE a = 1 AND b = 2`)).toEqual([["y2"]]);
  });

  test("string escaping and NULL", async () => {
    await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, tableName, ["id"],
      [
        {pkValues: [1], column: "name", value: "O'Brien \"quoted\""},
        {pkValues: [2], column: "name", value: null},
      ]);
    expect(await mysqlValues(`SELECT name FROM ${tableName} WHERE id = 1`)).toEqual([["O'Brien \"quoted\""]]);
    expect(await mysqlValues(`SELECT name FROM ${tableName} WHERE id = 2`)).toEqual([[null]]);
  });

  test("failing statement rolls back the whole batch", async () => {
    // score is NOT NULL: this batch must fail and leave row 1 unchanged
    let failed = false;
    try {
      await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, tableName, ["id"],
        [
          {pkValues: [1], column: "name", value: "rolled_back"},
          {pkValues: [2], column: "score", value: null},
        ]);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    expect(await mysqlValues(`SELECT name FROM ${tableName} WHERE id = 1`)).toEqual([["O'Brien \"quoted\""]]);
  });

  test("update matching no rows throws", async () => {
    let failed = false;
    try {
      await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, tableName, ["id"],
        [{pkValues: [999], column: "name", value: "ghost"}]);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  describe("datetime pk round-trips", () => {
    const tsTable = `${tableName}_ts`;
    useMysqlTable(
      tsTable,
      "(ts DATETIME(6) PRIMARY KEY, v TEXT)",
      "('2024-01-01 00:00:00.123456', 'x')",
    );

    test("datetime pk round-trips with microseconds", async () => {
      const read = await sql.send(mysqlRequest(`SELECT ts FROM ${tsTable}`));
      expect(read.rows[0][0]).toBe("2024-01-01 00:00:00.123456"); // raw server text, not a ms-truncated Date
      await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, tsTable,
        ["ts"],
        [{pkValues: [read.rows[0][0] as string], column: "v", value: "y"}],
      );
      expect(await mysqlValues(`SELECT v FROM ${tsTable}`)).toEqual([["y"]]);
    });
  });

  describe("date pk round-trips", () => {
    const dTable = `${tableName}_date`;
    useMysqlTable(
      dTable,
      "(d DATE PRIMARY KEY, v TEXT)",
      "('2024-01-01', 'x')",
    );

    test("date pk round-trips without timezone shift", async () => {
      const read = await sql.send(mysqlRequest(`SELECT d FROM ${dTable}`));
      expect(read.rows[0][0]).toBe("2024-01-01");
      await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, dTable,
        ["d"],
        [{pkValues: [read.rows[0][0] as string], column: "v", value: "y"}],
      );
      expect(await mysqlValues(`SELECT v FROM ${dTable}`)).toEqual([["y"]]);
    });
  });
});

