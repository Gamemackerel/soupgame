// Story mode cutscenes: character portraits with a dramatic vignette, typed-out dialogue, timed picture
// shots and fades. Each scene plays once (Progress remembers it); Story.play(id, done) runs one.

// ---------- Papa Dom: the pizza shop's owner. Bald, stubbled, built like a truck, all about family. ----------
const DOM = { skin: [214, 168, 136], tank: [244, 242, 236], apron: [196, 50, 44], chain: [232, 196, 90] };

function drawDom(g, x, J, s) {
  const { mood, ft } = s, hx = x, hy = 58 + Math.round(Math.sin(ft * 0.05));
  const skin = DOM.skin, shade = rgb(skin, 0.8);
  // Huge shoulders, white ribbed tank top, red apron over it.
  ellipse(g, x, 108, 34, 22, rgb(skin, 0.6)); ellipse(g, x, 108, 33, 21, skin);   // shoulders and arms
  rect(g, x - 18, 88, 36, 36, DOM.tank);
  for (let k = 0; k < 8; k++) rect(g, x - 16 + k * 4, 92, 1, 30, [226, 224, 216]);  // ribbing
  rect(g, x - 15, 102, 30, 24, DOM.apron); rect(g, x - 15, 102, 30, 2, rgb(DOM.apron, 1.2));
  rect(g, x - 15, 101, 2, -14, DOM.apron); rect(g, x + 13, 101, 2, -14, DOM.apron);   // apron straps
  // Thick neck and a thin gold chain.
  rect(g, hx - 10, hy + 10, 20, 82 - hy - 6, shade);
  for (let k = -6; k <= 6; k++) rect(g, hx + k, 90 + Math.round(Math.abs(k) * -0.4) + 2, 1, 1, DOM.chain);
  // Big bald head with a shine, heavy brow ridge, stubble along the jaw.
  ball(g, hx, hy, 17, skin);
  rect(g, hx - 13, hy + 5, 26, 9, skin); ellipse(g, hx, hy + 13, 13, 5, skin);   // square jaw
  ball(g, hx - 17, hy + 2, 3, skin, false); ball(g, hx + 17, hy + 2, 3, skin, false);
  ellipse(g, hx - 6, hy - 11, 5, 2, mix(skin, [255, 255, 255], 0.55));   // scalp shine
  for (let k = 0; k < 26; k++) { const a = 0.3 + k / 25 * 2.55; rect(g, Math.round(hx + Math.cos(a) * 13), Math.round(hy + 6 + Math.sin(a) * 10), 2, 1, rgb(skin, 0.68)); }
  rect(g, hx - 10, hy - 3, 20, 2, rgb(skin, 0.72));   // brow ridge
  // Eyes: deep-set and intense; a grin when proud, a pained frown when the shop is struggling.
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 6, ey = hy + 1;
    if (mood === 'happy') arcEye(g, ex, ey, 2, true);
    else { rect(g, ex - 2, ey, 4, 2, INK); rect(g, ex - 1, ey, 1, 1, [255, 255, 255]); }
    const tilt = mood === 'sad' ? (sd < 0 ? 1 : -1) : mood === 'stern' ? (sd < 0 ? -1 : 1) : 0;
    rect(g, ex - 3, ey - 3 + (tilt > 0 ? 1 : 0), 3, 1, rgb(skin, 0.5)); rect(g, ex, ey - 3 + (tilt < 0 ? 1 : 0), 3, 1, rgb(skin, 0.5));
  }
  rect(g, hx, hy + 3, 2, 5, rgb(skin, 0.75));   // nose
  if (!s.noMouth) drawDomMouth(g, hx, hy + 12, mood, s.talking && (ft >> 3) & 1);
}
// His mouth, on its own (so the talking mouth is one small drawing, not a copy of all of him): centered at (hx, my).
function drawDomMouth(g, hx, my, mood, open) {
  if (open) ellipse(g, hx, my, 3, 2, [110, 40, 40]);
  else if (mood === 'happy') { rect(g, hx - 5, my - 1, 1, 1, INK); rect(g, hx - 4, my, 9, 1, INK); rect(g, hx + 5, my - 1, 1, 1, INK); rect(g, hx - 3, my + 1, 7, 1, [255, 255, 255]); }
  else if (mood === 'sad') { rect(g, hx - 4, my + 1, 1, 1, INK); rect(g, hx - 3, my, 7, 1, INK); rect(g, hx + 4, my + 1, 1, 1, INK); }
  else rect(g, hx - 4, my, 8, 1, INK);
}

// ---------- Pictures ----------
// The shop front, by night (struggling: one letter of the neon sign flickering, a rat on the pavement)
// or by day (a line out the door).
function drawShopScene(g, night) {
  const sky = night ? [24, 26, 52] : [150, 205, 240];
  rect(g, 0, 0, W, H, sky);
  if (night) for (let k = 0; k < 40; k++) rect(g, (k * 73) % W, (k * 37) % 70, 1, 1, [200, 200, 230]);
  else { ellipse(g, 60, 30, 18, 6, [255, 255, 255]); ellipse(g, 250, 22, 14, 5, [255, 255, 255]); }
  // Neighbouring buildings and the shop's brick front.
  rect(g, 0, 40, 50, 160, night ? [40, 38, 56] : [180, 170, 160]); rect(g, 270, 50, 50, 150, night ? [36, 34, 50] : [170, 160, 150]);
  const brick = night ? [86, 44, 40] : [170, 84, 70], mortar = night ? [60, 32, 30] : [140, 66, 56];
  rect(g, 50, 30, 220, 170, brick);
  for (let y = 30; y < 200; y += 6) { rect(g, 50, y, 220, 1, mortar); for (let x = 50 + ((y / 6) & 1) * 6; x < 270; x += 12) rect(g, x, y, 1, 6, mortar); }
  // Sign board (the neon letters are drawn as crisp text on top).
  rect(g, 66, 38, 188, 26, [30, 22, 30]); rect(g, 68, 40, 184, 22, [44, 30, 40]);
  g.fillStyle = night ? 'rgba(255,90,170,0.18)' : 'rgba(255,90,170,0.08)'; g.fillRect(62, 34, 196, 34);
  // Striped awning.
  for (let x = 60; x < 260; x += 10) { rect(g, x, 72, 10, 10, ((x / 10) & 1) ? [240, 240, 236] : [200, 50, 44]); rect(g, x, 82, 10, 3, ((x / 10) & 1) ? [210, 210, 206] : [160, 40, 36]); }
  // Window (warm light inside) and the door.
  const glass = night ? [240, 196, 110] : [180, 210, 230];
  rect(g, 70, 92, 110, 70, [50, 34, 30]); rect(g, 73, 95, 104, 64, glass);
  if (night) { rect(g, 73, 95, 104, 64, 'rgba(255,220,140,0.25)'); }
  // A pizza in the window, a sad one at night.
  ellipse(g, 125, 140, 22, 7, [230, 170, 80]); ellipse(g, 125, 139, 19, 5, [210, 70, 50]);
  for (const [px, py] of [[118, 138], [130, 140], [124, 141]]) rect(g, px, py, 2, 1, [250, 230, 200]);
  rect(g, 196, 100, 46, 100, [70, 44, 34]); rect(g, 199, 103, 40, 50, glass); rect(g, 232, 150, 3, 3, [220, 190, 90]);
  // Pavement and street.
  rect(g, 0, 200, W, 14, night ? [70, 70, 80] : [190, 190, 196]);
  for (let x = 0; x < W; x += 24) rect(g, x, 200, 1, 14, night ? [56, 56, 66] : [170, 170, 178]);
  rect(g, 0, 214, W, 26, night ? [30, 30, 36] : [80, 80, 90]);
  for (let x = 10; x < W; x += 40) rect(g, x, 226, 20, 2, night ? [120, 120, 90] : [230, 220, 140]);
  if (night) {
    // Street lamp and its pool of light.
    g.fillStyle = 'rgba(255,220,140,0.10)'; g.beginPath(); g.moveTo(286, 40); g.lineTo(270, 214); g.lineTo(320, 214); g.lineTo(304, 40); g.fill();
    rect(g, 294, 40, 3, 174, [50, 50, 60]); rect(g, 288, 36, 15, 5, [60, 60, 70]); rect(g, 290, 41, 11, 2, [255, 230, 160]);
  }
}
function drawShop(g, t, night) {
  g.drawImage(Sprites.canvas(night ? 'backgrounds/shop-night' : 'backgrounds/shop-day', 'default', 0), 0, 0);
  if (night) {
    // A rat scurrying past.
    const rx = Math.round(-20 + t * 1.6);
    if (rx < W + 20) Sprites.draw(g, 'extras/rat', 'walk', t, rx, 206);
  } else {
    // A line of customers out the door and along the pavement.
    for (let k = 0; k < 10; k++) Sprites.draw(g, 'extras/customer', 'c' + k, t, 186 - k * 17, Math.round(Math.sin(t * 0.15 + k) * 0.6));
  }
}
// The rat, nose at (x + 9, y).
function drawRat(g, x, y, t) {
  const rx = x, ry = y + ((t >> 2) & 1);
  ellipse(g, rx, ry, 6, 3, [110, 106, 110]); ball(g, rx + 6, ry - 1, 3, [120, 116, 120], false);
  rect(g, rx + 8, ry - 4, 2, 2, [190, 150, 160]); rect(g, rx + 8, ry - 1, 1, 1, INK);
  for (let k = 0; k < 10; k++) rect(g, rx - 6 - k, ry + Math.round(Math.sin(k * 0.6 + t * 0.4) * 1.5), 1, 1, [190, 150, 160]);
  for (const lx of [-3, 3]) rect(g, rx + lx + ((t >> 2) & 1 ? 1 : -1), ry + 3, 1, 2, [90, 86, 90]);
}
// Customer k of the line, standing on the pavement at x = px.
const CUSTOMER_COATS = [[60, 90, 160], [200, 80, 60], [80, 140, 90], [220, 180, 60], [150, 90, 160], [60, 60, 70], [230, 130, 160], [90, 160, 190], [180, 120, 70], [120, 120, 200]];
function drawCustomer(g, k, px) {
  const skins = [[236, 196, 160], [190, 140, 100], [150, 100, 70], [246, 210, 180]];
  const c = CUSTOMER_COATS[k], sk = skins[k % 4];
  rect(g, px - 4, 182, 8, 14, c); rect(g, px - 3, 196, 2, 4, [50, 50, 60]); rect(g, px + 1, 196, 2, 4, [50, 50, 60]);
  ball(g, px, 177, 4, sk, false); rect(g, px - 4, 173, 8, 2, k % 3 === 0 ? [80, 50, 30] : k % 3 === 1 ? [230, 200, 90] : [40, 30, 30]);
}

// ---------- Scenes ----------
// Shots: { who, mood, bg, lines } portrait with dialogue; { picture, dur } a timed picture; { card, lines } a note.
const STORY = {
  intro: [
    { who: 'dom', mood: 'sad', lines: [
      'Hey, kid. Grab a chair. We gotta talk.',
      "Business is bad. Real bad. Some nights nobody comes in at all.",
      "If we keep doing the same old thing, we're done. We gotta try something new.",
    ] },
    { picture: (g, t) => drawShop(g, t, true), sign: true, dur: 150 },
    { who: 'dom', mood: 'stern', lines: [
      "Look. You've been folding boxes and mopping floors around here for years.",
      "But I'm out of ideas, and you've got good instincts. So as of today, you're my head chef.",
      "I got us a pot off Craigslist. Cheap. It's... big. Really big. You'll see.",
      "Plus a whole mess of ingredients, and my nonna's old recipe book.",
      "Cook me something people will line up for. We're counting on you, kid.",
    ] },
  ],
  pizzaDone: [
    { who: 'dom', mood: 'happy', lines: ['Kid! Come out front. You gotta see this.'] },
    { picture: (g, t) => drawShop(g, t, false), sign: true, dur: 150 },
    { who: 'dom', mood: 'happy', fadeOut: 60, lines: [
      'That line goes around the block. Around the block!',
      "I always said this place ain't just a business. It's family.",
      "And you're family now. Don't ever forget that.",
    ] },
    // It looks like the scene is over... then, out of the dark:
    { black: true, dur: 130 },
    { who: 'gordo', mood: 'neutral', silhouette: true, fadeIn: 70, lines: ['Sorry to interrupt... could we talk for a second?'] },
    { who: 'gordo', mood: 'neutral', lines: [
      "Gordo Hamsie. I've eaten here three times this week, and I don't do that.",
      "You've got something, mate. Rough round the edges, but it's real.",
      "I'm launching a new show. Amateur chefs, competing for glory. It's called... SOUPED UP.",
      'Win it, and you walk away with a Michelin star. So. Are you in?',
    ] },
  ],
  showDone: [
    { who: 'gordo', mood: 'happy', lines: [
      "Well, well. I honestly didn't think you'd pull it off. That was b****y brilliant.",
      "You're clearly a powerful chef. That star's yours, mate. Every bit of it.",
    ] },
    { who: 'gordo', mood: 'neutral', lines: [
      "Word of advice, though. Be careful out there. Don't go beating chefs you're not supposed to beat.",
      "Embarrass the wrong person, and that's a mistake you don't come back from.",
    ] },
    { card: true, lines: ['TO BE CONTINUED', 'The next chapter is still cooking.'] },
  ],
};
const SPEAKERS = { dom: { name: 'PAPA DOM', theme: [196, 50, 44] }, gordo: { name: 'GORDO HAMSIE', theme: [200, 50, 50] } };
const FADE = 18;

const Story = {
  active: false, id: null, k: 0, n: 0, t: 0, typed: 0, phase: 'in', done: null,
  sprite: null,

  seen(id) { return !!(Progress.data.story && Progress.data.story[id]); },
  play(id, done) {
    Progress.data.story = Progress.data.story || {};
    Progress.data.story[id] = true; Progress.save();
    this.active = true; this.id = id; this.k = 0; this.n = 0; this.t = 0; this.typed = 0; this.phase = 'in'; this.done = done || null;
  },
  shot() { return STORY[this.id][this.k]; },
  finish() { this.active = false; const d = this.done; this.done = null; if (d) d(); },

  update() {
    if (!this.active) return;
    this.t++;
    const s = this.shot();
    if (this.phase === 'in' && this.t >= (s.fadeIn || FADE)) { this.phase = 'show'; this.t = 0; }
    else if (this.phase === 'show') {
      if (s.lines) this.typed = Math.min(s.lines[this.n].length, this.typed + 0.9);
      if ((s.picture || s.black) && this.t >= s.dur) this.next();
    } else if (this.phase === 'out' && this.t >= (s.fadeOut || FADE)) {
      if (++this.k >= STORY[this.id].length) return this.finish();
      this.n = 0; this.typed = 0; this.phase = 'in'; this.t = 0;
    }
  },
  next() { this.phase = 'out'; this.t = 0; },
  click() {
    const s = this.shot();
    if (this.phase !== 'show' || s.black) return;   // the dramatic pause can't be clicked through
    if (s.lines && !s.card) {
      if (this.typed < s.lines[this.n].length) { this.typed = s.lines[this.n].length; return; }
      if (this.n + 1 < s.lines.length) { this.n++; this.typed = 0; return; }
    }
    this.next();
  },
  skip() { this.finish(); },

  // A portrait: the character drawn at judge scale into a small canvas, then blown up 2x (chunky pixels).
  portrait(g, s) {
    if (!this.sprite) this.sprite = makeCanvas(120, 130);
    const sg = this.sprite.getContext('2d');
    sg.clearRect(0, 0, 120, 130);
    const talking = this.phase === 'show' && this.typed < (s.lines ? s.lines[this.n].length : 0);
    const st = { mood: s.mood, ft: Chef.t, active: talking, tasting: false, talking };
    if (s.who === 'dom') {
      // Papa Dom breathes (the game bobs him a pixel) and his mouth flaps while his line types out.
      const bob = Math.round(Math.sin(Chef.t * 0.05));
      Sprites.draw(sg, 'story/dom', s.mood, 0, 60, bob);
      Sprites.draw(sg, 'story/dom-mouth', talking && (Chef.t >> 3) & 1 ? 'talk' : s.mood, 0, 60, bob);
    }
    else {
      const gs = { ...st, mood: talking && s.mood === 'neutral' ? 'meh' : s.mood }, j = JUDGE_ROSTER.gordo;
      Sprites.draw(sg, 'judges/gordo', judgePose(j, gs), Chef.t, 60, 0, { j, J: { t: Chef.t }, s: gs });
    }
    if (s.silhouette) { sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#0b0a10'; sg.fillRect(0, 0, 120, 130); sg.globalCompositeOperation = 'source-over'; }
    g.drawImage(this.sprite, 160 - 120, 196 - 260 + 30, 240, 260);
  },

  draw(g) {
    const s = this.shot();
    if (s.black) { rect(g, 0, 0, W, H, [0, 0, 0]); return; }
    if (s.picture) s.picture(g, this.phase === 'show' ? this.t : this.phase === 'out' ? s.dur : 0);
    else if (s.card) rect(g, 0, 0, W, H, [14, 12, 18]);
    else {
      // Dramatic backdrop: a dark room, a pool of colored light behind the speaker, heavy vignette.
      const warm = s.who === 'dom';
      rect(g, 0, 0, W, H, s.silhouette ? [26, 30, 44] : warm ? [40, 22, 20] : [18, 22, 40]);
      const glow = g.createRadialGradient(160, 90, 10, 160, 90, 150);
      glow.addColorStop(0, s.silhouette ? 'rgba(140,170,230,0.55)' : warm ? 'rgba(255,150,80,0.45)' : 'rgba(90,140,255,0.35)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      this.portrait(g, s);
    }
    // Vignette and letterbox bars.
    const v = g.createRadialGradient(160, 110, 70, 160, 120, 210);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    rect(g, 0, 0, W, 10, [0, 0, 0]);
    if (s.lines && !s.card) {
      const sp = SPEAKERS[s.who];
      rect(g, 8, 178, W - 16, 56, [20, 14, 20]); rect(g, 9, 179, W - 18, 54, [252, 246, 232]);
      rect(g, 9, 179, W - 18, 11, s.silhouette ? [60, 60, 80] : sp.theme);
    }
    // Fades.
    const a = this.phase === 'in' ? 1 - this.t / (s.fadeIn || FADE) : this.phase === 'out' ? this.t / (s.fadeOut || FADE) : 0;
    if (a > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, a)})`; g.fillRect(0, 0, W, H); }
  },

  drawText(T) {
    const s = this.shot(), fade = this.phase === 'show';
    if (s.black) return;
    if (s.sign) {
      // PAPA DOM'S PIZZA in neon; at night one letter sputters.
      const word = "PAPA DOM'S PIZZA", night = this.k === 1 && this.id === 'intro';
      const x0 = 160 - word.length * 5.4 + 3;
      [...word].forEach((ch, k) => {
        const off = night && k === 14 && (((Chef.t * 7) % 23) < 9 || (Chef.t % 50) < 6);
        T.text(ch, x0 + k * 10.8, 44, { size: 12, color: off ? '#5a2a40' : '#ff6ac8', shadow: !off });
      });
    }
    if (s.card) {
      T.text(s.lines[0], 160, 92, { size: 14, color: '#ffe9c0', align: 'center', shadow: true });
      T.wrap(s.lines[1], 40, 122, 240, { size: 6, color: '#b8b0c8' });
      if (fade) T.text('click to continue', 160, 214, { size: 5, color: '#8a8098', align: 'center' });
      return;
    }
    if (s.lines) {
      const sp = SPEAKERS[s.who];
      T.text(s.silhouette ? '???' : sp.name, 14, 181, { size: 6, color: '#fff' });
      T.wrap(s.lines[this.n].slice(0, this.typed | 0), 14, 195, W - 28, { size: 7, color: '#2a1820' });
      if (fade && this.typed >= s.lines[this.n].length && (Chef.t >> 4) & 1) T.text('click >', W - 14, 224, { size: 6, color: '#8a6a70', align: 'right' });
    }
    T.text('Esc: skip', W - 4, 2, { size: 4, color: '#77707f', align: 'right' });
  },
};
