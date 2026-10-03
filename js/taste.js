// Turning raw grid chemistry into perceived taste, plus whole-bowl analysis for judging.

const TASTE_AXES = ['salty', 'sweet', 'sour', 'bitter', 'umami', 'rich', 'heat', 'aroma', 'body'];
// Raw concentration at which an axis reads as "maxed out" (perceived 1.0).
const NORM = { salty: 1.0, sweet: 0.9, sour: 0.8, bitter: 0.4, umami: 0.9, rich: 0.8, heat: 0.9, aroma: 1.2, body: 1.2 };
// What a generally-delicious soup looks like: [ideal, tolerance].
const IDEAL = { salty: [0.5, 0.15], sweet: [0.25, 0.2], sour: [0.2, 0.15], bitter: [0, 0.12], umami: [0.65, 0.25],
                rich: [0.4, 0.25], heat: [0.2, 0.25], aroma: [0.55, 0.3], body: [0.35, 0.3] };

const Taste = {};

// Average raw flavor over liquid cells in a region (r=0 means whole pot).
Taste.gather = function (cx, cy, r) {
  const S = Sim, raw = new Float32Array(NF);
  let broth = 0, oil = 0, oilHeat = 0, temp = 0;
  const y0 = r ? Math.max(0, cy - r) : 0, y1 = r ? Math.min(GH - 1, cy + r) : GH - 1;
  const x0 = r ? Math.max(0, cx - r) : 0, x1 = r ? Math.min(GW - 1, cx + r) : GW - 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (r && (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
    const i = y * GW + x, m = S.mat[i], o = i * NF;
    if (m === BROTH) {
      broth++; temp += S.temp[i];
      for (let k = 0; k < NF; k++) raw[k] += S.fl[o + k];
    } else if (m === OIL) {
      oil++; oilHeat += S.fl[o + F_HEAT]; temp += S.temp[i];
      raw[F_AROMA] += S.fl[o + F_AROMA] * 0.5;
    }
  }
  const n = Math.max(1, broth);
  for (let k = 0; k < NF; k++) raw[k] /= n;
  return { raw, broth, oil, oilHeat: oilHeat / Math.max(1, broth + oil), temp: temp / Math.max(1, broth + oil) };
};

// Apply perception rules (salt suppresses bitter, fat carries heat, acid brightens…).
Taste.perceive = function (g, burntFrac = 0, plate = false) {
  const r = g.raw, oilFrac = g.oil / Math.max(1, g.broth + g.oil) * (plate ? 0.4 : 1);   // pan oil on a plate is mostly left behind
  // Linear up to 0.8, then a soft ceiling: stronger is still a bit stronger, never past 1.
  const n = (k, v) => { const x = Math.max(0, v / NORM[k]); return x <= 0.8 ? x : 0.8 + 0.2 * (1 - Math.exp(-(x - 0.8) / 0.2)); };
  const salty = n('salty', r[F_SALTY]);
  const sour = n('sour', r[F_SOUR]);
  const p = {
    salty,
    sweet: n('sweet', r[F_SWEET] * (1 + salty * 0.3)),
    sour: n('sour', r[F_SOUR] - r[F_SWEET] * 0.15),
    bitter: n('bitter', Math.max(0, r[F_BITTER] - salty * 0.15) + burntFrac * 12),
    umami: n('umami', r[F_UMAMI] * (1 + salty * 0.5)),
    rich: n('rich', r[F_RICH] + oilFrac * 2.5),
    heat: n('heat', r[F_HEAT] * 0.5 + g.oilHeat * 1.2 - r[F_SWEET] * 0.1),
    aroma: n('aroma', r[F_AROMA] * (1 + sour * 0.6)),
    body: n('body', r[F_BODY]),
  };
  // Sourness cuts perceived richness; an overwhelming axis drowns the rest.
  p.rich = Math.max(0, p.rich - sour * 0.2);
  for (const k of ['salty', 'sour', 'heat', 'bitter']) {
    if (p[k] > 0.85) for (const o of ['sweet', 'umami', 'aroma']) p[o] *= 0.7;
  }
  return p;
};

Taste.topNotes = function (n = 3) {
  return Object.entries(Sim.notes).filter(([, v]) => v > 0.03).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
};

// Generic deliciousness 0..1 with a breakdown.
Taste.score = function (p, extra = {}) {
  let bal = 0;
  const axes = extra.plate ? TASTE_AXES.filter((k) => k !== 'body') : TASTE_AXES;
  for (const k of axes) {
    const [ideal, tol] = IDEAL[k];
    let d = Math.abs(p[k] - ideal) - tol;
    if (k === 'umami' && p[k] > ideal) d = 0;  // more savory is rarely bad
    bal += 1 - Math.max(0, Math.min(1, d / 0.4));
  }
  bal /= axes.length;
  const notes = Object.values(Sim.notes).filter((v) => v > 0.05).length;
  const complexity = Math.min(1, notes / 5) - Math.max(0, notes - 8) * 0.1;
  const flaws = extra.flaws || 0;
  const bland = (p.salty + p.sweet + p.sour + p.umami + p.aroma) < 0.4 ? 0.25 : 0;
  return Math.max(0, Math.min(1, bal * 0.7 + complexity * 0.3 - flaws - bland));
};

Taste.feedback = function (p) {
  if (p.bitter > 0.45) return 'Bitter... something burned.';
  if (p.salty > 0.85) return 'Way too salty!';
  if (p.heat > 0.85) return 'SPICY!! *gasp*';
  if (p.sour > 0.7) return 'Too sharp! Sugar or fat?';
  if (p.sweet > 0.85 && p.sweet > p.salty + p.umami) return 'Tastes like dessert...';
  if (p.sweet > 0.6 && p.salty < 0.3) return 'Sweet but flat. A pinch of salt?';
  if (p.salty < 0.2 && p.umami < 0.3) return 'Flat... needs salt.';
  if (p.rich > 0.75 && p.sour < 0.1) return 'Heavy. Acid would lift it.';
  if (p.umami < 0.25) return 'Needs depth. Something savory?';
  if (p.aroma < 0.15) return 'Smells of nothing. Aromatics?';
  if (p.body < 0.08) return 'Thin and watery.';
  if (p.salty < 0.3) return 'Close! A pinch more salt.';
  return 'Mmm, delicious!';
};

// Taste tool: sample around a grid point.
Taste.sip = function (gx, gy) {
  const g = Taste.gather(gx, gy, 8);
  if (g.broth + g.oil < 5) return { empty: true, line: 'Nothing to taste here!' };
  const p = Taste.perceive(g);
  if (g.broth === 0) return { p, score: 0.2, line: 'Just... oil.', notes: Taste.topNotes(), temp: g.temp };
  return { p, score: Taste.score(p), line: Taste.feedback(p), notes: Taste.topNotes(), temp: g.temp };
};

// What one solid cell tastes like: base flavor, adjusted for how it's been cooked
// and how much it has already given up to the broth.
// A cell of food is more food than a cell of broth: pieces weigh this much in the bite average.
const SOLID_WEIGHT = 4;

// Adds what one solid cell tastes like (base flavor adjusted for cooking and for what it has
// already given to the broth, plus any glaze on it). Returns its weight in the average, or 0.
Taste.eatFlavor = function (i, out) {
  const S = Sim, m = S.mat[i], base = EAT[m];
  if (!base) return 0;
  // Dough and bread are mostly flour: their seasoning is what's mixed into them, not diluted further.
  const grain = CLS[m] === C_POWDER, w = grain || m === DOUGH || m === BREAD ? 1 : SOLID_WEIGHT;
  const c = S.cook[i], meaty = m === MEAT || m === FISH || m === FISHFIN;
  const spent = CLS[m] === C_CHUNK && MAT[m].leach ? 0.4 + 0.6 * S.life[i] / 255 : 1;
  for (let k = 0; k < NF; k++) out[k] += (grain ? base[k] : base[k] * spent * w) + S.fl[i * NF + k];
  out[F_BITTER] += S.fl[i * NF + F_SODA] * 0.5;   // unreacted soda tastes soapy
  if (m === HERB) {                      // herbs track wilting, not browning: the more wilted, the less aroma left
    out[F_AROMA] -= base[F_AROMA] * spent * w * 0.8 * Math.min(1, c / 120);
  } else if (c >= 150 && c < 215 && !grain) {   // browned: Maillard depth and sweetness
    out[F_UMAMI] += (base[F_UMAMI] * 0.4 + 0.1) * w; out[F_SWEET] += base[F_SWEET] * 0.5 * w;
    out[F_AROMA] += 0.3 * w; out[F_BROWN] += 0.3 * w;
  } else if (c >= 215 && !grain && CLS[m] === C_CHUNK) {   // past a sear: dry and charred
    out[F_BITTER] += 0.25 * w; out[F_AROMA] += 0.1 * w;
  } else if (meaty && c < 30) {          // raw meat/fish tastes of little
    out[F_UMAMI] -= base[F_UMAMI] * 0.5 * spent * w;
  }
  return w;
};

// What came out of the oven (or pot): rise, doneness, crust, texture, and what kind of bake it is.
Taste.bakeReport = function (counts) {
  const S = Sim, baked = counts[BREAD] || 0, raw = counts[DOUGH] || 0;
  let water = 0, sweet = 0, rich = 0, egg = 0, gluten = 0, soda = 0, surface = 0, crust = 0, burnt = 0, wet = 0;
  for (let i = 0; i < N; i++) {
    const m = S.mat[i];
    if (m !== BREAD && m !== DOUGH) continue;
    const o = i * NF;
    water += S.fl[o + F_WATER]; sweet += S.fl[o + F_SWEET]; rich += S.fl[o + F_RICH]; egg += S.fl[o + F_EGG];
    gluten += S.fl[o + F_GLUTEN]; soda += S.fl[o + F_SODA];
    if (m !== BREAD) continue;
    const x = i % GW, y = (i / GW) | 0;
    let outside = false;
    for (const j of [i - GW, i + GW, i - 1, i + 1]) {
      if (j < 0 || j >= N || (j === i - 1 && x === 0) || (j === i + 1 && x === GW - 1)) { if (y === GH - 1) outside = true; continue; }
      if (S.mat[j] !== BREAD && S.mat[j] !== DOUGH) outside = true;
      if (S.mat[j] === BROTH) wet++;
    }
    if (outside) { surface++; const c = S.cook[i]; if (c >= 140 && c < 215) crust++; else if (c >= 215) burnt++; }
  }
  const n = Math.max(1, baked + raw), r = {
    cells: baked + raw,
    doneness: baked / n,
    rise: 1 + (S.flags.risen || 0) / Math.max(1, S.flags.doughMade || 1),
    crust: crust / Math.max(1, surface), burnt: burnt / Math.max(1, surface),
    water: water / n, sweet: sweet / n, rich: rich / n, egg: egg / n, gluten: gluten / n, soda: soda / n,
    boiled: wet > surface * 0.3,
  };
  // Name it the way a baker would.
  // Fried in an open pan or baked under the lid (a pot oven)?
  const panFried = (S.flags.panSets || 0) > (S.flags.lidSets || 0);
  const sweetRich = r.sweet > 0.6 && (r.egg > 0.15 || r.rich > 0.3);
  r.kind = r.boiled ? 'dumplings'
         : panFried ? (r.water >= 0.9 ? (r.rise > 1.2 ? 'pancake' : 'crêpe') : sweetRich ? 'cookie' : 'flatbread')
         : sweetRich ? (r.rise > 1.3 ? 'cake' : 'cookie')
         : r.rise > 1.3 ? 'bread' : 'flatbread';
  r.wantsRise = r.kind === 'bread' || r.kind === 'cake' || r.kind === 'pancake' || r.kind === 'dumplings';
  r.wantsCrust = r.kind === 'bread' || r.kind === 'flatbread' || r.kind === 'cookie';
  return r;
};

// Whole-pot analysis for serving to the judges: tastes every edible thing, not just the broth,
// and works out what kind of dish it is.
Taste.analyzeBowl = function () {
  const S = Sim, g = Taste.gather(0, 0, 0);
  const counts = {}, cooked = {}, bite = new Float32Array(NF);
  let total = 0, edible = 0, weight = 0, temp = 0, solidCells = 0, crust = 0, done = 0, oilHeat = 0;
  // Seasoning still in the air when you serve hasn't landed yet: not grit.
  for (let i = 0; i < N; i++) {
    const m = S.mat[i];
    if (m === EMPTY || CLS[m] === C_GAS || m === FIRE || m === FOAM) continue;
    if (CLS[m] === C_POWDER && (m === SALT || m === SUGAR) && i + GW < N && S.mat[i + GW] === EMPTY) continue;   // mid-air
    total++;
    counts[m] = (counts[m] || 0) + 1;
    cooked[m] = (cooked[m] || 0) + S.cook[i];
    const o = i * NF;
    let w = 1;
    if (m === BROTH) { for (let k = 0; k < NF; k++) bite[k] += S.fl[o + k]; bite[F_BITTER] += S.fl[o + F_SODA] * 0.05; }
    else if (m === OIL) {
      // Oil carries whatever reduced into it (a pan sauce); its aroma and chili heat come through too.
      for (let k = 0; k < NF; k++) if (k !== F_HEAT) bite[k] += S.fl[o + k] * (k === F_AROMA ? 0.5 : 1);
      oilHeat += S.fl[o + F_HEAT];
    }
    else if ((w = Taste.eatFlavor(i, bite))) {
      solidCells++;
      if (CLS[m] === C_CHUNK) { const c = S.cook[i]; if (c >= 140 && c < 215) crust++; if (c >= 60) done++; }
    } else if (m !== SHELL && m !== BURNT && m !== FISHEYE) continue;
    else w = 1;
    edible++;
    if (m !== OIL) weight += w;
    temp += S.temp[i];
  }
  const avgCook = (m) => counts[m] ? cooked[m] / counts[m] : 0;
  const nonOil = Math.max(1, weight);
  for (let k = 0; k < NF; k++) bite[k] /= nonOil;
  const brothShare = g.broth / Math.max(1, edible);
  const bakedN = counts[BREAD] || 0, rawDough = counts[DOUGH] || 0, doughy = bakedN + rawDough;
  const type = edible < 25 ? 'empty' :
               doughy >= 40 && doughy >= solidCells * 0.5 && g.broth < Math.max(400, doughy * 1.5) ? 'baked' :
               g.broth >= 400 && brothShare >= 0.55 ? 'soup' : g.broth >= 150 && brothShare >= 0.25 ? 'stew' : 'plate';
  const plate = type === 'plate' || type === 'baked';
  const bake = doughy ? Taste.bakeReport(counts) : null;

  const chunkMats = [ONION, GARLIC, CARROT, CELERY, MEAT, HERB, TOMATO, FISH];
  let chunks = 0, raw = 0;
  for (const m of chunkMats) {
    chunks += counts[m] || 0;
    if (counts[m] && avgCook(m) < 30 && m !== HERB) raw += counts[m];
  }
  const burntFrac = (counts[BURNT] || 0) / Math.max(1, total);
  const p = Taste.perceive({ raw: bite, broth: nonOil, oil: g.oil, oilHeat: oilHeat / Math.max(1, edible) }, burntFrac, plate);
  if (plate) p.body = 0;
  // Undissolved powder is gritty in a soup; on a plate, salt and spice are just seasoning.
  const seasoning = (counts[SALT] || 0) + (counts[SUGAR] || 0) + (counts[CHILI] || 0) + (counts[CUMIN] || 0);
  const flourGrit = Math.max(0, (counts[FLOUR] || 0) - (type === 'baked' ? doughy * 0.15 : 0));   // a dusting of flour on a loaf is fine
  const grit = flourGrit + (counts[SODA] || 0) + (plate ? Math.max(0, seasoning - edible * 0.25) : (counts[SALT] || 0) + (counts[SUGAR] || 0));
  // Raw egg white left in the bowl is as bad as raw veg (a runny yolk is fine).
  raw += (counts[EGG] || 0) + (counts[DOUGH] || 0);
  chunks += (counts[DOUGH] || 0) + (counts[BREAD] || 0) + (counts[EGG] || 0) + (counts[YOLK] || 0) + (counts[WHITE_COOKED] || 0) + (counts[YOLK_COOKED] || 0) + (counts[FISHFIN] || 0);
  const oilShare = g.oil / Math.max(1, edible);
  const flaws = {
    burnt: Math.min(1, burntFrac * 20),
    curdled: type === 'baked' ? 0 : Math.min(1, (counts[CURD] || 0) / 40),   // buttermilk curds belong in a bake
    lumps: Math.min(1, ((counts[LUMP] || 0) + (type === 'baked' ? 0 : counts[DOUGH] || 0)) / 30),   // raw dough in soup = lumps
    scrambled: Math.min(1, (counts[SCRAMBLE] || 0) / 40),
    raw: Math.min(1, raw / Math.max(1, chunks) * (chunks > 10 ? 1 : 0)),
    gritty: Math.min(1, grit / 60),
    // A plate can carry some oil; a soup with an oil slick is greasy much sooner.
    greasy: Math.min(1, Math.max(0, oilShare - (plate ? 0.35 : 0.12)) * (plate ? 3 : 5)),
    shell: Math.min(1, (counts[SHELL] || 0) / 10),
    chemical: Math.min(1, (counts[EXTPOWDER] || 0) / 15),
  };
  const flawSum = flaws.burnt * 0.3 + flaws.curdled * 0.2 + flaws.lumps * 0.15 + flaws.scrambled * 0.1 +
                  flaws.raw * 0.15 + flaws.gritty * 0.1 + flaws.greasy * 0.15 + flaws.shell * 0.2 + flaws.chemical * 0.4;
  return {
    type, empty: type === 'empty', bake,
    rawBite: bite,   // flavor actually in the food, before perception (for diagnosing tuning)
    debug: { edible, broth: g.broth, oil: g.oil, solids: solidCells, grains: { flour: counts[FLOUR] || 0, salt: counts[SALT] || 0, sugar: counts[SUGAR] || 0, soda: counts[SODA] || 0, curd: counts[CURD] || 0, lump: counts[LUMP] || 0 }, rawSalty: +bite[F_SALTY].toFixed(2), rawSweet: +bite[F_SWEET].toFixed(2), rawUmami: +bite[F_UMAMI].toFixed(2) },
    volume: g.broth + g.oil,
    p, temp: temp / Math.max(1, edible),
    notes: Taste.topNotes(4),
    chunkiness: plate ? 1 : Math.min(1, chunks / Math.max(1, total) * 4),
    crust: crust / Math.max(1, solidCells),
    doneness: done / Math.max(1, solidCells),
    ribbons: counts[RIBBON] || 0,
    eggPieces: (counts[WHITE_COOKED] || 0) + (counts[YOLK_COOKED] || 0),
    wholeEgg: (counts[SHELL] || 0) >= 12,
    fish: counts[FISH] || 0,
    fishCooked: counts[FISH] ? avgCook(FISH) : 0,
    caramelized: (counts[ONION] || 0) > 10 && avgCook(ONION) > 140,
    mirepoix: !!S.flags.mirepoix,
    deglazed: (S.flags.deglazed || 0) > 1,
    discoveries: S.discovered.size,
    flaws, flawSum,
    score: Taste.score(p, { flaws: flawSum, plate }),
    solids: solidCells,
  };
};
