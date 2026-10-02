// Procedural pixel art: shaded "semi-3D" kitchen, pot, flames, ingredient + tool icons.
// Everything draws at the internal 320x240 resolution.

const Art = {};

function rgb(c, f = 1, a = 1) {
  const r = Math.max(0, Math.min(255, c[0] * f)) | 0;
  const g = Math.max(0, Math.min(255, c[1] * f)) | 0;
  const b = Math.max(0, Math.min(255, c[2] * f)) | 0;
  return a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function rect(g, x, y, w, h, c) { g.fillStyle = typeof c === 'string' ? c : rgb(c); g.fillRect(x | 0, y | 0, w | 0, h | 0); }

// Pixel ellipse (no anti-aliasing). part: 'all' | 'top' | 'bottom'
function ellipse(g, cx, cy, rx, ry, c, part = 'all') {
  g.fillStyle = typeof c === 'string' ? c : rgb(c);
  for (let dy = -ry; dy <= ry; dy++) {
    if (part === 'top' && dy > 0) break;
    if (part === 'bottom' && dy < 0) continue;
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
    g.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2, 1);
  }
}

// Shaded ball with 3 tone bands, light from the top-left, plus a glint.
function ball(g, cx, cy, r, c, outline = true) {
  if (outline) ellipse(g, cx, cy, r + 1, r + 1, rgb(c, 0.35));
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d2 = x * x + y * y;
    if (d2 > r * r + r * 0.6) continue;
    const l = (-x * 0.55 - y * 0.75) / r + 0.35 - Math.sqrt(d2) / r * 0.35;
    const f = l > 0.45 ? 1.18 : l > -0.1 ? 1 : l > -0.55 ? 0.8 : 0.66;
    g.fillStyle = rgb(c, f);
    g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
  }
  if (r >= 3) { const hs = Math.min(2, Math.max(1, r / 4)); rect(g, cx - r * 0.45, cy - r * 0.5, hs, hs, mix(c, [255, 255, 255], 0.7)); }
}

// Adds a dark 1px outline around all opaque pixels of a small canvas.
function outlineCanvas(cv, col = [40, 24, 30]) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  const img = g.getImageData(0, 0, w, h), d = img.data, src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    if (src[p + 3] > 0) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && src[((yy * w + xx) * 4) + 3] > 0) near = true;
    }
    if (near) { d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
}

function makeCanvas(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  return cv;
}

// ---------------- Ingredient icons (16x16) ----------------

const ICON_DRAW = {
  jug(g, c) {
    rect(g, 3, 4, 9, 11, [210, 230, 245]); rect(g, 3, 4, 2, 11, [240, 250, 255]);
    rect(g, 4, 8, 7, 6, c); rect(g, 4, 8, 2, 6, mix(c, [255, 255, 255], 0.4));
    rect(g, 11, 6, 3, 2, [190, 210, 230]); rect(g, 13, 6, 1, 6, [190, 210, 230]); rect(g, 11, 11, 3, 1, [190, 210, 230]);
    rect(g, 2, 3, 3, 2, [210, 230, 245]);
  },
  bottle(g, c) {
    rect(g, 6, 1, 4, 2, [140, 90, 60]); rect(g, 6, 3, 4, 3, mix(c, [40, 40, 40], 0.2));
    rect(g, 4, 6, 8, 9, c); rect(g, 5, 5, 6, 1, c);
    rect(g, 5, 7, 2, 7, mix(c, [255, 255, 255], 0.45));
    rect(g, 4, 9, 8, 3, [245, 236, 210]); rect(g, 6, 10, 4, 1, [200, 80, 70]);
  },
  carton(g, c) {
    rect(g, 4, 5, 9, 10, [246, 246, 250]); rect(g, 4, 5, 3, 10, [255, 255, 255]);
    rect(g, 5, 2, 7, 3, [220, 226, 236]); rect(g, 7, 1, 3, 1, [200, 206, 220]);
    rect(g, 5, 9, 7, 3, [90, 150, 220]); rect(g, 10, 5, 3, 10, [210, 214, 228]);
  },
  shaker(g, c) {
    rect(g, 5, 2, 6, 3, [190, 196, 210]); rect(g, 6, 2, 1, 1, [80, 80, 90]); rect(g, 9, 2, 1, 1, [80, 80, 90]);
    rect(g, 4, 5, 8, 10, [200, 230, 245]); rect(g, 5, 8, 6, 7, c); rect(g, 5, 5, 2, 10, [245, 252, 255]);
  },
  bag(g, c) {
    rect(g, 3, 4, 10, 11, [214, 186, 140]); rect(g, 3, 4, 3, 11, [236, 210, 166]);
    rect(g, 4, 2, 8, 2, [196, 166, 120]); rect(g, 5, 8, 6, 4, c); rect(g, 10, 4, 3, 11, [184, 154, 110]);
  },
  jar(g, c) {
    rect(g, 4, 2, 8, 3, [180, 60, 50]); rect(g, 4, 2, 2, 3, [220, 100, 80]);
    rect(g, 3, 5, 10, 10, [210, 230, 240]); rect(g, 4, 7, 8, 8, c);
    rect(g, 4, 7, 2, 8, mix(c, [255, 255, 255], 0.35)); rect(g, 5, 9, 6, 3, [245, 236, 210]);
  },
  box(g, c) {
    rect(g, 3, 4, 10, 11, c); rect(g, 3, 4, 3, 11, mix(c, [255, 255, 255], 0.3)); rect(g, 10, 4, 3, 11, rgb(c, 0.8));
    rect(g, 5, 8, 6, 4, [250, 250, 250]); rect(g, 3, 2, 10, 2, rgb(c, 0.9));
  },
  onion(g) { ball(g, 8, 9, 5, [214, 160, 92], false); rect(g, 7, 2, 2, 3, [120, 160, 70]); rect(g, 8, 4, 1, 1, [170, 110, 60]); rect(g, 6, 14, 4, 1, [150, 120, 90]); },
  garlic(g) { ball(g, 6, 9, 3, [246, 240, 226], false); ball(g, 10, 9, 3, [240, 234, 220], false); ball(g, 8, 8, 4, [252, 248, 236], false); rect(g, 8, 3, 1, 2, [210, 200, 170]); },
  carrot(g) {
    for (let y = 0; y < 10; y++) { const w = Math.max(1, 6 - (y * 0.55 | 0)); rect(g, 8 - w / 2 + y * 0.3, 5 + y, w, 1, y < 2 ? [255, 160, 70] : [244, 128, 32]); }
    rect(g, 6, 5, 1, 7, [255, 176, 100]); rect(g, 6, 1, 2, 4, [80, 170, 70]); rect(g, 9, 1, 2, 4, [60, 150, 60]);
  },
  celery(g) {
    rect(g, 5, 4, 3, 11, [150, 210, 90]); rect(g, 8, 3, 3, 12, [130, 196, 80]); rect(g, 5, 4, 1, 11, [200, 240, 150]);
    ball(g, 7, 3, 2, [80, 170, 70], false); ball(g, 11, 2, 2, [70, 160, 60], false);
  },
  tomato(g) { ball(g, 8, 9, 6, [228, 50, 44], false); rect(g, 6, 3, 5, 1, [70, 150, 60]); rect(g, 8, 2, 1, 2, [70, 150, 60]); },
  meat(g) {
    ellipse(g, 8, 9, 6, 5, [206, 84, 96]); ellipse(g, 7, 8, 4, 3, [226, 110, 120]);
    rect(g, 3, 12, 10, 1, [250, 236, 230]); rect(g, 10, 6, 2, 2, [250, 236, 230]); ball(g, 13, 9, 1, [250, 246, 240], false);
  },
  egg(g) { ellipse(g, 8, 9, 5, 6, [250, 246, 236]); ellipse(g, 7, 7, 2, 3, [255, 255, 255]); rect(g, 10, 12, 2, 1, [220, 214, 200]); },
  eggcracked(g) {
    ellipse(g, 5, 10, 4, 4, [250, 246, 236], 'bottom'); ellipse(g, 11, 10, 4, 4, [250, 246, 236], 'bottom');
    for (let k = 0; k < 4; k++) { rect(g, 1 + k * 2, 9 - (k & 1), 2, 1, [250, 246, 236]); rect(g, 8 + k * 2, 9 - (k & 1), 2, 1, [250, 246, 236]); }
    ellipse(g, 8, 6, 2, 2, [255, 190, 40]); rect(g, 8, 8, 1, 3, [255, 200, 70]);
  },
  fish(g) {
    ellipse(g, 7, 8, 6, 4, [150, 172, 196]); ellipse(g, 6, 9, 4, 2, [200, 214, 230]);
    for (let k = 0; k < 4; k++) rect(g, 12 + k, 8 - k, 1, k * 2 + 1, [104, 126, 160]);
    rect(g, 5, 3, 4, 2, [104, 126, 160]); rect(g, 3, 7, 2, 2, [24, 24, 34]); rect(g, 3, 7, 1, 1, [255, 255, 255]);
  },
  extinguisher(g) {
    rect(g, 5, 4, 7, 11, [220, 40, 40]); rect(g, 5, 4, 2, 11, [250, 110, 100]); rect(g, 10, 4, 2, 11, [170, 20, 30]);
    rect(g, 6, 2, 5, 2, [60, 60, 70]); rect(g, 10, 1, 4, 2, [40, 40, 50]); rect(g, 13, 2, 1, 5, [40, 40, 50]);
    rect(g, 6, 8, 5, 3, [250, 250, 250]);
  },
  herb(g) {
    rect(g, 7, 6, 1, 9, [90, 130, 60]);
    ball(g, 5, 6, 3, [70, 170, 70], false); ball(g, 10, 5, 3, [60, 160, 60], false); ball(g, 8, 3, 2, [90, 190, 80], false);
  },
};

Art.icons = {};
Art.icon = function (type, c) {
  const key = type + c.join(',');
  if (!this.icons[key]) {
    const cv = makeCanvas(16, 16);
    ICON_DRAW[type](cv.getContext('2d'), c);
    outlineCanvas(cv);
    this.icons[key] = cv;
  }
  return this.icons[key];
};

// ---------------- Tool icons (16x16) ----------------

const TOOL_DRAW = {
  hand(g) { ball(g, 8, 9, 5, [250, 210, 180], false); rect(g, 3, 4, 2, 6, [250, 210, 180]); rect(g, 6, 2, 2, 5, [250, 210, 180]); rect(g, 9, 2, 2, 5, [250, 210, 180]); rect(g, 12, 4, 2, 5, [240, 196, 166]); },
  ladle(g) { rect(g, 9, 1, 2, 9, [180, 120, 70]); rect(g, 9, 1, 1, 9, [220, 160, 100]); ellipse(g, 7, 12, 5, 3, [190, 196, 210]); ellipse(g, 6, 11, 3, 1, [240, 244, 250]); },
  spoon(g) { rect(g, 7, 7, 2, 8, [200, 206, 220]); ellipse(g, 8, 5, 3, 4, [200, 206, 220]); ellipse(g, 7, 4, 1, 2, [250, 252, 255]); },
  lid(g) { ellipse(g, 8, 10, 7, 3, [170, 178, 196]); ellipse(g, 8, 9, 6, 2, [214, 220, 232]); rect(g, 6, 5, 4, 3, [60, 50, 50]); rect(g, 7, 5, 2, 1, [110, 100, 100]); },
  book(g) { rect(g, 3, 3, 10, 11, [170, 70, 60]); rect(g, 4, 4, 8, 9, [250, 240, 220]); rect(g, 8, 4, 1, 9, [200, 180, 160]); rect(g, 5, 6, 2, 1, [150, 130, 110]); rect(g, 9, 6, 2, 1, [150, 130, 110]); },
  trash(g) { rect(g, 4, 5, 8, 10, [150, 160, 170]); rect(g, 3, 3, 10, 2, [180, 190, 200]); rect(g, 6, 7, 1, 6, [110, 120, 130]); rect(g, 9, 7, 1, 6, [110, 120, 130]); },
};
Art.tools = {};
Art.toolIcon = function (type) {
  if (!this.tools[type]) {
    const cv = makeCanvas(16, 16);
    TOOL_DRAW[type](cv.getContext('2d'));
    outlineCanvas(cv);
    this.tools[type] = cv;
  }
  return this.tools[type];
};

// ---------------- Kitchen background (pre-rendered once) ----------------

Art.buildBackground = function () {
  const cv = makeCanvas(W, H), g = cv.getContext('2d');
  // Back wall: warm tiles.
  rect(g, 0, 0, W, 150, [246, 222, 196]);
  for (let y = 0; y < 150; y += 12) for (let x = (y / 12 % 2) * 6; x < W; x += 12) {
    rect(g, x, y, 11, 11, [252, 232, 208]); rect(g, x, y, 11, 1, [255, 244, 228]);
  }
  for (let y = 0; y < 150; y += 12) rect(g, 0, y + 11, W, 1, [226, 196, 170]);
  // We're looking slightly up: a range hood looms overhead, seen from underneath.
  for (let y = 0; y < 13; y++) {
    const inset = 70 + y * 1.5;
    rect(g, inset, y, W - inset * 2, 1, mix([96, 100, 116], [150, 156, 172], y / 13));
  }
  rect(g, 92, 12, 136, 2, [70, 72, 86]);
  rect(g, 110, 9, 22, 2, [255, 236, 170]); rect(g, 188, 9, 22, 2, [255, 236, 170]);   // hood lights
  // Window with sky, upper right.
  rect(g, 196, 8, 54, 40, [120, 80, 60]); rect(g, 199, 11, 48, 34, [150, 210, 245]);
  ellipse(g, 214, 26, 8, 3, [255, 255, 255]); ellipse(g, 236, 18, 6, 2, [255, 255, 255]);
  rect(g, 222, 11, 2, 34, [120, 80, 60]); rect(g, 199, 27, 48, 2, [120, 80, 60]);
  rect(g, 194, 44, 58, 3, [150, 100, 70]); rect(g, 194, 47, 58, 2, [110, 70, 50]);   // sill, underside showing
  // Hanging utensils rail, upper left.
  rect(g, 66, 16, 100, 3, [150, 156, 170]); rect(g, 66, 18, 100, 1, [110, 116, 130]);
  const hang = (x, h, head) => { rect(g, x, 19, 1, h, [120, 124, 140]); head(x, 19 + h); };
  hang(76, 14, (x, y) => ellipse(g, x, y + 4, 5, 5, [80, 84, 96]));
  hang(92, 18, (x, y) => ellipse(g, x, y + 2, 3, 2, [180, 186, 200]));
  hang(104, 12, (x, y) => { for (let k = -2; k <= 2; k += 2) rect(g, x + k, y, 1, 6, [180, 186, 200]); });
  hang(150, 16, (x, y) => ellipse(g, x, y + 3, 4, 4, [200, 120, 70]));
  // Shadowy back counter line.
  rect(g, 0, 140, W, 10, [200, 170, 150]);
  // Counter/stovetop: from a low angle its top is a thin sliver, so mostly we see the back wall.
  rect(g, 0, 150, W, 50, [214, 186, 164]);
  for (let x = 0; x < W; x += 12) rect(g, x, 150, 1, 50, [200, 172, 150]);
  for (let y = 200; y < 214; y++) {
    const t = (y - 200) / 14, inset = 10 * (1 - t);
    rect(g, inset, y, W - inset * 2, 1, mix([150, 156, 172], [110, 116, 132], t));
  }
  rect(g, 10, 200, W - 20, 1, [190, 196, 210]);
  // Stove front panel.
  rect(g, 0, 214, W, 26, [70, 74, 92]); rect(g, 0, 214, W, 2, [150, 156, 176]);
  for (let x = 6; x < W; x += 40) rect(g, x, 232, 26, 2, [56, 60, 76]);
  // Burner grate, nearly edge-on from this angle.
  ellipse(g, 160, 209, 74, 4, [50, 50, 60]);
  ellipse(g, 160, 209, 66, 3, [36, 36, 44]);
  rect(g, 90, 206, 140, 2, [62, 62, 74]);
  return cv;
};

// ---------------- Pot ----------------

const POT_L = GX - 6, POT_R = GX + GW + 6, POT_TOP = GY - 6, POT_BOT = GY + GH + 6;
const STEEL = [176, 184, 202];

// Interior back wall drawn behind the simulation.
Art.drawPotBack = function (g) {
  for (let x = GX; x < GX + GW; x++) {
    const t = (x - GX) / GW;
    const f = 0.45 + 0.25 * Math.sin(t * Math.PI) - (t > 0.75 ? 0.1 : 0);
    rect(g, x, POT_TOP, 1, GH + 6, rgb(STEEL, f));
  }
  // Faint rings on the back wall.
  for (let y = GY + 20; y < GY + GH; y += 22) rect(g, GX, y, GW, 1, rgb(STEEL, 0.4));
};

// Front walls, rim, and handles drawn over the sim edges.
// Metal color at a temperature: steel → dull red → cherry → orange as it heats past ~150°C.
function hotMetal(c, glow) {
  if (glow <= 0) return c;
  if (glow < 0.5) return mix(c, [150, 40, 30], glow * 2 * 0.8);
  return mix([150, 40, 30], [255, 110, 40], (glow - 0.5) * 2);
}

Art.drawPotFront = function (g, heatGlow) {
  const band = (x0, w) => {
    for (let x = x0; x < x0 + w; x++) {
      const t = (x - POT_L) / (POT_R - POT_L);
      const f = 0.7 + 0.5 * Math.max(0, 1 - Math.abs(t - 0.28) * 4) - (t > 0.8 ? 0.15 : 0);
      // The walls glow from the bottom up, fading with height.
      for (let y = POT_TOP; y < POT_BOT; y += 2) {
        const up = (POT_BOT - y) / (POT_BOT - POT_TOP), glow = heatGlow * Math.max(0, 1 - up * 2.2);
        rect(g, x, y, 1, 2, rgb(hotMetal(STEEL, glow), glow > 0.5 ? 1 : f));
      }
    }
  };
  band(POT_L, 6); band(POT_R - 6, 6);
  // Bottom curve.
  for (let x = POT_L; x < POT_R; x++) {
    const t = (x - POT_L) / (POT_R - POT_L);
    const f = 0.7 + 0.4 * Math.max(0, 1 - Math.abs(t - 0.28) * 3);
    // From below we see the pot's curved underside, in shadow except where the flames light it.
    const dip = Math.round(7 * Math.sqrt(Math.max(0, Math.sin(t * Math.PI))));
    const flick = heatGlow > 0.3 ? (Math.sin(x * 0.7 + Date.now() * 0.004) * 0.05) : 0;
    rect(g, x, GY + GH, 1, 4, rgb(hotMetal(STEEL, Math.min(1, heatGlow + flick)), heatGlow > 0.5 ? 1 : f));
    rect(g, x, GY + GH + 4, 1, 1 + dip, rgb(hotMetal(STEEL, Math.min(1, heatGlow * 1.1 + flick)), heatGlow > 0.5 ? 0.9 : f * 0.62));
  }
  // Rim seen from just below: a rolled lip with its shadowed underside.
  ellipse(g, 160, POT_TOP + 2, (POT_R - POT_L) / 2 + 1, 3, rgb(STEEL, 0.6), 'bottom');
  ellipse(g, 160, POT_TOP + 1, (POT_R - POT_L) / 2 + 1, 2, rgb(STEEL, 1.2), 'bottom');
  rect(g, POT_L - 1, POT_TOP, POT_R - POT_L + 2, 2, rgb(STEEL, 1.25));
  // Handles.
  for (const [hx, dir] of [[POT_L - 9, 1], [POT_R + 1, -1]]) {
    rect(g, hx, GY + 4, 8, 4, [40, 36, 44]); rect(g, hx, GY + 4, 8, 1, [90, 86, 100]);
    rect(g, dir > 0 ? hx : hx + 6, GY + 4, 2, 10, [40, 36, 44]);
  }
};

Art.drawLid = function (g, t) {
  const cy = POT_TOP - 2 + Math.round(Math.sin(t * 0.3) * 0.6);
  ellipse(g, 160, cy, 84, 5, rgb(STEEL, 0.55));
  ellipse(g, 160, cy - 1, 82, 4, rgb(STEEL, 0.95));
  ellipse(g, 140, cy - 2, 40, 2, rgb(STEEL, 1.2));
  rect(g, 152, cy - 11, 16, 6, [50, 44, 50]); rect(g, 152, cy - 11, 16, 2, [100, 94, 104]);
};

// ---------------- Flames ----------------

Art.drawFlames = function (g, dial, t, front) {
  if (dial <= 0.05) return;
  const n = 26;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const sy = Math.sin(a);
    if (front ? sy < 0 : sy >= 0) continue;
    const bx = 160 + Math.cos(a) * 60, by = 208 + sy * 2.5;
    const wob = 0.7 + 0.3 * Math.sin(t * 0.35 + k * 1.7) + 0.15 * Math.sin(t * 0.9 + k);
    const h = Math.max(2, dial * 1.9 * wob);
    for (let y = 0; y < h; y++) {
      const u = y / h;
      const w = Math.max(1, Math.round((1 - u) * 3.4));
      const c = u < 0.35 ? [80, 140, 255] : u < 0.7 ? (dial > 6 ? [140, 200, 255] : [110, 170, 255]) : (dial > 7 ? [255, 200, 90] : [170, 220, 255]);
      const sway = Math.round(Math.sin(t * 0.25 + k + u * 2) * u * 1.5);
      rect(g, bx - w / 2 + sway, by - y, w, 1, c);
    }
  }
};
