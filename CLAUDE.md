# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server (frontend only, port 1420)
npm run tauri:dev        # Tauri dev mode: window + Vite HMR
npm run build            # Frontend-only prod build (tsc + vite)
npm run tauri:build      # Production build: compiles Rust + bundles DMG/app
npm run preview          # Preview Vite build
cd src-tauri && cargo check  # Check Rust compilation
npx tsc --noEmit         # TypeScript type check only (no output = clean)
```

## Architecture

PageSprite is a **Tauri 2** desktop app: users draw rect annotations ("canvases") on an infinite canvas workspace, then prompt AI per-rect to generate HTML content rendered inside iframe overlays. Pure annotation-driven workflow — no chat panel.

### Data Flow

```
User draws rect → Zustand store → types prompt in RegionConfig panel
  → invoke('ai_chat_stream') → Rust backend → OpenAI-compatible SSE API
  → SSE chunks via Tauri events (ai:chunk:{streamId}) → useAIStream accumulates
  → ai:done → extractCodeFromResponse → PerRectFrame iframe srcdoc updated
```

### Frontend (React 19 + TypeScript + Vite)

| File | Role |
|------|------|
| `src/components/Workspace.tsx` | Main workspace (~2700 lines). Infinite canvas (pan/zoom/dot-grid), iframe preview, canvas annotation overlay, per-rect iframe overlays (`PerRectFrame`), AI loading overlay with Grainient WebGL animation, floating glassmorphism toolbar, zoom controls, snap guides, exit animation system (`liveOverlayIds`). Inline sub-components: `TextInputPopup`, `AnnotationNotePopup`, `RegionConfig` (prompt panel with resizable textarea), `RectControls` (8 resize handles), `RectTitleBar` (draggable title bar), `RectAnnotationCanvas` (per-rect child annotation canvas), `PerRectFrame` (per-rect iframe). |
| `src/components/Toolbar.tsx` | Tool selection (cursor/pan/rect/pen/arrow/rectangle/ellipse/text/highlight), color palette, undo/redo, clear, settings. Supports `floating` glassmorphism mode. |
| `src/components/SettingsDialog.tsx` | Modal for API endpoint/key/model/system prompt/agent type. Persisted via Rust. |
| `src/components/Layout.tsx` | Full-height flex wrapper. |
| `src/components/Grainient.jsx` + `.d.ts` + `.css` | WebGL shader component (OGL library) for loading overlay background — animated gradient with grain texture. Props: colors, warp, blend, noise, grain, contrast/gamma/saturation params. |
| `src/components/ErrorBoundary.tsx` | React error boundary wrapper. |
| `src/hooks/useAIStream.ts` | Tauri event listeners (SSE proxy), stream accumulation, code extraction, concurrent per-rect stream isolation. Chunks throttled via rAF. |
| `src/hooks/useAnnotations.ts` | Canvas mouse event handling per tool type, coordinate conversion (`canvasToDoc`/`docToCanvas` with pan/zoom/scroll), `findParentRect` for auto-parenting. Contains `drawAnnotation()` for rendering pen/highlight/arrow/text/rect on canvas, `drawNumberBadge()`, `drawNoteBadge()`. |
| `src/hooks/cancelGeneration.ts` | Calls `invoke("cancel_generation")` + store cleanup for aborting active generation. |
| `src/hooks/useAgentManager.ts` | Module-level singleton wrapping `invoke("run_agent_generate")` for agent-based generation (streaming or CLI). |
| `src/stores/chatStore.ts` | Zustand v5 store: annotations, messages, streaming state (ref-counted `streamCount`), `generatingAnnotationIds`, `revisionHistory`, workspace status, settings, all mutation actions. Settings sync via `invoke('save_settings')`. |
| `src/utils/code.ts` | `extractCodeFromResponse` (```html blocks), `injectScrollScript` (scroll-tracking postMessage), `wrapRectContent` (fragment → full HTML with overflow:hidden), `DEFAULT_SYSTEM_PROMPT`, `buildAnnotationPrompt`. |
| `src/utils/snap.ts` | `snapMove`/`snapResize` — edge alignment within 6px threshold. Returns snapped bounds + alignment line positions. |
| `src/utils/zIndex.ts` | Centralized z-index scale (REGION_BG: 50, PER_RECT_BASE: 60, CANVAS_DRAWING: 490, LEFT_TOOLBAR: 500, REGION_PANEL: 510, SNAP_LINES: 999, POPUPS: 10000, etc.). |
| `src/types/index.ts` | All TS types: `Annotation`, `AnnotationType`, `Point`, `BoundingBox`, `Message`, `AISettings`, `ToolType`, `WorkspaceStatus`, `SnapLine`. `Annotation` includes `promptWidth`/`promptHeight` for textarea resize persistence. |

### Rust Backend (src-tauri/src/)

| File | Role |
|------|------|
| `lib.rs` | Registers IPC handlers: `CancelManager` state, `dialog` plugin, all command modules (agent, workspace, settings, project, cancel). |
| `main.rs` | Entry point, calls `lib::run()`. |
| `cancel.rs` | `CancelManager` — shared task cancellation using `watch::channel<bool>`. Three operations: `register(id)` → returns a receiver, `cancel(id)` → sends `true`, `unregister(id)` → cleanup on normal completion. `cancel_generation` Tauri command. |
| `hooks.rs` | Startup hook system — runs scripts from `~/.pagesprite/settings.json` (`hooks.startup` array), parses stdout `KEY=VALUE` lines into environment variables. Supports `.sh`/`.js`/`.py`/`.bat`/`.ps1` per platform. |
| `commands/agent.rs` | `run_agent_generate` — dual-path generator: `streaming` mode calls AI API directly, `custom`/named agents (opencode, claude) spawn CLI processes into `~/.pagesprite/tmp/{rect_id}/`. `check_agent_installed`, `prepare_work_dir` helpers. |
| `commands/workspace.rs` | `save_workspace` / `load_workspace` — auto-save/load to `~/.pagesprite/workspace.json` (all annotations + messages). `clear_temp_dir` — cleans up agent tmp dirs. |
| `commands/settings.rs` | `save_settings` / `load_settings` — persists to `~/.pagesprite/settings.json`. |
| `commands/project.rs` | `save_project` / `load_project` — file dialog (`.pagesprite.json`), serializes full project state. |
| `ai/client.rs` | OpenAI-compatible HTTP client. Shared `reqwest::Client` via `OnceLock`. Streams SSE from `{endpoint}/chat/completions`. Accepts optional cancel receiver for `tokio::select!` abort. |

### Key Patterns

- **Dual-path generation**: Two generation modes — `streaming` calls the AI API directly (SSE proxy through Rust), and `custom`/named agents (opencode, claude) spawn a CLI process that modifies `~/.pagesprite/tmp/{rect_id}/index.html`. The `run_agent_generate` command dispatches based on `agent_type`. CLI agents are cancellable via `CancelManager` (watch channel + `tokio::select!`).
- **Cancel generation**: `CancelManager` in `cancel.rs` stores `watch::Sender<bool>` per rect ID. When canceled: CLI agents get `child.kill()`, streaming agents break the SSE loop. Frontend `cancelGeneration.ts` combines the Tauri invoke with store cleanup. Loading overlay exit animation (0.6s fade) is decoupled from store removal via `liveOverlayIds` local state with 650ms delayed removal.
- **Per-rect generation**: Each rect independently generates HTML, rendered in its own `PerRectFrame` iframe. Does NOT push to chat history. Child `RectAnnotationCanvas` draws per-rect annotations at parent rect z-index + 1. Global generation serializes all annotations as context for full-page generation.
- **Loading overlay**: Grainient WebGL shader component (OGL library) as animated background with centered "Generating…" text (text-breath opacity pulse). Fade in on start (0.2s), fade out on complete/cancel (0.6s). Per-rect streams show this overlay; global stream shows rAF-throttled `streamingContent`.
- **Annotation hierarchy**: Rect annotations own child annotations (pen/arrow/highlight/text/rectangle/ellipse). `findParentRect` auto-assigns parent based on containment. Deleting a rect recursively deletes its children. Undo/redo via component-level `redoStackRef`.
- **RegionConfig panel**: Right-side panel for selected rects. Content type presets (手机App 375×812, 平板App 768×1024, 网页 1440×900, 自由), resizable textarea with saved dimensions (`promptWidth`/`promptHeight`), generate button, delete button (red, bottom-left).
- **Cursor vs Pan**: Cursor enables iframe interaction (`pointer-events: auto`), rect selection, 8 resize handles. Pan provides drag-to-pan with badge-click annotation deletion (15px hit-test radius). Tool change clears selection when switching to rect/pan.
- **Coordinate system**: Three refs — `scrollOffsetRef` (iframe scroll), `transformRef` (panX + panY + zoom). Canvas positioned absolute at container level (not inside pan layer), applies transforms via `ctx.translate(pan) → ctx.scale(zoom) → ctx.translate(-scroll)` during draw. PerRectFrames positioned manually via inline style.
- **Two-finger trackpad pan**: Iframe content has `overflow:hidden` and a transparent mask overlay blocks WKWebView NSScrollView gesture capture (macOS specific). The main canvas pan layer handles the gesture instead.
- **Auto-save**: Workspace (annotations + messages) auto-saves to `~/.pagesprite/workspace.json` on every mutation via `invoke('save_workspace')` in Zustand subscribe. Loaded on app start via `loadWorkspace()`.
- **Startup hooks**: `hooks.rs` runs scripts from `~/.pagesprite/settings.json` (`hooks.startup` array) on app startup. Script stdout `KEY=VALUE` lines are injected as environment variables (useful for dynamic API key fetching).
- **Textarea resize persistence**: Dimensions saved to annotation's `promptWidth`/`promptHeight` via `onMouseUp` handler after CSS resize. Restored on re-mount.
- **Snap system**: `snapMove`/`snapResize` snap rect edges to other rects within 6px. Alignment guides at z-index 999.
- **Styling**: All inline `style` objects. Glassmorphism: `rgba(240,240,240,0.6)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(0,0,0,0.06)`. Key animations: `spin`, `border-glow`, `scan-down`, `fade-pulse`, `text-breath`, `loading-fade-in`. Dot grid via `radial-gradient`.
- **IME handling**: `useIMEEnter` distinguishes real Enter from IME composition (Chinese Pinyin) using `isComposing` + `compositionend` edge case.
- **Element position extraction**: `handleRegenerate` walks PerRectFrame iframe DOM via `getBoundingClientRect()`, collecting tag/id/class/text/bounds for visible elements into a structured position map in the AI prompt.
- **SSE Proxy**: All AI API calls through Rust backend (avoids CORS, keeps API keys server-side). Logs full request to stderr with stream ID and timing. Cross-platform hook runner for script execution.
