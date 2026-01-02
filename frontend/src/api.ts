import type {Result} from "./result";
import {err, ok} from "./result";
import * as App from "../wailsjs/go/app/App";
import type {app} from '../wailsjs/go/models';
import {database} from '../wailsjs/go/models';

export const Method = {
  GET:     "GET",
  POST:    "POST",
  PUT:     "PUT",
  DELETE:  "DELETE",
  PATCH:   "PATCH",
  OPTIONS: "OPTIONS",
};
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
  [database.Database.POSTGRES]:   "PG",
  [database.Database.MYSQL]:      "MY",
  [database.Database.SQLITE]:     "LITE",
  [database.Database.CLICKHOUSE]: "CH",
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
  {kind: database.Kind.MD,    request: database.   MDRequest, response: database.   MDResponse} |
  never
)

function parseTime(s: string): Date {
  const d = new Date();
  d.setTime(Date.parse(s));
  return d;
};

async function wrap<T>(f: () => Promise<T>, args: any): Promise<Result<T>> {
  try {
    const res = await f();
    console.log("FETCH", f, args, res);
    return ok(res);
  } catch (e) {
    return err(String(e));
  }
}

export const api = {
  async collectionRequests(): Promise<Result<app.ListResponse>> {
    return await wrap(async () => App.List(), {});
  },

  async get(id: string): Promise<Result<app.GetResponse>> {
    const y = await wrap(async () => App.Get(id), {id});
    // TODO: it seems that is not needed, remove if so
    return y.map((y: app.GetResponse) => {
      // NOTE: BEWARE, DIRTY TYPESCRIPT HACKS HERE
      const history = y.History as unknown as HistoryEntry[] ?? [];
      for (const req of history) {
        req.sent_at = parseTime(req.sent_at as unknown as string);
      }
      return y;
    });
  },

  async requestCreate(
    name: string,
    kind: database.Kind,
  ): Promise<Result<app.ResponseNewRequest>> {
    return await wrap(() => App.Create(name, kind), {name, kind});
  },

  async requestDuplicate(
    name: string,
  ): Promise<Result<app.ResponseNewRequest>> {
    return await wrap(() => App.Duplicate(name), {name});
  },

  async request_update(
    id: string,
    kind: database.Kind,
    req: Omit<RequestData, "kind">,
  ): Promise<Result<void>> {
    return await wrap(() => App.Update(id, kind, req), {reqId: id, kind, req});
  },

  async rename(
    id: string,
    newID: string,
  ): Promise<Result<void>> {
    return await wrap(() => App.Rename(id, newID), {reqId: id, newID});
  },

  async requestPerform(
    id: string,
  ): Promise<Result<HistoryEntry>> {
    return await wrap(() => App.Perform(id), {reqId: id}) as Result<HistoryEntry>;
  },

  async requestDelete(
    id: string,
  ): Promise<Result<void>> {
    return await wrap(() => App.Delete(id), {reqId: id});
  },

  async jq(
    data: string,
    query: string,
  ): Promise<Result<string[]>> {
    return await wrap(() => App.JQ(data, query), {data, query});
  },

  async grpcMethods(target: string): Promise<Result<app.grpcServiceMethods[]>> {
    return await wrap(() => App.GRPCMethods(target), {target});
  },

  async requestPerformSQLSource(
    id: string,
    query: string,
  ): Promise<Result<HistoryEntry>> {
    return await wrap(() => App.PerformSQLSource(id, query), {reqId: id}) as Result<HistoryEntry>;
  },
};
