import { useRef, useCallback, useState } from "react";
import { useChatStore } from "../stores/chatStore";
import { generateId } from "../utils/code";
import type { Annotation, ToolType, Point } from "../types";

interface PendingText {
  x: number;
  y: number;
}

interface PendingAnnotationNote {
  annotationId: string;
  x: number;
  y: number;
}

interface PendingRect {
  annotationId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewTransform {
  panX: number;
  panY: number;
  zoom: number;
}

function canvasToDoc(
  cx: number, cy: number,
  t: ViewTransform,
  scroll: { x: number; y: number },
): Point {
  return {
    x: (cx - t.panX) / t.zoom + scroll.x,
    y: (cy - t.panY) / t.zoom + scroll.y,
  };
}

export function docToCanvas(
  dx: number, dy: number,
  t: ViewTransform,
  scroll: { x: number; y: number },
): Point {
  return {
    x: (dx - scroll.x) * t.zoom + t.panX,
    y: (dy - scroll.y) * t.zoom + t.panY,
  };
}

/**
 * Find which rect annotation a given non-rect annotation falls into.
 * Iterates in reverse (topmost rect wins for overlapping). Returns the rect's annotation ID or undefined.
 */
function findParentRect(
  annotation: Annotation,
  allAnnotations: Annotation[],
): string | undefined {
  if (annotation.type === "rect") return undefined;
  const rects = allAnnotations.filter(
    (a) => a.type === "rect" && a.boundingBox && a.id !== annotation.id,
  );
  // Find hit point (center of bbox, or average of points)
  let hitX: number, hitY: number;
  if (annotation.boundingBox) {
    hitX = annotation.boundingBox.x + annotation.boundingBox.width / 2;
    hitY = annotation.boundingBox.y + annotation.boundingBox.height / 2;
  } else if (annotation.points.length > 0) {
    hitX = annotation.points.reduce((s, p) => s + p.x, 0) / annotation.points.length;
    hitY = annotation.points.reduce((s, p) => s + p.y, 0) / annotation.points.length;
  } else {
    return undefined;
  }
  // Reverse order: last-drawn (topmost) rect wins
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i].boundingBox!;
    if (hitX >= r.x && hitX <= r.x + r.width && hitY >= r.y && hitY <= r.y + r.height) {
      return rects[i].id;
    }
  }
  return undefined;
}

export function useAnnotations(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  scrollOffsetRef: React.RefObject<{ x: number; y: number } | null>,
  transformRef: React.RefObject<ViewTransform | null>,
  callbacks?: { onDeselectRect?: () => void },
) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const [currentTool, setCurrentTool] = useState<ToolType>("pan");
  const [currentColor, setCurrentColor] = useState("#ff0000");
  const [pendingText, setPendingText] = useState<PendingText | null>(null);
  const [pendingNote, setPendingNote] = useState<PendingAnnotationNote | null>(null);
  const [pendingRects, setPendingRects] = useState<PendingRect[]>([]);
  const currentPathRef = useRef<Point[]>([]);
  const startPointRef = useRef<Point | null>(null);
  const isDrawingRef = useRef(false);

  /** Check whether a document-coordinate point falls inside any rect annotation. */
  function isInsideAnyRect(docPos: Point): boolean {
    const rects = useChatStore.getState().annotations
      .filter(a => a.type === "rect" && a.boundingBox);
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i].boundingBox!;
      if (docPos.x >= r.x && docPos.x <= r.x + r.width && docPos.y >= r.y && docPos.y <= r.y + r.height) {
        return true;
      }
    }
    return false;
  }

  /** Clamp a document-coordinate point to the bounds of the rect it falls inside.
   *  This ensures annotation strokes never stray outside their parent rect. */
  function clampToRect(docPos: Point): Point {
    if (currentTool === "pan" || currentTool === "cursor" || currentTool === "rect") return docPos;
    const rects = useChatStore.getState().annotations
      .filter(a => a.type === "rect" && a.boundingBox);
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i].boundingBox!;
      if (docPos.x >= r.x && docPos.x <= r.x + r.width && docPos.y >= r.y && docPos.y <= r.y + r.height) {
        return {
          x: Math.max(r.x, Math.min(r.x + r.width, docPos.x)),
          y: Math.max(r.y, Math.min(r.y + r.height, docPos.y)),
        };
      }
    }
    return docPos;
  }

  const getCanvasPos = useCallback(
    (e: React.MouseEvent | MouseEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [canvasRef],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (currentTool === "pan") return;
      if (pendingText || pendingNote) return;

      const pos = getCanvasPos(e);

      const t = transformRef.current || { panX: 0, panY: 0, zoom: 1 };
      const scroll = scrollOffsetRef.current || { x: 0, y: 0 };

      if (currentTool === "text") {
        const rawPos = canvasToDoc(pos.x, pos.y, t, scroll);
        const docPos = clampToRect(rawPos);
        if (!isInsideAnyRect(rawPos)) {
          callbacksRef.current?.onDeselectRect?.();
          setCurrentTool("cursor");
          return;
        }
        setPendingText({ x: docPos.x, y: docPos.y });
        return;
      }
      const rawPos = canvasToDoc(pos.x, pos.y, t, scroll);
      const docPos = clampToRect(rawPos);

      // Annotation tools (pen, arrow, rectangle, ellipse, highlight, text) may only
      // start inside a rect — reject draws that begin outside.
      // Clicking empty space also deselects and switches to cursor.
      if (currentTool !== "cursor" && currentTool !== "rect" && !isInsideAnyRect(rawPos)) {
        callbacksRef.current?.onDeselectRect?.();
        setCurrentTool("cursor");
        return;
      }

      isDrawingRef.current = true;
      startPointRef.current = docPos;
      currentPathRef.current = [docPos];
    },
    [currentTool, getCanvasPos, pendingText, pendingNote, transformRef, scrollOffsetRef, setCurrentTool],
  );

  const handleTextSubmit = useCallback(
    (text: string) => {
      if (!pendingText) return;
      if (!text.trim()) {
        setPendingText(null);
        return;
      }

      const annotation: Annotation = {
        id: generateId(),
        type: "text",
        points: [{ x: pendingText.x, y: pendingText.y }],
        boundingBox: {
          x: pendingText.x,
          y: pendingText.y,
          width: text.length * 8,
          height: 20,
        },
        color: currentColor,
        text: text.trim(),
        createdAt: Date.now(),
      };

      // Auto-assign parent rect for text annotations
      const allAnns = useChatStore.getState().annotations;
      const parentId = findParentRect(annotation, allAnns);
      if (parentId) {
        annotation.parentId = parentId;
      }
      useChatStore.getState().addAnnotation(annotation);
      setPendingText(null);
    },
    [pendingText, currentColor],
  );

  const handleTextCancel = useCallback(() => {
    setPendingText(null);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingRef.current) return;
      const pos = getCanvasPos(e);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const t = transformRef.current || { panX: 0, panY: 0, zoom: 1 };
      const scroll = scrollOffsetRef.current || { x: 0, y: 0 };

      // Clear and redraw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw existing annotations in document coords, shifted by transform.
      // Only draw parentless ones — child annotations are drawn by per-rect canvases.
      ctx.save();
      ctx.translate(t.panX, t.panY);
      ctx.scale(t.zoom, t.zoom);
      ctx.translate(-scroll.x, -scroll.y);
      const annotations = useChatStore.getState().annotations;
      const clipY = {
        minY: (-t.panY) / t.zoom + scroll.y,
        maxY: (-t.panY + canvas.height) / t.zoom + scroll.y,
      };
      annotations
        .filter(a => !a.parentId)
        .forEach((ann, i) => {
          drawAnnotation(ctx, ann, i + 1, clipY);
        });
      ctx.restore();

      // Convert current mouse pos to document coords
      const rawDocPos = canvasToDoc(pos.x, pos.y, t, scroll);
      const docPos = clampToRect(rawDocPos);
      currentPathRef.current.push(docPos);

      // Draw current stroke (in document coords, transformed)
      ctx.save();
      ctx.translate(t.panX, t.panY);
      ctx.scale(t.zoom, t.zoom);
      ctx.translate(-scroll.x, -scroll.y);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (currentTool === "pen" || currentTool === "highlight") {
        ctx.globalAlpha = currentTool === "highlight" ? 0.3 : 1;
        ctx.beginPath();
        const pts = currentPathRef.current;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (currentTool === "rect") {
        const start = startPointRef.current!;
        const rw = docPos.x - start.x;
        const rh = docPos.y - start.y;
        const drawX = Math.min(start.x, docPos.x);
        const drawY = Math.min(start.y, docPos.y);
        const drawW = Math.abs(rw);
        const drawH = Math.abs(rh);
        // Skip preview drawing for accidental clicks (too small to create a rect)
        if (drawW >= 3 && drawH >= 3) {
          ctx.strokeStyle = "#4f8cff";
          ctx.lineWidth = 2;
          ctx.strokeRect(drawX, drawY, drawW, drawH);

          // Dynamic size label
          const label = `${Math.round(drawW)} × ${Math.round(drawH)}`;
          ctx.fillStyle = "#4f8cff";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(label, drawX + drawW / 2, drawY - 4);
        }
      } else if (currentTool === "rectangle" || currentTool === "ellipse") {
        const start = startPointRef.current!;
        const rw = docPos.x - start.x;
        const rh = docPos.y - start.y;
        const drawX = Math.min(start.x, docPos.x);
        const drawY = Math.min(start.y, docPos.y);
        const drawW = Math.abs(rw);
        const drawH = Math.abs(rh);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2;
        if (currentTool === "rectangle") {
          ctx.strokeRect(drawX, drawY, drawW, drawH);
        } else {
          ctx.beginPath();
          ctx.ellipse(drawX + drawW / 2, drawY + drawH / 2, drawW / 2, drawH / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Dynamic size label
        const label = `${Math.round(drawW)} × ${Math.round(drawH)}`;
        ctx.fillStyle = currentColor;
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, drawX + drawW / 2, drawY - 4);
      } else if (currentTool === "arrow") {
        const start = startPointRef.current!;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(docPos.x, docPos.y);
        ctx.stroke();
        const angle = Math.atan2(docPos.y - start.y, docPos.x - start.x);
        ctx.beginPath();
        ctx.moveTo(docPos.x, docPos.y);
        ctx.lineTo(docPos.x - 12 * Math.cos(angle - 0.4), docPos.y - 12 * Math.sin(angle - 0.4));
        ctx.moveTo(docPos.x, docPos.y);
        ctx.lineTo(docPos.x - 12 * Math.cos(angle + 0.4), docPos.y - 12 * Math.sin(angle + 0.4));
        ctx.stroke();
      }
      ctx.restore();
    },
    [isDrawingRef, currentTool, currentColor, canvasRef, transformRef, scrollOffsetRef, getCanvasPos],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingRef.current || currentTool === "pan" || currentTool === "text") return;
      isDrawingRef.current = false;

      const pos = getCanvasPos(e);
      const t = transformRef.current || { panX: 0, panY: 0, zoom: 1 };
      const scroll = scrollOffsetRef.current || { x: 0, y: 0 };

      const rawDocPos = canvasToDoc(pos.x, pos.y, t, scroll);
      const docPos = clampToRect(rawDocPos);
      const docStart = startPointRef.current!;
      const docPath = currentPathRef.current;

      // Skip accidental clicks
      const isAccidental = (() => {
        switch (currentTool) {
          case "pen":
          case "highlight":
            return docPath.length < 2;
          case "rect":
          case "rectangle":
          case "ellipse": {
            const w = Math.abs(docPos.x - docStart.x);
            const h = Math.abs(docPos.y - docStart.y);
            return w < 3 && h < 3;
          }
          case "arrow": {
            const dx = docPos.x - docStart.x;
            const dy = docPos.y - docStart.y;
            return Math.hypot(dx, dy) < 5;
          }
          default:
            return false;
        }
      })();

      if (isAccidental) {
        currentPathRef.current = [];
        startPointRef.current = null;
        isDrawingRef.current = false;
        return;
      }

      let annotation: Annotation;

      switch (currentTool) {
        case "pen":
        case "highlight":
          annotation = {
            id: generateId(),
            type: currentTool,
            points: docPath,
            color: currentColor,
            createdAt: Date.now(),
          };
          break;
        case "rect": {
          let rawW = Math.abs(docPos.x - docStart.x);
          let rawH = Math.abs(docPos.y - docStart.y);
          // Size snap to existing rects during creation
          const existingBounds = useChatStore.getState().annotations
            .filter(a => a.type === "rect" && a.boundingBox)
            .map(a => a.boundingBox!);
          for (const eb of existingBounds) {
            if (Math.abs(rawW - eb.width) < 6) rawW = eb.width;
            if (Math.abs(rawH - eb.height) < 6) rawH = eb.height;
          }
          annotation = {
            id: generateId(),
            type: "rect",
            points: [docStart, docPos],
            boundingBox: {
              x: Math.min(docStart.x, docPos.x),
              y: Math.min(docStart.y, docPos.y),
              width: Math.max(100, rawW),
              height: Math.max(100, rawH),
            },
            color: currentColor,
            createdAt: Date.now(),
          };
          break;
        }
        case "arrow":
          annotation = {
            id: generateId(),
            type: "arrow",
            points: [docStart, docPos],
            color: currentColor,
            createdAt: Date.now(),
          };
          break;
        case "rectangle":
        case "ellipse": {
          const rawW = Math.abs(docPos.x - docStart.x);
          const rawH = Math.abs(docPos.y - docStart.y);
          annotation = {
            id: generateId(),
            type: currentTool,
            points: [docStart, docPos],
            boundingBox: {
              x: Math.min(docStart.x, docPos.x),
              y: Math.min(docStart.y, docPos.y),
              width: rawW,
              height: rawH,
            },
            color: currentColor,
            createdAt: Date.now(),
          };
          break;
        }
        default:
          return;
      }

      // Auto-assign parent rect if annotation falls within one
      const allAnns = useChatStore.getState().annotations;
      const parentId = findParentRect(annotation, allAnns);
      if (parentId) {
        annotation.parentId = parentId;
      }
      try {
        useChatStore.getState().addAnnotation(annotation);
      } catch (err) {
        console.error("Failed to add annotation:", err);
        currentPathRef.current = [];
        startPointRef.current = null;
        isDrawingRef.current = false;
        return;
      }
      currentPathRef.current = [];
      startPointRef.current = null;

      if (annotation.type === "rect" && annotation.boundingBox) {
        const bb = annotation.boundingBox;
        // Pre-create work directory + index.html for CLI agents
        window.electronAPI.agent.prepareWorkDir(annotation.id, null)
          .catch((e) => console.warn("[prepare_work_dir]", e));
        setPendingRects((prev) => [
          ...prev,
          {
            annotationId: annotation.id,
            x: bb.x,
            y: bb.y,
            width: bb.width,
            height: bb.height,
          },
        ]);
      } else {
        // Compute note popup position in viewport (canvas) coords.
        // If the popup would extend beyond the bottom of the viewport,
        // position it above the annotation instead.
        const POPUP_H = 130;
        let noteX: number;
        let noteY: number;
        if (annotation.boundingBox) {
          const topLeft = docToCanvas(
            annotation.boundingBox.x, annotation.boundingBox.y, t, scroll,
          );
          noteX = topLeft.x + annotation.boundingBox.width * t.zoom / 2 - 100;
          const below = topLeft.y + annotation.boundingBox.height * t.zoom + 10;
          const above = topLeft.y - POPUP_H - 5;
          noteY = (below + POPUP_H > window.innerHeight && above > 0) ? above : below;
        } else if (annotation.points.length > 0) {
          const lastPt = docToCanvas(
            annotation.points[annotation.points.length - 1].x,
            annotation.points[annotation.points.length - 1].y,
            t, scroll,
          );
          noteX = lastPt.x + 10;
          const below = lastPt.y + 10;
          const firstPt = docToCanvas(
            annotation.points[0].x, annotation.points[0].y, t, scroll,
          );
          const above = firstPt.y - POPUP_H - 5;
          noteY = (below + POPUP_H > window.innerHeight && above > 0) ? above : below;
        } else {
          noteX = 20;
          noteY = 20;
        }
        setPendingNote({
          annotationId: annotation.id,
          x: Math.max(0, noteX),
          y: Math.max(0, noteY),
        });
      }
    },
    [isDrawingRef, currentTool, currentColor, getCanvasPos, transformRef, scrollOffsetRef],
  );

  const handleNoteSubmit = useCallback(
    (text: string) => {
      if (!pendingNote) return;
      if (text.trim()) {
        useChatStore.getState().updateAnnotationText(
          pendingNote.annotationId,
          text.trim(),
        );
      }
      setPendingNote(null);
    },
    [pendingNote],
  );

  const handleNoteCancel = useCallback(() => {
    if (pendingNote) {
      useChatStore.getState().removeAnnotation(pendingNote.annotationId);
    }
    setPendingNote(null);
  }, [pendingNote]);

  const dismissNote = useCallback(() => {
    setPendingNote(null);
  }, []);

  const setTool = useCallback((tool: ToolType) => {
    console.log("[cursor] setTool", tool, "at", new Date().toISOString().slice(11, 23));
    setCurrentTool(tool);
    setPendingText(null);
    setPendingNote(null);
  }, []);

  const removePendingRect = useCallback((id: string) => {
    setPendingRects((prev) => prev.filter((p) => p.annotationId !== id));
  }, []);

  const clearPendingRects = useCallback(() => {
    setPendingRects([]);
  }, []);

  const handleRectCancel = useCallback((annotationId: string) => {
    useChatStore.getState().removeAnnotation(annotationId);
    setPendingRects((prev) => prev.filter((p) => p.annotationId !== annotationId));
  }, []);

  return {
    currentTool,
    setCurrentTool: setTool,
    currentColor,
    setCurrentColor,
    pendingText,
    pendingNote,
    pendingRects,
    handleTextSubmit,
    handleTextCancel,
    handleNoteSubmit,
    handleNoteCancel,
    dismissNote,
    removePendingRect,
    clearPendingRects,
    handleRectCancel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isDrawing: isDrawingRef.current,
  };
}

export function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  index?: number,
  clipY?: { minY: number; maxY: number },
) {
  try {
  ctx.save();
  ctx.strokeStyle = ann.color;
  ctx.fillStyle = ann.color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (ann.type) {
    case "pen":
      if (ann.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      for (let i = 1; i < ann.points.length; i++) {
        ctx.lineTo(ann.points[i].x, ann.points[i].y);
      }
      ctx.stroke();
      break;
    case "highlight":
      if (ann.points.length < 2) break;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      for (let i = 1; i < ann.points.length; i++) {
        ctx.lineTo(ann.points[i].x, ann.points[i].y);
      }
      ctx.stroke();
      break;
    case "rect":
      // Rect visuals are handled by HTML overlays (RegionConfig / RectControls / iframe)
      break;
    case "rectangle":
      if (!ann.boundingBox) break;
      ctx.strokeRect(ann.boundingBox.x, ann.boundingBox.y, ann.boundingBox.width, ann.boundingBox.height);
      break;
    case "ellipse":
      if (!ann.boundingBox) break;
      ctx.beginPath();
      ctx.ellipse(
        ann.boundingBox.x + ann.boundingBox.width / 2,
        ann.boundingBox.y + ann.boundingBox.height / 2,
        ann.boundingBox.width / 2,
        ann.boundingBox.height / 2,
        0, 0, Math.PI * 2,
      );
      ctx.stroke();
      break;
    case "arrow": {
      if (ann.points.length < 2) break;
      const [s, e_pos] = [ann.points[0], ann.points[1]];
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e_pos.x, e_pos.y);
      ctx.stroke();
      const angle = Math.atan2(e_pos.y - s.y, e_pos.x - s.x);
      ctx.beginPath();
      ctx.moveTo(e_pos.x, e_pos.y);
      ctx.lineTo(e_pos.x - 12 * Math.cos(angle - 0.4), e_pos.y - 12 * Math.sin(angle - 0.4));
      ctx.moveTo(e_pos.x, e_pos.y);
      ctx.lineTo(e_pos.x - 12 * Math.cos(angle + 0.4), e_pos.y - 12 * Math.sin(angle + 0.4));
      ctx.stroke();
      break;
    }
    case "text":
      if (!ann.text || ann.points.length < 1) break;
      ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
      const metrics = ctx.measureText(ann.text);
      const tx = ann.points[0].x;
      const ty = ann.points[0].y + 15;
      const tpad = 10;
      const tw = metrics.width + tpad * 2;
      const th = 20 + tpad * 2;
      const tr = 8;

      ctx.shadowColor = "rgba(0,0,0,0.12)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      roundRect(ctx, tx - tpad, ty - 15 - tpad, tw, th, tr);
      ctx.fill();

      ctx.shadowColor = "transparent";
      // Subtle inner glow for glass depth
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      roundRect(ctx, tx - tpad + 2, ty - 15 - tpad + 2, tw - 4, th - 4, tr - 2);
      ctx.stroke();

      ctx.fillStyle = "#333";
      ctx.fillText(ann.text, tx, ty);
      break;
  }

  // Draw modification note badge if present (for non-text, non-rect annotations)
  if (ann.text && ann.type !== "text" && ann.type !== "rect") {
    drawNoteBadge(ctx, ann, clipY);
  }

  // Draw number badge on top (after shape, so not obscured; skip rect type)
  if (index !== undefined && ann.type !== "rect") {
    drawNumberBadge(ctx, ann, index);
  }

  ctx.restore();
  } catch (err) {
    console.error("drawAnnotation error:", err, ann.id);
  }
}

function drawNumberBadge(ctx: CanvasRenderingContext2D, ann: Annotation, index: number) {
  ctx.save();
  let nx: number;
  let ny: number;
  if (ann.boundingBox) {
    nx = ann.boundingBox.x;
    ny = ann.boundingBox.y;
  } else if (ann.points.length > 0) {
    nx = ann.points[0].x;
    ny = ann.points[0].y;
  } else {
    nx = 20;
    ny = 20;
  }

  const r = 12;
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(nx, ny, r, 0, Math.PI * 2);
  ctx.fillStyle = ann.color;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(index), nx, ny + 1);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawNoteBadge(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  clipY?: { minY: number; maxY: number },
) {
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  const m = ctx.measureText(ann.text!);
  const pad = 10;
  const bw = m.width + pad * 2;
  const bh = 20 + pad * 2;
  const br = 8;

  // Compute both candidate positions (above vs below)
  let bxAbove: number, bxBelow: number;
  let byAbove: number, byBelow: number;
  if (ann.boundingBox) {
    const cx = ann.boundingBox.x + ann.boundingBox.width / 2 - bw / 2;
    bxAbove = cx;
    bxBelow = cx;
    byAbove = ann.boundingBox.y - 12 - bh;
    byBelow = ann.boundingBox.y + ann.boundingBox.height + 12;
  } else if (ann.points.length > 0) {
    const first = ann.points[0];
    bxAbove = first.x;
    byAbove = first.y - 12 - bh;
    const last = ann.points[ann.points.length - 1];
    bxBelow = last.x + 12;
    byBelow = last.y + 12;
  } else {
    bxAbove = 20; bxBelow = 20;
    byAbove = 20; byBelow = 20;
  }

  // Choose position: prefer above if it fits within clip bounds, otherwise below
  let bx: number, by: number;
  if (clipY) {
    const aboveFits = byAbove >= clipY.minY && byAbove + bh <= clipY.maxY;
    const belowFits = byBelow >= clipY.minY && byBelow + bh <= clipY.maxY;
    bx = aboveFits ? bxAbove : belowFits ? bxBelow : bxAbove;
    by = aboveFits ? byAbove : belowFits ? byBelow : byAbove;
  } else {
    bx = bxAbove;
    by = byAbove;
  }

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  roundRect(ctx, bx, by, bw, bh, br);
  ctx.fill();

  ctx.shadowColor = "transparent";
  // Subtle inner glow for glass depth
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  roundRect(ctx, bx + 2, by + 2, bw - 4, bh - 4, br - 2);
  ctx.stroke();

  ctx.fillStyle = "#333";
  ctx.textBaseline = "middle";
  ctx.fillText(ann.text!, bx + pad, by + pad + 10);
  ctx.restore();
}
