const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CURRENT_DOCUMENT_VERSION,
  createDocument,
  parseDocumentText,
  serializeDocument
} = require('../electron/document-format');

function sampleState() {
  return {
    v: 1,
    cur: 'm1',
    settings: { dietKey: [{ c: 'V', l: 'Vegetarian' }] },
    templates: [],
    menus: [
      {
        id: 'm1',
        name: 'Lunch Menu',
        date: '2026-07-10',
        style: { paper: 'A4', header: 'title', showKey: true },
        sections: [
          { id: 's1', name: 'Starters', prices: true, items: [{ id: 'i1', name: 'Soup', price: '7' }] }
        ],
        footer: 'All prices include VAT.'
      }
    ]
  };
}

test('serializes a versioned .griffinmenu document', () => {
  const text = serializeDocument(sampleState());
  const parsed = JSON.parse(text);
  assert.equal(parsed.app, 'Griffin Menu Studio');
  assert.equal(parsed.version, CURRENT_DOCUMENT_VERSION);
  assert.equal(parsed.state.menus[0].name, 'Lunch Menu');
});

test('save/open round trip preserves editable state', () => {
  const state = sampleState();
  const doc = parseDocumentText(serializeDocument(state));
  assert.deepEqual(doc.state, state);
});

test('migrates legacy raw backup state into document wrapper', () => {
  const doc = parseDocumentText(JSON.stringify(sampleState()));
  assert.equal(doc.version, CURRENT_DOCUMENT_VERSION);
  assert.equal(doc.state.cur, 'm1');
});

test('rejects malformed generated content as canonical state', () => {
  assert.throws(() => createDocument({ menus: '<div class=\"page\"></div>', settings: {} }), /menus/);
});
