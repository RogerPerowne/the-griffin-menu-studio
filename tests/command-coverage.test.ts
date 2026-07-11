import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const commandSource = fs.readFileSync('src/renderer/commands.ts', 'utf8');
const registered = new Set([...commandSource.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]));

describe('renderer command coverage', () => {
  it('does not render shell actions without a registered command', () => {
    const files = [
      'src/renderer/shell/app-shell.ts',
      'src/renderer/workspaces/index.ts',
      'src/renderer/panels/window-panels.ts',
    ];
    const used = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/data-cmd="([^"$]+)"/g)) used.add(match[1]);
    }
    expect([...used].filter((id) => !registered.has(id)).sort()).toEqual([]);
  });
});
