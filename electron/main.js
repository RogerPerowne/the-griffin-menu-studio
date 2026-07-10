const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { DEFAULT_MIN_SPLASH_MS, DEFAULT_STARTUP_TIMEOUT_MS, runStartupTasks, waitForReveal } = require('./startup');
const {
  DOCUMENT_EXTENSION,
  parseDocumentText,
  serializeDocument
} = require('./document-format');

const isDev = !app.isPackaged;
let mainWindow;
let splashWindow;
let currentFilePath = null;
let currentState = null;
let dirty = false;
let closeAllowed = false;
let splashStartedAt = 0;
let rendererReadyResolve;
let pendingEditorAction = null;
let startupSnapshot = {
  recent: [],
  autosavePath: null,
  autosaveDocument: null,
  firstRun: true,
  preferences: { minSplashMs: DEFAULT_MIN_SPLASH_MS },
  timings: {}
};
const pendingCommands = new Map();

function userDataPath(...parts) {
  return path.join(app.getPath('userData'), ...parts);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function recentPath() {
  return userDataPath('recent.json');
}

function getRecentFiles() {
  return readJson(recentPath(), []).filter((filePath) => typeof filePath === 'string');
}

function recentEntries() {
  return getRecentFiles()
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => {
      const resolved = path.resolve(filePath);
      const entry = {
        filePath: resolved,
        fileName: path.basename(resolved),
        name: path.basename(resolved, DOCUMENT_EXTENSION),
        modifiedMs: 0,
        state: null,
        error: null
      };
      try {
        const stat = fs.statSync(resolved);
        entry.modifiedMs = stat.mtimeMs;
        const document = parseDocumentText(fs.readFileSync(resolved, 'utf8'));
        const menu = document.state?.menus?.find((item) => item.id === document.state?.cur) || document.state?.menus?.[0];
        entry.name = menu?.name || entry.name;
        entry.state = document.state;
      } catch (error) {
        entry.error = error && error.message ? error.message : 'Could not read recent document.';
      }
      return entry;
    });
}

function addRecentFile(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  const recent = [resolved, ...getRecentFiles().filter((entry) => entry !== resolved)].slice(0, 10);
  writeJson(recentPath(), recent);
  app.addRecentDocument(resolved);
  buildMenu();
}

function validateDocumentPath(filePath) {
  if (!filePath || typeof filePath !== 'string') throw new Error('Invalid file path.');
  const resolved = path.resolve(filePath);
  if (path.extname(resolved).toLowerCase() !== DOCUMENT_EXTENSION) {
    throw new Error(`Griffin documents must use ${DOCUMENT_EXTENSION}.`);
  }
  return resolved;
}

function defaultFileName(state) {
  const menu = state?.menus?.find((item) => item.id === state.cur) || state?.menus?.[0];
  const base = (menu?.name || 'Griffin Menu').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim() || 'Griffin Menu';
  return `${base}${DOCUMENT_EXTENSION}`;
}

function setDirty(value) {
  dirty = Boolean(value);
  updateTitle();
}

function updateTitle() {
  if (!mainWindow) return;
  const name = currentFilePath ? path.basename(currentFilePath) : 'Untitled.griffinmenu';
  mainWindow.setTitle(`${dirty ? '* ' : ''}${name} - Griffin Menu Studio`);
  mainWindow.setDocumentEdited(dirty);
}

async function chooseSavePath(state) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Griffin Menu',
    defaultPath: currentFilePath || defaultFileName(state),
    filters: [{ name: 'Griffin Menu Studio Document', extensions: ['griffinmenu'] }]
  });
  if (result.canceled || !result.filePath) return null;
  let filePath = result.filePath;
  if (path.extname(filePath).toLowerCase() !== DOCUMENT_EXTENSION) filePath += DOCUMENT_EXTENSION;
  return validateDocumentPath(filePath);
}

function saveToPath(filePath, state) {
  const resolved = validateDocumentPath(filePath);
  fs.writeFileSync(resolved, serializeDocument(state), 'utf8');
  currentFilePath = resolved;
  currentState = state;
  try {
    if (fs.existsSync(autosavePath())) fs.unlinkSync(autosavePath());
  } catch {
    // A stale recovery file should not prevent a successful manual save.
  }
  addRecentFile(resolved);
  setDirty(false);
  return { canceled: false, filePath: resolved };
}

function loadFromPath(filePath) {
  const resolved = validateDocumentPath(filePath);
  const document = parseDocumentText(fs.readFileSync(resolved, 'utf8'));
  currentFilePath = resolved;
  currentState = document.state;
  addRecentFile(resolved);
  setDirty(false);
  return { filePath: resolved, document };
}

function autosavePath() {
  return userDataPath('autosave', 'recovery.griffinmenu');
}

function readAutosaveDocument() {
  try {
    if (!fs.existsSync(autosavePath())) return null;
    return parseDocumentText(fs.readFileSync(autosavePath(), 'utf8'));
  } catch {
    return null;
  }
}

function prefsPath() {
  return userDataPath('preferences.json');
}

function windowStatePath() {
  return userDataPath('window-state.json');
}

function readPreferences() {
  return Object.assign({ minSplashMs: DEFAULT_MIN_SPLASH_MS }, readJson(prefsPath(), {}));
}

function readWindowState() {
  const state = readJson(windowStatePath(), null);
  if (!state || typeof state !== 'object') return null;
  if (!Number.isFinite(state.width) || !Number.isFinite(state.height)) return null;
  return state;
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  writeJson(windowStatePath(), {
    ...mainWindow.getBounds(),
    maximized: mainWindow.isMaximized()
  });
}

function sendSplashStatus(payload) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:status', payload);
  }
}

function fadeSplashAndShowMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
  updateTitle();
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:fade');
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    }, 240);
  }
}

function createSplashWindow() {
  splashStartedAt = Date.now();
  splashWindow = new BrowserWindow({
    width: 620,
    height: 380,
    frame: false,
    resizable: false,
    show: true,
    transparent: false,
    backgroundColor: '#efe7da',
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });
  splashWindow.loadFile(path.join(__dirname, '..', 'src', 'splash.html'));
}

function createMainWindow(windowState) {
  mainWindow = new BrowserWindow({
    width: windowState?.width || 1440,
    height: windowState?.height || 980,
    x: windowState?.x,
    y: windowState?.y,
    minWidth: 1120,
    minHeight: 760,
    show: false,
    backgroundColor: '#F6F2EA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'start.html'));
  if (windowState?.maximized) mainWindow.once('ready-to-show', () => mainWindow.maximize());

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('close', async (event) => {
    if (closeAllowed || !dirty) return;
    event.preventDefault();
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: 'Save changes before closing Griffin Menu Studio?'
    });
    if (choice.response === 2) return;
    if (choice.response === 1) {
      closeAllowed = true;
      mainWindow.close();
      return;
    }
    mainWindow.webContents.send('app:saveAndClose');
  });
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
}

function loadEditor(action = null) {
  pendingEditorAction = action;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
}

function sendCommand(command) {
  if (!mainWindow) return;
  if (command === 'toggle-full-screen') {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return;
  }
  mainWindow.webContents.send('app:command', { command });
}

function commandMenuItem(label, accelerator, command) {
  return { label, accelerator, click: () => sendCommand(command) };
}

function buildMenu() {
  const recent = getRecentFiles();
  const recentSubmenu = recent.length
    ? recent.map((filePath) => ({
      label: path.basename(filePath),
      sublabel: filePath,
      click: () => mainWindow?.webContents.send('app:command', { command: 'open-recent', filePath })
    }))
    : [{ label: 'No Recent Documents', enabled: false }];

  const template = [
    {
      label: 'File',
      submenu: [
        commandMenuItem('New', 'CmdOrCtrl+N', 'new'),
        commandMenuItem('New Menu', 'CmdOrCtrl+Alt+N', 'new-menu'),
        commandMenuItem('New from Template...', 'CmdOrCtrl+Shift+N', 'new-template'),
        commandMenuItem('Open...', 'CmdOrCtrl+O', 'open'),
        { label: 'Open Recent', submenu: recentSubmenu },
        { type: 'separator' },
        commandMenuItem('Save', 'CmdOrCtrl+S', 'save'),
        commandMenuItem('Save As...', 'CmdOrCtrl+Shift+S', 'save-as'),
        { type: 'separator' },
        commandMenuItem('Export PDF...', 'CmdOrCtrl+E', 'export-pdf'),
        commandMenuItem('Export PNG...', 'CmdOrCtrl+Shift+E', 'export-png'),
        commandMenuItem('Print...', 'CmdOrCtrl+P', 'print'),
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        commandMenuItem('Undo', 'CmdOrCtrl+Z', 'undo'),
        commandMenuItem('Redo', 'CmdOrCtrl+Shift+Z', 'redo'),
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        commandMenuItem('Duplicate', 'CmdOrCtrl+D', 'duplicate'),
        { label: 'Select All', role: 'selectAll' },
        { type: 'separator' },
        commandMenuItem('Settings', 'CmdOrCtrl+,', 'settings')
      ]
    },
    {
      label: 'View',
      submenu: [
        commandMenuItem('Zoom In', 'CmdOrCtrl+=', 'zoom-in'),
        commandMenuItem('Zoom Out', 'CmdOrCtrl+-', 'zoom-out'),
        commandMenuItem('Actual Size', 'CmdOrCtrl+0', 'actual-size'),
        commandMenuItem('Fit Page', 'CmdOrCtrl+9', 'fit-page'),
        { type: 'separator' },
        commandMenuItem('Full Screen', 'F11', 'toggle-full-screen'),
        commandMenuItem('Show Guides', 'CmdOrCtrl+;', 'toggle-guides'),
        commandMenuItem('Show Safe Area', 'CmdOrCtrl+Shift+;', 'toggle-safe-area')
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function registerIpc() {
  ipcMain.handle('app:ready', () => true);
  ipcMain.handle('app:startData', () => ({
    recent: startupSnapshot.recent,
    firstRun: startupSnapshot.firstRun,
    startupTimings: startupSnapshot.timings
  }));
  ipcMain.handle('app:createFromTemplate', (_event, templateId) => {
    if (typeof templateId !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(templateId)) {
      throw new Error('Invalid template id.');
    }
    currentFilePath = null;
    currentState = null;
    setDirty(false);
    loadEditor({ type: 'template', templateId });
    return { ok: true };
  });
  ipcMain.handle('app:createBlank', () => {
    currentFilePath = null;
    currentState = null;
    setDirty(false);
    loadEditor({ type: 'blank' });
    return { ok: true };
  });
  ipcMain.handle('app:showStart', () => {
    currentFilePath = null;
    currentState = null;
    setDirty(false);
    pendingEditorAction = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, '..', 'src', 'start.html'));
    }
    return { ok: true };
  });
  ipcMain.handle('app:openFromStart', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Griffin Menu',
      properties: ['openFile'],
      filters: [{ name: 'Griffin Menu Studio Document', extensions: ['griffinmenu'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const opened = loadFromPath(result.filePaths[0]);
    loadEditor({ type: 'open' });
    return { canceled: false, filePath: opened.filePath };
  });
  ipcMain.handle('app:openRecentFromStart', (_event, filePath) => {
    const resolved = validateDocumentPath(filePath);
    if (!getRecentFiles().map((entry) => path.resolve(entry)).includes(resolved)) {
      throw new Error('That file is not in the recent document list.');
    }
    const opened = loadFromPath(resolved);
    loadEditor({ type: 'open' });
    return { canceled: false, filePath: opened.filePath };
  });
  ipcMain.handle('app:rendererReady', (_event, payload) => {
    startupSnapshot.timings.renderer = payload || {};
    if (rendererReadyResolve) rendererReadyResolve(payload || {});
    return { ok: true };
  });
  ipcMain.handle('app:closeConfirmed', () => {
    closeAllowed = true;
    mainWindow.close();
  });
  ipcMain.handle('app:commandDone', (_event, payload) => {
    const resolver = pendingCommands.get(payload?.id);
    if (resolver) {
      pendingCommands.delete(payload.id);
      resolver(payload.result);
    }
  });
  ipcMain.handle('document:initial', () => {
    const startupAction = pendingEditorAction;
    pendingEditorAction = null;
    return {
      filePath: currentFilePath,
      document: currentState ? { state: currentState } : null,
      startupAction,
      autosavePath: startupSnapshot.autosavePath,
      autosaveDocument: startupSnapshot.autosaveDocument,
      recent: startupSnapshot.recent,
      firstRun: startupSnapshot.firstRun,
      startupTimings: startupSnapshot.timings
    };
  });
  ipcMain.handle('document:new', () => {
    currentFilePath = null;
    currentState = null;
    setDirty(false);
    return { filePath: null };
  });
  ipcMain.handle('document:open', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Griffin Menu',
      properties: ['openFile'],
      filters: [{ name: 'Griffin Menu Studio Document', extensions: ['griffinmenu'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, ...loadFromPath(result.filePaths[0]) };
  });
  ipcMain.handle('document:openRecent', (_event, filePath) => {
    const resolved = validateDocumentPath(filePath);
    if (!getRecentFiles().map((entry) => path.resolve(entry)).includes(resolved)) {
      throw new Error('That file is not in the recent document list.');
    }
    return { canceled: false, ...loadFromPath(resolved) };
  });
  ipcMain.handle('document:save', async (_event, state) => {
    if (!currentFilePath) {
      const filePath = await chooseSavePath(state);
      if (!filePath) return { canceled: true };
      return saveToPath(filePath, state);
    }
    return saveToPath(currentFilePath, state);
  });
  ipcMain.handle('document:saveAs', async (_event, state) => {
    const filePath = await chooseSavePath(state);
    if (!filePath) return { canceled: true };
    return saveToPath(filePath, state);
  });
  ipcMain.handle('document:autosave', (_event, state) => {
    fs.mkdirSync(path.dirname(autosavePath()), { recursive: true });
    fs.writeFileSync(autosavePath(), serializeDocument(state, { generator: { autosave: true } }), 'utf8');
    return { ok: true, filePath: autosavePath() };
  });
  ipcMain.handle('document:setDirty', (_event, value) => {
    setDirty(value);
    return { dirty };
  });
  ipcMain.handle('document:setTitle', (_event, title) => {
    if (!currentFilePath && title) mainWindow.setTitle(`${dirty ? '* ' : ''}${title} - Griffin Menu Studio`);
    else updateTitle();
  });
  ipcMain.handle('document:getRecent', () => recentEntries());
  ipcMain.handle('export:pdf', async (_event, payload) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export PDF',
      defaultPath: payload?.defaultName || 'Griffin Menu.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const pdf = await mainWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margins: { marginType: 'none' },
      pageSize: payload?.paper === 'A5' ? { width: 148000, height: 210000 } : { width: 210000, height: 297000 }
    });
    fs.writeFileSync(result.filePath, pdf);
    shell.showItemInFolder(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle('export:png', async (_event, payload) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export PNG',
      defaultPath: payload?.defaultName || 'Griffin Menu.png',
      filters: [{ name: 'PNG image', extensions: ['png'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const rect = payload?.rect && Number.isFinite(payload.rect.width) && Number.isFinite(payload.rect.height)
      ? {
        x: Math.max(0, Math.floor(payload.rect.x || 0)),
        y: Math.max(0, Math.floor(payload.rect.y || 0)),
        width: Math.max(1, Math.ceil(payload.rect.width)),
        height: Math.max(1, Math.ceil(payload.rect.height))
      }
      : undefined;
    const image = await mainWindow.webContents.capturePage(rect);
    fs.writeFileSync(result.filePath, image.toPNG());
    shell.showItemInFolder(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle('export:print', async () => {
    const ok = await mainWindow.webContents.print({
      printBackground: true,
      silent: false
    });
    return { ok };
  });
}

async function prepareStartup() {
  const tasks = [
    {
      id: 'preferences',
      label: 'Restoring preferences',
      critical: true,
      run: async () => readPreferences()
    },
    {
      id: 'windowState',
      label: 'Preparing workspace',
      critical: false,
      fallback: null,
      run: async () => readWindowState()
    },
    {
      id: 'recent',
      label: 'Loading recent menus',
      critical: false,
      fallback: [],
      run: async () => recentEntries()
    },
    {
      id: 'recovery',
      label: 'Checking recovery',
      critical: false,
      fallback: null,
      run: async () => readAutosaveDocument()
    },
    {
      id: 'assets',
      label: 'Loading templates',
      critical: true,
      run: async () => {
        await Promise.all([
          fs.promises.access(path.join(__dirname, '..', 'src', 'assets', 'full-lockup.png')),
          fs.promises.access(path.join(__dirname, '..', 'src', 'assets', 'crest.png')),
          fs.promises.access(path.join(__dirname, '..', 'src', 'index.html'))
        ]);
        return true;
      }
    },
    {
      id: 'export',
      label: 'Preparing print engine',
      critical: false,
      fallback: true,
      run: async () => true
    }
  ];

  const prepared = await runStartupTasks(tasks, { emit: sendSplashStatus });
  startupSnapshot.preferences = prepared.results.preferences || readPreferences();
  startupSnapshot.recent = prepared.results.recent || [];
  startupSnapshot.autosaveDocument = prepared.results.recovery || null;
  startupSnapshot.autosavePath = startupSnapshot.autosaveDocument ? autosavePath() : null;
  startupSnapshot.firstRun = startupSnapshot.recent.length === 0 && !startupSnapshot.autosaveDocument;
  startupSnapshot.timings.main = prepared.timings;
  return prepared.results;
}

async function revealWhenReady(rendererReadyPromise) {
  sendSplashStatus({ id: 'finalise', label: 'Finalising workspace', phase: 'start' });
  const result = await waitForReveal({
    splashStartedAt,
    criticalReady: rendererReadyPromise,
    minSplashMs: Number(startupSnapshot.preferences.minSplashMs) || DEFAULT_MIN_SPLASH_MS,
    timeoutMs: DEFAULT_STARTUP_TIMEOUT_MS
  });
  startupSnapshot.timings.reveal = result;
  sendSplashStatus({ id: 'ready', label: 'Ready', phase: result.timedOut ? 'error' : 'complete' });
  fadeSplashAndShowMain();
}

app.whenReady().then(async () => {
  app.setName('Griffin Menu Studio');
  registerIpc();
  createSplashWindow();
  const rendererReadyPromise = new Promise((resolve) => {
    rendererReadyResolve = resolve;
  });
  const startupResults = await prepareStartup().catch((error) => {
    console.error('Startup preparation failed:', error);
    sendSplashStatus({ id: 'startup', label: 'Preparing workspace', phase: 'error', error: error.message });
    return { preferences: readPreferences(), windowState: null };
  });
  createMainWindow(startupResults.windowState);
  buildMenu();
  revealWhenReady(rendererReadyPromise);
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
