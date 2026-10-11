// Career menu: the kitchen pass board (one ticket rail per tier), saved progress, and the in-level recipe ticket.

// ---------- Saved progress (per browser) ----------
const Progress = {
  KEY: 'soupgame.progress.v1',
  data: { best: {} },

  load() {
    try { const d = JSON.parse(localStorage.getItem(this.KEY)); if (d && d.best) this.data = d; } catch (e) { /* private mode etc.: play without saving */ }
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },

  best(id) { return this.data.best[id] || null; },
  reset() { this.data = { best: {}, story: {}, journal: [] }; this.save(); Sim.discovered = new Set(); },
  // Remember a discovery for good. Returns true if it's new to you.
  learn(id) {
    const j = this.data.journal = this.data.journal || [];
    if (j.includes(id)) return false;
    j.push(id); this.save(); return true;
  },
  passed(id) { const b = this.best(id); return !!(b && b.passed); },

  // Keep the best score, and every badge or handshake ever earned on the dish.
  record(level, r, handshake) {
    const old = this.best(level.id) || {};
    const rank = { perfect: 2, good: 1 };
    this.data.best[level.id] = {
      score: Math.max(old.score || 0, r.total),
      passed: !!(old.passed || r.passed),
      badge: (rank[r.badge] || 0) >= (rank[old.badge] || 0) ? r.badge || old.badge || null : old.badge,
      handshake: !!(old.handshake || handshake),
    };
    this.save();
  },

  // Tier 0 is always open; each later tier opens once every dish in the tier before it is passed.
  unlocked(tier) {
    const t = LEVEL_TIERS[tier];
    if (!t || t.locked) return false;
    if (tier === 0) return true;
    return LEVELS.filter((l) => l.tier === tier - 1).every((l) => this.passed(l.id));
  },
};

// ---------- The pass board ----------
const BOARD = { rowY: 28, rowH: 44, labelW: 66, ticketX: 74, ticketW: 44, ticketH: 38, gap: 4 };
const BACK_BTN = { x: 120, y: 218, w: 80, h: 16 };

const Menu = {
  active: false, t: 0, hover: null, flash: null,

  ticket(tier, n) {
    return { x: BOARD.ticketX + n * (BOARD.ticketW + BOARD.gap), y: BOARD.rowY + tier * BOARD.rowH + 5 + (n & 1), w: BOARD.ticketW, h: BOARD.ticketH };
  },

  pick(x, y) {
    if (UI.hit(BACK_BTN, x, y)) return { type: 'back' };
    for (const t of LEVEL_TIERS) {
      const levels = LEVELS.filter((l) => l.tier === t.tier);
      for (let n = 0; n < 5; n++) if (UI.hit(this.ticket(t.tier, n), x, y)) return { type: 'level', tier: t.tier, level: levels[n] || null };
    }
    return null;
  },

  click(x, y) {
    const h = this.pick(x, y);
    if (!h) return;
    if (h.type === 'back') Game.toTitle();
    else if (h.level && Progress.unlocked(h.tier)) Game.startLevel(h.level);
  },

  update(mx, my) { this.t++; this.hover = this.pick(mx, my); if (this.flash && ++this.flash.t > 240) this.flash = null; },

  draw(g) {
    // Stainless wall behind the kitchen pass, warm heat lamps along the top.
    rect(g, 0, 0, W, H, [52, 54, 64]);
    for (let y = 0; y < H; y += 12) rect(g, 0, y, W, 1, [58, 60, 70]);
    for (let x = 30; x < W; x += 64) { ellipse(g, x, 3, 10, 3, [90, 70, 60]); g.fillStyle = 'rgba(255,170,80,0.08)'; g.beginPath(); g.moveTo(x - 8, 4); g.lineTo(x + 8, 4); g.lineTo(x + 30, 30); g.lineTo(x - 30, 30); g.fill(); }
    rect(g, 0, 22, W, 2, [96, 100, 114]);

    for (const t of LEVEL_TIERS) {
      const open = Progress.unlocked(t.tier), y0 = BOARD.rowY + t.tier * BOARD.rowH;
      // Tier plate.
      rect(g, 4, y0 + 6, BOARD.labelW - 2, BOARD.ticketH - 2, open ? [150, 100, 62] : [70, 70, 80]);
      rect(g, 5, y0 + 7, BOARD.labelW - 4, BOARD.ticketH - 4, open ? [190, 136, 84] : [84, 86, 96]);
      // Ticket rail.
      rect(g, BOARD.ticketX - 4, y0 + 3, W - BOARD.ticketX + 2, 3, open ? [200, 204, 216] : [110, 112, 124]);
      rect(g, BOARD.ticketX - 4, y0 + 3, W - BOARD.ticketX + 2, 1, open ? [240, 244, 250] : [130, 132, 144]);
      const levels = LEVELS.filter((l) => l.tier === t.tier);
      for (let n = 0; n < 5; n++) {
        const r = this.ticket(t.tier, n), lv = levels[n];
        const hov = open && lv && this.hover && this.hover.type === 'level' && this.hover.level === lv;
        const y = r.y - (hov ? 2 : 0);
        if (!open || !lv) {
          // Face-down ticket with a padlock.
          rect(g, r.x, y, r.w, r.h, [96, 98, 110]); rect(g, r.x + 1, y + 1, r.w - 2, r.h - 2, [120, 122, 134]);
          rect(g, r.x + r.w / 2 - 4, y + 17, 9, 7, [70, 72, 84]); rect(g, r.x + r.w / 2 - 2, y + 13, 5, 5, [70, 72, 84]); rect(g, r.x + r.w / 2 - 1, y + 14, 3, 3, [120, 122, 134]);
          continue;
        }
        const best = Progress.best(lv.id);
        // Paper ticket with a clip, a perforated stub, and the dish's key ingredient.
        rect(g, r.x + 1, y + 1, r.w, r.h, [30, 30, 38]);
        rect(g, r.x, y, r.w, r.h, hov ? [255, 255, 250] : [246, 242, 230]);
        for (let k = 2; k < r.w - 2; k += 3) rect(g, r.x + k, y + 6, 1, 1, [190, 180, 160]);
        rect(g, r.x + r.w / 2 - 3, y - 3, 7, 5, [170, 174, 188]); rect(g, r.x + r.w / 2 - 2, y - 2, 5, 1, [230, 234, 242]);
        const ing = SHELF.find((s) => s.id === lv.icon);
        if (ing) g.drawImage(Art.icon(ing.icon, ing.c), r.x + 2, y + 8);
        // Badges: a green check for passed, a gold star for Good Soup, two for Perfect, a little handshake.
        if (best && best.passed) stamp(g, r.x + r.w - 9, y + 9, best.badge);
        if (best && best.handshake) { rect(g, r.x + r.w - 10, y + 20, 4, 3, [176, 120, 84]); rect(g, r.x + r.w - 7, y + 21, 4, 3, [236, 196, 160]); }
      }
    }
    button(g, BACK_BTN, this.hover && this.hover.type === 'back');
  },

  drawText(T) {
    T.text('LEVEL SELECT', 160, 9, { size: 9, color: '#ffe9c0', align: 'center', shadow: true });
    for (const t of LEVEL_TIERS) {
      const open = Progress.unlocked(t.tier), y0 = BOARD.rowY + t.tier * BOARD.rowH;
      const levels = LEVELS.filter((l) => l.tier === t.tier);
      const done = levels.filter((l) => Progress.passed(l.id)).length;
      T.wrap(t.title.toUpperCase(), 8, y0 + 10, BOARD.labelW - 10, { size: 5, color: open ? '#3a2014' : '#b0b2c0' });
      const sub = t.locked ? 'Coming soon' : !open ? 'Pass the row above' : `${done} / ${levels.length} passed`;
      T.wrap(sub, 8, y0 + 30, BOARD.labelW - 10, { size: 4, color: open ? '#5a3424' : '#9a9cac' });
      if (!open) continue;
      levels.forEach((lv, n) => {
        const r = this.ticket(t.tier, n), best = Progress.best(lv.id);
        const hov = this.hover && this.hover.type === 'level' && this.hover.level === lv, y = r.y - (hov ? 2 : 0);
        T.wrap(lv.short.toUpperCase(), r.x + 3, y + 26, r.w - 4, { size: 4, color: '#2a1820' });
        T.text(best ? best.score.toFixed(1) : 'NEW', r.x + r.w - 3, y + 1, { size: 4, color: best ? (best.passed ? '#2a7a3a' : '#a03a2a') : '#8a6a50', align: 'right' });
      });
    }
    T.text('BACK', 160, BACK_BTN.y + 5, { size: 6, color: '#3a2020', align: 'center' });
    // Hovered dish: its blurb along the bottom.
    const h = this.hover;
    if (h && h.type === 'level' && h.level && Progress.unlocked(h.tier)) T.wrap(h.level.title + ': ' + h.level.blurb, 8, 208, 104, { size: 4, color: '#c8cad8' });
    else if (h && h.type === 'level' && !Progress.unlocked(h.tier)) T.text(LEVEL_TIERS[h.tier].locked ? 'Coming soon.' : 'Pass every dish in the tier above to open this one.', 8, 210, { size: 4, color: '#c8cad8' });
    if (this.flash) T.text(this.flash.text, 240, 222, { size: 5, color: '#ffd860', align: 'center', shadow: true });
  },
};

// Little rubber stamps for a passed dish: a check, a gold star (Good Soup) or two (Perfect).
function stamp(g, x, y, badge) {
  if (badge === 'good' || badge === 'perfect') {
    const star = (sx, sy) => { rect(g, sx + 2, sy, 1, 2, [230, 170, 30]); rect(g, sx, sy + 2, 5, 1, [230, 170, 30]); rect(g, sx + 1, sy + 3, 3, 1, [230, 170, 30]); rect(g, sx + 1, sy + 4, 1, 1, [230, 170, 30]); rect(g, sx + 3, sy + 4, 1, 1, [230, 170, 30]); };
    star(x, y); if (badge === 'perfect') star(x, y + 6);
  } else {
    rect(g, x, y + 2, 1, 1, [60, 150, 70]); rect(g, x + 1, y + 3, 1, 1, [60, 150, 70]); rect(g, x + 2, y + 2, 1, 1, [60, 150, 70]); rect(g, x + 3, y + 1, 1, 1, [60, 150, 70]); rect(g, x + 4, y, 1, 1, [60, 150, 70]);
  }
}

function button(g, b, hov, danger) {
  rect(g, b.x, b.y, b.w, b.h, [40, 24, 30]);
  rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, danger ? (hov ? [236, 96, 80] : [214, 70, 60]) : hov ? [255, 226, 130] : [250, 210, 90]);
  rect(g, b.x + 1, b.y + 1, b.w - 2, 2, danger ? [250, 140, 120] : [255, 240, 170]);
}

// ---------- Title menu (Story, Sandbox, Settings) and Settings ----------
const TITLE_BTNS = [
  { id: 'story', label: 'STORY', x: 110, y: 118, w: 100, h: 20 },
  { id: 'sandbox', label: 'SANDBOX', x: 110, y: 144, w: 100, h: 20 },
  { id: 'settings', label: 'SETTINGS', x: 110, y: 170, w: 100, h: 20 },
];
const SETTINGS_BTNS = [
  { id: 'journal', label: 'JOURNAL', x: 110, y: 84, w: 100, h: 20 },
  { id: 'reset', label: 'RESET PROGRESS', x: 95, y: 122, w: 130, h: 20, danger: true },
  { id: 'back', label: 'BACK', x: 110, y: 176, w: 100, h: 20 },
];

const Title = {
  active: false, page: 'root', hover: null, confirmReset: 0, flash: null,
  buttons() { return this.page === 'root' ? TITLE_BTNS : SETTINGS_BTNS; },
  update(mx, my) {
    this.hover = this.buttons().find((b) => UI.hit(b, mx, my)) || null;
    if (this.confirmReset > 0) this.confirmReset--;
    if (this.flash && ++this.flash.t > 150) this.flash = null;
  },
  click(x, y) {
    const b = this.buttons().find((b) => UI.hit(b, x, y));
    if (!b) return;
    if (b.id === 'story') Game.startStory();
    else if (b.id === 'sandbox') Game.startSandbox();
    else if (b.id === 'settings') this.page = 'settings';
    else if (b.id === 'journal') Journal.open();
    else if (b.id === 'back') this.page = 'root';
    else if (b.id === 'reset') {
      if (this.confirmReset > 0) { Progress.reset(); this.confirmReset = 0; this.flash = { text: 'Progress reset', t: 0 }; }
      else this.confirmReset = 180;
    }
  },
  draw(g) {
    // The kitchen, dimmed, with the pot as a backdrop.
    g.drawImage(BG.kitchen, 0, 0);
    Art.drawPotBack(g); Art.drawPotFront(g, 0);
    rect(g, 0, 0, W, H, 'rgba(20,12,18,0.62)');
    for (const b of this.buttons()) button(g, b, this.hover === b, b.danger);
  },
  drawText(T) {
    if (this.page === 'root') {
      T.text('SOUP POT', 160, 40, { size: 26, color: '#ffe9c0', align: 'center', shadow: true });
      T.text('a falling-sand cooking game', 160, 80, { size: 6, color: '#d8c0b0', align: 'center' });
    } else {
      T.text('SETTINGS', 160, 50, { size: 16, color: '#ffe9c0', align: 'center', shadow: true });
      T.text('Every technique you have discovered.', 160, 108, { size: 5, color: '#d8c0b0', align: 'center' });
      T.text('Wipes your scores, badges, journal and story progress.', 160, 146, { size: 5, color: '#d8c0b0', align: 'center' });
    }
    for (const b of this.buttons()) {
      const label = b.id === 'reset' && this.confirmReset > 0 ? 'CLICK AGAIN TO RESET' : b.label;
      T.text(label, b.x + b.w / 2, b.y + 7, { size: 6, color: b.danger ? '#fff' : '#3a2020', align: 'center' });
    }
    if (this.flash) T.text(this.flash.text, 160, 200, { size: 7, color: '#ffd860', align: 'center', shadow: true });
  },
};

// ---------- Journal: every technique, ten to a page, with the full description (or a hint if not found yet) ----------
const JOURNAL_PER = 10;
const JOURNAL_BTNS = [
  { id: 'prev', label: '< PREV', x: 20, y: 216, w: 60, h: 16 },
  { id: 'back', label: 'BACK', x: 130, y: 216, w: 60, h: 16 },
  { id: 'next', label: 'NEXT >', x: 240, y: 216, w: 60, h: 16 },
];
const Journal = {
  active: false, page: 0, hover: null,
  open() { this.active = true; this.page = 0; },
  close() { this.active = false; },
  pages() { return Math.ceil(DISCOVERIES.length / JOURNAL_PER); },
  update(mx, my) { this.hover = JOURNAL_BTNS.find((b) => UI.hit(b, mx, my)) || null; },
  click(x, y) {
    const b = JOURNAL_BTNS.find((b) => UI.hit(b, x, y));
    if (!b) return;
    if (b.id === 'back') this.close();
    else if (b.id === 'prev') this.page = Math.max(0, this.page - 1);
    else this.page = Math.min(this.pages() - 1, this.page + 1);
  },
  entry(n) { const col = n % 2, row = (n / 2) | 0; return { x: 12 + col * 150, y: 30 + row * 37, w: 146, h: 34 }; },
  draw(g) {
    rect(g, 0, 0, W, H, [60, 36, 30]);
    rect(g, 6, 6, W - 12, H - 12, [40, 24, 20]); rect(g, 8, 8, W - 16, H - 16, [250, 240, 220]);
    rect(g, 159, 26, 1, 186, [220, 204, 180]);   // the book's spine
    DISCOVERIES.slice(this.page * JOURNAL_PER, (this.page + 1) * JOURNAL_PER).forEach((d, n) => {
      const e = this.entry(n), got = Sim.discovered.has(d.id);
      rect(g, e.x, e.y, e.w, e.h, got ? [255, 248, 228] : [236, 228, 212]);
      if (got) rect(g, e.x, e.y, 2, e.h, [210, 130, 60]);
    });
    for (const b of JOURNAL_BTNS) button(g, b, this.hover === b);
  },
  drawText(T) {
    const found = DISCOVERIES.filter((d) => Sim.discovered.has(d.id)).length;
    T.text('JOURNAL', 14, 12, { size: 8, color: '#5a2a1a' });
    T.text(`${found} / ${DISCOVERIES.length} discovered   ·   page ${this.page + 1} of ${this.pages()}`, W - 14, 14, { size: 5, color: '#8a6a50', align: 'right' });
    DISCOVERIES.slice(this.page * JOURNAL_PER, (this.page + 1) * JOURNAL_PER).forEach((d, n) => {
      const e = this.entry(n), got = Sim.discovered.has(d.id);
      T.text(got ? d.name : '???', e.x + 5, e.y + 3, { size: 6, color: got ? '#3a2418' : '#a09080' });
      T.wrap(got ? d.desc : 'Hint: ' + d.hint, e.x + 5, e.y + 12, e.w - 9, { size: 4.5, color: got ? '#5a4030' : '#9a8a78' });
    });
    for (const b of JOURNAL_BTNS) T.text(b.label, b.x + b.w / 2, b.y + 5, { size: 5, color: '#3a2020', align: 'center' });
  },
};
