import * as database from "./frontend/wailsjs/go/models.ts";
import * as app from "./frontend/wailsjs/go/models.ts";

// Type declarations for Electron preload bridge.

interface Versions {
  node: () => string,
  chrome: () => string,
  electron: () => string,
}

interface Api {
  CountRowsSQLSource: (arg1:string,arg2:string) => Promise<number>,
  Create: (arg1:string,arg2:database.Kind) => Promise<app.ResponseNewRequest>,
  Delete: (arg1:string) => Promise<void>,
  DescribeTableSQLSource: (arg1:string,arg2:string) => Promise<database.TableSchema>,
  Duplicate: (arg1:string) => Promise<app.ResponseNewRequest>,
  FetchSpecHTTPSource: (arg1:string) => Promise<void>,
  GRPCMethods: (arg1:string) => Promise<Array<app.grpcServiceMethods>>,
  GRPCQueryFake: (arg1:string,arg2:string) => Promise<string>,
  GRPCQueryValidate: (arg1:string,arg2:string,arg3:string) => Promise<void>,
  GenerateExampleRequestHTTPSource: (arg1:string,arg2:number) => Promise<database.HTTPRequest>,
  Get: (arg1:string) => Promise<app.GetResponse>,
  JQ: (arg1:string,arg2:string) => Promise<Array<string>>,
  List: () => Promise<app.ListResponse>,
  ListEndpointsHTTPSource: (arg1:string) => Promise<Array<database.EndpointInfo>>,
  ListTablesSQLSource: (arg1:string) => Promise<Array<database.TableInfo>>,
  Perform: (arg1:string) => Promise<Record<string, any>>,
  PerformSQLSource: (arg1:string,arg2:string) => Promise<Record<string, any>>,
  PerformVirtualEndpointHTTPSource: (arg1:string,arg2:number,arg3:database.HTTPRequest) => Promise<Record<string, any>>,
  Read: (arg1:string) => Promise<database.Request>,
  Rename: (arg1:string,arg2:string) => Promise<void>,
  TestHTTPSource: (arg1:string) => Promise<void>,
  TestSQLSource: (arg1:string) => Promise<void>,
  Update: (arg1:string,arg2:database.Kind,arg3:Record<string, any>) => Promise<void>,
}

declare global {
  interface Window {
    versions: Versions,
    api: Api,
  }
}

export {};
