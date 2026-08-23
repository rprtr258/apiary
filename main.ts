import path from "path";
import {fileURLToPath} from "url";
import {app, BrowserWindow, ipcMain} from "electron";
import data from "./package.json" with {type: "json"};
import * as t from "@/types.ts";
import * as api from "./main/api.ts";
import {Request} from "./main/db.ts";

const version = data.version;

if (process.argv.includes("--version")) {
  console.log(version);
  process.exit(0);
}

// TODO: init/migrate db

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

ipcMain.handle("List", _ => api.List());
ipcMain.handle("Get", (_, id: string) => api.Get(id));
ipcMain.handle("Create", (_, path: string, kind: t.Kind) => api.Create(path, kind));
ipcMain.handle("Duplicate", (_, id: string) => api.Duplicate(id));
ipcMain.handle("Read", (_, id: string) => api.Read(id));
ipcMain.handle("Rename", (_, id: string, newName: string) => api.Rename(id, newName));
ipcMain.handle("Update", (_, id: string, data: Request["Data"]) => api.Update(id, data));
ipcMain.handle("Delete", (_, id: string) => api.Delete(id));
ipcMain.handle("Perform", (_, id: string) => api.Perform(id));
ipcMain.handle("GRPC.Methods", (_, target: string) => api.GRPC.Methods(target));
ipcMain.handle("GRPC.QueryFake", (_, target: string, method: string) => api.GRPC.QueryFake(target, method));
ipcMain.handle("GRPC.QueryValidate", (_, target: string, method: string, payload: string) => api.GRPC.QueryValidate(target, method, payload));
ipcMain.handle("SQLSource.Perform", (_, id: string, query: string) => api.SQLSource.Perform(id, query));
ipcMain.handle("SQLSource.Test", (_, id: string) => api.SQLSource.Test(id));
ipcMain.handle("SQLSource.ListTables", (_, id: string) => api.SQLSource.ListTables(id));
ipcMain.handle("SQLSource.DescribeTable", (_, id: string, tableName: string) => api.SQLSource.DescribeTable(id, tableName));
ipcMain.handle("SQLSource.CountRows", (_, id: string, tableName: string) => api.SQLSource.CountRows(id, tableName));
ipcMain.handle("HTTPSource.ListEndpoints", (_, id: string) => api.HTTPSource.ListEndpoints(id));
ipcMain.handle("HTTPSource.GenerateExampleRequest", (_, id: string, endpointIndex: number) => api.HTTPSource.GenerateExampleRequest(id, endpointIndex));
ipcMain.handle("HTTPSource.PerformVirtualEndpoint", (_, sourceID: string, endpointIndex: number, request: t.HTTPRequest) => api.HTTPSource.PerformVirtualEndpoint(sourceID, endpointIndex, request));
ipcMain.handle("HTTPSource.Test", (_, id: string) => api.HTTPSource.Test(id));
ipcMain.handle("HTTPSource.FetchSpec", (_, id: string) => api.HTTPSource.FetchSpec(id));
