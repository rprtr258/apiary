import {describe, test, expect} from "bun:test";
import {ColumnType} from "@/types.ts";
import {parsePlan, declaredColumnType, quoteIdent} from "./sql.sqlite";

describe("quoteIdent", () => {
  test("doubles embedded backticks", () => {
    expect(quoteIdent("plain")).toBe("`plain`");
    expect(quoteIdent("we`ird")).toBe("`we``ird`");
  });
});

describe("declaredColumnType (sqlite affinity)", () => {
  test.each([
    ["INTEGER", ColumnType.NUMBER],
    ["BIGINT", ColumnType.NUMBER],
    ["DOUBLE PRECISION", ColumnType.NUMBER],
    ["DECIMAL(10,5)", ColumnType.NUMBER],
    ["VARCHAR(255)", ColumnType.STRING],
    ["TEXT", ColumnType.STRING],
    ["CLOB", ColumnType.STRING],
    ["BLOB", ColumnType.STRING],
    // specials win over the affinity ladder ("BOOLEAN" contains "INT")
    ["BOOLEAN", ColumnType.BOOLEAN],
    ["DATETIME", ColumnType.TIME],
    ["TIMESTAMP", ColumnType.TIME],
    ["JSON", ColumnType.JSON],
    ["FROBNICATOR", undefined],
    [null, undefined],
  ])("declaredColumnType(%s)", (declared, want) => {
    expect(declaredColumnType(declared)).toBe(want);
  });
});

describe("parseSqlitePlan", () => {
  test("wraps the flat join forest under a synthetic root", () => {
    const plan = parsePlan([
      {id: 4, parent: 0, detail: "SCAN s"},
      {id: 7, parent: 0, detail: "SCAN h LEFT-JOIN"},
    ])!;
    expect(plan).toMatchSnapshot();
  });

  test("rebuilds subquery trees from parent links", () => {
    const plan = parsePlan([
      {id: 2, parent: 0, detail: "CO-ROUTINE s"},
      {id: 3, parent: 2, detail: "SCAN t1"},
      {id: 6, parent: 0, detail: "SCAN s"},
    ])!;
    expect(plan).toMatchSnapshot();
  });

  test("classifies scans, index searches and order-by b-trees", () => {
    const plan = parsePlan([
      {id: 4, parent: 0, detail: "SEARCH users USING INTEGER PRIMARY KEY (rowid=?)"},
      {id: 8, parent: 0, detail: "USE TEMP B-TREE FOR ORDER BY"},
    ])!;
    expect(plan).toMatchSnapshot();
  });

  test("splits the USING descriptor into the index field", () => {
    const plan = parsePlan([
      {id: 1, parent: 0, detail: "SEARCH t USING COVERING INDEX i (c = ?)"},
      {id: 2, parent: 0, detail: "SCAN t VIRTUAL TABLE INDEX 1:M"},
    ])!;
    expect(plan.root.title).toBe("Query plan");
    expect(plan.root.children[0].title).toBe("SEARCH (c = ?)");
    expect(plan.root.children[0].table).toBe("t");
    expect(plan.root.children[0].index).toBe("COVERING INDEX i");
    expect(plan.root.children[1].title).toBe("SCAN t VIRTUAL TABLE INDEX 1:M");
    expect(plan.root.children[1].table).toBe("t");
    expect(plan.root.children[1].index).toBeUndefined();
  });

  test("returns null for empty rows", () => {
    expect(parsePlan([])).toBeUndefined();
  });
});
