# Griffin Menu Studio — Codex Handoff (final polish)

**Branch:** `rebuild-vite-ts` — commit every change here, **never touch `main`.**
**Current state at handoff (HEAD `8c55c31`):** `npm run typecheck` clean, `npm test` = 39 passing.

Claude fixed 6 of 7 findings in `docs/preview-export-review.md` (zoom scaling on `.page`,
zoom-invariant overflow measurement via `pageInnerScale`, fit-width re-fit, ruler off-page
shading, page drop shadow + centering, parity edge cases) and anchored the ruler tick origin
to each ruler canvas's own rect. The remaining work needs a **real viewport / Electron** —
Claude's preview is headless (0×0 viewport, rAF frozen, `window.griffin` absent) and cannot
verify pixels, capture screenshots, or exercise the main process. That is why these items are
handed to you: your environment can measure real rects and run the packaged app.

Keep each coherent change as its own commit. Re-run `npm run typecheck` + `npm test` after each
and keep them green. Do a final editor↔export 1-page-overflow **parity** spot-check (force a
near-overflow menu; the editor warning must match the export warning) before packaging.

---

## Priority 1 — Document lifecycle (data-loss risks)

The `.menu` model and the New/Open/Save flow can silently destroy the user's work. Fix this
first; it underpins the print/export and recovery work.

1. **`.menu` is a whole-library snapshot, not an editable document.** `Save` serialises *all*
   menus, templates and settings; `Open` replaces the entire application state. This conflicts
   with the intended Word-like "one document = one menu" model and risks wiping the user's
   library when they open a file.
   [commands.ts:144](/D:/dev/the-griffin/src/renderer/commands.ts:144)
   · [document-format.ts:37](/D:/dev/the-griffin/src/shared/document-format.ts:37)
   → Separate the **active document** from the **library/preferences**. A `.menu` file should
   round-trip a single editable menu (plus the metadata it needs), not the whole app state.

2. **New Menu / New from Template can overwrite the open file.** Both only add a menu to
   in-memory state; neither clears the native document session. The `document:new` IPC exists
   but is never called, so: open `Dinner.menu` → New → Save can overwrite `Dinner.menu`.
   [workspaces/index.ts:122](/D:/dev/the-griffin/src/renderer/workspaces/index.ts:122)
   · [documents.ts:185](/D:/dev/the-griffin/src/main/documents.ts:185)
   → New (and New-from-Template) must call `document:new` to clear the native session before
   creating the in-memory menu.

3. **No unsaved-work confirmation** before Open, New, or window close. The app shows "Unsaved
   changes" but never uses it to protect work.
   [commands.ts:219](/D:/dev/the-griffin/src/renderer/commands.ts:219)
   · [app.ts:189](/D:/dev/the-griffin/src/renderer/app.ts:189)
   → Add real dirty tracking and a Save / Discard / Cancel guard on New, Open, and window close.

4. **A structurally "valid" empty document can crash the editor.** Validation permits
   `menus: []`, but renderer code assumes `currentMenu()` always returns a menu.
   [document-format.ts:37](/D:/dev/the-griffin/src/shared/document-format.ts:37)
   · [store.ts:43](/D:/dev/the-griffin/src/renderer/store.ts:43)
   → Either forbid empty `menus` in validation, or make every `currentMenu()` consumer handle
   `undefined` safely.

---

## Priority 2 — Print / export (the "print-perfect" requirement)

1. **PDF/print output can include app UI, not just the menu.** The print stylesheet hides the
   *old* shell selectors but leaves the current `.menubar` and the Home/Export workspaces
   visible — breaking the "print-perfect, no editor chrome" requirement.
   [editor.css:521](/D:/dev/the-griffin/src/renderer/styles/editor.css:521)
   → Under `@media print`, hide **all** app chrome (current selectors, not stale ones). Prefer
   isolating a dedicated print document (the `#printRoot` / `preparePrintDOM()` path) so the
   printed DOM contains only the page, and remove the stale duplicate print/app-shell CSS once
   the functional fix lands.

2. **PNG export is not canonical or resolution-stable (review finding #4).** It captures the
   visible, CSS-scaled Export preview (`.export-preview-page .page` at `transform: scale(.68)`),
   so DPI and output dimensions vary with window size and UI scaling.
   [commands.ts:100](/D:/dev/the-griffin/src/renderer/commands.ts:100)
   · [export-handlers.ts:36](/D:/dev/the-griffin/src/main/export-handlers.ts:36)
   → Render PNG from the **unscaled** canonical production page (the same `#printRoot` DOM the
   PDF path uses) at a **chosen fixed DPI**. Make output pixel dimensions deterministic and
   independent of window/UI scale. Document the target DPI. Verify emitted pixel dimensions and
   that content is neither clipped nor soft.

3. **Add visual PDF/PNG regression tests** once both above are correct, so chrome can't leak
   back into print output and PNG resolution stays stable.

---

## Priority 3 — Ruler alignment (user-reported, needs a real viewport)

The user reports the top + right rulers "don't line up perfectly with the menu, and zooming
messes up the alignment." Run the dev server, open the editor with a real page, and **measure**.

- `renderRulers()` / `drawRuler()` in `src/renderer/layout-runtime.ts` draw cm ticks on
  `<canvas id="rulerTop">` / `<canvas id="rulerRight">`. Origin is now
  `page.getBoundingClientRect().left − rulerCanvas.getBoundingClientRect().left` (top) and the
  vertical equivalent. Confirm tick **0cm sits exactly on the page's left/top edge**, and that
  it holds at 50 / 100 / 150 / 200 % zoom and after Fit-width.
- Suspect areas: DPR canvas scaling (`canvas.width = cssW*dpr; ctx.scale(dpr,dpr)`), the `.page`
  border/box-model offsetting the content origin vs. the rect, half-pixel tick snapping, and
  whether the redraw happens *after* the zoom transform paints (it's called synchronously from
  `applyZoom`; `scheduleRulers` exists to rAF-coalesce).
- **Keep the far-right ruler position** (grid column beside the scroll + `.ruler-corner`). The
  user explicitly reverted an attempt to move the ruler against the page — fix *alignment only*,
  not position.
- Verify visually at multiple zooms and A4 / A5, then commit.

---

## Priority 4 — Crash recovery with multiple windows

Closing **any** renderer fires `pagehide` and marks the single shared recovery session clean.
If another window then crashes, recovery may not appear.
[app.ts:238](/D:/dev/the-griffin/src/renderer/app.ts:238)
· [recovery.ts:78](/D:/dev/the-griffin/src/main/recovery.ts:78)
→ Only mark the session clean after the **final** app window closes. Honour recovery
preferences and use the configured snapshot interval.

---

## Priority 5 — Inert controls, settings plumbing, error surfacing

1. **"Import .menu…" and "Open templates folder" are dead controls.** Rendered with commands
   that don't exist in the registry, so clicks silently do nothing.
   [workspaces/index.ts:246](/D:/dev/the-griffin/src/renderer/workspaces/index.ts:246)
   · [commands.ts:278](/D:/dev/the-griffin/src/renderer/commands.ts:278)
   → Wire them to real commands **or** remove them. Then add command-coverage tests so any
   `[data-cmd]` in the shell must resolve to a registered command (inert controls can't return).

2. **Opening an invalid `.menu` or a template file fails silently.** Templates and documents
   share `.menu`; the picker accepts both, but document parsing rejects templates. The renderer
   ignores the returned error, and startup launch errors are swallowed too.
   [commands.ts:219](/D:/dev/the-griffin/src/renderer/commands.ts:219)
   · [app.ts:217](/D:/dev/the-griffin/src/renderer/app.ts:217)
   → Distinguish the template-open vs document-open flow, validate the file kind, and show an
   actionable error on parse failure and on swallowed launch errors.

3. **Settings storage locations are cosmetic.** Editable and persisted into renderer state, but
   the native document/template/recovery/export/backup services never read them; defaults aren't
   applied when creating a blank menu.
   [workspaces/index.ts:146](/D:/dev/the-griffin/src/renderer/workspaces/index.ts:146)
   → Implement storage-location plumbing centrally in the main process (validation + fallback
   paths); apply defaults when creating a blank menu.

4. **"Save Layout as Template" reports success before the disk write finishes.** It updates
   local state, starts an **unawaited** native save, and shows success immediately — a failed
   write leaves the user believing the template exists.
   [editor.ts:642](/D:/dev/the-griffin/src/renderer/views/editor.ts:642)
   → Await the native save, surface errors, and keep it undo-consistent.

---

## Recommended order (from the audit's fix plan)

1. **Document lifecycle** — separate active document from library/preferences; make New clear
   the native session; add dirty tracking + Save/Discard/Cancel guards for New/Open/Close.
2. **Print/export** — isolate a dedicated print document, hide *all* app chrome under
   `@media print`, render PNG from an unscaled canonical page at a chosen DPI, then add visual
   PDF/PNG regression tests.
3. **Recovery** — only mark clean after the final window closes; honour recovery prefs +
   configured intervals.
4. **Controls & settings** — wire or remove every visible template/settings control; implement
   storage-location plumbing in the main process with validation and fallbacks.
5. **Validation & errors** — harden file-format validation, split template/document open flows,
   show actionable open/import errors.
6. **Template save** — awaited, error-aware, undo-consistent.
7. **Cleanup** — remove stale duplicate print/app-shell CSS after the functional fixes; add
   command-coverage tests so inert controls can't return.

## Finish line

After the above: re-run `npm run typecheck` + `npm test` (green), do the editor↔export overflow
parity spot-check, rebuild the signed Squirrel installer, confirm it launches, and report the
installer path + size back.
