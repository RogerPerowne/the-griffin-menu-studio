// One command registry — the single source of truth for every action in the
// app. Menu-bar items, the quick toolbar, keyboard accelerators, the Ctrl+K
// command palette and Help search all consume this list, so a command's label,
// shortcut, enabled state and checked state can never drift between surfaces.

import { newDish, newRule, newSection } from '@shared/menu/factories';
import { fmtDate } from './views/rail';
import { canRedo, canUndo, commit, currentMenu, getState, persist, redo, snapshot, undo } from './store';
import { openDishPicker } from './views/dishpicker';
import { downloadBackup, openRestoreDialog } from './views/backup';
import { deleteCurrentMenu, duplicateMenu, getSelectedSectionId, saveLayoutAsTemplate, startAddSubtitle } from './views/editor';
import {
  autoFitOnePage,
  isArrangeMode,
  preparePrintDOM,
  resetAllPositions,
  toggleMoveMode,
} from './views/preview';
import { fitPage, getZoom, setFollowFit, setZoom } from './layout-runtime';
import { createBlankMenu, getWorkspace, goHomePane, setWorkspace } from './workspaces';
import {
  alignSelectedMove,
  isPanelOpen,
  resetFloatWindows,
  resetSelectedMove,
  toggleWindowPanel,
} from './panels/window-panels';
import { openHelp } from './help/help';
import { openCommandPalette } from './command-palette';
import { toast } from './ui/toast';
import { choiceDialog, confirmDialog } from './ui/confirm';
import { openBulkAddDishes } from './features/bulk-add';
import { openWelcome } from './features/welcome';
import type { DocumentConflict } from '@shared/api';
import type { Menu } from '@shared/types';
import { confirmDocumentTransition, setDocumentSaveHandler } from './document-session';

export type CommandName =
  | 'new-blank' | 'new-template' | 'new-window' | 'open'
  | 'save' | 'save-as' | 'save-template'
  | 'duplicate' | 'delete-menu' | 'backup' | 'restore'
  | 'print' | 'print-now' | 'export-pdf' | 'export-png' | 'settings'
  | 'undo' | 'redo'
  | 'insert-subtitle' | 'insert-section' | 'insert-dish' | 'insert-rule' | 'bulk-add-dishes' | 'copy-dish'
  | 'arrange-toggle'
  | 'align-left' | 'align-center' | 'align-right' | 'align-top' | 'align-middle' | 'align-bottom'
  | 'center-page-h' | 'center-page-v' | 'reset-selected-position' | 'reset-all-positions'
  | 'zoom-in' | 'zoom-out' | 'fit-width' | 'actual-size' | 'auto-fit'
  | 'toggle-rail' | 'toggle-tipbar'
  | 'toggle-menus-panel' | 'toggle-dishes-panel' | 'toggle-find-replace-panel' | 'toggle-reuse-panel'
  | 'toggle-colour-panel' | 'toggle-typography-panel'
  | 'toggle-dietkey-panel' | 'toggle-arrange-panel' | 'reset-window-layout'
  | 'go-home' | 'go-editor' | 'go-export'
  | 'help-tutorial' | 'help-tips' | 'help-shortcuts' | 'help-saving' | 'help-tools' | 'tool-search' | 'about';

export type CommandGroup = 'File' | 'Edit' | 'Insert' | 'Arrange' | 'View' | 'Window' | 'Go' | 'Help';

export interface Command {
  id: CommandName;
  label: string;
  group: CommandGroup;
  /** Human shortcut label, e.g. "Ctrl+S". */
  hint?: string;
  keywords?: string;
  run: () => void;
  enabled?: () => boolean;
  checked?: () => boolean;
  /** Hide from the Ctrl+K palette (still runnable from its menu). */
  paletteHidden?: boolean;
}

/* ------------------------------ helpers ------------------------------ */

const hasMenu = (): boolean => getState().menus.length > 0;
const railShown = (): boolean => !getState().settings.railHidden;
const tipShown = (): boolean => !getState().settings.tipbarHidden;

/** Consistent, non-blocking message when preflight blocks output. */
function preflightBlocked(verb: string, reason?: string): void {
  if (reason === 'fonts' || reason === 'images') {
    toast(`Still preparing the ${reason === 'fonts' ? 'fonts' : 'images'} — try ${verb} again in a moment.`, { kind: 'warn' });
    return;
  }
  toast(
    reason === 'footer'
      ? `${verb} stopped — text would overlap the footer. Use Shrink to Fit, or shorten the menu.`
      : `${verb} stopped — this menu does not fit on one page. Use Shrink to Fit, or shorten the menu.`,
    { kind: 'warn', action: { label: 'Shrink to Fit', run: () => runCommand('auto-fit') } },
  );
}

function menuFromFileState(value: unknown): Menu | null {
  const menu = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as { menu?: unknown }).menu
    : null;
  return menu && typeof menu === 'object' && !Array.isArray(menu) ? menu as Menu : null;
}

async function exportPdf(): Promise<void> {
  const preflight = await preparePrintDOM();
  if (!preflight.ok) {
    preflightBlocked('Export', preflight.reason);
    return;
  }
  const menu = currentMenu();
  const defaultName = `${menu.name} ${fmtDate(menu.date)}`.trim() + '.pdf';
  const res = await window.griffin?.exportPdf({ paper: preflight.paper, defaultName });
  if (res && !res.canceled) {
    if (res.error) toast(`PDF export failed: ${res.error}`, { kind: 'error' });
    else toast('PDF exported.', { kind: 'success' });
  }
}

async function exportPng(): Promise<void> {
  const preflight = await preparePrintDOM();
  if (!preflight.ok) {
    preflightBlocked('Export', preflight.reason);
    return;
  }

  // Capture the unscaled canonical print DOM at a fixed 150 DPI. The visible
  // Export workspace is intentionally not the source of raster output.
  document.body.classList.add('png-export');
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const page = document.querySelector<HTMLElement>('#printRoot .page');
  const bounds = page?.getBoundingClientRect();
  if (!bounds || bounds.width < 1 || bounds.height < 1) {
    document.body.classList.remove('png-export');
    toast('The production preview is not ready yet — please try Export PNG again.', { kind: 'warn' });
    return;
  }

  const menu = currentMenu();
  const defaultName = `${menu.name} ${fmtDate(menu.date)}`.trim() + '.png';
  const res = await window.griffin?.exportPng({
    defaultName,
    rect: { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height },
  });
  document.body.classList.remove('png-export');
  if (res && !res.canceled) {
    if (res.error) toast(`PNG export failed: ${res.error}`, { kind: 'error' });
    else toast('PNG exported.', { kind: 'success' });
  }
}

export async function printMenu(copies = Number((document.getElementById('printCopies') as HTMLInputElement | null)?.value) || 1): Promise<void> {
  const preflight = await preparePrintDOM();
  if (!preflight.ok) {
    preflightBlocked('Print', preflight.reason);
    return;
  }
  await window.griffin?.print({ copies, paper: preflight.paper, landscape: false });
}

async function saveDocument(as = false): Promise<boolean> {
  const api = window.griffin;
  if (!api) return false;
  window.dispatchEvent(new Event('griffin:saving'));
  const storage = getState().settings.storage;
  const res = as ? await api.saveDocumentAs(getState(), storage) : await api.saveDocument(getState(), storage);
  if (res.canceled) {
    window.dispatchEvent(new Event('griffin:dirty')); // still unsaved, but not a failure
    return false;
  }
  if (res.error) {
    window.dispatchEvent(new Event('griffin:save-failed'));
    toast(`Save failed: ${res.error}. Your menu is unchanged and still needs saving.`, { kind: 'error' });
    return false;
  }
  if (res.conflict) {
    return resolveSaveConflict(res.conflict);
  }
  window.dispatchEvent(new Event('griffin:saved'));
  toast(as ? 'Saved a copy.' : 'Menu saved.', { kind: 'success' });
  return true;
}

/**
 * The file changed on disk since we opened it. Offer the three safe outcomes
 * from Codex's document contract: Reload / Save a Copy / Overwrite. Cancelling
 * leaves the document dirty and the on-disk file untouched.
 */
async function resolveSaveConflict(conflict: DocumentConflict): Promise<boolean> {
  const api = window.griffin;
  if (!api) return false;
  const choice = await choiceDialog({
    title: 'This menu changed on disk',
    body: `${conflict.message} How would you like to continue?`,
    choices: [
      { id: 'reload', label: 'Reload from disk (discard my changes)' },
      { id: 'copy', label: 'Save a Copy…', primary: true },
      { id: 'overwrite', label: 'Overwrite the file on disk', danger: true },
    ],
  });
  if (choice === 'reload') {
    const diskMenu = menuFromFileState(conflict.diskState);
    if (diskMenu) {
      const { openMenu } = await import('./store');
      openMenu(diskMenu);
    } else {
      const r = await api.reloadDocument();
      const menu = menuFromFileState(r.state);
      if (r.canceled || !menu) {
        window.dispatchEvent(new Event('griffin:dirty'));
        toast('Could not reload the file from disk.', { kind: 'error' });
        return false;
      }
      const { openMenu } = await import('./store');
      openMenu(menu);
    }
    window.dispatchEvent(new Event('griffin:loaded'));
    toast('Reloaded the version from disk.', { kind: 'success' });
    return false;
  } else if (choice === 'copy') {
    window.dispatchEvent(new Event('griffin:saving'));
    const r = await api.saveDocumentCopy(getState(), getState().settings.storage);
    if (r.canceled) { window.dispatchEvent(new Event('griffin:dirty')); return false; }
    if (r.error) { window.dispatchEvent(new Event('griffin:save-failed')); toast(`Save failed: ${r.error}`, { kind: 'error' }); return false; }
    window.dispatchEvent(new Event('griffin:dirty')); // original still unsaved; the copy is safe on disk
    toast('Saved a copy — the file on disk is untouched.', { kind: 'success' });
    return false;
  } else if (choice === 'overwrite') {
    const sure = await confirmDialog({
      title: 'Overwrite the newer file?',
      body: 'The version on disk will be replaced with your changes. This cannot be undone.',
      confirmLabel: 'Overwrite',
      danger: true,
    });
    if (!sure) { window.dispatchEvent(new Event('griffin:dirty')); return false; }
    window.dispatchEvent(new Event('griffin:saving'));
    const r = await api.overwriteDocument(getState(), getState().settings.storage);
    if (r.error) { window.dispatchEvent(new Event('griffin:save-failed')); toast(`Save failed: ${r.error}`, { kind: 'error' }); return false; }
    window.dispatchEvent(new Event('griffin:saved'));
    return true;
    toast('Saved — replaced the file on disk.', { kind: 'success' });
  } else {
    window.dispatchEvent(new Event('griffin:dirty'));
    return false;
  }
}

async function openDocumentFromDisk(): Promise<void> {
  const api = window.griffin;
  if (!api) return;
  if (!await confirmDocumentTransition()) return;
  const res = await api.openDocument();
  const menu = menuFromFileState(res?.state);
  if (res && !res.canceled && menu) {
    const { openMenu } = await import('./store');
    openMenu(menu);
    window.dispatchEvent(new Event('griffin:loaded'));
    setWorkspace('editor');
    toast('Menu opened.', { kind: 'success' });
  } else if (res?.error) {
    toast(`Could not open the menu: ${res.error}`, { kind: 'error' });
  }
}

setDocumentSaveHandler(() => saveDocument(false));

function toggleRail(): void {
  const settings = getState().settings;
  settings.railHidden = !settings.railHidden;
  persist();
  document.getElementById('mainGrid')?.classList.toggle('noRail', !!settings.railHidden);
  requestAnimationFrame(() => fitPage());
}

function toggleTipbar(): void {
  const settings = getState().settings;
  settings.tipbarHidden = !settings.tipbarHidden;
  persist();
  const tip = document.getElementById('tipbar');
  if (tip) tip.style.display = settings.tipbarHidden ? 'none' : 'flex';
  window.dispatchEvent(new Event('resize'));
}

function insertSubtitle(): void {
  startAddSubtitle();
}

function insertSection(): void {
  const menu = currentMenu();
  snapshot();
  const selectedId = getSelectedSectionId();
  const idx = selectedId ? menu.sections.findIndex((s) => s.id === selectedId) : -1;
  const section = newSection('New Section', []);
  if (idx === -1) {
    menu.sections.push(section);
  } else {
    menu.sections.splice(idx + 1, 0, section);
  }
  commit(['all']);
}

function insertDish(): void {
  const menu = currentMenu();
  snapshot();
  if (!menu.sections.length) menu.sections.push(newSection('New Section', []));
  const selectedId = getSelectedSectionId();
  const target = menu.sections.find((s) => s.id === selectedId) ?? menu.sections[menu.sections.length - 1];
  target.items.push(newDish());
  commit(['all']);
}

function insertRule(): void {
  snapshot();
  currentMenu().rootRules.push(newRule('bottom'));
  commit(['all']);
}

function runAutoFit(): void {
  const ok = autoFitOnePage();
  toast(ok ? 'Shrunk to fit one page.' : 'This menu still needs manual trimming to fit on one page.', { kind: ok ? 'success' : 'warn' });
}

/* ------------------------------ registry ------------------------------ */

const align = (mode: Parameters<typeof alignSelectedMove>[0]) => () => alignSelectedMove(mode);

export const COMMANDS: Command[] = [
  // File
  { id: 'new-blank', label: 'New Blank Menu', group: 'File', hint: 'Ctrl+N', keywords: 'create empty', run: () => void createBlankMenu() },
  { id: 'new-template', label: 'New from Template…', group: 'File', keywords: 'create layout gallery', run: () => goHomePane('new') },
  { id: 'new-window', label: 'New Window', group: 'File', hint: 'Ctrl+Shift+N', keywords: 'app window second', run: () => void window.griffin?.newWindow() },
  { id: 'open', label: 'Open…', group: 'File', hint: 'Ctrl+O', keywords: 'file document menu', run: () => void openDocumentFromDisk() },
  { id: 'save', label: 'Save', group: 'File', hint: 'Ctrl+S', keywords: 'store document', enabled: hasMenu, run: () => void saveDocument(false) },
  { id: 'save-as', label: 'Save As…', group: 'File', hint: 'Ctrl+Shift+S', keywords: 'copy document', enabled: hasMenu, run: () => void saveDocument(true) },
  { id: 'save-template', label: 'Save Layout as Template…', group: 'File', keywords: 'reuse layout menu template', enabled: hasMenu, run: () => saveLayoutAsTemplate() },
  { id: 'duplicate', label: 'Duplicate Menu', group: 'File', keywords: 'copy clone', enabled: hasMenu, run: () => { duplicateMenu(); toast('Menu duplicated.', { kind: 'success' }); } },
  { id: 'delete-menu', label: 'Delete Menu…', group: 'File', keywords: 'remove trash', enabled: hasMenu, run: () => deleteCurrentMenu() },
  { id: 'backup', label: 'Back up all menus…', group: 'File', keywords: 'export library archive', run: () => downloadBackup() },
  { id: 'restore', label: 'Restore from backup…', group: 'File', keywords: 'import library', run: () => openRestoreDialog() },
  { id: 'print', label: 'Print…', group: 'File', hint: 'Ctrl+P', keywords: 'paper printer', enabled: hasMenu, run: () => setWorkspace('export') },
  { id: 'print-now', label: 'Print now', group: 'File', keywords: 'print system dialog printer', enabled: hasMenu, run: () => void printMenu() },
  { id: 'export-pdf', label: 'Export as PDF…', group: 'File', hint: 'Ctrl+E', keywords: 'pdf share', enabled: hasMenu, run: () => void exportPdf() },
  { id: 'export-png', label: 'Export as PNG…', group: 'File', keywords: 'png image', enabled: hasMenu, run: () => void exportPng() },
  { id: 'settings', label: 'Settings…', group: 'File', keywords: 'preferences options defaults storage', run: () => goHomePane('settings') },

  // Edit
  { id: 'undo', label: 'Undo', group: 'Edit', hint: 'Ctrl+Z', enabled: canUndo, run: () => undo() },
  { id: 'redo', label: 'Redo', group: 'Edit', hint: 'Ctrl+Y', enabled: canRedo, run: () => redo() },

  // Insert
  { id: 'insert-subtitle', label: 'Add Subtitle', group: 'Insert', keywords: 'headernote header note tagline', enabled: hasMenu, run: insertSubtitle },
  { id: 'insert-section', label: 'Add Section', group: 'Insert', keywords: 'new course heading', enabled: hasMenu, run: insertSection },
  { id: 'insert-dish', label: 'Add Dish', group: 'Insert', keywords: 'new item food', enabled: hasMenu, run: insertDish },
  { id: 'insert-rule', label: 'Add Divider Rule', group: 'Insert', keywords: 'line separator', enabled: hasMenu, run: insertRule },
  { id: 'bulk-add-dishes', label: 'Add Dishes in Bulk…', group: 'Insert', hint: 'Ctrl+Shift+D', keywords: 'paste list multiple quick fast bulk import dishes', enabled: hasMenu, run: () => openBulkAddDishes() },
  { id: 'copy-dish', label: 'Copy a Dish from another Menu…', group: 'Insert', keywords: 'reuse find dish', enabled: hasMenu, run: () => openDishPicker(currentMenu().sections[0]?.id ?? '') },

  // Arrange
  { id: 'arrange-toggle', label: 'Arrange Mode', group: 'Arrange', keywords: 'move position free drag', checked: isArrangeMode, run: () => toggleMoveMode() },
  { id: 'align-left', label: 'Align Left', group: 'Arrange', enabled: isArrangeMode, run: align('left') },
  { id: 'align-center', label: 'Align Centre', group: 'Arrange', enabled: isArrangeMode, run: align('center') },
  { id: 'align-right', label: 'Align Right', group: 'Arrange', enabled: isArrangeMode, run: align('right') },
  { id: 'align-top', label: 'Align Top', group: 'Arrange', enabled: isArrangeMode, run: align('top') },
  { id: 'align-middle', label: 'Align Middle', group: 'Arrange', enabled: isArrangeMode, run: align('middle') },
  { id: 'align-bottom', label: 'Align Bottom', group: 'Arrange', enabled: isArrangeMode, run: align('bottom') },
  { id: 'center-page-h', label: 'Centre on Page — Across', group: 'Arrange', enabled: isArrangeMode, run: align('page-h') },
  { id: 'center-page-v', label: 'Centre on Page — Down', group: 'Arrange', enabled: isArrangeMode, run: align('page-v') },
  { id: 'reset-selected-position', label: 'Reset Selected Position', group: 'Arrange', enabled: isArrangeMode, run: () => resetSelectedMove() },
  { id: 'reset-all-positions', label: 'Reset All Positions', group: 'Arrange', enabled: hasMenu, run: () => resetAllPositions() },

  // View
  { id: 'zoom-in', label: 'Zoom In', group: 'View', hint: 'Ctrl+=', run: () => setZoom(getZoom() * 1.18) },
  { id: 'zoom-out', label: 'Zoom Out', group: 'View', hint: 'Ctrl+-', run: () => setZoom(getZoom() / 1.18) },
  { id: 'fit-width', label: 'Fit to Width', group: 'View', keywords: 'zoom fit', run: () => { setFollowFit(true); fitPage(); } },
  { id: 'actual-size', label: 'Actual Size', group: 'View', hint: 'Ctrl+0', keywords: 'zoom 100', run: () => setZoom(1) },
  { id: 'auto-fit', label: 'Shrink to Fit One Page', group: 'View', keywords: 'fit overflow shrink', enabled: hasMenu, run: runAutoFit },
  { id: 'toggle-rail', label: 'Menus Column', group: 'View', keywords: 'sidebar rail list', checked: railShown, run: toggleRail },
  { id: 'toggle-tipbar', label: 'Tips Bar', group: 'View', keywords: 'hint help', checked: tipShown, run: toggleTipbar },

  // Window
  { id: 'toggle-menus-panel', label: 'Menus', group: 'Window', keywords: 'library switch', checked: () => isPanelOpen('menus'), run: () => toggleWindowPanel('menus') },
  { id: 'toggle-dishes-panel', label: 'Dishes', group: 'Window', keywords: 'items current', checked: () => isPanelOpen('dishes'), run: () => toggleWindowPanel('dishes') },
  { id: 'toggle-find-replace-panel', label: 'Find & Replace', group: 'Window', hint: 'Ctrl+F', keywords: 'find replace search across menus', checked: () => isPanelOpen('find-replace'), run: () => toggleWindowPanel('find-replace') },
  { id: 'toggle-reuse-panel', label: 'Reuse', group: 'Window', keywords: 'reuse dish copy clone across menus', checked: () => isPanelOpen('reuse'), run: () => toggleWindowPanel('reuse') },
  { id: 'toggle-colour-panel', label: 'Colour & Spacing', group: 'Window', keywords: 'paper blush tint gap layout print sliders lines', checked: () => isPanelOpen('colour'), run: () => toggleWindowPanel('colour') },
  { id: 'toggle-typography-panel', label: 'Typography', group: 'Window', keywords: 'font text size header', checked: () => isPanelOpen('typography'), run: () => toggleWindowPanel('typography') },
  { id: 'toggle-dietkey-panel', label: 'Dietary Key', group: 'Window', keywords: 'allergen vegetarian codes', checked: () => isPanelOpen('dietkey'), run: () => toggleWindowPanel('dietkey') },
  { id: 'toggle-arrange-panel', label: 'Arrange', group: 'Window', keywords: 'align position move', checked: () => isPanelOpen('arrange'), run: () => toggleWindowPanel('arrange') },
  { id: 'reset-window-layout', label: 'Reset Window Layout', group: 'Window', keywords: 'default panels position', run: () => { resetFloatWindows(); toast('Tool windows reset to their default layout.'); } },

  // Go
  { id: 'go-home', label: 'Home', group: 'Go', keywords: 'start backstage', checked: () => getWorkspace() === 'home', run: () => setWorkspace('home') },
  { id: 'go-editor', label: 'Editor', group: 'Go', keywords: 'edit', checked: () => getWorkspace() === 'editor', run: () => setWorkspace('editor') },
  { id: 'go-export', label: 'Export', group: 'Go', keywords: 'print pdf png output', checked: () => getWorkspace() === 'export', run: () => setWorkspace('export') },

  // Help
  { id: 'help-tutorial', label: 'Welcome & Quick Tour', group: 'Help', keywords: 'welcome guide learn tutorial getting started beginner', run: () => openWelcome() },
  { id: 'help-tips', label: 'Tips', group: 'Help', run: () => openHelp('tips') },
  { id: 'help-shortcuts', label: 'Keyboard Shortcuts', group: 'Help', keywords: 'keys accelerators', run: () => openHelp('shortcuts') },
  { id: 'help-saving', label: 'Files & Saving', group: 'Help', keywords: 'menu pdf png document', run: () => openHelp('saving') },
  { id: 'help-tools', label: 'Help', group: 'Help', paletteHidden: true, run: () => openHelp('tools') },
  { id: 'tool-search', label: 'Tool Search…', group: 'Help', hint: 'Ctrl+K', keywords: 'command palette search run', run: () => openCommandPalette() },
  { id: 'about', label: 'About Griffin Menu Studio', group: 'Help', keywords: 'version credits', run: () => openHelp('about') },
];

const COMMAND_MAP = new Map<CommandName, Command>(COMMANDS.map((c) => [c.id, c]));

export function getCommand(id: CommandName): Command | undefined {
  return COMMAND_MAP.get(id);
}

export function allCommands(): Command[] {
  return COMMANDS;
}

export function runCommand(name: CommandName): void {
  const cmd = COMMAND_MAP.get(name);
  if (!cmd) return;
  if (cmd.enabled && !cmd.enabled()) return;
  cmd.run();
}

/**
 * Reflect live enabled/checked/shortcut state onto every `[data-cmd]` control.
 * Menus call this as they open; the toolbar is refreshed on state changes.
 */
export function refreshCommandStates(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-cmd]').forEach((el) => {
    const cmd = COMMAND_MAP.get(el.dataset.cmd as CommandName);
    if (!cmd) return;
    const enabled = cmd.enabled ? cmd.enabled() : true;
    if (el instanceof HTMLButtonElement) el.disabled = !enabled;
    el.toggleAttribute('data-disabled', !enabled);
    el.setAttribute('aria-disabled', String(!enabled));
    if (cmd.checked) {
      const on = cmd.checked();
      el.classList.toggle('checked', on);
      el.setAttribute('aria-pressed', String(on));
    }
    if (cmd.hint && el.classList.contains('mi') && !el.dataset.hint) el.dataset.hint = cmd.hint;
  });
}

/**
 * Wire every `[data-cmd]` element to runCommand in one place — menu items, the
 * quick toolbar and the mode pill all get real behaviour for free.
 */
export function initCommandDispatch(): void {
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLElement>('[data-cmd]');
    if (!btn) return;
    const cmd = btn.dataset.cmd as CommandName | undefined;
    if (!cmd) return;
    if (btn.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    runCommand(cmd);
    document.querySelectorAll('.more.open').forEach((el) => el.classList.remove('open'));
  });
}
