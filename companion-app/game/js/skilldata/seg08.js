// Skill rework (v31), segment 8 of the Path of Ascent: levels 181-205, ultimate VIII (Hydra's Black Sun). Data only; see seg01.js
// for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg08.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_043', slot: 'm1', lvl: 181, name: L('חבטת מרעיד האדמה', 'Earthshaker Cleave'),
    desc: L('חבטה בשני חלקים: קודם מכתש הדוק ומכת הלם קרובה, ואז שבר משונן רחב שמתפרץ החוצה. אויב שעומד נכון סופג את שניהם.', 'A two-part slam: first a tight crater and a close shock, then a broad jagged fracture surging outward. A foe standing right takes both.'),
    tags: ['physical', 'aoe', 'broad'], el: 'earth', cd: 12, cost: 32,
    tgt: 'cone', range: 7, arc: 1.4, cap: 8, los: true, anim: 'smash', dur: .9,
    hits: [{ at: .45, beu: .45, r: 2.2, phase: 'shock' }, { at: .7, beu: .8, phase: 'fracture' }],
    budget: 1.25, vfx: 'vfx_043', sfx: 'sfx_043', icon: 'icon_043', ready: true,
  },
  {
    id: 'skill_044', slot: 'm2', lvl: 185, name: L('ירית הבקע', 'Rift Shot'),
    desc: L('קרע מלבני קטן נפתח לצדך והבריח עובר דרך שני בקעים זעירים: פגיעה, ואם האויב כבר מואט או מרותק, אדווה קטנה פוגעת גם במי שסביבו.', 'A small rectangular tear opens beside you and the bolt passes through two micro-rifts: a hit, and if the foe is already slowed or rooted a small ripple strikes those around it.'),
    tags: ['magic', 'void', 'projectile', 'combo'], el: 'void', cd: 8, cost: 32,
    tgt: 'proj', range: 15, speed: 30, radius: 2.4, cap: 6, los: true, anim: 'throw', dur: .6,
    hits: [{ at: .3, beu: 1.65, travel: true }, { at: .3, beu: .3, travel: true, cond: 'others' }],
    budget: 1.65, vfx: 'vfx_044', sfx: 'sfx_044', icon: 'icon_044', ready: true,
  },
  {
    id: 'skill_045', slot: 'm3', lvl: 189, name: L('התארכות הזמן', 'Time Dilation'),
    desc: L('הילת שעון מארד מתפצלת לבבואות: 5 שניות של 18% יותר מהירות ו־12% התאוששות מהירה יותר של זמני הטעינה. לא יורד מתחת לסף בטוח.', 'A bronze clock halo splits into offset afterimages: 5 seconds of 18% more speed and 12% faster cooldown recovery. Never below a safe minimum.'),
    tags: ['selfcast', 'haste'], el: 'time', cd: 40, cost: 30,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { speed: .18, cdr: .12, dur: 5, group: 'haste', rank: 2 },
    budget: 0, vfx: 'vfx_045', sfx: 'sfx_045', icon: 'icon_045', ready: true,
  },
  {
    id: 'skill_046', slot: 'm4', lvl: 193, name: L('זינוק הרפאים', 'Wraith Dash'),
    desc: L('צל בצורת עורב נקרע לאורך המסלול: זינוק דרך עד שלושה אויבים, כל אחד נפגע פעם אחת. הנזק מוגבל להטלה ונעצר בקירות.', 'A raven-shaped shadow tears along the path: you dash through up to three foes, each struck once. Damage is capped per cast and walls stop you.'),
    tags: ['mobility', 'shadow', 'dash'], el: 'shadow', cd: 14, cost: 30,
    tgt: 'dash', move: 7, width: 1.5, cap: 3, los: true, anim: 'dash', dur: .5, carry: true,
    hits: [{ at: .08, beu: 1.2, phase: 'path', once: 'cast' }],
    budget: 1.2, vfx: 'vfx_046', sfx: 'sfx_046', icon: 'icon_046', ready: true,
  },
  {
    id: 'skill_047', slot: 'm5', lvl: 197, name: L('ארס הכימרה', "Chimera's Venom"),
    desc: L('נשיכה, ואחריה שש פעימות רעל בשלושה צבעים. אם האויב כבר הורעל, הוא גם מואט ב־10% לשתי שניות.', 'A bite, then six poison pulses in three colours. If the foe was already poisoned, it is also slowed by 10% for 2 seconds.'),
    tags: ['poison', 'dot', 'single'], el: 'poison', cd: 18, cost: 32,
    tgt: 'melee', range: 3, arc: 1, cap: 1, los: true, anim: 'gaze', dur: .6,
    hits: [{ at: .3, beu: .45 }],
    dot: { kind: 'poison', n: 6, every: .8, beu: .22, rule: 'refresh', max: 1 },
    cc: [{ k: 'slow', amt: .1, dur: 2, ifPoisoned: true, elite: .7, boss: .4 }],
    budget: 1.77, vfx: 'vfx_047', sfx: 'sfx_047', icon: 'icon_047', ready: true,
  },
  {
    id: 'skill_048', slot: 'm6', lvl: 201, name: L('חומת השמש', 'Solar Bulwark'),
    desc: L('מגן שמש מסתובב ונעצר כדיסק קורן לפנייך: מחסום של 12% מהחיים, ושכבת האטה או רעל קלה אחת מוסרת. לא מנקה מנגנוני בוסים ולא נערם עם משמר הטיטאן.', 'A miniature sun shield spins and settles as a radiant disc in front of you: a barrier of 12% of your health, and one minor slow or poison stack removed. It never cleanses boss mechanics nor stacks with Titan Guard.'),
    tags: ['selfcast', 'barrier', 'cleanse'], el: 'light', cd: 42, cost: 34,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { shield: .12, cleanse: 1, dur: 6, group: 'shield', rank: 2 },
    budget: 0, vfx: 'vfx_048', sfx: 'sfx_048', icon: 'icon_048', ready: true,
  },
  {
    id: 'skill_080', slot: 'side', lvl: 190, name: L('מוקש נפילת הירח', 'Moonfall Mine'),
    desc: L('חותם סהר כסוף שוקע ממש מעל האדמה ונדרך אחרי 0.8 שניות; הוא מתפוצץ כשאויב נכנס, או אחרי 5 שניות.', 'A silver crescent glyph sinks just above the ground and arms after 0.8 seconds; it bursts when a foe steps in, or after 5 seconds.'),
    tags: ['aoe', 'delayed', 'trap'], el: 'light', cd: 24, cost: 36,
    tgt: 'point', range: 8, radius: 3, cap: 8, los: true, anim: 'cast', dur: .6, arm: .8, fuse: 5,
    hits: [{ at: 1.4, beu: 1.8, phase: 'burst' }],
    budget: 1.8, vfx: 'vfx_080', sfx: 'sfx_080', icon: 'icon_080', ready: true,
  },
  {
    id: 'skill_092', slot: 'ult', ult: 3, lvl: 205, name: L('השמש השחורה של ההידרה', "Hydra's Black Sun"),
    desc: L('ליקוי חמה כהה פורח מאחורי צללית של הידרה רבת ראשים. כל ראש נושף זרם בצורה אחרת: גחלת, ארס וריק סגול, בזה אחר זה; ואז הראשים מתכנסים לליבה שחורה־זהובה שמתפוצצת לרסיסים בצורת קשקשים. משך הרעל והכאוס מוגבל.', 'A dark eclipse blooms behind a many-headed hydra silhouette. Each head breathes a differently shaped stream in turn, ember, venom and violet void; then the heads converge into a black-gold core that bursts into scale-shaped shards. Poison and chaos have capped durations.'),
    tags: ['ultimate', 'physical', 'dragon', 'chaos', 'poison', 'aoe'], el: 'chaos', cd: 110,
    tgt: 'point', range: 12, radius: 11, cap: 12, los: true, anim: 'ult', dur: 3.8,
    hits: [{ at: 1.0, beu: 1.5, n: 3, every: .45, phase: 'heads', once: 'pulse' }, { at: 2.6, beu: 2.6, phase: 'core' }],
    dot: { kind: 'chaos', n: 3, every: .5, beu: .4, rule: 'refresh', max: 1 },
    budget: 8.3, vfx: 'vfx_092', sfx: 'sfx_092', icon: 'icon_092', ready: true,
  },
];
