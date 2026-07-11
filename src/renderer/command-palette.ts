// Ctrl+K command palette. Reads the one command registry, shows only commands
// that are currently available (respecting each command's enabled() and
// paletteHidden), and runs the chosen real command — it never exposes an
// internal or unavailable operation.

import { allCommands, runCommand, type Command } from './commands';
import { escapeHtml as esc } from './util/escape';

let selectedIndex = 0;
let filtered: Command[] = [];

function palettable(): Command[] {
  return allCommands().filter((c) => !c.paletteHidden && (c.enabled ? c.enabled() : true));
}

function score(cmd: Command, q: string): boolean {
  if (!q) return true;
  return `${cmd.label} ${cmd.group} ${cmd.keywords ?? ''}`.toLowerCase().includes(q);
}

function renderList(query: string): void {
  const q = query.trim().toLowerCase();
  filtered = palettable().filter((c) => score(c, q));
  if (selectedIndex >= filtered.length) selectedIndex = Math.max(0, filtered.length - 1);
  const list = document.getElementById('cmdkList');
  if (!list) return;
  list.innerHTML = filtered.length
    ? filtered
        .map(
          (cmd, i) => `<button class="cmdk-item${i === selectedIndex ? ' sel' : ''}" data-cmdk-index="${i}" role="option" aria-selected="${i === selectedIndex}">
            <span class="cmdk-group">${esc(cmd.group)}</span>
            <span class="cmdk-label">${esc(cmd.label)}</span>
            ${cmd.hint ? `<span class="cmdk-hint">${esc(cmd.hint)}</span>` : ''}
          </button>`,
        )
        .join('')
    : '<p class="cmdk-empty">No matching tools.</p>';
}

function close(): void {
  document.getElementById('cmdkRoot')?.remove();
}

function run(index: number): void {
  const cmd = filtered[index];
  if (!cmd) return;
  close();
  runCommand(cmd.id);
}

export function openCommandPalette(): void {
  if (document.getElementById('cmdkRoot')) return;
  selectedIndex = 0;
  const root = document.createElement('div');
  root.id = 'cmdkRoot';
  root.className = 'cmdk-overlay';
  root.innerHTML = `<div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Tool search">
      <input id="cmdkInput" class="cmdk-input" type="text" placeholder="Search tools and commands…" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="cmdkList" aria-activedescendant="">
      <div id="cmdkList" class="cmdk-list" role="listbox"></div>
    </div>`;
  document.body.appendChild(root);
  renderList('');

  const input = document.getElementById('cmdkInput') as HTMLInputElement;
  input.focus();

  input.addEventListener('input', () => {
    selectedIndex = 0;
    renderList(input.value);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(filtered.length - 1, selectedIndex + 1); renderList(input.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(0, selectedIndex - 1); renderList(input.value); }
    else if (e.key === 'Enter') { e.preventDefault(); run(selectedIndex); }
  });

  root.addEventListener('click', (e) => {
    const target = e.target;
    if (target === root) { close(); return; }
    const item = (target as Element).closest<HTMLElement>('[data-cmdk-index]');
    if (item) run(Number(item.dataset.cmdkIndex));
  });
}
