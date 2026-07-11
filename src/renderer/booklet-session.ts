// Renderer-side "current booklet" session — the booklet analogue of store.ts's
// menu state, deliberately kept as a small self-contained module (the store's
// AppState holds the menu library; a booklet is a separate document kind, so it
// lives here rather than being wedged into AppState). Holds ONE editable
// booklet, the currently-previewed sheet side (the "flip"), the on-disk path (so
// Save can write silently), a dirty flag and a compact undo/redo history.
//
// Views subscribe with `onBookletChange`; every mutation helper calls `emit()`
// after committing so the booklet editor + its landscape preview re-render.

import type { Booklet } from '@shared/types';
import type { SheetSide } from '@shared/menu/booklet';

let booklet: Booklet | null = null;
let side: SheetSide = 'outer';
let filePath: string | null = null;
let dirty = false;

type Listener = () => void;
const listeners = new Set<Listener>();

const HISTORY_CAP = 60;
const undoStack: string[] = [];
const redoStack: string[] = [];

/** True while a booklet is open for editing (the app is in "booklet mode"). */
export function isBookletMode(): boolean {
  return booklet !== null;
}

export function getBooklet(): Booklet | null {
  return booklet;
}

/** The open booklet, or throw — for call sites that only run in booklet mode. */
export function requireBooklet(): Booklet {
  if (!booklet) throw new Error('No booklet is open.');
  return booklet;
}

export function getSide(): SheetSide {
  return side;
}

export function setSide(next: SheetSide): void {
  side = next;
  emit();
}

/** Toggle the previewed sheet side (outer ⇄ inner) — the preview "flip". */
export function flipSide(): void {
  setSide(side === 'outer' ? 'inner' : 'outer');
}

export function getBookletFilePath(): string | null {
  return filePath;
}

export function setBookletFilePath(path: string | null): void {
  filePath = path;
}

export function isBookletDirty(): boolean {
  return dirty;
}

export function markBookletSaved(): void {
  dirty = false;
  emit();
}

/** Mark dirty WITHOUT re-rendering — for live typing, where a full re-render
 *  would blow away the focused input (the debounced preview refresh handles the
 *  visible update instead). */
export function setDirty(): void {
  dirty = true;
}

export function onBookletChange(fn: Listener): void {
  listeners.add(fn);
}

/** Re-render every subscribed booklet view. */
export function emit(): void {
  listeners.forEach((fn) => fn());
}

/** Open a booklet for editing, resetting flip/history and the on-disk path. */
export function openBooklet(next: Booklet, path: string | null = null): void {
  booklet = next;
  side = 'outer';
  filePath = path;
  dirty = false;
  undoStack.length = 0;
  redoStack.length = 0;
  emit();
}

/** Close the open booklet and clear its session (leaving booklet mode). */
export function closeBooklet(): void {
  booklet = null;
  filePath = null;
  dirty = false;
  undoStack.length = 0;
  redoStack.length = 0;
}

/** Push the current booklet onto the undo stack before a mutation. Clears redo. */
export function snapshotBooklet(): void {
  if (!booklet) return;
  undoStack.push(JSON.stringify(booklet));
  if (undoStack.length > HISTORY_CAP) undoStack.shift();
  redoStack.length = 0;
}

/** Mark dirty and re-render (call after mutating the booklet in place). */
export function commitBooklet(): void {
  dirty = true;
  emit();
}

export function canUndoBooklet(): boolean {
  return undoStack.length > 0;
}

export function canRedoBooklet(): boolean {
  return redoStack.length > 0;
}

export function undoBooklet(): void {
  if (!booklet || !undoStack.length) return;
  redoStack.push(JSON.stringify(booklet));
  booklet = JSON.parse(undoStack.pop() as string) as Booklet;
  dirty = true;
  emit();
}

export function redoBooklet(): void {
  if (!booklet || !redoStack.length) return;
  undoStack.push(JSON.stringify(booklet));
  booklet = JSON.parse(redoStack.pop() as string) as Booklet;
  dirty = true;
  emit();
}
