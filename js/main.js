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

screen.addEventListener('pointerdown', (e) => {
  const p = toInternal(e);
  input.x = input.px = p.x; input.y = input.py = p.y;
  screen.setPointerCapture(e.pointerId);
  if (Judging.active) {
    if (Judging.phase === 'done') {
      const b = Judging.buttons().find((b) => UI.hit(b, p.x, p.y));
      if (b) { if (b.id === 'new') Sim.reset(); Judging.active = false; }
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
  if (Judging.active) { Judging.update(); Chef.update(160, false, false); return; }
  UI.hover = UI.pick(input.x, input.y);
  const active = input.down && !input.consumed && !UI.dragDial && !UI.journal;
  const pouring = active && UI.tool === 'pour' && overPotArea(input.x, input.y) && !!Chef.held && Chef.held.kind !== 'whole' && !Sim.lid;
  Chef.update(input.x, overPotArea(input.x, input.y) && UI.tool === 'pour' && !Sim.lid, pouring);

  if (!paused) {
    if (Chef.pouring) {
      const ip = Chef.itemPos(input.x), gx = Math.round(ip.x - 6 - GX);
      const ing = Chef.held;
      if (ing.kind !== 'chunk' || Sim.frame % 8 === 0) Sim.pour(ing, gx, ing.rate);
    }
    if (active && UI.tool === 'ladle' && inGrid(input.x, input.y)) {
      Sim.stir((input.x - GX) | 0, (input.y - GY) | 0, input.x - input.px, input.y - input.py, 5);
    }
    Sim.step();
  }
  input.px = input.x; input.py = input.y;

  for (const ev of Sim.events) {
    if (ev.t === 'discover') {
      const d = DISCOVERIES.find((d) => d.id === ev.id);
      if (d) UI.banner(d.name, d.desc);
    }
    Chef.react(ev);
  }
  Sim.events.length = 0;
  UI.update();
}

function drawParticles() {
  for (const p of Sim.particles) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    const s = p.kind === 'wisp' ? 2 : 1;
    g.fillStyle = rgb(p.c, 1, p.kind === 'wisp' ? a * 0.6 : a);
    g.fillRect(p.x | 0, p.y | 0, s, p.kind === 'spill' ? 3 : s);
  }
}

function drawCursor() {
  const x = input.x | 0, y = input.y | 0;
  if (UI.tool === 'ladle' && inGrid(x, y)) { g.drawImage(Art.toolIcon('ladle'), x - 8, y - 12); return; }
  if (UI.tool === 'taste' && inGrid(x, y)) { g.drawImage(Art.toolIcon('spoon'), x - 8, y - 12); return; }
  for (let k = 0; k < 7; k++) { rect(g, x, y + k, Math.max(1, 6 - k), 1, [40, 24, 30]); }
  for (let k = 1; k < 6; k++) { rect(g, x + 1, y + k, Math.max(1, 4 - k), 1, [255, 255, 255]); }
}

function draw() {
  if (Judging.active) {
    Judging.draw(g);
  } else {
    const t = Sim.frame;
    g.drawImage(background, 0, 0);
    Chef.draw(g, input.x, input.y);
    Art.drawFlames(g, Sim.dial, t, false);
    Art.drawPotBack(g);
    Sim.render(simImg.data);
    simCtx.putImageData(simImg, 0, 0);
    g.drawImage(simCanvas, GX, GY);
    // Fond stuck to the pot bottom.
    for (let x = 0; x < GW; x++) {
      if (Sim.fond[x] > 0.05) rect(g, GX + x, GY + GH - 1, 1, 1, mix([150, 90, 50], [70, 40, 20], Sim.fond[x]));
    }
    Art.drawPotFront(g, Math.max(0, (Sim.panT - 120) / 150));
    if (Sim.lid) Art.drawLid(g, t);
    Art.drawFlames(g, Sim.dial, t, true);
    Chef.drawArms(g, input.x);
    drawParticles();
    UI.draw(g, input.x, input.y);
  }
  drawCursor();

  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(off, 0, 0, screen.width, screen.height);
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
if (/^#(demo|judge|speak|verdict|eggs)/.test(location.hash)) {
  const ing = (id) => SHELF.find((s) => s.id === id);
  for (let f = 0; f < 60; f++) { Sim.pour(ing('oil'), 76, 4); Sim.step(); }
  for (let f = 0; f < 160; f++) { if (f % 8 === 0) Sim.pour(ing('onion'), 30 + (f * 3) % 90, 1); if (f % 8 === 4) Sim.pour(ing('carrot'), 50 + (f * 5) % 70, 1); Sim.step(); }
  Sim.dial = 5; for (let f = 0; f < 900; f++) Sim.step();
  for (let f = 0; f < 700; f++) { Sim.pour(ing('water'), 10 + (f * 7) % 130, 7); Sim.step(); }
  for (let f = 0; f < 80; f++) { if (f % 8 === 0) Sim.pour(ing('tomato'), 40 + f, 1); Sim.pour(ing('salt'), 70, 1); Sim.step(); }
  Sim.dial = 7; for (let f = 0; f < 600; f++) Sim.step();
  Sim.events.length = 0;
  Chef.select(ing('chili'));
  if (location.hash === '#eggs') {
    Sim.throwFish(40); Sim.dropCrackedEgg(100); for (let f = 0; f < 200; f++) Sim.step();
    Sim.throwEgg(120); for (let f = 0; f < 600; f++) Sim.step();
    Chef.select(ing('egg')); Chef.swapT = 0; Chef.cracked = true; input.y = POT_TOP - 4;
  } else if (location.hash !== '#demo') Judging.start();
  if (location.hash === '#speak') { Judging.k = 1; Judging.next('speak'); Judging.typed = 999; }
  if (location.hash === '#verdict') { Judging.k = 3; Judging.next('done'); }
}
Chef.say('Bonjour! Let\'s cook!', 120);
loop();
