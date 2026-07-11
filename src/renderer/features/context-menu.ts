// Right-click context menus for dishes and sections in the editor. Adds the
// fast operations the editor pane lacks — Duplicate, Move up/down, Delete —
// and gives every drag a click alternative. Self-contained: it reads the
// editor's data-iid / data-sid attributes and mutates the store directly,
// without touching the shared editor module.

import type { Dish, Section, SectionItem } from '@shared/types';
import { newDish, newSection, uid } from '@shared/menu/factories';
import { commit, currentMenu, snapshot } from '../store';
import { confirmDialog } from '../ui/confirm';
import { toast } from '../ui/toast';

interface CtxEntry {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  run?: () => void;
}

const isDish = (i: SectionItem | undefined): i is Dish => !!i && (i as { type?: string }).type !== 'rule';

function findDish(iid: string): { section: Section; index: number; dish: Dish } | null {
  for (const section of currentMenu().sections) {
    const index = section.items.findIndex((i) => isDish(i) && i.id === iid);
    if (index >= 0) return { section, index, dish: section.items[index] as Dish };
  }
  return null;
}

function cloneDish(d: Dish): Dish {
  const copy = newDish(d.name, d.desc, d.price, (d.tags ?? []).map((t) => ({ ...t })), d.note || '');
  copy.col = d.col;
  if (d.hidden) copy.hidden = d.hidden;
  return copy;
}

function cloneSection(s: Section): Section {
  const copy = newSection(s.name, [], {
    prices: s.prices,
    cols: s.cols,
    note: s.note,
    descMode: s.descMode,
    columnNames: [...(s.columnNames ?? [])],
  });
  copy.items = s.items.map((it) => (isDish(it) ? cloneDish(it) : ({ ...it, id: uid() } as SectionItem)));
  return copy;
}

/** Index of the nearest same-column dish in a direction, or -1 if none. */
function neighbourInColumn(section: Section, index: number, dir: -1 | 1): number {
  const col = Number((section.items[index] as Dish).col) || 0;
  for (let j = index + dir; j >= 0 && j < section.items.length; j += dir) {
    const it = section.items[j];
    if (isDish(it) && (Number(it.col) || 0) === col) return j;
  }
  return -1;
}

function duplicateDish(iid: string): void {
  const loc = findDish(iid);
  if (!loc) return;
  snapshot();
  loc.section.items.splice(loc.index + 1, 0, cloneDish(loc.dish));
  commit(['all']);
  toast('Dish duplicated.', { kind: 'success' });
}

export function moveDish(iid: string, dir: -1 | 1): void {
  const loc = findDish(iid);
  if (!loc) return;
  const j = neighbourInColumn(loc.section, loc.index, dir);
  if (j < 0) return;
  snapshot();
  const items = loc.section.items;
  [items[loc.index], items[j]] = [items[j], items[loc.index]];
  commit(['all']);
}

async function deleteDish(iid: string): Promise<void> {
  const loc = findDish(iid);
  if (!loc) return;
  if (loc.dish.name) {
    const ok = await confirmDialog({ title: `Delete “${loc.dish.name}”?`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
  }
  snapshot();
  loc.section.items.splice(loc.index, 1);
  commit(['all']);
  toast('Dish deleted.', { kind: 'info' });
}

function sectionIndex(sid: string): number {
  return currentMenu().sections.findIndex((s) => s.id === sid);
}

function duplicateSection(sid: string): void {
  const menu = currentMenu();
  const i = sectionIndex(sid);
  if (i < 0) return;
  snapshot();
  menu.sections.splice(i + 1, 0, cloneSection(menu.sections[i]));
  commit(['all']);
  toast('Section duplicated.', { kind: 'success' });
}

export function moveSection(sid: string, dir: -1 | 1): void {
  const menu = currentMenu();
  const i = sectionIndex(sid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= menu.sections.length) return;
  snapshot();
  [menu.sections[i], menu.sections[j]] = [menu.sections[j], menu.sections[i]];
  commit(['all']);
}

async function deleteSection(sid: string): Promise<void> {
  const menu = currentMenu();
  const i = sectionIndex(sid);
  if (i < 0) return;
  const s = menu.sections[i];
  const count = s.items.filter(isDish).length;
  const ok = await confirmDialog({
    title: `Delete section “${s.name || 'Untitled'}”?`,
    body: count ? `Its ${count} dish${count === 1 ? '' : 'es'} will be removed too.` : undefined,
    confirmLabel: 'Delete section',
    danger: true,
  });
  if (!ok) return;
  snapshot();
  menu.sections.splice(i, 1);
  commit(['all']);
  toast('Section deleted.', { kind: 'info' });
}

/* ------------------------------ menu UI ------------------------------ */

function closeMenu(): void {
  document.getElementById('ctxMenu')?.remove();
}

function showMenu(x: number, y: number, entries: CtxEntry[]): void {
  closeMenu();
  const menu = document.createElement('div');
  menu.id = 'ctxMenu';
  menu.className = 'ctx-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = entries
    .map((e, i) =>
      e.label === '-'
        ? '<hr>'
        : `<button class="ctx-item${e.danger ? ' danger' : ''}" role="menuitem" data-ctx="${i}" ${e.disabled ? 'disabled aria-disabled="true"' : ''}>${e.label}</button>`,
    )
    .join('');
  document.body.appendChild(menu);
  // Clamp to viewport.
  const r = menu.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - r.width - 8);
  const py = Math.min(y, window.innerHeight - r.height - 8);
  menu.style.left = `${Math.max(6, px)}px`;
  menu.style.top = `${Math.max(6, py)}px`;

  menu.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLElement>('[data-ctx]');
    if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
    const entry = entries[Number(btn.dataset.ctx)];
    closeMenu();
    entry?.run?.();
  });
  (menu.querySelector('.ctx-item:not([disabled])') as HTMLElement | null)?.focus();
}

function dishEntries(iid: string, section: Section, index: number): CtxEntry[] {
  return [
    { label: 'Duplicate dish', run: () => duplicateDish(iid) },
    { label: 'Move up', disabled: neighbourInColumn(section, index, -1) < 0, run: () => moveDish(iid, -1) },
    { label: 'Move down', disabled: neighbourInColumn(section, index, 1) < 0, run: () => moveDish(iid, 1) },
    { label: '-' },
    { label: 'Delete dish', danger: true, run: () => void deleteDish(iid) },
  ];
}

function sectionEntries(sid: string): CtxEntry[] {
  const menu = currentMenu();
  const i = sectionIndex(sid);
  return [
    { label: 'Duplicate section', run: () => duplicateSection(sid) },
    { label: 'Move section up', disabled: i <= 0, run: () => moveSection(sid, -1) },
    { label: 'Move section down', disabled: i >= menu.sections.length - 1, run: () => moveSection(sid, 1) },
    { label: '-' },
    { label: 'Delete section', danger: true, run: () => void deleteSection(sid) },
  ];
}

export function initContextMenus(): void {
  document.addEventListener('contextmenu', (e) => {
    const target = e.target;
    if (!(target instanceof Element) || !target.closest('#edScroll')) return;
    const dishEl = target.closest<HTMLElement>('.item[data-iid]');
    if (dishEl?.dataset.iid) {
      const loc = findDish(dishEl.dataset.iid);
      if (loc) {
        e.preventDefault();
        showMenu(e.clientX, e.clientY, dishEntries(dishEl.dataset.iid, loc.section, loc.index));
        return;
      }
    }
    const secEl = target.closest<HTMLElement>('.sec[data-sid]');
    if (secEl?.dataset.sid) {
      e.preventDefault();
      showMenu(e.clientX, e.clientY, sectionEntries(secEl.dataset.sid));
    }
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as Element)?.closest?.('#ctxMenu')) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  // Alt+Up / Alt+Down: reorder the focused dish or section — a keyboard
  // alternative to dragging. The editor re-renders synchronously on commit, so
  // focus is restored to the same field on the moved element immediately after.
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !active.closest('#edScroll')) return;
    const dir: -1 | 1 = e.key === 'ArrowUp' ? -1 : 1;
    const field = active.getAttribute('data-f');
    const dishEl = active.closest<HTMLElement>('.item[data-iid]');
    if (dishEl?.dataset.iid) {
      e.preventDefault();
      const iid = dishEl.dataset.iid;
      moveDish(iid, dir);
      const sel = field ? `.item[data-iid="${CSS.escape(iid)}"] [data-f="${field}"]` : `.item[data-iid="${CSS.escape(iid)}"] .iname`;
      (document.querySelector(sel) as HTMLElement | null)?.focus();
      return;
    }
    const secEl = active.closest<HTMLElement>('.sec[data-sid]');
    if (secEl?.dataset.sid) {
      e.preventDefault();
      const sid = secEl.dataset.sid;
      moveSection(sid, dir);
      (document.querySelector(`.sec[data-sid="${CSS.escape(sid)}"] .sname`) as HTMLElement | null)?.focus();
    }
  });
  window.addEventListener('resize', closeMenu);
  document.addEventListener('scroll', closeMenu, true);
}
