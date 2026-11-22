import {describe, test, expect, beforeAll, afterAll} from "bun:test";
import {SQLRequest, ColumnType} from "@/types.ts";
import * as sql from "../database/sql.ts";
import * as sql_source from "../database/sql_source.ts";

const IS_INTEGRATION = Boolean(process.env["INTEGRATION"]);
const pgDSN = process.env["PG_DSN"] ?? "postgres://postgres:password@localhost:5432/postgres";

function pgRequest(query?: string): SQLRequest {
  return {dsn: pgDSN, database: "postgres", query: query ?? ""};
}

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

// Table names may carry quotes and dots: H1 sizes them via format('%I.%I'),
// quoteIdent double embedded quotes for the sql_source count/filter/update paths.
describe.if(IS_INTEGRATION)("sql crafted table names (postgres)", () => {
  const tableName = `pg'test.tbl`;
  const quotedTable = `pg'q"t`;
  const quotedColumn = `c"1`;

  beforeAll(async () => {
    await sql.send(pgRequest(`DROP TABLE IF EXISTS "${tableName}"`));
    await sql.send(pgRequest(`CREATE TABLE "${tableName}" (id INT)`));
    await sql.send(pgRequest(`INSERT INTO "${tableName}" VALUES (1)`));
    // DDL quotes the raw names by hand (doubled "); the driver receives the
    // raw forms via the count/describe/update calls below.
    await sql.send(pgRequest(`DROP TABLE IF EXISTS "pg'q""t"`));
    await sql.send(pgRequest(`CREATE TABLE "pg'q""t" (id INT PRIMARY KEY, "c""1" TEXT)`));
    await sql.send(pgRequest(`INSERT INTO "pg'q""t" VALUES (1, 'x')`));
  });
  afterAll(async () => {
    await sql.send(pgRequest(`DROP TABLE IF EXISTS "${tableName}"`));
    await sql.send(pgRequest(`DROP TABLE IF EXISTS "pg'q""t"`));
  });

  test("lists and sizes such tables", async () => {
    const tables = await sql.listTables(pgRequest());
    const found = tables.find(t => t.name === tableName);
    expect(found).toMatchObject({name: tableName, rowCount: 1});
    expect(found?.sizeBytes).toBeGreaterThanOrEqual(0);
  });

  test("describes such tables", async () => {
    const schema = await sql.describeTable(pgRequest(), tableName);
    expect(schema.columns.map(c => c.name)).toEqual(["id"]);
  });

  test("counts and updates through quoteIdent", async () => {
    const count = await sql_source.countRowsSQLSource(pgRequest(), quotedTable, {kind: "simple", column: quotedColumn, op: "=", value: "x"});
    expect(count).toBe(1);
    await sql_source.updateTableRows({dsn: pgDSN, database: "postgres", readOnly: false}, quotedTable, ["id"],
      [{pkValues: [1], column: quotedColumn, value: "O'Brien"}]);
    expect(await pgValues(`SELECT * FROM "pg'q""t"`)).toEqual([[1, "O'Brien"]]);
  });
});

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
