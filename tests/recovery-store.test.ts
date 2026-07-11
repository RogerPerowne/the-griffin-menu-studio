import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_RECOVERY_SNAPSHOTS,
  RECOVERY_MAX_AGE_MS,
  cleanupRecoveryDirectory,
  createRecoverySnapshot,
  discardRecoverySnapshot,
  listRecoverySnapshots,
  readRecoverySnapshot,
  writeRecoverySnapshot,
} from '../src/main/recovery-store';

const directories: string[] = [];

async function recoveryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'griffin-recovery-'));
  directories.push(directory);
  return directory;
}

const state = { menus: [{ name: 'Lunch Menu' }], settings: {} };

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('recovery-store', () => {
  it('writes, lists, reads and discards independent recovery snapshots', async () => {
    const directory = await recoveryDirectory();
    const snapshot = createRecoverySnapshot(state, { sessionId: 'session-a', documentPath: 'C:\\Menus\\Lunch.menu' });
    const summary = await writeRecoverySnapshot(directory, snapshot);

    expect((await listRecoverySnapshots(directory)).map((item) => item.id)).toEqual([summary.id]);
    expect((await readRecoverySnapshot(directory, summary.id))?.state).toEqual(state);
    expect(await discardRecoverySnapshot(directory, summary.id)).toBe(true);
    expect(await listRecoverySnapshots(directory)).toEqual([]);
  });

  it('keeps recovery content independent of the real menu document', async () => {
    const directory = await recoveryDirectory();
    const menuPath = path.join(directory, 'Private Dining.menu');
    await fs.writeFile(menuPath, '{"real":"document"}', 'utf8');

    const snapshot = createRecoverySnapshot(state, { sessionId: 'session-isolated', documentPath: menuPath });
    await writeRecoverySnapshot(directory, snapshot);
    snapshot.state.menus[0].name = 'Mutated after snapshot';

    expect(await fs.readFile(menuPath, 'utf8')).toBe('{"real":"document"}');
    expect((await readRecoverySnapshot(directory, snapshot.id))?.state.menus[0].name).toBe('Lunch Menu');
    expect((await fs.readdir(directory)).some((name) => name.endsWith('.recovery.json'))).toBe(true);
  });

  it('keeps retention bounded and removes old snapshots', async () => {
    const directory = await recoveryDirectory();
    const now = new Date('2026-07-10T12:00:00.000Z');
    for (let index = 0; index < MAX_RECOVERY_SNAPSHOTS + 2; index += 1) {
      const snapshot = createRecoverySnapshot(state, { sessionId: 'session-b', now: new Date(now.getTime() - index * 1_000) });
      await writeRecoverySnapshot(directory, snapshot);
    }
    const old = createRecoverySnapshot(state, { sessionId: 'session-old', now: new Date(now.getTime() - RECOVERY_MAX_AGE_MS - 1) });
    await fs.writeFile(path.join(directory, `${old.id}.recovery.json`), JSON.stringify(old), 'utf8');

    await cleanupRecoveryDirectory(directory, now.getTime());

    const snapshots = await listRecoverySnapshots(directory);
    expect(snapshots).toHaveLength(MAX_RECOVERY_SNAPSHOTS);
    expect(snapshots.some((snapshot) => snapshot.id === old.id)).toBe(false);
  });
});
