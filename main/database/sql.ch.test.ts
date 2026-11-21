import {describe, test, expect} from "bun:test";
import {parsePlan, columnType, parseResponse} from "./sql.ch.ts";
import {ColumnType, JSONValue, SQLResponse} from "@/types.ts";

const CLICKHOUSE_FIXTURE = `Limit (preliminary LIMIT)
│  Limit 5
│  Offset 0
└──Sorting (Sorting for ORDER BY)
   │  Sort description: materialize(1) ASC
   │  Limit 5
   └──Join (JOIN FillRightFirst)
      │  s ⋈ h[1]
      │  Type: inner | Strictness: all | Algorithm: SpillingHashJoin(HashJoin)
      │  Join conditions: materialize(1) = 1
      │  Output:
      │    Left:  k
      │    Right: Empty
      ├──Union
      │  ├──Filter
      │  │  │  Filter column: materialize(1) != 0 AND RF1(materialize(k), 1)
      │  │  └──ReadFromSystemOne
      │  └──Filter
      │     │  Filter column: materialize(1) != 0 AND RF1(materialize(k), 1)
      │     └──ReadFromSystemOne
      └──BuildRuntimeFilter (Build runtime join filter on k)
         │  Filter id: RF1
         └──Filter ((WHERE + (Change column names to column identifiers + (Project names + (Projection + Change column names to column identifiers)))))
            │  Filter column: 1 != 0
            └──ReadFromSystemOne`;

// 26.x also prints an "Output: <columns>" list before the tree and under each
// operator (captured from clickhouse-server 26.10).
const CLICKHOUSE_26_FIXTURE = `Output: number

Limit (preliminary LIMIT)
│  Limit 5
│  Offset 0
└──ReadFromSystemNumbers
      Output: number`;

describe("columnType (clickhouse server types)", () => {
  test.each([
    ["UInt64", ColumnType.NUMBER],
    ["Int32", ColumnType.NUMBER],
    ["Float64", ColumnType.NUMBER],
    ["Decimal(10, 2)", ColumnType.NUMBER],
    ["Date", ColumnType.TIME],
    ["DateTime64(3, 'UTC')", ColumnType.TIME],
    ["Bool", ColumnType.BOOLEAN],
    ["String", ColumnType.STRING],
    ["FixedString(10)", ColumnType.STRING],
    ["Enum8('a' = 1)", ColumnType.STRING],
    ["UUID", ColumnType.STRING],
    ["IPv4", ColumnType.STRING],
    ["Nullable(Int32)", ColumnType.NUMBER],
    ["LowCardinality(String)", ColumnType.STRING],
    ["Array(String)", ColumnType.UNKNOWN],
  ])("columnType(%s)", (typename, want) => {
    expect(columnType(typename)).toBe(want);
  });
});

describe("parseResponse (JSONCompactEachRowWithNamesAndTypes)", () => {
  test.each<{label: string, values: JSONValue[][], want: SQLResponse}>([
    {
      label: "splits names, types and data rows",
      values: [
        ["id", "name", "flag"],
        ["UInt32", "Nullable(String)", "Bool"],
        [1, "a", true],
        [2, null, false],
      ],
      want: {
        columns: ["id", "name", "flag"],
        typenames: ["UInt32", "Nullable(String)", "Bool"],
        types: [ColumnType.NUMBER, ColumnType.STRING, ColumnType.BOOLEAN],
        rows: [[1, "a", true], [2, null, false]],
      },
    },
    {
      label: "keeps metadata for empty result sets",
      values: [
        ["id"],
        ["UInt32"],
      ],
      want: {columns: ["id"], typenames: ["UInt32"], types: [ColumnType.NUMBER], rows: []},
    },
  ])("$label", ({values: text, want}) => {
    const response = text.map(v => JSON.stringify(v)).join("\n");
    expect(parseResponse(response)).toEqual(want);
  });
});

describe("parseClickhousePlan", () => {
  test("builds the operator tree", () => {
    expect(parsePlan(CLICKHOUSE_FIXTURE)).toMatchSnapshot();
  });

  test("keeps 26.x Output lines out of the operator tree", () => {
    expect(parsePlan(CLICKHOUSE_26_FIXTURE)).toMatchSnapshot();
  });
});
