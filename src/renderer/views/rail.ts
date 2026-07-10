// Menu rail (left-hand list of menus) + the mobile menus panel.
// Faithful port of the mockup's renderRail / onMenuListClick
// (reference/griffin-menu-studio.html). State changes go through the store
// only — commit() emits scopes and the shell re-renders the other views.

import { commit, getState, setState } from '../store';
import { openGallery } from './gallery';

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

/** "2026-05-21" -> "21.05.26" (mockup's fmtDate). */
export function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

function closePops(): void {
  document.querySelectorAll('.more.open').forEach((x) => x.classList.remove('open'));
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

export function renderRail(): void {
  const state = getState();
  const rows = state.menus
    .map(
      (x) =>
        `<button class="mrow ${x.id === state.currentMenuId ? 'on' : ''}" data-id="${x.id}"><span class="nm">${esc(
          x.name,
        )}</span><span class="dt">${fmtDate(x.date)}</span></button>`,
    )
    .join('');
  const panel = document.getElementById('menusPanel');
  if (panel) panel.innerHTML = rows + `<button class="newrow" data-new>+ NEW MENU…</button>`;
  const rail = document.getElementById('railScroll');
  if (rail) rail.innerHTML = rows;
}

function onMenuListClick(e: Event): void {
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (target.closest('[data-new]')) {
    closePops();
    openGallery();
    return;
  }
  const button = target.closest<HTMLElement>('.mrow');
  if (!button || !button.dataset.id) return;
  const state = getState();
  state.currentMenuId = button.dataset.id;
  setState(state);
  closePops();
  commit(['all']);
  if (window.innerWidth <= 940) setMobileTab('edit');
}

export function initRail(): void {
  document.getElementById('menusPanel')?.addEventListener('click', onMenuListClick);
  document.getElementById('railScroll')?.addEventListener('click', onMenuListClick);
  document.getElementById('btnNewMenuRail')?.addEventListener('click', () => openGallery());
  renderRail();
}
