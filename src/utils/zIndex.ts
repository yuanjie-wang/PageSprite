/**
 * Centralized z-index scale for PageSprite.
 *
 * Gaps between layers allow room for future elements without renumbering everything.
 * Per-rect elements (iframes, canvases, title bars) use a dynamic base of 60 + i*2.
 */
export const Z_INDEX = {
  /** Region white background — renders behind the per-rect iframe */
  REGION_BG: 50,

  /** Dynamic base for per-rect elements — iframes, canvases, title bars stack at base + i*2 */
  PER_RECT_BASE: 60,

  /** Canvas in cursor/pan mode — low so rect UI sits above it */
  CANVAS_DEFAULT: 1,

  /** Canvas in drawing modes — above per-rect iframes (60+) but below UI */
  CANVAS_DRAWING: 490,

  /** Rect selection: outline, size badge, 8 resize handles */
  RECT_OUTLINE: 200,
  RECT_BADGE: 201,
  RECT_HANDLES: 202,

  /** Left annotation toolbar — attached to the selected rect's left edge */
  LEFT_TOOLBAR: 500,

  /** RegionConfig panel — prompt input + generate button */
  REGION_PANEL: 510,

  /** Snap alignment guides */
  SNAP_LINES: 999,

  /** Workspace-level UI: loading overlay, floating toolbar, zoom, error */
  WORKSPACE_OVERLAY: 500,
  FLOATING_TOOLBAR: 1000,
  ZOOM_CONTROLS: 1000,
  ERROR_TOAST: 1000,

  /** Transient popups — text input, annotation notes */
  POPUPS: 10000,

  /** Settings dialog backdrop */
  SETTINGS_OVERLAY: 1000,
} as const;
