// The typed surface the preload bridge exposes to the renderer as `window.griffin`.
// Renderer never touches Node or ipcRenderer directly.

export interface ExportPdfPayload {
  paper: 'A4' | 'A5';
  /** Landscape sheet (e.g. a folded-booklet A4 sheet, 297×210mm). Defaults to portrait. */
  landscape?: boolean;
  defaultName?: string;
}

export interface ExportPngPayload {
  /** Bounds of the canonical 150-DPI white production page, in renderer DIPs. */
  rect: { x: number; y: number; width: number; height: number };
  defaultName?: string;
}

export interface PrintDocumentPayload {
  copies: number;
  paper: 'A4' | 'A5';
  landscape: boolean;
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

/** Options the renderer passes when saving the open booklet (System 5). */
export interface SaveBookletOptions {
  /** Force a "Save As…" dialog even when a path is already known. */
  saveAs?: boolean;
  /** The booklet's current on-disk path (lets a plain Save write silently). */
  filePath?: string;
  storage?: StorageLocations;
}

/** Result of opening a `.booklet` document. */
export interface OpenBookletResult {
  canceled: boolean;
  filePath?: string;
  /** The parsed `Booklet` (typed loosely across the IPC boundary). */
  booklet?: unknown;
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

export interface RecoverySummary {
  id: string;
  createdAt: string;
  documentPath?: string;
  documentName: string;
}

export interface RecoverySnapshotResult extends RecoverySummary {
  state: unknown;
}

export interface RecoveryStatus {
  previousSessionCrashed: boolean;
  snapshots: RecoverySummary[];
}

export interface RecoveryListResult {
  snapshots: RecoverySummary[];
  error?: string;
}

export interface RecoveryReadResult {
  found: boolean;
  snapshot?: RecoverySnapshotResult;
  error?: string;
}

export interface RecoveryWriteResult {
  ok: boolean;
  snapshot?: RecoverySummary;
  error?: string;
}

export type UpdatePhase =
  | 'idle' // not checked yet this session
  | 'checking' // a check is in progress
  | 'downloading' // a newer version was found and is downloading
  | 'downloaded' // a newer version is downloaded and ready to install
  | 'upToDate' // no newer version available
  | 'error' // the check or download failed
  | 'unsupported'; // dev build / not packaged — updates unavailable

export type UpdateErrorCode = 'offline' | 'notFound' | 'rateLimited' | 'feedError' | 'unknown';

export interface UpdateInfo {
  phase: UpdatePhase;
  currentVersion: string;
  newVersion?: string;
  title?: string; // release name / headline
  notes?: string; // release description + change log ("what's in the update")
  url?: string; // GitHub release page
  publishedAt?: string;
  errorCode?: UpdateErrorCode;
  errorMessage?: string;
  cancelled?: boolean; // user cancelled this update this session
  deferred?: boolean; // user chose "Later"
}

export interface GriffinApi {
  readonly isDesktop: true;
  readonly platform: string;
  exportPdf(payload: ExportPdfPayload): Promise<SaveResult>;
  exportPng(payload: ExportPngPayload): Promise<SaveResult>;
  print(payload: PrintDocumentPayload): Promise<PrintResult>;
  saveDocument(state: unknown, storage?: StorageLocations): Promise<SaveResult>;
  saveDocumentAs(state: unknown, storage?: StorageLocations): Promise<SaveResult>;
  saveDocumentCopy(state: unknown, storage?: StorageLocations): Promise<SaveResult>;
  overwriteDocument(state: unknown, storage?: StorageLocations): Promise<SaveResult>;
  openDocument(): Promise<OpenResult>;
  /** Save the open booklet (System 5). Prompts on first save or when `saveAs`. */
  saveBooklet(booklet: unknown, options?: SaveBookletOptions): Promise<SaveResult>;
  /** Open a `.booklet` document from disk. */
  openBooklet(): Promise<OpenBookletResult>;
  consumeLaunchDocument(): Promise<OpenResult>;
  reloadDocument(): Promise<OpenResult>;
  newDocument(): Promise<{ ok: boolean }>;
  onCloseRequest(handler: () => void): () => void;
  /** A second app launch handed this window a .menu to open (pull via consumeLaunchDocument). */
  onLaunchDocument(handler: () => void): () => void;
  /** OneDrive or another app synced a newer version of the open file onto disk. */
  onExternalChange(handler: (conflict: DocumentConflict) => void): () => void;
  /** Subscribe to update state changes (checking/downloading/downloaded/error/…). */
  onUpdateState(handler: (info: UpdateInfo) => void): () => void;
  /** Current update state (for rendering the Settings Updates card on demand). */
  getUpdateInfo(): Promise<UpdateInfo>;
  /** Manually check for updates now; resolves with the resulting state. */
  checkForUpdates(): Promise<UpdateInfo>;
  /** "Update Now" — apply the downloaded update and relaunch. */
  installUpdate(): Promise<{ ok: boolean }>;
  /** "Later" — dismiss the prompt; the update applies when the app next starts. */
  deferUpdate(): Promise<{ ok: boolean }>;
  /** "Cancel" — skip this update's prompt for the rest of the session. */
  cancelUpdate(): Promise<{ ok: boolean }>;
  /** Open the Documents/Griffin Menu Studio library folder in the file explorer. */
  revealLibraryFolder(): Promise<{ ok: boolean; folderPath: string }>;
  /** Resolve the actual folders currently in use (for display in Settings). */
  getPaths(storage?: StorageLocations): Promise<{ library: string; menus: string; templates: string; exports: string; recovery: string }>;
  confirmClose(): Promise<{ ok: boolean }>;
  newWindow(): Promise<{ ok: boolean }>;
  listTemplates(storage?: StorageLocations): Promise<TemplateListResult>;
  saveTemplate(template: Template, storage?: StorageLocations): Promise<SaveResult>;
  importTemplates(storage?: StorageLocations): Promise<TemplateListResult>;
  revealTemplatesFolder(storage?: StorageLocations): Promise<{ ok: boolean; folderPath: string }>;
  chooseFolder(defaultPath?: string): Promise<FolderResult>;
  recoveryStatus(storage?: StorageLocations): Promise<RecoveryStatus>;
  writeRecovery(state: unknown, storage?: StorageLocations): Promise<RecoveryWriteResult>;
  listRecovery(storage?: StorageLocations): Promise<RecoveryListResult>;
  readRecovery(id: string, storage?: StorageLocations): Promise<RecoveryReadResult>;
  discardRecovery(id: string, storage?: StorageLocations): Promise<{ ok: boolean }>;
  markRecoverySessionClean(): Promise<{ ok: boolean }>;
  startupStatus(label: string): void;
  rendererReady(): void;
}
import type { StorageLocations, Template } from './types';
