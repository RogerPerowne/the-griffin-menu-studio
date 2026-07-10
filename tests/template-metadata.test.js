const test = require('node:test');
const assert = require('node:assert/strict');
const { groupTemplates, templateSummary } = require('../electron/template-metadata');

test('bundled Griffin templates are protected and categorised', () => {
  const summary = templateSummary({
    id: 'g1',
    builtin: true,
    style: { paper: 'A5' },
    sections: [{ cols: 1 }]
  });

  assert.equal(summary.category, 'Griffin Classics');
  assert.equal(summary.paper, 'A5');
  assert.equal(summary.columnCount, 1);
  assert.equal(summary.protected, true);
});

test('template grouping puts Griffin Classics first', () => {
  const groups = groupTemplates([
    { id: 'b1', builtin: true, style: { paper: 'A4' }, sections: [{ cols: 1 }] },
    { id: 'g7', builtin: true, style: { paper: 'A4' }, sections: [{ cols: 2 }] },
    { id: 'user-1', name: 'Mine', style: { paper: 'A5' }, sections: [{ cols: 1 }] }
  ]);

  assert.equal(groups[0][0], 'Griffin Classics');
  assert.equal(groups.at(-1)[0], 'User Templates');
  assert.equal(groups[0][1][0].summary.columnCount, 2);
});
