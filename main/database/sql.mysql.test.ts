import {describe, test, expect} from "bun:test";
import {parsePlan, columnMeta, dataTypeMeta, quoteIdent} from "./sql.mysql";
import {ColumnType} from "@/types.ts";

describe("quoteIdent", () => {
  test("doubles embedded backticks", () => {
    expect(quoteIdent("plain")).toBe("`plain`");
    expect(quoteIdent("we`ird")).toBe("`we``ird`");
  });
});

describe("columnMeta (mysql protocol types)", () => {
  test.each([
    [{name: "id", columnType: 3}, {typename: "int", type: ColumnType.NUMBER}],
    [{name: "v", columnType: 253}, {typename: "varchar", type: ColumnType.STRING}],
    [{name: "j", columnType: 245}, {typename: "json", type: ColumnType.JSON}],
    [{name: "d", columnType: 12}, {typename: "datetime", type: ColumnType.TIME}],
    [{name: "b", columnType: 1}, {typename: "tinyint", type: ColumnType.NUMBER}],
    [{name: "dc", columnType: 246}, {typename: "decimal", type: ColumnType.NUMBER}],
    // binary charset (63) marks byte variants of string types
    [{name: "t", columnType: 252}, {typename: "text", type: ColumnType.STRING}],
    [{name: "b", columnType: 252, characterSet: 63}, {typename: "blob", type: ColumnType.STRING}],
    [{name: "c", columnType: 254, characterSet: 63}, {typename: "binary", type: ColumnType.STRING}],
    [{name: "v", columnType: 253, characterSet: 63}, {typename: "varbinary", type: ColumnType.STRING}],
    // mariadb extended metadata overrides the wire type
    [{name: "u", columnType: 253, extendedTypeName: "uuid"}, {typename: "uuid", type: ColumnType.STRING}],
    // unknown protocol ids degrade to unknown
    [{name: "x", columnType: 99}, {typename: "unknown", type: ColumnType.UNKNOWN}],
    [{name: "y"}, {typename: "unknown", type: ColumnType.UNKNOWN}],
  ])("%j", (field, want) => {
    expect(columnMeta(field)).toEqual(want);
  });
});

describe("dataTypeMeta (information_schema data_type)", () => {
  test.each([
    ["int", ColumnType.NUMBER],
    ["varchar", ColumnType.STRING],
    ["datetime", ColumnType.TIME],
    ["json", ColumnType.JSON],
    ["binary", ColumnType.STRING],
    ["varbinary", ColumnType.STRING],
    ["longtext", ColumnType.STRING],
    ["uuid", ColumnType.STRING],
    ["geometry", ColumnType.UNKNOWN],
    ["exotic", ColumnType.UNKNOWN],
  ])("%s", (name, want) => {
    expect(dataTypeMeta(name)).toBe(want);
  });
});

const MYSQL_FIXTURE = `-> Limit: 5 row(s)  (actual time=0.35..0.35 rows=5 loops=1)
    -> Sort: h.field  (actual time=0.34..0.34 rows=5 loops=1)
        -> Nested loop inner join  (cost=1.6 rows=3) (actual time=0.04..0.31 rows=12 loops=1)
            -> Filter: (s.\`value\` <> 'x')  (cost=1.35 rows=3) (actual time=0.03..0.3 rows=12 loops=1)
                -> Index lookup on s using idx_value  (cost=1.2 rows=3) (actual time=0.02..0.25 rows=12 loops=1)
            -> Index lookup on h using PRIMARY (h.\`key\`=s.\`key\`)  (cost=0.25 rows=1) (actual time=0.008..0.01 rows=1 loops=12)`;

describe("parseMysqlPlan", () => {
  test("builds the operator tree", () => {
    expect(parsePlan(MYSQL_FIXTURE)).toMatchSnapshot();
  });

  test("returns null for the traditional tabular format", () => {
    expect(parsePlan("1\tSIMPLE\tt\tALL\tNULL\tNULL\tNULL\tNULL\t3\t100.00\tUsing where")).toBeUndefined();
  });

  test("splits scan qualifiers into fields, keeping conditions in the label", () => {
    const plan = parsePlan(
      "-> Index lookup on s using idx_value  (cost=0.35 rows=1) (actual time=0.020..0.020 rows=1 loops=1)",
    )!;
    expect(plan.root.title).toBe("Index lookup");
    expect(plan.root.kind).toBe("index");
    expect(plan.root.table).toBe("s");
    expect(plan.root.index).toBe("idx_value");

    const cond = parsePlan(
      "-> Index lookup on h using PRIMARY (h.`key` = s.`key`)  (cost=0.25 rows=1) (actual time=0.008..0.010 rows=1 loops=1)",
    )!;
    expect(cond.root.title).toBe("Index lookup (h.`key` = s.`key`)");
    expect(cond.root.table).toBe("h");
    expect(cond.root.index).toBe("PRIMARY");
  });
});
