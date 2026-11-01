// Round 33 (Roy's audio spec): the sound's content data. Pure data and small resolvers, no imports, so node can check it
// (tools/audio-check.mjs) and sound.js / audio.js read it. Nothing here makes a sound by itself.
//
//   REGION_MUSIC    every region of the map (spawner.js REGIONS) and every realm: its exploration, night and combat
//                   tracks (music.js builds them), its ambience profile, mood, motif and how its music changes over
//   CITY_MUSIC      the five town themes given to the 36 towns, once and for good (a seeded pick by the rules below, then
//                   written out here so it never moves), each with its own variant (key, tempo, lead, counter-melody...)
//   AMBIENCE        what the air sounds like in each kind of place (sound.js mixes the loops of audio.js from it)
//   WEAPON_AUDIO    the eight weapon categories (catalog.js WEAPON_TYPES): swing, hit, miss, block, clash, equip, pairs
//   SKILL_AUDIO     every skill of skills.js / skillbook.js: its signature (element, motif, register), impact and tick
//                   cues and their limits; skillAudio(id, s) derives one for a skill added later
//   SURFACE_AUDIO   what a step sounds like on each ground the world reports (overworld.js surfaceAt, realms, decks)
//   MONSTER_*       the monster families and size classes, and monsterAudio(type, T) that derives a profile from any
//                   species' data (monsterdb.js sizeClass / family tags, or its height, flags and name)
//   KRAKEN_AUDIO    the Kraken's own sound set
//   MUSIC_RULES     the music state machine's priorities and timings (sound.js)

// ---------------------------------------------------------------- music
// Round 33b (Roy approved the side conversation's score, 27.10 07:38): which score the open world plays.
//   'songs33'  the package's themes (songs33.js): every town, landmark, kind of land and realm its own theme, each with
//              its _night (open places) and _combat arrangement; full battle music only for an elite, a giant or a boss;
//              the towns' murmur is a real recording (crowdrec.js) and the per-villager chatter is off
//   'r33'      our own round-33 score (music.js: rx_/rn_/rc_ regions, tw_/twc_ cities) and the synthesized murmur
// Both stay in the code; this one switch picks (sound.js reads it every tick, audio.js when a voice or loop starts).
export let MUSIC_SET = 'songs33';
export function setMusicSet(v) { MUSIC_SET = v === 'r33' ? 'r33' : 'songs33'; return MUSIC_SET; }
export const MUSIC_RULES = {
  // highest first: a scripted scene or the Kraken, a fight in the region, the ship, a town, exploring
  priority: ['scripted', 'kraken', 'boss', 'combat', 'ship', 'town', 'explore'],
  combatEnter: .6, // s of a real fight (a foe chasing, winding up or striking) before the fight music comes in
  combatGrace: 6, // s after the last foe stops fighting before the place's music comes back (no flapping)
  combatGraceDeath: 1.5, // she fell: the fight music lets go quickly
  fade: { explore: 3, town: 2.5, combatIn: 1.2, combatOut: 3.5, ship: 2.5, kraken: 1.5, realm: 2.5 },
  minHold: 4, // s a new track plays before the place (not a fight) may change it again: crossing a border twice is one change
  resumeWithin: 60, // s: a track she left this recently comes back where it was (audio.js play)
  nightAt: .5, // sky.night above this: the night version of a region's tune
};
// region id -> its music. themeId: the region's tune in music.js (REGION_TUNES). Tracks: rx_ explore, rn_ night, rc_ combat.
const REG = (id, amb, mood, motif, key, extra) => ({ regionId: id, themeId: id, explorationTrackId: 'rx_' + id, nightTrackId: 'rn_' + id, combatTrackId: 'rc_' + id, ambienceProfileId: amb, mood, motif, key,
  transition: { fadeIn: MUSIC_RULES.fade.explore, combatIn: MUSIC_RULES.fade.combatIn, combatOut: MUSIC_RULES.fade.combatOut }, ...(extra || {}) });
export const REGION_MUSIC = {
  attica: REG('attica', 'meadow', 'warm, heroic, home', 'rising D-major hook', 'D major / D minor (combat)'),
  boeotia: REG('boeotia', 'meadow', 'curious, riddling (the Sphinx, Thebes)', 'sly dorian figure', 'A dorian / A phrygian'),
  delphi: REG('delphi', 'mountain', 'sacred, airy, prophetic', 'lydian rise', 'E lydian / E minor'),
  corinth: REG('corinth', 'meadow', 'bustling, jaunty crossroads', 'mixolydian skip', 'G mixolydian / G minor'),
  lerna: REG('lerna', 'marsh', 'murky, sinuous marsh (the Hydra)', 'slithering semitone', 'C minor'),
  stymphalos: REG('stymphalos', 'marsh', 'quirky, twittering marsh birds', 'staccato chirps', 'F# minor'),
  arcadia: REG('arcadia', 'forest', 'pastoral, lilting (Pan)', '6/8 pipe call', 'F major / D minor'),
  laconia: REG('laconia', 'dry', 'martial, disciplined (Sparta)', 'dotted call', 'E minor'),
  thessaly: REG('thessaly', 'plains', 'open plains, horses running', 'galloping fourth', 'Bb major / G minor'),
  dodona: REG('dodona', 'forest', 'ancient oak grove, hushed', 'slow falling third', 'A minor'),
  olympus: REG('olympus', 'mountain', 'majestic, high and luminous', 'lydian fanfare', 'C lydian / C minor'),
  crete: REG('crete', 'dry', 'Minoan, labyrinthine (Eastern Mediterranean colour)', 'hijaz turn', 'D hijaz'),
  aegean: REG('aegean', 'coast', 'breezy islands, sunlit', 'syncopated leap', 'A major / A minor'),
  forge: REG('forge', 'volcanic', 'the smiths\' islands: hammering, industrious', 'struck repeated notes (anvil)', 'Bb dorian / Bb minor'),
  thera: REG('thera', 'volcanic', 'smouldering, volcanic, tense', 'slow ember fall', 'Eb minor'),
  west: REG('west', 'coast', 'longing, seafaring (the Odyssey)', 'barcarolle rise', 'G minor'),
  dead: REG('dead', 'haunt', 'haunted, solemn (the dead heroes, the Acheron)', 'falling sixth with silences', 'B minor'),
  gorgon: REG('gorgon', 'statues', 'beautiful but uncanny (Medusa\'s isle)', 'sigh over a whole-tone shimmer', 'F# minor'),
  hesperides: REG('hesperides', 'garden', 'enchanted golden garden, dreamy', 'golden arch', 'Eb major / C minor'),
  // realms (world.realm.kind): their own tunes; a sub-area of a realm names a variant (see REALM_AREAS)
  underworld: REG('underworld', 'underworld', 'deep, still, foreboding (Hades\' realm)', 'low phrygian step', 'D phrygian', { realm: true }),
  isle: REG('isle', 'storm', 'storm-lashed, mournful (the Island of No Return)', 'rising sigh', 'C# minor', { realm: true }),
  cave: REG('cave', 'cave', 'dripping dark, close walls', 'drops in the dark', 'E minor', { realm: true }),
  temple: REG('temple', 'temple', 'sacred stillness, incense and marble', 'slow hymn', 'D major / B minor', { realm: true }),
};
// a realm kind -> the region tune it plays (ferry is the ship's: see SHIP)
export const REALM_MUSIC = { underworld: 'underworld', isle: 'isle', cave: 'cave', temple: 'temple' };
// sub-areas inside a realm, keyed by the realm's own (older) music getter: portals.js / isle.js name them
export const REALM_AREAS = {
  underworld: { danger: 'rx_underworld_deep', rl_tartarus: 'rx_underworld_deep' }, // the hall of the dead, deeper in
  isle: { temple: 'rx_isle_temple', underworld_metal: 'rx_isle_cave', rl_isle_ruin: 'rx_isle_temple', rl_isle_deep: 'rx_isle_cave' }, // Poseidon's drowned temple, the Cave of Echoes
  // (round 33b: the realms now name their songs33 themes, rl_*; the old names above stay so either resolves)
};
export const SHIP_MUSIC = { trackId: 'ship', name: { he: 'רוח במפרשים', en: 'Wind in the Linen' }, ambienceProfileId: 'ship', note: 'one theme for every crossing (ferry.js voyages and her own boat)' };

// The five town themes went to the towns by these rules (and a seeded pick inside them), then were written out below:
//   bazaar  hot, dry, eastern: Crete, Rhodes, Kos, Samos, Chios, Thera, the smiths' island
//   veiled  dark, remote or story-heavy: Thebes (the Sphinx), Delphi (the oracle), Dodona, Kastoria, Stymphalos, Argos (Lerna)
//   harbor  calm harbour and island towns
//   agora   busy market towns and ports: Athens, Corinth, Pella, Piraeus, Naupaktos
//   hearth  the classical polis and her home: Elaia (fixed: the first town she knows), Sparta, Larisa, Olympia, Trikka, Dion, Epidauros
// v: the city's variant (music.js townSong): tr semitones, bpm, lead pulse duty, counter-melody, echo, light (sparser drums).
// Tracks: tw_<city> (its version of the theme), twc_<city> (its combat version). crowd: the town's crowd bed (AMBIENCE).
export const CITY_MUSIC = {
  elaia: { theme: 'hearth', v: { bpm: 102, counter: true }, crowd: 'harborQuiet' }, // Elaia (home, coast)
  athenai: { theme: 'agora', v: { tr: 2, bpm: 116, lead: 12 }, crowd: 'busy' }, // Athens (city)
  piraeus: { theme: 'agora', v: { tr: -2, bpm: 123, lead: 25, echo: true, light: true }, crowd: 'harborQuiet' }, // Piraeus (village, coast)
  korinthos: { theme: 'agora', v: { tr: -2, bpm: 118, lead: 50, counter: true }, crowd: 'market' }, // Corinth (town)
  thebai: { theme: 'veiled', v: { tr: -3, bpm: 76, lead: 12 }, crowd: 'market' }, // Thebes (town)
  kirrha: { theme: 'harbor', v: { bpm: 72, lead: 12, echo: true, light: true }, crowd: 'harborQuiet' }, // Kirrha (village, coast)
  delphoi: { theme: 'veiled', v: { tr: 2, bpm: 76, lead: 12, counter: true }, crowd: 'market' }, // Delphi (town)
  larisa: { theme: 'hearth', v: { tr: -1, bpm: 112, lead: 50, counter: true }, crowd: 'market' }, // Larisa (town)
  dion: { theme: 'hearth', v: { tr: -3, bpm: 108, lead: 25, counter: true, light: true }, crowd: 'quiet' }, // Dion (village)
  dodona: { theme: 'veiled', v: { tr: -2, bpm: 76, lead: 50, counter: true, light: true }, crowd: 'quiet' }, // Dodona (village)
  sparta: { theme: 'hearth', v: { tr: -1, bpm: 107, lead: 50, counter: true }, crowd: 'market' }, // Sparta (town)
  olympia: { theme: 'hearth', v: { tr: -1, bpm: 111, lead: 25 }, crowd: 'quiet' }, // Olympia (village)
  pylos: { theme: 'harbor', v: { tr: 2, bpm: 80, lead: 25, counter: true, echo: true, light: true }, crowd: 'harborQuiet' }, // Pylos (village, coast)
  argos: { theme: 'veiled', v: { tr: 1, bpm: 75, lead: 12, counter: true, light: true }, crowd: 'quiet' }, // Argos (village)
  knossos: { theme: 'bazaar', v: { tr: -3, bpm: 100, lead: 25, counter: true }, crowd: 'harbor' }, // Knossos (town, coast)
  chania: { theme: 'bazaar', v: { tr: -3, bpm: 96, lead: 25, echo: true }, crowd: 'harborQuiet' }, // Chania (village, coast)
  naxos: { theme: 'harbor', v: { tr: 2, bpm: 78, lead: 50, echo: true, light: true }, crowd: 'harborQuiet' }, // Naxos (village, coast)
  mykonos: { theme: 'harbor', v: { tr: 2, bpm: 82, lead: 50, echo: true, light: true }, crowd: 'harborQuiet' }, // Mykonos (village, coast)
  hephaistia: { theme: 'bazaar', v: { tr: 2, bpm: 97, lead: 25, counter: true, light: true }, crowd: 'harborQuiet' }, // Hephaistia (village, coast)
  rhodos: { theme: 'bazaar', v: { tr: -1, bpm: 103, lead: 50, counter: true, echo: true }, crowd: 'harbor' }, // Rhodes (town, coast)
  mytilene: { theme: 'harbor', v: { tr: -1, bpm: 75, lead: 12, echo: true }, crowd: 'harborQuiet' }, // Mytilene (village, coast)
  ithaca: { theme: 'harbor', v: { tr: -1, bpm: 81, lead: 12, counter: true, echo: true }, crowd: 'harborQuiet' }, // Ithaca (village, coast)
  thera: { theme: 'bazaar', v: { tr: 2, bpm: 106, lead: 25, counter: true, echo: true }, crowd: 'harborQuiet' }, // Thera (village, coast)
  samos: { theme: 'bazaar', v: { bpm: 100, lead: 12, echo: true }, crowd: 'harborQuiet' }, // Samos (village, coast)
  iolkos: { theme: 'harbor', v: { tr: 1, bpm: 82, lead: 25, counter: true, echo: true }, crowd: 'harborQuiet' }, // Iolkos (village, coast)
  pella: { theme: 'agora', v: { bpm: 122, lead: 25, counter: true }, crowd: 'harbor' }, // Pella (town, coast)
  kastoria: { theme: 'veiled', v: { tr: 1, bpm: 75, lead: 50, echo: true }, crowd: 'quiet' }, // Kastoria (village)
  kerkyra: { theme: 'harbor', v: { tr: 2, bpm: 75, lead: 50, counter: true, echo: true, light: true }, crowd: 'harborQuiet' }, // Kerkyra (village, coast)
  trikka: { theme: 'hearth', v: { tr: -3, bpm: 102, lead: 50, light: true }, crowd: 'quiet' }, // Trikka (village)
  naupaktos: { theme: 'agora', v: { tr: -3, bpm: 126, lead: 12, counter: true }, crowd: 'harborQuiet' }, // Naupaktos (village, coast)
  stymphalos: { theme: 'veiled', v: { tr: -2, bpm: 75, lead: 50, counter: true }, crowd: 'quiet' }, // Stymphalos (village)
  epidauros: { theme: 'hearth', v: { tr: -2, bpm: 107, lead: 25 }, crowd: 'harborQuiet' }, // Epidauros (village, coast)
  gytheion: { theme: 'harbor', v: { tr: -3, bpm: 78, lead: 25, echo: true, light: true }, crowd: 'harborQuiet' }, // Gytheion (village, coast)
  chios: { theme: 'bazaar', v: { tr: 2, bpm: 97, lead: 12, counter: true, echo: true, light: true }, crowd: 'harborQuiet' }, // Chios (village, coast)
  kos: { theme: 'bazaar', v: { tr: -3, bpm: 99, lead: 25, counter: true }, crowd: 'harborQuiet' }, // Kos (village, coast)
  zakros: { theme: 'bazaar', v: { tr: -1, bpm: 96, lead: 50, light: true }, crowd: 'harborQuiet' }, // Zakros (village, coast)
};
// a town not listed (one added later): a theme picked by a seeded hash of its id, among the calm ones
export function cityMusic(id) {
  if (CITY_MUSIC[id]) return CITY_MUSIC[id];
  let h = 2166136261; for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return { theme: ['hearth', 'harbor', 'agora'][(h >>> 0) % 3], v: {}, crowd: 'quiet' };
}

// ---------------------------------------------------------------- ambience
// each profile: loop gains (audio.js LOOPS) at full exposure. sound.js scales wind by exposure (height, open ground),
// rain by the weather and shelter, insects and birds by the hour, and everything by the "reduce ambience" option.
export const AMBIENCE = {
  meadow: { birds: .5, forest: .2, cicadas: .25, wind: .16 },
  forest: { birds: .6, forest: .6, wind: .14 },
  plains: { birds: .35, wind: .3, cicadas: .2 },
  dry: { cicadas: .5, wind: .22, birds: .15 },
  marsh: { marsh: .6, birds: .25, wind: .12 },
  mountain: { wind: .6, birds: .15 },
  coast: { birds: .25, wind: .3, cicadas: .2 },
  volcanic: { embers: .5, wind: .3 },
  haunt: { wind: .25, underworld: .25 },
  statues: { wind: .2, birds: .1 },
  garden: { birds: .7, forest: .35, cicadas: .2 },
  underworld: { underworld: .7 },
  storm: { wind: .5, rain: .6 },
  cave: { drips: .7, underworld: .2 },
  temple: { drips: .15 },
  ship: { sea: .7, boat: .6, sail: .5, wind: .3 },
  town: { crowd: .35, birds: .25 },
  // the town crowd beds (CITY_MUSIC crowd)
  busy: { crowd: .45 }, market: { crowd: .38 }, harbor: { crowd: .32, sea: .2 }, harborQuiet: { crowd: .22, sea: .2 }, quiet: { crowd: .18 },
};
// at night: insects and birds give way to the night chorus; a town's crowd goes home
export const NIGHT_SWAP = { birds: 0, cicadas: 0, crowd: .25, forestK: .35, night: .6 };

// ---------------------------------------------------------------- weapons (catalog.js WEAPON_TYPES)
// swing: the whoosh's pitch (k) and length (len) against a one-handed sword's; chop: a heavy head's thud through the air
// and into the body; ring: how long steel sings after a blow; thrust: a narrow rising hiss; pair: a second blade's offset
// (s) and level; hit: 'slice' | 'chop' | 'pierce' | 'bash'; block: the sound of her guard with this in hand; equip: the
// sound of taking it up.
export const WEAPON_AUDIO = {
  shield: { swing: { k: .8, len: 1.1 }, chop: .2, ring: .2, hit: 'bash', block: 'shield', clash: 'shield', equip: 'strap', note: 'off-hand: a bash thump, a broad block, straps and boss on equip' },
  sword1: { swing: { k: 1, len: 1 }, chop: 0, ring: 1, hit: 'slice', block: 'parry', clash: 'ring', equip: 'draw', note: 'crisp shing, a clean slice' },
  axe1: { swing: { k: .82, len: 1.15 }, chop: .6, ring: .35, hit: 'chop', block: 'haft', clash: 'thud', equip: 'haft', note: 'a heavier head: a lower whump and a chopping thud' },
  sword2: { swing: { k: .78, len: 1.3 }, chop: .25, ring: 1.4, hit: 'slice', block: 'parry', clash: 'ring', equip: 'draw2', note: 'a long blade: a broad whoosh and a long ring' },
  axe2: { swing: { k: .66, len: 1.45 }, chop: 1, ring: .4, hit: 'chop', block: 'haft', clash: 'thud', equip: 'haft2', note: 'a great head: a deep push of air and a crunching chop' },
  spear2: { swing: { k: 1.1, len: .9 }, chop: 0, ring: .6, thrust: 1, hit: 'pierce', block: 'haft', clash: 'ring', equip: 'shaft', note: 'a narrow rising hiss, a tight puncture' },
  dualSword: { swing: { k: 1.12, len: .85 }, chop: 0, ring: .7, pair: [.06, .7], hit: 'slice', block: 'parry', clash: 'ring', equip: 'draw', note: 'two quick light blades, the second a beat behind and to the other side' },
  dualAxe: { swing: { k: .9, len: .95 }, chop: .45, ring: .3, pair: [.075, .75], hit: 'chop', block: 'haft', clash: 'thud', equip: 'haft', note: 'two chopping heads, a beat apart' },
};
export const WEAPON_TYPE_IDS = Object.keys(WEAPON_AUDIO);
// Which sound set each weapon type uses: 0 = the sound above (wSwing / wHit, the game's sound until Roy picks),
// 1..5 = that candidate of weaponsfx.js WEAPON_SOUND_VARIANTS (its swing, its blow on a body and its charged slam).
// The shield's set is the shield bash (the sword-and-shield finisher's bash and the skills' bashes).
export const WEAPON_SOUND_PICK = { shield: 0, sword1: 1, axe1: 4, sword2: 1, axe2: 3, spear2: 4, dualSword: 1, dualAxe: 0 }; // Roy 27.10 04:30, campaign + online
// a weapon's category when the item has none (the old weapons): by its style and id
export function weaponCategory(W, cat) {
  if (cat && WEAPON_AUDIO[cat]) return cat;
  if (!W) return 'sword1';
  if (W.weaponType && WEAPON_AUDIO[W.weaponType]) return W.weaponType;
  const id = String(W.id || W.base || ''), st = W.baseStyle || W.style, axe = /axe|labrys|sagaris|pelekys|cleaver/.test(id);
  if (st === 'dual') return axe ? 'dualAxe' : 'dualSword';
  if (st === 'twohand') return axe ? 'axe2' : 'sword2';
  if (st === 'polearm' || st === 'spear') return 'spear2';
  return axe ? 'axe1' : 'sword1';
}

// ---------------------------------------------------------------- skills
// sig: [element, kind, root (MIDI), motif (semitones above the root)] -> the skill's own short signature (audio.js
// sk_sig) under its cast sounds. impact: the element's struck sound when its blow lands (audio.js sk_hit), at most
// once per impactGap s per skill and impactMax per cast; tick: a soft pulse for its damage-over-time and auras.
// Elements: fire ice storm holy shadow earth water wind venom steel time spirit stone. Kinds: strike aoe proj buff move
// summon ult call. No two skills share a signature (tools/audio-check.mjs checks).
const SK = (el, kind, root, motif, more) => ({ el, kind, root, motif, ...(more || {}) });
export const SKILL_AUDIO = {
  dash: SK('wind', 'move', 79, [0, 7]),
  whirl: SK('steel', 'aoe', 67, [0, 5, 0, 5]),
  fate: SK('time', 'buff', 76, [0, -1, -5]),
  heal: SK('holy', 'buff', 72, [0, 4, 7, 12]),
  quake: SK('earth', 'aoe', 43, [0, 0, -5]),
  thunder: SK('storm', 'aoe', 55, [0, 12, 7]),
  gaze: SK('stone', 'strike', 62, [0, 1, 0]),
  fireball: SK('fire', 'proj', 64, [0, 3, 7]),
  flurry: SK('steel', 'strike', 74, [0, 2, 4, 2]),
  fog: SK('spirit', 'aoe', 60, [0, 2, -3]),
  wave: SK('water', 'aoe', 57, [0, 5, 9, 12]),
  prophecy: SK('time', 'buff', 69, [0, 7, 14]),
  hellfire: SK('fire', 'aoe', 50, [0, 1, 7]),
  venomtrail: SK('venom', 'aoe', 58, [0, 6, 5]),
  charge: SK('steel', 'move', 60, [0, 7]),
  bluearc: SK('fire', 'strike', 71, [0, 7, 12]),
  pierce: SK('steel', 'strike', 72, [0, 12]),
  fangs: SK('venom', 'strike', 70, [0, 1, 0, 1]),
  cleave: SK('steel', 'strike', 52, [0, -5]),
  stoneskin: SK('stone', 'buff', 48, [0, 5, 7]),
  zephyr: SK('wind', 'aoe', 74, [0, 5, 10]),
  shuttle: SK('steel', 'proj', 67, [0, 7, 0]),
  veil: SK('shadow', 'buff', 63, [0, -2, -5]),
  riposte: SK('steel', 'strike', 76, [0, -12, 0]),
  leap: SK('earth', 'move', 55, [0, 7, -5]),
  venom: SK('venom', 'proj', 65, [0, 3, 1]),
  warcry: SK('steel', 'buff', 57, [0, 5, 10, 12]),
  chain: SK('storm', 'proj', 67, [0, 7, 3, 10]),
  impale: SK('steel', 'proj', 59, [0, 10]),
  blink: SK('shadow', 'move', 72, [0, 6]),
  earthsplit: SK('earth', 'aoe', 47, [0, 6, 0]),
  sunshield: SK('holy', 'buff', 67, [0, 7, 11]),
  crescent: SK('spirit', 'strike', 69, [0, 3, 8]),
  blizzard: SK('ice', 'aoe', 72, [0, 5, 3, 8]),
  keres: SK('shadow', 'aoe', 58, [0, 1, -4]),
  phalanx: SK('steel', 'buff', 55, [0, 0, 7, 7]),
  harvest: SK('shadow', 'strike', 53, [0, 3, -2]),
  spearrain: SK('storm', 'aoe', 62, [0, 5, 9]),
  iceprison: SK('ice', 'strike', 64, [0, 11, 7]),
  thousand: SK('steel', 'strike', 81, [0, 3, 5, 7]),
  meteor: SK('fire', 'aoe', 45, [0, 7, -12]),
  athena: SK('holy', 'ult', 62, [0, 7, 12, 16]),
  hera: SK('holy', 'ult', 65, [0, 4, 9, 16]),
  chimaera: SK('fire', 'ult', 53, [0, 6, 4, 10]),
  titanedge: SK('stone', 'ult', 43, [0, 7, 12, 10]),
  myrmidons: SK('steel', 'summon', 50, [0, 7, 5, 12]),
  storm: SK('storm', 'ult', 50, [0, 5, 12, 17]),
  hydra: SK('venom', 'summon', 52, [0, 3, 6, 9]),
  kronos: SK('time', 'ult', 57, [0, 11, 10, 7]),
  phoenix: SK('fire', 'ult', 69, [0, 5, 9, 14]),
  colossus: SK('stone', 'ult', 38, [0, 7, 10, 12]),
  bound: SK('wind', 'move', 67, [0, 4, 7, 11]),
  inferno: SK('fire', 'ult', 46, [0, 3, 6, 11]),
  gaia: SK('earth', 'ult', 41, [0, 5, 9, 12]),
  void: SK('shadow', 'ult', 46, [0, 6, 1, 7]),
  oath: SK('spirit', 'ult', 57, [0, 7, 14, 19]),
  rise: SK('shadow', 'summon', 41, [0, 3, 7, 6]),
  zeus: SK('storm', 'ult', 45, [0, 12, 19, 24]),
  call_mount: SK('wind', 'call', 76, [0, 5, 9]),
};
// the per-kind limits (sound.js): impact cues a cast may make, and how often
export const SKILL_KIND_RULES = {
  strike: { impactMax: 6, impactGap: .08 }, aoe: { impactMax: 4, impactGap: .1 }, proj: { impactMax: 5, impactGap: .1 }, buff: { impactMax: 2, impactGap: .2 },
  move: { impactMax: 3, impactGap: .12 }, summon: { impactMax: 4, impactGap: .25 }, ult: { impactMax: 8, impactGap: .12 }, call: { impactMax: 0, impactGap: 1 },
};
const ELEMENTS = ['fire', 'ice', 'storm', 'holy', 'shadow', 'earth', 'water', 'wind', 'venom', 'steel', 'time', 'spirit', 'stone'];
// a skill added later (or a test's): a signature derived from its id and data, so it is never silent and never a copy
export function skillAudio(id, s) {
  if (SKILL_AUDIO[id]) return SKILL_AUDIO[id];
  let h = 2166136261; for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h >>>= 0;
  const txt = (String(id) + ' ' + (s && s.name ? s.name.en || '' : '') + ' ' + (s && s.color || '')).toLowerCase();
  const el = /fire|flame|burn|ember|sun|phoen|inferno/.test(txt) ? 'fire' : /ice|frost|snow|bliz/.test(txt) ? 'ice' : /thunder|storm|light|bolt|zeus|chain/.test(txt) ? 'storm'
    : /heal|holy|bless|light|aegis|athena|hera/.test(txt) ? 'holy' : /shadow|void|dark|veil|death|ker/.test(txt) ? 'shadow' : /quake|earth|gaia|stone|rock/.test(txt) ? 'earth'
      : /wave|water|tide|sea/.test(txt) ? 'water' : /wind|zephyr|gale|dash/.test(txt) ? 'wind' : /venom|poison|hydra/.test(txt) ? 'venom' : ELEMENTS[h % ELEMENTS.length];
  const kind = s && s.ult ? 'ult' : s && s.mount ? 'call' : s && (s.anim === 'dash' || s.move) ? 'move' : s && /aoe|ring|slam|nova/.test(String(s.anim)) ? 'aoe' : 'strike';
  const motifs = [[0, 2, 7], [0, 5, 4], [0, 3, 10], [0, 9, 7], [0, 4, 2, 9], [0, 8, 3], [0, 10, 5, 12]];
  return SK(el, kind, 52 + (h >>> 4) % 26, motifs[(h >>> 9) % motifs.length]);
}

// ---------------------------------------------------------------- footsteps
// the world's grounds (overworld.js surfaceAt: biome map, roads, sites, realms) -> audio.js step surfaces. sound.js adds
// the town paving (terrain.js paveAt), ship decks and jetties (deckAt), shallow water and wading (depth).
export const SURFACE_AUDIO = {
  grass: 'grass', meadow: 'grass', leaves: 'leaves', forest: 'leaves', needles: 'leaves', dirt: 'dirt', path: 'dirt', farm: 'dirt', gravel: 'gravel', road: 'gravel',
  mud: 'mud', marsh: 'mud', swamp: 'mud', sand: 'sand', beach: 'sand', dune: 'sand', stone: 'stone', rock: 'stone', cave: 'cave', marble: 'marble', temple: 'marble',
  tile: 'marble', paving: 'stone', wood: 'wood', deck: 'wood', jetty: 'wood', bridge: 'wood', floor: 'floor', interior: 'floor', rug: 'rug', carpet: 'rug', snow: 'snow',
  ice: 'ice', water: 'water', shallow: 'water', wade: 'wade', ash: 'gravel', volcanic: 'gravel', scree: 'gravel', bone: 'gravel',
};
export const stepOf = (s) => SURFACE_AUDIO[s] || 'dirt';

// ---------------------------------------------------------------- monsters
// a family: voice (audio.js mon_voice timbre), step (mon_step), f0 (Hz at medium size), and how often it speaks
export const MONSTER_FAMILIES = {
  canine: { voice: 'growl', step: 'pad', f0: 190, idle: .25, note: 'hounds, wolves, jackals, Cerberus\' kin' },
  feline: { voice: 'snarl', step: 'pad', f0: 150, idle: .2, note: 'lions, panthers, sphinxes' },
  beast: { voice: 'grunt', step: 'hoof', f0: 120, idle: .25, note: 'boars, bulls, stags, goats, hoofed beasts' },
  bear: { voice: 'roar', step: 'pad', f0: 95, idle: .15, note: 'bears and other heavy clawed beasts' },
  avian: { voice: 'screech', step: 'flap', f0: 620, idle: .35, note: 'harpies, Stymphalian birds, griffins, sirens in flight' },
  undead: { voice: 'rattle', step: 'bone', f0: 240, idle: .25, note: 'skeletons, the restless dead' },
  spirit: { voice: 'wail', step: 'none', f0: 420, idle: .3, note: 'shades, lost souls, wisps, keres' },
  humanoid: { voice: 'shout', step: 'foot', f0: 170, idle: .15, note: 'satyrs, bandits, soldiers, centaurs\' upper half' },
  giant: { voice: 'roar', step: 'quake', f0: 70, idle: .2, note: 'cyclopes, titans, giants' },
  serpent: { voice: 'hiss', step: 'slither', f0: 300, idle: .3, note: 'serpents, drakons, the Hydra\'s kin, lizards' },
  insect: { voice: 'chitter', step: 'chitin', f0: 900, idle: .3, note: 'scorpions, spiders, beetles, myrmekes' },
  shell: { voice: 'click', step: 'chitin', f0: 700, idle: .2, note: 'crabs and shelled things' },
  stone: { voice: 'grind', step: 'stone', f0: 80, idle: .1, note: 'statues, golems, the stone hoplites, automatons' },
  marine: { voice: 'gurgle', step: 'splash', f0: 160, idle: .2, note: 'sea beasts, tritons, the Kraken\'s brood' },
  plant: { voice: 'creak', step: 'rustle', f0: 200, idle: .15, note: 'dryads, thorn things, walking trees' },
  fire: { voice: 'roarFire', step: 'pad', f0: 130, idle: .2, note: 'chimaerae, fire hounds, salamanders' },
  slime: { voice: 'gurgle', step: 'splash', f0: 230, idle: .15, note: 'oozes, tar and mud things, blobs, frogs' },
  rodent: { voice: 'chitter', step: 'pad', f0: 520, idle: .25, note: 'rats, moles, marmots, hares, polecats' },
};
// sizeClass (monsterdb.js) -> pitch (k: multiplies f0), weight (w: the low end and loudness of voice and steps), reach (m)
export const MONSTER_SIZES = {
  tiny: { k: 1.9, w: .35, reach: 12 }, small: { k: 1.4, w: .6, reach: 16 }, medium: { k: 1, w: 1, reach: 22 },
  large: { k: .72, w: 1.35, reach: 28 }, huge: { k: .5, w: 1.7, reach: 36 }, colossal: { k: .34, w: 2.1, reach: 46 },
};
// name patterns (the type id and its English name) -> family; first match wins
const FAMILY_BY_NAME = [
  ['stone', /mimic|stone|statue|golem|automat|talos|marble|bronze_?guard|colossus|petrif|gargoyl/],
  ['rodent', /rodent|\brat\b|mouse|mole\b|marmot|hare\b|rabbit|polecat|weasel/],
  ['spirit', /shade|soul|wisp|ghost|spirit|\bker(es)?\b|phantom|wraith|echo|eidolon|lamia|empusa|mormo/],
  ['undead', /skelet|bone|zombie|lich|revenant|dead|mummy|spartoi/],
  ['giant', /cyclop|titan|giant|gigas|laestry|hecaton|antaeus|argus/],
  ['avian', /harpy|bird|stymph|griffin|gryph|siren|eagle|crow|raven|owl|vulture|bat\b|bats|pegas/],
  ['serpent', /serpent|snake|hydra|drakon|dragon|python|ladon|basilisk|viper|lizard|wyrm|echidna/],
  ['insect', /scorpion|spider|arachn|beetle|myrmek|ant\b|wasp|locust|centiped|insect/],
  ['shell', /crab|karkinos|tortoise|turtle|shell/],
  ['slime', /slime|ooze|\btar\b|blob|jelly\b|\bmud\b|miasma|mire/],
  ['marine', /kraken|triton|sea|fish|shark|squid|octop|charyb|scylla|ketos|cetus|eel/],
  ['canine', /hound|wolf|dog|jackal|cerber|orthrus|fox|hyena|lycaon/],
  ['feline', /lion|panther|leopard|lynx|sphinx|tiger|manticore|cat\b/],
  ['bear', /bear|badger|wolverine/],
  ['beast', /boar|bull|minotaur|ox\b|stag|deer|goat|ram\b|horse|mare|heifer|cow|buffalo|hind/],
  ['fire', /chimaer|fire|flame|salamand|phoenix|ember|lava|magma|hellhound/],
  ['plant', /dryad|tree|thorn|vine|root|plant|treant|ent\b|meliai/],
  ['humanoid', /satyr|bandit|soldier|hoplite|centaur|amazon|warrior|archer|cultist|priest|nymph|maenad|witch|man\b|men\b|brute|thug/],
];
const SIZE_ORDER = ['tiny', 'small', 'medium', 'large', 'huge', 'colossal'];
export const sizeOf = (T) => {
  if (T && SIZE_ORDER.includes(T.sizeClass)) return T.sizeClass;
  const h = T && (T.height || 1.8), r = T && (T.radius || .5), m = Math.max(h, r * 2.4);
  return m < .8 ? 'tiny' : m < 1.5 ? 'small' : m < 2.6 ? 'medium' : m < 4.2 ? 'large' : m < 7.5 ? 'huge' : 'colossal';
};
// monsterdb.js T.kind (the species' body plan, species/kit.js) -> the audio families it may take; the first is the default,
// the name (and the species' tags) picks among the rest: a 'beast' wolf is canine, a 'folk' with the undead tag rattles
const PLAN_FAMILY = {
  beast: ['beast', 'canine', 'feline', 'bear', 'rodent', 'fire'], saurian: ['serpent', 'fire'], bird: ['avian', 'fire'], bug: ['insect', 'fire'],
  crust: ['shell', 'insect'], fish: ['marine'], worm: ['serpent', 'insect'], folk: ['humanoid', 'undead', 'spirit', 'giant'],
  golem: ['stone'], wraith: ['spirit', 'undead', 'fire'], blob: ['slime', 'spirit', 'fire'], plant: ['plant'],
};
// the species from before round 33 whose ids and names say little (the newer ones carry T.kind, their body plan)
const OLD_FAMILY = {
  thirster: 'undead', erinys: 'avian', lampad: 'spirit', sminthRat: 'rodent', corax: 'avian', gadfly: 'insect', myrmex: 'insect', lycan: 'canine',
  strix: 'avian', kallikantzaros: 'humanoid', aethon: 'avian', gegenes: 'giant', blemmyes: 'humanoid', boread: 'humanoid', khione: 'spirit',
  letoFrog: 'slime', polypus: 'marine', telchine: 'marine', hippocamp: 'marine', laistrygon: 'giant', khalkotauros: 'stone', kourai: 'stone',
  tripod: 'stone', enceladusBrood: 'fire', chimeraWhelp: 'fire', vrykolakas: 'undead', gorgonite: 'serpent', nykteris: 'avian', lotusBloom: 'plant',
  typhonling: 'serpent', amphisbaena: 'serpent', scolopendra: 'insect', nemean: 'feline', isleDrowned: 'undead', isleSquall: 'spirit',
  seaNettle: 'marine', isleEcholing: 'spirit', centaur: 'humanoid', centaurBrute: 'humanoid', siren: 'avian', lamia: 'spirit', empusa: 'spirit',
};
// the family of a species: its own audio tag, else its body plan refined by name, else its name, else its body and flags.
// (monsterdb.js T.family is the species' environment, farm / forest / sea..., not a sound: it is only used if it names one)
export function familyOf(type, T = {}) {
  const tag = T.audioFamily || T.family;
  if (tag && MONSTER_FAMILIES[tag]) return tag;
  if (T.audioFamily && FAMILY_ALIAS[T.audioFamily]) return FAMILY_ALIAS[T.audioFamily];
  if (T.mimic || T.stone) return 'stone';
  if (OLD_FAMILY[type]) return OLD_FAMILY[type];
  const nm = (String(type || '') + ' ' + String(T.name && (T.name.en || T.name) || '') + ' ' + (Array.isArray(T.tags) ? T.tags.join(' ') : '')).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  const byName = (FAMILY_BY_NAME.find(([, re]) => re.test(nm)) || [])[0];
  const plan = PLAN_FAMILY[T.kind];
  if (plan) {
    if (byName && plan.includes(byName)) return byName;
    if (plan.includes('giant') && (T.sizeClass === 'huge' || T.sizeClass === 'colossal')) return 'giant';
    if (plan.includes('fire') && /lava|magma|ember|cinder|fire|flame|ash\b/.test(nm)) return 'fire';
    return plan[0];
  }
  if (byName) return byName;
  if (tag && FAMILY_ALIAS[tag]) return FAMILY_ALIAS[tag];
  if (T.flying) return T.ranged && /wisp|soul/.test(T.ranged.kind) ? 'spirit' : 'avian';
  if (T.swims) return 'marine';
  if (T.ranged && /wisp|soul|curse|spirit/.test(T.ranged.kind)) return 'spirit';
  if (T.ranged && /bone/.test(T.ranged.kind)) return 'undead';
  if (T.ranged && /venom|spit/.test(T.ranged.kind)) return 'serpent';
  if (T.ranged && /sting|web/.test(T.ranged.kind)) return 'insect';
  if (T.charge || T.quad) return 'beast';
  if ((T.height || 2) > 4.2) return 'giant';
  return 'humanoid';
}
// monsterdb.js family tags that are not audio families
const FAMILY_ALIAS = {
  beast: 'beast', animal: 'beast', hoofed: 'beast', canid: 'canine', dog: 'canine', wolf: 'canine', cat: 'feline', big_cat: 'feline', bird: 'avian', flyer: 'avian', winged: 'avian',
  dead: 'undead', skeleton: 'undead', ghost: 'spirit', shade: 'spirit', spectral: 'spirit', soul: 'spirit', human: 'humanoid', humanoid: 'humanoid', man: 'humanoid', hybrid: 'humanoid',
  titan: 'giant', giant: 'giant', reptile: 'serpent', snake: 'serpent', dragon: 'serpent', drake: 'serpent', bug: 'insect', arachnid: 'insect', vermin: 'insect', crustacean: 'shell',
  construct: 'stone', golem: 'stone', statue: 'stone', automaton: 'stone', aquatic: 'marine', ooze: 'slime', blob: 'slime', slime: 'slime', fish: 'marine', plant: 'plant', fey: 'plant', elemental: 'fire', fire: 'fire', demon: 'fire',
};
// the whole profile of a species (cached by sound.js): family, size, and the numbers audio.js plays it with
export function monsterAudio(type, T = {}) {
  const fam = familyOf(type, T), size = sizeOf(T), F = MONSTER_FAMILIES[fam], Z = MONSTER_SIZES[size];
  const boss = !!(T.boss || T.elite);
  return { type, fam, size, voice: F.voice, step: T.flying ? (fam === 'spirit' ? 'none' : 'flap') : F.step, f0: F.f0 * Z.k, w: Z.w * (boss ? 1.15 : 1), reach: Z.reach * (boss ? 1.3 : 1), idle: F.idle,
    heavy: !!T.heavy || size === 'huge' || size === 'colossal', stone: !!(T.mimic || T.stone) };
}

// ---------------------------------------------------------------- the Kraken (ferry.js) and the stone knights
export const KRAKEN_AUDIO = {
  music: { approach: 'kraken_rise', fight: 'kraken', after: 'ship' },
  rise: 'kraken_rise_sfx', // the sea heaving as it comes up (sound.js plays it once, with the warning)
  roar: 'kraken_roar', // its voice: a huge, wet, low bellow
  armRise: 'kraken_arm', // a tentacle breaking the surface
  slam: 'kraken_slam', // a tentacle crashing down on the deck
  grab: 'kraken_grab', // suckers and rope creak
  hurt: 'kraken_hurt', sink: 'kraken_sink',
  note: 'ferry.js calls its own sfx (boss_roar, quake_slam, wave_crash...); sound.js layers these on its state changes',
};
export const STONE_KNIGHT_AUDIO = { windup: 'stone_grind', charge: 'stone_roll', crouch: 'stone_grind', air: 'stone_whoosh', fall: 'stone_whoosh', slam: 'bash', note: 'entities.js mimic stone moves: sgChargeWind, sgCharge, sgCrouch, sgAir, sgFall, its shield slam (bash)' };
