const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  settings: {
    load: () => ipcRenderer.invoke("settings:load"),
    save: (s) => ipcRenderer.invoke("settings:save", s),
  },
  workspace: {
    load: () => ipcRenderer.invoke("workspace:load"),
    save: (data) => ipcRenderer.invoke("workspace:save", data),
    clearTemp: () => ipcRenderer.invoke("workspace:clearTemp"),
  },
  project: {
    save: (data) => ipcRenderer.invoke("project:save", data),
    load: () => ipcRenderer.invoke("project:load"),
  },
  agent: {
    generate: (config, settings) =>
      ipcRenderer.invoke("agent:generate", config, settings),
    prepareWorkDir: (rectId, existingCode) =>
      ipcRenderer.invoke("agent:prepareWorkDir", rectId, existingCode),
    checkInstalled: (command) =>
      ipcRenderer.invoke("agent:checkInstalled", command),
  },
  cancel: {
    cancel: (id) => ipcRenderer.invoke("cancel:cancel", id),
  },
  assets: {
    getFontAwesomeCSS: () => ipcRenderer.invoke("assets:getFontAwesomeCSS"),
  },
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("agent:progress", handler);
    return () => ipcRenderer.removeListener("agent:progress", handler);
  },
});
