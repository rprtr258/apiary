import {contextBridge, ipcRenderer} from "electron";
// import * as t from "./types/models.ts";

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // we can also expose variables, not just functions
});
contextBridge.exposeInMainWorld("api", {
  // CountRowsSQLSource: (arg1:string,arg2:string) => Promise<number> = async () => 0,
  // Create: (arg1:string,arg2:t.Kind) => Promise<t.ResponseNewRequest> = async () => t.ResponseNewRequest.createFrom({}),
  // Delete: (arg1:string) => Promise<void> = async () => {},
  // DescribeTableSQLSource: (arg1:string,arg2:string) => Promise<t.TableSchema> = async () => t.TableSchema.createFrom({}),
  // Duplicate: (arg1:string) => Promise<t.ResponseNewRequest> = async () => t.ResponseNewRequest.createFrom({}),
  // FetchSpecHTTPSource: (arg1:string) => Promise<void> = async () => {},
  // GRPCMethods: (arg1:string) => Promise<t.grpcServiceMethods[]> = async () => [t.grpcServiceMethods.createFrom({})],
  // GRPCQueryFake: (arg1:string,arg2:string) => Promise<string> = async () => "",
  // GRPCQueryValidate: (arg1:string,arg2:string,arg3:string) => Promise<void> = async () => {},
  // GenerateExampleRequestHTTPSource: (arg1:string,arg2:number) => Promise<t.HTTPRequest> = async () => t.HTTPRequest.createFrom({}),
  Get: (arg1: string) => ipcRenderer.invoke("get-request", arg1),
  // JQ: (arg1:string,arg2:string) => Promise<string[]> = async () => [],
  List: () => ipcRenderer.invoke("list-requests"),
  // ListEndpointsHTTPSource: (arg1:string) => Promise<t.EndpointInfo[]> = async () => [],
  // ListTablesSQLSource: (arg1:string) => Promise<t.TableInfo[]> = async () => [],
  // Perform: (arg1:string) => Promise<Record<string, any>> = async () => ({}),
  // PerformSQLSource: (arg1:string,arg2:string) => Promise<Record<string, any>> = async () => ({}),
  // PerformVirtualEndpointHTTPSource: (arg1:string,arg2:number,arg3:t.HTTPRequest) => Promise<Record<string, any>> = async () => ({}),
  // Read: (arg1:string) => Promise<t.Request> = async () => t.Request.createFrom({}),
  // Rename: (arg1:string,arg2:string) => Promise<void> = async () => {},
  // TestHTTPSource: (arg1:string) => Promise<void> = async () => {},
  // TestSQLSource: (arg1:string) => Promise<void> = async () => {},
  // Update: (arg1:string,arg2:t.Kind,arg3:Record<string, any>) => Promise<void> = async () => {},
});
