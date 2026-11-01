// Skill rework (v31), segment 5 of the Path of Ascent: levels 106-130, ultimate V (Celestial Spearfall). Data only; see seg01.js
// for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg05.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_025', slot: 'm1', lvl: 106, name: L('האנקול של פוסידון', "Poseidon's Hook"),
    desc: L('וו טורקיז דמוי קלשון נוצר ממים ונורה כחבל מעוקל: פגיעה, ואויבים רגילים נמשכים חלק מהדרך אלייך. אויבים כבדים רק נרתעים.', 'A turquoise trident barb forms from water and shoots out as a curved tether: a hit, and ordinary foes are pulled partway to you. Heavy foes only flinch.'),
    tags: ['control', 'water', 'pull'], el: 'water', cd: 10, cost: 24,
    tgt: 'proj', range: 13, speed: 26, cap: 1, los: true, anim: 'throw', dur: .7,
    hits: [{ at: .3, beu: .85, travel: true }],
    cc: [{ k: 'pull', amt: 4, elite: .4, boss: 0 }],
    budget: .85, vfx: 'vfx_025', sfx: 'sfx_025', icon: 'icon_025', ready: true,
  },
  {
    id: 'skill_026', slot: 'm2', lvl: 110, name: L('שביט הסוד', 'Arcane Comet'),
    desc: L('שביט סגול מלוטש נבנה מרונות מקוננות ועף לאט עם זנב מסתובב: פגיעה ישירה כבדה, ורסיס קטן לאויבים שסביב. הפגיעה הישירה והרסיסים נראים אחרת.', 'A faceted purple comet forms from nested runes and travels slowly with a rotating tail: a heavy direct hit and a small splash to the foes around. The direct hit and the splash look different.'),
    tags: ['magic', 'single', 'burst', 'projectile'], el: 'void', cd: 11, cost: 26,
    tgt: 'proj', range: 15, speed: 11, radius: 2.4, cap: 6, los: true, anim: 'fireball', dur: .8,
    hits: [{ at: .4, beu: 1.9, travel: true }, { at: .4, beu: .35, travel: true, cond: 'others' }],
    budget: 1.9, vfx: 'vfx_026', sfx: 'sfx_026', icon: 'icon_026', ready: true,
  },
  {
    id: 'skill_027', slot: 'm3', lvl: 114, name: L('שביל הרמץ', 'Cinder Path'),
    desc: L('זינוק בקו קצר שפוגע בדרך ומשאיר סדק כתום לוהט בדיוק לאורך המסלול ל־3 שניות: עד שלוש פעימות אש לכל אויב.', 'A dash down a short line that strikes on the way and leaves a hot orange fissure exactly along your path for 3 seconds: at most three fire pulses on each foe.'),
    tags: ['mobility', 'fire', 'trail', 'dot'], el: 'fire', cd: 12, cost: 22,
    tgt: 'dash', move: 7, width: 1.4, cap: 8, los: true, anim: 'dash', dur: .5, carry: true,
    hits: [{ at: .08, beu: .55, phase: 'path', once: 'cast' }],
    dot: { kind: 'burn', n: 3, every: 1, beu: .22, rule: 'refresh', max: 1, field: true },
    budget: 1.21, vfx: 'vfx_027', sfx: 'sfx_027', icon: 'icon_027', ready: true,
  },
  {
    id: 'skill_028', slot: 'm4', lvl: 118, name: L('דמות קולוסוס הברזל', 'Iron Colossus Form'),
    desc: L('לוחות אבן ננעלים על הכתפיים והאמות: 6 שניות של 22% פחות נזק ו־15% עמידות לטלטלות, במחיר 8% מהירות.', 'Armour-like stone plates lock onto your shoulders and forearms: 6 seconds of 22% less damage taken and 15% stagger resistance, for 8% of your speed.'),
    tags: ['selfcast', 'defense'], el: 'earth', cd: 36, cost: 26,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { guard: .22, poise: .15, speed: -.08, dur: 6, group: 'defense', rank: 2 },
    budget: 0, vfx: 'vfx_028', sfx: 'sfx_028', icon: 'icon_028', ready: true,
  },
  {
    id: 'skill_029', slot: 'm5', lvl: 122, name: L('קבר הקרח', 'Ice Tomb'),
    desc: L('אזהרת כפור ברורה נוצרת על האדמה, מנסרות קרח נסגרות סביב כל אויב: פגיעה והקפאה של שנייה לאויבים רגילים. בוסים לא קופאים, רק מואטים ב־12% לשתי שניות.', 'A clear frost warning forms on the ground and ice prisms close round each foe: a hit and a 1-second freeze on ordinary foes. Bosses are never frozen, only slowed 12% for 2 seconds.'),
    tags: ['control', 'ice', 'aoe'], el: 'ice', cd: 18, cost: 28,
    tgt: 'point', range: 10, radius: 3.2, cap: 6, los: true, anim: 'cast', dur: .8, tele: .4,
    hits: [{ at: .6, beu: .65 }],
    cc: [{ k: 'freeze', dur: 1, elite: .5, boss: 0, bossSlow: [.12, 2] }],
    budget: .65, vfx: 'vfx_029', sfx: 'sfx_029', icon: 'icon_029', ready: true,
  },
  {
    id: 'skill_030', slot: 'm6', lvl: 126, name: L('הספירלה הקדושה', 'Sacred Spiral'),
    desc: L('סחרור של ארבע מכות ברדיוס קטן; את נעה לאט יותר בזמן הסחרור אבל לא מאבדת שליטה. ארבעה הבזקים וטבעת אחרונה מסמנים כל פגיעה.', 'A spin of four hits in a small radius; you move slower while spinning but never lose control. Four flashes and a final ring mark each hit.'),
    tags: ['physical', 'multihit', 'aoe'], el: 'physical', cd: 12, cost: 24,
    tgt: 'around', radius: 3, cap: 6, los: true, anim: 'whirl', dur: 1.2, move: .5,
    hits: [{ at: .25, beu: .42, n: 4, every: .22, once: 'pulse' }],
    budget: 1.68, vfx: 'vfx_030', sfx: 'sfx_030', icon: 'icon_030', ready: true,
  },
  {
    id: 'skill_077', slot: 'side', lvl: 125, name: L('גלימת האליסיון', 'Elysian Mantle'),
    desc: L('לוחות נוצה לבנים־זהובים נפרשים על הכתפיים: 5 שניות של 15% פחות נזק, ו־0.4 שניות של חסינות להאטות רגילות ברגע ההטלה.', 'White-gold feather plates unfold over your shoulders: 5 seconds of 15% less damage taken, and 0.4 seconds of immunity to ordinary slows as you cast.'),
    tags: ['selfcast', 'defense'], el: 'light', cd: 36, cost: 30,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { guard: .15, slowImmune: .4, dur: 5, group: 'defense', rank: 1 },
    budget: 0, vfx: 'vfx_077', sfx: 'sfx_077', icon: 'icon_077', ready: true,
  },
  {
    id: 'skill_089', slot: 'ult', ult: 2, lvl: 130, name: L('מטר החניתות השמימי', 'Celestial Spearfall'),
    desc: L('אסטרולב שמימי מסתובב נפתח מעל אזור המטרה; שבע חניתות זהב־לבן ענקיות נוחתות בתבנית כוכב, כל אחת אחרי סימון קצר על הרצפה, והחנית האחרונה, הגדולה, יוצרת טבעת עורקי ברק.', 'A rotating celestial astrolabe opens above the target area; seven enormous gold-white spears descend in a star pattern, each after a short floor marker, and the larger final spear sets off a ring of lightning veins.'),
    tags: ['ultimate', 'physical', 'lightning', 'celestial', 'aoe'], el: 'celestial', cd: 100,
    tgt: 'point', range: 14, radius: 10, cap: 11, los: true, anim: 'ult', dur: 3.4,
    hits: [{ at: 1.1, beu: .55, n: 7, every: .2, phase: 'spear', r: 3.2, once: 'pulse' }, { at: 2.7, beu: 1.4, phase: 'final' }],
    budget: 4.8, budgetNote: 'Seven spears land in a star pattern; a foe under several takes ~6 of the 7 (4.8 BEU), all 7 at the centre (5.25 BEU).', budgetMax: 5.25,
    vfx: 'vfx_089', sfx: 'sfx_089', icon: 'icon_089', ready: true,
  },
];
