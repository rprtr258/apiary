import {describe, test, expect} from "bun:test";
import {parsePlan} from "./sql.postgres.ts";

const POSTGRES_FIXTURE = `Limit  (cost=38.98..39.00 rows=5 width=12) (actual time=0.156..0.157 rows=5 loops=1)
  ->  Sort  (cost=38.97..39.02 rows=20 width=12) (actual time=0.155..0.155 rows=5 loops=1)
        Sort Key: h.field
        Sort Method: top-N heapsort  Memory: 25kB
        ->  Hash Join  (cost=18.10..38.52 rows=20 width=12) (actual time=0.081..0.130 rows=12 loops=1)
              Hash Cond: (s.key = h.key)
              ->  Seq Scan on rstring s  (cost=0.00..17.95 rows=120 width=8) (actual time=0.011..0.031 rows=120 loops=1)
                    Filter: (value <> 'x'::text)
                    Rows Removed by Filter: 3
              ->  Hash  (cost=16.00..16.00 rows=160 width=8) (actual time=0.052..0.052 rows=160 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 20kB
                    ->  Seq Scan on rhash h  (cost=0.00..16.00 rows=160 width=8) (actual time=0.008..0.022 rows=160 loops=1)
Planning Time: 0.234 ms
Execution Time: 0.201 ms`;

describe("parsePostgresPlan", () => {
  test("builds the operator tree", () => {
    expect(parsePlan(POSTGRES_FIXTURE)).toMatchSnapshot();
  });

  test("returns null for garbage", () => {
    expect(parsePlan("")).toBeUndefined();
  });

  test("splits scan qualifiers into fields", () => {
    const plan = parsePlan(
      "Index Scan using idx_resource_order_active on resource_order ro  (cost=0.43..8.45 rows=1 width=8) (actual time=0.024..0.025 rows=1 loops=1)",
    )!;
    expect(plan.root.title).toBe("Index Scan");
    expect(plan.root.kind).toBe("index");
    expect(plan.root.table).toBe("resource_order");
    expect(plan.root.index).toBe("idx_resource_order_active");
    expect(plan.root.alias).toBe("ro");
  });

  test("bitmap index scan points at an index, not a table", () => {
    const plan = parsePlan(
      "Bitmap Index Scan on idx_t_a  (cost=0.00..12.25 rows=300 width=0) (actual time=0.030..0.030 rows=300 loops=1)",
    )!;
    expect(plan.root.title).toBe("Bitmap Index Scan");
    expect(plan.root.kind).toBe("index");
    expect(plan.root.index).toBe("idx_t_a");
    expect(plan.root.table).toBeUndefined();
  });

  test("keeps titles without qualifiers intact", () => {
    const plan = parsePlan("Sort  (cost=38.97..39.02 rows=20 width=12) (actual time=0.155..0.155 rows=5 loops=1)")!;
    expect(plan.root.title).toBe("Sort");
    expect(plan.root.kind).toBe("sort");
    expect(plan.root.table).toBeUndefined();
    expect(plan.root.index).toBeUndefined();
    expect(plan.root.alias).toBeUndefined();
  });
});
