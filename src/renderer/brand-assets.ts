// Renderer-only: bundle the brand artwork through Vite so it gets a hashed,
// packaged-safe URL, keyed by the logical asset id used in the brand config.
import crestUrl from '../../assets/brands/griffin/crest.png';
import lockupUrl from '../../assets/brands/griffin/full-lockup.png';

const brandAssetUrls: Record<string, string> = {
  'griffin/crest': crestUrl,
  'griffin/lockup': lockupUrl,
};

export function assetUrl(key: string): string {
  return brandAssetUrls[key] ?? '';
}
