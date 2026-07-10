import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertValidState, type DocumentState } from '../shared/document-format';
import { atomicWriteFile } from './file-storage';

export const RECOVERY_FORMAT_VERSION = 1;
export const MAX_RECOVERY_SNAPSHOTS = 20;
export const RECOVERY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export interface RecoverySnapshot {
  app: 'Griffin Menu Studio';
  kind: 'recovery';
  version: number;
  id: string;
  createdAt: string;
  sessionId: string;
  documentPath?: string;
  state: DocumentState;
}

export interface RecoverySummary {
  id: string;
  createdAt: string;
  sessionId: string;
  documentPath?: string;
  documentName: string;
}

function snapshotFileName(id: string): string {
  return `${id}.recovery.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function documentName(state: DocumentState): string {
  return state.menus[0]?.name || 'Recovered menu';
}

export function createRecoverySnapshot(state: unknown, options: { sessionId: string; documentPath?: string; now?: Date } ): RecoverySnapshot {
  assertValidState(state);
  const now = options.now || new Date();
  return {
    app: 'Griffin Menu Studio',
    kind: 'recovery',
    version: RECOVERY_FORMAT_VERSION,
    id: randomUUID(),
    createdAt: now.toISOString(),
    sessionId: options.sessionId,
    ...(options.documentPath ? { documentPath: options.documentPath } : {}),
    state: JSON.parse(JSON.stringify(state)) as DocumentState,
  };
}

export function parseRecoverySnapshot(value: unknown): RecoverySnapshot {
  if (!isRecord(value) || value.app !== 'Griffin Menu Studio' || value.kind !== 'recovery') {
    throw new Error('Not a Griffin recovery snapshot.');
  }
  if (value.version !== RECOVERY_FORMAT_VERSION || typeof value.id !== 'string' || typeof value.createdAt !== 'string' || typeof value.sessionId !== 'string') {
    throw new Error('Unsupported recovery snapshot.');
  }
  assertValidState(value.state);
  return {
    app: 'Griffin Menu Studio',
    kind: 'recovery',
    version: RECOVERY_FORMAT_VERSION,
    id: value.id,
    createdAt: value.createdAt,
    sessionId: value.sessionId,
    ...(typeof value.documentPath === 'string' ? { documentPath: value.documentPath } : {}),
    state: value.state as DocumentState,
  };
}

async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

async function entries(directory: string): Promise<Array<{ snapshot: RecoverySnapshot; filePath: string }>> {
  await ensureDirectory(directory);
  const result: Array<{ snapshot: RecoverySnapshot; filePath: string }> = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.recovery.json')) continue;
    const filePath = path.join(directory, entry.name);
    try {
      const value = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
      result.push({ snapshot: parseRecoverySnapshot(value), filePath });
    } catch {
      // A corrupt recovery file is ignored rather than blocking recovery for all others.
    }
  }
  return result;
}

export async function cleanupRecoveryDirectory(directory: string, nowMs = Date.now()): Promise<void> {
  const sorted = (await entries(directory)).sort(
    (a, b) => Date.parse(b.snapshot.createdAt) - Date.parse(a.snapshot.createdAt),
  );
  await Promise.all(
    sorted.slice(MAX_RECOVERY_SNAPSHOTS).map((entry) => fs.rm(entry.filePath, { force: true })),
  );
  await Promise.all(
    sorted
      .filter((entry) => nowMs - Date.parse(entry.snapshot.createdAt) > RECOVERY_MAX_AGE_MS)
      .map((entry) => fs.rm(entry.filePath, { force: true })),
  );
}

export async function writeRecoverySnapshot(directory: string, snapshot: RecoverySnapshot): Promise<RecoverySummary> {
  await ensureDirectory(directory);
  await atomicWriteFile(path.join(directory, snapshotFileName(snapshot.id)), `${JSON.stringify(snapshot, null, 2)}\n`);
  await cleanupRecoveryDirectory(directory);
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    sessionId: snapshot.sessionId,
    ...(snapshot.documentPath ? { documentPath: snapshot.documentPath } : {}),
    documentName: documentName(snapshot.state),
  };
}

export async function listRecoverySnapshots(directory: string): Promise<RecoverySummary[]> {
  return (await entries(directory))
    .sort((a, b) => Date.parse(b.snapshot.createdAt) - Date.parse(a.snapshot.createdAt))
    .map(({ snapshot }) => ({
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      sessionId: snapshot.sessionId,
      ...(snapshot.documentPath ? { documentPath: snapshot.documentPath } : {}),
      documentName: documentName(snapshot.state),
    }));
}

export async function readRecoverySnapshot(directory: string, id: string): Promise<RecoverySnapshot | null> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  try {
    return parseRecoverySnapshot(JSON.parse(await fs.readFile(path.join(directory, snapshotFileName(id)), 'utf8')) as unknown);
  } catch {
    return null;
  }
}

export async function discardRecoverySnapshot(directory: string, id: string): Promise<boolean> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return false;
  const filePath = path.join(directory, snapshotFileName(id));
  try {
    await fs.rm(filePath);
    return true;
  } catch {
    return false;
  }
}
