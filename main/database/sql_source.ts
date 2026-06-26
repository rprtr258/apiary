import {type TableInfo, type TableSchema, type ColumnInfo, type ConstraintInfo, type IndexInfo, type ForeignKey, type SQLRequest, SQLSourceRequest} from "@/types.ts";
import {sendSQL} from "./sql.ts";

export const EmptyRequest: SQLSourceRequest = {
  dsn: ":memory:",
  database: "sqlite",
};

export async function listTables(request: Omit<SQLRequest, "query">): Promise<TableInfo[]> {
  const tables = await (async (): Promise<TableInfo[]> => {
  switch (request.database) {
  case "postgres": {
    const tablesResult = await sendSQL({...request, query: `
      SELECT
        t.tablename,
        COALESCE(s.n_live_tup, 0) as row_count,
        pg_total_relation_size(t.schemaname || '.' || t.tablename) as size_bytes
      FROM pg_catalog.pg_tables t
      LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname AND t.schemaname = s.schemaname
      WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
    `});
    return tablesResult.rows.map(([name, rowCount, sizeBytes]): TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
  }
  case "mysql": {
    const dbName = (await sendSQL({...request, query: "SELECT DATABASE()"})).rows[0][0] as string;
    const tablesResult = await sendSQL({...request, query: `
      SELECT
        table_name,
        table_rows,
        data_length + index_length
      FROM information_schema.TABLES
      WHERE table_schema = '${dbName}'
    `}); // TODO: pass dbname as arg
    return tablesResult.rows.map(([name, rowCount, sizeBytes]): TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
  }
  case "sqlite": {
    const tableNames = (await sendSQL({...request, query: `SELECT name FROM sqlite_master WHERE type='table'`})).rows.map(r => String(r[0]));
    const tables: TableInfo[] = [];
    // TODO: async map
    for (const table of tableNames) {
      // Approximate size (rough estimate)
      const colRows = (await sendSQL({...request, query: `PRAGMA table_info(${table})`})).rows.map(([_cid, name, _ctype, _notnull, _dflt, _pk]) => name as string);
      const lengthExpr = colRows.map(c => `COALESCE(LENGTH("${c}"),0)`).join(" + ");
      const [rowCount, sizeBytes] = (await sendSQL({...request, query: `SELECT COUNT(*) AS rows, COALESCE(SUM(${lengthExpr}), 0) AS payload FROM "${table}"`})).rows[0];
      tables.push({name: table, rowCount: rowCount as number, sizeBytes: sizeBytes as number});
    }
    return tables;
  }
  case "clickhouse": {
    return (await sendSQL({...request, query: `
      SELECT
        name,
        total_rows,
        total_bytes
      FROM system.tables
      WHERE database = currentDatabase()
    `})).rows.map(([name, rowCount, sizeBytes]): TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
  }
  default:
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`unsupported database type: ${request.database}`);
  }
  })();
  tables.sort((a, b) => a.name.localeCompare(b.name));
  return tables;
}

export async function describeTable(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  switch (request.database) {
  case "postgres":   return describePostgres(request, tableName);
  case "mysql":      return describeMySQL(request, tableName);
  case "sqlite":     return describeSQLite(request, tableName);
  case "clickhouse": return describeClickHouse(request, tableName);
  default:
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`unsupported database type: ${request.database}`);
  }
}

async function describePostgres(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await sendSQL({...request, query: `
    SELECT
      column_name,
      data_type,
      is_nullable = 'YES',
      column_default
    FROM information_schema.columns
    WHERE table_name = '${tableName}' AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY ordinal_position
  `}); // TODO: pass tableName as arg
  const columns: ColumnInfo[] = colResult.rows.map(([name, typ, nullable, defaultVal]) => ({
    name: name as string,
    type: typ as string,
    nullable: nullable as boolean,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));

  // Get constraints
  const conResult = await sendSQL({...request, query: `
    SELECT
      con.conname,
      CASE con.contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'c' THEN 'CHECK'
        ELSE 'UNKNOWN'
      END,
      pg_get_constraintdef(con.oid)
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = '${tableName}' AND nsp.nspname NOT IN ('pg_catalog', 'information_schema')
  `}); // TODO: pass tableName as arg
  const constraints: ConstraintInfo[] = conResult.rows.map(([name, typ, def]) => ({
    name: name as string,
    type: typ as string,
    definition: def as string,
  }));

  // Get indexes
  const idxResult = await sendSQL({...request, query: `
    SELECT idx.indexname, idx.indexdef
    FROM pg_indexes idx
    WHERE idx.tablename = '${tableName}' AND idx.schemaname NOT IN ('pg_catalog', 'information_schema')
  `}); // TODO: pass tableName as arg
  const indexes: IndexInfo[] = idxResult.rows.map(([name, def]) => ({
    name: name as string,
    definition: def as string,
  }));

  // Parse foreign keys from constraints
  const foreignKeys: ForeignKey[] = constraints
    .filter(con => con.type === "FOREIGN KEY")
    .filter(con => con.definition.split("REFERENCES").length === 2)
    .flatMap(con => {
      const parts = con.definition.split("REFERENCES");
      const column = parts[0].replace("FOREIGN KEY", "").replace(/[()]/g, "").trim();
      const refPart = parts[1].trim();
      const refParts = refPart.split("(");
      if (refParts.length !== 2) {
        return [];
      }

      const table = refParts[0].trim();
      const to = refParts[1].replace(")", "").trim();
      return [{column, table, to}];
    });

  return {columns, constraints, foreign_keys: foreignKeys, indexes};
}

async function describeMySQL(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await sendSQL({...request, query: `
    SELECT
      column_name,
      column_type,
      is_nullable = 'YES',
      column_default
    FROM information_schema.columns
    WHERE table_name = '${tableName}' AND table_schema = DATABASE()
    ORDER BY ordinal_position
  `});
  const columns: ColumnInfo[] = colResult.rows.map(([name, typ, nullable, defaultVal]) => ({
    name: name as string,
    type: typ as string,
    nullable: nullable as boolean,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));

  // Get constraints (simplified - PRIMARY KEY only)
  let constraints: ConstraintInfo[] = [];
  try {
    const conResult = await sendSQL({...request, query: `
      SELECT
        constraint_name,
        column_name
      FROM information_schema.key_column_usage
      WHERE table_name = '${tableName}' AND table_schema = DATABASE() AND constraint_name = 'PRIMARY'
    `}); // TODO: pass tableName as arg
    constraints = conResult.rows.map(r => ({name: String(r[0]), type: "PRIMARY KEY", definition: `PRIMARY KEY (${r[1] as string})`}));
  } catch (_e) {
    // Constraints query is best-effort
  }

  // TODO: Get foreign keys and indexes
  return {columns, constraints, foreign_keys: [], indexes: []};
}

async function describeSQLite(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  const columns: ColumnInfo[] = [];
  const constraints: ConstraintInfo[] = [];

  // Get columns via PRAGMA table_info (returns: cid, name, type, notnull, dflt, pk)
  const colResult = await sendSQL({...request, query: `PRAGMA table_info('${tableName}')`});
  for (const r of colResult.rows) {
    const name = String(r[1]);
    const typ = String(r[2]);
    const notnull = [1 as unknown, true, "1"].includes(r[3]);
    const defaultVal = JSON.stringify(r[4] ?? "");
    const pk = r[5] as boolean;

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
  `}); // TODO: pass tableName as arg
  const indexes: IndexInfo[] = idxResult.rows.map(r => ({
    name: String(r[0]),
    definition: JSON.stringify(r[1] ?? ""),
  }));

  // Get foreign keys via PRAGMA foreign_key_list (returns: id, seq, table, from, to, on_update, on_delete, match)
  let foreign_keys: ForeignKey[] = [];
  try {
    const fkResult = await sendSQL({...request, query: `PRAGMA foreign_key_list('${tableName}')`});
    foreign_keys = fkResult.rows.map(r => ({column: String(r[3]), table: String(r[2]), to: String(r[4])}));
  } catch (_e) {
    // Foreign keys query is best-effort
  }

  return {columns, constraints, foreign_keys, indexes};
}

async function describeClickHouse(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await sendSQL({...request, query: `
    SELECT
      name,
      type,
      default_kind != '',
      default_expression
    FROM system.columns
    WHERE database = currentDatabase() AND table = '${tableName}'
  `});
  const columns: ColumnInfo[] = colResult.rows.map(r => ({
    name: String(r[0]),
    type: String(r[1]),
    nullable: String(r[1]).includes("Nullable"),
    defaultValue: ["YES" as unknown, 1, true].includes(r[2]) ? JSON.stringify(r[3] ?? "") : "",
  }));

  // TODO: get rest
  return {columns, constraints: [], foreign_keys: [], indexes: []};
}

export async function countRowsSQLSource(request: Omit<SQLRequest, "query">, tableName: string): Promise<number> {
  // Quote each part of schema-qualified names separately
  const quoted = tableName.split(".").map(p => `"${p}"`).join(".");
  const result = await sendSQL({...request, query: `SELECT COUNT(*) FROM ${quoted}`});
  return Number(result.rows[0]?.[0] ?? 0);
}

export async function testSQLSource(request: Omit<SQLRequest, "query">): Promise<void> {
  await sendSQL({...request, query: "SELECT 1"});
  // switch req.Database {
  // case database.DBClickhouse:
  //   opts, err := clickhouse.ParseDSN(req.DSN)
  //   if err != nil {
  //     return errors.Wrap(err, "parse DSN")
  //   }

  //   db := clickhouse.OpenDB(opts)
  //   defer db.Close()

  //   db.SetMaxIdleConns(5)
  //   db.SetMaxOpenConns(10)
  //   db.SetConnMaxLifetime(time.Hour)

  //   return errors.Wrap(db.PingContext(a.ctx), "ping database")
  // default:
  //   db, err := sql.Open(string(req.Database), req.DSN)
  //   if err != nil {
  //     return errors.Wrap(err, "connect to database")
  //   }
  //   defer db.Close()

  //   return errors.Wrap(db.PingContext(a.ctx), "ping database")
  // }
}
