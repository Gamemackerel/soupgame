#!/usr/bin/env node
// Headless recipe runner: replays test-recipes through the real simulation and checks expectations.
//
//   node tools/run-recipes.js s06-garlic-broth          run one recipe (by id or id prefix)
//   node tools/run-recipes.js soups                      run a whole file
//   node tools/run-recipes.js all                        run everything
// Options:
//   --snap        write PNG snapshots of the pot after each step to tools/out/<id>/
//   --seed=N      RNG seed (default 1) — runs are deterministic for a given seed
//   --verbose     print every step as it runs
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((s) => s.startsWith('--' + k)); return a ? (a.includes('=') ? a.split('=')[1] : true) : d; };
const target = args.find((a) => !a.startsWith('--')) || 'all';
const SNAP = opt('snap', false), SEED = +opt('seed', 1), VERBOSE = opt('verbose', false);
const FPS = 60;

// ---------- Load the game's simulation code into a sandbox ----------
function makeGame(seed) {
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const math = Object.create(Math); math.random = rand;
  const ctx = { console, Math: math, Chef: { t: 0 } };
  const files = ['materials', 'sim', 'reactions', 'taste', 'judges'];
  const src = files.map((f) => fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8')).join('\n;\n');
  // Expose the lexical globals we need.
  vm.runInNewContext(src + '\n;this.G = { Sim, SHELF, Taste, JUDGES, Judging, MAT, CLS, GW, GH, N, NF, F_SALTY, BROTH, OIL, C_LIQUID, C_CHUNK, C_POWDER, C_GAS, EMPTY, DISCOVERIES };', ctx);
  return ctx.G;
}

// ---------- Recipes ----------
function loadRecipes() {
  const dir = path.join(ROOT, 'test-recipes'), out = [];
  for (const f of ['soups', 'frying', 'baking', 'experiments']) {
    for (const r of JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8'))) { r._file = f; out.push(r); }
  }
  return out;
}

// ---------- Step execution ----------
function surfaceY(G) { return G.Sim.findSurface();
}
function surfaceYOld(G) {
  const { Sim, GW, GH, CLS, C_LIQUID } = G;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x += 4) if (CLS[Sim.mat[y * GW + x]] === C_LIQUID) return y;
  return GH - 1;
}

function runFrames(G, n, perFrame) {
  for (let f = 0; f < n; f++) { if (perFrame) perFrame(f); G.Sim.step(); G.Sim.events.length = 0; }
}

function execStep(G, step, log) {
  const { Sim, SHELF, GW, GH } = G;
  const [cmd, a, b, ...rest] = step.split(' ');
  const mods = step.split(' ');
  const pos = mods.includes('@left') ? GW * 0.25 : mods.includes('@right') ? GW * 0.75 : GW / 2;
  const withStir = mods.includes('+stir');
  const secs = (s) => parseFloat(s);
  let stirPhase = 0, prev = null;
  const stirFrame = () => {
    // Ladle sweeps an ellipse through the liquid.
    const top = surfaceY(G), cy = (top + GH) / 2, ry = Math.max(3, (GH - top) / 2 - 4), rx = GW * 0.35;
    stirPhase += 0.12;
    const p = { x: Math.round(GW / 2 + Math.cos(stirPhase) * rx), y: Math.round(cy + Math.sin(stirPhase) * ry) };
    if (prev) Sim.stir(p.x, p.y, p.x - prev.x, p.y - prev.y, 6);
    prev = p;
  };
  switch (cmd) {
    case 'pour': {
      const ing = SHELF.find((s) => s.id === a);
      const frames = Math.round(secs(b) * FPS);
      runFrames(G, frames, (f) => { Sim.pour(ing, Math.round(pos + ((f * 5) % 7) - 3), ing.rate); if (withStir) stirFrame(); });
      break;
    }
    case 'add': {
      const ing = SHELF.find((s) => s.id === a);
      const n = parseInt(b, 10);
      let k = 0;
      runFrames(G, n * 8, (f) => { if (f % 8 === 0 && k < n) { Sim.pour(ing, Math.round(pos + (k % 2 ? 1 : -1) * (k * 3 % 24)), 1); k++; } });
      break;
    }
    case 'crack':   // crack N eggs on the rim and drop them in, ~1s apart
    case 'throw': { // throw N whole eggs or fish in
      const n = parseInt(b, 10);
      let k = 0;
      runFrames(G, n * 60, (f) => {
        if (f % 60 === 0 && k < n) {
          const x = Math.round(pos + (k % 2 ? 1 : -1) * (k * 7 % 30));
          if (cmd === 'crack') Sim.dropCrackedEgg(x); else if (a === 'fish') Sim.throwFish(x); else Sim.throwEgg(x);
          if (cmd === 'crack') Sim.discover('crack');
          k++;
        }
        if (withStir) stirFrame();
      });
      break;
    }
    case 'heat': Sim.dial = parseFloat(a); break;
    case 'wait': runFrames(G, Math.round(secs(a) * FPS)); break;
    case 'stir': runFrames(G, Math.round(secs(a) * FPS), stirFrame); break;
    case 'lid': Sim.lid = a === 'on'; break;
    case 'taste': {
      const top = surfaceY(G);
      const r = G.Taste.sip(Math.round(GW / 2), Math.round((top + GH) / 2));
      log.tastes.push(r);
      break;
    }
    case 'serve': break;
    default: throw new Error('Unknown step: ' + step);
  }
}

// ---------- Metrics about how well things mix ----------
function mixMetrics(G) {
  const { Sim, GW, GH, CLS, C_LIQUID, C_CHUNK, OIL, BROTH, NF, F_SALTY } = G;
  const top = surfaceY(G), depth = Math.max(1, GH - top);
  let chunks = 0, chunkBottom = 0, chunkYSum = 0, oil = 0, oilSubmerged = 0;
  const salts = [];
  const colOcc = new Set();
  for (let y = top; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x, m = Sim.mat[i];
    if (CLS[m] === C_CHUNK) {
      chunks++; chunkYSum += (y - top) / depth;
      if (y >= GH - Math.max(2, depth * 0.2)) chunkBottom++;
      colOcc.add(x >> 3);
    }
    if (m === OIL) { oil++; if (y > top + 3) oilSubmerged++; }
    if (m === BROTH) salts.push(Sim.fl[i * NF + F_SALTY]);
  }
  const mean = salts.reduce((s, v) => s + v, 0) / Math.max(1, salts.length);
  const sd = Math.sqrt(salts.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, salts.length));
  return {
    liquidDepth: depth,
    chunks,
    chunkBottomFrac: chunks ? chunkBottom / chunks : 0,      // share of solids in the bottom 20% of the liquid
    chunkMeanDepth: chunks ? chunkYSum / chunks : 0,         // 0 = surface, 1 = floor
    chunkColumnSpread: colOcc.size / Math.ceil(GW / 8),      // share of 8px columns containing solids
    oil,
    oilSubmergedFrac: oil ? oilSubmerged / oil : 0,
    saltCV: mean > 0.001 ? sd / mean : 0,                    // seasoning unevenness (0 = perfectly even)
  };
}

// ---------- PNG snapshots ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(w, h, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function snapshot(G, file, scale = 4) {
  const { Sim, GW, GH } = G;
  const data = new Uint8ClampedArray(GW * GH * 4);
  Sim.render(data);
  const W2 = GW * scale, H2 = GH * scale, out = Buffer.alloc(W2 * H2 * 4);
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    const s = ((y / scale | 0) * GW + (x / scale | 0)) * 4, d = (y * W2 + x) * 4, a = data[s + 3] / 255;
    const bg = [70, 74, 92];
    for (let k = 0; k < 3; k++) out[d + k] = data[s + k] * a + bg[k] * (1 - a);
    out[d + 3] = 255;
  }
  fs.writeFileSync(file, png(W2, H2, out));
}

// ---------- Checking ----------
function inRange(v, [lo, hi], slack = 0) { return v >= lo - slack && v <= hi + slack; }

function check(recipe, G, log) {
  const e = recipe.expect, res = [];
  const a = G.Taste.analyzeBowl();
  G.Judging.start();
  const verdict = G.Judging.verdict;
  const got = [...G.Sim.discovered];
  for (const d of e.discoveries) res.push({ ok: got.includes(d), what: `discovery ${d}`, detail: got.includes(d) ? '' : 'not triggered' });
  for (const [ax, rg] of Object.entries(e.taste)) {
    const v = a.p[ax];
    res.push({ ok: inRange(v, rg), what: `taste ${ax}`, detail: `${v.toFixed(2)} (want ${rg[0]}–${rg[1]})` });
  }
  for (const n of e.notes) res.push({ ok: a.notes.includes(n), what: `note ${n}`, detail: a.notes.includes(n) ? '' : `top notes: ${a.notes.join(', ') || 'none'}` });
  for (const [f, v] of Object.entries(a.flaws)) {
    const want = e.flaws.includes(f);
    const has = v > 0.2;
    if (want || has) res.push({ ok: want === has, what: `flaw ${f}`, detail: `${v.toFixed(2)}${want ? ' (expected)' : ' (unexpected)'}` });
  }
  const allowed = e.verdict.split('-');
  res.push({ ok: allowed.includes(verdict), what: 'verdict', detail: `${verdict} avg ${G.Judging.avg.toFixed(1)} [${G.Judging.results.map((r) => r.score).join(', ')}] (want ${e.verdict})` });
  return { res, analysis: a, discovered: got, judges: G.Judging.results };
}

// ---------- Main ----------
function runRecipe(r) {
  const G = makeGame(SEED);
  G.Sim.reset();
  const log = { tastes: [] };
  const dir = path.join(__dirname, 'out', r.id);
  if (SNAP) { fs.mkdirSync(dir, { recursive: true }); for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); }
  const t0 = Date.now();
  r.steps.forEach((s, n) => {
    execStep(G, s, log);
    if (VERBOSE) console.log(`  [${String(n + 1).padStart(2)}] ${s.padEnd(24)} t=${(G.Sim.frame / FPS).toFixed(0)}s  ` + JSON.stringify(mixMetrics(G), (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
    if (SNAP) snapshot(G, path.join(dir, `${String(n + 1).padStart(2, '0')}-${s.replace(/[^a-z0-9.]+/gi, '_')}.png`));
  });
  const out = check(r, G, log);
  out.mix = mixMetrics(G);
  out.ms = Date.now() - t0;
  out.simSeconds = G.Sim.frame / FPS;
  return out;
}

const recipes = loadRecipes();
const chosen = target === 'all' ? recipes : recipes.filter((r) => r._file === target || r.id === target || r.id.startsWith(target));
if (!chosen.length) { console.error('No recipe matches', target); process.exit(1); }

let pass = 0, fail = 0;
for (const r of chosen) {
  const out = runRecipe(r);
  const bad = out.res.filter((x) => !x.ok);
  const ok = bad.length === 0;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.id}  (${out.res.length - bad.length}/${out.res.length} checks, ${out.simSeconds.toFixed(0)}s sim in ${(out.ms / 1000).toFixed(1)}s)`);
  if (chosen.length === 1 || !ok) {
    for (const x of out.res) if (chosen.length === 1 || !x.ok) console.log(`   ${x.ok ? '✓' : '✗'} ${x.what.padEnd(22)} ${x.detail}`);
  }
  if (chosen.length === 1) {
    const p = out.analysis.p;
    console.log('   taste  ' + Object.entries(p).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  '));
    console.log('   notes  ' + (out.analysis.notes.join(', ') || '-') + '   discovered: ' + out.discovered.join(', '));
    console.log('   dish   ' + out.analysis.type + '  ' + JSON.stringify(out.analysis.debug));
    console.log('   mix    ' + Object.entries(out.mix).map(([k, v]) => `${k} ${typeof v === 'number' ? +v.toFixed(2) : v}`).join('  '));
    out.judges.forEach((j, n) => console.log(`   judge${n} ${j.score}: ${j.line}`));
    if (SNAP) console.log('   snapshots: ' + path.relative(ROOT, path.join(__dirname, 'out', r.id)));
  }
}
if (chosen.length > 1) console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
