const test = require('node:test');
const assert = require('node:assert/strict');
const {
  centredColumns,
  dividerLength,
  footerCollision,
  pageOverflow,
  preflightFromBoxes,
  zoomInvariantGeometry
} = require('../electron/layout-math');

test('columns are mathematically centred with equal outer margins', () => {
  const result = centredColumns(210, 18, 3, 7);
  assert.equal(result.columns.length, 3);
  assert.equal(result.columns[0].left, 18);
  assert.equal(Number((210 - result.columns[2].right).toFixed(6)), 18);
  assert.equal(Number((result.columns[1].left - result.columns[0].right).toFixed(6)), 7);
});

test('footer collision and page overflow warnings are distinct', () => {
  assert.equal(footerCollision(250, 240), true);
  assert.equal(pageOverflow({ contentBottom: 250, footerBottom: 280, pageBottom: 297 }), false);
});

test('zoom changes visual dimensions only', () => {
  const geometry = zoomInvariantGeometry({ width: 794, height: 1123 }, 1.5);
  assert.equal(geometry.documentWidth, 794);
  assert.equal(geometry.visualWidth, 1191);
});

test('divider length is independently derived from content width', () => {
  assert.equal(dividerLength(180, 94), 169.2);
  assert.equal(dividerLength(180, 34), 61.2);
});

test('preflight reports genuine export blockers', () => {
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
    pageCount: 1
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.warnings, ['unresolved-images', 'footer-overlap', 'clipped-elements']);
});
