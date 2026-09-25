import pg from "pg";
import {setTypeParser, TypeId, builtins as typeIDs} from "pg-types";
import {TableSchema, ColumnInfo, SQLRequest, ColumnType, SQLResponse, ConstraintInfo, IndexInfo, ForeignKey, TableInfo} from "@/types.ts";

// JS Date holds only millisecond precision, so pg's default parsing of date /
// timestamp columns into Date objects loses microseconds and shifts DATE across
// timezones. Table editing identifies rows by these values, so keep the raw
// server text, which round-trips exactly into UPDATE WHERE clauses.
setTypeParser(typeIDs.DATE, (v: string) => v);
setTypeParser(typeIDs.TIMESTAMP, (v: string) => v);
setTypeParser(typeIDs.TIMESTAMPTZ, (v: string) => v);

/*
SELECT t.oid::integer as typeid, t.typname as typename
FROM pg_type t
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'pg_catalog'
ORDER BY t.oid
*/
const pg_types: Partial<Record<TypeId, ColumnType>> = {
  [typeIDs.BOOL]: ColumnType.BOOLEAN,
  [typeIDs.INT8]: ColumnType.NUMBER,
  [typeIDs.INT4]: ColumnType.NUMBER,
  [19 as TypeId]: ColumnType.STRING,
  [typeIDs.TEXT]: ColumnType.STRING,
  [typeIDs.JSON]: ColumnType.JSON,
  [typeIDs.JSONB]: ColumnType.JSON,
  [typeIDs.DATE]: ColumnType.TIME,
  [typeIDs.TIME]: ColumnType.TIME,
  [typeIDs.TIMESTAMP]: ColumnType.TIME,
  [typeIDs.TIMESTAMPTZ]: ColumnType.TIME,
};
const pg_typenames: Partial<Record<TypeId, string>> = {
  [typeIDs.BOOL]: "bool",
  [typeIDs.INT8]: "int8",
  [typeIDs.INT4]: "int4",
  [19 as TypeId]: "name",
  [typeIDs.TEXT]: "text",
  [typeIDs.JSON]: "json",
  [typeIDs.JSONB]: "json",
  [typeIDs.DATE]: "date",
  [typeIDs.TIME]: "time",
  [typeIDs.TIMESTAMP]: "timestamp",
  [typeIDs.TIMESTAMPTZ]: "timestamptz",
};

export async function send(request: SQLRequest): Promise<SQLResponse> {
  let {dsn} = request;
  if (!dsn.startsWith("postgres://"))
    dsn = `postgres://${dsn}`;

  // Use libpq sslmode semantics so sslmode=require/prefer accept self-signed
  // certs instead of pg's non-standard default that treats them as verify-full.
  dsn += (dsn.includes("?") ? "&" : "?") + "uselibpqcompat=true";

  // TODO: parse dsn like host=localhost user=postgres password=password port=5432 dbname=postgres sslmode=disable
  const client = new pg.Client({connectionString: dsn});
  try {
    await client.connect();
  } catch (err) {
    await client.end().catch(() => undefined); // release socket even if connection never established
    const e = err as Error & {code?: string};
    throw new Error(`postgres connection failed${e.code === undefined ? "" : ` (${e.code})`}: ${e.message}`);
  }
  try {
    if (request.readOnly ?? false)
      await client.query("BEGIN READ ONLY");
    let result;
    try {
      result = await client.query(request.query);
    } finally {
      if (request.readOnly ?? false)
        await client.query("ROLLBACK").catch(() => undefined); // keep the original error
    }
    const fields = result.fields;
    return {
      columns: fields.map(f => f.name),
      typenames: fields.map((f): TypeId => f.dataTypeID).map(f => pg_typenames[f] ?? `${f}`), // TODO: fix number shit casting // TODO: use lib enum
      types: fields.map((f): TypeId => f.dataTypeID).map(f => pg_types[f] ?? ColumnType.UNKNOWN), // "unknown ${f}" string breaks frontend icon lookup; TODO: use lib enum
      rows: result.rows.map(r => Object.values(r as Record<string, unknown>)),
    };
  } finally {
    await client.end();
  }
}

export async function sendBatch(request: Omit<SQLRequest, "query">, statements: string[]): Promise<SQLResponse> {
  let {dsn} = request;
  if (!dsn.startsWith("postgres://"))
    dsn = `postgres://${dsn}`;
  dsn += (dsn.includes("?") ? "&" : "?") + "uselibpqcompat=true";

  const client = new pg.Client({connectionString: dsn});
  try {
    await client.connect();
  } catch (err) {
    await client.end().catch(() => undefined); // release socket even if connection never established
    const e = err as Error & {code?: string};
    throw new Error(`postgres connection failed${e.code === undefined ? "" : ` (${e.code})`}: ${e.message}`);
  }
  try {
    await client.query(request.readOnly ?? false ? "BEGIN READ ONLY" : "BEGIN");
    try {
      const affectedRows: number[] = [];
      for (const statement of statements) {
        const result = await client.query(statement);
        affectedRows.push(result.rowCount ?? 0);
      }
      await client.query("COMMIT");
      return {columns: [], typenames: [], types: [], rows: [], affectedRows};
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined); // keep the original error
      throw err;
    }
  } finally {
    await client.end();
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

export async function describe(request: Omit<SQLRequest, "query">, tableName: string): Promise<TableSchema> {
  // Get columns
  const colResult = await send({...request, query: `SELECT
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
  const conResult = await send({...request, query: `SELECT
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
  const idxResult = await send({...request, query: `SELECT idx.indexname, idx.indexdef
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
  const fkResult = await send({...request, query: `SELECT
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

export async function listTables(request: Omit<SQLRequest, "query">): Promise<TableInfo[]> {
  const tablesResult = await send({...request, query: `SELECT
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
