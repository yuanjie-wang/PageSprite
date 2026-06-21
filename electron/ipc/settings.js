import { ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { homedir } from "os";

const SETTINGS_PATH = path.join(homedir(), ".pagesprite", "settings.json");

function ensureDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function readRaw() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

const DEFAULTS = {
  endpoint: "https://api.openai.com/v1",
  api_key: "",
  model: "gpt-5.5",
  system_prompt: "",
  agent_type: "streaming",
};

export function registerSettingsHandlers() {
  ipcMain.handle("settings:load", async () => {
    const existing = readRaw();
    return { ...DEFAULTS, ...existing };
  });

  ipcMain.handle("settings:save", async (_, settings) => {
    ensureDir();
    const existing = readRaw();
    // Merge specific fields, preserving extras (e.g. hooks)
    existing.endpoint = settings.endpoint;
    existing.api_key = settings.api_key;
    existing.model = settings.model;
    existing.system_prompt = settings.system_prompt;
    existing.agent_type = settings.agent_type;
    if (settings.agent_command) {
      existing.agent_command = settings.agent_command;
    } else {
      delete existing.agent_command;
    }
    if (settings.agent_args_template) {
      existing.agent_args_template = settings.agent_args_template;
    } else {
      delete existing.agent_args_template;
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(existing, null, 2));
  });
}
