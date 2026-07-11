import { app } from 'electron';
import path from 'node:path';
import type { StorageLocations } from '../shared/types';

// Word-like, browsable storage. Menus and templates default to the OS Documents
// folder so the user can find them in Explorer / OneDrive; recovery and backups
// deliberately stay in AppData (see recovery.ts) so temporary/app-internal files
// never clutter the user's Documents. Each location has a storage.* override.

const APP_FOLDER = 'Griffin Menu Studio';

/** `Documents/Griffin Menu Studio` — the root of the user-facing library. */
export function griffinDocumentsRoot(): string {
  return path.join(app.getPath('documents'), APP_FOLDER);
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
