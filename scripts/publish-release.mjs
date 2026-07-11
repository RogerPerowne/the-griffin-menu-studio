#!/usr/bin/env node
// Promote the current PRODUCTION build to a GitHub release, which the installed
// restaurant app auto-updates from. Run AFTER `npm run make` (production).
//
//   npm run make      # build the production installer
//   npm run release   # strip the RELEASES BOM + publish v<version> to GitHub
//
// Refuses to publish a dev-channel build, and requires docs/release-notes-<version>.md.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'RogerPerowne/the-griffin-menu-studio';
const outDir = path.join(root, 'out', 'make', 'squirrel.windows', 'x64');

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;

const setup = path.join(outDir, 'Griffin Menu Studio Setup.exe');
const nupkg = path.join(outDir, `GriffinMenuStudio-${version}-full.nupkg`);
const releases = path.join(outDir, 'RELEASES');
const notes = path.join(root, 'docs', `release-notes-${version}.md`);

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// --- guards ---------------------------------------------------------------
if (existsSync(path.join(outDir, `GriffinMenuStudioDev-${version}-full.nupkg`))) {
  die('This is a DEV build (GriffinMenuStudioDev-*.nupkg present). Run `npm run make` for production before releasing.');
}
for (const [label, f] of [['Setup.exe', setup], ['nupkg', nupkg], ['RELEASES', releases]]) {
  if (!existsSync(f)) die(`Missing ${label} at ${f}. Run \`npm run make\` first.`);
}
if (!existsSync(notes)) die(`Missing release notes: ${notes}. Write it (with a <!-- griffin-features: [...] --> block) before releasing.`);

// --- strip the UTF-8 BOM Squirrel writes into RELEASES (breaks update.electronjs.org) ---
const raw = readFileSync(releases);
if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
  writeFileSync(releases, raw.subarray(3));
  console.log('• Stripped UTF-8 BOM from RELEASES');
}

// --- publish --------------------------------------------------------------
const title = readFileSync(notes, 'utf8').split(/\r?\n/)[0].trim() || `Griffin Menu Studio ${version}`;
console.log(`• Publishing ${tag} — "${title}"`);
try {
  execFileSync(
    'gh',
    ['release', 'create', tag, '-R', REPO, '--target', 'main', '--title', title, '--notes-file', notes, setup, nupkg, releases],
    { stdio: 'inherit' },
  );
} catch {
  die(`gh release create failed for ${tag}. Is the tag already published? Check \`gh release list -R ${REPO}\`.`);
}
console.log(`\n✓ Published ${tag}. Installed apps will detect it within the hour (or via Settings → Check for updates).`);
console.log('  update.electronjs.org caches the latest release for a few minutes before the feed flips.');
