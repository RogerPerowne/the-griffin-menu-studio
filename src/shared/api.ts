// The typed surface the preload bridge exposes to the renderer as `window.griffin`.
// Renderer never touches Node or ipcRenderer directly.

export interface ExportPdfPayload {
  paper: 'A4' | 'A5';
  defaultName?: string;
}

export interface ExportPngPayload {
  rect?: { x: number; y: number; width: number; height: number };
  defaultName?: string;
}

export interface SaveResult {
  canceled: boolean;
  filePath?: string;
}

export interface OpenResult {
  canceled?: boolean;
  filePath?: string;
  state?: unknown;
}

export interface GriffinApi {
  readonly isDesktop: true;
  readonly platform: string;
  exportPdf(payload: ExportPdfPayload): Promise<SaveResult>;
  exportPng(payload: ExportPngPayload): Promise<SaveResult>;
  print(): Promise<{ ok: boolean; reason?: string }>;
  saveDocument(state: unknown): Promise<SaveResult>;
  saveDocumentAs(state: unknown): Promise<SaveResult>;
  openDocument(): Promise<OpenResult>;
  newDocument(): Promise<{ ok: boolean }>;
}
