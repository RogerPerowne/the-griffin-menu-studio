// Edit Menu panel — dockable Panel definition (System 3).
// The structured editor (name/date/paper/header meta + the sections/dishes list)
// is the live `<section class="editor">` built by render.ts and wired by
// views/editor.ts. There is no HTML-string body to wrap, so — matching the reuse
// strategy of page.ts and preview-controls.ts — render() reparents that real,
// already-wired node into the dock host and moves it back to its baked-in grid
// slot (before #editorHandle) when the dock tears the panel down. Every existing
// listener and the #edScroll render target survive the reparent untouched.
// Min size follows the panel spec table (Edit Menu — 320×400).

import type { Panel } from '../registry';

const ICON = '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

export const editMenuPanel: Panel = {
  id: 'edit-menu',
  title: 'Edit Menu',
  icon: ICON,
  minW: 320,
  minH: 400,
  render(host: HTMLElement): void | (() => void) {
    const editor = document.querySelector<HTMLElement>('.main .editor');
    if (!editor) {
      host.innerHTML = '<p class="dock-empty">The editor is unavailable.</p>';
      return;
    }
    const parent = editor.parentElement;
    const next = editor.nextSibling;
    host.appendChild(editor);
    return () => {
      if (parent) parent.insertBefore(editor, next);
    };
  },
};
