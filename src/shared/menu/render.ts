// Menu page renderer. Ported from the mockup's `menuHTML` / `itemHTML` /
// `ruleHTML` / `B()` / `E()` (reference/griffin-menu-studio.html,
// `function menuHTML`). Produces the exact `.page` markup used for both the
// live preview and the print/export DOM — same element structure and
// classes as the mockup, so `menu.css` (ported alongside this file) styles
// it identically.
//
// Purity: this module reads only `menu` and `opts`. It never touches a
// global `state`, never mutates its `menu` argument, and never imports
// anything renderer-only (no Vite asset URLs, no DOM globals besides the
// string templates below). Image URLs come in via `opts.assets` — the
// mockup's version had a real bug here (an undefined global `LOCKUP`); that
// bug is fixed by construction because there is no global to reach for.
//
// ============================================================================
// EDIT-MODE HOOK CONTRACT (opts.edit === true)
// ============================================================================
// This is the contract a caller wires interaction against. It is emitted
// verbatim from the mockup so existing interaction logic ports 1:1.
//
// 1. Movable blocks — `data-move`
// ---------------------------------------------------------------------------
// Every top-level block (header, header note, each section, each root rule,
// the dietary key, the footer) is wrapped:
//
//   edit=false: <div class="mblk" style="TRANSFORM">INNER</div>
//   edit=true:  <div class="mblk movable" data-move="KEY" style="TRANSFORM">
//                 <span class="moveHint">drag</span>INNER
//               </div>
//
// `data-move` values (the "key" also used to look up `menu.pos[key]`):
//   - "header"                    the title/crest/lockup block
//   - "hnote"                     the header note line
//   - "sec:<sectionId>"           one whole section (heading + items)
//   - "rule:<ruleId>"             one root-level divider rule
//   - "key"                       the dietary key line
//   - "footer"                    the footer block
//
// TRANSFORM is `transform:translate(Xpx,Ypx);` when `menu.pos[key]` has a
// non-zero x or y (free-drag "Arrange" mode position), else empty.
//
// Dragging itself is NOT implemented here (this module only emits markup).
// The mockup's Arrange mode toggles a `body.moveMode` class and listens for
// `pointerdown` on `.movable` (reading `data-move` for the key, writing the
// result back to `menu.pos[key]`); `menu.css` already carries the
// `body.moveMode .movable` / `.moveHint` hover/active styling this depends
// on. There is no separate "drag dot" glyph in the rendered page — the only
// affordance is the `.moveHint` "drag" label, shown via CSS only while
// `body.moveMode` is active. (Per-dish reordering drag handles — the grip
// icon — belong to the *editor list panel*, a different piece of UI not
// covered by this render module.)
//
// 2. Inline-editable text — `data-edit`
// ---------------------------------------------------------------------------
//   edit=false: <span class="CLS">ESCAPED_TEXT</span>
//   edit=true:  <span class="CLS" data-edit="PATH" contenteditable="plaintext-only"
//                 spellcheck="false">ESCAPED_TEXT</span>
//
// `data-edit` PATH formats (feed straight into an `applyEdit(path, value)`
// dispatcher, matching the mockup's):
//   - "menu.name"                 menu title
//   - "menu.headerNote"           header note text
//   - "menu.footer"               footer text
//   - "sec:<sectionId>.name"      section heading
//   - "sec:<sectionId>.note"      section note
//   - "item:<dishId>.name"        dish name
//   - "item:<dishId>.desc"        dish description
//   - "item:<dishId>.price"       dish price
//   - "col:<sectionId>.<colIdx>"  a multi-column section's subheading
//                                 (colIdx is a 0-based integer)
//
// Tags (`.m-tg`) and notes-in-parens (`.m-nt`) are NOT individually
// editable spans — they render as plain escaped text, same as the mockup
// (edited via the editor panel's tag buttons, not inline on the page).
//
// ============================================================================

import type {
  Dish,
  DietKey,
  Menu,
  MenuStyle,
  Rule,
  RuleItem,
  Section,
  SectionItem,
} from '../types';
import { tagsStr, usedCodes } from './tags';
import { rootAfter, rootBottom, rootTop, type RootEntry } from './root-order';

export interface RenderOptions {
  /** Emit inline-edit hooks (data-edit, movable-block wrappers) as the mockup does in edit mode. Omit/false for the clean print/export DOM. */
  edit?: boolean;
  dietKey: DietKey[];
  /** Resolved image URLs. Never base64, never a global — always supplied by the caller. */
  assets: { crest: string; lockup: string };
  /** Coordinated font pairing (settings.typography.fontSet); 'griffin' is the default look. */
  fontSet?: 'griffin' | 'classic' | 'modern';
}

type Pos = { x: number; y: number };

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Mirrors the mockup's `esc`. */
function escapeHtml(value: string | undefined | null): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

function isRuleItem(item: SectionItem): item is RuleItem {
  return (item as RuleItem).type === 'rule';
}

function isDish(item: SectionItem): item is Dish {
  return !isRuleItem(item);
}

function offsetStyle(pos: Record<string, Pos>, key: string): string {
  const p = pos[key];
  if (p && (p.x || p.y)) return `transform:translate(${p.x}px,${p.y}px);`;
  return '';
}

/** Mirrors the mockup's `B()` — wraps a block so Arrange mode can drag it. */
function block(key: string, inner: string, edit: boolean, pos: Record<string, Pos>): string {
  const style = offsetStyle(pos, key);
  if (!edit) return `<div class="mblk" style="${style}">${inner}</div>`;
  return `<div class="mblk movable" data-move="${key}" style="${style}"><span class="moveHint">drag</span>${inner}</div>`;
}

/** Mirrors the mockup's `E()` — an inline-editable text span. */
function editableSpan(edit: boolean, path: string, text: string, cls = ''): string {
  if (edit) {
    return `<span class="${cls}" data-edit="${path}" contenteditable="plaintext-only" spellcheck="false">${escapeHtml(text)}</span>`;
  }
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

/** Mirrors the mockup's `ruleHTML`. Shared by root rules and in-section rule items. */
function renderRule(rule: Rule | RuleItem): string {
  return `<div class="m-rule rule-${rule.position || 'between'}"></div>`;
}

/**
 * Splits a section's items across `cols` columns. Mirrors the effect of the
 * mockup's `normaliseSectionColumns` (round-robin spread) followed by its
 * render-time bucketing by `it.col` — folded into one pure, non-mutating
 * pass since this module must not mutate `menu`.
 *
 * Deviation from the mockup: the new `RuleItem` type (a divider that can
 * live inside a section's item flow) carries no persisted `.col`, unlike
 * the mockup where every item — dish or rule — could carry one. A `RuleItem`
 * therefore always participates in the round-robin spread (as if its `.col`
 * were missing), landing in whichever column the dish flow is currently at.
 */
function splitSectionColumns(items: SectionItem[], cols: number): SectionItem[][] {
  const buckets: SectionItem[][] = Array.from({ length: cols }, () => []);
  if (cols <= 1) {
    buckets[0] = items;
    return buckets;
  }
  const dishCount = items.filter(isDish).length;
  const per = Math.ceil(Math.max(1, dishCount) / cols);
  const needsSpread = items.some((it) =>
    isDish(it) ? it.col == null || it.col < 0 || it.col >= cols : true,
  );
  let dishIndex = 0;
  for (const it of items) {
    let colIndex: number;
    if (needsSpread) {
      colIndex = Math.min(cols - 1, Math.floor(dishIndex / per));
      if (isDish(it)) dishIndex++;
    } else {
      colIndex = isDish(it) ? Math.max(0, Math.min(cols - 1, it.col ?? 0)) : 0;
    }
    buckets[colIndex].push(it);
  }
  return buckets;
}

/** Mirrors the mockup's `itemHTML`. */
function renderDish(
  dish: Dish,
  section: Section,
  edit: boolean,
  dietKey: DietKey[],
  showPricesGlobal: boolean,
): string {
  const tg = tagsStr(dish.tags, dietKey);
  const below = section.descMode === 'below';
  const name = dish.name ?? '';
  const desc = dish.desc ?? '';
  const price = dish.price ?? '';
  const pricesOn = section.prices && showPricesGlobal;

  if (below) {
    let x = `<div class="m-item stacked"><span class="m-nm">${editableSpan(edit, `item:${dish.id}.name`, name)}`;
    if (pricesOn && price) {
      x += ` <span class="m-pr">${editableSpan(edit, `item:${dish.id}.price`, price)}</span>`;
    }
    x += '</span>';
    const bits: string[] = [];
    if (desc || edit) bits.push(editableSpan(edit, `item:${dish.id}.desc`, desc));
    if (tg) bits.push(`<span class="m-tg">${escapeHtml(tg)}</span>`);
    if (dish.note) bits.push(`<span class="m-nt">(${escapeHtml(dish.note)})</span>`);
    if (bits.length) x += `<span class="m-ds">${bits.join(' ')}</span>`;
    return x + '</div>';
  }

  let x = `<div class="m-item"><span class="m-nm">${editableSpan(edit, `item:${dish.id}.name`, name)}</span>`;
  if (desc || edit) {
    x += ` <span class="m-dash">-</span> <span class="m-ds">${editableSpan(edit, `item:${dish.id}.desc`, desc)}</span>`;
  }
  if (tg) x += ` <span class="m-tg">${escapeHtml(tg)}</span>`;
  if (dish.note) x += ` <span class="m-nt">(${escapeHtml(dish.note)})</span>`;
  if (pricesOn && (price || edit)) {
    x += ` <span class="m-pr">${editableSpan(edit, `item:${dish.id}.price`, price)}</span>`;
  }
  return x + '</div>';
}

function renderSectionItem(
  item: SectionItem,
  section: Section,
  edit: boolean,
  dietKey: DietKey[],
  showPricesGlobal: boolean,
): string {
  return isRuleItem(item) ? renderRule(item) : renderDish(item, section, edit, dietKey, showPricesGlobal);
}

/** Mirrors the section-building portion of the mockup's `menuHTML`. Returns the `.m-sec` markup only — the caller decides whether to wrap/emit it. */
function sectionHTML(
  section: Section,
  list: SectionItem[],
  edit: boolean,
  dietKey: DietKey[],
  showPricesGlobal: boolean,
): string {
  let sec = `<div class="m-sech">${editableSpan(edit, `sec:${section.id}.name`, section.name)}</div>`;
  if (section.note || edit) {
    sec += `<div class="m-secnote">${editableSpan(edit, `sec:${section.id}.note`, section.note || '')}</div>`;
  }
  const cols = Math.max(1, Math.min(4, section.cols || 1));
  if (cols > 1) {
    const buckets = splitSectionColumns(list, cols);
    sec += `<div class="m-items" style="--cols:${cols}">${buckets
      .map((arr, ci) => {
        const colName = section.columnNames[ci] || '';
        let inner = '';
        if (colName.trim()) {
          inner += `<div class="m-subh">${editableSpan(edit, `col:${section.id}.${ci}`, colName)}</div>`;
        }
        for (const it of arr) inner += renderSectionItem(it, section, edit, dietKey, showPricesGlobal);
        return `<div class="m-col">${inner}</div>`;
      })
      .join('')}</div>`;
  } else {
    sec += `<div class="m-items">${list.map((it) => renderSectionItem(it, section, edit, dietKey, showPricesGlobal)).join('')}</div>`;
  }
  return `<div class="m-sec ${cols > 1 ? 'multi' : ''}">${sec}</div>`;
}

/**
 * Renders one menu as the `.page` markup — identical structure/classes to
 * the mockup's `menuHTML(m, opts)`. Used for both the live preview
 * (`edit: true`) and the print/export DOM (`edit: false`).
 */
export function renderMenuHTML(menu: Menu, opts: RenderOptions): string {
  const edit = !!opts.edit;
  const dietKey = opts.dietKey;
  const pos = menu.pos ?? {};
  const style: MenuStyle = menu.style;
  const showPricesGlobal = style.showPrices !== false;

  let head = '';
  if (style.header === 'crest') {
    head += `<img class="m-crest" src="${escapeHtml(opts.assets.crest)}" alt="">`;
  }
  if (style.header === 'lockup') {
    head += `<img class="m-lockup" src="${escapeHtml(opts.assets.lockup)}" alt="">`;
  }
  if (style.header !== 'lockup') {
    head += `<div class="m-title">${editableSpan(edit, 'menu.name', menu.name)}</div>`;
  } else {
    head += `<div class="m-title" style="font-size:1.5em;margin-top:.2em">${editableSpan(edit, 'menu.name', menu.name)}</div>`;
  }
  let h = block('header', head, edit, pos);

  const noteBlock = (n: { id: string; text: string }): string =>
    !edit && !n.text.trim()
      ? ''
      : block(`note:${n.id}`, `<div class="m-hnote">${editableSpan(edit, `note:${n.id}`, n.text)}</div>`, edit, pos);
  const emitRoot = (entry: RootEntry): string =>
    entry.kind === 'note' ? noteBlock(entry.item) : block(`rule:${entry.id}`, renderRule(entry.item), edit, pos);

  // Top subtitles + lines share one ordered flow, rendered above the body so a
  // line can sit above or below a subtitle (see root-order.ts).
  for (const entry of rootTop(menu)) h += emitRoot(entry);

  h += '<div class="body">';

  for (const section of menu.sections) {
    const list: SectionItem[] = section.items.filter((it) => !isDish(it) || !it.hidden);
    if (list.length === 0 && !edit) continue;

    h += block(`sec:${section.id}`, sectionHTML(section, list, edit, dietKey, showPricesGlobal), edit, pos);

    for (const entry of rootAfter(menu, section.id)) h += emitRoot(entry);
  }

  for (const entry of rootBottom(menu)) h += emitRoot(entry);

  h += '</div>';

  let foot = '';
  if (style.showKey) {
    const used = usedCodes(menu, dietKey);
    if (used.length) {
      const text = used.map((k) => `(${k.c}) ${k.l}`).join('  ');
      foot += block('key', `<div class="m-key">${escapeHtml(text)}</div>`, edit, pos);
    }
  } else {
    foot += block(
      'key',
      `<div class="m-key">${editableSpan(edit, 'menu.dietKeyText', menu.dietKeyText || '')}</div>`,
      edit,
      pos,
    );
  }
  foot += block(
    'footer',
    `<div class="m-foot">${editableSpan(edit, 'menu.footer', menu.footer || '')}</div>`,
    edit,
    pos,
  );

  const paperClass = style.paper === 'A5' ? 'A5' : '';
  const fontClass = opts.fontSet && opts.fontSet !== 'griffin' ? ` font-${opts.fontSet}` : '';
  const scaleStyle = `--sc:${style.sc || 1};--dn:${style.dn || 1}`;
  return `<div class="page ${paperClass}${fontClass}" style="${scaleStyle}"><div class="inner">${h}<div class="print-footer-zone">${foot}</div></div></div>`;
}
