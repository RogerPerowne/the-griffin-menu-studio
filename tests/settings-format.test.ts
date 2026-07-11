import { describe, expect, it } from 'vitest';
import { CURRENT_SETTINGS_VERSION, migrateSettings, serializeSettings } from '../src/shared/settings-format';

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
});
