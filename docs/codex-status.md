# Codex Engine And Packaging Status

## Committed Engine Work

- `5a6d199` document conflict-safe atomic saves
- `0a6e878` crash-recovery snapshot bridge
- `738490f` asset-aware canonical export preflight
- `efda13e` hardened main-window lifecycle and navigation
- `177ed4c` Windows `.menu` association and launch-document handoff
- `a9f3ddc` find/replace, template, settings and export engine modules
- `98cb4ae` signed-release packaging configuration and documentation
- `bc8be95` full document round-trip and recovery-isolation coverage

## Final Checks

- `npm.cmd run typecheck`: passed
- `npm.cmd test`: passed, 39 tests
- `npm.cmd run make`: passed; its package phase and Squirrel/ZIP maker both completed

Installer artefact:

```text
out/make/squirrel.windows/x64/GriffinMenuStudioSetup.exe
140,658,176 bytes
```

## Signing Blocker

`npm.cmd run make:release` correctly stops before building because no real
`WINDOWS_CERTIFICATE_FILE` and `WINDOWS_CERTIFICATE_PASSWORD` are configured.
That is an expected release-environment prerequisite, not a code or packaging
failure. See `docs/windows-release-process.md`.

## Renderer Handoff

The combined worktree is typecheck-clean and test-clean. Codex has not staged
or changed Claude-owned renderer files or `src/shared/types.ts`; Claude can now
commit that remaining renderer/shared-type layer independently.
