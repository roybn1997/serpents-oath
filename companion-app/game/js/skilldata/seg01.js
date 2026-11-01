// Skill rework (v31), segment 1 of the Path of Ascent: levels 1-35, ultimate I (Titan's First Fall).
// Pure data in the spec's own units (docs/skills-rework.md "Data model"): beu = Basic-attack Equivalent Units (1 BEU = one blow
// of the weapon in hand, rpg.js skillBase), seconds, metres, cost = the spec's resource units (skillcat.js turns them into mana).
// skillcat.js assembles the twelve segment files, places the nodes, converts the units and validates; behaviour lives in
// js/skillpacks/seg01.js. `ready: true` means the pack implements the skill fully and it may be taught in game.
// Hebrew addresses V in the feminine.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_001', slot: 'm1', lvl: 1, name: L('אגרוף הטיטאן', 'Titan Knuckle'),
    desc: L('צעד קדימה ומכת אגרוף אבן ענקית אחת. אויבים רגילים מתנודדים לרגע; בוס לא נקטע בגללה.', 'A step in and one blow of an oversized stone fist. Ordinary foes reel for a moment; a boss is never interrupted by it.'),
    tags: ['physical', 'single'], el: 'earth', cd: 3, cost: 8,
    tgt: 'melee', range: 2.8, arc: 1.1, cap: 1, los: true, anim: 'aegis', dur: .6,
    hits: [{ at: .22, beu: 1.05 }],
    cc: [{ k: 'stagger', dur: .5, elite: .5, boss: 0 }],
    budget: 1.05, vfx: 'vfx_001', sfx: 'sfx_001', icon: 'icon_001', ready: true,
  },
  {
    id: 'skill_002', slot: 'm2', lvl: 5, name: L('מחט הגחלת', 'Ember Needle'),
    desc: L('גחלת נאספת בין הידיים ונהיית נוצת רונה מחודדת: היא עפה אל האויב, פוגעת, ומשאירה אותו בוער שלוש פעימות. הצתה חוזרת מרעננת את הבעירה ולא מכפילה אותה.', 'An ember gathers between your hands and becomes a pointed rune-feather: it flies at the foe, strikes, and leaves it burning for three pulses. Burning it again refreshes the burn, never doubles it.'),
    tags: ['magic', 'fire', 'projectile', 'dot'], el: 'fire', cd: 4, cost: 10,
    tgt: 'proj', range: 16, speed: 22, cap: 1, los: true, anim: 'fireball', dur: .55,
    hits: [{ at: .25, beu: .8, travel: true }],
    dot: { kind: 'burn', n: 3, every: 1, beu: .117, rule: 'refresh', max: 1 },
    budget: 1.15, vfx: 'vfx_002', sfx: 'sfx_002', icon: 'icon_002', ready: true,
  },
  {
    id: 'skill_003', slot: 'm3', lvl: 10, name: L('דופק האגיס', 'Aegis Pulse'),
    desc: L('את נוטעת רגליים, חותם מגן מארד מבזיק מתחתייך, וגל הלם נמוך מתפשט סביבך: הוא קוטע הנפות חלשות ודוחף אויבים קלים מעט לאחור.', 'You brace; a bronze shield sigil flashes beneath you and a low shockwave rolls out around you: it breaks weak wind-ups and pushes light foes back a little.'),
    tags: ['physical', 'aoe'], el: 'earth', cd: 6, cost: 14,
    tgt: 'around', radius: 3.6, cap: 6, los: true, anim: 'smash', dur: .6,
    hits: [{ at: .33, beu: .65 }],
    cc: [{ k: 'interrupt', dur: .3, elite: .5, boss: 0 }, { k: 'push', amt: 1.6, elite: .4, boss: 0 }],
    budget: .65, vfx: 'vfx_003', sfx: 'sfx_003', icon: 'icon_003', ready: true,
  },
  {
    id: 'skill_004', slot: 'm4', lvl: 15, name: L('אות הצפע', "Viper's Brand"),
    desc: L('שלושה סימני ארס ירוקים־שחורים מסתחררים אל האויב: מכה מהירה, ואחריה ארבע פעימות רעל. רעל חוזר מתרענן ואף פעם לא נערם.', 'Three green-black venom glyphs spiral into the foe: a quick hit, then four pulses of poison. Poisoning it again refreshes the poison; it never piles up.'),
    tags: ['poison', 'dot', 'single'], el: 'poison', cd: 5, cost: 12,
    tgt: 'mark', range: 12, cap: 1, los: true, anim: 'gaze', dur: .55,
    hits: [{ at: .52, beu: .55, travel: true }],
    dot: { kind: 'poison', n: 4, every: 1, beu: .18, rule: 'refresh', max: 1 },
    budget: 1.27, vfx: 'vfx_004', sfx: 'sfx_004', icon: 'icon_004', ready: true,
  },
  {
    id: 'skill_005', slot: 'm5', lvl: 21, name: L('זינוק הצעד המהיר', 'Quickstep Lunge'),
    desc: L('זינוק קצר וממוקד: כל מי שבדרך נחתך פעם אחת, ובסוף הזינוק דקירה. קירות וסלעים עוצרים אותך.', 'A short, aimed dash: everyone in the way is cut once, and the dash ends in a thrust. Walls and rocks stop you.'),
    tags: ['mobility', 'physical', 'dash'], el: 'physical', cd: 7, cost: 12,
    tgt: 'dash', move: 6, width: 1.4, range: 8, cap: 6, los: true, anim: 'dash', dur: .5, carry: true,
    hits: [{ at: .08, beu: .35, phase: 'path', once: 'cast' }, { at: .36, beu: .5, phase: 'end', r: 1.9, cap: 3 }],
    budget: .85, vfx: 'vfx_005', sfx: 'sfx_005', icon: 'icon_005', ready: true,
  },
  {
    id: 'skill_006', slot: 'm6', lvl: 28, name: L('ריכוז אולימפי', 'Olympian Focus'),
    desc: L('זר דפנה ושמש נוצרים מאחורייך ושלושה גצי זהב מקיפים את כתפייך: 8 שניות של נזק גבוה ב־12% ותנועה מהירה ב־8%. הטלה חוזרת מרעננת את הזמן; לא נערם עם עצמו, וברכת התקפה חזקה יותר מחליפה אותו.', 'A laurel-and-sun glyph forms behind you and three golden motes circle your shoulders: 8 seconds of 12% more damage and 8% faster movement. Casting it again refreshes the time; it never stacks with itself, and a stronger offense blessing replaces it.'),
    tags: ['selfcast', 'buff'], el: 'light', cd: 24, cost: 18,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { power: .12, speed: .08, dur: 8, group: 'offense', rank: 1 },
    budget: 0, vfx: 'vfx_006', sfx: 'sfx_006', icon: 'icon_006', ready: true,
  },
  {
    id: 'skill_073', slot: 'side', lvl: 18, name: L('מפל הלהבות', 'Flare Cascade'),
    desc: L('שלושה עלי גחלת נפתחים בזה אחר זה משמאל לימין במניפה צרה ומתפוצצים בגדלים שונים. מי שעומד בכולם סופג את שלושתם.', 'Three ember petals open one after another, left to right, across a narrow fan and burst in different sizes. A foe caught in all three takes all three.'),
    tags: ['aoe', 'fire'], el: 'fire', cd: 10, cost: 18,
    tgt: 'cone', range: 7, arc: .9, radius: 1.8, cap: 6, los: true, anim: 'fireball', dur: .7,
    hits: [{ at: .3, beu: .42, n: 3, every: .14 }],
    budget: 1.26, vfx: 'vfx_073', sfx: 'sfx_073', icon: 'icon_073', ready: true,
  },
  {
    id: 'skill_085', slot: 'ult', ult: 1, lvl: 35, name: L('נפילתו הראשונה של הטיטאן', "Titan's First Fall"),
    desc: L('אגרוף טיטאן שקוף ועצום מתרומם מאחורייך, טבעת אזהרה נסגרת על האדמה, והאגרוף נוחת: טבעות של אדמה סדוקה רצות החוצה, לוחות אבן מתהפכים ורונות זהב מהבהבים בסדקים. אחריו שלושה גלי הלם. בוסים נפגעים אבל לא מופלים.', 'A monumental, translucent titan fist rises behind you, a warning circle closes on the ground, and the fist slams down: rings of cracked earth race outward, stone slabs lift and tumble, golden runes flash in the fractures. Three ground-shocks follow. Bosses take the damage but are never knocked down.'),
    tags: ['ultimate', 'physical', 'earth', 'aoe'], el: 'earth', cd: 90,
    tgt: 'around', radius: 7, cap: 8, los: true, anim: 'ult', dur: 2.2,
    hits: [{ at: 1.55, beu: 2.0, phase: 'impact' }, { at: 2.0, beu: .35, n: 3, every: .45, phase: 'shock', once: 'pulse' }],
    cc: [{ k: 'stun', dur: .8, elite: .5, boss: 0 }, { k: 'push', amt: 1.8, elite: .4, boss: 0 }],
    budget: 3.05, vfx: 'vfx_085', sfx: 'sfx_085', icon: 'icon_085', ready: true,
  },
];
