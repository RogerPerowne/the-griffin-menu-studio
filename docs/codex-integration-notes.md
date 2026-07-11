# Codex Integration Notes

This file is the contract between the main-process/persistence work and the
renderer work. All APIs below are exposed through the narrow `window.griffin`
preload bridge and must be called through the command registry.

## Engine Handoff Status

The persistence, recovery, template, find/replace, export, and Windows file
association engine modules are committed through `98cb4ae`. Renderer work can
now be committed independently without staging any of those files. The shared
`src/shared/types.ts` remains intentionally uncommitted because it contains
Claude's additive renderer fields alongside the engine fields.

## Document Save Conflict Flow

Every document-save call now returns `SaveResult`:

```ts
interface SaveResult {
  canceled: boolean;
  filePath?: string;
  error?: string;
  conflict?: DocumentConflict;
}

interface DocumentConflict {
  kind: 'modified' | 'missing' | 'unreadable';
  filePath: string;
  diskState?: unknown; // Present only when kind is 'modified'.
  message: string;
}
```

`canceled: false` means the file was written successfully. Both user-cancel
and non-success outcomes have `canceled: true`; distinguish them through the
optional `error` and `conflict` fields.

New document bridge methods:

```ts
window.griffin.saveDocument(state)       // Save; detects external modification.
window.griffin.saveDocumentAs(state)     // Choose a new active document path.
window.griffin.saveDocumentCopy(state)   // Choose a path, leave active path unchanged.
window.griffin.overwriteDocument(state)  // Deliberately bypasses the detected conflict.
window.griffin.reloadDocument()          // Reloads the currently-open file.
```

Renderer conflict dialog behavior:

1. Do not clear dirty state when `canceled` is true.
2. **Reload**: use `conflict.diskState` when present, or call
   `reloadDocument()` for a fresh verified read.
3. **Save a Copy**: call `saveDocumentCopy(currentState)`.
4. **Overwrite**: require explicit confirmation, then call
   `overwriteDocument(currentState)`.
5. Treat `error` as a user-facing save/open failure, not as a successful save.

The main process fingerprints each opened/saved file using a SHA-256 revision.
It also calls `app.addRecentDocument()` after a successful Windows `.menu`
open.

`window.griffin.consumeLaunchDocument()` returns one staged `OpenResult` when
Windows launched the packaged app through a `.menu` file association; otherwise
it returns `{ canceled: true }`. Call it once during renderer boot before
choosing the default Home/editor state. The path is supplied only by the main
process command line and is never renderer-provided.

## IPC Validation

Main-process IPC now derives every privileged call from `event.sender` and
validates PDF, PNG, print, template, folder-picker and document-operation
payloads at runtime. Renderer code must not attempt to invoke arbitrary paths
or Electron APIs outside this bridge.

## Recovery

Recovery snapshots are private application-data files, separate from every real
`.menu` file. The process keeps at most 20 snapshots and removes ones older
than 30 days. Corrupt snapshots are ignored individually.

```ts
interface RecoverySummary {
  id: string;
  createdAt: string;
  documentPath?: string;
  documentName: string;
}

window.griffin.recoveryStatus()
// { previousSessionCrashed: boolean; snapshots: RecoverySummary[] }

window.griffin.writeRecovery(state)
// { ok: boolean; snapshot?: RecoverySummary; error?: string }

window.griffin.listRecovery()
// { snapshots: RecoverySummary[]; error?: string }

window.griffin.readRecovery(id)
// { found: boolean; snapshot?: RecoverySummary & { state: unknown }; error?: string }

window.griffin.discardRecovery(id)       // { ok: boolean }
window.griffin.markRecoverySessionClean() // { ok: boolean }
```

Renderer expectations:

1. Call `recoveryStatus()` after renderer readiness. A previous unclean
   session with snapshots may be presented in Home as recovery choices.
2. Debounce `writeRecovery(currentDocumentState)` for dirty documents. Never
   write a recovery snapshot over the current `.menu` file.
3. Call `markRecoverySessionClean()` during orderly renderer shutdown. A
   crash or forced process termination leaves the marker unclean.
4. Use `readRecovery(id)` only after the user chooses a snapshot; then load
   `snapshot.state` as a normal dirty document and let the user save it.

## Canonical Export Preflight

`preparePrintDOM()` in `src/renderer/views/preview.ts` is the single source
of truth for Export and Print readiness. It renders the white production page
at its unscaled physical size, waits for fonts and images, then returns:

```ts
{ ok: boolean; paper: 'A4' | 'A5'; reason?: 'fonts' | 'images' | 'footer' | 'overflow'; info?: ProductionInfo }
```

**Required Export workspace integration:** replace the current direct
`productionInfo(previewPage)` status calculation with
`await preparePrintDOM()`. The visible Export canvas is deliberately scaled
for presentation, so measuring it independently can falsely say a menu does
not fit even after Editor's Shrink to Fit has succeeded. Use the canonical
result to set the status and enable Print; the Export canvas remains visual
only.

Surface `fonts` and `images` as asset-loading failures, not a "does not fit"
warning. The preflight waits for both with a bounded timeout and treats a
broken image as unresolved.
