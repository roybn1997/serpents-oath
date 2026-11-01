// Skill rework (v31), segment 7 of the Path of Ascent: levels 151-180, ultimate VII (Atlas Unbound). Data only; see seg01.js
// for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg07.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_037', slot: 'm1', lvl: 151, name: L('דהירת לב הדרקון', 'Dragonheart Overdrive'),
    desc: L('חותם לב דרקון שקוף פועם מאחורייך: 7 שניות של 18% יותר נזק ו־10% מהירות התקפה. לא נערם עם ריכוז אולימפי: הברכה החזקה מחליפה את החלשה.', 'A translucent dragon-heart sigil beats behind you: 7 seconds of 18% more damage and 10% attack speed. It never stacks with Olympian Focus: the stronger blessing replaces the weaker.'),
    tags: ['selfcast', 'buff', 'haste'], el: 'dragon', cd: 38, cost: 32,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { power: .18, atkSpeed: .1, dur: 7, group: 'offense', rank: 2 },
    budget: 0, vfx: 'vfx_037', sfx: 'sfx_037', icon: 'icon_037', ready: true,
  },
  {
    id: 'skill_038', slot: 'm2', lvl: 155, name: L('מכת מעלה הרסנית', 'Ruinous Uppercut'),
    desc: L('מכה עולה כבדה בקשת משוננת בצורת עמוד: אויבים רגילים מועפים לרגע באוויר, עילית פחות, ובוסים לא מועפים בכלל.', 'A heavy rising strike in a jagged pillar-shaped arc: ordinary foes are lifted briefly, elites less, and bosses are never launched.'),
    tags: ['physical', 'launch', 'single'], el: 'earth', cd: 10, cost: 28,
    tgt: 'melee', range: 2.8, arc: 1, cap: 2, los: true, anim: 'smash', dur: .7,
    hits: [{ at: .4, beu: 1.7 }],
    cc: [{ k: 'launch', dur: .6, elite: .4, boss: 0 }],
    budget: 1.7, vfx: 'vfx_038', sfx: 'sfx_038', icon: 'icon_038', ready: true,
  },
  {
    id: 'skill_039', slot: 'm3', lvl: 159, name: L('צעד הברק', 'Lightning Step'),
    desc: L('זינוק קצר ומהיר: רק בזמן התנועה (0.25 שניות) את חמקנית מנזק, וכל מי שאת חוצה נפגע. לא עוברת דרך קירות.', 'A fast short dash: only during the travel (0.25 seconds) you avoid damage, and every foe you cross is struck. It never blinks through solid walls.'),
    tags: ['mobility', 'lightning', 'dash'], el: 'lightning', cd: 10, cost: 26,
    tgt: 'dash', move: 6, width: 1.4, cap: 6, los: true, anim: 'dash', dur: .4, carry: true, iframes: .25,
    hits: [{ at: .06, beu: 1.0, phase: 'path', once: 'cast' }],
    budget: 1.0, vfx: 'vfx_039', sfx: 'sfx_039', icon: 'icon_039', ready: true,
  },
  {
    id: 'skill_040', slot: 'm4', lvl: 163, name: L('שדה מפולת הכפור', 'Frostfall Field'),
    desc: L('קבוצות נטיפים נוצרות מעל ונופלות בטבעות מדורגות: שדה של 4 שניות, חמש פעימות נזק והאטה של 18%; כל פעימה שלישית מרתקת אויבים רגילים ל־0.35 שניות.', 'Icicle constellations form overhead and drop in staggered rings: a 4-second field of five damage ticks and an 18% slow; every third tick roots ordinary foes for 0.35 seconds.'),
    tags: ['aoe', 'ice', 'control', 'field'], el: 'ice', cd: 18, cost: 32,
    tgt: 'point', range: 11, radius: 4, cap: 8, los: true, anim: 'cast', dur: .7,
    hits: [{ at: .6, beu: .26, n: 5, every: .8, once: 'pulse' }],
    cc: [{ k: 'slow', amt: .18, dur: 4, elite: .6, boss: .3 }, { k: 'root', dur: .35, every: 3, elite: .5, boss: 0 }],
    budget: 1.3, vfx: 'vfx_040', sfx: 'sfx_040', icon: 'icon_040', ready: true,
  },
  {
    id: 'skill_041', slot: 'm5', lvl: 167, name: L('אות התופת', 'Infernal Brand'),
    desc: L('חותם אדום עם שלוש קרני גחלת נצרב על האויב: פגיעה ואחריה חמש פעימות אש. הטלה חוזרת מרעננת את הזמן ולא מכפילה.', 'A red seal with three ember horns brands the foe: a hit and then five fire pulses. Reapplying it refreshes the time and never multiplies it.'),
    tags: ['fire', 'dot', 'single'], el: 'fire', cd: 14, cost: 28,
    tgt: 'mark', range: 11, cap: 1, los: true, anim: 'gaze', dur: .55,
    hits: [{ at: .35, beu: .5 }],
    dot: { kind: 'burn', n: 5, every: 1, beu: .24, rule: 'refresh', max: 1 },
    budget: 1.7, vfx: 'vfx_041', sfx: 'sfx_041', icon: 'icon_041', ready: true,
  },
  {
    id: 'skill_042', slot: 'm6', lvl: 171, name: L('מגרפת הכוכבים', 'Celestial Rake'),
    desc: L('חמישה חתכים מקושרים בזוויות שונות בונים תבנית כוכב; אם לפחות שלושה מהם פגעו, המכה האחרונה סוגרת את הכוכב בנזק נוסף.', 'Five linked slashes at different angles build a star pattern; if at least three of them connect, the final hit closes the star for extra damage.'),
    tags: ['physical', 'combo', 'multihit'], el: 'celestial', cd: 12, cost: 28,
    tgt: 'melee', range: 3, arc: 1.3, cap: 3, los: true, anim: 'flurry', dur: 1.1,
    hits: [{ at: .12, beu: .36, n: 5, every: .17 }, { at: .95, beu: .35, cond: 'full', phase: 'star' }],
    budget: 2.15, vfx: 'vfx_042', sfx: 'sfx_042', icon: 'icon_042', ready: true,
  },
  {
    id: 'skill_079', slot: 'side', lvl: 165, name: L('בבואת הדרקון', "Dragon's Afterimage"),
    desc: L('זינוק קצר שפוגע, ואחריו בבואת דרקון שמתפתלת סביב המסלול ומכה פעמיים מצדדים מתחלפים אם האויב עוד קרוב.', 'A short dash that strikes, then a dragon-shaped afterimage coils round the path and claws twice from alternating sides if the foe is still near.'),
    tags: ['mobility', 'combo', 'dragon'], el: 'dragon', cd: 16, cost: 34,
    tgt: 'dash', move: 5, width: 1.4, cap: 4, los: true, anim: 'dash', dur: .5, carry: true,
    hits: [{ at: .08, beu: .5, phase: 'path', once: 'cast' }, { at: .7, beu: .4, n: 2, every: .25, phase: 'claw', r: 2.6 }],
    budget: 1.3, vfx: 'vfx_079', sfx: 'sfx_079', icon: 'icon_079', ready: true,
  },
  {
    id: 'skill_091', slot: 'ult', ult: 3, lvl: 180, name: L('אטלס המשוחרר', 'Atlas Unbound'),
    desc: L('שתי זרועות אבן ענקיות מתרוממות בקצות הזירה המסומנת ומתנגשות סביב נקודת המטרה: שבר עצום בצורת יהלום, סלעים מרחפים וגל לחץ נראה לעין. את נשארת גלויה בקדמת התמונה.', 'Two towering stone arms rise at opposite edges of the marked arena and collide round your target point: a giant diamond-shaped fracture, floating boulders and a visible pressure wave. You stay visible in the foreground.'),
    tags: ['ultimate', 'physical', 'earth', 'aoe'], el: 'earth', cd: 110,
    tgt: 'point', range: 12, radius: 11, cap: 12, los: true, anim: 'ult', dur: 3.6,
    hits: [{ at: 1.2, beu: 1.5, n: 2, every: .35, phase: 'arms', once: 'pulse' }, { at: 2.2, beu: 2.6, phase: 'earthburst' }, { at: 2.7, beu: .45, n: 3, every: .4, phase: 'shock', once: 'pulse' }],
    cc: [{ k: 'stun', dur: .7, elite: .5, boss: 0 }],
    budget: 6.95, vfx: 'vfx_091', sfx: 'sfx_091', icon: 'icon_091', ready: true,
  },
];
