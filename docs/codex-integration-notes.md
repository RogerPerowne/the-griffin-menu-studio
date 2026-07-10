# Codex Integration Notes

This file is the contract between the main-process/persistence work and the
renderer work. All APIs below are exposed through the narrow `window.griffin`
preload bridge and must be called through the command registry.

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

## IPC Validation

Main-process IPC now derives every privileged call from `event.sender` and
validates PDF, PNG, print, template, folder-picker and document-operation
payloads at runtime. Renderer code must not attempt to invoke arbitrary paths
or Electron APIs outside this bridge.

## Recovery

Recovery API and payload details will be added here with the Phase 8 commit.
