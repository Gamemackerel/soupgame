// "The Chop": serve the bowl to three judges who taste from different perspectives and decide your fate.

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const JUDGES = [
  {
    name: 'Sir Pounce', title: 'The Classicist Cat', x: 76,
    fur: [192, 194, 210], dark: [128, 130, 152], belly: [246, 246, 252], theme: [110, 120, 170],
    sounds: { good: ['*purrs*', 'Mrrow.'], bad: ['Hsss!', '*flicks tail*'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [];
      let tech = 0;
      if (a.mirepoix) { tech += 0.3; good.push('A proper mirepoix base. Bon.'); }
      if (a.deglazed) { tech += 0.3; good.push('You deglazed the fond. I can taste it. Très bien.'); }
      if (a.caramelized) { tech += 0.3; good.push('The onions are deeply caramelized. That takes discipline.'); }
      if (a.ribbons > 30) { tech += 0.2; good.push('Delicate egg ribbons. Precise technique.'); }
      if (p.body > 0.25 && p.body < 0.7 && a.flaws.lumps < 0.2) { tech += 0.2; good.push('The texture is velvety. Well done.'); }
      if (a.flaws.burnt > 0.2) bad.push('I taste carbon. A cook must watch the flame.');
      if (a.flaws.curdled > 0.2) bad.push('The dairy has split. Patience, always patience.');
      if (a.flaws.lumps > 0.2) bad.push('Lumps of raw flour. Did no one teach you a roux?');
      if (a.flaws.greasy > 0.3) bad.push('An oil slick on top. Unacceptable.');
      if (a.flaws.raw > 0.4) bad.push('These vegetables are raw. Cook them!');
      if (a.flaws.gritty > 0.3) bad.push('Gritty! The seasoning never dissolved.');
      if (a.flaws.shell > 0.2 && !a.wholeEgg) bad.push('Crunchy eggshell. Disgraceful.');
      if (a.eggPieces > 15 && a.flaws.shell < 0.2) good.push('A perfectly set egg. Very refined.');
      if (a.fish && a.fishCooked > 90 && a.fishCooked < 170) good.push('The fish is just cooked through. Bravo.');
      if (p.salty < 0.22) bad.push('Under-seasoned. Salt is not optional.');
      if (p.salty > 0.82) bad.push('Over-salted. A cardinal sin.');
      if (p.body < 0.08) bad.push('Thin as dishwater.');
      const bal = Taste.score(p);
      if (!good.length && bal > 0.6) good.push('A balanced bowl. Classic.');
      const s = 10 * (0.6 * bal + 0.25 * Math.min(1, tech) + 0.15) - a.flawSum * 12;
      return { score: s, good, bad };
    },
  },
  {
    name: 'Biscuit', title: 'The Flavor Hound', x: 160,
    fur: [238, 184, 110], dark: [170, 104, 58], belly: [253, 238, 210], theme: [220, 120, 60],
    sounds: { good: ['WOOF!', '*tail wags*'], bad: ['*whimper*', 'Grrr.'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [];
      const heatMod = p.heat > 0.15 && p.heat < 0.85 ? 1 : p.heat >= 0.85 ? 0.6 : p.heat / 0.15 * 0.5;
      const acid = p.sour > 0.1 && p.sour < 0.6 ? 1 : p.sour >= 0.6 ? 0.4 : 0.2;
      const complexity = Math.min(1, a.notes.length / 4);
      if (p.heat > 0.55) good.push('Now THAT has fire! I love it.');
      else if (p.heat < 0.1) bad.push('Where is the heat? Give me a chili!');
      if (p.umami > 0.6) good.push('Deep and savory. It punches!');
      else if (p.umami < 0.3) bad.push('It whispers. I want it to SING.');
      if (p.sour < 0.08) bad.push('No acid, no life. Squeeze something sour in!');
      else if (acid === 1) good.push('That acidity brightens everything.');
      if (p.aroma > 0.6) good.push('The aroma hit me from across the room.');
      if (a.notes.length >= 3) good.push('Layers! I taste ' + a.notes.slice(0, 3).join(', ') + '.');
      if (p.bitter > 0.35) bad.push('Bitter, and not the good kind.');
      if (a.fish) good.push(a.fishCooked > 60 ? 'FISH! I can taste the ocean!' : 'Is this fish... alive?');
      const s = 10 * (0.3 * p.umami + 0.2 * Math.min(1, p.aroma * 1.4) + 0.15 * acid + 0.15 * heatMod +
                      0.2 * complexity) - p.bitter * 4 - a.flawSum * 4 + 1;
      return { score: s, good, bad };
    },
  },
  {
    name: 'Nanny Mae', title: 'The Comfort Goat', x: 244,
    fur: [248, 244, 236], dark: [208, 186, 154], belly: [255, 255, 255], theme: [200, 120, 170],
    sounds: { good: ['Baa~!', '*happy bleat*'], bad: ['Baaah...', '*chews thoughtfully*'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [];
      const warm = a.temp > 60 ? 1 : a.temp > 40 ? 0.5 : 0;
      if (!warm) bad.push('Oh dear, it\'s gone stone cold.');
      else if (a.temp > 70) good.push('Nice and piping hot, just right.');
      if (p.rich > 0.35) good.push('Rich and cozy, like a hug.');
      if (a.chunkiness > 0.25) good.push('Lovely hearty bits in here.');
      else if (a.chunkiness < 0.05) bad.push('A bit thin for me. Where\'s the good stuff?');
      if (p.heat > 0.5) bad.push('Oh my! Too spicy for this old tongue.');
      if (p.sour > 0.5) bad.push('Goodness, that\'s sour!');
      if (p.salty > 0.75) bad.push('My blood pressure, dear!');
      if (p.sweet > 0.15 && p.sweet < 0.55) good.push('A gentle sweetness, just how I make it.');
      if (a.ribbons > 30) good.push('Egg ribbons! My mother used to make those.');
      if (a.wholeEgg) (a.eggPieces > 10 ? good : bad).push(a.eggPieces > 10 ? 'A whole boiled egg, shell and all! How... rustic.' : 'There is a raw egg in here. Still in its shell.');
      const gentle = 1 - Math.max(0, p.heat - 0.35) * 2 - Math.max(0, p.sour - 0.35) * 2;
      const s = 10 * (0.25 * warm + 0.25 * Math.min(1, p.rich * 1.8) + 0.2 * Math.min(1, a.chunkiness * 3) +
                      0.15 * Math.max(0, gentle) + 0.15 * Taste.score(p)) - a.flawSum * 6;
      return { score: s, good, bad };
    },
  },
];

const Judging = {
  active: false, t: 0, phase: 'walk', k: 0, results: [], verdict: null, analysis: null, typed: 0,

  start() {
    this.analysis = Taste.analyzeBowl();
    const a = this.analysis;
    this.results = JUDGES.map((j) => {
      if (a.empty) return { score: 1, line: pick(['...Where is the soup?', 'You served me an empty bowl.', 'Is this a joke?']) };
      const r = j.evaluate(a);
      const score = Math.max(1, Math.min(10, Math.round(r.score)));
      // Lead with praise or criticism depending on how it went.
      const lines = score >= 6 ? [pick(r.good.length ? r.good : ['Not bad.']), r.bad[0]]
                               : [pick(r.bad.length ? r.bad : ['Something is missing.']), r.good[0]];
      const sound = pick(score >= 6 ? j.sounds.good : j.sounds.bad);
      return { score, line: sound + ' ' + lines.filter(Boolean).join(' ') };
    });
    const avg = this.results.reduce((s, r) => s + r.score, 0) / 3;
    this.avg = avg;
    this.verdict = avg >= 7.5 ? 'WINNER' : avg >= 5 ? 'SAFE' : 'CHOPPED';
    this.active = true; this.t = 0; this.phase = 'walk'; this.k = 0; this.typed = 0;
  },

  update() {
    if (!this.active) return;
    this.t++;
    if (this.phase === 'walk' && this.t > 70) this.next('taste');
    else if (this.phase === 'taste' && this.t > 45) this.next('speak');
    else if (this.phase === 'speak') this.typed = Math.min(this.results[this.k].line.length, this.typed + 0.8);
    else if (this.phase === 'deliberate' && this.t > 90) this.next('verdict');
  },

  next(phase) { this.phase = phase; this.t = 0; this.typed = 0; },

  click() {
    if (this.phase === 'speak') {
      const line = this.results[this.k].line;
      if (this.typed < line.length) { this.typed = line.length; return; }
      if (++this.k < 3) this.next('taste'); else this.next('deliberate');
    } else if (this.phase === 'verdict' && this.t > 60) {
      this.next('done');
    }
  },

  // Buttons on the 'done' screen.
  buttons() {
    return [{ id: 'keep', label: 'KEEP COOKING', x: 70, y: 196, w: 84, h: 18 },
            { id: 'new', label: 'NEW POT', x: 166, y: 196, w: 84, h: 18 }];
  },

  draw(g) {
    // Studio backdrop.
    rect(g, 0, 0, W, H, [44, 30, 46]);
    for (let x = 0; x < W; x += 16) rect(g, x, 0, 8, 120, [52, 36, 54]);
    for (let k = 0; k < 3; k++) {
      // Spotlights.
      g.fillStyle = 'rgba(255,240,200,0.07)';
      g.beginPath(); g.moveTo(JUDGES[k].x - 6, 0); g.lineTo(JUDGES[k].x + 6, 0);
      g.lineTo(JUDGES[k].x + 40, 150); g.lineTo(JUDGES[k].x - 40, 150); g.fill();
    }
    // Judges.
    JUDGES.forEach((j, n) => drawJudge(g, j, n, this));
    // Table in perspective.
    for (let y = 118; y < 160; y++) {
      const t = (y - 118) / 42, inset = 24 * (1 - t);
      rect(g, inset, y, W - inset * 2, 1, mix([250, 246, 240], [226, 218, 210], t));
    }
    rect(g, 0, 160, W, 30, [190, 40, 50]); rect(g, 0, 160, W, 2, [230, 80, 80]);
    for (let x = 4; x < W; x += 12) rect(g, x, 162, 2, 28, [170, 30, 44]);
    rect(g, 0, 190, W, 50, [36, 24, 36]);
    JUDGES.forEach((j, n) => drawPaws(g, j, n, this));

    // Bowl: carried in, then slides in front of each judge.
    const a = this.analysis;
    let bx = 160, bob = 0;
    if (this.phase === 'walk') bx = -30 + Math.min(1, this.t / 60) * 190;
    else if (this.phase === 'taste' || this.phase === 'speak') bx = JUDGES[this.k].x;
    if (this.phase === 'walk') bob = Math.round(Math.abs(Math.sin(this.t * 0.3)) * -2);
    drawBowl(g, bx, 140 + bob, a);

    // Score cards for judges who have spoken.
    for (let n = 0; n < 3; n++) {
      const shown = n < this.k || (n === this.k && this.phase === 'speak' && this.typed >= this.results[n].line.length) ||
                    ['deliberate', 'verdict', 'done'].includes(this.phase);
      if (!shown) continue;
      const x = JUDGES[n].x;
      rect(g, x + 29, 112, 2, 8, [150, 110, 80]);
      rect(g, x + 19, 95, 22, 18, [40, 24, 30]); rect(g, x + 20, 96, 20, 16, [255, 252, 240]);
    }
    // Dialogue box.
    if (this.phase === 'speak') {
      rect(g, 8, 172, W - 16, 62, [30, 20, 30]); rect(g, 9, 173, W - 18, 60, [252, 246, 232]);
      rect(g, 9, 173, W - 18, 12, JUDGES[this.k].theme);
    }
    // Verdict.
    if (this.phase === 'verdict' || this.phase === 'done') drawVerdict(g, this);
    if (this.phase === 'done') {
      for (const b of this.buttons()) { rect(g, b.x, b.y, b.w, b.h, [40, 24, 30]); rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, [250, 210, 90]); rect(g, b.x + 1, b.y + 1, b.w - 2, 2, [255, 240, 170]); }
    }
  },

  drawText(T) {
    for (let n = 0; n < 3; n++) {
      T.text(JUDGES[n].name, JUDGES[n].x, 4, { size: 6, color: '#ffe9c0', align: 'center' });
      const shown = n < this.k || (n === this.k && this.phase === 'speak' && this.typed >= this.results[n].line.length) ||
                    ['deliberate', 'verdict', 'done'].includes(this.phase);
      if (shown) T.text(String(this.results[n].score), JUDGES[n].x + 30, 98, { size: 10, color: '#2a1820', align: 'center' });
    }
    if (this.phase === 'walk') T.text('Serving the judges...', 160, 205, { size: 8, color: '#ffe9c0', align: 'center' });
    if (this.phase === 'speak') {
      const j = JUDGES[this.k];
      T.text(j.name.toUpperCase() + ' - ' + j.title, 14, 175, { size: 6, color: '#fff' });
      T.wrap(this.results[this.k].line.slice(0, this.typed | 0), 14, 190, W - 28, { size: 7, color: '#2a1820' });
      if (this.typed >= this.results[this.k].line.length && (this.t >> 4) & 1) T.text('click >', W - 14, 224, { size: 6, color: '#8a6a70', align: 'right' });
    }
    if (this.phase === 'deliberate') T.text('The judges are deliberating...', 160, 205, { size: 8, color: '#ffe9c0', align: 'center' });
    if (this.phase === 'verdict' || this.phase === 'done') {
      const v = this.verdict;
      const label = v === 'CHOPPED' ? 'CHOPPED!' : v === 'SAFE' ? 'SAFE... THIS ROUND' : 'WINNER!';
      const col = v === 'CHOPPED' ? '#ff5050' : v === 'SAFE' ? '#ffd860' : '#7dff8a';
      if (this.t > 20 || this.phase === 'done') {
        T.text(label, 160, 166, { size: v === 'SAFE' ? 12 : 18, color: col, align: 'center', shadow: true });
        T.text('Average ' + this.avg.toFixed(1) + ' / 10', 160, 184, { size: 7, color: '#ffe9c0', align: 'center' });
      }
    }
    if (this.phase === 'done') for (const b of this.buttons()) T.text(b.label, b.x + b.w / 2, b.y + 6, { size: 6, color: '#3a2020', align: 'center' });
  },
};

function drawBowl(g, x, y, a) {
  ellipse(g, x, y + 9, 20, 4, [200, 190, 182]);
  ellipse(g, x, y, 19, 11, [30, 40, 70], 'bottom');
  ellipse(g, x, y, 18, 10, [70, 110, 190], 'bottom');
  rect(g, x - 12, y + 3, 6, 2, [120, 160, 230]);
  ellipse(g, x, y, 18, 4, [50, 80, 150]);
  // Soup surface tinted by its contents.
  const p = a ? a.p : null;
  let c = [140, 190, 230];
  if (p && !a.empty) {
    c = mix(c, [230, 180, 70], Math.min(1, p.rich));
    c = mix(c, [130, 70, 30], Math.min(0.8, p.umami * 0.6));
    c = mix(c, [200, 60, 40], Math.min(0.7, p.sour * 0.3 + p.heat * 0.3));
    c = mix(c, [246, 240, 226], Math.min(0.7, p.body * 0.5));
  }
  if (!a || !a.empty) { ellipse(g, x, y, 16, 3, c); rect(g, x - 6, y - 1, 4, 1, mix(c, [255, 255, 255], 0.5)); }
  // Steam.
  if (a && a.temp > 55) for (let k = 0; k < 3; k++) {
    const sy = y - 6 - ((Judging.t + k * 9) % 18);
    rect(g, x - 6 + k * 6 + Math.round(Math.sin((Judging.t + k * 20) * 0.15) * 2), sy, 1, 3, 'rgba(255,255,255,0.6)');
  }
}

const INK = [46, 30, 40], PINK = [255, 160, 176];

// Pixel triangle pointing up (for cat ears).
function tri(g, cx, baseY, w, h, c) {
  for (let k = 0; k < h; k++) {
    const hw = Math.max(0.5, (w / 2) * (k + 1) / h);
    rect(g, Math.round(cx - hw), baseY - h + k, Math.round(hw * 2), 1, c);
  }
}

function judgeState(J, n) {
  const active = (J.phase === 'taste' || J.phase === 'speak') && J.k === n;
  const r = J.results[n];
  const reacted = n < J.k || (active && J.phase === 'speak') || ['deliberate', 'verdict', 'done'].includes(J.phase);
  const mood = !reacted ? 'neutral' : r.score >= 7 ? 'happy' : r.score >= 5 ? 'meh' : 'upset';
  return { active, mood, tasting: active && J.phase === 'taste', ft: Chef.t + n * 37 };
}

// Generic eye: dark oval, optional iris, sparkles, and an eyelid that covers the top `lid` fraction.
function eye(g, ex, ey, rx, ry, o = {}) {
  ellipse(g, ex, ey, rx, ry, INK);
  if (o.iris) { ellipse(g, ex + (o.look || 0), ey, rx - 1, ry - 1, o.iris); rect(g, ex + (o.look || 0), ey - ry + 1, 1, ry * 2 - 1, INK); }
  else if (o.look) rect(g, ex + o.look, ey, 1, 1, [80, 60, 80]);
  if (o.shine !== false) {
    rect(g, ex - rx + 1 + (o.look || 0), ey - ry + 1, o.big ? 3 : 2, o.big ? 3 : 2, [255, 255, 255]);
    rect(g, ex + rx - 2, ey + ry - 2, 1, 1, [255, 255, 255]);
  }
  if (o.lid) {
    const h = Math.round((ry * 2 + 1) * o.lid);
    rect(g, ex - rx - 1, ey - ry - 1, rx * 2 + 3, h + 1, o.fur);
    rect(g, ex - rx, ey - ry - 1 + h, rx * 2 + 1, 1, INK);
  }
}
function arcEye(g, ex, ey, w, up) { // ^ (up) or ‿ (down) closed eye
  const s = up ? -1 : 1;
  rect(g, ex - w, ey, 1, 1, INK); rect(g, ex - w + 1, ey + s, 1, 1, INK);
  rect(g, ex - w + 2, ey + 2 * s, w * 2 - 3, 1, INK);
  rect(g, ex + w - 1, ey + s, 1, 1, INK); rect(g, ex + w, ey, 1, 1, INK);
}
function heart(g, x, y, c) {
  rect(g, x, y, 2, 1, c); rect(g, x + 3, y, 2, 1, c); rect(g, x - 1, y + 1, 7, 2, c);
  rect(g, x, y + 3, 5, 1, c); rect(g, x + 1, y + 4, 3, 1, c); rect(g, x + 2, y + 5, 1, 1, c);
}

// ---- Sir Pounce: snooty cat. Tall and upright, nose in the air, smug half-lidded eyes, paw raised daintily.
function drawCat(g, j, J, s) {
  const x = j.x, { mood, ft } = s;
  const hx = x - 2, hy = 54 + (s.active ? Math.round(Math.sin(J.t * 0.15)) : 0);
  const sway = Math.sin(ft * 0.04);
  // Tail: tall S-curve with a curled tip.
  for (let k = 0; k <= 40; k++) {
    const a = k / 40, tx = Math.round(x + 16 + a * 8 + Math.sin(a * 5 + ft * 0.05) * 3 * a), ty = 112 - k;
    rect(g, tx - 3, ty, 7, 1, rgb(j.fur, 0.35));
    rect(g, tx - 2, ty, 5, 1, k > 32 || (k > 8 && k % 9 < 2) ? j.dark : j.fur);
    rect(g, tx - 2, ty, 1, 1, mix(j.fur, [255, 255, 255], 0.3));
  }
  rect(g, Math.round(x + 24 + Math.sin(5 + ft * 0.05) * 3) - 2, 71, 5, 1, rgb(j.fur, 0.35));
  // Slim upright body.
  ellipse(g, x, 98, 15, 24, rgb(j.fur, 0.35));
  ellipse(g, x, 98, 14, 23, j.fur);
  ellipse(g, x, 102, 8, 15, j.belly);
  // Ears (flattened back when upset).
  const flat = mood === 'upset';
  for (const sd of [-1, 1]) {
    const ex = hx + sd * (flat ? 16 : 11), eb = hy - (flat ? 6 : 10) - (sd < 0 ? 1 : 0);
    tri(g, ex, eb + 1, flat ? 14 : 14, flat ? 7 : 14, rgb(j.fur, 0.35));
    tri(g, ex, eb, flat ? 11 : 11, flat ? 6 : 12, j.fur);
    tri(g, ex, eb - 1, 5, flat ? 3 : 7, PINK);
  }
  // Head, slightly squashed and held high.
  ellipse(g, hx, hy, 19, 17, rgb(j.fur, 0.35));
  ellipse(g, hx, hy, 18, 16, j.fur);
  rect(g, hx - 10, hy - 11, 4, 3, mix(j.fur, [255, 255, 255], 0.4));
  for (let k = -1; k <= 1; k++) rect(g, hx + k * 4, hy - 16 + Math.abs(k), 2, 5 - Math.abs(k), j.dark);
  // Cheek fluff.
  for (const sd of [-1, 1]) { rect(g, hx + sd * 18 - (sd < 0 ? 2 : 0), hy + 3, 3, 2, j.fur); rect(g, hx + sd * 17 - (sd < 0 ? 1 : 0), hy + 6, 2, 2, j.fur); }
  // Eyes.
  const ey = hy - 1;
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 8;
    if (mood === 'happy') arcEye(g, ex, ey + 1, 3, false);                         // content, purring
    else if (mood === 'upset') { eye(g, ex, ey, 3, 3, { iris: [200, 220, 80], lid: 0.5, fur: j.fur });
      rect(g, ex - 3, ey - 5 + (sd > 0 ? 0 : 0), 7, 1, INK); rect(g, ex + (sd < 0 ? 2 : -3), ey - 6, 2, 1, INK); } // glare
    else eye(g, ex, ey, 3, 3, { iris: [130, 190, 90], lid: mood === 'meh' ? 0.6 : 0.45, fur: j.fur, look: 1 }); // smug side-eye
  }
  // Muzzle, nose pointed upward, whiskers.
  ellipse(g, hx - 2, hy + 7, 3, 2, j.belly); ellipse(g, hx + 2, hy + 7, 3, 2, j.belly);
  tri(g, hx, hy + 5, 4, 2, PINK);
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) rect(g, sd < 0 ? hx - 25 : hx + 15, hy + 4 + k * 2 - (k === 0 ? sd : 0), 10, 1, [110, 110, 130]);
  const my = hy + 8;
  if (s.tasting) { ellipse(g, hx, my + 1, 1, 1, [170, 60, 80]); rect(g, hx + 2, my - 6, 1, 8, [200, 206, 220]); }
  else if (mood === 'upset') { ellipse(g, hx, my + 1, 3, 2, [140, 40, 60]); rect(g, hx - 2, my, 1, 2, [255, 255, 255]); rect(g, hx + 2, my, 1, 2, [255, 255, 255]); } // hiss with fangs
  else if (mood === 'happy') { rect(g, hx - 2, my, 1, 1, INK); rect(g, hx - 1, my + 1, 1, 1, INK); rect(g, hx, my, 1, 1, INK); rect(g, hx + 1, my + 1, 1, 1, INK); rect(g, hx + 2, my, 1, 1, INK); }
  else { rect(g, hx - 1, my, 1, 1, INK); rect(g, hx, my + 1, 1, 1, INK); rect(g, hx + 1, my, 2, 1, INK); } // smirk
  ellipse(g, hx - 12, hy + 5, 2, 1, [255, 190, 200]); ellipse(g, hx + 12, hy + 5, 2, 1, [255, 190, 200]);
  // Dainty raised paw near the chin.
  const pawY = hy + 20 + (mood === 'happy' ? Math.round(Math.sin(ft * 0.2)) : 0);
  ellipse(g, x + 9, pawY + 6, 3, 7, j.fur);
  ball(g, x + 9, pawY, 4, j.fur);
  rect(g, x + 8, pawY - 4, 1, 2, rgb(j.fur, 0.6));
  // Emotes.
  if (mood === 'happy') { const ny = hy - 26 - ((ft >> 2) % 6); rect(g, hx + 18, ny, 1, 5, INK); rect(g, hx + 16, ny + 4, 3, 2, INK); rect(g, hx + 19, ny, 2, 1, INK); }
  if (mood === 'upset') { const vx = hx + 14, vy = hy - 14; rect(g, vx, vy, 1, 3, [230, 50, 60]); rect(g, vx + 3, vy, 1, 3, [230, 50, 60]); rect(g, vx - 1, vy + 1, 6, 1, [230, 50, 60]); }
}

// ---- Biscuit: excitable pup. Leans forward, head tilted, panting with tongue out.
function drawDog(g, j, J, s) {
  const x = j.x, { mood, ft } = s;
  const bounce = mood === 'happy' ? -Math.abs(Math.round(Math.sin(ft * 0.25) * 4)) : Math.round(Math.sin(ft * 0.12));
  const tilt = mood === 'meh' ? 3 : mood === 'upset' ? 0 : 2;
  const hx = x, hy = 66 + bounce;
  // Wagging tail.
  const wag = Math.sin(ft * (mood === 'happy' ? 0.6 : mood === 'upset' ? 0.05 : 0.25)) * (mood === 'upset' ? 0.1 : 0.8);
  for (let k = 0; k < 8; k++) ball(g, x + 20 + Math.sin(wag) * k * 2, 100 - Math.cos(wag) * k * 2 + (mood === 'upset' ? k * 2 : 0), k > 5 ? 4 : 3, j.fur, k === 0);
  // Wide, low body leaning in.
  ellipse(g, x, 104 + bounce / 2, 25, 18, rgb(j.fur, 0.35));
  ellipse(g, x, 104 + bounce / 2, 24, 17, j.fur);
  ellipse(g, x, 110 + bounce / 2, 13, 10, j.belly);
  // Big round head.
  ball(g, hx, hy, 21, j.fur);
  ball(g, hx - 1, hy - 20, 3, j.dark, false);
  ellipse(g, hx - 8 - tilt, hy, 7, 7, j.dark);                          // eye patch
  // Ears: left floppy, right flipped up inside-out (unless sad: both droop).
  const ear = (sd) => {
    const flap = mood === 'happy' ? Math.round(Math.sin(ft * 0.5 + sd)) * 2 : 0;
    const droop = mood === 'upset' ? 4 : 0;
    ellipse(g, hx + sd * 20, hy + 4 + droop + flap, 7, 14, rgb(j.dark, 0.45));
    ellipse(g, hx + sd * 20, hy + 4 + droop + flap, 6, 13, j.dark);
    ellipse(g, hx + sd * 19, hy + droop + flap, 2, 6, rgb(j.dark, 1.2));
  };
  ear(-1); ear(1);
  // Muzzle + nose.
  ellipse(g, hx + tilt, hy + 9, 11, 7, j.belly);
  ellipse(g, hx + tilt, hy + 5, 4, 3, INK); rect(g, hx + tilt - 2, hy + 3, 2, 1, [160, 160, 180]);
  // Eyes: huge and round, one slightly higher for the head tilt.
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 9 + (sd < 0 ? -tilt : 0), ey = hy - 1 + (sd > 0 ? -tilt / 2 : tilt / 2);
    if (mood === 'happy') arcEye(g, ex, ey + 1, 4, true);
    else {
      eye(g, ex, ey, 4, 5, { big: true });
      if (mood === 'upset') { rect(g, ex - 3, ey - 1, 2, 2, [255, 255, 255]); rect(g, ex + (sd < 0 ? 1 : -4), ey - 8 + (sd < 0 ? 1 : 0), 4, 1, INK); } // puppy eyes
      else rect(g, ex - 2, ey - 8 - (mood === 'meh' && sd > 0 ? 2 : 0), 3, 1, INK);                                   // eyebrow dots
    }
  }
  // Mouth: panting, tongue out.
  const my = hy + 10;
  if (s.tasting) { ellipse(g, hx + tilt, my + 1, 2, 2, [170, 60, 80]); rect(g, hx + tilt + 3, my - 8, 2, 10, [200, 206, 220]); }
  else if (mood === 'upset') { rect(g, hx + tilt - 2, my + 1, 1, 1, INK); rect(g, hx + tilt - 1, my, 3, 1, INK); rect(g, hx + tilt + 2, my + 1, 1, 1, INK); }
  else {
    ellipse(g, hx + tilt, my + 1, 4, 3, [150, 50, 70], 'bottom');
    const tl = mood === 'happy' ? 6 + Math.round(Math.sin(ft * 0.5) * 1.5) : 4 + ((ft >> 3) & 1);
    rect(g, hx + tilt - 2, my + 2, 5, tl, [255, 120, 140]); rect(g, hx + tilt, my + 3, 1, tl - 2, [230, 90, 110]);
  }
  ellipse(g, hx - 15, hy + 7, 3, 1, [255, 150, 160]); ellipse(g, hx + 15, hy + 7, 3, 1, [255, 150, 160]);
  // Emotes.
  if (mood === 'happy') for (let k = 0; k < 3; k++) { const sx = hx - 24 + k * 22, sy = hy - 24 - ((ft + k * 7) % 10); rect(g, sx, sy - 1, 1, 3, [255, 230, 90]); rect(g, sx - 1, sy, 3, 1, [255, 230, 90]); }
  if (mood === 'meh') { const qx = hx + 22, qy = hy - 26; rect(g, qx, qy, 4, 1, INK); rect(g, qx + 4, qy + 1, 1, 2, INK); rect(g, qx + 2, qy + 3, 2, 1, INK); rect(g, qx + 2, qy + 4, 1, 1, INK); rect(g, qx + 2, qy + 6, 1, 1, INK); }
  if (mood === 'upset') { const dy = hy - 10 + ((ft >> 2) % 8); rect(g, hx + 19, dy, 2, 3, [140, 200, 255]); }
}

// ---- Nanny Mae: cozy old goat. Squat and round, sleepy smile, glasses on her snout, always chewing, holding tea.
function drawGoat(g, j, J, s) {
  const x = j.x, { mood, ft } = s;
  const hx = x, hy = 72 + (s.active ? Math.round(Math.sin(J.t * 0.12)) : 0);
  const chew = ((ft >> 4) & 1) ? 1 : -1;
  // Squat, round body.
  ellipse(g, x, 106, 27, 17, rgb(j.fur, 0.4));
  ellipse(g, x, 106, 26, 16, j.fur);
  ellipse(g, x, 110, 15, 10, j.belly);
  for (let k = 0; k < 5; k++) ball(g, x - 20 + k * 10, 92 + (k & 1), 4, j.fur, false);    // woolly shoulders
  ball(g, x + 25, 104, 4, j.fur);                                                           // tail puff
  // Horns + droopy ears.
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 6; k++) ball(g, hx + sd * (6 + k * 1.2), hy - 15 - k + (k > 3 ? k - 3 : 0), 2, j.dark, k === 0);
    const droop = mood === 'upset' ? 2 : 6;
    for (let k = 0; k < 9; k++) ellipse(g, hx + sd * (16 + k), hy - 2 + k * droop / 8, 3, 2, j.fur);
    ellipse(g, hx + sd * 21, hy + 1, 3, 1, PINK);
  }
  // Head: soft and wide.
  ellipse(g, hx, hy, 18, 16, rgb(j.fur, 0.4));
  ellipse(g, hx, hy, 17, 15, j.fur);
  for (let k = -1; k <= 1; k++) ball(g, hx + k * 5, hy - 15 + Math.abs(k) * 2, 3, j.fur, false);   // fluffy fringe
  // Flower.
  for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) ball(g, hx + 12 + dx, hy - 13 + dy, 1, PINK, false);
  rect(g, hx + 12, hy - 13, 1, 1, [255, 220, 80]);
  // Eyes: sleepy and kind.
  const ey = hy - 1;
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 7;
    if (mood === 'happy') arcEye(g, ex, ey, 3, true);
    else if (mood === 'upset') { eye(g, ex, ey, 2, 2, { shine: false }); rect(g, ex - 3, ey - 4 + (sd < 0 ? 0 : 0), 3, 1, INK); rect(g, ex, ey - 5 + (sd < 0 ? 1 : -0), 3, 1, INK); }
    else if (mood === 'meh') { eye(g, ex, ey, 2, 3, { lid: 0.5, fur: j.fur }); if (sd > 0) rect(g, ex - 2, ey - 6, 5, 1, INK); }
    else arcEye(g, ex, ey + 1, 3, false);                                   // gentle closed "‿" eyes
  }
  // Snout (chews side to side), glasses perched on it.
  const sx = hx + (s.tasting ? 0 : chew);
  ellipse(g, sx, hy + 9, 9, 6, [252, 228, 226]);
  rect(g, sx - 3, hy + 7, 2, 1, [200, 140, 140]); rect(g, sx + 2, hy + 7, 2, 1, [200, 140, 140]);
  for (const sd of [-1, 1]) { ellipse(g, hx + sd * 7, ey + 4, 4, 3, [120, 90, 160]); ellipse(g, hx + sd * 7, ey + 4, 3, 2, [236, 236, 250]); }
  rect(g, hx - 3, ey + 3, 6, 1, [120, 90, 160]);
  // Goat mouth: a split upper lip (philtrum) over a soft lower lip.
  const my = hy + 11, lip = [170, 110, 120];
  rect(g, sx, hy + 9, 1, 2, lip);
  if (s.tasting) { ellipse(g, sx, my + 1, 2, 1, [170, 60, 80]); }
  else if (mood === 'happy') {
    rect(g, sx - 4, my - 1, 1, 1, lip); rect(g, sx - 3, my, 3, 1, lip); rect(g, sx + 1, my, 3, 1, lip); rect(g, sx + 4, my - 1, 1, 1, lip);
    rect(g, sx - 2, my + 1, 5, 1, [200, 90, 110]); rect(g, sx - 1, my + 2, 3, 1, [200, 90, 110]);
  } else if (mood === 'upset') {
    rect(g, sx - 3, my + 1, 3, 1, lip); rect(g, sx + 1, my + 1, 3, 1, lip); rect(g, sx - 4, my + 2, 1, 1, lip); rect(g, sx + 4, my + 2, 1, 1, lip);
  } else {
    rect(g, sx - 1, my, 1, 1, lip); rect(g, sx - 3, my + 1, 2, 1, lip); rect(g, sx + 1, my, 1, 1, lip); rect(g, sx + 2, my + 1, 2, 1, lip);
    rect(g, sx - 1, my + 2, 3, 1, rgb(lip, 1.15));
  }
  // Beard.
  for (let k = 0; k < 6; k++) rect(g, sx - 3 + k / 2, hy + 15 + k, 7 - k, 1, k === 5 ? j.dark : j.belly);
  ellipse(g, hx - 13, hy + 5, 3, 1, [255, 180, 190]); ellipse(g, hx + 13, hy + 5, 3, 1, [255, 180, 190]);
  // Emotes.
  if (mood === 'happy') for (let k = 0; k < 2; k++) heart(g, hx - 22 + k * 40, hy - 22 - ((ft + k * 15) % 14), [255, 110, 140]);
  if (mood === 'upset') { const py = hy - 20 - ((ft >> 2) % 5); ellipse(g, hx + 20, py, 3, 2, [220, 224, 236]); ellipse(g, hx + 24, py - 2, 2, 1, [220, 224, 236]); }
}

function drawJudge(g, j, n, J) {
  const s = judgeState(J, n);
  [drawCat, drawDog, drawGoat][n](g, j, J, s);
}

// Front layer resting on the table: paws / teacup.
function drawPaws(g, j, n, J) {
  const x = j.x, s = judgeState(J, n);
  const paw = (px, py, c, big) => {
    ellipse(g, px, py, big ? 6 : 4, 3, rgb(c, 0.4));
    ellipse(g, px, py - 1, big ? 5 : 3, 3, c);
    rect(g, px - 1, py + 1, 1, 2, rgb(c, 0.6)); rect(g, px + 1, py + 1, 1, 2, rgb(c, 0.6));
  };
  if (n === 0) paw(x - 6, 120, j.fur, false);                         // one neat paw down
  if (n === 1) { const b = s.mood === 'happy' ? Math.round(Math.abs(Math.sin(s.ft * 0.25)) * -2) : 0; paw(x - 19, 121 + b, j.fur, true); paw(x + 19, 121 - b, j.fur, true); }
  if (n === 2) {
    // Teacup held in both hooves.
    ellipse(g, x, 121, 7, 4, [60, 40, 50]); ellipse(g, x, 120, 6, 4, [250, 246, 240]);
    ellipse(g, x, 117, 6, 2, [180, 110, 70]); rect(g, x + 6, 118, 3, 3, [250, 246, 240]); rect(g, x + 7, 119, 1, 1, [60, 40, 50]);
    for (let k = 0; k < 2; k++) rect(g, x - 2 + k * 4 + Math.round(Math.sin((s.ft + k * 20) * 0.12)), 108 - ((s.ft + k * 9) % 8), 1, 3, 'rgba(255,255,255,0.7)');
    for (const sd of [-1, 1]) { ellipse(g, x + sd * 10, 121, 4, 3, j.fur); rect(g, x + sd * 10 - 3, 122, 7, 2, j.dark); }
  }
}

function drawVerdict(g, J) {
  const v = J.verdict, t = J.phase === 'done' ? 999 : J.t;
  if (v === 'CHOPPED') {
    // Cleaver slams down onto a board.
    rect(g, 110, 150, 100, 10, [170, 110, 60]); rect(g, 110, 150, 100, 2, [210, 150, 90]);
    const drop = Math.min(1, t / 14), cy = -40 + drop * 160;
    rect(g, 140, cy - 30, 40, 28, [200, 206, 220]); rect(g, 140, cy - 30, 40, 3, [240, 244, 250]);
    rect(g, 174, cy - 26, 4, 4, [60, 60, 70]);
    rect(g, 176, cy - 44, 8, 16, [80, 50, 30]);
    if (t > 14 && t < 22) for (let k = 0; k < 8; k++) rect(g, 110 + k * 13, 146 - (t - 14) * 2, 2, 2, [255, 255, 255]);
  } else if (v === 'WINNER') {
    for (let k = 0; k < 40; k++) {
      const x = (k * 53 + J.t * (1 + k % 3)) % W, y = ((k * 37 + J.t * 2) % 260) - 20;
      rect(g, x, y, 2, 3, [[255, 90, 90], [90, 200, 255], [255, 220, 80], [120, 240, 120]][k % 4]);
    }
  }
}
