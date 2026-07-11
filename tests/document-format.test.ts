import { describe, it, expect } from 'vitest';
import {
  CURRENT_DOCUMENT_VERSION,
  MAX_DOCUMENT_BYTES,
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
  it('serializes a versioned .menu document', () => {
    const text = serializeDocument(sampleState());
    const parsed = JSON.parse(text);
    expect(parsed.app).toBe('Griffin Menu Studio');
    expect(parsed.version).toBe(CURRENT_DOCUMENT_VERSION);
    expect(parsed.state.menu.name).toBe('Lunch Menu');
  });

  it('round-trips editable state through save/open', () => {
    const state = sampleState();
    const doc = parseDocumentText(serializeDocument(state));
    expect(doc.state.menu).toEqual(state.menus[0]);
  });

  it('preserves the complete editable menu model through a save/open round trip', () => {
    const state = {
      currentMenuId: 'm-a5',
      menus: [
        {
          id: 'm-a5',
          name: 'Private Dining',
          date: '2026-07-11',
          style: { paper: 'A5', header: 'lockup', sc: 0.91, dn: 0.86, showKey: true, stacked: false },
          headerNote: 'Three courses £42 per person',
          footer: 'Please tell us about allergies before ordering.',
          rootRules: [{ id: 'rule-top', rule: true, position: 'top' }],
          pos: { 'sec:starters': { x: 3, y: -8 } },
          sections: [
            {
              id: 'starters',
              name: 'To Start',
              prices: true,
              note: 'Choose one',
              cols: 2,
              columnNames: ['Cold', 'Warm'],
              descMode: 'below',
              items: [
                { id: 'd-1', name: 'Smoked salmon', desc: 'Cucumber, dill', price: '12.50', tags: [{ c: 'gf', r: 1 }], hidden: false, col: 0 },
                { id: 'divider', type: 'rule', position: 'between' },
              ],
            },
          ],
        },
      ],
      userTemplates: [{ id: 'tpl-1', name: 'A5 Dining', style: { paper: 'A5', header: 'crest' }, sections: [] }],
      boilerplate: [{ id: 'allergy', key: 'allergy', text: 'Please advise us of allergies.' }],
      settings: {
        dietKey: [{ c: 'gf', l: 'gluten free' }],
        blush: '#F5E4DF',
        layout: { sectionGap: 90, dishGap: 80, innerRule: 34, edgeRule: 94, footerGap: 100, colDivider: 86 },
      },
    };

    expect(parseDocumentText(serializeDocument(state)).state.menu).toEqual(state.menus[0]);
  });

  it('rejects the old whole-library file shape', () => {
    expect(() => parseDocumentText(JSON.stringify(sampleState()))).toThrow(/not a Griffin Menu Studio document/i);
  });

  it('rejects malformed generated content as canonical state', () => {
    expect(() => createDocument({ menus: '<div class="page"></div>', settings: {} })).toThrow(/menu/);
  });

  it('rejects unexpectedly large input before parsing JSON', () => {
    expect(() => parseDocumentText(' '.repeat(MAX_DOCUMENT_BYTES + 1))).toThrow(/too large/i);
  });
});
