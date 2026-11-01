// Round 33 (Roy's MASTER spec, sections 4-13, 25-28): THE EQUIPMENT CATALOG. One central, data-driven source for every
// set, standalone item, weapon category, weapon family, rarity and the stat pipeline. The UI builds tooltips and filters
// on itemInfo() / setStatus(); the game (rpg.js Hero) reads the same numbers through heroEquip(), so a tooltip can never
// disagree with a blow.
//
// ITEM IDS (stable, saved as they are):
//   set_<setId>_<cat>          a set piece:   set_sparta_helmet, set_sparta_sword1, set_chaos_apeiron ...
//   sa_<key>                   a standalone item (setId null): sa_last_argive ...
//   <base>@<L>                 the same identity found at item level L (inside the base's level window, see levelWindow)
//   ...^e / ...^l              EPIC / LEGENDARY (no suffix: NORMAL)
// e.g. set_argive_sword1@37^e = an EPIC Argive Bronze sword of item level 37 (required level 37).
// Old saves' items (round 1-31 sets, forged drops, named weapons) are migrated by migrateId() to the closest new item of the
// same slot / category and level, keeping their rarity. The story's own keepsakes (Philon's sword, the village spear, the
// Keres' scythe, the tide trident, V's sun-and-moon shield, Poseidon's scallop, her two dresses) stay what they are.
//
// STAT PIPELINE (itemStats, then heroEquip): 1 base stats of the category -> 2 item-level scaling -> 3 rarity multipliers
// (exactly once) -> 4 grip (two-handed mastery 85%) -> 5 sum of the worn pieces -> 6 set packages and family statics ->
// 7 temporary effects (Hero.temp, the passives' runtime) -> 8 caps.
// Units: weapon power = damage of one blow (the game's hit damage); armour power = a fraction added to V's power
// multiplier; atkSpeed = a fraction added to the attack rate; crit = a fraction of chance (0.05 = 5 percentage points);
// defense = a fraction of every blow stopped (the game's guard); hp = flat max health; move = a fraction added to move speed.
import { WEAPONS, GEAR, CATALOG, GEAR_BAL, CRIT_BASE, tierOf } from './weapons.js';
import { lvlGrowth, weaponDmgRef, MAX_LEVEL } from './progress.js';
import { CAPE_TEXT } from './i18n.js';

const L = (he, en) => ({ he, en });
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const clampL = (n) => Math.max(1, Math.min(MAX_LEVEL, Math.round(n)));
const maxHpAt = (lv) => 100 + (lv - 1) * 18; // (pacing.js heroStats)

// ------------------------------------------------------------------ rarities (spec 7)
export const RARITIES = ['normal', 'epic', 'legendary'];
export const RARITY_MULT = {
  normal: { power: 1, atkSpeed: 1, crit: 1 },
  epic: { power: 1.35, atkSpeed: 1.15, crit: 1.10 },
  legendary: { power: 1.90, atkSpeed: 1.45, crit: 1.35 },
};
export const RARITY_NAME = { normal: L('רגיל', 'Normal'), epic: L('אפי', 'Epic'), legendary: L('אגדי', 'Legendary') };
const SUFFIX = ['', '^e', '^l'], OLD_RARITY = ['common', 'epic', 'legendary']; // (the game's colour keys: weapons.js RARITY)

// ------------------------------------------------------------------ slots and weapon categories (spec 4)
export const ARMOR_SLOTS = ['helmet', 'body', 'boots', 'wings'];
export const WEAPON_TYPES = ['shield', 'sword1', 'axe1', 'sword2', 'axe2', 'spear2', 'dualSword', 'dualAxe'];
export const HERO_SLOT = { helmet: 'head', body: 'body', boots: 'feet', wings: 'back', shield: 'shield' }; // the hero's gear keys (rpg.js); weapons go in hero.weapon
export const SLOT_OF_HERO = { head: 'helmet', body: 'body', feet: 'boots', back: 'wings', shield: 'shield' };
export const UNLOCK = { shield: 1, sword1: 1, axe1: 5, sword2: 10, axe2: 20, spear2: 30, dualSword: 40, dualAxe: 50 };
export const MASTERY_LEVEL = 100, MASTERY_DMG = .85; // spec 4.2: a two-hander in one hand with a shield, at 85% weapon damage
// tempo: swings a second relative to a sword; dps: damage per second relative to a sword (hit = ref x dps / tempo);
// as / cr: the weapon's own attack-speed and crit contributions at item level 1; cleave: foes one swing can land on
export const CATS = {
  shield: { hands: 'off', style: null, name: L('מגן', 'Shield'), nameHe: 'מגן', def: .22, hp: .2, block: true },
  sword1: { hands: 1, style: 'blade', name: L('חרב ליד אחת', 'One-handed sword'), nameHe: 'חרב', tempo: 1.0, reach: 2.3, dps: 1.0, as: .08, cr: .05, cleave: 2 },
  axe1: { hands: 1, style: 'blade', name: L('גרזן ליד אחת', 'One-handed axe'), nameHe: 'גרזן', tempo: .85, reach: 2.2, dps: 1.04, as: .05, cr: .04, cleave: 2 },
  sword2: { hands: 2, style: 'twohand', mastery: 'blade', name: L('חרב דו־ידנית', 'Two-handed sword'), nameHe: 'חרב־ענק', tempo: .72, reach: 2.9, dps: 1.1, as: .06, cr: .05, cleave: 3 },
  axe2: { hands: 2, style: 'twohand', mastery: 'blade', name: L('גרזן דו־ידני', 'Two-handed axe'), nameHe: 'גרזן־ענק', tempo: .62, reach: 2.8, dps: 1.14, as: .04, cr: .04, cleave: 3 },
  spear2: { hands: 2, style: 'polearm', mastery: 'spear', name: L('חנית דו־ידנית', 'Two-handed spear'), nameHe: 'חנית', tempo: .82, reach: 3.6, dps: 1.05, as: .07, cr: .06, cleave: 3 },
  dualSword: { hands: 'pair', style: 'dual', name: L('זוג חרבות', 'Dual swords'), nameHe: 'צמד חרבות', tempo: 1.7, reach: 2.05, dps: 1.1, as: .10, cr: .08, cleave: 2 },
  dualAxe: { hands: 'pair', style: 'dual', name: L('זוג גרזנים', 'Dual axes'), nameHe: 'צמד גרזינים', tempo: 1.45, reach: 2.1, dps: 1.15, as: .07, cr: .06, cleave: 2 },
  helmet: { armor: true, name: L('קסדה', 'Helmet'), nameHe: 'קסדת', def: .22, hp: .2, power: .5, crit: .012 },
  body: { armor: true, name: L('שריון גוף מלא', 'Full-body armor'), nameHe: 'שריון', def: .36, hp: .3 },
  boots: { armor: true, name: L('מגפיים', 'Boots'), nameHe: 'מגפי', def: .14, hp: .14, move: .8, as: .02 },
  wings: { armor: true, name: L('כנפיים', 'Wings'), nameHe: 'כנפי', def: .06, move: .6, as: .03, crit: .01, power: .3 },
};
export const isWeaponType = (c) => c !== 'shield' && !!CATS[c]?.style;
const CAT_EN = { helmet: 'Helmet', body: 'Full-Body Armor', boots: 'Boots', wings: 'Wings', shield: 'Shield', sword1: 'Sword', axe1: 'Axe', sword2: 'Greatsword', axe2: 'Great Axe', spear2: 'Spear', dualSword: 'Twin Swords', dualAxe: 'Twin Axes' };
// how a weapon is held (tooltips, spec 17)
export const HANDLING = {
  shield: L('יד שמאל: מגן לצד חרב או גרזן ליד אחת (ומרמה 100 גם לצד נשק דו־ידני). החזיקי חסימה כדי לעצור מכות.', 'Off-hand: a shield beside a one-handed sword or axe (from level 100 also beside a two-handed weapon). Hold block to stop blows.'),
  sword1: L('ליד אחת. אפשר לשאת מגן ביד השנייה.', 'One-handed. A shield can go in the other hand.'),
  axe1: L('ליד אחת: מכות כבדות ואיטיות יותר מחרב. אפשר לשאת מגן ביד השנייה.', 'One-handed: heavier, slower blows than a sword. A shield can go in the other hand.'),
  sword2: L('דו־ידנית: תופסת את שתי הידיים. שליטה בנשק כבד (רמה 100): ביד אחת עם מגן, ב־85% מנזק הנשק.', 'Two-handed: takes both hands. Heavy-weapon mastery (level 100): one-handed with a shield, at 85% weapon damage.'),
  axe2: L('דו־ידני: תופס את שתי הידיים, מכות עצומות שמטלטלות. שליטה בנשק כבד (רמה 100): ביד אחת עם מגן, ב־85% מנזק הנשק.', 'Two-handed: takes both hands, huge staggering blows. Heavy-weapon mastery (level 100): one-handed with a shield, at 85% weapon damage.'),
  spear2: L('דו־ידנית: תופסת את שתי הידיים, טווח ארוך ודקירות. שליטה בנשק כבד (רמה 100): ביד אחת עם מגן, ב־85% מנזק הנשק.', 'Two-handed: takes both hands, long reach and thrusts. Heavy-weapon mastery (level 100): one-handed with a shield, at 85% weapon damage.'),
  dualSword: L('זוג תואם: חרב בכל יד, פריט אחד שתופס את שתי הידיים. בלי מגן.', 'A matched pair: a sword in each hand, one item that takes both hands. No shield.'),
  dualAxe: L('זוג תואם: גרזן בכל יד, פריט אחד שתופס את שתי הידיים. בלי מגן.', 'A matched pair: an axe in each hand, one item that takes both hands. No shield.'),
};

// ------------------------------------------------------------------ level scaling (spec 8.1)
// Power follows the game's own ladder (progress.js lvlGrowth: 7% a level to 100, then 1.5%), because every monster's hit
// points are built on it: the spec's 1 + 0.025 (L-1) fallback would leave a level-100 weapon at 1/230 of a level-100
// monster's hide. The secondary stats use the spec's restrained factors as given. Defense and health use the round-28
// armour balance (weapons.js GEAR_BAL), calibrated against V's own growth.
export const LEVEL_SCALE = {
  power: (lv) => lvlGrowth(lv),
  atkSpeed: (lv) => 1 + .0005 * (lv - 1),
  crit: (lv) => 1 + .001 * (lv - 1),
  spec: (lv) => 1 + .025 * (lv - 1), // the spec's fallback, kept for reference (setPackage uses the spec's own set formulas)
};
// ------------------------------------------------------------------ cadence (the dual-wield addendum, sections 2 and 6)
// A weapon's Power is the damage of one blow of weight 1. What she deals each second is Power x (the move weights a
// combo lands) / (the real time the combo takes), and that time is not just 1/speed: the finisher plays out in full and
// then a fixed .25 s pause (entities.js) that attack speed does not shorten, each move chains only after its last hit
// + .12 of its length, and every blow that lands holds the game at .16 speed for .05 s (.075 heavy, .085 a finisher:
// main.js hitstop), so a style of many small hits pays more of that. STYLE_T copies entities.js STYLE's timing per
// step: [length, fraction of its last hit, the weights of its hits, each hit's hit-stop seconds], so the catalog sizes
// each category's blow from the cadence it really has. Keep it in step with entities.js STYLE and main.js hitstop;
// tests/items_test.mjs drives the real engine and catches a drift.
// v31 T5 (Roy 23.10: "slow all the weapons by 30%, every NORMAL ATTACK with every weapon feels too fast"): ATK_SLOW
// stretches every normal combo move (entities.js startMove: its length, so the pose and the hit frames stay together)
// and the finisher's pause by 1.3; the model below counts the same stretch (the hit-stops are per blow and stay)
export const ATK_SLOW = 1.3;
export const STYLE_T = {
  blade: [[.25, .3, 1, [.05]], [.25, .3, 1.05, [.05]], [.5, .6, .55 + 1.35, [.085, .085]]],
  twohand: [[.42, .42, 1.25, [.075]], [.42, .42, 1.25, [.075]], [.62, .52, 2.1, [.085]]],
  polearm: [[.3, .38, 1, [.05]], [.3, .38, 1.05, [.05]], [.6, .5, 1.5, [.085]]],
  spear: [[.26, .4, 1, [.05]], [.26, .4, 1, [.05]], [.46, .5, 1.55, [.085]]],
  dual: [[.42, .78, 1.2, [.05, .05]], [.48, .75, 1.35, [.05, .05, .05]], [.5, .5, 1.35, [.085]]],
};
// FRAME: the reference frame (60 a second). A hit-stop runs whole frames (main.js counts it down by each frame's dt: a
// .05 s stop is 4 frames at 60 Hz), and the finisher's pause ends on a frame too, so the timing is counted in frames
export const FINISH_PAUSE = .25 * ATK_SLOW, CHAIN_PAD = .12, STOP_KEEP = .16, FRAME = 1 / 60;
const stopWall = (s) => (Math.floor(s / FRAME + 1e-6) + 1) * FRAME * (1 - STOP_KEEP);
// wall-clock seconds one whole combo takes when she keeps attacking, at weapon speed sp
export const comboTime = (style, sp) => { const T = STYLE_T[style] || STYLE_T.blade; return T.reduce((t, [d, last, , stops], i) => t + (i < T.length - 1 ? d * (last + CHAIN_PAD) : d) * ATK_SLOW / sp + stops.reduce((u, x) => u + stopWall(x), 0), 0) + FINISH_PAUSE + FRAME; };
// move weight landed per second (x Power = damage per second before crits and her power)
export const styleRate = (style, sp) => (STYLE_T[style] || STYLE_T.blade).reduce((m, x) => m + x[2], 0) / comboTime(style, sp);
export const hitsPerSec = (style, sp) => (STYLE_T[style] || STYLE_T.blade).reduce((m, x) => m + x[3].length, 0) / comboTime(style, sp);
const RB = styleRate('blade', 1); // a one-handed sword at speed 1: the yardstick (its blow is the reference damage)
// a category's blow: its dps factor is a true damage-per-second factor against that yardstick
export const blowOf = (C) => C.dps * RB / styleRate(C.style, C.tempo);
// the pair edge (addendum 2): a matched pair's sustained damage over the matching mastered two-hander held with a shield,
// with every hit timing, recovery, attack speed and crit expectation counted, at level 100 NORMAL (rarity then moves both
// loadouts alike). The pairs' dps factors are derived from it here, in one place, not set by hand.
export const DUAL_EDGE = { dualSword: { vs: 'sword2', edge: 1.175 }, dualAxe: { vs: 'axe2', edge: 1.125 } };
export const critExp = (cr) => 1 + .75 * (CRIT_BASE + cr);
export function sustained(cat, lvl = 100, stance) { // expected damage per second of a category's NORMAL blow at its level (x her power), tooltip maths
  const C = CATS[cat], asF = LEVEL_SCALE.atkSpeed(lvl), crF = LEVEL_SCALE.crit(lvl), m = stance === 'mastery' && C.mastery;
  return blowOf(C) * (m ? MASTERY_DMG : 1) * styleRate(m ? C.mastery : C.style, C.tempo * (1 + C.as * asF)) * critExp(C.cr * crF);
}
for (const [d, { vs, edge }] of Object.entries(DUAL_EDGE)) {
  const D = CATS[d]; D.dps = 1; const one = sustained(d);
  D.dps = r4(edge * sustained(vs, 100, 'mastery') / one);
}
const ARMOR_POWER = (lv) => .03 + .0011 * lv, MOVE = (lv) => .04 + .0006 * lv;

// ------------------------------------------------------------------ the 17 sets (spec 5, 9, 12, 13)
// pal: m main material, mL light, mD dark, a accent, aL accent light, c cloth, l leather, g glow; trail: swing colours;
// prof: the set package's emphasis (power / atkSpeed / crit / defense, x the spec's reference); tilt: the pieces' own lean
const S = (o) => o;
export const SETS = [
  S({ id: 'hunt', lvl: 1, name: L('עור הציד', 'Hide of the Hunt'), family: 'hunter', motif: 'hide',
    theme: L('עור גס, פרוות חיה וציוד ציד פשוט.', 'Rough leather, animal hide and simple hunting gear.'), mat: L('עור גס ועצם', 'rough hide and bone'),
    pal: { m: '#8a6040', mL: '#c09060', mD: '#4e3220', a: '#e6dfcc', aL: '#fff6e4', c: '#6e4a2c', l: '#3a2618', g: '#f0c070' }, trail: ['#f0e0c0', '#a07850'],
    prof: { power: 1.2, atkSpeed: 1, crit: .9, defense: .9 }, tilt: { atkSpeed: 1.05 } }),
  S({ id: 'cyclops', lvl: 15, name: L('אבן הקיקלופים', 'Cyclopean Stone'), family: 'cyclopean', motif: 'stone',
    theme: L('סלע מסותת ולוחות אבן, מלאכת יד של קיקלופים.', 'Carved rock and stone plates of cyclopean craftsmanship.'), mat: L('אבן מסותתת וחישוקי ארד', 'carved stone and bronze bands'),
    pal: { m: '#8f877a', mL: '#bab2a4', mD: '#5e584e', a: '#c08436', aL: '#f4cc7c', c: '#5a4a3a', l: '#3a2a20', g: '#ff7a3a' }, trail: ['#e0d8c8', '#8a8070'],
    prof: { power: 1.1, atkSpeed: .6, crit: .7, defense: 1.6 }, tilt: { power: 1.04, atkSpeed: .9, defense: 1.06 } }),
  S({ id: 'argive', lvl: 30, name: L('ארד ארגוס', 'Argive Bronze'), family: 'argive', motif: 'bronze',
    theme: L('ארד קלאסי, חריטות יווניות ומראה של לוחם עתיק.', 'Classical bronze, Greek engravings, the ancient warrior.'), mat: L('ארד מחושל עם מפתח יווני', 'hammered bronze with a Greek key'),
    pal: { m: '#c08436', mL: '#f4cc7c', mD: '#8a5a24', a: '#a82a24', aL: '#e8484a', c: '#7a1a14', l: '#3a2618', g: '#ffe490' }, trail: ['#ffe4a0', '#c08436'],
    prof: { power: 1, atkSpeed: 1, crit: 1, defense: 1 }, tilt: {} }),
  S({ id: 'sparta', lvl: 45, name: L('ברזל ספרטני', 'Spartan Iron'), family: 'spartan', motif: 'lambda',
    theme: L('ברזל כהה, בד ארגמן ועיצוב צבאי מחמיר.', 'Dark iron, crimson cloth, austere military design.'), mat: L('ברזל כהה ובד ארגמן', 'dark iron and crimson cloth'),
    pal: { m: '#4a4852', mL: '#8a8a96', mD: '#2a2830', a: '#a8201c', aL: '#e04a3a', c: '#8a1a18', l: '#2a1a14', g: '#ff6a4a' }, trail: ['#e0e0ec', '#a8201c'],
    prof: { power: 1.4, atkSpeed: .7, crit: .9, defense: 1 }, tilt: { power: 1.05, atkSpeed: .9 } }),
  S({ id: 'dawn', lvl: 60, name: L('השחר הראשון', 'First Dawn'), family: 'dawn', motif: 'sunrise',
    theme: L('זהב חם ומוטיבים של שמש עולה, באור מאופק.', 'Warm gold, early solar motifs, restrained radiance.'), mat: L('זהב חם ושמש עולה', 'warm gold and the rising sun'),
    pal: { m: '#e0b040', mL: '#ffe490', mD: '#a8781e', a: '#fff1c8', aL: '#ffffff', c: '#f0d8a0', l: '#7a4a1e', g: '#fff2a8' }, trail: ['#fff6c8', '#ffb22e'],
    prof: { power: 1.2, atkSpeed: 1.1, crit: 1, defense: .7 }, tilt: {} }),
  S({ id: 'delphi', lvl: 70, name: L('נחשי דלפי', 'Delphic Serpents'), family: 'serpent', motif: 'serpent',
    theme: L('קשקשי אזמרגד, מוטיבים של נחשים ופרטים ארסיים.', 'Emerald scales, snake motifs, venomous details.'), mat: L('קשקשי אזמרגד וזהב', 'emerald scales and gold'),
    pal: { m: '#2f8a5e', mL: '#5ac88a', mD: '#1d5a3c', a: '#d8b04a', aL: '#ffe490', c: '#1a4a32', l: '#2a3a20', g: '#8dff5a' }, trail: ['#d0ffb8', '#3ac06a'],
    prof: { power: 1, atkSpeed: 1.3, crit: 1.1, defense: .6 }, tilt: { atkSpeed: 1.08 } }),
  S({ id: 'olympian', lvl: 90, name: L('משמר האולימפוס', 'Olympian Guard'), family: 'olympian', motif: 'marble',
    theme: L('שיש לבן, עיטורי זהב ואומנות אלוהית.', 'White marble, gold ornament, divine craftsmanship.'), mat: L('שיש לבן וזהב', 'white marble and gold'),
    pal: { m: '#ecebe4', mL: '#ffffff', mD: '#b8b6ac', a: '#e8b840', aL: '#ffe490', c: '#f4f0e6', l: '#8a7a5a', g: '#fff1b0' }, trail: ['#ffffff', '#e8b840'],
    prof: { power: .8, atkSpeed: .8, crit: .9, defense: 1.5 }, tilt: { defense: 1.06 } }),
  S({ id: 'tide', lvl: 110, name: L('גאות פוסידון', "Poseidon's Tide"), family: 'sea', motif: 'wave',
    theme: L('מתכות בכחול האוקיינוס, אלמוגים, גלים ומוטיבים של ים.', 'Ocean-blue metals, coral, waves and the sea.'), mat: L('מתכת כחולת ים ואלמוג', 'sea-blue metal and coral'),
    pal: { m: '#2f7fae', mL: '#7ad8f0', mD: '#1d4a6e', a: '#ff8a6a', aL: '#ffc0a8', c: '#1d5a7a', l: '#1a3a4a', g: '#8fffe0' }, trail: ['#c8faff', '#2fb8d8'],
    prof: { power: 1, atkSpeed: 1, crit: .8, defense: 1.2 }, tilt: {} }),
  S({ id: 'artemis', lvl: 130, name: L('הציד של ארטמיס', "Artemis' Hunt"), family: 'artemis', motif: 'moon',
    theme: L('כסף, אור ירח, חומרי יער ומוטיבים של ציד.', 'Silver, moonlight, forest materials and hunting motifs.'), mat: L('כסף לאור הירח ועלי יער', 'moonlit silver and forest leaves'),
    pal: { m: '#cfd6e0', mL: '#f4f8ff', mD: '#8a94a8', a: '#5a8a4a', aL: '#9ac87a', c: '#2e4a32', l: '#3a3020', g: '#d8ecff' }, trail: ['#f4f8ff', '#9ab8e8'],
    prof: { power: 1, atkSpeed: 1.1, crit: 1.6, defense: .5 }, tilt: { crit: 1.15 } }),
  S({ id: 'helios', lvl: 150, wings: true, name: L('להבת הליוס', "Helios' Flame"), family: 'helios', motif: 'flame',
    theme: L('זהב שמש, מתכת לבנה זוהרת ואור בוער.', 'Solar gold, radiant white metal and burning light.'), mat: L('זהב שמש ומתכת לבנה בוערת', 'solar gold and burning white metal'),
    pal: { m: '#f0c040', mL: '#fff4b0', mD: '#b07a1a', a: '#fffaf0', aL: '#ffffff', c: '#ff9a2a', l: '#7a3a10', g: '#ffd24a' }, trail: ['#fff4c0', '#ff8a1a'],
    prof: { power: 1.3, atkSpeed: 1, crit: 1, defense: .7 }, tilt: { power: 1.03 } }),
  S({ id: 'styx', lvl: 165, wings: true, name: L('צללי הסטיקס', 'Shadows of Styx'), family: 'styx', motif: 'mist',
    theme: L('חומרים רפאיים כהים, ערפל הנהר ואנרגיה של השאול.', 'Spectral dark materials, river mist and underworld energy.'), mat: L('מתכת רפאים וערפל הנהר', 'spectral metal and river mist'),
    pal: { m: '#2a2838', mL: '#5a5a7a', mD: '#14121c', a: '#7af0dc', aL: '#c8fff4', c: '#3a3a50', l: '#1a1820', g: '#9fffe8' }, trail: ['#c8fff4', '#4a4a7a'],
    prof: { power: 1, atkSpeed: 1.2, crit: 1.2, defense: .6 }, tilt: { atkSpeed: 1.05 } }),
  S({ id: 'titans', lvl: 180, wings: true, name: L('שלשלאות הטיטאנים', 'Chains of the Titans'), family: 'titan', motif: 'chains',
    theme: L('שריון כבד וכהה, מתכת קדמונית, סדקים מותכים ושלשלאות.', 'Massive dark armour, primordial metal, molten fractures and chains.'), mat: L('מתכת קדמונית, שלשלאות וסדקים מותכים', 'primordial metal, chains and molten cracks'),
    pal: { m: '#3a3236', mL: '#6e6264', mD: '#1e1a1c', a: '#ff5a1a', aL: '#ffb040', c: '#4a3a30', l: '#2a1e18', g: '#ffb040' }, trail: ['#ffc060', '#5a3a2a'],
    prof: { power: 1.4, atkSpeed: .6, crit: .6, defense: 1.4 }, tilt: { power: 1.06, atkSpeed: .88, defense: 1.08 } }),
  S({ id: 'athena', lvl: 200, wings: true, name: L('האגיס של אתנה', 'Aegis of Athena'), family: 'athena', motif: 'owl',
    theme: L('ארד וזהב מעודנים, מוטיבים של ינשוף והגנה גאומטרית.', 'Refined bronze and gold, owl motifs, geometric protection.'), mat: L('ארד מעודן וזהב, ינשוף ומפתח', 'refined bronze and gold, owl and key'),
    pal: { m: '#c89a4a', mL: '#ffe0a0', mD: '#8a6428', a: '#3a5a9a', aL: '#7a9ae0', c: '#2a4a8a', l: '#4a3018', g: '#e8f0ff' }, trail: ['#fff4d0', '#5a8ad8'],
    prof: { power: 1, atkSpeed: 1, crit: 1, defense: 1.2 }, tilt: {} }),
  S({ id: 'zeus', lvl: 210, wings: true, name: L('סערת זאוס', "Zeus' Tempest"), family: 'zeus', motif: 'bolt',
    theme: L('כסף שחושל בסערה, כחול חשמלי וברקים.', 'Storm-forged silver, electric blue and lightning.'), mat: L('כסף סערה וברקים כחולים', 'storm silver and blue lightning'),
    pal: { m: '#c8d4e8', mL: '#ffffff', mD: '#7a8aa8', a: '#3a8aff', aL: '#9fd0ff', c: '#2a3a6a', l: '#20283a', g: '#bfe6ff' }, trail: ['#ffffff', '#5ab0ff'],
    prof: { power: 1.1, atkSpeed: 1.4, crit: 1, defense: .5 }, tilt: { atkSpeed: 1.08 } }),
  S({ id: 'nemesis', lvl: 230, wings: true, name: L('משפט נמסיס', "Nemesis' Judgment"), family: 'nemesis', motif: 'scales',
    theme: L('שריון טקסי כהה, שחור וארגמן, מאזניים וגמול.', 'Dark ceremonial armour, black and crimson, scales and retribution.'), mat: L('שחור טקסי וארגמן', 'ceremonial black and crimson'),
    pal: { m: '#1e1a20', mL: '#4a424c', mD: '#0e0c10', a: '#b01a2a', aL: '#ff4a5a', c: '#5a0a14', l: '#140e10', g: '#ff4a5a' }, trail: ['#ffd0d4', '#b01a2a'],
    prof: { power: 1.2, atkSpeed: .8, crit: 1, defense: 1 }, tilt: {} }),
  S({ id: 'tartarus', lvl: 250, wings: true, name: L('כתר הטרטרוס', 'Crown of Tartarus'), family: 'tartarus', motif: 'abyss',
    theme: L('סגול תהומי, מתכת תופת, תהומות ואנרגיה של השאול.', 'Abyssal purple, infernal metal, chasms and underworld energy.'), mat: L('מתכת תופת סגולה ולהבות התהום', 'infernal purple metal and abyssal flame'),
    pal: { m: '#3a1a4a', mL: '#7a4a9a', mD: '#1e0c28', a: '#ff6a1a', aL: '#ffb060', c: '#2a0a3a', l: '#1a0a14', g: '#c84aff' }, trail: ['#e8a0ff', '#7a1aa8'],
    prof: { power: 1.3, atkSpeed: .9, crit: 1.1, defense: .7 }, tilt: { power: 1.03 } }),
  S({ id: 'chaos', lvl: 300, wings: true, name: L('כאוס', 'Chaos'), family: 'chaos', motif: 'void', quality: 1.12,
    theme: L('עיוות קדמון, מציאות שבורה, גאומטריה בלתי אפשרית והרס קוסמי.', 'Primordial distortion, fractured reality, impossible geometry and cosmic destruction.'), mat: L('ריק קדמון, שברי מציאות וסדקים ארגמניים', 'primordial void, shards of reality and crimson seams'),
    pal: { m: '#140c1a', mL: '#3a2a4a', mD: '#05030a', a: '#ff2a4a', aL: '#ff8a9a', c: '#2a1438', l: '#0a0610', g: '#9a4aff' }, trail: ['#c89aff', '#ff2a4a'],
    prof: { power: 1.3, atkSpeed: 1.2, crit: 1.2, defense: 1.1 }, tilt: {} }),
];
export const SET_BY = Object.fromEntries(SETS.map((s, i) => [s.id, Object.assign(s, { index: i })]));
// the categories a set carries: what is unlocked at its own level (spec 5.1), wings from level 150
export const setCats = (s) => [...ARMOR_SLOTS.filter((k) => k !== 'wings' || s.wings), ...WEAPON_TYPES.filter((c) => UNLOCK[c] <= s.lvl)];
// spec 9.4: the full package at 100%, the reference formulas x the set's own emphasis
export function setPackage(s) {
  const lv = s.lvl, P = s.prof;
  return { power: r4((.05 + .0005 * lv) * P.power), atkSpeed: r4((.02 + .00025 * lv) * P.atkSpeed), crit: r4((1 + .01 * lv) / 100 * P.crit), defense: r4((.05 + .0005 * lv) * P.defense) };
}
export const setMax = (s) => (s.wings ? 6 : 5);
const PCT5 = [0, 0, .25, .5, .75, 1], PCT6 = [0, 0, .2, .4, .6, .8, 1];
export const setPct = (s, n) => (s.wings ? PCT6 : PCT5)[Math.max(0, Math.min(setMax(s), n | 0))];
export const setStage = (s, n) => Math.max(0, Math.min(setMax(s), n | 0) - 1); // 1 piece: none; 2: I; ... 6: V
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

// ------------------------------------------------------------------ set passives (spec 9.5, 12.3). Values by stage (index 0 = stage I)
// kind: the runtime handler in passives.js; icd: internal cooldown (s); boss: what changes against a boss
const pc = (v) => `${+(v * 100).toFixed(1)}%`;
export const SET_PASSIVES = {
  hunt: { name: L('ציד בלתי נלאה', 'Relentless Hunt'), kind: 'hunt', v: { per: [.01, .015, .02, .025], max: [4, 5, 6, 6] }, icd: 0,
    text: (s, v) => L(`כל מכה רצופה באותו אויב (תוך 3 ש׳) מוסיפה ${pc(v.per[s])} נזק נגדו, עד ${v.max[s]} פעמים.`, `Each consecutive hit on the same foe (within 3s) adds ${pc(v.per[s])} damage against it, up to ${v.max[s]} times.`) },
  cyclops: { name: L('בלתי מעורער', 'Unshakeable'), kind: 'poise', v: { resist: [.25, .45, .65, .85], dr: [.03, .04, .05, .06] }, icd: 0,
    text: (s, v) => L(`${pc(v.resist[s])} סיכוי שמכה כבדה לא תקטע את מכתך, ו־${pc(v.dr[s])} פחות נזק בזמן תקיפה.`, `${pc(v.resist[s])} chance a heavy blow does not break your swing, and ${pc(v.dr[s])} less damage taken while attacking.`) },
  argive: { name: L('משמעת הפלנקס', 'Phalanx Discipline'), kind: 'balance', v: { dmg: [.02, .03, .04, .05], dr: [.02, .03, .04, .05], every: [0, 0, 8, 6] }, icd: 0,
    text: (s, v) => L(`${pc(v.dmg[s])} נזק ו־${pc(v.dr[s])} פחות נזק שנספג.${v.every[s] ? ` כל מכה ${v.every[s]} היא מכה קטלנית.` : ''}`, `${pc(v.dmg[s])} damage and ${pc(v.dr[s])} less damage taken.${v.every[s] ? ` Every ${v.every[s]}th hit is a critical.` : ''}`) },
  sparta: { name: L('קשיחות ספרטנית', 'Spartan Rigor'), kind: 'rigor', v: { heavy: [.08, .12, .16, .2], sunder: [.03, .04, .05, .06] }, icd: 4,
    text: (s, v) => L(`מכות כבדות ומכות סיום: ${pc(v.heavy[s])} נזק, ושוברות שריון: האויב סופג ${pc(v.sunder[s])} יותר נזק ל־5 ש׳ (פעם ב־4 ש׳).`, `Heavy and finishing blows deal ${pc(v.heavy[s])} more and break armour: the foe takes ${pc(v.sunder[s])} more damage for 5s (once every 4s).`) },
  dawn: { name: L('האור הראשון', 'First Light'), kind: 'flare', v: { chance: [.12, .15, .18, .22], dmg: [.25, .35, .45, .6] }, icd: 2.5,
    text: (s, v) => L(`${pc(v.chance[s])} סיכוי (פעם ב־2.5 ש׳) להבקיע הבזק שחר: ${pc(v.dmg[s])} מנזק המכה לאויב ולסובבים אותו (עד 4).`, `${pc(v.chance[s])} chance (once every 2.5s) to burst a dawn flare: ${pc(v.dmg[s])} of the hit to the foe and those around it (up to 4).`) },
  delphi: { name: L('ארס הפיתיה', 'Pythian Venom'), kind: 'venom', v: { dps: [.06, .08, .1, .12], stacks: [2, 3, 4, 5] }, icd: .5,
    text: (s, v) => L(`מכות מטפטפות ארס: ${pc(v.dps[s])} מנזק המכה בשנייה למשך 4 ש׳, עד ${v.stacks[s]} שכבות.`, `Hits drip venom: ${pc(v.dps[s])} of the hit per second for 4s, stacking ${v.stacks[s]} times.`) },
  olympian: { name: L('מגן אלוהי', 'Divine Ward'), kind: 'ward', v: { absorb: [.3, .45, .6, .75], cd: [20, 18, 16, 14] }, icd: 0,
    text: (s, v) => L(`המכה הבאה שתספגי נבלעת ב־${pc(v.absorb[s])}. מתחדש כל ${v.cd[s]} ש׳.`, `The next blow you take is ${pc(v.absorb[s])} absorbed. Renews every ${v.cd[s]}s.`) },
  tide: { name: L('סחף', 'Undertow'), kind: 'wave', v: { chance: [.15, .2, .25, .3], slow: [.2, .25, .3, .35], dmg: [.2, .3, .4, .5] }, icd: 3,
    text: (s, v) => L(`${pc(v.chance[s])} סיכוי (פעם ב־3 ש׳) לגל: מאט ב־${pc(v.slow[s])} ל־2.5 ש׳ ופוגע ב־${pc(v.dmg[s])} מהמכה בעד 3 אויבים.`, `${pc(v.chance[s])} chance (once every 3s) of a wave: slows by ${pc(v.slow[s])} for 2.5s and hits up to 3 foes for ${pc(v.dmg[s])} of the hit.`) },
  artemis: { name: L('סימן הציידת', "Huntress' Mark"), kind: 'mark', v: { crit: [.04, .06, .08, .1], cdmg: [.1, .15, .2, .25] }, icd: 0,
    text: (s, v) => L(`המכה הראשונה מסמנת את הטרף ל־6 ש׳: נגדו ${pc(v.crit[s])} יותר סיכוי לקטלנית, וקטלניות חזקות ב־${pc(v.cdmg[s])}.`, `Your first hit marks the prey for 6s: +${pc(v.crit[s])} crit chance against it, and crits deal ${pc(v.cdmg[s])} more.`) },
  helios: { name: L('כתר השמש', 'Solar Crown'), kind: 'solar', v: { burn: [.08, .1, .12, .14, .16], every: [0, 0, 8, 6, 5], burst: [0, 0, .6, .8, 1] }, icd: 4,
    text: (s, v) => L(`מכות מציתות: ${pc(v.burn[s])} מנזק המכה בשנייה ל־3 ש׳.${v.every[s] ? ` כל מכה ${v.every[s]}: התפרצות שמש (${pc(v.burst[s])} מהמכה, רדיוס 2.5 מ׳, עד 5).` : ''}`, `Hits ignite: ${pc(v.burn[s])} of the hit per second for 3s.${v.every[s] ? ` Every ${v.every[s]}th hit: a solar burst (${pc(v.burst[s])} of the hit, 2.5 m, up to 5).` : ''}`) },
  styx: { name: L('המחיר של כארון', "Charon's Toll"), kind: 'toll', v: { leech: [.015, .02, .025, .03, .04], kill: [.02, .03, .04, .05, .06] }, icd: 3,
    text: (s, v) => L(`מרפאת ${pc(v.leech[s])} מהנזק שאת גורמת (עד 3% חיים בשנייה), והריגה משיבה ${pc(v.kill[s])} מהחיים (פעם ב־3 ש׳).`, `Heals ${pc(v.leech[s])} of damage dealt (at most 3% health a second); a kill restores ${pc(v.kill[s])} health (once every 3s).`) },
  titans: { name: L('כבלי הטיטאנים', "Titans' Shackles"), kind: 'shackle', v: { per: [.02, .02, .02, .02, .02], max: [3, 4, 5, 6, 7], stagger: [0, 0, 0, 1, 1] }, icd: 6,
    text: (s, v) => L(`כל מכה כובלת: האויב סופג 2% יותר נזק לכל כבל, עד ${v.max[s]} (6 ש׳; מול בוס חצי).${v.stagger[s] ? ' מכות כבדות מטלטלות אויבים רגילים (פעם ב־6 ש׳).' : ''}`, `Every hit shackles: the foe takes 2% more damage per shackle, up to ${v.max[s]} (6s; half against a boss).${v.stagger[s] ? ' Heavy blows stagger ordinary foes (once every 6s).' : ''}`) },
  athena: { name: L('תובנת האסטרטגית', "Strategist's Insight"), kind: 'insight', v: { mana: [1, 2, 3, 4, 5], chance: [.2, .25, .3, .35, .4], shave: [.4, .5, .6, .7, .8] }, icd: 2,
    text: (s, v) => L(`כל מכה משיבה ${v.mana[s]} מאנה, ו־${pc(v.chance[s])} סיכוי (פעם ב־2 ש׳) לקצר ${v.shave[s]} ש׳ מכל זמני ההמתנה.`, `Each hit restores ${v.mana[s]} mana, and ${pc(v.chance[s])} chance (once every 2s) to take ${v.shave[s]}s off every cooldown.`) },
  zeus: { name: L('שרשרת הסערה', 'Tempest Chain'), kind: 'tempest', v: { chance: [.15, .18, .21, .25, .3], jumps: [2, 2, 3, 3, 4], dmg: [.3, .4, .5, .6, .7] }, icd: 2,
    text: (s, v) => L(`${pc(v.chance[s])} סיכוי (פעם ב־2 ש׳) לברק שקופץ אל ${v.jumps[s]} אויבים ב־${pc(v.dmg[s])} מהמכה.`, `${pc(v.chance[s])} chance (once every 2s) of lightning leaping to ${v.jumps[s]} foes for ${pc(v.dmg[s])} of the hit.`) },
  nemesis: { name: L('גמול', 'Retribution'), kind: 'retribution', v: { store: [.2, .3, .4, .5, .6], thorns: [0, 0, .1, .15, .2] }, icd: 3,
    text: (s, v) => L(`${pc(v.store[s])} מהנזק שספגת נאגר (עד 30% מהחיים) ומשתחרר במכה הבאה שלך (פעם ב־3 ש׳).${v.thorns[s] ? ` התוקף סופג ${pc(v.thorns[s])} ממה שגרם.` : ''}`, `${pc(v.store[s])} of the damage you take is stored (up to 30% of your health) and released by your next hit (once every 3s).${v.thorns[s] ? ` The attacker takes ${pc(v.thorns[s])} of what it dealt.` : ''}`) },
  tartarus: { name: L('רעב התהום', 'Abyssal Hunger'), kind: 'hunger', v: { dmg: [.06, .09, .12, .15, .2], pulse: [0, 0, 0, .5, .7] }, icd: 3,
    text: (s, v) => L(`${pc(v.dmg[s])} נזק לאויבים מתחת לחצי חיים, כפול מתחת לרבע.${v.pulse[s] ? ` מכת חיסול משחררת דופק תהום (${pc(v.pulse[s])} מהמכה, 2.5 מ׳, פעם ב־3 ש׳).` : ''}`, `${pc(v.dmg[s])} damage to foes under half health, double under a quarter.${v.pulse[s] ? ` A killing blow releases an abyssal pulse (${pc(v.pulse[s])} of the hit, 2.5 m, once every 3s).` : ''}`) },
  chaos: { name: L('הד הריק', 'Void Echo'), kind: 'void', v: { chance: [.1, .13, .16, .2, .25], icd: [2.5, 2.2, 2, 1.8, 1.5], dmg: [.4, .55, .7, .85, 1], targets: [3, 3, 4, 4, 5], tear: [0, 0, 0, 0, .08] }, icd: 2.5,
    text: (s, v) => L(`${pc(v.chance[s])} סיכוי (פעם ב־${v.icd[s]} ש׳) להד ריק: אחרי רגע ${pc(v.dmg[s])} מנזק המכה לעד ${v.targets[s]} אויבים ב־2.5 מ׳ (מול בוס 60%).${v.tear[s] ? ' וקרע במציאות: המטרה סופגת 8% יותר נזק ל־4 ש׳.' : ''}`, `${pc(v.chance[s])} chance (once every ${v.icd[s]}s) of a void echo: a moment later ${pc(v.dmg[s])} of the hit to up to ${v.targets[s]} foes within 2.5 m (60% against a boss).${v.tear[s] ? ' And a tear in reality: the target takes 8% more damage for 4s.' : ''}`) },
};
export function setPassiveText(setId, stage) { const P = SET_PASSIVES[setId]; return stage > 0 ? P.text(stage - 1, P.v) : P.text(0, P.v); }

// ------------------------------------------------------------------ weapon families (spec 10)
// procMul: a per-hit chance is scaled by how often the weapon lands (a pair of blades lands twice as often as a sword, so its
// chance per hit is lower); every family proc also has an internal cooldown shared by both hands of a pair.
// the proc budget (spec 10.3, addendum 5): a weapon that lands more hits a second gets a smaller chance per hit, so every
// category (and stance) triggers its passives about as often each second as a one-handed sword does; a proc's damage is
// then sized from the hit times the same factor's inverse (passives.js base), so proc damage per second follows the
// weapon's damage per second and never the number of blades. Derived from the cadence, not set by hand.
const HPS_REF = hitsPerSec('blade', CATS.sword1.tempo * (1 + CATS.sword1.as));
export function procMul(cat, stance) {
  const C = CATS[cat]; if (!C?.style) return 1;
  return r4(HPS_REF / hitsPerSec(stance === 'mastery' && C.mastery ? C.mastery : C.style, C.tempo * (1 + C.as)));
}
export const PROC_MUL = Object.fromEntries(Object.keys(CATS).filter((c) => CATS[c].style).map((c) => [c, procMul(c)]));
// the handling lines (addendum 7) with the numbers the cadence above gives: the pair's edge and what the shield gives back
const BLOCK_SHIELD = .85, BLOCK_PARRY = .34; // entities.js: a guard behind a shield (blade STYLE.block) and one without (NO_SHIELD)
const pct = (v) => `${Math.round(v * 100)}%`;
for (const [d, { vs }] of Object.entries(DUAL_EDGE)) {
  const edge = sustained(d) / sustained(vs, 100, 'mastery') - 1, sword = d === 'dualSword', T = STYLE_T.dual.reduce((n, x) => n + x[3].length, 0);
  HANDLING[d] = L(`זוג תואם: ${sword ? 'חרב' : 'גרזן'} בכל יד, פריט אחד שתופס את שתי הידיים ונספר פעם אחת. העוצמה היא מכת שני הלהבים יחד, וכל אחת מ־${T} המכות של הצירוף לוקחת את חלקה. ${sword ? 'קצב מהיר וזורם של מכות מתחלפות' : 'מכות כבדות יותר מזוג חרבות, בקצב איטי יותר'}: כ־${pct(edge)} יותר נזק מתמשך משל ${sword ? 'חרב דו־ידנית' : 'גרזן דו־ידני'} בשליטה עם מגן. אין מגן: חסימה בלהבים עוצרת ${pct(BLOCK_PARRY)} מהמכה במקום ${pct(BLOCK_SHIELD)} ומעלה. סיכויי הכוחות לכל מכה מוכפלים ב־${PROC_MUL[d].toFixed(2)}, כך שהם פורצים בתדירות של חרב.`,
    `A matched pair: ${sword ? 'a sword' : 'an axe'} in each hand, one item that takes both hands and counts once. Power is the blow of both blades together; each of the combo's ${T} hits takes its share. ${sword ? 'Quick, flowing alternating strikes' : 'Heavier blows than dual swords, at a slower pace'}: about ${pct(edge)} more sustained damage than a mastered two-handed ${sword ? 'sword' : 'axe'} with a shield. No shield: a guard on the blades stops ${pct(BLOCK_PARRY)} of a blow instead of ${pct(BLOCK_SHIELD)} or more. Passive chances per hit are x${PROC_MUL[d].toFixed(2)}, so they trigger as often a second as a sword's.`);
}
for (const c of ['sword2', 'axe2', 'spear2']) {
  const C = CATS[c], two = sustained(c), m = sustained(c, 100, 'mastery'), he = { sword2: 'חרב דו־ידנית', axe2: 'גרזן דו־ידני', spear2: 'חנית דו־ידנית' }[c];
  const tail = c === 'spear2' ? L(`טווח ${C.reach} מ׳: דקירות שמחזיקות אויבים במרחק.`, `Reach ${C.reach} m: thrusts that keep foes at a distance.`) : c === 'axe2' ? L('מכות עצומות שמטלטלות ומפילות.', 'Huge blows that stagger and knock down.') : L(`טווח ${C.reach} מ׳, מכות רחבות וכבדות.`, `Reach ${C.reach} m, wide heavy blows.`);
  HANDLING[c] = L(`${he}: ${c === 'axe2' ? 'תופס' : 'תופסת'} את שתי הידיים (בלי מגן). שליטה בנשק כבד מרמה ${MASTERY_LEVEL}: ביד אחת לצד מגן, ב־${pct(MASTERY_DMG)} מנזק הנשק ובקצב של נשק ליד אחת (${pct(m / two)} מהנזק המתמשך שלו בשתי ידיים), והמגן מוסיף שריון וחסימה מלאה (${pct(BLOCK_SHIELD)} ומעלה). ${tail.he}`,
    `Two-handed: takes both hands (no shield). Heavy-weapon mastery from level ${MASTERY_LEVEL}: one-handed beside a shield, at ${pct(MASTERY_DMG)} weapon damage in a one-hander's rhythm (${pct(m / two)} of its two-handed sustained damage), and the shield adds its armour and a full block (${pct(BLOCK_SHIELD)} or more). ${tail.en}`);
}
// a weapon's expected damage a second at her power 1 (the item's own Power, speed and crit; her other gear moves every loadout alike)
export function loadoutDps(def, st, stance) {
  const C = CATS[def.cat]; if (!C?.style) return null;
  const m = stance === 'mastery' && C.mastery;
  return r4(st.power * (m ? MASTERY_DMG : 1) * styleRate(m ? C.mastery : C.style, C.tempo * (1 + st.atkSpeed)) * critExp(st.crit));
}
export const FAMILIES = {
  hunter: { name: L('אדם / צייד', 'Human / Hunter'), el: null, colors: ['#f0e0c0', '#a07850'], passive: { name: L('מרדף', 'Pursuit'), kind: 'pursuit', every: 4, dmg: .3, icd: 0,
    desc: L('כל מכה רביעית ברצף באותו אויב פוגעת ב־30% יותר.', 'Every 4th hit in a row on the same foe strikes 30% harder.') } },
  cyclopean: { name: L('קיקלופי', 'Cyclopean'), el: null, colors: ['#e0d8c8', '#8a8070'], passive: { name: L('משקל מוחץ', 'Crushing Weight'), kind: 'crush', chance: .12, heavy: .1, icd: 3,
    desc: L('מכות כבדות: 10% יותר נזק. 12% סיכוי לטלטל אויב רגיל (פעם ב־3 ש׳; לא בוסים).', 'Heavy blows deal 10% more. 12% chance to stagger an ordinary foe (once every 3s; not bosses).') } },
  argive: { name: L('נפחיית ארגוס', 'Argive Forge'), el: null, colors: ['#ffe4a0', '#c08436'], passive: { name: L('להב אמין', 'True Edge'), kind: 'trueedge', crit: .03, dmg: .04, icd: 0,
    desc: L('מכות אמינות: 4% נזק ו־3% סיכוי למכה קטלנית.', 'Reliable strikes: 4% damage and 3% crit chance.') } },
  spartan: { name: L('מלחמת ספרטה', 'Spartan War'), el: null, colors: ['#e0e0ec', '#a8201c'], passive: { name: L('שובר', 'Breaker'), kind: 'breaker', tough: .1, heavy: .08, icd: 0,
    desc: L('חודר שריון במידה: 10% נזק נגד עילית, בוסים ואויבים מוגנים, ו־8% במכות כבדות.', 'Limited armour piercing: 10% damage against elites, bosses and guarded foes, 8% on heavy blows.') } },
  dawn: { name: L('שחר / שמש', 'Dawn / Solar'), el: 'holy', colors: ['#fff6c8', '#ffb22e'], passive: { name: L('זוהר', 'Radiance'), kind: 'smite', chance: .1, dmg: .5, icd: 3,
    desc: L('10% סיכוי (פעם ב־3 ש׳) לקרן אור: 50% מנזק המכה.', '10% chance (once every 3s) of a ray of light: 50% of the hit.') } },
  serpent: { name: L('נחש דלפי', 'Delphic Serpent'), el: 'poison', colors: ['#d0ffb8', '#3ac06a'], passive: { name: L('ארס', 'Venom'), kind: 'poison', chance: .25, dps: .15, dur: 4, stacks: 3, icd: .8,
    desc: L('25% סיכוי להרעיל: 15% מנזק המכה בשנייה ל־4 ש׳, עד 3 שכבות.', '25% chance to poison: 15% of the hit per second for 4s, stacking 3 times.') } },
  olympian: { name: L('אולימפי', 'Olympian'), el: 'holy', colors: ['#ffffff', '#e8b840'], passive: { name: L('ברכת האגיס', 'Aegis Blessing'), kind: 'blessing', charges: 5, dr: .25, icd: 0,
    desc: L('כל מכה צוברת ברכה (עד 5). בחמש: המכה הבאה שתספגי מוקטנת ב־25%.', 'Each hit gathers a blessing (up to 5). At five, the next blow you take is 25% weaker.') } },
  sea: { name: L('פוסידון / ים', 'Poseidon / Sea'), el: 'frost', colors: ['#c8faff', '#2fb8d8'], passive: { name: L('לחץ המים', 'Water Pressure'), kind: 'surge', chance: .2, slow: .3, dmg: .2, icd: 2.5,
    desc: L('20% סיכוי (פעם ב־2.5 ש׳): האט ב־30% ל־2 ש׳ ופגיעת מים של 20% מהמכה.', '20% chance (once every 2.5s): slow by 30% for 2s and a water strike for 20% of the hit.') } },
  artemis: { name: L('ארטמיס / ציד', 'Artemis / Hunt'), el: null, colors: ['#f4f8ff', '#9ab8e8'], passive: { name: L('עין חדה', 'Keen Eye'), kind: 'keen', crit: .05, cdmg: .15, icd: 0,
    desc: L('5% סיכוי למכה קטלנית, ומכות קטלניות חזקות ב־15%.', '5% crit chance, and crits deal 15% more.') } },
  helios: { name: L('הליוס / שמש', 'Helios / Sun'), el: 'fire', colors: ['#fff4c0', '#ff8a1a'], passive: { name: L('אש השמש', 'Sunfire'), kind: 'burn', chance: .2, dps: .12, dur: 3, icd: 1.5,
    desc: L('20% סיכוי להצית: 12% מנזק המכה בשנייה ל־3 ש׳.', '20% chance to ignite: 12% of the hit per second for 3s.') } },
  styx: { name: L('סטיקס / שאול', 'Styx / Underworld'), el: 'shadow', colors: ['#c8fff4', '#4a4a7a'], passive: { name: L('שאיבת נשמה', 'Soul Siphon'), kind: 'siphon', leech: .03, kill: .02, icd: 0,
    desc: L('מרפאת 3% מהנזק (עד 2% חיים בשנייה), והריגה משיבה 2% חיים.', 'Heals 3% of damage dealt (at most 2% health a second); a kill restores 2% health.') } },
  titan: { name: L('טיטאן', 'Titan'), el: null, colors: ['#ffc060', '#5a3a2a'], passive: { name: L('שבירת שריון', 'Sunder'), kind: 'sunder', per: .03, max: 3, dur: 6, icd: 0,
    desc: L('כל מכה סודקת שריון: האויב סופג 3% יותר נזק לכל סדק, עד 3 (6 ש׳).', 'Each hit cracks armour: the foe takes 3% more damage per crack, up to 3 (6s).') } },
  athena: { name: L('אתנה / חוכמה', 'Athena / Wisdom'), el: 'holy', colors: ['#fff4d0', '#5a8ad8'], passive: { name: L('חוכמה', 'Wisdom'), kind: 'wisdom', mana: 2, chance: .1, shave: .5, icd: 3,
    desc: L('כל מכה משיבה 2 מאנה, ו־10% סיכוי (פעם ב־3 ש׳) לקצר חצי שנייה מזמני ההמתנה.', 'Each hit restores 2 mana, and 10% chance (once every 3s) to take 0.5s off your cooldowns.') } },
  zeus: { name: L('זאוס / סערה', 'Zeus / Storm'), el: 'lightning', colors: ['#ffffff', '#5ab0ff'], passive: { name: L('חשמל סטטי', 'Static'), kind: 'static', chance: .15, jumps: 2, dmg: .35, icd: 2.5,
    desc: L('15% סיכוי (פעם ב־2.5 ש׳) לברק שקופץ אל 2 אויבים ב־35% מהמכה.', '15% chance (once every 2.5s) of lightning leaping to 2 foes for 35% of the hit.') } },
  nemesis: { name: L('נמסיס / גמול', 'Nemesis / Retribution'), el: 'shadow', colors: ['#ffd0d4', '#b01a2a'], passive: { name: L('נקמת דם', 'Vendetta'), kind: 'vendetta', dmg: .25, win: 4, icd: 4,
    desc: L('אחרי שספגת מכה, המכה הבאה שלך תוך 4 ש׳ חזקה ב־25%.', 'After you are hit, your next blow within 4s strikes 25% harder.') } },
  tartarus: { name: L('טרטרוס / תהום', 'Tartarus / Abyss'), el: 'shadow', colors: ['#e8a0ff', '#7a1aa8'], passive: { name: L('תהום', 'Abyss'), kind: 'abyss', below: .35, dmg: .15, icd: 0,
    desc: L('15% נזק לאויבים מתחת ל־35% חיים.', '15% damage to foes under 35% health.') } },
  chaos: { name: L('כאוס', 'Chaos'), el: 'shadow', colors: ['#c89aff', '#ff2a4a'], passive: { name: L('עיוות', 'Distortion'), kind: 'distort', chance: .12, dmg: .5, icd: 2,
    desc: L('12% סיכוי (פעם ב־2 ש׳) לפגיעה נוספת מעוותת: 50% מהמכה (מול בוס 60% מזה).', '12% chance (once every 2s) of a distorted extra impact: 50% of the hit (60% of that against a boss).') } },
};

// ------------------------------------------------------------------ the 48 standalone identities (spec 6)
// [key, cat, level, family|null, he, en, descHe, descEn, perk]   perk: an extra stat of its own (spec 17.15)
const SA = [
  // shields
  ['shepherd_bulwark', 'shield', 8, null, 'מחסה הרועה', "Shepherd's Bulwark", 'קלוע נצרים ועור עז, עם שפת ארד. רועה עמד מאחוריו מול זאבים.', 'Woven wicker and goat hide in a bronze rim. A shepherd stood behind it against wolves.', { hpRegen: 1 }],
  ['oath_exile', 'shield', 65, null, 'שבועת הגולה', 'Oath of the Exile', 'אספיס ארד חבוט שעליו שלשלת שבורה: מגנו של מי שגורש ונשבע לחזור.', 'A battered bronze aspis bearing a broken chain: the shield of one exiled who swore to return.', { block: 1 }],
  ['ashen_sentinel', 'shield', 140, null, 'זקיף האפר', 'Ashen Sentinel', 'מגן מגדל מאבן געשית אפורה, ובסדקיו עוד לוחשת גחלת.', 'A tower shield of grey volcanic stone; embers still whisper in its cracks.', { hpRegen: 1 }],
  ['unbroken_horizon', 'shield', 235, null, 'האופק שלא נשבר', 'The Unbroken Horizon', 'מגן עגול של לילה, ובשוליו כוכבים שמקיפים אותו לאט. השמיים עצמם עומדים מאחוריו.', 'A round shield of night ringed by slowly orbiting stars. The sky itself stands behind it.', { block: 1, mpRegen: 1 }],
  // one-handed swords
  ['grove_kopis', 'sword1', 3, 'hunter', 'קופיס החורשה', 'Olive-Grove Kopis', 'להב מעוקל של איכר, בקת עץ זית וחבל קשור. פשוט וחד.', "A farmer's curved blade with an olive-wood hilt and a bound cord. Plain and keen.", { exp: 1 }],
  ['last_argive', 'sword1', 50, 'argive', 'הארגיבי האחרון', 'The Last Argive', 'החרב של אחרון לוחמי ארגוס שעמד בשער. הארד עוד זוכר את הקרב.', 'The sword of the last Argive to hold the gate. The bronze still remembers the fight.', { power: 1 }],
  ['moonlit_pursuer', 'sword1', 120, 'artemis', 'הרודף לאור הירח', 'Moonlit Pursuer', 'להב כסף דק כקרן ירח, ומשמר בצורת קרני צבי.', 'A silver blade as thin as a moonbeam, its guard shaped like a stag’s antlers.', { crit: 1 }],
  ['unwritten_edge', 'sword1', 220, 'athena', 'הלהב שלא נכתב', 'The Unwritten Edge', 'להב של קלף ואור שהמוירות לא הספיקו לכתוב את גורלו. כל מכה כותבת שורה.', 'A blade of parchment and light whose fate the Moirai never wrote. Every blow writes a line.', { mpRegen: 1 }],
  // one-handed axes
  ['woodsman_bite', 'axe1', 5, 'hunter', 'נשיכת החוטב', "Woodsman's Bite", 'גרזן חוטבים עם להב ברזל רחב וידית אלון מחורצת.', "A woodcutter's axe: a broad iron bit on a notched oak haft.", { hpRegen: 1 }],
  ['bronze_revenant', 'axe1', 75, 'spartan', 'הנוקם מארד', 'Bronze Revenant', 'גרזן ארד שחור מפיח, שנמשה מקברו של הופליט ושב לקרב.', 'A soot-black bronze axe dragged from a hoplite’s grave, come back to the fight.', { lifesteal: 1 }],
  ['gorgon_kiss', 'axe1', 160, 'serpent', 'נשיקת הגורגונה', "Gorgon's Kiss", 'להב בצורת שיער נחשים מאובן, ועין ירוקה פקוחה בראשו.', 'A bit shaped like petrified serpent hair, a green eye open at its heart.', { crit: 1 }],
  ['heaven_sunderer', 'axe1', 260, 'zeus', 'בוקע השמיים', 'Heaven-Sunderer', 'גרזן כסף שבו נלכד ברק שלם. כשהוא נוחת, השמיים נסדקים.', 'A silver axe with a whole thunderbolt caught inside. When it falls, the sky cracks.', { power: 1 }],
  // two-handed swords
  ['thessalian_longblade', 'sword2', 10, 'cyclopean', 'הלהב הארוך מתסליה', 'Thessalian Longblade', 'חרב ברזל ארוכה של פרשי תסליה, כבדה ויציבה.', 'A long iron sword of the Thessalian riders, heavy and steady.', { hp: 1 }],
  ['labour_heracles', 'sword2', 85, 'titan', 'עמל הרקלס', "Heracles' Labour", 'להב רחב שנחשל באש של שתים עשרה עבודות, ועור האריה כרוך על ידיתו.', 'A broad blade forged in the fire of twelve labours, the lion’s hide wound on its grip.', { power: 1 }],
  ['pyre_patroclus', 'sword2', 175, 'helios', 'מוקד פטרוקלוס', 'Pyre of Patroclus', 'חרב של אבל ולהבה: מוקד הלוויה של פטרוקלוס עוד בוער לאורך הלהב.', 'A sword of grief and flame: Patroclus’ pyre still burns along its edge.', { lifesteal: 1 }],
  ['eclipse_warden', 'sword2', 245, 'tartarus', 'שומר הליקוי', 'Eclipse Warden', 'להב שחור כליקוי, וטבעת אש סגולה מקיפה את משמרו.', 'A blade black as an eclipse, a ring of violet fire round its guard.', { crit: 1 }],
  // two-handed axes
  ['minotaur_tithe', 'axe2', 20, 'cyclopean', 'מעשר המינוטאור', "Minotaur's Tithe", 'לבריס כפול כבד מארמון קנוסוס, וקרני שור על ראשו.', 'A heavy double labrys from the palace of Knossos, bull horns on its crown.', { hp: 1 }],
  ['wrath_deep', 'axe2', 95, 'sea', 'זעם המצולות', 'Wrath of the Deep', 'גרזן שנשלה מהמצולות, להב צדפה ענק ושוניות אלמוג לאורכו.', 'An axe dredged from the deep: a great shell bit and reefs of coral down its haft.', { hpRegen: 1 }],
  ['bane_talos', 'axe2', 155, 'titan', 'מכת טאלוס', 'Bane of Talos', 'גרזן ארד ענק עם ורידים של אש נוזלית, כמו דם הענק מכרתים.', 'A giant bronze axe veined with liquid fire, like the blood of the giant of Crete.', { power: 1 }],
  ['kronos_harvest', 'axe2', 270, 'styx', 'קציר קרונוס', "Kronos' Harvest", 'להב מגל־גרזן של הזמן עצמו; החול זורם בו כמו בשעון.', 'A sickle-axe of time itself; sand runs through it as through an hourglass.', { lifesteal: 1 }],
  // two-handed spears
  ['marathon_dory', 'spear2', 35, 'argive', 'הדורי של מרתון', 'Marathon Dory', 'חנית הופליט ממרתון, ראש עלה ארוך וזנב ארד.', 'A hoplite spear from Marathon: a long leaf head and a bronze butt-spike.', { speed: 1 }],
  ['hydra_tongue', 'spear2', 100, 'serpent', 'לשון ההידרה', "Hydra's Tongue", 'חנית מפוצלת כלשון נחש, וארס ירוק נוטף משני ראשיה.', 'A spear forked like a serpent’s tongue, green venom dripping from both points.', { crit: 1 }],
  ['starfall_lance', 'spear2', 190, 'dawn', 'רומח מפל הכוכבים', 'Starfall Lance', 'רומח של מתכת כוכבים שנפלה בשחר, וכוכב חי בקצהו.', 'A lance of star-metal that fell at dawn, a living star at its point.', { mpRegen: 1 }],
  ['final_verdict', 'spear2', 280, 'nemesis', 'פסק הדין האחרון', 'The Final Verdict', 'חנית שראשה מאזניים פתוחים; היא שוקלת כל לב שהיא פוגשת.', 'A spear whose head is a pair of open scales; it weighs every heart it meets.', { power: 1 }],
  // dual swords
  ['sisters_strait', 'dualSword', 40, 'sea', 'אחיות המצר', 'Sisters of the Strait', 'שני להבים קצרים של מלחים, מסולסלים כגלים במצר בין סקילה לכריבדיס.', 'Two short sailors’ blades curled like the waves of the strait between Scylla and Charybdis.', { speed: 1 }],
  ['castor_pollux', 'dualSword', 115, 'olympian', 'קסטור ופולוקס', 'Castor and Pollux', 'זוג תאומים: להב של כסף ולהב של זהב, מוות וחיי נצח.', 'Twins: a blade of silver and a blade of gold, mortal and immortal.', { hpRegen: 1 }],
  ['whispers_hypnos', 'dualSword', 205, 'styx', 'לחישות היפנוס', 'Whispers of Hypnos', 'להבים של ערפל ופרגים; מי שנפגע מהם שוכח לרגע להילחם.', 'Blades of mist and poppies; whoever they cut forgets, for a moment, to fight.', { lifesteal: 1 }],
  ['shears_atropos', 'dualSword', 285, 'nemesis', 'מספרי אטרופוס', 'Shears of Atropos', 'שני חצאי המספריים שגוזרים את חוט החיים. אין חוט שלא ייגזר.', 'The two halves of the shears that cut the thread of life. No thread goes uncut.', { crit: 1 }],
  // dual axes
  ['thracian_cleavers', 'dualAxe', 50, 'spartan', 'מבקעי תרקיה', 'Thracian Cleavers', 'שני גרזיני יד של שבטי תרקיה, ברזל מחושל ורצועות פרווה.', 'Two hand-axes of the Thracian tribes, forged iron and fur straps.', { lifesteal: 1 }],
  ['maenad_frenzy', 'dualAxe', 125, 'hunter', 'טירוף המאנדות', "Maenad's Frenzy", 'גרזינים עטורי קיסוס וגפן, בטירוף החגיגה של דיוניסוס.', 'Axes wreathed in ivy and vine, in the frenzy of Dionysus’ revel.', { speed: 1 }],
  ['ares_ruin', 'dualAxe', 215, 'titan', 'החורבן הכפול של ארס', "Ares' Twin Ruin", 'פובוס ודימוס, פחד ואימה, נחושלו לשני גרזנים אדומים.', 'Phobos and Deimos, Fear and Terror, forged into two red axes.', { power: 1 }],
  ['typhon_maw', 'dualAxe', 290, 'tartarus', 'לוע טיפון', "Typhon's Maw", 'שני להבים כמו לסתות של אבי המפלצות, ואש התהום בגרונם.', 'Two bits like the jaws of the father of monsters, abyssal fire in their throats.', { crit: 1 }],
  // helmets
  ['boar_cap', 'helmet', 6, null, 'כובע ניבי החזיר', 'Boar-Tusk Cap', 'כובע עור שתפורים עליו ניבי חזיר בר, כמו של גיבורי הומרוס.', 'A leather cap sewn with wild boar tusks, like those of Homer’s heroes.', { hpRegen: 1 }],
  ['myrmidon_crest', 'helmet', 55, null, 'ציצת המירמידונים', 'Crest of the Myrmidons', 'קסדת ארד מוצקת עם ציצת סוס שחורה, כמו של אנשי אכילס.', 'A solid bronze helm with a black horsehair crest, like those of Achilles’ men.', { crit: 1 }],
  ['visage_hyperion', 'helmet', 145, null, 'פני היפריון', 'Visage of Hyperion', 'מסכת זהב של טיטאן האור, וקרניים יוצאות ממנה כמו מהשמש.', 'A golden mask of the Titan of light, rays bursting from it like the sun.', { mpRegen: 1 }],
  ['crown_erinyes', 'helmet', 225, null, 'כתר האריניות', 'Crown of the Erinyes', 'כתר שחור של כנפי עטלף ונחשים חיים, של שלוש הנוקמות.', 'A black crown of bat wings and living snakes, of the three avengers.', { lifesteal: 1 }],
  // body
  ['ford_linothorax', 'body', 12, null, 'שריון הפשתן של המעבר', 'Linothorax of the Ford', 'שכבות פשתן מודבקות וקשקשי ארד במותניים. קל ומפתיע בחוזקו.', 'Glued layers of linen and bronze scales at the waist. Light, and surprisingly strong.', { speed: 1 }],
  ['scales_ladon', 'body', 80, null, 'קשקשי לאדון', 'Scales of Ladon', 'שריון קשקשי הדרקון ששמר על התפוחים של ההספרידות, ירוק וזהוב.', 'Armour of the scales of the dragon that guarded the Hesperides’ apples, green and gold.', { hpRegen: 1 }],
  ['mantle_nyx', 'body', 170, null, 'גלימת ניקס', 'Mantle of Nyx', 'שריון של לילה, וכוכבים זעירים זורחים בקפליו.', 'Armour of night, tiny stars shining in its folds.', { mpRegen: 1 }],
  ['atlas_burden', 'body', 240, null, 'משא אטלס', "Atlas' Burden", 'שריון אבן כבד ועליו כדור השמיים חרוט על הגב. מי שנושאת אותו נושאת עולם.', 'Heavy stone armour with the celestial globe carved on its back. She who wears it carries a world.', { hp: 1 }],
  // boots
  ['goatherd_sandals', 'boots', 4, null, 'סנדלי רועה העיזים', "Goatherd's Sandals", 'סנדלי עור עם רצועות עד הברך. טובים לשבילי הרים.', 'Leather sandals laced to the knee. Good for mountain paths.', { speed: 1 }],
  ['courier_greaves', 'boots', 45, null, 'מגיני השוק של השליח', "Courier's Greaves", 'מגיני ארד קלים של רצי המלך, וכנף קטנה חרוטה בכל אחד.', 'Light bronze greaves of the king’s runners, a small wing chased on each.', { speed: 1 }],
  ['strides_atalanta', 'boots', 135, null, 'צעדי אטלנטה', 'Strides of Atalanta', 'מגפי עור צבי לבן ותפוחי זהב קטנים. אף אחד לא השיג אותה.', 'Boots of white deerskin with little golden apples. No one ever caught her.', { crit: 1 }],
  ['soulguide_treads', 'boots', 215, null, 'דרכי מוליך הנשמות', 'Soulguide Treads', 'סנדלי צל עם כנפי רפאים בעקב, של מי שמוביל את המתים.', 'Sandals of shadow with ghostly wings at the heel, of the one who leads the dead.', { mpRegen: 1 }],
  // wings
  ['stymphalian_pinions', 'wings', 30, null, 'נוצות סטימפליה', 'Stymphalian Pinions', 'כנפיים של נוצות ארד חדות מציפורי האגם של סטימפליה.', 'Wings of sharp bronze feathers from the birds of Lake Stymphalia.', { crit: 1 }],
  ['icarus_folly', 'wings', 50, null, 'שגיאת איקרוס', "Icarus' Folly", 'נוצות ודונג על מסגרת עץ, קטנות מכדי להימס שוב: הן מפרפרות, אבל כבר לא מרימות איש.', 'Feathers and wax on a wooden frame, too small to melt again: they flutter, but they lift no one any more.', { speed: 1 }],
  ['harpy_mantle', 'wings', 70, null, 'גלימת ההרפיה', "Harpy's Mantle", 'כנפיים קרועות של נוצות כהות, וטפרים בקצותיהן.', 'Ragged wings of dark feathers with talons at their tips.', { lifesteal: 1 }],
  ['nike_triumph', 'wings', 200, null, 'ניצחון ניקה', "Nike's Triumph", 'כנפי הניצחון: לבנות כשיש ומוזהבות, פרושות כמו בפסל על הספינה.', 'The wings of Victory: marble-white and gilded, spread like the statue on the prow.', { power: 1 }],
];
export const STANDALONE = SA.map(([key, cat, lvl, family, he, en, dhe, den, perk]) => ({ id: 'sa_' + key, key, cat, lvl, family, name: L(he, en), desc: L(dhe, den), perk }));

// ------------------------------------------------------------------ capes (Roy, v31b: "in the wings' slot, capes, for the lower levels")
// capes2 (Roy: "capes up to level 30; small wings from 30 to 70, seen but they don't make you fly; only from 70 do the wings
// fly, and the higher the wing the bigger and more impressive"): the back slot by level is
//   1-29 a cape (seven, below) | 30-69 small wings, for show (Stymphalian Pinions 30, Icarus' Folly 50) | 70+ flight wings
//   (Harpy's Mantle 70, the winged sets from 150, Nike's Triumph 200), drawn bigger the higher the item's level (weapons.js wingTier)
// Capes are worn in the wings' own slot (cat 'wings', hero slot 'back': a cape and wings never go on together). Each opens
// with a step of the story (progress.js CHAPTER_LEVEL 1, 3, 6, 10, 14; then 20 and 25 on the way to 30) and holds its window
// to the next; the last one to the level before the first wings (29). They are not standalone identities (spec 6 keeps its 48)
// and not set pieces: kind 'cape'. Stats come from the wings' line of the pipeline (itemStats), tilted to cloth: more
// defense, less crit and attack speed, plus one perk each; a later cape guards more.
// Sources: like the standalone wings (rollItem drops, the armourers' racks, quest extras, the relic trader's graded offers),
// and quests that hand one over as the rarity climbs: the Elaia shepherd's q_boars the chlamys (Normal or better), the
// Corinth smith's q_corhelm the hoplite's cloak (Epic or better), Dodona's wolf hunt q_oak the wolf pelt, the Athena
// priestesses' q_owl the saffron himation (their grade), the Pella stash q_stash the royal purple (Epic or better) and
// Zeus' wrath q_zeus the Golden Fleece (Legendary). The hunter's cloak is the one to find or buy.
// Names and descriptions: i18n.js CAPE_TEXT (he / en / es).
const CAPE_DEFS = [
  ['shepherd_chlamys', 1, { hpRegen: 1 }, { defense: 1.3, crit: .7, atkSpeed: .8 }],
  ['hunter_cloak', 3, { crit: 1 }, { defense: 1.3, atkSpeed: .9 }],
  ['hoplite_cloak', 6, { hp: 1 }, { defense: 1.45, power: 1.1, crit: .8, atkSpeed: .8 }],
  ['wolf_cloak', 10, { lifesteal: 1 }, { defense: 1.4, crit: .9, atkSpeed: .85 }],
  ['saffron_himation', 14, { hpRegen: 1 }, { defense: 1.4, atkSpeed: .9, crit: .8 }],
  ['royal_chlamys', 20, { power: 1 }, { defense: 1.45, power: 1.1, crit: .8, atkSpeed: .8 }],
  ['fleece_mantle', 25, { hp: 1 }, { defense: 1.5, power: 1.05, crit: .85, atkSpeed: .85 }],
];
export const CAPES = CAPE_DEFS.map(([key, lvl, perk, tilt]) => ({ id: 'sa_' + key, key, cat: 'wings', cape: true, lvl, family: null, name: CAPE_TEXT[key].name, desc: CAPE_TEXT[key].desc, perk, tilt }));
export const isCapeId = (id) => !!parseId(id)?.def.cape;
// wings from this level fly (models.js hoverRig); below it they are small and for show (capes2). Marked on every wings base
// as flight: true / false (a cape is neither), for the drawer, the tooltips, the wiki and a later flight phase
export const FLIGHT_LEVEL = 70;
export const isFlightId = (id) => { const d = parseId(id)?.def; return !!d && d.cat === 'wings' && !d.cape && !!d.flight; };

// ------------------------------------------------------------------ the base catalog (identities, before rarity and level)
// The story's keepsakes: classified, but not catalog identities (they come from the story, see migrateId)
export const HEIRLOOMS = {
  village_spear: { cat: 'spear2', family: 'hunter' }, village_blade: { cat: 'sword1', family: 'argive' }, keres_scythe: { cat: 'spear2', family: 'styx' },
  tide_trident: { cat: 'spear2', family: 'sea' }, shield_crescent: { cat: 'shield' }, shield_shell: { cat: 'shield' }, val_dress: { cat: 'body' }, battle_dress: { cat: 'body' },
};
export const BASES = {};
const SIG = { apeiron: L('אפירון, להב הכאוס', 'Apeiron — Edge of Chaos'), ananke: L('חורבן אננקה', "Ananke's Ruin") };
const SIG_DESC = {
  apeiron: L('להב עצום ובלתי אפשרי שנחשל בגבול שבין הקיום לאין: גאומטריה שבורה, רסיסים מרחפים, ליבה סגולה־שחורה נעה ונגיעות ארגמן מאופקות. מכות מכוונות וקשות שמעוותות את המרחב.',
    'A massive, impossible blade forged on the boundary between existence and nothingness: fractured geometry, suspended fragments, a shifting violet-black core and restrained crimson. Deliberate, crushing strikes that warp space.'),
  ananke: L('חנית קדמונית של ההכרח וההרס: ראש על־טבעי אסימטרי, רסיסים מרחפים ושובל אלים. דקירות עזות שחודרות כל דבר.',
    'A monumental primordial spear of inevitability and destruction: an asymmetrical supernatural head, floating fragments and a violent trail. Powerful, piercing thrusts.'),
};
const CAT_DESC = { // the piece's own line, after the set's theme (x = the set's material)
  helmet: (x) => L(`קסדה של ${x.he}, שמגינה על הראש ומחדדת את המבט.`, `A helmet of ${x.en}, guarding the head and sharpening the eye.`),
  body: (x) => L(`שריון גוף מלא של ${x.he}, מהכתפיים ועד הברכיים.`, `Full-body armour of ${x.en}, from shoulders to knees.`),
  boots: (x) => L(`מגפיים של ${x.he}, קלות לצעד ויציבות בקרב.`, `Boots of ${x.en}, light on the march and steady in a fight.`),
  wings: (x) => L(`כנפיים של ${x.he}, שנושאות אותך מעט מעל הקרקע.`, `Wings of ${x.en} that carry you a little above the ground.`),
  shield: (x) => L(`מגן של ${x.he}, ליד השמאל.`, `A shield of ${x.en}, for the left arm.`),
  sword1: (x) => L(`חרב ליד אחת של ${x.he}: מאוזנת ומהירה.`, `A one-handed sword of ${x.en}: balanced and quick.`),
  axe1: (x) => L(`גרזן ליד אחת של ${x.he}: כל מכה כבדה.`, `A one-handed axe of ${x.en}: every blow lands heavy.`),
  sword2: (x) => L(`חרב דו־ידנית של ${x.he}: נזק כבד בקצב מדוד.`, `A two-handed sword of ${x.en}: heavy damage at a measured pace.`),
  axe2: (x) => L(`גרזן דו־ידני של ${x.he}: מכות מוחצות שמטלטלות.`, `A two-handed axe of ${x.en}: crushing, staggering blows.`),
  spear2: (x) => L(`חנית דו־ידנית של ${x.he}: טווח ארוך ודקירות.`, `A two-handed spear of ${x.en}: long reach and thrusts.`),
  dualSword: (x) => L(`זוג חרבות תואמות של ${x.he}: מכות מהירות ורצפים.`, `A matched pair of swords of ${x.en}: quick blows and combos.`),
  dualAxe: (x) => L(`זוג גרזנים תואמים של ${x.he}: תוקפני ומקרוב.`, `A matched pair of axes of ${x.en}: aggressive, close and heavy.`),
};
for (const s of SETS) {
  const next = SETS[s.index + 1]?.lvl;
  for (const cat of setCats(s)) {
    const id = `set_${s.id}_${cat}`;
    BASES[id] = { id, kind: 'set', setId: s.id, cat, lvl: s.lvl, max: next ? next - 1 : s.lvl, family: isWeaponType(cat) ? s.family : null,
      name: cat === 'body' && s.id === 'chaos' ? L('שריון גוף מלא של כאוס', 'Chaos Full-Body Armor') : L(`${CATS[cat].nameHe} ${s.name.he}`, `${s.name.en} ${CAT_EN[cat]}`),
      desc: L(`${s.theme.he} ${CAT_DESC[cat](s.mat).he}`, `${s.theme.en} ${CAT_DESC[cat](s.mat).en}`), quality: s.quality || 1, tilt: s.tilt || {} };
  }
}
for (const k of ['apeiron', 'ananke']) { // the Chaos set's two signature weapons (spec 12.1, 12.2)
  const id = `set_chaos_${k}`, s = SET_BY.chaos;
  BASES[id] = { id, kind: 'set', setId: 'chaos', cat: k === 'apeiron' ? 'sword2' : 'spear2', signature: k, lvl: 300, max: 300, family: 'chaos', name: SIG[k], desc: SIG_DESC[k], quality: 1.18, tilt: k === 'apeiron' ? { power: 1.08, atkSpeed: .9 } : { crit: 1.1 } };
}
{ // standalone windows: up to the next standalone of the same category (the last one to the cap); never under its unlock
  const byCat = {}; for (const x of STANDALONE) (byCat[x.cat] ||= []).push(x);
  for (const list of Object.values(byCat)) {
    list.sort((a, b) => a.lvl - b.lvl);
    list.forEach((x, i) => {
      BASES[x.id] = { id: x.id, kind: 'standalone', setId: null, cat: x.cat, lvl: Math.max(x.lvl, UNLOCK[x.cat] || 1), max: i + 1 < list.length ? list[i + 1].lvl - 1 : MAX_LEVEL,
        family: x.family, name: x.name, desc: x.desc, perk: x.perk, quality: 1, tilt: {} };
    });
  }
}
{ // cape windows: up to the next cape, the last one to the level before the first wings; and every wings base marked
  const firstWings = Math.min(...Object.values(BASES).filter((d) => d.cat === 'wings').map((d) => d.lvl));
  CAPES.forEach((x, i) => {
    BASES[x.id] = { id: x.id, kind: 'cape', cape: true, setId: null, cat: 'wings', lvl: x.lvl, max: i + 1 < CAPES.length ? CAPES[i + 1].lvl - 1 : firstWings - 1,
      family: null, name: x.name, desc: x.desc, perk: x.perk, quality: 1, tilt: x.tilt };
  });
  for (const d of Object.values(BASES)) if (d.cat === 'wings' && !d.cape) d.flight = d.lvl >= FLIGHT_LEVEL; // (a base's whole window is one kind)
}
export const BASE_IDS = Object.keys(BASES);
export const levelWindow = (base) => { const b = BASES[base]; return b ? [b.lvl, b.max] : null; };

// ------------------------------------------------------------------ ids
// parse('set_argive_sword1@37^e') -> { base, def, lvl: 37, g: 1, rarity: 'epic' }   (null when not a catalog id)
export function parseId(id) {
  if (typeof id !== 'string') return null;
  const m = /^((?:set|sa)_[A-Za-z0-9_]+?)(?:@(\d+))?(?:\^([el]))?$/.exec(id);
  if (!m || !BASES[m[1]]) return null;
  const def = BASES[m[1]], g = m[3] === 'e' ? 1 : m[3] === 'l' ? 2 : 0;
  const lvl = Math.max(def.lvl, Math.min(def.max, m[2] ? +m[2] : def.lvl));
  return { base: m[1], def, lvl, g, rarity: RARITIES[g] };
}
export function makeId(base, lvl, g = 0) {
  const def = BASES[base]; if (!def) return null;
  const L0 = Math.max(def.lvl, Math.min(def.max, clampL(lvl ?? def.lvl)));
  return base + (L0 !== def.lvl ? '@' + L0 : '') + SUFFIX[g | 0];
}
export const isCatalogId = (id) => !!parseId(id);

// ------------------------------------------------------------------ the stat pipeline, steps 1-3 (spec 7.2, 8)
// itemStats(def, lvl, rarity) -> { power, atkSpeed, crit, defense, hp, move, block, extra:{...} }: the final per-item values.
// Every number here comes out of this one function (tooltips, the hero, the drops); rarity is applied here and only here.
export function itemStats(def, lvl, rarity = 'normal') {
  const C = CATS[def.cat], T = def.tilt || {}, q = def.quality || 1, M = RARITY_MULT[rarity] || RARITY_MULT.normal;
  const asF = LEVEL_SCALE.atkSpeed(lvl), crF = LEVEL_SCALE.crit(lvl);
  const out = { power: null, atkSpeed: null, crit: null, defense: null, hp: null, move: null, block: null, extra: {} };
  if (isWeaponType(def.cat)) {
    out.power = weaponDmgRef(lvl) * blowOf(C) * q * (T.power || 1) * M.power; // damage of one blow of weight 1 (a pair: both blades' blow, see HANDLING)
    out.atkSpeed = C.as * asF * (T.atkSpeed || 1) * M.atkSpeed;
    out.crit = C.cr * crF * (T.crit || 1) * M.crit;
  } else {
    const share = C.def, guard = GEAR_BAL.guardSet(lvl);
    out.defense = guard * share * q * (T.defense || 1) * M.power;
    if (C.hp) out.hp = GEAR_BAL.hpShare(lvl) * maxHpAt(lvl) * C.hp * q * (T.defense || 1) * M.power;
    if (C.power) out.power = ARMOR_POWER(lvl) * C.power * q * (T.power || 1) * M.power; // a fraction added to her power
    if (C.crit) out.crit = C.crit * crF * (T.crit || 1) * M.crit;
    if (C.as) out.atkSpeed = C.as * asF * (T.atkSpeed || 1) * M.atkSpeed;
    if (C.move) out.move = MOVE(lvl) * C.move * M.atkSpeed; // (a tempo stat: it takes the attack-speed multiplier)
    if (C.block) out.block = (.01 + .0008 * lvl) * q * M.power;
  }
  for (const k of Object.keys(def.perk || {})) { // a standalone item's own extra (spec 6.4 / 17.15)
    const v = { hpRegen: Math.max(.6, .003 * maxHpAt(lvl)) * .8, mpRegen: (.5 + .035 * lvl) * .8, exp: .1 + .002 * lvl, lifesteal: .02 + .0006 * lvl, crit: .015 * crF, power: ARMOR_POWER(lvl) * .5,
      speed: MOVE(lvl) * .5, hp: GEAR_BAL.hpShare(lvl) * maxHpAt(lvl) * .08, block: .01 + .0008 * lvl, mp: 10 + 1.2 * lvl }[k];
    if (v != null) out.extra[k] = k === 'crit' || k === 'speed' ? v * (k === 'crit' ? M.crit : M.atkSpeed) : v * M.power;
  }
  return out;
}
const round = (v, k) => (v == null ? null : k === 'power' && v > 1 ? Math.round(v * 10) / 10 : k === 'hp' || k === 'mp' ? Math.round(v) : r4(v));
export function finalStats(def, lvl, rarity) { const s = itemStats(def, lvl, rarity), o = {}; for (const k of Object.keys(s)) o[k] = k === 'extra' ? Object.fromEntries(Object.entries(s.extra).map(([a, b]) => [a, round(b, a)])) : round(s[k], k); return o; }

// ------------------------------------------------------------------ registering an id in the game's tables (weapons.js)
const swingOf = (def) => { const s = def.setId && SET_BY[def.setId], F = FAMILIES[def.family]; return s ? s.trail : F ? F.colors : ['#ffffff', '#a8b8c8']; };
const elementOf = (def) => FAMILIES[def.family]?.el || null;
function register(id) {
  const P = parseId(id); if (!P) return null;
  const { def, lvl, g, rarity } = P, cat = def.cat, C = CATS[cat], st = finalStats(def, lvl, rarity);
  const common = { id, cat: true, catBase: def.base || def.id, base: def.id, model: def.id, baseId: makeId(def.id, lvl, 0), setId: def.setId, family: def.family, weaponType: isWeaponType(cat) || cat === 'shield' ? cat : null,
    armorSlot: C.armor ? cat : null, grade: g, rarity: OLD_RARITY[g], origin: OLD_RARITY[g], minLevel: lvl, ilvl: lvl, name: def.name, desc: def.desc,
    source: def.kind === 'set' ? L(`חלק מהסט ${SET_BY[def.setId].name.he}`, `A piece of the ${SET_BY[def.setId].name.en} set`) : def.cape ? CAPE_TEXT.note : L('פריט עצמאי, לא חלק מאף סט', 'A standalone item, not part of any set'), stats: st };
  if (isWeaponType(cat)) {
    const F = FAMILIES[def.family];
    const w = { ...common, style: C.style, tier: tierOf(lvl), dmg: st.power, speed: r4(C.tempo * (1 + st.atkSpeed)), reach: C.reach, crit: r4(CRIT_BASE + st.crit), element: elementOf(def),
      trail: swingOf(def), specials: [], special: F ? { type: 'family', he: `${F.passive.name.he}: ${F.passive.desc.he}`, en: `${F.passive.name.en}: ${F.passive.desc.en}` } : null,
      cleave: C.cleave + (lvl >= 100 ? 1 : 0) + (g === 2 ? 1 : 0), twoHanded: C.hands !== 1, shield: null, dps: r4(st.power * styleRate(C.style, C.tempo * (1 + st.atkSpeed))), suit: def.setId,
      skill: r4(st.power * styleRate(C.style, C.tempo) / RB * (C.skillK || 1)) }; // (skillK: online jobs' wand and staff, spec 6.1: a light basic blow, a full skill) // skill: the sword-equal blow skills ride (rpg.js skillBase), so a pair's quick light blows don't shrink its skills and a slow heavy one doesn't swell them
    Object.defineProperty(WEAPONS, id, { value: w, enumerable: !id.includes('@') && !g, configurable: true, writable: true });
    return w;
  }
  const bonus = {};
  if (st.defense) bonus.guard = st.defense; if (st.hp) bonus.hp = st.hp; if (st.power) bonus.power = st.power; if (st.crit) bonus.crit = st.crit;
  if (st.atkSpeed) bonus.atkSpeed = st.atkSpeed; if (st.move) bonus.speed = st.move; if (st.block) bonus.block = st.block;
  for (const [k, v] of Object.entries(st.extra)) bonus[k] = (bonus[k] || 0) + v;
  const x = { ...common, slot: HERO_SLOT[cat], kind: cat === 'shield' || C.hands === 'off' ? def.id : undefined, flight: cat === 'wings' && !def.cape ? !!def.flight : undefined, bonus, authBonus: {}, affixes: [], color: (SET_BY[def.setId]?.pal.m) || def.color || '#8a8070' }; // (hands 'off' besides the shield: online jobs' arrows, charm, focus)
  Object.defineProperty(GEAR, id, { value: x, enumerable: !id.includes('@') && !g, configurable: true, writable: true });
  return x;
}
export const resolve = (id) => (typeof id === 'string' && (WEAPONS[id] || GEAR[id])) || register(id);
for (const id of BASE_IDS) register(id); // the base identities (NORMAL, own level) are the enumerable entries of WEAPONS / GEAR

// ------------------------------------------------------------------ migration of old ids (spec 27; the round-33 default decision)
const AXEY = /axe|labrys|sagaris|club|hammer|maul|mace|pick|cleaver|bardiche|pelekys|hatchet/;
const SWORDY = /sword|blade|xiphos|spatha|rhomphaia|colossus|flamberge|falx|harpe|kopis|gladius|makhaira|sabre|saber|edge|fang/;
const PAIR_AXEY = /axe|sickle|claw|cleaver|hatchet|talon|scissor|labrys/;
function oldCat(w) {
  const key = `${w.base || ''} ${w.id || ''}`.toLowerCase();
  if (w.slot) return { head: 'helmet', body: 'body', feet: 'boots', back: 'wings', shield: 'shield' }[w.slot] || null;
  switch (w.style) {
    case 'blade': return AXEY.test(key) ? 'axe1' : 'sword1';
    case 'spear': return 'spear2';
    case 'twohand': return SWORDY.test(key) && !AXEY.test(key) ? 'sword2' : 'axe2';
    case 'polearm': return 'spear2';
    case 'dual': return PAIR_AXEY.test(key) ? 'dualAxe' : 'dualSword';
  }
  return 'sword1';
}
const FALLBACK = { axe1: 'sword1', sword2: 'sword1', axe2: 'sword2', spear2: 'sword2', dualSword: 'sword1', dualAxe: 'dualSword' };
// the base of a category whose level window holds lvl (a set piece first), or null
export function baseFor(cat, lvl) {
  let c = cat;
  while (c && UNLOCK[c] > lvl) c = FALLBACK[c];
  if (!c) c = 'sword1';
  const all = BASE_IDS.map((b) => BASES[b]).filter((d) => d.cat === c && !d.signature && !d.cape); // (an old save's wings stay wings, never a cape)
  const inWin = all.filter((d) => d.lvl <= lvl && d.max >= lvl);
  if (inWin.length) return (inWin.find((d) => d.kind === 'set') || inWin[0]).id;
  const below = all.filter((d) => d.lvl <= lvl).sort((a, b) => b.lvl - a.lvl);
  return (below[0] || all.sort((a, b) => a.lvl - b.lvl)[0])?.id || null;
}
// an id from any older save -> the id it is now (heirlooms and catalog ids unchanged; null: gone, e.g. an amulet)
export function migrateId(id, lookup) {
  if (typeof id !== 'string') return id;
  if (parseId(id)) return id;
  const raw = id.replace(/\^[el]$/, '');
  if (HEIRLOOMS[raw] || /^f~(keres_scythe|tide_trident)~/.test(id)) return id;
  const old = lookup?.(id); if (!old) return id; // (an item, a skill: not equipment)
  if (old.slot === 'neck') return null; // round 33: there is no amulet slot any more (spec 4: exactly four armour slots)
  if (old.outfit) return id;
  const cat = oldCat(old); if (!cat) return id;
  const lvl = clampL(old.ilvl || old.minLevel || 1), g = old.grade | 0, base = baseFor(cat, lvl);
  if (!base) return id;
  const out = makeId(base, lvl, g); resolve(out); return out;
}

// ------------------------------------------------------------------ what drops, what is sold (drops.js, shops.js)
// bases whose window holds lvl, of a kind: 'weapon' (the 7 weapon categories), 'gear' (armour and shields) or a category
export function basesAt(lvl, kind) {
  return BASE_IDS.map((b) => BASES[b]).filter((d) => d.lvl <= lvl && d.max >= lvl && !d.noRoll) // (noRoll: online jobs' arrows, never a drop: spec 6.2a)
    .filter((d) => !kind || (kind === 'weapon' ? isWeaponType(d.cat) : kind === 'gear' ? !isWeaponType(d.cat) : d.cat === kind));
}
export function rollItem(lvl, rnd = Math.random, { kind, grade = 0 } = {}) {
  const L0 = clampL(lvl), list = basesAt(L0, kind); if (!list.length) return null;
  const sets = list.filter((d) => d.kind === 'set'), solo = list.filter((d) => d.kind !== 'set');
  const pool = solo.length && rnd() < .3 ? solo : sets.length ? sets : solo; // (a standalone item about a third of the time)
  const d = pool[Math.floor(rnd() * pool.length)];
  const id = makeId(d.id, L0, grade); resolve(id); return id;
}

// ------------------------------------------------------------------ equipment rules (spec 4.1, 4.2, 27)
export function catOf(id) {
  const P = parseId(id); if (P) return P.def.cat;
  if (typeof id !== 'string') return null;
  const raw = id.replace(/\^[el]$/, ''), h = HEIRLOOMS[raw] || (/^f~keres_scythe~/.test(id) ? HEIRLOOMS.keres_scythe : /^f~tide_trident~/.test(id) ? HEIRLOOMS.tide_trident : null);
  if (h) return h.cat;
  const w = WEAPONS[id]; if (w) return oldCat(w);
  const x = GEAR[id]; if (x) return oldCat(x);
  return null;
}
export const familyOf = (id) => { const P = parseId(id); if (P) return P.def.family; const raw = typeof id === 'string' ? id.replace(/\^[el]$/, '') : ''; return (HEIRLOOMS[raw] || (/^f~keres_scythe~/.test(id) ? HEIRLOOMS.keres_scythe : /^f~tide_trident~/.test(id) ? HEIRLOOMS.tide_trident : null))?.family || null; };
// may the off-hand hold a shield next to this main-hand weapon, for a hero of this level?
// BETA ONLINE JOBS (spec 6.1): the off hand takes one kind per job. A weapon category with `offs` (online/jobarms.js: bow ->
// arrows, dagger -> charm, wand -> focus) takes only those; an off-hand category other than the shield goes only beside one
// that lists it. offId (the piece asked about, or none: may the slot be used at all). The campaign has neither: unchanged.
export function shieldAllowed(weaponId, level, offId = null) {
  const c = catOf(weaponId), oc = offId ? catOf(offId) : null;
  if (CATS[c]?.offs || (oc && oc !== 'shield' && CATS[oc]?.hands === 'off')) return !!CATS[c]?.offs && (!oc || CATS[c].offs.includes(oc));
  if (!c) return true;
  const C = CATS[c]; if (!C) return true;
  if (C.hands === 1) return true;
  if (C.hands === 2) return level >= MASTERY_LEVEL;
  return false; // a pair
}
// the stance of the hands: 'one' (one-hander, maybe a shield), 'two' (both hands on a two-hander), 'mastery' (a two-hander in one
// hand with a shield, level 100+), 'pair' (a matched pair)
export function stanceOf(weaponId, shieldId, level) {
  const c = catOf(weaponId), C = CATS[c];
  if (!C || C.hands === 1 || C.offs?.length) return 'one'; // (online jobs: a bow with its arrows, a wand with its focus: the off hand counts) // (BETA ONLINE JOBS phase 7: offs.length, so the staff's empty list is two hands, like every two-hander: setCounts)
  if (C.hands === 'pair') return 'pair';
  return shieldId && level >= MASTERY_LEVEL ? 'mastery' : 'two';
}
export const EQUIP_TEXT = {
  needLevel: (n) => L(`נדרשת רמה ${n}`, `Requires level ${n}`),
  noShieldTwo: L('נשק דו־ידני תופס את שתי הידיים: אין מקום למגן עד שליטה בנשק כבד ברמה 100.', 'A two-handed weapon takes both hands: no room for a shield until heavy-weapon mastery at level 100.'),
  noShieldPair: L('זוג להבים תופס את שתי הידיים: אין מקום למגן.', 'A pair of blades takes both hands: no room for a shield.'),
  shieldStowed: L('המגן הוסר: הנשק הזה תופס את שתי הידיים.', 'The shield is put away: this weapon takes both hands.'),
  shieldBack: L('המגן חזר ליד השמאל.', 'The shield is back on your left arm.'),
  mastery: L('שליטה בנשק כבד: הנשק הדו־ידני ביד אחת והמגן בשנייה (85% נזק נשק).', 'Heavy-weapon mastery: the two-hander in one hand, the shield in the other (85% weapon damage).'),
};

// ------------------------------------------------------------------ set counting (spec 9.1): six slots, actual occupancy
// hero: { weapon, gear: {head, body, feet, back, shield}, level }. Returns { setId: count } and the stance
export function setCounts(hero) {
  const n = {}, add = (sid, k = 1) => { if (sid) n[sid] = (n[sid] || 0) + k; };
  const G = hero.gear || {};
  for (const k of ['head', 'body', 'feet', 'back']) add(parseId(G[k])?.def.setId);
  const main = parseId(hero.weapon), stance = stanceOf(hero.weapon, G.shield, hero.level || 1);
  if (main) add(main.def.setId, stance === 'two' || stance === 'pair' ? 2 : 1); // a two-hander (or a pair) holds both hands: two contributions
  if (stance === 'one' || stance === 'mastery') add(parseId(G.shield)?.def.setId); // the off-hand: a shield of the same set
  for (const sid of Object.keys(n)) n[sid] = Math.min(n[sid], setMax(SET_BY[sid]));
  return { counts: n, stance };
}
// spec contract (UI): every set with at least one piece worn
export function setStatus(hero) {
  const { counts } = setCounts(hero), out = [];
  for (const s of SETS) {
    const count = counts[s.id] | 0; if (!count) continue;
    const max = setMax(s), stage = setStage(s, count), nextAt = count < max ? Math.max(2, count + 1) : null;
    const P = SET_PASSIVES[s.id];
    out.push({ setId: s.id, name: s.name, count, max, pct: setPct(s, count), stage, stageName: ROMAN[stage], nextAt, nextPct: nextAt ? setPct(s, nextAt) : null, nextStage: nextAt ? setStage(s, nextAt) : null,
      package: setPackage(s), active: scalePkg(setPackage(s), setPct(s, count)),
      passive: { name: P.name, desc: setPassiveText(s.id, Math.max(1, stage)), stage, nextDesc: nextAt ? setPassiveText(s.id, setStage(s, nextAt)) : null } });
  }
  return out;
}
const scalePkg = (p, k) => ({ power: r4(p.power * k), atkSpeed: r4(p.atkSpeed * k), crit: r4(p.crit * k), defense: r4(p.defense * k) });

// ------------------------------------------------------------------ steps 4-6 and 8 for the hero (rpg.js reads this)
export const CAPS = { crit: .85, atkSpeed: .75, guard: .6, move: .6, block: .95 }; // final combat caps (spec 7.1, 7.2.8)
// everything the worn equipment gives, cached by the caller on the equipment key: { bonus (summed gear), set: {pkg, passives},
// family, stance, gripMul, cat }
export function heroEquip(hero) {
  const G = hero.gear || {}, lvl = hero.level || 1;
  const b = { guard: 0, hp: 0, mp: 0, power: 0, crit: 0, mpRegen: 0, hpRegen: 0, exp: 0, lifesteal: 0, speed: 0, block: 0, atkSpeed: 0 };
  const { counts, stance } = setCounts(hero);
  const offOk = stance === 'one' || stance === 'mastery';
  for (const [k, id] of Object.entries(G)) {
    if (!id || !GEAR[id]) continue;
    if (k === 'shield' && !offOk) continue; // a shield the hands cannot hold gives nothing (a two-hander under 100, a pair)
    for (const [s, v] of Object.entries(GEAR[id].bonus || {})) b[s] = (b[s] || 0) + v;
  }
  const pkg = { power: 0, atkSpeed: 0, crit: 0, defense: 0 }, passives = [];
  for (const s of SETS) {
    const c = counts[s.id] | 0; if (c < 2) continue;
    const k = setPct(s, c), p = setPackage(s);
    for (const key of Object.keys(pkg)) pkg[key] += p[key] * k;
    passives.push({ setId: s.id, stage: setStage(s, c), count: c, kind: SET_PASSIVES[s.id].kind });
  }
  const cat = catOf(hero.weapon), fam = familyOf(hero.weapon), F = FAMILIES[fam]?.passive;
  const famStatic = { crit: F?.kind === 'trueedge' ? F.crit : F?.kind === 'keen' ? F.crit : 0 };
  return { bonus: b, pkg, passives, stance, gripMul: stance === 'mastery' ? MASTERY_DMG : 1, cat, family: fam, famStatic, counts };
}
// the weapon as it is held: style by the stance, damage by the grip (step 4), attack rate with every attack-speed contribution
// skill: the sword-equal blow in the stance she holds it (rpg.js skillBase)
export function effectiveWeapon(w, eq, stats) {
  if (!w) return w;
  const C = CATS[eq.cat];
  let style = w.style;
  if (eq.stance === 'mastery' && C?.mastery) style = C.mastery;
  const as = Math.min(CAPS.atkSpeed, stats.atkSpeed || 0); // armour, wings, boots and the set package (the weapon's own is in w.speed already)
  return { ...w, style, dmg: Math.round(w.dmg * eq.gripMul * 10) / 10, skill: w.cat && C?.tempo ? r4(w.dmg * eq.gripMul * styleRate(style, C.tempo) / RB * (C.skillK || 1)) : undefined, speed: r4(w.speed * (1 + as)), stance: eq.stance, gripMul: eq.gripMul, baseStyle: w.style };
}

// ------------------------------------------------------------------ itemInfo (the UI contract)
const HEIR_STYLE_CAT = { blade: 'sword1', spear: 'spear2', twohand: 'sword2', polearm: 'spear2', dual: 'dualSword' };
export function itemInfo(id) {
  const P = parseId(id);
  if (P) {
    const { def, lvl, rarity } = P, s = def.setId && SET_BY[def.setId], F = FAMILIES[def.family], st = finalStats(def, lvl, rarity), C = CATS[def.cat];
    const wt = isWeaponType(def.cat) || def.cat === 'shield' || C.hands === 'off' ? def.cat : null;
    return { id, baseId: def.id, name: def.name, desc: def.desc, rarity, reqLevel: lvl, slot: C.armor ? def.cat : 'weapon', weaponType: wt, setId: def.setId || null, setName: s ? s.name : null,
      family: def.family || null, familyName: F ? F.name : null, familyPassive: F ? { name: F.passive.name, desc: F.passive.desc } : null,
      stats: { power: st.power, atkSpeed: st.atkSpeed, crit: st.crit, defense: st.defense, hp: st.hp, move: st.move }, block: st.block, extra: st.extra,
      powerKind: isWeaponType(def.cat) ? 'damage' : st.power != null ? 'percent' : null, tempo: C.tempo ?? null, reach: C.reach ?? null,
      handling: wt ? HANDLING[wt] : null, pair: C.hands === 'pair', hands: C.hands ?? null, shieldWith: C.hands === 1 ? 'yes' : C.hands === 2 ? 'mastery' : C.hands === 'pair' ? 'no' : null,
      // addendum 7: the complete loadout's numbers so a comparison can be loadout to loadout (expected damage a second at her power 1)
      loadout: isWeaponType(def.cat) ? { dps: loadoutDps(def, st), dpsMastery: C.mastery ? loadoutDps(def, st, 'mastery') : null, hitsPerCombo: STYLE_T[C.style].reduce((n, x) => n + x[3].length, 0), procMul: PROC_MUL[def.cat], procMulMastery: C.mastery ? procMul(def.cat, 'mastery') : null, masteryLevel: C.hands === 2 ? MASTERY_LEVEL : null, masteryDmg: C.hands === 2 ? MASTERY_DMG : null } : null,
      standalone: def.kind === 'standalone', cape: !!def.cape, flight: def.cat === 'wings' && !def.cape ? !!def.flight : null, signature: def.signature || null, levelWindow: [def.lvl, def.max], icon: id };
  }
  if (typeof id !== 'string') return null;
  const w = WEAPONS[id], x = GEAR[id]; const it = w || x; if (!it) return null;
  const raw = id.replace(/\^[el]$/, ''), heir = HEIRLOOMS[raw] || (/^f~keres_scythe~/.test(id) ? HEIRLOOMS.keres_scythe : /^f~tide_trident~/.test(id) ? HEIRLOOMS.tide_trident : null);
  const cat = heir?.cat || (w ? HEIR_STYLE_CAT[w.style] : SLOT_OF_HERO[x.slot]);
  const F = FAMILIES[heir?.family], rr = it.grade === 2 ? 'legendary' : it.grade === 1 ? 'epic' : 'normal', b = x?.bonus || {};
  return { id, baseId: raw, name: it.name, desc: it.desc, rarity: rr, reqLevel: it.ilvl || it.minLevel || 1, slot: w || x.slot === 'shield' ? 'weapon' : cat, weaponType: w || x.slot === 'shield' ? cat : null,
    setId: null, setName: null, family: heir?.family || null, familyName: F ? F.name : null, familyPassive: F ? { name: F.passive.name, desc: F.passive.desc } : null,
    stats: w ? { power: w.dmg, atkSpeed: r4(w.speed / (CATS[cat]?.tempo || 1) - 1), crit: r4(Math.max(0, (w.crit || 0) - CRIT_BASE)), defense: null, hp: null, move: null }
      : { power: b.power ?? null, atkSpeed: null, crit: b.crit ?? null, defense: b.guard ?? null, hp: b.hp ?? null, move: b.speed ?? null },
    block: b.block ?? null, extra: {}, powerKind: w ? 'damage' : b.power != null ? 'percent' : null, tempo: CATS[cat]?.tempo ?? null, reach: w?.reach ?? null,
    handling: HANDLING[cat] || null, standalone: false, heirloom: true, levelWindow: null, icon: id };
}

// ------------------------------------------------------------------ legendary impacts (spec 11): one configured effect per weapon identity
// motif by family, shape by category, palette by the identity, a variant number so two identities of one family differ
const MOTIF = { hunter: 'claw', cyclopean: 'quake', argive: 'phalanx', spartan: 'lambda', dawn: 'sunrise', serpent: 'venom', olympian: 'laurel', sea: 'wave', artemis: 'moon',
  helios: 'solar', styx: 'souls', titan: 'chains', athena: 'owl', zeus: 'lightning', nemesis: 'scales', tartarus: 'abyss', chaos: 'void' };
const SHAPE = { sword1: 'arc', axe1: 'cleave', sword2: 'crescent', axe2: 'crater', spear2: 'pierce', dualSword: 'cross', dualAxe: 'twinCleave' };
export const IMPACTS = {};
for (const d of Object.values(BASES)) {
  if (!isWeaponType(d.cat)) continue;
  const s = d.setId && SET_BY[d.setId], F = FAMILIES[d.family], pal = s ? [s.pal.g, s.pal.a, s.pal.mL] : [F.colors[0], F.colors[1], '#ffffff'];
  const h = [...d.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  IMPACTS[d.id] = { id: d.id, motif: d.signature === 'apeiron' ? 'rift' : d.signature === 'ananke' ? 'spearOfFate' : MOTIF[d.family], shape: d.signature ? (d.signature === 'apeiron' ? 'crescent' : 'pierce') : SHAPE[d.cat],
    colors: pal, variant: h % 4, spin: (h >> 3) % 2 ? 1 : -1, scale: .8 + Math.min(1, d.lvl / 300) * .7 };
}
export const impactFor = (id) => { const P = parseId(id); return P && P.g === 2 ? IMPACTS[P.def.id] || null : null; };

// ------------------------------------------------------------------ hook into weapons.js (resolution and migration)
CATALOG.resolve = (id) => (parseId(id) ? resolve(id) : null);
CATALOG.migrateId = (id) => migrateId(id, (x) => CATALOG.legacy(x));
CATALOG.rollItem = rollItem;
CATALOG.catOf = catOf;
CATALOG.shieldAllowed = shieldAllowed;
