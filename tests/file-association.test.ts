import { describe, expect, it } from 'vitest';
import { MENU_PROG_ID, menuAssociationValues } from '../src/main/file-association';

describe('Windows .menu association', () => {
  it('uses Squirrel Update.exe rather than a versioned app folder in its command', () => {
    const values = menuAssociationValues(
      'C:\\Users\\Restaurant\\AppData\\Local\\GriffinMenuStudio\\app-1.0.0\\Griffin Menu Studio.exe',
      'C:\\Users\\Restaurant\\AppData\\Local\\GriffinMenuStudio\\Update.exe',
    );
    expect(values.command).toContain('Update.exe');
    expect(values.command).toContain('--processStart "Griffin Menu Studio.exe"');
    expect(values.command).toContain('%1');
    expect(MENU_PROG_ID).toBe('GriffinMenuStudio.menu');
  });
});
