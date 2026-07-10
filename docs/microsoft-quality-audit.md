# Microsoft-Quality Pass — Phase 0 Audit & Baseline

_Baseline captured on branch `rebuild-vite-ts`. This is the starting reference for the
quality pass; it is factual, not aspirational. Code is treated as source of truth over
older docs (`docs/ui-design.md` still contains obsolete catalogue wording — the
catalogue is gone and must not return)._

## Baseline commands

| Check | Result |
| --- | --- |
| `npm.cmd test` | **20 passed / 20** (5 files: template-format, layout-math, document-format, find-replace, file-storage) |
| `npm.cmd run typecheck` | **clean** (`tsc --noEmit`, no errors) |
| `npm.cmd start` | Not run in this non-interactive session — Electron desktop window cannot be observed via the web-preview tooling. Live/manual QA and startup-timing capture are deferred to Phase 3 instrumentation and an interactive run. |

Startup milestone timings were **not** measured at baseline: the current boot path has no
instrumentation (see Phase 3 gap below). Real numbers will be produced once the startup
orchestrator records durations. No performance numbers are invented here.

## Concurrency / file ownership

Codex is editing the same worktree. At audit time `git status --short` showed both agents' work
in flight (e.g. new `src/main/file-storage.ts` + `tests/file-storage.test.ts` appeared during the
audit). **All uncommitted changes are preserved; nothing is reverted.** Codex-owned areas
(`document-format.ts`, `template-format.ts`, `menu/**`, `documents.ts`, `templates.ts`,
`export-handlers.ts`, `views/preview.ts` and their tests) are left alone except for the smallest
compatible contract changes, which will be called out explicitly.

## Architecture as-built

- **Renderer boot** (`src/renderer/app.ts`): `mountAppShell()` injects the whole shell markup
  string, then wires views (rail/editor/gallery/dishpicker/settings/backup/preview), workspaces,
  window panels, help, command dispatch and a hardcoded keyboard handler.
- **Shell markup** (`src/renderer/shell/app-shell.ts`): single `String.raw` template — top bar,
  mode pill (Home/Editor/Export), 7 top menus (File/Edit/Menu/Arrange/View/Window/Help), quick
  toolbar, rail, editor pane, stage, dock, home + export workspace mounts, and legacy overlays
  (`ovTpl`, `ovDish`, `ovSettings`).
- **Workspaces** (`src/renderer/workspaces/index.ts`): Home (Open/New/Templates/Dishes/Settings)
  and Export (Print/PDF/PNG/Save As) are already built with green-nav backstage layouts.
- **Window panels** (`src/renderer/panels/window-panels.ts`): Menus/Dishes/Finder/Style/Arrange
  dock panels; find-replace + reuse + align implemented.
- **Command dispatch** (`src/renderer/commands.ts`): one `runCommand(name)` switch; `[data-cmd]`
  click delegation. **Not** a registry — carries no labels/shortcuts/enabled/checked state.
- **Help** (`src/renderer/help/help.ts`): overlay with a **separate** `TOOLS[]` list.
- **State** (`src/renderer/store.ts`): AppState in localStorage (`griffinMenuStudio.v2`),
  full-JSON snapshot undo/redo (cap 80), scope listeners (rail/editor/preview/all). No autosave,
  no recovery, no settings versioning/migration.
- **Main** (`src/main/main.ts`): creates splash + main window on `ready`; splash closes on main
  `ready-to-show`. Global `mainWindow` assigned per create (never read for routing).
- **IPC** (`src/main/ipc.ts`): all privileged handlers derive their window via
  `requireWin(e.sender)` — multi-window-safe at the boundary. Payload validation is delegated into
  Codex-owned `documents.ts`/`export-handlers.ts`.
- **Preload** (`src/preload/preload.ts`): narrow typed `griffin` bridge; renderer never touches
  `ipcRenderer`/Node directly. `contextIsolation: true`, `nodeIntegration: false`.

## Command / control inventory

Every `data-cmd` value in the renderer maps to a real `CommandName` case in `runCommand` — **no
dead menu/toolbar controls**. Distinct commands: new-blank, new-template, new-window, open, save,
save-as, duplicate, delete-menu, save-template, import-templates, reveal-templates-folder, backup,
restore, export-pdf, export-png, print, undo, redo, copy-dish, settings, zoom-in, zoom-out,
fit-width, actual-size, arrange-toggle, reset-all-positions, auto-fit, toggle-rail,
toggle-{menus,dishes,finder,style,arrange}-panel, go-{home,editor,export}, help-{tools,tips,
tutorial,shortcuts,saving}, about. (`data-cmd="…"` and `${esc(tool.command)}` are template
artefacts, not literals.)

Non-`data-cmd` controls exist and are wired: `data-act="topmenu"`, `data-home-pane`,
`data-export-pane`, `data-template-id`, `data-open-menu`, `data-setting-*`, `data-browse-storage`,
dock `data-*`, and id-wired inputs (`edName`, `edPaper`, sliders, etc.).

### Misleading / inert controls to fix

- `src/renderer/shell/app-shell.ts:105` — quick toolbar has a **`go-export` icon button**. Spec
  forbids a second Export shortcut beside the mode pill. **Remove.**
- `src/renderer/workspaces/index.ts` Export panes — several `<select disabled>` presented as
  settings (PDF Paper/Scaling, PNG Background/Source, Save-As Format/Contains). They imply choices
  that don't exist. **Replace with honest static rows.**
- Save-As pane says _"Menus, templates and settings"_ — spec: a `.menu` must not claim to contain
  the whole library/settings. **Correct the copy.**

## Highest-risk defects (ranked)

1. **No single command registry (Phase 2).** Labels/shortcuts/enabled/checked state live in three
   places (HTML, `commands.ts`, `help.ts TOOLS`). They will drift. Ctrl+K search is absent.
2. **Splash is not real startup (Phase 3).** `splash.html` shows a static "Starting…", cream
   background (spec wants brand-green outer + cream panel), no min-duration (1800ms), no
   renderer-ready handshake, no watchdog, no task orchestrator/instrumentation. Splash status never
   updates (no splash IPC bridge).
3. **`new-blank` double-fires** (`commands.ts:127`) — `createBlankMenu()` **and**
   `window.griffin?.newDocument()`. Two menu-creation paths in one command.
4. **No autosave / crash recovery / settings migration (Phase 8).** Only localStorage + desktop
   save. No clean-exit marker, no recovery surface.
5. **Multi-window cleanup (Phase 7).** IPC is sender-safe, but `main.ts` keeps a mutable global
   `mainWindow`, has no window/session manager, no per-window dirty/close flow, no bounds persist +
   clamp, no atomic save / external-change conflict detection, no offset for new windows.
6. **No first-run setup or guided tutorial (Phase 4).** Help has a static "tutorial" topic only.
7. **Design tokens ad-hoc & duplicated (Phase 1).** `app.css` mixes `--copper`/`--accent`/
   `--copper-hi`; no spacing/type/control-height/z-index/motion scales. `splash.css` redefines
   `--copper/--cream/--ink/--muted` independently. No shared control primitives (buttons/inputs/
   dialogs unified only by convention).
8. **Legacy overlays still present** (`ovTpl`, `ovSettings`, `ovDish`) alongside the newer Home/
   backstage surfaces — two ways to do New/Settings/Copy-a-dish. Consolidate to avoid drift.

## Encoding

**No mojibake found.** Ripgrep for `Ã|Â|â€|ï¿½|U+FFFD` across `src`, `index.html`, `splash.html`
returned nothing. All `£` occurrences (`editor.ts`, `griffin-seed.ts`, `builtins.ts`) are genuine
UTF-8. The Phase-1 "fix encoding" task is effectively already satisfied; verify again after any
new user-facing strings land.

## Security posture (baseline — acceptable, with hardening notes)

- ✅ `contextIsolation: true`, `nodeIntegration: false` (`main.ts:60-64`).
- ✅ Narrow typed preload; no raw `ipcRenderer` in renderer.
- ✅ Restrictive CSP in `index.html` and `splash.html` (`default-src 'self'`; no remote script).
- ✅ `setWindowOpenHandler` denies new windows; external `http(s)` routed to `shell.openExternal`.
- ⚠️ No renderer `sandbox: true` yet (verify compatibility before enabling).
- ⚠️ No `event.senderFrame` origin check on privileged IPC (low risk for a local app; note for
  hardening).
- ⚠️ IPC payload validation is delegated into Codex-owned handlers — must confirm each does runtime
  validation, not TS-only.

## Phase status snapshot

| Phase | State at baseline |
| --- | --- |
| 0 Audit | **this document** |
| 1 Design system | Partial — tokens exist, not unified; no primitives |
| 2 App shell / command registry | Shell built; **registry missing**; Ctrl+K missing; stray Export button |
| 3 Splash / startup orchestration | **Largely missing** |
| 4 First-run / installer / tutorial | Installer = Squirrel default; **first-run + tutorial missing** |
| 5 Home backstage | Well advanced; thumbnails eager, recents not `.menu`-file-backed |
| 6 Editor coherence | Core editor works; save-state/toasts/context-menus to add |
| 7 Multi-window / lifecycle | IPC sender-safe; **session manager + safety flows missing** |
| 8 Recovery / diagnostics | **Missing** |
| 9 Export / print | Backstage built; disabled-select cleanup + preflight-return needed |
| 10 Accessibility / scaling | Not yet verified |
| 11 Performance | Not measured (needs Phase 3 instrumentation) |
| 12 Finishing details | Partial |

## Working order

Phases will land in dependency order, committing after each green
(`npm.cmd test` + `npm.cmd run typecheck`): **1 → 2 (registry+Ctrl+K, remove stray Export) → 3
(splash+orchestrator+watchdog) → 8 (settings/recovery foundation) → 4 → 5 → 6 → 7 → 9 → 10 → 11 →
12**, adjusting as Codex's concurrent work settles. Live app QA (the Manual QA Matrix) requires an
interactive Windows session and is tracked separately.
