// Structured edit panel: the per-dish / per-section editor list, its delegated
// input/change/click handlers, and the pointer-based drag-and-drop for dishes
// and root divider rules (ghost + drop-line + root drop zones + edge
// auto-scroll). Also owns the editor head controls, the ⋯ More popover, the
// rail show/hide + rail/editor resize handles, and the mobile tab bar.
//
// Faithful port of the mockup's renderEditor + #edScroll handlers + drag block
// (reference/griffin-menu-studio.html), adjusted for the new model:
//   - state.cur            -> getState().currentMenuId
//   - cur()                -> currentMenu()
//   - findItem(m,id)       -> findDish(m,id) returning { section, dish }
//   - divider rules live ONLY in menu.rootRules (never in section.items)
//
// Commit discipline: text-field input handlers debounce a preview+rail commit
// (~160ms, the mockup's debPreview) so the editor DOM — and the focused input —
// is never re-rendered mid-keystroke. Structural actions snapshot() first and
// commit(['editor','preview','rail']).

import type { Dish, HeaderStyle, Menu, Paper, Rule, SectionItem, Template } from '@shared/types';
import { newDish, newRule, newSection, T, todayISO, uid, newMenu } from '@shared/menu/factories';
import { normaliseMenuColumns, normaliseRootRules, normaliseSectionColumns } from '@shared/menu/normalize';
import { usedCodes } from '@shared/menu/tags';
import { commit, currentMenu, findDish, getState, persist, snapshot } from '../store';
import type { Scope } from '../store';
import { fitPage } from '../layout-runtime';
import { openDishPicker } from './dishpicker';
import { toast } from '../ui/toast';

const SCOPES_ALL: Scope[] = ['editor', 'preview', 'rail'];

/** The editor's "current section" — mirrors `selectedMoveKey` in
 *  window-panels.ts:49. Drives the `.sec.selected` highlight; defaults to the
 *  first section whenever nothing has been explicitly picked yet. */
let selectedSectionId: string | null = null;

export function getSelectedSectionId(): string | null {
  if (selectedSectionId) return selectedSectionId;
  return currentMenu()?.sections[0]?.id ?? null;
}

export function setSelectedSectionId(id: string | null): void {
  selectedSectionId = id;
}

/* ================= helpers ================= */

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

function isDish(item: SectionItem): item is Dish {
  return (item as { type?: string }).type !== 'rule';
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

function closePops(): void {
  document.querySelectorAll('.more.open').forEach((x) => x.classList.remove('open'));
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/* ================= icons (mockup's ICONS map) ================= */

const ICONS = {
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff:
    '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10 5.3A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.4 6.5A16.5 16.5 0 0 0 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.4-1"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  dn: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  grip: '<svg viewBox="0 0 12 16"><g fill="currentColor" stroke="none"><circle cx="3" cy="3" r="1.4"/><circle cx="9" cy="3" r="1.4"/><circle cx="3" cy="8" r="1.4"/><circle cx="9" cy="8" r="1.4"/><circle cx="3" cy="13" r="1.4"/><circle cx="9" cy="13" r="1.4"/></g></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>',
};

/* ================= render ================= */

function rootRuleRow(r: Rule): string {
  return `<div class="rootrule" data-rid="${r.id}"><span class="handle rulehandle" title="Drag line above, between or below sections">${ICONS.grip}</span><div class="rulebody"><span class="ruleline"></span><span class="rulelabel">menu line</span><span class="ruleline"></span></div><button class="iconb danger" data-act="delrootrule" title="Delete line">${ICONS.x}</button></div>`;
}

function itemRow(it: Dish): string {
  const dietKey = getState().settings.dietKey;
  return `<div class="item ${it.hidden ? 'hid' : ''}" data-iid="${it.id}">
    <span class="handle" title="Drag to move">${ICONS.grip}</span>
    <div class="ibody"><div class="irow1"><input class="iname" data-f="name" value="${esc(it.name)}" placeholder="Dish name"><input class="iprice" data-f="price" value="${esc(it.price)}" placeholder="£" inputmode="decimal"></div>
    <input class="idesc" data-f="desc" value="${esc(it.desc)}" placeholder="description - e.g. seeded chilli oil">
    <div class="irow3">${dietKey
      .map((k) => {
        const t = (it.tags ?? []).find((x) => x.c === k.c);
        const cls = t ? (t.r ? 'tag req' : 'tag on') : 'tag';
        return `<button class="${cls}" data-tag="${esc(k.c)}" title="${esc(k.l)} - click: on → on request → off">${esc(k.c)}${t && t.r ? ' · req' : ''}</button>`;
      })
      .join('')}<input class="inote" data-f="note" value="${esc(it.note || '')}" placeholder="note, e.g. £7 supplement"></div></div>
    <div class="itools"><button class="iconb" data-act="hide" title="${it.hidden ? 'Hidden from print - click to show' : 'Shown - click to hide from print'}">${it.hidden ? ICONS.eyeoff : ICONS.eye}</button><button class="iconb danger" data-act="del" title="Delete dish">${ICONS.x}</button></div></div>`;
}

function columnOptions(cols: number): string {
  return [1, 2, 3, 4].map((n) => `<option value="${n}" ${n === cols ? 'selected' : ''}>${n}</option>`).join('');
}

export function renderEditor(): void {
  const m = currentMenu();
  if (!m) return;
  normaliseMenuColumns(m);

  const nameIn = el<HTMLInputElement>('edName');
  if (nameIn) nameIn.value = m.name;
  const dateIn = el<HTMLInputElement>('edDate');
  if (dateIn) dateIn.value = m.date || '';
  const paperSel = el<HTMLSelectElement>('edPaper');
  if (paperSel) paperSel.value = m.style.paper || 'A4';
  const headerSel = el<HTMLSelectElement>('edHeader');
  if (headerSel) headerSel.value = m.style.header || 'title';

  const sc = el<HTMLElement>('edScroll');
  if (!sc) return;

  let h = `<button class="addrootline" data-act="addrootrule" data-pos="top">+ ADD LINE AT TOP</button><div class="rootdropzone edge" data-rootpos="top"></div>`;
  (m.rootRules ?? []).filter((r) => r.position === 'top').forEach((r) => (h += rootRuleRow(r)));

  const selSecId = selectedSectionId ?? m.sections[0]?.id ?? null;
  for (const s of m.sections) {
    const cols = s.cols || 1;
    const secSelected = s.id === selSecId ? ' selected' : '';
    h += `<div class="sec${secSelected}" data-sid="${s.id}" data-section-id="${s.id}"><div class="sec-h"><input class="sname" value="${esc(s.name)}" data-f="name" title="Section name">
     <div class="more sec-more">
       <button class="iconb" data-act="secmenu" title="Section options">${ICONS.dots}</button>
       <div class="pop right">
         <button class="mi" data-act="secup">${ICONS.up} Move section up</button>
         <button class="mi" data-act="secdn">${ICONS.dn} Move section down</button>
         <hr>
         <button class="mi" data-act="secprices"><span class="mi-check">${s.prices ? ICONS.check : ''}</span>Show prices</button>
         <button class="mi" data-act="secdesc">Description: ${s.descMode === 'below' ? 'below name' : 'beside name'}</button>
         <label class="mi sec-cols-row"><span>Columns</span><select class="sec-col-select" data-sec-cols>${columnOptions(cols)}</select></label>
         <hr>
         <button class="mi danger" data-act="secdel">${ICONS.x} Delete section</button>
       </div>
     </div>
   </div>
   <input class="sec-note-in" data-f="note" value="${esc(s.note || '')}" placeholder="Section note (optional) - e.g. All served with roast potatoes…">`;
    const dishes = s.items.filter(isDish);
    if (cols > 1) {
      h += `<div class="sec-smartbar"><span><b>${cols} subsections</b> - rename them and drag dishes between them</span><span class="smart-note">Tip: empty columns stay valid</span></div><div class="colboard" style="--editor-cols:${cols}">`;
      for (let ci = 0; ci < cols; ci++) {
        const arr = dishes.filter((it) => (Number(it.col) || 0) === ci);
        h += `<div class="collane" data-sid="${s.id}" data-col="${ci}"><div class="colhead"><input class="colname" data-colname="${ci}" value="${esc(s.columnNames[ci] || '')}" placeholder="Subsection ${ci + 1}"><span class="count">${arr.length}</span></div><div class="items" data-sid="${s.id}" data-col="${ci}">${arr.map(itemRow).join('')}${arr.length ? '' : '<div class="col-empty">Drop dishes here</div>'}</div><div class="col-addrow"><button data-act="add" data-col="${ci}">+ Dish</button></div></div>`;
      }
      h += `</div><div class="addrow"><button data-act="copy">Copy a dish from another menu…</button></div>`;
    } else {
      h += `<div class="quickhint"><b>Fast edit:</b> drag dishes by the dots. Switch to 2+ columns to create named subsections automatically.</div><div class="items" data-sid="${s.id}" data-col="0">${dishes.map(itemRow).join('')}</div><div class="addrow"><button data-act="add">+ Add a dish</button><button data-act="copy">Copy a dish from another menu…</button></div>`;
    }
    h += `</div>`;
    h += `<div class="rootdropzone" data-rootpos="after" data-after="${s.id}"></div>`;
    (m.rootRules ?? [])
      .filter((r) => r.afterSectionId === s.id && r.position !== 'top')
      .forEach((r) => (h += rootRuleRow(r)));
    h += `<button class="addrootline" data-act="addrootrule" data-after="${s.id}">+ ADD LINE BELOW SECTION</button>`;
  }

  h += `<div class="rootdropzone edge" data-rootpos="bottom"></div>`;
  (m.rootRules ?? [])
    .filter((r) => !r.afterSectionId && r.position !== 'top')
    .forEach((r) => (h += rootRuleRow(r)));
  h += `<div class="root-actions"><button class="addsec" id="btnAddSec">+ ADD SECTION</button><button class="addrootline" data-act="addrootrule">+ ADD LINE AT END</button></div><div class="foot-ed"><div class="cap">FOOTER - PRINTED AT THE BOTTOM OF THE PAGE</div><textarea id="edFooter" placeholder="Footer lines…">${esc(m.footer || '')}</textarea><label class="chkline"><input type="checkbox" id="edShowPrices" ${m.style.showPrices !== false ? 'checked' : ''}> Show prices on the menu</label><label class="chkline"><input type="checkbox" id="edShowKey" ${m.style.showKey ? 'checked' : ''}> Print the dietary key automatically (only the codes used on this menu) — turn off to write the key yourself</label></div>`;

  sc.innerHTML = h;
}

/* ================= delegated editor events ================= */

let debounceTimer: number | undefined;
/** The mockup's debPreview: persist + refresh preview/rail without touching
 *  the editor DOM, so the focused text field survives every keystroke. */
function debPreview(): void {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => commit(['preview', 'rail']), 160);
}

function onEdScrollInput(e: Event): void {
  const m = currentMenu();
  if (!m) return;
  const target = e.target as HTMLElement;
  if (target.id === 'edFooter') {
    m.footer = (target as HTMLTextAreaElement).value;
    debPreview();
    return;
  }
  const input = target as HTMLInputElement;
  const secEl = target.closest<HTMLElement>('.sec');
  const itEl = target.closest<HTMLElement>('.item');
  if (input.dataset.colname != null && secEl) {
    const s = m.sections.find((x) => x.id === secEl.dataset.sid);
    if (s) {
      normaliseSectionColumns(s);
      s.columnNames[Number(input.dataset.colname)] = input.value;
      debPreview();
    }
    return;
  }
  const f = input.dataset.f;
  if (!f) return;
  if (itEl) {
    const found = findDish(m, itEl.dataset.iid ?? '');
    if (found && (f === 'name' || f === 'desc' || f === 'price' || f === 'note')) {
      found.dish[f] = input.value;
      if (f === 'price' && input.value.trim()) {
        let flipped = false;
        if (!found.section.prices) {
          found.section.prices = true;
          flipped = true;
        }
        if (m.style.showPrices === false) {
          m.style.showPrices = true;
          flipped = true;
        }
        if (flipped) {
          commit(['editor', 'preview', 'rail']);
          return;
        }
      }
      debPreview();
    }
  } else if (secEl) {
    const s = m.sections.find((x) => x.id === secEl.dataset.sid);
    if (s && (f === 'name' || f === 'note')) {
      s[f] = input.value;
      debPreview();
    }
  }
}

function onEdScrollChange(e: Event): void {
  const target = e.target as HTMLElement;
  if (target.id === 'edShowKey') {
    snapshot();
    const menu = currentMenu();
    const checked = (target as HTMLInputElement).checked;
    menu.style.showKey = checked;
    if (!checked && !menu.dietKeyText) {
      const used = usedCodes(menu, getState().settings.dietKey);
      menu.dietKeyText = used.map((k) => `(${k.c}) ${k.l}`).join('  ');
    }
    commit(); // preview + rail; the checkbox itself already shows the new state
  } else if (target.id === 'edShowPrices') {
    snapshot();
    currentMenu().style.showPrices = (target as HTMLInputElement).checked;
    commit(); // preview + rail; the checkbox itself already shows the new state
  } else if (target instanceof HTMLSelectElement && target.dataset.secCols != null) {
    const secEl = target.closest<HTMLElement>('.sec');
    const section = secEl ? currentMenu().sections.find((x) => x.id === secEl.dataset.sid) : null;
    if (!section) return;
    snapshot();
    section.cols = Math.max(1, Math.min(4, Number(target.value) || 1));
    normaliseSectionColumns(section);
    commit(SCOPES_ALL);
  } else {
    persist();
  }
}

/** Updates `selectedSectionId` + the `.sec.selected` highlight to match the
 *  `.sec` block containing `target`, DOM-patching in place (no re-render) so
 *  focus/scroll position survive — mirrors `handleMoveSelection` in
 *  window-panels.ts. */
function updateSelectedSection(target: Element): void {
  const secEl = target.closest<HTMLElement>('.sec');
  const id = secEl?.dataset.sectionId;
  if (!id || id === selectedSectionId) return;
  selectedSectionId = id;
  document.querySelectorAll('#edScroll .sec.selected').forEach((el) => el.classList.remove('selected'));
  secEl.classList.add('selected');
}

function onEdScrollFocusIn(e: FocusEvent): void {
  if (!(e.target instanceof Element)) return;
  updateSelectedSection(e.target);
}

function onEdScrollClick(e: Event): void {
  const m = currentMenu();
  if (!m) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  updateSelectedSection(target);

  if (target.id === 'btnAddSec' || target.closest('#btnAddSec')) {
    snapshot();
    m.sections.push(newSection('New Section', []));
    commit(SCOPES_ALL);
    return;
  }

  const tagB = target.closest<HTMLElement>('[data-tag]');
  if (tagB) {
    const c = tagB.dataset.tag ?? '';
    if (!c) return; // stale/blank code button (#1) — never create a phantom empty-code tag
    const itemEl = tagB.closest<HTMLElement>('.item');
    const found = itemEl ? findDish(m, itemEl.dataset.iid ?? '') : null;
    if (!found) return;
    snapshot();
    const tags = (found.dish.tags = found.dish.tags ?? []);
    const i = tags.findIndex((t) => t.c === c);
    if (i < 0) tags.push(T(c));
    else if (!tags[i].r) tags[i].r = 1;
    else tags.splice(i, 1);
    commit(SCOPES_ALL);
    return;
  }

  const b = target.closest<HTMLElement>('[data-act]');
  if (!b) return;
  const act = b.dataset.act;

  if (act === 'secmenu') {
    e.stopPropagation();
    const wrap = b.closest<HTMLElement>('.more');
    const wasOpen = wrap?.classList.contains('open') ?? false;
    closePops();
    if (wrap && !wasOpen) wrap.classList.add('open');
    return;
  }

  const secEl = b.closest<HTMLElement>('.sec');
  const s = secEl ? (m.sections.find((x) => x.id === secEl.dataset.sid) ?? null) : null;
  const itEl = b.closest<HTMLElement>('.item');

  if (act === 'copy') {
    if (s) openDishPicker(s.id);
    return;
  }
  if (act === 'add') {
    if (!s) return;
    snapshot();
    const dish = newDish();
    dish.col = Number(b.dataset.col) || 0;
    s.items.push(dish);
    commit(SCOPES_ALL);
    // commit re-rendered the editor synchronously — focus the new dish's name.
    const rows = document.querySelectorAll<HTMLElement>(`.items[data-sid="${s.id}"] .item`);
    const last = rows[rows.length - 1];
    last?.querySelector<HTMLInputElement>('.iname')?.focus();
    return;
  }
  if (act === 'addrootrule') {
    snapshot();
    m.rootRules = m.rootRules ?? [];
    if (b.dataset.pos === 'top') {
      m.rootRules.push(newRule('top', null));
    } else {
      const after = b.dataset.after || null;
      m.rootRules.push(newRule(after ? 'between' : 'bottom', after));
    }
    commit(SCOPES_ALL);
    return;
  }
  if (act === 'delrootrule') {
    const rr = b.closest<HTMLElement>('.rootrule');
    if (!rr) return;
    snapshot();
    m.rootRules = (m.rootRules ?? []).filter((r) => r.id !== rr.dataset.rid);
    commit(SCOPES_ALL);
    return;
  }
  if (act === 'secdel') {
    if (!s) return;
    if (s.items.length && !window.confirm(`Delete section “${s.name}” and its contents?`)) return;
    snapshot();
    const priorSectionIds = m.sections.map((x) => x.id);
    m.sections = m.sections.filter((x) => x !== s);
    normaliseRootRules(m, priorSectionIds);
    commit(SCOPES_ALL);
    return;
  }
  if (act === 'secup' || act === 'secdn') {
    if (!s) return;
    const i = m.sections.indexOf(s);
    const j = act === 'secup' ? i - 1 : i + 1;
    if (j < 0 || j >= m.sections.length) return;
    snapshot();
    [m.sections[i], m.sections[j]] = [m.sections[j], m.sections[i]];
    commit(SCOPES_ALL);
    return;
  }
  if (act === 'secprices') {
    if (!s) return;
    snapshot();
    s.prices = !s.prices;
    commit(SCOPES_ALL);
    return;
  }
  if (act === 'secdesc') {
    if (!s) return;
    snapshot();
    s.descMode = s.descMode === 'below' ? 'inline' : 'below';
    commit(SCOPES_ALL);
    return;
  }
  if (itEl) {
    const found = findDish(m, itEl.dataset.iid ?? '');
    if (!found) return;
    if (act === 'hide') {
      snapshot();
      found.dish.hidden = !found.dish.hidden;
      commit(SCOPES_ALL);
      return;
    }
    if (act === 'del') {
      if (found.dish.name && !window.confirm(`Delete “${found.dish.name}”?`)) return;
      snapshot();
      found.section.items = found.section.items.filter((x) => x !== found.dish);
      commit(SCOPES_ALL);
    }
  }
}

/* ================= drag & drop (pointer-based, mouse + touch) ================= */
// Ported 1:1 from the mockup: a floating .ghost chip follows the pointer, a
// .drop-line marks the insertion point between dish rows, column lanes light
// up via .drop-hot, and root rules target the .rootdropzone strips (top /
// after-a-section / bottom). #edScroll auto-scrolls near its edges.

interface DishTarget {
  kind: 'dish';
  sid: string;
  col: number;
  before: string | null;
}

interface RuleTarget {
  kind: 'rule';
  pos: string;
  after: string | null;
}

interface DragCtx {
  kind: 'dish' | 'rule';
  iid: string;
  rid: string;
  row: HTMLElement;
  ghost: HTMLElement;
  line: HTMLElement;
  target: DishTarget | RuleTarget | null;
}

let drag: DragCtx | null = null;

function moveGhost(e: PointerEvent): void {
  if (!drag) return;
  drag.ghost.style.left = `${e.clientX + 12}px`;
  drag.ghost.style.top = `${e.clientY - 14}px`;
}

function clearDragTargets(): void {
  if (!drag) return;
  drag.line.remove();
  drag.target = null;
  document.querySelectorAll('.collane.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
  document.querySelectorAll('.rootdropzone.hot').forEach((x) => x.classList.remove('hot'));
}

function onEdScrollPointerDown(e: PointerEvent): void {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const handle = target.closest<HTMLElement>('.handle');
  if (!handle) return;
  const row = handle.closest<HTMLElement>('.item,.rootrule');
  if (!row) return;
  e.preventDefault();
  const m = currentMenu();
  if (!m) return;

  const isRule = row.classList.contains('rootrule');
  let label = 'horizontal line';
  if (!isRule) {
    const found = findDish(m, row.dataset.iid ?? '');
    if (!found) return;
    label = found.dish.name || '(untitled dish)';
  }

  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.textContent = isRule ? '── horizontal line ──' : label;
  document.body.appendChild(ghost);
  const line = document.createElement('div');
  line.className = 'drop-line';

  drag = {
    kind: isRule ? 'rule' : 'dish',
    iid: row.dataset.iid ?? '',
    rid: row.dataset.rid ?? '',
    row,
    ghost,
    line,
    target: null,
  };
  row.classList.add('dragging');
  moveGhost(e);
  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', onDragEnd, { once: true });
  window.addEventListener('pointercancel', onDragEnd, { once: true });
}

function onDragMove(e: PointerEvent): void {
  if (!drag) return;
  e.preventDefault();
  moveGhost(e);

  // Auto-scroll the editor list when the pointer nears its top/bottom edge.
  const sc = document.getElementById('edScroll');
  if (sc) {
    const rect = sc.getBoundingClientRect();
    if (e.clientY < rect.top + 46) sc.scrollTop -= 9;
    else if (e.clientY > rect.bottom - 46) sc.scrollTop += 9;
  }

  // Hit-test underneath the ghost.
  drag.ghost.style.display = 'none';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  drag.ghost.style.display = '';
  clearDragTargets();

  if (drag.kind === 'rule') {
    const zone = under?.closest<HTMLElement>('.rootdropzone');
    if (!zone) return;
    zone.classList.add('hot');
    drag.target = { kind: 'rule', pos: zone.dataset.rootpos ?? '', after: zone.dataset.after || null };
    return;
  }

  const items = under?.closest<HTMLElement>('.items');
  if (!items) return;
  const lane = items.closest<HTMLElement>('.collane');
  if (lane) lane.classList.add('drop-hot');

  const rows = Array.from(items.querySelectorAll<HTMLElement>('.item')).filter((x) => x !== drag?.row);
  let placed = false;
  for (const rw of rows) {
    const rr = rw.getBoundingClientRect();
    if (e.clientY < rr.top + rr.height / 2) {
      items.insertBefore(drag.line, rw);
      drag.target = {
        kind: 'dish',
        sid: items.dataset.sid ?? '',
        col: Number(items.dataset.col) || 0,
        before: rw.dataset.iid ?? null,
      };
      placed = true;
      break;
    }
  }
  if (!placed) {
    items.appendChild(drag.line);
    drag.target = { kind: 'dish', sid: items.dataset.sid ?? '', col: Number(items.dataset.col) || 0, before: null };
  }
}

function applyDrop(m: Menu, d: DragCtx, target: DishTarget | RuleTarget): void {
  if (target.kind === 'rule') {
    const r = (m.rootRules ?? []).find((x) => x.id === d.rid);
    if (!r) return;
    if (target.pos === 'top') {
      r.position = 'top';
      r.afterSectionId = null;
    } else if (target.pos === 'bottom') {
      r.position = 'bottom';
      r.afterSectionId = null;
    } else {
      r.position = 'between';
      r.afterSectionId = target.after || null;
    }
    return;
  }
  const from = findDish(m, d.iid);
  if (!from) return;
  const dest = m.sections.find((x) => x.id === target.sid);
  if (!dest) return;
  // Remove first (mockup order) so a same-section index is computed post-removal.
  from.section.items = from.section.items.filter((x) => x !== from.dish);
  from.dish.col = dest.cols > 1 ? target.col : 0;
  if (target.before) {
    const bi = dest.items.findIndex((x) => x.id === target.before);
    if (bi >= 0) dest.items.splice(bi, 0, from.dish);
    else dest.items.push(from.dish);
  } else {
    dest.items.push(from.dish);
  }
}

function onDragEnd(): void {
  if (!drag) return;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragEnd);
  drag.ghost.remove();
  drag.line.remove();
  drag.row.classList.remove('dragging');
  document.querySelectorAll('.collane.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
  document.querySelectorAll('.rootdropzone.hot').forEach((x) => x.classList.remove('hot'));

  if (drag.target) {
    const m = currentMenu();
    if (m) {
      snapshot();
      applyDrop(m, drag, drag.target);
      commit(SCOPES_ALL);
    }
  }
  drag = null;
}

/* ================= head controls ================= */

function wireHeadControls(): void {
  el<HTMLInputElement>('edName')?.addEventListener('input', (e) => {
    currentMenu().name = (e.target as HTMLInputElement).value;
    debPreview();
  });
  el<HTMLInputElement>('edDate')?.addEventListener('change', (e) => {
    snapshot();
    currentMenu().date = (e.target as HTMLInputElement).value;
    commit(SCOPES_ALL);
  });
  el<HTMLSelectElement>('edPaper')?.addEventListener('change', (e) => {
    snapshot();
    currentMenu().style.paper = (e.target as HTMLSelectElement).value as Paper;
    commit(SCOPES_ALL);
  });
  el<HTMLSelectElement>('edHeader')?.addEventListener('change', (e) => {
    snapshot();
    currentMenu().style.header = (e.target as HTMLSelectElement).value as HeaderStyle;
    commit(SCOPES_ALL);
  });
}

/* ================= ⋯ More popover ================= */

export function duplicateMenu(): void {
  snapshot();
  const state = getState();
  const m = currentMenu();
  const copy = JSON.parse(JSON.stringify(m)) as Menu;
  copy.id = uid();
  copy.date = todayISO();
  const sectionIdMap = new Map<string, string>();
  const ruleIdMap = new Map<string, string>();
  copy.sections.forEach((s) => {
    const nid = uid();
    sectionIdMap.set(s.id, nid);
    s.id = nid;
    s.items.forEach((it) => {
      it.id = uid();
    });
  });
  // The mockup left rootRules pointing at the old section ids (losing them on
  // the duplicate); remap them so between-section lines survive duplication.
  (copy.rootRules ?? []).forEach((r) => {
    const nid = uid();
    ruleIdMap.set(r.id, nid);
    r.id = nid;
    if (r.afterSectionId) r.afterSectionId = sectionIdMap.get(r.afterSectionId) ?? null;
  });
  const pos: Menu['pos'] = {};
  Object.entries(copy.pos ?? {}).forEach(([key, value]) => {
    let nk = key;
    if (key.startsWith('sec:')) {
      const mapped = sectionIdMap.get(key.slice(4));
      nk = mapped ? `sec:${mapped}` : key;
    } else if (key.startsWith('rule:')) {
      const mapped = ruleIdMap.get(key.slice(5));
      nk = mapped ? `rule:${mapped}` : key;
    }
    pos[nk] = value;
  });
  copy.pos = pos;
  state.menus.splice(state.menus.indexOf(m) + 1, 0, copy);
  state.currentMenuId = copy.id;
  commit(SCOPES_ALL);
}

export function deleteCurrentMenu(): void {
  const m = currentMenu();
  if (!window.confirm(`Delete “${m.name}” (${fmtDate(m.date)})? This can't be undone after you leave.`)) return;
  snapshot();
  const state = getState();
  state.menus = state.menus.filter((x) => x !== m);
  if (!state.menus.length) {
    const fresh = newMenu('New Menu');
    fresh.sections = [newSection('Starters', [])];
    state.menus.push(fresh);
  }
  state.currentMenuId = state.menus[0].id;
  commit(SCOPES_ALL);
}

export async function saveLayoutAsTemplate(): Promise<void> {
  const m = currentMenu();
  const name = window.prompt('Template name:', `${m.name} layout`);
  if (!name) return;
  snapshot();
  const template: Template = {
    id: uid(),
    name,
    style: JSON.parse(JSON.stringify(m.style)) as Template['style'],
    headerNote: m.headerNote,
    footer: m.footer,
    sections: m.sections.map((s) => ({
      name: s.name,
      prices: s.prices,
      cols: s.cols || 1,
      note: s.note,
      descMode: s.descMode || 'inline',
    })),
  };
  getState().userTemplates.push(template);
  const result = await window.griffin?.saveTemplate(template, getState().settings.storage);
  if (result && (result.canceled || result.error)) {
    getState().userTemplates = getState().userTemplates.filter((candidate) => candidate.id !== template.id);
    persist();
    toast(`Template could not be saved: ${result.error || 'operation cancelled.'}`, { kind: 'error' });
    return;
  }
  persist();
  toast(`Saved. "${name}" now appears in the New Menu gallery.`, { kind: 'success' });
}

/* ================= rail show/hide + resize handles ================= */

function mainGridEl(): HTMLElement | null {
  return document.getElementById('mainGrid');
}

function applyRailWidth(): void {
  mainGridEl()?.style.setProperty('--railw', `${getState().settings.railWidth ?? 230}px`);
}

function applyEditorWidth(): void {
  mainGridEl()?.style.setProperty('--edw', `${getState().settings.editorWidth ?? 380}px`);
}

function applyRailHidden(): void {
  mainGridEl()?.classList.toggle('noRail', !!getState().settings.railHidden);
  requestAnimationFrame(() => fitPage());
}

function wireRailToggle(): void {
  el<HTMLElement>('btnToggleRail')?.addEventListener('click', () => {
    const settings = getState().settings;
    settings.railHidden = !settings.railHidden;
    persist();
    applyRailHidden();
  });
}

function wireRailResize(): void {
  const handle = document.getElementById('railHandle');
  const grid = mainGridEl();
  if (!handle || !grid) return;
  let dragging = false;
  const move = (e: PointerEvent): void => {
    if (!dragging) return;
    const rect = grid.getBoundingClientRect();
    const w = Math.max(160, Math.min(420, e.clientX - rect.left));
    grid.style.setProperty('--railw', `${w}px`);
  };
  const end = (): void => {
    dragging = false;
    handle.classList.remove('drag');
    window.removeEventListener('pointermove', move);
    const w = parseInt(getComputedStyle(grid).getPropertyValue('--railw'), 10) || 230;
    getState().settings.railWidth = w;
    persist();
    fitPage();
  };
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.classList.add('drag');
    e.preventDefault();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  });
}

function wireEditorResize(): void {
  const handle = document.getElementById('editorHandle');
  const grid = mainGridEl();
  if (!handle || !grid) return;
  let dragging = false;
  const move = (e: PointerEvent): void => {
    if (!dragging) return;
    const rect = grid.getBoundingClientRect();
    const settings = getState().settings;
    const railOffset = settings.railHidden ? 0 : (settings.railWidth ?? 230) + 6;
    const w = Math.max(300, Math.min(720, e.clientX - rect.left - railOffset));
    grid.style.setProperty('--edw', `${w}px`);
    requestAnimationFrame(() => fitPage());
  };
  const end = (): void => {
    dragging = false;
    handle.classList.remove('drag');
    window.removeEventListener('pointermove', move);
    const w = parseInt(getComputedStyle(grid).getPropertyValue('--edw'), 10) || 380;
    getState().settings.editorWidth = w;
    persist();
    fitPage();
  };
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.classList.add('drag');
    e.preventDefault();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  });
}

/* ================= mobile tabs ================= */

export function setTab(t: string): void {
  const app = document.getElementById('app');
  if (app) app.dataset.tab = t;
  document
    .querySelectorAll<HTMLButtonElement>('#tabbar button')
    .forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'view') {
    window.setTimeout(() => fitPage(), 30);
    window.setTimeout(() => fitPage(), 200);
  }
}

function wireTabbar(): void {
  document.getElementById('tabbar')?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const b = target.closest<HTMLElement>('button');
    if (b && b.dataset.t) setTab(b.dataset.t);
  });
}

/* ================= init ================= */

export function initEditor(): void {
  const sc = document.getElementById('edScroll');
  if (sc) {
    sc.addEventListener('input', onEdScrollInput);
    sc.addEventListener('change', onEdScrollChange);
    sc.addEventListener('click', onEdScrollClick);
    sc.addEventListener('focusin', onEdScrollFocusIn);
    sc.addEventListener('pointerdown', onEdScrollPointerDown);
  }

  wireHeadControls();
  wireRailToggle();
  wireRailResize();
  wireEditorResize();
  wireTabbar();

  applyRailWidth();
  applyEditorWidth();
  applyRailHidden();

  renderEditor();
}
