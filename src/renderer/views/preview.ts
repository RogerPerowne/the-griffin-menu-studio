// Live preview view: mounts the menu page into #pagewrap, wires inline
// editing, "Arrange" free-drag mode, one-page auto-fit, and the print-DOM
// preflight used before export. Faithfully ported from the mockup
// (reference/griffin-menu-studio.html) — specifically its release-hardening
// layer, which is the version of this behaviour that shipped.
//
// This module only talks to the rest of the app through the store (commit()
// emits scopes; other views subscribe themselves the same way). It never
// imports the editor/rail view modules.

import type { DietKey } from '@shared/types';
import { renderMenuHTML } from '@shared/menu/render';
import { normaliseSectionColumns } from '@shared/menu/normalize';
import { getActiveBrand } from '@shared/brand';
import { assetUrl } from '../brand-assets';
import { commit, currentMenu, findDish, getState, persist, snapshot, undo } from '../store';
import {
  applyReleaseSettings,
  bindReleaseSettings,
  fitPage,
  getZoom,
  observePagewrapPage,
  type ProductionInfo,
  productionInfo,
  scheduleOverflowCheck,
  scheduleRulers,
  setFollowFit,
  setZoom,
} from '../layout-runtime';

const brand = getActiveBrand();
const ASSETS = { crest: assetUrl(brand.assetKeys.crest), lockup: assetUrl(brand.assetKeys.lockup) };

function renderArgs(edit: boolean): { edit: boolean; dietKey: DietKey[]; assets: { crest: string; lockup: string } } {
  return { edit, dietKey: getState().settings.dietKey, assets: ASSETS };
}

function pagewrapEl(): HTMLElement {
  const el = document.getElementById('pagewrap');
  if (!el) throw new Error('#pagewrap not found');
  return el;
}

/* ================= preview render ================= */

let lastMenuId: string | null = null;

/** Mount the current menu into #pagewrap and re-fit/re-check everything that depends on it. */
export function renderPreview(): void {
  const menu = currentMenu();
  if (!menu) return;

  // The mockup's renderAll(true) reset the zoom-to-fit whenever the open
  // menu changed; port that by tracking the last menu id we rendered.
  if (menu.id !== lastMenuId) {
    lastMenuId = menu.id;
    setFollowFit(true);
  }

  const wrap = pagewrapEl();
  wrap.innerHTML = renderMenuHTML(menu, renderArgs(true));

  const paperLabel = document.getElementById('stPaper');
  if (paperLabel) paperLabel.textContent = `${menu.style.paper || 'A4'} · BLUSH PREVIEW · EXPORTS WHITE`;

  document.documentElement.style.setProperty('--blush', getState().settings.blush || '#F5E4DF');

  wrap.querySelectorAll('img').forEach((img) => {
    const image = img as HTMLImageElement;
    if (!image.complete) image.addEventListener('load', () => fitPage(), { once: true });
  });

  fitPage();
  requestAnimationFrame(() => fitPage());
  window.setTimeout(() => fitPage(), 180);

  if (moveMode) {
    wrap.querySelectorAll<HTMLElement>('[data-edit]').forEach((el) => {
      el.contentEditable = 'false';
    });
  }

  applyReleaseSettings();
  observePagewrapPage();
  scheduleOverflowCheck();

  const style = menu.style;
  const shrunk = (!!style.sc && style.sc < 1) || (!!style.dn && style.dn < 1);
  const resetBtn = document.getElementById('btnResetFit');
  if (resetBtn) resetBtn.style.display = shrunk ? 'inline-block' : 'none';
}

/* ================= inline editing ================= */
// Paths: menu.name / menu.headerNote / menu.footer / sec:<id>.<field> /
// item:<id>.<field> / col:<sid>.<index> — ported exactly from the mockup's
// applyEdit, adjusted for the new model (findDish instead of findItem,
// section/dish objects instead of raw item records).

function applyEdit(path: string, rawVal: string): void {
  const menu = currentMenu();
  const val = rawVal.trim();

  if (path === 'menu.name') {
    menu.name = val || menu.name;
    return;
  }
  if (path === 'menu.headerNote') {
    menu.headerNote = val;
    return;
  }
  if (path === 'menu.footer') {
    menu.footer = val;
    return;
  }
  if (path.startsWith('sec:')) {
    const rest = path.slice('sec:'.length);
    const dot = rest.indexOf('.');
    if (dot < 0) return;
    const id = rest.slice(0, dot);
    const field = rest.slice(dot + 1);
    const section = menu.sections.find((s) => s.id === id);
    if (section && (field === 'name' || field === 'note')) {
      section[field] = val;
    }
    return;
  }
  if (path.startsWith('item:')) {
    const rest = path.slice('item:'.length);
    const dot = rest.indexOf('.');
    if (dot < 0) return;
    const id = rest.slice(0, dot);
    const field = rest.slice(dot + 1);
    const found = findDish(menu, id);
    if (found && (field === 'name' || field === 'desc' || field === 'price' || field === 'note')) {
      found.dish[field] = val;
    }
    return;
  }
  if (path.startsWith('col:')) {
    const rest = path.slice('col:'.length);
    const dot = rest.indexOf('.');
    if (dot < 0) return;
    const sid = rest.slice(0, dot);
    const idx = Number(rest.slice(dot + 1));
    const section = menu.sections.find((s) => s.id === sid);
    if (section && Number.isFinite(idx)) {
      normaliseSectionColumns(section);
      section.columnNames[idx] = val;
    }
  }
}

function editTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  return node.closest<HTMLElement>('[data-edit]');
}

function onFocusIn(e: FocusEvent): void {
  const el = editTarget(e.target);
  if (!el) return;
  el.dataset.orig = el.textContent ?? '';
}

function onKeyDown(e: KeyboardEvent): void {
  const el = editTarget(e.target);
  if (el && e.key === 'Enter' && el.dataset.edit !== 'menu.footer') {
    e.preventDefault();
    el.blur();
  }
  const target = e.target;
  const withinInput = target instanceof Element && !!target.closest('input,textarea,[contenteditable]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !withinInput) {
    e.preventDefault();
    undo();
  }
}

function onFocusOut(e: FocusEvent): void {
  const el = editTarget(e.target);
  if (!el) return;
  const val = el.textContent ?? '';
  if (val === el.dataset.orig) return;
  snapshot();
  applyEdit(el.dataset.edit ?? '', val);
  commit(['editor', 'preview', 'rail']);
}

/* ================= arrange (free drag) mode ================= */

let moveMode = false;

interface DragState {
  block: HTMLElement;
  key: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  nx: number;
  ny: number;
}
let drag: DragState | null = null;

export function toggleMoveMode(): void {
  moveMode = !moveMode;
  document.body.classList.toggle('moveMode', moveMode);
  document.getElementById('btnMove')?.classList.toggle('act', moveMode);
  // in move mode, turn off contenteditable so drags don't start text editing
  pagewrapEl()
    .querySelectorAll<HTMLElement>('[data-edit]')
    .forEach((el) => {
      el.contentEditable = moveMode ? 'false' : 'plaintext-only';
    });
}

export function isArrangeMode(): boolean {
  return moveMode;
}

function onPointerDownArrange(e: PointerEvent): void {
  if (!moveMode) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  const block = target.closest<HTMLElement>('.movable');
  if (!block) return;
  e.preventDefault();
  const menu = currentMenu();
  const key = block.dataset.move;
  if (!key) return;
  const pos = menu.pos ?? (menu.pos = {});
  const start = pos[key] ?? { x: 0, y: 0 };
  drag = {
    block,
    key,
    startX: e.clientX,
    startY: e.clientY,
    originX: start.x || 0,
    originY: start.y || 0,
    nx: 0,
    ny: 0,
  };
  block.classList.add('moving');
  block.setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', onPointerMoveArrange);
  window.addEventListener('pointerup', onPointerUpArrange, { once: true });
}

function onPointerMoveArrange(e: PointerEvent): void {
  if (!drag) return;
  const z = getZoom();
  const dx = (e.clientX - drag.startX) / z;
  const dy = (e.clientY - drag.startY) / z;
  const nx = Math.round(drag.originX + dx);
  const ny = Math.round(drag.originY + dy);
  drag.block.style.transform = `translate(${nx}px,${ny}px)`;
  drag.nx = nx;
  drag.ny = ny;
}

function onPointerUpArrange(): void {
  if (!drag) return;
  window.removeEventListener('pointermove', onPointerMoveArrange);
  drag.block.classList.remove('moving');
  const menu = currentMenu();
  snapshot();
  const pos = menu.pos ?? (menu.pos = {});
  if ((drag.nx || 0) === 0 && (drag.ny || 0) === 0) {
    delete pos[drag.key];
  } else {
    pos[drag.key] = { x: drag.nx || drag.originX, y: drag.ny || drag.originY };
  }
  drag = null;
  persist();
}

function onDblClickArrange(e: MouseEvent): void {
  if (!moveMode) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  const block = target.closest<HTMLElement>('.movable');
  if (!block) return;
  const key = block.dataset.move;
  const menu = currentMenu();
  if (key && menu.pos && menu.pos[key]) {
    snapshot();
    delete menu.pos[key];
    commit();
  }
}

/** Clear every Arrange-mode free-drag position on the current menu. */
export function resetAllPositions(): void {
  const menu = currentMenu();
  if (!menu.pos || !Object.keys(menu.pos).length) return;
  snapshot();
  menu.pos = {};
  commit();
}

/* ================= one-page auto-fit ================= */

const round2 = (n: number): number => Number(n.toFixed(2));

/** Gentle one-page fitting: spacing first, typography only as a last resort. */
export function autoFitOnePage(): boolean {
  const menu = currentMenu();
  if (!menu) return false;
  snapshot();
  const style = menu.style;
  style.sc = Number(style.sc) || 1;
  style.dn = Number(style.dn) || 1;
  const wrap = pagewrapEl();

  const test = (): ReturnType<typeof productionInfo> => {
    wrap.innerHTML = renderMenuHTML(menu, renderArgs(true));
    return productionInfo(wrap);
  };

  let info = test();
  let guard = 0;
  while ((info.over || info.footerCollision) && guard++ < 80) {
    if (style.dn > 0.78) style.dn = round2(style.dn - 0.02);
    else if (style.sc > 0.86) style.sc = round2(style.sc - 0.01);
    else break;
    info = test();
  }

  commit(['editor', 'preview', 'rail']);
  return !(info.over || info.footerCollision);
}

/* ================= print / export DOM preflight ================= */

export interface PrintPreflight {
  ok: boolean;
  paper: 'A4' | 'A5';
  reason?: 'missing-print-root' | 'fonts' | 'images' | 'footer' | 'overflow';
  /** Canonical unscaled production measurement. Export UI must use this, never its scaled canvas. */
  info?: ProductionInfo;
}

async function waitForFonts(timeoutMs = 2500): Promise<boolean> {
  if (!document.fonts) return true;
  if (document.fonts.status === 'loaded') return true;
  const settled = await Promise.race([
    document.fonts.ready.then(() => document.fonts.status === 'loaded'),
    new Promise<false>((resolve) => window.setTimeout(() => resolve(false), timeoutMs)),
  ]);
  return settled;
}

async function waitForImages(root: HTMLElement, timeoutMs = 2500): Promise<boolean> {
  const images = Array.from(root.querySelectorAll('img'));
  if (!images.length) return true;
  const settled = await Promise.race([
    Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve(img.naturalWidth > 0);
        return new Promise<boolean>((resolve) => {
          img.addEventListener('load', () => resolve(img.naturalWidth > 0), { once: true });
          img.addEventListener('error', () => resolve(false), { once: true });
        });
      }),
    ).then((result) => result.every(Boolean)),
    new Promise<false>((resolve) => window.setTimeout(() => resolve(false), timeoutMs)),
  ]);
  return settled;
}

/** Preflight the exact export DOM (#printRoot) before the shell asks Electron to print. */
export async function preparePrintDOM(): Promise<PrintPreflight> {
  const menu = currentMenu();
  const paper: 'A4' | 'A5' = menu.style.paper === 'A5' ? 'A5' : 'A4';
  const printRoot = document.getElementById('printRoot');
  if (!printRoot) return { ok: false, paper, reason: 'missing-print-root' };

  if (!(await waitForFonts())) return { ok: false, paper, reason: 'fonts' };

  printRoot.innerHTML = renderMenuHTML(menu, renderArgs(false));
  applyReleaseSettings();
  if (!(await waitForImages(printRoot))) {
    printRoot.innerHTML = '';
    return { ok: false, paper, reason: 'images' };
  }
  // #printRoot is display:none in normal view, so it has no layout box to
  // measure. Lay it out off-screen (real paper size, invisible) for an accurate
  // preflight, then restore. Without this the overflow check always reads zero
  // dimensions and falsely blocks export — even after Shrink to fit.
  printRoot.classList.add('measuring');
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const info = productionInfo(printRoot);
  printRoot.classList.remove('measuring');
  if (info.footerCollision) {
    printRoot.innerHTML = '';
    return { ok: false, paper, reason: 'footer', info };
  }
  if (info.over) {
    printRoot.innerHTML = '';
    return { ok: false, paper, reason: 'overflow', info };
  }

  let printStyle = document.getElementById('printPage') as HTMLStyleElement | null;
  if (!printStyle) {
    printStyle = document.createElement('style');
    printStyle.id = 'printPage';
    document.head.appendChild(printStyle);
  }
  printStyle.textContent = `@page{size:${paper === 'A5' ? '148mm 210mm' : '210mm 297mm'};margin:0}`;

  return { ok: true, paper, info };
}

/* ================= wiring ================= */

export function initPreview(): void {
  applyReleaseSettings();
  bindReleaseSettings(() => renderPreview());

  const wrap = pagewrapEl();
  wrap.addEventListener('focusin', onFocusIn);
  wrap.addEventListener('keydown', onKeyDown);
  wrap.addEventListener('focusout', onFocusOut);
  wrap.addEventListener('pointerdown', onPointerDownArrange);
  wrap.addEventListener('dblclick', onDblClickArrange);

  document.getElementById('btnMove')?.addEventListener('click', toggleMoveMode);

  // Zoom controls now live on the bottom zoom bar as command buttons
  // (data-cmd="zoom-in|zoom-out|fit-width|actual-size"). Keep the rulers in sync
  // as the preview is scrolled.
  document.getElementById('stageScroll')?.addEventListener('scroll', scheduleRulers, { passive: true });
  const zoomSlider = document.getElementById('zoomSlider') as HTMLInputElement | null;
  zoomSlider?.addEventListener('input', () => setZoom(Number(zoomSlider.value) / 100));
  // Ctrl/Cmd + wheel zooms the preview (Acrobat-style); plain wheel scrolls.
  document.getElementById('stageScroll')?.addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(getZoom() * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    },
    { passive: false },
  );
  window.addEventListener('resize', () => fitPage());
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      fitPage();
      scheduleOverflowCheck();
    });
  }

  document.getElementById('btnAutoFit')?.addEventListener('click', () => {
    const ok = autoFitOnePage();
    if (!ok) {
      window.alert(
        'This menu still needs a little editing to print cleanly on one page. Shorten a description, reduce a section, or move content to another menu.',
      );
    }
  });
  document.getElementById('btnResetFit')?.addEventListener('click', () => {
    snapshot();
    const style = currentMenu().style;
    style.sc = 1;
    style.dn = 1;
    commit(['editor', 'preview', 'rail']);
  });

  window.addEventListener('afterprint', () => {
    const printRoot = document.getElementById('printRoot');
    if (printRoot) printRoot.innerHTML = '';
  });

  // Initial paint so the preview shows something as soon as the shell calls
  // initPreview(), regardless of whether it also subscribes renderPreview to
  // the store's 'preview' scope (on('preview', renderPreview)).
  renderPreview();
}
