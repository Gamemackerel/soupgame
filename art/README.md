# Soup Pot art

Everything an artist redraws is in three groups:

| Group | What | Size |
|---|---|---|
| `characters/` | The chef (body, head, 10 faces), the six judges (body and table-front, every mood), Papa Dom, the rat, the queue of customers | 12×29 up to 120×130 |
| `ingredients/` | The 30 pantry items (plus the cracked egg), and `ingredients/dishes/`, the 10 finished dishes on the level select | 16×16, dishes 24×16 |
| `backgrounds/` | Kitchen, pizza shop, studio kitchen, judging stage and its table, the shop front by night and by day, the level select wall | 320×240 |

Everything else (the pot and lid, the chef's arms, flames, steam, food in the pot, buttons, tool icons, text) is drawn by code and isn't part of this.

**Open `art/catalog.html`** to see every sprite: what it's for, its states and frames, and a zoomed guide.

## The files

For each sprite, `art/templates/<group>/<name>`:

- **`.png`**: the template sheet, at the game's exact pixel size. **This is what you paint over.**
- **`.guide.png`**: the same, zoomed, with labels. The red cross is the anchor, the point the game positions the sprite by. Blue dashed lines are landmarks such as the table top or the pot rim.
- **`.json`**: the cell size, anchor, and each row's state, frame count and speed.

## Sheet layout

- One **row per state** (a mood, a pose, an animation), in the order the guide lists them.
- One **column per frame**, left to right. A row with fewer frames than the widest row leaves its extra cells empty.
- Every cell is the same size, with no gaps or padding between cells.

Animations are grouped as rows: a judge's `happy` row holds all the frames of their happy loop. The listed fps is how fast the game steps through them. Loops should loop, and rows marked "plays once" hold on their last frame.

## Rules

1. **Keep the exact pixel size** of the sheet and of every cell. The game rejects a sheet of the wrong size and keeps using the old art.
2. **Keep the anchor where it is.** The character can change shape freely around it, but the anchor point must stay at the same pixel. For example, the chef's face lines up with his head through it.
3. **Transparent background.** Draw with hard pixels and no anti-aliasing. Soft partial transparency is fine for glows and light beams.
4. **Movement the game adds stays out of the art.** Bobbing, hopping, shaking, sliding and the rat running across are the whole sprite moving, done by code. Draw the pose, not the motion through space.
5. Any pixel editor works. In Aseprite: *File → Import Sprite Sheet*, type *By Rows*, with the cell size from the guide. When done, *File → Export Sprite Sheet* the same way (By Rows, no padding).

## Putting finished art in the game

1. Save the finished sheet to the same path under `art/sprites/`, e.g. `art/sprites/characters/judges/paul.png`.
2. Run `node tools/art-index.js`. It checks every sheet's size against its template and lists the good ones in `art/sprites/index.json`.
3. Reload the game. Sprites with finished art use it; the rest keep the code drawings, so art can arrive one file at a time.

## For developers

- Sprites are defined in `js/sprites.js`: cell size, anchor, states and the code drawing that is the fallback and the template.
- Changed a drawing, or added a sprite or state? Re-run `node tools/export-art.js`, which needs Playwright. It rewrites `art/templates/` and `art/catalog.html`.
- A state whose frames all come out identical is collapsed to one frame, so nobody draws the same frame four times.
