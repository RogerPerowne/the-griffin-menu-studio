import type { AppState, Dish, Menu, Section, Tag } from '../types';

export type FindField = 'menu' | 'section' | 'name' | 'desc' | 'price' | 'tags' | 'note';
export type ReplaceField = 'name' | 'desc' | 'price' | 'tags' | 'note';

export interface FindOptions {
  query: string;
  fields: readonly FindField[];
  menuIds?: readonly string[];
  caseSensitive?: boolean;
}

export interface FindResult {
  id: string;
  menuId: string;
  menuName: string;
  sectionId: string;
  sectionName: string;
  dishId: string;
  dishName: string;
  desc: string;
  price: string;
  tags: Tag[];
  note: string;
  matchedFields: FindField[];
}

export interface ReplacePreview {
  resultId: string;
  menuName: string;
  sectionName: string;
  dishName: string;
  field: ReplaceField;
  before: string;
  after: string;
}

export interface ReplaceOptions {
  resultIds: readonly string[];
  fields: readonly ReplaceField[];
  replacement: string;
  mode?: 'whole-field' | 'matching-text';
  caseSensitive?: boolean;
}

function isDish(item: unknown): item is Dish {
  return !!item && (item as { type?: string }).type !== 'rule';
}

function normalise(value: string, caseSensitive = false): string {
  return caseSensitive ? value : value.toLowerCase();
}

function fieldValue(menu: Menu, section: Section, dish: Dish, field: FindField | ReplaceField): string {
  if (field === 'menu') return menu.name;
  if (field === 'section') return section.name;
  if (field === 'name') return dish.name ?? '';
  if (field === 'desc') return dish.desc ?? '';
  if (field === 'price') return dish.price ?? '';
  if (field === 'note') return dish.note ?? '';
  return (dish.tags ?? []).map((tag) => `${tag.c}${tag.r ? ' on request' : ''}`).join(', ');
}

function resultId(menu: Menu, section: Section, dish: Dish): string {
  return `${menu.id}:${section.id}:${dish.id}`;
}

function replaceMatchingText(before: string, query: string, replacement: string, caseSensitive = false): string {
  if (!query) return before;
  const flags = caseSensitive ? 'g' : 'gi';
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return before.replace(new RegExp(escaped, flags), replacement);
}

function parseTags(value: string): Tag[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const onRequest = /\bon request\b/i.test(part);
      return { c: part.replace(/\bon request\b/gi, '').trim(), r: onRequest ? 1 : 0 };
    })
    .filter((tag) => tag.c) as Tag[];
}

export function findAcrossMenus(state: AppState, options: FindOptions): FindResult[] {
  const query = options.query.trim();
  if (!query) return [];

  const fields = options.fields.length ? options.fields : (['name', 'desc'] as FindField[]);
  const wantedMenus = new Set(options.menuIds ?? []);
  const needle = normalise(query, options.caseSensitive);
  const results: FindResult[] = [];

  for (const menu of state.menus) {
    if (wantedMenus.size && !wantedMenus.has(menu.id)) continue;
    for (const section of menu.sections) {
      for (const item of section.items) {
        if (!isDish(item)) continue;
        const matchedFields = fields.filter((field) =>
          normalise(fieldValue(menu, section, item, field), options.caseSensitive).includes(needle),
        );
        if (!matchedFields.length) continue;
        results.push({
          id: resultId(menu, section, item),
          menuId: menu.id,
          menuName: menu.name,
          sectionId: section.id,
          sectionName: section.name,
          dishId: item.id,
          dishName: item.name ?? '',
          desc: item.desc ?? '',
          price: item.price ?? '',
          tags: (item.tags ?? []).map((tag) => ({ ...tag })),
          note: item.note ?? '',
          matchedFields,
        });
      }
    }
  }

  return results;
}

export function previewReplacements(
  state: AppState,
  results: FindResult[],
  find: FindOptions,
  replace: ReplaceOptions,
): ReplacePreview[] {
  const selected = new Set(replace.resultIds);
  const fields = replace.fields.length ? replace.fields : (['name'] as ReplaceField[]);
  const previews: ReplacePreview[] = [];

  for (const result of results) {
    if (!selected.has(result.id)) continue;
    const menu = state.menus.find((candidate) => candidate.id === result.menuId);
    const section = menu?.sections.find((candidate) => candidate.id === result.sectionId);
    const dish = section?.items.find((candidate) => isDish(candidate) && candidate.id === result.dishId);
    if (!menu || !section || !dish || !isDish(dish)) continue;

    for (const field of fields) {
      const before = fieldValue(menu, section, dish, field);
      const after =
        replace.mode === 'matching-text'
          ? replaceMatchingText(before, find.query, replace.replacement, replace.caseSensitive ?? find.caseSensitive)
          : replace.replacement;
      if (before === after) continue;
      previews.push({
        resultId: result.id,
        menuName: menu.name,
        sectionName: section.name,
        dishName: dish.name ?? '',
        field,
        before,
        after,
      });
    }
  }

  return previews;
}

export function applyReplacementPreviews(state: AppState, previews: ReplacePreview[]): number {
  let changed = 0;

  for (const preview of previews) {
    const [menuId, sectionId, dishId] = preview.resultId.split(':');
    const menu = state.menus.find((candidate) => candidate.id === menuId);
    const section = menu?.sections.find((candidate) => candidate.id === sectionId);
    const dish = section?.items.find((candidate) => isDish(candidate) && candidate.id === dishId);
    if (!dish || !isDish(dish)) continue;
    if (preview.field === 'tags') dish.tags = parseTags(preview.after);
    else if (preview.field === 'name') dish.name = preview.after;
    else if (preview.field === 'desc') dish.desc = preview.after;
    else if (preview.field === 'price') dish.price = preview.after;
    else dish.note = preview.after;
    changed += 1;
  }

  return changed;
}
