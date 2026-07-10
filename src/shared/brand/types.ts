import type { DietKey, HeaderStyle, Paper } from '../types';

/** Colour tokens applied as CSS custom properties at boot. */
export interface BrandPalette {
  /** Accent colour (buttons, active states, brand mark). */
  copper: string;
  /** App background. */
  cream: string;
  /** Panels / space / contrast. */
  panel: string;
  /** Body text. */
  ink: string;
  /** Headlines. */
  headline: string;
  /** Muted / secondary text. */
  muted: string;
  /** Hairlines and borders. */
  line: string;
  /** Preview paper tint (screen only — exports are always white). */
  blush: string;
  /** Warm secondary background fills. */
  taupe: string;
  /** Occasional highlight. */
  gold: string;
  /** Strong seal accent (mode pill, primary actions) — pairs with sealInk. */
  seal: string;
  /** Text/mark colour on top of the seal accent. */
  sealInk: string;
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
