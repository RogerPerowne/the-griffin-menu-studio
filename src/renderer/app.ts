import './styles/app.css';
import './styles/fonts.css';
import './styles/editor.css';
import './styles/menu.css';

import { getActiveBrand, paletteToCssVars } from '@shared/brand';
import { griffinSeed } from '@shared/brand/griffin-seed';
import { assetUrl } from './brand-assets';
import { getState, loadFromStorage, on, openMenu } from './store';
import { initRail, renderRail } from './views/rail';
import { initEditor, renderEditor } from './views/editor';
import { initGallery } from './views/gallery';
import { initDishPicker } from './views/dishpicker';
import { initBackup } from './views/backup';
import { initPreview, renderPreview } from './views/preview';
import { initCommandDispatch, refreshCommandStates, runCommand, type CommandName } from './commands';
import { openCommandPalette } from './command-palette';
import { initContextMenus } from './features/context-menu';
import { maybeShowFirstRun } from './features/welcome';
import { initWorkspaces, setRecoverySnapshots, setWorkspace } from './workspaces';
import { initWindowPanels } from './panels/window-panels';
import { mountAppShell } from './shell/app-shell';
import { initHelp } from './help/help';
import { confirmDocumentTransition, markDocumentDirty, markDocumentSaved } from './document-session';

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
  const s = getState().settings;
  if (!s.tipSeen && !s.tipbarHidden) tip.style.display = 'flex';
  close?.addEventListener('click', () => {
    getState().settings.tipSeen = true;
    tip.style.display = 'none';
    window.dispatchEvent(new Event('resize'));
  });
}

/**
 * Mature-desktop menu bar: click or keyboard to open, one popover at a time,
 * arrow-key navigation, Enter/Escape with correct focus return, ARIA roles.
 */
function initTopMenus(): void {
  const bar = document.getElementById('menubar');
  if (!bar) return;
  bar.setAttribute('role', 'menubar');

  const menus = Array.from(bar.querySelectorAll<HTMLElement>('.topmenu'));
  menus.forEach((menu) => {
    const btn = menu.querySelector<HTMLElement>('[data-act="topmenu"]');
    const pop = menu.querySelector<HTMLElement>('.pop');
    btn?.setAttribute('aria-haspopup', 'true');
    btn?.setAttribute('aria-expanded', 'false');
    pop?.setAttribute('role', 'menu');
    pop?.querySelectorAll<HTMLElement>('.mi').forEach((mi) => {
      mi.setAttribute('role', 'menuitem');
      mi.tabIndex = -1;
    });
  });

  const items = (menu: HTMLElement): HTMLElement[] =>
    Array.from(menu.querySelectorAll<HTMLElement>('.pop .mi')).filter((el) => el.getAttribute('aria-disabled') !== 'true');

  function closeAll(): void {
    menus.forEach((m) => {
      m.classList.remove('open');
      m.querySelector('[data-act="topmenu"]')?.setAttribute('aria-expanded', 'false');
    });
  }

  function open(menu: HTMLElement, focusFirst = false): void {
    closeAll();
    menu.classList.add('open');
    menu.querySelector('[data-act="topmenu"]')?.setAttribute('aria-expanded', 'true');
    refreshCommandStates(menu);
    // Never let a dropdown clip past the right window edge.
    const pop = menu.querySelector<HTMLElement>('.pop');
    if (pop) {
      pop.classList.remove('right');
      if (pop.getBoundingClientRect().right > window.innerWidth - 8) pop.classList.add('right');
    }
    if (focusFirst) items(menu)[0]?.focus();
  }

  bar.addEventListener('click', (e) => {
    const trigger = (e.target as Element)?.closest?.<HTMLElement>('[data-act="topmenu"]');
    if (!trigger) return;
    e.stopPropagation();
    const menu = trigger.closest<HTMLElement>('.topmenu')!;
    if (menu.classList.contains('open')) closeAll();
    else open(menu);
  });

  // Hover-follow: once one menu is open, moving over another opens it (desktop feel).
  bar.addEventListener('pointerover', (e) => {
    if (!menus.some((m) => m.classList.contains('open'))) return;
    const trigger = (e.target as Element)?.closest?.<HTMLElement>('[data-act="topmenu"]');
    const menu = trigger?.closest<HTMLElement>('.topmenu');
    if (menu && !menu.classList.contains('open')) open(menu);
  });

  document.addEventListener('click', (e) => {
    if (!(e.target as Element)?.closest?.('.more')) closeAll();
  });

  bar.addEventListener('keydown', (e) => {
    const openMenu = menus.find((m) => m.classList.contains('open'));
    const idx = menus.indexOf((e.target as Element)?.closest?.('.topmenu') as HTMLElement);
    if (e.key === 'Escape') {
      if (openMenu) { e.preventDefault(); const btn = openMenu.querySelector<HTMLElement>('[data-act="topmenu"]'); closeAll(); btn?.focus(); }
      return;
    }
    if (!openMenu) {
      // Focused on a header button, closed: Enter/Down opens, Left/Right move between headers.
      if (idx >= 0 && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(menus[idx], true); }
      else if (idx >= 0 && e.key === 'ArrowRight') { e.preventDefault(); menus[(idx + 1) % menus.length].querySelector<HTMLElement>('[data-act="topmenu"]')?.focus(); }
      else if (idx >= 0 && e.key === 'ArrowLeft') { e.preventDefault(); menus[(idx - 1 + menus.length) % menus.length].querySelector<HTMLElement>('[data-act="topmenu"]')?.focus(); }
      return;
    }
    const list = items(openMenu);
    const pos = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(pos + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(pos - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = menus.indexOf(openMenu);
      open(menus[(cur + (e.key === 'ArrowRight' ? 1 : menus.length - 1)) % menus.length], true);
    }
  });
}

/** App-wide accelerators, all routed through the one command registry. */
function initKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    if (e.altKey) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const inField = !!(e.target as HTMLElement)?.closest?.('input,textarea,[contenteditable]');
    const key = e.key.toLowerCase();
    // Accelerators that must not fire while editing text.
    const guarded: Record<string, CommandName> = { z: e.shiftKey ? 'redo' : 'undo', y: 'redo' };
    // Accelerators that work everywhere.
    const global: Record<string, CommandName> = {
      k: 'tool-search',
      s: e.shiftKey ? 'save-as' : 'save',
      o: 'open',
      p: 'print',
      e: 'export-pdf',
      f: 'toggle-find-replace-panel',
      '0': 'actual-size',
      '=': 'zoom-in',
      '+': 'zoom-in',
      '-': 'zoom-out',
      n: e.shiftKey ? 'new-window' : 'new-blank',
    };
    if (e.shiftKey && key === 'd') { e.preventDefault(); runCommand('bulk-add-dishes'); return; }
    if (key === 'k') { e.preventDefault(); openCommandPalette(); return; }
    if (!inField && guarded[key]) { e.preventDefault(); runCommand(guarded[key]); return; }
    if (global[key] && !(guarded[key] && inField)) { e.preventDefault(); runCommand(global[key]); }
  });
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'failed';

/** Visible, trustworthy document save state driven by store edits + save events. */
function initSaveState(): void {
  const chip = document.getElementById('saveState');
  if (!chip) return;
  const text = chip.querySelector<HTMLElement>('.savetext');
  const LABELS: Record<SaveState, string> = { saved: 'Saved', dirty: 'Unsaved changes', saving: 'Saving…', failed: 'Save failed' };
  const set = (state: SaveState): void => {
    chip.dataset.state = state;
    if (text) text.textContent = LABELS[state];
  };
  const markDirty = (): void => { if (chip.dataset.state !== 'saving') { markDocumentDirty(); set('dirty'); } };
  on('editor', markDirty);
  on('preview', markDirty);
  window.addEventListener('griffin:saving', () => set('saving'));
  window.addEventListener('griffin:saved', () => { markDocumentSaved(); set('saved'); });
  window.addEventListener('griffin:loaded', () => { markDocumentSaved(); set('saved'); });
  window.addEventListener('griffin:dirty', () => { markDocumentDirty(); set('dirty'); });
  window.addEventListener('griffin:save-failed', () => set('failed'));
}

async function loadDesktopTemplates(): Promise<void> {
  try {
    const result = await window.griffin?.listTemplates(getState().settings.storage);
    if (result?.errors?.length) {
      const { toast } = await import('./ui/toast');
      toast(`Some saved templates could not be loaded: ${result.errors[0]}`, { kind: 'warn' });
    }
    if (!result?.templates?.length) return;
    getState().userTemplates = result.templates;
  } catch {
    const { toast } = await import('./ui/toast');
    toast('Some saved templates could not be loaded.', { kind: 'warn' });
  }
}

/** If Windows launched us by double-clicking a .menu file, open it in the Editor. */
/** Reload the current document from disk, replacing the in-memory menu. */
async function reloadFromDisk(): Promise<void> {
  const api = window.griffin;
  if (!api?.reloadDocument) return;
  try {
    const res = await api.reloadDocument();
    const menu = res?.state && typeof res.state === 'object' && !Array.isArray(res.state)
      ? (res.state as { menu?: unknown }).menu
      : null;
    if (res && !res.canceled && menu && typeof menu === 'object' && !Array.isArray(menu)) {
      openMenu(menu as Parameters<typeof openMenu>[0]);
      window.dispatchEvent(new Event('griffin:loaded'));
      markDocumentSaved();
    } else if (res?.error) {
      const { toast } = await import('./ui/toast');
      toast(`Could not reload the menu: ${res.error}`, { kind: 'error' });
    }
  } catch {
    const { toast } = await import('./ui/toast');
    toast('Could not reload the menu from disk.', { kind: 'error' });
  }
}

async function openLaunchDocumentIfAny(): Promise<void> {
  const api = window.griffin;
  if (!api?.consumeLaunchDocument) return;
  try {
    const res = await api.consumeLaunchDocument();
    const menu = res?.state && typeof res.state === 'object' && !Array.isArray(res.state)
      ? (res.state as { menu?: unknown }).menu
      : null;
    if (res && !res.canceled && menu && typeof menu === 'object' && !Array.isArray(menu)) {
      openMenu(menu as Parameters<typeof openMenu>[0]);
      window.dispatchEvent(new Event('griffin:loaded'));
      setWorkspace('editor');
    } else if (res?.error) {
      const { toast } = await import('./ui/toast');
      toast(`Could not open the menu: ${res.error}`, { kind: 'error' });
    }
  } catch {
    const { toast } = await import('./ui/toast');
    toast('Could not open the menu supplied by Windows.', { kind: 'error' });
  }
}

/**
 * Crash-recovery lifecycle: debounce a recovery snapshot whenever the document
 * is edited, clear it on save, and mark the session cleanly closed on exit so a
 * crash can be told apart from a normal quit.
 */
function initRecoveryLifecycle(): void {
  const api = window.griffin;
  if (!api?.writeRecovery) return;
  let timer = 0;
  const recovery = getState().settings.recovery;
  if (recovery?.enabled === false) return;
  const intervalMs = Math.max(10, Math.min(300, recovery?.intervalSeconds ?? 30)) * 1000;
  const scheduleWrite = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void api.writeRecovery?.(getState(), getState().settings.storage), intervalMs);
  };
  on('editor', scheduleWrite);
  on('preview', scheduleWrite);
  window.addEventListener('griffin:saved', () => window.clearTimeout(timer));
}

/** After a crash, surface recovered snapshots in Home for the user to restore. */
async function checkRecoveryStatus(): Promise<void> {
  const api = window.griffin;
  if (!api?.recoveryStatus) return;
  try {
    const status = await api.recoveryStatus(getState().settings.storage);
    if (status.previousSessionCrashed && status.snapshots.length) {
      setRecoverySnapshots(status.snapshots);
    }
  } catch {
    /* non-critical */
  }
}

async function boot(): Promise<void> {
  window.griffin?.startupStatus('Preparing workspace');
  mountAppShell();
  applyBrand();
  window.griffin?.startupStatus('Restoring preferences');
  loadFromStorage(griffinSeed);
  window.griffin?.startupStatus('Loading templates');
  await loadDesktopTemplates();
  applyLayoutPrefs();

  window.griffin?.startupStatus('Preparing editor');
  // Views subscribe to store scopes so any commit re-renders the right panes.
  on('rail', renderRail);
  on('editor', renderEditor);
  on('preview', renderPreview);
  // Keep the toolbar's enabled/checked states (undo/redo, save, print…) live,
  // coalesced to one DOM pass per tick even when a commit emits several scopes.
  let cmdRefreshQueued = false;
  const queueCommandStateRefresh = (): void => {
    if (cmdRefreshQueued) return;
    cmdRefreshQueued = true;
    queueMicrotask(() => {
      cmdRefreshQueued = false;
      refreshCommandStates();
    });
  };
  on('editor', queueCommandStateRefresh);
  on('preview', queueCommandStateRefresh);

  initRail();
  initEditor();
  initGallery();
  initDishPicker();
  initBackup();
  initPreview();
  initTipbar();
  initSaveState();
  initContextMenus();
  initKeyboard();
  initTopMenus();
  initCommandDispatch();
  initWorkspaces();
  initWindowPanels();
  initHelp();

  window.griffin?.onCloseRequest(() => {
    void confirmDocumentTransition().then((ok) => {
      if (ok) void window.griffin?.confirmClose();
    });
  });

  // A second app launch (double-clicked .menu) routed a file into this window.
  window.griffin?.onLaunchDocument(() => {
    void confirmDocumentTransition().then((ok) => {
      if (ok) void openLaunchDocumentIfAny();
    });
  });

  // The open file changed on disk (e.g. OneDrive synced a newer version).
  window.griffin?.onExternalChange((conflict) => {
    void import('./ui/toast').then(({ toast }) => {
      if (conflict?.kind === 'missing') {
        toast('The open menu file was removed on disk.', { kind: 'warn' });
        return;
      }
      toast('This menu changed on disk (e.g. synced by OneDrive).', {
        kind: 'warn',
        action: { label: 'Reload', run: () => void reloadFromDisk() },
      });
    });
  });

  renderRail();
  renderEditor();
  renderPreview();
  refreshCommandStates();

  window.griffin?.startupStatus('Checking recovery');
  initRecoveryLifecycle();
  await openLaunchDocumentIfAny();
  void checkRecoveryStatus();
  window.griffin?.startupStatus('Preparing print engine');
  await document.fonts?.ready;
  maybeShowFirstRun();
  window.griffin?.startupStatus('Ready');
  window.griffin?.rendererReady();
}

void boot();
