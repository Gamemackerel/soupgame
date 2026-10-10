# Roadmap: Steam beta

Sandbox mode works. The Steam beta adds a career mode: you rise as a chef and earn Michelin stars.

The full game has 4 tiers of 5 recipes, and each recipe is a level. Each level's judges know the recipe. They score your bowl on flavor and texture, and on how well it matches the recipe: the ingredients you used and the reactions that happened in the pot.

The beta ships the first two tiers, 10 recipes in all:

| Tier | Title | Judges |
| --- | --- | --- |
| 0 | Pizza shop employee | the dog, the cat, Joe (a random human) |
| 1 | First Michelin star | Gordo Hamsie, Paul Bollywood, Sir Pounce (the cat) |

Earning the first star doesn't unlock tiers 2 and 3 yet. They stay greyed out on the level select screen until they're built.

## Steps

### 1. Start the Steam process

Start this first. Steam has fixed waits, and they can run while the game is built.

- [ ] Create a Steamworks account at partner.steamgames.com: legal name, bank details, tax interview and identity check (allow a few days).
- [ ] Pay the $100 Steam Direct fee. It gets you an App ID and starts the 30-day wait before release is allowed. The fee comes back once the game earns $1,000.
- [ ] Build the store page: capsule art, screenshots, a short description and a trailer if possible. Sandbox footage is fine for now; it must show the real game. First screenshots are in [press/](press/README.md).
- [ ] Submit the store page for review, then set it to "Coming Soon". It has to be public for about two weeks before launch.

### 2. Choose the 10 recipes and decide how judging works

Do these together, because the judging format decides which dishes can be judged fairly.

- [x] Settle the recipe format and scoring: [SPEC.md §16](SPEC.md). Levels live in `js/levels.js`. `node tools/build-levels.js` regenerates the targets and checks that every par earns 3★ and every mistake fewer.
- [x] Choose 5 tier-0 recipes: Tomato Soup, Creamy Corn Soup, Pan Flatbread, Fish Stew, Minestrone. This added corn, potato, white beans and pasta.
- [x] Choose 5 tier-1 recipes: French Onion, Beef Chowder, Goulash, Pot-Oven Sponge Cake, Chili con Carne.
- [x] Assign the judges and the judging rules: [SPEC.md §17](SPEC.md). Built: Joe, Gordo Hamsie and Paul Bollywood, per-judge blended 0–10 scores, soft caps, flourishes, badges, the handshake and the random sandbox panel. Badges and handshakes aren't saved yet (step 3).

### 3. Build the level select screen

- [ ] Show all 4 tiers. Tiers 0 and 1 are playable; tiers 2 and 3 are greyed out.
- [ ] Track completion and stars per level, and save progress between sessions.
- [ ] Keep sandbox mode reachable from the menu.

### 4. Playtest and tune each level

- [ ] Add each recipe as a level, plus a headless test recipe in `test-recipes/` that passes `tools/run-recipes.js`.
- [ ] Play each level by hand and tune until it plays well. Log changes in `test-recipes/TUNING-LOG.md`.

### 5. Ship the beta build

- [ ] Package the web game as a desktop app (for example Electron or Tauri).
- [ ] Upload the build through Steamworks and submit it for review (a few days).
- [ ] Release the beta, either on the main store page or through Steam Playtest.
