// Registers finished art: scans art/sprites/ for sheets, checks each against its template (same path in
// art/templates/, same pixel size), and writes art/sprites/index.json, which the game reads to use them.
// No dependencies. Usage: node tools/art-index.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SPRITES = path.join(ROOT, 'art', 'sprites'), TEMPLATES = path.join(ROOT, 'art', 'templates');

function pngs(dir, rel = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pngs(path.join(dir, e.name), rel + e.name + '/') : e.name.endsWith('.png') && !e.name.endsWith('.guide.png') ? [rel + e.name.slice(0, -4)] : []);
}
// Width and height from a PNG's header.
function size(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

fs.mkdirSync(SPRITES, { recursive: true });
const ok = [], bad = [];
for (const p of pngs(SPRITES)) {
  const metaFile = path.join(TEMPLATES, p + '.json');
  if (!fs.existsSync(metaFile)) { bad.push(`${p}: no template with this name (check the folder and spelling)`); continue; }
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')), got = size(path.join(SPRITES, p + '.png'));
  if (!got) bad.push(`${p}: not a PNG`);
  else if (got[0] !== meta.sheet[0] || got[1] !== meta.sheet[1]) bad.push(`${p}: ${got[0]}x${got[1]}, but the template is ${meta.sheet[0]}x${meta.sheet[1]}`);
  else ok.push(p);
}
fs.writeFileSync(path.join(SPRITES, 'index.json'), JSON.stringify(ok.sort(), null, 2) + '\n');
const total = fs.existsSync(path.join(TEMPLATES, 'catalog.json')) ? JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'catalog.json'), 'utf8')).length : '?';
console.log(`${ok.length} of ${total} sprites have finished art.`);
for (const p of ok) console.log('  ok   ' + p);
for (const b of bad) console.log('  SKIP ' + b);
if (bad.length) process.exitCode = 1;
