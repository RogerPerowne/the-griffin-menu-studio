// A small branded, focus-trapped confirmation dialog returning a Promise<boolean>,
// used for destructive or bulk actions instead of the native window.confirm().
// Escape / outside-click / Cancel resolve false; Enter / Confirm resolve true.

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive. */
  danger?: boolean;
}

import { escapeHtml as esc } from '../util/escape';

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const root = document.createElement('div');
    root.className = 'confirm-overlay';
    root.innerHTML = `<div class="confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmBody">
        <h2 class="confirm-title" id="confirmTitle">${esc(opts.title)}</h2>
        ${opts.body ? `<p class="confirm-body" id="confirmBody">${esc(opts.body)}</p>` : ''}
        <div class="confirm-actions">
          <button class="confirm-cancel" type="button">${esc(opts.cancelLabel ?? 'Cancel')}</button>
          <button class="confirm-ok${opts.danger ? ' danger' : ''}" type="button">${esc(opts.confirmLabel ?? 'Confirm')}</button>
        </div>
      </div>`;
    document.body.appendChild(root);

    const okBtn = root.querySelector<HTMLButtonElement>('.confirm-ok')!;
    const cancelBtn = root.querySelector<HTMLButtonElement>('.confirm-cancel')!;
    const focusables = [cancelBtn, okBtn];
    okBtn.focus();

    const finish = (result: boolean): void => {
      root.remove();
      window.removeEventListener('keydown', onKey, true);
      prevFocus?.focus?.();
      resolve(result);
    };
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Tab') {
        // simple two-button focus trap
        e.preventDefault();
        const i = focusables.indexOf(document.activeElement as HTMLButtonElement);
        focusables[(i + (e.shiftKey ? focusables.length - 1 : 1)) % focusables.length].focus();
      }
    }
    window.addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => { if (e.target === root) finish(false); });
    okBtn.addEventListener('click', () => finish(true));
    cancelBtn.addEventListener('click', () => finish(false));
  });
}

export interface DialogChoice {
  id: string;
  label: string;
  danger?: boolean;
  primary?: boolean;
}

/**
 * A multi-choice dialog (e.g. save-conflict: Reload / Save a Copy / Overwrite).
 * Resolves the chosen id, or null on Cancel / Escape / outside-click.
 */
export function choiceDialog(opts: { title: string; body?: string; choices: DialogChoice[]; cancelLabel?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const root = document.createElement('div');
    root.className = 'confirm-overlay';
    root.innerHTML = `<div class="confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="choiceTitle">
        <h2 class="confirm-title" id="choiceTitle">${esc(opts.title)}</h2>
        ${opts.body ? `<p class="confirm-body">${esc(opts.body)}</p>` : ''}
        <div class="confirm-actions confirm-actions-stack">
          <button class="confirm-cancel" type="button" data-choice="__cancel">${esc(opts.cancelLabel ?? 'Cancel')}</button>
          ${opts.choices.map((c) => `<button class="confirm-ok${c.danger ? ' danger' : ''}${c.primary ? ' primary-choice' : ''}" type="button" data-choice="${esc(c.id)}">${esc(c.label)}</button>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(root);

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-choice]'));
    (buttons.find((b) => b.classList.contains('primary-choice')) ?? buttons[buttons.length - 1])?.focus();

    const finish = (id: string | null): void => {
      root.remove();
      window.removeEventListener('keydown', onKey, true);
      prevFocus?.focus?.();
      resolve(id);
    };
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(i + (e.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
      }
    }
    window.addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => {
      if (e.target === root) return finish(null);
      const btn = (e.target as Element).closest<HTMLElement>('[data-choice]');
      if (btn) finish(btn.dataset.choice === '__cancel' ? null : btn.dataset.choice!);
    });
  });
}
