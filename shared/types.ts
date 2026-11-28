export * from "./types/json.ts";
import {HTTPRequest, HTTPResponse, HTTPSourceRequest} from "./types/http.ts"; export * from "./types/http.ts";
import {SQLRequest, SQLResponse, SQLSourceRequest} from "./types/sql.ts"; export * from "./types/sql.ts";
import {GRPCRequest, GRPCResponse} from "./types/grpc.ts"; export * from "./types/grpc.ts";
import {RedisRequest, RedisResponse} from "./types/redis.ts"; export * from "./types/redis.ts";
import {MDRequest, MDResponse} from "./types/md.ts"; export * from "./types/md.ts";
import {JQRequest, JQResponse} from "./types/jq.ts"; export * from "./types/jq.ts";
import {DiffRequest, DiffResponse} from "./types/diff.ts"; export * from "./types/diff.ts";
import {MCPRequest} from "./types/mcp.ts"; export * from "./types/mcp.ts";

export type JSONValue = string | number | boolean | null | JSONValue[] | {[key: string]: JSONValue};

export type RequestID = string;

export enum Kind {
  HTTP = "http",
  SQL = "sql",
  MD = "md",
  SQLSource = "sql-source",
  JQ = "jq",
  REDIS = "redis",
  GRPC = "grpc",
  HTTPSource = "http-source",
  DIFF = "diff",
  MCP = "mcp",
}

export type requestPreview = {
  path: string,
  kind: Kind,
  subKind: string,
};

export function pathToName(path: string): string {
  return path.split("/").slice(-1)[0];
}

// One child of a sidebar directory: a request by id, or a subdirectory. In
// order lists (the db "tree" section and Move's order argument) `d` is the
// dir name relative to that directory; in Move's `drag` argument `d` is the
// dragged dir's full path, which is what db.move resolves it by.
export type TreeChild = {r: RequestID} | {d: string};

// Sidebar tree as emitted by List: children in the directory's persisted
// manual order first, unlisted children name-sorted after them.
export type TreeEntry =
  | {kind: "dir", name: string, tree: Tree}
  | {kind: "req", id: RequestID};

export type Tree = {
  entries: TreeEntry[],
};

export type ListResponse = {
  Tree: Tree,
  Requests: Record<string, requestPreview>,
  // id -> draft number for live drafts; every stored request is absent
  Drafts: Record<RequestID, number>,
  // Present once after an unreadable db.json (corrupt JSON, newer $version)
  // was moved aside at load; the text names the backup file.
  Notice?: string,
};

export type Request = {
  id: RequestID,
  path: string,
} & RequestData;
type Request2 = {
  ID: RequestID,
  Path: string,
  Data: unknown,
};

// Authoritative Kind -> wire-type mapping. RequestData, HistoryEntry and the
// db storage envelope are all derived from this table; adding a kind means
// adding a row here (plus the enum member), never a parallel union elsewhere.
// Rows without a response are kinds Perform does not dispatch (sources and
// MCP); only rows with one can be drafts.
export type KindTypes = {
  [Kind.HTTP]:       {request: HTTPRequest,  response: HTTPResponse},
  [Kind.SQL]:        {request: SQLRequest,   response: SQLResponse},
  [Kind.GRPC]:       {request: GRPCRequest,  response: GRPCResponse},
  [Kind.JQ]:         {request: JQRequest,    response: JQResponse},
  [Kind.REDIS]:      {request: RedisRequest, response: RedisResponse},
  [Kind.MD]:         {request: MDRequest,    response: MDResponse},
  [Kind.DIFF]:       {request: DiffRequest,  response: DiffResponse},
  [Kind.SQLSource]:  {request: SQLSourceRequest},
  [Kind.HTTPSource]: {request: HTTPSourceRequest},
  [Kind.MCP]:        {request: MCPRequest},
};

export type RequestData = {
  [K in Kind]: {kind: K} & KindTypes[K]["request"]
}[Kind];

export const Kinds = Object.values(Kind);

// Kinds Perform dispatches; only these can be drafts (sources and MCP cannot be
// performed and therefore cannot be drafts).
type DraftableKind = {
  [K in Kind]: KindTypes[K] extends {response: unknown} ? K : never
}[Kind];
const draftableKinds: readonly DraftableKind[] = [Kind.HTTP, Kind.SQL, Kind.JQ, Kind.MD, Kind.REDIS, Kind.GRPC, Kind.DIFF];
export const DraftableKinds: ReadonlySet<Kind> = new Set(draftableKinds);

export type HistoryEntry = {
  sent_at: Date,
  received_at: Date,
} & {
  [K in DraftableKind]: {kind: K} & KindTypes[K]
}[DraftableKind];

export type GetResponse = {
  Request: Request2,
};
