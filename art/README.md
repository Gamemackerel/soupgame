# Soup Pot art

Everything an artist redraws is in three groups:

| Group | What | Size |
|---|---|---|
| Characters | The chef, the six judges, Papa Dom, the rat, the queue of customers | 12×29 up to 120×130 |
| Ingredients | The 30 pantry items (plus the cracked egg), and the 10 finished dishes on the level select | 16×16, dishes 24×16 |
| Backgrounds | Kitchen, pizza shop, studio kitchen, judging stage and its table, the shop front by night and by day, the level select wall | 320×240 |

Everything else (the pot and lid, the chef's arms, flames, steam, food in the pot, buttons, tool icons, text) is drawn by the game and isn't part of this.

To see every sprite with all its poses and frames, open the catalog: https://gamemackerel.github.io/soupgame/art/

---

## Start here (for the artist)

You'll draw in **Aseprite**, a pixel-art editor. Everything is set up in ready-made Aseprite files, so you never have to think about sprite sheets or sizes.

### 1. Get set up

1. **Install Aseprite** from aseprite.org or Steam (about $20).
2. **Get the files.** The art lives on the **`art` branch** of the game's GitHub repository.
   - **Recommended:** install **GitHub Desktop**, clone the repository, and switch to the `art` branch. Sending your work back is then two clicks (step 5).
   - **Or:** download the `art` branch as a ZIP from GitHub, and send the `.aseprite` files back however you like.
3. Your files are in **`art/aseprite/`**:

   | File | What's in it |
   |---|---|
   | `ingredients.aseprite` | All 31 pantry items, one per frame. **A good place to start.** |
   | `dishes.aseprite` | The 10 finished dishes, one per frame |
   | `characters/chef.aseprite` | The chef: body, head, and his 10 faces |
   | `characters/judges/*.aseprite` | One file per judge: every mood, and what rests on the table in front of them |
   | `characters/dom.aseprite` | Papa Dom, for the cutscenes |
   | `characters/rat.aseprite`, `characters/customers.aseprite` | The extras outside the shop |
   | `backgrounds/*.aseprite` | One per background (the judging stage holds both the stage and its table) |

### 2. Open a file and look around

Open `characters/chef.aseprite`. You'll see the whole chef on one canvas.

- **Layers panel (left of the timeline):** one **group** per piece the game needs: `body`, `head`, `face`. Each has an empty layer called **`draw here`**.
- **Reference layers**, whose names start with `_`, are locked and never exported:
  - `_old art (reference)`: the current placeholder art, faint, to trace or ignore as you like.
  - `_guides`: helper marks. In the chef file, the **blue line** is the pot rim (everything below it is hidden behind the pot) and the **red dots** are his shoulders (his arms are drawn by the game from there).
- **Tags (the colored bars above the timeline)** are the moods, poses and animations: `idle`, `happy`, `angry`… Click one to see its frames.

### 3. Draw

**You only have to draw the first frame of each pose.** If a tag has 4 frames, the other 3 are optional animation: leave them empty and the game holds the first frame. Get every character looking right first; animate later if there's time.

Across all the characters that's **70 drawings** in total (the chef is 10: his body, his head and 8 faces). The extra animation frames are a bonus.

- Draw the **whole character** at once, each piece inside its own group. Use as many layers inside a group as you like, for line art, color, shading and so on. Everything visible inside a group becomes that piece in the game.
- **Nothing is drawn twice.** Where poses share a drawing, it lives in the first pose that uses it, and every other place it appears is a **linked cel** pointing back to it. Aseprite shows linked cels joined in the timeline. Examples: the chef's body across all his faces; a judge's paws on the table, which are the same in most moods; Papa Dom, who is one drawing per mood plus a separate small `mouth` (one per mood, and one open for talking, which the game flaps). Draw it in the first pose and it appears everywhere else.
- Some poses look the same as another one already, such as the chef's *worried* face and his *meh* face. Those get no tag of their own: the game uses the same drawing for both.
- **Animations:** turn on onion skin (the button left of the frame numbers) to see the frames around the one you're drawing. Loops should loop smoothly.
- **Don't draw movement through space.** Bobbing, hopping, shaking and sliding are done by the game. Draw the pose, in place.

### 4. A few rules

1. **Don't resize the canvas, and don't rename the groups or tags.** That's how the game knows what's what.
2. **Keep the pieces inside their area.** The old art shows where each piece sits. Anything far outside it gets cut off.
3. **Transparent background, hard pixels.** Use the Pencil, not anti-aliased brushes. Soft transparency is fine for glows.
4. **Hidden layers and reference layers aren't exported,** so hide anything you want to keep but not use.
5. Any color mode is fine (RGB or Indexed). A 32-color starter palette (DB32) is loaded; swap in your own if you like.

### 5. Save and send it back

Just **save** (Ctrl/Cmd+S) in Aseprite; no exporting needed.

- With GitHub Desktop: write a short note ("chef body and head"), click **Commit to art**, then **Push origin**.
- Without it: send the `.aseprite` files you changed.

Unfinished pieces are fine. A piece only goes into the game once **the first frame of every one of its poses** is drawn, so half-done work never shows up blank.

### Suggested order

1. **`ingredients.aseprite`**: small single frames, a good way to settle the style.
2. **`dishes.aseprite`**.
3. **The chef** (he's on screen the whole time).
4. **The judges**, then **Papa Dom** and the extras.
5. **Backgrounds** last, once the characters set the look.

---

## For the developer

- **Bring finished art into the game:** `node tools/art-aseprite.js export`. It splits every `art/aseprite` file into the game's sprite sheets in `art/sprites/`, then registers and checks them (`tools/art-index.js`). For anything it holds back, it says why (an unfinished pose, a missing group, a resized canvas).
- **Recreate the Aseprite files:** `node tools/art-aseprite.js make`. It never overwrites an existing file; `--force` replaces them, which loses the drawing.
- Sprites are defined in `js/sprites.js`: cell size, anchor, states, and the code drawing that is both the fallback and the template. After changing a drawing, adding a sprite, or adding a state, re-run `node tools/export-art.js` (needs Playwright) to rewrite `art/templates/` and the catalog. Then remake the Aseprite file for that character.
- `art/templates/<group>/<name>.png` / `.guide.png` / `.json` are the raw per-sprite sheets: one row per state, one column per frame, every cell the same size, with the anchor and the frame timing. Finished art lands as the same layout in `art/sprites/`, and the game uses any sheet listed in `art/sprites/index.json`, falling back to the code drawing for the rest.
- A state whose frames all come out identical is collapsed to one frame, so nobody draws the same frame four times.
