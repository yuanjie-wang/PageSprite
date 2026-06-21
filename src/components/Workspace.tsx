import { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "../stores/chatStore";
import { useAnnotations, drawAnnotation, docToCanvas, type ViewTransform } from "../hooks/useAnnotations";
import { cancelGeneration } from "../hooks/cancelGeneration";
import { useAgentManager } from "../hooks/useAgentManager";
import { saveWorkspaceNow } from "../stores/chatStore";
import Toolbar from "./Toolbar";
import ErrorBoundary from "./ErrorBoundary";
import { injectScrollScript, wrapRectContent, injectFontAwesomeCSS } from "../utils/code";
import Grainient from "./Grainient";
import { Z_INDEX } from "../utils/zIndex";
import { snapMove, snapResize } from "../utils/snap";
import type { Annotation, ToolType, SnapLine } from "../types";
import { TriangleAlert, Sparkles } from "lucide-react";
import LeftAnnotationToolbar from "./LeftAnnotationToolbar";
import ZoomControls from "./ZoomControls";
import { useT } from "../i18n";

/**
 * Detects whether a keydown event is part of an active IME composition.
 * When isComposing is true, the Enter should be consumed by the IME, not
 * treated as a submit — this prevents accidental generation while the
 * user is still selecting IME candidates.
 */
function useIMEEnter() {
  const isIMEEnter = useCallback((e: React.KeyboardEvent) => {
    return (e.nativeEvent as KeyboardEvent).isComposing;
  }, []);
  return { onCompositionEnd: () => {}, isIMEEnter };
}

const BLANK_HTML =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;min-height:100vh}</style></head><body></body></html>';
function perRectBlank(dark: boolean): string {
  const bg = dark ? "#1c1c1e" : "#fff";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;min-height:100vh;background:${bg}}</style></head><body></body></html>`;
}

/** Incremented per rect to force iframe remount on reset */
const iframeResetVersions: Record<string, number> = {};

/** Truncate text to at most `max` units where a CJK character = 1 unit and an English word = 1 unit. */
function summarizeTitle(text: string, max: number): string {
  let units = 0;
  let pos = 0;
  while (pos < text.length) {
    if (units >= max) return text.slice(0, pos) + "…";
    const ch = text[pos];
    if (/[一-鿿]/.test(ch)) {
      units++;
      pos++;
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      const wordStart = pos;
      while (pos < text.length && /[a-zA-Z0-9]/.test(text[pos])) pos++;
      if (units + 1 > max) {
        const prefix = text.slice(0, wordStart).trimEnd();
        return prefix ? prefix + "…" : "…";
      }
      units++;
    } else {
      pos++;
    }
  }
  return text;
}

function TextInputPopup({
  x,
  y,
  onSubmit,
  onCancel,
  initialValue,
}: {
  x: number;
  y: number;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  initialValue?: string;
}) {
  const t = useT();
  const [value, setValue] = useState(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const { onCompositionEnd, isIMEEnter } = useIMEEnter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y - 2,
        zIndex: Z_INDEX.POPUPS,
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onCompositionEnd={onCompositionEnd}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isIMEEnter(e)) {
            onSubmit(value);
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        onBlur={() => onSubmit(value)}
        placeholder={t("annotationPlaceholder")}
        style={{
          padding: "4px 8px",
          border: "2px solid var(--accent)",
          borderRadius: 6,
          background: "#1a1a2e",
          color: "#fff",
          fontSize: 14,
          outline: "none",
          minWidth: 200,
          fontFamily: "inherit",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      />
    </div>
  );
}

function AnnotationNotePopup({
  x,
  y,
  onSubmit,
  onCancel,
  initialValue,
}: {
  x: number;
  y: number;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  initialValue?: string;
}) {
  const t = useT();
  const [value, setValue] = useState(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const { onCompositionEnd, isIMEEnter } = useIMEEnter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        left: Math.max(0, Math.min(x, window.innerWidth - 320)),
        top: Math.max(0, y),
        zIndex: Z_INDEX.POPUPS,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "rgba(240, 240, 240, 0.65)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        minWidth: 280,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#888",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {t("changes")}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onCompositionEnd={onCompositionEnd}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isIMEEnter(e)) {
            onSubmit(value);
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        placeholder={t("changesPlaceholder")}
        style={{
          padding: "8px 10px",
          border: "1px solid rgba(0, 0, 0, 0.15)",
          borderRadius: 6,
          background: "rgba(255, 255, 255, 0.8)",
          color: "#333",
          fontSize: 13,
          outline: "none",
          width: "100%",
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            height: 28,
            padding: "0 12px",
            border: "1px solid rgba(0, 0, 0, 0.15)",
            borderRadius: 6,
            background: "transparent",
            color: "#666",
            fontSize: 12,
          }}
        >
          {t("cancel")}
        </button>
        <button
          onClick={() => onSubmit(value)}
          disabled={!value.trim()}
          style={{
            height: 28,
            padding: "0 12px",
            border: "none",
            borderRadius: 6,
            background: value.trim() ? "#4f8cff" : "#ccc",
            color: value.trim() ? "#fff" : "#999",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {t("confirm")}
        </button>
      </div>
    </div>
  );
}

function RegionConfig({
  annotationId,
  isSelected,
  zoom,
  panX,
  panY,
  scrollOffset,
  onGenerate,
  onCancel,
}: {
  annotationId: string;
  isSelected: boolean;
  zoom: number;
  panX: number;
  panY: number;
  scrollOffset: { x: number; y: number };
  onGenerate: (annotationId: string, prompt: string, contentType: string) => void;
  onCancel: (annotationId: string) => void;
}) {
  const t = useT();
  const [prompt, setPrompt] = useState(() => {
    const a = useChatStore.getState().annotations.find((a) => a.id === annotationId);
    // Clear prompt for canvases that already have generated content
    if (a?.generatedCode) return "";
    return a?.text || "";
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const generatingAnnotationIds = useChatStore((s) => s.generatingAnnotationIds);
  const isBusy = generatingAnnotationIds.includes(annotationId);
  const { onCompositionEnd, isIMEEnter } = useIMEEnter();

  // Read annotation from store reactively (updates on resize)
  const annotation = useChatStore((s) =>
    s.annotations.find((a) => a.id === annotationId),
  );
  const childAnnotations = useChatStore(
    useShallow((s) =>
      s.annotations.filter((a) => a.parentId === annotationId && a.text),
    ),
  );
  const canGenerate = prompt.trim() || (!!annotation?.generatedCode && childAnnotations.length > 0);

  // Clear prompt after generation completes, but not on cancellation
  const cancelledRef = useRef(false);
  const prevBusyRef = useRef(isBusy);
  useEffect(() => {
    if (prevBusyRef.current && !isBusy) {
      if (!cancelledRef.current) {
        setPrompt("");
      }
      cancelledRef.current = false;
    }
    prevBusyRef.current = isBusy;
  }, [isBusy]);

  // Remember the original user-drawn dimensions for "custom" restoration
  const originalBoundsRef = useRef(annotation?.boundingBox ? { ...annotation.boundingBox } : null);

  const CONTENT_TYPES = [
    { key: "phoneApp", label: "phoneApp", width: 375, height: 812 },
    { key: "tabletApp", label: "tabletApp", width: 768, height: 1024 },
    { key: "web", label: "web", width: 1440, height: 900 },
    { key: "free", label: "free", width: undefined as unknown as number, height: undefined as unknown as number },
  ];

  // Determine content type from current bounds, or default to "web"
  const currentType = annotation?.boundingBox
    ? (CONTENT_TYPES.find(
        (t) => t.key !== "free" && t.width === annotation.boundingBox!.width && t.height === annotation.boundingBox!.height,
      )?.key ?? "free")
    : "free";

  const [contentType, setContentType] = useState(currentType);

  // Save textarea dimensions when user manually resizes it (on mouse up to avoid cascading re-renders during drag)
  const handleTextareaMouseUp = () => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const w = textarea.style.width;
    const h = textarea.style.height;
    if (w && h) {
      useChatStore.getState().updateAnnotationPromptSize(annotationId, w, h);
    }
  };

  if (!annotation || !annotation.boundingBox) return null;

  const b = annotation.boundingBox;
  const so = scrollOffset;

  // Viewport position
  const vp = {
    x: (b.x - so.x) * zoom + panX,
    y: (b.y - so.y) * zoom + panY,
    width: b.width * zoom,
    height: b.height * zoom,
  };

  const handleContentTypeClick = (type: typeof CONTENT_TYPES[number]) => {
    setContentType(type.key);
    if (type.key === "free") {
      // Restore original user-drawn dimensions, keeping center
      const orig = originalBoundsRef.current;
      if (orig) {
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        useChatStore.getState().updateAnnotationBounds(annotationId, {
          x: cx - orig.width / 2,
          y: cy - orig.height / 2,
          width: orig.width,
          height: orig.height,
        });
      }
    } else if (type.width && type.height) {
      // Keep center position, change dimensions
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      useChatStore.getState().updateAnnotationBounds(annotationId, {
        x: cx - type.width / 2,
        y: cy - type.height / 2,
        width: type.width,
        height: type.height,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      cancelledRef.current = true;
      onCancel(annotationId);
    } else if (e.key === "Enter" && !e.shiftKey && !(e.metaKey || e.ctrlKey) && !isBusy && !isIMEEnter(e) && canGenerate) {
      e.preventDefault();
      onGenerate(annotationId, prompt, contentType);
    }
  };

  return (
    <>
      {/* White background + light gray border for the pending rect area */}
      <div
        style={{
          position: "absolute",
          left: vp.x,
          top: vp.y,
          width: vp.width,
          height: vp.height,
          background: "var(--bg-surface)",
          border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
          borderRadius: 4,
          pointerEvents: "none",
          zIndex: Z_INDEX.REGION_BG,
        }}
      />
      {/* Config panel — right side of rect, only when selected */}
      {isSelected && (
        <div
          data-rect-control="true"
          style={{
            position: "absolute",
            left: vp.x + vp.width + 8,
            top: vp.y + vp.height / 2,
            transform: "translateY(-50%)",
            zIndex: Z_INDEX.REGION_PANEL,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "color-mix(in srgb, var(--bg-tertiary) 80%, transparent)",
            backdropFilter: "blur(20px) saturate(1.5)",
            WebkitBackdropFilter: "blur(20px) saturate(1.5)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            minWidth: 260,
            maxWidth: "85%",
          }}
        >
          {/* Content type row (merged: sets both dimensions + content type) */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 6,
              }}
            >
              {t("contentType")}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {CONTENT_TYPES.map((ct) => {
                const active = contentType === ct.key;
                return (
                  <button
                    key={ct.key}
                    onClick={() => handleContentTypeClick(ct)}
                    style={{
                      flex: 1,
                      border: "none",
                      borderRadius: 6,
                      padding: "5px 6px",
                      fontSize: 11,
                      fontWeight: active ? 600 : 400,
                      color: active ? "#fff" : "var(--text-secondary)",
                      background: active ? "#4f8cff" : "color-mix(in srgb, var(--bg-tertiary) 50%, transparent)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      fontFamily: "inherit",
                    }}
                  >
                    {t(ct.label)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt row */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 6,
              }}
            >
              {t("prompt")}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onCompositionEnd={onCompositionEnd}
              onKeyDown={handleKeyDown}
              onMouseUp={handleTextareaMouseUp}
              placeholder={annotation?.generatedCode ? t("promptPlaceholderRevise") : t("promptPlaceholderNew")}
              disabled={isBusy}
              rows={3}
              style={{
                flex: annotation?.promptWidth ? undefined : 1,
                width: annotation?.promptWidth ? annotation.promptWidth : undefined,
                height: annotation?.promptHeight ? annotation.promptHeight : undefined,
                border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                outline: "none",
                borderRadius: 6,
                padding: "6px 8px",
                background: isBusy ? "color-mix(in srgb, var(--bg-tertiary) 20%, transparent)" : "color-mix(in srgb, var(--bg-tertiary) 10%, transparent)",
                fontSize: 13,
                color: isBusy ? "var(--text-muted)" : "var(--text-primary)",
                fontFamily: "inherit",
                resize: "both",
                lineHeight: 1.5,
              }}
            />
              {isBusy ? (
                <button
                  onClick={() => { cancelledRef.current = true; onCancel(annotationId); }}
                  title={t("cancelGenerate")}
                  style={{
                    width: 30,
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: 6,
                    background: "color-mix(in srgb, var(--danger) 15%, transparent)",
                    color: "var(--danger)",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => canGenerate && onGenerate(annotationId, prompt, contentType)}
                  disabled={!canGenerate}
                  title={annotation?.generatedCode && childAnnotations.length > 0 && !prompt.trim() ? t("generateFromAnnotations") : t("generateInRegion")}
                  style={{
                    width: 30,
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: 6,
                    background: canGenerate ? "#4f8cff" : "color-mix(in srgb, var(--bg-tertiary) 50%, transparent)",
                    color: canGenerate ? "#fff" : "var(--text-muted)",
                    cursor: canGenerate ? "pointer" : "not-allowed",
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={15} />
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--text-muted)",
              userSelect: "none",
            }}
          >
            <span>{t("shiftEnterHint")}</span>
          </div>
        </div>
      )}
    </>
  );
}

function RectControls({
  annotationId,
  zoom,
  panX,
  panY,
  scrollOffset,
  onDirectResize,
  onSetIFramePE,
  onSnapChange,
}: {
  annotationId: string;
  zoom: number;
  panX: number;
  panY: number;
  scrollOffset: { x: number; y: number };
  onDirectResize?: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  onSetIFramePE?: (id: string, value: string) => void;
  onSnapChange?: (lines: SnapLine[]) => void;
}) {
  const annotation = useChatStore((s) =>
    s.annotations.find((a) => a.id === annotationId),
  );
  const [resizeDragging, setResizeDragging] = useState<string | null>(null);
  const dragStartRef = useRef<{
    mouseX: number; mouseY: number;
    bounds: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // Toggle iframe pointer-events + global user-select during resize drag —
  // prevents iframes from stealing mouse events and text selection.
  useEffect(() => {
    const isDragging = resizeDragging !== null;
    onSetIFramePE?.(annotationId, isDragging ? "none" : "");
    document.body.style.userSelect = isDragging ? "none" : "";
    return () => {
      onSetIFramePE?.(annotationId, "");
      document.body.style.userSelect = "";
    };
  }, [resizeDragging, annotationId, onSetIFramePE]);

  const resizeEdges: Record<string, ('left' | 'right' | 'top' | 'bottom')[]> = {
    se: ['right', 'bottom'],
    nw: ['left', 'top'],
    ne: ['right', 'top'],
    sw: ['left', 'bottom'],
    n: ['top'],
    s: ['bottom'],
    w: ['left'],
    e: ['right'],
  };

  useEffect(() => {
    if (!resizeDragging) return;
    const edges = resizeEdges[resizeDragging] ?? [];
    const onResize = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const { mouseX, mouseY, bounds } = dragStartRef.current;
      const dx = (e.clientX - mouseX) / zoom;
      const dy = (e.clientY - mouseY) / zoom;
      const nb = { ...bounds };
      switch (resizeDragging) {
        case "se":
          nb.width = Math.max(100, bounds.width + dx);
          nb.height = Math.max(100, bounds.height + dy);
          break;
        case "nw":
          nb.x = bounds.x + dx; nb.y = bounds.y + dy;
          nb.width = Math.max(100, bounds.width - dx);
          nb.height = Math.max(100, bounds.height - dy);
          break;
        case "ne":
          nb.y = bounds.y + dy;
          nb.width = Math.max(100, bounds.width + dx);
          nb.height = Math.max(100, bounds.height - dy);
          break;
        case "sw":
          nb.x = bounds.x + dx;
          nb.width = Math.max(100, bounds.width - dx);
          nb.height = Math.max(100, bounds.height + dy);
          break;
        case "n":
          nb.y = bounds.y + dy;
          nb.height = Math.max(100, bounds.height - dy);
          break;
        case "s":
          nb.height = Math.max(100, bounds.height + dy);
          break;
        case "w":
          nb.x = bounds.x + dx;
          nb.width = Math.max(100, bounds.width - dx);
          break;
        case "e":
          nb.width = Math.max(100, bounds.width + dx);
          break;
      }

      // Snap to other rects
      const others = useChatStore.getState().annotations
        .filter(a => a.type === "rect" && a.boundingBox && a.id !== annotationId)
        .map(a => a.boundingBox!);
      const snapped = snapResize(nb, edges, others);
      // Maintain minimum size after snap
      if (snapped.bounds.width < 100) snapped.bounds.width = 100;
      if (snapped.bounds.height < 100) snapped.bounds.height = 100;
      onSnapChange?.(snapped.lines);

      useChatStore.getState().updateAnnotationBounds(annotationId, snapped.bounds);
      onDirectResize?.(annotationId, snapped.bounds);
    };
    const onUp = () => {
      if (dragStartRef.current) {
        const { bounds: startBounds } = dragStartRef.current;
        const currentBounds = useChatStore.getState().annotations.find(
          (a) => a.id === annotationId,
        )?.boundingBox;
        if (currentBounds) {
          const hasChanged =
            currentBounds.x !== startBounds.x ||
            currentBounds.y !== startBounds.y ||
            currentBounds.width !== startBounds.width ||
            currentBounds.height !== startBounds.height;
          if (hasChanged) {
            useChatStore.getState().scaleChildAnnotations(annotationId, startBounds, currentBounds);
          }
        }
      }
      onSnapChange?.([]);
      setResizeDragging(null);
      dragStartRef.current = null;
    };
    document.addEventListener("mousemove", onResize);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onResize);
      document.removeEventListener("mouseup", onUp);
      onSnapChange?.([]);
    };
  }, [resizeDragging, zoom, annotationId, onDirectResize, onSnapChange]);

  if (!annotation || !annotation.boundingBox) return null;

  const b = annotation.boundingBox;
  const vp = {
    x: (b.x - scrollOffset.x) * zoom + panX,
    y: (b.y - scrollOffset.y) * zoom + panY,
    width: b.width * zoom,
    height: b.height * zoom,
  };
  const handleSize = 10;

  const handleResizeStart = (handle: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizeDragging(handle);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      bounds: { ...b },
    };
  };

  const handles = {
    nw: { x: vp.x, y: vp.y },
    n:  { x: vp.x + vp.width / 2, y: vp.y },
    ne: { x: vp.x + vp.width, y: vp.y },
    w:  { x: vp.x, y: vp.y + vp.height / 2 },
    e:  { x: vp.x + vp.width, y: vp.y + vp.height / 2 },
    sw: { x: vp.x, y: vp.y + vp.height },
    s:  { x: vp.x + vp.width / 2, y: vp.y + vp.height },
    se: { x: vp.x + vp.width, y: vp.y + vp.height },
  };

  return (
    <>
      {/* Selection outline */}
      <div
        style={{
          position: "absolute",
          left: vp.x,
          top: vp.y,
          width: vp.width,
          height: vp.height,
          border: "2px solid #4f8cff",
          borderRadius: 4,
          background: "transparent",
          pointerEvents: "none",
          zIndex: Z_INDEX.RECT_OUTLINE,
        }}
      />

      {/* Corner resize handles */}
      {(Object.entries(handles) as [string, { x: number; y: number }][]).map(([key, pos]) => (
        <div
          key={key}
          data-rect-control="true"
          onMouseDown={handleResizeStart(key)}
          style={{
            position: "absolute",
            left: pos.x - handleSize / 2,
            top: pos.y - handleSize / 2,
            width: handleSize,
            height: handleSize,
            background: "#ffffff",
            border: "2px solid #4f8cff",
            borderRadius: 2,
            cursor:
              key === "nw" || key === "se" ? "nwse-resize" :
              key === "ne" || key === "sw" ? "nesw-resize" :
              key === "n" || key === "s" ? "ns-resize" :
              "ew-resize",
            zIndex: Z_INDEX.RECT_HANDLES,
          }}
        />
      ))}

      {/* Size badge below the rect */}
      <div
        style={{
          position: "absolute",
          left: vp.x + vp.width / 2,
          top: vp.y + vp.height + 4,
          transform: "translateX(-50%)",
          zIndex: Z_INDEX.RECT_BADGE,
          background: "#4f8cff",
          color: "#fff",
          fontSize: 10,
          fontFamily: "monospace",
          padding: "1px 6px",
          borderRadius: 4,
          lineHeight: "16px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {Math.round(b.width)} × {Math.round(b.height)}
      </div>
    </>
  );
}

function RectTitleBar({
  annotationId,
  zoom,
  panX,
  panY,
  scrollOffset,
  onSelect,
  onDirectResize,
  onSetIFramePE,
  onActivate,
  onSnapChange,
  zIndex,
  currentTool,
}: {
  annotationId: string;
  zoom: number;
  panX: number;
  panY: number;
  scrollOffset: { x: number; y: number };
  onSelect: (id: string) => void;
  onDirectResize?: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  onSetIFramePE?: (id: string, value: string) => void;
  onActivate?: (id: string) => void;
  onSnapChange?: (lines: SnapLine[]) => void;
  zIndex: number;
  currentTool: ToolType;
}) {
  const annotation = useChatStore((s) =>
    s.annotations.find((a) => a.id === annotationId),
  );
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{
    mouseX: number; mouseY: number;
    bounds: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // Toggle iframe pointer-events + global user-select during drag
  useEffect(() => {
    const isDragging = dragging;
    onSetIFramePE?.(annotationId, isDragging ? "none" : "");
    document.body.style.userSelect = isDragging ? "none" : "";
    return () => {
      onSetIFramePE?.(annotationId, "");
      document.body.style.userSelect = "";
    };
  }, [dragging, annotationId, onSetIFramePE]);

  // Document-level move listeners
  useEffect(() => {
    if (!dragging) return;
    let didMove = false;
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const { mouseX, mouseY, bounds } = dragStartRef.current;
      const nb = {
        x: bounds.x + (e.clientX - mouseX) / zoom,
        y: bounds.y + (e.clientY - mouseY) / zoom,
        width: bounds.width,
        height: bounds.height,
      };
      if (Math.abs(e.clientX - mouseX) > 3 || Math.abs(e.clientY - mouseY) > 3) {
        didMove = true;
      }

      // Snap to other rects
      const others = useChatStore.getState().annotations
        .filter(a => a.type === "rect" && a.boundingBox && a.id !== annotationId)
        .map(a => a.boundingBox!);
      const snapped = snapMove(nb, others);
      onSnapChange?.(snapped.lines);

      useChatStore.getState().updateAnnotationBounds(annotationId, snapped.bounds);
      onDirectResize?.(annotationId, snapped.bounds);
    };
    const onUp = () => {
      if (!didMove) {
        onSelect(annotationId);
      }
      // Translate child annotations by the same delta
      if (dragStartRef.current) {
        const { bounds: startBounds } = dragStartRef.current;
        const currentBounds = useChatStore.getState().annotations.find(
          (a) => a.id === annotationId,
        )?.boundingBox;
        if (currentBounds) {
          const dx = currentBounds.x - startBounds.x;
          const dy = currentBounds.y - startBounds.y;
          if (dx !== 0 || dy !== 0) {
            useChatStore.getState().translateChildAnnotations(annotationId, dx, dy);
          }
        }
      }
      onSnapChange?.([]);
      setDragging(false);
      dragStartRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      onSnapChange?.([]);
    };
  }, [dragging, zoom, annotationId, onDirectResize, onSelect, onSnapChange]);

  if (!annotation || !annotation.boundingBox) return null;

  const b = annotation.boundingBox;
  const vpX = (b.x - scrollOffset.x) * zoom + panX;
  const vpY = (b.y - scrollOffset.y) * zoom + panY;
  const vpW = b.width * zoom;
  const title = annotation.text
    ? summarizeTitle(annotation.text, 8)
    : "画布";

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onActivate?.(annotationId);
    // Only allow drag in cursor or pan mode
    if (currentTool !== "cursor" && currentTool !== "pan") return;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      bounds: { ...b },
    };
    setDragging(true);
  };

  return (
    <div
      data-rect-control="true"
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: vpX,
        top: vpY - 24 - 5,
        width: vpW,
        height: 24,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: dragging ? "grabbing" : "move",
        background: "color-mix(in srgb, var(--bg-tertiary) 80%, transparent)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
        borderRadius: 8,
        padding: "0 8px",
        boxSizing: "border-box",
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--text-primary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "center",
          flex: 1,
        }}
      >
        {title}
      </span>
    </div>
  );
}

/**
 * Captures mousedown on the capture phase and deselects the rect unless the
 * target is a data-rect-control element (toolbar, handles, title bar, etc.).
 * This prevents accidental deselection when clicking buttons or resize handles
 * that happen to sit outside the rect boundary.
 */
function BackgroundDeselect({ onDeselect }: { onDeselect: () => void }) {
  const savedRef = useRef(onDeselect);
  savedRef.current = onDeselect;
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const path = e.composedPath?.() || [];
      for (const el of path) {
        if ((el as HTMLElement).getAttribute?.('data-rect-control') === 'true') return;
      }
      savedRef.current();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, []);

  return null;
}

/**
 * Per-rect iframe at container level.
 * No memo — lets React re-render on zoom/pan changes for position sync.
 * Uses transform: scale() so content scales proportionally with zoom.
 * Direct DOM manipulation during drag via updateRectIframe for smoothness.
 */
function PerRectFrame({ annotation, currentTool, iframeMap, zIndex, vp, zoom }: {
  annotation: Annotation;
  currentTool: ToolType;
  iframeMap: Map<string, HTMLIFrameElement>;
  zIndex: number;
  vp: { x: number; y: number; width: number; height: number };
  zoom: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const theme = useChatStore((s) => s.settings.theme);

  useEffect(() => {
    if (iframeRef.current) {
      iframeMap.set(annotation.id, iframeRef.current);
    }
    return () => { iframeMap.delete(annotation.id); };
  }, [annotation.id, iframeMap]);

  const docW = annotation.boundingBox?.width ?? vp.width;
  const docH = annotation.boundingBox?.height ?? vp.height;
  const dark = theme === "dark";

  return (
    <div
      style={{
        position: "absolute",
        left: vp.x,
        top: vp.y,
        width: docW,
        height: docH,
        transform: `scale(${zoom})`,
        transformOrigin: "0 0",
        zIndex,
      }}
    >
      <iframe
        ref={iframeRef}
        srcDoc={annotation.generatedCode ? wrapRectContent(annotation.generatedCode) : perRectBlank(dark)}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        title={`Region ${annotation.id}`}
        style={{
          width: "100%",
          height: "100%",
          border: annotation.generatedCode ? "none" : "1px solid color-mix(in srgb, var(--border) 50%, var(--text-secondary))",
          background: "var(--bg-surface)",
          pointerEvents: currentTool === "cursor" ? "auto" : "none",
          display: "block",
        }}
      />
      {/* Transparent mask: prevents scroll/pointer events from interfering with canvas interaction.
          In pan mode, blocks events so two-finger swipe pans the canvas instead of scrolling iframe content.
          In cursor mode, lets all events pass through so users can directly interact with generated content. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          pointerEvents: currentTool === "pan" ? "auto" : "none",
        }}
      />
    </div>
  );
}

/**
 * Per-rect canvas overlay that draws only child annotations belonging to this rect.
 * Positioned exactly over the rect iframe at zIndex + 1 so annotations sit above
 * their own canvas but below the next rect.
 */
function RectAnnotationCanvas({ annotationId, zoom, panX, panY, scrollOffset, zIndex }: {
  annotationId: string;
  zoom: number;
  panX: number;
  panY: number;
  scrollOffset: { x: number; y: number };
  zIndex: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotation = useChatStore((s) =>
    s.annotations.find((a) => a.id === annotationId),
  );
  const childAnnotations = useChatStore(
    useShallow((s) =>
      s.annotations.filter((a) => a.parentId === annotationId),
    ),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      if (!annotation?.boundingBox) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }

      const b = annotation.boundingBox;
      const cssW = Math.round(b.width * zoom);
      const cssH = Math.round(b.height * zoom);
      const dpr = window.devicePixelRatio || 1;
      const targetW = cssW * dpr;
      const targetH = cssH * dpr;

      // Avoid GPU compositing churn by only resizing when dimensions change
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.scale(zoom, zoom);
      ctx.translate(-b.x, -b.y);

      const clipY = { minY: b.y, maxY: b.y + b.height };
      childAnnotations.forEach((ann, i) => {
        drawAnnotation(ctx, ann, i + 1, clipY);
      });

      ctx.restore();
    } catch (err) {
      console.error("RectAnnotationCanvas draw error:", err);
    }
  }, [annotation?.boundingBox, zoom, childAnnotations]);

  const b = annotation?.boundingBox;
  if (!b) return null;

  const vpX = (b.x - scrollOffset.x) * zoom + panX;
  const vpY = (b.y - scrollOffset.y) * zoom + panY;

  // Only render canvas when it has non-zero size to avoid webview compositor issues
  if (b.width <= 0 || b.height <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        left: vpX,
        top: vpY,
        width: b.width * zoom,
        height: b.height * zoom,
        pointerEvents: "none",
        zIndex,
      }}
    />
  );
}

/**
 * Walk the per-rect iframe's rendered DOM and collect element bounding boxes.
 * Output is a structured position map so the LLM can match annotation (x,y)
 * coordinates to specific elements, rather than guessing from raw HTML alone.
 */
function WorkspaceContent() {
  const { generatedCode, workspaceStatus, workspaceError, setWorkspaceStatus } = useChatStore();
  const t = useT();
  const streamContent = useChatStore((s) => s.streamingContent);
  const settings = useChatStore((s) => s.settings);
  const settingsOpen = useChatStore((s) => s.settingsOpen);
  const annotations = useChatStore(useShallow((s) => s.annotations));
  const generatingAnnotationIds = useChatStore((s) => s.generatingAnnotationIds);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollOffsetRef = useRef({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.6);
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
  const [selectedRectId, setSelectedRectId] = useState<string | null>(null);
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);

  const perRectIframeMapRef = useRef(new Map<string, HTMLIFrameElement>());

  /** Walk a per-rect iframe's rendered DOM and collect visible element bounding boxes
   *  relative to the region's coordinate space. Output is a structured position map
   *  so the AI can match annotation (x,y) coordinates to specific elements. */
  function buildElementPositionMap(iframe: HTMLIFrameElement): string {
    const doc = iframe.contentDocument;
    if (!doc) return "";
    const items: string[] = [];
    const MAX = 25;
    function walk(el: Element) {
      if (items.length >= MAX) return;
      const tag = el.tagName.toLowerCase();
      if (["script","style","link","meta"].includes(tag)) return;
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 5 || h < 5) { for (let i = 0; i < el.children.length; i++) walk(el.children[i]); return; }
      const x = Math.round(rect.left);
      const y = Math.round(rect.top);
      const text = (el.textContent || "").trim().slice(0, 50);
      const cls = Array.from(el.classList).join(".");
      const id = el.id ? `#${el.id}` : "";
      if (text || ["img","svg","canvas","video","iframe"].includes(tag)) {
        items.push(`  <${tag}${id}${cls ? "."+cls : ""}> @(${x},${y}) ${w}x${h} "${text}"`);
      }
      for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
    }
    walk(doc.body);
    return items.join("\n");
  }

  const cancelledRef = useRef(new Set<string>());
  const handleCancelGeneration = useCallback((id: string) => {
    cancelledRef.current.add(id);
    cancelGeneration(id);
  }, []);
  const updateRectIframe = useCallback((id: string, bounds: { x: number; y: number; width: number; height: number }) => {
    const iframe = perRectIframeMapRef.current.get(id);
    if (iframe) {
      const so = scrollOffsetRef.current;
      iframe.style.left = ((bounds.x - so.x) * zoom + panOffset.x) + "px";
      iframe.style.top = ((bounds.y - so.y) * zoom + panOffset.y) + "px";
      iframe.style.width = bounds.width + "px";
      iframe.style.height = bounds.height + "px";
    }
  }, [zoom, panOffset]);
  const setRectIframePE = useCallback((id: string, value: string) => {
    const iframe = perRectIframeMapRef.current.get(id);
    if (iframe) iframe.style.pointerEvents = value;
    // Also toggle main preview iframe — it covers the entire panLayer and
    // would otherwise steal mouse events during drag.
    if (iframeRef.current) {
      iframeRef.current.style.pointerEvents = value === "none" ? "none" : "";
    }
  }, []);

  const allRects = useMemo(
    () => annotations.filter(a => a.type === "rect" && a.boundingBox && a.boundingBox.width >= 100 && a.boundingBox.height >= 100),
    [annotations],
  );

  // Per-rect z-index: stride of 4 groups each rect's layers together.
  //   iframe=base+0, canvas=base+1, titleBar=base+2, (free=base+3)
  const allRectZIndex = useMemo(() => {
    const map = new Map<string, number>();
    allRects.forEach((a, i) => map.set(a.id, Z_INDEX.PER_RECT_BASE + i * 4));
    return map;
  }, [allRects]);

  // Auto-deselect if the selected rect was removed
  useEffect(() => {
    if (selectedRectId && !allRects.find(a => a.id === selectedRectId)) {
      setSelectedRectId(null);
    }
  }, [allRects, selectedRectId]);

  // Auto-center view on mount
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(0.6);
  }, []);

  // Local overlay ID list — decoupled from store for exit animation control.
  // Additions are immediate, removals are delayed by 650ms so the exit
  // transition (0.6s) completes before DOM removal.
  const [liveOverlayIds, setLiveOverlayIds] = useState<string[]>([]);
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    setLiveOverlayIds((prev) => {
      const added = generatingAnnotationIds.filter((id) => !prev.includes(id));
      const removed = prev.filter((id) => !generatingAnnotationIds.includes(id));
      if (removed.length > 0) {
        for (const id of removed) {
          exitTimersRef.current.set(id, setTimeout(() => {
            exitTimersRef.current.delete(id);
            setLiveOverlayIds((p) => p.filter((i) => i !== id));
          }, 650));
        }
      }
      return added.length > 0 ? [...prev, ...added] : prev;
    });
  }, [generatingAnnotationIds]);

  const allOverlayRects = useMemo(
    () => annotations.filter(
      (a) => a.type === "rect" && a.boundingBox && liveOverlayIds.includes(a.id),
    ),
    [annotations, liveOverlayIds],
  );


  // Refs for imperative canvas control — bypass React batching during drag/pan for 60fps redraws
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const transformRef = useRef<ViewTransform | null>(null);
  const panOffsetRef = useRef(panOffset);

  transformRef.current = { panX: panOffset.x, panY: panOffset.y, zoom };
  panOffsetRef.current = panOffset;
  panOffsetRef.current = panOffset;

  const agentManager = useAgentManager();

  const showLoading = workspaceStatus === "loading";

  // Derive global loading phase from streamed content characteristics
  const globalPhase = useMemo(() => {
    const len = streamContent?.length ?? 0;
    const c = streamContent ?? "";
    if (len < 50) return { title: t("analyzing"), subtitle: t("analyzingSub") };
    if (!c.includes("```")) return { title: t("generating"), subtitle: t("generatingSub") };
    if (!c.includes("```html")) return { title: t("generatingHtml"), subtitle: t("generatingHtmlSub") };
    if (!c.includes("```\n") || len < 1500)
      return { title: t("styling"), subtitle: t("stylingSub") };
    return { title: t("finishing"), subtitle: t("finishingSub") };
  }, [streamContent]);

  const {
    currentTool,
    setCurrentTool,
    currentColor,
    setCurrentColor,
    pendingText,
    pendingNote,
    pendingRects,
    handleTextSubmit,
    handleTextCancel,
    handleNoteSubmit,
    handleNoteCancel,
    removePendingRect,
    clearPendingRects,
    handleRectCancel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useAnnotations(canvasRef, scrollOffsetRef, transformRef, {
    onDeselectRect: () => setSelectedRectId(null),
  });

  // Delete/Backspace removes the selected rect/annotation, Escape deselects
  // Ignore when focus is inside an input/textarea to avoid conflicting with text editing.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      const targetId = selectedRectId;
      if (targetId) {
        if (e.key === "Delete" || e.key === "Backspace") {
          useChatStore.getState().removeAnnotation(targetId);
          if (targetId === selectedRectId) removePendingRect(targetId);
        } else if (e.key === "Escape") {
          setSelectedRectId(null);
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedRectId, removePendingRect]);

  const panX = panOffset.x;
  const panY = panOffset.y;

  // Auto-select new rects when they appear (user-drawn, not loaded from disk).
  // Only switches to cursor mode when the user was actively drawing (currentTool === "rect"),
  // so loading a saved workspace doesn't override the user's tool choice.
  const prevAllRectsLenRef = useRef(allRects.length);
  useEffect(() => {
    if (allRects.length > prevAllRectsLenRef.current) {
      const newRect = allRects[allRects.length - 1];
      setSelectedRectId(newRect.id);
      // Only switch to cursor if user just created a rect — preserves pan tool selection
      if (currentTool === "rect") setCurrentTool("cursor");
    }
    prevAllRectsLenRef.current = allRects.length;
  }, [allRects, currentTool, setCurrentTool]);

  // Re-assert selection when tool changes — counters any unintended deselection.
  // Only re-asserts for annotation tools (pen, arrow, etc.) — rect/pan clear instead.
  const prevToolRef = useRef(currentTool);
  useEffect(() => {
    if (prevToolRef.current !== currentTool && selectedRectId) {
      if (currentTool !== "rect" && currentTool !== "pan") {
        setSelectedRectId(selectedRectId);
      }
    }
    prevToolRef.current = currentTool;
  }, [currentTool, selectedRectId]);

  // Clear selection when switching to rect-draw or pan mode
  useEffect(() => {
    if ((currentTool === "rect" || currentTool === "pan") && selectedRectId) {
      setSelectedRectId(null);
    }
  }, [currentTool, selectedRectId]);

  const redrawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = transformRef.current || { panX: 0, panY: 0, zoom: 1 };
      const so = scrollOffsetRef.current;
      const clipY = {
        minY: (-t.panY) / t.zoom + so.y,
        maxY: (-t.panY + canvas.height) / t.zoom + so.y,
      };
      ctx.save();
      // Manual pan/zoom transform from ref — canvas is at container level, not inside pan layer
      ctx.translate(t.panX, t.panY);
      ctx.scale(t.zoom, t.zoom);
      ctx.translate(-so.x, -so.y);
      annotations
        .filter(a => !a.parentId)
        .forEach((ann, i) => {
          drawAnnotation(ctx, ann, i + 1, clipY);
        });

      ctx.restore();
    } catch (err) {
      console.error("redrawAnnotations error:", err);
    }
  }, [annotations]);

  // Stable ref so imperative redraw from pan drag bypasses React scheduling
  const redrawRef = useRef<() => void>(() => {});
  redrawRef.current = redrawAnnotations;

  useLayoutEffect(() => {
    redrawAnnotations();
  }, [redrawAnnotations]);

  // Sync canvas size with container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ w: width, h: height });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Listen for iframe scroll events and update annotation positions
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "pagesprite-scroll") {
        const so = { x: event.data.scrollX, y: event.data.scrollY };
        scrollOffsetRef.current = so;
        setScrollOffset(so);
        redrawAnnotations();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [redrawAnnotations]);

  // Save on window close
  useEffect(() => {
    const onClose = () => saveWorkspaceNow();
    window.addEventListener("beforeunload", onClose);
    return () => window.removeEventListener("beforeunload", onClose);
  }, []);


  const codeToRender = useMemo(
    () => (generatedCode ? injectScrollScript(generatedCode) : BLANK_HTML),
    [generatedCode],
  );

  // Force iframe remount when generated code changes — browsers often fail to
  // refresh iframe content via srcDoc alone, especially with similar HTML.
  // Use a counter derived from the generatedCode value to avoid side effects
  // during render (useEffect-based approach can conflict with StrictMode double-mount).
  const iframeKey = useMemo(() => {
    if (!generatedCode) return 0;
    let hash = 0;
    for (let i = 0; i < Math.min(generatedCode.length, 200); i++) {
      hash = ((hash << 5) - hash) + generatedCode.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }, [generatedCode]);

  /**
   * Undo removes the last annotation and pushes it onto redoStackRef.
   * Redo pops from the stack and re-inserts via addAnnotation (which triggers re-render).
   *
   * We use useRef for the stack (no re-render on push/pop) and a Zustand subscription
   * to detect new annotations added by the user (not via redo). When a new annotation
   * arrives, the redo stack is cleared — standard undo/redo semantics where new actions
   * invalidate the redo history.
   *
   * isRedoingRef prevents the subscription from clearing the stack when handleRedo
   * calls addAnnotation. It's set true before the call, and the subscription resets it
   * after processing the length change.
   */
  const redoStackRef = useRef<Annotation[]>([]);
  const isRedoingRef = useRef(false);

  const handleUndo = useCallback(() => {
    const { annotations, removeAnnotation } = useChatStore.getState();
    if (annotations.length > 0) {
      const removed = annotations[annotations.length - 1];
      // Push all children first, then the annotation itself (parent last for redo ordering)
      if (removed.type === "rect") {
        const children = annotations.filter(a => a.parentId === removed.id);
        children.forEach(c => redoStackRef.current.push(c));
      }
      removeAnnotation(removed.id);
      if (removed.type === "rect") {
        removePendingRect(removed.id);
      }
      redoStackRef.current.push(removed);
    }
  }, [removePendingRect]);

  const handleRedo = useCallback(() => {
    const ann = redoStackRef.current.pop();
    if (ann) {
      isRedoingRef.current = true;
      useChatStore.getState().addAnnotation(ann);
    }
  }, []);

  // Clear redo stack when user draws a new annotation (but not during redo itself)
  useEffect(() => {
    const unsub = useChatStore.subscribe((state, prev) => {
      if (state.annotations.length > prev.annotations.length) {
        if (!isRedoingRef.current) {
          redoStackRef.current = [];
        }
        isRedoingRef.current = false;
      }
    });
    return unsub;
  }, []);

  const handleRegionGenerate = useCallback(
    async (annotationId: string, prompt: string, contentType: string) => {
      const store = useChatStore.getState();
      console.log(`[Workspace] handleRegionGenerate id=${annotationId.slice(0,8)} prompt="${prompt.slice(0,60)}..."`);
      // Only enforce API key for streaming agent — CLI agents work without it
      if (store.settings.agentType === "streaming" && !store.settings.apiKey) {
        console.warn("[Workspace] no API key configured");
        store.setSettingsOpen(true);
        return;
      }

      const ann = store.annotations.find((a) => a.id === annotationId);
      // Preserve the original title on subsequent revisions
      if (!ann?.generatedCode) {
        store.updateAnnotationText(annotationId, prompt);
      }
      store.addGeneratingAnnotationId(annotationId);

      const dims = ann?.boundingBox
        ? `${Math.round(ann.boundingBox.width)}x${Math.round(ann.boundingBox.height)}`
        : "0x0";

      console.log(`[Workspace] rect="${ann?.text?.slice(0,30)}" dims=${dims} hasGenerated=${!!ann?.generatedCode} agentType=${store.settings.agentType}`);

      const styleGuide =
        contentType === "phoneApp" ? " Design it as a mobile app interface (iOS/Android style) with native-feeling UI components, tab bars, and mobile navigation patterns." :
        contentType === "tabletApp" ? " Design it as a tablet app interface with split-view capable layouts, sidebar navigation, and larger touch targets." :
        contentType === "web" ? " Design it as a web page with standard web layout and styling." :
        " No specific style constraints — generate freely.";

      // Collect child annotations as visual context (skip empty ones with no note)
      const childAnnotations = store.annotations.filter(
        (a) => a.parentId === annotationId && a.text,
      );
      let childContext = "";
      if (childAnnotations.length > 0) {
        childContext =
          "\n\nThe user has drawn the following annotations ON this region:\n" +
          childAnnotations
            .map((a, i) => {
              const parts: string[] = [];
              parts.push(`Annotation ${i + 1}: type=${a.type}, color=${a.color}`);
              if (a.boundingBox && ann?.boundingBox) {
                parts.push(`  Position relative to region: (${Math.round(a.boundingBox.x - ann.boundingBox.x)}, ${Math.round(a.boundingBox.y - ann.boundingBox.y)})`);
                parts.push(`  Size: ${Math.round(a.boundingBox.width)}x${Math.round(a.boundingBox.height)}`);
              } else if (a.points.length > 0 && ann?.boundingBox) {
                const xs = a.points.map(p => p.x);
                const ys = a.points.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                const maxX = Math.max(...xs);
                const maxY = Math.max(...ys);
                parts.push(`  Position relative to region: (${Math.round(minX - ann.boundingBox.x)}, ${Math.round(minY - ann.boundingBox.y)})`);
                parts.push(`  Area: ${Math.round(maxX - minX)}x${Math.round(maxY - minY)}`);
                if (a.type === "arrow" && a.points.length >= 2) {
                  const p0 = a.points[0], p1 = a.points[1];
                  const dx = p1.x - p0.x, dy = p1.y - p0.y;
                  const len = Math.sqrt(dx * dx + dy * dy) || 1;
                  const tipX = p1.x + (dx / len) * 5;
                  const tipY = p1.y + (dy / len) * 5;
                  parts.push(`  Arrow pointing at (${Math.round(tipX - ann.boundingBox.x)}, ${Math.round(tipY - ann.boundingBox.y)})`);
                }
              }
              if (a.text) {
                parts.push(`  Note: "${a.text}"`);
              }
              return parts.join("\n");
            })
            .join("\n\n");
      }

      // Append rendered element position map when arrow annotations point at existing content
      if (ann?.generatedCode && childAnnotations.some(a => a.type === "arrow")) {
        const iframe = perRectIframeMapRef.current.get(annotationId);
        if (iframe?.contentDocument) {
          const elMap = buildElementPositionMap(iframe);
          if (elMap) {
            childContext += `\n\nThe following visible elements are rendered at these positions in this region (use the @(x,y) coordinates to identify which element the arrow is pointing at):\n${elMap}`;
          }
        }
      }

      // Delete child annotations — they've been consumed by this generation
      for (const child of childAnnotations) {
        store.removeAnnotation(child.id);
      }

      redoStackRef.current = [];

      const isRevision = !!ann?.generatedCode;
      const hasAnnotations = childAnnotations.length > 0;
      let fullPrompt: string;
      if (isRevision && hasAnnotations) {
        // Revision with annotation feedback — the user drew shapes on the rendered content
        fullPrompt = `Update the existing HTML in this region (${dims}px). The user has drawn annotations on the rendered output pointing at specific elements. Your task:

1. Read each annotation's note and @(x,y) position to identify which element to modify
2. Apply ONLY the changes requested — preserve the rest of the layout and styling exactly as-is
3. The coordinates in the annotations correspond to elements listed in the rendered element map below

Output only the content that fills the container (no html/head/body tags). Use relative units, flexbox/grid, avoid fixed pixel dimensions.${styleGuide}

User's request: ${prompt}${childContext}`;
      } else {
        fullPrompt = (isRevision ? `Revise` : `Generate`) + ` a self-contained HTML snippet that fills its container (${dims}px). The output must not include html/head/body tags — only content that fills the container. Use relative units (%, vw, vh), flexbox/grid, and avoid fixed pixel dimensions so the content adapts when the container is resized.${styleGuide} User's request: ${prompt}${childContext}`;
      }

      const revHistory = store.revisionHistory[annotationId];

      // Use agent manager
      console.log(`[PATH] >>> ${store.settings.agentType} [${annotationId.slice(0,8)}] dims=${dims}`);

      try {
        const html = await agentManager.generate(annotationId, fullPrompt, ann?.generatedCode, revHistory ?? undefined);
        console.log(`[PATH] >>> SUCCESS [${annotationId.slice(0,8)}] html=${html.length} chars`);
        const s = useChatStore.getState();
        s.setAnnotationCode(annotationId, html);
        s.addRevisionEntry(annotationId, prompt);
        s.setWorkspaceStatus("ready");
        s.removeGeneratingAnnotationId(annotationId);
      } catch (err) {
        console.error(`[PATH] >>> FAILED [${annotationId.slice(0,8)}]:`, err);
        const s = useChatStore.getState();
        if (!cancelledRef.current.has(annotationId)) {
          s.setWorkspaceStatus("error", String(err));
          s.removeGeneratingAnnotationId(annotationId);
        }
      }

      removePendingRect(annotationId);
      // Deselect so the prompt panel hides during generation
      setSelectedRectId(null);
    },
    [removePendingRect, agentManager],
  );

  const handleDeleteRect = useCallback((id: string) => {
    useChatStore.getState().removeAnnotation(id);
    setSelectedRectId((prev) => prev === id ? null : prev);
  }, []);

  const handleExportRect = useCallback((id: string) => {
    const ann = useChatStore.getState().annotations.find(a => a.id === id);
    if (!ann?.generatedCode) return;
    const html = ann.generatedCode;
    const full = injectFontAwesomeCSS(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`);
    const blob = new Blob([full], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagesprite-${id.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportImage = useCallback(async (id: string) => {
    const ann = useChatStore.getState().annotations.find(a => a.id === id);
    if (!ann?.generatedCode) return;
    const { toPng } = await import("html-to-image");
    const fullHtml = wrapRectContent(ann.generatedCode);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:0;top:0;width:800px;height:600px;border:none;background:#fff;pointer-events:none;z-index:-1";
    document.body.appendChild(iframe);
    iframe.srcdoc = fullHtml;
    try {
      await new Promise<void>((resolve) => { iframe.onload = () => resolve(); setTimeout(resolve, 3000); });
      const doc = iframe.contentDocument!;
      const body = doc.body;
      const psDiv = doc.getElementById('_ps');
      // Remove overflow so content isn't clipped, set height to auto so elements expand to actual size
      body.style.overflow = 'visible';
      body.style.height = 'auto';
      if (psDiv) { psDiv.style.overflow = 'visible'; psDiv.style.height = 'auto'; }
      // Wait for browser re-layout
      await new Promise((r) => setTimeout(r, 300));
      // Read actual rendered dimensions after re-layout
      const fullHeight = psDiv ? psDiv.offsetHeight : body.offsetHeight;
      const fullWidth = psDiv ? psDiv.offsetWidth : Math.max(body.offsetWidth, 800);
      // Resize iframe to contain full content (no clipping at browser level)
      iframe.style.width = fullWidth + 'px';
      iframe.style.height = fullHeight + 'px';
      await new Promise((r) => setTimeout(r, 200));
      const dataUrl = await toPng(body, { quality: 1, pixelRatio: 2, width: fullWidth, height: fullHeight });
      const link = document.createElement("a");
      link.download = `pagesprite-${id.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      document.body.removeChild(iframe);
    }
  }, []);

  const handleResetRect = useCallback(() => {
    const id = selectedRectId;
    if (!id) return;
    // Force iframe to remount with original generatedCode (reloads srcdoc from scratch)
    iframeResetVersions[id] = (iframeResetVersions[id] || 0) + 1;
    setSelectedRectId(null);
  }, [selectedRectId]);

  const handleRectActivate = useCallback((id: string) => {
    setCurrentTool("cursor");
    setSelectedRectId(id);
  }, [setCurrentTool]);

  const handleSettingsOpen = useCallback(() => {
    useChatStore.getState().setSettingsOpen(true);
  }, []);

  const handleReset = useCallback(() => {
    useChatStore.getState().reset();
    setCurrentTool("cursor"); // clears pending text/note via setTool wrapper
    clearPendingRects(); // also clear pending rects so stale RegionConfig doesn't render
    setSelectedRectId(null);
  }, [setCurrentTool, clearPendingRects]);

  const [isPanning, setIsPanning] = useState(false);

  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    if (currentTool !== "pan") return;

    const container = containerRef.current;
    if (!container) return;

    // Start panning
    setIsPanning(true);
    isPanningRef.current = true;
    lastPanPosRef.current = { x: e.clientX, y: e.clientY };
  }, [currentTool, panOffset, zoom, setCurrentTool]);

  const handlePanMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastPanPosRef.current.x;
    const dy = e.clientY - lastPanPosRef.current.y;
    lastPanPosRef.current = { x: e.clientX, y: e.clientY };
    const newPanX = panOffsetRef.current.x + dx;
    const newPanY = panOffsetRef.current.y + dy;
    panOffsetRef.current = { x: newPanX, y: newPanY };
    // Update transform ref and redraw canvas immediately — bypass React batching
    if (transformRef.current) {
      transformRef.current.panX = newPanX;
      transformRef.current.panY = newPanY;
    }
    redrawRef.current();
    // Also trigger React state for non-canvas elements
    setPanOffset({ x: newPanX, y: newPanY });
  }, []);

  const handlePanMouseUp = useCallback(() => {
    setIsPanning(false);
    isPanningRef.current = false;
  }, []);

  // Gesture zoom via Ctrl/Cmd+scroll, two-finger pan via plain wheel
  // Window capture phase catches events before iframes consume them.
  // preventDefault is only called for zoom (ctrlKey) — plain wheel scroll is
  // not prevented; overflow:auto on the container handles visible scroll naturally.
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      // When settings dialog is open, let the dialog handle scroll natively
      if (settingsOpen) return;

      if (e.ctrlKey || e.metaKey) {
        // Pinch zoom — prevent default to avoid browser zoom
        e.preventDefault();
        const delta = -e.deltaY * 0.002;
        const oldZoom = transformRef.current?.zoom ?? zoom;
        const next = +(oldZoom * (1 + delta)).toFixed(3);
        const clamped = Math.min(5, Math.max(0.1, next));
        // Keep point under mouse stationary
        const scale = clamped / oldZoom;
        const newPanX = e.clientX - scale * (e.clientX - panOffsetRef.current.x);
        const newPanY = e.clientY - scale * (e.clientY - panOffsetRef.current.y);
        panOffsetRef.current = { x: newPanX, y: newPanY };
        transformRef.current = { ...transformRef.current, panX: newPanX, panY: newPanY, zoom: clamped };
        redrawRef.current();
        setPanOffset({ x: newPanX, y: newPanY });
        setZoom(clamped);
        return;
      }
      // Two-finger trackpad pan
      const dx = e.deltaX;
      const dy = e.deltaY;
      if (dx === 0 && dy === 0) return;
      const newPanX = panOffsetRef.current.x - dx;
      const newPanY = panOffsetRef.current.y - dy;
      panOffsetRef.current = { x: newPanX, y: newPanY };
      if (transformRef.current) {
        transformRef.current.panX = newPanX;
        transformRef.current.panY = newPanY;
      }
      redrawRef.current();
      setPanOffset({ x: newPanX, y: newPanY });
    };
    window.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", handler, { capture: true });
  }, [settingsOpen]);

  const hasApiKey = !!settings.apiKey;
  const hasContent = !!generatedCode || annotations.length > 0;

  // Determine cursor for the workspace container — children inherit it unless they have
  // their own explicit cursor (e.g. buttons keep `cursor: pointer` from App.css).
  const containerCursor =
    currentTool === "pan" ? (isPanning ? "grabbing" : "grab") :
    ["rect", "pen", "arrow", "rectangle", "ellipse", "highlight"].includes(currentTool) ? "crosshair" :
    currentTool === "text" ? "text" :
    "";

  // CSS cursor inherits through the container to children — buttons keep
  // their explicit cursor: pointer from App.css.

  return (
    <div style={{ position: "relative", height: "100%", background: "var(--bg-secondary)" }}>
      {/* Floating glassmorphism toolbar */}
      <div
        data-rect-control="true"
        style={{
          position: "absolute",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: Z_INDEX.FLOATING_TOOLBAR,
          background: "color-mix(in srgb, var(--bg-tertiary) 80%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
          borderRadius: 20,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <Toolbar
          floating
          currentTool={currentTool}
          onToolChange={setCurrentTool}
          onUndo={handleUndo}
          onRedo={handleRedo}
          hasUndo={annotations.length > 0}
          hasRedo={redoStackRef.current.length > 0}
          onSettingsOpen={handleSettingsOpen}
          hasApiKey={hasApiKey}
          onReset={handleReset}
          hasContent={hasContent}
        />
      </div>

      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          userSelect: "none",
          WebkitUserSelect: "none",
          backgroundColor: "var(--bg-secondary)",
          backgroundImage: "radial-gradient(circle, var(--dot-color) 1px, transparent 1px)",
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${panX}px ${panY}px`,
          cursor: containerCursor || undefined,
        }}
      >
        <>
          {/* Pan layer with iframe — always rendered */}

            {/* Pan layer: moves and scales with pan offset + zoom */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transformOrigin: "0 0",
                pointerEvents: "none",
              }}
            >
              {/* Full-page preview (global generation) */}
              <iframe
                key={iframeKey}
                ref={iframeRef}
                srcDoc={codeToRender}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  pointerEvents: currentTool === "cursor" ? "auto" : "none",
                }}
                title="Preview"
              />
            </div>

            {/* Loading overlay for rects being generated — at container level to avoid pan-layer stacking context */}
            {allOverlayRects.map((ann) => {
              const exiting = !generatingAnnotationIds.includes(ann.id);
              const b = ann.boundingBox!;
              const zi = allRectZIndex.get(ann.id) ?? 10;
              const vp = {
                x: Math.floor((b.x - scrollOffset.x) * zoom + panX) - 1,
                y: Math.floor((b.y - scrollOffset.y) * zoom + panY) - 1,
                width: Math.ceil(b.width * zoom) + 2,
                height: Math.ceil(b.height * zoom) + 2,
              };
              return (
                <div
                  key={`loading-${ann.id}`}
                  style={{
                    position: "absolute",
                    left: vp.x,
                    top: vp.y,
                    width: vp.width,
                    height: vp.height,
                    background: "var(--bg-surface)",
                    borderRadius: 4,
                    overflow: "hidden",
                    zIndex: zi + 1,
                    opacity: exiting ? 0 : 1,
                    transition: "opacity 0.6s ease",
                    animation: exiting ? "none" : "loading-fade-in 0.2s ease-out",
                  }}
                >
                  {/* Grainient gradient background */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "var(--bg-surface)",
                    }}
                  >
                    <Grainient
                      color1={settings.theme === "dark" ? "#4a0000" : "#f4c8c8"}
                      color2={settings.theme === "dark" ? "#002f06" : "#f2f5d2"}
                      color3={settings.theme === "dark" ? "#000659" : "#bad6ef"}
                      timeSpeed={3.15}
                      colorBalance={0}
                      warpStrength={1.55}
                      warpFrequency={6}
                      warpSpeed={2.5}
                      warpAmplitude={50}
                      blendAngle={0}
                      blendSoftness={0.05}
                      rotationAmount={500}
                      noiseScale={2}
                      grainAmount={0.1}
                      grainScale={2}
                      grainAnimated={false}
                      contrast={1.5}
                      gamma={1}
                      saturation={1}
                      centerX={0}
                      centerY={0}
                      zoom={1}
                    />
                  </div>

                  {/* Center text */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: "#888",
                        fontWeight: 700,
                        letterSpacing: "0.4px",
                        animation: "text-breath 1.8s ease-in-out infinite",
                      }}
                    >
                      Generating&hellip;
                    </span>
                  </div>

                </div>
              );
            })}

            {/* Canvas overlay — at container level, manual transforms in drawing code */}
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: currentTool === "cursor" || currentTool === "pan" ? Z_INDEX.CANVAS_DEFAULT : Z_INDEX.CANVAS_DRAWING,
                pointerEvents: currentTool === "pan" || currentTool === "cursor" ? "none" : "auto",
                cursor:
                  currentTool === "pen" ? "crosshair" :
                  currentTool === "rect" ? "crosshair" :
                  currentTool === "arrow" ? "crosshair" :
                  currentTool === "text" ? "text" :
                  currentTool === "highlight" ? "crosshair" :
                  currentTool === "rectangle" ? "crosshair" :
                  currentTool === "ellipse" ? "crosshair" :
                  currentTool === "cursor" ? "default" :
                  "default",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            {/* Pan drag overlay — also captures wheel events for two-finger trackpad */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: currentTool === "pan" ? 495 : Z_INDEX.CANVAS_DEFAULT,
                pointerEvents: (currentTool === "pan" || currentTool === "cursor") ? "auto" : "none",
                cursor:
                  currentTool === "pan" ? (isPanning ? "grabbing" : "grab") :
                  currentTool === "cursor" ? "default" :
                  "default",
              }}
              onMouseDown={handlePanMouseDown}
              onMouseMove={handlePanMouseMove}
              onMouseUp={handlePanMouseUp}
              onMouseLeave={handlePanMouseUp}
            />

            {/* Popups — above pan overlay, positions adjusted for pan offset */}
            {pendingText && (() => {
              const vp = docToCanvas(
                pendingText.x, pendingText.y,
                transformRef.current!,
                scrollOffsetRef.current,
              );
              return (
                <TextInputPopup
                  x={vp.x}
                  y={vp.y}
                  onSubmit={handleTextSubmit}
                  onCancel={handleTextCancel}
                />
              );
            })()}
            {pendingNote && (
              <AnnotationNotePopup
                x={pendingNote.x}
                y={pendingNote.y}
                onSubmit={handleNoteSubmit}
                onCancel={handleNoteCancel}
              />
            )}
            {pendingRects.map((pr) => (
              <RegionConfig
                key={pr.annotationId}
                annotationId={pr.annotationId}
                isSelected={pr.annotationId === selectedRectId}
                zoom={zoom}
                panX={panX}
                panY={panY}
                scrollOffset={scrollOffsetRef.current}
                onGenerate={handleRegionGenerate}
                onCancel={(id) => {
                  const isGenerating = useChatStore.getState().generatingAnnotationIds.includes(id);
                  if (isGenerating) {
                    // Busy generating — cancel without deleting the annotation
                    handleCancelGeneration(id);
                    removePendingRect(id);
                  } else {
                    handleRectCancel(id);
                  }
                }}
              />
            ))}

            {/* RegionConfig for selected rects (persists after generation) */}
            {(() => {
              if (!selectedRectId) return null;
              if (pendingRects.some(p => p.annotationId === selectedRectId)) return null;
              const ann = allRects.find(a => a.id === selectedRectId);
              if (!ann) return null;
              return (
                <RegionConfig
                  key={ann.id}
                  annotationId={ann.id}
                  isSelected={true}
                  zoom={zoom}
                  panX={panX}
                  panY={panY}
                  scrollOffset={scrollOffsetRef.current}
                  onGenerate={handleRegionGenerate}
                  onCancel={handleCancelGeneration}
                />
              );
            })()}

            {/* Per-rect iframes at container level (for ALL rects — blank white bg when no code) */}
            {allRects.map((ann) => {
              const b = ann.boundingBox!;
              const zi = allRectZIndex.get(ann.id) ?? 10;
              const vp = {
                x: (b.x - scrollOffset.x) * zoom + panX,
                y: (b.y - scrollOffset.y) * zoom + panY,
                width: b.width * zoom,
                height: b.height * zoom,
              };
              return (
                <PerRectFrame
                  key={ann.id + (ann.generatedCode?.slice(0, 40) || '') + '-v' + (iframeResetVersions[ann.id] || 0)}
                  annotation={ann}
                  currentTool={currentTool}
                  iframeMap={perRectIframeMapRef.current}
                  zIndex={zi}
                  vp={vp}
                  zoom={zoom}
                />
              );
            })}

            {/* Per-rect annotation canvases — sit above their own rect iframe but below the next rect */}
            {allRects.map((ann) => {
              const zi = allRectZIndex.get(ann.id) ?? 10;
              return (
                <RectAnnotationCanvas
                  key={`ann-canvas-${ann.id}`}
                  annotationId={ann.id}
                  zoom={zoom}
                  panX={panX}
                  panY={panY}
                  scrollOffset={scrollOffset}
                  zIndex={zi + 1}
                />
              );
            })}

            {/* Title bars for ALL rects (pending / generating / with code) — always movable */}
            {allRects.map((ann) => {
              const zi = allRectZIndex.get(ann.id) ?? 10;
              return (
              <RectTitleBar
                key={`tb-${ann.id}`}
                annotationId={ann.id}
                zoom={zoom}
                panX={panX}
                panY={panY}
                scrollOffset={scrollOffsetRef.current}
                onSelect={setSelectedRectId}
                onDirectResize={updateRectIframe}
                onSetIFramePE={setRectIframePE}
                onActivate={handleRectActivate}
                onSnapChange={setSnapLines}
                zIndex={zi + 2}
                currentTool={currentTool}
              />
              );
            })}

            {/* Selection UI — handles + badge + deselect, only in cursor mode */}
            {currentTool === "cursor" && (
              <>
                {selectedRectId && allRects.find(a => a.id === selectedRectId) && (
                  <RectControls
                    key={`ctrl-${selectedRectId}`}
                    annotationId={selectedRectId}
                    zoom={zoom}
                    panX={panX}
                    panY={panY}
                    scrollOffset={scrollOffsetRef.current}
                    onDirectResize={updateRectIframe}
                    onSetIFramePE={setRectIframePE}
                    onSnapChange={setSnapLines}
                  />
                )}

              </>
            )}

            {/* Deselect guard — only in cursor mode to allow drawing in other tools */}
            {selectedRectId && currentTool === "cursor" && (
              <BackgroundDeselect onDeselect={() => setSelectedRectId(null)} />
            )}

            <ZoomControls zoom={zoom} onZoomChange={setZoom} onResetView={() => { setPanOffset({ x: 0, y: 0 }); setZoom(0.6); }} />

            {/* Snap alignment guides */}
            {snapLines.map((line, i) => {
              if (line.orientation === 'v') {
                const left = (line.pos - scrollOffset.x) * zoom + panX;
                return (
                  <div key={`snap-${i}`} style={{
                    position: "absolute",
                    left,
                    top: 0,
                    width: 1,
                    height: "100%",
                    background: "rgba(79, 140, 255, 0.8)",
                    pointerEvents: "none",
                    zIndex: Z_INDEX.SNAP_LINES,
                    boxShadow: "0 0 4px rgba(79,140,255,0.4)",
                  }} />
                );
              }
              const top = (line.pos - scrollOffset.y) * zoom + panY;
              return (
                <div key={`snap-${i}`} style={{
                  position: "absolute",
                  left: 0,
                  top,
                  width: "100%",
                  height: 1,
                  background: "rgba(79, 140, 255, 0.8)",
                  pointerEvents: "none",
                  zIndex: Z_INDEX.SNAP_LINES,
                  boxShadow: "0 0 4px rgba(79,140,255,0.4)",
                }} />
              );
            })}

            <LeftAnnotationToolbar
              selectedRectId={selectedRectId}
              allRects={allRects}
              zoom={zoom}
              panX={panX}
              panY={panY}
              scrollOffset={scrollOffset}
              currentTool={currentTool}
              onToolChange={setCurrentTool}
              currentColor={currentColor}
              onColorChange={setCurrentColor}
              onResetRect={handleResetRect}
              onExportRect={handleExportRect}
              onExportImage={handleExportImage}
              onDeleteRect={handleDeleteRect}
            />

          </>
      </div>

      {/* Canvas transition animation - OUTSIDE containerRef to avoid iframe compositing layer overlap (WebKit/Safari quirk) */}
      {showLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: Z_INDEX.WORKSPACE_OVERLAY,
            background: "rgba(79, 140, 255, 0.08)",
            pointerEvents: "none",
          }}
        >
          {/* Pulsing border glow */}
          <div style={{ position: "absolute", inset: 0, border: "2px solid transparent", animation: "canvas-glow 2s ease-in-out infinite" }} />
          {/* Corner brackets */}
          <div style={{ position: "absolute", top: 12, left: 12, width: 24, height: 24, borderTop: "2px solid rgba(79,140,255,0.35)", borderLeft: "2px solid rgba(79,140,255,0.35)" }} />
          <div style={{ position: "absolute", top: 12, right: 12, width: 24, height: 24, borderTop: "2px solid rgba(79,140,255,0.35)", borderRight: "2px solid rgba(79,140,255,0.35)" }} />
          <div style={{ position: "absolute", bottom: 12, left: 12, width: 24, height: 24, borderBottom: "2px solid rgba(79,140,255,0.35)", borderLeft: "2px solid rgba(79,140,255,0.35)" }} />
          <div style={{ position: "absolute", bottom: 12, right: 12, width: 24, height: 24, borderBottom: "2px solid rgba(79,140,255,0.35)", borderRight: "2px solid rgba(79,140,255,0.35)" }} />
          {/* Shimmer sweep line */}
          <div style={{ position: "absolute", top: 0, left: 0, width: "60%", height: "3px", background: "linear-gradient(90deg, transparent, rgba(79, 140, 255, 0.6), transparent)", animation: "shimmer 2.5s ease-in-out infinite" }} />
          {/* Centered loading indicator */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 28px", background: "rgba(255, 255, 255, 0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(79, 140, 255, 0.25)", borderRadius: 16, boxShadow: "0 8px 32px rgba(79,140,255,0.2)" }}>
            <div style={{ width: 32, height: 32, border: "3px solid rgba(79,140,255,0.15)", borderTopColor: "#4f8cff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ color: "#4f8cff", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{globalPhase.title}</div>
          </div>
          {/* Bottom status bar */}
          <div style={{ position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "rgba(255, 255, 255, 0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(79, 140, 255, 0.25)", borderRadius: 20, boxShadow: "0 4px 20px rgba(79,140,255,0.12)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4f8cff", animation: "fade-pulse 1.2s ease-in-out infinite" }} />
            <span style={{ color: "#555", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>{globalPhase.subtitle}</span>
            {streamContent && <span style={{ fontSize: 11, color: "#999", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{streamContent.slice(0, 40)}</span>}
          </div>
        </div>
      )}

      {workspaceStatus === "error" && (
        <div
          style={{
            position: "absolute",
            right: 16,
            bottom: 60,
            zIndex: Z_INDEX.ERROR_TOAST,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            background: "color-mix(in srgb, var(--bg-secondary) 85%, transparent)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
            borderRadius: 10,
            padding: "12px 14px",
            maxWidth: 340,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            userSelect: "text",
          }}
        >
          <TriangleAlert size={16} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, wordBreak: "break-word" }}>
            {workspaceError}
          </div>
          <button
            onClick={() => setWorkspaceStatus("empty")}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1,
            }}
            title={t("close")}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default function Workspace() {
  return (
    <ErrorBoundary>
      <WorkspaceContent />
    </ErrorBoundary>
  );
}
