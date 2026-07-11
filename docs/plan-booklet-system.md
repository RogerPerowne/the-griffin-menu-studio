# Plan — Folded Booklet (landscape A4 → A5)

Ship a "single landscape A4 sheet, folded once = A5 booklet" mode: a **cover**, a
**back**, and an **inside** (an A5 menu that may overflow to two inside pages, each with
its own footer / dietary key / title) — or two separate menus for the inside. Print/PDF
must **impose** the panels onto the physical sheet (reading order ≠ sheet position).

Grounded in the earlier survey: the whole pipeline assumes **one portrait `.page` per
stage**, portrait dimensions are hardcoded in three places (`menu.css` `.page`/`@page`,
`layout-runtime.ts` ruler ternaries, `export-handlers.ts` micron `pageSize`), and
`landscape: false` is locked at the type level.

---

## 1. Data model  (`src/shared/types.ts`, `factories.ts`, `document-format.ts`)

A booklet is a new document **kind** (see [[file-extensions]] — `.booklet`), not a menu.

```ts
export interface Booklet {
  id: string;
  name: string;
  date: string;
  cover: BookletPanel;      // front cover
  back: BookletPanel;       // back cover
  inside: BookletInside;    // one A5 menu (overflow to 2) OR two menus
  style: { paper: 'A5'; sc: number; dn: number };
}
export interface BookletPanel {         // cover / back — light content
  title?: string; subtitle?: string; note?: string; header: HeaderStyle; image?: string; // brand asset id
}
export type BookletInside =
  | { mode: 'single'; menu: Menu; allowTwoPages: boolean }  // one A5 menu, may flow to 2 inside pages
  | { mode: 'two'; left: Menu; right: Menu };               // two separate A5 menus
```

- `document-format.ts`: `kind: 'booklet'`, wrapper reused, `CURRENT_DOCUMENT_VERSION`
  may bump defensively. Validation mirrors the menu path.
- Factories: `newBooklet()`, `newBookletPanel()`.
- Booklets live in `Menus/` as `*.booklet` (per the filing design).

## 2. Imposition  (new `src/shared/menu/booklet.ts`)

The heart of the feature — map the four **logical** panels to their **physical** sheet
positions across two sides of one landscape-A4 sheet:

```
Sheet OUTER side (printed first): [ back cover | front cover ]   ← back is rotated so it reads right-way-up when folded
Sheet INNER side (printed second): [ inside-left | inside-right ]
```

`imposeBooklet(booklet): { outer: [Panel, Panel]; inner: [Page, Page] }` returns the two
sheets' panel order (with any 180° rotation flags), independent of how the UI shows the
reading order. Pure + unit-tested (this is where a fold test must pass).

## 3. Render  (`src/shared/menu/render.ts` + new booklet renderer)

- `renderBookletHTML(booklet, opts)` emits a **landscape `.sheet`** (297 × 210 mm)
  containing 2 `.panel` cells for the requested side, each panel rendered with the
  existing menu/panel machinery. Keep the `.page` class on the sheet so the ~10
  `.querySelector('.page')` call sites keep working; nest `.panel` inside.
- Each inside page is a normal A5 menu render (reuse `renderMenuHTML`), so footer /
  dietary key / title per inside page come for free.
- Overflow: if `inside.mode==='single'` and content exceeds one A5 panel and
  `allowTwoPages`, flow the remainder into the second inside panel.

## 4. CSS  (`src/renderer/styles/menu.css`)

- New landscape sheet box: `.sheet{width:297mm;height:210mm}` with a 2-up panel grid and
  a centre fold guide (screen only).
- New `@page` for landscape: `@page booklet { size: 297mm 210mm; margin: 0 }`; select via
  `.page.booklet { page: booklet }`. (Today only two portrait `@page` rules exist.)

## 5. Preview + fit runtime  (`src/renderer/layout-runtime.ts`, `views/preview.ts`)

- The stage generalisation from the Export-preview work already lets a stage target any
  page ids; point the booklet preview at the `.sheet`.
- Rulers: add a **landscape** branch to the `a5 ? 14.8:21 / 21:29.7` ternaries (29.7 × 21).
- Fit/overflow: run `measureFit` **per inside panel** (each can overflow independently);
  the sheet is the fittable unit for zoom.
- A "flip" control to preview the outer vs inner side, and a fold-preview overlay.

## 6. Export / print — unlock landscape  (`src/main/export-handlers.ts`, `ipc.ts`, `shared/api.ts`, `renderer/commands.ts`)

- `PrintDocumentPayload.landscape` literal `false` → `boolean`; add `orientation` to
  `ExportPdfPayload`.
- `ipc.ts` `printPayload` — stop rejecting `landscape:true`.
- `export-handlers.ts` — `normalisePrintPayload` (drop hardcoded `false`), `exportPdf`
  micron `pageSize` add landscape A4 `{width:297000,height:210000}` (+ `preferCSSPageSize`
  already on), `printDocument` pass real `landscape`.
- PDF export produces a **2-page** PDF (outer sheet, inner sheet) ready for
  duplex-flip-on-short-edge printing; document that in the export UI.
- `preparePrintDOM`'s injected `@page{size…}` gets a landscape branch keyed off booklet mode.

## 7. UI / authoring

- New → Booklet (a booklet template set). The Editor shows the four panels
  (cover / inside-left / inside-right / back) as tabs or a 2×2 board; each inside panel is
  the normal menu editor. A toggle: "Inside = one menu (overflow) / two menus".
- Reuse the dockable panel system: the booklet panels are just the document area content;
  the tool panels (Dishes, Typography, etc.) still dock around them.

## 8. Phases (each shippable)

1. Model + `.booklet` format + factories + New→Booklet (renders 4 blank panels, portrait fallback).
2. Landscape unlock (types/IPC/export chain) + landscape `@page`/CSS + PDF landscape.
3. `imposeBooklet` + `renderBookletHTML` (outer/inner) + fold-correct PDF (unit-tested).
4. Inside overflow-to-two-pages + per-page footer/key/title.
5. Preview: landscape rulers/zoom, flip + fold overlay.
6. Two-separate-menus inside mode; booklet templates.

## 9. Verify
Create a booklet, fill panels, export PDF, **print duplex (flip on short edge) and fold** —
the pages must read in order. Test single-menu overflow to page 2, and two-menu mode.
Unit-test `imposeBooklet` for position + rotation. `npm run typecheck` + `npm test`.

## Risks
- Imposition rotation/duplex-edge correctness — must be validated with a real printed fold.
- The single-`.page`-per-stage assumption is deep; keep `.page` on the sheet to avoid a
  wide refactor of the query sites.
