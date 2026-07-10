// Dietary-tag formatting helpers. Ported from the mockup's `tagsStr` and
// `usedCodes` (reference/griffin-menu-studio.html). Pure and DOM-free — no
// global `state`, everything needed is passed in explicitly.

import type { Dish, DietKey, Menu, RuleItem, SectionItem, Tag } from '../types';

function isRuleItem(item: SectionItem): item is RuleItem {
  return (item as RuleItem).type === 'rule';
}

function isDish(item: SectionItem): item is Dish {
  return !isRuleItem(item);
}

/**
 * Renders a dish's tag list the way it appears on the printed menu, e.g.
 * "(v, gf, x on request)". Tags are sorted "on request" (`r === 1`) last,
 * and within each `r` group by their position in `dietKey` — mirrors the
 * mockup's `(a.r-b.r)||(order.indexOf(a.c)-order.indexOf(b.c))` comparator,
 * including its quirk that codes absent from `dietKey` sort first within
 * their group (`indexOf` returns -1).
 */
export function tagsStr(tags: Tag[] | undefined, dietKey: DietKey[]): string {
  if (!tags || !tags.length) return '';
  const order = dietKey.map((k) => k.c);
  const sorted = [...tags].sort((a, b) => a.r - b.r || order.indexOf(a.c) - order.indexOf(b.c));
  return '(' + sorted.map((t) => (t.r ? `${t.c} on request` : t.c)).join(', ') + ')';
}

/**
 * The subset of `dietKey` whose codes appear on at least one visible
 * (non-hidden) dish anywhere on the menu. Drives the printed dietary key
 * line (`.m-key`). Mirrors the mockup's `usedCodes`.
 */
export function usedCodes(menu: Menu, dietKey: DietKey[]): DietKey[] {
  const used = new Set<string>();
  for (const section of menu.sections) {
    for (const item of section.items) {
      if (!isDish(item) || item.hidden) continue;
      for (const tag of item.tags ?? []) used.add(tag.c);
    }
  }
  return dietKey.filter((k) => used.has(k.c));
}
