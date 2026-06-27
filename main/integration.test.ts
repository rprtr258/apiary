import {describe, test, expect, beforeAll} from "bun:test";
import {type SQLRequest, type RedisRequest} from "@/types.ts";
import {sendSQL} from "./database/sql.ts";
import {listTables, describeTable, countRowsSQLSource, testSQLSource} from "./database/sql_source.ts";
import {sendRedis} from "./database/redis.ts";
import {grpcMethods} from "./database/grpc.ts";


const pgDSN = process.env.PG_DSN ?? "postgres://postgres:password@localhost:5432/postgres";

function pgRequest(query?: string): SQLRequest {
  return {dsn: pgDSN, database: "postgres", query: query ?? ""};
}

describe("sendSQL (postgres)", () => {
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
      types: ["23"],
      rows: [[1]],
    });
  });
});

describe("SQLSource (postgres)", () => {
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
        type: "integer",
        nullable: true,
        defaultValue: `""`,
      },
      {
        name: "name",
        type: "text",
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

describe("sendRedis", () => {
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

describe("grpc", () => {
  test("list methods", async () => {
    const methods = await grpcMethods("localhost:50051");
    expect(methods).toEqual({"SayHello": ["helloworld.Greeter"]});
  });
});
