// Career mode: each level is a recipe the judges know. A cooked dish is scored on how closely it matches
// the recipe (taste, techniques, ingredients) and on how much the judges like it.
//
// `par` is the reference way to cook it. tools/build-levels.js cooks every par headlessly and writes the
// taste it produces into js/level-targets.js, so targets always match the current chemistry.

const LEVEL_TIERS = [
  { tier: 0, title: 'Pizza Shop Employee', judges: ['biscuit', 'pounce', 'joe'] },
  { tier: 1, title: 'First Michelin Star', judges: ['nanny', 'tier1a', 'tier1b'] },
  { tier: 2, title: 'Coming soon', locked: true },
  { tier: 3, title: 'Coming soon', locked: true },
];

const LEVELS = [
  // ---- Tier 0: each dish teaches one mechanic ----
  {
    id: 'tomato-soup', tier: 0, title: 'Tomato Soup', teaches: 'heat and seasoning',
    blurb: 'Soften the onion and garlic, melt the tomatoes down, season, and finish with fresh herbs.',
    hint: 'Herbs go in at the very end, off the heat.',
    ingredients: ['oil', 'onion', 'garlic', 'tomato', 'water', 'salt', 'herbs'],
    techniques: ['sweat', 'tomato', 'dissolve'],
    avoid: ['herbloss'],
    forbid: ['burnt', 'raw'],
    par: ['pour oil 1s', 'add onion 4', 'add garlic 2', 'heat 5', 'wait 40s', 'add tomato 12', 'wait 40s', 'pour water 5s',
          'pour salt 1s', 'wait 60s', 'stir 3s', 'heat 0', 'add herbs 2', 'wait 5s', 'serve'],
    mistakes: [
      { name: 'no salt', remove: ['pour salt 1s'] },
      { name: 'herbs boiled', remove: ['add herbs 2'], insertAfter: { 'pour water 5s': ['add herbs 2'] } },
      { name: 'scorched', replace: { 'heat 5': 'heat 9', 'wait 40s': 'wait 100s' } },
    ],
  },
  {
    id: 'creamy-corn', tier: 0, title: 'Creamy Corn Soup', teaches: 'thickening and gentle dairy',
    blurb: 'Simmer potato until it falls apart and thickens the soup, then stir in milk over low heat.',
    hint: 'Milk splits if the pot is boiling hard. Turn the flame down first.',
    ingredients: ['oil', 'onion', 'potato', 'corn', 'water', 'salt', 'milk'],
    techniques: ['sweat', 'thicken'],
    forbid: ['curdled', 'raw'],
    par: ['pour oil 1s', 'add onion 4', 'heat 5', 'wait 40s', 'add potato 6', 'add corn 8', 'pour water 8s', 'pour salt 1s',
          'heat 6', 'wait 150s', 'stir 4s', 'heat 2', 'wait 20s', 'pour milk 3s +stir', 'wait 20s', 'serve'],
    mistakes: [
      { name: 'rushed potato', replace: { 'wait 150s': 'wait 40s' } },
      { name: 'no milk', remove: ['pour milk 3s +stir'] },
    ],
  },
  {
    id: 'flatbread', tier: 0, title: 'Pan Flatbread', teaches: 'dough and browning',
    blurb: 'Stir flour, water and a pinch of salt into a dough, then bake it under the lid until golden.',
    hint: 'The lid turns the pot into an oven.',
    ingredients: ['oil', 'flour', 'water', 'salt'],
    techniques: ['dough', 'baked', 'crust'],
    forbid: ['burnt'],
    par: ['pour oil 0.2s', 'pour flour 2s', 'pour water 0.6s', 'pour salt 0.08s', 'stir 5s', 'heat 6', 'lid on', 'wait 45s', 'lid off', 'serve'],
    mistakes: [
      { name: 'burnt', replace: { 'heat 6': 'heat 9', 'wait 45s': 'wait 90s' } },
      { name: 'underbaked', replace: { 'wait 45s': 'wait 12s' } },
    ],
  },
  {
    id: 'fish-stew', tier: 0, title: 'Fish Stew', teaches: 'layering and timing',
    blurb: 'Build a tomato and wine base, simmer the potatoes, then add the fish late so it just flakes.',
    hint: 'Fish needs a minute, not an hour.',
    ingredients: ['oil', 'onion', 'garlic', 'wine', 'tomato', 'potato', 'water', 'salt', 'fish', 'herbs'],
    techniques: ['sweat', 'tomato', 'flake'],
    forbid: ['burnt', 'raw'],
    par: ['pour oil 1s', 'add onion 4', 'add garlic 2', 'heat 5', 'wait 40s', 'pour wine 1.5s', 'wait 15s', 'add tomato 8',
          'add potato 4', 'wait 20s', 'pour water 9s', 'pour salt 1.2s', 'wait 90s', 'throw fish 1', 'heat 4', 'wait 60s',
          'heat 0', 'add herbs 2', 'serve'],
    mistakes: [
      { name: 'no base', steps: ['pour water 9s', 'add potato 4', 'heat 5', 'pour salt 1.2s', 'wait 90s', 'throw fish 1', 'heat 4', 'wait 60s', 'serve'] },
      { name: 'fish raw', replace: { 'wait 60s': 'wait 5s' } },
    ],
  },
  {
    id: 'minestrone', tier: 0, title: 'Minestrone', teaches: 'timing many ingredients',
    blurb: 'Soften the vegetables, build the tomato broth, then add beans and pasta so everything finishes together.',
    hint: 'Pasta goes in near the end. Too long and it turns to mush.',
    ingredients: ['oil', 'onion', 'carrot', 'celery', 'garlic', 'tomato', 'beans', 'potato', 'water', 'salt', 'pasta', 'herbs'],
    techniques: ['mirepoix', 'tomato'],
    forbid: ['mushy', 'raw', 'burnt'],
    par: ['pour oil 1.5s', 'add onion 3', 'add carrot 3', 'add celery 3', 'heat 5', 'wait 50s', 'add garlic 2', 'wait 10s',
          'add tomato 8', 'wait 30s', 'add beans 2', 'add potato 3', 'pour water 10s', 'pour salt 1.3s', 'heat 6', 'wait 60s',
          'add pasta 2', 'wait 45s', 'heat 0', 'add herbs 2', 'serve'],
    mistakes: [
      { name: 'pasta too early', remove: ['add pasta 2'], insertAfter: { 'add beans 2': ['add pasta 2'] }, replace: { 'wait 45s': 'wait 90s' } },
      { name: 'pasta raw', replace: { 'wait 45s': 'wait 8s' } },
    ],
  },

  // ---- Tier 1: combining the mechanics ----
  {
    id: 'french-onion', tier: 1, title: 'French Onion Soup', teaches: 'patience',
    blurb: 'Caramelize a mountain of onions low and slow, deglaze with wine, and simmer into a deep broth.',
    hint: 'The onions take longer than you think. Much longer.',
    ingredients: ['oil', 'onion', 'wine', 'water', 'salt', 'herbs'],
    techniques: ['caramelize', 'deglaze'],
    forbid: ['burnt'],
    par: ['pour oil 1.5s', 'add onion 10', 'heat 5', 'wait 120s', 'stir 2s', 'wait 60s', 'pour wine 1.5s', 'wait 5s', 'pour water 8s',
          'pour salt 1s', 'heat 4', 'wait 60s', 'add herbs 1', 'wait 5s', 'serve'],
    mistakes: [
      { name: 'rushed onions', replace: { 'wait 120s': 'wait 10s', 'wait 60s': 'wait 5s' } },
      { name: 'boiled onions', steps: ['pour water 8s', 'add onion 10', 'heat 7', 'wait 180s', 'pour salt 1s', 'stir 3s', 'serve'] },
    ],
  },
  {
    id: 'beef-chowder', tier: 1, title: 'Beef Chowder', teaches: 'roux, starch and dairy together',
    blurb: 'Sear the beef, sweat the vegetables, make a roux in the fat, add potatoes, and finish with milk.',
    hint: 'Flour into hot fat, not into water.',
    ingredients: ['oil', 'meat', 'onion', 'carrot', 'celery', 'flour', 'water', 'potato', 'milk', 'salt'],
    techniques: ['fond', 'roux', 'thicken'],
    forbid: ['curdled', 'lumps', 'burnt'],
    par: ['pour oil 1.5s', 'add meat 5', 'heat 7', 'wait 40s', 'add onion 3', 'add carrot 3', 'add celery 3', 'heat 5', 'wait 40s',
          'pour flour 1.6s', 'stir 3s', 'wait 15s', 'pour water 6s +stir', 'add potato 5', 'heat 5', 'wait 120s', 'heat 3',
          'pour milk 4s +stir', 'pour salt 1s', 'wait 30s', 'serve'],
    mistakes: [
      { name: 'flour in water', remove: ['pour flour 1.6s', 'stir 3s'], insertAfter: { 'pour water 6s +stir': ['pour flour 1.6s'] } },
      { name: 'milk at a boil', replace: { 'heat 3': 'heat 8' } },
    ],
  },
  {
    id: 'goulash', tier: 1, title: 'Goulash', teaches: 'browning and blooming spice',
    blurb: 'Slow-cook the onions, brown the beef, bloom the spices in the fat, then simmer with tomato.',
    hint: 'Spices wake up in hot fat, not in water.',
    ingredients: ['oil', 'onion', 'meat', 'chili', 'cumin', 'tomato', 'water', 'salt'],
    techniques: ['caramelize', 'fond', 'bloom'],
    forbid: ['burnt'],
    par: ['pour oil 1.5s', 'add onion 8', 'heat 5', 'wait 120s', 'add meat 6', 'heat 7', 'wait 40s', 'heat 5', 'wait 12s',
          'pour chili 0.4s', 'pour cumin 0.3s', 'stir 2s', 'wait 6s', 'add tomato 6', 'pour water 9s', 'pour salt 1s', 'heat 4',
          'wait 150s', 'serve'],
    mistakes: [
      { name: 'spices in water', remove: ['pour chili 0.4s', 'pour cumin 0.3s'], insertAfter: { 'pour water 9s': ['pour chili 0.4s', 'pour cumin 0.3s'] } },
      { name: 'boiled beef', steps: ['pour water 9s', 'add meat 6', 'add onion 8', 'heat 5', 'pour chili 0.4s', 'pour cumin 0.3s', 'add tomato 6', 'pour salt 1s', 'wait 200s', 'serve'] },
    ],
  },
  {
    id: 'sponge-cake', tier: 1, title: 'Pot-Oven Sponge Cake', teaches: 'baking chemistry',
    blurb: 'Whisk a sweet batter with eggs and baking powder and bake it under the lid until it rises.',
    hint: 'Baking powder makes it rise. A gentle flame keeps it from burning.',
    ingredients: ['flour', 'sugar', 'egg', 'milk', 'oil', 'powder'],
    techniques: ['batter', 'rise', 'baked', 'potoven'],
    forbid: ['burnt', 'shell'],
    par: ['pour flour 1.5s', 'pour sugar 1.2s', 'crack egg 2', 'pour milk 0.6s', 'pour oil 0.3s', 'pour powder 0.1s', 'stir 6s',
          'lid on', 'heat 5', 'wait 80s', 'lid off', 'serve'],
    mistakes: [
      { name: 'no baking powder', remove: ['pour powder 0.1s'] },
      { name: 'no lid', remove: ['lid on', 'lid off'] },
    ],
  },
  {
    id: 'chili', tier: 1, title: 'Chili con Carne', teaches: 'heat, spice and a long simmer',
    blurb: 'Brown the beef, soften onion and garlic, bloom chili and cumin, then simmer with tomato and beans.',
    hint: 'Bloom the spices in the fat before any liquid goes in.',
    ingredients: ['oil', 'meat', 'onion', 'garlic', 'chili', 'cumin', 'tomato', 'beans', 'water', 'salt'],
    techniques: ['fond', 'bloom', 'tomato'],
    forbid: ['burnt'],
    par: ['pour oil 1.5s', 'add meat 8', 'heat 7', 'wait 50s', 'add onion 4', 'add garlic 2', 'heat 5', 'wait 30s', 'pour chili 0.6s',
          'pour cumin 0.5s', 'stir 2s', 'wait 8s', 'add tomato 10', 'add beans 2', 'pour water 5s', 'pour salt 1.2s', 'heat 4',
          'wait 150s', 'serve'],
    mistakes: [
      { name: 'too much chili', replace: { 'pour chili 0.6s': 'pour chili 2.5s' } },
      { name: 'all in the water', steps: ['pour water 5s', 'add meat 8', 'add onion 4', 'add garlic 2', 'heat 5', 'pour chili 0.6s', 'pour cumin 0.5s', 'add tomato 10', 'add beans 2', 'pour salt 1.2s', 'heat 4', 'wait 200s', 'serve'] },
    ],
  },
];

// ---------- Scoring ----------
const LEVEL_AXES = ['salty', 'sweet', 'sour', 'bitter', 'umami', 'rich', 'heat', 'aroma', 'body'];
const LEVEL_WEIGHTS = { match: 0.35, technique: 0.25, ingredients: 0.15, judges: 0.25 };
const LEVEL_STARS = [0.55, 0.72, 0.85];   // 1, 2, 3 stars
const FLAW_NAMES = { burnt: 'burnt', curdled: 'split dairy', lumps: 'lumps', scrambled: 'scrambled egg', raw: 'undercooked',
                     gritty: 'undissolved seasoning', greasy: 'greasy', shell: 'eggshell', chemical: 'extinguisher powder', mushy: 'mushy pasta' };

const Levels = {
  // a: Taste.analyzeBowl(); happened/used: Sets from the pot; judgeAvg: the judges' mean score (1–10).
  score(level, a, happened, used, judgeAvg) {
    const target = (typeof LEVEL_TARGETS !== 'undefined' && LEVEL_TARGETS[level.id]) || null;
    const notes = [];

    // How close the taste is to the recipe. Axes the dish is about count more; small differences are free.
    let match = 1;
    if (target && !a.empty) {
      let sw = 0, se = 0, worst = null;
      for (const ax of LEVEL_AXES) {
        const want = target.taste[ax], got = a.p[ax] || 0, w = 1 + 2 * want;
        const err = Math.max(0, Math.abs(got - want) - 0.08);
        sw += w; se += w * err;
        if (!worst || w * err > worst.e) worst = { ax, e: w * err, d: got - want };
      }
      match = Math.max(0, Math.min(1, 1 - se / sw / 0.22));
      if (worst && worst.e > 0.05) notes.push(`It was ${worst.d < 0 ? 'less' : 'more'} ${AXIS_WORDS[worst.ax] || worst.ax} than the recipe.`);
    } else if (a.empty) match = 0;

    const disc = (t) => DISCOVERIES.find((x) => x.id === t) || { name: t };
    const missing = level.techniques.filter((t) => !happened.has(t));
    const slipped = (level.avoid || []).filter((t) => happened.has(t));
    const technique = Math.max(0, (level.techniques.length - missing.length - slipped.length) / level.techniques.length);
    for (const t of missing) notes.push(`Missing: ${disc(t).name}.${disc(t).hint ? ' ' + disc(t).hint : ''}`);
    for (const t of slipped) notes.push(`Oops: ${disc(t).name}. ${disc(t).desc || ''}`);
    const iHave = level.ingredients.filter((i) => used.has(i));
    const ingredients = iHave.length / level.ingredients.length;
    const missingIng = level.ingredients.filter((i) => !used.has(i));
    if (missingIng.length) notes.push('The recipe also calls for ' + missingIng.map((i) => (SHELF.find((s) => s.id === i) || { name: i }).name.toLowerCase()).join(', ') + '.');

    const judges = Math.max(0, Math.min(1, (judgeAvg - 3) / 5));
    const total = LEVEL_WEIGHTS.match * match + LEVEL_WEIGHTS.technique * technique +
                  LEVEL_WEIGHTS.ingredients * ingredients + LEVEL_WEIGHTS.judges * judges;
    let stars = LEVEL_STARS.filter((s) => total >= s).length;
    // Three stars means you cooked the recipe as written: every ingredient and technique, none of the slips.
    if (missing.length || slipped.length || missingIng.length) stars = Math.min(stars, 2);
    // A forbidden flaw caps the dish at one star, however good the rest is.
    const broke = level.forbid.filter((f) => (a.flaws[f] || 0) > 0.3);
    if (broke.length) { stars = Math.min(stars, 1); notes.unshift('The judges can\'t forgive: ' + broke.map((f) => FLAW_NAMES[f] || f).join(', ') + '.'); }
    return { total, stars, match, technique, ingredients, judges, broke, missing, slipped, notes };
  },
};

const AXIS_WORDS = { salty: 'salty', sweet: 'sweet', sour: 'tart', bitter: 'bitter', umami: 'savory', rich: 'rich',
                     heat: 'spicy', aroma: 'aromatic', body: 'thick' };
