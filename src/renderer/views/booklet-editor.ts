// Booklet authoring view (docs/plan-booklet-system.md §7). Owns the whole
// `#bookletWorkspace`: a tabbed editor for the four logical panels (Cover /
// Inside / Back) plus a landscape preview stage with a "flip" control (outer ⇄
// inner sheet) and a fold hint. It is the booklet analogue of views/editor.ts +
// views/preview.ts, but self-contained: it never touches the menu store, only
// the booklet-session module.
//
// The Inside tab reuses the REAL menu editor (views/editor.ts) — the same
// `<section class="editor">` node the menu workspace uses — bound to the active
// inside Menu through the edit-target seam (edit-target.ts). Full parity: tags,
// columns, dietary key, divider rules and free-drag arrange all work on the
// inside menu. In two-menu mode a Left/Right sub-toggle picks which inside menu
// the editor targets. The old simplified inside editor has been removed.

import type { Booklet, BookletPanel, HeaderStyle, Menu } from '@shared/types';
import { newBooklet, newMenu } from '@shared/menu/factories';
import { renderBookletHTML, renderBookletPages, type SheetSide } from '@shared/menu/booklet';
import { mountBookletFlip, type BookletFlipHandle } from './booklet-flip';
import { getActiveBrand } from '@shared/brand';
import { assetUrl } from '../brand-assets';
import { escapeHtml as esc } from '../util/escape';
import { getState } from '../store';
import type { Scope } from '../store';
import { getEditTarget, resetEditTarget, setEditTarget, type EditTarget } from '../edit-target';
import { renderEditor, cancelDebouncedCommit } from './editor';
import { refreshDocks } from '../panels/dock-render';
import { toast } from '../ui/toast';
import {
  BOOKLET_STAGE,
  applyReleaseSettings,
  fitPage,
  fitWholePage,
  getZoom,
  scheduleRulers,
  setFollowFit,
  setZoom,
} from '../layout-runtime';
import {
  closeBooklet,
  commitBooklet,
  flipSide,
  getBooklet,
  getBookletFilePath,
  getSide,
  isBookletDirty,
  isBookletMode,
  markBookletSaved,
  onBookletChange,
  openBooklet,
  requireBooklet,
  setBookletFilePath,
  setDirty,
  snapshotBooklet,
} from '../booklet-session';

const brand = getActiveBrand();
const ASSETS = { crest: assetUrl(brand.assetKeys.crest), lockup: assetUrl(brand.assetKeys.lockup) };

type Tab = 'cover' | 'inside' | 'back';
let activeTab: Tab = 'cover';
/** Which inside menu the reused editor targets while in two-menu mode. */
let insideSide: 'left' | 'right' = 'left';

/* ================= inside menu ↔ real editor seam ================= */

/** The inside Menu the editor should edit, given the booklet + current side. */
function activeInsideMenu(booklet: Booklet): Menu {
  const inside = booklet.inside;
  if (inside.mode === 'single') return inside.menu;
  return insideSide === 'right' ? inside.right : inside.left;
}

/** Edit target that binds the real editor to the active inside menu and routes
 *  its commits/snapshots through the booklet session instead of the store. */
const insideTarget: EditTarget = {
  menu: () => activeInsideMenu(requireBooklet()),
  snapshot: () => snapshotBooklet(),
  commit: (scopes?: Scope[]) => {
    setDirty();
    refreshDirtyChip();
    renderBookletPreviewOnly();
    // A structural edit asks for the 'editor' scope — re-render the editor body
    // (the store never fires here, so we drive renderEditor directly). Text-field
    // edits ask only for preview/rail, so the focused input survives.
    if (!scopes || scopes.includes('editor') || scopes.includes('all')) renderEditor();
  },
  persist: () => {
    setDirty();
    refreshDirtyChip();
  },
};

/** Park the real editor node back in its hidden home and drop the inside target.
 *  Called before wiping the booklet workspace DOM (so the node + its listeners
 *  survive) and when leaving booklet mode (so menu editing targets the store). */
function parkEditor(): void {
  cancelDebouncedCommit(); // don't let a pending keystroke commit fire post-switch
  if (getEditTarget() === insideTarget) resetEditTarget();
  const editor = document.querySelector<HTMLElement>('.editor');
  const home = document.getElementById('panelHome');
  if (editor && home && editor.parentElement !== home) home.appendChild(editor);
}

/** Mount the real editor into the Inside tab, bound to the active inside menu. */
function mountInsideEditor(): void {
  const host = document.getElementById('bkInsideHost');
  const editor = document.querySelector<HTMLElement>('.editor');
  if (!host || !editor) return;
  cancelDebouncedCommit(); // flush pending store commit before re-targeting
  setEditTarget(insideTarget);
  host.appendChild(editor);
  renderEditor();
}

/** Leaving booklet mode: reset to the store target, re-render the editor with the
 *  store's current menu, then refresh the docks so the Edit Menu panel re-adopts
 *  the editor node into its dock cell (parkEditor only returns it to #panelHome). */
function restoreMenuEditorToDock(): void {
  parkEditor();
  renderEditor();
  refreshDocks();
}

/* ================= render helpers ================= */

/** Shared render options for renderBookletHTML — mirrors preview.ts's renderArgs. */
function renderOpts(side: SheetSide) {
  return {
    side,
    edit: false,
    dietKey: getState().settings.dietKey,
    assets: ASSETS,
    fontSet: getState().settings.typography?.fontSet,
    // A booklet panel `image` is a brand-asset id; resolve best-effort (an unknown
    // id resolves to '' and the image is simply omitted by the renderer).
    resolveImage: (id: string): string => assetUrl(id),
  };
}

function panelFields(role: 'cover' | 'back', panel: BookletPanel): string {
  const label = role === 'cover' ? 'Front cover' : 'Back cover';
  const headerOpt = (v: HeaderStyle, l: string): string =>
    `<option value="${v}" ${panel.header === v ? 'selected' : ''}>${l}</option>`;
  return `<div class="bk-panel-form" data-panel="${role}">
    <h2>${label}</h2>
    <label>Title <input data-bk-field="title" value="${esc(panel.title)}" placeholder="e.g. The Griffin"></label>
    <label>Subtitle <input data-bk-field="subtitle" value="${esc(panel.subtitle)}" placeholder="e.g. Winter Menu"></label>
    <label>Note <textarea data-bk-field="note" placeholder="Small print, address, opening hours…">${esc(panel.note)}</textarea></label>
    <label>Header style <select data-bk-field="header">${headerOpt('title', 'Title only')}${headerOpt('crest', 'Crest + title')}${headerOpt('lockup', 'Full lockup')}</select></label>
    <label>Image (brand asset id) <input data-bk-field="image" value="${esc(panel.image)}" placeholder="e.g. griffin/crest"></label>
  </div>`;
}

function insideForm(booklet: Booklet): string {
  const inside = booklet.inside;
  const modeBtn = (mode: 'single' | 'two', l: string): string =>
    `<button type="button" class="bk-seg ${inside.mode === mode ? 'on' : ''}" data-bk-mode="${mode}">${l}</button>`;
  let controls: string;
  if (inside.mode === 'single') {
    controls = `<label class="bk-check"><input type="checkbox" data-bk-two-pages ${inside.allowTwoPages ? 'checked' : ''}> Allow the inside menu to run onto the second inside page</label>`;
  } else {
    const sideBtn = (side: 'left' | 'right', l: string): string =>
      `<button type="button" class="bk-seg ${insideSide === side ? 'on' : ''}" data-bk-inside-side="${side}">${l}</button>`;
    controls = `<div class="bk-seg-row" role="group" aria-label="Which inside menu to edit">
      <span>Editing</span>${sideBtn('left', 'Inside left')}${sideBtn('right', 'Inside right')}
    </div>`;
  }
  // #bkInsideHost receives the REAL editor node (mounted by mountInsideEditor
  // after this HTML is written); its contents here are only a fallback.
  return `<div class="bk-panel-form" data-panel="inside">
    <h2>Inside</h2>
    <div class="bk-seg-row" role="group" aria-label="Inside layout">
      <span>Inside is</span>${modeBtn('single', 'One menu')}${modeBtn('two', 'Two menus')}
    </div>
    ${controls}
    <div class="bk-inside-host" id="bkInsideHost"></div>
  </div>`;
}

function tabButton(tab: Tab, label: string): string {
  return `<button class="bk-tab ${activeTab === tab ? 'on' : ''}" data-bk-tab="${tab}"${activeTab === tab ? ' aria-current="page"' : ''}>${label}</button>`;
}

function foldHint(side: SheetSide): string {
  return side === 'outer'
    ? 'Outer sheet — back cover (left) · front cover (right). This side folds to the outside; the back reads upright once folded.'
    : 'Inner sheet — inside-left · inside-right. This side folds to the inside.';
}

function activeForm(booklet: Booklet): string {
  if (activeTab === 'cover') return panelFields('cover', booklet.cover);
  if (activeTab === 'back') return panelFields('back', booklet.back);
  return insideForm(booklet);
}

/** Full render of the whole booklet workspace (controls + preview stage). */
export function renderBookletWorkspace(): void {
  const root = document.getElementById('bookletWorkspace');
  const booklet = getBooklet();
  if (!root || !booklet) return;
  // The reader's DOM is inside `root` and about to be wiped — drop the stale handle.
  readerHandle?.destroy();
  readerHandle = null;
  // Move the real editor node to safety BEFORE replacing root's HTML, so its
  // listeners survive; it is re-mounted below when the Inside tab is active.
  parkEditor();
  const side = getSide();

  root.innerHTML = `<div class="bk-room">
    <aside class="bk-side">
      <div class="bk-doc-head">
        <input class="bk-title" id="bkName" value="${esc(booklet.name)}" placeholder="Booklet name">
        <span class="bk-dirty" id="bkDirty">${isBookletDirty() ? 'Unsaved changes' : 'Saved'}</span>
      </div>
      <div class="bk-tabs" role="tablist">
        ${tabButton('cover', 'Cover')}
        ${tabButton('inside', 'Inside')}
        ${tabButton('back', 'Back')}
      </div>
      <div class="bk-form-scroll" id="bkForm">${activeForm(booklet)}</div>
      <div class="bk-actions">
        <button class="abtn" data-bk-act="close">Close booklet</button>
        <button class="abtn" data-bk-act="save-as">Save As…</button>
        <button class="abtn primary" data-bk-act="save">Save</button>
      </div>
    </aside>
    <section class="bk-stage">
      <header class="bk-stage-bar">
        <div class="bk-flip" role="group" aria-label="Sheet side">
          <button class="bk-seg ${side === 'outer' ? 'on' : ''}" data-bk-side="outer">Outer (cover)</button>
          <button class="bk-seg ${side === 'inner' ? 'on' : ''}" data-bk-side="inner">Inner (pages)</button>
        </div>
        <button class="bk-seg bk-read-btn" data-bk-read title="Flip through the pages like a real folded booklet"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 6c-2-1.5-5-1.5-7 0v12c2-1.5 5-1.5 7 0m0-12c2-1.5 5-1.5 7 0v12c-2-1.5-5-1.5-7 0m0-12v12"/></svg>Read</button>
        <div class="bk-focus" role="group" aria-label="Centre the zoom on a page" title="When zoomed in, centre on the left or right page">
          <button class="bk-seg" data-bk-focus="left" aria-label="Centre left page">◧</button>
          <button class="bk-seg" data-bk-focus="right" aria-label="Centre right page">◨</button>
        </div>
        <span class="bk-fold-hint">${foldHint(side)}</span>
        <span class="sp"></span>
        <button class="abtn" data-bk-act="print">Print…</button>
        <button class="abtn primary" data-bk-act="export-pdf">Export PDF</button>
      </header>
      <div class="stage-body">
        <canvas class="ruler ruler-top" id="bookletRulerTop" aria-hidden="true"></canvas>
        <div class="ruler-corner" aria-hidden="true"></div>
        <div class="stage-scroll" id="bookletStageScroll"><div class="pagewrap" id="bookletPagewrap"></div></div>
        <div class="bk-reader" id="bookletReader" hidden></div>
        <canvas class="ruler ruler-right" id="bookletRulerRight" aria-hidden="true"></canvas>
      </div>
      <div class="stage-zoombar" role="toolbar" aria-label="Booklet preview zoom">
        <button class="zoomb icon bk-turn" data-bk-flip="prev" aria-label="Previous page" hidden><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <span class="bk-page-ind" id="bkPageInd" hidden></span>
        <button class="zoomb icon bk-turn" data-bk-flip="next" aria-label="Next page" hidden><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
        <button class="zoomb wide" data-bk-zoom="fit-width">Fit width</button>
        <button class="zoomb wide" data-bk-zoom="fit-page">Fit page</button>
        <span class="sp"></span>
        <button class="zoomb icon" data-bk-zoom="out" aria-label="Zoom out"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
        <input type="range" class="zoom-slider" id="bookletZoomSlider" min="20" max="300" step="1" value="100" aria-label="Zoom level">
        <button class="zoomb icon" data-bk-zoom="in" aria-label="Zoom in"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
        <button class="zoomb zoompct" id="bookletZoomPct" data-bk-zoom="actual-size">100%</button>
      </div>
    </section>
  </div>`;

  renderBookletPreviewOnly();
  bindBookletStage();
  if (activeTab === 'inside') mountInsideEditor();
}

/** Re-render only the landscape preview sheet + refit (used after live typing). */
function renderBookletPreviewOnly(): void {
  const wrap = document.getElementById('bookletPagewrap');
  const booklet = getBooklet();
  if (!wrap || !booklet) return;
  wrap.innerHTML = renderBookletHTML(booklet, renderOpts(getSide()));
  applyReleaseSettings();
  wrap.querySelectorAll('img').forEach((img) => {
    const image = img as HTMLImageElement;
    if (!image.complete) image.addEventListener('load', () => fitPage(BOOKLET_STAGE), { once: true });
  });
  fitPage(BOOKLET_STAGE);
  requestAnimationFrame(() => fitPage(BOOKLET_STAGE));
}

/** Update just the small "Saved / Unsaved changes" chip without a full re-render. */
function refreshDirtyChip(): void {
  const chip = document.getElementById('bkDirty');
  if (chip) chip.textContent = isBookletDirty() ? 'Unsaved changes' : 'Saved';
}

/* ================= live-typing commit (no full re-render) ================= */

let debounceTimer = 0;
/** Record a live keystroke: mark dirty, update the chip, and debounce a
 *  preview-only refresh — never re-render the editing controls, so the focused
 *  input survives (mirrors editor.ts's debPreview). */
function debPreview(): void {
  setDirty();
  refreshDirtyChip();
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => renderBookletPreviewOnly(), 160);
}

/* ================= page-flip reader ================= */

let readerHandle: BookletFlipHandle | null = null;
const PAGE_LABELS = ['Front cover', 'Inside left', 'Inside right', 'Back cover'];

function updatePageInd(i: number): void {
  const ind = document.getElementById('bkPageInd');
  if (ind) ind.textContent = `${i + 1}/4 · ${PAGE_LABELS[i] ?? ''}`;
}

/** Scale each fixed-mm A5 `.page` to fill its flip-reader cell. */
function fitReaderPages(): void {
  document.querySelectorAll<HTMLElement>('#bookletReader .bf-page').forEach((cell) => {
    const page = cell.querySelector<HTMLElement>('.page');
    if (!page) return;
    const cw = cell.clientWidth;
    const pw = page.offsetWidth;
    if (pw < 10 || cw < 10) return;
    page.style.transformOrigin = 'top left';
    page.style.transform = `scale(${cw / pw})`;
  });
}

function toggleReaderControls(on: boolean): void {
  document.querySelectorAll<HTMLElement>('[data-bk-flip], #bkPageInd').forEach((el) => (el.hidden = !on));
  document.querySelector<HTMLElement>('[data-bk-read]')?.classList.toggle('on', on);
}

function enterReader(): void {
  const booklet = getBooklet();
  const host = document.getElementById('bookletReader');
  const sheet = document.getElementById('bookletStageScroll');
  if (!booklet || !host || !sheet) return;
  sheet.hidden = true;
  host.hidden = false;
  readerHandle = mountBookletFlip(host, renderBookletPages(booklet, renderOpts(getSide())), { onChange: updatePageInd });
  applyReleaseSettings();
  toggleReaderControls(true);
  requestAnimationFrame(fitReaderPages);
  updatePageInd(readerHandle.index());
}

export function exitReader(): void {
  const host = document.getElementById('bookletReader');
  const sheet = document.getElementById('bookletStageScroll');
  readerHandle?.destroy();
  readerHandle = null;
  if (host) {
    host.hidden = true;
    host.innerHTML = '';
  }
  if (sheet) sheet.hidden = false;
  toggleReaderControls(false);
  fitPage(BOOKLET_STAGE);
}

function toggleReader(): void {
  if (readerHandle) exitReader();
  else enterReader();
}

/** Scroll the booklet sheet so the centre of its left (25%) or right (75%) page
 *  sits in the middle of the viewport — useful once zoomed past the window. */
function focusSheetHalf(half: 'left' | 'right'): void {
  const scroll = document.getElementById('bookletStageScroll');
  const page = document.querySelector<HTMLElement>('#bookletPagewrap .page');
  if (!scroll || !page) return;
  const pr = page.getBoundingClientRect();
  const sr = scroll.getBoundingClientRect();
  const pageLeftInScroll = pr.left - sr.left + scroll.scrollLeft;
  const targetX = pageLeftInScroll + pr.width * (half === 'left' ? 0.25 : 0.75);
  scroll.scrollTo({ left: targetX - scroll.clientWidth / 2, behavior: 'smooth' });
}

/* ================= stage wiring (zoom / rulers) ================= */

function bindBookletStage(): void {
  window.addEventListener('resize', () => {
    if (readerHandle) fitReaderPages();
  });
  const scroll = document.getElementById('bookletStageScroll');
  scroll?.addEventListener('scroll', () => scheduleRulers(BOOKLET_STAGE), { passive: true });
  scroll?.addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(getZoom(BOOKLET_STAGE) * (e.deltaY < 0 ? 1.1 : 1 / 1.1), BOOKLET_STAGE);
    },
    { passive: false },
  );
  const slider = document.getElementById('bookletZoomSlider') as HTMLInputElement | null;
  slider?.addEventListener('input', () => setZoom(Number(slider.value) / 100, BOOKLET_STAGE));
}

/* ================= workspace open / close ================= */

/** Show the booklet workspace (drives display via `#app[data-workspace="booklet"]`). */
export function openBookletWorkspace(): void {
  activeTab = 'cover';
  const app = document.getElementById('app');
  app?.setAttribute('data-workspace', 'booklet');
  // No modepill button represents booklet mode; clear the menu-workspace highlight.
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
    btn.classList.remove('on');
    btn.removeAttribute('aria-current');
  });
  renderBookletWorkspace();
  setFollowFit(true, BOOKLET_STAGE);
  requestAnimationFrame(() => fitPage(BOOKLET_STAGE));
}

/* ================= event delegation ================= */
// NOTE: the reused menu editor is mounted inside this workspace and has its OWN
// delegated listeners (on #edScroll + head controls). Its input/change/click
// events bubble up here too, but they carry `data-f` / `data-act` markers — not
// the `bkName` / `data-bk-*` markers these handlers key off — so they fall
// through untouched. Only the booklet's own controls are handled below.

function onFormInput(e: Event): void {
  const booklet = getBooklet();
  if (!booklet) return;
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.id === 'bkName') {
    booklet.name = (target as HTMLInputElement).value;
    setDirty();
    refreshDirtyChip();
    return;
  }

  const panelField = target.dataset.bkField;
  if (panelField && panelField !== 'header') {
    const panel = activeTab === 'back' ? booklet.back : booklet.cover;
    const value = (target as HTMLInputElement | HTMLTextAreaElement).value;
    (panel as unknown as Record<string, string>)[panelField] = value;
    debPreview();
  }
}

function onFormChange(e: Event): void {
  const booklet = getBooklet();
  if (!booklet) return;
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  // Selects / checkboxes commit immediately (structural-ish) — persist + preview.
  if ((target as HTMLElement).dataset.bkField === 'header') {
    const panel = activeTab === 'back' ? booklet.back : booklet.cover;
    snapshotBooklet();
    panel.header = (target as HTMLSelectElement).value as HeaderStyle;
    commitBooklet();
    return;
  }
  if ((target as HTMLElement).hasAttribute('data-bk-two-pages')) {
    const inside = booklet.inside;
    if (inside.mode === 'single') {
      snapshotBooklet();
      inside.allowTwoPages = (target as HTMLInputElement).checked;
      commitBooklet();
    }
  }
}

function onFormClick(e: Event): void {
  const booklet = getBooklet();
  if (!booklet) return;
  const target = e.target;
  if (!(target instanceof Element)) return;

  const tab = target.closest<HTMLElement>('[data-bk-tab]');
  if (tab?.dataset.bkTab) {
    activeTab = tab.dataset.bkTab as Tab;
    renderBookletWorkspace();
    return;
  }

  const sideBtn = target.closest<HTMLElement>('[data-bk-side]');
  if (sideBtn?.dataset.bkSide) {
    if (sideBtn.dataset.bkSide !== getSide()) flipSide();
    return;
  }

  if (target.closest('[data-bk-read]')) {
    toggleReader();
    return;
  }
  const focusBtn = target.closest<HTMLElement>('[data-bk-focus]');
  if (focusBtn?.dataset.bkFocus) {
    focusSheetHalf(focusBtn.dataset.bkFocus === 'right' ? 'right' : 'left');
    document
      .querySelectorAll<HTMLElement>('[data-bk-focus]')
      .forEach((b) => b.classList.toggle('on', b === focusBtn));
    return;
  }
  const flipBtn = target.closest<HTMLElement>('[data-bk-flip]');
  if (flipBtn?.dataset.bkFlip) {
    if (flipBtn.dataset.bkFlip === 'next') readerHandle?.next();
    else readerHandle?.prev();
    return;
  }

  const zoomBtn = target.closest<HTMLElement>('[data-bk-zoom]');
  if (zoomBtn?.dataset.bkZoom) {
    const action = zoomBtn.dataset.bkZoom;
    if (action === 'in') setZoom(getZoom(BOOKLET_STAGE) * 1.18, BOOKLET_STAGE);
    else if (action === 'out') setZoom(getZoom(BOOKLET_STAGE) / 1.18, BOOKLET_STAGE);
    else if (action === 'fit-width') {
      setFollowFit(true, BOOKLET_STAGE);
      fitPage(BOOKLET_STAGE);
    } else if (action === 'fit-page') fitWholePage(BOOKLET_STAGE);
    else if (action === 'actual-size') setZoom(1, BOOKLET_STAGE);
    return;
  }

  const modeBtn = target.closest<HTMLElement>('[data-bk-mode]');
  if (modeBtn?.dataset.bkMode) {
    setInsideMode(booklet, modeBtn.dataset.bkMode as 'single' | 'two');
    return;
  }

  // Two-menu mode: pick which inside menu the reused editor targets. Re-point the
  // target and re-render the editor body in place (no full workspace rebuild, so
  // the preview + zoom survive).
  const insideSideBtn = target.closest<HTMLElement>('[data-bk-inside-side]');
  if (insideSideBtn?.dataset.bkInsideSide) {
    const next = insideSideBtn.dataset.bkInsideSide === 'right' ? 'right' : 'left';
    if (next !== insideSide) {
      insideSide = next;
      document
        .querySelectorAll<HTMLElement>('[data-bk-inside-side]')
        .forEach((b) => b.classList.toggle('on', b.dataset.bkInsideSide === insideSide));
      mountInsideEditor();
    }
    return;
  }

  const actBtn = target.closest<HTMLElement>('[data-bk-act]');
  if (!actBtn) return;
  const act = actBtn.dataset.bkAct;

  if (act === 'close') {
    exitBookletWorkspace();
    return;
  }
  if (act === 'save') {
    void saveCurrentBooklet(false);
    return;
  }
  if (act === 'save-as') {
    void saveCurrentBooklet(true);
    return;
  }
  if (act === 'export-pdf') {
    void exportBookletPdf();
    return;
  }
  if (act === 'print') {
    void printCurrentBooklet();
  }
}

/** Switch inside.mode, seeding the extra/absent menus as needed. */
function setInsideMode(booklet: Booklet, mode: 'single' | 'two'): void {
  const inside = booklet.inside;
  if (inside.mode === mode) return;
  snapshotBooklet();
  if (mode === 'two') {
    const left = inside.mode === 'single' ? inside.menu : newMenu('Inside left', { paper: 'A5' });
    booklet.inside = { mode: 'two', left, right: newMenu('Inside right', { paper: 'A5' }) };
  } else {
    const menu = inside.mode === 'two' ? inside.left : newMenu('Inside', { paper: 'A5' });
    booklet.inside = { mode: 'single', menu, allowTwoPages: false };
  }
  insideSide = 'left';
  commitBooklet();
}

/* ================= save / open ================= */

export async function saveCurrentBooklet(as: boolean): Promise<boolean> {
  const booklet = getBooklet();
  const api = window.griffin;
  if (!booklet || !api?.saveBooklet) return false;
  window.dispatchEvent(new Event('griffin:saving'));
  const res = await api.saveBooklet(booklet, {
    saveAs: as,
    filePath: getBookletFilePath() ?? undefined,
    storage: getState().settings.storage,
  });
  if (res.canceled) {
    window.dispatchEvent(new Event('griffin:dirty'));
    return false;
  }
  if (res.error) {
    window.dispatchEvent(new Event('griffin:save-failed'));
    toast(`Booklet save failed: ${res.error}`, { kind: 'error' });
    return false;
  }
  if (res.filePath) setBookletFilePath(res.filePath);
  markBookletSaved();
  window.dispatchEvent(new Event('griffin:saved'));
  toast(as ? 'Saved a copy of the booklet.' : 'Booklet saved.', { kind: 'success' });
  return true;
}

export async function openBookletFromDisk(): Promise<void> {
  const api = window.griffin;
  if (!api?.openBooklet) {
    toast('Opening booklets is not available in this build.', { kind: 'warn' });
    return;
  }
  const res = await api.openBooklet();
  if (res.canceled) return;
  if (res.error || !res.booklet) {
    toast(`Could not open the booklet: ${res.error ?? 'unknown error'}`, { kind: 'error' });
    return;
  }
  openBooklet(res.booklet as Booklet, res.filePath ?? null);
  openBookletWorkspace();
  toast('Booklet opened.', { kind: 'success' });
}

/* ================= export / print (fold-correct, landscape) ================= */

async function waitForPrintAssets(root: HTMLElement): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready;
  const images = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
  if (!images.length) return;
  await Promise.race([
    Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
  ]);
}

/**
 * Render BOTH sheets into #printRoot as two landscape `.page.sheet.booklet`
 * pages (outer first, then inner) so the exported PDF / print job is a 2-page,
 * duplex-flip-on-short-edge, fold-correct booklet. The panel→sheet mapping and
 * the back-cover rotation are decided once by `imposeBooklet` inside
 * `renderBookletHTML`; the export layer never re-derives fold order.
 */
async function prepareBookletPrintDOM(): Promise<HTMLElement | null> {
  const booklet = getBooklet();
  const printRoot = document.getElementById('printRoot');
  if (!booklet || !printRoot) return null;
  printRoot.innerHTML =
    renderBookletHTML(booklet, renderOpts('outer')) + renderBookletHTML(booklet, renderOpts('inner'));
  applyReleaseSettings();
  // Landscape A4 @page for the whole print job; `.page.booklet` already selects
  // the named `@page booklet` (menu.css) but we set an explicit size too so the
  // reused #printPage style never leaves a stale portrait size behind.
  let printStyle = document.getElementById('printPage') as HTMLStyleElement | null;
  if (!printStyle) {
    printStyle = document.createElement('style');
    printStyle.id = 'printPage';
    document.head.appendChild(printStyle);
  }
  printStyle.textContent = '@page{size:297mm 210mm;margin:0}';
  await waitForPrintAssets(printRoot);
  return printRoot;
}

export async function exportBookletPdf(): Promise<void> {
  const booklet = getBooklet();
  if (!booklet) return;
  const root = await prepareBookletPrintDOM();
  if (!root) return;
  const defaultName = `${booklet.name || 'Booklet'}.pdf`;
  const res = await window.griffin?.exportPdf({ paper: 'A4', landscape: true, defaultName });
  root.innerHTML = '';
  if (res && !res.canceled) {
    if (res.error) toast(`Booklet PDF export failed: ${res.error}`, { kind: 'error' });
    else toast('Booklet PDF exported (2-page, landscape — print duplex, flip on short edge, then fold).', { kind: 'success' });
  }
}

export async function printCurrentBooklet(): Promise<void> {
  const booklet = getBooklet();
  if (!booklet) return;
  const root = await prepareBookletPrintDOM();
  if (!root) return;
  await window.griffin?.print({ copies: 1, paper: 'A4', landscape: true });
  // #printRoot is cleared by the shared afterprint handler in views/preview.ts.
}

/* ================= mode entry / exit ================= */

/** Leave booklet mode and return to the editor workspace. */
export function exitBookletWorkspace(): void {
  closeBooklet();
  // Return the reused editor node to its dock cell and reset the edit target to
  // the store, so the menu workspace edits its own menu again.
  restoreMenuEditorToDock();
  const app = document.getElementById('app');
  // Restore the editor workspace (setWorkspace lives in workspaces/index.ts and
  // is not imported here to avoid a cycle; the go-editor command drives it, but
  // a direct attribute + resize keeps this self-contained for the Close button).
  app?.setAttribute('data-workspace', 'editor');
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
    const on = btn.dataset.mode === 'editor';
    btn.classList.toggle('on', on);
    if (on) btn.setAttribute('aria-current', 'page');
  });
  window.dispatchEvent(new Event('resize'));
}

/* ================= init ================= */

export function initBookletEditor(): void {
  const root = document.getElementById('bookletWorkspace');
  if (root) {
    root.addEventListener('input', onFormInput);
    root.addEventListener('change', onFormChange);
    root.addEventListener('click', onFormClick);
  }

  // Re-render the whole workspace whenever the booklet session changes
  // (structural edits, undo/redo, flip). Guarded so it is a no-op outside
  // booklet mode.
  onBookletChange(() => {
    if (isBookletMode()) renderBookletWorkspace();
  });

  // If the user leaves booklet mode via the Home/Editor/Export modepill (which
  // sets #app[data-workspace] through workspaces/index.ts, a module we don't
  // touch), tear the booklet session down so menu Save/Export delegation
  // (commands.ts) stops targeting the booklet.
  const app = document.getElementById('app');
  if (app) {
    new MutationObserver(() => {
      if (isBookletMode() && app.getAttribute('data-workspace') !== 'booklet') {
        closeBooklet();
        restoreMenuEditorToDock();
      }
    }).observe(app, { attributes: true, attributeFilter: ['data-workspace'] });
  }

  window.addEventListener('resize', () => {
    if (isBookletMode()) fitPage(BOOKLET_STAGE);
  });

  // Keep the small "current booklet name" input syncing the dirty chip.
  onBookletChange(refreshDirtyChip);
}

/** Create a new blank booklet and open it for editing. */
export function createBooklet(): void {
  openBooklet(newBooklet('New Booklet'));
  openBookletWorkspace();
}
