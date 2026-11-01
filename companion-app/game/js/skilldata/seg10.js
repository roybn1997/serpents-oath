// Skill rework (v31), segment 10 of the Path of Ascent: levels 231-250, ultimate X (Elysium's Judgment). Data only; see
// seg01.js for the units and docs/skills-rework.md for the schema. Behaviour: js/skillpacks/seg10.js.
const L = (he, en) => ({ he, en });

export default [
  {
    id: 'skill_055', slot: 'm1', lvl: 231, name: L('מכת קוצר הריק', 'Void Reaver Strike'),
    desc: L('חתך כבד בשני שלבים: פגיעה פיזית, ואחרי 0.35 שניות הד ריק סגול נסגר דרך אותו מקום. אויב שזז בזמן מתחמק מההד.', 'A heavy two-phase cut: a physical hit, then 0.35 seconds later a violet void echo closes through the same space. A foe that moves in time evades the echo.'),
    tags: ['physical', 'void', 'delayed'], el: 'void', cd: 14, cost: 38,
    tgt: 'melee', range: 3, arc: 1.2, cap: 3, los: true, anim: 'smash', dur: .9,
    hits: [{ at: .35, beu: .65, phase: 'cut' }, { at: .7, beu: 1.35, phase: 'echo', evadable: true }],
    budget: 2.0, vfx: 'vfx_055', sfx: 'sfx_055', icon: 'icon_055', ready: true,
  },
  {
    id: 'skill_056', slot: 'm2', lvl: 234, name: L('עליית הוולקירי', 'Valkyrie Rise'),
    desc: L('לוחות כנף זהובים נפרשים ואת מזנקת למעלה: פגיעה קלה בהמראה, ואז צלילה שאת מכוונת במקשי התנועה בזמן המעוף (סמן מראה איפה תנחתי) עם פגיעה חזקה יותר.', 'Gold wing plates unfold and you launch upward: a light hit on take-off, then a descent you steer with your move keys while airborne (a reticle shows where you will land) for a stronger hit.'),
    tags: ['mobility', 'light', 'leap'], el: 'light', cd: 16, cost: 36,
    tgt: 'leap', move: 8, radius: 2.8, cap: 6, los: true, anim: 'slam', dur: 1.1, carry: true,
    hits: [{ at: .1, beu: .45, phase: 'launch', r: 2.4 }, { at: .85, beu: .8, phase: 'land' }],
    budget: 1.25, vfx: 'vfx_056', sfx: 'sfx_056', icon: 'icon_056', ready: true,
  },
  {
    id: 'skill_057', slot: 'm3', lvl: 237, name: L('צעד המטאור', 'Meteorstep'),
    desc: L('שלושה זינוקים קצרים לכיוונים שאת בוחרת, כל אחד משאיר עקבת מטאור בצבע אחר. כל אויב נפגע לכל היותר פעם אחת בכל זינוק; רק בזינוק הראשון את חמקנית לרגע.', 'Three short dashes in directions you choose, each leaving a meteor trace of its own colour. Each foe is struck at most once per dash; only the first dash makes you briefly untouchable.'),
    tags: ['mobility', 'fire', 'dash', 'multihit'], el: 'fire', cd: 18, cost: 36,
    tgt: 'dash', move: 4, width: 1.4, cap: 5, los: true, anim: 'dash', dur: 1.1, carry: true, iframes: .18,
    hits: [{ at: .06, beu: .48, n: 3, every: .36, phase: 'dash', once: 'pulse' }],
    budget: 1.44, vfx: 'vfx_057', sfx: 'sfx_057', icon: 'icon_057', ready: true,
  },
  {
    id: 'skill_058', slot: 'm4', lvl: 240, name: L('כתר הנחש', "Serpent's Crown"),
    desc: L('נחש רפאים חג מעל ומפיל שבעה חותמי קשקש בטבעת: ארבע פעימות רעל, ואויבים בתוכה מכים 8% חלש יותר ל־3 שניות (בוסים 3%).', 'A spectral serpent circles overhead and drops seven scale sigils in a ring: four poison ticks, and foes inside hit 8% weaker for 3 seconds (bosses 3%).'),
    tags: ['poison', 'aoe', 'debuff'], el: 'poison', cd: 20, cost: 38,
    tgt: 'point', range: 10, radius: 3.6, cap: 8, los: true, anim: 'summon', dur: .7,
    dot: { kind: 'poison', n: 4, every: .75, beu: .3, rule: 'refresh', max: 1, at: .75 },
    cc: [{ k: 'weaken', amt: .08, dur: 3, elite: 1, boss: .375 }],
    budget: 1.2, vfx: 'vfx_058', sfx: 'sfx_058', icon: 'icon_058', ready: true,
  },
  {
    id: 'skill_059', slot: 'm5', lvl: 243, name: L('משמר מקודש', 'Sanctified Ward'),
    desc: L('משמר לבן־זהוב נפרש לשלוש טבעות: מחסום של 14% מהחיים ל־6 שניות. המכה הראשונה מוחזרת ב־20% שלה כחנית אור, עד תקרה, פעם אחת בהטלה.', 'A white-gold ward unfolds into three rings: a barrier of 14% of your health for 6 seconds. The first blow is returned at 20% of its force as a spear of light, up to a cap, once per cast.'),
    tags: ['selfcast', 'barrier', 'counter'], el: 'light', cd: 44, cost: 38,
    tgt: 'self', anim: 'cast', dur: .5, onMove: true,
    buff: { shield: .14, reflect: .2, reflectCap: 1, dur: 6, group: 'shield', rank: 3 },
    budget: 0, vfx: 'vfx_059', sfx: 'sfx_059', icon: 'icon_059', ready: true,
  },
  {
    id: 'skill_060', slot: 'm6', lvl: 246, name: L('באר הכבידה', 'Gravity Well'),
    desc: L('כדור אינדיגו כהה נוצר בתוך מסלול זהוב לשתי שניות ומושך לאט אויבים רגילים פנימה; אז הוא קורס בטבעת חדה. בוסים לא זזים.', 'A dark indigo sphere forms inside a gold orbit for 2 seconds and slowly draws ordinary foes inward; then it collapses into a crisp ring. Bosses are never moved.'),
    tags: ['aoe', 'void', 'pull'], el: 'void', cd: 20, cost: 40,
    tgt: 'point', range: 11, radius: 4.2, cap: 8, los: true, anim: 'cast', dur: .7,
    hits: [{ at: 2.4, beu: 1.0, phase: 'collapse' }],
    cc: [{ k: 'pull', amt: 2.4, dur: 2, elite: .4, boss: 0, center: true }],
    budget: 1.0, vfx: 'vfx_060', sfx: 'sfx_060', icon: 'icon_060', ready: true,
  },
  {
    id: 'skill_082', slot: 'side', lvl: 240, name: L('פריחת אוורנוס', 'Avernus Bloom'),
    desc: L('פרח אדום־שחור נפתח מתפר תת־עולמי לשדה של 4 שניות: שש פעימות. פעימה צורבת באש השאול, או כרעל באויב שכבר מורעל: סוג אחד לכל אויב, אף פעם לא שניהם.', 'A red-black blossom opens from an underworld seam into a 4-second field: six pulses. A pulse sears as underworld fire, or as poison on a foe already poisoned: one kind per foe, never both.'),
    tags: ['aoe', 'fire', 'poison', 'field'], el: 'underworld', cd: 26, cost: 42,
    tgt: 'point', range: 10, radius: 3.4, cap: 8, los: true, anim: 'summon', dur: .7,
    hits: [{ at: .6, beu: .38, n: 6, every: .66, once: 'pulse' }],
    budget: 2.28, vfx: 'vfx_082', sfx: 'sfx_082', icon: 'icon_082', ready: true,
  },
  {
    id: 'skill_094', slot: 'ult', ult: 4, lvl: 250, name: L('משפט האליסיון', "Elysium's Judgment"),
    desc: L('צללית מכונפת ענקית נפרשת בשמיים בתוך הילה נעה של חותמים יווניים. שמונה חניתות ברק ננעצות באדמה במעגל, ואז נשק האווטאר יורד במכה אלכסונית אחרונה, האור החזק ביותר שמור לרגע הזה בלבד.', 'A colossal winged silhouette unfurls across the sky inside a moving halo of Greek sigils. Eight lightning spears pin the ground in a ring, then the avatar\'s weapon descends in a final diagonal strike; the brightest light is kept for that moment alone.'),
    tags: ['ultimate', 'physical', 'celestial', 'lightning', 'aoe'], el: 'celestial', cd: 120,
    tgt: 'around', radius: 12, cap: 13, los: true, anim: 'ult', dur: 4.2,
    hits: [{ at: 1.1, beu: 2.8, phase: 'avatar' }, { at: 1.8, beu: .6, n: 8, every: .15, phase: 'spears', once: 'pulse' }, { at: 3.6, beu: 2.4, phase: 'collapse' }],
    budget: 10, vfx: 'vfx_094', sfx: 'sfx_094', icon: 'icon_094', ready: true,
  },
];
