import mysql, {type Connection, type ResultSetHeader} from "mysql2/promise.js";
import {createClientPool} from "./connection_pool.ts";
import * as t from "@/types.ts";
import {buildTree, metricsFromGroups, node, PlanLine, splitMetricGroups} from "./sql_plan.ts";

// dateStrings: keep DATETIME/TIMESTAMP as raw server text (µs precision) —
// table editing identifies rows by these values, and JS Date would truncate them.
function connect(dsn: string) {
  return mysql.createConnection({uri: dsn, dateStrings: true});
}

// Field metadata (column_definition packet fields consumed here).
type Field = {name: string, columnType?: number, characterSet?: number, extendedTypeName?: string};

// MySQL protocol column type ids (mysql_com.h) with display typenames and UI
// column kinds; unknown ids (future types) degrade to "unknown"/UNKNOWN.
const protocolTypes: Record<number, {typename: string, type: t.ColumnType}> = {
  0: {typename: "decimal", type: t.ColumnType.NUMBER}, // DECIMAL
  1: {typename: "tinyint", type: t.ColumnType.NUMBER}, // TINY
  2: {typename: "smallint", type: t.ColumnType.NUMBER}, // SHORT
  3: {typename: "int", type: t.ColumnType.NUMBER}, // LONG
  4: {typename: "float", type: t.ColumnType.NUMBER}, // FLOAT
  5: {typename: "double", type: t.ColumnType.NUMBER}, // DOUBLE
  6: {typename: "null", type: t.ColumnType.UNKNOWN}, // NULL
  7: {typename: "timestamp", type: t.ColumnType.TIME}, // TIMESTAMP
  8: {typename: "bigint", type: t.ColumnType.NUMBER}, // LONGLONG
  9: {typename: "mediumint", type: t.ColumnType.NUMBER}, // INT24
  10: {typename: "date", type: t.ColumnType.TIME}, // DATE
  11: {typename: "time", type: t.ColumnType.TIME}, // TIME
  12: {typename: "datetime", type: t.ColumnType.TIME}, // DATETIME
  13: {typename: "year", type: t.ColumnType.NUMBER}, // YEAR
  14: {typename: "date", type: t.ColumnType.TIME}, // NEWDATE
  15: {typename: "varchar", type: t.ColumnType.STRING}, // VARCHAR
  16: {typename: "bit", type: t.ColumnType.NUMBER}, // BIT
  242: {typename: "vector", type: t.ColumnType.UNKNOWN}, // VECTOR
  245: {typename: "json", type: t.ColumnType.JSON}, // JSON
  246: {typename: "decimal", type: t.ColumnType.NUMBER}, // NEWDECIMAL
  247: {typename: "enum", type: t.ColumnType.STRING}, // ENUM
  248: {typename: "set", type: t.ColumnType.STRING}, // SET
  249: {typename: "tinyblob", type: t.ColumnType.STRING}, // TINY_BLOB
  250: {typename: "mediumblob", type: t.ColumnType.STRING}, // MEDIUM_BLOB
  251: {typename: "longblob", type: t.ColumnType.STRING}, // LONG_BLOB
  252: {typename: "text", type: t.ColumnType.STRING}, // BLOB
  253: {typename: "varchar", type: t.ColumnType.STRING}, // VAR_STRING
  254: {typename: "char", type: t.ColumnType.STRING}, // STRING
  255: {typename: "geometry", type: t.ColumnType.UNKNOWN}, // GEOMETRY
};

export function columnMeta(field: Field): {typename: string, type: t.ColumnType} {
  const base = protocolTypes[field.columnType ?? -1] ?? {typename: "unknown", type: t.ColumnType.UNKNOWN};
  const typename = (() => {
    // MariaDB ships real types (uuid, inet4, ...) only in the extended metadata
    // block; on the wire they look like plain string/blob columns.
    if (field.extendedTypeName !== undefined)
      return field.extendedTypeName;
    // The protocol does not distinguish TEXT from BLOB (nor CHAR from BINARY,
    // VARCHAR from VARBINARY); charset 63 (binary) marks the byte variants.
    if (field.characterSet === 63) {
      if (field.columnType === 252) return "blob";
      if (field.columnType === 253) return "varbinary";
      if (field.columnType === 254) return "binary";
    }
    return base.typename;
  })();
  return {typename, type: base.type};
}

// information_schema data_type names share the protocol typenames, except the
// binary-charset variants (columnMeta derives those from the charset, not the
// type id) and the sized text family; anything exotic degrades to unknown.
const dataTypeKinds: Record<string, t.ColumnType> = {
  ...Object.fromEntries(Object.values(protocolTypes).map(v => [v.typename, v.type])),
  binary: t.ColumnType.STRING,
  varbinary: t.ColumnType.STRING,
  tinytext: t.ColumnType.STRING,
  mediumtext: t.ColumnType.STRING,
  longtext: t.ColumnType.STRING,
  uuid: t.ColumnType.STRING,
  inet4: t.ColumnType.STRING,
  inet6: t.ColumnType.STRING,
};

export function dataTypeMeta(name: string): t.ColumnType {
  return dataTypeKinds[name] ?? t.ColumnType.UNKNOWN;
}

const pool = createClientPool<Connection, string>({
  keyOf: dsn => dsn,
  connect: async dsn => {
    const connection = await connect(dsn);
    // The session's transaction read-only mode is reset in every op's finally;
    // a dropped connection errors the next op, which evicts the client.
    connection.on("error", () => pool.evict(dsn, connection));
    return connection;
  },
  close: connection => connection.end(),
});

export async function send(request: t.SQLRequest, params?: t.SQLParam[]): Promise<t.SQLResponse> {
  return await pool.run(request.dsn, async connection => {
    try {
      if (request.readOnly ?? false)
        await connection.execute("SET SESSION TRANSACTION READ ONLY");
      const result = await connection.execute(request.query, params) as [unknown, Field[] | undefined];
      if (!Array.isArray(result[0])) {
        // Writes and DDL resolve to a stats packet with no result-set metadata.
        return {columns: [], typenames: [], types: [], rows: []};
      }
      const [rows, fields] = result as [Record<string, unknown>[], Field[]];
      const meta = fields.map(columnMeta);
      return {
        columns: fields.map(f => f.name),
        typenames: meta.map(m => m.typename),
        types: meta.map(m => m.type),
        rows: rows.map(r => Object.values(r)),
      };
    } finally {
      if (request.readOnly ?? false)
        await connection.execute("SET SESSION TRANSACTION READ WRITE").catch(() => undefined); // keep the original error
    }
  });
}

export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  // Deliberately not pooled: concurrent batches sharing one connection could
  // interleave statements inside a single transaction.
  const connection = await connect(request.dsn);
  try {
    if (request.readOnly ?? false)
      await connection.execute("SET SESSION TRANSACTION READ ONLY");
    await connection.beginTransaction();
    try {
      // mysql2 prepared `execute` cannot run arbitrary statement batches; use plain query.
      const affectedRows: number[] = [];
      for (const statement of statements) {
        const [result] = await connection.query(statement);
        affectedRows.push((result as ResultSetHeader).affectedRows);
      }
      await connection.commit();
      return {columns: [], typenames: [], types: [], rows: [], affectedRows};
    } catch (err) {
      await connection.rollback().catch(() => undefined); // keep the original error
      throw err;
    }
    return {columns: [], typenames: [], types: [], rows: []};
  } finally {
    if (request.readOnly ?? false)
      await connection.execute("SET SESSION TRANSACTION READ WRITE").catch(() => undefined); // keep the original error
    await connection.end();
  }
}

// EXPLAIN ANALYZE executes the statement on the pooled session (mysql has no
// read-only switch that composes with it), so effects of write queries persist
// exactly as when running the query from the editor.
export async function explain(request: t.SQLRequest): Promise<t.SQLExplain> {
  return await pool.run(request.dsn, async connection => {
    // mysql2 prepared `execute` rejects EXPLAIN ANALYZE; use plain query.
    const [rows] = await connection.query(`EXPLAIN ANALYZE ${request.query}`) as [{[column: string]: string}[], unknown];
    const raw = rows.map(r => Object.values(r).join(" ")).join("\n");
    return {raw, plan: parsePlan(raw)};
  });
}

export async function describe(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema> {
  const colResult = await send({...request, query: `SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = ? AND table_schema = DATABASE()
ORDER BY ordinal_position`}, [tableName]);
  const columns: t.ColumnInfo[] = colResult.rows.map(([name, typ, nullable, defaultVal]) => ({
    name: name as string,
    typename: typ as string,
    type: dataTypeMeta(typ as string),
    nullable: nullable === "YES",
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));

  // Get constraints (simplified - PRIMARY KEY only). key_column_usage has one
  // row per PK column; ordinal_position restores composite key order, so the
  // whole key is returned as a single ordered entry.
  const constraints: t.ConstraintInfo[] = [];
  try {
    const conResult = await send({...request, query: `SELECT
  column_name
FROM information_schema.key_column_usage
WHERE table_name = ? AND table_schema = DATABASE() AND constraint_name = 'PRIMARY'
ORDER BY ordinal_position`}, [tableName]);
    const pkColumns = conResult.rows.map(r => String(r[0]));
    if (pkColumns.length > 0)
      constraints.push({name: "PRIMARY KEY", type: "PRIMARY KEY", definition: "PRIMARY KEY", columns: pkColumns});
  } catch (_e) {
    // Constraints query is best-effort
  }

  // Get foreign keys (one row per column pair; ordinal_position keeps
  // composite keys ordered). rc carries the update/delete rules, kcu the
  // referenced table/schema/columns.
  const foreign_keys: t.ForeignKey[] = [];
  try {
    const fkResult = await send({...request, query: `SELECT
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
WHERE kcu.table_name = ? AND kcu.table_schema = DATABASE() AND kcu.referenced_table_name IS NOT NULL
ORDER BY kcu.constraint_name, kcu.ordinal_position`}, [tableName]);
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

  // Index definitions are reconstructed from statistics: one row per indexed
  // column, seq_in_index restores composite order. Functional key parts
  // (column_name null on MySQL 8+) carry no reconstructable column here.
  const idxResult = await send({...request, query: `SELECT
  index_name,
  non_unique,
  index_type,
  column_name,
  sub_part
FROM information_schema.statistics
WHERE table_name = ? AND table_schema = DATABASE()
ORDER BY index_name, seq_in_index`}, [tableName]);
  const idxGroups = new Map<string, {unique: boolean, indexType: string, columns: string[]}>();
  for (const [name, nonUnique, indexType, column, subPart] of idxResult.rows) {
    const key = String(name);
    // statistics reports NON_UNIQUE (0 = unique); PRIMARY and other unique
    // indexes render as CREATE UNIQUE INDEX.
    const group = idxGroups.get(key) ?? {unique: Number(nonUnique) === 0, indexType: String(indexType), columns: []};
    group.columns.push(typeof column === "string" ? column + (subPart === null ? "" : `(${Number(subPart)})`) : "?");
    idxGroups.set(key, group);
  }
  const indexes: t.IndexInfo[] = [...idxGroups.entries()].map(([name, group]) => ({
    name,
    definition: `CREATE${group.unique ? " UNIQUE" : ""} INDEX ${quoteIdent(name)} ON ${quoteIdent(tableName)} (${group.columns.join(", ")}) USING ${group.indexType}`,
  }));

  return {columns, constraints, foreign_keys, indexes};
}

export async function listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]> {
  const dbName = (await send({...request, query: "SELECT DATABASE()"})).rows[0][0] as string;
  const tablesResult = await send({...request, query: `SELECT
table_name,
table_rows,
data_length + index_length
FROM information_schema.TABLES
WHERE table_schema = ?`}, [dbName]);
  return tablesResult.rows.map(([name, rowCount, sizeBytes]): t.TableInfo => ({name: name as string, rowCount: rowCount as number, sizeBytes: sizeBytes as number}));
}

export function quoteIdent(s: string): string {
  return "`" + s.replaceAll("`", "``") + "`";
}

// `EXPLAIN ANALYZE` tree format: one `->` line per operator, indented a fixed
// number of spaces per level (varies between mysql versions, detected as the
// smallest nonzero indent). Everything sits on the operator line.
export function parsePlan(raw: string): t.SQLPlan | undefined {
  const lines = raw.split("\n").filter(l => l.trim() !== "");
  const indents = lines
    .map(l => /^(\s*)->\s+/.exec(l))
    .filter(m => m !== null)
    .map(m => m[1].length)
    .filter(n => n > 0);
  if (indents.length === 0 && !/^(\s*)->\s+/.test(lines[0] ?? ""))
    return undefined; // traditional tabular format or garbage
  const unit = indents.length === 0 ? 1 : Math.min(...indents);
  const parsed: PlanLine[] = [];
  for (const line of lines) {
    const arrow = /^(\s*)->\s+(.*)$/.exec(line);
    if (arrow === null) {
      parsed.push({operator: false, text: line.trim()});
      continue;
    }
    const {title, groups} = splitMetricGroups(arrow[2]);
    const parts = splitTitle(title);
    const n = node(parts.label);
    n.metrics = metricsFromGroups(groups);
    n.kind = mysqlKind(title);
    if (parts.table !== undefined)
      n.table = parts.table;
    if (parts.index !== undefined)
      n.index = parts.index;
    parsed.push({operator: true, depth: Math.floor(arrow[1].length / unit), n});
  }
  return buildTree(parsed);
}

// Operator titles carry the scan qualifiers inline:
// "<head> on <table>[ using <index>][ (<cond>)]". Conditions are not
// qualifiers and stay in the label. MySQL prints the alias, when any, in
// place of the table name, so it cannot be reported separately.
function splitTitle(title: string): {label: string, table?: string, index?: string} {
  const m = /^(?<head>.+?)\s+on\s+(?<table>\S+)(?:\s+using\s+(?<index>\S+))?(?<cond>\s*\(.*\))?$/.exec(title);
  if (m === null)
    return {label: title};
  const g: Record<string, string | undefined> = m.groups!;
  const head = g["head"]!;
  const {index, table, cond} = g;
  return {label: cond !== undefined ? `${head}${cond}` : head, table, index};
}

function mysqlKind(title: string): t.SQLPlanKind {
  if (/join/i.test(title))
    return "join";
  if (/^Index (lookup|range scan|scan)|^(Primary|Secondary|Unique) (key|index)|^Covering index/.test(title))
    return "index";
  if (/^Table scan/.test(title))
    return "scan";
  if (/^Sort/.test(title))
    return "sort";
  if (/^Limit/.test(title))
    return "limit";
  if (/^Filter/.test(title))
    return "filter";
  if (/aggregate/i.test(title))
    return "aggregate";
  if (/^(Insert|Update|Delete)\b/.test(title))
    return "write";
  if (/^Union|^Duplicates elimination/.test(title))
    return "setop";
  return "other";
}
