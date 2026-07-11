// Typography panel — dockable Panel definition (System 3).
// Wraps the existing typographyBody() render function from window-panels.ts; the
// body markup and its wiring (event delegation, refreshWindow('typography')) are
// unchanged and owned by window-panels.ts. Min size follows the panel spec table
// in docs/photoshop-style-dockable-panel-system.md (Typography — 260×320).

import type { Panel } from '../registry';
import { typographyBody } from '../window-panels';

const ICON = '<svg viewBox="0 0 24 24"><path d="M4 7V5h16v2M9 5v14M7 19h4"/></svg>';

export const typographyPanel: Panel = {
  id: 'typography',
  title: 'Typography',
  icon: ICON,
  minW: 260,
  minH: 320,
  render(host: HTMLElement): void {
    host.innerHTML = typographyBody();
  },
};
