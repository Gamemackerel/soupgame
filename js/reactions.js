// Cooking chemistry: per-cell reaction rules, combo detection, and sim rendering.
// Sim.react returns true when the cell changed or moved and should skip movement this frame.

const isBroth = (m) => m === BROTH;
const isOil = (m) => m === OIL;
const isLiquid = (m) => CLS[m] === C_LIQUID;
const isEmpty = (m) => m === EMPTY;
const isFire = (m) => m === FIRE;

const TOMATO_MELT = flavorVec({ sour: 5, umami: 7, red: 10, sweet: 2, body: 1.5 });
const LEACH_K = 2; // how strongly chunks flavor the soup
const BURNT_TASTE = flavorVec({ bitter: 0.6, brown: 0.8 });

Sim.react = function (x, y, i, m) {
  switch (m) {
    case BROTH: return reactBroth(this, x, y, i);
    case OIL: return reactOil(this, x, y, i);
    case EGG: case YOLK: return reactEgg(this, x, y, i, m);
    case SALT: case SUGAR: return reactSeasoning(this, x, y, i, m);
    case CHILI: case CUMIN: return reactSpice(this, x, y, i, m);
    case FLOUR: return reactFlour(this, x, y, i);
    case ROUX: return reactRoux(this, x, y, i);
    case LUMP: return reactLump(this, x, y, i);
    case SODA: return reactSoda(this, x, y, i);
    case TOMATO: return reactChunk(this, x, y, i, m) || reactTomato(this, x, y, i);
    case ONION: case GARLIC: case CARROT: case CELERY: case MEAT: case HERB:
    case FISH: case FISHFIN: case FISHEYE: case WHITE_COOKED: case YOLK_COOKED:
      return reactChunk(this, x, y, i, m);
  }
  return false;
};

function reactBroth(S, x, y, i) {
  const o = i * NF, fl = S.fl, t = S.temp[i];
  // Deglazing needs every frame; the rarer reactions are checked on a rotating quarter of cells.
  if (y === GH - 1 && S.fond[x] > 0.02) return deglaze(S, x, i, o, fl, t);
  // Water touching very hot oil splatters (checked every frame: falling drops pass through fast).
  const ob = y < GH - 1 && S.mat[i + GW] === OIL ? i + GW : y > 0 && S.mat[i - GW] === OIL ? i - GW : -1;
  if (ob >= 0 && S.temp[ob] > 120 && rnd() < 0.4) return splatter(S, x, y, i, ob);
  if ((S.frame + i) & 3) return false;
  const j = S.nb(x, y);
  if (j >= 0) {
    const mj = S.mat[j];
    if (mj === OIL && S.temp[j] > 120 && rnd() < 0.8) return splatter(S, x, y, i, j);
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
    const acid = fl[o + F_SOUR] > 0.25 * fl[o + F_WHITE] + 0.1;
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
  fl[o + F_UMAMI] += f * 2.5; fl[o + F_BROWN] += f * 3; fl[o + F_AROMA] += f * 2; fl[o + F_RICH] += f * 0.5;
  S.fond[x] = 0;
  S.addNote('toasty', f * 0.15);
  S.flags.deglazed = (S.flags.deglazed || 0) + f;
  if (S.flags.deglazed > 1) S.discover('deglaze');
  if (t > 90) S.emit('hiss', x, GH - 1, 30);
  return false;
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
  if (t > 190 && y > 0 && S.mat[i - GW] === EMPTY) {
    if (t > 205 && rnd() < 0.02) {
      S.setCell(i - GW, FIRE, 300);
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

function reactSeasoning(S, x, y, i, m) {
  const j = S.findNb(x, y, isBroth);
  if (j >= 0) {
    if (rnd() < 0.02 * (1 + S.temp[j] / 40) * (S.stirT[i] ? 3 : 1)) {
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
  if (inOil >= 0 && t > 120 && S.cook[i] < 250) {
    S.cook[i] = Math.min(255, S.cook[i] + 2);
    if (S.cook[i] >= 60) { S.discover('bloom'); S.addNote('spice', 0.002); S.emit('sizzle', x, y, 60); }
  }
  if (t > MAT[m].burnAt && rnd() < 0.01) { burn(S, x, y, i); return true; }
  // Dissolve: quickly into broth, slowly into oil (heat travels in fat).
  const j = S.findNb(x, y, isLiquid);
  if (j >= 0) {
    const intoOil = S.mat[j] === OIL;
    if (rnd() < (intoOil ? 0.004 : 0.02) * (S.stirT[i] ? 3 : 1)) {
      const bloomed = S.cook[i] >= 60 && S.cook[i] < 200;
      const vec = MAT[m].solu, o = j * NF;
      for (let k = 0; k < NF; k++) {
        let v = vec[k];
        if (k === F_AROMA && bloomed) v *= 2.8;
        if (k === F_HEAT && intoOil) v *= 1.5;
        S.fl[o + k] += v;
      }
      S.addNote('spice', 0.004);
      S.setCell(i, EMPTY);
      return true;
    }
  }
  return false;
}

function reactFlour(S, x, y, i) {
  if (S.findNb(x, y, isOil) >= 0 && S.temp[i] > 80 && rnd() < 0.05) {
    S.setCell(i, ROUX, S.temp[i]); S.discover('roux'); return true;
  }
  const j = S.findNb(x, y, isBroth);
  if (j >= 0 && rnd() < 0.03) {
    if (S.temp[j] > 60 && !S.stirT[i]) {
      S.setCell(i, LUMP, S.temp[j]); S.discover('lumps');
    } else {
      // Cold or well-stirred: disperses as a slurry.
      S.fl[j * NF + F_BODY] += 0.8; S.fl[j * NF + F_BITTER] += 0.03;
      S.setCell(i, EMPTY);
    }
    return true;
  }
  return false;
}

function reactRoux(S, x, y, i) {
  const t = S.temp[i];
  if (t > 110 && S.cook[i] < 255 && rnd() < 0.3) S.cook[i]++;
  if (t > MAT[ROUX].burnAt && rnd() < 0.01) { burn(S, x, y, i); return true; }
  const j = S.findNb(x, y, isBroth);
  if (j >= 0 && S.temp[j] > 70 && rnd() < 0.03 * (S.stirT[i] ? 3 : 1)) {
    const c = S.cook[i] / 255, o = j * NF;
    S.fl[o + F_BODY] += 1.8 * (1 - c * 0.5);
    S.fl[o + F_RICH] += 0.3;
    S.fl[o + F_BROWN] += c * 1.5;
    S.fl[o + F_AROMA] += c * 0.8;
    if (c > 0.3) S.addNote('toasty', 0.003);
    S.flags.thick = (S.flags.thick || 0) + 1;
    if (S.flags.thick > 40) S.discover('thicken');
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

function reactSoda(S, x, y, i) {
  const j = S.findNb(x, y, isBroth);
  if (j < 0 || rnd() > 0.05) return false;
  const o = j * NF;
  if (S.fl[o + F_SOUR] > 0.08) {
    S.fl[o + F_SOUR] = Math.max(0, S.fl[o + F_SOUR] - 1.5);
    S.fl[o + F_BITTER] += 0.05;
    S.setCell(i, FOAM);
    for (let k = 0; k < 14; k++) {
      const fx = x + rint(9) - 4, fy = y - rint(8);
      if (fx >= 0 && fx < GW && fy >= 0) {
        const fi = fy * GW + fx;
        if (S.mat[fi] === EMPTY || S.mat[fi] === BROTH) S.setCell(fi, FOAM);
      }
    }
    S.discover('fizz'); S.emit('fizz', x, y, 60);
  } else {
    S.fl[o + F_BITTER] += 0.25; // soapy
    S.setCell(i, EMPTY);
  }
  return true;
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
  const t = S.temp[i], M = MAT[m];
  let wet = S.findNb(x, y, isBroth);
  let oily = wet < 0 ? S.findNb(x, y, isOil) : -1;
  // Inside a piece, cells take the whole piece's surroundings (the middle of an onion in soup is not 'dry').
  const env = S.body[i] ? S.bodyEnv[S.body[i]] : -1;
  const pieceWet = env === 2 || wet >= 0, pieceOily = !pieceWet && (env === 1 || oily >= 0);
  let c = S.cook[i];

  // Leach flavor into surrounding liquid.
  if (M.leach && t > 50 && S.life[i] > 0 && rnd() < 0.06) {
    const j = wet >= 0 ? wet : oily;
    if (j >= 0) {
      if (m === HERB && c >= 40) { /* wilted herbs have nothing left */ }
      else {
        const browned = c >= 150 ? 2 : 1;
        if (S.mat[j] === OIL) {
          // Fat pulls out aromatics, but barely any of the water-soluble savoriness.
          const o = j * NF;
          for (let k = 0; k < NF; k++) S.fl[o + k] += M.leach[k] * browned * LEACH_K * (k === F_AROMA ? 0.3 : 0.03);
        } else S.addFlavor(j, M.leach, browned * LEACH_K);
        if (browned > 1) { S.fl[j * NF + F_BROWN] += 0.05; S.fl[j * NF + F_SWEET] += 0.04; }
        S.life[i] -= 1;
        if (M.note) S.addNote(M.note, 0.0008);
      }
    }
  }

  // Sizzling on a hot pan perfumes the kitchen even with no liquid to carry it.
  if (M.note && t > 100 && !pieceWet && rnd() < 0.02) S.addNote(M.note, 0.002);

  // Cooking progression.
  if (pieceWet && t > 85) {
    if (c < 110 && rnd() < 0.15) c++;               // simmered soft
    if (m === HERB && c < 255 && rnd() < 0.3) c++;  // herbs wilt in heat
  } else if (pieceOily && t > 90 && t <= 125) {
    if (c < 120 && rnd() < 0.3) c++;                // sweating in fat
  } else if (!pieceWet && t > 120) {
    if (c < 255 && rnd() < (t - 110) / 60 * (M.brownRate || 0.25)) c++;   // browning (only when dry)
  }
  if (m === HERB && c >= 40 && S.cook[i] < 40) S.discover('herbloss');
  if (c >= 80 && S.cook[i] < 80 && pieceOily && m !== MEAT && m !== HERB) S.discover('sweat');
  if (c >= 150 && S.cook[i] < 150) {
    if (m === ONION) { S.discover('caramelize'); S.addNote('caramel', 0.03); }
    else if (m === FISH || m === FISHFIN) { S.discover('crispyskin'); S.addNote('toasty', 0.02); }
    else S.addNote('toasty', 0.02);
  }
  S.cook[i] = c;
  if (c >= 170) S.body[i] = 0;   // deeply cooked pieces fall apart

  // Searing meat on the dry pot bottom leaves fond.
  if (m === MEAT && y === GH - 1 && !pieceWet && t > 140) {
    S.fond[x] = Math.min(1, S.fond[x] + 0.004);
    S.emit('sizzle', x, y, 50);
    if (S.fond[x] > 0.3) S.discover('fond');
  }
  // Burning.
  if (!pieceWet && t > M.burnAt && rnd() < 0.004 * (t - M.burnAt + 5)) {
    if (c >= 200) { burn(S, x, y, i); return true; }
    S.cook[i] = Math.max(c, 200);
  }
  return false;
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
