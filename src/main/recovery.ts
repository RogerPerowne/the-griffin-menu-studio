import { app, BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RecoveryListResult, RecoveryReadResult, RecoverySnapshotResult, RecoveryStatus, RecoverySummary as ApiRecoverySummary, RecoveryWriteResult } from '../shared/api';
import { getCurrentFilePath } from './documents';
import type { StorageLocations } from '../shared/types';
import { atomicWriteFile } from './file-storage';
import {
  createRecoverySnapshot,
  discardRecoverySnapshot,
  listRecoverySnapshots,
  readRecoverySnapshot,
  type RecoverySummary,
  writeRecoverySnapshot,
} from './recovery-store';

interface SessionMarker {
  version: 1;
  sessionId: string;
  startedAt: string;
  clean: boolean;
}

let sessionId = '';
let previousSessionCrashed = false;

function summaryForApi(summary: RecoverySummary): ApiRecoverySummary {
  return {
    id: summary.id,
    createdAt: summary.createdAt,
    ...(summary.documentPath ? { documentPath: summary.documentPath } : {}),
    documentName: summary.documentName,
  };
}

function snapshotForApi(snapshot: Awaited<ReturnType<typeof readRecoverySnapshot>>): RecoverySnapshotResult | undefined {
  if (!snapshot) return undefined;
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    ...(snapshot.documentPath ? { documentPath: snapshot.documentPath } : {}),
    documentName: snapshot.state.menus[0]?.name || 'Recovered menu',
    state: snapshot.state,
  };
}

function recoveryDirectory(storage?: StorageLocations): string {
  return storage?.recoveryFolder && path.isAbsolute(storage.recoveryFolder)
    ? path.normalize(storage.recoveryFolder)
    : path.join(app.getPath('userData'), 'recovery');
}

function markerPath(): string {
  return path.join(recoveryDirectory(), 'session.json');
}

async function readMarker(): Promise<SessionMarker | null> {
  try {
    const value = JSON.parse(await fs.readFile(markerPath(), 'utf8')) as unknown;
    if (!value || typeof value !== 'object') return null;
    const marker = value as Partial<SessionMarker>;
    return marker.version === 1 && typeof marker.sessionId === 'string' && typeof marker.startedAt === 'string' && typeof marker.clean === 'boolean'
      ? marker as SessionMarker
      : null;
  } catch {
    return null;
  }
}

export async function beginRecoverySession(): Promise<RecoveryStatus> {
  const previous = await readMarker();
  previousSessionCrashed = !!previous && !previous.clean;
  sessionId = randomUUID();
  const marker: SessionMarker = { version: 1, sessionId, startedAt: new Date().toISOString(), clean: false };
  await fs.mkdir(recoveryDirectory(), { recursive: true });
  await atomicWriteFile(markerPath(), JSON.stringify(marker));
  return getRecoveryStatus();
}

export async function markRecoverySessionClean(): Promise<{ ok: boolean }> {
  if (!sessionId) return { ok: false };
  const marker: SessionMarker = { version: 1, sessionId, startedAt: new Date().toISOString(), clean: true };
  try {
    await atomicWriteFile(markerPath(), JSON.stringify(marker));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getRecoveryStatus(storage?: StorageLocations): Promise<RecoveryStatus> {
  try {
    if (!sessionId) await beginRecoverySession();
    const snapshots = await listRecoverySnapshots(recoveryDirectory(storage));
    return { previousSessionCrashed, snapshots: snapshots.map(summaryForApi) };
  } catch {
    return { previousSessionCrashed: false, snapshots: [] };
  }
}

export async function writeRecovery(win: BrowserWindow, state: unknown, storage?: StorageLocations): Promise<RecoveryWriteResult> {
  try {
    if (!sessionId) await beginRecoverySession();
    const snapshot = createRecoverySnapshot(state, { sessionId, documentPath: getCurrentFilePath(win) || undefined });
    const summary = await writeRecoverySnapshot(recoveryDirectory(storage), snapshot);
    return { ok: true, snapshot: summaryForApi(summary) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Recovery snapshot could not be written.' };
  }
}

export async function listRecovery(storage?: StorageLocations): Promise<RecoveryListResult> {
  try {
    return { snapshots: (await listRecoverySnapshots(recoveryDirectory(storage))).map(summaryForApi) };
  } catch (error) {
    return { snapshots: [], error: error instanceof Error ? error.message : 'Recovery snapshots could not be listed.' };
  }
}

export async function readRecovery(id: string, storage?: StorageLocations): Promise<RecoveryReadResult> {
  try {
    const snapshot = snapshotForApi(await readRecoverySnapshot(recoveryDirectory(storage), id));
    return snapshot ? { found: true, snapshot } : { found: false };
  } catch (error) {
    return { found: false, error: error instanceof Error ? error.message : 'Recovery snapshot could not be read.' };
  }
}

export async function discardRecovery(id: string, storage?: StorageLocations): Promise<{ ok: boolean }> {
  return { ok: await discardRecoverySnapshot(recoveryDirectory(storage), id) };
}

export type { RecoverySummary };
