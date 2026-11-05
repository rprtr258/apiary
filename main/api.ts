import * as t from "@/types.ts";
import {childrenOf, create, createDraft, extractSubKind, generateID, load, move as dbMove, save, Delete as remove, rename, update, Request, serialized} from "./db.ts";
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
  if (!(id in j.requests))
    throw new Error(`request ${id} not found`);
  return j.requests[id];
}

export async function List(): Promise<t.ListResponse> {
  const j = await load();

  const previews: Record<t.RequestID, t.requestPreview> = Object.fromEntries(Object.entries(j.requests).map(([id, req]) => [id, {
    path: req.Path,
    kind: req.Kind,
    subKind: extractSubKind(j, id),
  }]));

  // Children in the directory's persisted manual order first, unlisted ones
  // name-sorted after them (dirs and requests interleaved by name, matching
  // the old label sorting). Dirs are implied by request paths; the tree order
  // (db "tree" section) only overlays positions.
  const childName = (e: t.TreeChild): string => "r" in e ? t.pathToName(j.requests[e.r].Path) : e.d;
  const build = (dir: string): t.Tree => {
    const {ids, dirs} = childrenOf(j, dir);
    const listedKeys = new Set((j.tree[dir] ?? []).map(e => "r" in e ? `r:${e.r}` : `d:${e.d}`));
    const unlisted: t.TreeChild[] = [
      ...[...ids].filter(id => !listedKeys.has(`r:${id}`)).map(id => ({r: id} as const)),
      ...[...dirs].filter(d => !listedKeys.has(`d:${d}`)).map(d => ({d} as const)),
    ].sort((a, b) => childName(a).localeCompare(childName(b)));
    return {
      entries: [...(j.tree[dir] ?? []), ...unlisted].map((e): t.TreeEntry =>
        "r" in e
          ? {kind: "req", id: e.r}
          : {kind: "dir", name: e.d, tree: build(dir === "" ? e.d : dir + "/" + e.d)}),
    };
  };

  return {
    Tree: build(""),
    Requests: previews,
    Drafts: j.drafts,
  };
}

export async function Get(id: t.RequestID): Promise<t.GetResponse> {
  const entry = await get(id);
  return {
    Request: {
      ID: id,
      Path: entry.Path,
      Data: entry.Data,
    },
  };
}

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

export function Create(path: string, kind: t.Kind): Promise<t.RequestID> {
  return serialized(async () => {
    const j = await load();
    const emptyData = emptyRequestForKind(kind);
    return await create(j, kind, path, emptyData);
  });
}

export function CreateDraft(kind: t.Kind, data?: Request["Data"]): Promise<t.RequestID> {
  return serialized(async () => {
    if (!t.DraftableKinds.has(kind))
      throw new Error(`kind ${kind} cannot be a draft: not a performable kind`);
    const j = await load();
    return await createDraft(j, kind, data ?? emptyRequestForKind(kind));
  });
}

export function Duplicate(id: t.RequestID): Promise<t.RequestID> {
  return serialized(async () => {
    const j = await load();
    if (!(id in j.requests))
      throw new Error(`request ${id} not found`);

    const entry = j.requests[id];
    const existingPaths = new Set(Object.values(j.requests).map(e => e.Path).filter(p => p.startsWith(`${entry.Path} (copy`)));
    let newPath = `${entry.Path} (copy)`;
    for (let n = 2; existingPaths.has(newPath); n++)
      newPath = `${entry.Path} (copy ${n})`;

    const newID = generateID();
    const data = structuredClone(entry.Data);
    j.requests[newID] = {ID: newID, Path: newPath, Kind: entry.Kind, Data: data} as Request;
    await save(j);
    return newID;
  });
}

export function Delete(id: t.RequestID): Promise<void> {
  return serialized(async () => {
    const j = await load();
    await remove(j, id);
  });
}

export function Rename(id: t.RequestID, newName: string): Promise<void> {
  return serialized(async () => {
    const j = await load();
    await rename(j, id, newName);
  });
}

export function Move(drag: t.TreeChild, toDir: string, order: t.TreeChild[]): Promise<void> {
  return serialized(async () => {
    const j = await load();
    await dbMove(j, drag, toDir, order);
  });
}

export function Update(id: t.RequestID, data: Request["Data"]): Promise<void> {
  return serialized(async () => {
    const j = await load();
    await update(j, id, data);
  });
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

// The send runs inside the queue so it cannot interleave with another
// mutation (e.g. the request being deleted mid-perform): the whole perform
// is one serialized read.
export function Perform(id: t.RequestID): Promise<PerformResponse> {
  return serialized(async () => {
    const j = await load();
    if (!(id in j.requests))
      throw new Error(`request ${id} not found`);

    const req = j.requests[id];

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
      response = await sql.send({...req.Data, dsn: resolveSQLRequest(j.requests, req.Data)});
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

    return {
      RequestId:   id,
      sent_at:     sent_at.toISOString(),
      received_at: received_at.toISOString(),
      request:     req.Data,
      response:    response,
    };
  });
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

export const SQL = {
  // Explain runs EXPLAIN on the request's query and returns the raw text plus
  // the plan parsed into the unified format, without saving anything to
  // history; the Plan / Plan (raw) tabs fetch it on open.
  async Explain(id: t.RequestID): Promise<t.SQLExplain> {
    const j = await load();
    if (!(id in j.requests))
      throw new Error(`request ${id} not found`);
    const req = j.requests[id];
    if (req.Kind !== t.Kind.SQL)
      throw new Error(`request ${id} is not SQL`);
    // SQL request's dsn can store a SQLSource request id; resolve it like Perform does.
    return await sql.explain({...req.Data, dsn: resolveSQLRequest(j.requests, req.Data)});
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
    const finalRequest = await this.GenerateExampleRequest(id, key);
    if (modifiedRequest !== undefined) {
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
    const specData = await http_source.fetchSpec(sourceRequest);
    void(await http_source.parseSpec(specData)); // TODO: use/return?
  },
};

export const MCP = {
  async ListItems(id: t.RequestID): Promise<t.MCPListItems> {
    const req = await get(id);
    if (req.Kind !== t.Kind.MCP)
      throw new Error(`request ${id} is not MCP`);
    const [tools, prompts, resources] = await Promise.all([
      mcp.listTools(req.Data),
      mcp.listPrompts(req.Data),
      mcp.listResources(req.Data),
    ]);
    return {tools, prompts, resources};
  },

  async ReadResource(id: t.RequestID, uri: string): Promise<t.MCPReadResource> {
    const req = await get(id);
    if (req.Kind !== t.Kind.MCP)
      throw new Error(`request ${id} is not MCP`);
    return await mcp.readResource(req.Data, uri);
  },

  async CallTool(id: t.RequestID, toolName: string, args: t.JSONValue): Promise<unknown> {
    const req = await get(id);
    if (req.Kind !== t.Kind.MCP)
      throw new Error(`request ${id} is not MCP`);
    return await mcp.callTool(req.Data, toolName, args);
  },

  async CallPrompt(id: t.RequestID, promptName: string, args: t.JSONValue): Promise<unknown> {
    const req = await get(id);
    if (req.Kind !== t.Kind.MCP)
      throw new Error(`request ${id} is not MCP`);
    return await mcp.callPrompt(req.Data, promptName, args);
  },

  async Complete(id: t.RequestID, params: t.MCPCompleteParams): Promise<t.MCPCompletion> {
    const req = await get(id);
    if (req.Kind !== t.Kind.MCP)
      throw new Error(`request ${id} is not MCP`);
    return await mcp.complete(req.Data, params);
  },
};
