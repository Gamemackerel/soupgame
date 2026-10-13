# Soup Pot art: how to draw for the game

You're going to draw the art for Soup Pot. You'll draw on paper first, then turn it into pixel art in a program called **Aseprite**. Let's start with one carrot.

**Download the files:** https://gamemackerel.github.io/soupgame/art-branch/soup-pot-aseprite.zip
**See every piece you'll draw:** https://gamemackerel.github.io/soupgame/art-branch/

---

## Get ready (once)

1. Install **Aseprite** from aseprite.org.
2. Download the zip file above and unzip it. You'll get a folder full of `.aseprite` files.

## Your first drawing: the carrot

**1. Draw it on paper.**
Draw a carrot on paper. Keep it simple, with a bold outline and a few colors. Then take a photo of it with your phone and put the photo on your computer.

**2. Open the carrot's file.**
In Aseprite, open `ingredients.aseprite`. It holds every ingredient, one after another.

Above the timeline at the bottom you'll see colored bars with names. These are called **tags**. Click the one called **carrot**. Now you're looking at the carrot's spot. The faint carrot you see is just a guide showing the size, and the game won't use it.

**3. Bring in your photo.**
Go to *Layer → New → New Reference Layer from File* and pick your photo. With that layer selected, press **Ctrl+A** (**Cmd+A** on a Mac) to select it. Drag the corner handles to shrink your photo, then drag the middle to slide it over the faint carrot. Press **Enter** when it fits. It's only a guide to trace.

**4. Pick the right layer.**
On the left of the timeline is the list of **layers**. Find the folder called **ingredient** and click the layer inside it called **draw here**. Whatever you draw on this layer goes into the game.

**5. Draw the pixels.**
Choose the **Pencil** (press **B**). Zoom in a lot, because the carrot is only 16 × 16 pixels. Trace your drawing one pixel at a time. Start with the outline, then fill in the colors.

**6. Check it, then save.**
Click the eye next to your photo's layer to hide it, and look at your carrot. Happy? Press **Ctrl+S** (or **Cmd+S** on a Mac) to save.

Done! That's the whole process. 🥕

## Next: the wine bottle

Same steps, same file. Draw a wine bottle on paper, open `ingredients.aseprite`, click the **wine** tag, bring in your photo, draw on **draw here**, and save.

## Then: the chef

The chef is a bit bigger, and he comes in pieces:

1. Draw the **whole chef** on paper: chef hat, chef shirt, red scarf.
2. Open `characters/chef.aseprite`. Now there are three folders: **body**, **head** and **face**.
3. Bring in your photo, then draw each part in its own folder: his shirt and scarf in **body**, his head and hat in **head**, his eyes, mustache and mouth in **face**.
4. The tags along the top (**idle**, **happy**, **angry**…) are his moods. The body and head stay the same in every mood, so you only draw them once. Draw a new **face** for each mood.

After the chef, keep going in this order: the other ingredients → the dishes → the judges → Papa Dom → the backgrounds.

## Sending your work

Save in Aseprite, then send the `.aseprite` files you finished. Send a few at a time, as you finish them.

## A few rules

- **Don't change the canvas size, and don't rename any folders or tags.** The game finds your drawings by those names.
- **Draw where the faint guide is.** That's where the game puts it.
- **Keep the background clear** (see-through). Just draw the thing itself.
- **Only the first frame of each tag is needed for now.** Some tags have extra frames for animation, and those come later.

## About AI

The whole point is that the game's art is **drawn by you**. Please don't use AI to make, redraw or "improve" your art. If you use it at all, keep it to a small chore, like helping split your finished drawing into pieces.

## Good to know

- Layers whose names start with `_` are just helpers and never go in the game. The `_about` layers describe each piece and what it needs to show.
- Some frames are **linked**. They show the same drawing in several places, so drawing it once fills them all.
- Unfinished files are fine to send. A piece goes into the game once every tag has its first frame drawn.

---

## For the developer

- `node tools/art-aseprite.js export` brings finished art in. It splits the `art/aseprite` files into sprite sheets in `art/sprites/`, checks them, and lists anything held back and why.
- `node tools/art-aseprite.js make [--force]` recreates the Aseprite files. It never overwrites one unless you pass `--force`, which loses the drawing.
- `node tools/export-art.js` regenerates `art/templates/` and the catalog (needs Playwright). `--relayout` rewrites `js/sprite-layout.js`, the list of drawings; only run it on `main`.
- `tools/publish-art-branch.sh`, run on `main`, publishes the art branch's catalog and the zip at `/soupgame/art-branch/`. Commit and push afterwards.
- Sprites are defined in `js/sprites.js`. The game uses any sheet listed in `art/sprites/index.json` and the code drawing for the rest.
