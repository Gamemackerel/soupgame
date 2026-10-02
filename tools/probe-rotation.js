// Probe piece rotation: a fish and veg pieces in a dry pot get smacked, then dropped in soup and swirled.
//   node tools/probe-rotation.js [--snap]   → tools/out/probe-rotation/*.png
const fs = require('fs'), vm = require('vm'), path = require('path'), zlib = require('zlib');
const src = ['materials', 'sim', 'reactions', 'taste'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const ctx = { console };
vm.runInNewContext(src + '\n;this.G={Sim,SHELF,GW,GH,N};', ctx);
const { Sim, SHELF, GW, GH, N } = ctx.G;
const SNAP = process.argv.includes('--snap');
const out = path.join(__dirname, 'out', 'probe-rotation');
if (SNAP) { fs.mkdirSync(out, { recursive: true }); for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f)); }
let shot = 0;
function snap(label) {
  if (!SNAP) return;
  const data = new Uint8ClampedArray(GW * GH * 4); Sim.render(data);
  const s = 3, W2 = GW * s, H2 = GH * s, raw = Buffer.alloc((W2 * 4 + 1) * H2);
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    const p = ((y / s | 0) * GW + (x / s | 0)) * 4, a = data[p + 3] / 255, d = y * (W2 * 4 + 1) + 1 + x * 4;
    raw[d] = data[p] * a + 70 * (1 - a); raw[d + 1] = data[p + 1] * a + 74 * (1 - a); raw[d + 2] = data[p + 2] * a + 92 * (1 - a); raw[d + 3] = 255;
  }
  const crc = (buf) => { let c, r = ~0; for (const b of buf) { c = (r ^ b) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; r = (r >>> 8) ^ c; } return ~r >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const h = Buffer.alloc(13); h.writeUInt32BE(W2, 0); h.writeUInt32BE(H2, 4); h[8] = 8; h[9] = 6;
  fs.writeFileSync(path.join(out, String(shot++).padStart(2, '0') + '-' + label + '.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', h), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const angles = () => [...Sim.bodyShape.entries()].map(([b, s]) => `${(s.shown * 22.5).toFixed(0)}°`).join(' ');
const cellsOf = () => { let n = 0; for (let i = 0; i < N; i++) if (Sim.body[i]) n++; return n; };
function stir(frames, yLevel) {
  let ph = 0, prev = null;
  for (let f = 0; f < frames; f++) {
    const top = yLevel ?? Sim.surface, cy = (top + GH) / 2, ry = Math.max(2, (GH - top) / 2 - 3), rx = GW * 0.35;
    ph += 0.12; const p = { x: Math.round(GW / 2 + Math.cos(ph) * rx), y: Math.round(cy + Math.sin(ph) * ry) };
    if (prev) Sim.stir(p.x, p.y, p.x - prev.x, p.y - prev.y, 7); prev = p; Sim.step();
  }
}
const ing = (id) => SHELF.find((s) => s.id === id);
Sim.reset();
Sim.throwFish(60); Sim.pour(ing('carrot'), 100, 1);
for (let f = 0; f < 90; f++) Sim.step();
console.log('landed      cells', cellsOf(), 'angles', angles()); snap('landed');
for (let k = 0; k < 6; k++) { stir(10, GH - 8); console.log('smack', k, '    cells', cellsOf(), 'angles', angles()); snap('smack' + k); }
for (let f = 0; f < 150; f++) Sim.step();
console.log('settled     cells', cellsOf(), 'angles', angles()); snap('settled');
const w = ing('water'); for (let f = 0; f < 720; f++) { Sim.pour(w, 76 + (f % 7) - 3, w.rate); Sim.step(); }
console.log('in water    cells', cellsOf(), 'angles', angles()); snap('water');
stir(120); console.log('swirled     cells', cellsOf(), 'angles', angles()); snap('swirled');
for (let f = 0; f < 120; f++) Sim.step(); console.log('coasting    cells', cellsOf(), 'angles', angles()); snap('coast');
