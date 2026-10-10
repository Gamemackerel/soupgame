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
  reset() { this.data = { best: {} }; this.save(); },
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
const SANDBOX_BTN = { x: 120, y: 218, w: 80, h: 16 };
const RESET_BTN = { x: 284, y: 226, w: 32, h: 10 };   // dev: wipe saved progress (click twice)

const Menu = {
  active: false, t: 0, hover: null, flash: null, confirmReset: 0,

  ticket(tier, n) {
    return { x: BOARD.ticketX + n * (BOARD.ticketW + BOARD.gap), y: BOARD.rowY + tier * BOARD.rowH + 5 + (n & 1), w: BOARD.ticketW, h: BOARD.ticketH };
  },

  pick(x, y) {
    if (UI.hit(SANDBOX_BTN, x, y)) return { type: 'sandbox' };
    if (UI.hit(RESET_BTN, x, y)) return { type: 'reset' };
    for (const t of LEVEL_TIERS) {
      const levels = LEVELS.filter((l) => l.tier === t.tier);
      for (let n = 0; n < 5; n++) if (UI.hit(this.ticket(t.tier, n), x, y)) return { type: 'level', tier: t.tier, level: levels[n] || null };
    }
    return null;
  },

  click(x, y) {
    const h = this.pick(x, y);
    if (!h) return;
    if (h.type === 'reset') {
      if (this.confirmReset > 0) { Progress.reset(); this.confirmReset = 0; this.flash = { text: 'Progress reset', t: 0 }; }
      else this.confirmReset = 180;
      return;
    }
    if (h.type === 'sandbox') Game.startSandbox();
    else if (h.level && Progress.unlocked(h.tier)) Game.startLevel(h.level);
  },

  update(mx, my) { this.t++; if (this.confirmReset > 0) this.confirmReset--; this.hover = this.pick(mx, my); if (this.flash && ++this.flash.t > 240) this.flash = null; },

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
    // Dev reset.
    const armed = this.confirmReset > 0;
    rect(g, RESET_BTN.x, RESET_BTN.y, RESET_BTN.w, RESET_BTN.h, armed ? [150, 40, 40] : [70, 72, 84]);
    rect(g, RESET_BTN.x + 1, RESET_BTN.y + 1, RESET_BTN.w - 2, RESET_BTN.h - 2, armed ? [220, 70, 60] : [96, 98, 110]);
    // Sandbox button.
    const hs = this.hover && this.hover.type === 'sandbox';
    rect(g, SANDBOX_BTN.x, SANDBOX_BTN.y, SANDBOX_BTN.w, SANDBOX_BTN.h, [40, 24, 30]);
    rect(g, SANDBOX_BTN.x + 1, SANDBOX_BTN.y + 1, SANDBOX_BTN.w - 2, SANDBOX_BTN.h - 2, hs ? [255, 226, 130] : [250, 210, 90]);
    rect(g, SANDBOX_BTN.x + 1, SANDBOX_BTN.y + 1, SANDBOX_BTN.w - 2, 2, [255, 240, 170]);
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
    T.text('SANDBOX', 160, SANDBOX_BTN.y + 5, { size: 6, color: '#3a2020', align: 'center' });
    T.text(this.confirmReset > 0 ? 'SURE?' : 'RESET', RESET_BTN.x + RESET_BTN.w / 2, RESET_BTN.y + 3, { size: 4, color: '#eef', align: 'center' });
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
