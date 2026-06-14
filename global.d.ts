import {Request} from "./db.ts";
import * as t from "@/types.ts";

interface Versions {
  node: () => string,
  chrome: () => string,
  electron: () => string,
}

export interface Api {
  CountRowsSQLSource:               (_1: string, _2: string                   ) => Promise<number>,
  Create:                           (_1: string, _2: t.Kind                   ) => Promise<t.ResponseNewRequest>,
  Delete:                           (_1: string                               ) => Promise<void>,
  DescribeTableSQLSource:           (_1: string, _2: string                   ) => Promise<t.TableSchema>,
  Duplicate:                        (_1: string                               ) => Promise<t.ResponseNewRequest>,
  FetchSpecHTTPSource:              (_1: string                               ) => Promise<void>,
  GRPCMethods:                      (_1: string                               ) => Promise<Record<string, string[]>>,
  GRPCQueryFake:                    (_1: string, _2: string                   ) => Promise<string>,
  GRPCQueryValidate:                (_1: string, _2: string, _3: string       ) => Promise<void>,
  GenerateExampleRequestHTTPSource: (_1: string, _2: number                   ) => Promise<t.HTTPRequest>,
  Get:                              (_1: string                               ) => Promise<t.GetResponse>,
  List:                             (                                         ) => Promise<t.ListResponse>,
  ListEndpointsHTTPSource:          (_1: string                               ) => Promise<t.EndpointInfo[]>,
  ListTablesSQLSource:              (_1: string                               ) => Promise<t.TableInfo[]>,
  Perform:                          (_1: string                               ) => Promise<Record<string, unknown>>,
  PerformSQLSource:                 (_1: string, _2: string                   ) => Promise<Record<string, unknown>>,
  PerformVirtualEndpointHTTPSource: (_1: string, _2: number, _3: t.HTTPRequest) => Promise<Record<string, unknown>>,
  Read:                             (_1: string                               ) => Promise<t.Request>,
  Rename:                           (_1: string, _2: string                   ) => Promise<void>,
  TestHTTPSource:                   (_1: string                               ) => Promise<void>,
  TestSQLSource:                    (_1: string                               ) => Promise<void>,
  Update:                           (_1: string, _2: Request["Data"]          ) => Promise<void>,
}

declare global {
  interface Window {
    versions: Versions,
    api: Api,
  }
}

export {};
