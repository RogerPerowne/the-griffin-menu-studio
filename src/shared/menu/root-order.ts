// Shared ordering for root-level items (subtitles + divider lines).
//
// rootNotes and rootRules are two separate arrays, but within a position group
// (top / after-a-section / bottom) they interleave freely, ordered by an
// explicit `order` field. Legacy items have no `order` (→ 0) and fall back to
// the historical "notes before rules" sequence via a stable tiebreak, so old
// menus render exactly as before. Both the menu renderer (render.ts) and the
// Edit-Menu column (views/editor.ts) sort through here so they never disagree.

import type { Menu, Rule, RootNote } from '../types';

export type RootEntry =
  | { kind: 'note'; id: string; item: RootNote }
  | { kind: 'rule'; id: string; item: Rule };

type RootItem = Rule | RootNote;

function collect(m: Menu, pred: (it: RootItem) => boolean): RootEntry[] {
  const notes: RootEntry[] = (m.rootNotes ?? [])
    .filter(pred)
    .map((item) => ({ kind: 'note', id: item.id, item }));
  const rules: RootEntry[] = (m.rootRules ?? [])
    .filter(pred)
    .map((item) => ({ kind: 'rule', id: item.id, item }));
  // Concat notes-first (historical order) then stable-sort by `order`; the
  // index tiebreak makes the sort deterministic regardless of engine stability.
  return [...notes, ...rules]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.item.order ?? 0) - (b.e.item.order ?? 0) || a.i - b.i)
    .map((x) => x.e);
}

export const isTopRoot = (it: RootItem): boolean => it.position === 'top';

/** Root items pinned to the very top of the menu, in display order. */
export const rootTop = (m: Menu): RootEntry[] => collect(m, isTopRoot);

/** Root items that follow a given section, in display order. */
export const rootAfter = (m: Menu, sid: string): RootEntry[] =>
  collect(m, (it) => it.afterSectionId === sid && it.position !== 'top');

/** Root items at the bottom of the menu (no section anchor), in display order. */
export const rootBottom = (m: Menu): RootEntry[] =>
  collect(m, (it) => !it.afterSectionId && it.position !== 'top');

/** The `order` value to append a new item to the end of a group. */
export function appendOrder(entries: RootEntry[]): number {
  return entries.reduce((mx, e) => Math.max(mx, e.item.order ?? 0), 0) + 1;
}
