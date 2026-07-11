// Backup / restore: #btnBackup downloads the whole AppState as a JSON file;
// #btnRestore / #fileRestore load one back and replace the library via
// replaceState (which normalises, clears history, persists and emits 'all').
// Faithful port of the mockup's backup/restore handlers, with a light shim so
// backups from the original mockup (state.cur / state.templates) restore too.

import type { AppState, Menu, Settings, Snippet, Template } from '@shared/types';
import { todayISO } from '@shared/menu/factories';
import { getState, replaceState } from '../store';
import { confirmDialog } from '../ui/confirm';
import { toast } from '../ui/toast';

function closePops(): void {
  document.querySelectorAll('.more.open').forEach((x) => x.classList.remove('open'));
}

/** Validate a parsed backup and fill in any missing new-model collections. */
function coerceBackup(parsed: unknown): AppState | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const raw = parsed as Partial<AppState> & { cur?: string; templates?: Template[] };
  if (!Array.isArray(raw.menus)) return null;
  if (typeof raw.settings !== 'object' || raw.settings === null) return null;
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    currentMenuId: raw.currentMenuId ?? raw.cur ?? null,
    menus: raw.menus as Menu[],
    userTemplates: Array.isArray(raw.userTemplates)
      ? raw.userTemplates
      : Array.isArray(raw.templates)
        ? raw.templates
        : [],
    boilerplate: Array.isArray(raw.boilerplate) ? (raw.boilerplate as Snippet[]) : [],
    settings: raw.settings as Settings,
  };
}

export function downloadBackup(): void {
  closePops();
  const blob = new Blob([JSON.stringify(getState(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `griffin-menus-backup-${todayISO()}.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function openRestoreDialog(): void {
  closePops();
  (document.getElementById('fileRestore') as HTMLInputElement | null)?.click();
}

function onRestoreFile(input: HTMLInputElement): void {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let next: AppState | null;
    try {
      next = coerceBackup(JSON.parse(String(reader.result)));
    } catch {
      next = null;
    }
    if (!next) {
      toast('That file doesn’t look like a Menu Studio backup.', { kind: 'error' });
      return;
    }
    const restored = next;
    void confirmDialog({
      title: `Restore ${restored.menus.length} menu(s)?`,
      body: 'Your current menus will be replaced by the ones in this backup file.',
      confirmLabel: 'Restore backup',
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      replaceState(restored);
      toast('Backup restored.', { kind: 'success' });
    });
  };
  reader.readAsText(file);
  input.value = '';
}

export function initBackup(): void {
  const fileInput = document.getElementById('fileRestore') as HTMLInputElement | null;
  fileInput?.addEventListener('change', () => onRestoreFile(fileInput));
  // Legacy direct bindings (old "More" popover) — safe no-ops once the topbar
  // rework removes these ids in favour of data-cmd="backup"/"restore".
  document.getElementById('btnBackup')?.addEventListener('click', downloadBackup);
  document.getElementById('btnRestore')?.addEventListener('click', openRestoreDialog);
}
