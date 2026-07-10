import type { BrandConfig } from './types';

// The Griffin, Amersham. Refine palette values against reference/griffin-menu-studio.html.
export const griffin: BrandConfig = {
  id: 'griffin',
  displayName: 'The Griffin, Amersham',
  assetKeys: {
    crest: 'griffin/crest',
    lockup: 'griffin/lockup',
  },
  palette: {
    copper: '#B4763B',
    cream: '#EFE7DA',
    panel: '#FFFFFF',
    ink: '#2B2622',
    muted: '#8A7E6F',
    line: '#E2D8C8',
    blush: '#F7EFE7',
  },
  defaults: {
    paper: 'A4',
    headerStyle: 'title',
    dietKey: [
      { c: 'v', l: 'vegetarian' },
      { c: 've', l: 'vegan' },
      { c: 'gf', l: 'gluten free' },
      { c: 'n', l: 'nuts' },
      { c: 'se', l: 'sesame' },
    ],
    footerBoilerplate: [
      'All our menus are seasonal and thus subject to availability.',
      'Please let us know if you have any intolerances or allergies.',
      'All prices include VAT and a discretionary 13% service charge will be added to your bill.',
      'A discretionary 13% service charge will be added to your bill.',
    ],
  },
  templateSet: 'griffin',
};
