import {TableInfo, TableSchema, ColumnInfo, ConstraintInfo, IndexInfo, ForeignKey, SQLRequest, SQLSourceRequest, TableRead, ColumnType, RowValue, CellUpdate, SQLResponse} from "@/types.ts";
import {sendSQL, sendSQLBatch} from "./sql.ts";

export const EmptyRequest: SQLSourceRequest = {
  dsn: ":memory:",
  database: "sqlite",
  readOnly: false,
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Identifier quoting rules per database (mirrors the renderer's buildQuery).
const quoteIdent = {
  "postgres":   (s: string) => `"${s}"`,
  "mysql":      (s: string) => "`" + s + "`",
  "sqlite":     (s: string) => "`" + s + "`",
  "clickhouse": (s: string) => "`" + s.replaceAll("`", "\\`") + "`",
};

// SQL literal for a cell value. null → NULL, booleans → TRUE/FALSE, strings
// and dates quoted with '' escaping.
export function sqlLiteral(v: RowValue): string {
  if (v === null)
    return "NULL";
  if (typeof v === "number")
    return String(v);
  if (typeof v === "boolean")
    return v ? "TRUE" : "FALSE";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return `'${s.replaceAll("'", "''")}'`;
}

// One UPDATE per edited row, only its changed columns. Edits with identical
// pkValues are merged. pkValues must be in pkColumns order and use the
// ORIGINAL (loaded) values — the WHERE clause identifies rows by them.
export function buildTableUpdateStatements(
  request: Omit<SQLRequest, "query">,
  tableName: string,
  pkColumns: string[],
  updates: CellUpdate[],
): string[] {
  if (pkColumns.length === 0)
    throw new Error("table has no primary key");
  if (updates.length === 0)
    throw new Error("no updates");
  const uu = updates.find(u => u.pkValues.length !== pkColumns.length);
  if (uu !== undefined)
    throw new Error(`pk values count mismatch for column ${uu.column}`);

  const byRow = new Map<string, Map<string, RowValue>>();
  const pkByKey = new Map<string, RowValue[]>();
  for (const u of updates) {
    const key = JSON.stringify(u.pkValues);
    if (!byRow.has(key)) {
      byRow.set(key, new Map());
      pkByKey.set(key, u.pkValues);
    }
    byRow.get(key)!.set(u.column, u.value);
  }

  const q = quoteIdent[request.database];
  return [...byRow.entries()].map(([key, changes]) => {
    const set = [...changes.entries()]
      .map(([col, value]) => `${q(col)} = ${sqlLiteral(value)}`)
      .join(", ");
    const where = pkByKey.get(key)!
      // `= NULL` never matches any row: sqlite permits NULL pk values, so use IS NULL.
      .map((v, i) => v === null
        ? `${q(pkColumns[i])} IS NULL`
        : `${q(pkColumns[i])} = ${sqlLiteral(v)}`)
      .join(" AND ");
    return `UPDATE ${q(tableName)} SET ${set} WHERE ${where}`;
  });
}

// Copy-friendly script: exactly what updateTableRows runs, as text.
export function buildTableUpdateScript(request: Omit<SQLRequest, "query">, tableName: string, pkColumns: string[], updates: CellUpdate[]): string {
  return buildTableUpdateStatements(request, tableName, pkColumns, updates)
    .map(s => `${s};`)
    .join("\n");
}

export async function updateTableRows(request: Omit<SQLRequest, "query">, tableName: string, pkColumns: string[], updates: CellUpdate[]): Promise<SQLResponse> {
  const statements = buildTableUpdateStatements(request, tableName, pkColumns, updates);
  const res = await sendSQLBatch(request, statements);
  if (res.affectedRows === undefined)
    return res; // driver does not report affected rows (clickhouse)
  // Each statement targets exactly one row; a mismatch means the row is gone
  // or its pk changed — report failure instead of silently dropping the edit.
  const bad = res.affectedRows.findIndex(n => n !== 1);
  if (bad !== -1)
    throw new Error(`update matched ${res.affectedRows[bad]} rows instead of 1 (row deleted or pk changed): ${statements[bad]}`);
  return res;
}

// Parse which columns a constraint references. For PRIMARY KEY / UNIQUE /
// FOREIGN KEY the definition's first (...) is a plain column list. CHECK
// definitions are expressions, so match column names as identifiers after
// stripping string literals and ::type casts.
function parseConstraintColumns(definition: string, type: string, columnNames: string[]): string[] {
  if (type === "CHECK") {
    const cleaned = definition.replace(/'[^']*'/g, "").replace(/::\w+/g, "");
    return columnNames.filter(name => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(cleaned));
  }
  const match = definition.match(/\(([^)]+)\)/);
  if (match === null)
    return [];
  return match[1].split(",").map(part => part.trim());
}

// Constraint definitions carry the column list in the columns field, so the
// definition drops it. For PRIMARY KEY / UNIQUE / FOREIGN KEY the leading
// (...) right after the keyword is that column list; CHECK keeps its full
// expression, which is the definition itself.
function stripLeadingColumns(definition: string, type: string): string {
  if (type === "PRIMARY KEY" || type === "UNIQUE" || type === "FOREIGN KEY")
    return definition.replace(/^(\s*(?:PRIMARY KEY|UNIQUE|FOREIGN KEY))\s*\([^)]*\)/, "$1");
  return definition;
}

// Primary key columns of a table in key order, taken from the table schema.
// Used to pin the table viewer's pagination order. Empty for ClickHouse
// (describeTable returns no constraints, so no PK info is available).
async function tablePrimaryKeyColumns(request: Omit<SQLRequest, "query">, tableName: string): Promise<string[]> {
  const schema = await describeTable(request, tableName);
  return schema.constraints.find(c => c.type === "PRIMARY KEY")?.columns ?? [];
}

// Build a paginated read of a table for the table viewer. The primary key is
// appended to the user's sort as a deterministic tiebreaker, so LIMIT/OFFSET
// pages are stable instead of letting rows tied on the sort keys (or the whole
// result set when unsorted) duplicate or vanish between pages. Introspection is
// best-effort: on failure the table is paginated in engine order. No PK info is
// available for ClickHouse, so it stays in engine order too.
export async function buildReadTableQuery(request: Omit<SQLRequest, "query">, read: TableRead): Promise<string> {
  const q = quoteIdent[request.database];
  const orderTerms = read.orderBy.map(sc => `${q(sc.column)} ${sc.direction.toUpperCase()}`);
  try {
    orderTerms.push(...(await tablePrimaryKeyColumns(request, read.table)).map(c => `${q(c)} ASC`));
  } catch (_e) {
    // best-effort: order as well as we can
  }
  const orderBy = orderTerms.length > 0 ? ` ORDER BY ${orderTerms.join(", ")}` : "";
  return `SELECT * FROM ${q(read.table)}${orderBy} LIMIT ${read.limit} OFFSET ${read.offset}`;
}

export async function listTables(request: Omit<SQLRequest, "query">): Promise<TableInfo[]> {
  const tables = await (async (): Promise<TableInfo[]> => {
  switch (request.database) {
  case "postgres": {
    const tablesResult = await sendSQL({...request, query: `SELECT
  tablename,
  (xpath('/row/c/text()', query_to_xml(
    format('SELECT count(*) AS c FROM %I.%I', schemaname, tablename),
    false, true, ''
  )))[1]::text::bigint as row_count,
  pg_total_relation_size(schemaname || '.' || tablename) as size_bytes
FROM pg_catalog.pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')`});
    return tablesResult
      .rows
      .map(([name, rowCount, sizeBytes]): TableInfo => ({
        name: name as string,
        rowCount: Number(rowCount),
        sizeBytes: Number(sizeBytes),
      }));
  }
  case "mysql": {
    const dbName = (await sendSQL({...request, query: "SELECT DATABASE()"})).rows[0][0] as string;
    const tablesResult = await sendSQL({...request, query: `SELECT
  table_name,
  table_rows,
  data_length + index_length
FROM information_schema.TABLES
WHERE table_schema = '${dbName}'`}); // TODO: pass dbname as arg
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
    return (await sendSQL({...request, query: `SELECT
  name,
  total_rows,
  total_bytes
FROM system.tables
WHERE database = currentDatabase()`})).rows.map(([name, rowCount, sizeBytes]): TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
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
  const colResult = await sendSQL({...request, query: `SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable = 'YES',
  column_default
FROM information_schema.columns
WHERE table_name = '${tableName}' AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY ordinal_position`}); // TODO: pass tableName as arg
  const columns: ColumnInfo[] = colResult.rows.map(([name, typ, typename, nullable, defaultVal]) => ({
    name: name as string,
    typename: typename as string,
    type: typ as ColumnType, // TODO: map
    nullable: nullable as boolean,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));

  // Get constraints
  const conResult = await sendSQL({...request, query: `SELECT
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
WHERE rel.relname = '${tableName}' AND nsp.nspname NOT IN ('pg_catalog', 'information_schema')`}); // TODO: pass tableName as arg
  const constraints: ConstraintInfo[] = conResult.rows.map(([name, typ, def]) => ({
    name: name as string,
    type: typ as string,
    definition: stripLeadingColumns(def as string, typ as string),
    columns: parseConstraintColumns(def as string, typ as string, columns.map(c => c.name)),
  }));

  // Get indexes
  const idxResult = await sendSQL({...request, query: `SELECT idx.indexname, idx.indexdef
FROM pg_indexes idx
WHERE idx.tablename = '${tableName}' AND idx.schemaname NOT IN ('pg_catalog', 'information_schema')`}); // TODO: pass tableName as arg
  const indexes: IndexInfo[] = idxResult.rows.map(([name, def]) => ({
    name: name as string,
    definition: def as string,
  }));

  // Get foreign keys. Referenced table/schema and update/delete rules come
  // straight from pg_constraint; the column lists are parsed from the raw
  // definition (FOREIGN KEY (...) REFERENCES ref (...)).
  const fkActions: Record<string, string> = {a: "NO ACTION", r: "RESTRICT", c: "CASCADE", n: "SET NULL", d: "SET DEFAULT"};
  const fkResult = await sendSQL({...request, query: `SELECT
  con.conname,
  con.confupdtype,
  con.confdeltype,
  ref_ns.nspname,
  ref.relname,
  pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
JOIN pg_class ref ON ref.oid = con.confrelid
JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
WHERE con.contype = 'f' AND rel.relname = '${tableName}' AND nsp.nspname NOT IN ('pg_catalog', 'information_schema')`}); // TODO: pass tableName as arg
  const foreignKeys: ForeignKey[] = fkResult.rows.map(([name, upd, del, schema, table, def]) => {
    const refPart = String(def).split("REFERENCES")[1] ?? "";
    return {
      name: String(name),
      column: parseConstraintColumns(String(def), "FOREIGN KEY", columns.map(c => c.name)).join(", "),
      schema: String(schema),
      table: String(table),
      to: refPart.slice(refPart.indexOf("(") + 1, refPart.indexOf(")")).trim(),
      onUpdate: fkActions[String(upd)] ?? "NO ACTION",
      onDelete: fkActions[String(del)] ?? "NO ACTION",
    };
  });

  return {columns, constraints, foreign_keys: foreignKeys, indexes};
}

async function describeMySQL(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await sendSQL({...request, query: `SELECT
  column_name,
  column_type,
  is_nullable = 'YES',
  column_default
FROM information_schema.columns
WHERE table_name = '${tableName}' AND table_schema = DATABASE()
ORDER BY ordinal_position`});
  const columns: ColumnInfo[] = colResult.rows.map(([name, typ, nullable, defaultVal]) => ({
    name: name as string,
    typename: typ as string,
    type: typ as ColumnType,
    nullable: nullable as boolean,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));

  // Get constraints (simplified - PRIMARY KEY only). key_column_usage has one
  // row per PK column; ordinal_position restores composite key order, so the
  // whole key is returned as a single ordered entry.
  const constraints: ConstraintInfo[] = [];
  try {
    const conResult = await sendSQL({...request, query: `SELECT
  column_name
FROM information_schema.key_column_usage
WHERE table_name = '${tableName}' AND table_schema = DATABASE() AND constraint_name = 'PRIMARY'
ORDER BY ordinal_position`}); // TODO: pass tableName as arg
    const pkColumns = conResult.rows.map(r => String(r[0]));
    if (pkColumns.length > 0)
      constraints.push({name: "PRIMARY KEY", type: "PRIMARY KEY", definition: "PRIMARY KEY", columns: pkColumns});
  } catch (_e) {
    // Constraints query is best-effort
  }

  // Get foreign keys (one row per column pair; ordinal_position keeps
  // composite keys ordered). rc carries the update/delete rules, kcu the
  // referenced table/schema/columns.
  const foreign_keys: ForeignKey[] = [];
  try {
    const fkResult = await sendSQL({...request, query: `SELECT
  kcu.constraint_name,
  kcu.column_name,
  kcu.referenced_table_schema,
  kcu.referenced_table_name,
  kcu.referenced_column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = kcu.constraint_schema AND rc.constraint_name = kcu.constraint_name
WHERE kcu.table_name = '${tableName}' AND kcu.table_schema = DATABASE() AND kcu.referenced_table_name IS NOT NULL
ORDER BY kcu.constraint_name, kcu.ordinal_position`}); // TODO: pass tableName as arg
    for (const r of fkResult.rows) {
      foreign_keys.push({
        name: String(r[0]),
        column: String(r[1]),
        schema: String(r[2]),
        table: String(r[3]),
        to: String(r[4]),
        onUpdate: String(r[5]),
        onDelete: String(r[6]),
      });
    }
  } catch (_e) {
    // Foreign keys query is best-effort
  }

  // TODO: Get indexes
  return {columns, constraints, foreign_keys, indexes: []};
}

async function describeSQLite(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  const columns: ColumnInfo[] = [];
  const constraints: ConstraintInfo[] = [];

  // Get columns via PRAGMA table_info (returns: cid, name, type, notnull, dflt, pk)
  const colResult = await sendSQL({...request, query: `PRAGMA table_info('${tableName}')`});
  const pkRows: {name: string, pos: number}[] = [];
  for (const r of colResult.rows) {
    const name = String(r[1]);
    const typ = String(r[2]);
    const notnull = [1 as unknown, true, "1"].includes(r[3]);
    const defaultVal = JSON.stringify(r[4] ?? "");
    const pk = Number(r[5]); // 1-based position within a composite key

    columns.push({name, typename: typ, type: typ as ColumnType, nullable: !notnull, defaultValue: defaultVal});
    if (pk > 0)
      pkRows.push({name, pos: pk});
  }
  if (pkRows.length > 0) {
    const pkColumns = pkRows.sort((a, b) => a.pos - b.pos).map(r => r.name);
    constraints.push({name: "PRIMARY KEY", type: "PRIMARY KEY", definition: "PRIMARY KEY", columns: pkColumns});
  }

  // Get indexes
  const idxResult = await sendSQL({...request, query: `SELECT name, sql
FROM sqlite_master
WHERE type = 'index' AND tbl_name = '${tableName}'
ORDER BY name`}); // TODO: pass tableName as arg
  const indexes: IndexInfo[] = idxResult.rows.map(r => ({
    name: String(r[0]),
    definition: JSON.stringify(r[1] ?? ""),
  }));

  // Get foreign keys via PRAGMA foreign_key_list (returns: id, seq, table, from, to, on_update, on_delete, match).
  // SQLite FKs are anonymous and resolve within the same database, so name
  // and schema are empty; `to` is null for implicit-PK references.
  let foreign_keys: ForeignKey[] = [];
  try {
    const fkResult = await sendSQL({...request, query: `PRAGMA foreign_key_list('${tableName}')`});
    foreign_keys = fkResult.rows.map(r => ({name: "", column: String(r[3]), schema: "", table: String(r[2]), to: String((r[4] as string | null) ?? ""), onUpdate: String(r[5]), onDelete: String(r[6])}));
  } catch (_e) {
    // Foreign keys query is best-effort
  }

  return {columns, constraints, foreign_keys, indexes};
}

async function describeClickHouse(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await sendSQL({...request, query: `SELECT
  name,
  type,
  default_kind != '',
  default_expression
FROM system.columns
WHERE database = currentDatabase() AND table = '${tableName}'`});
  const columns: ColumnInfo[] = colResult.rows.map(r => ({
    name: String(r[0]),
    typename: String(r[1]),
    type: String(r[1]) as ColumnType,
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
}
