import { describe, expect, it } from 'vitest';
import type { AppState } from '../src/shared/types';
import { applyReplacementPreviews, findAcrossMenus, previewReplacements } from '../src/shared/menu/find-replace';

function state(): AppState {
  return {
    version: 1,
    currentMenuId: 'm1',
    menus: [
      {
        id: 'm1',
        name: 'A la carte',
        date: '2026-07-10',
        style: { paper: 'A4', header: 'title', showKey: true, sc: 1, dn: 1 },
        headerNote: '',
        footer: '',
        rootRules: [],
        pos: {},
        sections: [
          {
            id: 's1',
            name: 'Starters',
            prices: true,
            note: '',
            cols: 1,
            columnNames: [],
            descMode: 'inline',
            items: [
              {
                id: 'd1',
                name: 'Wild mushroom arancini',
                desc: 'Truffle mayonnaise, aged Parmesan',
                price: '10.50',
                tags: [{ c: 'v', r: 0 }],
                hidden: false,
              },
            ],
          },
        ],
      },
      {
        id: 'm2',
        name: 'Private dining',
        date: '2026-07-10',
        style: { paper: 'A5', header: 'crest', showKey: true, sc: 1, dn: 1 },
        headerNote: '',
        footer: '',
        rootRules: [],
        pos: {},
        sections: [
          {
            id: 's2',
            name: 'Canapes',
            prices: false,
            note: '',
            cols: 1,
            columnNames: [],
            descMode: 'inline',
            items: [
              {
                id: 'd2',
                name: 'Wild mushroom arancini',
                desc: 'Truffle aioli',
                price: 'Included',
                tags: [{ c: 'v', r: 0 }],
                hidden: false,
              },
            ],
          },
        ],
      },
    ],
    userTemplates: [],
    boilerplate: [],
    settings: { dietKey: [] },
  };
}

describe('find across menus', () => {
  it('finds dish text in selected fields across menus', () => {
    const results = findAcrossMenus(state(), {
      query: 'wild mushroom',
      fields: ['name'],
    });

    expect(results.map((result) => result.menuName)).toEqual(['A la carte', 'Private dining']);
    expect(results[0].matchedFields).toEqual(['name']);
  });

  it('previews field-specific replacements before applying them', () => {
    const appState = state();
    const find = { query: 'Wild mushroom arancini', fields: ['name'] as const };
    const results = findAcrossMenus(appState, find);
    const previews = previewReplacements(appState, results, find, {
      resultIds: [results[0].id],
      fields: ['name'],
      replacement: 'Mushroom and truffle arancini',
    });

    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      menuName: 'A la carte',
      field: 'name',
      before: 'Wild mushroom arancini',
      after: 'Mushroom and truffle arancini',
    });

    expect(applyReplacementPreviews(appState, previews)).toBe(1);
    expect(appState.menus[0].sections[0].items[0]).toMatchObject({
      name: 'Mushroom and truffle arancini',
    });
    expect(appState.menus[1].sections[0].items[0]).toMatchObject({
      name: 'Wild mushroom arancini',
    });
  });

  it('can replace only matching text inside descriptions', () => {
    const appState = state();
    const find = { query: 'Truffle', fields: ['desc'] as const };
    const results = findAcrossMenus(appState, find);
    const previews = previewReplacements(appState, results, find, {
      resultIds: results.map((result) => result.id),
      fields: ['desc'],
      replacement: 'Black truffle',
      mode: 'matching-text',
    });

    applyReplacementPreviews(appState, previews);
    expect(appState.menus[0].sections[0].items[0]).toMatchObject({
      desc: 'Black truffle mayonnaise, aged Parmesan',
    });
    expect(appState.menus[1].sections[0].items[0]).toMatchObject({
      desc: 'Black truffle aioli',
    });
  });
});
