import {type TableInfo, type TableSchema, type ColumnInfo, type ConstraintInfo, type IndexInfo, type ForeignKey, type SQLRequest, Database} from "../types/models.ts";
import {sendSQL} from "./sql.ts";

export async function listTablesSQLSource(request: SQLRequest): Promise<TableInfo[]> {
  const tablesResult = await sendSQL({...request, query: introspectionQueryTables(request)});
  const tableNames = tablesResult.rows.map(r => String(r[0]));
  return await Promise.all(tableNames.map(async name => {
    const countResult = await sendSQL({...request, query: `SELECT COUNT(*) FROM "${name}"`});
    const rowCount = Number(countResult.rows[0]?.[0] ?? 0);
    return {name, rowCount, sizeBytes: 0};
  }));
}

export async function describeTableSQLSource(request: SQLRequest, tableName: string): Promise<TableSchema> {
  switch (request.database) {
  case Database.POSTGRES:
    return describePostgres(request, tableName);
  case Database.MYSQL:
    return describeMySQL(request, tableName);
  case Database.SQLITE:
    return describeSQLite(request, tableName);
  case Database.CLICKHOUSE:
    return describeClickHouse(request, tableName);
  default:
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`unsupported database type: ${request.database}`);
  }
}

async function describePostgres(request: SQLRequest, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await sendSQL({...request, query: `
    SELECT column_name, data_type, is_nullable = 'YES', column_default
    FROM information_schema.columns
    WHERE table_name = '${tableName}' AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY ordinal_position
  `});
  const columns: ColumnInfo[] = colResult.rows.map(r => ({
    name: String(r[0]),
    type: String(r[1]),
    nullable: ["YES" as unknown, 1, true].includes(r[2]),
    defaultValue: JSON.stringify(r[3] ?? ""),
  }));

  // Get constraints
  const conResult = await sendSQL({...request, query: `
    SELECT con.conname, CASE con.contype
      WHEN 'p' THEN 'PRIMARY KEY'
      WHEN 'u' THEN 'UNIQUE'
      WHEN 'f' THEN 'FOREIGN KEY'
      WHEN 'c' THEN 'CHECK'
      ELSE 'UNKNOWN'
    END, pg_get_constraintdef(con.oid)
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = '${tableName}' AND nsp.nspname NOT IN ('pg_catalog', 'information_schema')
  `});
  const constraints: ConstraintInfo[] = conResult.rows.map(r => ({
    name: String(r[0]),
    type: String(r[1]),
    definition: String(r[2]),
  }));

  // Get indexes
  const idxResult = await sendSQL({...request, query: `
    SELECT idx.indexname, pg_get_indexdef(idx.indexrelid)
    FROM pg_indexes idx
    WHERE idx.tablename = '${tableName}' AND idx.schemaname NOT IN ('pg_catalog', 'information_schema')
  `});
  const indexes: IndexInfo[] = idxResult.rows.map(r => ({
    name: String(r[0]),
    definition: String(r[1]),
  }));

  // Parse foreign keys from constraints
  const foreignKeys: ForeignKey[] = [];
  for (const con of constraints) {
    if (con.type === "FOREIGN KEY") {
      const parts = con.definition.split("REFERENCES");
      if (parts.length === 2) {
        const fromPart = parts[0].replace("FOREIGN KEY", "").replace(/[()]/g, "").trim();
        const refPart = parts[1].trim();
        const refParts = refPart.split("(");
        if (refParts.length === 2) {
          const toTable = refParts[0].trim();
          const to = refParts[1].replace(")", "").trim();
          foreignKeys.push({column: fromPart, table: toTable, to});
        }
      }
    }
  }

  return {columns, constraints, foreign_keys: foreignKeys, indexes};
}

async function describeMySQL(request: SQLRequest, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await sendSQL({...request, query: `
    SELECT column_name, column_type, is_nullable = 'YES', column_default
    FROM information_schema.columns
    WHERE table_name = '${tableName}' AND table_schema = DATABASE()
    ORDER BY ordinal_position
  `});
  const columns: ColumnInfo[] = colResult.rows.map(r => ({
    name: String(r[0]),
    type: String(r[1]),
    nullable: ["YES" as unknown, 1, true].includes(r[2]),
    defaultValue: JSON.stringify(r[3] ?? ""),
  }));

  // Get constraints (simplified - PRIMARY KEY only)
  const constraints: ConstraintInfo[] = [];
  try {
    const conResult = await sendSQL({...request, query: `
      SELECT constraint_name, column_name
      FROM information_schema.key_column_usage
      WHERE table_name = '${tableName}' AND table_schema = DATABASE() AND constraint_name = 'PRIMARY'
    `});
    for (const r of conResult.rows) {
      const col = String(r[1]);
      constraints.push({name: String(r[0]), type: "PRIMARY KEY", definition: `PRIMARY KEY (${col})`});
    }
  } catch (_e) {
    // Constraints query is best-effort
  }

  return {columns, constraints, foreign_keys: [], indexes: []};
}

async function describeSQLite(request: SQLRequest, tableName: string): Promise<TableSchema> {
  const columns: ColumnInfo[] = [];
  const constraints: ConstraintInfo[] = [];

  // Get columns via PRAGMA table_info (returns: cid, name, type, notnull, dflt, pk)
  const colResult = await sendSQL({...request, query: `PRAGMA table_info('${tableName}')`});
  for (const r of colResult.rows) {
    const name = String(r[1]);
    const typ = String(r[2]);
    const notnull = [1 as unknown, true, "1"].includes(r[3]);
    const defaultVal = JSON.stringify(r[4] ?? "");
    const pk = [1 as unknown, true, "1"].includes(r[5]);

    columns.push({name, type: typ, nullable: !notnull, defaultValue: defaultVal});
    if (pk) {
      constraints.push({name: "PRIMARY KEY", type: "PRIMARY KEY", definition: `PRIMARY KEY (${name})`});
    }
  }

  // Get indexes
  const idxResult = await sendSQL({...request, query: `
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'index' AND tbl_name = '${tableName}'
    ORDER BY name
  `});
  const indexes: IndexInfo[] = idxResult.rows.map(r => ({
    name: String(r[0]),
    definition: JSON.stringify(r[1] ?? ""),
  }));

  // Get foreign keys via PRAGMA foreign_key_list (returns: id, seq, table, from, to, on_update, on_delete, match)
  const foreignKeys: ForeignKey[] = [];
  try {
    const fkResult = await sendSQL({...request, query: `PRAGMA foreign_key_list('${tableName}')`});
    for (const r of fkResult.rows) {
      foreignKeys.push({column: String(r[3]), table: String(r[2]), to: String(r[4])});
    }
  } catch (_e) {
    // Foreign keys query is best-effort
  }

  return {columns, constraints, foreign_keys: foreignKeys, indexes};
}

async function describeClickHouse(request: SQLRequest, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await sendSQL({...request, query: `
    SELECT name, type, default_kind != '', default_expression
    FROM system.columns
    WHERE database = currentDatabase() AND table = '${tableName}'
  `});
  const columns: ColumnInfo[] = colResult.rows.map(r => ({
    name: String(r[0]),
    type: String(r[1]),
    nullable: String(r[1]).includes("Nullable"),
    defaultValue: ["YES" as unknown, 1, true].includes(r[2]) ? JSON.stringify(r[3] ?? "") : "",
  }));

  return {columns, constraints: [], foreign_keys: [], indexes: []};
}

export async function countRowsSQLSource(request: SQLRequest, tableName: string): Promise<number> {
  // Quote each part of schema-qualified names separately
  const quoted = tableName.split(".").map(p => `"${p}"`).join(".");
  const result = await sendSQL({...request, query: `SELECT COUNT(*) FROM ${quoted}`});
  return Number(result.rows[0]?.[0] ?? 0);
}

export async function testSQLSource(request: SQLRequest): Promise<void> {
  await sendSQL({...request, query: "SELECT 1"});
}

function introspectionQueryTables(request: SQLRequest): string {
  switch (request.database) {
  case Database.POSTGRES:
    return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
  case Database.MYSQL:
    return "SHOW TABLES";
  case Database.SQLITE:
    return "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
  case Database.CLICKHOUSE:
    return "SELECT name FROM system.tables WHERE database = currentDatabase() ORDER BY name";
  default:
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`unsupported database type: ${request.database}`);
  }
}
