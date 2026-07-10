import type { BrandConfig, BrandPalette } from './types';
import { griffin } from './griffin';

export type { BrandConfig, BrandPalette } from './types';

const BRANDS: Record<string, BrandConfig> = {
  griffin,
};

/** Active brand — a build-time constant now; a selection seam for later. */
export const ACTIVE_BRAND = 'griffin';

export function getActiveBrand(): BrandConfig {
  return BRANDS[ACTIVE_BRAND] ?? griffin;
}

export function getBrand(id: string): BrandConfig | undefined {
  return BRANDS[id];
}

/** Map a brand palette to the CSS custom properties the UI reads. */
export function paletteToCssVars(palette: BrandPalette): Record<string, string> {
  return {
    '--copper': palette.copper,
    '--cream': palette.cream,
    '--panel': palette.panel,
    '--ink': palette.ink,
    '--muted': palette.muted,
    '--line': palette.line,
    '--blush': palette.blush,
  };
}
