# Griffin Menu Studio — Filing System Design

A professional, Word-like filing system: the **folder is the library**, every document
is a real file the user can find in Explorer / OneDrive, and the app never hides the
user's work inside an opaque AppData blob.

---

## 1. File types — the decision

**Question: is two file types (`.menu`, `.template`) better than one?** Yes.

Sharing a single `.menu` extension for both documents and templates (today's model)
means the *folder* is the only thing telling them apart. That's fragile: Windows shows
one icon for both, double-click can't route them differently, and a template dropped in
the wrong folder becomes ambiguous.

**What's better than two file types: a small, self-describing file-format *family*.**

- **`.menu`** — an editable menu document.
- **`.template`** — a reusable layout template (built-in or user-made).
- **`.booklet`** — a folded booklet (later; System 5).

Each is human-readable JSON that **also** carries a `kind` field inside
(`"menu" | "template" | "booklet"`) — so the type is unambiguous even if a file is
renamed, and the extension gives Windows a distinct icon and its own double-click
behaviour (open `.menu` → edit; open `.template` → "New from this template"; open
`.booklet` → booklet editor).

Beyond the extensions, the format is a **coherent family**:

- One versioned wrapper shape shared by all three (`app`, `kind`, `version`, `savedAt`,
  `generator`, `state`), so parsing/migration/validation is one code path.
- **Self-contained on export** — when a file is saved or shared, any referenced brand
  asset is embedded as a data URI (per the brand-assets hybrid decision), so emailing a
  `.menu` still shows its logo on another machine.
- Forward-compatible — a newer `version` is rejected with a clear message, never
  silently mis-read.

This is what "even better than two file types" means: distinct, self-describing
extensions **plus** one disciplined, portable, versioned format underneath.

---

## 2. Folder layout

### User-facing library (Documents — browsable, OneDrive-friendly)

```
Documents/
└── Griffin Menu Studio/
    ├── Menus/       *.menu, *.booklet   ← menu documents AND folded booklets (seeded with the Griffin's real menus)
    ├── Templates/   *.template          ← built-in (seeded) + user templates
    └── Exports/     *.pdf *.png         ← exported output
```

Just three folders — flat and obvious. **Menus and booklets live together in `Menus/`**
(a booklet is just another finished menu the user opens and edits; the `.booklet`
extension distinguishes them). No per-menu subfolders — the folder is deliberately kept
simple. The base folder defaults to Documents but is overridable in Settings (it follows
a redirected OneDrive Documents automatically). **The folder *is* the library** — what
the user sees in the app's Open list is exactly what they see in Explorer.

### App-internal (AppData — never in Documents, never synced)

```
%AppData%/Griffin Menu Studio/
    ├── settings.json         ← preferences, storage overrides, workspace layout
    ├── recent.json           ← recent-files list (paths + last-opened)
    ├── library-index.json    ← CACHE: {path, name, kind, modified, thumbnailRef} per file
    ├── recovery/             ← crash autosave snapshots
    ├── backups/              ← rolling backups of saved documents
    ├── thumbnails/           ← rendered menu thumbnails, keyed by content hash
    └── brand-assets/         ← the brand image library (seeded starter set + user uploads)
```

Recovery, backups, thumbnails and the index live in AppData deliberately: they are
app-internal, must not clutter the user's Documents, and must not be synced by OneDrive.

---

## 3. The library is file-based (not one AppData JSON blob)

**Today (to be replaced):** the whole menu library lives in `localStorage`
(`griffinMenuStudio.v2`) as one JSON blob (`AppState.menus[]`), seeded from
`griffinSeed()`. The Home "Open" list renders that in-memory array; `.menu` files are a
separate import/export concept.

**New model (Word-like):**

- The **Open list = a live listing of `Menus/` (`*.menu` + `*.booklet`)** read from disk,
  with name + thumbnail + modified date. Not the localStorage blob.
- **Opening** a menu reads that file into the editor; **saving** writes it back to the
  same file (atomic, with the OneDrive retry already in place).
- The renderer store keeps only the **working document** + preferences + undo history —
  not the entire library. `localStorage` becomes a fast cache of the *open* document and
  settings, not the source of truth for all menus.
- **Templates never appear in the Open list.** Open = `Menus/` only. Templates are
  reached solely through **New → From Template**, listing `Templates/*.template`.

### Plumbing (the IPC surface + store split)

Main process (`src/main/`, a new `menus.ts` mirroring `templates.ts`), all through the
existing `atomicWriteFile` + directory-watch:

- `menu:list(storage)` → `[{ path, name, kind, modified, thumbnailRef }]` — reads
  `Menus/`, `.menu` + `.booklet`, from the **index cache** then reconciles with disk.
- `menu:read(path)` → the document `state` (validated, version-gated).
- `menu:save(path, state)` → atomic write to `path` (or Save-As dialog when no path).
- `menu:reveal(path?)` → open the file/folder in Explorer.
- `menu:delete(path)` → move to the OS recycle bin (never hard-delete).

Renderer store split (`src/renderer/store.ts`):

- Today `AppState.menus[]` holds the whole library. **New:** the store holds the single
  **open document** (`currentMenu`), its file path, preferences, and undo history.
- The Home **Open** pane renders `menu:list` results (file cards), not `state.menus`.
  Clicking a card → `menu:read` → load into the editor (with the dirty guard).
- Save → `menu:save(currentPath, state)`; New → clears the working document; Save-As →
  dialog into `Menus/`.
- `griffinSeed()` stops seeding an in-memory library; the real menus are seeded as files
  instead (§4). The store's initial working document is the most-recent file (or a blank).

### Library index + thumbnails (performance)

Parsing every `.menu` to list the library would be slow with many files. So:

- `library-index.json` (AppData) caches `{path, name, kind, modified, thumbnailRef}` per
  file. The Home library renders from the index **instantly**, then reconciles against
  disk.
- The index is a **cache, not the truth** — it is rebuilt from the files, and kept fresh
  by the directory `fs.watch` already added for OneDrive external-change detection.
- Thumbnails are rendered once and cached in AppData keyed by content hash.

---

## 4. Seeding (first run)

On first launch (marker-gated in each folder, so user deletions stick):

- **Menus/** ← seed the Griffin's **real menus**, bundled with the app as `.menu` files
  (transcribed from the supplied PDFs/Word docs into the menu model). Result: a new
  install opens with the restaurant's actual menus ready to edit — none preloaded as
  AppData JSON.
- **Templates/** ← seed the built-in templates as `.template` files (built-in flag
  preserved; the code array remains a fallback so they always appear).
- **brand-assets/** ← seed the bundled starter brand assets (System 4).

Seeding reuses the atomic-write path; a failed seed is non-fatal (the code fallback
still shows built-ins/assets).

---

## 5. File format details

Wrapper (shared by all kinds):

```jsonc
{
  "app": "Griffin Menu Studio",
  "kind": "menu",            // "menu" | "template" | "booklet"
  "version": 1,
  "savedAt": "2026-07-11T…",
  "generator": "1.2.0",       // app version that wrote it
  "assets": { "…": "data:…" },// embedded brand assets on export (portability)
  "state": { "menu": { … } }  // or { "template": … } / { "booklet": … }
}
```

- Extensions: `.menu`, `.template`, `.booklet`. Filters in Open/Save dialogs are
  per-kind.
- Size caps per kind (e.g. 10 MB menu, 2 MB template), checked before read.
- Validation is structural + version-gated; newer versions rejected with a clear message.
- Safe filenames (strip illegal chars, avoid reserved Windows names) — already in
  `safeFileStem`.

---

## 6. Recent files, autosave, backups

- **Recent files** (`recent.json`): the last N opened documents (path + timestamp),
  surfaced in Home and File → Open Recent. Stale entries (moved/deleted) are pruned.
- **Autosave / crash recovery** (`recovery/`): unchanged in spirit — snapshots the open
  document on an interval and on edit; a crash surfaces the recovery modal. Now tied to
  the document's file path so recovery names the file it came from.
- **Backups** (`backups/`): a rolling copy of each saved document (last N versions),
  giving a lightweight "previous versions" safety net independent of OneDrive.

---

## 7. OneDrive behaviour (already implemented + this design)

- Atomic writes (temp → fsync → rename) so a partial file is never synced. ✔
- Retry on transient EBUSY/EPERM locks (OneDrive/AV). ✔
- Directory watch → "changed on disk — Reload" prompt. ✔
- Index/thumbnails/recovery/backups in AppData so they never sync. (this design)
- Sync-conflict copies (`Name-PC.menu`) surfaced through the existing conflict dialog.
  (follow-up)
- Files-On-Demand placeholder awareness — show "Downloading from OneDrive…" instead of a
  silent slow read. (follow-up)

---

## 8. Migration from today's model

On first launch after this ships (all steps idempotent, marker-gated, atomic):

1. Move any existing `localStorage` library menus into `Menus/` as `.menu` files.
2. Move legacy AppData user templates into `Templates/`, re-saved as `.template`.
3. Rename the template extension `.menu → .template` for existing user templates.
4. Build the initial `library-index.json` and thumbnails.
5. Keep `localStorage` only as the open-document + settings cache thereafter.

Nothing is deleted; the old blob is read once to migrate, then superseded.

---

## 9. Implementation order

1. **Real menus** — transcribe the supplied PDFs/docx into `.menu` documents; bundle +
   seed into `Menus/` on first run. *(in progress)*
2. **Template extension** — `.template` (distinct from `.menu`); update
   `template-format.ts`, seeding, filters, migration.
3. **File-based library** — `menu:list`/`menu:read`/`menu:save`/reveal IPC; Home Open list
   reads `Menus/`; open/save go through files; templates excluded from Open.
4. **Index + thumbnails** — AppData cache for instant listing.
5. **Recent files + backups**.
6. **Booklets** get `.booklet` when System 5 lands.

---

## 10. Definition of done

- A fresh install opens with the Griffin's real menus in
  `Documents/Griffin Menu Studio/Menus`, each a separate `.menu` file.
- Templates are `.template` files in `Templates/`, shown only under New → From Template,
  never in the Open list.
- The Home Open list is a live view of the Menus folder; opening/saving is
  file-in / file-out, atomic and OneDrive-safe.
- Exports land in `Exports/`; recovery, backups, thumbnails, brand assets and the index
  live in AppData and never sync.
- Everything the user owns is a browsable file; nothing important hides in a JSON blob.
