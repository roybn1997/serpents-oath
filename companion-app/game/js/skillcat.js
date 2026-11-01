// Skill rework (v31, Roy's skill-rework spec): the Path of Ascent catalog. 96 skills = 72 main-path skills (skill_001-072),
// 12 optional side skills (skill_073-084) and 12 ultimates (skill_085-096, levels 35 ... 299), authored as pure data in twelve
// segment files (js/skilldata/segNN.js, one per ultimate) and assembled here:
//
//  * CATALOG / CAT: every entry, normalized (seg, node, unit conversions) in one list and by id.
//  * the unit conversion from the spec's units to the game's (one place, docs/skills-rework.md "Units"):
//      BEU (Basic-attack Equivalent Unit) -> the game's skill power: power = beu x tierK(level). tierK is the SAME rule the old
//        skills use (weapons.js: +6% per level a skill unlocks at) but capped at level 30 (BEU_TIER_CAP): past 30 the weapon's
//        own damage (rpg.js skillBase, the weapon ladder) carries the growth, so a level-299 skill is not 18x a level-1 one.
//      cost units -> mana: round(cost x (1 + (level - 1) x .04)) (an early skill costs about what the old ones of its level
//        cost; a late one stays a fifth to a third of the pool, pacing.js maxMp 50 + 8/level). Ultimates cost ULT_MANA.
//      seconds and metres are the game's seconds and metres (1:1).
//  * the tree: one new branch, the Path of Ascent ('path'). Each segment of 8 skills sits on 3 rows (catNodes):
//      m1 m2 m3 [side]        row 3k     (m1 needs the previous segment's m6; skill_001 is the branch's root)
//      m6 m5 m4 [side]        row 3k+1   (a snake: m1 -> m2 -> m3 -> m4 -> m5 -> m6)
//         ULT                 row 3k+2   (needs m6; ultimates close a segment and nothing needs them)
//    The side skill hangs off m4 when m4's level is at or under its own, else off m3; nothing needs it (optional).
//  * toSkill(entry): the SKILLS record of a READY entry (weapons.js merges those): the old fields every screen reads (mana,
//    cd, unlock, power, radius, anim, dur, name, desc, source...) plus `cat` (the entry itself) and `prof` (damageProfile).
//    An entry that is not ready (its behaviour is still a placeholder) is shown in the tree, locked ("soon"), never taught.
//  * TEMPLE_PRICE(unlock): the temples' existing price rule (shops.js), shared.
//  * validateCatalog(): ids unique and new, 12 ultimates at exactly their levels, every prerequisite resolves, no cycles,
//    a path from the root to every ultimate, levels never decrease along a prerequisite, every number present.
import S01 from './skilldata/seg01.js';
import S02 from './skilldata/seg02.js';
import S03 from './skilldata/seg03.js';
import S04 from './skilldata/seg04.js';
import S05 from './skilldata/seg05.js';
import S06 from './skilldata/seg06.js';
import S07 from './skilldata/seg07.js';
import S08 from './skilldata/seg08.js';
import S09 from './skilldata/seg09.js';
import S10 from './skilldata/seg10.js';
import S11 from './skilldata/seg11.js';
import S12 from './skilldata/seg12.js';

const L = (he, en) => ({ he, en });
export const SEGMENTS = [S01, S02, S03, S04, S05, S06, S07, S08, S09, S10, S11, S12];
export const ULT_LEVELS = [35, 60, 80, 105, 130, 150, 180, 205, 230, 250, 275, 299];
export const ULT_TIER_CD = { 1: 90, 2: 100, 3: 110, 4: 120, 5: 150 }; // seconds (the spec's "90 s-equivalent" and up by tier)
export const ULT_TIER_NAME = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
export const ULT_MANA = 250; // (weapons.js ULT_MANA: every ultimate costs the same)
export const BEU_TIER_CAP = 30;
export const ULT_BOSS_TAKEN = .8; // a boss takes 80% of an ultimate's blows (spectacular, never a one-button kill)
export const tierK = (lvl) => 1 + (Math.min(lvl || 1, BEU_TIER_CAP) - 1) * .06;
export const manaFor = (e) => (e.slot === 'ult' ? ULT_MANA : Math.round(e.cost * (1 + ((e.lvl || 1) - 1) * .04)));
export const TEMPLE_PRICE = (unlock) => Math.round(30 * (40 + (unlock || 1) * 22) / 50) * 50; // (shops.js skillCost)
export const catPrice = (e) => Math.round(TEMPLE_PRICE(e.lvl) * (e.slot === 'ult' ? 1.5 : 1) / 50) * 50;

export const PATH_BRANCH = { id: 'path', name: L('שביל העלייה', 'Path of Ascent'), color: '#ffcf5a', icon: 'star', segs: 12,
  blurb: L('96 מיומנויות לאורך כל המסע: שש בכל קטע, מיומנות צד אופציונלית, וכוח עליון שסוגר כל קטע.', 'Ninety-six skills across the whole journey: six per stretch, an optional side skill, and an ultimate closing each stretch.') };

// element -> [colour, icon field] (the skill's light in the tree, on the bar and in its effects)
export const EL = {
  earth: ['#e0b070', '#2a1c10'], fire: ['#ff8a3a', '#2e0e06'], poison: ['#8fe05a', '#0e2410'], physical: ['#f0d8a8', '#2a2018'],
  light: ['#ffe9a0', '#2a2410'], ice: ['#bff0ff', '#0c1e2c'], lightning: ['#bfe4ff', '#10183a'], water: ['#5ad8e0', '#062428'],
  wind: ['#d8f4ff', '#14242c'], void: ['#b08aff', '#160c2a'], shadow: ['#9a8ad0', '#100c1c'], chaos: ['#ff5ad8', '#24081e'],
  time: ['#e8c070', '#241a0c'], dragon: ['#ff6a4a', '#2a0a08'], celestial: ['#fff2c0', '#141838'], underworld: ['#ff4a3a', '#1a0606'],
  primordial: ['#ffd24a', '#1a1030'],
};
// the pose families every catalog anim maps onto (models.js poses that exist)
const POSES = new Set(['aegis', 'dash', 'ult', 'summon', 'rise', 'fate', 'cast', 'heal', 'thunder', 'slam', 'quake', 'gaze', 'charge', 'smash', 'fireball', 'sweep', 'throw', 'whirl', 'flurry', 'wave', 'prophecy', 'fog']);

// ------------------------------------------------------------------------------------------------ assembly
const SLOT_ORDER = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'side', 'ult'];
const PLACE = { m1: [0, 0], m2: [1, 0], m3: [2, 0], m4: [2, 1], m5: [1, 1], m6: [0, 1], ult: [1, 2] };
export const CATALOG = [];
export const CAT = {};
SEGMENTS.forEach((seg, k) => {
  const by = Object.fromEntries(seg.map((e) => [e.slot, e])), R = k * 3;
  for (const e of [...seg].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))) {
    const x = { ...e, seg: k + 1 };
    let col, row, req;
    if (e.slot === 'side') {
      const viaM4 = by.m4 && by.m4.lvl <= e.lvl, par = viaM4 ? by.m4 : by.m3;
      col = 3; row = R + (viaM4 ? 1 : 0); req = [par.id];
    } else {
      [col, row] = PLACE[e.slot]; row += R;
      const prev = { m1: k ? SEGMENTS[k - 1].find((q) => q.slot === 'm6')?.id : null, m2: by.m1?.id, m3: by.m2?.id, m4: by.m3?.id, m5: by.m4?.id, m6: by.m5?.id, ult: by.m6?.id }[e.slot];
      req = prev ? [prev] : [];
    }
    x.node = { id: e.id, branch: 'path', col, row, req, seg: k + 1, slot: e.slot, ult: e.slot === 'ult', start: e.id === 'skill_001', cat: true, soon: !e.ready };
    x.mana = manaFor(e);
    x.cdS = e.slot === 'ult' ? (e.cd || ULT_TIER_CD[e.ult]) : e.cd;
    x.k = tierK(e.lvl);
    x.price = catPrice(e);
    CATALOG.push(x); CAT[e.id] = x;
  }
});
export const catNodes = () => CATALOG.map((e) => e.node);
export const isCatalog = (id) => !!CAT[id];
export const catSeg = (n) => CATALOG.filter((e) => e.seg === n);

// ------------------------------------------------------------------------------------------------ damage numbers
// one hit spec -> how many times one foe can take it in a full connect (n pulses; a conditional branch counts its larger arm)
const hitN = (h) => Math.max(1, h.n | 0);
// the declared budget in BEU per fully connected target, recomputed from the hits (the test compares it to `budget`)
export function budgetOf(e, armored = false) {
  let sum = 0; const alt = (e.hits || []).filter((h) => h.cond === 'alt');
  for (const h of e.hits || []) if (!['alt', 'others', armored ? '' : 'armored'].includes(h.cond)) sum += h.beu * hitN(h);
  if (!sum && alt.length) sum = alt.reduce((a, h) => a + h.beu * hitN(h), 0);
  if (e.dot) sum += e.dot.beu * e.dot.n * (e.dot.rule === 'stack' ? (e.dot.apply || 1) : 1);
  return +sum.toFixed(3);
}
// the profile every screen (tree, tooltip, tests) reads; units: the weapon's skill base (rpg.js skillBase) x level power,
// i.e. the same units as an old skill's `power` (beu x tierK)
export function catProfile(e) {
  const k = e.k ?? tierK(e.lvl), hits = (e.hits || []).filter((h) => h.cond !== 'others' && h.cond !== 'armored' && h.cond !== 'alt');
  const count = hits.reduce((a, h) => a + hitN(h), 0) + (e.dot ? e.dot.n * (e.dot.rule === 'stack' ? (e.dot.apply || 1) : 1) : 0);
  const per = [...hits.map((h) => h.beu), ...(e.dot ? [e.dot.beu] : [])];
  const maxHit = per.length ? Math.max(...per) * k : 0;
  if (!count) return { kind: 'utility', hitCount: 0, damagePerHit: 0, totalDamage: 0, duration: e.buff?.dur || e.dur, cat: true };
  return { kind: 'phased', hitCount: count, damagePerHit: +(maxHit).toFixed(3), maxHit: +maxHit.toFixed(3), totalDamage: +(e.budget * k).toFixed(3), budget: e.budget, budgetMax: e.budgetMax || e.budget,
    duration: e.dur, tickInterval: e.dot ? e.dot.every : (hits.find((h) => h.n > 1)?.every ?? null), phases: hits.map((h) => ({ phase: h.phase || 'hit', at: h.at, n: hitN(h), every: h.every || 0, beu: h.beu, power: +(h.beu * k).toFixed(3) })), dot: e.dot || null, cat: true };
}
// how a pair of blades shows it (skilltree.js dualPattern): weapon work strikes with one blade, or with both in turn
export function catDual(e) {
  const weapon = (e.tags || []).includes('physical') && ['melee', 'cone', 'around', 'dash', 'leap'].includes(e.tgt);
  if (!weapon || !(e.hits || []).length) return 'none';
  if (e.slot === 'ult') return 'multi';
  return (e.hits || []).some((h) => hitN(h) > 1) ? 'alt' : 'one';
}

// ------------------------------------------------------------------------------------------------ SKILLS record
const SOURCE = (e) => (e.slot === 'ult'
  ? L(`כל כוהן במקדש, החל מרמה ${e.lvl}, אחרי ${CAT[e.node.req[0]]?.name.he || ''}`, `Any temple priest, from level ${e.lvl}, after ${CAT[e.node.req[0]]?.name.en || ''}`)
  : L(`כל כוהן במקדש, החל מרמה ${e.lvl}`, `Any temple priest, from level ${e.lvl}`));
export function toSkill(e) {
  const [color, bg] = EL[e.el] || EL.physical, k = e.k, prof = catProfile(e);
  const firstHit = (e.hits || []).find((h) => !h.cond || h.cond === 'full' || h.cond === 'counter');
  const s = {
    id: e.id, color, bg, mana: e.mana, cd: e.cdS, needs: null, anim: POSES.has(e.anim) ? e.anim : 'cast', dur: e.dur || .6, unlock: e.lvl,
    name: e.name, desc: e.desc, source: SOURCE(e), cat: e, catalog: true, seg: e.seg,
    power: +((firstHit?.beu || 0) * k).toFixed(3), radius: e.radius || 0, range: e.range || 0, aim: Math.max(8, e.range || 0),
    move: 0, // (a dash moves her itself, skillcore.js: never the Player's skillMove)
    prof, dualPattern: catDual(e), grade: Math.min(5, 1 + Math.floor((e.lvl - 1) / 60)), tier: k, el: e.el,
    onMove: !!e.onMove, carry: !!e.carry, ready: !!e.ready,
  };
  if (e.slot === 'ult') { s.ult = true; s.rank = +(e.lvl / 10).toFixed(1); s.ultTier = e.ult; }
  return s;
}

// ------------------------------------------------------------------------------------------------ validation
export function validateCatalog(existingIds = []) {
  const bad = [], ids = new Set(), have = new Set(existingIds);
  for (const e of CATALOG) {
    if (ids.has(e.id)) bad.push('twice: ' + e.id); ids.add(e.id);
    if (have.has(e.id) && !CAT[e.id]) bad.push('collides with an existing skill: ' + e.id);
    if (!/^skill_\d{3}$/.test(e.id)) bad.push('bad id ' + e.id);
    for (const f of ['lvl', 'name', 'desc', 'el', 'tgt', 'anim', 'vfx', 'sfx', 'icon']) if (e[f] == null) bad.push(`${e.id}: no ${f}`);
    if (!e.name?.he || !e.name?.en || !e.desc?.he || !e.desc?.en) bad.push(e.id + ': name/desc needs he and en');
    if (!(e.cdS > 0)) bad.push(e.id + ': no cooldown');
    if (!(e.mana > 0)) bad.push(e.id + ': no mana');
    if (e.slot !== 'ult' && !(e.cost > 0)) bad.push(e.id + ': no cost');
    if (Math.abs(budgetOf(e) - e.budget) > .011 && !e.budgetMax) bad.push(`${e.id}: hits add up to ${budgetOf(e)} BEU, budget says ${e.budget}`);
    if (e.budgetMax && Math.abs(budgetOf(e, true) - e.budgetMax) > .011) bad.push(`${e.id}: hits add up to ${budgetOf(e, true)} BEU, budgetMax says ${e.budgetMax}`);
    if (e.lvl < 1 || e.lvl > 299) bad.push(e.id + ': level out of range');
  }
  const n = (lo, hi) => CATALOG.filter((e) => +e.id.slice(6) >= lo && +e.id.slice(6) <= hi);
  if (CATALOG.length !== 96) bad.push('catalog has ' + CATALOG.length + ' skills, not 96');
  if (n(1, 72).some((e) => !/^m[1-6]$/.test(e.slot))) bad.push('skill_001-072 must be main-path skills');
  if (n(73, 84).some((e) => e.slot !== 'side')) bad.push('skill_073-084 must be side skills');
  const ults = CATALOG.filter((e) => e.slot === 'ult');
  if (ults.length !== 12) bad.push(ults.length + ' ultimates, not 12');
  ults.forEach((u, i) => { if (u.id !== 'skill_' + String(85 + i).padStart(3, '0')) bad.push('ultimate order: ' + u.id); if (u.lvl !== ULT_LEVELS[i]) bad.push(`${u.id} at level ${u.lvl}, not ${ULT_LEVELS[i]}`); });
  // prerequisites: resolve, never a later level, no cycle, the root reaches every ultimate, nothing needs an ultimate
  for (const e of CATALOG) for (const r of e.node.req) {
    if (!CAT[r]) { bad.push(`${e.id} needs unknown ${r}`); continue; }
    if (CAT[r].lvl > e.lvl) bad.push(`${e.id} (lv ${e.lvl}) after ${r} (lv ${CAT[r].lvl})`);
    if (CAT[r].slot === 'ult') bad.push(`${e.id} needs an ultimate (${r})`);
  }
  const state = {}; const cyc = (id) => { if (state[id] === 1) return true; if (state[id] === 2) return false; state[id] = 1; const c = (CAT[id]?.node.req || []).some(cyc); state[id] = 2; return c; };
  for (const e of CATALOG) if (cyc(e.id)) { bad.push('cycle through ' + e.id); break; }
  for (const u of ults) { let id = u.id, steps = 0; const seen = new Set(); while (id && CAT[id]?.node.req.length && steps++ < 200) { if (seen.has(id)) break; seen.add(id); id = CAT[id].node.req[0]; } if (id !== 'skill_001') bad.push(u.id + ': no path from skill_001'); }
  const pos = new Set(); for (const e of CATALOG) { const p = e.node.col + ',' + e.node.row; if (pos.has(p)) bad.push('two nodes at ' + p); pos.add(p); }
  return bad;
}
