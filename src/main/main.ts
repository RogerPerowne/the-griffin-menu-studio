import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { getActiveBrand } from '../shared/brand';

// Handle Squirrel install/uninstall shortcut events on Windows.
if (started) {
  app.quit();
}

const brand = getActiveBrand();

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

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
    },
  });
  loadRendererPage(splashWindow, 'splash');
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1120,
    minHeight: 760,
    show: false,
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
    },
  });

  // Security: block new windows and external navigation.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  loadRendererPage(mainWindow, 'index');

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    splashWindow = null;
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  createSplashWindow();
  createMainWindow();
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
