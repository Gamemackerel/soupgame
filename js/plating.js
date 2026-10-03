// Plating: when you serve, everything actually in the pot is arranged in a bowl (soups, stews)
// or piled on a plate (dry dishes) for the judges. Pieces keep their real shapes and cooked colors.

const Plating = {
  plate: null,

  build(analysis) {
    const S = Sim, data = new Uint8ClampedArray(GW * GH * 4);
    S.render(data);
    let seed = 1234;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    // Pieces: one small sprite per body, cut out of the rendered pot.
    const groups = new Map(), specks = [];
    let lr = 0, lg = 0, lb = 0, ln = 0, oil = 0;
    for (let i = 0; i < N; i++) {
      const m = S.mat[i];
      if (m === BROTH) { const p = i * 4; lr += data[p]; lg += data[p + 1]; lb += data[p + 2]; ln++; continue; }
      if (m === OIL) { oil++; continue; }
      const c = CLS[m];
      if (c !== C_CHUNK && c !== C_POWDER) continue;
      const b = S.body[i];
      if (b) { let g = groups.get(b); if (!g) groups.set(b, g = []); g.push(i); }
      else if (specks.length < 120 || rand() < 0.1) {
        const p = i * 4;
        specks.push([data[p], data[p + 1], data[p + 2]]);
      }
    }
    const pieces = [];
    for (const cells of groups.values()) {
      let x0 = GW, x1 = 0, y0 = GH, y1 = 0;
      for (const i of cells) { const x = i % GW, y = (i / GW) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, cv = makeCanvas(w, h), cg = cv.getContext('2d');
      const img = cg.createImageData(w, h);
      for (const i of cells) {
        const x = i % GW - x0, y = ((i / GW) | 0) - y0, p = i * 4, q = (y * w + x) * 4;
        img.data[q] = data[p]; img.data[q + 1] = data[p + 1]; img.data[q + 2] = data[p + 2]; img.data[q + 3] = 255;
      }
      cg.putImageData(img, 0, 0);
      pieces.push({ cv, w, h, n: cells.length });
    }
    pieces.sort((a, b) => b.n - a.n);
    pieces.length = Math.min(pieces.length, 28);

    const type = analysis.type === 'plate' || analysis.type === 'baked' ? 'plate' : 'bowl';
    const liquid = ln ? [lr / ln, lg / ln, lb / ln] : null;
    // Arrange: bowls float pieces across the surface; plates pile them up in the middle.
    const placed = [];
    const golden = 2.39996;
    pieces.forEach((pc, k) => {
      const r = Math.sqrt(k + 0.5) / Math.sqrt(pieces.length + 1);
      const a = k * golden;
      if (type === 'bowl') {
        placed.push({ pc, x: Math.cos(a) * r * 22 - pc.w / 2, y: Math.sin(a) * r * 4 - pc.h * 0.6 });
      } else {
        placed.push({ pc, x: Math.cos(a) * r * 24 - pc.w / 2, y: Math.sin(a) * r * 5 - pc.h - (1 - r) * 6 });
      }
    });
    placed.sort((a, b) => (a.y + a.pc.h) - (b.y + b.pc.h));   // back to front
    const speckPos = specks.slice(0, 90).map((c) => {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand());
      return { c, x: Math.cos(a) * r * (type === 'bowl' ? 24 : 20), y: Math.sin(a) * r * (type === 'bowl' ? 4 : 4) - (type === 'plate' ? 2 : 0) };
    });
    this.plate = { type, liquid, oil: oil > 20, sauce: type === 'plate' && ln > 20, placed, specks: speckPos, empty: analysis.empty };
    return this.plate;
  },

  draw(g, x, y, steamT) {
    const P = this.plate;
    if (!P) return;
    x = Math.round(x); y = Math.round(y);
    if (P.type === 'bowl') {
      ellipse(g, x, y + 11, 32, 5, [200, 190, 182]);                       // shadow
      ellipse(g, x, y, 31, 13, [30, 40, 70], 'bottom');
      ellipse(g, x, y, 30, 12, [70, 110, 190], 'bottom');
      rect(g, x - 20, y + 4, 9, 2, [120, 160, 230]);
      ellipse(g, x, y, 30, 6, [50, 80, 150]);                              // rim
      if (!P.empty && P.liquid) ellipse(g, x, y, 27, 5, P.liquid);
      if (!P.empty && P.oil) for (let k = 0; k < 6; k++) ellipse(g, x - 16 + k * 6, y - 1 + (k & 1), 2, 1, [240, 200, 90]);
    } else {
      ellipse(g, x, y + 4, 38, 7, [200, 190, 182]);                        // shadow
      ellipse(g, x, y, 37, 9, [180, 176, 170]);
      ellipse(g, x, y - 1, 36, 8, [252, 250, 244]);
      ellipse(g, x, y - 1, 27, 6, [236, 232, 224]);                        // the well of the plate
      if (P.sauce && P.liquid) ellipse(g, x + 2, y, 18, 4, P.liquid);
      if (P.oil) { ellipse(g, x - 2, y, 20, 4, 'rgba(240,200,90,0.45)'); rect(g, x - 10, y - 1, 4, 1, [255, 240, 180]); }
    }
    if (P.empty) return;
    for (const s of P.specks) rect(g, x + s.x, y + s.y, 1, 1, s.c);
    for (const p of P.placed) {
      g.drawImage(p.pc.cv, Math.round(x + p.x), Math.round(y + p.y));
      // In a bowl, the lower part of each piece sits under the broth.
      if (P.type === 'bowl' && P.liquid) {
        const sub = Math.ceil(p.pc.h * 0.4);
        g.fillStyle = rgb(P.liquid, 1, 0.55);
        g.fillRect(Math.round(x + p.x), Math.round(y + p.y) + p.pc.h - sub, p.pc.w, sub);
      }
    }
    // Steam if it's still hot.
    if (Judging.analysis && Judging.analysis.temp > 55) for (let k = 0; k < 3; k++) {
      const sy = y - 10 - ((steamT + k * 9) % 18);
      rect(g, x - 8 + k * 8 + Math.round(Math.sin((steamT + k * 20) * 0.15) * 2), sy, 1, 3, 'rgba(255,255,255,0.6)');
    }
  },
};
