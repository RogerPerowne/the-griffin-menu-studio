import type { DietKey, HeaderStyle, Paper } from '../types';

/** Colour tokens applied as CSS custom properties at boot. */
export interface BrandPalette {
  copper: string;
  cream: string;
  panel: string;
  ink: string;
  muted: string;
  line: string;
  blush: string;
}

/**
 * Everything restaurant-specific lives here so a second restaurant is a config
 * swap (new brand file + assets), not a fork. `assetKeys` are logical ids the
 * renderer maps to bundled image URLs (see renderer/brand-assets.ts).
 */
export interface BrandConfig {
  id: string;
  displayName: string;
  assetKeys: {
    crest: string;
    lockup: string;
  };
  palette: BrandPalette;
  defaults: {
    paper: Paper;
    headerStyle: HeaderStyle;
    dietKey: DietKey[];
    footerBoilerplate: string[];
  };
  /** Which template set applies to this brand. */
  templateSet: string;
}
