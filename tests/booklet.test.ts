import { describe, expect, it } from 'vitest';
import { imposeBooklet } from '../src/shared/menu/booklet';
import { newBooklet, newMenu } from '../src/shared/menu/factories';
import type { Booklet } from '../src/shared/types';

// Pins the fold geometry for a single vertical centre-fold (landscape A4 → A5).
// If a real duplex flip-on-short-edge print shows the back cover upside-down,
// flip BACK_COVER_ROTATE in booklet.ts AND update the rotate expectation here.

describe('imposeBooklet', () => {
  it('places back|front on the outer side, inside-left|right on the inner side', () => {
    const { outer, inner } = imposeBooklet(newBooklet());
    expect(outer.map((p) => p.role)).toEqual(['back', 'cover']);
    expect(outer.every((p) => p.side === 'outer')).toBe(true);
    expect(inner.map((p) => p.role)).toEqual(['inside-left', 'inside-right']);
    expect(inner.every((p) => p.side === 'inner')).toBe(true);
  });

  it('applies NO rotation for a single vertical centre-fold', () => {
    const { outer, inner } = imposeBooklet(newBooklet());
    expect([...outer, ...inner].every((p) => p.rotate === false)).toBe(true);
  });

  it('single inside without overflow → whole on the left, blank on the right', () => {
    const b = newBooklet();
    // newBooklet defaults to inside.mode==='single', allowTwoPages:false
    const { inner } = imposeBooklet(b);
    expect(inner[0].part).toBe('whole');
    expect(inner[1].part).toBe('blank');
  });

  it('single inside with allowTwoPages → first + overflow', () => {
    const b = newBooklet();
    if (b.inside.mode === 'single') b.inside.allowTwoPages = true;
    const { inner } = imposeBooklet(b);
    expect(inner[0].part).toBe('first');
    expect(inner[1].part).toBe('overflow');
  });

  it('two-menu inside → each cell is a whole, distinct menu', () => {
    const b: Booklet = { ...newBooklet(), inside: { mode: 'two', left: newMenu('L'), right: newMenu('R') } };
    const { inner } = imposeBooklet(b);
    expect(inner[0].part).toBe('whole');
    expect(inner[1].part).toBe('whole');
    expect(inner[0].menu?.name).toBe('L');
    expect(inner[1].menu?.name).toBe('R');
  });
});
