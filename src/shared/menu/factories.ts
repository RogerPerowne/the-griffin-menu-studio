import type { Dish, Menu, MenuStyle, Rule, RulePosition, Section, Tag } from '@shared/types';

export const uid = (): string => Math.random().toString(36).slice(2, 9);
export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export function T(c: string, r?: boolean | number): Tag {
  return { c, r: r ? 1 : 0 };
}

export function newDish(name = '', desc = '', price = '', tags: Tag[] = [], note = ''): Dish {
  return { id: uid(), name, desc, price, tags, note, hidden: false };
}

export function newSection(name: string, items: Dish[] = [], opts: Partial<Section> = {}): Section {
  return {
    id: uid(),
    name,
    prices: true,
    note: '',
    items,
    cols: 1,
    columnNames: [],
    descMode: 'inline',
    ...opts,
  };
}

export function newRule(position: RulePosition = 'between', afterSectionId: string | null = null): Rule {
  return { id: uid(), rule: true, position, afterSectionId };
}

const DEFAULT_STYLE: MenuStyle = { paper: 'A4', header: 'title', showKey: true, sc: 1, dn: 1 };

export function newMenu(name = 'New Menu', style: Partial<MenuStyle> = {}): Menu {
  return {
    id: uid(),
    name,
    date: todayISO(),
    style: { ...DEFAULT_STYLE, ...style },
    headerNote: '',
    footer: '',
    sections: [],
    rootRules: [],
    pos: {},
  };
}
