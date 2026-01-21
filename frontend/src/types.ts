import {database} from "../wailsjs/go/models.ts";

export type KV = {
  key: string,
  value: string,
};

export type HTTPRequest = {
  url: string,
  method: string,
  body: string,
  headers: KV[],
};

export type HTTPResponse = {
  code: number,
  body: string,
  headers: KV[],
};

export const Method = {
  GET:     "GET",
  HEAD:    "HEAD",
  POST:    "POST",
  PUT:     "PUT",
  DELETE:  "DELETE",
  CONNECT: "CONNECT",
  OPTIONS: "OPTIONS",
  TRACE:   "TRACE",
  PATCH:   "PATCH",
} as const;
export type Method = keyof typeof Method;

export const GRPCCodes = {
  0: "OK",
  1: "CANCELLED",
  2: "UNKNOWN",
  3: "INVALID_ARGUMENT",
  4: "DEADLINE_EXCEEDED",
  5: "NOT_FOUND",
  6: "ALREADY_EXISTS",
  7: "PERMISSION_DENIED",
  8: "RESOURCE_EXHAUSTED",
  9: "FAILED_PRECONDITION",
  10: "ABORTED",
  11: "OUT_OF_RANGE",
  12: "UNIMPLEMENTED",
  13: "INTERNAL",
  14: "UNAVAILABLE",
  15: "DATA_LOSS",
  16: "UNAUTHENTICATED",
} as const;
export type GRPCCode = keyof typeof GRPCCodes;

export const Database: Record<database.Database, string> = {
  [database.Database.POSTGRES]:   "PostgreSQL",
  [database.Database.MYSQL]:      "MySQL",
  [database.Database.SQLITE]:     "SQLite",
  [database.Database.CLICKHOUSE]: "ClickHouse",
} as const;
export type Database = keyof typeof Database;

export type RequestData =
  | {kind: database.Kind.HTTP }     & database.HTTPRequest
  | {kind: database.Kind.SQL  }     & database.SQLRequest
  | {kind: database.Kind.GRPC }     & database.GRPCRequest
  | {kind: database.Kind.JQ   }     & database.JQRequest
  | {kind: database.Kind.REDIS}     & database.RedisRequest
  | {kind: database.Kind.MD   }     & database.MDRequest
  | {kind: database.Kind.SQLSource} & database.SQLSourceRequest
  | {kind: database.Kind.HTTPSource} & database.HTTPSourceRequest
;

export type Request = {
  id: string,
  path: string,
} & RequestData;

export const Kinds = Object.values(database.Kind);
export type ResponseData =
  | {kind: database.Kind.HTTP } & database.HTTPResponse
  | {kind: database.Kind.SQL  } & database.SQLResponse
  | {kind: database.Kind.GRPC } & database.GRPCResponse
  | {kind: database.Kind.JQ   } & database.JQResponse
  | {kind: database.Kind.REDIS} & database.RedisResponse
  | {kind: database.Kind.MD   } & database.MDResponse
;

export type HistoryEntry = {
  sent_at: Date,
  received_at: Date,
} & (
  {kind: database.Kind.HTTP,  request: database. HTTPRequest, response: database. HTTPResponse} |
  {kind: database.Kind.SQL,   request: database.  SQLRequest, response: database.  SQLResponse} |
  {kind: database.Kind.GRPC,  request: database. GRPCRequest, response: database. GRPCResponse} |
  {kind: database.Kind.JQ,    request: database.   JQRequest, response: database.   JQResponse} |
  {kind: database.Kind.REDIS, request: database.RedisRequest, response: database.RedisResponse} |
  {kind: database.Kind.MD,    request: database.   MDRequest, response: database.   MDResponse}
);

export type RowValue = string | number | boolean | null;
