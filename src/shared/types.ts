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

/** A dish on a menu. Dishes are independent editable content. */
export interface Dish {
  id: string;
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
  /** Global "show prices" switch. Absent/true = shown; only an explicit
   *  `false` hides prices menu-wide (per-section `Section.prices` still
   *  applies on top of this). */
  showPrices?: boolean;
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
  /** Manually-written dietary key text, used when `style.showKey` is off. */
  dietKeyText?: string;
  sections: Section[];
  rootRules: Rule[];
  /** Free-drag "Arrange" positions, keyed by element id. */
  pos: Record<string, { x: number; y: number }>;
}

/** Reusable boilerplate text (footer, allergy notice, service charge, etc.). */
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
  category?: string;
  style: Partial<MenuStyle> & { paper: Paper; header: HeaderStyle };
  headerNote?: string;
  footer?: string;
  sections: TemplateSection[];
  leadRule?: boolean;
}

/** Print and layout fine-tuning. Defaults live in code. */
export interface ReleaseSettings {
  sectionGap: number;
  dishGap: number;
  innerRule: number;
  edgeRule: number;
  footerGap: number;
  colDivider: number;
}

export interface AppDefaults {
  paper?: Paper;
  header?: HeaderStyle;
  cols?: number;
  descMode?: DescMode;
  footer?: string;
  blush?: string;
  showPrices?: boolean;
  showKey?: boolean;
}

export interface StorageLocations {
  defaultMenuFolder?: string;
  templatesFolder?: string;
  recoveryFolder?: string;
  thumbnailFolder?: string;
  backupFolder?: string;
}

export interface RecoverySettings {
  enabled?: boolean;
  /** Debounced renderer autosave cadence. Main process enforces snapshot retention. */
  intervalSeconds?: number;
}

export interface Settings {
  dietKey: DietKey[];
  /** Preview-only paper tint (exports stay white). */
  blush?: string;
  /** Print and layout slider values. */
  layout?: ReleaseSettings;
  defaults?: AppDefaults;
  storage?: StorageLocations;
  // UI preferences persisted with the document/library.
  railWidth?: number;
  railHidden?: boolean;
  editorWidth?: number;
  tipSeen?: boolean;
  tipbarHidden?: boolean;
  /** Set once the first-run welcome tour has been shown/dismissed. */
  firstRunSeen?: boolean;
  /** Persisted bounds + open-state for the Photoshop-style floating tool windows. */
  floatWindows?: Record<string, FloatWindowBounds>;
  recovery?: RecoverySettings;
}

/** Position, size and last-open state of one floating tool window. */
export interface FloatWindowBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  open?: boolean;
}

export interface AppState {
  version: number;
  /** Id of the currently-open menu. */
  currentMenuId: string | null;
  menus: Menu[];
  userTemplates: Template[];
  boilerplate: Snippet[];
  settings: Settings;
}
