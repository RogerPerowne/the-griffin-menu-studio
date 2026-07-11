// Dietary Key panel definition (System 3 · dockable workspace). Wraps the
// existing dietkeyBody() from window-panels.ts so the dock renders the same
// markup/behaviour as the legacy floating window.

import type { Panel } from '../registry';
import { dietkeyBody } from '../window-panels';

const ICON = '<svg viewBox="0 0 24 24"><path d="M12 2s6 3 6 9-6 11-6 11-6-5-6-11 6-9 6-9Z"/></svg>';

export const dietkeyPanel: Panel = {
  id: 'dietkey',
  title: 'Dietary Key',
  icon: ICON,
  minW: 240,
  minH: 260,
  render(host: HTMLElement): void {
    host.innerHTML = dietkeyBody();
  },
};
