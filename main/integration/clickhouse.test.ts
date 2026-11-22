import {describe, test, expect, beforeAll, afterAll} from "bun:test";
import {SQLRequest, ColumnType, SQLPlanNode} from "@/types.ts";
import * as sql from "../database/sql.ts";
import * as sql_source from "../database/sql_source.ts";

const IS_INTEGRATION = Boolean(process.env["INTEGRATION"]);
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

// Table names may carry quotes; describe must bind them (query_params) instead
// of interpolating them into system.* string literals. MergeTree + skipping
// index so all three bound queries (columns, primary key, indices) run.
describe.if(IS_INTEGRATION)("sql crafted table names (clickhouse)", () => {
  const tableName = `ch'table`;

  beforeAll(async () => {
    await sql.send(chRequest(`DROP TABLE IF EXISTS \`${tableName}\``));
    await sql.send(chRequest(`CREATE TABLE \`${tableName}\` (id UInt8, v UInt8, INDEX idx_v v TYPE minmax GRANULARITY 2) ENGINE = MergeTree ORDER BY id`));
  });
  afterAll(async () => {
    await sql.send(chRequest(`DROP TABLE IF EXISTS \`${tableName}\``));
  });

  test("describes such tables", async () => {
    const schema = await sql.describeTable(chRequest(), tableName);
    expect(schema.columns.map(c => c.name)).toEqual(["id", "v"]);
    expect(schema.constraints.map(c => c.name)).toEqual(["PRIMARY KEY"]);
    expect(schema.indexes.map(i => i.name)).toEqual(["idx_v"]);
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
