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
      nodeIntegration: false,
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

ipcMain.handle("list-requests", List);
ipcMain.handle("get-request", (_, id) => Get(id as string));
