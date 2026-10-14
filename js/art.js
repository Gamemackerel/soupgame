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
  grinder(g) {
    rect(g, 6, 2, 4, 2, [90, 70, 60]); rect(g, 7, 1, 2, 1, [120, 100, 90]);
    rect(g, 5, 4, 6, 10, [70, 50, 40]); rect(g, 5, 4, 2, 10, [96, 72, 58]); rect(g, 4, 13, 8, 2, [50, 36, 30]);
  },
  packet(g) {
    rect(g, 3, 3, 10, 11, [214, 190, 140]); rect(g, 3, 3, 10, 2, [240, 220, 170]); rect(g, 3, 12, 10, 2, [170, 140, 90]);
    for (let k = 0; k < 4; k++) rect(g, 4 + k * 2, 2, 1, 1, [214, 190, 140]);   // crimped top
    ball(g, 8, 8, 2, [190, 120, 60], false);
  },
  pork(g) {   // a pork chop: pink meat with a rim of fat
    ellipse(g, 8, 9, 6, 5, [250, 236, 230]); ellipse(g, 8, 9, 5, 4, [236, 170, 166]); ellipse(g, 7, 8, 3, 2, [244, 190, 184]);
    rect(g, 12, 12, 2, 2, [250, 246, 236]);   // the bone
  },
  noodles(g) {   // a nest of noodles
    for (let k = 0; k < 5; k++) for (let x = 3; x < 13; x++) rect(g, x, 5 + k * 2 + Math.round(Math.sin(x * 0.9 + k) * 0.8), 1, 1, k & 1 ? [236, 206, 128] : [248, 228, 160]);
  },
  drumstick(g) {
    // A roast drumstick: golden, shaded meaty end, tapering to a white bone knob.
    const skin = [214, 146, 70], dark = [166, 100, 44], light = [246, 196, 120];
    ellipse(g, 6, 6, 5, 5, dark); ellipse(g, 6, 6, 4, 4, skin);
    ellipse(g, 5, 4, 2, 2, light); rect(g, 8, 8, 2, 1, dark);
    for (let k = 0; k < 4; k++) rect(g, 8 + k, 8 + k, 3 - (k >> 1), 2, k < 2 ? skin : dark);   // the meat narrows toward the bone
    rect(g, 11, 11, 2, 2, [244, 238, 224]);
    ball(g, 13, 14, 1, [250, 246, 236], false); ball(g, 14, 12, 1, [250, 246, 236], false);   // the bone's knob
  },

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
  corn(g) {
    for (let y = 0; y < 10; y++) { const w = y < 2 || y > 7 ? 4 : 6; rect(g, 8 - w / 2, 3 + y, w, 1, (y & 1) ? [240, 196, 50] : [255, 222, 90]); }
    rect(g, 6, 4, 1, 8, [255, 238, 150]);
    rect(g, 3, 9, 3, 5, [110, 170, 70]); rect(g, 10, 8, 3, 6, [90, 150, 60]);
  },
  potato(g) { ellipse(g, 8, 9, 6, 5, [190, 146, 90]); ellipse(g, 7, 8, 4, 3, [214, 172, 112]); rect(g, 5, 8, 1, 1, [140, 100, 60]); rect(g, 10, 10, 1, 1, [140, 100, 60]); rect(g, 8, 6, 1, 1, [140, 100, 60]); },
  beans(g) { ball(g, 5, 10, 3, [206, 160, 118], false); ball(g, 10, 10, 3, [170, 70, 60], false); ball(g, 8, 6, 3, [220, 184, 140], false); },   // pinto, kidney, pinto
  pasta(g) {
    for (const [x, y] of [[3, 5], [9, 4], [5, 10], [10, 10]]) { rect(g, x, y, 4, 3, [236, 206, 128]); rect(g, x + 1, y + 1, 2, 1, [200, 160, 90]); rect(g, x, y, 4, 1, [250, 230, 170]); }
  },
  herb(g) {
    rect(g, 7, 6, 1, 9, [90, 130, 60]);
    ball(g, 5, 6, 3, [70, 170, 70], false); ball(g, 10, 5, 3, [60, 160, 60], false); ball(g, 8, 3, 2, [90, 190, 80], false);
  },
};


// ---------------- Dish icons (24x16): each level's finished dish, for its ticket ----------------

// A white bowl seen from a little above, filled with soup of color c. Returns the soup surface's center row.
function soupBowl(g, c) {
  ellipse(g, 12, 7, 10, 7, [214, 214, 222], 'bottom'); ellipse(g, 11, 8, 8, 5, [240, 240, 246], 'bottom');
  rect(g, 8, 14, 8, 1, [190, 190, 200]);
  ellipse(g, 12, 6, 10, 3, [250, 250, 252]);
  ellipse(g, 12, 6, 8, 2, c); rect(g, 7, 5, 4, 1, mix(c, [255, 255, 255], 0.35));
}
function dots(g, pts, c) { for (const [x, y] of pts) rect(g, x, y, 1, 1, c); }
const DISH_DRAW = {
  'tomato-soup'(g) {
    soupBowl(g, [214, 60, 40]);
    rect(g, 10, 6, 5, 1, [250, 236, 220]); rect(g, 14, 5, 2, 1, [250, 236, 220]);   // a swirl of cream
    rect(g, 15, 6, 2, 1, [70, 150, 60]); rect(g, 16, 5, 1, 1, [100, 180, 80]);    // basil
  },
  'creamy-corn'(g) {
    soupBowl(g, [244, 224, 150]);
    dots(g, [[8, 6], [11, 5], [14, 7], [16, 6], [12, 7], [9, 7]], [250, 200, 40]);
    rect(g, 13, 5, 2, 1, [90, 160, 70]);   // chives
  },
  'flatbread'(g) {
    // A blistered round flatbread, slightly folded, on a board.
    rect(g, 2, 12, 20, 3, [150, 100, 60]); rect(g, 2, 12, 20, 1, [180, 128, 80]);
    ellipse(g, 12, 9, 10, 4, [226, 182, 110]); ellipse(g, 11, 8, 8, 3, [240, 206, 140]);
    dots(g, [[6, 8], [10, 7], [14, 9], [17, 8], [9, 10], [13, 7]], [130, 80, 40]);
    rect(g, 15, 10, 2, 1, [110, 66, 34]);
  },
  'fish-stew'(g) {
    soupBowl(g, [226, 120, 60]);
    rect(g, 8, 5, 3, 2, [250, 246, 236]); rect(g, 13, 6, 3, 2, [246, 240, 230]);   // flakes of white fish
    dots(g, [[12, 5], [16, 5], [7, 7]], [70, 150, 60]);   // parsley
    rect(g, 17, 6, 1, 1, [240, 220, 90]);   // lemon
  },
  'minestrone'(g) {
    soupBowl(g, [204, 96, 50]);
    rect(g, 8, 5, 2, 1, [236, 206, 128]); rect(g, 14, 7, 2, 1, [236, 206, 128]);   // pasta
    dots(g, [[11, 6], [16, 5]], [170, 70, 60]); dots(g, [[13, 5], [9, 7]], [244, 140, 40]);   // beans, carrot
    dots(g, [[12, 7], [15, 6], [7, 6]], [100, 170, 70]);   // greens
  },
  'french-onion'(g) {
    // A brown crock with a bubbling cheese lid browned in spots.
    ellipse(g, 12, 8, 9, 6, [120, 70, 40], 'bottom'); rect(g, 6, 13, 12, 1, [90, 50, 30]);
    rect(g, 2, 8, 2, 2, [120, 70, 40]); rect(g, 20, 8, 2, 2, [120, 70, 40]);   // handles
    ellipse(g, 12, 6, 9, 3, [248, 220, 130]); ellipse(g, 12, 5, 7, 2, [252, 232, 160]);
    rect(g, 4, 7, 2, 2, [248, 220, 130]); rect(g, 18, 7, 1, 3, [248, 220, 130]);   // cheese dripping over the rim
    dots(g, [[9, 5], [13, 4], [15, 6], [11, 7], [7, 6]], [190, 130, 50]);
  },
  'beef-chowder'(g) {
    soupBowl(g, [236, 216, 180]);
    rect(g, 8, 5, 2, 2, [130, 70, 50]); rect(g, 14, 6, 2, 2, [130, 70, 50]);   // beef
    rect(g, 11, 6, 2, 1, [250, 236, 180]); rect(g, 16, 5, 1, 1, [250, 236, 180]);   // potato
    dots(g, [[12, 5], [10, 7]], [60, 54, 52]);   // cracked pepper
  },
  'goulash'(g) {
    soupBowl(g, [160, 50, 30]);
    rect(g, 8, 6, 2, 2, [100, 46, 34]); rect(g, 14, 5, 2, 2, [100, 46, 34]);   // beef
    rect(g, 11, 5, 3, 1, [252, 250, 244]); rect(g, 12, 6, 1, 1, [252, 250, 244]);   // sour cream
    dots(g, [[9, 5], [16, 6], [13, 7]], [220, 60, 30]);   // paprika
  },
  'sponge-cake'(g) {
    // A round sponge with a slice cut out, cream between the layers, a strawberry on top.
    ellipse(g, 12, 13, 10, 2, [220, 220, 228]);   // plate
    rect(g, 3, 6, 18, 7, [240, 200, 120]); rect(g, 3, 9, 18, 1, [252, 246, 236]);
    ellipse(g, 12, 6, 9, 2, [246, 216, 150]); ellipse(g, 12, 13, 9, 1, [220, 176, 100]);
    rect(g, 14, 6, 7, 7, [200, 160, 96]); rect(g, 14, 9, 7, 1, [252, 246, 236]);   // the cut face
    rect(g, 8, 3, 3, 3, [220, 40, 50]); rect(g, 9, 2, 1, 1, [80, 160, 60]); rect(g, 8, 3, 1, 1, [255, 140, 140]);
  },
  'chicken-noodle'(g) {
    soupBowl(g, [234, 196, 100]);   // golden chicken broth
    rect(g, 8, 5, 2, 1, [250, 236, 180]); rect(g, 14, 6, 2, 1, [250, 236, 180]);   // little pasta
    rect(g, 11, 6, 2, 1, [244, 244, 236]); dots(g, [[16, 5], [9, 7]], [244, 128, 32]); dots(g, [[13, 5]], [90, 160, 70]);   // chicken, carrot, parsley
  },
  'tonkotsu-ramen'(g) {
    soupBowl(g, [244, 236, 220]);   // creamy white pork broth
    for (let x = 6; x < 12; x++) rect(g, x, 6 + (x & 1), 1, 1, [240, 214, 140]);   // noodles
    rect(g, 13, 5, 3, 2, [250, 248, 240]); rect(g, 14, 5, 1, 1, [250, 170, 40]);   // half an egg
    rect(g, 16, 6, 2, 1, [200, 140, 90]); dots(g, [[9, 5], [12, 7]], [90, 170, 70]);   // pork slice, scallions
  },
  'marinara-meatballs'(g) {
    // A plate of noodles in red sauce with meatballs on top.
    ellipse(g, 12, 10, 10, 4, [232, 232, 238]); ellipse(g, 12, 9, 7, 3, [240, 214, 140]);
    ellipse(g, 12, 8, 5, 2, [200, 50, 36]); ball(g, 9, 7, 2, [140, 70, 50], false); ball(g, 15, 7, 2, [140, 70, 50], false);
    dots(g, [[12, 6]], [90, 160, 70]);
  },
  'hot-sour'(g) {
    soupBowl(g, [160, 96, 50]);   // dark, peppery broth
    for (let x = 8; x < 16; x += 2) rect(g, x, 5 + (x & 2 ? 1 : 0), 2, 1, [250, 220, 120]);   // egg ribbons
    dots(g, [[10, 7], [15, 6]], [200, 40, 30]); dots(g, [[13, 5]], [90, 160, 70]);
  },
  'primordial-soup'(g) {
    // A bubbling, glowing cauldron of everything.
    soupBowl(g, [90, 140, 70]);
    dots(g, [[7, 5], [10, 6], [13, 5], [16, 6], [9, 7], [15, 7]], [200, 230, 120]);
    rect(g, 11, 2, 1, 2, [160, 220, 120]); rect(g, 14, 1, 1, 2, [160, 220, 120]);   // wisps rising
  },
  'chili'(g) {
    soupBowl(g, [150, 40, 26]);
    dots(g, [[8, 5], [10, 7], [14, 5], [16, 7], [12, 6]], [110, 30, 30]);   // beans
    rect(g, 11, 5, 3, 1, [252, 250, 244]);   // sour cream
    dots(g, [[13, 6], [9, 6]], [90, 160, 70]);   // scallion
    rect(g, 19, 11, 3, 1, [220, 40, 30]); rect(g, 21, 10, 1, 1, [80, 150, 60]);   // a chili pepper alongside
  },
};
// Ingredient and dish icons come through Sprites, so finished art replaces these drawings (js/sprites.js).
Art.ingIcon = function (ing, cracked) { return Sprites.canvas('ingredients/' + ing.id, cracked ? 'cracked' : 'default', 0); };
Art.dishIcon = function (id) { return Sprites.defs['dishes/' + id] ? Sprites.canvas('dishes/' + id, 'default', 0) : null; };

// ---------------- Tool icons (16x16) ----------------

const TOOL_DRAW = {
  hand(g) { ball(g, 8, 9, 5, [250, 210, 180], false); rect(g, 3, 4, 2, 6, [250, 210, 180]); rect(g, 6, 2, 2, 5, [250, 210, 180]); rect(g, 9, 2, 2, 5, [250, 210, 180]); rect(g, 12, 4, 2, 5, [240, 196, 166]); },
  ladle(g) { rect(g, 9, 1, 2, 9, [180, 120, 70]); rect(g, 9, 1, 1, 9, [220, 160, 100]); ellipse(g, 7, 12, 5, 3, [190, 196, 210]); ellipse(g, 6, 11, 3, 1, [240, 244, 250]); },
  spoon(g) { rect(g, 7, 7, 2, 8, [200, 206, 220]); ellipse(g, 8, 5, 3, 4, [200, 206, 220]); ellipse(g, 7, 4, 1, 2, [250, 252, 255]); },
  lid(g) { ellipse(g, 8, 10, 7, 3, [170, 178, 196]); ellipse(g, 8, 9, 6, 2, [214, 220, 232]); rect(g, 6, 5, 4, 3, [60, 50, 50]); rect(g, 7, 5, 2, 1, [110, 100, 100]); },
  book(g) { rect(g, 3, 3, 10, 11, [170, 70, 60]); rect(g, 4, 4, 8, 9, [250, 240, 220]); rect(g, 8, 4, 1, 9, [200, 180, 160]); rect(g, 5, 6, 2, 1, [150, 130, 110]); rect(g, 9, 6, 2, 1, [150, 130, 110]); },
  door(g) {
    rect(g, 3, 1, 10, 15, [90, 60, 40]);                   // frame
    rect(g, 4, 2, 8, 14, [40, 30, 30]);                    // the dark doorway behind
    rect(g, 4, 2, 6, 14, [176, 116, 64]); rect(g, 4, 2, 6, 1, [206, 146, 90]);   // the door, swung partly open
    rect(g, 5, 4, 4, 4, [156, 100, 54]); rect(g, 5, 10, 4, 4, [156, 100, 54]);   // panels
    rect(g, 8, 9, 1, 1, [250, 214, 110]);                  // knob
  },
  sad(g) {
    ball(g, 8, 8, 6, [250, 214, 110], false); ellipse(g, 8, 8, 6, 6, [250, 214, 110]);
    rect(g, 5, 6, 1, 2, [60, 40, 30]); rect(g, 10, 6, 1, 2, [60, 40, 30]);
    rect(g, 6, 11, 4, 1, [60, 40, 30]); rect(g, 5, 12, 1, 1, [60, 40, 30]); rect(g, 10, 12, 1, 1, [60, 40, 30]);
    rect(g, 11, 8, 1, 2, [120, 180, 250]);   // a tear
  },
  recipe(g) {   // an order ticket on a clip
    rect(g, 3, 3, 10, 12, [250, 246, 234]); rect(g, 6, 1, 4, 3, [170, 174, 188]);
    for (let k = 0; k < 4; k++) rect(g, 5, 6 + k * 2, k === 0 ? 6 : 5 - (k & 1), 1, [140, 120, 110]);
  },
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

// theme: 'kitchen' (the default kitchen) or 'pizza' (Papa Dom's pizza shop, for the first tier).
// plain: just the wall pattern and the stovetop, with none of the props (the art branch's placeholder).
Art.buildBackground = function (theme = 'kitchen', plain = false) {
  const cv = makeCanvas(W, H), g = cv.getContext('2d');
  const pizza = theme === 'pizza', hell = theme === 'hell';
  if (hell) {
    // Hell's kitchen: black rock split by glowing lava cracks.
    rect(g, 0, 0, W, 150, [44, 12, 12]);
    for (let y = 0; y < 150; y += 9) for (let x = ((y / 9) & 1) * 9; x < W; x += 18) rect(g, x, y, 17, 8, [56, 16, 16]);
    for (let k = 0; k < 9; k++) {
      let x = 12 + k * 36, y = 0;
      while (y < 140) { const nx = x + ((k * 7 + y) % 5) - 2; rect(g, Math.min(x, nx), y, Math.abs(nx - x) + 1, 6, [255, 110 + (y % 40), 30]); x = nx; y += 6; }
    }
  } else if (pizza) {
    // Exposed brick wall.
    rect(g, 0, 0, W, 150, [160, 78, 60]);
    for (let y = 0; y < 150; y += 7) {
      rect(g, 0, y, W, 1, [120, 58, 46]);
      for (let x = ((y / 7) & 1) * 7; x < W; x += 14) { rect(g, x, y, 1, 7, [120, 58, 46]); rect(g, x + 1, y + 1, 12, 1, [176, 90, 70]); }
    }
  } else {
  // Back wall: warm tiles.
  rect(g, 0, 0, W, 150, [246, 222, 196]);
  for (let y = 0; y < 150; y += 12) for (let x = (y / 12 % 2) * 6; x < W; x += 12) {
    rect(g, x, y, 11, 11, [252, 232, 208]); rect(g, x, y, 11, 1, [255, 244, 228]);
  }
  for (let y = 0; y < 150; y += 12) rect(g, 0, y + 11, W, 1, [226, 196, 170]);
  }
  if (!plain && !hell) {
  // We're looking slightly up: a range hood looms overhead, seen from underneath.
  for (let y = 0; y < 13; y++) {
    const inset = 70 + y * 1.5;
    rect(g, inset, y, W - inset * 2, 1, mix([96, 100, 116], [150, 156, 172], y / 13));
  }
  rect(g, 92, 12, 136, 2, [70, 72, 86]);
  rect(g, 110, 9, 22, 2, [255, 236, 170]); rect(g, 188, 9, 22, 2, [255, 236, 170]);   // hood lights
  if (pizza) {
    // Chalkboard menu, upper right.
    rect(g, 194, 8, 58, 42, [110, 76, 50]); rect(g, 197, 11, 52, 36, [40, 48, 44]);
    for (let k = 0; k < 5; k++) { rect(g, 201, 15 + k * 6, 22 + ((k * 7) % 14), 1, [210, 214, 206]); rect(g, 236, 15 + k * 6, 8, 1, [230, 200, 120]); }
    ellipse(g, 240, 40, 6, 3, [230, 170, 80]); ellipse(g, 240, 40, 4, 2, [200, 70, 50]);   // a little chalk pizza
    // Italian-flag bunting across the top.
    for (let x = 64; x < 196; x += 12) {
      const c = [[60, 160, 80], [246, 246, 240], [210, 50, 50]][((x - 64) / 12) % 3];
      for (let k = 0; k < 6; k++) rect(g, x + k, 14 + k, 12 - k * 2, 1, c);
    }
    rect(g, 62, 13, 136, 1, [80, 60, 50]);
    // Wood-fired pizza oven, its mouth glowing, lower left of the wall.
    ellipse(g, 98, 104, 36, 30, [130, 70, 54], 'top'); ellipse(g, 98, 104, 34, 28, [180, 96, 70], 'top');
    for (let y = 80; y < 104; y += 6) rect(g, 66, y, 64, 1, [150, 76, 58]);
    ellipse(g, 98, 104, 15, 13, [40, 20, 16], 'top'); ellipse(g, 98, 104, 12, 10, [230, 120, 40], 'top'); ellipse(g, 98, 104, 7, 6, [255, 210, 110], 'top');
    rect(g, 60, 104, 76, 6, [110, 60, 46]); rect(g, 60, 104, 76, 1, [150, 84, 64]);
    // A pizza peel leaning on the wall.
    rect(g, 140, 50, 2, 40, [150, 110, 70]); ellipse(g, 141, 94, 7, 6, [190, 150, 100]);
  } else {
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
  }
  }
  // Shadowy back counter line.
  rect(g, 0, 140, W, 10, hell ? [30, 8, 8] : pizza ? [120, 60, 46] : [200, 170, 150]);
  // Counter/stovetop: from a low angle its top is a thin sliver, so mostly we see the back wall.
  rect(g, 0, 150, W, 50, [214, 186, 164]);
  for (let x = 0; x < W; x += 12) rect(g, x, 150, 1, 50, [200, 172, 150]);
  for (let y = 200; y < 214; y++) {
    const t = (y - 200) / 14, inset = 10 * (1 - t);
    rect(g, inset, y, W - inset * 2, 1, mix([150, 156, 172], [110, 116, 132], t));
  }
  rect(g, 10, 200, W - 20, 1, [190, 196, 210]);
  // Stove front panel.
  if (theme === 'show' && !plain) {
    // Souped Up's studio kitchen: a poster to keep the contestants moving.
    // An easter egg: a small, faded paper sign tacked to the wall.
    rect(g, 64, 50, 28, 22, [214, 200, 178]); rect(g, 65, 51, 26, 20, [236, 226, 206]);
    rect(g, 77, 49, 2, 2, [150, 130, 110]);   // the tack
    const ink = [176, 160, 140];
    Art.pixelText(g, 'EVERY', 68, 54, ink); Art.pixelText(g, 'SECOND', 66, 60, ink); Art.pixelText(g, 'COUNTS', 66, 66, ink);
  }
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

// lift: how far it's raised (tasting under it); rattle: a hard boil underneath makes it jump.
// Where the lid sits: lifted (tasting under it) it rises and shifts a little to the right.
Art.lidPos = function (t, lift = 0, rattle = false) {
  const jig = rattle ? Math.round(Math.sin(t * 0.9) * 1.2 + (Math.sin(t * 2.3) > 0.7 ? -1 : 0)) : 0;
  return { cx: 160 + (lift ? 6 : 0), cy: POT_TOP - 2 - lift + jig };
};
// The top of the lid's handle, where a hand grips it.
Art.lidKnob = function (t, lift = 0, rattle = false) { const p = Art.lidPos(t, lift, rattle); return { x: p.cx, y: p.cy - 9 }; };
Art.drawLid = function (g, t, lift = 0, rattle = false) {
  const { cx, cy } = Art.lidPos(t, lift, rattle);
  if (lift) { g.fillStyle = 'rgba(240,240,250,0.35)'; for (let k = 0; k < 4; k++) g.fillRect(150 + k * 8, cy + 4 + ((t + k * 5) % 6) * -1, 2, 3); }   // steam escaping
  ellipse(g, cx, cy, 84, 5, rgb(STEEL, 0.55));
  ellipse(g, cx, cy - 1, 82, 4, rgb(STEEL, 0.95));
  ellipse(g, cx - 20, cy - 2, 40, 2, rgb(STEEL, 1.2));
  rect(g, cx - 8, cy - 11, 16, 6, [50, 44, 50]); rect(g, cx - 8, cy - 11, 16, 2, [100, 94, 104]);
};

// A tiny 3x5 pixel font for things painted in the kitchen (the timer, posters).
const PIXEL_FONT = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  ':': '000010000010000', ' ': '000000000000000', '!': '010010010000010',
  E: '111100110100111', V: '101101101101010', R: '110101110101101', Y: '101101010010010', S: '111100111001111', C: '111100100100111',
  O: '111101101101111', N: '101111111111101', D: '110101101101110', U: '101101101101111', T: '111010010010010',
};
Art.pixelText = function (g, str, x, y, c, scale = 1) {
  [...str].forEach((ch, n) => {
    const bits = PIXEL_FONT[ch] || PIXEL_FONT[' '];
    for (let k = 0; k < 15; k++) if (bits[k] === '1') rect(g, x + n * 4 * scale + (k % 3) * scale, y + ((k / 3) | 0) * scale, scale, scale, c);
  });
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
