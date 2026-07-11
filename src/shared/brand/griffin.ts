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
    copper: '#66584A', // deep bronze — accent
    cream: '#F6F3ED', // warm ivory — backgrounds
    panel: '#FFFFFF', // white — space & contrast
    ink: '#222222', // charcoal — body text
    headline: '#111111', // soft black — headlines
    muted: '#7A7266', // muted secondary text (readable on ivory)
    line: '#E4DDD1', // warm hairlines
    blush: '#F5E4DF', // preview paper tint (matches the original), exports stay white
    taupe: '#B8AA98', // warm taupe — secondary backgrounds
    gold: '#C2A36B', // antique gold — occasional highlight
    seal: '#00403D', // brand green — app icon circle, strong accents
    sealInk: '#FFF4F4', // brand pink — app icon crest, text on the seal accent
  },
  defaults: {
    paper: 'A4',
    headerStyle: 'title',
    dietKey: [
      { c: 'v', l: 'vegetarian' },
      { c: 've', l: 'vegan' },
      { c: 'gf', l: 'gluten free' },
      { c: 'df', l: 'dairy free' },
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
