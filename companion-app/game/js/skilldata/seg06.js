// Skill rework (v31), segment 6 of the Path of Ascent: levels 131-150, ultimate VI (Kronos Sundering). Data only; see seg01.js
// for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg06.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_031', slot: 'm1', lvl: 131, name: L('כלוב הסערה', 'Storm Cage'),
    desc: L('ארבעה עמודי ברק קטנים מעגנים שדה עגול ל־3 שניות וחוטים מחברים אותם לכלוב: חמש פעימות ברק, כל אויב נפגע פעם אחת בכל פעימה.', 'Four small lightning pylons anchor a circular field for 3 seconds and filaments join them into a cage: five lightning ticks, each foe struck once per tick.'),
    tags: ['aoe', 'lightning', 'dot', 'field'], el: 'lightning', cd: 16, cost: 30,
    tgt: 'point', range: 11, radius: 3.6, cap: 8, los: true, anim: 'cast', dur: .7,
    hits: [{ at: .6, beu: .3, n: 5, every: .6, once: 'pulse' }],
    budget: 1.5, vfx: 'vfx_031', sfx: 'sfx_031', icon: 'icon_031', ready: true,
  },
  {
    id: 'skill_032', slot: 'm2', lvl: 134, name: L('הסתערות המינוטאור', 'Minotaur Charge'),
    desc: L('הסתערות בקו ישר עד מרחק בטוח; התנגשות בקרקע עוצרת אותך. האויב הראשון סופג את המכה המלאה, ומי שמאחוריו פחות.', 'A straight charge up to a safe distance; hitting terrain stops you. The first foe takes the full impact, those behind it less.'),
    tags: ['mobility', 'physical', 'impact'], el: 'physical', cd: 12, cost: 24,
    tgt: 'dash', move: 9, width: 1.6, cap: 5, los: true, anim: 'charge', dur: .8, carry: true, stopAtFirst: true,
    hits: [{ at: .1, beu: 1.45, phase: 'first' }, { at: .1, beu: .6, phase: 'behind', cond: 'others' }],
    budget: 1.45, vfx: 'vfx_032', sfx: 'sfx_032', icon: 'icon_032', ready: true,
  },
  {
    id: 'skill_033', slot: 'm3', lvl: 137, name: L('יניקת הנשמה', 'Soul Siphon'),
    desc: L('חוט סגול מחבר את האויב אלייך לשנייה אחת: ארבע פעימות נזק, ואת מחלימה ב־18% מהנזק שנגרם, עד תקרה של חלק מהחיים בכל הטלה.', 'A purple thread links the foe to you for one second: four damage pulses, and you heal for 18% of the damage dealt, up to a share of your health per cast.'),
    tags: ['magic', 'lifesteal', 'channel'], el: 'shadow', cd: 14, cost: 26,
    tgt: 'tether', range: 9, cap: 1, los: true, anim: 'gaze', dur: 1.1,
    hits: [{ at: .25, beu: .25, n: 4, every: .25 }],
    heal: { leech: .18, cap: .1 },
    budget: 1.0, vfx: 'vfx_033', sfx: 'sfx_033', icon: 'icon_033', ready: true,
  },
  {
    id: 'skill_034', slot: 'm4', lvl: 140, name: L('צו הכאוס', 'Chaos Edict'),
    desc: L('רונה מגנטה־שחורה ננעלת סביב האויב ל־3 שניות; המכה הבאה שלך מפוצצת אותה בנזק נוסף. אם לא פגעת, היא מתפוצצת לבד בסוף. בלי מזל: התוצאה תמיד ידועה.', 'A magenta-black rune clamps round the foe for 3 seconds; your next hit detonates it for bonus damage. If you never hit, it detonates by itself at the end. No luck involved: the outcome is always known.'),
    tags: ['magic', 'mark', 'combo'], el: 'chaos', cd: 12, cost: 26,
    tgt: 'mark', range: 11, cap: 1, los: true, anim: 'gaze', dur: .5,
    hits: [{ at: 3, beu: .8, phase: 'detonate', cond: 'full' }],
    cc: [{ k: 'mark', dur: 3, elite: 1, boss: 1 }],
    budget: .8, vfx: 'vfx_034', sfx: 'sfx_034', icon: 'icon_034', ready: true,
  },
  {
    id: 'skill_035', slot: 'm5', lvl: 143, name: L('פסק דין אות השמש', 'Sunbrand Verdict'),
    desc: L('דיסק שמש מאחורייך נדחס לחנית זהב ונוחת בקרן אנכית: אויב שכבר נושא החלשה כלשהי סופג 8% יותר.', 'A sun disk behind you compresses into a golden spear and lands as a sharp vertical beam: a foe already under any debuff takes 8% more.'),
    tags: ['magic', 'light', 'single'], el: 'light', cd: 12, cost: 28,
    tgt: 'mark', range: 12, cap: 1, los: true, anim: 'cast', dur: .7,
    hits: [{ at: .5, beu: 1.55, bonusDebuffed: .08 }],
    budget: 1.55, vfx: 'vfx_035', sfx: 'sfx_035', icon: 'icon_035', ready: true,
  },
  {
    id: 'skill_036', slot: 'm6', lvl: 146, name: L('משמר הטיטאן', 'Titan Guard'),
    desc: L('שריון חזה קטן מאבן נוצר על הגוף: מגן ששווה ל־10% מהחיים ל־7 שניות ועוד 12% עמידות לשליטה. הטלה חוזרת לא מוסיפה מגן; אחיזות בוסים עדיין עובדות.', 'A small stone cuirass forms over your torso: a shield worth 10% of your health for 7 seconds and 12% crowd-control resistance. Recasting adds no extra shield; boss grabs still work.'),
    tags: ['selfcast', 'shield'], el: 'earth', cd: 32, cost: 28,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { shield: .1, cc: .12, dur: 7, group: 'shield', rank: 1 },
    budget: 0, vfx: 'vfx_036', sfx: 'sfx_036', icon: 'icon_036', ready: true,
  },
  {
    id: 'skill_078', slot: 'side', lvl: 145, name: L('מבט הבזיליסק', 'Basilisk Gaze'),
    desc: L('רונת עין ירוקה־ארד נפתחת לאורך קו ראייה צר: פגיעה והאטה של 20% ל־1.2 שניות לאויבים רגילים. מרקם אבן זוחל עליהם לרגע ונעלם; עילית ובוסים לא מתאבנים.', 'A green-bronze eye rune opens along a narrow line of sight: a hit and a 20% slow for 1.2 seconds on ordinary foes. A stone texture creeps over them for a moment and fades; elites and bosses never turn to stone.'),
    tags: ['control', 'slow', 'line'], el: 'poison', cd: 22, cost: 32,
    tgt: 'line', range: 11, width: 1.4, cap: 5, los: true, anim: 'gaze', dur: .6,
    hits: [{ at: .4, beu: .75 }],
    cc: [{ k: 'slow', amt: .2, dur: 1.2, elite: .6, boss: .3 }],
    budget: .75, vfx: 'vfx_078', sfx: 'sfx_078', icon: 'icon_078', ready: true,
  },
  {
    id: 'skill_090', slot: 'ult', ult: 3, lvl: 150, name: L('שבר קרונוס', 'Kronos Sundering'),
    desc: L('מחוג שעון ארד ענק מופיע בשמיים ונעצר באמצע הסיבוב. העולם נסדק מקומית לפרוסות זמן ושלוש גרסאות מאוחרות של המכה שלך נוחתות מזוויות שונות, והאחרונה מנפצת את לוח השעון לרסיסים זוהרים. אויבים רגילים מואטים או מתנודדים; שום דבר לא קופא באמת.', 'A giant bronze clock hand appears in the sky and stops mid-turn. The world locally fractures into time-slices; three delayed versions of your heavy strike land from different angles, and the last shatters the clock face into luminous shards. Ordinary foes are slowed or staggered; nothing is ever truly frozen.'),
    tags: ['ultimate', 'physical', 'time', 'aoe', 'multihit'], el: 'time', cd: 110,
    tgt: 'around', radius: 10, cap: 12, los: true, anim: 'ult', dur: 3.6,
    hits: [{ at: 1.0, beu: 1.4, phase: 'fracture' }, { at: 1.6, beu: .9, n: 3, every: .45, phase: 'echo', once: 'pulse' }, { at: 3.2, beu: 1.8, phase: 'shatter' }],
    cc: [{ k: 'slow', amt: .3, dur: 2, elite: .6, boss: .25 }, { k: 'stagger', dur: .4, elite: .5, boss: 0 }],
    budget: 5.9, vfx: 'vfx_090', sfx: 'sfx_090', icon: 'icon_090', ready: true,
  },
];
