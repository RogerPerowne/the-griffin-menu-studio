// Faithful port of the mockup's seedState() — the initial menu library shipped
// with a fresh document. Ported from mockup.script.js seedState() (~lines 47-224).
//
// Model differences from the mockup, mapped here:
// - mockup item() -> newDish() (adds productId:null, hidden:false)
// - mockup sec() -> newSection()
// - the mockup's in-section rule() (only in "Lunch Set Menu" -> "To Start") is
//   promoted to a menu-level Rule in `rootRules`, matching how the mockup's own
//   ensureRootRules() migrates legacy in-section rule items.
// - the mockup rendered "below" description layout implicitly from
//   `style.stacked` at render time; the ported normaliseSectionColumns no longer
//   infers that, so stacked menus here set `descMode: 'below'` explicitly on
//   every section to preserve the original visual layout.
import type { AppState, Menu } from '@shared/types';
import { T, newDish, newMenu, newRule, newSection, todayISO } from '@shared/menu/factories';

export function griffinSeed(): AppState {
  const FOOT_VAT =
    'All prices include VAT and a discretionary 13% service charge will be added to your bill.';
  const FOOT_SEASON =
    'All our menus are seasonal and thus subject to availability.\nPlease let us know if you have any intolerances or allergies.';

  const menus: Menu[] = [];

  // ---- Lunch Menu ----
  {
    const m = newMenu('Lunch Menu', { paper: 'A4', header: 'title', showKey: true, sc: 1 });
    m.date = '2026-05-21';
    m.headerNote = '';
    m.footer = FOOT_SEASON;
    m.sections = [
      newSection('Whilst you wait…', [
        newDish('‘Ourdough’ Bakery Bread', 'tarragon & honey butter', '5', [T('v')]),
      ]),
      newSection('Starters', [
        newDish('Roasted Red Pepper & Sweet Potato Soup', 'seeded chilli oil', '9', [T('gf'), T('ve')]),
        newDish('Glazed Beetroot', 'sunflower seed sauce, crispy cavolo nero', '10', [T('gf'), T('ve')]),
        newDish('Crispy Wild Mushrooms', 'ginger & miso glaze, mushroom xo, sesame', '10', [
          T('gf'),
          T('se'),
          T('ve'),
        ]),
        newDish('Salmon & Hake Fishcake', 'wild garlic mayonnaise, pickled kohlrabi salad', '10.5', [T('gf')]),
        newDish(
          'Chalk Stream Trout Ceviche',
          'fennel, apple, crème fraiche, puffed barley, lemon & mustard dressing',
          '11',
          [T('gf', 1)],
        ),
        newDish('Tandoori Chicken Wings', 'poppadom crumb, crispy curry leaf, mint yogurt', '10', [T('gf', 1)]),
        newDish('Lamb Croquette', 'kohlrabi & yoghurt slaw, harissa dressing', '11', [T('gf')]),
      ]),
      newSection('Seasonal', [
        newDish('Pea & Broadbean Risotto', 'charred courgettes, ricotta, old winchester', '20', [
          T('gf'),
          T('v'),
          T('ve', 1),
        ]),
        newDish(
          'Heritage Carrot Gnocchi Parisienne',
          'spring greens, hazelnut crumb, pickled carrots',
          '19',
          [T('gf'), T('n'), T('ve', 1)],
        ),
        newDish('Baked Bagborough Brie Pie', 'carrot & apricot chutney, truffle honey, leaf salad', '19.5', [
          T('v'),
        ]),
        newDish('Seared Tuna', 'pickled carrot, choi sum, kombu dashi', '34', [T('gf')]),
      ]),
      newSection('Classic', [
        newDish('Pork Collar', 'white onion sauce, spring greens, pickled kohlrabi', '26', [T('gf')]),
        newDish('Pan Fried Stonebass', 'prawns, seaweed & samphire butter', '32', [T('gf')]),
        newDish(
          'Wagyu Smash Burger',
          'fries, house baked bun, bbq chipotle sauce, smoked applewood, confit garlic mayo',
          '20',
          [],
        ),
        newDish('38 Day Aged Hereford Ribeye (8oz)', 'stout & miso glaze, fries, chimichurri', '38', [
          T('gf', 1),
        ]),
      ]),
      newSection('On the side', [
        newDish('Spring Greens', 'xo sauce, smoked seeds', '7', [T('gf'), T('v'), T('ve', 1)]),
        newDish('Badger’s Garden Salad', 'lemon dressing', '8', [T('gf'), T('ve')]),
        newDish('Jersey Royals', 'mint & parsley pesto, old winchester', '7.5', [T('gf'), T('ve', 1)]),
        newDish('Skinny Fries', 'xo mayo', '6.5', [T('gf'), T('ve')]),
      ]),
    ];
    menus.push(m);
  }

  // ---- Dinner Menu ----
  {
    const m = newMenu('Dinner Menu', { paper: 'A4', header: 'title', showKey: true, sc: 1 });
    m.date = '2026-06-19';
    m.headerNote = '';
    m.footer =
      'Our menus are seasonal and therefore subject to availability. Please ask your server for children’s menu options\nand let us know if you have any intolerances or allergies.\n' +
      FOOT_VAT;
    m.sections = [
      newSection('Whilst you wait…', [
        newDish('‘Ourdough’ Bakery Bread', 'tarragon & honey butter', '5', [T('v')]),
      ]),
      newSection('Starters', [
        newDish('Roasted Red Pepper & Sweet Potato Soup', 'seeded chilli oil', '9', [T('gf'), T('ve')]),
        newDish('Glazed Beetroot', 'sunflower seed sauce, crispy cavolo nero', '10', [T('gf'), T('ve')]),
        newDish('Crispy Wild Mushrooms', 'ginger & miso glaze, mushroom xo, sesame', '10', [
          T('gf'),
          T('se'),
          T('ve'),
        ]),
        newDish(
          'Chalk Stream Trout Ceviche',
          'pickled fennel, apple, crème fraiche, barley, lemon & mustard dressing',
          '11',
          [T('gf', 1)],
        ),
        newDish('Tuna Tartare', 'heritage tomatoes, pickled fennel, seaweed', '12.5', [T('gf')]),
        newDish('Prawn Gyoza', 'asian bisque, pickled radish, crispy shallots', '13', []),
        newDish('Lamb Croquette', 'kohlrabi & yoghurt slaw, harissa dressing', '11', [T('gf')]),
        newDish(
          'Baked Bagborough Brie Pie (to share)',
          'leaf salad, truffle honey, carrot & apricot chutney',
          '19.5',
          [T('v')],
        ),
      ]),
      newSection('Mains', [
        newDish('Pea & Broadbean Risotto', 'charred courgettes, ricotta, old winchester', '20', [
          T('gf'),
          T('v'),
          T('ve', 1),
        ]),
        newDish(
          'Heritage Carrot Gnocchi Parisienne',
          'spring greens, pickled carrot, hazelnut crumb',
          '20',
          [T('gf'), T('n'), T('v'), T('ve', 1)],
        ),
        newDish('Pan Fried Stonebass', 'prawns, seaweed & samphire butter', '32', [T('gf')]),
        newDish('Seared Tuna', 'pickled carrot, choi sum, kombu dashi', '34', [T('gf')]),
        newDish('Chicken Kiev', 'chorizo & garlic butter, caprese salad', '28', []),
        newDish('Pork Collar', 'white onion sauce, spring greens, pickled kohlrabi', '26', [T('gf')]),
        newDish(
          '38 Day Aged Hereford Ribeye (8oz)',
          'stout & miso glaze, crispy onions, fries, truffled peppercorn',
          '38',
          [T('gf', 1)],
        ),
        newDish(
          '53 Day Aged Hereford Beef Tomahawk (42oz)',
          'spring greens, fries, leaf salad, truffled peppercorn sauce, chimichurri, crispy onions',
          '130',
          [T('gf', 1)],
          'two to three people to share',
        ),
      ]),
      newSection('Sides', [
        newDish('Badger’s Garden Salad', 'lemon dressing', '8', [T('gf'), T('ve')]),
        newDish('Spring Greens', 'xo sauce, smoked seeds', '7', [T('gf'), T('v'), T('ve', 1)]),
        newDish('Jersey Royals', 'mint & parsley pesto, old winchester', '7.5', [T('gf'), T('v'), T('ve', 1)]),
        newDish('Skinny Fries', 'xo mayo', '6.5', [T('gf'), T('ve')]),
      ]),
    ];
    menus.push(m);
  }

  // ---- Lunch Set Menu ----
  {
    const m = newMenu('Lunch Set Menu', {
      paper: 'A5',
      header: 'title',
      showKey: true,
      sc: 1,
      stacked: true,
    });
    m.date = '2026-05-21';
    m.headerNote = 'Two courses £20.00 | Three courses £25.00';
    m.footer = 'Please let us know if you have any intolerances or allergies.';
    const toStart = newSection(
      'To Start',
      [
        newDish('Roasted Red Pepper & Sweet Potato Soup', 'seeded chilli oil', '', [T('gf'), T('ve')]),
        newDish('Salmon & Hake Fishcake', 'wild garlic mayonnaise, pickled kohlrabi salad', '', [T('gf')]),
        newDish('Tandoori Chicken Wings', 'crispy curry leaf, poppadom crumb, mint yogurt', '', [T('gf', 1)]),
      ],
      { prices: false, descMode: 'below' },
    );
    m.sections = [
      toStart,
      newSection(
        'To Follow',
        [
          newDish('Pea & Broadbean Risotto', 'charred courgettes, ricotta', '', [T('gf'), T('v'), T('ve', 1)]),
          newDish('Cider Battered Haddock', 'peas, potato rosti, tartare beurre blanc', '', [T('gf')]),
          newDish('Pork Collar', 'white onion sauce, spring greens, pickled kohlrabi', '', [T('gf')]),
        ],
        { prices: false, descMode: 'below' },
      ),
      newSection(
        'On the side',
        [
          newDish('Spring Greens', '', '7', [T('gf'), T('v'), T('ve', 1)]),
          newDish('Badger’s Garden Salad', '', '8', [T('gf'), T('ve')]),
          newDish('Jersey Royals', '', '7.5', [T('gf'), T('ve', 1)]),
          newDish('Skinny Fries', '', '6.5', [T('gf'), T('ve')]),
        ],
        { descMode: 'below' },
      ),
      newSection(
        'Something Sweet…',
        [
          newDish(
            'Sticky Toffee Pudding',
            'fior di latte, caramel sauce, candied pecans',
            '',
            [T('gf', 1), T('v'), T('n')],
          ),
          newDish('Eton Mess', 'elderflower cream, strawberries', '', [T('gf')]),
        ],
        { prices: false, descMode: 'below' },
      ),
    ];
    // the mockup's only in-section rule() (leading item of "To Start") migrates to a root rule.
    m.rootRules = [newRule('between', toStart.id)];
    menus.push(m);
  }

  // ---- Dinner Set Menu ----
  {
    const m = newMenu('Dinner Set Menu', {
      paper: 'A5',
      header: 'title',
      showKey: true,
      sc: 1,
      stacked: true,
    });
    m.date = todayISO();
    m.headerNote = '';
    m.footer = FOOT_SEASON + '\n' + FOOT_VAT;
    m.sections = [
      newSection(
        'To Start',
        [
          newDish('Roasted Red Pepper & Sweet Potato Soup', 'chilli oil, crispy shallots', '', [
            T('ve'),
            T('gf'),
          ]),
          newDish('Crispy Wild Mushroom', 'ginger & miso glaze, mushroom xo, sesame', '', [
            T('ve'),
            T('se'),
            T('gf'),
          ]),
          newDish(
            'Fjord Trout Ceviche',
            'pickled fennel, rhubarb, crème fraiche & puffed barley',
            '',
            [T('gf', 1)],
          ),
          newDish('Seasonal Croquette', 'celeriac remoulade, burnt apple ketchup', '', [T('gf')]),
        ],
        { prices: false, descMode: 'below' },
      ),
      newSection(
        'To Follow',
        [
          newDish(
            'Heritage Carrot Gnocchi Parisienne',
            'hazelnut & brown butter crumb, cavolo nero',
            '',
            [T('gf'), T('v'), T('ve', 1)],
          ),
          newDish('Seasonal Fish', 'cavolo nero, shitake butter emulsion, pickled cucumber', '', [T('gf')]),
          newDish('Barbecued Chicken Breast', 'chorizo & judion bean fabada, serrano crumb', '', [T('gf')]),
          newDish('Blythburgh Pork Schnitzel', 'rainbow slaw, salsa verde', '', [T('gf')]),
          newDish('38 Day Aged Hereford Ribeye', 'stout & miso glaze, peppercorn, fries', '', [T('gf', 1)], '£7 supplement'),
        ],
        {
          prices: false,
          descMode: 'below',
          note: '(All mains accompanied by Hispi Cabbage & Skinny Fries)',
        },
      ),
      newSection(
        'Desserts',
        [
          newDish(
            'Sticky Toffee Pudding',
            'fior di latte gelato, caramelised pecans, caramel sauce',
            '',
            [T('v'), T('n'), T('gf', 1)],
          ),
          newDish('Coconut & Chocolate Cremeux', 'coconut crunch, honeycomb, coconut sorbet', '', [
            T('ve'),
            T('gf'),
          ]),
          newDish(
            'Cheese Board',
            'Baron Bigod Brie, Rachel Goats, Highmoor, Beauvale Blue — smoked seeds, quince jelly, pear & pink peppercorn chutney, grape mustard, crackers',
            '',
            [T('n')],
            '£5 supplement',
          ),
        ],
        { prices: false, descMode: 'below' },
      ),
    ];
    menus.push(m);
  }

  // ---- Sunday Menu ----
  {
    const m = newMenu('Sunday Menu', { paper: 'A4', header: 'crest', showKey: true, sc: 1 });
    m.date = '2026-03-29';
    m.headerNote = '';
    m.footer = FOOT_VAT;
    m.sections = [
      newSection('To Start', [
        newDish('Crispy Wild Mushrooms', 'ginger & miso glaze, mushroom xo, sesame', '10', [
          T('ve'),
          T('se'),
          T('gf'),
        ]),
        newDish('The Griffin Fishcake', 'smoked aioli, pickled kohlrabi salad', '10.5', [T('gf')]),
        newDish(
          'Chalkstream Trout Ceviche',
          'plum vinaigrette, granola, smoked crème fraiche, pickled kohlrabi',
          '11',
          [T('gf')],
        ),
        newDish('Tandoori Chicken Wings', 'poppadom crumb, crispy curry leaf', '10', [T('gf', 1)]),
        newDish('Pig’s Cheek Croquette', 'fennel slaw, burnt apple ketchup', '11', [T('gf')]),
      ]),
      newSection(
        'To Follow',
        [
          newDish('Roast Suckling Pig', 'chorizo & apple jam', '28', [T('gf', 1)]),
          newDish('Roast Aged Ribeye & Slow Cooked Beef Rib', 'horseradish cream', '29', [T('gf', 1)]),
          newDish('Roast Leg of Lamb & Slow Cooked Shoulder', 'house mint sauce', '28', [T('gf', 1)]),
          newDish('Roast Chicken Breast & Thyme Stuffed Thigh', 'redcurrants & port jelly', '27', [
            T('gf', 1),
          ]),
          newDish('Fish Pie', 'old winchester, mash, leeks, peas', '28', [T('gf', 1)]),
          newDish('Veggie Roast', 'bagborough brie pie, seasonal vegetables', '25', [T('v')]),
        ],
        {
          cols: 2,
          note:
            'All served with roast potatoes, buttered savoy cabbage & mixed seeds, caraway glazed carrots, cheesy leeks, yorkshire pudding & roasting juices',
        },
      ),
      newSection('Something Sweet…', [
        newDish('Strawberry Pavlova', 'champagne strawberries, whipped cream, pistachio, sherbet', '10.5', [
          T('n'),
          T('gf'),
        ]),
        newDish('Sticky Toffee Pudding', 'caramelised pecans, caramel sauce, fior di latte', '10', [
          T('v'),
          T('n'),
          T('gf', 1),
        ]),
        newDish('Crème Brûlée', 'beurre noisette shortbread', '10.5', [T('gf'), T('v')]),
        newDish('Coconut & Chocolate Cremeux', 'coconut crunch, honeycomb, coconut sorbet', '10', [
          T('ve'),
          T('n'),
          T('gf'),
        ]),
      ]),
      newSection('British Cheese', [
        newDish(
          'Baron Bigod Brie, Ashcombe, Katherine Goats, Beauvale Blue',
          'smoked seeds, pickled shallots, pear & pink peppercorn chutney, grape mustard, crackers',
          '13',
          [T('n')],
        ),
      ]),
    ];
    menus.push(m);
  }

  // ---- Sharing Menu ----
  {
    const m = newMenu('Sharing Menu', { paper: 'A4', header: 'lockup', showKey: true, sc: 1 });
    m.date = '2026-04-26';
    m.headerNote = '';
    m.footer = FOOT_SEASON + '\n' + FOOT_VAT;
    m.sections = [
      newSection(
        'Whilst you wait…',
        [newDish('‘Ourdough’ Freshly Baked Bread', 'flavoured butter', '', [T('v'), T('n')])],
        { prices: false },
      ),
      newSection(
        'To Start',
        [
          newDish('Loaded Potato Rosti', 'truffle honey, baked brie', '', [T('gf')]),
          newDish(
            'Fjord Trout Ceviche',
            'pickled fennel, rhubarb, crème fraiche & puffed barley',
            '',
            [T('gf', 1)],
          ),
          newDish('Seasonal Croquette', 'celeriac remoulade, burnt apple ketchup', '', [T('gf')]),
        ],
        { prices: false },
      ),
      newSection(
        'To Follow',
        [
          newDish(
            '45 Day Aged Hereford Tomahawk',
            'stout & miso glaze, peppercorn sauce, crispy onions',
            '',
            [T('gf', 1)],
          ),
          newDish('Seasonal Fish', 'salsa verde, lemon', '', [T('gf')]),
        ],
        {
          prices: false,
          note:
            'Vegetarian options also available\n(All mains accompanied by Hispi Cabbage & Skinny Fries)',
        },
      ),
      newSection(
        'Sharing Desserts',
        [
          newDish('Coconut & Chocolate Cremeux', 'coconut crunch, honeycomb, coconut sorbet', '', [
            T('gf'),
            T('ve'),
          ]),
          newDish(
            'Sticky Toffee Pudding',
            'fior di latte gelato, caramelised pecans, caramel sauce',
            '',
            [T('n'), T('gf', 1)],
          ),
          newDish(
            'Cheese Board',
            'Baron Bigod Brie, Rachel Goats, Beauvale Blue — smoked seeds, pear & pink peppercorn chutney, grape mustard, crackers',
            '',
            [],
          ),
        ],
        { prices: false },
      ),
    ];
    menus.push(m);
  }

  // ---- Children's Menu ----
  {
    const m = newMenu('Children’s Menu', {
      paper: 'A5',
      header: 'title',
      showKey: true,
      sc: 1,
      stacked: true,
    });
    m.date = todayISO();
    m.headerNote = '';
    m.footer = 'All prices include VAT and a discretionary 12.5% service charge will be added to your bill.';
    m.sections = [
      newSection(
        'To Start',
        [newDish('‘Ourdough’ Freshly Baked Sourdough', 'butter', '5', [T('v')])],
        { descMode: 'below' },
      ),
      newSection(
        'To Follow',
        [
          newDish('Penne Pasta, Tomato Sauce & Cheese', '', '10', [T('v')]),
          newDish('Fish Goujons, Fries & Peas', '', '10', [T('gf')]),
          newDish('Sausages, Fries & Peas', '', '10', [T('gf')]),
        ],
        { descMode: 'below' },
      ),
      newSection(
        'Only available on Sundays',
        [
          newDish('Child’s Roast Dinner', '', '12', [T('gf', 1)], 'any roast meat options available'),
        ],
        { descMode: 'below' },
      ),
      newSection(
        'Something Sweet',
        [
          newDish('Ice Cream', '', '2.5', [T('v'), T('gf')]),
          newDish('Sorbet', '', '2.5', [T('v'), T('gf')]),
        ],
        { descMode: 'below' },
      ),
    ];
    menus.push(m);
  }

  // ---- Summer Barbecue ----
  {
    const m = newMenu('Summer Barbecue', {
      paper: 'A5',
      header: 'title',
      showKey: true,
      sc: 1,
      stacked: true,
    });
    m.date = todayISO();
    m.headerNote = 'Every Saturday | 12pm – 6pm';
    m.footer =
      'Skewers, Flatbread & Salad | 25\n\nThis event is weather dependent. In the event of bad weather, dependent on capacity,\nwe will try to seat you inside instead. All bookings affected will be notified accordingly.';
    m.sections = [
      newSection(
        'Barbecued Skewers',
        [
          newDish('Courgette, Pepper & Aubergine', 'tahini dressing', '12', [T('ve'), T('gf')]),
          newDish('Cornish Monkfish', 'zhug', '15', [T('gf')]),
          newDish('Chicken Thigh', 'chipotle sauce', '13.5', [T('gf')]),
          newDish('Lamb Kofta', 'green yoghurt', '13.5', [T('gf')]),
        ],
        { descMode: 'below', note: '(3 per portion)' },
      ),
      newSection('Flatbread', [newDish('Manouche & Za’atar', '', '5', [])], { descMode: 'below' }),
      newSection('On the side', [newDish('Badger’s Garden Salad', '', '8', [T('ve'), T('gf')])], {
        descMode: 'below',
      }),
    ];
    menus.push(m);
  }

  // ---- Buffet Menu ----
  {
    const m = newMenu('Buffet Menu', {
      paper: 'A5',
      header: 'crest',
      showKey: false,
      sc: 1,
      stacked: true,
    });
    m.date = todayISO();
    m.headerNote = '£35 per head';
    m.footer = FOOT_VAT;
    m.sections = [
      newSection(
        'Buffet',
        [
          newDish('Freshly Baked Sourdough', 'seasonal butter', '', []),
          newDish('The Griffin Sausage Roll Lattice', 'smoked tomato & garlic chutney', '', []),
          newDish('Glazed Ham', 'honey & mustard', '', [T('gf')]),
          newDish('Smoked Salmon', 'capers & pickles', '', [T('gf')]),
          newDish(
            'Grilled Tenderstem Broccoli Salad',
            'tahini dressing, spring onion & parmesan',
            '',
            [T('v'), T('gf')],
          ),
          newDish('Roasted Butternut Squash Salad', 'harissa yoghurt & feta', '', [T('v'), T('gf')]),
          newDish('Freshly Baked Brownie & Carrot Cake Petit Fours', '', '', []),
        ],
        { prices: false, descMode: 'below' },
      ),
    ];
    menus.push(m);
  }

  // ---- Canapé Menu ----
  {
    const m = newMenu('Canapé Menu', {
      paper: 'A5',
      header: 'crest',
      showKey: false,
      sc: 1,
      stacked: true,
    });
    m.date = todayISO();
    m.headerNote = '4 for £20 p.h | 5 for £25 p.h | 6 for £30 p.h';
    m.footer = 'Additional £5 p.h for Petit Fours\nA discretionary 13% service charge will be added to your bill.';
    m.sections = [
      newSection(
        'Canapés',
        [
          newDish('Potato Rosti topped with Baron Bigod Brie', 'truffle honey dressing', '', [
            T('v'),
            T('gf'),
          ]),
          newDish('Mushroom Tartlet', 'xo sauce', '', [T('v')]),
          newDish('Monkfish Tempura', 'lemon & parsley mayo', '', [T('gf')]),
          newDish('Salt Cod Fritters', 'aioli', '', [T('gf')]),
          newDish('Sausage Rolls', 'tomato & smoked garlic chutney', '', []),
          newDish('Short Rib Croquette', 'mustard mayo', '', [T('gf')]),
          newDish('Chocolate Brownie & Carrot Cake Petit Fours', 'from ‘Ourdough’ bakery', '', []),
        ],
        { prices: false, descMode: 'below' },
      ),
    ];
    menus.push(m);
  }

  // ---- Celebration of Life ----
  {
    const m = newMenu('Celebration of Life', {
      paper: 'A5',
      header: 'crest',
      showKey: false,
      sc: 1,
      stacked: true,
    });
    m.date = todayISO();
    m.headerNote = '£35 per head';
    m.footer =
      'All prices include filter tea, coffee & juices.\nPlease note a discretionary 13% service charge will be added to your bill.';
    m.sections = [
      newSection(
        'Sandwiches',
        [
          newDish('Grilled Chicken & Avocado', '', '', []),
          newDish('Cheese & Tomato', '', '', []),
          newDish('Tuna & Cucumber', '', '', []),
        ],
        { prices: false, descMode: 'below', note: 'all served on our freshly baked sourdough' },
      ),
      newSection(
        'Canapés',
        [
          newDish('Bar Izzo Sausage Rolls', 'smoked tomato & garlic chutney', '', []),
          newDish('Smoked Trout Parfait', 'on brioche with pickles', '', []),
          newDish('Potato Rosti topped with Baron Bigod Brie', 'truffle honey dressing', '', []),
        ],
        { prices: false, descMode: 'below' },
      ),
      newSection(
        'Petit Fours',
        [
          newDish('Freshly Baked Brownies', 'salted caramel & marshmallow', '', []),
          newDish('Freshly Baked Carrot Cake', 'cream cheese frosting', '', []),
        ],
        { prices: false, descMode: 'below' },
      ),
    ];
    menus.push(m);
  }

  return {
    version: 1,
    currentMenuId: menus[0].id,
    menus,
    products: [],
    userTemplates: [],
    boilerplate: [],
    settings: {
      dietKey: [
        { c: 'v', l: 'vegetarian' },
        { c: 've', l: 'vegan' },
        { c: 'gf', l: 'gluten free' },
        { c: 'n', l: 'nuts' },
        { c: 's', l: 'soy' },
        { c: 'se', l: 'sesame' },
      ],
      blush: '#F5E4DF',
      railWidth: 230,
      railHidden: false,
      layout: {
        sectionGap: 100,
        dishGap: 100,
        innerRule: 34,
        edgeRule: 94,
        footerGap: 100,
        colDivider: 86,
      },
    },
  };
}
