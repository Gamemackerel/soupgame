// Probe piece physics: stirring in soup vs. smacking pieces around a dry pot.
//   node tools/debug-bodies.js            both scenarios
//   node tools/debug-bodies.js --snap     also write PNG frames to tools/out/probe-*/
const fs = require('fs'), vm = require('vm'), path = require('path'), zlib = require('zlib');
const src = ['materials', 'sim', 'reactions', 'taste'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const ctx = { console };
vm.runInNewContext(src + '\n;this.G={Sim,SHELF,GW,GH,N};', ctx);
const { Sim, SHELF, GW, GH, N } = ctx.G;
const SNAP = process.argv.includes('--snap');
const ing = (id) => SHELF.find((s) => s.id === id);

function pieces() {
  const m = new Map();
  for (let i = 0; i < N; i++) if (Sim.body[i]) { const b = Sim.body[i]; const p = m.get(b) || { n: 0, x: 0, y: 0 }; p.n++; p.x += i % GW; p.y += (i / GW) | 0; m.set(b, p); }
  return [...m.values()].map((p) => ({ x: p.x / p.n, y: p.y / p.n }));
}
function summary() {
  const ps = pieces(), xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
  const cols = new Set(xs.map((x) => Math.floor(x / (GW / 8))));
  const speed = [...Sim.bodyVel.values()].reduce((s, v) => Math.max(s, Math.hypot(v.vx, v.vy)), 0);
  return `x ${Math.min(...xs).toFixed(0)}-${Math.max(...xs).toFixed(0)}  y ${Math.min(...ys).toFixed(0)}-${Math.max(...ys).toFixed(0)}  eighths ${cols.size}/8  maxSpeed ${speed.toFixed(1)}  swirl ${Sim.swirl.toFixed(2)}`;
}
let shot = 0;
function snap(dir) {
  if (!SNAP) return;
  const out = path.join(__dirname, 'out', dir); fs.mkdirSync(out, { recursive: true });
  const data = new Uint8ClampedArray(GW * GH * 4); Sim.render(data);
  const s = 3, W2 = GW * s, H2 = GH * s, raw = Buffer.alloc((W2 * 4 + 1) * H2);
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    const p = ((y / s | 0) * GW + (x / s | 0)) * 4, a = data[p + 3] / 255, d = y * (W2 * 4 + 1) + 1 + x * 4;
    raw[d] = data[p] * a + 70 * (1 - a); raw[d + 1] = data[p + 1] * a + 74 * (1 - a); raw[d + 2] = data[p + 2] * a + 92 * (1 - a); raw[d + 3] = 255;
  }
  const crc = (buf) => { let c, r = ~0; for (const b of buf) { c = (r ^ b) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; r = (r >>> 8) ^ c; } return ~r >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const h = Buffer.alloc(13); h.writeUInt32BE(W2, 0); h.writeUInt32BE(H2, 4); h[8] = 8; h[9] = 6;
  fs.writeFileSync(path.join(out, String(shot++).padStart(2, '0') + '.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', h), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
function stir(frames, level) {
  let ph = 0, prev = null;
  for (let f = 0; f < frames; f++) {
    const top = level ?? Sim.surface, cy = (top + GH) / 2, ry = Math.max(2, (GH - top) / 2 - 3), rx = GW * 0.35;
    ph += 0.12;
    const p = { x: Math.round(GW / 2 + Math.cos(ph) * rx), y: Math.round(cy + Math.sin(ph) * ry) };
    if (prev) Sim.stir(p.x, p.y, p.x - prev.x, p.y - prev.y, 6);
    prev = p; Sim.step();
  }
}

console.log('== Soup: water + 6 carrot pieces, stir 2s, then watch it coast');
Sim.reset(); shot = 0;
for (let f = 0; f < 900; f++) { Sim.pour(ing('water'), 76 + (f % 7) - 3, 12); Sim.step(); }
for (let k = 0; k < 6; k++) { Sim.pour(ing('carrot'), 66 + k * 4, 1); for (let f = 0; f < 8; f++) Sim.step(); }
for (let f = 0; f < 300; f++) Sim.step();
console.log('  settled   ', summary()); snap('probe-soup');
stir(120); console.log('  stirred   ', summary()); snap('probe-soup');
for (let t = 1; t <= 4; t++) { for (let f = 0; f < 60; f++) Sim.step(); console.log(`  +${t}s coast `, summary()); snap('probe-soup'); }

console.log('== Dry pot: a little oil + 5 beef pieces, heat, then stir');
Sim.reset(); shot = 0;
for (let f = 0; f < 20; f++) { Sim.pour(ing('oil'), 76, 4); Sim.step(); }
for (let k = 0; k < 5; k++) { Sim.pour(ing('meat'), 60 + k * 8, 1); for (let f = 0; f < 8; f++) Sim.step(); }
Sim.dial = 7; for (let f = 0; f < 200; f++) Sim.step();
console.log('  searing   ', summary()); snap('probe-dry');
for (let k = 0; k < 4; k++) { stir(15, GH - 10); console.log('  smack     ', summary()); snap('probe-dry'); }
for (let f = 0; f < 120; f++) Sim.step();
console.log('  landed    ', summary()); snap('probe-dry');
