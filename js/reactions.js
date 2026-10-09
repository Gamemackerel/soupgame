// Cooking chemistry: per-cell reaction rules, combo detection, and sim rendering.
// Sim.react returns true when the cell changed or moved and should skip movement this frame.

const isBroth = (m) => m === BROTH;
const isOil = (m) => m === OIL;
const isLiquid = (m) => CLS[m] === C_LIQUID;
const isEmpty = (m) => m === EMPTY;
const isFire = (m) => m === FIRE;

const TOMATO_MELT = flavorVec({ sour: 2, umami: 5, red: 10, sweet: 0.5, body: 1.5 });
const LEACH_K = 2; // how strongly chunks flavor the soup
// Caramelization pace: sweating, then slow browning in fat (tuned so onions take ~2 min at heat 5).
// Browning alone stops at deep brown; past that, only scorching on the metal takes food to char.
const BROWN_MAX = 230;
// Moist vegetables are held near 110°C until they dry (brown) past `dryFrom`; `pass` lets some pan heat through.
const MOIST_K = { dryFrom: 100, slope: 1.5, pass: 0.6 };
// Onions are the famously slow ones; carrots, celery and garlic color sooner.
const CARAMEL_K = { sweat: 0.25, fat: 0.6, onionSweat: 0.12, onion: 0.07 };
const BURNT_TASTE = flavorVec({ bitter: 2.5, brown: 1.5 });   // a little char goes a long way

Sim.react = function (x, y, i, m) {
  switch (m) {
    case BROTH: return reactBroth(this, x, y, i);
    case OIL: return reactOil(this, x, y, i);
    case EGG: case YOLK: return reactEgg(this, x, y, i, m);
    case SALT: case SUGAR: return reactSeasoning(this, x, y, i, m);
    case EXTPOWDER: return reactExtinguisher(this, x, y, i);
    case CHILI: case CUMIN: return reactSpice(this, x, y, i, m);
    case FLOUR: return reactFlourDough(this, x, y, i);
    case DOUGH: return reactDough(this, x, y, i);
    case ROUX: return reactRoux(this, x, y, i);
    case LUMP: return reactLump(this, x, y, i);
    case SODA: return reactSoda(this, x, y, i);
    case TOMATO: return reactChunk(this, x, y, i, m) || reactTomato(this, x, y, i);
    case ONION: case GARLIC: case CARROT: case CELERY: case MEAT: case HERB:
    case FISH: case FISHFIN: case FISHEYE: case WHITE_COOKED: case YOLK_COOKED: case BREAD:
    case CORN: case POTATO: case BEANS: case PASTA:
      return reactChunk(this, x, y, i, m);
  }
  return false;
};

function reactBroth(S, x, y, i) {
  const o = i * NF, fl = S.fl, t = S.temp[i];
  if (fl[o + F_SODA] > 0.01) neutralize(S, x, y, i);
  // Deglazing needs every frame; the rarer reactions are checked on a rotating quarter of cells.
  if (y === GH - 1 && S.fond[x] > 0.02) return deglaze(S, x, i, o, fl, t);
  // Water touching very hot oil splatters (checked every frame: falling drops pass through fast).
  const ob = y < GH - 1 && S.mat[i + GW] === OIL ? i + GW : y > 0 && S.mat[i - GW] === OIL ? i - GW : -1;
  if (ob >= 0 && S.temp[ob] > 140 && rnd() < 0.4 && oilDominates(S, x, y)) return splatter(S, x, y, i, ob);
  if ((S.frame + i) & 3) return false;
  const j = S.nb(x, y);
  if (j >= 0) {
    const mj = S.mat[j];
    if (mj === OIL && S.temp[j] > 140 && rnd() < 0.8 && oilDominates(S, x, y)) return splatter(S, x, y, i, j);
    if (mj === FIRE) {
      if (fl[o + F_ALCOHOL] > 0.25) {
        flambe(S, x, y, i);
      } else if (rnd() < 0.3) {
        S.setCell(j, STEAM, 100);
      }
    }
  }
  // Spontaneous flambé: hot wine at the surface over a roaring flame.
  if (fl[o + F_ALCOHOL] > 0.4 && t > 85 && S.dial >= 9 && !S.lid && y > 0 &&
      S.mat[i - GW] === EMPTY && rnd() < 0.012) flambe(S, x, y, i);

  // Curdling: dairy + acid + heat, or dairy at a hard boil.
  if (fl[o + F_WHITE] > 0.35 && t > 80 && rnd() < 0.08) {
    // The further past the dairy's tolerance the acid goes, the likelier it splits; borderline rarely does.
    const over = fl[o + F_SOUR] - (0.25 * fl[o + F_WHITE] + 0.1);
    const acid = over > 0 && rnd() < Math.min(1, over / 0.3);
    if (acid || (t >= 100 && S.dial >= 8 && rnd() < 0.15)) {
      S.setCell(i, CURD, t);
      S.discover('curdle'); S.emit('curdle', x, y);
      return true;
    }
  }
  return false;
}

// Liquid on the fond at the bottom lifts it into the broth.
function deglaze(S, x, i, o, fl, t) {
  const f = S.fond[x];
  fl[o + F_UMAMI] += f * 1.5; fl[o + F_BROWN] += f * 3; fl[o + F_AROMA] += f * 2; fl[o + F_RICH] += f * 0.5;
  S.fond[x] = 0;
  S.addNote('toasty', f * 0.15);
  S.flags.deglazed = (S.flags.deglazed || 0) + f;
  if (S.flags.deglazed > 1) S.discover('deglaze');
  if (t > 90) S.emit('hiss', x, GH - 1, 30);
  return false;
}

// Spitting only happens when a little water meets a lot of hot oil. Pour lots of water into a
// thin film of oil and the water just wins: it boils and cools the oil instead.
function oilDominates(S, x, y) {
  let oil = 0, water = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || xx >= GW || yy < 0 || yy >= GH) continue;
    const m = S.mat[yy * GW + xx];
    if (m === OIL) oil++; else if (m === BROTH) water++;
  }
  return oil >= 14 && oil >= water * 4;   // a real depth of oil, and only a little water
}

// Water flashing to steam under hot oil: droplets fly, oil jumps, and a burning pot flares up.
function splatter(S, x, y, i, j) {
  // The water flashes off, but what was dissolved in it stays behind as a glaze.
  S.glaze(i, x, y);
  S.setCell(i, STEAM, 120);
  for (let k = 0; k < 3; k++) {
    S.particle({ x: GX + x, y: GY + y, vx: (rnd() - 0.5) * 3, vy: -2 - rnd() * 2.5,
                 life: 60, max: 60, c: [240, 200, 80], kind: 'drop' });
  }
  // Launch the oil upward too.
  for (let up = 2 + rint(8); up > 0; up--) {
    const ty = y - up;
    if (ty >= 0 && S.mat[ty * GW + x] === EMPTY) { S.swap(j, ty * GW + x); break; }
  }
  // Water on a grease fire makes it worse.
  if (S.findNb(x, y, isFire) >= 0 || S.temp[j] > 220) {
    for (let k = 0; k < 6; k++) {
      const fx = x + rint(9) - 4, fy = y - 1 - rint(6);
      if (fx >= 0 && fx < GW && fy >= 0 && S.mat[fy * GW + fx] === EMPTY) S.setCell(fy * GW + fx, FIRE, 300);
    }
    S.emit('fire', x, y);
  }
  S.discover('splatter'); S.emit('splatter', x, y);
  return true;
}

function flambe(S, x, y, i) {
  const o = i * NF;
  S.fl[o + F_ALCOHOL] *= 0.3;
  S.fl[o + F_SWEET] += 0.15;
  S.fl[o + F_AROMA] += 0.2;
  S.addNote('caramel', 0.02);
  for (let k = 0; k < 4; k++) {
    const fx = x + rint(5) - 2, fy = y - 1 - rint(3);
    if (fx >= 0 && fx < GW && fy >= 0 && S.mat[fy * GW + fx] === EMPTY) S.setCell(fy * GW + fx, FIRE, 300);
  }
  S.discover('flambe'); S.emit('flambe', x, y, 90);
}

function reactOil(S, x, y, i) {
  const t = S.temp[i];
  // Oil past its smoke point builds up (cook counts seconds of smoking) before the vapour catches.
  if (t > 185) { if (S.cook[i] < 255) S.cook[i]++; } else if (S.cook[i] > 0) S.cook[i]--;
  if (t > 185 && y > 0 && S.mat[i - GW] === EMPTY) {
    if (t > 205 && S.cook[i] > 200 && rnd() < 0.03) {
      // Past its smoke point the oil vapour catches: a tongue of flame shoots up.
      for (let k = 1; k <= 3 + rint(4); k++) if (y - k >= 0 && S.mat[i - k * GW] === EMPTY) S.setCell(i - k * GW, FIRE, 300);
      S.addNote('smoky', 0.01); S.addNote('burnt', 0.004);
      S.discover('greasefire'); S.emit('fire', x, y);
    } else if (rnd() < 0.01) {
      S.setCell(i - GW, SMOKE, 200); S.addNote('smoky', 0.002); S.emit('smoke', x, y, 120);
    }
  }
  // Fire feeds on oil.
  if (S.findNb(x, y, isFire) >= 0 && rnd() < 0.004) { S.setCell(i, SMOKE, 250); return true; }
  return false;
}

function reactEgg(S, x, y, i, m) {
  if (S.temp[i] < 70 || rnd() > 0.06) return false;
  const t = S.temp[i], b = S.body[i];
  if (b) {
    // Part of a blob or a whole egg: it sets in place and stays one piece.
    S.mat[i] = m === YOLK ? YOLK_COOKED : WHITE_COOKED;
    S.cook[i] = 0;
    const kind = S.bodyKind[b], env = S.bodyEnv[b];
    if (kind === BK_SOFT) S.discover(env === 2 ? 'poached' : 'friedegg');
    if (kind === BK_SHELL && m === YOLK && env === 2) S.discover('hardboil');
    return true;
  }
  // Loose strands: thin ones become ribbons, crowded ones clump into scramble.
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, yy = y + dy;
    if ((dx || dy) && xx >= 0 && xx < GW && yy >= 0 && yy < GH) {
      const j = yy * GW + xx, mm = S.mat[j];
      if (!S.body[j] && (mm === EGG || mm === YOLK || mm === SCRAMBLE)) n++;
    }
  }
  if (n >= 4) { S.setCell(i, SCRAMBLE, t); S.discover('scramble'); }
  else { S.setCell(i, RIBBON, t); if (S.findNb(x, y, isBroth) >= 0) S.discover('eggdrop'); }
  return true;
}

// Extinguisher powder smothers fire and cools whatever it lands on, then dissolves (bitterly).
function reactExtinguisher(S, x, y, i) {
  let put = false;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || xx >= GW || yy < 0 || yy >= GH) continue;
    const j = yy * GW + xx;
    if (S.mat[j] === FIRE) { S.setCell(j, rnd() < 0.5 ? SMOKE : EMPTY, 60); put = true; }
    else if (S.temp[j] > 40) S.temp[j] -= (S.temp[j] - 20) * 0.08;
  }
  if (put) { S.discover('extinguish'); S.emit('extinguish', x, y, 60); }
  const j = S.findNb(x, y, isLiquid);
  if (j >= 0 && rnd() < 0.01) { S.addFlavor(j, MAT[EXTPOWDER].solu); S.setCell(i, EMPTY); return true; }
  return false;
}

// How much salt or sugar one cell of water can hold before it won't take any more.
const SATURATION = { [SALT]: [F_SALTY, 15], [SUGAR]: [F_SWEET, 25] };

function reactSeasoning(S, x, y, i, m) {
  const j = S.findNb(x, y, isBroth);
  if (j >= 0) {
    // Dissolving slows as the water nearby gets concentrated, and stops when it's saturated.
    const [dim, cap] = SATURATION[m], room = 1 - S.fl[j * NF + dim] / cap;
    if (room <= 0) { if (rnd() < 0.01 && S.frame > 60) S.discover('saturated'); return false; }
    if (rnd() < 0.02 * room * (1 + S.temp[j] / 40) * (S.stirT[i] ? 3 : 1)) {
      S.addFlavor(j, MAT[m].solu);
      S.setCell(i, EMPTY);
      S.discover('dissolve');
      return true;
    }
    return false;
  }
  // Dry sugar on a hot pot: caramel, then burnt.
  if (m === SUGAR && S.temp[i] > 160 && rnd() < 0.05) {
    S.addNote('caramel', 0.003);
    if (S.temp[i] > 200 && rnd() < 0.1) { burn(S, x, y, i); return true; }
  }
  return false;
}

function reactSpice(S, x, y, i, m) {
  const t = S.temp[i];
  const inOil = S.findNb(x, y, isOil);
  // Spices bloom in oil hotter than boiling water, or toast on any hot dry surface (a dry-pan toast).
  if ((inOil >= 0 ? t > 100 : t > 110) && S.cook[i] < 60 && rnd() < (t - 98) / 25) {
    S.cook[i]++;   // toasting in the fat; once bloomed it stays bloomed (only real heat burns it)
    if (S.cook[i] >= 60) { S.discover('bloom'); S.addNote('spice', 0.002); S.emit('sizzle', x, y, 60); }
  }
  if (t > MAT[m].burnAt && rnd() < 0.01) { burn(S, x, y, i); return true; }
  // Dissolve: quickly into broth, slowly into oil (heat travels in fat).
  const j = S.findNb(x, y, isLiquid);
  if (j >= 0) {
    const intoOil = S.mat[j] === OIL;
    if (rnd() < (intoOil ? 0.004 : 0.02) * (S.stirT[i] ? 3 : 1)) {
      const bloomed = S.cook[i] >= 60;
      const vec = MAT[m].solu, o = j * NF;
      for (let k = 0; k < NF; k++) {
        let v = vec[k];
        if (k === F_AROMA) v *= bloomed ? 2.8 : intoOil ? 1 : 0.5;   // spice aromatics are fat-soluble: water gets half
        if (k === F_HEAT) v *= intoOil ? 1.5 : bloomed ? 1 : 0.6;   // capsaicin dissolves in fat; plain water barely extracts it
        S.fl[o + k] += v;
      }
      S.addNote('spice', 0.004);
      S.setCell(i, EMPTY);
      return true;
    }
  }
  return false;
}

function reactRoux(S, x, y, i) {
  const t = S.temp[i];
  if (t > 110 && S.cook[i] < 255 && rnd() < 0.025 * (t - 100) / 20) S.cook[i]++;   // blond in about a minute, brown takes minutes
  if (t > MAT[ROUX].burnAt && rnd() < 0.01) { burn(S, x, y, i); return true; }
  const j = S.findNb(x, y, isBroth);
  if (j >= 0 && S.temp[j] > 70 && rnd() < 0.03 * (S.stirT[i] ? 3 : 1)) {
    const c = S.cook[i] / 255, o = j * NF;
    S.fl[o + F_BODY] += 6 * (1 - c * 0.5);   // starch swells hugely: a little roux thickens a lot of liquid
    S.fl[o + F_RICH] += 0.3;
    S.fl[o + F_BROWN] += c * 1.5;
    S.fl[o + F_AROMA] += c * 0.8;
    if (c > 0.3) S.addNote('toasty', 0.003);
    S.flags.thick = (S.flags.thick || 0) + 1;
    if (S.flags.thick > 25) S.discover('thicken');
    S.setCell(i, EMPTY);
    return true;
  }
  return false;
}

function reactLump(S, x, y, i) {
  const j = S.findNb(x, y, isBroth);
  if (j >= 0 && rnd() < (S.stirT[i] ? 0.03 : 0.0005)) {
    S.fl[j * NF + F_BODY] += 1.0; S.fl[j * NF + F_BITTER] += 0.12;
    S.setCell(i, EMPTY); return true;
  }
  return false;
}

// Baking soda dissolves into the liquid as alkalinity (F_SODA) that travels with it and neutralises
// acid wherever it meets it (see reactBroth). A grain is enough to cancel a fair amount of sourness.
const SODA_POWER = 12;
function reactSoda(S, x, y, i) {
  const j = S.findNb(x, y, isBroth);
  if (j < 0 || rnd() > 0.08) return false;
  S.fl[j * NF + F_SODA] += SODA_POWER;
  S.setCell(i, EMPTY);
  return true;
}

// Soda meets acid in the liquid: both are used up, with fizz where there's a lot of acid at once.
// Leftover soda with nothing to react with tastes soapy.
function neutralize(S, x, y, i) {
  const o = i * NF, soda = S.fl[o + F_SODA], sour = S.fl[o + F_SOUR];
  if (sour > 0.01) {
    const r = Math.min(soda, sour);
    S.fl[o + F_SODA] -= r; S.fl[o + F_SOUR] -= r;
    if (r > 0.1) {   // fizzing: foam in proportion to how much reacted
      for (let k = 0; k < Math.min(14, r * 12); k++) {
        const fx = x + rint(9) - 4, fy = y - rint(8);
        if (fx >= 0 && fx < GW && fy >= 0) { const fi = fy * GW + fx; if (S.mat[fi] === EMPTY) S.setCell(fi, FOAM); }   // foam rises into the air, never eats the liquid
      }
      S.discover('fizz'); S.emit('fizz', x, y, 60);
    }
  }
}

function burn(S, x, y, i) {
  S.setCell(i, BURNT, S.temp[i]);
  if (y > 0 && S.mat[i - GW] === EMPTY) S.setCell(i - GW, SMOKE, 200);
  S.addNote('burnt', 0.02); S.addNote('smoky', 0.01);
  const j = S.findNb(x, y, isLiquid);
  if (j >= 0) S.addFlavor(j, BURNT_TASTE);
  S.discover('burn'); S.emit('burn', x, y, 90);
}

function reactChunk(S, x, y, i, m) {
  let t = S.temp[i];
  const M = MAT[m];
  // Watery vegetables steam off their water before they can get really hot: they sit near 110°C while
  // moist, and only climb toward the pan's temperature as they brown (dry out). So stirring fresh food
  // down onto the metal cools it, and an unstirred bottom layer is the one that dries out and chars.
  if ((m === ONION || m === CARROT || m === CELERY) && S.cook[i] < 230) {
    const cap = 110 + Math.max(0, S.cook[i] - MOIST_K.dryFrom) * MOIST_K.slope;
    if (t > cap) { t = cap + (t - cap) * MOIST_K.pass; S.temp[i] = t; }
  }
  let wet = S.findNb(x, y, isBroth);
  let oily = wet < 0 ? S.findNb(x, y, isOil) : -1;
  // Inside a piece, cells take the whole piece's surroundings (the middle of an onion in soup is not 'dry').
  const env = S.body[i] ? S.bodyEnv[S.body[i]] : -1;
  const pieceWet = env === 2 || wet >= 0, pieceOily = !pieceWet && (env === 1 || oily >= 0);
  let c = S.cook[i];

  // Leach flavor into surrounding liquid.
  // (Raw starch stays mostly locked in until the piece softens.)
  if (M.leach && t > 50 && S.life[i] > 0 && rnd() < 0.06 && !(M.starch && c < 60 && rnd() < 0.8)) {
    const j = wet >= 0 ? wet : oily;
    if (j >= 0) {
      if (m === HERB && c >= 120) { /* fully wilted herbs have nothing left */ }
      else {
        // Release slows as the piece gives up its flavor (proportional to what's left in it).
        // Golden (from ~120) ramps up to fully browned (~170): browned food gives more and better flavor.
        const gold = Math.max(0, Math.min(1, (c - 120) / 50));
        const browned = (1 + gold) * (S.life[i] / 255);
        const intoOil = S.mat[j] === OIL;
        if (intoOil) {
          // Fat pulls out aromatics, but barely any of the water-soluble savoriness.
          const o = j * NF;
          for (let k = 0; k < NF; k++) S.fl[o + k] += M.leach[k] * browned * LEACH_K * (k === F_AROMA ? 0.3 : 0.03);
        } else S.addFlavor(j, M.leach, browned * LEACH_K);
        // Browned food gives up the good stuff: sweetness, savoriness and roasty aroma.
        if (gold > 0) { const o = j * NF, left = S.life[i] / 255 * gold; S.fl[o + F_BROWN] += 0.05 * left; S.fl[o + F_SWEET] += 0.025 * left; S.fl[o + F_UMAMI] += 0.02 * left; S.fl[o + F_AROMA] += 0.04 * left; }
        if (!intoOil || rnd() < 0.2) S.life[i] -= 1;   // frying barely depletes it: the flavor waits for the broth
        if (M.note) S.addNote(M.note, 0.0008);
      }
    }
  }

  // An overcooked potato falls apart and melts into the soup, thickening it.
  if (M.collapse && S.cook[i] >= 170 && pieceWet && rnd() < 0.01) {
    const o = i * NF; S.setCell(i, BROTH, t); S.fl[o + F_BODY] = 5; S.fl[o + F_UMAMI] = 0.05; S.flags.thick = (S.flags.thick || 0) + 1; if (S.flags.thick > 25) S.discover('thicken');
    return true;
  }
  // Sizzling on a hot pan perfumes the kitchen even with no liquid to carry it.
  if (M.note && t > 100 && !pieceWet && rnd() < 0.02) S.addNote(M.note, 0.002);

  // Cooking progression.
  // Herbs wilt from ~65°C over tens of seconds; an actively bubbling simmer finishes them off ~4× faster.
  if (m === HERB && t > 65 && c < 255 && rnd() < (t - 60) / 600 * (pieceWet && S.turb > 0.1 ? 4 : 1)) c++;
  if (pieceWet && t > 85 && M.starch) {
    // Starchy things cook through (al dente around 80), then keep going: soft, then collapsing or mushy.
    if (c < 255 && rnd() < M.soften * (c < 80 ? 1 : 0.35)) c++;
  } else if (pieceWet && t > 85) {
    if (c < 110 && rnd() < 0.15) c++;               // simmered soft
  } else if ((m === ONION || m === CARROT || m === CELERY) && !pieceWet && t > 75) {
    // Watery vegetables out of the broth: sweat soft first, then brown slowly toward caramelized.
    // Both go faster on a hotter pan (and the hold-down above keeps them from racing ahead while moist).
    if (c < 120) { if (rnd() < (m === ONION ? CARAMEL_K.onionSweat : CARAMEL_K.sweat) * Math.min(2.5, (t - 75) / 40)) c++; }
    else if (c < BROWN_MAX && t > 105 && rnd() < (t - 100) / 60 * (M.brownRate || 0.25) * (m === ONION ? CARAMEL_K.onion : CARAMEL_K.fat)) c++;
  } else if (pieceOily && t > 75 && t <= 125 && c < 120) {
    if (rnd() < (m === ONION ? CARAMEL_K.onionSweat : CARAMEL_K.sweat)) c++;   // sweating in fat
  } else if (pieceOily && t > 105 && t <= 125) {
    // Then slowly caramelising in the fat: the patient path. (Hotter, dry browning below is fast but burns.)
    if (c < BROWN_MAX && rnd() < (t - 100) / 60 * (M.brownRate || 0.25) * (m === ONION ? CARAMEL_K.onion : CARAMEL_K.fat)) c++;
  } else if (!pieceWet && t > 120 && !(m === BREAD && insideLoaf(S, x, y))) {
    if (c < BROWN_MAX && rnd() < (t - 110) / 60 * (M.brownRate || 0.25)) c++;   // browning (only when dry; bread only on its crust)
  }
  if (m === HERB && c >= 120 && S.cook[i] < 120) S.discover('herbloss');
  if (c >= 80 && S.cook[i] < 80 && pieceOily && m !== MEAT && m !== HERB) S.discover('sweat');
  if (c >= 150 && S.cook[i] < 150) {
    // One browned sliver isn't caramelized onions: it takes a good share of the batch.
    if (m === ONION || m === CARROT || m === GARLIC) { S.flags.caramel = (S.flags.caramel || 0) + 1; S.addNote('caramel', 0.03); }
    else if (m === FISH || m === FISHFIN) { S.discover('crispyskin'); S.addNote('toasty', 0.02); }
    else if (m === BREAD) { S.discover('crust'); S.addNote('toasty', 0.02); }
    else S.addNote('toasty', 0.02);
  }
  S.cook[i] = c;
  if (c >= 170) S.body[i] = 0;   // deeply cooked pieces fall apart

  // Searing meat on the dry pot bottom leaves fond; so do deeply caramelized onions, more slowly.
  if ((m === MEAT || (m === ONION && c >= 150)) && y === GH - 1 && !pieceWet && t > (m === MEAT ? 140 : 115)) {
    S.fond[x] = Math.min(1, S.fond[x] + (m === MEAT ? 0.004 : 0.0015));
    S.emit('sizzle', x, y, 50);
    if (S.fond[x] > 0.3) S.discover('fond');
  }
  // Burning builds up from contact with the hot metal (or smoking-hot oil), not from merely being hot.
  // Each scorch pushes the piece further; stirring spreads the contact around so nothing gets enough.
  if (!pieceWet && t > M.burnAt && (y === GH - 1 || pieceOily) && rnd() < 0.0003 * (t - M.burnAt + 5)) {
    if (c >= 250) { burn(S, x, y, i); return true; }
    S.cook[i] = Math.min(255, Math.max(c, 190) + 4);
  }
  return false;
}

// A baked cell surrounded by more loaf on all sides is crumb, not crust: it doesn't brown.
function insideLoaf(S, x, y) {
  const i = y * GW + x, m = S.mat;
  const c = (j) => m[j] === BREAD || m[j] === DOUGH;
  return y > 0 && y < GH - 1 && x > 0 && x < GW - 1 && c(i - GW) && c(i + GW) && c(i - 1) && c(i + 1);
}

function reactTomato(S, x, y, i) {
  if (S.temp[i] > 85 && rnd() < 0.01) {
    const t = S.temp[i];
    S.setCell(i, BROTH, t);
    S.addFlavor(i, TOMATO_MELT);
    S.discover('tomato');
    return true;
  }
  return false;
}

// Named combos, checked once a second.
Sim.checkCombos = function () {
  let onion = 0, carrot = 0, celery = 0;
  for (let i = 0; i < N; i++) {
    const m = this.mat[i];
    if (this.cook[i] < 60) continue;
    if (m === ONION) onion++; else if (m === CARROT) carrot++; else if (m === CELERY) celery++;
  }
  if (onion > 8 && carrot > 8 && celery > 8 && !this.flags.mirepoix) {
    this.flags.mirepoix = true;
    this.addNote('earthy', 0.1); this.addNote('allium', 0.1); this.addNote('herbal', 0.05);
    this.discover('mirepoix');
  }
};

// ---------------- Rendering ----------------

function lerpC(c, t, r, g, b) {
  if (t <= 0) return;
  if (t > 1) t = 1;
  c[0] += (r - c[0]) * t; c[1] += (g - c[1]) * t; c[2] += (b - c[2]) * t;
}

Sim.render = function (data) {
  const { mat, temp, cook, life, shade, fl } = this;
  const c = [0, 0, 0];
  const flick = this.frame;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x, m = mat[i], p = i * 4;
      if (m === EMPTY) { data[p + 3] = 0; continue; }
      const M = MAT[m], sh = (shade[i] & 15) - 8;
      let a = 255;
      if (m === BROTH) {
        const o = i * NF;
        c[0] = 128; c[1] = 184; c[2] = 226;
        lerpC(c, fl[o + F_GOLD] * 0.5 + fl[o + F_RICH] * 0.12, 232, 186, 70);
        lerpC(c, fl[o + F_RED] * 0.35, 196, 52, 36);
        lerpC(c, fl[o + F_BROWN] * 0.3 + fl[o + F_UMAMI] * 0.05, 128, 70, 30);
        lerpC(c, fl[o + F_WHITE] * 0.4 + fl[o + F_BODY] * 0.08, 246, 240, 226);
        lerpC(c, fl[o + F_BITTER] * 0.4, 60, 50, 40);
        a = 200 + Math.min(55, (fl[o + F_BODY] + fl[o + F_WHITE] + fl[o + F_RED]) * 30);
        // Surface highlight.
        if (y > 0 && mat[i - GW] === EMPTY) lerpC(c, 0.35, 255, 255, 255);
      } else if (m === OIL) {
        c[0] = 236; c[1] = 196; c[2] = 70;
        if (temp[i] > 160) lerpC(c, ((flick + x) & 7) / 20, 255, 240, 160);
        a = 225;
      } else if (m === STEAM || m === SMOKE) {
        c[0] = M.col[0]; c[1] = M.col[1]; c[2] = M.col[2];
        const inLiq = y > 0 && CLS[mat[i - GW]] === C_LIQUID;
        a = inLiq ? 235 : m === SMOKE ? Math.min(200, life[i] * 4) : Math.min(140, life[i] * 3);
      } else if (m === FIRE) {
        const f = (life[i] + ((flick + x * 7) & 15)) & 31;
        if (f < 10) { c[0] = 255; c[1] = 230; c[2] = 120; }
        else if (f < 22) { c[0] = 255; c[1] = 150; c[2] = 30; }
        else { c[0] = 220; c[1] = 60; c[2] = 20; }
      } else {
        c[0] = M.col[0]; c[1] = M.col[1]; c[2] = M.col[2];
        const k = cook[i];
        if (m === DOUGH) doughColor(this, i, c);
        if (m === BREAD && (shade[i] & 15) < 3 && k < 170) { c[0] *= 0.82; c[1] *= 0.8; c[2] *= 0.76; }   // crumb with air pockets
        if (M.alpha) a = M.alpha;
        if (M.stops) {
          const st = M.stops;
          for (let q = 1; q < st.length; q++) if (k <= st[q][0] || q === st.length - 1) {
            const [k0, c0] = st[q - 1], [k1, c1] = st[q], u = Math.max(0, Math.min(1, (k - k0) / (k1 - k0)));
            c[0] = c0[0] + (c1[0] - c0[0]) * u; c[1] = c0[1] + (c1[1] - c0[1]) * u; c[2] = c0[2] + (c1[2] - c0[2]) * u;
            break;
          }
        } else if (M.col2) {
          if (k < 150) lerpC(c, k / 150 * 0.5, M.col2[0], M.col2[1], M.col2[2]);
          else lerpC(c, 0.5 + (k - 150) / 100, M.col2[0], M.col2[1], M.col2[2]);
          if (k > 200) lerpC(c, (k - 200) / 70, 40, 28, 22);
        }
        // Chunky 3D-ish shading: lit top edge, shadowed bottom edge.
        if (CLS[m] === C_CHUNK) {
          const b = this.body[i];
          const same = (j) => b ? this.body[j] === b : mat[j] === m;
          const up = y > 0 && same(i - GW), dn = y < GH - 1 && same(i + GW);
          if (!up) lerpC(c, 0.3, 255, 255, 255);        // lit top edge
          else if (!dn) lerpC(c, 0.22, 60, 40, 30);     // shaded underside
        }
      }
      data[p] = c[0] + sh; data[p + 1] = c[1] + sh; data[p + 2] = c[2] + sh; data[p + 3] = a;
    }
  }
};
