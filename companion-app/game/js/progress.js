// Round 28 (Roy): the shared numbers of the 1-100 progression, so every system (items, monsters, drops, story) reads one source.
// Read /home/claude/r28/SPEC.md (copied to the repo root as PROGRESSION.md) for the whole design.
// Round 30 (Roy): levels run to 300. 1..100 keep the round-28 numbers; past LVL_KNEE every ladder grows on a gentler slope
// (LVL_GROWTH_HI) so the numbers stay readable at 300 and a level-150 legendary still out-hits an on-level Normal up to ~L170.
export const MAX_LEVEL = 300;
export const LVL_GROWTH = 1.07; // per level up to LVL_KNEE: what a level-matched weapon is worth, and what a monster's hide is worth
export const LVL_GROWTH_HI = 1.015, LVL_KNEE = 100; // per level past the knee
// the ladder itself: how much a level-L item / hide is worth over level 1 (1.07^(L-1) up to the knee, then 1.015 a level)
export const lvlGrowth = (L) => { const l = Math.max(1, Math.min(MAX_LEVEL, L)); return Math.pow(LVL_GROWTH, Math.min(l, LVL_KNEE) - 1) * Math.pow(LVL_GROWTH_HI, Math.max(0, l - LVL_KNEE)); };
// the distance between two item levels in "round-28 levels" (7% steps): 1 level a level up to the knee, ~.22 a level past it
// (rpg.js weaponEdge counts how far under a monster a weapon is with this, so the blunting follows the ladder's own slope)
export const ladderGap = (from, to) => Math.log(lvlGrowth(to) / lvlGrowth(from)) / Math.log(LVL_GROWTH);

// the three grades every weapon and every piece of gear exists in
export const GRADES = [
  { id: 'normal', rarity: 'common', mul: 1, stats: 1, specials: 0, he: '', en: '' },
  // round 33 (Roy's MASTER spec 7): NORMAL / EPIC / LEGENDARY at x1.35 / x1.90 power (catalog.js RARITY_MULT has the full table:
  // attack speed x1.15 / x1.45, crit x1.10 / x1.35). These rows serve the story's keepsakes and the old ids still in flight.
  { id: 'epic', rarity: 'epic', mul: 1.35, stats: 1.35, specials: 1, he: 'אפי', en: 'Epic' },
  { id: 'legendary', rarity: 'legendary', mul: 1.9, stats: 1.9, specials: 2, he: 'אגדי', en: 'Legendary' },
];
export const gradeIndex = (rarity) => (rarity === 'legendary' ? 2 : rarity === 'epic' ? 1 : 0); // 'rare' (round 1-27) folds into normal

// a normal-grade, speed-1 one-hander of item level L (other styles scale from it by their own factor, weapons.js)
export const weaponDmgRef = (L) => 11 * lvlGrowth(L);
// the hero's own growth (rpg.js statsFor): power 1 + .06 (L-1); a level-matched Normal weapon at L must kill a level-L monster
// in the same time at every level, so a monster's hit points grow as weapon x power:
export const monsterHpMul = (L) => lvlGrowth(L) * (1 + .06 * Math.max(0, Math.min(MAX_LEVEL, L) - 1));

// how many levels each chapter's wild monsters and story fights are fixed at (the player is NOT followed up any more:
// arriving under-levelled hurts). Index: g.stage (chapters finished). Entries past ch4 are the (not yet built) later chapters;
// round 30 carries the table on to the level-300 cap (stage 7 on: placeholders for chapters not yet written)
export const CHAPTER_LEVEL = [1, 3, 6, 10, 14, 30, 44, 60, 80, 100, 125, 150, 185, 225, 265, 300];
