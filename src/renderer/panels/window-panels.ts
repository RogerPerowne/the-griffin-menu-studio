// The app's floating tool windows, built on the Photoshop-style window manager
// in float-windows.ts. Eight intelligently-separated windows:
//   Menus · Dishes · Find & Reuse · Colour · Spacing · Typography · Dietary Key · Arrange
// Each window's body is plain HTML; all interaction is delegated on #floatLayer
// so re-rendering a body never drops a handler.

import type { Dish, Menu, Section, Tag } from '@shared/types';
import { newDish } from '@shared/menu/factories';
import {
  applyReplacementPreviews,
  findAcrossMenus,
  previewReplacements,
  type FindField,
  type FindResult,
  type ReplaceField,
  type ReplacePreview,
} from '@shared/menu/find-replace';
import { commit, currentMenu, getState, on, persist, snapshot } from '../store';
import { renderPreview } from '../views/preview';
import { toast } from '../ui/toast';
import { confirmDialog } from '../ui/confirm';
import { escapeHtml as esc } from '../util/escape';
import { getZoom } from '../layout-runtime';
import { RELEASE_DEFAULTS, applyReleaseSettings, releaseSettings } from '../layout-runtime';
import {
  initFloatLayer,
  isOpen,
  refreshWindow,
  registerFloatWindow,
  resetWindowLayout,
  restoreOpenWindows,
  toggleWindow,
} from './float-windows';

export type WindowPanel =
  | 'menus'
  | 'dishes'
  | 'finder'
  | 'colour'
  | 'spacing'
  | 'typography'
  | 'dietkey'
  | 'arrange';
type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'page-h' | 'page-v';

let finderResults: FindResult[] = [];
let reuseCache: Dish[] = [];
let replacePreviews: ReplacePreview[] = [];
let selectedMoveKey: string | null = null;

const SEARCH_FIELDS: Array<{ field: FindField; label: string }> = [
  { field: 'name', label: 'Dish names' },
  { field: 'desc', label: 'Descriptions' },
  { field: 'price', label: 'Prices' },
  { field: 'tags', label: 'Allergens' },
  { field: 'note', label: 'Notes' },
  { field: 'section', label: 'Sections' },
  { field: 'menu', label: 'Menus' },
];

const REPLACE_FIELDS: Array<{ field: ReplaceField; label: string }> = [
  { field: 'name', label: 'Name' },
  { field: 'desc', label: 'Description' },
  { field: 'price', label: 'Price' },
  { field: 'tags', label: 'Allergens' },
  { field: 'note', label: 'Notes' },
];

function isDish(item: unknown): item is Dish {
  return !!item && (item as { type?: string }).type !== 'rule';
}

function formatTags(tags: Tag[] = []): string {
  if (!tags.length) return '';
  return ` · ${tags.map((tag) => `${tag.c}${tag.r ? ' req' : ''}`).join(', ')}`;
}

function cloneDish(source: Dish): Dish {
  return newDish(source.name || '', source.desc || '', source.price || '', (source.tags || []).map((tag) => ({ ...tag })), source.note || '');
}

/* ============================ list windows ============================ */

function menuList(): string {
  const currentId = getState().currentMenuId;
  const rows = getState()
    .menus.map(
      (menu) =>
        `<button class="dock-row${menu.id === currentId ? ' on' : ''}" data-dock-menu="${esc(menu.id)}"><b>${esc(menu.name || 'Untitled menu')}</b><span>${esc(menu.date)} · ${menu.sections.length} section${menu.sections.length === 1 ? '' : 's'}</span></button>`,
    )
    .join('');
  return rows || '<p class="dock-empty">No menus yet. Create one from Home or File ▸ New.</p>';
}

function currentDishList(menu: Menu): string {
  if (!menu) return '<p class="dock-empty">Open a menu to see its dishes.</p>';
  return menu.sections
    .map((section) => {
      const dishes = section.items
        .filter(isDish)
        .map((dish) => `<div class="dock-dish"><b>${esc(dish.name || 'Untitled dish')}</b><span>${esc(dish.desc || section.name)}</span></div>`)
        .join('');
      return `<div class="dock-group"><h4>${esc(section.name)}</h4>${dishes || '<p class="dock-empty">No dishes yet.</p>'}</div>`;
    })
    .join('');
}

function collectReusableDishes(): Dish[] {
  const seen = new Map<string, Dish>();
  for (const menu of getState().menus) {
    for (const section of menu.sections) {
      for (const item of section.items) {
        if (!isDish(item)) continue;
        const key = `${item.name || ''}|${item.desc || ''}|${item.price || ''}`.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.set(key, item);
      }
    }
  }
  reuseCache = Array.from(seen.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return reuseCache;
}

function reusableDishList(): string {
  const dishes = collectReusableDishes();
  return (
    dishes
      .map((dish, i) => {
        const hay = `${dish.name || ''} ${dish.desc || ''} ${dish.price || ''}`.toLowerCase();
        return `<div class="finder-dish" draggable="true" data-reuse-index="${i}" data-dish-filter="${esc(hay)}">
          <b>${esc(dish.name || 'Untitled dish')}</b>
          <span>${esc(dish.desc || 'No description')}</span>
          <small>${esc(dish.price || 'No price')}${esc(formatTags(dish.tags))}</small>
        </div>`;
      })
      .join('') || '<p class="dock-empty">No dishes yet. Existing menu dishes appear here automatically.</p>'
  );
}

function searchFieldControls(): string {
  return SEARCH_FIELDS.map(
    ({ field, label }) => `<label><input type="checkbox" data-find-field="${field}" ${field === 'name' ? 'checked' : ''}> ${label}</label>`,
  ).join('');
}

function replaceFieldControls(): string {
  return REPLACE_FIELDS.map(
    ({ field, label }) => `<label><input type="checkbox" data-replace-field="${field}" ${field === 'name' ? 'checked' : ''}> ${label}</label>`,
  ).join('');
}

function findResultsHtml(): string {
  if (!finderResults.length) return '<p class="dock-empty">Search to see every matching dish across menus.</p>';
  return finderResults
    .map(
      (result) => `<label class="finder-result">
        <input type="checkbox" data-find-result="${esc(result.id)}" checked>
        <span>
          <b>${esc(result.menuName)}</b>
          <strong>${esc(result.sectionName)} · ${esc(result.dishName || 'Untitled dish')}</strong>
          <em>${esc(result.desc || 'No description')}</em>
          <small>${esc(result.price || 'No price')}${esc(formatTags(result.tags))} · matched ${esc(result.matchedFields.join(', '))}</small>
        </span>
      </label>`,
    )
    .join('');
}

function replacePreviewHtml(): string {
  if (!replacePreviews.length) return '<p class="dock-empty">Create a review to preview replacements before applying them.</p>';
  return replacePreviews
    .map(
      (preview, index) => `<label class="replace-preview">
        <input type="checkbox" data-replace-preview="${index}" checked>
        <span>
          <b>${esc(preview.menuName)} · ${esc(preview.sectionName)}</b>
          <strong>${esc(preview.field)} on ${esc(preview.dishName || 'Untitled dish')}</strong>
          <em>Before: ${esc(preview.before || '(empty)')}</em>
          <em>After: ${esc(preview.after || '(empty)')}</em>
        </span>
      </label>`,
    )
    .join('');
}

function finderBody(): string {
  return `<div class="finder-tabs">
      <section>
        <h4>Reuse from another menu</h4>
        <input class="dock-search" id="reuseSearch" placeholder="Search reusable dishes">
        <p class="dock-note">Drag a dish onto a section in the editor to copy it in.</p>
        <div class="finder-list" id="reuseList">${reusableDishList()}</div>
      </section>
      <section>
        <h4>Find across menus</h4>
        <input class="dock-search" id="findMenusQuery" placeholder="Find dish text across menus">
        <div class="finder-checks">${searchFieldControls()}</div>
        <button class="dock-action" data-find-run>Find matches</button>
        <div class="finder-list" id="findResults">${findResultsHtml()}</div>
      </section>
      <section>
        <h4>Replace selected</h4>
        <input class="dock-search" id="replaceWith" placeholder="Replace with">
        <div class="finder-checks">${replaceFieldControls()}</div>
        <label class="finder-inline"><input type="checkbox" id="replaceMatchingText"> Replace matching text inside field</label>
        <button class="dock-action" data-replace-review>Review changes</button>
        <div class="finder-list" id="replacePreviews">${replacePreviewHtml()}</div>
        <button class="dock-action primary" data-replace-apply ${replacePreviews.length ? '' : 'disabled'}>Apply selected changes</button>
      </section>
    </div>`;
}

/* ======================= colour / spacing / type ======================= */

function colourBody(): string {
  const s = getState().settings;
  return `<div class="tool-form">
      <label class="tool-colour">
        <span>Preview paper</span>
        <input type="color" data-blush value="${esc(s.blush || '#F5E4DF')}">
      </label>
      <p class="dock-note">The blush tint is preview only — printed, PDF and PNG output always use a white page, because you print onto pre-printed stock.</p>
      <button class="dock-action" data-blush-reset>Reset to Griffin blush</button>
    </div>`;
}

interface SliderRow {
  key: keyof typeof RELEASE_DEFAULTS;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}

const SPACING_ROWS: SliderRow[] = [
  { key: 'sectionGap', label: 'Section spacing', hint: 'Gap above each section', min: 60, max: 150, step: 5 },
  { key: 'dishGap', label: 'Dish line spacing', hint: 'Gap between dishes', min: 70, max: 145, step: 5 },
  { key: 'footerGap', label: 'Footer breathing room', hint: 'Space above the footer', min: 50, max: 180, step: 5 },
  { key: 'innerRule', label: 'Between-section line', hint: 'Width of inner divider lines', min: 15, max: 75, step: 1 },
  { key: 'edgeRule', label: 'Top / bottom line', hint: 'Width of the framing rules', min: 60, max: 98, step: 1 },
  { key: 'colDivider', label: 'Column divider length', hint: 'Length of vertical column rules', min: 40, max: 100, step: 2 },
];

function spacingBody(): string {
  const x = releaseSettings();
  const rows = SPACING_ROWS.map(
    (r) => `<label class="tool-slider">
      <span class="tool-slider-head"><b>${r.label}</b><output data-spacing-out="${r.key}">${x[r.key]}%</output></span>
      <input type="range" data-spacing="${r.key}" min="${r.min}" max="${r.max}" step="${r.step}" value="${x[r.key]}">
      <small>${r.hint}</small>
    </label>`,
  ).join('');
  return `<div class="tool-form">${rows}<button class="dock-action" data-spacing-reset>Reset layout defaults</button>
    <p class="dock-note">These affect print and export geometry. Watch the fit warning in the editor as you adjust.</p></div>`;
}

function typographyBody(): string {
  const menu = currentMenu();
  if (!menu) return '<p class="dock-empty">Open a menu to adjust its typography.</p>';
  const st = menu.style;
  const sc = Math.round((st.sc || 1) * 100);
  const dn = Math.round((st.dn || 1) * 100);
  const opt = (val: string, cur: string, label: string): string => `<option value="${val}" ${cur === val ? 'selected' : ''}>${label}</option>`;
  return `<div class="tool-form">
      <label class="tool-field"><span>Header style</span>
        <select data-type-header>${opt('title', st.header, 'Title only')}${opt('crest', st.header, 'Crest + title')}${opt('lockup', st.header, 'Full lockup')}</select></label>
      <label class="tool-slider">
        <span class="tool-slider-head"><b>Text size</b><output data-type-out="sc">${sc}%</output></span>
        <input type="range" data-type-sc min="80" max="120" step="1" value="${sc}">
        <small>Overall menu font size</small>
      </label>
      <label class="tool-slider">
        <span class="tool-slider-head"><b>Line spacing</b><output data-type-out="dn">${dn}%</output></span>
        <input type="range" data-type-dn min="80" max="130" step="1" value="${dn}">
        <small>Vertical density between lines</small>
      </label>
      <label class="tool-check"><input type="checkbox" data-type-showkey ${st.showKey ? 'checked' : ''}> Show dietary key on the menu</label>
      <button class="dock-action" data-type-reset>Reset text size &amp; spacing</button>
      <p class="dock-note">Text size and spacing also change when you use Shrink to fit.</p>
    </div>`;
}

const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function dietkeyBody(): string {
  const rows = getState()
    .settings.dietKey.map(
      (k, i) => `<div class="keyrow">
        <input class="kc" data-dk-i="${i}" data-dk-f="c" value="${esc(k.c)}" maxlength="4" aria-label="Code" placeholder="v">
        <input class="kl" data-dk-i="${i}" data-dk-f="l" value="${esc(k.l)}" aria-label="Meaning" placeholder="label, e.g. vegetarian">
        <button class="iconb danger" data-dk-del="${i}" title="Remove code" aria-label="Remove code">${ICON_X}</button>
      </div>`,
    )
    .join('');
  return `<div class="tool-form">
      <div class="keyrows">${rows || '<p class="dock-empty">No dietary codes yet.</p>'}</div>
      <button class="dock-action" data-dk-add>+ Add code</button>
      <p class="dock-note">Codes appear beside dishes and in the printed key. "req" flags a required allergen.</p>
    </div>`;
}

/* ============================== arrange ============================== */

function arrangeBody(): string {
  return `<div class="tool-form">
      <button class="dock-action" data-cmd="arrange-toggle">Toggle Arrange mode</button>
      <p class="dock-note">Turn Arrange on, click a title, logo, line or text block, then align it.</p>
      <div class="arrange-grid">
        <button data-align="left" title="Align left">⊢</button><button data-align="center" title="Centre horizontally">⊟</button><button data-align="right" title="Align right">⊣</button>
        <button data-align="top" title="Align top">⊤</button><button data-align="middle" title="Centre vertically">⊞</button><button data-align="bottom" title="Align bottom">⊥</button>
      </div>
      <div class="arrange-page-row">
        <button class="dock-action" data-align="page-h">Centre on page — across</button>
        <button class="dock-action" data-align="page-v">Centre on page — down</button>
      </div>
      <button class="dock-action" data-cmd="reset-all-positions">Reset all positions</button>
    </div>`;
}

/* ============================ registration ============================ */

const I = {
  menus: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  dishes: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  finder: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 5 5"/></svg>',
  colour: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.4"/><circle cx="15" cy="9" r="1.4"/><circle cx="9.5" cy="15" r="1.4"/></svg>',
  spacing: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/><path d="M2 4v4M2 16v4"/></svg>',
  typography: '<svg viewBox="0 0 24 24"><path d="M4 7V5h16v2M9 5v14M7 19h4"/></svg>',
  dietkey: '<svg viewBox="0 0 24 24"><path d="M12 2s6 3 6 9-6 11-6 11-6-5-6-11 6-9 6-9Z"/></svg>',
  arrange: '<svg viewBox="0 0 24 24"><path d="M4 7h16M7 4v6M17 4v6M8 17h8M12 14v6"/></svg>',
};

function registerAll(): void {
  registerFloatWindow({ id: 'menus', title: 'Menus', icon: I.menus, defaultW: 260, defaultH: 320, body: menuList });
  registerFloatWindow({ id: 'dishes', title: 'Dishes', icon: I.dishes, defaultW: 280, defaultH: 360, body: () => currentDishList(currentMenu()) });
  registerFloatWindow({ id: 'finder', title: 'Find & Reuse', icon: I.finder, defaultW: 340, defaultH: 460, minW: 300, body: finderBody });
  registerFloatWindow({ id: 'colour', title: 'Colour', icon: I.colour, defaultW: 260, defaultH: 220, body: colourBody });
  registerFloatWindow({ id: 'spacing', title: 'Spacing & Layout', icon: I.spacing, defaultW: 290, defaultH: 420, body: spacingBody });
  registerFloatWindow({ id: 'typography', title: 'Typography', icon: I.typography, defaultW: 280, defaultH: 340, body: typographyBody });
  registerFloatWindow({ id: 'dietkey', title: 'Dietary Key', icon: I.dietkey, defaultW: 300, defaultH: 320, body: dietkeyBody });
  registerFloatWindow({ id: 'arrange', title: 'Arrange', icon: I.arrange, defaultW: 250, defaultH: 300, body: arrangeBody });
}

export function toggleWindowPanel(panel: WindowPanel): void {
  toggleWindow(panel);
}

export function isPanelOpen(panel: WindowPanel): boolean {
  return isOpen(panel);
}

export function resetFloatWindows(): void {
  resetWindowLayout();
}

/* ============================ interactions ============================ */

function selectedMoveBlock(): HTMLElement | null {
  if (!selectedMoveKey) return null;
  return document.querySelector<HTMLElement>(`.movable[data-move="${CSS.escape(selectedMoveKey)}"]`);
}

export function alignSelectedMove(mode: AlignMode): void {
  const block = selectedMoveBlock();
  const page = block?.closest<HTMLElement>('.page');
  if (!block || !page) {
    toast('Turn Arrange on, then click a title, logo, line or text block to select it.', { kind: 'info' });
    return;
  }
  const key = block.dataset.move;
  if (!key) return;
  const zoom = getZoom();
  const blockRect = block.getBoundingClientRect();
  const pageRect = page.getBoundingClientRect();
  const menu = currentMenu();
  const pos = menu.pos ?? (menu.pos = {});
  const cur = pos[key] ?? { x: 0, y: 0 };
  let dx = 0;
  let dy = 0;
  if (mode === 'left') dx = (pageRect.left + 32 - blockRect.left) / zoom;
  if (mode === 'center' || mode === 'page-h') dx = (pageRect.left + pageRect.width / 2 - (blockRect.left + blockRect.width / 2)) / zoom;
  if (mode === 'right') dx = (pageRect.right - 32 - blockRect.right) / zoom;
  if (mode === 'top') dy = (pageRect.top + 32 - blockRect.top) / zoom;
  if (mode === 'middle' || mode === 'page-v') dy = (pageRect.top + pageRect.height / 2 - (blockRect.top + blockRect.height / 2)) / zoom;
  if (mode === 'bottom') dy = (pageRect.bottom - 32 - blockRect.bottom) / zoom;
  snapshot();
  pos[key] = { x: Math.round(cur.x + dx), y: Math.round(cur.y + dy) };
  commit(['preview']);
}

export function resetSelectedMove(): void {
  const block = selectedMoveBlock();
  if (!block?.dataset.move) {
    toast('Turn Arrange on, then click a title, logo, line or text block to select it.', { kind: 'info' });
    return;
  }
  const menu = currentMenu();
  if (!menu.pos?.[block.dataset.move]) return;
  snapshot();
  delete menu.pos[block.dataset.move];
  commit(['preview']);
}

function selectedFindFields(root: ParentNode): FindField[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('[data-find-field]:checked')).map((input) => input.dataset.findField as FindField);
}

function selectedReplaceFields(root: ParentNode): ReplaceField[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('[data-replace-field]:checked')).map((input) => input.dataset.replaceField as ReplaceField);
}

function selectedResultIds(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('[data-find-result]:checked')).map((input) => input.dataset.findResult || '');
}

function runFind(root: ParentNode): void {
  const query = root.querySelector<HTMLInputElement>('#findMenusQuery')?.value ?? '';
  finderResults = findAcrossMenus(getState(), { query, fields: selectedFindFields(root) });
  replacePreviews = [];
  refreshWindow('finder');
}

function reviewReplace(root: ParentNode): void {
  const query = root.querySelector<HTMLInputElement>('#findMenusQuery')?.value ?? '';
  const replacement = root.querySelector<HTMLInputElement>('#replaceWith')?.value ?? '';
  replacePreviews = previewReplacements(
    getState(),
    finderResults,
    { query, fields: selectedFindFields(root) },
    {
      resultIds: selectedResultIds(root),
      fields: selectedReplaceFields(root),
      replacement,
      mode: root.querySelector<HTMLInputElement>('#replaceMatchingText')?.checked ? 'matching-text' : 'whole-field',
    },
  );
  refreshWindow('finder');
}

async function applyReviewedReplace(root: ParentNode): Promise<void> {
  const selected = new Set(
    Array.from(root.querySelectorAll<HTMLInputElement>('[data-replace-preview]:checked')).map((input) => Number(input.dataset.replacePreview)),
  );
  const previews = replacePreviews.filter((_, index) => selected.has(index));
  if (!previews.length) return;
  const ok = await confirmDialog({
    title: `Apply ${previews.length} change${previews.length === 1 ? '' : 's'}?`,
    body: 'The selected replacements will be applied across your menus. You can undo this afterwards.',
    confirmLabel: 'Apply changes',
  });
  if (!ok) return;
  snapshot();
  const count = applyReplacementPreviews(getState(), previews);
  replacePreviews = [];
  commit(['all']);
  toast(`Applied ${count} change${count === 1 ? '' : 's'} across your menus.`, { kind: 'success' });
}

function handleDragStart(e: DragEvent): void {
  const dishEl = (e.target as Element)?.closest?.<HTMLElement>('[data-reuse-index]');
  if (!dishEl || !e.dataTransfer) return;
  e.dataTransfer.setData('application/x-griffin-dish-index', dishEl.dataset.reuseIndex || '');
  e.dataTransfer.effectAllowed = 'copy';
}

function handleDragOver(e: DragEvent): void {
  if ((e.target as Element)?.closest?.('.items')) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }
}

function handleDrop(e: DragEvent): void {
  const items = (e.target as Element)?.closest?.<HTMLElement>('.items');
  if (!items || !e.dataTransfer) return;
  const index = Number(e.dataTransfer.getData('application/x-griffin-dish-index'));
  const source = reuseCache[index];
  if (!source) return;
  const section = currentMenu().sections.find((s: Section) => s.id === items.dataset.sid);
  if (!section) return;
  e.preventDefault();
  const dish = cloneDish(source);
  dish.col = Number(items.dataset.col) || 0;
  snapshot();
  section.items.push(dish);
  commit(['all']);
  toast(`Copied “${dish.name || 'dish'}” into ${section.name}.`, { kind: 'success' });
}

function handleMoveSelection(e: MouseEvent): void {
  if (!document.body.classList.contains('moveMode')) return;
  const block = (e.target as Element)?.closest?.<HTMLElement>('.movable[data-move]');
  if (!block) return;
  selectedMoveKey = block.dataset.move || null;
  document.querySelectorAll('.movable.selected-move').forEach((el) => el.classList.remove('selected-move'));
  block.classList.add('selected-move');
}

/* ---- delegated handlers on the float layer ---- */

function onLayerClick(e: MouseEvent): void {
  const t = e.target;
  if (!(t instanceof Element)) return;

  const menuRow = t.closest<HTMLElement>('[data-dock-menu]');
  if (menuRow?.dataset.dockMenu) {
    getState().currentMenuId = menuRow.dataset.dockMenu;
    commit(['all']);
    return;
  }
  const align = t.closest<HTMLElement>('[data-align]');
  if (align?.dataset.align) {
    alignSelectedMove(align.dataset.align as AlignMode);
    return;
  }
  if (t.closest('[data-find-run]')) return runFind(document);
  if (t.closest('[data-replace-review]')) return reviewReplace(document);
  if (t.closest('[data-replace-apply]')) { void applyReviewedReplace(document); return; }

  if (t.closest('[data-blush-reset]')) {
    getState().settings.blush = '#F5E4DF';
    document.documentElement.style.setProperty('--blush', '#F5E4DF');
    persist();
    refreshWindow('colour');
    return;
  }
  if (t.closest('[data-spacing-reset]')) {
    getState().settings.layout = { ...RELEASE_DEFAULTS };
    applyReleaseSettings();
    persist();
    refreshWindow('spacing');
    renderPreview();
    return;
  }
  if (t.closest('[data-type-reset]')) {
    const st = currentMenu().style;
    st.sc = 1;
    st.dn = 1;
    commit(['preview']);
    refreshWindow('typography');
    return;
  }
  const dkDel = t.closest<HTMLElement>('[data-dk-del]');
  if (dkDel?.dataset.dkDel) {
    snapshot();
    getState().settings.dietKey.splice(Number(dkDel.dataset.dkDel), 1);
    commit(['editor', 'preview']);
    refreshWindow('dietkey');
    return;
  }
  if (t.closest('[data-dk-add]')) {
    snapshot();
    getState().settings.dietKey.push({ c: '', l: '' });
    commit(['editor']);
    refreshWindow('dietkey');
    return;
  }
}

function onLayerInput(e: Event): void {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;

  if (t instanceof HTMLInputElement && t.id === 'reuseSearch') {
    const q = t.value.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>('#reuseList [data-dish-filter]').forEach((row) => {
      row.hidden = !!q && !(row.dataset.dishFilter || '').includes(q);
    });
    return;
  }
  // Preview paper colour
  if (t instanceof HTMLInputElement && t.dataset.blush !== undefined) {
    getState().settings.blush = t.value;
    document.documentElement.style.setProperty('--blush', t.value);
    return;
  }
  // Spacing sliders
  const spacingKey = (t as HTMLInputElement).dataset.spacing as keyof typeof RELEASE_DEFAULTS | undefined;
  if (spacingKey) {
    const x = releaseSettings();
    x[spacingKey] = Number((t as HTMLInputElement).value);
    const out = document.querySelector<HTMLOutputElement>(`[data-spacing-out="${spacingKey}"]`);
    if (out) out.textContent = `${x[spacingKey]}%`;
    applyReleaseSettings();
    renderPreview();
    return;
  }
  // Typography controls
  if (t.dataset.typeHeader !== undefined && t instanceof HTMLSelectElement) {
    currentMenu().style.header = t.value as Menu['style']['header'];
    commit(['all']);
    return;
  }
  if (t.dataset.typeSc !== undefined && t instanceof HTMLInputElement) {
    currentMenu().style.sc = Number(t.value) / 100;
    const out = document.querySelector<HTMLOutputElement>('[data-type-out="sc"]');
    if (out) out.textContent = `${t.value}%`;
    commit(['preview']);
    return;
  }
  if (t.dataset.typeDn !== undefined && t instanceof HTMLInputElement) {
    currentMenu().style.dn = Number(t.value) / 100;
    const out = document.querySelector<HTMLOutputElement>('[data-type-out="dn"]');
    if (out) out.textContent = `${t.value}%`;
    commit(['preview']);
    return;
  }
  if (t.dataset.typeShowkey !== undefined && t instanceof HTMLInputElement) {
    currentMenu().style.showKey = t.checked;
    commit(['all']);
    return;
  }
  // Dietary key text
  const dkI = (t as HTMLInputElement).dataset.dkI;
  const dkF = (t as HTMLInputElement).dataset.dkF;
  if (dkI !== undefined && (dkF === 'c' || dkF === 'l')) {
    const entry = getState().settings.dietKey[Number(dkI)];
    if (entry) {
      entry[dkF] = (t as HTMLInputElement).value.trim();
      commit(['preview']);
    }
  }
}

function onLayerChange(e: Event): void {
  const t = e.target;
  if (t instanceof HTMLInputElement && (t.dataset.spacing !== undefined || t.dataset.blush !== undefined)) persist();
  // Dietary key code/label edits only debounce a 'preview' commit on input (see
  // onLayerInput) so the focused field survives keystrokes. 'change' fires once
  // the field is committed (blur, or Enter) — refresh 'editor' too so the
  // per-dish tag buttons stop carrying a stale/blank data-tag (#1).
  if (t instanceof HTMLInputElement && t.dataset.dkI !== undefined && (t.dataset.dkF === 'c' || t.dataset.dkF === 'l')) {
    commit(['editor', 'preview']);
  }
}

export function initWindowPanels(): void {
  initFloatLayer();
  registerAll();

  const layerEl = document.getElementById('floatLayer');
  layerEl?.addEventListener('click', onLayerClick);
  layerEl?.addEventListener('input', onLayerInput);
  layerEl?.addEventListener('change', onLayerChange);

  document.addEventListener('dragstart', handleDragStart);
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('drop', handleDrop);
  document.getElementById('pagewrap')?.addEventListener('click', handleMoveSelection, true);

  // Keep data-driven windows current when the library/menu changes.
  on('rail', () => {
    if (isOpen('menus')) refreshWindow('menus');
  });
  on('all', () => {
    if (isOpen('dishes')) refreshWindow('dishes');
    if (isOpen('finder')) refreshWindow('finder');
    if (isOpen('typography')) refreshWindow('typography');
    if (isOpen('colour')) refreshWindow('colour');
  });

  restoreOpenWindows();
}
