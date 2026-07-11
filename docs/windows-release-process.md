# Windows Install, Update And Recovery Process

## Distribution Model

Griffin Menu Studio is distributed as a signed Squirrel Windows setup executable:

```text
GriffinMenuStudioSetup.exe
```

This is the only file sent to a normal restaurant user. The `.nupkg`, `RELEASES` file and ZIP are release-support artefacts and are not emailed to end users.

The installer is per-user, does not require an administrator account and creates the Windows Installed Apps entry plus the Start menu shortcut. The application keeps menu documents, templates, preferences, recovery files and thumbnail cache in the user's profile; uninstalling the application must not remove that user data.

## First Install

1. Recipient downloads the signed setup executable from a trusted link.
2. Windows verifies the Authenticode signature and publisher before running it.
3. Squirrel installs the app into the current user's local application folder and registers the uninstall entry.
4. The first run performs Griffin's one-time app-data/template setup and opens Home.

## Update

1. Build a release with a higher semantic version.
2. Sign every packaged Windows binary and the setup executable.
3. Distribute the new `GriffinMenuStudioSetup.exe`.
4. Recipient closes every Griffin Menu Studio window before running it, protecting unsaved edits.
5. The setup executable recognises the existing Squirrel identity and applies the higher version in place.
6. The existing user data remains untouched; the new Start menu shortcut points at the upgraded version.

Never reuse a version number for a different release. Do not force-close running Griffin processes during an update: users may have unsaved menu changes.

## Reinstall And Uninstall

- Running the same signed setup executable again is an idempotent reinstall of the packaged application files, but it must not be marketed as a full Windows repair operation.
- Uninstall is available from **Settings > Apps > Installed apps > Griffin Menu Studio > Uninstall**. Squirrel handles the uninstall event and shortcut cleanup.
- A user who needs to keep documents/templates should uninstall normally. Do not delete `%APPDATA%\Griffin Menu Studio` unless they intentionally want to reset app data after backing it up.

## Repair Policy

Squirrel.Windows provides a low-friction per-user installer and in-place update, but it does not provide a true Windows Installer maintenance/Repair experience. A real Repair button requires a maintenance-capable package such as MSI (WiX) or MSIX/App Installer.

For this release track:

1. A signed same-version reinstall is the supported first response for damaged application files.
2. The app should expose diagnostics and an `Open app data folder` action, never a destructive automatic reset.
3. If the restaurant needs formal Repair/Modify/Uninstall maintenance, ship a separately tested signed MSI built with Electron Forge's WiX maker. This requires WiX Toolset on the release machine and a code-signing identity.
4. Do not switch the normal email-distribution installer to MSI until first-install, major upgrade, downgrade prevention, rollback, uninstall and repair have been tested on clean Windows accounts.

## Signing A Release

Use a real organisation-validated code-signing identity for The Griffin. The PFX file and password are secrets and must never be committed.

Set these environment variables in the release environment:

```powershell
$env:WINDOWS_CERTIFICATE_FILE = 'C:\secure\griffin-menu-studio-signing.pfx'
$env:WINDOWS_CERTIFICATE_PASSWORD = 'the-certificate-password'
$env:WINDOWS_TIMESTAMP_SERVER = 'http://timestamp.digicert.com'
```

Then run:

```powershell
npm.cmd run make:release
```

`make:release` refuses to run without a readable certificate, signs the packaged app and Squirrel setup executable through Electron Forge, then checks Authenticode status on the generated Windows binaries. Verify the final installer independently before distributing it:

```powershell
Get-AuthenticodeSignature .\out\make\squirrel.windows\x64\GriffinMenuStudioSetup.exe
```

For Azure Trusted Signing or an EV certificate stored in hardware/cloud storage, replace the PFX configuration with an `@electron/windows-sign` hook. Do not add cloud credentials to this repository.

## Release QA

- Clean-account first install.
- Re-run the same setup executable.
- Upgrade from the previous released version.
- Attempt downgrade and confirm it is refused or clearly handled.
- Update after all Griffin windows are closed.
- Attempt update with a Griffin window containing unsaved changes; verify user guidance and no forced data loss.
- Uninstall and confirm saved `.menu` files, user templates and preferences remain.
- Reinstall after uninstall and confirm the app can recover existing user data.
- Verify the installer and packaged application have `Valid` Authenticode signatures.
- Confirm Start menu, taskbar and Installed Apps show the Griffin icon/name.
