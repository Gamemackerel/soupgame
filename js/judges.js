// "The Chop": serve the bowl to three judges who taste from different perspectives and decide your fate.

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// Every judge, by id. A panel of three is drawn from these for each serving (see Judging.setPanel).
// `sens` is how hard the judge comes down on each kind of mistake in a career level (see Levels.score): 1 is
// normal, below 1 a blind spot, above 1 a pet peeve. Keys: a taste axis ('salty'), or one direction of it
// ('salty+' too much, 'salty-' not enough), 'technique', 'ingredients' and 'flaw'.
const JUDGE_ROSTER = {
  pounce: {
    id: 'pounce', name: 'Sir Pounce', title: 'The Classicist Cat',
    sens: { technique: 1.4, sour: 1.2, body: 1.2, heat: 0.7 },
    fur: [192, 194, 210], dark: [128, 130, 152], belly: [246, 246, 252], theme: [110, 120, 170],
    sounds: { good: ['*purrs*', 'Mrrow.'], bad: ['Hsss!', '*flicks tail*'] },
    evaluate(a) {
      if (a.type === 'baked') return judgeBakeClassic(a);
      const p = a.p, good = [], bad = [];
      let tech = 0;
      if (a.mirepoix) { tech += 0.3; good.push('A proper mirepoix base. Bon.'); }
      if (a.deglazed) { tech += 0.3; good.push('You deglazed the fond. I can taste it. Très bien.'); }
      if (a.caramelized) { tech += 0.3; good.push('The onions are deeply caramelized. That takes discipline.'); }
      if (a.ribbons > 30) { tech += 0.2; good.push('Delicate egg ribbons. Precise technique.'); }
      const plate = a.type === 'plate';
      if (!plate && p.body > 0.25 && p.body < 0.7 && a.flaws.lumps < 0.2) { tech += 0.2; good.push('The texture is velvety. Well done.'); }
      // A plate is judged on its sear and doneness instead of its broth.
      if (plate && a.crust > 0.25 && a.flaws.burnt < 0.2) { tech += 0.4; good.push('A beautiful golden crust. Magnifique.'); }
      if (plate && a.crust < 0.05 && a.doneness > 0.5) { tech -= 0.1; bad.push('No sear at all. A hotter pan, and leave it be.'); }
      if (a.flaws.chemical > 0.2) bad.push('Is that... fire extinguisher? In my soup?!');
      if (a.flaws.burnt > 0.2) bad.push('I taste carbon. Lower the flame, and stir.');
      if (a.flaws.curdled > 0.2) bad.push('The dairy has split. Add it gently, off the boil.');
      if (a.flaws.lumps > 0.2) bad.push('Lumps of raw flour. Cook it in the fat first: a roux.');
      if (a.flaws.greasy > 0.3) bad.push(plate ? 'It is swimming in oil. Less, please.' : 'An oil slick on top. Use less oil.');
      if (a.flaws.raw > 0.4) bad.push('Undercooked. It needed more time on the heat.');
      if (a.flaws.mushy > 0.3) bad.push('The pasta is mush. Add it later.');
      if (a.flaws.gritty > 0.3) bad.push('Gritty! Stir the seasoning in while it is hot.');
      if (a.flaws.shell > 0.2 && !a.wholeEgg) bad.push('Crunchy eggshell. Crack it on the rim first.');
      if (a.eggPieces > 15 && a.flaws.shell < 0.2) good.push('A perfectly set egg. Very refined.');
      if (a.fish && a.fishCooked > 90 && a.fishCooked < 170) good.push('The fish is just cooked through. Bravo.');
      if (p.salty < 0.22) bad.push('Under-seasoned. A pinch more salt.');
      if (p.salty > 0.82) bad.push('Over-salted. Go lighter, or add water.');
      // A brothy soup full of good things is fine; it's a bowl of near-plain liquid that's dishwater.
      if (!plate && p.body < 0.05 && a.chunkiness < 0.15) bad.push('Thin as dishwater. Reduce it, or thicken it.');
      const bal = Taste.score(p, { plate });
      if (!good.length && bal > 0.6) good.push(plate ? 'A balanced plate. Classic.' : 'A balanced bowl. Classic.');
      const s = 10 * (0.6 * bal + 0.25 * Math.max(0, Math.min(1, tech)) + 0.15) - a.flawSum * 12;
      return { score: s, good, bad };
    },
  },
  biscuit: {
    id: 'biscuit', name: 'Biscuit', title: 'The Flavor Hound',
    sens: { 'salty+': 0.5, 'rich+': 0.5, aroma: 1.3, sweet: 1.2, technique: 0.6 },
    fur: [238, 184, 110], dark: [170, 104, 58], belly: [253, 238, 210], theme: [220, 120, 60],
    sounds: { good: ['WOOF!', '*tail wags*'], bad: ['*whimper*', 'Grrr.'] },
    evaluate(a) {
      if (a.type === 'baked') return judgeBakeFlavor(a);
      const p = a.p, good = [], bad = [];
      const heatMod = p.heat > 0.15 && p.heat < 0.85 ? 1 : p.heat >= 0.85 ? 0.6 : p.heat / 0.15 * 0.5;
      const acid = p.sour > 0.1 && p.sour < 0.6 ? 1 : p.sour >= 0.6 ? 0.4 : 0.2;
      const complexity = Math.min(1, a.notes.length / 4);
      if (p.heat > 0.55) good.push('Now THAT has fire! I love it.');
      else if (p.heat < 0.1) bad.push('Where is the heat? Give me a chili!');
      if (p.umami > 0.6) good.push('Deep and savory. It punches!');
      else if (p.umami < 0.3) bad.push('It whispers! Brown something, add soy... make it SING!');
      if (p.sour < 0.08) bad.push('No acid, no life! A splash of vinegar, or tomato!');
      else if (acid === 1) good.push('That acidity brightens everything.');
      if (p.aroma > 0.6) good.push('The aroma hit me from across the room.');
      if (a.notes.length >= 3) good.push('Layers! I taste ' + a.notes.slice(0, 3).join(', ') + '.');
      if (p.bitter > 0.35) bad.push('Bitter, and not the good kind. Something scorched?');
      if (a.fish) good.push(a.fishCooked > 60 ? 'FISH! I can taste the ocean!' : 'Is this fish... alive?');
      const s = 10 * (0.3 * p.umami + 0.2 * Math.min(1, p.aroma * 1.4) + 0.15 * acid + 0.15 * heatMod +
                      0.2 * complexity) - p.bitter * 4 - a.flawSum * 4 + 1;
      return { score: s, good, bad };
    },
  },
  nanny: {
    id: 'nanny', name: 'Nanny Mae', title: 'The Comfort Goat',
    sens: { 'heat+': 1.5, 'sour+': 1.3, body: 1.2, technique: 0.6, ingredients: 0.8 },
    fur: [248, 244, 236], dark: [208, 186, 154], belly: [255, 255, 255], theme: [200, 120, 170],
    sounds: { good: ['Baa~!', '*happy bleat*'], bad: ['Baaah...', '*chews thoughtfully*'] },
    evaluate(a) {
      if (a.type === 'baked') return judgeBakeComfort(a);
      const p = a.p, good = [], bad = [];
      const warm = a.temp > 60 ? 1 : a.temp > 40 ? 0.5 : 0;
      if (!warm) bad.push('Oh dear, it\'s gone cold. Serve it hot, dear.');
      else if (a.temp > 70) good.push('Nice and piping hot, just right.');
      if (p.rich > 0.35) good.push('Rich and cozy, like a hug.');
      if (a.type === 'plate') good.push('A proper plate of food. How lovely.');
      else if (a.chunkiness > 0.25) good.push('Lovely hearty bits in here.');
      else if (a.chunkiness < 0.05) bad.push('A bit thin for me. More vegetables, dear?');
      if (p.heat > 0.5) bad.push('Oh my! Go easy on the chili for this old tongue.');
      if (p.sour > 0.35) bad.push('Goodness, that\'s sour! A pinch of sugar softens it.');
      if (p.salty > 0.75) bad.push('All that salt! My blood pressure, dear!');
      const oily = a.type !== 'plate' && a.flaws.greasy > 0.3;
      if (oily) bad.push('Oh my, it\'s awfully oily. Less oil, dear.');
      if (p.sweet > 0.15 && p.sweet < 0.55) good.push('A gentle sweetness, just how I make it.');
      if (a.ribbons > 30) good.push('Egg ribbons! My mother used to make those.');
      if (a.wholeEgg) (a.eggPieces > 10 ? good : bad).push(a.eggPieces > 10 ? 'A whole boiled egg, shell and all! How... rustic.' : 'There is a raw egg in here. Still in its shell.');
      const gentle = 1 - Math.max(0, p.heat - 0.35) * 2 - Math.max(0, p.sour - 0.2) * 2.5;
      const s = 10 * (0.25 * warm + 0.25 * Math.min(1, p.rich * 1.8) + 0.2 * Math.min(1, a.chunkiness * 3) +
                      0.15 * Math.max(0, gentle) + 0.15 * Taste.score(p, { plate: a.type === 'plate' })) - a.flawSum * 6 - (oily ? 1.5 : 0);
      return { score: s, good, bad };
    },
  },
};


// ---- Baked goods: each judge has their own take on a bake.
function judgeBakeClassic(a) {
  const b = a.bake, good = [], bad = [];
  let s = 4;
  if (b.doneness > 0.95) { s += 2; good.push(`A properly baked ${b.kind}.`); }
  else if (b.doneness < 0.7) { s -= 2; bad.push('Raw in the middle. Gummy. Bake it longer.'); }
  if (b.wantsRise) {
    if (b.rise >= 1.3 && b.rise <= 2.4) { s += 2; good.push('Light, with a lovely open crumb.'); }
    else if (b.rise < 1.15) { s -= 1.5; bad.push('Dense as a brick. Baking powder gives it lift.'); }
    else if (b.rise > 2.6) { s -= 1; bad.push('Over-risen: big holes. Less leavening.'); }
  }
  if (b.wantsCrust) {
    if (b.crust > 0.25) { s += 1.5; good.push('A beautiful golden crust.'); }
    else if (b.crust < 0.08) { s -= 0.5; bad.push('Pale. Longer under the lid.'); }
  }
  if (b.burnt > 0.2) { s -= 2; bad.push('The bottom is burnt black. Lower the flame.'); }
  if (b.water > 1.8 && b.kind !== 'pancake' && b.kind !== 'crêpe') { s -= 1; bad.push('Soggy inside. Less liquid in the dough.'); }
  if (b.water < 0.4) { s -= 1; bad.push('Dry and crumbly. It needed more liquid.'); }
  if (b.soda > 0.08) { s -= 2; bad.push('Soapy. Too much baking soda, no acid.'); }
  if (a.flaws.gritty > 0.3) { s -= 1.5; bad.push('Pockets of raw flour. It was never mixed properly.'); }
  if (b.gluten > 0.25 && (b.kind === 'bread' || b.kind === 'flatbread')) { s += 0.5; good.push('Good chew. It was kneaded properly.'); }
  return { score: s - a.flawSum * 4, good, bad };
}
function judgeBakeFlavor(a) {
  const b = a.bake, p = a.p, good = [], bad = [];
  let s = 3;
  const sweetKind = b.kind === 'cake' || b.kind === 'cookie' || b.kind === 'pancake';
  if (!sweetKind && p.salty < 0.15) { bad.push(`Bland ${b.kind}! It needs salt.`); s -= 1; }
  else if (!sweetKind && p.salty < 0.7) { good.push('Well seasoned. I can taste the salt.'); s += 2; }
  if (p.salty > 0.8) { bad.push('Way too salty!'); s -= 2; }
  if (sweetKind) { if (p.sweet > 0.3) { good.push('Sweet and delicious!'); s += 2; } else bad.push(`A ${b.kind} with no sugar? Sad.`); }
  if (a.notes.includes('toasty') || b.crust > 0.2) { good.push('That toasty crust smell!'); s += 1.5; }
  if (b.rich > 0.3 || b.egg > 0.2) { good.push('Rich. Is that egg? Butter?'); s += 1; }
  if (p.bitter > 0.35) { bad.push('Bitter. Too much soda? Or scorched?'); s -= 2; }
  if (a.flaws.gritty > 0.3) { bad.push('Dry floury bits in it!'); s -= 1.5; }
  return { score: s + Math.min(2, a.notes.length * 0.5) - a.flawSum * 4, good, bad };
}
function judgeBakeComfort(a) {
  const b = a.bake, p = a.p, good = [], bad = [];
  let s = 5;
  if (a.temp > 50) { good.push(`Warm fresh ${b.kind}, like my own kitchen.`); s += 2; }
  else bad.push(`This ${b.kind} has gone cold.`);
  if (b.water >= 0.5 && b.water <= 1.6 && b.doneness > 0.85) { good.push('So soft and tender.'); s += 1.5; }
  if (b.doneness < 0.7) { bad.push('Oh dear, still raw inside. A little longer next time.'); s -= 2; }
  if (p.sweet > 0.3 && (b.kind === 'cake' || b.kind === 'cookie')) { good.push('A treat! You spoil me.'); s += 1.5; }
  if (b.burnt > 0.2) { bad.push('A little scorched, dear. A gentler flame.'); s -= 1; }
  return { score: s - a.flawSum * 5, good, bad };
}

// ---- Human judges.
const spiceUsed = () => Sim.used.has('chili') || Sim.used.has('cumin');

Object.assign(JUDGE_ROSTER, {
  // A fair customer: would he order it again? Balance, warmth, something to chew on, no nasty surprises.
  joe: {
    id: 'joe', name: 'Joe', title: 'The Regular',
    sens: { technique: 0.4, ingredients: 0.6, salty: 1.3, aroma: 0.7, flaw: 1.2 },
    skin: [236, 190, 150], hoodie: [84, 120, 176], cap: [210, 60, 50], theme: [84, 120, 176],
    sounds: { good: ['*nods slowly*', 'Oh, nice.'], bad: ['Uhh...', '*polite chewing*'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [], plate = a.type === 'plate' || a.type === 'baked';
      const bal = Taste.score(p, { plate });
      const warm = a.temp > 55 ? 1 : a.temp > 40 ? 0.5 : 0;
      const filling = plate ? 1 : Math.min(1, a.chunkiness * 3 + p.body);
      if (bal > 0.7) good.push(pick(['Honestly? I\'d order this again.', 'Yeah, that\'s really good.', 'This hits the spot.']));
      else if (bal > 0.5) good.push('Pretty solid, man.');
      if (p.salty < 0.2) bad.push('Kinda bland. Got any salt back there?');
      if (p.salty > 0.8) bad.push('Whoa, salty. I\'m gonna need a soda.');
      if (p.heat > 0.6) bad.push('That\'s... a lot of spice. Like, too much.');
      if (!warm) bad.push('It\'s cold, dude.');
      if (filling > 0.6) good.push('Hearty! That\'ll keep me going.');
      else if (!plate && filling < 0.15) bad.push('Kinda watery. Could use more stuff in it.');
      if (a.flaws.shell > 0.2) bad.push('Is that... eggshell? Crunchy.');
      if (a.flaws.burnt > 0.2) bad.push('Tastes a little burnt, not gonna lie.');
      if (a.flaws.raw > 0.4) bad.push('Pretty sure this isn\'t cooked yet.');
      if (a.flaws.mushy > 0.3) bad.push('The noodles are kinda mushy.');
      const s = 10 * (0.6 * bal + 0.15 * warm + 0.15 * filling + 0.1) - a.flawSum * 7;
      return { score: s, good, bad };
    },
  },

  // The head chef: execution is everything. Raw, burnt, mushy, under-seasoned or sloppy gets the full rant.
  gordo: {
    id: 'gordo', name: 'Gordo Hamsie', title: 'The Head Chef',
    sens: { technique: 1.5, flaw: 1.4, salty: 1.4 },
    skin: [246, 202, 172], hair: [240, 206, 110], brow: [190, 150, 80], coat: [250, 250, 252], theme: [200, 50, 50],
    sounds: { good: ['Mmm.', '*nods sharply*'], bad: ['OH, COME ON!', '*slams the table*'] },
    evaluate(a) {
      if (a.type === 'baked') { const r = judgeBakeClassic(a); return { score: r.score - a.flawSum * 4, good: r.good.length ? ['Right. ' + r.good[0]] : [], bad: r.bad.map((l) => l.toUpperCase()) }; }
      const p = a.p, good = [], bad = [], plate = a.type === 'plate', H = Sim.happened;
      let tech = 0;
      if (a.caramelized) { tech += 0.3; good.push('Look at those onions. THAT is patience.'); }
      if (a.deglazed || H.has('deglaze')) { tech += 0.3; good.push('You lifted the fond. Beautiful.'); }
      if (H.has('roux') && a.flaws.lumps < 0.2) { tech += 0.2; good.push('Silky. A proper roux.'); }
      if (H.has('bloom')) { tech += 0.2; good.push('Spices woken up in the fat. Lovely.'); }
      if (plate && a.crust > 0.25 && a.flaws.burnt < 0.2) { tech += 0.4; good.push('Gorgeous sear. FINALLY.'); }
      if (a.flaws.raw > 0.4) bad.push('IT\'S RAW! A good vet could still save this!');
      if (a.flaws.burnt > 0.2) bad.push('It\'s B****Y BURNT! TURN THE HEAT DOWN AND STIR!');
      if (a.flaws.mushy > 0.3) bad.push('The pasta\'s gone to MUSH, you absolute panini!');
      if (a.flaws.curdled > 0.2) bad.push('The cream\'s SPLIT! F***ing hell, turn the heat DOWN!');
      if (a.flaws.lumps > 0.2) bad.push('LUMPS! Wallpaper paste! Make a ROUX!');
      if (a.flaws.greasy > 0.3) bad.push('I could deep-fry a fish in this S***! LESS OIL!');
      if (a.flaws.shell > 0.2) bad.push('SHELL! In MY kitchen?!');
      if (a.flaws.chemical > 0.2) bad.push('You put the FIRE EXTINGUISHER in it?! GET OUT!');
      if (p.salty < 0.22) bad.push('Bland! SEASON it, you donkey!');
      if (p.salty > 0.82) bad.push('It\'s a S***ing salt lick!');
      if (!plate && p.body < 0.06 && a.chunkiness < 0.1) bad.push('Dishwater. D*** dishwater. REDUCE IT!');
      const bal = Taste.score(p, { plate });
      if (!good.length && bal > 0.65) good.push('Clean. Well seasoned. Good.');
      const s = 10 * (0.55 * bal + 0.25 * Math.max(0, Math.min(1, tech)) + 0.15) - a.flawSum * 14;
      return { score: s, good, bad };
    },
  },

  // The master baker, who also knows his spices: rise, crust and crumb on a bake; bloomed spice and balance on the rest.
  paul: {
    id: 'paul', name: 'Paul Bollywood', title: 'The Master Baker',
    sens: { heat: 1.4, aroma: 1.3, sweet: 1.2, salty: 0.8, technique: 1.1 },
    skin: [234, 180, 144], hair: [206, 208, 216], iris: [70, 160, 250], shirt: [40, 50, 84], theme: [70, 110, 190],
    sounds: { good: ['*raises an eyebrow*', 'Hmm. Yes.'], bad: ['*stares*', 'Hmm. No.'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [];
      if (a.type === 'baked') {
        const b = a.bake;
        let s = 4;
        if (b.doneness > 0.95) { s += 2; good.push(`That's a properly baked ${b.kind}.`); }
        else if (b.doneness < 0.7) { s -= 2.5; bad.push('It\'s raw in the middle. Soggy bottom.'); }
        if (b.wantsRise) {
          if (b.rise >= 1.3 && b.rise <= 2.4) { s += 2; good.push('Good rise. Lovely even crumb.'); }
          else if (b.rise < 1.15) { s -= 2; bad.push('Under-proved. Dense. It needs more raising agent.'); }
          else if (b.rise > 2.6) { s -= 1; bad.push('Over-proved. It\'s all holes.'); }
        }
        if (b.wantsCrust) { if (b.crust > 0.25) { s += 1; good.push('Nice colour on it.'); } else if (b.crust < 0.08) { s -= 0.5; bad.push('Pale. Bake it longer.'); } }
        if (b.burnt > 0.2) { s -= 2; bad.push('The bottom\'s burnt. Too much heat.'); }
        if (b.soda > 0.08) { s -= 2; bad.push('Soapy. Too much soda, not enough acid.'); }
        if (a.flaws.gritty > 0.3) { s -= 1.5; bad.push('Pockets of raw flour. Under-mixed.'); }
        if (b.water > 1.8 && b.kind !== 'pancake' && b.kind !== 'crêpe') { s -= 1; bad.push('Stodgy. Too wet.'); }
        if (spiceUsed()) { s += 0.5; good.push('A little spice in a bake. Bold. I like it.'); }
        return { score: s - a.flawSum * 5, good, bad };
      }
      const bal = Taste.score(p, { plate: a.type === 'plate' });
      let spiceQ = 0.55;
      if (spiceUsed()) {
        const bloomed = Sim.happened.has('bloom');
        const heatOk = p.heat > 0.12 && p.heat < 0.65 ? 1 : p.heat >= 0.65 ? 0.5 : 0.7;
        spiceQ = (bloomed ? 1 : 0.4) * heatOk;
        if (bloomed) good.push('The spices were bloomed in the oil first. You can taste the warmth.');
        else bad.push('Raw spice. Chalky. Bloom it in the oil first.');
        if (p.heat >= 0.65) bad.push('Too much heat. It drowns everything else out.');
      } else if (p.aroma < 0.3) bad.push('It\'s pleasant. But where\'s the depth? Where\'s the spice?');
      if (a.flaws.lumps > 0.2) bad.push('Lumpy. Make a roux first.');
      if (p.body > 0.25 && p.body < 0.7 && a.flaws.lumps < 0.2) good.push('Good body to it.');
      if (!good.length && bal > 0.65) good.push('Well balanced. Nothing shouting over anything else.');
      const s = 10 * (0.45 * bal + 0.3 * spiceQ + 0.25) - a.flawSum * 8;
      return { score: s, good, bad };
    },
  },
});

// ---- The Second and Third Michelin Star panels, and The Ram. (Placeholder voices; to be rewritten.)
// Every palate here leans on the same building blocks: Taste.score's overall balance, plus what each one cares about.
const balanceOf = (a) => Taste.score(a.p, { plate: a.type === 'plate' });
const flawLines = (a, voice) => {
  const out = [];
  if (a.flaws.burnt > 0.2) out.push(voice.burnt);
  if (a.flaws.raw > 0.4) out.push(voice.raw);
  if (a.flaws.mushy > 0.3) out.push(voice.mushy);
  if (a.flaws.curdled > 0.2) out.push(voice.curdled);
  if (a.flaws.lumps > 0.2) out.push(voice.lumps);
  if (a.flaws.greasy > 0.3) out.push(voice.greasy);
  if (a.flaws.chemical > 0.2) out.push(voice.chemical);
  return out.filter(Boolean);
};

Object.assign(JUDGE_ROSTER, {
  // Mister Dude-Guy (a Guy Fieri caricature): big, bold, loud flavor. Heat, salt, richness. Blandness offends him.
  dudeguy: {
    id: 'dudeguy', name: 'Mister Dude-Guy', title: 'The Mayor of Flavor',
    sens: { 'salty+': 0.3, 'salty-': 1.4, 'heat+': 0.2, 'rich+': 0.4, technique: 0.7, ingredients: 0.8 }, theme: [230, 160, 30],
    sounds: { good: ['OHHH YEAH!', '*fist pump*'], bad: ['Dude...', '*lowers sunglasses*'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [], bal = balanceOf(a);
      const bold = Math.min(1, (p.heat * 0.8 + p.umami * 0.6 + p.rich * 0.5 + p.salty * 0.5));
      if (bold > 0.75) good.push('Welcome to Flavor City, population: THIS BOWL!');
      else if (bold > 0.5) good.push('Now that is some legit, righteous soup, dude.');
      else bad.push("This is a one-way ticket to Bland-ville. Where's the KICK?");
      if (p.heat > 0.3 && p.heat < 0.8) good.push('That heat? Totally rockin\'.');
      if (p.salty < 0.25) bad.push('Season it up, bro! Salt is your friend!');
      bad.push(...flawLines(a, { burnt: 'Burnt, dude. Not the good char.', raw: "That's still raw, man!", mushy: 'Mushy noodles? Not on my watch.', greasy: 'Even I think that\'s too greasy.', chemical: 'Is that EXTINGUISHER? Out of bounds!' }));
      const s = 10 * (0.5 * bal + 0.35 * bold + 0.15) - a.flawSum * 8;
      return { score: s, good, bad };
    },
  },

  // Chef Signore: Italian. Simple, honest ingredients done right: sweet tomato, herbs, olive oil, pasta al dente.
  signore: {
    id: 'signore', name: 'Chef Signore', title: 'The Italian',
    sens: { ingredients: 1.4, body: 1.2, 'heat+': 1.3, 'sweet+': 0.6, technique: 0.8 }, theme: [60, 150, 80],
    sounds: { good: ['*kisses fingertips*', 'Bellissimo!'], bad: ['Mamma mia...', '*throws hands up*'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [], bal = balanceOf(a), U = Sim.used;
      let soul = 0.5;
      if (U.has('tomato') && Sim.happened.has('tomato')) { soul += 0.2; good.push('The tomatoes are sweet and melted. Like my nonna made.'); }
      if (U.has('herbs')) { soul += 0.15; good.push('Fresh herbs! Now it smells like home.'); }
      if ((U.has('pasta') || U.has('noodles')) && a.flaws.mushy < 0.2 && a.flaws.raw < 0.3) { soul += 0.2; good.push('The pasta is al dente. Perfetto.'); }
      if (p.salty < 0.22) bad.push('No salt? Even the sea is saltier than this.');
      bad.push(...flawLines(a, { burnt: 'Bruciato! Burnt!', raw: 'Is not cooked. Patience!', mushy: 'The pasta is MUSH. A crime in Italy.', curdled: 'The cream, she has split.', greasy: 'Too much oil, even for me.', chemical: 'What is this powder?! Basta!' }));
      const s = 10 * (0.55 * bal + 0.3 * Math.min(1, soul) + 0.15) - a.flawSum * 9;
      return { score: s, good, bad };
    },
  },

  // Chef Seonbae: Korean. Deep, layered broth: savory depth, a little heat, a touch of sour, fermented richness (soy).
  seonbae: {
    id: 'seonbae', name: 'Chef Seonbae', title: 'The Senior Chef',
    sens: { 'umami-': 1.5, 'salty-': 1.2, 'heat+': 0.4, 'sour+': 0.6, technique: 1.1 }, theme: [70, 110, 190],
    sounds: { good: ['*slow nod*', 'Jinjja masisseoyo.'], bad: ['Aigoo...', '*sighs*'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [], bal = balanceOf(a);
      const depth = Math.min(1, p.umami * 0.9 + (Sim.used.has('soy') ? 0.2 : 0) + Math.min(0.3, a.notes.length * 0.08));
      if (depth > 0.7) good.push('Deep broth. You can taste the hours in it.');
      else bad.push('The broth is shallow. It needs more depth.');
      if (p.heat > 0.15 && p.heat < 0.7) good.push('A good warmth. It wakes you up.');
      if (p.sour > 0.05 && p.sour < 0.5) good.push('A little brightness. Balanced.');
      bad.push(...flawLines(a, { burnt: 'Burnt. Start over, junior.', raw: 'Undercooked. Respect the ingredients.', mushy: 'The noodles lost their bite.', greasy: 'Too oily. Skim it.', chemical: 'This is... not food.' }));
      const s = 10 * (0.5 * bal + 0.35 * depth + 0.15) - a.flawSum * 9;
      return { score: s, good, bad };
    },
  },

  // Chef Monsieur: French. Technique above all: mirepoix, fond, deglazing, a roux, caramelized onions.
  monsieur: {
    id: 'monsieur', name: 'Chef Monsieur', title: 'The French Master',
    sens: { technique: 1.6, sweet: 1.3, body: 1.3, flaw: 1.3, heat: 0.6, salty: 0.8, ingredients: 0.8 }, theme: [60, 80, 170],
    sounds: { good: ['*adjusts mustache*', 'Magnifique.'], bad: ['Sacrebleu!', '*scoffs*'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [], bal = balanceOf(a), H = Sim.happened;
      let tech = 0;
      if (a.mirepoix) { tech += 0.25; good.push('A proper mirepoix. Good foundations.'); }
      if (H.has('fond')) { tech += 0.25; good.push('You built a fond. Bien.'); }
      if (a.deglazed || H.has('deglaze')) { tech += 0.25; good.push('And you deglazed it. Exquisite.'); }
      if (H.has('roux') && a.flaws.lumps < 0.2) { tech += 0.25; good.push('A silky roux. Très bien.'); }
      if (a.caramelized) { tech += 0.25; good.push('Caramelized with patience. Bravo.'); }
      if (tech === 0) bad.push('Where is the technique? This is merely... boiled.');
      bad.push(...flawLines(a, { burnt: 'Burnt! An insult to the flame.', raw: 'Raw. Unacceptable.', mushy: 'Overcooked to mush. Non.', curdled: 'The cream has split. Amateur.', lumps: 'Lumps! Make a roux, as God intended.', greasy: 'Greasy. Pas du tout.', chemical: 'Extinguisher powder?! Mon dieu.' }));
      const s = 10 * (0.5 * bal + 0.35 * Math.min(1, tech) + 0.15) - a.flawSum * 12;
      return { score: s, good, bad };
    },
  },

  // Marty Stew (a Martha Stewart caricature): homey perfection. Tidy, balanced, warm, garnished, no sloppiness.
  marty: {
    id: 'marty', name: 'Marty Stew', title: 'The Domestic Doyenne',
    sens: { 'salty+': 1.5, heat: 1.3, aroma: 1.2, ingredients: 1.4, flaw: 1.2, technique: 0.7 }, theme: [200, 120, 150],
    sounds: { good: ['*dabs lips with a napkin*', 'Lovely.'], bad: ['*purses lips*', 'Oh, dear.'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [], bal = balanceOf(a);
      const warm = a.temp > 55 ? 1 : 0.5, tidy = a.flawSum < 0.05 ? 1 : 0.4;
      if (bal > 0.7 && tidy === 1) good.push("Beautifully balanced. It's a good thing.");
      if (Sim.used.has('herbs')) good.push('A fresh herb garnish. Such a nice touch.');
      if (warm < 1) bad.push('It should be served piping hot.');
      if (p.salty > 0.8) bad.push('Rather heavy-handed with the salt.');
      bad.push(...flawLines(a, { burnt: 'Scorched. I can taste the pan.', raw: 'This needed more time.', mushy: 'Mushy pasta. Timing is everything.', curdled: 'Split cream. Temper it next time.', lumps: 'Lumpy. Whisk, whisk, whisk.', greasy: 'A slick of grease on top. Skim it.', chemical: "That's... not a garnish." }));
      const s = 10 * (0.55 * bal + 0.15 * warm + 0.15 * tidy + 0.15) - a.flawSum * 10;
      return { score: s, good, bad };
    },
  },

  // President Obama: measured, fair, a fan of a hearty, well-balanced bowl (he's known for his chili).
  obama: {
    id: 'obama', name: 'President Obama', title: 'The Commander in Chef',
    sens: { salty: 0.6, heat: 0.3, sweet: 0.7, body: 0.7, technique: 0.8, ingredients: 0.8 }, theme: [60, 90, 150],
    sounds: { good: ['*nods thoughtfully*', 'Now, look.'], bad: ['*long pause*', 'Let me be clear.'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [], bal = balanceOf(a);
      const hearty = Math.min(1, a.chunkiness * 3 + p.body);
      if (bal > 0.7) good.push('This is a soup the whole country can get behind.');
      else if (bal > 0.5) good.push("It's a good start. There's work left to do, but it's a good start.");
      if (hearty > 0.6) good.push('Hearty. That is a bowl that feeds a family.');
      if (p.salty < 0.22) bad.push("Let me be clear: it needs salt.");
      if (p.heat > 0.7) bad.push("That's a little more heat than I campaigned on.");
      bad.push(...flawLines(a, { burnt: "It's burnt. We can do better than this.", raw: 'This needed more time. We can be patient.', mushy: 'The pasta went soft. That happens. Learn from it.', curdled: 'The cream split. We move forward.', lumps: 'Some lumps. Nobody is perfect.', greasy: 'A little greasy for my taste.', chemical: 'Is that a fire extinguisher? Somebody check on the chef.' }));
      const s = 10 * (0.6 * bal + 0.25 * hearty + 0.15) - a.flawSum * 8;
      return { score: s, good, bad };
    },
  },

  // The Ram: Gordo, transformed. He judges Primordial Soup alone. Everything must be in it; what impresses him is
  // depth (many layers), savoriness, richness, a little fire, and balance in the chaos. Burning it is unforgivable.
  // The extinguisher, in here, is just one more ingredient.
  ram: {
    id: 'ram', name: 'THE RAM', title: 'The Devil of the Kitchen', storyOnly: true,
    sens: {}, theme: [150, 20, 20],
    sounds: { good: ['*the horns glow*', 'HMMMM.'], bad: ['*the floor cracks*', 'PATHETIC.'] },
    evaluate(a) {
      const p = a.p, good = [], bad = [];
      const bal = Taste.score(p, { plate: false });
      // Every flavor note in the pot, not just the strongest few: he wants all of creation in there.
      const notes = Object.values(Sim.notes).filter((v) => v > 0.03).length;
      const layers = Math.min(1, notes / 7), depth = Math.min(1, p.umami * 0.7 + p.rich * 0.5), fire = p.heat > 0.15 && p.heat < 0.75 ? 1 : 0.4;
      if (layers > 0.8) good.push('Layer upon layer. Everything there is, in one bowl.');
      if (depth > 0.7) good.push('Deep. Dark. Rich. Like the pit itself.');
      if (fire === 1) good.push('Fire. GOOD.');
      if (bal < 0.5) bad.push('CHAOS without balance is just a MESS.');
      if (a.flaws.burnt > 0.2) bad.push('YOU BURNT IT. EVEN HELL HAS STANDARDS.');
      if (a.flaws.raw > 0.4) bad.push('RAW. Did you think I would not notice?');
      const flaws = a.flawSum - (a.flaws.chemical || 0) * 0.4;   // the extinguisher is an ingredient here, not a crime
      const s = 10 * (0.4 * Math.min(1, bal) + 0.25 * layers + 0.2 * depth + 0.15 * fire) - Math.max(0, flaws) * 8;
      return { score: s, good, bad };
    },
  },
});

// A judge who liked the dish (7+) still mentions what could be better, but gently.
const SOFTER = {
  'Thin as dishwater. Reduce it, or thicken it.': 'Perhaps a touch thin. A little reduction would help.',
  'Under-seasoned. A pinch more salt.': 'Perhaps a pinch more salt.',
  'Over-salted. Go lighter, or add water.': 'A little salty, perhaps.',
  'Undercooked. It needed more time on the heat.': 'A little more time on the heat, perhaps.',
  'It whispers! Brown something, add soy... make it SING!': 'It could be a bit more savory!',
  'No acid, no life! A splash of vinegar, or tomato!': 'Maybe a splash of acid to brighten it?',
  'Where is the heat? Give me a chili!': 'A little chili would make it pop!',
  'Bitter, and not the good kind. Something scorched?': 'A touch bitter in places.',
  "Oh dear, it's gone cold. Serve it hot, dear.": 'A little warmer next time, dear.',
  'A bit thin for me. More vegetables, dear?': 'I do like a few more vegetables, dear.',
  "Goodness, that's sour! A pinch of sugar softens it.": 'A tad sour for me, dear.',
  'All that salt! My blood pressure, dear!': 'A touch salty for me, dear.',
  'Oh my! Go easy on the chili for this old tongue.': 'A bit spicy for me, dear.',
  'Kinda bland. Got any salt back there?': 'Could maybe use a little salt.',
  'Kinda watery. Could use more stuff in it.': 'Could be a bit heartier.',
  "Whoa, salty. I'm gonna need a soda.": 'Little salty, maybe.',
  "It's pleasant. But where's the depth? Where's the spice?": 'A little spice would give it depth.',
  'Bland! SEASON it, you donkey!': 'Season it a touch more.',
  "Dishwater. D*** dishwater. REDUCE IT!": 'Could be thicker. Reduce it a bit.',
};
const soften = (line, score) => (line && score >= 7 && SOFTER[line]) || line;

// "Lovely crust." + "Under-seasoned." → "Lovely crust. But under-seasoned." (shouting stays shouting).
function butJoin(a, b) {
  if (!a || !b) return a || b;
  const word = pick(['But', 'However,']);
  const shout = b === b.toUpperCase() && /[A-Z]/.test(b);
  if (shout) return `${a} ${word.toUpperCase()} ${b}`;
  const keepCap = /^(I\b|I'|[A-Z]{2,})/.test(b);
  return `${a} ${word} ${keepCap ? b : b[0].toLowerCase() + b.slice(1)}`;
}

// When the dish served isn't the one ordered: each judge says so in their own way, then a word on the taste.
function wrongDishLine(j, level, wrong, r) {
  const dish = level.short.toLowerCase();
  const ing = wrong.missing.length ? ({ meat: 'beef' }[wrong.missing[0]] || wrong.missing[0]) : null;
  const lines = {
    joe: ing ? `Uh... I ordered the ${dish}? Where's the ${ing}?` : `Uh... I ordered the ${dish}? This is something else.`,
    biscuit: ing ? `Wait... where's the ${ing}?! This isn't ${dish}!` : `Sniff sniff... this isn't ${dish}!`,
    pounce: ing ? `A ${dish} without ${ing}? This is not a ${dish}.` : `I asked for a ${dish}. This is not a ${dish}.`,
    nanny: ing ? `Oh dear, there's no ${ing}. This isn't ${dish}, is it?` : `Oh dear, this isn't ${dish}, is it?`,
    gordo: ing ? `WHERE'S THE ${ing.toUpperCase()}?! This is NOT a ${dish.toUpperCase()}!` : `What IS this? It's NOT a ${dish.toUpperCase()}!`,
    paul: ing ? `No ${ing}. That isn't a ${dish}. Not even close.` : `That isn't a ${dish}. Not even close.`,
    dudeguy: ing ? `Dude. A ${dish} with no ${ing}? That's not a thing!` : `Bro, this is NOT a ${dish}.`,
    signore: ing ? `Where is the ${ing}? This is not ${dish}!` : `This? This is not ${dish}. Mamma mia.`,
    seonbae: ing ? `No ${ing}? Then it is not ${dish}.` : `This is not ${dish}. Try again.`,
    monsieur: ing ? `${dish[0].toUpperCase() + dish.slice(1)} without ${ing}? Non, non, non.` : `I ordered ${dish}. This is not ${dish}.`,
    marty: ing ? `Oh, dear. A ${dish} needs ${ing}.` : `This isn't ${dish}, is it?`,
    obama: ing ? `Let me be clear: a ${dish} has ${ing} in it.` : `I asked for ${dish}. This is something else entirely.`,
    ram: `THAT IS NOT WHAT I ASKED FOR.`,
  };
  const tasty = r.score >= 7 ? ' Tastes good, mind you.' : r.score >= 5 ? ' It tastes all right, I suppose.' : '';
  return pick(j.sounds.bad) + ' ' + lines[j.id] + tasty;
}

const JUDGE_IDS = Object.keys(JUDGE_ROSTER);
const JUDGE_SLOTS = [76, 160, 244];
// The three judges at the table right now (mutated in place, so references to it stay live).
const JUDGES = [];

const Judging = {
  active: false, t: 0, phase: 'walk', k: 0, results: [], verdict: null, analysis: null, typed: 0,

  // Seat three judges: the given ids, a level's tier panel, or (sandbox) three at random.
  setPanel(ids) {
    JUDGES.length = 0;
    const slots = ids.length === 1 ? [160] : JUDGE_SLOTS;   // a lone judge (The Ram) takes the middle seat
    ids.forEach((id, n) => JUDGES.push(Object.assign(Object.create(JUDGE_ROSTER[id]), { x: slots[n] })));
  },
  randomPanel() {
    const pool = JUDGE_IDS.filter((id) => !JUDGE_ROSTER[id].storyOnly), out = [];
    while (out.length < 3) out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    return out;
  },

  // opts.level: a career level (scored 0–10 against its recipe); opts.panel: judge ids to seat.
  start(opts = {}) {
    this.level = opts.level || null;
    this.setPanel(opts.panel || (this.level ? LEVEL_TIERS[this.level.tier].judges : this.randomPanel()));
    this.analysis = Taste.analyzeBowl();
    const a = this.analysis;
    if (typeof Plating !== 'undefined' && typeof document !== 'undefined') Plating.build(a);
    const raw = JUDGES.map((j) => (a.empty ? null : j.evaluate(a)));
    this.levelResult = !this.level ? null : a.empty ? Levels.empty(JUDGES.map((j) => j.id))
      : Levels.score(this.level, a, Sim.happened, Sim.used, JUDGES.map((j) => j.id), raw.map((r) => r.score));
    const L = this.levelResult;
    // The judge who cares most about technique tells you what the recipe was missing.
    const stickler = L && (L.missing.length || L.slipped.length || L.missingIng.length)
      ? JUDGES.reduce((b, j, n) => (judgeSens(j, 'technique') > judgeSens(JUDGES[b], 'technique') ? n : b), 0) : -1;
    // ...and the one (someone else, if possible) who minds the biggest drift from the recipe most says so.
    const gapKey = L && L.gap && L.gap.ax + (L.gap.d > 0 ? '+' : '-');
    const taster = L && L.gap && !L.judges.some((x) => x.flourish)
      ? JUDGES.reduce((b, j, n) => (n !== stickler && (b < 0 || judgeSens(j, gapKey) > judgeSens(JUDGES[b], gapKey)) ? n : b), -1) : -1;
    this.results = JUDGES.map((j, n) => {
      if (a.empty) return { score: 0, taste: 0, line: pick(['...Where is the food?', 'You served me an empty plate.', 'Is this a joke?']) };
      const r = raw[n], lj = L && L.judges[n];
      const score = Math.max(0, Math.min(10, Math.round(lj ? lj.score : r.score)));
      if (L && L.wrong) return { score, taste: r.score, line: wrongDishLine(j, this.level, L.wrong, r) };
      // Lead with praise or criticism depending on how it went, and join the two with a "but".
      const lines = score >= 6 ? [butJoin(pick(r.good.length ? r.good : ['Not bad.']), soften(r.bad[0], score))]
                               : [butJoin(pick(r.bad.length ? r.bad : ['Something is missing.']), r.good[0])];
      if (n === stickler) lines.push(L.missing.length ? `Where's the ${(DISCOVERIES.find((d) => d.id === L.missing[0]) || { name: L.missing[0] }).name.toLowerCase()}? It's in the recipe.`
                                   : L.slipped.length ? `And the ${(DISCOVERIES.find((d) => d.id === L.slipped[0]) || { name: L.slipped[0] }).name.toLowerCase()}... careful.`
                                   : `You left out the ${(SHELF.find((s) => s.id === L.missingIng[0]) || { name: L.missingIng[0] }).name.toLowerCase()}.`);
      if (n === taster) lines.push(`${L.gap.d < 0 ? 'Not' : 'Too'} ${AXIS_WORDS[L.gap.ax] || L.gap.ax}${L.gap.d < 0 ? ' enough' : ''} for a ${this.level.short.toLowerCase()}.`);
      if (lj && lj.flourish) lines.push(`The ${(SHELF.find((s) => s.id === L.extras[0]) || { name: L.extras[0] }).name.toLowerCase()}? Inspired.`);
      // Paul's rare handshake: a dish he scores 9 or more and genuinely loves (his own taste, 9+).
      const handshake = j.id === 'paul' && score >= 9 && r.score >= 9;
      const sound = handshake ? '*extends his hand*' : pick(score >= 6 ? j.sounds.good : j.sounds.bad);
      const line = sound + ' ' + lines.filter(Boolean).join(' ') + (handshake ? ' That deserves a handshake.' : '');
      return { score, taste: r.score, line, handshake };
    });
    this.handshake = this.results.some((r) => r.handshake);
    if (L) {
      this.avg = L.total;
      this.verdict = L.badge === 'perfect' ? 'PERFECT' : L.badge === 'good' ? 'GOOD SOUP' : L.passed ? 'PASSED' : 'CHOPPED';
    } else {
      const avg = this.results.reduce((s, r) => s + r.score, 0) / this.results.length;
      this.avg = avg;
      this.verdict = avg >= 7.5 ? 'WINNER' : avg >= 5 ? 'SAFE' : 'CHOPPED';
    }
    this.active = true; this.t = 0; this.phase = 'walk'; this.k = 0; this.typed = 0;
  },

  update() {
    if (!this.active) return;
    this.t++;
    if (this.phase === 'walk' && this.t > 70) this.next('taste');
    else if (this.phase === 'taste' && this.t > 45) this.next('speak');
    else if (this.phase === 'speak') this.typed = Math.min(this.results[this.k].line.length, this.typed + 0.8);
    else if (this.phase === 'deliberate' && this.t > 90) this.next('verdict');
  },

  next(phase) { this.phase = phase; this.t = 0; this.typed = 0; },

  click() {
    if (this.phase === 'speak') {
      const line = this.results[this.k].line;
      if (this.typed < line.length) { this.typed = line.length; return; }
      if (++this.k < JUDGES.length) this.next('taste'); else this.next('deliberate');
    } else if (this.phase === 'verdict' && this.t > 60) {
      this.next('done');
    }
  },

  // Buttons on the 'done' screen.
  buttons() {
    let list = [['keep', 'KEEP COOKING'], ['new', 'NEW POT'], ['menu', 'MENU']];
    if (this.level) {
      const next = typeof Game !== 'undefined' && this.levelResult && this.levelResult.passed && Game.nextLevel();
      list = [['retry', 'RETRY'], next ? ['next', 'NEXT DISH'] : null, ['menu', 'LEVEL SELECT']].filter(Boolean);
    }
    // Centered row of buttons.
    const w = 78, gap = 6, x0 = 160 - (list.length * w + (list.length - 1) * gap) / 2;
    return list.map(([id, label], n) => ({ id, label, x: Math.round(x0 + n * (w + gap)), y: 196, w, h: 18 }));
  },

  draw(g) {
    // Studio backdrop, the judges, then the table in front of them, then their paws and hands on it.
    g.drawImage(Sprites.canvas('backgrounds/stage', 'default', 0), 0, 0);
    JUDGES.forEach((j, n) => drawJudge(g, j, n, this));
    g.drawImage(Sprites.canvas('backgrounds/stage-table', 'default', 0), 0, 0);
    JUDGES.forEach((j, n) => drawPaws(g, j, n, this));

    // Bowl: carried in, then slides in front of each judge.
    const a = this.analysis;
    let bx = 160, bob = 0;
    if (this.phase === 'walk') bx = -30 + Math.min(1, this.t / 60) * 190;
    else if (this.phase === 'taste' || this.phase === 'speak') bx = JUDGES[this.k].x;
    if (this.phase === 'walk') bob = Math.round(Math.abs(Math.sin(this.t * 0.3)) * -2);
    if (Plating.plate) Plating.draw(g, bx, 138 + bob, this.t);
    else drawBowl(g, bx, 140 + bob, a);

    // Score cards for judges who have spoken.
    for (let n = 0; n < JUDGES.length; n++) {
      const shown = n < this.k || (n === this.k && this.phase === 'speak' && this.typed >= this.results[n].line.length) ||
                    ['deliberate', 'verdict', 'done'].includes(this.phase);
      if (!shown) continue;
      const x = JUDGES[n].x;
      rect(g, x + 29, 112, 2, 8, [150, 110, 80]);
      rect(g, x + 19, 95, 22, 18, [40, 24, 30]); rect(g, x + 20, 96, 20, 16, [255, 252, 240]);
    }
    // Dialogue box.
    if (this.phase === 'speak') {
      rect(g, 8, 172, W - 16, 62, [30, 20, 30]); rect(g, 9, 173, W - 18, 60, [252, 246, 232]);
      rect(g, 9, 173, W - 18, 12, JUDGES[this.k].theme);
    }
    // Verdict.
    if (this.phase === 'verdict' || this.phase === 'done') drawVerdict(g, this);
    if (this.phase === 'done') {
      for (const b of this.buttons()) { rect(g, b.x, b.y, b.w, b.h, [40, 24, 30]); rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, [250, 210, 90]); rect(g, b.x + 1, b.y + 1, b.w - 2, 2, [255, 240, 170]); }
    }
  },

  drawText(T) {
    for (let n = 0; n < JUDGES.length; n++) {
      T.text(JUDGES[n].name, JUDGES[n].x, 4, { size: 6, color: '#ffe9c0', align: 'center' });
      const shown = n < this.k || (n === this.k && this.phase === 'speak' && this.typed >= this.results[n].line.length) ||
                    ['deliberate', 'verdict', 'done'].includes(this.phase);
      if (shown) T.text(String(this.results[n].score), JUDGES[n].x + 30, 98, { size: 10, color: '#2a1820', align: 'center' });
    }
    if (this.phase === 'walk') T.text('Serving the judges...', 160, 205, { size: 8, color: '#ffe9c0', align: 'center' });
    if (this.phase === 'speak') {
      const j = JUDGES[this.k];
      T.text(j.name.toUpperCase() + ' - ' + j.title, 14, 175, { size: 6, color: '#fff' });
      T.wrap(this.results[this.k].line.slice(0, this.typed | 0), 14, 190, W - 28, { size: 7, color: '#2a1820' });
      if (this.typed >= this.results[this.k].line.length && (this.t >> 4) & 1) T.text('click >', W - 14, 224, { size: 6, color: '#8a6a70', align: 'right' });
    }
    if (this.phase === 'deliberate') T.text('The judges are deliberating...', 160, 205, { size: 8, color: '#ffe9c0', align: 'center' });
    if (this.phase === 'verdict' || this.phase === 'done') {
      const v = this.verdict;
      const label = { CHOPPED: 'CHOPPED!', SAFE: 'SAFE... THIS ROUND', WINNER: 'WINNER!', PASSED: 'PASSED', 'GOOD SOUP': 'GOOD SOUP!', PERFECT: 'PERFECT!' }[v];
      const col = v === 'CHOPPED' ? '#ff5050' : v === 'SAFE' || v === 'PASSED' ? '#ffd860' : '#7dff8a';
      if (this.t > 20 || this.phase === 'done') {
        T.text(label, 160, 166, { size: v === 'SAFE' || v === 'PASSED' ? 12 : 18, color: col, align: 'center', shadow: true });
        const L = this.levelResult;
        if (L) {
          const badge = L.badge === 'perfect' ? '  ·  Perfect badge!' : L.badge === 'good' ? '  ·  Good Soup badge' : '';
          T.text(`${this.level.title}: ${L.total.toFixed(1)} / 10${badge}${this.handshake ? '  ·  Handshake!' : ''}`, 160, 184, { size: 7, color: '#ffe9c0', align: 'center' });
        } else T.text('Average ' + this.avg.toFixed(1) + ' / 10', 160, 184, { size: 7, color: '#ffe9c0', align: 'center' });
      }
    }
    if (this.phase === 'done') for (const b of this.buttons()) T.text(b.label, b.x + b.w / 2, b.y + 6, { size: 6, color: '#3a2020', align: 'center' });
  },
};

function drawBowl(g, x, y, a) {
  ellipse(g, x, y + 9, 20, 4, [200, 190, 182]);
  ellipse(g, x, y, 19, 11, [30, 40, 70], 'bottom');
  ellipse(g, x, y, 18, 10, [70, 110, 190], 'bottom');
  rect(g, x - 12, y + 3, 6, 2, [120, 160, 230]);
  ellipse(g, x, y, 18, 4, [50, 80, 150]);
  // Soup surface tinted by its contents.
  const p = a ? a.p : null;
  let c = [140, 190, 230];
  if (p && !a.empty) {
    c = mix(c, [230, 180, 70], Math.min(1, p.rich));
    c = mix(c, [130, 70, 30], Math.min(0.8, p.umami * 0.6));
    c = mix(c, [200, 60, 40], Math.min(0.7, p.sour * 0.3 + p.heat * 0.3));
    c = mix(c, [246, 240, 226], Math.min(0.7, p.body * 0.5));
  }
  if (!a || !a.empty) { ellipse(g, x, y, 16, 3, c); rect(g, x - 6, y - 1, 4, 1, mix(c, [255, 255, 255], 0.5)); }
  // Steam.
  if (a && a.temp > 55) for (let k = 0; k < 3; k++) {
    const sy = y - 6 - ((Judging.t + k * 9) % 18);
    rect(g, x - 6 + k * 6 + Math.round(Math.sin((Judging.t + k * 20) * 0.15) * 2), sy, 1, 3, 'rgba(255,255,255,0.6)');
  }
}

const INK = [46, 30, 40], PINK = [255, 160, 176];

// Pixel triangle pointing up (for cat ears).
function tri(g, cx, baseY, w, h, c) {
  for (let k = 0; k < h; k++) {
    const hw = Math.max(0.5, (w / 2) * (k + 1) / h);
    rect(g, Math.round(cx - hw), baseY - h + k, Math.round(hw * 2), 1, c);
  }
}

function judgeState(J, n) {
  const active = (J.phase === 'taste' || J.phase === 'speak') && J.k === n;
  const r = J.results[n];
  const reacted = n < J.k || (active && J.phase === 'speak') || ['deliberate', 'verdict', 'done'].includes(J.phase);
  const mood = !reacted ? 'neutral' : r.score >= 7 ? 'happy' : r.score >= 5 ? 'meh' : 'upset';
  return { active, mood, tasting: active && J.phase === 'taste', ft: Chef.t + n * 37,
           handshake: !!(r && r.handshake) && (reacted && (J.k === n || ['deliberate', 'verdict', 'done'].includes(J.phase))) };
}

// Generic eye: dark oval, optional iris, sparkles, and an eyelid that covers the top `lid` fraction.
function eye(g, ex, ey, rx, ry, o = {}) {
  ellipse(g, ex, ey, rx, ry, INK);
  if (o.iris) { ellipse(g, ex + (o.look || 0), ey, rx - 1, ry - 1, o.iris); rect(g, ex + (o.look || 0), ey - ry + 1, 1, ry * 2 - 1, INK); }
  else if (o.look) rect(g, ex + o.look, ey, 1, 1, [80, 60, 80]);
  if (o.shine !== false) {
    rect(g, ex - rx + 1 + (o.look || 0), ey - ry + 1, o.big ? 3 : 2, o.big ? 3 : 2, [255, 255, 255]);
    rect(g, ex + rx - 2, ey + ry - 2, 1, 1, [255, 255, 255]);
  }
  if (o.lid) {
    const h = Math.round((ry * 2 + 1) * o.lid);
    rect(g, ex - rx - 1, ey - ry - 1, rx * 2 + 3, h + 1, o.fur);
    rect(g, ex - rx, ey - ry - 1 + h, rx * 2 + 1, 1, INK);
  }
}
function arcEye(g, ex, ey, w, up) { // ^ (up) or ‿ (down) closed eye
  const s = up ? -1 : 1;
  rect(g, ex - w, ey, 1, 1, INK); rect(g, ex - w + 1, ey + s, 1, 1, INK);
  rect(g, ex - w + 2, ey + 2 * s, w * 2 - 3, 1, INK);
  rect(g, ex + w - 1, ey + s, 1, 1, INK); rect(g, ex + w, ey, 1, 1, INK);
}
function heart(g, x, y, c) {
  rect(g, x, y, 2, 1, c); rect(g, x + 3, y, 2, 1, c); rect(g, x - 1, y + 1, 7, 2, c);
  rect(g, x, y + 3, 5, 1, c); rect(g, x + 1, y + 4, 3, 1, c); rect(g, x + 2, y + 5, 1, 1, c);
}

// ---- Sir Pounce: snooty cat. Tall and upright, nose in the air, smug half-lidded eyes, paw raised daintily.
function drawCat(g, j, J, s) {
  const x = j.x, { mood, ft } = s;
  const hx = x - 2, hy = 54 + (s.active ? Math.round(Math.sin(J.t * 0.15)) : 0);
  const sway = Math.sin(ft * 0.04);
  // Tail: tall S-curve with a curled tip.
  for (let k = 0; k <= 40; k++) {
    const a = k / 40, tx = Math.round(x + 16 + a * 8 + Math.sin(a * 5 + ft * 0.05) * 3 * a), ty = 112 - k;
    rect(g, tx - 3, ty, 7, 1, rgb(j.fur, 0.35));
    rect(g, tx - 2, ty, 5, 1, k > 32 || (k > 8 && k % 9 < 2) ? j.dark : j.fur);
    rect(g, tx - 2, ty, 1, 1, mix(j.fur, [255, 255, 255], 0.3));
  }
  rect(g, Math.round(x + 24 + Math.sin(5 + ft * 0.05) * 3) - 2, 71, 5, 1, rgb(j.fur, 0.35));
  // Slim upright body.
  ellipse(g, x, 98, 15, 24, rgb(j.fur, 0.35));
  ellipse(g, x, 98, 14, 23, j.fur);
  ellipse(g, x, 102, 8, 15, j.belly);
  // Ears (flattened back when upset).
  const flat = mood === 'upset';
  for (const sd of [-1, 1]) {
    const ex = hx + sd * (flat ? 16 : 11), eb = hy - (flat ? 6 : 10) - (sd < 0 ? 1 : 0);
    tri(g, ex, eb + 1, flat ? 14 : 14, flat ? 7 : 14, rgb(j.fur, 0.35));
    tri(g, ex, eb, flat ? 11 : 11, flat ? 6 : 12, j.fur);
    tri(g, ex, eb - 1, 5, flat ? 3 : 7, PINK);
  }
  // Head, slightly squashed and held high.
  ellipse(g, hx, hy, 19, 17, rgb(j.fur, 0.35));
  ellipse(g, hx, hy, 18, 16, j.fur);
  rect(g, hx - 10, hy - 11, 4, 3, mix(j.fur, [255, 255, 255], 0.4));
  for (let k = -1; k <= 1; k++) rect(g, hx + k * 4, hy - 16 + Math.abs(k), 2, 5 - Math.abs(k), j.dark);
  // Cheek fluff.
  for (const sd of [-1, 1]) { rect(g, hx + sd * 18 - (sd < 0 ? 2 : 0), hy + 3, 3, 2, j.fur); rect(g, hx + sd * 17 - (sd < 0 ? 1 : 0), hy + 6, 2, 2, j.fur); }
  // Eyes.
  const ey = hy - 1;
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 8;
    if (mood === 'happy') arcEye(g, ex, ey + 1, 3, false);                         // content, purring
    else if (mood === 'upset') { eye(g, ex, ey, 3, 3, { iris: [200, 220, 80], lid: 0.5, fur: j.fur });
      rect(g, ex - 3, ey - 5 + (sd > 0 ? 0 : 0), 7, 1, INK); rect(g, ex + (sd < 0 ? 2 : -3), ey - 6, 2, 1, INK); } // glare
    else eye(g, ex, ey, 3, 3, { iris: [130, 190, 90], lid: mood === 'meh' ? 0.6 : 0.45, fur: j.fur, look: 1 }); // smug side-eye
  }
  // Muzzle, nose pointed upward, whiskers.
  ellipse(g, hx - 2, hy + 7, 3, 2, j.belly); ellipse(g, hx + 2, hy + 7, 3, 2, j.belly);
  tri(g, hx, hy + 5, 4, 2, PINK);
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) rect(g, sd < 0 ? hx - 25 : hx + 15, hy + 4 + k * 2 - (k === 0 ? sd : 0), 10, 1, [110, 110, 130]);
  const my = hy + 8;
  if (s.tasting) { ellipse(g, hx, my + 1, 1, 1, [170, 60, 80]); rect(g, hx + 2, my - 6, 1, 8, [200, 206, 220]); }
  else if (mood === 'upset') { ellipse(g, hx, my + 1, 3, 2, [140, 40, 60]); rect(g, hx - 2, my, 1, 2, [255, 255, 255]); rect(g, hx + 2, my, 1, 2, [255, 255, 255]); } // hiss with fangs
  else if (mood === 'happy') { rect(g, hx - 2, my, 1, 1, INK); rect(g, hx - 1, my + 1, 1, 1, INK); rect(g, hx, my, 1, 1, INK); rect(g, hx + 1, my + 1, 1, 1, INK); rect(g, hx + 2, my, 1, 1, INK); }
  else { rect(g, hx - 1, my, 1, 1, INK); rect(g, hx, my + 1, 1, 1, INK); rect(g, hx + 1, my, 2, 1, INK); } // smirk
  ellipse(g, hx - 12, hy + 5, 2, 1, [255, 190, 200]); ellipse(g, hx + 12, hy + 5, 2, 1, [255, 190, 200]);
  // Dainty raised paw near the chin.
  const pawY = hy + 20 + (mood === 'happy' ? Math.round(Math.sin(ft * 0.2)) : 0);
  ellipse(g, x + 9, pawY + 6, 3, 7, j.fur);
  ball(g, x + 9, pawY, 4, j.fur);
  rect(g, x + 8, pawY - 4, 1, 2, rgb(j.fur, 0.6));
  // Emotes.
  if (mood === 'happy') { const ny = hy - 26 - ((ft >> 2) % 6); rect(g, hx + 18, ny, 1, 5, INK); rect(g, hx + 16, ny + 4, 3, 2, INK); rect(g, hx + 19, ny, 2, 1, INK); }
  if (mood === 'upset') { const vx = hx + 14, vy = hy - 14; rect(g, vx, vy, 1, 3, [230, 50, 60]); rect(g, vx + 3, vy, 1, 3, [230, 50, 60]); rect(g, vx - 1, vy + 1, 6, 1, [230, 50, 60]); }
}

// ---- Biscuit: excitable pup. Leans forward, head tilted, panting with tongue out.
function drawDog(g, j, J, s) {
  const x = j.x, { mood, ft } = s;
  const bounce = mood === 'happy' ? -Math.abs(Math.round(Math.sin(ft * 0.25) * 4)) : Math.round(Math.sin(ft * 0.12));
  const tilt = mood === 'meh' ? 3 : mood === 'upset' ? 0 : 2;
  const hx = x, hy = 66 + bounce;
  // Wagging tail.
  const wag = Math.sin(ft * (mood === 'happy' ? 0.6 : mood === 'upset' ? 0.05 : 0.25)) * (mood === 'upset' ? 0.1 : 0.8);
  for (let k = 0; k < 8; k++) ball(g, x + 20 + Math.sin(wag) * k * 2, 100 - Math.cos(wag) * k * 2 + (mood === 'upset' ? k * 2 : 0), k > 5 ? 4 : 3, j.fur, k === 0);
  // Wide, low body leaning in.
  ellipse(g, x, 104 + bounce / 2, 25, 18, rgb(j.fur, 0.35));
  ellipse(g, x, 104 + bounce / 2, 24, 17, j.fur);
  ellipse(g, x, 110 + bounce / 2, 13, 10, j.belly);
  // Big round head.
  ball(g, hx, hy, 21, j.fur);
  ball(g, hx - 1, hy - 20, 3, j.dark, false);
  ellipse(g, hx - 8 - tilt, hy, 7, 7, j.dark);                          // eye patch
  // Ears: left floppy, right flipped up inside-out (unless sad: both droop).
  const ear = (sd) => {
    const flap = mood === 'happy' ? Math.round(Math.sin(ft * 0.5 + sd)) * 2 : 0;
    const droop = mood === 'upset' ? 4 : 0;
    ellipse(g, hx + sd * 20, hy + 4 + droop + flap, 7, 14, rgb(j.dark, 0.45));
    ellipse(g, hx + sd * 20, hy + 4 + droop + flap, 6, 13, j.dark);
    ellipse(g, hx + sd * 19, hy + droop + flap, 2, 6, rgb(j.dark, 1.2));
  };
  ear(-1); ear(1);
  // Muzzle + nose.
  ellipse(g, hx + tilt, hy + 9, 11, 7, j.belly);
  ellipse(g, hx + tilt, hy + 5, 4, 3, INK); rect(g, hx + tilt - 2, hy + 3, 2, 1, [160, 160, 180]);
  // Eyes: huge and round, one slightly higher for the head tilt.
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 9 + (sd < 0 ? -tilt : 0), ey = hy - 1 + (sd > 0 ? -tilt / 2 : tilt / 2);
    if (mood === 'happy') arcEye(g, ex, ey + 1, 4, true);
    else {
      eye(g, ex, ey, 4, 5, { big: true });
      if (mood === 'upset') { rect(g, ex - 3, ey - 1, 2, 2, [255, 255, 255]); rect(g, ex + (sd < 0 ? 1 : -4), ey - 8 + (sd < 0 ? 1 : 0), 4, 1, INK); } // puppy eyes
      else rect(g, ex - 2, ey - 8 - (mood === 'meh' && sd > 0 ? 2 : 0), 3, 1, INK);                                   // eyebrow dots
    }
  }
  // Mouth: panting, tongue out.
  const my = hy + 10;
  if (s.tasting) { ellipse(g, hx + tilt, my + 1, 2, 2, [170, 60, 80]); rect(g, hx + tilt + 3, my - 8, 2, 10, [200, 206, 220]); }
  else if (mood === 'upset') { rect(g, hx + tilt - 2, my + 1, 1, 1, INK); rect(g, hx + tilt - 1, my, 3, 1, INK); rect(g, hx + tilt + 2, my + 1, 1, 1, INK); }
  else {
    ellipse(g, hx + tilt, my + 1, 4, 3, [150, 50, 70], 'bottom');
    const tl = mood === 'happy' ? 6 + Math.round(Math.sin(ft * 0.5) * 1.5) : 4 + ((ft >> 3) & 1);
    rect(g, hx + tilt - 2, my + 2, 5, tl, [255, 120, 140]); rect(g, hx + tilt, my + 3, 1, tl - 2, [230, 90, 110]);
  }
  ellipse(g, hx - 15, hy + 7, 3, 1, [255, 150, 160]); ellipse(g, hx + 15, hy + 7, 3, 1, [255, 150, 160]);
  // Emotes.
  if (mood === 'happy') for (let k = 0; k < 3; k++) { const sx = hx - 24 + k * 22, sy = hy - 24 - ((ft + k * 7) % 10); rect(g, sx, sy - 1, 1, 3, [255, 230, 90]); rect(g, sx - 1, sy, 3, 1, [255, 230, 90]); }
  if (mood === 'meh') { const qx = hx + 22, qy = hy - 26; rect(g, qx, qy, 4, 1, INK); rect(g, qx + 4, qy + 1, 1, 2, INK); rect(g, qx + 2, qy + 3, 2, 1, INK); rect(g, qx + 2, qy + 4, 1, 1, INK); rect(g, qx + 2, qy + 6, 1, 1, INK); }
  if (mood === 'upset') { const dy = hy - 10 + ((ft >> 2) % 8); rect(g, hx + 19, dy, 2, 3, [140, 200, 255]); }
}

// ---- Nanny Mae: cozy old goat. Squat and round, sleepy smile, glasses on her snout, always chewing, holding tea.
function drawGoat(g, j, J, s) {
  const x = j.x, { mood, ft } = s;
  const hx = x, hy = 72 + (s.active ? Math.round(Math.sin(J.t * 0.12)) : 0);
  const chew = ((ft >> 4) & 1) ? 1 : -1;
  // Squat, round body.
  ellipse(g, x, 106, 27, 17, rgb(j.fur, 0.4));
  ellipse(g, x, 106, 26, 16, j.fur);
  ellipse(g, x, 110, 15, 10, j.belly);
  for (let k = 0; k < 5; k++) ball(g, x - 20 + k * 10, 92 + (k & 1), 4, j.fur, false);    // woolly shoulders
  ball(g, x + 25, 104, 4, j.fur);                                                           // tail puff
  // Horns + droopy ears.
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 6; k++) ball(g, hx + sd * (6 + k * 1.2), hy - 15 - k + (k > 3 ? k - 3 : 0), 2, j.dark, k === 0);
    const droop = mood === 'upset' ? 2 : 6;
    for (let k = 0; k < 9; k++) ellipse(g, hx + sd * (16 + k), hy - 2 + k * droop / 8, 3, 2, j.fur);
    ellipse(g, hx + sd * 21, hy + 1, 3, 1, PINK);
  }
  // Head: soft and wide.
  ellipse(g, hx, hy, 18, 16, rgb(j.fur, 0.4));
  ellipse(g, hx, hy, 17, 15, j.fur);
  for (let k = -1; k <= 1; k++) ball(g, hx + k * 5, hy - 15 + Math.abs(k) * 2, 3, j.fur, false);   // fluffy fringe
  // Flower.
  for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) ball(g, hx + 12 + dx, hy - 13 + dy, 1, PINK, false);
  rect(g, hx + 12, hy - 13, 1, 1, [255, 220, 80]);
  // Eyes: sleepy and kind.
  const ey = hy - 1;
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 7;
    if (mood === 'happy') arcEye(g, ex, ey, 3, true);
    else if (mood === 'upset') { eye(g, ex, ey, 2, 2, { shine: false }); rect(g, ex - 3, ey - 4 + (sd < 0 ? 0 : 0), 3, 1, INK); rect(g, ex, ey - 5 + (sd < 0 ? 1 : -0), 3, 1, INK); }
    else if (mood === 'meh') { eye(g, ex, ey, 2, 3, { lid: 0.5, fur: j.fur }); if (sd > 0) rect(g, ex - 2, ey - 6, 5, 1, INK); }
    else arcEye(g, ex, ey + 1, 3, false);                                   // gentle closed "‿" eyes
  }
  // Snout (chews side to side), glasses perched on it.
  const sx = hx + (s.tasting ? 0 : chew);
  ellipse(g, sx, hy + 9, 9, 6, [252, 228, 226]);
  rect(g, sx - 3, hy + 7, 2, 1, [200, 140, 140]); rect(g, sx + 2, hy + 7, 2, 1, [200, 140, 140]);
  for (const sd of [-1, 1]) { ellipse(g, hx + sd * 7, ey + 4, 4, 3, [120, 90, 160]); ellipse(g, hx + sd * 7, ey + 4, 3, 2, [236, 236, 250]); }
  rect(g, hx - 3, ey + 3, 6, 1, [120, 90, 160]);
  // Goat mouth: a split upper lip (philtrum) over a soft lower lip.
  const my = hy + 11, lip = [170, 110, 120];
  rect(g, sx, hy + 9, 1, 2, lip);
  if (s.tasting) { ellipse(g, sx, my + 1, 2, 1, [170, 60, 80]); }
  else if (mood === 'happy') {
    rect(g, sx - 4, my - 1, 1, 1, lip); rect(g, sx - 3, my, 3, 1, lip); rect(g, sx + 1, my, 3, 1, lip); rect(g, sx + 4, my - 1, 1, 1, lip);
    rect(g, sx - 2, my + 1, 5, 1, [200, 90, 110]); rect(g, sx - 1, my + 2, 3, 1, [200, 90, 110]);
  } else if (mood === 'upset') {
    rect(g, sx - 3, my + 1, 3, 1, lip); rect(g, sx + 1, my + 1, 3, 1, lip); rect(g, sx - 4, my + 2, 1, 1, lip); rect(g, sx + 4, my + 2, 1, 1, lip);
  } else {
    rect(g, sx - 1, my, 1, 1, lip); rect(g, sx - 3, my + 1, 2, 1, lip); rect(g, sx + 1, my, 1, 1, lip); rect(g, sx + 2, my + 1, 2, 1, lip);
    rect(g, sx - 1, my + 2, 3, 1, rgb(lip, 1.15));
  }
  // Beard.
  for (let k = 0; k < 6; k++) rect(g, sx - 3 + k / 2, hy + 15 + k, 7 - k, 1, k === 5 ? j.dark : j.belly);
  ellipse(g, hx - 13, hy + 5, 3, 1, [255, 180, 190]); ellipse(g, hx + 13, hy + 5, 3, 1, [255, 180, 190]);
  // Emotes.
  if (mood === 'happy') for (let k = 0; k < 2; k++) heart(g, hx - 22 + k * 40, hy - 22 - ((ft + k * 15) % 14), [255, 110, 140]);
  if (mood === 'upset') { const py = hy - 20 - ((ft >> 2) % 5); ellipse(g, hx + 20, py, 3, 2, [220, 224, 236]); ellipse(g, hx + 24, py - 2, 2, 1, [220, 224, 236]); }
}

// The pose a judge's sprite shows for a state (a row of their sprite sheet).
function judgePose(j, s) {
  if (s.handshake) return 'handshake';
  if (s.tasting) return 'tasting';
  if (j.id === 'gordo' && s.mood === 'upset' && s.active) return 'rant';
  return s.mood;
}
function drawJudge(g, j, n, J) {
  const s = judgeState(J, n);
  Sprites.draw(g, 'judges/' + j.id, judgePose(j, s), s.ft, j.x, 0, { j, J, s });
}

// Front layer resting on the table: paws, hands, teacup.
function drawPaws(g, j, n, J) {
  const s = judgeState(J, n), pose = judgePose(j, s);
  Sprites.draw(g, 'judges/' + j.id + '-front', pose, pose === 'handshake' ? (J.typed || 0) + J.t : s.ft, j.x, 0, { j, J, s });
}

function paw(g, px, py, c, big) {
  ellipse(g, px, py, big ? 6 : 4, 3, rgb(c, 0.4));
  ellipse(g, px, py - 1, big ? 5 : 3, 3, c);
  rect(g, px - 1, py + 1, 1, 2, rgb(c, 0.6)); rect(g, px + 1, py + 1, 1, 2, rgb(c, 0.6));
}
// A human hand resting on the table, with a sleeve cuff.
function hand(g, px, py, skin, sleeve) {
  ellipse(g, px, py + 1, 6, 3, rgb(sleeve, 0.45)); ellipse(g, px, py, 5, 3, sleeve);
  ball(g, px, py - 2, 3, skin);
  rect(g, px - 2, py - 1, 1, 2, rgb(skin, 0.75)); rect(g, px + 1, py - 1, 1, 2, rgb(skin, 0.75));
}

// ---- Joe: the pizza-shop regular. Ball cap, hoodie, stubble, an easy grin. Leans back, relaxed.
function drawJoe(g, j, J, s) {
  const x = j.x, { mood, ft } = s, skin = j.skin;
  const hx = x, hy = 62 + (s.active ? Math.round(Math.sin(J.t * 0.12)) : 0) + (mood === 'happy' ? Math.round(Math.sin(ft * 0.2)) : 0);
  // Hoodie, hood bunched behind the neck, drawstrings.
  ellipse(g, x, 105, 25, 18, rgb(j.hoodie, 0.4)); ellipse(g, x, 105, 24, 17, j.hoodie);
  ellipse(g, x, 84, 14, 6, rgb(j.hoodie, 0.8));
  rect(g, x - 4, 88, 1, 12, [240, 240, 240]); rect(g, x + 3, 88, 1, 12, [240, 240, 240]);
  rect(g, x - 9, 104, 18, 8, rgb(j.hoodie, 0.85)); rect(g, x - 9, 104, 18, 1, rgb(j.hoodie, 0.7));   // front pocket
  rect(g, hx - 7, hy + 10, 14, 86 - hy - 8, rgb(skin, 0.85));   // neck
  // Head.
  ball(g, hx, hy, 15, skin);
  ball(g, hx - 15, hy + 2, 3, skin, false); ball(g, hx + 15, hy + 2, 3, skin, false);
  // A shadow of stubble around the chin.
  for (let k = 0; k < 9; k++) { const a = 0.6 + k / 8 * 1.95; rect(g, Math.round(hx + Math.cos(a) * 10), Math.round(hy + 6 + Math.sin(a) * 6), 2, 1, rgb(skin, 0.9)); }
  // Ball cap, bill toward us.
  ellipse(g, hx, hy - 6, 16, 11, rgb(j.cap, 0.5), 'top');
  ellipse(g, hx, hy - 6, 15, 10, j.cap, 'top');
  rect(g, hx - 1, hy - 16, 2, 2, rgb(j.cap, 0.7));
  ellipse(g, hx, hy - 5, 17, 3, rgb(j.cap, 0.75));
  rect(g, hx - 6, hy - 12, 12, 4, [255, 255, 255]); rect(g, hx - 5, hy - 11, 10, 2, j.cap);   // logo patch
  // Eyes and brows.
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 6, ey = hy + 1;
    if (mood === 'happy') arcEye(g, ex, ey, 2, true);
    else { eye(g, ex, ey, 2, 2, { shine: true }); }
    const bt = mood === 'upset' ? (sd < 0 ? 1 : -1) : mood === 'meh' && sd > 0 ? -1 : 0;
    rect(g, ex - 2, ey - 4 + bt, 5, 1, [90, 60, 40]);
  }
  rect(g, hx, hy + 4, 1, 2, rgb(skin, 0.7));   // nose
  const my = hy + 8;
  if (s.tasting) { ellipse(g, hx, my, 2, 1, [150, 60, 60]); rect(g, hx + 3, my - 8, 1, 9, [200, 206, 220]); }
  else if (mood === 'happy') { ellipse(g, hx, my, 5, 3, [150, 50, 60], 'bottom'); rect(g, hx - 3, my, 7, 1, [255, 255, 255]); }
  else if (mood === 'upset') { rect(g, hx - 3, my + 1, 1, 1, INK); rect(g, hx - 2, my, 5, 1, INK); rect(g, hx + 3, my + 1, 1, 1, INK); }
  else if (mood === 'meh') { rect(g, hx - 3, my, 6, 1, INK); }
  else { rect(g, hx - 3, my, 1, 1, INK); rect(g, hx - 2, my + 1, 5, 1, INK); rect(g, hx + 3, my, 1, 1, INK); }
  if (mood === 'happy') for (let k = 0; k < 2; k++) { const sx = hx - 20 + k * 40, sy = hy - 18 - ((ft + k * 9) % 10); rect(g, sx, sy - 1, 1, 3, [255, 230, 90]); rect(g, sx - 1, sy, 3, 1, [255, 230, 90]); }
  if (mood === 'upset') { const dy = hy - 6 + ((ft >> 2) % 8); rect(g, hx + 15, dy, 2, 3, [140, 200, 255]); }
}
function frontJoe(g, j, J, s) {
  const x = j.x;
  hand(g, x - 18, 121, j.skin, j.hoodie);
  // Right hand drums the table while he waits; holds a soda otherwise.
  if (s.mood === 'neutral' && !s.active) hand(g, x + 18, 121 - ((s.ft >> 3) & 1), j.skin, j.hoodie);
  else { rect(g, x + 15, 108, 7, 12, [200, 40, 40]); rect(g, x + 15, 108, 7, 2, [230, 230, 236]); rect(g, x + 16, 112, 5, 3, [255, 255, 255]); rect(g, x + 18, 104, 1, 4, [250, 250, 250]); hand(g, x + 18, 121, j.skin, j.hoodie); }
}

// ---- Gordo Hamsie: spiky blond hair, a forehead of furrows, chef whites, and a temper.
function drawGordo(g, j, J, s) {
  const x = j.x, { mood, ft } = s;
  const shake = mood === 'upset' && s.active ? ((ft >> 1) & 1 ? 1 : -1) : 0;
  const hx = x + shake, hy = 60 + (mood === 'upset' ? -1 : 0);
  const skin = mood === 'upset' ? mix(j.skin, [235, 90, 80], 0.45 + Math.sin(ft * 0.3) * 0.1) : j.skin;
  // Chef whites, double-breasted.
  ellipse(g, x, 104, 25, 19, rgb(j.coat, 0.45)); ellipse(g, x, 104, 24, 18, j.coat);
  rect(g, x - 1, 88, 2, 30, [214, 216, 226]);
  for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) rect(g, x + sd * 7 - 1, 94 + k * 7, 2, 2, [60, 60, 70]);
  rect(g, x - 9, 84, 18, 4, j.coat); rect(g, x - 9, 87, 18, 1, [214, 216, 226]);   // collar
  ellipse(g, x + 14, 92, 3, 2, [60, 70, 140]);   // embroidered name tag
  rect(g, hx - 8, hy + 10, 16, 86 - hy - 8, rgb(skin, 0.85));   // neck
  // Head: square jaw.
  ball(g, hx, hy, 15, skin);
  rect(g, hx - 11, hy + 4, 22, 8, skin); ellipse(g, hx, hy + 11, 11, 4, skin);
  ball(g, hx - 15, hy + 2, 3, skin, false); ball(g, hx + 15, hy + 2, 3, skin, false);
  // Spiky blond hair.
  for (let k = -3; k <= 3; k++) tri(g, hx + k * 4 + (k & 1), hy - 10 + Math.abs(k), 6, 12 - Math.abs(k) * 2 + (k & 1) * 2, j.hair);
  ellipse(g, hx, hy - 11, 14, 4, j.hair);
  rect(g, hx - 12, hy - 12, 24, 1, mix(j.hair, [255, 255, 255], 0.4));
  // The famous forehead: deep furrows, deeper when he's cross.
  const lines = mood === 'happy' ? 1 : mood === 'upset' ? 4 : 3;
  for (let k = 0; k < lines; k++) rect(g, hx - 7 + (k & 1), hy - 6 + k * 2 - (lines > 3 ? 1 : 0), 14 - (k & 1) * 2, 1, rgb(skin, 0.72));
  // Brows and squinting eyes.
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 6, ey = hy + 2;
    if (mood === 'happy') arcEye(g, ex, ey, 2, true);
    else if (mood === 'upset') { eye(g, ex, ey, 2, 2, { shine: false }); rect(g, ex - 3, ey - 4 + (sd < 0 ? 0 : 0), 6, 2, j.brow); rect(g, ex + (sd < 0 ? 2 : -3), ey - 3, 2, 1, j.brow); }
    else { eye(g, ex, ey, 2, 1, { shine: false }); rect(g, ex - 3, ey - 3, 6, 1, j.brow); }
  }
  rect(g, hx, hy + 4, 1, 3, rgb(skin, 0.7));
  // Mouth: tight line, a rare smile, or full shout.
  const my = hy + 11;
  if (s.tasting) { ellipse(g, hx, my, 2, 1, [150, 60, 60]); rect(g, hx + 3, my - 9, 1, 10, [200, 206, 220]); }
  else if (mood === 'upset') { ellipse(g, hx, my + 1, 5, 4, [90, 20, 30]); rect(g, hx - 4, my - 2, 8, 1, [255, 255, 255]); ellipse(g, hx, my + 3, 3, 1, [220, 90, 100]); }
  else if (mood === 'happy') { rect(g, hx - 4, my, 1, 1, INK); rect(g, hx - 3, my + 1, 6, 1, INK); rect(g, hx + 3, my, 1, 1, INK); }
  else rect(g, hx - 4, my + 1, 8, 1, INK);
  // Emotes: steam from the ears when furious.
  if (mood === 'upset') for (const sd of [-1, 1]) { const py = hy - 2 - ((ft + (sd > 0 ? 6 : 0)) >> 2) % 8; ellipse(g, hx + sd * 20, py, 2, 2, [240, 240, 246]); }
  if (mood === 'happy') { const sx = hx + 20, sy = hy - 18 - ((ft >> 3) % 3); rect(g, sx, sy - 1, 1, 3, [255, 230, 90]); rect(g, sx - 1, sy, 3, 1, [255, 230, 90]); }
}
function frontGordo(g, j, J, s) {
  const x = j.x;
  if (s.mood === 'upset' && s.active) {
    // Pointing straight at you.
    hand(g, x - 16, 121, j.skin, j.coat);
    ellipse(g, x + 10, 116, 6, 4, j.coat); ball(g, x + 6, 114, 3, j.skin); rect(g, x - 2, 113, 7, 2, j.skin);
  } else if (s.mood === 'neutral') {
    // Arms folded on the table.
    ellipse(g, x, 117, 22, 5, rgb(j.coat, 0.45)); ellipse(g, x, 116, 21, 4, j.coat);
    rect(g, x - 20, 115, 40, 1, [214, 216, 226]);
    ball(g, x - 14, 115, 3, j.skin); ball(g, x + 14, 115, 3, j.skin);
  } else { hand(g, x - 18, 121, j.skin, j.coat); hand(g, x + 18, 121, j.skin, j.coat); }
}

// ---- Paul Bollywood: silver hair swept back, a silver goatee, and piercing blue eyes. Open-collar shirt.
function drawPaul(g, j, J, s) {
  const x = j.x, { mood, ft } = s, skin = j.skin;
  const hx = x, hy = 61 + (s.active ? Math.round(Math.sin(J.t * 0.1)) : 0);
  const tilt = mood === 'meh' ? 1 : 0;
  // Dark shirt, open collar.
  ellipse(g, x, 105, 24, 18, rgb(j.shirt, 0.5)); ellipse(g, x, 105, 23, 17, j.shirt);
  for (let k = 0; k < 8; k++) rect(g, x - 4 + Math.floor(k / 2), 86 + k, 8 - Math.floor(k / 2) * 2, 1, skin);   // V of the open collar
  tri(g, x - 7, 90, 7, 5, rgb(j.shirt, 1.35)); tri(g, x + 7, 90, 7, 5, rgb(j.shirt, 1.35));
  rect(g, hx - 7, hy + 10, 14, 86 - hy - 8, rgb(skin, 0.85));   // neck
  // Head.
  ball(g, hx, hy, 15, skin);
  ball(g, hx - 15, hy + 2, 3, skin, false); ball(g, hx + 15, hy + 2, 3, skin, false);
  // Short cropped silver hair, textured and pushed up a little at the front.
  ellipse(g, hx, hy - 8, 15, 8, rgb(j.hair, 0.6), 'top'); ellipse(g, hx, hy - 8, 14, 7, j.hair, 'top');
  for (let k = -2; k <= 2; k++) tri(g, hx + k * 5, hy - 13 + Math.abs(k), 5, 3, j.hair);
  for (let k = 0; k < 6; k++) rect(g, hx - 11 + k * 4, hy - 13 + (k & 1) * 2, 2, 1, mix(j.hair, [255, 255, 255], 0.55));
  rect(g, hx - 15, hy - 8, 2, 6, j.hair); rect(g, hx + 13, hy - 8, 2, 6, j.hair);   // close-cropped sides
  // Short silver beard along the jaw, joining the goatee.
  for (let k = 0; k < 13; k++) { const a = 0.25 + k / 12 * 2.64; rect(g, Math.round(hx + Math.cos(a) * 13) - 1, Math.round(hy + 3 + Math.sin(a) * 11), 3, 2, rgb(j.hair, 0.92)); }
  // Eyes: piercing blue, with a skeptical brow.
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 6, ey = hy + 1 + (sd > 0 ? -tilt : 0);
    if (mood === 'happy') arcEye(g, ex, ey, 2, true);
    else {
      rect(g, ex - 2, ey - 1, 5, 3, [255, 255, 255]);
      rect(g, ex - 1 + (mood === 'upset' ? 0 : sd < 0 ? 1 : 0), ey - 1, 2, 3, j.iris);
      rect(g, ex + (mood === 'upset' ? 0 : sd < 0 ? 1 : 0), ey, 1, 1, INK);
      rect(g, ex - 2, ey - 2, 5, 1, rgb(skin, 0.6));
    }
    const raise = mood === 'meh' && sd > 0 ? -2 : mood === 'upset' ? (sd < 0 ? 1 : 1) : 0;
    rect(g, ex - 3, ey - 4 + raise, 6, 1, j.hair);
  }
  rect(g, hx, hy + 4, 1, 3, rgb(skin, 0.75));
  // Silver goatee and moustache framing the mouth.
  const my = hy + 9;
  rect(g, hx - 4, my - 2, 8, 1, j.hair);
  ellipse(g, hx, my + 4, 4, 3, j.hair);
  rect(g, hx - 4, my - 1, 1, 4, j.hair); rect(g, hx + 3, my - 1, 1, 4, j.hair);
  if (s.tasting) { ellipse(g, hx, my, 2, 1, [130, 50, 50]); rect(g, hx + 3, my - 8, 1, 9, [200, 206, 220]); }
  else if (mood === 'happy') { rect(g, hx - 2, my, 5, 1, [255, 255, 255]); rect(g, hx - 3, my - 1, 1, 1, INK); rect(g, hx + 3, my - 1, 1, 1, INK); }
  else if (mood === 'upset') { rect(g, hx - 2, my + 1, 5, 1, INK); }
  else rect(g, hx - 2, my, 5, 1, INK);
  if (s.handshake) for (let k = 0; k < 4; k++) { const a = ft * 0.08 + k * 1.57; rect(g, Math.round(hx + Math.cos(a) * 24), Math.round(hy + 30 + Math.sin(a) * 8), 2, 2, [255, 230, 90]); }
}
function framePaul(g, j, J, s) {
  const x = j.x;
  if (s.handshake) {
    // The handshake: his arm reaches across the table, past the bowl, a big open hand held out to you.
    hand(g, x - 18, 121, j.skin, j.shirt);
    const reach = Math.min(1, ((J.typed || 0) + J.t) / 30), hx = Math.round(x + 30 + reach * 8), hy = Math.round(112 + reach * 20);
    for (let k = 0; k <= 10; k++) { const ax = x + 14 + (hx - x - 14) * k / 10, ay = 104 + (hy - 104) * k / 10; ellipse(g, ax, ay, 5, 4, rgb(j.shirt, 0.6)); ellipse(g, ax, ay - 1, 4, 3, j.shirt); }
    rect(g, hx - 5, hy - 5, 10, 3, [250, 250, 252]);   // shirt cuff
    ellipse(g, hx, hy + 2, 7, 6, rgb(j.skin, 0.55)); ellipse(g, hx, hy + 1, 6, 5, j.skin);
    for (let f = 0; f < 4; f++) rect(g, hx - 4 + f * 2, hy + 5, 1, 3, rgb(j.skin, 0.75));   // fingers
    rect(g, hx - 8, hy - 1, 3, 2, j.skin); rect(g, hx - 9, hy - 2, 2, 2, j.skin);         // thumb up
  } else { hand(g, x - 18, 121, j.skin, j.shirt); hand(g, x + 18, 121, j.skin, j.shirt); }
}

// ---- Placeholder judges (the Second and Third Michelin Star panels, and The Ram): the plain sketch every redraw
// starts from, with one telltale feature each so they can be told apart while playtesting.
const SK_FILL = [226, 222, 214], SK_INK = [40, 30, 40];
function sketchJudge(feature, skin = SK_FILL) {
  return {
    body(g, j, J, s) {
      const x = j.x, bob = s.active ? Math.round(Math.sin(J.t * 0.12)) : 0, hy = 60 + bob;
      ellipse(g, x, 109, 27, 23, SK_INK); ellipse(g, x, 108, 26, 22, rgb(j.theme, 1.2));   // shirt in their color
      rect(g, x - 6, 72 + bob, 12, 16, skin);
      ellipse(g, x, hy, 17, 17, SK_INK); ellipse(g, x, hy, 16, 16, skin);
      rect(g, x - 6, hy - 2, 2, 2, SK_INK); rect(g, x + 4, hy - 2, 2, 2, SK_INK);   // eyes
      const my = hy + 8;
      if (s.tasting) { ellipse(g, x, my, 2, 1, [150, 60, 60]); rect(g, x + 3, my - 8, 1, 9, [200, 206, 220]); }
      else if (s.mood === 'happy') { rect(g, x - 4, my, 1, 1, SK_INK); rect(g, x - 3, my + 1, 6, 1, SK_INK); rect(g, x + 3, my, 1, 1, SK_INK); }
      else if (s.mood === 'upset') { rect(g, x - 4, my + 1, 1, 1, SK_INK); rect(g, x - 3, my, 6, 1, SK_INK); rect(g, x + 3, my + 1, 1, 1, SK_INK); }
      else rect(g, x - 3, my, 6, 1, SK_INK);
      feature(g, x, hy, s);
    },
    front(g, j) { for (const sd of [-1, 1]) { ellipse(g, j.x + sd * 18, 121, 7, 4, SK_INK); ellipse(g, j.x + sd * 18, 120, 6, 3, skin); } },
  };
}
const SKETCH_JUDGES = {
  dudeguy: sketchJudge((g, x, hy) => {   // spiky bleached hair and shades
    for (let k = -3; k <= 3; k++) tri(g, x + k * 5, hy - 13, 5, 7, [250, 226, 90]);
    rect(g, x - 9, hy - 3, 18, 3, [20, 20, 24]);
  }),
  signore: sketchJudge((g, x, hy) => { rect(g, x - 9, hy - 27, 18, 13, [252, 252, 252]); ellipse(g, x, hy - 27, 11, 5, [252, 252, 252]); rect(g, x - 9, hy - 15, 18, 1, [200, 200, 210]); }),   // toque
  seonbae: sketchJudge((g, x, hy) => { ellipse(g, x, hy - 9, 16, 9, [30, 26, 30], 'top'); }),   // neat dark hair
  monsieur: sketchJudge((g, x, hy) => { ellipse(g, x + 2, hy - 13, 15, 5, [40, 50, 110]); rect(g, x + 1, hy - 20, 2, 3, [40, 50, 110]); rect(g, x - 6, hy + 5, 12, 1, [60, 40, 30]); rect(g, x - 7, hy + 4, 1, 1, [60, 40, 30]); rect(g, x + 6, hy + 4, 1, 1, [60, 40, 30]); }),   // beret, mustache
  marty: sketchJudge((g, x, hy) => { ellipse(g, x, hy - 6, 18, 13, [236, 206, 140], 'top'); rect(g, x - 18, hy - 6, 5, 12, [236, 206, 140]); rect(g, x + 13, hy - 6, 5, 12, [236, 206, 140]); }),   // blond bob
  obama: sketchJudge((g, x, hy) => { ellipse(g, x, hy - 10, 16, 7, [40, 34, 34], 'top'); rect(g, x - 1, 88, 3, 18, [180, 40, 50]); }),   // short hair, a tie
  ram: sketchJudge((g, x, hy) => {   // horns and burning eyes
    for (const sd of [-1, 1]) for (let k = 0; k < 10; k++) rect(g, x + sd * (12 + k), hy - 12 - Math.round(Math.sin(k / 9 * Math.PI) * 9) + (k > 6 ? k - 6 : 0), 3, 3, [60, 40, 36]);
    rect(g, x - 6, hy - 2, 2, 2, [255, 210, 60]); rect(g, x + 4, hy - 2, 2, 2, [255, 210, 60]);
  }, [190, 50, 40]),
};
const JUDGE_ART = {
  pounce: { body: drawCat, front: (g, j, J, s) => paw(g, j.x - 6, 120, j.fur, false) },
  biscuit: { body: drawDog, front: (g, j, J, s) => { const b = s.mood === 'happy' ? Math.round(Math.abs(Math.sin(s.ft * 0.25)) * -2) : 0; paw(g, j.x - 19, 121 + b, j.fur, true); paw(g, j.x + 19, 121 - b, j.fur, true); } },
  nanny: { body: drawGoat, front: (g, j, J, s) => {
    const x = j.x;
    // Teacup held in both hooves.
    ellipse(g, x, 121, 7, 4, [60, 40, 50]); ellipse(g, x, 120, 6, 4, [250, 246, 240]);
    ellipse(g, x, 117, 6, 2, [180, 110, 70]); rect(g, x + 6, 118, 3, 3, [250, 246, 240]); rect(g, x + 7, 119, 1, 1, [60, 40, 50]);
    for (let k = 0; k < 2; k++) rect(g, x - 2 + k * 4 + Math.round(Math.sin((s.ft + k * 20) * 0.12)), 108 - ((s.ft + k * 9) % 8), 1, 3, 'rgba(255,255,255,0.7)');
    for (const sd of [-1, 1]) { ellipse(g, x + sd * 10, 121, 4, 3, j.fur); rect(g, x + sd * 10 - 3, 122, 7, 2, j.dark); }
  } },
  joe: { body: drawJoe, front: frontJoe },
  gordo: { body: drawGordo, front: frontGordo },
  paul: { body: drawPaul, front: framePaul },
  ...SKETCH_JUDGES,
};

function drawVerdict(g, J) {
  const v = J.verdict, t = J.phase === 'done' ? 999 : J.t;
  if (v === 'CHOPPED') {
    // Cleaver slams down onto a board.
    rect(g, 110, 150, 100, 10, [170, 110, 60]); rect(g, 110, 150, 100, 2, [210, 150, 90]);
    const drop = Math.min(1, t / 14), cy = Math.round(-40 + drop * 160);
    // Blade: dark outline, steel body with a brushed sheen, a bright honed edge at the bottom, and the hanging hole.
    rect(g, 133, cy - 31, 44, 30, [40, 42, 52]);
    rect(g, 134, cy - 30, 42, 28, [176, 182, 198]);
    rect(g, 134, cy - 30, 42, 4, [214, 220, 232]);
    for (let k = 0; k < 4; k++) rect(g, 138 + k * 9, cy - 24 + (k & 1) * 3, 6, 1, [200, 206, 220]);
    rect(g, 134, cy - 5, 42, 3, [236, 240, 248]); rect(g, 134, cy - 2, 42, 1, [255, 255, 255]);
    ellipse(g, 141, cy - 23, 2, 2, [40, 42, 52]);
    // Bolster and wooden handle with rivets, angled up to the right.
    rect(g, 176, cy - 28, 4, 10, [120, 124, 140]);
    for (let k = 0; k < 22; k++) rect(g, 180 + k, cy - 27 - Math.round(k * 0.35), 1, 8, k < 2 ? [60, 36, 22] : [118 - (k & 3) * 4, 72, 40]);
    rect(g, 184, cy - 26, 2, 2, [220, 214, 196]); rect(g, 192, cy - 29, 2, 2, [220, 214, 196]);
    if (t < 14) for (let k = 0; k < 3; k++) rect(g, 136 + k * 14, cy - 44 - k * 3, 2, 10, 'rgba(255,255,255,0.35)');   // motion streaks
    if (t > 14 && t < 22) for (let k = 0; k < 8; k++) rect(g, 110 + k * 13, 146 - (t - 14) * 2, 2, 2, [255, 255, 255]);
  } else if (v === 'WINNER' || v === 'GOOD SOUP' || v === 'PERFECT') {
    for (let k = 0; k < 40; k++) {
      const x = (k * 53 + J.t * (1 + k % 3)) % W, y = ((k * 37 + J.t * 2) % 260) - 20;
      rect(g, x, y, 2, 3, [[255, 90, 90], [90, 200, 255], [255, 220, 80], [120, 240, 120]][k % 4]);
    }
  }
}
