import type { DietKey, Dish, Menu, MenuStyle, Tag, Template } from '@shared/types';
import { newDish, newMenu, newRule, newSection, T } from '@shared/menu/factories';
import { normaliseMenuColumns } from '@shared/menu/normalize';
import { renderMenuHTML } from '@shared/menu/render';
import { getActiveBrand } from '@shared/brand';
import { combineTemplates } from '@shared/templates/builtins';
import { assetUrl } from '../brand-assets';
import { commit, currentMenu, getState, on, persist, snapshot } from '../store';
import { fmtDate } from '../views/rail';
import { preparePrintDOM } from '../views/preview';
import { EXPORT_STAGE, fitPage, getZoom, scheduleRulers, setFollowFit, setZoom } from '../layout-runtime';
import { toast } from '../ui/toast';
import { confirmDialog } from '../ui/confirm';
import type { RecoverySummary } from '@shared/api';
import { escapeHtml as esc } from '../util/escape';
import { trapFocus } from '../util/focus-trap';
import { confirmDocumentTransition } from '../document-session';
import { renderUpdatesCard } from '../features/update-ui';

export type Workspace = 'home' | 'editor' | 'export';

type HomePane = 'open' | 'new' | 'dishes' | 'settings';
type ExportPane = 'print' | 'pdf' | 'png' | 'save';

let current: Workspace = 'home';
let homePane: HomePane = 'open';
let exportPane: ExportPane = 'print';
let exportLastMenuId: string | null = null;
let recoverySnapshots: RecoverySummary[] = [];

/** Called at boot with crash-recovery snapshots to surface as a modal dialog. */
export function setRecoverySnapshots(list: RecoverySummary[]): void {
  recoverySnapshots = list;
  showRecoveryDialog();
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

type TypoRoleKey = 'title' | 'section' | 'dish' | 'price' | 'desc' | 'key' | 'footer';
let selectedTypoRole: TypoRoleKey = 'dish';

const TYPO_ROLE_LABELS: Record<TypoRoleKey, string> = {
  title: 'Menu title', section: 'Section header', dish: 'Dish name', price: 'Dish price',
  desc: 'Dish description', key: 'Dietary key', footer: 'Footer',
};
const TYPO_ROLE_DEFAULT_SIZE: Record<TypoRoleKey, number> = { title: 22, section: 14, dish: 15, price: 15, desc: 13, key: 12, footer: 11 };

function roleStyle(role: TypoRoleKey): import('@shared/types').TypoRoleStyle {
  return getState().settings.typography?.roles?.[role] ?? {};
}

function setRoleStyle(prop: string, value: string | number): void {
  const t = (getState().settings.typography = getState().settings.typography ?? {});
  const roles = (t.roles = t.roles ?? {});
  const st = (roles[selectedTypoRole] = roles[selectedTypoRole] ?? {});
  (st as Record<string, unknown>)[prop] = value;
  commit(['preview']);
}

/** Inline style for a role preview sample from its persisted overrides. */
function roleInline(st: import('@shared/types').TypoRoleStyle): string {
  let s = '';
  if (st.size) s += `font-size:${st.size}px;`;
  if (st.weight) s += `font-weight:${st.weight};`;
  if (st.align) s += `text-align:${st.align};display:block;`;
  if (st.caps) s += `text-transform:${st.caps === 'upper' ? 'uppercase' : st.caps === 'title' ? 'capitalize' : 'none'};`;
  return s;
}

/** One selectable row in the roles list (name + live sample in the font set). */
function typoRole(role: TypoRoleKey, sample: string): string {
  const st = roleStyle(role);
  const sel = role === selectedTypoRole ? ' sel' : '';
  return `<button type="button" class="typo-role${sel}" data-typo-role="${role}"><span class="typo-role-name">${esc(TYPO_ROLE_LABELS[role])}</span><span class="typo-sample typo-${role}" style="${roleInline(st)}">${esc(sample)}</span><span class="typo-chev">›</span></button>`;
}

/** The "Selected role" controls (mockup section 3) for the chosen role. */
function typoRoleControls(): string {
  const role = selectedTypoRole;
  const st = roleStyle(role);
  const size = st.size ?? TYPO_ROLE_DEFAULT_SIZE[role];
  const weight = st.weight ?? 400;
  const align = st.align ?? 'left';
  const caps = st.caps ?? 'none';
  const wopt = (v: number, l: string): string => `<option value="${v}" ${weight === v ? 'selected' : ''}>${l}</option>`;
  const alignBtn = (v: string, ico: string): string => `<button type="button" class="seg-btn ${align === v ? 'on' : ''}" data-typo-align="${v}" title="${v}">${ico}</button>`;
  const capsBtn = (v: string, l: string): string => `<button type="button" class="seg-btn ${caps === v ? 'on' : ''}" data-typo-caps="${v}">${l}</button>`;
  return `<div class="typo-block"><span class="typo-step">3</span><b>Selected: ${esc(TYPO_ROLE_LABELS[role])}</b></div>
    <div class="typo-ctrls">
      <label>Size <span class="range-row"><input type="range" min="8" max="40" value="${size}" data-typo-ctrl="size"><span class="range-val" data-typo-ctrl-val="size">${size}px</span></span></label>
      <label>Weight <select data-typo-ctrl="weight">${wopt(400, 'Regular')}${wopt(500, 'Medium')}${wopt(600, 'Semi Bold')}${wopt(700, 'Bold')}</select></label>
      <div class="typo-ctrl-line"><span>Alignment</span><div class="seg">${alignBtn('left', '⟝')}${alignBtn('center', '≡')}${alignBtn('right', '⟞')}</div></div>
      <div class="typo-ctrl-line"><span>Capitalisation</span><div class="seg">${capsBtn('none', 'None')}${capsBtn('upper', 'UPPER')}${capsBtn('title', 'Title')}</div></div>
      <button type="button" class="abtn typo-reset" data-typo-reset>Reset ${esc(TYPO_ROLE_LABELS[role])}</button>
    </div>`;
}

let recoveryOverlay: HTMLElement | null = null;

function recoveryItemsHtml(): string {
  return recoverySnapshots
    .map(
      (s) => `<div class="recovery-item">
        <span class="recovery-info"><b>${esc(s.documentName || 'Untitled menu')}</b><small>${esc(s.documentPath || 'Not yet saved to a file')} · ${esc(fmtTimestamp(s.createdAt))}</small></span>
        <span class="recovery-actions"><button class="abtn primary" data-recovery-restore="${esc(s.id)}">Restore</button><button class="abtn" data-recovery-discard="${esc(s.id)}">Discard</button></span>
      </div>`,
    )
    .join('');
}

function closeRecoveryDialog(): void {
  if (!recoveryOverlay) return;
  window.removeEventListener('keydown', onRecoveryKey, true);
  recoveryOverlay.remove();
  recoveryOverlay = null;
}

/** Refresh the open dialog after an action; close it once nothing is left. */
function refreshRecoveryDialog(): void {
  if (!recoverySnapshots.length) {
    closeRecoveryDialog();
    return;
  }
  const list = recoveryOverlay?.querySelector('#recoveryModalList');
  if (list) list.innerHTML = recoveryItemsHtml();
}

function onRecoveryKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeRecoveryDialog();
  }
}

/** Surface crash-recovered work as a centred, focus-trapped modal on Home. */
function showRecoveryDialog(): void {
  if (recoveryOverlay || !recoverySnapshots.length) return;
  const root = document.createElement('div');
  root.className = 'recovery-overlay';
  root.innerHTML = `<div class="recovery-modal" role="alertdialog" aria-modal="true" aria-labelledby="recoveryTitle" aria-describedby="recoveryDesc">
      <div class="recovery-modal-head">
        <span class="recovery-modal-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg></span>
        <div><h2 id="recoveryTitle">Recover your work</h2><p id="recoveryDesc">Griffin closed unexpectedly last time. Restore a menu to pick up where you left off, or discard it.</p></div>
      </div>
      <div class="recovery-modal-list" id="recoveryModalList">${recoveryItemsHtml()}</div>
      <div class="recovery-modal-foot"><button class="abtn" type="button" data-recovery-close>Not now</button></div>
    </div>`;
  document.body.appendChild(root);
  recoveryOverlay = root;

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target === root || target.closest('[data-recovery-close]')) {
      closeRecoveryDialog();
      return;
    }
    const restore = target.closest<HTMLElement>('[data-recovery-restore]');
    if (restore?.dataset.recoveryRestore) {
      void restoreRecovery(restore.dataset.recoveryRestore);
      return;
    }
    const discard = target.closest<HTMLElement>('[data-recovery-discard]');
    if (discard?.dataset.recoveryDiscard) {
      void discardRecovery(discard.dataset.recoveryDiscard);
    }
  });
  window.addEventListener('keydown', onRecoveryKey, true);
  root.querySelector<HTMLButtonElement>('.recovery-modal .abtn.primary')?.focus();
}

const THUMB_BOX_PX = 176;
const THUMB_BOX_HEIGHT_PX = (THUMB_BOX_PX * 297) / 210;
const MM_TO_PX = 3.7795;

const SAMPLE_DISHES: { name: string; desc: string; price: string; tags: Tag[] }[] = [
  { name: 'Heritage Tomato', desc: 'basil, aged balsamic', price: '9', tags: [T('ve'), T('gf')] },
  { name: 'Chicken Parfait', desc: 'toasted brioche, chutney', price: '10', tags: [T('gf', 1)] },
  { name: 'Roast Cod', desc: 'brown shrimp butter, greens', price: '24', tags: [T('gf')] },
  { name: 'Rump of Lamb', desc: 'dauphinoise, red wine jus', price: '28', tags: [T('gf')] },
  { name: 'Sticky Toffee', desc: 'caramel, pecans', price: '9', tags: [T('v'), T('n')] },
  { name: 'Lemon Tart', desc: 'creme fraiche', price: '9', tags: [T('v')] },
];

function assets() {
  const brand = getActiveBrand();
  return { crest: assetUrl(brand.assetKeys.crest), lockup: assetUrl(brand.assetKeys.lockup) };
}

function paperScale(paper: string | undefined, targetWidth = THUMB_BOX_PX, targetHeight = THUMB_BOX_HEIGHT_PX): number {
  const widthMm = paper === 'A5' ? 148 : 210;
  const heightMm = paper === 'A5' ? 210 : 297;
  return Math.min(targetWidth / (widthMm * MM_TO_PX), targetHeight / (heightMm * MM_TO_PX));
}

function allTemplates(): Template[] {
  return combineTemplates(getState().userTemplates);
}

function styleFromTemplate(t: Template): MenuStyle {
  return {
    paper: t.style.paper,
    header: t.style.header,
    showKey: t.style.showKey !== false,
    sc: t.style.sc ?? 1,
    dn: t.style.dn ?? 1,
    ...(t.style.stacked ? { stacked: true } : {}),
  };
}

function tplToSample(t: Template): Menu {
  const menu = newMenu(t.name, styleFromTemplate(t));
  menu.date = '';
  menu.headerNote = t.headerNote || '';
  menu.footer = t.footer || '';
  t.sections.forEach((ts, i) => {
    const count = ts.cols && ts.cols > 1 ? 4 : 2;
    const items: Dish[] = [];
    for (let k = 0; k < count; k += 1) {
      const d = SAMPLE_DISHES[(i * 2 + k) % SAMPLE_DISHES.length];
      const dish = newDish(d.name, d.desc, d.price, d.tags.map((tag) => ({ ...tag })));
      dish.col = ts.cols && ts.cols > 1 ? k % ts.cols : 0;
      items.push(dish);
    }
    const section = newSection(ts.name, items, {
      prices: ts.prices !== false,
      cols: ts.cols || 1,
      note: ts.note || '',
      descMode: ts.descMode || (t.style.stacked ? 'below' : 'inline'),
    });
    menu.sections.push(section);
    if ((i === 0 && t.leadRule) || ts.ruleBefore) menu.rootRules.push(newRule('between', section.id));
  });
  normaliseMenuColumns(menu);
  return menu;
}

export async function createMenuFromTemplateId(templateId: string, name?: string): Promise<void> {
  const template = allTemplates().find((t) => t.id === templateId);
  if (!template) return;
  if (!await confirmDocumentTransition()) return;
  await window.griffin?.newDocument?.();
  snapshot();
  const menu = newMenu((name || template.name).trim() || 'New Menu', styleFromTemplate(template));
  menu.headerNote = template.headerNote || '';
  menu.footer = template.footer || '';
  template.sections.forEach((ts, i) => {
    const section = newSection(ts.name, [], {
      prices: ts.prices !== false,
      cols: ts.cols || 1,
      note: ts.note || '',
      descMode: ts.descMode || (template.style.stacked ? 'below' : 'inline'),
    });
    menu.sections.push(section);
    if ((i === 0 && template.leadRule) || ts.ruleBefore) menu.rootRules.push(newRule('between', section.id));
  });
  const state = getState();
  state.menus.unshift(menu);
  state.currentMenuId = menu.id;
  setWorkspace('editor'); // switch first so the commit doesn't rebuild Home thumbnails we're leaving
  commit(['all']);
}

export async function createBlankMenu(): Promise<void> {
  if (!await confirmDocumentTransition()) return;
  await window.griffin?.newDocument?.();
  const defaults = getState().settings.defaults ?? {};
  const columns = Math.max(1, Math.min(4, defaults.cols || 1));
  const showPrices = defaults.showPrices !== false;
  const showKey = defaults.showKey !== false;
  const typo = getState().settings.typography ?? {};
  const densityScale = typo.density === 'compact' ? 0.9 : typo.density === 'spacious' ? 1.15 : 1;
  snapshot();
  const menu = newMenu('New Menu', {
    ...(defaults.paper ? { paper: defaults.paper } : {}),
    ...(defaults.header ? { header: defaults.header } : {}),
    showKey,
    showPrices,
    sc: typo.scale ?? 1,
    dn: densityScale,
  });
  menu.footer = defaults.footer || '';
  menu.sections = [
    newSection('Starters', [], { cols: columns, descMode: defaults.descMode || 'inline', prices: showPrices }),
    newSection('Mains', [], { cols: columns, descMode: defaults.descMode || 'inline', prices: showPrices }),
    newSection('Desserts', [], { cols: columns, descMode: defaults.descMode || 'inline', prices: showPrices }),
  ];
  const state = getState();
  state.menus.unshift(menu);
  state.currentMenuId = menu.id;
  if (defaults.blush) state.settings.blush = defaults.blush;
  setWorkspace('editor');
  commit(['all']);
}

function renderMenuCard(menu: Menu, dietKey: DietKey[]): string {
  const scale = paperScale(menu.style?.paper);
  const filter = [
    menu.name,
    fmtDate(menu.date),
    menu.style?.paper,
    ...menu.sections.flatMap((section) => [
      section.name,
      section.note,
      ...section.items.flatMap((item) => {
        if ((item as { type?: string }).type === 'rule') return [];
        const dish = item as Dish;
        return [dish.name, dish.desc, dish.price, ...(dish.tags || []).map((tag) => tag.c)];
      }),
    ]),
  ].filter(Boolean).join(' ').toLowerCase();
  return `<button class="start-card" data-open-menu="${esc(menu.id)}" data-menu-filter="${esc(filter)}">
    <div class="start-card-thumb"><div class="start-card-scale" style="transform:translate(-50%,-50%) scale(${scale})">${renderMenuHTML(menu, { edit: false, dietKey, assets: assets() })}</div></div>
    <span class="start-card-name">${esc(menu.name)}</span>
    <span class="start-card-date">${esc(fmtDate(menu.date))} · ${esc(menu.style?.paper || 'A4')}</span>
  </button>`;
}

function renderTemplateCard(template: Template, dietKey: DietKey[]): string {
  const sample = tplToSample(template);
  const scale = paperScale(template.style.paper);
  const meta = `${esc(template.style.paper)} · ${template.sections.length} sections${template.builtin ? '' : ' · yours'}`;
  return `<div class="start-card template-card">
    <button class="start-card-thumb-btn" data-template-preview="${esc(template.id)}" title="Preview ${esc(template.name)}" aria-label="Preview ${esc(template.name)}">
      <div class="start-card-thumb"><div class="start-card-scale" style="transform:translate(-50%,-50%) scale(${scale})">${renderMenuHTML(sample, { edit: false, dietKey, assets: assets() })}</div></div>
    </button>
    <span class="start-card-name">${esc(template.name)}</span>
    <span class="start-card-date">${meta}</span>
    <div class="start-card-actions">
      <button class="abtn primary sm" data-template-id="${esc(template.id)}">Use template</button>
      <button class="abtn sm" data-template-preview="${esc(template.id)}">Preview</button>
    </div>
  </div>`;
}

function openTemplatePreview(templateId: string): void {
  const template = allTemplates().find((t) => t.id === templateId);
  if (!template || document.getElementById('tplPreviewRoot')) return;
  const dietKey = getState().settings.dietKey;
  const html = renderMenuHTML(tplToSample(template), { edit: false, dietKey, assets: assets() });
  const scale = paperScale(template.style.paper, 384, 543);
  const root = document.createElement('div');
  root.id = 'tplPreviewRoot';
  root.className = 'tplprev-overlay';
  root.innerHTML = `<div class="tplprev-panel" role="dialog" aria-modal="true" aria-label="Template preview: ${esc(template.name)}">
      <header class="tplprev-head"><div><b>${esc(template.name)}</b><span>${esc(template.style.paper)} · ${template.sections.length} sections · preview uses sample dishes</span></div>
        <div class="tplprev-actions"><button class="abtn primary" data-template-id="${esc(template.id)}" data-tplprev-close>Use this template</button><button class="abtn" data-tplprev-close>Close</button></div></header>
      <div class="tplprev-page-shell"><div class="tplprev-thumb"><div class="start-card-scale" style="transform:translate(-50%,-50%) scale(${scale})">${html}</div></div></div>
    </div>`;
  document.body.appendChild(root);
  const panel = root.querySelector<HTMLElement>('.tplprev-panel')!;
  const close = (): void => { trap.release(); root.remove(); };
  const trap = trapFocus(panel, { onEscape: close });
  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    const use = t.closest<HTMLElement>('[data-template-id]');
    if (use?.dataset.templateId) { close(); void createMenuFromTemplateId(use.dataset.templateId); return; }
    if (t === root || t.closest('[data-tplprev-close]')) close();
  });
}

function dishRows(): string {
  const rows: string[] = [];
  for (const menu of getState().menus) {
    for (const section of menu.sections) {
      for (const item of section.items) {
        if ((item as { type?: string }).type === 'rule') continue;
        const dish = item as Dish;
        const hay = `${dish.name || ''} ${dish.desc || ''} ${section.name} ${menu.name}`.toLowerCase();
        rows.push(`<button class="home-dish-row" data-dish-filter="${esc(hay)}" data-open-menu="${esc(menu.id)}">
          <span class="home-dish-name">${esc(dish.name || 'Untitled dish')}</span>
          <span class="home-dish-desc">${esc(dish.desc || section.name)}</span>
          <span class="home-dish-src">${esc(menu.name)} · ${esc(section.name)}</span>
        </button>`);
      }
    }
  }
  return rows.join('') || '<p class="start-empty">No dishes yet. Create a menu and add dishes to build the library.</p>';
}

function activeNav(pane: HomePane): string {
  return homePane === pane ? ' class="on" aria-current="page"' : '';
}

function renderHomeMain(): string {
  const state = getState();
  const dietKey = state.settings.dietKey;
  if (homePane === 'new') {
    const templates = allTemplates().map((t) => renderTemplateCard(t, dietKey)).join('');
    return `<section class="home-pane"><div class="start-head"><h1>New menu</h1></div>
      <div class="home-action-row">
        <button class="home-action-card" data-cmd="new-blank"><b>Blank menu</b><span>Start with empty starter, main and dessert sections.</span></button>
      </div>
      <h2 class="home-section-title">Choose a template</h2><div class="start-grid">${templates}</div></section>`;
  }
  if (homePane === 'dishes') {
    const rows = dishRows();
    if (rows.startsWith('<p class="start-empty"')) {
      return `<section class="home-pane"><div class="start-head"><h1>Dishes</h1></div>
        <div class="home-empty">
          <div class="home-empty-mark"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
          <h2>No dishes yet</h2>
          <p>Every dish from every menu shows up here so you can search and reuse it. Create a menu and add a few dishes to get started.</p>
          <div class="home-empty-actions"><button class="abtn primary" data-cmd="new-template">New from Template</button></div>
        </div></section>`;
    }
    return `<section class="home-pane"><div class="start-head"><h1>Dishes</h1><button class="abtn" data-cmd="toggle-find-replace-panel">Find across menus</button></div>
      <input class="home-search" id="homeDishSearch" placeholder="Search dishes, descriptions, menus or sections">
      <div class="home-dish-list" id="homeDishList">${rows}</div></section>`;
  }
  if (homePane === 'settings') {
    const settings = state.settings;
    const defaults = settings.defaults ?? {};
    const storage = settings.storage ?? {};
    const typo = settings.typography ?? {};
    const fontSet = typo.fontSet || 'griffin';
    const density = typo.density || 'balanced';
    const scalePct = Math.round((typo.scale ?? 1) * 100);
    // Real menu content for the role previews (falls back to representative Griffin samples).
    const cm = currentMenu();
    const firstSec = cm?.sections?.[0];
    const firstDish = (firstSec?.items ?? []).find((it) => !(it as { type?: string }).type) as { name?: string; price?: string; desc?: string } | undefined;
    const sample = {
      title: cm?.name || 'Sunday Menu',
      section: firstSec?.name || 'To Start',
      dish: firstDish?.name || 'Roast Sirloin of Beef',
      price: firstDish?.price || '24',
      desc: firstDish?.desc || 'Yorkshire pudding, roast potatoes, seasonal greens',
      key: '(gf) gluten free   (v) vegetarian',
      footer: (cm?.footer || '').split('\n')[0] || 'Please let us know of any allergies or intolerances',
    };
    const rec = settings.recovery ?? {};
    const recInterval = rec.intervalSeconds ?? 30;
    const opt = (val: string, label: string, on: boolean): string => `<option value="${val}" ${on ? 'selected' : ''}>${label}</option>`;
    const seg = (key: string, val: string, cur: string, label: string): string => `<button type="button" class="seg-btn ${val === cur ? 'on' : ''}" data-setting-${key}="${val}">${label}</button>`;
    const pathRow = (key: string, label: string): string =>
      `<label>${label}<span class="path-row"><input data-setting-storage="${key}" value="${esc((storage as Record<string, string>)[key] || '')}" placeholder="Default"><button type="button" data-browse-storage="${key}">Browse</button></span></label>`;
    return `<section class="home-pane settings-pane"><div class="start-head"><h1>Settings</h1><button class="abtn primary" data-settings-save>Save settings</button></div>
      <div class="settings-grid">
        <section class="settings-card"><h2>New-menu defaults</h2>
          <p class="settings-note">Applied whenever you create a blank menu.</p>
          <label>Paper size <select data-setting-default="paper">${opt('A4', 'A4 (portrait)', defaults.paper !== 'A5')}${opt('A5', 'A5 (portrait)', defaults.paper === 'A5')}</select></label>
          <label>Header style <select data-setting-default="header">${opt('title', 'Title only', defaults.header === 'title')}${opt('crest', 'Crest + title', defaults.header === 'crest')}${opt('lockup', 'Full lockup', defaults.header === 'lockup')}</select></label>
          <label>Columns <select data-setting-default="cols">${[1, 2, 3, 4].map((n) => opt(String(n), `${n} column${n > 1 ? 's' : ''}`, defaults.cols === n)).join('')}</select></label>
          <label>Description position <select data-setting-default="descMode">${opt('inline', 'Beside the dish name', defaults.descMode !== 'below')}${opt('below', 'Below the dish name', defaults.descMode === 'below')}</select></label>
          <label class="tool-check"><input type="checkbox" data-setting-default="showPrices" ${defaults.showPrices !== false ? 'checked' : ''}> Show prices by default</label>
          <label class="tool-check"><input type="checkbox" data-setting-default="showKey" ${defaults.showKey !== false ? 'checked' : ''}> Show the dietary key by default</label>
          <label>Default footer <textarea data-setting-default="footer" placeholder="Printed at the bottom of every new menu…">${esc(defaults.footer || '')}</textarea></label>
          <label>Preview paper tint <span class="colour-row"><input type="color" data-setting-default="blush" value="${esc(defaults.blush || '#F5E4DF')}"><small>Exports always stay white.</small></span></label>
        </section>

        <section class="settings-card typo-card"><h2>Typography</h2>
          <p class="settings-note">The default look for new menus, previewed with your own menu content. Set the coordinated basics here; every role can be fine-tuned below.</p>
          <div class="typo-block"><span class="typo-step">1</span><b>Global</b></div>
          <label>Font set <select data-setting-typo="fontSet">${opt('griffin', 'Griffin — Georgia + Sans', fontSet === 'griffin')}${opt('classic', 'Classic — Playfair + Inter', fontSet === 'classic')}${opt('modern', 'Modern — Clean Sans', fontSet === 'modern')}</select></label>
          <label>Overall text size <span class="range-row"><input type="range" min="70" max="140" step="1" value="${scalePct}" data-setting-typo="scale"><span class="range-val" id="typoScaleVal">${scalePct}%</span></span></label>
          <div class="seg" role="group" aria-label="Density">${seg('typo-density', 'compact', density, 'Compact')}${seg('typo-density', 'balanced', density, 'Balanced')}${seg('typo-density', 'spacious', density, 'Spacious')}</div>
          <div class="typo-block"><span class="typo-step">2</span><b>Roles</b></div>
          <div class="typo-roles font-${fontSet}">
            ${typoRole('title', sample.title)}
            ${typoRole('section', sample.section)}
            ${typoRole('dish', sample.dish)}
            ${typoRole('price', sample.price)}
            ${typoRole('desc', sample.desc)}
            ${typoRole('key', sample.key)}
            ${typoRole('footer', sample.footer)}
          </div>
          ${typoRoleControls()}
        </section>

        <section class="settings-card"><h2>Storage</h2>
          <p class="settings-note">Your menus, templates and exports live in <b>Documents › Griffin Menu Studio</b>.</p>
          <button type="button" class="abtn primary" data-reveal-library>Open the Griffin Menu Studio folder</button>
          <div class="path-current-list" id="pathCurrentList">
            <div class="path-current-row"><span>Menus</span><code data-path-key="menus">…</code></div>
            <div class="path-current-row"><span>Templates</span><code data-path-key="templates">…</code></div>
            <div class="path-current-row"><span>Exports</span><code data-path-key="exports">…</code></div>
            <div class="path-current-row"><span>Recovery</span><code data-path-key="recovery">…</code></div>
          </div>
          <p class="settings-note">Override any of these (advanced):</p>
          ${pathRow('defaultMenuFolder', 'Menus folder')}
          ${pathRow('templatesFolder', 'Templates folder')}
          ${pathRow('recoveryFolder', 'Recovery folder')}
          <p class="settings-note">Changing a location never deletes existing files.</p>

          <h3 class="settings-subhead">Backup &amp; recovery</h3>
          <p class="settings-note">Griffin keeps a safety copy of your open menu while you work, so a crash never loses it. Recovery copies live in AppData and never sync to OneDrive.</p>
          <label class="tool-check"><input type="checkbox" data-setting-recovery="enabled" ${rec.enabled !== false ? 'checked' : ''}> Autosave a recovery copy</label>
          <label>Autosave every <select data-setting-recovery="intervalSeconds">${[10, 20, 30, 60, 120, 300].map((n) => opt(String(n), n < 60 ? `${n} seconds` : `${n / 60} minute${n > 60 ? 's' : ''}`, recInterval === n)).join('')}</select></label>
        </section>

        ${renderUpdatesCard()}
      </div></section>`;
  }
  const cards = state.menus.map((menu) => renderMenuCard(menu, dietKey)).join('');
  const body = cards
    ? `<input class="home-search" id="homeMenuSearch" placeholder="Search menus, sections or dishes">
       <div class="start-grid" id="homeMenuGrid">${cards}</div>
       <p class="start-empty" id="homeMenuNoMatch" hidden>No menus match your search.</p>`
    : `<div class="home-empty">
        <div class="home-empty-mark"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
        <h2>No menus yet</h2>
        <p>Create your first menu from a Griffin template or a blank page — it opens straight in the editor.</p>
        <div class="home-empty-actions"><button class="abtn primary" data-cmd="new-template">New from Template</button><button class="abtn" data-cmd="new-blank">Blank menu</button></div>
      </div>`;
  return `<section class="home-pane"><div class="start-head"><h1>Open menu</h1><div class="start-actions"><button class="abtn primary" data-home-pane="new">Create menu</button><button class="abtn" data-cmd="open">Open…</button></div></div>
    ${body}</section>`;
}

function renderHomeWorkspace(): void {
  const root = document.getElementById('homeWorkspace');
  if (!root) return;
  root.innerHTML = `<div class="home-shell">
    <aside class="home-nav" role="navigation" aria-label="Home sections">
      <div class="home-brand">Griffin<br>Menu Studio</div>
      <button data-home-pane="open"${activeNav('open')}>Open</button>
      <button data-home-pane="new"${activeNav('new')}>New</button>
      <button data-home-pane="dishes"${activeNav('dishes')}>Dishes</button>
      <button data-home-pane="settings"${activeNav('settings')}>Settings</button>
    </aside>
    <main class="home-main">${renderHomeMain()}</main>
  </div>`;
  if (current === 'home' && homePane === 'settings') void fillCurrentPaths();
}

/** Populate the Storage card's "current location" rows with the real resolved paths. */
async function fillCurrentPaths(): Promise<void> {
  const list = document.getElementById('pathCurrentList');
  if (!list || !window.griffin?.getPaths) return;
  try {
    const paths = await window.griffin.getPaths(getState().settings.storage);
    for (const [key, value] of Object.entries(paths)) {
      const el = list.querySelector<HTMLElement>(`[data-path-key="${key}"]`);
      if (el) {
        el.textContent = value;
        el.title = value;
      }
    }
  } catch {
    /* non-critical */
  }
}

async function restoreRecovery(id: string): Promise<void> {
  const api = window.griffin;
  if (!api?.readRecovery) return;
  const res = await api.readRecovery(id, getState().settings.storage);
  if (!res.found || !res.snapshot?.state) {
    toast('That recovered menu could not be read.', { kind: 'error' });
    return;
  }
  const { replaceState } = await import('../store');
  replaceState(res.snapshot.state as ReturnType<typeof getState>);
  window.dispatchEvent(new Event('griffin:dirty')); // recovered work is unsaved until the user saves it
  recoverySnapshots = recoverySnapshots.filter((s) => s.id !== id);
  void api.discardRecovery?.(id, getState().settings.storage);
  closeRecoveryDialog();
  setWorkspace('editor');
  toast('Recovered menu restored — review it and Save to keep it.', { kind: 'success' });
}

async function discardRecovery(id: string): Promise<void> {
  const ok = await confirmDialog({ title: 'Discard recovered work?', body: 'This recovered snapshot will be permanently removed.', confirmLabel: 'Discard', danger: true });
  if (!ok) return;
  await window.griffin?.discardRecovery?.(id, getState().settings.storage);
  recoverySnapshots = recoverySnapshots.filter((s) => s.id !== id);
  refreshRecoveryDialog();
}

function initHomeWorkspace(): void {
  document.getElementById('homeWorkspace')?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const nav = target.closest<HTMLElement>('[data-home-pane]');
    if (nav) {
      homePane = (nav.dataset.homePane as HomePane) || 'open';
      renderHomeWorkspace();
      return;
    }
    if (target.closest('[data-reset-tips]')) {
      const s = getState().settings;
      s.tipSeen = false;
      s.tipbarHidden = false;
      persist();
      const tip = document.getElementById('tipbar');
      if (tip) tip.style.display = 'flex';
      toast('Tips are back on. You’ll see them in the Editor.', { kind: 'success' });
      return;
    }
    const restore = target.closest<HTMLElement>('[data-recovery-restore]');
    if (restore?.dataset.recoveryRestore) {
      void restoreRecovery(restore.dataset.recoveryRestore);
      return;
    }
    const discard = target.closest<HTMLElement>('[data-recovery-discard]');
    if (discard?.dataset.recoveryDiscard) {
      void discardRecovery(discard.dataset.recoveryDiscard);
      return;
    }
    const preview = target.closest<HTMLElement>('[data-template-preview]');
    if (preview?.dataset.templatePreview) {
      openTemplatePreview(preview.dataset.templatePreview);
      return;
    }
    const template = target.closest<HTMLElement>('[data-template-id]');
    if (template?.dataset.templateId) {
      void createMenuFromTemplateId(template.dataset.templateId);
      return;
    }
    const card = target.closest<HTMLElement>('[data-open-menu]');
    if (card?.dataset.openMenu) {
      getState().currentMenuId = card.dataset.openMenu;
      setWorkspace('editor'); // switch first so the commit doesn't rebuild the Home thumbnails we're leaving
      commit(['all']);
      return;
    }
    if (target.closest('[data-settings-save]')) {
      commit(['all']);
      renderHomeWorkspace();
    }
    if (target.closest('[data-reveal-library]')) {
      void window.griffin?.revealLibraryFolder().then((res) => {
        if (res && !res.ok) toast('Could not open the folder.', { kind: 'error' });
      });
      return;
    }
    const density = target.closest<HTMLElement>('[data-setting-typo-density]');
    if (density?.dataset.settingTypoDensity) {
      const t = (getState().settings.typography = getState().settings.typography ?? {});
      t.density = density.dataset.settingTypoDensity as 'compact' | 'balanced' | 'spacious';
      density.parentElement?.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === density));
      return;
    }
    const roleBtn = target.closest<HTMLElement>('[data-typo-role]');
    if (roleBtn?.dataset.typoRole) {
      selectedTypoRole = roleBtn.dataset.typoRole as TypoRoleKey;
      renderHomeWorkspace();
      return;
    }
    const alignBtn = target.closest<HTMLElement>('[data-typo-align]');
    if (alignBtn?.dataset.typoAlign) {
      setRoleStyle('align', alignBtn.dataset.typoAlign);
      renderHomeWorkspace();
      return;
    }
    const capsBtn = target.closest<HTMLElement>('[data-typo-caps]');
    if (capsBtn?.dataset.typoCaps) {
      setRoleStyle('caps', capsBtn.dataset.typoCaps);
      renderHomeWorkspace();
      return;
    }
    if (target.closest('[data-typo-reset]')) {
      const roles = getState().settings.typography?.roles;
      if (roles) delete roles[selectedTypoRole];
      commit(['preview']);
      renderHomeWorkspace();
      return;
    }
    const browse = target.closest<HTMLElement>('[data-browse-storage]');
    if (browse?.dataset.browseStorage) {
      const key = browse.dataset.browseStorage as 'defaultMenuFolder' | 'templatesFolder' | 'recoveryFolder';
      const currentPath = getState().settings.storage?.[key];
      void window.griffin?.chooseFolder(currentPath).then((res) => {
        if (res?.canceled || !res.folderPath) return;
        const storage = (getState().settings.storage = getState().settings.storage ?? {});
        storage[key] = res.folderPath;
        commit(['all']);
        renderHomeWorkspace();
      });
    }
  });

  document.getElementById('homeWorkspace')?.addEventListener('input', (e) => {
    const input = e.target;
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
      const defaultKey = input.dataset.settingDefault as
        | 'paper'
        | 'header'
        | 'cols'
        | 'descMode'
        | 'footer'
        | 'showPrices'
        | 'showKey'
        | 'blush'
        | undefined;
      const storageKey = input.dataset.settingStorage as
        | 'defaultMenuFolder'
        | 'templatesFolder'
        | 'recoveryFolder'
        | undefined;
      if (defaultKey) {
        const defaults = (getState().settings.defaults = getState().settings.defaults ?? {});
        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
          (defaults as Record<string, unknown>)[defaultKey] = input.checked;
          return;
        }
        const value = input.value;
        if (defaultKey === 'cols') defaults.cols = Math.max(1, Math.min(4, Number(value) || 1));
        else (defaults as Record<string, unknown>)[defaultKey] = value;
        return;
      }
      if (storageKey) {
        const storage = (getState().settings.storage = getState().settings.storage ?? {});
        storage[storageKey] = input.value;
        return;
      }
      const typoKey = input.dataset.settingTypo as 'fontSet' | 'scale' | undefined;
      if (typoKey) {
        const t = (getState().settings.typography = getState().settings.typography ?? {});
        if (typoKey === 'scale') {
          t.scale = Math.max(0.7, Math.min(1.4, (Number(input.value) || 100) / 100));
          const label = document.getElementById('typoScaleVal');
          if (label) label.textContent = `${Math.round((t.scale ?? 1) * 100)}%`;
        } else {
          t.fontSet = input.value as 'griffin' | 'classic' | 'modern';
          document.querySelector('.typo-roles')?.classList.remove('font-griffin', 'font-classic', 'font-modern');
          document.querySelector('.typo-roles')?.classList.add(`font-${t.fontSet}`);
        }
        commit(['preview']);
        return;
      }
      const typoCtrl = input.dataset.typoCtrl as 'size' | 'weight' | undefined;
      if (typoCtrl) {
        setRoleStyle(typoCtrl, Number(input.value));
        if (typoCtrl === 'size') {
          const valEl = document.querySelector('[data-typo-ctrl-val="size"]');
          if (valEl) valEl.textContent = `${input.value}px`;
        }
        const sampleEl = document.querySelector<HTMLElement>(`.typo-role[data-typo-role="${selectedTypoRole}"] .typo-sample`);
        if (sampleEl) sampleEl.setAttribute('style', roleInline(roleStyle(selectedTypoRole)));
        return;
      }
      const recKey = input.dataset.settingRecovery as 'enabled' | 'intervalSeconds' | undefined;
      if (recKey) {
        const r = (getState().settings.recovery = getState().settings.recovery ?? {});
        if (recKey === 'enabled' && input instanceof HTMLInputElement) r.enabled = input.checked;
        else if (recKey === 'intervalSeconds') r.intervalSeconds = Math.max(10, Math.min(300, Number(input.value) || 30));
        return;
      }
    }
    if (input instanceof HTMLInputElement && input.id === 'homeMenuSearch') {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      document.querySelectorAll<HTMLElement>('#homeMenuGrid [data-menu-filter]').forEach((card) => {
        const hit = !q || (card.dataset.menuFilter || '').includes(q);
        card.hidden = !hit;
        if (hit) shown += 1;
      });
      const none = document.getElementById('homeMenuNoMatch');
      if (none) none.hidden = shown > 0;
      return;
    }
    if (!(input instanceof HTMLInputElement) || input.id !== 'homeDishSearch') return;
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>('#homeDishList [data-dish-filter]').forEach((row) => {
      row.hidden = !!q && !(row.dataset.dishFilter || '').includes(q);
    });
  });
}

function initExportWorkspace(): void {
  document.getElementById('exportWorkspace')?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const pane = target.closest<HTMLElement>('[data-export-pane]');
    if (pane?.dataset.exportPane) {
      exportPane = pane.dataset.exportPane as ExportPane;
      renderExportWorkspace();
      return;
    }
    const zoomBtn = target.closest<HTMLElement>('[data-export-zoom]');
    if (zoomBtn?.dataset.exportZoom) {
      const action = zoomBtn.dataset.exportZoom;
      if (action === 'in') setZoom(getZoom(EXPORT_STAGE) * 1.18, EXPORT_STAGE);
      else if (action === 'out') setZoom(getZoom(EXPORT_STAGE) / 1.18, EXPORT_STAGE);
      else if (action === 'fit-width') {
        setFollowFit(true, EXPORT_STAGE);
        fitPage(EXPORT_STAGE);
      } else if (action === 'actual-size') setZoom(1, EXPORT_STAGE);
      return;
    }
    const step = target.closest<HTMLElement>('[data-copy-step]');
    if (step?.dataset.copyStep) {
      const input = document.getElementById('printCopies') as HTMLInputElement | null;
      if (!input) return;
      const next = Math.max(1, Math.min(99, (Number(input.value) || 1) + Number(step.dataset.copyStep)));
      input.value = String(next);
    }
  });
  // Keep the export stage's rulers/zoom-to-fit correct if the window is
  // resized while the Export workspace is the visible one.
  window.addEventListener('resize', () => {
    if (current === 'export') fitPage(EXPORT_STAGE);
  });
}

/**
 * Wires the export stage's scroll (ruler redraw), Ctrl/Cmd+wheel zoom and
 * zoom-slider — mirrors initPreview's editor-stage wiring (views/preview.ts)
 * but targets the Export workspace's ids. Re-run after every
 * renderExportWorkspace() because that call replaces this DOM wholesale.
 */
function bindExportStage(): void {
  const scroll = document.getElementById('exportStageScroll');
  scroll?.addEventListener('scroll', () => scheduleRulers(EXPORT_STAGE), { passive: true });
  scroll?.addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(getZoom(EXPORT_STAGE) * (e.deltaY < 0 ? 1.1 : 1 / 1.1), EXPORT_STAGE);
    },
    { passive: false },
  );
  const slider = document.getElementById('exportZoomSlider') as HTMLInputElement | null;
  slider?.addEventListener('input', () => setZoom(Number(slider.value) / 100, EXPORT_STAGE));
}

function exportNavButton(pane: ExportPane, label: string): string {
  const on = exportPane === pane;
  return `<button class="${on ? 'on' : ''}" data-export-pane="${pane}"${on ? ' aria-current="page"' : ''}>${label}</button>`;
}

function renderExportSettings(menu: Menu): string {
  if (exportPane === 'pdf') {
    return `<section class="export-settings">
      <p class="export-kicker">Export</p>
      <h1>PDF</h1>
      <p class="export-copy">Create a print-ready PDF with a white page background, exact paper size and no editor chrome.</p>
      <div class="export-field"><label>Paper</label><span class="export-value">${esc(menu.style.paper || 'A4')} · set by this menu</span></div>
      <div class="export-field"><label>Scaling</label><span class="export-value">Actual size (no shrink)</span></div>
      <p class="export-status" id="exportStatus">Checking layout…</p>
      <button class="abtn primary" data-cmd="export-pdf">Export PDF…</button>
    </section>`;
  }
  if (exportPane === 'png') {
    return `<section class="export-settings">
      <p class="export-kicker">Export</p>
      <h1>PNG image</h1>
      <p class="export-copy">Save the current menu page as an image for sharing, approval or quick review.</p>
      <div class="export-field"><label>Background</label><span class="export-value">White page</span></div>
      <div class="export-field"><label>Source</label><span class="export-value">Current menu page</span></div>
      <p class="export-status" id="exportStatus">Checking layout…</p>
      <button class="abtn primary" data-cmd="export-png">Export PNG…</button>
    </section>`;
  }
  if (exportPane === 'save') {
    return `<section class="export-settings">
      <p class="export-kicker">Document</p>
      <h1>Save As</h1>
      <p class="export-copy">Save an editable Griffin Menu Studio document (<b>.menu</b>) that can be reopened and changed later. This is your source file, not an export.</p>
      <div class="export-field"><label>Format</label><span class="export-value">.menu — editable document</span></div>
      <div class="export-field"><label>Contains</label><span class="export-value">Your menus, templates &amp; settings</span></div>
      <button class="abtn primary" data-cmd="save-as">Save As…</button>
    </section>`;
  }
  return `<section class="export-settings print-settings">
    <p class="export-kicker">Output</p>
    <h1>Print</h1>
    <p class="export-copy">Check the menu, then open the system print dialog.</p>
    <button class="print-primary" id="printButton" data-cmd="print-now">
      <span class="primary-icon"><svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg></span>
      <span class="primary-copy"><strong>Print</strong><small>Open system print dialog</small></span>
      <span class="primary-arrow"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></span>
    </button>
    <div class="print-setting-list">
      <div class="print-row"><span class="print-row-icon"><svg viewBox="0 0 24 24"><path d="M8 5h11v14H8z"/><path d="M5 8H3v11h11v-2"/></svg></span><span><b>Copies</b><small>Number of menus</small></span><span class="copies-stepper"><button type="button" data-copy-step="-1">-</button><input id="printCopies" type="number" value="1" min="1" max="99" aria-label="Copies"><button type="button" data-copy-step="1">+</button></span></div>
      <div class="print-row"><span class="print-row-icon"><svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg></span><span><b>Printer</b><small>Choose after pressing Print</small></span><em>System dialog</em></div>
      <div class="print-row"><span class="print-row-icon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span><b>Pages</b><small>Print selection</small></span><em>Current menu</em></div>
      <div class="print-row"><span class="print-row-icon"><svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/></svg></span><span><b>Paper</b><small>Set by this menu</small></span><em>${esc(menu.style.paper || 'A4')}</em></div>
      <div class="print-row"><span class="print-row-icon"><svg viewBox="0 0 24 24"><path d="M7 3h10v18H7z"/><path d="m4 7 3-3 3 3M20 17l-3 3-3-3"/></svg></span><span><b>Orientation</b><small>Set by the menu layout</small></span><em>Portrait</em></div>
      <div class="print-row"><span class="print-row-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 4v16M16 4v16M4 8h16M4 16h16"/></svg></span><span><b>Margins</b><small>Built into the menu design</small></span><em>Menu layout</em></div>
      <div class="print-row"><span class="print-row-icon"><svg viewBox="0 0 24 24"><path d="M7 3H3v4M17 3h4v4M21 17v4h-4M3 17v4h4"/><path d="M8 8h8v8H8z"/></svg></span><span><b>Scaling</b><small>No automatic shrink-to-fit</small></span><em>Actual size</em></div>
    </div>
    <p class="export-status print-preflight" id="exportStatus">Checking layout...</p>
    <details class="print-advanced"><summary>Page setup</summary><p>Paper size, orientation and margins come from the menu layout. Change these in the Editor.</p></details>
  </section>`;
}

function renderExportWorkspace(): void {
  const root = document.getElementById('exportWorkspace');
  if (!root) return;
  const menu = currentMenu();
  const dietKey = getState().settings.dietKey;
  const html = renderMenuHTML(menu, { edit: false, dietKey, assets: assets() });

  // Mirrors renderPreview()'s lastMenuId tracking (views/preview.ts): only
  // reset zoom-to-fit when the open menu actually changes, not on every
  // pane switch, so a manual zoom survives flipping between Print/PDF/PNG.
  if (menu.id !== exportLastMenuId) {
    exportLastMenuId = menu.id;
    setFollowFit(true, EXPORT_STAGE);
  }

  root.innerHTML = `<div class="export-room">
    <aside class="export-nav" role="navigation" aria-label="Export options">
      ${exportNavButton('print', 'Print')}
      ${exportNavButton('pdf', 'PDF')}
      ${exportNavButton('png', 'PNG')}
      ${exportNavButton('save', 'Save As')}
      <button data-cmd="go-editor">Back to Editor</button>
    </aside>
    ${renderExportSettings(menu)}
    <section class="export-canvas">
      <header class="export-preview-toolbar"><div><b>${esc(menu.name)}</b><span>${esc(menu.style.paper || 'A4')} - white print preview</span></div></header>
      <div class="stage-body">
        <canvas class="ruler ruler-top" id="exportRulerTop" aria-hidden="true"></canvas>
        <div class="ruler-corner" aria-hidden="true"></div>
        <div class="stage-scroll" id="exportStageScroll"><div class="pagewrap" id="exportPagewrap">${html}</div></div>
        <canvas class="ruler ruler-right" id="exportRulerRight" aria-hidden="true"></canvas>
      </div>
      <div class="stage-zoombar" role="toolbar" aria-label="Export preview zoom">
        <button class="zoomb wide" data-export-zoom="fit-width" title="Fit the page to the window width">Fit width</button>
        <button class="zoomb wide" data-export-zoom="actual-size" title="Show the page at 100%">Actual size</button>
        <span class="sp"></span>
        <button class="zoomb icon" data-export-zoom="out" title="Zoom out" aria-label="Zoom out"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
        <input type="range" class="zoom-slider" id="exportZoomSlider" min="20" max="300" step="1" value="100" title="Zoom" aria-label="Zoom level">
        <button class="zoomb icon" data-export-zoom="in" title="Zoom in" aria-label="Zoom in"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
        <button class="zoomb zoompct" id="exportZoomPct" data-export-zoom="actual-size" title="Current zoom — click for 100%">100%</button>
      </div>
    </section>
  </div>`;

  bindExportStage();
  fitPage(EXPORT_STAGE);
  requestAnimationFrame(() => fitPage(EXPORT_STAGE));

  refreshExportStatus();
}

let exportPreflightSeq = 0;

/**
 * Canonical Export/Print readiness: measure the unscaled white production page
 * (fonts + images awaited) via preparePrintDOM — never the scaled visible canvas,
 * which can falsely report "does not fit" after Shrink to Fit already succeeded.
 */
function refreshExportStatus(): void {
  const statusEl = document.getElementById('exportStatus');
  if (!statusEl) return;
  const seq = ++exportPreflightSeq;
  statusEl.textContent = 'Checking layout…';
  void preparePrintDOM().then((pre) => {
    if (seq !== exportPreflightSeq || current !== 'export') return; // a newer render superseded this
    const live = document.getElementById('exportStatus');
    const btn = document.getElementById('printButton') as HTMLButtonElement | null;
    if (!live) return;
    let msg: string;
    let warn = true;
    if (pre.ok) {
      msg = 'Ready to print — this menu fits safely on one page.';
      warn = false;
    } else if (pre.reason === 'fonts' || pre.reason === 'images') {
      msg = 'Preparing fonts and images… give it a moment, then check again.';
    } else if (pre.reason === 'footer') {
      msg = 'Text reaches the footer. Return to the Editor and shorten the menu or reduce spacing.';
    } else {
      msg = 'Does not fit on one page. Use Shrink to Fit in the Editor, or shorten the menu.';
    }
    live.textContent = msg;
    live.classList.toggle('warn', warn);
    if (btn) btn.disabled = !pre.ok;
  });
}

export function getWorkspace(): Workspace {
  return current;
}

/** Open Home on a specific pane (used by File ▸ Settings and the command palette). */
export function goHomePane(pane: 'open' | 'new' | 'dishes' | 'settings'): void {
  homePane = pane;
  setWorkspace('home');
}

export function setWorkspace(mode: Workspace): void {
  current = mode;
  const app = document.getElementById('app');
  app?.setAttribute('data-workspace', mode);
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle('on', on);
    if (on) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  if (mode === 'home') renderHomeWorkspace();
  if (mode === 'export') renderExportWorkspace();
  if (mode === 'editor') window.dispatchEvent(new Event('resize'));
}

export function initWorkspaces(): void {
  initHomeWorkspace();
  initExportWorkspace();
  on('rail', () => {
    if (current === 'home') renderHomeWorkspace();
  });
  on('preview', () => {
    if (current === 'export') renderExportWorkspace();
  });
  setWorkspace('home');
}
