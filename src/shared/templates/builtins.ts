// Faithful port of the mockup's BUILTINS array (~lines 226-242 of mockup.script.js).
// These are menu layout blueprints (built-in, not user-saved) offered from the
// "new menu" gallery. Text, structure and ids are preserved verbatim from the mockup.
import type { Template } from '@shared/types';

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'b1',
    name: 'À La Carte',
    builtin: true,
    style: { paper: 'A4', header: 'title', showKey: true, sc: 1 },
    headerNote: '',
    sections: [
      { name: 'Whilst you wait…', prices: true },
      { name: 'Starters', prices: true },
      { name: 'Mains', prices: true },
      { name: 'Sides', prices: true },
    ],
    footer:
      'All our menus are seasonal and thus subject to availability.\nPlease let us know if you have any intolerances or allergies.',
  },
  {
    id: 'b2',
    name: 'Set Menu',
    builtin: true,
    style: { paper: 'A5', header: 'title', showKey: true, sc: 1, stacked: true },
    headerNote: 'Two courses £00.00 | Three courses £00.00',
    sections: [
      { name: 'To Start', prices: false },
      { name: 'To Follow', prices: false },
      { name: 'Something Sweet…', prices: false },
    ],
    footer: 'Please let us know if you have any intolerances or allergies.',
  },
  {
    id: 'b3',
    name: 'Crested',
    builtin: true,
    style: { paper: 'A4', header: 'crest', showKey: true, sc: 1 },
    headerNote: '',
    sections: [
      { name: 'To Start', prices: true },
      { name: 'To Follow', prices: true },
      { name: 'Something Sweet…', prices: true },
    ],
    footer: 'All prices include VAT and a discretionary 13% service charge will be added to your bill.',
  },
  {
    id: 'b4',
    name: 'Feast / Sharing',
    builtin: true,
    style: { paper: 'A4', header: 'lockup', showKey: true, sc: 1 },
    headerNote: '',
    sections: [
      { name: 'Whilst you wait…', prices: false },
      { name: 'To Start', prices: false },
      { name: 'To Follow', prices: false },
      { name: 'Sharing Desserts', prices: false },
    ],
    footer:
      'All our menus are seasonal and thus subject to availability.\nPlease let us know if you have any intolerances or allergies.',
  },
  {
    id: 'b5',
    name: 'Event / Per Head',
    builtin: true,
    style: { paper: 'A5', header: 'crest', showKey: false, sc: 1, stacked: true },
    headerNote: '£00 per head',
    sections: [{ name: 'Canapés', prices: false }],
    footer: 'A discretionary 13% service charge will be added to your bill.',
  },
  {
    id: 'b6',
    name: 'Ruled Set Menu',
    builtin: true,
    leadRule: true,
    style: { paper: 'A5', header: 'title', showKey: true, sc: 1, stacked: true },
    headerNote: 'Two courses £00.00 | Three courses £00.00',
    sections: [
      { name: 'To Start', prices: false },
      { name: 'To Follow', prices: false },
      { name: 'Something Sweet…', prices: false },
    ],
    footer: 'Please let us know if you have any intolerances or allergies.',
  },
  {
    id: 'b7',
    name: 'Two-Column Roast',
    builtin: true,
    leadRule: true,
    style: { paper: 'A4', header: 'crest', showKey: true, sc: 1 },
    headerNote: '',
    sections: [
      { name: 'To Start', prices: true },
      { name: 'To Follow', prices: true, cols: 2 },
      { name: 'Something Sweet…', prices: true },
    ],
    footer: 'All prices include VAT and a discretionary 13% service charge will be added to your bill.',
  },
  {
    id: 'g1',
    name: 'Griffin A5 Set Lunch',
    builtin: true,
    style: { paper: 'A5', header: 'title', showKey: true, sc: 1 },
    headerNote: 'Two courses £00.00 | Three courses £00.00',
    sections: [
      { name: 'To Start', prices: false, descMode: 'inline' },
      { name: 'To Follow', prices: false, descMode: 'inline' },
      { name: 'Something Sweet…', prices: false, descMode: 'inline' },
    ],
    footer: 'Please let us know if you have any intolerances or allergies.',
  },
  {
    id: 'g2',
    name: 'Griffin Buffet 2026',
    builtin: true,
    style: { paper: 'A5', header: 'crest', showKey: false, sc: 1 },
    headerNote: '£35 per head',
    sections: [{ name: 'Buffet', prices: false, descMode: 'below' }],
    footer: 'All prices include VAT and a discretionary 13% service charge will be added to your bill.',
  },
  {
    id: 'g3',
    name: 'Griffin Canapé 2026',
    builtin: true,
    style: { paper: 'A5', header: 'crest', showKey: false, sc: 1 },
    headerNote: '4 for £20 p.h | 5 for £25 p.h | 6 for £30 p.h',
    sections: [{ name: 'Canapés', prices: false, descMode: 'below' }],
    footer: 'A discretionary 13% service charge will be added to your bill.',
  },
  {
    id: 'g4',
    name: 'Griffin Dinner Set',
    builtin: true,
    style: { paper: 'A5', header: 'title', showKey: true, sc: 1 },
    headerNote: 'Two courses £00.00 | Three courses £00.00',
    sections: [
      { name: 'To Start', prices: false, descMode: 'below' },
      { name: 'To Follow', prices: false, descMode: 'below' },
      { name: 'Something Sweet…', prices: false, descMode: 'below' },
    ],
    footer: 'Please let us know if you have any intolerances or allergies.',
  },
  {
    id: 'g5',
    name: 'Griffin Sharing Menu',
    builtin: true,
    style: { paper: 'A4', header: 'lockup', showKey: true, sc: 1 },
    headerNote: '',
    sections: [
      { name: 'Whilst you wait…', prices: false, descMode: 'inline' },
      { name: 'To Start', prices: false, descMode: 'inline' },
      { name: 'To Follow', prices: false, descMode: 'inline' },
      { name: 'Sharing Desserts', prices: false, descMode: 'inline' },
    ],
    footer: 'All our menus are seasonal and thus subject to availability.',
  },
  {
    id: 'g6',
    name: 'Griffin Skewers',
    builtin: true,
    style: { paper: 'A5', header: 'title', showKey: true, sc: 1 },
    headerNote: 'Every Saturday | 12pm - 6pm',
    sections: [
      { name: 'Barbecued Skewers', prices: true, descMode: 'below' },
      { name: 'Flatbread', prices: true, descMode: 'below' },
      { name: 'On the side', prices: true, descMode: 'below' },
    ],
    footer: 'This event is weather dependent.',
  },
  {
    id: 'g7',
    name: 'Griffin Sunday Menu',
    builtin: true,
    style: { paper: 'A4', header: 'crest', showKey: true, sc: 1 },
    headerNote: '',
    sections: [
      { name: 'To Start', prices: true, descMode: 'inline' },
      { name: 'To Follow', prices: true, cols: 2, descMode: 'below' },
      { name: 'Something Sweet…', prices: true, descMode: 'inline' },
    ],
    footer: 'All prices include VAT and a discretionary 13% service charge will be added to your bill.',
  },
  {
    id: 'g8',
    name: 'Griffin Children’s Menu',
    builtin: true,
    style: { paper: 'A5', header: 'crest', showKey: true, sc: 1 },
    headerNote: '',
    sections: [
      { name: 'To Start', prices: true, descMode: 'below' },
      { name: 'To Follow', prices: true, descMode: 'below' },
      { name: 'Something Sweet', prices: true, descMode: 'below' },
    ],
    footer: 'Please let us know if you have any intolerances or allergies.',
  },
];

/**
 * The full template set shown in the gallery: the on-disk library (seeded
 * built-ins + user templates) merged with the code-bundled built-ins, deduped
 * by id with the on-disk copy winning. This guarantees built-ins always appear
 * (even before first-run seeding finishes, or if a seeded file is unreadable)
 * and are never doubled once they exist on disk.
 */
export function combineTemplates(userTemplates: readonly Template[]): Template[] {
  const byId = new Map<string, Template>();
  for (const template of BUILTIN_TEMPLATES) byId.set(template.id, template);
  for (const template of userTemplates) byId.set(template.id, template);
  return [...byId.values()];
}
