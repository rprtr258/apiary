import * as t from "@/types.ts";

type Versions = {
  node: () => string,
  chrome: () => string,
  electron: () => string,
};

export type {Versions};

// The declared IPC contract. As a checked .ts module (not a .d.ts, which
// skipLibCheck hides from both bun check and tsc) drift here fails the build
// through preload.ts's `const api: Api` assignment below it.
export type Api = {
  List:      (                               ) => Promise<t.ListResponse>,
  Get:       (_1: string                     ) => Promise<t.GetResponse>,
  Create:    (_1: string, _2: t.Kind, _3?: Partial<t.RequestPayload>) => Promise<t.RequestID>,
  Duplicate: (_1: string                     ) => Promise<t.RequestID>,
  CreateDraft: (_1: t.Kind, _2?: Partial<t.RequestPayload>) => Promise<t.RequestID>,
  Rename:    (_1: string, _2: string         ) => Promise<void>,
  Move:      (_1: t.TreeChild, _2: string, _3: t.TreeChild[]) => Promise<void>,
  Update:    (_1: string, _2: t.RequestPayload) => Promise<void>,
  Delete:    (_1: string                     ) => Promise<void>,
  DeleteDir: (_1: string                     ) => Promise<void>,
  Perform:   (_1: string                     ) => Promise<t.HistoryEntry>,
  GRPC: {
    Methods:       (_1: string                        ) => Promise<Record<string, string[]>>,
    QueryFake:     (_1: string, _2: string            ) => Promise<string>,
    QueryValidate: (_1: string, _2: string, _3: string) => Promise<void>,
  },
  SQL: {
    Explain: (_1: string) => Promise<t.SQLExplain>,
  },
  SQLSource: {
    Perform:       (_1: string, _2: t.TableRead) => Promise<t.HistoryEntry>,
    Test:          (_1: string            ) => Promise<void>,
    ListTables:    (_1: string            ) => Promise<t.TableInfo[]>,
    DescribeTable: (_1: string, _2: string) => Promise<t.TableSchema>,
    CountRows:     (_1: string, _2: string, _3: t.TableFilter) => Promise<number>,
    UpdateTableRows: (_1: string, _2: string, _3: string[], _4: t.CellUpdate[]) => Promise<t.SQLResponse>,
    BuildTableUpdate: (_1: string, _2: string, _3: string[], _4: t.CellUpdate[]) => Promise<string>,
  },
  HTTPSource: {
    ListEndpoints:          (_1: string                               ) => Promise<t.EndpointInfo[]>,
    GenerateExampleRequest: (_1: string, _2: t.EndpointKey            ) => Promise<t.HTTPRequest>,
    PerformVirtualEndpoint: (_1: string, _2: t.EndpointKey, _3: t.HTTPRequest) => Promise<t.HistoryEntry>,
    Test:                   (_1: string                               ) => Promise<void>,
  },
  MCP: {
    ListItems:  (_1: string                             ) => Promise<t.MCPListItems>,
    ReadResource: (_1: string, _2: string) => Promise<t.MCPReadResource>,
    CallTool:   (_1: string, _2: string, _3: t.JSONValue) => Promise<unknown>,
    CallPrompt: (_1: string, _2: string, _3: t.JSONValue) => Promise<unknown>,
    Complete:   (_1: string, _2: t.MCPCompleteParams) => Promise<t.MCPCompletion>,
  },
};

declare global {
  interface Window {
    versions: Versions,
    api: Api,
  }
}
