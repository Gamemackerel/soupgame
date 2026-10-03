#!/usr/bin/env node
// Recipe checks: replays test-recipes through the real simulation and grades each against its expectations.
//
//   node tools/run-recipes.js s06-garlic-broth     one recipe in detail (id or prefix)
//   node tools/run-recipes.js soups                one file
//   node tools/run-recipes.js all                  everything (in parallel)
// Options: --seed=N (default 1)  --scale=X (multiply ingredient amounts)  --snap (PNG per step, single recipe)
//
// Grading: FAIL only when something is wildly off; near misses are WARN.
//   FAIL  expected discovery missing · unexpected flaw ≥ 0.4 · taste more than 0.2 outside its range ·
//         verdict two steps off (CHOPPED vs WINNER) · bake doneness/rise far off
//   WARN  taste/verdict/bake slightly off · expected flaw or aroma note missing · small unexpected flaw
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const K = require('./kitchen');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((s) => s.startsWith('--' + k)); return a ? (a.includes('=') ? a.split('=')[1] : true) : d; };
const target = args.find((a) => !a.startsWith('--')) || 'all';
const SEED = +opt('seed', 1), SCALE = +opt('scale', 1), SNAP = opt('snap', false);
const LEVELS = ['CHOPPED', 'SAFE', 'WINNER'];

function grade(recipe, res) {
  const e = recipe.expect, out = [];
  const add = (level, what, detail) => out.push({ level, what, detail });
  for (const d of e.discoveries) add(res.discovered.includes(d) ? 'ok' : 'fail', `discovery ${d}`, res.discovered.includes(d) ? '' : 'not triggered');
  for (const [ax, [lo, hi]] of Object.entries(e.taste)) {
    const v = res.taste[ax], off = v < lo ? lo - v : v > hi ? v - hi : 0;
    add(off === 0 ? 'ok' : off > 0.2 ? 'fail' : 'warn', `taste ${ax}`, `${v.toFixed(2)} (want ${lo}–${hi})`);
  }
  for (const n of e.notes) add(res.notes.includes(n) ? 'ok' : 'warn', `note ${n}`, res.notes.includes(n) ? '' : `top notes: ${res.notes.join(', ') || 'none'}`);
  for (const [f, v] of Object.entries(res.flaws)) {
    const want = e.flaws.includes(f);
    if (want) add(v > 0.2 ? 'ok' : 'warn', `flaw ${f}`, `${v.toFixed(2)} (expected)`);
    else if (v > 0.2) add(v >= 0.4 ? 'fail' : 'warn', `flaw ${f}`, `${v.toFixed(2)} (unexpected)`);
  }
  if (e.bake) {
    const b = res.bake;
    if (!b) add('fail', 'bake', 'nothing baked');
    else {
      if (e.bake.kind) add([].concat(e.bake.kind).includes(b.kind) ? 'ok' : 'warn', 'bake kind', `${b.kind} (want ${e.bake.kind})`);
      if (e.bake.rise) { const [lo, hi] = e.bake.rise, off = b.rise < lo ? lo - b.rise : b.rise > hi ? b.rise - hi : 0; add(off === 0 ? 'ok' : off > 0.3 ? 'fail' : 'warn', 'bake rise', `x${b.rise.toFixed(2)} (want ${lo}–${hi})`); }
      if (e.bake.doneness) { const off = e.bake.doneness - b.doneness; add(off <= 0 ? 'ok' : off > 0.15 ? 'fail' : 'warn', 'bake doneness', `${b.doneness.toFixed(2)} (want ≥ ${e.bake.doneness})`); }
    }
  }
  const allowed = e.verdict.split('-').map((v) => LEVELS.indexOf(v)), got = LEVELS.indexOf(res.verdict);
  const dist = Math.min(...allowed.map((a) => Math.abs(a - got)));
  add(dist === 0 ? 'ok' : dist === 1 ? 'warn' : 'fail', 'verdict', `${res.verdict} avg ${res.score.toFixed(1)} [${res.judges.map((j) => j.score).join(', ')}] (want ${e.verdict})`);
  return out;
}
const status = (g) => g.some((x) => x.level === 'fail') ? 'FAIL' : g.some((x) => x.level === 'warn') ? 'WARN' : 'PASS';
const mark = { ok: '✓', warn: '~', fail: '✗' };

function detail(recipe, res, g) {
  for (const x of g) console.log(`   ${mark[x.level]} ${x.what.padEnd(22)} ${x.detail}`);
  console.log('   taste  ' + Object.entries(res.taste).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  '));
  console.log('   raw    ' + Object.entries(res.raw).filter(([, v]) => Math.abs(v) > 0.005).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  '));
  console.log(`   dish   ${res.type}   notes: ${res.notes.join(', ') || '-'}   discovered: ${res.discovered.join(', ')}`);
  if (res.bake) console.log('   bake   ' + JSON.stringify(res.bake, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
  for (const j of res.judges) console.log(`   ${j.judge.padEnd(10)} ${j.score}: ${j.line}`);
}

// --snap: replay in-process, writing a PNG of the pot after every step.
function snapRun(spec) {
  const G = K.makeGame(SEED); G.Sim.reset();
  const dir = path.join(__dirname, 'out', spec.id);
  fs.mkdirSync(dir, { recursive: true }); for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  spec.steps.forEach((st, n) => {
    K.execStep(G, st, SCALE);
    const { GW, GH } = G, data = new Uint8ClampedArray(GW * GH * 4); G.Sim.render(data);
    const s = 4, W2 = GW * s, H2 = GH * s, raw = Buffer.alloc((W2 * 4 + 1) * H2);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      const p = ((y / s | 0) * GW + (x / s | 0)) * 4, a = data[p + 3] / 255, d = y * (W2 * 4 + 1) + 1 + x * 4;
      raw[d] = data[p] * a + 70 * (1 - a); raw[d + 1] = data[p + 1] * a + 74 * (1 - a); raw[d + 2] = data[p + 2] * a + 92 * (1 - a); raw[d + 3] = 255;
    }
    const crc = (buf) => { let c, r = ~0; for (const b of buf) { c = (r ^ b) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; r = (r >>> 8) ^ c; } return ~r >>> 0; };
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const h = Buffer.alloc(13); h.writeUInt32BE(W2, 0); h.writeUInt32BE(H2, 4); h[8] = 8; h[9] = 6;
    fs.writeFileSync(path.join(dir, `${String(n + 1).padStart(2, '0')}-${st.replace(/[^a-z0-9.]+/gi, '_')}.png`),
      Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', h), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  });
  console.log('   snapshots: ' + path.relative(K.ROOT, dir));
}

(async () => {
  const all = K.loadRecipes();
  const chosen = target === 'all' ? all : all.filter((r) => r._file === target || r.id === target || r.id.startsWith(target));
  if (!chosen.length) { console.error('No recipe matches', target); process.exit(1); }
  const specs = chosen.map((r) => K.resolve(r.id, all));
  const results = await K.cookAll(specs.map((spec) => ({ spec, seed: SEED, scale: SCALE })));
  const tally = { PASS: 0, WARN: 0, FAIL: 0 };
  chosen.forEach((r, n) => {
    const res = results[n];
    if (res.error) { console.log(`ERROR ${r.id}\n${res.error}`); tally.FAIL++; return; }
    const g = grade(r, res), st = status(g);
    tally[st]++;
    console.log(`${st.padEnd(5)} ${r.id}  (${res.simSeconds.toFixed(0)}s sim)`);
    if (chosen.length === 1) detail(r, res, g);
    else for (const x of g) if (x.level !== 'ok') console.log(`   ${mark[x.level]} ${x.what.padEnd(22)} ${x.detail}`);
  });
  if (SNAP && chosen.length === 1) snapRun(specs[0]);
  if (chosen.length > 1) console.log(`\n${tally.PASS} pass, ${tally.WARN} warn, ${tally.FAIL} fail  (of ${chosen.length})`);
  process.exit(tally.FAIL ? 1 : 0);
})();
