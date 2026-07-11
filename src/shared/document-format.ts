// The versioned `.menu` document format: wrapper schema, validation and
// migration. Pure (no Electron), shared by main + renderer + tests.
// Ported from the original electron/document-format.js, kept behaviour-compatible.

import type { Booklet } from './types';

export const CURRENT_DOCUMENT_VERSION = 1;
export const DOCUMENT_EXTENSION = '.menu';
/** Guard against accidentally opening a huge non-menu file through the native picker. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

// The versioned `.booklet` document format (see docs/plan-booklet-system.md §1).
// A booklet is its own document kind, not a menu — the inside menu(s) travel
// inside the booklet's own state rather than being opened as a `.menu` file.
export const CURRENT_BOOKLET_VERSION = 1;
export const BOOKLET_EXTENSION = '.booklet';
/** Guard against accidentally opening a huge non-booklet file through the native picker. */
export const MAX_BOOKLET_BYTES = 10 * 1024 * 1024;

export interface GriffinDocument {
  app: 'Griffin Menu Studio';
  version: number;
  savedAt: string | null;
  generator: Record<string, unknown>;
  state: MenuFileState;
}

/** Loose shape the format guarantees; the full model lives in types.ts. */
export interface DocumentState {
  menus: Array<{ name: string; [key: string]: unknown }>;
  settings: Record<string, unknown>;
  [key: string]: unknown;
}

/** Canonical on-disk payload: one editable menu, never the whole Home library. */
export interface MenuFileState {
  menu: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DocumentMetadata {
  generator?: Record<string, unknown>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function assertValidState(state: unknown): state is DocumentState {
  if (!isPlainObject(state)) throw new Error('Document state must be an object.');
  if (!Array.isArray(state.menus)) throw new Error('Document state is missing menus.');
  if (!isPlainObject(state.settings)) throw new Error('Document state is missing settings.');
  if (state.menus.some((menu) => !isPlainObject(menu) || typeof menu.name !== 'string')) {
    throw new Error('Document contains an invalid menu.');
  }
  return true;
}

export function migrateDocument(input: unknown): GriffinDocument {
  if (!isPlainObject(input)) throw new Error('File is not a Griffin Menu Studio document.');

  let document: Record<string, unknown> = input;

  if (document.app !== 'Griffin Menu Studio') {
    throw new Error('File is not a Griffin Menu Studio document.');
  }

  if (!Number.isInteger(document.version) || (document.version as number) < 1) {
    throw new Error('Unsupported Griffin document version.');
  }

  if ((document.version as number) > CURRENT_DOCUMENT_VERSION) {
    throw new Error(
      `This document was created by a newer Griffin Menu Studio version (${document.version}).`,
    );
  }

  const migrated = clone(document) as unknown as GriffinDocument;
  assertValidMenuState(migrated.state);
  migrated.version = CURRENT_DOCUMENT_VERSION;
  migrated.savedAt = migrated.savedAt || null;
  migrated.generator = migrated.generator || {};
  return migrated;
}

export function createDocument(state: unknown, metadata: DocumentMetadata = {}): GriffinDocument {
  const input = isPlainObject(state) ? state : null;
  const menus = input && Array.isArray(input.menus) ? input.menus : [];
  const selectedId = input && typeof input.currentMenuId === 'string' ? input.currentMenuId : undefined;
  const menu = input && isPlainObject(input.menu)
    ? input.menu
    : (menus.find((candidate) => isPlainObject(candidate) && candidate.id === selectedId) || menus[0]);
  if (!isPlainObject(menu) || typeof menu.name !== 'string') throw new Error('Document does not contain a valid menu.');
  return {
    app: 'Griffin Menu Studio',
    version: CURRENT_DOCUMENT_VERSION,
    savedAt: new Date().toISOString(),
    generator: metadata.generator || {},
    state: { menu: clone(menu) },
  };
}

function assertValidMenuState(state: unknown): state is MenuFileState {
  if (!isPlainObject(state) || !isPlainObject(state.menu) || typeof state.menu.name !== 'string') {
    throw new Error('Document is missing a valid menu.');
  }
  return true;
}

export function parseDocumentText(text: string): GriffinDocument {
  if (new TextEncoder().encode(text).byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error('This menu file is too large to open safely.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  return migrateDocument(parsed);
}

export function serializeDocument(state: unknown, metadata: DocumentMetadata = {}): string {
  return `${JSON.stringify(createDocument(state, metadata), null, 2)}\n`;
}

/* ============================== Booklet wrapper ============================== */

export interface GriffinBookletDocument {
  app: 'Griffin Menu Studio';
  kind: 'booklet';
  version: number;
  savedAt: string | null;
  generator: Record<string, unknown>;
  booklet: Booklet;
}

/** Loose, tolerant check mirroring `assertValidMenuState` — enough to catch a wrong file. */
export function assertValidBooklet(value: unknown): asserts value is Booklet {
  if (!isPlainObject(value)) throw new Error('Booklet must be an object.');
  if (typeof value.id !== 'string') throw new Error('Booklet is missing an id.');
  if (typeof value.name !== 'string') throw new Error('Booklet is missing a name.');
  if (!isPlainObject(value.cover)) throw new Error('Booklet is missing a cover panel.');
  if (!isPlainObject(value.back)) throw new Error('Booklet is missing a back panel.');
  if (!isPlainObject(value.inside)) throw new Error('Booklet is missing its inside.');
  if (!isPlainObject(value.style) || value.style.paper !== 'A5') throw new Error('Booklet has invalid style.');
}

export function createBookletDocument(booklet: unknown, metadata: DocumentMetadata = {}): GriffinBookletDocument {
  assertValidBooklet(booklet);
  return {
    app: 'Griffin Menu Studio',
    kind: 'booklet',
    version: CURRENT_BOOKLET_VERSION,
    savedAt: new Date().toISOString(),
    generator: metadata.generator || {},
    booklet: clone(booklet),
  };
}

export function migrateBookletDocument(input: unknown): GriffinBookletDocument {
  if (!isPlainObject(input)) throw new Error('File is not a Griffin Menu Studio booklet.');

  if (input.app !== 'Griffin Menu Studio' || input.kind !== 'booklet') {
    throw new Error('File is not a Griffin Menu Studio booklet.');
  }
  if (!Number.isInteger(input.version) || (input.version as number) < 1) {
    throw new Error('Unsupported Griffin booklet version.');
  }
  if ((input.version as number) > CURRENT_BOOKLET_VERSION) {
    throw new Error(`This booklet was created by a newer Griffin Menu Studio version (${input.version}).`);
  }

  const migrated = clone(input) as unknown as GriffinBookletDocument;
  assertValidBooklet(migrated.booklet);
  migrated.version = CURRENT_BOOKLET_VERSION;
  migrated.savedAt = migrated.savedAt || null;
  migrated.generator = migrated.generator || {};
  return migrated;
}

export function parseBookletText(text: string): GriffinBookletDocument {
  if (new TextEncoder().encode(text).byteLength > MAX_BOOKLET_BYTES) {
    throw new Error('This booklet file is too large to open safely.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  return migrateBookletDocument(parsed);
}

export function serializeBooklet(booklet: unknown, metadata: DocumentMetadata = {}): string {
  return `${JSON.stringify(createBookletDocument(booklet, metadata), null, 2)}\n`;
}
