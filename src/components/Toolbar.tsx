import type { ToolType } from "../types";
import { MousePointer2, Hand, SquarePlus, Undo2, Redo2, Trash2, Settings, TriangleAlert } from "lucide-react";

interface Props {
  currentTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  hasUndo: boolean;
  hasRedo: boolean;
  onSettingsOpen: () => void;
  hasApiKey: boolean;
  onReset: () => void;
  hasContent: boolean;
  floating?: boolean;
}

export default function Toolbar({
  currentTool,
  onToolChange,
  onUndo,
  onRedo,
  hasUndo,
  hasRedo,
  onSettingsOpen,
  hasApiKey,
  onReset,
  hasContent,
  floating,
}: Props) {
  return (
    <div
      style={{
        height: "var(--toolbar-height)",
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: "0 10px",
        background: floating ? "transparent" : "#f0f0f0",
        borderBottom: floating ? "none" : "1px solid #d4d4d4",
        flexShrink: 0,
      }}
    >
      {/* Cursor */}
      <button
        onClick={() => onToolChange("cursor")}
        title="光标"
        style={{
          width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 6,
          background: currentTool === "cursor" ? "#d0d0d0" : "transparent",
          color: currentTool === "cursor" ? "#222" : "#666",
        }}
      >
        <MousePointer2 size={15} />
      </button>
      {/* Pan */}
      <button
        onClick={() => onToolChange("pan")}
        title="拖动"
        style={{
          width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 6,
          background: currentTool === "pan" ? "#d0d0d0" : "transparent",
          color: currentTool === "pan" ? "#222" : "#666",
        }}
      >
        <Hand size={15} />
      </button>
      <div style={{ width: 1, height: 16, background: "#d4d4d4", margin: "0 4px" }} />
      {/* Rect */}
      <button
        onClick={() => onToolChange("rect")}
        title="画布创建"
        style={{
          width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 6,
          background: currentTool === "rect" ? "#d0d0d0" : "transparent",
          color: currentTool === "rect" ? "#222" : "#666",
        }}
      >
        <SquarePlus size={15} />
      </button>
      <div style={{ width: 1, height: 16, background: "#d4d4d4", margin: "0 4px" }} />
      <div style={{ flex: 1 }} />

      <button
        onClick={onUndo}
        disabled={!hasUndo}
        title="撤销"
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 6,
          background: "transparent",
          color: hasUndo ? "#555" : "#bbb",
          opacity: hasUndo ? 1 : 0.4,
        }}
      >
        <Undo2 size={16} />
      </button>

      <button
        onClick={onRedo}
        disabled={!hasRedo}
        title="恢复"
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 6,
          background: "transparent",
          color: hasRedo ? "#555" : "#bbb",
          opacity: hasRedo ? 1 : 0.4,
        }}
      >
        <Redo2 size={16} />
      </button>

      <button
        onClick={onReset}
        disabled={!hasContent}
        title="清空工作区"
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 6,
          background: "transparent",
          color: hasContent ? "#555" : "#bbb",
          opacity: hasContent ? 1 : 0.4,
        }}
      >
        <Trash2 size={15} />
      </button>

      <div style={{ width: 1, height: 16, background: "#d4d4d4", margin: "0 4px" }} />
      <button
        onClick={onSettingsOpen}
        title="API 设置"
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 6,
          background: "transparent",
          color: hasApiKey ? "#666" : "#e67e22",
        }}
      >
        {hasApiKey ? <Settings size={15} /> : <TriangleAlert size={15} />}
      </button>
    </div>
  );
}
