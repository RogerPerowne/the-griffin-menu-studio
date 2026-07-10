import { dialog, ipcMain, BrowserWindow, type WebContents } from 'electron';
import * as docs from './documents';
import * as exp from './export-handlers';
import * as recovery from './recovery';
import * as templates from './templates';
import { assertValidTemplate } from '../shared/template-format';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function filename(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 180 ? value : undefined;
}

function exportPdfPayload(value: unknown): { paper: 'A4' | 'A5'; defaultName?: string } {
  const input = record(value);
  if (!input || (input.paper !== 'A4' && input.paper !== 'A5')) throw new Error('Invalid PDF export request.');
  return { paper: input.paper, defaultName: filename(input.defaultName) };
}

function exportPngPayload(value: unknown): { rect: { x: number; y: number; width: number; height: number }; defaultName?: string } {
  const input = record(value);
  const rect = input && record(input.rect);
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every((item) => typeof item === 'number' && Number.isFinite(item)) || Number(rect.width) <= 0 || Number(rect.height) <= 0) {
    throw new Error('Invalid PNG export request.');
  }
  return {
    rect: { x: Number(rect.x), y: Number(rect.y), width: Number(rect.width), height: Number(rect.height) },
    defaultName: filename(input?.defaultName),
  };
}

function printPayload(value: unknown): { copies: number; paper: 'A4' | 'A5'; landscape: false } {
  const input = record(value);
  if (!input || !Number.isInteger(input.copies) || Number(input.copies) < 1 || Number(input.copies) > 99 || (input.paper !== 'A4' && input.paper !== 'A5') || input.landscape !== false) {
    throw new Error('Invalid print request.');
  }
  return { copies: Number(input.copies), paper: input.paper, landscape: false };
}

function recoveryId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/i.test(value)) throw new Error('Invalid recovery snapshot request.');
  return value;
}

/** Register all IPC handlers. */
export function registerIpc(createWindow: () => BrowserWindow): void {
  const requireWin = (sender?: WebContents): BrowserWindow => {
    const win = sender ? BrowserWindow.fromWebContents(sender) : null;
    if (!win) throw new Error('No active window.');
    return win;
  };

  ipcMain.handle('document:save', (e, state: unknown) => docs.saveDocument(requireWin(e.sender), state));
  ipcMain.handle('document:saveAs', (e, state: unknown) => docs.saveDocumentAs(requireWin(e.sender), state));
  ipcMain.handle('document:saveCopy', (e, state: unknown) => docs.saveDocumentCopy(requireWin(e.sender), state));
  ipcMain.handle('document:overwrite', (e, state: unknown) => docs.overwriteDocument(requireWin(e.sender), state));
  ipcMain.handle('document:open', (e) => docs.openDocument(requireWin(e.sender)));
  ipcMain.handle('document:reload', (e) => docs.reloadDocument(requireWin(e.sender)));
  ipcMain.handle('document:new', (e) => docs.newDocument(requireWin(e.sender)));

  ipcMain.handle('export:pdf', (e, payload) => exp.exportPdf(requireWin(e.sender), exportPdfPayload(payload)));
  ipcMain.handle('export:png', (e, payload) => exp.exportPng(requireWin(e.sender), exportPngPayload(payload)));
  ipcMain.handle('export:print', (e, payload) => exp.printDocument(requireWin(e.sender), printPayload(payload)));
  ipcMain.handle('template:list', (e) => {
    requireWin(e.sender);
    return templates.listUserTemplates();
  });
  ipcMain.handle('template:save', (e, template) => {
    requireWin(e.sender);
    assertValidTemplate(template);
    return templates.saveUserTemplate(template);
  });
  ipcMain.handle('template:import', (e) => templates.importTemplate(requireWin(e.sender)));
  ipcMain.handle('template:revealFolder', (e) => {
    requireWin(e.sender);
    return templates.revealTemplatesFolder();
  });
  ipcMain.handle('app:chooseFolder', async (e, defaultPath) => {
    const res = await dialog.showOpenDialog(requireWin(e.sender), {
      title: 'Choose folder',
      defaultPath: typeof defaultPath === 'string' && defaultPath.length <= 1024 ? defaultPath : undefined,
      properties: ['openDirectory', 'createDirectory'],
    });
    return { canceled: res.canceled, folderPath: res.filePaths[0] };
  });
  ipcMain.handle('app:newWindow', (e) => {
    requireWin(e.sender);
    createWindow();
    return { ok: true };
  });
  ipcMain.handle('recovery:status', (e) => {
    requireWin(e.sender);
    return recovery.getRecoveryStatus();
  });
  ipcMain.handle('recovery:write', (e, state: unknown) => recovery.writeRecovery(requireWin(e.sender), state));
  ipcMain.handle('recovery:list', (e) => {
    requireWin(e.sender);
    return recovery.listRecovery();
  });
  ipcMain.handle('recovery:read', (e, id: unknown) => {
    requireWin(e.sender);
    return recovery.readRecovery(recoveryId(id));
  });
  ipcMain.handle('recovery:discard', (e, id: unknown) => {
    requireWin(e.sender);
    return recovery.discardRecovery(recoveryId(id));
  });
  ipcMain.handle('recovery:markCleanExit', (e) => {
    requireWin(e.sender);
    return recovery.markRecoverySessionClean();
  });
}
