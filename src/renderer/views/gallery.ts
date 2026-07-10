// New-menu template gallery (#ovTpl): renders built-in + user-saved templates
// as scaled live thumbnails (renderMenuHTML on a sample menu), lets the user
// pick one, name the menu, and create it at the top of the library.
// Faithful port of the mockup's allTemplates / tplToSample / renderTplGrid /
// openGallery / #btnCreateMenu handlers, adjusted for the new model: divider
// rules are created directly in menu.rootRules (position 'between', after the
// section) instead of the mockup's legacy in-section rule items — the exact
// placement ensureRootRules would have migrated them to.

import type { DietKey, Dish, Menu, MenuStyle, Tag, Template } from '@shared/types';
import { newDish, newMenu, newRule, newSection, T } from '@shared/menu/factories';
import { normaliseMenuColumns } from '@shared/menu/normalize';
import { renderMenuHTML } from '@shared/menu/render';
import { BUILTIN_TEMPLATES } from '@shared/templates/builtins';
import { getActiveBrand } from '@shared/brand';
import { assetUrl } from '../brand-assets';
import { commit, getState, snapshot } from '../store';
import { setWorkspace } from '../workspace';

const brand = getActiveBrand();
const ASSETS = { crest: assetUrl(brand.assetKeys.crest), lockup: assetUrl(brand.assetKeys.lockup) };

const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: string | undefined | null): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

/** Mirror of the editor's setTab for the mobile layout (kept local — views may
 *  not import each other's render entry points). */
function setMobileTab(t: string): void {
  const app = document.getElementById('app');
  if (app) app.dataset.tab = t;
  document
    .querySelectorAll<HTMLButtonElement>('#tabbar button')
    .forEach((b) => b.classList.toggle('on', b.dataset.t === t));
}

function allTemplates(): Template[] {
  return [...BUILTIN_TEMPLATES, ...getState().userTemplates];
}

let selTpl: string = BUILTIN_TEMPLATES[0].id;

/** A template's Partial<MenuStyle> filled out to a complete MenuStyle. */
function styleFromTemplate(t: Template): MenuStyle {
  const style: MenuStyle = {
    paper: t.style.paper,
    header: t.style.header,
    showKey: t.style.showKey !== false,
    sc: t.style.sc ?? 1,
    dn: t.style.dn ?? 1,
  };
  if (t.style.stacked) style.stacked = true;
  return style;
}

/** Sample dishes used to make the gallery thumbnails look real (mockup's list). */
const SAMPLE_DISHES: { name: string; desc: string; price: string; tags: Tag[] }[] = [
  { name: 'Heritage Tomato', desc: 'basil, aged balsamic', price: '9', tags: [T('ve'), T('gf')] },
  { name: 'Chicken Parfait', desc: 'toasted brioche, chutney', price: '10', tags: [T('gf', 1)] },
  { name: 'Roast Cod', desc: 'brown shrimp butter, greens', price: '24', tags: [T('gf')] },
  { name: 'Rump of Lamb', desc: 'dauphinoise, red wine jus', price: '28', tags: [T('gf')] },
  { name: 'Sticky Toffee', desc: 'caramel, pecans', price: '9', tags: [T('v'), T('n')] },
  { name: 'Lemon Tart', desc: 'crème fraiche', price: '9', tags: [T('v')] },
];

/** Build a filled-in sample menu from a template for its thumbnail. */
function tplToSample(t: Template): Menu {
  const m = newMenu('Lunch Menu', styleFromTemplate(t));
  m.date = '';
  m.headerNote = t.headerNote || '';
  m.footer = t.footer || '';
  t.sections.forEach((ts, i) => {
    const n = ts.cols === 2 ? 4 : 2;
    const items: Dish[] = [];
    for (let k = 0; k < n; k++) {
      const d = SAMPLE_DISHES[(i * 2 + k) % SAMPLE_DISHES.length];
      items.push(newDish(d.name, d.desc, d.price, d.tags.map((tag) => ({ ...tag }))));
    }
    const section = newSection(ts.name, items, {
      prices: ts.prices !== false,
      cols: ts.cols || 1,
      note: ts.note || '',
      descMode: ts.descMode || (t.style.stacked ? 'below' : 'inline'),
    });
    m.sections.push(section);
    if ((i === 0 && t.leadRule) || ts.ruleBefore) m.rootRules.push(newRule('between', section.id));
  });
  normaliseMenuColumns(m);
  return m;
}

function renderTplGrid(): void {
  const grid = document.getElementById('tplGrid');
  if (!grid) return;
  const dietKey: DietKey[] = getState().settings.dietKey;
  grid.innerHTML = allTemplates()
    .map((t) => {
      const m = tplToSample(t);
      const w = t.style.paper === 'A5' ? 148 : 210;
      const hh = t.style.paper === 'A5' ? 210 : 297;
      const scale = Math.min(150 / (w * 3.7795), 182 / (hh * 3.7795));
      return `<div class="tpl-card ${t.id === selTpl ? 'sel' : ''}" data-id="${t.id}">
   ${t.builtin ? '' : `<button class="del" data-del="${t.id}" title="Delete this template">${ICON_X}</button>`}
   <div class="thumbbox"><div class="thumb" style="transform:scale(${scale});transform-origin:center">${renderMenuHTML(m, { dietKey, assets: ASSETS })}</div></div>
   <div class="nm">${esc(t.name.toUpperCase())}</div>
   <div class="meta">${t.style.paper || 'A4'}${t.builtin ? '' : ' · YOURS'}</div>
  </div>`;
    })
    .join('');
}

export function openGallery(): void {
  selTpl = BUILTIN_TEMPLATES[0].id;
  const nameIn = document.getElementById('newMenuName') as HTMLInputElement | null;
  if (nameIn) nameIn.value = '';
  renderTplGrid();
  document.getElementById('ovTpl')?.classList.add('show');
}

function closeGallery(): void {
  document.getElementById('ovTpl')?.classList.remove('show');
}

function onGridClick(e: Event): void {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const del = target.closest<HTMLElement>('[data-del]');
  if (del) {
    if (window.confirm('Delete this template? Menus made from it are unaffected.')) {
      snapshot();
      const state = getState();
      state.userTemplates = state.userTemplates.filter((t) => t.id !== del.dataset.del);
      commit(['editor', 'preview', 'rail']);
      renderTplGrid();
    }
    return;
  }
  const card = target.closest<HTMLElement>('.tpl-card');
  if (!card || !card.dataset.id) return;
  selTpl = card.dataset.id;
  renderTplGrid();
}

function createMenuFromSelection(): void {
  const t = allTemplates().find((x) => x.id === selTpl);
  if (!t) return;
  const nameIn = document.getElementById('newMenuName') as HTMLInputElement | null;
  const name = (nameIn?.value ?? '').trim() || 'New Menu';
  snapshot();
  const m = newMenu(name, styleFromTemplate(t));
  m.headerNote = t.headerNote || '';
  m.footer = t.footer || '';
  t.sections.forEach((ts, i) => {
    const section = newSection(ts.name, [], {
      prices: ts.prices !== false,
      cols: ts.cols || 1,
      note: ts.note || '',
      descMode: ts.descMode || (t.style.stacked ? 'below' : 'inline'),
    });
    m.sections.push(section);
    if ((i === 0 && t.leadRule) || ts.ruleBefore) m.rootRules.push(newRule('between', section.id));
  });
  const state = getState();
  state.menus.unshift(m);
  state.currentMenuId = m.id;
  closeGallery();
  commit(['all']);
  setWorkspace('editor');
  if (window.innerWidth <= 940) setMobileTab('edit');
}

export function initGallery(): void {
  document.getElementById('tplGrid')?.addEventListener('click', onGridClick);
  document.getElementById('btnCreateMenu')?.addEventListener('click', createMenuFromSelection);

  const overlay = document.getElementById('ovTpl');
  overlay?.addEventListener('click', (e) => {
    const target = e.target;
    if (target === overlay || (target instanceof Element && target.closest('[data-close]'))) closeGallery();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('show')) closeGallery();
  });
}
