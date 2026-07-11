import { describe, expect, it } from 'vitest';
import {
  CURRENT_TEMPLATE_VERSION,
  MAX_TEMPLATE_BYTES,
  parseTemplateText,
  serializeTemplate,
  TEMPLATE_EXTENSION,
} from '../src/shared/template-format';
import type { Template } from '../src/shared/types';

function template(): Template {
  return {
    id: 't1',
    name: 'A5 Set Lunch',
    description: 'A compact lunch layout',
    category: 'Griffin Classics',
    style: { paper: 'A5', header: 'title', showKey: true, sc: 1 },
    headerNote: 'Two courses',
    footer: 'Please let us know if you have allergies.',
    sections: [{ name: 'To Start', prices: false, cols: 1, descMode: 'inline' }],
  };
}

describe('template-format', () => {
  it('uses the standard .menu extension for individual templates', () => {
    expect(TEMPLATE_EXTENSION).toBe('.menu');
  });

  it('serializes a versioned Griffin template document', () => {
    const text = serializeTemplate(template());
    const parsed = JSON.parse(text);
    expect(parsed.app).toBe('Griffin Menu Studio');
    expect(parsed.kind).toBe('template');
    expect(parsed.version).toBe(CURRENT_TEMPLATE_VERSION);
    expect(parsed.template.name).toBe('A5 Set Lunch');
  });

  it('round-trips a template through parse/serialize', () => {
    const source = template();
    const parsed = parseTemplateText(serializeTemplate(source));
    expect(parsed.template).toEqual(source);
  });

  it('migrates a loose legacy template object', () => {
    const parsed = parseTemplateText(JSON.stringify(template()));
    expect(parsed.kind).toBe('template');
    expect(parsed.template.name).toBe('A5 Set Lunch');
  });

  it('rejects unexpectedly large imported template text', () => {
    expect(() => parseTemplateText(' '.repeat(MAX_TEMPLATE_BYTES + 1))).toThrow(/too large/i);
  });
});
