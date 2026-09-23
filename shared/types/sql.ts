export const Database = {
  ["postgres"]:   "PostgreSQL",
  ["mysql"]:      "MySQL",
  ["sqlite"]:     "SQLite",
  ["clickhouse"]: "ClickHouse",
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
  column: string,
  table: string,
  to: string,
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
