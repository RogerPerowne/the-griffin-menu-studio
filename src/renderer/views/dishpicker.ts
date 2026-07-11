// "Copy a dish" picker (#ovDish): searches every dish on every menu and
// inserts a deep copy (fresh id) into the target section of the open menu.
// Faithful port of the mockup's openDishPicker / renderDishPick / #dishPick
// click handler, using findDish and the store instead of globals.

import type { Dish, SectionItem } from '@shared/types';
import { uid } from '@shared/menu/factories';
import { commit, currentMenu, findDish, getState, snapshot } from '../store';
import { escapeHtml as esc } from '../util/escape';

function isDish(item: SectionItem): item is Dish {
  return (item as { type?: string }).type !== 'rule';
}

let pickTarget: string | null = null;

export function openDishPicker(sectionId: string): void {
  pickTarget = sectionId;
  const search = document.getElementById('dishSearch') as HTMLInputElement | null;
  if (search) search.value = '';
  renderDishPick('');
  document.getElementById('ovDish')?.classList.add('show');
  window.setTimeout(() => search?.focus(), 50);
}

function closeDishPicker(): void {
  document.getElementById('ovDish')?.classList.remove('show');
}

function renderDishPick(query: string): void {
  const q = query.toLowerCase();
  let h = '';
  for (const m of getState().menus) {
    const hits: Dish[] = [];
    m.sections.forEach((s) =>
      s.items.filter(isDish).forEach((i) => {
        if (i.name && (!q || `${i.name} ${i.desc ?? ''}`.toLowerCase().includes(q))) hits.push(i);
      }),
    );
    if (!hits.length) continue;
    h += `<div class="dp-g">${esc(m.name.toUpperCase())}</div>`;
    h += hits
      .map(
        (i) =>
          `<button class="dp-i" data-m="${m.id}" data-i="${i.id}"><span class="n">${esc(i.name)}</span>${
            i.price ? ` <span style="font-size:12px;color:#8A8074">${esc(i.price)}</span>` : ''
          }${i.desc ? `<div class="d">${esc(i.desc)}</div>` : ''}</button>`,
      )
      .join('');
  }
  const pick = document.getElementById('dishPick');
  if (pick) {
    pick.innerHTML = h || '<div style="padding:16px;color:#9A9082;font-style:italic">No dishes found.</div>';
  }
}

function onPickClick(e: Event): void {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const b = target.closest<HTMLElement>('.dp-i');
  if (!b) return;
  const src = getState().menus.find((m) => m.id === b.dataset.m);
  if (!src) return;
  const found = findDish(src, b.dataset.i ?? '');
  if (!found) return;
  const dest = currentMenu()?.sections.find((s) => s.id === pickTarget);
  if (!dest) return;
  snapshot();
  const copy = JSON.parse(JSON.stringify(found.dish)) as Dish;
  copy.id = uid();
  copy.hidden = false;
  copy.col = 0;
  dest.items.push(copy);
  closeDishPicker();
  commit(['editor', 'preview', 'rail']);
}

export function initDishPicker(): void {
  document
    .getElementById('dishSearch')
    ?.addEventListener('input', (e) => renderDishPick((e.target as HTMLInputElement).value));
  document.getElementById('dishPick')?.addEventListener('click', onPickClick);

  const overlay = document.getElementById('ovDish');
  overlay?.addEventListener('click', (e) => {
    const target = e.target;
    if (target === overlay || (target instanceof Element && target.closest('[data-close]'))) closeDishPicker();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('show')) closeDishPicker();
  });
}
