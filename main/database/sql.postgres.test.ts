import {describe, test, expect} from "bun:test";
import {parsePlan, columnType, typename, dataTypeColumnType, quoteIdent, dsnOf} from "./sql.postgres.ts";
import {parse, ConnectionOptions} from "pg-connection-string";
import {ColumnType} from "@/types.ts";

describe("quoteIdent", () => {
  test("doubles embedded double quotes", () => {
    expect(quoteIdent("plain")).toBe(`"plain"`);
    expect(quoteIdent("we\"ird")).toBe(`"we""ird"`);
  });
});

describe("postgres oid tables", () => {
  test.each([
    [1700, "numeric"],
    [1043, "varchar"],
    [21, "int2"],
    [701, "float8"],
    [2950, "uuid"],
    [3802, "jsonb"],
    [3904, "int4range"],
    // non-builtin OIDs (extension types) keep the raw form
    [999999, "999999"],
  ])("typename(%i)", (oid, want) => {
    expect(typename(oid)).toBe(want);
  });

  test.each([
    [1700, ColumnType.NUMBER], // numeric
    [21, ColumnType.NUMBER], // int2
    [701, ColumnType.NUMBER], // float8
    [16, ColumnType.BOOLEAN], // bool
    [1184, ColumnType.TIME], // timestamptz
    [1186, ColumnType.TIME], // interval
    [114, ColumnType.JSON], // json
    [3802, ColumnType.JSON], // jsonb
    [1043, ColumnType.STRING], // varchar
    [3904, ColumnType.UNKNOWN], // int4range
    [999999, ColumnType.UNKNOWN], // extension oid
  ])("columnType(%i)", (oid, want) => {
    expect(columnType(oid)).toBe(want);
  });
});

describe("dataTypeColumnType (information_schema)", () => {
  test.each([
    ["boolean", ColumnType.BOOLEAN],
    ["integer", ColumnType.NUMBER],
    ["numeric", ColumnType.NUMBER],
    ["double precision", ColumnType.NUMBER],
    ["bigserial", ColumnType.NUMBER],
    ["character varying", ColumnType.STRING],
    ["text", ColumnType.STRING],
    ["uuid", ColumnType.STRING],
    ["timestamp without time zone", ColumnType.TIME],
    ["timestamp with time zone", ColumnType.TIME],
    ["date", ColumnType.TIME],
    ["time without time zone", ColumnType.TIME],
    ["interval", ColumnType.TIME],
    ["json", ColumnType.JSON],
    ["jsonb", ColumnType.JSON],
    ["ARRAY", ColumnType.UNKNOWN],
    ["USER-DEFINED", ColumnType.UNKNOWN],
  ])("dataTypeColumnType(%s)", (dataType, want) => {
    expect(dataTypeColumnType(dataType)).toBe(want);
  });
});

describe("dsnOf", () => {
  test.each([
    ["postgres://u:p@h:5432/db?sslmode=disable", "postgres://u:p@h:5432/db?sslmode=disable&uselibpqcompat=true"],
    ["postgresql://h/db", "postgresql://h/db?uselibpqcompat=true"],
    ["localhost:5432/db", "postgres://localhost:5432/db?uselibpqcompat=true"],
    ["localhost:5432/db?sslmode=disable", "postgres://localhost:5432/db?sslmode=disable&uselibpqcompat=true"],
  ])("keeps URI and shorthand DSNs working: %s", (dsn, want) => {
    expect(dsnOf(dsn)).toBe(want);
  });

  test.each([
    ["host=localhost user=postgres password=secret port=5433 dbname=mydb sslmode=disable", "postgres://postgres:secret@localhost:5433/mydb?sslmode=disable&uselibpqcompat=true"],
    ["host=/var/run/postgresql dbname=regress", "postgres://%2Fvar%2Frun%2Fpostgresql/regress?uselibpqcompat=true"],
    ["host=::1 port=5432", "postgres://[::1]:5432/?uselibpqcompat=true"],
    ["host=localhost dbname='my db' options='-c statement_timeout=300'", "postgres://localhost/my%20db?options=-c%20statement_timeout%3D300&uselibpqcompat=true"],
    ["dbname='a\\'b' dbname=c", "postgres:///c?uselibpqcompat=true"],
  ])("rewrites keyword/value DSNs to URIs: %s", (dsn, want) => {
    expect(dsnOf(dsn)).toBe(want);
  });

  test.each([
    ["host=localhost port", `missing "=" after "port"`],
    ["dbname='unterminated", "unterminated quoted string"],
    ["host=h port=abc", `invalid port "abc"`],
  ])("rejects malformed keyword/value DSN: %s", (dsn, message) => {
    expect(() => dsnOf(dsn)).toThrow(message);
  });

  test.each<{dsn: string, want: Partial<ConnectionOptions>}>([
    {
      dsn: "host=localhost user=postgres password=secret port=5433 dbname=mydb sslmode=disable",
      want: {user: "postgres", password: "secret", host: "localhost", port: "5433", database: "mydb", ssl: false},
    },
    {
      dsn: "host=/var/run/postgresql dbname='my db' options='-c statement_timeout=300'",
      want: {host: "/var/run/postgresql", database: "my db"},
    },
  ])("built URI for $dsn parses back through pg-connection-string", ({dsn, want}) => {
    expect(parse(dsnOf(dsn))).toMatchObject(want);
  });
});

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
