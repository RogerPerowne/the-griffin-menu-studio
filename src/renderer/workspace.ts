// Lightroom-style workspace switching: Start (library) · Editor (current
// rail+panel+preview) · Export (output room). Buttons everywhere use
// data-cmd="go-start|go-editor|go-export" (see commands.ts's global
// dispatcher) rather than calling setWorkspace directly, so this module has
// no dependency on commands.ts and there's no import cycle.

import { renderMenuHTML } from '@shared/menu/render';
import { getActiveBrand } from '@shared/brand';
import { assetUrl } from './brand-assets';
import { commit, currentMenu, getState, on } from './store';
import { fmtDate } from './views/rail';
import { productionInfo } from './layout-runtime';

export type Workspace = 'start' | 'editor' | 'export';

let current: Workspace = 'editor';

function esc(value: string | undefined | null): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function assets() {
  const brand = getActiveBrand();
  return { crest: assetUrl(brand.assetKeys.crest), lockup: assetUrl(brand.assetKeys.lockup) };
}

/* ================= Start workspace: the menu library ================= */

function renderStartWorkspace(): void {
  const root = document.getElementById('startWorkspace');
  if (!root) return;
  const state = getState();
  const dietKey = state.settings.dietKey;

  const cards = state.menus
    .map((menu) => {
      const thumbHtml = renderMenuHTML(menu, { edit: false, dietKey, assets: assets() });
      return `<button class="start-card" data-open-menu="${menu.id}">
        <div class="start-card-thumb"><div class="start-card-scale">${thumbHtml}</div></div>
        <span class="start-card-name">${esc(menu.name)}</span>
        <span class="start-card-date">${esc(fmtDate(menu.date))}</span>
      </button>`;
    })
    .join('');

  root.innerHTML = `
    <div class="start-shell">
      <div class="start-head">
        <h1>Your menus</h1>
        <div class="start-actions">
          <button class="abtn primary" data-cmd="new-template">+ New Menu</button>
          <button class="abtn" data-cmd="open">Open…</button>
        </div>
      </div>
      <div class="start-grid">${cards || '<p class="start-empty">No menus yet — create one to get started.</p>'}</div>
    </div>`;
}

function initStartWorkspace(): void {
  document.getElementById('startWorkspace')?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const card = target.closest<HTMLElement>('[data-open-menu]');
    if (!card) return;
    getState().currentMenuId = card.dataset.openMenu ?? getState().currentMenuId;
    commit(['all']);
    setWorkspace('editor');
  });
}

/* ================= Export workspace: the output room ================= */

function renderExportWorkspace(): void {
  const root = document.getElementById('exportWorkspace');
  if (!root) return;
  const menu = currentMenu();
  if (!menu) return;
  const dietKey = getState().settings.dietKey;
  const html = renderMenuHTML(menu, { edit: false, dietKey, assets: assets() });

  root.innerHTML = `
    <div class="export-shell">
      <div class="export-preview"><div class="export-preview-page">${html}</div></div>
      <aside class="export-panel">
        <h2>${esc(menu.name)}</h2>
        <p class="export-meta">${esc(menu.style.paper || 'A4')} · white background — matches what prints on the pink stock</p>
        <p class="export-status" id="exportStatus">Checking layout…</p>
        <div class="export-buttons">
          <button class="abtn primary" data-cmd="export-pdf">Export PDF</button>
          <button class="abtn" data-cmd="export-png">Export PNG</button>
          <button class="abtn" data-cmd="print">Print…</button>
        </div>
      </aside>
    </div>`;

  const previewPage = root.querySelector<HTMLElement>('.export-preview-page');
  const statusEl = document.getElementById('exportStatus');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!previewPage || !statusEl) return;
      const info = productionInfo(previewPage);
      if (info.footerCollision) statusEl.textContent = 'Text reaches the footer — use Shrink to fit in the editor first.';
      else if (info.over) statusEl.textContent = 'Doesn’t fit on one page yet — use Shrink to fit in the editor first.';
      else statusEl.textContent = 'Fits on one page. Ready to export.';
      statusEl.classList.toggle('warn', info.over || info.footerCollision);
    });
  });
}

/* ================= switching ================= */

export function getWorkspace(): Workspace {
  return current;
}

export function setWorkspace(mode: Workspace): void {
  current = mode;
  const app = document.getElementById('app');
  app?.setAttribute('data-workspace', mode);
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.mode === mode);
  });
  if (mode === 'start') renderStartWorkspace();
  if (mode === 'export') renderExportWorkspace();
  if (mode === 'editor') window.dispatchEvent(new Event('resize')); // re-fit the preview page
}

export function initWorkspaces(): void {
  initStartWorkspace();
  on('rail', () => {
    if (current === 'start') renderStartWorkspace();
  });
  on('preview', () => {
    if (current === 'export') renderExportWorkspace();
  });
  setWorkspace('editor');
}
