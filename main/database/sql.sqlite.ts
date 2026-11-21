import Database from "better-sqlite3";
import {createClientPool} from "./connection_pool.ts";
import * as t from "@/types.ts";
import {node} from "./sql_plan.ts";

// Declared column type classified following SQLite's affinity rules
// (https://www.sqlite.org/datatype3.html#determination_of_column_affinity),
// with the user-facing specializations (BOOL/DATETIME/JSON) taking precedence
// over the affinity keywords they contain. Undefined when no rule matches.
export function declaredColumnType(declared: string | null): t.ColumnType | undefined {
  if (declared === null)
    return undefined;
  const up = declared.toUpperCase();
  if (up.includes("BOOL")) return t.ColumnType.BOOLEAN;
  if (up.includes("DATE") || up.includes("TIME")) return t.ColumnType.TIME;
  if (up.includes("JSON")) return t.ColumnType.JSON;
  if (up.includes("INT")) return t.ColumnType.NUMBER;
  if (up.includes("CHAR") || up.includes("CLOB") || up.includes("TEXT")) return t.ColumnType.STRING;
  if (up.includes("BLOB")) return t.ColumnType.STRING;
  if (up.includes("REAL") || up.includes("FLOA") || up.includes("DOUB")) return t.ColumnType.NUMBER;
  if (up.includes("DEC") || up.includes("NUM")) return t.ColumnType.NUMBER;
  return undefined;
}

// Value-shape fallback for columns without a declared type (expressions,
// subqueries); undefined for null-only columns, which end up UNKNOWN.
function valueColumnType(value: unknown): t.ColumnType | undefined {
  switch (typeof value) {
  case "number": return t.ColumnType.NUMBER;
  case "boolean": return t.ColumnType.BOOLEAN;
  case "string": return t.ColumnType.STRING;
  case "object": return value instanceof Date ? t.ColumnType.TIME : t.ColumnType.STRING;
  }
  return undefined;
}

// The readonly flag is part of connection identity: a read-only request must
// not ride a read-write connection (or vice versa).
const pool = createClientPool<Database.Database, {dsn: string, readonly: boolean}>({
  keyOf: t => `${t.readonly ? "ro:" : "rw:"}${t.dsn}`,
  connect: async t => new Database(t.dsn, {readonly: t.readonly}),
  close: async db => void db.close(), // better-sqlite3's close() returns `this`, discard it
});

export async function send(request: t.SQLRequest): Promise<t.SQLResponse> {
  return await pool.run({dsn: request.dsn, readonly: request.readOnly ?? false}, async db => {
    const stmt = db.prepare(request.query);
    const rows = stmt.all() as Record<string, unknown>[];
    const rowValues = rows.map(r => Object.values(r));
    // Statement metadata (names + declared types) is available even for empty
    // result sets; decltype is null for expression columns, which fall back to
    // the first non-null row value's shape, then UNKNOWN.
    const cols = stmt.reader ? stmt.columns() : [];
    const guessed = (i: number): t.ColumnType | undefined => {
      for (const row of rowValues)
        if (row[i] !== null && row[i] !== undefined) {
          const g = valueColumnType(row[i]);
          if (g !== undefined)
            return g;
        }
      return undefined;
    };
    const types = cols.map((c, i) => declaredColumnType(c.type) ?? guessed(i) ?? t.ColumnType.UNKNOWN);
    return {
      columns: cols.map(c => c.name),
      typenames: cols.map((c, i) => c.type ?? types[i]),
      types,
      rows: rowValues,
    };
  });
}

export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  return await pool.run({dsn: request.dsn, readonly: request.readOnly ?? false}, async db => {
    const affectedRows: number[] = [];
    // Synchronous body: better-sqlite3 ops never yield, so concurrent pool
    // callers cannot interleave inside the transaction.
    db.transaction(() => {
      // prepare().run() (not exec) so per-statement affected counts are available.
      for (const statement of statements)
        affectedRows.push(Number(db.prepare(statement).run().changes));
    })();
    return {columns: [], typenames: [], types: [], rows: [], affectedRows};
  });
}

// EXPLAIN QUERY PLAN never executes the statement, so it is safe for writes.
export async function explain(request: t.SQLRequest): Promise<t.SQLExplain> {
  return await pool.run({dsn: request.dsn, readonly: request.readOnly ?? false}, async db => {
    // id/parent links rebuild the plan tree; detail lines form the raw text.
    const rows = db.prepare(`EXPLAIN QUERY PLAN ${request.query}`).all() as {id: number, parent: number, detail: string}[];
    const raw = rows.map(r => r.detail).join("\n");
    const plan = parsePlan(rows.map(r => ({id: Number(r.id), parent: Number(r.parent), detail: String(r.detail)})));
    return {raw, plan};
  });
}

export async function describe(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema> {
  const columns: t.ColumnInfo[] = [];
  const constraints: t.ConstraintInfo[] = [];

  // Get columns via PRAGMA table_info (returns: cid, name, type, notnull, dflt, pk)
  const colResult = await send({...request, query: `PRAGMA table_info('${tableName}')`});
  const pkRows: {name: string, pos: number}[] = [];
  for (const r of colResult.rows) {
    const name = String(r[1]);
    const typ = String(r[2]);
    const notnull = [1 as unknown, true, "1"].includes(r[3]);
    const defaultVal = JSON.stringify(r[4] ?? "");
    const pk = Number(r[5]); // 1-based position within a composite key

    columns.push({name, typename: typ, type: declaredColumnType(typ) ?? t.ColumnType.UNKNOWN, nullable: !notnull, defaultValue: defaultVal});
    if (pk > 0)
      pkRows.push({name, pos: pk});
  }
  if (pkRows.length > 0) {
    const pkColumns = pkRows.sort((a, b) => a.pos - b.pos).map(r => r.name);
    constraints.push({name: "PRIMARY KEY", type: "PRIMARY KEY", definition: "PRIMARY KEY", columns: pkColumns});
  }

  const idxResult = await send({...request, query: `SELECT name, sql
FROM sqlite_master
WHERE type = 'index' AND tbl_name = '${tableName}'
ORDER BY name`}); // TODO: pass tableName as arg
  const indexes: t.IndexInfo[] = idxResult.rows.map(r => ({
    name: String(r[0]),
    definition: JSON.stringify(r[1] ?? ""),
  }));

  // Get foreign keys via PRAGMA foreign_key_list (returns: id, seq, table, from, to, on_update, on_delete, match).
  // SQLite FKs are anonymous and resolve within the same database, so name
  // and schema are empty; `to` is null for implicit-PK references.
  let foreign_keys: t.ForeignKey[] = [];
  try {
    const fkResult = await send({...request, query: `PRAGMA foreign_key_list('${tableName}')`});
    foreign_keys = fkResult.rows.map(r => ({name: "", column: String(r[3]), schema: "", table: String(r[2]), to: String((r[4] as string | null) ?? ""), onUpdate: String(r[5]), onDelete: String(r[6])}));
  } catch (_e) {
    // Foreign keys query is best-effort
  }

  return {columns, constraints, foreign_keys, indexes};
}

export async function listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]> {
  // Every per-table PRAGMA + count query rides the one pooled connection:
  // routing them through send() would pay a pool round trip each.
  return await pool.run({dsn: request.dsn, readonly: request.readOnly ?? false}, async db => {
    const tableNames = (db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Record<string, unknown>[]).map(r => String(r["name"]));
    return tableNames.map((table): t.TableInfo => {
      const colNames = (db.prepare(`PRAGMA table_info(${table})`).all() as Record<string, unknown>[]).map(r => String(Object.values(r)[1]));
      const lengthExpr = colNames.map(c => `COALESCE(LENGTH(${quoteIdent(c)}),0)`).join(" + ");
      const [rowCount, sizeBytes] = (db.prepare(`SELECT COUNT(*), COALESCE(SUM(${lengthExpr}), 0) FROM ${quoteIdent(table)}`).all() as Record<string, unknown>[]).map(r => Object.values(r))[0] ?? [];
      return {name: table, rowCount: Number(rowCount), sizeBytes: Number(sizeBytes)};
    });
  });
}

export function quoteIdent(s: string): string {
  return "`" + s + "`";
}

// One EXPLAIN QUERY PLAN row: `id`, `parent` (0 for roots) and the `detail`
// text. The tree is rebuilt from the parent links; sqlite emits a forest
// (flat join scans, co-routines), wrapped under one synthetic root.
export type PlanRow = {
  id: number,
  parent: number,
  detail: string,
};

export function parsePlan(rows: PlanRow[]): t.SQLPlan | undefined {
  if (rows.length === 0)
    return undefined;
  const byId = new Map<number, t.SQLPlanNode>();
  const roots: t.SQLPlanNode[] = [];
  for (const row of rows) {
    const parts = splitTitle(row.detail);
    const n = node(parts.label);
    n.kind = parsePlanKind(row.detail);
    if (parts.table !== undefined)
      n.table = parts.table;
    if (parts.index !== undefined)
      n.index = parts.index;
    byId.set(row.id, n);
    const parent = row.parent === 0 ? undefined : byId.get(row.parent);
    if (parent === undefined)
      roots.push(n);
    else
      parent.children.push(n);
  }
  if (roots.length === 0)
    return undefined;
  const root = roots.length === 1 ? roots[0] : node("Query plan");
  if (roots.length > 1)
    root.children.push(...roots);
  return {root};
}

// EQP details carry the access path inline:
// "SCAN t", "SEARCH t USING COVERING INDEX i (c=?)", "SCAN t VIRTUAL TABLE
// INDEX 1:M". `table` is the name after the operator; the USING descriptor
// becomes `index`, with any trailing constraint group kept in the label.
// Details without USING (virtual tables, subqueries) keep the full text.
function splitTitle(detail: string): {label: string, table?: string, index?: string} {
  const m = /^(?<head>SCAN|SEARCH)\s+(?<table>"[^"]*"|\S+)(?<rest>.*)$/.exec(detail);
  if (m === null)
    return {label: detail};
  const {head, table, rest} = m.groups!;
  const using = /^\s+USING\s+(?<index>.+?)(?<cond>\s*\([^()]*\))?$/.exec(rest);
  if (using === null)
    return {label: detail, table};
  const g: Record<string, string | undefined> = using.groups!;
  const {index, cond} = g;
  return {
    label: cond !== undefined ? `${head} ${cond.trim()}` : head,
    table,
    index: index!.trim(),
  };
}

function parsePlanKind(detail: string): t.SQLPlanKind {
  if (/^SEARCH\b/.test(detail))
    return "index";
  if (/^SCAN\b/.test(detail))
    return "scan";
  if (/SUBQUERY/i.test(detail))
    return "subquery";
  if (/^NESTED LOOP/.test(detail))
    return "join";
  if (/^USE TEMP B-TREE FOR (ORDER BY|GROUP BY)/.test(detail))
    return "sort";
  if (/^COMPOUND/.test(detail))
    return "setop";
  return "other";
}
