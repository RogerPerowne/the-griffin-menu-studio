// Dishes panel — dockable-workspace Panel def wrapping the existing
// currentDishList() body from window-panels.ts (System 3, see
// docs/plan-photoshop-panels.md). Reuses the exact same rendering logic as
// the "dishes" float window; only the host-filling wiring is new here.

import type { Panel } from '../registry';
import { currentDishList } from '../window-panels';
import { currentMenu } from '../../store';

const dishesIcon = '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';

export const dishesPanel: Panel = {
  id: 'dishes',
  title: 'Dishes',
  icon: dishesIcon,
  minW: 240,
  minH: 260,
  render(host: HTMLElement): void {
    host.innerHTML = currentDishList(currentMenu());
  },
};
