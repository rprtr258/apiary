import {app, BrowserWindow, ipcMain} from "electron";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {sosal} from "./api.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(__filename);
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

  await win.loadFile("index.html");
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin")
    app.quit();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("get-data", async () => {
  return sosal();
});
