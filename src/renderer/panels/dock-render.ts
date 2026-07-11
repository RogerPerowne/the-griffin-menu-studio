// Renders the left + right DockAreas of a WorkspaceLayout into the shell
// (System 3, see docs/plan-photoshop-panels.md). It draws columns (with draggable
// width dividers reusing the editor/rail resize-and-clamp pattern), vertical
// PanelStacks (with proportional height dividers) and PanelGroups as tab strips.
// Each visible panel's body is produced by getPanel(id).render(host). The document
// area (the existing editor/preview grid) stays in the centre and flex-fills; the
// dock hosts are `auto` grid tracks that collapse to zero when empty.
//
// This phase renders the tree, resizable dividers and tab switching only — no
// drag-and-drop between groups yet (that lands in a later phase).

import type { DockArea, DockColumn, PanelGroup, WorkspaceLayout } from '@shared/types';
import { escapeHtml } from '../util/escape';
import { getPanel } from './registry';

type Side = 'left' | 'right';

export interface DockHosts {
  left: HTMLElement;
  right: HTMLElement;
}

export interface DockRenderOptions {
  /** Persist the mutated layout after a tab switch or divider drag. */
  onChange?: (layout: WorkspaceLayout) => void;
  /** Fired after a divider drag ends so the document page can re-fit. */
  onResize?: () => void;
}

const MIN_COL_PX = 200;
const MIN_CELL_PX = 90;
const MAX_COL_FRACTION = 0.5; // a dock column may take at most half the window

/* -------- drag-and-drop tuning (kept generous + snappy on purpose) -------- */
// A fat window-edge band that docks a panel to that whole side — a huge target
// so a user never has to find a thin sliver. The in-group zones below are just
// as generous (a 40%-wide central "add as tab" box; the rest split into quarter
// bands). There is NO dwell timer: the live placeholder and drop resolve on the
// very frame the pointer moves, so docking feels immediate.
const EDGE_DOCK_PX = 96;    // window-edge band width for side-docking
const DRAG_THRESHOLD = 5;   // px of pointer travel before a tab-drag begins
const NEW_COL_PCT = 24;     // width % for a column created by a drop
const SIDE_BAND_PX = 240;   // visual width of the side-dock placeholder

type Cell = DockColumn['stack']['cells'][number];

/** Model context attached to every rendered .dock-group, so a drop can resolve
 *  which side / column / cell / group the pointer is over. */
interface GroupCtx {
  side: Side;
  col: DockColumn;
  cell: Cell;
  group: PanelGroup;
}
const groupModel = new WeakMap<HTMLElement, GroupCtx>();

/** Where a dragged panel would land, computed live from the pointer. */
type DropTarget =
  | { kind: 'tab'; el: HTMLElement; ctx: GroupCtx }
  | { kind: 'cell'; el: HTMLElement; ctx: GroupCtx; after: boolean }
  | { kind: 'col'; el: HTMLElement; ctx: GroupCtx; after: boolean }
  | { kind: 'side'; side: Side };

// Active body disposers per host element, cleared on every re-render of that host.
const hostDisposers = new WeakMap<HTMLElement, Array<() => void>>();

interface DockState {
  hosts: DockHosts;
  layout: WorkspaceLayout;
  opts: DockRenderOptions;
}

let current: DockState | null = null;
let resizeBound = false;

/* ================================ entry ================================= */

/** Render (or re-render) both dock areas from `layout` into `hosts`. */
export function renderDocks(hosts: DockHosts, layout: WorkspaceLayout, opts: DockRenderOptions = {}): void {
  current = { hosts, layout, opts };
  if (!resizeBound) {
    window.addEventListener('resize', () => {
      if (!current) return;
      applyColumnWidths(current.hosts.left);
      applyColumnWidths(current.hosts.right);
    });
    resizeBound = true;
  }
  renderBothAreas();
}

/** Re-render both areas from the current layout (e.g. after panels register).
 *
 * The Edit Menu panel docks a LIVE, already-focused editor node, and a re-render
 * reparents it (dispose → parking home → rebuild → back into the dock). Moving a
 * focused field blurs it and drops the caret, so we snapshot the active dock
 * field + its selection and restore them synchronously — the same input node
 * survives the reparent, so this is invisible to a user mid-keystroke. */
export function refreshDocks(): void {
  if (!current) return;
  const active = document.activeElement;
  const keep = active instanceof HTMLElement && active.closest('.dockarea') ? active : null;
  let selStart: number | null = null;
  let selEnd: number | null = null;
  if (keep instanceof HTMLInputElement || keep instanceof HTMLTextAreaElement) {
    try {
      selStart = keep.selectionStart;
      selEnd = keep.selectionEnd;
    } catch {
      /* inputs like date/number reject selection access — leave null */
    }
  }

  renderBothAreas();

  if (keep && keep.isConnected) {
    keep.focus();
    if (selStart != null && (keep instanceof HTMLInputElement || keep instanceof HTMLTextAreaElement)) {
      try {
        keep.setSelectionRange(selStart, selEnd ?? selStart);
      } catch {
        /* non-text input — focus alone is enough */
      }
    }
  }
}

/** Swap the live layout (e.g. Reset Workspace) — persists and re-renders. */
export function setDockLayout(layout: WorkspaceLayout): void {
  if (!current) return;
  current.layout = layout;
  persist();
  refreshDocks();
}

/* =============================== helpers ================================ */

function areaFor(side: Side): DockArea {
  return side === 'left' ? current!.layout.left : current!.layout.right;
}

function persist(): void {
  current?.opts.onChange?.(current.layout);
}

/** Panels of a group that actually have a registered definition to render. */
function renderablePanels(group: PanelGroup): string[] {
  return group.panels.filter((id) => !!getPanel(id));
}

function columnHasContent(col: DockColumn): boolean {
  return col.stack.cells.some((cell) => renderablePanels(cell.group).length > 0);
}

/** A column is at least MIN_COL_PX wide, growing to its widest panel's minW. */
function columnMinWidth(col: DockColumn): number {
  let min = MIN_COL_PX;
  for (const cell of col.stack.cells) {
    for (const id of renderablePanels(cell.group)) {
      const p = getPanel(id);
      if (p?.minW) min = Math.max(min, p.minW);
    }
  }
  return min;
}

function disposeHost(host: HTMLElement): void {
  const list = hostDisposers.get(host);
  if (list) {
    for (const dispose of list) {
      try {
        dispose();
      } catch {
        /* a panel's disposer must never break teardown */
      }
    }
  }
  hostDisposers.delete(host);
}

/* ============================ area rendering ============================ */

/** Tear a host down: run its panel disposers (which return any live reparented
 *  node — e.g. the editor — to its parking home) and empty it. */
function teardownArea(host: HTMLElement): void {
  disposeHost(host);
  host.innerHTML = '';
}

/** Build a host's columns from the layout. The host must already be torn down. */
function buildArea(side: Side, host: HTMLElement): void {
  host.classList.add('dockarea');
  host.classList.toggle('dock-left', side === 'left');
  host.classList.toggle('dock-right', side === 'right');

  const sink: Array<() => void> = [];
  hostDisposers.set(host, sink);

  const columns = areaFor(side).columns.filter(columnHasContent);
  host.hidden = columns.length === 0;
  if (!columns.length) return;

  for (const col of columns) host.appendChild(buildColumn(side, col, sink));
  applyColumnWidths(host);
}

/** Re-render a single area (safe for callers that never migrate a live node
 *  across areas — tab switches, single-area refreshes). */
function renderArea(side: Side, host: HTMLElement): void {
  teardownArea(host);
  buildArea(side, host);
}

/** Re-render BOTH areas in two phases — tear both down first, then build both.
 *  A live reparented panel (the docked editor) can migrate left↔right in one
 *  pass; decoupling teardown from build guarantees every stale disposer has run
 *  (returning the node to its parking home) BEFORE either area claims it, so the
 *  node can never be orphaned by a not-yet-built area's teardown. */
function renderBothAreas(): void {
  if (!current) return;
  teardownArea(current.hosts.left);
  teardownArea(current.hosts.right);
  buildArea('left', current.hosts.left);
  buildArea('right', current.hosts.right);
}

/** Resolve each column's stored widthPct into a clamped pixel width. */
function applyColumnWidths(host: HTMLElement): void {
  host.querySelectorAll<HTMLElement>('.dock-col').forEach((el) => {
    const pct = Number(el.dataset.pct) || 20;
    const min = Number(el.dataset.min) || MIN_COL_PX;
    const px = Math.max(min, Math.min(window.innerWidth * MAX_COL_FRACTION, (pct / 100) * window.innerWidth));
    el.style.width = `${Math.round(px)}px`;
  });
}

function buildColumn(side: Side, col: DockColumn, sink: Array<() => void>): HTMLElement {
  const el = document.createElement('div');
  el.className = 'dock-col';
  el.dataset.pct = String(col.widthPct);
  el.dataset.min = String(columnMinWidth(col));

  const divider = document.createElement('div');
  divider.className = 'dock-vdivider';
  divider.title = 'Drag to resize';
  divider.addEventListener('pointerdown', (e) => startColumnResize(side, el, col, e));

  const stack = buildStack(side, col, sink);

  // The width handle sits on the column's inner edge (toward the page).
  if (side === 'right') {
    el.append(divider, stack);
  } else {
    el.append(stack, divider);
  }
  return el;
}

function buildStack(side: Side, col: DockColumn, sink: Array<() => void>): HTMLElement {
  const stack = document.createElement('div');
  stack.className = 'dock-stack';

  const cells = col.stack.cells.filter((cell) => renderablePanels(cell.group).length > 0);
  let prev: { el: HTMLElement; cell: DockColumn['stack']['cells'][number] } | null = null;

  for (const cell of cells) {
    const cellEl = document.createElement('div');
    cellEl.className = 'dock-cell';
    cellEl.style.flex = `${Math.max(1, cell.heightPct)} 1 0`;
    cellEl.appendChild(buildGroup({ side, col, cell, group: cell.group }, sink));

    if (prev) {
      const divider = document.createElement('div');
      divider.className = 'dock-hdivider';
      divider.title = 'Drag to resize';
      const above = prev;
      const below = { el: cellEl, cell };
      divider.addEventListener('pointerdown', (e) => startStackResize(above, below, e));
      stack.appendChild(divider);
    }

    stack.appendChild(cellEl);
    prev = { el: cellEl, cell };
  }
  return stack;
}

function buildGroup(ctx: GroupCtx, sink: Array<() => void>): HTMLElement {
  const group = ctx.group;
  const groupEl = document.createElement('div');
  groupEl.className = 'dock-group';
  groupModel.set(groupEl, ctx);

  const ids = renderablePanels(group);
  const active = ids.includes(group.activeTab) ? group.activeTab : ids[0];

  const tabs = document.createElement('div');
  tabs.className = 'dock-tabs';
  tabs.setAttribute('role', 'tablist');
  for (const id of ids) {
    const panel = getPanel(id)!;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'dock-tab' + (id === active ? ' on' : '');
    tab.dataset.panel = id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(id === active));
    tab.innerHTML =
      (panel.icon ? `<span class="dock-tab-ic" aria-hidden="true">${panel.icon}</span>` : '') +
      `<span class="dock-tab-lbl">${escapeHtml(panel.title)}</span>`;
    tab.addEventListener('click', () => {
      if (group.activeTab === id) return;
      group.activeTab = id;
      persist();
      rerenderOwning(groupEl); // simplest correct path: re-render the owning area
    });
    // A tab is also the drag handle for its panel (see startTabDrag). The drag
    // only begins past a small threshold, so a plain click still switches tabs.
    tab.addEventListener('pointerdown', (e) => startTabDrag(e, id, group));
    tabs.appendChild(tab);
  }

  const body = document.createElement('div');
  body.className = 'dock-body';
  const panel = active ? getPanel(active) : undefined;
  if (panel) {
    const dispose = panel.render(body);
    if (typeof dispose === 'function') sink.push(dispose);
  }

  groupEl.append(tabs, body);
  return groupEl;
}

function rerenderOwning(el: HTMLElement): void {
  if (!current) return;
  const host = el.closest<HTMLElement>('.dockarea');
  if (!host) return;
  renderArea(host === current.hosts.left ? 'left' : 'right', host);
}

/* ============================== dividers =============================== */

function startColumnResize(side: Side, colEl: HTMLElement, col: DockColumn, e: PointerEvent): void {
  e.preventDefault();
  const divider = e.currentTarget as HTMLElement;
  divider.classList.add('drag');
  const startX = e.clientX;
  const startW = colEl.offsetWidth;
  const min = Number(colEl.dataset.min) || MIN_COL_PX;
  const max = window.innerWidth * MAX_COL_FRACTION;

  const move = (ev: PointerEvent): void => {
    const delta = ev.clientX - startX;
    // Right dock: handle on the left edge — dragging left (delta < 0) widens it.
    const raw = side === 'right' ? startW - delta : startW + delta;
    colEl.style.width = `${Math.round(Math.max(min, Math.min(max, raw)))}px`;
  };
  const up = (): void => {
    divider.classList.remove('drag');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    col.widthPct = (colEl.offsetWidth / window.innerWidth) * 100;
    colEl.dataset.pct = String(col.widthPct);
    persist();
    current?.opts.onResize?.();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function startStackResize(above: { el: HTMLElement; cell: Cell }, below: { el: HTMLElement; cell: Cell }, e: PointerEvent): void {
  e.preventDefault();
  const divider = e.currentTarget as HTMLElement;
  divider.classList.add('drag');
  const startY = e.clientY;
  const aStart = above.el.offsetHeight;
  const bStart = below.el.offsetHeight;
  const pairPx = aStart + bStart;
  const pairGrow = Math.max(1, above.cell.heightPct) + Math.max(1, below.cell.heightPct);

  const move = (ev: PointerEvent): void => {
    const aPx = Math.max(MIN_CELL_PX, Math.min(pairPx - MIN_CELL_PX, aStart + (ev.clientY - startY)));
    const aGrow = pairGrow * (aPx / pairPx);
    above.el.style.flex = `${aGrow} 1 0`;
    below.el.style.flex = `${pairGrow - aGrow} 1 0`;
  };
  const up = (): void => {
    divider.classList.remove('drag');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const total = above.el.offsetHeight + below.el.offsetHeight || 1;
    above.cell.heightPct = pairGrow * (above.el.offsetHeight / total);
    below.cell.heightPct = pairGrow - above.cell.heightPct;
    persist();
    current?.opts.onResize?.();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/* ========================= panel drag & drop ========================= */
// Dragging a tab moves its panel between groups / cells / columns / docks. The
// zones are intentionally large and the placeholder updates live with no dwell
// timer, so a panel snaps into a slot instead of needing a thin-sliver hover.

let ghostEl: HTMLElement | null = null;
let indicatorEl: HTMLElement | null = null;

function beginDragVisuals(title: string): void {
  ghostEl = document.createElement('div');
  ghostEl.className = 'dock-drag-ghost';
  ghostEl.textContent = title;
  indicatorEl = document.createElement('div');
  indicatorEl.className = 'dock-drop-indicator';
  indicatorEl.hidden = true;
  document.body.append(ghostEl, indicatorEl);
  document.body.classList.add('dock-dragging');
}

function endDragVisuals(): void {
  ghostEl?.remove();
  indicatorEl?.remove();
  ghostEl = indicatorEl = null;
  document.body.classList.remove('dock-dragging');
}

function positionGhost(x: number, y: number): void {
  if (ghostEl) {
    ghostEl.style.left = `${x + 14}px`;
    ghostEl.style.top = `${y + 14}px`;
  }
}

function groupElAt(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  return el instanceof HTMLElement ? el.closest<HTMLElement>('.dock-group') : null;
}

function computeTarget(x: number, y: number): DropTarget | null {
  // Fat window-edge bands win first — the easiest possible side-dock target.
  if (x <= EDGE_DOCK_PX) return { kind: 'side', side: 'left' };
  if (x >= window.innerWidth - EDGE_DOCK_PX) return { kind: 'side', side: 'right' };

  const groupEl = groupElAt(x, y);
  if (groupEl) {
    const ctx = groupModel.get(groupEl);
    if (ctx) {
      const r = groupEl.getBoundingClientRect();
      const fx = (x - r.left) / (r.width || 1);
      const fy = (y - r.top) / (r.height || 1);
      // Generous central box → drop as a tab in this group.
      if (fx > 0.3 && fx < 0.7 && fy > 0.3 && fy < 0.7) return { kind: 'tab', el: groupEl, ctx };
      const dl = fx, dr = 1 - fx, dt = fy, db = 1 - fy;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) return { kind: 'col', el: groupEl, ctx, after: false };
      if (m === dr) return { kind: 'col', el: groupEl, ctx, after: true };
      if (m === dt) return { kind: 'cell', el: groupEl, ctx, after: false };
      return { kind: 'cell', el: groupEl, ctx, after: true };
    }
  }

  // Over an empty dock area (e.g. the collapsed right dock) → side-dock there.
  const under = document.elementFromPoint(x, y);
  const areaEl = under instanceof HTMLElement ? under.closest<HTMLElement>('.dockarea') : null;
  if (current && areaEl === current.hosts.left) return { kind: 'side', side: 'left' };
  if (current && areaEl === current.hosts.right) return { kind: 'side', side: 'right' };
  return null;
}

function showIndicator(target: DropTarget | null): void {
  if (!indicatorEl) return;
  if (!target) {
    indicatorEl.hidden = true;
    return;
  }
  let left: number;
  let top: number;
  let width: number;
  let height: number;
  if (target.kind === 'side') {
    const main = document.getElementById('mainGrid')?.getBoundingClientRect();
    const t = main ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    top = t.top;
    height = t.height;
    width = SIDE_BAND_PX;
    left = target.side === 'left' ? t.left : t.right - SIDE_BAND_PX;
  } else {
    const r = target.el.getBoundingClientRect();
    left = r.left;
    top = r.top;
    width = r.width;
    height = r.height;
    if (target.kind === 'cell') {
      height = r.height / 2;
      if (target.after) top = r.top + r.height / 2;
    } else if (target.kind === 'col') {
      width = r.width / 2;
      if (target.after) left = r.left + r.width / 2;
    }
  }
  indicatorEl.style.left = `${Math.round(left)}px`;
  indicatorEl.style.top = `${Math.round(top)}px`;
  indicatorEl.style.width = `${Math.round(width)}px`;
  indicatorEl.style.height = `${Math.round(height)}px`;
  indicatorEl.hidden = false;
}

function newCellFor(id: string, heightPct: number): Cell {
  return { heightPct: Math.max(1, heightPct), group: { panels: [id], activeTab: id, collapsed: false } };
}

function newColumnFor(id: string): DockColumn {
  return { widthPct: NEW_COL_PCT, stack: { cells: [newCellFor(id, 100)] } };
}

function removePanelById(layout: WorkspaceLayout, id: string): void {
  for (const side of ['left', 'right'] as const) {
    const area = layout[side];
    for (const col of area.columns) {
      for (const cell of col.stack.cells) {
        const g = cell.group;
        const i = g.panels.indexOf(id);
        if (i >= 0) {
          g.panels.splice(i, 1);
          if (g.activeTab === id) g.activeTab = g.panels[0] ?? '';
        }
      }
    }
    for (const col of area.columns) col.stack.cells = col.stack.cells.filter((c) => c.group.panels.length > 0);
    area.columns = area.columns.filter((c) => c.stack.cells.length > 0);
  }
}

function applyDrop(id: string, sourceGroup: PanelGroup, target: DropTarget | null): void {
  if (!current || !target) return;

  // Dropping onto its own group is a no-op; a lone panel can't split from itself.
  if (target.kind === 'tab' && target.ctx.group === sourceGroup) return;
  if ((target.kind === 'cell' || target.kind === 'col') && target.ctx.group === sourceGroup && sourceGroup.panels.length === 1) {
    return;
  }

  const layout = current.layout;
  removePanelById(layout, id);

  switch (target.kind) {
    case 'tab': {
      target.ctx.group.panels.push(id);
      target.ctx.group.activeTab = id;
      break;
    }
    case 'cell': {
      const cells = target.ctx.col.stack.cells;
      let idx = cells.indexOf(target.ctx.cell);
      if (idx < 0) idx = target.after ? cells.length - 1 : 0;
      cells.splice(target.after ? idx + 1 : idx, 0, newCellFor(id, target.ctx.cell.heightPct));
      break;
    }
    case 'col': {
      const cols = layout[target.ctx.side].columns;
      let idx = cols.indexOf(target.ctx.col);
      if (idx < 0) idx = target.after ? cols.length - 1 : 0;
      cols.splice(target.after ? idx + 1 : idx, 0, newColumnFor(id));
      break;
    }
    case 'side': {
      const area = layout[target.side];
      if (target.side === 'left') area.columns.unshift(newColumnFor(id));
      else area.columns.push(newColumnFor(id));
      break;
    }
  }

  persist();
  refreshDocks();
  current.opts.onResize?.();
  window.dispatchEvent(new Event('resize'));
}

function startTabDrag(e: PointerEvent, id: string, sourceGroup: PanelGroup): void {
  if (e.button !== 0) return;
  const startX = e.clientX;
  const startY = e.clientY;
  const title = getPanel(id)?.title ?? id;
  let active = false;
  let target: DropTarget | null = null;

  const move = (ev: PointerEvent): void => {
    if (!active) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
      active = true;
      beginDragVisuals(title);
    }
    ev.preventDefault();
    positionGhost(ev.clientX, ev.clientY);
    target = computeTarget(ev.clientX, ev.clientY);
    showIndicator(target);
  };
  const up = (ev: PointerEvent): void => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (!active) return; // a plain click — let the tab's click handler switch tabs
    ev.preventDefault();
    endDragVisuals();
    // Suppress the click that follows a drag so the tab doesn't also "switch".
    const suppress = (ce: Event): void => {
      ce.stopPropagation();
      ce.preventDefault();
      window.removeEventListener('click', suppress, true);
    };
    window.addEventListener('click', suppress, true);
    applyDrop(id, sourceGroup, target);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
