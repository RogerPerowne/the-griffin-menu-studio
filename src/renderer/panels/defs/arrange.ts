// Panel definition for the "Arrange" tool — ports the existing float-window
// body (window-panels.ts · arrangeBody) into the dockable Panel registry
// (System 3, see docs/plan-photoshop-panels.md). The body markup and its
// event handling are untouched: interaction is delegated on #floatLayer /
// dock hosts elsewhere, so wrapping it here only needs to fill the host.

import type { Panel } from '../registry';
import { arrangeBody } from '../window-panels';

const ARRANGE_ICON =
  '<svg viewBox="0 0 24 24"><path d="M4 7h16M7 4v6M17 4v6M8 17h8M12 14v6"/></svg>';

export const arrangePanel: Panel = {
  id: 'arrange',
  title: 'Arrange',
  icon: ARRANGE_ICON,
  minW: 220,
  minH: 200,
  render(host) {
    host.innerHTML = arrangeBody();
  },
};
