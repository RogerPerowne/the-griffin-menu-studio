import { app, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DOCUMENT_EXTENSION, MAX_DOCUMENT_BYTES, parseDocumentText, serializeDocument } from '../shared/document-format';
import type { DocumentConflict, OpenResult, SaveResult } from '../shared/api';
import { atomicWriteFile, readFileRevision, revisionFor, revisionsMatch, type FileRevision, safeFileStem } from './file-storage';

interface DocumentSession {
  filePath: string | null;
  revision: FileRevision | null;
}

const sessions = new WeakMap<BrowserWindow, DocumentSession>();
const pendingLaunchDocuments = new WeakMap<BrowserWindow, Promise<OpenResult>>();

interface MinimalState {
  currentMenuId?: string | null;
  menus?: Array<{ id?: string; name?: string }>;
}

function defaultFileName(state: unknown): string {
  const s = state as MinimalState;
  const menu = s?.menus?.find((m) => m.id === s.currentMenuId) || s?.menus?.[0];
  return safeFileStem(menu?.name, 'Griffin Menu') + DOCUMENT_EXTENSION;
}

function currentSession(win: BrowserWindow): DocumentSession {
  return sessions.get(win) || { filePath: null, revision: null };
}

async function readDocument(filePath: string): Promise<{ state: unknown; revision: FileRevision }> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error('The selected path is not a menu file.');
  if (stat.size > MAX_DOCUMENT_BYTES) throw new Error('This menu file is too large to open safely.');
  const contents = await fs.readFile(filePath);
  const document = parseDocumentText(contents.toString('utf8'));
  return { state: document.state, revision: revisionFor(contents, stat.mtimeMs) };
}

async function detectConflict(session: DocumentSession): Promise<DocumentConflict | null> {
  if (!session.filePath || !session.revision) return null;
  const revision = await readFileRevision(session.filePath);
  if (!revision) {
    return {
      kind: 'missing',
      filePath: session.filePath,
      message: 'The original file is no longer available on disk.',
    };
  }
  if (revisionsMatch(session.revision, revision)) return null;

  try {
    const disk = await readDocument(session.filePath);
    return {
      kind: 'modified',
      filePath: session.filePath,
      diskState: disk.state,
      message: 'This menu was changed outside Griffin Menu Studio after it was opened.',
    };
  } catch {
    return {
      kind: 'unreadable',
      filePath: session.filePath,
      message: 'The original file changed and can no longer be read safely.',
    };
  }
}

async function chooseSavePath(win: BrowserWindow, state: unknown, suggestedPath?: string | null): Promise<string | null> {
  const res = await dialog.showSaveDialog(win, {
    title: 'Save Griffin Menu',
    defaultPath: suggestedPath || defaultFileName(state),
    filters: [{ name: 'Griffin Menu', extensions: ['menu'] }],
  });
  if (res.canceled || !res.filePath) return null;
  return path.extname(res.filePath).toLowerCase() === DOCUMENT_EXTENSION
    ? res.filePath
    : `${res.filePath}${DOCUMENT_EXTENSION}`;
}

type SaveMode = 'save' | 'saveAs' | 'saveCopy' | 'overwrite';

async function writeDocument(win: BrowserWindow, state: unknown, mode: SaveMode): Promise<SaveResult> {
  // Validate and serialise before showing a native save dialog. A broken state
  // should never leave the user with a chosen path and a partially written file.
  let contents: string;
  try {
    contents = serializeDocument(state);
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : 'The menu is not valid.' };
  }

  const session = currentSession(win);
  let target = session.filePath;
  if (mode === 'saveAs' || mode === 'saveCopy' || !target) {
    target = await chooseSavePath(win, state, target);
    if (!target) return { canceled: true };
  }

  if (mode === 'save' && session.filePath) {
    const conflict = await detectConflict(session);
    if (conflict) return { canceled: true, conflict };
  }

  try {
    await atomicWriteFile(target, contents);
    const revision = await readFileRevision(target);
    if (!revision) throw new Error('The saved file could not be verified.');
    if (mode !== 'saveCopy') sessions.set(win, { filePath: target, revision });
    return { canceled: false, filePath: target };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : 'The menu could not be saved.' };
  }
}

export function saveDocument(win: BrowserWindow, state: unknown): Promise<SaveResult> {
  return writeDocument(win, state, 'save');
}

export function saveDocumentAs(win: BrowserWindow, state: unknown): Promise<SaveResult> {
  return writeDocument(win, state, 'saveAs');
}

export function saveDocumentCopy(win: BrowserWindow, state: unknown): Promise<SaveResult> {
  return writeDocument(win, state, 'saveCopy');
}

export function overwriteDocument(win: BrowserWindow, state: unknown): Promise<SaveResult> {
  return writeDocument(win, state, 'overwrite');
}

export async function openDocument(win: BrowserWindow): Promise<OpenResult> {
  const res = await dialog.showOpenDialog(win, {
    title: 'Open Griffin Menu',
    properties: ['openFile'],
    filters: [{ name: 'Griffin Menu', extensions: ['menu'] }],
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };
  return openDocumentPath(win, res.filePaths[0]);
}

/** Open a `.menu` path supplied by the OS (for example a file association). */
export async function openDocumentPath(win: BrowserWindow, filePath: string): Promise<OpenResult> {
  if (path.extname(filePath).toLowerCase() !== DOCUMENT_EXTENSION) {
    return { canceled: true, filePath, error: 'This file is not a Griffin Menu Studio menu.' };
  }
  try {
    const document = await readDocument(filePath);
    sessions.set(win, { filePath, revision: document.revision });
    if (process.platform === 'win32') app.addRecentDocument(filePath);
    return { canceled: false, filePath, state: document.state };
  } catch (error) {
    return {
      canceled: true,
      filePath,
      error: error instanceof Error ? error.message : 'The selected menu could not be opened.',
    };
  }
}

/** Queue a trusted command-line document until the renderer asks for it once. */
export function stageLaunchDocument(win: BrowserWindow, filePath: string): void {
  pendingLaunchDocuments.set(win, openDocumentPath(win, filePath));
}

export async function consumeLaunchDocument(win: BrowserWindow): Promise<OpenResult> {
  const pending = pendingLaunchDocuments.get(win);
  if (!pending) return { canceled: true };
  pendingLaunchDocuments.delete(win);
  return pending;
}

export async function reloadDocument(win: BrowserWindow): Promise<OpenResult> {
  const session = currentSession(win);
  if (!session.filePath) return { canceled: true, error: 'This menu has not been saved yet.' };
  try {
    const document = await readDocument(session.filePath);
    sessions.set(win, { filePath: session.filePath, revision: document.revision });
    return { canceled: false, filePath: session.filePath, state: document.state };
  } catch (error) {
    return { canceled: true, filePath: session.filePath, error: error instanceof Error ? error.message : 'The menu could not be reloaded.' };
  }
}

export function newDocument(win: BrowserWindow): { ok: boolean } {
  sessions.set(win, { filePath: null, revision: null });
  return { ok: true };
}

export function getCurrentFilePath(win: BrowserWindow): string | null {
  return currentSession(win).filePath;
}
