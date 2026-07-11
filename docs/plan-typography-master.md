# Plan — Typography Master

Build the full **Typography Master** — the panel from `docs/typography-master-panel.md`,
docked beside the live menu in the Editor. The Settings "Typography" card (shipped in
v1.0.1) is the *defaults* seed; this plan makes typography fully editable **per menu** and
applies it to the live page and exports.

The v1.0.1 groundwork already exists: `TypographySettings` with `fontSet`, `scale`,
`density`, and per-role `roles` (`TypoRole` × `TypoRoleStyle`), plus font-set classes on
`.page` (`.font-classic`/`.font-modern`). This plan (a) moves per-role styles onto the
**menu** (so they travel with the document), (b) **applies** them to the rendered page,
and (c) builds the four-section panel UI.

---

## 1. Model — per-menu typography  (`src/shared/types.ts`, `factories.ts`)

Add `Menu.typography?: MenuTypography` so type choices live in the `.menu` file:

```ts
export interface MenuTypography {
  fontSet?: 'griffin' | 'classic' | 'modern';
  roles?: Partial<Record<TypoRole, TypoRoleStyle>>;   // reuse the v1.0.1 types
}
```

`TypoRoleStyle` already has `size | weight | align | caps | spaceAbove | spaceBelow`;
extend with `font?` and `lineHeight?`, `letterSpacing?`, `minSize?`, `maxSize?` for the
Advanced section. New menus seed `menu.typography` from `settings.typography` defaults.

## 2. Apply to the page  (`src/shared/menu/render.ts`, `styles/menu.css`)

This is the piece v1.0.1 deferred. Emit **CSS custom properties** on the `.page` root from
`menu.typography.roles`, and have each role selector consume them with the current design
as the fallback:

```
.page { --title-size: 22px; --title-weight: 400; --title-align: center; --title-caps: uppercase; --title-sa: 0; --title-sb: 6px; /* …per role… */ }
.m-title { font-size: var(--title-size); font-weight: var(--title-weight); text-align: var(--title-align); text-transform: var(--title-caps); margin-top: var(--title-sa); margin-bottom: var(--title-sb); }
```

- `renderMenuHTML` builds the `--role-*` var block from `menu.typography.roles` (merged
  over `settings.typography` defaults) and inlines it on `.page`. Roles → selectors:
  `title→.m-title`, `section→.m-sech`, `dish→.m-nm`, `price→.m-pr`, `desc→.m-ds`,
  `key→.m-key`, `footer→.m-foot`.
- Establish the baseline `--role-*` values in `menu.css` first (so unset roles look exactly
  as they do today), then override via the emitted vars. Font choices resolve through the
  existing font-set classes plus a per-role `font-family` var.

## 3. Panel UI — four sections  (new `src/renderer/panels/typography-master.ts`, registered in `window-panels.ts`)

Follow `docs/typography-master-panel.md` exactly:

1. **Global** — Font set, Overall text size (→ `style.sc`), Density (→ `style.dn`). Reuse
   the v1.0.1 Settings controls.
2. **Roles list** — the seven roles, each an icon + name + a live preview of the current
   style, selected row highlighted. **Selecting text in the live preview auto-selects its
   role** (map `data-edit`/element class → role).
3. **Selected role** — Font, Size, Weight, Alignment, Capitalisation, Space above/below —
   editing updates every linked element in the live preview immediately (write to
   `menu.typography.roles[role]`, `commit(['preview'])`).
4. **Advanced** (collapsed) — line spacing, letter spacing, auto-fit, min/max size, wrap,
   print-readability.

The panel is a first-class **Panel** in the dockable system ([[plan-photoshop-panels]] /
`plan-photoshop-panels.md`): dockable, resizable, tabbable, floatable, with the menu page
always visible beside it. Calm/spacious styling; most-useful controls first, complexity in
Advanced.

## 4. Interactions
- Live two-way: click preview text → its role selects in the panel; edit a control → the
  preview updates instantly.
- Reset per role and "Reset all typography" (back to the font-set defaults).
- Font-set change re-seeds role fonts unless a role's font was explicitly overridden.

## 5. Export fidelity
The vars are on `.page`, so `preparePrintDOM` (which renders the same `.page`) and PDF/PNG
inherit typography automatically — no separate export path. Verify the print DOM carries
the `--role-*` vars.

## 6. Phases
1. Move per-role model onto `Menu.typography`; establish `--role-*` baselines in `menu.css`
   and emit vars from render → typography actually applies to the live menu + exports.
2. Typography Master panel sections 1–3 (Global, Roles, Selected role), docked.
3. Preview-selection ↔ role sync; per-role + all reset.
4. Advanced section (line/letter spacing, auto-fit, min/max, wrap).
5. Font-set-aware per-role font resolution + fonts bundled (Playfair/Inter if licensed;
   else curated system stacks).

## 7. Verify
Real app: change each role's size/weight/align/caps/spacing → the live menu updates and the
PDF/PNG match. Selecting a dish name in the preview highlights the Dish-name role. Reset
returns to defaults. `npm run typecheck` + `npm test`.

## Notes
- Bundling Playfair Display / Inter needs license check; otherwise the "Classic/Modern"
  sets use high-quality system fallbacks (as v1.0.1 does).
- Keep `settings.typography` as the *defaults*; `menu.typography` is the per-document truth.
