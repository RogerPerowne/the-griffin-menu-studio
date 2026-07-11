import { describe, expect, it } from 'vitest';
import {
  CURRENT_SETTINGS_VERSION,
  DEFAULT_TYPOGRAPHY,
  migrateSettings,
  serializeSettings,
  TYPOGRAPHY_DEFAULTS_VERSION,
} from '../src/shared/settings-format';

describe('settings-format', () => {
  it('falls back safely for corrupt input', () => {
    const settings = migrateSettings({
      dietKey: 'bad',
      layout: { sectionGap: 9999, innerRule: -4 },
      defaults: { paper: 'Letter', cols: 99 },
      recovery: { enabled: 'yes', intervalSeconds: 1 },
    });

    expect(settings.dietKey.length).toBeGreaterThan(0);
    expect(settings.layout?.sectionGap).toBe(180);
    expect(settings.layout?.innerRule).toBe(0);
    expect(settings.defaults).toMatchObject({ paper: 'A4', cols: 4 });
    expect(settings.recovery).toEqual({ enabled: true, intervalSeconds: 10 });
  });

  it('migrates older loose settings and preserves valid additions', () => {
    const settings = migrateSettings({
      blush: '#112233',
      defaults: { paper: 'A5', header: 'crest', cols: 3, descMode: 'below' },
      floatWindows: { typography: { x: 22, y: 33, w: 500, h: 600, open: true } },
    });

    expect(settings.blush).toBe('#112233');
    expect(settings.defaults).toMatchObject({ paper: 'A5', header: 'crest', cols: 3, descMode: 'below' });
    expect(settings.floatWindows?.typography).toMatchObject({ x: 22, y: 33, w: 500, h: 600, open: true });
  });

  it('writes a versioned settings wrapper', () => {
    const parsed = JSON.parse(serializeSettings(migrateSettings({})));
    expect(parsed.version).toBe(CURRENT_SETTINGS_VERSION);
    expect(parsed.settings.recovery.intervalSeconds).toBe(30);
  });

  describe('typography-default refresh gate (update safety)', () => {
    const customTypo = { fontSet: 'modern', scale: 1.2, density: 'spacious', roles: { title: { size: 40 } } };

    it('grandfathers existing users: keeps their typography and stamps the current version', () => {
      // No stamped version yet (every pre-mechanism user) → never wiped.
      const settings = migrateSettings({ typography: customTypo });
      expect(settings.typography).toMatchObject({ fontSet: 'modern', scale: 1.2, density: 'spacious' });
      expect(settings.typography?.roles?.title).toMatchObject({ size: 40 });
      expect(settings.typographyDefaultsVersion).toBe(TYPOGRAPHY_DEFAULTS_VERSION);
    });

    it('keeps typography when the stamped version already matches', () => {
      const settings = migrateSettings({ typography: customTypo, typographyDefaultsVersion: TYPOGRAPHY_DEFAULTS_VERSION });
      expect(settings.typography).toMatchObject({ fontSet: 'modern', scale: 1.2 });
    });

    it('adopts the new default design only when the stamped version is older', () => {
      const settings = migrateSettings({ typography: customTypo, typographyDefaultsVersion: TYPOGRAPHY_DEFAULTS_VERSION - 1 });
      expect(settings.typography).toEqual({ ...DEFAULT_TYPOGRAPHY, roles: {} });
      expect(settings.typographyDefaultsVersion).toBe(TYPOGRAPHY_DEFAULTS_VERSION);
    });
  });
});
