import { app, autoUpdater, type BrowserWindow } from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import type { UpdateErrorCode, UpdateInfo } from '../shared/api';

// Auto-update over Squirrel.Windows + GitHub Releases (via Electron's free public
// update service, update.electronjs.org — requires the repo be public). Squirrel
// does the download/install; we additionally read the GitHub Releases API for the
// version, headline and change log so the UI can show "what's in the update", and
// for a manual check with real error codes (offline / not-connected / etc.).

const REPO = 'RogerPerowne/the-griffin-menu-studio';

let getWin: () => BrowserWindow | null = () => null;
let info: UpdateInfo = { phase: 'idle', currentVersion: app.getVersion() };

function push(): void {
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send('update:state', info);
}

function set(patch: Partial<UpdateInfo>): void {
  info = { ...info, ...patch };
  push();
}

export function getUpdateInfo(): UpdateInfo {
  return info;
}

interface Release {
  version: string;
  title: string;
  notes: string;
  url: string;
  publishedAt: string;
}

type FetchResult = { ok: true; release: Release } | { ok: false; code: UpdateErrorCode; message: string };

/** Read the latest GitHub release for version + headline + change log, with clear errors. */
async function fetchLatestRelease(): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'GriffinMenuStudio' },
    });
  } catch {
    return { ok: false, code: 'offline', message: 'No internet connection — could not reach the update server.' };
  }
  if (res.status === 404) {
    return { ok: false, code: 'notFound', message: 'No published release was found. The update source may not be connected yet.' };
  }
  if (res.status === 403) {
    return { ok: false, code: 'rateLimited', message: 'The update server is busy (rate limited). Please try again shortly.' };
  }
  if (!res.ok) {
    return { ok: false, code: 'feedError', message: `The update server returned an error (${res.status}).` };
  }
  let data: { tag_name?: string; name?: string; body?: string; html_url?: string; published_at?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, code: 'feedError', message: 'The update server returned an unreadable response.' };
  }
  const version = (data.tag_name || data.name || '').replace(/^v/i, '').trim();
  if (!version) return { ok: false, code: 'feedError', message: 'The latest release is missing a version number.' };
  return {
    ok: true,
    release: {
      version,
      title: data.name?.trim() || `Version ${version}`,
      notes: (data.body || '').trim(),
      url: data.html_url || '',
      publishedAt: data.published_at || '',
    },
  };
}

/** Compare dotted versions with an optional -prerelease suffix. >0 when a is newer. */
function compareVersions(a: string, b: string): number {
  const parse = (v: string): { nums: number[]; pre: string } => {
    const [core, pre] = v.split('-');
    return { nums: core.split('.').map((n) => parseInt(n, 10) || 0), pre: pre || '' };
  };
  const A = parse(a);
  const B = parse(b);
  for (let i = 0; i < 3; i += 1) {
    const d = (A.nums[i] || 0) - (B.nums[i] || 0);
    if (d) return d;
  }
  if (!A.pre && B.pre) return 1; // a release is newer than a prerelease of the same core
  if (A.pre && !B.pre) return -1;
  return A.pre === B.pre ? 0 : A.pre > B.pre ? 1 : -1;
}

export function initAutoUpdate(windowGetter: () => BrowserWindow | null): void {
  getWin = windowGetter;
  if (!app.isPackaged) {
    set({ phase: 'unsupported' });
    return; // dev builds cannot update
  }

  try {
    updateElectronApp({
      updateSource: { type: UpdateSourceType.ElectronPublicUpdateService, repo: REPO },
      updateInterval: '1 hour',
      notifyUser: false, // we drive our own in-app UI
    });
  } catch (error) {
    set({ phase: 'error', errorCode: 'feedError', errorMessage: error instanceof Error ? error.message : 'Auto-update failed to start.' });
    return;
  }

  autoUpdater.on('checking-for-update', () => {
    if (info.phase === 'idle' || info.phase === 'upToDate' || info.phase === 'error') set({ phase: 'checking', errorCode: undefined, errorMessage: undefined });
  });
  autoUpdater.on('update-available', () => set({ phase: 'downloading', cancelled: false }));
  autoUpdater.on('update-not-available', () => {
    if (info.phase !== 'downloaded') set({ phase: 'upToDate' });
  });
  autoUpdater.on('update-downloaded', (_event, notes, name) => {
    void announceDownloaded(name || undefined, notes || undefined);
  });
  autoUpdater.on('error', (error) => set({ phase: 'error', errorCode: 'feedError', errorMessage: error instanceof Error ? error.message : String(error) }));
}

/** A build is staged by Squirrel — enrich with GitHub metadata and announce it. */
async function announceDownloaded(name?: string, notes?: string): Promise<void> {
  const latest = await fetchLatestRelease();
  if (latest.ok) {
    set({ phase: 'downloaded', newVersion: latest.release.version, title: latest.release.title, notes: latest.release.notes, url: latest.release.url, publishedAt: latest.release.publishedAt, deferred: false });
  } else {
    set({ phase: 'downloaded', title: name || 'Update ready', notes: notes || '', deferred: false });
  }
}

/** Manual check: clear errors, read GitHub, and kick Squirrel if a newer build exists. */
export async function checkForUpdates(): Promise<UpdateInfo> {
  if (!app.isPackaged) {
    set({ phase: 'unsupported' });
    return info;
  }
  if (info.phase === 'downloaded') return info; // one is already ready
  set({ phase: 'checking', errorCode: undefined, errorMessage: undefined });
  const latest = await fetchLatestRelease();
  if (!latest.ok) {
    set({ phase: 'error', errorCode: latest.code, errorMessage: latest.message });
    return info;
  }
  if (compareVersions(latest.release.version, info.currentVersion) > 0) {
    set({ phase: 'downloading', newVersion: latest.release.version, title: latest.release.title, notes: latest.release.notes, url: latest.release.url, publishedAt: latest.release.publishedAt, cancelled: false });
    try {
      autoUpdater.checkForUpdates(); // start the Squirrel download
    } catch {
      // Squirrel will retry on its own interval.
    }
  } else {
    set({ phase: 'upToDate', newVersion: undefined });
  }
  return info;
}

/** "Update Now" — apply the staged update and relaunch (before-quit still runs). */
export function installUpdateNow(): void {
  if (info.phase === 'downloaded' && !info.cancelled) autoUpdater.quitAndInstall();
}

/** "Later" — dismiss; Squirrel applies the staged update on the next app start. */
export function deferUpdate(): void {
  set({ deferred: true });
}

/** "Cancel" — suppress this update's prompt for the rest of the session. */
export function cancelUpdate(): void {
  set({ cancelled: true });
}
