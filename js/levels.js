// Career mode: each level is a recipe the judges know. A cooked dish is scored on how closely it matches
// the recipe (taste, techniques, ingredients) and on how much the judges like it.
//
// `par` is the reference way to cook it. tools/build-levels.js cooks every par headlessly and writes the
// taste it produces into js/level-targets.js, so targets always match the current chemistry.

const LEVEL_TIERS = [
  { tier: 0, title: 'Pizza Shop', judges: ['biscuit', 'pounce', 'joe'] },
  { tier: 1, title: 'First Michelin Star', judges: ['gordo', 'paul', 'pounce'] },
  { tier: 2, title: 'Second Michelin Star', judges: ['dudeguy', 'signore', 'seonbae'] },
  { tier: 3, title: 'Third Michelin Star', judges: ['monsieur', 'marty', 'obama'] },
  { tier: 4, title: 'The Deal', judges: ['ram'], final: true },
];

// The shelf grows with the story: a tier's kitchen has every ingredient its dishes, and the tiers before it, need
// (plus water and the fire extinguisher). The finale and the sandbox have everything.

// On the shelf from the very start, whatever the tier. (Baking powder, baking soda and yeast come with The Deal.)
const SHELF_ALWAYS = ['water', 'extinguisher', 'vinegar', 'sugar', 'chili', 'pepper'];

const LEVELS = [
  // ---- Pizza Shop ----
  {
    id: 'tomato-soup', short: 'Tomato Soup', tier: 0, title: 'Tomato Soup', teaches: 'heat and seasoning',
    blurb: 'Soften the onion and garlic, melt the tomatoes down, and season it well.',
    hint: 'Taste as you go. Salt is what makes the tomato sing.',
    essential: ['tomato'],   // without these it isn't the dish at all
    ingredients: ['oil', 'onion', 'garlic', 'tomato', 'water', 'salt'],
    techniques: ['sweat', 'tomato', 'dissolve'],
    forbid: ['burnt', 'raw'],
    par: ['pour oil 1s', 'add onion 4', 'add garlic 2', 'heat 5', 'wait 40s', 'add tomato 12', 'wait 40s', 'pour water 5s',
          'pour salt 1s', 'wait 60s', 'stir 3s', 'heat 0', 'wait 5s', 'serve'],
    mistakes: [
      { name: 'no salt', remove: ['pour salt 1s'] },
      { name: 'scorched', replace: { 'heat 5': 'heat 9', 'wait 40s': 'wait 150s' } },
    ],
    // Known flourishes (a perfect 10 needs one every judge loves). build-levels.js reports their scores.
    flourishes: [
      { name: 'fresh herbs', insertAfter: { 'heat 0': ['add herbs 2'] } },
    ],
  },
  {
    id: 'french-onion', short: 'French Onion', tier: 0, title: 'French Onion Soup', teaches: 'patience',
    blurb: 'Caramelize a mountain of onions low and slow, deglaze with wine, simmer into a deep broth, and melt cheese over the top.',
    hint: 'The onions take longer than you think. Much longer.',
    essential: ['onion'],   // without these it isn't the dish at all
    ingredients: ['oil', 'onion', 'wine', 'water', 'salt', 'cheese'],
    techniques: ['caramelize', 'deglaze', 'melt'],
    forbid: ['burnt'],
    par: ['pour oil 1.5s', 'add onion 10', 'heat 5', 'wait 120s', 'stir 2s', 'wait 60s', 'pour wine 1.5s', 'wait 5s', 'pour water 8s',
          'pour salt 1s', 'heat 4', 'wait 60s', 'add cheese 1', 'wait 20s', 'serve'],
    mistakes: [
      { name: 'rushed onions', replace: { 'wait 120s': 'wait 10s', 'wait 60s': 'wait 5s' } },
      { name: 'boiled onions', steps: ['pour water 8s', 'add onion 10', 'heat 7', 'wait 180s', 'pour salt 1s', 'stir 3s', 'serve'] },
    ],
  },
  {
    id: 'fish-stew', short: 'Fish Stew', tier: 0, title: 'Fish Stew', teaches: 'layering and timing',
    blurb: 'Simmer onion in white wine, add potatoes and water, then poach the fish late so it just flakes. Finish with fresh herbs.',
    hint: 'Fish needs a minute, not an hour.',
    essential: ['fish'],   // without these it isn't the dish at all
    ingredients: ['onion', 'wine', 'potato', 'water', 'salt', 'fish', 'herbs'],
    techniques: ['flake'],
    forbid: ['burnt', 'raw'],
    par: ['pour wine 1.5s', 'add onion 4', 'heat 5', 'wait 30s', 'add potato 4', 'pour water 9s', 'pour salt 1.2s', 'heat 6', 'wait 90s',
          'throw fish 1', 'heat 4', 'wait 60s', 'heat 0', 'add herbs 2', 'serve'],
    mistakes: [
      { name: 'no fish', remove: ['throw fish 1'] },
      { name: 'fish raw', replace: { 'wait 60s': 'wait 5s' } },
    ],
  },

  // ---- First Michelin Star ----
  {
    id: 'creamy-corn', short: 'Creamy Corn', tier: 1, title: 'Creamy Corn Soup', teaches: 'thickening and gentle dairy',
    blurb: 'Sweat onion, add corn and potato, and simmer until the potato falls apart and thickens the soup. Then stir in cream over low heat.',
    hint: 'Cream splits if the pot is boiling hard. Turn the flame down first.',
    essential: ['corn'],   // without these it isn't the dish at all
    ingredients: ['oil', 'onion', 'potato', 'corn', 'water', 'salt', 'cream'],
    techniques: ['sweat', 'thicken'],
    forbid: ['curdled', 'raw'],
    par: ['pour oil 1s', 'add onion 4', 'heat 5', 'wait 40s', 'add potato 6', 'add corn 8', 'pour water 8s', 'pour salt 1s',
          'heat 6', 'wait 150s', 'stir 4s', 'heat 2', 'wait 20s', 'pour cream 3s +stir', 'wait 20s', 'serve'],
    mistakes: [
      { name: 'rushed potato', replace: { 'wait 150s': 'wait 40s' } },
      { name: 'no cream', remove: ['pour cream 3s +stir'] },
    ],
  },
  {
    id: 'chicken-noodle', short: 'Chicken Noodle', tier: 1, title: 'Chicken Noodle Soup', teaches: 'poaching and timing pasta',
    blurb: 'Sweat the onion, carrot and celery, poach the chicken in the broth, then add the pasta at the end.',
    hint: 'The chicken needs time to cook through. The pasta needs very little.',
    essential: ['chicken', 'pasta'],
    ingredients: ['oil', 'onion', 'carrot', 'celery', 'chicken', 'water', 'salt', 'pasta', 'herbs'],
    techniques: ['mirepoix'],
    forbid: ['mushy', 'raw', 'burnt'],
    par: ['pour oil 1.5s', 'add onion 3', 'add carrot 3', 'add celery 3', 'heat 5', 'wait 50s', 'add chicken 5', 'pour water 10s',
          'pour salt 1.3s', 'heat 6', 'wait 120s', 'add pasta 2', 'wait 45s', 'heat 0', 'add herbs 2', 'serve'],
    mistakes: [
      { name: 'chicken raw', remove: ['add chicken 5'], insertAfter: { 'heat 0': ['add chicken 5'] } },
      { name: 'pasta too early', remove: ['add pasta 2'], insertAfter: { 'pour water 10s': ['add pasta 2'] } },
    ],
  },
  {
    id: 'clam-chowder', short: 'Clam Chowder', tier: 1, title: 'New England Clam Chowder', teaches: 'rendering fat into a roux',
    blurb: 'Render the salt pork, soften onion and celery in its fat, stir in flour for a roux, then simmer potatoes and clams and finish with cream.',
    hint: 'The pork gives you the fat for the roux. Cream goes in off the boil.',
    essential: ['clams', 'cream'],
    ingredients: ['clams', 'pork', 'onion', 'celery', 'potato', 'flour', 'cream', 'water', 'salt', 'pepper'],
    techniques: ['roux', 'thicken'],
    forbid: ['curdled', 'lumps', 'raw', 'burnt'],
    par: ['add pork 3', 'heat 7', 'wait 50s', 'add onion 3', 'add celery 3', 'heat 5', 'wait 40s', 'pour flour 1.2s', 'stir 3s', 'wait 15s',
          'pour water 7s +stir', 'add potato 5', 'add clams 2', 'heat 5', 'wait 100s', 'heat 3', 'pour cream 4s +stir', 'pour salt 0.8s',
          'pour pepper 0.2s', 'wait 30s', 'serve'],
    mistakes: [
      { name: 'flour in water', remove: ['pour flour 1.2s', 'stir 3s'], insertAfter: { 'pour water 7s +stir': ['pour flour 1.2s'] } },
      { name: 'cream at a boil', replace: { 'heat 3': 'heat 8' } },
    ],
  },

  // ---- Second Michelin Star ----
  {
    id: 'goulash', short: 'Goulash', tier: 2, title: 'Goulash', teaches: 'browning and blooming spice',
    blurb: 'Slow-cook the onions, brown the beef, bloom plenty of paprika and a little chili in the fat, then simmer with tomato.',
    hint: 'Spices wake up in hot fat, not in water.',
    essential: ['meat', 'paprika'],   // without these it isn't the dish at all
    ingredients: ['oil', 'onion', 'meat', 'paprika', 'chili', 'tomato', 'water', 'salt'],
    techniques: ['caramelize', 'fond', 'bloom'],
    forbid: ['burnt'],
    par: ['pour oil 1.5s', 'add onion 8', 'heat 5', 'wait 120s', 'add meat 6', 'heat 7', 'wait 40s', 'heat 5', 'wait 12s',
          'pour paprika 0.6s', 'pour chili 0.12s', 'stir 2s', 'wait 6s', 'add tomato 6', 'pour water 9s', 'pour salt 1s', 'heat 4',
          'wait 150s', 'serve'],
    mistakes: [
      { name: 'spices in water', remove: ['pour paprika 0.6s', 'pour chili 0.12s'], insertAfter: { 'pour water 9s': ['pour paprika 0.6s', 'pour chili 0.12s'] } },
      { name: 'boiled beef', steps: ['pour water 9s', 'add meat 6', 'add onion 8', 'heat 5', 'pour paprika 0.6s', 'pour chili 0.12s', 'add tomato 6', 'pour salt 1s', 'wait 200s', 'serve'] },
    ],
  },
  {
    id: 'avgolemono', short: 'Avgolemono', tier: 2, title: 'Avgolemono', teaches: 'tempering egg',
    blurb: 'Poach chicken in broth with a little pasta, then take it off the boil and stir in egg and lemon until it turns silky.',
    hint: 'Let it cool off the boil first. Too hot and the egg scrambles; stir as it goes in.',
    essential: ['egg', 'lemon', 'chicken'],
    ingredients: ['chicken', 'water', 'salt', 'pasta', 'egg', 'lemon', 'herbs'],
    techniques: ['liaison'],
    forbid: ['scrambled', 'raw', 'mushy'],
    par: ['add chicken 5', 'pour water 12s', 'pour salt 1.2s', 'heat 6', 'wait 120s', 'add pasta 2', 'wait 45s', 'heat 0', 'wait 10s',
          'crack egg 2', 'pour lemon 1s', 'stir 8s', 'add herbs 1', 'serve'],
    mistakes: [
      { name: 'egg at a boil', replace: { 'heat 0': 'heat 8', 'wait 10s': 'wait 2s' } },
      { name: 'no lemon', remove: ['pour lemon 1s'] },
    ],
  },
  {
    id: 'minestrone', short: 'Minestrone', tier: 2, title: 'Minestrone', teaches: 'timing many ingredients',
    blurb: 'Soften the vegetables, build the tomato broth, then add beans and pasta so everything finishes together.',
    hint: 'Pasta goes in near the end. Too long and it turns to mush.',
    essential: ['pasta', 'beans'],   // without these it isn't the dish at all
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

  // ---- Third Michelin Star ----
  {
    id: 'chili', short: 'Chili', tier: 3, title: 'Chili con Carne', teaches: 'heat, spice and a long simmer',
    blurb: 'Brown the beef, soften onion and garlic, bloom chili and cumin, then simmer with tomato and beans.',
    hint: 'Bloom the spices in the fat before any liquid goes in.',
    essential: ['meat', 'chili'],   // without these it isn't the dish at all
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
  {
    id: 'tonkotsu-ramen', short: 'Tonkotsu Ramen', tier: 3, title: 'Tonkotsu Ramen', teaches: 'a long, hard boil',
    blurb: 'Boil the pork hard and long until the broth turns rich and creamy white, season with garlic, ginger and soy, then cook the noodles in it and top with an egg.',
    hint: 'Tonkotsu means a hard, rolling boil (7 or higher) for a couple of minutes. The noodles go in at the end.',
    essential: ['pork', 'noodles'],
    ingredients: ['pork', 'water', 'garlic', 'ginger', 'soy', 'salt', 'noodles', 'egg', 'herbs'],
    techniques: ['boil', 'tonkotsu'],
    forbid: ['mushy', 'raw', 'burnt'],
    par: ['add pork 6', 'pour water 12s', 'heat 9', 'wait 200s', 'add garlic 2', 'add ginger 1', 'pour soy 1s', 'pour salt 0.6s', 'heat 6',
          'add noodles 2', 'wait 40s', 'crack egg 1', 'wait 25s', 'heat 0', 'add herbs 1', 'serve'],
    mistakes: [
      { name: 'short boil', replace: { 'wait 200s': 'wait 30s' } },
      { name: 'gentle simmer', replace: { 'heat 9': 'heat 5' } },
      { name: 'noodles too early', remove: ['add noodles 2'], insertAfter: { 'pour water 12s': ['add noodles 2'] } },
    ],
  },
  {
    id: 'marinara-meatballs', short: 'Meatballs', tier: 3, title: 'Marinara Pasta & Meatballs', teaches: 'cooking pasta in its sauce', sauce: true,
    blurb: 'Brown the pork, soften onion and garlic, melt in the tomatoes, then boil the noodles right in the sauce until it reduces and clings. Finish with cheese.',
    hint: 'No separate pot: the noodles cook in the sauce, and their starch thickens it.',
    essential: ['pork', 'noodles', 'tomato'],
    ingredients: ['oil', 'pork', 'onion', 'garlic', 'tomato', 'water', 'salt', 'noodles', 'herbs', 'cheese'],
    techniques: ['fond', 'tomato'],
    forbid: ['mushy', 'raw', 'burnt'],
    par: ['pour oil 1.5s', 'add pork 6', 'heat 7', 'wait 45s', 'add onion 3', 'add garlic 2', 'heat 5', 'wait 25s', 'add tomato 12',
          'wait 40s', 'pour water 5s', 'pour salt 1.2s', 'heat 7', 'add noodles 3', 'wait 55s', 'heat 0', 'add herbs 1', 'add cheese 1', 'wait 10s', 'serve'],
    mistakes: [
      { name: 'boiled pork', remove: ['add pork 6'], insertAfter: { 'pour water 5s': ['add pork 6'] } },
      { name: 'noodles raw', replace: { 'wait 55s': 'wait 8s' } },
    ],
  },
  {
    id: 'bouillabaisse', short: 'Bouillabaisse', tier: 3, title: 'Bouillabaisse', teaches: 'saffron and spice with fish',
    blurb: 'Soften onion and garlic, bloom saffron, paprika and a pinch of chili in the oil, build a tomato and wine broth with potatoes, and poach the fish at the end.',
    hint: 'A pinch of saffron goes a long way. Bloom it in the oil.',
    essential: ['fish', 'saffron'],
    ingredients: ['oil', 'onion', 'garlic', 'tomato', 'fish', 'wine', 'water', 'salt', 'herbs', 'saffron', 'chili', 'potato', 'paprika'],
    techniques: ['sweat', 'bloom', 'tomato', 'flake'],
    forbid: ['burnt', 'raw'],
    par: ['pour oil 1.2s', 'add onion 3', 'add garlic 2', 'heat 5', 'wait 40s', 'heat 6', 'pour saffron 0.1s', 'pour paprika 0.2s', 'pour chili 0.08s',
          'stir 2s', 'wait 8s', 'add tomato 6', 'pour wine 1s', 'add potato 4', 'pour water 9s', 'pour salt 1.2s', 'heat 6', 'wait 90s',
          'throw fish 1', 'heat 4', 'wait 60s', 'heat 0', 'add herbs 2', 'serve'],
    mistakes: [
      { name: 'no saffron', remove: ['pour saffron 0.1s'] },
      { name: 'spices in water', remove: ['pour saffron 0.1s', 'pour paprika 0.2s', 'pour chili 0.08s'], insertAfter: { 'pour water 9s': ['pour saffron 0.1s', 'pour paprika 0.2s', 'pour chili 0.08s'] } },
    ],
  },

  // ---- New recipes: one baked good per tier, revealed after The Deal ----
  {
    id: 'flatbread', short: 'Flatbread', tier: 0, bonus: true, title: 'Pan Flatbread', teaches: 'dough and browning',
    blurb: 'Stir flour, water and a pinch of salt into a dough, then bake it under the lid until golden.',
    hint: 'The lid turns the pot into an oven.',
    essential: ['flour'],   // without these it isn't the dish at all
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
    id: 'sponge-cake', short: 'Sponge Cake', tier: 1, bonus: true, title: 'Pot-Oven Sponge Cake', teaches: 'baking chemistry',
    blurb: 'Whisk a sweet batter with eggs and baking powder and bake it under the lid until it rises.',
    hint: 'Baking powder makes it rise. A gentle flame keeps it from burning.',
    essential: ['flour', 'egg', 'sugar'],   // without these it isn't the dish at all
    ingredients: ['flour', 'sugar', 'egg', 'cream', 'oil', 'powder'],
    techniques: ['batter', 'rise', 'baked', 'potoven'],
    forbid: ['burnt', 'shell'],
    par: ['pour flour 1.5s', 'pour sugar 1.2s', 'crack egg 2', 'pour cream 0.6s', 'pour oil 0.3s', 'pour powder 0.1s', 'stir 6s',
          'lid on', 'heat 5', 'wait 80s', 'lid off', 'serve'],
    mistakes: [
      { name: 'no baking powder', remove: ['pour powder 0.1s'] },
      { name: 'no lid', remove: ['lid on', 'lid off'] },
    ],
  },
  {
    id: 'focaccia', short: 'Focaccia', tier: 2, bonus: true, title: 'Focaccia', teaches: 'yeast and proofing',
    blurb: 'Mix flour, water, oil, salt and yeast into a dough, give it time to rise, then bake it under the lid with herbs.',
    hint: 'Yeast is slow. Let the dough proof in a warm pot before you turn up the heat.',
    essential: ['flour', 'yeast'],
    ingredients: ['flour', 'yeast', 'water', 'oil', 'salt', 'herbs'],
    techniques: ['dough', 'proof', 'baked', 'crust'],
    forbid: ['burnt'],
    par: ['pour oil 0.4s', 'pour flour 2s', 'pour water 0.7s', 'pour yeast 0.2s', 'pour salt 0.08s', 'stir 5s', 'heat 1', 'lid on',
          'wait 120s', 'add herbs 1', 'heat 6', 'wait 50s', 'lid off', 'serve'],
    mistakes: [
      { name: 'no proof', replace: { 'wait 120s': 'wait 2s' } },
      { name: 'no yeast', remove: ['pour yeast 0.2s'] },
    ],
  },
  {
    id: 'soda-bread', short: 'Soda Bread', tier: 3, bonus: true, title: 'Irish Soda Bread', teaches: 'soda and acid',
    blurb: 'Sour the cream with a splash of vinegar, mix it into flour with baking soda and salt, and bake it quickly under the lid.',
    hint: 'Baking soda needs acid to rise. On its own it just tastes soapy.',
    essential: ['flour', 'soda'],
    ingredients: ['flour', 'soda', 'cream', 'vinegar', 'salt'],
    techniques: ['dough', 'rise', 'baked', 'crust'],
    forbid: ['burnt', 'soapy'],
    par: ['pour cream 0.7s', 'pour vinegar 0.2s', 'pour flour 2s', 'pour soda 0.1s', 'pour salt 0.08s', 'stir 5s', 'lid on', 'heat 6',
          'wait 55s', 'lid off', 'serve'],
    mistakes: [
      { name: 'no acid', remove: ['pour vinegar 0.2s'] },
      { name: 'underbaked', replace: { 'wait 55s': 'wait 12s' } },
    ],
  },

  // ---- The Deal ----
  {
    id: 'primordial-soup', short: 'Primordial Soup', tier: 4, title: 'Primordial Soup', teaches: 'everything',
    blurb: 'The soup from before the beginning. Everything there is, in one pot. Something worthy of angels and demons.',
    hint: 'Everything. Every last thing. And hurry.',
    primordial: true, passAt: 8, limit: 300,   // about 1.1x the reference recipe: tight on purpose
    essential: [],
    ingredients: SHELF.map((s) => s.id),
    techniques: [],
    forbid: ['burnt'],
    par: ['pour oil 1.2s', 'add pork 2', 'add meat 2', 'add chicken 2', 'heat 7', 'wait 35s', 'add onion 2', 'add garlic 2', 'add ginger 1', 'add carrot 2',
          'add celery 2', 'heat 5', 'wait 25s', 'pour chili 0.4s', 'pour cumin 0.15s', 'pour pepper 0.15s', 'pour paprika 0.15s', 'pour saffron 0.15s', 'pour flour 0.4s', 'stir 3s',
          'wait 8s', 'add tomato 4', 'pour wine 0.8s', 'pour soy 0.5s', 'pour vinegar 0.35s', 'pour water 6s +stir', 'add potato 2', 'add corn 1',
          'add beans 1', 'add clams 1', 'pour salt 0.8s', 'pour sugar 0.15s', 'heat 6', 'wait 60s',
          'add pasta 1', 'add noodles 1', 'throw fish 1', 'crack egg 1', 'wait 35s', 'heat 2', 'wait 10s', 'pour cream 1s +stir', 'pour lemon 0.4s',
          'pour extinguisher 0.2s', 'heat 0', 'pour yeast 0.1s', 'pour powder 0.08s', 'pour soda 0.08s', 'stir 2s', 'add herbs 2', 'add cheese 1', 'serve'],
    mistakes: [
      { name: 'forgot the yeast', remove: ['pour yeast 0.1s'] },
      { name: 'no extinguisher', remove: ['pour extinguisher 0.2s'] },
    ],
  }

];

// ---------- Scoring ----------
// Each judge gives their own 0–10 by blending (weights in JUDGE_ROSTER[id].blend):
//   match   how close the taste is to the par recipe's
//   recipe  the recipe's techniques and ingredients (half each)
//   taste   their own taste, relative to how they scored the par recipe (capped at par)
// Cooking par flawlessly lands at 9. A flourish (an extra ingredient that makes the overall flavor better by the
// judges' taste: the panel's average taste rises FLOURISH_GAIN over par, and nobody likes it more than
// FLOURISH_SLACK less) adds 1 from every judge: par plus a flourish is a perfect 10.
// Caps: anything the recipe needs missing → below 8 (no badge); a forbidden flaw → below 6 (chopped).
const LEVEL_AXES = ['salty', 'sweet', 'sour', 'bitter', 'umami', 'rich', 'heat', 'aroma', 'body'];
const LEVEL_PASS = 6, LEVEL_GOOD = 8, LEVEL_PAR = 9, WRONG_DISH_MAX = 3;
// Within this much of the recipe on any taste axis is free (the taste card's green band); past it, points fall off
// gradually. (A judge's own palate counts for at most 30% of their score: see JUDGE_ROSTER blends.)
const LEVEL_FREE = 0.15, LEVEL_FALLOFF = 0.22;
const overIsFine = (level, ax) => ax === 'umami' || (level && level.sauce && ax === 'body');
const FLOURISH_GAIN = 0.15, FLOURISH_SLACK = 0.3;
const NOT_A_FLOURISH = new Set(['water', 'extinguisher']);
const FLAW_NAMES = { burnt: 'burnt', curdled: 'split dairy', lumps: 'lumps', scrambled: 'scrambled egg', raw: 'undercooked',
                     gritty: 'undissolved seasoning', greasy: 'greasy', shell: 'eggshell', chemical: 'extinguisher powder', mushy: 'mushy pasta' };

const Levels = {
  byId(id) { return LEVELS.find((l) => l.id === id); },

  // A tier's own dishes (the story path); bonus recipes don't count toward unlocking anything.
  main(tier) { return LEVELS.filter((l) => l.tier === tier && !l.bonus); },
  // Bonus recipes appear once The Deal is done.
  visible(l) { return !l.bonus || (typeof Progress !== 'undefined' && Progress.passed('primordial-soup')); },
  inTier(tier) { return LEVELS.filter((l) => l.tier === tier && this.visible(l)); },

  // What's on the shelf: everything the tiers you've opened need (plus water and the extinguisher), so going back
  // to an earlier dish you have all your newer ingredients to make it even better. The sandbox is the same. Once
  // The Deal is open, that's everything (its recipe needs all of it). null means no filter.
  shelf(level) {
    if (typeof Progress === 'undefined' || (level && LEVEL_TIERS[level.tier].final)) return null;
    let top = 0;
    while (top + 1 < LEVEL_TIERS.length && Progress.unlocked(top + 1)) top++;
    if (LEVEL_TIERS[top].final) return null;
    const ids = new Set(SHELF_ALWAYS);
    for (const l of LEVELS) if (l.tier <= top && !l.bonus) l.ingredients.forEach((i) => ids.add(i));
    return ids;
  },

  // Story time limit: the par recipe's own cooking time, plus half again and a minute, rounded up to 30 s
  // (or the level's own, for the finale).
  timeLimit(level) {
    if (level.limit) return level.limit;
    if (level._limit) return level._limit;
    let s = 0;
    for (const st of level.par) {
      const [cmd, a, b] = st.split(' ');
      if (cmd === 'wait' || cmd === 'stir') s += parseFloat(a);
      else if (cmd === 'pour') s += parseFloat(b) + 2;
      else if (cmd === 'add' || cmd === 'crack' || cmd === 'throw') s += parseInt(b, 10) * 0.15 + 2;
      else s += 1;
    }
    return (level._limit = Math.ceil((s * 1.5 + 60) / 30) * 30);
  },

  // Nothing in the pot: a zero from everyone.
  empty(ids) {
    return { total: 0, passed: false, badge: null, match: 0, technique: 0, ingredients: 0, recipe: 0,
             judges: ids.map((id) => ({ id, score: 0, flourish: false })), broke: [], missing: [], slipped: [], missingIng: [], extras: [],
             notes: ['Nothing was served. Cook something first!'] };
  },

  target(level) { return (level && typeof LEVEL_TARGETS !== 'undefined' && LEVEL_TARGETS[level.id]) || null; },

  // How close a taste is to the recipe's, 0..1, and the axis furthest off. Axes the dish is about count more;
  // differences within LEVEL_FREE cost nothing.
  match(level, p) {
    const target = this.target(level);
    if (!target) return { match: 1, worst: null };
    let sw = 0, se = 0, worst = null;
    for (const ax of LEVEL_AXES) {
      const want = target.taste[ax], got = p[ax] || 0, w = 1 + 2 * want;
      // Some axes only count one way: more savory than the recipe is never a fault, and a sauce (level.sauce) can't
      // be too thick. Only falling short on those costs anything.
      const err = got > want && overIsFine(level, ax) ? 0 : Math.max(0, Math.abs(got - want) - LEVEL_FREE);
      sw += w; se += w * err;
      if (!worst || w * err > worst.e) worst = { ax, e: w * err, d: got - want };
    }
    return { match: Math.max(0, Math.min(1, 1 - se / sw / LEVEL_FALLOFF)), worst: worst && worst.e > 0 ? worst : null };
  },

  // What the chef says tasting in a level: how it compares with the recipe (burnt and the like still come first).
  tasteLine(level, p) {
    if (p.bitter > 0.45) return 'Bitter... something burned.';
    const { worst } = this.match(level, p);
    if (!worst) return 'Just like the recipe!';
    const word = AXIS_WORDS[worst.ax] || worst.ax, more = AXIS_MORE[worst.ax] || 'more ' + word, big = worst.e > 0.15;
    return worst.d > 0 ? (big ? `Way too ${word} for this.` : `A little too ${word}.`) : (big ? `Needs to be much ${more}.` : `Could be a bit ${more}.`);
  },

  // a: Taste.analyzeBowl(); happened/used: Sets from the pot; ids: the panel; tastes: each judge's own score (evaluate).
  score(level, a, happened, used, ids, tastes) {
    if (level.primordial) return this.scorePrimordial(level, a, ids, tastes);
    const target = this.target(level);
    const notes = [];
    const name = (i) => (SHELF.find((s) => s.id === i) || { name: i }).name.toLowerCase();

    // How close the taste is to the recipe.
    let match = a.empty ? 0 : 1, gap = null;
    if (target && !a.empty) {
      const m = this.match(level, a.p), worst = m.worst;
      match = m.match;
      if (worst && worst.e > 0.05) { gap = { ax: worst.ax, d: worst.d }; notes.push(`It was ${worst.d < 0 ? 'less' : 'more'} ${AXIS_WORDS[worst.ax] || worst.ax} than the recipe.`); }
    }

    const disc = (t) => DISCOVERIES.find((x) => x.id === t) || { name: t };
    const missing = level.techniques.filter((t) => !happened.has(t));
    const slipped = (level.avoid || []).filter((t) => happened.has(t));
    const technique = Math.max(0, (level.techniques.length - missing.length - slipped.length) / level.techniques.length);
    for (const t of missing) notes.push(`Missing: ${disc(t).name}.${disc(t).hint ? ' ' + disc(t).hint : ''}`);
    for (const t of slipped) notes.push(`Oops: ${disc(t).name}. ${disc(t).desc || ''}`);
    const missingIng = level.ingredients.filter((i) => !used.has(i));
    const ingredients = 1 - missingIng.length / level.ingredients.length;
    if (missingIng.length) notes.push('The recipe also calls for ' + missingIng.map(name).join(', ') + '.');
    const recipe = 0.5 * technique + 0.5 * ingredients;

    // Not the dish at all: a defining ingredient missing, most of the recipe missing, or the wrong kind of dish
    // (a soup for a cake). The judges say so, and give at most a few points for whatever it tastes like.
    const missingEss = (level.essential || []).filter((i) => !used.has(i));
    const wrongKind = target && (target.type === 'baked') !== (a.type === 'baked');
    if (missingEss.length || ingredients < 0.5 || wrongKind) {
      const judges = ids.map((id, n) => ({ id, score: Math.round(Math.max(0, Math.min(1, tastes[n] / 8)) * WRONG_DISH_MAX * 10) / 10, flourish: false }));
      const total = Math.round(judges.reduce((s, j) => s + j.score, 0) / judges.length * 10) / 10;
      return { total, passed: false, badge: null, match, technique, ingredients, recipe, judges, broke: [], missing, slipped, missingIng, extras: [],
               gap: null, wrong: { missing: missingEss, kind: wrongKind }, notes: [`That isn't ${level.title.toLowerCase()}.`].concat(notes) };
    }
    const extras = [...used].filter((i) => !level.ingredients.includes(i) && !NOT_A_FLOURISH.has(i));

    // A flourish counts when the panel, by their own palates, finds the dish better than par overall (and nobody
    // finds it noticeably worse), and it's still the dish. Then every judge credits it.
    const parOf = (id) => Math.max(3, (target && target.judges && target.judges[id]) || 7);
    const gain = ids.reduce((s, id, n) => s + tastes[n] - parOf(id), 0) / ids.length;
    const flourish = extras.length > 0 && match >= 0.8 && !missing.length && gain >= FLOURISH_GAIN &&
                     ids.every((id, n) => tastes[n] >= parOf(id) - FLOURISH_SLACK);
    const judges = ids.map((id, n) => {
      const w = JUDGE_ROSTER[id].blend, rel = Math.max(0, Math.min(1, tastes[n] / parOf(id)));
      // A flourish's drift from par isn't held against you.
      return { id, score: LEVEL_PAR * (w.match * (flourish ? 1 : match) + w.recipe * recipe + w.taste * (flourish ? 1 : rel)) + (flourish ? 1 : 0), flourish };
    });
    const raw = judges.reduce((s, j) => s + j.score, 0) / judges.length;
    let total = raw;
    const broke = level.forbid.filter((f) => (a.flaws[f] || 0) > 0.3);
    if (missing.length || slipped.length || missingIng.length) total = Math.min(total, LEVEL_GOOD - 0.1);
    if (broke.length) { total = Math.min(total, LEVEL_PASS - 0.1); notes.unshift('The judges can\'t forgive: ' + broke.map((f) => FLAW_NAMES[f] || f).join(', ') + '.'); }
    // Keep each judge's card consistent with a capped total.
    if (total < raw) for (const j of judges) j.score *= total / raw;
    for (const j of judges) j.score = Math.max(0, Math.min(10, j.score));
    total = Math.round(total * 10) / 10;
    const perfect = judges.every((j) => j.score >= 9.95) && total >= 9.95;
    if (judges.some((j) => j.flourish)) {
      if (notes.length && notes[0].startsWith('It was')) notes.shift();   // the judges liked where it drifted
      notes.push('Flourish: ' + extras.map(name).join(', ') + '.');
    }
    return { total: perfect ? 10 : Math.min(total, 9.9), passed: total >= (level.passAt || LEVEL_PASS), badge: perfect ? 'perfect' : total >= LEVEL_GOOD ? 'good' : null,
             match, technique, ingredients, recipe, judges, broke, missing, slipped, missingIng, extras, gap, notes };
  },
};

// How much of an ingredient has to go in before it counts as in the soup (cells; a piece, egg or fish always counts).
const REGISTERS = { liquid: 30, powder: 8, spray: 15, chunk: 1, whole: 1 };
Levels.missingFromPot = function (ids) {
  const amt = (typeof Sim !== 'undefined' && Sim.usedAmt) || {};
  return ids.filter((id) => { const ing = SHELF.find((s) => s.id === id); return (amt[id] || 0) < (REGISTERS[ing.kind] || 1); });
};
// Primordial Soup: The Ram alone judges, on his own palate. Every ingredient has to be in it, enough to register;
// anything missing and he won't go above 5. It passes at 8. (The extinguisher is an ingredient here, not a crime.)
Levels.scorePrimordial = function (level, a, ids, tastes) {
  const missing = this.missingFromPot(level.ingredients), notes = [];
  let total = a.empty ? 0 : Math.max(0, Math.min(10, tastes[0]));
  if (missing.length) {
    total = Math.min(total, 5);
    notes.push('Not everything went in: ' + missing.map((i) => (SHELF.find((s) => s.id === i) || { name: i }).name.toLowerCase()).join(', ') + '.');
  }
  const broke = level.forbid.filter((f) => (a.flaws[f] || 0) > 0.3);
  if (broke.length) { total = Math.min(total, level.passAt - 0.1); notes.unshift('Burnt. Even in hell, that is unforgivable.'); }
  total = Math.round(total * 10) / 10;
  const perfect = total >= 9.95;
  return { total: perfect ? 10 : Math.min(total, 9.9), passed: total >= level.passAt, badge: perfect ? 'perfect' : total >= LEVEL_GOOD ? 'good' : null,
           match: 1, technique: 1, ingredients: 1 - missing.length / level.ingredients.length, recipe: 1,
           judges: ids.map((id) => ({ id, score: total, flourish: false })), broke, missing: [], slipped: [], missingIng: missing, extras: [], gap: null, notes };
};

const AXIS_MORE = { salty: 'saltier', sweet: 'sweeter', sour: 'more tart', bitter: 'more bitter', umami: 'more savory', rich: 'richer',
                    heat: 'spicier', aroma: 'more aromatic', body: 'thicker' };
const AXIS_WORDS = { salty: 'salty', sweet: 'sweet', sour: 'tart', bitter: 'bitter', umami: 'savory', rich: 'rich',
                     heat: 'spicy', aroma: 'aromatic', body: 'thick' };
