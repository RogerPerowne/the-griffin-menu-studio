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

// ---- Installed-font enumeration (Local Font Access API) --------------------
// The curated SYSTEM_FONTS above are the safe, always-present Windows fonts.
// On a user gesture we can additionally enumerate EVERY installed font via
// `queryLocalFonts()` (Chromium/Electron) and merge them in, so the user can
// pick any font on their machine. The result is cached for the session.

let installed: FontOption[] = [];
let installedLoaded = false;

/** Fonts enumerated from the machine so far (empty until `loadInstalledFonts`). */
export function installedFonts(): FontOption[] {
  return installed;
}

/** True once enumeration has run (whether it found anything or not). */
export function installedFontsLoaded(): boolean {
  return installedLoaded;
}

/** Curated system fonts plus any enumerated installed fonts, de-duplicated. */
export function allSystemFonts(): FontOption[] {
  return [...SYSTEM_FONTS, ...installed];
}

/**
 * Enumerate installed fonts via the Local Font Access API and cache them.
 * Must be called from a user gesture (the API requires transient activation).
 * Safe to call repeatedly — it only queries once, and silently no-ops when the
 * API is unavailable (non-Electron/headless) or permission is denied, leaving
 * the curated SYSTEM_FONTS as the fallback.
 */
export async function loadInstalledFonts(): Promise<FontOption[]> {
  if (installedLoaded) return installed;
  const query = (globalThis as { queryLocalFonts?: () => Promise<Array<{ family: string }>> }).queryLocalFonts;
  if (typeof query !== 'function') {
    installedLoaded = true;
    return installed;
  }
  try {
    const known = new Set(FONT_CATALOG.map((f) => f.family.toLowerCase()));
    const seen = new Set<string>();
    const found: FontOption[] = [];
    for (const face of await query()) {
      const family = face.family;
      const key = family.toLowerCase();
      if (!family || known.has(key) || seen.has(key)) continue;
      seen.add(key);
      found.push({
        label: family,
        family,
        source: 'system',
        kind: 'sans',
        stack: `'${family.replace(/['\\]/g, '')}', system-ui, sans-serif`,
      });
    }
    found.sort((a, b) => a.label.localeCompare(b.label));
    installed = found;
  } catch {
    // Permission denied / unsupported — keep the curated list.
  }
  installedLoaded = true;
  return installed;
}

/** Look up a catalog entry by its `family` token (as stored on a role). Searches
 *  the curated catalog first, then any enumerated installed fonts. */
export function fontByFamily(family?: string): FontOption | undefined {
  if (!family) return undefined;
  return FONT_CATALOG.find((f) => f.family === family) ?? installed.find((f) => f.family === family);
}
