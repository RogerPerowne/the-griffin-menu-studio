import { describe, it, expect } from 'vitest';
import {
  CURRENT_DOCUMENT_VERSION,
  createDocument,
  parseDocumentText,
  serializeDocument,
} from '../src/shared/document-format';

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
          { id: 's1', name: 'Starters', prices: true, items: [{ id: 'i1', name: 'Soup', price: '7' }] },
        ],
        footer: 'All prices include VAT.',
      },
    ],
  };
}

describe('document-format', () => {
  it('serializes a versioned .griffinmenu document', () => {
    const text = serializeDocument(sampleState());
    const parsed = JSON.parse(text);
    expect(parsed.app).toBe('Griffin Menu Studio');
    expect(parsed.version).toBe(CURRENT_DOCUMENT_VERSION);
    expect(parsed.state.menus[0].name).toBe('Lunch Menu');
  });

  it('round-trips editable state through save/open', () => {
    const state = sampleState();
    const doc = parseDocumentText(serializeDocument(state));
    expect(doc.state).toEqual(state);
  });

  it('migrates legacy raw backup state into the document wrapper', () => {
    const doc = parseDocumentText(JSON.stringify(sampleState()));
    expect(doc.version).toBe(CURRENT_DOCUMENT_VERSION);
    expect(doc.state.cur).toBe('m1');
  });

  it('rejects malformed generated content as canonical state', () => {
    expect(() => createDocument({ menus: '<div class="page"></div>', settings: {} })).toThrow(/menus/);
  });
});
