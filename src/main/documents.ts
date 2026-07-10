import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { DOCUMENT_EXTENSION, parseDocumentText, serializeDocument } from '../shared/document-format';
import type { SaveResult, OpenResult } from '../shared/api';

let currentFilePath: string | null = null;

interface MinimalState {
  currentMenuId?: string | null;
  menus?: Array<{ id?: string; name?: string }>;
}

function defaultFileName(state: unknown): string {
  const s = state as MinimalState;
  const menu = s?.menus?.find((m) => m.id === s.currentMenuId) || s?.menus?.[0];
  const base = (menu?.name || 'Griffin Menu').replace(/[\\/:*?"<>|]/g, '').trim() || 'Griffin Menu';
  return base + DOCUMENT_EXTENSION;
}

export async function saveDocument(win: BrowserWindow, state: unknown, forceDialog = false): Promise<SaveResult> {
  let target = currentFilePath;
  if (forceDialog || !target) {
    const res = await dialog.showSaveDialog(win, {
      title: 'Save Griffin Menu',
      defaultPath: currentFilePath || defaultFileName(state),
      filters: [{ name: 'Griffin Menu Studio Document', extensions: ['griffinmenu'] }],
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    target = res.filePath;
    if (path.extname(target).toLowerCase() !== DOCUMENT_EXTENSION) target += DOCUMENT_EXTENSION;
  }
  fs.writeFileSync(target, serializeDocument(state), 'utf8');
  currentFilePath = target;
  return { canceled: false, filePath: target };
}

export async function openDocument(win: BrowserWindow): Promise<OpenResult> {
  const res = await dialog.showOpenDialog(win, {
    title: 'Open Griffin Menu',
    properties: ['openFile'],
    filters: [{ name: 'Griffin Menu Studio Document', extensions: ['griffinmenu'] }],
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };
  const filePath = res.filePaths[0];
  const document = parseDocumentText(fs.readFileSync(filePath, 'utf8'));
  currentFilePath = filePath;
  return { canceled: false, filePath, state: document.state };
}

export function newDocument(): { ok: boolean } {
  currentFilePath = null;
  return { ok: true };
}

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}
