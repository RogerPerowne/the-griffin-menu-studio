// Edit-target seam — the single indirection that lets the full menu editor
// (views/editor.ts) write to something OTHER than the store's `currentMenu`
// without the editor knowing about it.
//
// The editor reads/writes exactly three store primitives — `currentMenu()`,
// `commit(scopes)`, `snapshot()` (plus `persist()`) — through this module
// instead of importing them from the store directly. The DEFAULT target is the
// store itself, so normal (non-booklet) menu editing is byte-identical: every
// call forwards straight to the store functions.
//
// Booklet mode installs a bespoke target (see views/booklet-editor.ts) that
// points `menu()` at the active inside Menu and routes commit/snapshot/persist
// through the booklet session (mark dirty, re-render the booklet preview, push
// undo on the booklet). Leaving booklet mode resets the target to the store.

import type { Menu } from '@shared/types';
import type { Scope } from './store';
import { commit as storeCommit, currentMenu as storeCurrentMenu, persist as storePersist, snapshot as storeSnapshot } from './store';

export interface EditTarget {
  /** The menu the editor is currently bound to. */
  menu(): Menu;
  /** Persist + re-render the given scopes (defaults mirror the store's). */
  commit(scopes?: Scope[]): void;
  /** Push an undo checkpoint before a mutation. */
  snapshot(): void;
  /** Persist without re-rendering (blur/change fallback). */
  persist(): void;
}

/** The default target: the menu store. Keeps normal menu editing unchanged. */
const storeTarget: EditTarget = {
  menu: () => storeCurrentMenu(),
  commit: (scopes?: Scope[]) => storeCommit(scopes),
  snapshot: () => storeSnapshot(),
  persist: () => storePersist(),
};

let active: EditTarget = storeTarget;

export function getEditTarget(): EditTarget {
  return active;
}

export function setEditTarget(target: EditTarget): void {
  active = target;
}

/** Return editing to the store default (call when leaving booklet mode). */
export function resetEditTarget(): void {
  active = storeTarget;
}
