const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('griffinSplash', {
  onStatus: (handler) => ipcRenderer.on('splash:status', (_event, payload) => handler(payload)),
  onFade: (handler) => ipcRenderer.on('splash:fade', () => handler())
});
