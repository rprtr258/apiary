import * as t from "./types/models.ts";

// Type declarations for Electron preload bridge.

interface Versions {
  node: () => string,
  chrome: () => string,
  electron: () => string,
}

interface Api {
  CountRowsSQLSource: (arg1:string,arg2:string) => Promise<number>,
  Create: (arg1:string,arg2:t.Kind) => Promise<t.ResponseNewRequest>,
  Delete: (arg1:string) => Promise<void>,
  DescribeTableSQLSource: (arg1:string,arg2:string) => Promise<t.TableSchema>,
  Duplicate: (arg1:string) => Promise<t.ResponseNewRequest>,
  FetchSpecHTTPSource: (arg1:string) => Promise<void>,
  GRPCMethods: (arg1:string) => Promise<t.grpcServiceMethods[]>,
  GRPCQueryFake: (arg1:string,arg2:string) => Promise<string>,
  GRPCQueryValidate: (arg1:string,arg2:string,arg3:string) => Promise<void>,
  GenerateExampleRequestHTTPSource: (arg1:string,arg2:number) => Promise<t.HTTPRequest>,
  Get: (arg1:string) => Promise<t.GetResponse>,
  JQ: (arg1:string,arg2:string) => Promise<string[]>,
  List: () => Promise<t.ListResponse>,
  ListEndpointsHTTPSource: (arg1:string) => Promise<t.EndpointInfo[]>,
  ListTablesSQLSource: (arg1:string) => Promise<t.TableInfo[]>,
  Perform: (arg1:string) => Promise<Record<string, any>>,
  PerformSQLSource: (arg1:string,arg2:string) => Promise<Record<string, any>>,
  PerformVirtualEndpointHTTPSource: (arg1:string,arg2:number,arg3:t.HTTPRequest) => Promise<Record<string, any>>,
  Read: (arg1:string) => Promise<t.Request>,
  Rename: (arg1:string,arg2:string) => Promise<void>,
  TestHTTPSource: (arg1:string) => Promise<void>,
  TestSQLSource: (arg1:string) => Promise<void>,
  Update: (arg1:string,arg2:t.Kind,arg3:Record<string, any>) => Promise<void>,
}

declare global {
  interface Window {
    versions: Versions,
    api: Api,
  }
}

export {};
