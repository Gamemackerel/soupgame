#!/usr/bin/env node
// Summarizes playtest logs (Settings → COPY PLAYTEST LOG in the game, saved to text files): per dish, how many tries,
// the scores, badges and passes, how long they took against the time limit, and what most often went wrong.
//
//   node tools/read-playlog.js log1.txt [log2.txt ...]
'use strict';
const fs = require('fs');

const files = process.argv.slice(2);
if (!files.length) { console.log('usage: node tools/read-playlog.js <log.txt> [...]'); process.exit(1); }
const entries = files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('{')).map((l) => ({ ...JSON.parse(l), file: f })));
const by = {};
for (const e of entries) (by[e.dish] = by[e.dish] || []).push(e);

const count = (list) => { const c = {}; for (const x of list) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '); };
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
console.log(`${entries.length} dishes from ${files.length} log${files.length === 1 ? '' : 's'}\n`);
for (const [dish, es] of Object.entries(by)) {
  const scores = es.map((e) => e.score), best = Math.max(...scores);
  console.log(`${dish}: ${es.length} tr${es.length === 1 ? 'y' : 'ies'}, avg ${avg(scores).toFixed(1)}, best ${best}` +
    (dish === 'sandbox' ? '' : `, passed ${es.filter((e) => e.passed).length}, good ${es.filter((e) => e.badge).length}, perfect ${es.filter((e) => e.badge === 'perfect').length}`));
  console.log(`  scores: ${scores.join(' ')}`);
  if (es[0].limit) console.log(`  time: avg ${Math.round(avg(es.map((e) => e.secs)))}s of ${es[0].limit}s, timed out ${es.filter((e) => e.secs >= e.limit - 1).length}`);
  const spread = es.map((e) => Object.values(e.judges).filter((v) => v != null)).filter((v) => v.length > 1).map((v) => Math.max(...v) - Math.min(...v));
  if (spread.length) console.log(`  judges disagree by ${avg(spread).toFixed(1)} on average`);
  const lines = [['missing technique', es.flatMap((e) => e.missing)], ['forbidden technique', es.flatMap((e) => e.slipped)], ['left out', es.flatMap((e) => e.missingIng)],
    ['flaw', es.flatMap((e) => e.flaws)], ['off on', es.map((e) => e.gap).filter(Boolean).map((g) => g.replace(/[-+][\d.]+$/, (m) => (m[0] === '+' ? ' (too much)' : ' (too little)')))],
    ['flourish', es.flatMap((e) => e.flourish)], ['not the dish', es.filter((e) => e.wrongDish).map(() => 'yes')]];
  for (const [label, list] of lines) if (list.length) console.log(`  ${label}: ${count(list)}`);
  console.log('');
}
