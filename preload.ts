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
  CountRowsSQLSource:               (a1: string, a2: string                   ): Promise<number>                   => ipcRenderer.invoke("CountRowsSQLSource",               a1, a2    ),
  Create:                           (a1: string, a2: t.Kind                   ): Promise<t.RequestID>              => ipcRenderer.invoke("Create",                           a1, a2    ),
  Delete:                           (a1: string                               ): Promise<void>                     => ipcRenderer.invoke("Delete",                           a1        ),
  DescribeTableSQLSource:           (a1: string, a2: string                   ): Promise<t.TableSchema>            => ipcRenderer.invoke("DescribeTableSQLSource",           a1, a2    ),
  Duplicate:                        (a1: string                               ): Promise<t.RequestID>              => ipcRenderer.invoke("Duplicate",                        a1        ),
  FetchSpecHTTPSource:              (a1: string                               ): Promise<void>                     => ipcRenderer.invoke("FetchSpecHTTPSource",              a1        ),
  GRPCMethods:                      (a1: string                               ): Promise<Record<string, string[]>> => ipcRenderer.invoke("GRPCMethods",                      a1        ),
  GRPCQueryFake:                    (a1: string, a2: string                   ): Promise<string>                   => ipcRenderer.invoke("GRPCQueryFake",                    a1, a2    ),
  GRPCQueryValidate:                (a1: string, a2: string, a3: string       ): Promise<void>                     => ipcRenderer.invoke("GRPCQueryValidate",                a1, a2, a3),
  GenerateExampleRequestHTTPSource: (a1: string, a2: number                   ): Promise<t.HTTPRequest>            => ipcRenderer.invoke("GenerateExampleRequestHTTPSource", a1, a2    ),
  Get:                              (a1: string                               ): Promise<t.GetResponse>            => ipcRenderer.invoke("Get",                              a1        ),
  List:                             (                                         ): Promise<t.ListResponse>           => ipcRenderer.invoke("List"                                        ),
  ListEndpointsHTTPSource:          (a1: string                               ): Promise<t.EndpointInfo[]>         => ipcRenderer.invoke("ListEndpointsHTTPSource",          a1        ),
  ListTablesSQLSource:              (a1: string                               ): Promise<t.TableInfo[]>            => ipcRenderer.invoke("ListTablesSQLSource",              a1        ),
  Perform:                          (a1: string                               ): Promise<Record<string, unknown>>  => ipcRenderer.invoke("Perform",                          a1        ),
  PerformSQLSource:                 (a1: string, a2: string                   ): Promise<Record<string, unknown>>  => ipcRenderer.invoke("PerformSQLSource",                 a1, a2    ),
  PerformVirtualEndpointHTTPSource: (a1: string, a2: number, a3: t.HTTPRequest): Promise<Record<string, unknown>>  => ipcRenderer.invoke("PerformVirtualEndpointHTTPSource", a1, a2, a3),
  Read:                             (a1: string                               ): Promise<t.Request>                => ipcRenderer.invoke("Read",                             a1        ),
  Rename:                           (a1: string, a2: string                   ): Promise<void>                     => ipcRenderer.invoke("Rename",                           a1, a2    ),
  TestHTTPSource:                   (a1: string                               ): Promise<void>                     => ipcRenderer.invoke("TestHTTPSource",                   a1        ),
  TestSQLSource:                    (a1: string                               ): Promise<void>                     => ipcRenderer.invoke("TestSQLSource",                    a1        ),
  Update:                           (a1: string, a2: Request["Data"]          ): Promise<void>                     => ipcRenderer.invoke("Update",                           a1, a2    ),
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

  Print  (message: string): void {return todo(       message);}, // logs the given message as a raw message
  Trace  (message: string): void {Log.log("trace",   message);}, // logs the given message at the `trace`   log level.
  Debug  (message: string): void {Log.log("debug",   message);}, // logs the given message at the `debug`   log level.
  Info   (message: string): void {Log.log("info",    message);}, // logs the given message at the `info`    log level.
  Warning(message: string): void {Log.log("warning", message);}, // logs the given message at the `warning` log level.
  Error  (message: string): void {Log.log("error",   message);}, // logs the given message at the `error`   log level.
  Fatal  (message: string): void {Log.log("fatal",   message);}, // logs the given message at the `fatal`   log level. The application will quit after calling this method.
};

export const Events = {
  // sets up a listener for the given event name, but will only trigger a given number times.
  OnMultiple(eventName: string, callback: (...data: unknown[]) => void, maxCallbacks: number): () => void {return todo(eventName, callback, maxCallbacks);},

  // sets up a listener for the given event name.
  On(eventName: string, callback: (...data: unknown[]) => void): () => void {return Events.OnMultiple(eventName, callback, -1);},

  // unregisters the listener for the given event name.
  Off(eventName: string, ...additionalEventNames: string[]): void {return todo(eventName, ...additionalEventNames);},

  // unregisters all listeners.
  OffAll(): void {return todo();},

  // sets up a listener for the given event name, but will only trigger once.
  Once(eventName: string, callback: (...data: unknown[]) => void): () => void {return Events.OnMultiple(eventName, callback, 1);},

  // emits the given event. Optional data may be passed with the event.
  // This will trigger any event listeners.
  Emit(eventName: string, ...data: unknown[]): void {return todo(eventName, data);},
};

// *Windows only*
export const Windows = {
  // Sets window theme to system default (dark/light).
  SetSystemDefaultTheme(): void {return todo();},
  SetTheme(_theme: "light" | "dark"): void {return todo();},
};

export const Window = {
  // Forces a reload by the main application as well as connected browsers.
  Reload(): void {return todo();},

  // Reloads the application frontend.
  ReloadApp(): void {return todo();},

  // Sets the window AlwaysOnTop or not on top.
  SetAlwaysOnTop(b: boolean): void {return todo(b);},

  // Centers the window on the monitor the window is currently on.
  Center(): void {return todo();},

  // Sets the text in the window title bar.
  SetTitle(title: string): void {return todo(title);},

  set fullscreen(value: boolean) {
    if (value) todo(value); // Makes the window full screen
    else todo(value); // Restores the previous window dimensions and position prior to full screen
  },
  // Returns the state of the window, i.e. whether the window is in full screen mode or not.
  get fullscreen(): Promise<boolean> {return todo();},

  // width and height of the window
  get size(): Promise<{width: number, height: number}> {return todo();},
  set size({width, height}: {width: number, height: number}) {todo(width, height);},

  // Sets the maximum window size. Will resize the window if the window is currently larger than the given dimensions.
  // Setting a size of 0,0 will disable this constraint.
  SetMaxSize(width: number, height: number): void {return todo(width, height);},

  // Sets the minimum window size. Will resize the window if the window is currently smaller than the given dimensions.
  // Setting a size of 0,0 will disable this constraint.
  SetMinSize(width: number, height: number): void {return todo(width, height);},

  // window position relative to the monitor the window is currently on
  get position(): Promise<{x: number, y: number}> {return todo();},
  set position({x, y}: {x: number, y: number}) {todo(x, y);},

  // Hides the window.
  Hide(): void {return todo();},

  // Shows the window, if it is currently hidden.
  Show(): void {return todo();},

  // Toggles between Maximised and UnMaximised.
  ToggleMaximise(): void {return todo();},

  set maximised(b: boolean) {
    if (b) todo(); // Maximises the window to fill the screen
    else todo(); // Restores the window to the dimensions and position prior to maximising
  },
  // Returns the state of the window, i.e. whether the window is maximised or not
  get maximised(): Promise<boolean> {return todo();},

  set minimised(b: boolean) {
    if (b) todo(); // Minimises the window
    else todo(); // Restores the window to the dimensions and position prior to minimising
  },
  // Returns the state of the window, i.e. whether the window is minimised or not
  get minimised(): Promise<boolean> {return todo();},

  // Sets the background colour of the window to the given RGBA colour definition. This colour will show through for all transparent pixels.
  SetBackgroundColor(R: number, G: number, B: number, A: number): void {return todo(R, G, B, A);},

  // Returns the state of the window, i.e. whether the window is normal or not.
  IsNormal(): Promise<boolean> {return todo();},
};

export type Screen = {
  isCurrent: boolean,
  isPrimary: boolean,
  width: number,
  height: number,
};

// Gets the all screens. Call this anew each time you want to refresh data from the underlying windowing system.
export function ScreenGetAll(): Promise<Screen[]> {return todo();}

// Opens the given URL in the system browser.
export function BrowserOpenURL(_url: string): void {return todo();}

// Environment information
export type EnvironmentInfo = {
  buildType: string,
  platform: string,
  arch: string,
};

// Returns information about the environment
export function Environment(): Promise<EnvironmentInfo> {return todo();}

// Quits the application
export function Quit(): void {return todo();}

// Hides the application
export function Hide(): void {return todo();}

// Shows the application
export function Show(): void {return todo();}

export const Clipboard = {
  // text stored on clipboard
  get text(): Promise<string> {return todo();},
  set text(text: string) {todo(text);},
};

// OnFileDrop listens to drag and drop events and calls the callback with the coordinates of the drop and an array of path strings.
export function OnFileDrop(
  callback: ( // Callback for OnFileDrop returns a slice of file path strings when a drop is finished.
    x: number, // x coordinate of the drop
    y: number, // y coordinate of the drop
    paths: string[], // A list of file paths
  ) => void,
  useDropTarget: boolean, // Only call the callback when the drop finished on an element that has the drop target style (--wails-drop-target)
): void {return todo(callback, useDropTarget);}

// OnFileDropOff removes the drag and drop listeners and handlers.
export function OnFileDropOff(): void {return todo();}

// Check if the file path resolver is available
export function CanResolveFilePaths(): boolean {return todo();}

// Resolves file paths for an array of files
export function ResolveFilePaths(files: File[]): void {return todo(files);}
