import type { Menu, Section } from '@shared/types';
import { newRootNote, uid } from './factories';

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

/**
 * Re-home any root rule whose `afterSectionId` no longer matches a section
 * (e.g. its owning section was deleted) so it doesn't silently vanish from
 * the render loop (`render.ts:289-308` never matches a set-but-unresolvable
 * `afterSectionId`).
 *
 * `priorSectionIds` — the section id order *before* the mutation that
 * orphaned the rule (e.g. captured just before a section is filtered out) —
 * lets us tell whether the orphaned rule sat after the first section, the
 * last section, or a surviving one in between. Callers with no such history
 * (e.g. the generic normalise pass) can omit it; orphans are then promoted
 * to the bottom, the same safe default as the "sections is empty" case.
 */
export function normaliseRootRules(m: Menu, priorSectionIds?: string[]): Menu {
  const rules = (m.rootRules = m.rootRules || []);
  const currentIds = (m.sections || []).map((s) => s.id);
  const currentSet = new Set(currentIds);
  const order = priorSectionIds ?? currentIds;

  rules.forEach((r) => {
    if (!r.afterSectionId || currentSet.has(r.afterSectionId)) return;
    if (currentIds.length === 0) {
      r.position = 'bottom';
      r.afterSectionId = null;
      return;
    }
    const idx = order.indexOf(r.afterSectionId);
    if (idx === -1 || idx === order.length - 1) {
      r.position = 'bottom';
      r.afterSectionId = null;
      return;
    }
    if (idx === 0) {
      r.position = 'top';
      r.afterSectionId = null;
      return;
    }
    // Reattach to the nearest still-surviving neighbour, scanning outward
    // from the deleted section's old position (preferring the earlier side).
    for (let d = 1; d < order.length; d++) {
      const before = order[idx - d];
      if (before && currentSet.has(before)) {
        r.position = 'between';
        r.afterSectionId = before;
        return;
      }
      const after = order[idx + d];
      if (after && currentSet.has(after)) {
        r.position = 'between';
        r.afterSectionId = after;
        return;
      }
    }
    r.position = 'bottom';
    r.afterSectionId = null;
  });

  return m;
}

/** Migrate a legacy single headerNote into a positioned top note (idempotent:
 *  clearing headerNote afterwards means it never runs twice). */
export function migrateHeaderNote(m: Menu): Menu {
  if (!m.rootNotes) m.rootNotes = [];
  if (m.headerNote && m.headerNote.trim()) {
    m.rootNotes.unshift(newRootNote(m.headerNote, 'top', null));
    m.headerNote = '';
  }
  return m;
}

export function normaliseMenuColumns(m: Menu): Menu {
  migrateHeaderNote(m);
  ensureRootRules(m);
  (m.sections || []).forEach(normaliseSectionColumns);
  normaliseRootRules(m);
  return m;
}
