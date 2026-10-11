# SOUP POT: Game Spec

A falling-sand cooking sandbox. The simulation lives inside a soup pot. Around it are a burner with a heat dial and a pixel-art chef who picks up whichever ingredient you select and pours it where you click.

- **Phase 1: Sandbox.** Free play. Mix, heat, stir, taste, and discover.
- **Phase 2: Kitchen.** Make target dishes and get as close to them as you can.

---

## 0. Design Pillars

1. **Real cooking truths are the physics.** Every rule should be something a real cook would nod at: fond, roux, umami synergy, curdling, spice blooming. Players who know cooking feel clever, and players who don't come away having learned it.
2. **Order and timing matter more than the ingredient list.** "Onion + oil + heat, *then* water" makes a different soup from "water + onion." This is where the depth and the eureka moments come from.
3. **Every reaction is visible.** Each change gets a color shift, a particle burst, a sound, and a reaction from the chef. Nothing happens silently.
4. **Failure is a spectacle.** Burning, curdling, boil-overs, grease fires and splatter should be funny and pretty, never just a fail screen.
5. **Local rules, emergent results.** Each cell only knows its neighbors. Mirepoix, emulsions and stocks emerge from simple rules interacting.

---

## 1. Screen Layout

```
+------------------------------------------------------+
|  [Ingredient shelf: tabs + icons]          [Journal] |
|                                                      |
|            (chef, behind the pot, ~waist up)         |
|        \o  <- holding the selected ingredient        |
|   ____________________________________________       |
|  |                                            |      |
|  |          SIMULATION (pot interior)         |      |
|  |                                            |      |
|  |____________________________________________|      |
|   \__________________________________________/       |
|        ^^^ ^^ ^^^ ^^ flames ^^ ^^^ ^^               |
|   [HEAT DIAL]   [Lid] [Ladle] [Taste] [Skimmer]      |
+------------------------------------------------------+
```

- **Render target:** 320x240 internal pixel buffer, integer-scaled to the window. Crisp pixels and no smoothing.
- **Pot interior grid:** about 200x120 cells, 1 cell = 1 pixel. The pot walls are solid and conduct heat.
- **Layer order (back to front):** kitchen background, chef, pot back rim, simulation, pot front wall and handles, steam and particles that leave the pot, flames, UI.
- The chef is drawn *behind* the pot, so the pour stream visibly arcs over the front rim.

---

## 2. Controls & Interaction

| Input | Action |
|---|---|
| Click an ingredient on the shelf | Chef sets down his current item and picks up the new one (with a category-specific animation) |
| Hold the mouse over the pot | Chef slides sideways to track the cursor's x and tilts the container. The pour stream falls from his hand to the cursor point |
| Mouse wheel / `[` `]` | Pour rate or brush size |
| Heat dial (drag or `1`–`9`, `0` = off) | Flame size and heat input. Continuous from 0 to 10 |
| Ladle tool | Drag in the pot to stir. The chef holds a real ladle whose bowl follows the cursor. It goes in when the cursor enters the pot and keeps working up to 25 px outside it (clamped to the nearest wall or the bottom), so you can scrape along them; it only comes out past that. It displaces cells along the drag, shoves pieces through loose food (and passes the push on through a packed stew), scoops what's on the bottom up off the hot metal, and scrapes char loose a little at a time |
| Taste tool | Click the liquid. The chef sips, reacts, and a flavor readout appears (§6) |
| Skimmer | Removes foam, scum and floating fat from the surface |
| Lid toggle | Traps steam: faster boiling, no reduction, keeps aroma. Raises boil-over risk |
| Spacebar | Pause the simulation |

### Chef Animation States
- **Idle:** bobbing, blinking, sometimes sniffing the steam.
- **Pick up**, one animation per ingredient category:
  - *Powder:* grabs a shaker or pinches from a bowl.
  - *Liquid:* lifts a jug or bottle.
  - *Chunks:* lifts a cutting board and readies the knife to scrape.
  - *Whole items* (egg, bones, kombu): holds it in hand.
- **Pour/add:** a loop that matches the category (shake, pour, scrape, drop). It plays while the mouse is held down.
- **Reactions** (interrupt briefly, then return to holding):
  - Wipes brow when heat is above 8.
  - Recoils from splatter.
  - Panics and grabs the lid when there's a grease fire.
  - Happy hop and sparkle when you make a **new discovery**.
  - Grimace at burnt smells.
  - "Chef's kiss" when you taste something great.

---

## 3. Simulation Model

### 3.1 Per-cell State (typed arrays)

| Field | Type | Purpose |
|---|---|---|
| `mat` | u8 | Material ID |
| `temp` | f32 | Temperature in °C |
| `cook` | u8 | Cooking progress, 0–255 (raw, cooked, browned, burnt thresholds per material) |
| `life` | u8 | General timer (bubble lifetime, fire fuel, dissolve progress) |
| `body` | u16 | Cluster ID for rigid chunk groups (0 = loose cell) |
| `shade` | u8 | Per-cell color variation |

**Flavor field.** Each liquid cell also carries a dissolved-flavor vector `F[8]` (§4), stored as an f32 array of size cells × 8.

### 3.2 Movement Classes

| Class | Behaviour | Examples |
|---|---|---|
| **Static** | Never moves | Pot walls, burnt crust stuck to the bottom |
| **Powder** | Falls; if blocked, falls diagonally. Sinks through lighter liquids | Salt, sugar, flour, spices |
| **Liquid** | Falls, then spreads sideways. Density-sorted against other liquids | Water, stock, oil, milk, wine |
| **Chunk** | Rigid clusters of 2x2 to 5x5 cells that move as one unit, sink or float by density, and tumble when stirred. When cooked past a threshold they **break apart** into loose cells | Onion, carrot, potato, meat, tomato |
| **Gas** | Rises and drifts, then fades or leaves the pot | Steam, smoke, aroma wisps |
| **Foam** | Floats on liquid, stacks, and can rise over the rim | Scum, boil-over foam, baking-soda fizz |
| **Fire** | Rises, flickers, and spreads to flammable neighbours | Grease fire, flambé |

**Density order (light to heavy):** gas < foam < oil/fat < alcohol < water/stock < milk < syrupy liquids < most chunks < powders. Floating chunks (mushrooms, bread, croutons) are lighter than water until they get waterlogged.

**Update order:** bottom-up, alternating left-to-right and right-to-left on each frame so nothing drifts in one direction. Target 60 fps. Do a `temp` diffusion pass every frame and a flavor diffusion pass every 2–4 frames.

### 3.3 Heat

- **Burner.** The pot's bottom wall cells gain heat proportional to the dial value. With the lid off, the max steady state is about 240 °C on a dry pot bottom.
- **Conduction.** Each cell's temperature moves toward its neighbours' at a rate set by the material: water and metal conduct well, oil moderately, air badly.
- **Convection.** A liquid cell that is hotter than the liquid cell directly above it swaps with it, with a probability based on the temperature difference. This produces visible rolling currents, which you can see when you add dye-like ingredients such as beet or turmeric.
- **Phase limits:**
  - Water-based liquids are **capped at 100 °C**. Extra heat converts water into steam bubbles.
  - Oil can reach about 200 °C or more.
  - **The rule this creates: things only brown or caramelize when they aren't sitting in water.** That's the real reason behind sautéing first, and it's the game's first big eureka moment.
- **Boiling.** At 100 °C, steam bubbles spawn at the bottom, rise, and pop at the surface. Each pop removes a little water (*reduction*: the remaining flavor gets more concentrated) and some aroma.
  - Simmering (dial 3–5) means a few bubbles. A rolling boil (8–10) means lots of bubbles and churning.
- **Lid.** Steam that hits the lid condenses back into water, so there's no reduction and aroma is kept. The pot heats up about 30% faster. Foam can build up and boil over when the lid is lifted. Sudden steam plume!
- **Ambient cooling.** Surface cells lose heat to the air, so turning the heat off cools the pot slowly.

### 3.4 Dissolving & Diffusion

- Soluble powders (salt, sugar, bouillon, miso) dissolve over time when they touch liquid. Dissolving is faster when the liquid is hot or stirred.
  - The powder cell disappears and adds its flavor vector to the liquid cell.
- Chunks **leach** flavor into the surrounding liquid as they cook. The rate rises with temperature and with how far the chunk has broken down.
- The flavor field diffuses slowly between neighbouring liquid cells and quickly while you stir.
  - **Unstirred soup is unevenly seasoned.** Tasting the top and the bottom gives different results, which is a gentle hint to stir.

---

## 4. Flavor Chemistry

### 4.1 The Flavor Vector

Every ingredient has a base profile, and the liquid carries the dissolved version of it.

| # | Axis | Notes |
|---|---|---|
| 0 | **Salty** | |
| 1 | **Sweet** | |
| 2 | **Sour** | Acid |
| 3 | **Bitter** | Mostly from burning, over-steeping and overcooking |
| 4 | **Umami** | Has *synergy* (see §4.3) |
| 5 | **Richness** | Fat and gelatin. Mouth-coating body |
| 6 | **Heat** | Capsaicin and pepper. Dissolves much better in fat than in water |
| 7 | **Aroma** | Intensity, plus a set of **aroma notes** (below) |

**Aroma notes** are tracked per pot rather than per cell, to save memory. They're a bag of tags with intensities:

`allium`, `herbal`, `toasty` (Maillard), `caramel`, `smoky`, `citrus`, `earthy`, `warm-spice`, `oceanic`, `funky` (fermented), `burnt`.

**Aroma is volatile.** Every steam bubble that pops removes some aroma, and fresh herbs lose aroma fast. This creates the real rule: **add delicate aromatics at the end.**

**Texture is measured separately from flavor:**
- **Body / viscosity** comes from starch, roux, gelatin, cream and pureed vegetables. A thick liquid moves more slowly in the simulation: its spread rate drops.
- **Chunkiness:** the share of intact chunk cells.
- **Clarity:** how much suspended particulate and emulsified fat there is (cloudy vs. clear broth).

### 4.2 Perceived Taste (what the Taste tool shows)

Raw values go through interaction rules before they're shown. These are real perception effects:

| Rule | Effect |
|---|---|
| Salt suppresses bitterness | `bitter_perceived -= k * salty` |
| Salt boosts sweet and umami | Small multiplier |
| Acid "brightens" | Raises perceived aroma and cuts perceived richness: rich soups feel heavy without acid |
| Sweet balances sour and heat | Each partly masks the other |
| Fat carries heat | Heat felt = heat in fat × 1.0 + heat in water × 0.4 |
| Too much of any axis | Past a threshold, it dominates and suppresses everything else ("all I taste is salt") |

### 4.3 Umami Synergy (signature eureka moment)

Glutamate (tomato, kombu, parmesan, soy, miso) combined with nucleotides (meat, bonito, dried mushroom, anchovy) is **multiplicative, not additive**:

```
umami_perceived = glu + nuc + SYNERGY * glu * nuc
```

Each umami ingredient is tagged `glu` or `nuc` internally. Kombu plus bonito tastes enormously better than either one alone. This is the real science behind dashi, and the game should celebrate it with a "✨ Umami Synergy!" discovery popup.

### 4.4 Deliciousness Score (hidden in Sandbox; shown when tasting)

`delicious = balance + complexity + texture_fit - flaws`

- **balance:** penalises any axis that sits far from the others, and penalises the soup being bland (too little total flavor) or overwhelming.
- **complexity:** the number of distinct aroma notes above a threshold, with diminishing returns. Five or six different notes is great. Fifteen is mud.
- **texture_fit:** in the sandbox, simply rewards body that isn't watery. In Phase 2 it's replaced by matching the target dish.
- **flaws:**
  - burnt
  - curdled
  - raw flour taste
  - mushy overcooked noodles
  - slimy kombu
  - grainy cheese
  - excess grease

---

## 5. Ingredients & Reactions

### 5.1 Starter Ingredient Shelf

**Liquids**
- Water
- Stock (unlocked by *making* it, see below)
- Oil
- Butter (a solid that melts into fat)
- Milk
- Cream
- Wine
- Vinegar
- Lemon juice
- Soy sauce
- Coconut milk

**Powders**
- Salt
- Sugar
- Flour
- Cornstarch
- Black pepper
- Chili flakes
- Cumin
- Paprika
- Turmeric
- Baking soda
- Miso (paste; behaves like a sticky powder)

**Chunks**
- Onion
- Garlic
- Carrot
- Celery
- Potato
- Tomato
- Mushroom
- Beef
- Chicken
- Ginger
- Beet
- Bread

**Whole items**
- Egg
- Bones
- Kombu
- Bonito flakes
- Parmesan rind
- Fresh herbs
- Noodles
- Rice
- Ice cube

### 5.2 Reaction Table

Reactions are local rules: **inputs + conditions → outputs + flavor and visual changes**. Each one is a Journal entry. Until you discover an entry it appears as a silhouette with a vague hint.

| Name | Inputs & conditions | Result | Visual/feedback | Real lesson |
|---|---|---|---|---|
| **Sweat** | Onion/garlic/celery chunk + fat, 100–140 °C | Softens and turns translucent. Adds `allium` aroma and a little sweetness | Chunk turns pale and glossy | Gentle fat heat releases aromatics |
| **Caramelize** | Onion in fat, 120–160 °C, held for a long time with little water nearby | Deep brown, big `sweet` + `caramel`. Breaks apart into jammy cells | Slow gradient from white to amber to mahogany | Patience. Low and slow |
| **Burn** | Any organic cell above its burn temperature for too long (garlic burns fastest) | Black cells, `bitter` + `burnt`, smoke particles | Smoke, chef grimace | Watch your heat. Garlic goes last |
| **Sear / Maillard** | Meat chunk on a dry pot bottom above 150 °C | Browned crust, `toasty` aroma. Leaves **fond** cells stuck to the pot bottom | Sizzle sound, brown specks | Brown before you braise |
| **Deglaze** ✨ | Liquid (especially wine or stock) hits fond cells | Fond dissolves into a burst of `toasty` + `umami` | Hiss, steam puff, brown swirl | The best flavor is stuck to the pan |
| **Bloom** | Ground spice in hot fat (130–180 °C) for a short time | Aroma ×2–3. Heat dissolves into the fat | Spice cells glow and shimmer | Toast spices in oil |
| **Over-bloom** | Spice in fat above 180 °C, or held too long | Bitter, burnt aroma | Smoke | Seconds matter |
| **Roux** | Flour + fat, stirred, above 100 °C | Roux cells. Blond → brown with time (brown roux = more `toasty`, less thickening) | Paste-like texture | Fat coats starch |
| **Lumps** ✨ | Flour dropped straight into hot liquid with no fat | Flour clusters into lump chunks with a raw-flour flaw. Hard stirring slowly breaks them up | Pale blobs | That's *why* roux exists |
| **Thicken** | Roux or cornstarch slurry in liquid near a simmer | Raises viscosity, so the liquid visibly moves slower | The liquid's surface rolls more slowly | Starch needs heat to gel |
| **Potato starch** | Potato cooked to break-down | Releases starch → body. Overcooking makes it go to mush | Chunks crumble | Natural thickener |
| **Stock** ✨ | Bones (and/or mirepoix) simmered for a long time (dial 3–5) | Gelatin → `richness` + body. Liquid relabels as **Stock** and **unlocks Stock on the shelf** | Liquid turns golden | Low and slow extracts gelatin |
| **Cloudy stock** | Bones at a hard boil | Fat emulsifies → clarity drops | Liquid turns milky | Simmer, don't boil, for clear stock |
| **Scum** | Meat or bones heating up in water | Grey foam forms on the surface. Skimming it raises clarity | Floating foam | Skim your stock |
| **Mirepoix** ✨ | Onion + carrot + celery sweated together in fat (co-located within radius *r*) | Named combo with a bonus: more aroma complexity and sweetness | Combo banner | A foundation with a name |
| **Sofrito / Holy trinity** | Onion + garlic + tomato in oil, or onion + celery + pepper | Regional combo variants with their own bonuses | Combo banner | Cuisines share structures |
| **Tomato breakdown** | Tomato chunk above 90 °C | Collapses into red liquid. Adds `sour` + `umami` (glu) and red color | Chunk melts and the broth turns red | Cooked tomato = umami |
| **Dashi** ✨ | Kombu steeped at 60–90 °C, removed (skimmed), then bonito added | Massive umami synergy, `oceanic` aroma, clear | Golden-clear broth | Temperature control |
| **Slimy kombu** | Kombu boiled at 100 °C | Slimy texture flaw + bitter | Stringy green strands | Never boil kombu |
| **Miso killed** | Miso held at a boil | Loses aroma (the `funky` note fades) | Aroma wisps vanish | Add miso off the heat |
| **Curdle** | Milk/cream + acid at high heat, or milk at a hard boil | Splits into curd particles and whey. Flaw | White specks in clear liquid | Temper dairy, add acid last |
| **Temper** ✨ | Dairy added at low heat and stirred in gradually | Smooth, creamy body, no curdle | Silky surface | Patience with cream |
| **Egg drop** ✨ | Egg poured in a thin stream into simmering broth that is being stirred | Silky yellow ribbon cells | Gorgeous ribbon trails | Stream + swirl |
| **Scrambled egg** | Egg dumped into a hard boil without stirring | Rubbery clumps | Blobs | Same inputs, different technique |
| **Noodle cook** | Noodles in boiling water | Absorb water and swell. Cooked → perfect → mush over time. They release starch, which adds body | Strands soften and droop | Timing |
| **Rice porridge** | Rice simmered for a long time in lots of water | Breaks down into thick congee | Liquid turns opaque white | Starch + time |
| **Fizz** ✨ | Baking soda + acid (vinegar or lemon) | Explosive CO₂ foam that can overflow the pot | Volcano! Foam spills over the rim onto the flames, which hiss | Pure fun. Mild soapy flaw |
| **Flambé** ✨ | Wine (alcohol) in a hot pot meets a flame, either from an overflow onto the burner or with dial ≥ 9 and no lid | A sheet of fire on the surface burns off the alcohol and adds a mellow `caramel` note | Big blue-orange flame burst, chef shrieks and then grins | Burns off harsh alcohol |
| **Grease fire** | Oil above 230 °C | Fire cells spread across the oil | Chef panics. **Lid smothers it; water makes it WORSE** (splatter + bigger fire) | Never water on a grease fire |
| **Splatter** | Water poured into oil hotter than 150 °C | Droplets shoot out of the pot | Pops and spits | Why oil "spits" |
| **Beet dye** | Beet chunk in liquid | Stains neighbouring liquid magenta. With acid it stays vivid red; without acid, long cooking turns it brownish | Spreading color shows the convection currents | Acid fixes color (borscht) |
| **Turmeric dye** | Turmeric in liquid | Gold stain. Turns reddish with baking soda (a pH indicator!) | Color shift | Hidden chemistry surprise |
| **Cheese melt** | Parmesan/cheese at gentle heat | Richness + umami (glu) | Melty strands | |
| **Cheese seize** | Cheese at a hard boil | Grainy, greasy clumps. Flaw | Oil slick + grit | Gentle heat for cheese |
| **Bread soak** | Bread chunk in liquid | Floats, absorbs liquid, then sinks and thickens the soup (panade) | Swells and sinks | Old-world thickener |
| **Ice shock** | Ice cube dropped into boiling soup | Local temperature crash and the boil stops in that area | Steam burst, then a calm zone | Thermal mass |
| **Emulsion** | Fat + liquid + vigorous stirring (+ egg yolk or mustard as a stabilizer) | Fat stays suspended → creamy and opaque | Oil beads disappear | Emulsifiers hold fat |

✨ = headline eureka discoveries, which get a full-screen-ish celebration the first time.

### 5.3 Eureka Design Rules
- **Every reaction has a visible tell and a sound.** Players notice things, then experiment on purpose.
- **Journal silhouettes give hints without spoilers.** For example: *"Something about wine… and fire…"* or *"Flour behaves better with a friend…"*
- **Paired outcomes:** most reactions have a "good" twin and a "bad" twin with the same ingredients but a different technique (temper/curdle, egg drop/scramble, simmer/cloudy, steep/slimy). When you discover one, the game hints at the other.
- **The chef is a hint channel.** He reacts *before* something goes wrong: he sweats, eyes the garlic nervously, or reaches toward the dial.
- **Taste often.** The readout explains *why*: "Rich but heavy. Something sharp would lift it." That pushes you toward acid.

---

## 6. Taste Readout

Click Taste on any liquid cell. The chef sips, then a card pops up:

- A **radar chart** of the 8 axes (perceived values).
- The **top 3 aroma notes** as small icons.
- **Texture bars:** body, chunkiness, clarity.
- A **chef reaction face** with one line of feedback drawn from the biggest imbalance or flaw. Examples:
  - "Flat… needs salt."
  - "Too sharp, a pinch of sugar?"
  - "Ooh, the trinity!"
- A **deliciousness stars** readout (in Sandbox it's for fun; in Phase 2 a different score is used, see §8).

---

## 7. Phase 1 Scope (Sandbox MVP)

**Build order:**

1. Canvas, grid and loop. Water, sand-like salt and walls. Pouring at the cursor.
2. Pot frame art, flame rendering, heat dial, temperature field, boiling and steam.
3. Chef sprite: idle, pick up, pour following the cursor. The pour stream is drawn from his hand.
4. Chunk clusters (rigid groups) with break-apart.
5. The flavor field plus the Taste tool and readout.
6. Reactions in priority order:
   - Sweat / caramelize / burn
   - Dissolve
   - Bloom
   - Sear / fond / deglaze
   - Roux / lumps / thicken
   - Stock
   - Egg drop
   - Curdle
   - Fizz
   - Flambé
   - Grease fire
7. Ladle, lid, skimmer.
8. Journal with silhouettes and the discovery celebration.
9. Sound: bubbles scale with the boil, plus sizzle, hiss, pop, and chef voice blips.

**Tech:** a single-page HTML5 Canvas + vanilla JS (or TypeScript with Vite), using typed arrays for all grid state. No physics library. The sprites and pixel art should be drawn in a sprite sheet. Save/load the pot state to `localStorage` so players can keep a soup for later.

---

## 8. Phase 2: Kitchen Mode (Gamified)

### 8.1 Core Loop

1. A **dish ticket** arrives (from a customer, a critic, or a cookbook page).
2. You cook it with any techniques you like. There's an optional soft timer.
3. Press **Serve**. The chef ladles a bowl from the pot.
4. **Scoring reveal:** your radar chart is overlaid on the target's. Texture and required elements are checked. You get 1–3 stars plus a short critic quote.
5. Stars unlock new ingredients, tools (e.g. an immersion blender) and dishes.

### 8.2 What a Dish Target Contains

```js
{
  id: "french_onion",
  name: "French Onion Soup",
  flavor:   { salty: .5, sweet: .7, sour: .15, bitter: .05, umami: .6, rich: .5, heat: 0, aroma: .7 },
  aromaNotes: ["caramel", "allium", "toasty"],
  texture:  { body: .4, chunk: .3, clarity: .5 },
  required: ["caramelize:onion", "liquid:stock"],   // states/reactions that must exist in the bowl
  forbidden:["burn", "curdle"],
  bonus:    ["deglaze:wine", "bread_soak"],          // optional style points
  tolerance: .15,
  hint: "The onions take longer than you think. Much longer."
}
```

### 8.3 Scoring

- **Flavor match (50%):** weighted distance between the perceived vectors. Axes the dish cares about get higher weight. Within `tolerance` counts as perfect.
- **Aroma notes (15%):** overlap between your top notes and the target notes.
- **Texture (15%):** distance on body, chunkiness and clarity.
- **Required elements (20%):** each required reaction/state found in the served bowl. A **forbidden** state caps the result at 1 star.
- **Bonus** elements add a flourish line from the critic and +5% each.
- **Stars:** 1★ ≥ 50%, 2★ ≥ 75%, 3★ ≥ 90%.

The scoring reveal *teaches*. Gaps are called out specifically: "Your soup was 30% less sweet, so the onions needed more time."

### 8.4 Dish List (ordered roughly by difficulty)

| Dish | Key skills it teaches |
|---|---|
| **Salty Broth** (tutorial) | Pour, heat, salt, taste, stir |
| **Egg Drop Soup** | Simmer + stir + thin stream technique |
| **Miso Soup** | Dashi (kombu temperature!) and adding miso off the boil |
| **Tomato Soup** | Tomato breakdown, sweet/acid balance, a cream temper finish |
| **Chicken Noodle** | Stock from bones, mirepoix, noodle timing (don't overcook) |
| **French Onion** | Long caramelization, deglazing with wine, bread soak |
| **Borscht** | Beet color + acid to keep it red, sweet/sour balance |
| **Minestrone** | Many vegetables, sofrito, parmesan rind umami, good chunkiness |
| **Clam Chowder** | Roux, potato starch, dairy without curdling |
| **Tom Yum** | Sour + heat + citrus aroma. Lime added at the end, not boiled |
| **Pho Broth** | Clear stock (simmer + skim), bloomed warm spices, charred onion |
| **Gazpacho** (joke level) | Score 3★ by **never turning on the burner** |
| **Mystery Soup** | Only a taste profile is given. Reverse-engineer it |

### 8.5 Modes & Meta

- **Cookbook campaign:** a linear set of dishes with chapters that introduce one technique each.
- **Dinner rush:** several tickets with timers. Customers have quirks: "less salt please," "extra spicy," "no dairy."
- **Critic visits:** hard dishes where the 3★ quotes are unlocked collectibles.
- **Daily soup:** a seeded mystery profile, the same for everyone. Share your score and the radar image.
- **Chef's intuition:** a limited hint resource. It reveals one missing required element, or one axis to fix.
- **Sandbox carries over:** Journal discoveries from Phase 1 persist. Some dishes need a technique that you can only discover in Sandbox, and the hint points you there.

---

## 9. Open Questions

1. **Art direction:** palette (warm 32-color? PICO-8-ish?), chef design and name.
2. **Ladle physics:** should stirring only displace cells, or also create a lasting vortex current?
3. **Chunk cutting:** do we need a "dice size" choice (bigger chunks cook more slowly), or is that too much UI?
4. **Platform:** web only, or also wrap it for desktop/mobile? Touch controls change how pouring works.
5. **Pot size options:** a small saucepan vs. a big stockpot, as an unlockable that changes how the heat behaves?
6. **How realistic the chemistry should be vs. how readable:** where do we simplify for fun? (Proposal: real direction, exaggerated speed. Caramelizing takes about 60 s, not 45 min.)

---

## 10. Art Direction (decided)

- **Soup simulation:** flat 2D pixel art, Noita-style. One cell = one pixel, with per-cell shade variation.
- **Everything around it is chunky "semi-3D" pixel art:** kitchen, stove, pot, flames, chef, ingredient icons, and the judges' table. Forms are shaded with a top-left light, rims are drawn as ellipses, and surfaces like countertops and stovetops are shown in perspective.
  - Tone: Overcooked-style simplicity and cuteness.
- **Chef:** round, cute and bobbly, with a tall toque, rosy cheeks, dot eyes and a mustache.
- **Text:** a pixel font drawn at screen resolution, so it stays crisp.

## 11. Judging: "The Chop" (both phases)

When you're done cooking, press **SERVE**. The chef ladles a bowl and carries it to a judges' table (Top Chef / Chopped style).

- **Three animal judges**, each tasting from a different perspective:
  - **Sir Pounce**, a monocled tabby cat (the Classicist): technique, balance, seasoning precision, texture, flaws (burnt, curdled, lumps).
  - **Biscuit**, a floppy-eared dog (the Flavor Hound): boldness, umami, acid, heat, aromatic complexity. Bland soup is an insult.
  - **Nanny Mae**, a goat in glasses (Comfort): warmth, richness, sweetness, heartiness. Wary of extreme heat or sourness.
- Each judge tastes in turn and gives 1–2 flavor notes in their own voice, plus a 1–10 score card.
- **Verdict:**
  - Average below 5: **CHOPPED** (cleaver slam).
  - 5 to 7.4: "Safe… this round."
  - 7.5 or higher: **WINNER**.
- **Phase 1:** the judges score general deliciousness through their own lenses.
- **Phase 2:** the dish brief is added. Each judge also weighs how close the soup came to the target dish.

## 12. Whole Items: Eggs and Fish (implemented)

- **Egg:** the chef holds a whole egg. You use it one click at a time:
  - **Click the rim** to crack it.
  - **Then click over the pot** to drop the contents in: a soft blob of white with a yolk.
  - **Click over the pot without cracking** to throw the whole egg in, shell and all.
- **What happens to a thrown egg:**
  - It cracks on a hard landing (dry or shallow pot): shell shards scatter (a crunchy flaw) and the insides spread out.
  - Deep liquid cushions it, so it survives whole and can **hard-boil** in its shell.
- **What happens to a cracked egg (a soft blob that holds together and slumps):**
  - Left alone in simmering broth, it **poaches**.
  - In hot oil, it **fries**.
  - Stirring tears it into strands, which cook into **egg-drop ribbons**. Crowded strands **scramble**.
- **Fish:** thrown in whole as one firm piece (body, fins, eye).
  - Poached, it turns opaque, then **flakes** apart.
  - Seared on a hot, dry pot, its skin goes **crispy**.
  - It adds umami, richness and an `oceanic` note.

## 13. Plating and Non-Soup Judging (implemented)

- **Plated presentation.** At serve time, every piece in the pot is captured with its real shape and cooked color (`js/plating.js`).
  - **Soups and stews:** the pieces float in a bowl over the broth's actual average color, half-submerged.
  - **Dry dishes:** the pieces are piled on a flat plate over any oil sheen or pan sauce.
  - Loose bits (ribbons, seasoning grains, shell) are scattered as specks.
- **Judging any dish.** `Taste.analyzeBowl` tastes every edible cell, not just the broth:
  - **Pieces** carry their own flavor (`EAT` in `materials.js`), adjusted for browning or rawness and for how much they've already leached into the broth.
  - **Glaze:** a sauce that reduces or splatters onto food leaves its flavor there.
  - **Weighting:** pieces count 4× as much as a broth cell.
  - **Seasoning:** a grain of salt counts as fully salty whether or not it dissolved.
  - **Dish types:** `soup`, `stew`, `plate` or `empty`.
  - **Plates** are judged on sear (crust) and doneness instead of body. They can carry more oil before reading greasy, and salt on a plate is seasoning, not grit.
- **Supporting chemistry:**
  - Fat extracts aromatics but little umami or salt.
  - Browning speed is set per ingredient: meat and fish sear slowly, so there's a real window between seared and overcooked.
  - Anything sizzling on a hot pan releases its aroma note.

## 14. Backlog

- **Tune frying amounts for plates.** Oil pours about 280 cells in 1.5 s, which drowns a small plate. A 0.2 s salt pinch (about 24 grains) over-salts a 150-cell plate. Options: a slower oil bottle and a smaller shaker pinch, or rescaling the `frying.json` amounts. 12 of the 16 fry recipes currently fail, mostly on greasy, rich or salty targets.

## 15. Dough, Baking and Saturation (implemented, `js/dough.js`)

- **Saturation.** A cell of water holds only so much salt (about 15) or sugar (about 25). Dissolving slows as nearby water concentrates, and past saturation the grains settle out as sediment ("Saturated" discovery).
- **Flour doesn't dissolve, it hydrates.** A flour grain touching any liquid (water, milk, wine, soy, vinegar, raw egg, soured-milk curds) becomes a **dough** cell. The dough takes the liquid's dissolved flavors with it and uses up the liquid as it soaks it in. Dry flour pulls water from wetter dough, so adding flour stiffens it. Cold oil rubbed into flour makes a crumbly shortcrust.
- **Dough composition** lives in each cell: `F_WATER`, `F_EGG`, `F_LEAVEN`, `F_GLUTEN`, `F_SODA`, plus salt, sugar, fat and so on. Neighboring dough evens out its make-up, much faster while stirred. Its texture comes from water per flour:

| Water per flour | Texture | How it moves |
|---|---|---|
| < 0.35 | Crumbly | Trickles like sand |
| 0.35–0.9 | Dough | Sticks together and slowly slumps into a mound |
| 0.9–1.6 | Sticky | Slumps faster |
| 1.6–4 | Batter | Pours and spreads |
| > 4 | Too thin | Melts into the soup as a thickener |

- **Absorbing more:** dough takes in more liquid, oil (fat), egg (water, structure, yolk fat), salt and sugar. Salt is ~10x stronger than sugar by weight. Shaped dough soaks up water only slowly, and in hot liquid it forms a skin, so dumplings hold together.
- **Kneading:** stirring dough builds gluten.
- **Leavening:**
  - Baking powder releases gas with heat.
  - Baking soda needs acid in the dough (vinegar, soured milk) to make gas. Heated without acid, it breaks down into a little lift and a soapy taste ("Soapy").
  - Gas pushes the dough up and outward. How much it holds depends on gluten and egg; thin batter lets it escape. The gas is conserved, not duplicated.
- **Baking:**
  - Dough over 90°C sets into **BREAD**, and connected cells join into one solid piece.
  - Only the outer surface browns into a crust; the inside stays pale crumb with air pockets.
  - **Pot oven:** with the lid on, the air in the pot reaches about 85% of the pot's temperature, so dough bakes from all sides.
  - Dough set in simmering liquid becomes **dumplings**: pale, soft and puffy.
- **Judging bakes:** dishes that are mostly dough or bread get the `baked` type, with a report covering rise, doneness, crust, burnt bottom, texture (water), sweetness, richness, egg, gluten and leftover soda. Each bake is named by its make-up and cooking method: bread, flatbread, cake, cookie, pancake, crêpe or dumplings. Each judge has their own take on it, and bakes are served on a plate.
- **New pantry item:** Baking Powder.
- **New discoveries:** Saturated, Dough!, Batter, Kneading, It Rises!, Fresh Bake, Golden Crust, Pot Oven, Dumplings, Soapy.

## 16. Career Levels (implemented, `js/levels.js`)

Each career level is a recipe the judges know. A level lists:

- **Ingredients** the recipe calls for.
- **Techniques:** discoveries that must happen in this pot, such as `bloom`, `roux` or `flake`.
- **Avoid:** discoveries that count against you, such as `herbloss` for boiled herbs.
- **Forbidden flaws**, such as `curdled` in a chowder or `mushy` in a minestrone.
- **A par recipe:** the reference way to cook the dish.
- **Mistakes:** variants of the par that must score lower.

`tools/build-levels.js` cooks every par on several seeds and writes the mean perceived taste into `js/level-targets.js`. Targets therefore always follow the current chemistry. It then checks that every par earns 3★ and every mistake earns fewer. Run it after any chemistry or perception change.

**Scoring:** each level is judged 0–10 by its tier's panel. See §17.

**Teaching feedback** comes from the judges, not a summary line:
- The judge who weighs the recipe most names a missing technique, slip or ingredient.
- Another judge names the biggest taste gap ("Not salty enough for a tomato soup.").
- Flaws come up in the judges' own complaints, and flourishes in their praise.

The result also keeps these notes for tools (`build-levels.js` prints them):
- the biggest taste gap ("It was less salty than the recipe.")
- each missing technique with its journal hint
- any slips
- missing ingredients
- forbidden flaws
- flourishes

**The 10 beta levels:**

| Tier | Level | Teaches | Must happen |
|---|---|---|---|
| 0 | Tomato Soup | heat and seasoning | sweat, tomato melt, seasoning (herbs not wilted) |
| 0 | Creamy Corn Soup | thickening and gentle dairy | sweat, thicken (potato); no curdling |
| 0 | Pan Flatbread | dough and browning | dough, bake, golden crust |
| 0 | Fish Stew | layering and timing | sweat, tomato melt, flaky fish |
| 0 | Minestrone | timing many ingredients | mirepoix, tomato melt; pasta neither raw nor mushy |
| 1 | French Onion Soup | patience | caramelize, deglaze |
| 1 | Beef Chowder | roux, starch and dairy | fond, roux, thicken; no curdling or lumps |
| 1 | Goulash | browning and blooming spice | caramelize, fond, bloom |
| 1 | Pot-Oven Sponge Cake | baking chemistry | batter, rise, bake, pot oven |
| 1 | Chili con Carne | heat, spice and a long simmer | fond, bloom, tomato melt |

**New ingredients for these levels:**

- **Corn:** sweet kernels that stay intact.
- **Potato:** softens slowly, then collapses into the soup and thickens it.
- **Beans:** savory, hold their shape (a mix of pinto and kidney, for minestrone and chili alike).
- **Small pasta:** al dente after about 40 s of simmering, and mushy (a flaw) if left far longer.

Starchy pieces count as "raw" until well softened. Deeply caramelized onions now leave fond on the pot bottom, as meat does.

## 17. Career Judging (implemented, `js/judges.js` and `js/levels.js`)

**Progression:**
- **Tiers are the arrangement of levels.** Passing all 5 Pizza Shop levels opens the 5 First Michelin Star levels.
- **Each level is judged 0–10.**
  - 6 or more passes the level; below 6 is chopped.
  - 8 or more earns the **Good Soup** badge.
  - A perfect 10 earns the **Perfect** badge.

**Score:**
- **Each judge blends.** Every judge gives their own 0–10, and the level score is the panel's average. A judge's score is 9 × (match + recipe + taste, each weighted), where:
  - **match** is how close the taste is to the par recipe's (§16)
  - **recipe** is the recipe's techniques and ingredients, half each
  - **taste** is the judge's own taste score relative to how they scored the par recipe, capped at par

  | Judge | Match | Recipe | Own taste |
  |---|---|---|---|
  | Joe | 20% | 10% | 70% |
  | Biscuit | 30% | 20% | 50% |
  | Nanny Mae | 30% | 20% | 50% |
  | Sir Pounce | 35% | 35% | 30% |
  | Gordo Hamsie | 25% | 45% | 30% |
  | Paul Bollywood | 30% | 30% | 40% |

  The par recipe cooked flawlessly therefore scores exactly 9. `tools/build-levels.js` records each judge's own taste of the par in `js/level-targets.js`.
- **Soft caps:**
  - A missing required ingredient or technique caps the score below 8 (no badge, but you can still pass).
  - A forbidden flaw caps it below 6 (chopped).
- **Not the dish at all:** the dish is wrong if any of these hold:
  - one of the level's defining ingredients is missing (fish for fish stew)
  - fewer than half the recipe's ingredients went in
  - it's the wrong kind of dish (a soup for a cake)

  Each judge then says it isn't the dish, in their own voice ("WHERE'S THE FISH?! This is NOT a FISH STEW!"), and scores it out of 3 on taste alone.
- **Mixed verdicts read as one thought:** praise and criticism are joined with "but" or "however" ("A lovely crust. But under-seasoned.").
- **A perfect 10 takes par plus a flourish.** A flawless par recipe lands around 9.
  - **Flourish:** an extra ingredient not in the recipe.
  - It earns a bonus only if the judges' taste score beats the par recipe's (precomputed by `build-levels.js`).
  - Each judge who liked it adds 1 to their own score and calls it out. A judge who loves the flourish doesn't count its drift from par against the match.
  - The tomato soup's known flourish (a pinch of chili) wins over all three tier-0 judges and can reach 10.

**Panels:**

| Where | Judges |
|---|---|
| Tier 0, Pizza Shop | Biscuit (dog), Sir Pounce (cat), Joe |
| Tier 1, First Michelin Star | Gordo Hamsie, Paul Bollywood, Sir Pounce |
| Sandbox | 3 picked at random from all six judges, Nanny Mae included |

**Dev hashes,** until the level select screen exists:
- `#level=chili` plays a level: serving judges it against the recipe.
- `#panel=joe,gordo,paul` seats a panel.
- These combine with the preview views, e.g. `#verdict&level=goulash`.

**New judges:**
- **Joe, the regular.** A friendly pizza-shop regular in a ball cap and hoodie, and a fair customer. He scores "would I order this again?": overall balance, warmth, filling, no flaws. Plain-spoken and honest.
- **Gordo Hamsie, the head chef.** A satirical human caricature: spiky blond hair, a deeply furrowed forehead, chef whites, and a face that goes red when angry. An execution perfectionist who cares about raw, burnt, mushy, under-seasoning and sloppy technique. He rants in caps with bleeps that keep the first letter (S\*\*\*!) and creative insults.
- **Paul Bollywood, the master baker.** A lookalike of the famous baker: tanned, with short cropped silver hair, a short silver beard and goatee, piercing blue eyes and a dark open-collar shirt. He judges bakes (rise, crust, crumb) and spice (bloomed versus raw, heat balance). His rare **Bollywood handshake** goes to a dish he scores 9 or more *and* loves by his own taste (9+), with its own animation of him reaching across the table. On the tier-1 pars only the goulash and the chili, with their bloomed spices, earn it.

## 18. Heat on the Pot Bottom (implemented)

- **Moist vegetables are held down.** Onion, carrot and celery stay near 110 °C while they still hold water. They only climb toward the pan's temperature as they brown and dry out.
- **Two stages, both faster on a hotter pan.** They sweat soft, then brown toward caramelized. Onions are the slow ones: about 2½ minutes at heat 5 and 1½ at heat 6.
- **"Caramelization" needs a real share of the batch.** It's discovered once 35% of the onions, carrots and garlic have browned, not at the first browned sliver.
- **Browned flavor ramps in from golden.** Vegetables start giving browned flavor at golden (cook about 120) and give it fully at deeply browned (about 170).
- **Browning stops at deep brown (cook 230).** Only scorching takes food further.
- **Scorching comes from contact with the hot metal, or smoking-hot oil.** Each scorch pushes a piece toward char, faster the further past its burn point it is. Onions burn from 175 °C, so:
  - heat 7 needs an occasional stir
  - heat 8 needs regular stirring
  - heat 9 chars an unattended pot quickly
- **Stirring prevents burning.** It spreads the contact around and brings cooler, moist food down onto the metal. An unstirred bottom layer dries out and chars first.
- **Char sticks.** Burnt bits on the pot bottom are welded on: currents can't move them, and each ladle pass scrapes only a little loose (more with a hard stroke). Scraping it into the soup spreads its bitterness.

## 19. Level Select (implemented, `js/menu.js`)

**The board:** the game opens on level select, styled as a kitchen pass.
- Each tier is a steel ticket rail of 5 order tickets: the dish's key ingredient, its name, the best score ("NEW" if unplayed) and stamps.
  - A green check means passed. One gold star is Good Soup, two are Perfect. A small handshake mark is Paul's handshake.
- Locked rows show face-down, padlocked tickets.
- Hovering a dish shows its description. **Sandbox** sits under the rails.

**Unlocking:** tier 0 is always open. A tier opens once every dish in the tier before it is passed (6+), and the dishes within an open tier play in any order. Tiers 2 and 3 are "coming soon".

**Saving:** progress lives in the browser (`localStorage`, key `soupgame.progress.v1`). It keeps each dish's best score, passed state, best badge and whether it ever earned a handshake. The game still plays if storage is unavailable; it just doesn't remember.

**In a level:** the dish name replaces "SOUP POT" at the top. Its order ticket (name and description only; you work out the method) opens at the start, and clicking the name brings it back. The **Levels** button in the tools panel returns to level select.

**After serving:**
- **Levels:** Retry, Next Dish (only when you passed; the next dish on the board, if its tier is open) and Level Select.
- **Sandbox:** Keep Cooking, New Pot and Level Select.
- **Scores run 0–10.** Serving an empty pot in a level scores 0 and is chopped.
- **Dev:** a small RESET button on the board wipes saved progress (click twice).
- Unlocking a tier flashes a notice on the board.

## 20. Searing and Doneness (implemented)

- **Seared** (the Maillard reaction) is the savory counterpart to Caramelization. It's discovered when meat, potatoes, corn, beans or pasta brown on hot metal or in fat, not while softening in water: at least 6 browned cells and 15% of those foods.
  - Aromatics caramelize instead, fish gets Crispy Skin, and bread gets a Golden Crust.
- **Sweating** is only for aromatics: onion, garlic, carrot and celery going soft in gentle fat.
- **The taste spoon reports doneness** for the pieces near where you sip, e.g. "Texture: pasta al dente · beans firm". The bands match the judges' raw and mushy thresholds:

  | Ingredient | Bands |
  |---|---|
  | Pasta | hard, almost, al dente, overdone, mush |
  | Beans | hard, firm, creamy, falling apart |
  | Potato | raw, crunchy, tender, falling apart |
  | Carrot | raw, crisp, tender, browned |
  | Beef | raw, pink, cooked, seared, charred |
  | Fish | raw, translucent, flaky, dry |
  | Onion | raw, crunchy, soft, caramelized, dark |

## 21. Fire, Mess and the Ladle (implemented)

**Grease fire.**
- Once oil catches (past its smoke point, uncovered), the fire burns wherever hot oil is open to the air.
- It builds over roughly 10 seconds, throws flames up and out of the pot, keeps its own oil hot and burns through it slowly (minutes).
- The kitchen glows orange while it burns.
- **Putting it out:**
  - The lid smothers it within a second or two and keeps the pot from reigniting for a few seconds after.
  - The extinguisher does the same.
  - Turning the burner off doesn't put it out: the fire is its own heat source. It holds the burning surface at 200 °C or more and keeps the pot hot.

**Disasters (rare).**
- **Fireball:** water poured onto burning oil throws a fireball. The screen shakes, the chef is sooted, and it becomes a kitchen fire. (The "Fireball!" discovery.)
- **Kitchen fire:** a full-strength grease fire left burning for about 15 seconds climbs the wall and hood. Black smoke rolls along the ceiling, soot builds on the wall and the chef's face, and it rages until the lid or extinguisher puts it out. The soot stays until a fresh pot. (The "Kitchen Fire" discovery.)

**Flying food.**
- A piece flung out of the pot flies out whole, every cell on the same path, then bounces on the stovetop, rests a while and fades.
- Flung food and splatter that reach the chef can stain his whites and face; it clears with a fresh pot.

**The ladle.**
- It comes out when the cursor first enters the pot, then follows the cursor everywhere, held up in the air away from the pot.
- Moving it through the pot stirs; no click is needed.
- Just outside the walls or bottom, it presses against them to scrape.
- Clicking an ingredient or any control puts it away until the cursor enters the pot again.

**Tasting.**
- With Taste, the chef holds a little spoon that follows the cursor in the kitchen; his arm stretches down into the pot to reach it.
- Clicking in the food takes a sip of the whole pot (flavor and the texture of what's in it). He lifts the spoon to his mouth.
- If the pot is badly unmixed (some part of the broth more than 4× as strong as the pot's average, e.g. salt or soy just poured and not stirred), the card shows question marks and asks you to stir.
- Over the menus he holds the spoon up at his lips, pondering. With the ladle, he stands at ease, hand on hip, ladle held upright.

## 22. Title Menu and Story (implemented, `js/story.js`, `js/menu.js`)

**Title menu:**
- **Story** opens level select. The first time, Papa Dom's intro plays first.
- **Sandbox** is free play.
- **Settings** holds Reset Progress (click twice). It wipes scores, badges and which story scenes you've seen.

Level select has a Back button to the title. In sandbox, the tools panel's Menu button and the results screen's Menu button return to the title. In a level they go to level select.

**Story scenes** end at level select. They are character portraits under a dramatic vignette with typed-out dialogue (click to advance, Esc to skip), picture shots of about 2.5 s, and fades between. Each plays once.

| Scene | When | Beats |
|---|---|---|
| `intro` | First time you open Story | **Papa Dom**: the shop is struggling, "we need to innovate". **The shop at night:** neon PAPA DOM'S PIZZA with a sputtering letter, a rat crossing the pavement. **Dom** promotes you from lowly employee to head chef: a huge soup pot from Craigslist, a pile of ingredients and his nonna's old recipe book. "Find something truly delicious that brings customers in the door." |
| `pizzaDone` | First time every Pizza Shop dish is passed | **Dom**: "You did it!" **The shop by day** with a line out the door. **Dom**: "This place ain't a business. It's family." A **silhouette**: "Excuse me... could we talk for a second?" **Gordo Hamsie** has scouted you: "I'm launching a new show. Amateur chefs, competing for glory. It's called... SOUPED UP." The winner earns a Michelin star. |
| `showDone` | First time every First Michelin Star dish is passed | **Gordo**: "I didn't think you could do it!" Then a warning: don't beat any chefs you're not supposed to; embarrassing the wrong person would be a huge mistake. A **To Be Continued** card: "The next chapter is still cooking." |

**Papa Dom** is a satirical Vin Diesel lookalike, all about family: bald, stubbled, built like a truck, in a ribbed tank top, red apron and gold chain.

The **Pizza Shop tier** is cooked in Papa Dom's kitchen: a brick wall, Italian-flag bunting, a chalkboard menu, a glowing wood-fired oven and a pizza peel. The First Michelin Star tier and sandbox use the regular kitchen.

**Dev hashes:** `#story=intro`, `#story=pizzaDone`, `#story=showDone`.

## 23. Pantry, Tools and Kitchen Polish (implemented)

**The pantry** comes in rows of three:

| Rows | Items |
|---|---|
| Liquids | water, oil, cream; wine, vinegar, soy |
| Seasonings | salt, sugar, flour |
| Spices | chili, cumin, black pepper |
| Leaveners | baking soda, baking powder, yeast |
| Vegetables | onion, garlic, carrot; celery, tomato, potato; corn, beans, herbs |
| Proteins and the rest | beef, chicken, whole fish; egg, pasta, extinguisher |

- **Cream** is what the shelf calls the old milk (same behavior; its id stays `milk`, so recipes keep working).
- **Black pepper** is a spice: it blooms like the others and gives a gentler, more aromatic heat than chili.
- **Yeast** needs warmth and time.
  - In a warm, moist dough (about 25–60 °C, best around 32–46 °C) it slowly fills the dough with gas, faster with a little sugar. The dough proofs (the **Proofing** discovery) and roughly doubles.
  - Past 60 °C it dies, so a yeast dough put straight into a hot pot barely rises.
  - A dough can only hold so much gas, so a proofed loaf gets a normal oven spring.
  - Loose in liquid it just tastes faintly yeasty.
- **Chicken** goes from raw pink to poached white (cooked in water) to golden roasted, makes a golden stock, and sears. It has to be cooked through: undercooked chicken is a clear raw flaw.

**Tools.**
- There's no Pour tool: clicking a pantry item is pouring. Stir and Taste toggle (click again to put them down).
- The tools are Stir, Taste, Lid, Empty and **Quit** (with a sad face; back to level select, or the title in sandbox). Every button highlights on hover.
- The pantry's name bubble points right at the cursor.

**The Journal** has moved to Settings on the title screen; J opens it while cooking.
- It is a paged book, ten entries to a page, each with its full description (or a hint while undiscovered).
- Discoveries are saved across sessions.
- A technique you discover for the first time ever gets the full banner. After that, whenever it happens in a pot, a small toast slides in at the side of the kitchen.

**Tasting** works on solid food too (a sear, a bake): with no liquid in the pot, the spoon tastes the food the way the judges would.

**The lid.**
- It rattles only on a hard boil (heat 7 or more and really bubbling).
- Tasting with the lid on lifts it a little, steam escaping.
- The ladle comes to rest on top of it.
- Pouring onto a closed pot bounces everything off the lid and across the kitchen (and sometimes onto the chef).

**Emptying the pot** tips it over 45°, pivoting on its bottom corner. The contents drain from the top and the rim side first and stream out onto the floor, then the pot rights itself, empty.

**Story levels have a time limit:** the par recipe's cooking time × 1.5 plus a minute, rounded up to 30 s (3:00 for flatbread to 10:30 for goulash).
- A red LED countdown on the kitchen wall shows the time, and it blinks in the last 30 s. The order ticket lists the limit.
- When time runs out, the dish goes to the judges as it is.

**The First Michelin Star kitchen** is Souped Up's studio: the regular kitchen with a red "EVERY SECOND COUNTS" poster, painted in a tiny pixel font.
