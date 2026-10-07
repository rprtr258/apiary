import {SQLRequest, SQLSourceRequest, TableRead, TableFilter, RowValue, CellUpdate, SQLResponse} from "@/types.ts";
import {describeTable, quoteIdent, sendSQL, sendSQLBatch} from "./sql.ts";

export const EmptyRequest: SQLSourceRequest = {
  dsn: ":memory:",
  database: "sqlite",
  readOnly: false,
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

// Parse the raw renderer-side filter value into a literal: numbers and
// true/false by content, anything else stays a string (quoted by sqlLiteral).
// Type mismatches surface as engine errors when the query runs.
function parseFilterValue(raw: string): RowValue {
  const n = Number(raw);
  if (!Number.isNaN(n))
    return n;
  const b = raw.trim().toLowerCase();
  if (["true", "false"].includes(b))
    return b === "true";
  return raw;
}

// WHERE condition for a table-viewer filter. Simple filters arrive with the
// raw value string and are parsed here into literal(s) (`in` splits the
// string on commas); manual filters embed the user's SQL condition verbatim —
// an invalid condition fails the query, which the viewer reports instead of
// updating the view.
export function buildFilterCondition(request: Omit<SQLRequest, "query">, filter: TableFilter): string {
  if (filter.kind === "manual")
    return `(${filter.expr})`;

  const column = quoteIdent[request.database](filter.column);

  if (filter.op === "is null")
    return `${column} IS NULL`;
  if (filter.op === "is not null")
    return `${column} IS NOT NULL`;

  if (filter.value === null)
    throw new Error(`filter operator "${filter.op}" requires a value`);

  if (filter.op === "in") {
    const values = filter.value.split(",").map(v => v.trim()).filter(v => v !== "");
    if (values.length === 0)
      throw new Error(`filter operator "in" requires at least one value`);
    return `${column} IN (${values.map(v => sqlLiteral(parseFilterValue(v))).join(", ")})`;
  }

  const value = sqlLiteral(parseFilterValue(filter.value));
  const op = {
    "like":     "LIKE",
    "not like": "NOT LIKE",
    "=":        "=",
    "!=":       "!=",
    "<":        "<",
    "<=":       "<=",
    ">":        ">",
    ">=":       ">=",
  }[filter.op]; 
  return `${column} ${op} ${value}`;
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

// Primary key columns of a table in key order, taken from the table schema.
// Used to pin the table viewer's pagination order. Empty for ClickHouse
// (describeTable returns no constraints, so no PK info is available).
export async function tablePrimaryKeyColumns(request: Omit<SQLRequest, "query">, tableName: string): Promise<string[]> {
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
  const where = read.filter !== null ? ` WHERE ${buildFilterCondition(request, read.filter)}` : "";
  return `SELECT * FROM ${q(read.table)}${where}${orderBy} LIMIT ${read.limit} OFFSET ${read.offset}`;
}

export async function countRowsSQLSource(request: Omit<SQLRequest, "query">, tableName: string, filter: TableFilter | null): Promise<number> {
  // Quote each part of schema-qualified names separately
  const q = quoteIdent[request.database];
  const quoted = tableName.split(".").map(q).join(".");
  const where = filter !== null ? ` WHERE ${buildFilterCondition(request, filter)}` : "";
  const result = await sendSQL({...request, query: `SELECT COUNT(*) FROM ${quoted}${where}`});
  return Number(result.rows[0]?.[0] ?? 0);
}

export async function testSQLSource(request: Omit<SQLRequest, "query">): Promise<void> {
  await sendSQL({...request, query: "SELECT 1"});
}
