import { describe, expect, it } from 'vitest';
import { parseDocumentText, serializeDocument } from '../src/shared/document-format';
import { parseTemplateText, serializeTemplate } from '../src/shared/template-format';
import type { Template } from '../src/shared/types';

const template: Template = {
  id: 'template-a5-lunch',
  name: 'A5 Lunch',
  style: { paper: 'A5', header: 'title' },
  sections: [{ name: 'To Start' }],
};

const documentState = {
  currentMenuId: 'menu-1',
  menus: [{ id: 'menu-1', name: 'Lunch Menu' }],
  settings: {},
};

describe('Griffin .menu file kinds', () => {
  it('does not treat a template .menu as an editable menu document', () => {
    expect(() => parseDocumentText(serializeTemplate(template))).toThrow();
  });

  it('does not treat an editable menu .menu as a template', () => {
    expect(() => parseTemplateText(serializeDocument(documentState))).toThrow();
  });
});
