# Test Recipes

105 playtest recipes that only use the 21 pantry ingredients in the game. Each one says what *should* happen physically and chemically in the pot, and what flavor profile and notes should come out.

Use them to:
- play through by hand and check the game feels right, or
- feed them to a headless runner later (the step format is machine-parseable).

## Files

| File | Recipes | What it covers |
|---|---|---|
| `soups.json` | 68 | Broths, cream soups, stews, egg soups. The core of the game |
| `frying.json` | 16 | Sautéing, searing, blooming spices in oil, pan sauces |
| `baking.json` | 10 | Batters, caramel, custard. "Baking" in a pot, which mostly exposes features the sim doesn't have yet |
| `experiments.json` | 11 | Deliberate failures and chemistry demos (fires, volcano, curdling, lumps) |

## Recipe format

Each file is a JSON array with one recipe per line, so diffs stay readable. Fields (comments added here for explanation only):

```json
{
  "id": "s04-french-onion",
  "name": "French Onion Soup",
  "category": "soup",              // soup | fry | bake | experiment
  "difficulty": 3,                 // 1 (tutorial) .. 5 (expert)
  "ingredients": ["oil", "onion", "wine", "water", "salt"],
  "steps": ["pour oil 1s", "add onion 8", "heat 5", "wait 60s", "..."],
  "expect": {
    "discoveries": ["sweat", "caramelize"],     // Journal ids that should trigger
    "physics": "What you should SEE happen in the pot.",
    "taste": { "sweet": [0.4, 0.8] },           // perceived 0..1 ranges for the axes that matter
    "notes": ["allium", "caramel"],             // aroma notes that should appear in the top notes
    "flaws": [],                                // burnt | curdled | lumps | scrambled | raw | gritty | greasy | shell
    "verdict": "WINNER"                         // CHOPPED | SAFE | WINNER, or a range like "SAFE-WINNER"
  },
  "sim_gaps": ["Real-world behavior the sim doesn't model yet."]
}
```

### Step language

| Step | Meaning |
|---|---|
| `pour <ingredient> <n>s` | Hold-to-pour a liquid or powder for *n* seconds at the default rate. Optional `@left`, `@right` or `@center` (the default) |
| `add <ingredient> <n>` | Drop *n* chunk clumps (onion, garlic, carrot, celery, tomato, beef, herbs) |
| `crack egg <n>` | Crack *n* eggs on the rim and drop them in, one per second |
| `throw egg <n>` / `throw fish <n>` | Throw *n* whole eggs (in the shell) or whole fish into the pot |
| `… +stir` | Adding `+stir` to any pour, crack or throw means stirring with the ladle at the same time |
| `heat <0-10>` | Set the heat dial |
| `wait <n>s` | Let the simulation run |
| `stir <n>s` | Ladle-stir the pot for *n* seconds |
| `lid on` / `lid off` | Toggle the lid |
| `taste` | Use the taste spoon in the middle of the soup |
| `serve` | Send the bowl to the judges |

Ingredient ids match `SHELF` in `js/materials.js`: `water oil milk wine vinegar soy salt sugar flour chili cumin soda onion garlic carrot celery tomato meat egg fish herbs`.

Discovery ids match `DISCOVERIES`:
`dissolve boil sweat caramelize burn fond deglaze bloom roux lumps mirepoix tomato eggdrop scramble curdle fizz flambe greasefire splatter thicken crack splat hardboil poached friedegg flake crispyskin herbloss`

Aroma notes: `allium toasty caramel herbal earthy spice smoky burnt fermented oceanic`.

## Calibration assumptions

All seconds are game seconds at 60 fps.

| Amount | Roughly |
|---|---|
| `pour water 10s` | Fills about a third of the pot (~4,000 broth cells). Most soups start here |
| `pour salt 1s` | Into ~10 s of water, about 0.45 perceived salty (well seasoned) |
| `pour sugar 0.3s` | A gentle sweetness |
| `pour vinegar 1s` | About 0.25 sour into ~10 s of water |
| `pour soy 1s` | Adds both salt (~0.25) and umami (~0.15) |
| `pour chili 0.5s` | Noticeable heat. Much more if it's bloomed in oil first |
| Heat 3–4 | Gentle simmer |
| Heat 5–6 | Steady simmer / sauté |
| Heat 7–8 | Rolling boil / hard sear |
| Heat 9–10 | Smoking oil and grease-fire territory |

The taste ranges are **design targets**, not measured outputs. A recipe that lands outside its range is a playtest finding: either the sim needs tuning or the expectation does. Log it.

## Known sim gaps these recipes surface

The `sim_gaps` fields roll up into this feature backlog:

1. **No batter or dough model.** Flour + egg + milk should set into a solid (pancake, cake) when hot. It currently becomes lumps, ribbons and scrambled egg.
2. **No dry-sugar caramel stage.** Sugar on a hot, dry pot only adds a little `caramel` note before burning. There's no melted-caramel material or color.
3. **Stock clarity isn't tracked.** Rolling boil vs. gentle simmer and skimming don't affect cloudiness, and meat scum isn't simulated.
4. **No starch release from vegetables, and no blending.** Cream soups rely only on roux or milk for body.
5. **The `toasty` note comes from any beef leach**, even when boiled. It should only come from seared or Maillard browning.
6. **No pH model beyond sour vs. soda.** The soda-in-tomato trick works through the sour axis, but there's no color shift or "soapy" flaw label.
7. **Eggs** now have whole, cracked, poached, fried and hard-boiled states. There's still no runny yolk vs. set yolk distinction, and no peeling.
8. **Raw (gazpacho-style) soups** get a `raw` flaw even when raw is the point. Dish context will need to override flaws (Phase 2).
9. **Heat-sensitive dissolving.** Salt dissolves in cold water at much the same rate. That's realistic, but there's no visible "undissolved sugar in cold liquid" lesson.
10. **Honeycomb/leavening.** Soda only reacts with acid. Thermal decomposition of soda (honeycomb toffee, soda bread rise) isn't modeled.

## Running them

```bash
node tools/run-recipes.js s06-garlic-broth --verbose --snap   # one recipe, per-step mix metrics + PNG snapshots
node tools/run-recipes.js soups                               # a whole file
node tools/run-recipes.js all --seed=2                        # everything, different RNG seed
```

- Runs are deterministic for a given `--seed`. Check a recipe against two or three seeds before calling it fixed.
- `--snap` writes a PNG of the pot after every step to `tools/out/<id>/`.
- The `mix` line is the physics health check:

| Metric | What it measures | Good soup |
|---|---|---|
| `chunkBottomFrac` | Share of solids in the bottom 20% of the liquid | Below ~0.5 while simmering or stirred |
| `chunkColumnSpread` | Share of the pot's width that has solids in it | Rises after stirring |
| `oilSubmergedFrac` | Oil folded into the broth rather than floating on top | Rises with boiling or stirring, then falls back |
| `saltCV` | How uneven the seasoning is (0 = perfectly even) | Drops after stirring |

**Iteration loop:** run one recipe with `--verbose --snap` → look at the failing checks and snapshots → change the sim → re-run with seeds 1–3.

Recipes that pass (seed 1): `s01` `s02` `s03` `s06` `s08` `s10` `s12` `s21` `s26` `s29` `s36` `s55` `s66` `s67` `s68` `f07` `f08` `f16` `x02` `x03` `x04` `x05` `x10` `x11`.

`--scale=0.5` / `--scale=2` replays a recipe with every ingredient amount halved or doubled, to check that tuning holds regardless of how full the pot is.
