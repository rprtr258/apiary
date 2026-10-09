import * as t from "@/types.ts";
import {create, createResponse, extractSubKind, generateID, load, save, Delete as remove, rename, update, Request, HistoryEntry} from "./db.ts";
import * as http from "./database/http.ts";
import * as jq from "./database/jq.ts";
import * as md from "./database/md.ts";
import * as sql from "./database/sql.ts";
import * as redis from "./database/redis.ts";
import * as diff from "./database/diff.ts";
import * as grpc from "./database/grpc.ts";
import * as http_source from "./database/http_source.ts";
import * as sql_source from "./database/sql_source.ts";
import * as mcp from "./database/mcp.ts";

async function get(id: t.RequestID): Promise<Request> {
  const j = await load();
  if (!(id in j))
    throw new Error(`request ${id} not found`);
  return j[id];
}

export async function List(): Promise<t.ListResponse> {
  const j = await load();

  const previews: Record<t.RequestID, t.requestPreview> = Object.fromEntries(Object.entries(j).map(([id, req]) => [id, {
    path: req.Path,
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
  const history = entry.Responses
    .map(h => ({
      sent_at: h.SentAt,
      received_at: h.ReceivedAt,
      kind: entry.Kind,
      request: entry.Data,
      response: h.Response,
    } as t.HistoryEntry))
    .toSorted((a, b) => a.sent_at.getTime() - b.sent_at.getTime());
  return {
    Request: {
      ID: id,
      Path: entry.Path,
      Data: entry.Data,
      Responses: entry.Responses as t.Response[],
    },
    History: history as unknown as t.Response[], // TODO: remove type casts
  };
}

// Empty request templates for each kind
function emptyRequestForKind(kind: t.Kind): Request["Data"] {
  switch (kind) {
  case t.Kind.HTTP:       return http.EmptyRequest;
  case t.Kind.SQL:        return sql.EmptyRequest;
  case t.Kind.JQ:         return jq.EmptyRequest;
  case t.Kind.MD:         return md.EmptyRequest;
  case t.Kind.REDIS:      return redis.EmptyRequest;
  case t.Kind.GRPC:       return {target: "", method: "", payload: "", metadata: []};
  case t.Kind.DIFF:       return diff.EmptyRequest;
  case t.Kind.SQLSource:  return sql_source.EmptyRequest;
  case t.Kind.HTTPSource: return {serverUrl: "", specSource: "url", specData: "", auth: {type: "none"}};
  case t.Kind.MCP:        return mcp.EmptyRequest;
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
  const existingPaths = new Set(Object.values(j).map(e => e.Path).filter(p => p.startsWith(`${entry.Path} (copy`)));
  let newPath = `${entry.Path} (copy)`;
  for (let n = 2; existingPaths.has(newPath); n++)
    newPath = `${entry.Path} (copy ${n})`;

  const newID = generateID();
  const data = structuredClone(entry.Data);
  j[newID] = {ID: newID, Path: newPath, Kind: entry.Kind, Data: data, Responses: []} as Request;
  await save(j);
  return newID;
}

export async function Delete(id: t.RequestID): Promise<void> {
  const j = await load();
  await remove(j, id);
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

// SQL request's dsn can store a SQLSource request id (selected via SelectInput in the UI);
// resolve it to the source's dsn, otherwise use the value as-is.
export function resolveSQLRequest(j: Record<t.RequestID, Request>, data: t.SQLRequest): string {
  const source = data.dsn in j ? j[data.dsn] : undefined;
  if (source === undefined || source.Kind !== t.Kind.SQLSource || source.Data.database !== data.database)
    return data.dsn;
  return source.Data.dsn;
}

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
    response = await http.send(req.Data);
    break;
  case t.Kind.JQ:
    response = await jq.send(req.Data);
    break;
  case t.Kind.MD:
    response = await md.send(req.Data);
    break;
  case t.Kind.SQL:
    response = await sql.send({...req.Data, dsn: resolveSQLRequest(j, req.Data)});
    break;
  case t.Kind.REDIS:
    response = await redis.send(req.Data);
    break;
  case t.Kind.GRPC:
    response = await grpc.send(req.Data);
    break;
  case t.Kind.DIFF:
    response = diff.send(req.Data);
    break;
  default:
    throw new Error(`Perform not yet implemented for kind ${req.Kind}`);
  }
  const received_at = new Date();

  await createResponse(j, id, {SentAt: sent_at, ReceivedAt: received_at, Response: response as HistoryEntry["Response"]} as HistoryEntry);
  return {
    RequestId:   id,
    sent_at:     sent_at.toISOString(),
    received_at: received_at.toISOString(),
    request:     req.Data,
    response:    response,
  };
}

export const GRPC = {
  async Methods(id: t.RequestID): Promise<Record<string, string[]>> {
    const req = await get(id);
    if (req.Kind !== t.Kind.GRPC)
      throw new Error(`query kind is ${req.Kind}, expected grpc`);
    return await grpc.grpcMethods(req.Data.target);
  },

  async QueryFake(target: string, method: string): Promise<string> {
    return await grpc.grpcQueryFake(target, method);
  },

  // NOTE: method fully qualified
  async QueryValidate(target: string, method: string, payload: string): Promise<void> {
    await grpc.grpcQueryValidate(target, method, payload);
  },
};

export const SQLSource = {
  async Perform(id: t.RequestID, read: t.TableRead): Promise<PerformResponse> {
    const req = await get(id);
    if (req.Kind !== t.Kind.SQLSource)
      throw new Error(`request ${id} is not SQLSource`);

    const sourceRequest = req.Data;
    const sent_at = new Date();
    const sqlRequest: t.SQLRequest = {
      dsn: sourceRequest.dsn,
      database: sourceRequest.database,
      query: await sql_source.buildReadTableQuery(sourceRequest, read),
      readOnly: sourceRequest.readOnly,
    };
    const result = await sql.send(sqlRequest);
    const received_at = new Date();
    return {
      RequestId:   id,
      sent_at:     sent_at.toISOString(),
      received_at: received_at.toISOString(),
      request:     sqlRequest,
      response:    result,
    };
  },

  async Test(id: t.RequestID): Promise<void> {
    const req = await get(id);
    if (req.Kind !== t.Kind.SQLSource)
      throw new Error(`request ${id} is not SQLSource`);
    const {dsn, database, readOnly} = req.Data;
    await sql_source.testSQLSource({dsn, database, readOnly});
  },

  async ListTables(id: t.RequestID): Promise<t.TableInfo[]> {
    const req = await get(id);
    if (req.Kind !== t.Kind.SQLSource)
      throw new Error(`request ${id} is not SQLSource`);
    const {dsn, database} = req.Data;
    return await sql.listTables({dsn, database});
  },

  async DescribeTable(id: t.RequestID, tableName: string): Promise<t.TableSchema> {
    const req = await get(id);
    if (req.Kind !== t.Kind.SQLSource)
      throw new Error(`request ${id} is not SQLSource`);
    const {dsn, database} = req.Data;
    return await sql.describeTable({dsn, database}, tableName);
  },

  async CountRows(id: t.RequestID, tableName: string, filter: t.TableFilter): Promise<number> {
    const req = await get(id);
    if (req.Kind !== t.Kind.SQLSource)
      throw new Error(`request ${id} is not SQLSource`);
    const {dsn, database} = req.Data;
    return await sql_source.countRowsSQLSource({dsn, database}, tableName, filter);
  },

  async UpdateTableRows(id: t.RequestID, tableName: string, pkColumns: string[], updates: t.CellUpdate[]): Promise<t.SQLResponse> {
    const req = await get(id);
    if (req.Kind !== t.Kind.SQLSource)
      throw new Error(`request ${id} is not SQLSource`);
    const {dsn, database, readOnly} = req.Data;
    return await sql_source.updateTableRows({dsn, database, readOnly}, tableName, pkColumns, updates);
  },

  async BuildTableUpdate(id: t.RequestID, tableName: string, pkColumns: string[], updates: t.CellUpdate[]): Promise<string> {
    const req = await get(id);
    if (req.Kind !== t.Kind.SQLSource)
      throw new Error(`request ${id} is not SQLSource`);
    const {dsn, database, readOnly} = req.Data;
    return sql_source.buildTableUpdateScript({dsn, database, readOnly}, tableName, pkColumns, updates);
  },
};

export const HTTPSource = {
  async ListEndpoints(id: t.RequestID): Promise<t.EndpointInfo[]> {
    const req = await get(id);
    if (req.Kind !== t.Kind.HTTPSource)
      throw new Error(`request ${id} is not HTTPSource`);
    const sourceRequest = req.Data;
    const specData = await http_source.fetchSpec(sourceRequest);
    return await http_source.parseSpec(specData);
  },

  async GenerateExampleRequest(id: t.RequestID, key: t.EndpointKey): Promise<t.HTTPRequest> {
    const req = await get(id);
    if (req.Kind !== t.Kind.HTTPSource)
      throw new Error(`request ${id} is not HTTPSource`);

    const sourceRequest = req.Data;
    const spec = await http_source.fetchSpec(sourceRequest);
    const endpoints = await http_source.parseSpec(spec);
    const endpoint = endpoints.find(e => e.method === key.method && e.path === key.path);
    if (endpoint === undefined)
      throw new Error(`endpoint ${key.method} ${key.path} not found in schema`);
    return http_source.generateExampleRequest(endpoint, sourceRequest.serverUrl, sourceRequest.auth);
  },

  async PerformVirtualEndpoint(id: t.RequestID, key: t.EndpointKey, modifiedRequest?: Partial<t.HTTPRequest>): Promise<Record<string, unknown>> {
    // Perform an HTTP request generated from the OpenAPI spec
    const finalRequest = await this.GenerateExampleRequest(id, key);
    // Merge with modified request if provided
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
    const result = await http.send(finalRequest);
    const received_at = new Date();
    return {
      RequestId:   id,
      sent_at:     sent_at.toISOString(),
      received_at: received_at.toISOString(),
      request:     finalRequest,
      response:    result,
    };
  },

  async Test(id: t.RequestID): Promise<void> {
    const req = await get(id);
    if (req.Kind !== t.Kind.HTTPSource)
      throw new Error(`request ${id} is not HTTPSource`);
    const sourceRequest = req.Data;
    // Verify spec is parseable
    const specData = await http_source.fetchSpec(sourceRequest);
    void(await http_source.parseSpec(specData)); // TODO: use/return?
  },
};

export const MCP = {
  async ListTools(id: t.RequestID): Promise<t.MCPTool[]> {
    const req = await get(id);
    if (req.Kind !== t.Kind.MCP)
      throw new Error(`request ${id} is not MCP`);
    return await mcp.listTools(req.Data);
  },

  async CallTool(id: t.RequestID, toolName: string, args: unknown): Promise<unknown> {
    const req = await get(id);
    if (req.Kind !== t.Kind.MCP)
      throw new Error(`request ${id} is not MCP`);
    return await mcp.callTool(req.Data, toolName, args);
  },
};
