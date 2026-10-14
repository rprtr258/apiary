import {describe, test, expect} from "bun:test";
import {parsePlan} from "./sql.mysql";

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
