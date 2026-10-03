#!/usr/bin/env node
// Comparison pairs: cook two versions of a dish and check that the better technique wins in the way
// it should. When a claim comes out the wrong way round, diagnose which layer is to blame:
//   RECIPE    the technique the pair is about never happened (missing key discovery)
//   CHEMISTRY the pot itself got it wrong: the raw quantity (flavor in the food, rise, flaw…) is backwards
//   ANALYSIS  the pot got it right, but perception or the judges turned it around
//
//   node tools/run-pairs.js            all pairs
//   node tools/run-pairs.js p05        pairs whose id starts with p05
//   --seeds=3                          run each side on several seeds; a claim passes on the majority
'use strict';
const fs = require('fs'), path = require('path');
const K = require('./kitchen');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((s) => s.startsWith('--' + k)); return a ? (a.includes('=') ? a.split('=')[1] : true) : d; };
const target = args.find((a) => !a.startsWith('--'));
const SEEDS = +opt('seeds', 1);

// How big a difference has to be before it counts, per kind of metric.
const EPS = { score: 0.25, judge: 0.5, taste: 0.02, raw: 0.01, bake: 0.05, count: 1, flaw: 0.05, note: 0.005, disc: 0.5 };
const eps = (m) => EPS[m.split('.')[0]];

function holds(claim, a, b) {
  const e = eps(claim.metric), d = a - b;
  switch (claim.op) {
    case '>': return d > e;
    case '<': return d < -e;
    case '>=': return d >= -e;
    case '<=': return d <= e;
    case '≈': return Math.abs(d) <= (claim.tol ?? e);
  }
  throw new Error('Unknown op ' + claim.op);
}
const avg = (rs, m) => rs.reduce((s, r) => s + K.metric(r, m), 0) / rs.length;
const f2 = (v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2));

// Perception rules that can turn a raw difference around, per taste axis (from Taste.perceive).
const PERCEPTION_NOTES = {
  salty: 'saltiness is read straight from raw salt',
  sweet: 'sweetness is boosted by salt and drowned out when salt, sour, heat or bitterness overwhelms',
  sour: 'sweetness masks sourness',
  bitter: 'salt suppresses bitterness; burnt bits add to it',
  umami: 'umami is boosted by salt and drowned out by overwhelming axes',
  rich: 'oil share adds richness (less on plates); sourness cuts it',
  heat: 'chili in oil counts ~2.4× chili in water; sugar tempers it',
  aroma: 'sourness brightens aroma; overwhelming axes drown it',
  body: 'body is read straight from thickener in the liquid',
};

function diagnose(pair, claim, A, B, results) {
  const out = [];
  // 1. Did the technique even happen?
  const missing = [];
  for (const side of ['a', 'b']) for (const ev of (pair.events || {})[side] || []) {
    const rs = side === 'a' ? A : B;
    if (!rs.some((r) => r.discovered.includes(ev))) missing.push(`${side.toUpperCase()} never triggered "${ev}"`);
  }
  if (missing.length) {
    out.push({ suspect: 'RECIPE', why: `the technique didn't happen: ${missing.join('; ')}. Fix the recipe steps (or, if they're right, the chemistry that should trigger it).` });
    return out;
  }
  const [kind, key] = claim.metric.split('.');
  if (kind === 'taste') {
    const rc = { metric: 'raw.' + key, op: claim.op, tol: claim.tol };
    const ra = avg(A, rc.metric), rb = avg(B, rc.metric);
    if (holds(rc, ra, rb)) out.push({ suspect: 'ANALYSIS', why: `in the food, raw ${key} goes the right way (A ${f2(ra)} vs B ${f2(rb)}), but perceived ${key} doesn't. Perception: ${PERCEPTION_NOTES[key]}.` });
    else out.push({ suspect: 'CHEMISTRY', why: `the food itself has the wrong difference: raw ${key} A ${f2(ra)} vs B ${f2(rb)}.` });
    return out;
  }
  if (kind === 'score' || kind === 'judge') {
    const support = results.filter((r) => r.claim !== claim && !['score', 'judge'].includes(r.claim.metric.split('.')[0]));
    const passed = support.filter((r) => r.ok);
    // What did the judges actually see differently?
    const why = [];
    const pa = A[0], pb = B[0];
    for (const ax of Object.keys(pa.taste)) { const d = avg(A, 'taste.' + ax) - avg(B, 'taste.' + ax); if (Math.abs(d) > 0.1) why.push(`${ax} ${d > 0 ? '+' : ''}${d.toFixed(2)}`); }
    for (const fl of Object.keys(pa.flaws)) { const d = avg(A, 'flaw.' + fl) - avg(B, 'flaw.' + fl); if (Math.abs(d) > 0.15) why.push(`flaw ${fl} ${d > 0 ? '+' : ''}${d.toFixed(2)}`); }
    const judges = pa.judges.map((j, n) => `${j.judge} ${j.score} vs ${pb.judges[n].score}`).join(', ');
    if (support.length && passed.length === support.length)
      out.push({ suspect: 'ANALYSIS', why: `the pot shows the intended differences (${passed.map((r) => r.claim.metric).join(', ')}), but the judges don't reward them. A−B: ${why.join(', ') || 'no big taste/flaw differences'}. Judges: ${judges}.` });
    else out.push({ suspect: support.some((r) => !r.ok) ? 'CHEMISTRY' : 'ANALYSIS', why: `A−B as judged: ${why.join(', ') || 'no big taste/flaw differences'}. Judges: ${judges}. A: "${pa.judges.map((j) => j.line).join(' / ')}"  B: "${pb.judges.map((j) => j.line).join(' / ')}"` });
    return out;
  }
  out.push({ suspect: 'CHEMISTRY', why: `the physical outcome is backwards or too small: ${claim.metric} A ${f2(avg(A, claim.metric))} vs B ${f2(avg(B, claim.metric))}.` });
  return out;
}

(async () => {
  const all = K.loadRecipes();
  let pairs = JSON.parse(fs.readFileSync(path.join(K.ROOT, 'test-recipes', 'comparisons.json'), 'utf8'));
  if (target) pairs = pairs.filter((p) => p.id.startsWith(target));
  // Cook every side on every seed, all in parallel.
  const jobs = [];
  for (const p of pairs) for (const side of ['a', 'b']) for (let s = 1; s <= SEEDS; s++) jobs.push({ p: p.id, side, spec: K.resolve(p[side], all), seed: s });
  const cooked = await K.cookAll(jobs.map(({ spec, seed }) => ({ spec, seed })));
  let ok = 0, failed = 0;
  const blame = { RECIPE: 0, CHEMISTRY: 0, ANALYSIS: 0 };
  for (const p of pairs) {
    const pick = (side) => cooked.filter((_, k) => jobs[k].p === p.id && jobs[k].side === side);
    const A = pick('a'), B = pick('b');
    const err = A.concat(B).find((r) => r.error);
    if (err) { console.log(`ERROR ${p.id}\n${err.error}`); failed++; continue; }
    const results = p.claims.map((claim) => {
      // Majority over seeds.
      let wins = 0;
      for (let s = 0; s < A.length; s++) if (holds(claim, K.metric(A[s], claim.metric), K.metric(B[s], claim.metric))) wins++;
      return { claim, ok: wins * 2 > A.length, a: avg(A, claim.metric), b: avg(B, claim.metric) };
    });
    const pass = results.every((r) => r.ok);
    pass ? ok++ : failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${p.id}   A: ${A[0].name}   B: ${B[0].name}`);
    for (const r of results) console.log(`   ${r.ok ? '✓' : '✗'} ${r.claim.metric.padEnd(18)} A ${f2(r.a).padStart(6)} ${r.claim.op} B ${f2(r.b).padStart(6)}`);
    for (const r of results) if (!r.ok) for (const d of diagnose(p, r.claim, A, B, results)) {
      blame[d.suspect]++;
      console.log(`     ⟶ ${d.suspect}: ${d.why}`);
    }
  }
  console.log(`\n${ok} pairs pass, ${failed} fail.  Suspects: ${Object.entries(blame).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  process.exit(failed ? 1 : 0);
})();
