// Settings modal (#ovSettings): the dietary key editor (#keyRows / #btnAddKey)
// and the blush preview-paper colour (#blushIn). Faithful port of the mockup's
// renderSettings + #keyRows/#btnAddKey/#blushIn handlers. The six PRINT &
// LAYOUT sliders in the same modal are deliberately NOT wired here — the
// preview module owns them (layout-runtime's bindReleaseSettings).

import { commit, getState, persist, snapshot } from '../store';

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

function renderSettings(): void {
  const settings = getState().settings;
  const blushIn = document.getElementById('blushIn') as HTMLInputElement | null;
  if (blushIn) blushIn.value = settings.blush || '#F5E4DF';
  const keyRows = document.getElementById('keyRows');
  if (keyRows) {
    keyRows.innerHTML = settings.dietKey
      .map(
        (k, i) => `<div class="keyrow">
  <input class="kc" data-i="${i}" data-f="c" value="${esc(k.c)}" maxlength="4">
  <input class="kl" data-i="${i}" data-f="l" value="${esc(k.l)}" placeholder="label, e.g. vegetarian">
  <button class="iconb danger" data-kdel="${i}">${ICON_X}</button></div>`,
      )
      .join('');
  }
}

export function openSettings(): void {
  renderSettings();
  document.getElementById('ovSettings')?.classList.add('show');
}

function closeSettings(): void {
  document.getElementById('ovSettings')?.classList.remove('show');
}

function onKeyRowsInput(e: Event): void {
  const target = e.target as HTMLInputElement;
  const i = Number(target.dataset.i);
  const f = target.dataset.f;
  if (f !== 'c' && f !== 'l') return;
  const entry = getState().settings.dietKey[i];
  if (!entry) return;
  entry[f] = target.value.trim();
  // Live-update the printed key while typing; the editor's tag buttons are
  // only refreshed on structural changes (add/delete) so typing keeps focus.
  commit(['preview']);
}

function onKeyRowsClick(e: Event): void {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const b = target.closest<HTMLElement>('[data-kdel]');
  if (!b) return;
  snapshot();
  getState().settings.dietKey.splice(Number(b.dataset.kdel), 1);
  commit(['editor', 'preview']);
  renderSettings();
}

function onAddKey(): void {
  snapshot();
  getState().settings.dietKey.push({ c: '', l: '' });
  commit(['editor']);
  renderSettings();
}

function onBlushInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value;
  getState().settings.blush = value;
  persist();
  document.documentElement.style.setProperty('--blush', value);
}

export function initSettings(): void {
  document.getElementById('keyRows')?.addEventListener('input', onKeyRowsInput);
  document.getElementById('keyRows')?.addEventListener('click', onKeyRowsClick);
  document.getElementById('btnAddKey')?.addEventListener('click', onAddKey);
  document.getElementById('blushIn')?.addEventListener('input', onBlushInput);

  const overlay = document.getElementById('ovSettings');
  overlay?.addEventListener('click', (e) => {
    const target = e.target;
    if (target === overlay || (target instanceof Element && target.closest('[data-close]'))) closeSettings();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('show')) closeSettings();
  });
}
