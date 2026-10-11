// Boot, input, and the main update/draw loop.

const screen = document.getElementById('screen');
const sctx = screen.getContext('2d');
const off = makeCanvas(W, H), g = off.getContext('2d');
const simCanvas = makeCanvas(GW, GH), simCtx = simCanvas.getContext('2d');
const simImg = simCtx.createImageData(GW, GH);
const background = Art.buildBackground();

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
// The ladle comes out when the cursor first enters the pot, then follows it everywhere (held up in the air
// away from the pot). Just outside the walls or bottom it presses against them, so you can scrape.
// Clicking an ingredient or a control puts it away until the cursor enters the pot again.
const LADLE_MARGIN = 25;
let ladleIn = false, prevLadle = null;
function ladleAt(x, y) {
  if (inGrid(x, y)) ladleIn = true;
  if (!ladleIn) return null;
  // Beside or below the pot (within the margin): pressed against the wall or bottom, scraping.
  const beside = x >= GX - LADLE_MARGIN && x < GX + GW + LADLE_MARGIN && y >= GY && y < GY + GH + LADLE_MARGIN;
  if (beside) return { x: Math.max(GX + 1, Math.min(GX + GW - 2, x)), y: Math.max(GY, Math.min(GY + GH - 2, y)) };
  return { x, y, air: true };   // anywhere else, the chef just holds it up where you point
}

screen.addEventListener('pointerdown', (e) => {
  const p = toInternal(e);
  input.x = input.px = p.x; input.y = input.py = p.y;
  screen.setPointerCapture(e.pointerId);
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
  if (input.consumed) ladleIn = false;   // reaching for a control puts the ladle down
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
  if (!input.consumed && UI.tool === 'taste' && inGrid(p.x, p.y)) {
    const res = Taste.sip((p.x - GX) | 0, (p.y - GY) | 0);
    UI.showTaste(res);
    Chef.sip(res.score || 0, res.line);
    input.consumed = true;
  }
});
screen.addEventListener('pointermove', (e) => {
  const p = toInternal(e);
  input.x = p.x; input.y = p.y;
  if (UI.dragDial) UI.setDial(p.x, p.y);
});
const release = () => { input.down = false; UI.dragDial = false; };
screen.addEventListener('pointerup', release);
screen.addEventListener('pointercancel', release);
screen.addEventListener('wheel', (e) => {
  e.preventDefault();
  Sim.dial = Math.max(0, Math.min(10, Sim.dial + (e.deltaY < 0 ? 0.5 : -0.5)));
}, { passive: false });
addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') Sim.dial = e.key === '0' ? 0 : +e.key + (e.shiftKey ? 1 : 0);
  else if (e.key === ' ') { paused = !paused; e.preventDefault(); }
  else if (e.key === 'l' || e.key === 'L') Sim.lid = !Sim.lid;
  else if (e.key === 'j' || e.key === 'J') UI.journal = !UI.journal;
  else if (e.key === 'Escape') { UI.journal = false; UI.card = null; }
});

function update() {
  if (Menu.active) { Menu.update(input.x, input.y); Chef.t++; return; }
  if (Judging.active) { Judging.update(); Chef.ladle = null; Chef.update(160, false, false); return; }
  UI.hover = UI.pick(input.x, input.y);
  const active = input.down && !input.consumed && !UI.dragDial && !UI.journal;
  const pouring = active && UI.tool === 'pour' && overPotArea(input.x, input.y) && !!Chef.held && Chef.held.kind !== 'whole' && !Sim.lid;
  // With the ladle over the pot, the chef holds it in the soup at the cursor.
  Chef.ladle = UI.tool === 'ladle' && !Sim.lid && !UI.journal ? ladleAt(input.x, input.y) : (ladleIn = false, null);
  Chef.update(input.x, (overPotArea(input.x, input.y) && UI.tool === 'pour' && !Sim.lid) || !!Chef.ladle, pouring);

  if (!paused) {
    if (Chef.pouring) {
      const ip = Chef.itemPos(input.x), gx = Math.round(ip.x - 6 - GX);
      const ing = Chef.held;
      if (ing.kind !== 'chunk' || Sim.frame % 8 === 0) Sim.pour(ing, gx, ing.rate);
    }
    // Moving the ladle through the pot stirs (no click needed). Its clamped position means dragging
    // along just outside the walls or bottom scrapes them.
    const lp = Chef.ladle;
    if (lp && !lp.air && prevLadle && !prevLadle.air) Sim.stir((lp.x - GX) | 0, (lp.y - GY) | 0, lp.x - prevLadle.x, lp.y - prevLadle.y, 5);
    prevLadle = lp;
    Sim.step();
  }
  input.px = input.x; input.py = input.y;

  for (const ev of Sim.events) {
    if (ev.t === 'discover') {
      const d = DISCOVERIES.find((d) => d.id === ev.id);
      if (d) UI.banner(d.name, d.desc);
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

function drawCursor() {
  const x = input.x | 0, y = input.y | 0;
  if (Chef.ladle) return;   // the chef's ladle is the cursor
  if (UI.tool === 'ladle' && inGrid(x, y)) { g.drawImage(Art.toolIcon('ladle'), x - 8, y - 12); return; }
  if (UI.tool === 'taste' && inGrid(x, y)) { g.drawImage(Art.toolIcon('spoon'), x - 8, y - 12); return; }
  for (let k = 0; k < 7; k++) { rect(g, x, y + k, Math.max(1, 6 - k), 1, [40, 24, 30]); }
  for (let k = 1; k < 6; k++) { rect(g, x + 1, y + k, Math.max(1, 4 - k), 1, [255, 255, 255]); }
}

function draw() {
  if (Menu.active) {
    Menu.draw(g); drawCursor();
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(off, 0, 0, screen.width, screen.height);
    Menu.drawText(T);
    return;
  }
  if (Judging.active) {
    Judging.draw(g);
  } else {
    const t = Sim.frame;
    g.drawImage(background, 0, 0);
    // Soot from a kitchen fire stays on the wall until a fresh pot.
    if (Sim.soot > 0) { g.fillStyle = `rgba(30,22,24,${Sim.soot * 0.65})`; g.fillRect(58, 0, 204, GY + 4); }
    Chef.draw(g, input.x, input.y);
    Art.drawFlames(g, Sim.dial, t, false);
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
    const glow = Math.max(0, Math.min(1, (Sim.panT - 150) / 120));
    if (glow > 0) { g.fillStyle = `rgba(255,80,30,${0.18 * glow})`; ellipse(g, 160, GY + GH + 10, 72, 4, g.fillStyle); }   // warm light on the grate
    Art.drawPotFront(g, glow);
    if (Sim.lid) Art.drawLid(g, t);
    Art.drawFlames(g, Sim.dial, t, true);
    Chef.drawArms(g, input.x);
    drawParticles();
    // The whole kitchen glows orange while something is on fire.
    if (Sim.fire > 0) { g.fillStyle = `rgba(255,120,40,${Sim.fire * (Sim.disaster ? 0.16 : 0.08) * (0.8 + Math.random() * 0.4)})`; g.fillRect(0, 0, W, H); }
    UI.draw(g, input.x, input.y);
  }
  drawCursor();

  sctx.imageSmoothingEnabled = false;
  const shake = Sim.shake > 0 && !Judging.active ? Math.min(3, Sim.shake / 10) : 0;
  sctx.fillStyle = '#000'; if (shake) sctx.fillRect(0, 0, screen.width, screen.height);
  sctx.drawImage(off, Math.round((Math.random() - 0.5) * 2 * shake) * T.s, Math.round((Math.random() - 0.5) * 2 * shake) * T.s, screen.width, screen.height);
  if (Judging.active) Judging.drawText(T);
  else { UI.drawText(T, input.x, input.y); Chef.drawText(T); }
}

function loop() {
  update();
  draw();
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
  level: DEV.level ? Levels.byId(DEV.level) || null : null,
  panel: DEV.panel ? DEV.panel.split(',').filter((id) => JUDGE_ROSTER[id]).slice(0, 3) : null,
  judging() { return { level: this.level, panel: this.panel && this.panel.length === 3 ? this.panel : null }; },

  freshPot() { Sim.reset(); Chef.clean(); Sim.dial = 0; Sim.lid = false; UI.tool = 'pour'; UI.journal = false; UI.card = null; Chef.select(SHELF[0]); paused = false; },
  startLevel(level) {
    this.level = level; this.panel = null;
    this.freshPot(); Menu.active = false; Judging.active = false;
    UI.showRecipe();
  },
  startSandbox() { this.level = null; this.freshPot(); Menu.active = false; Judging.active = false; Chef.say('Bonjour! Let\'s cook!', 120); },
  toMenu() { Menu.active = true; Judging.active = false; },
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
      const tierOpenBefore = Progress.unlocked(this.level.tier + 1);
      Progress.record(this.level, L, Judging.handshake);
      if (!tierOpenBefore && Progress.unlocked(this.level.tier + 1)) Menu.flash = { text: LEVEL_TIERS[this.level.tier + 1].title + ' unlocked!', t: 0 };
    }
  },
  // A button on the judges' 'done' screen.
  after(id) {
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
if (Game.level) UI.showRecipe();
if (!DEV.view && !DEV.level && !DEV.panel) Menu.active = true;

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
loop();
