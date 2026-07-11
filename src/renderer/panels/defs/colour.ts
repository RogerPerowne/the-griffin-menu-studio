// Colour & Spacing panel — dockable Panel definition (System 3).
// Wraps the existing colourSpacingBody() render function from window-panels.ts;
// the body markup and its wiring (event delegation, refreshWindow('colour'), etc.)
// are unchanged and owned by window-panels.ts.

import type { Panel } from '../registry';
import { colourSpacingBody } from '../window-panels';

const ICON =
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.4"/><circle cx="15" cy="9" r="1.4"/><circle cx="9.5" cy="15" r="1.4"/></svg>';

export const colourPanel: Panel = {
  id: 'colour',
  title: 'Colour & Spacing',
  icon: ICON,
  minW: 260,
  minH: 320,
  render(host: HTMLElement) {
    host.innerHTML = colourSpacingBody();
  },
};
