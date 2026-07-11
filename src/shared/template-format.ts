import type { Template } from './types';

export const CURRENT_TEMPLATE_VERSION = 1;
// Templates intentionally share the single Griffin document extension. Their
// versioned wrapper (`kind: 'template'`) and the Templates folder distinguish
// them from editable menu documents.
export const TEMPLATE_EXTENSION = '.menu';
export const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024;

export interface GriffinTemplateDocument {
  app: 'Griffin Menu Studio';
  kind: 'template';
  version: number;
  savedAt: string | null;
  template: Template;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function assertValidTemplate(value: unknown): value is Template {
  if (!isPlainObject(value)) throw new Error('Template must be an object.');
  if (typeof value.id !== 'string') throw new Error('Template is missing an id.');
  if (typeof value.name !== 'string') throw new Error('Template is missing a name.');
  if (!isPlainObject(value.style)) throw new Error('Template is missing style.');
  if (value.style.paper !== 'A4' && value.style.paper !== 'A5') throw new Error('Template has invalid paper size.');
  if (!Array.isArray(value.sections)) throw new Error('Template is missing sections.');
  return true;
}

export function createTemplateDocument(template: Template): GriffinTemplateDocument {
  assertValidTemplate(template);
  return {
    app: 'Griffin Menu Studio',
    kind: 'template',
    version: CURRENT_TEMPLATE_VERSION,
    savedAt: new Date().toISOString(),
    template: clone(template),
  };
}

export function migrateTemplateDocument(input: unknown): GriffinTemplateDocument {
  if (!isPlainObject(input)) throw new Error('File is not a Griffin Menu Studio template.');

  if (input.app === 'Griffin Menu Studio' && input.kind === 'template') {
    if (!Number.isInteger(input.version) || (input.version as number) < 1) {
      throw new Error('Unsupported Griffin template version.');
    }
    if ((input.version as number) > CURRENT_TEMPLATE_VERSION) {
      throw new Error(`This template was created by a newer Griffin Menu Studio version (${input.version}).`);
    }
    const document = clone(input) as unknown as GriffinTemplateDocument;
    assertValidTemplate(document.template);
    document.version = CURRENT_TEMPLATE_VERSION;
    document.savedAt = document.savedAt || null;
    return document;
  }

  // Legacy loose template object.
  assertValidTemplate(input);
  return {
    app: 'Griffin Menu Studio',
    kind: 'template',
    version: CURRENT_TEMPLATE_VERSION,
    savedAt: null,
    template: clone(input) as unknown as Template,
  };
}

export function parseTemplateText(text: string): GriffinTemplateDocument {
  if (new TextEncoder().encode(text).byteLength > MAX_TEMPLATE_BYTES) {
    throw new Error('This template file is too large to open safely.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected template is not valid JSON.');
  }
  return migrateTemplateDocument(parsed);
}

export function serializeTemplate(template: Template): string {
  return `${JSON.stringify(createTemplateDocument(template), null, 2)}\n`;
}
