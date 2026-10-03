// Falling-sand simulation core: grid state, movement, heat, diffusion, pouring, stirring.
// Reactions live in reactions.js (Sim.react). Grid y=0 is the pot rim, y=GH-1 the bottom.

const N = GW * GH;
const CLS = new Uint8Array(64), DENS = new Float32Array(64), COND = new Float32Array(64);
for (const m of MAT) if (m) { CLS[m.id] = m.cls; DENS[m.id] = m.dens; COND[m.id] = m.cond; }

const Sim = {
  mat: new Uint8Array(N), temp: new Float32Array(N), cook: new Uint8Array(N),
  life: new Uint8Array(N), shade: new Uint8Array(N), stamp: new Uint8Array(N),
  stirT: new Uint8Array(N), fl: new Float32Array(N * NF),
  body: new Uint16Array(N), nextBody: 1, bodyVel: new Map(), bodyKind: new Uint8Array(65536),
  bodyEnv: new Uint8Array(65536),                      // 0 dry, 1 in oil, 2 in broth
  bodyPart: new Uint8Array(N), bodyShape: new Map(),   // rotation: which template cell each grid cell is
  fond: new Float32Array(GW),
  panT: 20, dial: 0, lid: false, frame: 0, tag: 1,
  notes: {}, discovered: new Set(), events: [], particles: [],
  bubbles: 0, lastEmit: {}, flags: {}, turb: 0, swirl: 0, surface: GH,
  pushBodies: new Set(), pushDir: null,
};

function rnd() { return Math.random(); }
function rint(n) { return (Math.random() * n) | 0; }

// Piece kinds: how a piece holds together.
const BK_FIRM = 0, BK_SOFT = 1, BK_SHELL = 2, BK_FISH = 3;

Sim.newBody = function (kind = BK_FIRM) {
  this.nextBody = this.nextBody >= 65000 ? 1 : this.nextBody + 1;
  this.bodyKind[this.nextBody] = kind;
  this.bodyVel.delete(this.nextBody);
  this.bodyShape.delete(this.nextBody);
  return this.nextBody;
};

Sim.reset = function () {
  this.mat.fill(0); this.temp.fill(20); this.cook.fill(0); this.life.fill(0);
  this.stirT.fill(0); this.fl.fill(0); this.fond.fill(0); this.body.fill(0); this.bodyVel.clear(); this.bodyShape.clear(); this.bodyPart.fill(0);
  this.panT = 20; this.notes = {}; this.particles = []; this.flags = {};
  this.turb = 0; this.swirl = 0; this.surface = GH;
};

Sim.setCell = function (i, m, t) {
  this.mat[i] = m;
  this.temp[i] = t === undefined ? 20 : t;
  this.cook[i] = 0;
  const c = CLS[m];
  this.life[i] = c === C_CHUNK ? 255 : m === STEAM ? 80 : m === SMOKE ? 50 :
                 m === FIRE ? 14 + rint(22) : m === FOAM ? 160 + rint(90) : 0;
  this.shade[i] = rint(256);
  this.body[i] = 0;
  this.bodyPart[i] = 0;
  this.fl.fill(0, i * NF, i * NF + NF);
  this.stamp[i] = this.tag;
};

Sim.swap = function (i, j) {
  const { mat, temp, cook, life, shade, fl } = this;
  let t;
  t = mat[i]; mat[i] = mat[j]; mat[j] = t;
  t = temp[i]; temp[i] = temp[j]; temp[j] = t;
  t = cook[i]; cook[i] = cook[j]; cook[j] = t;
  t = life[i]; life[i] = life[j]; life[j] = t;
  t = shade[i]; shade[i] = shade[j]; shade[j] = t;
  t = this.body[i]; this.body[i] = this.body[j]; this.body[j] = t;
  t = this.bodyPart[i]; this.bodyPart[i] = this.bodyPart[j]; this.bodyPart[j] = t;
  const a = i * NF, b = j * NF;
  for (let k = 0; k < NF; k++) { t = fl[a + k]; fl[a + k] = fl[b + k]; fl[b + k] = t; }
  this.stamp[i] = this.stamp[j] = this.tag;
};

Sim.discover = function (id) {
  if (this.discovered.has(id)) return;
  this.discovered.add(id);
  this.events.push({ t: 'discover', id });
};

// Throttled event for chef reactions / sounds.
Sim.emit = function (t, x, y, gap = 40) {
  if (this.frame - (this.lastEmit[t] || -999) < gap) return;
  this.lastEmit[t] = this.frame;
  this.events.push({ t, x, y });
};

Sim.addNote = function (n, a) {
  this.notes[n] = Math.min(1.5, (this.notes[n] || 0) + a);
};

Sim.addFlavor = function (i, vec, scale = 1) {
  const o = i * NF;
  for (let k = 0; k < NF; k++) this.fl[o + k] += vec[k] * scale;
};

// Random 4-neighbour index, or -1 if out of bounds.
Sim.nb = function (x, y) {
  switch (rint(4)) {
    case 0: return y > 0 ? (y - 1) * GW + x : -1;
    case 1: return y < GH - 1 ? (y + 1) * GW + x : -1;
    case 2: return x > 0 ? y * GW + x - 1 : -1;
    default: return x < GW - 1 ? y * GW + x + 1 : -1;
  }
};

// First 4-neighbour whose material satisfies pred, or -1.
Sim.findNb = function (x, y, pred) {
  const i = y * GW + x, m = this.mat;
  if (y > 0 && pred(m[i - GW])) return i - GW;
  if (y < GH - 1 && pred(m[i + GW])) return i + GW;
  if (x > 0 && pred(m[i - 1])) return i - 1;
  if (x < GW - 1 && pred(m[i + 1])) return i + 1;
  return -1;
};

Sim.particle = function (p) {
  if (this.particles.length < 400) this.particles.push(p);
};

// ---------------- Movement ----------------

// Air, gas and foam: things fall straight through these.
function isOpen(m) { const c = CLS[m]; return m === EMPTY || c === C_GAS || c === C_FOAM; }

// Per-frame chance that something of density d trades places with liquid of density dl.
// Small differences settle slowly, so veg drifts down and oil beads up rather than snapping into layers.
function settleP(d, dl) { return Math.min(0.6, Math.abs(d - dl) * 2.5); }

// Mixing energy at a cell: boiling churn (hot cells only) plus recent stirring.
function energyAt(i) {
  return Sim.turb * (Sim.temp[i] > 85 ? 1 : 0.2) + (Sim.stirT[i] ? 0.6 : 0) + Math.abs(Sim.swirl) * 0.4;
}

// Random churn move through liquid: biased upward/sideways (bubbles lift), sometimes down.
function churn(x, y, i, down) {
  const S = Sim, r = rnd();
  let dx = 0, dy = 0;
  if (r < down) dy = 1 + rint(2);
  else if (r < down + (1 - down) * 0.45) dy = -1 - rint(2);
  else dx = (rnd() < 0.5 ? -1 : 1) * (1 + rint(3));
  const nx = x + dx, ny = y + dy;
  if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) return false;
  const j = ny * GW + nx;
  if (CLS[S.mat[j]] !== C_LIQUID || S.mat[j] === S.mat[i]) return false;
  S.swap(i, j);
  return true;
}

function moveGrain(x, y, i, m, diagP) {
  const S = Sim, mat = S.mat, d = DENS[m];
  const below = y < GH - 1 ? i + GW : -1, mb = below >= 0 ? mat[below] : EMPTY;
  const above = y > 0 ? i - GW : -1, ma = above >= 0 ? mat[above] : EMPTY;
  const submerged = CLS[ma] === C_LIQUID || CLS[mb] === C_LIQUID ||
                    (x > 0 && CLS[mat[i - 1]] === C_LIQUID) || (x < GW - 1 && CLS[mat[i + 1]] === C_LIQUID);
  // Moving liquid carries solids around: keeps them suspended and spreads them out.
  if (submerged) {
    const e = energyAt(i);
    if (e > 0 && rnd() < e * 0.35 && churn(x, y, i, 0.12)) return;
  }
  if (below >= 0) {
    if (isOpen(mb)) { S.swap(i, below); return; }
    if (CLS[mb] === C_LIQUID) {
      if (DENS[mb] < d) {
        if (rnd() < settleP(d, DENS[mb])) {
          // Sink, wobbling sideways a little as it goes.
          const dx = rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0, nx = x + dx;
          S.swap(i, nx >= 0 && nx < GW && CLS[mat[below + dx]] === C_LIQUID ? below + dx : below);
        }
        return;
      }
    } else if (rnd() < diagP) {
      const dx = rnd() < 0.5 ? -1 : 1, nx = x + dx;
      if (nx >= 0 && nx < GW) {
        const k = below + dx, mk = mat[k];
        if (isOpen(mk) || (CLS[mk] === C_LIQUID && DENS[mk] < d && rnd() < settleP(d, DENS[mk]))) { S.swap(i, k); return; }
      }
    }
  }
  // Buoyancy: lighter-than-liquid things float up.
  if (CLS[ma] === C_LIQUID && DENS[ma] > d) { if (rnd() < settleP(d, DENS[ma])) S.swap(i, above); return; }
  // Piles slump sideways under liquid instead of stacking into towers.
  if (submerged && below >= 0 && rnd() < 0.1) {
    const dx = rnd() < 0.5 ? -1 : 1, nx = x + dx;
    if (nx >= 0 && nx < GW && CLS[mat[i + dx]] === C_LIQUID && DENS[mat[i + dx]] < d) S.swap(i, i + dx);
  }
}

function moveLiquid(x, y, i, m) {
  const S = Sim, mat = S.mat, d = DENS[m];
  // Oil and egg get folded into the broth by boiling and stirring.
  if (m !== BROTH) {
    const e = energyAt(i);
    if (e > 0 && rnd() < e * 0.25 && churn(x, y, i, 0.45)) return;
  }
  if (y < GH - 1) {
    const j = i + GW, mj = mat[j];
    if (isOpen(mj)) { S.swap(i, j); return; }
    // Heavier liquid sinks through lighter liquid gradually (oil rises as beads, not instantly).
    if (CLS[mj] === C_LIQUID && DENS[mj] < d) { if (rnd() < settleP(d, DENS[mj]) * 1.2) S.swap(i, j); return; }
    const dx = rnd() < 0.5 ? -1 : 1, nx = x + dx;
    if (nx >= 0 && nx < GW) {
      const k = j + dx, mk = mat[k];
      if (mk === EMPTY || CLS[mk] === C_GAS) { S.swap(i, k); return; }
    }
  }
  // A rolling boil makes the surface heave: droplets jump up and fall back (or over the rim).
  if (m === BROTH && S.turb > 0.4 && S.temp[i] > 70 && (y === 0 || isOpen(mat[i - GW])) && rnd() < (S.turb - 0.4) * 0.05) {
    const up = 1 + rint(3);
    if (y - up < 0) { S.spill(i); return; }
    const j = i - up * GW;
    if (mat[j] === EMPTY) { S.swap(i, j); return; }
  }
  // Convection: hot liquid rises through cooler liquid of the same kind (broth rolls, oil shimmers).
  if (y > 0) {
    const j = i - GW;
    if (S.mat[j] === m && S.temp[i] > S.temp[j] + 2 && rnd() < 0.2) { S.swap(i, j); return; }
  }
  // Deep inside the liquid there's nowhere to flow sideways: skip the spreading work.
  if (y > 0 && CLS[mat[i - GW]] === C_LIQUID && DENS[mat[i - GW]] >= d && m === BROTH) return;
  // A lighter liquid on the surface (oil) spreads out over the broth into a thin film.
  if (DENS[m] < 1 && y < GH - 1 && CLS[mat[i + GW]] === C_LIQUID && rnd() < 0.5) {
    const dx = rnd() < 0.5 ? -1 : 1, nx = x + dx;
    if (nx >= 0 && nx < GW) {
      const k = i + dx, mk = mat[k];
      if (CLS[mk] === C_LIQUID && DENS[mk] > d && (y === 0 || CLS[mat[k - GW]] !== C_LIQUID || mat[k - GW] === m)) { S.swap(i, k); return; }
    }
  }
  // Spread sideways; thick soup flows slowly.
  const flow = m === BROTH ? 1 - Math.min(0.85, S.fl[i * NF + F_BODY] * 0.3) : m === OIL ? 0.9 : 0.5;
  if (rnd() < flow) {
    const dir = rnd() < 0.5 ? -1 : 1;
    const surfaceCell = y === 0 || isOpen(mat[i - GW]);
    const reach = Math.max(2, Math.round((m === BROTH ? 8 : m === OIL ? 6 : 3) * flow * (surfaceCell ? 2.5 : 1)));   // runny liquids level fast
    let t = -1;
    for (let k = 1; k <= reach; k++) {
      const nx = x + dir * k;
      if (nx < 0 || nx >= GW) break;
      const jj = i + dir * k, mm = mat[jj];
      if (mm === EMPTY || CLS[mm] === C_GAS) t = jj;
      else break;
    }
    if (t >= 0) S.swap(i, t);
  }
}

// Unit step (-1/0/1 each) along a rolling vortex that fills the liquid: along the floor one way,
// up the wall, back along the top, down the other wall. Components are picked probabilistically
// so slow directions still happen sometimes.
function swirlDir(x, y, cx, cy, ax, ay, dir) {
  const ux = (x - cx) / ax, uy = (y - cy) / ay;
  let vx = -uy * dir, vy = ux * dir;
  const L = Math.hypot(vx, vy);
  if (L < 0.05) return [rnd() < 0.5 ? -1 : 1, 0];
  vx /= L; vy /= L;
  return [rnd() < Math.abs(vx) ? Math.sign(vx) : 0, rnd() < Math.abs(vy) ? Math.sign(vy) : 0];
}

// Lasting whirlpool after a stir: swaps cells along ellipses around the middle of the liquid.
// The flows in the pot right now: the stirred whirlpool, plus rolling convection cells when it boils.
// Each is an ellipse that turns one way (s > 0) or the other.
Sim.flows = function () {
  const top = this.surface, depth = GH - top, out = [];
  if (depth < 4) return out;
  if (Math.abs(this.swirl) > 0.02) out.push({ cx: GW / 2, cy: top + depth / 2, ax: GW / 2, ay: depth / 2, s: this.swirl });
  // A rolling boil breaks into side-by-side rolls that wander and pulse.
  if (this.turb > 0.3) {
    const n = depth > 30 ? 3 : 2, w = GW / n, power = Math.min(1, (this.turb - 0.3) / 0.6);
    // The pattern slides across the pot and every so often the rolls reorganize and reverse,
    // so nothing stays trapped in one spot.
    const drift = Math.sin(this.frame * 0.005) * w * 0.5, flip = Math.sin(this.frame * 0.0035) >= 0 ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const f = this.frame * 0.012 + k * 2.1;
      out.push({ cx: w * (k + 0.5) + drift + Math.sin(f) * w * 0.25, cy: top + depth * (0.5 + Math.sin(f * 1.3) * 0.1),
                 ax: w * 0.6, ay: depth * 0.5, s: flip * (k % 2 ? 1 : -1) * power * (0.75 + 0.25 * Math.sin(f * 2.7)) });
    }
  }
  return out;
};

Sim.swirlPass = function () {
  if (Math.abs(this.swirl) < 0.02) this.swirl = 0;
  else this.swirl *= 0.996;   // ~3 s half-life: the pot keeps spinning after you stop
  const top = this.surface;
  this.flowList = this.flows();
  for (const v of this.flowList) {
    const dir = Math.sign(v.s), n = Math.abs(v.s) * v.ax * v.ay * 4 * 0.2;
    for (let k = 0; k < n; k++) {
      const x = Math.round(v.cx - v.ax + rnd() * v.ax * 2), y = Math.round(v.cy - v.ay + rnd() * v.ay * 2);
      if (x < 0 || x >= GW || y < top || y >= GH) continue;
      const i = y * GW + x, m = this.mat[i];
      if (m === EMPTY || CLS[m] === C_GAS || this.body[i] || m === DOUGH) continue;   // a ball of dough stays a ball
      const [vx, vy] = swirlDir(x, y, v.cx, v.cy, v.ax, v.ay, dir), step = 1 + rint(4);
      const tx = x + vx * step + rint(3) - 1, ty = y + vy * step;
      if (tx < 0 || tx >= GW || ty < top || ty >= GH) continue;
      const j = ty * GW + tx, mj = this.mat[j];
      if (mj === EMPTY || CLS[mj] === C_GAS || this.body[j] || mj === DOUGH) continue;
      this.swap(i, j);
      this.stirT[i] = this.stirT[j] = 20;
    }
  }
};

// ---------------- Overflow ----------------

// Rough display color of a cell (for things that leave the pot as particles).
Sim.cellRGB = function (i) {
  const m = this.mat[i], M = MAT[m];
  if (m === BROTH) {
    const o = i * NF, c = [128, 184, 226];
    lerpC(c, this.fl[o + F_RED] * 0.35, 196, 52, 36);
    lerpC(c, this.fl[o + F_BROWN] * 0.3, 128, 70, 30);
    lerpC(c, this.fl[o + F_WHITE] * 0.4, 246, 240, 226);
    return c;
  }
  return M.col.slice();
};

// A cell of liquid goes over the rim and runs down the outside of the pot.
Sim.spill = function (i) {
  const x = i % GW, left = x < GW / 2;
  this.particle({ x: left ? GX - 5 : GX + GW + 4, y: GY - 2, vx: left ? -0.3 : 0.3, vy: 0,
                  life: 200, max: 200, c: this.cellRGB(i), kind: 'spill' });
  this.setCell(i, EMPTY);
  this.spilled = (this.spilled || 0) + 1;
  this.emit('overflow', x, 0, 60);
};

// A brim-full pot sloshes over when it boils or swirls. Only when the liquid body itself reaches
// the rim: water still falling in from a pour passes through the top row and must not count.
Sim.overflowPass = function () {
  if (this.surface > 1) return;
  const slosh = 0.01 + this.turb * 0.12 + Math.abs(this.swirl) * 0.1;
  for (let x = 0; x < GW; x++) {
    const m = this.mat[x];
    if (CLS[m] === C_LIQUID && rnd() < slosh) this.spill(x);
  }
};

// A piece flung up out of the pot: it leaves as a little shower of bits that arc over the rim.
Sim.ejectBody = function (cells, v) {
  for (const i of cells) {
    const x = i % GW, y = (i / GW) | 0;
    if (rnd() < 0.6) this.particle({ x: GX + x, y: GY + y, vx: v.vx * 0.5 + (x < GW / 2 ? -1 : 1) * (0.8 + rnd()), vy: Math.min(-1.5, v.vy * 0.6),
                                     life: 120, max: 120, c: this.cellRGB(i), kind: 'drop' });
    this.setCell(i, EMPTY);
  }
  this.emit('overflow', 0, 0, 30);
};

// ---------------- Rigid chunk pieces ----------------

// Can piece b shift by (dx,dy)? Targets must be its own cells, liquid, or (when falling) open air.
function bodyCanMove(S, cells, b, dx, dy, free) {
  for (const i of cells) {
    const x = i % GW + dx, y = ((i / GW) | 0) + dy;
    if (x < 0 || x >= GW || y < 0 || y >= GH) return false;
    const j = y * GW + x, mj = S.mat[j];
    if (S.body[j] === b) continue;
    if (CLS[mj] === C_LIQUID) continue;
    if ((dy > 0 || free) && isOpen(mj)) continue;
    if (dy === 0 && isOpen(mj) && y < GH - 1 && !isOpen(S.mat[j + GW])) continue;
    return false;
  }
  return true;
}

function bodyMove(S, cells, dx, dy) {
  // Shift front-first so each cell swaps into space the displaced liquid just left.
  cells.sort((a, b) => ((b % GW) * dx + ((b / GW) | 0) * dy) - ((a % GW) * dx + ((a / GW) | 0) * dy));
  const off = dy * GW + dx;
  for (let k = 0; k < cells.length; k++) { S.swap(cells[k], cells[k] + off); cells[k] += off; }
}

function tryBody(S, cells, b, dx, dy, free) {
  if (!bodyCanMove(S, cells, b, dx, dy, free)) return false;
  bodyMove(S, cells, dx, dy);
  return true;
}

// Pieces carry momentum: the ladle and the whirlpool push them, liquid drags them back to rest,
// and in a dry pot they fly, bounce off the walls and skid across the floor.
Sim.moveBodies = function () {
  const groups = new Map(), mat = this.mat, body = this.body, vel = this.bodyVel;
  for (let i = 0; i < N; i++) {
    const b = body[i];
    if (!b) continue;
    if (CLS[mat[i]] !== C_CHUNK) { body[i] = 0; continue; }
    let g = groups.get(b);
    if (!g) groups.set(b, g = []);
    g.push(i);
  }
  for (const b of vel.keys()) if (!groups.has(b)) vel.delete(b);
  for (const b of this.bodyShape.keys()) if (!groups.has(b)) this.bodyShape.delete(b);
  const top = this.surface, depth = Math.max(1, GH - top), pcx = GW / 2, pcy = top + depth / 2;
  const sw = Math.abs(this.swirl);
  for (const [b, cells] of groups) {
    if (cells.length === 1) { body[cells[0]] = 0; continue; }   // a lone cell moves like a grain
    let sx = 0, sy = 0, d = 0, wet = 0, covered = 0, touching = 0, hot = 0, stirred = 0, liqD = 0, inBroth = 0;
    for (const i of cells) {
      const x = i % GW, y = (i / GW) | 0;
      sx += x; sy += y; d += DENS[mat[i]];
      if (this.temp[i] > 85) hot++;
      if (this.stirT[i]) stirred++;
      const below = y < GH - 1 ? mat[i + GW] : EMPTY, above = y > 0 ? mat[i - GW] : EMPTY;
      if (CLS[above] === C_LIQUID) covered++;
      if (CLS[below] === C_LIQUID || CLS[above] === C_LIQUID ||
          (x > 0 && CLS[mat[i - 1]] === C_LIQUID) || (x < GW - 1 && CLS[mat[i + 1]] === C_LIQUID)) touching++;
      if (CLS[below] === C_LIQUID) { wet++; liqD += DENS[below]; if (below === BROTH) inBroth++; }
      else if (CLS[above] === C_LIQUID) { wet++; liqD += DENS[above]; if (above === BROTH) inBroth++; }
    }
    this.bodyEnv[b] = !wet ? 0 : inBroth * 2 >= wet ? 2 : 1;
    const n = cells.length, cx = sx / n, cy = sy / n;
    d /= n;
    // Submerged pieces feel liquid drag; a piece sitting in a thin film of oil is basically in the air.
    const swimming = covered / n > 0.25;
    let v = vel.get(b);
    if (!v) vel.set(b, v = { vx: 0, vy: 0, ax: 0, ay: 0 });

    // Ladle hit: take on the stroke's speed. In a dry pot it's a smack that pops the piece up.
    if (this.pushBodies.has(b) && this.pushDir) {
      const p = this.pushDir, sp = Math.min(6, p.n + 1);
      v.w = (v.w || 0) + (rnd() - 0.5) * (swimming ? 0.15 : 0.5);
      if (swimming) { v.vx = p.x * sp * 0.9; v.vy = p.y * sp * 0.9; }
      else { v.vx = p.x * sp * 1.3 + (rnd() - 0.5); v.vy = Math.min(p.y * sp, 0) - 1.5 - rnd() * 1.5; }
    }
    // The whirlpool and boiling rolls push submerged pieces along their currents.
    if (swimming) for (const f of this.flowList || []) {
      const d2 = ((cx - f.cx) / f.ax) ** 2 + ((cy - f.cy) / f.ay) ** 2;
      if (d2 > 1.3) continue;
      const a = Math.abs(f.s);
      const [tx, ty] = swirlDir(cx, cy, f.cx, f.cy, f.ax, f.ay, Math.sign(f.s));
      v.vx += tx * a * 0.22 + (rnd() - 0.5) * a * 0.3;
      v.vy += ty * a * 0.22 + (rnd() - 0.5) * a * 0.3;
    }
    // Drag and buoyancy grow as the piece goes under, so a splash-down slows it right away.
    const immersed = touching / n;
    if (swimming) { v.vx *= 0.88; v.vy *= 0.88; }
    else { v.vy += 0.3 * (1 - immersed); const k = 1 - 0.45 * immersed; v.vx *= 0.97 * k; v.vy *= k; }

    // Integrate velocity in whole-cell steps, bouncing off whatever blocks us.
    v.ax += v.vx; v.ay += v.vy;
    let moved = false, cracked = false;
    for (let k = 0; k < 6 && (Math.abs(v.ax) >= 1 || Math.abs(v.ay) >= 1); k++) {
      const dx = Math.abs(v.ax) >= 1 ? Math.sign(v.ax) : 0, dy = Math.abs(v.ay) >= 1 ? Math.sign(v.ay) : 0;
      if (tryBody(this, cells, b, dx, dy, true)) { v.ax -= dx; v.ay -= dy; moved = true; continue; }
      if (dy < 0 && v.vy < -1.2 && cells.some((i) => i < GW)) { this.ejectBody(cells, v); cracked = true; break; }   // flung out of the pot
      if (dx && tryBody(this, cells, b, dx, 0, true)) { v.ax -= dx; moved = true; }
      else if (dx) { v.vx *= -0.45; v.ax = 0; }                       // bounce off a wall or piece
      if (dy && tryBody(this, cells, b, 0, dy, true)) { v.ay -= dy; moved = true; }
      else if (dy > 0 && this.bodyKind[b] === BK_SHELL && v.vy > 2.2) { this.crackEgg(b, cells, v); cracked = true; break; }
      else if (dy) {
        if (dy > 0 && !swimming) {   // land, skid, maybe bounce (off-center landings tip the piece)
          if (Math.abs(v.vy) > 1.2) v.w = (v.w || 0) + (rnd() - 0.5) * 0.25 + v.vx * 0.03;
          v.vx *= 0.75; v.vy = Math.abs(v.vy) > 1.2 ? -v.vy * 0.3 : 0;
        }
        else v.vy *= -0.3;
        v.ay = 0;
      }
    }
    if (cracked) continue;
    if (n >= 6 && this.bodyKind[b] !== BK_SOFT) this.spinBody(b, cells, v, swimming, moved, cx, cy, sw);
    if (Math.abs(v.vx) < 0.02 && Math.abs(v.vy) < 0.02 && !moved) { v.vx = v.vy = 0; }
    const kind = this.bodyKind[b];
    if (kind === BK_SOFT) {
      if (!this.softBody(b, cells, swimming, sw, cx, cy)) continue;
    } else if (kind === BK_FISH && this.bodyEnv[b] === 2 && rnd() < 0.01) {
      this.maybeFlake(b, cells);
    }
    if (moved || Math.hypot(v.vx, v.vy) > 0.4) continue;

    if (!wet && !swimming) {
      // Resting in a dry pot: slide off piles.
      if (rnd() < 0.3) { const dx = rnd() < 0.5 ? -1 : 1; tryBody(this, cells, b, dx, 1); }
      continue;
    }
    const dl = wet ? liqD / wet : 1;
    // Boiling churn and leftover stir energy: bob up, drift sideways, tumble.
    const e = this.turb * (hot / n > 0.5 ? 1 : 0.2) + (stirred / n > 0.3 ? 0.5 : 0) + sw;
    if (e > 0 && rnd() < e * 0.3) {
      const r = rnd();
      const ok = r < 0.45 ? tryBody(this, cells, b, 0, -1)
               : r < 0.9 ? tryBody(this, cells, b, rnd() < 0.5 ? -1 : 1, 0) || tryBody(this, cells, b, rnd() < 0.5 ? -1 : 1, -1)
               : tryBody(this, cells, b, 0, 1);
      if (ok) continue;
    }
    // Sink or float by density, slowly.
    const p = settleP(d, dl) * 0.7;
    if (rnd() < p) {
      const dy = d > dl ? 1 : -1;
      if (tryBody(this, cells, b, 0, dy)) continue;
      if (dy > 0 && rnd() < 0.4) tryBody(this, cells, b, rnd() < 0.5 ? -1 : 1, 1);
    } else if (rnd() < 0.03) {
      tryBody(this, cells, b, rnd() < 0.5 ? -1 : 1, 0);   // gentle drift
    }
  }
  this.pushBodies.clear();
};

// ---------------- Rotation ----------------
// Each larger piece remembers its shape (a template) and is re-rasterized at 16 angles,
// so it can tumble when smacked, spin in the whirlpool, and settle flat when it lands.

const ROT_STEP = Math.PI / 8;

Sim.shapeOf = function (b, cells) {
  let sh = this.bodyShape.get(b);
  if (sh && sh.count === cells.length) return sh;
  if (cells.length > 255) return null;
  // (Re)build the template from the piece as it is now: first use, or it melted/burnt a cell.
  let sx = 0, sy = 0;
  for (const i of cells) { sx += i % GW; sy += (i / GW) | 0; }
  const X = Math.round(sx / cells.length), Y = Math.round(sy / cells.length);
  const lookup = new Map(), mats = [];
  let r = 0, minx = 99, maxx = -99, miny = 99, maxy = -99;
  cells.forEach((i, k) => {
    mats.push(this.mat[i]);
    const ox = i % GW - X, oy = ((i / GW) | 0) - Y;
    lookup.set((ox + 512) * 1024 + oy + 512, k);
    this.bodyPart[i] = k;
    r = Math.max(r, Math.hypot(ox, oy));
    minx = Math.min(minx, ox); maxx = Math.max(maxx, ox); miny = Math.min(miny, oy); maxy = Math.max(maxy, oy);
  });
  const w = maxx - minx + 1, h = maxy - miny + 1;
  // Long pieces (a fish) rest on their side, flat every 180°; blocky ones every 90°.
  sh = { lookup, mats, count: cells.length, radius: Math.ceil(r) + 1, angle: 0, shown: 0,
         flat: w > h * 1.6 || h > w * 1.6 ? 2 : 4 };
  this.bodyShape.set(b, sh);
  return sh;
};

Sim.rotateBody = function (b, cells, sh, step, cx, cy) {
  const th = step * ROT_STEP, c = Math.cos(th), s = Math.sin(th);
  const { mat, temp, cook, life, shade, body, bodyPart } = this;
  const X = Math.round(cx), Y = Math.round(cy), R = sh.radius;
  const targets = new Map();
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    // Inverse-rotate each nearby grid cell back into the template to see which part lands there.
    const p = sh.lookup.get((Math.round(c * dx + s * dy) + 512) * 1024 + Math.round(-s * dx + c * dy) + 512);
    if (p === undefined) continue;
    const gx = X + dx, gy = Y + dy;
    if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) return false;
    const j = gy * GW + gx, mj = mat[j];
    if (body[j] !== b && !(CLS[mj] === C_LIQUID || isOpen(mj))) return false;   // would hit something solid
    targets.set(j, p);
  }
  if (targets.size < cells.length * 0.75) return false;
  // Remember each part's state (cook level, temperature…) so it survives the move.
  const state = new Map();
  for (const i of cells) state.set(bodyPart[i], [mat[i], temp[i], cook[i], life[i], shade[i], this.fl.slice(i * NF, i * NF + NF)]);
  const any = state.values().next().value;
  const vacated = cells.filter((i) => !targets.has(i));
  for (const j of targets.keys()) {
    if (body[j] === b) continue;
    const v = vacated.pop();                 // displaced liquid/air moves into the space we leave
    if (v !== undefined) this.swap(j, v); else this.setCell(j, EMPTY);
  }
  for (const v of vacated) this.setCell(v, EMPTY);
  for (const [j, p] of targets) {
    // A part hidden by the last raster comes back as itself (an eye stays an eye), warmed like its neighbours.
    const st = state.get(p) || [sh.mats[p], any[1], any[2], any[3], any[4], null];
    mat[j] = st[0]; temp[j] = st[1]; cook[j] = st[2]; life[j] = st[3]; shade[j] = st[4];
    if (st[5]) this.fl.set(st[5], j * NF); else this.fl.fill(0, j * NF, j * NF + NF);
    body[j] = b; bodyPart[j] = p; this.stamp[j] = this.tag;
  }
  sh.count = targets.size;
  return true;
};

Sim.spinBody = function (b, cells, v, swimming, moved, cx, cy, sw) {
  const sh = this.shapeOf(b, cells);
  if (!sh) return;
  // Pivot on where the piece is now (it may have just moved this frame).
  cx = 0; cy = 0;
  for (const i of cells) { cx += i % GW; cy += (i / GW) | 0; }
  cx /= cells.length; cy /= cells.length;
  let w = v.w || 0;
  if (swimming) {
    w += Math.sign(this.swirl) * sw * 0.0025 + (rnd() - 0.5) * this.turb * 0.04;   // whirlpool + boil churn
    w *= 0.92;
  } else {
    w *= 0.99;
    // Resting on something: gravity tips it over onto a flat side.
    if (!moved && !bodyCanMove(this, cells, b, 0, 1, true)) {
      w += -Math.sin(sh.flat * sh.angle) * 0.025;
      w *= 0.8;
    }
  }
  if (Math.abs(w) < 0.002) w = 0;
  v.w = w;
  sh.angle += w;
  const step = Math.round(sh.angle / ROT_STEP);
  if (step === sh.shown) return;
  // Try in place, then nudged up or sideways (a fish rolling on the floor lifts as it turns).
  for (const [ox, oy] of [[0, 0], [0, -1], [0, -2], [-1, -1], [1, -1], [0, -3], [-2, 0], [2, 0]]) {
    if (this.rotateBody(b, cells, sh, step, cx + ox, cy + oy)) { sh.shown = step; return; }
  }
  sh.angle = sh.shown * ROT_STEP; v.w = -w * 0.3;       // blocked: bounce the spin back
};

// ---------------- Eggs and fish ----------------

// Drop a shape (rows of legend characters) in at the rim as one piece.
Sim.spawnShape = function (rows, legend, x, vy, kind) {
  const b = this.newBody(kind), w = rows[0].length;
  const flip = rnd() < 0.5, x0 = Math.max(0, Math.min(GW - w, Math.round(x - w / 2)));
  let placed = 0;
  rows.forEach((row, yy) => {
    for (let xx = 0; xx < w; xx++) {
      const ch = row[flip ? w - 1 - xx : xx], m = legend[ch];
      if (m === undefined) continue;
      const i = yy * GW + x0 + xx;
      if (this.mat[i] !== EMPTY && CLS[this.mat[i]] !== C_GAS) continue;
      this.setCell(i, m, 20);
      this.body[i] = b;
      placed++;
    }
  });
  this.bodyVel.set(b, { vx: 0, vy, ax: 0, ay: 0 });
  if (!placed) this.emit('full', x, 0, 90);
  return placed;
};

const EGG_WHOLE = [
  '  SSS  ',
  ' SWWWS ',
  'SWWWWWS',
  'SWWYWWS',
  'SWYYYWS',
  'SWWYWWS',
  'SWWWWWS',
  ' SWWWS ',
  '  SSS  '];
const EGG_OPEN = [
  '  WWWWWW  ',
  ' WWWYYWWW ',
  'WWWYYYYWWW',
  ' WWWYYWWW ',
  '  WWWWWW  '];
const FISH_ROWS = [
  '     FFF        ',
  '   BBBBBBB    F ',
  ' BEBBBBBBBB  FF ',
  'BBBBBBBBBBBBBFFF',
  ' BBBBBBBBBBB FF ',
  '   BBBBBBB    F ',
  '      FF        '];

Sim.throwEgg = function (x) { return this.spawnShape(EGG_WHOLE, { S: SHELL, W: EGG, Y: YOLK }, x, 2.5, BK_SHELL); };
Sim.dropCrackedEgg = function (x) { return this.spawnShape(EGG_OPEN, { W: EGG, Y: YOLK }, x, 0.5, BK_SOFT); };
Sim.throwFish = function (x) { return this.spawnShape(FISH_ROWS, { B: FISH, F: FISHFIN, E: FISHEYE }, x, 2.5, BK_FISH); };

// A whole egg hit the bottom hard: shell shatters into loose bits, the inside becomes a blob.
Sim.crackEgg = function (b, cells, v) {
  let inner = 0;
  for (const i of cells) if (this.mat[i] !== SHELL && this.mat[i] !== WHITE_COOKED && this.mat[i] !== YOLK_COOKED) inner++;
  const nb = this.newBody(inner ? BK_SOFT : BK_FIRM);   // a hard-boiled egg stays firm
  const shards = new Map();
  for (const i of cells) {
    if (this.mat[i] !== SHELL) { this.body[i] = nb; continue; }
    // Shell breaks into little shards that skitter outward.
    const key = ((i % GW) >> 1) * 1000 + (((i / GW) | 0) >> 1);
    if (!shards.has(key)) {
      const sb = this.newBody(BK_FIRM), dir = (i % GW) < (cells[0] % GW) + 2 ? -1 : 1;
      this.bodyVel.set(sb, { vx: dir * (1 + rnd() * 2), vy: -1 - rnd() * 1.5, ax: 0, ay: 0 });
      shards.set(key, sb);
    }
    this.body[i] = shards.get(key);
  }
  this.bodyVel.set(nb, { vx: v.vx * 0.3, vy: 0, ax: 0, ay: 0 });
  const c = cells[0], x = c % GW, y = (c / GW) | 0;
  for (let k = 0; k < 5; k++) this.particle({ x: GX + x, y: GY + y, vx: (rnd() - 0.5) * 2.5, vy: -1 - rnd() * 1.5, life: 40, max: 40, c: [255, 200, 60], kind: 'drop' });
  this.discover('splat'); this.emit('splat', x, y, 30);
};

// Raw egg: holds together like a blob, slumps and spreads, and tears apart when stirred.
// Returns false once handled (so the caller skips its other movement).
Sim.softBody = function (b, cells, swimming, sw, cx, cy) {
  const body = this.body, mat = this.mat;
  const same = (j, excl) => j !== excl && body[j] === b;
  const neighbours = (j, excl) => {
    const jx = j % GW, jy = (j / GW) | 0;
    return (jy > 0 && same(j - GW, excl)) + (jy < GH - 1 && same(j + GW, excl)) +
           (jx > 0 && same(j - 1, excl)) + (jx < GW - 1 && same(j + 1, excl));
  };
  let raw = 0;
  for (let k = 0; k < cells.length; k++) {
    const i = cells[k];
    if (mat[i] === EGG || mat[i] === YOLK) raw++;
    const own = neighbours(i, -1);
    if (own === 0) {
      // A stray drop: surface tension pulls it back toward the blob; only a stir rips it free.
      if (this.stirT[i]) { body[i] = 0; continue; }
      const x = i % GW, y = (i / GW) | 0, dx = Math.sign(Math.round(cx) - x), dy = Math.sign(Math.round(cy) - y);
      for (const [mx, my] of [[dx, dy], [dx, 0], [0, dy]]) {
        if (!mx && !my) continue;
        const j = (y + my) * GW + x + mx, mj = mat[j];
        if (!body[j] && (CLS[mj] === C_LIQUID || isOpen(mj))) { this.swap(i, j); cells[k] = j; break; }
      }
      continue;
    }
    // Strong swirl or a fresh stir pulls loose strands off the edges.
    if (swimming && own <= 2 && rnd() < sw * 0.05 + (this.stirT[i] ? 0.04 : 0)) { body[i] = 0; continue; }
    const isYolk = mat[i] === YOLK || mat[i] === YOLK_COOKED, set = mat[i] === WHITE_COOKED || mat[i] === YOLK_COOKED;
    if (set || rnd() > (isYolk ? 0.15 : 0.45)) continue;   // raw white runs, yolk wobbles, cooked egg holds
    const x = i % GW, y = (i / GW) | 0, side = rnd() < 0.5 ? -1 : 1, k2 = isYolk ? 2 : 1;
    for (const [dx, dy, need] of [[0, 1, 1], [side, 1, k2], [-side, 1, k2], [side, 0, k2], [-side, 0, k2]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx, mj = mat[j];
      if (body[j] || !(CLS[mj] === C_LIQUID || isOpen(mj))) continue;
      if (neighbours(j, i) >= need) { this.swap(i, j); cells[k] = j; break; }
    }
  }
  if (!raw) this.bodyKind[b] = BK_FIRM;                            // fully set: now a firm piece
  return true;
};

// Poached fish falls apart into flakes.
Sim.maybeFlake = function (b, cells) {
  let cook = 0, n = 0;
  for (const i of cells) if (this.mat[i] === FISH) { cook += this.cook[i]; n++; }
  if (!n || cook / n < 100) return;
  const tiles = new Map();
  for (const i of cells) {
    const key = ((i % GW) >> 2) * 1000 + (((i / GW) | 0) / 3 | 0);
    if (!tiles.has(key)) tiles.set(key, this.newBody(BK_FIRM));
    this.body[i] = tiles.get(key);
  }
  this.discover('flake');
};

// Top row of the liquid body (ignores falling droplets).
Sim.findSurface = function () {
  for (let y = 0; y < GH; y++) {
    let n = 0;
    for (let x = 0; x < GW; x += 2) { const m = this.mat[y * GW + x]; if (CLS[m] === C_LIQUID || CLS[m] === C_CHUNK) n++; }
    if (n > GW * 0.2) return y;
  }
  return GH;
};

function leaveTop(x, i, m) {
  const S = Sim;
  if (S.lid) {
    if (m === STEAM && rnd() < 0.04) S.setCell(i, BROTH, 95);  // condensation drips back
    else if (m === FIRE) S.life[i] = Math.max(0, S.life[i] - 6); // lid smothers fire
    return;
  }
  S.setCell(i, EMPTY);
  if (rnd() < 0.6) {
    const c = m === SMOKE ? [80, 76, 80] : m === FIRE ? [255, 170, 40] : [235, 240, 248];
    S.particle({ x: GX + x, y: GY - 1, vx: (rnd() - 0.5) * 0.3, vy: -0.4 - rnd() * 0.4,
                 life: 40 + rint(40), max: 80, c, kind: m === FIRE ? 'flame' : 'wisp' });
  }
}

function moveGas(x, y, i, m) {
  const S = Sim, mat = S.mat;
  if (y === 0) { leaveTop(x, i, m); return; }
  const j = i - GW, mj = mat[j];
  if (mj === EMPTY) {
    // Bubble reaching the surface: mostly re-condenses, sometimes escapes (reduction).
    if (m === STEAM && y < GH - 1 && CLS[mat[i + GW]] === C_LIQUID) {
      S.bubblePops++;
      if (rnd() > 0.014) {
        S.setCell(i, BROTH, 99);
        // Bursting bubbles fling droplets up off the surface, and over the rim of a full pot.
        if (rnd() < S.turb * 0.4) {
          const up = 1 + rint(4);
          if (y - up < 0) S.spill(i);
          else if (mat[i - up * GW] === EMPTY) S.swap(i, i - up * GW);
        }
        return;
      }
    }
    if (!S.lid || m !== STEAM) { if (--S.life[i] === 0) { S.setCell(i, EMPTY); return; } }
  }
  if (mj === EMPTY || CLS[mj] === C_LIQUID || CLS[mj] === C_FOAM) {
    if (CLS[mj] === C_LIQUID && rnd() < 0.25) return;
    S.swap(i, j); return;
  }
  const dx = rnd() < 0.5 ? -1 : 1, nx = x + dx;
  if (nx >= 0 && nx < GW) {
    const k = j + dx, mk = mat[k];
    if (mk === EMPTY || CLS[mk] === C_LIQUID) { S.swap(i, k); return; }
    if (mat[i + dx] === EMPTY && rnd() < 0.5) S.swap(i, i + dx);
  }
}

function moveFire(x, y, i) {
  const S = Sim, mat = S.mat;
  if (S.life[i] <= 1) { S.setCell(i, rnd() < 0.5 ? SMOKE : EMPTY, 200); return; }
  S.life[i]--;
  // Heat surroundings.
  if (y > 0) S.temp[i - GW] += 6;
  if (y < GH - 1) S.temp[i + GW] += 6;
  if (y === 0) { leaveTop(x, i, FIRE); return; }
  // Flames lick upward in a tight mass rather than drifting off as sparks.
  const j = i - GW;
  if (mat[j] === EMPTY && rnd() < 0.35) { S.swap(i, j); return; }
  const dx = rnd() < 0.5 ? -1 : 1, nx = x + dx;
  if (nx >= 0 && nx < GW && mat[i + dx] === EMPTY && rnd() < 0.15) S.swap(i, i + dx);
}

function moveFoam(x, y, i) {
  const S = Sim, mat = S.mat;
  if (--S.life[i] === 0) { S.setCell(i, EMPTY); return; }
  if (y === 0) {
    if (!S.lid && rnd() < 0.08) {
      S.setCell(i, EMPTY);
      const left = x < GW / 2;
      S.particle({ x: left ? GX - 5 : GX + GW + 4, y: GY - 2, vx: left ? -0.3 : 0.3, vy: 0,
                   life: 200, max: 200, c: [244, 248, 236], kind: 'spill' });
      S.emit('overflow', x, y, 60);
    }
    return;
  }
  const j = i - GW, mj = mat[j];
  if (CLS[mj] === C_LIQUID) { S.swap(i, j); return; }
  if (mj === EMPTY && S.life[i] > 110 && rnd() < 0.05) {
    S.setCell(j, FOAM); S.life[j] = S.life[i] - 40; S.life[i] -= 20; return;
  }
  if (y < GH - 1 && mat[i + GW] === EMPTY) { S.swap(i, i + GW); return; }
  const dx = rnd() < 0.5 ? -1 : 1, nx = x + dx;
  if (nx >= 0 && nx < GW && mat[i + dx] === EMPTY && rnd() < 0.3) S.swap(i, i + dx);
}

// ---------------- Heat ----------------

Sim.heatPass = function () {
  const { mat, temp, cook } = this;
  // The pot is a lump of metal: the flame heats it fairly quickly, but with the burner off
  // it holds its heat and cools off slowly.
  const target = 20 + this.dial * 25;
  this.panT += (target - this.panT) * (target > this.panT ? 0.012 : 0.006);
  // Burner heats the pot bottom.
  const base = (GH - 1) * GW;
  for (let x = 0; x < GW; x++) {
    const i = base + x;
    temp[i] += (this.panT - temp[i]) * COND[mat[i]] * 0.5;
  }
  // Pairwise conduction (right and down neighbours).
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x, ci = COND[mat[i]];
      if (x < GW - 1) {
        const j = i + 1, k = Math.min(ci, COND[mat[j]]);
        const d = (temp[j] - temp[i]) * k; temp[i] += d; temp[j] -= d;
      }
      if (y < GH - 1) {
        const j = i + GW, k = Math.min(ci, COND[mat[j]]);
        const d = (temp[j] - temp[i]) * k; temp[i] += d; temp[j] -= d;
      }
    }
  }
  // Ambient cooling + boiling.
  const loss = this.lid ? 0.0012 : 0.004;
  const airT = this.lid ? 20 + (this.panT - 20) * 0.85 : 20;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x, m = mat[i];
      // Open pot: air stays near room temperature. Lid on: the trapped air heats up like an oven.
      if (m === EMPTY) { temp[i] += (airT - temp[i]) * 0.08; continue; }
      if (y === 0 || mat[i - GW] === EMPTY) temp[i] += (20 - temp[i]) * loss;
      if (m === BROTH && temp[i] > 100) {
        const acc = cook[i] + (temp[i] - 100) * 1.2;
        temp[i] = 100;
        if (acc >= 255) { cook[i] = 0; this.makeBubble(i, x, y); }
        else cook[i] = acc;
      }
    }
  }
};

Sim.makeBubble = function (i, x, y) {
  // Hand this cell's flavor to a liquid neighbour so boiling concentrates the soup;
  // the last of the liquid boiling away leaves it as a glaze on the food instead.
  const j = this.findNb(x, y, (m) => m === BROTH);
  if (j >= 0) {
    const a = i * NF, b = j * NF;
    for (let k = 0; k < NF; k++) this.fl[b + k] += this.fl[a + k] * (k === F_AROMA ? 0.97 : k === F_ALCOHOL ? 0.8 : 1);
  } else this.glaze(i, x, y);
  this.setCell(i, STEAM, 100);
  this.bubbles++;
};

// Leave a cell's dissolved flavor on whatever food or oil it touches (sauce reducing onto meat).
Sim.glaze = function (i, x, y) {
  const j = this.findNb(x, y, (m) => CLS[m] === C_CHUNK || m === OIL);
  if (j < 0) return;
  const a = i * NF, b = j * NF;
  for (let k = 0; k < NF; k++) if (k !== F_ALCOHOL) this.fl[b + k] += this.fl[a + k];
};

// ---------------- Diffusion ----------------

Sim.diffuse = function () {
  const { mat, fl, stirT, temp } = this;
  const boilLoss = this.lid ? 1 : 1 - Math.min(0.0012, this.bubbles * 0.00002);   // steam carries aroma away
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      if (stirT[i]) stirT[i]--;
      const m = mat[i];
      if (CLS[m] !== C_LIQUID) continue;
      const o = i * NF;
      if (m === BROTH) {
        fl[o + F_AROMA] *= boilLoss;
        if (temp[i] > 78) fl[o + F_ALCOHOL] *= 0.996;
      }
      let j;
      if (rnd() < 0.5) { if (x === GW - 1) continue; j = i + 1; }
      else { if (y === GH - 1) continue; j = i + GW; }
      const mj = mat[j];
      if (CLS[mj] !== C_LIQUID) continue;
      let r = m === mj ? 0.12 : 0.02;
      if (stirT[i] || stirT[j]) r = 0.45;
      const p = j * NF;
      for (let k = 0; k < NF; k++) {
        const d = (fl[p + k] - fl[o + k]) * r;
        fl[o + k] += d; fl[p + k] -= d;
      }
    }
  }
};

// ---------------- Main step ----------------

Sim.step = function () {
  this.frame++;
  this.tag = (this.frame % 250) + 1;
  this.bubbles = 0;
  this.bubblePops = 0;
  this.heatPass();
  if (this.frame % 10 === 0) this.surface = this.findSurface();
  // Boiling energy, smoothed: a rolling boil churns everything, a simmer barely moves it.
  const tgt = Math.min(1, this.bubbles / 8) + (this.dial > 0 ? 0.04 : 0);
  this.turb += (tgt - this.turb) * 0.05;
  this.swirlPass();
  this.moveBodies();
  const ltr = this.frame & 1, mat = this.mat, stamp = this.stamp, tag = this.tag;
  for (let y = GH - 1; y >= 0; y--) {
    for (let xx = 0; xx < GW; xx++) {
      const x = ltr ? xx : GW - 1 - xx, i = y * GW + x, m = mat[i];
      if (m === EMPTY || stamp[i] === tag) continue;
      if (this.react(x, y, i, m)) continue;
      switch (CLS[m]) {
        case C_LIQUID: moveLiquid(x, y, i, m); break;
        case C_POWDER: moveGrain(x, y, i, m, 0.9); break;
        case C_CHUNK:  if (m === DOUGH) moveDough(x, y, i); else if (!this.body[i]) moveGrain(x, y, i, m, 0.15); break;
        case C_GAS:    moveGas(x, y, i, m); break;
        case C_FIRE:   moveFire(x, y, i); break;
        case C_FOAM:   moveFoam(x, y, i); break;
      }
    }
  }
  this.overflowPass();
  if (this.frame % 2 === 0) this.diffuse();
  if (this.frame % 60 === 0) this.checkCombos();
  if (this.bubbles > 4 && this.dial >= 6) this.discover('boil');
  this.updateParticles();
};

Sim.updateParticles = function () {
  const ps = this.particles;
  for (let n = ps.length - 1; n >= 0; n--) {
    const p = ps[n];
    p.life--;
    if (p.kind === 'spill' || p.kind === 'drop') {
      p.vy += 0.15; p.x += p.vx; p.y += p.vy;
      if (p.kind === 'spill' && p.y > 206) {
        this.panT -= 0.6;
        this.emit('hiss', p.x, p.y, 20);
        this.particle({ x: p.x, y: p.y, vx: 0, vy: -0.5, life: 30, max: 30, c: [235, 240, 248], kind: 'wisp' });
        p.life = 0;
      }
    } else {
      p.x += p.vx + Math.sin((this.frame + n * 13) * 0.08) * 0.15; p.y += p.vy;
    }
    if (p.kind === 'drop' && p.y > 214) { p.life = 0; if (rnd() < 0.3) this.emit('hiss', p.x, p.y, 20); }
    if (p.life <= 0 || p.y > H) ps.splice(n, 1);
  }
};

// ---------------- Player actions ----------------

// Pour `amount` cells of an ingredient near grid column x.
Sim.pour = function (ing, x, amount) {
  let placed = 0;
  if (ing.kind === 'chunk') {
    this.newBody();
    const w = 3 + rint(3), h = 3 + rint(2), x0 = Math.max(0, Math.min(GW - w, (x - w / 2) | 0));
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = yy * GW + x0 + xx;
      if (this.mat[i] === EMPTY || CLS[this.mat[i]] === C_GAS) { this.setCell(i, ing.mat); this.body[i] = this.nextBody; placed++; }
    }
  } else {
    const spread = ing.kind === 'powder' ? 3 : ing.kind === 'spray' ? 9 : 1 + amount / 4;   // a heavy pour is a wider stream
    for (let n = 0; n < amount; n++) {
      const px = Math.max(0, Math.min(GW - 1, Math.round(x + (rnd() * 2 - 1) * spread)));
      const py = rint(3), i = py * GW + px;
      if (py === 0 && this.surface <= 1 && CLS[this.mat[i]] === C_LIQUID) this.spill(i);   // brim-full: it goes over the side
      if (this.mat[i] !== EMPTY && CLS[this.mat[i]] !== C_GAS) continue;
      this.setCell(i, ing.mat, 20);
      if (ing.flavor) this.addFlavor(i, ing.flavor);
      placed++;
    }
  }
  if (ing.note && placed) this.addNote(ing.note, 0.004 * placed);
  if (!placed) this.emit('full', x, 0, 90);
  return placed;
};

// Ladle stir: drags everything in a disc along the stroke, and spins up a lasting whirlpool.
Sim.stir = function (cx, cy, dx, dy, r) {
  const sp = Math.hypot(dx, dy);
  if (sp < 0.3) return;
  const ux = dx / sp, uy = dy / sp, push = Math.min(5, sp);
  for (let y = Math.max(0, cy - r); y <= Math.min(GH - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(GW - 1, cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = y * GW + x, m = this.mat[i];
      this.stirT[i] = 30;
      if (m === DOUGH && this.fl[i * NF + F_GLUTEN] < 1) {   // working the dough builds gluten
        this.fl[i * NF + F_GLUTEN] += 0.01;
        if (this.fl[i * NF + F_GLUTEN] > 0.2) this.discover('knead');
      }
      if (this.body[i]) {
        // The ladle tears a raw egg apart; anything firmer gets shoved as a whole.
        if (this.bodyKind[this.body[i]] === BK_SOFT && rnd() < 0.6) this.body[i] = 0;
        else { this.pushBodies.add(this.body[i]); continue; }
      }
      if (m === EMPTY || CLS[m] === C_GAS || rnd() > 0.6) continue;
      const d = 1 + rint(Math.ceil(push) + 1);
      const tx = Math.round(x + ux * d) + rint(3) - 1, ty = Math.round(y + uy * d) + rint(3) - 1;
      if (tx < 0 || tx >= GW || ty < 0 || ty >= GH) continue;
      const j = ty * GW + tx, mj = this.mat[j];
      if (this.body[j]) continue;
      if ((mj === EMPTY || CLS[mj] === C_GAS) && ty < y) continue;   // shove along, never fling soup upward
      this.swap(i, j);
      this.stirT[j] = 30;
    }
  }
  this.pushDir = { x: ux, y: uy, n: Math.ceil(push) };
  // Torque about the middle of the liquid feeds the whirlpool.
  const pcx = GW / 2, pcy = (this.surface + GH) / 2;
  const torque = ((cx - pcx) * dy - (cy - pcy) * dx) / (GW * 0.5);
  this.swirl = Math.max(-1, Math.min(1, this.swirl + torque * 0.03));
};
