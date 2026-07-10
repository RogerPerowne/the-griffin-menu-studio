import { contextBridge, ipcRenderer } from 'electron';
import type { GriffinApi } from '../shared/api';

// Typed bridge. Renderer never touches Node or ipcRenderer directly.
const api: GriffinApi = {
  isDesktop: true,
  platform: process.platform,
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  exportPng: (payload) => ipcRenderer.invoke('export:png', payload),
  print: () => ipcRenderer.invoke('export:print'),
  saveDocument: (state) => ipcRenderer.invoke('document:save', state),
  saveDocumentAs: (state) => ipcRenderer.invoke('document:saveAs', state),
  openDocument: () => ipcRenderer.invoke('document:open'),
  newDocument: () => ipcRenderer.invoke('document:new'),
};

contextBridge.exposeInMainWorld('griffin', api);
