// Canonical domain model for Griffin Menu Studio.
// Single source of truth shared by the renderer, main process and tests.

/** A dietary tag on a dish. `r` = "on request" (renders "code on request"). */
export interface Tag {
  c: string;
  r: 0 | 1;
}

/** An entry in the dietary key (code -> label). */
export interface DietKey {
  c: string;
  l: string;
}

export type Paper = 'A4' | 'A5';
export type HeaderStyle = 'title' | 'crest' | 'lockup';
export type DescMode = 'inline' | 'below';
export type RulePosition = 'top' | 'between' | 'bottom';

/**
 * A dish on a menu. When linked to a catalogue product (`productId`), the
 * optional content fields act as per-menu OVERRIDES — absent fields inherit
 * from the product. Unlinked dishes carry their own content directly.
 */
export interface Dish {
  id: string;
  productId: string | null;
  name?: string;
  desc?: string;
  price?: string;
  tags?: Tag[];
  note?: string;
  hidden: boolean;
  col?: number;
}

/** A horizontal divider rule that can live inside a section's item flow. */
export interface RuleItem {
  id: string;
  type: 'rule';
  position: RulePosition;
}

export type SectionItem = Dish | RuleItem;

export interface Section {
  id: string;
  name: string;
  prices: boolean;
  note: string;
  items: SectionItem[];
  cols: number;
  columnNames: string[];
  descMode: DescMode;
}

/** A root-level divider rule positioned relative to the menu body. */
export interface Rule {
  id: string;
  rule: true;
  position: RulePosition;
  afterSectionId?: string | null;
}

export interface MenuStyle {
  paper: Paper;
  header: HeaderStyle;
  showKey: boolean;
  /** Font scale for shrink-to-fit (1 = default). */
  sc: number;
  /** Density/leading scale for shrink-to-fit (1 = default). */
  dn: number;
  stacked?: boolean;
}

export interface Menu {
  id: string;
  name: string;
  date: string;
  style: MenuStyle;
  headerNote: string;
  footer: string;
  sections: Section[];
  rootRules: Rule[];
  /** Free-drag "Arrange" positions, keyed by element id. */
  pos: Record<string, { x: number; y: number }>;
}

/** A catalogue product — the "change once, update everywhere" backbone. */
export interface Product {
  id: string;
  name: string;
  desc: string;
  price: string;
  tags: Tag[];
  note?: string;
  /** Global availability; false hides the product across all menus. */
  available: boolean;
  /** ISO date to auto-restore availability, or null. */
  unavailableUntil: string | null;
  category?: string;
  aliases?: string[];
}

/** Reusable boilerplate text (footer, allergy notice, service charge…). */
export interface Snippet {
  id: string;
  key: string;
  text: string;
}

/** A menu layout blueprint (built-in or user-saved). */
export interface TemplateSection {
  name: string;
  prices?: boolean;
  cols?: number;
  descMode?: DescMode;
  note?: string;
  ruleBefore?: boolean;
}

export interface Template {
  id: string;
  name: string;
  builtin?: boolean;
  description?: string;
  style: Partial<MenuStyle> & { paper: Paper; header: HeaderStyle };
  headerNote?: string;
  footer?: string;
  sections: TemplateSection[];
  leadRule?: boolean;
}

export interface Settings {
  dietKey: DietKey[];
  /** Preview-only paper tint (exports stay white). */
  blush?: string;
  /** Print & layout slider values (release defaults live in code). */
  release?: Record<string, number>;
}

export interface AppState {
  version: number;
  /** Id of the currently-open menu. */
  currentMenuId: string | null;
  menus: Menu[];
  products: Product[];
  userTemplates: Template[];
  boilerplate: Snippet[];
  settings: Settings;
}
