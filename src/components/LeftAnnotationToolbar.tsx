import { useState, useRef, useEffect } from "react";
import { Square, Circle, Pen, ArrowUpRight, Download, Trash2, RotateCcw, FileText, ImageIcon } from "lucide-react";
import { Z_INDEX } from "../utils/zIndex";
import type { Annotation, ToolType } from "../types";
import { useT } from "../i18n";

const LEFT_COLORS = ["#ff0000", "#ff8800", "#ffdd00", "#00cc44", "#0088ff", "#8800ff", "#000000"];

export default function LeftAnnotationToolbar({
  selectedRectId,
  allRects,
  zoom,
  panX,
  panY,
  scrollOffset,
  currentTool,
  onToolChange,
  currentColor,
  onColorChange,
  onResetRect,
  onExportRect,
  onExportImage,
  onDeleteRect,
}: {
  selectedRectId: string | null;
  allRects: Annotation[];
  zoom: number;
  panX: number;
  panY: number;
  scrollOffset: { x: number; y: number };
  currentTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  onResetRect: () => void;
  onExportRect: (id: string) => void;
  onExportImage: (id: string) => void;
  onDeleteRect: (id: string) => void;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [leftColorOpen, setLeftColorOpen] = useState(false);
  const leftColorRef = useRef<HTMLDivElement>(null);

  // Click-outside handler for color picker
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (leftColorRef.current && !leftColorRef.current.contains(e.target as Node)) {
        setLeftColorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close export popup on selection change
  useEffect(() => {
    setExportOpen(false);
    setLeftColorOpen(false);
  }, [selectedRectId]);

  const t = useT();
  if (!selectedRectId) return null;
  const selAnn = allRects.find((a) => a.id === selectedRectId);
  if (!selAnn?.boundingBox) return null;

  const b = selAnn.boundingBox;
  const vpX = (b.x - scrollOffset.x) * zoom + panX;
  const vpY = (b.y - scrollOffset.y) * zoom + panY;
  const vpCenterY = vpY + b.height * zoom / 2;

  return (
    <div
      data-rect-control="true"
      style={{
        position: "absolute",
        left: vpX - 50,
        top: vpCenterY,
        transform: "translateY(-50%)",
        zIndex: Z_INDEX.LEFT_TOOLBAR,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: 6,
        background: "color-mix(in srgb, var(--bg-tertiary) 80%, transparent)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}
    >
      {/* Rectangle */}
      <ToolButton active={currentTool === "rectangle"} onClick={() => onToolChange("rectangle")} title={t("rectangle")}>
        <Square size={15} />
      </ToolButton>
      {/* Ellipse */}
      <ToolButton active={currentTool === "ellipse"} onClick={() => onToolChange("ellipse")} title={t("ellipse")}>
        <Circle size={15} />
      </ToolButton>
      {/* Pen */}
      <ToolButton active={currentTool === "pen"} onClick={() => onToolChange("pen")} title={t("pen")}>
        <Pen size={15} />
      </ToolButton>
      {/* Arrow */}
      <ToolButton active={currentTool === "arrow"} onClick={() => onToolChange("arrow")} title={t("arrow")}>
        <ArrowUpRight size={15} />
      </ToolButton>

      <div style={{ width: "80%", height: 1, background: "var(--border)", margin: "3px 0" }} />

      {/* Color picker */}
      <div ref={leftColorRef} style={{ position: "relative" }}>
        <button
          data-rect-control="true"
          onClick={() => setLeftColorOpen((v) => !v)}
          onMouseDown={(e) => e.nativeEvent.stopPropagation()}
          title={t("color")}
          style={{
            width: 16, height: 16, minWidth: 0, padding: 0,
            marginTop: 2, marginBottom: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid rgba(0,0,0,0.15)",
            borderRadius: "50%",
            background: currentColor,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        />
        {leftColorOpen && (
          <div
            style={{
              position: "absolute",
              left: "100%", top: "50%",
              transform: "translateY(-50%)",
              marginLeft: 8,
              display: "flex", gap: 3, padding: 6,
              background: "color-mix(in srgb, var(--bg-secondary) 95%, transparent)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              zIndex: 20,
            }}
          >
            {LEFT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => { onColorChange(color); setLeftColorOpen(false); }}
                title={color}
                style={{
                  width: 16, height: 16, borderRadius: "50%",
                  border: currentColor === color ? "1.5px solid #333" : "1.5px solid transparent",
                  background: color, cursor: "pointer",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ width: "80%", height: 1, background: "var(--border)", margin: "3px 0" }} />

      {/* Reset */}
      <ToolButton onClick={onResetRect} title={t("reset")}>
        <RotateCcw size={15} />
      </ToolButton>

      {/* Export */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => { if (!selAnn.generatedCode) return; setExportOpen((v) => !v); }}
          title={t("export")}
          style={{
            width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", borderRadius: 6,
            background: "transparent",
            color: selAnn.generatedCode ? "var(--text-secondary)" : "var(--text-muted)",
            opacity: selAnn.generatedCode ? 1 : 0.4,
            cursor: selAnn.generatedCode ? "pointer" : "default",
          }}
        >
          <Download size={15} />
        </button>
        {exportOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 19 }} onClick={() => setExportOpen(false)} />
            <div
              style={{
                position: "absolute",
                left: "50%", bottom: "100%",
                transform: "translateX(-50%)",
                marginBottom: 6,
                background: "color-mix(in srgb, var(--bg-secondary) 98%, transparent)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                zIndex: 20,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <ExportButton onClick={() => onExportRect(selAnn.id)}>
                <FileText size={13} />
                {t("downloadHtml")}
              </ExportButton>
              <ExportButton onClick={() => onExportImage(selAnn.id)} borderTop>
                <ImageIcon size={13} />
                {t("downloadImage")}
              </ExportButton>
            </div>
          </>
        )}
      </div>

      {/* Delete */}
      <ToolButton onClick={() => onDeleteRect(selectedRectId)} title={t("delete")}>
        <Trash2 size={15} />
      </ToolButton>
    </div>
  );
}

/** Small icon button used in the toolbar */
function ToolButton({ active, onClick, title, children, color }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode; color?: string;
}) {
  return (
    <button
      data-rect-control="true"
      onClick={onClick}
      title={title}
      style={{
        width: 30, height: 30,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "none", borderRadius: 6,
        background: active ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "transparent",
        color: color ?? (active ? "var(--accent)" : "var(--text-secondary)"),
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** Export option button inside the popup */
function ExportButton({ onClick, children, borderTop }: {
  onClick: () => void; children: React.ReactNode; borderTop?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px",
        border: "none",
        borderTop: borderTop ? "1px solid var(--border)" : "none",
        background: hover ? "color-mix(in srgb, var(--bg-tertiary) 50%, transparent)" : "transparent",
        color: "var(--text-primary)",
        fontSize: 12,
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
