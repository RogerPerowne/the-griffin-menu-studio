/**
 * booklet-flip.ts — folded-A5 booklet reader with a realistic 3D page-turn.
 *
 * Models the booklet as two physical leaves hinged at the spine:
 *   leaf A: front = page 0 (front cover),  back = page 1 (inside-left)
 *   leaf B: front = page 2 (inside-right), back = page 3 (back cover)
 * Three positions: closed-front (page 0), open spread (pages 1–2), closed-back (page 3).
 *
 * Animation is GPU-only (rotateY around the spine + opacity keyframes for the
 * moving shadow and paper flex). Honours prefers-reduced-motion (instant swap).
 * Self-contained: no libraries, no external assets. CSS is injected once via a
 * module-owned <style>, all classes prefixed `bf-`.
 */

export interface BookletFlipOptions {
  onChange?: (index: number) => void;
}

export interface BookletFlipHandle {
  next(): void;
  prev(): void;
  goTo(i: number): void;
  index(): number;
  destroy(): void;
}

const DUR = 550;
const STAGGER = 130;
const EASE = 'cubic-bezier(.33,.02,.22,1)';
const RATIO = 296 / 210; // open A5 spread: two 148:210 portrait pages
const STYLE_ID = 'bf-booklet-flip-styles';

const CSS = `
.bf-root{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--bf-ink);--bf-bronze:#B4763B;--bf-ivory:#FBF7EF;--bf-green:#00403d;--bf-pink:#FFF4F4;--bf-ink:#2A231C;}
.bf-stage{position:relative;width:100%;aspect-ratio:296/210;perspective:2600px;perspective-origin:50% 45%;outline:none;border-radius:8px;}
.bf-stage:focus-visible{outline:2px solid rgba(180,118,59,.6);outline-offset:6px;}
.bf-book{position:absolute;inset:0;transform-style:preserve-3d;}
.bf-leaf{position:absolute;top:0;left:50%;width:50%;height:100%;transform-origin:left center;transform:rotateY(0deg);transform-style:preserve-3d;transition:transform ${DUR}ms ${EASE};will-change:transform;}
.bf-leaf.bf-flipped{transform:rotateY(-180deg);}
.bf-bend{position:absolute;inset:0;transform-origin:left center;transform-style:preserve-3d;}
.bf-anim-f .bf-bend{animation:bf-bend-f ${DUR}ms ${EASE};}
.bf-anim-b .bf-bend{animation:bf-bend-b ${DUR}ms ${EASE};}
.bf-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:var(--bf-ivory);overflow:hidden;box-shadow:0 14px 34px -16px rgba(42,35,28,.38),0 2px 6px -2px rgba(42,35,28,.16),inset 0 0 0 1px rgba(42,35,28,.05);}
.bf-face.bf-front{border-radius:1.5px 7px 7px 1.5px;}
.bf-face.bf-back{transform:rotateY(180deg);border-radius:7px 1.5px 1.5px 7px;}
.bf-face::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;}
.bf-face.bf-front::before{background:linear-gradient(90deg,rgba(42,35,28,.14),rgba(42,35,28,.045) 3.5%,rgba(42,35,28,0) 9%),linear-gradient(270deg,rgba(42,35,28,.09),rgba(42,35,28,0) 1.6%);}
.bf-face.bf-back::before{background:linear-gradient(270deg,rgba(42,35,28,.14),rgba(42,35,28,.045) 3.5%,rgba(42,35,28,0) 9%),linear-gradient(90deg,rgba(42,35,28,.09),rgba(42,35,28,0) 1.6%);}
.bf-page{position:absolute;inset:0;overflow:hidden;background:var(--bf-ivory);}
.bf-shade{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:3;}
.bf-front .bf-shade{background:linear-gradient(90deg,rgba(42,35,28,.40),rgba(42,35,28,.10) 58%,rgba(42,35,28,0));}
.bf-back .bf-shade{background:linear-gradient(270deg,rgba(42,35,28,.40),rgba(42,35,28,.10) 58%,rgba(42,35,28,0));}
.bf-anim-f .bf-shade,.bf-anim-b .bf-shade{animation:bf-shade ${DUR}ms ease-in-out;}
.bf-cast{position:absolute;top:1%;bottom:1%;width:26%;opacity:0;pointer-events:none;z-index:5;}
.bf-cast-l{right:50%;background:linear-gradient(270deg,rgba(42,35,28,.20),rgba(42,35,28,0) 80%);}
.bf-cast-r{left:50%;background:linear-gradient(90deg,rgba(42,35,28,.20),rgba(42,35,28,0) 80%);}
.bf-turning.bf-has-l .bf-cast-l,.bf-turning.bf-has-r .bf-cast-r{animation:bf-cast ${DUR}ms ease-in-out;}
@keyframes bf-shade{0%,100%{opacity:0}45%{opacity:.9}}
@keyframes bf-cast{0%,100%{opacity:0}45%{opacity:1}}
@keyframes bf-bend-f{0%,100%{transform:rotateY(0deg)}40%{transform:rotateY(-9deg)}}
@keyframes bf-bend-b{0%,100%{transform:rotateY(0deg)}40%{transform:rotateY(9deg)}}
@media (prefers-reduced-motion:reduce){
.bf-leaf{transition:none;}
.bf-bend,.bf-shade,.bf-cast{animation:none!important;}
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected || document.getElementById(STYLE_ID)) {
    stylesInjected = true;
    return;
  }
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
  stylesInjected = true;
}

function div(className: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = className;
  return d;
}

/** Position (0 closed-front, 1 open, 2 closed-back) for a page index 0..3. */
function posForPage(i: number): number {
  return i <= 0 ? 0 : i >= 3 ? 2 : 1;
}

/** Reported reading index for each position: first visible page. */
function indexFor(pos: number): number {
  return pos === 0 ? 0 : pos === 1 ? 1 : 3;
}

function visiblePages(pos: number): readonly number[] {
  return pos === 0 ? [0] : pos === 1 ? [1, 2] : [3];
}

function stageLabel(pos: number): string {
  return pos === 0
    ? 'Front cover, page 1 of 4'
    : pos === 1
      ? 'Inside spread, pages 2 and 3 of 4'
      : 'Back cover, page 4 of 4';
}

export function mountBookletFlip(
  container: HTMLElement,
  pagesHTML: string[],
  opts?: BookletFlipOptions,
): BookletFlipHandle {
  injectStyles();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pages: string[] = [];
  for (let i = 0; i < 4; i++) pages.push(pagesHTML[i] ?? '');

  const root = div('bf-root');
  const stage = div('bf-stage');
  stage.tabIndex = 0;
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-roledescription', 'booklet');
  const book = div('bf-book');
  const castL = div('bf-cast bf-cast-l');
  const castR = div('bf-cast bf-cast-r');

  const pageEls: HTMLElement[] = [];

  const makeFace = (pageIdx: number, sideClass: string): HTMLElement => {
    const f = div(`bf-face ${sideClass}`);
    const page = div('bf-page');
    page.setAttribute('role', 'group');
    page.setAttribute('aria-roledescription', 'page');
    page.setAttribute('aria-label', `Page ${pageIdx + 1} of 4`);
    page.innerHTML = pages[pageIdx] ?? '';
    const shade = div('bf-shade');
    f.append(page, shade);
    pageEls.push(page);
    return f;
  };

  const makeLeaf = (frontPage: number, backPage: number): HTMLElement => {
    const leaf = div('bf-leaf');
    const bend = div('bf-bend');
    bend.append(makeFace(frontPage, 'bf-front'), makeFace(backPage, 'bf-back'));
    leaf.appendChild(bend);
    return leaf;
  };

  const leafA = makeLeaf(0, 1); // cover / inside-left
  const leafB = makeLeaf(2, 3); // inside-right / back cover
  const leaves: readonly HTMLElement[] = [leafA, leafB];

  book.append(castL, castR, leafB, leafA);
  stage.appendChild(book);
  root.appendChild(stage);
  container.appendChild(root);

  let pos = 0;
  let destroyed = false;
  const timers = new Set<number>();

  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  /** Restack non-animating leaves from state: flipped pile left, rest right. */
  const layer = (): void => {
    leaves.forEach((leaf, k) => {
      if (leaf.classList.contains('bf-anim-f') || leaf.classList.contains('bf-anim-b')) return;
      leaf.style.zIndex = String(k < pos ? 1 + k : 4 - k);
    });
  };

  const syncA11y = (): void => {
    const vis = visiblePages(pos);
    pageEls.forEach((page, i) => {
      const hidden = !vis.includes(i);
      page.setAttribute('aria-hidden', hidden ? 'true' : 'false');
      if (hidden) page.setAttribute('inert', '');
      else page.removeAttribute('inert');
    });
    stage.setAttribute('aria-label', stageLabel(pos));
  };

  const setPos = (target: number): void => {
    const p = Math.max(0, Math.min(2, Math.trunc(target)));
    if (destroyed || p === pos) return;
    const from = pos;
    pos = p;
    const forward = p > from;
    const instant = reduced.matches;

    const turning: Array<{ leaf: HTMLElement; k: number }> = [];
    leaves.forEach((leaf, k) => {
      if (k < from !== k < p) turning.push({ leaf, k });
    });
    if (!forward) turning.reverse();

    if (instant) {
      turning.forEach(({ leaf, k }) => leaf.classList.toggle('bf-flipped', k < pos));
      layer();
      syncA11y();
      opts?.onChange?.(indexFor(pos));
      return;
    }

    // Cast shadow only over sides where a stationary page is actually visible.
    const hasL = turning.some(({ k }) => k >= 1);
    const hasR = turning.some(({ k }) => k + 1 < leaves.length);
    book.classList.remove('bf-turning');
    void book.offsetWidth; // restart cast keyframes on interrupt
    book.classList.toggle('bf-has-l', hasL);
    book.classList.toggle('bf-has-r', hasR);
    book.classList.add('bf-turning');

    turning.forEach(({ leaf, k }, i) => {
      const start = (): void => {
        if (destroyed) return;
        leaf.classList.remove('bf-anim-f', 'bf-anim-b');
        void leaf.offsetWidth; // restart flex/shade keyframes on interrupt
        leaf.classList.add(forward ? 'bf-anim-f' : 'bf-anim-b');
        leaf.style.zIndex = String(forward ? 9 + k : 10 - k);
        leaf.classList.toggle('bf-flipped', k < pos);
        later(() => {
          leaf.classList.remove('bf-anim-f', 'bf-anim-b');
          layer();
        }, DUR + 40);
      };
      if (i === 0) start();
      else later(start, i * STAGGER);
    });

    later(
      () => {
        book.classList.remove('bf-turning', 'bf-has-l', 'bf-has-r');
        layer();
      },
      DUR + (turning.length - 1) * STAGGER + 60,
    );

    syncA11y();
    opts?.onChange?.(indexFor(pos));
  };

  const fit = (): void => {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw <= 0) return;
    const w = ch > 0 ? Math.min(cw, ch * RATIO) : cw;
    stage.style.width = `${w}px`;
  };

  const ro = new ResizeObserver(fit);
  ro.observe(container);
  fit();

  const api: BookletFlipHandle = {
    next: () => setPos(pos + 1),
    prev: () => setPos(pos - 1),
    goTo: (i: number) => setPos(posForPage(i)),
    index: () => indexFor(pos),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      ro.disconnect();
      stage.removeEventListener('keydown', onKey);
      root.remove();
    },
  };

  const onKey = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        api.next();
        e.preventDefault();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        api.prev();
        e.preventDefault();
        break;
      case 'Home':
        api.goTo(0);
        e.preventDefault();
        break;
      case 'End':
        api.goTo(3);
        e.preventDefault();
        break;
    }
  };
  stage.addEventListener('keydown', onKey);

  layer();
  syncA11y();
  return api;
}
