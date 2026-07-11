// The fonts the Typography Master offers per role: the embedded, licensed brand
// fonts plus a curated set of fonts that ship with Windows. `family` is what
// render.ts emits into `--<role>-font`; `stack` is the full CSS fallback stack
// used when a whole set/role is applied. Keep `family` a single token so it round
// -trips through typographyVars' sanitiser.

export type FontSource = 'brand' | 'system';

export interface FontOption {
  label: string;
  family: string;
  source: FontSource;
  stack: string;
  /** Rough classification, for grouping/preview. */
  kind: 'serif' | 'sans' | 'display';
}

export const FONT_CATALOG: FontOption[] = [
  // --- Embedded brand fonts (licensed, bundled) ---
  { label: 'Brandon Grotesque', family: 'Brandon', source: 'brand', kind: 'sans', stack: "'Brandon', ui-sans-serif, system-ui, sans-serif" },
  { label: 'Aviano Didone', family: 'Aviano Didone', source: 'brand', kind: 'display', stack: "'Aviano Didone', 'Brandon', serif" },

  // --- System fonts (present on Windows) ---
  { label: 'Georgia', family: 'Georgia', source: 'system', kind: 'serif', stack: "Georgia, 'Times New Roman', serif" },
  { label: 'Times New Roman', family: 'Times New Roman', source: 'system', kind: 'serif', stack: "'Times New Roman', Times, serif" },
  { label: 'Garamond', family: 'Garamond', source: 'system', kind: 'serif', stack: "Garamond, 'EB Garamond', Georgia, serif" },
  { label: 'Cambria', family: 'Cambria', source: 'system', kind: 'serif', stack: "Cambria, Georgia, serif" },
  { label: 'Arial', family: 'Arial', source: 'system', kind: 'sans', stack: "Arial, Helvetica, sans-serif" },
  { label: 'Calibri', family: 'Calibri', source: 'system', kind: 'sans', stack: "Calibri, 'Segoe UI', sans-serif" },
  { label: 'Segoe UI', family: 'Segoe UI', source: 'system', kind: 'sans', stack: "'Segoe UI', system-ui, sans-serif" },
  { label: 'Verdana', family: 'Verdana', source: 'system', kind: 'sans', stack: "Verdana, Geneva, sans-serif" },
  { label: 'Trebuchet MS', family: 'Trebuchet MS', source: 'system', kind: 'sans', stack: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: 'Tahoma', family: 'Tahoma', source: 'system', kind: 'sans', stack: "Tahoma, Geneva, sans-serif" },
];

export const BRAND_FONTS = FONT_CATALOG.filter((f) => f.source === 'brand');
export const SYSTEM_FONTS = FONT_CATALOG.filter((f) => f.source === 'system');

/** Look up a catalog entry by its `family` token (as stored on a role). */
export function fontByFamily(family?: string): FontOption | undefined {
  return family ? FONT_CATALOG.find((f) => f.family === family) : undefined;
}
