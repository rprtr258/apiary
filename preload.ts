import {contextBridge, ipcRenderer} from "electron";
// import {database} from './frontend/wailsjs/go/models.ts';
// import {app} from './frontend/wailsjs/go/models.ts';

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // we can also expose variables, not just functions
});
contextBridge.exposeInMainWorld("api", {
  // CountRowsSQLSource: (arg1:string,arg2:string) => Promise<number> = async () => 0,
  // Create: (arg1:string,arg2:database.Kind) => Promise<app.ResponseNewRequest> = async () => app.ResponseNewRequest.createFrom({}),
  // Delete: (arg1:string) => Promise<void> = async () => {},
  // DescribeTableSQLSource: (arg1:string,arg2:string) => Promise<database.TableSchema> = async () => database.TableSchema.createFrom({}),
  // Duplicate: (arg1:string) => Promise<app.ResponseNewRequest> = async () => app.ResponseNewRequest.createFrom({}),
  // FetchSpecHTTPSource: (arg1:string) => Promise<void> = async () => {},
  // GRPCMethods: (arg1:string) => Promise<app.grpcServiceMethods[]> = async () => [app.grpcServiceMethods.createFrom({})],
  // GRPCQueryFake: (arg1:string,arg2:string) => Promise<string> = async () => "",
  // GRPCQueryValidate: (arg1:string,arg2:string,arg3:string) => Promise<void> = async () => {},
  // GenerateExampleRequestHTTPSource: (arg1:string,arg2:number) => Promise<database.HTTPRequest> = async () => database.HTTPRequest.createFrom({}),
  Get: (arg1: string) => ipcRenderer.invoke("get-request", arg1),
  // JQ: (arg1:string,arg2:string) => Promise<string[]> = async () => [],
  List: () => ipcRenderer.invoke("list-requests"),
  // ListEndpointsHTTPSource: (arg1:string) => Promise<database.EndpointInfo[]> = async () => [],
  // ListTablesSQLSource: (arg1:string) => Promise<database.TableInfo[]> = async () => [],
  // Perform: (arg1:string) => Promise<Record<string, any>> = async () => ({}),
  // PerformSQLSource: (arg1:string,arg2:string) => Promise<Record<string, any>> = async () => ({}),
  // PerformVirtualEndpointHTTPSource: (arg1:string,arg2:number,arg3:database.HTTPRequest) => Promise<Record<string, any>> = async () => ({}),
  // Read: (arg1:string) => Promise<database.Request> = async () => database.Request.createFrom({}),
  // Rename: (arg1:string,arg2:string) => Promise<void> = async () => {},
  // TestHTTPSource: (arg1:string) => Promise<void> = async () => {},
  // TestSQLSource: (arg1:string) => Promise<void> = async () => {},
  // Update: (arg1:string,arg2:database.Kind,arg3:Record<string, any>) => Promise<void> = async () => {},
});
