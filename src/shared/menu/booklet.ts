// Booklet imposition + rendering — the fold-correctness core for the
// "single landscape-A4 sheet, folded once = A5 booklet" mode
// (docs/plan-booklet-system.md §2, §3).
//
// A booklet has FOUR logical panels the author thinks in reading order:
//   cover (front) → inside-left → inside-right → back
// but a physical landscape-A4 sheet (297 × 210mm), folded once down the
// vertical centre, only has TWO sides, each holding two A5 cells. The reading
// order therefore does NOT match the sheet position — that mapping is what
// `imposeBooklet` computes, purely and deterministically, so it can be
// unit-tested independently of any DOM.
//
//   Sheet OUTER side (folds to the outside):  [ back  | front ]
//   Sheet INNER side (folds to the inside):   [ inside-left | inside-right ]
//
// Rotation: exported to duplex-print flip-on-short-edge, the back cover on the
// outer side must be rotated 180° so it reads right-way-up once the sheet is
// folded (see plan §2 diagram and the Risks note — the exact rotation must be
// validated against a real printed fold; `imposeBooklet` is the single place
// that decision lives, so a fold test can pin it down and the export layer
// never re-derives it).
//
// `renderBookletHTML` emits a landscape `.sheet` that also carries the `.page`
// class (so the ~10 `.querySelector('.page')` call sites keep working) with two
// `.panel` cells for the requested side. Each INNER panel reuses the existing
// `renderMenuHTML` to render a normal A5 menu, so the footer / dietary key /
// title per inside page come for free.

import type { Booklet, BookletPanel, Menu } from '../types';
import { renderMenuHTML, type RenderOptions } from './render';

/* ================================ imposition ================================ */

/** Which physical side of the folded sheet a cell belongs to. */
export type SheetSide = 'outer' | 'inner';

/** The two logical roles printed on the OUTER side of the sheet. */
export type OuterRole = 'back' | 'cover';
/** The two logical roles printed on the INNER side of the sheet. */
export type InnerRole = 'inside-left' | 'inside-right';

/**
 * Which slice of the inside content a given inner cell shows:
 *   - `whole`    — a complete menu (both two-menu pages, and the single menu
 *                  when overflow is off).
 *   - `first`    — the start of a single menu that may overflow onto page 2.
 *   - `overflow` — the continuation of that single menu on inner page 2.
 *   - `blank`    — no content (single menu, overflow off → the 2nd inner cell).
 */
export type InnerPart = 'whole' | 'first' | 'overflow' | 'blank';

/** One imposed cover/back cell on the OUTER side. */
export interface ImposedPanel {
  side: 'outer';
  role: OuterRole;
  panel: BookletPanel;
  /** 180° rotation so the folded booklet reads right-way-up (see header). */
  rotate: boolean;
}

/** One imposed A5-menu cell on the INNER side. */
export interface ImposedPage {
  side: 'inner';
  role: InnerRole;
  /** The A5 menu rendered in this cell. In single-menu mode both inner cells
   *  reference the same `Menu` object (told apart by `part`). */
  menu: Menu;
  part: InnerPart;
  rotate: boolean;
}

/**
 * The full imposition: the two OUTER cells (left→right) and the two INNER cells
 * (left→right). Position in each tuple IS the physical left/right sheet slot.
 */
export interface BookletImposition {
  outer: [ImposedPanel, ImposedPanel];
  inner: [ImposedPage, ImposedPage];
}

/**
 * Map the four logical booklet panels to their physical sheet positions.
 *
 * PURE + deterministic — no DOM, no globals, no mutation of `booklet`. This is
 * the fold-correctness core; everything else (preview, export) renders whatever
 * this returns, so the fold order lives in exactly one testable place.
 *
 * Layout (left→right within each side):
 *   outer: [ back (rotated), front cover ]
 *   inner: [ inside-left, inside-right ]
 *
 * The inner tuple is always length 2 (per the plan's `inner: [Page, Page]`
 * shape); its `part` fields describe how the inside content fills the two
 * cells across the three inside configurations (two menus / single with
 * overflow / single without overflow).
 */
export function imposeBooklet(booklet: Booklet): BookletImposition {
  // A single vertical centre-fold (landscape A4 → two portrait-A5 halves) needs
  // NO rotation: on the outer side [back | front] both read upright, and folding
  // left-over-right puts the front outside and the back behind, both upright.
  // (This differs from the plan's early §2 sketch, which assumed a rotated back —
  // pinned by tests/booklet.test.ts and MUST be confirmed by a real duplex
  // flip-on-short-edge print + fold. If the printed back is upside-down, flip
  // BACK_COVER_ROTATE to true.)
  const BACK_COVER_ROTATE = false;
  const outer: [ImposedPanel, ImposedPanel] = [
    { side: 'outer', role: 'back', panel: booklet.back, rotate: BACK_COVER_ROTATE },
    { side: 'outer', role: 'cover', panel: booklet.cover, rotate: false },
  ];

  const inside = booklet.inside;
  let inner: [ImposedPage, ImposedPage];
  if (inside.mode === 'two') {
    inner = [
      { side: 'inner', role: 'inside-left', menu: inside.left, part: 'whole', rotate: false },
      { side: 'inner', role: 'inside-right', menu: inside.right, part: 'whole', rotate: false },
    ];
  } else if (inside.allowTwoPages) {
    // One menu that may overflow: page 1 on the left, its continuation right.
    inner = [
      { side: 'inner', role: 'inside-left', menu: inside.menu, part: 'first', rotate: false },
      { side: 'inner', role: 'inside-right', menu: inside.menu, part: 'overflow', rotate: false },
    ];
  } else {
    // One menu, no overflow: it fills the left cell; the right cell is blank.
    inner = [
      { side: 'inner', role: 'inside-left', menu: inside.menu, part: 'whole', rotate: false },
      { side: 'inner', role: 'inside-right', menu: inside.menu, part: 'blank', rotate: false },
    ];
  }

  return { outer, inner };
}

/* ================================ rendering ================================ */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Mirrors render.ts's `escapeHtml` (kept local — render.ts doesn't export it). */
function escapeHtml(value: string | undefined | null): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

export interface BookletRenderOptions extends RenderOptions {
  /** Which physical side of the folded sheet to emit. */
  side: SheetSide;
  /**
   * Optional DOM-measured overflow split for a single inside menu. Overflow can
   * only be decided with a real layout box, so the preview/export layer measures
   * it and passes the two halves here; when omitted, a single overflow menu
   * renders whole on page 1 with a blank page 2 (`renderBookletHTML` stays pure).
   * `[page1, page2]` — `page2` may be `null` for "nothing on the 2nd inner cell".
   */
  insideSplit?: [Menu, Menu | null];
  /** Resolve a `BookletPanel.image` brand-asset id to a URL. Image omitted if absent. */
  resolveImage?: (id: string) => string;
}

/** Renders a light cover/back panel (title / subtitle / note / optional image). */
function renderPanelCell(panel: BookletPanel, opts: BookletRenderOptions): string {
  const bits: string[] = [];
  const img = panel.image && opts.resolveImage ? opts.resolveImage(panel.image) : '';
  if (img) bits.push(`<img class="bk-cover-img" src="${escapeHtml(img)}" alt="">`);
  if (panel.title) bits.push(`<div class="bk-cover-title">${escapeHtml(panel.title)}</div>`);
  if (panel.subtitle) bits.push(`<div class="bk-cover-sub">${escapeHtml(panel.subtitle)}</div>`);
  if (panel.note) bits.push(`<div class="bk-cover-note">${escapeHtml(panel.note)}</div>`);
  return `<div class="bk-cover">${bits.join('')}</div>`;
}

/** Renders one INNER A5 cell by reusing the normal menu renderer. */
function renderPageCell(page: ImposedPage, opts: BookletRenderOptions, split?: [Menu, Menu | null]): string {
  if (page.part === 'blank') return '<div class="bk-blank"></div>';
  // A DOM-measured split (when supplied) is the source of truth for the two
  // halves of a single overflow menu; otherwise page 1 gets the whole menu and
  // page 2 stays empty (overflow reflow is a later, DOM-driven refinement).
  let menu: Menu | null = page.menu;
  if (split) menu = page.role === 'inside-left' ? split[0] : split[1];
  else if (page.part === 'overflow') menu = null;
  if (!menu) return '<div class="bk-blank"></div>';
  return renderMenuHTML(menu, opts);
}

function cellWrap(inner: string, role: OuterRole | InnerRole, rotate: boolean): string {
  const style = rotate ? ' style="transform:rotate(180deg)"' : '';
  return `<div class="panel panel-${role}"${style}>${inner}</div>`;
}

/**
 * Emit the landscape `.sheet.page` for the requested side, with two `.panel`
 * cells. Keeps the `.page` class on the sheet (so existing `.page` query sites
 * keep working) and adds `booklet` (selects the landscape `@page`) + `sheet`
 * (the 2-up grid box). Each inner cell nests a normal A5 `.page` via
 * `renderMenuHTML`, so per-page footer / dietary key / title come for free.
 */
export function renderBookletHTML(booklet: Booklet, opts: BookletRenderOptions): string {
  const imp = imposeBooklet(booklet);
  let cells: string;
  if (opts.side === 'outer') {
    cells = imp.outer.map((c) => cellWrap(renderPanelCell(c.panel, opts), c.role, c.rotate)).join('');
  } else {
    cells = imp.inner.map((c) => cellWrap(renderPageCell(c, opts, opts.insideSplit), c.role, c.rotate)).join('');
  }
  return `<div class="page sheet booklet" data-side="${opts.side}">${cells}</div>`;
}
