// Quick bulk-add: paste or type a whole list of dishes and add them to a
// section in one action. This is the fastest way to build or refresh a menu —
// a restaurant can paste their new list straight in. Self-contained (factories
// + store); it never edits the shared editor module.

import { newDish, newSection } from '@shared/menu/factories';
import { commit, currentMenu, snapshot } from '../store';
import { toast } from '../ui/toast';
import { parseDishLines } from './parse-dishes';
import { escapeHtml as escAttr } from '../util/escape';
import { trapFocus } from '../util/focus-trap';

export { parseDishLines };

function sectionOptions(selectedId: string): string {
  const menu = currentMenu();
  const opts = menu.sections
    .map((s) => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escAttr(s.name || 'Untitled section')}</option>`)
    .join('');
  return `${opts}<option value="__new">➕ New section…</option>`;
}

export function openBulkAddDishes(): void {
  const menu = currentMenu();
  if (!menu) {
    toast('Open or create a menu first, then add dishes.', { kind: 'info' });
    return;
  }
  if (document.getElementById('bulkAddRoot')) return;
  const defaultSection = menu.sections[menu.sections.length - 1]?.id ?? '__new';

  const root = document.createElement('div');
  root.id = 'bulkAddRoot';
  root.className = 'confirm-overlay';
  root.innerHTML = `<div class="bulk-panel" role="dialog" aria-modal="true" aria-labelledby="bulkTitle">
      <h2 class="confirm-title" id="bulkTitle">Add several dishes at once</h2>
      <p class="confirm-body">Paste or type <b>one dish per line</b>. Separate name, description and price with <b>|</b> (or a dash). A price at the end of a line is detected automatically.</p>
      <label class="bulk-field"><span>Add to section</span>
        <select id="bulkSection">${sectionOptions(defaultSection)}</select></label>
      <textarea id="bulkText" class="bulk-text" rows="9" spellcheck="true" placeholder="Heritage Tomato | basil, aged balsamic | 9&#10;Roast Cod - brown shrimp butter, greens - 24&#10;Sticky Toffee Pudding | caramel, pecans | 9"></textarea>
      <p class="bulk-count" id="bulkCount">0 dishes ready</p>
      <div class="confirm-actions">
        <button class="confirm-cancel" type="button" id="bulkCancel">Cancel</button>
        <button class="confirm-ok primary-choice" type="button" id="bulkAdd" disabled>Add dishes</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const text = document.getElementById('bulkText') as HTMLTextAreaElement;
  const count = document.getElementById('bulkCount') as HTMLElement;
  const addBtn = document.getElementById('bulkAdd') as HTMLButtonElement;
  const sectionSel = document.getElementById('bulkSection') as HTMLSelectElement;

  const recount = (): number => {
    const n = parseDishLines(text.value).length;
    count.textContent = `${n} dish${n === 1 ? '' : 'es'} ready`;
    addBtn.disabled = n === 0;
    return n;
  };
  text.addEventListener('input', recount);

  const panel = root.querySelector<HTMLElement>('.bulk-panel')!;
  const close = (): void => { trap.release(); root.remove(); };
  const trap = trapFocus(panel, { onEscape: close });
  text.focus(); // prefer the paste box over the first control
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitAdd(); }
  });
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  document.getElementById('bulkCancel')?.addEventListener('click', close);

  function commitAdd(): void {
    const dishes = parseDishLines(text.value);
    if (!dishes.length) return;
    const live = currentMenu();
    snapshot();
    let section = live.sections.find((s) => s.id === sectionSel.value);
    if (!section) {
      section = newSection('New Section', []);
      live.sections.push(section);
    }
    for (const d of dishes) section.items.push(newDish(d.name, d.desc, d.price));
    commit(['all']);
    close();
    toast(`Added ${dishes.length} dish${dishes.length === 1 ? '' : 'es'} to ${section.name || 'the menu'}.`, { kind: 'success' });
  }
  addBtn.addEventListener('click', commitAdd);
  recount();
}
