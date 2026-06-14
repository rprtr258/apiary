export * from "./types/shared.ts";
export * from "./types/http.ts";
import {HTTPRequest, HTTPResponse, HTTPSourceRequest} from "./types/http.ts";
export * from "./types/sql.ts";
import {SQLRequest, SQLResponse, SQLSourceRequest} from "./types/sql.ts";
export * from "./types/grpc.ts";
import {GRPCRequest, GRPCResponse} from "./types/grpc.ts";
export * from "./types/redis.ts";
import {RedisRequest, RedisResponse} from "./types/redis.ts";
export * from "./types/md.ts";
import {MDRequest, MDResponse} from "./types/md.ts";
export * from "./types/jq.ts";
import {JQRequest, JQResponse} from "./types/jq.ts";
export * from "./types/diff.ts";
import {DIFFRequest, DIFFResponse} from "./types/diff.ts";

export type JSONValue = string | number | boolean | null | JSONValue[] | {[key: string]: JSONValue};

type Time = string; // Go type: time

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
}

export type requestPreview = {
  name: string,
  kind: Kind,
  subKind: string,
};

export type Tree = {
  IDs: RequestID[],
  Dirs: Record<string, Tree>,
};

export type ListResponse = {
  Tree: Tree,
  Requests: Record<string, requestPreview>,
};

export type Response = {
  sent_at: Time,
  received_at: Time,
  response: unknown,
};

export type Request = {
  id: string,
  path: string,
} & RequestData;
export type Request2 = {
  ID: string,
  Path: string,
  Data: unknown,
  Responses: Response[],
};

export type RequestData =
  | {kind: Kind.HTTP      } & HTTPRequest
  | {kind: Kind.SQL       } & SQLRequest
  | {kind: Kind.GRPC      } & GRPCRequest
  | {kind: Kind.JQ        } & JQRequest
  | {kind: Kind.REDIS     } & RedisRequest
  | {kind: Kind.MD        } & MDRequest
  | {kind: Kind.DIFF      } & DIFFRequest
  | {kind: Kind.SQLSource } & SQLSourceRequest
  | {kind: Kind.HTTPSource} & HTTPSourceRequest
;

export const Kinds = Object.values(Kind);
export type ResponseData =
  | {kind: Kind.HTTP } & HTTPResponse
  | {kind: Kind.SQL  } & SQLResponse
  | {kind: Kind.GRPC } & GRPCResponse
  | {kind: Kind.JQ   } & JQResponse
  | {kind: Kind.REDIS} & RedisResponse
  | {kind: Kind.MD   } & MDResponse
  | {kind: Kind.DIFF } & DIFFResponse
;

export type HistoryEntry = {
  sent_at: Date,
  received_at: Date,
} & (
  {kind: Kind.HTTP,  request:  HTTPRequest, response:  HTTPResponse} |
  {kind: Kind.SQL,   request:   SQLRequest, response:   SQLResponse} |
  {kind: Kind.GRPC,  request:  GRPCRequest, response:  GRPCResponse} |
  {kind: Kind.JQ,    request:    JQRequest, response:    JQResponse} |
  {kind: Kind.REDIS, request: RedisRequest, response: RedisResponse} |
  {kind: Kind.MD,    request:    MDRequest, response:    MDResponse} |
  {kind: Kind.DIFF,  request:  DIFFRequest, response:  DIFFResponse}
);

export type GetResponse = {
  Request: Request2,
  History: Response[],
};
