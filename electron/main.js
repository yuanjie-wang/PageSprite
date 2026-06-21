import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { registerSettingsHandlers } from "./ipc/settings.js";
import { registerWorkspaceHandlers } from "./ipc/workspace.js";
import { registerProjectHandlers } from "./ipc/project.js";
import { registerCancelHandlers } from "./ipc/cancel.js";
import { registerAgentHandlers } from "./ai/agent.js";
import { runStartupHooks } from "./ipc/hooks.js";
import { getFontAwesomeCSS } from "./assets/fontawesome.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "PageSprite",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:1420");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  registerSettingsHandlers();
  registerWorkspaceHandlers();
  registerProjectHandlers();
  registerCancelHandlers();
  runStartupHooks();
  createWindow();

  // Pass webContents to agent handlers for real-time progress streaming
  const win = BrowserWindow.getAllWindows()[0];
  registerAgentHandlers(win.webContents);

  // Expose self-contained Font Awesome CSS to renderer
  ipcMain.handle("assets:getFontAwesomeCSS", () => getFontAwesomeCSS());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
