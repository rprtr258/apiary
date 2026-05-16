import {create, createResponse, extractSubKind, load, Delete as remove, rename, update, RequestID, Request} from "./db.ts";
import * as t from "./types/models.ts";
import {HTTPEmptyRequest, sendHTTP} from "./database/http.ts";
import {JQEmptyRequest, sendJQ} from "./database/jq.ts";
import {DefaultMarkdown, sendMD} from "./database/md.ts";
import {sendSQL} from "./database/sql.ts";
import {RedisEmptyRequest, sendRedis} from "./database/redis.ts";
import {sendGRPC, grpcMethods, grpcQueryFake, grpcQueryValidate} from "./database/grpc.ts";
import {parseSpec, generateExampleRequest, fetchSpec} from "./database/http_source.ts";
import {listTablesSQLSource, describeTableSQLSource, countRowsSQLSource, testSQLSource} from "./database/sql_source.ts";

export async function List(): Promise<t.ListResponse> {
  const j = await load();
  const tree: t.Tree = {IDs: {}, Dirs: {}};
  const requests: Record<RequestID, t.requestPreview> = {};
  for (const [id, req] of Object.entries(j)) {
    const kind = req.Kind;
    const path = req.Path;
    const subKind = extractSubKind(j, kind, id);

    requests[id] = {
      kind: kind,
      subKind: subKind,
    };

    // Build tree: split path by "/", create nested Dirs, put entry in IDs
    const parts = path.split("/");
    let current = tree;
    for (const part of parts.slice(0, -1)) {
      if (part === "") {
        continue;
      }
      if (part in current.Dirs) {
        current = current.Dirs[part]!;
      } else if (part in current.IDs) {
        current = current.Dirs[part];
      } else {
        const child: t.Tree = {IDs: {}, Dirs: {}};
        current.Dirs[part] = child;
        current = child;
      }
    }
    current.IDs[id] = parts.slice(-1)[0];
  }

  return {
    Tree: tree,
    Requests: requests,
  };
}

export async function Get(id: RequestID): Promise<t.GetResponse> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const entry = j[id];
  const history = entry.Responses.map(h => ({
    sent_at: h.SentAt,
    received_at: h.ReceivedAt,
    kind: entry.Kind,
    request: entry.Data,
    response: h.Response,
  }));
  history.sort((a, b) => a.sent_at.getTime() - b.sent_at.getTime());
  return {
    Request: {
      ID: id,
      Path: entry.Path,
      Data: entry.Data,
      Responses: entry.Responses,
    },
    History: history, // TODO: remove
  };
}

// Empty request templates for each kind
function emptyRequestForKind(kind: t.Kind): Request["Data"] {
  switch (kind) {
  case t.Kind.HTTP:
    return HTTPEmptyRequest;
  case t.Kind.SQL:
    return {dsn: ":memory:", database: t.Database.SQLITE, query: "SELECT 1"};
  case t.Kind.JQ:
    return JQEmptyRequest;
  case t.Kind.MD:
    return DefaultMarkdown;
  case t.Kind.REDIS:
    return RedisEmptyRequest;
  case t.Kind.GRPC:
    return {target: "", method: "", payload: "", metadata: []};
  case t.Kind.DIFF:
    return {left: "", right: ""};
  case t.Kind.SQLSource:
    return {dsn: ":memory:", database: t.Database.SQLITE};
  case t.Kind.HTTPSource:
    return {serverUrl: "", specSource: "url", specData: "", auth: {type: "none"}};
  default:
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`unknown kind ${kind}`);
  }
}

export async function Create(path: string, kind: t.Kind): Promise<t.ResponseNewRequest> {
  const j = await load();
  const emptyData = emptyRequestForKind(kind);
  const id = await create(j, kind, path, emptyData);
  return {id};
}

export async function Duplicate(id: RequestID): Promise<t.ResponseNewRequest> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const entry = j[id];
  // TODO: find copies and increment
  const newId = await create(j, entry.Kind, entry.Path + " (copy)", entry.Data);
  return {id: newId};
}

export async function Delete(id: RequestID): Promise<void> {
  const j = await load();
  await remove(j, id);
}

export async function Read(id: RequestID): Promise<t.Request> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  return {
    ID: id,
    Path: req.Path,
    Data: req.Data,
    Responses: req.Responses,
  };
}

export async function Rename(id: RequestID, newName: string): Promise<void> {
  const j = await load();
  await rename(j, id, newName);
}

export async function Update(id: RequestID, kind: t.Kind, data: Request["Data"]): Promise<void> {
  const j = await load();
  await update(j, id, kind, data);
}

type PerformResponse = {
  RequestId:   RequestID,
  sent_at:     string, // TODO: Date
  received_at: string, // TODO: Date
  request:     unknown,
  response:    unknown,
};

export async function Perform(id: RequestID): Promise<PerformResponse> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);

  const req = j[id];

  const sent_at = new Date();
  let result: unknown;
  switch (req.Kind) {
  case t.Kind.HTTP:
    result = await sendHTTP(req.Data);
    break;
  case t.Kind.JQ:
    result = await sendJQ(req.Data);
    break;
  case t.Kind.MD:
    result = await sendMD(req.Data);
    break;
  case t.Kind.SQL:
    result = await sendSQL(req.Data);
    break;
  case t.Kind.REDIS:
    result = await sendRedis(req.Data);
    break;
  case t.Kind.GRPC:
    result = await sendGRPC(req.Data);
    break;
  default:
    throw new Error(`Perform not yet implemented for kind ${req.Kind}`);
  }
  const received_at = new Date();

  await createResponse(j, id, {SentAt: sent_at, ReceivedAt: received_at, Response: result});
  return {
    RequestId:   id,
    sent_at:     sent_at.toISOString(),
    received_at: received_at.toISOString(),
    request:     req.Data,
    response:    result,
  };
}

export async function JQ(json: string, query: string): Promise<string[]> {
  const result = await sendJQ({json, query});
  return result.response;
}

export async function GRPCMethods(target: string): Promise<t.grpcServiceMethods[]> {
  return await grpcMethods(target);
}

export async function GRPCQueryFake(target: string, method: string): Promise<string> {
  return await grpcQueryFake(target, method);
}

export async function GRPCQueryValidate(target: string, method: string, payload: string): Promise<void> {
  await grpcQueryValidate(target, method, payload);
}

export async function PerformSQLSource(id: RequestID, query: string): Promise<PerformResponse> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  const sourceRequest = req.Data as t.SQLSourceRequest;
  const sqlRequest: t.SQLRequest = {dsn: sourceRequest.dsn, database: sourceRequest.database, query};
  const sent_at = new Date();
  const result = await sendSQL(sqlRequest);
  const received_at = new Date();
  await createResponse(j, id, {SentAt: sent_at, ReceivedAt: received_at, Response: result});
  return {
    RequestId:   id,
    sent_at:     new Date().toISOString(),
    received_at: new Date().toISOString(),
    request:     sqlRequest,
    response:    result,
  };
}

export async function TestSQLSource(id: RequestID): Promise<void> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  const sourceRequest = req.Data as t.SQLSourceRequest;
  const sqlRequest: t.SQLRequest = {dsn: sourceRequest.dsn, database: sourceRequest.database, query: "SELECT 1"};
  await testSQLSource(sqlRequest);
}

export async function ListTablesSQLSource(id: RequestID): Promise<t.TableInfo[]> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id] as Request & {Kind: t.Kind.SQLSource};
  const sourceRequest = req.Data;
  const sqlRequest: t.SQLRequest = {dsn: sourceRequest.dsn, database: sourceRequest.database, query: ""};
  return await listTablesSQLSource(sqlRequest);
}

export async function DescribeTableSQLSource(id: RequestID, tableName: string): Promise<t.TableSchema> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  const sourceRequest = req.Data as t.SQLSourceRequest;
  const sqlRequest: t.SQLRequest = {dsn: sourceRequest.dsn, database: sourceRequest.database, query: ""};
  return await describeTableSQLSource(sqlRequest, tableName);
}

export async function CountRowsSQLSource(id: RequestID, tableName: string): Promise<number> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  const sourceRequest = req.Data as t.SQLSourceRequest;
  const sqlRequest: t.SQLRequest = {dsn: sourceRequest.dsn, database: sourceRequest.database, query: ""};
  return await countRowsSQLSource(sqlRequest, tableName);
}

export async function ListEndpointsHTTPSource(id: RequestID): Promise<t.EndpointInfo[]> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  const sourceRequest = req.Data as t.HTTPSourceRequest;
  const specData = await getSpecData(sourceRequest);
  return parseSpec(specData);
}

export async function GenerateExampleRequestHTTPSource(id: RequestID, endpointIndex: number): Promise<t.HTTPRequest> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  const sourceRequest = req.Data as t.HTTPSourceRequest;
  const specData = await getSpecData(sourceRequest);
  return generateExampleRequest(specData, endpointIndex);
}

export async function PerformVirtualEndpointHTTPSource(sourceID: RequestID, endpointIndex: number, request: t.HTTPRequest): Promise<Record<string, unknown>> {
  // Perform an HTTP request generated from the OpenAPI spec
  const j = await load();
  const req = j[sourceID];
  const sent_at = new Date();
  const result = await sendHTTP(request);
  const received_at = new Date();
  await createResponse(j, sourceID, {SentAt: sent_at, ReceivedAt: received_at, Response: result});
  return {
    RequestId:   sourceID,
    sent_at:     sent_at.toISOString(),
    received_at: received_at.toISOString(),
    request:     req.Data,
    response:    result,
  };
}

export async function TestHTTPSource(id: RequestID): Promise<void> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  const sourceRequest = req.Data as t.HTTPSourceRequest;
  // Verify spec is parseable
  const specData = await getSpecData(sourceRequest);
  parseSpec(specData);
}

export async function FetchSpecHTTPSource(id: RequestID): Promise<void> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  const sourceRequest = req.Data as t.HTTPSourceRequest;
  const specData = await getSpecData(sourceRequest);
  if (!specData)
    throw new Error("no spec data");
}

async function getSpecData(sourceRequest: t.HTTPSourceRequest): Promise<string> {
  if (sourceRequest.specSource === "url") {
    return await fetchSpec(sourceRequest.specData);
  }
  // spec is inline in specData
  return sourceRequest.specData;
}
