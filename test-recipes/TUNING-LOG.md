# Tuning Log

Each entry is a test that came out wrong, what was really at fault, and what changed. The categories match `tools/run-pairs.js`:

- **CHEMISTRY:** the pot did the wrong thing.
- **ANALYSIS:** the pot was right but perception or judging got it wrong.
- **RECIPE / CLAIM:** the test itself was wrong.

## Round 1 — comparison pairs introduced (2026-10-03)

The first run had 22 of 32 pairs passing. Every pair passes now (32/32 on seeds 1–3).

| Pair | Symptom | Real cause | Category | Fix |
|---|---|---|---|---|
| p01 sauté vs boil onion | Boiled onions had **more** caramel than sautéed | Pots **boiled dry**. Heat 9 lost 80% of the water in a minute: stacked bubbles skipped the "pop and re-condense" check and escaped as steam. Under a lid, steam piled up instead of condensing | CHEMISTRY | Every fresh bubble gets one pop check. Escape rate tuned to about 2% / 6% / 8% per minute at heat 5 / 7 / 9. Lid condensation is now strong, so a lidded pot keeps 99% |
| p01 (again) | French onion barely caramelized | At heat 5 the oil sits at about 117°C, and onions were stuck in a "sweat" stage capped at cook 120, while browning needed 120°C+ | CHEMISTRY | After sweating, food in fat keeps slowly caramelizing from 105°C |
| p24 reduction | Reduced broth had **no** salt | Same boiling-dry bug: the pot was empty | CHEMISTRY | (as above) |
| p05 lid keeps aroma | Lid on lost **more** water | Steam accumulated under the lid (1,500+ steam cells) instead of dripping back | CHEMISTRY | Steam condenses on the lid and in the air under it |
| p04 herbs late vs boiled | Boiled-to-death herbs scored more aromatic | When the dish was tasted, a wilted herb's cook level (196) fell inside the "browned food" window and got the Maillard bonus | ANALYSIS | Herbs track wilting, not browning. Wilted herbs lose most of their aroma when eaten |
| p27 herbs late vs early | Early herbs gave more aroma | (1) Aroma never left hot liquid. (2) Floating herbs sat at a too-cold surface (see stratification) and kept infusing. (3) Total aroma can't tell fresh from stewed | CHEMISTRY + CLAIM | Aroma now steams off hot, open liquid; fat holds it about twice as long. Notes fade in an open hot pot, with "herbal" fastest. Herbs wilt gradually from 65°C. The claim was rebased on the garlic broth (no celery) and checks fresh `note.herbal`, not total aroma |
| (found via p27) | Simmering pot: surface 53–72°C, middle 77–86°C, bottom 100°C | Bubbles carried the burner's energy up and out without heating anything, air conducted too much heat away, and convection was weak | CHEMISTRY | Rising bubbles heat the liquid they pass through; stronger convection; air is a poor conductor. The middle of the pot now sits at 89–95°C |
| p03 soda trick vs curdle | The soda trick still curdled | (1) Each soda grain only cancelled acid in the single cell it touched (about 2% of the soup's acid). (2) Once soda dissolved, the fizz foam **overwrote** the broth carrying it | CHEMISTRY | Soda dissolves into the liquid and neutralizes acid wherever it travels. Foam only rises into air. Curdling chance scales with how far past the dairy's tolerance the acid is |
| p03 (again) | Some curds remained | The recipe's soda didn't reach every sour pocket | RECIPE | More soda and a longer stir ("add until the fizzing stops") |
| p06 bloom vs water | Bloomed cumin no more aromatic | Spices "over-bloomed" in about 1 s, which disabled the bonus. Spice in plain water also extracted as well as in fat | CHEMISTRY | Once bloomed, a spice stays bloomed; only real heat burns it. Unbloomed spice gives water half its aroma. Blooming needs oil hotter than boiling water, or a hot dry surface (dry toasting) |
| p07 chili oil vs water | Same heat either way | Capsaicin dissolved into water as well as into fat | CHEMISTRY | Unbloomed chili gives water 60% of its heat; bloomed chili gives full heat; chili dissolving into oil gives 1.5× |
| p10 lumps hot vs cold | No lumps flaw in either | Flour in hot water does form gluey clumps, but they're dough cells, and the flaw only counted "lump" cells | ANALYSIS | Raw dough floating in a soup counts as lumps |
| p14 low-slow vs scorched | Scorched onions scored **higher** | Burnt bits barely tasted bitter, and heat-9 onions leached extra browned sweetness first | CHEMISTRY | Char is acrid: burnt bits strongly increase bitterness |
| p17 soda with/without acid | No-acid bread rose **2.8×** | Dissolved soda is measured in acid-cancelling units (12 per grain) but entered dough without converting back to grains | CHEMISTRY | Unit conversion when liquid soaks into dough |
| p23 chili vs unspiced | Perceived aroma equal | Strong heat masks aroma in perception, which is intended. The claim tested the wrong layer | CLAIM | The claim now checks raw aroma. Perception also gained a soft ceiling (stronger is still a bit stronger near 1.0) |
| p25 fullness | Half vs double batch aroma differed 0.38 / 0.70 | A small batch on the same flame runs hotter and steams off more aroma, as a real pot does. Salt matches | CLAIM | Aroma tolerance 0.3, salt 0.1 |

## Recipe-suite calibration found along the way

- **Sweetness.** A carrot or onion cell could leach about 40× the sweetness you'd taste from eating it, so long-simmered vegetable soups read as dessert. Leach strength is roughly halved. Browned food still gives more.
- **Spice and roux thresholds.** Sweating starts at 75°C (confit-gentle). Roux is decided by the fat's temperature, not the cold flour grain's. Fizz foam scales with the reaction.
- **Recipes.** s07 blooms its chili at heat 5 with time to toast. s65's tadka is a known gap: a separate pan is needed.

## Still open (recipe suite: 37 pass, 41 warn, 32 fail)

Hard failures are mostly taste-range targets written before the dough, heat and volatility models existed:

- **Body too low (9):** thickening from roux and tomato is weaker than the original guesses. This could be calibration or recipe amounts; worth a dedicated thickening pair (roux dose vs body).
- **Too sweet (6) / too rich (6) / greasy (6):** mostly fry and cream dishes. Oil pours heavier than the recipes assume; see SPEC §14.
- **Heat too low (5):** recipes that add chili straight to water now get less heat, which is realistic. The recipes should bloom it, or the targets should drop.

## Round 2: dose-response and perception pairs (2026-10-03)

15 new pairs (p33–p47) cover body, richness/grease, sweetness, heat and two perception rules. 12 passed on the first run. Every pair passes now (47/47 on seeds 1–3).

| Pair | Symptom | Real cause | Category | Fix |
|---|---|---|---|---|
| p35/p36 (passed, but the numbers were suspicious) | A roux stew had body 0.03 and a flour slurry 0.03 | Starch thickened about 3× too weakly: a roux cell added 1.8 body, so 100 flour grains barely thickened 3,000 cells of liquid | CHEMISTRY | A roux cell adds 6 body (less as it browns); thin dough melting into liquid adds 4. Suite "body too low" dropped 9 → 6 |
| p38 oil dose in soup | A 4×-oil broth scored higher | Soup greasiness started at 12% oil and barely registered (0.16), so the richness bonus won | ANALYSIS | Soup greasiness starts at 7% oil and rises faster. Plates are unchanged (pan oil is left behind) |
| p44 vinegar dose | Nanny Mae didn't mind 3× the vinegar | Her sourness tolerance only kicked in at 0.35 | ANALYSIS | She notices from 0.2 and complains from 0.35 |
| p47 salt suppresses bitterness | Salt didn't soften burnt garlic | Char bitterness was added *after* the salt-suppression rule, so salt never touched it | ANALYSIS | Salt suppression applies to total bitterness, including char |
| (tooling) | p47 was blamed on CHEMISTRY | When raw values are identical, the difference can only come from perception | — | The diagnosis now reports ANALYSIS when raw is equal on both sides |

Passing pairs that confirm earlier fixes: roux dose → body, reduction → body and umami, milk dose → richness, oil dose on a plate → greasy, chili dose → heat (and Nanny's dislike of a fiery bowl), onion count → sweetness, browned vs sweated carrots, soy dose → umami and salt, sugar masking sourness.

**Still open (recipe suite: 38 pass, 41 warn, 31 fail).** The oil-dose pairs show the chemistry and judging respond correctly to oil, so the remaining "greasy / too rich" recipe failures (7 / 6) are mostly **recipe amounts**: the fry and cream recipes pour more oil than they mean to, at the faster pour rate. That's the next tuning pass on the recipes themselves.

## Round 3: recipe pass and calibration (2026-10-03)

Going from 31 to a handful of hard failures meant fixing all three layers. Each fix was checked against the 47 pairs (all still pass on seeds 1–3).

**Recipes (technique and amounts):**
- **Fry recipes** use a film of oil (0.3–0.7 s), not a pool. Confit and chili oil keep theirs, since oil is the point.
- **Roux recipes** preheat the fat before the flour goes in. With cold fat only about a quarter of the flour became roux; the rest made dough or stayed dry. They also use a realistic amount of flour (about 1:20 flour to liquid, up from 1:40).
- **The velouté** makes its roux in the sweated vegetables' fat before the stock goes in, instead of in a corner of a full pot.
- **Spices** poured onto a pile of meat and onions get stirred into the fat. Otherwise they never touch it and never bloom.
- **Small fixes:** less salt in the gazpacho; a stir before tasting the boiled herbs; the bisque cools a little before its milk; less oil in the soft scramble.

**Chemistry:**
- **Leaching is proportional to what's left in the piece.** A piece used to release flavor at a constant rate until it ran out, so over a long cook it gave up far more than it contained. This was the shared root of the "too sweet" (onions, carrots), "too rich" and "too savory" (beef) failures. The rate is now multiplied by the fraction of the piece's flavor reserve remaining (its `life`).
- **Roux browns in minutes, not seconds.** It was dark within 15 s, and a dark roux thickens about half as much.
- **Herbs wilt over tens of seconds,** faster the hotter it is, so herbs stirred into a just-off-the-heat soup stay mostly fresh.
- **Ingredient flavors:**
  - Tomato is less tart, sweet and savory.
  - Beef releases less fat and umami, and its deglazed fond gives less umami.
  - Wine, celery and cooked onion and carrot are a little milder.

**Analysis (perception):**
- **Heat isn't discounted twice.** Water's poor capsaicin extraction now happens when chili dissolves, so perception counts broth heat in full; it used to halve it again.
- **Sweetness softens heat proportionally,** instead of subtracting a fixed amount that could erase mild heat entirely.

**Targets that were simply wrong (widened, with reasons in the recipe):**
- Leaner fries are less rich.
- Stews made with a dark roux thicken less.
- Fried food that isn't drained is greasy (there's no slotted spoon yet).
- Scrambled eggs are rich.
- Sauces made from cooked-down tomato are fairly tart.
- Shakshuka is spicy.
- A garlic-heavy sopa de ajo is very aromatic.
- Carrot and celery soup is sweet.

**Herbs, one more time:** slower wilting broke p27, because simmered herbs then stayed fresh too long. The missing piece was agitation: an actively bubbling simmer wilts herbs about 4× faster than hot liquid off the boil. Both herb pairs pass again (late herbs keep 0.62 herbal vs 0.26 simmered).

**Result:**
- **Recipe suite:** 37 pass, 73 warn, **0 fail** (from 31 fails at the start of this round).
- **Comparison pairs:** 47/47 pass on seeds 1–3.

The WARNs are near misses against the original design-guess ranges and are worth a look when tuning a particular dish, but nothing in the suite is wildly off.

## Round 4: patient onions and a stirring that matters (2026-10-09)

Goals:
- French onion should teach patience.
- Stirring should let you rescue food from the hot pot bottom, and turn over even a dense stew.

| Finding | Category | Fix |
|---|---|---|
| Onions caramelized in about 40 s at heat 5, and "Caramelization" fired on the first browned sliver | CHEMISTRY | Moist vegetables are held near 110 °C until they dry. They sweat, then brown, both faster when hotter, with onions slowest (about 2½ min at heat 5). The discovery needs 35% of the batch browned |
| Stirring a hot sauté made **more** char than leaving it (old code too: 4 vs 26 burnt bits) | CHEMISTRY | (1) Any hot dry piece could burn anywhere, so burning now comes only from contact with the metal or very hot oil. (2) Browning carried every piece to cook 255, so the first bottom contact burned it. Browning now stops at 230 and scorching takes it the rest of the way. (3) Food above the bottom was as hot as the bottom, so stirring brought nothing cooler down. The moisture hold-down fixes that. Result: an unstirred sauté chars about twice as much as a stirred one (p48) |
| A pushed piece couldn't move into other food, so a packed stew barely turned over | CHEMISTRY | The ladle shoves pieces through loose food and passes the push on to any piece blocking it (up to 4 links). A stroke along the bottom scoops things up. A dense stew moves about 45% further per stroke |
| Char didn't stick | CHEMISTRY | Burnt bits on the pot bottom ignore currents and come loose only by scraping |
| p13: burnt garlic barely burnt | CHEMISTRY | Scorching scales with how far past the burn point it is: gentle just past it, fast far past it |
| p38: a 4×-oil broth beat the plain one, because Nanny liked the richness | ANALYSIS | Nanny Mae dislikes an oil slick on a soup (−1.5) |
| Seven vegetable soups lost aroma and savoriness | CHEMISTRY + RECIPE | Golden vegetables (cook 120 and up) now give part of the browned flavor; it used to start only at fully browned. Recipes meant to brown their vegetables cook them longer |
| Four cumin soups still short on aroma | CLAIM | Their aroma used to come from very fast browning, and it steams off in a long simmer. Targets lowered to 0.25 with a note. **Open:** spice aroma in long simmers may be weak overall |
| s53, s20 sat exactly on a failing edge | RECIPE | A little more vinegar (s53) and less salt (s20) |
| f12 pan-roasted cumin carrots taste sweet | CLAIM | They caramelize instead of charring now; the sweetness range is widened |

**New pairs:**
- p48: stirred vs unstirred hot sauté
- p49: onions low and slow vs high heat
- p50: patient vs rushed onions
