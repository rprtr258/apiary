import {describe, test, expect, beforeAll} from "bun:test";
import {SQLRequest, RedisRequest, ColumnType} from "@/types.ts";
import {sendSQL} from "./database/sql.ts";
import {listTables, describeTable, countRowsSQLSource, testSQLSource, buildTableUpdateStatements, updateTableRows} from "./database/sql_source.ts";
import {sendRedis} from "./database/redis.ts";
import {grpcMethods} from "./database/grpc.ts";

const IS_INTEGRATION = Boolean(process.env.INTEGRATION);
const pgDSN = process.env.PG_DSN ?? "postgres://postgres:password@localhost:5432/postgres";

function pgRequest(query?: string): SQLRequest {
  return {dsn: pgDSN, database: "postgres", query: query ?? ""};
}

describe.if(IS_INTEGRATION)("sendSQL (postgres)", () => {
  test("multiple rows", async () => {
    const result = await sendSQL(pgRequest("SELECT * FROM (VALUES (1,'a'),(2,'b')) AS t(id, name)"));
    expect(result.rows).toHaveLength(2);
    expect(result.columns).toHaveLength(2);
  });

  test("empty result", async () => {
    const result = await sendSQL(pgRequest("SELECT 1 WHERE false"));
    expect(result.rows).toHaveLength(0);
  });

  test("SELECT 1 returns one row", async () => {
    const result = await sendSQL(pgRequest("SELECT 1 AS num"));
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
    // Create a temp table for testing
    await sendSQL(pgRequest(`DROP TABLE IF EXISTS ${tableName}`));
    await sendSQL(pgRequest(`CREATE TABLE ${tableName} (id INT, name TEXT)`));
    await sendSQL(pgRequest(`INSERT INTO ${tableName} VALUES (1, 'a'), (2, 'b')`));
  });

  test("lists tables", async () => {
    const tables = await listTables(pgRequest());
    expect(tables.some(t => t.name === tableName)).toBe(true);
    expect(tables).toEqual([
      {name: "departments", rowCount: 3, sizeBytes: 49152},
      {name: "employees", rowCount: 4, sizeBytes: 32768},
      {name: "test_sql_source", rowCount: 2, sizeBytes: 16384},
    ]);
  });

  test("counts rows", async () => {
    const count = await countRowsSQLSource(pgRequest(), tableName);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("describes table", async () => {
    const schema = await describeTable(pgRequest(), tableName);
    expect(schema.columns).toEqual([
      {
        name: "id",
        typename: "int4",
        type: "integer" as ColumnType,
        nullable: true,
        defaultValue: `""`,
      },
      {
        name: "name",
        typename: "text",
        type: "text" as ColumnType,
        nullable: true,
        defaultValue: `""`,
      },
    ]);
  });

  test("pings with SELECT 1", async () => {
    await testSQLSource(pgRequest());
  });
});

const redisDSN = process.env.REDIS_DSN ?? "redis://localhost:6379";

function req(query: string): RedisRequest {
  return {dsn: redisDSN, query};
}

describe.if(IS_INTEGRATION)("sendRedis", () => {
  test("PING returns PONG", async () => {
    const result = await sendRedis(req("PING"));
    expect(result.response).toContain("PONG");
  });

  test("SET and GET a key", async () => {
    await sendRedis(req("SET test:key hello"));
    const result = await sendRedis(req("GET test:key"));
    expect(result.response).toContain("hello");
  });

  test("KEYS returns array", async () => {
    const result = await sendRedis(req("KEYS *"));
    expect(typeof result.response).toBe("string");
  });
});

describe.if(IS_INTEGRATION)("grpc", () => {
  test("list methods", async () => {
    const methods = await grpcMethods("localhost:50051");
    expect(methods).toEqual({"helloworld.Greeter": ["SayHello"]});
  });
});

async function pgValues(query: string): Promise<unknown[][]> {
  const result = await sendSQL(pgRequest(query));
  return result.rows;
}

describe.if(IS_INTEGRATION)("table row updates (postgres)", () => {
  const tableName = "test_table_edit";
  const compTableName = "test_table_edit_comp";

  beforeAll(async () => {
    await sendSQL(pgRequest(`DROP TABLE IF EXISTS ${tableName}`));
    await sendSQL(pgRequest(`CREATE TABLE ${tableName} (id INT PRIMARY KEY, name TEXT, score INT NOT NULL)`));
    await sendSQL(pgRequest(`INSERT INTO ${tableName} VALUES (1, 'a', 10), (2, 'b', 20), (3, 'c', 30)`));
    await sendSQL(pgRequest(`DROP TABLE IF EXISTS ${compTableName}`));
    await sendSQL(pgRequest(`CREATE TABLE ${compTableName} (a INT, b INT, val TEXT, PRIMARY KEY (a, b))`));
    await sendSQL(pgRequest(`INSERT INTO ${compTableName} VALUES (1, 1, 'x'), (1, 2, 'y')`));
  });

  test("builds one UPDATE per row", () => {
    const statements = buildTableUpdateStatements(
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
    const statements = buildTableUpdateStatements(
      {dsn: pgDSN, database: "postgres"},
      tableName,
      ["id"],
      [{pkValues: [null], column: "name", value: "x"}],
    );
    expect(statements).toEqual([`UPDATE "${tableName}" SET "name" = 'x' WHERE "id" IS NULL`]);
  });

  test("single cell update", async () => {
    await updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
      [{pkValues: [1], column: "name", value: "updated"}]);
    expect(await pgValues(`SELECT name FROM ${tableName} WHERE id = 1`)).toEqual([["updated"]]);
  });

  test("multi-row multi-column update in one batch", async () => {
    await updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
      [
        {pkValues: [2], column: "name", value: "b2"},
        {pkValues: [2], column: "score", value: 21},
        {pkValues: [3], column: "score", value: 31},
      ]);
    expect(await pgValues(`SELECT name, score FROM ${tableName} WHERE id IN (2, 3) ORDER BY id`)).toEqual([["b2", 21], ["c", 31]]);
  });

  test("composite primary key", async () => {
    await updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, compTableName, ["a", "b"],
      [{pkValues: [1, 2], column: "val", value: "y2"}]);
    expect(await pgValues(`SELECT val FROM ${compTableName} WHERE a = 1 AND b = 2`)).toEqual([["y2"]]);
  });

  test("string escaping and NULL", async () => {
    await updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
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
      await updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
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
      await updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tableName, ["id"],
        [{pkValues: [999], column: "name", value: "ghost"}]);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  test("timestamptz pk round-trips with microseconds", async () => {
    const tsTable = `${tableName}_ts`;
    await sendSQL(pgRequest(`DROP TABLE IF EXISTS ${tsTable}`));
    await sendSQL(pgRequest(`CREATE TABLE ${tsTable} (ts TIMESTAMPTZ PRIMARY KEY, v TEXT)`));
    await sendSQL(pgRequest(`INSERT INTO ${tsTable} VALUES ('2024-01-01T00:00:00.123456+00', 'x')`));
    const read = await sendSQL(pgRequest(`SELECT ts FROM ${tsTable}`));
    expect(String(read.rows[0][0])).toContain(".123456"); // raw server text, not a ms-truncated Date
    await updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, tsTable, ["ts"],
      [{pkValues: [read.rows[0][0] as string], column: "v", value: "y"}]);
    expect(await pgValues(`SELECT v FROM ${tsTable}`)).toEqual([["y"]]);
  });

  test("date pk round-trips without timezone shift", async () => {
    const dTable = `${tableName}_date`;
    await sendSQL(pgRequest(`DROP TABLE IF EXISTS ${dTable}`));
    await sendSQL(pgRequest(`CREATE TABLE ${dTable} (d DATE PRIMARY KEY, v TEXT)`));
    await sendSQL(pgRequest(`INSERT INTO ${dTable} VALUES ('2024-01-01', 'x')`));
    const read = await sendSQL(pgRequest(`SELECT d FROM ${dTable}`));
    expect(read.rows[0][0]).toBe("2024-01-01");
    await updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, dTable, ["d"],
      [{pkValues: [read.rows[0][0] as string], column: "v", value: "y"}]);
    expect(await pgValues(`SELECT v FROM ${dTable}`)).toEqual([["y"]]);
  });
});

