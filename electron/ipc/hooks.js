import fs from "fs";
import path from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";

const BASE_DIR = path.join(homedir(), ".pagesprite");
const SETTINGS_PATH = path.join(BASE_DIR, "settings.json");

/** Load hooks config from settings.json */
function loadScripts(trigger) {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return [];
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
    const scripts = raw.hooks?.[trigger];
    return Array.isArray(scripts) ? scripts.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/** Run a single script and parse KEY=VALUE lines from stdout */
function execScript(scriptPath) {
  if (!fs.existsSync(scriptPath)) {
    console.error(`[hooks] script not found: ${scriptPath}`);
    return [];
  }

  const ext = path.extname(scriptPath).slice(1).toLowerCase();
  let program, args;

  if (process.platform === "win32") {
    switch (ext) {
      case "bat":
      case "cmd":
        program = "cmd";
        args = ["/c", scriptPath];
        break;
      case "js":
        program = "node";
        args = [scriptPath];
        break;
      case "py":
        program = "python";
        args = [scriptPath];
        break;
      case "ps1":
        program = "powershell";
        args = ["-ExecutionPolicy", "Bypass", "-File", scriptPath];
        break;
      default:
        console.error(`[hooks] unsupported script type on Windows: .${ext}`);
        return [];
    }
  } else {
    switch (ext) {
      case "sh":
        program = "sh";
        args = [scriptPath];
        break;
      case "js":
        program = "node";
        args = [scriptPath];
        break;
      case "py":
        program = "python3";
        args = [scriptPath];
        break;
      default:
        console.error(`[hooks] unsupported script type: .${ext}`);
        return [];
    }
  }

  console.error(`[hooks] running: ${path.basename(scriptPath)}`);
  const result = spawnSync(program, args, { timeout: 30000 });

  if (result.error) {
    console.error(`[hooks] failed: ${result.error.message}`);
    return [];
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    console.error(`[hooks] exit ${result.status}: ${stderr}`);
    return [];
  }

  const stdout = result.stdout?.toString() || "";
  const lines = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key) {
        process.env[key] = val;
        lines.push({ key, val });
        console.error(`[hooks]   $${key} = ${val.length} chars`);
      }
    }
  }
  if (lines.length === 0) console.error("[hooks]   (no output)");
  return lines;
}

/** Run all scripts for a given trigger */
export function runHooks(trigger) {
  const scripts = loadScripts(trigger);
  for (const rel of scripts) {
    execScript(path.join(BASE_DIR, rel));
  }
}

/** Run startup hooks (convenience wrapper) */
export function runStartupHooks() {
  runHooks("startup");
}
