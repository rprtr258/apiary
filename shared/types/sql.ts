export const Database = {
  postgres:   "PostgreSQL",
  mysql:      "MySQL",
  sqlite:     "SQLite",
  clickhouse: "ClickHouse",
  redis:      "Redis",
} as const;

export type Database = keyof typeof Database;

export enum ColumnType {
  UNKNOWN = "unknown",
  STRING = "string",
  NUMBER = "number",
  TIME = "time",
  BOOLEAN = "boolean",
  JSON = "json",
}

export type RowValue = Date | string | number | boolean | null;

export type ColumnInfo = {
  name: string,
  typename: string,
  type: ColumnType,
  nullable: boolean,
  defaultValue: string,
};

export type ConstraintInfo = {
  name: string,
  type: string,
  definition: string,
  columns: string[],
};

export type ForeignKey = {
  name: string,
  column: string,
  schema: string,
  table: string,
  to: string,
  onUpdate: string,
  onDelete: string,
};

export type IndexInfo = {
  name: string,
  definition: string,
};

export type SQLRequest = {
  dsn: string,
  database: Database,
  query: string,
  /**
   * When true, the driver opens the connection/transaction read-only and any
   * write statement throws. Only set by SQLSource perform; introspection and
   * the standalone SQL request kind leave it unset.
   */
  readOnly?: boolean,
};

export type SQLResponse = {
  columns: string[],
  types: ColumnType[],
  typenames: string[],
  rows: unknown[][],
  // Per-statement affected-row counts for batch execution, when the driver
  // reports them (absent for e.g. clickhouse, whose exec has no counts).
  affectedRows?: number[],
};

export type SQLSourceRequest = {
  database: Database,
  dsn: string,
  readOnly: boolean,
};

/** Classification assigned by the plan parsers; the diagram colors nodes by
 * kind, so backends with different operator names still render alike. */
export type SQLPlanKind =
  | "scan" | "index" | "join" | "filter" | "sort" | "aggregate" | "limit"
  | "project" | "setop" | "write" | "subquery" | "other";

/** One operator of the query plan.
 * - `table` is the table the operator reads/writes, when any (drives table coloring);
 * - `index` is the index the operator reads through, when any;
 * - `alias` is the table alias the backend reports, when any;
 * - `details` holds backend-specific lines (filters, conditions);
 * - `metrics` holds parsed cost/rows/time pairs;
 * - `title` is the bare operator name — qualifiers live in the fields above.
 * - `children` flow data into this node; */
export type SQLPlanNode = {
  title: string,
  kind: SQLPlanKind,
  table?: string,
  alias?: string,
  index?: string,
  details: string[],
  /** Metrics of a plan node (cost, rows, actual time...);
   * the value keeps the backend's own text form ("36.75..36.76", "0.123..0.124"). */
  metrics: Record<string, string>,
  children: SQLPlanNode[],
};

/** Query plan parsed into the unified operator-tree format; null when the
 * backend's EXPLAIN output could not be parsed (renderer falls back to raw). */
export type SQLPlan = {
  root: SQLPlanNode,
};

/** EXPLAIN result: raw text for the "Plan (raw)" tab plus the plan parsed into
 * the unified format for the diagram. Both come from one EXPLAIN round trip
 * (EXPLAIN ANALYZE on postgres/mysql/redis actually executes the query). */
export type SQLExplain = {
  raw: string,
  plan?: SQLPlan,
};

export type FilterOp =
  | "=" | "!=" | "<" | "<=" | ">" | ">=" | "in"
  | "like" | "not like"
  | "is null" | "is not null";

/** Table viewer filter. A simple filter's value is the raw renderer input —
 * the main process parses it into SQL literal(s) (numbers and true/false by
 * content, `in` splits the string on commas; null only for the null checks). */
export type TableFilter =
  | {kind: "simple", column: string, op: FilterOp, value: string | null}
  | {kind: "manual", expr: string};

export type TableRead = {
  table: string,
  orderBy: {column: string, direction: "asc" | "desc"}[],
  filter: TableFilter | null,
  limit: number,
  offset: number,
};

export type TableInfo = {
  name: string,
  rowCount: number,
  sizeBytes: number,
};

export type TableSchema = {
  columns: ColumnInfo[],
  constraints: ConstraintInfo[],
  foreign_keys: ForeignKey[],
  indexes: IndexInfo[],
};

/** One changed cell. Rows are identified by their primary key values (in
 * pkColumns order, provided alongside the update list); value may be null
 * (explicit "Set NULL"). The main process turns these into UPDATE statements —
 * no SQL crosses the IPC boundary. */
export type CellUpdate = {
  pkValues: RowValue[],
  column: string,
  value: RowValue,
};
