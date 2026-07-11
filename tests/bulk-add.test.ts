import { describe, expect, it } from 'vitest';
import { parseDishLines } from '../src/renderer/features/parse-dishes';

describe('parseDishLines', () => {
  it('splits name | description | price', () => {
    expect(parseDishLines('Heritage Tomato | basil, aged balsamic | 9')).toEqual([
      { name: 'Heritage Tomato', desc: 'basil, aged balsamic', price: '9' },
    ]);
  });

  it('accepts a spaced dash as a separator but keeps hyphens inside words', () => {
    expect(parseDishLines('Roast Cod - brown shrimp butter, greens - 24')).toEqual([
      { name: 'Roast Cod', desc: 'brown shrimp butter, greens', price: '24' },
    ]);
    expect(parseDishLines('Pan-fried Stonebass 32')).toEqual([
      { name: 'Pan-fried Stonebass', desc: '', price: '32' },
    ]);
  });

  it('peels a trailing price and strips currency symbols', () => {
    expect(parseDishLines('Wagyu Smash Burger | fries, house bun | £20')).toEqual([
      { name: 'Wagyu Smash Burger', desc: 'fries, house bun', price: '20' },
    ]);
    expect(parseDishLines('Lemon Tart 9.50')).toEqual([{ name: 'Lemon Tart', desc: '', price: '9.50' }]);
  });

  it('keeps a name-only line and ignores blank lines', () => {
    expect(parseDishLines('Lemon Tart\n   \n\nSticky Toffee')).toEqual([
      { name: 'Lemon Tart', desc: '', price: '' },
      { name: 'Sticky Toffee', desc: '', price: '' },
    ]);
  });

  it('does not treat a number that is the whole field as a price', () => {
    // "9" alone stays the name — nothing to describe or price.
    expect(parseDishLines('9')).toEqual([{ name: '9', desc: '', price: '' }]);
  });
});
