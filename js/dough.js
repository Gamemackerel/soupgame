// Dough and baking chemistry.
//
// Flour doesn't dissolve: each grain soaks up liquid and becomes a dough cell that tracks its own
// composition in its flavor slots (F_WATER, F_EGG, F_LEAVEN, F_GLUTEN plus salt, sugar, fat…).
// Water content decides texture: crumbly → dough → sticky → batter → (too thin) it melts into the soup.
// Heat makes leavening release gas; dough with structure (gluten, egg) holds it and rises, then sets
// into BREAD, which browns into a crust where it touches hot, dry metal.

const DOUGH_CRUMBLY = 0.35, DOUGH_STICKY = 0.9, DOUGH_BATTER = 1.6, DOUGH_THIN = 4;
const FLOUR_SOAK = 0.6;        // water one flour grain takes up when it first meets liquid
const dIs = (m) => m === DOUGH;

// Move part of liquid cell j into dough cell i (water plus whatever was dissolved in it).
// A whole liquid cell holds about one unit of water; it's used up once given away.
function soakFrom(S, i, j, water) {
  const a = i * NF, b = j * NF, m = S.mat[j];
  if (m === EGG || m === YOLK) {
    // Egg brings water, protein (structure) and, from the yolk, fat.
    S.fl[a + F_WATER] += water * 0.75;
    S.fl[a + F_EGG] += 1;
    if (m === YOLK) S.fl[a + F_RICH] += 0.6;
    S.setCell(j, EMPTY);
    return;
  }
  S.fl[a + F_WATER] += water;
  // Bring the liquid's dissolved flavors along in proportion; the cell is used up as it gives water.
  const share = Math.min(1, water);
  for (let k = 0; k < F_WATER; k++) { S.fl[a + k] += S.fl[b + k] * share; S.fl[b + k] *= 1 - share; }
  // A liquid cell's `life` counts how much of its water (in hundredths) has been soaked up.
  S.life[j] = Math.min(255, S.life[j] + Math.round(water * 100));
  if (S.life[j] >= 100) S.setCell(j, EMPTY);
}

// A flour grain meeting liquid, egg, or wetter dough becomes dough.
function reactFlourDough(S, x, y, i) {
  const oil = S.findNb(x, y, isOil);
  if (oil >= 0 && S.temp[i] > 80 && rnd() < 0.05) {
    S.setCell(i, ROUX, S.temp[i]); S.discover('roux'); return true;
  }
  // Cold fat rubbed into flour coats it: a sandy, crumbly shortcrust mix (cookies, pastry).
  if (oil >= 0 && S.temp[i] < 60 && rnd() < 0.05) {
    becomeDough(S, i);
    S.fl[i * NF + F_RICH] += 0.8; S.fl[i * NF + F_WATER] += 0.1;
    if (rnd() < 0.5) S.setCell(oil, EMPTY);
    return true;
  }
  if (rnd() > 0.15) return false;
  const j = S.nb(x, y);
  if (j < 0) return false;
  const mj = S.mat[j];
  if (mj === BROTH) {
    // Dumped into hot liquid without stirring, the outside gels before water gets in: a lump.
    if (S.temp[j] > 60 && !S.stirT[i] && rnd() < 0.5) { S.setCell(i, LUMP, S.temp[j]); S.discover('lumps'); return true; }
    becomeDough(S, i); soakFrom(S, i, j, FLOUR_SOAK);
    return true;
  }
  if ((mj === EGG || mj === YOLK) && !S.bodyKind[S.body[j]] /* loose or soft blob */) {
    becomeDough(S, i); soakFrom(S, i, j, 1);
    return true;
  }
  if (mj === CURD) {   // soured-milk curds work into dough like the milk they came from
    becomeDough(S, i); S.fl[i * NF + F_WATER] += 0.5; S.fl[i * NF + F_RICH] += 0.4; S.setCell(j, EMPTY);
    return true;
  }
  if (mj === DOUGH && S.fl[j * NF + F_WATER] > 0.4) {
    // Dry flour pulls water out of wet dough: adding flour stiffens it.
    becomeDough(S, i);
    const a = i * NF, b = j * NF;
    for (let k = 0; k < NF; k++) { const half = S.fl[b + k] / 2; S.fl[a + k] = half; S.fl[b + k] = half; }
    return true;
  }
  return false;
}

function becomeDough(S, i) {
  const t = S.temp[i];
  S.setCell(i, DOUGH, t);
  S.flags.doughMade = (S.flags.doughMade || 0) + 1;
  S.discover('dough');
}

// Grains and liquids that a dough cell takes in, and what they add to it.
function absorbInto(S, i, j) {
  const a = i * NF, mj = S.mat[j], w = S.fl[a + F_WATER];
  switch (mj) {
    case BROTH:
      if (w >= DOUGH_THIN) return false;
      soakFrom(S, i, j, 0.5);
      return true;
    case EGG: case YOLK:
      if (S.bodyKind[S.body[j]] === BK_SHELL) return false;
      soakFrom(S, i, j, 1);
      return true;
    case CURD:
      S.fl[a + F_WATER] += 0.4; S.fl[a + F_RICH] += 0.4; S.setCell(j, EMPTY);
      return true;
    case OIL:
      if (S.fl[a + F_RICH] > 2) return false;
      S.fl[a + F_RICH] += 0.6; S.setCell(j, EMPTY);
      return true;
    case SALT: case SUGAR:
      // By weight, salt tastes ~10× stronger than sugar: a pinch seasons bread, a cake needs lots of sugar.
      S.addFlavor(i, MAT[mj].solu, mj === SUGAR ? 0.15 : 1); S.fl[a + F_WATER] += 0.05; S.setCell(j, EMPTY);
      return true;
    case BAKEPOWDER:
      S.fl[a + F_LEAVEN] += 0.5; S.setCell(j, EMPTY);
      return true;
    case SODA:
      // Soda only leavens with acid; without it, it's soapy and barely lifts.
      // Soda waits in the dough until acid reaches it (see reactDough).
      S.fl[a + F_SODA] += 1;
      S.setCell(j, EMPTY);
      return true;
  }
  return false;
}

function reactDough(S, x, y, i) {
  const a = i * NF, t = S.temp[i], w = S.fl[a + F_WATER];
  const j = S.nb(x, y);
  if (j >= 0) {
    const mj = S.mat[j];
    if (mj === DOUGH) {
      // Neighbouring dough evens out its make-up; stirring (kneading) mixes it much faster.
      const r = S.stirT[i] || S.stirT[j] ? 0.4 : 0.06, b = j * NF;
      for (let k = 0; k < NF; k++) { const d = (S.fl[b + k] - S.fl[a + k]) * r; S.fl[a + k] += d; S.fl[b + k] -= d; }
    } else {
      // Mixing pulls liquid in fast; left alone it soaks in slowly. Kneaded dough resists, and in hot
      // liquid the outside sets into a skin (so dumplings hold together instead of dissolving).
      let p = S.stirT[i] ? 0.25 : 0.05;
      if (mj === BROTH && !S.stirT[i] && w > DOUGH_CRUMBLY) {
        p *= 0.05;                                  // formed dough soaks up water only slowly
        if (S.fl[a + F_GLUTEN] > 0.15) p *= 0.4;
        if (t > 80) p *= 0.05;
      }
      if (rnd() < p && absorbInto(S, i, j)) return true;
    }
  }
  // Too much liquid: it stops being batter and thins out into the soup as a thickener.
  if (S.fl[a + F_WATER] > DOUGH_THIN && S.findNb(x, y, isBroth) >= 0) {
    const body = 1.2;
    S.mat[i] = BROTH;
    S.fl[a + F_BODY] += body; S.fl[a + F_WATER] = 0; S.fl[a + F_GLUTEN] = 0; S.fl[a + F_EGG] = 0;
    return true;
  }
  if (w >= DOUGH_BATTER) S.discover('batter');
  // Soda meeting acid inside the dough (vinegar, soured milk) fizzes into real lift.
  // Without acid, heat only gets a little lift out of it and the rest stays soapy.
  const soda = S.fl[a + F_SODA];
  if (soda > 0.005) {
    if (S.fl[a + F_SOUR] > 0.005) {
      const r = Math.min(S.fl[a + F_SOUR] / 0.25, soda) * 0.5;
      S.fl[a + F_SOUR] -= 0.25 * r; S.fl[a + F_SODA] -= r; S.fl[a + F_LEAVEN] += r * 0.5;
    } else if (t > 80) {
      // Heated without acid, soda half-breaks down: a little gas and a soapy-tasting residue.
      const r = soda * 0.01; S.fl[a + F_SODA] -= r; S.fl[a + F_LEAVEN] += r * 0.3; S.fl[a + F_BITTER] += r * 2;
      if (S.fl[a + F_BITTER] > 0.05) S.discover('soapy');
    }
  }
  // Resting dough slowly develops a little gluten on its own.
  if (w > 0.4 && w < 1.4 && S.fl[a + F_GLUTEN] < 0.3 && rnd() < 0.02) S.fl[a + F_GLUTEN] += 0.002;

  // Gas comes out of the leavening as the dough warms, before it sets ("oven spring").
  if (t > 55 && S.fl[a + F_LEAVEN] > 0.01 && rnd() < S.fl[a + F_LEAVEN] * 0.15) rise(S, x, y, i);
  if (t > 90 && rnd() < (t - 85) / 280) {
    S.cook[i] = Math.min(255, S.cook[i] + 1);
    if (S.cook[i] >= 100) { setBread(S, x, y, i); return true; }
  }
  return false;
}

// Heat frees gas from the leavening. Dough with structure traps it and swells upward; weak dough
// lets it bubble out (and stays dense). A pinch is plenty; a lot makes coarse, bitter crumb.
function rise(S, x, y, i) {
  const a = i * NF, w = S.fl[a + F_WATER];
  // Thin batter lets bubbles escape; egg and gluten make a net that holds them.
  const hold = Math.max(0, Math.min(0.9, 0.2 + S.fl[a + F_GLUTEN] * 0.6 + Math.min(1, S.fl[a + F_EGG]) * 0.35 +
                              (w > 0.3 && w < 1.4 ? 0.15 : 0) - Math.max(0, w - DOUGH_BATTER) * 0.25));
  S.fl[a + F_LEAVEN] *= 0.7;                  // some gas is spent either way
  if (rnd() > hold) return;
  // Push the dough beside or above outward by one cell and fill the gap with a copy (it has puffed).
  // Mostly up, sometimes sideways, so a loaf swells into a dome rather than a spire.
  const r = rnd(), dx = r < 0.6 ? 0 : r < 0.8 ? -1 : 1, dy = dx ? 0 : -1, step = dy * GW + dx;
  for (let k = 1; k <= 16; k++) {
    const xx = x + dx * k, yy = y + dy * k;
    if (xx < 0 || xx >= GW || yy < 0) return;
    const end = yy * GW + xx, mt = S.mat[end];
    if (mt === DOUGH) continue;
    if (!(mt === EMPTY || CLS[mt] === C_GAS || CLS[mt] === C_LIQUID)) return;
    if (CLS[mt] === C_LIQUID) S.setCell(end, EMPTY);
    for (let q = end; q !== i + step; q -= step) S.swap(q, q - step);
    const n = i + step;
    S.setCell(n, DOUGH, S.temp[i]);
    for (let f = 0; f < NF; f++) S.fl[n * NF + f] = S.fl[a + f];
    // The remaining gas is shared between the two halves, not duplicated.
    S.fl[a + F_LEAVEN] *= 0.5; S.fl[n * NF + F_LEAVEN] = S.fl[a + F_LEAVEN];
    S.flags.risen = (S.flags.risen || 0) + 1;
    S.discover('rise');
    return;
  }
}

// Dough that's hot enough sets into a baked piece. Connected baked cells become one solid piece.
function setBread(S, x, y, i) {
  S.mat[i] = BREAD;
  S.cook[i] = 100;
  let b = 0;
  for (const j of [i - GW, i + GW, i - 1, i + 1]) if (j >= 0 && j < N && S.mat[j] === BREAD && S.body[j]) { b = S.body[j]; break; }
  if (!b) b = S.newBody(BK_FIRM);
  S.body[i] = b;
  S.discover('baked');
  if (S.lid) S.flags.lidSets = (S.flags.lidSets || 0) + 1; else S.flags.panSets = (S.flags.panSets || 0) + 1;
  if (S.fl[i * NF + F_SODA] > 0.02) S.discover('soapy');
  let wetSides = 0;
  for (const j of [i - GW, i + GW, i - 1, i + 1]) if (j >= 0 && j < N && S.mat[j] === BROTH) wetSides++;
  if (wetSides >= 2) S.discover('dumpling');
  if (S.lid) S.discover('potoven');
}

// Dough texture in motion: crumbly bits trickle like sand, dough holds together and slowly slumps,
// batter pours.
function moveDough(x, y, i) {
  const S = Sim, mat = S.mat, w = S.fl[i * NF + F_WATER];
  if (w < DOUGH_CRUMBLY) return moveGrain(x, y, i, DOUGH, 0.8);
  const below = y < GH - 1 ? i + GW : -1;
  if (w >= DOUGH_BATTER) {
    // Batter: a thick liquid. Runnier batter flows further.
    if (below >= 0 && (isOpen(mat[below]) || (CLS[mat[below]] === C_LIQUID && rnd() < 0.3))) { S.swap(i, below); return; }
    const flow = Math.min(0.6, 0.1 + (w - DOUGH_BATTER) * 0.2);
    if (rnd() < flow) {
      const dx = rnd() < 0.5 ? -1 : 1, nx = x + dx;
      if (nx >= 0 && nx < GW && isOpen(mat[i + dx]) && (below < 0 || !isOpen(mat[below + dx]) || rnd() < 0.5)) S.swap(i, i + dx);
    }
    return;
  }
  // Dough: sticks to itself. A cell only moves if it stays attached to the rest (or is a loose lump).
  const own = doughNbs(S, x, y, -1);
  const tryMove = (dx, dy, p) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= GW || ny >= GH || rnd() > p) return false;
    const j = ny * GW + nx, mj = mat[j];
    if (!(isOpen(mj) || (CLS[mj] === C_LIQUID && rnd() < 0.3))) return false;
    if (own > 0 && doughNbs(S, nx, ny, i) === 0) return false;
    S.swap(i, j);
    return true;
  };
  if (tryMove(0, 1, own ? 0.5 : 1)) return;
  const slump = w > DOUGH_STICKY ? 0.2 : 0.08;   // dough relaxes into a rounded mound
  const side = rnd() < 0.5 ? -1 : 1;
  tryMove(side, 1, slump) || tryMove(-side, 1, slump);
}

function doughNbs(S, x, y, skip) {
  let n = 0;
  if (y > 0 && S.mat[(y - 1) * GW + x] === DOUGH && (y - 1) * GW + x !== skip) n++;
  if (y < GH - 1 && S.mat[(y + 1) * GW + x] === DOUGH && (y + 1) * GW + x !== skip) n++;
  if (x > 0 && S.mat[y * GW + x - 1] === DOUGH && y * GW + x - 1 !== skip) n++;
  if (x < GW - 1 && S.mat[y * GW + x + 1] === DOUGH && y * GW + x + 1 !== skip) n++;
  return n;
}

// Dough color: shaggy flour → pale dough → glossy batter, warmer with egg and sugar, then crisping.
function doughColor(S, i, c) {
  const o = i * NF, w = S.fl[o + F_WATER];
  c[0] = 238; c[1] = 226; c[2] = 200;
  if (w < DOUGH_CRUMBLY) { c[0] = 232; c[1] = 222; c[2] = 202; }
  else if (w >= DOUGH_BATTER) { c[0] = 244; c[1] = 228; c[2] = 186; }
  lerpC(c, Math.min(0.6, S.fl[o + F_EGG] * 0.3), 250, 208, 110);
  lerpC(c, Math.min(0.3, S.fl[o + F_SWEET] * 0.01), 236, 200, 150);
  lerpC(c, Math.min(0.4, S.fl[o + F_RED] * 0.2), 200, 90, 70);
  lerpC(c, Math.min(0.5, S.fl[o + F_BROWN] * 0.2), 150, 100, 60);
  if (w >= DOUGH_BATTER && (S.shade[i] & 7) === 0) lerpC(c, 0.3, 255, 255, 240);   // glossy batter
  if (S.cook[i] > 0) lerpC(c, S.cook[i] / 200, 240, 214, 160);
}
