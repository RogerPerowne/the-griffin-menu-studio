# Claude Code Prompt: Microsoft-Quality Product Pass

You are Claude Code Opus 4.8 working on the existing Griffin Menu Studio repository at:

```text
D:\dev\the-griffin
```

Your task is to turn the current release candidate from a capable but visibly AI-built application into calm, coherent, highly reliable Windows desktop software that could plausibly have been produced by a first-class Microsoft product team.

This is not a request to copy Microsoft Word visually. Use the best qualities of Word, Office Backstage, Windows 11, Illustrator and other mature creative tools: predictable behaviour, excellent information hierarchy, consistent controls, keyboard access, robust document handling, meaningful progress, strong recovery, and no visible controls that do nothing. Preserve Griffin's own identity.

Do not restart or rewrite the project. Improve the current Electron + TypeScript + plain HTML/CSS architecture in place.

## Product Context

Griffin Menu Studio is an offline Windows desktop application for restaurant staff to create, edit, save, reopen, print and export menus. It must be simple enough for an occasional user, but dependable enough to trust with the restaurant's real menu documents.

The established product rules are:

- Editable documents use `.menu`.
- User templates are individual `.menu` files in the Templates folder.
- Bundled Griffin templates are read-only; user templates are manageable.
- The Editor preview uses Griffin blush paper.
- PDF, PNG and Print output use a white page because the restaurant prints black ink onto pre-printed stock.
- Home is the first workspace shown on every normal app launch.
- Opening a `.menu` file from Windows may go directly to that document in Editor.
- Home has a brand-green left navigation column; all text and icons on green use brand pink.
- Home navigation is Open, New, Templates, Dishes, Settings.
- Dishes are independent content in each menu.
- There is no global catalogue, linked dish, inherited value, override or propagation model.
- Cross-menu functionality means deliberate `Reuse from another menu` and reviewed `Find across menus` operations.
- Print, PDF, PNG and editable Save As are distinct workflows.
- The Print page contains Print controls only. Do not put PDF or PNG export buttons on it.
- Multiple app windows must be supported so several menus can be edited independently.
- The app must work fully offline.

Read these before making changes:

```text
docs/ui-design.md
docs/revised-rc-plan.md
BUILD.md
package.json
forge.config.ts
index.html
splash.html
src/main/main.ts
src/main/ipc.ts
src/preload/preload.ts
src/shared/api.ts
src/shared/types.ts
src/renderer/app.ts
src/renderer/commands.ts
src/renderer/store.ts
src/renderer/shell/app-shell.ts
src/renderer/workspaces/index.ts
src/renderer/help/help.ts
src/renderer/panels/window-panels.ts
src/renderer/views/preview.ts
src/renderer/styles/app.css
src/renderer/styles/editor.css
src/renderer/styles/menu.css
src/renderer/styles/splash.css
```

Also inspect the full repository and the current running application. Treat the code as the source of truth when older documentation is stale. Note that `docs/ui-design.md` still contains obsolete catalogue wording; the catalogue has been removed and must not return.

## Collaboration And File Ownership

Codex is working in the same repository on isolated document-engine, template-engine, export-engine, test and packaging tasks. Preserve all current uncommitted changes. Never reset, revert, overwrite or delete a change you did not make.

Your primary ownership is the high-reasoning, cross-cutting product experience:

```text
index.html
splash.html
src/main/main.ts
src/main/startup/**
src/preload/preload.ts
src/preload/splash-preload.ts
src/shared/api.ts
src/shared/types.ts
src/renderer/app.ts
src/renderer/store.ts
src/renderer/startup/**
src/renderer/onboarding/**
src/renderer/shell/**
src/renderer/help/**
src/renderer/panels/**
src/renderer/workspaces/**
src/renderer/styles/app.css
src/renderer/styles/editor.css
src/renderer/styles/splash.css
forge.config.ts
vite.renderer.config.ts
tests/startup*.test.ts
tests/onboarding*.test.ts
tests/workspace*.test.ts
```

Codex currently owns these areas. Do not make broad changes in them unless an integration cannot be completed otherwise:

```text
src/shared/document-format.ts
src/shared/template-format.ts
src/shared/menu/**
src/main/documents.ts
src/main/templates.ts
src/main/export-handlers.ts
src/renderer/views/preview.ts
tests/document-format.test.ts
tests/template-format.test.ts
tests/find-replace.test.ts
tests/layout-math.test.ts
```

If you need a contract change in a Codex-owned file, make the smallest compatible change, call it out explicitly in your report, and do not refactor the surrounding module. Check `git status --short` before each phase and preserve concurrent edits.

Do not create a new app scaffold, migrate to React/Vue/Svelte, change the document model for aesthetic reasons, or replace working rendering logic.

## Quality Bar

The completed application should feel deliberate in every ordinary interaction:

- A first-time user can understand where to start without a manual.
- An experienced user is not repeatedly interrupted by onboarding.
- Every visible command works, is correctly disabled, or is removed.
- The same action has the same name, icon, shortcut and result everywhere.
- Errors explain what happened, whether data is safe, and what to do next.
- Save, autosave, recovery and close behaviour are trustworthy.
- Loading indicators correspond to real work.
- Keyboard-only operation is practical.
- Focus, hover, pressed, selected, disabled, loading, success, warning and error states are consistent.
- The app remains coherent at 100%, 125%, 150% and 200% Windows scaling.
- There are no layout jumps, white flashes, clipped controls, overlapping text, inert buttons or console errors.
- UI polish never changes menu geometry or export fidelity.

## Phase 0: Audit And Baseline

Before implementation:

1. Run `git status --short` and understand the dirty worktree.
2. Run `npm.cmd test` and `npm.cmd run typecheck`.
3. Run the app with `npm.cmd start`.
4. Inspect Home, Editor, Export, all menu-bar menus, all floating windows, dialogs, help, keyboard shortcuts, splash, open/save and print/export routing.
5. Inspect DevTools for runtime warnings and errors.
6. Capture baseline screenshots at representative desktop sizes.
7. Measure startup milestones where practical:
   - process start
   - Electron `ready`
   - splash created
   - main window created
   - main DOM ready
   - templates/settings/recovery ready
   - fonts ready
   - renderer interactive
   - main window shown
8. Inventory every `[data-cmd]` and every visible clickable control. Record whether it is implemented, disabled appropriately, duplicated, misleading or dead.
9. Identify visible mojibake and encoding corruption in UI strings.
10. Write a concise `docs/microsoft-quality-audit.md` containing the baseline, the command audit and the highest-risk defects.

Profile before optimising. Do not invent performance problems.

## Phase 1: One Coherent Design System

Create a restrained internal design system using CSS tokens and small reusable DOM helpers. Do not introduce a UI framework.

Unify:

- Griffin palette roles: brand green, brand pink, cream, blush, white print paper, ink, muted text, border, success, warning and error.
- Spacing scale, type scale, control heights, icon sizes, border radii, shadows, z-index layers and motion durations.
- Buttons: primary, secondary, quiet, icon-only and destructive.
- Inputs, selects, checkboxes, radio groups, segmented controls, steppers and search fields.
- Menus, popovers, dialogs, tooltips, toasts, skeletons, empty states and error states.
- Panel headers, section headers, workspace headings and status bars.
- Focus rings that are highly visible without looking generic.
- Disabled states that remain readable and clearly unavailable.

Use no more visual decoration than the task needs. Avoid gradients, glass effects, giant headings, excessive cards, excessive rounded pills and decorative blobs. Cards should be modestly rounded. Griffin green and pink are deliberate brand signals, not wallpaper for every surface.

If an icon library is introduced, use a small tree-shaken library such as Lucide through one central icon helper. Do not mix several icon styles or continue scattering slightly different hand-authored versions of the same icon. Every icon-only button requires a tooltip and accessible name.

Fix text encoding so legitimate characters such as the pound sign and accented menu names render correctly in UTF-8. Remove mojibake from all user-facing strings.

## Phase 2: Professional App Shell

Refine the app shell without redesigning the editor itself.

The top area should contain:

- Small Griffin crest at left.
- Home / Editor / Export mode control.
- File, Edit, Menu, Arrange, View, Window and Help menus.
- A genuinely useful quick toolbar.
- Windows native minimise, maximise and close controls.
- A clear draggable title-bar region that never blocks controls.
- Current document name and dirty indicator where it can fit without clutter.

The quick toolbar should prioritise high-frequency commands only:

- Undo
- Redo
- Save
- Print, if useful in the current workspace
- Tool search / command palette, if useful

Do not add a second Export shortcut beside the Home/Editor/Export mode control; the Export workspace is already the route to export.

Each top-level toolbar/menu heading should use a consistent suitable icon above or beside its text according to the established compact layout. Keep labels readable at Windows scaling levels.

The Window menu must offer real toggles for:

- Menus window
- Dishes window
- Find across menus
- Colour, Spacing and Typography
- Arrange
- Show/hide menu rail
- New app window

The Arrange window should expose real selection-aware commands where supported:

- Align left, centre, right, top, middle, bottom
- Centre horizontally, vertically or both on page
- Bring forward
- Send backward
- Bring to front
- Send to back
- Reset selected position
- Reset all positions
- Snapping and guides toggles

Unsupported actions must be omitted or visibly disabled with a concise explanation. Never simulate success.

Section-specific behaviour stays in each section's three-dot menu. There must be no Section top-level menu. In each section menu, Columns must be a clear select/dropdown with values 1, 2, 3 and 4, and choosing one must update layout deterministically and participate in undo.

Make top menus behave like mature desktop menus:

- Open by click and appropriate keyboard access.
- Close on Escape, outside click, command activation and workspace change.
- Arrow-key navigation.
- Correct focus return.
- Visible shortcut labels.
- Checked state for toggles.
- Disabled state based on command availability.
- No menu clipped by the window edge.

Build one command registry as the source of truth for labels, shortcuts, enabled state, checked state, handlers and help search. Menus, toolbar, keyboard shortcuts, Help tool search and context menus should consume it rather than drifting independently.

Add `Ctrl+K` command/tool search. It should search commands and settings, show shortcuts, run the selected real command, and never expose internal or unavailable operations.

## Phase 3: Splash And Real Startup Orchestration

Completely professionalise startup while preserving Electron security.

### Splash Visual Direction

The splash should be unmistakably Griffin:

- Frameless, stable desktop splash window.
- Brand-green outer background.
- Full supplied Griffin lockup image centred inside a brand-cream panel.
- The logo should be large and preserve its exact aspect ratio.
- Internal padding around the lockup should be small but polished, not cramped.
- Refined modest corner radius, subtle border and restrained shadow.
- Generous space around the cream panel within the splash window.
- Status text beneath the panel; because it sits on green, it must use brand pink.
- A subtle indeterminate progress line or dots only when work is actually in progress.
- No dark technology aesthetic, gradients, glassmorphism, fake percentage, flashy animation or recreated text logo.
- No white flash, image jump, layout shift or unstyled frame.
- Correct rendering at 100%, 125%, 150% and 200% display scaling.

Use the existing full lockup asset. Do not distort it or recreate it with HTML text.

### Startup Architecture

Create a small, explicit startup orchestrator instead of scattered boot code. A task should have:

- id
- real user-facing status label
- critical/non-critical classification
- dependencies only where genuinely needed
- timeout
- duration instrumentation
- result/error handling

Run independent I/O tasks concurrently. Keep heavy layout work in the renderer. Avoid synchronous filesystem work in the main-process hot path.

Useful real startup tasks include, when supported by the existing app:

- Load, validate and migrate application preferences.
- Restore safe window size and position; clamp it to currently attached displays.
- Load recent document metadata.
- Detect missing recent files without blocking on expensive thumbnail work.
- Check autosave and crash-recovery metadata.
- Discover bundled and user `.menu` templates in the Templates folder.
- Validate template metadata and isolate broken user templates.
- Verify critical bundled brand assets.
- Initialise window/document session state.
- Initialise command registry and keyboard accelerators.
- Initialise export/preflight services.
- Prepare page geometry constants.
- Hydrate the Home workspace model.
- Mount the initial UI.
- Wait for critical fonts with a bounded timeout.
- Wait for critical images.
- Complete one stable initial layout frame.
- Warm only genuinely cheap/common preview calculations.

Do not block launch on non-critical template thumbnail generation, exhaustive recent-file scanning, large backup validation or other work that can happen quietly after Home appears.

Map status messages to actual phases, for example:

```text
Restoring preferences
Checking recovery
Loading templates
Preparing workspace
Preparing print engine
Finalising workspace
Ready
```

Do not cycle messages on a timer. Only show a label when the corresponding task starts or becomes the active critical dependency.

### Readiness And Timing

Implement:

- Configurable minimum splash duration, default `1800ms`.
- Main window created hidden behind the splash.
- Explicit renderer-ready handshake after critical state is restored, fonts/assets are ready enough, the initial workspace is rendered and layout is stable.
- Do not treat `did-finish-load` or `ready-to-show` alone as app readiness.
- When readiness completes, wait only for the remaining portion of the minimum duration.
- If real work exceeds 1800ms, leave the splash naturally visible until it completes.
- No additional fixed delay after both readiness and minimum duration are satisfied.
- Restrained 180-240ms fade/cross-fade.
- Respect `prefers-reduced-motion` by revealing immediately without animation.
- Focus the main window correctly and destroy the splash cleanly.
- Do not show a splash for every additional in-app editor window; show it for each real process launch.

Use a dedicated narrow splash preload bridge if the splash needs status events. Do not expose the full document API to the splash. Validate all IPC payloads.

Add a startup watchdog, approximately 12-15 seconds. A critical failure must never leave the splash hanging forever. Present a branded, useful failure state with actions such as Retry, Continue in reduced mode when safe, Open diagnostics, or Exit. Non-critical failures should be logged and surfaced later as a quiet notification.

Record timings locally for diagnostics; do not add analytics or remote telemetry.

## Phase 4: First Run, Installation And Guided Tutorial

Treat installation and first run as product surfaces.

### Installer

Audit the current Electron Forge Squirrel packaging. Make install, upgrade and uninstall reliable for a normal Windows user without Node.js.

Verify or add:

- Correct `build/icon.ico` and product identity throughout.
- Product name, executable name, version, company/publisher placeholders and uninstall metadata.
- Sensible installer artifact name.
- Start menu shortcut and appropriate desktop shortcut behaviour.
- Per-user install unless a documented requirement needs elevation.
- Clean uninstall without deleting user `.menu` documents or user templates.
- Upgrade-in-place behaviour that preserves app data.
- Squirrel install/uninstall event handling.
- Windows recent documents integration where safe.
- `.menu` open-with/file association where Forge tooling supports it reliably. Template files use the same extension and are recognised by their versioned `kind: "template"` wrapper.
- Code-signing documentation and placeholders; do not fabricate a certificate.

Squirrel offers limited custom installer UI. Do not pretend it supports a rich branded wizard if it does not. If a custom installing page genuinely requires Forge WiX or another supported maker, document the trade-off and only change maker after proving package, upgrade and uninstall behaviour. Otherwise keep Squirrel and make the in-app first-run setup excellent.

### First-Run Setup Page

On first launch after install, show a short branded `Finishing setup` page only while doing real one-time work:

- Create app data, recovery, thumbnail and user-template folders.
- Initialise validated preferences.
- Index bundled templates.
- Prepare initial template metadata and a small number of visible thumbnails.
- Confirm the document/recovery directories are writable.

Show named steps and completion states, not fake progress. If a non-critical folder is unavailable, offer a safe default and explain it.

### Guided Tutorial

Add an optional, polished guided tutorial reached from first run and Help > Tutorial.

Requirements:

- Five to seven short steps maximum.
- Skip, Back, Next and Finish.
- Escape closes after confirmation if the tutorial has changed anything.
- Persist completion/dismissal in app-level preferences.
- `Restart tutorial` and `Reset dismissed tips` in Settings.
- Keyboard navigable and screen-reader labelled.
- Uses a disposable sample menu or safe demo state, never silently changes a real document.
- Contextual spotlights position correctly and never extend offscreen.
- Tutorial can move through Home, template creation, adding/editing a dish, preview/preflight, Save and Export.
- Avoid modal walls of prose. Each step should ask the user to do one useful action or explain one decision.

Also add small one-time contextual hints for section menus, direct preview editing, undo, and Export. Experienced users must not repeatedly dismiss them.

## Phase 5: Home As A Useful Backstage Hub

Home should appear on every normal launch and feel as useful as Word's start/backstage experience, adapted to Griffin rather than copied.

Keep the green left navigation with pink text/icons:

```text
Open
New
Templates
Dishes
Settings
```

Add a compact app version/help area at the bottom if it remains uncluttered.

### Open

Provide:

- Recent `.menu` documents with full-page thumbnails.
- Thumbnail preserves the entire page ratio and is never cropped.
- Menu name, path/location, last opened time and paper size.
- Pin/unpin recent items.
- Search and useful sort.
- Open, Open a copy, Show in folder and Remove from recent.
- Honest missing-file state with Locate and Remove actions.
- Open from disk as a clear primary action.
- Keyboard navigation and a compact list alternative if many files exist.
- Background thumbnail cache generation with versioned cache keys.

Do not regenerate every thumbnail at startup. Render visible/missing thumbnails lazily, cache them, invalidate when document content/render version changes, and fall back to a polished ratio-correct skeleton.

### New

Provide:

- New blank menu using saved defaults.
- Start from a template.
- A few genuinely useful Griffin starting layouts.
- Clear naming before or immediately after creation.
- No mystery default menu added to the library until the user commits to it.

### Templates

Provide:

- Bundled Griffin templates and user templates in distinct sections.
- Real full-page blush thumbnails using the canonical renderer.
- Name, description, category, paper size and column count.
- Use Template, Preview and appropriate management actions.
- Search/filter and sensible categories based on real templates.
- Save current layout as a template `.menu`.
- Import/export template `.menu` files.
- Rename/delete only user templates.
- Duplicate a bundled template into the user folder before editing.
- Rebuild thumbnail action in Settings, not noisy controls on every card.

Choosing a template must create an independent unsaved `.menu` document and open it in Editor. It must never edit the template file in place.

### Dishes

This is not a catalogue. Build a clear search/reuse surface over accessible menu files:

- Search dish name, description, price, allergens/tags, notes, section and menu.
- Show source menu and section context.
- Open the source result.
- Copy the dish into the current menu.
- Reuse selected fields into the current dish.
- Find across menus and enter a reviewed field-specific replace flow.
- No permanent links, global records, overrides or propagated updates.

### Settings

Turn Settings into a calm full workspace rather than a cramped modal. Organise it into:

- General
- New Menu Defaults
- Storage
- Templates
- Export and Print
- Recovery
- Accessibility
- Advanced

Include search. Clearly distinguish app preferences from settings stored inside a `.menu` document. Validate folder changes, offer Open/Reset actions, and never silently move or lose files.

## Phase 6: Editor Coherence And Useful Tools

Preserve preview fidelity and the existing editor workflow. Improve the experience around it.

Add or refine:

- Document title and unsaved marker.
- Clear save state: Saving, Saved, Unsaved, Recovery available, Save failed.
- One consistent selection model.
- Undo/redo labels that describe the next action where practical.
- One undo transaction for drag/drop, template application and bulk replace.
- Predictable focus after adding, deleting, duplicating or moving a section/dish.
- Context menus for dishes/sections where they improve speed.
- Keyboard alternative to every drag-only operation.
- Paste sanitisation to plain text where rich HTML would corrupt menu content.
- Native spellcheck and a safe spelling context menu for names/descriptions, if it can be implemented without exposing unsafe Electron APIs.
- Confirmation for destructive operations with the exact affected item named.
- Toast/action feedback for successful save, copy, import and export.
- Inline validation instead of alert boxes where practical.
- Status bar for save state, page/paper, preflight and zoom if it remains compact.
- Tooltips that describe unfamiliar icons, not obvious text buttons.

Audit the floating windows:

- Menus
- Dishes
- Find across menus
- Colour, Spacing and Typography
- Arrange

They should share one panel component, one header pattern, predictable close/dock behaviour, sensible minimum/maximum dimensions and remembered positions where safe. Do not create panels inside panels or allow them to cover essential controls without a recovery route.

Colour, spacing and typography controls should show current values, units, reset-to-document-default and reset-to-app-default semantics. Numeric controls need sensible ranges and keyboard steps. Changes should preview live but commit as coherent undo transactions.

## Phase 7: Multiple Windows And Document Lifecycle

Replace any singleton-window assumptions with a small window/session manager.

Requirements:

- File > New Window opens another independent Griffin Menu Studio window.
- Each window owns its renderer state, active file path, dirty state, recovery identity and close flow.
- Opening a second `.menu` can open in the current clean Home window or a new window according to clear, consistent rules.
- Do not accidentally save one window's document over another window's file.
- Unsaved-close confirmation applies per window.
- Quit with several dirty windows reviews them safely and cannot lose data through racing dialogs.
- App activation with no windows creates a new Home window.
- `window-all-closed` behaves correctly on Windows.
- Window bounds are persisted and clamped to visible displays.
- New windows appear offset rather than exactly stacked.
- A document already open in another Griffin window should focus that window or explicitly offer Open a Copy; do not allow silent concurrent overwrite.
- External file changes should be detected at save time and produce a conflict dialog with Reload, Save a Copy and Overwrite choices.
- Use atomic save: write temporary sibling file, flush/close, then replace safely.
- A failed save must leave the original intact and the document dirty.
- Add successful `.menu` opens to Windows recent documents where safe.

Preserve the narrow preload bridge. Main-process document operations must derive the calling window from `event.sender`, not a single global `mainWindow` variable.

## Phase 8: Recovery, Reliability And Diagnostics

Implement or complete:

- App-level preferences stored outside `.menu` documents.
- Versioned settings migration and validation.
- Autosave recovery per window/document.
- Debounced autosave only after meaningful changes.
- Recovery files never overwrite the real document.
- Clean-session markers so crash recovery is distinguishable from normal exit.
- Recovery Home panel showing document name, original path, timestamp and safe preview.
- Restore, Save As, Discard and Show in folder actions.
- Retention/cleanup policy for old recovery files.
- Safe handling of corrupt settings, recent metadata, user template or recovery files.
- Local rotating diagnostic log with no menu content by default.
- Help > Copy Diagnostics containing app version, Electron/Chromium versions, OS, display scaling, startup timings, feature flags and recent error codes, but no private menu text or paths unless clearly opted in.
- Advanced > Open app data folder, Validate templates, Validate recent files, Clear thumbnail cache and Reset preferences.

Use graceful error boundaries at workspace/module entry points. A broken user template must not prevent the app from launching.

## Phase 9: Export And Print Experience

Keep the current canonical rendering/preflight engine. Do not create a second renderer.

The Export workspace should use the same green navigation pattern as Home, with separate pages:

```text
Print
PDF
PNG
Save As
```

### Print

Use a Word Backstage-style information hierarchy adapted to Griffin:

- Green navigation, warm cream settings surface and large white page preview.
- Prominent Print button.
- Copies stepper.
- Honest system-printer row explaining that printer selection occurs in the Windows print dialog.
- Current menu/pages, paper, orientation, margins and scaling rows.
- Preflight status with clear fix action that returns to the relevant Editor control.
- No PDF or PNG buttons in Print.
- No fake printer dropdown or unsupported duplex/collation controls.
- Print button disabled only for genuine blocking preflight failures.
- Print reruns preflight immediately before invoking Electron.
- Narrow, validated print IPC payload.

### PDF

- White exact-size preview.
- Exact A4/A5 dimensions.
- No editor chrome, browser headers/footers or unexpected scaling.
- Fonts and images awaited.
- Preflight status.
- Filename preview and folder choice where supported.
- Deterministic repeated output.

### PNG

- White page preview.
- Clear current-page scope.
- Useful resolution presets only if they represent real output behaviour.
- Exact aspect ratio.
- No misleading print settings.

### Save As

- Clearly identified as editable `.menu`, not export.
- Show current file name/location and Save a Copy where useful.
- Never claim the file contains unrelated app settings or the entire menu library.

Add preview zoom controls that alter only display scale. Fit Page and Actual Size must never mutate document dimensions or export geometry.

## Phase 10: Accessibility And Windows Behaviour

Meet a practical WCAG 2.2 AA desktop target where applicable.

Verify:

- Logical tab order in every workspace/dialog.
- No keyboard traps.
- Escape, Enter, Space and arrow-key conventions.
- Visible focus in all themes/surfaces.
- Correct landmarks, headings, labels, descriptions and live regions.
- Icon buttons have accessible names.
- Menus use appropriate menu semantics without breaking native keyboard expectations.
- Dialog focus trap and focus restoration.
- Error messages linked to fields.
- Colour is never the only state indicator.
- Sufficient contrast, including pink on green.
- Windows High Contrast / forced-colours fallback.
- Reduced motion support.
- 100%, 125%, 150%, 200% display scaling.
- Small laptop and maximised desktop layouts.
- Touch targets remain reasonable without making the app oversized.
- Drag operations have keyboard/button alternatives.

Respect Windows conventions for Alt/F10 menu access, Ctrl+N/O/S/Shift+S/P/Z/Y, Ctrl+0, F1, Escape and window focus. Do not hijack browser-style zoom in a way that changes page geometry.

## Phase 11: Perceived And Actual Performance

Use baseline measurements from Phase 0.

Look for:

- Duplicate initialisation.
- Repeated settings/template/recent-file reads.
- Repeated JSON parsing.
- Synchronous file I/O on startup.
- Multiple full preview renders during boot.
- Layout thrashing from interleaved reads/writes.
- Repeated font waits.
- Eager rendering of offscreen thumbnails.
- Duplicate event listeners after workspace rerender.
- Event listeners and object URLs that are never released.
- Full-app rerenders for small field changes.
- Expensive measurement before the relevant workspace is visible.

Improve genuine bottlenecks with batching, scoped state subscriptions, debouncing, cancellation and caching. Thumbnail work should be lazy and cancellable. Search should debounce and remain responsive. Do not add a complex state framework.

Report measured before/after startup timings on the same machine and build mode. If a metric cannot be measured reliably, say so rather than inventing a number.

## Phase 12: Helpful Details That Make Software Feel Finished

Add these where they genuinely improve the product:

- Empty states with one clear action.
- Inline loading/skeleton states for recents/templates.
- Non-blocking toast system with action buttons and accessible announcements.
- Recent document pinning.
- Show in folder for documents, templates, exports and recovery.
- `Open a Copy` / `Save a Copy` language where it prevents accidental overwrite.
- Last export location remembered as an app preference.
- Helpful default filenames with invalid Windows characters removed.
- EN-GB date and currency conventions.
- About page with product version, copyright, licences and Copy Diagnostics.
- Help topics for Home, templates, files/saving, recovery, print, keyboard shortcuts and tutorial.
- F1 context-sensitive help where practical.
- Tooltips with shortcut text.
- Clear offline messaging only when an optional online action is ever introduced.
- Placeholder update policy documentation; do not add an unsigned auto-updater or non-existent update service.

Do not add accounts, cloud sync, collaboration, analytics, AI generation, a database, a global dish catalogue or novelty features.

## Security Requirements

Preserve or improve:

- `contextIsolation: true`.
- `nodeIntegration: false`.
- Renderer sandbox where compatible and verified.
- Restrictive Content Security Policy.
- No `eval`, inline script or remote code.
- Narrow preload APIs with typed payloads.
- Runtime validation in every IPC handler; TypeScript types alone are insufficient.
- Sender/frame validation for privileged IPC.
- No arbitrary filesystem primitive exposed to renderer.
- Dialog-selected or app-owned paths only.
- Block arbitrary navigation and new windows.
- Open external links only after protocol validation and explicit user action.
- Safe local asset loading.
- No menu/document content in logs by default.

Audit Electron security warnings in development and document any deliberate exception.

## Testing Requirements

Keep all existing tests passing and add focused tests for new logic.

At minimum cover:

- Startup task dependency ordering.
- Concurrent independent startup tasks.
- Critical versus non-critical failure behaviour.
- Minimum splash duration.
- No extra delay after readiness.
- Renderer readiness gating.
- Startup watchdog/fallback.
- Settings validation/migration.
- First-run detection and completion.
- Tutorial completion, dismissal and reset.
- Window bounds clamping.
- Independent multi-window session routing.
- Dirty close flow.
- Command registry uniqueness and visible-command completeness.
- Command enabled/checked state.
- Home default on launch.
- Recent missing-file behaviour.
- Template thumbnail cache invalidation.
- Broken user template isolation.
- Print button blocking only on real preflight failure.
- Accessibility basics for rendered workspaces where practical.

Add an Electron end-to-end smoke test if it can be reliable in this repository. It should cover app launch, splash readiness, Home, template to Editor, edit, save, Export, new window and dirty-close handling. Do not make CI dependent on brittle pixel-perfect snapshots.

Run after each coherent phase:

```powershell
npm.cmd test
npm.cmd run typecheck
```

Regularly run:

```powershell
npm.cmd start
```

Inspect the real app and DevTools console. A passing unit test is not proof that a UI action works.

Before completion run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run package
npm.cmd run make
```

If packaging is blocked by network or certificate availability, distinguish an environment blocker from a code failure and preserve the successful renderer/main/preload build evidence.

## Manual QA Matrix

Verify at minimum:

- Cold launch.
- Warm launch.
- First launch after install.
- Repeat launch.
- Splash at 100%, 125%, 150% and 200% scaling.
- Startup with no recents.
- Startup with recents.
- Startup with missing recent file.
- Startup with recovery state.
- Startup with a broken user template.
- Startup with one missing non-critical asset.
- Startup watchdog simulation.
- Home keyboard navigation.
- New blank menu.
- New from every bundled template.
- User template `.menu` import/save/rename/delete.
- Open/save/save as/reopen `.menu`.
- Unicode, pound signs and accented dish names.
- Editing, section menu, columns 1-4.
- Undo/redo after content, layout and bulk operations.
- Drag/drop and keyboard alternative.
- Find across menus review/apply/cancel.
- Reuse dish fields without linking.
- Two independent editor windows.
- Same-file conflict prevention.
- Dirty close in one window and on full app quit.
- Autosave and crash recovery.
- PDF export.
- PNG export.
- Print and cancel from Windows dialog.
- One-page, near-overflow and footer-collision menus.
- A4 and A5.
- One through four columns.
- Preview zoom invariance.
- Offline operation.
- Installer, upgrade and uninstall.
- No runtime console errors.

## Implementation Discipline

- Make small, coherent changes and test after each phase.
- Prefer existing modules and helpers.
- Add an abstraction only when it removes real duplication or centralises a genuine contract.
- Do not move files for appearance alone.
- Do not delete code solely because it looks unused; prove it is unreachable and check dynamic selectors/IPC first.
- Do not alter canonical menu HTML/CSS geometry during shell polish.
- Do not hide errors to make logs look clean.
- Do not add fake controls, fake loading, fake percentages, fake printer choices or placeholder features.
- Do not use blocking synchronous filesystem calls in startup hot paths.
- Do not add a service or dependency without a clear reason and maintenance cost assessment.
- Preserve user and concurrent-agent changes.

Make clear commits after each passing phase with messages such as:

```text
feat(startup): add measured renderer readiness orchestration
feat(onboarding): add first-run setup and guided tutorial
refactor(ui): unify shell commands and interaction states
feat(home): polish recent documents and template workflows
feat(windows): support independent document windows
test(rc): add startup and workspace acceptance coverage
```

Do not commit unrelated dirty files.

## Final Acceptance Criteria

The pass is complete only when:

- The splash is visually Griffin, stable, high-DPI correct and shown for at least 1800ms on normal launch.
- Every splash status corresponds to real startup work.
- The hidden main window appears only after an explicit ready handshake and stable initial frame.
- Home appears every normal launch and is immediately useful.
- First-run setup and tutorial are helpful, optional and non-repetitive.
- Installer/install/uninstall behaviour is documented and verified as far as the environment allows.
- All visible menu, toolbar, panel and help controls work or are correctly unavailable.
- The UI has one consistent visual and interaction language.
- The toolbar and Window menu contain useful, real tools.
- Section columns can be selected from 1 through 4.
- Multiple documents can be edited safely in separate windows.
- Dirty state, save failure, close, recovery and conflict flows protect user work.
- Templates are discoverable, full-page, blush and actually create editable menus.
- Find/reuse works without any catalogue or linked-state model.
- Print is a polished dedicated page with no PDF/PNG buttons.
- PDF/PNG/Print use the canonical renderer and white output.
- Accessibility and Windows scaling checks pass.
- Startup performance is measured, not guessed.
- There are no white flashes, obvious layout shifts, inert controls or console errors.
- Existing unit tests pass, new tests pass and TypeScript is clean.
- Packaging and installer creation pass, or any external blocker is precisely documented.

## Final Report

At completion provide:

- What changed by phase.
- What existing code/rendering behaviour was preserved.
- Baseline and final startup timings.
- Real startup tasks performed during splash.
- Exact minimum splash duration and watchdog duration.
- Renderer-ready criteria.
- First-run and tutorial behaviour.
- Home, shell, Editor, Window and Export improvements.
- Multi-window and document-safety behaviour.
- Accessibility work.
- Tests added and command results.
- Package/installer artifact paths.
- Any integration changes made in Codex-owned files.
- Remaining known limitations, especially signing, installer customisation or environment blockers.

Begin with the audit, then implement in small tested phases. Do not stop after producing a report or plan: carry the assigned product pass through implementation and verification.
