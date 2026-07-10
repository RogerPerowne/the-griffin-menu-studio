import { contextBridge } from 'electron';
import type { GriffinApi } from '../shared/api';

// Minimal, typed bridge. IPC methods are added here as later phases need them
// (save/open, export, print, recent, publish, window). Renderer never touches
// Node or ipcRenderer directly.
const api: GriffinApi = {
  isDesktop: true,
  platform: process.platform,
};

contextBridge.exposeInMainWorld('griffin', api);
