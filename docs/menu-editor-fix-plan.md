# Griffin Menu Studio — Review Fix Plan

Grounded plan for the 25 review issues (+ auto-update). Each item lists the
**symptom**, the **root cause** with `file:line` anchors, the **fix**, an
**effort** estimate (S ≈ minutes, M ≈ an hour or two, L ≈ a day+), and **risk**.

Issues are grouped into phases by effort/risk so they can be executed
usage-efficiently (see *Execution strategy*).

---

## Execution strategy (usage-aware)

Per the request to conserve credits:

- **Phase 0 (quick correctness)** and **Phase 1 (medium)** items are mostly
  mechanical, well-localised edits → run them through a **Workflow with Sonnet
  agents**, one coherent item per stage, each verified by `npm run typecheck` +
  `npm test` and committed on `rebuild-vite-ts`.
- **Phase 2 (architectural)** — the dockable panel system and the app-data/
  template reorg — needs design judgement and touches many files → **Opus**,
  done interactively (not fanned out blindly).
- **Phase 3** is a QA regression sweep (issue 22).
- Two **cross-cutting prerequisites** should land first because later items
  depend on them (see below).

### Cross-cutting prerequisites (do first)

- **P1 — `selectedSectionId` state.** No "current section" concept exists today
  (`grep` for `selectedSection`/`activeSectionId` → nothing). Needed by **#12**
  (add-dish targets selected section) and **#21** (reuse click-to-add). Add
  module state in `src/renderer/views/editor.ts` (mirror `selectedMoveKey` in
  `src/renderer/panels/window-panels.ts:49`), set on click/focusin in a `.sec`
  block, default to first/last when unset, expose a getter.
- **P2 — one canonical "does it fit" measurement.** The editor chip and the
  export preflight measure **different DOM** (edit-mode vs print-mode), which is
  the root of **#6** and contributes to **#3/#10/#13** preview↔export drift.
  Extract `measureFit(menu): ProductionInfo` (print-mode, `edit:false`,
  unscaled) and have both `autoFitOnePage()` and `preparePrintDOM()` use it.

---

## Phase 0 — Quick correctness wins

### #1 — Dietary key doesn't show newly-added codes  · S · low
- **Symptom:** adding a *new* allergen code to a dish doesn't add it to the key
  at the bottom; editing/deleting existing codes does affect the key.
- **Root cause:** derivation is correct — `usedCodes()`
  (`src/shared/menu/tags.ts:35-44`) already builds the key as the union of codes
  actually used. The bug is **staleness**: typing a new code in the Dietary Key
  panel commits only `['preview']` (`src/renderer/panels/window-panels.ts:614-623`),
  so the per-dish tag buttons (`src/renderer/views/editor.ts:88-93`) aren't
  re-rendered and keep a stale/blank `data-tag`. Clicking that stale button adds
  `T('')` — a phantom tag with empty code that `usedCodes()` never surfaces.
- **Fix:** on blur of a code input, refresh the `'editor'` scope (or DOM-patch
  the affected tag button) so buttons carry the real code; guard the tag-toggle
  handler (`editor.ts:248-262`) against empty `c` so no phantom tag is created.
  Consider merging the duplicate key editor in `src/renderer/views/settings.ts`
  (dead code — see #11) in the same pass.

### #3 — Hiding a dish doesn't remove it from the preview  · S · low
- **Symptom:** toggling a dish hidden dims the editor row but the dish still
  shows on the preview page (export is actually correct).
- **Root cause:** the hidden filter is gated on `edit === false`
  (`src/shared/menu/render.ts:293-297`), but preview always renders with
  `edit:true` (`src/renderer/views/preview.ts:35-37,62`), so hidden dishes are
  never filtered in preview. Export uses `edit:false` (`preview.ts:382`) → fine.
- **Fix:** always filter hidden dishes regardless of `edit`:
  `section.items.filter(it => !isDish(it) || !it.hidden)` in `render.ts:293-297`.
  One line; makes preview and export consistent.

### #4a — A line below/above all sections should auto-become the end/top line  · S · low
- **Symptom:** a divider that ends up past all sections silently disappears.
- **Root cause:** section deletion (`src/renderer/views/editor.ts:314-321`)
  filters out the section but never cleans `menu.rootRules`. A rule whose
  `afterSectionId` pointed at the deleted section becomes orphaned — it matches
  no render loop (`render.ts:301-308`) and vanishes while staying in the model.
- **Fix:** add `normaliseRootRules(menu)` in `src/shared/menu/normalize.ts`
  (call from `normaliseMenuColumns` and from the `secdel` handler): re-home any
  rule whose `afterSectionId` no longer exists — promote to
  `{position:'bottom', afterSectionId:null}` if it was after the last section,
  `{position:'top', afterSectionId:null}` if the first, else reattach to the new
  neighbour.

### #23 — Add "line at top" above all sections  · S · low
- **Root cause:** only `+ ADD LINE AT END` exists (`editor.ts:163`, handler
  `editor.ts:298-304`). No click path creates a `position:'top'` rule (drag
  only).
- **Fix:** add a `+ ADD LINE AT TOP` button near the top drop-zone
  (`editor.ts:119-120`) with `data-pos="top"`, and branch the `addrootrule`
  handler to `newRule('top', null)`. Optional `insert-rule-top` command
  mirroring `insertRule` (`src/renderer/commands.ts:286-290`).

### #13 — Blank column titles still show "Column N" / don't reflow  · S · low
- **Root cause (two parts):** (1) `src/shared/menu/normalize.ts:22` uses
  `s.columnNames?.[i] || \`Column ${i+1}\``, so an empty string is re-injected
  with a default label on every normalise pass; (2) `render.ts:238-242` emits
  the `.m-subh` title row whenever `edit` is true (always, in preview), so the
  row's height is reserved even when blank and dishes never move up.
- **Fix:** in `normalize.ts:22` don't inject a default for existing/new slots
  (use `?? ''`); in `render.ts:240` change the condition to `if (colName.trim())`
  so an empty title emits no row and dishes reflow. Adding a title still works
  via the rail `.colname` input (`editor.ts:145,190-197`).

### #7 / #14 — Menus column hidden by default  · S · low
- **Root cause:** `railHidden` defaults to `false`
  (`src/shared/settings-format.ts:30` and `src/shared/brand/griffin-seed.ts:658`),
  and the "hide by default" guard in `src/renderer/app.ts:45` is unreachable
  because the normaliser always coerces `railHidden` to a concrete boolean.
- **Fix:** set `railHidden: true` in both `settings-format.ts:30` and
  `griffin-seed.ts:658`; remove the dead guard in `app.ts:45`. (The toggle
  itself and `.main.noRail` CSS already work.) Longer term this column becomes a
  dockable panel — see #2/#8.

### #16 — Edit-header should have a Settings link to Home ▸ Settings  · S · low
- **Root cause:** the navigation primitive already exists
  (`goHomePane('settings')`, `src/renderer/commands.ts:317`); the `.ed-head`
  panel (`src/renderer/shell/app-shell.ts:142-150`) just has no control for it.
- **Fix:** add `<button class="iconb" data-cmd="settings" title="Settings">…`
  to `.ed-head`. No JS wiring needed — global `[data-cmd]` delegation handles it.

### #19 — Top bar should be an OS drag region  · S · low
- **Root cause:** window is frameless (`titleBarStyle:'hidden'`,
  `src/main/main.ts:111-116`) but `.top` (`src/renderer/styles/editor.css:16`)
  never sets `-webkit-app-region: drag`. The correct pattern exists only on the
  **dead** `.titlebar` class in `src/renderer/styles/app.css:57` (unused).
- **Fix:** add `-webkit-app-region: drag` + `user-select:none` to `.top`, and
  `-webkit-app-region: no-drag` to `.modepill button` (and any future
  interactive child). Flag `app.css`'s dead `.titlebar` block for cleanup.

### #25 — Inconsistent padding (e.g. the "Fast edit" tip box)  · S · low
- **Root cause:** `.quickhint` uses `margin:0 10px 9px`
  (`editor.css:364`) → zero top margin, flush against the note strip above; same
  asymmetry on `.sec-smartbar` (`editor.css:349`, `padding:0 10px 9px`). Broader
  drift across `.sec-h/.sec-note-in/.addrow/.addsec/.foot-ed/.addrootline`.
- **Fix:** introduce spacing tokens (`--ed-gap-sm/md`, `--ed-pad-x`) and apply
  consistently; minimal targeted fix is symmetric `margin:9px 10px` on
  `.quickhint` and a matching top value on `.sec-smartbar`.

### #6 — Shrink-to-fit then export still warns  · M · medium  *(uses P2)*
- **Symptom:** editor says "fits", export still flags overflow.
- **Root cause:** `autoFitOnePage()` shrinks/measures the **edit-mode**
  `#pagewrap` (`src/renderer/views/preview.ts:316`, `edit:true`), but
  `preparePrintDOM()` measures the **print-mode** `#printRoot`
  (`preview.ts:382`, `edit:false`). The two renderings differ (hidden dishes,
  empty-field placeholders, movable wrappers, skipped empty sections), so a
  `sc/dn` that fits the edit shape may not fit the print shape.
- **Fix:** implement **P2** — `measureFit(menu)` on the canonical `edit:false`
  DOM; make the shrink loop calibrate against it and the editor chip consult it
  (or relabel the chip as an editing aid). Fixing #3 (always filter hidden) also
  removes one source of divergence.

---

## Phase 1 — Medium features

### #5 — Global + per-section "show prices"; auto-enable on price entry  · M · medium
- **Root cause:** only per-section `Section.prices` exists
  (`src/shared/types.ts:42-51`, checked at `render.ts:194,212`); there is **no
  global show-prices flag** and typing a price never enables it.
- **Fix:** add `MenuStyle.showPrices?: boolean` (default via `!== false`),
  thread it through `renderMenuHTML → sectionHTML → renderDish` so the price
  checks become `section.prices && showPricesGlobal && …`. Add a global toggle
  UI (beside the dietary-key checkbox). On price entry
  (`editor.ts:199-206` and inline `preview.ts:128-138`), when non-empty set the
  owning `section.prices = true` and `style.showPrices = true`, committing a
  scope that refreshes the toggles.

### #24 — When "print dietary key" auto is OFF, allow manual editing of the key text  · M · medium
- **Root cause:** `render.ts:314-321` is a hard `if (style.showKey)` with no
  else, and `.m-key` is not wrapped in `editableSpan` (always auto/plain).
- **Fix:** add `Menu.dietKeyText?: string`; when `showKey` is on render the
  auto `usedCodes()` text (plain), when off render `.m-key` from `dietKeyText`
  via `editableSpan(edit, 'menu.dietKeyText', …)` (same pattern as
  `menu.footer`); add the path to `applyEdit` (`preview.ts`); seed `dietKeyText`
  with the current auto text when the toggle flips off. Update the label.

### #20 — Add a subtitle when a template lacks one  · M · medium
- **Root cause:** `menu.headerNote` **is** the subtitle and already renders an
  empty editable span in edit mode (`render.ts:278-285`), but `editableSpan`
  emits no placeholder/min-height so an empty one is invisible/undiscoverable.
- **Fix:** add a visible `+ Add subtitle` control in the header meta row
  (`app-shell.ts:142-150`) and an Insert command
  (mirror `insertSection`, `commands.ts:272-284`); add a
  `.m-hnote[data-edit]:empty::before{content:"Add a subtitle…";opacity:.4}`
  affordance in `menu.css` so it's discoverable on-canvas.

### #10 — Click-to-edit on the preview  · M · medium
- **Root cause:** it already works for name/desc/price/notes/section/columns
  (`editableSpan` + `preview.ts` focus handlers). The reported failure is one of
  two: (a) **tag pills `.m-tg` and `(note)` `.m-nt` are non-editable by design**
  (`render.ts:71-75`) yet look identical to editable text, or (b) **Arrange mode
  leaves `contentEditable=false`** (`preview.ts:78-82`) if left on.
- **Fix:** first confirm which at runtime (check `moveMode`/`contentEditable`).
  For (a) either route tag/note clicks to the corresponding editor field or give
  them a clearly non-editable style (`cursor:default`, no hover box). For (b)
  make `moveMode` authoritative from a single source read at render time.

### #12 — Clearer selected section; add-dish targets it  · M · medium  *(uses P1)*
- **Root cause:** no selection state; global `insertSection`/`insertDish`
  (`commands.ts:272-284`) always target the last section.
- **Fix:** build on **P1**: render `.sec.selected` highlight, and make
  `insertSection`/`insertDish` insert relative to `selectedSectionId` (fallback
  to append).

### #11 — Home ▸ Settings: many more defaults  · M · medium
- **Root cause:** `AppDefaults` is thin (`types.ts:125-132`); `defaults.blush`
  is parsed but never read (dead); no defaults for show-prices, show-key, or
  spacing; `newSection`/`DEFAULT_STYLE` hardcode `prices:true`/`showKey:true`.
- **Fix:** extend `AppDefaults` (+ `settings-format.ts` sanitiser) with
  `showPrices`, `showKey`, `colour` (wire the dead `blush`), and a spacing seed;
  add controls to the Settings "Defaults" card
  (`workspaces/index.ts:349-355`, handler `493-514`); apply them in
  `createBlankMenu()` (`workspaces/index.ts:205-226`). Remove dead
  `src/renderer/views/settings.ts` (`#ovSettings` modal, never mounted).

### #9 — Merge Colour into the Spacing/Layout window  · M · low
- **Root cause:** two separate `registerFloatWindow` calls
  (`window-panels.ts:338-339`); handlers already share the delegated
  `#floatLayer` listeners.
- **Fix:** one combined body (`colourBody` + `spacingBody`), a single
  registration titled "Colour & Spacing", drop the retired id from the
  `WindowPanel` union + commands + Window menu markup; also fix the refresh-list
  gap where `spacing` isn't in the `on('all', …)` subscription. *(Folds into the
  panel-system work in #2/#8.)*

### #15 — Export preview: same rulers + zoom, and centre it  · M · medium
- **Root cause:** the Export pane is a separate, weaker structure
  (`workspaces/index.ts:632`) with a hardcoded `transform:scale(.68)`
  (`editor.css:134`), no rulers/zoom, and horizontal-only centering. The
  editor's ruler/zoom apparatus (`layout-runtime.ts:43-162`) is hardcoded to the
  editor DOM ids.
- **Fix:** generalise `applyZoom/renderRulers/fitPage/setZoom/scheduleRulers` to
  take a target-id config (or factor a reusable "preview stage" component); emit
  the same `stage-body`/ruler/`stage-zoombar` markup in the export pane with new
  ids; centre via `display:flex` + `margin:auto` like the editor
  (`editor.css:384,387`).

### #21 — Split "Find across menus" into Find-&-Replace vs Reuse; reuse click-to-add  · M · medium  *(uses P1)*
- **Root cause:** `finderBody()` combines reuse + find + replace in one window
  (`window-panels.ts:186-211`); the reuse list is drag-only (no click handler in
  `onLayerClick`, `502-519`). The menu bar already has distinct Edit▸Find and
  Insert▸Reuse items pointing at the same command (`app-shell.ts:46,58`).
- **Fix:** split into two windows (`find-replace`, `reuse`) with their own
  commands; point the existing distinct menu items at them; add a
  `[data-reuse-index]` click case that clones (`cloneDish`, `window-panels.ts:78`)
  into `selectedSectionId` (**P1**) — reuse the proven click-to-add pattern in
  `src/renderer/views/dishpicker.ts:57-76`; keep drag working too.

---

## Phase 2 — Architectural

### #2 / #8 — Photoshop-style dockable panel system  · L · high

This is the largest item — a **from-scratch panel manager**, not a tweak. The
current system (`src/renderer/panels/float-windows.ts`) is floating-only:
`snapMove` (96-121) merely aligns a window's *position* to edges; there is no
dock container, no tabbing, no stacking. The rail and editor columns are baked
into a fixed CSS grid (`editor.css:245`), outside the window registry. The dead
`.window-dock` CSS (`editor.css:175-176`) is a stub to build on or replace.

**Target model — a structured layout tree (NOT absolutely-positioned windows):**

```
Workspace
├── DockArea (left)        ├── DockArea (right)
│   └── DockColumn         │   └── DockColumn (resizable width)
│       └── PanelStack     │       ├── PanelStack (proportional heights)
│           └── PanelGroup │       │   └── PanelGroup (tabs)
│               └── Panel  │       │       ├── Panel
├── Document area (fills remaining space; never part of a group)
└── FloatingGroup[] (movable, resizable, tabbable, stackable, re-dockable)
```

Conceptual types: `DockArea → DockColumn → PanelStack → PanelGroup → Panel`,
plus `FloatingGroup`. Persist the whole tree (open/closed, dock side, column
order + widths, stack proportions, tab groups + order + active tab, floating
pos/size, collapsed/icon state) in settings; restore on launch. This replaces
`settings.floatWindows` (`src/shared/types.ts:170-176`).

**Suggested sub-phases (each independently shippable):**

- **2.0 — Registry migration.** Promote every current panel body
  (`window-panels.ts` bodies + the rail and editor column render functions) into
  `Panel` definitions `{id,title,icon,minW,minH,render()}`. Keep behaviour
  identical, default layout = today's arrangement, so nothing visibly changes yet.
- **2.1 — Layout tree + renderer.** Model `DockArea/DockColumn/PanelStack/
  PanelGroup`, render them into real DOM containers (replace the fixed
  `.main` grid and `.window-dock` stub). Document area = flex `1 1 auto`.
- **2.2 — Resizable dividers.** Draggable column-width dividers (reuse the rail/
  editor resize pattern in `src/renderer/views/editor.ts:702-761`) and draggable
  stack dividers using proportional heights + min constraints.
- **2.3 — Tabbed groups.** Multiple panels per group as tabs; select tab;
  drag-reorder tabs within a group.
- **2.4 — Drag & drop with previews.** Drag a **tab** = one panel; drag the
  **group header** = whole group. Drop zones with a small activation delay and a
  live placeholder (no continuous re-layout): onto tab-strip → tab; top/bottom
  edge → vertical split; left/right edge → neighbouring column; app outer edge →
  new dock; elsewhere → floating. Blue-highlight the target zone.
- **2.5 — Floating groups.** Pull-out to float; float groups tab/stack/redock.
  In-app surfaces (not OS windows) unless multi-monitor is explicitly wanted.
- **2.6 — Collapse to icon dock** + flyouts (click icon → temporary flyout over
  the document; Esc/click-away closes; pin to expand). Double-click tab/header →
  minimise a group to its header.
- **2.7 — Window menu + workspaces.** Window menu lists every panel with a tick
  when open; selecting opens/brings-to-front/expands/activates-tab. Add
  **EDIT MENU** and **MENUS** entries (the promoted editor + rail panels, #8).
  Named workspaces (Default/Editing/Styling/Print/Compact/Custom): save,
  switch, update, rename, delete, **Reset Workspace**, restore original default.

**Behavioural rules to honour** (from the spec): dragging a tab moves one panel;
dragging a header moves the group; drop-on-tabs = tab; top/bottom edge = vertical
split; left/right edge = neighbour column; app edge = dock; elsewhere = float;
dividers resize adjacent regions; document fills unused space; closing a panel
never deletes data; opening an open panel brings it to front (no duplicate);
empty groups/columns/docks self-remove; every change is saved; no undo for panel
moves but Reset Workspace is always available.

**Definition of done:** open any panel from the Window menu; drag a panel into
another as a tab; split a column above/below; form a new column beside another;
resize every column and stacked region; float any panel; combine floats into
tabs/stacks; redock; collapse a dock to icons and restore; close/reopen without
losing settings; save/restore the full workspace; reset to default. Feels like
one coherent workspace, not pop-up boxes.

> **Note:** #7/#14 (menus hidden by default), #9 (merge Colour+Spacing), and #16
> (edit-header settings link) are small and can ship in Phase 0/1, then be
> absorbed by this system when the rail/editor/panels all become dockable panels.

### #17 / #18 — Template storage + app-data reorganisation  · L · medium
- **Current:** built-in templates are compiled-in TS objects
  (`src/shared/templates/builtins.ts`) that never touch disk; user templates are
  `.menu` files (extension collides with menu documents) under
  `<userData>/templates/user` (`src/main/templates.ts:9-13`). Recovery lives in
  `<userData>/recovery`; menus are user-chosen paths. `StorageLocations` declares
  `thumbnailFolder`/`backupFolder` that are **never read** (dead).
- **Fix:**
  1. **Seed built-ins to disk** in a `templates/built-in/` folder beside
     `templates/your-templates/`; have listing merge both from disk (removes the
     duplicated renderer `allTemplates()` in `workspaces/index.ts:137-138` and
     `views/gallery.ts:39-40`).
  2. **Rename for clarity** and give user templates a distinct extension (e.g.
     `.grifftpl`) to end the `.menu` collision
     (`shared/template-format.ts:7` vs `document-format.ts:6`).
  3. **One app-data root**, e.g.
     `<userData>/griffin-data/{templates/{built-in,your-templates}, recovery,
     backups}`; update `recovery.ts:48-51` + template helpers.
  4. Either wire real `backupFolder`/`thumbnailFolder` behaviour or delete those
     dead `StorageLocations` fields + sanitisers.
  5. Surface it in Settings: show all locations and wire the already-implemented
     but unreachable `template:revealFolder` (`main/templates.ts:118-123`).

---

## Phase 3 — QA

### #22 — Test all similar/adjacent features  · M
After each phase, regression-sweep the neighbours of what changed:
- Dietary key: add/edit/delete codes, per-dish tagging, auto vs manual key,
  export parity.
- Prices: per-section + global toggles, price entry auto-enable, export.
- Lines: add at top/end/between, section delete/reorder promotion, drag zones.
- Sections/dishes: selection highlight, add-dish/add-section targeting, hide,
  columns (blank titles, reflow), drag reorder.
- Preview editing: every editable field, Arrange mode on/off.
- Overflow: shrink-to-fit → export parity across paper sizes and zooms.
- Export: rulers/zoom/centre; PDF + PNG.
- Panels: the full Definition-of-done checklist above.
- Templates/app-data: create/save/import/reveal; built-ins visible; recovery.

Verify via `npm run typecheck` + `npm test` and a real Electron run (the headless
preview can't exercise `window.griffin`, rulers, or export).

---

## Distribution — auto-update via GitHub  · #26 · M

Goal: keep developing after sharing the `.exe`; recipients get notified of
updates and install them in-place.

Squirrel already produces `Setup.exe` + `.nupkg` + `RELEASES`, so:

1. **GitHub repo** for the project (add a remote to the existing repo).
2. **`@electron-forge/publisher-github`** in `forge.config.ts` → `npm run publish`
   builds and uploads the Squirrel artifacts to a GitHub Release.
3. **`update-electron-app`** in `src/main/main.ts` (after the squirrel-startup
   guard) pointed at `update.electronjs.org` — polls, downloads in the
   background, and shows a native "new version — restart" prompt; Squirrel swaps
   it in silently (no re-install, no SmartScreen prompt on updates).
4. **Version bump every release** (`package.json`); remember the MSI drops the
   `-rc.x` prerelease tag, so use clean numeric versions (`1.0.1`, `1.0.2`).

**Repo visibility decision:** `update.electronjs.org` is free but needs a
**public** repo. Options:
- Public repo (free, simplest) — code (incl. seed menus) is visible.
- **Private code repo + a separate public "releases" repo** (recommended) — keep
  working privately; the update service only reads release assets.
- Private repo + self-hosted update server (e.g. Hazel) — most control, most
  setup.

Add code signing later (see `docs/windows-release-process.md`) to also remove the
first-run SmartScreen prompt; not required for updates to work.

---

## Suggested order

1. **P1, P2** (prerequisites).
2. **Phase 0** quick wins (#1, #3, #4a, #23, #13, #7/#14, #16, #19, #25, #6).
3. **Phase 1** medium (#5, #24, #20, #10, #12, #11, #9, #15, #21).
4. **#26** auto-update (parallelisable; unblocks sharing WIP).
5. **Phase 2** architectural (#2/#8 panels, then #17/#18 app-data).
6. **Phase 3** QA sweep (#22) after each phase.
