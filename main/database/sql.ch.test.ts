import {describe, test, expect} from "bun:test";
import {parsePlan} from "./sql.ch.ts";

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

describe("parseClickhousePlan", () => {
  test("builds the operator tree", () => {
    expect(parsePlan(CLICKHOUSE_FIXTURE)).toMatchSnapshot();
  });

  test("keeps 26.x Output lines out of the operator tree", () => {
    expect(parsePlan(CLICKHOUSE_26_FIXTURE)).toMatchSnapshot();
  });
});
