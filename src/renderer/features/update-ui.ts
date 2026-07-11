// Update experience: a bottom-right notification (title, version, View / Update
// Now / Later / Cancel) and the Home > Settings "Updates" card (current version,
// Check for updates with clear error states, and the release notes / change log).

import type { UpdateInfo } from '@shared/api';
import { escapeHtml as esc } from '../util/escape';
import { goHomePane } from '../workspaces';

let latest: UpdateInfo | null = null;

export function initUpdateUI(): void {
  const api = window.griffin;
  if (!api?.onUpdateState) return;

  api.onUpdateState((info) => apply(info));
  void api.getUpdateInfo?.().then((info) => info && apply(info));

  // One delegated listener drives both the notification and the settings card.
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement)?.closest?.<HTMLElement>('[data-upd]');
    if (btn?.dataset.upd) handleAction(btn.dataset.upd);
  });
}

function apply(info: UpdateInfo): void {
  latest = info;
  refreshCard();
  syncNotification(info);
}

function handleAction(action: string): void {
  const api = window.griffin;
  switch (action) {
    case 'check':
      void api?.checkForUpdates?.();
      break;
    case 'view':
      goHomePane('settings');
      setTimeout(() => document.getElementById('updatesCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      break;
    case 'now':
      void api?.installUpdate?.();
      break;
    case 'later':
      void api?.deferUpdate?.();
      removeNotification();
      break;
    case 'cancel':
      void api?.cancelUpdate?.();
      removeNotification();
      break;
  }
}

/* ================= notification ================= */

function syncNotification(info: UpdateInfo): void {
  if (info.phase === 'downloaded' && !info.cancelled && !info.deferred) showNotification(info);
  else removeNotification();
}

function showNotification(info: UpdateInfo): void {
  let el = document.getElementById('updateNote');
  if (!el) {
    el = document.createElement('div');
    el.id = 'updateNote';
    el.className = 'update-note';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Update available');
    document.body.appendChild(el);
  }
  const ver = info.newVersion ? `Version ${esc(info.newVersion)}` : '';
  el.innerHTML = `
    <div class="update-note-head"><span class="update-note-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></span>
      <div class="update-note-text"><b>${esc(info.title || 'Update ready')}</b><small>${ver}</small></div></div>
    <div class="update-note-actions">
      <button class="abtn" data-upd="view">View</button>
      <button class="abtn primary" data-upd="now">Update Now</button>
      <button class="abtn" data-upd="later">Later</button>
      <button class="abtn ghost" data-upd="cancel">Cancel</button>
    </div>`;
}

function removeNotification(): void {
  document.getElementById('updateNote')?.remove();
}

/* ================= settings card ================= */

/** The Updates card markup for the Home > Settings pane. */
export function renderUpdatesCard(): string {
  const info = latest ?? { phase: 'idle', currentVersion: '' } as UpdateInfo;
  return `<section class="settings-card" id="updatesCard"><h2>Updates</h2><div class="updates-body" id="updatesBody">${updatesBodyInner(info)}</div></section>`;
}

function refreshCard(): void {
  const body = document.getElementById('updatesBody');
  if (body && latest) body.innerHTML = updatesBodyInner(latest);
}

function updatesBodyInner(info: UpdateInfo): string {
  const version = `<p class="updates-version">Installed version <b>${esc(info.currentVersion || '')}</b></p>`;
  const check = info.phase === 'downloaded' || info.phase === 'checking'
    ? ''
    : `<button class="abtn" data-upd="check">Check for updates</button>`;
  let status = '';
  switch (info.phase) {
    case 'checking':
      status = `<p class="updates-status">Checking for updates…</p>`;
      break;
    case 'downloading':
      status = `<p class="updates-status">Downloading ${info.newVersion ? `version ${esc(info.newVersion)}` : 'the update'}…</p>`;
      break;
    case 'downloaded':
      status = downloadedInner(info);
      break;
    case 'error':
      status = `<p class="updates-status error">${esc(info.errorMessage || 'Could not check for updates.')}</p>`;
      break;
    case 'upToDate':
      status = `<p class="updates-status ok">You’re up to date.</p>`;
      break;
    case 'unsupported':
      status = `<p class="updates-status">Automatic updates run in the installed app (not in development).</p>`;
      break;
    default:
      status = `<p class="updates-status">Updates download automatically in the background — you can also check any time.</p>`;
  }
  return `${version}${check}${status}`;
}

function downloadedInner(info: UpdateInfo): string {
  const title = esc(info.title || 'Update ready');
  const badge = info.newVersion ? `<span class="updates-badge">v${esc(info.newVersion)}</span>` : '';
  return `<div class="updates-ready">
    <div class="updates-ready-head"><b>${title}</b>${badge}</div>
    <div class="updates-notes">${renderNotes(info.notes || '')}</div>
    <div class="updates-actions">
      <button class="abtn primary" data-upd="now">Update Now</button>
      <button class="abtn" data-upd="later">Later</button>
      <button class="abtn ghost" data-upd="cancel">Cancel</button>
    </div>
    <p class="updates-hint">Update Now restarts and installs it. Later applies it next time you open the app. Cancel skips this update.</p>
  </div>`;
}

/** Minimal, safe Markdown for GitHub release bodies (headings, bullets, bold, code). */
function renderNotes(notes: string): string {
  if (!notes.trim()) return `<p class="updates-empty">No description was provided for this update.</p>`;
  const lines = notes.split(/\r?\n/);
  let html = '';
  let inList = false;
  const closeList = (): void => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`;
    } else if (/^#{1,6}\s+/.test(line)) {
      closeList();
      html += `<h4>${inline(line.replace(/^#{1,6}\s+/, ''))}</h4>`;
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
