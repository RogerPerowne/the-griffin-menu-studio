import { describe, expect, it } from 'vitest';
import { MENU_PROG_ID, menuAssociationValues } from '../src/main/file-association';

describe('Windows .menu association', () => {
  it('uses the installed MSI executable directly', () => {
    const values = menuAssociationValues('C:\\Users\\Restaurant\\AppData\\Local\\Programs\\Griffin Menu Studio\\Griffin Menu Studio.exe');
    expect(values.command).toContain('Griffin Menu Studio.exe');
    expect(values.command).toContain('%1');
    expect(MENU_PROG_ID).toBe('GriffinMenuStudio.menu');
  });
});
