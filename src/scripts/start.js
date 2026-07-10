'use strict';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const uid = (() => { let i = 0; return () => `start-${++i}`; })();
const T = (c, r) => ({ c, r: r ? 1 : 0 });
const rule = () => ({ id: uid(), type: 'rule', position: 'between' });
const item = (name, desc, price, tags, note) => ({ id: uid(), name, desc, price, tags: tags || [], note: note || '' });
const sec = (name, items, options = {}) => ({
  id: uid(),
  name,
  items,
  prices: options.prices !== false,
  cols: options.cols || 1,
  note: options.note || '',
  descMode: options.descMode || 'inline'
});

const defaultDietKey = [
  { c: 'v', l: 'vegetarian' },
  { c: 've', l: 'vegan' },
  { c: 'gf', l: 'gluten free' },
  { c: 'n', l: 'nuts' },
  { c: 'se', l: 'sesame' }
];

const templates = [
  { id: 'g1', name: 'Griffin A5 Set Lunch', builtin: true, style: { paper: 'A5', header: 'title', showKey: true, sc: 1 }, headerNote: 'Two courses £00.00 | Three courses £00.00', sections: [{ name: 'To Start', prices: false }, { name: 'To Follow', prices: false }, { name: 'Something Sweet...', prices: false }], footer: 'Please let us know if you have any intolerances or allergies.' },
  { id: 'b1', name: 'A La Carte', builtin: true, style: { paper: 'A4', header: 'title', showKey: true, sc: 1 }, headerNote: '', sections: [{ name: 'Whilst you wait...', prices: true }, { name: 'Starters', prices: true }, { name: 'Mains', prices: true }, { name: 'Sides', prices: true }], footer: 'All our menus are seasonal and thus subject to availability.\nPlease let us know if you have any intolerances or allergies.' },
  { id: 'b2', name: 'Set Menu', builtin: true, style: { paper: 'A5', header: 'title', showKey: true, sc: 1, stacked: true }, headerNote: 'Two courses £00.00 | Three courses £00.00', sections: [{ name: 'To Start', prices: false }, { name: 'To Follow', prices: false }, { name: 'Something Sweet...', prices: false }], footer: 'Please let us know if you have any intolerances or allergies.' },
  { id: 'b3', name: 'Crested', builtin: true, style: { paper: 'A4', header: 'crest', showKey: true, sc: 1 }, headerNote: '', sections: [{ name: 'To Start', prices: true }, { name: 'To Follow', prices: true }, { name: 'Something Sweet...', prices: true }], footer: 'All prices include VAT and a discretionary 13% service charge will be added to your bill.' },
  { id: 'b4', name: 'Feast / Sharing', builtin: true, style: { paper: 'A4', header: 'lockup', showKey: true, sc: 1 }, headerNote: '', sections: [{ name: 'Whilst you wait...', prices: false }, { name: 'To Start', prices: false }, { name: 'To Follow', prices: false }, { name: 'Sharing Desserts', prices: false }], footer: 'All our menus are seasonal and thus subject to availability.\nPlease let us know if you have any intolerances or allergies.' },
  { id: 'b5', name: 'Event / Per Head', builtin: true, style: { paper: 'A5', header: 'crest', showKey: false, sc: 1, stacked: true }, headerNote: '£00 per head', sections: [{ name: 'Canapes', prices: false }], footer: 'A discretionary 13% service charge will be added to your bill.' },
  { id: 'b6', name: 'Ruled Set Menu', builtin: true, leadRule: true, style: { paper: 'A5', header: 'title', showKey: true, sc: 1, stacked: true }, headerNote: 'Two courses £00.00 | Three courses £00.00', sections: [{ name: 'To Start', prices: false }, { name: 'To Follow', prices: false }, { name: 'Something Sweet...', prices: false }], footer: 'Please let us know if you have any intolerances or allergies.' },
  { id: 'b7', name: 'Two-Column Roast', builtin: true, leadRule: true, style: { paper: 'A4', header: 'crest', showKey: true, sc: 1 }, headerNote: '', sections: [{ name: 'To Start', prices: true }, { name: 'To Follow', prices: true, cols: 2, descMode: 'below' }, { name: 'Something Sweet...', prices: true }], footer: 'All prices include VAT and a discretionary 13% service charge will be added to your bill.' },
  { id: 'g2', name: 'Griffin Buffet 2026', builtin: true, style: { paper: 'A5', header: 'crest', showKey: false, sc: 1 }, headerNote: '£35 per head', sections: [{ name: 'Buffet', prices: false, descMode: 'below' }], footer: 'All prices include VAT and a discretionary 13% service charge will be added to your bill.' },
  { id: 'g5', name: 'Griffin Sharing Menu', builtin: true, style: { paper: 'A4', header: 'lockup', showKey: true, sc: 1 }, headerNote: '', sections: [{ name: 'Whilst you wait...', prices: false }, { name: 'To Start', prices: false }, { name: 'To Follow', prices: false }, { name: 'Sharing Desserts', prices: false }], footer: 'All our menus are seasonal and thus subject to availability.' },
  { id: 'g6', name: 'Griffin Skewers', builtin: true, style: { paper: 'A5', header: 'title', showKey: true, sc: 1 }, headerNote: 'Every Saturday | 12pm - 6pm', sections: [{ name: 'Barbecued Skewers', prices: true, descMode: 'below' }, { name: 'Flatbread', prices: true, descMode: 'below' }, { name: 'On the side', prices: true, descMode: 'below' }], footer: 'This event is weather dependent.' },
  { id: 'g3', name: 'Griffin Canape 2026', builtin: true, style: { paper: 'A5', header: 'crest', showKey: false, sc: 1 }, headerNote: '4 for £20 p.h | 5 for £25 p.h | 6 for £30 p.h', sections: [{ name: 'Canapes', prices: false, descMode: 'below' }], footer: 'A discretionary 13% service charge will be added to your bill.' },
  { id: 'g4', name: 'Griffin Dinner Set', builtin: true, style: { paper: 'A5', header: 'title', showKey: true, sc: 1 }, headerNote: 'Two courses £00.00 | Three courses £00.00', sections: [{ name: 'To Start', prices: false, descMode: 'below' }, { name: 'To Follow', prices: false, descMode: 'below' }, { name: 'Something Sweet...', prices: false, descMode: 'below' }], footer: 'Please let us know if you have any intolerances or allergies.' },
  { id: 'g7', name: 'Griffin Sunday Menu', builtin: true, style: { paper: 'A4', header: 'crest', showKey: true, sc: 1 }, headerNote: '', sections: [{ name: 'To Start', prices: true }, { name: 'To Follow', prices: true, cols: 2, descMode: 'below' }, { name: 'Something Sweet...', prices: true }], footer: 'All prices include VAT and a discretionary 13% service charge will be added to your bill.' },
  { id: 'g8', name: 'Griffin Children Menu', builtin: true, style: { paper: 'A5', header: 'crest', showKey: true, sc: 1 }, headerNote: '', sections: [{ name: 'To Start', prices: true, descMode: 'below' }, { name: 'To Follow', prices: true, descMode: 'below' }, { name: 'Something Sweet', prices: true, descMode: 'below' }], footer: 'Please let us know if you have any intolerances or allergies.' }
];

function usedCodes(menu, settings) {
  const set = new Set();
  (menu.sections || []).forEach((section) => (section.items || []).forEach((dish) => (dish.tags || []).forEach((tag) => set.add(tag.c))));
  return (settings?.dietKey || defaultDietKey).filter((key) => set.has(key.c));
}

function tagsStr(tags, settings) {
  if (!tags || !tags.length) return '';
  const order = (settings?.dietKey || defaultDietKey).map((key) => key.c);
  return `(${[...tags].sort((a, b) => (a.r - b.r) || (order.indexOf(a.c) - order.indexOf(b.c))).map((tag) => tag.r ? `${tag.c} on request` : tag.c).join(', ')})`;
}

function menuHTML(menu, settings = {}) {
  const st = menu.style || {};
  const itemHTML = (dish, section) => {
    const tg = tagsStr(dish.tags, settings);
    const below = section.descMode === 'below' || (section.descMode == null && st.stacked);
    if (dish.type === 'rule') return '<div class="m-rule rule-between"></div>';
    if (below) {
      const bits = [dish.desc ? esc(dish.desc) : '', tg ? `<span class="m-tg">${esc(tg)}</span>` : '', dish.note ? `<span class="m-nt">(${esc(dish.note)})</span>` : ''].filter(Boolean);
      return `<div class="m-item stacked"><span class="m-nm">${esc(dish.name)}${section.prices && dish.price ? ` <span class="m-pr">${esc(dish.price)}</span>` : ''}</span>${bits.length ? `<span class="m-ds">${bits.join(' ')}</span>` : ''}</div>`;
    }
    return `<div class="m-item"><span class="m-nm">${esc(dish.name)}</span>${dish.desc ? ` <span class="m-dash">-</span> <span class="m-ds">${esc(dish.desc)}</span>` : ''}${tg ? ` <span class="m-tg">${esc(tg)}</span>` : ''}${dish.note ? ` <span class="m-nt">(${esc(dish.note)})</span>` : ''}${section.prices && dish.price ? ` <span class="m-pr">${esc(dish.price)}</span>` : ''}</div>`;
  };
  let html = '';
  if (st.header === 'crest') html += '<div class="mblk"><img class="m-crest" src="assets/crest.png" alt=""></div>';
  if (st.header === 'lockup') html += '<div class="mblk"><img class="m-lockup" src="assets/full-lockup.png" alt=""></div>';
  html += `<div class="mblk"><div class="m-title">${esc(menu.name || 'Menu')}</div></div>`;
  if (menu.headerNote) html += `<div class="mblk"><div class="m-hnote">${esc(menu.headerNote)}</div></div>`;
  html += '<div class="body">';
  for (const section of menu.sections || []) {
    const cls = section.cols > 1 ? 'm-sec multi' : 'm-sec';
    let sectionHTML = `<div class="m-sech">${esc(section.name || '')}</div>`;
    if (section.note) sectionHTML += `<div class="m-secnote">${esc(section.note)}</div>`;
    if (section.cols > 1) {
      const cols = Array.from({ length: section.cols }, () => []);
      (section.items || []).forEach((dish, index) => cols[index % section.cols].push(dish));
      sectionHTML += `<div class="m-items" style="--cols:${section.cols}">${cols.map((col) => `<div class="m-col">${col.map((dish) => itemHTML(dish, section)).join('')}</div>`).join('')}</div>`;
    } else {
      sectionHTML += `<div class="m-items">${(section.items || []).map((dish) => itemHTML(dish, section)).join('')}</div>`;
    }
    html += `<div class="mblk"><div class="${cls}">${sectionHTML}</div></div>`;
  }
  html += '</div>';
  let footer = '';
  if (st.showKey) {
    const codes = usedCodes(menu, settings);
    if (codes.length) footer += `<div class="mblk"><div class="m-key">${esc(codes.map((key) => `(${key.c}) ${key.l}`).join('  '))}</div></div>`;
  }
  footer += `<div class="mblk"><div class="m-foot">${esc(menu.footer || '')}</div></div>`;
  return `<div class="page ${st.paper === 'A5' ? 'A5' : ''}" style="--sc:${st.sc || 1};--dn:${st.dn || 1}"><div class="inner">${html}<div class="print-footer-zone">${footer}</div></div></div>`;
}

function templateToSample(template) {
  const dishes = [
    item('Heritage Tomato', 'basil, aged balsamic', '9', [T('ve'), T('gf')]),
    item('Chicken Parfait', 'toasted brioche, chutney', '10', [T('gf', 1)]),
    item('Roast Cod', 'brown shrimp butter, greens', '24', [T('gf')]),
    item('Rump of Lamb', 'dauphinoise, red wine jus', '28', [T('gf')]),
    item('Sticky Toffee', 'caramel, pecans', '9', [T('v'), T('n')]),
    item('Lemon Tart', 'creme fraiche', '9', [T('v')])
  ];
  const menu = { name: 'Lunch Menu', date: '', headerNote: template.headerNote || '', footer: template.footer || '', style: structuredClone(template.style || { paper: 'A4', header: 'title', showKey: true, sc: 1 }), sections: [] };
  menu.style.showKey = template.style?.showKey !== false;
  (Array.isArray(template.sections) ? template.sections : []).forEach((section, index) => {
    const items = [];
    if ((index === 0 && template.leadRule) || section.ruleBefore) items.push(rule());
    for (let i = 0; i < (section.cols === 2 ? 4 : 2); i++) items.push(dishes[(index * 2 + i) % dishes.length]);
    menu.sections.push(sec(section.name, items, { prices: section.prices !== false, cols: section.cols || 1, note: section.note || '', descMode: section.descMode || (template.style.stacked ? 'below' : 'inline') }));
  });
  return menu;
}

function exactThumbnail(menu, width = 160, height = 198) {
  const paper = menu.style?.paper === 'A5' ? 'A5' : 'A4';
  const w = paper === 'A5' ? 148 : 210;
  const h = paper === 'A5' ? 210 : 297;
  const scale = Math.min(width / (w * 3.7795), height / (h * 3.7795));
  return `<div class="exact-thumb"><div class="exact-scale" style="transform:scale(${scale});transform-origin:center">${menuHTML(menu, { dietKey: defaultDietKey })}</div></div>`;
}

function renderRecent(recent) {
  const grid = $('#recentGrid');
  const count = $('#recentCount');
  const items = (recent || []).slice(0, 8);
  count.textContent = items.length ? `${items.length} available` : 'None yet';
  if (!items.length) {
    grid.innerHTML = '<div class="empty">No recent menus yet. Create a menu from a template or open an existing Griffin document.</div>';
    return;
  }
  grid.innerHTML = items.map((entry, index) => {
    const menu = entry.state?.menus?.find((item) => item.id === entry.state?.cur) || entry.state?.menus?.[0];
    return `<button class="recent-card" data-index="${index}">
      ${menu ? exactThumbnail(menu, 148, 164) : '<div class="empty">Preview unavailable</div>'}
      <span class="recent-name">${esc(entry.name || entry.fileName || 'Untitled')}</span>
      <span class="recent-path">${esc(entry.filePath || '')}</span>
      <span class="recent-date">${entry.modifiedMs ? esc(new Date(entry.modifiedMs).toLocaleDateString('en-GB')) : ''}</span>
    </button>`;
  }).join('');
  grid._items = items;
}

function renderTemplates() {
  const saved = (() => {
    try {
      const state = JSON.parse(localStorage.getItem('griffinMenuStudio.v1') || '{}');
      return Array.isArray(state.templates) ? state.templates.filter((template) => template && template.id && template.style && Array.isArray(template.sections)).map((template) => ({ ...template, builtin: false })) : [];
    } catch {
      return [];
    }
  })();
  $('#templateGrid').innerHTML = [...templates, ...saved].map((template) => {
    const sample = templateToSample(template);
    const cols = Math.max(1, ...(Array.isArray(template.sections) ? template.sections : []).map((section) => Number(section.cols) || 1));
    return `<article class="tpl-card">
      ${exactThumbnail(sample, 150, 178)}
      <div class="tpl-name">${esc(template.name)}</div>
      <div class="tpl-meta">${esc(template.style.paper || 'A4')} · ${cols} column${cols === 1 ? '' : 's'}${template.builtin === false ? ' · Yours' : ''}</div>
      <button data-template="${template.id}">Use Template</button>
    </article>`;
  }).join('');
}

async function boot() {
  renderTemplates();
  try {
    const data = await window.griffinDesktop.getStartData();
    renderRecent(data.recent || []);
  } catch {
    renderRecent([]);
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.griffinDesktop.rendererReady({ surface: 'start', readyAt: Date.now() });
}

$('#btnCreate').addEventListener('click', () => $('#templates').scrollIntoView({ behavior: 'smooth', block: 'start' }));
$('#btnOpen').addEventListener('click', () => window.griffinDesktop.openFromStart());
$('#recentGrid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-index]');
  if (!card) return;
  const entry = event.currentTarget._items?.[Number(card.dataset.index)];
  if (entry?.filePath) window.griffinDesktop.openRecentFromStart(entry.filePath);
});
$('#templateGrid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-template]');
  if (button) window.griffinDesktop.createFromTemplate(button.dataset.template);
});

window.griffinDesktop.onCommand((payload) => {
  const command = payload && payload.command;
  if (command === 'new' || command === 'new-template' || command === 'new-menu') {
    $('#templates').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (command === 'open') {
    window.griffinDesktop.openFromStart();
  } else if (command === 'open-recent' && payload.filePath) {
    window.griffinDesktop.openRecentFromStart(payload.filePath);
  } else if (command === 'zoom-in') {
    document.body.style.zoom = String(Math.min(1.35, (Number(document.body.style.zoom) || 1) + 0.1));
  } else if (command === 'zoom-out') {
    document.body.style.zoom = String(Math.max(0.8, (Number(document.body.style.zoom) || 1) - 0.1));
  } else if (command === 'actual-size' || command === 'fit-page') {
    document.body.style.zoom = '1';
  } else if (command === 'toggle-full-screen') {
    document.documentElement.requestFullscreen?.();
  }
});

boot();
