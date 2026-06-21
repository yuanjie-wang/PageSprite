import { ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { homedir } from "os";
import { spawn } from "child_process";
import { chatWithTools } from "./client.js";
import { getCancelManager } from "../ipc/cancel.js";
import { execSync } from "child_process";

// ── Helpers ────────────────────────────────────────────────

function workDir(rectId) {
  const base = path.join(homedir(), ".pagesprite", "tmp", rectId);
  return base;
}

/** Extract code from AI response — tries ```html first, then any ``` block */
function extractCode(text) {
  const htmlMatch = text.match(/```html\n?([\s\S]*?)```/);
  if (htmlMatch) return htmlMatch[1].trim();
  const anyMatch = text.match(/```\w*\n?([\s\S]*?)```/);
  if (anyMatch) return anyMatch[1].trim();
  return null;
}

/** Interpolate {dir} and {contextFile} in a template string */
function interpolate(template, dir, contextFile) {
  return template.replace(/\{dir\}/g, dir).replace(/\{contextFile\}/g, contextFile);
}

/**
 * Build the complete prompt structure shared by all agent types:
 *   1. Fixed system prompt
 *   2. Style prompt (if set)
 *   3. Previous request history (if any)
 *   4. Current request
 * Returns { system, history, current } so each agent can format as appropriate.
 */
function buildPromptParts(config, settings, isStreaming) {
  // History prompts with labels
  const historyTexts = [];
  if (config.history) {
    for (let i = 0; i < config.history.length; i++) {
      historyTexts.push(`[Previous Request ${i + 1}]\n${config.history[i]}`);
    }
  }
  const base = isStreaming ? SYSTEM_PROMPT_STREAMING : SYSTEM_PROMPT_COMMON;
  return {
    system: base + (settings.system_prompt ? "\n\n" + settings.system_prompt : ""),
    history: historyTexts,
    current: config.prompt || "",
  };
}

/** Format the full prompt as a single text block (for CLI agents). */
function formatCliPrompt(parts) {
  const blocks = [parts.system, ...parts.history, parts.current];
  return blocks.filter(Boolean).join("\n\n");
}

// ── Tool definitions ────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "read",
      description: "Read a file from the working directory",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to working directory" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description: "Write content to a file in the working directory",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to working directory" },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list",
      description: "List all files in the working directory with their sizes",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "Call this when generation is complete and you are satisfied with the result. The content of index.html will be returned as the final output.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const SYSTEM_PROMPT_COMMON = `You are a frontend page generator. Generate complete, standalone HTML files with inline CSS and JavaScript.

Write the main file to index.html.

Requirements:
- Output a single HTML file with embedded <style> and <script> tags
- Use modern CSS (flexbox, grid, custom properties)
- Make designs responsive and visually polished
- Use CSS transitions/animations sparingly for polish
- Do NOT use external CDN links (except for icon libraries if essential)
- **Font Awesome 6 Free is built-in. Use its icon classes** (e.g., <i class="fas fa-home"></i>) for any icons needed. No need to include any Font Awesome CSS — it is injected automatically.

When working on a revision, the existing code is already in your working directory's index.html file. Read it from there to understand the current state, then modify the file with your complete generated HTML output, replacing its contents entirely. Do NOT create any new files.

When the user provides annotations, they describe specific areas of the rendered page that need changes. Pay close attention to the annotation positions and text.`;

const SYSTEM_PROMPT_STREAMING = SYSTEM_PROMPT_COMMON + `

Workflow:
- Use the read/write/list tools to review and refine your output
- Iterate as many times as needed
- Only call finish() when you are truly satisfied with the result.`;

/** Execute a tool call. Returns the result string to send back to the model. */
function executeTool(name, args, dir) {
  switch (name) {
    case "read": {
      if (!args.path) return `Error: Missing required argument "path" for read`;
      const p = path.join(dir, args.path);
      if (!fs.existsSync(p)) return `Error: File not found: ${args.path}`;
      return fs.readFileSync(p, "utf-8");
    }
    case "write": {
      if (!args.path) return `Error: Missing required argument "path" for write`;
      const p = path.join(dir, args.path);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, args.content || "");
      return `OK: Written ${args.path} (${(args.content || "").length} chars)`;
    }
    case "list": {
      const items = fs.readdirSync(dir);
      if (items.length === 0) return "(empty directory)";
      return items.map((name) => {
        const stat = fs.statSync(path.join(dir, name));
        return `${name} (${stat.size} bytes)`;
      }).join("\n");
    }
    default:
      return `Error: Unknown tool: ${name}`;
  }
}

// ── Streaming agent ────────────────────────────────────────

async function runToolUseAgent(config, settings, cancelMgr) {
  const dir = workDir(config.rect_id);
  fs.mkdirSync(dir, { recursive: true });

  if (config.existing_code) {
    fs.writeFileSync(path.join(dir, "index.html"), config.existing_code);
  }

  // Build unified prompt structure
  const promptParts = buildPromptParts(config, settings, true);
  const messages = [
    ...promptParts.history.map((content) => ({ role: "user", content })),
    { role: "user", content: promptParts.current },
  ];
  const toolSettings = { ...settings, system_prompt: promptParts.system };

  console.error("[agent] system prompt:", toolSettings.system_prompt);
  console.error("[agent] user messages count:", messages.length);
  messages.forEach((m, i) => console.error("[agent] msg " + i + ":", m.content));

  const MAX_ITERATIONS = 25;
  const controller = cancelMgr.registerAbort(config.rect_id);

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // eslint-disable-next-line no-await-in-loop
      const reply = await chatWithTools(toolSettings, messages, TOOLS, controller.signal);

      // Add assistant message to conversation history
      messages.push({
        role: "assistant",
        content: reply.content || null,
        tool_calls: reply.tool_calls,
      });

      // No tool calls → model is responding with text. Try to finish.
      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        const code = extractCode(reply.content || "");
        if (code) fs.writeFileSync(path.join(dir, "index.html"), code);
        return fs.readFileSync(path.join(dir, "index.html"), "utf-8");
      }

      // Process tool calls
      for (const tc of reply.tool_calls) {
        if (tc.type !== "function") continue;
        const { name, arguments: argsStr } = tc.function;

        // finish() → generation complete
        if (name === "finish") {
          cancelMgr.unregisterAbort(config.rect_id);
          return fs.readFileSync(path.join(dir, "index.html"), "utf-8");
        }

        // Parse arguments and execute
        let args;
        try { args = JSON.parse(argsStr); } catch { args = {}; }
        const result = executeTool(name, args, dir);

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
    }

    // Max iterations reached — return whatever is on disk
    cancelMgr.unregisterAbort(config.rect_id);
    const fallbackPath = path.join(dir, "index.html");
    if (fs.existsSync(fallbackPath)) {
      const html = fs.readFileSync(fallbackPath, "utf-8");
      if (html.trim()) return html;
    }
    throw new Error("Agent did not produce a result within the maximum number of iterations");
  } catch (err) {
    cancelMgr.unregisterAbort(config.rect_id);
    if (err.name === "AbortError") throw new Error("cancelled");
    throw err;
  }
}

// ── CLI agent ──────────────────────────────────────────────

async function runCliAgent(config, cancelMgr, webContents) {
  const dir = workDir(config.rect_id);
  fs.mkdirSync(dir, { recursive: true });

  const contextPath = path.join(dir, "index.html");
  fs.writeFileSync(contextPath, config.existing_code || "");

  const command = config.command || "opencode";
  const template = config.args_template || "";
  const rawArgs = interpolate(template, dir, contextPath);

  const args = rawArgs ? rawArgs.split(/\s+/) : [];
  if (config.prompt) args.push(config.prompt);

  console.error(`[agent] running: ${command} ${args.join(" ")}`);

  const child = spawn(command, args, {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  cancelMgr.registerChild(config.rect_id, child);

  // Collect stdout/stderr and stream progress to renderer
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => {
    const text = d.toString();
    stdout += text;
    if (webContents && !webContents.isDestroyed()) {
      webContents.send("agent:progress", { rectId: config.rect_id, type: "stdout", text });
    }
  });
  child.stderr.on("data", (d) => {
    const text = d.toString();
    stderr += text;
    if (webContents && !webContents.isDestroyed()) {
      webContents.send("agent:progress", { rectId: config.rect_id, type: "stderr", text });
    }
  });

  try {
    const code = await new Promise((resolve, reject) => {
      child.on("close", (exitCode) => {
        cancelMgr.unregisterChild(config.rect_id);
        if (exitCode === 0) {
          const content = fs.readFileSync(contextPath, "utf-8");
          resolve(extractCode(content) || content);
        } else {
          let msg = `${command} exited with status ${exitCode}`;
          if (stdout.trim()) msg += `\nstdout:\n${stdout.trim()}`;
          if (stderr.trim()) msg += `\nstderr:\n${stderr.trim()}`;
          reject(new Error(msg));
        }
      });
      child.on("error", (err) => {
        cancelMgr.unregisterChild(config.rect_id);
        reject(new Error(`${command} error: ${err.message}`));
      });
    });
    return code;
  } catch (err) {
    if (child.killed) throw new Error("cancelled");
    cancelMgr.unregisterChild(config.rect_id);
    throw err;
  }
}

// ── Built-in agent configs ─────────────────────────────────

const BUILTIN_CONFIGS = {
  opencode: { command: "opencode", args_template: "run --dir {dir} --format json" },
  claude: { command: "claude", args_template: "-p" },
};

// ── IPC handlers ───────────────────────────────────────────

export function registerAgentHandlers(webContents) {
  const cancelMgr = getCancelManager();

  ipcMain.handle("agent:generate", async (_, config, settings) => {
    switch (config.agent_type) {
      case "streaming":
        return runToolUseAgent(config, settings, cancelMgr);
      case "custom": {
        const promptParts = buildPromptParts(config, settings, false);
        const fullPrompt = formatCliPrompt(promptParts);
        console.error("[agent] cli prompt:", fullPrompt);
        return runCliAgent({ ...config, prompt: fullPrompt }, cancelMgr, webContents);
      }
      default: {
        // Named agents (opencode, claude, etc.) — use built-in defaults
        const defaults = BUILTIN_CONFIGS[config.agent_type];
        if (!defaults) throw new Error(`unknown agent type: ${config.agent_type}`);
        // Only carry forward rect_id/prompt/existing_code/history from the
        // renderer — command and args_template MUST come from BUILTIN_CONFIGS
        // so a stale agent_command in user settings cannot override them.
        const promptParts = buildPromptParts(config, settings, false);
        const fullPrompt = formatCliPrompt(promptParts);
        console.error("[agent] cli prompt:", fullPrompt);
        const merged = {
          ...defaults,
          rect_id: config.rect_id,
          prompt: fullPrompt,
          existing_code: config.existing_code,
          history: config.history,
        };
        return runCliAgent(merged, cancelMgr, webContents);
      }
    }
  });

  ipcMain.handle("agent:prepareWorkDir", async (_, rectId, existingCode) => {
    const dir = workDir(rectId);
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, "index.html");
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, existingCode || "");
    }
  });

  ipcMain.handle("agent:checkInstalled", async (_, command) => {
    try {
      const cmd = process.platform === "win32" ? "where" : "which";
      execSync(`${cmd} ${command}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
}
