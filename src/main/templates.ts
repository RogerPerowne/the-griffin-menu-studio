import { app, BrowserWindow, dialog, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_TEMPLATE_BYTES, parseTemplateText, serializeTemplate, TEMPLATE_EXTENSION } from '../shared/template-format';
import type { SaveResult, TemplateListResult } from '../shared/api';
import type { StorageLocations, Template } from '../shared/types';
import { atomicWriteFile, safeFileStem } from './file-storage';

function userTemplatesDir(storage?: StorageLocations): string {
  return storage?.templatesFolder && path.isAbsolute(storage.templatesFolder)
    ? path.normalize(storage.templatesFolder)
    : path.join(app.getPath('userData'), 'templates', 'user');
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
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
      templates.push({ ...document.template, builtin: false });
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
  await ensureDir(dir);
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
