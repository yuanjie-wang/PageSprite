import { Z_INDEX } from "../utils/zIndex";

export default function ZoomControls({
  zoom,
  onZoomChange,
}: {
  zoom: number;
  onZoomChange: (update: (prev: number) => number) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        zIndex: Z_INDEX.ZOOM_CONTROLS,
        display: "flex",
        alignItems: "center",
        gap: 2,
        background: "rgba(240, 240, 240, 0.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: 12,
        padding: 4,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}
    >
      <button
        onClick={() => onZoomChange((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))}
        title="缩小"
        style={{
          width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 4,
          background: "transparent",
          color: "#555", fontSize: 16, fontWeight: 600, cursor: "pointer",
        }}
      >
        −
      </button>
      <span
        style={{
          minWidth: 44, textAlign: "center", fontSize: 12, color: "#555",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => onZoomChange((z) => Math.min(5, +(z + 0.1).toFixed(2)))}
        title="放大"
        style={{
          width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 4,
          background: "transparent",
          color: "#555", fontSize: 16, fontWeight: 600, cursor: "pointer",
        }}
      >
        +
      </button>
      <div style={{ width: 1, height: 16, background: "#d4d4d4", margin: "0 4px" }} />
      <button
        onClick={() => onZoomChange(() => 1)}
        title="重置缩放"
        style={{
          height: 28, padding: "0 8px",
          border: "none", borderRadius: 4,
          background: "transparent",
          color: "#555", fontSize: 11, cursor: "pointer",
        }}
      >
        1:1
      </button>
    </div>
  );
}
