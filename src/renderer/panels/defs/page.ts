// Page panel — dockable Panel definition (System 3).
// "Page" was never one of the eight HTML-string body functions in
// window-panels.ts (Menus · Dishes · Find & Replace · Reuse · Colour &
// Spacing · Typography · Dietary Key · Arrange) — there is no pageBody() to
// wrap. The one existing "page" control today is the Paper size pill baked
// into the Edit Menu head bar in app-shell.ts (`<span class="pill">Paper
// <select id="edPaper">...`), wired up by wireHeadControls() in
// views/editor.ts (snapshot → currentMenu().style.paper = value → commit).
// So — matching the same reuse strategy as preview-controls.ts — render()
// reparents that real, already-wired pill into the dock host rather than
// regenerating its markup or its change handler, and moves it back to its
// baked-in place in the head bar when the dock tears the panel down.

import type { Panel } from '../registry';

const ICON = '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';

export const pagePanel: Panel = {
  id: 'page',
  title: 'Page',
  icon: ICON,
  minW: 200,
  minH: 90,
  render(host: HTMLElement): void | (() => void) {
    const paperSelect = document.getElementById('edPaper');
    const pill = paperSelect?.closest<HTMLElement>('.pill');
    if (!pill) {
      host.innerHTML = '<p class="dock-empty">Page settings are unavailable.</p>';
      return;
    }
    const parent = pill.parentElement;
    const next = pill.nextSibling;
    host.appendChild(pill);
    return () => {
      if (parent) parent.insertBefore(pill, next);
    };
  },
};
