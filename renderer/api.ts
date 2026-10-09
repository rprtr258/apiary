import * as t from "@/types.ts";
import {Result, try_} from "@/result.ts";
import {Request} from "../main/db.ts";

const Api = window.api;

// TODO: remove, just use new Date
function parseTime(s: string): Date {
  const d = new Date();
  d.setTime(Date.parse(s));
  return d;
};

async function wrap<T>(f: () => Promise<T>, args: unknown): Promise<Result<T>> {
  const res = await try_(f);
  if (res.kind === "ok") {
    console.log("FETCH", f, args, res.value);
  } else {
    console.log("FETCH FAIL", f, args, res.value);
  }
  return res;
}

export const api = {
  async collectionRequests(): Promise<Result<t.ListResponse>> {
    return await wrap(async () => Api.List(), {});
  },

  async get(id: t.RequestID): Promise<Result<t.GetResponse>> {
    const y = await wrap(async () => Api.Get(id), {id});
    // TODO: it seems that is not needed, remove if so
    return y.map((y: t.GetResponse) => {
      // NOTE: BEWARE, DIRTY TYPESCRIPT HACKS HERE
      const history = y.History as unknown as t.HistoryEntry[];
      for (const req of history) {
        req.sent_at = parseTime(req.sent_at as unknown as string);
      }
      return y;
    });
  },

  async requestCreate(
    name: string,
    kind: t.Kind,
  ): Promise<Result<t.RequestID>> {
    return await wrap(() => Api.Create(name, kind), {name, kind});
  },

  async requestDuplicate(
    name: string,
  ): Promise<Result<t.RequestID>> {
    return await wrap(() => Api.Duplicate(name), {name});
  },

  async request_update(
    id: t.RequestID,
    kind: t.Kind,
    req: Request["Data"],
  ): Promise<Result<void>> {
    return await wrap(() => Api.Update(id, req), {reqId: id, kind, req});
  },

  async rename(
    id: t.RequestID,
    newName: string,
  ): Promise<Result<void>> {
    return await wrap(() => Api.Rename(id, newName), {reqId: id, newName});
  },

  async requestPerform(
    id: t.RequestID,
  ): Promise<Result<t.HistoryEntry>> {
    return await wrap(() => Api.Perform(id), {reqId: id}) as Result<t.HistoryEntry>;
  },

  async requestDelete(
    id: t.RequestID,
  ): Promise<Result<void>> {
    return await wrap(() => Api.Delete(id), {reqId: id});
  },

  async grpcMethods(target: string): Promise<Result<Record<string, string[]>>> {
    return await wrap(() => Api.GRPC.Methods(target), {target});
  },

  async requestPerformSQLSource(
    id: t.RequestID,
    read: t.TableRead,
  ): Promise<Result<t.HistoryEntry>> {
    return await wrap(() => Api.SQLSource.Perform(id, read), {reqId: id, table: read.table}) as Result<t.HistoryEntry>;
  },

  async requestTestSQLSource(
    id: t.RequestID,
  ): Promise<Result<void>> {
    return await wrap(() => Api.SQLSource.Test(id), {reqId: id});
  },

  async requestListTablesSQLSource(
    id: t.RequestID,
  ): Promise<Result<t.TableInfo[]>> {
    return await wrap(() => Api.SQLSource.ListTables(id), {reqId: id});
  },

  async requestDescribeTableSQLSource(
    id: t.RequestID,
    tableName: string,
  ): Promise<Result<t.TableSchema>> {
    return await wrap(() => Api.SQLSource.DescribeTable(id, tableName), {reqId: id, tableName});
  },

  async requestCountRowsSQLSource(
    id: t.RequestID,
    tableName: string,
    filter: t.TableFilter,
  ): Promise<Result<number>> {
    return await wrap(() => Api.SQLSource.CountRows(id, tableName, filter), {reqId: id, tableName});
  },

  async requestUpdateTableRowsSQLSource(
    id: t.RequestID,
    tableName: string,
    pkColumns: string[],
    updates: t.CellUpdate[],
  ): Promise<Result<t.SQLResponse>> {
    return await wrap(() => Api.SQLSource.UpdateTableRows(id, tableName, pkColumns, updates), {reqId: id, tableName});
  },

  async requestBuildTableUpdateSQLSource(
    id: t.RequestID,
    tableName: string,
    pkColumns: string[],
    updates: t.CellUpdate[],
  ): Promise<Result<string>> {
    return await wrap(() => Api.SQLSource.BuildTableUpdate(id, tableName, pkColumns, updates), {reqId: id, tableName});
  },

  async requestListEndpointsHTTPSource(
    id: t.RequestID,
  ): Promise<Result<t.EndpointInfo[]>> {
    return await wrap(() => Api.HTTPSource.ListEndpoints(id), {reqId: id});
  },

  async requestGenerateExampleRequestHTTPSource(
    id: t.RequestID,
    key: t.EndpointKey,
  ): Promise<Result<t.HTTPRequest>> {
    return await wrap(() => Api.HTTPSource.GenerateExampleRequest(id, key), {reqId: id, key});
  },

  async requestPerformVirtualEndpointHTTPSource(
    sourceID: string,
    key: t.EndpointKey,
    request: t.HTTPRequest,
  ): Promise<Result<t.HistoryEntry>> {
    // The Go function expects *t.HTTPRequest (pointer) which can be nil
    // The TypeScript definition doesn't reflect this, so we need to cast
    return await wrap(() => Api.HTTPSource.PerformVirtualEndpoint(sourceID, key, request),
      {sourceID, key, request}) as Result<t.HistoryEntry>;
  },

  async requestTestHTTPSource(
    id: t.RequestID,
  ): Promise<Result<void>> {
    return await wrap(() => Api.HTTPSource.Test(id), {reqId: id});
  },

  async mcpListItems(
    id: t.RequestID,
  ): Promise<Result<t.MCPListItems>> {
    return await wrap(() => Api.MCP.ListItems(id), {reqId: id});
  },

  async mcpCallTool(
    id: t.RequestID,
    toolName: string,
    args: t.JSONValue,
  ): Promise<Result<unknown>> {
    return await wrap(() => Api.MCP.CallTool(id, toolName, args), {reqId: id, toolName, args});
  },

  async mcpCallPrompt(
    id: t.RequestID,
    promptName: string,
    args: t.JSONValue,
  ): Promise<Result<unknown>> {
    return await wrap(() => Api.MCP.CallPrompt(id, promptName, args), {reqId: id, promptName, args});
  },

  async mcpComplete(
    id: t.RequestID,
    params: t.MCPCompleteParams,
  ): Promise<Result<t.MCPCompletion>> {
    return await wrap(() => Api.MCP.Complete(id, params), {reqId: id, argument: params.argument});
  },
};
