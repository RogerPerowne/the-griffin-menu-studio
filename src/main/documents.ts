import { app, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { DOCUMENT_EXTENSION, MAX_DOCUMENT_BYTES, parseDocumentText, serializeDocument } from '../shared/document-format';
import type { DocumentConflict, OpenResult, SaveResult } from '../shared/api';
import { atomicWriteFile, readFileRevision, revisionFor, revisionsMatch, type FileRevision, safeFileStem } from './file-storage';
import { menusDir } from './app-paths';
import type { StorageLocations } from '../shared/types';

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

// Proactive external-change watching: while a menu is open, OneDrive (or another
// app) may sync a newer version onto disk. Watch the file's DIRECTORY so an
// atomic rename-replace is still observed, debounce OneDrive's multi-touch
// syncs, and compare the content revision so our own saves never self-trigger.
interface WatchState {
  watcher: FSWatcher;
  timer: ReturnType<typeof setTimeout> | null;
}
const watchers = new WeakMap<BrowserWindow, WatchState>();

function stopWatch(win: BrowserWindow): void {
  const state = watchers.get(win);
  if (!state) return;
  if (state.timer) clearTimeout(state.timer);
  try {
    state.watcher.close();
  } catch {
    // Already closed.
  }
  watchers.delete(win);
}

/** Set the window's document session and (re)arm its external-change watcher. */
function setSession(win: BrowserWindow, session: DocumentSession): void {
  sessions.set(win, session);
  stopWatch(win);
  if (!session.filePath) return;
  const dir = path.dirname(session.filePath);
  const base = path.basename(session.filePath);
  let watcher: FSWatcher;
  try {
    watcher = watch(dir, { persistent: false }, (_event, filename) => {
      if (filename && path.basename(filename.toString()) !== base) return;
      const state = watchers.get(win);
      if (state?.timer) clearTimeout(state.timer);
      watchers.set(win, { watcher, timer: setTimeout(() => void checkExternalChange(win), 400) });
    });
  } catch {
    return; // Watching is best-effort; save-time conflict detection still protects data.
  }
  watchers.set(win, { watcher, timer: null });
}

async function checkExternalChange(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed()) {
    stopWatch(win);
    return;
  }
  const session = currentSession(win);
  if (!session.filePath || !session.revision) return;
  const revision = await readFileRevision(session.filePath);
  if (revision && revisionsMatch(session.revision, revision)) return; // our own save / no real change
  const conflict = await detectConflict(session);
  if (conflict) win.webContents.send('document:externalChange', conflict);
}

/** Stop watching when a window closes (called from main.ts). */
export function disposeDocumentWatch(win: BrowserWindow): void {
  stopWatch(win);
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

async function chooseSavePath(win: BrowserWindow, state: unknown, suggestedPath?: string | null, storage?: StorageLocations): Promise<string | null> {
  const fallback = defaultFileName(state);
  let defaultPath: string;
  if (suggestedPath) {
    defaultPath = suggestedPath;
  } else {
    // Default new saves into Documents/Griffin Menu Studio/Menus (Word-like).
    const dir = menusDir(storage);
    await fs.mkdir(dir, { recursive: true }).catch(() => undefined);
    defaultPath = path.join(dir, fallback);
  }
  const res = await dialog.showSaveDialog(win, {
    title: 'Save Griffin Menu',
    defaultPath,
    filters: [{ name: 'Griffin Menu', extensions: ['menu'] }],
  });
  if (res.canceled || !res.filePath) return null;
  return path.extname(res.filePath).toLowerCase() === DOCUMENT_EXTENSION
    ? res.filePath
    : `${res.filePath}${DOCUMENT_EXTENSION}`;
}

type SaveMode = 'save' | 'saveAs' | 'saveCopy' | 'overwrite';

async function writeDocument(win: BrowserWindow, state: unknown, mode: SaveMode, storage?: StorageLocations): Promise<SaveResult> {
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
    target = await chooseSavePath(win, state, target, storage);
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
    if (mode !== 'saveCopy') setSession(win, { filePath: target, revision });
    return { canceled: false, filePath: target };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : 'The menu could not be saved.' };
  }
}

export function saveDocument(win: BrowserWindow, state: unknown, storage?: StorageLocations): Promise<SaveResult> {
  return writeDocument(win, state, 'save', storage);
}

export function saveDocumentAs(win: BrowserWindow, state: unknown, storage?: StorageLocations): Promise<SaveResult> {
  return writeDocument(win, state, 'saveAs', storage);
}

export function saveDocumentCopy(win: BrowserWindow, state: unknown, storage?: StorageLocations): Promise<SaveResult> {
  return writeDocument(win, state, 'saveCopy', storage);
}

export function overwriteDocument(win: BrowserWindow, state: unknown, storage?: StorageLocations): Promise<SaveResult> {
  return writeDocument(win, state, 'overwrite', storage);
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
    setSession(win, { filePath, revision: document.revision });
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
    setSession(win, { filePath: session.filePath, revision: document.revision });
    return { canceled: false, filePath: session.filePath, state: document.state };
  } catch (error) {
    return { canceled: true, filePath: session.filePath, error: error instanceof Error ? error.message : 'The menu could not be reloaded.' };
  }
}

export function newDocument(win: BrowserWindow): { ok: boolean } {
  setSession(win, { filePath: null, revision: null });
  return { ok: true };
}

export function getCurrentFilePath(win: BrowserWindow): string | null {
  return currentSession(win).filePath;
}
