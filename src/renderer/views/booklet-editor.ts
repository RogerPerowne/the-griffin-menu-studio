// Booklet authoring view (docs/plan-booklet-system.md §7). Owns the whole
// `#bookletWorkspace`: a tabbed editor for the four logical panels (Cover /
// Inside / Back) plus a landscape preview stage with a "flip" control (outer ⇄
// inner sheet) and a fold hint. It is the booklet analogue of views/editor.ts +
// views/preview.ts, but self-contained: it never touches the menu store, only
// the booklet-session module.
//
// The inside menu(s) use a deliberately SIMPLIFIED editor (name / sections /
// dishes: name·desc·price) rather than reusing the full menu editor
// (views/editor.ts) — that editor is bound to the store's `currentMenu()` and
// is out of scope to rewire for this pass. Tags, columns, dietary key, divider
// rules and free-drag arrange are therefore not editable on the inside menu yet
// (they still RENDER via renderMenuHTML if present). See the return notes.

import type { Booklet, BookletPanel, Dish, HeaderStyle, Menu } from '@shared/types';
import { newBooklet, newDish, newSection, newMenu } from '@shared/menu/factories';
import { renderBookletHTML, type SheetSide } from '@shared/menu/booklet';
import { getActiveBrand } from '@shared/brand';
import { assetUrl } from '../brand-assets';
import { escapeHtml as esc } from '../util/escape';
import { getState } from '../store';
import { toast } from '../ui/toast';
import {
  BOOKLET_STAGE,
  applyReleaseSettings,
  fitPage,
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
  setBookletFilePath,
  setDirty,
  snapshotBooklet,
} from '../booklet-session';

const brand = getActiveBrand();
const ASSETS = { crest: assetUrl(brand.assetKeys.crest), lockup: assetUrl(brand.assetKeys.lockup) };

type Tab = 'cover' | 'inside' | 'back';
let activeTab: Tab = 'cover';

/* ================= render helpers ================= */

function menuFromKey(booklet: Booklet, key: 'single' | 'left' | 'right'): Menu | null {
  const inside = booklet.inside;
  if (inside.mode === 'single') return key === 'single' ? inside.menu : null;
  return key === 'left' ? inside.left : key === 'right' ? inside.right : null;
}

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

function miniMenuEditor(menu: Menu, key: 'single' | 'left' | 'right'): string {
  const sections = menu.sections
    .map((s) => {
      const dishes = (s.items as Dish[])
        .filter((it) => (it as { type?: string }).type !== 'rule')
        .map(
          (d) => `<div class="bk-dish" data-dish="${esc(d.id)}">
            <input class="bk-dish-name" data-bk-dish-field="name" value="${esc(d.name)}" placeholder="Dish name">
            <input class="bk-dish-price" data-bk-dish-field="price" value="${esc(d.price)}" placeholder="£" inputmode="decimal">
            <input class="bk-dish-desc" data-bk-dish-field="desc" value="${esc(d.desc)}" placeholder="description">
            <button class="bk-icon danger" data-bk-act="del-dish" title="Delete dish">✕</button>
          </div>`,
        )
        .join('');
      return `<div class="bk-section" data-section="${esc(s.id)}">
        <div class="bk-section-head">
          <input class="bk-section-name" data-bk-section-field="name" value="${esc(s.name)}" placeholder="Section name">
          <button class="bk-icon danger" data-bk-act="del-section" title="Delete section">✕</button>
        </div>
        <div class="bk-dishes">${dishes}</div>
        <button class="bk-add" data-bk-act="add-dish">+ Dish</button>
      </div>`;
    })
    .join('');
  return `<div class="bk-menu-editor" data-menu-key="${key}">
    <label class="bk-menu-name">Menu title <input data-bk-menu-field="name" value="${esc(menu.name)}" placeholder="Inside menu title"></label>
    ${sections}
    <button class="bk-add bk-add-section" data-bk-act="add-section">+ Section</button>
  </div>`;
}

function insideForm(booklet: Booklet): string {
  const inside = booklet.inside;
  const modeBtn = (mode: 'single' | 'two', l: string): string =>
    `<button type="button" class="bk-seg ${inside.mode === mode ? 'on' : ''}" data-bk-mode="${mode}">${l}</button>`;
  let body: string;
  if (inside.mode === 'single') {
    body = `<label class="bk-check"><input type="checkbox" data-bk-two-pages ${inside.allowTwoPages ? 'checked' : ''}> Allow the inside menu to run onto the second inside page</label>
      ${miniMenuEditor(inside.menu, 'single')}`;
  } else {
    body = `<div class="bk-two-cols">
      <div><h3>Inside left</h3>${miniMenuEditor(inside.left, 'left')}</div>
      <div><h3>Inside right</h3>${miniMenuEditor(inside.right, 'right')}</div>
    </div>`;
  }
  return `<div class="bk-panel-form" data-panel="inside">
    <h2>Inside</h2>
    <div class="bk-seg-row" role="group" aria-label="Inside layout">
      <span>Inside is</span>${modeBtn('single', 'One menu')}${modeBtn('two', 'Two menus')}
    </div>
    ${body}
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
        <span class="bk-fold-hint">${foldHint(side)}</span>
        <span class="sp"></span>
        <button class="abtn" data-bk-act="print">Print…</button>
        <button class="abtn primary" data-bk-act="export-pdf">Export PDF</button>
      </header>
      <div class="stage-body">
        <canvas class="ruler ruler-top" id="bookletRulerTop" aria-hidden="true"></canvas>
        <div class="ruler-corner" aria-hidden="true"></div>
        <div class="stage-scroll" id="bookletStageScroll"><div class="pagewrap" id="bookletPagewrap"></div></div>
        <canvas class="ruler ruler-right" id="bookletRulerRight" aria-hidden="true"></canvas>
      </div>
      <div class="stage-zoombar" role="toolbar" aria-label="Booklet preview zoom">
        <button class="zoomb wide" data-bk-zoom="fit-width">Fit width</button>
        <button class="zoomb wide" data-bk-zoom="actual-size">Actual size</button>
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

/* ================= stage wiring (zoom / rulers) ================= */

function bindBookletStage(): void {
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

function currentMenuElKey(target: Element): 'single' | 'left' | 'right' | null {
  const menuEl = target.closest<HTMLElement>('.bk-menu-editor');
  const key = menuEl?.dataset.menuKey;
  return key === 'single' || key === 'left' || key === 'right' ? key : null;
}

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

  const panelField = (target as HTMLElement).dataset.bkField;
  if (panelField && panelField !== 'header') {
    const panel = activeTab === 'back' ? booklet.back : booklet.cover;
    const value = (target as HTMLInputElement | HTMLTextAreaElement).value;
    (panel as unknown as Record<string, string>)[panelField] = value;
    debPreview();
    return;
  }

  const menuKey = currentMenuElKey(target);
  if (!menuKey) return;
  const menu = menuFromKey(booklet, menuKey);
  if (!menu) return;
  const value = (target as HTMLInputElement).value;

  if ((target as HTMLElement).dataset.bkMenuField === 'name') {
    menu.name = value;
    debPreview();
    return;
  }
  const sectionEl = target.closest<HTMLElement>('.bk-section');
  const section = sectionEl ? menu.sections.find((s) => s.id === sectionEl.dataset.section) : null;
  if (!section) return;
  if ((target as HTMLElement).dataset.bkSectionField === 'name') {
    section.name = value;
    debPreview();
    return;
  }
  const dishEl = target.closest<HTMLElement>('.bk-dish');
  const dishField = (target as HTMLElement).dataset.bkDishField;
  if (dishEl && dishField) {
    const dish = (section.items as Dish[]).find((d) => d.id === dishEl.dataset.dish);
    if (dish && (dishField === 'name' || dishField === 'desc' || dishField === 'price')) {
      dish[dishField] = value;
      if (dishField === 'price' && value.trim()) {
        section.prices = true;
        menu.style.showPrices = true;
      }
      debPreview();
    }
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

  const zoomBtn = target.closest<HTMLElement>('[data-bk-zoom]');
  if (zoomBtn?.dataset.bkZoom) {
    const action = zoomBtn.dataset.bkZoom;
    if (action === 'in') setZoom(getZoom(BOOKLET_STAGE) * 1.18, BOOKLET_STAGE);
    else if (action === 'out') setZoom(getZoom(BOOKLET_STAGE) / 1.18, BOOKLET_STAGE);
    else if (action === 'fit-width') {
      setFollowFit(true, BOOKLET_STAGE);
      fitPage(BOOKLET_STAGE);
    } else if (action === 'actual-size') setZoom(1, BOOKLET_STAGE);
    return;
  }

  const modeBtn = target.closest<HTMLElement>('[data-bk-mode]');
  if (modeBtn?.dataset.bkMode) {
    setInsideMode(booklet, modeBtn.dataset.bkMode as 'single' | 'two');
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
    return;
  }

  const menuKey = currentMenuElKey(target);
  const menu = menuKey ? menuFromKey(booklet, menuKey) : null;
  if (act === 'add-section' && menu) {
    snapshotBooklet();
    menu.sections.push(newSection('New Section', []));
    commitBooklet();
    return;
  }
  if (act === 'add-dish' && menu) {
    const sectionEl = actBtn.closest<HTMLElement>('.bk-section');
    const section = sectionEl ? menu.sections.find((s) => s.id === sectionEl.dataset.section) : null;
    if (section) {
      snapshotBooklet();
      section.items.push(newDish());
      commitBooklet();
    }
    return;
  }
  if (act === 'del-section' && menu) {
    const sectionEl = actBtn.closest<HTMLElement>('.bk-section');
    if (sectionEl) {
      snapshotBooklet();
      menu.sections = menu.sections.filter((s) => s.id !== sectionEl.dataset.section);
      commitBooklet();
    }
    return;
  }
  if (act === 'del-dish' && menu) {
    const sectionEl = actBtn.closest<HTMLElement>('.bk-section');
    const dishEl = actBtn.closest<HTMLElement>('.bk-dish');
    const section = sectionEl ? menu.sections.find((s) => s.id === sectionEl.dataset.section) : null;
    if (section && dishEl) {
      snapshotBooklet();
      section.items = section.items.filter((d) => d.id !== dishEl.dataset.dish);
      commitBooklet();
    }
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
      if (isBookletMode() && app.getAttribute('data-workspace') !== 'booklet') closeBooklet();
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
