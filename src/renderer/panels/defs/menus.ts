// Menus panel — dockable Panel definition (System 3). The library rail as a
// first-class panel: it renders the same card list the "menus" float window uses
// (window-panels.ts · menuList), so a menu card click is picked up by the shared
// [data-dock-menu] delegation already bound on the dock hosts. Rendering the list
// (rather than reparenting the baked #rail) keeps the rail's grid track and its
// resize handle intact while still giving the Window menu a real Menus panel.
// Min size follows the panel spec table (Menus — 200×300).

import type { Panel } from '../registry';
import { menuList } from '../window-panels';

const ICON = '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';

export const menusPanel: Panel = {
  id: 'menus',
  title: 'Menus',
  icon: ICON,
  minW: 200,
  minH: 300,
  render(host: HTMLElement): void {
    host.innerHTML = menuList();
  },
};
