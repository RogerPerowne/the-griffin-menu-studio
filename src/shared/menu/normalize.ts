import type { Menu, Section } from '@shared/types';
import { uid } from './factories';

// Ported from the mockup's normaliseSectionColumns / ensureRootRules / normaliseMenuColumns.
// In the current model dishes live in section.items and divider rules live in menu.rootRules;
// ensureRootRules also migrates any legacy in-section rule items out to the root.

type LegacyItem = { id?: string; rule?: boolean; col?: number } & Record<string, unknown>;

export function normaliseSectionColumns(s: Section): Section {
  const cols = Math.max(1, Math.min(4, Number(s.cols) || 1));
  s.cols = cols;
  s.descMode = s.descMode === 'below' ? 'below' : 'inline';
  const items = s.items as unknown as LegacyItem[];
  if (cols === 1) {
    s.columnNames = [];
    items.forEach((it) => {
      delete it.col;
    });
    return s;
  }
  s.columnNames = Array.from({ length: cols }, (_v, i) => s.columnNames?.[i] ?? '');
  const needsSpread = items.some((it) => it.col == null || it.col < 0 || it.col >= cols);
  if (needsSpread) {
    const dishes = items.filter((it) => !it.rule);
    const per = Math.ceil(Math.max(1, dishes.length) / cols);
    let di = 0;
    items.forEach((it) => {
      if (it.rule) {
        it.col = Math.min(cols - 1, Math.floor(di / Math.max(1, per)));
      } else {
        it.col = Math.min(cols - 1, Math.floor(di / Math.max(1, per)));
        di++;
      }
    });
  }
  items.forEach((it) => {
    it.col = Math.max(0, Math.min(cols - 1, Number(it.col) || 0));
  });
  return s;
}

export function ensureRootRules(m: Menu): Menu {
  m.rootRules = m.rootRules || [];
  (m.sections || []).forEach((s) => {
    const items = s.items as unknown as LegacyItem[];
    const legacy = items.filter((it) => it.rule);
    if (legacy.length) {
      legacy.forEach((it) => {
        delete it.col;
        m.rootRules.push({ id: it.id || uid(), rule: true, afterSectionId: s.id, position: 'between' });
      });
      s.items = items.filter((it) => !it.rule) as unknown as Section['items'];
    }
  });
  return m;
}

export function normaliseMenuColumns(m: Menu): Menu {
  ensureRootRules(m);
  (m.sections || []).forEach(normaliseSectionColumns);
  return m;
}
