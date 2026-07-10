// The typed surface the preload bridge exposes to the renderer as `window.griffin`.
// Renderer never touches Node or ipcRenderer directly.

export interface ExportPdfPayload {
  paper: 'A4' | 'A5';
  defaultName?: string;
}

export interface ExportPngPayload {
  /** Bounds of the already-rendered white production page, in renderer DIPs. */
  rect: { x: number; y: number; width: number; height: number };
  defaultName?: string;
}

export interface PrintDocumentPayload {
  copies: number;
  paper: 'A4' | 'A5';
  landscape: false;
}

export interface PrintResult {
  ok: boolean;
  reason?: string;
}

export interface SaveResult {
  canceled: boolean;
  filePath?: string;
  error?: string;
  conflict?: DocumentConflict;
}

export interface OpenResult {
  canceled: boolean;
  filePath?: string;
  state?: unknown;
  error?: string;
}

export interface DocumentConflict {
  kind: 'modified' | 'missing' | 'unreadable';
  filePath: string;
  /** Valid only for `modified`; use this value for the Reload action. */
  diskState?: unknown;
  message: string;
}

export interface TemplateListResult {
  templates: Template[];
  folderPath: string;
  errors?: string[];
}

export interface FolderResult {
  canceled: boolean;
  folderPath?: string;
}

export interface GriffinApi {
  readonly isDesktop: true;
  readonly platform: string;
  exportPdf(payload: ExportPdfPayload): Promise<SaveResult>;
  exportPng(payload: ExportPngPayload): Promise<SaveResult>;
  print(payload: PrintDocumentPayload): Promise<PrintResult>;
  saveDocument(state: unknown): Promise<SaveResult>;
  saveDocumentAs(state: unknown): Promise<SaveResult>;
  saveDocumentCopy(state: unknown): Promise<SaveResult>;
  overwriteDocument(state: unknown): Promise<SaveResult>;
  openDocument(): Promise<OpenResult>;
  reloadDocument(): Promise<OpenResult>;
  newDocument(): Promise<{ ok: boolean }>;
  newWindow(): Promise<{ ok: boolean }>;
  listTemplates(): Promise<TemplateListResult>;
  saveTemplate(template: Template): Promise<SaveResult>;
  importTemplates(): Promise<TemplateListResult>;
  revealTemplatesFolder(): Promise<{ ok: boolean; folderPath: string }>;
  chooseFolder(defaultPath?: string): Promise<FolderResult>;
}
import type { Template } from './types';
