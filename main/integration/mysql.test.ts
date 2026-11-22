import {describe, test, expect, beforeAll, afterAll} from "bun:test";
import {SQLRequest, ColumnType} from "@/types.ts";
import * as sql from "../database/sql.ts";
import * as sql_source from "../database/sql_source.ts";

const IS_INTEGRATION = Boolean(process.env["INTEGRATION"]);
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
    // The InnoDB primary key appears in statistics alongside declared indexes.
    expect(schema.indexes).toEqual([
      {name: "PRIMARY", definition: `CREATE UNIQUE INDEX \`PRIMARY\` ON \`${tableName}\` (id) USING BTREE`},
    ]);
  });

  test("pings with SELECT 1", async () => {
    await sql_source.testSQLSource(mysqlRequest());
  });

  // Backticks in identifiers reach the engine doubled by quoteIdent;
  // describe is parameterized, so quotes in names must already survive it.
  test("handles tables whose names/columns carry quotes", async () => {
    const tableName = "mysql'q`t";
    const quotedColumn = "c`1";
    try {
      await sql.send(mysqlRequest("CREATE TABLE `mysql'q``t` (id INT PRIMARY KEY, `c``1` TEXT)"));
      await sql.send(mysqlRequest("INSERT INTO `mysql'q``t` VALUES (1, 'x')"));

      const schema = await sql.describeTable(mysqlRequest(), tableName);
      expect(schema.columns.map(c => c.name)).toEqual(["id", quotedColumn]);

      const count = await sql_source.countRowsSQLSource(mysqlRequest(), tableName, {kind: "simple", column: quotedColumn, op: "=", value: "x"});
      expect(count).toBe(1);

      await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, tableName, ["id"],
        [{pkValues: [1], column: quotedColumn, value: "O'Brien"}]);
      const res = await sql.send(mysqlRequest("SELECT `c``1` FROM `mysql'q``t`"));
      expect(res.rows).toEqual([["O'Brien"]]);
    } finally {
      await sql.send(mysqlRequest("DROP TABLE IF EXISTS `mysql'q``t`"));
    }
  });

  // MySQL string literals treat \ as an escape character: without doubling, a
  // trailing backslash terminates the literal (unterminated string error) and
  // a backslash before a quote closes it early, splicing the tail into SQL.
  test("updates and filters values carrying backslashes", async () => {
    const table = "test_mysql_backslash_values";
    try {
      await sql.send(mysqlRequest(`CREATE TABLE ${table} (id INT PRIMARY KEY, v TEXT)`));
      await sql.send(mysqlRequest(`INSERT INTO ${table} VALUES (1, 'x'), (2, 'y')`));

      await sql_source.updateTableRows({dsn: mysqlDSN, database: "mysql", readOnly: false}, table, ["id"], [
        {pkValues: [1], column: "v", value: "a\\"},
        {pkValues: [2], column: "v", value: "a\\'"},
      ]);
      const res = await sql.send(mysqlRequest(`SELECT v FROM ${table} ORDER BY id`));
      expect(res.rows).toEqual([["a\\"], ["a\\'"]]);

      expect(await sql_source.countRowsSQLSource(mysqlRequest(), table, {kind: "simple", column: "v", op: "=", value: "a\\"})).toBe(1);
      expect(await sql_source.countRowsSQLSource(mysqlRequest(), table, {kind: "simple", column: "v", op: "=", value: "a\\'"})).toBe(1);
    } finally {
      await sql.send(mysqlRequest(`DROP TABLE IF EXISTS ${table}`));
    }
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
