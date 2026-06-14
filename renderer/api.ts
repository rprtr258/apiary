import * as t from "@/types/models.ts";
import {Result, try_} from "./result.ts";
import {HistoryEntry, RequestData} from "@/types/types.ts";
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

  async get(id: string): Promise<Result<t.GetResponse>> {
    const y = await wrap(async () => Api.Get(id), {id});
    // TODO: it seems that is not needed, remove if so
    return y.map((y: t.GetResponse) => {
      // NOTE: BEWARE, DIRTY TYPESCRIPT HACKS HERE
      const history = y.History as unknown as HistoryEntry[];
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
    id: string,
    kind: t.Kind,
    req: Omit<RequestData, "kind">,
  ): Promise<Result<void>> {
    return await wrap(() => Api.Update(id, req as Request["Data"]), {reqId: id, kind, req});
  },

  async rename(
    id: string,
    newName: string,
  ): Promise<Result<void>> {
    return await wrap(() => Api.Rename(id, newName), {reqId: id, newName});
  },

  async requestPerform(
    id: string,
  ): Promise<Result<HistoryEntry>> {
    return await wrap(() => Api.Perform(id), {reqId: id}) as Result<HistoryEntry>;
  },

  async requestDelete(
    id: string,
  ): Promise<Result<void>> {
    return await wrap(() => Api.Delete(id), {reqId: id});
  },

  async grpcMethods(target: string): Promise<Result<Record<string, string[]>>> {
    return await wrap(() => Api.GRPCMethods(target), {target});
  },

  async requestPerformSQLSource(
    id: string,
    query: string,
  ): Promise<Result<HistoryEntry>> {
    return await wrap(() => Api.PerformSQLSource(id, query), {reqId: id, query}) as Result<HistoryEntry>;
  },

  async requestTestSQLSource(
    id: string,
  ): Promise<Result<void>> {
    return await wrap(() => Api.TestSQLSource(id), {reqId: id});
  },

  async requestListTablesSQLSource(
    id: string,
  ): Promise<Result<t.TableInfo[]>> {
    return await wrap(() => Api.ListTablesSQLSource(id), {reqId: id});
  },

  async requestDescribeTableSQLSource(
    id: string,
    tableName: string,
  ): Promise<Result<t.TableSchema>> {
    return await wrap(() => Api.DescribeTableSQLSource(id, tableName), {reqId: id, tableName});
  },

  async requestCountRowsSQLSource(
    id: string,
    tableName: string,
  ): Promise<Result<number>> {
    return await wrap(() => Api.CountRowsSQLSource(id, tableName), {reqId: id, tableName});
  },

  async requestListEndpointsHTTPSource(
    id: string,
  ): Promise<Result<t.EndpointInfo[]>> {
    return await wrap(() => Api.ListEndpointsHTTPSource(id), {reqId: id});
  },

  async requestGenerateExampleRequestHTTPSource(
    id: string,
    endpointIndex: number,
  ): Promise<Result<t.HTTPRequest>> {
    return await wrap(() => Api.GenerateExampleRequestHTTPSource(id, endpointIndex), {reqId: id, endpointIndex});
  },

  async requestPerformVirtualEndpointHTTPSource(
    sourceID: string,
    endpointIndex: number,
    request: t.HTTPRequest,
  ): Promise<Result<HistoryEntry>> {
    // The Go function expects *t.HTTPRequest (pointer) which can be nil
    // The TypeScript definition doesn't reflect this, so we need to cast
    return await wrap(() => Api.PerformVirtualEndpointHTTPSource(sourceID, endpointIndex, request),
      {sourceID, endpointIndex, request}) as Result<HistoryEntry>;
  },

  async requestTestHTTPSource(
    id: string,
  ): Promise<Result<void>> {
    return await wrap(() => Api.TestHTTPSource(id), {reqId: id});
  },
};
