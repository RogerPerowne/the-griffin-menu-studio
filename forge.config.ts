import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerWix } from '@electron-forge/maker-wix';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import path from 'node:path';

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
    name: 'Griffin Menu Studio',
    executableName: 'Griffin Menu Studio',
    asar: true,
    icon: 'build/icon',
    appCopyright: 'Copyright (c) The Griffin',
    win32metadata: {
      CompanyName: 'The Griffin',
      FileDescription: 'Desktop menu editor and print/export tool for The Griffin.',
      ProductName: 'Griffin Menu Studio',
      InternalName: 'GriffinMenuStudio',
    },
    ...(windowsSign ? { windowsSign } : {}),
  },
  rebuildConfig: {},
  makers: [
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
