import { app } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const MENU_PROG_ID = 'GriffinMenuStudio.menu';
const MENU_EXTENSION_KEY = 'HKCU\\Software\\Classes\\.menu';
const MENU_PROG_KEY = `HKCU\\Software\\Classes\\${MENU_PROG_ID}`;

export interface MenuAssociationValues {
  command: string;
  icon: string;
}

/**
 * MSI installations use the installed executable directly. WiX owns the normal
 * repair/update/uninstall lifecycle; this per-user association keeps double-
 * clicked `.menu` files working even for non-admin installs.
 */
export function menuAssociationValues(executablePath: string): MenuAssociationValues {
  return {
    command: `"${executablePath}" "%1"`,
    icon: `"${executablePath}",0`,
  };
}

function isWindowsPackagedApp(): boolean {
  return process.platform === 'win32' && app.isPackaged;
}

async function reg(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('reg.exe', args, { windowsHide: true });
  return stdout;
}

async function setDefault(key: string, value: string): Promise<void> {
  await reg(['add', key, '/ve', '/d', value, '/f']);
}

/** Register the current packaged MSI installation as the `.menu` handler. */
export async function ensureMenuFileAssociation(): Promise<void> {
  if (!isWindowsPackagedApp()) return;
  const values = menuAssociationValues(process.execPath);
  await setDefault(MENU_EXTENSION_KEY, MENU_PROG_ID);
  await setDefault(MENU_PROG_KEY, 'Griffin Menu Studio Menu');
  await setDefault(`${MENU_PROG_KEY}\\DefaultIcon`, values.icon);
  await setDefault(`${MENU_PROG_KEY}\\shell\\open\\command`, values.command);
}

/** Remove only Griffin's per-user association, and only if it still owns `.menu`. */
export async function removeMenuFileAssociation(): Promise<void> {
  if (process.platform !== 'win32') return;
  try {
    const current = await reg(['query', MENU_EXTENSION_KEY, '/ve']);
    if (current.includes(MENU_PROG_ID)) await reg(['delete', MENU_EXTENSION_KEY, '/ve', '/f']);
  } catch {
    // The extension key may not exist, which is already the desired state.
  }
  try {
    await reg(['delete', MENU_PROG_KEY, '/f']);
  } catch {
    // Do not turn an uninstall cleanup issue into an installer failure.
  }
}
