import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';

const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;
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
    new MakerSquirrel({
      name: 'GriffinMenuStudio',
      setupExe: 'GriffinMenuStudioSetup.exe',
      setupIcon: 'build/icon.ico',
      authors: 'The Griffin',
      title: 'Griffin Menu Studio',
      description: 'Desktop menu editor and print/export tool for The Griffin.',
      copyright: 'Copyright (c) The Griffin',
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
