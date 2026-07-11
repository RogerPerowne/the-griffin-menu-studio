import { app, BrowserWindow, dialog, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_TEMPLATE_BYTES, parseTemplateText, serializeTemplate, TEMPLATE_EXTENSION } from '../shared/template-format';
import { BUILTIN_TEMPLATES } from '../shared/templates/builtins';
import type { SaveResult, TemplateListResult } from '../shared/api';
import type { StorageLocations, Template } from '../shared/types';
import { atomicWriteFile, safeFileStem } from './file-storage';
import { templatesDir } from './app-paths';

// Marker so first-run seeding + legacy migration happen exactly once, and a
// built-in the user deliberately deletes is not resurrected on the next launch.
const LIBRARY_MARKER = '.griffin-library';

function userTemplatesDir(storage?: StorageLocations): string {
  return templatesDir(storage);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

let libraryInit: Promise<void> | undefined;

/** Idempotently seed built-in templates to disk and migrate any legacy
 *  AppData templates, so the Templates folder is the single browsable source. */
function ensureLibrary(storage?: StorageLocations): Promise<void> {
  libraryInit ??= initLibrary(storage);
  return libraryInit;
}

async function initLibrary(storage?: StorageLocations): Promise<void> {
  const dir = userTemplatesDir(storage);
  await ensureDir(dir);
  const marker = path.join(dir, LIBRARY_MARKER);
  try {
    await fs.access(marker);
    return; // already initialised
  } catch {
    // Not initialised yet — seed + migrate below.
  }

  // 1. Migrate any legacy user templates from the old AppData location.
  const legacyDir = path.join(app.getPath('userData'), 'templates', 'user');
  if (path.normalize(legacyDir) !== path.normalize(dir)) {
    try {
      const entries = await fs.readdir(legacyDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== TEMPLATE_EXTENSION) continue;
        const to = path.join(dir, entry.name);
        try {
          await fs.access(to); // already present — leave both in place
        } catch {
          try {
            await atomicWriteFile(to, await fs.readFile(path.join(legacyDir, entry.name)));
            await fs.rm(path.join(legacyDir, entry.name), { force: true });
          } catch {
            // A single failed migration is non-fatal; the legacy file stays put.
          }
        }
      }
    } catch {
      // No legacy folder — nothing to migrate.
    }
  }

  // 2. Seed built-in templates as browsable files (builtin flag preserved).
  const existing = await readTemplates(dir);
  const haveIds = new Set(existing.templates.map((t) => t.id));
  for (const template of BUILTIN_TEMPLATES) {
    if (haveIds.has(template.id)) continue;
    try {
      const seeded: Template = { ...template, builtin: true };
      await atomicWriteFile(path.join(dir, templateFileName(seeded)), serializeTemplate(seeded));
    } catch {
      // A failed seed is non-fatal — combineTemplates still shows it from code.
    }
  }

  // 3. Mark initialised so deleted built-ins are not re-seeded next launch.
  await atomicWriteFile(marker, `${JSON.stringify({ initialisedAt: new Date().toISOString(), version: 1 })}\n`).catch(() => undefined);
}

export function templateFileName(template: Template): string {
  const base = safeFileStem(template.name, 'Griffin Template');
  const id = template.id.replace(/[^a-z0-9_-]/gi, '').slice(0, 64) || 'template';
  return `${base.slice(0, 120)}--${id}${TEMPLATE_EXTENSION}`;
}

async function readTemplates(dir: string): Promise<{ templates: Template[]; errors: string[] }> {
  const templates: Template[] = [];
  const errors: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== TEMPLATE_EXTENSION) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > MAX_TEMPLATE_BYTES) throw new Error('Template file is too large to open safely.');
      const document = parseTemplateText(await fs.readFile(filePath, 'utf8'));
      // Seeded built-ins carry builtin:true; user-created templates default false.
      templates.push({ ...document.template, builtin: document.template.builtin === true });
    } catch (error) {
      errors.push(`${entry.name}: ${error instanceof Error ? error.message : 'Could not read template'}`);
    }
  }

  return { templates, errors };
}

async function removePriorTemplateCopies(dir: string, templateId: string, keepFilePath: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== TEMPLATE_EXTENSION) continue;
    const filePath = path.join(dir, entry.name);
    if (filePath === keepFilePath) continue;
    try {
      const document = parseTemplateText(await fs.readFile(filePath, 'utf8'));
      if (document.template.id === templateId) await fs.rm(filePath);
    } catch {
      // A malformed file is reported by listUserTemplates and must never be deleted during a save.
    }
  }
}

function uniqueTemplateId(template: Template, usedIds: ReadonlySet<string>): Template {
  if (!usedIds.has(template.id)) return template;
  let suffix = 2;
  let id = `${template.id}-${suffix}`;
  while (usedIds.has(id)) {
    suffix += 1;
    id = `${template.id}-${suffix}`;
  }
  return { ...template, id };
}

export async function listUserTemplates(storage?: StorageLocations): Promise<TemplateListResult> {
  const dir = userTemplatesDir(storage);
  await ensureLibrary(storage);
  const { templates, errors } = await readTemplates(dir);
  return { templates, folderPath: dir, errors };
}

export async function saveUserTemplate(template: Template, storage?: StorageLocations): Promise<SaveResult> {
  const dir = userTemplatesDir(storage);
  await ensureDir(dir);
  const userTemplate = { ...template, builtin: false };
  const filePath = path.join(dir, templateFileName(userTemplate));
  await atomicWriteFile(filePath, serializeTemplate(userTemplate));
  await removePriorTemplateCopies(dir, userTemplate.id, filePath);
  return { canceled: false, filePath };
}

export async function importTemplate(win: BrowserWindow, storage?: StorageLocations): Promise<TemplateListResult> {
  const res = await dialog.showOpenDialog(win, {
    title: 'Import Griffin Template',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Griffin Menu Studio Template', extensions: ['menu'] }],
  });
  if (res.canceled) return listUserTemplates(storage);
  const dir = userTemplatesDir(storage);
  await ensureDir(dir);
  const current = await listUserTemplates(storage);
  const usedIds = new Set(current.templates.map((template) => template.id));
  const errors = [...(current.errors || [])];

  for (const source of res.filePaths) {
    try {
      const stat = await fs.stat(source);
      if (!stat.isFile() || stat.size > MAX_TEMPLATE_BYTES) throw new Error('Template file is too large to import safely.');
      const document = parseTemplateText(await fs.readFile(source, 'utf8'));
      const template = uniqueTemplateId({ ...document.template, builtin: false }, usedIds);
      await atomicWriteFile(path.join(dir, templateFileName(template)), serializeTemplate(template));
      usedIds.add(template.id);
    } catch (error) {
      errors.push(`${path.basename(source)}: ${error instanceof Error ? error.message : 'Could not import template'}`);
    }
  }
  const result = await listUserTemplates(storage);
  return { ...result, errors: Array.from(new Set([...errors, ...(result.errors || [])])) };
}

export async function revealTemplatesFolder(storage?: StorageLocations): Promise<{ ok: boolean; folderPath: string }> {
  const dir = userTemplatesDir(storage);
  await ensureDir(dir);
  const error = await shell.openPath(dir);
  return { ok: !error, folderPath: dir };
}
