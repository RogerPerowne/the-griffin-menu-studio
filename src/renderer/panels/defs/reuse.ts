// Panel def — Reuse (System 3 · dockable workspace).
// Wraps the existing reuseBody() render function from window-panels.ts so the
// dock renderer can host the same "Reuse from another menu" tool that the
// float-window system already ships. Logic lives in window-panels.ts; this
// file only adapts it to the Panel interface (registry.ts).

import type { Panel } from '../registry';
import { reuseBody } from '../window-panels';

const reuseIcon =
  '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="12" height="12" rx="1"/><path d="M9 16v2a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2"/></svg>';

export const reusePanel: Panel = {
  id: 'reuse',
  title: 'Reuse',
  icon: reuseIcon,
  minW: 260,
  render(host) {
    host.innerHTML = reuseBody();
  },
};
