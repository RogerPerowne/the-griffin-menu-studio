# Griffin Menu Studio — app shell, tools & windows

Design for the bespoke pro-app shell. Principle throughout: **extremely minimalistic, easy
to use, user-friendly — the opposite of intimidating.** Almost everything below is *hidden by
default with sensible defaults* (from `reference/griffin-menu-studio.html`), surfaced through
top-bar menus or the rare, opt-in Arrange mode ("a rare event where you want something
completely custom"). Nothing here changes the print model: **preview shows the pink blush
paper; every export/print is white** (they print black ink onto pre-printed pink stock).

**Decided:** top bar = Illustrator-style dropdowns **plus** a slim icon quick-row (Save ·
Undo · Redo · Export · Print) for one-click access to the most-used actions. Mode pill order
= **Start · Editor · Export**, Editor highlighted by default. No right-hand Properties panel
for now — advanced overrides stay inside the relevant top-bar menu / Settings until a panel is
justified. **Section** is not a top-bar menu — it's a per-section **⋯** popover on each
section's own row (implemented), keeping the top bar about the *document*, not the selection.

## 1. Workspaces (Lightroom-style modes)

A segmented **mode pill** replaces the "MENU STUDIO" text; a small **crest** replaces the
full lockup top-left. Native window buttons stay top-right (Windows overlay).

```
[crest]   ( Start | Editor | Export )              … contextual top-bar menus …   [ _ ▢ ✕ ]
```

- **Start** — the "library": pick or manage what you work on.
  - Your menus (live-thumbnail cards) · Recent · search
  - Start from template (Griffin Classics / Core / Events / Yours)
  - New blank · Open file…
  - Clicking a menu → jumps to Editor.
- **Editor** — the develop room (current editor: menu rail + edit panel + live preview + top-bar menus). Highlighted by default.
- **Export** — the output room:
  - Large fit-to-view preview of the current menu (white, as it will print)
  - Options: Format (PDF / PNG), Paper (A4/A5, from the menu), Background = **White (locked)** with the note "pink paper — prints black ink only"
  - Actions: **Export PDF**, **Export PNG**, **Print…** (opens the OS print dialog like Word → prints to the connected printer)
  - Live preflight status (fits / "reaches footer" / "doesn't fit" with a one-click Shrink-to-fit)

## 2. Top-bar menus (Illustrator-style — hover a title, a dropdown drops)

Shown in **Editor** mode. `▸` = submenu, `—` = divider, `[x]` = toggle, `(⌘K)` = shortcut.

```
File ▾
├─ New Menu                         (Ctrl+N)
├─ New from Template…               (Ctrl+Shift+N)
├─ Open…                            (Ctrl+O)
├─ Open Recent ▸  (recent files… · Clear)
├─ —
├─ Save                             (Ctrl+S)
├─ Save As…                         (Ctrl+Shift+S)
├─ Duplicate Menu
├─ Delete Menu
├─ —
├─ Back up all menus                (download library .json)
├─ Restore from backup…
├─ —
├─ Export ▸  (Export PDF · Export PNG)   → or switch to the Export workspace
└─ Print…                           (Ctrl+P)

Edit ▾
├─ Undo                             (Ctrl+Z)
├─ Redo                             (Ctrl+Shift+Z)
├─ —
├─ Cut / Copy / Paste               (text fields)
├─ Copy Dish / Paste Dish          (duplicate a dish within/across menus)
├─ —
├─ Find & Replace…                  (across all menus — Phase 4)
└─ Select All

Menu ▾   (whole-menu properties)
├─ Rename…               · Date…
├─ Paper ▸               (A4 · A5)
├─ Header ▸              (Title only · Crest + title · Full lockup)
├─ Show Dietary Key      [x]
├─ Footer…
├─ —
├─ Add Section           · Add Line
└─ Save Layout as Template…

(Section actions live on a per-section "⋯" popover — not the top bar — so the
 bar stays about the document, not whatever's selected. Rows: Move Up · Move
 Down · Show prices [x] · Description: beside/below name · Columns: N ·
 Delete Section. Implemented in `views/editor.ts`.)

Arrange ▾   (free-position tools; enables Arrange mode)
├─ Arrange Mode          [x]
├─ —
├─ Align ▸               (Left · Center · Right · Top · Middle · Bottom)
├─ Distribute ▸          (Horizontally · Vertically · Even spacing)
├─ Center on Page ▸      (Horizontal · Vertical · Both)
├─ —
├─ Line Length…          (or drag a line's end handles)
├─ Reset Position        · Reset All Positions
├─ —
├─ Snapping              [x]  (smart guides while dragging)
└─ Show Guides           [x]

View ▾
├─ Zoom In · Zoom Out
├─ Fit to Width          (Ctrl+0)
├─ Actual Size
├─ —
├─ Blush Preview         [x]  (screen tint; exports stay white)
├─ Show Rulers           [ ]
├─ Show Safe Area        [ ]
├─ —
└─ Focus Preview         (hide side panels)

Help ▾
├─ Quick Tips
├─ Keyboard Shortcuts
└─ About Griffin Menu Studio
```

Advanced typography/spacing (font, body size, letter/line spacing, the six layout sliders)
are **not** top-bar menus — they live in the right Properties panel, off by default, because
the app auto-perfects layout. Power users open the panel to override.

## 3. Windows / panels (dockable, hidden unless noted)

```
Editor workspace
├─ Menus rail (left)          visible by default — the menu library list
├─ Edit panel (center-left)   visible by default — sections & dishes, drag-to-reorder
├─ Preview stage (center)     always visible — live WYSIWYG page
├─ Properties (right)         HIDDEN — tabs: Content · Style · Layout for the selection
├─ Arrange panel              HIDDEN — align / distribute / center / line length (Arrange mode)
├─ Dietary Key & Settings     HIDDEN dialog
├─ Products / Catalogue       HIDDEN (Phase 4)
└─ Find & Replace             HIDDEN (Phase 4)
```

## 4. Arrange mode + snapping

- **Draggable blocks**: header, header note, each section, each divider line, the dietary key, the footer (already stored in `menu.pos`).
- **Line end-handles**: in Arrange mode every divider line shows a handle at each end; drag to **lengthen/shorten** the line. Persisted as a per-line length (%) override.
- **Smart snapping** (Canva/PowerPoint/Illustrator feel) while dragging:
  - snap to **page center** (H & V) and content **left/right/top/bottom** edges
  - snap to another block's **left / center / right / top / middle / bottom**
  - snap to **even spacing** between sections (equal gaps)
  - ~6px threshold; show gold **smart-guide lines** + a subtle nudge; hold a key to bypass
- **Align / Distribute / Center** from the Arrange menu or Arrange panel operate on the selected block(s).

## 5. Defaults (locked-in, from the original HTML)

Blush `#F5E4DF` (screen only) · export/print **white** · Paper A4 · Header Title · Show key on ·
Layout: section 100 · dish 100 · inner-rule 34 · edge-rule 94 · footer 100 · col-divider 86 ·
Fonts Brandon/GGap.

## 6. Suggested build order

1. Shell: crest + mode pill + workspace switching (Start / Editor / Export) — Editor first, Start/Export scaffolded.
2. Editor top-bar menus (File/Edit/Menu/Section/Arrange/View/Help) wired to existing actions.
3. Export workspace (options + Export PDF/PNG + native Print dialog).
4. Start workspace (library + templates).
5. Arrange upgrades: line end-handles, snapping + smart guides, Align/Distribute/Center + Arrange panel.
6. Right Properties panel (Content/Style/Layout) — advanced overrides.
