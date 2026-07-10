const TEMPLATE_CATEGORY_ORDER = ['Griffin Classics', 'Core Layouts', 'Events', 'User Templates'];

const TEMPLATE_METADATA = {
  b1: { category: 'Core Layouts', description: 'Four-section A4 structure for seasonal restaurant menus.' },
  b2: { category: 'Core Layouts', description: 'Compact A5 set menu with stacked dish descriptions.' },
  b3: { category: 'Core Layouts', description: 'A4 menu led by the Griffin crest.' },
  b4: { category: 'Events', description: 'Full-lockup sharing format for feasts and private dining.' },
  b5: { category: 'Events', description: 'A5 per-head event or canapé structure.' },
  b6: { category: 'Core Layouts', description: 'A5 set menu with a leading rule for a formal layout.' },
  b7: { category: 'Griffin Classics', description: 'Two-column A4 roast layout for Sunday service.' },
  g1: { category: 'Griffin Classics', description: 'A5 set lunch format tuned for Griffin service.' },
  g2: { category: 'Griffin Classics', description: 'A5 buffet layout with crest header and no dietary key.' },
  g3: { category: 'Griffin Classics', description: 'A5 canapé layout with Griffin pricing note.' },
  g4: { category: 'Griffin Classics', description: 'A5 dinner set menu with below-line descriptions.' },
  g5: { category: 'Griffin Classics', description: 'A4 sharing menu with the full Griffin lockup.' },
  g6: { category: 'Griffin Classics', description: 'A5 private dining structure with clean course sections.' },
  g7: { category: 'Griffin Classics', description: 'A4 Sunday menu with a two-column main course section.' },
  g8: { category: 'Griffin Classics', description: 'A5 children’s menu with crest-led presentation.' }
};

function templateSummary(template) {
  const sections = Array.isArray(template.sections) ? template.sections : [];
  const columnCount = Math.max(1, ...sections.map((section) => Number(section.cols) || 1));
  const meta = TEMPLATE_METADATA[template.id] || {};
  return {
    id: template.id,
    category: template.builtin ? (meta.category || 'Core Layouts') : 'User Templates',
    description: template.description || meta.description || 'Saved menu layout.',
    paper: (template.style && template.style.paper) || 'A4',
    columnCount,
    protected: Boolean(template.builtin)
  };
}

function groupTemplates(templates) {
  const groups = new Map();
  for (const template of templates) {
    const summary = templateSummary(template);
    if (!groups.has(summary.category)) groups.set(summary.category, []);
    groups.get(summary.category).push({ template, summary });
  }
  return [...groups.entries()].sort((a, b) => {
    const ai = TEMPLATE_CATEGORY_ORDER.indexOf(a[0]);
    const bi = TEMPLATE_CATEGORY_ORDER.indexOf(b[0]);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a[0].localeCompare(b[0]);
  });
}

module.exports = {
  TEMPLATE_CATEGORY_ORDER,
  TEMPLATE_METADATA,
  groupTemplates,
  templateSummary
};
