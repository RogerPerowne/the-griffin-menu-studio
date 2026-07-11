import type {
  Booklet,
  BookletInside,
  BookletPanel,
  Dish,
  Menu,
  MenuStyle,
  MenuTypography,
  MenuTypoRoleStyle,
  RootNote,
  Rule,
  RulePosition,
  Section,
  Tag,
  TypoRole,
  TypographySettings,
} from '@shared/types';

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

export function newRootNote(text = '', position: RulePosition = 'top', afterSectionId: string | null = null): RootNote {
  return { id: uid(), note: true, text, position, afterSectionId };
}

const DEFAULT_STYLE: MenuStyle = { paper: 'A4', header: 'title', showKey: true, showPrices: true, sc: 1, dn: 1 };

/**
 * Seed a per-document `menu.typography` from the settings defaults so a new menu
 * carries the user's chosen fonts/roles as its own truth (they then travel with
 * the `.menu` file). Deep-copies the per-role styles so later edits to the menu
 * never mutate the shared settings object. Returns `undefined` when there is
 * nothing to seed, so `newMenu()` stays byte-identical without defaults.
 */
export function newMenuTypography(defaults?: TypographySettings): MenuTypography | undefined {
  if (!defaults) return undefined;
  const typo: MenuTypography = {};
  if (defaults.fontSet) typo.fontSet = defaults.fontSet;
  if (defaults.roles) {
    const roles: Partial<Record<TypoRole, MenuTypoRoleStyle>> = {};
    for (const [role, style] of Object.entries(defaults.roles)) {
      if (style) roles[role as TypoRole] = { ...style };
    }
    if (Object.keys(roles).length) typo.roles = roles;
  }
  return typo.fontSet || typo.roles ? typo : undefined;
}

export function newMenu(
  name = 'New Menu',
  style: Partial<MenuStyle> = {},
  typography?: TypographySettings,
): Menu {
  const menu: Menu = {
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
  const seeded = newMenuTypography(typography);
  if (seeded) menu.typography = seeded;
  return menu;
}

/** A blank cover/back panel — no title/subtitle/note/image yet, just a header style. */
export function newBookletPanel(): BookletPanel {
  return { header: 'title' };
}

/**
 * A blank booklet: cover + back panels and a single-menu inside (no overflow yet)
 * on an A5 sheet. See docs/plan-booklet-system.md §1.
 */
export function newBooklet(name = 'New Booklet'): Booklet {
  const inside: BookletInside = { mode: 'single', menu: newMenu('Inside', { paper: 'A5' }), allowTwoPages: false };
  return {
    id: uid(),
    name,
    date: todayISO(),
    cover: newBookletPanel(),
    back: newBookletPanel(),
    inside,
    style: { paper: 'A5', sc: 1, dn: 1 },
  };
}
