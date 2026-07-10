import { BrowserWindow, dialog, shell } from 'electron';
import fs from 'node:fs';
import type { ExportPdfPayload, ExportPngPayload, SaveResult } from '../shared/api';

export async function exportPdf(win: BrowserWindow, payload: ExportPdfPayload): Promise<SaveResult> {
  const res = await dialog.showSaveDialog(win, {
    title: 'Export PDF',
    defaultPath: payload?.defaultName || 'Griffin Menu.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    margins: { marginType: 'none' },
    pageSize: payload?.paper === 'A5' ? { width: 148000, height: 210000 } : { width: 210000, height: 297000 },
  });
  fs.writeFileSync(res.filePath, pdf);
  shell.showItemInFolder(res.filePath);
  return { canceled: false, filePath: res.filePath };
}

export async function exportPng(win: BrowserWindow, payload: ExportPngPayload): Promise<SaveResult> {
  const res = await dialog.showSaveDialog(win, {
    title: 'Export PNG',
    defaultPath: payload?.defaultName || 'Griffin Menu.png',
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const r = payload?.rect;
  const rect =
    r && Number.isFinite(r.width) && Number.isFinite(r.height)
      ? {
          x: Math.max(0, Math.floor(r.x || 0)),
          y: Math.max(0, Math.floor(r.y || 0)),
          width: Math.max(1, Math.ceil(r.width)),
          height: Math.max(1, Math.ceil(r.height)),
        }
      : undefined;
  const image = rect ? await win.webContents.capturePage(rect) : await win.webContents.capturePage();
  fs.writeFileSync(res.filePath, image.toPNG());
  shell.showItemInFolder(res.filePath);
  return { canceled: false, filePath: res.filePath };
}

export function printDocument(win: BrowserWindow): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    win.webContents.print({ printBackground: true, silent: false }, (ok, reason) => resolve({ ok, reason }));
  });
}
