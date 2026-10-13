// The artist's Aseprite files: one per character (all of its game sprites as layer groups on one canvas), one for
// the ingredients, one for the dishes, one per background.
//
//   node tools/art-aseprite.js make      Creates art/aseprite/*.aseprite from art/templates (never overwrites a file
//                                        that already exists: pass --force to replace one, which loses its drawing).
//   node tools/art-aseprite.js export    Splits every art/aseprite file back into the game's sprite sheets in
//                                        art/sprites/, then registers them (tools/art-index.js).
//
// In each file:
//   - A layer GROUP per game sprite, named for it (body, head, face, front, ...). Everything visible inside a group
//     is flattened into that sprite, so the artist can use as many layers inside it as they like.
//   - A TAG per mood/pose/animation (happy, upset, tasting, ...), covering exactly the frames the game uses.
//   - Reference layers (Aseprite's own kind, never exported): the old art, faint, and guides such as the table line.
//   Anything outside the groups, or hidden, is ignored. A sprite is only exported once every one of its poses has
//   something drawn, so half-finished work never shows up blank in the game.
const fs = require('fs'), path = require('path');
const PNG = require('./png'), ASE = require('./aseprite');

const ROOT = path.join(__dirname, '..'), TPL = path.join(ROOT, 'art', 'templates'), OUT = path.join(ROOT, 'art', 'aseprite'), SPRITES = path.join(ROOT, 'art', 'sprites');
const tpl = (p) => ({ meta: JSON.parse(fs.readFileSync(path.join(TPL, p + '.json'), 'utf8')), img: PNG.decode(fs.readFileSync(path.join(TPL, p + '.png'))) });
// A cell of a template sheet.
function cell(t, state, frame) {
  const s = t.meta.states.find((x) => x.name === state) || t.meta.states[0], [w, h] = t.meta.cell, out = PNG.blank(w, h);
  PNG.blit(t.img, Math.min(frame, s.frames - 1) * w, s.row * h, w, h, out, 0, 0);
  return out;
}

// DawnBringer's 32-color palette: a common starting palette for pixel art (the artist can replace it).
const DB32 = ['000000', '222034', '45283c', '663931', '8f563b', 'df7126', 'd9a066', 'eec39a', 'fbf236', '99e550', '6abe30', '37946e', '4b692f', '524b24', '323c39', '3f3f74',
  '306082', '5b6ee1', '639bff', '5fcde4', 'cbdbfc', 'ffffff', '9badb7', '847e87', '696a6a', '595652', '76428a', 'ac3232', 'd95763', 'd77bba', '8f974a', '8a6f30'].map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16), 255]);
const TAG_COLORS = [[0, 120, 200], [200, 90, 40], [60, 160, 80], [170, 60, 160], [200, 170, 40], [60, 160, 170]];

// ---------- What goes in each file ----------
// kind 'parts': each part is one game sprite, placed by its anchor (`at`, in a shared space). Tags are the poses.
// kind 'items': one group; each tag is one sprite's state (ingredients, dishes, customers).
// `layers` lists bottom to top: { part } or { guide: name, draw(img, off) } (a reference layer).
function documents() {
  const docs = [];
  const tableGuide = (x0) => ({ guide: '_table (guide)', draw: (img, off) => { const t = tpl('backgrounds/stage-table'); PNG.blit(t.img, x0 - off.x, -off.y, img.w, img.h, img, 0, 0); } });
  const line = (y, color) => (img, off) => { for (let x = 0; x < img.w; x += 2) img.data.set(color, ((y + off.y) * img.w + x) * 4); };
  const dot = (x, y, color) => (img, off) => { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + off.x + dx, Y = y + off.y + dy; if (X >= 0 && Y >= 0 && X < img.w && Y < img.h) img.data.set(color, (Y * img.w + X) * 4); } };
  const BLUE = [80, 170, 255, 255], RED = [255, 60, 80, 255];

  docs.push({ file: 'characters/chef', kind: 'parts',
    parts: { body: { sprite: 'characters/chef/body', at: [0, 0] }, head: { sprite: 'characters/chef/head', at: [0, 62] }, face: { sprite: 'characters/chef/face', at: [0, 62] } },
    layers: [{ part: 'body' }, { part: 'head' }, { part: 'face' }, { guide: '_guides (pot rim, shoulders)', draw: (img, off) => { line(111, BLUE)(img, off); dot(-18, 88, RED)(img, off); dot(18, 88, RED)(img, off); } }] });
  for (const id of ['pounce', 'biscuit', 'nanny', 'joe', 'gordo', 'paul']) {
    docs.push({ file: 'characters/judges/' + id, kind: 'parts',
      parts: { body: { sprite: 'characters/judges/' + id, at: [0, 0] }, front: { sprite: 'characters/judges/' + id + '-front', at: [0, 0] } },
      layers: [{ part: 'body' }, tableGuide(160), { part: 'front' }] });
  }
  docs.push({ file: 'characters/dom', kind: 'parts', parts: { dom: { sprite: 'characters/story/dom', at: [0, 0] } }, layers: [{ part: 'dom' }] });
  docs.push({ file: 'characters/rat', kind: 'parts', parts: { rat: { sprite: 'characters/extras/rat', at: [0, 0] } }, layers: [{ part: 'rat' }] });
  docs.push({ file: 'characters/customers', kind: 'items', group: 'customer', items: tpl('characters/extras/customer').meta.states.map((s) => ({ sprite: 'characters/extras/customer', state: s.name, tag: s.name })) });

  const ingIds = fs.readdirSync(path.join(TPL, 'ingredients')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const ingredients = [];
  for (const id of ingIds) for (const s of tpl('ingredients/' + id).meta.states) ingredients.push({ sprite: 'ingredients/' + id, state: s.name, tag: s.name === 'default' ? id : id + '-' + s.name });
  docs.push({ file: 'ingredients', kind: 'items', group: 'ingredient', items: ingredients });
  const dishIds = fs.readdirSync(path.join(TPL, 'ingredients', 'dishes')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  docs.push({ file: 'dishes', kind: 'items', group: 'dish', items: dishIds.map((id) => ({ sprite: 'ingredients/dishes/' + id, state: 'default', tag: id })) });

  for (const bg of ['kitchen', 'pizza-shop', 'studio-kitchen', 'shop-night', 'shop-day', 'level-select']) {
    const potLines = ['kitchen', 'pizza-shop', 'studio-kitchen'].includes(bg) ? [{ guide: '_guides (pot area)', draw: (img) => { const POT = { l: 78, r: 242, t: 106, b: 206 }; for (let x = POT.l; x <= POT.r; x += 2) { img.data.set(BLUE, (POT.t * img.w + x) * 4); img.data.set(BLUE, (POT.b * img.w + x) * 4); } } }] : [];
    docs.push({ file: 'backgrounds/' + bg, kind: 'parts', parts: { background: { sprite: 'backgrounds/' + bg, at: [0, 0] } }, layers: [{ part: 'background' }, ...potLines] });
  }
  // The stage and its table, with the judges between them for reference.
  docs.push({ file: 'backgrounds/stage', kind: 'parts', parts: { stage: { sprite: 'backgrounds/stage', at: [0, 0] }, table: { sprite: 'backgrounds/stage-table', at: [0, 0] } },
    layers: [{ part: 'stage' }, { guide: '_judges (guide)', draw: (img) => ['gordo', 'paul', 'pounce'].forEach((id, n) => { const t = tpl('characters/judges/' + id); PNG.blit(cell(t, 'neutral', 0), 0, 0, 96, 128, img, [76, 160, 244][n] - 48, 0); }) }, { part: 'table' }] });
  return docs;
}

// Lay a 'parts' document out: the canvas covering every part, each part's offset, and the tags (poses).
function layout(doc) {
  const parts = Object.entries(doc.parts).map(([group, p]) => {
    const t = tpl(p.sprite), [w, h] = t.meta.cell, [ax, ay] = t.meta.anchor;
    return { group, t, w, h, x: p.at[0] - ax, y: p.at[1] - ay };
  });
  const x0 = Math.min(...parts.map((p) => p.x)), y0 = Math.min(...parts.map((p) => p.y));
  const W = Math.max(...parts.map((p) => p.x + p.w)) - x0, H = Math.max(...parts.map((p) => p.y + p.h)) - y0;
  for (const p of parts) { p.x -= x0; p.y -= y0; }
  // Poses: every state of any part with more than one, in order; a part with a single state shows it in all of them.
  const names = [];
  for (const p of parts) if (p.t.meta.states.length > 1 || parts.length === 1) for (const s of p.t.meta.states) if (!names.includes(s.name)) names.push(s.name);
  if (!names.length) names.push(parts[0].t.meta.states[0].name);
  const stateOf = (p, tag) => p.t.meta.states.find((s) => s.name === tag) || p.t.meta.states[0];
  let f = 0;
  const tags = names.map((name) => {
    const frames = Math.max(...parts.map((p) => stateOf(p, name).frames)), fps = Math.max(...parts.map((p) => stateOf(p, name).fps || 0));
    const tag = { name, from: f, to: f + frames - 1, frames, duration: fps ? Math.round(1000 / fps) : 400 };
    f += frames;
    return tag;
  });
  return { W, H, parts, tags, stateOf, off: { x: -x0, y: -y0 } };
}

// ---------- make ----------
function make(doc) {
  const layers = [], cels = [], frames = [];
  if (doc.kind === 'items') {
    const first = tpl(doc.items[0].sprite), [w, h] = first.meta.cell;
    doc.items.forEach(() => frames.push({ duration: 400 }));
    layers.push({ name: '_old art (reference)', level: 0, reference: true, locked: true, opacity: 90 });
    doc.items.forEach((it, k) => cels.push({ layer: 0, frame: k, img: cell(tpl(it.sprite), it.state, 0) }));
    layers.push({ name: doc.group, group: true, level: 0 }, { name: 'draw here', level: 1 });
    return { w, h, frames, layers, cels, palette: DB32, tags: doc.items.map((it, k) => ({ name: it.tag, from: k, to: k, color: TAG_COLORS[k % TAG_COLORS.length] })) };
  }
  const L = layout(doc);
  for (const t of L.tags) for (let k = 0; k < t.frames; k++) frames.push({ duration: t.duration });
  // The old art, all parts together, faint, at the bottom.
  layers.push({ name: '_old art (reference)', level: 0, reference: true, locked: true, opacity: 90 });
  for (const t of L.tags) for (let k = 0; k < t.frames; k++) {
    const img = PNG.blank(L.W, L.H);
    for (const ly of doc.layers) if (ly.part) { const p = L.parts.find((q) => q.group === ly.part), s = L.stateOf(p, t.name); compose(cell(p.t, s.name, Math.min(k, s.frames - 1)), img, p.x, p.y); }
    cels.push({ layer: 0, frame: t.from + k, img });
  }
  for (const ly of doc.layers) {
    if (ly.guide) {
      const img = PNG.blank(L.W, L.H); ly.draw(img, L.off);
      const idx = layers.push({ name: ly.guide, level: 0, reference: true, locked: true, opacity: 140 }) - 1;
      cels.push({ layer: idx, frame: 0, img });
      for (let f = 1; f < frames.length; f++) cels.push({ layer: idx, frame: f, link: 0 });
      continue;
    }
    layers.push({ name: ly.part, group: true, level: 0 }, { name: 'draw here', level: 1 });
  }
  return { w: L.W, h: L.H, frames, layers, cels, palette: DB32, tags: L.tags.map((t, k) => ({ name: t.name, from: t.from, to: t.to, color: TAG_COLORS[k % TAG_COLORS.length] })) };
}
// Alpha-composite src onto dst at (x, y).
function compose(src, dst, x0, y0) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const s = (y * src.w + x) * 4, X = x0 + x, Y = y0 + y;
    if (!src.data[s + 3] || X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
    dst.data.set(src.data.subarray(s, s + 4), (Y * dst.w + X) * 4);
  }
}

// ---------- export ----------
function exportDoc(doc, file) {
  const ase = ASE.read(fs.readFileSync(file)), done = [], skipped = [];
  const groupIndex = (name) => ase.layers.findIndex((l) => l.group && l.level === 0 && l.name.trim().toLowerCase() === name);
  const tagOf = (name) => ase.tags.find((t) => t.name.trim().toLowerCase() === name.toLowerCase());
  const sheets = {};   // sprite path → { meta, img, states drawn }
  const put = (sprite, state, frame, img) => {
    if (!sheets[sprite]) { const meta = tpl(sprite).meta; sheets[sprite] = { meta, img: PNG.blank(meta.sheet[0], meta.sheet[1]), missing: new Set(meta.states.map((s) => s.name)) }; }
    const sh = sheets[sprite], s = sh.meta.states.find((x) => x.name === state);
    PNG.blit(img, 0, 0, img.w, img.h, sh.img, frame * sh.meta.cell[0], s.row * sh.meta.cell[1]);
    if (!PNG.isEmpty(img)) sh.missing.delete(state);
  };
  const crop = (full, x, y, w, h) => { const out = PNG.blank(w, h); PNG.blit(full, x, y, w, h, out, 0, 0); return out; };
  if (doc.kind === 'items') {
    const g = groupIndex(doc.group);
    if (g < 0) return { done, skipped: [`no "${doc.group}" group`], warnings: ase.warnings };
    for (const it of doc.items) {
      const t = tagOf(it.tag);
      if (!t) { put(it.sprite, it.state, 0, PNG.blank(1, 1)); continue; }
      const full = ASE.renderGroup(ase, g, t.from), meta = tpl(it.sprite).meta;
      put(it.sprite, it.state, 0, crop(full, 0, 0, meta.cell[0], meta.cell[1]));
    }
  } else {
    const L = layout(doc);
    if (ase.w !== L.W || ase.h !== L.H) return { done, skipped: [`canvas is ${ase.w}x${ase.h}, expected ${L.W}x${L.H} (don't resize the canvas)`], warnings: ase.warnings };
    for (const p of L.parts) {
      const g = groupIndex(p.group);
      if (g < 0) { skipped.push(`${p.t.meta.path}: no "${p.group}" group`); continue; }
      for (const s of p.t.meta.states) {
        // The state's own tag; a single-state part (the chef's body) takes the first tag.
        const t = tagOf(s.name) || (p.t.meta.states.length === 1 ? ase.tags[0] || { from: 0 } : null);
        if (!t) { skipped.push(`${p.t.meta.path}: no "${s.name}" tag`); continue; }
        for (let k = 0; k < s.frames; k++) put(p.t.meta.path, s.name, k, crop(ASE.renderGroup(ase, g, t.from + k), p.x, p.y, p.w, p.h));
      }
    }
  }
  for (const [sprite, sh] of Object.entries(sheets)) {
    if (sh.missing.size === sh.meta.states.length) continue;   // nothing drawn yet: keep the old art
    if (sh.missing.size) { skipped.push(`${sprite}: not finished (nothing drawn for ${[...sh.missing].join(', ')})`); continue; }
    const out = path.join(SPRITES, sprite + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, PNG.encode(sh.img));
    done.push(sprite);
  }
  return { done, skipped, warnings: [...new Set(ase.warnings)] };
}

module.exports = { documents, make, exportDoc, layout };

// ---------- CLI ----------
const cmd = require.main === module ? process.argv[2] : null, force = process.argv.includes('--force');
if (cmd === 'make') {
  let made = 0, kept = 0;
  for (const doc of documents()) {
    const file = path.join(OUT, doc.file + '.aseprite');
    if (fs.existsSync(file) && !force) { kept++; continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, ASE.write(make(doc)));
    made++;
  }
  console.log(`Made ${made} Aseprite files in art/aseprite/` + (kept ? ` (kept ${kept} that already exist; --force replaces them)` : '') + '.');
} else if (cmd === 'export') {
  let total = 0;
  for (const doc of documents()) {
    const file = path.join(OUT, doc.file + '.aseprite');
    if (!fs.existsSync(file)) continue;
    const r = exportDoc(doc, file);
    total += r.done.length;
    if (r.done.length || r.skipped.length || r.warnings.length) {
      console.log(doc.file + '.aseprite');
      for (const d of r.done) console.log('  exported ' + d);
      for (const s of r.skipped) console.log('  SKIPPED  ' + s);
      for (const w of r.warnings) console.log('  note     ' + w);
    }
  }
  console.log(`Exported ${total} sprites to art/sprites/.`);
  require('./art-index');
} else if (require.main === module) {
  console.log('Usage: node tools/art-aseprite.js make [--force] | export');
}
