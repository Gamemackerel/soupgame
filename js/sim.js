// Falling-sand simulation core: grid state, movement, heat, diffusion, pouring, stirring.
// Reactions live in reactions.js (Sim.react). Grid y=0 is the pot rim, y=GH-1 the bottom.

const N = GW * GH;
const CLS = new Uint8Array(64), DENS = new Float32Array(64), COND = new Float32Array(64);
for (const m of MAT) if (m) { CLS[m.id] = m.cls; DENS[m.id] = m.dens; COND[m.id] = m.cond; }

const Sim = {
  mat: new Uint8Array(N), temp: new Float32Array(N), cook: new Uint8Array(N),
  life: new Uint8Array(N), shade: new Uint8Array(N), stamp: new Uint8Array(N),
  stirT: new Uint8Array(N), fl: new Float32Array(N * NF),
  body: new Uint16Array(N), nextBody: 1, bodyEnv: new Uint8Array(65536), // env: 0 dry, 1 in oil, 2 in broth
    // rigid chunk pieces: cells sharing an id move together
  fond: new Float32Array(GW),
  panT: 20, dial: 0, lid: false, frame: 0, tag: 1,
  notes: {}, discovered: new Set(), events: [], particles: [],
  bubbles: 0, lastEmit: {}, flags: {}, turb: 0, swirl: 0, surface: GH,
  pushBodies: new Set(), pushDir: null,
};

function rnd() { return Math.random(); }
function rint(n) { return (Math.random() * n) | 0; }

Sim.reset = function () {
  this.mat.fill(0); this.temp.fill(20); this.cook.fill(0); this.life.fill(0);
  this.stirT.fill(0); this.fl.fill(0); this.fond.fill(0); this.body.fill(0);
  this.panT = 20; this.notes = {}; this.particles = []; this.flags = {};
  this.turb = 0; this.swirl = 0; this.surface = GH;
};

Sim.setCell = function (i, m, t) {
  this.mat[i] = m;
  this.temp[i] = t === undefined ? 20 : t;
  this.cook[i] = 0;
  const c = CLS[m];
  this.life[i] = c === C_CHUNK ? 255 : m === STEAM ? 80 : m === SMOKE ? 50 :
                 m === FIRE ? 25 + rint(30) : m === FOAM ? 160 + rint(90) : 0;
  this.shade[i] = rint(256);
  this.body[i] = 0;
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
  // Convection: hot broth rises through cooler broth.
  if (m === BROTH && y > 0) {
    const j = i - GW;
    if (S.mat[j] === BROTH && S.temp[i] > S.temp[j] + 2 && rnd() < 0.2) { S.swap(i, j); return; }
  }
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
    let t = -1;
    for (let k = 1; k <= 3; k++) {
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
Sim.swirlPass = function () {
  const s = this.swirl;
  if (Math.abs(s) < 0.02) { this.swirl = 0; return; }
  this.swirl *= 0.99;
  const top = this.surface, depth = GH - top;
  if (depth < 4) return;
  const cx = GW / 2, cy = top + depth / 2, ax = GW / 2, ay = depth / 2, dir = Math.sign(s);
  const n = Math.abs(s) * GW * depth * 0.12;
  for (let k = 0; k < n; k++) {
    const x = rint(GW), y = top + rint(depth), i = y * GW + x, m = this.mat[i];
    if (m === EMPTY || CLS[m] === C_GAS || this.body[i]) continue;
    const [vx, vy] = swirlDir(x, y, cx, cy, ax, ay, dir), step = 1 + rint(3);
    const tx = x + vx * step + rint(3) - 1, ty = y + vy * step;
    if (tx < 0 || tx >= GW || ty < top || ty >= GH) continue;
    const j = ty * GW + tx, mj = this.mat[j];
    if (mj === EMPTY || CLS[mj] === C_GAS || this.body[j]) continue;
    this.swap(i, j);
    this.stirT[i] = this.stirT[j] = 20;
  }
};

// ---------------- Rigid chunk pieces ----------------

// Can piece b shift by (dx,dy)? Targets must be its own cells, liquid, or (when falling) open air.
function bodyCanMove(S, cells, b, dx, dy) {
  for (const i of cells) {
    const x = i % GW + dx, y = ((i / GW) | 0) + dy;
    if (x < 0 || x >= GW || y < 0 || y >= GH) return false;
    const j = y * GW + x, mj = S.mat[j];
    if (S.body[j] === b) continue;
    if (CLS[mj] === C_LIQUID) continue;
    if (dy > 0 && isOpen(mj)) continue;
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

function tryBody(S, cells, b, dx, dy) {
  if (!bodyCanMove(S, cells, b, dx, dy)) return false;
  bodyMove(S, cells, dx, dy);
  return true;
}

Sim.moveBodies = function () {
  const groups = new Map(), mat = this.mat, body = this.body;
  for (let i = 0; i < N; i++) {
    const b = body[i];
    if (!b) continue;
    if (CLS[mat[i]] !== C_CHUNK) { body[i] = 0; continue; }
    let g = groups.get(b);
    if (!g) groups.set(b, g = []);
    g.push(i);
  }
  const top = this.surface, depth = Math.max(1, GH - top), pcx = GW / 2, pcy = top + depth / 2;
  for (const [b, cells] of groups) {
    if (cells.length === 1) { body[cells[0]] = 0; continue; }   // a lone cell moves like a grain
    let sx = 0, sy = 0, d = 0, wet = 0, hot = 0, stirred = 0, liqD = 0, inBroth = 0;
    for (const i of cells) {
      const x = i % GW, y = (i / GW) | 0;
      sx += x; sy += y; d += DENS[mat[i]];
      if (this.temp[i] > 85) hot++;
      if (this.stirT[i]) stirred++;
      const below = y < GH - 1 ? mat[i + GW] : EMPTY, above = y > 0 ? mat[i - GW] : EMPTY;
      if (CLS[below] === C_LIQUID) { wet++; liqD += DENS[below]; if (below === BROTH) inBroth++; }
      else if (CLS[above] === C_LIQUID) { wet++; liqD += DENS[above]; if (above === BROTH) inBroth++; }
    }
    this.bodyEnv[b] = !wet ? 0 : inBroth * 2 >= wet ? 2 : 1;
    const n = cells.length, cx = sx / n, cy = sy / n;
    d /= n;

    // Stirred by the ladle: carried along the stroke.
    if (this.pushBodies.has(b) && this.pushDir) {
      const p = this.pushDir, mx = Math.round(p.x), my = Math.round(p.y);
      for (let k = 0; k < p.n; k++) if (!tryBody(this, cells, b, mx, my) && !tryBody(this, cells, b, mx, 0) && !tryBody(this, cells, b, 0, my)) break;
      continue;
    }
    if (!wet) {
      // In air (or resting on the dry pot): fall, sliding off piles.
      if (tryBody(this, cells, b, 0, 1)) continue;
      if (rnd() < 0.3) { const dx = rnd() < 0.5 ? -1 : 1; tryBody(this, cells, b, dx, 1); }
      continue;
    }
    const dl = liqD / wet;
    // Whirlpool carries pieces around the pot (and its turbulence scatters them).
    const sw = Math.abs(this.swirl);
    if (sw > 0.05 && rnd() < sw * 0.7) {
      const [vx, vy] = swirlDir(cx, cy, pcx, pcy, GW / 2, depth / 2, Math.sign(this.swirl));
      if ((vx || vy) && (tryBody(this, cells, b, vx, vy) || (vx && tryBody(this, cells, b, vx, 0)) || (vy && tryBody(this, cells, b, 0, vy)))) continue;
    }
    // Boiling churn and leftover stir energy: bob up, drift sideways, tumble.
    const e = this.turb * (hot / n > 0.5 ? 1 : 0.2) + (stirred / n > 0.3 ? 0.5 : 0) + sw * 0.8;
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
    } else if (rnd() < 0.02) {
      tryBody(this, cells, b, rnd() < 0.5 ? -1 : 1, 0);   // gentle drift
    }
  }
  this.pushBodies.clear();
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
      if (rnd() > 0.02) { S.setCell(i, BROTH, 99); return; }
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
  const j = i - GW;
  if (mat[j] === EMPTY && rnd() < 0.6) { S.swap(i, j); return; }
  const dx = rnd() < 0.5 ? -1 : 1, nx = x + dx;
  if (nx >= 0 && nx < GW && mat[i + dx] === EMPTY && rnd() < 0.4) S.swap(i, i + dx);
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
  const target = 20 + this.dial * 25;
  this.panT += (target - this.panT) * 0.02;
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
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x, m = mat[i];
      if (m === EMPTY) { temp[i] += (20 - temp[i]) * 0.08; continue; }
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
  // Hand this cell's flavor to a liquid neighbour so boiling concentrates the soup.
  const j = this.findNb(x, y, (m) => m === BROTH);
  if (j >= 0) {
    const a = i * NF, b = j * NF;
    for (let k = 0; k < NF; k++) this.fl[b + k] += this.fl[a + k] * (k === F_AROMA ? 0.97 : k === F_ALCOHOL ? 0.8 : 1);
  }
  this.setCell(i, STEAM, 100);
  this.bubbles++;
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
        case C_CHUNK:  if (!this.body[i]) moveGrain(x, y, i, m, 0.15); break;
        case C_GAS:    moveGas(x, y, i, m); break;
        case C_FIRE:   moveFire(x, y, i); break;
        case C_FOAM:   moveFoam(x, y, i); break;
      }
    }
  }
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
    if (p.life <= 0 || p.y > H) ps.splice(n, 1);
  }
};

// ---------------- Player actions ----------------

// Pour `amount` cells of an ingredient near grid column x.
Sim.pour = function (ing, x, amount) {
  let placed = 0;
  if (ing.kind === 'chunk') {
    this.nextBody = this.nextBody >= 65000 ? 1 : this.nextBody + 1;
    const w = 3 + rint(3), h = 3 + rint(2), x0 = Math.max(0, Math.min(GW - w, (x - w / 2) | 0));
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = yy * GW + x0 + xx;
      if (this.mat[i] === EMPTY || CLS[this.mat[i]] === C_GAS) { this.setCell(i, ing.mat); this.body[i] = this.nextBody; placed++; }
    }
  } else {
    const spread = ing.kind === 'powder' ? 3 : 1 + amount / 4;   // a heavy pour is a wider stream
    for (let n = 0; n < amount; n++) {
      const px = Math.max(0, Math.min(GW - 1, Math.round(x + (rnd() * 2 - 1) * spread)));
      const py = rint(3), i = py * GW + px;
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
      if (this.body[i]) { this.pushBodies.add(this.body[i]); continue; }
      if (m === EMPTY || CLS[m] === C_GAS || rnd() > 0.6) continue;
      const d = 1 + rint(Math.ceil(push) + 1);
      const tx = Math.round(x + ux * d) + rint(3) - 1, ty = Math.round(y + uy * d) + rint(3) - 1;
      if (tx < 0 || tx >= GW || ty < 0 || ty >= GH) continue;
      const j = ty * GW + tx, mj = this.mat[j];
      if (mj === EMPTY || CLS[mj] === C_GAS || this.body[j]) continue;   // never fling soup into the air
      this.swap(i, j);
      this.stirT[j] = 30;
    }
  }
  this.pushDir = { x: ux, y: uy, n: Math.ceil(push) };
  // Torque about the middle of the liquid feeds the whirlpool.
  const pcx = GW / 2, pcy = (this.surface + GH) / 2;
  const torque = ((cx - pcx) * dy - (cy - pcy) * dx) / (GW * 0.5);
  this.swirl = Math.max(-1, Math.min(1, this.swirl + torque * 0.02));
};
