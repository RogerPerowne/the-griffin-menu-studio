import './styles/app.css';
import './styles/fonts.css';
import './styles/editor.css';
import './styles/menu.css';

import { getActiveBrand, paletteToCssVars } from '@shared/brand';
import { griffinSeed } from '@shared/brand/griffin-seed';
import { assetUrl } from './brand-assets';
import { currentMenu, getState, loadFromStorage, on, redo, replaceState, undo } from './store';
import { fmtDate, initRail, renderRail } from './views/rail';
import { initEditor, renderEditor } from './views/editor';
import { initGallery } from './views/gallery';
import { initDishPicker } from './views/dishpicker';
import { initSettings } from './views/settings';
import { initBackup } from './views/backup';
import { initPreview, preparePrintDOM, renderPreview } from './views/preview';

const brand = getActiveBrand();

/** Apply the active brand's palette as CSS custom properties + brand mark. */
function applyBrand(): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(paletteToCssVars(brand.palette))) {
    root.style.setProperty(key, value);
  }
  const logo = document.getElementById('brandLogo') as HTMLImageElement | null;
  if (logo) logo.src = assetUrl(brand.assetKeys.lockup);
  document.title = `Griffin Menu Studio — ${brand.displayName}`;
}

/** Restore persisted rail/editor sizing so layout is correct before first paint. */
function applyLayoutPrefs(): void {
  const grid = document.getElementById('mainGrid');
  if (!grid) return;
  const s = getState().settings;
  grid.style.setProperty('--railw', `${s.railWidth ?? 230}px`);
  grid.style.setProperty('--edw', `${s.editorWidth ?? 380}px`);
  grid.classList.toggle('noRail', !!s.railHidden);
}

function initTipbar(): void {
  const tip = document.getElementById('tipbar');
  const close = document.getElementById('tipClose');
  if (!tip) return;
  if (!getState().settings.tipSeen) tip.style.display = 'flex';
  close?.addEventListener('click', () => {
    getState().settings.tipSeen = true;
    tip.style.display = 'none';
    window.dispatchEvent(new Event('resize'));
  });
}

/** Export the current menu to PDF via the desktop bridge (guarded for browser preview). */
async function exportPdf(): Promise<void> {
  const preflight = await preparePrintDOM();
  if (!preflight.ok) {
    const msg =
      preflight.reason === 'footer'
        ? 'Export stopped: text would overlap the footer. Use “Shrink to fit” or shorten the menu first.'
        : 'Export stopped: this menu does not fit safely on one page. Use “Shrink to fit” or shorten the menu first.';
    window.alert(msg);
    return;
  }
  const menu = currentMenu();
  const defaultName = `${menu.name} ${fmtDate(menu.date)}`.trim() + '.pdf';
  await window.griffin?.exportPdf({ paper: preflight.paper, defaultName });
}

async function saveDocument(as = false): Promise<void> {
  const api = window.griffin;
  if (!api) return;
  const res = as ? await api.saveDocumentAs(getState()) : await api.saveDocument(getState());
  if (!res.canceled) window.dispatchEvent(new Event('griffin:saved'));
}

async function openDocument(): Promise<void> {
  const api = window.griffin;
  if (!api) return;
  const res = await api.openDocument();
  if (res && !res.canceled && res.state) replaceState(res.state as ReturnType<typeof getState>);
}

/** App-wide keyboard shortcuts (a minimal set; a full command layer lands in Phase 2). */
function initKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const inField = !!(e.target as HTMLElement)?.closest?.('input,textarea,[contenteditable]');
    const key = e.key.toLowerCase();
    if (key === 'z' && !inField) {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (key === 'y' && !inField) {
      e.preventDefault();
      redo();
    } else if (key === 's') {
      e.preventDefault();
      void saveDocument(e.shiftKey);
    } else if (key === 'o') {
      e.preventDefault();
      void openDocument();
    } else if (key === 'e') {
      e.preventDefault();
      void exportPdf();
    } else if (key === 'p') {
      e.preventDefault();
      void window.griffin?.print();
    }
  });
}

function boot(): void {
  applyBrand();
  loadFromStorage(griffinSeed);
  applyLayoutPrefs();

  // Views subscribe to store scopes so any commit re-renders the right panes.
  on('rail', renderRail);
  on('editor', renderEditor);
  on('preview', renderPreview);

  initRail();
  initEditor();
  initGallery();
  initDishPicker();
  initSettings();
  initBackup();
  initPreview();
  initTipbar();
  initKeyboard();

  document.getElementById('btnExport')?.addEventListener('click', () => void exportPdf());

  renderRail();
  renderEditor();
  renderPreview();
}

boot();
