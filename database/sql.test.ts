import {describe, test, expect, beforeAll} from "bun:test";
import {Database, type SQLRequest} from "../types/models.ts";
import {sendSQL} from "./sql.ts";
import {listTablesSQLSource, describeTableSQLSource, countRowsSQLSource, testSQLSource} from "./sql_source.ts";

const pgDSN = process.env.PG_DSN ?? "postgres://postgres:password@localhost:5432/postgres";

function pgRequest(query: string): SQLRequest {
  return {dsn: pgDSN, database: Database.POSTGRES, query};
}

describe("sendSQL (postgres)", () => {
  test("SELECT 1 returns one row", async () => {
    const result = await sendSQL(pgRequest("SELECT 1 AS num"));
    expect(result.columns).toEqual(["num"]);
    expect(result.rows).toHaveLength(1);
  });

  test("multiple rows", async () => {
    const result = await sendSQL(pgRequest("SELECT * FROM (VALUES (1,'a'),(2,'b')) AS t(id, name)"));
    expect(result.rows).toHaveLength(2);
    expect(result.columns).toHaveLength(2);
  });

  test("empty result", async () => {
    const result = await sendSQL(pgRequest("SELECT 1 WHERE false"));
    expect(result.rows).toHaveLength(0);
  });
});

describe("SQLSource (postgres)", () => {
  let tableName = "";

  beforeAll(async () => {
    // Create a temp table for testing
    await sendSQL(pgRequest("DROP TABLE IF EXISTS test_sql_source"));
    await sendSQL(pgRequest("CREATE TABLE test_sql_source (id INT, name TEXT)"));
    await sendSQL(pgRequest("INSERT INTO test_sql_source VALUES (1, 'a'), (2, 'b')"));
    tableName = "test_sql_source";
  });

  test("lists tables", async () => {
    const tables = await listTablesSQLSource(pgRequest(""));
    expect(tables.some(t => t.name === "test_sql_source")).toBe(true);
  });

  test("counts rows", async () => {
    const count = await countRowsSQLSource(pgRequest(""), tableName);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("describes table", async () => {
    const schema = await describeTableSQLSource(pgRequest(""), tableName);
    expect(schema.columns.length).toBeGreaterThan(0);
    expect(schema.columns.some(c => c.name === "id")).toBe(true);
    expect(schema.columns.some(c => c.name === "name")).toBe(true);
  });

  test("pings with SELECT 1", async () => {
    await testSQLSource(pgRequest(""));
  });
});
