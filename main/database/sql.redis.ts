import * as t from "@/types.ts";
import {querySqlOverRedis} from "../redissql.ts";
import {buildTree, node, PlanLine} from "./sql_plan.ts";

// go-mysql-server has no session read-only switch over the redis bridge, so
// write statements are rejected by their leading keyword. This is a seatbelt,
// not a security boundary: the standalone SQL request kind runs without
// readOnly and reaches the engine unchecked (its tables reject writes anyway).
const writeKeywords = new Set([
  "INSERT", "UPDATE", "DELETE", "REPLACE",
  "CREATE", "DROP", "ALTER", "TRUNCATE", "RENAME",
  "GRANT", "REVOKE", "SET", "LOAD", "CALL", "KILL", "LOCK", "UNLOCK",
  "OPTIMIZE", "REPAIR", "FLUSH", "SHUTDOWN", "RESET", "PURGE",
  "START", "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE",
]);

function leadingKeyword(query: string): string {
  const stripped = query
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ")
    .trimStart();
  const match = /^[A-Za-z]+/.exec(stripped);
  return match === null ? "" : match[0].toUpperCase();
}

/** Map a go-mysql-server type name (e.g. "text", "bigint", "datetime") to a
 * column type for the UI. */
export function mapColumnType(typename: string): t.ColumnType {
  const ty = typename.toLowerCase();
  if (ty === "boolean" || ty === "bool") {
    return t.ColumnType.BOOLEAN;
  }
  if (ty === "datetime" || ty === "date" || ty === "timestamp") {
    return t.ColumnType.TIME;
  }
  if (ty.startsWith("enum(") || ty.startsWith("set(")) {
    return t.ColumnType.STRING;
  }
  if (ty.includes("json")) {
    return t.ColumnType.JSON;
  }
  if (ty.includes("int") || ty.includes("float") || ty.includes("double") || ty.includes("decimal")) {
    return t.ColumnType.NUMBER;
  }
  return t.ColumnType.STRING;
}

export async function send(request: t.SQLRequest): Promise<t.SQLResponse> {
  if ((request.readOnly ?? false) && writeKeywords.has(leadingKeyword(request.query))) {
    throw new Error(`write statements are rejected in read-only mode: ${leadingKeyword(request.query)}`);
  }

  const result = await querySqlOverRedis(request.dsn, request.query);
  return {
    columns: result.columns,
    typenames: result.typenames,
    types: result.typenames.map(mapColumnType),
    rows: result.rows,
  };
}

export async function sendBatch(request: Omit<t.SQLRequest, "query">, statements: string[]): Promise<t.SQLResponse> {
  // go-mysql-server has no transactions over the redis bridge; statements run
  // sequentially. Table editing is unreachable for redis (tables are read-only
  // projections of live redis data and describeRedis reports no constraints),
  // this is a safety net.
  for (const statement of statements) {
    await send({...request, query: statement});
  }
  return {columns: [], typenames: [], types: [], rows: []};
}

// EXPLAIN ANALYZE rides go-mysql-server's native EXPLAIN support (the mysql
// shim parses and plans it; no redis-specific engine code involved). The
// instrumented execution is safe: the engine's tables reject writes anyway.
export async function explain(request: t.SQLRequest): Promise<t.SQLExplain> {
  const result = await querySqlOverRedis(request.dsn, `EXPLAIN ANALYZE ${request.query}`);
  const raw = result.rows.map(row => row.map(String).join(" ")).join("\n");
  return {raw, plan: parsePlan(raw)};
}

export async function describe(request: Omit<t.SQLRequest, "query">, tableName: string): Promise<t.TableSchema> {
  // Redis tables are read-only projections of live redis data. Columns come
  // from the engine's information_schema; constraints and indexes are not
  // reported — a primary key would make the table viewer offer cell editing,
  // which the engine rejects ("table doesn't support UPDATE").
  const colResult = await send({...request, query: `SELECT
  column_name,
  column_type,
  is_nullable = 'YES',
  column_default
FROM information_schema.COLUMNS
WHERE table_name = '${tableName}' AND table_schema = DATABASE()
ORDER BY ordinal_position`});
  const columns: t.ColumnInfo[] = colResult.rows.map(([name, typ, nullable, defaultVal]): t.ColumnInfo => ({
    name: name as string,
    typename: typ as string,
    type: mapColumnType(typ as string),
    nullable: nullable === true,
    defaultValue: JSON.stringify(defaultVal ?? ""),
  }));
  return {columns, constraints: [], foreign_keys: [], indexes: []};
}

export async function listTables(request: Omit<t.SQLRequest, "query">): Promise<t.TableInfo[]> {
  // The engine's information_schema reports no row statistics for redis
  // tables, so counts are collected with one COUNT(*) per table; redis has
  // no per-table storage size.
  const tableNames = (await send({...request, query: `SELECT
  table_name
FROM information_schema.TABLES
WHERE table_schema = DATABASE()`})).rows.map(r => String(r[0]));
  const tables: t.TableInfo[] = [];
  for (const table of tableNames) {
    const rows = (await send({...request, query: `SELECT COUNT(*) FROM ${quoteIdent(table)}`})).rows;
    tables.push({name: table, rowCount: Number(rows[0]?.[0] ?? 0), sizeBytes: 0});
  }
  return tables;
}

export function quoteIdent(s: string): string {
  return "`" + s.replaceAll("`", "``") + "`";
}

// Box-drawing tree: operators like "Limit(5)" / "Project" with `├─`/`└─`
// markers (4-column indent steps); detail lines ("name: x", bare "(expr)")
// carry the same markers, so a content heuristic tells them apart. Without
// box characters (plain indented variant) the same heuristic applies with
// 2-space indents.
const GMS_ARROW = /^([\s│]*)([├└])(.*)$/;
const GMS_UNIT = 4;

export function parsePlan(raw: string): t.SQLPlan | undefined {
  const hasBox = /[│├└]/.test(raw);
  const unit = hasBox ? GMS_UNIT : 2;
  const lines: PlanLine[] = [];
  for (const line of raw.split("\n")) {
    if (line.trim() === "")
      continue;
    const arrow = GMS_ARROW.exec(line);
    const leading = arrow === null ? line.length - line.trimStart().length : arrow[1].length + 3;
    const text = arrow === null ? line.trim() : arrow[3].replace(/^─+/, "").trim();
    if (text === "")
      continue;
    if (gmsIsDetail(text)) {
      lines.push({operator: false, text});
      continue;
    }
    const open = text.indexOf("(");
    const title = open < 0 ? text : text.slice(0, open).trim();
    const n = node(title);
    if (open >= 0 && text.endsWith(")"))
      n.details.push(text.slice(open + 1, text.length - 1));
    n.kind = gmsKind(title);
    lines.push({operator: true, depth: Math.floor(leading / unit), n});
  }
  const plan = buildTree(lines);
  if (plan === undefined)
    return undefined;
  annotateGms(plan.root);
  collapseTableAlias(plan.root);
  return plan;
}

// Detail lines carry "key: value" info or bare parenthesized expressions;
// operators are capitalized node names with optional "(args)".
function gmsIsDetail(text: string): boolean {
  if (text.startsWith("("))
    return true;
  const colon = text.indexOf(":");
  const paren = text.indexOf("(");
  return colon >= 0 && (paren < 0 || colon < paren);
}

// "Table" nodes carry their real name as a "name: x" detail line; details are
// attached while building the tree, so tables are annotated afterwards.
function annotateGms(n: t.SQLPlanNode): void {
  n.table = gmsTableName(n);
  for (const child of n.children)
    annotateGms(child);
}

function gmsTableName(n: t.SQLPlanNode): string | undefined {
  if (n.title !== "Table")
    return undefined;
  const name = n.details.map(d => /^name:\s*(.+)$/.exec(d)).find(m => m !== null);
  return name === undefined ? undefined : name[1].trim();
}

function gmsKind(title: string): t.SQLPlanKind {
  if (/^Table/.test(title))
    return "scan";
  if (/Join|Lookup/.test(title))
    return "join";
  if (/^Filter|^Where/.test(title))
    return "filter";
  if (/^Sort/.test(title))
    return "sort";
  if (/^Limit/.test(title))
    return "limit";
  if (/^Project/.test(title))
    return "project";
  if (/^Union|^Intersect|^Except/.test(title))
    return "setop";
  if (/Aggregat/.test(title))
    return "aggregate";
  return "other";
}

// "TableAlias(h)" with a single "Table" child is presentation noise: merge
// into one scan node titled "Table h" carrying the real table name.
function collapseTableAlias(n: t.SQLPlanNode): void {
  for (const child of n.children)
    collapseTableAlias(child);
  if (n.title === "TableAlias" && n.children.length === 1 && n.children[0].title === "Table") {
    const alias = n.details[0] ?? "";
    const table = n.children[0];
    n.title = `Table ${alias}`;
    n.table = table.table ?? n.table;
    n.details = table.details;
    n.children = table.children;
  }
}
