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
| `baking.json` | 15 | Dough, batter and baking: pot-oven bread, soda bread, flatbread, pancakes, crêpes, cookies, sponge cake, dumplings, plus caramel and custard gaps |
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

1. ~~No batter or dough model.~~ Done: see `SPEC.md` §15. Bakes can carry an optional `"bake": {kind, rise, doneness}` expectation.
2. **No dry-sugar caramel stage.** Sugar on a hot, dry pot only adds a little `caramel` note before burning. There's no melted-caramel material or color.
3. **Stock clarity isn't tracked.** Rolling boil vs. gentle simmer and skimming don't affect cloudiness, and meat scum isn't simulated.
4. **No starch release from vegetables, and no blending.** Cream soups rely only on roux or milk for body.
5. **The `toasty` note comes from any beef leach**, even when boiled. It should only come from seared or Maillard browning.
6. **No pH model beyond sour vs. soda.** The soda-in-tomato trick works through the sour axis, but there's no color shift or "soapy" flaw label.
7. **Eggs** now have whole, cracked, poached, fried and hard-boiled states. There's still no runny yolk vs. set yolk distinction, and no peeling.
8. **Raw (gazpacho-style) soups** get a `raw` flaw even when raw is the point. Dish context will need to override flaws (Phase 2).
9. **Heat-sensitive dissolving.** Salt dissolves in cold water at much the same rate. That's realistic, but there's no visible "undissolved sugar in cold liquid" lesson.
10. **Honeycomb.** Soda in dough now breaks down with heat, but there's still no molten-sugar caramel for it to foam.

## Running them

```bash
node tools/run-recipes.js all              # every recipe, graded PASS / WARN / FAIL (parallel, ~2 min)
node tools/run-recipes.js s06 --snap       # one recipe in detail: checks, raw vs perceived taste, judges, PNG per step
node tools/run-pairs.js                    # comparison pairs, with automatic diagnosis when one goes wrong
node tools/run-pairs.js --seeds=3          # each side on 3 seeds; claims pass on the majority
```

### Grading (`run-recipes.js`)

Only things that are wildly off **FAIL**: an expected discovery that never happens, an unexpected flaw ≥ 0.4, a taste more than 0.2 outside its range, a verdict two steps off (CHOPPED vs WINNER), or bake doneness or rise far off. Near misses are **WARN**. The taste ranges are design guesses, so a WARN is a prompt to look, not a bug.

### Comparison pairs (`comparisons.json`, `run-pairs.js`)

Each pair cooks two dishes and checks claims about how they should differ, for example "sautéed onion soup scores higher and is browner than boiled".

- **Sides:** a side can be a recipe id, or a **variant** of one: `{ "from": "s62-lidded-onion", "remove": ["lid on", "lid off"] }`. Variants also support `replace`, `insertAfter`, `insertBefore`, `append`, `steps` and `scale`.
- **Metrics:**

| Metric | What it reads |
|---|---|
| `score` | Average judge score |
| `judge.pounce` / `judge.biscuit` / `judge.nanny` | One judge's score |
| `taste.<axis>` | Perceived taste |
| `raw.<axis>` | Flavor actually in the food, before perception |
| `flaw.<name>` | A flaw's strength |
| `bake.<field>` | A bake-report field |
| `count.<material>` | Number of cells of a material |
| `disc.<id>` | Whether a discovery triggered |
| `note.<id>` | An aroma note's level |

- **Operators:** `>`, `<`, `>=`, `<=`, `≈` (with `tol`).

When a claim fails, the runner diagnoses which layer is to blame:

| Suspect | Meaning | What to change |
|---|---|---|
| **RECIPE** | A key event listed in the pair's `events` (e.g. `caramelize`) never happened | The recipe, or the chemistry that should trigger it |
| **CHEMISTRY** | The raw, physical quantity is backwards or too small | The simulation rules (`js/reactions.js`, `dough.js`, `sim.js`) |
| **ANALYSIS** | Raw goes the right way but perceived taste or the judges flip it | `js/taste.js` (perception) or `js/judges.js` |

Always sanity-check the verdict. Sometimes the claim itself is wrong (see `TUNING-LOG.md`).

### The loop

Run pairs → read the diagnosis → confirm with a targeted trace (most fixes in `TUNING-LOG.md` started with one) → fix the right layer → re-run pairs **and** the full suite (fixes interact) → log it in `TUNING-LOG.md`.

`--scale=0.5` / `--scale=2` replays a recipe at half or double quantities, to check that tuning holds regardless of how full the pot is.
