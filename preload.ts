import {contextBridge, ipcRenderer} from "electron";
import * as t from "./types/models.ts";
import {Request} from "./db.ts";

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

contextBridge.exposeInMainWorld("api", {
  CountRowsSQLSource:               (arg1: string, arg2: string                       ): Promise<number>                  => ipcRenderer.invoke("CountRowsSQLSource",               arg1, arg2      ),
  Create:                           (arg1: string, arg2: t.Kind                       ): Promise<t.ResponseNewRequest>    => ipcRenderer.invoke("Create",                           arg1, arg2      ),
  Delete:                           (arg1: string                                     ): Promise<void>                    => ipcRenderer.invoke("Delete",                           arg1            ),
  DescribeTableSQLSource:           (arg1: string, arg2: string                       ): Promise<t.TableSchema>           => ipcRenderer.invoke("DescribeTableSQLSource",           arg1, arg2      ),
  Duplicate:                        (arg1: string                                     ): Promise<t.ResponseNewRequest>    => ipcRenderer.invoke("Duplicate",                        arg1            ),
  FetchSpecHTTPSource:              (arg1: string                                     ): Promise<void>                    => ipcRenderer.invoke("FetchSpecHTTPSource",              arg1            ),
  GRPCMethods:                      (arg1: string                                     ): Promise<t.grpcServiceMethods[]>  => ipcRenderer.invoke("GRPCMethods",                      arg1            ),
  GRPCQueryFake:                    (arg1: string, arg2: string                       ): Promise<string>                  => ipcRenderer.invoke("GRPCQueryFake",                    arg1, arg2      ),
  GRPCQueryValidate:                (arg1: string, arg2: string, arg3: string         ): Promise<void>                    => ipcRenderer.invoke("GRPCQueryValidate",                arg1, arg2, arg3),
  GenerateExampleRequestHTTPSource: (arg1: string, arg2: number                       ): Promise<t.HTTPRequest>           => ipcRenderer.invoke("GenerateExampleRequestHTTPSource", arg1, arg2      ),
  Get:                              (arg1: string                                     ): Promise<t.GetResponse>           => ipcRenderer.invoke("Get",                              arg1            ),
  JQ:                               (arg1: string, arg2: string                       ): Promise<string[]>                => ipcRenderer.invoke("JQ",                               arg1, arg2      ),
  List:                             (                                                 ): Promise<t.ListResponse>          => ipcRenderer.invoke("List"                                              ),
  ListEndpointsHTTPSource:          (arg1: string                                     ): Promise<t.EndpointInfo[]>        => ipcRenderer.invoke("ListEndpointsHTTPSource",          arg1            ),
  ListTablesSQLSource:              (arg1: string                                     ): Promise<t.TableInfo[]>           => ipcRenderer.invoke("ListTablesSQLSource",              arg1            ),
  Perform:                          (arg1: string                                     ): Promise<Record<string, unknown>> => ipcRenderer.invoke("Perform",                          arg1            ),
  PerformSQLSource:                 (arg1: string, arg2: string                       ): Promise<Record<string, unknown>> => ipcRenderer.invoke("PerformSQLSource",                 arg1, arg2      ),
  PerformVirtualEndpointHTTPSource: (arg1: string, arg2: number, arg3: t.HTTPRequest  ): Promise<Record<string, unknown>> => ipcRenderer.invoke("PerformVirtualEndpointHTTPSource", arg1, arg2, arg3),
  Read:                             (arg1: string                                     ): Promise<t.Request>               => ipcRenderer.invoke("Read",                             arg1            ),
  Rename:                           (arg1: string, arg2: string                       ): Promise<void>                    => ipcRenderer.invoke("Rename",                           arg1, arg2      ),
  TestHTTPSource:                   (arg1: string                                     ): Promise<void>                    => ipcRenderer.invoke("TestHTTPSource",                   arg1            ),
  TestSQLSource:                    (arg1: string                                     ): Promise<void>                    => ipcRenderer.invoke("TestSQLSource",                    arg1            ),
  Update:                           (arg1: string, arg2: t.Kind, arg3: Request["Data"]): Promise<void>                    => ipcRenderer.invoke("Update",                           arg1, arg2, arg3),
});
