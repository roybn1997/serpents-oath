// Skill rework (v31), segment 12 of the Path of Ascent: levels 276-299, ultimate XII (Primordial Olympus Breaks). Data only;
// see seg01.js for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg12.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_067', slot: 'm1', lvl: 276, name: L('מבקע האולימפוס', 'Olympus Cleaver'),
    desc: L('חיתוך סהר כבד בלהב זהב מונומנטלי לרוחב נתיב ההתקפה. אויבים רגילים עם מגן או שריון סופגים תוספת; שלבי בוסים לא נעקפים.', 'A heavy crescent cleave with a monumental golden blade across the attack lane. Ordinary foes with a shield or armour take extra; boss phases are never bypassed.'),
    tags: ['physical', 'cone', 'broad'], el: 'physical', cd: 18, cost: 46,
    tgt: 'cone', range: 4.6, arc: 2.2, cap: 8, los: true, anim: 'sweep', dur: .8,
    hits: [{ at: .4, beu: 2.35 }, { at: .4, beu: .4, cond: 'armored' }],
    budget: 2.35, budgetNote: '+0.4 BEU on shielded or armoured ordinary foes only.', budgetMax: 2.75,
    vfx: 'vfx_067', sfx: 'sfx_067', icon: 'icon_067', ready: true,
  },
  {
    id: 'skill_068', slot: 'm2', lvl: 280, name: L('בקע קו העולם', 'Worldline Rift'),
    desc: L('שני בקעים מלבניים גבוהים נפתחים בנקודות שונות; קליע נבלע באחד ומתפרץ מהשני, שלוש פגיעות על אויבים שבנתיב הגלוי.', 'Two tall rectangular rifts open at separate points; a projectile vanishes into one and erupts from the other: three hits on foes along the visible lane.'),
    tags: ['magic', 'void', 'combo', 'line'], el: 'void', cd: 22, cost: 46,
    tgt: 'line', range: 13, width: 1.4, cap: 5, los: true, anim: 'throw', dur: .9,
    hits: [{ at: .4, beu: .65, n: 3, every: .18, once: 'pulse' }],
    budget: 1.95, vfx: 'vfx_068', sfx: 'sfx_068', icon: 'icon_068', ready: true,
  },
  {
    id: 'skill_069', slot: 'm3', lvl: 284, name: L('לידת הפניקס מחדש', 'Phoenix Rebirth'),
    desc: L('צללית עוף חול נבנית מאפר ארגמני סביבך: ריפוי של 16% מהחיים, האטה שפועלת עלייך נשרפת, ו־12% נזק ל־5 שניות. לא מקימה מהמתים.', 'A phoenix silhouette forms from crimson ash around you: a heal of 16% of your health, a slow on you burnt away, and 12% damage for 5 seconds. It never raises the dead.'),
    tags: ['selfcast', 'heal', 'buff'], el: 'fire', cd: 60, cost: 48,
    tgt: 'self', anim: 'cast', dur: .6, onMove: true,
    heal: { pct: .16 },
    buff: { power: .12, cleanse: 1, dur: 5, group: 'offense', rank: 2 },
    budget: 0, vfx: 'vfx_069', sfx: 'sfx_069', icon: 'icon_069', ready: true,
  },
  {
    id: 'skill_070', slot: 'm4', lvl: 288, name: L('קרע הטרטרוס', 'Rupture of Tartarus'),
    desc: L('תפרים שחורים־אדומים מבקעים את האדמה: פגיעה בפתיחה ואחריה חמש פעימות שבהן ידיים כבולות עולות. אויבים רגילים נגררים מעט אל הסדק, בוסים רק מואטים.', 'Black-red seams split the ground: a hit as it opens, then five pulses as chained hands reach up. Ordinary foes are dragged slightly toward the fissure; bosses are only slowed.'),
    tags: ['aoe', 'underworld', 'field', 'pull'], el: 'underworld', cd: 26, cost: 48,
    tgt: 'line', range: 10, width: 3, cap: 8, los: true, anim: 'summon', dur: .8,
    hits: [{ at: .5, beu: .5, phase: 'open' }, { at: 1.0, beu: .42, n: 5, every: .6, phase: 'hands', once: 'pulse' }],
    cc: [{ k: 'pull', amt: 1.2, elite: .4, boss: 0 }, { k: 'slow', amt: .15, dur: 3, elite: 1, boss: 1, bossOnly: true }],
    budget: 2.6, vfx: 'vfx_070', sfx: 'sfx_070', icon: 'icon_070', ready: true,
  },
  {
    id: 'skill_071', slot: 'm5', lvl: 292, name: L('תנופת האווטאר', "Avatar's Momentum"),
    desc: L('הילה מפולחת חגה מאחורייך ומשלבת חמישה סמלי יסודות: 8 שניות של 16% נזק, 10% מהירות ו־10% עמידות לשליטה. לא נערמת עם ברכות התקפה גדולות אחרות.', 'A segmented halo turns behind you, joining five small elemental symbols: 8 seconds of 16% damage, 10% speed and 10% crowd-control resistance. It never stacks with other major offence blessings.'),
    tags: ['selfcast', 'buff'], el: 'celestial', cd: 52, cost: 50,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { power: .16, speed: .1, cc: .1, dur: 8, group: 'offense', rank: 3 },
    budget: 0, vfx: 'vfx_071', sfx: 'sfx_071', icon: 'icon_071', ready: true,
  },
  {
    id: 'skill_072', slot: 'm6', lvl: 296, name: L('רומח הקדמונים', 'Primordial Lance'),
    desc: L('רסיסי אבן, אש, קרח וכוכבים חגים ונדחסים לחנית: טעינה של עד 0.8 שניות עם מד ברור: החזיקי את המקש כדי לטעון, לחיצה קצרה טוענת עד הסוף מעצמה. שחרור מלא פוגע בקו צר חודר בעוצמה מלאה, שחרור מוקדם בפחות.', 'Stone, fire, ice and star fragments orbit and compress into a spear: a charge of up to 0.8 seconds with a clear meter. Hold the key to charge; a tap charges in full by itself. A full release strikes a narrow piercing line at full force, an early one for less.'),
    tags: ['magic', 'pierce', 'charge', 'line'], el: 'celestial', cd: 24, cost: 52,
    tgt: 'line', range: 15, width: 1.1, cap: 6, los: true, anim: 'throw', dur: 1.1, charge: .8,
    hits: [{ at: .85, beu: 2.8, cond: 'full' }, { at: .85, beu: 1.8, cond: 'alt' }],
    budget: 2.8, vfx: 'vfx_072', sfx: 'sfx_072', icon: 'icon_072', ready: true,
  },
  {
    id: 'skill_084', slot: 'side', lvl: 285, name: L('מצפן אוכל הכוכבים', "Star-Eater's Compass"),
    desc: L('ארבע מחטי קבוצת כוכבים חגות סביב סמן על אויב אחד לשנייה, מתיישרות ומשגרות נקודת כוכב. אם האויב נכנס מאחורי מחסה, היא פוגעת במיקום התקף האחרון ולא עוברת דרך קירות.', 'Four constellation needles circle a marker on one foe for a second, align and launch a star-point. If the foe moves behind cover it strikes the last valid position, never through walls.'),
    tags: ['magic', 'single', 'delayed'], el: 'celestial', cd: 30, cost: 46,
    tgt: 'mark', range: 13, cap: 1, los: true, anim: 'gaze', dur: .6,
    hits: [{ at: 1.0, beu: 2.0, phase: 'star' }],
    budget: 2.0, vfx: 'vfx_084', sfx: 'sfx_084', icon: 'icon_084', ready: true,
  },
  {
    id: 'skill_096', slot: 'ult', ult: 5, lvl: 299, name: L('שבירת האולימפוס הקדמון', 'Primordial Olympus Breaks'),
    desc: L('השמיים נסדקים לרקיע יווני בשכבות, צללית טיטאן נשענת על האופק ואש קדמונית משרטטת חותם מתחתייך. דרקון של קשקשי גחלת וכוכבים חוצה את השמיים, מטאורים מתכנסים, ואת מתרוממת, אוספת שיש, ברק, להבה, קרח וכוכבים לנשק ענק, ומכה מכה אחת שאין לטעות בה.', 'The sky fractures into a layered Greek firmament, a titan silhouette braces the horizon and primordial fire traces a sigil beneath you. A dragon of ember scales and stars crosses the sky, meteors converge, and you rise, gathering marble, lightning, flame, ice and stars into a gigantic weapon, and deliver one unmistakable strike.'),
    tags: ['ultimate', 'physical', 'primordial', 'titan', 'dragon', 'fire', 'lightning', 'cosmic', 'aoe'], el: 'primordial', cd: 150,
    tgt: 'around', radius: 14, cap: 15, los: true, anim: 'ult', dur: 5.4,
    hits: [{ at: .9, beu: 2.5, phase: 'titan' }, { at: 1.6, beu: .75, n: 4, every: .35, phase: 'ring', once: 'pulse' }, { at: 3.2, beu: 3.0, phase: 'convergence' }, { at: 4.6, beu: 5.0, phase: 'primordial' }],
    budget: 13.5, vfx: 'vfx_096', sfx: 'sfx_096', icon: 'icon_096', ready: true,
  },
];
