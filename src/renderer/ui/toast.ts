// Non-blocking toast notifications with an accessible live region. Used for
// action feedback (saved, copied, imported, exported) and recoverable errors,
// in place of jarring native alert() dialogs. Optional single action button.

export type ToastKind = 'success' | 'info' | 'warn' | 'error';

interface ToastOptions {
  kind?: ToastKind;
  /** One inline action, e.g. { label: 'Show in folder', run: () => … }. */
  action?: { label: string; run: () => void };
  /** Auto-dismiss delay in ms; defaults scale with severity / presence of an action. */
  duration?: number;
}

const ICONS: Record<ToastKind, string> = {
  success: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
  error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
};

function layer(): HTMLElement {
  let el = document.getElementById('toastLayer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastLayer';
    el.className = 'toast-layer';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

import { escapeHtml as esc } from '../util/escape';

export function toast(message: string, opts: ToastOptions = {}): void {
  const kind = opts.kind ?? 'info';
  const duration = opts.duration ?? (opts.action ? 8000 : kind === 'error' ? 6000 : 3800);
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="toast-icon" aria-hidden="true">${ICONS[kind]}</span>
    <span class="toast-msg">${esc(message)}</span>
    ${opts.action ? `<button class="toast-action" type="button">${esc(opts.action.label)}</button>` : ''}
    <button class="toast-close" type="button" aria-label="Dismiss"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;

  let timer = 0;
  const dismiss = (): void => {
    window.clearTimeout(timer);
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    window.setTimeout(() => el.remove(), 400); // fallback if animationend never fires
  };

  el.querySelector('.toast-close')?.addEventListener('click', dismiss);
  el.querySelector('.toast-action')?.addEventListener('click', () => {
    opts.action?.run();
    dismiss();
  });
  // Pause auto-dismiss while hovered.
  el.addEventListener('pointerenter', () => window.clearTimeout(timer));
  el.addEventListener('pointerleave', () => { timer = window.setTimeout(dismiss, 1500); });

  layer().appendChild(el);
  timer = window.setTimeout(dismiss, duration);
}
