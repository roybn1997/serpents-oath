// Skill rework (v31), segment 3 of the Path of Ascent: levels 61-80, ultimate III (Leviathan's Crownfall). Data only; see seg01.js
// for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg03.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_013', slot: 'm1', lvl: 61, name: L('חנית הרעם', 'Thunder Spear'),
    desc: L('ברק זיגזג מתעבה לראש חנית וחודר בקו ישר עד חמישה אויבים; כל אויב אחרי הראשון סופג 10% פחות מקודמו.', 'A zig-zag bolt condenses into a spearhead and pierces up to five foes in a straight line; each foe after the first takes 10% less than the one before.'),
    tags: ['magic', 'lightning', 'pierce'], el: 'lightning', cd: 6, cost: 18,
    tgt: 'line', range: 13, width: 1.3, cap: 5, los: true, anim: 'throw', dur: .6,
    hits: [{ at: .32, beu: 1.25, falloff: .1 }],
    budget: 1.25, vfx: 'vfx_013', sfx: 'sfx_013', icon: 'icon_013', ready: true,
  },
  {
    id: 'skill_014', slot: 'm2', lvl: 64, name: L('הסתערות לב הארי', 'Lionheart Rush'),
    desc: L('רעמת אריה רפאים סביב הכתפיים, הסתערות בנתיב קצר שבה כל אויב נפגע פעם אחת, ובסופה מכת טפרים צולבת.', 'A spectral lion mane forms round your shoulders; you rush down a short lane, striking each foe once, and finish with a claw-like cross strike.'),
    tags: ['mobility', 'physical', 'dash'], el: 'physical', cd: 8, cost: 18,
    tgt: 'dash', move: 7, width: 1.6, cap: 6, los: true, anim: 'charge', dur: .7, carry: true,
    hits: [{ at: .1, beu: .4, phase: 'path', once: 'cast' }, { at: .55, beu: .6, phase: 'end', r: 2, cap: 3 }],
    budget: 1.0, vfx: 'vfx_014', sfx: 'sfx_014', icon: 'icon_014', ready: true,
  },
  {
    id: 'skill_015', slot: 'm3', lvl: 67, name: L('היפוך באור הירח', 'Moonlit Reversal'),
    desc: L('סהר כסוף נסגר סביבך ל־0.6 שניות: אם מכה שאפשר לחסום פוגעת בך בזמן הזה, את מחזירה מכה חזקה. אם לא, חתך חלש יותר.', 'A silver crescent closes round you for 0.6 seconds: if a blockable blow strikes you then, you answer with a heavy counter. If not, a weaker slash.'),
    tags: ['counter', 'physical'], el: 'light', cd: 12, cost: 16,
    tgt: 'melee', range: 3, arc: 1.4, cap: 3, los: true, anim: 'aegis', dur: .8,
    hits: [{ at: .6, beu: 1.35, cond: 'counter' }, { at: .62, beu: .35, cond: 'alt' }],
    budget: 1.35, vfx: 'vfx_015', sfx: 'sfx_015', icon: 'icon_015', ready: true,
  },
  {
    id: 'skill_016', slot: 'm4', lvl: 70, name: L('שורשי גאיה', 'Roots of Gaia'),
    desc: L('סדקים זוהרים בירוק ירקן, שורשים מסתלסלים מעלה בפרצים, ואויבים רגילים מרותקים ל־1.4 שניות; אחר כך קוצים פועמים שלוש פעמים.', 'Cracks glow jade, roots spiral upward in staggered bursts and ordinary foes are rooted for 1.4 seconds; then thorn tips pulse three times.'),
    tags: ['aoe', 'nature', 'dot', 'root'], el: 'nature', cd: 14, cost: 20,
    tgt: 'point', range: 10, radius: 3, cap: 6, los: true, anim: 'summon', dur: .7,
    hits: [{ at: .4, beu: .35 }],
    dot: { kind: 'thorn', n: 3, every: .7, beu: .22, rule: 'refresh', max: 1 },
    cc: [{ k: 'root', dur: 1.4, elite: .5, boss: 0 }],
    budget: 1.01, vfx: 'vfx_016', sfx: 'sfx_016', icon: 'icon_016', ready: true,
  },
  {
    id: 'skill_017', slot: 'm5', lvl: 74, name: L('דם הפניקס', 'Phoenix Blood'),
    desc: L('נוצה אדומה־זהובה נשרפת ונבנית מחדש: 8% מהחיים חוזרים מיד, ועוד 2% בכל שנייה למשך 4 שניות. הריפוי המתמשך לא נערם.', 'A red-gold feather burns away and reforms: 8% of your health returns at once, then 2% each second for 4 seconds. The heal-over-time never stacks.'),
    tags: ['selfcast', 'sustain'], el: 'fire', cd: 30, cost: 20,
    tgt: 'self', anim: 'heal', dur: .6, onMove: true,
    heal: { now: .08, per: .02, n: 4, every: 1 },
    budget: 0, vfx: 'vfx_017', sfx: 'sfx_017', icon: 'icon_017', ready: true,
  },
  {
    id: 'skill_018', slot: 'm6', lvl: 77, name: L('כדורי האתר', 'Aether Orbs'),
    desc: L('שלושה כדורים סגולים־זהובים מקיפים אותך פעם אחת ואז מתפצלים בקשתות שונות אל האויבים. הם מאבדים את המטרה אם קיר מסתיר אותה.', 'Three violet-gold orbs circle you once, then peel away on different arcs toward your foes. They lose their target if a wall hides it.'),
    tags: ['magic', 'projectile', 'seeking'], el: 'celestial', cd: 8, cost: 18,
    tgt: 'proj', range: 14, speed: 9, cap: 1, los: true, anim: 'cast', dur: .8, seek: true,
    hits: [{ at: .55, beu: .48, n: 3, every: .15, travel: true }],
    budget: 1.44, vfx: 'vfx_018', sfx: 'sfx_018', icon: 'icon_018', ready: true,
  },
  {
    id: 'skill_075', slot: 'side', lvl: 75, name: L('הד הסערה', 'Tempest Echo'),
    desc: L('זינוק שפוגע בדרך; בבואה תכולה נשארת בנקודת ההתחלה, ואחרי 0.45 שניות היא חוזרת על גרסה קצרה של הזינוק אם הדרך פנויה.', 'A dash that strikes on its way; a cyan afterimage stays where you started and, 0.45 seconds later, retraces a shorter dash if the path is clear.'),
    tags: ['mobility', 'echo', 'dash'], el: 'wind', cd: 12, cost: 22,
    tgt: 'dash', move: 6, width: 1.4, cap: 6, los: true, anim: 'dash', dur: .5, carry: true,
    hits: [{ at: .08, beu: .7, phase: 'path', once: 'cast' }, { at: .6, beu: .35, phase: 'echo', once: 'cast' }],
    budget: 1.05, vfx: 'vfx_075', sfx: 'sfx_075', icon: 'icon_075', ready: true,
  },
  {
    id: 'skill_087', slot: 'ult', ult: 2, lvl: 80, name: L('נפילת כתר הלווייתן', "Leviathan's Crownfall"),
    desc: L('כתר של סימני ים נוצר מעלייך; נחשי ים רפאים מסתחררים בטבעת גאות, רסיסי מים נעצרים לרגע, והכול מתמוטט פנימה כגל עצום. נשארים קצף לבן־כחול וסימני קלשון. דחיפה חזקה לאויבים רגילים בלבד.', 'A crown of ocean glyphs forms above you; spectral sea-serpents spiral in a rising tidal ring, water shards hang for a heartbeat, then everything crashes inward as a colossal wave. Blue-white foam and trident sigils remain. A strong push on ordinary foes only.'),
    tags: ['ultimate', 'physical', 'water', 'ice', 'aoe', 'control'], el: 'water', cd: 100,
    tgt: 'around', radius: 9, cap: 10, los: true, anim: 'ult', dur: 3,
    hits: [{ at: 1.2, beu: 1.2, phase: 'wall' }, { at: 2.0, beu: 2.0, phase: 'wave' }, { at: 2.5, beu: .35, n: 3, every: .5, phase: 'undertow', once: 'pulse' }],
    cc: [{ k: 'push', amt: 2.6, elite: .3, boss: 0 }],
    budget: 4.25, vfx: 'vfx_087', sfx: 'sfx_087', icon: 'icon_087', ready: true,
  },
];
