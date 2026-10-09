#!/usr/bin/env node
// Rank the test recipes as candidate career levels: cook each on several seeds and report
// how well the judges like it, how consistently, and which techniques (discoveries) it exercises.
//
//   node tools/rank-recipes.js [--seeds=3] [--json=out.json]
'use strict';
const fs = require('fs');
const K = require('./kitchen');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((s) => s.startsWith('--' + k)); return a ? (a.includes('=') ? a.split('=')[1] : true) : d; };
const SEEDS = +opt('seeds', 3), JSON_OUT = opt('json', '');

// Discoveries that are just "something happened" rather than a cooking technique worth teaching.
const TRIVIAL = new Set(['dissolve', 'boil', 'crack', 'batter']);

(async () => {
  const all = K.loadRecipes();
  const jobs = [];
  for (const r of all) for (let s = 1; s <= SEEDS; s++) jobs.push({ spec: K.resolve(r.id, all), seed: s, id: r.id });
  const res = await K.cookAll(jobs.map(({ spec, seed }) => ({ spec, seed })));
  const rows = all.map((r) => {
    const rs = res.filter((_, k) => jobs[k].id === r.id && !res[k].error);
    const scores = rs.map((x) => x.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);
    const disc = [...new Set(rs.flatMap((x) => x.discovered))].filter((d) => !TRIVIAL.has(d));
    const always = disc.filter((d) => rs.every((x) => x.discovered.includes(d)));
    const verdicts = rs.map((x) => x.verdict);
    const flaws = Object.keys(rs[0].flaws).filter((f) => rs.every((x) => x.flaws[f] > 0.2));
    return {
      id: r.id, name: r.name, category: r.category, difficulty: r.difficulty, ingredients: r.ingredients.length,
      steps: r.steps.length, simSeconds: Math.round(rs[0].simSeconds), type: rs[0].type,
      mean: +mean.toFixed(2), sd: +sd.toFixed(2), verdicts, techniques: always, flaws,
      judges: rs[0].judges.map((j) => j.score),
    };
  });
  rows.sort((a, b) => b.mean - a.mean);
  console.log('rank  avg  ±sd   verdicts              diff  steps  sim   recipe  [techniques]  flaws');
  rows.forEach((r, n) => console.log(
    `${String(n + 1).padStart(3)}  ${r.mean.toFixed(1).padStart(4)} ${r.sd.toFixed(1).padStart(4)}  ${r.verdicts.join(',').padEnd(22)} ${r.difficulty}    ${String(r.steps).padStart(3)}  ${String(r.simSeconds).padStart(4)}s  ${r.id}  [${r.techniques.join(', ')}]${r.flaws.length ? '  ⚠ ' + r.flaws.join(',') : ''}`));
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 2));
})();
