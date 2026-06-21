import type { ToolType } from "../types";
import { MousePointer2, Hand, SquarePlus, Undo2, Redo2, Trash2, Settings, TriangleAlert } from "lucide-react";
import { useT } from "../i18n";

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
  const t = useT();
  return (
    <div
      style={{
        height: "var(--toolbar-height)",
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: "0 10px",
        background: floating ? "transparent" : "color-mix(in srgb, var(--bg-tertiary) 80%, transparent)",
        borderBottom: floating ? "none" : "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {/* Cursor */}
      <button
        onClick={() => onToolChange("cursor")}
        title={t("cursor")}
        style={{
          width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 6,
          background: currentTool === "cursor" ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "transparent",
          color: currentTool === "cursor" ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        <MousePointer2 size={15} />
      </button>
      {/* Pan */}
      <button
        onClick={() => onToolChange("pan")}
        title={t("pan")}
        style={{
          width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 6,
          background: currentTool === "pan" ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "transparent",
          color: currentTool === "pan" ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        <Hand size={15} />
      </button>
      <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
      {/* Rect */}
      <button
        onClick={() => onToolChange("rect")}
        title={t("createRect")}
        style={{
          width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 6,
          background: currentTool === "rect" ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "transparent",
          color: currentTool === "rect" ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        <SquarePlus size={15} />
      </button>
      <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
      <div style={{ flex: 1 }} />

      <button
        onClick={onUndo}
        disabled={!hasUndo}
        title={t("undo")}
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 6,
          background: "transparent",
          color: hasUndo ? "var(--text-secondary)" : "var(--text-muted)",
          opacity: hasUndo ? 1 : 0.4,
        }}
      >
        <Undo2 size={16} />
      </button>

      <button
        onClick={onRedo}
        disabled={!hasRedo}
        title={t("redo")}
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 6,
          background: "transparent",
          color: hasRedo ? "var(--text-secondary)" : "var(--text-muted)",
          opacity: hasRedo ? 1 : 0.4,
        }}
      >
        <Redo2 size={16} />
      </button>

      <button
        onClick={onReset}
        disabled={!hasContent}
        title={t("clearWorkspace")}
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 6,
          background: "transparent",
          color: hasContent ? "var(--text-secondary)" : "var(--text-muted)",
          opacity: hasContent ? 1 : 0.4,
        }}
      >
        <Trash2 size={15} />
      </button>

      <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
      <button
        onClick={onSettingsOpen}
        title={t("apiSettings")}
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 6,
          background: "transparent",
          color: hasApiKey ? "var(--text-secondary)" : "var(--warning)",
        }}
      >
        {hasApiKey ? <Settings size={15} /> : <TriangleAlert size={15} />}
      </button>
    </div>
  );
}
