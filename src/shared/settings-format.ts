import type { AppDefaults, DietKey, FloatWindowBounds, ReleaseSettings, Settings, StorageLocations } from './types';

export const CURRENT_SETTINGS_VERSION = 1;

const DEFAULT_DIET_KEY: DietKey[] = [
  { c: 'v', l: 'vegetarian' },
  { c: 've', l: 'vegan' },
  { c: 'gf', l: 'gluten free' },
  { c: 'n', l: 'nuts' },
  { c: 's', l: 'soy' },
  { c: 'se', l: 'sesame' },
];

const DEFAULT_LAYOUT: ReleaseSettings = {
  sectionGap: 100,
  dishGap: 100,
  innerRule: 34,
  edgeRule: 94,
  footerGap: 100,
  colDivider: 86,
};

export const DEFAULT_SETTINGS: Settings = {
  dietKey: DEFAULT_DIET_KEY,
  blush: '#F5E4DF',
  layout: DEFAULT_LAYOUT,
  defaults: { paper: 'A4', header: 'title', cols: 1, descMode: 'inline', footer: '' },
  storage: {},
  railWidth: 230,
  railHidden: true,
  editorWidth: 380,
  tipSeen: false,
  tipbarHidden: false,
  floatWindows: {},
  recovery: { enabled: true, intervalSeconds: 30 },
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown, limit: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, limit) : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function dietKey(value: unknown): DietKey[] {
  if (!Array.isArray(value)) return DEFAULT_DIET_KEY.map((entry) => ({ ...entry }));
  const seen = new Set<string>();
  const key: DietKey[] = [];
  for (const entry of value) {
    const row = record(entry);
    const code = text(row?.c, 12)?.toLowerCase();
    const label = text(row?.l, 80)?.trim();
    if (!code || !label || !/^[a-z0-9]+$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    key.push({ c: code, l: label });
    if (key.length >= 32) break;
  }
  return key.length ? key : DEFAULT_DIET_KEY.map((entry) => ({ ...entry }));
}

function layout(value: unknown): ReleaseSettings {
  const input = record(value);
  return {
    sectionGap: number(input?.sectionGap, DEFAULT_LAYOUT.sectionGap, 40, 180),
    dishGap: number(input?.dishGap, DEFAULT_LAYOUT.dishGap, 40, 180),
    innerRule: number(input?.innerRule, DEFAULT_LAYOUT.innerRule, 0, 100),
    edgeRule: number(input?.edgeRule, DEFAULT_LAYOUT.edgeRule, 0, 100),
    footerGap: number(input?.footerGap, DEFAULT_LAYOUT.footerGap, 40, 180),
    colDivider: number(input?.colDivider, DEFAULT_LAYOUT.colDivider, 0, 100),
  };
}

function defaults(value: unknown): AppDefaults {
  const input = record(value);
  return {
    paper: input?.paper === 'A5' ? 'A5' : 'A4',
    header: input?.header === 'crest' || input?.header === 'lockup' ? input.header : 'title',
    cols: Math.round(number(input?.cols, 1, 1, 4)),
    descMode: input?.descMode === 'below' ? 'below' : 'inline',
    footer: text(input?.footer, 2_000) || '',
    blush: /^#[0-9a-f]{6}$/i.test(String(input?.blush || '')) ? String(input?.blush) : undefined,
  };
}

function storage(value: unknown): StorageLocations {
  const input = record(value);
  const result: StorageLocations = {};
  for (const key of ['defaultMenuFolder', 'templatesFolder', 'recoveryFolder', 'thumbnailFolder', 'backupFolder'] as const) {
    const path = text(input?.[key], 1_024)?.trim();
    if (path) result[key] = path;
  }
  return result;
}

function floatWindows(value: unknown): Record<string, FloatWindowBounds> {
  const input = record(value);
  const result: Record<string, FloatWindowBounds> = {};
  if (!input) return result;
  for (const [key, candidate] of Object.entries(input)) {
    if (!/^[a-z0-9_-]{1,64}$/i.test(key) || Object.keys(result).length >= 20) continue;
    const bounds = record(candidate);
    if (!bounds) continue;
    const width = number(bounds.w, 400, 240, 2_000);
    const height = number(bounds.h, 420, 160, 2_000);
    result[key] = {
      x: number(bounds.x, 40, -10_000, 10_000),
      y: number(bounds.y, 40, -10_000, 10_000),
      w: width,
      h: height,
      ...(typeof bounds.open === 'boolean' ? { open: bounds.open } : {}),
    };
  }
  return result;
}

/**
 * Tolerant, pure settings migration. Corrupt or future-shaped data falls back
 * field-by-field instead of preventing the renderer from booting.
 */
export function migrateSettings(raw: unknown): Settings {
  const outer = record(raw);
  const input = outer && record(outer.settings) ? record(outer.settings)! : outer || {};
  return {
    dietKey: dietKey(input.dietKey),
    blush: /^#[0-9a-f]{6}$/i.test(String(input.blush || '')) ? String(input.blush) : DEFAULT_SETTINGS.blush,
    layout: layout(input.layout),
    defaults: defaults(input.defaults),
    storage: storage(input.storage),
    railWidth: number(input.railWidth, DEFAULT_SETTINGS.railWidth || 230, 160, 640),
    railHidden: bool(input.railHidden) ?? false,
    editorWidth: number(input.editorWidth, DEFAULT_SETTINGS.editorWidth || 380, 260, 760),
    tipSeen: bool(input.tipSeen) ?? false,
    tipbarHidden: bool(input.tipbarHidden) ?? false,
    floatWindows: floatWindows(input.floatWindows),
    recovery: {
      enabled: bool(record(input.recovery)?.enabled) ?? true,
      intervalSeconds: Math.round(number(record(input.recovery)?.intervalSeconds, 30, 10, 300)),
    },
  };
}

export function serializeSettings(settings: Settings): string {
  return `${JSON.stringify({ version: CURRENT_SETTINGS_VERSION, settings: migrateSettings(settings) }, null, 2)}\n`;
}
