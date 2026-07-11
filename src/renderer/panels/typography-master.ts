// Typography Master — the full four-section panel body (docs/typography-master-panel.md).
//
// This module owns ALL of the Master's markup and interaction. It is intentionally
// self-contained: `renderTypographyMaster(host)` fills the dock host, wires its own
// delegated listeners on that host, and returns a disposer the dock runs on teardown.
// It does NOT reuse the delegated data-type-* handlers in window-panels.ts (those drive
// the old simple Typography panel), so every control here uses a private `data-tm-*`
// namespace that no other handler listens for.
//
// Model it reads/writes:
//   • Global  → menu.typography.fontSet, menu.style.sc, menu.style.dn
//   • Roles   → menu.typography.roles[role][field]  (size/weight/align/caps/
//               spaceAbove/spaceBelow/font, plus Advanced lineHeight/letterSpacing)
// The typography ENGINE (render.ts typographyVars + menu.css baselines) turns those into
// `--<role>-*` CSS vars on `.page`, so a commit(['preview']) makes the live menu and the
// in-panel previews update together. settings.typography supplies defaults only.

import type { Menu, MenuTypoRoleStyle, TypoRole } from '@shared/types';
import { BRAND_FONTS, SYSTEM_FONTS, fontByFamily } from '@shared/typography/font-catalog';
import { commit, currentMenu, getState, snapshot } from '../store';
import { escapeHtml as esc } from '../util/escape';

type FontSet = 'griffin' | 'classic' | 'modern';

interface RoleMeta {
  role: TypoRole;
  label: string;
  /** A small serif glyph shown as the row icon (calm, non-technical). */
  glyph: string;
}

const ROLES: RoleMeta[] = [
  { role: 'title', label: 'Menu title', glyph: 'T' },
  { role: 'section', label: 'Section header', glyph: 'S' },
  { role: 'dish', label: 'Dish name', glyph: 'D' },
  { role: 'price', label: 'Dish price', glyph: '£' },
  { role: 'desc', label: 'Dish description', glyph: 'd' },
  { role: 'key', label: 'Dietary key', glyph: 'k' },
  { role: 'footer', label: 'Footer', glyph: 'f' },
];

/** Fallback values shown in the "Selected role" controls when a field is unset.
 *  These are display defaults only — until the user drags a control nothing is
 *  written to the menu, so unset roles keep rendering from the menu.css baselines. */
const ROLE_DEFAULTS: Record<TypoRole, Required<Pick<MenuTypoRoleStyle, 'size' | 'weight' | 'align' | 'caps' | 'spaceAbove' | 'spaceBelow' | 'lineHeight' | 'letterSpacing'>>> = {
  title: { size: 30, weight: 400, align: 'center', caps: 'none', spaceAbove: 0, spaceBelow: 6, lineHeight: 1.3, letterSpacing: 0 },
  section: { size: 17, weight: 500, align: 'center', caps: 'none', spaceAbove: 0, spaceBelow: 8, lineHeight: 1.4, letterSpacing: 0 },
  dish: { size: 15, weight: 500, align: 'center', caps: 'none', spaceAbove: 0, spaceBelow: 0, lineHeight: 1.38, letterSpacing: 0 },
  price: { size: 15, weight: 500, align: 'center', caps: 'none', spaceAbove: 0, spaceBelow: 0, lineHeight: 1.38, letterSpacing: 0 },
  desc: { size: 13, weight: 300, align: 'center', caps: 'none', spaceAbove: 0, spaceBelow: 0, lineHeight: 1.38, letterSpacing: 0 },
  key: { size: 12, weight: 300, align: 'center', caps: 'none', spaceAbove: 0, spaceBelow: 0, lineHeight: 1.4, letterSpacing: 0 },
  footer: { size: 12, weight: 300, align: 'center', caps: 'none', spaceAbove: 0, spaceBelow: 0, lineHeight: 1.55, letterSpacing: 0 },
};

// The selected role + advanced-open state persist across re-mounts (menu switches,
// refreshDocks) so the panel feels stable while you work.
let selectedRole: TypoRole = 'dish';
let advancedOpen = false;

/* ------------------------------ model access ------------------------------ */

function activeFontSet(menu: Menu): FontSet {
  return (menu.typography?.fontSet ?? getState().settings.typography?.fontSet ?? 'griffin') as FontSet;
}

/** Effective (display) style for a role: menu override over settings default over the
 *  role's display fallback. Used only to seed control values + previews. */
function effRole(menu: Menu, role: TypoRole): MenuTypoRoleStyle {
  const def = getState().settings.typography?.roles?.[role] ?? {};
  const men = menu.typography?.roles?.[role] ?? {};
  return { ...ROLE_DEFAULTS[role], ...def, ...men };
}

/** The raw per-menu override for a role (what actually gets written/read back). */
function menuRole(menu: Menu, role: TypoRole): MenuTypoRoleStyle {
  return menu.typography?.roles?.[role] ?? {};
}

function ensureRole(menu: Menu, role: TypoRole): MenuTypoRoleStyle {
  const typo = (menu.typography = menu.typography ?? {});
  const roles = (typo.roles = typo.roles ?? {});
  return (roles[role] = roles[role] ?? {});
}

function densityKey(dn: number): 'compact' | 'balanced' | 'spacious' {
  if (dn <= 0.95) return 'compact';
  if (dn >= 1.08) return 'spacious';
  return 'balanced';
}
const DENSITY_DN: Record<'compact' | 'balanced' | 'spacious', number> = { compact: 0.9, balanced: 1, spacious: 1.15 };

/* -------------------------------- previews -------------------------------- */

interface Samples {
  title: string; section: string; dish: string; price: string; desc: string; key: string; footer: string;
}

function samplesFor(menu: Menu): Samples {
  const firstSec = menu.sections?.[0];
  const firstDish = (firstSec?.items ?? []).find((it) => !(it as { type?: string }).type) as
    | { name?: string; price?: string; desc?: string }
    | undefined;
  return {
    title: menu.name || 'Sunday Menu',
    section: firstSec?.name || 'To Start',
    dish: firstDish?.name || 'Roast Sirloin of Beef',
    price: firstDish?.price || '24',
    desc: firstDish?.desc || 'Yorkshire pudding, roast potatoes, seasonal greens',
    key: '(gf) gluten free   (v) vegetarian',
    footer: (menu.footer || '').split('\n')[0] || 'Please let us know of any allergies or intolerances',
  };
}

/** Inline style for a role's preview sample from its explicit overrides only, so a
 *  role with nothing set keeps the class-based (font-set) look of the .typo-<role>
 *  baseline used by the Settings card. */
function previewInline(st: MenuTypoRoleStyle): string {
  let s = '';
  if (st.size) s += `font-size:${st.size}px;`;
  if (st.weight) s += `font-weight:${st.weight};`;
  if (st.align) s += `text-align:${st.align};display:block;`;
  if (st.caps) s += `text-transform:${st.caps === 'upper' ? 'uppercase' : st.caps === 'title' ? 'capitalize' : 'none'};`;
  if (st.letterSpacing != null) s += `letter-spacing:${st.letterSpacing}px;`;
  if (st.lineHeight != null) s += `line-height:${st.lineHeight};`;
  const font = fontByFamily(st.font);
  if (font) s += `font-family:${font.stack};`;
  return s;
}

/* --------------------------------- markup --------------------------------- */

function opt(value: string, label: string, on: boolean): string {
  return `<option value="${esc(value)}" ${on ? 'selected' : ''}>${esc(label)}</option>`;
}

function fontOptions(cur?: string): string {
  const grp = (fonts: typeof BRAND_FONTS, label: string): string =>
    `<optgroup label="${label}">${fonts.map((f) => opt(f.family, f.label, cur === f.family)).join('')}</optgroup>`;
  return `${opt('', 'Default (from font set)', !cur)}${grp(BRAND_FONTS, 'Griffin fonts')}${grp(SYSTEM_FONTS, 'System fonts')}`;
}

function rolesListHtml(menu: Menu): string {
  const samples = samplesFor(menu);
  const fs = activeFontSet(menu);
  const rows = ROLES.map(({ role, label, glyph }) => {
    const st = menuRole(menu, role);
    const sel = role === selectedRole ? ' sel' : '';
    return `<button type="button" class="typo-role tm-role${sel}" data-tm-role="${role}" aria-pressed="${role === selectedRole}">
        <span class="tm-role-glyph" aria-hidden="true">${esc(glyph)}</span>
        <span class="typo-role-name">${esc(label)}</span>
        <span class="typo-sample typo-${role}" style="${previewInline(st)}">${esc(samples[role])}</span>
        <span class="typo-chev" aria-hidden="true">›</span>
      </button>`;
  }).join('');
  return `<div class="typo-roles tm-roles font-${fs}">${rows}</div>`;
}

function selectedRoleHtml(menu: Menu): string {
  const role = selectedRole;
  const label = ROLES.find((r) => r.role === role)!.label;
  const eff = effRole(menu, role);
  const raw = menuRole(menu, role);
  const size = eff.size ?? 15;
  const weight = eff.weight ?? 400;
  const align = eff.align ?? 'center';
  const caps = eff.caps ?? 'none';
  const sa = eff.spaceAbove ?? 0;
  const sb = eff.spaceBelow ?? 0;
  const wopt = (v: number, l: string): string => `<option value="${v}" ${weight === v ? 'selected' : ''}>${l}</option>`;
  const alignBtn = (v: string, ico: string): string =>
    `<button type="button" class="seg-btn ${align === v ? 'on' : ''}" data-tm-align="${v}" title="Align ${v}">${ico}</button>`;
  const capsBtn = (v: string, l: string): string =>
    `<button type="button" class="seg-btn ${caps === v ? 'on' : ''}" data-tm-caps="${v}">${l}</button>`;
  return `<div class="tm-ctrls">
      <label class="tm-field">Font
        <select data-tm-font>${fontOptions(raw.font)}</select>
      </label>
      <label class="tm-field">Size
        <span class="range-row"><input type="range" min="8" max="48" step="1" value="${size}" data-tm-field="size"><span class="range-val" data-tm-out="size">${size}px</span></span>
      </label>
      <label class="tm-field">Weight
        <select data-tm-weight>${wopt(300, 'Light')}${wopt(400, 'Regular')}${wopt(500, 'Medium')}${wopt(600, 'Semi Bold')}${wopt(700, 'Bold')}</select>
      </label>
      <div class="typo-ctrl-line"><span>Alignment</span><div class="seg">${alignBtn('left', '⟝')}${alignBtn('center', '≡')}${alignBtn('right', '⟞')}</div></div>
      <div class="typo-ctrl-line"><span>Capitalisation</span><div class="seg">${capsBtn('none', 'None')}${capsBtn('upper', 'UPPER')}${capsBtn('title', 'Title')}</div></div>
      <label class="tm-field">Space above
        <span class="range-row"><input type="range" min="0" max="48" step="1" value="${sa}" data-tm-field="spaceAbove"><span class="range-val" data-tm-out="spaceAbove">${sa}px</span></span>
      </label>
      <label class="tm-field">Space below
        <span class="range-row"><input type="range" min="0" max="48" step="1" value="${sb}" data-tm-field="spaceBelow"><span class="range-val" data-tm-out="spaceBelow">${sb}px</span></span>
      </label>
      <button type="button" class="dock-action tm-reset" data-tm-reset-role>Reset ${esc(label)}</button>
    </div>`;
}

function advancedHtml(menu: Menu): string {
  const role = selectedRole;
  const eff = effRole(menu, role);
  const lh = eff.lineHeight ?? 1.3;
  const ls = eff.letterSpacing ?? 0;
  return `<details class="tm-advanced" ${advancedOpen ? 'open' : ''}>
      <summary>Advanced</summary>
      <div class="tm-ctrls">
        <label class="tm-field">Line spacing
          <span class="range-row"><input type="range" min="1" max="2.2" step="0.05" value="${lh}" data-tm-field="lineHeight"><span class="range-val" data-tm-out="lineHeight">${lh.toFixed(2)}</span></span>
        </label>
        <label class="tm-field">Letter spacing
          <span class="range-row"><input type="range" min="-1" max="8" step="0.1" value="${ls}" data-tm-field="letterSpacing"><span class="range-val" data-tm-out="letterSpacing">${ls.toFixed(1)}px</span></span>
        </label>
        <p class="dock-note">Line &amp; letter spacing are stored on the role now; the page engine reads size, weight, alignment, caps, spacing and font today, and will pick these up when it consumes <code>--&lt;role&gt;-lh/ls</code>.</p>
      </div>
    </details>`;
}

function buildHtml(menu: Menu): string {
  const fs = activeFontSet(menu);
  const scPct = Math.round((menu.style.sc || 1) * 100);
  const dk = densityKey(menu.style.dn || 1);
  const densBtn = (v: 'compact' | 'balanced' | 'spacious', l: string): string =>
    `<button type="button" class="seg-btn ${dk === v ? 'on' : ''}" data-tm-density="${v}">${l}</button>`;
  const selLabel = ROLES.find((r) => r.role === selectedRole)!.label;
  return `<div class="tm-root">
      <section class="tm-section">
        <div class="tm-head"><span class="tm-step">1</span><b>Global</b></div>
        <label class="tm-field">Font set
          <select data-tm-fontset>${opt('griffin', 'Griffin — Aviano + Brandon', fs === 'griffin')}${opt('classic', 'Classic — Playfair + Inter', fs === 'classic')}${opt('modern', 'Modern — Clean Sans', fs === 'modern')}</select>
        </label>
        <label class="tm-field">Overall text size
          <span class="range-row"><input type="range" min="70" max="140" step="1" value="${scPct}" data-tm-sc><span class="range-val" data-tm-out="sc">${scPct}%</span></span>
        </label>
        <div class="tm-field"><span class="tm-field-label">Density</span><div class="seg">${densBtn('compact', 'Compact')}${densBtn('balanced', 'Balanced')}${densBtn('spacious', 'Spacious')}</div></div>
      </section>

      <section class="tm-section">
        <div class="tm-head"><span class="tm-step">2</span><b>Roles</b></div>
        ${rolesListHtml(menu)}
      </section>

      <section class="tm-section">
        <div class="tm-head"><span class="tm-step">3</span><b>Selected: ${esc(selLabel)}</b></div>
        ${selectedRoleHtml(menu)}
        ${advancedHtml(menu)}
        <button type="button" class="dock-action tm-reset-all" data-tm-reset-all>Reset all typography</button>
      </section>
    </div>`;
}

/* ------------------------------- interaction ------------------------------ */

/**
 * Fill `host` with the Typography Master and wire its interaction. Listeners are
 * delegated on `host`, so `rebuild()` (which just swaps innerHTML) never drops a
 * handler. Returns a disposer for the dock to run on teardown.
 */
export function renderTypographyMaster(host: HTMLElement): () => void {
  host.classList.add('typography-master');

  const menu0 = currentMenu();
  if (!menu0) {
    host.innerHTML = '<p class="dock-empty">Open a menu to adjust its typography.</p>';
    return () => {};
  }

  const rebuild = (): void => {
    const menu = currentMenu();
    if (!menu) {
      host.innerHTML = '<p class="dock-empty">Open a menu to adjust its typography.</p>';
      return;
    }
    host.innerHTML = buildHtml(menu);
  };
  rebuild();

  // One coalesced undo entry per interaction (a whole slider drag = one snapshot).
  let interacting = false;
  const ensureSnapshot = (): void => {
    if (!interacting) {
      snapshot();
      interacting = true;
    }
  };
  const endInteraction = (): void => {
    interacting = false;
  };

  /** Refresh the selected role's preview row + a range's output label in place,
   *  so a live drag updates without a full rebuild (which would lose the drag). */
  const refreshSelectedPreview = (menu: Menu): void => {
    const el = host.querySelector<HTMLElement>(`.tm-role[data-tm-role="${selectedRole}"] .typo-sample`);
    if (el) el.setAttribute('style', previewInline(menuRole(menu, selectedRole)));
  };

  const onInput = (e: Event): void => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const menu = currentMenu();
    if (!menu) return;

    // Overall text size (global)
    if (t instanceof HTMLInputElement && t.dataset.tmSc !== undefined) {
      ensureSnapshot();
      menu.style.sc = Number(t.value) / 100;
      const out = host.querySelector<HTMLElement>('[data-tm-out="sc"]');
      if (out) out.textContent = `${t.value}%`;
      commit(['preview']);
      return;
    }

    // Per-role numeric fields (size / spaceAbove / spaceBelow / lineHeight / letterSpacing)
    const field = (t as HTMLInputElement).dataset.tmField as keyof MenuTypoRoleStyle | undefined;
    if (field && t instanceof HTMLInputElement) {
      ensureSnapshot();
      const st = ensureRole(menu, selectedRole);
      const num = Number(t.value);
      (st as Record<string, unknown>)[field] = num;
      const out = host.querySelector<HTMLElement>(`[data-tm-out="${field}"]`);
      if (out) {
        out.textContent =
          field === 'lineHeight' ? num.toFixed(2) : field === 'letterSpacing' ? `${num.toFixed(1)}px` : `${num}px`;
      }
      refreshSelectedPreview(menu);
      commit(['preview']);
      return;
    }
  };

  const onChange = (e: Event): void => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const menu = currentMenu();
    if (!menu) return;

    // Font set (global) — role previews change font-family, so rebuild.
    if (t instanceof HTMLSelectElement && t.dataset.tmFontset !== undefined) {
      ensureSnapshot();
      const typo = (menu.typography = menu.typography ?? {});
      typo.fontSet = t.value as FontSet;
      commit(['preview', 'editor']);
      endInteraction();
      rebuild();
      return;
    }
    // Per-role font
    if (t instanceof HTMLSelectElement && t.dataset.tmFont !== undefined) {
      ensureSnapshot();
      const st = ensureRole(menu, selectedRole);
      if (t.value) st.font = t.value;
      else delete st.font;
      commit(['preview', 'editor']);
      endInteraction();
      refreshSelectedPreview(menu);
      return;
    }
    // Per-role weight
    if (t instanceof HTMLSelectElement && t.dataset.tmWeight !== undefined) {
      ensureSnapshot();
      ensureRole(menu, selectedRole).weight = Number(t.value);
      commit(['preview', 'editor']);
      endInteraction();
      refreshSelectedPreview(menu);
      return;
    }
    // A range drag ended — promote the coalesced edit to the editor scope too.
    if (t instanceof HTMLInputElement && (t.dataset.tmField !== undefined || t.dataset.tmSc !== undefined)) {
      commit(['preview', 'editor']);
      endInteraction();
      return;
    }
  };

  const onClick = (e: Event): void => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const menu = currentMenu();
    if (!menu) return;

    // Select a role row
    const roleBtn = t.closest<HTMLElement>('[data-tm-role]');
    if (roleBtn?.dataset.tmRole) {
      selectedRole = roleBtn.dataset.tmRole as TypoRole;
      rebuild();
      return;
    }
    // Density preset
    const densBtn = t.closest<HTMLElement>('[data-tm-density]');
    if (densBtn?.dataset.tmDensity) {
      snapshot();
      menu.style.dn = DENSITY_DN[densBtn.dataset.tmDensity as 'compact' | 'balanced' | 'spacious'];
      commit(['preview', 'editor']);
      rebuild();
      return;
    }
    // Alignment
    const alignBtn = t.closest<HTMLElement>('[data-tm-align]');
    if (alignBtn?.dataset.tmAlign) {
      snapshot();
      ensureRole(menu, selectedRole).align = alignBtn.dataset.tmAlign as MenuTypoRoleStyle['align'];
      commit(['preview', 'editor']);
      rebuild();
      return;
    }
    // Capitalisation
    const capsBtn = t.closest<HTMLElement>('[data-tm-caps]');
    if (capsBtn?.dataset.tmCaps) {
      snapshot();
      ensureRole(menu, selectedRole).caps = capsBtn.dataset.tmCaps as MenuTypoRoleStyle['caps'];
      commit(['preview', 'editor']);
      rebuild();
      return;
    }
    // Reset the selected role
    if (t.closest('[data-tm-reset-role]')) {
      snapshot();
      if (menu.typography?.roles) delete menu.typography.roles[selectedRole];
      commit(['preview', 'editor']);
      rebuild();
      return;
    }
    // Reset ALL typography (fontSet + every role) back to the font-set defaults
    if (t.closest('[data-tm-reset-all]')) {
      snapshot();
      delete menu.typography;
      commit(['preview', 'editor']);
      rebuild();
      return;
    }
  };

  const onToggle = (e: Event): void => {
    const t = e.target;
    if (t instanceof HTMLDetailsElement && t.classList.contains('tm-advanced')) {
      advancedOpen = t.open;
    }
  };

  // Two-way sync: clicking text in the live menu preview selects its role here.
  // Passive (never preventDefault) so inline editing in the preview is untouched.
  const onPreviewClick = (e: Event): void => {
    const el = e.target;
    if (!(el instanceof Element) || !el.closest('.page')) return;
    let hit: TypoRole | null = null;
    if (el.closest('.m-title')) hit = 'title';
    else if (el.closest('.m-sech')) hit = 'section';
    else if (el.closest('.m-pr')) hit = 'price';
    else if (el.closest('.m-nm')) hit = 'dish';
    else if (el.closest('.m-key')) hit = 'key';
    else if (el.closest('.m-foot')) hit = 'footer';
    else if (el.closest('.m-ds')) hit = 'desc';
    if (hit && hit !== selectedRole) {
      selectedRole = hit;
      rebuild();
    }
  };
  const pagewrap = document.getElementById('pagewrap');

  host.addEventListener('input', onInput);
  host.addEventListener('change', onChange);
  host.addEventListener('click', onClick);
  host.addEventListener('toggle', onToggle, true);
  pagewrap?.addEventListener('click', onPreviewClick);

  return () => {
    host.removeEventListener('input', onInput);
    host.removeEventListener('change', onChange);
    host.removeEventListener('click', onClick);
    host.removeEventListener('toggle', onToggle, true);
    pagewrap?.removeEventListener('click', onPreviewClick);
    host.classList.remove('typography-master');
  };
}
