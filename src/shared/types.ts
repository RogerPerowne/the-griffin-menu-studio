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
  /** Sort order within a position group (top / after-section / bottom), shared
   *  with RootNote so lines and subtitles can be interleaved and reordered. */
  order?: number;
}

/** A free subtitle / note line positioned relative to the menu body — like a
 *  rule, but carrying editable text. There can be several, anywhere in the flow. */
export interface RootNote {
  id: string;
  note: true;
  text: string;
  position: RulePosition;
  afterSectionId?: string | null;
  /** Sort order within a position group — shared with Rule (see above). */
  order?: number;
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
  /** Positioned subtitle/note lines (headerNote migrates into a top note). */
  rootNotes?: RootNote[];
  /** Free-drag "Arrange" positions, keyed by element id. */
  pos: Record<string, { x: number; y: number }>;
  /** Per-menu typography (the Typography Master edits this; travels with the
   *  document). Seeded from settings.typography defaults on new menus. */
  typography?: MenuTypography;
}

/** Per-document typography — the source of truth the Typography Master applies to
 *  the live page and exports. `settings.typography` only supplies the defaults. */
export interface MenuTypography {
  fontSet?: 'griffin' | 'classic' | 'modern';
  /** Per-role overrides (extends the shared TypoRoleStyle with advanced fields). */
  roles?: Partial<Record<TypoRole, MenuTypoRoleStyle>>;
}

/** TypoRoleStyle plus the Typography Master's Advanced-section fields. */
export interface MenuTypoRoleStyle extends TypoRoleStyle {
  font?: string;
  lineHeight?: number;
  letterSpacing?: number;
  minSize?: number;
  maxSize?: number;
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
  typography?: TypographySettings;
  /** Which bundled default-typography design this settings blob was last aligned
   *  to. An app update only ever refreshes a user's typography when it ships a
   *  newer default design (a bump of TYPOGRAPHY_DEFAULTS_VERSION); every other
   *  update leaves saved settings and menus completely untouched. */
  typographyDefaultsVersion?: number;
}

/** The seven typographic roles on a menu. */
export type TypoRole = 'title' | 'section' | 'dish' | 'price' | 'desc' | 'key' | 'footer';

/** Per-role overrides applied to the menu page via CSS custom properties. */
export interface TypoRoleStyle {
  size?: number; // px
  weight?: number; // 400 | 500 | 600 | 700
  align?: 'left' | 'center' | 'right';
  caps?: 'none' | 'upper' | 'title';
  spaceAbove?: number; // px
  spaceBelow?: number; // px
}

/** Global + per-role typography defaults (the Typography Master panel edits these). */
export interface TypographySettings {
  /** Coordinated font pairing applied to the menu page. */
  fontSet?: 'griffin' | 'classic' | 'modern';
  /** Default overall text-size scale for new menus (maps to style.sc). */
  scale?: number;
  /** Default layout density for new menus (maps to style.dn). */
  density?: 'compact' | 'balanced' | 'spacious';
  /** Per-role style overrides. */
  roles?: Partial<Record<TypoRole, TypoRoleStyle>>;
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

/* ============================ Booklet (System 5) ============================ */
// A single landscape-A4 sheet folded once to an A5 booklet: cover + back panels,
// and an inside that is an A5 menu (may overflow to two inside pages) OR two
// separate menus. See docs/plan-booklet-system.md.

export interface BookletPanel {
  title?: string;
  subtitle?: string;
  note?: string;
  header: HeaderStyle;
  /** Brand-asset id for a cover/back image (resolved at render time). */
  image?: string;
}

export type BookletInside =
  | { mode: 'single'; menu: Menu; allowTwoPages: boolean }
  | { mode: 'two'; left: Menu; right: Menu };

export interface Booklet {
  id: string;
  name: string;
  date: string;
  cover: BookletPanel;
  back: BookletPanel;
  inside: BookletInside;
  style: { paper: 'A5'; sc: number; dn: number };
}

/* =================== Dockable panel workspace (System 3) =================== */
// A persisted layout tree (replaces settings.floatWindows): the document area
// fills the centre; tool panels dock in left/right areas or float. `Panel` is an
// id into the panel registry. See docs/plan-photoshop-panels.md.

export interface PanelGroup {
  panels: string[];
  activeTab: string;
  collapsed?: boolean;
}

export interface PanelStack {
  cells: { heightPct: number; group: PanelGroup }[];
}

export interface DockColumn {
  widthPct: number;
  stack: PanelStack;
}

export interface DockArea {
  columns: DockColumn[];
}

export interface FloatingGroup {
  x: number;
  y: number;
  w: number;
  h: number;
  group: PanelGroup;
}

export interface WorkspaceLayout {
  left: DockArea;
  right: DockArea;
  floating: FloatingGroup[];
}
