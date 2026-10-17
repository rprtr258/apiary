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
  Create:    (a1: string, a2: t.Kind         ): Promise<t.RequestID>             => ipcRenderer.invoke("Create",    a1, a2),
  Duplicate: (a1: string                     ): Promise<t.RequestID>             => ipcRenderer.invoke("Duplicate", a1    ),
  CreateDraft: (a1: t.Kind, a2?: Request["Data"]): Promise<t.RequestID>          => ipcRenderer.invoke("CreateDraft", a1, a2),
  Rename:    (a1: string, a2: string         ): Promise<void>                    => ipcRenderer.invoke("Rename",    a1, a2),
  Update:    (a1: string, a2: Request["Data"]): Promise<void>                    => ipcRenderer.invoke("Update",    a1, a2),
  Delete:    (a1: string                     ): Promise<void>                    => ipcRenderer.invoke("Delete",    a1    ),
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

// TODO: runtime
function todo<T>(..._args: unknown[]): T {
  throw new Error("Not implemented"); // TODO: remove
}

export const Log = {
  log(level: "trace" | "debug" | "info" | "warning" | "error" | "fatal", message: string): void {
    Log.Print(`[${level}] ${message}`);
  },

  Print  (message: string): void {return todo(       message);},
  Trace  (message: string): void {Log.log("trace",   message);},
  Debug  (message: string): void {Log.log("debug",   message);},
  Info   (message: string): void {Log.log("info",    message);},
  Warning(message: string): void {Log.log("warning", message);},
  Error  (message: string): void {Log.log("error",   message);},
  Fatal  (message: string): void {Log.log("fatal",   message);}, // the application will quit after calling this method.
};

export const Events = {
  // sets up a listener for the given event name, but will only trigger a given number times.
  OnMultiple(eventName: string, callback: (...data: unknown[]) => void, maxCallbacks: number): () => void {return todo(eventName, callback, maxCallbacks);},

  On(eventName: string, callback: (...data: unknown[]) => void): () => void {return Events.OnMultiple(eventName, callback, -1);},

  Off(eventName: string, ...additionalEventNames: string[]): void {return todo(eventName, ...additionalEventNames);},

  OffAll(): void {return todo();},

  Once(eventName: string, callback: (...data: unknown[]) => void): () => void {return Events.OnMultiple(eventName, callback, 1);},

  Emit(eventName: string, ...data: unknown[]): void {return todo(eventName, data);},
};

type Theme = "light" | "dark";

export const Window = {
  get system_default_theme(): Theme {return todo();},
  set theme(v: Theme) {todo(v);},

  // Forces a reload by the main application as well as connected browsers.
  Reload(): void {return todo();},

  ReloadApp(): void {return todo();},

  set always_on_top(b: boolean) {todo(b);},

  Center(): void {return todo();},

  SetTitle(title: string): void {return todo(title);},

  set fullscreen(value: boolean) {
    if (value) todo(value); // Makes the window full screen
    else todo(value); // Restores the previous window dimensions and position prior to full screen
  },
  get fullscreen(): Promise<boolean> {return todo();},

  get size(): Promise<{width: number, height: number}> {return todo();},
  set size({width, height}: {width: number, height: number}) {todo(width, height);},

  // Sets the maximum window size. Will resize the window if the window is currently larger than the given dimensions.
  // Setting a size of 0,0 will disable this constraint.
  set max_size({width, height}: {width: number, height: number}) {todo(width, height);},

  // Sets the minimum window size. Will resize the window if the window is currently smaller than the given dimensions.
  // Setting a size of 0,0 will disable this constraint.
  set min_size({width, height}: {width: number, height: number}) {todo(width, height);},

  // window position relative to the monitor the window is currently on
  get position(): Promise<{x: number, y: number}> {return todo();},
  set position({x, y}: {x: number, y: number}) {todo(x, y);},

  set display(v: boolean) {
    if (v)
      todo();
    else
      todo();
  },

  async ToggleMaximise(): Promise<void> {
    this.maximised = !await this.maximised;
  },

  set maximised(b: boolean) {
    if (b)
      todo();
    else
      // Restores the window to the dimensions and position prior to maximising
      todo();
  },
  get maximised(): Promise<boolean> {return todo();},

  set minimised(b: boolean) {
    if (b)
      todo();
    else
      // Restores the window to the dimensions and position prior to minimising
      todo();
  },
  get minimised(): Promise<boolean> {return todo();},

  // Sets the background colour of the window to the given RGBA colour definition. This colour will show through for all transparent pixels.
  set background_color({R, G, B, A}: {R: number, G: number, B: number, A: number}) {todo(R, G, B, A);},

  get is_normal(): Promise<boolean> {return todo();},
};

export type Screen = {
  isCurrent: boolean,
  isPrimary: boolean,
  width: number,
  height: number,
};

// Gets the all screens. Call this anew each time you want to refresh data from the underlying windowing system.
export function ScreenGetAll(): Promise<Screen[]> {return todo();}

export function BrowserOpenURL(_url: string): void {return todo();}

export type EnvironmentInfo = {
  buildType: string,
  platform: string,
  arch: string,
};

export function Environment(): Promise<EnvironmentInfo> {return todo();}

export function Quit(): void {return todo();}

export function Hide(): void {return todo();}

export function Show(): void {return todo();}

export const Clipboard = {
  get text(): Promise<string> {return todo();},
  set text(text: string) {todo(text);},
};

// OnFileDrop listens to drag and drop events and calls the callback with the coordinates of the drop and an array of path strings.
export function OnFileDrop(
  callback: ( // Callback for OnFileDrop returns a slice of file path strings when a drop is finished.
    x: number,
    y: number,
    paths: string[],
  ) => void,
  useDropTarget: boolean, // Only call the callback when the drop finished on an element that has the drop target style (--wails-drop-target)
): void {return todo(callback, useDropTarget);}

export function OnFileDropOff(): void {return todo();}

export function CanResolveFilePaths(): boolean {return todo();}

export function ResolveFilePaths(files: File[]): void {return todo(files);}
