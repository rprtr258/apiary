import {contextBridge, ipcRenderer} from "electron/renderer";
import * as t from "./shared/types/models.ts";
import {Request} from "./db.ts";
import {type Api} from "./global.ts";

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

const api: Api = {
  CountRowsSQLSource:               (a1: string, a2: string                   ): Promise<number>                  => ipcRenderer.invoke("CountRowsSQLSource",               a1, a2    ),
  Create:                           (a1: string, a2: t.Kind                   ): Promise<t.RequestID>             => ipcRenderer.invoke("Create",                           a1, a2    ),
  Delete:                           (a1: string                               ): Promise<void>                    => ipcRenderer.invoke("Delete",                           a1        ),
  DescribeTableSQLSource:           (a1: string, a2: string                   ): Promise<t.TableSchema>           => ipcRenderer.invoke("DescribeTableSQLSource",           a1, a2    ),
  Duplicate:                        (a1: string                               ): Promise<t.RequestID>             => ipcRenderer.invoke("Duplicate",                        a1        ),
  FetchSpecHTTPSource:              (a1: string                               ): Promise<void>                    => ipcRenderer.invoke("FetchSpecHTTPSource",              a1        ),
  GRPCMethods:                      (a1: string                               ): Promise<t.grpcServiceMethods[]>  => ipcRenderer.invoke("GRPCMethods",                      a1        ),
  GRPCQueryFake:                    (a1: string, a2: string                   ): Promise<string>                  => ipcRenderer.invoke("GRPCQueryFake",                    a1, a2    ),
  GRPCQueryValidate:                (a1: string, a2: string, a3: string       ): Promise<void>                    => ipcRenderer.invoke("GRPCQueryValidate",                a1, a2, a3),
  GenerateExampleRequestHTTPSource: (a1: string, a2: number                   ): Promise<t.HTTPRequest>           => ipcRenderer.invoke("GenerateExampleRequestHTTPSource", a1, a2    ),
  Get:                              (a1: string                               ): Promise<t.GetResponse>           => ipcRenderer.invoke("Get",                              a1        ),
  List:                             (                                         ): Promise<t.ListResponse>          => ipcRenderer.invoke("List"                                        ),
  ListEndpointsHTTPSource:          (a1: string                               ): Promise<t.EndpointInfo[]>        => ipcRenderer.invoke("ListEndpointsHTTPSource",          a1        ),
  ListTablesSQLSource:              (a1: string                               ): Promise<t.TableInfo[]>           => ipcRenderer.invoke("ListTablesSQLSource",              a1        ),
  Perform:                          (a1: string                               ): Promise<Record<string, unknown>> => ipcRenderer.invoke("Perform",                          a1        ),
  PerformSQLSource:                 (a1: string, a2: string                   ): Promise<Record<string, unknown>> => ipcRenderer.invoke("PerformSQLSource",                 a1, a2    ),
  PerformVirtualEndpointHTTPSource: (a1: string, a2: number, a3: t.HTTPRequest): Promise<Record<string, unknown>> => ipcRenderer.invoke("PerformVirtualEndpointHTTPSource", a1, a2, a3),
  Read:                             (a1: string                               ): Promise<t.Request>               => ipcRenderer.invoke("Read",                             a1        ),
  Rename:                           (a1: string, a2: string                   ): Promise<void>                    => ipcRenderer.invoke("Rename",                           a1, a2    ),
  TestHTTPSource:                   (a1: string                               ): Promise<void>                    => ipcRenderer.invoke("TestHTTPSource",                   a1        ),
  TestSQLSource:                    (a1: string                               ): Promise<void>                    => ipcRenderer.invoke("TestSQLSource",                    a1        ),
  Update:                           (a1: string, a2: Request["Data"]          ): Promise<void>                    => ipcRenderer.invoke("Update",                           a1, a2    ),
};
contextBridge.exposeInMainWorld("api", api);
