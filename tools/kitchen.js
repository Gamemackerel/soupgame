// Shared headless kitchen: builds the game, replays recipes (and variants of them), and extracts metrics.
// Used by run-recipes.js and run-pairs.js. Also runs as a worker thread (see bottom) for parallel runs.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { isMainThread, parentPort, Worker } = require('worker_threads');

const ROOT = path.join(__dirname, '..');
const FPS = 60;
const SRC = ['materials', 'sim', 'reactions', 'dough', 'taste', 'judges']
  .map((f) => fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8')).join('\n;\n');

// ---------- Game instance (deterministic for a seed) ----------
function makeGame(seed) {
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const math = Object.create(Math); math.random = rand;
  // Compile as one function in this context (a vm sandbox makes every global lookup ~10x slower).
  const body = SRC + '\n;return { Sim, SHELF, Taste, JUDGES, Judging, MAT, CLS, GW, GH, N, NF, FLAVOR_KEYS, F_SALTY, BROTH, OIL, C_LIQUID, C_CHUNK, C_POWDER, C_GAS, EMPTY, DISCOVERIES };';
  return new Function('Math', 'Chef', 'Plating', body)(math, { t: 0 }, undefined);
}

// ---------- Recipes and variants ----------
function loadRecipes() {
  const dir = path.join(ROOT, 'test-recipes'), out = [];
  for (const f of ['soups', 'frying', 'baking', 'experiments']) {
    for (const r of JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8'))) { r._file = f; out.push(r); }
  }
  return out;
}

// A recipe reference: an id, or a variant of one:
//   { from: 'id', name, remove: [steps], replace: {step: newStep}, insertAfter: {step: [steps]},
//     insertBefore: {step: [steps]}, append: [steps], steps: [...] (replaces all), scale: 2 }
function resolve(ref, all) {
  if (typeof ref === 'string') {
    const r = all.find((x) => x.id === ref || x.id.startsWith(ref));
    if (!r) throw new Error('No recipe ' + ref);
    return { id: r.id, name: r.name, steps: r.steps.slice(), scale: 1, expect: r.expect };
  }
  const base = ref.from ? resolve(ref.from, all) : { id: 'inline', name: 'inline', steps: [], scale: 1 };
  let steps = ref.steps ? ref.steps.slice() : base.steps;
  const find = (st) => { const k = steps.indexOf(st); if (k < 0) throw new Error(`Variant of ${base.id}: no step "${st}"`); return k; };
  for (const st of ref.remove || []) steps.splice(find(st), 1);
  for (const [st, nw] of Object.entries(ref.replace || {})) steps[find(st)] = nw;
  for (const [st, add] of Object.entries(ref.insertAfter || {})) steps.splice(find(st) + 1, 0, ...add);
  for (const [st, add] of Object.entries(ref.insertBefore || {})) steps.splice(find(st), 0, ...add);
  if (ref.append) steps = steps.concat(ref.append);
  return { id: ref.id || base.id + '*', name: ref.name || base.name + ' (variant)', steps, scale: ref.scale || base.scale, expect: base.expect };
}

// ---------- Step execution ----------
function runFrames(G, n, perFrame) {
  for (let f = 0; f < n; f++) { if (perFrame) perFrame(f); G.Sim.step(); G.Sim.events.length = 0; }
}

function execStep(G, step, scale) {
  const { Sim, SHELF, GW, GH } = G;
  const [cmd, a, b] = step.split(' ');
  const mods = step.split(' ');
  const pos = mods.includes('@left') ? GW * 0.25 : mods.includes('@right') ? GW * 0.75 : GW / 2;
  const withStir = mods.includes('+stir');
  const amt = (v) => parseFloat(v) * (cmd === 'pour' ? scale : 1);
  const count = (v) => Math.max(1, Math.round(parseInt(v, 10) * scale));
  let stirPhase = 0, prev = null;
  const stirFrame = () => {
    // The ladle sweeps an ellipse through whatever is in the pot (liquid, or a pile of dough).
    const top = Math.min(Sim.findSurface(), GH - 8), cy = (top + GH) / 2, ry = Math.max(3, (GH - top) / 2 - 4), rx = GW * 0.35;
    stirPhase += 0.12;
    const p = { x: Math.round(GW / 2 + Math.cos(stirPhase) * rx), y: Math.round(cy + Math.sin(stirPhase) * ry) };
    if (prev) Sim.stir(p.x, p.y, p.x - prev.x, p.y - prev.y, 6);
    prev = p;
  };
  switch (cmd) {
    case 'pour': {
      const ing = SHELF.find((s) => s.id === a);
      runFrames(G, Math.round(amt(b) * FPS), (f) => { Sim.pour(ing, Math.round(pos + ((f * 5) % 7) - 3), ing.rate); if (withStir) stirFrame(); });
      break;
    }
    case 'add': {
      const ing = SHELF.find((s) => s.id === a), n = count(b);
      let k = 0;
      runFrames(G, n * 8, (f) => { if (f % 8 === 0 && k < n) { Sim.pour(ing, Math.round(pos + (k % 2 ? 1 : -1) * (k * 3 % 24)), 1); k++; } });
      break;
    }
    case 'crack': case 'throw': {
      const n = count(b);
      let k = 0;
      runFrames(G, n * 60, (f) => {
        if (f % 60 === 0 && k < n) {
          const x = Math.round(pos + (k % 2 ? 1 : -1) * (k * 7 % 30));
          if (cmd === 'crack') { Sim.dropCrackedEgg(x); Sim.discover('crack'); }
          else if (a === 'fish') Sim.throwFish(x); else Sim.throwEgg(x);
          k++;
        }
        if (withStir) stirFrame();
      });
      break;
    }
    case 'heat': Sim.dial = parseFloat(a); break;
    case 'wait': runFrames(G, Math.round(parseFloat(a) * FPS)); break;
    case 'stir': runFrames(G, Math.round(parseFloat(a) * FPS), stirFrame); break;
    case 'lid': Sim.lid = a === 'on'; break;
    case 'taste': case 'serve': break;
    default: throw new Error('Unknown step: ' + step);
  }
}

// ---------- Run + summarize everything a check might want ----------
function cook(spec, seed = 1, scaleOverride) {
  const G = makeGame(seed);
  G.Sim.reset();
  const scale = scaleOverride || spec.scale || 1;
  for (const st of spec.steps) execStep(G, st, scale);
  const a = G.Taste.analyzeBowl();
  G.Judging.start();
  const counts = {};
  for (let i = 0; i < G.N; i++) { const m = G.Sim.mat[i]; if (m) { const k = G.MAT[m].name; counts[k] = (counts[k] || 0) + 1; } }
  const raw = {};
  G.FLAVOR_KEYS.forEach((k, n) => { raw[k] = a.rawBite ? a.rawBite[n] : 0; });
  return {
    id: spec.id, name: spec.name, seed, scale,
    type: a.type, taste: a.p, raw, flaws: a.flaws, flawSum: a.flawSum, notes: a.notes, noteLevels: { ...G.Sim.notes },
    bake: a.bake, temp: a.temp, chunkiness: a.chunkiness, crust: a.crust, counts,
    discovered: [...G.Sim.discovered],
    judges: G.Judging.results.map((r, n) => ({ judge: G.JUDGES[n].name, score: r.score, line: r.line })),
    score: G.Judging.avg, verdict: G.Judging.verdict,
    simSeconds: G.Sim.frame / FPS,
  };
}

// Pull a named metric out of a cooked result: score, judge.<name>, taste.<axis>, raw.<axis>,
// flaw.<name>, bake.<field>, count.<material>, disc.<id>, note.<id>.
const JUDGE_KEYS = { pounce: 0, biscuit: 1, nanny: 2 };
function metric(res, name) {
  const [kind, key] = name.split('.');
  switch (kind) {
    case 'score': return res.score;
    case 'judge': return res.judges[JUDGE_KEYS[key]].score;
    case 'taste': return res.taste[key];
    case 'raw': return res.raw[key];
    case 'flaw': return res.flaws[key] || 0;
    case 'bake': return res.bake ? res.bake[key] : 0;
    case 'count': return res.counts[key.replace(/_/g, ' ')] || 0;
    case 'disc': return res.discovered.includes(key) ? 1 : 0;
    case 'note': return res.noteLevels[key] || 0;
  }
  throw new Error('Unknown metric ' + name);
}

// ---------- Parallel cooking (worker threads) ----------
function cookAll(jobs, threads = Math.max(1, require('os').cpus().length - 1)) {
  return new Promise((resolveAll) => {
    const results = new Array(jobs.length);
    let next = 0, done = 0;
    if (!jobs.length) return resolveAll(results);
    const start = () => {
      const w = new Worker(__filename);
      const feed = () => { if (next < jobs.length) { const k = next++; w.postMessage({ k, job: jobs[k] }); } else w.terminate(); };
      w.on('message', ({ k, res, err }) => { results[k] = err ? { error: err } : res; if (++done === jobs.length) resolveAll(results); feed(); });
      feed();
    };
    for (let t = 0; t < Math.min(threads, jobs.length); t++) start();
  });
}

if (!isMainThread) {
  parentPort.on('message', ({ k, job }) => {
    try { parentPort.postMessage({ k, res: cook(job.spec, job.seed, job.scale) }); }
    catch (e) { parentPort.postMessage({ k, err: String(e.stack || e) }); }
  });
}

module.exports = { makeGame, loadRecipes, resolve, execStep, cook, cookAll, metric, FPS, ROOT };
