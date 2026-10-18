// UI: ingredient shelf, tool panel, heat dial, taste card, journal, discovery banners, crisp text.

// Crisp text drawn on the full-res screen canvas, positioned in internal pixel coords.
const T = {
  ctx: null, s: 3,
  // o.font: another typeface (The Ram speaks in a demonic one); Silkscreen otherwise.
  text(str, x, y, o = {}) {
    const c = this.ctx, s = this.s, size = (o.size || 7) * s;
    c.font = `${size}px ${o.font || 'Silkscreen'}, monospace`;
    c.textAlign = o.align || 'left'; c.textBaseline = 'top';
    if (o.shadow) { c.fillStyle = '#1b1018'; c.fillText(str, x * s + s, y * s + s); }
    c.fillStyle = o.color || '#fff';
    c.fillText(str, x * s, y * s);
  },
  // Width of a line of text, in game pixels.
  measure(str, size = 7) {
    if (!this.ctx) return str.length * size;
    this.ctx.font = `${size * this.s}px Silkscreen, monospace`;
    return Math.ceil(this.ctx.measureText(str).width / this.s);
  },
  wrap(str, x, y, w, o = {}) {
    const c = this.ctx, s = this.s, size = (o.size || 7);
    c.font = `${size * s}px ${o.font || 'Silkscreen'}, monospace`;
    let line = '', yy = y;
    for (const word of str.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (c.measureText(test).width > w * s && line) { this.text(line, x, yy, o); line = word; yy += size + 3; }
      else line = test;
    }
    if (line) this.text(line, x, yy, o);
  },
  // A rubber stamp: bordered text, tilted, in slightly patchy ink.
  stamp(str, cx, cy, o = {}) {
    const c = this.ctx, s = this.s, size = (o.size || 6) * s, color = o.color || 'rgba(200,40,40,0.85)';
    c.save();
    c.translate(cx * s, cy * s); c.rotate(o.angle ?? -0.3);
    c.font = `${size}px Silkscreen, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(str).width + 4 * s, h = size + 3 * s;
    c.strokeStyle = color; c.lineWidth = s; c.strokeRect(-w / 2, -h / 2, w, h);
    c.fillStyle = color; c.fillText(str, 0, s * 0.5);
    c.restore();
  },
  bubble(str, x, y) {
    const c = this.ctx, s = this.s;
    c.font = `${6 * s}px Silkscreen, monospace`;
    const w = c.measureText(str).width / s + 8;
    const bx = Math.max(2, Math.min(W - w - 2, x - w / 2));
    c.fillStyle = '#2a1820'; c.fillRect((bx - 1) * s, (y - 1) * s, (w + 2) * s, 12 * s);
    c.fillStyle = '#fffaf0'; c.fillRect(bx * s, y * s, w * s, 10 * s);
    c.fillRect((x - 1) * s, (y + 10) * s, 3 * s, 2 * s);
    this.text(str, bx + 4, y + 2, { size: 6, color: '#2a1820' });
  },
};

const SHELF_X = 2, SHELF_Y = 14;
// Three columns of 18 px, or four slightly narrower ones once the shelf holds more than 33 (it must clear the pot's handle).
const shelfCols = () => (shelf().length > 33 ? 4 : 3), slotW = () => (shelfCols() === 4 ? 17 : 18);
// What's on the shelf: everything unlocked so far in the story (see Levels.shelf), or all of it. Re-checked every few
// frames, since passing a dish can unlock more.
let shelfCache = { t: -1, level: undefined, list: SHELF };
function shelf() {
  if (shelfCache.level !== Game.level || Math.abs(Chef.t - shelfCache.t) > 30) {
    const ids = Levels.shelf(Game.level);
    shelfCache = { t: Chef.t, level: Game.level, list: ids ? SHELF.filter((s) => ids.has(s.id)) : SHELF };
  }
  return shelfCache.list;
}
const slotH = () => (shelf().length > 30 && shelf().length <= 33 ? 19 : 21);   // three full columns pack a little tighter
// Clicking a pantry item is pouring, so there's no Pour tool: Stir and Taste toggle back to it.
const TOOLS = [
  { id: 'ladle', icon: 'ladle', label: 'Stir', key: 'S' },
  { id: 'taste', icon: 'spoon', label: 'Taste', key: 'T' },
  { id: 'lid', icon: 'lid', label: 'Lid', key: 'L' },
  { id: 'clear', icon: 'trash', label: 'Empty' },
  { id: 'journal', icon: 'book', label: 'Journal', sandbox: true, key: 'J' },
  { id: 'recipe', icon: 'recipe', label: 'Recipe', level: true, key: 'R' },
  { id: 'quit', icon: 'door', label: 'Quit' },
];
// The tools shown right now (the Journal button is a sandbox thing; in story it lives in Settings, and in story
// the Recipe button brings the order ticket back up).
const tools = () => TOOLS.filter((t) => (!t.sandbox || !Game.level) && (!t.level || Game.level));
const BANNER_T = 300;   // a new discovery's banner stays up 5 s, long enough to read
const TOOL_X = 266, TOOL_Y = 16, TOOL_H = 22;
const DIAL = { x: 160, y: 227, r: 9 };
const SERVE = { x: 266, y: 168, w: 50, h: 22 };
const TITLE_BOX = { x: 96, y: 0, w: 128, h: 12 };

const UI = {
  tool: 'pour', hover: null, card: null, journal: false, banners: [], toasts: [], confirm: null,   // a tool waiting on a second click ('Sure?'): { id, t }
  dragDial: false,

  shelfSlot(n) { const h = slotH(), w = slotW(), c = shelfCols(), x0 = c === 4 ? 1 : SHELF_X; return { x: x0 + (n % c) * w, y: SHELF_Y + ((n / c) | 0) * h, w: w - 1, h: h - 1 }; },
  // Hotkeys while cooking: S stir, T taste (again to put it down), L lid, W water, R the recipe (in story).
  hotkey(k) {
    if (k === 's' || k === 't') { const id = k === 's' ? 'ladle' : 'taste'; this.tool = this.tool === id ? 'pour' : id; }
    else if (k === 'l') Sim.lid = !Sim.lid;
    else if (k === 'w') { Chef.select(SHELF.find((s) => s.id === 'water')); this.tool = 'pour'; }
    else if (k === 'r' && Game.level) { if (this.card && this.card.recipe) this.card = null; else this.showRecipe(); }
    else return false;
    return true;
  },
  toolSlot(n) { return { x: TOOL_X, y: TOOL_Y + n * TOOL_H, w: 50, h: TOOL_H - 2 }; },

  hit(r, x, y) { return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h; },

  // Returns what's under the cursor.
  pick(x, y) {
    for (let n = 0; n < shelf().length; n++) if (this.hit(this.shelfSlot(n), x, y)) return { type: 'ing', n };
    for (let n = 0; n < tools().length; n++) if (this.hit(this.toolSlot(n), x, y)) return { type: 'tool', n };
    if (this.hit(SERVE, x, y)) return { type: 'serve' };
    if (Game.level && this.hit(TITLE_BOX, x, y)) return { type: 'recipe' };
    if ((x - DIAL.x) ** 2 + (y - DIAL.y) ** 2 <= (DIAL.r + 4) ** 2) return { type: 'dial' };
    return null;
  },

  click(x, y) {
    const hadRecipe = !!(this.card && this.card.recipe);
    if (this.card && this.card.t > 10) this.card = null;
    const h = this.pick(x, y);
    if (!h) return false;
    if (h.type === 'ing') { Chef.select(shelf()[h.n]); this.tool = 'pour'; }
    else if (h.type === 'tool') {
      const id = tools()[h.n].id;
      if (id === 'lid') Sim.lid = !Sim.lid;
      else if (id === 'journal') Journal.open();
      else if (id === 'recipe') { if (!hadRecipe) this.showRecipe(); }   // click again to put it away
      else if (id === 'clear' || id === 'quit') {
        // Emptying the pot and quitting both ask "Sure?" first: a second click within two seconds does it.
        if (this.confirm && this.confirm.id === id) { this.confirm = null; if (id === 'clear') Game.tipPot(); else Game.level ? Game.toMenu() : Game.toTitle(); }
        else this.confirm = { id, t: 120 };
      }
      else this.tool = this.tool === id ? 'pour' : id;   // click again to put it down
    }
    else if (h.type === 'serve') Game.serve();
    else if (h.type === 'recipe') { if (!hadRecipe) this.showRecipe(); }
    else if (h.type === 'dial') { this.dragDial = true; this.setDial(x, y); }
    return true;
  },

  setDial(x, y) {
    // Angle from -135° (off) to +135° (max), measured from straight up.
    let a = Math.atan2(x - DIAL.x, -(y - DIAL.y)) * 180 / Math.PI;
    a = Math.max(-135, Math.min(135, a));
    Sim.dial = Math.round(((a + 135) / 270) * 10 * 2) / 2;
  },

  // A taste that found nothing (spoon not in the food, an empty pot) is just a quick toast, not the card.
  showTaste(res) { if (res.empty) { this.card = null; this.toast(res.line); } else this.card = { res, t: 0 }; },
  // The order ticket and the taste card sit centered over the pot, clear of the chef.
  cardBox() {
    const w = this.card.recipe ? 120 : 136;
    const tex = this.card.res ? this.card.res.tex || [] : [];
    const h = this.card.recipe ? 80 : tex.length > 3 ? 104 : tex.length ? 96 : 86;
    return { x: 160 - w / 2, y: Math.round((POT_TOP + POT_BOT) / 2 - h / 2), w, h };
  },
  // The level's order ticket: just the dish and its description (players work out the method).
  showRecipe() { if (Game.level) this.card = { recipe: Game.level, t: 0 }; },

  banner(text, sub) { this.banners.push({ text, sub, t: 0 }); },
  toast(text) { this.toasts.push({ text, t: 0 }); if (this.toasts.length > 4) this.toasts.shift(); },

  update() {
    if (this.card) { this.card.t++; if (this.card.t > (this.card.recipe ? 900 : 420)) this.card = null; }
    if (this.confirm && --this.confirm.t <= 0) this.confirm = null;
    if (this.banners.length) { const b = this.banners[0]; if (++b.t > BANNER_T) this.banners.shift(); }
    for (const t of this.toasts) t.t++;
    this.toasts = this.toasts.filter((t) => t.t < 130);
  },

  draw(g, mx, my) {
    // Shelf: wooden board.
    const pw = shelfCols() === 4 ? 70 : 58;
    rect(g, 0, 12, pw, 214, [120, 76, 48]); rect(g, 1, 13, pw - 2, 212, [160, 106, 66]);
    shelf().forEach((ing, n) => {
      const s = this.shelfSlot(n), sel = Chef.held === ing, hov = this.hover && this.hover.type === 'ing' && this.hover.n === n;
      rect(g, s.x + 1, s.y + 1, s.w - 1, s.h - 1, sel ? [255, 214, 110] : hov ? [196, 140, 92] : [176, 120, 76]);
      rect(g, s.x + 1, s.y + s.h - 2, s.w - 1, 2, [120, 76, 48]);
      const bobY = sel ? Math.round(Math.sin(Chef.t * 0.15)) : 0;
      g.drawImage(Art.ingIcon(ing), s.x + 1, s.y + 2 + bobY);
    });
    // Tool panel.
    rect(g, 262, 12, 58, 214, [120, 76, 48]); rect(g, 263, 13, 56, 212, [160, 106, 66]);
    tools().forEach((tl, n) => {
      const s = this.toolSlot(n);
      const on = this.tool === tl.id || (tl.id === 'lid' && Sim.lid) || (this.confirm && this.confirm.id === tl.id) || (tl.id === 'recipe' && this.card && this.card.recipe);
      const hov = this.hover && this.hover.type === 'tool' && this.hover.n === n;
      rect(g, s.x, s.y, s.w, s.h, [96, 60, 40]);
      rect(g, s.x + 1, s.y + 1, s.w - 2, s.h - 2, on ? (hov ? [255, 226, 140] : [255, 214, 110]) : hov ? [236, 204, 160] : [214, 176, 130]);
      g.drawImage(Art.toolIcon(tl.icon), s.x + 2, s.y + 2);
    });
    // Serve button.
    const pulse = Math.sin(Chef.t * 0.1) > 0 ? 1.05 : 1, sh = this.hover && this.hover.type === 'serve';
    rect(g, SERVE.x, SERVE.y, SERVE.w, SERVE.h, [60, 20, 20]);
    rect(g, SERVE.x + 1, SERVE.y + 1, SERVE.w - 2, SERVE.h - 2, rgb(sh ? [244, 84, 70] : [220, 60, 50], pulse));
    rect(g, SERVE.x + 1, SERVE.y + 1, SERVE.w - 2, 3, [250, 120, 100]);
    // Thermometer.
    this.drawThermo(g);
    // Heat dial on the stove front.
    ellipse(g, DIAL.x, DIAL.y + 1, DIAL.r + 2, DIAL.r + 2, [30, 30, 40]);
    ball(g, DIAL.x, DIAL.y, DIAL.r, [220, 224, 236]);
    const a = ((Sim.dial / 10) * 270 - 135) * Math.PI / 180;
    for (let k = 2; k < DIAL.r; k++) rect(g, DIAL.x + Math.sin(a) * k, DIAL.y - Math.cos(a) * k, 2, 2, [220, 50, 40]);
    for (let n = 0; n <= 10; n += 2) {
      const ta = ((n / 10) * 270 - 135) * Math.PI / 180;
      rect(g, DIAL.x + Math.sin(ta) * (DIAL.r + 4), DIAL.y - Math.cos(ta) * (DIAL.r + 4), 1, 1, n > 6 ? [255, 120, 80] : [200, 204, 220]);
    }
    // Taste card.
    if (this.card) this.drawCard(g);
    if (this.banners.length) {
      const b = this.banners[0], slide = Math.min(1, b.t / 12) * Math.min(1, (BANNER_T - b.t) / 12);
      const y = -30 + slide * 34;
      rect(g, 70, y, 180, 28, [40, 24, 30]); rect(g, 71, y + 1, 178, 26, [255, 222, 110]);
      for (let k = 0; k < 6; k++) rect(g, 74 + ((k * 31 + b.t * 2) % 172), y + 3 + (k * 7) % 20, 1, 1, [255, 255, 255]);
    }
    // Toasts slide in at the side of the kitchen, same look, much smaller.
    this.toasts.forEach((t, k) => {
      const w = this.toastW(t), x = 62 - Math.round((1 - Math.min(1, t.t / 8, (130 - t.t) / 8)) * (w + 4)), y = 20 + k * 13;
      rect(g, x, y, w, 11, [40, 24, 30]); rect(g, x + 1, y + 1, w - 2, 9, [255, 222, 110]);
    });
  },

  toastW(t) { return t.w || (t.w = Math.max(66, T.measure(t.text, 5) + 8)); },

  drawThermo(g) {
    const x = 270, y = 196, temps = Taste.gather(0, 0, 0);
    rect(g, x, y, 42, 10, [60, 40, 30]); rect(g, x + 1, y + 1, 40, 8, [240, 236, 228]);
    const t = Math.max(0, Math.min(1, (temps.temp - 20) / 230));
    rect(g, x + 2, y + 3, 38 * t, 4, t > 0.75 ? [240, 60, 40] : t > 0.32 ? [250, 160, 60] : [100, 170, 240]);
    rect(g, x + 2 + 38 * (80 / 230), y + 2, 1, 6, [80, 80, 90]);
    this.potTemp = temps.temp;
  },

  drawCard(g) {
    const { x, y, h } = this.cardBox();
    if (this.card.recipe) {
      // Order ticket: paper with a clip and a perforated stub.
      rect(g, x + 2, y + 2, 120, 80, [30, 20, 26]); rect(g, x, y, 120, 80, [250, 246, 234]);
      for (let k = 3; k < 117; k += 3) rect(g, x + k, y + 12, 1, 1, [190, 180, 160]);
      rect(g, x + 56, y - 3, 9, 6, [170, 174, 188]); rect(g, x + 57, y - 2, 7, 1, [230, 234, 242]);
      return;
    }
    rect(g, x, y, 136, h, [40, 24, 30]); rect(g, x + 1, y + 1, 134, h - 2, [255, 250, 238]);
    if (this.card.res.unmixed) {
      // Can't tell: question-mark bars.
      TASTE_AXES.forEach((k, n) => { const by = y + 16 + n * 7; rect(g, x + 44, by + 1, 60, 4, [230, 222, 210]); });
      return;
    }
    // In a level: each bar against the recipe's taste, with the band the judges don't mind (green inside it,
    // red over, amber under). In the sandbox there's no recipe: just the readings.
    const p = this.card.res.p, target = Levels.target(Game.level);
    TASTE_AXES.forEach((k, n) => {
      const by = y + 16 + n * 7, v = Math.min(1, p[k]);
      rect(g, x + 44, by + 1, 60, 4, [230, 222, 210]);
      if (!target) { rect(g, x + 44, by + 1, 60 * v, 4, [150, 130, 170]); return; }
      const want = target.taste[k], lo = Math.max(0, want - LEVEL_FREE), hi = Math.min(1, want + LEVEL_FREE);
      rect(g, x + 44 + Math.round(60 * lo), by, Math.max(1, Math.round(60 * (hi - lo))), 6, [200, 226, 180]);   // the band
      const over = v > hi && !overIsFine(Game.level, k);   // more savory is never too much; a sauce can't be too thick
      rect(g, x + 44, by + 1, 60 * v, 4, over ? [230, 90, 70] : v < lo ? [240, 180, 70] : [110, 190, 90]);
      rect(g, x + 44 + Math.round(60 * want), by, 1, 6, [80, 60, 70]);   // the recipe
    });
  },

  drawText(T, mx, my) {
    // In a level the dish's name takes the title spot; click it to read the recipe blurb again.
    T.text(Game.level ? Game.level.title.toUpperCase() : 'SOUP POT', 160, 1, { size: Game.level && Game.level.title.length > 14 ? 6 : 7, color: '#ffe9c0', align: 'center' });
    const label = Game.level && Game.level.tier === 0 ? '#ffe9c0' : '#7a3a2a';   // light on the pizza shop's brick
    T.text('PANTRY', 29, 4, { size: 6, color: label, align: 'center' });
    T.text('TOOLS', 291, 4, { size: 6, color: label, align: 'center' });
    tools().forEach((tl, n) => {
      const s = this.toolSlot(n);
      const label = this.confirm && this.confirm.id === tl.id ? 'Sure?' : tl.label;
      T.text(label, s.x + 20, s.y + 7, { size: 5, color: '#3a2418' });
      if (tl.key) T.text(tl.key, s.x + s.w - 3, s.y + 2, { size: 4, color: '#9a7458', align: 'right' });   // its hotkey
    });
    T.text('SERVE', SERVE.x + SERVE.w / 2, SERVE.y + 7, { size: 7, color: '#fff', align: 'center', shadow: true });
    T.text(Math.round(this.potTemp || 20) + '°C', 291, 208, { size: 6, color: '#fff2d8', align: 'center' });
    T.text('HEAT ' + Sim.dial.toFixed(1).replace('.0', ''), DIAL.x + 16, 222, { size: 6, color: '#d8dcf0' });
    // Hints for whole items: crack on the rim, drop, or throw.
    const held = Chef.held;
    if (held && held.kind === 'whole' && this.tool === 'pour' && !Sim.lid && mx >= GX - 12 && mx < GX + GW + 12 && my >= 24 && my < GY + GH) {
      const label = held.id === 'egg' ? (Chef.cracked ? 'drop' : Chef.onRim(my) ? 'crack' : 'throw') : 'throw';
      T.text(label, mx + 6, my + 6, { size: 5, color: '#fff', shadow: true });
    }
    if (this.hover && this.hover.type === 'ing') {
      const ing = shelf()[this.hover.n];
      T.bubble(ing.name + (ing.id === 'water' ? ' (W)' : ''), mx, my - 14);   // the bubble's tail points at the cursor
    }
    if (this.card) this.drawCardText(T);
    this.toasts.forEach((t, k) => {
      const w = this.toastW(t), x = 62 - Math.round((1 - Math.min(1, t.t / 8, (130 - t.t) / 8)) * (w + 4)), y = 20 + k * 13;
      T.text(t.text, x + w / 2, y + 3, { size: 5, color: '#3a1a10', align: 'center' });
    });
    if (this.banners.length) {
      const b = this.banners[0], slide = Math.min(1, b.t / 12) * Math.min(1, (BANNER_T - b.t) / 12), y = -30 + slide * 34;
      T.text('NEW DISCOVERY: ' + b.text, 160, y + 4, { size: 7, color: '#3a1a10', align: 'center' });
      T.wrap(b.sub, 76, y + 14, 168, { size: 5, color: '#6a3a20' });
    }
  },

  drawCardText(T) {
    const { x, y } = this.cardBox();
    if (this.card.recipe) {
      const L = this.card.recipe;
      T.text('ORDER', x + 4, y + 4, { size: 5, color: '#8a6a50' });
      T.text(LEVEL_TIERS[L.tier].title.toUpperCase(), x + 116, y + 4, { size: 4, color: '#8a6a50', align: 'right' });
      T.wrap(L.title.toUpperCase(), x + 4, y + 16, 112, { size: 7, color: '#2a1820' });
      T.wrap(L.blurb, x + 4, y + 29, 112, { size: 5, color: '#4a3428' });
      const lim = Levels.timeLimit(L);
      T.text(`Time limit ${(lim / 60) | 0}:${String(lim % 60).padStart(2, '0')}`, x + 4, y + 72, { size: 4, color: '#a03a2a' });
      T.text('click to close', x + 116, y + 72, { size: 4, color: '#a08870', align: 'right' });
      return;
    }
    const r = this.card.res;
    if (r.unmixed) {
      T.text('TASTE', x + 4, y + 4, { size: 7, color: '#3a2418' });
      if (r.temp) T.text(Math.round(r.temp) + '°C', x + 130, y + 4, { size: 6, color: '#8a5a40', align: 'right' });
      TASTE_AXES.forEach((k, n) => { T.text(k, x + 4, y + 15 + n * 7, { size: 5, color: '#5a4038' }); T.text('?', x + 74, y + 15 + n * 7, { size: 5, color: '#a08870', align: 'center' }); });
      T.text('? ? ?', x + 120, y + 30, { size: 7, color: '#a08870', align: 'center' });
      T.text('"' + r.line + '"', x + 4, y + 78, { size: 5, color: '#a03a2a' });
      return;
    }
    T.text('TASTE', x + 4, y + 4, { size: 7, color: '#3a2418' });
    T.text(Math.round(r.temp) + '°C', x + 130, y + 4, { size: 6, color: '#8a5a40', align: 'right' });
    TASTE_AXES.forEach((k, n) => T.text(k, x + 4, y + 15 + n * 7, { size: 5, color: '#5a4038' }));
    const stars = Math.round(r.score * 5);
    T.text('★'.repeat(stars) + '☆'.repeat(5 - stars), x + 108, y + 20, { size: 6, color: '#d08a20' });
    if (r.notes && r.notes.length) T.wrap(r.notes.join(' · '), x + 108, y + 32, 26, { size: 5, color: '#6a7a40' });
    T.text('"' + r.line + '"', x + 4, y + 78, { size: 5, color: '#a03a2a' });
    if (r.tex && r.tex.length) T.wrap('Texture: ' + r.tex.join(' · '), x + 4, y + 87, 128, { size: 5, color: '#3a5a7a' });
  },


};
