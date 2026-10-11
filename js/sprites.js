// Sprites: every piece of art an artist redraws (characters, ingredients, backgrounds), at a fixed pixel size.
//
// Each sprite is a sheet: one row per state (a mood, a pose, an animation), one column per frame, every cell
// the same size. The game draws finished art from art/sprites/<path>.png when it's listed in
// art/sprites/index.json, and falls back to the drawing code below when it isn't, so art can land a file at a time.
// tools/export-art.js renders these same drawings into art/templates/ for the artist to paint over.
//
// Coordinates: each sprite is drawn by code in its own "native" space. (ox, oy) is where the cell's top-left
// pixel sits in that space, so the sprite's anchor, native (0, 0), is cell pixel (-ox, -oy).
// Sprites.draw(g, name, state, t, x, y) puts the anchor at (x, y); t is a tick count (60 a second) for animation.

const Sprites = {
  defs: {}, byPath: {}, over: {}, cache: {},

  def(name, d) {
    d.name = name; d.ox = d.ox || 0; d.oy = d.oy || 0;
    d.order = Object.keys(d.states);
    for (const k of d.order) d.states[k] = Object.assign({ frames: 1, fps: 8, loop: true }, d.states[k]);
    this.defs[name] = d; this.byPath[d.path] = d;
  },

  // The tick a frame stands for (used to draw code templates; finished art just steps through its frames).
  tick(st, k) { return st.ticks ? st.ticks[k] : Math.round(k * 60 / st.fps); },
  frameAt(d, state, t) {
    const st = d.states[state];
    if (!st || st.frames === 1) return 0;
    const k = Math.floor((t || 0) * st.fps / 60);
    return st.loop ? ((k % st.frames) + st.frames) % st.frames : Math.max(0, Math.min(st.frames - 1, k));
  },

  // One cell as a canvas: the finished art if there is any, otherwise the code drawing.
  canvas(name, state = 'default', frame = 0) {
    const d = this.defs[name], ov = this.over[name];
    if (ov && !d.states[state]) state = d.order[0];
    const key = name + '|' + state + '|' + frame + (ov ? '|art' : '');
    let cv = this.cache[key];
    if (cv) return cv;
    cv = makeCanvas(d.w, d.h);
    const c = cv.getContext('2d');
    if (ov) c.drawImage(ov, frame * d.w, d.order.indexOf(state) * d.h, d.w, d.h, 0, 0, d.w, d.h);
    else {
      const st = d.states[state] || d.states[d.order[0]];
      c.save(); c.translate(-d.ox, -d.oy); d.render(c, state, this.tick(st, frame), null); c.restore();
      if (d.post) d.post(cv);
    }
    return (this.cache[key] = cv);
  },

  draw(g, name, state, t, x, y, ctx) {
    const d = this.defs[name];
    if (this.over[name] || d.static) {
      const s = this.over[name] && !d.states[state] ? d.order[0] : state;
      g.drawImage(this.canvas(name, s, this.frameAt(d, s, t)), Math.round(x + d.ox), Math.round(y + d.oy));
      return;
    }
    // Code drawing, live: smooth motion, and any state the code understands.
    g.save(); g.translate(Math.round(x), Math.round(y)); d.render(g, state, t, ctx); g.restore();
  },

  // Finished art: art/sprites/index.json lists the sheets that exist (tools/art-index.js writes it).
  load() {
    fetch('art/sprites/index.json').then((r) => (r.ok ? r.json() : [])).then((list) => {
      for (const path of list) {
        const d = this.byPath[path];
        if (!d) { console.warn('art: no sprite called', path); continue; }
        const img = new Image();
        img.onload = () => {
          this.settle(d.name);
          const w = d.w * Math.max(...d.order.map((k) => d.states[k].frames)), h = d.h * d.order.length;
          if (img.width !== w || img.height !== h) { console.warn(`art: ${path}.png is ${img.width}x${img.height}, expected ${w}x${h}`); return; }
          this.over[d.name] = img;
        };
        img.src = 'art/sprites/' + path + '.png';
      }
    }).catch(() => {});
  },

  // ---- Templates for the artist (tools/export-art.js) ----

  // A state whose code frames all come out the same is really one frame: the artist draws it once.
  // Done before laying out a template or reading finished art, so both agree on the sheet's shape.
  settle(name) {
    const d = this.defs[name];
    if (d.settled) return; d.settled = true;
    for (const s of d.order) {
      const st = d.states[s];
      if (st.frames === 1) continue;
      const px = (f) => { const cv = this.canvas(name, s, f); return cv.getContext('2d').getImageData(0, 0, d.w, d.h).data.join(); };
      const first = px(0);
      let same = true;
      for (let f = 1; f < st.frames && same; f++) same = px(f) === first;
      if (same) st.frames = 1;
    }
  },

  // The code drawing as a sheet, plus the facts the artist needs.
  template(name) {
    this.settle(name);
    const d = this.defs[name], cols = Math.max(...d.order.map((k) => d.states[k].frames));
    const sheet = makeCanvas(d.w * cols, d.h * d.order.length), sg = sheet.getContext('2d');
    d.order.forEach((s, r) => { for (let f = 0; f < d.states[s].frames; f++) sg.drawImage(this.canvas(name, s, f), f * d.w, r * d.h); });
    const meta = {
      name, path: d.path, group: d.path.split('/')[0], cell: [d.w, d.h], anchor: [-d.ox, -d.oy], sheet: [sheet.width, sheet.height],
      states: d.order.map((s, row) => ({ name: s, row, frames: d.states[s].frames, fps: d.states[s].frames > 1 ? d.states[s].fps : null, loop: d.states[s].frames > 1 ? d.states[s].loop : null, note: d.states[s].note || null })),
      notes: d.notes || '', guides: d.guides || [],
    };
    return { sheet, meta };
  },

  // A zoomed copy with a labelled grid, the anchor and guide lines: a picture of what goes where.
  guide(name) {
    const { sheet, meta } = this.template(name), d = this.defs[name];
    const z = d.w >= 200 ? 2 : d.h >= 60 ? 4 : 8, labW = 110, head = 34;
    const cols = sheet.width / d.w, cw = d.w * z, ch = d.h * z;
    const cv = document.createElement('canvas'); cv.width = labW + cols * cw + 1; cv.height = head + d.order.length * ch + 1;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = '#1d1b24'; c.fillRect(0, 0, cv.width, cv.height);
    c.font = '13px monospace'; c.fillStyle = '#f2e8d8'; c.textBaseline = 'top';
    c.fillText(`${meta.path}   cell ${d.w}x${d.h}   anchor ${-d.ox},${-d.oy}   x${z}`, 6, 4);
    c.fillStyle = '#9a94a8';
    for (let f = 0; f < cols; f++) c.fillText('frame ' + f, labW + f * cw + 4, 20);
    d.order.forEach((s, r) => {
      const y = head + r * ch, st = d.states[s];
      c.fillStyle = '#f2e8d8'; c.fillText(s, 6, y + 4);
      c.fillStyle = '#9a94a8'; if (st.frames > 1) c.fillText(`${st.frames}f ${st.fps}fps${st.loop ? '' : ' once'}`, 6, y + 20);
      for (let f = 0; f < cols; f++) {
        const x = labW + f * cw;
        // Checkerboard for transparency, dimmed where the row has no frame.
        for (let yy = 0; yy < ch; yy += 8) for (let xx = 0; xx < cw; xx += 8) {
          c.fillStyle = f >= st.frames ? '#15141a' : ((xx + yy) / 8) & 1 ? '#3a3844' : '#44424e';
          c.fillRect(x + xx, y + yy, Math.min(8, cw - xx), Math.min(8, ch - yy));
        }
        if (f < st.frames) c.drawImage(sheet, f * d.w, r * d.h, d.w, d.h, x, y, cw, ch);
        for (const gl of d.guides || []) {
          const gy = y + (gl.y - d.oy) * z;
          c.fillStyle = 'rgba(80,170,255,0.8)'; for (let xx = 0; xx < cw; xx += 6) c.fillRect(x + xx, gy, 3, 1);
          if (f === 0) { c.fillStyle = 'rgba(120,190,255,0.95)'; c.fillText(gl.label, x + 3, gy + 2); }
        }
        const ax = x + (-d.ox) * z + z / 2, ay = y + (-d.oy) * z + z / 2;
        c.fillStyle = 'rgba(255,60,80,0.9)'; c.fillRect(ax - 5, ay, 11, 1); c.fillRect(ax, ay - 5, 1, 11);
        c.strokeStyle = '#6a6478'; c.strokeRect(x + 0.5, y + 0.5, cw, ch);
      }
    });
    return cv;
  },

  exportAll() {
    return Object.keys(this.defs).map((name) => {
      const { sheet, meta } = this.template(name);
      return { meta, sheet: sheet.toDataURL('image/png'), guide: this.guide(name).toDataURL('image/png') };
    });
  },
};

// ======================= Characters =======================

const IDLE = { frames: 4, fps: 4 };

// The chef: body, head and face are separate, so a new mood is just a new face. Bobbing, hopping, shaking and
// the sip are the whole sprite moving (code), and his arms are drawn by code to reach the cursor.
Sprites.def('chef/body', { path: 'characters/chef/body', w: 48, h: 46, ox: -24, oy: 74, static: true,
  notes: 'His torso and coat above the pot rim. The anchor is the middle of his body line; the head sits on top (see chef/head). Arms are drawn by code from the shoulders.',
  states: { idle: {} }, render: (g) => Chef.drawBody(g) });
Sprites.def('chef/head', { path: 'characters/chef/head', w: 40, h: 52, ox: -20, oy: -36, static: true,
  notes: 'Head, ears and toque, with no face. The anchor is the center of his face; chef/face is laid over it.',
  states: { idle: {} }, render: (g) => Chef.drawHead(g) });
Sprites.def('chef/face', { path: 'characters/chef/face', w: 24, h: 22, ox: -12, oy: -8, static: true,
  notes: 'Eyes, brows, mouth, mustache and blush, drawn over chef/head. Same anchor as the head (the center of his face).',
  states: {
    idle: {}, blink: { note: 'idle with eyes shut, shown for a few frames now and then' }, happy: {}, love: { note: 'after a great taste' },
    meh: {}, worried: {}, gross: { note: 'burnt food' }, shock: {}, panic: { note: 'fire' }, angry: { note: 'flipping the pot over' },
  },
  render: (g, state) => Chef.drawFace(g, 0, 0, state) });

// Judges: one body sheet (behind the table) and one front sheet (paws/hands/props on the table), same poses.
const JUDGE_POSES = { neutral: { ...IDLE, note: 'waiting' }, tasting: { ...IDLE, note: 'spoon in mouth' }, happy: { ...IDLE, note: 'scored 7+' }, meh: { ...IDLE, note: 'scored 5-6' }, upset: { ...IDLE, note: 'scored under 5' } };
const JUDGE_EXTRA = {
  gordo: { rant: { frames: 4, fps: 12, note: 'upset and speaking: shaking with rage, jabbing a finger' } },
  paul: { handshake: { ...IDLE, note: 'offering the handshake (9+ on a dish he loves)' } },
};
function judgeCtx(id, pose, t) {
  const mood = { tasting: 'neutral', rant: 'upset', handshake: 'happy' }[pose] || pose;
  return { j: JUDGE_ROSTER[id], J: { t, typed: 0 }, s: { mood, ft: t, active: pose === 'tasting' || pose === 'rant', tasting: pose === 'tasting', handshake: pose === 'handshake' } };
}
const JUDGE_NOTES = {
  pounce: 'Sir Pounce: a snooty cat.', biscuit: 'Biscuit: an excitable pup.', nanny: 'Nanny Mae: a cozy old goat.',
  joe: 'Joe: the pizza-shop regular.', gordo: 'Gordo Hamsie: the shouty head chef (a caricature). Also used, larger, in story cutscenes.',
  paul: 'Paul Bollywood: the silver-haired baker (looks like Paul Hollywood).',
};
for (const id of ['pounce', 'biscuit', 'nanny', 'joe', 'gordo', 'paul']) {
  const poses = JSON.parse(JSON.stringify({ ...JUDGE_POSES, ...(JUDGE_EXTRA[id] || {}) }));
  const front = JSON.parse(JSON.stringify(poses));
  if (front.handshake) front.handshake = { frames: 6, fps: 12, loop: false, ticks: [0, 6, 12, 18, 24, 30], note: 'his arm reaches across the table, then holds (plays once)' };
  const render = (part) => (g, pose, t, ctx) => {
    ctx = ctx || judgeCtx(id, pose, t);
    JUDGE_ART[id][part](g, Object.assign(Object.create(ctx.j), { x: 0 }), ctx.J, ctx.s);
  };
  Sprites.def('judges/' + id, { path: 'characters/judges/' + id, w: 96, h: 128, ox: -48, oy: 0,
    notes: JUDGE_NOTES[id] + ' Body behind the judging table; everything below the table line is hidden. The anchor is the top of their slot, centered.',
    guides: [{ y: 118, label: 'table top' }], states: poses, render: render('body') });
  Sprites.def('judges/' + id + '-front', { path: 'characters/judges/' + id + '-front', w: 96, h: 48, ox: -48, oy: 96,
    notes: JUDGE_NOTES[id] + ' What rests on the table in front of them (paws, hands, props), drawn over the table. Same anchor as the body sheet.',
    guides: [{ y: 118, label: 'table top' }], states: front, render: render('front') });
}

// Papa Dom, for the story cutscenes (shown at 2x).
const DOM_IDLE = { frames: 4, fps: 2 }, DOM_TALK = { frames: 4, fps: 7.5, note: 'mouth flapping while his line types out' };
Sprites.def('story/dom', { path: 'characters/story/dom', w: 120, h: 130, ox: -60, oy: 0,
  notes: 'Papa Dom, the pizza shop owner (a Vin Diesel lookalike). Cutscene portrait, displayed at 2x. Each mood has an idle row and a talking row.',
  states: { sad: DOM_IDLE, stern: DOM_IDLE, happy: DOM_IDLE, 'sad-talk': DOM_TALK, 'stern-talk': DOM_TALK, 'happy-talk': DOM_TALK },
  render: (g, state, t, ctx) => {
    const talking = state.endsWith('-talk'), mood = state.replace('-talk', '');
    drawDom(g, 0, ctx ? ctx.J : { t }, ctx ? ctx.s : { mood, ft: t, talking, active: talking });
  } });

Sprites.def('extras/rat', { path: 'characters/extras/rat', w: 28, h: 12, ox: -17, oy: -6,
  notes: 'Scurries across the pavement outside the shop at night, left to right.',
  states: { walk: { frames: 4, fps: 15 } }, render: (g, state, t) => drawRat(g, 0, 0, t) });
Sprites.def('extras/customer', { path: 'characters/extras/customer', w: 12, h: 29, ox: -6, oy: 172, static: true,
  notes: 'Ten different customers queueing outside the shop by day, facing right. The anchor is the middle of their feet line minus 172 (they stand on the pavement).',
  states: Object.fromEntries([...Array(10).keys()].map((k) => ['c' + k, {}])), render: (g, state) => drawCustomer(g, +state.slice(1), 0) });

// ======================= Ingredients =======================

for (const ing of SHELF) {
  Sprites.def('ingredients/' + ing.id, { path: 'ingredients/' + ing.id, w: 16, h: 16, static: true, post: (cv) => outlineCanvas(cv),
    notes: `${ing.name}: on the shelf, and in the chef's hand.` + (ing.id === 'egg' ? ' Cracked: after tapping it on the rim.' : ''),
    states: ing.id === 'egg' ? { default: {}, cracked: {} } : { default: {} },
    render: (g, state) => ICON_DRAW[state === 'cracked' ? 'eggcracked' : ing.icon](g, ing.c) });
}
for (const lv of LEVELS) {
  if (!DISH_DRAW[lv.id]) continue;
  Sprites.def('dishes/' + lv.id, { path: 'ingredients/dishes/' + lv.id, w: 24, h: 16, static: true, post: (cv) => outlineCanvas(cv),
    notes: `${lv.title}, finished: its ticket on the level select board.`,
    states: { default: {} }, render: (g) => DISH_DRAW[lv.id](g) });
}

// ======================= Backgrounds =======================

const BG_NOTES = {
  kitchen: 'Sandbox kitchen. The pot, flames and everything in it are drawn on top, centered at the bottom.',
  'pizza-shop': "Papa Dom's pizza shop kitchen (Pizza Shop levels). The pot sits in the same place as the kitchen.",
  'studio-kitchen': "Souped Up's studio kitchen (First Michelin Star levels), with the faded EVERY SECOND COUNTS sign.",
};
for (const [name, theme] of [['kitchen', 'kitchen'], ['pizza-shop', 'pizza'], ['studio-kitchen', 'show']]) {
  Sprites.def('backgrounds/' + name, { path: 'backgrounds/' + name, w: W, h: H, static: true, notes: BG_NOTES[name],
    guides: [{ y: POT_TOP, label: 'pot rim' }, { y: POT_BOT, label: 'pot bottom' }],
    states: { default: {} }, render: (g) => g.drawImage(Art.buildBackground(theme), 0, 0) });
}
Sprites.def('backgrounds/stage', { path: 'backgrounds/stage', w: W, h: H, static: true,
  notes: 'The judging stage behind the judges, with a spotlight on each of the three seats (x = 76, 160, 244). The table is a separate layer.',
  states: { default: {} },
  render: (g) => {
    rect(g, 0, 0, W, H, [44, 30, 46]);
    for (let x = 0; x < W; x += 16) rect(g, x, 0, 8, 120, [52, 36, 54]);
    for (const x of JUDGE_SLOTS) {
      g.fillStyle = 'rgba(255,240,200,0.07)';
      g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x + 40, 150); g.lineTo(x - 40, 150); g.fill();
    }
  } });
Sprites.def('backgrounds/stage-table', { path: 'backgrounds/stage-table', w: W, h: H, static: true,
  notes: 'The judging table and the floor, drawn over the judges. Keep everything above the table top transparent. The bowl sits at y = 140, score cards above x+30.',
  guides: [{ y: 118, label: 'table top' }], states: { default: {} },
  render: (g) => {
    for (let y = 118; y < 160; y++) {
      const t = (y - 118) / 42, inset = 24 * (1 - t);
      rect(g, inset, y, W - inset * 2, 1, mix([250, 246, 240], [226, 218, 210], t));
    }
    rect(g, 0, 160, W, 30, [190, 40, 50]); rect(g, 0, 160, W, 2, [230, 80, 80]);
    for (let x = 4; x < W; x += 12) rect(g, x, 162, 2, 28, [170, 30, 44]);
    rect(g, 0, 190, W, 50, [36, 24, 36]);
  } });
Sprites.def('backgrounds/shop-night', { path: 'backgrounds/shop-night', w: W, h: H, static: true,
  notes: "Papa Dom's shop front at night, struggling. The neon sign's letters are drawn on the dark sign board by code (one flickers). The rat runs along y = 206.",
  states: { default: {} }, render: (g) => drawShopScene(g, true) });
Sprites.def('backgrounds/shop-day', { path: 'backgrounds/shop-day', w: W, h: H, static: true,
  notes: 'The same shop front by day, after it takes off. The neon sign is drawn by code; the queue of customers stands on the pavement in front of the window.',
  states: { default: {} }, render: (g) => drawShopScene(g, false) });
Sprites.def('backgrounds/level-select', { path: 'backgrounds/level-select', w: W, h: H, static: true,
  notes: 'The wall behind the level select board (a kitchen pass with heat lamps). The tier plates, ticket rails and tickets are drawn on top by code.',
  states: { default: {} },
  render: (g) => {
    rect(g, 0, 0, W, H, [52, 54, 64]);
    for (let y = 0; y < H; y += 12) rect(g, 0, y, W, 1, [58, 60, 70]);
    for (let x = 30; x < W; x += 64) { ellipse(g, x, 3, 10, 3, [90, 70, 60]); g.fillStyle = 'rgba(255,170,80,0.08)'; g.beginPath(); g.moveTo(x - 8, 4); g.lineTo(x + 8, 4); g.lineTo(x + 30, 30); g.lineTo(x - 30, 30); g.fill(); }
    rect(g, 0, 22, W, 2, [96, 100, 114]);
  } });

Sprites.load();
