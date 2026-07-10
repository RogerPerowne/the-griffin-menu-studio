import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { atomicWriteFile, readFileRevision, revisionsMatch, safeFileStem } from '../src/main/file-storage';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'griffin-menu-studio-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('atomicWriteFile', () => {
  it('writes a new file and leaves no temporary sibling behind', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'menu.menu');

    await atomicWriteFile(filePath, 'first version');

    expect(await fs.readFile(filePath, 'utf8')).toBe('first version');
    expect(await fs.readdir(directory)).toEqual(['menu.menu']);
  });

  it('replaces an existing file without leaving temporary files behind', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'menu.menu');
    await fs.writeFile(filePath, 'old version', 'utf8');

    await atomicWriteFile(filePath, 'new version');

    expect(await fs.readFile(filePath, 'utf8')).toBe('new version');
    expect(await fs.readdir(directory)).toEqual(['menu.menu']);
  });
});

describe('safeFileStem', () => {
  it('removes Windows-invalid characters and trailing punctuation', () => {
    expect(safeFileStem(' Sunday: Roast? . ', 'Griffin Menu')).toBe('Sunday Roast');
  });

  it('avoids reserved Windows device names', () => {
    expect(safeFileStem('CON', 'Griffin Menu')).toBe('CON file');
  });
});

describe('file revisions', () => {
  it('treats an unchanged file as the same revision', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'menu.menu');
    await atomicWriteFile(filePath, 'version one');

    const first = await readFileRevision(filePath);
    const second = await readFileRevision(filePath);

    expect(revisionsMatch(first, second)).toBe(true);
  });

  it('detects an external file edit and a missing file as conflicts', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'menu.menu');
    await atomicWriteFile(filePath, 'version one');
    const first = await readFileRevision(filePath);

    await atomicWriteFile(filePath, 'version two');
    const changed = await readFileRevision(filePath);
    await fs.rm(filePath);
    const missing = await readFileRevision(filePath);

    expect(revisionsMatch(first, changed)).toBe(false);
    expect(revisionsMatch(first, missing)).toBe(false);
    expect(missing).toBeNull();
  });
});
