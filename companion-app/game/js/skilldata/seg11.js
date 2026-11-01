// Skill rework (v31), segment 11 of the Path of Ascent: levels 251-275, ultimate XI (Void of Erebus). Data only; see seg01.js
// for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg11.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_061', slot: 'm1', lvl: 251, name: L('שובר השלשלאות של הטיטאן', "Titan's Chainbreaker"),
    desc: L('שרשראות אבן ענקיות מצליפות בצורת X, נאחזות בעוגנים זוהרים ומושכות עד ארבעה אויבים מעט פנימה, ואז מכת טיטאן בשתי ידיים. עילית נמשכת פחות, בוסים לא.', 'Oversized stone chains whip out in an X, hook into glowing anchors and draw up to four foes a little inward, then a two-handed titan slam. Elites are drawn less, bosses not at all.'),
    tags: ['physical', 'aoe', 'pull'], el: 'earth', cd: 16, cost: 42,
    tgt: 'around', radius: 4.5, cap: 4, los: true, anim: 'smash', dur: 1,
    hits: [{ at: .65, beu: 2.1, phase: 'slam' }],
    cc: [{ k: 'pull', amt: 2, elite: .3, boss: 0, center: true }],
    budget: 2.1, vfx: 'vfx_061', sfx: 'sfx_061', icon: 'icon_061', ready: true,
  },
  {
    id: 'skill_062', slot: 'm2', lvl: 255, name: L('כנפי הסערה', 'Tempest Wings'),
    desc: L('שתי כנפי סערה נפרשות לזינוק אווירי ארוך: כל אויב לאורך הדרך נפגע פעם אחת. לא חוצה פערים שהעולם לא מאפשר.', 'Two storm wings unfold for a long aerial dash: every foe along the way is struck once. It never crosses gaps the world does not allow.'),
    tags: ['mobility', 'wind', 'dash'], el: 'wind', cd: 18, cost: 40,
    tgt: 'dash', move: 11, width: 1.6, cap: 8, los: true, anim: 'dash', dur: .7, carry: true,
    hits: [{ at: .08, beu: 1.5, phase: 'path', once: 'cast' }],
    budget: 1.5, vfx: 'vfx_062', sfx: 'sfx_062', icon: 'icon_062', ready: true,
  },
  {
    id: 'skill_063', slot: 'm3', lvl: 259, name: L('כבשן השמיים', 'Celestial Furnace'),
    desc: L('כור שמש קטן יורד במסגרת זהובה לשדה קורן של 3 שניות: חמש פעימות. עמודים מסמנים את הגבול.', 'A small sun-forge descends on a golden frame into a 3-second radiant zone: five ticks. Pillars mark its edge.'),
    tags: ['magic', 'light', 'aoe', 'field'], el: 'light', cd: 22, cost: 42,
    tgt: 'point', range: 11, radius: 3.8, cap: 8, los: true, anim: 'cast', dur: .7,
    hits: [{ at: .7, beu: .55, n: 5, every: .6, once: 'pulse' }],
    budget: 2.75, vfx: 'vfx_063', sfx: 'sfx_063', icon: 'icon_063', ready: true,
  },
  {
    id: 'skill_064', slot: 'm4', lvl: 263, name: L('גן המגפה', 'Plague Garden'),
    desc: L('פרחים שחורים־סגולים נפתחים משורשים כהים לשדה של 4 שניות: שש פעימות, בכל אחת עלה כותרת זוהר נפתח ומשחרר נבגים. קצה הסכנה מסומן בבירור.', 'Black-violet flowers unfold from dark roots into a 4-second field: six ticks, each opening a glowing petal that releases spores. The danger edge is clearly drawn.'),
    tags: ['poison', 'aoe', 'field'], el: 'poison', cd: 24, cost: 42,
    tgt: 'point', range: 10, radius: 3.6, cap: 8, los: true, anim: 'summon', dur: .7,
    hits: [{ at: .7, beu: .42, n: 6, every: .66, once: 'pulse' }],
    budget: 2.52, vfx: 'vfx_064', sfx: 'sfx_064', icon: 'icon_064', ready: true,
  },
  {
    id: 'skill_065', slot: 'm5', lvl: 267, name: L('משמר כרונוס', 'Chronos Guard'),
    desc: L('מחוג שעון קופא בתוך בועת ארד שקופה: 5 שניות של 18% פחות נזק. פעם אחת, מכה שהייתה מפילה אותך משאירה אותך עם נקודת חיים אחת ומסיימת את הברכה.', 'A clock hand freezes inside a translucent bronze bubble: 5 seconds of 18% less damage taken. Once, a blow that would fell you leaves you at 1 health and ends the blessing.'),
    tags: ['selfcast', 'defense', 'time'], el: 'time', cd: 46, cost: 42,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { guard: .18, cheatDeath: 1, dur: 5, group: 'defense', rank: 3 },
    budget: 0, vfx: 'vfx_065', sfx: 'sfx_065', icon: 'icon_065', ready: true,
  },
  {
    id: 'skill_066', slot: 'm6', lvl: 271, name: L('ירידת נשמת הדרקון', 'Dragon Soul Descent'),
    desc: L('קומבו יורד של שלוש מכות; האחרונה מתעכבת מספיק כדי שאפשר להתחמק ממנה, ויש לה התזה קטנה סביב.', 'A descending three-hit combo; the last is delayed enough to be dodged and has a small splash around it.'),
    tags: ['physical', 'dragon', 'combo', 'multihit'], el: 'dragon', cd: 18, cost: 44,
    tgt: 'melee', range: 3, arc: 1.3, cap: 3, los: true, anim: 'flurry', dur: 1.2,
    hits: [{ at: .15, beu: .55, phase: 'claw1' }, { at: .4, beu: .65, phase: 'claw2' }, { at: .9, beu: .9, phase: 'crater', r: 2.4, cap: 5 }],
    budget: 2.1, vfx: 'vfx_066', sfx: 'sfx_066', icon: 'icon_066', ready: true,
  },
  {
    id: 'skill_083', slot: 'side', lvl: 260, name: L('טפיל הזמן', 'Chrono Parasite'),
    desc: L('חרק שעון קטן מארד ושחור נצמד לאויב: חמש פעימות נזק והאטה של 15% ל־3 שניות. אצל בוסים ההאטה מוגבלת ל־5%.', 'A small bronze-black clock insect latches onto the foe: five damage pulses and a 15% slow for 3 seconds. On bosses the slow is capped at 5%.'),
    tags: ['debuff', 'time', 'dot', 'single'], el: 'time', cd: 30, cost: 44,
    tgt: 'mark', range: 11, cap: 1, los: true, anim: 'gaze', dur: .55,
    dot: { kind: 'time', n: 5, every: .7, beu: .35, rule: 'refresh', max: 1, at: .45 },
    cc: [{ k: 'slow', amt: .15, dur: 3, elite: .67, boss: .33 }],
    budget: 1.75, vfx: 'vfx_083', sfx: 'sfx_083', icon: 'icon_083', ready: true,
  },
  {
    id: 'skill_095', slot: 'ult', ult: 4, lvl: 275, name: L('ריק הארבוס', 'Void of Erebus'),
    desc: L('בתוך מעגל מסומן הסביבה הופכת לכיס חסר כוכבים: חלקיקים רחוקים מתעקמים פנימה, קבוצות כוכבים שבורות מסתובבות לאחור ושרשראות צל עולות מהאדמה. השדה מתכווץ בחמש פעימות ואז מתפוצץ בגל הלם הפוך בשחור־זהב. אויבים רגילים נמשכים מעט ומתנודדים.', 'Inside a marked circle the world becomes a starless pocket: distant motes bend inward, broken constellations turn backward and shadow chains rise from the ground. The field contracts in five pulses, then explodes in a reversed black-gold shockwave. Ordinary foes are drawn in a little and staggered.'),
    tags: ['ultimate', 'physical', 'void', 'time', 'aoe', 'control'], el: 'void', cd: 120,
    tgt: 'point', range: 12, radius: 13, cap: 14, los: true, anim: 'ult', dur: 4.4,
    hits: [{ at: .9, beu: 2.0, phase: 'implode' }, { at: 1.4, beu: .9, n: 5, every: .4, phase: 'pulse', once: 'pulse' }, { at: 3.8, beu: 4.2, phase: 'lance' }],
    cc: [{ k: 'pull', amt: 2.5, elite: .4, boss: 0, center: true }, { k: 'stagger', dur: .5, elite: .5, boss: 0 }],
    budget: 10.7, vfx: 'vfx_095', sfx: 'sfx_095', icon: 'icon_095', ready: true,
  },
];
