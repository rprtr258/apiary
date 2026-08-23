import {Request} from "./db.ts";
import * as t from "@/types.ts";

type Versions = {
  node: () => string,
  chrome: () => string,
  electron: () => string,
};

export type Api = {
  List:      (                               ) => Promise<t.ListResponse>,
  Get:       (_1: string                     ) => Promise<t.GetResponse>,
  Create:    (_1: string, _2: t.Kind         ) => Promise<t.ResponseNewRequest>,
  Duplicate: (_1: string                     ) => Promise<t.ResponseNewRequest>,
  Read:      (_1: string                     ) => Promise<t.Request>,
  Rename:    (_1: string, _2: string         ) => Promise<void>,
  Update:    (_1: string, _2: Request["Data"]) => Promise<void>,
  Delete:    (_1: string                     ) => Promise<void>,
  Perform:   (_1: string                     ) => Promise<Record<string, unknown>>,
  GRPC: {
    Methods:       (_1: string                        ) => Promise<Record<string, string[]>>,
    QueryFake:     (_1: string, _2: string            ) => Promise<string>,
    QueryValidate: (_1: string, _2: string, _3: string) => Promise<void>,
  },
  SQLSource: {
    Perform:       (_1: string, _2: string) => Promise<Record<string, unknown>>,
    Test:          (_1: string            ) => Promise<void>,
    ListTables:    (_1: string            ) => Promise<t.TableInfo[]>,
    DescribeTable: (_1: string, _2: string) => Promise<t.TableSchema>,
    CountRows:     (_1: string, _2: string) => Promise<number>,
  },
  HTTPSource: {
    ListEndpoints:          (_1: string                               ) => Promise<t.EndpointInfo[]>,
    GenerateExampleRequest: (_1: string, _2: number                   ) => Promise<t.HTTPRequest>,
    PerformVirtualEndpoint: (_1: string, _2: number, _3: t.HTTPRequest) => Promise<Record<string, unknown>>,
    Test:                   (_1: string                               ) => Promise<void>,
    FetchSpec:              (_1: string                               ) => Promise<void>,
  },
};

declare global {
  type Window = {
    versions: Versions,
    api: Api,
  };
}
