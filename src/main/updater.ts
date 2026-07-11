import { app, autoUpdater, type BrowserWindow } from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

// Auto-update via Squirrel.Windows + GitHub Releases, proxied by Electron's free
// public update service (update.electronjs.org — requires the repo be public).
// UX: check + download silently in the background, then push update:downloaded so
// the renderer can offer a gentle "Restart to apply" toast. If the user ignores
// it, Squirrel applies the update on the next normal quit.

const REPO = 'RogerPerowne/the-griffin-menu-studio';

let updateReady = false;

export function initAutoUpdate(getWindow: () => BrowserWindow | null): void {
  // Only packaged builds can update; in dev updateElectronApp would throw/no-op.
  if (!app.isPackaged) return;

  try {
    updateElectronApp({
      updateSource: { type: UpdateSourceType.ElectronPublicUpdateService, repo: REPO },
      updateInterval: '1 hour',
      notifyUser: false, // we surface our own in-app toast instead of the default dialog
    });
  } catch (error) {
    console.error('Auto-update initialisation failed:', error);
    return;
  }

  autoUpdater.on('update-downloaded', (_event, _notes, releaseName) => {
    updateReady = true;
    getWindow()?.webContents.send('update:downloaded', { releaseName: releaseName ?? '' });
  });
  autoUpdater.on('error', (error) => console.error('Auto-update error:', error));
}

export function isUpdateReady(): boolean {
  return updateReady;
}

/**
 * Apply a downloaded update and relaunch. Squirrel spawns its updater before the
 * app exits, so the existing before-quit recovery-clean step still runs first.
 */
export function quitAndInstallUpdate(): void {
  if (updateReady) autoUpdater.quitAndInstall();
}
