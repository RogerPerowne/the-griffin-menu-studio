import { app } from 'electron';
import path from 'node:path';
import type { StorageLocations } from '../shared/types';

// Word-like, browsable storage. Menus and templates default to the OS Documents
// folder so the user can find them in Explorer / OneDrive; recovery and backups
// deliberately stay in AppData (see recovery.ts) so temporary/app-internal files
// never clutter the user's Documents. Each location has a storage.* override.

const APP_FOLDER = 'Griffin Menu Studio';

/**
 * True for any non-production build: an unpackaged run (`npm start`) or the
 * packaged "Griffin Menu Studio Dev" channel. Dev builds get their OWN Documents
 * folder + userData + no auto-update, so testing never touches the released app's
 * data or the restaurant's install. (Production packaged build → false.)
 */
export function isDevChannel(): boolean {
  return !app.isPackaged || app.getName().toLowerCase().includes('dev');
}

function appFolder(): string {
  return isDevChannel() ? `${APP_FOLDER} Dev` : APP_FOLDER;
}

/** `Documents/Griffin Menu Studio[ Dev]` — the root of the user-facing library. */
export function griffinDocumentsRoot(): string {
  return path.join(app.getPath('documents'), appFolder());
}

/** Where menus are saved by default. Override: `storage.defaultMenuFolder`. */
export function menusDir(storage?: StorageLocations): string {
  const override = storage?.defaultMenuFolder;
  if (override && path.isAbsolute(override)) return path.normalize(override);
  return path.join(griffinDocumentsRoot(), 'Menus');
}

/**
 * Where templates live — built-ins (seeded to disk on first run) and
 * user-created templates together. Override: `storage.templatesFolder`.
 */
export function templatesDir(storage?: StorageLocations): string {
  const override = storage?.templatesFolder;
  if (override && path.isAbsolute(override)) return path.normalize(override);
  return path.join(griffinDocumentsRoot(), 'Templates');
}

/** Where PDF/PNG exports default to — a browsable Exports subfolder. */
export function exportsDir(): string {
  return path.join(griffinDocumentsRoot(), 'Exports');
}
