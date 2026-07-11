import { contextBridge, ipcRenderer } from 'electron';
import type { GriffinApi } from '../shared/api';

const isSplashPage = window.location.pathname.endsWith('/splash.html') || window.location.pathname.endsWith('splash.html');

// Typed bridge. Renderer never touches Node or ipcRenderer directly.
const api: GriffinApi = {
  isDesktop: true,
  platform: process.platform,
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  exportPng: (payload) => ipcRenderer.invoke('export:png', payload),
  print: (payload) => ipcRenderer.invoke('export:print', payload),
  saveDocument: (state, storage) => ipcRenderer.invoke('document:save', state, storage),
  saveDocumentAs: (state, storage) => ipcRenderer.invoke('document:saveAs', state, storage),
  saveDocumentCopy: (state, storage) => ipcRenderer.invoke('document:saveCopy', state, storage),
  overwriteDocument: (state, storage) => ipcRenderer.invoke('document:overwrite', state, storage),
  openDocument: () => ipcRenderer.invoke('document:open'),
  consumeLaunchDocument: () => ipcRenderer.invoke('document:consumeLaunch'),
  reloadDocument: () => ipcRenderer.invoke('document:reload'),
  newDocument: () => ipcRenderer.invoke('document:new'),
  onCloseRequest: (handler) => {
    const listener = () => handler();
    ipcRenderer.on('window:closeRequest', listener);
    return () => ipcRenderer.removeListener('window:closeRequest', listener);
  },
  onLaunchDocument: (handler) => {
    const listener = () => handler();
    ipcRenderer.on('document:launched', listener);
    return () => ipcRenderer.removeListener('document:launched', listener);
  },
  confirmClose: () => ipcRenderer.invoke('window:confirmClose'),
  newWindow: () => ipcRenderer.invoke('app:newWindow'),
  listTemplates: (storage) => ipcRenderer.invoke('template:list', storage),
  saveTemplate: (template, storage) => ipcRenderer.invoke('template:save', template, storage),
  importTemplates: (storage) => ipcRenderer.invoke('template:import', storage),
  revealTemplatesFolder: (storage) => ipcRenderer.invoke('template:revealFolder', storage),
  chooseFolder: (defaultPath) => ipcRenderer.invoke('app:chooseFolder', defaultPath),
  recoveryStatus: (storage) => ipcRenderer.invoke('recovery:status', storage),
  writeRecovery: (state, storage) => ipcRenderer.invoke('recovery:write', state, storage),
  listRecovery: (storage) => ipcRenderer.invoke('recovery:list', storage),
  readRecovery: (id, storage) => ipcRenderer.invoke('recovery:read', id, storage),
  discardRecovery: (id, storage) => ipcRenderer.invoke('recovery:discard', id, storage),
  markRecoverySessionClean: () => ipcRenderer.invoke('recovery:markCleanExit'),
  startupStatus: (label) => {
    if (typeof label === 'string' && label.length <= 80) ipcRenderer.send('app:startupStatus', label);
  },
  rendererReady: () => ipcRenderer.send('app:rendererReady'),
};

if (!isSplashPage) contextBridge.exposeInMainWorld('griffin', api);

if (isSplashPage) {
  contextBridge.exposeInMainWorld('griffinSplash', {
    onStatus(handler: (label: string) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, label: unknown) => {
        if (typeof label === 'string') handler(label);
      };
      ipcRenderer.on('splash:status', listener);
      return () => ipcRenderer.removeListener('splash:status', listener);
    },
    onHide(handler: () => void): () => void {
      const listener = () => handler();
      ipcRenderer.on('splash:hide', listener);
      return () => ipcRenderer.removeListener('splash:hide', listener);
    },
  });
}
