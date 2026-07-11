// Preview Controls panel — dockable Panel definition (System 3).
// Unlike the other tool panels, "Preview Controls" was never an HTML-string
// body function in window-panels.ts: it is the live `.stage-zoombar` toolbar
// (Fit width / Actual size / zoom out / #zoomSlider / zoom in / #zoomPct)
// already baked into app-shell.ts and wired up elsewhere — data-cmd clicks
// are delegated on `document` (commands.ts) and the #zoomSlider `input`
// listener is bound directly to that element (views/preview.ts). So render()
// reuses the existing body by reparenting that real node into the dock host
// rather than regenerating its markup — every existing handler keeps working
// untouched — and moves it back to its baked-in place under the stage when
// the dock tears the panel down.

import type { Panel } from '../registry';

const ICON = '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="M10 7v6M7 10h6m4.5 4.5 5 5"/></svg>';

export const previewControlsPanel: Panel = {
  id: 'preview-controls',
  title: 'Preview Controls',
  icon: ICON,
  minW: 220,
  minH: 160,
  render(host: HTMLElement): void | (() => void) {
    const bar = document.querySelector<HTMLElement>('.stage-zoombar');
    if (!bar) {
      host.innerHTML = '<p class="dock-empty">Preview controls are unavailable.</p>';
      return;
    }
    const parent = bar.parentElement;
    const next = bar.nextSibling;
    host.appendChild(bar);
    return () => {
      if (parent) parent.insertBefore(bar, next);
    };
  },
};
