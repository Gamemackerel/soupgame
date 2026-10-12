// Boot, input, and the main update/draw loop.

const screen = document.getElementById('screen');
const sctx = screen.getContext('2d');
const off = makeCanvas(W, H), g = off.getContext('2d');
window.g = g;
// The pot is drawn upright into its own image while it's being tipped, then rotated as one solid piece.
const potCanvas = makeCanvas(W, H), potCtx = potCanvas.getContext('2d');
const simCanvas = makeCanvas(GW, GH), simCtx = simCanvas.getContext('2d');
const simImg = simCtx.createImageData(GW, GH);

const input = { x: 160, y: 120, px: 160, py: 120, down: false, consumed: false };
let paused = false;

function resize() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
  screen.width = W * s; screen.height = H * s;
  T.s = s; T.ctx = sctx;
  sctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);
resize();

function toInternal(e) {
  const r = screen.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
const inGrid = (x, y) => x >= GX && x < GX + GW && y >= GY && y < GY + GH;
const overPotArea = (x, y) => x >= GX - 12 && x < GX + GW + 12 && y >= 24 && y < GY + GH;
// With the ladle, the chef reaches wherever the cursor is in the kitchen (and keeps going over a menu while you hold the button) (held up in the air away from
// the pot). Just outside the walls or bottom it presses against them, so you can scrape. Over the side
// panels or the controls along the bottom he stops and just holds it.
const LADLE_MARGIN = 25;
const inKitchen = (x, y) => x >= 58 && x < 262 && y >= 12 && y < 214;
let prevLadle = null;
function ladleAt(x, y) {
  // Beside or below the pot (within the margin): pressed against the wall or bottom, scraping.
  const beside = x >= GX - LADLE_MARGIN && x < GX + GW + LADLE_MARGIN && y >= GY && y < GY + GH + LADLE_MARGIN;
  if (beside) return { x: Math.max(GX + 1, Math.min(GX + GW - 2, x)), y: Math.max(GY, Math.min(GY + GH - 2, y)) };
  return { x, y, air: true };   // anywhere else, the chef just holds it up where you point
}

screen.addEventListener('pointerdown', (e) => {
  Music.unlock();
  const p = toInternal(e);
  input.x = input.px = p.x; input.y = input.py = p.y;
  screen.setPointerCapture(e.pointerId);
  if (Story.active) { Story.click(); return; }
  if (Journal.active) { Journal.click(p.x, p.y); return; }
  if (Title.active) { Title.click(p.x, p.y); return; }
  if (Menu.active) { Menu.click(p.x, p.y); return; }
  if (Judging.active) {
    if (Judging.phase === 'done') {
      const b = Judging.buttons().find((b) => UI.hit(b, p.x, p.y));
      if (b) Game.after(b.id);
    } else Judging.click();
    return;
  }
  input.down = true;
  input.consumed = UI.click(p.x, p.y);
  // Whole eggs and fish are one click each: crack on the rim, drop, or throw.
  const held = Chef.held;
  if (!input.consumed && UI.tool === 'pour' && held && held.kind === 'whole' && overPotArea(p.x, p.y) && !Sim.lid) {
    const gx = Math.max(0, Math.min(GW - 1, Math.round(p.x - GX)));
    if (held.id === 'egg') {
      if (Chef.cracked) { Sim.dropCrackedEgg(gx); Sim.discover('crack'); Chef.cracked = false; Chef.swapT = 12; }
      else if (Chef.onRim(p.y)) Chef.crack();
      else { Sim.throwEgg(gx); Chef.throwIt(); }
    } else { Sim.throwFish(gx); Chef.throwIt(); }
    input.consumed = true;
  }
  if (!input.consumed && UI.tool === 'taste' && Chef.spoon && !Chef.spoon.air) {
    const res = Taste.sip((Chef.spoon.x - GX) | 0, (Chef.spoon.y - GY) | 0);   // wherever the spoon is in the pot
    UI.showTaste(res);
    if (!res.empty) Chef.sip(res.unmixed ? 0.4 : res.score || 0, res.line);   // unmixed: a puzzled sip
    input.consumed = true;
  }
});
screen.addEventListener('pointermove', (e) => {
  const p = toInternal(e);
  input.x = p.x; input.y = p.y;
  if (UI.dragDial) UI.setDial(p.x, p.y);
  if (Title.dragging) Title.slide(p.x);
});
const release = () => { input.down = false; UI.dragDial = false; Title.dragging = false; };
screen.addEventListener('pointerup', release);
screen.addEventListener('pointercancel', release);
screen.addEventListener('wheel', (e) => {
  e.preventDefault();
  Sim.dial = Math.max(0, Math.min(10, Sim.dial + (e.deltaY < 0 ? 0.5 : -0.5)));
}, { passive: false });
// In the kitchen with nothing on top of it (not a menu, a cutscene, judging or the journal).
function cooking() { return !Story.active && !Title.active && !Menu.active && !Judging.active && !Journal.active && !Tip.active; }
addEventListener('keydown', (e) => {
  Music.unlock();
  if (e.key >= '0' && e.key <= '9') Sim.dial = e.key === '0' ? 0 : +e.key + (e.shiftKey ? 1 : 0);
  else if (e.key === ' ') { paused = !paused; e.preventDefault(); }
  else if (cooking() && !e.metaKey && !e.ctrlKey && UI.hotkey(e.key.toLowerCase())) {}   // S, T, L, W (see UI.hotkey)
  else if (e.key === 'j' || e.key === 'J') { if (Journal.active) Journal.close(); else if (!Title.active && !Story.active) Journal.open(); }
  else if (e.key === 'Escape') { if (Story.active) Story.skip(); if (Journal.active) Journal.close(); UI.card = null; }
});

function update() {
  if (Story.active) { Story.update(); Chef.t++; return; }
  if (Journal.active) { Journal.update(input.x, input.y); Chef.t++; return; }
  if (Title.active) { Title.update(input.x, input.y); Chef.t++; return; }
  if (Menu.active) { Menu.update(input.x, input.y); Chef.t++; return; }
  if (Judging.active) { Judging.update(); Chef.ladle = Chef.spoon = null; Chef.update(160, false, false); return; }
  UI.hover = UI.pick(input.x, input.y);
  const active = input.down && !input.consumed && !UI.dragDial;
  const pouring = active && UI.tool === 'pour' && overPotArea(input.x, input.y) && !!Chef.held && Chef.held.kind !== 'whole' && !Tip.active;
  // With the ladle over the pot, the chef holds it in the soup at the cursor.
  // Over a menu (or with the lid on) the chef stands at ease: hand on hip, holding whatever he has.
  Chef.onMenu = !inKitchen(input.x, input.y);
  // With the lid on, the ladle just comes to rest on top of it.
  // Holding the button down keeps working the ladle even if the cursor strays over a menu.
  const ladleHeld = input.down && !input.consumed && UI.tool === 'ladle';
  Chef.ladle = UI.tool === 'ladle' && (!Chef.onMenu || ladleHeld) && !Tip.active
    ? (Sim.lid ? { x: Math.max(GX + 4, Math.min(GX + GW - 4, input.x)), y: Math.min(input.y, POT_TOP - 7), air: true }
      // Held down, it stays in the pot: pinned inside the walls wherever the cursor goes, still stirring and scraping.
      : ladleHeld ? { x: Math.max(GX + 1, Math.min(GX + GW - 2, input.x)), y: Math.max(GY, Math.min(GY + GH - 2, input.y)) }
      : ladleAt(input.x, input.y)) : null;
  Chef.idleLadle = UI.tool === 'ladle' && !Chef.ladle;
  // The tasting spoon works the same way: in the kitchen he reaches it wherever you point.
  // The tasting spoon stays between the pot's walls and above its bottom anywhere in the kitchen (until the cursor
  // reaches a menu), but it lifts freely up out of the pot.
  Chef.spoon = UI.tool === 'taste' && !Chef.onMenu && !Tip.active
    ? { x: Math.max(GX + 2, Math.min(GX + GW - 3, input.x)), y: Math.min(GY + GH - 2, input.y) } : null;
  if (Chef.spoon) Chef.spoon.air = Chef.spoon.y < GY;
  Chef.idleSpoon = UI.tool === 'taste' && !Chef.spoon;
  Chef.update(input.x, (overPotArea(input.x, input.y) && UI.tool === 'pour') || !!Chef.ladle || !!Chef.spoon, pouring);

  Tip.update();
  Spill.update();
  if (Game.level && !Game.timedOut && Game.timeLeft() <= 0) { Game.timedOut = true; UI.banner("TIME'S UP!", 'The judges are waiting. Your dish goes out as it is.'); Game.serve(); }
  if (!paused && !Tip.active) {
    if (Chef.pouring) {
      const ip = Chef.itemPos(input.x), gx = Math.round(ip.x - 6 - GX);
      const ing = Chef.held;
      // With the lid on, it just bounces off the lid and goes everywhere.
      if (ing.kind !== 'chunk' || Sim.frame % 8 === 0) { if (Sim.lid) Sim.bounceOffLid(ing, GX + gx); else Sim.pour(ing, gx, ing.rate); }
    }
    // Moving the ladle through the pot stirs (no click needed). Its clamped position means dragging
    // along just outside the walls or bottom scrapes them.
    const lp = Chef.ladle;
    // Just moving the ladle stirs at about 2/3 power; clicking and holding works it at full power.
    if (lp && !lp.air && prevLadle && !prevLadle.air) Sim.stir((lp.x - GX) | 0, (lp.y - GY) | 0, lp.x - prevLadle.x, lp.y - prevLadle.y, 5, ladleHeld ? 1 : 0.67);
    prevLadle = lp;
    Sim.step();
  }
  input.px = input.x; input.py = input.y;

  for (const ev of Sim.events) {
    if (ev.t === 'discover') {
      // New to you: the full banner, and it goes in the journal. Seen before: just a small toast.
      const d = DISCOVERIES.find((d) => d.id === ev.id);
      if (d && Progress.learn(ev.id)) UI.banner(d.name, d.desc);
      else if (d) UI.toast(d.name);
    }
    if (ev.t === 'fireball') Chef.soot = Math.min(1, Chef.soot + 0.6);
    Chef.react(ev);
  }
  Sim.events.length = 0;
  UI.update();
}

function drawParticles() {
  for (const p of Sim.particles) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    if (p.kind === 'flame' || p.kind === 'soot') continue;
    if (p.kind === 'debris') {
      // Flung food: solid while flying, fading out after it has rested a while.
      g.fillStyle = rgb(p.c, 1, p.rest ? Math.min(1, p.life / 120) : 1);
      g.fillRect(p.x | 0, p.y | 0, 1, 1);
      continue;
    }
    const s = p.kind === 'wisp' ? 2 : 1;
    g.fillStyle = rgb(p.c, 1, p.kind === 'wisp' ? a * 0.6 : a);
    g.fillRect(p.x | 0, p.y | 0, s, p.kind === 'spill' ? 3 : s);
  }
  // Black smoke, then flames on top with an additive glow.
  for (const p of Sim.particles) if (p.kind === 'soot') {
    const a = Math.max(0, Math.min(1, p.life / p.max)), s = p.s + (1 - a) * 6;
    g.fillStyle = rgb(p.c, 1, a * 0.5); g.fillRect((p.x - s / 2) | 0, (p.y - s / 2) | 0, s | 0, s | 0);
  }
  g.globalCompositeOperation = 'lighter';
  for (const p of Sim.particles) if (p.kind === 'flame') {
    const a = Math.max(0, Math.min(1, p.life / p.max)), s = p.s || 2;
    // Hot core (white-yellow → orange → red as it rises and cools) inside a faint, rounder glow.
    const c = a > 0.65 ? [255, 200, 70] : a > 0.35 ? [250, 120, 30] : [190, 45, 20];
    const x = p.x | 0, y = p.y | 0, h = Math.max(1, Math.round(s * (0.3 + a * 0.5)));
    g.fillStyle = rgb(c, 1, a * 0.08); g.fillRect(x - h, y - h, h * 2 + 1, h * 2 + 2);
    g.fillStyle = rgb(c, 1, Math.min(0.9, a * 1.2)); g.fillRect(x - (h >> 1), y - (h >> 1), h, h + 1);
  }
  g.globalCompositeOperation = 'source-over';
}

// plain: menus and cutscenes always show the arrow (never a tool).
function drawCursor(plain) {
  const x = input.x | 0, y = input.y | 0;
  if (!plain) {
    if (Chef.ladle || Chef.spoon) return;   // the chef's ladle or spoon is the cursor
    if (UI.tool === 'ladle' && inGrid(x, y)) { g.drawImage(Art.toolIcon('ladle'), x - 8, y - 12); return; }
    if (UI.tool === 'taste' && inGrid(x, y)) { g.drawImage(Art.toolIcon('spoon'), x - 8, y - 12); return; }
  }
  for (let k = 0; k < 7; k++) { rect(g, x, y + k, Math.max(1, 6 - k), 1, [40, 24, 30]); }
  for (let k = 1; k < 6; k++) { rect(g, x + 1, y + k, Math.max(1, 4 - k), 1, [255, 255, 255]); }
}

// Story levels: a countdown on the kitchen wall. When it runs out, the dish goes to the judges as it is.
function drawTimer(g) {
  const left = Game.timeLeft(), x = 225, y = 54, w = 36, h = 16;   // right of where the chef can stand
  rect(g, x - 1, y - 1, w + 2, h + 2, [30, 26, 30]); rect(g, x, y, w, h, [16, 14, 18]);
  const blink = left < 30 && (Chef.t >> 4) & 1;
  const s = Math.max(0, Math.ceil(left)), str = ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0');
  if (!blink) Art.pixelText(g, str, x + w / 2 - (str.length * 8 - 2) / 2, y + 3, left < 30 ? [255, 70, 50] : [255, 120, 60], 2);
}

// The pot and everything in it (drawn in place, or rotated while it's being tipped out).
function drawPot(t, glow, g = window.g) {
  Art.drawPotBack(g);
  Sim.render(simImg.data);
  simCtx.putImageData(simImg, 0, 0);
  g.drawImage(simCanvas, GX, GY);
  // Fire glows: each burning cell throws soft light around it, so flames read as a blaze.
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    if (Sim.mat[i] !== FIRE) continue;
    const a = Math.min(1, Sim.life[i] / 20);
    g.fillStyle = `rgba(255,${110 + (Sim.life[i] & 3) * 25},30,${0.16 * a})`;
    g.fillRect(GX + (i % GW) - 2, GY + ((i / GW) | 0) - 3, 5, 6);
  }
  g.globalCompositeOperation = 'source-over';
  // Fond stuck to the pot bottom.
  for (let x = 0; x < GW; x++) {
    if (Sim.fond[x] > 0.05) rect(g, GX + x, GY + GH - 1, 1, 1, mix([150, 90, 50], [70, 40, 20], Sim.fond[x]));
  }
  Art.drawPotFront(g, glow);
  // The lid rattles on a hard boil. (Lifted for tasting, it's drawn later, over the chef's spoon arm.)
  if (Sim.lid && !lidLifted()) Art.drawLid(g, t, 0, Sim.dial >= 7 && Sim.turb > 0.3);
}
// Tasting with the lid on: the chef holds the lid up by its handle and reaches the spoon in under it.
function lidLifted() { return Sim.lid && !Tip.active && !!Chef.spoon && !Chef.spoon.air; }
const LID_LIFT = 7;

// ---------- Spills: physics for food that has left the pot ----------
// Anything poured out falls under gravity, lands on the stovetop and piles up (solids stack; liquids spread
// into a thin puddle, then stop, and slowly evaporate). It only vanishes when it leaves the screen.
// When the pot slams back down on the burner, the whole pile blasts across the kitchen and splats on the
// wall (and the chef), leaving the stovetop clean. The splatter stays on the wall until a fresh pot.
const SPILL_FLOOR = GY + GH + 9;   // the stovetop's surface, just in front of the pot's base
const Spill = {
  moving: [], flying: [], img: null, cv: null, ctx: null, wall: null, wallCv: null, wallCtx: null, wallDirty: false,
  solid: new Uint8Array(W * H), liquid: new Uint8Array(W * H),
  init() {
    this.cv = makeCanvas(W, H); this.ctx = this.cv.getContext('2d'); this.img = this.ctx.createImageData(W, H);
    this.wallCv = makeCanvas(W, H); this.wallCtx = this.wallCv.getContext('2d'); this.wall = this.wallCtx.createImageData(W, H);
  },
  clear() {
    this.moving.length = 0; this.flying.length = 0; this.solid.fill(0); this.liquid.fill(0);
    if (this.img) { this.img.data.fill(0); this.wall.data.fill(0); this.wallDirty = true; }
  },
  // Blast everything on the stovetop (and anything still falling) up and out from where the pot lands.
  // Returns how many bits flew.
  explode(cx = 160, cy = SPILL_FLOOR) {
    if (!this.img) return 0;
    const d = this.img.data, bits = [];
    for (let i = 0; i < W * H; i++) if (this.solid[i] || this.liquid[i]) { bits.push({ x: i % W, y: (i / W) | 0, c: [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], liquid: !!this.liquid[i] }); this.take(i); }
    for (const p of this.moving) bits.push({ x: p.x, y: p.y, c: p.c, liquid: p.liquid });
    this.moving.length = 0;
    for (const b of bits) {
      const dx = b.x - cx, side = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
      const speed = 2.5 + Math.random() * 5;
      this.flying.push({ x: b.x, y: Math.min(b.y, cy - 1), vx: side * speed * (0.4 + Math.random()) + (Math.random() - 0.5) * 2, vy: -(3 + Math.random() * 6),
        c: b.c, liquid: b.liquid, life: 10 + ((Math.random() * 50) | 0) });
    }
    return bits.length;
  },
  splat(x, y, c, liquid) {
    const w = this.wall.data, put = (px, py) => {
      if (px < 0 || px >= W || py < 0 || py >= SPILL_FLOOR - 2) return;
      const i = (py * W + px) * 4; w[i] = c[0]; w[i + 1] = c[1]; w[i + 2] = c[2]; w[i + 3] = liquid ? 200 : 255;
    };
    put(x, y);
    if (liquid) { for (let k = 1, n = (Math.random() * 4) | 0; k <= n; k++) put(x, y + k); }   // wet: a drip runs down
    else { put(x + 1, y); if (Math.random() < 0.6) { put(x, y + 1); put(x + 1, y + 1); } }    // a chunk: a little blob
    this.wallDirty = true;
  },
  add(x, y, vx, vy, c, liquid) { if (this.moving.length < 12000) this.moving.push({ x, y, vx, vy, c, liquid }); },
  free(x, y) { return x >= 0 && x < W && y >= 0 && y < SPILL_FLOOR && !this.solid[y * W + x] && !this.liquid[y * W + x]; },
  // (A cell moved past the screen's edge just leaves.)
  put(x, y, c, liquid) {
    const i = y * W + x, d = this.img.data;
    (liquid ? this.liquid : this.solid)[i] = 1;
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = liquid ? 220 : 255;
  },
  take(i) { this.solid[i] = this.liquid[i] = 0; this.img.data[i * 4 + 3] = 0; },
  update() {
    if (!this.img) this.init();
    // The blast: bits fly until they hit the wall (splat where they are) or the chef, or leave the screen.
    for (let k = this.flying.length - 1; k >= 0; k--) {
      const p = this.flying[k];
      p.vy += 0.2; p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x >= W || p.y >= H) { this.flying.splice(k, 1); continue; }
      if (p.y < GY - 6 && Chef.hit(p)) { this.flying.splice(k, 1); continue; }
      if (--p.life <= 0) { this.splat(Math.round(p.x), Math.round(p.y), p.c, p.liquid); this.flying.splice(k, 1); }
    }
    // Flying bits: gravity, until they hit the stovetop or something that's already landed.
    const m = this.moving;
    for (let k = m.length - 1; k >= 0; k--) {
      const p = m[k];
      p.vy += 0.2; p.vx *= 0.99;
      const steps = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy)));
      for (let s = 0; s < steps; s++) {
        const nx = p.x + p.vx / steps, ny = p.y + p.vy / steps;
        if (nx < 0 || nx >= W || ny >= H) { m.splice(k, 1); break; }   // off screen: gone
        if (ny >= 0 && !this.free(Math.round(nx), Math.round(ny))) {
          const x = Math.round(p.x), y = Math.round(p.y);
          if (this.free(x, y)) this.put(x, y, p.c, p.liquid);
          m.splice(k, 1); break;
        }
        p.x = nx; p.y = ny;
      }
    }
    // Landed spill is falling sand: it drops, tumbles down the sides of piles, and liquid runs sideways
    // into a thin puddle (and off the edge of the stove, out of view). Puddles slowly evaporate.
    const d = this.img.data, flip = (Chef.t & 1) === 1;
    for (let y = SPILL_FLOOR - 1; y >= 0; y--) {
      for (let k = 0; k < W; k++) {
        const x = flip ? W - 1 - k : k, i = y * W + x, liq = this.liquid[i];
        if (!liq && !this.solid[i]) continue;
        if (liq && Math.random() < 0.0015) { this.take(i); continue; }
        const c = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
        const move = (nx, ny) => { this.take(i); if (nx >= 0 && nx < W) this.put(nx, ny, c, liq); };
        if (this.free(x, y + 1)) { move(x, y + 1); continue; }
        const dx = Math.random() < 0.5 ? -1 : 1;
        if (this.free(x + dx, y + 1) || x + dx < 0 || x + dx >= W) { move(x + dx, y + 1); continue; }
        if (this.free(x - dx, y + 1) || x - dx < 0 || x - dx >= W) { move(x - dx, y + 1); continue; }
        if (liq) {
          for (const s of [dx, -dx]) {
            const nx = x + s;
            if (nx < 0 || nx >= W) { this.take(i); break; }
            if (this.free(nx, y)) { move(nx, y); break; }
          }
        }
      }
    }
  },
  draw(g) {
    if (!this.img) return;
    this.ctx.putImageData(this.img, 0, 0);
    g.drawImage(this.cv, 0, 0);
    for (const p of this.moving) { g.fillStyle = rgb(p.c); g.fillRect(p.x | 0, p.y | 0, 1, 1); }
    for (const p of this.flying) { g.fillStyle = rgb(p.c); g.fillRect(p.x | 0, p.y | 0, 1, 1); }
  },
  // The splatter on the back wall, drawn behind the chef.
  drawWall(g) {
    if (!this.wall) return;
    if (this.wallDirty) { this.wallCtx.putImageData(this.wall, 0, 0); this.wallDirty = false; }
    g.drawImage(this.wallCv, 0, 0);
  },
};

// Emptying the pot: the chef flips it (table-flip style) and it rolls over on its bottom-left edge, sliding
// right as it goes so it stays in frame, to ~140° (still slanted, like a real pour). It holds there 1 s, then
// rolls back. Throughout, the contents feel real gravity: "down" is worked out in the pot's own tilted frame
// every frame, so the soup sloshes to the low wall as it starts to tip, then pours out over the rim.
const TIP_ROLL = 55, TIP_HOLD = 60, TIP_MAX = Math.PI * 0.78;
const DIRS8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const Tip = {
  active: false, t: 0,
  start() {
    if (this.active) return;
    this.active = true; this.t = 0; Sim.lid = false; Sim.inverted = true;   // (no burner heating while it's off the stove)
    // Pieces come apart as it tumbles; steam and flames don't pour.
    for (let i = 0; i < N; i++) { Sim.body[i] = 0; const m = Sim.mat[i]; if (CLS[m] === C_GAS || m === FIRE) Sim.setCell(i, EMPTY); }
    Sim.bodyVel.clear(); Sim.bodyShape.clear(); Sim.fond.fill(0);
    Chef.react({ t: 'overflow' });
  },
  phase() { return this.t < TIP_ROLL ? 'roll' : this.t < TIP_ROLL + TIP_HOLD ? 'hold' : 'back'; },
  // How far over it is: 0 upright → 1 fully tipped.
  turn() {
    const u = this.t < TIP_ROLL ? this.t / TIP_ROLL : this.t < TIP_ROLL + TIP_HOLD ? 1 : Math.max(0, 1 - (this.t - TIP_ROLL - TIP_HOLD) / TIP_ROLL);
    return (1 - Math.cos(u * Math.PI)) / 2;
  },
  slide() { const u = this.turn(); return [(POT_R - POT_L) * u, (POT_TOP - POT_BOT) * 0.85 * u]; },
  transform(g) {
    const [sx, sy] = this.slide();
    g.translate(sx, sy); g.translate(POT_L, POT_BOT); g.rotate(-TIP_MAX * this.turn()); g.translate(-POT_L, -POT_BOT);
  },
  // Where a point on the upright pot ends up on screen.
  map(x, y) {
    const a = -TIP_MAX * this.turn(), [sx, sy] = this.slide(), dx = x - POT_L, dy = y - POT_BOT;
    return [POT_L + dx * Math.cos(a) - dy * Math.sin(a) + sx, POT_BOT + dx * Math.sin(a) + dy * Math.cos(a) + sy];
  },
  // One step of falling-sand physics with gravity in the pot's frame. Each cell tries to move along gravity
  // (snapped to the nearest of 8 directions, with the neighbouring directions as fallbacks); liquids also
  // spread sideways across the new "floor". A cell that moves out past the rim leaves the pot.
  pourStep() {
    const b = TIP_MAX * this.turn(), gx = -Math.sin(b), gy = Math.cos(b);
    const dir = (Math.round(Math.atan2(gy, gx) / (Math.PI / 4)) + 8) % 8;
    const cells = [];
    for (let i = 0; i < N; i++) if (Sim.mat[i] !== EMPTY) cells.push(i);
    // Lowest first (furthest along gravity), so a column falls together instead of in one-cell steps.
    cells.sort((p, q) => (gx * (q % GW) + gy * ((q / GW) | 0)) - (gx * (p % GW) + gy * ((p / GW) | 0)));
    const exits = [];
    for (const i of cells) {
      const m = Sim.mat[i]; if (m === EMPTY) continue;
      const x = i % GW, y = (i / GW) | 0, liquid = CLS[m] === C_LIQUID;
      const side = Math.random() < 0.5 ? 1 : -1;
      const tries = [dir, (dir + side + 8) % 8, (dir - side + 8) % 8];
      if (liquid) tries.push((dir + 2 * side + 8) % 8, (dir - 2 * side + 8) % 8);
      for (const d of tries) {
        const nx = x + DIRS8[d][0], ny = y + DIRS8[d][1];
        if (ny < 0 && nx >= 0 && nx < GW) { exits.push(i); break; }          // over the rim and out
        if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) continue;                // the pot's walls and floor
        const j = ny * GW + nx;
        if (Sim.mat[j] === EMPTY) { Sim.swap(i, j); break; }
      }
    }
    // Out over the rim: each cell carries on outside the pot as a spill, moving out of the mouth and down.
    const a = -TIP_MAX * this.turn(), ox = Math.sin(a) * 1.2, oy = -Math.cos(a) * 1.2;   // the rim's outward direction on screen
    for (const i of exits) {
      const [px, py] = this.map(GX + (i % GW), GY - 1);
      Spill.add(px, py, ox + (Math.random() - 0.5) * 0.4, oy + Math.random() * 0.3, Sim.cellRGB(i), CLS[Sim.mat[i]] === C_LIQUID);
      Sim.setCell(i, EMPTY);
    }
  },
  update() {
    if (!this.active) return;
    this.t++;
    Chef.mood = 'angry'; Chef.moodT = 20;   // (╯°□°)╯ ︵ ┻━┻
    for (let k = 0; k < 5; k++) this.pourStep();   // liquid finds its level fast
    if (this.t >= TIP_ROLL * 2 + TIP_HOLD) {
      this.active = false; Sim.reset();
      // It slams back down on the burner: whatever's piled on the stove goes everywhere.
      const n = Spill.explode();
      if (n > 20) { Sim.shake = Math.min(40, 10 + n / 40); Chef.react({ t: 'fizz' }); }
      else { Chef.mood = 'idle'; Chef.say('Fresh start!', 60); }
    }
  },
  // The pot (with its contents, which are already in the pot's frame) drawn upright into its own image, then
  // rotated as one solid piece.
  draw(g, t, glow) {
    potCtx.clearRect(0, 0, W, H);
    drawPot(t, glow, potCtx);
    g.save(); g.imageSmoothingEnabled = false; this.transform(g); g.drawImage(potCanvas, 0, 0); g.restore();
  },
};

function draw() {
  // Full-screen pages: a cutscene, the title menu, or level select.
  const page = Story.active ? Story : Journal.active ? Journal : Title.active ? Title : Menu.active ? Menu : null;
  if (page) {
    page.draw(g); drawCursor(true);
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(off, 0, 0, screen.width, screen.height);
    page.drawText(T);
    return;
  }
  if (Judging.active) {
    Judging.draw(g);
  } else {
    const t = Sim.frame;
    // The default kitchen, Papa Dom's pizza shop for the first tier, Souped Up's studio after that.
    g.drawImage(Sprites.canvas('backgrounds/' + (!Game.level ? 'kitchen' : Game.level.tier === 0 ? 'pizza-shop' : 'studio-kitchen'), 'default', 0), 0, 0);
    // Soot from a kitchen fire stays on the wall until a fresh pot.
    if (Sim.soot > 0) { g.fillStyle = `rgba(30,22,24,${Sim.soot * 0.65})`; g.fillRect(58, 0, 204, GY + 4); }
    Spill.drawWall(g);   // and so does food blasted off the stove
    if (Game.level) drawTimer(g);   // on the back wall, behind the chef
    Chef.draw(g, input.x, input.y);
    Art.drawFlames(g, Sim.dial, t, false);
    const glow = Math.max(0, Math.min(1, (Sim.panT - 150) / 120));
    if (glow > 0) { g.fillStyle = `rgba(255,80,30,${0.18 * glow})`; ellipse(g, 160, GY + GH + 10, 72, 4, g.fillStyle); }   // warm light on the grate
    if (!Tip.active) drawPot(t, glow);
    Art.drawFlames(g, Sim.dial, t, true);
    Chef.flipping = Tip.active ? Math.min(1, Tip.turn() * 2.5) : 0;
    Chef.liftingLid = lidLifted();
    Chef.drawArms(g, input.x);
    if (Chef.liftingLid) { Art.drawLid(g, t, LID_LIFT); Chef.drawLidHand(g, Art.lidKnob(t, LID_LIFT)); }
    if (!Tip.active) { drawParticles(); Spill.draw(g); }
    // The whole kitchen glows orange while something is on fire.
    if (Sim.fire > 0) { g.fillStyle = `rgba(255,120,40,${Sim.fire * (Sim.disaster ? 0.16 : 0.08) * (0.8 + Math.random() * 0.4)})`; g.fillRect(0, 0, W, H); }
    UI.draw(g, input.x, input.y);
    if (Tip.active) {
      Tip.draw(g, t, glow);
      Spill.draw(g);
      drawParticles();
    }
  }
  drawCursor();

  sctx.imageSmoothingEnabled = false;
  const shake = Sim.shake > 0 && !Judging.active ? Math.min(3, Sim.shake / 10) : 0;
  sctx.fillStyle = '#000'; if (shake) sctx.fillRect(0, 0, screen.width, screen.height);
  sctx.drawImage(off, Math.round((Math.random() - 0.5) * 2 * shake) * T.s, Math.round((Math.random() - 0.5) * 2 * shake) * T.s, screen.width, screen.height);
  if (Judging.active) Judging.drawText(T);
  else { UI.drawText(T, input.x, input.y); Chef.drawText(T); }
}

// Fixed timestep: the game always runs 60 steps a second of real time, whatever the screen's refresh rate (a 144 Hz
// monitor used to run everything 2.4x fast). Each animation frame runs however many steps have come due, then draws.
const STEP_MS = 1000 / 60, MAX_STEPS = 5;
let lastFrame = null, stepDebt = 0;
function loop(now = performance.now()) {
  stepDebt += lastFrame === null ? STEP_MS : Math.min(250, now - lastFrame);   // (back from a hidden tab: no fast-forward)
  lastFrame = now;
  let steps = 0;
  // A hair of slack, so a 60 Hz screen's jittery frame times still give exactly one step a frame (the average holds).
  while (stepDebt > STEP_MS - 1 && steps < MAX_STEPS) { update(); stepDebt -= STEP_MS; steps++; }
  if (steps === MAX_STEPS) stepDebt = 0;   // a very slow machine runs slower rather than piling up
  draw();
  // The menu theme in the menus; now and then a short track while cooking; nothing in cutscenes or judging.
  Music.update(Story.active ? null : Title.active || Menu.active ? 'menu' : Judging.active ? null : 'kitchen');
  requestAnimationFrame(loop);
}

Sim.reset();
Chef.select(SHELF[0]);
// Dev: #demo pre-cooks a pot; #judge also jumps to judging.
// What's being cooked: a career level (scored against its recipe by its tier's judges) or free sandbox play.
// The game opens on level select (js/menu.js). Dev hashes skip it: #level=chili, #panel=joe,gordo,paul,
// and combine with the views below, e.g. #verdict&panel=gordo,paul,joe.
const DEV = (() => {
  const parts = location.hash.slice(1).split('&'), arg = {};
  for (const p of parts) if (p.includes('=')) { const [k, v] = p.split('='); arg[k] = decodeURIComponent(v); }
  return { view: parts[0].includes('=') ? '' : parts[0], ...arg };
})();
const Game = {
  level: DEV.level ? Levels.byId(DEV.level) || null : null, levelStart: 0,
  panel: DEV.panel ? DEV.panel.split(',').filter((id) => JUDGE_ROSTER[id]).slice(0, 3) : null,
  judging() { return { level: this.level, panel: this.panel && this.panel.length === 3 ? this.panel : null }; },

  tipPot() { Tip.start(); },
  freshPot() { Tip.active = false; Spill.clear(); Sim.reset(); Chef.clean(); Sim.dial = 0; Sim.lid = false; UI.tool = 'pour'; UI.card = null; UI.confirm = null; Chef.select(SHELF[0]); paused = false; },
  timeLeft() { return this.level ? Levels.timeLimit(this.level) - (Sim.frame - this.levelStart) / 60 : Infinity; },
  startLevel(level) {
    this.level = level; this.panel = null; this.timedOut = false;
    this.freshPot(); Menu.active = false; Title.active = false; Judging.active = false;
    this.levelStart = Sim.frame;
    UI.showRecipe();
  },
  startSandbox() { this.level = null; this.freshPot(); Menu.active = false; Title.active = false; Judging.active = false; Chef.say('Bonjour! Let\'s cook!', 120); },
  toMenu() { Menu.active = true; Title.active = false; Judging.active = false; },
  toTitle() { Title.active = true; Title.page = 'root'; Menu.active = false; Judging.active = false; },
  // Story: the first time, Papa Dom's intro plays before level select.
  startStory() { if (Story.seen('intro')) this.toMenu(); else { Title.active = false; Story.play('intro', () => this.toMenu()); } },
  tierDone(t) { const ls = LEVELS.filter((l) => l.tier === t); return ls.length > 0 && ls.every((l) => Progress.passed(l.id)); },
  // The next dish to play after this one: the next in its tier, else the first of the next open tier.
  nextLevel() {
    if (!this.level) return null;
    const k = LEVELS.indexOf(this.level), next = LEVELS[k + 1];
    return next && Progress.unlocked(next.tier) ? next : null;
  },
  serve() {
    Judging.start(this.judging());
    const L = Judging.levelResult;
    if (L && this.level) {
      const tierOpenBefore = Progress.unlocked(this.level.tier + 1), doneBefore = this.tierDone(this.level.tier);
      Progress.record(this.level, L, Judging.handshake);
      // Finishing a tier for the first time unlocks the next chapter of the story.
      const scene = ['pizzaDone', 'showDone'][this.level.tier];
      if (!doneBefore && this.tierDone(this.level.tier) && scene && !Story.seen(scene)) this.pendingStory = scene;
      if (!tierOpenBefore && Progress.unlocked(this.level.tier + 1)) Menu.flash = { text: LEVEL_TIERS[this.level.tier + 1].title + ' unlocked!', t: 0 };
    }
  },
  // A button on the judges' 'done' screen.
  after(id) {
    if (this.pendingStory) { const s = this.pendingStory; this.pendingStory = null; Judging.active = false; Story.play(s, () => this.toMenu()); return; }
    if (id === 'menu' && !this.level) return this.toTitle();   // from sandbox, back to the title menu
    if (id === 'keep') Judging.active = false;
    else if (id === 'new') { this.freshPot(); Judging.active = false; }
    else if (id === 'retry') this.startLevel(this.level);
    else if (id === 'next') { const n = this.nextLevel(); if (n) this.startLevel(n); else this.toMenu(); }
    else if (id === 'menu') this.toMenu();
  },
};
// Food and drops flying out of the pot can splat onto the chef.
Sim.hitChef = (p) => Chef.hit(p);
Progress.load();
Sim.discovered = new Set(Progress.data.journal || []);   // everything you've ever discovered
if (Game.level) UI.showRecipe();
if (!DEV.view && !DEV.level && !DEV.panel && !DEV.story) Title.active = true;
if (DEV.story && STORY[DEV.story]) Story.play(DEV.story, () => Game.toMenu());   // dev: #story=intro / pizzaDone / showDone

if (DEV.view === 'bread') {
  // Dev: a kneaded, leavened loaf baking in the pot oven (lid on).
  const ing = (id) => SHELF.find((s) => s.id === id);
  const pour = (id, secs) => { const g = ing(id); for (let f = 0; f < secs * 60; f++) { Sim.pour(g, 76 + ((f * 5) % 7) - 3, g.rate); Sim.step(); } };
  pour('flour', 3); pour('water', 1); pour('salt', 0.08); pour('powder', 0.2);
  let ph = 0, prev = null;
  for (let f = 0; f < 480; f++) { ph += 0.12; const p = { x: Math.round(76 + Math.cos(ph) * 45), y: Math.round(80 + Math.sin(ph) * 4) }; if (prev) Sim.stir(p.x, p.y, p.x - prev.x, p.y - prev.y, 6); prev = p; Sim.step(); }
  Sim.lid = true; Sim.dial = 6; for (let f = 0; f < 60 * 40; f++) Sim.step();
  Sim.lid = false; Sim.events.length = 0; Chef.select(ing('flour'));
} else if (DEV.view === 'fire') {
  // Dev: a grease fire in full swing.
  const ing = (id) => SHELF.find((s) => s.id === id);
  for (let f = 0; f < 90; f++) { Sim.pour(ing('oil'), 76, 4); Sim.step(); }
  Sim.dial = 10; for (let f = 0; f < 60 * 12; f++) Sim.step();
  Sim.events.length = 0; Chef.select(ing('extinguisher'));
} else if (DEV.view === 'plate') {
  // Dev: a dry dish (seared beef, fish, fried egg) served on a plate.
  const ing = (id) => SHELF.find((s) => s.id === id);
  for (let f = 0; f < 24; f++) { Sim.pour(ing('oil'), 76, 4); Sim.step(); }
  Sim.dial = 7; for (let f = 0; f < 900; f++) Sim.step();
  for (let k = 0; k < 8; k++) { Sim.pour(ing('meat'), 40 + k * 10, 1); for (let f = 0; f < 8; f++) Sim.step(); }
  Sim.throwFish(110); Sim.dropCrackedEgg(50); for (let f = 0; f < 60; f++) Sim.step();
  Sim.pour(ing('garlic'), 70, 1); Sim.pour(ing('herbs'), 90, 1);
  for (let f = 0; f < 1800; f++) Sim.step();
  for (let f = 0; f < 6; f++) { Sim.pour(ing('soy'), 76, 3); Sim.step(); }
  for (let f = 0; f < 300; f++) Sim.step();
  Sim.events.length = 0;
  Judging.start(Game.judging()); Judging.k = 3; Judging.next('done');
} else if (/^(demo|judge|speak|verdict|eggs)$/.test(DEV.view)) {
  const ing = (id) => SHELF.find((s) => s.id === id);
  for (let f = 0; f < 60; f++) { Sim.pour(ing('oil'), 76, 4); Sim.step(); }
  for (let f = 0; f < 160; f++) { if (f % 8 === 0) Sim.pour(ing('onion'), 30 + (f * 3) % 90, 1); if (f % 8 === 4) Sim.pour(ing('carrot'), 50 + (f * 5) % 70, 1); Sim.step(); }
  Sim.dial = 5; for (let f = 0; f < 900; f++) Sim.step();
  for (let f = 0; f < 700; f++) { Sim.pour(ing('water'), 10 + (f * 7) % 130, 7); Sim.step(); }
  for (let f = 0; f < 80; f++) { if (f % 8 === 0) Sim.pour(ing('tomato'), 40 + f, 1); Sim.pour(ing('salt'), 70, 1); Sim.step(); }
  Sim.dial = 7; for (let f = 0; f < 600; f++) Sim.step();
  Sim.events.length = 0;
  Chef.select(ing('chili'));
  if (DEV.view === 'eggs') {
    Sim.throwFish(40); Sim.dropCrackedEgg(100); for (let f = 0; f < 200; f++) Sim.step();
    Sim.throwEgg(120); for (let f = 0; f < 600; f++) Sim.step();
    Chef.select(ing('egg')); Chef.swapT = 0; Chef.cracked = true; input.y = POT_TOP - 4;
  } else if (DEV.view !== 'demo') Judging.start(Game.judging());
  if (DEV.view === 'speak') { Judging.k = 1; Judging.next('speak'); Judging.typed = 999; }
  if (DEV.view === 'verdict') { Judging.k = 3; Judging.next('done'); }
}
if (!Game.level && !Menu.active) Chef.say('Bonjour! Let\'s cook!', 120);
if (!window.SOUP_MOBILE) loop();   // (phones get the "desktop only" note in index.html instead)
