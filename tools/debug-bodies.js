// Quick probe: drop pieces into water, stir, and print where they end up.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['materials', 'sim', 'reactions', 'taste'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const ctx = { console };
vm.runInNewContext(src + '\n;this.G={Sim,SHELF,GW,GH,N};', ctx);
const { Sim, SHELF, GW, GH, N } = ctx.G;
const ing = (id) => SHELF.find((s) => s.id === id);
const pieces = () => {
  const m = new Map();
  for (let i = 0; i < N; i++) if (Sim.body[i]) { const b = Sim.body[i]; const p = m.get(b) || { n: 0, x: 0, y: 0 }; p.n++; p.x += i % GW; p.y += (i / GW) | 0; m.set(b, p); }
  return [...m.values()].map((p) => `(${(p.x / p.n).toFixed(0)},${(p.y / p.n).toFixed(0)})x${p.n}`).join(' ');
};
Sim.reset();
for (let f = 0; f < 900; f++) { Sim.pour(ing('water'), 76 + (f % 7) - 3, 7); Sim.step(); }
for (let k = 0; k < 4; k++) { Sim.pour(ing('garlic'), 70 + k * 4, 1); for (let f = 0; f < 8; f++) Sim.step(); }
for (let f = 0; f < 300; f++) Sim.step();
console.log('surface', Sim.surface, 'settled:', pieces());
let ph = 0, prev = null;
for (let f = 0; f < 120; f++) {
  const top = Sim.surface, cy = (top + GH) / 2, ry = Math.max(3, (GH - top) / 2 - 4), rx = GW * 0.35;
  ph += 0.12; const p = { x: Math.round(GW / 2 + Math.cos(ph) * rx), y: Math.round(cy + Math.sin(ph) * ry) };
  if (prev) Sim.stir(p.x, p.y, p.x - prev.x, p.y - prev.y, 6); prev = p; Sim.step();
  if (f % 30 === 29) console.log('stir f', f + 1, 'swirl', Sim.swirl.toFixed(2), pieces());
}
for (let f = 0; f < 300; f++) { Sim.step(); if (f % 100 === 99) console.log('after', f + 1, 'swirl', Sim.swirl.toFixed(2), pieces()); }
