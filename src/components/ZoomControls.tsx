import { Locate } from "lucide-react";
import { Z_INDEX } from "../utils/zIndex";
import { useT } from "../i18n";

export default function ZoomControls({
  zoom,
  onZoomChange,
  onResetView,
}: {
  zoom: number;
  onZoomChange: (update: (prev: number) => number) => void;
  onResetView?: () => void;
}) {
  const t = useT();
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: Z_INDEX.ZOOM_CONTROLS,
        display: "flex",
        alignItems: "center",
        gap: 2,
        background: "color-mix(in srgb, var(--bg-tertiary) 80%, transparent)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
        borderRadius: 12,
        padding: 4,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}
    >
      <button
        onClick={() => onZoomChange((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))}
        title={t("zoomOut")}
        style={{
          width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 4,
          background: "transparent",
          color: "var(--text-secondary)", fontSize: 16, fontWeight: 600, cursor: "pointer",
        }}
      >
        −
      </button>
      <span
        style={{
          minWidth: 44, textAlign: "center", fontSize: 12, color: "var(--text-secondary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => onZoomChange((z) => Math.min(5, +(z + 0.1).toFixed(2)))}
        title={t("zoomIn")}
        style={{
          width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 4,
          background: "transparent",
          color: "var(--text-secondary)", fontSize: 16, fontWeight: 600, cursor: "pointer",
        }}
      >
        +
      </button>
      <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
      <button
        onClick={() => onZoomChange(() => 1)}
        title={t("resetZoom")}
        style={{
          height: 28, padding: "0 8px",
          border: "none", borderRadius: 4,
          background: "transparent",
          color: "var(--text-secondary)", fontSize: 11, cursor: "pointer",
        }}
      >
        1:1
      </button>
      <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
      <button
        onClick={onResetView}
        title={t("resetView")}
        style={{
          height: 28, padding: "0 6px",
          border: "none", borderRadius: 4,
          background: "transparent",
          color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
          display: "flex", alignItems: "center",
        }}
      >
        <Locate size={13} />
      </button>
    </div>
  );
}
