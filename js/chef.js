// The cute chef behind the pot: follows the cursor, holds and pours ingredients, reacts to events.

const SKIN = [250, 212, 182], COAT = [250, 250, 252], HAT = [255, 255, 255];

const REACTIONS = {
  discover: { mood: 'happy', say: ['Ooh!', 'Eureka!', 'Magnifique!', 'Wow!'], t: 80, hop: true },
  burn:     { mood: 'gross', say: ['Ugh, burnt!', 'Smells bitter...'], t: 70 },
  smoke:    { mood: 'worried', say: ['Smoking oil!'], t: 60 },
  fire:     { mood: 'panic', say: ['FIRE!', 'LID! LID!'], t: 90, shake: true },
  splatter: { mood: 'panic', say: ['Ow! Spitting!', 'Hot oil!'], t: 50, recoil: true },
  fizz:     { mood: 'shock', say: ['Whoa!!', 'It\'s alive!'], t: 70 },
  overflow: { mood: 'shock', say: ['Boil over!'], t: 60 },
  flambe:   { mood: 'shock', say: ['Flambé!', 'Voilà!'], t: 70, hop: true },
  curdle:   { mood: 'worried', say: ['It split...', 'Curdled!'], t: 60 },
  full:     { mood: 'worried', say: ['Pot\'s full!'], t: 60 },
};

const Chef = {
  x: 160, tx: 160, held: null, prevHeld: null, swapT: 0,
  mood: 'idle', moodT: 0, hopT: 0, shakeT: 0, recoilT: 0,
  blinkT: 120, bubble: null, pouring: false, pourPhase: 0, sipT: 0, t: 0,
  hand: { x: 160, y: 96 },

  select(ing) {
    if (this.held === ing) return;
    this.prevHeld = this.held;
    this.held = ing;
    this.swapT = 24;
  },

  say(text, frames = 70) { this.bubble = { text, t: frames }; },

  react(ev) {
    const r = REACTIONS[ev.t];
    if (!r) return;
    if (this.moodT > 20 && ev.t !== 'fire' && ev.t !== 'discover') return; // don't spam
    this.mood = r.mood; this.moodT = r.t;
    if (r.hop) this.hopT = 20;
    if (r.shake) this.shakeT = 40;
    if (r.recoil) this.recoilT = 16;
    this.say(r.say[(Math.random() * r.say.length) | 0], r.t);
  },

  sip(score, line) {
    this.sipT = 50;
    this.mood = score > 0.75 ? 'love' : score > 0.5 ? 'happy' : score > 0.3 ? 'meh' : 'gross';
    this.moodT = 110;
    this.say(line, 140);
  },

  update(cursorX, overPot, pouring) {
    this.t++;
    this.tx = overPot ? Math.max(112, Math.min(208, cursorX)) : 160;
    this.x += (this.tx - this.x) * 0.12;
    this.pouring = pouring && this.held && this.swapT === 0;
    if (this.pouring) this.pourPhase++;
    if (this.swapT > 0) this.swapT--;
    if (this.moodT > 0 && --this.moodT === 0) this.mood = 'idle';
    if (this.hopT > 0) this.hopT--;
    if (this.shakeT > 0) this.shakeT--;
    if (this.recoilT > 0) this.recoilT--;
    if (this.sipT > 0) this.sipT--;
    if (--this.blinkT < 0) this.blinkT = 100 + ((Math.random() * 160) | 0);
    if (this.bubble && --this.bubble.t <= 0) this.bubble = null;
    if (this.mood === 'idle' && Sim.dial >= 8 && this.t % 300 === 0) this.say('Hot hot hot!', 60);
  },

  // Where the held item sits (screen px).
  itemPos(cursorX) {
    const hx = Math.max(GX + 4, Math.min(GX + GW - 4, cursorX));
    return { x: this.pouring ? hx : this.x + 20, y: this.pouring ? POT_TOP - 16 : 88 };
  },

  draw(g, cursorX, cursorY) {
    const t = this.t;
    let bob = Math.round(Math.sin(t * 0.07));
    if (this.hopT) bob -= Math.round(Math.sin((this.hopT / 20) * Math.PI) * 6);
    if (this.recoilT) bob -= 3;
    const cx = Math.round(this.x + (this.shakeT ? ((t >> 1) & 1 ? 1 : -1) : 0)), by = bob;

    // Torso (white coat) peeking above the pot.
    ellipse(g, cx, 92 + by, 22, 14, rgb(COAT, 0.45));
    ellipse(g, cx, 92 + by, 21, 13, COAT);
    rect(g, cx - 21, 92 + by, 42, 20, COAT);
    rect(g, cx + 8, 84 + by, 13, 28, rgb(COAT, 0.9));
    rect(g, cx - 1, 84 + by, 2, 28, [226, 228, 236]);
    for (let k = 0; k < 3; k++) { rect(g, cx - 5, 90 + k * 7 + by, 2, 2, [200, 60, 60]); rect(g, cx + 4, 90 + k * 7 + by, 2, 2, [200, 60, 60]); }
    // Neckerchief.
    ellipse(g, cx, 78 + by, 8, 3, [220, 60, 60]);
    rect(g, cx + 3, 79 + by, 4, 5, [200, 50, 50]);

    // Head.
    const hy = 62 + by + (this.sipT ? 2 : 0);
    ball(g, cx, hy, 13, SKIN);
    // Ears.
    ball(g, cx - 13, hy + 1, 3, SKIN, false); ball(g, cx + 13, hy + 1, 3, SKIN, false);
    // Toque.
    rect(g, cx - 11, hy - 16, 22, 7, HAT); rect(g, cx - 11, hy - 10, 22, 1, [210, 214, 226]);
    ball(g, cx - 8, hy - 21, 7, HAT); ball(g, cx + 8, hy - 21, 7, HAT); ball(g, cx, hy - 26, 8, HAT);
    // Face.
    this.drawFace(g, cx, hy);

    // Sweat when the heat's high or panicking.
    if (Sim.dial >= 8 || this.mood === 'panic') {
      const sy = hy - 6 + ((t >> 2) % 8);
      rect(g, cx + 12, sy, 2, 3, [140, 200, 255]); rect(g, cx + 12, sy, 1, 1, [230, 245, 255]);
    }
  },

  drawFace(g, cx, hy) {
    const m = this.mood, blink = this.blinkT < 6;
    const eye = (ex) => {
      if (m === 'happy' || m === 'love') { rect(g, ex - 1, hy - 1, 3, 1, [40, 30, 30]); rect(g, ex - 2, hy, 1, 1, [40, 30, 30]); rect(g, ex + 2, hy, 1, 1, [40, 30, 30]); }
      else if (m === 'gross') { rect(g, ex - 1, hy, 3, 1, [40, 30, 30]); }
      else if (m === 'shock' || m === 'panic') { rect(g, ex - 1, hy - 2, 3, 4, [255, 255, 255]); rect(g, ex, hy - 1, 1, 2, [40, 30, 30]); }
      else if (blink) rect(g, ex - 1, hy, 3, 1, [40, 30, 30]);
      else { rect(g, ex - 1, hy - 1, 2, 3, [40, 30, 30]); rect(g, ex - 1, hy - 1, 1, 1, [255, 255, 255]); }
    };
    eye(cx - 5); eye(cx + 5);
    if (m === 'love') { rect(g, cx - 7, hy - 4, 2, 2, [240, 80, 120]); rect(g, cx + 6, hy - 4, 2, 2, [240, 80, 120]); }
    // Blush.
    ellipse(g, cx - 8, hy + 4, 2, 1, [250, 150, 150]); ellipse(g, cx + 8, hy + 4, 2, 1, [250, 150, 150]);
    // Mouth.
    const my = hy + 8;
    if (m === 'happy' || m === 'love') { ellipse(g, cx, my, 3, 2, [140, 40, 50], 'bottom'); }
    else if (m === 'shock' || m === 'panic') { ellipse(g, cx, my + 1, 2, 2, [120, 30, 40]); }
    else if (m === 'gross') { rect(g, cx - 3, my, 6, 1, [120, 40, 50]); rect(g, cx + 1, my + 1, 2, 2, [130, 200, 90]); }
    else if (m === 'worried' || m === 'meh') { rect(g, cx - 2, my + 1, 2, 1, [120, 40, 50]); rect(g, cx, my, 2, 1, [120, 40, 50]); }
    else { rect(g, cx - 1, my + 1, 3, 1, [150, 60, 60]); }
    // Mustache.
    ellipse(g, cx - 4, hy + 5, 4, 1, [110, 70, 40]); ellipse(g, cx + 4, hy + 5, 4, 1, [110, 70, 40]);
    rect(g, cx - 9, hy + 3, 2, 2, [110, 70, 40]); rect(g, cx + 8, hy + 3, 2, 2, [110, 70, 40]);
  },

  // Arms + held item + pour stream; drawn after the pot rim so it reaches over the front.
  drawArms(g, cursorX) {
    const t = this.t;
    const cx = Math.round(this.x);
    const by = Math.round(Math.sin(t * 0.07));
    const sh = { x: cx + 18, y: 88 + by };
    const shL = { x: cx - 18, y: 88 + by };
    const ip = this.itemPos(cursorX);
    let ix = ip.x, iy = ip.y;
    // Swap animation: old item drops, new item rises.
    let showItem = this.held;
    if (this.swapT > 12) { showItem = this.prevHeld; iy += (24 - this.swapT) * 4; }
    else if (this.swapT > 0) { iy += this.swapT * 3; }
    // Pour wiggle by ingredient type.
    let ang = 0;
    if (this.pouring) {
      const k = this.held.kind;
      if (k === 'liquid') ang = 1.9;
      else if (k === 'powder') { ang = 2.6; iy += Math.round(Math.sin(this.pourPhase * 0.9) * 2); }
      else { ang = 1.2 + Math.sin(this.pourPhase * 0.4) * 0.3; }
    }
    // Left hand rests on the rim; right hand holds the item.
    arm(g, shL.x, shL.y, cx - 26, POT_TOP - 1);
    ball(g, cx - 26, POT_TOP - 2, 3, SKIN);
    if (showItem) {
      const icon = Art.icon(showItem.icon, showItem.c);
      g.save(); g.translate(Math.round(ix), Math.round(iy)); g.rotate(ang); g.drawImage(icon, -8, -8); g.restore();
      arm(g, sh.x, sh.y, ix + 2, iy + 4);
      ball(g, ix + 2, iy + 5, 3, SKIN);
      if (this.pouring) this.drawStream(g, ix, iy);
    } else {
      arm(g, sh.x, sh.y, cx + 26, POT_TOP - 1);
      ball(g, cx + 26, POT_TOP - 2, 3, SKIN);
    }
  },

  drawStream(g, ix, iy) {
    const h = this.held, c = h.c, sx = ix - 6, sy = iy + 6, ey = GY + 1;
    if (h.kind === 'liquid') {
      for (let y = sy; y < ey; y++) {
        const w = y < sy + 4 ? 2 : 1 + ((y + this.pourPhase) % 5 === 0 ? 1 : 0);
        rect(g, sx, y, w, 1, h.id === 'water' ? [150, 200, 240] : c);
      }
    } else if (h.kind === 'powder') {
      for (let k = 0; k < 6; k++) {
        const y = sy + ((this.pourPhase * 3 + k * 7) % (ey - sy));
        rect(g, sx + ((k * 37 + this.pourPhase) % 5) - 2, y, 1, 1, c);
      }
    }
  },

  drawText(T) {
    if (!this.bubble) return;
    const x = Math.round(this.x) - 4, y = 22;
    T.bubble(this.bubble.text, x, y);
  },
};

function arm(g, x0, y0, x1, y1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let k = 0; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
    rect(g, x - 3, y - 3, 6, 6, rgb(COAT, 0.45));
  }
  for (let k = 0; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
    rect(g, x - 2, y - 2, 4, 4, COAT);
    rect(g, x - 2, y - 2, 4, 1, [255, 255, 255]);
  }
}
