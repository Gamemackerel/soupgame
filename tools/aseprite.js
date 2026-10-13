// Minimal .aseprite read/write for the art tools, following Aseprite's file spec
// (https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md). No dependencies.
//
// Written files are RGBA, with layers (image and group, nested by level), cels (compressed images or links to an
// earlier frame of the same layer), tags (animations) and a starter palette. Read handles RGBA, grayscale and
// indexed files, so the artist can work in any color mode.
const zlib = require('zlib');

const LAYER = { visible: 1, editable: 2, background: 8, reference: 64 };

// ---------- Writing ----------
// doc: { w, h, frames: [{ duration }], layers: [{ name, group?, level, visible?, locked?, reference?, opacity? }],
//        cels: [{ layer, frame, img: {w,h,data} } | { layer, frame, link }], tags: [{ name, from, to, color }],
//        palette: [[r,g,b,a], ...] }
function write(doc) {
  const out = [];
  const W = (n, b = 2) => { const x = Buffer.alloc(b); b === 1 ? x.writeUInt8(n & 255) : b === 2 ? x.writeUInt16LE(n & 0xffff) : x.writeUInt32LE(n >>> 0); return x; };
  const S16 = (n) => { const x = Buffer.alloc(2); x.writeInt16LE(n); return x; };
  const STR = (s) => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([W(b.length), b]); };
  const chunk = (type, body) => Buffer.concat([W(body.length + 6, 4), W(type), body]);

  const frames = doc.frames.map(() => []);
  // First frame: color profile (sRGB), palette, layers, tags.
  frames[0].push(chunk(0x2007, Buffer.concat([W(1), W(0), W(0, 4), Buffer.alloc(8)])));
  const pal = doc.palette || [[0, 0, 0, 255]];
  frames[0].push(chunk(0x2019, Buffer.concat([W(pal.length, 4), W(0, 4), W(pal.length - 1, 4), Buffer.alloc(8),
    ...pal.map(([r, g, b, a]) => Buffer.from([0, 0, r, g, b, a === undefined ? 255 : a]))])));
  for (const L of doc.layers) {
    const flags = (L.visible === false ? 0 : LAYER.visible) | (L.locked ? 0 : LAYER.editable) | (L.reference ? LAYER.reference : 0);
    frames[0].push(chunk(0x2004, Buffer.concat([W(flags), W(L.group ? 1 : 0), W(L.level || 0), W(0), W(0), W(0),
      Buffer.from([L.opacity === undefined ? 255 : L.opacity, 0, 0, 0]), STR(L.name)])));
  }
  if (doc.tags && doc.tags.length) {
    frames[0].push(chunk(0x2018, Buffer.concat([W(doc.tags.length), Buffer.alloc(8), ...doc.tags.map((t) => {
      const c = t.color || [0, 0, 0];
      return Buffer.concat([W(t.from), W(t.to), Buffer.from([0]), W(0), Buffer.alloc(6), Buffer.from([c[0], c[1], c[2], 0]), STR(t.name)]);
    })])));
  }
  // Cels: images trimmed to what's drawn (empty ones are left out), or links.
  for (const c of doc.cels) {
    if (c.link !== undefined) { frames[c.frame].push(chunk(0x2005, Buffer.concat([W(c.layer), S16(c.x || 0), S16(c.y || 0), Buffer.from([255]), W(1), S16(0), Buffer.alloc(5), W(c.link)]))); continue; }
    const t = trim(c.img);
    if (!t) continue;
    const px = Buffer.alloc(t.w * t.h * 4);
    for (let y = 0; y < t.h; y++) Buffer.from(c.img.data.buffer, c.img.data.byteOffset + ((t.y + y) * c.img.w + t.x) * 4, t.w * 4).copy(px, y * t.w * 4);
    frames[c.frame].push(chunk(0x2005, Buffer.concat([W(c.layer), S16((c.x || 0) + t.x), S16((c.y || 0) + t.y), Buffer.from([255]), W(2), S16(0), Buffer.alloc(5),
      W(t.w), W(t.h), zlib.deflateSync(px)])));
  }
  for (let f = 0; f < frames.length; f++) {
    const body = Buffer.concat(frames[f]);
    out.push(Buffer.concat([W(body.length + 16, 4), W(0xf1fa), W(Math.min(0xffff, frames[f].length)), W(doc.frames[f].duration || 100), Buffer.alloc(2), W(frames[f].length, 4), body]));
  }
  const frameData = Buffer.concat(out);
  const header = Buffer.concat([W(128 + frameData.length, 4), W(0xa5e0), W(doc.frames.length), W(doc.w), W(doc.h), W(32), W(1, 4), W(100),
    W(0, 4), W(0, 4), Buffer.from([0, 0, 0, 0]), W(pal.length > 255 ? 0 : pal.length), Buffer.from([1, 1]), S16(0), S16(0), W(0), W(0), Buffer.alloc(84)]);
  return Buffer.concat([header, frameData]);
}

// The drawn part of an image: { x, y, w, h }, or null if it's all transparent.
function trim(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ---------- Reading ----------
function read(buf) {
  if (buf.readUInt16LE(4) !== 0xa5e0) throw new Error('not an .aseprite file');
  const nFrames = buf.readUInt16LE(6), w = buf.readUInt16LE(8), h = buf.readUInt16LE(10), depth = buf.readUInt16LE(12), hflags = buf.readUInt32LE(14);
  const transparent = buf[28];
  const doc = { w, h, depth, frames: [], layers: [], cels: [], tags: [], palette: [], warnings: [] };
  let p = 128;
  for (let f = 0; f < nFrames; f++) {
    const size = buf.readUInt32LE(p), oldN = buf.readUInt16LE(p + 6), dur = buf.readUInt16LE(p + 8), newN = buf.readUInt32LE(p + 12);
    doc.frames.push({ duration: dur });
    let q = p + 16;
    const n = newN || oldN;
    for (let k = 0; k < n; k++) {
      const csize = buf.readUInt32LE(q), type = buf.readUInt16LE(q + 4), d = buf.subarray(q + 6, q + csize);
      if (type === 0x2004) {
        const nameLen = d.readUInt16LE(16);
        doc.layers.push({ flags: d.readUInt16LE(0), group: d.readUInt16LE(2) === 1, tilemap: d.readUInt16LE(2) === 2, level: d.readUInt16LE(4), blend: d.readUInt16LE(10),
          opacity: hflags & 1 ? d[12] : 255, name: d.toString('utf8', 18, 18 + nameLen) });
      } else if (type === 0x2005) {
        const layer = d.readUInt16LE(0), x = d.readInt16LE(2), y = d.readInt16LE(4), opacity = d[6], ctype = d.readUInt16LE(7), z = d.readInt16LE(9);
        if (z) doc.warnings.push(`frame ${f + 1}: a cel uses z-index (ignored)`);
        if (ctype === 1) doc.cels.push({ layer, frame: f, link: d.readUInt16LE(16) });
        else if (ctype === 0 || ctype === 2) {
          const cw = d.readUInt16LE(16), ch = d.readUInt16LE(18), raw = ctype === 2 ? zlib.inflateSync(d.subarray(20)) : d.subarray(20);
          doc.cels.push({ layer, frame: f, x, y, opacity, img: { w: cw, h: ch, raw } });
        } else doc.warnings.push(`frame ${f + 1}: tilemap cels aren't supported (ignored)`);
      } else if (type === 0x2018) {
        let r = 10;
        for (let t = d.readUInt16LE(0); t > 0; t--) { const from = d.readUInt16LE(r), to = d.readUInt16LE(r + 2), nl = d.readUInt16LE(r + 17); doc.tags.push({ from, to, name: d.toString('utf8', r + 19, r + 19 + nl) }); r += 19 + nl; }
      } else if (type === 0x2019) {
        const first = d.readUInt32LE(4), last = d.readUInt32LE(8);
        let r = 20;
        for (let i = first; i <= last; i++) { const fl = d.readUInt16LE(r); doc.palette[i] = [d[r + 2], d[r + 3], d[r + 4], d[r + 5]]; r += 6; if (fl & 1) r += 2 + d.readUInt16LE(r); }
      } else if ((type === 0x0004 || type === 0x0011) && !doc.palette.length) {
        let r = 2, i = 0;
        for (let pk = d.readUInt16LE(0); pk > 0; pk--) { i += d[r]; let c = d[r + 1] || 256; r += 2; for (; c > 0; c--, i++, r += 3) doc.palette[i] = type === 4 ? [d[r], d[r + 1], d[r + 2], 255] : [d[r] * 4, d[r + 1] * 4, d[r + 2] * 4, 255]; }
      }
      q += csize;
    }
    p += size;
  }
  // Pixels to RGBA, whatever the color mode.
  for (const c of doc.cels) {
    if (!c.img) continue;
    const { w: cw, h: ch, raw } = c.img, data = new Uint8Array(cw * ch * 4), bg = doc.layers[c.layer] && doc.layers[c.layer].flags & LAYER.background;
    for (let i = 0; i < cw * ch; i++) {
      if (depth === 32) { data[i * 4] = raw[i * 4]; data[i * 4 + 1] = raw[i * 4 + 1]; data[i * 4 + 2] = raw[i * 4 + 2]; data[i * 4 + 3] = raw[i * 4 + 3]; }
      else if (depth === 16) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = raw[i * 2]; data[i * 4 + 3] = raw[i * 2 + 1]; }
      else { const k = raw[i], col = doc.palette[k] || [0, 0, 0, 255]; if (k === transparent && !bg) continue; data.set([col[0], col[1], col[2], col[3]], i * 4); }
    }
    c.img = { w: cw, h: ch, data };
  }
  // Linked cels point at the cel they share.
  const at = new Map(doc.cels.map((c) => [c.layer + ':' + c.frame, c]));
  for (const c of doc.cels) if (c.link !== undefined) { const src = at.get(c.layer + ':' + c.link); if (src && src.img) Object.assign(c, { x: src.x, y: src.y, opacity: src.opacity, img: src.img }); }
  doc.cel = (layer, frame) => { const c = at.get(layer + ':' + frame); return c && c.img ? c : null; };
  return doc;
}

// Flatten everything visible inside group layer `g` (by index) for one frame, normal blending, onto a w×h image.
// Reference layers and hidden layers (or layers inside hidden subgroups) are skipped, as in Aseprite's own exports.
function renderGroup(doc, g, frame) {
  const out = { w: doc.w, h: doc.h, data: new Uint8Array(doc.w * doc.h * 4) }, base = doc.layers[g].level;
  const stack = [];   // opacity and visibility of the subgroups we're inside
  for (let i = g + 1; i < doc.layers.length && doc.layers[i].level > base; i++) {
    const L = doc.layers[i];
    while (stack.length && stack[stack.length - 1].level >= L.level) stack.pop();
    const hidden = !(L.flags & LAYER.visible) || stack.some((s) => s.hidden) || L.flags & LAYER.reference;
    const op = stack.reduce((a, s) => a * s.opacity / 255, L.opacity / 255);
    if (L.group) { stack.push({ level: L.level, hidden, opacity: L.opacity }); continue; }
    if (hidden) continue;
    if (L.blend) doc.warnings.push(`layer "${L.name}" uses a blend mode other than Normal (drawn as Normal)`);
    const c = doc.cel(i, frame);
    if (!c) continue;
    const a0 = op * c.opacity / 255;
    for (let y = 0; y < c.img.h; y++) for (let x = 0; x < c.img.w; x++) {
      const X = c.x + x, Y = c.y + y;
      if (X < 0 || Y < 0 || X >= out.w || Y >= out.h) continue;
      const s = (y * c.img.w + x) * 4, d = (Y * out.w + X) * 4, sa = c.img.data[s + 3] / 255 * a0;
      if (!sa) continue;
      const da = out.data[d + 3] / 255, oa = sa + da * (1 - sa);
      for (let k = 0; k < 3; k++) out.data[d + k] = Math.round((c.img.data[s + k] * sa + out.data[d + k] * da * (1 - sa)) / oa);
      out.data[d + 3] = Math.round(oa * 255);
    }
  }
  return out;
}

module.exports = { write, read, renderGroup, trim, LAYER };
