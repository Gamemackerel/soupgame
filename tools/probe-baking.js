// Probe dough and baking: ratios, saturation, kneading, rising, pot-oven bread, pancakes, dumplings.
//   node tools/probe-baking.js [--snap]   → tools/out/probe-baking/*.png
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const src = ['materials', 'sim', 'reactions', 'dough', 'taste'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const SNAP = process.argv.includes('--snap');
const out = path.join(__dirname, 'out', 'probe-baking');
if (SNAP) { fs.mkdirSync(out, { recursive: true }); for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f)); }

function world() { return new Function(src + '\n;return {Sim,SHELF,GW,GH,N,NF,MAT,F_WATER,F_GLUTEN,F_LEAVEN,F_EGG,F_BODY,F_SALTY,DOUGH,BREAD,FLOUR,BROTH,SALT,LUMP};')(); }
function snap(G, name) {
  if (!SNAP) return;
  const { Sim, GW, GH } = G, data = new Uint8ClampedArray(GW * GH * 4); Sim.render(data);
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
function kit(G) {
  const { Sim, SHELF, GW, GH } = G, ing = (id) => SHELF.find((s) => s.id === id);
  const run = (secs, each) => { for (let f = 0; f < secs * 60; f++) { if (each) each(f); Sim.step(); } };
  const pour = (id, secs, x = 76) => { const g = ing(id); run(secs, (f) => Sim.pour(g, x + ((f * 5) % 7) - 3, g.rate)); };
  const stir = (secs) => { let ph = 0, prev = null; run(secs, () => { const top = Math.min(Sim.surface, GH - 6), cy = (top + GH) / 2, ry = Math.max(2, (GH - top) / 2 - 2), rx = GW * 0.3; ph += 0.12; const p = { x: Math.round(GW / 2 + Math.cos(ph) * rx), y: Math.round(cy + Math.sin(ph) * ry) }; if (prev) Sim.stir(p.x, p.y, p.x - prev.x, p.y - prev.y, 6); prev = p; }); };
  return { run, pour, stir };
}
function doughStats(G) {
  const { Sim, N, NF, DOUGH, BREAD, FLOUR, F_WATER, F_GLUTEN, F_LEAVEN } = G;
  let d = 0, b = 0, f = 0, w = 0, gl = 0, lv = 0, crust = 0, tex = { crumbly: 0, dough: 0, sticky: 0, batter: 0 };
  for (let i = 0; i < N; i++) {
    const m = Sim.mat[i];
    if (m === FLOUR) f++;
    if (m === DOUGH || m === BREAD) {
      const ww = Sim.fl[i * NF + F_WATER]; w += ww; gl += Sim.fl[i * NF + F_GLUTEN]; lv += Sim.fl[i * NF + F_LEAVEN];
      if (m === DOUGH) { d++; tex[ww < 0.35 ? 'crumbly' : ww < 0.9 ? 'dough' : ww < 1.6 ? 'sticky' : 'batter']++; }
      else { b++; if (Sim.cook[i] >= 140) crust++; }
    }
  }
  const n = Math.max(1, d + b);
  return `flour ${f} dough ${d} baked ${b} | water ${(w / n).toFixed(2)} gluten ${(gl / n).toFixed(2)} leaven ${(lv / n).toFixed(2)} | ` +
         Object.entries(tex).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' ') +
         (b ? ` | crust ${(crust / b * 100).toFixed(0)}%` : '') + ` | rise x${(1 + (Sim.flags.risen || 0) / Math.max(1, Sim.flags.doughMade || 1)).toFixed(2)}`;
}
function scenario(name, fn) {
  const G = world(); G.Sim.reset(); const k = kit(G);
  fn(G, k);
  console.log(name.padEnd(34), doughStats(G));
  console.log(''.padEnd(34), 'discovered:', [...G.Sim.discovered].join(', '));
  snap(G, name.replace(/\W+/g, '_'));
}

scenario('stiff dough (flour 2s, water .4s)', (G, k) => { k.pour('flour', 2); k.pour('water', 0.4); k.stir(4); k.run(3); });
scenario('soft dough (flour 2s, water .8s)', (G, k) => { k.pour('flour', 2); k.pour('water', 0.8); k.stir(4); k.run(3); });
scenario('batter (flour 1s, milk 1.5s, egg)', (G, k) => { k.pour('flour', 1); k.pour('milk', 1.5); G.Sim.dropCrackedEgg(76); k.stir(5); k.run(3); });
scenario('too thin (flour .5s, water 8s)', (G, k) => { k.pour('flour', 0.5); k.pour('water', 8); k.stir(6); k.run(5);
  let body = 0, n = 0; for (let i = 0; i < G.N; i++) if (G.Sim.mat[i] === G.BROTH) { body += G.Sim.fl[i * G.NF + G.F_BODY]; n++; } console.log('    broth body avg', (body / n).toFixed(3)); });
scenario('salt saturation (water 2s, salt 8s)', (G, k) => { k.pour('water', 2); k.pour('salt', 8); k.stir(6); k.run(10);
  let s = 0; for (let i = 0; i < G.N; i++) if (G.Sim.mat[i] === G.SALT) s++; console.log('    undissolved salt grains', s); });
scenario('kneaded bread in pot oven', (G, k) => { k.pour('flour', 3); k.pour('water', 1); k.pour('salt', 0.1); k.pour('powder', 0.2); k.stir(8); k.run(2);
  G.Sim.lid = true; G.Sim.dial = 6; k.run(70); G.Sim.lid = false; k.run(1); });
scenario('unkneaded bread in pot oven', (G, k) => { k.pour('flour', 3); k.pour('water', 1); k.pour('salt', 0.1); k.pour('powder', 0.2); k.run(2);
  G.Sim.lid = true; G.Sim.dial = 6; k.run(70); G.Sim.lid = false; k.run(1); });
scenario('flatbread, open pot, no leaven', (G, k) => { k.pour('oil', 0.2); k.pour('flour', 2); k.pour('water', 0.6); k.stir(4); G.Sim.dial = 6; k.run(50); });
scenario('pancakes: batter on oiled pan', (G, k) => { k.pour('flour', 1); k.pour('milk', 1.2); G.Sim.dropCrackedEgg(76); k.pour('sugar', 0.2); k.pour('powder', 0.15); k.stir(5);
  k.pour('oil', 0.2); G.Sim.dial = 6; k.run(45); });
scenario('soda, no acid (soapy)', (G, k) => { k.pour('flour', 2); k.pour('water', 0.8); k.pour('soda', 0.2); k.stir(6); G.Sim.lid = true; G.Sim.dial = 6; k.run(60); console.log('    soapy flag', !!G.Sim.flags.soapy); });
scenario('soda + vinegar', (G, k) => { k.pour('flour', 2); k.pour('water', 0.6); k.pour('vinegar', 0.3); k.pour('soda', 0.2); k.stir(6); G.Sim.lid = true; G.Sim.dial = 6; k.run(60); });
scenario('dumplings: dough then simmer', (G, k) => { k.pour('flour', 1.5); k.pour('water', 0.5); k.pour('powder', 0.1); k.stir(6); k.pour('water', 10); G.Sim.dial = 6; k.run(60); });
