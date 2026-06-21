import { ipcMain, dialog } from "electron";
import fs from "fs";

export function registerProjectHandlers() {
  ipcMain.handle("project:save", async (_, data) => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: "PageSprite", extensions: ["pagesprite.json"] }],
      defaultPath: `${data.name}.pagesprite.json`,
    });
    if (result.canceled) throw new Error("Save cancelled");
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(result.filePath, json, "utf-8");
  });

  ipcMain.handle("project:load", async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: "PageSprite", extensions: ["pagesprite.json"] }],
      properties: ["openFile"],
    });
    if (result.canceled) throw new Error("Open cancelled");
    const json = fs.readFileSync(result.filePaths[0], "utf-8");
    return JSON.parse(json);
  });
}
