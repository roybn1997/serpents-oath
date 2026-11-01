// Skill rework (v31), segment 9 of the Path of Ascent: levels 206-230, ultimate IX (Ragnarok Engine). Data only; see seg01.js
// for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg09.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_049', slot: 'm1', lvl: 206, name: L('סופת החניתות', 'Cyclone of Spears'),
    desc: L('סחרור מבוקר של חמש פעימות ברדיוס בינוני: שלוש חניתות רפאים חגות סביבך בגבהים שונים, וכל אויב נפגע לכל היותר פעם אחת בכל פעימה.', 'A controlled spin of five pulses in a medium radius: three spectral spears circle you at different heights, and each foe is struck at most once per pulse.'),
    tags: ['physical', 'aoe', 'multihit'], el: 'physical', cd: 14, cost: 34,
    tgt: 'around', radius: 3.8, cap: 8, los: true, anim: 'whirl', dur: 1.4, move: .5,
    hits: [{ at: .2, beu: .34, n: 5, every: .24, once: 'pulse' }],
    budget: 1.7, vfx: 'vfx_049', sfx: 'sfx_049', icon: 'icon_049', ready: true,
  },
  {
    id: 'skill_050', slot: 'm2', lvl: 210, name: L('צלילת חנית הדרקון', 'Dragon Spear Dive'),
    desc: L('קפיצה בקשת מכוונת וצלילה אל נקודת המטרה: רק הנחיתה פוגעת, במעגל בינוני, ומשאירה מכתש קשקשי דרקון.', 'A leap in an aimed arc and a dive to the target point: only the landing strikes, in a medium circle, leaving a dragon-scale crater.'),
    tags: ['mobility', 'dragon', 'aoe'], el: 'dragon', cd: 12, cost: 34,
    tgt: 'leap', move: 9, radius: 3.2, cap: 8, los: true, anim: 'slam', dur: 1, carry: true,
    hits: [{ at: .8, beu: 1.55, phase: 'land' }],
    budget: 1.55, vfx: 'vfx_050', sfx: 'sfx_050', icon: 'icon_050', ready: true,
  },
  {
    id: 'skill_051', slot: 'm3', lvl: 214, name: L('חותם הקיפאון', 'Stasis Sigil'),
    desc: L('כלוב שעון גיאומטרי מתרחב מנקודת המטרה: פגיעה והאטה של 35% לשתי שניות לאויבים רגילים, 15% לעילית ו־8% לבוסים. זה לא עצירת זמן.', 'A geometric clock cage expands from the target point: a hit and a 35% slow for 2 seconds on ordinary foes, 15% on elites and 8% on bosses. It is not a time stop.'),
    tags: ['control', 'time', 'slow', 'aoe'], el: 'time', cd: 18, cost: 36,
    tgt: 'point', range: 11, radius: 3.6, cap: 8, los: true, anim: 'cast', dur: .7,
    hits: [{ at: .45, beu: .7 }],
    cc: [{ k: 'slow', amt: .35, dur: 2, elite: .43, boss: .23 }],
    budget: .7, vfx: 'vfx_051', sfx: 'sfx_051', icon: 'icon_051', ready: true,
  },
  {
    id: 'skill_052', slot: 'm4', lvl: 218, name: L('עמוד אש התופת', 'Hellfire Column'),
    desc: L('סדק אדום־כהה נפתח אחרי אזהרה של 0.75 שניות ושלושה עמודי אש פועמים ממנו: שדה של 4 שניות עם שש פעימות.', 'A dark-red fissure opens after a 0.75-second warning and three hellish pillars pulse up from it: a 4-second field of six ticks.'),
    tags: ['aoe', 'fire', 'field'], el: 'fire', cd: 20, cost: 36,
    tgt: 'point', range: 11, radius: 3.2, cap: 8, los: true, anim: 'cast', dur: .7, tele: .75,
    hits: [{ at: 1.0, beu: .35, n: 6, every: .66, once: 'pulse' }],
    budget: 2.1, vfx: 'vfx_052', sfx: 'sfx_052', icon: 'icon_052', ready: true,
  },
  {
    id: 'skill_053', slot: 'm5', lvl: 222, name: L('אחיזת אטלס', 'Atlas Brace'),
    desc: L('קווי מפת אטלס מאבן נכרכים סביב הגוף: 6 שניות של 25% פחות נזק ו־20% עמידות לטלטלות. המכה הראשונה שנבלעת נותנת 10% נזק לזמן קצר, פעם אחת בהטלה.', 'Stone atlas-map lines wrap round your body: 6 seconds of 25% less damage taken and 20% stagger resistance. The first blow absorbed grants 10% damage for a short time, once per cast.'),
    tags: ['selfcast', 'defense'], el: 'earth', cd: 44, cost: 36,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { guard: .25, poise: .2, dur: 6, group: 'defense', rank: 3, onHit: { power: .1, dur: 3 } },
    budget: 0, vfx: 'vfx_053', sfx: 'sfx_053', icon: 'icon_053', ready: true,
  },
  {
    id: 'skill_054', slot: 'm6', lvl: 226, name: L('מטח מתכת הכוכבים', 'Starforged Barrage'),
    desc: L('שבעה בריחי מתכת כוכבים יוצאים בנתיבים מדורגים, מתפזרים מעט אבל מעדיפים את המטרה הנוכחית, ונעצרים בקירות.', 'Seven star-metal bolts launch on staggered lanes; they spread slightly but favour your current target, and walls stop them.'),
    tags: ['magic', 'projectile', 'multihit'], el: 'celestial', cd: 10, cost: 34,
    tgt: 'proj', range: 14, speed: 28, cap: 3, los: true, anim: 'throw', dur: .9,
    hits: [{ at: .3, beu: .42, n: 7, every: .08, travel: true }],
    budget: 2.94, vfx: 'vfx_054', sfx: 'sfx_054', icon: 'icon_054', ready: true,
  },
  {
    id: 'skill_081', slot: 'side', lvl: 220, name: L('גמול הגורל', 'Fated Reprisal'),
    desc: L('טבעת חוטי גורל זהובים נסגרת סביבך ל־0.55 שניות: אם חסמת מכה, החוטים ננתקים לכוכב משושה ופוגעים סביבך. אם לא, רק 8% פחות נזק לרגע קצר.', 'A ring of golden fate threads tightens round you for 0.55 seconds: if you block a blow, they snap out into a six-point star and strike around you. If not, only 8% less damage for a moment.'),
    tags: ['counter', 'aoe'], el: 'light', cd: 22, cost: 38,
    tgt: 'around', radius: 3, cap: 6, los: true, anim: 'aegis', dur: .75, parry: .55,
    hits: [{ at: .55, beu: 1.4, cond: 'counter' }],
    buff: { guard: .08, dur: 1.5, cond: 'alt', group: 'parry', rank: 1 },
    budget: 1.4, vfx: 'vfx_081', sfx: 'sfx_081', icon: 'icon_081', ready: true,
  },
  {
    id: 'skill_093', slot: 'ult', ult: 4, lvl: 230, name: L('מנוע הרגנרוק', 'Ragnarok Engine'),
    desc: L('שרשרת מטאורים ענקיים חוצה את השמיים בקצב קריא, ודרקון רפאים מזנק בין אזורי הפגיעה ומושך את הסדקים לחותם געשי אחד. הגמר מתפרץ בשכבות של סלע, להבה, טבעות הלם וקשקשים, ומשאיר בעירה.', 'A chain of huge meteors crosses the sky at a readable cadence, and a spectral dragon lunges between the impact zones, pulling the cracks into one volcanic sigil. The finale erupts in layers of rock, flame, shock rings and scales, and leaves a burn.'),
    tags: ['ultimate', 'physical', 'fire', 'meteor', 'dragon', 'aoe'], el: 'fire', cd: 120,
    tgt: 'point', range: 12, radius: 12, cap: 13, los: true, anim: 'ult', dur: 4,
    hits: [{ at: 1.0, beu: 1.4, n: 3, every: .5, phase: 'meteor', once: 'pulse' }, { at: 2.8, beu: 2.5, phase: 'rupture' }],
    dot: { kind: 'burn', n: 4, every: .5, beu: .55, rule: 'refresh', max: 1 },
    budget: 8.9, vfx: 'vfx_093', sfx: 'sfx_093', icon: 'icon_093', ready: true,
  },
];
