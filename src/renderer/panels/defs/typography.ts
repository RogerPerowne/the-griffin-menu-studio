// Typography Master — dockable Panel definition (System 3).
//
// This is the full four-section Typography Master from docs/typography-master-panel.md
// (Global · Roles · Selected role · Advanced). All markup + interaction lives in the
// self-contained ./typography-master helper: its render fills the dock host, wires its
// own delegated listeners, and returns a disposer the dock runs on teardown — so this
// def is a thin adaptor and no longer leans on the delegated data-type-* handlers in
// window-panels.ts (those still drive the legacy float-window body).
//
// Min size follows the wider Master layout (docs/photoshop-style-dockable-panel-system.md).

import type { Panel } from '../registry';
import { renderTypographyMaster } from '../typography-master';

const ICON = '<svg viewBox="0 0 24 24"><path d="M4 7V5h16v2M9 5v14M7 19h4"/></svg>';

export const typographyPanel: Panel = {
  id: 'typography',
  title: 'Typography',
  icon: ICON,
  minW: 300,
  minH: 420,
  render(host: HTMLElement): void | (() => void) {
    return renderTypographyMaster(host);
  },
};
