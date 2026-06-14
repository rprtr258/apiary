export const Database = {
  ["postgres"]:   "PostgreSQL",
  ["mysql"]:      "MySQL",
  ["sqlite"]:     "SQLite",
  ["clickhouse"]: "ClickHouse",
} as const;

export type Database = keyof typeof Database;

export enum ColumnType {
  STRING = "string",
  NUMBER = "number",
  TIME = "time",
  BOOLEAN = "boolean",
}

export type RowValue = Date | string | number | boolean | null;

export type ColumnInfo = {
  name: string,
  type: string,
  nullable: boolean,
  defaultValue: string,
};

export type ConstraintInfo = {
  name: string,
  type: string,
  definition: string,
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
};

export type SQLResponse = {
  columns: string[],
  types: string[],
  rows: unknown[][],
};

export type SQLSourceRequest = {
  database: Database,
  dsn: string,
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
