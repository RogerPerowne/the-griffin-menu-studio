const { contextBridge, ipcRenderer } = require('electron');

const validCommands = new Set([
  'new',
  'new-menu',
  'new-template',
  'open',
  'open-recent',
  'save',
  'save-as',
  'export-pdf',
  'export-png',
  'print',
  'undo',
  'redo',
  'duplicate',
  'select-all',
  'settings',
  'zoom-in',
  'zoom-out',
  'actual-size',
  'fit-page',
  'toggle-full-screen',
  'toggle-guides',
  'toggle-safe-area'
]);

function on(channel, handler) {
  ipcRenderer.on(channel, (_event, payload) => handler(payload));
}

contextBridge.exposeInMainWorld('griffinDesktop', {
  ready: () => ipcRenderer.invoke('app:ready'),
  rendererReady: (payload) => ipcRenderer.invoke('app:rendererReady', payload),
  getStartData: () => ipcRenderer.invoke('app:startData'),
  createFromTemplate: (templateId) => ipcRenderer.invoke('app:createFromTemplate', String(templateId || '')),
  createBlank: () => ipcRenderer.invoke('app:createBlank'),
  showStart: () => ipcRenderer.invoke('app:showStart'),
  openFromStart: () => ipcRenderer.invoke('app:openFromStart'),
  openRecentFromStart: (filePath) => ipcRenderer.invoke('app:openRecentFromStart', filePath),
  getInitialDocument: () => ipcRenderer.invoke('document:initial'),
  newDocument: () => ipcRenderer.invoke('document:new'),
  openDocument: () => ipcRenderer.invoke('document:open'),
  openRecent: (filePath) => ipcRenderer.invoke('document:openRecent', filePath),
  saveDocument: (state) => ipcRenderer.invoke('document:save', state),
  saveDocumentAs: (state) => ipcRenderer.invoke('document:saveAs', state),
  autosave: (state) => ipcRenderer.invoke('document:autosave', state),
  setDirty: (dirty) => ipcRenderer.invoke('document:setDirty', Boolean(dirty)),
  setTitle: (title) => ipcRenderer.invoke('document:setTitle', String(title || '')),
  getRecent: () => ipcRenderer.invoke('document:getRecent'),
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  exportPng: (payload) => ipcRenderer.invoke('export:png', payload),
  printDocument: () => ipcRenderer.invoke('export:print'),
  confirmCloseDone: () => ipcRenderer.invoke('app:closeConfirmed'),
  commandDone: (id, result) => ipcRenderer.invoke('app:commandDone', { id, result }),
  onCommand: (handler) => on('app:command', (payload) => {
    if (payload && validCommands.has(payload.command)) handler(payload);
  }),
  onLoadDocument: (handler) => on('document:load', handler),
  onSaveAndClose: (handler) => on('app:saveAndClose', handler)
});
