// Unified command dispatch: every actionable item in the app — menu-bar
// dropdown entries, the icon quick-row, and (later) keyboard accelerators —
// calls runCommand(name) instead of wiring its own one-off handler. Keeps
// the "what can this app do" list in one place and guarantees the menu bar,
// toolbar and shortcuts never drift out of sync.

import { fmtDate } from './views/rail';
import { currentMenu, getState, redo, undo } from './store';
import { openGallery } from './views/gallery';
import { openSettings } from './views/settings';
import { openDishPicker } from './views/dishpicker';
import { downloadBackup, openRestoreDialog } from './views/backup';
import { duplicateMenu, deleteCurrentMenu, saveLayoutAsTemplate } from './views/editor';
import { autoFitOnePage, preparePrintDOM, resetAllPositions, toggleMoveMode } from './views/preview';
import { fitPage, setZoom, getZoom } from './layout-runtime';
import { setWorkspace } from './workspace';

export type CommandName =
  | 'new'
  | 'new-template'
  | 'open'
  | 'save'
  | 'save-as'
  | 'duplicate'
  | 'delete-menu'
  | 'save-template'
  | 'backup'
  | 'restore'
  | 'export-pdf'
  | 'export-png'
  | 'print'
  | 'undo'
  | 'redo'
  | 'copy-dish'
  | 'settings'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit-width'
  | 'actual-size'
  | 'arrange-toggle'
  | 'reset-all-positions'
  | 'go-start'
  | 'go-editor'
  | 'go-export'
  | 'about';

async function exportPdf(): Promise<void> {
  const preflight = await preparePrintDOM();
  if (!preflight.ok) {
    window.alert(
      preflight.reason === 'footer'
        ? 'Export stopped: text would overlap the footer. Use “Shrink to fit” or shorten the menu first.'
        : 'Export stopped: this menu does not fit safely on one page. Use “Shrink to fit” or shorten the menu first.',
    );
    return;
  }
  const menu = currentMenu();
  const defaultName = `${menu.name} ${fmtDate(menu.date)}`.trim() + '.pdf';
  await window.griffin?.exportPdf({ paper: preflight.paper, defaultName });
}

async function exportPng(): Promise<void> {
  const menu = currentMenu();
  const defaultName = `${menu.name} ${fmtDate(menu.date)}`.trim() + '.png';
  await window.griffin?.exportPng({ defaultName });
}

async function printMenu(): Promise<void> {
  const preflight = await preparePrintDOM();
  if (!preflight.ok) {
    window.alert(
      preflight.reason === 'footer'
        ? 'Can’t print yet: text would overlap the footer. Use “Shrink to fit” or shorten the menu first.'
        : 'Can’t print yet: this menu does not fit safely on one page. Use “Shrink to fit” or shorten the menu first.',
    );
    return;
  }
  await window.griffin?.print();
}

async function saveDocument(as = false): Promise<void> {
  const api = window.griffin;
  if (!api) return;
  const res = as ? await api.saveDocumentAs(getState()) : await api.saveDocument(getState());
  if (!res.canceled) window.dispatchEvent(new Event('griffin:saved'));
}

async function openDocumentFromDisk(): Promise<void> {
  const api = window.griffin;
  if (!api) return;
  const res = await api.openDocument();
  if (res && !res.canceled && res.state) {
    const { replaceState } = await import('./store');
    replaceState(res.state as ReturnType<typeof getState>);
    setWorkspace('editor');
  }
}

export function runCommand(name: CommandName): void {
  switch (name) {
    case 'new':
    case 'new-template':
      openGallery();
      return;
    case 'open':
      void openDocumentFromDisk();
      return;
    case 'save':
      void saveDocument(false);
      return;
    case 'save-as':
      void saveDocument(true);
      return;
    case 'duplicate':
      duplicateMenu();
      return;
    case 'delete-menu':
      deleteCurrentMenu();
      return;
    case 'save-template':
      saveLayoutAsTemplate();
      return;
    case 'backup':
      downloadBackup();
      return;
    case 'restore':
      openRestoreDialog();
      return;
    case 'export-pdf':
      void exportPdf();
      return;
    case 'export-png':
      void exportPng();
      return;
    case 'print':
      void printMenu();
      return;
    case 'undo':
      undo();
      return;
    case 'redo':
      redo();
      return;
    case 'copy-dish':
      openDishPicker(currentMenu().sections[0]?.id ?? '');
      return;
    case 'settings':
      openSettings();
      return;
    case 'zoom-in':
      setZoom(getZoom() * 1.18);
      return;
    case 'zoom-out':
      setZoom(getZoom() / 1.18);
      return;
    case 'fit-width':
      fitPage();
      return;
    case 'actual-size':
      setZoom(1);
      return;
    case 'arrange-toggle':
      toggleMoveMode();
      return;
    case 'reset-all-positions':
      resetAllPositions();
      return;
    case 'go-start':
      setWorkspace('start');
      return;
    case 'go-editor':
      setWorkspace('editor');
      return;
    case 'go-export':
      setWorkspace('export');
      return;
    case 'about':
      window.alert('Griffin Menu Studio\nA bespoke menu editor for The Griffin, Amersham.');
      return;
  }
}

/**
 * Wires every `[data-cmd]` element in the document to runCommand, in one
 * place — the menu-bar dropdowns, the icon quick-row and the mode pill all
 * just render `data-cmd="…"` and get real behaviour for free.
 */
export function initCommandDispatch(): void {
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLElement>('[data-cmd]');
    if (!btn) return;
    const cmd = btn.dataset.cmd as CommandName | undefined;
    if (!cmd) return;
    e.preventDefault();
    runCommand(cmd);
    document.querySelectorAll('.more.open').forEach((el) => el.classList.remove('open'));
  });
}
