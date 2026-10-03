// Materials, flavor dimensions, and the ingredient shelf.

// ---- Screen / grid geometry (internal pixel resolution) ----
const W = 320, H = 240;
const GW = 152, GH = 88;      // simulation grid (pot interior)
const GX = 84, GY = 112;      // grid origin on screen

// ---- Flavor dimensions (per liquid cell) ----
const F_SALTY = 0, F_SWEET = 1, F_SOUR = 2, F_BITTER = 3, F_UMAMI = 4, F_RICH = 5,
      F_HEAT = 6, F_AROMA = 7, F_BODY = 8, F_RED = 9, F_BROWN = 10, F_WHITE = 11,
      F_ALCOHOL = 12, F_GOLD = 13,
      // Dough composition (only meaningful in dough/bread cells): water, egg, leavening, gluten, unreacted soda.
      F_WATER = 14, F_EGG = 15, F_LEAVEN = 16, F_GLUTEN = 17, F_SODA = 18;
const NF = 19;
const FLAVOR_KEYS = ['salty','sweet','sour','bitter','umami','rich','heat','aroma',
                     'body','red','brown','white','alcohol','gold','water','egg','leaven','gluten','soda'];

function flavorVec(obj) {
  const v = new Float32Array(NF);
  if (obj) for (const k in obj) v[FLAVOR_KEYS.indexOf(k)] = obj[k];
  return v;
}

// ---- Movement classes ----
const C_NONE = 0, C_LIQUID = 1, C_POWDER = 2, C_CHUNK = 3, C_GAS = 4, C_FIRE = 5, C_FOAM = 6;

// ---- Material IDs ----
const EMPTY = 0, BROTH = 1, OIL = 2, EGG = 3, SALT = 4, SUGAR = 5, FLOUR = 6, CHILI = 7,
      CUMIN = 8, SODA = 9, ONION = 10, GARLIC = 11, CARROT = 12, CELERY = 13, TOMATO = 14,
      MEAT = 15, HERB = 16, STEAM = 17, SMOKE = 18, FIRE = 19, FOAM = 20, ROUX = 21,
      LUMP = 22, CURD = 23, RIBBON = 24, SCRAMBLE = 25, BURNT = 26,
      YOLK = 27, WHITE_COOKED = 28, YOLK_COOKED = 29, SHELL = 30, FISH = 31, FISHFIN = 32, FISHEYE = 33,
      EXTPOWDER = 34, DOUGH = 35, BREAD = 36, BAKEPOWDER = 37;

// name, class, density, conductivity, base colors [raw, cooked/browned]
const MAT = [];
function defMat(id, o) { MAT[id] = Object.assign({ id, cls: C_NONE, dens: 0, cond: 0.02,
  col: [0,0,0], col2: null, leach: null, burnAt: 999 }, o); }

defMat(EMPTY,   { name: 'air', cond: 0.006 });   // air insulates: a pot's surface stays hot
defMat(BROTH,   { name: 'broth',  cls: C_LIQUID, dens: 1.0,  cond: 0.22, col: [96, 150, 205] });
defMat(OIL,     { name: 'oil',    cls: C_LIQUID, dens: 0.9,  cond: 0.16, col: [236, 196, 70] });
defMat(EGG,     { name: 'egg white', cls: C_CHUNK, dens: 1.03, cond: 0.14, col: [236, 236, 222], alpha: 190 });
defMat(SALT,    { name: 'salt',   cls: C_POWDER, dens: 1.6,  cond: 0.08, col: [240, 240, 246], solu: flavorVec({ salty: 19 }) });
defMat(SUGAR,   { name: 'sugar',  cls: C_POWDER, dens: 1.5,  cond: 0.08, col: [252, 246, 228], solu: flavorVec({ sweet: 20 }) });
defMat(FLOUR,   { name: 'flour',  cls: C_POWDER, dens: 1.3,  cond: 0.06, col: [236, 226, 204] });
defMat(CHILI,   { name: 'chili',  cls: C_POWDER, dens: 1.4,  cond: 0.08, col: [208, 44, 30], col2: [90, 30, 20], burnAt: 200,
                  solu: flavorVec({ heat: 18, aroma: 4, red: 3 }) });
defMat(CUMIN,   { name: 'cumin',  cls: C_POWDER, dens: 1.4,  cond: 0.08, col: [170, 116, 52], col2: [70, 44, 24], burnAt: 200,
                  solu: flavorVec({ aroma: 16, bitter: 0.6, brown: 2 }) });
defMat(SODA,    { name: 'baking soda', cls: C_POWDER, dens: 1.5, cond: 0.08, col: [226, 236, 244] });
defMat(ONION,   { brownRate: 0.2, name: 'onion',  cls: C_CHUNK, dens: 1.06, cond: 0.1, col: [244, 236, 214], col2: [150, 82, 30], burnAt: 200,
                  leach: flavorVec({ sweet: 0.012, aroma: 0.05 }), note: 'allium' });
defMat(GARLIC,  { name: 'garlic', cls: C_CHUNK, dens: 1.08, cond: 0.1, col: [250, 246, 230], col2: [196, 150, 70], burnAt: 165,
                  leach: flavorVec({ aroma: 0.15 }), note: 'allium' });
defMat(CARROT,  { name: 'carrot', cls: C_CHUNK, dens: 1.1, cond: 0.1, col: [244, 128, 32], col2: [176, 74, 22], burnAt: 210,
                  leach: flavorVec({ sweet: 0.017, gold: 0.05 }), note: 'earthy' });
defMat(CELERY,  { name: 'celery', cls: C_CHUNK, dens: 1.04, cond: 0.1, col: [150, 210, 90], col2: [110, 120, 50], burnAt: 210,
                  leach: flavorVec({ aroma: 0.02, salty: 0.01 }), note: 'herbal' });
defMat(TOMATO,  { name: 'tomato', cls: C_CHUNK, dens: 1.03, cond: 0.12, col: [228, 50, 44], col2: [180, 40, 30], burnAt: 190 });
defMat(MEAT,    { brownRate: 0.15, name: 'meat',   cls: C_CHUNK, dens: 1.15, cond: 0.1, col: [206, 84, 96], col2: [120, 66, 38], burnAt: 240,
                  leach: flavorVec({ umami: 0.04, rich: 0.012, brown: 0.04, aroma: 0.01 }), note: 'toasty' });
defMat(HERB,    { name: 'herbs',  cls: C_CHUNK, dens: 0.9, cond: 0.1, col: [70, 170, 70], col2: [90, 100, 50], burnAt: 170,
                  leach: flavorVec({ aroma: 0.25 }), note: 'herbal' });
defMat(STEAM,   { name: 'steam',  cls: C_GAS,  dens: 0,   cond: 0.05, col: [230, 240, 250] });
defMat(SMOKE,   { name: 'smoke',  cls: C_GAS,  dens: 0,   cond: 0.03, col: [90, 86, 90] });
defMat(FIRE,    { name: 'fire',   cls: C_FIRE, dens: 0,   cond: 0.2,  col: [255, 150, 30] });
defMat(FOAM,    { name: 'foam',   cls: C_FOAM, dens: 0.4, cond: 0.05, col: [244, 248, 236] });
defMat(ROUX,    { name: 'roux',   cls: C_CHUNK, dens: 1.1, cond: 0.1, col: [230, 200, 140], col2: [140, 80, 34], burnAt: 220 });
defMat(LUMP,    { name: 'flour lump', cls: C_CHUNK, dens: 1.08, cond: 0.06, col: [226, 218, 196] });
defMat(CURD,    { name: 'curd',   cls: C_POWDER, dens: 0.97, cond: 0.1, col: [250, 248, 236] });
defMat(RIBBON,  { name: 'egg ribbon', cls: C_POWDER, dens: 0.98, cond: 0.1, col: [255, 230, 120] });
defMat(SCRAMBLE,{ name: 'scrambled egg', cls: C_CHUNK, dens: 1.02, cond: 0.1, col: [246, 214, 90] });
defMat(BURNT,   { name: 'burnt bits', cls: C_POWDER, dens: 1.2, cond: 0.1, col: [36, 26, 22] });
// Whole eggs and fish. `stops` = color by cook level: raw → cooked → browned → charred.
defMat(YOLK,    { name: 'yolk', cls: C_CHUNK, dens: 1.04, cond: 0.14, col: [255, 186, 36] });
defMat(WHITE_COOKED, { name: 'cooked egg white', cls: C_CHUNK, dens: 1.02, cond: 0.12, col: [252, 252, 246], col2: [200, 150, 80], burnAt: 200 });
defMat(YOLK_COOKED,  { name: 'cooked yolk', cls: C_CHUNK, dens: 1.03, cond: 0.12, col: [250, 210, 96], col2: [190, 140, 60], burnAt: 200 });
defMat(SHELL,   { name: 'eggshell', cls: C_CHUNK, dens: 1.3, cond: 0.08, col: [238, 222, 192] });
defMat(FISH,    { brownRate: 0.15, name: 'fish', cls: C_CHUNK, dens: 1.05, cond: 0.12, col: [150, 172, 196], burnAt: 220,
                  stops: [[0, [150, 172, 196]], [110, [236, 230, 220]], [190, [196, 136, 70]], [255, [40, 28, 22]]],
                  leach: flavorVec({ umami: 0.07, rich: 0.05, aroma: 0.03 }), note: 'oceanic' });
defMat(FISHFIN, { brownRate: 0.15, name: 'fish fin', cls: C_CHUNK, dens: 1.05, cond: 0.12, col: [104, 126, 160], burnAt: 200,
                  stops: [[0, [104, 126, 160]], [110, [176, 172, 168]], [190, [150, 96, 46]], [255, [30, 22, 18]]] });
defMat(EXTPOWDER, { name: 'extinguisher powder', cls: C_POWDER, dens: 0.95, cond: 0.05, col: [246, 246, 250],
                    solu: flavorVec({ bitter: 1.5, salty: 0.3 }) });
// Dough: flour that has soaked up liquid. How it behaves depends on its water (F_WATER, per flour):
// crumbly < 0.35 < dough < 0.9 < sticky < 1.6 < batter < 4 (then it thins into the soup).
defMat(DOUGH,   { name: 'dough', cls: C_CHUNK, dens: 1.2, cond: 0.1, col: [240, 226, 196] });
// Baked: set dough. Color runs pale crumb → golden → brown crust → burnt with cook.
defMat(BREAD,   { name: 'baked dough', cls: C_CHUNK, dens: 0.9, cond: 0.08, col: [246, 230, 190], burnAt: 235, brownRate: 0.05,
                  stops: [[0, [246, 230, 190]], [100, [240, 220, 170]], [150, [222, 168, 96]], [195, [168, 100, 46]], [255, [52, 36, 26]]] });
defMat(BAKEPOWDER, { name: 'baking powder', cls: C_POWDER, dens: 1.4, cond: 0.08, col: [250, 250, 244] });
defMat(FISHEYE, { name: 'fish eye', cls: C_CHUNK, dens: 1.05, cond: 0.12, col: [24, 24, 34],
                  stops: [[0, [24, 24, 34]], [110, [230, 230, 220]], [255, [60, 50, 40]]] });

// What a solid tastes like when you bite it (before cooking adjustments in Taste.eatFlavor).
// Powders sitting on dry food are seasoning: a few grains spread over a plate.
const EAT = [];
EAT[ONION] = flavorVec({ sweet: 0.25, aroma: 0.3, umami: 0.05 });
EAT[GARLIC] = flavorVec({ aroma: 0.8, sweet: 0.05 });
EAT[CARROT] = flavorVec({ sweet: 0.3, aroma: 0.1 });
EAT[CELERY] = flavorVec({ aroma: 0.25, salty: 0.05 });
EAT[TOMATO] = flavorVec({ sour: 0.45, umami: 0.4, sweet: 0.2 });
EAT[MEAT] = flavorVec({ umami: 0.6, rich: 0.35, aroma: 0.15 });
EAT[FISH] = flavorVec({ umami: 0.6, rich: 0.35, aroma: 0.15 });
EAT[FISHFIN] = flavorVec({ umami: 0.3, rich: 0.15 });
EAT[HERB] = flavorVec({ aroma: 2.0 });   // fresh herbs are intensely aromatic per bite
EAT[EGG] = flavorVec({ rich: 0.25 });
EAT[YOLK] = flavorVec({ rich: 0.5 });
EAT[WHITE_COOKED] = flavorVec({ rich: 0.2, umami: 0.15 });
EAT[YOLK_COOKED] = flavorVec({ rich: 0.6, umami: 0.2 });
EAT[SCRAMBLE] = flavorVec({ rich: 0.35, umami: 0.15 });
EAT[RIBBON] = flavorVec({ rich: 0.25, umami: 0.1 });
EAT[ROUX] = flavorVec({ rich: 0.4, body: 0.3 });
EAT[LUMP] = flavorVec({ bitter: 0.2, body: 0.3 });
EAT[CURD] = flavorVec({ rich: 0.4, sour: 0.1 });
EAT[FLOUR] = flavorVec({ bitter: 0.1, body: 0.2 });
EAT[DOUGH] = flavorVec({ bitter: 0.12, body: 0.3 });        // raw dough: pasty, floury
EAT[BREAD] = flavorVec({ aroma: 0.15, sweet: 0.05, body: 0.3 });
EAT[BAKEPOWDER] = flavorVec({ bitter: 1.5, salty: 0.5 });
EAT[SODA] = flavorVec({ bitter: 2 });
EAT[EXTPOWDER] = flavorVec({ bitter: 3 });
for (const m of [SALT, SUGAR, CHILI, CUMIN]) EAT[m] = MAT[m].solu;   // a grain is just as salty dissolved or not

// Global aroma notes the pot can develop.
const NOTES = ['allium', 'toasty', 'caramel', 'herbal', 'earthy', 'spice', 'smoky', 'burnt', 'fermented', 'oceanic'];

// ---- Ingredient shelf ----
// kind: how it's poured. icon: which art routine draws it.
const SHELF = [
  { id: 'water',   name: 'Water',       kind: 'liquid', mat: BROTH, rate: 12, icon: 'jug',    c: [110, 170, 230] },
  { id: 'oil',     name: 'Oil',         kind: 'liquid', mat: OIL,   rate: 4, icon: 'bottle', c: [236, 196, 70] },
  { id: 'milk',    name: 'Milk',        kind: 'liquid', mat: BROTH, rate: 5, icon: 'carton', c: [246, 246, 250],
    flavor: flavorVec({ rich: 1.4, white: 3, sweet: 0.3, body: 0.3 }) },
  { id: 'wine',    name: 'Wine',        kind: 'liquid', mat: BROTH, rate: 4, icon: 'bottle', c: [150, 30, 60],
    flavor: flavorVec({ alcohol: 3, sour: 1.2, sweet: 0.4, red: 2, aroma: 1.5 }) },
  { id: 'vinegar', name: 'Vinegar',     kind: 'liquid', mat: BROTH, rate: 3, icon: 'bottle', c: [230, 220, 170],
    flavor: flavorVec({ sour: 5, aroma: 0.3 }) },
  { id: 'soy',     name: 'Soy Sauce',   kind: 'liquid', mat: BROTH, rate: 3, icon: 'bottle', c: [60, 30, 20],
    flavor: flavorVec({ salty: 6, umami: 3, brown: 4 }), note: 'fermented' },
  { id: 'salt',    name: 'Salt',        kind: 'powder', mat: SALT,  rate: 2, icon: 'shaker', c: [240, 240, 246] },
  { id: 'sugar',   name: 'Sugar',       kind: 'powder', mat: SUGAR, rate: 2, icon: 'bag',    c: [252, 246, 228] },
  { id: 'flour',   name: 'Flour',       kind: 'powder', mat: FLOUR, rate: 3, icon: 'bag',    c: [236, 226, 204] },
  { id: 'chili',   name: 'Chili Flakes',kind: 'powder', mat: CHILI, rate: 2, icon: 'jar',    c: [208, 44, 30] },
  { id: 'cumin',   name: 'Cumin',       kind: 'powder', mat: CUMIN, rate: 2, icon: 'jar',    c: [170, 116, 52] },
  { id: 'soda',    name: 'Baking Soda', kind: 'powder', mat: SODA,  rate: 3, icon: 'box',    c: [240, 120, 60] },
  { id: 'powder',  name: 'Baking Powder', kind: 'powder', mat: BAKEPOWDER, rate: 3, icon: 'box', c: [90, 140, 220] },
  { id: 'onion',   name: 'Onion',       kind: 'chunk',  mat: ONION, rate: 1, icon: 'onion',  c: [210, 160, 90] },
  { id: 'garlic',  name: 'Garlic',      kind: 'chunk',  mat: GARLIC,rate: 1, icon: 'garlic', c: [250, 246, 230] },
  { id: 'carrot',  name: 'Carrot',      kind: 'chunk',  mat: CARROT,rate: 1, icon: 'carrot', c: [244, 128, 32] },
  { id: 'celery',  name: 'Celery',      kind: 'chunk',  mat: CELERY,rate: 1, icon: 'celery', c: [150, 210, 90] },
  { id: 'tomato',  name: 'Tomato',      kind: 'chunk',  mat: TOMATO,rate: 1, icon: 'tomato', c: [228, 50, 44] },
  { id: 'meat',    name: 'Beef',        kind: 'chunk',  mat: MEAT,  rate: 1, icon: 'meat',   c: [206, 84, 96] },
  { id: 'egg',     name: 'Egg',         kind: 'whole',  mat: EGG,   rate: 1, icon: 'egg',    c: [250, 246, 236] },
  { id: 'fish',    name: 'Whole Fish',  kind: 'whole',  mat: FISH,  rate: 1, icon: 'fish',   c: [150, 172, 196] },
  { id: 'extinguisher', name: 'Fire Extinguisher', kind: 'spray', mat: EXTPOWDER, rate: 7, icon: 'extinguisher', c: [220, 40, 40] },
  { id: 'herbs',   name: 'Fresh Herbs', kind: 'chunk',  mat: HERB,  rate: 1, icon: 'herb',   c: [70, 170, 70] },
];

// ---- Discoveries (journal) ----
const DISCOVERIES = [
  { id: 'dissolve',   name: 'Seasoning',      hint: 'Some powders vanish into water…', desc: 'Salt and sugar dissolve, faster when it\'s hot. Stir or it stays patchy!' },
  { id: 'boil',       name: 'Rolling Boil',   hint: 'Turn it up.',                     desc: 'Water can\'t pass 100°C. Extra heat becomes steam: the soup reduces and concentrates.' },
  { id: 'sweat',      name: 'Sweating',       hint: 'Onions + fat + gentle heat',      desc: 'Aromatics soften and release sweetness in warm fat.' },
  { id: 'caramelize', name: 'Caramelization', hint: 'Patience with onions… no water.', desc: 'Browning only happens above 100°C, so never in water. Deep sweet, toasty flavor.' },
  { id: 'burn',       name: 'Burnt!',         hint: 'Too hot, too long.',              desc: 'Bitter, smoky, sad. Garlic burns fastest.' },
  { id: 'fond',       name: 'Fond',           hint: 'Meat on a hot, dry pot…',         desc: 'Seared meat leaves brown bits stuck to the pot. That\'s flavor.' },
  { id: 'deglaze',    name: 'Deglaze',        hint: 'What lifts what\'s stuck?',       desc: 'Liquid hitting fond dissolves it into a burst of savory flavor.' },
  { id: 'bloom',      name: 'Bloomed Spice',  hint: 'Spices love hot oil.',            desc: 'Spices toasted in fat smell 3x stronger. Heat travels in fat.' },
  { id: 'roux',       name: 'Roux',           hint: 'Flour behaves better with a friend.', desc: 'Flour cooked in fat thickens soup smoothly.' },
  { id: 'lumps',      name: 'Lumps',          hint: 'Flour straight into water?',      desc: 'Raw flour in hot liquid clumps. That\'s why roux exists.' },
  { id: 'mirepoix',   name: 'Mirepoix',       hint: 'Three humble vegetables, together.', desc: 'Onion, carrot, celery sweated together: the foundation of a thousand soups.' },
  { id: 'tomato',     name: 'Tomato Melt',    hint: 'Tomatoes in the heat…',           desc: 'Cooked tomato collapses into sweet, sour, savory sauce.' },
  { id: 'eggdrop',    name: 'Egg Ribbons',    hint: 'A thin stream into a swirl.',     desc: 'Egg drizzled into simmering, stirred broth makes silky ribbons.' },
  { id: 'scramble',   name: 'Scrambled',      hint: 'Same egg, different technique.',  desc: 'Dump egg into a still pot and it clumps.' },
  { id: 'curdle',     name: 'Curdled',        hint: 'Dairy and acid don\'t like heat.', desc: 'Milk + acid + heat splits into curds. Add acid last, keep it gentle.' },
  { id: 'fizz',       name: 'Volcano!',       hint: 'A white powder meets something sour.', desc: 'Baking soda + acid = foaming overflow.' },
  { id: 'flambe',     name: 'Flambé',         hint: 'Wine… and fire…',                 desc: 'Alcohol burns off in a sheet of flame, leaving mellow sweetness.' },
  { id: 'greasefire', name: 'Grease Fire',    hint: 'Oil has a limit.',                desc: 'Oil past its smoke point ignites. LID smothers it; water makes it WORSE.' },
  { id: 'splatter',   name: 'Splatter',       hint: 'Water into very hot oil.',        desc: 'Water flashes to steam under oil and spits everywhere.' },
  { id: 'thicken',    name: 'Thickened',      hint: 'Body comes from starch.',         desc: 'Roux dissolved in simmering liquid makes it thick and velvety.' },
  { id: 'crack',      name: 'Clean Crack',    hint: 'Eggs have a rim to meet.',        desc: 'Tap an egg on the pot rim, then drop it in: no shell in your soup.' },
  { id: 'splat',      name: 'Splat!',         hint: 'What if you just… throw it?',     desc: 'A whole egg thrown into a shallow pot smashes on the bottom. Shell and all.' },
  { id: 'hardboil',   name: 'Hard-Boiled',    hint: 'A soft landing, then a long bath.', desc: 'Thrown into deep water, an egg survives whole and cooks solid in its shell.' },
  { id: 'poached',    name: 'Poached Egg',    hint: 'Leave a cracked egg alone in a simmer.', desc: 'An unstirred egg in simmering broth sets as one silky piece.' },
  { id: 'friedegg',   name: 'Fried Egg',      hint: 'A cracked egg in hot oil.',       desc: 'Egg set in hot fat: crisp, browned edges.' },
  { id: 'flake',      name: 'Flaky Fish',     hint: 'Fish needs only a gentle poach.', desc: 'Poached fish turns opaque and falls apart into tender flakes.' },
  { id: 'crispyskin', name: 'Crispy Skin',    hint: 'Fish on a hot, dry pan.',          desc: 'Fish skin browns and crisps when it is seared without water.' },
  { id: 'extinguish', name: "Fire's Out!",    hint: 'Every kitchen needs a red cylinder.', desc: 'The extinguisher smothers and cools a fire. Your dish will taste of chemicals.' },
  { id: 'saturated',  name: 'Saturated',      hint: 'Can water hold endless salt?',     desc: 'Water can only dissolve so much. Past that, salt and sugar settle out as gritty sediment.' },
  { id: 'dough',      name: 'Dough!',         hint: 'Flour and a little liquid…',      desc: 'Flour soaks up liquid and holds together. More flour stiffens it, more liquid loosens it.' },
  { id: 'batter',     name: 'Batter',         hint: 'Dough, but much wetter.',          desc: 'With lots of liquid, dough becomes a pourable batter: pancakes, crêpes, cake.' },
  { id: 'knead',      name: 'Kneading',       hint: 'Work the dough.',                  desc: 'Stirring dough builds gluten: stretchy structure that traps gas and makes bread chewy.' },
  { id: 'rise',       name: 'It Rises!',      hint: 'Something in the dough makes gas.', desc: 'Baking powder (or soda + acid) releases gas in the heat. Strong dough holds it and puffs up.' },
  { id: 'baked',      name: 'Fresh Bake',     hint: 'Heat sets dough.',                 desc: 'Hot dough sets into a baked good. Underbaked middles stay gummy.' },
  { id: 'crust',      name: 'Golden Crust',   hint: 'Dry heat on the outside.',         desc: 'Dough baking against hot, dry metal browns into a crust.' },
  { id: 'potoven',    name: 'Pot Oven',       hint: 'Trap the heat around it.',         desc: 'With the lid on, the air in the pot gets hot: dough bakes from all sides, like a Dutch oven.' },
  { id: 'dumpling',   name: 'Dumplings',      hint: 'Dough in boiling water.',          desc: 'Dough cooked in simmering liquid sets soft and pale: dumplings.' },
  { id: 'soapy',      name: 'Soapy',          hint: 'Soda needs a partner.',            desc: 'Baking soda without any acid barely rises and tastes soapy. Add vinegar or sour milk.' },
  { id: 'herbloss',   name: 'Wilted Herbs',   hint: 'When should herbs go in?',        desc: 'Fresh herb aroma cooks away fast. Add them at the end.' },
];
