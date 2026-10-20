// The artist's Aseprite files, read in the browser for the scene preview (art/preview.html). A port of
// tools/aseprite.js (read, renderGroup) and of exportDoc in tools/art-aseprite.js: it turns a file into the game's
// sprite sheets, following art/preview/docs.json (node tools/art-aseprite.js manifest).
'use strict';
const AsePreview = (() => {
  const LAYER = { visible: 1, background: 8, reference: 64 };

  async function inflate(bytes) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')));
    return new Uint8Array(await out.arrayBuffer());
  }

  // ---------- Reading ----------
  async function read(arrayBuffer) {
    const b = new Uint8Array(arrayBuffer), v = new DataView(arrayBuffer);
    const u16 = (p) => v.getUint16(p, true), i16 = (p) => v.getInt16(p, true), u32 = (p) => v.getUint32(p, true);
    const str = (p, n) => new TextDecoder().decode(b.subarray(p, p + n));
    if (u16(4) !== 0xa5e0) throw new Error('not an .aseprite file');
    const nFrames = u16(6), w = u16(8), h = u16(10), depth = u16(12), hflags = u32(14), transparent = b[28];
    const doc = { w, h, depth, frames: [], layers: [], cels: [], tags: [], palette: [], warnings: [] };
    let p = 128;
    for (let f = 0; f < nFrames; f++) {
      const size = u32(p), oldN = u16(p + 6), newN = u32(p + 12);
      doc.frames.push({});
      let q = p + 16;
      for (let k = 0, n = newN || oldN; k < n; k++) {
        const csize = u32(q), type = u16(q + 4), d = q + 6;
        if (type === 0x2004) {
          doc.layers.push({ flags: u16(d), group: u16(d + 2) === 1, level: u16(d + 4), blend: u16(d + 10), opacity: hflags & 1 ? b[d + 12] : 255, name: str(d + 18, u16(d + 16)) });
        } else if (type === 0x2005) {
          const layer = u16(d), x = i16(d + 2), y = i16(d + 4), opacity = b[d + 6], ctype = u16(d + 7);
          if (ctype === 1) doc.cels.push({ layer, frame: f, link: u16(d + 16) });
          else if (ctype === 0 || ctype === 2) {
            const cw = u16(d + 16), ch = u16(d + 18), bytes = b.slice(d + 20, q + csize);
            doc.cels.push({ layer, frame: f, x, y, opacity, img: { w: cw, h: ch, bytes, zipped: ctype === 2 } });
          } else doc.warnings.push(`frame ${f + 1}: tilemap cels aren't supported (ignored)`);
        } else if (type === 0x2018) {
          let r = d + 10;
          for (let t = u16(d); t > 0; t--) { const nl = u16(r + 17); doc.tags.push({ from: u16(r), to: u16(r + 2), name: str(r + 19, nl) }); r += 19 + nl; }
        } else if (type === 0x2019) {
          let r = d + 20;
          for (let i = u32(d + 4), last = u32(d + 8); i <= last; i++) { const fl = u16(r); doc.palette[i] = [b[r + 2], b[r + 3], b[r + 4], b[r + 5]]; r += 6; if (fl & 1) r += 2 + u16(r); }
        } else if ((type === 0x0004 || type === 0x0011) && !doc.palette.length) {
          let r = d + 2, i = 0;
          for (let pk = u16(d); pk > 0; pk--) { i += b[r]; let c = b[r + 1] || 256; r += 2; for (; c > 0; c--, i++, r += 3) doc.palette[i] = type === 4 ? [b[r], b[r + 1], b[r + 2], 255] : [b[r] * 4, b[r + 1] * 4, b[r + 2] * 4, 255]; }
        }
        q += csize;
      }
      p += size;
    }
    // Pixels to RGBA, whatever the color mode.
    for (const c of doc.cels) {
      if (!c.img) continue;
      const { w: cw, h: ch } = c.img, raw = c.img.zipped ? await inflate(c.img.bytes) : c.img.bytes, data = new Uint8ClampedArray(cw * ch * 4);
      const bg = doc.layers[c.layer] && doc.layers[c.layer].flags & LAYER.background;
      for (let i = 0; i < cw * ch; i++) {
        if (depth === 32) data.set(raw.subarray(i * 4, i * 4 + 4), i * 4);
        else if (depth === 16) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = raw[i * 2]; data[i * 4 + 3] = raw[i * 2 + 1]; }
        else { const k = raw[i], col = doc.palette[k] || [0, 0, 0, 255]; if (k === transparent && !bg) continue; data.set(col, i * 4); }
      }
      c.img = { w: cw, h: ch, data };
    }
    const at = new Map(doc.cels.map((c) => [c.layer + ':' + c.frame, c]));
    for (const c of doc.cels) if (c.link !== undefined) { const src = at.get(c.layer + ':' + c.link); if (src && src.img) Object.assign(c, { x: src.x, y: src.y, opacity: src.opacity, img: src.img }); }
    doc.cel = (layer, frame) => { const c = at.get(layer + ':' + frame); return c && c.img ? c : null; };
    return doc;
  }

  // Everything visible inside group layer g, flattened for one frame (reference and hidden layers skipped).
  function renderGroup(doc, g, frame) {
    const out = { w: doc.w, h: doc.h, data: new Uint8ClampedArray(doc.w * doc.h * 4) }, base = doc.layers[g].level, stack = [];
    for (let i = g + 1; i < doc.layers.length && doc.layers[i].level > base; i++) {
      const L = doc.layers[i];
      while (stack.length && stack[stack.length - 1].level >= L.level) stack.pop();
      const hidden = !(L.flags & LAYER.visible) || stack.some((s) => s.hidden) || L.flags & LAYER.reference;
      const op = stack.reduce((a, s) => a * s.opacity / 255, L.opacity / 255);
      if (L.group) { stack.push({ level: L.level, hidden, opacity: L.opacity }); continue; }
      const c = !hidden && doc.cel(i, frame);
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

  // ---------- Which file is this? ----------
  // By name first ("_chef copy.aseprite" or "kenji-v2.aseprite" count), then by its layer groups and canvas size.
  function identify(manifest, fileName, doc) {
    const base = fileName.toLowerCase().replace(/\.aseprite$|\.ase$/, '').replace(/^[^a-z]+/, '');
    const byName = manifest.docs.filter((d) => base.startsWith(d.file.split('/').pop())).sort((a, b) => b.file.length - a.file.length)[0];
    if (byName) return byName;
    const groups = doc.layers.filter((l) => l.group && l.level === 0).map((l) => l.name.trim().toLowerCase()).sort().join();
    const fits = manifest.docs.filter((d) => (d.kind === 'items' ? groups.includes(d.group) : d.groups.slice().sort().join() === groups && d.w === doc.w && d.h === doc.h));
    return fits.length === 1 ? fits[0] : null;
  }

  // ---------- Export ----------
  // The finished sheets in a file: { sprite path: ImageData }, plus what was held back and why (as the game's export).
  function exportDoc(manifest, mdoc, ase) {
    const groupIndex = (name) => ase.layers.findIndex((l) => l.group && l.level === 0 && l.name.trim().toLowerCase() === name);
    const tagOf = (name) => ase.tags.find((t) => t.name.trim().toLowerCase() === name.toLowerCase());
    const sheets = {}, done = {}, skipped = [];
    const crop = (full, x, y, w, h) => {
      const out = { w, h, data: new Uint8ClampedArray(w * h * 4) };
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const X = x + c, Y = y + r;
        if (X < 0 || Y < 0 || X >= full.w || Y >= full.h) continue;
        out.data.set(full.data.subarray((Y * full.w + X) * 4, (Y * full.w + X) * 4 + 4), (r * w + c) * 4);
      }
      return out;
    };
    const empty = (img) => { for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) return false; return true; };
    const put = (sprite, state, frame, img) => {
      const meta = manifest.sprites[sprite];
      if (!sheets[sprite]) sheets[sprite] = { meta, data: new Uint8ClampedArray(meta.sheet[0] * meta.sheet[1] * 4), missing: new Set(meta.states.map((s) => s.name)) };
      const sh = sheets[sprite], s = meta.states.find((x) => x.name === state), [cw, ch] = meta.cell;
      for (let r = 0; r < img.h; r++) sh.data.set(img.data.subarray(r * img.w * 4, (r + 1) * img.w * 4), ((s.row * ch + r) * meta.sheet[0] + frame * cw) * 4);
      if (frame === 0 && !empty(img)) sh.missing.delete(state);
    };
    if (mdoc.kind === 'items') {
      const g = groupIndex(mdoc.group);
      if (g < 0) return { done, skipped: [`no "${mdoc.group}" group`] };
      for (const it of mdoc.items) {
        const t = tagOf(it.tag);
        if (!t) continue;
        const [cw, ch] = manifest.sprites[it.sprite].cell;
        put(it.sprite, it.state, 0, crop(renderGroup(ase, g, t.from), 0, 0, cw, ch));
      }
    } else {
      if (ase.w !== mdoc.w || ase.h !== mdoc.h) return { done, skipped: [`the canvas is ${ase.w}x${ase.h}, but should be ${mdoc.w}x${mdoc.h} (don't resize the canvas)`] };
      for (const p of mdoc.parts) {
        const g = groupIndex(p.group);
        if (g < 0) { skipped.push(`${p.sprite}: no "${p.group}" group`); continue; }
        for (const s of p.states) {
          const t = s.tag && tagOf(s.tag);
          if (!t) { skipped.push(`${p.sprite}: no "${s.tag || s.name}" tag`); continue; }
          let prev = null;
          for (let k = 0; k < s.frames; k++) {
            let img = crop(renderGroup(ase, g, t.from + k), p.x, p.y, p.w, p.h);
            if (k && prev && empty(img)) img = prev;
            put(p.sprite, s.name, k, img); prev = img;
          }
        }
      }
    }
    for (const [sprite, sh] of Object.entries(sheets)) {
      if (sh.missing.size === sh.meta.states.length) continue;   // nothing drawn yet
      if (sh.missing.size) { skipped.push(`${sprite}: not finished (nothing drawn for ${[...sh.missing].join(', ')})`); continue; }
      done[sprite] = new ImageData(sh.data, sh.meta.sheet[0], sh.meta.sheet[1]);
    }
    return { done, skipped };
  }

  return { read, renderGroup, identify, exportDoc };
})();
