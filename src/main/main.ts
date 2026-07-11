import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { getActiveBrand } from '../shared/brand';
import { ensureMenuFileAssociation, removeMenuFileAssociation } from './file-association';
import { registerIpc } from './ipc';
import { beginRecoverySession, markRecoverySessionClean } from './recovery';
import { stageLaunchDocument } from './documents';

// Handle Squirrel install/uninstall shortcut events on Windows.
if (started) {
  if (process.argv.includes('--squirrel-uninstall')) {
    void removeMenuFileAssociation().finally(() => app.quit());
  } else {
    app.quit();
  }
}

const brand = getActiveBrand();

// Keeps taskbar grouping, Start menu activation and Squirrel-installed
// shortcuts stable even though the user-facing product name contains spaces.
app.setAppUserModelId('com.squirrel.GriffinMenuStudio.GriffinMenuStudio');

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let cleanQuitInProgress = false;

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
  splashWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    resizable: false,
    show: true,
    backgroundColor: brand.palette.cream,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  hardenWindowNavigation(splashWindow);
  loadRendererPage(splashWindow, 'splash');
}

function createMainWindow(): BrowserWindow {
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

  win.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    splashWindow = null;
    win.show();
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = BrowserWindow.getAllWindows().find((candidate) => candidate !== splashWindow) ?? null;
    }
  });

  return win;
}

app.on('ready', () => {
  void beginRecoverySession();
  void ensureMenuFileAssociation();
  registerIpc(createMainWindow);
  createSplashWindow();
  const win = createMainWindow();
  const launchPath = launchMenuPath(process.argv);
  if (launchPath) stageLaunchDocument(win, launchPath);
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
    createSplashWindow();
    createMainWindow();
  }
});
