import { ipcMain } from "electron";

/**
 * CancelManager — tracks active generation tasks by rect ID.
 * Handles both AbortController (streaming) and ChildProcess (CLI agents).
 */
class CancelManager {
  constructor() {
    /** @type {Map<string, AbortController>} */
    this._abortControllers = new Map();
    /** @type {Map<string, import('child_process').ChildProcess>} */
    this._childProcesses = new Map();
  }

  /** Register an AbortController for a streaming task. Returns the controller. */
  registerAbort(id) {
    const controller = new AbortController();
    this._abortControllers.set(id, controller);
    return controller;
  }

  /** Register a child process for a CLI agent task. */
  registerChild(id, child) {
    this._childProcesses.set(id, child);
  }

  /** Cancel a task by ID — aborts HTTP or kills child process. */
  cancel(id) {
    this._abortControllers.get(id)?.abort();
    this._abortControllers.delete(id);
    const child = this._childProcesses.get(id);
    if (child) {
      child.kill();
      this._childProcesses.delete(id);
    }
  }

  /** Remove an AbortController without cancelling (normal completion). */
  unregisterAbort(id) {
    this._abortControllers.delete(id);
  }

  /** Remove a child process without killing (normal completion). */
  unregisterChild(id) {
    this._childProcesses.delete(id);
  }
}

// Singleton
const cancelMgr = new CancelManager();

export function getCancelManager() {
  return cancelMgr;
}

export function registerCancelHandlers() {
  ipcMain.handle("cancel:cancel", async (_, id) => {
    cancelMgr.cancel(id);
  });
}
