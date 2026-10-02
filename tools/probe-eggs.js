// Probe egg and fish behavior in a few scenarios; prints outcomes and writes PNGs with --snap.
//   node tools/probe-eggs.js [--snap]
const fs = require('fs'), vm = require('vm'), path = require('path'), zlib = require('zlib');
const src = ['materials', 'sim', 'reactions', 'taste'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const SNAP = process.argv.includes('--snap');

function world() {
  const ctx = { console };
  vm.runInNewContext(src + '\n;this.G={Sim,SHELF,GW,GH,N,MAT,Taste};', ctx);
  return ctx.G;
}
function counts(G) {
  const c = {};
  for (let i = 0; i < G.N; i++) { const m = G.Sim.mat[i]; if (m) { const k = G.MAT[m].name; c[k] = (c[k] || 0) + 1; } }
  delete c.broth; delete c.air; delete c.steam;
  return Object.entries(c).map(([k, v]) => `${k}:${v}`).join(' ');
}
function pieces(G) { return new Set([...G.Sim.body].filter(Boolean)).size; }
function snap(G, name) {
  if (!SNAP) return;
  const { Sim, GW, GH } = G, out = path.join(__dirname, 'out', 'probe-eggs'); fs.mkdirSync(out, { recursive: true });
  const data = new Uint8ClampedArray(GW * GH * 4); Sim.render(data);
  const s = 3, W2 = GW * s, H2 = GH * s, raw = Buffer.alloc((W2 * 4 + 1) * H2);
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    const p = ((y / s | 0) * GW + (x / s | 0)) * 4, a = data[p + 3] / 255, d = y * (W2 * 4 + 1) + 1 + x * 4;
    raw[d] = data[p] * a + 70 * (1 - a); raw[d + 1] = data[p + 1] * a + 74 * (1 - a); raw[d + 2] = data[p + 2] * a + 92 * (1 - a); raw[d + 3] = 255;
  }
  const crc = (buf) => { let c, r = ~0; for (const b of buf) { c = (r ^ b) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; r = (r >>> 8) ^ c; } return ~r >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const h = Buffer.alloc(13); h.writeUInt32BE(W2, 0); h.writeUInt32BE(H2, 4); h[8] = 8; h[9] = 6;
  fs.writeFileSync(path.join(out, name + '.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', h), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const run = (G, n, each) => { for (let f = 0; f < n; f++) { if (each) each(f); G.Sim.step(); } };
const water = (G, secs) => { const w = G.SHELF.find((s) => s.id === 'water'); run(G, secs * 60, (f) => G.Sim.pour(w, 76 + (f % 7) - 3, w.rate)); };
const oil = (G, secs) => { const o = G.SHELF.find((s) => s.id === 'oil'); run(G, secs * 60, () => G.Sim.pour(o, 76, o.rate)); };
function stir(G, frames) {
  let ph = 0, prev = null;
  run(G, frames, () => {
    const top = G.Sim.surface, cy = (top + G.GH) / 2, ry = Math.max(2, (G.GH - top) / 2 - 3), rx = G.GW * 0.35;
    ph += 0.12; const p = { x: Math.round(G.GW / 2 + Math.cos(ph) * rx), y: Math.round(cy + Math.sin(ph) * ry) };
    if (prev) G.Sim.stir(p.x, p.y, p.x - prev.x, p.y - prev.y, 6); prev = p;
  });
}
const report = (G, name) => { console.log(`  ${name.padEnd(30)} pieces ${pieces(G)}  | ${counts(G)}\n  ${''.padEnd(30)} discovered: ${[...G.Sim.discovered].join(', ')}`); snap(G, name.replace(/\W+/g, '_')); };

let G;
console.log('1. Throw a whole egg into an EMPTY pot (should splat, shell scattered)');
G = world(); G.Sim.reset(); G.Sim.throwEgg(76); run(G, 90); report(G, '1 splat empty pot');

console.log('2. Throw a whole egg into DEEP water, then boil (should survive, hard-boil)');
G = world(); G.Sim.reset(); water(G, 14); run(G, 60); G.Sim.throwEgg(76); run(G, 120); report(G, '2a landed in water');
G.Sim.dial = 7; run(G, 60 * 50); report(G, '2b after boiling 50s');

console.log('3. Crack an egg into a simmer, leave it (should poach as one piece)');
G = world(); G.Sim.reset(); water(G, 10); G.Sim.dial = 6; run(G, 60 * 30); G.Sim.dropCrackedEgg(76); run(G, 60 * 4); report(G, '3a blob sinking');
run(G, 60 * 20); report(G, '3b poached');

console.log('4. Crack two eggs into a simmer while stirring (should make ribbons)');
G = world(); G.Sim.reset(); water(G, 10); G.Sim.dial = 6; run(G, 60 * 30);
G.Sim.dropCrackedEgg(60); stir(G, 20); G.Sim.dropCrackedEgg(90); stir(G, 160); run(G, 60 * 5); report(G, '4 egg drop');

console.log('5. Crack an egg into hot oil (should fry)');
G = world(); G.Sim.reset(); oil(G, 1); G.Sim.dial = 6; run(G, 60 * 20); G.Sim.dropCrackedEgg(76); run(G, 60 * 25); report(G, '5 fried egg');

console.log('6. Throw a fish into simmering water (should poach then flake)');
G = world(); G.Sim.reset(); water(G, 12); G.Sim.dial = 6; run(G, 60 * 30); G.Sim.throwFish(76); run(G, 60 * 10); report(G, '6a fish poaching');
run(G, 60 * 50); report(G, '6b fish after 60s');

console.log('7. Throw a fish onto a hot oiled pot (should sear, crisp skin)');
G = world(); G.Sim.reset(); oil(G, 0.5); G.Sim.dial = 7; run(G, 60 * 15); G.Sim.throwFish(76); run(G, 60 * 40); report(G, '7 seared fish');
