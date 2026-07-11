// The persisted WorkspaceLayout tree (System 3, see docs/plan-photoshop-panels.md).
// The tree — DockArea(left|right) → DockColumn(width) → PanelStack(proportional
// heights) → PanelGroup(tabs) → Panel-id, plus FloatingGroup[] — is the model the
// dock renderer draws from. It persists under a self-contained localStorage key so
// the panel workspace can be saved without extending the typed Settings shape; a
// layout carried on settings (via a renderer-side cast) is accepted as a fallback
// source. Loading is tolerant: any parse / shape problem falls back to defaultLayout().

import type { DockArea, DockColumn, PanelGroup, Settings, WorkspaceLayout } from '@shared/types';

/** localStorage key holding the current (auto-saved) workspace layout. */
export const WORKSPACE_STORAGE_KEY = 'griffinMenuStudio.workspace';

/** A renderer-only view of Settings that may carry a mirrored layout copy. */
type SettingsWithWorkspace = Settings & { workspace?: unknown };

function group(panels: string[], activeTab: string = panels[0] ?? ''): PanelGroup {
  return { panels: [...panels], activeTab, collapsed: false };
}

/**
 * The default Editor arrangement. It reproduces today's tool set: the tool panels
 * that float today become a single right-hand dock column, stacked as Colour &
 * Spacing (with Typography + Page as tabs) · Dietary Key · Arrange. The left dock
 * is empty for now — the Menus rail and Edit-Menu column stay in the centre until
 * per-panel agents promote them into Panels. dock-render silently skips any panel
 * id that is not yet registered, so the view stays close to today until the real
 * panels are plugged into the registration seam.
 */
export function defaultLayout(): WorkspaceLayout {
  return {
    left: { columns: [] },
    right: {
      columns: [
        {
          widthPct: 22,
          stack: {
            cells: [
              { heightPct: 42, group: group(['colour', 'typography', 'page'], 'colour') },
              { heightPct: 32, group: group(['dietkey']) },
              { heightPct: 26, group: group(['arrange']) },
            ],
          },
        },
      ],
    },
    floating: [],
  };
}

/* ============================ tolerant validation ============================ */

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isPanelGroup(v: unknown): v is PanelGroup {
  if (!isObj(v)) return false;
  if (!Array.isArray(v.panels) || !v.panels.every((p) => typeof p === 'string')) return false;
  return typeof v.activeTab === 'string';
}

function isDockArea(v: unknown): v is DockArea {
  if (!isObj(v) || !Array.isArray(v.columns)) return false;
  return v.columns.every((col) => {
    if (!isObj(col) || typeof col.widthPct !== 'number') return false;
    if (!isObj(col.stack) || !Array.isArray(col.stack.cells)) return false;
    return col.stack.cells.every(
      (cell) => isObj(cell) && typeof cell.heightPct === 'number' && isPanelGroup(cell.group),
    );
  });
}

function isLayout(v: unknown): v is WorkspaceLayout {
  return isObj(v) && isDockArea(v.left) && isDockArea(v.right) && Array.isArray(v.floating);
}

/* ============================== normalisation =============================== */

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
}

function normaliseGroup(g: PanelGroup): PanelGroup {
  const panels = g.panels.filter((p) => typeof p === 'string');
  const activeTab = panels.includes(g.activeTab) ? g.activeTab : (panels[0] ?? '');
  return { panels, activeTab, collapsed: !!g.collapsed };
}

function normaliseArea(area: DockArea): DockArea {
  return {
    columns: area.columns.map((col: DockColumn) => ({
      widthPct: clamp(col.widthPct, 8, 60),
      stack: {
        cells: col.stack.cells.map((cell) => ({
          heightPct: clamp(cell.heightPct, 5, 100),
          group: normaliseGroup(cell.group),
        })),
      },
    })),
  };
}

function normalise(layout: WorkspaceLayout): WorkspaceLayout {
  return {
    left: normaliseArea(layout.left),
    right: normaliseArea(layout.right),
    floating: Array.isArray(layout.floating) ? layout.floating : [],
  };
}

/* ============================== load / save ================================ */

/**
 * Load the persisted workspace layout. Primary source is localStorage; a layout
 * mirrored onto settings (renderer-side cast) is a fallback. Any parse or shape
 * problem falls back to a fresh defaultLayout(), so a corrupt store never breaks
 * the editor.
 */
export function loadLayout(settings?: Settings): WorkspaceLayout {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isLayout(parsed)) return normalise(parsed);
    }
  } catch {
    /* fall through to settings / default */
  }
  const carried = (settings as SettingsWithWorkspace | undefined)?.workspace;
  if (isLayout(carried)) return normalise(carried);
  return defaultLayout();
}

/**
 * Persist the layout to localStorage. When `settings` is supplied it is also
 * mirrored onto a renderer-side cast field so callers that flush the Settings
 * blob keep a copy — without types.ts changing (no persist() call happens here).
 */
export function saveLayout(layout: WorkspaceLayout, settings?: Settings): void {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* storage unavailable / full — non-critical, layout stays in memory */
  }
  if (settings) (settings as SettingsWithWorkspace).workspace = layout;
}

/** Reset to the default layout, persist it, and return the fresh tree. */
export function resetLayout(settings?: Settings): WorkspaceLayout {
  const fresh = defaultLayout();
  saveLayout(fresh, settings);
  return fresh;
}
