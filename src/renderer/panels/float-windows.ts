// Photoshop-style floating tool windows: draggable by their title bar,
// resizable from the corner, magnetically snapping to the viewport edges and to
// each other, click-to-front z-ordering, and per-window bounds remembered in
// settings.floatWindows. This module is purely the window *chrome* + geometry;
// each window's contents and interactions live in window-panels.ts.

import type { FloatWindowBounds } from '@shared/types';
import { getState, persist } from '../store';

export interface FloatWinDef {
  id: string;
  title: string;
  /** Inline SVG markup for the title-bar icon. */
  icon: string;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  /** Structural HTML for the body (re-rendered on open and on refreshWindow). */
  body: () => string;
  /** Called after the body is (re)rendered, for one-off setup like value sync. */
  afterRender?: (win: HTMLElement) => void;
}

const SNAP = 9; // px magnetic threshold
const HEAD_H = 34;
const registry = new Map<string, FloatWinDef>();
let zCounter = 40;
let openCount = 0;

function layer(): HTMLElement {
  let el = document.getElementById('floatLayer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'floatLayer';
    el.className = 'float-layer';
    document.body.appendChild(el);
  }
  return el;
}

export function registerFloatWindow(def: FloatWinDef): void {
  registry.set(def.id, def);
}

export function isOpen(id: string): boolean {
  return !!document.getElementById(`fw-${id}`);
}

function boundsStore(): Record<string, FloatWindowBounds> {
  const s = getState().settings;
  return (s.floatWindows = s.floatWindows ?? {});
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function defaultBounds(def: FloatWinDef): FloatWindowBounds {
  const vw = window.innerWidth;
  const w = Math.min(def.defaultW, vw - 40);
  const h = def.defaultH;
  // Cascade from the top-right so the stage stays visible.
  const step = (openCount % 6) * 26;
  const x = clamp(vw - w - 28 - step, 20, vw - w - 12);
  const y = clamp(150 + step, 88, window.innerHeight - h - 20);
  return { x, y, w, h, open: true };
}

function applyBounds(win: HTMLElement, b: FloatWindowBounds): void {
  win.style.left = `${Math.round(b.x)}px`;
  win.style.top = `${Math.round(b.y)}px`;
  win.style.width = `${Math.round(b.w)}px`;
  win.style.height = `${Math.round(b.h)}px`;
}

function readBounds(win: HTMLElement): FloatWindowBounds {
  return {
    x: win.offsetLeft,
    y: win.offsetTop,
    w: win.offsetWidth,
    h: win.offsetHeight,
    open: true,
  };
}

function saveBounds(id: string, b: FloatWindowBounds): void {
  boundsStore()[id] = b;
  persist();
}

function bringToFront(win: HTMLElement): void {
  win.style.zIndex = String(++zCounter);
}

/** Snap a moving edge to viewport edges and to other windows' edges. */
function snapMove(win: HTMLElement, rawX: number, rawY: number): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = win.offsetWidth;
  const h = win.offsetHeight;
  const xs: number[] = [0, vw - w];
  const ys: number[] = [72, vh - h];
  for (const other of layer().querySelectorAll<HTMLElement>('.floatwin')) {
    if (other === win) continue;
    const ol = other.offsetLeft;
    const ot = other.offsetTop;
    const ow = other.offsetWidth;
    const oh = other.offsetHeight;
    xs.push(ol, ol + ow - w, ol + ow, ol - w); // align-left, align-right, adjacent-right, adjacent-left
    ys.push(ot, ot + oh - h, ot + oh, ot - h);
  }
  let x = rawX;
  let y = rawY;
  for (const t of xs) if (Math.abs(rawX - t) < SNAP) { x = t; break; }
  for (const t of ys) if (Math.abs(rawY - t) < SNAP) { y = t; break; }
  return {
    x: clamp(x, 0, Math.max(0, vw - w)),
    y: clamp(y, 56, Math.max(56, vh - h)),
  };
}

function startDrag(win: HTMLElement, id: string, e: PointerEvent): void {
  e.preventDefault();
  bringToFront(win);
  const startX = e.clientX;
  const startY = e.clientY;
  const originLeft = win.offsetLeft;
  const originTop = win.offsetTop;
  win.classList.add('dragging');
  const move = (ev: PointerEvent): void => {
    const { x, y } = snapMove(win, originLeft + (ev.clientX - startX), originTop + (ev.clientY - startY));
    win.style.left = `${x}px`;
    win.style.top = `${y}px`;
  };
  const up = (): void => {
    win.classList.remove('dragging');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    saveBounds(id, readBounds(win));
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function startResize(win: HTMLElement, def: FloatWinDef, id: string, e: PointerEvent): void {
  e.preventDefault();
  e.stopPropagation();
  bringToFront(win);
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = win.offsetWidth;
  const startH = win.offsetHeight;
  const minW = def.minW ?? 220;
  const minH = def.minH ?? 140;
  win.classList.add('resizing');
  const move = (ev: PointerEvent): void => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let w = clamp(startW + (ev.clientX - startX), minW, vw - win.offsetLeft - 8);
    let h = clamp(startH + (ev.clientY - startY), minH, vh - win.offsetTop - 8);
    // snap right/bottom edges to the viewport
    if (Math.abs(win.offsetLeft + w - vw) < SNAP) w = vw - win.offsetLeft;
    if (Math.abs(win.offsetTop + h - vh) < SNAP) h = vh - win.offsetTop;
    win.style.width = `${w}px`;
    win.style.height = `${h}px`;
  };
  const up = (): void => {
    win.classList.remove('resizing');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    saveBounds(id, readBounds(win));
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

export function refreshWindow(id: string): void {
  const def = registry.get(id);
  const win = document.getElementById(`fw-${id}`);
  if (!def || !win) return;
  const body = win.querySelector<HTMLElement>('.floatwin-body');
  if (!body) return;
  body.innerHTML = def.body();
  def.afterRender?.(win);
}

export function openWindow(id: string): void {
  const def = registry.get(id);
  if (!def || isOpen(id)) {
    document.getElementById(`fw-${id}`) && bringToFront(document.getElementById(`fw-${id}`)!);
    return;
  }
  const saved = boundsStore()[id];
  const b: FloatWindowBounds = saved
    ? {
        x: clamp(saved.x, 0, window.innerWidth - 80),
        y: clamp(saved.y, 56, window.innerHeight - 80),
        w: clamp(saved.w, def.minW ?? 220, window.innerWidth - 24),
        h: clamp(saved.h, def.minH ?? 140, window.innerHeight - 24),
        open: true,
      }
    : defaultBounds(def);

  const win = document.createElement('section');
  win.className = 'floatwin';
  win.id = `fw-${id}`;
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', def.title);
  win.innerHTML = `<header class="floatwin-head" data-fw-drag>
      <span class="floatwin-icon" aria-hidden="true">${def.icon}</span>
      <h3 class="floatwin-title">${def.title}</h3>
      <button class="floatwin-close" data-fw-close="${id}" title="Close" aria-label="Close ${def.title}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </header>
    <div class="floatwin-body">${def.body()}</div>
    <span class="floatwin-resize" data-fw-resize aria-hidden="true"></span>`;
  applyBounds(win, b);
  layer().appendChild(win);
  bringToFront(win);
  openCount += 1;
  def.afterRender?.(win);

  const head = win.querySelector<HTMLElement>('[data-fw-drag]');
  head?.addEventListener('pointerdown', (ev) => {
    if ((ev.target as Element).closest('[data-fw-close]')) return;
    startDrag(win, id, ev);
  });
  win.querySelector<HTMLElement>('[data-fw-resize]')?.addEventListener('pointerdown', (ev) => startResize(win, def, id, ev));
  win.addEventListener('pointerdown', () => bringToFront(win), true);

  const store = boundsStore();
  store[id] = { ...b, open: true };
  persist();
}

export function closeWindow(id: string): void {
  const win = document.getElementById(`fw-${id}`);
  if (win) {
    win.remove();
    openCount = Math.max(0, openCount - 1);
  }
  const store = boundsStore();
  if (store[id]) {
    store[id] = { ...store[id], open: false };
    persist();
  }
}

export function toggleWindow(id: string): void {
  if (isOpen(id)) closeWindow(id);
  else openWindow(id);
}

/** Restore every window that was open last session (called once at boot). */
export function restoreOpenWindows(): void {
  const store = getState().settings.floatWindows;
  if (!store) return;
  for (const [id, b] of Object.entries(store)) {
    if (b.open && registry.has(id)) openWindow(id);
  }
}

/** Return all windows to their default positions/sizes, keeping open ones open. */
export function resetWindowLayout(): void {
  const openIds = Array.from(layer().querySelectorAll<HTMLElement>('.floatwin')).map((w) => w.id.replace('fw-', ''));
  getState().settings.floatWindows = {};
  persist();
  openCount = 0;
  for (const id of openIds) {
    document.getElementById(`fw-${id}`)?.remove();
  }
  for (const id of openIds) openWindow(id);
}

export function initFloatLayer(): void {
  layer();
  // Global close delegation (bodies re-render, so delegate).
  layer().addEventListener('click', (e) => {
    const close = (e.target as Element).closest<HTMLElement>('[data-fw-close]');
    if (close?.dataset.fwClose) closeWindow(close.dataset.fwClose);
  });
  // Escape closes the window that currently holds focus.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const win = (document.activeElement as Element)?.closest?.<HTMLElement>('.floatwin');
    if (win) { e.preventDefault(); closeWindow(win.id.replace('fw-', '')); }
  });
  // Keep windows on-screen when the viewport shrinks.
  window.addEventListener('resize', () => {
    for (const win of layer().querySelectorAll<HTMLElement>('.floatwin')) {
      const x = clamp(win.offsetLeft, 0, Math.max(0, window.innerWidth - win.offsetWidth));
      const y = clamp(win.offsetTop, 56, Math.max(56, window.innerHeight - win.offsetHeight));
      win.style.left = `${x}px`;
      win.style.top = `${y}px`;
    }
  });
}
