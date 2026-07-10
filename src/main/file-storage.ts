import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

type FileContents = string | Uint8Array;

export interface FileRevision {
  size: number;
  modifiedMs: number;
  sha256: string;
}

export function revisionFor(contents: Uint8Array, modifiedMs: number): FileRevision {
  return {
    size: contents.byteLength,
    modifiedMs,
    sha256: createHash('sha256').update(contents).digest('hex'),
  };
}

export function revisionsMatch(expected: FileRevision | null, actual: FileRevision | null): boolean {
  return expected !== null && actual !== null && expected.sha256 === actual.sha256;
}

export async function readFileRevision(filePath: string): Promise<FileRevision | null> {
  try {
    const [contents, stat] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)]);
    return revisionFor(contents, stat.mtimeMs);
  } catch {
    return null;
  }
}

const RESERVED_WINDOWS_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);

/** Produce a readable filename stem that Windows can safely create. */
export function safeFileStem(value: string | undefined, fallback: string): string {
  const cleaned = (value || fallback)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120);
  const stem = cleaned || fallback;
  return RESERVED_WINDOWS_NAMES.has(stem.toUpperCase()) ? `${stem} file` : stem;
}

/**
 * Replace a file only after its complete new contents have been written to a
 * sibling temporary file. Keeping both files in the same directory gives the
 * final rename the strongest replacement semantics available on Windows.
 */
export async function atomicWriteFile(filePath: string, contents: FileContents): Promise<void> {
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  let handle: fs.FileHandle | undefined;

  await fs.mkdir(directory, { recursive: true });

  try {
    handle = await fs.open(tempPath, 'w');
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(tempPath, filePath);
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}
