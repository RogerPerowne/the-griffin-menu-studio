# Dockable Panel Workspace — Griffin Menu Studio

A structured, dockable panel system for the **Editor** workspace, modelled on the
*behaviour* of professional creative tools (Photoshop, Illustrator, After Effects)
but wearing Griffin Menu Studio's own calm bronze/green/ivory skin — not their chrome.

The goal: the menu preview sits in the centre; every tool (dishes, styling, dietary
key, find & replace, brand assets…) lives in a movable, groupable, resizable panel
around it, and the arrangement is remembered. No pop-up-box soup.

> This document is the product spec. The implementation plan (phases, file seams)
> lives in `docs/menu-editor-fix-plan.md` (System 3) and
> `C:\Users\perow\.claude\plans\...` — this file is what "done" looks like.

---

## 0. How it fits Griffin's three workspaces

Griffin has three top-level workspaces on the mode pill (`Home · Editor · Export`):

- **Home** — library, new-from-template, settings. *Not* dockable; it's a full-page view.
- **Editor** — where the menu is built. **This is where the panel workspace lives.**
- **Export** — print/PDF/PNG preview. Gets the same *preview stage* (rulers + zoom)
  but a fixed, simple panel set (Export settings); it does not need the full dock model.

So "the dockable panel system" means: **the Editor workspace.** The document area is
the live menu **page** (the `.page` in `#pagewrap`, with its cm rulers and zoom bar).

---

## 1. Core layout model — three layers

1. **Application shell** (unchanged, never part of a panel)
   - Top bar: the crest, the `Home · Editor · Export` mode pill, the save-state chip,
     the native window controls. The bar is the OS drag region.
   - The header menu bar (File / Edit / Insert / **Window** / Help).

2. **Document area — the menu page**
   - The live `.page` preview with top + right **cm rulers** and the **zoom bar**
     (`− [slider] + · Fit width`). Click-to-edit text lives here.
   - Automatically fills all space not taken by docked panels.
   - **Must never become a panel or join a group.** It is the fixed centre.

3. **Panel system** (the new part)
   - Docked panel columns (left and/or right of the page)
   - Tabbed panel groups
   - Vertically stacked groups with draggable dividers
   - Collapsed icon docks with fly-outs
   - Free-floating panels

A vertical run of panels/groups pinned to one side is a **dock**.

---

## 2. The Griffin panels

These are the real tools (today they are floating palettes in
`src/renderer/panels/window-panels.ts` + the rail and editor columns). In the new
system every one becomes a first-class **Panel** that can dock, tab, stack or float.

| Panel | What it holds | Default home | Min size |
|-------|---------------|--------------|----------|
| **Menus** | The library rail — every saved menu as a card | Left dock (hidden by default¹) | 200×300 |
| **Edit Menu** | The structured editor: sections, dishes, drag-dots, per-section controls, the header meta (name/date/paper/header + Settings) | Left dock | 320×400 |
| **Dishes** | Flat dish list / quick add across the current menu | tab with Edit Menu | 260×300 |
| **Colour & Spacing** | Paper tint + the six spacing/density sliders (merged²) | Right dock | 280×360 |
| **Typography** | Fonts, sizes, show-key / show-prices toggles | tab with Colour & Spacing | 260×320 |
| **Dietary Key** | The allergen/diet code list + manual key text | Right dock | 240×260 |
| **Arrange** | Free-move mode: nudge/lock blocks on the page | Right dock | 220×200 |
| **Find & Replace** | Search + replace across all menus, with review³ | floating / on demand | 300×360 |
| **Reuse** | Browse dishes from other menus, click- or drag-to-add³ | floating / on demand | 260×340 |
| **Brand Assets** | Logo/crest/wordmark library; drag onto the header⁴ | floating / on demand | 280×320 |
| **Page** | Paper size (A4/A5), booklet mode⁵, margins | tab with Colour & Spacing | 240×260 |
| **Preview Controls** | Zoom %, Fit width, rulers on/off, page background | docked under the zoom bar or floating | 220×160 |

¹ Menus column is hidden by default (a Window-menu toggle shows it).
² Colour and Spacing were merged into one panel.
³ Find & Replace and Reuse were split apart; Reuse supports click-to-add into the selected section.
⁴ Brand Assets is a later update (System 4) — reserve its slot now.
⁵ Booklet mode is a later update (System 5).

The **Window** menu lists all of them, each with a tick when open. Selecting one:
opens it if closed; otherwise brings it to front, expands its dock if collapsed, and
activates its tab if it's grouped. It must **add EDIT MENU and MENUS** to that menu
(they are panels now, not hard-wired columns).

---

## 3. Panel anatomy

Each panel has a **tab** (crest-free icon + short name), a draggable tab strip, an
optional close (×) button, an optional panel-menu (⋯) button, a content area, and
minimum width/height. Styling follows the brand: ivory panel, warm hairline borders,
bronze/green accents — the same vocabulary as the current float windows and toolbars,
not a foreign grey.

A **panel group** shows one or more panels as tabs; only the active tab's content
shows. Tabs can be dragged horizontally to reorder within the group.

```text
┌──────────────────────────────────┐
│ Edit Menu │ Dishes │ Sections     │   ← tab strip (drag a tab to move one panel)
├──────────────────────────────────┤
│                                  │
│   Active panel content           │
│                                  │
└──────────────────────────────────┘
```

---

## 4. Dragging behaviour

Predictable, with a preview before anything moves.

- **Drag a tab** → moves that one panel out of its group.
- **Drag the group's header** (the strip beside/above the tabs) → moves the whole
  group with all its tabs and its current size.

While dragging show a translucent ghost of the panel, a clear cursor, highlighted
drop zones (brand-green wash, not Photoshop blue), and a live placeholder of the
final size.

---

## 5. Drop zones (pointer position decides)

- **Onto a tab strip** → add as another tab, inserted at the pointer position.
  `[Edit Menu]  [Dishes]` → `[Edit Menu │ Dishes]`
- **Onto the top edge of a group** → new group *above* it (vertical split).
- **Onto the bottom edge of a group** → new group *below* it — two stacked cells in
  the same dock, divider between.
- **Onto the left/right edge of a dock** → a new neighbouring **column** (great for a
  narrow Dietary Key column beside a wider Edit Menu).
- **Onto an outer application edge (left/right)** → a new dock on that side. Left and
  right docks are the priority; top/bottom optional.
- **Anywhere else** → a floating panel/group. Never snap somewhere unexpected.

Example default Editor layout (Menus hidden):

```text
┌───────────────┬──────────────────────────────┬────────────────────┐
│  Edit Menu    │      The menu page            │  Colour & Spacing  │
│  (sections,   │   (rulers, click-to-edit,     │  ─ divider ─       │
│   dishes)     │    zoom bar below)            │  Dietary Key       │
│               │                               │  Arrange           │
└───────────────┴──────────────────────────────┴────────────────────┘
   left dock            document area                right dock
```

---

## 6. Stacked panel groups

A dock can stack several groups vertically, each divider draggable:

```text
┌──────────────────────────┐
│ Colour & Spacing │ Type   │
│                          │
├──────── drag ────────────┤
│ Dietary Key              │
├──────── drag ────────────┤
│ Arrange                  │
└──────────────────────────┘
```

Dragging a divider grows one group and shrinks its neighbour, preserving the dock's
total height and each panel's minimum. Sizes are stored as **proportions**, not fixed
pixels, so the layout adapts when the window resizes. Closing a group lets the others
expand into the space.

---

## 7. Resizable dock columns

The boundary between a dock and the page is draggable — reuse the exact
pointer-drag-and-clamp pattern the rail/editor columns already use
(`wireRailResize` / `wireEditorResize` in `src/renderer/views/editor.ts`).

Wider dock → narrower page (the page's Fit-width recomputes; text/controls in panels
reflow). Narrower dock → panels honour their minimum width, long labels truncate with
tooltips, dense controls switch to compact. The **page always takes the remaining
width.** Multiple columns each have an independently draggable divider.

---

## 8. Floating panels

Dragging a panel clear of every dock zone floats it: above the workspace, draggable
anywhere, resizable from edges/corners, keeping its tabs. Float groups can accept
other panels (tab or stack) and re-dock later. Dragging a tab out of a floating group
separates it again.

Implement floats as **in-app surfaces** (the current `#floatLayer` approach), not OS
windows. Separate native windows only if deliberate multi-monitor support is wanted.

---

## 9. Collapsing docks to icons

A whole dock can collapse to a narrow icon strip via a double-chevron at its top,
cycling: full panels → icons + labels → icons only.

```text
Expanded            Collapsed
┌──────────────┐    ┌────┐
│ Dietary Key  │    │ ⌾  │   ← click an icon → fly-out over the page
│ full content │    │ Aa │
└──────────────┘    │ ▤  │
                    └────┘
```

Clicking a collapsed icon opens that panel as a **fly-out** over the page; it closes
on outside-click, another icon, Escape, or ×. A pin re-expands the dock.

---

## 10. Minimising individual groups

Double-clicking a tab or group header collapses that group to just its tab strip;
double-clicking again restores it. This is separate from collapsing a whole dock to
icons.

---

## 11. Workspace persistence & named workspaces

Save the whole arrangement automatically (into `settings`, alongside the existing
`griffinMenuStudio.v2` store — replacing today's flat `settings.floatWindows`):
which panels are open/closed, dock side, column order + widths, group proportions,
tab groups + order + active tab, floating positions/sizes, collapsed/icon state.
Restore on launch.

Named workspaces (Griffin-flavoured presets):

- **Writing the menu** — Edit Menu wide left, minimal right dock.
- **Styling** — Colour & Spacing + Typography + Dietary Key on the right, Edit Menu narrow.
- **Print preparation** — Preview Controls + Page + Dietary Key; page centred and large.
- **Compact** — everything docked to icons, maximum page.
- **Default** — the layout in §5.

Users can save the current layout as a workspace; switch, update, rename, delete a
custom one; **Reset Workspace** (revert to its saved state); and **Restore default
layout**. Reset Workspace must always be reachable (Window menu) — it's the escape
hatch when a layout gets confusing.

---

## 12. Drag-and-drop feedback

Never make the user guess where a panel lands:

- becoming a **tab** → highlight the target tab group
- **stack above/below** → a thin horizontal zone
- **neighbouring column** → a vertical zone
- **new dock** → a full-height edge highlight
- **floating** → no highlight
- always show a live placeholder of the final size

Do **not** re-flow the real layout as the pointer passes each target — show the
preview and commit only on release. Use a small dwell delay before a drop zone
activates so panels don't flicker between targets while merely dragging past.

---

## 13. Behavioural rules

1. Drag a tab → moves one panel.
2. Drag a group header → moves the whole group.
3. Drop on tabs → tabbed group.
4. Drop on a top/bottom edge → vertical split.
5. Drop on a left/right edge → neighbouring column.
6. Drop on an app edge → new dock.
7. Drop elsewhere → floating panel.
8. Dividers resize adjacent regions (proportional).
9. The menu page always fills unused space and is never a panel.
10. Closing a panel never deletes its data (a menu, a dish, a saved template stays put).
11. Opening an already-open panel brings it to front — never a duplicate.
12. Empty groups, columns and docks remove themselves; the page reclaims the space.
13. Every layout change is saved.
14. No undo for panel moves, but **Reset Workspace** is always available.

---

## 14. Implementation — the structured layout tree (essential)

Do **not** treat panels as independent absolutely-positioned windows with unrelated
coordinates (which is what `float-windows.ts` does today — `snapMove` only nudges a
window's position; there is no dock model, and the `.window-dock` CSS is an unused
stub). That approach looks fine for ten minutes and then falls apart the moment
docking, resizing and persistence interact.

Model the workspace as a **tree**, persisted and re-rendered from state:

```text
Workspace
├── DockArea (left)
│   └── DockColumn (resizable width)
│       └── PanelStack (proportional heights)
│           └── PanelGroup (tabs)  ── Edit Menu · Dishes
├── Document area  ── the menu page (rulers + zoom); never a node's child
├── DockArea (right)
│   ├── DockColumn
│   │   ├── PanelGroup ── Colour & Spacing · Typography · Page
│   │   └── PanelGroup ── Dietary Key
│   └── DockColumn
│       └── PanelGroup ── Arrange
└── FloatingGroup[] ── Find & Replace, Reuse, Brand Assets (when pulled out)
```

Node types: **DockArea** (a side) → **DockColumn** (resizable) → **PanelStack**
(vertically stacked groups) → **PanelGroup** (tabbed) → **Panel** (a tool), plus
**FloatingGroup** for detached groups.

### How this grows out of the current code

- **Panel registry:** promote every body in
  `src/renderer/panels/window-panels.ts` **and** the rail (Menus) + Edit-Menu column
  render functions into `Panel` definitions `{ id, title, icon, minW, minH, render() }`.
  Keep the default layout identical to today's so the first build looks unchanged.
- **Layout engine:** replace `float-windows.ts`'s free-position model with the tree
  above; render real DOM containers for docks/columns/stacks/groups; retire the fixed
  `.main` CSS grid (rail | editor | page) and the dead `.window-dock` stub.
- **Dividers:** reuse `wireRailResize` / `wireEditorResize`
  (`src/renderer/views/editor.ts:702-761`) for column-width and stack-height handles.
- **Window menu:** the `Window` command group in `src/renderer/commands.ts` and its
  markup in `src/renderer/shell/app-shell.ts` list every panel (add **Edit Menu** and
  **Menus**), each `checked` when its panel is open.
- **Persistence:** store the tree in `settings` (replacing `settings.floatWindows` in
  `src/shared/types.ts`); named workspaces are just saved copies of the tree.

Build it in shippable slices: registry migration → tree + render → dividers → tabs →
drag/drop with previews → floating → collapse-to-icons → Window menu + named
workspaces.

---

## 15. Definition of success

A user in the Editor workspace can:

- open any tool from the Window menu;
- drag a panel into another as a tab (e.g. Dishes onto Edit Menu);
- drag a panel above/below another to split a column;
- drag a panel beside a column to form a new column;
- resize every column and stacked region, with the menu page reflowing to fill the rest;
- pull any panel out to float it, combine floats into tabs/stacks, and re-dock them;
- collapse a dock to icons and restore panels from those icons;
- close and reopen panels without losing any menu/dish/template data;
- save, switch and restore complete workspaces, and **Reset Workspace** out of any mess.

It should feel like one coherent Griffin workspace built around the menu page — calm,
branded, and predictable — not a scatter of pop-up boxes.
