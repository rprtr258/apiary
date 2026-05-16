import path from "path";
import {fileURLToPath} from "url";
import {app, BrowserWindow, ipcMain} from "electron";
import {Get, List} from "./api.ts";

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
ipcMain.handle("Get", (_, id) => Get(id as string));
ipcMain.handle("Create", (_, path, kind) => Create(path as string, kind as string));
ipcMain.handle("Duplicate", (_, id) => Duplicate(id as string));
ipcMain.handle("Read", (_, id) => Read(id as string));
ipcMain.handle("Rename", (_, id, newName) => Rename(id as string, newName as string));
ipcMain.handle("Update", (_, id, kind, data) => Update(id as string, kind as string, data as Record<string, unknown>));
ipcMain.handle("Delete", (_, id) => Delete(id as string));
ipcMain.handle("Perform", (_, id) => Perform(id as string));
ipcMain.handle("JQ", (_, json, query) => JQ(json as string, query as string));
ipcMain.handle("GRPCMethods", (_, target) => GRPCMethods(target as string));
ipcMain.handle("GRPCQueryFake", (_, target, method) => GRPCQueryFake(target as string, method as string));
ipcMain.handle("GRPCQueryValidate", (_, target, method, payload) => GRPCQueryValidate(target as string, method as string, payload as string));
ipcMain.handle("PerformSQLSource", (_, id, query) => PerformSQLSource(id as string, query as string));
ipcMain.handle("TestSQLSource", (_, id) => TestSQLSource(id as string));
ipcMain.handle("ListTablesSQLSource", (_, id) => ListTablesSQLSource(id as string));
ipcMain.handle("DescribeTableSQLSource", (_, id, tableName) => DescribeTableSQLSource(id as string, tableName as string));
ipcMain.handle("CountRowsSQLSource", (_, id, tableName) => CountRowsSQLSource(id as string, tableName as string));
ipcMain.handle("ListEndpointsHTTPSource", (_, id) => ListEndpointsHTTPSource(id as string));
ipcMain.handle("GenerateExampleRequestHTTPSource", (_, id, endpointIndex) => GenerateExampleRequestHTTPSource(id as string, endpointIndex as number));
ipcMain.handle("PerformVirtualEndpointHTTPSource", (_, sourceID, endpointIndex, request) => PerformVirtualEndpointHTTPSource(sourceID as string, endpointIndex as number, request));
ipcMain.handle("TestHTTPSource", (_, id) => TestHTTPSource(id as string));
ipcMain.handle("FetchSpecHTTPSource", (_, id) => FetchSpecHTTPSource(id as string));
