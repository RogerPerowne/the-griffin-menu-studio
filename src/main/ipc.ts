import { ipcMain, type BrowserWindow } from 'electron';
import * as docs from './documents';
import * as exp from './export-handlers';

/** Register all IPC handlers. `getWin` returns the current main window (or null). */
export function registerIpc(getWin: () => BrowserWindow | null): void {
  const requireWin = (): BrowserWindow => {
    const win = getWin();
    if (!win) throw new Error('No active window.');
    return win;
  };

  ipcMain.handle('document:save', (_e, state: unknown) => docs.saveDocument(requireWin(), state, false));
  ipcMain.handle('document:saveAs', (_e, state: unknown) => docs.saveDocument(requireWin(), state, true));
  ipcMain.handle('document:open', () => docs.openDocument(requireWin()));
  ipcMain.handle('document:new', () => docs.newDocument());

  ipcMain.handle('export:pdf', (_e, payload) => exp.exportPdf(requireWin(), payload));
  ipcMain.handle('export:png', (_e, payload) => exp.exportPng(requireWin(), payload));
  ipcMain.handle('export:print', () => exp.printDocument(requireWin()));
}
