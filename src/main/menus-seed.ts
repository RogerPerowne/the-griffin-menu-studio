import fs from 'node:fs/promises';
import path from 'node:path';
import { serializeDocument } from '../shared/document-format';
import { atomicWriteFile } from './file-storage';
import { menusDir } from './app-paths';
import SEED_MENUS from './seed-menus.json';

// First-run seeding of The Griffin's real menus into the browsable
// Documents/Griffin Menu Studio/Menus folder — each menu as its own .menu file,
// never an AppData JSON blob. Marker-gated so a menu the user deletes or edits
// is never recreated or overwritten by a later launch/update.

const MARKER = '.griffin-menus-seeded';

export async function seedRealMenus(): Promise<void> {
  const dir = menusDir();
  await fs.mkdir(dir, { recursive: true });
  const marker = path.join(dir, MARKER);
  try {
    await fs.access(marker);
    return; // already seeded once — never touch the user's files again
  } catch {
    /* first run — seed below */
  }

  const seeded: string[] = [];
  for (const entry of SEED_MENUS as Array<{ file: string; menu: { name: string } }>) {
    const target = path.join(dir, entry.file);
    try {
      await fs.access(target);
      continue; // a file with this name already exists — leave it alone
    } catch {
      /* not present — write it */
    }
    try {
      await atomicWriteFile(target, serializeDocument({ menu: entry.menu }));
      seeded.push(entry.file);
    } catch (error) {
      console.error(`Seeding menu failed: ${entry.file}`, error);
    }
  }

  await atomicWriteFile(
    marker,
    `${JSON.stringify({ seededAt: new Date().toISOString(), files: seeded, version: 1 })}\n`,
  ).catch(() => undefined);
}
