// The Serpent's Oath: arms, items, skills and their pixel icons (Arms agent).
//
// WEAPONS  starter 'village_spear' (Philon's 'village_blade' comes in chapter 2) + 20 weapons over tiers 1..5 (blade / twohand / polearm / dual)
// makeWeapon(id) -> { right: Group, left: Group|null }   grip at the origin, blade along +z (like sword() in models.js)
// ITEMS + makeItemModel(id)   potions, quest items, keys and trophies, models for world pickups
// SKILLS                      data for the 8 skills
// GEAR + makeGearModel(id)   helmets, amulets, body armour and footwear
// iconFor(id) -> Promise<dataURL>   48x48 pixel icon for any weapon, item, gear, skill or 'shield_<kind>' (cached)
//
// Combat numbers: `speed` is the attack-rate multiplier (starter 1), so dps = dmg * speed.
// `reach` is the hit distance in metres. `crit` is the crit chance (crit damage = CRIT_MULT unless a
// 'crit' special raises it). Specials are plain data for the engine, see SPECIAL_TYPES below.
import * as THREE from './three.module.min.js';
import { box, tcyl, ball, cone, pivot, mat, GEAR_BONE_REST, DRESS_TONES } from './models.js';
import { createRenderer, addOutline, outlineMat, toonRamp } from './render.js';
import { PXART, ramp, paOnce, paTex, stud } from './pxart.js';
import { BOOK, BOOK_DRAW, gradeOf as skillTier, STORY_GIFTS } from './skillbook.js';
import { GRADES, MAX_LEVEL, weaponDmgRef } from './progress.js';
import { CATALOG as PATH_SKILLS, toSkill as catSkill } from './skillcat.js';

const PI = Math.PI, HP = PI / 2;
// Round 33: the equipment catalog (catalog.js) plugs in here: resolve(id) registers a catalog id in WEAPONS / GEAR, migrateId(id)
// turns an old save's id into the new one, rollItem picks a drop, legacy(id) looks an old id up (set below), shieldAllowed the
// hands rule. Kept as hooks so this file never imports catalog.js (catalog.js imports this one).
export const CATALOG = { resolve: null, migrateId: null, legacy: null, rollItem: null, catOf: null, shieldAllowed: null, offKind: null }; // (offKind: set online by js/online/jobarms.js)
// what a builder is building right now (catalog models read the item's grade and identity from it: gearkit.js)
export const BUILD_CTX = { item: null };

// ---------------------------------------------------------------------------------------------
// shared tables
// ---------------------------------------------------------------------------------------------
export const RARITY = { common: '#c8c2b0', rare: '#4aa3ff', epic: '#b46cff', legendary: '#ffb22e' };
export const RARITY_NAMES = {
  common: { he: 'רגיל', en: 'Normal' }, rare: { he: 'נדיר', en: 'Rare' },
  epic: { he: 'אפי', en: 'Epic' }, legendary: { he: 'אגדי', en: 'Legendary' },
};
export const STYLE_NAMES = {
  blade: { he: 'חרב ומגן', en: 'Sword + shield' },
  spear: { he: 'חנית ומגן', en: 'Spear + shield' },
  twohand: { he: 'דו־ידני', en: 'Two-handed' },
  polearm: { he: 'רומח', en: 'Polearm' },
  dual: { he: 'זוג להבים', en: 'Dual wield' },
};
export const ELEMENTS = {
  fire: { color: '#ff7a2a', name: { he: 'אש', en: 'Fire' } },
  frost: { color: '#8fe8ff', name: { he: 'כפור', en: 'Frost' } },
  lightning: { color: '#ffe866', name: { he: 'ברק', en: 'Lightning' } },
  poison: { color: '#8dff5a', name: { he: 'רעל', en: 'Poison' } },
  shadow: { color: '#b07aff', name: { he: 'צל', en: 'Shadow' } },
  holy: { color: '#fff1b0', name: { he: 'קודש', en: 'Holy' } },
};
export const CRIT_MULT = 1.75; // default crit damage multiplier
export const CRIT_BASE = .1; // round 19 (Roy): every blow has at least a 1-in-10 chance to land critical; keener weapons keep their own

// Specials, all fields are plain numbers the engine reads:
//   burn      {chance, dps, dur}            fire damage over time
//   chill     {chance, slow, dur}           slows movement and attacks by `slow` (0..1)
//   chain     {chance, jumps, range, mult}  lightning arcs to `jumps` foes within `range` m for mult x hit damage
//   poison    {chance, dps, dur, stacks}    damage over time, stacks up to `stacks`
//   lifesteal {pct}                         heals pct of the damage dealt
//   stagger   {chance, dur}                 interrupts the foe's wind-up, flinch for dur s
//   crit      {mult}                        crit damage multiplier (replaces CRIT_MULT)
//   execute   {below, mult}                 x mult damage on foes under `below` of their max HP
//   mana      {perHit}                      mana restored per hit
export const SPECIAL_TYPES = ['burn', 'chill', 'chain', 'poison', 'lifesteal', 'stagger', 'crit', 'execute', 'mana'];

const pc = (v) => Math.round(v * 100) + '%';
export function specialText(sp) {
  if (!sp) return null;
  switch (sp.type) {
    case 'burn': return { he: `הצתה: ${pc(sp.chance)} סיכוי, ${sp.dps} נזק לשנייה למשך ${sp.dur} ש׳`, en: `Burn: ${pc(sp.chance)} chance, ${sp.dps} dmg/s for ${sp.dur}s` };
    case 'chill': return { he: `צינה: ${pc(sp.chance)} סיכוי להאט ב־${pc(sp.slow)} למשך ${sp.dur} ש׳`, en: `Chill: ${pc(sp.chance)} chance to slow by ${pc(sp.slow)} for ${sp.dur}s` };
    case 'chain': return { he: `ברק שרשרת: ${pc(sp.chance)} סיכוי לקפוץ אל ${sp.jumps} אויבים (${pc(sp.mult)} נזק)`, en: `Chain lightning: ${pc(sp.chance)} chance to arc to ${sp.jumps} foes (${pc(sp.mult)} dmg)` };
    case 'poison': return { he: `רעל: ${pc(sp.chance)} סיכוי, ${sp.dps} נזק לשנייה למשך ${sp.dur} ש׳, עד ${sp.stacks} שכבות`, en: `Poison: ${pc(sp.chance)} chance, ${sp.dps} dmg/s for ${sp.dur}s, stacks ${sp.stacks}x` };
    case 'lifesteal': return { he: `שאיבת חיים: ${pc(sp.pct)} מהנזק`, en: `Lifesteal: ${pc(sp.pct)} of damage dealt` };
    case 'stagger': return { he: `הלם: ${pc(sp.chance)} סיכוי לקטוע את מכת האויב`, en: `Stagger: ${pc(sp.chance)} chance to break the foe's attack` };
    case 'crit': return { he: `מכה קטלנית: נזק פי ${sp.mult}`, en: `Critical hits deal x${sp.mult}` };
    case 'execute': return { he: `חיסול: נזק פי ${sp.mult} לאויבים מתחת ל־${pc(sp.below)} חיים`, en: `Execute: x${sp.mult} damage to foes below ${pc(sp.below)} health` };
    case 'mana': return { he: `חוכמה: כל מכה משיבה ${sp.perHit} מאנה`, en: `Wisdom: each hit restores ${sp.perHit} mana` };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// WEAPONS
// ---------------------------------------------------------------------------------------------
// dps per tier grows ~25% (blade baseline 13 / 16.3 / 20.3 / 25.4 / 31.8). Style rules:
//   blade   speed ~1, reach 2.2-2.5, with a shield (block + Shield Charge)
//   spear   one-handed spear + shield (dory and aspis): speed ~.9, reach 3.2-3.3
//   twohand speed .64-.7, reach 2.9-3.1, ~10% more dps, big hits, often stagger
//   polearm speed .8-.9, reach 3.4-3.8 (longest), thrusts
//   dual    speed 1.6-1.85, reach 2.0-2.1, low damage per hit, ~10% more dps, higher crit
const S = {
  burn: (chance, dps, dur) => ({ type: 'burn', chance, dps, dur }),
  chill: (chance, slow, dur) => ({ type: 'chill', chance, slow, dur }),
  chain: (chance, jumps, range, mult) => ({ type: 'chain', chance, jumps, range, mult }),
  poison: (chance, dps, dur, stacks) => ({ type: 'poison', chance, dps, dur, stacks }),
  lifesteal: (pct) => ({ type: 'lifesteal', pct }),
  stagger: (chance, dur) => ({ type: 'stagger', chance, dur }),
  crit: (mult) => ({ type: 'crit', mult }),
  execute: (below, mult) => ({ type: 'execute', below, mult }),
  mana: (perHit) => ({ type: 'mana', perHit }),
};
// which shield a sword or spear comes with (makeWeapon(id).left builds it)
const SHIELD_OF = { village_blade: 'crescent', perseus_harpe: 'crescent', athena_xiphos: 'crescent', poseidon_trident: 'shell', tide_trident: 'shell' };
export const SHIELD_NAMES = {
  round: { he: 'אספיס ארד', en: 'Bronze aspis' }, crescent: { he: 'מגן הירח והשמש', en: 'Sun-and-moon shield' }, shell: { he: 'מגן צדפה', en: 'Scallop shield' },
};
// how many foes one ordinary swing can land on: two, unless it's a great sweeping weapon of the higher tiers
export const cleaveFor = (w) => w.rarity === 'legendary' ? 6 : (w.style === 'twohand' || w.style === 'polearm') && w.tier >= 4 ? 4
  : (w.style === 'twohand' || w.style === 'polearm') && w.tier >= 3 && w.rarity === 'epic' ? 3 : 2;
// ---- Round 28: the ladder. Every named weapon has an item level (= its minimum level) on one smooth ladder 1..100, its
// damage comes from the shared formula (progress.js weaponDmgRef x style x grade), not from the numbers authored in W() below
// (those only keep the old round-1-27 feel: speed, reach, crit, specials and their strength relative to a hit).
const LADDER = {
  village_spear: 1, village_blade: 1, bronze_kopis: 2, harbor_daggers: 3, olive_club: 3, hoplite_dory: 4,
  minoan_labrys: 7, amazon_sagaris: 8, cyclops_maul: 9, hermes_blades: 10,
  perseus_harpe: 12, medusa_fangs: 13, asterion_axe: 14, poseidon_trident: 15,
  athena_xiphos: 17, erinyes_sickles: 18, hephaestus_hammer: 19, hades_axe: 20,
  keraunos: 24, sun_and_moon: 26, ares_warbringer: 28, kronos_scythe: 36,
  keres_scythe: 1, tide_trident: 1, dragon_fangs: 60,
};
// dps of each style relative to a one-hander (today's table: twohand and dual ~10% more, a spear + shield a little less)
export const STYLE_DPS = { blade: 1, spear: .97, polearm: 1, twohand: 1.1, dual: 1.1 };
// a named weapon that used to be epic / legendary keeps a small edge over a plain forged one of its level
const SIGNATURE = { common: 1, rare: 1, epic: 1.05, legendary: 1.1 };
export const tierOf = (L) => (L < 6 ? 1 : L < 11 ? 2 : L < 16 ? 3 : L < 21 ? 4 : 5);
// damage of a weapon of item level L, style and speed (hit damage; dps = this x speed = weaponDmgRef(L) x style factor)
export const weaponDmg = (L, style, speed, mul = 1) => Math.round(weaponDmgRef(L) * (STYLE_DPS[style] || 1) / speed * mul * 10) / 10;
// burn / poison strength rides the hit it was authored with
const scaleSp = (list, k) => list.map((s) => ((s.type === 'burn' || s.type === 'poison') ? { ...s, dps: Math.max(1, Math.round(s.dps * k)) } : { ...s }));
const RAWW = {};
const W = (id, style, tier, rarity, minLevel, dmg, speed, reach, crit, element, trail, specials, name, desc, source) => (RAWW[id] = {
  id, style, tier, rarity, minLevel, dmg, authDmg: dmg, speed, reach, crit, element, trail,
  special: specials[0] || null, specials, dps: Math.round(dmg * speed * 10) / 10,
  name, desc, source, twoHanded: style !== 'blade' && style !== 'spear',
  shield: style === 'blade' || style === 'spear' ? SHIELD_OF[id] || 'round' : null,
});
// a new named weapon that wears an existing model in another colour: A(id, model, level, tint, {element, trail, specials}, name, desc, source)
const A = (id, model, level, tint, o, name, desc, source) => {
  const M = RAWW[model];
  const r = (RAWW[id] = { ...M, id, base: model, tint, minLevel: level, ...o, name, desc, source });
  r.specials = o.specials || M.specials; r.special = r.specials[0] || null; r.shield = M.shield === 'shell' || M.shield === 'crescent' ? 'round' : M.shield; LADDER[id] = level;
  return r;
};
const finalizeWeapon = (w) => {
  const L = LADDER[w.id] ?? w.minLevel, sig = SIGNATURE[w.rarity] || 1;
  const dmg = weaponDmg(L, w.style, w.speed, sig);
  const out = { ...w, origin: w.rarity, rarity: 'common', grade: 0, baseId: w.id, minLevel: L, ilvl: L, tier: tierOf(L), dmg, dps: Math.round(dmg * w.speed * 10) / 10,
    specials: scaleSp(w.specials, dmg / w.authDmg), };
  out.special = out.specials[0] || null; out.cleave = cleaveFor(out);
  return out;
};
// ---------------------------------------------------------------------------------------------
// Round 30 (Roy): SETS. "Sets must be coherent: if a set exists (e.g. Chaos), all its pieces are named and styled by that
// set: head, body, feet, shield, neck, back, weapon." Every family of names among the arms is one set here, complete in
// all seven slots: the pieces it already had keep their ids (old saves stay good) but take the set's name and colour, and
// what was missing is added, worn in a model of the same make and the set's tint. One level per set (the hand-made pieces
// of rounds 1-27 keep theirs: `classic`; the new pieces come at the set's level). Each piece knows its set (x.suit).
// A slot is either an id that already exists (a member), [id, model] (a member that changes model), or [newId, model, o]
// (a new piece: o = {he, en} names, el = a weapon's element). names: {id: [he, en]} renames a member whose name doesn't
// carry the set's. Above level 100 the ladder goes on with ten more sets to 290 (MAX_LEVEL 300).
// The five WINGED sets (FAIRY, ANGEL, CHAOS, DEVIL and the black DRAGON) are level 150, Heroic (legendary) only, never sold
// and only a boss may leave a piece of one, very rarely (drops.js DROPS.winged); each has its own wings (see the models).
// ---------------------------------------------------------------------------------------------
const LN = (he, en) => ({ he, en });
export const SET_DEFS = [
  { id: 'serpent', lvl: 14, classic: true, he: 'הנחש', en: 'Serpent', tint: '#3ac06a', desc: LN('ירוק כמו נחש שמשיל את עורו ונשאר צעיר לעולם.', 'Green as a snake that sheds its skin and stays young for ever.'),
    head: ['serpent_helm', 'thracian_helm'], neck: 'serpent_amulet', body: 'scale_cuirass', feet: ['serpent_greaves', 'bronze_greaves'], back: ['serpent_wings', 'membrane_wings'], shield: ['shield_serpent', 'shield_oval'],
    weapon: [['serpent_makhaira', 'makhaira', { el: 'poison', he: 'מכאירת הנחש', en: 'Serpent Makhaira' }]] },
  { id: 'owl', lvl: 16, classic: true, he: 'הינשוף', en: 'Owl', tint: '#b8c4d8', desc: LN('כסף וכחול, בצבעי הינשוף של אתנה: הוא רואה בחושך ולומד מכל קרב.', "Silver and blue, the colours of Athena's owl: it sees in the dark and learns from every fight."),
    head: 'owl_helm', neck: 'owl_amulet', body: ['owl_cuirass', 'muscle_cuirass'], feet: ['owl_greaves', 'bronze_greaves'], back: ['owl_wings', 'feather_wings'], shield: ['shield_owl', 'shield_round'], weapon: 'athena_xiphos',
    names: { athena_xiphos: ['קסיפוס הינשוף', 'Owl Xiphos'] } },
  { id: 'hermes', lvl: 20, classic: true, he: 'הרמס', en: "Hermes'", key: 'Hermes', tint: '#f0e8c8', desc: LN('לבן וזהב, קל כמו שליח האלים: הרגליים כמעט לא נוגעות באדמה.', 'White and gold, light as the messenger of the gods: your feet hardly touch the ground.'),
    head: ['hermes_helm', 'hermes_helm'], neck: ['hermes_amulet', 'sun_amulet'], body: ['hermes_cuirass', 'linen_cuirass'], feet: 'talaria', back: ['hermes_wings', 'feather_wings'], shield: ['shield_hermes', 'shield_pelta'], weapon: 'hermes_blades',
    names: { talaria: ['הסנדלים המכונפים של הרמס', "Hermes' Talaria"] } },
  { id: 'hades', lvl: 22, classic: true, he: 'האדס', en: "Hades'", key: 'Hades', tint: '#3a3048', desc: LN('שחור וסגול, מהממלכה שמתחת לאדמה. הצללים נצמדים למי שלובשת אותו.', 'Black and violet, from the kingdom under the earth. The shadows cling to whoever wears it.'),
    head: 'darkness_helm', neck: ['hades_amulet', 'serpent_amulet'], body: ['hades_plate', 'scale_cuirass'], feet: ['hades_greaves', 'bronze_greaves'], back: ['night_wings', 'membrane_wings'], shield: ['shield_hades', 'shield_round'], weapon: 'hades_axe',
    names: { darkness_helm: ['קסדת החושך של האדס', "Hades' Helm of Darkness"], night_wings: ['כנפי האדס', "Hades' Wings"] } },
  { id: 'harpy', lvl: 22, he: 'ההרפיה', en: 'Harpy', tint: '#8a6ab0', desc: LN('נוצות סגולות של ציפורי הסערה, חדות בקצוות כמו הטפרים שלהן.', 'Purple feathers of the storm-birds, sharp at the edges like their talons.'),
    head: ['harpy_helm', 'boar_helm'], neck: ['harpy_amulet', 'owl_amulet'], body: ['harpy_corslet', 'scale_cuirass'], feet: ['harpy_boots', 'atalanta_boots'], back: ['harpy_wings', 'feather_wings'], shield: ['shield_harpy', 'shield_pelta'], weapon: 'harpy_talons' },
  { id: 'gorgon', lvl: 24, classic: true, he: 'הגורגונה', en: 'Gorgon', tint: '#c8a040', desc: LN('זהב וירוק של אחיות מדוזה. מי שמביט ישר אל הפנים האלה שוכח איך זזים.', "The gold and green of Medusa's sisters. Whoever looks straight into that face forgets how to move."),
    head: ['gorgon_helm', 'thracian_helm'], neck: ['gorgon_amulet', 'serpent_amulet'], body: ['gorgon_corslet', 'scale_cuirass'], feet: ['gorgon_greaves', 'bronze_greaves'], back: ['gorgon_wings', 'feather_wings'], shield: 'shield_gorgon',
    weapon: [['gorgon_spear', 'hoplite_dory', { el: 'poison', he: 'חנית הגורגונה', en: 'Gorgon Spear' }]] },
  { id: 'heracles', lvl: 26, classic: true, he: 'הרקלס', en: "Heracles'", key: 'Heracles', tint: '#d8a048', desc: LN('השלל של שתים־עשרה העבודות: עור האריה, תפוחי הזהב, נוצות הציפורים מסטימפליס.', 'The spoils of the twelve labours: the lion skin, the golden apples, the feathers of the Stymphalian birds.'),
    head: ['heracles_helm', 'boar_helm'], neck: ['heracles_amulet', 'fleece_amulet'], body: 'nemean_pelt', feet: 'apple_boots', back: ['stymphalian_wings', 'feather_wings'], shield: ['shield_heracles', 'shield_round'],
    weapon: [['heracles_club', 'cyclops_maul', { he: 'אלת הרקלס', en: "Heracles' Club" }]],
    names: { nemean_pelt: ['עור האריה של הרקלס', "Heracles' Lion Pelt"], apple_boots: ['מגפי תפוחי הזהב של הרקלס', "Heracles' Golden-Apple Boots"], stymphalian_wings: ['כנפי הסטימפלידות של הרקלס', "Heracles' Stymphalian Wings"] } },
  { id: 'achilles', lvl: 28, classic: true, he: 'אכילס', en: "Achilles'", key: 'Achilles', tint: '#ffc83a', desc: LN('זהב של גיבור, מהנפחייה של הפייסטוס. רק העקב נשאר חשוף.', "A hero's gold, from Hephaestus' forge. Only the heel is left bare."),
    head: 'achilles_helm', neck: ['achilles_amulet', 'sun_amulet'], body: ['achilles_cuirass', 'muscle_cuirass'], feet: ['achilles_greaves', 'bronze_greaves'], back: ['achilles_wings', 'feather_wings'], shield: 'shield_achilles', weapon: 'pelias_spear',
    names: { pelias_spear: ['חנית אכילס', "Achilles' Spear"] } },
  { id: 'silver', lvl: 30, he: 'הכסף', en: 'Silver', tint: '#c8c8d0', desc: LN('כסף מבהיק, שמצליח להאיר גם בחושך. הוא לא מכביד, ולא נסדק.', 'Bright silver that shines even in the dark. It does not weigh, and it does not crack.'),
    head: 'silver_corinthian', neck: 'argent_fleece', body: 'steel_cuirass', feet: 'silver_greaves', back: ['silver_wings', 'feather_wings'], shield: ['shield_silver', 'shield_square'],
    weapon: [['silver_spatha', 'spatha', { he: 'ספאתה כסופה', en: 'Silver Spatha' }]],
    names: { silver_corinthian: ['קסדה קורינתית מכסף', 'Silver Corinthian Helm'], argent_fleece: ['קמע גיזת הכסף', 'Silver Fleece Amulet'], steel_cuirass: ['שריון שרירים מכסף', 'Silver Muscle Cuirass'], silver_greaves: ['מגני שוק מכסף', 'Silver Greaves'] } },
  { id: 'hydra', lvl: 38, he: 'ההידרה', en: 'Hydra', tint: '#3a9a6a', desc: LN('קשקשים ירוקים מצווארי ההידרה. מה שנחתך מהם צומח חזרה, וכך גם הכוח.', "Green scales from the Hydra's necks. What is cut from them grows back, and so does your strength."),
    head: 'hydra_helm', neck: ['hydra_amulet', 'serpent_amulet'], body: 'hydra_corslet', feet: ['hydra_greaves', 'dragon_boots'], back: ['hydra_wings', 'membrane_wings'], shield: ['shield_hydra', 'shield_oval'],
    weapon: [['hydra_fangs', 'twin_makhairai', { el: 'poison', he: 'ניבי ההידרה', en: 'Hydra Fangs' }]] },
  { id: 'gigante', lvl: 46, he: 'הגיגנטים', en: 'Gigante', tint: '#5a6a58', desc: LN('ברזל ירקרק וכבד של בני האדמה שנלחמו באלים. כל צעד מרעיד את הקרקע.', 'The heavy greenish iron of the earth-born who fought the gods. Every step shakes the ground.'),
    head: 'gigante_helm', neck: ['gigante_amulet', 'sun_amulet'], body: 'gigante_cuirass', feet: 'gigante_greaves', back: ['gigante_wings', 'membrane_wings'], shield: ['shield_gigante', 'shield_tower'], weapon: ['giant_maul', 'gigantes_axe'],
    names: { giant_maul: ['פטיש הגיגנטים', 'Gigante Maul'] } },
  { id: 'moirai', lvl: 50, he: 'המוירות', en: 'Moirai', tint: '#e8e0f8', desc: LN('לבן ולילך כמו חוט הגורל. מי שלובשת אותו יודעת מה יבוא רגע לפני שזה בא.', 'White and lilac like the thread of fate. Whoever wears it knows what comes a moment before it does.'),
    head: ['moirai_helm', 'corinthian_helm'], neck: 'moirai_amulet', body: ['moirai_cuirass', 'linen_cuirass'], feet: ['moirai_sandals', 'krepides', { he: 'סנדלי המוירות', en: 'Moirai Sandals' }], back: ['moirai_wings', 'feather_wings'], shield: ['shield_moirai', 'shield_dipylon'], weapon: 'moirai_shears' },
  { id: 'chimera', lvl: 56, he: 'הכימרה', en: 'Chimera', tint: '#c8402a', desc: LN('אדום כמו הנשימה שלה: אריה, עז ונחש בגוף אחד, ואש שלא נגמרת.', 'Red as her breath: lion, goat and serpent in one body, and a fire that never ends.'),
    head: 'chimera_helm', neck: ['chimera_amulet', 'sun_amulet'], body: 'chimera_pelt', feet: ['chimera_greaves', 'dragon_boots'], back: ['chimera_wings', 'membrane_wings'], shield: 'shield_chimera', weapon: 'chimera_glaive' },
  { id: 'athena', lvl: 58, classic: true, he: 'אתנה', en: "Athena's", key: 'Athena', tint: '#e8ecf8', desc: LN('כסף ולבן וזהב, החוכמה במלחמה. האלה מעניקה אותו למי שמנצחת בלי לשנוא.', 'Silver, white and gold, wisdom in war. The goddess gives it to those who win without hatred.'),
    head: ['athena_helm', 'corinthian_helm'], neck: ['athena_amulet', 'owl_amulet'], body: ['athena_cuirass', 'muscle_cuirass'], feet: ['athena_sandals', 'talaria', { he: 'סנדלי אתנה', en: "Athena's Sandals" }], back: ['athena_wings', 'feather_wings'], shield: 'shield_aegis', weapon: 'athena_lance' },
  { id: 'ember', lvl: 64, he: 'הגחלת', en: 'Ember', tint: '#ff5a2a', desc: LN('שחור שזוהר באדום בין התפרים, כמו גחלת שלא כבתה מאז שנולד העולם.', 'Black glowing red between the seams, like an ember unquenched since the world was born.'),
    head: 'ember_helm', neck: 'flame_amulet', body: ['ember_plate', 'dragon_plate'], feet: 'flame_boots', back: ['ember_wings', 'membrane_wings'], shield: ['shield_ember', 'shield_helios'],
    weapon: [['ember_broadsword', 'broadsword', { el: 'fire', he: 'חרב הגחלת', en: 'Ember Broadsword' }]],
    names: { flame_amulet: ['קמע הגחלת', 'Ember Amulet'], flame_boots: ['מגפי הגחלת', 'Ember Greaves'] } },
  { id: 'typhon', lvl: 68, he: 'טיפון', en: "Typhon's", key: 'Typhon', tint: '#b8302a', desc: LN('קשקשים אדומים מראשי הנחשים של הענק שישן מתחת לאטנה. הם עוד זוכרים איך להתרפא.', 'Red scales from the serpent heads of the giant asleep under Etna. They still remember how to heal.'),
    head: ['typhon_helm', 'darkness_helm'], neck: ['typhon_amulet', 'serpent_amulet'], body: 'typhon_corslet', feet: ['typhon_greaves', 'dragon_boots'], back: ['typhon_wings', 'membrane_wings'], shield: ['shield_typhon', 'shield_gorgon'], weapon: 'typhon_halberd',
    names: { typhon_corslet: ['שריון טיפון', "Typhon's Corslet"] } },
  { id: 'storm', lvl: 72, he: 'הסערה', en: 'Storm', tint: '#6ab0ff', desc: LN('כחול ולבן של ענן סערה, וברק שקופץ בין החוליות. את שומעת את הרעם לפני המכה.', 'The blue and white of a storm cloud, and lightning leaping between the links. You hear the thunder before the blow.'),
    head: ['storm_helm', 'spartan_helm'], neck: ['storm_charm', 'sea_amulet', { he: 'קמע הסערה', en: 'Storm Amulet' }], body: ['storm_cuirass', 'muscle_cuirass'], feet: ['storm_sandals', 'talaria', { he: 'סנדלי הסערה', en: 'Storm Sandals' }],
    back: ['storm_wings', 'feather_wings'], shield: 'shield_thunder', weapon: 'storm_dory',
    names: { shield_thunder: ['מגן הסערה', 'Storm Shield'], storm_dory: ['חנית הסערה', 'Storm Spear'] } },
  { id: 'titan', lvl: 76, he: 'הטיטאן', en: 'Titan', tint: '#e8c040', desc: LN('זהב כבד של מי שהחזיקו את השמיים לפני האלים. קשה לנוע בו וקל להרגיש בו בטוחה.', 'The heavy gold of those who held up the sky before the gods. Hard to move in, easy to feel safe in.'),
    head: 'titan_crown', neck: ['titan_amulet', 'fleece_amulet'], body: 'titan_cuirass', feet: 'titan_greaves', back: ['titan_wings', 'feather_wings'], shield: ['shield_titan', 'shield_achilles'], weapon: 'titan_edge' },
  { id: 'nyx', lvl: 84, he: 'ניקס', en: 'Nyx', tint: '#5a4a8a', desc: LN('סגול־שחור כמו שמי לילה בלי כוכבים, של אלת הלילה עצמה. אין לו צל, כי הוא הצל.', 'Violet-black as a starless sky, the goddess of Night herself. It casts no shadow, because it is the shadow.'),
    head: ['nyx_helm', 'darkness_helm'], neck: ['nyx_amulet', 'sea_amulet'], body: 'nyx_plate', feet: ['nyx_greaves', 'dragon_boots'], back: ['nyx_wings', 'membrane_wings'], shield: 'shield_night', weapon: 'nyx_daggers',
    names: { nyx_plate: ['שריון ניקס', 'Nyx Plate'], shield_night: ['אספיס ניקס', 'Nyx Aspis'] } },
  { id: 'olympian', lvl: 88, he: 'האולימפוס', en: 'Olympian', tint: '#fff1b0', desc: LN('זהב ולבן כמו פסגה בשמש: מה שהאלים לובשים כשהם יורדים בין בני התמותה.', 'Gold and white like a peak in the sun: what the gods wear when they walk among mortals.'),
    head: 'olympian_helm', neck: ['olympian_amulet', 'fleece_amulet'], body: 'olympian_pelt', feet: ['olympian_sandals', 'talaria', { he: 'סנדלי האולימפוס', en: 'Olympian Sandals' }], back: ['dawn_wings', 'feather_wings'], shield: 'shield_olympus',
    weapon: [['olympian_greatsword', 'rhomphaia', { el: 'holy', he: 'חרב האולימפוס הגדולה', en: 'Olympian Greatsword' }]],
    names: { dawn_wings: ['כנפי האולימפוס', 'Olympian Wings'], shield_olympus: ['מגן האולימפוס', 'Olympian Shield'] } },
  { id: 'star', lvl: 92, he: 'הכוכבים', en: 'Star', tint: '#8ab4ff', desc: LN('כחול של כוכבים נופלים, קר וחם גם יחד. הדרך נפתחת מתחת למי שלובשת אותו.', 'The blue of falling stars, cold and warm at once. The road opens under whoever wears it.'),
    head: 'kronos_helm', neck: 'star_amulet', body: ['star_plate', 'scale_cuirass'], feet: 'star_boots', back: ['star_wings', 'feather_wings'], shield: ['shield_star', 'shield_helios'],
    weapon: [['star_spatha', 'spatha', { el: 'frost', he: 'ספאתת הכוכבים', en: 'Star Spatha' }]],
    names: { kronos_helm: ['קסדת הכוכבים', 'Star Helm'] } },
  // ---- on to level 300: the old gods and the Titans
  { id: 'aether', lvl: 110, he: 'האיתר', en: 'Aether', tint: '#bfe8ff', desc: LN('עשוי מהאוויר הזך שהאלים נושמים, מעל העננים. קל כמו אור.', 'Made of the pure air the gods breathe, above the clouds. Light as light.'),
    head: ['aether_helm', 'corinthian_helm'], neck: ['aether_amulet', 'sea_amulet'], body: ['aether_cuirass', 'muscle_cuirass'], feet: ['aether_sandals', 'talaria', { he: 'סנדלי האיתר', en: 'Aether Sandals' }], back: ['aether_wings', 'feather_wings'], shield: ['shield_aether', 'shield_oval'],
    weapon: [['aether_spatha', 'spatha', { el: 'lightning', he: 'ספאתת האיתר', en: 'Aether Spatha' }]] },
  { id: 'hyperion', lvl: 130, he: 'היפריון', en: "Hyperion's", key: 'Hyperion', tint: '#ffb84a', desc: LN('של הטיטאן אבי השמש: זהב לוהט שהעין לא יכולה להחזיק בו.', 'Of the Titan, father of the Sun: blazing gold the eye cannot hold.'),
    head: ['hyperion_helm', 'achilles_helm'], neck: ['hyperion_amulet', 'sun_amulet'], body: ['hyperion_cuirass', 'muscle_cuirass'], feet: ['hyperion_greaves', 'bronze_greaves'], back: ['hyperion_wings', 'feather_wings'], shield: ['shield_hyperion', 'shield_helios'],
    weapon: [['hyperion_sunblade', 'flamberge', { el: 'fire', he: 'חרב השמש של היפריון', en: "Hyperion's Sunblade" }]] },
  { id: 'selene', lvl: 150, he: 'סלנה', en: "Selene's", key: 'Selene', tint: '#d8e0ff', desc: LN('כסף של ירח מלא, של אלת הירח. קר ושקט ובוהק בלילה.', 'The silver of a full moon, of the goddess of the Moon. Cold and quiet and bright at night.'),
    head: ['selene_helm', 'owl_helm'], neck: ['selene_amulet', 'sea_amulet'], body: ['selene_cuirass', 'scale_cuirass'], feet: ['selene_boots', 'atalanta_boots'], back: ['selene_wings', 'feather_wings'], shield: ['shield_selene', 'shield_crescent'],
    weapon: [['selene_crescents', 'twin_makhairai', { el: 'frost', he: 'סהרוני סלנה', en: "Selene's Crescents" }]] },
  { id: 'prometheus', lvl: 170, he: 'פרומתאוס', en: "Prometheus'", key: 'Prometheus', tint: '#ff7a2a', desc: LN('של הטיטאן שגנב את האש מהאלים: שחור ולוהט, והלהבה בו לא כבה.', 'Of the Titan who stole fire from the gods: black and burning, and the flame in it never dies.'),
    head: ['prometheus_helm', 'spartan_helm'], neck: ['prometheus_amulet', 'sun_amulet'], body: ['prometheus_plate', 'dragon_plate'], feet: ['prometheus_greaves', 'dragon_boots'], back: ['prometheus_wings', 'membrane_wings'], shield: ['shield_prometheus', 'shield_helios'],
    weapon: [['prometheus_torchblade', 'broadsword', { el: 'fire', he: 'חרב הלפיד של פרומתאוס', en: "Prometheus' Torchblade" }]] },
  { id: 'atlas', lvl: 190, he: 'אטלס', en: "Atlas'", key: 'Atlas', tint: '#9a8a6a', desc: LN('אבן וארד של הטיטאן שמחזיק את השמיים על כתפיו. שום מכה לא מזיזה אותו.', 'The stone and bronze of the Titan who holds the sky on his shoulders. No blow moves it.'),
    head: ['atlas_helm', 'thracian_helm'], neck: ['atlas_amulet', 'owl_amulet'], body: ['atlas_cuirass', 'muscle_cuirass'], feet: ['atlas_greaves', 'bronze_greaves'], back: ['atlas_wings', 'membrane_wings'], shield: ['shield_atlas', 'shield_tower'],
    weapon: [['atlas_greatsword', 'colossus_blade', { he: 'חרב הענק של אטלס', en: "Atlas' Greatsword" }]] },
  { id: 'thanatos', lvl: 210, he: 'תנטוס', en: "Thanatos'", key: 'Thanatos', tint: '#4a4a5e', desc: LN('אפור וקר, של המוות עצמו. מי שהוא נוגע בו כבר לא מתווכח.', 'Grey and cold, of Death himself. Whoever it touches no longer argues.'),
    head: ['thanatos_helm', 'darkness_helm'], neck: ['thanatos_amulet', 'serpent_amulet'], body: ['thanatos_cuirass', 'scale_cuirass'], feet: ['thanatos_greaves', 'dragon_boots'], back: ['thanatos_wings', 'membrane_wings'], shield: ['shield_thanatos', 'shield_round'],
    weapon: [['thanatos_scythe', 'kronos_scythe', { el: 'shadow', he: 'חרמש תנטוס', en: "Thanatos' Scythe" }]] },
  { id: 'nemesis', lvl: 230, he: 'נמסיס', en: "Nemesis'", key: 'Nemesis', tint: '#c83a5a', desc: LN('אדום של נקמה צודקת. האלה מחזירה לכל אחד בדיוק את מה שעשה.', 'The red of rightful vengeance. The goddess pays everyone back exactly what they did.'),
    head: ['nemesis_helm', 'corinthian_helm'], neck: ['nemesis_amulet', 'fleece_amulet'], body: ['nemesis_cuirass', 'muscle_cuirass'], feet: ['nemesis_boots', 'atalanta_boots'], back: ['nemesis_wings', 'feather_wings'], shield: ['shield_nemesis', 'shield_square'],
    weapon: [['nemesis_twinblades', 'twin_gladii', { el: 'holy', he: 'חרבות הנקמה של נמסיס', en: "Nemesis' Twinblades" }]] },
  { id: 'oceanus', lvl: 250, he: 'אוקיינוס', en: 'Oceanus', tint: '#2a9ad8', desc: LN('של הנהר הגדול שמקיף את העולם: כחול עמוק, ומים שלא נגמרים.', 'Of the great river that circles the world: deep blue, and water without end.'),
    head: ['oceanus_helm', 'thracian_helm'], neck: ['oceanus_amulet', 'sea_amulet'], body: ['oceanus_cuirass', 'scale_cuirass'], feet: ['oceanus_boots', 'ice_boots'], back: ['oceanus_wings', 'membrane_wings'], shield: ['shield_oceanus', 'shield_shell'],
    weapon: [['oceanus_trident', 'poseidon_trident', { el: 'frost', he: 'קלשון אוקיינוס', en: 'Oceanus Trident' }]] },
  { id: 'erebus', lvl: 270, he: 'ארבוס', en: 'Erebus', tint: '#2a1a3a', desc: LN('החושך הראשון, שהיה עוד לפני הלילה. האור נבלע בו ולא חוזר.', 'The first darkness, older than Night. Light is swallowed by it and does not come back.'),
    head: ['erebus_helm', 'darkness_helm'], neck: ['erebus_amulet', 'serpent_amulet'], body: ['erebus_plate', 'dragon_plate'], feet: ['erebus_greaves', 'dragon_boots'], back: ['erebus_wings', 'membrane_wings'], shield: ['shield_erebus', 'shield_gorgon'],
    weapon: [['erebus_rhomphaia', 'rhomphaia', { el: 'shadow', he: 'רומפאיית ארבוס', en: 'Erebus Rhomphaia' }]] },
  { id: 'aion', lvl: 290, he: 'איון', en: "Aion's", key: 'Aion', tint: '#f0e0a0', desc: LN('של הזמן האינסופי עצמו, שמקיף את גלגל המזלות. מה שנעשה בו נשאר לנצח.', 'Of endless Time itself, who turns the wheel of the stars. What is done in it stays for ever.'),
    head: ['aion_helm', 'achilles_helm'], neck: ['aion_amulet', 'fleece_amulet'], body: ['aion_cuirass', 'muscle_cuirass'], feet: ['aion_sandals', 'talaria', { he: 'סנדלי איון', en: "Aion's Sandals" }], back: ['aion_wings', 'feather_wings'], shield: ['shield_aion', 'shield_aegis'],
    weapon: [['aion_eternity', 'colossus_blade', { el: 'holy', he: 'להב הנצח של איון', en: "Aion's Eternity Blade" }]] },
  // ---- the five WINGED sets: level 150, Heroic only, a boss's rarest gift
  { id: 'fairy', lvl: 150, winged: true, he: 'הפיות', en: 'Fairy', tint: '#ffb8e8', desc: LN('עלי כותרת, טל וכנפי זכוכית של עם הפיות. קל כמו פרח ומהיר כמו משב רוח.', 'Petals, dew and glass wings of the fairy folk. Light as a flower and quick as a breeze.'),
    head: 'fairy_circlet', neck: 'fairy_amulet', body: 'fairy_dress', feet: 'fairy_slippers', back: 'fairy_wings', shield: 'shield_fairy', weapon: 'fairy_blades' },
  { id: 'angel', lvl: 150, winged: true, he: 'המלאכים', en: 'Angel', tint: '#fff4d0', desc: LN('לבן וזהב, הילה של אור וכנפיים גדולות של נוצות. מה שנוגע בו מתרפא.', 'White and gold, a halo of light and great feathered wings. Whatever it touches heals.'),
    head: 'angel_helm', neck: 'angel_amulet', body: 'angel_plate', feet: 'angel_greaves', back: 'angel_wings', shield: 'shield_angel', weapon: 'seraph_blade' },
  { id: 'chaos', lvl: 150, winged: true, he: 'הכאוס', en: 'Chaos', tint: '#ff4ad8', desc: LN('רסיסים של העולם השבור מלפני הבריאה, שחור ואש סגולה. שום דבר בו לא נשאר במקום.', 'Shards of the broken world before creation, black and violet fire. Nothing in it stays put.'),
    head: 'chaos_crown', neck: 'chaos_amulet', body: 'chaos_plate', feet: 'chaos_greaves', back: 'chaos_wings', shield: 'shield_chaos', weapon: 'chaos_twins' },
  { id: 'devil', lvl: 150, winged: true, he: 'השטן', en: 'Devil', tint: '#ff3a1a', desc: LN('ארגמן ושחור ואש מהתהום. קרניים, טפרים וכנפי עטלף קרועות.', 'Crimson and black and fire from the abyss. Horns, claws and ragged bat wings.'),
    head: 'devil_helm', neck: 'devil_amulet', body: 'devil_plate', feet: 'devil_greaves', back: 'devil_wings', shield: 'shield_devil', weapon: 'devil_trident' },
  { id: 'dragon', lvl: 150, winged: true, he: 'הדרקון השחור', en: 'Black Dragon', key: 'Dragon', tint: '#ff3a1e', desc: LN('הקשקשים, הניבים והכנפיים של הדרקון השחור. אש אדומה בוערת בין התפרים.', 'The scales, fangs and wings of the black dragon. Red fire burns between the seams.'),
    head: 'dragon_helm', neck: 'dragon_amulet', body: 'dragon_plate', feet: 'dragon_boots', back: 'dragon_wings', shield: 'shield_dragon', weapon: 'dragon_fangs' },
];
export const SET_SLOTS = ['head', 'neck', 'body', 'feet', 'back', 'shield', 'weapon'];
const SET_NAME = {
  head: (S) => LN(`קסדת ${S.he}`, `${S.en} Helm`), neck: (S) => LN(`קמע ${S.he}`, `${S.en} Amulet`), body: (S) => LN(`שריון ${S.he}`, `${S.en} Cuirass`),
  feet: (S) => LN(`מגפי ${S.he}`, `${S.en} Greaves`), back: (S) => LN(`כנפי ${S.he}`, `${S.en} Wings`), shield: (S) => LN(`מגן ${S.he}`, `${S.en} Shield`),
};
const SET_SRC = LN('שלל מאויבים חזקים ומשימות', 'Spoils of mighty foes and quests');
const WINGED_SRC = LN('רק בוס, לעיתים רחוקות מאוד, משאיר חלק מהסט הזה', 'Only a boss, and very rarely, leaves a piece of this set');
// standalone pieces whose names wrongly claimed a set (round 30)
const SET_RENAMES = { storm_amulet: ['קמע הענן', 'Cloud Amulet'], titan_eye: ['עין הקדמונים', 'Eye of the Ancients'], ice_boots: ['מגפי הקרח', 'Ice Boots'], xyston_spear: ['קסיסטון הפרשים', 'Cavalry Xyston'] };
const SET_MODELS = { raven_wings: 'feather_wings', bat_wings: 'membrane_wings' }; // (the round 28 wings were all the dragon's, tinted)
const setKey = (S) => (S.key || S.en).toLowerCase();
const slotItems = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]); // a weapon slot: one entry or a list of them
// the element's own special for a new set weapon (its strength rides the hit, scaleSp)
const EL_SPECIAL = { fire: () => S.burn(.3, 6, 3), frost: () => S.chill(.3, .35, 2.5), lightning: () => S.chain(.3, 3, 5, .5), poison: () => S.poison(.3, 5, 4, 3), shadow: () => S.lifesteal(.05), holy: () => S.mana(4) };
// pass 1 (weapons, before finalizeWeapon): members renamed, re-levelled and re-tinted, new set weapons made
function setWeapons() {
  for (const [id, [he, en]] of Object.entries(SET_RENAMES)) if (RAWW[id]) RAWW[id].name = LN(he, en);
  for (const Sd of SET_DEFS) {
    for (const v of slotItems(Sd.weapon)) {
      const [id, model, o = {}] = Array.isArray(v) ? v : [v];
      let w = RAWW[id];
      if (!w) {
        const el = o.el || null, tr = el ? [mixHex(ELEMENTS[el].color, '#ffffff', .55), ELEMENTS[el].color] : [mixHex(Sd.tint, '#ffffff', .6), Sd.tint];
        w = A(id, model, Sd.lvl, Sd.tint, { element: el, trail: tr, specials: [...(el ? [EL_SPECIAL[el]()] : []), ...RAWW[model].specials.slice(0, 1)] }, LN(o.he, o.en), Sd.desc, Sd.winged ? WINGED_SRC : SET_SRC);
      } else {
        if (!(Sd.classic && !w.base)) { LADDER[id] = Sd.lvl; w.minLevel = Sd.lvl; }
        if (w.base) w.tint = Sd.tint;
        const nm = Sd.names?.[id]; if (nm) w.name = LN(...nm);
      }
      w.suit = Sd.id;
    }
  }
}
// pass 2 (gear, before finalizeGear): the same for helmets, amulets, armour, boots, wings and shields
function setGear() {
  for (const [id, [he, en]] of Object.entries(SET_RENAMES)) if (RAWG[id]) RAWG[id].name = LN(he, en);
  for (const [id, m] of Object.entries(SET_MODELS)) if (RAWG[id]) RAWG[id].model = m;
  for (const Sd of SET_DEFS) for (const slot of SET_SLOTS) {
    if (slot === 'weapon') continue;
    const v = Sd[slot]; if (!v) continue;
    const [id, model, o = {}] = Array.isArray(v) ? v : [v];
    let x = RAWG[id];
    if (!x) {
      const T = RAWG[model] || (slot === 'back' ? RAWG.dragon_wings : RAWG.leather_cap), nm = o.he ? LN(o.he, o.en) : SET_NAME[slot](Sd);
      x = RAWG[id] = { id, slot, rarity: 'epic', minLevel: Sd.lvl, bonus: { ...T.bonus }, color: mixHex(T.color, Sd.tint, .65), model, tint: Sd.tint, name: nm, desc: Sd.desc, source: SET_SRC };
    } else {
      if (!(Sd.classic && !x.model)) x.minLevel = Sd.lvl;
      if (x.model) { x.tint = Sd.tint; x.color = mixHex(RAWG[x.model]?.color || x.color, Sd.tint, .65); }
      if (model) x.model = model;
      const nm = Sd.names?.[id]; if (nm) x.name = LN(...nm);
      else if (!x.name.en.toLowerCase().includes(setKey(Sd))) x.name = SET_NAME[slot](Sd);
    }
    x.suit = Sd.id;
  }
}
[
  // V sets out with the two-handed spear; Philon hands her his sword (village_blade, with her shield) on the Road of the Dead Heroes
  W('village_spear', 'polearm', 1, 'common', 1, 12.5, .88, 3.4, .05, null, ['#eef2f6', '#a8702e'], [],
    { he: 'חנית הכפר', en: 'Village Spear' },
    { he: 'חנית פשוטה מהנפחייה של הכפר: מוט מעץ אפר וחוד ארד. כשאוחזים בה בשתי ידיים, היא מרחיקה כל אויב.', en: 'A plain spear from the village smithy: an ash shaft and a bronze head. In both hands it keeps anything at a distance.' },
    { he: 'החנית שאיתה יצאת לדרך', en: 'The spear you set out with' }),
  W('village_blade', 'blade', 1, 'common', 1, 11, 1, 2.3, .05, null, ['#e8ecf2', '#9aa3b0'], [],
    { he: 'הקסיפוס של פילון', en: "Philon's Xiphos" },
    { he: 'החרב הקצרה והישנה של פילון, שעשתה איתו את כל הדרך מתבאי. לא מפוארת, אבל מעולם לא בגדה בו. ואיתה מגן ליד השמאלית.', en: "Philon's old short sword, carried all the way from Thebes. Not grand, but it has never let him down. It comes with a shield for her left arm." },
    { he: 'מתנה מפילון בדרך הגיבורים המתים', en: "Philon's gift on the Road of the Dead Heroes" }),

  // ---- tier 1 (levels 2-5): the Aegean coast
  W('bronze_kopis', 'blade', 1, 'common', 2, 13, .95, 2.3, .07, null, ['#f3c877', '#a8702e'], [],
    { he: 'קופיס ארד', en: 'Bronze Kopis' },
    { he: 'להב ארד מעוקל קדימה. כל משקלו בקצה, וכל מכה נוחתת כמו גרזן.', en: 'A forward-curving bronze chopper. Its weight sits in the tip, so every cut lands like an axe.' },
    { he: 'הנפח של הכפר', en: 'Village blacksmith' }),
  W('olive_club', 'blade', 1, 'common', 3, 15, .85, 2.2, .05, null, ['#c9a06a', '#6e4a2c'], [S.stagger(.2, .45)],
    { he: 'אלת זית', en: 'Olive Club' },
    { he: 'עץ זית מסוקס משובץ מסמרי ארד, בדיוק כמו שהרקלס אהב. מרעיד גולגלות.', en: 'Knotted olive wood studded with bronze, the way Heracles liked it. Rattles skulls.' },
    { he: 'חורשת הזיתים: חזירי בר', en: 'Olive grove: wild boars' }),
  W('hoplite_dory', 'spear', 1, 'common', 4, 13, .9, 3.2, .05, null, ['#eef2f6', '#8a6640'], [],
    { he: 'חנית ההופליט', en: 'Hoplite Dory' },
    { he: 'החנית של הפלנקס, עם אספיס ארד ביד השנייה: עלה ברזל בקצה אחד וחוד ארד בשני. מרחיקה ממך שיניים וטפרים.', en: 'The spear of the phalanx, with a bronze aspis on the other arm: an iron leaf at one end, a bronze spike at the other. Keeps teeth at a distance.' },
    { he: 'צללים של הופליטים שנפלו', en: 'Shades of fallen hoplites' }),
  W('harbor_daggers', 'dual', 1, 'common', 3, 8.5, 1.6, 2.0, .12, null, ['#e9eef3', '#3c6e9a'], [],
    { he: 'פגיונות הנמל', en: 'Harbour Daggers' },
    { he: 'זוג סכיני דייגים עם ידיות של חבל מזופת. הדייגים נשבעים בהם, המבריחים מקללים אותם.', en: 'A pair of gutting knives with tarred-rope grips. Fishermen swear by them; smugglers swear at them.' },
    { he: 'הדייג שבנמל', en: 'The harbour fisherman' }),

  // ---- tier 2 (levels 7-10): hills, forests and islands
  W('minoan_labrys', 'blade', 2, 'rare', 7, 18, .92, 2.3, .14, null, ['#f6cf7c', '#b02a24'], [S.crit(2.2)],
    { he: 'לאבריס מינואי', en: 'Minoan Labrys' },
    { he: 'הגרזן הכפול המקודש של כרתים, קטן מספיק ליד אחת. שני הסהרונים שלו מוצאים כל סדק בשריון.', en: 'The sacred double axe of Crete, small enough for one hand. Its twin crescents find every gap in armour.' },
    { he: 'תיבה במקדש החוף', en: 'Chest in the shore temple' }),
  W('cyclops_maul', 'twohand', 2, 'rare', 9, 27, .66, 2.9, .05, null, ['#d8cfc0', '#b07a34'], [S.stagger(.4, .7)],
    { he: 'פטיש הקיקלופ', en: 'Cyclops Maul' },
    { he: 'סלע קשור לגזע עץ בחישוקי ארד. העין החקוקה בו לעולם אינה ממצמצת.', en: 'A boulder lashed to a tree trunk with bronze bands. The eye carved on it never blinks.' },
    { he: 'הקיקלופ שבמערת האי', en: 'The cyclops of the island cave' }),
  W('amazon_sagaris', 'dual', 2, 'rare', 8, 11, 1.6, 2.0, .12, null, ['#f2f5f8', '#a8302a'], [S.stagger(.12, .35)],
    { he: 'גרזיני האמזונות', en: 'Amazon Sagaris' },
    { he: 'זוג גרזיני סגריס של רוכבות היפוליטה: להב בצד אחד, מקור בצד השני.', en: "Twin sagaris axes of Hippolyta's riders: a blade on one side, a beak on the other." },
    { he: 'משימת המחנה האמזוני', en: 'Amazon camp quest' }),
  W('hermes_blades', 'dual', 2, 'rare', 10, 9, 1.85, 2.0, .2, null, ['#ffffff', '#f2c94c'], [S.crit(2)],
    { he: 'להבי הכנף של הרמס', en: 'Winged Blades of Hermes' },
    { he: 'קלים כמו שמועה ומהירים פי שניים. השליח משאיל אותם רק למי שלעולם אינו עוצר.', en: 'Light as a rumour and twice as fast. The messenger lends them only to those who never stop running.' },
    { he: 'מקדש הדרכים של הרמס', en: "Hermes' crossroads shrine" }),

  // ---- tier 3 (levels 12-15): the island of statues, Crete, the sea
  W('perseus_harpe', 'blade', 3, 'rare', 12, 20, 1, 2.4, .1, null, ['#e6eef8', '#7a8aa0'], [S.execute(.3, 2)],
    { he: 'הארפה של פרסאוס', en: 'Harpe of Perseus' },
    { he: 'חרב־המגל העשויה אדמנט, שכרתה ראש של גורגונה. מדוזה מסרבת להביט בה, ואת מבינה למה.', en: "The adamant sickle-sword that took a Gorgon's head. Medusa will not look at it, and you understand why." },
    { he: 'גן הפסלים', en: 'The Garden of Statues' }),
  W('asterion_axe', 'twohand', 3, 'epic', 14, 33, .68, 3.0, .15, null, ['#f4c97a', '#9a2a22'], [S.crit(2.4), S.stagger(.25, .6)],
    { he: 'הגרזן הגדול של אסטריון', en: "Asterion's Great Axe" },
    { he: 'הלאבריס של המינוטאור עצמו, מוכתר בקרני שור. מעטים מסוגלים להרים אותו, ועוד פחות לעצור אותו.', en: "The Minotaur's own labrys, crowned with bull horns. Few can lift it; fewer can stop it." },
    { he: 'לב המבוך של כרתים', en: 'Heart of the Labyrinth' }),
  W('poseidon_trident', 'spear', 3, 'epic', 15, 22, .92, 3.3, .08, 'frost', ['#c8f6ff', '#2a8aa0'], [S.chill(.3, .4, 2.5)],
    { he: 'הקלשון של פוסידון', en: 'Trident of Poseidon' },
    { he: 'חושל בארמון שמתחת לגלים, ולצידו מגן צדפה. כל דקירה נושאת את קור המעמקים ומאטה את מה שהיא נוגעת בו.', en: 'Forged in the palace beneath the waves, carried with a scallop-shell shield. Each thrust brings the cold of the deep and slows what it touches.' },
    { he: 'ממלכת פוסידון', en: "Poseidon's kingdom" }),
  W('medusa_fangs', 'dual', 3, 'epic', 13, 13, 1.7, 2.1, .12, 'poison', ['#c6ff9a', '#3f7a3a'], [S.poison(.35, 5, 4, 3)],
    { he: 'פגיונות הארס של מדוזה', en: "Medusa's Venom Daggers" },
    { he: 'שני פגיונות שהושחזו מניבי הנחשים של מדוזה, מתנה של אמון. הארס הירוק נוטף מהם וזוכר כל עוול.', en: "Two daggers ground from the fangs of Medusa's serpents, a gift of trust. Green venom drips from them and remembers every wrong." },
    { he: 'מתנה ממדוזה', en: 'A gift from Medusa' }),

  // ---- tier 4 (levels 17-20): the forgotten library, the underworld, Olympus' shadow
  W('athena_xiphos', 'blade', 4, 'epic', 17, 25, 1, 2.4, .1, 'holy', ['#fff6d6', '#e8b840'], [S.mana(3)],
    { he: 'קסיפוס של אתנה', en: 'Xiphos of Athena' },
    { he: 'בעל כנפי ינשוף וחיוור כירח; הוא מחדד את המחשבה כמו את הלהב.', en: 'Owl-winged and moon-pale, it sharpens the mind as much as the edge.' },
    { he: 'הספרייה הנשכחת', en: 'The Forgotten Library' }),
  W('hephaestus_hammer', 'twohand', 4, 'epic', 19, 44, .64, 2.9, .06, 'fire', ['#ffd04a', '#ff5a1a'], [S.burn(.45, 9, 3), S.stagger(.3, .6)],
    { he: 'פטיש הנפחייה של הפייסטוס', en: 'Forge-Hammer of Hephaestus' },
    { he: 'עדיין לוהט מהכבשן של האל בלב הר האטנה. מצית אויבים ומפיל אותם מרגליהם.', en: "Still glowing from the god's furnace under Etna. Sets foes alight and knocks them off their feet." },
    { he: 'הנפחייה של הפייסטוס', en: "Hephaestus' forge" }),
  W('hades_axe', 'twohand', 4, 'epic', 20, 42, .66, 3.0, .08, 'shadow', ['#d6b8ff', '#2a2a36'], [S.lifesteal(.08)],
    { he: 'גרזן הקרב של האדס', en: "Hades' Battle Axe" },
    { he: 'גרזן שחור כפול להבים, ועל ראשו גולגולת וכנפי עטלף. כל נשמה שהוא קוצר משלמת לך מס של חיים.', en: 'A black double-bladed axe with a skull and bat wings on its head. Every soul it reaps pays you a toll in life.' },
    { he: 'ארמון האדס', en: "Hades' palace" }),
  W('erinyes_sickles', 'dual', 4, 'epic', 18, 16, 1.75, 2.1, .12, 'fire', ['#ffb03a', '#c8261a'], [S.burn(.25, 6, 3)],
    { he: 'חרבות הלהבה של האריניות', en: 'Flame Swords of the Erinyes' },
    { he: 'זוג חרבות שהודלקו מהלפידים של האריניות. הלהבה אינה כבה, והן לעולם אינן שוכחות חוב.', en: 'Twin swords lit from the torches of the Furies. The flame never dies, and they never forget a debt.' },
    { he: 'שדות העונש בשאול', en: 'Fields of Punishment' }),

  // ---- tier 5 (levels 22-25): the gods' own arms
  W('keraunos', 'polearm', 5, 'legendary', 22, 38, .84, 3.7, .1, 'lightning', ['#fff8c8', '#5ab0ff'], [S.chain(.35, 3, 5, .6)],
    { he: 'מטה הקרן של זאוס', en: "Zeus' Horn Staff" },
    { he: 'מטה ארוך שבראשו קרן גביש תכלת שברקים מפצפצים סביבה. מכל מכה קופץ ברק אל האויבים הקרובים.', en: 'A long staff crowned with a horn of pale-blue crystal that crackles with lightning. Each strike sends bolts leaping to the nearest foes.' },
    { he: 'הלילה שבו האולימפוס נפל', en: 'The night Olympus fell' }),
  W('ares_warbringer', 'twohand', 5, 'legendary', 24, 50, .7, 3.1, .18, 'fire', ['#ff4a3a', '#5a0a12'], [S.lifesteal(.06), S.crit(2.5)],
    { he: 'מביא המלחמה של ארס', en: "Ares' Warbringer" },
    { he: 'חרב הענק של אל המלחמה, מוכתרת כמו הקסדה שלו. היא שותה את מה שהיא שופכת.', en: "The war god's greatsword, crested like his helm. It drinks what it spills." },
    { he: 'דו־קרב מול ארס', en: 'Duel with Ares' }),
  W('kronos_scythe', 'polearm', 5, 'legendary', 25, 40, .8, 3.8, .1, 'shadow', ['#e6d2ff', '#3a2a6a'], [S.chill(.4, .5, 3), S.execute(.25, 2)],
    { he: 'החרמש של קרונוס', en: 'Scythe of Kronos' },
    { he: 'החרמש שהפריד את השמיים מהארץ. הזמן מאט סביב הלהב שלו, והוא קוצר את החלשים.', en: 'The sickle that parted sky from earth. Time slows around its edge, and it reaps the weakened.' },
    { he: 'המקום שבו נולדו האלים', en: 'Where the gods were born' }),
  W('sun_and_moon', 'dual', 5, 'legendary', 23, 19, 1.8, 2.1, .14, 'holy', ['#fff1a8', '#9fd0ff'], [S.burn(.25, 8, 3), S.chill(.25, .35, 2)],
    { he: 'השמש והירח של התאומים', en: 'Sun and Moon of the Twins' },
    { he: 'להב השמש של אפולו ולהב הירח של ארטמיס, כמו הסמל שעל המגן שלך. אחד שורף, השני מקפיא.', en: "Apollo's sun blade and Artemis' moon blade, the emblem on your own shield. One burns, one freezes." },
    { he: 'גני ההספרידות', en: 'Garden of the Hesperides' }),

  // ---- a gift, never found: the reaping scythe of Hades' Keres, forged for V at her own level (see forgedWeapon)
  W('keres_scythe', 'polearm', 3, 'epic', 1, 8.7, .96, 3.6, .12, 'shadow', ['#c8a8ff', '#2a1e3a'], [S.lifesteal(.05), S.execute(.2, 1.8)],
    { he: 'חרמש הקרס', en: 'Scythe of the Keres' },
    { he: 'החרמש של הקרס, משרתותיו של האדס הקוצרות את הנופלים בשדות הקרב. להב שחור, להבה סגולה, ושום רחמים על מי שכבר כורע.', en: "The scythe of the Keres, Hades' servants who reap the fallen on the battlefield. A black blade, a violet flame, and no mercy for whoever is already kneeling." },
    { he: 'מתנה מהאדס', en: 'A gift from Hades' }),
  // ---- and one from Poseidon's temple on the Island of No Return: a short one-handed trident that carries his wave
  W('tide_trident', 'spear', 3, 'epic', 1, 10.5, .96, 3.0, .08, 'frost', ['#bff4ea', '#2a7a6a'], [S.chill(.25, .35, 2)],
    { he: 'קלשון הגאות', en: 'Tide Trident' },
    { he: 'קלשון קצר מארד ירוק מהמקדש של פוסידון באי, קל מספיק ליד אחת, ולצידו מגן צדפה. המים עוד זוכרים אותו: הגל של פוסידון יוצא ממנו כמו מבית.', en: "A short trident of green bronze from Poseidon's temple on the island, light enough for one hand, carried with a scallop shield. The water still remembers it: Poseidon's wave rises from it as if coming home." },
    { he: 'מתנה מהמקדש של פוסידון', en: "A gift from Poseidon's temple" }),
  // ---- round 22 (Roy): the black dragon's set (with dragon_plate and dragon_wings in GEAR): the strongest pair of blades
  W('dragon_fangs', 'dual', 5, 'legendary', 60, 34, 1.8, 2.2, .18, 'fire', ['#ff5a3a', '#1a1014'], [S.burn(.35, 16, 3), S.lifesteal(.06)], // round 23 (Roy): level 60 like the whole set, and strong to match
    { he: 'ניבי הדרקון השחור', en: 'Black Dragon Fangs' },
    { he: 'שתי חרבות שחורות שחושלו משיני הדרקון השחור, משוננות כמו לסת, ואש אדומה בוערת בתוכן. הן שורפות את מה שהן פוגעות בו ומחזירות לך חיים.', en: "Two black swords forged from the black dragon's teeth, serrated like a jaw, with red fire burning inside. They burn what they strike and give you back life." },
    { he: 'אוצר הדרקון השחור', en: "The black dragon's hoard" }),

  // ---- round 28: the later ladder (levels 24..95). Same hands-on models in other metals and colours (A = an existing pattern, retinted)
  // blades
  A('argo_blade', 'athena_xiphos', 30, '#3aa6a0', { element: 'frost', trail: ['#c8fff4', '#2a8aa0'], specials: [S.chill(.3, .35, 2.5)] },
    { he: 'חרב הארגו', en: 'Blade of the Argo' },
    { he: 'חרב שחושלה מברזל הקרקס של ספינת הארגו, ירוקה מרוב מלח. היא מאטה את מי שהיא נוגעת בו כמו גאות.', en: 'Forged from the iron keel-plates of the Argo, green with salt. It slows what it touches like a tide.' },
    { he: 'האי של הארגונאוטים', en: 'The Isle of the Argonauts' }),
  A('theseus_blade', 'perseus_harpe', 44, '#c8a060', { element: null, trail: ['#fff0c8', '#a8702e'], specials: [S.execute(.3, 2.2)] },
    { he: 'חרבו של תזאוס', en: "Theseus' Blade" },
    { he: 'החרב שהונחה מתחת לסלע של אביו, וכל ילד באתונה מכיר אותה. היא מסיימת את מה שכבר נפצע.', en: "The sword left under the stone by his father; every child in Athens knows it. It finishes what is already wounded." },
    { he: 'המצודה של אתונה העתיקה', en: 'The citadel of old Athens' }),
  A('orichalcum_blade', 'athena_xiphos', 60, '#e87a3a', { element: 'fire', trail: ['#ffe0a0', '#ff5a1a'], specials: [S.burn(.3, 5, 3), S.mana(4)] },
    { he: 'חרב האוריכלקום', en: 'Orichalcum Blade' },
    { he: 'מתכת אדומה וזוהרת מאטלנטיס שטבעה. הלהב חם ביד, ושום מגן ארד לא עומד בפניו.', en: 'The red, glowing metal of drowned Atlantis. The edge is warm in the hand and no bronze shield stands before it.' },
    { he: 'מקדש הים העמוק', en: 'The deep-sea temple' }),
  A('titan_edge', 'perseus_harpe', 80, '#7a4ad8', { element: 'shadow', trail: ['#e6d2ff', '#4a2a8a'], specials: [S.lifesteal(.05), S.crit(2.4)] },
    { he: 'להב הטיטאן', en: 'Titan Edge' },
    { he: 'מגל של הטיטאנים הכלואים בטרטרוס, סגול כמו חצות. הוא שותה חיים וחותך עמוק.', en: 'A sickle of the Titans bound in Tartarus, violet as midnight. It drinks life and cuts deep.' },
    { he: 'שערי הטרטרוס', en: 'The gates of Tartarus' }),
  // spears (with a shield)
  A('xyston_spear', 'hoplite_dory', 34, '#a8302a', { element: null, trail: ['#ffe8e0', '#a8302a'], specials: [S.stagger(.25, .5)] },
    { he: 'קסיסטון ספרטני', en: 'Spartan Xyston' },
    { he: 'חנית הפרשים הספרטנית, ארוכה, אדומה בקצה, ועם אספיס ביד השנייה. מי שנדקר ממנה מסתחרר.', en: 'The Spartan cavalry spear, long and red at the tip, with an aspis on the other arm. Whoever is struck by it reels.' },
    { he: 'מחנה ספרטה', en: 'The camp at Sparta' }),
  A('pelias_spear', 'poseidon_trident', 50, '#e8c040', { element: 'holy', trail: ['#fff8d0', '#e8b840'], specials: [S.execute(.25, 1.9)] },
    { he: 'חנית הפליון', en: 'Spear of Mount Pelion' },
    { he: 'עץ אפר מהר פליון, החנית שהקנטאור כירון נתן לאכילס. מתחת לזהב עוד מרגישים את הכבוד שלה.', en: 'Ash wood from Mount Pelion, the spear the centaur Chiron gave Achilles. Beneath the gold you can still feel its honour.' },
    { he: 'המערה של כירון', en: "Chiron's cave" }),
  A('athena_lance', 'hoplite_dory', 70, '#e0e8f8', { element: 'holy', trail: ['#ffffff', '#9fd0ff'], specials: [S.mana(5), S.stagger(.2, .5)] },
    { he: 'רומח אתנה', en: "Athena's Lance" },
    { he: 'חנית של כסף ואור, שהאלה מניחה בידי מי שמנצח בלי לשנוא. המחשבה חדה כמו הקצה.', en: 'A spear of silver and light, which the goddess places in the hands of those who win without hatred. The mind is as sharp as the point.' },
    { he: 'מקדש אתנה על האולימפוס', en: "Athena's temple on Olympus" }),
  A('storm_dory', 'poseidon_trident', 90, '#ffe866', { element: 'lightning', trail: ['#fffbd8', '#5ab0ff'], specials: [S.chain(.3, 3, 6, .6)] },
    { he: 'חנית הסערה', en: 'Stormspear' },
    { he: 'חנית מארד שחור שברק קופץ ממנה לכל מה שבקרבת מקום. את שומעת את הרעם לפני המכה.', en: 'A spear of black bronze from which lightning leaps to everything nearby. You hear the thunder before the blow.' },
    { he: 'לב הסערה', en: 'The heart of the storm' }),
  // two-handed
  A('giant_maul', 'cyclops_maul', 40, '#8a8f98', { element: null, trail: ['#e8e8f0', '#6a6f78'], specials: [S.stagger(.4, .8)] },
    { he: 'פטיש הענק', en: "Giant's Maul" },
    { he: 'גוש הרים שנקשר לגזע אורן שלם. הקרקע רועדת בכל נפילה שלו, והאויבים נופלים איתה.', en: 'A lump of mountain lashed to a whole pine. The ground shakes with every fall of it, and foes fall with it.' },
    { he: 'עמק הענקים', en: 'The valley of the giants' }),
  A('gigantes_axe', 'asterion_axe', 55, '#4a8a5a', { element: 'poison', trail: ['#c6ffb0', '#2f6a3a'], specials: [S.poison(.3, 6, 4, 3), S.crit(2.4)] },
    { he: 'גרזן הגיגנטים', en: 'Axe of the Gigantes' },
    { he: 'גרזן של בני האדמה שנלחמו באלים. הלהב ירוק מרעל שהם ירקו אל הדם שנשפך.', en: 'The axe of the earth-born who fought the gods. The blade is green with venom they spat into spilled blood.' },
    { he: 'שדה הפלגרא', en: 'The Phlegraean Fields' }),
  A('ouranos_blade', 'ares_warbringer', 75, '#6ab0ff', { element: 'frost', trail: ['#e8f6ff', '#3a7ad8'], specials: [S.chill(.35, .4, 2.5), S.crit(2.4)] },
    { he: 'חרבו של אורנוס', en: "Blade of Ouranos" },
    { he: 'חרב של שמיים קפואים, כחולה ושקופה כמו אוויר גבוה. בכל מכה אוזל הדם מהפנים של האויב.', en: 'A sword of frozen sky, blue and clear as high air. With each blow the colour drains from the foe.' },
    { he: 'ראש הרקיע', en: 'The roof of the sky' }),
  A('tartarus_cleaver', 'hades_axe', 95, '#ff3a3a', { element: 'fire', trail: ['#ffd0a0', '#ff2a1a'], specials: [S.burn(.4, 14, 3), S.lifesteal(.07)] },
    { he: 'גרזן הטרטרוס', en: 'Cleaver of Tartarus' },
    { he: 'גרזן מתחת לאדמה הלוהטת, אדום מגחלים שלא כבו אלפי שנה. כל נפש שהוא קוצר מחממת אותך.', en: 'An axe from the burning deep, red with embers unquenched for ten thousand years. Every soul it reaps warms you.' },
    { he: 'הבור של הטרטרוס', en: 'The pit of Tartarus' }),
  // polearms
  A('chimera_glaive', 'kronos_scythe', 52, '#c85a2a', { element: 'fire', trail: ['#ffe0a0', '#d8501a'], specials: [S.burn(.35, 8, 3), S.execute(.25, 2)] },
    { he: 'חרב־המוט של הכימרה', en: 'Chimera Glaive' },
    { he: 'מוט ארוך שבקצהו להב מעוקל מניבי הכימרה. הלהב אדום כמו נשימתה והוא מצית מה שהוא פוצע.', en: "A long shaft ending in a curved blade from the Chimera's fangs. The edge is red as her breath and sets alight what it wounds." },
    { he: 'ההר של ליקיה', en: 'The mountain of Lycia' }),
  A('typhon_halberd', 'keraunos', 72, '#7aff9a', { element: 'poison', trail: ['#e0ffd0', '#2a8a4a'], specials: [S.poison(.35, 7, 4, 4)] },
    { he: 'הלברד טיפון', en: "Typhon's Halberd" },
    { he: 'רומח ארוך שקצהו קרן של הענק שעוד ישן מתחת להר אטנה. ארס ירוק שוקק בעורקיו.', en: 'A long polearm tipped by a horn of the giant who still sleeps under Etna. Green venom stirs in its veins.' },
    { he: 'המערה של טיפון', en: "Typhon's cave" }),
  A('ophion_pike', 'village_spear', 88, '#9a5ad8', { element: 'shadow', trail: ['#e6d2ff', '#4a2a8a'], specials: [S.lifesteal(.05), S.execute(.25, 2)] },
    { he: 'רומח אופיון', en: 'Pike of Ophion' },
    { he: 'מוט שחור שנגזר מקרן הנחש הקדמון. מי שהוא פוגע בו שוכח לנשום.', en: 'A black shaft cut from the horn of the primeval serpent. Whoever it strikes forgets to breathe.' },
    { he: 'היער שמתחת לעולם', en: 'The forest under the world' }),
  // dual
  A('harpy_talons', 'hermes_blades', 33, '#8a5ad8', { element: null, trail: ['#f0e0ff', '#8a5ad8'], specials: [S.crit(2.2)] },
    { he: 'טפרי ההרפיה', en: 'Harpy Talons' },
    { he: 'שני פגיונות מעוקלים מטפרי הרפיות ענקיות. קלים כמו נוצה, חדים כמו שמועה.', en: 'Two curved daggers from the talons of the great harpies. Light as a feather, sharp as a rumour.' },
    { he: 'צוקי ההרפיות', en: 'The cliffs of the harpies' }),
  A('moirai_shears', 'medusa_fangs', 46, '#d8d8e8', { element: 'shadow', trail: ['#f0f0ff', '#6a6a88'], specials: [S.execute(.3, 2), S.lifesteal(.04)] },
    { he: 'מספריים של המוירות', en: 'Shears of the Moirai' },
    { he: 'המספריים שחותכים את חוט החיים, לשתי להבים. מי שהחוט שלו כבר דק במיוחד נחתך מיד.', en: 'The shears that cut the thread of life, as two blades. Anyone whose thread is already thin is cut at once.' },
    { he: 'מערת המוירות', en: 'The cave of the Moirai' }),
  A('nyx_daggers', 'erinyes_sickles', 76, '#5a4a8a', { element: 'shadow', trail: ['#d6b8ff', '#2a1a4a'], specials: [S.lifesteal(.05), S.crit(2.3)] },
    { he: 'פגיוני ניקס', en: 'Daggers of Nyx' },
    { he: 'שני להבים שחורים כמו לילה בלי ירח. אין להם צל, כי הם עצמם הצל.', en: 'Two blades black as a moonless night. They cast no shadow, because they are the shadow.' },
    { he: 'ארמון הלילה', en: 'The palace of Night' }),
  A('chaos_twins', 'sun_and_moon', 92, '#ff5ad8', { element: 'holy', trail: ['#fff0f8', '#d84ad8'], specials: [S.burn(.3, 8, 3), S.chill(.3, .4, 2)] },
    { he: 'תאומי הכאוס', en: 'Twins of Chaos' },
    { he: 'שתי חרבות מהריק שלפני העולם: אחת בוערת, אחת קופאת, ושתיהן לא יציבות.', en: 'Two swords from the void before the world: one burns, one freezes, and neither is steady.' },
    { he: 'הריק שלפני הכל', en: 'The void before everything' }),
];
// ---- round 30 (Roy: "sword variety: small, large, huge swords, both two-handed and one per hand; big and impressive is
// good"): nine swords on the ladder (and in the smiths' forges, FORGE below), from a short gladius to a giant's blade
const SWORD_SRC = LN('נפחים, סוחרים ושלל מאויבים', 'Smiths, traders and the spoils of foes');
[
  W('gladius', 'blade', 1, 'common', 5, 12, 1.05, 2.2, .08, null, ['#f0f4f8', '#9aa3b0'], [],
    LN('חרב קצרה', 'Shortsword'), LN('להב קצר ורחב בצורת עלה, עם מגן עגול מעץ. מהיר בתוך הצפיפות, ותמיד ליד.', 'A short, broad leaf-shaped blade with a round wooden guard. Quick in a crush, always at hand.'), SWORD_SRC),
  W('twin_gladii', 'dual', 1, 'common', 6, 7.5, 1.7, 2.0, .12, null, ['#f6e0b0', '#a8702e'], [],
    LN('חרבות קצרות תאומות', 'Twin Shortswords'), LN('שתי חרבות קצרות מארד, אחת לכל יד. מה שאחת מחמיצה, השנייה מוצאת.', 'Two short bronze swords, one for each hand. What one misses, the other finds.'), SWORD_SRC),
  W('rhomphaia', 'twohand', 3, 'rare', 16, 22, .72, 3.1, .08, null, ['#eef2f6', '#76808e'], [S.execute(.25, 1.8)],
    LN('רומפאיה', 'Rhomphaia'), LN('להב ארוך ומעוקל מעט של לוחמי תרקיה, על ידית ארוכה לשתי ידיים. הוא קוצר שורות שלמות.', 'The long, slightly curved blade of the Thracian warriors, on a hilt long enough for two hands. It reaps whole ranks.'), SWORD_SRC),
  W('makhaira', 'blade', 4, 'rare', 22, 15, 1.0, 2.35, .1, null, ['#f0f4f8', '#8a95a6'], [S.crit(2.1)],
    LN('מכאירה', 'Makhaira'), LN('סייף מעוקל עם להב אחד חד, שנחתך מהכתף אל המותן. קל ביד וקטלני בקצה.', 'A curved single-edged sabre that cuts from shoulder to hip. Light in the hand and deadly at the tip.'), SWORD_SRC),
  W('spatha', 'blade', 5, 'rare', 38, 15, .95, 2.6, .07, null, ['#f4f8fc', '#9aa8bc'], [S.stagger(.2, .45)],
    LN('ספאתה ארוכה', 'Long Spatha'), LN('חרב ישרה וארוכה ליד אחת, עם מגן ביד השנייה. מגיעה רחוק יותר מכל קסיפוס.', 'A long, straight one-handed sword, with a shield in the other hand. It reaches further than any xiphos.'), SWORD_SRC),
  W('twin_makhairai', 'dual', 5, 'epic', 42, 8.5, 1.62, 2.2, .13, null, ['#fff0c8', '#c89a3a'], [S.crit(2.2)],
    LN('מכאירות תאומות', 'Twin Makhairai'), LN('שני סייפים מעוקלים עם ניצבי זהב. הם רוקדים יחד, ומה שביניהם לא נשאר שלם.', 'Two curved sabres with golden guards. They dance together, and nothing between them stays whole.'), SWORD_SRC),
  W('flamberge', 'twohand', 5, 'epic', 48, 25, .66, 3.2, .1, 'frost', ['#e8f4ff', '#6aa8e8'], [S.chill(.3, .35, 2.5), S.stagger(.3, .6)],
    LN('שובר הגלים', 'Wavebreaker'), LN('להב גלי ענק לשתי ידיים, מעוצב כמו גל שנשבר. כל מכה מצננת את הדם.', 'A huge wave-edged blade for two hands, shaped like a breaking wave. Every blow chills the blood.'), SWORD_SRC),
  W('broadsword', 'blade', 5, 'epic', 58, 16, .9, 2.55, .06, null, ['#fff4d0', '#d8a838'], [S.stagger(.25, .5), S.execute(.25, 1.8)],
    LN('חרב רחבה של מיקנה', 'Mycenaean Broadsword'), LN('להב רחב וכבד ליד אחת עם ניצב כנפיים מזהב, כמו של המלכים במיקנה. כבד, ולכן כל מכה נוחתת.', 'A broad, heavy one-handed blade with a winged golden guard, like the kings of Mycenae bore. Heavy, so every blow lands.'), SWORD_SRC),
  W('colossus_blade', 'twohand', 5, 'legendary', 85, 30, .6, 3.5, .08, null, ['#ffffff', '#c89a3a'], [S.stagger(.45, .8), S.crit(2.3)],
    LN('להב הקולוסוס', 'Colossus Blade'), LN('חרב ענקית, ארוכה מגובהה של מי שמחזיקה בה, שנחצבה לענק הארד של רודוס. כשהיא נופלת, האדמה רועדת.', "A gigantic sword, longer than the one who wields it, forged for the bronze giant of Rhodes. When it falls, the earth shakes."), SWORD_SRC),
  // ---- the winged sets' weapons (level 150, Heroic only)
  W('fairy_blades', 'dual', 5, 'legendary', 150, 8.5, 1.85, 2.1, .18, 'holy', ['#fff0fa', '#ff8ae0'], [S.mana(6), S.crit(2.4)],
    LN('עוקצי הפיות', 'Fairy Stings'), LN('שני עוקצים דקים של גביש ירוק חיוור, ופרח בכל ניצב. הם פוגעים לפני שרואים אותם.', 'Two slender stings of pale green crystal, a flower at each guard. They strike before they are seen.'), WINGED_SRC),
  W('seraph_blade', 'twohand', 5, 'legendary', 150, 30, .66, 3.4, .12, 'holy', ['#ffffff', '#ffd84a'], [S.execute(.3, 2.2), S.mana(6)],
    LN('חרב המלאכים', 'Angel Greatsword'), LN('חרב ענקית של אור לבן, כנפי זהב לניצב והילה סביבה. היא שורפת את מה שמאחורי הצללים.', 'A huge sword of white light, golden wings for a guard and a halo round it. It burns away what hides in shadow.'), WINGED_SRC),
  W('chaos_twins', 'dual', 5, 'legendary', 150, 9, 1.75, 2.15, .16, 'shadow', ['#ffd0f8', '#ff2ad8'], [S.burn(.3, 8, 3), S.chill(.3, .4, 2), S.lifesteal(.05)],
    LN('תאומי הכאוס', 'Twins of Chaos'), LN('שני להבים משוננים של ריק, בשוליים אש סגולה, ורסיסים של עולם שבור מרחפים לידם. אחד בוער, אחד קופא.', 'Two jagged blades of void rimmed in violet fire, shards of a broken world drifting beside them. One burns, one freezes.'), WINGED_SRC),
  W('devil_trident', 'polearm', 5, 'legendary', 150, 22, .82, 3.8, .1, 'fire', ['#ffd0a0', '#ff2a0a'], [S.burn(.4, 14, 3), S.lifesteal(.06)],
    LN('קלשון השטן', "Devil's Trident"), LN('קלשון שחור מהתהום עם שיניים משוננות ושוליים של אש, וקרניים מתעקלות מהבסיס. כל פצע ממשיך לבעור.', 'A black trident from the abyss, barbed prongs edged in fire and horns curling from the socket. Every wound keeps burning.'), WINGED_SRC),
];
setWeapons();
export const WEAPONS = Object.fromEntries(Object.values(RAWW).map((w) => [w.id, finalizeWeapon(w)]));
// BETA ONLINE (js/online/axe.js): a weapon record added at run time, in online mode only, finalized like every other
// (its level on the ladder, its damage from the shared formula). A model builder of the same id must exist in BUILD.
export function registerWeapon(raw) {
  if (WEAPONS[raw.id]) return WEAPONS[raw.id];
  if (!BUILD[raw.id]) throw new Error('no model for ' + raw.id);
  RAWW[raw.id] = raw; LADDER[raw.id] = raw.minLevel;
  return (WEAPONS[raw.id] = finalizeWeapon(raw));
}
WEAPONS.keres_scythe.gift = WEAPONS.tide_trident.gift = true;
// round 30: the winged sets' pieces are flagged `set` (never on a trader's table, never in an ordinary drop) and legendaryOnly
// (withGrade always makes them Heroic; an old save's plain one is raised, migrateOwned)
const wingedFlags = (T) => { for (const Sd of SET_DEFS) if (Sd.winged) for (const k of SET_SLOTS) for (const v of slotItems(Sd[k])) { const x = T[Array.isArray(v) ? v[0] : v]; if (x) { x.set = Sd.id; x.legendaryOnly = true; } } };
wingedFlags(WEAPONS);

// ---------------------------------------------------------------------------------------------
// Round 28 (Roy): THREE GRADES for everything. Normal is the base id; Epic is `base^e`; Legendary is `base^l`. A graded
// variant is built from its base (damage x GRADES[g].mul, an extra special or two, a brighter trail, the base's own model
// with a glow) and registered in WEAPONS / GEAR (not enumerable: loops over the tables still see only the base items).
// Forged weapons: `f~pattern~level~digit~salt`, digit 0 / 3 / 5 = grade 0 / 1 / 2 (old saves wrote quality 0..5: 0-2 -> normal,
// 3-4 -> epic, 5 -> legendary, and a new id uses the same digits, so nothing ambiguous and nothing to migrate).
// ---------------------------------------------------------------------------------------------
export const GRADE_SUFFIX = ['', '^e', '^l'];
const GRADE_DIGIT = [0, 3, 5], DIGIT_GRADE = [0, 0, 0, 1, 1, 2];
export const isForged = (id) => typeof id === 'string' && id.startsWith('f~');
export const gradeOf = (id) => {
  if (typeof id !== 'string') return 0;
  if (id.startsWith('f~')) return DIGIT_GRADE[+id.split('~')[3]] ?? 0;
  return id.endsWith('^e') ? 1 : id.endsWith('^l') ? 2 : 0;
};
// the grade-0 form of an item: the base id of a named item, the same pattern/level/salt of a forged one
export const baseOf = (id) => (typeof id !== 'string' ? id : id.startsWith('f~') ? withGradeId(id, 0) : id.replace(/\^[el]$/, ''));
export function withGrade(id, g) {
  g = Math.max(0, Math.min(2, g | 0));
  if (typeof id !== 'string') return id;
  if (CATALOG.migrateId) { const m = CATALOG.migrateId(id); if (m) id = m; } // round 33: an old id asks for the item it is now
  let out;
  if (id.startsWith('f~')) { const p = id.split('~'); p[3] = String(GRADE_DIGIT[g]); out = p.join('~'); }
  else { if ((WEAPONS[baseOf(id)] || GEAR[baseOf(id)])?.legendaryOnly) g = 2; out = baseOf(id) + GRADE_SUFFIX[g]; } // (round 30: a winged set's piece is only ever Heroic)
  itemOf(out); // (register it: give() and the Hero constructor only know ids already in the tables)
  return out;
}
// round 30: the five winged sets exist only as Heroic (legendary). Any lower grade of one of their pieces (an old save's dragon
// set, a quest or a cheat handing out a base id) becomes the Heroic piece
// round 33: also where every incoming id (a save, a quest, a give) is migrated to the new catalog (catalog.js migrateId; null = gone)
export const heroicOnly = (id) => { if (CATALOG.migrateId && typeof id === 'string') id = CATALOG.migrateId(id); return typeof id === 'string' && !isForged(id) && gradeOf(id) !== 2 && (WEAPONS[baseOf(id)] || GEAR[baseOf(id)])?.legendaryOnly ? withGrade(id, 2) : id; };
// ...and a save's lists, before the Hero reads them (rpg.js)
export function migrateHeroic(d) {
  if (!d || typeof d !== 'object') return d;
  const L = (a) => (Array.isArray(a) ? [...new Set(a.map(heroicOnly).filter(Boolean))] : a);
  const o = { ...d, weapon: heroicOnly(d.weapon), weapons: L(d.weapons), gearOwned: L(d.gearOwned), newWeapons: L(d.newWeapons), newGear: L(d.newGear) };
  if (d.gear) o.gear = Object.fromEntries(Object.entries(d.gear).map(([k, v]) => [k, heroicOnly(v)]));
  if (d.spare) { o.spare = {}; for (const [k, v] of Object.entries(d.spare)) { const k2 = heroicOnly(k); if (k2) o.spare[k2] = (o.spare[k2] | 0) + (v | 0); } }
  // round 33: two old items that became the same new one: the second is a spare copy (fusion.js)
  for (const key of ['weapons', 'gearOwned']) if (Array.isArray(d[key])) { const seen = new Map(); for (const id of d[key].map(heroicOnly).filter(Boolean)) seen.set(id, (seen.get(id) || 0) + 1); for (const [id, n] of seen) if (n > 1) o.spare = { ...(o.spare || {}), [id]: ((o.spare || {})[id] | 0) + n - 1 }; }
  return o;
}
// the same ITEM whatever its grade (what 3 copies must share to fuse): the base id, or pattern + level for a forged one (salt dropped)
export const itemKey = (id) => (isForged(id) ? id.split('~').slice(1, 3).join('~') : baseOf(id));
export const itemLevel = (d) => (d ? d.ilvl || d.minLevel || 1 : 1);
export function itemOf(id) {
  if (typeof id !== 'string') return null;
  if (!WEAPONS[id] && !GEAR[id] && CATALOG.resolve) { const c = CATALOG.resolve(id); if (c) return c; }
  return forgedWeapon(id) || GEAR[id] || (/\^[el]$/.test(id) && GEAR[baseOf(id)] ? gearVariant(GEAR[baseOf(id)], gradeOf(id)) : null) || null;
}

// ---- hebrew grade words follow the noun and its gender (0 masc, 1 fem, 2 plural)
const HE_GRADE = [null, ['אפי', 'אפית', 'אפיים'], ['אגדי', 'אגדית', 'אגדיים']]; // round 33: NORMAL / EPIC / LEGENDARY (were Masterwork / Heroic)
const heGender = (he) => (/^(כנפי|סנדלי|מגפי|מגני|פגיונ|חרבות|גרזיני|להבי|ניבי|טפרי|תאומי|מספריים|זוג|עוקצי|מכאירות|נעלי|סהרוני)/.test(he) ? 2 : /^(קסדה|קסדת|חנית|אלת|הארפה|פלטה|חרב(\s|$)|חרבו|חרב־|חרבת|כובע?ת|שמלת|מכאירה|מכאירת|ספאת|רומפאי|עין)/.test(he) ? 1 : 0); // (round 30: \b never matched after a Hebrew letter)
const gradeName = (name, g, gender = heGender(name.he)) => (g ? { he: `${name.he} ${HE_GRADE[g][gender]}`, en: `${GRADES[g].en} ${name.en}` } : name);
function mixHex(a, b, k) { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const f = (s) => Math.round((x >> s & 255) * (1 - k) + (y >> s & 255) * k); return '#' + ((1 << 24) | f(16) << 16 | f(8) << 8 | f(0)).toString(16).slice(1); } // (a declaration: the round 30 set pass uses it before this line runs)

// ---- the extra specials of the higher grades: first the element's own, then what suits the style
const EL_EXTRA = { fire: 'burn', frost: 'chill', lightning: 'chain', poison: 'poison', shadow: 'lifesteal', holy: 'mana' };
const STYLE_EXTRA = { blade: ['crit', 'stagger', 'execute'], spear: ['stagger', 'chill', 'execute'], twohand: ['stagger', 'execute', 'crit'], polearm: ['execute', 'chain', 'stagger'], dual: ['crit', 'poison', 'burn'] };
function mkSpecial(type, w) {
  const d = w.dmg * w.speed;
  switch (type) {
    case 'burn': return S.burn(.3, Math.max(2, Math.round(d * .28)), 3);
    case 'chill': return S.chill(.3, .35, 2.5);
    case 'chain': return S.chain(.3, 3, 5, .5);
    case 'poison': return S.poison(.3, Math.max(2, Math.round(d * .25)), 4, 3);
    case 'lifesteal': return S.lifesteal(.05);
    case 'stagger': return S.stagger(.25, .5);
    case 'crit': return S.crit(2.2);
    case 'execute': return S.execute(.25, 1.8);
    case 'mana': return S.mana(3 + Math.floor(itemLevel(w) / 15));
  }
  return null;
}
function extraSpecials(w, have, n) {
  const got = new Set(have.map((s) => s.type)), out = [];
  for (const t of [EL_EXTRA[w.element], ...(STYLE_EXTRA[w.style] || []), 'lifesteal', 'stagger', 'crit']) {
    if (out.length >= n) break;
    if (t && !got.has(t)) { out.push(mkSpecial(t, w)); got.add(t); }
  }
  return out;
}
// the trail of a higher grade: brighter, with the element's glow (epic) or gold (legendary)
const gradeTrail = (w, g) => (g === 1 ? [mixHex(w.trail[0], '#ffffff', .25), w.element ? ELEMENTS[w.element].color : mixHex(w.trail[1], '#b46cff', .5)]
  : [mixHex(w.trail[0], '#ffffff', .5), w.element ? mixHex(ELEMENTS[w.element].color, '#ffd24a', .35) : '#ffb22e']);
function weaponVariant(B, g) {
  const G = GRADES[g], id = B.id + GRADE_SUFFIX[g];
  const dmg = Math.round(B.dmg * G.mul * 10) / 10;
  const w0 = { ...B, dmg };
  const specials = [...scaleSp(B.specials, G.mul), ...extraSpecials(w0, B.specials, G.specials)];
  const w = { ...w0, id, base: B.base || B.id, grade: g, rarity: G.rarity, name: gradeName(B.name, g), trail: gradeTrail(B, g), dps: Math.round(dmg * B.speed * 10) / 10, specials, special: specials[0] || null };
  w.cleave = cleaveFor(w);
  Object.defineProperty(WEAPONS, id, { value: w, enumerable: false, configurable: true, writable: true });
  return w;
}
for (const id of Object.keys(WEAPONS)) for (const g of [1, 2]) weaponVariant(WEAPONS[id], g);
export const WEAPON_ORDER = Object.keys(WEAPONS);

// ---- forged weapons: the familiar patterns, found out in the world at any level 1..100
// A monster may drop a weapon made at its own level: one of the plain patterns below. Normal grade by chance; Epic and Legendary
// only when the caller asks for them (rollWeapon's opts.grade: bosses and quests). The id carries everything
// (f~pattern~level~digit~salt), so a save needs nothing new and the weapon rebuilds itself on load.
// QUALITY is the old name of the grade table (kept so older call sites read QUALITY[w.quality].mul): w.quality is the grade now.
export const QUALITY = GRADES.map((G, i) => ({ mul: G.mul, rarity: G.rarity, he: HE_GRADE[i] || ['', '', ''], en: G.en }));
// pattern -> Hebrew gender of its name (0 masculine, 1 feminine, 2 plural)
const FORGE = { bronze_kopis: 0, olive_club: 1, hoplite_dory: 1, harbor_daggers: 2, minoan_labrys: 0, cyclops_maul: 0, amazon_sagaris: 2, village_spear: 1 };
// round 30 (Roy: "sword variety"): the swords are forged too, from the short gladius to the colossus blade (each from its own level)
Object.assign(FORGE, { gladius: 1, twin_gladii: 2, makhaira: 1, rhomphaia: 1, spatha: 1, twin_makhairai: 2, flamberge: 0, broadsword: 1, colossus_blade: 0 });
// patterns that are only ever given, at V's level, never dropped. They come Epic (digit 3): the scythe and the trident are
// worth a little over Philon's sword carried to the same level (x1.4 Epic, less the GIFT_MUL below)
const GIFTS = { keres_scythe: 0, tide_trident: 0 };
const GIFT_MUL = .88;
export function forgedWeapon(id) {
  if (typeof id !== 'string') return null;
  if (WEAPONS[id]) return WEAPONS[id];
  if (CATALOG.resolve && /^(set|sa)_/.test(id)) { const c = CATALOG.resolve(id); return c && c.style ? c : null; } // round 33: a catalog weapon
  if (!isForged(id)) {
    const m = /^(.+)\^([el])$/.exec(id);
    return m && WEAPONS[m[1]] ? weaponVariant(WEAPONS[m[1]], m[2] === 'e' ? 1 : 2) : null;
  }
  const [, base, lv, qq] = id.split('~'), B = WEAPONS[base], g = DIGIT_GRADE[+qq], lvl = Math.max(1, Math.min(MAX_LEVEL, Math.round(+lv) || 1));
  if (!B || g == null || !(base in FORGE || base in GIFTS)) return null;
  const G = GRADES[g], gift = base in GIFTS;
  const dmg = Math.max(3, weaponDmg(lvl, B.style, B.speed, G.mul * (gift ? GIFT_MUL : 1)));
  const w0 = { ...B, dmg, ilvl: lvl };
  const specials = g ? [...scaleSp(B.specials, dmg / B.dmg), ...extraSpecials(w0, B.specials, G.specials)] : [];
  const w = {
    ...B, id, base: B.base || base, baseId: withGradeId(id, 0), forged: true, grade: g, quality: g, ilvl: lvl, minLevel: lvl, rarity: G.rarity, tier: tierOf(lvl),
    dmg, dps: Math.round(dmg * B.speed * 10) / 10, crit: +(B.crit + (g ? .02 * g : 0)).toFixed(2), trail: g ? gradeTrail(B, g) : B.trail,
    specials, special: specials[0] || null,
    name: gift ? gradeName(B.name, 0) : gradeName(B.name, g, FORGE[base]),
    source: gift ? B.source : { he: `נמצא בשטח, נשק של רמה ${lvl}`, en: `Found in the wild, a level ${lvl} weapon` },
  };
  w.cleave = cleaveFor(w);
  Object.defineProperty(WEAPONS, id, { value: w, enumerable: false, configurable: true, writable: true });
  return w;
}
const withGradeId = (id, g) => { const p = id.split('~'); p[3] = String(GRADE_DIGIT[g]); return p.join('~'); };
// a weapon for a monster of level lvl: stronger monsters drop better patterns. Normal grade unless opts.grade (0|1|2) says otherwise
// (the DROPS rules: Epic / Legendary only from bosses and quests). elite nudges the level up by one.
export function rollWeapon(lvl, rnd = Math.random, elite = false, opts = {}) {
  if (CATALOG.rollItem) { const id = CATALOG.rollItem(lvl + (elite ? 1 : 0) + Math.round((rnd() - .5) * 2), rnd, { kind: 'weapon', grade: Math.max(0, Math.min(2, opts.grade | 0)) }); if (id) return id; } // round 33: the catalog's weapons
  const pool = Object.keys(FORGE).filter((b) => WEAPONS[b].minLevel <= lvl + 2);
  const base = pool[Math.floor(rnd() * pool.length)];
  const g = Math.max(0, Math.min(2, opts.grade | 0));
  const at = Math.max(1, Math.min(MAX_LEVEL, Math.round(lvl + (elite ? 1 : 0) + (rnd() - .5) * 2)));
  const id = `f~${base}~${at}~${GRADE_DIGIT[g]}~${Math.floor(rnd() * 1e4).toString(36)}`;
  forgedWeapon(id);
  return id;
}


// ---- round 30 (Roy: "legendary weapons, especially high level ones, should have swing trails in other colours that look more
// interesting"). What a weapon's swing draws (fx.js CombatFx.trail): null is the plain cyan arc of every normal weapon.
// Epic: the arc in the weapon's own colours. Legendary: its own colours glowing (additive), a wide soft aura round the arc and
// motes thrown off the blade; the more levels the weapon has the more motes, the longer and wider the arc, and from level 100
// a second, wider echo arc behind it. The five winged sets each have their own swing.
const SET_SWING = {
  fairy: { wide: '#ff8ae0', edge: '#f0fff8', aura: '#5affc0', motes: { colors: ['#ffc8f4', '#b8ffe0', '#fff6a0'], rise: .6, size: .22, spread: 1.6 }, echo: '#7affd0' },
  angel: { wide: '#ffd860', edge: '#ffffff', aura: '#fff2c0', motes: { colors: ['#fff4c0', '#ffffff', '#ffe080'], rise: -.8, size: .3, spread: .8 }, echo: '#fff8e0' },
  chaos: { wide: '#7a1aff', edge: '#ff4ad8', aura: '#4a0aa8', flick: ['#ff4ad8', '#40e8ff', '#ffffff'], motes: { colors: ['#ff4ad8', '#9a4aff', '#40e8ff'], rise: 0, size: .26, spread: 2.4, jitter: 1 }, echo: '#40e8ff' },
  devil: { wide: '#ff2a0a', edge: '#ffd040', aura: '#a00a00', motes: { colors: ['#ffb030', '#ff5010', '#ffe080'], rise: 3.2, size: .2, spread: 1.2 }, echo: '#ff6a10' },
  dragon: { wide: '#ff5a1a', edge: '#fff0a0', aura: '#6a1aa8', motes: { colors: ['#ff8a2a', '#ffd060', '#b05aff'], rise: 2.2, size: .24, spread: 1.4 }, echo: '#b05aff' },
};
export function swingLook(w) {
  if (!w || !w.grade) return null;
  const B = WEAPONS[w.base || w.id] || w, tr = B.trail || ['#ffffff', '#7ff0e2'], el = w.element && ELEMENTS[w.element].color;
  if (w.grade === 1) return { wide: w.trail?.[1] || el || tr[1], edge: mixHex(w.trail?.[0] || tr[0], '#ffffff', .4) }; // (an Epic's own trail: its element, or violet)
  const lv = itemLevel(w), up = Math.min(1, Math.max(0, (lv - 20) / 130)); // 0 at level 20 .. 1 at 150 and over
  const S = SET_SWING[w.suit] || {
    wide: el || mixHex('#ffb22e', tr[1], .2), edge: mixHex(tr[0], '#ffffff', .5), aura: el ? mixHex(el, '#ffffff', .3) : '#ffd24a', // (no element: molten gold)
    motes: { colors: [mixHex(tr[0], '#ffffff', .4), el || '#ffd24a', '#ffe8a0'], rise: w.element === 'fire' ? 2.4 : w.element === 'frost' ? -.6 : .8, size: .2, spread: 1.2, jitter: w.element === 'lightning' ? 1 : 0 },
    echo: lv >= 100 ? mixHex(el || '#ffd24a', '#ffffff', .2) : null,
  };
  return { ...S, add: true, n: Math.round(3 + up * 9 + (SET_SWING[w.suit] ? 4 : 0)), scale: 1 + up * .18, life: 1.15 + up * .35, echo: lv >= 100 || SET_SWING[w.suit] ? S.echo : null };
}
// ---------------------------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------------------------
const I = (id, kind, color, name, desc, extra) => ({ id, kind, color, name, desc, stack: kind === 'potion' || kind === 'trophy', ...extra });
export const ITEMS = Object.fromEntries([
  I('potion_hp', 'potion', '#d42a36', { he: 'שיקוי ריפוי', en: 'Healing Draught' },
    { he: 'יין אדום ממקדש אסקלפיוס, סמיך מעשבים. משיב 40% מהחיים.', en: "Red wine from Asclepius' temple, thick with herbs. Restores 40% of your health." }, { restore: { hp: .4 } }),
  I('potion_mp', 'potion', '#2f6dff', { he: 'צוף האלים', en: 'Nectar' },
    { he: 'לגימה ממשקה האלים. משיבה 50% מהמאנה.', en: 'A sip of the drink of the gods. Restores 50% of your mana.' }, { restore: { mp: .5 } }),
  // Roy 29.10: "add an item called exp potion: drinking it gives double EXP for half an hour" (a yellow test tube). Never in a
  // monster's, a cave's or a boss's drops, the random rolls or a shop (those lists name their potions one by one; noSell keeps
  // it off the sell list): a reward of the high-level quests later (reward.items [['exp_potion', 1]]), /drop until then.
  // The rules (how long, stacking, real time, the server's side): js/exppotion.js
  I('exp_potion', 'potion', '#ffd23a', { he: 'שיקוי ניסיון', en: 'EXP Potion' },
    { he: 'מבחנה צרה של אור צהוב, נוזל שזוכר כל קרב. לגימה אחת: ניסיון כפול ל-30 דקות.', en: 'A narrow vial of yellow light, a draught that remembers every fight. One sip: double EXP for 30 minutes.' }, { rarity: 'rare', noSell: true, expBoost: { mult: 2, secs: 1800 } }),
  I('moly_herb', 'quest', '#f4f2ea', { he: 'עשב מולי', en: 'Moly Herb' },
    { he: 'שורש שחור ופרח לבן כחלב. הרמס נתן אותו לאודיסאוס נגד כשפי קירקה.', en: "Black root, milk-white flower. Hermes gave it to Odysseus against Circe's spells." }),
  I('lost_amphora', 'quest', '#c46a34', { he: 'האמפורה האבודה', en: 'Lost Amphora' },
    { he: 'כד יין מצויר בסאטירים רוקדים. מישהו בכפר מחפש אותו.', en: 'A wine jar painted with dancing satyrs. Someone in the village is missing it.' }),
  I('bronze_key', 'key', '#c08436', { he: 'מפתח ארד', en: 'Bronze Key' },
    { he: 'כבד, וירוק מרוב שנים. הוא פותח משהו עתיק.', en: 'Heavy and green with age. It opens something old.' }),
  I('wolf_pelt', 'trophy', '#8a8a92', { he: 'פרוות זאב', en: 'Wolf Pelt' },
    { he: 'פרווה אפורה ועבה מזאבי הגבעות. הבורסקאי משלם טוב.', en: 'Thick grey fur from the hill wolves. The tanner pays well.' }),
  I('harpy_feather', 'trophy', '#7a5ab0', { he: 'נוצת הרפיה', en: 'Harpy Feather' },
    { he: 'קצה של ארד וריח של סערה.', en: 'Bronze-tipped, and it smells of storms.' }),
  I('olive_branch', 'quest', '#7f9a44', { he: 'ענף זית', en: 'Olive Branch' },
    { he: 'העץ של אתנה. הושיטי אותו, ואפילו אויבים עשויים להקשיב.', en: "Athena's tree. Offer it, and even enemies may listen." }),
  I('sealed_letter', 'quest', '#b81e28', { he: 'מכתב חתום', en: 'Sealed Letter' },
    { he: 'שעווה אדומה וחותם שאינך מכירה. לא שלך לפתוח... עדיין.', en: 'Red wax and a seal you do not know. Not yours to open... yet.' }),
  I('fishing_net', 'quest', '#a08a5a', { he: 'רשת דייגים', en: 'Fishing Net' },
    { he: 'נקרעה בידי משהו עם יותר מדי שיניים.', en: 'Torn by something with too many teeth.' }),
  I('honey_jar', 'quest', '#ffb52e', { he: 'צנצנת דבש', en: 'Honey Jar' },
    { he: 'דבש קורנית מהר הימטוס. דובים, דבורים ומשוררים, כולם רוצים אותו.', en: 'Thyme honey from Mount Hymettus. Bears, bees and bards all want it.' }),
  I('lyre_string', 'quest', '#ffd24a', { he: 'מיתר הלירה', en: 'Lyre String' },
    { he: 'מיתר מהלירה של אורפאוס. הוא מזמזם מעצמו כשהמתים קרובים.', en: "A string from Orpheus' lyre. It hums by itself when the dead are near." }),
  I('broken_statuette', 'quest', '#e8e2d6', { he: 'פסלון שבור', en: 'Broken Statuette' },
    { he: 'דמות שיש בלי ראש, כמו הפסלים חסרי הפנים של אתנה.', en: "A marble figure with no head, like Athena's faceless statues." }),
  I('sacred_lamp', 'quest', '#ff9a2a', { he: 'מנורת הלהבה הקדושה', en: 'Lamp of the Sacred Flame' },
    { he: 'הודלקה מהאח של הסטיה. אסור לה לכבות.', en: "Lit from Hestia's hearth. It must not go out." }),
  I('fleece_thread', 'quest', '#ffc83a', { he: 'חוט מגיזת הזהב', en: 'Golden Fleece Thread' },
    { he: 'חוט יחיד מגיזת הזהב, חמים כמו קיר בשמש.', en: 'A single thread of the Golden Fleece, warm as a sunlit wall.' }),
  I('shepherd_flute', 'quest', '#d8b870', { he: 'חליל הרועים', en: "Shepherd's Pipes" },
    { he: 'חליל הקנים של פאן. כשמנגנים בו, העדרים באים בריצה.', en: "Pan's reed pipes. When they play, the flocks come running." }),
  I('charon_obol', 'key', '#9fe8c8', { he: 'האובול של כארון', en: "Charon's Obol" },
    { he: 'המטבע שמכיר את המתים. המשיט אינו מקבל שום מטבע אחר.', en: 'The coin that knows the dead. The ferryman takes no other.' }),
  I('fate_thread', 'quest', '#e8f0ff', { he: 'חוט הגורל', en: 'Thread of Fate' },
    { he: 'טווי בידי המוירות. הוא מושך בעדינות אל מה שנקרע.', en: 'Spun by the Moirai. It tugs gently toward what was torn.' }),
  I('gaze_stone', 'quest', '#3ac06a', { he: 'אבן המבט הראשון', en: 'Stone of the First Gaze' },
    { he: 'אבן שאינה הופכת אדם לפסל. רק מדוזה יכלה לתת אותה.', en: 'A stone that does not turn people to stone. Only Medusa could give it.' }),
  I('rain_ring', 'quest', '#34d1bf', { he: 'הטבעת של Roye', en: "Roye's Ring" },
    { he: 'הטבעת שהחליקה מידו בלילה שבו נלקח.', en: 'The ring that slipped from his hand the night he was taken.' }),
  I('golden_apple', 'trophy', '#f2c040', { he: 'תפוח הזהב', en: 'Golden Apple' },
    { he: 'מגני ההספרידות. כבד יותר ממה שהוא נראה.', en: 'From the garden of the Hesperides. Heavier than it looks.' }),
  I('boar_tusk', 'trophy', '#efe6cc', { he: 'ניב חזיר בר', en: 'Boar Tusk' },
    { he: 'מעוקל כמו מגל. הוכחה שלא ברחת.', en: 'Curved like a sickle. Proof that you did not run.' }),
  I('serpent_scale', 'trophy', '#2fae7a', { he: 'קשקש נחש ים', en: 'Serpent Scale' },
    { he: 'מנצנץ בירוק וזהב. נחשי הים משילים אותם כשהם גדלים.', en: 'It shimmers green and gold. Sea serpents shed them as they grow.' }),
  I('minotaur_horn', 'trophy', '#e8dcc0', { he: 'קרן המינוטאור', en: "Minotaur's Horn" },
    { he: 'נשברה משומר המבוך. עדיין נודף ממנה ריח של מבוך.', en: 'Broken from the guardian of the Labyrinth. It still smells of the maze.' }),
  // side-quest errands
  I('garum_jar', 'quest', '#b8532e', { he: 'צנצנת גרום', en: 'Jar of Garum' },
    { he: 'רוטב דגים מותסס. ריח של נמל ביום חם, והטבחים משוגעים עליו.', en: 'Fermented fish sauce. Smells like a harbour on a hot day. Chefs are obsessed.' }),
  I('rose_oil', 'quest', '#e86a9a', { he: 'שמן ורדים', en: 'Rose Oil' },
    { he: 'בושם מאפידאורוס. טיפה אחת, וכל השוק מסתובב.', en: 'Perfume from Epidauros. One drop and the whole market turns around.' }),
  I('spring_water', 'quest', '#7fd0ff', { he: 'מים ממעיין קדוש', en: 'Sacred Spring Water' },
    { he: 'צלולים וקרים. המרפאים נשבעים שהם עושים פלאים. על צמא, לפחות, זה עובד.', en: 'Clear and cold. The healers swear by it. Works great on thirst, at least.' }),
  I('mastic_resin', 'quest', '#e8e0a0', { he: 'שרף מסטיק', en: 'Mastic Resin' },
    { he: 'דמעות של עץ מכיוס. לועסים את זה. כן, באמת.', en: 'Tears of a Chios tree. People chew it. Yes, really.' }),
  I('wine_skin', 'quest', '#8a2a4a', { he: 'נאד יין', en: 'Wineskin' },
    { he: 'נשאר מהמסיבה של דיוניסוס. איכשהו עדיין מלא.', en: "Left over from Dionysus' party. Somehow still full." }),
  // what the hunt brings home; the armourers buy it all
  I('wool', 'trophy', '#f2eee4', { he: 'צמר', en: 'Wool' }, { he: 'צרור צמר רך מכבשה. האורגות בכל עיר ישמחו.', en: 'A soft bundle of fleece. The weavers in every town will be glad of it.' }),
  I('goat_horn', 'trophy', '#d8c8a8', { he: 'קרן עז', en: 'Goat Horn' }, { he: 'קרן מעוקלת ומחוספסת. עושים ממנה ידיות וחצוצרות.', en: 'A rough, curling horn. Made into hilts and trumpets.' }),
  I('deer_hide', 'trophy', '#a8763e', { he: 'עור צבי', en: 'Deer Hide' }, { he: 'עור דק וחזק. הסנדלרים משלמים עליו טוב.', en: 'Thin, strong leather. Sandal-makers pay well for it.' }),
  I('raw_meat', 'trophy', '#c0484a', { he: 'בשר טרי', en: 'Fresh Meat' }, { he: 'נתח בשר לצלייה. כל פונדק יקנה.', en: 'A cut for the spit. Any tavern will buy it.' }),
  I('canned_meat', 'quest', '#b8b0a0', { he: 'בשר משומר', en: 'Canned Meat' }, { he: 'קופסת פח עם בשר. Roye תמיד אמר לקחת אחת ליתר ביטחון.', en: 'A tin of meat. Roye always said to take one just in case.' }),
  // money and treasure: drachmas buy from priests and armourers; relics are what the travelling traders want
  I('drachma', 'coin', '#e8c050', { he: 'דרכמות', en: 'Drachmas' },
    { he: 'מטבעות כסף עם ינשוף של אתנה. הכוהנים והנפחים בכל עיר מקבלים אותם.', en: "Silver coins stamped with Athena's owl. Priests and armourers in every town take them." }, { stack: true }),
  // read in the satchel: a map marks a cave with a sure reward; a scroll tells something of what is coming
  I('treasure_map', 'map', '#d8b878', { he: 'מפת אוצר', en: 'Treasure Map' },
    { he: 'קלף מקומט עם סימן דיו ליד מערה. פתחי אותו בתיק כדי לגלות איפה.', en: 'A creased parchment with an ink mark by a cave. Only whoever opens it in the satchel will know where.' }, { usable: true }),
  I('lore_scroll', 'scroll', '#e8dcb8', { he: 'מגילה עתיקה', en: 'Ancient Scroll' },
    { he: 'מגילה חתומה בשעווה. מישהו כתב כאן משהו שחשוב לזכור.', en: 'A scroll sealed in wax. Someone wrote down something worth remembering.' }, { usable: true }),
  I('relic', 'relic', '#7af0dc', { he: 'שריד עתיק', en: 'Ancient Relic' },
    { he: 'חפץ מעידן הגיבורים, זוהר מבפנים. הסוחרים הנודדים מחליפים עליו כמעט כל דבר.', en: 'A thing from the age of heroes, glowing from within. The travelling traders will swap almost anything for one.' }, { stack: true }),
].map((it) => [it.id, it]));

// ---------------------------------------------------------------------------------------------
// SKILLS: 14 skills. mana, cd (s), needs ('shield' | 'twohand' | 'dual' | null), anim (rig pose id),
// dur (s the cast takes), source (where it is learned); the other numbers are read by skills.js.
// power is a multiplier of a hit with the weapon in hand (skillBase in rpg.js: its damage at its pace, times its quality),
// so level, weapon, rarity and crits all count.
// ---------------------------------------------------------------------------------------------
export const NEEDS = { shield: ['blade', 'spear'], twohand: ['twohand', 'polearm'], dual: ['dual'], light: ['blade', 'spear', 'dual'], sword: ['blade'], reach: ['spear', 'polearm'] };
export const NEEDS_TEXT = {
  shield: { he: 'הכישור הזה דורש מגן: חרב או חנית עם מגן', en: 'This skill needs a shield: a sword or spear with a shield' },
  twohand: { he: 'הכישור הזה דורש נשק דו־ידני', en: 'This skill needs a two-handed weapon' },
  dual: { he: 'הכישור הזה דורש זוג להבים', en: 'This skill needs a pair of blades' },
  light: { he: 'הכישור הזה דורש נשק קל: חרב, חנית או להבים כפולים', en: 'This skill needs a light weapon: a sword, a spear or dual blades' },
  sword: { he: 'הכישור הזה דורש חרב ומגן', en: 'This skill needs a sword and shield' },
  reach: { he: 'הכישור הזה דורש חנית או רומח', en: 'This skill needs a spear or a polearm' },
};
// can a skill (object or id) be used with a weapon style?
// hero (optional, round 23): with it, a skill that needs a shield needs one actually on her arm (hasShield)
export function meetsNeeds(skill, style, hero) {
  const s = typeof skill === 'string' ? SKILLS[skill] : skill;
  if (s?.needs === 'shield' && hero) return hasShield(hero);
  return !s || !s.needs || (NEEDS[s.needs] || [s.needs]).includes(style);
}
// Round 23 (Roy: "in the weapon shop she buys the shield too, besides the sword"): a shield is an item of its own (GEAR slot
// 'shield'). She has one up when her weapon is one-handed (a sword or a spear) and a shield is worn. A save from before the
// slot existed (no 'shield' key in hero.gear at all) still counts the shield its weapon came with, as it always did.
export function hasShield(hero) {
  if (hero && CATALOG.shieldAllowed && hero.gear && 'shield' in hero.gear) return !!hero.gear.shield && !CATALOG.offKind?.(hero.gear.shield) && CATALOG.shieldAllowed(hero.weapon, hero.level || 1); // (offKind, online jobs only: arrows, a charm or a focus is no shield) // round 33: the hands rule (catalog.js), two-handed mastery included
  const w = hero && forgedWeapon(hero.weapon); if (!w || (w.style !== 'blade' && w.style !== 'spear')) return false;
  return hero.gear && 'shield' in hero.gear ? !!hero.gear.shield : !!w.shield;
}
// the shield item a weapon used to come with (the old saves' migration, rpg.js): her own, Poseidon's scallop, else the aspis
export const shieldItemOf = (weaponId) => { const k = forgedWeapon(weaponId)?.shield; return k === 'crescent' ? 'shield_crescent' : k === 'shell' ? 'shield_shell' : k ? 'shield_round' : null; };
const K = (id, color, bg, mana, cd, needs, anim, dur, unlock, name, desc, source, extra) => ({ id, color, bg, mana, cd, needs, anim, dur, unlock, name, desc, source, ...extra });
// Roy 30.10: "lower every skill's cooldown that isn't an ULTIMATE by 20%". Every skill's `cd` is kept as written
// (the tables, the jobs' tiers and masteries all set it as before) and read 20% shorter, unless the skill is an ultimate.
// The table watches what is put in it, so a skill added later (the paths, the jobs, the mount) is read the same way.
export const CD_MUL = .8;
const cdShort = (s) => {
  if (!s || typeof s !== 'object' || Object.getOwnPropertyDescriptor(s, 'cd')?.get) return s;
  let base = s.cd;
  Object.defineProperty(s, 'cd', { get() { return base == null || this.ult ? base : base * CD_MUL; }, set(v) { base = v; }, enumerable: true, configurable: true });
  return s;
};
const skillTable = (t) => { for (const k of Object.keys(t)) cdShort(t[k]); return new Proxy(t, { set(o, k, v) { o[k] = cdShort(v); return true; } }); };
export const SKILLS = skillTable(Object.fromEntries([
  K('dash', '#7fd8ff', '#1e3a5a', 12, 5, 'light', 'dash', .4, 3,
    { he: 'הצעד של הרמס', en: "Hermes' Stride" },
    { he: 'זינוק של 7 מטרים על עקבים מכונפים, פוגע בכל מי שבדרך.', en: 'Dash 7 m on winged heels, striking everything in your path.' },
    { he: 'מקדש הדרכים של הרמס', en: "Hermes' crossroads shrine" },
    { power: 1.5, range: 7, width: 1.5 }),
  K('whirl', '#ff5a3a', '#4a1a14', 20, 8, null, 'whirl', 1.5, 3,
    { he: 'הסופה של ארס', en: 'Cyclone of Ares' },
    { he: 'סופת להבים: שלושה סיבובים וחמש מכות סביבך בכל הכיוונים.', en: 'A storm of steel: three turns and five hits all around you.' },
    { he: 'פילון מלמד אותך', en: 'Taught by Philon' },
    { power: .62, hits: 5, radius: 3.3, move: .75 }),
  K('fate', '#9aa4b8', '#56607a', 25, 25, null, 'cast', .7, 4, // round 17: Roy found the old slow too weak; the id stays 'fate' so saves keep it
    { he: 'להב אטרופוס', en: "Atropos' Edge" },
    { he: 'חוט הגורל נכרך סביב הנשק וצובע אותו בשחור פחמן זוהר: במשך 7 שניות המכות שלך חזקות ב־50%.', en: 'The thread of fate winds round your weapon and turns it to glowing carbon black: for 7s your blows land 50% harder.' },
    { he: 'מתנה מאטרופוס', en: 'A gift from Atropos' },
    { boost: .5, time: 7, buff: true }),
  K('heal', '#6ee07a', '#123a1c', 30, 20, null, 'cast', .8, 6,
    { he: 'ריפוי קדוש', en: 'Holy Heal' },
    { he: 'עמוד אור ירוק ואנח זוהר: משיבים 35% מהחיים במשך 2.5 שניות.', en: 'A pillar of green light and a glowing ankh restore 35% of your health over 2.5s.' },
    { he: 'המרפא של אסקלפיוס', en: "Asclepius' healer" },
    { heal: .35, time: 2.5 }),
  K('quake', '#e0603a', '#4a1410', 30, 12, 'twohand', 'smash', .85, 10,
    { he: 'חבטת גרזן', en: 'Axe Smash' },
    { he: 'מכה מלמעלה בשתי ידיים שמבקיעה את האדמה: נזק כבד מלפנים וגל הלם שמפיל את מי שסביב. דורש נשק דו־ידני.', en: 'An overhead two-handed slam that splits the ground: a heavy blow in front and a shockwave that knocks down everyone around. Needs a two-handed weapon.' },
    { he: 'נפח בכפר שלמרגלות ההר', en: 'A blacksmith at the foot of the mountain' },
    { power: 2.4, reach: 1.7, radius: 2.2, wave: 5, wavePower: 1.1, stun: .8 }),
  K('thunder', '#ffe866', '#1a2a6a', 40, 18, 'reach', 'cast', .9, 22,
    { he: 'קריאת ברק', en: 'Lightning Call' },
    { he: 'קוראת לברקים של זאוס: עד חמישה אויבים בטווח 9 מטרים נפגעים ומהוממים לרגע.', en: "Call down Zeus' lightning on up to five foes within 9 m, stunning them for a moment." },
    { he: 'דיון, שלמרגלות האולימפוס', en: 'Dion, at the foot of Olympus' },
    { power: 2.5, targets: 5, radius: 9, stun: .5 }),
  K('gaze', '#8fe05a', '#16301a', 45, 24, null, 'gaze', .7, 12,
    { he: 'מבט הנחש', en: "Serpent's Gaze" },
    { he: 'המבט שמדוזה לימדה אותך: מאבן את האויבים בחרוט שלפנייך למשך 3.5 שניות. בוסים רק מואטים.', en: 'The gaze Medusa taught you: turns foes in a cone ahead to stone for 3.5s. Bosses are only slowed.' },
    { he: 'מדוזה מלמדת אותך', en: 'Taught by Medusa' },
    { range: 8, cone: PI / 3, time: 3.5 }),
  K('fireball', '#ff7a2a', '#4a120c', 22, 6, 'sword', 'fireball', .55, 9,
    { he: 'כדור אש קטלני', en: 'Deadly Fireball' },
    { he: 'כדור אש שנזרק קדימה ומתפוצץ ברדיוס 3 מטרים, ומשאיר את האויבים בוערים.', en: 'Hurl a ball of fire that explodes in a 3 m blast and leaves foes burning.' },
    { he: 'הנפחייה של הפייסטוס', en: "Hephaestus' forge" },
    { power: 2.2, range: 16, speed: 18, radius: 3, burn: 7, time: 4 }),
  K('flurry', '#e8f0ff', '#2a2430', 20, 9, 'dual', 'flurry', .9, 11,
    { he: 'רצף דקירות', en: 'Dagger Flurry' },
    { he: 'שש דקירות מהירות בזינוק של 3 מטרים, עם בבואות שנשארות מאחור. דורש זוג להבים.', en: 'Six lightning-fast thrusts while lunging 3 m, leaving after-images behind. Needs a pair of blades.' },
    { he: 'המחנה של האמזונות', en: 'The Amazon camp' },
    { power: .65, hits: 6, lunge: 3, reach: 2.2 }),
  K('fog', '#9a8ac8', '#1a1630', 30, 22, null, 'fog', .7, 8,
    { he: 'ערפל אפל', en: 'Dark Fog' },
    { he: 'ענן עשן אפל ברדיוס 5 מטרים למשך 6 שניות: האויבים בתוכו מאבדים אותך, מואטים ומחטיאים, והמכות שלך מתוכו קטלניות יותר.', en: 'A cloud of dark smoke, 5 m wide, for 6s: foes inside lose track of you, slow down and miss, and your strikes from within crit more.' },
    { he: 'הכוהנים במקדשים', en: 'The temple priests' },
    { radius: 5, time: 6, slow: .35, crit: .25 }),
  K('wave', '#4ab8ff', '#0e2a4a', 35, 14, 'reach', 'wave', .8, 19,
    { he: 'גל מים', en: 'Water Wave' },
    { he: 'גל גבוה של פוסידון מתרומם לפנייך, מתגלגל 8 מטרים קדימה וסוחף איתו את האויבים: נזק, הדיפה חזקה וצינה שמאטה, ואז מתנפץ בקצף.', en: "A tall wave of Poseidon rises before you and rolls 8 m ahead, sweeping foes along: damage, a hard knockback and a chill that slows, then it breaks in foam." },
    { he: 'פוסידון, בממלכה שמתחת לים', en: 'Poseidon, in the kingdom beneath the sea' },
    { power: 1.8, range: 8, cone: 1.25, knock: 2.2, slow: .4, time: 3 }),
  K('prophecy', '#ffd88a', '#3a2614', 40, 30, null, 'prophecy', .9, 17,
    { he: 'הנבואה של טירסיאס', en: "Tiresias' Prophecy" },
    { he: 'למשך 10 שניות, אויבים בטווח 15 מטרים מסומנים בעין: הם סופגים יותר נזק ואת פוגעת בהם יותר במכות קטלניות. גם תיבות וחפצים נסתרים בסביבה מתגלים במפה.', en: 'For 10s, foes within 15 m are marked with an eye: they take more damage and you crit them more. Hidden chests and quest items nearby appear on the map.' },
    { he: 'טירסיאס העיוור', en: 'Tiresias the blind seer' },
    { radius: 15, time: 10, vuln: .25, crit: .15 }),
  K('hellfire', '#b46cff', '#1e0e2a', 28, 13, null, 'cast', .7, 13,
    { he: 'אש הפלגתון', en: 'Fire of the Phlegethon' },
    { he: 'טבעת של אש סגולה מנהר האש של השאול פורצת מתחתייך: פוגעת בכל מי שברדיוס 5 מטרים ומשאירה אותם בוערים.', en: 'A ring of violet fire from the Underworld\'s burning river bursts beneath you: it strikes everything within 5 m and leaves them burning.' },
    { he: 'מתנה מהאדס', en: 'A gift from Hades' },
    { power: 1.9, radius: 5, burn: 8, time: 4 }),
  K('venomtrail', '#8fe05a', '#14301a', 26, 15, null, 'cast', .5, 15,
    { he: 'שובל הארס של קאמפה', en: "Kampe's Venom Trail" },
    { he: 'במשך 5 שניות, כל צעד שלך משאיר ארס על האדמה. כל אויב שעובר בשובל מורעל, והרעל פוגע בו שוב ושוב במשך 3 שניות.', en: 'For 5s every step you take leaves venom on the ground. Any foe that crosses the trail is poisoned, and the poison keeps biting for 3s.' },
    { he: 'הארס של קאמפה, אחרי הקרב בטרטרוס', en: "Kampe's venom, after the fight in Tartarus" },
    { time: 5, tick: 3, poison: 9, radius: .95, linger: 3.5 }),
  ...BOOK, // the skill book: 36 more skills over five grades (skillbook.js)
  // ultimates: they live on F only, cost no mana and recharge slowly
  K('oath', '#ffd24a', '#3a1a08', 0, 60, null, 'ult', 1.75, 1,
    { he: 'שבועת הנחש', en: "The Serpent's Oath" },
    { he: 'הכוח העליון הראשון. Val עפה לשמיים, נחשי זהב מסתחררים סביבה, והיא נוחתת במכה שמפרקת הכול ברדיוס 10 מטרים. נטען דקה, ושווה כל שנייה.', en: 'First ultimate. Val launches skyward, golden serpents coil around her, and she lands with a hit that wrecks everything within 10 m. Takes a minute to recharge. Worth it.' },
    { he: 'הכוהן של תבאי, החל מרמה 10', en: 'The priest of Thebai, from level 10' },
    { ult: true, rank: 1, power: 6, radius: 10, stun: 2.2, knock: 3 }),
  K('rise', '#9fe8ff', '#0e1a2a', 0, 90, null, 'summon', 1.9, 1, // round 31 (Roy): she raises her weapon to call the dead up (models.js 'summon')
    { he: 'קומו', en: 'RISE' },
    { he: 'הכוח העליון של המתים. 20 רוחות קמות מהאדמה ונלחמות לצידך 25 שניות. אי אפשר לפגוע בהן, ורק הן מסוגלות לשבור את מגן המתים.', en: 'The ultimate of the dead. 20 spirits rise from the ground and fight beside you for 25 seconds. They cannot be hurt, and only they can break a ward of the dead.' },
    { he: 'הזקן של דלפי, החל מרמה 18, אחרי השאול', en: 'The elder of Delphoi, from level 18, after the Underworld' },
    { ult: true, rank: 2, count: 20, time: 25, power: 1 }),
  K('zeus', '#bfe4ff', '#10183a', 0, 100, null, 'rise', 2.4, 1,
    { he: 'זעם האולימפוס', en: 'Wrath of Olympus' },
    { he: 'הכוח העליון החזק מכולם. Val מתרוממת, השמיים מחשיכים, ושלושה גלים של ברקים מכים בכל אויב ברדיוס 16 מטרים, ואז רעם אחד שמפיל את כולם. נטען יותר מדקה וחצי.', en: 'The highest ultimate. Val rises, the sky goes dark, and three waves of lightning strike every foe within 16 m, then one thunderclap that floors them all. Recharges in over a minute and a half.' },
    { he: 'הזקן של דיון, החל מרמה 25', en: 'The elder of Dion, from level 25' },
    { ult: true, rank: 3, power: 3.6, radius: 16, waves: 3, stun: .7, final: 4, knock: 2.5 }),
].map((s) => [s.id, s])));
export const ULTS = ['oath', 'rise', 'zeus', 'inferno', 'gaia', 'void', 'hera']; // round 30: fire, earth and the void past Olympus (skillbook.js, quests.js); round 31: Hera's Blessing (temples)
// round 31 (Roy): every ultimate costs 250 mana
export const ULT_MANA = 250;
for (const s of Object.values(SKILLS)) if (s.ult) s.mana = ULT_MANA;
// a skill learned later in the journey hits harder: +6% of its power for every level past 1 it unlocks at
// (Thunder at 22 hits about 2.3x what it did, Dash at 3 barely moves). Ultimates keep their own numbers.
for (const s of Object.values(SKILLS)) {
  if (s.ult && !s.shopUlt) continue; // (round 31: an ultimate the temples teach, Hera's Blessing, has a grade like any skill they sell)
  const k = 1 + ((s.unlock || 1) - 1) * .06; s.tier = k; s.grade = skillTier(s.unlock || 1);
  for (const f of ['power', 'wavePower', 'burn', 'poison']) if (s[f]) s[f] = +(s[f] * k).toFixed(3);
}
// skills the story hands over as gifts (a god, a priestess, Hades): never sold in any shop
for (const id of STORY_GIFTS) if (SKILLS[id]) SKILLS[id].gift = true;
// v31 (Roy's skill rework): the Path of Ascent (skillcat.js). Its ready skills join SKILLS here, after the old tier loop (they
// carry their own numbers: skillcat.js converts the spec's units); the rest are shown in the tree, locked. ?skilldev=1 (a
// developer's switch, never in a save) lets every catalog skill in, placeholders included, to test them.
export const SKILL_DEV = typeof location !== 'undefined' && /[?&]skilldev=1\b/.test(location.search);
for (const e of PATH_SKILLS) if (e.ready || SKILL_DEV) SKILLS[e.id] = catSkill(e);
export const SKILL_ORDER = Object.keys(SKILLS);

// ---------------------------------------------------------------------------------------------
// GEAR: helmets (slot 'head'), amulets ('neck'), cuirasses ('body') and footwear ('feet'). Bonus units:
//   guard: fraction of damage taken removed (add to statsFor().guard)   hp / mp: flat max HP / mana
//   power: fraction added to damage power   crit: crit chance added   mpRegen / hpRegen: points per second
//   exp: fraction more experience   lifesteal: fraction of damage dealt healed   speed: fraction added to move speed
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// Round 28 (Roy): gear on the 1..100 ladder, three grades. The numbers authored in GR() above only say WHICH stats a piece has
// (its flavour); how much comes from the piece's item level, its slot and its grade (GEAR_BAL below). Full on-level Normal set:
// about +25% effective survivability (guard and HP) at any level, Legendary about +80% (see tests/items_check.mjs).
// ---------------------------------------------------------------------------------------------
const GLEVEL = { achilles_helm: 28 }; // authored levels that moved (everything else keeps its round 1-27 level)
const maxHpAt = (L) => 100 + (L - 1) * 18, maxMpAt = (L) => 50 + (L - 1) * 8; // (rpg.js statsFor)
export const GEAR_BAL = {
  guardSet: (L) => .023 + .0006 * L, // guard a whole on-level Normal set adds (statsFor guard caps at .45, Hero.stats at .6)
  hpShare: (L) => .09 + .07 * Math.max(0, 1 - L / 40), // HP a whole on-level Normal set adds, as a share of statsFor maxHp (more at the start, where 100 HP is little)
  slotGuard: { head: .22, body: .36, feet: .14, shield: .22, back: .06, neck: 0 },
  slotHp: { head: .2, body: .3, feet: .14, shield: .2, neck: .16, back: 0 },
  hpGrade: [1, 1.12, 1.6], // extra HP a higher grade carries on top of GRADES[g].stats (survivability, the whole point of the armour)
  signature: { common: 1, rare: 1.03, epic: 1.08, legendary: 1.15 }, // a named piece that used to be rarer is a little better than a plain one of its level
};
// per-stat value of a typical piece at item level L (x authored/typical for that stat)
const KEYS = {
  power: [.06, (L) => .03 + .0011 * L], crit: [.03, (L) => .02 + .0005 * L], mp: [30, (L) => .12 * maxMpAt(L)],
  mpRegen: [.6, (L) => .5 + .035 * L], hpRegen: [1, (L) => Math.max(.6, .003 * maxHpAt(L))], exp: [.15, (L) => .1 + .002 * L],
  lifesteal: [.04, (L) => .02 + .0006 * L], speed: [.07, (L) => .04 + .0006 * L],
};
const AFFIX = {
  head: ['mpRegen', 'crit', 'power'], neck: ['hpRegen', 'lifesteal', 'exp', 'power'], body: ['hpRegen', 'power', 'crit'],
  feet: ['speed', 'hpRegen', 'crit'], back: ['mp', 'hpRegen', 'crit'], shield: ['hpRegen', 'mpRegen', 'power'],
};
const r3 = (v) => Math.round(v * 10000) / 10000;
function gearBonus(B, g) {
  const L = B.ilvl, sig = GEAR_BAL.signature[B.origin] || 1, G = GRADES[g], gm = G.stats, a = B.authBonus, out = {}, S = B.slot;
  for (const [k, v] of Object.entries(a)) {
    let x;
    if (k === 'guard') x = GEAR_BAL.guardSet(L) * GEAR_BAL.slotGuard[S] * sig * gm;
    else if (k === 'hp') x = GEAR_BAL.hpShare(L) * maxHpAt(L) * GEAR_BAL.slotHp[S] * sig * gm * GEAR_BAL.hpGrade[g];
    else if (k === 'block') x = (.01 + .0008 * L) * sig * gm;
    else if (k === 'ice') { out.ice = v; continue; }
    else if (KEYS[k]) x = KEYS[k][1](L) * (v / KEYS[k][0]) * sig * gm;
    else x = v * gm;
    out[k] = k === 'hp' || k === 'mp' ? Math.round(x) : r3(x);
  }
  if (out.guard != null && !out.guard) delete out.guard;
  const affixes = [];
  if (g) {
    const list = [...(AFFIX[S] || AFFIX.head), 'hpRegen', 'mpRegen', 'power', 'crit', 'lifesteal', 'speed', 'exp'], h = [...B.id].reduce((n, c) => n + c.charCodeAt(0), 0);
    for (let i = 0, n = 0; i < list.length && n < G.specials; i++) {
      const k = list[(h + i) % list.length];
      if (k in out) continue;
      out[k] = k === 'mp' ? Math.round(KEYS.mp[1](L) * .7) : r3(KEYS[k][1](L) * .8 * gm * (k === 'hpRegen' ? 1 : 1));
      affixes.push(k); n++;
    }
  }
  return { bonus: out, affixes };
}
const finalizeGear = (x) => {
  const L = GLEVEL[x.id] ?? x.minLevel, a = { ...x.bonus };
  if (x.slot !== 'neck' && x.slot !== 'back') { a.guard ||= 1; a.hp ||= 1; } // (every helmet, cuirass, boot and shield armours and toughens: the value is the formula's, authored numbers only pick the stats)
  const o = { ...x, origin: x.rarity, rarity: 'common', grade: 0, baseId: x.id, minLevel: L, ilvl: L, authBonus: a };
  o.bonus = gearBonus(o, 0).bonus; o.affixes = [];
  return o;
};
// an alias: a new piece wearing an existing piece's model in another colour: GA(id, model, level, tint, name, desc)
const GEAR_SRC = { he: 'שלל מאויבים חזקים ומשימות', en: 'Spoils of mighty foes and quests' };
const GA = (id, model, level, tint, he, en, dhe, den) => {
  const M = RAWG[model];
  return (RAWG[id] = { ...M, id, model, tint, minLevel: level, color: mixHex(M.color, tint, .65), name: { he, en }, desc: { he: dhe, en: den }, source: M.slot === 'back' ? GEAR_SRC : GEAR_SRC });
};
function gearVariant(B, g) {
  const G = GRADES[g], id = B.id + GRADE_SUFFIX[g], { bonus, affixes } = gearBonus(B, g);
  const x = { ...B, id, grade: g, rarity: G.rarity, name: gradeName(B.name, g), bonus, affixes };
  Object.defineProperty(GEAR, id, { value: x, enumerable: false, configurable: true, writable: true });
  return x;
}

const RAWG = {};
const GR = (id, slot, rarity, minLevel, bonus, color, name, desc, source) => (RAWG[id] = { id, slot, rarity, minLevel, bonus, color, name, desc, source });
[
  GR('leather_cap', 'head', 'common', 1, { guard: .02, hp: 10 }, '#7a5634',
    { he: 'כובע עור', en: 'Leather Cap' }, { he: 'כובע עור פשוט עם רצועת ארד. עדיף מכלום.', en: 'A plain leather cap with a bronze band. Better than nothing.' }, { he: 'השוק בכפר', en: 'The village market' }),
  GR('corinthian_helm', 'head', 'rare', 6, { guard: .05, hp: 25 }, '#c08436',
    { he: 'קסדה קורינתית', en: 'Corinthian Helm' }, { he: 'קסדת ארד סגורה עם ציצה אדומה, כמו של הגיבורים בשירים.', en: 'A closed bronze helm with a red crest, like the heroes in the songs.' }, { he: 'הנפח של קורינתוס', en: 'The smith of Korinthos' }),
  GR('spartan_helm', 'head', 'epic', 12, { guard: .07, hp: 40, power: .05 }, '#a8302a',
    { he: 'קסדה ספרטנית', en: 'Spartan Helm' }, { he: 'ציצה רוחבית של מפקד. מי שחובש אותה לא נסוג.', en: "A commander's transverse crest. Whoever wears it does not retreat." }, { he: 'המבחן בספרטה', en: 'The trial at Sparta' }),
  GR('owl_helm', 'head', 'epic', 16, { guard: .06, mp: 30, crit: .03 }, '#d8dce4',
    { he: 'קסדת הינשוף של אתונה', en: 'Owl Helm of Athens' }, { he: 'קסדה אטית בכסף וזהב, וינשוף קטן שומר עלייך מלמעלה.', en: 'An Attic helm of silver and gold, with a little owl watching over you.' }, { he: 'האקרופוליס של אתונה', en: 'The Acropolis of Athens' }),
  GR('darkness_helm', 'head', 'legendary', 22, { guard: .1, hp: 60, crit: .06 }, '#2a2436',
    { he: 'קסדת החושך של האדס', en: 'Helm of Darkness' }, { he: 'הקסדה של אדון המתים. הצללים נצמדים אלייך, והאויבים מאבדים אותך לרגע.', en: 'The helm of the Lord of the Dead. Shadows cling to you, and foes lose sight of you for a heartbeat.' }, { he: 'מתנה מהאדס', en: 'A gift from Hades' }),
  GR('sun_amulet', 'neck', 'rare', 5, { power: .08 }, '#e0303a',
    { he: 'קמע השמש', en: 'Sun Amulet' }, { he: 'שמש של זהב ואבן אדומה בלבה. המכות שלך חמות יותר.', en: 'A golden sun with a red stone at its heart. Your blows land hotter.' }, { he: 'מקדש אפולו', en: "Apollo's shrine" }),
  GR('sea_amulet', 'neck', 'rare', 8, { mp: 20, mpRegen: .6 }, '#2f7dff',
    { he: 'קמע הים', en: 'Sea Amulet' }, { he: 'אבן כחולה כמו המים העמוקים. המאנה זורמת אלייך כמו גאות.', en: 'A stone as blue as deep water. Mana flows back to you like the tide.' }, { he: 'הדייגים של פיראוס', en: 'The fishermen of Piraeus' }),
  GR('owl_amulet', 'neck', 'epic', 10, { exp: .15 }, '#c8ccd6',
    { he: 'קמע הינשוף', en: 'Owl Amulet' }, { he: 'הינשוף של אתנה לומד איתך. כל קרב מלמד יותר.', en: "Athena's owl learns with you. Every fight teaches more." }, { he: 'הספרייה הנשכחת', en: 'The Forgotten Library' }),
  GR('serpent_amulet', 'neck', 'epic', 14, { lifesteal: .04 }, '#3ac06a',
    { he: 'קמע הנחש', en: 'Serpent Amulet' }, { he: 'נחש ירוק שנושך את זנבו. מה שאת פוצעת מחזיר לך חיים.', en: 'A green serpent biting its own tail. What you wound gives you life.' }, { he: 'מדוזה', en: 'Medusa' }),
  GR('fleece_amulet', 'neck', 'legendary', 20, { hp: 40, hpRegen: 1.5 }, '#ffc83a',
    { he: 'קמע גיזת הזהב', en: 'Golden Fleece Amulet' }, { he: 'פיסה מגיזת הזהב, חמה תמיד. הגוף מתרפא גם באמצע הקרב.', en: 'A scrap of the Golden Fleece, always warm. Your body mends even mid-battle.' }, { he: 'גני ההספרידות', en: 'Garden of the Hesperides' }),
  // more helmets
  GR('pilos_helm', 'head', 'common', 2, { guard: .025, hp: 12 }, '#c89a48',
    { he: 'קסדת פילוס', en: 'Pilos Helm' }, { he: 'חרוט ארד פשוט, כמו כובע לבד של נוודים. קל, זול, ועובד.', en: "A plain bronze cone, like a traveller's felt cap. Light, cheap, and it works." }, { he: 'הסוחר באתונה', en: 'The merchant of Athens' }),
  GR('boar_helm', 'head', 'rare', 9, { guard: .045, hp: 20, crit: .025 }, '#e6dfcc',
    { he: 'קסדת ניבי החזיר', en: 'Boar-Tusk Helm' }, { he: 'שורות של ניבי חזיר תפורות על עור. נסטור נשבע שאודיסאוס חבש אחת בדיוק כזאת.', en: 'Rows of boar tusks sewn onto leather. Nestor swears Odysseus wore one just like it.' }, { he: 'הסיפורים של נסטור', en: "Nestor's stories" }),
  GR('thracian_helm', 'head', 'epic', 15, { guard: .065, hp: 35, power: .04 }, '#4a5a78',
    { he: 'קסדה תרקית', en: 'Thracian Helm' }, { he: 'קסדה מהצפון שהקודקוד שלה מתעקל קדימה כמו גל. הסוסים של תסליה נרגעים כשהם רואים אותה.', en: 'A northern helm whose crown curls forward like a wave. The horses of Thessaly calm down when they see it.' }, { he: 'הפרשים של לריסה', en: 'The riders of Larisa' }),
  GR('achilles_helm', 'head', 'legendary', 26, { guard: .1, hp: 70, power: .08 }, '#ffc83a',
    { he: 'הקסדה של אכילס', en: "Achilles' Helm" }, { he: 'הפייסטוס חישל אותה בלילה אחד, וזהב זורם לה בציצה. מי שחובשת אותה נלחמת כמו אש.', en: 'Hephaestus forged it in a single night, with gold running down the crest. Whoever wears it fights like fire.' }, { he: 'המקדש על האולימפוס', en: 'The temple on Olympus' }),
  // body: cuirasses and corslets (slot 'body')
  GR('linen_cuirass', 'body', 'common', 4, { guard: .03, hp: 15 }, '#e8dcc0',
    { he: 'שריון פשתן', en: 'Linen Cuirass' }, { he: 'שכבות של פשתן מודבק, קשות כמו עץ וקלות כמו חיטון. השוליים צבועים בכחול של הים.', en: 'Layers of glued linen, hard as wood and light as a chiton. The hem is dyed sea blue.' }, { he: 'הסוחר בקורינתוס', en: 'The merchant of Korinthos' }),
  GR('muscle_cuirass', 'body', 'rare', 8, { guard: .05, hp: 25, power: .03 }, '#c08436',
    { he: 'שריון שרירים מארד', en: 'Bronze Muscle Cuirass' }, { he: 'ארד שעוצב כמו חזה של גיבור. קצת מצחיק, אבל חצים פשוט מחליקים ממנו.', en: "Bronze shaped like a hero's chest. A little silly, but arrows just slide off." }, { he: 'השוק של ארגוס', en: 'The market of Argos' }),
  GR('scale_cuirass', 'body', 'epic', 13, { guard: .07, hp: 40, hpRegen: .6 }, '#3a9a6a',
    { he: 'שריון קשקשי הנחש', en: 'Serpent-Scale Corslet' }, { he: 'קשקשים ירוקים של נחש ים, תפורים כמו רעפים. הם עוד זוכרים איך להחלים.', en: 'Green sea-serpent scales sewn on like roof tiles. They still remember how to heal.' }, { he: 'הרציף של הארגו', en: 'The Argo pier' }),
  GR('nemean_pelt', 'body', 'legendary', 23, { guard: .11, hp: 80, power: .06 }, '#d8a048',
    { he: 'עור האריה הנמאי', en: 'Nemean Lion Pelt' }, { he: 'העור שהרקלס פשט מהאריה שאף להב לא חודר בו. הוא השאיר אותו ליד עץ הזהב, ומישהי הייתה צריכה למצוא אותו.', en: 'The hide Heracles took from the lion no blade could pierce. He left it by the golden tree, and someone had to find it.' }, { he: 'גני ההספרידות', en: 'Garden of the Hesperides' }),
  // feet: sandals, greaves and boots (slot 'feet'); speed = fraction added to move speed
  GR('krepides', 'feet', 'common', 1, { guard: .015, speed: .03 }, '#8a5a34',
    { he: 'סנדלי שרוכים', en: 'Laced Krepides' }, { he: 'סנדלי עור עם שרוכים עד הברך. טובים לריצה על החוף, וגם לבריחה ממנו.', en: 'Leather sandals laced up to the knee. Good for running on the beach, and away from it.' }, { he: 'הדייגים של אליאה', en: 'The fishers of Elaia' }),
  GR('bronze_greaves', 'feet', 'rare', 10, { guard: .045, hp: 20 }, '#c08436',
    { he: 'מגני שוק מארד', en: 'Bronze Greaves' }, { he: 'ארד דק שנצמד לשוק בלי רצועות, כמו שהספרטנים אוהבים. מעט מילים, הרבה הגנה.', en: 'Thin bronze that hugs the shin without straps, the way Spartans like it. Few words, lots of protection.' }, { he: 'הנפח של ספרטה', en: 'The smith of Sparta' }),
  GR('atalanta_boots', 'feet', 'epic', 11, { guard: .02, speed: .07, crit: .03 }, '#c89a6a',
    { he: 'המגפיים של אטלנטה', en: "Atalanta's Boots" }, { he: 'עור צבי רך ותפוח זהב קטן על כל שרוך. אף אחד לא השיג אותה בריצה, חוץ מפעם אחת, בגלל תפוחים.', en: 'Soft deerskin with a tiny golden apple on each lace. Nobody ever outran her, except once, because of apples.' }, { he: 'המשחקים באולימפיה', en: 'The games at Olympia' }),
  GR('talaria', 'feet', 'legendary', 20, { guard: .03, speed: .12, mp: 25 }, '#f4f0e0',
    { he: 'הסנדלים המכונפים', en: 'Winged Sandals' }, { he: 'הסנדלים של הרמס, אותם שפרסאוס נעל כשברח מהגורגונות. הרגליים כמעט לא נוגעות באדמה.', en: 'The sandals of Hermes, the very pair Perseus wore fleeing the Gorgons. Your feet barely touch the ground.' }, { he: 'האי של הגורגונה', en: "The Gorgon's island" }),
  // ice: 1 = a sure footing on the glazed sheets of the high snowfields (ice.js; without it V slides, entities.js iceStep)
  GR('ice_boots', 'feet', 'rare', 4, { guard: .02, hp: 10, ice: 1 }, '#5e6f80',
    { he: 'מגפי הקרח התרקיים', en: 'Thracian Ice Boots' }, { he: 'מגפי לבד מרופדים בפרווה, עם קוצי ארד מתחת לסוליה. הם נוגסים בקרח, ואת לא מחליקה עליו.', en: 'Felt boots lined with fur, with bronze spikes under the sole. They bite into the ice, so you don\'t slip on it.' }, { he: 'השריונאים בערים', en: 'The town armourers' }),
  // round 22 (Roy): the black dragon's set. The plate is the strongest body armour in the game (well over the Nemean pelt
  // on every count); the wings are a new slot, 'back': worn, V hovers just off the ground and that is her walk and run
  // (models.js hoverRig), so ice can't take her feet either (ice: 1)
  // round 23 (Roy: "don't hand me the dragon clothes and weapon! they are for very high levels"): every piece is level 60,
  // stronger to match, and the set gains an amulet and boots. Sold only to a V of level 60 and dear (shops.js, owner E)
  GR('dragon_plate', 'body', 'legendary', 60, { guard: .18, hp: 220, power: .12, hpRegen: 1.5 }, '#2a2430',
    { he: 'שריון הדרקון השחור', en: 'Black Dragon Plate' }, { he: 'שריון מלא מהקשקשים של הדרקון השחור: לוחות שחורים, קרניים על הכתפיים ואש אדומה שבוערת בין התפרים. שום שריון אחר לא מתקרב אליו.', en: "Full plate of the black dragon's scales: black plates, horns on the shoulders and red fire glowing between the seams. No other armour comes close." }, { he: 'אוצר הדרקון השחור', en: "The black dragon's hoard" }),
  GR('dragon_wings', 'back', 'legendary', 60, { guard: .04, mp: 60, speed: .18, ice: 1 }, '#1e1a24',
    { he: 'כנפי הדרקון השחור', en: 'Black Dragon Wings' }, { he: 'כנפיים שחורות של דרקון, עם טפרים בקצוות. כשהן עלייך, את מרחפת מעט מעל האדמה, והקרקע כבר לא מאטה אותך.', en: 'Black dragon wings with claws at their tips. While you wear them you hover just above the ground, and the ground no longer slows you down.' }, { he: 'אוצר הדרקון השחור', en: "The black dragon's hoard" }),
  GR('dragon_amulet', 'neck', 'legendary', 60, { power: .14, hp: 80, lifesteal: .04 }, '#ff3a1e',
    { he: 'עין הדרקון השחור', en: "Black Dragon's Eye" }, { he: 'עין של אש בתוך טופר שחור, תלויה על שרשרת קשקשים. כשהיא עלייך, כל מכה שלך שורפת כמו נשיפה של דרקון ומחזירה לך חיים.', en: "An eye of fire in a black claw, on a chain of scales. While you wear it every blow burns like a dragon's breath and gives you back life." }, { he: 'אוצר הדרקון השחור', en: "The black dragon's hoard" }),
  GR('dragon_boots', 'feet', 'legendary', 60, { guard: .05, hp: 60, speed: .1, ice: 1 }, '#2a2430',
    { he: 'מגפי הדרקון השחור', en: 'Black Dragon Greaves' }, { he: 'מגני שוק מקשקשים שחורים עד הברך וטפרים מעל האצבעות. התפר האדום בוער, והקרח לא נוגס בהם.', en: 'Black scale greaves to the knee and claws over the toes. The red seam glows, and ice cannot bite them.' }, { he: 'אוצר הדרקון השחור', en: "The black dragon's hoard" }),
  // round 23 (Roy: "add 10 more kinds of shield, by level. The higher the level, the more special it looks; play with size and
  // shape. And of course it costs more and is harder to get the stronger it is"). Slot 'shield': the shield on her left arm
  // with a sword or a one-handed spear (on her back with anything two-handed), its look by `kind` (SHIELD_BUILD). Bonus
  // `block` is the share of a blocked blow it stops on top of her guard (entities.js, owner B; capped). The three shields
  // that used to come with weapons are items too (her own sun-and-moon one, the aspis, Poseidon's scallop), so old saves
  // keep what they carried (rpg.js migration, owner D). The legendary three are never on a smith's table (traders only).
  GR('shield_buckler', 'shield', 'common', 1, { guard: .01, block: .01, hp: 5 }, '#8a5a30',
    { he: 'מגן עץ קטן', en: 'Oak Buckler' }, { he: 'עיגול קטן של קרשי אלון, שפה וטבור מברזל. מגן ראשון וטוב לידיים שלומדות.', en: 'A small round of oak planks with an iron rim and boss. A good first shield for hands still learning.' }, { he: 'הנפחים בערים', en: 'The town smiths' }),
  GR('shield_pelta', 'shield', 'common', 3, { guard: .012, block: .015, speed: .02 }, '#c9a26a',
    { he: 'פלטה תרקית', en: 'Thracian Pelta' }, { he: 'מגן קל בצורת סהר, נצרים מתחת לעור ועין צבועה באמצע. הקלעים של תרקיה רצים איתו כאילו אין להם כלום ביד.', en: 'A light crescent of wicker under hide, with a painted eye in the middle. The skirmishers of Thrace run with it as if their hands were empty.' }, { he: 'הנפחים בערים', en: 'The town smiths' }),
  GR('shield_round', 'shield', 'common', 5, { guard: .018, block: .02, hp: 12 }, '#c08436',
    { he: 'אספיס ארד', en: 'Bronze Aspis' }, { he: 'המגן העגול של ההופליטים, ארד מרוקע ולמבדה ספרטנית. מכסה אותך מהסנטר עד הברך.', en: "The hoplite's round shield, hammered bronze with a Spartan lambda. It covers you from chin to knee." }, { he: 'הנפחים בערים', en: 'The town smiths' }),
  GR('shield_square', 'shield', 'rare', 8, { guard: .025, block: .03, hp: 20 }, '#c08436',
    { he: 'מגן ריבועי מארד', en: 'Square Bronze Shield' }, { he: 'ריבוע של אלון מצופה ארד, רצועות משובצות בצורת צלב. עבודה של חיילים, לא של מלכים, והיא מחזיקה.', en: "A square of oak faced with bronze, studded straps in a cross. Soldiers' work, not kings', and it holds." }, { he: 'הנפחים בערים', en: 'The town smiths' }),
  GR('shield_dipylon', 'shield', 'rare', 11, { guard: .03, block: .035, hp: 28 }, '#ece2cc',
    { he: 'מגן שמונה מעור שור', en: 'Figure-of-Eight Shield' }, { he: 'מגן של הגיבורים הקדומים: עור שור מנומר על מסגרת, שתי אונות ומותן צרה באמצע. כזה נשא אייאקס לפני שהיה לו מגדל.', en: 'A shield of the old heroes: dappled oxhide on a frame, two lobes and a narrow waist. Ajax carried one before he had a tower.' }, { he: 'הנפחים בערים', en: 'The town smiths' }),
  GR('shield_oval', 'shield', 'rare', 14, { guard: .035, block: .04, hp: 36 }, '#2e5c9a',
    { he: 'תוראוס, מגן סגלגל', en: 'Thureos' }, { he: 'מגן סגלגל וגבוה עם עמוד שדרה מעץ, צבוע כחול כמו הים וטבעת לבנה של גלים סביבו.', en: 'A tall oval shield with a wooden spine, painted sea blue with a white ring of waves round it.' }, { he: 'הנפחים בערים', en: 'The town smiths' }),
  GR('shield_tower', 'shield', 'epic', 18, { guard: .045, block: .06, hp: 55 }, '#9a6a3a',
    { he: 'מגן המגדל של אייאקס', en: "Ajax's Tower Shield" }, { he: 'שבעה עורות שור ושכבת ארד, גבוה מהכתף עד הברך. כבד, אבל מאחוריו העולם שקט.', en: 'Seven oxhides and a skin of bronze, tall from shoulder to knee. Heavy, but behind it the world goes quiet.' }, { he: 'הנפחים בערים הגדולות', en: 'The smiths of the great cities' }),
  GR('shield_gorgon', 'shield', 'epic', 24, { guard: .045, block: .05, hp: 50, power: .04 }, '#e8b840',
    { he: 'אספיס הגורגונה', en: 'Gorgon Aspis' }, { he: 'אספיס גדול מארד, ופני הגורגונה מוזהבים באמצע, עם נחשים במקום שיער. אויבים מהססים לרגע לפני שהם מכים בו.', en: 'A great bronze aspis with the Gorgon\'s gilded face at its heart and snakes for hair. Foes falter for a heartbeat before they strike it.' }, { he: 'הנפחים בערים הגדולות', en: 'The smiths of the great cities' }),
  GR('shield_achilles', 'shield', 'legendary', 32, { guard: .055, block: .07, hp: 85, power: .05 }, '#2a7a8a',
    { he: 'המגן של אכילס', en: "Shield of Achilles" }, { he: 'הפייסטוס חישל עליו את כל העולם: שמיים ושמש וירח באמצע, ערים ושדות סביבם, והאוקיינוס זורם על השפה.', en: 'Hephaestus forged the whole world on it: sky, sun and moon at the middle, cities and fields round them, and Ocean flowing along the rim.' }, { he: 'סוחרים נודדים, לעיתים רחוקות', en: 'Wandering traders, rarely' }),
  GR('shield_helios', 'shield', 'legendary', 42, { guard: .06, block: .075, hp: 110, hpRegen: 1.2 }, '#ffb030',
    { he: 'מגן השמש של הליוס', en: 'Shield of Helios' }, { he: 'זהב מרוקע וכתר של קרני אש סביבו. הוא חם תמיד, והגוף שמאחוריו מתרפא כמו בבוקר.', en: 'Beaten gold with a crown of flame-coloured rays. It is always warm, and the body behind it mends like morning.' }, { he: 'סוחרים נודדים, לעיתים רחוקות', en: 'Wandering traders, rarely' }),
  GR('shield_aegis', 'shield', 'legendary', 52, { guard: .07, block: .08, hp: 140, mp: 40 }, '#cfd6e0',
    { he: 'האגיס של אתנה', en: "Athena's Aegis" }, { he: 'המגן של אתנה עצמה: קשקשי כסף, ראש הגורגונה עם עיני אור, ושוליים של נחשי זהב. אין חזק ממנו.', en: "Athena's own shield: silver scales, the Gorgon's head with eyes of light, and a fringe of golden snakes. None is stronger." }, { he: 'סוחרים נודדים, לעיתים רחוקות מאוד', en: 'Wandering traders, very rarely' }),
  GR('shield_crescent', 'shield', 'rare', 1, { guard: .015, block: .02, hp: 10 }, '#262832',
    { he: 'מגן הירח והשמש', en: 'Sun-and-Moon Shield' }, { he: 'המגן השחור שלך, עם השמש והסהר מכסף. הוא איתך מההתחלה.', en: 'Your own black shield, with the silver sun and crescent moon. It has been with you from the start.' }, { he: 'שלך', en: 'Your own' }),
  GR('shield_shell', 'shield', 'epic', 12, { guard: .03, block: .035, mp: 25, mpRegen: .4 }, '#f2e4d2',
    { he: 'מגן צדפה', en: 'Scallop Shield' }, { he: 'צדפה ענקית מהארמון שמתחת לגלים. המאנה זורמת אלייך ממנה כמו גאות.', en: 'A giant scallop shell from the palace beneath the waves. Mana flows back to you from it like the tide.' }, { he: 'פוסידון', en: 'Poseidon' }),
  // ---- round 28: the later ladder (levels 12..97): new pieces on the existing models, in other colours (GA = retinted model)
  // helmets
  GA('gigante_helm', 'thracian_helm', 36, '#5a6a58', 'קסדת הגיגנטים', 'Gigante Helm', 'קסדה כבדה מברזל ירקרק, עם קודקוד מתעקל כמו גל שעומד לשבור. מי שנלחם בענקים לומד לא להתכופף.', 'A heavy helm of greenish iron, its crown curling like a wave about to break. Those who fight giants learn not to duck.'),
  GA('silver_corinthian', 'corinthian_helm', 44, '#c8c8d0', 'קורינתית כסופה', 'Silvered Corinthian', 'קסדה קורינתית משוחזרת בכסף, וציצה לבנה. היא מבהיקה גם בחושך.', 'A Corinthian helm refined in silver with a white crest. It gleams even in the dark.'),
  GA('hydra_helm', 'boar_helm', 52, '#3a9a6a', 'קסדת קשקשי ההידרה', 'Hydra-Scale Helm', 'קשקשים ירוקים מצוואר ההידרה, תפורים על עור. מה שנחתך ממנה צומח חזרה, וכך גם הכוח שלך.', "Green scales from the Hydra's neck sewn on leather. What was cut from her grows back, and so does your strength."),
  GA('ember_helm', 'darkness_helm', 60, '#ff5a2a', 'קסדת הגחלת', 'Ember Helm', 'קסדה שחורה שזוהרת באדום בין התפרים, כמו גחלת שלא כבתה. האויבים מסיטים את המבט.', 'A black helm glowing red between its seams, like an ember that never died. Foes look away.'),
  GA('titan_crown', 'spartan_helm', 68, '#e8c040', 'כתר הטיטאן', 'Titan Crown', 'כתר זהב עם ציצה של מפקד, שהיה שייך למי שהוביל את הטיטאנים. מי שחובשת אותו לא נסוגה, ואין לה סיבה.', 'A golden crown with a commander\'s crest, once worn by one who led the Titans. Whoever wears it does not retreat, and has no reason to.'),
  GA('olympian_helm', 'owl_helm', 76, '#ffd878', 'קסדת האולימפי', 'Olympian Helm', 'קסדת זהב ולבן שהאלים חובשים כשהם יורדים בין בני התמותה. הינשוף שעל ציצתה רואה גם את מה שעוד לא קרה.', 'A gold and white helm the gods wear when they come down among mortals. The owl on its crest sees what has not happened yet.'),
  GA('chimera_helm', 'darkness_helm', 84, '#c8402a', 'קסדת הכימרה', 'Chimera Helm', 'שלושה ראשים חרוטים בקסדה אחת: אריה, עז ונחש. האויבים לא יודעים לאיזה מהם להביט.', 'Three heads cast in one helm: lion, goat and serpent. Foes cannot tell which to watch.'),
  GA('kronos_helm', 'achilles_helm', 92, '#8a5ad8', 'קסדת קרונוס', 'Helm of Kronos', 'קסדה סגולה שהזמן זורם בה לאט. מי שחובשת אותה מבחינה בכל מכה לפני שהיא באה.', 'A violet helm in which time runs slow. Whoever wears it sees every blow before it lands.'),
  // amulets
  GA('amber_amulet', 'sun_amulet', 26, '#e8a838', 'קמע הענבר', 'Amber Amulet', 'חרוז ענבר עתיק שנלכד בו יצור לפני אלפי שנים. החום שלו נשאר במכות שלך.', 'An ancient bead of amber with a creature caught in it ages ago. Its warmth stays in your blows.'),
  GA('storm_amulet', 'sea_amulet', 33, '#7a6aff', 'קמע הסופה', 'Storm Amulet', 'אבן סגולה וסמיכה כמו ענן לפני סופה. המאנה זורמת אלייך עם כל רעם.', 'A stone violet and dense as a cloud before a storm. Mana rushes to you with every thunderclap.'),
  GA('titan_eye', 'owl_amulet', 40, '#d89a3a', 'עין הטיטאן', "Titan's Eye", 'עין זהב מחוטבת באבן. היא ראתה את שחר העולם ולומדת איתך מהר יותר.', 'A golden eye cut in stone. It saw the dawn of the world and learns with you, faster.'),
  GA('styx_amulet', 'serpent_amulet', 47, '#7a4ad8', 'קמע הסטיקס', 'Styx Amulet', 'נחש סגול שעולה ממי הנהר שהאלים נשבעים בו. מה שאת פוצעת נותן לך חיים.', 'A violet serpent rising from the river the gods swear by. What you wound gives you life.'),
  GA('argent_fleece', 'fleece_amulet', 54, '#e0e0f0', 'קמע הגיזה הכסופה', 'Argent Fleece Amulet', 'גיזה כסופה מאיל שהאלים אוהבים. הגוף מתרפא גם כשהקרב מתעצם.', 'Silver fleece from a ram the gods love. The body mends even as the battle swells.'),
  GA('flame_amulet', 'sun_amulet', 68, '#ff4a2a', 'קמע הלהבה', 'Flame Amulet', 'שמש אדומה כמו עין הדרקון בקטן. המכות שלך שורפות יותר.', "A red sun, like a dragon's eye in miniature. Your blows burn hotter."),
  GA('wave_amulet', 'sea_amulet', 76, '#2affd8', 'קמע הגל הגדול', 'Great Wave Amulet', 'אבן בצבע המים הירוקים והעמוקים. המאנה חוזרת אלייך כמו גל שלא נגמר.', 'A stone the colour of deep green water. Mana returns to you like a wave that never ends.'),
  GA('moirai_amulet', 'owl_amulet', 84, '#f0e8ff', 'קמע המוירות', 'Moirai Amulet', 'חוט הגורל קשור סביב עין לבנה. מי שנושאת אותו לומדת מכל קרב כאילו כבר ראתה אותו.', 'The thread of fate knotted around a white eye. Its bearer learns from every fight as if she had seen it before.'),
  GA('star_amulet', 'fleece_amulet', 92, '#9ad8ff', 'קמע הכוכב', 'Star Amulet', 'רסיס מכוכב שנפל, קר וחם גם יחד. הגוף מתרפא כמו אחרי לילה שלם.', 'A shard of a fallen star, cold and warm at once. The body mends as after a full night.'),
  // body armour
  GA('quilted_cuirass', 'linen_cuirass', 18, '#a8c8e8', 'שריון פשתן מרופד', 'Quilted Linen Cuirass', 'שכבות פשתן עבות, תפורות כמו שמיכה, עם צלעות ברזל מאחור. קל ויעיל.', 'Thick linen layers stitched like a quilt, with iron ribs sewn behind. Light and effective.'),
  GA('steel_cuirass', 'muscle_cuirass', 30, '#b8b8c0', 'שריון שרירים מפלדה', 'Steel Muscle Cuirass', 'פלדה מהוקצעת במקום ארד. אותה צורה, אבל חצים כבר אפילו לא משריטים אותו.', 'Polished steel in place of bronze. The same shape, but arrows no longer even scratch it.'),
  GA('hydra_corslet', 'scale_cuirass', 37, '#6a5ad8', 'שריון קשקשי ההידרה', 'Hydra-Scale Corslet', 'קשקשים סגולים־כחולים מצוואר הידרה, שההחלמה בהם לא נגמרת.', "Violet-blue scales from a hydra's neck, whose healing never ends."),
  GA('chimera_pelt', 'nemean_pelt', 44, '#6a6a78', 'עור הכימרה', 'Chimera Pelt', 'עור אפור ומעורב: שערות אריה, צמר עז וקשקשי נחש. אף אחד לא ידע איך לחתוך אותו.', "A grey mixed hide: a lion's hair, a goat's wool and serpent scales. No one ever knew how to cut it."),
  GA('gigante_cuirass', 'muscle_cuirass', 51, '#8a5a3a', 'שריון הגיגנטים', 'Gigante Cuirass', 'ארד כהה ועבה, חזית של בני האדמה. כבד מכדי לחשוב עליו.', 'Dark thick bronze, the breastplate of the earth-born. Too heavy to think about.'),
  GA('typhon_corslet', 'scale_cuirass', 68, '#d83a3a', 'שריון קשקשי טיפון', 'Typhon Corslet', 'קשקשים אדומים מראשי הנחשים של טיפון. הם עוד זוכרים איך להתרפא.', 'Red scales from the serpent heads of Typhon. They still remember how to heal.'),
  GA('titan_cuirass', 'muscle_cuirass', 76, '#e8c040', 'שריון הטיטאן', 'Titan Cuirass', 'זהב כבד בצורת חזה של אל. קשה לנוע בו וקל להרגיש בו בטוחה.', "Heavy gold in the shape of a god's chest. Hard to move in, easy to feel safe in."),
  GA('olympian_pelt', 'nemean_pelt', 84, '#f0e0b0', 'עור האריה האולימפי', 'Olympian Lion Pelt', 'אריה לבן מהר האלים, עורו רך כחלב ועמיד כשמיים.', 'A white lion from the mountain of the gods, its hide soft as milk and tough as the sky.'),
  GA('nyx_plate', 'dragon_plate', 92, '#5a4a8a', 'שריון הלילה', 'Plate of Night', 'לוחות סגולים־שחורים כשמי לילה בלי כוכבים. בין התפרים עוד בוערת אש.', 'Violet-black plates like a starless night sky. Fire still burns between the seams.'),
  // footwear
  GA('hunter_krepides', 'krepides', 16, '#5a7a3a', 'סנדלי הציידות', "Huntress' Sandals", 'סנדלי עור ירוקים של ציידות ארטמיס. אף פסיעה לא נשמעת.', "Green leather sandals of Artemis' huntresses. No step is heard."),
  GA('silver_greaves', 'bronze_greaves', 26, '#c8c8d0', 'מגני שוק מכסף', 'Silver Greaves', 'כסף דק הנצמד לשוק, כמו אצל הספרטנים, רק מבהיק יותר.', "Thin silver clinging to the shin like the Spartans', only brighter."),
  GA('apple_boots', 'atalanta_boots', 33, '#e8c040', 'מגפי תפוחי הזהב', 'Golden-Apple Boots', 'עור צבי וזהב: על כל שרוך תפוח קטן. אף אחד לא השיג אותה, ואותך גם לא ישיגו.', 'Deerskin and gold with a tiny apple on each lace. Nobody ever caught her, nor will they catch you.'),
  GA('thunder_sandals', 'talaria', 40, '#9ad8ff', 'סנדלי הרעם', 'Thunder Sandals', 'סנדלים מכונפים בכחול של ברק. הרגליים נושאות אותך ממקום למקום בפצפוץ.', 'Winged sandals blue as lightning. Your feet carry you from place to place with a crackle.'),
  GA('gigante_greaves', 'bronze_greaves', 47, '#5a6a58', 'מגני שוק הגיגנטים', 'Gigante Greaves', 'מגני שוק כבדים שנעלו הענקים. כל צעד מרעיד את האדמה.', 'Heavy greaves the giants wore. Every step shakes the earth.'),
  GA('north_boots', 'ice_boots', 54, '#8ad8ff', 'מגפי הצפון הקפוא', 'Frozen North Boots', 'מגפי פרווה ופלדה מהארץ שמעבר לרוח הצפונית. הקרח כבר לא מחליק אותך.', 'Fur and steel boots from the land beyond the north wind. Ice no longer slides you.'),
  GA('flame_boots', 'dragon_boots', 68, '#ff6a2a', 'מגפי הלהבה', 'Flame Greaves', 'מגני שוק בשחור וכתום, כמו מחשבה על אש. מהירים ויציבים על קרח.', 'Greaves of black and orange, like a thought of fire. Quick and steady on ice.'),
  GA('wind_sandals', 'talaria', 76, '#e8f8ff', 'סנדלי הרוח', 'Wind Sandals', 'כנפיים לבנות מהרוח המערבית. הרגליים כמעט לא נוגעות באדמה.', 'White wings from the west wind. Your feet hardly touch the ground.'),
  GA('titan_greaves', 'bronze_greaves', 84, '#e8c040', 'מגני שוק הטיטאן', 'Titan Greaves', 'זהב מרוקע על מגני שוק שמחזיקים את העולם. מי שנועלת אותם לא נבהלת משום דבר.', 'Hammered gold on greaves that hold up the world. Whoever wears them fears nothing.'),
  GA('star_boots', 'atalanta_boots', 92, '#9a5ad8', 'מגפי הכוכבים', 'Star Boots', 'מגפי עור סגולים עם כוכבים קטנים על השרוכים. הדרך נפתחת מתחתם.', 'Violet leather boots with tiny stars on the laces. The road opens beneath them.'),
  // wings (the back slot: worn, V hovers just off the ground, like the dragon's)
  GA('raven_wings', 'dragon_wings', 12, '#3a3a48', 'כנפי עורב', 'Raven Wings', 'כנפיים שחורות וקטנות מנוצות עורב. קלות על הגב ומרימות אותך מעל האדמה.', 'Small black wings of raven feathers. Light on the back, lifting you off the ground.'),
  GA('harpy_wings', 'dragon_wings', 20, '#8a6ab0', 'כנפי הרפיה', 'Harpy Wings', 'כנפי סערה סגולות של הרפיה, חדות בקצוות.', 'Purple storm wings of a harpy, sharp at the tips.'),
  GA('bat_wings', 'dragon_wings', 28, '#4a2a5a', 'כנפי עטלף', 'Bat Wings', 'כנפיים דקות כמו קרום, שקטות כמו הלילה.', 'Thin membrane wings, quiet as night.'),
  GA('night_wings', 'dragon_wings', 36, '#2a3a6a', 'כנפי הלילה', 'Night Wings', 'כנפיים כחולות כהות, שהכוכבים משתקפים בהן.', 'Dark blue wings in which the stars are reflected.'),
  GA('stymphalian_wings', 'dragon_wings', 44, '#c08436', 'כנפי סטימפליס', 'Stymphalian Wings', 'כנפי ארד של הציפורים שהרקלס הבריח. כל נוצה מצלצלת.', 'Bronze wings of the birds Heracles drove off. Every feather rings.'),
  GA('gorgon_wings', 'dragon_wings', 52, '#3ac06a', 'כנפי הגורגונה', 'Gorgon Wings', 'כנפי זהב וירוק של אחיות מדוזה. מי שמביט בהן שוכח מה רצה.', "Gold and green wings of Medusa's sisters. Whoever gazes at them forgets what he wanted."),
  GA('ember_wings', 'dragon_wings', 68, '#ff7a2a', 'כנפי הגחלת', 'Ember Wings', 'כנפיים שנראות כמו גחלים הזורמות אל הלילה. הקרח לא תופס אותך.', 'Wings like embers streaming into the night. Ice cannot hold you.'),
  GA('storm_wings', 'dragon_wings', 76, '#6ab0ff', 'כנפי הסערה', 'Storm Wings', 'כנפיים כחולות־לבנות של ענן סערה. את רצה בין רעמים.', 'Blue-white wings of a storm cloud. You run between thunderclaps.'),
  GA('dawn_wings', 'dragon_wings', 84, '#fff1b0', 'כנפי השחר', 'Dawn Wings', 'כנפיים בצבע האור הראשון של היום. כל מה שהן נוגעות בו מתחמם.', 'Wings the colour of the first light of day. Whatever they touch grows warm.'),
  GA('chaos_wings', 'dragon_wings', 92, '#c83aff', 'כנפי הכאוס', 'Chaos Wings', 'כנפיים שצבען משתנה בכל רגע, כאילו אינן שייכות לשום עולם.', 'Wings that change colour every moment, as if they belonged to no world.'),
  // shields (kind = the model's)
  GA('shield_chimera', 'shield_helios', 62, '#d83a2a', 'מגן הכימרה', 'Chimera Shield', 'מגן של אש ופרווה אדומה, וכתר קרניים סביבו.', 'A shield of fire and red fur, crowned with horns.'),
  GA('shield_thunder', 'shield_oval', 71, '#ffe866', 'מגן הרעם', 'Thunder Shield', 'מגן גבוה שברק צהוב רץ עליו.', 'A tall shield with yellow lightning running over it.'),
  GA('shield_night', 'shield_round', 80, '#2a2a46', 'אספיס הלילה', 'Aspis of Night', 'אספיס כהה בלי סמל. אין עליו שום דבר, וזה מה שמפחיד.', 'A dark aspis with no device. There is nothing on it, and that is what frightens.'),
  GA('shield_olympus', 'shield_aegis', 89, '#fff1b0', 'מגן האולימפוס', 'Shield of Olympus', 'זהב ולבן, כסוף בקצותיו, כמו פסגה בשמש.', 'Gold and white, silver at the edges, like a peak in the sun.'),
  GA('shield_world', 'shield_achilles', 97, '#9a5ad8', 'מגן סוף העולם', "Shield of the World's End", 'מגן שמצויר עליו סוף כל הדברים, ועדיין לא נשבר.', 'A shield painted with the end of all things, and still unbroken.'),
];
// ---- round 30: the five WINGED sets (FAIRY, ANGEL, CHAOS, DEVIL, the black DRAGON), level 150, Heroic only. The authored
// numbers only say which stats a piece has (GEAR_BAL makes the values); the wings carry the dragon's speed and ice grip
{
  const WG = (id, slot, bonus, color, he, en, dhe, den) => GR(id, slot, 'legendary', 150, bonus, color, LN(he, en), LN(dhe, den), WINGED_SRC);
  // FAIRY: quick, light, wise
  WG('fairy_circlet', 'head', { guard: 1, hp: 1, mpRegen: .6, exp: .15 }, '#6ac87a', 'נזר הפיות', 'Fairy Circlet', 'כובע של עלים, נזר של פרחים ושתי מחושים שקצותיהם זוהרים. המחשבה צלולה כמו טל.', 'A cap of leaves, a circlet of flowers and two feelers with glowing tips. The mind clear as dew.');
  WG('fairy_amulet', 'neck', { exp: .15, mpRegen: .6, speed: .07 }, '#c8fff0', 'קמע הפיות', 'Fairy Amulet', 'טיפת טל של אור שנלכדה בין עלים מכסף.', 'A dewdrop of light caught between silver leaves.');
  WG('fairy_dress', 'body', { guard: 1, hp: 1, mpRegen: .6, speed: .07 }, '#ffb8e8', 'שריון הפיות', 'Fairy Petal Armour', 'עלי כותרת ורודים וסגולים על חזייה ירוקה, וחצאית של עלי כותרת ארוכים. קל כמו פרח.', 'Pink and lilac petals over a green bodice, and a skirt of long petals. Light as a flower.');
  WG('fairy_slippers', 'feet', { guard: 1, hp: 1, speed: .1, ice: 1 }, '#6ac87a', 'נעלי הפיות', 'Fairy Slippers', 'נעלי עלים רכות עם קצה מסולסל וכנף זכוכית קטנה בכל קרסול.', 'Soft leaf slippers with curled toes and a little glass wing at each ankle.');
  WG('fairy_wings', 'back', { guard: .04, mp: 60, speed: .18, ice: 1 }, '#c8f0ff', 'כנפי הפיות', 'Fairy Wings', 'שני זוגות כנפי זכוכית, עורקים של אור ושוליים זוהרים. הן רועדות כמו כנפי שפירית.', 'Two pairs of glass wings, veins of light and glowing rims. They quiver like a dragonfly\'s.');
  WG('shield_fairy', 'shield', { guard: 1, block: 1, hp: 1, mpRegen: .6 }, '#6ac87a', 'מגן הפיות', 'Fairy Shield', 'עלה ענק עם עורקים, פרח בלבו וטל עליו.', 'A giant veined leaf, a flower at its heart and dew upon it.');
  // ANGEL: life, light, guard
  WG('angel_helm', 'head', { guard: 1, hp: 1, hpRegen: 1, mp: 30 }, '#f4f0e6', 'קסדת המלאכים', 'Angel Helm', 'קסדה לבנה וזהב, כנף של נוצות מכל רקה והילה של אור מעליה.', 'A white and gold helm, a feathered wing from each temple and a halo of light above it.');
  WG('angel_amulet', 'neck', { hp: 80, hpRegen: 1.5, mp: 30 }, '#fff0a0', 'קמע המלאכים', 'Angel Amulet', 'כוכב של שמונה קרני זהב סביב לב של אור לבן.', 'A star of eight golden rays round a heart of white light.');
  WG('angel_plate', 'body', { guard: 1, hp: 1, hpRegen: 1 }, '#f4f0e6', 'שריון המלאכים', 'Angel Plate', 'שריון לבן בשולי זהב, שמש על החזה וכנפי נוצות על הכתפיים.', 'White plate trimmed in gold, a sun on the breast and feathered wings on the shoulders.');
  WG('angel_greaves', 'feet', { guard: 1, hp: 1, speed: .07, ice: 1 }, '#f4f0e6', 'מגפי המלאכים', 'Angel Greaves', 'מגני שוק לבנים, ברכיים מזהב וכנף של נוצות על כל אחד.', 'White greaves, golden knees and a feathered wing on each.');
  WG('angel_wings', 'back', { guard: .04, mp: 60, speed: .18, hpRegen: 1, ice: 1 }, '#f4f0e6', 'כנפי המלאכים', 'Angel Wings', 'כנפיים גדולות של נוצות לבנות בשולי זהב. כשהן נפרשות, האור נעשה רך.', 'Great wings of white feathers rimmed in gold. When they spread, the light grows soft.');
  WG('shield_angel', 'shield', { guard: 1, block: 1, hp: 1, hpRegen: 1 }, '#f4f0e6', 'מגן המלאכים', 'Angel Shield', 'מגן לבן בצורת עפיפון, קרני זהב, כוכב בוער במרכז ושוליים של נוצות.', 'A white kite shield, golden rays, a burning star at the boss and a fringe of feathers.');
  // CHAOS: raw power and luck
  WG('chaos_crown', 'head', { guard: 1, hp: 1, crit: .03, power: .06 }, '#2a1438', 'כתר הכאוס', 'Chaos Crown', 'קסדה שחורה כמו ריק, כתר של גבישים שבורים, וכמה רסיסים מרחפים מעליו.', 'A helm black as the void, a crown of broken crystal, a few shards drifting above it.');
  WG('chaos_amulet', 'neck', { power: .06, crit: .03, lifesteal: .04 }, '#140c1a', 'קמע הכאוס', 'Chaos Amulet', 'כדור שחור של כלום בתוך טבעת שבורה של רסיסים, ולב סגול.', 'A black orb of nothing in a broken ring of shards, and a violet heart.');
  WG('chaos_plate', 'body', { guard: 1, hp: 1, power: .06, crit: .03 }, '#140c1a', 'שריון הכאוס', 'Chaos Plate', 'שריון שחור שנסדק לאורכו באש סגולה, וגבישים במקום כתפיות.', 'Black plate cracked through with violet fire, and crystals for pauldrons.');
  WG('chaos_greaves', 'feet', { guard: 1, hp: 1, speed: .07, crit: .03, ice: 1 }, '#2a1438', 'מגפי הכאוס', 'Chaos Greaves', 'מגני שוק של ריק, תפר זוהר וקוצי גביש.', 'Greaves of void, a glowing seam and crystal spikes.');
  WG('chaos_wings', 'back', { guard: .04, mp: 60, speed: .18, crit: .03, ice: 1 }, '#140c1a', 'כנפי הכאוס', 'Chaos Wings', 'בלי נוצות ובלי קרום: כנף שעשויה מרסיסים שבורים של עולם, ובין הרסיסים אש סגולה.', 'No feathers and no membrane: a wing made of broken shards of a world, violet fire between them.');
  WG('shield_chaos', 'shield', { guard: 1, block: 1, hp: 1, power: .06 }, '#140c1a', 'מגן הכאוס', 'Chaos Shield', 'מגן עגול שהתנפץ ולא נפל: לוחות ריק ותפרים של אש, וחור שחור במרכז.', 'A round shield that shattered and did not fall: plates of void, seams of fire, a black hole at its heart.');
  // DEVIL: fury and blood
  WG('devil_helm', 'head', { guard: 1, hp: 1, power: .06, lifesteal: .04 }, '#7a1414', 'קסדת השטן', 'Devil Helm', 'קסדה ארגמנית עם קרניים גדולות ומתעקלות, מסכה עם ניבים ועיני גחלים.', 'A crimson helm with great curling horns, a fanged visor and ember eyes.');
  WG('devil_amulet', 'neck', { power: .06, lifesteal: .04, hp: 60 }, '#ff3a1a', 'קמע השטן', 'Devil Amulet', 'לב בוער של גופרית בתוך טופר שחור עם קרניים.', 'A burning heart of brimstone in a black horned claw.');
  WG('devil_plate', 'body', { guard: 1, hp: 1, power: .06, lifesteal: .04 }, '#7a1414', 'שריון השטן', 'Devil Plate', 'שריון ארגמן עם צלעות שחורות, כתפיות קוצניות וגחלים בין התפרים.', 'Crimson plate ribbed in black, spiked pauldrons and embers in the seams.');
  WG('devil_greaves', 'feet', { guard: 1, hp: 1, speed: .07, ice: 1 }, '#1e0c0e', 'מגפי השטן', 'Devil Greaves', 'מגני שוק שחורים, ברכיים קוצניות ואצבעות עם טפרים.', 'Black greaves, spiked knees and clawed toes.');
  WG('devil_wings', 'back', { guard: .04, mp: 60, speed: .18, power: .06, ice: 1 }, '#7a1414', 'כנפי השטן', 'Devil Wings', 'קרום ארגמן קרוע על עצמות שחורות, טופר מכל אצבע ועורקים של גחלים.', 'Ragged crimson membranes on black bone, a claw at every finger and ember veins.');
  WG('shield_devil', 'shield', { guard: 1, block: 1, hp: 1, lifesteal: .04 }, '#1e0c0e', 'מגן השטן', 'Devil Shield', 'אספיס שחור עם טבעת קוצים ופנים ארגמניות עם קרניים.', 'A black aspis with a ring of spikes and a horned crimson face.');
  // the black DRAGON grows a helm and a shield
  WG('dragon_helm', 'head', { guard: 1, hp: 1, power: .06, hpRegen: 1 }, '#2a2430', 'קסדת הדרקון השחור', 'Black Dragon Helm', 'ראש של דרקון: גולגולת שחורה מקשקשים, חרטום מעל הפנים, קרניים לאחור ועיני אש.', "A dragon's head: a black scaled skull, a snout over the face, horns swept back and eyes of fire.");
  WG('shield_dragon', 'shield', { guard: 1, block: 1, hp: 1, power: .06 }, '#2a2430', 'מגן הדרקון השחור', 'Black Dragon Shield', 'מגן קשקשים שחור בצורת עפיפון, וגולגולת דרקון עם עיני אש במרכזו.', "A black scaled kite shield, a dragon's skull with eyes of fire at its heart.");
}
setGear();
export const GEAR = Object.fromEntries(Object.values(RAWG).map((x) => [x.id, finalizeGear(x)]));
wingedFlags(GEAR); // (shops.js / drops.js / encounters.js: a `set` piece is kept off the traders' tables and out of ordinary drops)
// shields: the model each one wears (makeShield); the two that come with gifts are never sold
for (const x of Object.values(GEAR)) if (x.slot === 'shield') x.kind = (x.model || x.id).slice(7);
GEAR.shield_crescent.gift = GEAR.shield_shell.gift = true;
for (const id of Object.keys(GEAR)) for (const g of [1, 2]) gearVariant(GEAR[id], g); // (the Epic and Legendary form of every piece, after the gift / set flags above so they carry them)
export const SHIELD_GEAR = Object.values(GEAR).filter((x) => x.slot === 'shield').sort((a, b) => a.minLevel - b.minLevel).map((x) => x.id); // low to high
// round 30 (Roy: her own dress stayed in the bag and the black one vanished when she changed back): V's two dresses are
// body pieces of their own, both kept for good once she has the black one (main.js), worn in the body slot like a
// cuirass. No model and no bonus: they only choose what she wears under everything (models.js setDress). An empty body
// slot is the black battle dress, as before
const OUTFIT_ICON = {};
// round 33 (GEAR, stage 8): her two dresses drawn as V wears them now (js/models.js refineV): 6-tone ramps, cool violet
// shade and warm light, the finishes (gold neck band, crossed lacing, studded belt, strap ends with rivets, the accent hem)
const outfitIcon = (k) => OUTFIT_ICON[k] ??= (() => {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d', { willReadFrequently: true });
    const R = (col, a, b, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const shape = (rows, fill) => { for (const [y, x0, x1] of rows) for (let xx = x0; xx <= x1; xx++) R(fill(xx, y, x0, x1), xx, y); };
    if (k === 'war') { // the black battle dress
      const D = ['#0c0a12', '#16131e', '#211c2c', '#2e273c', '#40374f', '#5a4d66'], G = ramp('#e8b84a', 6), CR = ramp('#a8203a', 6), BR = ramp('#a86a2a', 6);
      // bronze shoulder guards
      for (const sx of [0, 1]) { const ox = sx ? 31 : 10; shape([[7, ox + 2, ox + 5], [8, ox + 1, ox + 6], [9, ox, ox + 7], [10, ox, ox + 7], [11, ox, ox + 7], [12, ox, ox + 7], [13, ox + 1, ox + 6]], (xx, y, x0, x1) => (y === 7 ? BR[4] : y === 13 ? BR[1] : xx === x0 ? (sx ? BR[2] : BR[4]) : xx === x1 ? BR[1] : y < 10 ? BR[4] : y === 12 ? BR[2] : BR[3])); R(BR[5], ox + 2, 8); R(BR[5], ox + 3, 8); for (const rx of [ox + 2, ox + 5]) { R(G[4], rx, 11); R(G[1], rx + 1, 12); } }
      // the bodice: narrow at the waist, lit on its left
      const bod = []; for (let y = 7; y <= 23; y++) { const w = y < 12 ? 9 : y < 19 ? 8 - ((y - 12) >> 2) : 7; bod.push([y, 24 - w, 23 + w]); }
      shape(bod, (xx, y, x0, x1) => (xx === x0 ? D[1] : xx === x1 ? D[0] : xx < x0 + 3 ? D[4] : xx > x1 - 3 ? D[2] : (xx + y) % 5 ? D[3] : D[2]));
      for (let xx = 17; xx <= 30; xx++) R(xx < 20 || xx > 27 ? G[3] : G[4], xx, 7); for (let xx = 18; xx <= 29; xx++) R(G[1], xx, 8); R(G[5], 18, 7); // gold neck band
      for (let y = 10; y <= 20; y += 2) { R(BR[4], 22, y); R(BR[4], 25, y); R(BR[3], 23, y + 1); R(BR[3], 24, y + 1); R(D[0], 23, y); R(D[0], 24, y); } // the crossed lacing
      // the belt with studs and a buckle
      for (let xx = 16; xx <= 31; xx++) { R('#5a5260', xx, 23); R('#3a3442', xx, 24); R('#24202c', xx, 25); } for (let xx = 18; xx <= 30; xx += 3) { R('#c8c4cc', xx, 24); R('#8a8492', xx + 1, 24); }
      R(G[3], 22, 23, 4, 3); R(G[5], 22, 23); R(G[1], 25, 25); R('#24202c', 23, 24, 2, 1);
      for (let y = 26; y <= 40; y++) { const w = 8 + Math.round((y - 26) * .62); for (let xx = 24 - w; xx < 24 + w; xx++) R(xx < 24 - w + 2 ? D[1] : D[0], xx, y); } // the underskirt
      // the skirt: strap panels fanning out, lit and shaded, rivets at their ends, the crimson hem below
      for (let i = 0; i < 7; i++) { const x0 = 14 + i * 3 - (i < 3 ? 3 - i : 0) + (i > 3 ? i - 3 : 0); for (let y = 26; y <= 40; y++) { const dx = Math.round((i - 3) * (y - 26) / 12); const col = y === 26 ? D[1] : i % 2 ? D[2] : D[3]; R(col, x0 + dx, y, 3, 1); R(D[0], x0 + dx + 2, y); if (y < 30 && i % 2 === 0) R(D[4], x0 + dx, y); } const ex = x0 + Math.round((i - 3) * 14 / 12); R(BR[4], ex + 1, 39); R(BR[2], ex + 1, 40); }
      for (let xx = 8; xx <= 39; xx++) { R(CR[3], xx, 41); R(CR[2], xx, 42); R(CR[1], xx, 43); if (xx % 4 === 0) R(CR[4], xx, 41); }
      for (let xx = 8; xx <= 39; xx++) R('#0a0810', xx, 44);
    } else { // her own: a long cream chiton, the sea-blue key at the hem, a rope belt, the saffron himation over a shoulder
      const W = ramp('#efe4cc', 6), S = ramp('#d89a3a', 6), B = ramp('#2f7f9a', 6), RP = ramp('#c8a060', 6);
      const ch = []; for (let y = 6; y <= 44; y++) { const w = y < 9 ? 7 : y < 24 ? 10 - (y > 18 ? 1 : 0) : 9 + Math.round((y - 24) * .55); ch.push([y, 24 - w, 23 + w]); }
      shape(ch, (xx, y, x0, x1) => { if (xx === x0) return W[1]; if (xx === x1) return W[0]; const f = (xx - x0) % 5; return y > 24 ? (f === 0 ? W[2] : f === 1 ? W[4] : xx > x1 - 3 ? W[2] : W[3]) : xx < x0 + 3 ? W[4] : xx > x1 - 3 ? W[2] : W[3]; }); // folds
      for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { const y = 7 + i, x0 = sx < 0 ? 13 - (i >> 1) : 31, w = 4 + (i >> 1); for (let j = 0; j < w; j++) R(i === 5 ? W[1] : j === 0 && sx < 0 ? W[2] : (j + i) % 3 ? W[3] : W[4], x0 + j, y); } // short draped sleeves
      for (let xx = 17; xx <= 30; xx++) R(W[5], xx, 6); for (let xx = 20; xx <= 27; xx++) R(W[1], xx, 7); R(W[1], 19, 6); R(W[1], 28, 6); // the neckline
      // the himation: a saffron band from her left shoulder to the right hip, folded, with a dark hem
      for (let i = 0; i < 18; i++) { const y = 7 + i, x0 = 15 + Math.round(i * .9); for (let j = 0; j < 5; j++) R(j === 0 ? S[4] : j === 4 ? S[1] : (i + j) % 4 ? S[3] : S[2], x0 + j, y); R(S[0], x0 + 5, y); }
      R('#e8b84a', 16, 8, 2, 2); R('#fff0a0', 16, 8); // a brooch
      for (let xx = 14; xx <= 33; xx++) { R(RP[3], xx, 24); R(RP[1], xx, 25); if (xx % 3 === 0) R(RP[5], xx, 24); } R(RP[3], 26, 26, 1, 4); R(RP[2], 27, 27, 1, 4); R(RP[4], 26, 30); // the rope belt and its tie
      // the sea-blue key at the hem
      const y0 = 38; for (let xx = 4; xx <= 43; xx++) { if (!ch.find(([y, a, b]) => y === y0 && xx >= a - 2 && xx <= b + 2)) continue; for (let y = y0; y <= 43; y++) R(B[3], xx, y); R(B[5], xx, y0); R(B[1], xx, 43); }
      const KEY = ['#####.', '....#.', '###.#.', '#...#.', '#.####'];
      for (let xx = 6; xx <= 41; xx++) for (let j = 0; j < 5; j++) if (KEY[j][xx % 6] === '#') R(W[4], xx, y0 + 1 + j);
      for (let xx = 4; xx <= 43; xx++) R('#1a3a4a', xx, 44);
    }
    if (DRESS_TONES[k]) { // BETA ONLINE (Roy 29.10): the leather and the dark one are the white one in one tone (models.js setDress)
      const T = parseInt(DRESS_TONES[k].slice(1), 16), tc = [T >> 16, (T >> 8) & 255, T & 255], im = x.getImageData(0, 0, 48, 48), d = im.data;
      for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const f = Math.min(1.15, (.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]) / 255 / .895), w = Math.max(0, f - 1) * .6; for (let j = 0; j < 3; j++) d[i + j] = Math.min(255, Math.round(tc[j] * Math.min(f, 1) + (255 - tc[j]) * w)); }
      x.putImageData(im, 0, 0);
    }
    return fitTile(c).toDataURL(); // (Roy 30.10: kept clear of the cell's edge, fitTile)
  } catch (e) { return null; }
})();
const OUTFIT = (id, look, rarity, name, desc) => (GEAR[id] = { id, slot: 'body', outfit: look, rarity: 'common', origin: rarity, grade: 0, baseId: id, minLevel: 1, ilvl: 1, bonus: {}, authBonus: {}, affixes: [], gift: true, color: look === 'war' ? '#1c1a22' : DRESS_TONES[look] || '#efe4cc', name, desc, iconURL: () => outfitIcon(look) });
OUTFIT('val_dress', 'home', 'rare', { he: 'השמלה של VAL', en: "Val's Dress" }, { he: 'החיטון השמנתי שלה מהבית, עם המפתח הכחול של הים בשוליים. בלי שריון, רק היא.', en: 'Her cream chiton from home, with the sea-blue key at the hem. No armour, just her.' });
OUTFIT('battle_dress', 'war', 'rare', { he: 'שמלת קרב שחורה', en: 'Black Battle Dress' }, { he: 'עור שחור ומגיני ארד. הבגד שלך לכל הדרך.', en: 'Black leather and bronze guards. Your clothes for the whole road.' });
// BETA ONLINE (Roy 29.10): the creator's other two outfits, the white dress's cut in light-brown leather and in dark cloth
// (js/online/appearance.js OUTFIT_ITEM; never the campaign's: OUTFITS below stays her two)
OUTFIT('leather_chiton', 'leather', 'rare', { he: 'שמלת עור בהירה', en: 'Light Leather Dress', es: 'Vestido de cuero claro' }, { he: 'עור חום בהיר, גזרה פשוטה. מה שבחרת ביום הראשון.', en: 'Light-brown leather, a simple cut. What you chose on the first day.', es: 'Cuero castaño claro, un corte sencillo. Lo que elegiste el primer día.' });
OUTFIT('dark_chiton', 'dark', 'rare', { he: 'שמלת בד כהה', en: 'Dark Cloth Dress', es: 'Vestido de tela oscura' }, { he: 'בד כהה, גזרה פשוטה. מה שבחרת ביום הראשון.', en: 'Dark cloth, a simple cut. What you chose on the first day.', es: 'Tela oscura, un corte sencillo. Lo que elegiste el primer día.' });
export const OUTFITS = ['battle_dress', 'val_dress'];
export const GEAR_BONUS_NAMES = {
  guard: { he: 'הגנה', en: 'Guard' }, hp: { he: 'חיים', en: 'HP' }, mp: { he: 'מאנה', en: 'Mana' }, power: { he: 'עוצמה', en: 'Power' },
  crit: { he: 'מכה קטלנית', en: 'Crit' }, mpRegen: { he: 'מאנה לשנייה', en: 'Mana/s' }, hpRegen: { he: 'חיים לשנייה', en: 'HP/s' },
  exp: { he: 'EXP', en: 'EXP' }, lifesteal: { he: 'שאיבת חיים', en: 'Lifesteal' }, speed: { he: 'מהירות', en: 'Speed' },
  ice: { he: 'אחיזה בקרח', en: 'Ice grip' }, block: { he: 'חסימה', en: 'Block' },
};

// ---------------------------------------------------------------------------------------------
// geometry helpers (all weapon parts live in the x-z plane: x across the blade, z along it, y is thickness)
// ---------------------------------------------------------------------------------------------
const gcache = new Map();
const cached = (key, make) => { let g = gcache.get(key); if (!g) { g = make(); gcache.set(key, g); } return g; };
function flatGeo(pts, depth) {
  const key = 'f' + depth.toFixed(4) + ':' + pts.map((p) => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(';');
  return cached(key, () => {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -depth / 2); g.rotateX(HP); // shape y -> +z, extrusion -> y
    g.userData.pts = pts; g.userData.key = key; // (round 33: the outline, for the shape-aware painting in pxArms)
    return g;
  });
}
const torusGeo = (r, t, a = PI * 2) => cached(`t${r},${t},${a}`, () => new THREE.TorusGeometry(r, t, 5, 14, a));
function M(parent, geo, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(geo, mat(color, opts && (opts.basic ? { basic: true } : opts.emissive ? { emissive: opts.emissive } : undefined)));
  m.position.set(x, y, z); m.castShadow = !(opts && (opts.noShadow || opts.basic)); parent.add(m); return m;
}
const flat = (p, pts, depth, color, opts) => M(p, flatGeo(pts, depth), color, 0, 0, 0, opts);
// tapered rod along z from z0 (radius rA) to z1 (radius rB)
function rod(p, rA, rB, z0, z1, color, seg = 7, opts, x = 0, y = 0) {
  const m = tcyl(p, rB, rA, z1 - z0, color, x, y, (z0 + z1) / 2, seg, opts); m.rotation.x = HP; m.userData.px = 'rod'; return m;
}
const band = (p, r, z, w, color, opts) => px(rod(p, r, r, z - w / 2, z + w / 2, color, 8, opts), 'band');
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// tapered rod between two points
function seg(p, a, b, rA, rB, color, n = 6, opts) {
  _a.set(...a); _b.set(...b);
  const m = tcyl(p, rB, rA, _a.distanceTo(_b), color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, n, opts);
  m.quaternion.setFromUnitVectors(_up, _b.sub(_a).normalize()); return m;
}
// a chain of segments through points (curved hafts, horns, tusks), radius tapering r0 -> r1
function chain(p, pts, r0, r1, color, n = 6, opts) {
  for (let i = 0; i < pts.length - 1; i++) {
    const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
    seg(p, pts[i], pts[i + 1], r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, color, n, opts);
    if (i > 0) ball(p, r0 + (r1 - r0) * t0, color, ...pts[i], 0, opts);
  }
}
// symmetric outline from its right half (base -> tip); a last point on x = 0 is the shared tip
function sym(half) {
  const tip = half[half.length - 1][0] === 0;
  const left = half.slice(0, tip ? -1 : undefined).reverse().map(([x, z]) => [-x, z]);
  return [...half, ...left];
}
const mirrorX = (pts) => pts.map(([x, z]) => [-x, z]).reverse();
// inward offset of a polygon by d (miter, clamped at sharp tips)
function inset(pts, d) {
  const n = pts.length; let A = 0;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
  const s = A > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let ex = p[0] - a[0], ez = p[1] - a[1], l = Math.hypot(ex, ez) || 1; ex /= l; ez /= l;
    let fx = b[0] - p[0], fz = b[1] - p[1]; l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const n1x = -ez * s, n1z = ex * s, n2x = -fz * s, n2z = fx * s;
    let mx = n1x + n2x, mz = n1z + n2z; l = Math.hypot(mx, mz);
    if (l < 1e-5) { mx = n1x; mz = n1z; l = 1; }
    mx /= l; mz /= l;
    const c = Math.max(.4, mx * n1x + mz * n1z);
    return [p[0] + mx * d / c, p[1] + mz * d / c];
  });
}
const noOL = (m) => { m.userData.noOutline = true; return m; };
const px = (m, role) => { m.userData.px = role; return m; }; // the part's role for the pixel-art dressing (pxArms)
// a blade: bright edge plate + a slightly thicker, darker inset core (reads as a bevelled edge), optional fuller
function blade(p, pts, edge, core, o = {}) {
  const t = o.t ?? .03, d = o.inset ?? .017;
  const e = px(flat(p, pts, t, edge, o.edgeGlow ? { basic: true } : { emissive: o.edgeEm ?? '#262626' }), 'edge');
  const c = px(noOL(flat(p, inset(pts, d), t + .014, core, o.coreGlow ? { basic: true } : o.coreEm ? { emissive: o.coreEm } : undefined)), 'core');
  const xs = pts.map((q) => q[0]), lo = Math.min(...xs), hi = Math.max(...xs); c.userData.pxRidge = lo < 0 && hi > 0 && Math.abs(lo + hi) < .3 * (hi - lo); // a symmetric blade: two-tone with a ridge
  if (o.fuller) { const [col, z0, z1, w, glow, x = 0] = o.fuller; px(noOL(box(p, w, t + .024, z1 - z0, col, x, 0, (z0 + z1) / 2, glow ? { basic: true } : { noShadow: true })), 'fuller'); }
  return { e, c };
}
// a flat plate (guards, wings, axe heads) with an outline-only edge colour
function plate(p, pts, t, color, edge, d = .014, o) {
  if (!edge) return px(flat(p, pts, t, color, o), 'plate');
  px(flat(p, pts, t, edge, { emissive: '#1e1e1e' }), 'pedge');
  return px(noOL(flat(p, inset(pts, d), t + .012, color, o)), 'plate');
}
function arc(cx, cz, r, a0, a1, n) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return o; }

// palette
const P = {
  leather: '#3a2618', leatherD: '#24170f', wood: '#6e4a2c', woodL: '#8f6a42', woodD: '#4a3020',
  bronze: '#c08436', bronzeL: '#f4cc7c', bronzeD: '#8a5a24', gold: '#e8b840', goldL: '#ffe490', goldD: '#a8781e',
  steel: '#aab3c0', steelL: '#eef2f6', steelD: '#76808e', iron: '#4a4852', ironD: '#2e2c34', silver: '#cfd6e0',
  bone: '#e6dfcc', red: '#a82a24',
};
// a leather-wrapped grip with darker wraps
function grip(p, z0, z1, r = .032, c = P.leather, wrap = P.leatherD, n = 3) {
  px(rod(p, r, r, z0, z1, c, 7), 'grip');
  for (let i = 0; i < n; i++) px(band(p, r + .005, z0 + (z1 - z0) * (i + .5) / n, .022, wrap, { noShadow: true }), 'wrap');
}

// ---------------------------------------------------------------------------------------------
// weapon builders (g is the group, grip at origin, +z toward the tip)
// ---------------------------------------------------------------------------------------------
const BUILD = {
  village_spear(g) { // the starter: ash shaft, bronze leaf head, butt spike, hide wraps where her two hands hold it
    rod(g, .026, .026, -.52, 1.5, '#a07c52', 6);
    // the rear wrap sits where her rear hand closes near the butt (equipWeapon's gripZ puts it at about -.4..-.16)
    grip(g, -.4, -.16, .032, '#5a3a26', '#3a2418', 2); grip(g, .36, .6, .031, '#5a3a26', '#3a2418', 2);
    rod(g, .034, .006, -.52, -.74, P.bronzeD, 4); band(g, .036, -.52, .035, P.bronzeD);
    rod(g, .026, .036, 1.44, 1.58, P.bronzeD, 7); band(g, .039, 1.47, .025, '#3a2418', { noShadow: true });
    blade(g, sym([[.02, 1.56], [.068, 1.7], [.06, 1.84], [0, 2.0]]), P.bronzeL, P.bronze, { fuller: [P.bronzeD, 1.59, 1.9, .014] });
  },
  village_blade(g) { // Philon's sword (id kept for saves): models.sword with a touch more detail
    grip(g, -.1, .13, .03, '#3a2a20', '#2a1c14');
    ball(g, .048, '#80858f', 0, 0, -.13, 0);
    box(g, .25, .05, .06, '#80858f', 0, 0, .15);
    blade(g, sym([[.044, .17], [.046, .82], [0, .98]]), '#e4e8ee', '#b4bac6', { fuller: ['#8c95a3', .22, .76, .016] });
  },
  // BETA ONLINE only (js/online/axe.js registers its weapon record in online mode; the campaign never lists it): the
  // village smithy's one-handed axe, the online starter beside the sword and the spear. An ash haft with hide wraps at the
  // hand, bronze collars, a bronze bearded bit (the village spear's bronze) with a short square poll behind it
  village_axe(g) {
    rod(g, .029, .026, -.16, .8, '#a07c52', 7);
    grip(g, -.13, .14, .033, '#5a3a26', '#3a2418', 3);
    ball(g, .04, P.bronzeD, 0, 0, -.17, 0);
    band(g, .035, .5, .026, P.bronzeD); band(g, .035, .76, .03, P.bronzeD);
    box(g, .06, .07, .2, P.bronzeD, 0, 0, .64); // the socket the haft goes through
    blade(g, [[.03, .58], [.09, .56], [.15, .5], [.21, .47], [.245, .55], [.255, .66], [.245, .77], [.2, .8], [.13, .75], [.08, .72], [.03, .71]], P.bronzeL, P.bronze, { inset: .018 });
    box(g, .07, .06, .08, P.bronze, -.06, 0, .645); // the poll
    cone(g, .028, .08, P.bronzeD, 0, 0, .83, 4).rotation.x = HP;
  },
  bronze_kopis(g) {
    grip(g, -.1, .13, .032);
    flat(g, [[-.032, -.09], [.032, -.09], [.04, -.15], [.0, -.2], [-.07, -.19], [-.09, -.14], [-.05, -.13]], .055, P.bronze); // bird-head pommel
    box(g, .17, .055, .05, P.bronzeD, 0, 0, .155);
    blade(g, [[-.032, .17], [-.042, .38], [-.036, .58], [-.012, .76], [.04, .9], [.11, .99], [.135, .88], [.138, .72], [.115, .54], [.075, .38], [.04, .26], [.036, .17]],
      P.bronzeL, P.bronze, { fuller: [P.bronzeD, .22, .62, .014, false, -.012] });
  },
  olive_club(g) {
    grip(g, -.14, .14, .036, '#4a2e1c', '#2e1c12');
    ball(g, .045, P.bronze, 0, 0, -.16, 0);
    band(g, .045, .17, .04, P.bronze);
    rod(g, .045, .1, .19, .92, '#7a5634', 8);
    const end = ball(g, .108, '#7a5634', 0, 0, .93, 1); end.scale.z = .8;
    for (const [a, z, r] of [[.4, .35, .035], [2.6, .5, .045], [4.4, .62, .05], [1.2, .74, .05], [3.4, .84, .05], [5.6, .8, .045]]) {
      const rr = .05 + (z - .19) / .73 * .05; ball(g, r, '#5e3f22', Math.cos(a) * rr, Math.sin(a) * rr, z, 0);
    }
    for (let i = 0; i < 10; i++) { // bronze studs
      const a = i * 2.4, z = .42 + (i % 5) * .11, rr = .055 + (z - .19) / .73 * .05;
      const c = cone(g, .022, .07, P.bronzeL, Math.cos(a) * rr, Math.sin(a) * rr, z, 4, { noShadow: true });
      c.quaternion.setFromUnitVectors(_up, _a.set(Math.cos(a), Math.sin(a), 0));
    }
    for (const sx of [-1, 1]) { const lf = flat(g, [[0, 0], [.03 * sx, .05], [.012 * sx, .11], [-.01 * sx, .05]], .012, '#7f9a44'); lf.position.set(.04 * sx, .02, .16); lf.rotation.y = -.5 * sx; }
  },
  hoplite_dory(g) {
    rod(g, .028, .028, -.58, 1.46, '#8a6640', 6);
    grip(g, -.13, .13, .034, '#5a3a26', '#3a2418');
    band(g, .036, -.15, .02, P.bronze); band(g, .036, .15, .02, P.bronze);
    rod(g, .04, .006, -.58, -.86, P.bronze, 4); band(g, .04, -.58, .04, P.bronzeD);
    rod(g, .03, .04, 1.4, 1.56, P.bronzeD, 7);
    blade(g, sym([[.022, 1.53], [.075, 1.68], [.072, 1.82], [0, 2.02]]), P.steelL, P.steel, { fuller: [P.steelD, 1.56, 1.92, .016] });
    for (let i = 0; i < 3; i++) { const c = cone(g, .026, .16, '#b8322c', (i - 1) * .024, -.02, 1.36, 4); c.rotation.x = -HP + (i - 1) * .1; }
  },
  harbor_daggers(g) {
    rod(g, .03, .03, -.1, .1, '#7a5c3a', 7);
    for (let i = 0; i < 4; i++) band(g, .035, -.08 + i * .053, .02, '#3c6e9a', { noShadow: true });
    ball(g, .04, P.bronze, 0, 0, -.13, 0);
    box(g, .15, .045, .045, P.bronze, 0, 0, .12); ball(g, .028, P.bronze, .08, 0, .12, 0); ball(g, .028, P.bronze, -.08, 0, .12, 0);
    blade(g, sym([[.034, .14], [.052, .27], [.042, .44], [0, .6]]), '#e9eef3', '#a7b2be', { fuller: ['#7d8896', .17, .44, .012] });
  },
  minoan_labrys(g) {
    rod(g, .03, .03, -.16, .82, '#5c3a22', 7);
    grip(g, -.14, .12, .034);
    band(g, .036, .25, .025, P.gold); band(g, .036, .45, .025, P.gold);
    box(g, .075, .075, .22, P.goldD, 0, 0, .66);
    const wing = [[.035, .6], [.1, .565], [.18, .5], [.27, .44], [.3, .55], [.31, .66], [.3, .77], [.27, .88], [.18, .82], [.1, .76], [.035, .72]];
    blade(g, wing, P.bronzeL, P.bronze, { inset: .02 });
    blade(g, mirrorX(wing), P.bronzeL, P.bronze, { inset: .02 });
    for (const sx of [-1, 1]) noOL(cyl0(g, .045, .05, P.red, sx * .2, 0, .66, 'y'));
    cone(g, .03, .14, P.gold, 0, 0, .83, 4).rotation.x = HP;
  },
  cyclops_maul(g) {
    rod(g, .046, .05, -.38, 1.14, '#5e4128', 7);
    grip(g, -.34, .14, .052, P.leather, P.leatherD, 4);
    rod(g, .06, .03, -.38, -.46, P.bronze, 6);
    const st = box(g, .38, .32, .44, '#8f877a', 0, 0, 1.32); st.rotation.z = .08;
    box(g, .3, .36, .3, '#7d7568', .04, 0, 1.36).rotation.y = .12;
    box(g, .26, .26, .2, '#9a9284', -.06, .03, 1.54).rotation.x = .2;
    for (const z of [1.18, 1.46]) box(g, .42, .36, .06, P.bronze, 0, 0, z);
    for (const sy of [-1, 1]) { // the carved eye on both faces
      noOL(cyl0(g, .1, .03, P.bronzeD, 0, .17 * sy, 1.32, 'y'));
      noOL(cyl0(g, .08, .04, '#efe9da', 0, .175 * sy, 1.32, 'y'));
      noOL(cyl0(g, .04, .05, '#7a2a1a', 0, .18 * sy, 1.32, 'y'));
      noOL(cyl0(g, .018, .056, '#140c0a', 0, .182 * sy, 1.32, 'y'));
    }
    for (const x of [-.12, .12]) cone(g, .04, .12, P.bronzeL, x, 0, 1.64, 4).rotation.x = HP;
  },
  amazon_sagaris(g) {
    rod(g, .027, .027, -.12, .66, '#8a2e24', 7);
    grip(g, -.12, .1, .031, P.leatherD, '#140c08');
    for (const z of [.16, .3, .44]) band(g, .032, z, .022, P.gold);
    box(g, .065, .065, .17, P.gold, 0, 0, .58);
    blade(g, [[.03, .53], [.11, .49], [.2, .42], [.245, .52], [.25, .62], [.22, .74], [.12, .68], [.03, .64]], P.steelL, P.steel, { inset: .018 });
    const sp = cone(g, .032, .22, P.steel, -.13, 0, .585, 4); sp.rotation.z = HP;
    cone(g, .022, .1, P.gold, 0, 0, .7, 4).rotation.x = HP;
  },
  hermes_blades(g) {
    grip(g, -.1, .1, .029, '#2a3a6a', '#16203e');
    ball(g, .042, P.gold, 0, 0, -.13, 0);
    box(g, .1, .045, .045, P.gold, 0, 0, .12);
    for (const sx of [-1, 1]) {
      const wp = pivot(g, .04 * sx, 0, .11); wp.rotation.z = .35 * sx;
      const pts = [[0, .0], [.06, .05], [.15, .1], [.24, .1], [.2, .06], [.25, .04], [.18, .02], [.21, -.01], [.13, -.01], [.14, -.04], [.06, -.02]];
      plate(wp, sx > 0 ? pts : mirrorX(pts), .02, '#f4f6fa', P.gold, .012);
    }
    blade(g, sym([[.03, .14], [.044, .3], [.034, .5], [0, .66]]), '#ffffff', '#ccd6e2', { fuller: [P.gold, .17, .5, .014] });
  },
  perseus_harpe(g) {
    grip(g, -.1, .13, .031, '#1e1a22', '#0e0c10');
    for (const z of [-.06, .08]) band(g, .035, z, .018, P.gold, { noShadow: true });
    const pm = cyl0(g, .055, .03, P.gold, 0, 0, -.13, 'z'); pm.castShadow = true;
    box(g, .15, .05, .05, P.gold, 0, 0, .155);
    blade(g, [[-.036, .17], [-.036, .74], [-.024, .9], [0, 1.0], [.02, .9], [.034, .8], [.09, .83], [.17, .82], [.235, .76], [.27, .66], [.262, .55], [.226, .6], [.18, .67], [.12, .7], [.07, .66], [.04, .58], [.036, .17]],
      '#e6eef8', '#94a2b8', { inset: .016 });
  },
  asterion_axe(g) {
    rod(g, .045, .045, -.46, 1.4, P.woodD, 7);
    grip(g, -.42, .1, .05, P.leather, P.leatherD, 4);
    for (const z of [.22, .42, .62]) band(g, .05, z, .04, '#9a2a22');
    rod(g, .055, .01, -.46, -.62, P.bronzeD, 4);
    box(g, .11, .11, .38, P.bronzeD, 0, 0, 1.12);
    const wing = [[.05, .92], [.18, .86], [.34, .76], [.47, .7], [.53, .88], [.555, 1.06], [.53, 1.26], [.47, 1.46], [.34, 1.4], [.18, 1.3], [.05, 1.24]];
    blade(g, wing, '#f4c97a', '#a8702e', { inset: .028, t: .036 });
    blade(g, mirrorX(wing), '#f4c97a', '#a8702e', { inset: .028, t: .036 });
    for (const sx of [-1, 1]) { noOL(cyl0(g, .07, .06, '#8a1e1a', sx * .3, 0, 1.08, 'y')); noOL(cyl0(g, .035, .066, '#1e1210', sx * .3, 0, 1.08, 'y')); }
    for (const sx of [-1, 1]) chain(g, [[sx * .05, 0, 1.26], [sx * .16, 0, 1.38], [sx * .22, 0, 1.52], [sx * .19, 0, 1.66]], .05, .012, '#ece0c4', 6);
    cone(g, .04, .18, P.bronzeL, 0, 0, 1.38, 4).rotation.x = HP;
  },
  poseidon_trident(g) {
    rod(g, .03, .03, -.58, 1.42, '#24606c', 7);
    grip(g, -.13, .13, .036, '#1a2e4a', '#0e1a2c');
    for (let i = 0; i < 6; i++) band(g, .034, .24 + i * .2, .03, P.gold, { noShadow: true });
    rod(g, .04, .006, -.58, -.8, P.gold, 5);
    const cup = [...arc(0, 1.66, .2, PI * 1.05, PI * 1.95, 8), ...arc(0, 1.66, .14, PI * 1.95, PI * 1.05, 8)];
    plate(g, cup, .06, P.gold, P.goldL);
    rod(g, .045, .03, 1.38, 1.5, P.gold, 7);
    ball(g, .06, '#7fe8ff', 0, 0, 1.5, 1, { basic: true });
    const head = (x, z0, z1, flip) => {
      rod(g, .024, .02, z0, z1, '#bfe8f0', 6, undefined, x);
      const tip = [[.0, z1 - .02], [.055, z1 + .04], [.03, z1 + .03], [.02, z1 + .1], [0, z1 + .2]];
      const pts = sym(tip).map(([px, pz]) => [px * (flip || 1) + x, pz]);
      blade(g, pts, '#e6fbff', '#8ed6e6', { inset: .012, t: .026 });
      ball(g, .02, '#cff8ff', x + .05, 0, z1 + .04, 0, { basic: true }); ball(g, .02, '#cff8ff', x - .05, 0, z1 + .04, 0, { basic: true });
    };
    head(0, 1.5, 1.9); head(-.19, 1.62, 1.82); head(.19, 1.62, 1.82);
  },
  tide_trident(g) { // a short temple trident of green bronze, for one hand: the shell shield goes in the other
    rod(g, .027, .027, -.42, 1.0, '#3e7a68', 7);
    grip(g, -.13, .13, .034, '#24423a', '#14261f');
    for (const z of [.34, .66]) band(g, .033, z, .026, P.bronze, { noShadow: true });
    rod(g, .036, .006, -.42, -.6, P.bronzeD, 5);
    const cup = [...arc(0, 1.16, .16, PI * 1.05, PI * 1.95, 8), ...arc(0, 1.16, .11, PI * 1.95, PI * 1.05, 8)];
    plate(g, cup, .05, '#4f8a76', '#8ac8b0');
    rod(g, .04, .028, .96, 1.04, P.bronze, 7);
    ball(g, .045, '#8fffe0', 0, 0, 1.04, 1, { basic: true });
    const head = (x, z0, z1) => {
      rod(g, .02, .017, z0, z1, '#5f9a86', 6, undefined, x);
      blade(g, sym([[0, z1 - .02], [.045, z1 + .03], [.026, z1 + .025], [.016, z1 + .08], [0, z1 + .16]]).map(([px, pz]) => [px + x, pz]), '#d8f4ea', '#6ab49c', { inset: .01, t: .022 });
    };
    head(0, 1.02, 1.3); head(-.15, 1.13, 1.25); head(.15, 1.13, 1.25);
  },
  medusa_fangs(g) { // venom daggers dripping green
    rod(g, .031, .031, -.1, .11, '#2a4a2a', 7);
    for (let i = 0; i < 4; i++) band(g, .036, -.08 + i * .055, .02, '#18301a', { noShadow: true });
    const hd = ball(g, .05, '#4f8f44', 0, 0, -.14, 1); hd.scale.set(.9, .7, 1.2);
    cone(g, .035, .08, '#4f8f44', 0, 0, -.21, 4).rotation.x = -HP;
    for (const sx of [-1, 1]) box(g, .016, .016, .016, '#ffe14a', sx * .03, .03, -.17, { basic: true });
    box(g, .15, .045, .045, '#6a5a2a', 0, 0, .125);
    for (const sx of [-1, 1]) { const c = cone(g, .026, .07, '#6a5a2a', sx * .085, 0, .1, 4); c.rotation.x = PI; }
    const pts = [[.036, .14], [.052, .3], [.046, .46], [.022, .58], [0, .66], [-.03, .56], [-.052, .52], [-.036, .48], [-.058, .43], [-.04, .39], [-.06, .33], [-.042, .29], [-.056, .23], [-.04, .14]];
    blade(g, pts, '#b8d8a4', '#5e7a52', { inset: .016, fuller: ['#7dff4a', .2, .5, .016, true] });
    noOL(flat(g, [[-.026, .5], [.032, .48], [.02, .58], [0, .64], [-.02, .58]], .046, '#6aff3a', { basic: true }));
    for (const [x, z, l] of [[.054, .34, .06], [.048, .44, .09], [-.062, .4, .07], [.015, .66, .08]]) {
      const sx = Math.sign(x) || 0;
      if (sx) { noOL(box(g, l, .02, .02, '#6aff3a', x + sx * l / 2, 0, z, { basic: true })); ball(g, .02, '#9dff6a', x + sx * l, 0, z - .01, 0, { basic: true }); }
      else { noOL(box(g, .02, .02, l, '#6aff3a', 0, 0, z + l / 2, { basic: true })); ball(g, .022, '#9dff6a', 0, 0, z + l, 0, { basic: true }); }
    }
  },
  athena_xiphos(g) {
    grip(g, -.1, .13, .031, '#2a4a8a', '#16285a');
    const pm = ball(g, .05, P.gold, 0, 0, -.135, 1); pm.scale.set(1.1, .8, .9);
    box(g, .1, .05, .05, P.gold, 0, 0, .14);
    const wing = [[.03, .11], [.1, .12], [.17, .16], [.23, .24], [.2, .25], [.2, .2], [.15, .2], [.15, .17], [.09, .17], [.03, .17]];
    plate(g, wing, .03, P.gold, P.goldL, .01); plate(g, mirrorX(wing), .03, P.gold, P.goldL, .01);
    for (const sx of [-1, 1]) { noOL(cyl0(g, .028, .06, P.goldL, sx * .03, 0, .14, 'y')); box(g, .022, .066, .022, '#5ab8ff', sx * .03, 0, .14, { basic: true }); }
    blade(g, sym([[.042, .17], [.054, .36], [.07, .62], [.05, .82], [0, 1.0]]), '#fff6d6', '#dce2ec', { fuller: ['#ffe9a0', .22, .8, .018, true] });
  },
  hephaestus_hammer(g) {
    rod(g, .042, .046, -.4, 1.2, '#3c3a40', 7);
    grip(g, -.38, .12, .05, '#4a2a18', '#2a160c', 4);
    for (const z of [.3, .6, .9]) band(g, .05, z, .035, P.bronze);
    rod(g, .06, .05, -.4, -.47, P.bronze, 6); ball(g, .032, '#ff8a2a', 0, 0, -.49, 0, { basic: true });
    box(g, .46, .24, .28, '#46444c', 0, 0, 1.3);
    box(g, .12, .32, .36, '#3a3840', .27, 0, 1.3);
    flat(g, [[-.23, 1.17], [-.44, 1.27], [-.44, 1.33], [-.23, 1.43]], .22, '#3a3840');
    for (const x of [-.17, .17]) box(g, .05, .27, .31, P.bronze, x, 0, 1.3);
    noOL(box(g, .02, .36, .2, '#ffc040', .335, 0, 1.3, { basic: true }));
    noOL(box(g, .016, .33, .26, '#ff7a1a', .336, 0, 1.3, { basic: true }));
    for (const [x, z, w, r] of [[-.04, 1.27, .2, .5], [.06, 1.36, .14, -.7], [-.32, 1.3, .1, .2]]) { const c = noOL(box(g, w, .252, .022, '#ff7a1a', x, 0, z, { basic: true })); c.rotation.y = r; }
    rod(g, .06, .05, 1.16, 1.2, P.bronze, 7);
  },
  hades_axe(g) { // black double axe, skull and bat wings on the head (the reference sheet)
    rod(g, .045, .045, -.5, 1.44, '#1e1c24', 7);
    grip(g, -.42, .12, .05, '#2a2030', '#14101a', 4);
    for (const z of [.3, .55, .8]) band(g, .052, z, .035, '#8a8e9a');
    const bt = ball(g, .07, '#3a3a46', 0, 0, -.52, 1); bt.scale.z = 1.2;
    rod(g, .05, .006, -.55, -.78, '#8a8e9a', 4);
    box(g, .12, .12, .42, '#2a2a34', 0, 0, 1.18);
    const wing = [[.06, 1.0], [.18, .94], [.32, .86], [.49, .77], [.53, .9], [.565, 1.06], [.565, 1.26], [.53, 1.42], [.49, 1.56], [.32, 1.48], [.18, 1.4], [.06, 1.34]];
    blade(g, wing, '#b4bac8', '#2a2a34', { inset: .03, t: .04 });
    blade(g, mirrorX(wing), '#b4bac8', '#2a2a34', { inset: .03, t: .04 });
    const bat = [[.07, 1.1], [.14, 1.18], [.22, 1.28], [.34, 1.3], [.31, 1.22], [.37, 1.16], [.3, 1.14], [.29, 1.06], [.23, 1.1], [.18, 1.03], [.12, 1.08]];
    for (const sy of [-1, 1]) for (const pts of [bat, mirrorX(bat)]) { const b = noOL(flat(g, pts, .012, '#4a4a58')); b.position.y = sy * .029; }
    for (const sy of [-1, 1]) {
      const sk = noOL(ball(g, .1, P.bone, 0, sy * .03, 1.2, 1)); sk.scale.set(1, .55, 1.05);
      noOL(box(g, .1, .05, .06, P.bone, 0, sy * .035, 1.1));
      for (const sx of [-1, 1]) box(g, .035, .03, .035, '#c07cff', sx * .04, sy * .085, 1.22, { basic: true });
      noOL(box(g, .02, .02, .03, '#1a1418', 0, sy * .086, 1.16, { noShadow: true }));
    }
    rod(g, .05, .006, 1.38, 1.7, '#4a4a58', 5);
  },
  erinyes_sickles(g) { // twin flame swords
    grip(g, -.11, .11, .03, '#5a1a14', '#2a0c08');
    ball(g, .042, P.gold, 0, 0, -.14, 0);
    box(g, .2, .05, .05, P.gold, 0, 0, .13);
    for (const sx of [-1, 1]) { const c = cone(g, .03, .08, P.goldL, sx * .11, 0, .16, 4); c.rotation.z = -sx * .4; }
    const R = [[.04, .16], [.05, .26], [.11, .36], [.055, .37], [.05, .48], [.1, .6], [.048, .59], [.04, .7], [.08, .8], [.03, .8], [0, .97]];
    const L = [[-.03, .82], [-.07, .82], [-.035, .72], [-.05, .6], [-.1, .5], [-.052, .48], [-.05, .38], [-.095, .28], [-.05, .27], [-.04, .16]];
    blade(g, [...R, ...L], '#ff6a1a', '#ffc040', { inset: .022, edgeGlow: true, coreGlow: true, fuller: ['#fff6c0', .2, .74, .016, true] });
  },
  keraunos(g) { // Zeus' Horn Staff: a crystal horn crackling with lightning
    rod(g, .03, .03, -.6, 1.48, '#2c3348', 7);
    grip(g, -.44, -.2, .036, '#22305a', '#121a36'); // under the rear hand near the butt (equipWeapon's gripZ)
    for (let i = 0; i < 5; i++) band(g, .036, .3 + i * .22, .03, P.gold, { noShadow: true });
    crystal(g, [0, 0, -.6], [0, 0, -1], .2, .055, '#a8dcff');
    band(g, .045, -.6, .04, P.gold);
    rod(g, .036, .07, 1.4, 1.54, P.gold, 8);
    for (const a of [0, PI / 2, PI, PI * 1.5]) seg(g, [Math.cos(a) * .06, Math.sin(a) * .06, 1.52], [Math.cos(a) * .1, Math.sin(a) * .1, 1.66], .018, .012, P.goldL, 4);
    crystal(g, [0, 0, 1.52], [0, 0, 1], .62, .09, '#a8dcff', true);
    for (const [dx, dy, l] of [[.42, .12, .4], [-.42, -.1, .38], [.15, .42, .32], [-.12, -.42, .34], [.3, -.28, .26], [-.3, .3, .26]]) crystal(g, [dx * .12, dy * .12, 1.56], [dx, dy, 1], l, .05, '#c8ecff', true);
    const bolt = (pts, c) => { for (let i = 0; i < pts.length - 1; i++) seg(g, pts[i], pts[i + 1], .011, .011, c, 3, { basic: true }); };
    bolt([[.05, 0, 1.3], [.14, .03, 1.42], [.09, -.02, 1.55], [.2, .02, 1.7], [.14, 0, 1.82], [.24, .03, 1.96]], '#fff6b0');
    bolt([[-.05, 0, 1.36], [-.15, -.02, 1.5], [-.08, .02, 1.62], [-.19, 0, 1.78], [-.12, -.03, 1.9]], '#9fe8ff');
    bolt([[.03, .05, 1.1], [-.04, .1, 1.2], [.04, .08, 1.3], [-.02, .12, 1.42]], '#e8f8ff');
  },
  ares_warbringer(g) {
    grip(g, -.32, .18, .038, '#2a1a16', '#9a1e22', 5);
    const helm = ball(g, .075, P.bronze, 0, 0, -.42, 1); helm.scale.set(1, .95, 1.1);
    box(g, .1, .022, .04, '#140c0a', 0, .062, -.43, { noShadow: true });
    box(g, .03, .1, .05, '#140c0a', 0, .03, -.39, { noShadow: true });
    const crest = [[-.0, -.33], [.07, -.36], [.12, -.44], [.11, -.55], [.06, -.62], [.0, -.6], [.05, -.52], [.05, -.42]];
    const cr = flat(g, crest.map(([x, z]) => [z + .42, x]), .04, '#c0242c'); cr.rotation.y = -HP; cr.position.set(0, .06, -.42);
    box(g, .46, .065, .075, '#3a343c', 0, 0, .23);
    for (const sx of [-1, 1]) { const sp = cone(g, .035, .16, '#58505a', sx * .26, 0, .29, 4); sp.rotation.set(HP, 0, -sx * .5); }
    ball(g, .045, '#ff3040', 0, 0, .23, 1, { basic: true });
    blade(g, sym([[.1, .27], [.112, .5], [.098, 1.3], [.072, 1.5], [0, 1.74]]), '#ff4a2a', '#3e3842', { inset: .024, t: .036, edgeGlow: true, fuller: ['#e8202e', .32, 1.36, .022, true] });
  },
  keres_scythe(g) { // black haft wound with bone, a curved violet-edged blade, a skull at the joint
    chain(g, [[0, 0, -.5], [0, 0, .3], [.02, 0, 1.0], [0, 0, 1.6]], .034, .03, '#1a1622', 6);
    grip(g, -.4, -.16, .038, '#2a1e30', '#9a7ad8'); // under the rear hand near the butt (equipWeapon's gripZ)
    for (const z of [.45, .95, 1.35]) band(g, .04, z, .03, P.bone, { noShadow: true });
    rod(g, .045, .006, -.5, -.74, '#6a5a8a', 4);
    const outer = [[-.04, 1.5], [.0, 1.66], [.18, 1.78], [.44, 1.82], [.7, 1.74], [.9, 1.56], [1.02, 1.32]];
    const inner = [[.86, 1.48], [.64, 1.62], [.4, 1.66], [.18, 1.6], [.02, 1.48]];
    blade(g, [...outer, ...inner], '#c8a8ff', '#1e1828', { inset: .028, t: .036, edgeGlow: true });
    const sk = noOL(ball(g, .085, P.bone, 0, 0, 1.52, 1)); sk.scale.set(1, .8, 1.1);
    for (const sx of [-1, 1]) noOL(box(g, .026, .03, .02, '#b48cff', sx * .032, .07, 1.53, { basic: true }));
  },
  kronos_scythe(g) {
    chain(g, [[0, 0, -.5], [0, 0, .2], [.035, 0, .9], [.01, 0, 1.45], [-.04, 0, 1.78]], .032, .028, '#2c2430', 6);
    grip(g, -.38, -.14, .037, '#1e1622', '#d8b04a'); // under the rear hand near the butt (equipWeapon's gripZ)
    for (const z of [.5, 1.1]) band(g, .036, z, .03, P.gold, { noShadow: true });
    seg(g, [.03, 0, .62], [-.16, 0, .7], .02, .018, P.woodD, 5); ball(g, .025, P.gold, -.16, 0, .7, 0);
    rod(g, .045, .006, -.5, -.72, P.gold, 4);
    const outer = [[-.06, 1.7], [-.02, 1.84], [.14, 1.94], [.4, 1.98], [.66, 1.92], [.86, 1.78], [1.0, 1.56]];
    const inner = [[.84, 1.7], [.62, 1.79], [.38, 1.82], [.16, 1.77], [.0, 1.66]];
    const sc = [...outer, ...inner];
    blade(g, sc, '#e6d2ff', '#2e2448', { inset: .026, t: .034, edgeGlow: true });
    for (const [x, z] of [[.2, 1.86], [.42, 1.9], [.6, 1.85], [.33, 1.86], [.75, 1.76]]) noOL(box(g, .018, .056, .018, '#ffffff', x, 0, z, { basic: true }));
    const hg = pivot(g, -.03, 0, 1.66); // hourglass at the joint
    for (const sz of [-1, 1]) { cyl0(hg, .06, .02, P.gold, 0, 0, sz * .09, 'z'); const c = cone(hg, .045, .08, '#ffd080', 0, 0, sz * .04, 6, { basic: true }); c.rotation.x = sz > 0 ? -HP : HP; }
    for (const sx of [-1, 1]) seg(hg, [sx * .05, 0, -.09], [sx * .05, 0, .09], .008, .008, P.goldD, 4);
  },
  // round 22 (Roy): the black dragon's fangs; round 26 (Roy: "bigger and more impressive"): ~45% longer and half again as broad.
  // Each is one fang of the black dragon: a black blade whose belly swells and hooks back to the point like a tooth, a saw of
  // smaller fangs down the spine, an ember fuller with burning runes, dragon scales over the ricasso, the blade coming out of
  // a horned dragon's open jaws over spread wings, and a claw gripping an ember for a pommel (the left one is the mirror image)
  dragon_fangs(g) {
    const BK = '#221c26', BE = '#4a4052', SC = '#3a2e3e', EM = '#ff5a3a', HOT = '#ffc070', FANG = '#d8ccb0';
    grip(g, -.13, .13, .033, '#1a1014', '#8a1a1e', 4);
    band(g, .04, .135, .03, BE);
    // pommel: three talons round an ember
    ball(g, .052, EM, 0, 0, -.2, 1, { basic: true });
    band(g, .042, -.14, .03, BE);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * PI * 2 + .5, c = Math.cos(a), sn = Math.sin(a);
      seg(g, [c * .024, sn * .024, -.13], [c * .062, sn * .062, -.19], .016, .011, BK, 4);
      seg(g, [c * .062, sn * .062, -.19], [c * .04, sn * .04, -.255], .011, .004, FANG, 4, { noShadow: true });
    }
    // guard: spread dragon wings, scaled, with a scalloped trailing edge
    const wing = [[.04, .13], [.1, .12], [.17, .14], [.24, .19], [.29, .27], [.25, .25], [.22, .27], [.18, .23], [.15, .26], [.11, .22], [.07, .26], [.035, .25]];
    plate(g, [...wing, ...mirrorX(wing)], .042, SC, BE, .016);
    for (const sx of [-1, 1]) seg(g, [sx * .05, 0, .14], [sx * .29, 0, .275], .016, .008, BE, 4); // the wing's bone
    // the dragon's head at the crossing: a skull with ember eyes on both faces, swept-back horns, and open jaws the blade comes out of
    const hd = ball(g, .07, BK, 0, 0, .19, 1); hd.scale.set(1.05, .85, 1.15);
    for (const sy of [-1, 1]) for (const sx of [-1, 1]) noOL(box(g, .026, .016, .016, EM, sx * .032, sy * .058, .2, { basic: true }));
    for (const sx of [-1, 1]) {
      chain(g, [[sx * .05, 0, .21], [sx * .12, 0, .15], [sx * .16, 0, .06]], .02, .004, FANG, 4); // horns swept back toward the hand
      flat(g, [[sx * .045, .22], [sx * .095, .25], [sx * .09, .33], [sx * .06, .3]], .05, BK); // the open jaw on each side of the blade
      for (const z of [.26, .3]) { const t = cone(g, .01, .035, FANG, sx * .066, 0, z, 4, { noShadow: true }); t.rotation.z = sx * HP; } // its teeth bite the blade
    }
    // the blade: a fang (cutting belly on +x, hooked point, straight spine on -x)
    const B = [[.05, .26], [.082, .38], [.108, .54], [.122, .72], [.12, .9], [.104, 1.06], [.076, 1.2], [.036, 1.31], [-.03, 1.4], [-.052, 1.3], [-.058, 1.16], [-.06, .26]];
    blade(g, B, '#6a6a74', '#1a1014', { inset: .024, t: .036, edgeEm: '#1e1416', fuller: [EM, .32, 1.12, .02, true, .026] });
    // burning runes along the fuller
    for (const [z, r] of [[.42, .5], [.58, -.6], [.74, .4], [.9, -.5], [1.04, .6]]) {
      for (const k of [0, 1.1]) { const m = noOL(box(g, .009, .066, .05, HOT, .026, 0, z, { basic: true })); m.rotation.y = r + k; }
    }
    // the saw of smaller fangs down the spine, biggest at the root
    for (let i = 0; i < 7; i++) {
      const z = .32 + i * .12, k = 1 - i * .07;
      plate(g, [[-.054, z], [-.054 - .05 * k, z + .085 * k], [-.054, z + .1 * k]], .026, BE, '#6a5e74', .008);
    }
    // dragon scales over the ricasso, on both faces
    for (const [x, z] of [[.0, .3], [.06, .3], [.03, .35], [-.03, .35], [.075, .4]]) {
      noOL(flat(g, [[x, z - .03], [x + .024, z], [x, z + .03], [x - .024, z]], .052, SC));
    }
  },
  sun_and_moon: {
    right(g) { // Apollo's sun blade
      grip(g, -.1, .1, .03, '#f0e2c0', P.gold);
      ball(g, .04, '#ffd25a', 0, 0, -.13, 0, { basic: true });
      noOL(cyl0(g, .085, .045, P.gold, 0, 0, .14, 'y')).castShadow = true;
      ball(g, .045, '#fff0a0', 0, 0, .14, 0, { basic: true }).scale.y = .7;
      for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; const r = cone(g, .025, .08, P.goldL, Math.cos(a) * .11, 0, .14 + Math.sin(a) * .11, 4, { noShadow: true }); r.rotation.z = 0; r.quaternion.setFromUnitVectors(_up, _a.set(Math.cos(a), 0, Math.sin(a))); }
      blade(g, [[-.034, .2], [-.046, .4], [-.03, .58], [.025, .76], [.052, .58], [.05, .38], [.036, .2]], '#fff1a8', '#e9b23a', { inset: .016, edgeGlow: true });
    },
    left(g) { // Artemis' moon blade
      grip(g, -.1, .1, .03, '#26305a', P.silver);
      ball(g, .04, P.silver, 0, 0, -.13, 0);
      plate(g, [...arc(0, .1, .13, .15 * PI, .85 * PI, 7), ...arc(0, .155, .1, .82 * PI, .18 * PI, 7)], .035, '#c8d4e4', '#f2f8ff', .01);
      ball(g, .035, '#d8ecff', 0, 0, .16, 0, { basic: true });
      blade(g, [[-.036, .2], [-.075, .36], [-.088, .52], [-.06, .66], [0, .76], [-.012, .62], [-.016, .48], [.004, .34], [.036, .2]], '#e6f4ff', '#93a8c8', { inset: .015, edgeGlow: true });
    },
  },
};
// short cylinder (disc) with its axis along x, y or z
function cyl0(p, r, h, color, x = 0, y = 0, z = 0, axis = 'y', opts) {
  const m = tcyl(p, r, r, h, color, x, y, z, 12, opts);
  if (axis === 'x') m.rotation.z = HP; else if (axis === 'z') m.rotation.x = HP;
  return m;
}

// ---------------------------------------------------------------------------------------------
// shields (makeWeapon(id).left for sword and spear styles): built in the left hand's space so that,
// attached to rig.handL with no offset, the centre sits where V's built-in shield sits (-.1, .2, .02),
// face pointing out of the arm (-x)
// ---------------------------------------------------------------------------------------------
const crystalGeo = () => cached('octa', () => new THREE.OctahedronGeometry(1, 0));
// an elongated crystal from `base` along `dir` (len, radius r); glow adds a bright core
function crystal(p, base, dir, len, r, color, glow) {
  _b.set(...dir).normalize();
  const m = M(p, crystalGeo(), color, base[0] + _b.x * len / 2, base[1] + _b.y * len / 2, base[2] + _b.z * len / 2, { emissive: '#1a3a5a' });
  m.scale.set(r, len / 2, r); m.quaternion.setFromUnitVectors(_up, _b);
  if (glow) { const c = noOL(M(p, crystalGeo(), '#f0fbff', m.position.x, m.position.y, m.position.z, { basic: true })); c.scale.set(r * .45, len * .42, r * .45); c.quaternion.copy(m.quaternion); }
  return m;
}
const SHIELD_BUILD = {
  round(F) { // bronze hoplite aspis with a Spartan lambda
    const d = px(ball(F, .42, '#c08436', 0, 0, 0, 2), 'shieldface'); d.scale.set(1, .2, 1);
    const rim = M(F, torusGeo(.42, .035), '#e8b860', 0, 0, 0, { emissive: '#2a1a00' }); rim.rotation.x = HP; rim.castShadow = true;
    const ring = noOL(M(F, torusGeo(.29, .014), '#5a2a14', 0, .062, 0)); ring.rotation.x = HP;
    for (const s of [-1, 1]) { const l = noOL(box(F, .3, .022, .055, '#8a1a14', .0, .084, s * .06)); l.rotation.y = s * .42; }
    noOL(ball(F, .04, '#e8b860', 0, .08, 0, 0));
  },
  crescent(F) { // black shield, silver sunburst and crescent moon (V's own design)
    cyl0(F, .36, .05, '#262832', 0, 0, 0, 'y').castShadow = true;
    const rim = M(F, torusGeo(.36, .03), '#9aa0ac', 0, 0, 0); rim.rotation.x = HP; rim.castShadow = true;
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; noOL(ball(F, .022, '#cfd4dc', Math.cos(a) * .315, .03, Math.sin(a) * .315, 0, { noShadow: true })); }
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * PI * 2, r0 = .13;
      const sp = noOL(flat(F, [[-.035, 0], [.035, 0], [0, .15]], .03, '#c9ced6'));
      sp.position.set(Math.cos(a) * r0, .03, Math.sin(a) * r0); sp.rotation.y = -a + HP;
    }
    noOL(cyl0(F, .13, .04, '#3a3c48', 0, .03, 0, 'y'));
    const moon = [...arc(0, 0, .12, PI * .32, PI * 1.68, 10), ...arc(.055, 0, .095, PI * 1.6, PI * .4, 10)];
    noOL(flat(F, moon, .03, '#e6e9ee')).position.y = .055;
  },
  shell(F) { // Poseidon's scallop shell
    const H = -.3, R = .62, n = 11, a0 = -1.15, a1 = 1.15;
    for (let i = 0; i < n; i++) {
      const aa = a0 + (a1 - a0) * i / n, ab = a0 + (a1 - a0) * (i + 1) / n, am = (aa + ab) / 2;
      const pt = (a, r) => [H + Math.cos(a) * r, Math.sin(a) * r];
      const pts = [[H + .02, 0], pt(aa, R * .96), pt(am, R * 1.02), pt(ab, R * .96)];
      const w = flat(F, pts, .035, i % 2 ? '#d8b49a' : '#f2e4d2', i % 2 ? undefined : { emissive: '#2a2018' });
      w.position.y = .05 * Math.cos(am * 1.3) + (i % 2 ? 0 : .012);
    }
    flat(F, [[H - .06, -.14], [H - .06, .14], [H + .06, .09], [H + .06, -.09]], .05, '#c89a7a');
    noOL(ball(F, .035, '#e8f8ff', H + .04, .06, 0, 0, { basic: true }));
  },
  // ---- round 23 (Roy: "10 more kinds of shield, by level; the higher, the more special it looks; play with the size and
  // the shape: round, square, rectangle, oval"). In F: x is up the arm (the shield's height), z across it, +y out. Low ones
  // are small, plain and wooden; up the ladder they grow, take Greek shapes (pelta, figure-of-eight, thureos, Ajax's tower),
  // then bronze and gold with a Gorgon, Achilles' rings of the world, Helios' rays and at the top Athena's aegis.
  buckler(F) { // L1: a small round of oak planks, an iron rim and boss: a beginner's shield
    const d = cyl0(F, .29, .045, '#8a5a30', 0, 0, 0, 'y'); px(d, 'wood'); d.castShadow = true;
    for (const z of [-.15, 0, .15]) noOL(box(F, .5 - Math.abs(z) * 1.1, .006, .012, '#5a3a1e', 0, .026, z + .075)); // the plank seams
    const rim = M(F, torusGeo(.29, .022), P.iron); rim.rotation.x = HP; rim.castShadow = true;
    noOL(ball(F, .07, P.steelD, 0, .03, 0, 1)).scale.set(1, .55, 1);
  },
  pelta(F) { // L3: the Thracian pelta, a light crescent of wicker under hide, its horns up, a painted eye between them
    const o = crescentPts(.36, .2, .34, 22), d = flat(F, o, .035, '#c9a26a'); px(d, 'hide');
    const band = flat(F, crescentPts(.36, .2, .34, 22).map(([x, z]) => [x * .86 - .02, z * .86]), .012, '#7a2a1a'); band.position.y = .02; noOL(band); // a red painted band inside the edge
    noOL(flat(F, crescentPts(.36, .2, .34, 22).map(([x, z]) => [x * .78 - .03, z * .78]), .014, '#c9a26a')).position.y = .024;
    noOL(ball(F, .06, '#f2ead8', -.08, .03, 0, 1)).scale.set(1, .4, 1.5); noOL(ball(F, .03, '#2a1a10', -.08, .045, 0, 0)); // the eye
    for (const s of [-1, 1]) noOL(ball(F, .03, P.bronze, .2, .025, s * .27, 0)); // bronze tips on the horns
  },
  square(F) { // L8: a square of bronze over oak, a cross of studded straps, a boss: plain soldier's work
    const sq = [[-.29, -.29], [-.29, .29], [.29, .29], [.29, -.29]];
    px(flat(F, sq.map(([x, z]) => [x * 1.07, z * 1.07]), .04, P.bronzeD), 'rim').castShadow = true;
    px(flat(F, sq, .05, P.bronze), 'plate').position.y = .006;
    for (const r of [0, HP]) { const s = noOL(box(F, .6, .01, .06, P.bronzeD, 0, .034, 0)); s.rotation.y = r; }
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, rr = .27 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); noOL(ball(F, .016, P.bronzeL, Math.cos(a) * rr, .032, Math.sin(a) * rr, 0, { noShadow: true })); }
    const dm = noOL(flat(F, [[0, -.13], [.13, 0], [0, .13], [-.13, 0]], .014, '#8a1a14')); dm.position.y = .036; // a red painted lozenge under the boss
    noOL(ball(F, .08, P.bronzeL, 0, .03, 0, 1)).scale.set(1, .6, 1);
  },
  dipylon(F) { // L11: the figure-of-eight shield of the old heroes: dappled oxhide on a frame, two lobes, a waist cut at each side
    const pts = fig8Pts(.4, .28, 32);
    px(flat(F, pts.map(([x, z]) => [x * 1.05, z * 1.06]), .04, '#5a3a20'), 'rim').castShadow = true;
    px(flat(F, pts, .05, '#ece2cc'), 'hide').position.y = .006;
    for (const [x, z, r] of [[.2, -.08, .07], [.26, .09, .05], [-.16, .1, .08], [-.28, -.06, .05], [.02, -.12, .04], [-.04, .13, .035]]) noOL(ball(F, r, '#5a3a24', x, .03, z, 0)).scale.set(1.3, .15, 1); // the hide's dark patches
    noOL(box(F, .78, .012, .025, '#5a3a20', 0, .034, 0)); // the spine of the frame
  },
  oval(F) { // L14: the thureos, a tall oval with a long wooden spine and boss, painted blue with a white wave round it
    const o = ellPts(.38, .26, 26);
    px(flat(F, o.map(([x, z]) => [x * 1.05, z * 1.07]), .04, P.bronzeD), 'rim').castShadow = true;
    px(flat(F, o, .05, '#2e5c9a'), 'plate').position.y = .006;
    noOL(flat(F, ellPts(.31, .19, 26), .01, '#e8eef4')).position.y = .033; noOL(flat(F, ellPts(.27, .155, 26), .012, '#2e5c9a')).position.y = .035; // a white ring
    px(box(F, .7, .03, .05, P.woodL, 0, .04, 0), 'wood'); // the spina
    noOL(ball(F, .07, P.bronzeL, 0, .05, 0, 1)).scale.set(1.6, .6, 1);
  },
  tower(F) { // L18: Ajax's tower shield, seven oxhides and a bronze skin, a tall rectangle that covers her from shoulder to knee
    const W = .3, Hh = .58, rc = [[-Hh, -W], [-Hh, W], [Hh, W], [Hh, -W]];
    px(flat(F, rc.map(([x, z]) => [x * 1.03, z * 1.06]), .05, P.bronzeD), 'rim').castShadow = true;
    px(flat(F, rc, .06, '#9a6a3a'), 'hide').position.y = .006;
    for (let i = 0; i < 7; i++) noOL(box(F, .012, .008, W * 1.94, i % 2 ? '#6e4a2a' : '#b88a52', -Hh + .1 + i * .16, .037, 0)); // the seven hides' edges
    px(box(F, .14, .012, W * 2.04, P.bronze, Hh - .05, .04, 0), 'plate'); px(box(F, .14, .012, W * 2.04, P.bronze, -Hh + .05, .04, 0), 'plate'); // bronze top and foot
    for (const s of [-1, 1]) px(box(F, Hh * 1.9, .012, .05, P.bronze, 0, .04, s * (W - .02)), 'plate'); // bronze edges up the sides
    noOL(flat(F, [[.22, -.12], [.22, .12], [-.06, 0]], .014, '#1e1a16')).position.y = .044; // Ajax's black bull on the hides: the head
    for (const s of [-1, 1]) noOL(flat(F, crescentPts(.07, .05, .05, 8).map(([x, z]) => [x + .25, z * 1.4 + s * .12]), .014, '#e8dcc0')).position.y = .046; // its horns
    noOL(ball(F, .025, '#ff4a2a', .12, .05, 0, 0, { basic: true }));
    for (const s of [-1, 1]) for (const x of [-.4, -.1, .2]) noOL(ball(F, .018, P.bronzeL, x, .05, s * (W - .02), 0, { noShadow: true }));
  },
  gorgon(F) { // L24: a great bronze aspis with the Gorgon's face in relief: gilt face, red eyes, a ring of green snakes for hair
    const d = px(ball(F, .48, '#b87a30', 0, 0, 0, 2), 'shieldface'); d.scale.set(1, .2, 1);
    const rim = M(F, torusGeo(.48, .04), P.goldL, 0, 0, 0, { emissive: '#2a1a00' }); rim.rotation.x = HP; rim.castShadow = true;
    const ring = noOL(M(F, torusGeo(.35, .016), '#6a3010', 0, .07, 0)); ring.rotation.x = HP;
    const face = ball(F, .15, P.gold, 0, .07, 0, 1, { emissive: '#3a2400' }); face.scale.set(1.1, .45, 1); face.userData.boss = true;
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, s = noOL(cone(F, .03, .14, '#3a8a3a', Math.cos(a) * .19, .08, Math.sin(a) * .19, 4)); s.rotation.set(0, 0, 0); s.rotation.order = 'YXZ'; s.rotation.y = -a; s.rotation.x = HP; s.userData.boss = true; } // snakes
    for (const s of [-1, 1]) noOL(ball(F, .025, '#ff3a20', .04, .125, s * .055, 0, { basic: true })).userData.boss = true; // her eyes
    noOL(box(F, .02, .01, .08, '#5a1a10', -.07, .13, 0)).userData.boss = true; // the mouth
  },
  achilles(F) { // L32: the shield Hephaestus made for Achilles: the earth and sky at the middle, rings of the world round it, Ocean at the rim
    const d = px(ball(F, .54, '#c88a3a', 0, 0, 0, 2), 'shieldface'); d.scale.set(1, .2, 1);
    const rim = M(F, torusGeo(.54, .045), '#2a7a8a', 0, 0, 0, { emissive: '#06222a' }); rim.rotation.x = HP; rim.castShadow = true; // Ocean round it all
    for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2; noOL(ball(F, .02, '#e8f8ff', Math.cos(a) * .54, .045, Math.sin(a) * .54, 0, { noShadow: true })); } // the foam
    for (const [r, c] of [[.44, '#e8c860'], [.33, '#d8dce4'], [.22, '#e8c860']]) { const t = noOL(M(F, torusGeo(r, .018), c, 0, .085, 0)); t.rotation.x = HP; }
    for (let i = 0; i < 16; i++) { const a = (i + .5) / 16 * PI * 2; noOL(box(F, .03, .01, .05, i % 2 ? P.silver : P.goldL, Math.cos(a) * .385, .095, Math.sin(a) * .385)).rotation.y = -a; } // the cities, the fields, the dancers
    for (let i = 0; i < 10; i++) { const a = (i + .25) / 10 * PI * 2; noOL(box(F, .02, .01, .03, '#6a4a20', Math.cos(a) * .275, .1, Math.sin(a) * .275)).rotation.y = -a; }
    const sky = noOL(cyl0(F, .15, .02, '#2a4a8a', 0, .1, 0, 'y')); sky.userData.boss = true;
    noOL(ball(F, .045, '#ffe060', .05, .115, -.04, 0, { basic: true })).userData.boss = true; // the sun
    noOL(flat(F, [...arc(0, 0, .04, PI * .3, PI * 1.7, 6), ...arc(.018, 0, .032, PI * 1.6, PI * .4, 6)], .012, '#f0f4ff')).position.set(-.04, .115, .05); // the moon
    for (const [x, z] of [[.08, .07], [-.08, -.08], [.1, -.1], [-.02, .1]]) noOL(ball(F, .012, '#ffffff', x, .115, z, 0, { basic: true, noShadow: true })); // stars
  },
  helios(F) { // L42: the shield of the Sun: beaten gold, a crown of flame-coloured rays round the rim, the god's face blazing at the boss
    const d = px(ball(F, .44, P.gold, 0, 0, 0, 2), 'shieldface'); d.scale.set(1, .22, 1);
    const rim = M(F, torusGeo(.44, .04), P.goldL, 0, 0, 0, { emissive: '#4a3000' }); rim.rotation.x = HP; rim.castShadow = true;
    for (let i = 0; i < 16; i++) { // the rays, long and short by turns
      const a = i / 16 * PI * 2, L = i % 2 ? .13 : .22, r0 = .44;
      const ray = flat(F, [[0, -.05], [L, 0], [0, .05]], .03, i % 2 ? '#ffb030' : '#ff7a1a', { emissive: '#4a1a00' }); ray.position.set(Math.cos(a) * (r0 - .02), 0, Math.sin(a) * (r0 - .02)); ray.rotation.y = -a;
    }
    const t = noOL(M(F, torusGeo(.3, .02), '#ff9a2a', 0, .08, 0, { emissive: '#4a2000' })); t.rotation.x = HP;
    const sun = noOL(ball(F, .14, '#fff0a0', 0, .08, 0, 1, { basic: true })); sun.scale.set(1, .4, 1); sun.userData.boss = true;
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const s = noOL(flat(F, [[0, -.025], [.09, 0], [0, .025]], .02, '#ffe070', { basic: true })); s.position.set(Math.cos(a) * .14, .1, Math.sin(a) * .14); s.rotation.y = -a; s.userData.boss = true; }
  },
  aegis(F) { // L52: Athena's aegis: polished silver scales, the Gorgon's head at its heart with eyes of light, a fringe of golden snakes
    const o = ellPts(.5, .42, 30);
    px(flat(F, o.map(([x, z]) => [x * 1.04, z * 1.05]), .05, P.goldD), 'rim').castShadow = true;
    const face = px(ball(F, .46, P.silver, 0, 0, 0, 2), 'shieldface'); face.scale.set(1.08, .2, .92); // (the face dome, a touch long)
    for (let i = 0; i < 22; i++) { // the snake fringe, heads out past the rim
      const a = i / 22 * PI * 2, x = Math.cos(a) * .5, z = Math.sin(a) * .42, s = noOL(cone(F, .03, .16, i % 2 ? P.gold : P.goldL, x * 1.08, 0, z * 1.08, 4, { emissive: '#3a2800' }));
      s.rotation.order = 'YXZ'; s.rotation.y = -Math.atan2(z, x) + HP; s.rotation.x = HP; s.userData.boss = true;
    }
    for (let k = 0; k < 3; k++) { const t = noOL(M(F, torusGeo(.2 + k * .08, .01), '#a8b4c4', 0, .075 - k * .012, 0)); t.rotation.x = HP; t.scale.set(1.08, .92, 1); } // rings of scales
    const head = ball(F, .16, '#e8dcc8', 0, .09, 0, 1, { emissive: '#2a2010' }); head.scale.set(1.1, .5, 1); head.userData.boss = true; // the Gorgoneion
    noOL(box(F, .03, .012, .1, '#8a1a1a', -.07, .17, 0)).userData.boss = true; // her mouth, open
    for (const s of [-1, 1]) { const b = noOL(box(F, .016, .012, .07, '#3a2a20', .085, .165, s * .05)); b.rotation.y = s * .4; b.userData.boss = true; } // brows
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2, s = noOL(cone(F, .024, .11, '#4a9a5a', Math.cos(a) * .18, .1, Math.sin(a) * .18, 4)); s.rotation.order = 'YXZ'; s.rotation.y = -a + HP; s.rotation.x = HP; s.userData.boss = true; }
    for (const s of [-1, 1]) noOL(ball(F, .03, '#bff4ff', .035, .17, s * .055, 0, { basic: true })).userData.boss = true; // eyes of light
  },
};
// shield outlines in F's face plane ([x up, z across]): an ellipse, a crescent (a circle with a bite out of its top), a figure of eight
function ellPts(rx, rz, n) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * PI * 2; o.push([Math.cos(a) * rx, Math.sin(a) * rz]); } return o; }
function crescentPts(R, r, d, n) { // outer circle R at the origin, less a circle r centred d up its axis
  const x0 = (R * R - r * r + d * d) / (2 * d), z0 = Math.sqrt(Math.max(0, R * R - x0 * x0)), t0 = Math.atan2(z0, x0), t1 = Math.atan2(z0, x0 - d);
  const o = arc(0, 0, R, t0, PI * 2 - t0, n), m = Math.round(n / 2); // round the bottom, then back across the bite
  for (let i = 1; i < m; i++) { const b = -t1 - (PI * 2 - 2 * t1) * i / m; o.push([d + Math.cos(b) * r, Math.sin(b) * r]); }
  return o;
}
function fig8Pts(h, w, n) { // two lobes one over the other, pinched at the waist
  const o = [];
  for (let i = 0; i < n; i++) { const a = i / n * PI * 2, x = Math.cos(a) * h, pinch = 1 - .45 * Math.exp(-((x / h) ** 2) / .04); o.push([x, Math.sin(a) * w * pinch]); }
  return o;
}
function makeShield(kind, rarity = 'rare', tint = null, grade = 0) {
  const root = new THREE.Group(); root.name = 'shield:' + kind;
  if (!BUILD_CTX.item || BUILD_CTX.item.kind !== kind) BUILD_CTX.item = { kind, grade, rarity };
  const S = pivot(root, -.1, .2, .02);
  const F = pivot(S, 0, 0, 0); F.rotation.z = HP; // F-local +y points out of the arm (-x)
  (SHIELD_BUILD[kind] || SHIELD_BUILD.round)(F);
  F.traverse((m) => { if (m.userData.noOutline) m.userData.boss = true; }); // the emblem's raised bits: a weapon slung over the shield lies across them (models.js seatWeapon)
  if (tint) tintTree(root, tint, .5);
  if (PXART) pxArms(root, kind, rarity);
  glowTree(root, grade);
  addOutline(root, SKIP);
  root.userData = { shield: kind, outlined: true, center: [-.1, .2, .02] };
  return root;
}
export { makeShield };

// ---------------------------------------------------------------------------------------------
// gear models. Helmets are authored in rig.head space (origin at the head pivot, face +z: skull centre
// y .19, eyes y .2, hair top y .46); amulets in rig.torso space (neck y .62, chest front z ~.17 at y .45).
// ---------------------------------------------------------------------------------------------
const capGeo = (r, th) => cached(`cap${r},${th}`, () => new THREE.SphereGeometry(r, 14, 7, 0, PI * 2, 0, th));
function cap(p, r, th, color, y, z = -.02, opts) { const m = px(M(p, capGeo(r, th), color, 0, y, z, opts), 'helm'); return m; }
// a plume in the y-z plane (pts are [height, z]) or across x when `across`
function plume(p, pts, t, color, edge, y, across) {
  const pv = pivot(p, 0, y, 0); pv.rotation.set(0, across ? HP : 0, HP);
  plate(pv, pts, t, color, edge, .02); pv.traverse((o) => { if (o.isMesh) o.userData.px = 'plume'; }); return pv;
}
const CREST = [[0, .2], [.09, .22], [.17, .15], [.22, .03], [.22, -.1], [.18, -.24], [.1, -.36], [-.02, -.4], [-.04, -.3], [0, -.18], [.01, -.04], [0, .08]];
// round 33 (GEAR): cheek guards cut to a cheek's outline (a rounded top, the front curving down to the chin) instead of
// boxes, each painted to its outline (pxShape: bevel, trim, rivets), its rim rolled out
const CHEEK = [[.1, -.03], [.1, .055], [.075, .095], [.02, .112], [-.05, .105], [-.1, .08], [-.11, .045], [-.085, .005], [-.03, -.03], [.05, -.045]];
function cheekGuards(p, color, y = .12) {
  for (const sx of [-1, 1]) {
    const q = pivot(p, sx * .205, y, .08); q.rotation.y = sx * .35; q.rotation.z = -sx * .08;
    const c = px(flat(q, CHEEK, .036, color), 'plate'); c.rotation.z = HP; c.castShadow = true;
  }
}
function amuletChain(p, color = '#d8b04a') {
  const n = p.children.length;
  chain(p, [[-.14, .62, .05], [-.12, .54, .15], [-.06, .47, .2], [0, .45, .21], [.06, .47, .2], [.12, .54, .15], [.14, .62, .05]], .011, .011, color, 4, { noShadow: true });
  for (const o of p.children.slice(n)) o.userData.px = 'chain';
}
// body armour: a cuirass over V's chest (y .13..59, radius .215..272, z squashed to .74), bands, shoulder flaps,
// pauldrons on the arm bones and a ring of pteruges over her own leather skirt
const CUI = { r0: .215, r1: .272, y0: .13, y1: .59 };
const cuiR = (y) => CUI.r0 + (CUI.r1 - CUI.r0) * (y - CUI.y0) / (CUI.y1 - CUI.y0);
function cuirass(t, color, opts) {
  const c = px(tcyl(t, CUI.r1, CUI.r0, CUI.y1 - CUI.y0, color, 0, (CUI.y0 + CUI.y1) / 2, 0, 10, opts), 'cuirass'); c.scale.z = .74; return c;
}
function cuiBand(t, y, h, color) {
  const b = px(tcyl(t, cuiR(y + h / 2) + .009, cuiR(y - h / 2) + .009, h, color, 0, y, 0, 10), 'band'); b.scale.z = .755; return b;
}
// a pivot on the cuirass surface at height y and angle a (0 = front), d out from it, facing out
function onCui(t, y, a, d = .006) {
  const r = cuiR(y), p = pivot(t, Math.sin(a) * (r + d), y, Math.cos(a) * (r * .74 + d));
  p.rotation.order = 'YXZ'; p.rotation.set(.12, Math.atan2(Math.sin(a), Math.cos(a) / .74), 0); return p;
}
const belt = (t, color) => { const z = px(tcyl(t, .245, .245, .075, color, 0, .095, 0, 10), 'belt'); z.scale.z = .82; return z; };
function epomides(t, color, edge) {
  for (const sx of [-1, 1]) {
    const p = pivot(t, sx * .165, .615, 0); p.rotation.z = -sx * .22;
    box(p, .14, .04, .36, color);
    if (edge) box(p, .15, .046, .03, edge, 0, 0, .17, { noShadow: true });
  }
}
function pauldrons(b, color, edge) {
  for (const [sx, nm] of [[-1, 'armL'], [1, 'armR']]) {
    const pv = pivot(b(nm), sx * .01, 0, 0); pv.rotation.z = -sx * .3;
    px(cap(pv, .112, PI * .5, color, 0, 0), 'pauldron');
    px(tcyl(pv, .108, .118, .05, edge || color, 0, -.03, 0, 10), 'band');
  }
}
function pteruges(t, n, colA, colB, tip, o = {}) {
  const r = o.r ?? .25, y = o.y ?? .07, h = o.h ?? .29, w = o.w ?? .085, tilt = o.tilt ?? .22;
  for (let i = 0; i < n; i++) {
    const a = (i + .5) / n * PI * 2, p = pivot(t, Math.sin(a) * r, y, Math.cos(a) * r);
    p.rotation.order = 'YXZ'; p.rotation.set(-tilt, a, 0); p.userData.flap = { a, len: h, tilt, hw: w / 2 }; // swung clear of her legs (models.js fitFlaps)
    px(box(p, w, h, .026, i % 2 ? colB : colA, 0, -h / 2, 0), 'pteryx');
    if (tip) box(p, w + .008, .045, .034, tip, 0, -h + .02, 0, { noShadow: true });
  }
}
// footwear: one boot per knee (knee space: shin y .01..-.29, foot box at y -.34, ground at -.44)
function bootPair(b, fn) { for (const [sx, nm] of [[-1, 'kneeL'], [1, 'kneeR']]) fn(b(nm), sx); }
// round 33 (GEAR): rounder, like V's own boots: the instep a squashed barrel along the foot (stitched welts down its sides),
// a rounded toe, a heel cup, and a sole cut to a foot's outline (narrow waist, round toe and heel) instead of boxes
const SOLE_PTS = (() => { const o = []; for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, c = Math.cos(a), s = Math.sin(a), toe = s > 0; o.push([c * (toe ? .079 : .07) * (1 - .12 * Math.exp(-((s + .1) ** 2) * 12)), s * (toe ? .148 : .128)]); } return o; })();
function bootFoot(k, upper, sole) {
  const f = px(tcyl(k, .064, .07, .21, upper, 0, -.343, .035, 10), 'boot'); f.rotation.x = HP; f.scale.set(1.13, 1, .8); // its top clears V's own foot (top at -.295)
  ball(k, .072, upper, 0, -.35, .14, 0).scale.set(1.04, .66, .78); // the toe
  ball(k, .066, upper, 0, -.345, -.065, 0).scale.set(1.08, .74, .6); // the heel
  const so = px(flat(k, SOLE_PTS, .032, sole), 'sole'); so.position.set(0, -.392, .045);
}
const shinR = (y) => .082 + .008 * (y + .29) / .27;
const shin = (k, color) => px(tcyl(k, .09, .082, .27, color, 0, -.155, 0, 12), 'greave'); // (round 33: rounder; a greave's rims, ridge and calf unless the builder names its material)
const shinBand = (k, y, h, color) => px(tcyl(k, shinR(y) + .007, shinR(y) + .007, h, color, 0, y, 0, 8, { noShadow: true }), 'band');
const GEAR_BUILD = {
  leather_cap(h) {
    cap(h, .248, PI * .47, '#7a5634', .28, -.03).scale.set(1, .95, 1.05);
    const b = tcyl(h, .25, .25, .04, P.bronze, 0, .3, -.03, 14); b.scale.z = 1.05;
    for (const sx of [-1, 1]) box(h, .04, .12, .1, '#6a4a2c', sx * .23, .22, -.03);
    ball(h, .03, P.bronzeL, 0, .3, .23, 0);
  },
  corinthian_helm(h) {
    cap(h, .262, PI * .56, '#c08436', .27, -.02).scale.set(1, 1.02, 1.08);
    const br = tcyl(h, .262, .262, .03, '#e0a850', 0, .27, -.02, 14); br.scale.z = 1.08;
    cheekGuards(h, '#b07a30');
    box(h, .036, .13, .03, '#b07a30', 0, .2, .262);
    const ng = box(h, .36, .18, .05, '#b07a30', 0, .14, -.22); ng.rotation.x = .25;
    box(h, .05, .06, .3, '#5a3a20', 0, .515, -.08);
    plume(h, CREST, .07, '#c0242c', '#e8484a', .52);
  },
  spartan_helm(h) {
    cap(h, .262, PI * .56, '#a87a3a', .27, -.02).scale.set(1, 1.02, 1.08);
    const br = tcyl(h, .262, .262, .03, '#d8a850', 0, .27, -.02, 14); br.scale.z = 1.08;
    cheekGuards(h, '#8a6230');
    box(h, .036, .13, .03, '#8a6230', 0, .2, .262);
    const ng = box(h, .36, .18, .05, '#8a6230', 0, .14, -.22); ng.rotation.x = .25;
    box(h, .34, .05, .06, '#3a2418', 0, .52, -.02);
    plume(h, [[0, .4], [.1, .42], [.18, .34], [.22, .18], [.23, 0], [.22, -.18], [.18, -.34], [.1, -.42], [0, -.4], [.02, -.2], [.02, .2]], .07, '#b02a24', '#1e1410', .53, true);
  },
  owl_helm(h) {
    cap(h, .258, PI * .5, '#d8dce4', .27, -.02).scale.set(1, 1, 1.06);
    const br = tcyl(h, .26, .26, .045, P.gold, 0, .29, -.02, 14); br.scale.z = 1.06;
    for (const sx of [-1, 1]) { const c = box(h, .04, .16, .13, P.gold, sx * .21, .16, .05); c.rotation.y = sx * .35; }
    box(h, .05, .06, .26, '#2a4a8a', 0, .51, -.12);
    plume(h, [[0, .0], [.08, -.02], [.14, -.12], [.13, -.26], [.06, -.36], [-.02, -.34], [0, -.2]], .05, '#2a4a8a', '#4a7ad8', .52);
    const ow = pivot(h, 0, .5, .1);
    const bd = ball(ow, .07, '#c8ccd6', 0, .04, 0, 1); bd.scale.set(.9, 1.1, .8);
    ball(ow, .058, '#d8dce4', 0, .14, .01, 1);
    for (const sx of [-1, 1]) { box(ow, .03, .03, .02, '#ffd84a', sx * .025, .15, .055, { basic: true }); cone(ow, .018, .05, '#c8ccd6', sx * .035, .2, 0, 4); const w = box(ow, .03, .09, .08, '#a8acb6', sx * .06, .04, -.01); w.rotation.z = sx * .2; }
    cone(ow, .012, .03, P.gold, 0, .12, .06, 4).rotation.x = PI;
  },
  darkness_helm(h) {
    cap(h, .268, PI * .64, '#1e1a26', .27, -.02).scale.set(1, 1.04, 1.08);
    const mk = box(h, .34, .13, .06, '#2a2436', 0, .225, .225); mk.rotation.x = -.15;
    for (const sx of [-1, 1]) box(h, .085, .022, .02, '#c07cff', sx * .07, .215, .262, { basic: true });
    box(h, .04, .14, .04, '#2a2436', 0, .14, .25);
    for (const sx of [-1, 1]) chain(h, [[sx * .17, .38, .02], [sx * .28, .46, -.04], [sx * .32, .58, -.12], [sx * .28, .68, -.2]], .045, .01, '#3a3048', 6);
    for (const z of [.12, -.04, -.2]) cone(h, .04, .14, '#3a3048', 0, .54 + (z > 0 ? -.02 : 0), z, 4);
    ball(h, .035, '#c07cff', 0, .34, .24, 0, { basic: true });
    for (const [x, y, z] of [[.22, .44, -.12], [-.2, .5, -.18], [.08, .58, -.24]]) ball(h, .04, '#6a4a9a', x, y, z, 0, { basic: true, opacity: .55 });
  },
  sun_amulet(n) {
    amuletChain(n);
    const p = pivot(n, 0, .42, .215);
    cyl0(p, .07, .03, '#e8b840', 0, 0, 0, 'z').castShadow = true;
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const c = cone(p, .022, .06, '#ffd860', Math.cos(a) * .09, Math.sin(a) * .09, 0, 4, { noShadow: true }); c.rotation.z = a - HP; }
    const gm = ball(p, .04, '#e0303a', 0, 0, .025, 1, { emissive: '#4a0000' }); gm.scale.z = .7;
    box(p, .015, .015, .01, '#ffffff', -.012, .014, .05, { basic: true });
  },
  sea_amulet(n) {
    amuletChain(n, '#c8ccd6');
    const p = pivot(n, 0, .42, .215);
    const fr = M(p, torusGeo(.06, .016), '#e8b840', 0, 0, 0); fr.scale.y = 1.25; fr.castShadow = true;
    const gm = ball(p, .055, '#2f7dff', 0, 0, .01, 1, { emissive: '#001a4a' }); gm.scale.set(1, 1.25, .6);
    box(p, .016, .02, .01, '#e8f8ff', -.015, .025, .045, { basic: true });
    cone(p, .02, .04, '#e8b840', 0, -.09, 0, 4).rotation.x = PI;
  },
  owl_amulet(n) {
    amuletChain(n, '#c8ccd6');
    const p = pivot(n, 0, .42, .215);
    cyl0(p, .07, .025, '#c8ccd6', 0, 0, 0, 'z').castShadow = true;
    for (const sx of [-1, 1]) { noOL(M(p, torusGeo(.022, .008), '#6a6e78', sx * .026, .012, .015)); box(p, .014, .014, .01, '#ffd84a', sx * .026, .012, .022, { basic: true }); }
    noOL(cone(p, .012, .025, '#e8b840', 0, -.016, .018, 4)).rotation.x = PI;
    for (const sx of [-1, 1]) noOL(cone(p, .012, .03, '#8a8e98', sx * .04, .055, .01, 4));
  },
  serpent_amulet(n) {
    amuletChain(n, '#3a5a3a');
    const p = pivot(n, 0, .42, .215);
    const r = M(p, torusGeo(.06, .02), '#3ac06a', 0, 0, 0, { emissive: '#0a2a10' }); r.castShadow = true;
    const hd = ball(p, .03, '#2a9a5a', .03, .05, .01, 1); hd.scale.set(1.3, .8, .8);
    box(p, .01, .01, .01, '#ffe14a', .045, .058, .03, { basic: true });
    ball(p, .022, '#e8f8a0', 0, 0, 0, 0, { basic: true });
  },
  fleece_amulet(n) {
    amuletChain(n);
    const p = pivot(n, 0, .41, .215);
    for (const [x, y, r] of [[0, 0, .05], [-.045, .01, .036], [.045, .01, .036], [-.03, -.04, .035], [.03, -.04, .035], [0, .045, .034]]) ball(p, r, '#ffc83a', x, y, 0, 1, { emissive: '#4a3000' });
    const hd = ball(p, .03, '#f0b830', 0, .075, .02, 1); hd.scale.y = .8;
    for (const sx of [-1, 1]) { const c = M(p, torusGeo(.018, .007, PI * 1.4), '#e8dcc0', sx * .035, .08, .02); c.rotation.y = sx * .4; }
  },
  // ---- more helmets (head space, like the ones above) ----
  pilos_helm(h) {
    const c = px(cone(h, .266, .34, '#c89a48', 0, .44, -.02, 12), 'helm'); c.scale.z = 1.06;
    const br = tcyl(h, .274, .274, .036, '#e8b860', 0, .285, -.02, 14); br.scale.z = 1.06;
    const rg = tcyl(h, .196, .196, .02, '#9a6a2a', 0, .37, -.02, 12); rg.scale.z = 1.06;
    ball(h, .032, P.bronzeL, 0, .615, -.02, 0);
  },
  boar_helm(h) {
    const L = '#5a3a22';
    cap(h, .262, PI * .55, L, .27, -.02).scale.set(1, 1.02, 1.06);
    const br = tcyl(h, .268, .268, .04, '#3a2416', 0, .285, -.02, 14); br.scale.z = 1.06;
    // rows of boar tusks, each row leaning the other way (Iliad 10)
    [[16, .05], [14, .12], [10, .185]].forEach(([n, hh], row) => {
      const rr = Math.sqrt(.262 * .262 - hh * hh) + .012, lean = Math.asin(hh / .262);
      for (let i = 0; i < n; i++) {
        const a = (i + row * .5) / n * PI * 2;
        const tk = box(h, .072, .036, .022, i % 2 ? '#e6dfcc' : '#d2c8ae', Math.sin(a) * rr, .27 + hh * 1.02, -.02 + Math.cos(a) * rr * 1.06);
        tk.rotation.order = 'YXZ'; tk.rotation.set(-lean, a, (row % 2 ? 1 : -1) * .45);
      }
    });
    for (const sx of [-1, 1]) { const c = box(h, .04, .15, .13, L, sx * .215, .17, .03); c.rotation.y = sx * .3; }
    tcyl(h, .02, .03, .07, P.bronze, 0, .55, -.02, 6);
    ball(h, .036, '#e6dfcc', 0, .6, -.02, 0);
  },
  thracian_helm(h) {
    const S = '#4a5a78', SL = '#7a8cb0', G = P.gold;
    cap(h, .262, PI * .54, S, .27, -.02).scale.set(1, 1.04, 1.07);
    const br = tcyl(h, .266, .266, .034, G, 0, .275, -.02, 14); br.scale.z = 1.07;
    // the Phrygian apex: the crown rises and curls forward like a wave, a gold ridge along it
    chain(h, [[0, .42, -.12], [0, .53, -.07], [0, .6, .02], [0, .6, .11], [0, .54, .16]], .14, .05, S, 8);
    ball(h, .052, SL, 0, .535, .165, 0);
    chain(h, [[0, .5, -.25], [0, .63, -.1], [0, .675, .02], [0, .66, .13], [0, .59, .2]], .016, .014, G, 5);
    // a visor peak and long cheek pieces embossed with a gold beard
    const pk = box(h, .3, .022, .09, S, 0, .27, .235); pk.rotation.x = -.28;
    for (const sx of [-1, 1]) {
      const cp = pivot(h, sx * .21, .12, .07); cp.rotation.set(0, sx * .32, -sx * .06);
      box(cp, .045, .25, .16, S);
      for (let i = 0; i < 3; i++) box(cp, .05, .022, .11 - i * .02, G, 0, -.08 + i * .05, .01, { noShadow: true });
    }
  },
  achilles_helm(h) {
    const G = '#f2b630', GL = '#ffe490', GD = '#b07a18';
    cap(h, .266, PI * .6, G, .27, -.02, { emissive: '#3a2400' }).scale.set(1, 1.03, 1.08);
    const br = tcyl(h, .27, .27, .036, GL, 0, .27, -.02, 14); br.scale.z = 1.08;
    cheekGuards(h, GD);
    box(h, .036, .13, .03, GD, 0, .2, .262);
    const ng = box(h, .36, .18, .05, GD, 0, .14, -.22); ng.rotation.x = .25;
    // brow: a red stone between two embossed flames
    ball(h, .03, '#ff5a2a', 0, .315, .255, 0, { basic: true });
    for (const sx of [-1, 1]) { const f = cone(h, .03, .11, GL, sx * .085, .33, .24, 4); f.rotation.z = -sx * 1.1; }
    // a tall holder and a golden horsehair crest whose tail runs down the back
    box(h, .05, .1, .32, GD, 0, .54, -.06);
    plume(h, [[0, .26], [.11, .27], [.21, .19], [.27, .04], [.27, -.12], [.22, -.28], [.12, -.4], [0, -.44], [-.03, -.3], [0, -.16], [.01, 0], [0, .14]], .08, G, '#ff8a2a', .58);
    chain(h, [[0, .64, -.4], [0, .52, -.48], [0, .34, -.46], [0, .14, -.38], [0, -.02, -.33]], .05, .02, G, 6);
  },
  // ---- body armour (torso space; parts made with b('armL') etc. ride that bone, see GEAR_BONE_REST in models.js) ----
  linen_cuirass(t) {
    const C = '#e8dcc0', CD = '#cdbf9c', SEA = '#2f7f9a';
    cuirass(t, C);
    cuiBand(t, .165, .05, SEA);
    for (let i = 0; i < 14; i++) box(onCui(t, .165, i / 14 * PI * 2, .016), .03, .022, .01, '#f4ead4', 0, 0, 0, { noShadow: true });
    cuiBand(t, .45, .02, CD);
    belt(t, CD);
    epomides(t, C, SEA);
    for (const sx of [-1, 1]) ball(t, .024, SEA, sx * .13, .55, cuiR(.55) * .74 + .012, 0, { noShadow: true });
    pteruges(t, 12, C, CD, SEA);
  },
  muscle_cuirass(t, b) {
    const B = P.bronze, BL = P.bronzeL;
    cuirass(t, B);
    for (const sx of [-1, 1]) ball(onCui(t, .47, sx * .36, -.012), .095, '#cc9444', 0, 0, 0, 1).scale.set(1.05, .62, .4);
    for (const y of [.235, .3, .365]) for (const sx of [-1, 1]) box(onCui(t, y, sx * .17, -.004), .064, .05, .02, '#c88c3c');
    ball(onCui(t, .19, 0, 0), .013, P.bronzeD, 0, 0, 0, 0, { noShadow: true });
    cuiBand(t, .148, .036, BL); cuiBand(t, .578, .028, BL);
    belt(t, '#5a3a20');
    epomides(t, B, BL);
    pauldrons(b, B, BL);
    pteruges(t, 12, '#5a3a20', '#7a4e2c', BL);
  },
  scale_cuirass(t, b) {
    const G = '#2f8a5e', GD = '#1d5a3c', GL = '#5ac88a', AU = P.gold;
    cuirass(t, GD);
    for (let row = 0; row < 7; row++) {
      const y = .54 - row * .062, n = 14;
      for (let i = 0; i < n; i++) {
        const s = box(onCui(t, y, (i + (row % 2) * .5) / n * PI * 2, .004), .056, .056, .016, (i + row) % 3 ? G : GL, 0, 0, 0, { noShadow: true });
        s.rotation.z = PI / 4;
      }
    }
    cuiBand(t, .145, .036, AU); cuiBand(t, .582, .028, AU);
    belt(t, GD);
    epomides(t, G, AU);
    pauldrons(b, G, AU);
    pteruges(t, 12, G, GD, AU);
  },
  nemean_pelt(t, b) {
    const F = '#d8a048', FD = '#a8702a', FL = '#f0c878', MN = '#8a4a1c', MN2 = '#a85a20', CL = '#f4ecd8';
    cuirass(t, F);
    belt(t, '#4a2e1a');
    box(t, .07, .06, .03, P.gold, 0, .095, .205);
    pteruges(t, 12, F, FD, MN, { h: .25 });
    // a mane round the shoulders and the back of the neck, open under the chin
    for (let i = 0; i < 11; i++) {
      const a = PI * .32 + i / 10 * PI * 1.36;
      ball(t, .075, i % 2 ? MN : MN2, Math.sin(a) * .2, .625, Math.cos(a) * .17, 0).scale.set(1, .8, 1);
    }
    // the forepaws knot across the chest
    for (const sx of [-1, 1]) {
      chain(t, [[sx * .17, .6, .02], [sx * .15, .5, cuiR(.5) * .74 + .01], [-sx * .03, .31, cuiR(.31) * .74 + .025]], .042, .032, F, 6);
      const pw = ball(t, .042, FL, -sx * .05, .29, cuiR(.29) * .74 + .03, 0); pw.scale.set(1.1, .9, .8);
      for (const k of [-1, 0, 1]) cone(t, .01, .035, CL, -sx * .05 + k * .02, .255, cuiR(.27) * .74 + .05, 4, { noShadow: true }).rotation.x = PI;
    }
    // the hide hangs down the back, the lion's head at its top
    const cp = pivot(t, 0, .6, -.2); cp.rotation.x = .2; cp.userData.flap = { a: PI, len: 1, tilt: .2, hw: .22, sgn: 1 }; // swung clear of her heels (models.js fitFlaps)
    box(cp, .44, .86, .035, F, 0, -.43, -.01);
    for (const x of [-.14, 0, .14]) cone(cp, .06, .12, FD, x, -.9, -.01, 4).rotation.x = PI;
    for (const sx of [-1, 1]) {
      chain(cp, [[sx * .2, -.72, -.02], [sx * .25, -.88, -.03], [sx * .24, -1, -.02]], .04, .03, F, 5);
      for (const k of [-1, 1]) cone(cp, .01, .035, CL, sx * .24 + k * .015, -1.04, -.02, 4, { noShadow: true }).rotation.x = PI;
    }
    const hd = pivot(cp, 0, -.12, -.05); hd.rotation.y = PI;
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; ball(hd, .05, i % 2 ? MN : MN2, Math.sin(a) * .12, Math.cos(a) * .11, -.02, 0); }
    ball(hd, .1, F, 0, 0, .02, 1).scale.set(1.15, 1, .6);
    ball(hd, .055, FL, 0, -.045, .07, 0).scale.set(1.1, .8, .8);
    box(hd, .036, .024, .02, '#3a2416', 0, -.01, .115, { noShadow: true });
    for (const sx of [-1, 1]) {
      box(hd, .036, .012, .01, '#3a2416', sx * .045, .035, .085, { noShadow: true });
      ball(hd, .03, FD, sx * .085, .095, 0, 0);
      cone(hd, .011, .035, CL, sx * .025, -.09, .09, 4, { noShadow: true }).rotation.x = PI;
    }
    // furry shoulders
    for (const [sx, nm] of [[-1, 'armL'], [1, 'armR']]) {
      const a = b(nm); ball(a, .108, F, sx * .01, .02, 0, 1).scale.set(1, .75, 1.05);
      for (let i = 0; i < 4; i++) cone(a, .025, .06, FD, sx * .03, -.06, (i - 1.5) * .05, 4).rotation.x = PI;
    }
  },
  // round 22 (Roy): the black dragon's full plate. Overlapping black scales over a keeled breastplate, red fire showing in
  // the seams and an ember at the heart, great horned pauldrons, a spine of small spikes down the back (kept low and
  // flat: the shield and weapons ride over it, see models.js seatBack) and long scale tassets over the thighs
  dragon_plate(t, b) {
    const BK = '#2a2430', BD = '#16131a', BL = '#4a4252', GM = '#5a525e', EM = '#ff3a1e', HORN = '#d8ccb0';
    cuirass(t, BD);
    for (let row = 0; row < 7; row++) {
      const y = .55 - row * .062, n = 14;
      for (let i = 0; i < n; i++) {
        const s = box(onCui(t, y, (i + (row % 2) * .5) / n * PI * 2, .004), .06, .06, .018, (i + row) % 4 ? BK : BL, 0, 0, 0, { noShadow: true });
        s.rotation.z = PI / 4;
      }
    }
    // the keel down the breastbone and two pectoral plates, the ember between them
    box(onCui(t, .4, 0, .016), .05, .34, .03, GM);
    for (const sx of [-1, 1]) ball(onCui(t, .46, sx * .34, -.004), .095, BK, 0, 0, 0, 1).scale.set(1.05, .6, .38);
    ball(onCui(t, .5, 0, .03), .036, EM, 0, 0, 0, 1, { basic: true });
    for (const sx of [-1, 1]) box(onCui(t, .5, sx * .2, .02), .1, .012, .01, EM, 0, 0, 0, { basic: true, noShadow: true }).rotation.z = sx * .5;
    cuiBand(t, .148, .036, GM); cuiBand(t, .582, .028, GM);
    // a gorget round the neck, open at the throat
    for (let i = 0; i < 9; i++) { const a = PI * .3 + i / 8 * PI * 1.4; box(t, .07, .07, .03, i % 2 ? BK : BL, Math.sin(a) * .15, .63, Math.cos(a) * .12).rotation.y = a; }
    // the spine: small spikes, low against the back
    for (let i = 0; i < 4; i++) { const y = .52 - i * .1, c = cone(onCui(t, y, PI, -.004), .022, .05, HORN, 0, 0, .02, 4, { noShadow: true }); c.rotation.x = HP + .5; }
    belt(t, BD);
    box(t, .1, .07, .03, GM, 0, .095, .205); ball(t, .022, EM, 0, .095, .222, 0, { basic: true, noShadow: true });
    epomides(t, BK, EM);
    // great pauldrons: three layered plates and a horn curving up and back on each shoulder
    for (const [sx, nm] of [[-1, 'armL'], [1, 'armR']]) {
      const pv = pivot(b(nm), sx * .015, .01, 0); pv.rotation.z = -sx * .3;
      px(cap(pv, .13, PI * .5, BK, 0, 0), 'pauldron');
      for (let k = 0; k < 3; k++) px(tcyl(pv, .128 - k * .006, .136 - k * .006, .045, k % 2 ? BL : BK, 0, -.035 - k * .045, 0, 10), 'band');
      px(tcyl(pv, .124, .124, .014, EM, 0, -.17, 0, 10, { basic: true, noShadow: true }), 'band');
      chain(pv, [[sx * .02, .1, -.02], [sx * .05, .2, -.07], [sx * .04, .27, -.15]], .03, .008, HORN, 5);
    }
    // long tassets: overlapping plates, an ember line at each hem
    pteruges(t, 12, BK, BD, EM, { h: .34, w: .095, r: .255 });
  },
  // round 23 (Roy: "the dragon set also needs an AMULET and boots"): in the plate's language. The amulet: a chain of black
  // scales, a black claw closing round the dragon's eye (an ember gem with a slit pupil), two small horns over it
  dragon_amulet(n) {
    const BK = '#2a2430', BL = '#4a4252', EM = '#ff3a1e', HORN = '#d8ccb0';
    amuletChain(n, '#3a3440');
    const p = pivot(n, 0, .42, .215);
    const back = ball(p, .06, BK, 0, 0, -.01, 1); back.scale.set(1, 1.25, .45);
    const eye = ball(p, .04, EM, 0, 0, .012, 1, { emissive: '#7a1000' }); eye.scale.set(1, 1.2, .6);
    box(p, .012, .05, .01, '#1a0a08', 0, 0, .036, { basic: true, noShadow: true }); // the slit pupil
    for (let i = 0; i < 4; i++) { const a = -1 + i * .67, c = cone(p, .014, .06, BL, Math.sin(a) * .052, -Math.cos(a) * .052, .022, 4, { noShadow: true }); c.rotation.z = a + PI; c.rotation.x = -.3; } // the claw's talons round it
    for (const sx of [-1, 1]) chain(p, [[sx * .03, .06, 0], [sx * .05, .1, -.01], [sx * .045, .14, -.03]], .012, .004, HORN, 4);
  },
  // the boots: black scale greaves to the knee over clawed black boots, a red seam glowing down the shin, a spiked knee cop
  dragon_boots(t, b) {
    const BK = '#2a2430', BD = '#16131a', BL = '#4a4252', EM = '#ff3a1e', HORN = '#d8ccb0';
    bootPair(b, (k) => {
      bootFoot(k, BK, BD);
      px(shin(k, BK), 'greave');
      for (let row = 0; row < 4; row++) for (let i = 0; i < 8; i++) { const a = (i + (row % 2) * .5) / 8 * PI * 2, y = -.05 - row * .065, r = shinR(y) + .012; const sc = box(k, .045, .045, .014, (i + row) % 3 ? BK : BL, Math.sin(a) * r, y, Math.cos(a) * r, { noShadow: true }); sc.rotation.set(0, a, PI / 4); }
      box(k, .014, .22, .012, EM, 0, -.16, shinR(-.16) + .02, { basic: true, noShadow: true }); // the ember seam
      shinBand(k, -.03, .03, BL); shinBand(k, -.285, .03, BL);
      const cop = ball(k, .075, BK, 0, .01, .05, 1); cop.scale.set(1, .9, .7);
      const sp = cone(k, .025, .09, HORN, 0, .03, .11, 4); sp.rotation.x = HP + .3; // a horn spike off the knee
      for (const x of [-.045, 0, .045]) { const c = cone(k, .018, .07, HORN, x, -.37, .19, 4); c.rotation.x = HP; } // claws over the toes
      for (const sx of [-1, 1]) { const w = cone(k, .02, .08, BL, sx * .085, -.08, -.02, 4); w.rotation.z = -sx * 1.1; } // little wing spurs at the top
    });
  },
  // round 22 (Roy): black dragon wings in the plate's language: black bones, a dark membrane veined with ember red, ivory
  // claws. Authored in torso space; the mount (userData.wingMount) is set against her back by models.js seatBack, and
  // the two wing pivots (userData.wing = side) are spread, beaten and folded by models.js wingBeat.
  dragon_wings(t) {
    const BONE = '#18141c', MEM = '#2a1c2c', MEMD = '#120e14', EM = '#a8221c', CLAW = '#d8ccb0';
    const m = pivot(t, 0, .47, -.2); m.userData.wingMount = true;
    box(m, .17, .3, .05, BONE, 0, -.02, 0); box(m, .12, .22, .02, '#2a2430', 0, -.02, -.03);
    ball(m, .03, '#ff3a1e', 0, .05, -.045, 0, { basic: true, noShadow: true });
    for (const sx of [-1, 1]) {
      const w = pivot(m, sx * .07, .06, -.02); w.userData.wing = sx; w.rotation.order = 'YZX';
      const s = pivot(w, 0, 0, 0); s.scale.x = sx; // authored for the +x wing, mirrored for the other
      const f = pivot(s, 0, 0, 0); f.rotation.x = -HP; // shape space: x out, z up (the membrane faces back), y = thickness
      const M_ = [[0, .02], [.32, .24], [.62, .52], [1.15, .64], [.92, .38], [1.05, .18], [.8, .06], [.85, -.18], [.62, -.1], [.55, -.4], [.34, -.2], [.14, -.32], [0, -.1]];
      plate(f, M_, .018, MEM, MEMD, .02);
      const J = [[0, 0, 0], [.32, 0, .24], [.62, 0, .52]], tips = [[1.15, 0, .64], [1.05, 0, .18], [.85, 0, -.18], [.55, 0, -.4]];
      chain(f, J, .035, .026, BONE, 6);
      for (const tp of tips) {
        chain(f, [J[2], tp], .022, .009, BONE, 5);
        const v = cone(f, .012, .07, CLAW, tp[0], 0, tp[2], 4, { noShadow: true }); v.quaternion.setFromUnitVectors(_up, _a.set(tp[0] - J[2][0], 0, tp[2] - J[2][2]).normalize());
        for (const dy of [-.012, .012]) seg(f, [J[2][0] + (tp[0] - J[2][0]) * .15, dy, J[2][2] + (tp[2] - J[2][2]) * .15], [J[2][0] + (tp[0] - J[2][0]) * .6, dy, J[2][2] + (tp[2] - J[2][2]) * .6], .006, .004, EM, 3, { basic: true, noShadow: true });
      }
      const th = cone(f, .018, .1, CLAW, .62, 0, .58, 4); th.rotation.x = HP; th.rotation.z = -.4; // the thumb claw at the wrist
      ball(f, .04, BONE, .62, 0, .52, 0);
    }
  },
  // ---- footwear (knee space, one boot per knee) ----
  krepides(t, b) {
    const L = '#8a5a34', LD = '#5a3a20', LC = '#e8dcc0';
    bootPair(b, (k) => {
      bootFoot(k, L, LD);
      shin(k, L);
      tcyl(k, .102, .098, .045, LD, 0, -.02, 0, 8);
      for (const y of [-.1, -.17, -.24]) shinBand(k, y, .014, LC);
      for (const y of [-.135, -.205, -.27]) for (const s of [-1, 1]) box(k, .07, .013, .012, LC, 0, y, .09, { noShadow: true }).rotation.z = s * .6;
      for (const z of [-.01, .09]) box(k, .162, .106, .026, LC, 0, -.345, z, { noShadow: true });
    });
  },
  bronze_greaves(t, b) {
    const B = P.bronze, BL = P.bronzeL, BD = P.bronzeD;
    bootPair(b, (k) => {
      bootFoot(k, '#4a3020', '#2a1c12');
      const g = px(tcyl(k, .102, .088, .3, B, 0, -.155, .006, 9), 'greave'); g.scale.z = 1.08;
      const calf = ball(k, .085, B, 0, -.1, -.04, 1); calf.scale.set(1.12, 1.25, .95);
      const t0 = tcyl(k, .106, .106, .024, BL, 0, -.01, .006, 9); t0.scale.z = 1.08;
      const t1 = tcyl(k, .092, .092, .022, BL, 0, -.3, .006, 9); t1.scale.z = 1.08;
      const kn = ball(k, .08, B, 0, .02, .065, 1); kn.scale.set(1, .85, .7);
      ball(k, .022, BL, 0, .025, .12, 0, { noShadow: true });
      box(k, .014, .25, .012, BD, 0, -.16, .102, { noShadow: true });
    });
  },
  atalanta_boots(t, b) {
    const D = '#c89a6a', DD = '#9a6a42', FUR = '#f0e4c8', GR = '#4a8a3a', AU = '#ffc83a';
    bootPair(b, (k, sx) => {
      bootFoot(k, D, DD);
      shin(k, D);
      for (const [a, y] of [[1.7, -.08], [2.5, -.19], [3.5, -.12], [4.5, -.23], [2.2, -.27]]) ball(k, .017, FUR, Math.sin(a * sx) * .088, y, Math.cos(a) * .088, 0, { noShadow: true });
      tcyl(k, .11, .1, .07, FUR, 0, -.025, 0, 8);
      for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * PI * 2; cone(k, .022, .05, FUR, Math.sin(a) * .1, -.072, Math.cos(a) * .1, 4).rotation.x = PI; }
      for (const y of [-.13, -.2, -.265]) for (const s of [-1, 1]) box(k, .07, .013, .012, GR, 0, y, .09, { noShadow: true }).rotation.z = s * .6;
      ball(k, .03, AU, sx * .075, -.075, .07, 1, { emissive: '#4a3000' });
      box(k, .01, .022, .008, '#3a2416', sx * .075, -.042, .07, { noShadow: true });
      box(k, .026, .008, .016, GR, sx * .087, -.04, .07, { noShadow: true });
    });
  },
  // felt boots with a white fur cuff, strapped twice, and a bronze crampon under each sole
  ice_boots(t, b) {
    const F = '#5e6f80', FD = '#3a4652', FUR = '#e8e4dc', ST = '#2e3a46', BR = P.bronze;
    bootPair(b, (k) => {
      bootFoot(k, F, FD);
      shin(k, F);
      tcyl(k, .11, .1, .08, FUR, 0, -.03, 0, 8);
      for (let i = 0; i < 9; i++) { const a = (i + .5) / 9 * PI * 2; cone(k, .021, .05, FUR, Math.sin(a) * .1, -.078, Math.cos(a) * .1, 4).rotation.x = PI; }
      for (const y of [-.15, -.235]) shinBand(k, y, .018, ST);
      box(k, .16, .02, .03, ST, 0, -.33, .13, { noShadow: true }); // the strap over the instep
      box(k, .15, .012, .26, BR, 0, -.413, .045, { noShadow: true });
      for (const [x, z] of [[-.05, -.06], [.05, -.06], [-.05, .05], [.05, .05], [-.03, .15], [.03, .15]]) cone(k, .016, .045, BR, x, -.435, z, 4).rotation.x = PI;
    });
  },
  talaria(t, b) {
    const W = '#f4f0e0', AU = P.gold;
    bootPair(b, (k, sx) => {
      bootFoot(k, W, AU);
      tcyl(k, .088, .08, .21, W, 0, -.2, 0, 8);
      tcyl(k, .096, .093, .03, AU, 0, -.095, 0, 8);
      for (const y of [-.16, -.23]) shinBand(k, y, .016, AU);
      // a wing on each side of the ankle, swept back and up
      for (const s of [-1, 1]) {
        const big = s === sx ? 1.35 : 1.05;
        ball(k, .028, P.goldL, s * .088, -.27, -.03, 0, { emissive: '#4a3000' });
        const wg = pivot(k, s * .095, -.27, -.03); wg.rotation.set(0, -s * .4, HP); wg.scale.setScalar(big);
        plate(wg, [[0, .03], [.05, .02], [.12, -.04], [.18, -.14], [.15, -.17], [.11, -.13], [.11, -.21], [.07, -.17], [.05, -.23], [.01, -.15], [-.01, -.05]], .018, W, AU);
        const w2 = pivot(wg, 0, s * -.014, 0);
        plate(w2, [[.0, .0], [.06, -.02], [.1, -.08], [.07, -.1], [.03, -.07]], .014, '#ffffff', P.goldL);
      }
    });
  },
};
// =============================================================================================
// Round 30 (Roy) models: swords of every size, the five winged legendary sets (FAIRY, ANGEL, CHAOS, DEVIL and the black
// DRAGON), each with its own wings, and plain feathered wings for the sets that fly on birds' wings
// =============================================================================================
// ---- swords. "Sword variety: small, large, huge swords, both two-handed and one per hand; big and impressive is good".
// One parametric sword: the blade's outline in the x-z plane from z0 (just over the guard). o.L length, o.w half-width at
// the root, o.leaf a swell toward the middle (a gladius), o.taper where the point begins (0..1), o.narrow how much it thins
// on the way, o.curve the point's lean (+x), o.wave / o.waves a flamberge's ripple, o.back the share of the width on the
// spine side (a single-edged sabre < 1)
function swordPts(o) {
  const n = 18, z0 = o.z0 ?? .18, L = o.L, tp0 = o.taper ?? .8, nw = o.narrow || 0, R = [], Lf = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n * .94, z = z0 + u * L;
    const sw = 1 + (o.leaf || 0) * Math.sin(PI * Math.min(1, u / .8));
    const tp = u < tp0 ? 1 - nw * u : (1 - nw * tp0) * (1 - (u - tp0) / (1 - tp0) * .9);
    const hw = Math.max(.004, o.w * sw * tp);
    const cx = (o.curve || 0) * u * u + (o.wave ? Math.sin(u * PI * (o.waves || 6)) * o.wave * Math.min(1, u * 8) * (1 - u * .4) : 0);
    R.push([cx + hw, z]); Lf.push([cx - hw * (o.back ?? 1), z]);
  }
  return [...R, [(o.curve || 0) * .98, z0 + L], ...Lf.reverse()];
}
// the whole sword: grip [z0, z1, radius] round the hand at z 0, a pommel ('ball' | 'disc' | 'ring' | 'spike'), a guard
// ('cross' | 'disc' | 'wing' | 'horns' | 'ring', half-width gw), an optional ricasso (a wrapped stretch over the guard
// that a second hand can take, big swords), then the blade. o.c: colours. Returns the blade's first z (for extras).
function sword(g, o) {
  const C = { edge: P.steelL, core: P.steel, fuller: P.steelD, guard: P.bronze, guardL: P.bronzeL, grip: P.leather, wrap: P.leatherD, ...o.c };
  C.pom ||= C.guard;
  const [g0, g1, gr] = o.grip || [-.1, .13, .03], gz = g1 + .022, gw = o.gw ?? .1;
  grip(g, g0, g1, gr, C.grip, C.wrap, o.wraps || 3);
  const pr = o.pr ?? gr * 1.5, pz = g0 - pr * .7;
  if (o.pommel === 'disc') cyl0(g, pr * 1.15, pr * .75, C.pom, 0, 0, pz, 'y');
  else if (o.pommel === 'ring') { const t = M(g, torusGeo(pr * .8, pr * .28), C.pom, 0, 0, pz - pr * .4); t.rotation.x = HP; t.castShadow = true; }
  else if (o.pommel === 'spike') { ball(g, pr, C.pom, 0, 0, pz, 0); const c = cone(g, pr * .7, pr * 2.4, C.guardL, 0, 0, pz - pr * 1.5, 5); c.rotation.x = -HP; }
  else ball(g, pr, C.pom, 0, 0, pz, 1);
  if (o.guard === 'disc') cyl0(g, gw, .05, C.guard, 0, 0, gz, 'z');
  else if (o.guard === 'wing') {
    const wg = [[.02, gz - .025], [gw * .45, gz - .035], [gw * .8, gz - .015], [gw, gz + .06], [gw * .82, gz + .05], [gw * .6, gz + .07], [gw * .35, gz + .045], [.02, gz + .055]];
    plate(g, [...wg, ...mirrorX(wg)], .05, C.guard, C.guardL, .014);
    ball(g, Math.max(.035, gr * 1.2), C.guardL, 0, 0, gz + .01, 0);
  } else if (o.guard === 'horns') {
    box(g, gw * 1.3, .052, .058, C.guard, 0, 0, gz);
    for (const sx of [-1, 1]) chain(g, [[sx * gw * .6, 0, gz], [sx * gw * .95, 0, gz + .03], [sx * gw * 1.05, 0, gz + .15]], .026, .006, C.guardL, 4);
  } else if (o.guard === 'ring') { const t = M(g, torusGeo(gw * .55, .016), C.guard, 0, 0, gz); t.castShadow = true; box(g, gw * 1.3, .04, .04, C.guard, 0, 0, gz); }
  else { box(g, gw * 2, .05, .06, C.guard, 0, 0, gz); for (const sx of [-1, 1]) ball(g, .032, C.guardL, sx * gw, 0, gz, 0); }
  let z0 = gz + .03;
  if (o.ricasso) { // a wrapped stretch of the blade over the guard and two parrying lugs at its top
    px(rod(g, o.w * .55, o.w * .55, z0 - .01, z0 + o.ricasso, C.core, 6), 'core');
    grip(g, z0, z0 + o.ricasso * .8, Math.max(.026, o.w * .45), C.grip, C.wrap, 2);
    for (const sx of [-1, 1]) { const c = cone(g, .022, .07, C.guardL, sx * o.w * .9, 0, z0 + o.ricasso, 4); c.rotation.z = -sx * HP; }
    z0 += o.ricasso;
  }
  blade(g, swordPts({ ...o, z0 }), C.edge, C.core, {
    inset: o.inset ?? Math.min(.03, o.w * .32), t: o.t ?? (.026 + o.w * .1), edgeGlow: o.glow, coreGlow: o.coreGlow, edgeEm: o.edgeEm,
    fuller: o.fuller === false ? null : [C.fuller, z0 + .05, z0 + o.L * (o.fl ?? .68), Math.max(.01, o.w * .26), !!o.fullerGlow],
  });
  return z0;
}
const SWORDS = {
  // small
  gladius: { L: .6, w: .046, leaf: .22, taper: .78, grip: [-.1, .11, .031], gw: .085, guard: 'disc', pommel: 'ball', pr: .052, c: { guard: '#7a5634', guardL: '#a8865a', pom: '#8a6a44' } },
  twin_gladii: { L: .56, w: .043, leaf: .25, taper: .76, grip: [-.1, .1, .029], gw: .08, guard: 'disc', pommel: 'ball', pr: .045, c: { edge: P.bronzeL, core: P.bronze, fuller: P.bronzeD, grip: '#5a1a14', wrap: '#2a0c08', pom: P.bronzeL } },
  // curved, one-handed
  makhaira: { L: .84, w: .044, curve: .14, back: .5, taper: .7, grip: [-.11, .12, .03], gw: .09, guard: 'cross', pommel: 'ring', pr: .05, fuller: false },
  twin_makhairai: { L: .82, w: .043, curve: .17, back: .45, taper: .66, grip: [-.1, .11, .029], gw: .085, guard: 'horns', pommel: 'ring', pr: .045, fuller: false, c: { guard: P.gold, guardL: P.goldL, pom: P.gold } },
  // long and large, one-handed (with a shield)
  spatha: { L: 1.02, w: .04, taper: .88, grip: [-.12, .13, .031], gw: .12, guard: 'cross', pommel: 'disc', pr: .05 },
  broadsword: { L: 1.04, w: .085, taper: .84, narrow: .25, grip: [-.13, .13, .033], gw: .2, guard: 'wing', pommel: 'ball', pr: .055, c: { guard: P.gold, guardL: P.goldL, pom: P.gold } },
  // huge, two-handed
  rhomphaia: { L: 1.5, w: .05, curve: .16, back: .6, taper: .82, grip: [-.42, .2, .035], wraps: 5, gw: .07, guard: 'ring', pommel: 'spike', pr: .05, fuller: false },
  flamberge: { L: 1.62, w: .062, wave: .024, waves: 8, taper: .9, grip: [-.36, .2, .037], wraps: 5, gw: .24, guard: 'horns', pommel: 'ball', pr: .06, ricasso: .16, c: { edge: '#e6eef8', core: '#8a98b0' } },
  colossus_blade: { L: 2.0, w: .15, taper: .86, narrow: .15, grip: [-.46, .22, .042], wraps: 6, gw: .32, guard: 'wing', pommel: 'spike', pr: .07, ricasso: .2, t: .05, c: { edge: '#d8dce4', core: '#4a4852', guard: '#3a343c', guardL: P.bronzeL, pom: P.bronze, fuller: P.bronze } },
};
for (const [id, o] of Object.entries(SWORDS)) BUILD[id] = (g) => sword(g, o);
// the colossus blade also carries a bronze inlay down its fuller and a notch-backed spine, the way a giant's sword should
BUILD.colossus_blade = (g) => {
  const z0 = sword(g, SWORDS.colossus_blade);
  for (let i = 0; i < 6; i++) { const z = z0 + .25 + i * .22; noOL(box(g, .05, .07, .05, P.bronzeL, 0, 0, z)).rotation.y = PI / 4; }
  for (let i = 0; i < 4; i++) { const z = z0 + .3 + i * .32; plate(g, [[-.15, z], [-.2, z + .06], [-.15, z + .12]], .04, '#3a343c', '#6a646e', .01); }
};

// ---- the winged sets' weapons
// a see-through plate (fairy wings, glows): basic material, no outline, no pixel dressing
function glass(p, pts, depth, color, op = .55) {
  const m = new THREE.Mesh(flatGeo(pts, depth), mat(color, { basic: true, opacity: op })); m.castShadow = false; m.userData.noOutline = true; m.renderOrder = 2; p.add(m); return m;
}
// a plate with a glowing rim and a dark core (the chaos shards, hell's edges)
function glowPlate(p, pts, t, core, glowC, d = .012) {
  px(flat(p, pts, t, glowC, { basic: true }), 'pedge');
  return px(noOL(flat(p, inset(pts, d), t + .012, core)), 'plate');
}
// a petal (or leaf) authored along +z in the x-z plane
const petalPts = (w, l) => [[0, 0], [w * .55, l * .25], [w * .5, l * .7], [0, l], [-w * .5, l * .7], [-w * .55, l * .25]];
const featherPts = (w, l) => [[0, 0], [w * .45, l * .06], [w * .55, l * .55], [w * .4, l * .86], [w * .08, l], [-w * .3, l * .9], [-w * .42, l * .5], [-w * .3, l * .06]];
// a flower of n petals round the z axis at z, facing +z (on a sword's crossing), or facing +y with `up`
function flower(p, x, y, z, r, n, colA, colB, core, up) {
  const f = pivot(p, x, y, z); if (up) f.rotation.x = -HP;
  for (let i = 0; i < n; i++) { const pv = pivot(f, 0, 0, 0); pv.rotation.z = i / n * PI * 2; const q = flat(pv, petalPts(r * .7, r), .01, i % 2 ? colA : colB, { emissive: '#2a1a24' }); q.rotation.x = -HP; q.userData.noOutline = true; }
  ball(f, r * .3, core, 0, 0, .005, 0, { basic: true, noShadow: true });
  return f;
}
Object.assign(BUILD, {
  // FAIRY: a pair of slender stings of pale green crystal, a flower at each crossing, a vine round the root, dew on the blade
  fairy_blades(g) {
    const z0 = sword(g, { L: .8, w: .03, taper: .5, narrow: .2, grip: [-.1, .1, .026], gw: .06, guard: 'cross', pommel: 'ball', pr: .038, glow: true, fuller: false,
      c: { edge: '#d8fff0', core: '#7ad8b0', grip: '#4a8a5a', wrap: '#e8b8ff', guard: '#c8a8ff', guardL: '#ffffff', pom: '#ffb8e8' } });
    flower(g, 0, 0, z0 - .02, .07, 6, '#ffb8e8', '#ffe0f6', '#fff6a0');
    for (let i = 0; i < 6; i++) { const a = i * 1.4, z = z0 + i * .045; ball(g, .011, '#5ab06a', Math.cos(a) * .034, Math.sin(a) * .034, z, 0, { noShadow: true }); } // the vine
    for (const sx of [-1, 1]) leafAt(g, sx * .03, 0, z0 + .12, sx > 0 ? 0 : PI, .9, .07, '#6ac87a').rotation.z += sx * .4;
    for (const z of [.42, .6, .75]) noOL(ball(g, .013, '#f0fff8', .012, 0, z, 0, { basic: true, noShadow: true }));
    for (const sx of [-1, 1]) { const w = pivot(g, sx * .03, 0, z0 - .05); w.rotation.y = sx * .9; glass(w, [[0, 0], [.04, .05], [.05, .13], [.02, .15], [-.01, .07]], .006, '#c8f0ff', .6); } // two little wings at the crossing
  },
  // ANGEL: a huge white-gold greatsword: a blade of light, gold feathered wings for a guard, a halo round the crossing
  seraph_blade(g) {
    const AU = P.gold, AUL = P.goldL;
    const z0 = sword(g, { L: 1.8, w: .1, taper: .84, narrow: .22, grip: [-.4, .2, .038], wraps: 5, gw: .09, guard: 'cross', pommel: 'ball', pr: .065, ricasso: .12, glow: true, coreGlow: true, fullerGlow: true,
      c: { edge: '#fffbe8', core: '#f4ead0', fuller: '#ffe070', grip: '#f0e8d8', wrap: AU, guard: AU, guardL: AUL, pom: '#fff0a0' } });
    const gz = .242;
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { // the feathered wings of the guard, rising toward the blade
      const a = .05 + i * .2, d = [sx * Math.cos(a), Math.sin(a)], pv = pivot(g, sx * .05, 0, gz); pv.rotation.y = Math.atan2(d[0], d[1]);
      const l = .26 - i * .025; plate(pv, featherPts(.06, l), .022, i % 2 ? '#fffaf0' : '#f0e8d8', AU, .01);
    }
    const halo = noOL(M(g, torusGeo(.16, .014), '#fff0a0', 0, 0, z0 + .05, { basic: true })); halo.castShadow = false;
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; noOL(ball(g, .016, '#ffffff', Math.cos(a) * .16, Math.sin(a) * .16, z0 + .05, 0, { basic: true, noShadow: true })); }
    noOL(ball(g, .05, '#fffbe0', 0, 0, gz, 0, { basic: true }));
    for (const z of [z0 + .4, z0 + .8, z0 + 1.2]) noOL(box(g, .06, .07, .012, '#fffbe0', 0, 0, z, { basic: true })).rotation.y = PI / 4; // runes of light
  },
  // CHAOS: two jagged blades of void, rims of magenta fire, shards of broken world floating beside them
  chaos_twins(g) {
    const BK = '#140c1a', VO = '#2a1438', MG = '#ff4ad8', VI = '#9a4aff';
    grip(g, -.1, .11, .03, '#2a1a30', VI, 3);
    crystal(g, [0, 0, -.11], [0, 0, -1], .16, .04, VI, true);
    for (const sx of [-1, 1]) crystal(g, [sx * .03, 0, .13], [sx, 0, .45], .2, .032, MG, true);
    ball(g, .045, VO, 0, 0, .14, 0); noOL(ball(g, .028, MG, 0, 0, .14, 0, { basic: true }));
    const R = [], L = [];
    for (let i = 0; i <= 9; i++) { const z = .18 + i * .09, k = 1 - i / 11; R.push([(.04 + (i % 2) * .035) * k + .01, z]); L.push([-(.04 + ((i + 1) % 2) * .03) * k - .008, z + .045]); }
    blade(g, [...R, [.0, 1.12], ...L.reverse()], MG, BK, { inset: .02, t: .032, edgeGlow: true, fuller: [VI, .24, .86, .012, true] });
    for (const [x, z, s] of [[.13, .48, .9], [-.12, .66, .7], [.11, .86, .6], [-.09, 1.0, .5]]) crystal(g, [x, 0, z], [x * 2, .2, 1], .12 * s, .03 * s, s > .65 ? VI : MG, true); // shards adrift beside the blade
  },
  // DEVIL: a black trident of hell: a twisted haft, horns curling back from the socket, three barbed prongs edged in fire
  devil_trident(g) {
    const BK = '#1e0c0e', IR = '#3a1a1c', RD = '#ff3a1a', EM = '#ffb040', HORN = '#2a1414';
    chain(g, [[0, 0, -.6], [.012, 0, 0], [-.012, 0, .6], [.01, 0, 1.2], [0, 0, 1.44]], .032, .03, BK, 6);
    grip(g, -.44, -.2, .036, '#3a0e10', RD);
    for (let i = 0; i < 4; i++) { const z = .2 + i * .3; band(g, .04, z, .03, IR, { noShadow: true }); for (const a of [0, PI]) { const c = cone(g, .016, .06, IR, Math.cos(a) * .045, Math.sin(a) * .045, z, 4, { noShadow: true }); c.rotation.z = a - HP; } }
    rod(g, .04, .006, -.6, -.82, IR, 4); band(g, .042, -.6, .04, IR);
    rod(g, .04, .07, 1.4, 1.52, IR, 8); ball(g, .07, BK, 0, 0, 1.52, 1);
    for (const sx of [-1, 1]) chain(g, [[sx * .05, 0, 1.52], [sx * .14, 0, 1.5], [sx * .2, 0, 1.38], [sx * .17, 0, 1.26], [sx * .12, 0, 1.28]], .03, .006, HORN, 5); // the horns
    for (const sx of [-1, 1]) noOL(box(g, .028, .016, .02, RD, sx * .03, .06, 1.54, { basic: true })); // ember eyes on the socket
    const prong = (x, len, lean) => { // a barbed prong edged in fire
      const z1 = 1.56, pts = [[x - .025, z1], [x + .025, z1], [x + .03 + lean * .3, z1 + len * .55], [x + .065 + lean * .4, z1 + len * .5], [x + .025 + lean * .6, z1 + len * .7], [x + lean, z1 + len], [x - .03 + lean * .6, z1 + len * .62], [x - .03 + lean * .2, z1 + len * .3]];
      glowPlate(g, pts, .03, BK, RD, .011);
    };
    prong(0, .5, 0); prong(-.13, .38, -.06); prong(.13, .38, .06);
    plate(g, [[-.17, 1.53], [.17, 1.53], [.15, 1.6], [-.15, 1.6]], .04, IR, '#5a2a2a', .01);
    for (const x of [-.13, 0, .13]) { const f = cone(g, .03, .09, EM, x, 0, 1.64, 5, { basic: true }); f.rotation.x = HP; f.userData.noOutline = true; }
  },
});

// ---- the winged sets' armour. Helmets in rig.head space, amulets / cuirasses in rig.torso space, boots in knee space
// (see the notes over GEAR_BUILD). Palettes: fairy pastel green, pink and lilac; angel white and gold; chaos void black
// with magenta and violet; devil crimson and black with ember; dragon black with ember red.
const FA = { leaf: '#6ac87a', leafD: '#3a8a4a', pink: '#ffb8e8', pinkL: '#ffe0f6', lilac: '#c8a8ff', dew: '#e8fff8', gold: '#f0d878' };
const AN = { white: '#f4f4f8', whiteD: '#dcdce6', gold: P.gold, goldL: P.goldL, glow: '#fff0a0' };
const CH = { bk: '#140c1a', vo: '#2a1438', iron: '#3a2e44', mg: '#ff4ad8', vi: '#9a4aff' };
const DV = { bk: '#1e0c0e', cr: '#7a1414', crD: '#4a0a0c', iron: '#3a1a1c', ember: '#ff3a1a', fire: '#ffb040', horn: '#3a2420' };
const DR = { bk: '#2a2430', bd: '#16131a', bl: '#4a4252', em: '#ff3a1e', horn: '#d8ccb0' };
Object.assign(GEAR_BUILD, {
  // ======== FAIRY
  fairy_circlet(h) { // a cap of overlapping leaves, a circlet of flowers, two antennae with glowing tips, a dewdrop on the brow
    cap(h, .254, PI * .45, FA.leafD, .27, -.02).scale.set(1, .96, 1.05);
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, l = leafAt(h, Math.sin(a) * .2, .4, Math.cos(a) * .2 - .02, a, -.6, .16, i % 2 ? FA.leaf : '#8ad890'); l.userData.px = 'plume'; }
    const ring = M(h, torusGeo(.255, .014), FA.gold, 0, .29, -.02); ring.rotation.x = HP; ring.scale.y = 1.05; ring.castShadow = true;
    for (let i = 0; i < 7; i++) { const a = (i - 3) * .42; flower(h, Math.sin(a) * .26, .3, Math.cos(a) * .26 - .02, .07, 5, i % 2 ? FA.pink : FA.lilac, FA.pinkL, '#fff6a0').rotation.y = a; }
    for (const sx of [-1, 1]) { chain(h, [[sx * .06, .44, .1], [sx * .1, .56, .14], [sx * .16, .64, .1]], .01, .006, '#4a6a4a', 4); noOL(ball(h, .022, '#e8fff0', sx * .16, .65, .1, 0, { basic: true })); }
    noOL(ball(h, .028, '#bff4ff', 0, .32, .25, 0, { basic: true })).scale.set(.8, 1.2, .6);
  },
  fairy_amulet(n) { // a dewdrop of light caught in silver leaves
    amuletChain(n, '#d8e8e0');
    const p = pivot(n, 0, .42, .215);
    for (const sx of [-1, 1]) leafAt(p, sx * .02, .02, 0, sx > 0 ? HP : -HP, 1.2, .08, FA.leaf);
    const d = noOL(ball(p, .045, '#c8fff0', 0, -.02, .02, 1, { basic: true })); d.scale.set(.85, 1.25, .7);
    ball(p, .02, '#ffffff', -.012, .0, .045, 0, { basic: true, noShadow: true });
    flower(p, 0, .05, .02, .05, 5, FA.pink, FA.pinkL, '#fff6a0');
  },
  fairy_dress(t, b) { // petal armour: a leaf-green bodice under overlapping pink and lilac petals, a skirt of long petals
    cuirass(t, FA.leafD);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
      const a = (i + row * .5) / 9 * PI * 2, y = .52 - row * .13, pv = onCui(t, y, a, .004);
      const q = flat(pv, petalPts(.09, .14), .012, row % 2 ? FA.pink : FA.lilac, { emissive: '#2a1a24' }); q.rotation.x = HP; q.position.y = .06;
    }
    cuiBand(t, .148, .03, FA.gold); cuiBand(t, .585, .024, FA.gold);
    flower(t, 0, .47, .21, .07, 6, FA.pink, FA.pinkL, '#fff6a0');
    for (const [sx, nm] of [[-1, 'armL'], [1, 'armR']]) { const pv = pivot(b(nm), sx * .01, 0, 0); pv.rotation.z = -sx * .3; for (let i = 0; i < 5; i++) { const q = pivot(pv, 0, .03, 0); q.rotation.y = i / 5 * PI * 2; const l = flat(q, petalPts(.09, .15), .012, i % 2 ? FA.pink : FA.pinkL); l.rotation.x = .9; l.position.z = .04; } }
    belt(t, FA.leaf);
    pteruges(t, 12, FA.pink, FA.lilac, FA.pinkL, { h: .36, w: .1, r: .25, tilt: .3 });
  },
  fairy_slippers(t, b) { // soft leaf boots with curled toes, a cuff of petals and a little glass wing at each ankle
    bootPair(b, (k, sx) => {
      bootFoot(k, FA.leaf, FA.leafD);
      shin(k, '#8ad890');
      for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * PI * 2, q = pivot(k, Math.sin(a) * .095, -.04, Math.cos(a) * .095); q.rotation.y = a; const l = flat(q, petalPts(.06, .1), .01, i % 2 ? FA.pink : FA.lilac); l.rotation.x = PI - .4; }
      const toe = cone(k, .03, .1, FA.leafD, 0, -.33, .26, 5); toe.rotation.x = HP + .9;
      for (const y of [-.14, -.22]) shinBand(k, y, .014, FA.gold);
      const w = pivot(k, sx * .09, -.26, -.03); w.rotation.set(0, sx * .5, -sx * .2);
      glass(w, [[0, 0], [.05, .05], [.08, .14], [.03, .16], [-.01, .06]].map(([x, z]) => [x * sx, z]), .006, '#c8f0ff', .6);
    });
  },
  // the wings: two pairs of glass lobes (a big upper one, a smaller lower one) veined in light, a glowing rim
  fairy_wings(t) {
    wingRig(t, (f) => {
      const lobe = (pts, col, op) => { glass(f, pts, .008, col, op); for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; seg(f, [a[0], 0, a[1]], [b[0], 0, b[1]], .006, .006, '#ffffff', 3, { basic: true, noShadow: true }); } };
      const up = [[0, .02], [.2, .2], [.48, .52], [.7, .78], [.82, .84], [.88, .72], [.8, .5], [.6, .26], [.36, .08], [.1, -.04]];
      const lo = [[0, -.04], [.18, -.12], [.4, -.3], [.52, -.48], [.48, -.56], [.36, -.5], [.18, -.32], [.04, -.14]];
      lobe(up, '#c8f0ff', .42); lobe(lo, '#ffd8f4', .42);
      for (const [x, z] of [[.42, .44], [.62, .66], [.3, .24], [.7, .55]]) seg(f, [.02, .004, 0], [x, .004, z], .005, .003, '#e8fff8', 3, { basic: true, noShadow: true });
      for (const [x, z] of [[.3, -.3], [.42, -.46]]) seg(f, [.02, .004, -.04], [x, .004, z], .005, .003, '#ffe8f8', 3, { basic: true, noShadow: true });
      for (const [x, z] of [[.6, .62], [.36, .3], [.3, -.28], [.75, .7]]) noOL(ball(f, .018, '#ffffff', x, .01, z, 0, { basic: true, noShadow: true }));
    }, { hc: FA.leafD, scale: 1.1, harness: (m) => { box(m, .14, .22, .04, FA.leafD, 0, -.02, 0); flower(m, 0, .02, .02, .06, 5, FA.pink, FA.pinkL, '#fff6a0'); } });
  },
  // ======== ANGEL
  angel_helm(h) { // a white-and-gold helm with a feathered wing sweeping back from each temple and a halo of light over it
    cap(h, .262, PI * .55, AN.white, .27, -.02).scale.set(1, 1.02, 1.08);
    const br = tcyl(h, .264, .264, .045, AN.gold, 0, .29, -.02, 14); br.scale.z = 1.08;
    for (const sx of [-1, 1]) { const c = box(h, .04, .16, .13, AN.gold, sx * .21, .17, .05); c.rotation.y = sx * .35; }
    box(h, .05, .2, .04, AN.gold, 0, .4, .2).rotation.x = -.3; // the nasal ridge up over the brow
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
      const pv = pivot(h, sx * .24, .33, -.02); pv.rotation.y = sx * (HP + .5); const q = pivot(pv, 0, 0, 0); q.rotation.x = -.5 - i * .22; const q2 = pivot(q, 0, 0, 0); q2.rotation.z = HP;
      plate(q2, featherPts(.07, .26 - i * .04), .02, i % 2 ? AN.whiteD : AN.white, AN.gold, .01);
    }
    const halo = noOL(M(h, torusGeo(.2, .018), AN.glow, 0, .66, -.04, { basic: true })); halo.rotation.x = HP - .25; halo.castShadow = false;
    noOL(ball(h, .03, '#ffffff', 0, .33, .265, 0, { basic: true }));
  },
  angel_amulet(n) { // a star of eight gold rays round a core of white light
    amuletChain(n, AN.gold);
    const p = pivot(n, 0, .42, .215);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, L = i % 2 ? .06 : .1; const r = flat(pivot(p, 0, 0, 0), [[0, -.016], [L, 0], [0, .016]], .016, i % 2 ? AN.gold : AN.goldL, { emissive: '#4a3000' }); r.parent.rotation.z = a; r.rotation.x = HP; }
    noOL(ball(p, .035, '#fffbe8', 0, 0, .015, 1, { basic: true }));
  },
  angel_plate(t, b) { // white plate trimmed in gold, a sun on the breast, wings of gold feathers for pauldrons, a skirt of long white feathers
    cuirass(t, AN.white);
    cuiBand(t, .148, .036, AN.gold); cuiBand(t, .585, .028, AN.gold); cuiBand(t, .36, .02, AN.goldL);
    box(onCui(t, .42, 0, .014), .04, .3, .03, AN.gold);
    for (const sx of [-1, 1]) ball(onCui(t, .46, sx * .34, -.004), .09, AN.white, 0, 0, 0, 1).scale.set(1.05, .6, .38);
    const sun = pivot(onCui(t, .46, 0, .03), 0, 0, 0);
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; const r = flat(pivot(sun, 0, 0, 0), [[0, -.012], [i % 2 ? .05 : .08, 0], [0, .012]], .012, AN.goldL, { emissive: '#4a3000' }); r.parent.rotation.z = a; r.rotation.x = HP; }
    noOL(ball(sun, .03, '#fffbe0', 0, 0, .01, 0, { basic: true }));
    for (const [sx, nm] of [[-1, 'armL'], [1, 'armR']]) {
      const pv = pivot(b(nm), sx * .015, .01, 0); pv.rotation.z = -sx * .3;
      px(cap(pv, .12, PI * .5, AN.white, 0, 0), 'pauldron'); px(tcyl(pv, .118, .124, .03, AN.gold, 0, -.02, 0, 10), 'band');
      for (let i = 0; i < 4; i++) { const q = pivot(pv, 0, .02, -.02); q.rotation.set(-.3, sx * (-.3 + i * .3), sx * (1.2 + i * .1)); plate(q, featherPts(.06, .2 - i * .02), .018, i % 2 ? AN.whiteD : AN.white, AN.gold, .008); }
    }
    belt(t, AN.gold);
    pteruges(t, 14, AN.white, AN.whiteD, AN.gold, { h: .38, w: .085, r: .255 });
  },
  angel_greaves(t, b) { // white greaves, gold knee cops, a gold feather wing on the outside of each
    bootPair(b, (k, sx) => {
      bootFoot(k, AN.white, AN.gold);
      const g = px(tcyl(k, .1, .088, .3, AN.white, 0, -.155, .006, 9), 'greave'); g.scale.z = 1.08;
      shinBand(k, -.02, .03, AN.gold); shinBand(k, -.29, .03, AN.gold);
      const kn = ball(k, .078, AN.gold, 0, .02, .065, 1); kn.scale.set(1, .85, .7);
      box(k, .014, .24, .012, AN.goldL, 0, -.16, .1, { noShadow: true });
      for (let i = 0; i < 3; i++) { const q = pivot(k, sx * .09, -.1, -.03); q.rotation.y = PI + sx * .3; const q2 = pivot(q, 0, 0, 0); q2.rotation.x = -(.5 + i * .35); const q3 = pivot(q2, 0, 0, 0); q3.rotation.z = HP; plate(q3, featherPts(.05, .17 - i * .03), .016, AN.white, AN.gold, .008); }
    });
  },
  // great white wings: long primaries fanned from the wrist, secondaries down the arm, two rows of coverts, gold rims
  angel_wings(t) {
    wingRig(t, (f) => featherWing(f, { n1: 10, n2: 9, rows: 2, len: .8, w: 1.5, c: { arm: AN.whiteD, a: AN.white, b: '#f8f8fc', edge: '#c8ccd8', cov: '#fcfcff', tip: AN.gold, em: '#5a5a62' } }),
      { scale: 1.25, harness: (m) => { box(m, .18, .3, .05, AN.gold, 0, -.02, 0); noOL(ball(m, .04, '#fffbe0', 0, .05, -.045, 0, { basic: true })); } });
  },
  // ======== CHAOS
  chaos_crown(h) { // a void-black helm with a crown of broken crystal rising off it, some shards adrift over it, eyes of magenta light
    cap(h, .266, PI * .6, CH.bk, .27, -.02).scale.set(1, 1.03, 1.08);
    const mk = box(h, .34, .12, .06, CH.iron, 0, .22, .225); mk.rotation.x = -.15;
    for (const sx of [-1, 1]) box(h, .08, .02, .02, CH.mg, sx * .07, .215, .262, { basic: true });
    const ring = M(h, torusGeo(.262, .02), CH.iron, 0, .34, -.02); ring.rotation.x = HP; ring.scale.y = 1.07;
    for (let i = 0; i < 9; i++) { const a = (i - 4) * .36, L = .14 + (i % 3) * .07; crystal(h, [Math.sin(a) * .25, .36, Math.cos(a) * .25 - .02], [Math.sin(a) * .4, 1, Math.cos(a) * .4], L, .03, i % 2 ? CH.vi : CH.mg, true); }
    for (const [x, y, z, L] of [[.12, .74, -.04, .1], [-.16, .7, -.12, .08], [.02, .8, -.18, .07]]) crystal(h, [x, y, z], [x, 1, z], L, .022, CH.mg, true); // adrift
  },
  chaos_amulet(n) { // a black orb of nothing in a broken ring of shards, a magenta core
    amuletChain(n, CH.iron);
    const p = pivot(n, 0, .42, .215);
    ball(p, .05, CH.bk, 0, 0, 0, 1);
    noOL(ball(p, .022, CH.mg, 0, 0, .04, 0, { basic: true }));
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; crystal(p, [Math.cos(a) * .065, Math.sin(a) * .065, 0], [Math.cos(a), Math.sin(a), .2], .05, .014, i % 2 ? CH.vi : CH.mg, true); }
  },
  chaos_plate(t, b) { // black plate split by glowing magenta cracks, shards of crystal for pauldrons, a void at the heart
    cuirass(t, CH.bk);
    cuiBand(t, .148, .036, CH.iron); cuiBand(t, .585, .028, CH.iron);
    for (const sx of [-1, 1]) ball(onCui(t, .46, sx * .34, -.004), .095, CH.vo, 0, 0, 0, 1).scale.set(1.05, .6, .38);
    for (const [y, a, r, l] of [[.5, .2, .6, .14], [.38, -.3, -.5, .16], [.27, .5, .3, .12], [.44, 2.8, .7, .15], [.3, -2.6, -.4, .13], [.22, -.1, 1.1, .1]]) { const c = noOL(box(onCui(t, y, a, .012), .012, l, .01, CH.mg, 0, 0, 0, { basic: true })); c.rotation.z = r; }
    const core = ball(onCui(t, .47, 0, .02), .045, CH.bk, 0, 0, 0, 1); noOL(ball(core.parent, .022, CH.mg, 0, 0, .03, 0, { basic: true }));
    for (const [sx, nm] of [[-1, 'armL'], [1, 'armR']]) {
      const pv = pivot(b(nm), sx * .015, .01, 0); pv.rotation.z = -sx * .3;
      px(cap(pv, .124, PI * .5, CH.vo, 0, 0), 'pauldron'); px(tcyl(pv, .12, .128, .04, CH.iron, 0, -.03, 0, 10), 'band');
      for (const [a, L] of [[-.4, .16], [0, .22], [.4, .14]]) crystal(pv, [sx * .03, .08, a * .1], [sx * .5, 1, a], L, .03, CH.vi, true);
    }
    belt(t, CH.iron);
    pteruges(t, 12, CH.bk, CH.vo, CH.mg, { h: .34, w: .09, r: .255 });
  },
  chaos_greaves(t, b) {
    bootPair(b, (k) => {
      bootFoot(k, CH.bk, CH.vo);
      px(shin(k, CH.vo), 'greave');
      box(k, .014, .22, .012, CH.mg, 0, -.16, shinR(-.16) + .02, { basic: true, noShadow: true });
      shinBand(k, -.03, .03, CH.iron); shinBand(k, -.285, .03, CH.iron);
      const cop = ball(k, .075, CH.bk, 0, .01, .05, 1); cop.scale.set(1, .9, .7);
      crystal(k, [0, .03, .1], [0, .6, 1], .12, .024, CH.mg, true);
      for (const sx of [-1, 1]) crystal(k, [sx * .08, -.12, -.02], [sx, .3, -.4], .1, .02, CH.vi, true);
    });
  },
  // shard wings: no membrane and no feathers, a wing's shape made of broken black plates edged in magenta fire, the gaps
  // between them open, a few shards drifting off the tip
  chaos_wings(t) {
    wingRig(t, (f) => {
      const J = [[0, 0, 0], [.3, 0, .26], [.62, 0, .5]];
      chain(f, J, .03, .022, CH.iron, 5);
      const shards = [
        [[.04, .06], [.26, .3], [.2, .02], [.08, -.06]], [[.3, .32], [.58, .56], [.5, .26], [.28, .2]], [[.62, .56], [1.0, .74], [.82, .44], [.6, .44]],
        [[.66, .4], [.98, .38], [.9, .14], [.62, .26]], [[.6, .2], [.86, .02], [.7, -.14], [.52, .06]], [[.48, .02], [.6, -.26], [.42, -.34], [.36, -.04]],
        [[.3, -.06], [.36, -.4], [.2, -.32], [.16, -.06]], [[.12, -.1], [.12, -.3], [.02, -.2], [.02, -.08]], [[.24, .14], [.44, .18], [.4, -.02], [.22, 0]],
      ];
      shards.forEach((s, i) => glowPlate(f, s, .022, i % 3 ? CH.bk : CH.vo, i % 2 ? CH.mg : CH.vi, .014));
      for (const [x, z, L] of [[1.12, .82, .12], [1.08, .5, .09], [.98, .16, .08]]) crystal(f, [x, 0, z], [1, 0, .4], L, .025, CH.mg, true);
    }, { scale: 1.15, harness: (m) => { box(m, .17, .3, .05, CH.bk, 0, -.02, 0); noOL(ball(m, .035, CH.mg, 0, .05, -.045, 0, { basic: true })); } });
  },
  // ======== DEVIL
  devil_helm(h) { // a crimson-black helm with great horns curling back and out, a fanged visor, ember eyes
    cap(h, .268, PI * .62, DV.cr, .27, -.02).scale.set(1, 1.04, 1.08);
    const mk = box(h, .34, .13, .06, DV.bk, 0, .22, .225); mk.rotation.x = -.15;
    for (const sx of [-1, 1]) { box(h, .085, .022, .02, DV.ember, sx * .07, .225, .262, { basic: true }); for (const dx of [-.04, 0, .04]) { const f = cone(h, .012, .05, DV.horn, sx * .05 + dx * .5, .15, .25, 4, { noShadow: true }); f.rotation.x = PI; } }
    for (const sx of [-1, 1]) chain(h, [[sx * .17, .4, .04], [sx * .32, .46, .02], [sx * .42, .6, -.04], [sx * .4, .76, -.12], [sx * .3, .84, -.16], [sx * .24, .8, -.1]], .06, .01, '#3a2420', 6); // the great horns, curling up and in
    for (const z of [.14, 0, -.14, -.26]) { const c = cone(h, .03, .1, DV.bk, 0, .52 - Math.abs(z) * .1, z, 4); c.rotation.x = -.3; }
    noOL(ball(h, .03, DV.fire, 0, .35, .245, 0, { basic: true }));
  },
  devil_amulet(n) { // a burning heart of brimstone gripped in a black horned claw
    amuletChain(n, DV.iron);
    const p = pivot(n, 0, .42, .215);
    const ht = ball(p, .045, DV.ember, 0, 0, .01, 1, { emissive: '#7a1000' }); ht.scale.set(1.1, 1, .6);
    noOL(ball(p, .022, DV.fire, 0, .01, .035, 0, { basic: true }));
    for (let i = 0; i < 4; i++) { const a = -1 + i * .67, c = cone(p, .014, .07, DV.bk, Math.sin(a) * .055, -Math.cos(a) * .055, .02, 4, { noShadow: true }); c.rotation.z = a + PI; c.rotation.x = -.3; }
    for (const sx of [-1, 1]) chain(p, [[sx * .03, .05, 0], [sx * .07, .09, -.01], [sx * .06, .13, -.03]], .013, .004, DV.horn, 4);
  },
  devil_plate(t, b) { // crimson plate ridged like ribs, spiked black pauldrons, ember in the seams, a skirt of black blades
    cuirass(t, DV.cr);
    for (let i = 0; i < 5; i++) { const y = .26 + i * .065; for (const sx of [-1, 1]) { const r = box(onCui(t, y, sx * .45, .012), .16, .022, .02, DV.bk, 0, 0, 0); r.rotation.z = sx * .25; } }
    box(onCui(t, .4, 0, .016), .05, .34, .03, DV.bk);
    for (const sx of [-1, 1]) box(onCui(t, .5, sx * .2, .02), .1, .012, .01, DV.ember, 0, 0, 0, { basic: true, noShadow: true }).rotation.z = sx * .5;
    cuiBand(t, .148, .036, DV.bk); cuiBand(t, .585, .028, DV.bk);
    ball(onCui(t, .49, 0, .03), .036, DV.ember, 0, 0, 0, 1, { basic: true });
    for (let i = 0; i < 4; i++) { const c = cone(onCui(t, .52 - i * .1, PI, -.004), .022, .07, DV.horn, 0, 0, .02, 4, { noShadow: true }); c.rotation.x = HP + .5; }
    for (const [sx, nm] of [[-1, 'armL'], [1, 'armR']]) {
      const pv = pivot(b(nm), sx * .015, .01, 0); pv.rotation.z = -sx * .3;
      px(cap(pv, .13, PI * .5, DV.bk, 0, 0), 'pauldron');
      for (let k = 0; k < 2; k++) px(tcyl(pv, .128 - k * .006, .136 - k * .006, .05, k % 2 ? DV.crD : DV.cr, 0, -.04 - k * .05, 0, 10), 'band');
      for (const [a, L] of [[-.5, .12], [0, .17], [.5, .12]]) { const c = cone(pv, .025, L, DV.horn, sx * .02, .09, a * .1, 4); c.rotation.set(a * .5, 0, -sx * .4); }
    }
    belt(t, DV.bk);
    pteruges(t, 12, DV.bk, DV.crD, DV.ember, { h: .34, w: .09, r: .255 });
  },
  devil_greaves(t, b) { // black greaves with a crimson shin, spiked knees and cloven, clawed toes
    bootPair(b, (k) => {
      bootFoot(k, DV.bk, DV.crD);
      px(shin(k, DV.cr), 'greave');
      box(k, .014, .22, .012, DV.ember, 0, -.16, shinR(-.16) + .02, { basic: true, noShadow: true });
      shinBand(k, -.03, .03, DV.bk); shinBand(k, -.285, .03, DV.bk);
      const cop = ball(k, .075, DV.bk, 0, .01, .05, 1); cop.scale.set(1, .9, .7);
      const sp = cone(k, .028, .12, DV.horn, 0, .04, .12, 4); sp.rotation.x = HP + .4;
      for (const x of [-.04, .04]) { const c = cone(k, .022, .08, DV.horn, x, -.37, .2, 4); c.rotation.x = HP; }
      for (const sx of [-1, 1]) { const c = cone(k, .02, .09, DV.horn, sx * .09, -.1, -.02, 4); c.rotation.z = -sx * 1.2; }
    });
  },
  // ragged crimson membranes on black bone, hooked claws at every finger, spines down the leading edge, ember veins
  devil_wings(t) {
    wingRig(t, (f) => {
      const MEM = [[0, .02], [.3, .26], [.6, .52], [1.1, .7], [.98, .5], [1.02, .4], [.9, .3], [1.0, .1], [.84, .04], [.86, -.12], [.72, -.06], [.66, -.26], [.56, -.16], [.5, -.42], [.38, -.26], [.26, -.36], [.16, -.2], [0, -.12]];
      plate(f, MEM, .018, DV.cr, DV.crD, .02);
      const J = [[0, 0, 0], [.3, 0, .26], [.6, 0, .52]], tips = [[1.1, 0, .7], [1.0, 0, .1], [.86, 0, -.12], [.5, 0, -.42]];
      chain(f, J, .036, .026, DV.bk, 6);
      for (const tp of tips) { chain(f, [J[2], tp], .022, .009, DV.bk, 5); const v = cone(f, .016, .1, DV.horn, tp[0], 0, tp[2], 4, { noShadow: true }); v.quaternion.setFromUnitVectors(_up, _a.set(tp[0] - J[2][0], 0, tp[2] - J[2][2]).normalize()); }
      for (const tp of tips) seg(f, [J[2][0] + (tp[0] - J[2][0]) * .2, .012, J[2][2] + (tp[2] - J[2][2]) * .2], [J[2][0] + (tp[0] - J[2][0]) * .7, .012, J[2][2] + (tp[2] - J[2][2]) * .7], .006, .004, DV.ember, 3, { basic: true, noShadow: true });
      for (let i = 1; i < 6; i++) { const u = i / 6, x = J[1][0] * u * 2 > .6 ? .6 : .6 * u, z = .52 * u; const c = cone(f, .018, .07, DV.horn, x, 0, z + .02, 4); c.rotation.x = HP; c.rotation.z = .5; } // spines on the leading edge
      const th = cone(f, .022, .14, DV.horn, .62, 0, .6, 4); th.rotation.x = HP; th.rotation.z = -.5;
    }, { scale: 1.12, harness: (m) => { box(m, .17, .3, .05, DV.bk, 0, -.02, 0); ball(m, .03, DV.ember, 0, .05, -.045, 0, { basic: true, noShadow: true }); } });
  },
  // ======== the BLACK DRAGON (round 30: the set grows a helm and a shield and goes up to level 150)
  dragon_helm(h) { // a dragon's head: a black scaled skull, a snout visor over the face, horns swept back, ember eyes, a crest of scales
    cap(h, .268, PI * .62, DR.bk, .27, -.02).scale.set(1, 1.04, 1.1);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 10; i++) { const a = (i + row * .5) / 10 * PI * 2, y = .36 + row * .07, r = .25 - row * .05; const s = box(h, .06, .06, .016, (i + row) % 3 ? DR.bk : DR.bl, Math.sin(a) * r, y, Math.cos(a) * r * 1.08 - .02, { noShadow: true }); s.rotation.set(0, a, PI / 4); }
    const sn = box(h, .26, .1, .14, DR.bl, 0, .2, .25); sn.rotation.x = -.2; // the snout visor
    for (const sx of [-1, 1]) { box(h, .07, .022, .02, DR.em, sx * .085, .27, .3, { basic: true }); for (const dx of [0, .05]) { const f = cone(h, .011, .045, DR.horn, sx * (.04 + dx), .14, .3, 4, { noShadow: true }); f.rotation.x = PI; } }
    for (const sx of [-1, 1]) chain(h, [[sx * .14, .42, .04], [sx * .22, .5, -.08], [sx * .26, .56, -.24], [sx * .24, .58, -.36]], .04, .006, DR.horn, 5);
    for (let i = 0; i < 5; i++) { const z = .12 - i * .1, c = cone(h, .026, .09 - i * .008, DR.bl, 0, .53 - i * .02, z, 4); c.rotation.x = -.4; } // the crest
  },
});
// the black dragon's wings, grown (round 30): a third bigger, spines down the leading edge, more claws
{
  const old = GEAR_BUILD.dragon_wings;
  GEAR_BUILD.membrane_wings = old; // (the plain membrane pair the bat-winged sets wear)
  GEAR_BUILD.dragon_wings = (t) => {
    old(t);
    t.traverse((o) => {
      if (!o.userData.wing) return;
      const s = o.children[0]; s.scale.set(s.scale.x * 1.32, 1.32, 1.32);
      const f = s.children[0];
      for (let i = 1; i < 7; i++) { const u = i / 7, c = cone(f, .02, .08, DR.horn, .62 * u, 0, .52 * u + .03, 4); c.rotation.x = HP; c.rotation.z = .4; }
      for (const [x, z] of [[.3, .27], [.62, .53]]) { const c = cone(f, .025, .1, DR.horn, x, 0, z + .04, 4); c.rotation.x = HP; c.rotation.z = -.2; }
    });
  };
}
// plain feathered wings (the bird-winged sets: harpy, owl, Hermes, Heracles' Stymphalian birds, the Olympians...), pale so a
// set's tint takes; and the helper the angel's grander pair uses
function featherWing(f, o) {
  const C = o.c, n1 = o.n1 || 7, n2 = o.n2 || 6, len = o.len || .62;
  const J = [[0, 0, 0], [.3, 0, .24], [.58, 0, .42]];
  chain(f, J, .04, .03, C.arm, 6);
  const k = o.w || 1, put = (x, z, th, w, l, col, y = 0, edge = C.edge) => { const pv = pivot(f, x, y, z); pv.rotation.y = Math.atan2(Math.cos(th), Math.sin(th)); return plate(pv, featherPts(w * k, l), .016, col, edge, .008, C.em ? { emissive: C.em } : undefined); };
  for (let i = 0; i < n1; i++) { const u = i / (n1 - 1), th = .62 - u * 1.2; put(.58 - u * .06, .42 - u * .05, th, .1, len * (1 - .25 * u), i % 2 ? C.a : C.b, -.004 * (i % 2), C.tip || C.edge); } // primaries off the wrist
  for (let i = 0; i < n2; i++) { const u = (i + .5) / n2, th = -.62 - u * .8; put(.52 * (1 - u), .4 * (1 - u), th, .11, len * (.62 - .12 * u), i % 2 ? C.a : C.b, .006); } // secondaries down the arm
  for (let r = 0; r < (o.rows || 1); r++) for (let i = 0; i < n2 + 2; i++) { const u = i / (n2 + 1), th = -.3 - u * 1.0 + r * .1; put(.58 * (1 - u), .42 * (1 - u) + .02, th, .09, len * (.3 - r * .06), C.cov, .014 + r * .006); } // coverts over the arm
}
function wingRig(t, fill, o = {}) {
  const m = pivot(t, 0, .47, -.2); m.userData.wingMount = true;
  if (o.harness) o.harness(m); else box(m, .16, .28, .05, o.hc || '#5a5048', 0, -.02, 0);
  for (const sx of [-1, 1]) {
    const w = pivot(m, sx * .07, .06, -.02); w.userData.wing = sx; w.rotation.order = 'YZX';
    const s = pivot(w, 0, 0, 0); s.scale.set(sx * (o.scale || 1), o.scale || 1, o.scale || 1); // authored for the +x wing, mirrored for the other
    const f = pivot(s, 0, 0, 0); f.rotation.x = -HP; // shape space: x out, z up (the wing faces back), y = thickness
    fill(f, sx);
  }
  return m;
}
// Hermes' petasos: the pilos with a small white wing on each side
GEAR_BUILD.hermes_helm = (h) => {
  GEAR_BUILD.pilos_helm(h);
  for (const sx of [-1, 1]) { const q = pivot(h, sx * .25, .34, -.02); q.rotation.y = sx * (HP + .6); for (let i = 0; i < 3; i++) { const q2 = pivot(q, 0, 0, 0); q2.rotation.x = -.4 - i * .3; const q3 = pivot(q2, 0, 0, 0); q3.rotation.z = HP; plate(q3, featherPts(.06, .2 - i * .04), .016, '#f4f0e0', P.gold, .008); } }
};
GEAR_BUILD.feather_wings = (t) => wingRig(t, (f) => featherWing(f, { c: { arm: '#b8b0a4', a: '#e8e2d8', b: '#d8d0c4', edge: '#8a8278', cov: '#f2ece2' } }), { hc: '#6a6058' });

// ---- the winged sets' shields (in F: x up the arm, z across, +y out of the face)
Object.assign(SHIELD_BUILD, {
  fairy(F) { // a great leaf, veined, a flower at its heart and dew on it
    const leaf = [[-.5, 0], [-.36, .2], [-.08, .3], [.2, .26], [.42, .14], [.56, 0], [.42, -.14], [.2, -.26], [-.08, -.3], [-.36, -.2]];
    px(flat(F, leaf.map(([x, z]) => [x * 1.05, z * 1.08]), .04, FA.leafD), 'rim').castShadow = true;
    px(flat(F, leaf, .05, FA.leaf), 'plate').position.y = .006;
    noOL(box(F, .9, .012, .02, '#d8f8c0', .02, .034, 0));
    for (const x of [-.3, -.1, .1, .3]) for (const s of [-1, 1]) { const v = noOL(box(F, .2, .01, .014, '#c8f0b0', x + .06, .034, s * .08)); v.rotation.y = s * .7; }
    flower(F, 0, .05, 0, .12, 6, FA.pink, FA.pinkL, '#fff6a0', true);
    for (const [x, z] of [[.3, .1], [-.25, -.12], [.15, -.15]]) noOL(ball(F, .025, FA.dew, x, .045, z, 0, { basic: true, noShadow: true }));
  },
  angel(F) { // a white kite of light: gold rays, a burning star at the boss, a fringe of small white feathers
    const kite = [[.5, 0], [.36, .3], [-.1, .32], [-.56, 0], [-.1, -.32], [.36, -.3]];
    px(flat(F, kite.map(([x, z]) => [x * 1.05, z * 1.08]), .045, AN.gold), 'rim').castShadow = true;
    px(flat(F, kite, .055, AN.white), 'plate').position.y = .006;
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; const r = noOL(flat(F, [[0, -.025], [i % 2 ? .18 : .28, 0], [0, .025]], .012, AN.goldL, { emissive: '#4a3000' })); r.position.y = .036; r.rotation.y = -a; }
    const st = noOL(ball(F, .09, '#fffbe0', 0, .06, 0, 1, { basic: true })); st.scale.set(1, .5, 1); st.userData.boss = true;
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2, q = pivot(F, Math.cos(a) * .44, 0, Math.sin(a) * .3); q.rotation.y = -a + HP; plate(q, featherPts(.05, .12), .012, AN.white, AN.gold, .006); }
  },
  chaos(F) { // a shattered round: broken plates of void with open seams of magenta between them, a black hole at the boss
    for (let i = 0; i < 7; i++) {
      const a0 = i / 7 * PI * 2 + .05, a1 = (i + 1) / 7 * PI * 2 - .05, r0 = .14, r1 = .46 + (i % 2) * .04, pts = [];
      for (let k = 0; k <= 4; k++) { const a = a0 + (a1 - a0) * k / 4; pts.push([Math.cos(a) * r1, Math.sin(a) * r1]); }
      for (let k = 4; k >= 0; k--) { const a = a0 + (a1 - a0) * k / 4; pts.push([Math.cos(a) * r0, Math.sin(a) * r0]); }
      glowPlate(F, pts, .05, i % 2 ? CH.bk : CH.vo, i % 2 ? CH.mg : CH.vi, .016);
    }
    const hole = noOL(ball(F, .12, '#05030a', 0, .02, 0, 1)); hole.scale.set(1, .4, 1); hole.userData.boss = true;
    const rg = noOL(M(F, torusGeo(.13, .014), CH.mg, 0, .04, 0, { basic: true })); rg.rotation.x = HP; rg.userData.boss = true;
    for (const [x, z] of [[.5, .2], [-.48, -.22], [.12, -.52]]) crystal(F, [x, .02, z], [x, .2, z], .1, .025, CH.mg, true);
  },
  devil(F) { // a black spiked aspis with a horned crimson face, ember eyes, a ring of iron spikes round the rim
    const d = px(ball(F, .46, DV.bk, 0, 0, 0, 2), 'shieldface'); d.scale.set(1, .2, 1);
    const rim = M(F, torusGeo(.46, .04), DV.iron, 0, 0, 0); rim.rotation.x = HP; rim.castShadow = true;
    for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2, c = cone(F, .03, .12, DV.horn, Math.cos(a) * .5, 0, Math.sin(a) * .5, 4); c.rotation.order = 'YXZ'; c.rotation.y = -Math.atan2(Math.sin(a), Math.cos(a)) + HP; c.rotation.x = HP; }
    const face = ball(F, .17, DV.cr, 0, .07, 0, 1); face.scale.set(1.1, .45, 1); face.userData.boss = true;
    for (const s of [-1, 1]) { noOL(ball(F, .025, DV.fire, .05, .13, s * .06, 0, { basic: true })).userData.boss = true; const h = chain(F, [[.1, .08, s * .1], [.22, .1, s * .2], [.3, .1, s * .16]], .03, .006, DV.horn, 4); }
    for (const dz of [-.04, 0, .04]) { const f = noOL(cone(F, .012, .04, '#e8dcc0', -.08, .12, dz, 4)); f.rotation.z = -HP; f.userData.boss = true; }
  },
  dragon(F) { // a kite of overlapping black scales, a dragon's skull at the boss with ember eyes, its wings spread round the edge
    const kite = [[.52, 0], [.34, .32], [-.12, .34], [-.58, 0], [-.12, -.34], [.34, -.32]];
    px(flat(F, kite.map(([x, z]) => [x * 1.05, z * 1.08]), .045, DR.bl), 'rim').castShadow = true;
    px(flat(F, kite, .055, DR.bd), 'plate').position.y = .006;
    for (let r = 0; r < 6; r++) for (let i = -3; i <= 3; i++) { const x = .36 - r * .15, z = i * .085 + (r % 2) * .04; if (Math.abs(z) > .3 - Math.abs(x) * .3) continue; const s = noOL(flat(F, [[x - .04, z], [x, z + .04], [x + .04, z], [x, z - .04]], .012, (r + i) % 3 ? DR.bk : DR.bl)); s.position.y = .036; }
    const sk = ball(F, .12, DR.bk, .04, .07, 0, 1); sk.scale.set(1.3, .45, .9); sk.userData.boss = true;
    for (const s of [-1, 1]) { noOL(box(F, .03, .012, .04, DR.em, .08, .12, s * .045, { basic: true })).userData.boss = true; chain(F, [[.1, .08, s * .06], [.2, .1, s * .12], [.3, .08, s * .1]], .025, .005, DR.horn, 4); }
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const c = noOL(cone(F, .015, .05, DR.horn, -.04 - i * .06, .1, s * .02, 4)); c.rotation.z = -HP; c.userData.boss = true; }
  },
});
const GEAR_SOCKET = { head: ['helmSocket', 'head'], neck: ['neckSocket', 'torso'], body: ['bodySocket', 'torso'], feet: ['feetSocket', 'torso'], back: ['backSocket', 'torso'] };
export function makeGearModel(id) {
  const G = GEAR[id] || itemOf(id);
  BUILD_CTX.item = G || null;
  if (G?.slot === 'shield') { const sh = makeShield(G.kind, G.rarity, G.tint, G.grade); Object.assign(sh.userData, { gear: id, slot: 'shield' }); return sh; } // (models.js equipGear 'shield' puts it on her arm or her back)
  const root = new THREE.Group(); root.name = 'gear:' + id;
  const slot = G ? G.slot : 'head';
  // limb parts: one group per rig bone, placed at that bone's rest offset; equipGear moves them onto the bone
  const bone = (name) => { const g = pivot(root, ...GEAR_BONE_REST[name]); g.userData.bone = name; return g; };
  // helmets are authored in rig.head space and amulets in rig.torso space, but their sockets sit at the skull centre
  // (head y .19) and the pendant spot (torso 0, .5, .175), see GEAR_DIMS in models.js
  const host = slot === 'head' ? pivot(root, 0, -.19, 0) : slot === 'neck' ? pivot(root, 0, -.5, -.175) : root;
  const bid = G?.model || G?.baseId || id; // (a graded or retinted piece wears its base's model; a catalog piece its identity's)
  (GEAR_BUILD[bid] || GEAR_BUILD.leather_cap)(host, bone);
  if (G?.tint) tintTree(root, G.tint, .5);
  if (PXART) pxArms(root, bid, G?.rarity);
  glowTree(root, G?.grade);
  addOutline(root, SKIP);
  const [socket, space] = GEAR_SOCKET[slot] || GEAR_SOCKET.head;
  root.userData = { gear: id, slot, socket, space, outlined: true };
  if (slot === 'back' && G?.flight !== undefined) wingTier(root, G.flight, itemLevel(G));
  return root;
}
// capes2 (Roy: "small wings from 30 to 70, seen but they don't make you fly; from 70 they fly, and the higher the wing the
// bigger and more impressive"): a catalog wing is drawn at the size its level gives it. Small wings (30-69) at about half
// their size, growing a little through their levels; flight wings (70 and up) from .85 of their size at 70 to 1.3 at the
// cap, so the same pair grows as its level does and the sets' great wings stand over the first flight pair. The model
// says which it is (userData.flight: models.js hoverRig lifts her only on flight wings) and at what level.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const wingSpan = (flight, L) => (flight ? .85 + .45 * Math.pow(clamp01((L - 70) / (MAX_LEVEL - 70)), .8) : .5 + .12 * clamp01((L - 30) / 39));
function wingTier(root, flight, L) {
  const s = wingSpan(flight, L);
  root.traverse((o) => { if (o.userData.wing) o.scale.multiplyScalar(s); });
  Object.assign(root.userData, { flight: !!flight, wingLv: L, span: s });
}

// ---------------------------------------------------------------------------------------------
// pixel-art dressing (round 16; ?art=off keeps the flat colours). pxArms gives every lit part of a weapon, shield or gear
// model a small canvas texture hand-shaded from ramp(its colour): metal with rolled rims, rivets, ridges, glints and (by
// rarity) an engraved Greek key, wood grain, wound grips, stitched leather, cloth strands, fur tufts, scales, feathers and
// gem facets. The look comes from the part's shape (texels sized to it, PXD a metre), its colour's family and the role the
// builders tag with px(). Geometry, grips and sockets stay as they are; textures and materials are cached, painted once.
// ---------------------------------------------------------------------------------------------
const PXD = 128;
const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 }, METAL = { bronze: 1, gold: 1, steel: 1, iron: 1 };
// per item: colours (or role + colour) whose family the colour alone gets wrong
const PXFAM = {
  // round 30: feathered wings read as feathers, the angel's whites as polished white metal
  feather_wings: { 'plate#e8e2d8': 'feather', 'plate#d8d0c4': 'feather', 'plate#f2ece2': 'feather' }, hermes_helm: { 'plate#f4f0e0': 'feather' },
  devil_helm: { '#7a1414': 'bronze', '#3a2420': 'bone' }, devil_plate: { '#7a1414': 'bronze', '#4a0a0c': 'bronze', '#3a2420': 'bone' }, devil_greaves: { '#7a1414': 'bronze', '#3a2420': 'bone' }, devil_wings: { '#3a2420': 'bone' }, devil_trident: { '#3a2420': 'bone' },
  angel_wings: { 'plate#f4f4f8': 'feather', 'plate#f8f8fc': 'feather', 'plate#fcfcff': 'feather' }, fairy_dress: { '#6ac87a': 'cloth', '#3a8a4a': 'cloth' }, fairy_circlet: { '#3a8a4a': 'cloth' },
  nemean_pelt: { '#d8a048': 'fur', '#a8702a': 'fur', '#f0c878': 'fur', '#8a4a1c': 'fur', '#a85a20': 'fur' }, fleece_amulet: { '#ffc83a': 'fur', '#f0b830': 'fur' },
  atalanta_boots: { '#f0e4c8': 'fur' }, ice_boots: { '#e8e4dc': 'fur', '#5e6f80': 'cloth', '#3a4652': 'leather' }, krepides: { '#e8dcc0': 'leather' }, talaria: { '#f4f0e0': 'leather', 'plate#f4f0e0': 'feather', 'plate#ffffff': 'feather' },
  linen_cuirass: { '#e8dcc0': 'linen', '#cdbf9c': 'linen', '#f4ead4': 'linen' }, scale_cuirass: { '#2f8a5e': 'scale', '#1d5a3c': 'scale', '#5ac88a': 'scale' },
  serpent_amulet: { '#3ac06a': 'scale', '#2a9a5a': 'scale' }, medusa_fangs: { '#4f8f44': 'scale', '#6a5a2a': 'bronze' }, poseidon_trident: { '#bfe8f0': 'steel' }, tide_trident: { '#3e7a68': 'bronze', '#4f8a76': 'bronze', '#5f9a86': 'bronze' },
  hermes_blades: { 'plate#f4f6fa': 'feather' }, dragon_fangs: { '#3a2e3e': 'scale' }, round: { '#8a1a14': 'paint', '#5a2a14': 'paint' }, shell: { '#d8b49a': 'shell', '#f2e4d2': 'shell', '#c89a7a': 'shell' },
};
// the inlay of an item's engraving (otherwise it is cut dark into its own metal)
const PXACC = {
  owl_helm: P.gold, darkness_helm: '#c07cff', achilles_helm: '#ff5a2a', thracian_helm: P.gold, spartan_helm: '#c0242c', linen_cuirass: '#2f7f9a', scale_cuirass: P.gold, owl_amulet: P.gold,
  hades_axe: '#c07cff', keres_scythe: '#b48cff', kronos_scythe: P.gold, athena_xiphos: P.gold, ares_warbringer: '#e8202e', poseidon_trident: '#4ad8f0', tide_trident: '#8fffe0', hermes_blades: P.gold,
  perseus_harpe: P.gold, medusa_fangs: '#6aff3a', dragon_fangs: '#ff5a3a', sun_and_moon: P.gold, erinyes_sickles: P.gold, keraunos: '#9fe8ff', crescent: '#cfd4dc',
};
const _hs = {}, _cc = new THREE.Color();
function famOf(hex) { // a colour's material: warm and saturated = bronze/gold, greys = steel/iron/stone, pale and warm = bone...
  _cc.set(hex).getHSL(_hs); const h = _hs.h * 360, s = _hs.s, l = _hs.l;
  if (h >= 22 && h <= 58 && s >= .48 && l >= .3 && l <= .8) return h >= 38 ? 'gold' : 'bronze';
  if (l < .16) return (h < 50 || h > 340) && s > .25 ? 'leather' : 'iron';
  if (l > .74) return s < .08 || (h > 170 && h < 270) ? 'steel' : 'bone';
  if (s < .14 || (h > 180 && h < 270 && s < .36)) return l < .33 ? 'iron' : h > 15 && h < 70 && s > .04 ? 'stone' : 'steel';
  return (h < 15 || h > 340) && s > .55 ? 'cloth' : h < 45 || h > 340 ? 'leather' : 'cloth';
}
const KEY = ['#####.', '....#.', '###.#.', '#...#.', '#.####']; // a Greek key, 6 texels a repeat
// an engraved key band, rows y-2..y+7: lines cut dark (or inlaid with the item's accent), a lit lip under each cut
function pxKey(c, k, y, x0 = 0, x1 = c.W) {
  const ink = k.A ? k.A[k.fam === 'iron' ? 2 : 3] : k.T[1], lip = k.T[5], on = (x, j) => j < 5 && KEY[j][((x - x0) % 6 + 6) % 6] === '#';
  c.R(x0, y - 2, x1 - x0, 1, ink); c.R(x0, y - 1, x1 - x0, 1, lip); c.R(x0, y + 6, x1 - x0, 1, ink); c.R(x0, y + 7, x1 - x0, 1, lip);
  for (let x = x0; x < x1; x++) for (let j = 0; j < 5; j++) if (on(x, j)) { c.P(x, y + j, ink); if (!on(x, j + 1)) c.P(x, y + j + 1, lip); }
}
function pxWalk(c, col, n) { let x = c.rnd() * c.W | 0, y = c.rnd() * c.H | 0; for (let i = 0; i < n; i++) { c.P(x, y, col); if (c.rnd() < .5) x += c.rnd() < .5 ? 1 : -1; else y++; } } // a crack
// the family's surface over the whole canvas, T = ramp(colour, 6) darkest first; across: grain and strands run along u, not v
function pxFill(c, fam, T, across) {
  const { W, H, R, P, rnd } = c, A = W * H, at = across ? (a, b, col) => P(b, a, col) : P, LU = across ? H : W, LV = across ? W : H;
  R(0, 0, W, H, T[{ bone: 4, shell: 4, linen: 4, feather: 4, fur: 2 }[fam] ?? 3]);
  if (METAL[fam]) for (let i = A / 64 | 0; i--;) { const a = rnd() * LU | 0, b = rnd() * LV | 0, col = rnd() < .65 ? T[4] : T[2]; at(a, b, col); at(a, b + 1, col); } // a few brushed scratches along the part
  else if (fam === 'wood') for (let a = 0; a < LU; a++) { const b = rnd() * LV | 0, n = 3 + rnd() * LV * .6 | 0, col = rnd() < .7 ? T[2] : T[4]; for (let j = 0; j < n; j++) at(a, b + j, col); }
  else if (fam === 'leather' || fam === 'paint') for (let i = A / 24 | 0; i--;) { const x = rnd() * W | 0, y = rnd() * H | 0; if (rnd() < .6) { R(x, y, 2 + (rnd() * 2 | 0), 1, T[2]); P(x, y - 1, T[4]); } else P(x, y, T[4]); }
  else if (fam === 'cloth') { for (let a = 0; a < LU; a += 3) for (let b = 0; b < LV; b++) at(a, b, T[2]); for (let i = A / 16 | 0; i--;) { const a = rnd() * LU | 0, b = rnd() * LV | 0; at(a, b, T[4]); at(a, b + 1, T[4]); } }
  else if (fam === 'bone' || fam === 'shell') { for (let i = A / 18 | 0; i--;) R(rnd() * W | 0, rnd() * H | 0, 2, 1, T[3]); if (fam === 'shell') for (let y = 1; y < H; y += 4) R(0, y, W, 1, T[3]); else for (let i = A / 300 | 0; i--;) pxWalk(c, T[2], 8); }
  else if (fam === 'stone') { for (let i = A / 12 | 0; i--;) R(rnd() * W | 0, rnd() * H | 0, 2, 2, rnd() < .5 ? T[2] : T[4]); for (let i = Math.max(1, A / 350 | 0); i--;) pxWalk(c, T[1], 10); for (let i = A / 70 | 0; i--;) P(rnd() * W | 0, rnd() * H | 0, T[5]); }
  else if (fam === 'fur') for (let x = 0; x < W; x += 3) for (let y = -(rnd() * 9 | 0), k = 0; y < H; k++) { // staggered locks that lean a little: a lit strand, a shaded one, a dark tip
    const h = 5 + (rnd() * 5 | 0), dx = (k + x) % 2;
    for (let j = 0; j < h; j++) { const xx = x + dx + (j > h / 2 ? 1 : 0); P(xx, y + j, j < h - 2 ? T[4] : T[3]); P(xx + 1, y + j, T[3]); if (j > 1) P(xx + 2, y + j, T[2]); }
    P(x + dx + 2, y + h - 1, T[1]); y += h - 1 + (rnd() * 3 | 0);
  }
  else if (fam === 'scale') { // rows from the bottom up, so each row laps over the tops of the one below
    const Rw = (x, y, w, h, col) => { for (let i = 0; i < w; i++) R(((x + i) % W + W) % W, y, 1, h, col); };
    for (let y = H - 3, r = 0; y > -5; y -= 4, r++) for (let x = (r % 2) * 4; x < W; x += 8) { Rw(x + 1, y, 6, 1, T[4]); Rw(x, y + 1, 8, 2, T[3]); P(x, y + 1, T[4]); P(x + 2, y + 1, T[5]); Rw(x + 6, y + 1, 2, 2, T[2]); Rw(x + 1, y + 3, 6, 1, T[2]); Rw(x + 2, y + 4, 4, 1, T[1]); }
  } else if (fam === 'feather') { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x + 2 * y) % 5 === 0) P(x, y, T[3]); for (let y = 6; y < H; y += 8) R(0, y, W, 1, T[2]); }
  else if (fam === 'linen') for (let i = A / 5 | 0; i--;) { const x = rnd() * W | 0, y = rnd() * H | 0; if ((x + y) % 2) P(x, y, T[3]); }
  else if (fam === 'gem' || fam === 'crystal') for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = (x + y) % 6, b = (x - y + 600) % 6; P(x, y, !a || !b ? T[2] : a < 3 && b < 3 ? T[4] : T[3]); }
}
// one part's texture: the fill, then what its shape and role add (k.kind: cyl, cone, disc, box, ball, dome, torus, flat, shield)
function pxPaint(c, k) {
  const { W, H, R, P, rnd } = c, { T, fam, role } = k, met = METAL[fam], hi = met ? T[5] : T[4];
  const row = (y, col) => R(0, y, W, 1, col), colm = (x, col) => R(x, 0, 1, H, col);
  if (role === 'grip') { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) P(x, y, [T[1], T[4], T[3], T[2]][(y + Math.floor(x * 4 / W)) % 4]); return; } // a strip wound round
  if (role === 'chain') { for (let y = 0; y < H; y++) row(y, [T[5], T[3], T[1], T[2]][y % 4]); for (let y = 0; y < H; y += 8) R(0, y + 1, W >> 1, 2, T[1]); return; }
  if (role === 'fuller') { R(0, 0, W, H, T[1]); colm(0, T[0]); if (W > 2) colm(W - 1, T[3]); return; }
  if (role === 'liquid') return pxLiquid(c, k);
  if (role === 'pot' && k.kind !== 'disc') return pxPot(c, k);
  if (role === 'parch' && k.kind !== 'disc') return pxParch(c, k);
  if (role === 'coin' && k.kind === 'disc') return pxCoin(c, k);
  pxFill(c, fam, T, (k.kind === 'box' && W > H) || (k.kind === 'flat' && role === 'plume'));
  switch (k.kind) {
    case 'cyl': case 'cone': {
      if (role === 'cuirass') return pxCuirass(c, k);
      if (role === 'boot') { for (const x of [W >> 2, (W * 3) >> 2]) { colm(x, T[1]); for (let y = 1; y < H; y += 3) P(x + 1, y, T[5]); } row(0, T[2]); row(H - 1, T[4]); return; } // stitched welts down the sides
      if (role === 'greave') return pxGreave(c, k);
      if (k.kind === 'cone' && role !== 'helm') { if (met) { colm(W >> 2, T[4]); R(W >> 2, 0, 1, 2, T[5]); colm(W * 3 >> 2, T[2]); } row(H - 1, T[1]); return; }
      if (role === 'helm') { row(H - 1, T[1]); row(H - 2, hi); row(H - 3, T[2]); for (let x = 1; x < W; x += 6) { P(x, H - 5, T[5]); P(x + 1, H - 4, T[1]); } for (let i = 0; i < 4; i++) { colm(i * W >> 2, T[4]); colm((i * W >> 2) + 1, T[2]); } return; }
      if (role === 'band' || role === 'wrap' || role === 'belt' || H <= 10) {
        row(0, hi); if (H > 3) row(1, T[4]); row(H - 1, T[1]); if (H > 4) row(H - 2, T[2]);
        const m = H >> 1;
        if (role === 'belt') for (let x = 3; x < W; x += 8) stud(c, x, m, ramp('#e8b840', 6), T[1]); // gold studs
        else if (met && H >= 6) for (let x = 2; x < W; x += 6) { P(x, m, T[5]); P(x + 1, m, T[3]); P(x + 1, m + 1, T[1]); }
        else if (!met && H >= 5) for (let x = 0; x < W; x += 3) P(x, m, T[5]);
        if (met && k.rank >= 2 && H >= 12 && W >= 24) pxKey(c, k, m - 2);
      } else if (met) { colm(W >> 2, T[4]); for (let y = rnd() * 6 | 0; y < H; y += 7) P(W >> 2, y, T[5]); colm(W * 3 >> 2, T[2]); } // a long rod: a polished streak
      return;
    }
    case 'disc': { // a cylinder's end: a dark lip, a lit bevel, a boss, engraved dots on metal
      const r0 = W / 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = x + .5 - r0, dy = y + .5 - r0, r = Math.hypot(dx, dy), e = r0 - r, l = (dx + dy) / r0, b = Math.max(1.5, r0 * .2); if (e < 1) P(x, y, T[1]); else if (e < 2 + r0 / 16) P(x, y, l < -.35 ? hi : l > .35 ? T[2] : T[4]); else if (r < b) P(x, y, r > b - 1 ? T[1] : T[4]); } // lip, bevel, boss
      if (W >= 10) R(r0 - 1, r0 - 1, 1, 1, T[5]);
      if (met && W >= 14) for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; P(r0 + Math.cos(a) * r0 * .47 - .5, r0 + Math.sin(a) * r0 * .47 - .5, k.A ? k.A[4] : T[2]); }
      if (W >= 8) P(r0 * .55, r0 * .55, T[5]);
      return;
    }
    case 'box': {
      if (role === 'sole') { R(0, 0, W, H, T[2]); row(0, T[4]); for (let x = 1; x < W; x += 3) P(x, H - 1, T[0]); return; }
      if (W >= 3 && H >= 3) { row(0, T[4]); colm(0, T[4]); row(H - 1, T[1]); colm(W - 1, T[2]); P(0, 0, hi); } else if (H >= 2) { row(0, T[4]); row(H - 1, T[1]); }
      if (met && W >= 10 && H >= 10) { for (const [x, y] of [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]) stud(c, x, y, T); if (k.rank >= 2 && W >= 16 && H >= 16) { const ink = k.A ? k.A[3] : T[1]; R(5, 5, W - 10, 1, ink); R(5, H - 6, W - 10, 1, ink); R(5, 5, 1, H - 10, ink); R(W - 6, 5, 1, H - 10, ink); R(6, 6, W - 12, 1, T[5]); } }
      else if (!met && fam !== 'fur' && fam !== 'scale' && W >= 6 && H >= 6) { for (let x = 2; x < W - 2; x += 2) { P(x, 1, T[5]); P(x, H - 2, T[5]); } for (let y = 3; y < H - 2; y += 2) { P(1, y, T[5]); P(W - 2, y, T[5]); } } // a stitched hem
      if (role === 'pteryx' && W >= 6 && H >= 12) stud(c, W >> 1, 4, ramp('#f4cc7c', 6), T[1]); // a bronze rivet at the top
      return;
    }
    case 'ball': {
      const y = Math.max(1, H * .3 | 0);
      if (fam === 'gem' || fam === 'crystal') { for (const u of [.25, .75]) { const x = u * W | 0; R(x, y, 2, 2, T[5]); P(x + 2, y, '#ffffff'); P(x, y - 1, '#ffffff'); } return; }
      if (met) { for (const u of [.2, .7]) { const x = u * W | 0; R(x, y, 2, 1, T[5]); R(x, y + 1, 2, 1, T[4]); } row(H - 1, T[1]); }
      return;
    }
    case 'dome': { // sphere caps: helmets (front at u .25) and pauldrons
      const F = W >> 2, S = (i, y, col) => { P(F + i, y, col); P(F - 1 - i, y, col); };
      if (role === 'pauldron') { for (let y = 4; y < H - 3; y += 5) { row(y, T[1]); row(y + 1, T[4]); } row(H - 1, T[1]); row(H - 2, hi); for (let x = 2; x < W; x += 8) stud(c, x, H - 4, T); return; }
      if (!met) { // a leather or hide cap: six stitched gores meeting at the crown, a stitched rim
        for (let i = 0; i < 6; i++) { const x = (F + i * W / 6) | 0; colm(x, T[1]); for (let y = 1; y < H; y += 2) P(x + 1, y, T[5]); }
        row(H - 1, T[1]); row(H - 2, T[2]); for (let x = 0; x < W; x += 3) P(x, H - 3, T[5]); return;
      }
      // a metal helm: a rolled and riveted rim, an engraved band by rarity, a raised ridge brow to nape, arched brows, a lit crown
      row(H - 1, T[1]); row(H - 2, T[3]); row(H - 3, hi); row(H - 4, T[2]);
      for (let x = 1; x < W; x += 6) { P(x, H - 2, T[5]); P(x + 1, H - 1, T[0]); }
      if (k.rank >= 1 && H >= 30) pxKey(c, k, H - 22);
      for (const x0 of [F, F + (W >> 1)]) for (let y = 0; y < H - 4; y++) { P(x0 - 1, y, hi); P(x0, y, T[4]); P(x0 + 1, y, T[2]); }
      for (let i = 0; i < 8; i++) { const y = H - 8 - Math.round(Math.sin(i / 7 * PI) * 3); S(3 + i, y, T[1]); S(3 + i, y + 1, T[5]); }
      for (let i = 0; i < W >> 3; i++) P(F - (W >> 4) - 3 + i, 2 + (i >> 2), T[5]);
      return;
    }
    case 'torus': { // rings and rims: lit faces with rivets, a dark inner edge
      for (let y = 0; y < H; y++) { const a = (1 - (y + .5) / H) * PI * 2, o = Math.cos(a), s = Math.sin(a); if (o < -.6) row(y, T[1]); else if (met && o < .7) row(y, Math.abs(s) > .6 ? T[4] : T[2]); }
      if (met && H >= 6 && W >= 24) for (let x = 0; x < W; x += 8) for (const y of [H >> 2, (H * 3) >> 2]) { P(x, y, T[5]); P(x + 1, y + 1, T[1]); }
      return;
    }
    case 'shield': { // a hoplite aspis seen as rings (canvas rows run from the boss to the rim): hammered bronze, a dotted ring, a key band, a lip
      const ry = (r) => Math.round(Math.asin(r) / PI * H);
      R(0, ry(1), W, H, T[2]); R(0, 0, W, ry(.12), T[4]); row(ry(.12), T[1]);
      for (let x = 0; x < W; x += 4) { P(x, ry(.3), T[5]); P(x + 1, ry(.3) + 1, T[1]); }
      pxKey(c, k, ry(.6)); row(ry(.86), T[1]); row(ry(.86) + 1, T[5]);
      return;
    }
    case 'flat': { // extruded plates (world UVs, the texture tiles): blades, guards, wings, plumes
      if (role === 'core' && k.ridge) { // a symmetric blade: the lit half, the shade half, a bright ridge line between and a chevron of sheen
        const h2 = W >> 1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const lit = x >= h2, d = (y + (lit ? W - x : x)) % 32; P(x, y, lit ? (d < 2 ? T[4] : T[3]) : (d < 2 ? T[3] : T[2])); }
        colm(W - 1, T[5]); colm(W - 2, T[4]); colm(0, T[1]);
        if (k.rank >= 2) for (const [x0, s] of [[3, 1], [W - 5, -1]]) for (const [dx, dy] of [[1, 0], [0, 1], [2, 1], [1, 2], [1, 3], [0, 4], [2, 4], [1, 5]]) { P(x0 + dx * s, 10 + dy, k.A ? k.A[3] : T[1]); P(x0 + dx * s, 11 + dy, T[5]); } // etched lozenges beside the ridge, one a repeat
        return;
      }
      if (role === 'edge' || (role === 'pedge' && met)) { R(0, 0, W, H, T[4]); for (let i = 0; i < 40; i++) { const x = rnd() * W | 0, y = rnd() * H | 0; P(x, y, T[5]); P(x, y + 1, T[5]); } for (let i = 0; i < 16; i++) P(rnd() * W | 0, rnd() * H | 0, T[3]); return; }
      if (role === 'core') { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = (x + y) % 32; if (d < 2 || d === 4) P(x, y, d ? T[4] : T[5]); } return; } // an axe or sickle: a double stroke of sheen
      if (met) for (let y = 4; y < H; y += 8) for (let x = (y >> 3) % 2 * 4; x < W; x += 8) { P(x, y, k.A ? k.A[3] : T[2]); P(x, y + 1, T[5]); } // chased dots
      return;
    }
  }
}
// round 33 (GEAR, stage 8): the painters of the item models' own materials (itemkit.js names them with px())
function pxLiquid(c, k) { // a filled flask seen round: glass above the meniscus, the liquid darkening downwards, a glint and bubbles
  const { W, H, R, P, rnd } = c, T = k.T, m = Math.round(H * .3);
  R(0, 0, W, m, T[4]); for (let x = 0; x < W; x += 2) P(x, (x * 7) % m, T[5]);
  R(0, m, W, 1, T[5]); R(0, m + 1, W, H - m - 1, T[3]); R(0, Math.round(H * .66), W, H, T[2]); R(0, H - 2, W, 2, T[1]);
  for (const u of [.18, .68]) { const x = u * W | 0; R(x, m + 2, 2, Math.round(H * .3), T[4]); R(x, m + 3, 1, Math.round(H * .18), T[5]); P(x + 1, 2, '#ffffff'); P(x, 3, '#ffffff'); }
  for (let i = W * H / 40 | 0; i--;) { const x = rnd() * W | 0, y = m + 3 + rnd() * (H - m - 6) | 0; P(x, y, T[4]); }
}
function pxPot(c, k) { // terracotta: a black-figure band with a running key, lit lip rows, the clay's own speckle
  const { W, H, R, P, rnd } = c, T = k.T, K = '#1e1418', y0 = Math.round(H * .38), y1 = Math.round(H * .64);
  R(0, 0, W, H, T[3]); for (let i = W * H / 14 | 0; i--;) P(rnd() * W | 0, rnd() * H | 0, rnd() < .5 ? T[4] : T[2]);
  R(0, 0, W, 1, T[4]); R(0, H - 1, W, 1, T[1]); R(0, H - 2, W, 1, T[2]);
  if (y1 - y0 >= 6) {
    R(0, y0, W, y1 - y0, K); R(0, y0 - 1, W, 1, T[4]); R(0, y1, W, 1, T[2]);
    for (let x = 0; x < W; x += 12) { const fy = y0 + 2, fh = y1 - y0 - 3; R(x + 3, fy + 1, 3, fh - 2, T[3]); R(x + 2, fy + fh - 2, 2, 2, T[3]); R(x + 6, fy + fh - 2, 2, 2, T[3]); P(x + 4, fy, T[3]); P(x + 5, fy, T[3]); P(x + 7, fy + 2, T[3]); P(x + 1, fy + 3, T[3]); } // dancing figures
  }
  const kb = Math.round(H * .18); if (H >= 24) pxKey(c, { ...k, A: null, T: [K, K, K, K, K, T[4]] }, kb);
}
function pxParch(c, k) { // parchment: fibres, rows of faded ink, darker browned edges
  const { W, H, R, P, rnd } = c, T = k.T;
  R(0, 0, W, H, T[4]); for (let i = W * H / 8 | 0; i--;) P(rnd() * W | 0, rnd() * H | 0, rnd() < .6 ? T[3] : T[5]);
  for (let y = 3; y < H - 3; y += 3) for (let x = 2; x < W - 2; x++) if (rnd() < .55 && (x + y) % 7) P(x, y, T[1]);
  R(0, 0, W, 1, T[2]); R(0, H - 1, W, 1, T[2]); R(0, 0, 1, H, T[2]); R(W - 1, 0, 1, H, T[2]);
}
function pxCoin(c, k) { // a coin's face: milled rim, a dotted ring, Athena's owl (two big eyes, a beak, the ears)
  const { W, H, R, P } = c, T = k.T, r0 = W / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = x + .5 - r0, dy = y + .5 - r0, r = Math.hypot(dx, dy), e = r0 - r, l = (dx + dy) / r0; P(x, y, e < 1 ? T[1] : e < 2.2 ? (l < -.3 ? T[5] : l > .3 ? T[2] : T[4]) : T[3]); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; P(r0 + Math.cos(a) * (r0 - 3.5) - .5, r0 + Math.sin(a) * (r0 - 3.5) - .5, T[2]); }
  const s = Math.max(1, Math.round(W / 26)), cx = Math.round(r0), cy = Math.round(r0);
  R(cx - 5 * s, cy - 4 * s, 10 * s, 9 * s, T[4]); R(cx - 4 * s, cy + 5 * s, 8 * s, 2 * s, T[2]); // the owl's head and breast
  for (const sx of [-1, 1]) { R(cx + (sx < 0 ? -4 : 1) * s, cy - 2 * s, 3 * s, 3 * s, T[1]); P(cx + (sx < 0 ? -3 : 2) * s, cy - 2 * s, T[5]); R(cx + (sx < 0 ? -5 : 4) * s, cy - 6 * s, s, 2 * s, T[4]); }
  R(cx - s / 2 | 0, cy + s, Math.max(1, s), 2 * s, T[1]);
}
// round 33 (GEAR, stage 7): a flat plate painted to its own outline (axe heads, sickles, guards, crests, tower shields): the
// texture spans the shape's box, so the paint knows where the metal ends. A cut line where the core meets its bright edge,
// a bevel lit from the upper left and shaded at the lower right, the plate's swell (lighter towards the light, cooler and
// darker away from it), hammer marks, an engraved trim a few texels in (inlaid with the item's accent from EPIC up) and
// domed rivets along the side that meets the haft. Edge plates get a honed rim: a bright lit side, a darker shade side.
// S = { pts: the outline in texels (y down), ax: the haft's column (shape x = 0) }
const SH_L = [-.6, -.8]; // towards the light, in texel space (y down)
const SH_B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function pxShape(c, k, S) {
  const { W, H, R, P, rnd } = c, { T, fam, role } = k, met = METAL[k.fam], hi = met ? T[5] : T[4], pts = S.pts, n = pts.length;
  // inside: even-odd spans per texel row; D: a chamfer distance transform (two passes) to the nearest texel outside, less
  // half a texel; NL: the outward normal (the distance field's downhill) against the light. O(W*H), no per-edge search.
  const D = new Float32Array(W * H), NL = new Float32Array(W * H), xs = []; let dMax = 0;
  for (let y = 0; y < H; y++) {
    const yc = y + .5; xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > yc) !== (yj > yc)) xs.push(xi + (yc - yi) * (xj - xi) / (yj - yi)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - .5)); x < W && x + .5 <= xs[k + 1]; x++) D[y * W + x] = 1e6;
  }
  const r2 = Math.SQRT2, get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : D[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (D[i]) D[i] = Math.min(D[i], get(x - 1, y) + 1, get(x, y - 1) + 1, get(x - 1, y - 1) + r2, get(x + 1, y - 1) + r2); }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (D[i]) D[i] = Math.min(D[i], get(x + 1, y) + 1, get(x, y + 1) + 1, get(x + 1, y + 1) + r2, get(x - 1, y + 1) + r2); }
  const E = D.slice(), ge = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : E[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!D[i]) { D[i] = -1; continue; }
    const gx = ge(x - 1, y) - ge(x + 1, y), gy = ge(x, y - 1) - ge(x, y + 1), l = Math.hypot(gx, gy) || 1; // (towards the edge)
    NL[i] = (gx * SH_L[0] + gy * SH_L[1]) / l; D[i] -= .5; if (D[i] > dMax) dMax = D[i];
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : D[y * W + x]);
  if (role === 'edge' || role === 'pedge') { // a honed edge: lit along the side that faces the light, a cool shade on the other
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = at(x, y); if (d < 0) continue; const l = NL[y * W + x]; P(x, y, d < 1.2 ? (l > .2 ? T[5] : l < -.35 ? T[2] : T[4]) : d < 2.4 ? (l > .2 ? T[4] : T[3]) : T[3]); }
    for (let i = W * H / 40 | 0; i--;) { const x = rnd() * W | 0, y = rnd() * H | 0; if (at(x, y) > 1.2) P(x, y, T[5]); }
    return;
  }
  // the swell: a projection along the light over the shape's half size
  let cx = 0, cy = 0, cn = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D[y * W + x] >= 0) { cx += x; cy += y; cn++; }
  cx /= cn || 1; cy /= cn || 1; const half = Math.max(2, Math.hypot(W, H) * (dMax > 18 ? .42 : .32)); // (a broad face: a gentler swell)
  const trim = met && dMax >= 7.5, tIn = dMax >= 12 ? 4 : 3, ink = k.A && k.rank >= 2 ? k.A[3] : T[1];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = at(x, y); if (d < 0) continue;
    const l = NL[y * W + x], q = ((x - cx) * SH_L[0] + (y - cy) * SH_L[1]) / half + (SH_B[(y & 3) * 4 + (x & 3)] / 16 - .47) * .5; // (ordered dither: a soft swell, no hard split)
    let col = null;
    if (d < 1) col = role === 'core' ? T[1] : l > .3 ? T[4] : T[1]; // the cut line where the core meets its edge (a plate: its own lit lip)
    else if (d < 2.4) col = l > .3 ? hi : l < -.3 ? T[2] : T[3]; // the bevel
    else if (trim && d >= tIn && d < tIn + 1) col = ink; // the engraved trim
    else if (trim && d >= tIn + 1 && d < tIn + 2) col = l > -.2 ? T[4] : null; // its lit lip
    else if (met) col = q > .6 ? T[4] : q < -.62 ? T[2] : T[3]; // the swell of the metal
    else if (q < -.75) col = T[2]; // other materials keep their own grain, shaded away from the light
    if (col) P(x, y, col);
  }
  if (role === 'leaf') for (let y = 0; y < H; y++) { const d = at(S.ax, y); if (d >= 1.2) { P(S.ax, y, T[4]); if (y % 4 === 1) { for (const s of [-1, 1]) if (at(S.ax + s, y + 1) >= 1.5) P(S.ax + s, y + 1, T[4]); } } } // the midrib and its veins
  if (met) { // hammer marks: short lit and shaded dabs, thickest where the metal is broad
    for (let i = W * H / 26 | 0; i--;) { const x = rnd() * W | 0, y = rnd() * H | 0, d = at(x, y), d2 = at(x + 1, y); if (d >= 2.4 + (trim ? tIn - 1 : 0) && d2 >= 2.4) { const lit = rnd() < .5; P(x, y, lit ? T[4] : T[2]); P(x + 1, y, lit ? T[5] : T[3]); } }
    if ((role === 'core' || role === 'plate') && dMax >= 4.5) { // rivets: down the column nearest the haft, inside the trim
      let best = null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = at(x, y); if (d >= Math.min(dMax - .5, trim ? tIn + 2.5 : 3.2)) { const s = Math.abs(x - S.ax); if (!best || s < best.s - .5) best = { s, x, y0: y, y1: y }; else if (Math.abs(s - best.s) <= .5 && x === best.x) { best.y0 = Math.min(best.y0, y); best.y1 = Math.max(best.y1, y); } } }
      if (best) { const { x, y0, y1 } = best; if (y1 - y0 >= 8) { stud(c, x, y0 + 1, T, T[1]); stud(c, x, y1 - 1, T, T[1]); if (y1 - y0 >= 22) stud(c, x, (y0 + y1) >> 1, T, T[1]); } else stud(c, x, (y0 + y1) >> 1, T, T[1]); }
    }
  }
}
function pxCuirass(c, k) { // front at u 0
  const { W, H, R, P } = c, { T, fam } = k, S = (i, y, col) => { P(i, y, col); P(-1 - i, y, col); };
  if (fam === 'fur') return;
  if (fam === 'linen' || fam === 'scale') { // glued linen: quilted squares and a painted key; scales: just the lacing down the front
    if (fam === 'linen') { for (let y = 5; y < H; y += 8) R(0, y, W, 1, T[3]); for (let x = 4; x < W; x += 10) for (let y = 0; y < H; y += 2) P(x, y, T[3]); if (k.A) pxKey(c, k, 4); }
    for (let y = 2; y < H - 2; y += 3) { S(1, y, T[0]); S(2, y + 1, T[5]); }
    return;
  }
  R(0, 0, W, 1, T[1]); R(0, 1, W, 1, T[5]); R(0, 2, W, 1, T[4]); R(0, H - 1, W, 1, T[1]); R(0, H - 2, W, 1, T[4]); R(0, H - 3, W, 1, T[5]); // rolled rims
  if (k.rank >= 1) pxKey(c, k, 6);
  for (const x of [W >> 2, (W * 3) >> 2]) { R(x, 3, 1, H - 6, T[1]); R(x + 1, 3, 1, H - 6, T[4]); for (let y = 7; y < H - 5; y += 8) stud(c, x - 3, y, T, T[1]); } // riveted side seams
  for (let y = 16; y < H - 6; y++) { P(0, y, T[2]); P(-1, y, T[1]); P(1, y, T[4]); } // the line down the chest
}
function pxGreave(c, k) { // front at u 0: rolled rims, the shin's ridge, the calf's muscles chased at the back
  const { W, H, R, P } = c, T = k.T, B = W >> 1;
  R(0, 0, W, 1, T[1]); R(0, 1, W, 1, T[5]); R(0, H - 1, W, 1, T[1]); R(0, H - 2, W, 1, T[5]);
  for (let y = 3; y < H - 3; y++) { P(0, y, T[4]); P(-1, y, T[5]); }
  for (const s of [-1, 1]) for (let y = 4; y < H - 6; y++) { const i = 3 + Math.round(Math.sin((y - 4) / (H - 10) * PI) * W * .09); P(B + s * i, y, T[2]); P(B + s * (i + 1), y, T[4]); }
}
const _pp = new THREE.Vector3(), _pq = new THREE.Quaternion(), _ps = new THREE.Vector3();
const tx = (m, lo, hi, step = 2) => Math.max(lo, Math.min(hi, Math.round(m * PXD / step) * step)); // metres -> texels
function pxLook(key, W, H, k, em, rep) {
  return paOnce('wm' + key + em, () => {
    const t = paTex('w' + key, W, H, (c) => pxPaint(c, k));
    if (rep) { t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
    return new THREE.MeshToonMaterial({ map: t, gradientMap: toonRamp(), emissive: em || 0x000000 });
  });
}
// round 28: a retinted copy of a model for the new pieces that reuse an old pattern (materials are shared and cached, so every
// tinted mesh gets its own cloned material, one per original), and the glow of a higher grade (epic violet, legendary gold)
const _tc = new THREE.Color(), _tm = new Map();
function tintTree(root, hex, k = .5) {
  _tc.set(hex);
  root.traverse((m) => {
    if (!m.isMesh || m.userData.outline || !m.material || Array.isArray(m.material) || !m.material.isMeshToonMaterial) return;
    const key = m.material.uuid + hex + k;
    let t = _tm.get(key);
    if (!t) { t = m.material.clone(); t.color.lerp(_tc, m.material.emissive.getHex() ? k * .5 : k); _tm.set(key, t); }
    m.material = t;
  });
}
function glowTree(root, grade) {
  if (!grade) return;
  const k = grade === 1 ? .2 : .34, acc = grade === 1 ? RARITY.epic : RARITY.legendary;
  root.traverse((m) => {
    if (!m.isMesh || m.userData.outline || !m.material) return;
    const one = (mt) => {
      if (!mt.isMeshToonMaterial) return mt;
      const key = mt.uuid + 'g' + grade; let t = _tm.get(key);
      if (!t) { t = mt.clone(); t.emissive.add(_tc.set(acc).multiplyScalar(k)); if (mt.map) t.emissiveMap = mt.map; _tm.set(key, t); } // (through the texture, so dark plates stay dark and only the lit metal glows)
      return t;
    };
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
  });
}
// round 33 (GEAR): a flat part's texture fitted to its outline (pxShape), cached per outline, colour, role and rarity
const SHAPE_SKIP = new Set(['feather', 'cloth', 'fur', 'scale', 'linen', 'gem', 'crystal']);
const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
// a painted texture without canvases (the shape textures are many and each its own): the same paint kit as pxart.js paTex
// (c.R a block clipped to the canvas, c.P one texel with x wrapping round, c.rnd seeded by the key) writing straight into a
// pixel buffer, and the same flat mips (each 2x2 block keeps its most common colour, the darker on a tie), as a DataTexture
const _cols = new Map();
const col32 = (c) => { let v = _cols.get(c); if (v === undefined) { _cc.set(c); v = ((255 << 24) | (Math.round(_cc.b * 255) << 16) | (Math.round(_cc.g * 255) << 8) | Math.round(_cc.r * 255)) >>> 0; _cols.set(c, v); } return v; };
function bufTex(key, W, H, paint) {
  const buf = new Uint32Array(W * H);
  let seed = 1; for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647 || 1;
  const R = (i, j, w, h, c) => { const v = col32(c), x0 = Math.max(0, Math.round(i)), y0 = Math.max(0, Math.round(j)), x1 = Math.min(W, Math.round(i) + w), y1 = Math.min(H, Math.round(j) + h); for (let y = y0; y < y1; y++) buf.fill(v, y * W + x0, y * W + Math.max(x0, x1)); };
  const P = (i, j, c) => { j = Math.round(j); if (j < 0 || j >= H) return; buf[j * W + ((Math.round(i) % W) + W) % W] = col32(c); };
  paint({ W, H, F: W >> 1, R, P, S: (i, j, c) => { P((W >> 1) + i, j, c); P((W >> 1) - 1 - i, j, c); }, rnd: () => (seed = seed * 16807 % 2147483647) / 2147483647 });
  const flip = (b, w, h) => { const o = new Uint32Array(w * h); for (let y = 0; y < h; y++) o.set(b.subarray(y * w, y * w + w), (h - 1 - y) * w); return new Uint8Array(o.buffer); }; // (a DataTexture's first row is the bottom)
  const lum = (v) => (v & 255) * .3 + (v >> 8 & 255) * .59 + (v >> 16 & 255) * .11, mips = [];
  let b = buf, w = W, h = H;
  for (;;) {
    mips.push({ data: flip(b, w, h), width: w, height: h });
    if (w === 1 && h === 1) break;
    const w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1), o = new Uint32Array(w2 * h2), q = [0, 0, 0, 0];
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      for (let k = 0; k < 4; k++) q[k] = b[Math.min(h - 1, y * 2 + (k >> 1)) * w + Math.min(w - 1, x * 2 + (k & 1))];
      let best = q[0], bn = 0, bl = 1e9; for (const a of q) { let n = 0; for (const c of q) if (c === a) n++; const l = lum(a); if (n > bn || (n === bn && l < bl)) { best = a; bn = n; bl = l; } }
      o[y * w2 + x] = best;
    }
    b = o; w = w2; h = h2;
  }
  const t = new THREE.DataTexture(mips[0].data, W, H, THREE.RGBAFormat);
  t.mipmaps = mips; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}
function shapeLook(g, base, k, em) {
  const key = 'sh' + strHash(g.userData.key) + base;
  return paOnce('wm' + key + em, () => {
    const pts = g.userData.pts; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = Math.max(.005, x1 - x0), h = Math.max(.005, y1 - y0), W = Math.max(4, Math.min(128, Math.round(w * PXD))), H = Math.max(4, Math.min(128, Math.round(h * PXD)));
    const S = { pts: pts.map(([x, y]) => [(x - x0) / w * W, (y1 - y) / h * H]), ax: Math.max(0, Math.min(W - 1, Math.round(-x0 / w * W))) };
    const t = bufTex('w' + key, W, H, (c) => { pxFill(c, k.fam, k.T, false); pxShape(c, { ...k, kind: 'flat' }, S); });
    t.repeat.set(1 / w, 1 / h); t.offset.set(-x0 / w, -y0 / h);
    return new THREE.MeshToonMaterial({ map: t, gradientMap: toonRamp(), emissive: em || 0x000000 });
  });
}
const ROLE_FAM = new Set(['fur', 'scale', 'feather', 'stone', 'linen', 'bone', 'shell', 'wood', 'gem', 'crystal', 'leather', 'paint', 'cloth']);
// dress a freshly built model (before addOutline): id picks PXFAM / PXACC, rarity the engraving
export function pxArms(root, id, rarity) {
  const ov = PXFAM[id] || {}, rank = RANK[rarity] ?? 0, acc = PXACC[id] || '';
  root.updateMatrixWorld(true);
  root.traverse((m) => {
    const mt = m.material;
    if (!m.isMesh || m.userData.outline || !mt || Array.isArray(mt) || !mt.isMeshToonMaterial || mt.transparent || mt.map) return;
    const g = m.geometry, gp = g.parameters || {}, t = g.type, hex = '#' + mt.color.getHexString(), role = m.userData.px || '';
    const em = mt.emissive.r + mt.emissive.g + mt.emissive.b > 0 ? '#' + mt.emissive.getHexString() : '';
    let fam = ov[role + hex] || ov[hex] || famOf(hex);
    if (t === 'OctahedronGeometry') fam = 'crystal';
    else if (em && t === 'IcosahedronGeometry' && !ov[hex] && _cc.set(em).getHSL(_hs).s > .4) fam = 'gem';
    if (ROLE_FAM.has(role)) fam = role; // round 33: a builder may name the material outright (gearkit.js)
    else if (role === 'plume') fam = 'cloth';
    else if ((role === 'grip' || role === 'wrap' || role === 'pteryx' || role === 'boot' || role === 'belt') && METAL[fam]) fam = 'leather';
    else if ((role === 'edge' || role === 'core' || role === 'fuller') && !METAL[fam]) fam = 'steel';
    else if (role === 'rod' && !METAL[fam] && fam !== 'bone' && fam !== 'scale') fam = 'wood';
    m.matrixWorld.decompose(_pp, _pq, _ps); const sx = Math.abs(_ps.x), sy = Math.abs(_ps.y), sz = Math.abs(_ps.z);
    const k = { fam, role, T: ramp(hex, 6), rank, A: acc ? ramp(acc, 6) : null, ridge: !!m.userData.pxRidge };
    const base = `${fam}|${role}|${hex}|${rank}|${acc}|${k.ridge ? 1 : 0}`;
    const look = (kind, W, H, rep) => pxLook(`${kind}|${base}|${W}x${H}`, W, H, { ...k, kind }, em, rep);
    if (t === 'CylinderGeometry' || t === 'ConeGeometry') {
      const r = Math.max(gp.radiusTop ?? 0, gp.radiusBottom ?? 0, gp.radius ?? 0), s = (sx + sz) / 2;
      const W = tx(2 * PI * r * s, 4, 128, 4), H = tx(gp.height * sy, 2, 256), D = tx(2 * r * s, 2, 64);
      if (W * H < 24 && D < 6) return;
      const side = look(t === 'ConeGeometry' ? 'cone' : 'cyl', W, H);
      m.material = D >= 6 ? [side, look('disc', D, D), look('disc', D, D)] : side;
    } else if (t === 'BoxGeometry') {
      const w = sx * (gp.width ?? 1), h = sy * (gp.height ?? 1), d = sz * (gp.depth ?? 1);
      if (Math.max(w, h, d) * PXD < 5) return;
      const f = (a, b) => look('box', tx(a, 2, 128), tx(b, 2, 128)), X = f(d, h), Y = f(w, d), Z = f(w, h);
      m.material = [X, X, Y, Y, Z, Z];
    } else if (t === 'IcosahedronGeometry' || t === 'OctahedronGeometry') {
      if (role === 'shieldface') { m.material = look('shield', 128, 96); return; }
      const s = (sx + sy + sz) / 3, W = tx(2 * PI * gp.radius * s, 4, 96, 4), H = tx(PI * gp.radius * s, 2, 48);
      if (W * H >= 24) m.material = look('ball', W, H);
    } else if (t === 'SphereGeometry') { const s = (sx + sz) / 2; m.material = look('dome', tx(2 * PI * gp.radius * s, 8, 192, 8), tx(gp.radius * gp.thetaLength * sy, 4, 64)); }
    else if (t === 'TorusGeometry') { const s = (sx + sy) / 2, W = tx(gp.arc * gp.radius * s, 4, 128, 4), H = tx(2 * PI * gp.tube * s, 2, 16); if (W * H >= 24) m.material = look('torus', W, H); }
    else if (t === 'ExtrudeGeometry') {
      const side = look('flat', 32, 32, PXD / 32), pts = g.userData.pts;
      if (pts && (!SHAPE_SKIP.has(fam) || role === 'leaf') && role !== 'plume' && role !== 'fuller' && !(role === 'core' && k.ridge) && pts.length >= 3) m.material = [shapeLook(g, base, k, em), side];
      else m.material = side;
    }
  });
  return root;
}

const SKIP = (m) => !m.castShadow || m.material.isMeshBasicMaterial || m.userData.noOutline;
const GRIP_L = { blade: null, dual: null, twohand: -.2, polearm: .45 };
const _box = new THREE.Box3();
// round 33 (Roy: the pairs looked too small beside V): a pair's blades are built a fifth larger, about the size of a one-handed
// sword or axe, scaled about the grip (the origin) so the hand still closes on it; tip, butt and edge below are measured after
const DUAL_SCALE = 1.2;
function buildPart(w, fn, mirror) {
  const root = new THREE.Group(); root.name = 'weapon:' + w.id;
  const k = w.style === 'dual' ? DUAL_SCALE : 1;
  const g = mirror || k !== 1 ? pivot(root, 0, 0, 0) : root;
  if (k !== 1) g.scale.setScalar(k);
  if (mirror) g.scale.x = -k;
  fn(g);
  if (w.tint) tintTree(root, w.tint, .5);
  if (PXART) pxArms(root, w.base || w.id, w.rarity);
  glowTree(root, w.grade);
  addOutline(root, SKIP);
  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  // tip/butt: weapon-local z extent; gripL: suggested z for the left hand on two-handed hafts
  root.userData = { weapon: w.id, style: w.style, outlined: true, tip: +_box.max.z.toFixed(2), butt: +_box.min.z.toFixed(2), gripL: GRIP_L[w.style], grip2: GRIP_L[w.style], edge: sharpPart(root, _box.min.z, _box.max.z) };
  return root;
}
// Round 23 (Roy: "the swing's effect must always be where the weapon's sharp part is"): where the cutting part of a weapon
// lies, in its own space, from its shape: the weapon is cut into slices along its length and the grip's width (the slices
// round the hand, at z 0) is the measure; from the tip down, the head is every slice markedly wider than the grip (a
// sword's blade and guard, a spear's head, an axe's bit, a scythe's blade), until the haft or grip comes back. Returns
// {a, b}: b = the head's point furthest from the hand (a blade's or spearhead's tip, an axe's or scythe's outer edge), a = a
// point on the axis where the head begins (no higher than half way to b): a to b is the line of the sharp part. models.js
// edgeAt reads it to lay the swing's trail along it.
const _sv = new THREE.Vector3();
function sharpPart(root, z0, z1) {
  const N = 36, len = Math.max(.05, z1 - z0), W = new Float32Array(N), fx = new Float32Array(N), far = [0, 0, z1], bin = (z) => Math.min(N - 1, Math.max(0, Math.floor((z - z0) / len * N)));
  let fd = -1;
  root.traverse((m) => {
    const a = m.isMesh && !m.userData.outline && m.geometry?.attributes?.position; if (!a) return;
    for (let i = 0; i < a.count; i++) {
      _sv.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); const b = bin(_sv.z), ax = Math.abs(_sv.x);
      if (ax > W[b]) { W[b] = ax; fx[b] = _sv.x; }
    }
  });
  const g = bin(0), grip = Math.max(.012, Math.min(W[g], W[Math.max(0, g - 1)] || W[g], W[Math.min(N - 1, g + 1)] || W[g])) * 1.6;
  let lo = N - 1; while (lo > 0 && W[lo] <= grip) lo--; // (a thin point at the very tip)
  while (lo > 0 && W[lo - 1] > grip && z0 + (lo - 1) / N * len > .02) lo--;
  const za = Math.max(.04, z0 + lo / N * len);
  root.traverse((m) => { // the head's point furthest out (sideways counts for more: an axe's bit over the spike on its top)
    const a = m.isMesh && !m.userData.outline && m.geometry?.attributes?.position; if (!a) return;
    for (let i = 0; i < a.count; i++) { _sv.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); if (_sv.z < Math.min(za, z1 * .5)) continue; const d = Math.abs(_sv.x) * 1.5 + _sv.z; if (d > fd) { fd = d; far[0] = _sv.x; far[1] = 0; far[2] = _sv.z; } }
  });
  return { a: [0, 0, +Math.min(za, far[2] * .5).toFixed(3)], b: far.map((v) => +v.toFixed(3)) }; // (a no higher than half way: a<b is the line the trail is laid along)
}
export function makeWeapon(id) {
  const w = forgedWeapon(id) || WEAPONS.village_blade;
  BUILD_CTX.item = w;
  const B = BUILD[w.base || w.id];
  const fr = B.right || B;
  const right = buildPart(w, fr, false);
  const left = w.style === 'dual' ? buildPart(w, B.left || fr, !B.left) : w.shield ? makeShield(w.shield, w.rarity, null, w.grade) : null;
  return { right, left };
}

// ---------------------------------------------------------------------------------------------
// item models (world pickups): upright, base at y = 0, ~0.4-0.6 m tall (exaggerated so they read from above)
// ---------------------------------------------------------------------------------------------
function flask(g, liquid, hi, round = true) {
  const b = ball(g, .17, liquid, 0, .19, 0, 1); if (!round) b.scale.set(.8, 1.15, .8);
  ball(g, .12, hi, -.02, .21, .02, 1, { basic: true, noShadow: true }).scale.set(.9, .9, .9);
  noOL(ball(g, .17 * 1.0, liquid, 0, .19, 0, 1, { noShadow: true })).visible = false;
  box(g, .04, .06, .02, '#ffffff', -.08, .26, .13, { basic: true });
  tcyl(g, .05, .06, .14, '#dfe9ef', 0, .38, 0, 7);
  band0(g, .065, .33, .03, P.gold);
  tcyl(g, .055, .045, .07, '#8a6040', 0, .48, 0, 7);
  return b;
}
const band0 = (p, r, y, h, c) => tcyl(p, r, r, h, c, 0, y, 0, 10);
function leafAt(p, x, y, z, ry, rz, len = .12, c = '#7f9a44') {
  const l = flat(p, [[0, 0], [.03, len * .4], [0, len], [-.03, len * .4]], .014, c);
  l.position.set(x, y, z); l.rotation.set(0, ry, 0); l.rotateX(-HP + rz); return l;
}
export const ITEM_BUILD = { // exported so a chapter's own key items can bring their models (isle.js)
  potion_hp(g) { flask(g, '#d42a36', '#ff6a6a'); },
  potion_mp(g) { flask(g, '#2f6dff', '#8ad0ff', false); for (const sx of [-1, 1]) { const w = flat(g, [[0, 0], [.08, .04], [.12, .1], [.05, .07]], .015, P.goldL); w.position.set(sx * .12, .3, 0); w.scale.x = sx; } },
  moly_herb(g) {
    const r = ball(g, .08, '#1e1a1e', 0, .07, 0, 1); r.scale.set(1, 1.2, 1);
    for (let i = 0; i < 4; i++) cone(g, .02, .12, '#2a2226', Math.cos(i * 1.6) * .05, .02, Math.sin(i * 1.6) * .05, 4).rotation.x = PI;
    seg(g, [0, .12, 0], [0, .42, 0], .016, .012, '#5a8a3a');
    for (let i = 0; i < 5; i++) leafAt(g, 0, .16 + i * .05, 0, i * 2.4, 1.0, .14, '#6a9a44');
    for (const [x, y, z] of [[0, .48, 0], [.08, .42, .03], [-.07, .43, -.04]]) { ball(g, .055, '#f6f4ee', x, y, z, 1); ball(g, .022, '#ffd84a', x, y + .03, z + .03, 0, { noShadow: true }); }
  },
  lost_amphora(g) {
    const b = ball(g, .17, '#c46a34', 0, .28, 0, 1); b.scale.set(1, 1.35, 1);
    tcyl(g, .03, .09, .1, '#c46a34', 0, .06, 0, 9);
    tcyl(g, .065, .08, .14, '#c46a34', 0, .5, 0, 9);
    tcyl(g, .09, .07, .04, '#a85428', 0, .58, 0, 9);
    band0(g, .172, .3, .1, '#24160e');
    for (let i = 0; i < 6; i++) box(g, .03, .05, .02, '#d88a4a', Math.sin(i * PI / 3) * .175, .3, Math.cos(i * PI / 3) * .175, { noShadow: true }).rotation.y = i * PI / 3;
    for (const sx of [-1, 1]) chain(g, [[sx * .06, .54, 0], [sx * .15, .54, 0], [sx * .16, .44, 0], [sx * .12, .38, 0]], .022, .022, '#a85428', 5);
  },
  bronze_key(g) {
    const k = pivot(g, 0, .05, 0); k.rotation.z = .25;
    const bow = M(k, torusGeo(.09, .028), P.bronze, 0, .45, 0);
    seg(k, [0, .36, 0], [0, .04, 0], .026, .026, P.bronze);
    for (const y of [.08, .16]) box(k, .1, .04, .04, P.bronzeD, .06, y, 0);
    box(k, .04, .1, .04, P.bronzeD, .1, .08, 0);
    ball(k, .035, '#5aa08a', 0, .45, 0, 0);
    band0(k, .036, .34, .03, P.bronzeL);
    bow.castShadow = true;
  },
  wolf_pelt(g) {
    const b = box(g, .5, .08, .36, '#7a7a82', 0, .05, 0); b.rotation.y = .2;
    box(g, .44, .07, .3, '#9a9aa2', .02, .12, .02).rotation.y = .1;
    for (const x of [-.12, .02, .16]) box(g, .05, .075, .3, '#5a5a62', x, .125, .02, { noShadow: true }).rotation.y = .1;
    const h = ball(g, .1, '#8a8a92', -.24, .2, .06, 1); h.scale.set(1, .85, 1.1);
    box(g, .1, .07, .14, '#8a8a92', -.24, .17, .17);
    box(g, .04, .03, .03, '#1a1418', -.24, .2, .24);
    for (const sx of [-1, 1]) cone(g, .04, .1, '#6a6a72', -.24 + sx * .06, .3, .04, 4);
    for (const sx of [-1, 1]) box(g, .02, .02, .02, '#ffd84a', -.24 + sx * .045, .24, .14, { basic: true });
  },
  harpy_feather(g) {
    const f = pivot(g, 0, 0, 0); f.rotation.z = -.35;
    const vane = [[0, .06], [.07, .14], [.1, .3], [.08, .46], [.03, .58], [0, .62], [-.05, .5], [-.08, .34], [-.07, .18]];
    const v = plate(pivot(f, 0, 0, 0), vane, .02, '#6a4aa0', '#3fc6c0', .02);
    v.parent.rotation.x = -HP;
    for (const [y, s] of [[.22, 1], [.32, -1], [.42, 1]]) { const n = box(f, .012, .006, .08, '#2a1a44', s * .03, y, .012, { noShadow: true }); n.rotation.z = s * .8; }
    seg(f, [0, 0, 0], [0, .6, 0], .014, .006, '#e8dcc0');
    const tip = cone(f, .03, .08, P.bronze, 0, .64, 0, 4);
  },
  olive_branch(g) {
    const b = pivot(g, 0, .04, 0); b.rotation.z = .5;
    chain(b, [[0, 0, 0], [.02, .2, 0], [0, .4, .02], [.03, .55, 0]], .02, .01, '#6a4a2c', 5);
    for (let i = 0; i < 8; i++) leafAt(b, .01, .1 + i * .06, 0, i * 2.2, .9, .13, i % 2 ? '#8aa65a' : '#6f8a3a');
    for (const [x, y, z] of [[.06, .26, .03], [-.05, .38, .02], [.05, .46, -.02]]) { const o = ball(b, .035, '#3a2a40', x, y, z, 1); o.scale.y = 1.2; }
  },
  sealed_letter(g) {
    const s = pivot(g, 0, .1, 0); s.rotation.y = .4;
    cyl0(s, .08, .42, '#e8dcb8', 0, 0, 0, 'x').castShadow = true;
    for (const sx of [-1, 1]) cyl0(s, .088, .04, '#c8b890', sx * .2, 0, 0, 'x');
    box(s, .05, .17, .17, '#7a1a20', 0, 0, 0);
    noOL(cyl0(s, .055, .03, '#c81e28', 0, 0, .085, 'z'));
    noOL(cyl0(s, .03, .036, '#e8505a', 0, 0, .085, 'z'));
    for (const sx of [-1, 1]) { const r = box(s, .03, .1, .01, '#7a1a20', sx * .03, -.12, .08); r.rotation.z = sx * .3; }
  },
  fishing_net(g) {
    const d = ball(g, .24, '#a08a5a', 0, .02, 0, 1); d.scale.set(1, .55, 1);
    for (let i = 0; i < 6; i++) { const r = M(g, torusGeo(.238, .008, PI), '#5a4a30', 0, .02, 0, { noShadow: true }); r.rotation.set(0, i * PI / 6, 0); r.scale.y = .58; }
    for (const y of [.06, .12]) { const t = M(g, torusGeo(.22 - y * .6, .008), '#5a4a30', 0, y, 0, { noShadow: true }); t.rotation.x = HP; }
    for (let i = 0; i < 5; i++) ball(g, .04, '#e8823a', Math.cos(i * 1.26) * .22, .05, Math.sin(i * 1.26) * .22, 0);
    const rope = M(g, torusGeo(.08, .02), '#c8a66a', .2, .06, .14); rope.rotation.x = HP;
  },
  honey_jar(g) {
    tcyl(g, .13, .11, .26, '#c8823e', 0, .13, 0, 10);
    ball(g, .13, '#c8823e', 0, .26, 0, 1).scale.y = .4;
    tcyl(g, .08, .1, .06, '#c8823e', 0, .32, 0, 10);
    const cl = ball(g, .12, '#e0d0a4', 0, .37, 0, 1); cl.scale.y = .45;
    band0(g, .085, .34, .03, '#8a3a20');
    for (const [x, y, h] of [[.1, .27, .12], [-.04, .26, .16]]) { box(g, .04, h, .03, '#ffb52e', x, y - h / 2 + .04, .1, { basic: true }); ball(g, .025, '#ffc84a', x, y - h + .04, .1, 0, { basic: true }); }
    band0(g, .135, .12, .06, '#2a1a10');
    const bee = pivot(g, .18, .38, .05); ball(bee, .03, '#ffd030', 0, 0, 0, 0); box(bee, .012, .062, .062, '#1a1410', 0, 0, 0, { noShadow: true }); box(bee, .05, .01, .03, '#e8f4ff', 0, .03, 0, { basic: true });
  },
  lyre_string(g) {
    const s = ball(g, .14, '#7a4a28', 0, .14, 0, 1); s.scale.set(1, .9, .5);
    noOL(ball(g, .1, '#a8784a', 0, .15, .03, 1, { noShadow: true })).scale.set(1, .9, .5);
    for (const sx of [-1, 1]) chain(g, [[sx * .08, .2, 0], [sx * .16, .36, 0], [sx * .13, .5, 0], [sx * .17, .58, 0]], .026, .016, '#efe4c8', 5);
    seg(g, [-.17, .52, 0], [.17, .52, 0], .018, .018, '#6a3a20');
    for (let i = 0; i < 5; i++) { const x = -.06 + i * .03; seg(g, [x, .18, .04], [x, .52, .02], .005, .005, i === 2 ? '#ffe066' : '#e8e0d0', 3, i === 2 ? { basic: true } : { noShadow: true }); }
    ball(g, .03, '#ffe066', 0, .52, .03, 0, { basic: true });
  },
  broken_statuette(g) {
    box(g, .3, .08, .24, '#d8d0c2', 0, .04, 0);
    for (const sx of [-1, 1]) seg(g, [sx * .05, .08, 0], [sx * .055, .3, 0], .04, .035, '#ece6da');
    const t = tcyl(g, .1, .08, .24, '#ece6da', 0, .42, 0, 8); t.scale.z = .7;
    tcyl(g, .11, .1, .1, '#e2dacd', 0, .3, 0, 8);
    seg(g, [-.1, .5, 0], [-.14, .36, .03], .032, .028, '#ece6da');
    tcyl(g, .04, .05, .05, '#ece6da', 0, .56, 0, 6);
    box(g, .1, .02, .01, '#6a645a', .01, .45, .072, { noShadow: true }).rotation.z = .6;
    box(g, .08, .02, .01, '#6a645a', -.02, .37, .072, { noShadow: true }).rotation.z = -.4;
    const arm = seg(g, [.14, .02, .14], [.3, .04, .1], .03, .028, '#ece6da');
    ball(g, .07, '#ece6da', -.18, .06, .1, 0);
  },
  sacred_lamp(g) {
    const L = pivot(g, 0, 0, 0); L.rotation.y = -HP;
    tcyl(L, .1, .12, .04, '#9a4420', 0, .02, 0, 10);
    const b = ball(L, .2, '#c4622e', 0, .12, 0, 1); b.scale.set(1, .45, .85);
    noOL(band0(L, .195, .12, .035, '#1e1410'));
    noOL(cyl0(L, .08, .02, '#1e1410', 0, .2, 0, 'y'));
    const n = tcyl(L, .05, .075, .22, '#c4622e', 0, .13, .2, 8); n.rotation.x = HP;
    noOL(cyl0(L, .035, .02, '#120a08', 0, .17, .3, 'y'));
    const h = M(L, torusGeo(.06, .022), '#c4622e', 0, .17, -.19); h.rotation.y = HP; h.castShadow = true;
    for (const [r, hh, c, y] of [[.055, .2, '#ff6a1a', .27], [.036, .14, '#ffb03a', .25], [.02, .08, '#fff0a0', .23]]) cone(L, r, hh, c, 0, y, .3, 6, { basic: true });
  },
  fleece_thread(g) {
    const y0 = .17;
    M(g, cached('yarn', () => new THREE.IcosahedronGeometry(.16, 1)), '#f2b830', 0, y0, 0, { emissive: '#4a3000' }).castShadow = true;
    for (const [rx, ry] of [[.3, 0], [1.2, .6], [.6, 1.7], [1.9, 2.4], [0, 1.1]]) { const t = noOL(M(g, torusGeo(.158, .014), '#ffe680', 0, y0, 0, { emissive: '#6a5000' })); t.rotation.set(rx, ry, 0); }
    chain(g, [[.12, y0 - .08, .08], [.22, .04, .12], [.32, .03, .06], [.4, .04, .14]], .016, .012, '#ffe680', 4, { basic: true });
  },
  shepherd_flute(g) {
    const p = pivot(g, 0, .02, 0); p.rotation.z = -.1;
    p.rotation.y = .35;
    for (let i = 0; i < 7; i++) { const h = .5 - i * .05, x = -.18 + i * .06; cyl0(p, .025, h, i % 2 ? '#e2c47a' : '#c8a456', x, h / 2, 0, 'y'); noOL(cyl0(p, .014, .012, '#2a1a0c', x, h + .001, 0, 'y')); }
    box(p, .42, .035, .064, '#7a2a1a', 0, .1, 0); box(p, .3, .035, .064, '#7a2a1a', -.06, .24, 0);
  },
  charon_obol(g) {
    const c = pivot(g, 0, .2, 0); c.rotation.set(-.2, .3, 0);
    c.rotation.set(-.1, .55, 0);
    cyl0(c, .2, .045, '#dfe2d6', 0, 0, 0, 'z').castShadow = true;
    noOL(cyl0(c, .165, .055, '#80857c', 0, 0, 0, 'z'));
    const sk = noOL(ball(c, .085, '#ecebe0', 0, .025, .03, 1)); sk.scale.z = .35;
    noOL(box(c, .07, .05, .03, '#ecebe0', 0, -.05, .03));
    for (const sx of [-1, 1]) box(c, .03, .03, .02, '#5affc8', sx * .033, .03, .062, { basic: true });
    for (let i = 0; i < 3; i++) noOL(box(c, .012, .03, .02, '#5a5e56', -.02 + i * .02, -.06, .048, { noShadow: true }));
  },
  fate_thread(g) {
    seg(g, [0, 0, 0], [0, .58, 0], .022, .016, '#8a6640');
    cyl0(g, .12, .035, '#6a4a2c', 0, .07, 0, 'y');
    const sp = ball(g, .13, '#e8f0ff', 0, .3, 0, 1, { basic: true }); sp.scale.y = 1.25;
    for (let i = 0; i < 4; i++) noOL(band0(g, .12 - Math.abs(i - 1.5) * .025, .21 + i * .06, .014, '#8fa8e0'));
    chain(g, [[.12, .34, 0], [.2, .3, .05], [.25, .18, .12], [.2, .08, .2]], .012, .012, '#ffffff', 4, { basic: true });
  },
  gaze_stone(g) {
    const r = M(g, torusGeo(.14, .03), P.bronze, 0, .16, 0); r.rotation.x = HP; r.castShadow = true;
    cone(g, .03, .08, P.bronze, .15, .16, 0, 4).rotation.z = -HP;
    for (const sx of [-1, 1]) box(g, .014, .014, .014, '#ffe14a', .17, .18, sx * .015, { basic: true });
    const gem = ball(g, .15, '#2a9a5a', 0, .26, 0, 0); gem.scale.set(.9, 1.2, .9);
    ball(g, .09, '#7affa8', 0, .28, .04, 0, { basic: true, noShadow: true }).scale.set(.9, 1.2, .9);
    box(g, .03, .05, .02, '#eafff0', -.05, .34, .1, { basic: true });
  },
  rain_ring(g) {
    const r = M(g, torusGeo(.13, .032), P.gold, 0, .16, 0, { emissive: '#3a2a00' }); r.castShadow = true; r.rotation.y = .5;
    const s = ball(g, .06, '#34d1bf', Math.sin(.5) * 0, .3, 0, 0, { basic: true }); s.scale.y = .8;
    noOL(cyl0(g, .07, .03, P.goldD, 0, .28, 0, 'y'));
  },
  wool(g) { for (const [x, y, z, r] of [[0, .12, 0, .14], [.1, .1, .05, .1], [-.09, .1, -.03, .11], [.02, .22, .01, .1]]) ball(g, r, '#f2eee4', x, y, z, 1); },
  goat_horn(g) { for (let i = 0; i < 6; i++) { const a = i * .45; tcyl(g, .07 - i * .01, .08 - i * .01, .1, '#d8c8a8', Math.sin(a) * .1, .06 + i * .07, Math.cos(a) * .06 - .06, 6).rotation.x = -a * .6; } },
  deer_hide(g) { const h = box(g, .42, .03, .3, '#a8763e', 0, .03, 0); h.rotation.y = .4; box(g, .3, .035, .18, '#c8986a', .02, .04, .01).rotation.y = .4; for (const sx of [-1, 1]) box(g, .06, .02, .05, '#e8d8b8', sx * .1, .05, .05); },
  raw_meat(g) { const m = ball(g, .13, '#c0484a', 0, .1, 0, 1); m.scale.set(1.3, .7, 1); ball(g, .07, '#f2e6d8', .14, .1, 0, 1); tcyl(g, .025, .025, .14, '#f2e6d8', .2, .1, 0, 5).rotation.z = PI / 2; },
  canned_meat(g) { tcyl(g, .085, .085, .17, '#b8b0a0', 0, .085, 0, 10); tcyl(g, .088, .088, .06, '#c0484a', 0, .085, 0, 10); tcyl(g, .086, .086, .02, '#d8d2c4', 0, .17, 0, 10); },
  drachma(g) { // a little heap of owl coins
    for (const [x, y, z, rx] of [[0, .03, 0, 0], [.07, .07, .03, .2], [-.06, .06, -.02, -.25], [.01, .11, -.01, .1]]) { const c = pivot(g, x, y, z); c.rotation.set(PI / 2 + rx, 0, rx); cyl0(c, .1, .03, '#e8c050', 0, 0, 0, 'z').castShadow = true; noOL(cyl0(c, .075, .035, '#c89a30', 0, 0, 0, 'z')); }
  },
  treasure_map(g) { // a rolled parchment tied with a cord, a red seal
    const r = pivot(g, 0, .07, 0); r.rotation.set(0, .5, PI / 2);
    cyl0(r, .07, .42, '#d8b878', 0, 0, 0, 'y').castShadow = true; noOL(cyl0(r, .072, .05, '#8a3a2a', 0, .06, 0, 'y'));
    ball(g, .04, '#b8322a', .03, .15, .02, 0);
  },
  lore_scroll(g) { // a scroll on two wooden rods
    const r = pivot(g, 0, .08, 0); r.rotation.set(0, -.4, PI / 2);
    cyl0(r, .06, .36, '#efe4c8', 0, 0, 0, 'y').castShadow = true;
    for (const sy of [-1, 1]) { cyl0(r, .025, .1, '#6a4428', 0, sy * .22, 0, 'y'); ball(r, .035, '#c8a040', 0, sy * .28, 0, 0); }
  },
  relic(g) { // a small golden idol on a gem, lit from inside
    ball(g, .12, '#3ad0c0', 0, .14, 0, 1, { emissive: '#0a5a50' });
    tcyl(g, .07, .1, .1, '#e0b040', 0, .27, 0, 6); ball(g, .07, '#e8c050', 0, .38, 0, 1);
    for (const sx of [-1, 1]) box(g, .05, .1, .04, '#e0b040', sx * .1, .3, 0).rotation.z = sx * .5;
  },
  golden_apple(g) {
    const a = ball(g, .17, '#f2c040', 0, .18, 0, 1, { emissive: '#4a3000' }); a.scale.y = .92; a.castShadow = true;
    box(g, .06, .06, .02, '#fff6c0', -.07, .25, .14, { basic: true });
    seg(g, [0, .32, 0], [.02, .4, 0], .014, .01, '#5a3a20');
    leafAt(g, .03, .38, 0, .4, .9, .14, '#5aa03a');
  },
  boar_tusk(g) {
    for (const sx of [-1, 1]) chain(g, [[sx * .05, .06, 0], [sx * .12, .14, .03], [sx * .15, .28, .04], [sx * .1, .42, .02], [sx * .04, .48, 0]], .045, .008, '#efe6cc', 6);
    seg(g, [-.06, .06, 0], [.06, .06, 0], .02, .02, '#5a3a20');
    ball(g, .03, P.bronze, 0, .06, .02, 0);
  },
  serpent_scale(g) {
    const s = pivot(g, 0, .02, 0); s.rotation.set(-HP + .25, .3, 0);
    const pts = [[0, -.02], [.14, .1], [.17, .26], [.1, .42], [0, .48], [-.1, .42], [-.17, .26], [-.14, .1]];
    plate(s, pts, .03, '#2f9a6a', '#bff0a0', .025);
    noOL(flat(s, inset(pts, .07), .05, '#5adaa0', { basic: true })).scale.set(.6, 1, .6);
    s.children.forEach((c) => { c.position.z += .0; });
    s.rotation.x = 0; s.children.forEach((c) => c.rotateX(-HP));
  },
  minotaur_horn(g) {
    chain(g, [[-.14, .06, 0], [-.04, .12, 0], [.06, .22, .02], [.1, .36, .04], [.06, .5, .04]], .07, .012, '#e8dcc0', 7);
    chain(g, [[.08, .42, .04], [.06, .5, .04]], .03, .012, '#3a2a20', 6);
    cyl0(g, .078, .06, P.bronze, -.13, .065, 0, 'x');
  },
};
export const ITEM_MODELS = {}; // round 33 (GEAR): the items' models in the new V look (itemkit.js), ahead of the older ITEM_BUILD ones
export function makeItemModel(id) {
  const root = new THREE.Group(); root.name = 'item:' + id;
  const nu = ITEM_MODELS[id];
  (nu || ITEM_BUILD[id] || ITEM_MODELS.potion_hp || ITEM_BUILD.potion_hp)(root);
  if (PXART) pxArms(root, 'item:' + id, ITEMS[id]?.rarity || 'common'); // (round 33: the older builders' plain colours get the painted look too)
  addOutline(root, SKIP);
  root.userData = { item: id, outlined: true };
  return root;
}

// ---------------------------------------------------------------------------------------------
// icons: one shared offscreen pixel renderer for weapons/items, hand-drawn pixel art for skills
// ---------------------------------------------------------------------------------------------
const ICON = 48;
// Roy 30.10 (the satchel): "keep the inventory's design language, but the way the items look inside it has to change, it is not good
// enough. Take an example from MapleStory (not to copy): the weapons (and the skills too) should read much better; give me 3
// options". ?icons=a|b|c picks one (old: the look before). a "Close-up": the item fills its cell, chunkier, lifted, a light rim
// round its ink on the dark cells; b "Bright slots": the same framing on light parchment cells, black ink and a drop shadow, as
// MapleStory's; c "Pixel sprite": drawn at 24 px and doubled, its colours stepped into a few flat tones, a rarity glow behind it
// Roy 30.10: he picked c, for the items and the skills: it is the default now (?icons=a or b still show the others, ?icons=old today's)
export const ICON_STYLE = (() => { try { const v = new URLSearchParams(location.search).get('icons'); return /^[abc]$/.test(v) ? v : /^(old|0|off)$/.test(v || '') ? '' : 'c'; } catch { return typeof document !== 'undefined' ? 'c' : ''; } })();
if (ICON_STYLE && typeof document !== 'undefined') document.documentElement.dataset.icons = ICON_STYLE;
export const iconPerf = { n: 0, ms: 0, post: 0 }; // (time spent drawing item icons, for measuring the options)
const RIGS = new Map();
let IR = null;
function iconRig(px = ICON) {
  if (RIGS.has(px)) return (IR = RIGS.get(px));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = px;
  const R = createRenderer(canvas, { fixed: [px, px], alpha: true, shadows: false, fov: 10, outlinePx: 1 });
  R.post.uniforms.vig.value = 0; R.post.uniforms.outline.value = 0; R.post.uniforms.dither.value = px < ICON ? 0 : .3; // (the 24 px sprite, option c: flat tones, no dither noise)
  R.post.uniforms.sat.value = 1.18;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff6e8', '#4a3a58', 1.5));
  const key = new THREE.DirectionalLight('#fff1dc', 1.9); key.position.set(-4, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight('#bcd4ff', 1.1); rim.position.set(5, -2, -3); scene.add(rim);
  const holder = new THREE.Group(); scene.add(holder);
  const out = document.createElement('canvas'); out.width = out.height = ICON;
  IR = { R, scene, holder, canvas, px, out, ctx: out.getContext('2d', { willReadFrequently: true }) };
  RIGS.set(px, IR);
  return IR;
}
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion();
// fit `obj` (already rotated) into the icon; vertices with obj-local z < crop are ignored (long hafts run off the corner)
export function renderIcon(obj, crop = -Infinity, margin = 1.06) {
  const I = iconRig(ICON_STYLE === 'c' ? ICON / 2 : ICON);
  const content = new THREE.Group(); content.add(obj); I.holder.add(content);
  I.scene.updateMatrixWorld(true);
  _inv.copy(obj.matrixWorld).invert();
  const bb = new THREE.Box3();
  obj.traverse((m) => {
    if (!m.isMesh || m.userData.outline || !m.visible) return;
    const pos = m.geometry.attributes.position; _m.multiplyMatrices(_inv, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(_m);
      if (_v.z < crop) continue;
      bb.expandByPoint(_v.applyMatrix4(obj.matrixWorld));
    }
  });
  const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  const s = 2 / Math.max(sz.x, sz.y, .01);
  content.scale.setScalar(s); content.position.copy(c).multiplyScalar(-s);
  const cam = I.R.camera;
  const tf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  // (today the half-size 1 sat in a view of half-size margin + .175: ~80% of the tile; an option fills ~90% of it)
  // Roy 30.10 ("items must not stick out of their squares"): with an option, the drawn sprite, ink and shadow included, is measured
  // and drawn again smaller until it keeps ICON_EDGE px clear of every side of the 48 px tile (a 46 px cell keeps 3 px round it)
  let fill = ICON_FILL;
  const ctx = I.ctx, P = I.px, ov = outlineMat.visible; outlineMat.visible = false;
  try {
    for (let pass = 0; pass < 4; pass++) {
      cam.position.set(0, 0, ICON_STYLE ? 1 / (fill * tf) : margin / tf + 2); cam.lookAt(0, 0, 0);
      I.R.render(I.scene);
      ctx.clearRect(0, 0, ICON, ICON); ctx.drawImage(I.canvas, 0, 0);
      { // round 33 (GEAR): hard alpha, then the same ink as the skill tiles: a 1 px outline in a dark of the part's own colour, a cool
        // drop shadow, a warm lit lip along the tops (so a 48 px icon keeps its pixels crisp on any tile)
        const tp = performance.now();
        const img = ctx.getImageData(0, 0, P, P); for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 128 ? 255 : 0;
        if (!ICON_STYLE) ctx.putImageData(inkFigure(img, .45, .35), 0, 0);
        else if (ICON_STYLE === 'a') ctx.putImageData(inkBold(img), 0, 0);
        else if (ICON_STYLE === 'b') ctx.putImageData(inkMaple(img), 0, 0);
        else { // c: the 24 px sprite, doubled pixel for pixel
          const t = document.createElement('canvas'); t.width = t.height = P; t.getContext('2d').putImageData(inkSprite(img), 0, 0);
          ctx.clearRect(0, 0, ICON, ICON); ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, ICON, ICON);
        }
        iconPerf.post += performance.now() - tp;
      }
      if (!ICON_STYLE) break;
      const k = overreach(ctx); if (k <= 1) break;
      fill /= k * 1.02; iconPerf.redraws = (iconPerf.redraws || 0) + 1;
    }
  } finally { outlineMat.visible = ov; I.holder.remove(content); }
  return I.out.toDataURL('image/png');
}
// the options' pixel passes (Roy 30.10). Measured on today's icons (48 px): a one-handed sword covers 14% of its tile, ~5.6 px
// across (outline included: a 3 px blade), a great sword 17%, an axe 16% (a long haft, a small head); the item spans ~40 px, then
// the satchel squeezes it to 42/48 (every 8th row and column dropped) = ~35 px of a 46 px cell; 27-47% of its pixels are ink of
// brightness ~27 on a cell of ~40, so the outline is lost in the cell and only the lit middle of a thin blade is seen
const ICON_FILL = ICON_STYLE === 'c' ? .68 : .72, ICON_EDGE = 4, THICK = { a: 1.45, b: 1.45, c: 1.6 }[ICON_STYLE] || 1;
// Roy 30.10 ("nothing sticks out of its square"): a drawn (not rendered) item picture whose pixels come nearer the edge than
// ICON_EDGE is redrawn smaller, pixel for pixel (nearest), centred on the 48 px tile; with no option it is left as it was
function fitTile(src) {
  if (!ICON_STYLE) return src;
  const c = document.createElement('canvas'); c.width = c.height = ICON; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, ICON, ICON);
  const k = overreach(x); if (k <= 1) return c;
  const s = ICON / k, o = (ICON - s) / 2, out = document.createElement('canvas'); out.width = out.height = ICON; const y = out.getContext('2d'); y.imageSmoothingEnabled = false; y.drawImage(c, Math.round(o), Math.round(o), Math.round(s), Math.round(s));
  return out;
}
const fitURL = (u) => (!ICON_STYLE || !u ? Promise.resolve(u) : new Promise((res) => { const im = new Image(); im.onload = () => res(fitTile(im).toDataURL('image/png')); im.onerror = () => res(u); im.src = u; }));
// how far past the clear edge the drawn pixels reach, as a ratio of the half-tile they may use (1 or less: it fits)
function overreach(ctx) {
  const d = ctx.getImageData(0, 0, ICON, ICON).data, h = ICON / 2, lim = h - ICON_EDGE; let r = 0;
  for (let y = 0; y < ICON; y++) for (let x = 0; x < ICON; x++) if (d[(y * ICON + x) * 4 + 3]) r = Math.max(r, x < h ? h - x : x + 1 - h, y < h ? h - y : y + 1 - h);
  return r / lim;
}
function liftPx(d, i, g) { for (let k = 0; k < 3; k++) d[i + k] = 255 * Math.pow(d[i + k] / 255, g); }
function ringOf(img, test) { // the clear pixels next to (4-way) a pixel passing test(index) -> [pixel index, neighbour index]
  const N = img.width, d = img.data, out = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4; if (d[i + 3] > 128) continue;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= N || Y >= N) continue; const j = (Y * N + X) * 4; if (test(j)) { out.push([i, j]); break; } }
  }
  return out;
}
// a: lifted mid-tones, the usual lit tops, ink nearly black, and outside the ink a faint warm rim that lifts it off the dark cell
function inkBold(img, drawn = false) {
  const d = img.data; if (!drawn) for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) liftPx(d, i, .8);
  inkFigure(img, drawn ? 1 : .6, drawn ? 1 : .3);
  const ink = ringOf(img, (j) => d[j + 3] === 255);
  for (const [i] of ink) { d[i] = 255; d[i + 1] = 226; d[i + 2] = 170; d[i + 3] = drawn ? 110 : 88; }
  return img;
}
// b: for a light cell: true black-brown ink, a soft shadow down and right, colours a touch richer
function inkMaple(img, drawn = false) {
  const N = img.width, d = img.data; if (!drawn) for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) liftPx(d, i, .9);
  const src = new Uint8ClampedArray(d), op = (x, y) => x >= 0 && y >= 0 && x < N && y < N && src[(y * N + x) * 4 + 3] > 128;
  inkFigure(img, drawn ? 1 : .5, drawn ? 1 : .25);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; if (src[i + 3] > 128 || d[i + 3] === 255) continue; if (op(x - 1, y - 1) || op(x - 2, y - 2)) { d[i] = 40; d[i + 1] = 26; d[i + 2] = 22; d[i + 3] = 90; } }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; if (src[i + 3] <= 128 && d[i + 3] === 255) { d[i] = d[i] * .5 + 4; d[i + 1] = d[i + 1] * .5 + 2; d[i + 2] = d[i + 2] * .5 + 6; } }
  return img;
}
// c's skill figures: lit tops as usual, then a plain near-black 1 px ink (no coloured ink, no soft shadow): the crispest edge
function inkCrisp(img) { const d = img.data, was = new Uint8Array(d.length / 4); for (let i = 0; i < was.length; i++) was[i] = d[i * 4 + 3] > 128; inkFigure(img, 1, 1); for (let i = 0; i < was.length; i++) { const j = i * 4; if (was[i]) continue; if (d[j + 3] === 255) { d[j] = 16; d[j + 1] = 10; d[j + 2] = 14; } else d[j + 3] = 0; } return img; }
// c: each pixel's light stepped to one of five tones (hue kept, a little more saturated), a 1 px ink, lit tops: a flat sprite
const TONES = [.16, .32, .5, .68, .86];
function inkSprite(img) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0; if (mx !== mn) { const e = mx - mn; s = l > .5 ? e / (2 - mx - mn) : e / (mx + mn); h = mx === r ? (g - b) / e + (g < b ? 6 : 0) : mx === g ? (b - r) / e + 2 : (r - g) / e + 4; h /= 6; }
    const L2 = TONES.reduce((a, t) => (Math.abs(t - Math.min(.92, l * 1.12)) < Math.abs(a - Math.min(.92, l * 1.12)) ? t : a)), S2 = Math.min(1, s * 1.2);
    const q = L2 < .5 ? L2 * (1 + S2) : L2 + S2 - L2 * S2, p = 2 * L2 - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    d[i] = f(h + 1 / 3) * 255; d[i + 1] = f(h) * 255; d[i + 2] = f(h - 1 / 3) * 255; d[i + 3] = 255;
  }
  inkFigure(img, .55, .3);
  return img;
}
// 1px dark outline around every opaque pixel
function inkOutline(ctx, N, rgb) {
  const img = ctx.getImageData(0, 0, N, N), d = img.data;
  const op = (x, y) => x >= 0 && y >= 0 && x < N && y < N && d[(y * N + x) * 4 + 3] > 128;
  const add = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!op(x, y) && (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1))) add.push((y * N + x) * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; d[i + 3] = d[i + 3] > 128 ? 255 : 0; }
  for (const i of add) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}
// weapon pose: grip bottom-left, tip top-right, flat of the blade toward the camera, a quarter turn of depth
const DIAG = new THREE.Vector3(1, 1, 0).normalize(), ACROSS = new THREE.Vector3(-1, 1, 0).normalize();
function poseWeapon(o, flip = 1, twist = -.5) {
  const zA = flip > 0 ? DIAG : new THREE.Vector3(-1, 1, 0).normalize();
  const yA = new THREE.Vector3(0, 0, 1), xA = new THREE.Vector3().crossVectors(yA, zA);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA));
  o.quaternion.premultiply(_q.setFromAxisAngle(zA, twist * flip));
  o.quaternion.premultiply(_q.setFromAxisAngle(flip > 0 ? ACROSS : DIAG, .18 * flip));
}
function weaponIcon(id) {
  const w = WEAPONS[id]; const { right } = makeWeapon(id); const left = w.style === 'dual' ? makeWeapon(id).left : null;
  const grp = new THREE.Group();
  const tip = right.userData.tip;
  if (THICK !== 1) for (const o of [right, left]) o?.scale.set(THICK, THICK, 1); // (an option: the blade and haft chunkier across, as a sprite's)
  const crop = ICON_STYLE ? -Infinity : w.style === 'polearm' ? tip * .42 : w.style === 'twohand' ? -.12 : -Infinity; // (Roy 30.10, "nothing sticks out of its square": with an option the whole weapon is fitted, no haft runs off the corner)
  if (left) { // crossed pair: grips at the bottom corners, crossing a little below the middle
    poseWeapon(right, 1); poseWeapon(left, -1);
    const a = tip * .707 * (w.id === 'erinyes_sickles' ? .16 : .42);
    right.position.set(-a, 0, .06); left.position.set(a, 0, -.06);
    grp.add(right, left);
    // crop in grp space is meaningless for a pair; fit the whole pair
    return renderIcon(grp, -Infinity);
  }
  poseWeapon(right, 1); grp.add(right);
  if (crop > -Infinity) { // crop measured along the weapon: wrap in a frame whose local z is the weapon axis
    const fr = new THREE.Group(); fr.quaternion.copy(right.quaternion); right.quaternion.identity(); fr.add(right);
    return renderIcon(fr, crop);
  }
  return renderIcon(grp);
}
function itemIcon(id) {
  const o = makeItemModel(id);
  const grp = new THREE.Group(); grp.add(o);
  o.rotation.set(.42, -.55, 0, 'XYZ');
  return renderIcon(grp, -Infinity, 1.1);
}

// ---- skill icons: 24x24 hand-drawn pixel art, scaled 2x nearest-neighbour
function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
const shade = (c, k) => { const [r, g, b] = hex(c); const f = (v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
export const pxShade = (c, k) => shade(c, k); // (v31: skillicons.js)
export class Px { // (v31: exported for the Path of Ascent icons, skillicons.js)
  // s 2 (Roy 30.10, "make all the skill icons finer, more precise"; the ?icons options): the same 24-unit drawing calls painted on a
  // 48 px canvas: lines 1 px thin, disks, rings and shapes on the fine grid, so a figure is drawn at the size it is shown at
  // (today it is drawn at 24 and doubled by EPX: 2 px lines, stair-stepped curves). Single dots and rects keep their size
  constructor(n = 24, s = 1) { this.n = n; this.s = s; this.c = document.createElement('canvas'); this.c.width = this.c.height = n * s; this.x = this.c.getContext('2d', { willReadFrequently: true }); if (s > 1) this.x.setTransform(s, 0, 0, s, 0, 0); }
  p(x, y, col) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.n || y >= this.n) return; this.x.fillStyle = col; this.x.fillRect(x, y, 1, 1); }
  fp(x, y, col) { const s = this.s, X = Math.floor((x + .5) * s), Y = Math.floor((y + .5) * s); if (X < 0 || Y < 0 || X >= this.n * s || Y >= this.n * s) return; this.x.fillStyle = col; this.x.fillRect(X / s, Y / s, 1 / s, 1 / s); } // (one fine pixel, at a 24-unit point)
  rect(x, y, w, h, col) { this.x.fillStyle = col; this.x.fillRect(x, y, w, h); }
  line(x0, y0, x1, y1, col, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 * this.s + 1;
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (w > 1) this.disk(x, y, w / 2 - .01, col); else if (this.s > 1) this.fp(x, y, col); else this.p(x, y, col); }
  }
  disk(cx, cy, r, col) {
    if (this.s > 1) { const s = this.s; for (let Y = Math.floor((cy - r - 1) * s); Y <= (cy + r + 1) * s; Y++) for (let X = Math.floor((cx - r - 1) * s); X <= (cx + r + 1) * s; X++) { const x = (X + .5) / s - .5, y = (Y + .5) / s - .5; if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + .3) this.fp(x, y, col); } return; }
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + .3) this.p(x, y, col);
  }
  ring(cx, cy, r, col, a0 = 0, a1 = PI * 2, w = 1) { const n = Math.ceil(r * 8 * this.s * Math.abs(a1 - a0) / PI) + 2; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; if (w > 1) this.disk(cx + Math.cos(a) * r, cy + Math.sin(a) * r, w / 2 - .01, col); else if (this.s > 1) this.fp(cx + Math.cos(a) * r, cy + Math.sin(a) * r, col); else this.p(cx + Math.cos(a) * r, cy + Math.sin(a) * r, col); } }
  poly(pts, col) { this.x.fillStyle = col; this.x.beginPath(); this.x.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) this.x.lineTo(q[0], q[1]); this.x.closePath(); this.x.fill(); this.hard(); }
  hard() { const N = this.c.width, img = this.x.getImageData(0, 0, N, N); for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 110 ? 255 : 0; this.x.putImageData(img, 0, 0); }
  outline(rgb = [20, 12, 10]) { inkOutline(this.x, this.c.width, rgb); }
}
export const SKILL_PX = ICON_STYLE ? 2 : 1; // (the skill figures' grid: fine with the options)
const SKILL_DRAW = {
  zeus(d, c) { // Wrath of Olympus: a jagged bolt splitting a dark cloud over a mountain peak
    d.poly([[2, 21], [9, 11], [12, 14], [16, 8], [22, 21]], '#3a4468'); d.poly([[14, 10], [16, 8], [18, 11]], '#e8ecf2');
    d.disk(7, 5, 3.2, '#4a5a8a'); d.disk(12, 4, 3.8, '#5a6a9a'); d.disk(17, 5, 3.2, '#4a5a8a'); d.rect(5, 5, 14, 3, '#4a5a8a');
    d.poly([[12, 7], [9, 13], [12, 13], [10, 19], [16, 11], [13, 11], [15, 7]], c); d.line(12, 8, 10, 12, '#ffffff');
  },
  oath(d, c) { // The Serpent's Oath: a golden serpent coiled round a downward blade, rays behind
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; d.line(12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6, 12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10, shade(c, .9)); }
    d.rect(11, 3, 3, 14, '#e8ecf2'); d.line(12, 3, 12, 16, '#ffffff'); d.poly([[10, 17], [15, 17], [12.5, 21]], '#e8ecf2'); d.rect(8, 6, 9, 2, '#a86a2a');
    d.ring(12.5, 11, 5, c); d.ring(12.5, 15, 4, shade(c, .8)); d.disk(17, 9, 1.6, c); d.p(18, 8, '#3a1a08');
  },
  rise(d, c) { // RISE: pale spirits lifting out of a grave line
    d.rect(2, 19, 20, 2, '#3a3a48');
    for (const [x, h, k] of [[5, 9, .8], [12, 13, 1.15], [19, 9, .8]]) {
      d.poly([[x - 3, 19], [x + 3, 19], [x + 2.5, 19 - h + 3], [x, 19 - h], [x - 2.5, 19 - h + 3]], shade(c, k));
      d.p(x - 1, 19 - h + 3, '#0e1a2a'); d.p(x + 1, 19 - h + 3, '#0e1a2a');
    }
    d.line(9, 5, 15, 5, '#ffffff'); d.line(12, 3, 12, 7, '#ffffff');
  },
  dash(d, c) {
    for (const [y, x0, x1] of [[15, 1, 5], [18, 2, 6], [21, 1, 4]]) d.line(x0, y, x1, y, c);
    d.poly([[8, 20], [22, 20], [22, 17], [18, 15.5], [15, 13], [15, 5], [9, 5], [9, 14], [7.5, 17]], '#a86a3a');
    d.rect(8, 19, 15, 2, '#4a2a16'); d.line(9, 8, 14, 8, '#e0b070'); d.line(9, 12, 14, 12, '#e0b070'); d.line(17, 15, 19, 17, '#e0b070');
    d.line(10, 6, 14, 6, '#c8884a');
    for (const [x0, y0, x1, y1] of [[9, 9, 2, 3], [9, 11, 1, 7], [9, 13, 2, 11]]) d.line(x0, y0, x1, y1, '#f4f6fa', 2.2);
    d.line(8, 9, 3, 4, '#c8d0dc'); d.line(8, 11, 2, 8, '#c8d0dc'); d.p(2, 3, '#ffffff');
  },
  whirl(d, c) {
    for (let k = 0; k < 3; k++) {
      const a0 = k * PI * 2 / 3 - .4;
      for (let t = 0; t <= 1; t += .02) { const a = a0 + t * 2.3, r = 3.5 + t * 6, w = .5 + t * 1.3; d.disk(12 + Math.cos(a) * r, 12 + Math.sin(a) * r, w, t > .8 ? shade(c, 1.45) : t > .45 ? c : shade(c, .7)); }
    }
    d.rect(11, 5, 3, 11, '#e4e8ee'); d.rect(12, 5, 1, 11, '#ffffff'); d.p(12, 4, '#ffffff');
    d.rect(9, 16, 7, 2, '#80858f'); d.rect(11, 18, 3, 3, '#3a2a20'); d.p(12, 21, '#80858f');
  },
  fate(d, c) { // Atropos' Edge: a carbon-black blade, a silver sheen down its edge, the golden thread wound round it
    d.line(4, 20, 7, 17, '#8a6640', 2); d.line(3, 16, 8, 21, '#c8a060');
    d.line(8, 16, 20, 4, '#24252b', 3); d.line(9, 16, 20, 5, '#3e424e'); d.line(8, 15, 19, 4, '#7a8294');
    for (let t = 0; t <= 1; t += .035) { const x = 8.5 + t * 11, y = 15.5 - t * 11, w = Math.sin(t * PI * 7) * 1.9; d.p(x + w * .7, y + w * .7, Math.sin(t * PI * 7) > 0 ? '#ffd24a' : '#a87a1e'); }
    d.p(20, 4, '#ffffff'); d.p(14, 9, '#e8eef8'); d.p(11, 13, c);
  },
  heal(d, c) { // Holy Heal: a glowing green ankh
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; d.line(12 + Math.cos(a) * 5, 12 + Math.sin(a) * 5, 12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10, i % 2 ? shade(c, .55) : shade(c, .75)); }
    d.ring(12, 7, 3.3, c, 0, PI * 2, 2.2); d.rect(6, 11, 13, 3, c); d.rect(10.5, 13, 4, 9, c);
    d.line(7, 11, 17, 11, shade(c, 1.5)); d.line(11, 14, 11, 20, shade(c, 1.4)); d.ring(12, 7, 3.3, shade(c, 1.5), PI * .9, PI * 1.5, 1);
  },
  quake(d, c) { // Axe Smash: a double axe crashing down
    for (const [x0, y0, x1, y1] of [[3, 21, 8, 21], [2, 19, 5, 17], [8, 22, 11, 19], [1, 15, 4, 14]]) d.line(x0, y0, x1, y1, '#c8a878');
    d.line(5, 19, 16, 8, '#7a4a28', 2); d.p(5, 20, '#4a2a16');
    const C = [16, 8], u = [.707, -.707], v = [.707, .707], P2 = (a, b) => [C[0] + v[0] * a + u[0] * b, C[1] + v[1] * a + u[1] * b];
    for (const s of [1, -1]) {
      d.poly([P2(s * 1.5, -1.6), P2(s * 6, -4.2), P2(s * 7.2, 0), P2(s * 6, 4.2), P2(s * 1.5, 1.6)], '#d8dce4');
      d.poly([P2(s * 2.5, -1.2), P2(s * 5, -2.6), P2(s * 5.5, 0), P2(s * 5, 2.6), P2(s * 2.5, 1.2)], '#8a909c');
    }
    d.disk(16, 8, 1.6, '#e8b840');
    d.ring(16, 8, 9.5, '#ffffff', PI * .55, PI * .95, 1);
  },
  thunder(d, c) {
    for (const [x, y, r] of [[8, 6, 3.5], [13, 5, 4.2], [17, 7, 3.2], [11, 8, 3]]) d.disk(x, y, r, '#5a6478');
    d.rect(5, 7, 15, 3, '#5a6478'); d.line(6, 4, 9, 3, '#8a94a8');
    d.poly([[12, 9], [8, 16], [11, 16], [9, 22], [16, 13], [12, 13], [15, 9]], c);
    d.line(12, 10, 10, 15, '#ffffff'); d.p(10, 20, '#ffffff');
    for (const [x, y] of [[5, 18], [18, 19], [19, 15]]) { d.p(x, y, '#9fd8ff'); d.p(x + 1, y - 1, '#9fd8ff'); }
  },
  gaze(d, c) {
    d.poly([[2, 13], [7, 8], [12, 7], [17, 8], [22, 13], [17, 18], [12, 19], [7, 18]], '#e8f0d8');
    d.disk(12, 13, 5, c); d.disk(12, 13, 3.5, shade(c, 1.25));
    d.line(12, 9, 12, 17, '#101408'); d.p(13, 10, '#ffffff'); d.p(14, 11, '#ffffff');
    for (const s of [-1, 1]) { d.ring(12 + s * 6, 5, 3, '#4f8f44', s > 0 ? PI * .9 : PI * .1, s > 0 ? PI * 2 : -PI * 1, 1); d.p(12 + s * 9, 5, '#4f8f44'); d.p(12 + s * 9, 4, '#ffe14a'); }
  },
  fireball(d, c) { // a comet of fire
    d.poly([[6, 11], [12, 9], [22, 2], [17, 9], [21, 8], [14, 15], [10, 18]], '#ff5a1a');
    d.poly([[9, 12], [13, 11], [19, 5], [16, 10], [18, 10], [13, 14]], '#ffa030');
    d.disk(9, 15, 5.2, '#ff4a1a'); d.disk(9, 15, 3.8, '#ffa030'); d.disk(8.5, 15.5, 2.2, '#fff0a0'); d.p(7, 14, '#ffffff');
  },
  flurry(d, c) { // daggers thrusting with white streaks
    for (let i = 0; i < 4; i++) {
      const y = 5 + i * 4.3, x0 = 2 + (i % 2) * 2, x1 = 14 + (i % 2) * 2;
      d.line(x0, y + 1.5, x1 - 1, y, shade(c, .55)); d.line(x0 + 3, y + 1, x1 - 1, y, '#ffffff');
      d.line(x1, y, x1 + 5, y - 1, '#d8dce4'); d.p(x1 + 6, y - 1, '#ffffff'); d.line(x1, y - 1.5, x1, y + 1.5, '#a87a3a'); d.p(x1 - 1, y, '#3a2a20');
    }
  },
  hellfire(d, c) { // a ring of violet flames rising from dark ground
    d.rect(2, 18, 20, 4, '#2a1a30');
    for (let i = 0; i < 7; i++) { const x = 3 + i * 3; d.poly([[x - 2, 19], [x, 9 + (i % 3) * 2], [x + 2, 19]], i % 2 ? '#b46cff' : '#8a3ad8'); d.poly([[x - 1, 19], [x, 14 + (i % 2)], [x + 1, 19]], '#ff9a4a'); }
    d.disk(12, 19, 2.2, '#ffd04a'); d.p(12, 18, '#ffffff');
  },
  fog(d, c) { // a dark vortex of smoke
    for (let t = 0; t < 9; t += .12) { const a = t * 1.05, r = .6 + t * 1.05; d.disk(12 + Math.cos(a) * r, 12 + Math.sin(a) * r * .9, .9 + t * .14, t < 2 ? '#e8dcff' : t < 5 ? shade(c, 1.1) : t < 7 ? c : shade(c, .7)); }
    for (let t = 0; t < 9; t += .12) { const a = t * 1.05 + PI, r = .6 + t * 1.05; d.disk(12 + Math.cos(a) * r, 12 + Math.sin(a) * r * .9, .5 + t * .1, t < 3 ? '#c8b8f0' : '#5a4a7a'); }
    for (const [x, y] of [[4, 5], [19, 4], [20, 19], [5, 19]]) d.p(x, y, '#ffffff');
  },
  wave(d, c) { // the great wave curling over
    d.poly([[2, 22], [2, 14], [4, 9], [8, 5], [13, 3], [18, 3.5], [21.5, 6.5], [21, 10], [18, 8], [15, 8], [13, 10], [13, 14], [17, 17], [22, 17], [22, 22]], '#2f7ad0');
    d.disk(17, 12.5, 3, shade(c, 1.0)); d.line(13, 14, 17, 16.5, '#2f7ad0');
    d.line(4, 15, 6, 9, '#5ab0f0'); d.line(6, 9, 10, 6, '#5ab0f0'); d.line(5, 19, 9, 13, '#1e5aa8');
    d.line(4, 9, 8, 5, '#e8f8ff'); d.line(8, 5, 13, 3, '#e8f8ff'); d.line(13, 3, 18, 3.5, '#e8f8ff'); d.line(18, 3.5, 21.5, 6.5, '#e8f8ff');
    for (const [x, y] of [[21, 8], [20, 9], [19, 8], [18, 9], [17, 8.5], [16, 9], [15, 8.5]]) d.p(x, y, '#ffffff');
    for (const [x, y] of [[15, 19], [18, 18], [20, 20], [9, 20], [5, 21]]) d.line(x, y, x + 2, y, '#e8f8ff');
  },
  prophecy(d, c) { // the seer's eye and floating glyphs
    d.poly([[3, 13], [8, 8.5], [12, 8], [16, 8.5], [21, 13], [16, 17], [12, 17.5], [8, 17]], '#f2ead8');
    d.disk(12, 12.8, 4, '#3a7ad8'); d.disk(12, 12.8, 2.6, '#5aa8f0'); d.disk(12, 12.8, 1.5, '#0e0c10'); d.p(11, 11, '#ffffff'); d.p(13.5, 11.5, '#ffffff');
    d.line(4, 12, 8, 8, '#3a2214'); d.line(8, 8, 16, 8, '#3a2214'); d.line(16, 8, 20, 12, '#3a2214');
    for (const x of [7, 10, 13, 16]) d.line(x, 8, x - .5, 6.5, '#3a2214');
    const g1 = [[3, 2], [3, 3], [5, 2], [5, 3], [7, 2], [7, 3], [4, 4], [6, 4], [5, 4], [5, 5], [5, 6]]; for (const [x, y] of g1) d.p(x, y + 1, c);
    const g2 = [[18, 3], [19, 2], [20, 2], [21, 3], [21, 4], [20, 5], [18, 4], [18, 5], [17, 6], [19, 6], [22, 6], [20, 6]]; for (const [x, y] of g2) d.p(x, y, c);
    for (const [x, y] of [[4, 20], [7, 21], [17, 21], [20, 19]]) d.p(x, y, shade(c, 1.3));
  },
};
Object.assign(SKILL_DRAW, BOOK_DRAW); // icons of the skill book (skillbook.js)
export const addSkillDraw = (id, fn) => { SKILL_DRAW[id] = fn; }; // round 30: a skill painted by another module (mounts.js)
export const EXTRA_ICONS = {}; // round 30: id -> () => data URL, for things that are not weapons, gear or items (mounts.js)
// Roy 30.10 ("the coin is a bit weak to look at", option A): the drachma's icon is a drawn Athenian tetradrachm, Athena's
// owl on warm gold with a glint (32 px pixel art), in place of the rendered heap of coins
// that came out nearly white at the purse's size. Every place that shows the coin takes it (satchel, shops, selling, fusion)
EXTRA_ICONS.drachma = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACL0lEQVR4nOWXv2sUQRTHPxt068PiBJsEiwTuhIBgl1KusAjYXG2RQrAKWN0fkPZaixTW2xxckWKxsLhCsAokAQOKggRc4UhlcRZrEd45Oz/fgGLht9m7uZn5fua9NzO38L+ryB0w6Jdt7PeLZpU1p7qzGL+f70X7PdpfeEHab6/b4u4zxy8JoDVOgbQ/r9ri9r08gEG/bE3jxfxMZb4z7K0/Pzn8zEWzKrIBQuaj5wedfj+u3nW+S7+dYY/NxxO4M3InX9ZIOrwApvlifsZoUsGydvrZ5iEQgM3xW3wR2Pgb5gB7+w8A+HB+3Zk7CvCnzE2I08sV1ayBZc3JdMuBcCIQU/3qOGluF+qLlw8B+PLmyNt/nRNn9YFiS+0ECb3o+8evAFSzht3tEoDD4+v19rwVnc1jPppU6/b6aAzgtAmEmMfkpMBeoTbftnzmp5erNAD83ush8+F9d2+bbT7z8dO+d65gEcZWfv7J3Rm+No0KcAvQLiRTZookpFJc0D2GbfkKcQNuLgy5PHK0u112zLUyd0HWOaC5jMyTTyMvgMZIwm8/Q6pmjQ4glkNTEnr7qRkTBEgdHGZxhiKgXYCocz0O+mV7Mt0CbnLpO1ZTOfYBhI5hSBShWQt2dLQ1EMq9yPmDYEZBBtunWCgK9uplfGj1XgAthAkSCnvKPAhgQ6RAYsYx8yiACSErTe11kdY8CSAQANODnsrcNIb0m1L2m1EKRGucDWCDhJT7bvjP9QuLnlygNuMENQAAAABJRU5ErkJggg==';
// round 33 (GEAR, stage 8): the skill tile drawn at the icon's own 48 px instead of 24 px doubled: the carved bronze
// frame with four gold rivets and the deep field lit from its centre (ordered dither) at full resolution; the 24 px
// figure smoothed to 48 by EPX (its stair-steps become round curves), inked with a 1 px outline in a dark of its own
// colour, a cool shadow under it, lit along its top edges (warm) and shaded along its bottom ones (violet).
// skillTile(bg0, layers, fig): layers are 24 px canvases drawn as they are (smoothed), fig the figure (inked and lit).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function epx2(src) {
  const n = src.width, d = src.getContext('2d').getImageData(0, 0, n, n).data, N = n * 2, out = new ImageData(N, N), o = out.data;
  const k = (x, y) => { if (x < 0 || y < 0 || x >= n || y >= n) return 0; const i = (y * n + x) * 4; return d[i + 3] < 128 ? 0 : ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) + 1; };
  const put = (X, Y, x, y) => { const i = (y * n + x) * 4, j = (Y * N + X) * 4; if (d[i + 3] < 128) return; o[j] = d[i]; o[j + 1] = d[i + 1]; o[j + 2] = d[i + 2]; o[j + 3] = 255; };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const A = k(x, y - 1), B = k(x + 1, y), Cc = k(x - 1, y), D = k(x, y + 1);
    put(2 * x, 2 * y, ...(Cc === A && Cc !== D && A !== B ? [x - 1, y] : [x, y]));
    put(2 * x + 1, 2 * y, ...(A === B && A !== Cc && B !== D ? [x + 1, y] : [x, y]));
    put(2 * x, 2 * y + 1, ...(D === Cc && D !== B && Cc !== A ? [x - 1, y] : [x, y]));
    put(2 * x + 1, 2 * y + 1, ...(B === D && B !== A && D !== Cc ? [x + 1, y] : [x, y]));
  }
  return out;
}
function inkFigure(img, kl = 1, ks = 1) { // 1 px ink in a dark of the neighbour's own colour, a cool drop shadow, lit tops and shaded bottoms
  const N = img.width, d = img.data, op = (x, y) => x >= 0 && y >= 0 && x < N && y < N && d[(y * N + x) * 4 + 3] > 128;
  const src = new Uint8ClampedArray(d), ink = [], sh = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (op(x, y)) continue;
    let nb = -1; for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (op(x + dx, y + dy)) { nb = ((y + dy) * N + x + dx) * 4; break; }
    if (nb >= 0) ink.push([(y * N + x) * 4, nb]); else if (op(x - 1, y - 1) || op(x - 2, y - 1) || op(x - 1, y - 2)) sh.push((y * N + x) * 4);
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4; if (src[i + 3] < 128) continue;
    const up = !op(x, y - 1), dn = !op(x, y + 1), lum = src[i] * .3 + src[i + 1] * .59 + src[i + 2] * .11;
    if (lum < 40) continue; // (the figure's own dark lines stay as drawn)
    if (up) { d[i] = d[i] + (255 - d[i]) * .32 * kl; d[i + 1] = d[i + 1] + (244 - d[i + 1]) * .3 * kl; d[i + 2] = d[i + 2] + (208 - d[i + 2]) * .22 * kl; }
    else if (dn) { const a = .3 * ks; d[i] = d[i] * (1 - a) + 42 * a; d[i + 1] = d[i + 1] * (1 - a) + 24 * a; d[i + 2] = d[i + 2] * (1 - a) + 64 * a; }
  }
  for (const [i, nb] of ink) { d[i] = src[nb] * .18 + 14; d[i + 1] = src[nb + 1] * .14 + 8; d[i + 2] = src[nb + 2] * .2 + 20; d[i + 3] = 255; }
  for (const i of sh) { d[i] = 10; d[i + 1] = 6; d[i + 2] = 20; d[i + 3] = 110; }
  return img;
}
const rgbOf = (c) => (c[0] === '#' ? hex(c) : (c.match(/\d+/g) || [60, 40, 30]).slice(0, 3).map(Number));
const toHex = ([r, g, b]) => '#' + ((1 << 24) | Math.round(r) << 16 | Math.round(g) << 8 | Math.round(b)).toString(16).slice(1);
export function skillTile(bg0, layers = [], fig = null) {
  // Roy 30.10 (the options, ICON_STYLE): a lifts the field and rims the figure; b sets it on a light parchment field; c draws it as a doubled 24 px sprite
  if (ICON_STYLE) { const c = rgbOf(bg0), L0 = [239, 228, 204]; bg0 = toHex(ICON_STYLE === 'b' ? c.map((v, k) => v * .28 + L0[k] * .72) : ICON_STYLE === 'a' ? c.map((v) => v + (255 - v) * .12) : c); }
  const out = document.createElement('canvas'); out.width = out.height = ICON; const o = out.getContext('2d', { willReadFrequently: true });
  const R = (x, y, w, h, col) => { o.fillStyle = col; o.fillRect(x, y, w, h); }, N = ICON;
  R(0, 0, N, N, '#0e0a08'); R(1, 1, N - 2, N - 2, '#4a3626');
  R(1, 1, N - 2, 1, '#9a7650'); R(1, 1, 1, N - 2, '#8a6a48'); R(2, 2, N - 4, 1, '#6e5038'); R(2, 2, 1, N - 4, '#634830'); // the lit bevel, top and left
  R(1, N - 2, N - 2, 1, '#2a1c12'); R(N - 2, 1, 1, N - 2, '#2a1c12'); R(2, N - 3, N - 4, 1, '#3a281a'); R(N - 3, 2, 1, N - 4, '#3a281a'); // the shade, bottom and right
  for (let x = 6; x < N - 6; x += 4) { R(x, 3, 1, 1, '#5e4430'); R(x, N - 4, 1, 1, '#33231a'); } // the carving
  R(4, 4, N - 8, N - 8, '#120c0a'); R(5, 5, N - 10, N - 10, bg0);
  const L = [shade(bg0, .62), shade(bg0, .82), null, shade(bg0, 1.12), shade(bg0, 1.28)];
  for (let y = 5; y < N - 5; y++) for (let x = 5; x < N - 5; x++) {
    const r = Math.hypot(x - 23.5, y - 22.5) / 19, v = (1 - r) * 2.3 + BAYER[(y & 3) * 4 + (x & 3)] / 16 * .9 - .2;
    const q = v > 1.75 ? 4 : v > 1.05 ? 3 : r > 1.08 ? 0 : r > .92 && v < .1 ? 1 : 2; if (L[q]) R(x, y, 1, 1, L[q]);
  }
  R(5, 5, N - 10, 1, shade(bg0, .55)); R(5, 5, 1, N - 10, shade(bg0, .6)); // the field sits under the frame's lip
  for (const [x, y] of [[2, 2], [N - 4, 2], [2, N - 4], [N - 4, N - 4]]) { R(x, y, 2, 2, '#c88a30'); R(x, y, 1, 1, '#fff0a0'); R(x + 1, y + 1, 1, 1, '#6a4218'); } // gold rivets
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = N; const t = tmp.getContext('2d', { willReadFrequently: true });
  const up = (c) => (c.width === N ? c.getContext('2d').getImageData(0, 0, N, N) : epx2(c)); // (a fine 48 px figure goes on as drawn)
  for (const c of layers) { t.clearRect(0, 0, N, N); t.putImageData(up(c), 0, 0); o.drawImage(tmp, 0, 0); }
  if (fig) { t.clearRect(0, 0, N, N); t.putImageData(ICON_STYLE === 'a' ? inkBold(up(fig), true) : ICON_STYLE === 'b' ? inkMaple(up(fig), true) : ICON_STYLE === 'c' ? inkCrisp(up(fig)) : inkFigure(up(fig)), 0, 0); o.drawImage(tmp, 0, 0); }
  roundTile(out);
  return out;
}
// v31b (Roy 24.10: "everything a little rounder at the corners, the skill icons' contour too"): a pixel-stepped round
// corner on a square tile. Pixels outside a quarter circle of radius r in each corner turn transparent, the ring of pixels
// on its edge takes the frame's outline colour, so the dark outline runs round the corner in clean pixel steps
// (r 5 on the 48 px tile: 3-1-1 cleared, the step 1 px wide). The rivets (2..3) sit inside the curve and stay.
export const TILE_R = 5;
export function roundTile(cv, r = TILE_R, edge = '#0e0a08') {
  const o = cv.getContext('2d'), N = cv.width;
  o.fillStyle = edge;
  for (let y = 0; y < r; y++) for (let x = 0; x < r; x++) {
    const d = Math.hypot(r - (x + .5), r - (y + .5));
    if (d <= r - 1) continue;
    for (const [px, py] of [[x, y], [N - 1 - x, y], [x, N - 1 - y], [N - 1 - x, N - 1 - y]]) {
      if (d > r) o.clearRect(px, py, 1, 1); else o.fillRect(px, py, 1, 1);
    }
  }
  return cv;
}
function skillIcon(id) {
  const sk = SKILLS[id]; const c = sk.color, bg0 = sk.bg || shade(c, .3);
  const fg = new Px(24, SKILL_PX);
  SKILL_DRAW[id](fg, c); fg.hard();
  return buffBadge(skillTile(bg0, [], fg.c), id).toDataURL('image/png');
}
// Roy 30.10: a skill that strengthens her own weapon and blows (a timed weapon buff, an imbue) carries a small green "+" in the
// tile's top-right corner, readable on the HUD bar (the corner the cooldown number and the key cap leave free)
export const WEAPON_BUFF = new Set(['fate', 'chain', 'keres', 'warcry', 'hera', 'arc_ember_arrows', 'skill_006', 'skill_037', 'skill_071']);
export function buffBadge(cv, id) {
  if (!WEAPON_BUFF.has(id)) return cv;
  const o = cv.getContext('2d'), R = (x, y, w, h, col) => { o.fillStyle = col; o.fillRect(x, y, w, h); };
  R(32, 3, 13, 13, '#0e0a08'); R(33, 4, 11, 11, '#2f9a3e'); R(33, 4, 11, 1, '#7fe08a'); R(33, 4, 1, 11, '#5ac868'); R(33, 14, 11, 1, '#1a5a24');
  R(35, 8, 7, 3, '#ffffff'); R(37, 6, 3, 7, '#ffffff');
  return cv;
}
function gearIcon(id) {
  const o = makeGearModel(id), grp = new THREE.Group(); grp.add(o);
  const slot = GEAR[id].slot;
  if (slot === 'head') o.rotation.set(.32, -.62, 0);
  else if (slot === 'body') o.rotation.set(.14, -.5, 0);
  else if (slot === 'feet') o.rotation.set(.2, -.75, 0);
  else if (slot === 'shield') o.rotation.set(.25, PI / 2 - .35, 0, 'YXZ'); // face on, a little turned (as shieldIcon)
  else if (slot === 'back') { o.rotation.set(.3, PI - .35, 0); o.position.y = -.4; o.traverse((w) => { if (w.userData.wing) { w.rotation.y = w.userData.wing * .25; w.rotation.z = w.userData.wing * .2; } }); } // seen from behind, spread
  else { o.rotation.set(.12, -.2, 0); o.position.y = -.3; }
  return renderIcon(grp, -Infinity, 1.08);
}
function shieldIcon(kind) {
  const o = makeShield(kind), grp = new THREE.Group(); grp.add(o);
  o.rotation.set(.25, PI / 2 - .35, 0, 'YXZ');
  return renderIcon(grp, -Infinity, 1.06);
}
function fallbackIcon(id) {
  const d = new Px(); d.disk(12, 12, 9, '#6a5a48'); d.disk(12, 12, 7, '#a89878'); d.outline();
  d.x.fillStyle = '#1a120c'; d.x.font = 'bold 11px monospace'; d.x.textAlign = 'center'; d.x.fillText((id || '?')[0].toUpperCase(), 12, 16); d.hard();
  const out = document.createElement('canvas'); out.width = out.height = ICON; const o = out.getContext('2d', { willReadFrequently: true }); o.imageSmoothingEnabled = false; o.drawImage(d.c, 0, 0, ICON, ICON);
  return out.toDataURL('image/png');
}
function makeIcon(id) {
  const t0 = performance.now();
  try { return makeIcon0(id); } finally { if (!SKILLS[id] && !/^skill_/.test(id)) { iconPerf.n++; iconPerf.ms += performance.now() - t0; } }
}
function makeIcon0(id) {
  try {
    if (typeof id === 'string' && !WEAPONS[id] && !GEAR[id] && !ITEMS[id] && !SKILLS[id]) itemOf(id); // round 33: a catalog id registers itself first
    if (EXTRA_ICONS[id]) return EXTRA_ICONS[id]();
    if (SKILLS[id]) return skillIcon(id);
    if (WEAPONS[id]) return weaponIcon(id);
    if (ITEMS[id]) return itemIcon(id);
    if (GEAR[id]?.iconURL) return GEAR[id].iconURL() || fallbackIcon(id); // (round 30: V's dresses, drawn flat)
    if (GEAR[id]) return gearIcon(id);
    if (/^shield_(round|crescent|shell)$/.test(id)) return shieldIcon(id.slice(7));
    return fallbackIcon(id);
  } catch (e) { console.warn('iconFor', id, e); return fallbackIcon(id); }
}
// icons are rendered a few per frame (a full inventory is ~70 renders + PNG encodes); callers show a sprite meanwhile
const iconCache = new Map(), iconQ = [];
let iconPump = 0;
// Roy 27.10 (stutters): at the start every skill's icon is queued (main.js skillIcons), a few hundred PNG encodes; the
// pump used to take 12 ms slices back to back, which ate whole frames for the first seconds of play. Now it works in the
// browser's idle time between frames (a few ms at most, never past the next frame), and only nudges on (2 ms) when no
// idle time has come for a while
// an icon painted on a canvas (the skill catalog's tiles) is encoded by the browser off the main thread (toBlob) and shown
// through a blob: URL; one already a data URL is passed on as it is
const done = (v, res) => { if (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement) { if (v.toBlob) v.toBlob((b) => res(b ? URL.createObjectURL(b) : v.toDataURL('image/png')), 'image/png'); else res(v.toDataURL('image/png')); } else res(v); };
const idle = typeof requestIdleCallback === 'function' ? (f) => requestIdleCallback(f, { timeout: 250 }) : (f) => setTimeout(f, 16);
function pumpIcons(dl) {
  if (!iconQ.length) { iconPump = 0; return; }
  const t0 = performance.now(), budget = dl && !dl.didTimeout ? Math.min(8, dl.timeRemaining()) : 2;
  do { const [id, res] = iconQ.shift(); done(makeIcon(id), res); } while (iconQ.length && performance.now() - t0 < budget);
  iconPump = iconQ.length ? idle(pumpIcons) : 0;
}
export function iconFor(id) {
  if (typeof id === 'string' && /^(set|sa)_.*@\d+/.test(id)) id = id.replace(/@\d+/, ''); // round 33: an item level does not change the look
  if (iconCache.has(id)) return iconCache.get(id);
  if (id === 'drachma') { const pr = fitURL(EXTRA_ICONS.drachma()); iconCache.set(id, pr); return pr; } // (Roy 30.10: a drawn picture, ready at once, not queued behind the renders)
  const pr = new Promise((res) => { iconQ[SKILLS[id] || /^skill_\d{3}$/.test(id) ? 'unshift' : 'push']([id, res]); if (!iconPump) iconPump = idle(pumpIcons); }); // skill tiles are cheap 2D and sit on the HUD: they jump the queue (v31: the Path of Ascent's not-yet-taught ones too)
  iconCache.set(id, pr);
  return pr;
}

// ---------------------------------------------------------------------------------------------
// Round 33 (Roy's MASTER spec): the 17-set catalog (catalog.js) REPLACES the round 1-31 sets, named weapons and forged
// patterns. Those stay defined (old saves, quests and scenes still name their ids, and migrateId turns each into the closest
// new item), but leave the enumerable tables, so every list (drops, shops, the MAX code, viewers) sees the catalog. The
// story's own keepsakes stay listed: the village spear, Philon's sword, the Keres' scythe, the tide trident, V's
// sun-and-moon shield, Poseidon's scallop and her two dresses (and BETA ONLINE's two other creation outfits, Roy 29.10).
// ---------------------------------------------------------------------------------------------
export const HEIRLOOM_IDS = ['village_spear', 'village_blade', 'keres_scythe', 'tide_trident', 'shield_crescent', 'shield_shell', 'val_dress', 'battle_dress', 'leather_chiton', 'dark_chiton'];
for (const T of [WEAPONS, GEAR]) for (const id of Object.keys(T)) {
  if (HEIRLOOM_IDS.includes(id)) continue;
  const v = T[id]; v.legacy = true;
  Object.defineProperty(T, id, { value: v, enumerable: false, configurable: true, writable: true });
}
CATALOG.legacy = (id) => (/^(set|sa)_/.test(id) ? null : forgedWeapon(id) || itemOf(id));
GEAR_BONUS_NAMES.atkSpeed = { he: 'מהירות התקפה', en: 'Attack speed' };
// the modelling kit, for the catalog's procedural models (gearkit.js): the same primitives, materials and pixel dressing as
// every weapon and piece of gear above, and the tables a model registers itself in
export const KIT = {
  THREE, box, tcyl, ball, cone, pivot, mat, M, flat, rod, band, seg, chain, sym, mirrorX, inset, noOL, px, blade, plate, arc, P, grip, cyl0, crystal, glass, glowPlate,
  petalPts, featherPts, featherWing, wingRig, torusGeo, cap, capGeo, plume, CREST, cheekGuards, CUI, cuiR, cuirass, cuiBand, onCui, belt, epomides, pauldrons, pteruges,
  bootPair, bootFoot, shinR, shin, shinBand, ellPts, crescentPts, fig8Pts, mixHex, tintTree, glowTree, flower, cached, flatGeo,
  BUILD, GEAR_BUILD, SHIELD_BUILD, PXFAM, PXACC, HP, PI, ITEM_MODELS, ITEM_BUILD, leafAt,
};
export const ICON_PASSES = { inkFigure, inkBold, inkMaple, inkSprite }; // (Roy 30.10's icon options: for timing the pixel passes, tests)
