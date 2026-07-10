const CURRENT_DOCUMENT_VERSION = 1;
const DOCUMENT_EXTENSION = '.griffinmenu';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertValidState(state) {
  if (!isPlainObject(state)) throw new Error('Document state must be an object.');
  if (!Array.isArray(state.menus)) throw new Error('Document state is missing menus.');
  if (!isPlainObject(state.settings)) throw new Error('Document state is missing settings.');
  if (state.menus.some((menu) => !isPlainObject(menu) || typeof menu.name !== 'string')) {
    throw new Error('Document contains an invalid menu.');
  }
  return true;
}

function migrateDocument(document) {
  if (!isPlainObject(document)) throw new Error('File is not a Griffin Menu Studio document.');

  if (Array.isArray(document.menus) && document.settings) {
    document = {
      app: 'Griffin Menu Studio',
      version: 1,
      state: document
    };
  }

  if (document.app !== 'Griffin Menu Studio') {
    throw new Error('File is not a Griffin Menu Studio document.');
  }

  if (!Number.isInteger(document.version) || document.version < 1) {
    throw new Error('Unsupported Griffin document version.');
  }

  if (document.version > CURRENT_DOCUMENT_VERSION) {
    throw new Error(`This document was created by a newer Griffin Menu Studio version (${document.version}).`);
  }

  const migrated = clone(document);
  assertValidState(migrated.state);
  migrated.version = CURRENT_DOCUMENT_VERSION;
  migrated.savedAt = migrated.savedAt || null;
  migrated.generator = migrated.generator || {};
  return migrated;
}

function createDocument(state, metadata = {}) {
  assertValidState(state);
  return {
    app: 'Griffin Menu Studio',
    version: CURRENT_DOCUMENT_VERSION,
    savedAt: new Date().toISOString(),
    generator: metadata.generator || {},
    state: clone(state)
  };
}

function parseDocumentText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  return migrateDocument(parsed);
}

function serializeDocument(state, metadata = {}) {
  return `${JSON.stringify(createDocument(state, metadata), null, 2)}\n`;
}

module.exports = {
  CURRENT_DOCUMENT_VERSION,
  DOCUMENT_EXTENSION,
  assertValidState,
  createDocument,
  migrateDocument,
  parseDocumentText,
  serializeDocument
};
