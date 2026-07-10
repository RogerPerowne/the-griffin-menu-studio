import { describe, it, expect } from 'vitest';
import {
  centredColumns,
  dividerLength,
  footerCollision,
  pageOverflow,
  preflightFromBoxes,
  zoomInvariantGeometry,
} from '../src/shared/layout-math';

describe('layout-math', () => {
  it('centres columns with equal outer margins', () => {
    const result = centredColumns(210, 18, 3, 7);
    expect(result.columns.length).toBe(3);
    expect(result.columns[0].left).toBe(18);
    expect(Number((210 - result.columns[2].right).toFixed(6))).toBe(18);
    expect(Number((result.columns[1].left - result.columns[0].right).toFixed(6))).toBe(7);
  });

  it('keeps footer collision and page overflow distinct', () => {
    expect(footerCollision(250, 240)).toBe(true);
    expect(pageOverflow({ contentBottom: 250, footerBottom: 280, pageBottom: 297 })).toBe(false);
  });

  it('changes only visual dimensions on zoom', () => {
    const geometry = zoomInvariantGeometry({ width: 794, height: 1123 }, 1.5);
    expect(geometry.documentWidth).toBe(794);
    expect(geometry.visualWidth).toBe(1191);
  });

  it('derives divider length from content width', () => {
    expect(dividerLength(180, 94)).toBe(169.2);
    expect(dividerLength(180, 34)).toBe(61.2);
  });

  it('reports genuine export blockers in order', () => {
    const result = preflightFromBoxes({
      pageWidth: 210,
      pageHeight: 297,
      contentTop: 60,
      headerBottom: 50,
      contentBottom: 282,
      footerTop: 270,
      footerBottom: 292,
      pageBottom: 297,
      clippedElements: 1,
      fontsPending: false,
      imagesPending: true,
      scale: 1,
      pageCount: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.warnings).toEqual(['unresolved-images', 'footer-overlap', 'clipped-elements']);
  });
});
