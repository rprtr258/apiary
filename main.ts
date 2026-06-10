import path from "path";
import {fileURLToPath} from "url";
import {app, BrowserWindow, ipcMain} from "electron";
import * as t from "./types/models.ts";
import {
  CountRowsSQLSource,
  Create,
  Delete,
  DescribeTableSQLSource,
  Duplicate,
  FetchSpecHTTPSource,
  GenerateExampleRequestHTTPSource,
  Get,
  GRPCMethods,
  GRPCQueryFake,
  GRPCQueryValidate,
  JQ,
  List,
  ListEndpointsHTTPSource,
  ListTablesSQLSource,
  Perform,
  PerformSQLSource,
  PerformVirtualEndpointHTTPSource,
  Read,
  Rename,
  TestHTTPSource,
  TestSQLSource,
  Update,
} from "./api.ts";
import {Request} from "./db.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.on("ready", async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: true,
      spellcheck: false,
      sandbox: false,
    },
  });

  // In dev mode, load from Vite dev server for HMR; in prod, load built files
  if (process.env.VITE_DEV_SERVER_URL !== undefined) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("List", _ => List());
ipcMain.handle("Get", (_, id: string) => Get(id));
ipcMain.handle("Create", (_, path: string, kind: t.Kind) => Create(path, kind));
ipcMain.handle("Duplicate", (_, id: string) => Duplicate(id));
ipcMain.handle("Read", (_, id: string) => Read(id));
ipcMain.handle("Rename", (_, id: string, newName: string) => Rename(id, newName));
ipcMain.handle("Update", (_, id: string, kind: t.Kind, data: Request["Data"]) => Update(id, kind, data));
ipcMain.handle("Delete", (_, id: string) => Delete(id));
ipcMain.handle("Perform", (_, id: string) => Perform(id));
ipcMain.handle("JQ", (_, json: string, query: string) => JQ(json, query));
ipcMain.handle("GRPCMethods", (_, target: string) => GRPCMethods(target));
ipcMain.handle("GRPCQueryFake", (_, target: string, method: string) => GRPCQueryFake(target, method));
ipcMain.handle("GRPCQueryValidate", (_, target: string, method: string, payload: string) => GRPCQueryValidate(target, method, payload));
ipcMain.handle("PerformSQLSource", (_, id: string, query: string) => PerformSQLSource(id, query));
ipcMain.handle("TestSQLSource", (_, id: string) => TestSQLSource(id));
ipcMain.handle("ListTablesSQLSource", (_, id: string) => ListTablesSQLSource(id));
ipcMain.handle("DescribeTableSQLSource", (_, id: string, tableName: string) => DescribeTableSQLSource(id, tableName));
ipcMain.handle("CountRowsSQLSource", (_, id: string, tableName: string) => CountRowsSQLSource(id, tableName));
ipcMain.handle("ListEndpointsHTTPSource", (_, id: string) => ListEndpointsHTTPSource(id));
ipcMain.handle("GenerateExampleRequestHTTPSource", (_, id: string, endpointIndex: number) => GenerateExampleRequestHTTPSource(id, endpointIndex));
ipcMain.handle("PerformVirtualEndpointHTTPSource", (_, sourceID: string, endpointIndex: number, request: t.HTTPRequest) => PerformVirtualEndpointHTTPSource(sourceID, endpointIndex, request));
ipcMain.handle("TestHTTPSource", (_, id: string) => TestHTTPSource(id));
ipcMain.handle("FetchSpecHTTPSource", (_, id: string) => FetchSpecHTTPSource(id));
