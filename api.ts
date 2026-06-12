import {create, createResponse, extractSubKind, load, Delete as remove, rename, update, Request, HistoryEntry2} from "./db.ts";
import * as t from "./shared/types/models.ts";
import {HTTPEmptyRequest, sendHTTP} from "./database/http.ts";
import {JQEmptyRequest, sendJQ} from "./database/jq.ts";
import {DefaultMarkdown, sendMD} from "./database/md.ts";
import {sendSQL} from "./database/sql.ts";
import {RedisEmptyRequest, sendRedis} from "./database/redis.ts";
import {sendDIFF} from "./database/diff.ts";
import {sendGRPC, grpcMethods, grpcQueryFake, grpcQueryValidate} from "./database/grpc.ts";
import {parseSpec, generateExampleRequest, fetchSpec} from "./database/http_source.ts";
import {listTablesSQLSource, describeTableSQLSource, countRowsSQLSource, testSQLSource} from "./database/sql_source.ts";
import {HistoryEntry} from "./shared/types/types.ts";

async function get(id: t.RequestID): Promise<Request> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  return j[id];
}

export async function List(): Promise<t.ListResponse> {
  const j = await load();

  const previews: Record<t.RequestID, t.requestPreview> = Object.fromEntries(Object.entries(j).map(([id, req]) => [id, {
    name: req.Path.split("/").slice(-1)[0],
    kind: req.Kind,
    subKind: extractSubKind(j, id),
  }]));

  const tree: t.Tree = {IDs: [], Dirs: {}};
  for (const [id, req] of Object.entries(j)) {
    // Build tree: split path by "/", create nested Dirs, put entry in IDs
    const parts = req.Path.split("/");
    const current = parts.slice(0, -1).filter(part => part !== "").reduce((current: t.Tree, part: string): t.Tree => {
      if (part in current.Dirs) {
        return current.Dirs[part];
      } else {
        const child: t.Tree = {IDs: [], Dirs: {}};
        current.Dirs[part] = child;
        return child;
      }
    }, tree);
    current.IDs.push(id);
  }

  return {
    Tree: tree,
    Requests: previews,
  };
}

export async function Get(id: t.RequestID): Promise<t.GetResponse> {
  const entry = await get(id);
  const history: HistoryEntry[] = entry.Responses.map(h => ({
    sent_at: h.SentAt,
    received_at: h.ReceivedAt,
    kind: entry.Kind,
    request: entry.Data,
    response: h.Response,
  } as HistoryEntry));
  history.sort((a, b) => a.sent_at.getTime() - b.sent_at.getTime());
  return {
    Request: {
      ID: id,
      Path: entry.Path,
      Data: entry.Data,
      Responses: entry.Responses as t.Response[],
    },
    History: history as unknown as t.Response[], // TODO: remove
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

export async function Create(path: string, kind: t.Kind): Promise<t.RequestID> {
  const j = await load();
  const emptyData = emptyRequestForKind(kind);
  return await create(j, kind, path, emptyData);
}

export async function Duplicate(id: t.RequestID): Promise<t.RequestID> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const entry = j[id];
  // TODO: find copies and increment
  return await create(j, entry.Kind, entry.Path + " (copy)", entry.Data);
}

export async function Delete(id: t.RequestID): Promise<void> {
  const j = await load();
  await remove(j, id);
}

export async function Read(id: t.RequestID): Promise<t.Request> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  return {
    ID: id,
    Path: req.Path,
    Data: req.Data,
    Responses: req.Responses as unknown as t.Response[],
  };
}

export async function Rename(id: t.RequestID, newName: string): Promise<void> {
  const j = await load();
  await rename(j, id, newName);
}

export async function Update(id: t.RequestID, data: Request["Data"]): Promise<void> {
  const j = await load();
  await update(j, id, data);
}

type PerformResponse = {
  RequestId:   t.RequestID,
  sent_at:     string, // TODO: Date
  received_at: string, // TODO: Date
  request:     unknown,
  response:    unknown,
};

// Perform create a handler that performs call and save result to history
export async function Perform(id: t.RequestID): Promise<PerformResponse> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);

  const req = j[id];

  const sent_at = new Date();
  let response: unknown;
  switch (req.Kind) {
  case t.Kind.HTTP:
    response = await sendHTTP(req.Data);
    break;
  case t.Kind.JQ:
    response = await sendJQ(req.Data);
    break;
  case t.Kind.MD:
    response = await sendMD(req.Data);
    break;
  case t.Kind.SQL:
    response = await sendSQL(req.Data);
    break;
  case t.Kind.REDIS:
    response = await sendRedis(req.Data);
    break;
  case t.Kind.GRPC:
    response = await sendGRPC(req.Data);
    break;
  case t.Kind.DIFF:
    response = sendDIFF(req.Data);
    break;
  default:
    throw new Error(`Perform not yet implemented for kind ${req.Kind}`);
  }
  const received_at = new Date();

  await createResponse(j, id, {SentAt: sent_at, ReceivedAt: received_at, Response: response as HistoryEntry2["Response"]} as HistoryEntry2);
  return {
    RequestId:   id,
    sent_at:     sent_at.toISOString(),
    received_at: received_at.toISOString(),
    request:     req.Data,
    response:    response,
  };
}

export async function GRPCMethods(id: t.RequestID): Promise<t.grpcServiceMethods[]> {
  const req = await get(id);
  if (req.Kind !== t.Kind.GRPC)
    throw new Error(`query kind is ${req.Kind}, expected grpc`);
  return await grpcMethods(req.Data.target);
}

export async function GRPCQueryFake(target: string, method: string): Promise<string> {
  return await grpcQueryFake(target, method);
}

// NOTE: method fully qualified
export async function GRPCQueryValidate(target: string, method: string, payload: string): Promise<void> {
  await grpcQueryValidate(target, method, payload);
}

export async function PerformSQLSource(id: t.RequestID, query: string): Promise<PerformResponse> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  const req = j[id];
  if (req.Kind !== t.Kind.SQLSource)
    throw new Error(`request ${id} is not SQLSource`);

  const sourceRequest = req.Data;
  const sent_at = new Date();
  const sqlRequest: t.SQLRequest = {dsn: sourceRequest.dsn, database: sourceRequest.database, query};
  const result = await sendSQL(sqlRequest);
  const received_at = new Date();
  return {
    RequestId:   id,
    sent_at:     sent_at.toISOString(),
    received_at: received_at.toISOString(),
    request:     sqlRequest,
    response:    result,
  };
}

export async function TestSQLSource(id: t.RequestID): Promise<void> {
  const req = await get(id);
  if (req.Kind !== t.Kind.SQLSource)
    throw new Error(`request ${id} is not SQLSource`);
  const {dsn, database} = req.Data;
  await testSQLSource({dsn, database});
}

export async function ListTablesSQLSource(id: t.RequestID): Promise<t.TableInfo[]> {
  const req = await get(id) as Request & {Kind: t.Kind.SQLSource};
  const sourceRequest = req.Data;
  const sqlRequest: t.SQLRequest = {dsn: sourceRequest.dsn, database: sourceRequest.database, query: ""};
  return await listTablesSQLSource(sqlRequest);
}

export async function DescribeTableSQLSource(id: t.RequestID, tableName: string): Promise<t.TableSchema> {
  const req = await get(id);
  if (req.Kind !== t.Kind.SQLSource)
    throw new Error(`request ${id} is not SQLSource`);
  const {dsn, database} = req.Data;
  return await describeTableSQLSource({dsn, database}, tableName);
}

export async function CountRowsSQLSource(id: t.RequestID, tableName: string): Promise<number> {
  const req = await get(id);
  if (req.Kind !== t.Kind.SQLSource)
    throw new Error(`request ${id} is not SQLSource`);
  const {dsn, database} = req.Data;
  return await countRowsSQLSource({dsn, database}, tableName);
}

export async function ListEndpointsHTTPSource(id: t.RequestID): Promise<t.EndpointInfo[]> {
  const req = await get(id);
  if (req.Kind !== t.Kind.HTTPSource)
    throw new Error(`request ${id} is not HTTPSource`);
  const sourceRequest = req.Data;
  const specData = await fetchSpec(sourceRequest);
  return parseSpec(specData);
}

export async function GenerateExampleRequestHTTPSource(id: t.RequestID, endpointIndex: number): Promise<t.HTTPRequest> {
  const req = await get(id);
  if (req.Kind !== t.Kind.HTTPSource)
    throw new Error(`request ${id} is not HTTPSource`);

  const sourceRequest = req.Data;
  const spec = await fetchSpec(sourceRequest);
  const endpoints = parseSpec(spec);
  if (endpointIndex < 0 || endpointIndex >= endpoints.length)
    throw new Error(`invalid endpoint index ${endpointIndex}`);

  return generateExampleRequest(endpoints[endpointIndex], sourceRequest.serverUrl, sourceRequest.auth);
}

export async function PerformVirtualEndpointHTTPSource(sourceID: t.RequestID, endpointIndex: number, modifiedRequest?: Partial<t.HTTPRequest>): Promise<Record<string, unknown>> {
  // Perform an HTTP request generated from the OpenAPI spec
  const j = await load();
  const req = j[sourceID];
  if (req.Kind !== t.Kind.HTTPSource)
    throw new Error(`request ${sourceID} is not HTTPSource`);

  const spec = await fetchSpec(req.Data);
  const endpoints = parseSpec(spec);
  if (endpointIndex < 0 || endpointIndex >= endpoints.length)
    throw new Error(`invalid endpoint index ${endpointIndex}`);

  const exampleRequest = generateExampleRequest(endpoints[endpointIndex], req.Data.serverUrl, req.Data.auth);
  // Merge with modified request if provided
  const finalRequest = exampleRequest;
  if (modifiedRequest !== undefined) {
    // Merge fields from modifiedRequest into exampleRequest
    finalRequest.method = modifiedRequest.method ?? finalRequest.method;
    finalRequest.url = modifiedRequest.url ?? finalRequest.url;
    finalRequest.body = modifiedRequest.body ?? finalRequest.body;
    if ((modifiedRequest.headers ?? []).length > 0) {
      finalRequest.headers = modifiedRequest.headers!;
    }
  }

  const sent_at = new Date();
  const result = await sendHTTP(finalRequest);
  const received_at = new Date();
  return {
    RequestId:   sourceID,
    sent_at:     sent_at.toISOString(),
    received_at: received_at.toISOString(),
    request:     finalRequest,
    response:    result,
  };
}

export async function TestHTTPSource(id: t.RequestID): Promise<void> {
  const req = await get(id);
  if (req.Kind !== t.Kind.HTTPSource)
    throw new Error(`request ${id} is not HTTPSource`);
  const sourceRequest = req.Data;
  // Verify spec is parseable
  const specData = await fetchSpec(sourceRequest);
  parseSpec(specData);
}

export async function FetchSpecHTTPSource(id: t.RequestID): Promise<void> {
  const req = await get(id);
  if (req.Kind !== t.Kind.HTTPSource)
    throw new Error(`request ${id} is not HTTPSource`);
  const sourceRequest = req.Data;
  const specData = await fetchSpec(sourceRequest);
  if (specData === "")
    throw new Error("no spec data");
  // TODO: use(return?) specData
}
