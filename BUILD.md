# Griffin Menu Studio Desktop Build

## Commands

- Development: `npm.cmd start`
- Tests: `npm.cmd test`
- Type check: `npm.cmd run typecheck`
- Package unpacked app: `npm.cmd run package`
- Generate installer artwork: `npm.cmd run assets:installer`
- Build Windows distributables: `npm.cmd run make`
- Build a signed release: `npm.cmd run make:release`
- Verify a signed release: `npm.cmd run verify:signatures`

The Windows installer output is written under `out/make/wix/x64/` when the WiX maker succeeds:

- `Griffin Menu Studio.msi`: branded Windows Installer package with first install, update, repair and uninstall maintenance mode
- `out/make/zip/win32/x64/`: portable ZIP build

To install, run `Griffin Menu Studio.msi`. To upgrade, run a newer MSI built with the same WiX `upgradeCode`. To repair, run the same MSI again and choose **Repair** in maintenance mode. To uninstall, use **Settings > Apps > Installed apps > Griffin Menu Studio > Uninstall** or the MSI's **Remove** action. Uninstalling the app must not delete saved `.menu` documents or user templates.

The app is offline-first and ships its renderer, fonts, and Griffin artwork locally.

## Signed Releases

`npm.cmd run make` is intentionally available for local development builds.
It does not make an unsigned installer suitable for distribution.

For a release, configure `WINDOWS_CERTIFICATE_FILE` and
`WINDOWS_CERTIFICATE_PASSWORD` with a real The Griffin code-signing identity,
then run `npm.cmd run make:release`. The release command refuses to continue
without the certificate and checks the Authenticode status of the generated
installer and packaged Windows binaries. See
`docs/windows-release-process.md` for the full install, update, uninstall and
repair policy.

The build script uses WiX Toolset v3 (`candle.exe` and `light.exe`). If WiX is
not installed on PATH, `scripts/make-windows.ps1` downloads the official WiX
3.14.1 NuGet package into a local build cache under the user's profile and uses
those tools for the current build.

## Document Format

Editable documents use `.menu`, a versioned JSON wrapper:

- `app`: `Griffin Menu Studio`
- `version`: document schema version
- `savedAt`: ISO timestamp
- `state`: the editable menu model, including menus, sections, items, prices, layout, typography, line, header, footer, spacing, page, generation and settings state

Generated DOM is never the canonical document model.

Templates also use `.menu` and live in the separate user Templates folder. A
template is distinguished from an editable menu by its versioned JSON wrapper
with `kind: "template"`; applying one always creates an independent editable
menu rather than changing the template file.

## Manual QA Checklist

- Startup: splash screen shows the full lockup, then opens Home without a white flash or console error.
- Editing: create/edit/delete menu sections, dishes, prices, dietary tags, footer and header note.
- Generation/templates: create a menu from built-in templates and save a custom template.
- Undo/redo: undo and redo recent edits.
- Save/reopen: save `.menu`, quit, reopen, and confirm all editable state survives.
- Autosave recovery: edit without saving, relaunch after forced close, and accept recovery when recovery is enabled.
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
