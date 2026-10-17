import {readFile, writeFile} from "fs/promises";
import {nanoid} from "nanoid";
import * as t from "@/types.ts";

export function generateID(): t.RequestID {
  return nanoid();
}

type KindEntry<Req, Resp> = {
  request: Req,
  responses: { // TODO: remove
    SentAt: string,
    ReceivedAt: string,
    Response: Resp,
  }[],
};

type v1 = {
  "$version": 1,
  request?: {
    id: t.RequestID,
    kind: t.Kind,
    path: string,
  }[],
  [t.Kind.HTTP]:       Record<t.RequestID, KindEntry<t.HTTPRequest, t.HTTPResponse>>,
  [t.Kind.SQL]:        Record<t.RequestID, KindEntry<t.SQLRequest, t.SQLResponse>>,
  [t.Kind.JQ]:         Record<t.RequestID, KindEntry<t.JQRequest, t.JQResponse>>,
  [t.Kind.MD]:         Record<t.RequestID, KindEntry<t.MDRequest, t.MDResponse>>,
  [t.Kind.REDIS]:      Record<t.RequestID, KindEntry<t.RedisRequest, t.RedisResponse>>,
  [t.Kind.GRPC]:       Record<t.RequestID, KindEntry<t.GRPCRequest, t.GRPCResponse>>,
  [t.Kind.DIFF]:       Record<t.RequestID, KindEntry<t.DiffRequest, t.DiffResponse>>,
  [t.Kind.SQLSource]:  Record<t.RequestID, t.SQLSourceRequest>,
  [t.Kind.HTTPSource]: Record<t.RequestID, t.HTTPSourceRequest>,
  [t.Kind.MCP]:        Record<t.RequestID, t.MCPRequest>,
  drafts?: DraftEntry[],
};

type DraftEntry = {
  id: t.RequestID,
  n: number,
};

type historyEntry<_Req, Resp> = {
  SentAt: Date,
  ReceivedAt: Date,
  // Request: Req, // TODO: use
  Response: Resp,
};

export type HistoryEntry = // TODO: just Request["Responses"][number]
  | historyEntry<t.HTTPRequest, t.HTTPResponse>
  | historyEntry<t.SQLRequest, t.SQLResponse>
  | historyEntry<t.JQRequest, t.JQResponse>
  | historyEntry<t.RedisRequest, t.RedisResponse>
  | historyEntry<t.GRPCRequest, t.GRPCResponse>
;

export type Request = {
  ID:        t.RequestID,
  Path:      string,
} & (
  | {Kind: t.Kind.HTTP} & {
    Data: t.HTTPRequest,
    Responses: historyEntry<t.HTTPRequest, t.HTTPResponse>[],
  }
  | {Kind: t.Kind.SQL} & {
    Data: t.SQLRequest,
    Responses: historyEntry<t.SQLRequest, t.SQLResponse>[],
  }
  | {Kind: t.Kind.JQ} & {
    Data: t.JQRequest,
    Responses: historyEntry<t.JQRequest, t.JQResponse>[],
  }
  | {Kind: t.Kind.MD} & {
    Data: t.MDRequest,
    Responses: [],
  }
  | {Kind: t.Kind.REDIS} & {
    Data: t.RedisRequest,
    Responses: historyEntry<t.RedisRequest, t.RedisResponse>[],
  }
  | {Kind: t.Kind.GRPC} & {
    Data: t.GRPCRequest,
    Responses: historyEntry<t.GRPCRequest, t.GRPCResponse>[],
  }
  | {Kind: t.Kind.DIFF} & {
    Data: t.DiffRequest,
    Responses: [],
  }
  | {Kind: t.Kind.SQLSource} & {
    Data: t.SQLSourceRequest,
    Responses: [],
  }
  | {Kind: t.Kind.HTTPSource} & {
    Data: t.HTTPSourceRequest,
    Responses: [],
  }
  | {Kind: t.Kind.MCP} & {
    Data: t.MCPRequest,
    Responses: [],
  }
);

export type DB = {
  requests: Record<t.RequestID, Request>,
  // Draft membership (id -> cosmetic "draft N" number); serialized to the v1
  // "drafts" section.
  drafts: Record<t.RequestID, number>,
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

export function setDBPath(p: string): void {
  dbPath = p;
}

// db.ts persists by whole-file load-modify-save: two concurrent operations
// interleave at their await boundaries and the last save() silently overwrites
// the other's changes (lost records, duplicated draft numbers). Mutating
// operations therefore run one-at-a-time behind this queue; read-only access
// works on the snapshot of the last save and stays unqueued.
let dbQueue: Promise<void> = Promise.resolve();
export function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = dbQueue.then(fn);
  dbQueue = run.then(() => undefined, () => undefined);
  return run;
}

export async function load(): Promise<DB> {
  // TODO: migrate db
  let b: Buffer;
  try {
    b = await readFile(dbPath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const j: DB = {requests: {}, drafts: {}};
      await save(j);
      return j;
    }
    throw err;
  }
  const raw = JSON.parse(b.toString()) as v1;
  const requests = Object.fromEntries((raw.request ?? []).map(r => [r.id, (() => {
    const kind: Pick<Request, "Data" | "Responses"> = (() => {
      switch (r.kind) {
      case t.Kind.HTTP:
        const req = raw[r.kind][r.id];
        return {
          Data: req.request,
          Responses: req.responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.SQL:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: raw[r.kind][r.id].responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.JQ:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: raw[r.kind][r.id].responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.MD:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: [],
        };
      case t.Kind.REDIS:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: raw[r.kind][r.id].responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.GRPC:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: raw[r.kind][r.id].responses.map(resp => ({
            SentAt: new Date(resp.SentAt),
            ReceivedAt: new Date(resp.ReceivedAt),
            Response: resp.Response,
          })),
        };
      case t.Kind.DIFF:
        return {
          Data: raw[r.kind][r.id].request,
          Responses: [],
        };
      case t.Kind.SQLSource: {
        const src = raw[r.kind][r.id] as unknown as {database: t.Database, dsn: string, readOnly?: boolean};
        return {
          Data: {...src, readOnly: src.readOnly ?? false},
          Responses: [],
        };
      }
      case t.Kind.HTTPSource:
        return {
          Data: raw[r.kind][r.id],
          Responses: [],
        };
      case t.Kind.MCP:
        return {
          Data: raw[r.kind][r.id],
          Responses: [],
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
  return {
    requests,
    drafts: Object.fromEntries((raw.drafts ?? []).filter(d => d.id in requests).map(d => [d.id, d.n])),
  };
}

export async function save(j: DB): Promise<void> {
  const raw: v1 = {
    $version: 1,
    request: Object.values(j.requests).map(r => ({
      id: r.ID,
      kind: r.Kind,
      path: r.Path,
    })),
    http: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.HTTP).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.HTTPRequest, t.HTTPResponse>])),
    sql: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.SQL).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.SQLRequest, t.SQLResponse>])),
    jq: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.JQ).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.JQRequest, t.JQResponse>])),
    md: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.MD).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.MDRequest, t.MDResponse>])),
    redis: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.REDIS).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.RedisRequest, t.RedisResponse>])),
    grpc: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.GRPC).map(([id, r]) => [id, {
      request: r.Data,
      responses: r.Responses,
    } as KindEntry<t.GRPCRequest, t.GRPCResponse>])),
    diff: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.DIFF).map(([id, r]) => [id, {
      request: r.Data,
    } as KindEntry<t.DiffRequest, t.DiffResponse>])),
    "http-source": Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.HTTPSource).map(([id, r]) => [id,
      r.Data as t.HTTPSourceRequest,
    ])),
    "sql-source": Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.SQLSource).map(([id, r]) => [id,
      r.Data as t.SQLSourceRequest,
    ])),
    mcp: Object.fromEntries(Object.entries(j.requests).filter(([_id, r]) => r.Kind === t.Kind.MCP).map(([id, r]) => [id,
      r.Data as t.MCPRequest,
    ])),
    drafts: Object.entries(j.drafts).map(([id, n]) => ({id, n})),
  };
  await writeFile(dbPath, JSON.stringify(raw, null, 2));
}

export async function create(
  j: DB,
  kind: t.Kind,
  path: string,
  data: Request["Data"],
): Promise<t.RequestID> {
  const id = generateID();
  j.requests[id] = {ID: id, Path: path, Kind: kind, Data: data, Responses: []} as Request;
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
  // Renaming a draft saves it as a regular request, so drop its draft entry.
  delete j.drafts[id];
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

export async function createResponse(
  j: DB,
  id: t.RequestID,
  response: HistoryEntry,
): Promise<void> {
  if (!(id in j.requests))
    throw new Error(`request ${id} not found`);

  const req = j.requests[id];
  (req.Responses as HistoryEntry[]).push(response);
  await save(j);
}
