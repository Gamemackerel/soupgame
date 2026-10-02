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
Taste.perceive = function (g, burntFrac = 0) {
  const r = g.raw, oilFrac = g.oil / Math.max(1, g.broth + g.oil);
  const n = (k, v) => Math.max(0, Math.min(1, v / NORM[k]));
  const salty = n('salty', r[F_SALTY]);
  const sour = n('sour', r[F_SOUR]);
  const p = {
    salty,
    sweet: n('sweet', r[F_SWEET] * (1 + salty * 0.3)),
    sour: n('sour', r[F_SOUR] - r[F_SWEET] * 0.15),
    bitter: n('bitter', Math.max(0, r[F_BITTER] - salty * 0.15) + burntFrac * 2),
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
  for (const k of TASTE_AXES) {
    const [ideal, tol] = IDEAL[k];
    let d = Math.abs(p[k] - ideal) - tol;
    if (k === 'umami' && p[k] > ideal) d = 0;  // more savory is rarely bad
    bal += 1 - Math.max(0, Math.min(1, d / 0.4));
  }
  bal /= TASTE_AXES.length;
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
  if (p.sweet > 0.7) return 'Tastes like dessert...';
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

// Whole-pot analysis for serving to the judges.
Taste.analyzeBowl = function () {
  const S = Sim, g = Taste.gather(0, 0, 0);
  const counts = {}, cooked = {};
  let total = 0;
  for (let i = 0; i < N; i++) {
    const m = S.mat[i];
    if (m === EMPTY || CLS[m] === C_GAS || m === FIRE) continue;
    total++;
    counts[m] = (counts[m] || 0) + 1;
    cooked[m] = (cooked[m] || 0) + S.cook[i];
  }
  const avgCook = (m) => counts[m] ? cooked[m] / counts[m] : 0;
  const solids = total - g.broth - g.oil;
  const chunkMats = [ONION, GARLIC, CARROT, CELERY, MEAT, HERB, TOMATO];
  let chunks = 0, raw = 0;
  for (const m of chunkMats) {
    chunks += counts[m] || 0;
    if (counts[m] && avgCook(m) < 30 && m !== HERB) raw += counts[m];
  }
  const burnt = counts[BURNT] || 0;
  const burntFrac = burnt / Math.max(1, total);
  const p = Taste.perceive(g, burntFrac);
  // Undissolved powder in the bowl is gritty.
  const grit = (counts[SALT] || 0) + (counts[SUGAR] || 0) + (counts[FLOUR] || 0) + (counts[SODA] || 0);
  const flaws = {
    burnt: Math.min(1, burntFrac * 20),
    curdled: Math.min(1, (counts[CURD] || 0) / 40),
    lumps: Math.min(1, (counts[LUMP] || 0) / 30),
    scrambled: Math.min(1, (counts[SCRAMBLE] || 0) / 40),
    raw: Math.min(1, raw / Math.max(1, chunks) * (chunks > 10 ? 1 : 0)),
    gritty: Math.min(1, grit / 60),
    greasy: Math.min(1, Math.max(0, g.oil / Math.max(1, g.broth + g.oil) - 0.12) * 5),
  };
  const flawSum = flaws.burnt * 0.3 + flaws.curdled * 0.2 + flaws.lumps * 0.15 + flaws.scrambled * 0.1 +
                  flaws.raw * 0.15 + flaws.gritty * 0.1 + flaws.greasy * 0.15;
  return {
    empty: g.broth < 200,
    volume: g.broth + g.oil,
    p, temp: g.temp,
    notes: Taste.topNotes(4),
    chunkiness: Math.min(1, chunks / Math.max(1, total) * 4),
    ribbons: counts[RIBBON] || 0,
    caramelized: (counts[ONION] || 0) > 10 && avgCook(ONION) > 140,
    mirepoix: !!S.flags.mirepoix,
    deglazed: (S.flags.deglazed || 0) > 1,
    discoveries: S.discovered.size,
    flaws, flawSum,
    score: Taste.score(p, { flaws: flawSum }),
    solids,
  };
};
