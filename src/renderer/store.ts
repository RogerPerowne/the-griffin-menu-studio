import type { AppState, Dish, Menu, Section } from '@shared/types';
import { normaliseMenuColumns } from '@shared/menu/normalize';

// Renderer state store: holds the AppState, persists to localStorage, keeps an
// undo/redo history, and notifies subscribed views by scope. Views built as
// separate modules import this small API rather than reaching into globals.

const LSKEY = 'griffinMenuStudio.v2';
const HISTORY_CAP = 80;

export type Scope = 'rail' | 'editor' | 'preview' | 'all';

type Handler = () => void;
const listeners: Record<Scope, Set<Handler>> = {
  rail: new Set(),
  editor: new Set(),
  preview: new Set(),
  all: new Set(),
};

let state: AppState;
const undoStack: string[] = [];
const redoStack: string[] = [];

export function getState(): AppState {
  return state;
}

export function setState(next: AppState): void {
  state = next;
}

export function on(scope: Scope, fn: Handler): void {
  listeners[scope].add(fn);
}

function emit(scopes: Scope[]): void {
  const set = new Set<Scope>(scopes);
  if (set.has('all')) (['rail', 'editor', 'preview'] as Scope[]).forEach((s) => set.add(s));
  set.forEach((scope) => listeners[scope].forEach((fn) => fn()));
}

export function currentMenu(): Menu {
  return state.menus.find((m) => m.id === state.currentMenuId) || state.menus[0];
}

export function findDish(menu: Menu, id: string): { section: Section; dish: Dish } | null {
  for (const section of menu.sections) {
    const dish = (section.items as Dish[]).find((i) => i.id === id);
    if (dish) return { section, dish };
  }
  return null;
}

export function persist(): void {
  try {
    localStorage.setItem(LSKEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable; the desktop autosave is the durable path */
  }
}

/** Push the current state onto the undo stack before a mutation. Clears redo. */
export function snapshot(): void {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > HISTORY_CAP) undoStack.shift();
  redoStack.length = 0;
}

export function undo(): void {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(state));
  state = JSON.parse(undoStack.pop() as string);
  persist();
  emit(['all']);
}

export function redo(): void {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = JSON.parse(redoStack.pop() as string);
  persist();
  emit(['all']);
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function clearHistory(): void {
  undoStack.length = 0;
  redoStack.length = 0;
}

/** Persist and re-render the given scopes (defaults to preview + rail). */
export function commit(scopes: Scope[] = ['preview', 'rail']): void {
  persist();
  emit(scopes);
}

/** Load from localStorage, or seed a fresh library. Normalises the open menu. */
export function loadFromStorage(seed: () => AppState): void {
  try {
    const raw = localStorage.getItem(LSKEY);
    if (raw) {
      state = JSON.parse(raw) as AppState;
      if (!state.currentMenuId || !state.menus.find((m) => m.id === state.currentMenuId)) {
        state.currentMenuId = state.menus[0]?.id ?? null;
      }
      const open = currentMenu();
      if (open) normaliseMenuColumns(open);
      return;
    }
  } catch {
    /* fall through to seed */
  }
  state = seed();
}

/** Replace the whole library (e.g. after opening a .griffinmenu document). */
export function replaceState(next: AppState): void {
  state = next;
  if (!state.currentMenuId || !state.menus.find((m) => m.id === state.currentMenuId)) {
    state.currentMenuId = state.menus[0]?.id ?? null;
  }
  const open = currentMenu();
  if (open) normaliseMenuColumns(open);
  clearHistory();
  persist();
  emit(['all']);
}

export function emitAll(): void {
  emit(['all']);
}
