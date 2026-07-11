import { escapeHtml as esc } from '../util/escape';

type HelpTopic = 'tools' | 'tips' | 'tutorial' | 'shortcuts' | 'saving' | 'about';

interface ToolItem {
  label: string;
  detail: string;
  command: string;
  keywords: string;
}

const TOOLS: ToolItem[] = [
  { label: 'New from Template', detail: 'Create a menu from a Griffin layout.', command: 'new-template', keywords: 'new template start gallery' },
  { label: 'Open Menu', detail: 'Open a saved .menu document.', command: 'open', keywords: 'open file document menu' },
  { label: 'Save', detail: 'Save the current editable .menu document.', command: 'save', keywords: 'save file document' },
  { label: 'Export Workspace', detail: 'Go to Print, PDF, PNG and Save As.', command: 'go-export', keywords: 'export print pdf png save' },
  { label: 'Print', detail: 'Preflight the menu and open the system print dialog.', command: 'print', keywords: 'print printer paper' },
  { label: 'Settings', detail: 'Dietary key, preview colour and advanced layout sliders.', command: 'settings', keywords: 'settings dietary colour spacing typography' },
  { label: 'Arrange Mode', detail: 'Move titles, logos, rules and text blocks on the page.', command: 'arrange-toggle', keywords: 'arrange move align position' },
  { label: 'Find across menus', detail: 'Search dishes across menus and review replacements.', command: 'toggle-find-replace-panel', keywords: 'find replace dishes search' },
  { label: 'Menus Window', detail: 'Toggle the floating menus utility window.', command: 'toggle-menus-panel', keywords: 'menus window panel' },
  { label: 'Fit Preview', detail: 'Fit the menu preview to the available width.', command: 'fit-width', keywords: 'zoom fit preview page' },
];

function topicButton(topic: HelpTopic, current: HelpTopic, label: string): string {
  return `<button class="${topic === current ? 'on' : ''}" data-help-topic="${topic}">${label}</button>`;
}

function renderToolRows(query = ''): string {
  const q = query.trim().toLowerCase();
  const tools = TOOLS.filter((tool) => !q || `${tool.label} ${tool.detail} ${tool.keywords}`.toLowerCase().includes(q));
  if (!tools.length) return '<p class="help-empty">No matching tools.</p>';
  return tools
    .map(
      (tool) => `<button class="help-tool" data-cmd="${esc(tool.command)}">
        <b>${esc(tool.label)}</b>
        <span>${esc(tool.detail)}</span>
      </button>`,
    )
    .join('');
}

function topicContent(topic: HelpTopic): string {
  if (topic === 'tips') {
    return `<h2>Tips</h2>
      <div class="help-list">
        <p><b>Edit directly on the page.</b> Click menu text in the preview to make quick corrections.</p>
        <p><b>Use section menus.</b> The three dots on each section hold section-specific options, including columns.</p>
        <p><b>Use Export for output.</b> Editor preview is blush; Print/PDF/PNG use a white output page.</p>
        <p><b>Check the warning chip.</b> If the page does not fit, shorten content or use Auto size before printing.</p>
        <p><b>Reuse dishes safely.</b> Open Window > Find across menus and drag a copied dish into a section.</p>
      </div>`;
  }
  if (topic === 'tutorial') {
    return `<h2>Quick Tutorial</h2>
      <ol class="help-steps">
        <li><b>Start on Home.</b> Open an existing menu or choose a Griffin template.</li>
        <li><b>Edit in the Editor.</b> Add dishes, set prices, choose columns and adjust notes.</li>
        <li><b>Watch the preview.</b> The page updates as you type and shows fit warnings.</li>
        <li><b>Save a .menu file.</b> Use File > Save As when the menu is worth keeping.</li>
        <li><b>Print or export.</b> Use Export > Print for paper, PDF for print-ready sharing, PNG for quick review.</li>
      </ol>`;
  }
  if (topic === 'shortcuts') {
    return `<h2>Keyboard Shortcuts</h2>
      <div class="shortcut-grid">
        <span>Tool search</span><kbd>Ctrl</kbd><kbd>K</kbd>
        <span>New menu</span><kbd>Ctrl</kbd><kbd>N</kbd>
        <span>Open</span><kbd>Ctrl</kbd><kbd>O</kbd>
        <span>Save</span><kbd>Ctrl</kbd><kbd>S</kbd>
        <span>Save As</span><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>S</kbd>
        <span>Add dishes in bulk</span><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>D</kbd>
        <span>Find across menus</span><kbd>Ctrl</kbd><kbd>F</kbd>
        <span>Move dish / section up</span><kbd>Alt</kbd><kbd>↑</kbd>
        <span>Move dish / section down</span><kbd>Alt</kbd><kbd>↓</kbd>
        <span>Print</span><kbd>Ctrl</kbd><kbd>P</kbd>
        <span>Export PDF</span><kbd>Ctrl</kbd><kbd>E</kbd>
        <span>Undo</span><kbd>Ctrl</kbd><kbd>Z</kbd>
        <span>Redo</span><kbd>Ctrl</kbd><kbd>Y</kbd>
      </div>`;
  }
  if (topic === 'saving') {
    return `<h2>Files & Saving</h2>
      <div class="help-list">
        <p><b>.menu files</b> are editable Griffin Menu Studio documents. Send these when someone needs to reopen and change the menu.</p>
        <p><b>PDF</b> is for print-ready sharing. It is not the editable source file.</p>
        <p><b>PNG</b> is for quick image previews and approvals.</p>
        <p><b>Local app memory</b> restores your working menus on this computer, but Save As creates the file you can keep, copy or send.</p>
      </div>`;
  }
  if (topic === 'about') {
    return `<h2>About Griffin Menu Studio</h2>
      <div class="help-list">
        <p>A bespoke desktop menu editor for The Griffin.</p>
        <p>Built for editable menus, Griffin templates, print-accurate previewing, PDF/PNG export and offline Windows use.</p>
      </div>`;
  }
  return `<h2>Tool Search</h2>
    <input class="help-search" id="helpToolSearch" placeholder="Search tools, commands and windows" autocomplete="off">
    <div class="help-tools" id="helpToolRows">${renderToolRows()}</div>`;
}

function render(topic: HelpTopic): string {
  return `<div class="help-overlay show" id="helpOverlay" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
    <div class="help-modal">
      <aside class="help-nav">
        <h1 id="helpTitle">Help</h1>
        ${topicButton('tools', topic, 'Tool Search')}
        ${topicButton('tips', topic, 'Tips')}
        ${topicButton('tutorial', topic, 'Tutorial')}
        ${topicButton('shortcuts', topic, 'Shortcuts')}
        ${topicButton('saving', topic, 'Files & Saving')}
        ${topicButton('about', topic, 'About')}
      </aside>
      <section class="help-content">
        <button class="help-close" data-help-close>Close</button>
        ${topicContent(topic)}
      </section>
    </div>
  </div>`;
}

function ensureHelpRoot(): HTMLElement {
  let root = document.getElementById('helpRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'helpRoot';
    document.body.appendChild(root);
  }
  return root;
}

export function openHelp(topic: HelpTopic = 'tools'): void {
  const root = ensureHelpRoot();
  root.innerHTML = render(topic);
  window.setTimeout(() => {
    const search = document.getElementById('helpToolSearch') as HTMLInputElement | null;
    search?.focus();
  }, 0);
}

function closeHelp(): void {
  const root = document.getElementById('helpRoot');
  if (root) root.innerHTML = '';
}

export function initHelp(): void {
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-help-close]') || target.id === 'helpOverlay') {
      closeHelp();
      return;
    }
    const topic = target.closest<HTMLElement>('[data-help-topic]');
    if (topic?.dataset.helpTopic) openHelp(topic.dataset.helpTopic as HelpTopic);
  });

  document.addEventListener('input', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.id !== 'helpToolSearch') return;
    const rows = document.getElementById('helpToolRows');
    if (rows) rows.innerHTML = renderToolRows(target.value);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('helpOverlay')) {
      e.preventDefault();
      closeHelp();
    }
  });
}
