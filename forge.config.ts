import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerWix } from '@electron-forge/maker-wix';
import { MakerZIP } from '@electron-forge/maker-zip';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';
import path from 'node:path';

// Dev channel (GRIFFIN_CHANNEL=dev, via `npm run make:dev`): a separate product
// ("Griffin Menu Studio Dev") that installs alongside production with its own data
// + no auto-update, so it can be tested without ever touching the restaurant's
// install. Production (`npm run make`) is unchanged; `npm run release` publishes it.
const isDevChannel = process.env.GRIFFIN_CHANNEL === 'dev';
const productName = isDevChannel ? 'Griffin Menu Studio Dev' : 'Griffin Menu Studio';
const internalName = isDevChannel ? 'GriffinMenuStudioDev' : 'GriffinMenuStudio';
const setupExeName = `${productName} Setup.exe`;

const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;
const rootDir = __dirname;
const windowsSign =
  certificateFile && certificatePassword
    ? {
        certificateFile,
        certificatePassword,
        description: 'Griffin Menu Studio',
        timestampServer: process.env.WINDOWS_TIMESTAMP_SERVER || 'http://timestamp.digicert.com',
      }
    : undefined;

const config: ForgeConfig = {
  packagerConfig: {
    name: productName,
    executableName: productName,
    asar: true,
    icon: 'build/icon',
    appCopyright: 'Copyright (c) The Griffin',
    win32metadata: {
      CompanyName: 'The Griffin',
      FileDescription: 'Desktop menu editor and print/export tool for The Griffin.',
      ProductName: productName,
      InternalName: internalName,
    },
    ...(windowsSign ? { windowsSign } : {}),
  },
  rebuildConfig: {},
  makers: [
    // Recommended path for non-technical users: a per-user Setup.exe that
    // installs into %LocalAppData% with no admin/UAC prompt and no folder
    // picker — double-click and it launches itself when done.
    new MakerSquirrel({
      name: internalName,
      setupExe: setupExeName,
      setupIcon: path.join(rootDir, 'build/icon.ico'),
      loadingGif: path.join(rootDir, 'build/installer/squirrel-splash.gif'),
      authors: 'The Griffin',
      description: 'Desktop menu editor and print/export tool for The Griffin.',
      noMsi: true,
      ...(windowsSign ? { windowsSign } : {}),
    }),
    // The dev channel ships only the Squirrel installer; the MSI/ZIP below (with
    // their own upgrade codes) are production-only.
    ...(isDevChannel
      ? []
      : [
    // Full branded MSI wizard for machine-wide / managed installs (needs admin).
    new MakerWix({
      name: 'Griffin Menu Studio',
      shortName: 'GriffinMenuStudio',
      manufacturer: 'The Griffin',
      exe: 'Griffin Menu Studio.exe',
      icon: 'build/icon.ico',
      appUserModelId: 'com.thegriffin.GriffinMenuStudio',
      upgradeCode: '4c3e1791-1d30-4b86-97b6-f4f0dd2f0b83',
      programFilesFolderName: 'Griffin Menu Studio',
      shortcutFolderName: 'The Griffin',
      shortcutName: 'Griffin Menu Studio',
      defaultInstallMode: 'perUser',
      language: 1033,
      ui: {
        chooseDirectory: true,
        images: {
          background: path.join(rootDir, 'build/installer/wix-dialog.bmp'),
          banner: path.join(rootDir, 'build/installer/wix-banner.bmp'),
        },
      },
      description: 'Desktop menu editor and print/export tool for The Griffin.',
      ...(windowsSign ? { windowsSign } : {}),
    }),
    new MakerZIP({}, ['win32']),
        ]),
  ],
  publishers: [
    // `npm run publish` uploads the Squirrel Setup.exe + .nupkg + RELEASES (and
    // the MSI) to a GitHub Release. The installed app auto-updates from these via
    // update.electronjs.org (see src/main/updater.ts). Needs GITHUB_TOKEN set.
    new PublisherGithub({
      repository: { owner: 'RogerPerowne', name: 'the-griffin-menu-studio' },
      draft: false,
      prerelease: false,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
