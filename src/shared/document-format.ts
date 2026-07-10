// The versioned `.menu` document format: wrapper schema, validation and
// migration. Pure (no Electron), shared by main + renderer + tests.
// Ported from the original electron/document-format.js, kept behaviour-compatible.

export const CURRENT_DOCUMENT_VERSION = 1;
export const DOCUMENT_EXTENSION = '.menu';
/** Guard against accidentally opening a huge non-menu file through the native picker. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export interface GriffinDocument {
  app: 'Griffin Menu Studio';
  version: number;
  savedAt: string | null;
  generator: Record<string, unknown>;
  state: DocumentState;
}

/** Loose shape the format guarantees; the full model lives in types.ts. */
export interface DocumentState {
  menus: Array<{ name: string; [key: string]: unknown }>;
  settings: Record<string, unknown>;
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

  // Legacy raw-state files (menus + settings, no wrapper) get wrapped.
  if (Array.isArray(document.menus) && document.settings) {
    document = {
      app: 'Griffin Menu Studio',
      version: 1,
      state: document,
    };
  }

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
  assertValidState(migrated.state);
  migrated.version = CURRENT_DOCUMENT_VERSION;
  migrated.savedAt = migrated.savedAt || null;
  migrated.generator = migrated.generator || {};
  return migrated;
}

export function createDocument(state: unknown, metadata: DocumentMetadata = {}): GriffinDocument {
  assertValidState(state);
  return {
    app: 'Griffin Menu Studio',
    version: CURRENT_DOCUMENT_VERSION,
    savedAt: new Date().toISOString(),
    generator: metadata.generator || {},
    state: clone(state) as DocumentState,
  };
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
