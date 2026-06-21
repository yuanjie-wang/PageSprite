# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server (frontend only, port 1420)
npm run build            # Frontend prod build (tsc + vite)
npm run electron:dev     # Launch Electron dev window with HMR
npm run electron:build   # Full production build (vite + electron-builder)
npx tsc --noEmit         # TypeScript type check
node --check <file.js>   # Syntax check for Electron plain JS files
```

## Architecture

PageSprite is an **Electron** desktop app (converted from the original Tauri/Rust backend). Users draw rect annotations on an infinite canvas workspace, then prompt AI per-rect to generate HTML content rendered inside iframe overlays. Pure annotation-driven workflow — no chat panel.

### Data Flow

```
User draws rect → Zustand store → types prompt in RegionConfig panel
  → window.electronAPI.agent.generate() → Electron main process → Node.js fetch SSE → OpenAI API
  → response string → extractCode → PerRectFrame iframe srcdoc updated
```

### Frontend (src/)

| File | Role |
|------|------|
| `App.tsx` | Loads settings + workspace + Font Awesome CSS from disk on mount, starts auto-persist |
| `components/Workspace.tsx` | Main workspace with infinite canvas, pan/zoom, rect UI, iframe preview, loading overlays, per-rect toolbar |
| `components/Toolbar.tsx` | Floating glassmorphism toolbar (cursor, pan, rect, undo/redo, reset, settings) |
| `components/SettingsDialog.tsx` | Modal for API endpoint/key/model and agent type configuration |
| `components/Layout.tsx` | Simple full-height wrapper around Workspace |
| `components/ErrorBoundary.tsx` | Class-based React error boundary wrapping the workspace |
| `components/Grainient` | OGL-based WebGL gradient animation (3rd party component via .d.ts) |
| `stores/chatStore.ts` | Zustand v5 store: annotations, messages, settings, streaming state; auto-persist (800ms debounce) |
| `hooks/useAnnotations.ts` | Canvas drawing logic: tool state machine, coordinate transforms, annotation creation, `drawAnnotation()` |
| `hooks/useAgentManager.ts` | Wraps `window.electronAPI.agent.generate()` — singleton reference across renders |
| `hooks/cancelGeneration.ts` | Calls `window.electronAPI.cancel.cancel()` + removes from generating set |
| `types/index.ts` | Shared types: `Annotation`, `BoundingBox`, `ToolType`, `AISettings`, `AgentType`, `SnapLine` |
| `types/electron.d.ts` | Type declarations for `window.electronAPI` (preload bridge) |
| `utils/code.ts` | `injectFontAwesomeCSS()`, `injectScrollScript()`, `wrapRectContent()`, `DEFAULT_SYSTEM_PROMPT` |
| `utils/zIndex.ts` | Centralized z-index scale with named constants |
| `utils/snap.ts` | `snapMove()` and `snapResize()` — alignment snapping between rects (6px threshold) |

### Electron Main Process (electron/)

| File | Role |
|------|------|
| `main.js` | BrowserWindow creation (1400x900), IPC handler registration, startup hooks |
| `preload.cjs` | `contextBridge` exposing `window.electronAPI` to renderer via `ipcRenderer.invoke()` |
| `ai/client.js` | OpenAI-compatible SSE streaming client (Node.js `fetch`), `{env:VAR}` API key resolution |
| `ai/agent.js` | `agent:generate` dispatcher — streaming (tool-use API with read/write/finish tools) vs CLI agents (spawn) |
| `ipc/settings.js` | Read/write `~/.pagesprite/settings.json` with defaults |
| `ipc/workspace.js` | Read/write `~/.pagesprite/workspace.json`, temp dir cleanup |
| `ipc/project.js` | File dialog save/open for `.pagesprite.json` project files |
| `ipc/cancel.js` | `CancelManager` singleton — `AbortController` map + `ChildProcess` map |
| `ipc/hooks.js` | Startup hook runner — `spawnSync` scripts from `settings.json` `hooks.startup` array |
| `assets/fontawesome.js` | Reads Font Awesome from node_modules, replaces font file URLs with base64 data URIs, caches result |

### Two-tier Annotation System

- **Rect annotations** (`type: "rect"`): Define AI generation regions. Have a `boundingBox` and optional `generatedCode`. Rendered as iframe overlays (white bg + border + config panel).
- **Child annotations** (`type: pen | arrow | rectangle | ellipse | highlight | text`): Drawn on top of rects as visual feedback. Auto-assigned a `parentId` via `findParentRect()` hit testing. Consumed as context during AI generation then deleted. Child annotations with empty `text` are filtered out.

### Agent Types

- **streaming** (default): Built-in tool-use agent. Makes OpenAI-compatible SSE calls with read/write/list/finish tool definitions. Supports both streaming API (for tool calls) and standard completion. Max 25 iterations.
- **opencode**: Spawns `opencode run --dir {dir} --format json <prompt>`. Reads result from `index.html`.
- **claude**: Spawns `claude -p <prompt>`. Reads result from `index.html`.
- **custom**: Spawns arbitrary CLI command with configurable args template. Supports `{dir}` and `{contextFile}` placeholders.

Work directory: `~/.pagesprite/tmp/<rect_id>/` — contains `index.html` (existing code for revisions).

### Key Patterns

- **Per-rect generation**: Each rect independently generates HTML in its own `PerRectFrame` iframe. Revision entries store in `revisionHistory` map.
- **Cancel**: `CancelManager` stores `AbortController` per rect ID (streaming) or `ChildProcess` reference (CLI).
- **Workspace auto-save**: Zustand `subscribe` → debounced 800ms → `window.electronAPI.workspace.save()`. Skips save while `isStreaming`.
- **Settings**: Written to `~/.pagesprite/settings.json`. No migration layer.
- **Startup hooks**: Runs scripts from settings.json on app startup. Parses stdout `KEY=VALUE` lines into `process.env`.
- **Prompt structure**: `buildPromptParts()` returns `{ system, history, current }` — picks `SYSTEM_PROMPT_STREAMING` (tool workflow) vs `SYSTEM_PROMPT_COMMON` (shared role + style preferences) based on agent type.
- **Font Awesome**: Bundled offline via `fontawesome.js` — reads from node_modules, base64-encodes webfonts, injects into all generated HTML.
- **Iframe mask**: Transparent mask over each per-rect iframe. In pan mode: intercepts all events. In cursor mode: passes events through so generated content is interactable.
- **Iframe reset**: Per-rect iframe key includes a version counter (`iframeResetVersions`) — incrementing it forces React to remount the iframe, reloading srcdoc from scratch.

### TypeScript Config

- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- JSX: `react-jsx` (React 19 automatic runtime)
- Module: `ESNext` with `bundler` resolution
- Source: `src/`, excludes `electron/` (plain JS)

### Z-Index Scale

Named constants in `src/utils/zIndex.ts`. Key values:
- `CANVAS_DEFAULT: 1` — canvas in cursor/pan mode
- `CANVAS_DRAWING: 490` — canvas in drawing modes
- `PER_RECT_BASE: 60` — dynamic base for per-rect elements (base + i*2)
- `RECT_OUTLINE/HANDLES: 200-202` — selection UI
- `LEFT_TOOLBAR: 500` — per-rect annotation toolbar
- `REGION_PANEL: 510` — prompt input panel
- `WORKSPACE_OVERLAY/FLOATING_TOOLBAR: 500-1000` — workspace UI

### CI / Build

GitHub Actions workflow (`.github/workflows/build.yml`):
- Triggers: push to main, tags `v*`, manual dispatch
- Matrix: ubuntu-22.04, windows-2022, macos-14
- Node.js 22, `npm ci`, `npm run electron:build`
- Artifacts uploaded from `release/`
