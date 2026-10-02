# Soup Pot

A falling-sand cooking game. Pour ingredients into a pot, control the flame, stir, and taste. Real cooking chemistry plays out pixel by pixel: sweating, caramelizing, fond and deglazing, roux, emulsions, curdling, flambé and grease fires. When you're done, serve your bowl to a panel of animal judges who decide whether you're chopped.

## Play

Open `index.html` in a browser. There's no build step.

| Control | Action |
|---|---|
| Pantry (left) | Pick an ingredient. The chef picks it up |
| Click and hold over the pot | Pour |
| Heat dial, mouse wheel or `0`–`9` | Burner heat |
| Stir / Taste / Lid tools | Ladle, taste spoon, lid (`L`) |
| `J` | Discovery journal |
| SERVE | Send your bowl to the judges |

Dev shortcuts: open the page with `#demo`, `#judge`, `#speak` or `#verdict` on the end of the address.

## Project layout

- `js/`: the game (vanilla JS, canvas)
  - `materials.js`: materials, flavor dimensions, pantry, discoveries
  - `sim.js`: grid, movement, rigid chunk pieces, heat, stirring and whirlpool
  - `reactions.js`: cooking chemistry rules and sim rendering
  - `taste.js`: perceived taste and bowl analysis
  - `judges.js`: the judging scene
  - `art.js`, `chef.js`, `ui.js`, `main.js`: art, chef, UI, game loop
- `SPEC.md`: the game design spec
- `test-recipes/`: 100 playtest recipes with expected outcomes
- `tools/run-recipes.js`: a headless runner that replays recipes through the real sim and checks them

```bash
node tools/run-recipes.js s06-garlic-broth --verbose --snap
```
