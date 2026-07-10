import './styles/app.css';
import './styles/fonts.css';
import './styles/editor.css';
import './styles/menu.css';

import { getActiveBrand, paletteToCssVars } from '@shared/brand';
import { griffinSeed } from '@shared/brand/griffin-seed';
import { assetUrl } from './brand-assets';
import { getState, loadFromStorage, on } from './store';
import { initRail, renderRail } from './views/rail';
import { initEditor, renderEditor } from './views/editor';
import { initGallery } from './views/gallery';
import { initDishPicker } from './views/dishpicker';
import { initSettings } from './views/settings';
import { initBackup } from './views/backup';
import { initPreview, renderPreview } from './views/preview';
import { initCommandDispatch, runCommand } from './commands';
import { initWorkspaces } from './workspace';

const brand = getActiveBrand();

/** Apply the active brand's palette as CSS custom properties + brand mark. */
function applyBrand(): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(paletteToCssVars(brand.palette))) {
    root.style.setProperty(key, value);
  }
  const logo = document.getElementById('brandLogo') as HTMLImageElement | null;
  if (logo) logo.src = assetUrl(brand.assetKeys.crest);
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

/** Toggle any top-bar dropdown (File/Edit/Menu/Arrange/View/Help) — one popover open at a time. */
function initTopMenus(): void {
  document.getElementById('menubar')?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest<HTMLElement>('[data-act="topmenu"]');
    if (!trigger) return;
    e.stopPropagation();
    const wrap = trigger.closest<HTMLElement>('.more');
    const wasOpen = wrap?.classList.contains('open') ?? false;
    document.querySelectorAll('.more.open').forEach((el) => el.classList.remove('open'));
    if (wrap && !wasOpen) wrap.classList.add('open');
  });
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element) || !target.closest('.more')) {
      document.querySelectorAll('.more.open').forEach((el) => el.classList.remove('open'));
    }
  });
}

/** App-wide keyboard shortcuts, routed through the same command layer as every button. */
function initKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const inField = !!(e.target as HTMLElement)?.closest?.('input,textarea,[contenteditable]');
    const key = e.key.toLowerCase();
    if (key === 'z' && !inField) {
      e.preventDefault();
      runCommand(e.shiftKey ? 'redo' : 'undo');
    } else if (key === 'y' && !inField) {
      e.preventDefault();
      runCommand('redo');
    } else if (key === 's') {
      e.preventDefault();
      runCommand(e.shiftKey ? 'save-as' : 'save');
    } else if (key === 'o') {
      e.preventDefault();
      runCommand('open');
    } else if (key === 'e') {
      e.preventDefault();
      runCommand('export-pdf');
    } else if (key === 'p') {
      e.preventDefault();
      runCommand('print');
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
  initTopMenus();
  initCommandDispatch();
  initWorkspaces();

  renderRail();
  renderEditor();
  renderPreview();
}

boot();
