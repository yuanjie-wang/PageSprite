import { ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { homedir } from "os";

const DIR = path.join(homedir(), ".pagesprite");
const WORKSPACE_PATH = path.join(DIR, "workspace.json");
const TMP_DIR = path.join(DIR, "tmp");

export function registerWorkspaceHandlers() {
  ipcMain.handle("workspace:load", async () => {
    try {
      if (!fs.existsSync(WORKSPACE_PATH)) return null;
      const data = fs.readFileSync(WORKSPACE_PATH, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  });

  ipcMain.handle("workspace:save", async (_, data) => {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(WORKSPACE_PATH, JSON.stringify(data, null, 2));
  });

  ipcMain.handle("workspace:clearTemp", async () => {
    try {
      if (!fs.existsSync(TMP_DIR)) return;
      for (const entry of fs.readdirSync(TMP_DIR)) {
        const p = path.join(TMP_DIR, entry);
        fs.rmSync(p, { recursive: true, force: true });
      }
    } catch {}
  });
}
