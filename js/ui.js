// UI: ingredient shelf, tool panel, heat dial, taste card, journal, discovery banners, crisp text.

// Crisp text drawn on the full-res screen canvas, positioned in internal pixel coords.
const T = {
  ctx: null, s: 3,
  text(str, x, y, o = {}) {
    const c = this.ctx, s = this.s, size = (o.size || 7) * s;
    c.font = `${size}px Silkscreen, monospace`;
    c.textAlign = o.align || 'left'; c.textBaseline = 'top';
    if (o.shadow) { c.fillStyle = '#1b1018'; c.fillText(str, x * s + s, y * s + s); }
    c.fillStyle = o.color || '#fff';
    c.fillText(str, x * s, y * s);
  },
  wrap(str, x, y, w, o = {}) {
    const c = this.ctx, s = this.s, size = (o.size || 7);
    c.font = `${size * s}px Silkscreen, monospace`;
    let line = '', yy = y;
    for (const word of str.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (c.measureText(test).width > w * s && line) { this.text(line, x, yy, o); line = word; yy += size + 3; }
      else line = test;
    }
    if (line) this.text(line, x, yy, o);
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

const SHELF_X = 2, SHELF_Y = 14, SLOT_W = 27, SLOT_H = 17;
const TOOLS = [
  { id: 'pour', icon: 'hand', label: 'Pour' },
  { id: 'ladle', icon: 'ladle', label: 'Stir' },
  { id: 'taste', icon: 'spoon', label: 'Taste' },
  { id: 'lid', icon: 'lid', label: 'Lid' },
  { id: 'journal', icon: 'book', label: 'Journal' },
  { id: 'clear', icon: 'trash', label: 'Empty' },
];
const TOOL_X = 266, TOOL_Y = 16, TOOL_H = 22;
const DIAL = { x: 160, y: 227, r: 9 };
const SERVE = { x: 266, y: 168, w: 50, h: 22 };

const UI = {
  tool: 'pour', hover: null, card: null, journal: false, banners: [], confirmClear: 0,
  dragDial: false,

  shelfSlot(n) { return { x: SHELF_X + (n % 2) * SLOT_W, y: SHELF_Y + ((n / 2) | 0) * SLOT_H, w: SLOT_W - 1, h: SLOT_H - 1 }; },
  toolSlot(n) { return { x: TOOL_X, y: TOOL_Y + n * TOOL_H, w: 50, h: TOOL_H - 2 }; },

  hit(r, x, y) { return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h; },

  // Returns what's under the cursor.
  pick(x, y) {
    for (let n = 0; n < SHELF.length; n++) if (this.hit(this.shelfSlot(n), x, y)) return { type: 'ing', n };
    for (let n = 0; n < TOOLS.length; n++) if (this.hit(this.toolSlot(n), x, y)) return { type: 'tool', n };
    if (this.hit(SERVE, x, y)) return { type: 'serve' };
    if ((x - DIAL.x) ** 2 + (y - DIAL.y) ** 2 <= (DIAL.r + 4) ** 2) return { type: 'dial' };
    return null;
  },

  click(x, y) {
    if (this.journal) { this.journal = false; return true; }
    if (this.card && this.card.t > 10) this.card = null;
    const h = this.pick(x, y);
    if (!h) return false;
    if (h.type === 'ing') { Chef.select(SHELF[h.n]); this.tool = 'pour'; }
    else if (h.type === 'tool') {
      const id = TOOLS[h.n].id;
      if (id === 'lid') Sim.lid = !Sim.lid;
      else if (id === 'journal') this.journal = true;
      else if (id === 'clear') {
        if (this.confirmClear > 0) { Sim.reset(); this.confirmClear = 0; Chef.say('Fresh start!', 60); }
        else { this.confirmClear = 120; }
      }
      else this.tool = id;
    }
    else if (h.type === 'serve') Judging.start();
    else if (h.type === 'dial') { this.dragDial = true; this.setDial(x, y); }
    return true;
  },

  setDial(x, y) {
    // Angle from -135° (off) to +135° (max), measured from straight up.
    let a = Math.atan2(x - DIAL.x, -(y - DIAL.y)) * 180 / Math.PI;
    a = Math.max(-135, Math.min(135, a));
    Sim.dial = Math.round(((a + 135) / 270) * 10 * 2) / 2;
  },

  showTaste(res) { this.card = { res, t: 0 }; },

  banner(text, sub) { this.banners.push({ text, sub, t: 0 }); },

  update() {
    if (this.card) { this.card.t++; if (this.card.t > 420) this.card = null; }
    if (this.confirmClear > 0) this.confirmClear--;
    if (this.banners.length) { const b = this.banners[0]; if (++b.t > 150) this.banners.shift(); }
  },

  draw(g, mx, my) {
    // Shelf: wooden board.
    rect(g, 0, 12, 58, 214, [120, 76, 48]); rect(g, 1, 13, 56, 212, [160, 106, 66]);
    SHELF.forEach((ing, n) => {
      const s = this.shelfSlot(n), sel = Chef.held === ing, hov = this.hover && this.hover.type === 'ing' && this.hover.n === n;
      rect(g, s.x + 1, s.y + 1, s.w - 1, s.h - 1, sel ? [255, 214, 110] : hov ? [196, 140, 92] : [176, 120, 76]);
      rect(g, s.x + 1, s.y + s.h - 2, s.w - 1, 2, [120, 76, 48]);
      const bobY = sel ? Math.round(Math.sin(Chef.t * 0.15)) : 0;
      g.drawImage(Art.icon(ing.icon, ing.c), s.x + 5, s.y + bobY);
    });
    // Tool panel.
    rect(g, 262, 12, 58, 214, [120, 76, 48]); rect(g, 263, 13, 56, 212, [160, 106, 66]);
    TOOLS.forEach((tl, n) => {
      const s = this.toolSlot(n);
      const on = this.tool === tl.id || (tl.id === 'lid' && Sim.lid) || (tl.id === 'clear' && this.confirmClear > 0);
      rect(g, s.x, s.y, s.w, s.h, [96, 60, 40]);
      rect(g, s.x + 1, s.y + 1, s.w - 2, s.h - 2, on ? [255, 214, 110] : [214, 176, 130]);
      g.drawImage(Art.toolIcon(tl.icon), s.x + 2, s.y + 2);
    });
    // Serve button.
    const pulse = Math.sin(Chef.t * 0.1) > 0 ? 1.05 : 1;
    rect(g, SERVE.x, SERVE.y, SERVE.w, SERVE.h, [60, 20, 20]);
    rect(g, SERVE.x + 1, SERVE.y + 1, SERVE.w - 2, SERVE.h - 2, rgb([220, 60, 50], pulse));
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
    if (this.journal) { rect(g, 30, 14, 260, 212, [40, 24, 30]); rect(g, 31, 15, 258, 210, [250, 240, 220]); rect(g, 31, 15, 258, 14, [170, 70, 60]); }
    if (this.banners.length) {
      const b = this.banners[0], slide = Math.min(1, b.t / 12) * Math.min(1, (150 - b.t) / 12);
      const y = -30 + slide * 34;
      rect(g, 70, y, 180, 28, [40, 24, 30]); rect(g, 71, y + 1, 178, 26, [255, 222, 110]);
      for (let k = 0; k < 6; k++) rect(g, 74 + ((k * 31 + b.t * 2) % 172), y + 3 + (k * 7) % 20, 1, 1, [255, 255, 255]);
    }
  },

  drawThermo(g) {
    const x = 270, y = 196, temps = Taste.gather(0, 0, 0);
    rect(g, x, y, 42, 10, [60, 40, 30]); rect(g, x + 1, y + 1, 40, 8, [240, 236, 228]);
    const t = Math.max(0, Math.min(1, (temps.temp - 20) / 230));
    rect(g, x + 2, y + 3, 38 * t, 4, t > 0.75 ? [240, 60, 40] : t > 0.32 ? [250, 160, 60] : [100, 170, 240]);
    rect(g, x + 2 + 38 * (80 / 230), y + 2, 1, 6, [80, 80, 90]);
    this.potTemp = temps.temp;
  },

  drawCard(g) {
    const x = 92, y = 16;
    rect(g, x, y, 136, 86, [40, 24, 30]); rect(g, x + 1, y + 1, 134, 84, [255, 250, 238]);
    if (this.card.res.empty) return;
    const p = this.card.res.p;
    TASTE_AXES.forEach((k, n) => {
      const by = y + 16 + n * 7;
      rect(g, x + 44, by + 1, 60, 4, [230, 222, 210]);
      const v = p[k], [ideal, tol] = IDEAL[k];
      const good = Math.abs(v - ideal) <= tol + 0.05;
      rect(g, x + 44, by + 1, 60 * v, 4, good ? [110, 190, 90] : v > ideal ? [230, 90, 70] : [240, 180, 70]);
      rect(g, x + 44 + 60 * ideal, by, 1, 6, [80, 60, 70]);
    });
  },

  drawText(T, mx, my) {
    T.text('SOUP POT', 160, 1, { size: 7, color: '#ffe9c0', align: 'center' });
    T.text('PANTRY', 29, 4, { size: 6, color: '#7a3a2a', align: 'center' });
    T.text('TOOLS', 291, 4, { size: 6, color: '#7a3a2a', align: 'center' });
    TOOLS.forEach((tl, n) => {
      const s = this.toolSlot(n);
      const label = tl.id === 'lid' ? (Sim.lid ? 'Lid on' : 'Lid off') : tl.id === 'clear' && this.confirmClear ? 'Sure?' : tl.label;
      T.text(label, s.x + 20, s.y + 7, { size: 5, color: '#3a2418' });
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
      const ing = SHELF[this.hover.n];
      T.bubble(ing.name, mx + 10, my - 6);
    }
    if (this.card) this.drawCardText(T);
    if (this.journal) this.drawJournalText(T);
    if (this.banners.length) {
      const b = this.banners[0], slide = Math.min(1, b.t / 12) * Math.min(1, (150 - b.t) / 12), y = -30 + slide * 34;
      T.text('NEW DISCOVERY: ' + b.text, 160, y + 4, { size: 7, color: '#3a1a10', align: 'center' });
      T.wrap(b.sub, 76, y + 14, 168, { size: 5, color: '#6a3a20' });
    }
  },

  drawCardText(T) {
    const x = 92, y = 16, r = this.card.res;
    if (r.empty) { T.text(r.line, x + 68, y + 38, { size: 6, color: '#3a2418', align: 'center' }); return; }
    T.text('TASTE', x + 4, y + 4, { size: 7, color: '#3a2418' });
    T.text(Math.round(r.temp) + '°C', x + 130, y + 4, { size: 6, color: '#8a5a40', align: 'right' });
    TASTE_AXES.forEach((k, n) => T.text(k, x + 4, y + 15 + n * 7, { size: 5, color: '#5a4038' }));
    const stars = Math.round(r.score * 5);
    T.text('★'.repeat(stars) + '☆'.repeat(5 - stars), x + 108, y + 20, { size: 6, color: '#d08a20' });
    if (r.notes && r.notes.length) T.wrap(r.notes.join(' · '), x + 108, y + 32, 26, { size: 5, color: '#6a7a40' });
    T.text('"' + r.line + '"', x + 4, y + 78, { size: 5, color: '#a03a2a' });
  },

  drawJournalText(T) {
    T.text('JOURNAL  ' + Sim.discovered.size + ' / ' + DISCOVERIES.length, 36, 18, { size: 7, color: '#fff' });
    const cols = 3, rows = Math.ceil(DISCOVERIES.length / cols);
    DISCOVERIES.forEach((d, n) => {
      const col = (n / rows) | 0, row = n % rows;
      const x = 35 + col * 86, y = 30 + row * 13;
      const got = Sim.discovered.has(d.id);
      T.text(got ? d.name : '???', x, y, { size: 5, color: got ? '#3a2418' : '#a09080' });
      const sub = got ? d.desc : d.hint;
      T.text(sub.length > 30 ? sub.slice(0, 29) + '…' : sub, x, y + 6, { size: 3.5, color: got ? '#6a5040' : '#b0a090' });
    });
    T.text('click to close', 160, 216, { size: 5, color: '#a08070', align: 'center' });
  },
};
