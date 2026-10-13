# Soup Pot art

**Download the files:** https://gamemackerel.github.io/soupgame/art-branch/soup-pot-aseprite.zip
**See every piece:** https://gamemackerel.github.io/soupgame/art-branch/

You'll redraw the game's characters, ingredients and backgrounds in **Aseprite** (aseprite.org). The pot, the chef's arms, flames, food in the pot, buttons and text are drawn by the game, so you don't draw those.

## How it works

1. Unzip the download and open a file, e.g. `characters/chef.aseprite`.
2. Each file is one canvas. **Layer groups** (`body`, `head`, `face`…) are the pieces the game needs. Draw inside a group's `draw here` layer, and add as many layers inside the group as you like.
3. The **tags** (colored bars above the timeline) are the poses: `happy`, `upset`, `tasting`… Click one to see it.
4. Layers starting with `_` are reference only and never used by the game:
   - `_about …` describes the piece and what it must show (the chef's hat, Papa Dom's apron…).
   - `_old art` is a faint placeholder to show size and position.
   - `_guides` are marks like the pot rim or the table line.

**To begin, you only have to draw the first frame of each pose.** Extra animation frames will come later.

Some frames are **linked**: one drawing used in several poses. Draw it once and it shows up everywhere it's linked.

## Rules

- Don't resize the canvas, and don't rename groups or tags.
- Keep each piece where the old art is.
- Transparent background, hard pixels (use the Pencil). Soft transparency is fine for glows.

## Suggested order

Ingredients → dishes → the chef → judges → Papa Dom and extras → backgrounds.

## Sending it back

Just save in Aseprite, and send back the `.aseprite` files you changed once you finish a batch of them. Send a few at a time as you complete them.

---

## For the developer

- `node tools/art-aseprite.js export` brings finished art in. It splits the `art/aseprite` files into sprite sheets in `art/sprites/`, checks them, and lists anything held back and why.
- `node tools/art-aseprite.js make [--force]` recreates the Aseprite files. It never overwrites one unless you pass `--force`, which loses the drawing.
- `node tools/export-art.js` regenerates `art/templates/` and the catalog (needs Playwright). `--relayout` rewrites `js/sprite-layout.js`, the list of drawings; only run it on `main`.
- `tools/publish-art-branch.sh`, run on `main`, publishes the art branch's catalog and the zip at `/soupgame/art-branch/`. Commit and push afterwards.
- Sprites are defined in `js/sprites.js`. The game uses any sheet listed in `art/sprites/index.json` and the code drawing for the rest.
