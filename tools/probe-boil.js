// Probe a rolling boil and overflow: do pieces get carried around, does a brim-full pot spill?
//   node tools/probe-boil.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['materials', 'sim', 'reactions', 'dough', 'taste'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const ctx = { console };
vm.runInNewContext(src + '\n;this.G={Sim,SHELF,GW,GH,N,BROTH};', ctx);
const { Sim, SHELF, GW, GH, N, BROTH } = ctx.G;
const ing = (id) => SHELF.find((s) => s.id === id);
const count = (m) => { let n = 0; for (let i = 0; i < N; i++) if (Sim.mat[i] === m) n++; return n; };
const water = (secs) => { const w = ing('water'); for (let f = 0; f < secs * 60; f++) { Sim.pour(w, 76 + (f % 7) - 3, w.rate); Sim.step(); } };
const run = (secs, each) => { for (let f = 0; f < secs * 60; f++) { if (each) each(f); Sim.step(); } };
function pieces() {
  const m = new Map();
  for (let i = 0; i < N; i++) if (Sim.body[i]) { const b = Sim.body[i]; const p = m.get(b) || { n: 0, x: 0, y: 0 }; p.n++; p.x += i % GW; p.y += (i / GW) | 0; m.set(b, p); }
  return [...m.values()].map((p) => [p.x / p.n, p.y / p.n]);
}

console.log('== Rolling boil, no stirring: do pieces travel?');
Sim.reset(); water(12);
for (let k = 0; k < 6; k++) { Sim.pour(ing('carrot'), 60 + k * 6, 1); run(0.15); }
Sim.dial = 3; run(10);
const before = pieces();
Sim.dial = 9; run(20);
let travelled = 0;
const track = [];
run(30, (f) => { if (f % 30 === 0) track.push(pieces()); });
const after = pieces();
for (let k = 0; k < Math.min(before.length, after.length); k++) travelled += Math.hypot(after[k][0] - before[k][0], after[k][1] - before[k][1]);
let walked = 0; for (let t = 1; t < track.length; t++) for (let k = 0; k < Math.min(track[t].length, track[t - 1].length); k++) walked += Math.hypot(track[t][k][0] - track[t - 1][k][0], track[t][k][1] - track[t - 1][k][1]);
console.log(`  turb ${Sim.turb.toFixed(2)}, flows ${Sim.flowList.length}, avg path per piece over 30s: ${(walked / after.length).toFixed(0)} cells, x range ${Math.min(...after.map((p) => p[0])).toFixed(0)}-${Math.max(...after.map((p) => p[0])).toFixed(0)}`);

console.log('== Brim-full pot boiling over');
Sim.reset(); water(40); while (Sim.findSurface() > 1) water(2); const full = count(BROTH); Sim.spilled = 0;
Sim.dial = 9; run(40);
console.log(`  broth ${full} → ${count(BROTH)}, spilled ${Sim.spilled} cells, surface row ${Sim.findSurface()}`);

console.log('== Pouring into a full pot');
Sim.reset(); water(40); Sim.spilled = 0; water(5);
console.log(`  spilled while pouring: ${Sim.spilled}`);
