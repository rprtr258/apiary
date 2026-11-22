import {contextBridge, ipcRenderer} from "electron/renderer";
import * as t from "@/types.ts";
import {Request} from "./main/db.ts";
import {type Api} from "./global.ts";

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

const api: Api = {
  List:      (                               ): Promise<t.ListResponse>          => ipcRenderer.invoke("List"             ),
  Get:       (a1: string                     ): Promise<t.GetResponse>           => ipcRenderer.invoke("Get",       a1    ),
  Create:    (a1: string, a2: t.Kind, a3?: Partial<Request["Data"]>): Promise<t.RequestID> => ipcRenderer.invoke("Create", a1, a2, a3),
  Duplicate: (a1: string                     ): Promise<t.RequestID>             => ipcRenderer.invoke("Duplicate", a1    ),
  CreateDraft: (a1: t.Kind, a2?: Partial<Request["Data"]>): Promise<t.RequestID> => ipcRenderer.invoke("CreateDraft", a1, a2),
  Rename:    (a1: string, a2: string         ): Promise<void>                    => ipcRenderer.invoke("Rename",    a1, a2),
  Move:      (a1: t.TreeChild, a2: string, a3: t.TreeChild[]): Promise<void>       => ipcRenderer.invoke("Move",      a1, a2, a3),
  Update:    (a1: string, a2: Request["Data"]): Promise<void>                    => ipcRenderer.invoke("Update",    a1, a2),
  Delete:    (a1: string                     ): Promise<void>                    => ipcRenderer.invoke("Delete",    a1    ),
  DeleteDir: (a1: string                     ): Promise<void>                    => ipcRenderer.invoke("DeleteDir", a1    ),
  Perform:   (a1: string                     ): Promise<Record<string, unknown>> => ipcRenderer.invoke("Perform",   a1    ),
  GRPC: {
    Methods:       (a1: string                        ): Promise<Record<string, string[]>> => ipcRenderer.invoke("GRPC.Methods",       a1        ),
    QueryFake:     (a1: string, a2: string            ): Promise<string>                   => ipcRenderer.invoke("GRPC.QueryFake",     a1, a2    ),
    QueryValidate: (a1: string, a2: string, a3: string): Promise<void>                     => ipcRenderer.invoke("GRPC.QueryValidate", a1, a2, a3),
  },
  SQL: {
    Explain: (a1: string): Promise<t.SQLExplain> => ipcRenderer.invoke("SQL.Explain", a1),
  },
  SQLSource: {
    Perform:       (a1: string, a2: t.TableRead): Promise<Record<string, unknown>> => ipcRenderer.invoke("SQLSource.Perform",       a1, a2),
    Test:          (a1: string            ): Promise<void>                    => ipcRenderer.invoke("SQLSource.Test",          a1    ),
    ListTables:    (a1: string            ): Promise<t.TableInfo[]>           => ipcRenderer.invoke("SQLSource.ListTables",    a1    ),
    DescribeTable: (a1: string, a2: string): Promise<t.TableSchema>           => ipcRenderer.invoke("SQLSource.DescribeTable", a1, a2),
    CountRows:     (a1: string, a2: string, a3: t.TableFilter): Promise<number>                         => ipcRenderer.invoke("SQLSource.CountRows",     a1, a2, a3),
    UpdateTableRows: (a1: string, a2: string, a3: string[], a4: t.CellUpdate[]): Promise<t.SQLResponse> => ipcRenderer.invoke("SQLSource.UpdateTableRows", a1, a2, a3, a4),
    BuildTableUpdate: (a1: string, a2: string, a3: string[], a4: t.CellUpdate[]): Promise<string> => ipcRenderer.invoke("SQLSource.BuildTableUpdate", a1, a2, a3, a4),
  },
  HTTPSource: {
    ListEndpoints:          (a1: string                               ): Promise<t.EndpointInfo[]>        => ipcRenderer.invoke("HTTPSource.ListEndpoints",          a1        ),
    GenerateExampleRequest: (a1: string, a2: t.EndpointKey              ): Promise<t.HTTPRequest>           => ipcRenderer.invoke("HTTPSource.GenerateExampleRequest", a1, a2    ),
    PerformVirtualEndpoint: (a1: string, a2: t.EndpointKey, a3: t.HTTPRequest): Promise<Record<string, unknown>> => ipcRenderer.invoke("HTTPSource.PerformVirtualEndpoint", a1, a2, a3),
    Test:                   (a1: string                               ): Promise<void>                    => ipcRenderer.invoke("HTTPSource.Test",                   a1        ),
  },
  MCP: {
    ListItems:  (a1: string                             ): Promise<t.MCPListItems> => ipcRenderer.invoke("MCP.ListItems", a1        ),
    ReadResource: (a1: string, a2: string): Promise<t.MCPReadResource> => ipcRenderer.invoke("MCP.ReadResource", a1, a2),
    CallTool:   (a1: string, a2: string, a3: t.JSONValue): Promise<unknown>        => ipcRenderer.invoke("MCP.CallTool",  a1, a2, a3),
    CallPrompt: (a1: string, a2: string, a3: t.JSONValue): Promise<unknown>        => ipcRenderer.invoke("MCP.CallPrompt", a1, a2, a3),
    Complete:   (a1: string, a2: t.MCPCompleteParams): Promise<t.MCPCompletion>    => ipcRenderer.invoke("MCP.Complete",  a1, a2),
  },
};
contextBridge.exposeInMainWorld("api", api);

