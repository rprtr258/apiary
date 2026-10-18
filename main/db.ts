import {readFile, stat, writeFile} from "fs/promises";
import {nanoid} from "nanoid";
import * as t from "@/types.ts";
import v1, {KindEntry} from "./db.v1.ts";

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
let cachedMtimeMs = -1;
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
  cachedMtimeMs = -1;
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

const LAST_VERSION = 1;
type LAST_V = v1;

// Parse db.json and run pending migrations in memory; wasOldVersion reports
// whether the file still needs persisting to reach the current version.
async function loadParsed(raw: Record<string, unknown>): Promise<LAST_V> {
  // Files from before versioning count as v1
  const version = typeof raw.$version === "number" && raw.$version >= 1 ? raw.$version : 1;
  if (version > LAST_VERSION) {
    throw new Error(`db.json was written by a newer apiary version ($version ${version}, this build understands up to ${LAST_VERSION})`);
  }
  const migrated: Record<string, unknown> = raw;

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
      cached = {requests: {}};
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
  cached = {requests};
  cachedMtimeMs = mtime ?? -1;
  return cached;
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
  const raw: v1 = {
    $version: 1,
    request: Object.values(j.requests).map(r => ({
      id: r.ID,
      kind: r.Kind,
      path: r.Path,
    })),
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
  await writeFile(dbPath, JSON.stringify(raw, null, 2));
  // Record the mtime our own write produced, so the next load() revalidates
  // against it instead of re-reading what we just wrote.
  cachedMtimeMs = (await statMtimeMs(dbPath)) ?? -1;
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
  return saveNow(j);
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

export async function Delete(j: DB, id: t.RequestID): Promise<void> {
  if (!(id in j.requests))
    throw new Error(`request ${id} not found`);
  delete j.requests[id];
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
