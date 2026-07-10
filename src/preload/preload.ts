import { contextBridge, ipcRenderer } from 'electron';
import type { GriffinApi } from '../shared/api';

// Typed bridge. Renderer never touches Node or ipcRenderer directly.
const api: GriffinApi = {
  isDesktop: true,
  platform: process.platform,
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  exportPng: (payload) => ipcRenderer.invoke('export:png', payload),
  print: (payload) => ipcRenderer.invoke('export:print', payload),
  saveDocument: (state) => ipcRenderer.invoke('document:save', state),
  saveDocumentAs: (state) => ipcRenderer.invoke('document:saveAs', state),
  saveDocumentCopy: (state) => ipcRenderer.invoke('document:saveCopy', state),
  overwriteDocument: (state) => ipcRenderer.invoke('document:overwrite', state),
  openDocument: () => ipcRenderer.invoke('document:open'),
  consumeLaunchDocument: () => ipcRenderer.invoke('document:consumeLaunch'),
  reloadDocument: () => ipcRenderer.invoke('document:reload'),
  newDocument: () => ipcRenderer.invoke('document:new'),
  newWindow: () => ipcRenderer.invoke('app:newWindow'),
  listTemplates: () => ipcRenderer.invoke('template:list'),
  saveTemplate: (template) => ipcRenderer.invoke('template:save', template),
  importTemplates: () => ipcRenderer.invoke('template:import'),
  revealTemplatesFolder: () => ipcRenderer.invoke('template:revealFolder'),
  chooseFolder: (defaultPath) => ipcRenderer.invoke('app:chooseFolder', defaultPath),
  recoveryStatus: () => ipcRenderer.invoke('recovery:status'),
  writeRecovery: (state) => ipcRenderer.invoke('recovery:write', state),
  listRecovery: () => ipcRenderer.invoke('recovery:list'),
  readRecovery: (id) => ipcRenderer.invoke('recovery:read', id),
  discardRecovery: (id) => ipcRenderer.invoke('recovery:discard', id),
  markRecoverySessionClean: () => ipcRenderer.invoke('recovery:markCleanExit'),
};

contextBridge.exposeInMainWorld('griffin', api);
