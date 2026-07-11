import { BrowserWindow, dialog, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExportPdfPayload, ExportPngPayload, PrintDocumentPayload, PrintResult, SaveResult } from '../shared/api';
import { atomicWriteFile } from './file-storage';
import { exportsDir } from './app-paths';

/** Default a PDF/PNG export into Documents/Griffin Menu Studio/Exports. */
async function exportDefaultPath(name: string): Promise<string> {
  const dir = exportsDir();
  await fs.mkdir(dir, { recursive: true }).catch(() => undefined);
  return path.join(dir, name);
}

function normalisePrintPayload(value: unknown): PrintDocumentPayload {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const copiesValue = Number(raw.copies);
  const copies = Number.isInteger(copiesValue) ? Math.min(99, Math.max(1, copiesValue)) : 1;
  const paper = raw.paper === 'A5' ? 'A5' : 'A4';
  return { copies, paper, landscape: false };
}

export async function exportPdf(win: BrowserWindow, payload: ExportPdfPayload): Promise<SaveResult> {
  const res = await dialog.showSaveDialog(win, {
    title: 'Export PDF',
    defaultPath: await exportDefaultPath(payload?.defaultName || 'Griffin Menu.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  try {
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margins: { marginType: 'none' },
      pageSize: payload?.paper === 'A5' ? { width: 148000, height: 210000 } : { width: 210000, height: 297000 },
    });
    await atomicWriteFile(res.filePath, pdf);
    shell.showItemInFolder(res.filePath);
    return { canceled: false, filePath: res.filePath };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : 'The PDF could not be exported.' };
  }
}

export async function exportPng(win: BrowserWindow, payload: ExportPngPayload): Promise<SaveResult> {
  const res = await dialog.showSaveDialog(win, {
    title: 'Export PNG',
    defaultPath: await exportDefaultPath(payload?.defaultName || 'Griffin Menu.png'),
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const r = payload?.rect;
  if (!r || ![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0) {
    throw new Error('PNG export requires valid production-page bounds.');
  }
  const rect = {
    x: Math.max(0, Math.floor(r.x)),
    y: Math.max(0, Math.floor(r.y)),
    width: Math.max(1, Math.ceil(r.width)),
    height: Math.max(1, Math.ceil(r.height)),
  };
  try {
    const image = await win.webContents.capturePage(rect);
    await atomicWriteFile(res.filePath, image.toPNG());
    shell.showItemInFolder(res.filePath);
    return { canceled: false, filePath: res.filePath };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : 'The PNG could not be exported.' };
  }
}

export function printDocument(win: BrowserWindow, value: unknown): Promise<PrintResult> {
  const payload = normalisePrintPayload(value);
  return new Promise((resolve) => {
    win.webContents.print(
      {
        printBackground: true,
        silent: false,
        copies: payload.copies,
        pageSize: payload.paper,
        landscape: false,
        scaleFactor: 100,
        margins: { marginType: 'none' },
        header: '',
        footer: '',
      },
      (ok, reason) => resolve({ ok, reason }),
    );
  });
}
