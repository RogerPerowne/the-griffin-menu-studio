// Live-preview layout runtime: zoom, one-page fit measurement, overflow
// detection, and the "print & layout" release settings (the six sliders).
// Ported faithfully from the mockup's release-hardening layer
// (reference/griffin-menu-studio.html) — the OVERRIDDEN versions of
// applyZoom/fitPage/overflowInfo/checkOverflow/scheduleOverflowCheck that
// supersede the earlier ones in that file. DOM-touching but state-light: the
// only mutable state here is the zoom/baseZoom/follow-fit/ruler-raf quartet
// per StageTarget, mirrored 1:1 from the mockup's globals (see EDITOR_STAGE).
//
// This module intentionally does not import from views/preview.ts (no
// circular dependency) — callers that need a re-render after a settings
// change pass one in (see bindReleaseSettings).

import type { Menu, ReleaseSettings } from '@shared/types';
import { footerCollision, pageOverflow } from '@shared/layout-math';
import { currentMenu, getState, persist } from './store';

/* ================= zoom ================= */
// Mirrors the mockup's `baseZoom`, `zoom`, `followFit` module-level state —
// now generalised to a `StageTarget` so the same apparatus can drive more
// than one preview stage (the editor's live preview AND, for #15, the
// Export workspace's preview) without the two stages fighting over one
// shared zoom level.

/** A DOM/id contract plus per-stage mutable zoom state for one preview stage. */
export interface StageTarget {
  readonly pagewrapId: string;
  readonly scrollId: string;
  readonly rulerTopId: string;
  readonly rulerRightId: string;
  readonly zoomLabelId: string;
  readonly zoomSliderId: string;
  baseZoom: number;
  zoom: number;
  followFit: boolean;
  rulerRaf: number;
}

function makeStageTarget(
  ids: Pick<StageTarget, 'pagewrapId' | 'scrollId' | 'rulerTopId' | 'rulerRightId' | 'zoomLabelId' | 'zoomSliderId'>,
): StageTarget {
  return { ...ids, baseZoom: 1, zoom: 1, followFit: true, rulerRaf: 0 };
}

/** The editor's live preview stage — the default target for every function below. */
export const EDITOR_STAGE: StageTarget = makeStageTarget({
  pagewrapId: 'pagewrap',
  scrollId: 'stageScroll',
  rulerTopId: 'rulerTop',
  rulerRightId: 'rulerRight',
  zoomLabelId: 'zoomPct',
  zoomSliderId: 'zoomSlider',
});

/** The Export workspace's preview stage (see #15) — same apparatus, different DOM ids. */
export const EXPORT_STAGE: StageTarget = makeStageTarget({
  pagewrapId: 'exportPagewrap',
  scrollId: 'exportStageScroll',
  rulerTopId: 'exportRulerTop',
  rulerRightId: 'exportRulerRight',
  zoomLabelId: 'exportZoomPct',
  zoomSliderId: 'exportZoomSlider',
});

/** The Booklet workspace's landscape preview stage — same zoom/fit/ruler
 *  apparatus, its own DOM ids. The landscape `.sheet` (which also carries the
 *  `.page` class) makes `fitPage`/`renderRulers` size it as a 29.7×21 sheet
 *  through the `.sheet` branch that already exists in `renderRulers`. */
export const BOOKLET_STAGE: StageTarget = makeStageTarget({
  pagewrapId: 'bookletPagewrap',
  scrollId: 'bookletStageScroll',
  rulerTopId: 'bookletRulerTop',
  rulerRightId: 'bookletRulerRight',
  zoomLabelId: 'bookletZoomPct',
  zoomSliderId: 'bookletZoomSlider',
});

export function getZoom(target: StageTarget = EDITOR_STAGE): number {
  return target.zoom;
}

export function getFollowFit(target: StageTarget = EDITOR_STAGE): boolean {
  return target.followFit;
}

export function setFollowFit(value: boolean, target: StageTarget = EDITOR_STAGE): void {
  target.followFit = value;
}

/**
 * Zoom the preview with a SINGLE scaling operation: transform the page itself
 * and size an untransformed wrapper to the scaled dimensions. This makes the
 * scroll footprint exactly match the visible page (previously the wrapper was
 * both sized to the scaled box AND transformed, doubling the footprint).
 */
export function applyZoom(target: StageTarget = EDITOR_STAGE): void {
  const wrap = document.getElementById(target.pagewrapId);
  const page = wrap?.querySelector<HTMLElement>('.page');
  if (!wrap || !page) return;
  target.zoom = Math.max(0.2, Math.min(3, target.zoom));
  const pw = page.offsetWidth;
  const ph = page.offsetHeight;
  wrap.style.transform = 'none';
  page.style.transformOrigin = 'top left';
  page.style.transform = `scale(${target.zoom})`;
  wrap.style.width = `${pw * target.zoom}px`;
  wrap.style.height = `${ph * target.zoom}px`;
  const label = document.getElementById(target.zoomLabelId);
  if (label) label.textContent = `${Math.round(target.zoom * 100)}%`;
  const slider = document.getElementById(target.zoomSliderId) as HTMLInputElement | null;
  if (slider && document.activeElement !== slider) slider.value = String(Math.round(target.zoom * 100));
  renderRulers(target);
}

/**
 * Draw the top + right preview rulers on their canvases, Word/Acrobat style:
 * cm ticks with numbers every 2 cm, spanning ONLY the page extent, with the 0
 * mark pinned to the page's top-left edge (so they track zoom + scroll). Tick
 * spacing is derived from the ACTUAL rendered page rect, correct at any zoom/DPI.
 */
export function renderRulers(target: StageTarget = EDITOR_STAGE): void {
  const scroll = document.getElementById(target.scrollId);
  const page = document.querySelector<HTMLElement>(`#${target.pagewrapId} .page`);
  const top = document.getElementById(target.rulerTopId) as HTMLCanvasElement | null;
  const right = document.getElementById(target.rulerRightId) as HTMLCanvasElement | null;
  if (!scroll || !page || !top || !right) return;
  const pr = page.getBoundingClientRect();
  if (pr.width < 1) return;
  const a5 = page.classList.contains('A5');
  // A booklet sheet (.sheet) is a landscape A4 (29.7 × 21cm); it also carries
  // the `.page` class, so branch on `.sheet` before the portrait A4/A5 sizes.
  const landscape = page.classList.contains('sheet');
  // Anchor each ruler's 0-origin to its OWN canvas rect (not the scroll's),
  // so ticks track the page edge regardless of grid/scrollbar offsets and at
  // every zoom level (pr is the live transformed rect).
  const topRect = top.getBoundingClientRect();
  const rightRect = right.getBoundingClientRect();
  drawRuler(top, 'x', pr.width, pr.left - topRect.left, landscape ? 29.7 : a5 ? 14.8 : 21);
  drawRuler(right, 'y', pr.height, pr.top - rightRect.top, landscape ? 21 : a5 ? 21 : 29.7);
}

/** Coalesce high-frequency ruler redraws (e.g. trackpad scroll) into one frame. */
export function scheduleRulers(target: StageTarget = EDITOR_STAGE): void {
  if (target.rulerRaf) return;
  target.rulerRaf = requestAnimationFrame(() => {
    target.rulerRaf = 0;
    renderRulers(target);
  });
}

function drawRuler(canvas: HTMLCanvasElement, axis: 'x' | 'y', pageLenPx: number, pageStartPx: number, lenCm: number): void {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW < 1 || cssH < 1) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);
  const thickness = axis === 'x' ? cssH : cssW;
  const along = axis === 'x' ? cssW : cssH;
  const pxPerCm = pageLenPx / lenCm;
  // Shade the off-page region so the page extent reads clearly on the ruler (Word style).
  const pageEndPx = pageStartPx + pageLenPx;
  ctx.fillStyle = 'rgba(60,54,46,.08)';
  if (pageStartPx > 0) axis === 'x' ? ctx.fillRect(0, 0, pageStartPx, cssH) : ctx.fillRect(0, 0, cssW, pageStartPx);
  if (pageEndPx < along) axis === 'x' ? ctx.fillRect(pageEndPx, 0, cssW - pageEndPx, cssH) : ctx.fillRect(0, pageEndPx, cssW, cssH - pageEndPx);
  ctx.strokeStyle = 'rgba(60,54,46,.5)';
  ctx.fillStyle = 'rgba(60,54,46,.85)';
  ctx.lineWidth = 1;
  ctx.font = '9px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';
  for (let cm = 0; cm <= Math.round(lenCm); cm += 1) {
    const pos = Math.round(pageStartPx + cm * pxPerCm) + 0.5; // crisp 1px line
    if (pos < -1 || pos > along + 1) continue; // only where the page is + on-screen
    const major = cm % 2 === 0;
    const tick = major ? thickness * 0.6 : thickness * 0.34;
    ctx.beginPath();
    if (axis === 'x') { ctx.moveTo(pos, cssH); ctx.lineTo(pos, cssH - tick); }
    else { ctx.moveTo(cssW, pos); ctx.lineTo(cssW - tick, pos); }
    ctx.stroke();
    if (major && cm > 0 && cm < lenCm) {
      if (axis === 'x') { ctx.textAlign = 'center'; ctx.fillText(String(cm), pos, cssH * 0.34); }
      else {
        ctx.save();
        ctx.translate(cssW * 0.36, pos);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(String(cm), 0, 0);
        ctx.restore();
      }
    }
  }
}

export function fitPage(target: StageTarget = EDITOR_STAGE): void {
  const wrap = document.getElementById(target.pagewrapId);
  const page = wrap?.querySelector<HTMLElement>('.page');
  const stageScroll = document.getElementById(target.scrollId);
  if (!page || !stageScroll) return;
  const cs = getComputedStyle(stageScroll);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const availW = Math.max(1, stageScroll.clientWidth - padX);
  const pw = page.offsetWidth;
  if (pw < 10) return;
  target.baseZoom = Math.min(availW / pw, 1.6);
  if (target.followFit) target.zoom = target.baseZoom;
  applyZoom(target);
}

export function setZoom(z: number, target: StageTarget = EDITOR_STAGE): void {
  target.followFit = false;
  target.zoom = z;
  applyZoom(target);
}

/**
 * "Fit page" — scale so the WHOLE page sits neatly in the viewport (both width
 * and height), with the same comfortable padding fit-width uses. Portrait pages
 * end up height-constrained; a landscape booklet sheet ends up width-constrained
 * — the min of the two ratios handles either automatically.
 */
export function fitWholePage(target: StageTarget = EDITOR_STAGE): void {
  const wrap = document.getElementById(target.pagewrapId);
  const page = wrap?.querySelector<HTMLElement>('.page');
  const stageScroll = document.getElementById(target.scrollId);
  if (!page || !stageScroll) return;
  const cs = getComputedStyle(stageScroll);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const availW = Math.max(1, stageScroll.clientWidth - padX);
  const availH = Math.max(1, stageScroll.clientHeight - padY);
  const pw = page.offsetWidth;
  const ph = page.offsetHeight;
  if (pw < 10 || ph < 10) return;
  target.followFit = false; // a discrete fit, like the old Actual Size
  target.zoom = Math.min(availW / pw, availH / ph, 1.6);
  applyZoom(target);
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

/** Actual render scale of a page element (rendered width ÷ unscaled layout width). */
function pageInnerScale(page: HTMLElement): number {
  const w = page.offsetWidth;
  if (!w) return 1;
  return page.getBoundingClientRect().width / w;
}

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
  // Every rect above is in *rendered* (transform-scaled) pixels, but computed
  // padding is in unscaled CSS px. Scale the padding by the page's actual render
  // scale so all operands share one coordinate system — this makes the overflow
  // decision zoom-invariant and identical for the scaled live preview (#pagewrap)
  // and the unscaled export page (#printRoot), which keeps editor + export in sync.
  const renderScale = pageInnerScale(page);
  const padBottom = (parseFloat(cs.paddingBottom) || 0) * renderScale;
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

// checkOverflow() needs the canonical print-mode "does it fit" measurement
// (measureFit, views/preview.ts) so the editor chip can never disagree with
// the export preflight (see #6 / P2) — but this module intentionally doesn't
// import from views/preview.ts (see header comment). preview.ts registers its
// measureFit here instead, mirroring the callback pattern bindReleaseSettings
// already uses to stay decoupled.
type FitMeasurer = (menu: Menu) => ProductionInfo;
let fitMeasurer: FitMeasurer | null = null;

/** Registered once by views/preview.ts (initPreview) with its canonical measureFit(). */
export function setFitMeasurer(fn: FitMeasurer): void {
  fitMeasurer = fn;
}

// The overflow warning is overridable: the user can dismiss it to keep an
// intentionally-oversized menu. The override resets automatically when they
// switch menus or once the menu fits again (so a later overflow re-warns).
let warnDismissed = false;
let warnMenuId: string | null = null;

/** Dismiss the current overflow warning until the menu changes or fits again. */
export function dismissOverflowWarning(): void {
  warnDismissed = true;
  document.getElementById('warnChip')?.classList.remove('show');
}

export function checkOverflow(): boolean {
  const menu = currentMenu();
  const info = fitMeasurer && menu ? fitMeasurer(menu) : productionInfo(document.getElementById('pagewrap'));
  const overflowing = info.over || info.footerCollision;

  // Reset the override when the open menu changes, or whenever it fits again.
  if (menu && menu.id !== warnMenuId) {
    warnMenuId = menu.id;
    warnDismissed = false;
  }
  if (!overflowing) warnDismissed = false;

  const show = overflowing && !warnDismissed;
  const chip = document.getElementById('warnChip');
  const warnText = document.getElementById('warnText');
  chip?.classList.toggle('show', show);
  chip?.classList.toggle('warn-footer', info.footerCollision);
  chip?.classList.toggle('warn-overflow', info.over && !info.footerCollision);
  if (warnText) {
    warnText.textContent = info.footerCollision
      ? 'Text reaches the footer'
      : info.over
        ? 'Does not fit on one page'
        : 'Fits on one page';
  }
  return overflowing;
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
