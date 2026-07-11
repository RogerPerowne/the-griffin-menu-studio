// Find & Replace — Panel definition for the dockable workspace (System 3).
// Wraps the existing findReplaceBody() from window-panels.ts unchanged; all
// interaction is still delegated on #floatLayer / dock hosts, so wiring is
// untouched here.

import type { Panel } from '../registry';
import { findReplaceBody } from '../window-panels';

const finderIcon = '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 5 5"/></svg>';

export const findReplacePanel: Panel = {
  id: 'find-replace',
  title: 'Find & Replace',
  icon: finderIcon,
  minW: 300,
  render(host: HTMLElement) {
    host.innerHTML = findReplaceBody();
  },
};
