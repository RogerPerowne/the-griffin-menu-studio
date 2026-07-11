import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import squirrelStartup from 'electron-squirrel-startup';
import { getActiveBrand } from '../shared/brand';
import { ensureMenuFileAssociation } from './file-association';
import { registerIpc } from './ipc';
import { beginRecoverySession, markRecoverySessionClean } from './recovery';
import { stageLaunchDocument, disposeDocumentWatch } from './documents';
import { initAutoUpdate } from './updater';

// The Squirrel Setup.exe launches the app with --squirrel-install / -updated /
// -uninstall / -obsolete so it can create or remove Start-menu and desktop
// shortcuts. Handle those silently and quit — never show a window mid-install.
if (squirrelStartup) {
  app.quit();
}

// Single-instance: a second launch (e.g. double-clicking another .menu, or the
// updater relaunch) routes into the running instance instead of spawning a new
// process/window. The second instance's argv is delivered via 'second-instance'.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

const brand = getActiveBrand();
const APP_USER_MODEL_ID = 'com.thegriffin.GriffinMenuStudio';
const MIN_SPLASH_MS = 1_800;
const SPLASH_FADE_MS = 220;
const STARTUP_TIMEOUT_MS = 15_000;

// Keeps taskbar grouping, Start menu activation and Windows notifications stable.
app.setAppUserModelId(APP_USER_MODEL_ID);

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let cleanQuitInProgress = false;
let splashStartedAt = 0;
const rendererReadyResolvers = new WeakMap<BrowserWindow, () => void>();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendSplashStatus(label: string): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.webContents.send('splash:status', label);
}

async function startupTask(label: string, task: () => Promise<unknown>, critical = true): Promise<void> {
  sendSplashStatus(label);
  try {
    await task();
  } catch (error) {
    console.error(`Startup task failed: ${label}`, error);
    if (critical) throw error;
  }
}

function hardenWindowNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === 'https:' || target.protocol === 'http:') void shell.openExternal(target.toString());
    } catch {
      // An invalid URL is simply denied.
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('will-redirect', (event) => event.preventDefault());
}

/** Resolve a renderer HTML page for dev (Vite server) or prod (built files). */
function loadRendererPage(win: BrowserWindow, page: 'index' | 'splash'): void {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const suffix = page === 'index' ? '' : `${page}.html`;
    win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/${suffix}`);
  } else {
    const file = page === 'index' ? 'index.html' : `${page}.html`;
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/${file}`));
  }
}

function launchMenuPath(argv: string[]): string | null {
  const candidate = argv.find((arg) => arg.toLowerCase().endsWith('.menu') && path.isAbsolute(arg));
  return candidate ? path.normalize(candidate) : null;
}

function createSplashWindow(): void {
  splashStartedAt = Date.now();
  splashWindow = new BrowserWindow({
    width: 560,
    height: 360,
    frame: false,
    resizable: false,
    show: true,
    backgroundColor: brand.palette.cream,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  hardenWindowNavigation(splashWindow);
  loadRendererPage(splashWindow, 'splash');
}

function createMainWindow(options: { deferShow?: boolean } = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1120,
    minHeight: 760,
    show: false,
    icon: path.join(__dirname, '../../build/icon.ico'),
    backgroundColor: brand.palette.cream,
    // Custom branded title bar with native Windows min/max/close via overlay.
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: brand.palette.cream,
      symbolColor: brand.palette.ink,
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Security: block new windows and external navigation.
  mainWindow = win;

  hardenWindowNavigation(win);

  win.on('close', (event) => {
    if (cleanQuitInProgress) {
      return;
    }
    event.preventDefault();
    win.webContents.send('window:closeRequest');
  });

  loadRendererPage(win, 'index');

  if (!options.deferShow) win.once('ready-to-show', () => win.show());

  win.on('closed', () => {
    disposeDocumentWatch(win);
    if (mainWindow === win) {
      mainWindow = BrowserWindow.getAllWindows().find((candidate) => candidate !== splashWindow) ?? null;
    }
  });

  return win;
}

function waitForRendererReady(win: BrowserWindow): Promise<void> {
  return new Promise((resolve) => rendererReadyResolvers.set(win, resolve));
}

function waitForReadyToShow(win: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    if (win.isVisible()) {
      resolve();
      return;
    }
    win.once('ready-to-show', resolve);
  });
}

async function revealMainWindow(win: BrowserWindow): Promise<void> {
  sendSplashStatus('Ready');
  const elapsed = Date.now() - splashStartedAt;
  if (elapsed < MIN_SPLASH_MS) await wait(MIN_SPLASH_MS - elapsed);

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:hide');
    await wait(SPLASH_FADE_MS);
  }

  if (!win.isDestroyed()) {
    win.show();
    win.focus();
  }
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

async function startPrimaryWindow(argv: string[]): Promise<void> {
  createSplashWindow();
  sendSplashStatus('Preparing workspace');

  const recoveryTask = startupTask('Checking recovery', beginRecoverySession, true);
  const associationTask = startupTask('Registering menu files', ensureMenuFileAssociation, false);

  sendSplashStatus('Loading application shell');
  const win = createMainWindow({ deferShow: true });
  const launchPath = launchMenuPath(argv);
  if (launchPath) stageLaunchDocument(win, launchPath);

  const critical = Promise.all([
    recoveryTask,
    associationTask,
    waitForReadyToShow(win),
    waitForRendererReady(win),
  ]);
  const timeout = wait(STARTUP_TIMEOUT_MS).then(() => {
    console.error(`Startup timed out after ${STARTUP_TIMEOUT_MS}ms; revealing main window with fallback.`);
  });

  await Promise.race([critical, timeout]);
  await revealMainWindow(win);

  // Non-blocking: check for updates once the window is up (packaged builds only).
  initAutoUpdate(() => mainWindow);
}

ipcMain.on('app:startupStatus', (event, label: unknown) => {
  if (typeof label !== 'string' || label.length > 80) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && win === mainWindow) sendSplashStatus(label);
});

ipcMain.on('app:rendererReady', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const resolve = rendererReadyResolvers.get(win);
  if (resolve) {
    rendererReadyResolvers.delete(win);
    resolve();
  }
});

app.on('second-instance', (_event, argv) => {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  // Route a double-clicked .menu from the second launch into this window: stage
  // it (pull model) and nudge the renderer to open it (with its dirty guard).
  const launchPath = launchMenuPath(argv);
  if (launchPath) {
    stageLaunchDocument(win, launchPath);
    win.webContents.send('document:launched');
  }
});

app.on('ready', () => {
  if (!hasSingleInstanceLock) return;
  registerIpc(() => createMainWindow());
  void startPrimaryWindow(process.argv);
});

app.on('before-quit', (event) => {
  if (cleanQuitInProgress) return;
  event.preventDefault();
  cleanQuitInProgress = true;
  void markRecoverySessionClean().finally(() => app.quit());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void startPrimaryWindow([]);
  }
});
