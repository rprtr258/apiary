import {readFile, rename as renameFile, stat, writeFile} from "fs/promises";
import {nanoid} from "nanoid";
import * as t from "@/types.ts";
import v1, {KindEntry} from "./db.v1.ts";
import v2, {migration_v1_v2} from "./db.v2.ts";
import v3, {migration_v2_v3} from "./db.v3.ts";

export function generateID(): t.RequestID {
  return nanoid();
}

export type Request = {
  ID:        t.RequestID,
  Path:      string,
} & (
  | {Kind: t.Kind.HTTP} & {
    Data: t.HTTPRequest,
  }
  | {Kind: t.Kind.SQL} & {
    Data: t.SQLRequest,
  }
  | {Kind: t.Kind.JQ} & {
    Data: t.JQRequest,
  }
  | {Kind: t.Kind.MD} & {
    Data: t.MDRequest,
  }
  | {Kind: t.Kind.REDIS} & {
    Data: t.RedisRequest,
  }
  | {Kind: t.Kind.GRPC} & {
    Data: t.GRPCRequest,
  }
  | {Kind: t.Kind.DIFF} & {
    Data: t.DiffRequest,
  }
  | {Kind: t.Kind.SQLSource} & {
    Data: t.SQLSourceRequest,
  }
  | {Kind: t.Kind.HTTPSource} & {
    Data: t.HTTPSourceRequest,
  }
  | {Kind: t.Kind.MCP} & {
    Data: t.MCPRequest,
  }
);

export type DB = {
  requests: Record<t.RequestID, Request>,
  // Draft membership (id -> cosmetic "draft N" number); serialized to the v1
  // "drafts" section.
  drafts: Record<t.RequestID, number>,
  // Manual sidebar order per directory (see db.v3.ts); omitted dirs fall back
  // to name-sorted children.
  tree: Record<string, t.TreeChild[]>,
};

export function extractSubKind(
  j: DB,
  id: t.RequestID,
): string {
  const entry = j.requests[id];
  switch (entry.Kind) {
    case t.Kind.HTTP:
      return entry.Data.method;
    case t.Kind.SQL:
      return entry.Data.database;
    case t.Kind.SQLSource:
      return entry.Data.database;
    // case t.Kind.HTTPSource: // TODO: swagger version
    case t.Kind.MCP:
      return entry.Data.transport;
    default:
      return "";
  }
}

// Location of db.json; defaults to cwd (scripts, tests). The Electron main process
// points it at the per-user app data dir via setDBPath.
let dbPath = "db.json";

// Persistence is debounced: save() marks the state dirty and schedules a
// single write (SAVE_DEBOUNCE_MS after the first unsaved mutation), so bursts
// of queued mutations coalesce into one disk write. `cached` is the source of
// truth between writes - re-reading the lagging file would hand the next
// queued mutation stale contents and silently drop the pending ones.
// db.json can also be rewritten behind the app's back (e2e reseeding between
// tests reuses one app process; hand edits): the cache revalidates against the
// file mtime on every load(), and the file always wins - a cache miss drops
// also any not-yet-persisted in-memory mutations instead of clobbering the
// external state.
const SAVE_DEBOUNCE_MS = 300;
let cached: DB | null = null;
// null = the file is known to be absent (or never read); a number is the mtime
// the cache was built from, so the post-ENOENT cache stays valid (null === null)
// against the still-missing file.
let cachedMtimeMs: number | null = null;
let pendingSave: DB | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function statMtimeMs(p: string): Promise<number | null> {
  try {
    return (await stat(p)).mtimeMs;
  } catch {
    return null;
  }
}

export function setDBPath(p: string): void {
  dbPath = p;
  // Switching files invalidates in-memory state and any write scheduled for
  // the old one (production calls this once at startup, before any load).
  cached = null;
  cachedMtimeMs = null;
  pendingSave = null;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

// db.ts persists by whole-file load-modify-save: two concurrent operations
// interleave at their await boundaries and the last save() silently overwrites
// the other's changes (lost records, duplicated draft numbers). Mutating
// operations therefore run one-at-a-time behind this queue; read-only access
// reads the in-memory state and stays unqueued.
let dbQueue: Promise<void> = Promise.resolve();
export function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = dbQueue.then(fn);
  dbQueue = run.then(() => undefined, () => undefined);
  return run;
}

const LAST_VERSION = 3;
type LAST_V = v3;

// Parse db.json and run pending migrations in memory; wasOldVersion reports
// whether the file still needs persisting to reach the current version.
async function loadParsed(raw: Record<string, unknown>): Promise<LAST_V> {
  // Files from before versioning count as v1
  const version = typeof raw.$version === "number" && raw.$version >= 1 ? raw.$version : 1;
  if (version > LAST_VERSION) {
    throw new Error(`db.json was written by a newer apiary version ($version ${version}, this build understands up to ${LAST_VERSION})`);
  }
  let migrated: Record<string, unknown> = raw;
  if (version === 1) migrated = migration_v1_v2(migrated as unknown as v1);
  if (version <= 2) migrated = migration_v2_v3(migrated as unknown as v2);

  return migrated as LAST_V;
}

export async function load(): Promise<DB> {
  const mtime = await statMtimeMs(dbPath);
  if (cached !== null && mtime === cachedMtimeMs)
    return cached;
  // The file moved since our last write (e2e reseeding between tests, hand
  // edits): external state wins - drop the cache and any scheduled write of
  // stale in-memory state so it cannot land on top of the new file.
  cached = null;
  pendingSave = null;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  let b: Buffer;
  try {
    b = await readFile(dbPath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cached = {requests: {}, drafts: {}, tree: {}};
      cachedMtimeMs = null;
      await save(cached);
      return cached;
    }
    throw err;
  }
  const raw = await loadParsed(JSON.parse(b.toString()) as Record<string, unknown>);
  const requests = Object.fromEntries((raw.request ?? []).map(r => [r.id, (() => {
    const kind: Pick<Request, "Data"> = (() => {
      switch (r.kind) {
      case t.Kind.HTTP:
        const req = raw[r.kind][r.id];
        return {
          Data: req.request,
        };
      case t.Kind.SQL:
        return {
          Data: raw[r.kind][r.id].request,
        };
      case t.Kind.JQ:
        return {
          Data: raw[r.kind][r.id].request,
        };
      case t.Kind.MD:
        return {
          Data: raw[r.kind][r.id].request,
        };
      case t.Kind.REDIS:
        return {
          Data: raw[r.kind][r.id].request,
        };
      case t.Kind.GRPC:
        return {
          Data: raw[r.kind][r.id].request,
        };
      case t.Kind.DIFF:
        return {
          Data: raw[r.kind][r.id].request,
        };
      case t.Kind.SQLSource: {
        const src = raw[r.kind][r.id] as unknown as {database: t.Database, dsn: string, readOnly?: boolean};
        return {
          Data: {...src, readOnly: src.readOnly ?? false},
        };
      }
      case t.Kind.HTTPSource:
        return {
          Data: raw[r.kind][r.id],
        };
      case t.Kind.MCP:
        return {
          Data: raw[r.kind][r.id],
        };
      }
    })();

    return {
      ID: r.id,
      Path: r.path,
      Kind: r.kind,
      ...kind,
    } as Request;
  })()]));
  // Drop section entries whose record vanished (hand-edited files); the section is
  // authoritative for draft-ness, a missing record is not a usable draft.
  const db: DB = {
    requests,
    drafts: Object.fromEntries((raw.drafts).filter(d => d.id in requests).map(d => [d.id, d.n])),
    tree: pruneTree({requests, drafts: {}, tree: raw.tree}).tree,
  };
  cached = db;
  cachedMtimeMs = mtime;
  return db;
}

// Children of a directory as implied by request paths: request ids stored
// directly under it, and immediate subdirectory names. A request whose path
// equals a directory path is a sibling of that directory's children, not one
// of them. Drafts live outside the tree and are skipped.
export function childrenOf(j: DB, dir: string): {ids: Set<t.RequestID>, dirs: Set<string>} {
  const prefix = dir === "" ? "" : dir + "/";
  const ids = new Set<t.RequestID>();
  const dirs = new Set<string>();
  for (const req of Object.values(j.requests)) {
    if (req.ID in j.drafts || !req.Path.startsWith(prefix))
      continue;
    const rest = req.Path.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash === -1)
      ids.add(req.ID);
    else
      dirs.add(rest.slice(0, slash));
  }
  return {ids, dirs};
}

// Drop tree-order entries whose request/dir no longer exists (renames,
// deletes, hand-edited files) and sections that became empty; the overlay
// never carries information of its own.
function pruneTree(j: DB): DB {
  for (const dir of Object.keys(j.tree)) {
    const {ids, dirs} = childrenOf(j, dir);
    const kept = j.tree[dir].filter(e => "r" in e ? ids.has(e.r) : dirs.has(e.d));
    if (kept.length === 0)
      delete j.tree[dir];
    else
      j.tree[dir] = kept;
  }
  return j;
}

// Marks the db dirty and ensures one debounced write is scheduled (later
// saves within the window are covered by it, and the write serializes the
// state as of fire time). Resolves before the disk write happens - call
// flushSave() when durability is needed now (quit, tests).
export async function save(j: DB): Promise<void> {
  pendingSave = j;
  if (saveTimer !== null)
    return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const toWrite = pendingSave;
    pendingSave = null;
    if (toWrite !== null) {
      // Route the write through the mutation queue so a slow disk write can
      // never overlap the next scheduled one and tear db.json.
      void serialized(() => saveNow(toWrite)).catch((err: unknown) => {
        console.error("failed to persist db.json:", err);
      });
    }
  }, SAVE_DEBOUNCE_MS);
}

async function saveNow(j: DB): Promise<void> {
  // Belt-and-braces for the load() rule above: if the managed state's file
  // was rewritten externally between the last load() and this write, decline
  // instead of clobbering it (the next load() picks the external state up).
  const mtime = await statMtimeMs(dbPath);
  if (j === cached && mtime !== null && mtime !== cachedMtimeMs)
    return;
  const raw: v3 = {
    $version: 3,
    tree: Object.fromEntries(Object.entries(j.tree).filter(([_dir, entries]) => entries.length > 0)),
    request: Object.values(j.requests).map(r => ({
      id: r.ID,
      kind: r.Kind,
      path: r.Path,
    })),
    drafts: Object.entries(j.drafts).map(([id, n]) => ({id, n})),
    http: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.HTTP).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.HTTPRequest>])),
    sql: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.SQL).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.SQLRequest>])),
    jq: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.JQ).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.JQRequest>])),
    md: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.MD).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.MDRequest>])),
    redis: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.REDIS).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.RedisRequest>])),
    grpc: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.GRPC).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.GRPCRequest>])),
    diff: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.DIFF).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.DiffRequest>])),
    "http-source": Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.HTTPSource).map(([id, r]) => [id,
      r.Data as t.HTTPSourceRequest,
    ])),
    "sql-source": Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.SQLSource).map(([id, r]) => [id,
      r.Data as t.SQLSourceRequest,
    ])),
    mcp: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.MCP).map(([id, r]) => [id,
      r.Data as t.MCPRequest,
    ])),
  };
  // writeFile truncates its target at open, so a concurrent reader (e2e tests
  // poll db.json while the app writes) can observe a torn file; write to a tmp
  // sibling and rename over the target instead - rename is atomic, readers only
  // ever see the old or the new complete content.
  await writeFile(`${dbPath}.tmp`, JSON.stringify(raw, null, 2));
  await renameFile(`${dbPath}.tmp`, dbPath);
  // Record the mtime our own write produced, so the next load() revalidates
  // against it instead of re-reading what we just wrote.
  cachedMtimeMs = (await statMtimeMs(dbPath)) ?? null;
}

// Persists any pending debounced state immediately; returns null when nothing
// was pending. Used on quit (main.ts) and by tests to force the write.
export function flushSave(): Promise<void> | null {
  if (saveTimer === null || pendingSave === null)
    return null;
  clearTimeout(saveTimer);
  saveTimer = null;
  const j = pendingSave;
  pendingSave = null;
  // Queue behind an in-flight debounced write: concurrent saveNow calls would
  // race on the tmp file the same way they used to tear db.json directly.
  return serialized(() => saveNow(j));
}

export async function create(
  j: DB,
  kind: t.Kind,
  path: string,
  data: Request["Data"],
): Promise<t.RequestID> {
  const id = generateID();
  j.requests[id] = {ID: id, Path: path, Kind: kind, Data: data} as Request;
  await save(j);
  return id;
}

// n is allocated by max-scan over live drafts, so it is reused once the
// highest-numbered draft is deleted (accepted).
export async function createDraft(
  j: DB,
  kind: t.Kind,
  data: Request["Data"],
): Promise<t.RequestID> {
  const id = generateID();
  const n = Object.values(j.drafts).reduce((max, n) => Math.max(max, n), 0) + 1;
  j.requests[id] = {ID: id, Path: `draft ${n}`, Kind: kind, Data: data, Responses: []} as Request;
  j.drafts[id] = n;
  await save(j);
  return id;
}

export async function Delete(j: DB, id: t.RequestID): Promise<void> {
  if (!(id in j.requests))
    throw new Error(`request ${id} not found`);
  delete j.requests[id];
  delete j.drafts[id];
  // The deleted id may linger in manual-order sections otherwise
  pruneTree(j);
  await save(j);
}

export async function rename(j: DB, id: t.RequestID, newName: string): Promise<void> {
  if (!(id in j.requests))
    throw new Error(`request ${id} not found`);
  const existing = Object.values(j.requests).find(r => r.Path === newName && r.ID !== id);
  if (existing !== undefined) {
    throw new Error(`request with name ${newName} already exists`);
  }
  const req = j.requests[id];
  req.Path = newName;
  // Renaming a draft saves it as a regular request, so drop its draft entry.
  delete j.drafts[id];
  // A cross-directory rename invalidates the old parent's manual-order entry;
  // the request shows up name-sorted in its new directory until reordered.
  pruneTree(j);
  await save(j);
}

const joinDir = (dir: string, name: string): string => dir === "" ? name : dir + "/" + name;

// Sidebar drag-and-drop move in one transaction: renames the dragged request
// (or every request under the dragged directory) into toDir, then persists
// toDir's full manual child order as computed by the renderer. Children of
// toDir not covered by order fall back to name-sorted positioning.
export async function move(
  j: DB,
  drag: t.TreeChild,
  toDir: string,
  order: t.TreeChild[],
): Promise<void> {
  const renames: (readonly [t.RequestID, string])[] = [];
  if ("r" in drag) {
    if (!(drag.r in j.requests))
      throw new Error(`request ${drag.r} not found`);
    if (drag.r in j.drafts)
      throw new Error(`draft ${drag.r} is not part of the sidebar tree`);
    const req = j.requests[drag.r];
    const newPath = joinDir(toDir, t.pathToName(req.Path));
    if (newPath !== req.Path)
      renames.push([drag.r, newPath]);
  } else {
    const oldDir = drag.d;
    const oldChildren = childrenOf(j, oldDir);
    if (oldChildren.ids.size === 0 && oldChildren.dirs.size === 0)
      throw new Error(`directory ${oldDir} not found`);
    if (toDir === oldDir || toDir.startsWith(oldDir + "/"))
      throw new Error(`cannot move directory ${oldDir} into itself`);
    const newDir = joinDir(toDir, t.pathToName(oldDir));
    if (newDir !== oldDir) {
      renames.push(...Object.values(j.requests).filter(req => req.Path.startsWith(oldDir + "/")).map(req => [req.ID, newDir + req.Path.slice(oldDir.length)] as const));
    }
  }

  const np = renames.find(([_id, newPath]) => Object.values(j.requests).find(r => r.Path === newPath && r.ID !== _id) !== undefined);
  if (np !== undefined)
    throw new Error(`request with name ${np[1]} already exists`);

  for (const [id, newPath] of renames)
    j.requests[id].Path = newPath;

  // order must cover only children toDir actually has after the renames above
  const {ids, dirs} = childrenOf(j, toDir);
  if (order.some(entry => "r" in entry ? !ids.has(entry.r) : !dirs.has(entry.d)))
    throw new Error(`entry is not a child of directory ${toDir}`);
  j.tree[toDir] = order;
  pruneTree(j);
  await save(j);
}

export async function update(
  j: DB,
  id: t.RequestID,
  data: Request["Data"],
): Promise<void> {
  if (!(id in j.requests))
    throw new Error(`request ${id} not found`);

  j.requests[id].Data = data;
  await save(j);
}
