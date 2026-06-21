import { useState, useRef, useEffect } from "react";
import { Square, Circle, Pen, ArrowUpRight, Download, Trash2, RotateCcw, FileText, ImageIcon } from "lucide-react";
import { Z_INDEX } from "../utils/zIndex";
import type { Annotation, ToolType } from "../types";

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
        background: "rgba(240, 240, 240, 0.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}
    >
      {/* Rectangle */}
      <ToolButton active={currentTool === "rectangle"} onClick={() => onToolChange("rectangle")} title="矩形">
        <Square size={15} />
      </ToolButton>
      {/* Ellipse */}
      <ToolButton active={currentTool === "ellipse"} onClick={() => onToolChange("ellipse")} title="圆形">
        <Circle size={15} />
      </ToolButton>
      {/* Pen */}
      <ToolButton active={currentTool === "pen"} onClick={() => onToolChange("pen")} title="画笔">
        <Pen size={15} />
      </ToolButton>
      {/* Arrow */}
      <ToolButton active={currentTool === "arrow"} onClick={() => onToolChange("arrow")} title="箭头">
        <ArrowUpRight size={15} />
      </ToolButton>

      <div style={{ width: "80%", height: 1, background: "#d4d4d4", margin: "3px 0" }} />

      {/* Color picker */}
      <div ref={leftColorRef} style={{ position: "relative" }}>
        <button
          data-rect-control="true"
          onClick={() => setLeftColorOpen((v) => !v)}
          onMouseDown={(e) => e.nativeEvent.stopPropagation()}
          title="颜色"
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
              background: "rgba(240, 240, 240, 0.85)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(0,0,0,0.08)",
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

      <div style={{ width: "80%", height: 1, background: "#d4d4d4", margin: "3px 0" }} />

      {/* Reset */}
      <ToolButton onClick={onResetRect} title="重置">
        <RotateCcw size={15} />
      </ToolButton>

      {/* Export */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => { if (!selAnn.generatedCode) return; setExportOpen((v) => !v); }}
          title="导出"
          style={{
            width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", borderRadius: 6,
            background: "transparent",
            color: selAnn.generatedCode ? "#555" : "#bbb",
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
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(0,0,0,0.08)",
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
                下载 HTML
              </ExportButton>
              <ExportButton onClick={() => onExportImage(selAnn.id)} borderTop>
                <ImageIcon size={13} />
                下载图片
              </ExportButton>
            </div>
          </>
        )}
      </div>

      {/* Delete */}
      <ToolButton onClick={() => onDeleteRect(selectedRectId)} title="删除" color="#ef4444">
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
        background: active ? "#d0d0d0" : "transparent",
        color: color ?? (active ? "#222" : "#666"),
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
        borderTop: borderTop ? "1px solid rgba(0,0,0,0.06)" : "none",
        background: hover ? "rgba(0,0,0,0.04)" : "transparent",
        color: "#444",
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
