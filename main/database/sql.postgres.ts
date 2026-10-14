import pg from "pg";
import {TypeId, builtins as typeIDs} from "pg-types";
import {createClientPool} from "./connection_pool.ts";
import * as t from "@/types.ts";
import {buildTree, metricsFromGroups, node, PlanLine, splitMetricGroups} from "./sql_plan.ts";

// JS Date holds only millisecond precision, so pg's default parsing of date /
// timestamp columns into Date objects loses microseconds and shifts DATE across
// timezones. Table editing identifies rows by these values, so keep the raw
// server text, which round-trips exactly into UPDATE WHERE clauses.
pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v: string) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v: string) => v);

/*
SELECT t.oid::integer as typeid, t.typname as typename
FROM pg_type t
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'pg_catalog'
ORDER BY t.oid
*/
const pg_types: Partial<Record<TypeId, t.ColumnType>> = {
  [typeIDs.BOOL]: t.ColumnType.BOOLEAN,
  [typeIDs.INT8]: t.ColumnType.NUMBER,
  [typeIDs.INT4]: t.ColumnType.NUMBER,
  [19 as TypeId]: t.ColumnType.STRING,
  [typeIDs.TEXT]: t.ColumnType.STRING,
  [typeIDs.JSON]: t.ColumnType.JSON,
  [typeIDs.JSONB]: t.ColumnType.JSON,
  [typeIDs.DATE]: t.ColumnType.TIME,
  [typeIDs.TIME]: t.ColumnType.TIME,
  [typeIDs.TIMESTAMP]: t.ColumnType.TIME,
  [typeIDs.TIMESTAMPTZ]: t.ColumnType.TIME,
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

// Normalized connection string used as the pool key: schema-prefixed and
// carrying the libpq sslmode compatibility flag, so sslmode=require/prefer
// accept self-signed certs instead of pg's non-standard default that treats
// them as verify-full.
// TODO: parse dsn like host=localhost user=postgres password=password port=5432 dbname=postgres sslmode=disable
function dsnOf(dsn: string): string {
  const out = dsn.startsWith("postgres://") ? dsn : `postgres://${dsn}`;
  return out + (out.includes("?") ? "&" : "?") + "uselibpqcompat=true";
}

// Opens a fresh connection; shared by the pool and by sendBatch, which
// deliberately does not ride the pool: concurrent batches on one pooled
// connection could interleave statements inside a single transaction.
async function freshClient(dsn: string): Promise<pg.Client> {
  const client = new pg.Client({connectionString: dsn});
  try {
    await client.connect();
  } catch (err) {
    await client.end().catch(() => undefined); // release socket even if connection never established
    const e = err as Error & {code?: string};
    throw new Error(`postgres connection failed${e.code === undefined ? "" : ` (${e.code})`}: ${e.message}`);
  }
  return client;
}

const pool = createClientPool<pg.Client, string>({
  keyOf: dsn => dsn,
  connect: async dsn => {
    const client = await freshClient(dsn);
    client.on("error", () => pool.evict(dsn, client)); // dropped connection: drop the client, next request reconnects
    return client;
  },
  close: client => client.end(),
});

export async function send(request: t.SQLRequest): Promise<t.SQLResponse> {
  return await pool.run(dsnOf(request.dsn), async client => {
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
      types: fields.map((f): TypeId => f.dataTypeID).map(f => pg_types[f] ?? t.ColumnType.UNKNOWN), // "unknown ${f}" string breaks frontend icon lookup; TODO: use lib enum
      rows: result.rows.map(r => Object.values(r as Record<string, unknown>)),
    };
  });
}

export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  const client = await freshClient(dsnOf(request.dsn));
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

// EXPLAIN ANALYZE executes the query, so it runs on a dedicated connection
// inside an explicitly rolled-back transaction: effects of write queries are
// discarded (statements that cannot run in a transaction, like VACUUM, error
// out).
export async function explain(request: t.SQLRequest): Promise<t.SQLExplain> {
  const client = await freshClient(dsnOf(request.dsn));
  try {
    await client.query("BEGIN");
    try {
      const result = await client.query(`EXPLAIN ANALYZE ${request.query}`);
      // Text format returns one row per plan line.
      const raw = result.rows.map(row => String(Object.values(row as Record<string, unknown>)[0])).join("\n");
      if (raw === "")
        throw new Error("postgres explain returned no plan");
      return {raw, plan: parsePlan(raw)};
    } finally {
      await client.query("ROLLBACK").catch(() => undefined); // keep the original error
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

export async function describe(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema> {
  const colResult = await send({...request, query: `SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable = 'YES',
  column_default
FROM information_schema.columns
WHERE table_name = '${tableName}' AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY ordinal_position`}); // TODO: pass tableName as arg
  const columns: t.ColumnInfo[] = colResult.rows.map(([name, typ, typename, nullable, defaultVal]) => ({
    name: name as string,
    typename: typename as string,
    type: typ as t.ColumnType, // TODO: map
    nullable: nullable as boolean,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));

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
  const constraints: t.ConstraintInfo[] = conResult.rows.map(([name, typ, def]) => ({
    name: name as string,
    type: typ as string,
    definition: stripLeadingColumns(def as string, typ as string),
    columns: parseConstraintColumns(def as string, typ as string, columns.map(c => c.name)),
  }));

  const idxResult = await send({...request, query: `SELECT idx.indexname, idx.indexdef
FROM pg_indexes idx
WHERE idx.tablename = '${tableName}' AND idx.schemaname NOT IN ('pg_catalog', 'information_schema')`}); // TODO: pass tableName as arg
  const indexes: t.IndexInfo[] = idxResult.rows.map(([name, def]) => ({
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
  const foreignKeys: t.ForeignKey[] = fkResult.rows.map(([name, upd, del, schema, table, def]) => {
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

export async function listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]> {
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
    .map(([name, rowCount, sizeBytes]): t.TableInfo => ({
      name: name as string,
      rowCount: Number(rowCount),
      sizeBytes: Number(sizeBytes),
    }));
}

export function quoteIdent(s: string): string {
  return `"${s}"`;
}

// `EXPLAIN ANALYZE` text: the root line is bare, every other operator is
// marked with `->` and indented by 2 spaces per level; non-arrow lines are
// details of the preceding operator. Trailing "Planning Time"/"Execution
// Time"/JIT/Trigger lines are collected as root details.
export function parsePlan(raw: string): t.SQLPlan | undefined {
  const lines: PlanLine[] = [];
  const tail: string[] = [];
  let sawRoot = false;
  for (const line of raw.split("\n")) {
    if (line.trim() === "")
      continue;
    const arrow = /^(\s*)->\s+(.*)$/.exec(line);
    if (arrow !== null && tail.length === 0) {
      const {title, groups} = splitMetricGroups(arrow[2]);
      // Postgres indents the `->` markers in a 2/8/14/20... staircase (6
      // columns per level after the first).
      lines.push({operator: true, depth: Math.round((arrow[1].length + 4) / 6), n: toNode(title, groups)});
      sawRoot = true;
    } else if (!sawRoot) {
      // The root line is bare (no `->`); every other non-arrow line is a detail
      // of the preceding operator, until the trailing timing block.
      const {title, groups} = splitMetricGroups(line.trim());
      lines.push({operator: true, depth: 0, n: toNode(title, groups)});
      sawRoot = true;
    } else if (tail.length > 0 || /^(Planning Time|Execution Time|JIT|Trigger)/.test(line.trim()))
      tail.push(line.trim());
    else
      lines.push({operator: false, text: line.trim()});
  }
  const plan = buildTree(lines);
  if (plan === undefined)
    return undefined;
  plan.root.details.push(...tail);
  return plan;
}

function toNode(title: string, groups: string[]): t.SQLPlanNode {
  const parts = splitTitle(title);
  const n = node(parts.label);
  n.metrics = metricsFromGroups(groups);
  // Kind is classified from the full title, before qualifiers are stripped
  // (e.g. the write kinds are keyed on the trailing "on <table>").
  n.kind = postgresKind(title);
  if (parts.table !== undefined)
    n.table = parts.table;
  if (parts.index !== undefined)
    n.index = parts.index;
  if (parts.alias !== undefined)
    n.alias = parts.alias;
  return n;
}

// Operator titles carry the scan qualifiers inline:
// "<head>[ using <index>] on <table>[ <alias>]" — metrics and detail lines
// are already split off, so a single trailing word after the table is always
// the alias. "Bitmap Index Scan on <x>" points at an index, not a table.
function splitTitle(title: string): {label: string, table?: string, index?: string, alias?: string} {
  const m = /^(?<head>.+?)(?:\s+using\s+(?<index>"[^"]*"|\S+))?(?:\s+on\s+(?<table>"[^"]*"|\S+))(?:\s+(?<alias>"[^"]*"|\S+))?$/.exec(title);
  if (m === null)
    return {label: title};
  const {head, index, table, alias} = m.groups!;
  if (head === "Bitmap Index Scan")
    return {label: head, index: table};
  return {label: head, table, index, alias};
}

function postgresKind(title: string): t.SQLPlanKind {
  if (/Index (Scan|Only Scan)|Bitmap Index Scan|Tid Scan/.test(title))
    return "index";
  if (/^(Seq Scan|Bitmap Heap Scan|Sample Scan)/.test(title))
    return "scan";
  if (/^(CTE Scan|WorkTable Scan|Subquery Scan|Named Tuplestore Scan)/.test(title))
    return "subquery";
  if (/Join|Nested Loop/.test(title))
    return "join";
  if (/Sort/.test(title))
    return "sort";
  if (/Aggregate/.test(title))
    return "aggregate";
  if (/^Limit/.test(title))
    return "limit";
  if (/^(Insert|Update|Delete|Merge) on/.test(title))
    return "write";
  if (/^(HashSetOp|SetOp|Recursive Union|Append|MergeAppend)/.test(title))
    return "setop";
  if (/^ProjectSet/.test(title))
    return "project";
  return "other";
}
