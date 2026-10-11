// Renders every artist-owned sprite (js/sprites.js) into art/templates/ for redrawing:
//   <path>.png        the sheet at native size: one row per state, one column per frame. Paint over this.
//   <path>.guide.png  the same, zoomed, with state names, frame numbers, the anchor (red cross) and guide lines.
//   <path>.json       cell size, anchor, and each row's state, frame count and speed.
// plus art/templates/catalog.json and art/catalog.html, a page showing every guide by group.
//
// Needs Playwright (npm i -D playwright, then npx playwright install chromium), or a system Chrome.
// Usage: node tools/export-art.js
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'art', 'templates');

let chromium;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = require('playwright-core')); } catch {
  console.error('Needs Playwright: npm i -D playwright && npx playwright install chromium'); process.exit(1);
} }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${server.address().port}/`);
  await page.waitForFunction(() => typeof Sprites !== 'undefined' && Object.keys(Sprites.defs).length);
  await page.evaluate(() => document.fonts.ready);
  // Templates always come from the code drawings, never from finished art.
  const all = await page.evaluate(() => { Sprites.over = {}; Sprites.cache = {}; return Sprites.exportAll(); });
  await browser.close(); server.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

  fs.rmSync(OUT, { recursive: true, force: true });
  const png = (url) => Buffer.from(url.split(',')[1], 'base64');
  for (const { meta, sheet, guide } of all) {
    const base = path.join(OUT, meta.path);
    fs.mkdirSync(path.dirname(base), { recursive: true });
    fs.writeFileSync(base + '.png', png(sheet));
    fs.writeFileSync(base + '.guide.png', png(guide));
    fs.writeFileSync(base + '.json', JSON.stringify(meta, null, 2) + '\n');
  }
  const metas = all.map((a) => a.meta);
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(metas, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'art', 'catalog.html'), catalog(metas));

  const cells = (m) => m.states.reduce((n, s) => n + s.frames, 0);
  const groups = {};
  for (const m of metas) (groups[m.group] = groups[m.group] || []).push(m);
  for (const [g, ms] of Object.entries(groups)) console.log(`${g.padEnd(12)} ${String(ms.length).padStart(3)} sprites  ${String(ms.reduce((n, m) => n + cells(m), 0)).padStart(4)} cells`);
  console.log(`Wrote ${metas.length} templates to art/templates/ and art/catalog.html.`);
})();

// A browsable page of every template: what each sprite is, its states, and its zoomed guide.
function catalog(metas) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const order = ['characters', 'ingredients', 'backgrounds'];
  const sections = order.map((g) => {
    const ms = metas.filter((m) => m.group === g);
    const cards = ms.map((m) => `
    <section class="sprite" id="${esc(m.path)}">
      <h3>${esc(m.path)}</h3>
      <p class="facts">cell ${m.cell[0]}×${m.cell[1]} · anchor ${m.anchor[0]},${m.anchor[1]} · sheet ${m.sheet[0]}×${m.sheet[1]} ·
        <a href="templates/${esc(m.path)}.png">template</a> · <a href="templates/${esc(m.path)}.json">json</a></p>
      <p>${esc(m.notes)}</p>
      <table>${m.states.map((s) => `<tr><td>${s.row}</td><td><b>${esc(s.name)}</b></td><td>${s.frames} frame${s.frames > 1 ? 's' : ''}${s.fps ? ` @ ${s.fps} fps${s.loop ? ', loops' : ', plays once'}` : ''}</td><td>${esc(s.note || '')}</td></tr>`).join('')}</table>
      <img src="templates/${esc(m.path)}.guide.png" alt="${esc(m.path)} guide">
    </section>`).join('');
    return `<h2 id="${g}">${g[0].toUpperCase() + g.slice(1)} <small>${ms.length} sprites, ${ms.reduce((n, m) => n + m.states.reduce((k, s) => k + s.frames, 0), 0)} cells</small></h2>${cards}`;
  }).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Soup Pot Art Templates</title>
<style>
  :root { --bg: #f6f1e7; --fg: #2a1d24; --muted: #6d5f66; --card: #fffaf0; --line: #e1d6c4; --accent: #c4242a; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1d1b24; --fg: #f2e8d8; --muted: #a59bb0; --card: #26232f; --line: #3a3644; --accent: #ff6b6b; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 80px; }
  nav a { margin-right: 14px; color: var(--accent); }
  h2 { margin-top: 48px; border-bottom: 2px solid var(--line); } h2 small { font-weight: 400; color: var(--muted); font-size: 14px; }
  .sprite { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; margin: 16px 0; overflow-x: auto; }
  .sprite h3 { margin: 0; font-family: ui-monospace, monospace; } .facts { color: var(--muted); font-size: 13px; margin: 2px 0 8px; }
  table { border-collapse: collapse; font-size: 13px; margin-bottom: 10px; } td { padding: 2px 10px 2px 0; vertical-align: top; }
  img { image-rendering: pixelated; max-width: 100%; display: block; }
  a { color: var(--accent); }
</style></head><body><main>
<h1>Soup Pot: art templates</h1>
<p>Everything to redraw, with every state and frame. Paint over each <code>art/templates/…png</code> at its exact size, keep the grid, and save it to the same path under <code>art/sprites/</code>. See <code>art/README.md</code>.</p>
<nav>${order.map((g) => `<a href="#${g}">${g}</a>`).join('')}</nav>
${sections}
</main></body></html>
`;
}
