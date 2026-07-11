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
  renderArea('left', hosts.left);
  renderArea('right', hosts.right);
}

/** Re-render both areas from the current layout (e.g. after panels register). */
export function refreshDocks(): void {
  if (!current) return;
  renderArea('left', current.hosts.left);
  renderArea('right', current.hosts.right);
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

function renderArea(side: Side, host: HTMLElement): void {
  disposeHost(host);
  host.innerHTML = '';
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

  const stack = buildStack(col, sink);

  // The width handle sits on the column's inner edge (toward the page).
  if (side === 'right') {
    el.append(divider, stack);
  } else {
    el.append(stack, divider);
  }
  return el;
}

function buildStack(col: DockColumn, sink: Array<() => void>): HTMLElement {
  const stack = document.createElement('div');
  stack.className = 'dock-stack';

  const cells = col.stack.cells.filter((cell) => renderablePanels(cell.group).length > 0);
  let prev: { el: HTMLElement; cell: DockColumn['stack']['cells'][number] } | null = null;

  for (const cell of cells) {
    const cellEl = document.createElement('div');
    cellEl.className = 'dock-cell';
    cellEl.style.flex = `${Math.max(1, cell.heightPct)} 1 0`;
    cellEl.appendChild(buildGroup(cell.group, sink));

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

function buildGroup(group: PanelGroup, sink: Array<() => void>): HTMLElement {
  const groupEl = document.createElement('div');
  groupEl.className = 'dock-group';

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

type Cell = DockColumn['stack']['cells'][number];

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
