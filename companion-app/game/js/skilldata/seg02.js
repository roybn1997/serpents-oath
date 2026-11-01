// Skill rework (v31), segment 2 of the Path of Ascent: levels 36-60, ultimate II (Dragonwake Cataclysm). Data only; see seg01.js
// for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg02.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_007', slot: 'm1', lvl: 36, name: L('מנפץ הקיקלופ', 'Cyclops Breaker'),
    desc: L('הנשק נמשך לאחור ונוחת במכה כבדה אחת: עין קיקלופית נפתחת בפגיעה, סדק עבה רץ באדמה, והאויב סופג ממך 6% יותר נזק למשך 4 שניות.', 'Your weapon winds back and lands one deliberate heavy blow: a cyclopean eye flares open at impact, a thick crack runs through the ground, and the foe takes 6% more damage from you for 4 seconds.'),
    tags: ['physical', 'single', 'heavy'], el: 'earth', cd: 5, cost: 16,
    tgt: 'melee', range: 2.8, arc: .9, cap: 1, los: true, anim: 'smash', dur: .75,
    hits: [{ at: .42, beu: 1.45 }],
    cc: [{ k: 'vuln', pct: .06, dur: 4, elite: 1, boss: 1 }], // (armour break: the pack applies it, seg01.js SK.vuln)
    budget: 1.45, vfx: 'vfx_007', sfx: 'sfx_007', icon: 'icon_007', ready: true,
  },
  {
    id: 'skill_008', slot: 'm2', lvl: 40, name: L('מטח רסיסי הכפור', 'Frost Shard Volley'),
    desc: L('חמישה רסיסי קרח בגדלים שונים נוצרים בקשת ונורים בזה אחר זה. מקרוב הם מדייקים יותר.', 'Five faceted ice shards of different sizes form in an arc and fire one after another. Up close they fly truer.'),
    tags: ['magic', 'ice', 'multihit', 'projectile'], el: 'ice', cd: 6, cost: 15,
    tgt: 'proj', range: 14, speed: 24, cap: 1, los: true, anim: 'fireball', dur: .8,
    hits: [{ at: .3, beu: .32, n: 5, every: .08, travel: true }],
    budget: 1.6, vfx: 'vfx_008', sfx: 'sfx_008', icon: 'icon_008', ready: true,
  },
  {
    id: 'skill_009', slot: 'm3', lvl: 44, name: L('טבעת הרעש', 'Quake Ring'),
    desc: L('חבטה באדמה ששוברת אותה בשלוש טבעות: לוחות אבן חומים מתרוממים ונופלים, ואויבים רגילים מואטים ב־15% למשך 3 שניות.', 'A ground slam breaks the earth in three rings: brown stone plates lift and fall back, and ordinary foes are slowed by 15% for 3 seconds.'),
    tags: ['aoe', 'earth'], el: 'earth', cd: 9, cost: 20,
    tgt: 'around', radius: 4.5, cap: 8, los: true, anim: 'slam', dur: .8,
    hits: [{ at: .4, beu: .8 }],
    cc: [{ k: 'slow', amt: .15, dur: 3, elite: .6, boss: .3 }],
    budget: .8, vfx: 'vfx_009', sfx: 'sfx_009', icon: 'icon_009', ready: true,
  },
  {
    id: 'skill_010', slot: 'm4', lvl: 48, name: L('פרוות הצל', 'Shadow Pelt'),
    desc: L('גצים סגולים־כהים עוטפים אותך כגלימה קצרה: 5 שניות של נזק נכנס נמוך ב־18%, וההתחמקות הראשונה בזמן הזה ארוכה ב־20%. לא חסינות.', 'Dark-violet motes wrap you in a short-lived mantle: 5 seconds of 18% less damage taken, and the first dodge in that time lasts 20% longer. Not invulnerability.'),
    tags: ['selfcast', 'defense'], el: 'shadow', cd: 28, cost: 16,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { guard: .18, dodge: .2, dur: 5, group: 'defense', rank: 1 }, // (dodge: the pack lengthens her first roll's i-frames)
    budget: 0, vfx: 'vfx_010', sfx: 'sfx_010', icon: 'icon_010', ready: true,
  },
  {
    id: 'skill_011', slot: 'm5', lvl: 52, name: L('קפיצת הסערה', 'Tempest Vault'),
    desc: L('ספירלת רוח מרימה אותך בקפיצה שאפשר לכוון, ובנחיתה פרץ אבק עגול פוגע סביבך. לא עוברת דרך קירות.', 'A wind spiral lifts you in a steerable leap; landing throws a crisp ring of dust that strikes around you. It never passes through walls.'),
    tags: ['mobility', 'air', 'aoe'], el: 'wind', cd: 8, cost: 14,
    tgt: 'leap', move: 7, radius: 2.4, cap: 6, los: true, anim: 'slam', dur: .9, carry: true,
    hits: [{ at: .7, beu: .45, phase: 'land' }],
    budget: .45, vfx: 'vfx_011', sfx: 'sfx_011', icon: 'icon_011', ready: true,
  },
  {
    id: 'skill_012', slot: 'm6', lvl: 56, name: L('כבלי האדס', 'Chains of Hades'),
    desc: L('סדקים של השאול נפתחים מתחת לעד ארבעה אויבים קרובים, ושרשראות ברזל שחורות קמות ונמתחות: פגיעה וריתוק של 1.2 שניות לאויבים רגילים. בוסים רק מואטים לרגע.', 'Underworld cracks open beneath up to four nearby foes and black iron chains rise and pull taut: a hit and a 1.2-second root on ordinary foes. Bosses are only slowed for a moment.'),
    tags: ['control', 'dark', 'aoe'], el: 'underworld', cd: 12, cost: 22,
    tgt: 'around', radius: 7, cap: 4, los: true, anim: 'summon', dur: .8, // (the four nearest in sight)
    hits: [{ at: .45, beu: .7 }],
    cc: [{ k: 'root', dur: 1.2, elite: .5, boss: 0 }],
    budget: .7, vfx: 'vfx_012', sfx: 'sfx_012', icon: 'icon_012', ready: true,
  },
  {
    id: 'skill_074', slot: 'side', lvl: 45, name: L('מראת הקרח', 'Ice Mirror'),
    desc: L('מראת קרח מלוטשת עם מסגרת כסף מופיעה לפנייך ל־3 שניות: הקליע הראשון שפוגע בה נחלש ב־45%, נבלע, ופולט גל כפור שפוגע סביבך.', 'A faceted ice mirror with a silver rim appears in front of you for 3 seconds: the first projectile to strike it is weakened by 45%, swallowed, and releases a frost pulse around you.'),
    tags: ['selfcast', 'counter', 'ice'], el: 'ice', cd: 30, cost: 18,
    tgt: 'self', radius: 3, cap: 6, anim: 'aegis', dur: .5,
    hits: [{ at: 0, beu: .4, cond: 'full', phase: 'pulse' }],
    buff: { mirror: .45, dur: 3, group: 'ward', rank: 1 }, // (mirror: the pack's guard weakens the first shot from the front by this share)
    budget: .4, vfx: 'vfx_074', sfx: 'sfx_074', icon: 'icon_074', ready: true,
  },
  {
    id: 'skill_086', slot: 'ult', ult: 1, lvl: 60, name: L('אסון בעקבות הדרקון', 'Dragonwake Cataclysm'),
    desc: L('דרקון רפאים ענק מתפתל מעל הזירה, מכה בכנפיו, צולל לאורך הנתיב המסומן ומתכרבל לפרץ אש. קשקשים גדולים מתפזרים כגחלים, וטבעת הלם וסימני טפרים נשארים באדמה. הבעירה מתרעננת, לא נערמת.', 'A massive spectral dragon coils above the arena, beats its wings, dives along the marked lane and curls into a fireburst. Large scales scatter as embers; a shockwave ring and claw scars follow. The burn refreshes, never stacks.'),
    tags: ['ultimate', 'physical', 'dragon', 'fire', 'aoe'], el: 'dragon', cd: 90,
    tgt: 'around', radius: 8, cap: 9, los: true, anim: 'ult', dur: 2.6,
    hits: [{ at: 1.7, beu: 2.4, phase: 'dive' }, { at: 2.2, beu: .4, n: 3, every: .6, phase: 'burn', once: 'pulse' }],
    cc: [{ k: 'push', amt: 1.6, elite: .4, boss: 0 }],
    budget: 3.6, vfx: 'vfx_086', sfx: 'sfx_086', icon: 'icon_086', ready: true,
  },
];
