# Plan — Dockable Panel Workspace (Photoshop-style)

Implement the dockable panel system specified in
`docs/photoshop-style-dockable-panel-system.md`: the menu page as the fixed centre, every
tool in a movable/groupable/resizable/floatable panel around it, with saved workspaces.
This is the largest single build — sub-phased so each phase ships.

Grounded in the survey: today `src/renderer/panels/float-windows.ts` is **floating-only**
(`snapMove` aligns position only; no dock model); the rail (Menus) + Edit-Menu columns are
baked into a fixed CSS grid (`editor.css` `.main`); `.window-dock` is a dead CSS stub;
panels register via `window-panels.ts` `registerFloatWindow`; the Window menu lives in
`commands.ts` (group) + `app-shell.ts` (markup); bounds persist in
`settings.floatWindows`.

---

## 1. The layout tree (the essential model)  (`src/shared/types.ts`, new `src/renderer/panels/layout-tree.ts`)

Replace absolute-position windows with a **persisted tree**:

```
Workspace → DockArea(left|right) → DockColumn(width) → PanelStack(proportional heights)
          → PanelGroup(tabs) → Panel ;  plus FloatingGroup[] ;  Document area fills the rest
```

```ts
export interface WorkspaceLayout {
  left: DockArea; right: DockArea;
  floating: FloatingGroup[];
}
interface DockArea { columns: DockColumn[] }
interface DockColumn { widthPct: number; stack: PanelStack }
interface PanelStack { cells: { heightPct: number; group: PanelGroup }[] }
interface PanelGroup { panels: string[]; activeTab: string; collapsed?: boolean }
interface FloatingGroup { x:number;y:number;w:number;h:number; group: PanelGroup }
```

Persist the whole tree in `settings` (replacing `settings.floatWindows`); named workspaces
are saved copies. `Panel` here is just an **id** into the panel registry.

## 2. Panel registry migration  (`src/renderer/panels/window-panels.ts`, `views/editor.ts`, `views/rail.ts`)

Promote every current tool body **and** the rail (Menus) + Edit-Menu column render
functions into `Panel` definitions `{ id, title, icon, minW, minH, render() }`. Default
layout reproduces today's arrangement so phase 2.0 looks unchanged. The Griffin panel set
(from the spec): Menus, Edit Menu, Dishes, Colour & Spacing, Typography (→ the Typography
Master, [[plan-typography-master]]), Dietary Key, Arrange, Find & Replace, Reuse, Brand
Assets, Page, Preview Controls.

## 3. Renderer + dividers  (`styles/editor.css`, reuse `views/editor.ts` resize helpers)

- Render dock areas / columns / stacks / groups as real DOM; document area `flex:1 1 auto`.
  Remove the fixed `.main` grid + the `.window-dock` stub.
- Column-width + stack-height **dividers** reuse the existing rail/editor drag-and-clamp
  pattern (`wireRailResize`/`wireEditorResize`, `editor.ts:~702-761`); heights are
  proportional with min constraints.

## 4. Tabs + drag/drop  (new `panels/panel-drag.ts`)

- **Tabbed groups**: multiple panels per group; select + drag-reorder tabs.
- **Drag a tab** = one panel; **drag the group header** = the whole group.
- **Drop zones** (small activation delay, live placeholder, no continuous re-layout):
  tab-strip → tab; top/bottom edge → vertical split; left/right edge → neighbour column;
  app outer edge → new dock; elsewhere → float. Brand-green highlight (not Photoshop blue).
- The 14 behavioural rules from the spec (§13) drive `panel-drag.ts` + tree mutations.

## 5. Floating, collapse, minimise
- **Floating groups**: pull-out to float (in-app surfaces on `#floatLayer`), tab/stack/
  redock; not OS windows.
- **Collapse a dock to icons** (double-chevron: full → icons+labels → icons); clicking an
  icon opens a **flyout** over the document (Esc/click-away/another-icon closes; pin
  re-expands).
- **Minimise a group** by double-clicking its tab/header (separate from icon-collapse).

## 6. Window menu + workspaces  (`commands.ts`, `app-shell.ts`)
- Window menu lists every panel with a tick when open; selecting opens / brings-to-front /
  expands its dock / activates its tab. Add **EDIT MENU** and **MENUS** entries.
- Named workspaces: Default / Writing the menu / Styling / Print preparation / Compact /
  Custom — save, switch, update, rename, delete, **Reset Workspace**, restore default.
  Reset Workspace always reachable (the escape hatch).

## 7. Definition of done  (from the spec)
Open any panel from the Window menu; drag a panel into another as a tab; split a column
above/below; form a new neighbour column; resize every column + stacked region (page
reflows to fill the rest); float any panel; combine floats into tabs/stacks; redock;
collapse a dock to icons and restore; close/reopen without losing data; save/switch/reset
workspaces. Feels like one coherent Griffin workspace, not pop-up boxes.

## 8. Phases (each shippable)
- **2.0** Registry migration — panels + rail + editor become `Panel`s; default layout
  unchanged; add EDIT MENU / MENUS to the Window menu.
- **2.1** Layout tree + renderer; document area flex-fills; retire `.main` grid + `.window-dock`.
- **2.2** Resizable column + stack dividers (reuse resize helpers).
- **2.3** Tabbed groups (select + reorder).
- **2.4** Drag/drop with previews (all drop zones + rules).
- **2.5** Floating groups (float/redock/tab/stack).
- **2.6** Collapse-to-icon docks + flyouts; minimise groups.
- **2.7** Window menu ticks + named workspaces + Reset Workspace.

Fold in the already-shipped small items as panels: Menus-hidden-by-default (#7), merged
Colour+Spacing (#9), edit-header→Settings (#16).

## 9. Verify
Renderer-only → drivable in the dev-server browser preview and the real app. Walk the whole
Definition-of-done. Persist a layout, restart, confirm it restores; then Reset Workspace.
`npm run typecheck` + `npm test`.

## Risks
- Biggest build; the tree model is essential — do **not** shortcut with absolute-position
  windows (they break on snapping/resize/persistence).
- Migration from `settings.floatWindows` → the tree must be tolerant (fall back to default
  layout on any parse issue).
