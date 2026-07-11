// Panel registry — the single source of truth for what a dockable tool panel is
// (System 3, see docs/plan-photoshop-panels.md). A Panel is an id + metadata + a
// render() that fills a host element and may return a disposer. The layout tree
// (layout-tree.ts) references panels only by id; dock-render.ts looks each id up
// here to produce its body. Per-panel agents register the real tools through
// registerPanel(); see the registration seam in window-panels.ts.

export interface Panel {
  id: string;
  title: string;
  /** Inline SVG markup for the tab / flyout icon. */
  icon?: string;
  minW?: number;
  minH?: number;
  /**
   * Fill `host` with the panel body. May return a disposer that dock-render runs
   * when the panel is torn down (re-render, tab switch, workspace change).
   */
  render(host: HTMLElement): void | (() => void);
}

const registry = new Map<string, Panel>();

/** Register (or replace) a panel definition. Idempotent by id. */
export function registerPanel(def: Panel): void {
  registry.set(def.id, def);
}

/** Look up a panel by id, or undefined if it has not been registered yet. */
export function getPanel(id: string): Panel | undefined {
  return registry.get(id);
}

/** True when a panel id has a registered definition. */
export function hasPanel(id: string): boolean {
  return registry.has(id);
}

/** Every registered panel, in registration order. */
export function allPanels(): Panel[] {
  return Array.from(registry.values());
}
