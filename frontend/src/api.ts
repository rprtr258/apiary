import * as App from "../wailsjs/go/app/App.js";
import {app, database} from "../wailsjs/go/models.ts";
import {Result, err, ok} from "./result.ts";
import {HistoryEntry, RequestData} from "./types.ts";

function parseTime(s: string): Date {
  const d = new Date();
  d.setTime(Date.parse(s));
  return d;
};

async function wrap<T>(f: () => Promise<T>, args: unknown): Promise<Result<T>> {
  try {
    const res = await f();
    console.log("FETCH", f, args, res);
    return ok(res);
  } catch (e) {
    console.log("FETCH FAIL", f, args, e);
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
      const history = y.History as unknown as HistoryEntry[];
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
    newName: string,
  ): Promise<Result<void>> {
    return await wrap(() => App.Rename(id, newName), {reqId: id, newName});
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
    return await wrap(() => App.PerformSQLSource(id, query), {reqId: id, query}) as Result<HistoryEntry>;
  },

  async requestTestSQLSource(
    id: string,
  ): Promise<Result<void>> {
    return await wrap(() => App.TestSQLSource(id), {reqId: id});
  },

  async requestListTablesSQLSource(
    id: string,
  ): Promise<Result<database.TableInfo[]>> {
    return await wrap(() => App.ListTablesSQLSource(id), {reqId: id});
  },

  async requestDescribeTableSQLSource(
    id: string,
    tableName: string,
  ): Promise<Result<database.TableSchema>> {
    return await wrap(() => App.DescribeTableSQLSource(id, tableName), {reqId: id, tableName});
  },

  async requestCountRowsSQLSource(
    id: string,
    tableName: string,
  ): Promise<Result<number>> {
    return await wrap(() => App.CountRowsSQLSource(id, tableName), {reqId: id, tableName});
  },

  async requestListEndpointsHTTPSource(
    id: string,
  ): Promise<Result<database.EndpointInfo[]>> {
    return await wrap(() => App.ListEndpointsHTTPSource(id), {reqId: id});
  },

  async requestGenerateExampleRequestHTTPSource(
    id: string,
    endpointIndex: number,
  ): Promise<Result<database.HTTPRequest>> {
    return await wrap(() => App.GenerateExampleRequestHTTPSource(id, endpointIndex), {reqId: id, endpointIndex});
  },

  async requestPerformVirtualEndpointHTTPSource(
    sourceID: string,
    endpointIndex: number,
    request: database.HTTPRequest,
  ): Promise<Result<HistoryEntry>> {
    // The Go function expects *database.HTTPRequest (pointer) which can be nil
    // The TypeScript definition doesn't reflect this, so we need to cast
    return await wrap(() => App.PerformVirtualEndpointHTTPSource(sourceID, endpointIndex, request),
      {sourceID, endpointIndex, request}) as Result<HistoryEntry>;
  },

  async requestTestHTTPSource(
    id: string,
  ): Promise<Result<void>> {
    return await wrap(() => App.TestHTTPSource(id), {reqId: id});
  },
};
