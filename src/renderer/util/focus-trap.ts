// Keep keyboard focus inside a modal while it is open, and restore focus to the
// previously-focused element when it closes. Shared by the app's overlay dialogs
// so Tab / Shift+Tab cycle within the modal instead of escaping to the page.

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface FocusTrap {
  release: () => void;
}

/**
 * Trap focus within `container`. Focuses its first focusable element, cycles Tab
 * within it, optionally calls `onEscape`, and restores prior focus on release.
 * Note: does NOT filter by visibility (overlays are position:fixed), so pass a
 * container that only holds the modal's own controls.
 */
export function trapFocus(container: HTMLElement, opts: { onEscape?: () => void } = {}): FocusTrap {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const focusables = (): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

  focusables()[0]?.focus();

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && opts.onEscape) {
      e.preventDefault();
      opts.onEscape();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey) {
      if (idx <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    } else if (idx === items.length - 1 || idx === -1) {
      e.preventDefault();
      items[0].focus();
    }
  };
  container.addEventListener('keydown', onKey);

  return {
    release: () => {
      container.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    },
  };
}
