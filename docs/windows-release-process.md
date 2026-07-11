# Windows Install, Update, Repair And Uninstall Process

## Distribution Model

Griffin Menu Studio ships two Windows installers, both branded:

```text
Griffin Menu Studio Setup.exe   (Squirrel — recommended for most people)
Griffin Menu Studio.msi         (WiX — machine-wide / managed installs)
```

**Setup.exe (Squirrel)** is the recommended path for anyone who has never
installed software before. It installs into the user's own profile
(`%LocalAppData%`) with no administrator rights, no UAC prompt and no folder
picker: double-click, watch the branded splash, and the app launches itself when
it finishes. Uninstall is via Installed Apps.

**MSI (WiX)** is the machine-wide / IT-managed channel. It presents the full
branded setup wizard and supports normal Windows maintenance mode — repair,
update and uninstall through Installed Apps — but installs under
`Program Files`, so it requires administrator rights.

The app keeps menu documents, templates, preferences and recovery files in the
user profile. Uninstalling the application must not delete restaurant menu
documents or user-created templates.

## First Install

1. Recipient downloads the signed MSI from a trusted link.
2. Windows verifies the Authenticode signature and publisher before running it.
3. The branded installer wizard opens, shows Griffin artwork, lets the user
   confirm the install location, and installs Griffin Menu Studio.
4. The first launch shows the Griffin splash while real startup work runs:
   recovery marker setup, file association registration, preference restore,
   template loading, editor initialisation, print-engine preparation and font
   readiness.

## Update

1. Build a release with a higher semantic version.
2. Keep the same WiX `upgradeCode` in `forge.config.ts`.
3. Sign every packaged Windows binary and the MSI.
4. Recipient closes every Griffin Menu Studio window before running the newer
   MSI, protecting unsaved edits.
5. Windows Installer recognises the existing product family and performs an
   in-place upgrade.
6. Existing user data remains untouched.

Never reuse a version number for a different release. Do not force-close running
Griffin processes during an update: users may have unsaved menu changes.

## Repair

Repair is available through Windows Installer maintenance mode:

- Run the installed MSI again, or use **Settings > Apps > Installed apps >
  Griffin Menu Studio > Modify/Repair** where Windows exposes it.
- Choose **Repair** to restore missing or damaged application files.
- Repair must not reset preferences, templates, recovery snapshots or `.menu`
  documents.

## Uninstall

Uninstall is available from **Settings > Apps > Installed apps > Griffin Menu
Studio > Uninstall** or from the MSI maintenance wizard's **Remove** option.

Uninstall removes application files and shortcuts. It intentionally preserves
user data in the profile so the restaurant can reinstall without losing menus.
Only delete the app data folder manually after making a backup and confirming a
full reset is intended.

## Signing A Release

Use a real organisation-validated code-signing identity for The Griffin. The PFX
file and password are secrets and must never be committed.

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

`make:release` refuses to run without a readable certificate, builds the branded
MSI and verifies Authenticode status on the generated Windows binaries. The make
script uses installed WiX v3 tools when available; otherwise it downloads the
official WiX 3.14.1 NuGet package into a local build cache for the current user.
Verify the final MSI independently before distributing it:

```powershell
Get-AuthenticodeSignature ".\out\make\wix\x64\Griffin Menu Studio.msi"
```

For Azure Trusted Signing or an EV certificate stored in hardware/cloud storage,
replace the PFX configuration with an `@electron/windows-sign` hook. Do not add
cloud credentials to this repository.

## Release QA

- Clean-account first install.
- Re-run the same MSI and confirm maintenance mode appears.
- Run Repair and confirm the app still launches.
- Upgrade from the previous MSI release.
- Attempt downgrade and confirm Windows Installer refuses or clearly handles it.
- Update after all Griffin windows are closed.
- Attempt update with a Griffin window containing unsaved changes; verify user
  guidance and no forced data loss.
- Uninstall and confirm saved `.menu` files, user templates and preferences
  remain.
- Reinstall after uninstall and confirm the app can use existing user data.
- Verify the MSI and packaged application have `Valid` Authenticode signatures.
- Confirm Start menu, taskbar and Installed Apps show the Griffin icon/name.
