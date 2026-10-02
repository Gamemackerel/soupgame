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
| Ladle tool | Drag in the pot to stir. Displaces cells along the drag vector and mixes the dissolved-flavor field |
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

## 13. Backlog (noted for later)

- **Plated presentation at judging.** When you serve, show a plated version of everything that went into the dish: pieces, garnishes, a whole fish, eggs and so on, not just a tinted bowl of liquid. Base it on what's actually in the pot.
- **Judge non-soup dishes.** Serving should work even with no water or liquid in the pot (a seared fish, fried eggs, sautéed onions). The judges should evaluate whatever is in front of them on its own terms (texture, browning, seasoning on the surface) instead of treating it as "an empty bowl". This replaces the current `empty` check (fewer than 200 broth cells) and the "side dish judged as soup" gaps in `test-recipes`.
