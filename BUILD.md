# Griffin Menu Studio Desktop Build

## Commands

- Development: `npm start`
- Tests: `npm test`
- Package unpacked app: `npm run package`
- Build Windows distributables: `npm run make`

The Windows installer output is written under `out/make/squirrel.windows/x64/` when the Squirrel maker succeeds. The app is offline-first and ships its renderer, fonts, and Griffin artwork locally.

## Document Format

Editable documents use `.griffinmenu`, a versioned JSON wrapper:

- `app`: `Griffin Menu Studio`
- `version`: document schema version
- `savedAt`: ISO timestamp
- `state`: the editable menu model, including menus, sections, items, prices, layout, typography, line, header, footer, spacing, page, generation and settings state

Generated DOM is never the canonical document model.

## Manual QA Checklist

- Startup: splash screen shows full lockup on creme rounded card, then opens the editor.
- Editing: create/edit/delete menu sections, dishes, prices, dietary tags, footer and header note.
- Generation/templates: create a menu from built-in templates and save a custom template.
- Undo/redo: undo recent edits; redo currently shows an unavailable state.
- Save/reopen: save `.griffinmenu`, quit, reopen, and confirm all editable state survives.
- Autosave recovery: edit without saving, relaunch after forced close, and accept recovery.
- PDF export: export A4 and A5 menus; confirm white background, no browser headers/footers, exact page size, no editor chrome.
- PNG export: export current menu and confirm white page output.
- Print: open native print dialog after preflight.
- One-page menus: verify safe one-page output and no unexpected shrink-to-fit.
- Near-overflow menus: confirm warning appears only when content genuinely exceeds page geometry.
- Footer collisions: force footer overlap and confirm export is blocked.
- Two-column layouts: confirm centred columns and exact gaps.
- Three-column layouts: confirm centred columns and exact gaps.
- Zoom levels: zoom in/out/fit/actual size; confirm document dimensions and layout ratios do not mutate.
- Windows display scaling: repeat preview and export checks at 100%, 125%, and 150%.
