// Interactive first-run walkthrough. A spotlight tour that highlights real UI
// elements with a caption bubble and drives the app between Home and Editor as
// it goes. It only navigates and explains — it never creates or mutates a menu,
// so it is always safe to run. Re-openable from Help ▸ Welcome & Quick Tour and
// Settings ▸ Show welcome tour; auto-runs once on first launch.

import { getState, persist } from '../store';
import { goHomePane, setWorkspace } from '../workspaces';
import { trapFocus, type FocusTrap } from '../util/focus-trap';

interface Step {
  title: string;
  body: string;
  /** Switch to this workspace before showing the step. */
  workspace?: 'home' | 'editor' | 'export';
  /** Optional setup (e.g. open a Home pane) run before locating the target. */
  before?: () => void;
  /** CSS selector for the element to spotlight; omitted = centred step. */
  selector?: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Griffin Menu Studio',
    body: 'A quick tour of how to build, save and print a menu — offline, on this computer. You can skip anytime.',
    workspace: 'home',
  },
  {
    title: 'Home is your hub',
    body: 'Open recent menus, start new ones, find dishes, and adjust settings from this green sidebar.',
    workspace: 'home',
    before: () => goHomePane('open'),
    selector: '.home-nav',
  },
  {
    title: 'Start from a template',
    body: 'Pick a Griffin template (or a blank page) to create your own editable menu. Use “Preview” to see one first, or “Use template” to begin.',
    workspace: 'home',
    before: () => goHomePane('new'),
    selector: '.template-card',
  },
  {
    title: 'Switch views here',
    body: 'Move between Home, the Editor and Export with this switch at the top.',
    workspace: 'editor',
    selector: '.modepill',
  },
  {
    title: 'Add dishes fast',
    body: 'Use Insert ▸ Add Dishes in Bulk (Ctrl+Shift+D) to paste a whole list at once. Right-click any dish or section to duplicate, move or delete it — or press Alt+↑/↓ to reorder.',
    workspace: 'editor',
    selector: '.menubar .topmenu:nth-child(3)',
  },
  {
    title: 'A true one-page preview',
    body: 'Your menu previews exactly as it will print, and warns you if it won’t fit on a single page.',
    workspace: 'editor',
    selector: '.stage',
  },
  {
    title: 'Save, then Export',
    body: 'Save keeps your editable .menu file. Export makes a print-ready PDF, a PNG image, or sends it to the printer. That’s the whole workflow — enjoy!',
    workspace: 'editor',
    selector: '#saveState',
  },
];

let index = 0;
let trap: FocusTrap | null = null;

function markSeen(): void {
  getState().settings.firstRunSeen = true;
  persist();
}

function els(): { root: HTMLElement; highlight: HTMLElement; bubble: HTMLElement } | null {
  const root = document.getElementById('wtRoot');
  const highlight = document.getElementById('wtHighlight');
  const bubble = document.getElementById('wtBubble');
  if (!root || !highlight || !bubble) return null;
  return { root, highlight, bubble };
}

function positionStep(): void {
  const parts = els();
  if (!parts) return;
  const { highlight, bubble } = parts;
  const step = STEPS[index];
  const target = step.selector ? document.querySelector<HTMLElement>(step.selector) : null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!target) {
    // Centred step: dim the whole screen (0-size hole, no visible border) and centre the bubble.
    highlight.style.opacity = '1';
    highlight.style.borderWidth = '0';
    highlight.style.left = `${Math.round(vw / 2)}px`;
    highlight.style.top = `${Math.round(vh / 2)}px`;
    highlight.style.width = '0px';
    highlight.style.height = '0px';
    bubble.style.left = `${Math.round((vw - bubble.offsetWidth) / 2)}px`;
    bubble.style.top = `${Math.round((vh - bubble.offsetHeight) / 2)}px`;
    return;
  }

  const r = target.getBoundingClientRect();
  highlight.style.opacity = '1';
  highlight.style.borderWidth = '2px';
  highlight.style.left = `${Math.round(r.left - 6)}px`;
  highlight.style.top = `${Math.round(r.top - 6)}px`;
  highlight.style.width = `${Math.round(r.width + 12)}px`;
  highlight.style.height = `${Math.round(r.height + 12)}px`;

  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;
  const gap = 14;
  let top: number;
  if (r.bottom + gap + bh <= vh - 8) top = r.bottom + gap;
  else if (r.top - gap - bh >= 8) top = r.top - gap - bh;
  else top = Math.max(8, (vh - bh) / 2);
  let left = r.left + r.width / 2 - bw / 2;
  left = Math.max(12, Math.min(left, vw - bw - 12));
  bubble.style.left = `${Math.round(left)}px`;
  bubble.style.top = `${Math.round(top)}px`;
}

function renderStep(): void {
  const parts = els();
  if (!parts) return;
  const step = STEPS[index];
  if (step.workspace) setWorkspace(step.workspace);
  step.before?.();

  const isLast = index === STEPS.length - 1;
  parts.bubble.innerHTML = `
    <p class="wt-count">Step ${index + 1} of ${STEPS.length}</p>
    <h2 class="wt-title" id="wtTitle">${step.title}</h2>
    <p class="wt-body" id="wtBody">${step.body}</p>
    <div class="wt-actions">
      <button class="abtn quiet" data-wt="skip">Skip tour</button>
      <span class="sp"></span>
      ${index > 0 ? '<button class="abtn" data-wt="back">Back</button>' : ''}
      <button class="abtn primary" data-wt="${isLast ? 'finish' : 'next'}">${isLast ? 'Finish' : 'Next'}</button>
    </div>`;
  // Let layout settle, then place (two ticks; rAF is unreliable in some hosts).
  window.setTimeout(positionStep, 0);
  window.setTimeout(positionStep, 60);
  (parts.bubble.querySelector('[data-wt="next"], [data-wt="finish"]') as HTMLElement | null)?.focus();
}

function close(seen: boolean): void {
  if (seen) markSeen();
  trap?.release();
  trap = null;
  window.removeEventListener('resize', positionStep);
  window.removeEventListener('scroll', positionStep, true);
  document.getElementById('wtRoot')?.remove();
  setWorkspace('home');
}

export function openWelcome(): void {
  if (document.getElementById('wtRoot')) return;
  index = 0;
  const root = document.createElement('div');
  root.id = 'wtRoot';
  root.innerHTML = `
    <div class="wt-catcher" id="wtRootCatcher"></div>
    <div class="wt-highlight" id="wtHighlight"></div>
    <div class="wt-bubble" id="wtBubble" role="dialog" aria-modal="true" aria-labelledby="wtTitle" aria-describedby="wtBody" aria-live="polite"></div>`;
  document.body.appendChild(root);

  const bubble = document.getElementById('wtBubble') as HTMLElement;
  bubble.addEventListener('click', (e) => {
    const act = (e.target as Element).closest<HTMLElement>('[data-wt]')?.dataset.wt;
    if (act === 'next') { index = Math.min(STEPS.length - 1, index + 1); renderStep(); }
    else if (act === 'back') { index = Math.max(0, index - 1); renderStep(); }
    else if (act === 'skip' || act === 'finish') { close(true); }
  });
  window.addEventListener('resize', positionStep);
  window.addEventListener('scroll', positionStep, true);

  renderStep();
  trap = trapFocus(bubble, { onEscape: () => close(true) });
}

/** Show the walkthrough once, on the first ever launch. */
export function maybeShowFirstRun(): void {
  if (!getState().settings.firstRunSeen) openWelcome();
}
