// Live-preview layout runtime: zoom, one-page fit measurement, overflow
// detection, and the "print & layout" release settings (the six sliders).
// Ported faithfully from the mockup's release-hardening layer
// (reference/griffin-menu-studio.html) — the OVERRIDDEN versions of
// applyZoom/fitPage/overflowInfo/checkOverflow/scheduleOverflowCheck that
// supersede the earlier ones in that file. DOM-touching but state-light: the
// only mutable module state here is the zoom/follow-fit trio, mirrored 1:1
// from the mockup's globals.
//
// This module intentionally does not import from views/preview.ts (no
// circular dependency) — callers that need a re-render after a settings
// change pass one in (see bindReleaseSettings).

import type { ReleaseSettings } from '@shared/types';
import { footerCollision, pageOverflow } from '@shared/layout-math';
import { getState, persist } from './store';

/* ================= zoom ================= */
// Mirrors the mockup's `baseZoom`, `zoom`, `followFit` module-level state.

let baseZoom = 1;
let zoom = 1;
let followFit = true;

export function getZoom(): number {
  return zoom;
}

export function getFollowFit(): boolean {
  return followFit;
}

export function setFollowFit(value: boolean): void {
  followFit = value;
}

/** Pure zoom: measure the untransformed paper box once, only scale the wrapper. */
export function applyZoom(): void {
  const wrap = document.getElementById('pagewrap');
  const page = wrap?.querySelector<HTMLElement>('.page');
  if (!wrap || !page) return;
  zoom = Math.max(0.2, Math.min(3, zoom));
  const pw = page.offsetWidth;
  const ph = page.offsetHeight;
  wrap.style.transform = `scale(${zoom})`;
  wrap.style.width = `${pw * zoom}px`;
  wrap.style.height = `${ph * zoom}px`;
  const label = document.getElementById('scReset');
  if (label) label.textContent = `${Math.round(zoom * 100)}%`;
}

export function fitPage(): void {
  const wrap = document.getElementById('pagewrap');
  const page = wrap?.querySelector<HTMLElement>('.page');
  const stageScroll = document.getElementById('stageScroll');
  if (!page || !stageScroll) return;
  const availW = Math.max(1, stageScroll.clientWidth - 40);
  const pw = page.offsetWidth;
  if (pw < 10) return;
  baseZoom = Math.min(availW / pw, 1.6);
  if (followFit) zoom = baseZoom;
  applyZoom();
}

export function setZoom(z: number): void {
  followFit = false;
  zoom = z;
  applyZoom();
}

/* ================= overflow / fixed-paper measurement ================= */
// Independent of visual zoom and browser zoom — measures the untransformed
// paper box directly, so it works identically for #pagewrap (live, scaled)
// and #printRoot (export preflight, unscaled).

export interface ProductionInfo {
  over: boolean;
  footerCollision: boolean;
  pages: number;
  used: number;
  limit: number;
  spare: number;
}

const EMPTY_INFO: ProductionInfo = { over: false, footerCollision: false, pages: 1, used: 0, limit: 0, spare: 0 };

export function productionInfo(root?: HTMLElement | null): ProductionInfo {
  const scope = root ?? document.getElementById('pagewrap');
  const page = scope?.querySelector<HTMLElement>('.page');
  const inner = scope?.querySelector<HTMLElement>('.inner');
  const body = scope?.querySelector<HTMLElement>('.body');
  const foot = scope?.querySelector<HTMLElement>('.print-footer-zone');
  if (!page || !inner || !body || !foot) return EMPTY_INFO;

  const ir = inner.getBoundingClientRect();
  const br = body.getBoundingClientRect();
  const fr = foot.getBoundingClientRect();
  const cs = getComputedStyle(inner);
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const blockBottoms = Array.from(body.querySelectorAll<HTMLElement>('.mblk')).map(
    (el) => el.getBoundingClientRect().bottom,
  );
  const contentBottom = Math.max(br.bottom, ...blockBottoms);
  const footerTop = fr.top;
  const physicalBottom = ir.bottom - padBottom;

  const collision = footerCollision(contentBottom, footerTop);
  const over =
    pageOverflow({ contentBottom, footerBottom: fr.bottom, pageBottom: physicalBottom }) ||
    inner.scrollHeight > inner.clientHeight + 1;

  const used = Math.max(fr.bottom - ir.top, contentBottom - ir.top);
  const limit = physicalBottom - ir.top;
  return {
    over,
    footerCollision: collision,
    pages: over ? Math.max(2, Math.ceil(used / Math.max(1, limit))) : 1,
    used,
    limit,
    spare: limit - used,
  };
}

/** Legacy alias kept for readability at call sites that measure the live preview. */
export function overflowInfo(): ProductionInfo {
  return productionInfo(document.getElementById('pagewrap'));
}

export function checkOverflow(): boolean {
  const info = productionInfo(document.getElementById('pagewrap'));
  const chip = document.getElementById('warnChip');
  const warnText = document.getElementById('warnText');
  chip?.classList.toggle('show', info.over || info.footerCollision);
  chip?.classList.toggle('warn-footer', info.footerCollision);
  chip?.classList.toggle('warn-overflow', info.over && !info.footerCollision);
  if (warnText) {
    warnText.textContent = info.footerCollision
      ? 'Text reaches the footer'
      : info.over
        ? 'Does not fit on one page'
        : 'Fits on one page';
  }
  return info.over || info.footerCollision;
}

let overflowTimer = 0;
/** Keep status accurate after live edits without repeated heavy timers. */
export function scheduleOverflowCheck(): void {
  window.clearTimeout(overflowTimer);
  requestAnimationFrame(() => requestAnimationFrame(() => checkOverflow()));
  overflowTimer = window.setTimeout(() => checkOverflow(), 180);
}

const releaseObserver = new ResizeObserver(() => scheduleOverflowCheck());
/** Re-observe the current `.page` element — it is replaced wholesale on every render. */
export function observePagewrapPage(): void {
  releaseObserver.disconnect();
  const page = document.querySelector<HTMLElement>('#pagewrap .page');
  if (page) releaseObserver.observe(page);
}

/* ================= release settings (print & layout sliders) ================= */

export const RELEASE_DEFAULTS: ReleaseSettings = {
  sectionGap: 100,
  dishGap: 100,
  innerRule: 34,
  edgeRule: 94,
  footerGap: 100,
  colDivider: 86,
};

/** Reads (and lazily initialises) `settings.layout`, filling in any missing keys. */
export function releaseSettings(): ReleaseSettings {
  const settings = getState().settings;
  settings.layout = { ...RELEASE_DEFAULTS, ...(settings.layout ?? {}) };
  return settings.layout;
}

export function applyReleaseSettings(): void {
  const x = releaseSettings();
  const root = document.documentElement.style;
  root.setProperty('--section-gap-scale', String(x.sectionGap / 100));
  root.setProperty('--dish-gap-scale', String(x.dishGap / 100));
  root.setProperty('--inner-rule-width', `${x.innerRule}%`);
  root.setProperty('--edge-rule-width', `${x.edgeRule}%`);
  root.setProperty('--footer-gap-scale', String(x.footerGap / 100));
  root.setProperty('--col-divider-length', `${x.colDivider}%`);
}

interface SliderDef {
  inputId: string;
  outputId: string;
  key: keyof ReleaseSettings;
  format: (v: number) => string;
}

const pct = (v: number): string => `${v}%`;

const SLIDER_DEFS: SliderDef[] = [
  { inputId: 'setSectionGap', outputId: 'outSectionGap', key: 'sectionGap', format: pct },
  { inputId: 'setDishGap', outputId: 'outDishGap', key: 'dishGap', format: pct },
  { inputId: 'setInnerRule', outputId: 'outInnerRule', key: 'innerRule', format: pct },
  { inputId: 'setEdgeRule', outputId: 'outEdgeRule', key: 'edgeRule', format: pct },
  { inputId: 'setFooterGap', outputId: 'outFooterGap', key: 'footerGap', format: pct },
  { inputId: 'setColDivider', outputId: 'outColDivider', key: 'colDivider', format: pct },
];

/**
 * Wires the six print & layout sliders plus "Reset layout defaults".
 * `rerender` is called after every value change so the caller decides how the
 * preview refreshes (kept decoupled from views/preview.ts to avoid a circular
 * import — see module header).
 */
export function bindReleaseSettings(rerender: () => void): void {
  const refresh = (): void => {
    const x = releaseSettings();
    for (const { inputId, outputId, key, format } of SLIDER_DEFS) {
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      const output = document.getElementById(outputId) as HTMLOutputElement | null;
      if (input) input.value = String(x[key]);
      if (output) output.textContent = format(x[key]);
    }
  };

  for (const { inputId, outputId, key, format } of SLIDER_DEFS) {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) continue;
    const output = document.getElementById(outputId) as HTMLOutputElement | null;
    input.addEventListener('input', () => {
      const x = releaseSettings();
      x[key] = Number(input.value);
      if (output) output.textContent = format(x[key]);
      applyReleaseSettings();
      rerender();
    });
    input.addEventListener('change', () => persist());
  }

  const reset = document.getElementById('btnResetLayoutSettings');
  reset?.addEventListener('click', () => {
    getState().settings.layout = { ...RELEASE_DEFAULTS };
    applyReleaseSettings();
    refresh();
    persist();
    rerender();
  });

  refresh();
}
