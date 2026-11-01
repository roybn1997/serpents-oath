// The Serpent's Oath: the skill book (round 15). Fifty skills in five tiers of ten (and three more in round 22: Charge,
// Pegasus' Bound, Hades' Veil): the first fourteen live where they always did (data in weapons.js SKILLS, casts in
// skills.js CAST); the rest live here, whole:
//   BOOK       their data (merged into SKILLS by weapons.js; same fields as K() there)
//   BOOK_DRAW  their 24 px icons (merged into SKILL_DRAW in weapons.js; d is a Px canvas, c the skill's colour)
//   BOOK_CAST  their casts (merged into CAST in skills.js): (g, p, s, tgt) -> per-frame tick (dt, t 0..1)
//   BOOK_SND   their phase sounds (merged into PHASE_SND in skills.js)
// and the blessings (short buffs) a few of them give: bless() adds to Hero.temp, which rpg.js counts in the hero's bonus.
// Tiers by the level a skill unlocks at: I 1-5, II 6-11, III 12-17, IV 18-23, V 24-30 (gradeOf). Its power grows with
// that level (weapons.js) and every blow rides the weapon in hand (g.hitEnemy -> rpg.js skillBase), like the old ones.
// This file imports only three and audio, so weapons.js and skills.js can both import it without a cycle.
import * as THREE from './three.module.min.js';
import * as AUD from './audio.js';
import { pxGlow, pxTag, pxify, PX, fxCount, fxLow } from './pxfx.js';
import { kitMat, paGrit } from './pxart.js';
import { addOutline } from './render.js';

const PI = Math.PI, V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const GRADES = [1, 6, 12, 18, 24];
export const gradeOf = (unlock = 1) => GRADES.reduce((n, lv, i) => (unlock >= lv ? i + 1 : n), 1);
// what the story itself hands V (a priestess, a god, a friend, Medusa): never sold in any shop
// (round 22: the priestess gave Pegasus' Bound, so Athena's Shield Charge is taught in the temples like any other.
// Round 23: her gift is Skin of Stone (firstGift) and the Bound is a level-30 temple skill; both are taught in the
// temples, so a save past chapter 1 can still learn the gift)
export const STORY_GIFTS = ['whirl', 'fate', 'hellfire', 'gaze', 'wave', 'venomtrail'];
const SHOP = { he: 'כוהני המקדשים מלמדים אותו, תמורת דרכמות', en: 'Temple priests teach it, for drachmas' };

// ---------------------------------------------------------------------------------------------
// data (the same order of fields as K() in weapons.js)
// ---------------------------------------------------------------------------------------------
// Charge/Dash (Roy 31.10: "the first skill's animation twice as fast so it feels better"): the rush plays in half the time it
// did (.55 s) and covers the same 4 m (BOOK_CAST.charge steps range / (dur x .68) a second, over the same part of the play)
export const CHARGE_DUR = .275;
const K = (id, color, bg, mana, cd, needs, anim, dur, unlock, name, desc, extra) => ({ id, color, bg, mana, cd, needs, anim, dur, unlock, name, desc, source: SHOP, ...extra });
export const BOOK = [
  // ---- tier I (levels 1-5)
  // round 22 (Roy): the weak first skill V buys with her own money in the town before the journey (story/shops tutorial)
  K('charge', '#e8c890', '#3a2a18', 8, 6, null, 'charge', CHARGE_DUR, 1, // (Roy 31.10: twice as quick, .55 -> .275 s; the same 4 m)
    { he: 'הסתערות', en: 'Charge' },
    { he: 'ריצה קצרה של 4 מטרים קדימה. עם מגן, את מסתערת מאחוריו ודוחפת לאחור את מי שבדרך. בלי מגן, הנשק שבידך מוביל, החוד קודם, ופוגע חזק יותר.', en: 'A short 4 m rush. With a shield you charge behind it and shove back whoever is in the way. Without one, the weapon in your hand leads, point first, and hits harder.' },
    { power: .7, range: 4, width: 1.2, knock: 1.6, stagger: .4, pointPower: 1, pointKnock: .3, pointStagger: .2 }), // round 23: knock/stagger behind a shield (a hard shove), point* when the weapon leads
  // round 31 (Roy): Ember Burst is gone; in its place a sweep of blue fire half again as long as the weapon's reach (id 'bluearc')
  K('bluearc', '#5ab8ff', '#0c1e3a', 14, 6, null, 'sweep', .55, 2,
    { he: 'הקשת של פרומתאוס', en: "Prometheus' Arc" },
    { he: 'הנשק מטאטא כמעט חצי עיגול עטוף באש הכחולה של פרומתאוס, ומגיע רחוק פי אחד וחצי מהנשק עצמו: כל מי שבקשת נפגע מיד.', en: "Your weapon sweeps nearly half a circle wreathed in Prometheus' blue fire, reaching half again as far as the weapon itself: everyone in the arc is struck at once." },
    { power: 1.1, arc: 2.8, reachMul: 1.5 }),
  K('pierce', '#e8d8a8', '#3a2a14', 12, 5, 'reach', 'dash', .5, 2,
    { he: 'דקירת ההופליט', en: 'Hoplite Thrust' },
    { he: 'צעד קדימה ודקירה ארוכה אחת: החנית עוברת דרך כל מי שבקו של 5.5 מטרים ודוחפת אותם לאחור. דורש חנית או רומח.', en: 'One step and one long thrust: the point goes through everyone in a 5.5 m line and drives them back. Needs a spear or a polearm.' },
    { power: 1.5, range: 5.5, width: 1.1, lunge: 1.6, knock: 1.4 }),
  K('fangs', '#8fe05a', '#16301a', 14, 6, 'dual', 'flurry', .5, 3,
    { he: 'נשיכת הצפע', en: "Viper's Bite" },
    { he: 'שני חתכים מוצלבים ומהירים, והלהבים משאירים ארס שמרעיל את האויב למשך 5 שניות. דורש זוג להבים.', en: 'Two quick crossing cuts, and the blades leave venom that poisons the foe for 5s. Needs a pair of blades.' },
    { power: .8, reach: 3.4, poison: 5, time: 5 }), // round 31 (Roy): the cuts reach out from her, not hugging her
  K('cleave', '#ffb07a', '#3a1c10', 16, 6, 'twohand', 'sweep', .6, 4,
    { he: 'חבטה רחבה', en: 'Wide Cleave' },
    { he: 'תנופה רחבה אחת בשתי ידיים שמכסה כמעט את כל מה שלפנייך: פוגעת, הודפת ומערערת את כל מי שבטווח 3.8 מטרים. דורש נשק דו־ידני.', en: 'One wide two-handed swing that covers nearly everything in front of you: it hits, knocks back and staggers everyone within 3.8 m. Needs a two-handed weapon.' },
    { power: 1.4, radius: 3.8, arc: 3.8, knock: 1.6, stagger: .5 }),
  // round 23: Athena's gift by the priestess in chapter 1 (firstGift, story.js FIRST_GIFT), in place of Pegasus' Bound.
  // A guard, nothing like the Charge she buys: Athena's own marble (her statues), and the aegis that bears Medusa's head
  // turns things to stone, the very thing the priestess has just told her to seek. Temples teach it too (it is not in
  // STORY_GIFTS), so a save already past chapter 1 can still learn it; a save that got the Bound keeps it.
  K('stoneskin', '#c8b898', '#2e2a24', 18, 20, null, 'cast', .6, 5,
    { he: 'עור של אבן', en: 'Skin of Stone' },
    { he: 'העור שלך מתקשה כמו שיש: במשך 8 שניות כל מכה שאת סופגת חלשה ב־25%.', en: 'Your skin hardens like marble: for 8s every blow you take is 25% weaker.' },
    { guard: .25, time: 8, buff: true, onMove: true, firstGift: true, source: { he: 'מתנה מאתנה, בידי הכוהנת שלה. גם כוהני המקדשים מלמדים אותו', en: "Athena's gift, from her priestess. Temple priests teach it too" } }),
  K('zephyr', '#bff0d8', '#123a30', 16, 14, null, 'fate', .6, 5,
    { he: 'משב הזפיר', en: "Zephyr's Gust" },
    { he: 'רוח המערב פורצת סביבך והודפת את כל מי שבטווח 4.5 מטרים, ואז נושאת אותך: מהירות גבוהה ב־30% למשך 6 שניות.', en: 'The west wind bursts around you and blows back everyone within 4.5 m, then carries you: 30% faster for 6s.' },
    { power: .4, radius: 4.5, knock: 3, speed: .3, time: 6, buff: true }),
  // ---- tier II (levels 6-11)
  // round 31 (Roy): Winter Breath is gone; in its place a flash out along the strike and straight back (id 'shuttle')
  K('shuttle', '#ffd86a', '#3a2a08', 22, 10, null, 'dash', .6, 7,
    { he: 'הבוכיר של אראכנה', en: "Arachne's Shuttle" },
    { he: 'כמו בוכיר בנול של אראכנה: את חוצה 6 מטרים קדימה בהבזק וחוזרת מיד באותו קו, חותכת כל מי שבדרך בשני הכיוונים ומשאירה אחרייך שובל זהוב של החתך.', en: "Like the shuttle through Arachne's loom: you flash 6 m ahead along your strike and straight back down the same line, cutting everyone in the way both times, and leave a golden trail of the cut behind you." },
    { power: .9, range: 6, width: 1.3 }),
  // round 22 (Roy): see-through, and through walls, for six seconds (the world's colliders let her pass; see veilOn)
  // round 31 (Roy): twenty seconds, and the monsters can't see her either (Enemy.target, entities.js)
  K('veil', '#a8b8f0', '#141a34', 24, 45, null, 'fog', .5, 9,
    { he: 'הצעיף של האדס', en: "Hades' Veil" },
    { he: 'את הופכת שקופה כמו צל של השאול: במשך 20 שניות את עוברת דרך קירות, גדרות וסלעים, והמפלצות לא רואות אותך: הן מאבדות אותך, לא רודפות אחרייך ולא תוקפות. כשהקסם נגמר את יוצאת למקום הפנוי הקרוב.', en: 'You turn see-through like a shade of the Underworld: for 20s you walk through walls, fences and rocks, and monsters cannot see you: they lose you, and neither chase nor attack you. When it ends you step out to the nearest open spot.' },
    { time: 20, aim: .01 }),
  // round 31 (Roy): the first blow that lands in the guard is swallowed and sent back to its striker twice as hard
  K('riposte', '#ffe6a0', '#3a2a10', 18, 9, 'shield', 'aegis', 1.2, 7,
    { he: 'מכת נגד', en: 'Riposte' },
    { he: 'את נועלת את המגן ומחכה למכה: המכה הראשונה שמגיעה אלייך נבלעת במגן ולא פוגעת בך, ואת מחזירה אותה לתוקף בכפליים ומהממת אותו. אם אף אחד לא מכה, את עונה בסוף בחתך נגד רגיל לפנייך. דורש חרב או חנית עם מגן.', en: 'You lock your shield and wait for the blow: the first hit that reaches you is swallowed by the shield and never touches you, and you send it back to its striker twice as hard, stunning it. If nobody strikes, you answer at the end with a plain counter-cut ahead. Needs a sword or spear with a shield.' },
    { power: 2, reach: 3.2, cone: 2.2, stun: .7, ret: 2, stunRet: 1.2 }),
  K('leap', '#ffd8a0', '#3a2414', 25, 9, null, 'slam', .8, 8,
    { he: 'הקפיצה של פרסאוס', en: "Perseus' Leap" },
    { he: 'זינוק של עד 7 מטרים אל האויב ונחיתה שמזעזעת את האדמה: נזק והלם לכל מי שסביב נקודת הנחיתה.', en: 'Leap up to 7 m at a foe and land hard enough to shake the ground: damage and a stun to everyone around where you land.' },
    { power: 1.3, range: 7, radius: 3, stun: .6, aim: 9 }),
  K('venom', '#6ee05a', '#10301a', 24, 12, null, 'fireball', .55, 9,
    { he: 'ארס ההידרה', en: "Hydra's Venom" },
    { he: 'בקבוקון של ארס שנזרק ומתנפץ לשלולית ירוקה: כל מי שעומד בה מורעל ומואט למשך 5 שניות.', en: 'A vial of venom that shatters into a green pool: everyone standing in it is poisoned and slowed for 5s.' },
    { power: .8, range: 9, radius: 3.2, poison: 6, time: 5, slow: .3, aim: 10 }),
  K('warcry', '#ff5a4a', '#3a0e0c', 26, 25, null, 'rise', .7, 10,
    { he: 'זעקת הקרב של ארס', en: 'War Cry of Ares' },
    { he: 'זעקה שמעוררת את אל המלחמה: במשך 10 שניות המכות שלך חזקות ב־25%, והאויבים סביבך נרתעים ומאטים.', en: 'A cry that wakes the god of war: for 10s your blows land 25% harder, and the foes around you flinch and slow down.' },
    { boost: .25, time: 10, radius: 6, stagger: .6, slow: .3, buff: true }),
  // ---- tier III (levels 12-17)
  // round 31 (Roy): a trigger on the weapon: its first hit, and every hit for 5 s after it, sends the lightning on (chainProc)
  K('chain', '#a8d8ff', '#101e3a', 30, 14, null, 'cast', .5, 12,
    { he: 'שרשרת ברקים', en: 'Chain Lightning' },
    { he: 'ברק נאסף בנשק שלך. המכה הבאה שלך, וכל מכה במשך 5 שניות אחריה, שולחת ברק שקופץ מהאויב לעוד עד חמישה אויבים קרובים ומהמם כל אחד מהם לרגע.', en: 'Lightning gathers in your weapon. Your next hit, and every hit for 5 seconds after it, sends lightning leaping from that foe to up to five more nearby, stunning each for a moment.' },
    { power: .9, jumps: 5, jumpR: 5.5, stun: .3, window: 5, wait: 15, buff: true }),
  K('impale', '#ffe08a', '#3a2a0c', 30, 11, 'reach', 'throw', .65, 13,
    { he: 'החנית של אכילס', en: "Achilles' Spear" },
    { he: 'את משליכה חנית של אור שעפה 18 מטרים, עוברת דרך כל מי שבדרך וננעצת באדמה. כל עוד היא תקועה שם (6 שניות), הפעלה שנייה של הכישור מעבירה אותך אליה בהבזק. דורש חנית או רומח.', en: 'You hurl a spear of light that flies 18 m through everyone in its way and sticks in the ground. While it stands there (6s), casting the skill again takes you to it in a flash. Needs a spear or a polearm.' },
    { power: 2.2, range: 18, width: .7, speed: 34, knock: 1.5, aim: 18, recast: true, window: 6 }), // round 31 (Roy): a double cast
  K('blink', '#b48cff', '#1e1030', 28, 10, 'dual', 'fog', .6, 14,
    { he: 'צעד הצל', en: 'Shadow Step' },
    { he: 'את נעלמת בענן עשן ומופיעה מאחורי האויב הקרוב, עם דקירה שכמעט תמיד קטלנית. דורש זוג להבים.', en: 'You vanish in a puff of smoke and appear behind the nearest foe with a stab that is almost always a critical. Needs a pair of blades.' },
    { power: 2.4, range: 12, aim: 12 }),
  K('earthsplit', '#c89a6a', '#2a1a10', 34, 12, 'twohand', 'smash', .85, 15,
    { he: 'מבקע האדמה', en: 'Earth Splitter' },
    { he: 'מכה בשתי ידיים שבוקעת את האדמה: שורת קוצים של אבן פורצת 11 מטרים קדימה, מעיפה ומהממת את כל מי שבדרך. דורש נשק דו־ידני.', en: 'A two-handed blow that splits the earth: a row of stone spikes bursts 11 m ahead, tossing and stunning everyone in the way. Needs a two-handed weapon.' },
    { power: 2, range: 11, width: 1.6, stun: 1, aim: 11 }),
  K('sunshield', '#ffd24a', '#3a2a08', 38, 30, null, 'cast', .7, 16,
    { he: 'כיפת הליוס', en: 'Dome of Helios' },
    { he: 'כיפה של אור שמש נסגרת סביבך: במשך 3.5 שניות שום דבר לא פוגע בך, ומי שהיה קרוב מדי נהדף החוצה.', en: 'A dome of sunlight closes around you: for 3.5s nothing can hurt you, and anyone too close is thrown out.' },
    { power: .6, radius: 4.5, knock: 2.5, time: 3.5 }),
  K('crescent', '#d8e8ff', '#1a2040', 30, 9, 'sword', 'sweep', .6, 16,
    { he: 'הסהר של סלנה', en: "Selene's Crescent" },
    { he: 'תנופת חרב ששולחת סהר של אור ירח: הוא עף 13 מטרים וחותך כל מי שבדרכו. דורש חרב ומגן.', en: 'A sword swing that sends out a crescent of moonlight: it flies 13 m and cuts everyone in its path. Needs a sword and shield.' },
    { power: 2, range: 13, width: 1.9, speed: 20, knock: 1.2, aim: 13 }),
  K('blizzard', '#e0f4ff', '#14243a', 40, 18, null, 'rise', .7, 14,
    { he: 'סופת השלג של בוריאס', en: "Boreas' Blizzard" },
    { he: 'סופת שלג מסתחררת סביבך במרחק מכובד למשך 4 שניות: פוגעת ומאטה את כל מי שבטווח 6.5 מטרים, ובסוף מקפיאה אותם במקום.', en: 'A blizzard circles round you at a fair distance for 4s: it hits and slows everyone within 6.5 m, and at the end freezes them where they stand.' },
    { power: .45, radius: 6.5, time: 4, tick: .5, slow: .5, freeze: 1.5 }),
  // ---- tier IV (levels 18-23)
  K('keres', '#e03a4a', '#2a080c', 36, 32, null, 'prophecy', .7, 18,
    { he: 'צמא הדם', en: 'Bloodthirst' },
    { he: 'הקרס, רוחות הדם של שדות הקרב, נכנסות בך: במשך 10 שניות כל מכה מחזירה לך 15% מהנזק כחיים, והמכות חזקות ב־15%.', en: 'The Keres, blood spirits of the battlefield, fill you: for 10s every blow gives back 15% of its damage as health, and your blows land 15% harder.' },
    { steal: .15, boost: .15, time: 10, buff: true }),
  K('phalanx', '#e0a858', '#3a240c', 40, 18, 'shield', 'aegis', 1.6, 19,
    { he: 'חומת הפלנקס', en: 'Phalanx Wall' },
    { he: 'שלושה מגני ארד של רוחות ההופליטים נעמדים לפנייך: לשנייה וחצי שום מכה לא עוברת, הם הודפים כל מי שמתקרב, ובסוף מכים כולם יחד קדימה. דורש חרב או חנית עם מגן.', en: 'Three bronze shields of hoplite spirits stand in front of you: for a second and a half nothing gets through, they shove back anyone who comes near, and at the end they all strike forward together. Needs a sword or spear with a shield.' },
    { power: .8, range: 5, cone: 2.1, knock: 2, wavePower: 1.6, stun: 1 }),
  K('harvest', '#b080ff', '#1a0e2a', 45, 16, 'twohand', 'whirl', 1, 21,
    { he: 'המגל של קרונוס', en: "Kronos' Scythe" },
    { he: 'סיבוב ענק עם הנשק, כמו מגל: פוגע בכל מי שבטווח 6 מטרים, ומי שכבר חלש נקצר בנזק כפול. דורש נשק דו־ידני.', en: 'A huge spin with your weapon like a scythe: it hits everyone within 6 m, and the already weak are reaped for double damage. Needs a two-handed weapon.' },
    { power: 2.3, radius: 6, execute: .35 }),
  K('spearrain', '#ffe8a0', '#2a2410', 42, 15, 'reach', 'cast', .8, 20,
    { he: 'גשם של חניתות', en: 'Rain of Spears' },
    { he: 'את מרימה את החנית לשמיים, ו־14 חניתות של אור יורדות על השטח שלפנייך. דורש חנית או רומח.', en: 'You raise your spear to the sky, and 14 spears of light rain down on the ground ahead of you. Needs a spear or a polearm.' },
    { power: .75, count: 14, radius: 5, hitR: 1.5, stun: .25, aim: 12 }),
  // round 22 (Roy): "a ring of ice around you that every monster slides on, but not her" (the id stays for old saves)
  K('iceprison', '#b8ecff', '#0e2236', 48, 24, null, 'fate', .8, 22,
    { he: 'טבעת של קרח', en: 'Ring of Ice' },
    { he: 'טבעת של קרח מתפשטת סביבך עד 7 מטרים: מי שעליה נפגע וקופא לרגע, ובמשך 8 שניות כל המפלצות מחליקות עליה בלי שליטה. את לא מחליקה.', en: 'A ring of ice spreads 7 m around you: whoever is on it is hurt and frozen for a moment, and for 8s every monster on it slides helplessly. You don\'t.' },
    { power: 1.6, radius: 7, time: 8, freeze: 1 }),
  K('thousand', '#f0e8ff', '#22183a', 44, 16, 'dual', 'flurry', 1.4, 23,
    { he: 'אלף חתכים', en: 'A Thousand Cuts' },
    { he: 'את מהבהבת מאויב לאויב, עד שישה בטווח 9 מטרים, ומכה כל אחד פעמיים, ואף אחד לא מספיק לגעת בך. דורש זוג להבים.', en: 'You flicker between up to six foes within 9 m and strike each one twice, and nobody gets a touch on you. Needs a pair of blades.' },
    { power: .9, range: 9, targets: 6, aim: 9 }),
  K('meteor', '#ff6a2a', '#3a100a', 46, 18, null, 'cast', .7, 20,
    { he: 'המטאור של הפייסטוס', en: "Hephaestus' Meteor" },
    { he: 'סלע בוער נופל מהשמיים על האויב: פיצוץ ברדיוס 4 מטרים שמעיף ושורף את כל מי שנתפס בו.', en: 'A burning rock falls from the sky onto the foe: a 4 m blast that throws back and burns everyone caught in it.' },
    { power: 2.6, radius: 4, burn: 10, time: 4, knock: 2, range: 12, aim: 12 }),
  // ---- tier V (levels 24-30)
  K('athena', '#fff2c0', '#2a2410', 55, 20, null, 'cast', .8, 24,
    { he: 'החנית של אתנה', en: "Athena's Spear" },
    { he: 'חנית אור ענקית נוחתת מהשמיים על האויב: מכה אדירה במרכז, גל הלם עד 7 מטרים, ומי שנפגע מסונוור ומואט.', en: 'A giant spear of light comes down from the sky on the foe: a mighty blow at the centre, a shockwave out to 7 m, and whoever is hit is dazzled and slowed.' },
    { power: 2.4, radius: 3, wave: 7, wavePower: 1.1, slow: .5, time: 3, range: 12, aim: 12 }),
  // round 31 (Roy): an ultimate now (on F alone, 250 mana like every ultimate); the temples still teach it, from level 24 (shops.js)
  K('hera', '#5ad8c8', '#0e2a2a', 250, 120, null, 'rise', 1.2, 24,
    { he: 'הברכה של הרה', en: "Hera's Blessing" },
    { he: 'כוח עליון. מלכת האלים יורדת אלייך: זנב הטווס שלה נפרש מאחורייך ועמוד של אור טורקיז וזהב נוחת עלייך. במשך 15 שניות המכות שלך חזקות ב־80% ואת סופגת חצי נזק.', en: 'An ultimate. The queen of the gods comes down to you: her peacock tail spreads behind you and a pillar of turquoise and gold light falls on you. For 15s your blows land 80% harder and you take half damage.' },
    { ult: true, shopUlt: true, boost: .8, ward: .5, time: 15, buff: true, source: { he: 'כוהני המקדשים מלמדים אותו, החל מרמה 24', en: 'Temple priests teach it, from level 24' } }),
  K('chimaera', '#ffa040', '#3a1808', 55, 18, null, 'gaze', 1.8, 25,
    { he: 'הנשימה של הכימרה', en: "Chimera's Breath" },
    { he: 'סילון של אש יוצא ממך למשך שנייה וחצי בחרוט של 9 מטרים ושורף כל מה שלפנייך.', en: 'A stream of fire pours from you for a second and a half in a 9 m cone and burns everything in front of you.' },
    { power: .55, range: 9, cone: 1, burn: 12, time: 4, tick: .25, move: .45 }),
  K('titanedge', '#cfe4ff', '#141c34', 58, 20, 'sword', 'sweep', .9, 25,
    { he: 'הלהב של הטיטאנים', en: "Titans' Edge" },
    { he: 'חרב רפאים בגודל של טיטאן מופיעה בידך ומטאטאת חצי עיגול של 9 מטרים. דורש חרב ומגן.', en: 'A ghostly sword the size of a Titan appears in your hand and sweeps a 9 m half circle. Needs a sword and shield.' },
    { power: 2.4, radius: 9, arc: 3.5, knock: 2.5 }),
  K('myrmidons', '#e8b870', '#30200e', 55, 18, 'reach', 'charge', 1, 26,
    { he: 'ההסתערות של המירמידונים', en: 'Charge of the Myrmidons' },
    { he: 'את מסתערת 13 מטרים עם החנית קדימה, ורוחות הלוחמים של אכילס רצות לצידך: כל מי שבדרך נהדף, ובסוף דקירה שמהממת את מי שלפנייך. דורש חנית או רומח.', en: "You charge 13 m spear first with the ghosts of Achilles' warriors running beside you: everyone in the way is thrown aside, and a final thrust stuns whoever is in front. Needs a spear or a polearm." },
    { power: 1.6, range: 13, width: 1.6, wavePower: 2.2, stun: 1, aim: 13 }),
  // round 31 (Roy): one vertical swing, and three tornadoes wander off it for 3 s
  K('storm', '#c8f0f0', '#123030', 62, 22, null, 'smash', .8, 26,
    { he: 'עין הסערה', en: 'Eye of the Storm' },
    { he: 'מכה אנכית גדולה עם הנשק, ושלוש סופות טורנדו יוצאות ממנה: במשך 3 שניות הן נודדות לצדדים בלי סדר ומכות בכל מי שנקלע אליהן.', en: 'One great vertical swing of your weapon, and three tornadoes spin out of it: for 3 seconds they wander from side to side at random and batter whoever they catch.' },
    { power: .55, time: 3, count: 3, core: 1.9, pull: 3, tick: .3, speed: 3.2, aim: 10 }),
  K('hydra', '#5aff8a', '#0e2a18', 58, 18, 'dual', 'flurry', 1.2, 27,
    { he: 'ראשי ההידרה', en: 'Heads of the Hydra' },
    { he: 'תשעה ראשי נחש של אור ירוק מזנקים ממך אל האויבים בטווח 8 מטרים, וכל נשיכה משאירה ארס חזק. דורש זוג להבים.', en: 'Nine serpent heads of green light lunge from you at the foes within 8 m, and every bite leaves strong venom. Needs a pair of blades.' },
    { power: 1.1, hits: 9, range: 8, poison: 10, time: 5 }),
  K('kronos', '#e8d8a0', '#1e1a2a', 70, 40, null, 'prophecy', .8, 28,
    { he: 'עצירת הזמן', en: "Kronos' Stillness" },
    { he: 'קרונוס עוצר את הזמן סביבך: כל האויבים בטווח 14 מטרים קופאים במקום למשך 4 שניות. בוסים רק מואטים.', en: 'Kronos stops time around you: every foe within 14 m freezes in place for 4s. Bosses are only slowed.' },
    { radius: 14, time: 4 }),
  // round 31 (Roy): a revive she readies in advance: the first death while it is ready is undone (cheatDeath); 30 min to recharge
  K('phoenix', '#ff8a2a', '#3a1206', 75, 1800, null, 'rise', 1, 29,
    { he: 'תחיית הפניקס', en: 'Rise of the Phoenix' },
    { he: 'אש של פניקס שומרת עלייך. ההפעלה רק מכינה אותה: כל עוד היא מוכנה, ברגע שהיית אמורה למות את קמה מיד מהאפר עם 75% מהחיים, שתי שניות שאף מכה לא פוגעת בך, וטבעת אש שורפת את כל מי שבטווח 7 מטרים. אחרי התחייה את חזקה ב־30%, והתוספת דועכת לאט במשך 5 שניות. הכישור נטען 30 דקות מרגע ההפעלה, וההכנה נשארת עד שהיא נצרכת.', en: 'A phoenix fire watches over you. Casting it only readies it: while it is ready, the moment you would die you rise from the ashes at once with 75% of your health, two seconds in which nothing can hurt you, and a ring of fire that burns everyone within 7 m. After rising you hit 30% harder, and the bonus fades away over 5 seconds. It recharges for 30 minutes from the moment you cast it, and stays ready until it is used.' },
    { heal: .75, radius: 7, power: 2, burn: 12, time: 4, safe: 2, boost: .3, fade: 5, buff: true }),
  K('colossus', '#d8a868', '#2a1c10', 65, 24, 'twohand', 'ult', 1.3, 28,
    { he: 'נפילת הקולוסוס', en: 'Fall of the Colossus' },
    { he: 'את מזנקת גבוה אל האויב ונוחתת כמו פסל ארד ענק: מכה אדירה, גל הלם עד 9 מטרים, וכל מי שסביב מהומם. דורש נשק דו־ידני.', en: 'You leap high at the foe and come down like a giant bronze statue: a mighty blow, a shockwave out to 9 m, and everyone around is stunned. Needs a two-handed weapon.' },
    { power: 2.6, radius: 4, wave: 9, wavePower: 1.4, stun: 1.2, range: 10, aim: 12 }),
  // round 22 (Roy): a leap through a ring of wind, to get places faster. Round 23 (Roy: "keep it in the game, it's great,
  // but it should be bought later, a skill for level 30+"; "LEAP should cost 25 mana"): no longer the priestess's gift;
  // temple priests teach it, and only from level 30 (shops.js lets a skill be bought from its unlock level)
  K('bound', '#bfe8ff', '#143048', 5, 1.2, null, 'dash', .55, 30,
    { he: 'הזינוק של פגסוס', en: "Pegasus' Bound" },
    { he: 'זינוק ארוך של 8 מטרים קדימה דרך טבעת של רוח. עוזר להתקדם מהר בדרכים ולצאת ממצוקה.', en: 'A long 8 m leap forward through a ring of wind. It gets you down the road faster, and out of trouble.' },
    { range: 8, aim: .01, templeOnly: true, source: { he: 'כוהני המקדשים מלמדים אותו, החל מרמה 30', en: 'Temple priests teach it, from level 30' } }), // templeOnly: never on a trader's table (shops.js, optional)
  // ---- round 30 (Roy): three more ultimates past Wrath of Olympus, one tier each (rank 4 5 6; quests.js q_inferno, q_gaia, q_void).
  // Like the first three they live on the ultimate's key only, cost no mana and recharge slowly; their numbers are their own.
  K('inferno', '#ff6a1a', '#3a0c04', 0, 110, null, 'rise', 2.3, 1,
    { he: 'תופת הפייסטוס', en: 'Inferno of Hephaestus' },
    { he: 'כוח עליון של אש. Val מתרוממת בתוך עמוד אש מסתחרר ששורף כל מי שקרוב, עשרה סלעים בוערים נופלים מהשמיים על האויבים ברדיוס 15 מטרים, ובסוף גל אש אחד מתפוצץ ממנה ומשאיר את כולם בוערים.', en: 'An ultimate of fire. Val rises inside a whirling column of flame that burns everyone close, ten blazing rocks fall from the sky on foes within 15 m, and at the end one wave of fire bursts out of her and leaves them all burning.' },
    { ult: true, rank: 4, power: 2.6, radius: 15, storm: 5, stormPower: 1.1, rocks: 10, nova: 5, burn: 30, time: 5, knock: 2.6, stun: .6,
      source: { he: 'הנפח של הפייסטיה, החל מרמה 32', en: 'The smith of Hephaistia, from level 32' } }),
  K('gaia', '#c8964a', '#2a1a0c', 0, 120, null, 'slam', 1.5, 1,
    { he: 'זעם גאיה', en: 'Wrath of Gaia' },
    { he: 'כוח עליון של אדמה. Val מכה באדמה, ושלושה גלים של קוצי סלע ענקיים פורצים ממנה החוצה עד 16 מטרים: כל אויב בדרך מוטח לאוויר ומהומם, ואז האדמה נסגרת עליהם במכה אחרונה.', en: 'An ultimate of earth. Val strikes the ground, and three waves of huge stone spikes burst outward from her to 16 m: every foe in their way is flung into the air and stunned, then the earth closes on them in one last blow.' },
    { ult: true, rank: 5, power: 4.2, radius: 16, waves: 3, stun: 1.8, final: 7, knock: 3,
      source: { he: 'הזקן של אולימפיה, ליד המזבח העתיק של גאיה, החל מרמה 45', en: "The elder of Olympia, by Gaia's ancient altar, from level 45" } }),
  K('void', '#a05aff', '#0a0614', 0, 150, null, 'gaze', 1.1, 1,
    { he: 'לוע הכאוס', en: 'Maw of Chaos' },
    { he: 'הכוח העליון החזק מכולם: חור שחור. Val פותחת את הריק הקדמון לפניה, והוא שואב אליו כל אויב ברדיוס 18 מטרים ומכרסם בהם 4 שניות, ואז קורס פנימה בפיצוץ שמוחק כמעט כל דבר.', en: 'The mightiest ultimate: a black hole. Val tears open the first void before her; it drags in every foe within 18 m and gnaws at them for 4 seconds, then collapses in a blast that erases almost anything.' },
    { ult: true, rank: 6, power: 1.1, radius: 18, pull: 7, life: 4, tick: .5, final: 14, stun: 1.2, knock: 3.2,
      source: { he: 'הזקן של מיטילנה, החל מרמה 60', en: 'The elder of Mytilene, from level 60' } }),
];

// ---------------------------------------------------------------------------------------------
// helpers (the same small ones skills.js keeps; copied so this file stays free of cycles)
// ---------------------------------------------------------------------------------------------
const audio = AUD.audio;
const hasSfx = (n) => !AUD.SFX_NAMES || AUD.SFX_NAMES.includes(n);
const sfxo = (n, o) => { if (hasSfx(n)) try { audio?.sfxPlay(n, o); } catch { /* audio not ready */ } };
const alive = (e) => e && !e.dead && e.state !== 'spawn';
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fwd = (p) => [Math.sin(p.facing), Math.cos(p.facing)];
function foes(g, x, z, r) {
  const out = [];
  for (const e of g.enemies || []) if (alive(e) && Math.hypot(e.pos.x - x, e.pos.z - z) < r + (e.radius || .5)) out.push(e);
  return out;
}
function angleOff(p, e, facing = p.facing) {
  let d = Math.abs(Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z) - facing) % (PI * 2);
  return d > PI ? PI * 2 - d : d;
}
const inCone = (p, e, range, half, facing) => flatDist(p.pos, e.pos) < range + (e.radius || .5) && (angleOff(p, e, facing) < half || flatDist(p.pos, e.pos) < 1);
const topOf = (e) => V3(e.pos.x, e.pos.y + (e.T?.height || 1.8) * .6, e.pos.z);
const lvlMul = (g) => 1 + ((g.hero?.level || 1) - 1) * .06;
const once = (at, fn) => { let done = false; return (dt, t) => { if (!done && t >= at) { done = true; fn(); } }; };
const ground = (g, x, z) => (g.world?.ground ? g.world.ground(x, z) : 0);
// how far along a line (x,z)+(dx,dz)*u a foe stands, and how far off it to the side
const along = (e, x, z, dx, dz) => { const ex = e.pos.x - x, ez = e.pos.z - z; return [ex * dx + ez * dz, Math.abs(ex * dz - ez * dx)]; };
// where a skill lands: the foe she aims at if it is in reach, else the nearest one, else `ahead` metres in front of her
function aimAt(g, p, tgt, range, ahead) {
  const e = alive(tgt) && flatDist(tgt.pos, p.pos) < range ? tgt : g.nearestEnemy?.(p.pos, range);
  if (e) return { x: e.pos.x, z: e.pos.z, e };
  const [fx, fz] = fwd(p); return { x: p.pos.x + fx * ahead, z: p.pos.z + fz * ahead, e: null };
}
// a few particles thrown along a direction (Particles.spawn throws them at random; this steers the ones it just made)
function jet(g, pos, n, dx, dz, speed, o) {
  const L = g.fx?.live; if (!L) return; n = g.fx.spawn(pos, n, o) ?? n; // (fewer on the low tier: steer only the ones it made)
  for (let i = Math.max(0, L.length - n); i < L.length; i++) { const v = L[i].userData.v, s = speed * (.6 + Math.random() * .6); v.set(dx * s + (Math.random() - .5) * 1.5, v.y * .4 + .4, dz * s + (Math.random() - .5) * 1.5); }
}
// frozen solid: a stun in a block of ice (bosses only slow down)
function freeze(g, e, time) {
  if (!alive(e)) return;
  if (e.T?.boss) { e.slowBy(.6, time); return; }
  e.stunT = Math.max(e.stunT || 0, time); e.state = 'chase'; e.slowBy(.5, time + 1);
  iceBlock(g.skillFx, e, time);
}
// a strike that is sure to be critical (Shadow Step from behind): skills.js recomputes g.critBonus every frame
function sureCrit(g, fn) { const c = g.critBonus || 0; g.critBonus = c + 1; try { fn(); } finally { g.critBonus = c; } }
// slide her toward a point; the terrain still stops her (walls, trees, deep water)
const slideTo = (p, x, z) => p.moveBy(x - p.pos.x, z - p.pos.z);

// ---------------------------------------------------------------------------------------------
// blessings: buffs that add to Hero.temp (counted by rpg.js in the hero's bonus) until they run out
// ---------------------------------------------------------------------------------------------
// fade (round 31, the Phoenix's rising): the bonus melts away evenly over its time instead of holding to the end
export function bless(g, id, bonus, time, color, label, fade = false) {
  const fx = g.skillFx, list = fx.buffs || (fx.buffs = []), i = list.findIndex((b) => b.id === id);
  if (i >= 0) list.splice(i, 1);
  list.push({ id, bonus, until: fx.now() + time, fade: fade ? time : 0 });
  aura(fx, g.player, time, color);
  if (label) g.floatAt?.(g.player.pos, label, 'exp', 2.9);
  tickBuffs(fx);
}
export function tickBuffs(fx) {
  const H = fx.g.hero; if (!H) return;
  const now = fx.now(), list = fx.buffs || [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].until <= now) list.splice(i, 1);
  if (!list.length) { if (H.temp) H.temp = null; return; }
  const sum = {}; for (const b of list) { const f = b.fade ? Math.max(0, (b.until - now) / b.fade) : 1; for (const [k, v] of Object.entries(b.bonus)) sum[k] = (sum[k] || 0) + v * f; }
  H.temp = sum;
}
export function clearBuffs(fx) { fx.buffs = []; if (fx.g.hero) fx.g.hero.temp = null; }
// a power boost is a share of what her level and gear already give (stats.power is additive in rpg.js)
const powerOf = (g, frac) => frac * (g.hero.stats.power - (g.hero.temp?.power || 0));

// ---------------------------------------------------------------------------------------------
// visuals (built on SkillFx's add/after/ring...; basic glowing materials, the post pass pixelates them)
// ---------------------------------------------------------------------------------------------
const GEO = {};
const geo = (k, make) => GEO[k] || (GEO[k] = make());
const boxG = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
const ballG = () => geo('ball', () => new THREE.IcosahedronGeometry(1, 1));
const rockG = () => geo('rock', () => new THREE.IcosahedronGeometry(1, 0));
const ringG = () => geo('ring', () => new THREE.RingGeometry(.84, 1, 40));
const discG = () => geo('disc', () => new THREE.CircleGeometry(1, 28));
const coneG = () => geo('cone', () => new THREE.ConeGeometry(1, 1, 5));
const tipG = () => geo('tip', () => new THREE.ConeGeometry(1, 1, 4).rotateX(PI / 2)); // points +z
const domeG = () => geo('dome', () => new THREE.SphereGeometry(1, 18, 9, 0, PI * 2, 0, PI / 2));
const iceG = () => geo('ice', () => new THREE.CylinderGeometry(1, 1.12, 1, 6));
// (round 33, stage 9: pxfx.js pxGlow, the stepped pixel look every effect shares: five tones with a violet shade and a warm
// light, transparency in dithered steps)
const glow = pxGlow;
function mesh(g, m, parent) { const o = new THREE.Mesh(g, m); o.frustumCulled = false; pxTag(o); if (parent) parent.add(o); return o; }
const fadeIO = (k, a = .12, b = .25) => Math.min(1, k / a) * Math.min(1, (1 - k) / b);

// a crescent of light swept round her: o = { r, inner (share of r), arc (rad), color, edge, tilt, y, life, flip, follow }
function sweepArc(fx, p, o) {
  const grp = new THREE.Group(), tilt = new THREE.Group(); grp.add(tilt);
  const y = o.y ?? .9, segs = 24, start = -PI / 2 - o.arc / 2;
  grp.position.set(p.pos.x, p.pos.y + y, p.pos.z); grp.rotation.y = o.facing ?? p.facing; tilt.rotation.z = o.tilt || 0; if (o.flip) tilt.scale.x = -1;
  const mk = (r0, r1, color, op) => { const gm = new THREE.RingGeometry(r0, r1, segs, 1, start, o.arc); gm.userData.own = true; gm.setDrawRange(0, 0); const m = mesh(gm, glow(color, op), tilt); m.rotation.x = -PI / 2; return m; };
  const parts = [[mk(o.r * (o.inner ?? .45), o.r, o.color, .5), .5], [mk(o.r * .92, o.r * 1.02, o.edge || '#ffffff', .95), .95]];
  return fx.add(grp, o.life || .4, (e, k) => {
    const n = Math.ceil(segs * Math.min(1, k / .4)), f = k < .45 ? 1 : 1 - (k - .45) / .55;
    for (const [m, op] of parts) { m.geometry.setDrawRange(0, n * 6); m.material.opacity = op * f; }
    if (o.follow) grp.position.set(p.pos.x, p.pos.y + y, p.pos.z);
  });
}
// Wide Cleave (Roy 30.10: each attack its own look): no light at all. The axe goes low and reaps the ground: a dark furrow of
// torn earth opens along the arc at her feet and stays a moment, turf and clods fly outward off its edge, dust rolls after
function furrow(g, p, R, arc) {
  const fx = g.skillFx, grp = new THREE.Group(), segs = 18, start = -PI / 2 - arc / 2;
  grp.position.set(p.pos.x, p.pos.y + .06, p.pos.z); grp.rotation.y = p.facing;
  const mk = (r0, r1, color, op) => { const gm = new THREE.RingGeometry(r0, r1, segs, 1, start, arc); gm.userData.own = true; gm.setDrawRange(0, 0); const m = mesh(gm, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }), grp); m.material.userData.own = true; m.rotation.x = -PI / 2; return m; };
  const parts = [[mk(R * .62, R * .98, '#3a2414', .85), .85], [mk(R * .9, R * 1.04, '#8a6038', .9), .9]];
  fx.add(grp, 1.3, (e, k) => { const n = Math.ceil(segs * Math.min(1, e.t / .12)), f = k < .6 ? 1 : 1 - (k - .6) / .4; for (const [m, op] of parts) { m.geometry.setDrawRange(0, n * 6); m.material.opacity = op * f; } });
  const f0 = p.facing;
  for (let i = 0; i < 9; i++) {
    const a = f0 - arc / 2 + arc * (i + .5) / 9, r = R * (.8 + Math.random() * .2), x = p.pos.x + Math.sin(a) * r, z = p.pos.z + Math.cos(a) * r;
    g.fx.spawn(V3(x, p.pos.y + .15, z), 2, { colors: ['#5a3a1e', '#7a5a2e', '#4a7a2a'], speed: 3.4, gravity: 9, life: .55, size: .17, spread: .5 });
    if (i % 2) g.fx.spawn(V3(x, p.pos.y + .3, z), 1, { colors: ['#b8a07a', '#9a8460'], speed: .7, gravity: -.4, life: .9, size: .34 });
  }
}
// a long bright streak from a to b (a thrust, a beam of the eye)
function streak(fx, a, b, color, w = .1, life = .22) {
  const grp = new THREE.Group(), d = V3().subVectors(b, a), len = d.length() || .01;
  const o = mesh(boxG(), glow(color, .7), grp), i = mesh(boxG(), glow('#ffffff', 1), grp);
  grp.position.copy(a).addScaledVector(d, .5); grp.lookAt(b);
  return fx.add(grp, life, (e, k) => { const s = Math.min(1, k * 6); o.scale.set(w * 2.4 * (1 - k * .6), w * 2.4 * (1 - k * .6), len * s); i.scale.set(w, w, len * s); o.material.opacity = .7 * (1 - k); i.material.opacity = 1 - k; });
}
// a buff's mark on her: a turning ring at her feet and motes rising, for `life` s
function aura(fx, p, life, color) {
  const grp = new THREE.Group(), a = mesh(ringG(), glow(color, .55), grp), b = mesh(ringG(), glow('#ffffff', .35), grp);
  a.rotation.x = b.rotation.x = -PI / 2; a.position.y = .07; b.position.y = .09;
  return fx.add(grp, life, (e, k) => {
    grp.position.copy(p.pos); const f = fadeIO(k, .05, .08) * (.75 + Math.sin(e.t * 5) * .25);
    a.scale.setScalar(1.05 + Math.sin(e.t * 3) * .06); b.scale.setScalar(.7 + ((e.t * .8) % 1) * .5); b.rotation.z = e.t;
    a.material.opacity = .55 * f; b.material.opacity = .35 * f * (1 - ((e.t * .8) % 1));
    if (Math.random() < .25) fx.g.fx?.spawn(V3(p.pos.x + (Math.random() - .5) * 1.2, p.pos.y + .2 + Math.random() * 1.2, p.pos.z + (Math.random() - .5) * 1.2), 1, { colors: [color, '#ffffff'], speed: .3, gravity: -2.5, life: .7, size: .08 });
  });
}
// a block of ice round a frozen foe; it shatters when the stun ends (or the foe dies)
function iceBlock(fx, e, life) {
  if (!fx) return;
  const h = (e.T?.height || 1.8) * (e.baseScale || 1), r = (e.radius || .5) + .3;
  const grp = new THREE.Group(), body = mesh(iceG(), glow('#bfe8ff', .42, false), grp), shine = mesh(iceG(), glow('#e8f8ff', .3), grp);
  body.scale.set(r, h, r); body.position.y = h / 2; shine.scale.set(r * 1.06, h * 1.02, r * 1.06); shine.position.y = h / 2;
  const burst = () => fx.g.fx?.spawn(V3(e.pos.x, e.pos.y + h * .5, e.pos.z), 16, { colors: ['#e8f8ff', '#9fd8ff', '#ffffff'], speed: 5, life: .55, gravity: 10, size: .14, spread: r });
  return fx.add(grp, life, (x, k) => {
    if (!alive(e)) { burst(); return false; }
    grp.position.set(e.pos.x, e.pos.y, e.pos.z); grp.rotation.y = e.facing || 0;
    const f = Math.min(1, x.t * 6); body.material.opacity = .42 * f; shine.material.opacity = .3 * f * (.7 + Math.sin(x.t * 9) * .3);
    if (k > .97 && !x.done) { x.done = true; burst(); sfxo('break', { vol: .5 }); }
  });
}
// a thrown thing: o = { speed, range, obj, pierce, width, lob (height of the arc), endY, home (foe), trail(pos) }
// onHit(foe, pos) once per foe it touches (it stops at the first unless pierce); onEnd(pos) where it ends
function missile(fx, start, dir, o, onHit, onEnd) {
  const g = fx.g, obj = o.obj, d = dir.clone().setY(0).normalize(), hit = new Set(), y0 = start.y; let dist = 0;
  obj.position.copy(start); obj.rotation.y = Math.atan2(d.x, d.z);
  return fx.add(obj, o.range / o.speed + 1, (e, k, dt) => {
    // homing arrows bend toward their foe for two seconds at most, then fly on straight
    if (o.home && alive(o.home) && e.t < 2) {
      const want = Math.atan2(o.home.pos.x - obj.position.x, o.home.pos.z - obj.position.z); let a = Math.atan2(d.x, d.z), da = want - a;
      while (da > PI) da -= PI * 2; while (da < -PI) da += PI * 2; a += Math.max(-dt * 7, Math.min(dt * 7, da)); d.set(Math.sin(a), 0, Math.cos(a));
    }
    const step = o.speed * dt; dist += step;
    obj.position.x += d.x * step; obj.position.z += d.z * step; obj.rotation.y = Math.atan2(d.x, d.z);
    const gy = ground(g, obj.position.x, obj.position.z);
    if (o.lob) { const u = Math.min(1, dist / o.range); obj.position.y = y0 + ((o.endY ?? gy) - y0) * u + Math.sin(u * PI) * o.lob; obj.rotation.x += dt * 9; }
    else obj.position.y = Math.max(gy + .7, obj.position.y - dt * .3);
    o.trail?.(obj.position);
    if (!o.lob) for (const f of g.enemies || []) {
      if (!alive(f) || hit.has(f)) continue;
      if (Math.hypot(f.pos.x - obj.position.x, f.pos.z - obj.position.z) < (f.radius || .5) + (o.width || .45)) {
        hit.add(f); onHit?.(f, obj.position.clone());
        if (!o.pierce) { onEnd?.(obj.position.clone(), f); return false; }
      }
    }
    if (dist >= o.range) { onEnd?.(obj.position.clone(), null); return false; }
  });
}
// a spear (or arrow) of light, pointing +z
function lightSpear(color, len = 2.2, w = .07) {
  const grp = new THREE.Group();
  const shaft = mesh(boxG(), glow(color, .9), grp); shaft.scale.set(w, w, len); shaft.position.z = -len * .1;
  const core = mesh(boxG(), glow('#ffffff', 1), grp); core.scale.set(w * .45, w * .45, len * .9); core.position.z = -len * .1;
  const tip = mesh(tipG(), glow('#ffffff', 1), grp); tip.scale.set(w * 2.4, w * 2.4, len * .22); tip.position.z = len * .5;
  const halo = mesh(boxG(), glow(color, .3), grp); halo.scale.set(w * 4, w * 4, len * 1.1); shaft.renderOrder = core.renderOrder = tip.renderOrder = 1; // (the shaft over its halo)
  return grp;
}
// a ring of stone spikes bursting up at c (they sink again after a moment)
// ice (round 33): a colour for ice spikes (Ring of Ice), each spike its own stepped, see-through crystal; stone wears the
// world's painted stone (shared: never recoloured)
function spike(fx, c, h, ice = null) {
  const grp = new THREE.Group(); grp.position.copy(c);
  const cols = ['#8a7a64', '#a8967a', '#6a5a48'], spikes = [];
  for (let i = 0; i < 3; i++) {
    const m = ice ? glow(i === 1 ? '#ffffff' : ice, .85, false) : stoneMat(cols[i]);
    const o = mesh(coneG(), m, grp), a = Math.random() * PI * 2, r = i ? .35 : 0, hh = h * (i ? .65 : 1);
    o.scale.set(.32 * (i ? .7 : 1), hh, .32 * (i ? .7 : 1)); o.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); o.rotation.set((Math.random() - .5) * .5, a, (Math.random() - .5) * .5);
    spikes.push([o, hh]);
  }
  return fx.add(grp, .95, (e, k) => {
    const up = e.t < .1 ? e.t / .1 : k > .7 ? 1 - (k - .7) / .3 : 1;
    for (const [o, hh] of spikes) o.position.y = -hh / 2 + hh * .5 * up * 1.05 - (1 - up) * hh * .2;
  });
}
// a pool on the ground; every `every` s it calls onTick()
function pool(fx, c, r, life, color, every, onTick) {
  const grp = new THREE.Group(); grp.position.set(c.x, c.y + .06, c.z);
  const disc = mesh(discG(), glow(color, .5, false), grp), rim = mesh(ringG(), glow('#d8ffb0', .7), grp);
  disc.rotation.x = rim.rotation.x = -PI / 2; disc.scale.setScalar(r); rim.scale.setScalar(r); rim.position.y = .02;
  let acc = every;
  return fx.add(grp, life, (e, k, dt) => {
    const f = fadeIO(k, .06, .15); disc.material.opacity = .5 * f; rim.material.opacity = .7 * f * (.7 + Math.sin(e.t * 6) * .3);
    disc.scale.setScalar(r * Math.min(1, e.t * 6));
    acc += dt; if (acc >= every) { acc -= every; onTick(); }
    if (Math.random() < .5) { const a = Math.random() * PI * 2, d = Math.sqrt(Math.random()) * r; fx.g.fx?.spawn(V3(c.x + Math.sin(a) * d, c.y + .1, c.z + Math.cos(a) * d), 1, { colors: [color, '#d8ffb0', '#2a5a1a'], speed: .3, gravity: -1.2, life: .8, size: .12 }); }
  });
}
// a dome of light over her (Helios)
function dome(fx, p, r, life, color) {
  const grp = new THREE.Group(), shell = mesh(domeG(), glow(color, .22), grp), edge = mesh(ringG(), glow('#ffffff', .8), grp), inner = mesh(domeG(), glow('#fff6d0', .12), grp);
  edge.rotation.x = -PI / 2; edge.position.y = .06;
  return fx.add(grp, life, (e, k) => {
    grp.position.copy(p.pos); const s = r * Math.min(1, e.t * 5), f = fadeIO(k, .04, .12);
    shell.scale.setScalar(s); inner.scale.setScalar(s * .94); edge.scale.setScalar(s);
    shell.material.opacity = (.2 + Math.sin(e.t * 7) * .05) * f; inner.material.opacity = .12 * f; edge.material.opacity = .8 * f;
    shell.rotation.y = e.t * .8;
    if (Math.random() < .4) { const a = Math.random() * PI * 2, el = Math.random() * PI / 2; fx.g.fx?.spawn(V3(p.pos.x + Math.cos(el) * Math.sin(a) * s, p.pos.y + Math.sin(el) * s, p.pos.z + Math.cos(el) * Math.cos(a) * s), 1, { colors: ['#fff2b0', '#ffd24a'], speed: .2, gravity: 0, life: .5, size: .1 }); }
  });
}
// three hoplite shields of bronze light in an arc before her (Phalanx)
function shieldWall(fx, p, life) {
  const grp = new THREE.Group(), parts = [];
  for (let i = -1; i <= 1; i++) {
    const s = new THREE.Group(), face = mesh(discG(), glow('#c88a3a', .45), s), rim = mesh(ringG(), glow('#ffd890', .9), s), boss = mesh(discG(), glow('#fff0c0', .7), s);
    face.scale.setScalar(.8); rim.scale.setScalar(.82); boss.scale.setScalar(.18); boss.position.z = .02;
    s.position.set(Math.sin(i * .62) * 1.5, 1.05, Math.cos(i * .62) * 1.5); s.rotation.y = i * .62; grp.add(s); parts.push(face, rim, boss);
  }
  return fx.add(grp, life, (e, k) => {
    grp.position.copy(p.pos); grp.rotation.y = p.facing; const f = fadeIO(k, .08, .12);
    grp.scale.setScalar(Math.min(1, e.t * 6));
    parts.forEach((m, j) => { m.material.opacity = m.userData.base * f * (j % 3 === 1 ? .8 + Math.sin(e.t * 12) * .2 : 1); });
  });
}
// a tornado moving from c0 along dir for `dist` m over `life` s; onTick(pos, dt) every frame
function twister(fx, c0, dir, dist, life, onTick) {
  const g = fx.g, grp = new THREE.Group(), rings = [];
  for (let i = 0; i < 8; i++) {
    const m = mesh(ringG(), glow(i % 2 ? '#e8ffff' : '#9fd8d0', .55 - i * .03), grp); m.rotation.x = -PI / 2;
    m.position.y = .2 + i * .55; m.scale.setScalar(.45 + i * .32); rings.push(m);
  }
  const pos = V3(c0.x, c0.y, c0.z);
  return fx.add(grp, life, (e, k, dt) => {
    pos.x = c0.x + dir.x * dist * k; pos.z = c0.z + dir.z * dist * k; pos.y = ground(g, pos.x, pos.z);
    grp.position.copy(pos); const f = fadeIO(k, .08, .15);
    rings.forEach((m, i) => { m.rotation.z = e.t * (6 + i); m.position.x = Math.sin(e.t * 5 + i * .7) * .12 * i; m.material.opacity = m.userData.base * f; });
    if (Math.random() < .8) { const a = Math.random() * PI * 2, r = .5 + Math.random() * 2; g.fx?.spawn(V3(pos.x + Math.sin(a) * r, pos.y + .2 + Math.random() * 3.5, pos.z + Math.cos(a) * r), 1, { colors: ['#e8ffff', '#a89874', '#6a8a4a'], speed: 2.5, gravity: -1, life: .5, size: .12 }); }
    onTick(pos, dt);
  });
}
// fiery wings behind her (Phoenix)
function wings(fx, p, life) {
  const grp = new THREE.Group(), parts = [];
  for (const sx of [-1, 1]) for (let j = 0; j < 5; j++) {
    const m = mesh(coneG(), glow(j % 2 ? '#ffd04a' : '#ff6a1a', .7), grp);
    m.scale.set(.18, 1.6 - j * .18, .05); parts.push({ m, sx, j });
  }
  return fx.add(grp, life, (e, k) => {
    grp.position.set(p.pos.x, p.pos.y + 1.3, p.pos.z); grp.rotation.y = p.facing;
    const open = Math.min(1, e.t * 3), flap = Math.sin(e.t * 9) * .12, f = fadeIO(k, .05, .3);
    for (const { m, sx, j } of parts) {
      const a = sx * (.5 + j * .28) * open + sx * flap; // fanned out from the shoulders
      m.position.set(sx * (.3 + Math.sin(Math.abs(a)) * .8), Math.cos(a) * .8 - .2, -.35);
      m.rotation.set(0, 0, -a); m.material.opacity = m.userData.base * f;
    }
    if (Math.random() < .6) fx.g.fx?.spawn(V3(p.pos.x + (Math.random() - .5) * 2.4, p.pos.y + 1 + Math.random() * 1.4, p.pos.z + (Math.random() - .5) * .6), 1, { colors: ['#ffd04a', '#ff6a1a', '#ffffff'], speed: .6, gravity: -3, life: .6, size: .12 });
  });
}
// a serpent's neck of green light lunging from her to a foe and back
function serpentStrike(fx, p, e, color, life = .32) {
  const segs = [], grp = new THREE.Group(), side = Math.random() < .5 ? -1 : 1;
  for (let i = 0; i < 9; i++) { const m = mesh(ballG(), glow(i === 8 ? '#e8ffe0' : color, .85), grp); m.scale.setScalar(i === 8 ? .26 : .12 + i * .01); segs.push(m); }
  const a = V3(), b = V3(), c = V3();
  return fx.add(grp, life, (x, k) => {
    a.set(p.pos.x, p.pos.y + 1.2, p.pos.z); if (alive(e)) b.copy(topOf(e));
    const reach = k < .45 ? k / .45 : 1 - (k - .45) / .55;
    c.set((a.x + b.x) / 2 + (b.z - a.z) * .25 * side, Math.max(a.y, b.y) + 1.2, (a.z + b.z) / 2 - (b.x - a.x) * .25 * side);
    segs.forEach((m, i) => { const u = (i + 1) / segs.length * reach, v = 1 - u; m.position.set(v * v * a.x + 2 * v * u * c.x + u * u * b.x, v * v * a.y + 2 * v * u * c.y + u * u * b.y, v * v * a.z + 2 * v * u * c.z + u * u * b.z); m.material.opacity = .85 * Math.min(1, (1 - k) * 4); });
  });
}
// a peacock's tail of eyes fanned behind her (Hera)
function peacock(fx, p, life, sc = 1) {
  const grp = new THREE.Group(), parts = [];
  for (let i = 0; i < 11; i++) {
    const a = -1.25 + i * .25, f = new THREE.Group();
    const vane = mesh(ballG(), glow('#2a9a8a', .5), f); vane.scale.set(.22, .5, .05);
    const eye = mesh(discG(), glow('#ffd24a', .9), f); eye.scale.setScalar(.16); eye.position.set(0, .28, .06);
    const pupil = mesh(discG(), glow('#2a5ad8', 1), f); pupil.scale.setScalar(.08); pupil.position.set(0, .28, .08);
    f.position.set(Math.sin(a) * 1.25, Math.cos(a) * 1.25, 0); f.rotation.z = -a; grp.add(f); parts.push(vane, eye, pupil);
  }
  return fx.add(grp, life, (e, k, dt, cam) => {
    grp.position.set(p.pos.x - Math.sin(p.facing) * .35, p.pos.y + .9, p.pos.z - Math.cos(p.facing) * .35); grp.rotation.y = p.facing + PI;
    grp.scale.setScalar(sc * Math.min(1, e.t * 3) * (1 + k * .15)); const f = fadeIO(k, .05, .35);
    for (const m of parts) m.material.opacity = m.userData.base * f;
  });
}
// Hera's Blessing (round 31): a crown of light turning over her head while the blessing lasts
function crown(fx, p, life) {
  const grp = new THREE.Group(), band = mesh(ringG(), glow('#ffd24a', .85), grp), parts = [band];
  band.rotation.x = -PI / 2; band.scale.setScalar(.34);
  for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2, o = mesh(tipG(), glow(i % 2 ? '#5ad8c8' : '#fff2b0', .9), grp); o.rotation.x = -PI / 2; o.scale.set(.06, .06, .2); o.position.set(Math.sin(a) * .32, .09, Math.cos(a) * .32); parts.push(o); }
  return fx.add(grp, life, (e, k) => {
    grp.position.set(p.pos.x, p.pos.y + (p.lift || 0) + 2.25 + Math.sin(e.t * 2.5) * .04, p.pos.z); grp.rotation.y = e.t * 1.2;
    const f = fadeIO(k, .02, .06) * (k > .85 ? (Math.floor(e.t * 8) % 2 ? .4 : 1) : 1);
    for (const m of parts) m.material.opacity = m.material.userData.base * f;
  });
}
// a clock of light on the ground whose hands race, then stop dead (Kronos)
function clock(fx, c, r, life) {
  const grp = new THREE.Group(); grp.position.set(c.x, c.y + .08, c.z);
  const rim = mesh(ringG(), glow('#e8d8a0', .8), grp); rim.rotation.x = -PI / 2; rim.scale.setScalar(r);
  const marks = [], hands = [];
  for (let i = 0; i < 12; i++) { const m = mesh(boxG(), glow('#fff2c0', .9), grp), a = i / 12 * PI * 2; m.scale.set(.14, .04, i % 3 ? .6 : 1.2); m.position.set(Math.sin(a) * r * .86, 0, Math.cos(a) * r * .86); m.rotation.y = a; marks.push(m); }
  for (const [len, w] of [[r * .55, .22], [r * .8, .12]]) { const h = new THREE.Group(), m = mesh(boxG(), glow('#ffffff', .9), h); m.scale.set(w, .05, len); m.position.z = len / 2; grp.add(h); hands.push(h); }
  return fx.add(grp, life, (e, k) => {
    const run = Math.max(0, .35 - e.t) / .35; hands[0].rotation.y += run * .25; hands[1].rotation.y += run * 1.1;
    const f = fadeIO(k, .05, .2); rim.material.opacity = .8 * f;
    for (const m of marks) m.material.opacity = .9 * f; for (const h of hands) h.children[0].material.opacity = .9 * f;
    grp.scale.setScalar(Math.min(1, e.t * 4));
  });
}
// a giant ghost blade swept round her (Titans' Edge): from +arc/2 to -arc/2 over `sweep` s
function giantBlade(fx, p, r, arc, sweep, facing, op = 1) { // (op: a fainter ghost of the blade, Titans' Edge)
  const grp = new THREE.Group(), blade = new THREE.Group(); grp.add(blade);
  const out = mesh(boxG(), glow('#9fc8ff', .5), blade), core = mesh(boxG(), glow('#ffffff', .9), blade), hilt = mesh(boxG(), glow('#ffd890', .9), blade);
  out.scale.set(.7, .16, r); out.position.z = r / 2 + .4; core.scale.set(.28, .1, r * .98); core.position.z = r / 2 + .4; hilt.scale.set(1.3, .18, .2); hilt.position.z = .4;
  grp.position.set(p.pos.x, p.pos.y + 1.1, p.pos.z);
  return fx.add(grp, sweep + .3, (e, k) => {
    const u = Math.min(1, e.t / sweep), s = u * u * (3 - 2 * u); grp.rotation.y = facing + arc / 2 - arc * s;
    const f = e.t > sweep ? 1 - (e.t - sweep) / .3 : Math.min(1, e.t * 10);
    out.material.opacity = .5 * f * op; core.material.opacity = .9 * f * op; hilt.material.opacity = .9 * f * op;
  });
}

// Pegasus' Bound: an upright ring of wind facing her line, spinning, that she leaps through
function hoop(fx, c, facing, life) {
  const grp = new THREE.Group(), a = mesh(ringG(), glow('#d8f4ff', .85, false), grp), b = mesh(ringG(), glow('#ffffff', .9), grp); // (not additive: it must read over pale sand too)
  grp.position.copy(c); grp.rotation.y = facing; b.scale.setScalar(.8);
  for (let i = 0; i < 10; i++) { const ang = i / 10 * PI * 2; fx.g.fx?.spawn(V3(c.x + Math.cos(ang) * Math.cos(facing) * 1.1, c.y + Math.sin(ang) * 1.1, c.z - Math.cos(ang) * Math.sin(facing) * 1.1), 1, { colors: ['#ffffff', '#bfe8ff'], speed: .6, gravity: 0, life: .4, size: .1 }); }
  return fx.add(grp, life, (e, k) => {
    const sc = .5 + .7 * Math.min(1, k * 4); a.scale.setScalar(sc * 1.15); b.scale.setScalar(sc * .9); a.rotation.z = e.t * 9; b.rotation.z = -e.t * 12;
    a.material.opacity = .85 * (1 - k); b.material.opacity = .9 * (1 - k) * (1 - k);
  });
}

// ---------------------------------------------------------------------------------------------
// round 22 (Roy): lasting effects on the world, ticked by SkillFx.update (tickWorld) and undone by SkillFx.clear (clearWorld)
//   fx.sheets   Ring of Ice sheets {x, z, r, until}: monsters on them slide (their moveBy is caught and turned into a glide)
//   fx.veil     Hades' Veil {p, until, ...}: her materials swapped for see-through twins, her moveBy without colliders
// Both work on instance overrides of moveBy (Actor.moveBy in entities.js stays as it is), removed the moment they end.
// ---------------------------------------------------------------------------------------------
export function tickWorld(fx, dt) { tickIce(fx, dt); tickVeil(fx, dt); }
export function clearWorld(fx) {
  for (const e of fx.sliders || []) unslide(e);
  fx.sliders = new Set(); fx.sheets = [];
  if (fx.veil) veilOff(fx, true);
}

// ---- Ring of Ice: the sheet, a terrain-hugging ring (a hole where she stood, pale ice, white cracks, a bright rim)
let ICE_TEX = null;
function iceTex() {
  if (ICE_TEX) return ICE_TEX;
  const n = 64, cv = document.createElement('canvas'); cv.width = cv.height = n; const x = cv.getContext('2d');
  x.fillStyle = '#bfe6fa'; x.fillRect(0, 0, n, n);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { x.fillStyle = rnd() < .5 ? '#d8f2ff' : '#a8d8f0'; x.fillRect(Math.floor(rnd() * n), Math.floor(rnd() * n), 2, 1); }
  x.fillStyle = '#ffffff';
  for (let k = 0; k < 9; k++) { // cracks running out from the middle
    let px = n / 2, py = n / 2, a = k / 9 * PI * 2 + rnd() * .5;
    for (let j = 0; j < 40; j++) { a += (rnd() - .5) * .7; px += Math.cos(a); py += Math.sin(a); if (px < 0 || py < 0 || px >= n || py >= n) break; x.fillRect(Math.floor(px), Math.floor(py), 1, 1); }
  }
  for (let i = 0; i < 30; i++) x.fillRect(Math.floor(rnd() * n), Math.floor(rnd() * n), 1, 1);
  ICE_TEX = new THREE.CanvasTexture(cv); ICE_TEX.magFilter = ICE_TEX.minFilter = THREE.NearestFilter; ICE_TEX.generateMipmaps = false;
  return ICE_TEX;
}
function iceSheet(fx, c, r, life) {
  const g = fx.g, S = { x: c.x, z: c.z, r, until: fx.now() + life };
  (fx.sheets || (fx.sheets = [])).push(S);
  const grp = new THREE.Group(), y0 = ground(g, c.x, c.z); grp.position.set(c.x, y0, c.z);
  // the ring follows the ground under every vertex, so a slope doesn't swallow half of it
  const gm = new THREE.RingGeometry(.9, r, 48, 8).rotateX(-PI / 2); gm.userData.own = true;
  const pos = gm.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, ground(g, c.x + pos.getX(i), c.z + pos.getZ(i)) - y0 + .07);
  const m = new THREE.MeshBasicMaterial({ map: iceTex(), color: '#ffffff', transparent: true, opacity: .62, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 });
  m.userData.own = true;
  const sheet = mesh(gm, m, grp);
  const rimG = new THREE.RingGeometry(r - .35, r, 48, 1).rotateX(-PI / 2); rimG.userData.own = true;
  const rp = rimG.attributes.position; for (let i = 0; i < rp.count; i++) rp.setY(i, ground(g, c.x + rp.getX(i), c.z + rp.getZ(i)) - y0 + .09);
  const rim = mesh(rimG, glow('#e8f8ff', .8), grp);
  fx.add(grp, life, (e, k) => {
    const f = Math.min(1, e.t * 4) * Math.min(1, (life - e.t) / .8);
    m.opacity = .62 * f; rim.material.opacity = (.55 + Math.sin(e.t * 3) * .2) * f;
    if (Math.random() < .25) { const a = Math.random() * PI * 2, d = 1 + Math.random() * (r - 1), px = c.x + Math.sin(a) * d, pz = c.z + Math.cos(a) * d; g.fx?.spawn(V3(px, ground(g, px, pz) + .15, pz), 1, { colors: ['#ffffff', '#e8f8ff'], speed: .2, gravity: -.4, life: .5, size: .08 }); }
    if (k > .97 && !e.done) { e.done = true; sfxo('break', { vol: .35 }); }
  });
  void sheet;
  return S;
}
// a monster steps on: its moveBy only gathers where it wants to go; tickIce turns that into a glide with little grip
function slideOn(fx, e) {
  const base = e.moveBy; // the class's own (Enemy.moveBy) or whatever override it already wore
  e._ice = { vx: 0, vz: 0, wx: 0, wz: 0, fresh: true, base, ph: Math.random() * 6 };
  e.moveBy = function (dx, dz) { const I = this._ice; if (!I || I.raw) return base.call(this, dx, dz); I.wx += dx; I.wz += dz; return true; }; // (raw: tickIce's own glide, whose long strides Actor.moveBy splits through this.moveBy)
  fx.sliders.add(e);
}
function unslide(e) {
  if (!e._ice) return;
  const I = e._ice; delete e.moveBy; if (e.moveBy !== I.base) e.moveBy = I.base; // back to the prototype's (or the earlier override)
  e._ice = null; if (e.rig?.root) e.rig.root.rotation.z = 0;
}
function tickIce(fx, dt) {
  const g = fx.g, now = fx.now(), S = fx.sheets || (fx.sheets = []), L = fx.sliders || (fx.sliders = new Set());
  for (let i = S.length - 1; i >= 0; i--) if (S[i].until <= now) S.splice(i, 1);
  if (!S.length && !L.size) return;
  if (dt <= 0) return;
  const onIce = (e) => S.some((s) => Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < s.r + (e.radius || .5) * .5);
  for (const e of g.enemies || []) if (!e.dead && !e.flying && !e._ice && onIce(e)) slideOn(fx, e);
  for (const e of [...L]) {
    const I = e._ice;
    if (!I || e.dead || !g.enemies.includes(e)) { unslide(e); L.delete(e); continue; }
    const on = onIce(e), heavy = e.T?.boss || e.T?.heavy;
    // what it tried to do this frame (its own steps and its knock) is the speed it wants; on ice it gets there slowly
    let wx = I.wx / dt, wz = I.wz / dt; I.wx = I.wz = 0;
    const kn = e.knock; if (kn && kn.lengthSq() > .01) { I.vx += kn.x * (heavy ? .4 : .9); I.vz += kn.z * (heavy ? .4 : .9); kn.set(0, 0, 0); wx = I.vx; wz = I.vz; } // a blow sends it skating
    const grip = heavy ? 1.6 : .8, k = I.fresh ? 1 : 1 - Math.exp(-grip * dt); I.fresh = false;
    I.vx += (wx - I.vx) * k; I.vz += (wz - I.vz) * k;
    const sp = Math.hypot(I.vx, I.vz), cap = 10; if (sp > cap) { I.vx *= cap / sp; I.vz *= cap / sp; }
    I.raw = true; const ok = sp < .02 || I.base.call(e, I.vx * dt, I.vz * dt); I.raw = false;
    if (!ok) { I.vx *= -.3; I.vz *= -.3; } // a wall: it bumps off (moveBy keeps it out)
    // arms out, swaying: the more its feet disagree with where it is going, the wilder
    const slip = Math.min(1, Math.hypot(wx - I.vx, wz - I.vz) / 4 + sp / 12);
    I.ph += dt * 11; if (e.rig?.root) e.rig.root.rotation.z = on ? Math.sin(I.ph) * .16 * slip : 0;
    if (on && sp > 1.5 && Math.random() < .3) g.fx?.spawn(V3(e.pos.x, e.pos.y + .08, e.pos.z), 1, { colors: ['#ffffff', '#d8f2ff'], speed: .8, gravity: 2, life: .35, size: .09 });
    if (!on) { e.knock?.set((I.vx - wx) * .6, 0, (I.vz - wz) * .6); unslide(e); L.delete(e); } // off the edge: grip again, what was left of the skid goes on a moment
  }
}

// ---- Hades' Veil: see-through, and the colliders (walls, fences, rocks, trees) let her pass. The world's other rules
// still hold (deep sea, cliffs too steep, the edge of the map, a cave's or a room's own walls: World.walkable), so she
// never ends up in the void. When it runs out (or the scene changes) she is put on the nearest open spot.
const GHOSTS = new WeakMap();
const VEIL_TINT = new THREE.Color('#a8bcff');
function ghostOf(m) {
  if (!m || m.userData?.veil) return m;
  let c = GHOSTS.get(m);
  if (!c) {
    c = m.clone(); c.transparent = true; c.opacity = .36; c.depthWrite = false; c.depthTest = false; // she shows through the wall she is in
    if (c.color) c.color.lerp(VEIL_TINT, .35);
    if (c.emissive) c.emissive.set('#1c2650');
    c.userData = { ...c.userData, veil: true }; GHOSTS.set(m, c);
  }
  return c;
}
const isGhost = (m) => (Array.isArray(m) ? m.some((x) => x?.userData?.veil) : !!m?.userData?.veil);
// her moveBy while veiled: Actor.moveBy without the push out of the colliders. A wall that stands on a step of the
// ground (a terrace, a city wall on its bank) is a step too steep to walk, so inside a collider the climb rule is waived
// (STEEP); everywhere else the slopes, the deep water and the edges hold as ever
const STEEP = { climb: 99, flying: false, noTown: false };
function phaseMove(dx, dz) {
  const n = Math.ceil(Math.hypot(dx, dz) / .6);
  if (n > 1) { let ok = false; for (let i = 0; i < n; i++) ok = phaseMove.call(this, dx / n, dz / n) || ok; return ok; }
  const w = this.g.world, C = w.collide, ox = this.pos.x, oz = this.pos.z; let nx = ox + dx, nz = oz + dz;
  STEEP.g = this.g; STEEP.wade = this.wade;
  const can = (x, z) => w.walkable(this, ox, oz, x, z) || (!!C && (C.blocked(x, z, .3) || C.blocked(ox, oz, .3)) && w.walkable(STEEP, ox, oz, x, z));
  if (!can(nx, nz)) {
    if (Math.abs(dx) > 1e-5 && can(nx, oz)) nz = oz;
    else if (Math.abs(dz) > 1e-5 && can(ox, nz)) nx = ox;
    else return false;
  }
  this.pos.x = nx; this.pos.z = nz;
  if (!this.flying) this.pos.y = w.ground(nx, nz);
  return true;
}
export function veilOn(g, p, time) {
  const fx = g.skillFx; if (!fx || !p) return;
  if (fx.veil) { fx.veil.until = fx.now() + time; return; }
  fx.veil = { p, until: fx.now() + time, orig: new Map(), hid: new Set(), shadow: new Set(), mats: new Set(), mote: 0 };
  if (p.moveBy !== phaseMove) { fx.veil.own = Object.prototype.hasOwnProperty.call(p, 'moveBy') ? p.moveBy : null; p.moveBy = phaseMove; }
  p.veiled = true; g.playerVeiled = true; // (for anyone who wants to know: the camera, monsters, a scene)
  tickVeil(fx, 0);
}
function tickVeil(fx, dt) {
  const V = fx.veil; if (!V) return;
  const p = V.p, now = fx.now(), left = V.until - now;
  if (left <= 0 || p.dead || !p.rig) { veilOff(fx); return; }
  p.rig.root.traverse((o) => {
    if (!o.isMesh || o.userData.fx) return;
    if (o.userData.outline && !o.userData.hd) { if (o.visible) { o.visible = false; V.hid.add(o); } return; } // no ink line round a ghost
    if (o.castShadow) { o.castShadow = false; V.shadow.add(o); }
    const m = o.material; if (!m || isGhost(m)) return;
    V.orig.set(o, m); o.material = Array.isArray(m) ? m.map(ghostOf) : ghostOf(m);
    for (const x of Array.isArray(o.material) ? o.material : [o.material]) V.mats.add(x);
  });
  // the last second and a half it flickers, so she knows to get out of the wall
  const op = left < 1.5 ? (Math.floor(left * 8) % 2 ? .62 : .3) : .34 + Math.sin(now * 5) * .04;
  for (const m of V.mats) m.opacity = op;
  if ((V.mote -= dt) <= 0) { V.mote = .07; fx.g.fx?.spawn(V3(p.pos.x + (Math.random() - .5) * .6, p.pos.y + .3 + Math.random() * 1.4, p.pos.z + (Math.random() - .5) * .6), 1, { colors: ['#2a2c40', '#4a4f78', '#a8b8f0'], speed: .3, gravity: -1.4, life: .6, size: .09 }); }
}
function veilOff(fx, quiet) {
  const V = fx.veil; if (!V) return; fx.veil = null;
  const p = V.p, g = fx.g;
  for (const [o, m] of V.orig) if (isGhost(o.material)) o.material = m;
  for (const o of V.hid) o.visible = true;
  for (const o of V.shadow) o.castShadow = true;
  if (p.moveBy === phaseMove) { delete p.moveBy; if (V.own) p.moveBy = V.own; }
  p.veiled = false; g.playerVeiled = false;
  if (!p.dead && g.world) unstick(g, p);
  if (!quiet) { g.skillFx?.ring(p.pos, { r0: .3, r1: 1.8, color: '#a8b8f0', life: .35 }); sfxo('fog_burst', { vol: .5 }); }
}
// she must never be left inside a wall: if a collider holds her, step out to the nearest open spot (rings outward)
function unstick(g, p) {
  const w = g.world, C = w.collide, r = (p.radius || .45) + .05;
  const free = (x, z) => !C?.blocked(x, z, r) && w.walkable(p, x, z, x, z);
  let x = p.pos.x, z = p.pos.z;
  if (!free(x, z)) {
    let best = null;
    for (let d = .25; d < 16 && !best; d += .25) {
      const n = Math.max(12, Math.ceil(d * PI * 2 / .3));
      let bd = 1e9;
      for (let i = 0; i < n; i++) { const a = i / n * PI * 2, qx = x + Math.sin(a) * d, qz = z + Math.cos(a) * d; if (free(qx, qz)) { const k = Math.abs(ground(g, qx, qz) - p.pos.y); if (k < bd) { bd = k; best = [qx, qz]; } } } // of the spots this far out, the one level with her
    }
    if (best) { x = best[0]; z = best[1]; }
  }
  p.pos.x = x; p.pos.z = z; p.pos.y = w.ground(x, z);
  w.resolve(p.pos, p.radius); // (also tells the colliders where she now stands, collide.js LAST)
  p.sync?.();
}

// Charge (round 23): is there a shield on her arm (on her back, or put away in a town, it doesn't count), and what is in
// her hand. The rig is what shows, so a shield bought apart from the weapon counts as well as one that comes with it.
export function chargeLead(g, p) {
  const r = p.rig || {}, S = r.shield, style = r.style || g.hero?.W?.style || 'blade';
  const shield = !!S && S.visible !== false && !r._stowed && S.parent !== r.torso && !(S === r.shieldBack);
  return { shield, style: r._stowed ? 'bare' : style };
}
// how far ahead of her the charge lands (behind a shield, at the shield; otherwise where the point leads), and its sound
const LEAD_REACH = { shield: .8, polearm: 1.5, twohand: 1.15, dual: .95, blade: 1, spear: 1.35, bare: .7 };
const LEAD_SND = { polearm: 'spear', spear: 'spear', twohand: 'twohand', dual: 'dual' };

// ---------------------------------------------------------------------------------------------
// round 30 (Roy): the pieces of the three new ultimates (fire, earth, the void)
// ---------------------------------------------------------------------------------------------
const STONE = {};
// a flat-shaded stone material per colour (shared, never disposed); spikes and slabs sink away instead of fading
// round 33 (stage 9): the world's own stone, a toon material wearing a painted grit tile (pxart.js), tinted to the colour,
// so a spike out of the ground reads as the same rock as the hills round it (it was flat-shaded Lambert)
const stoneMat = (c) => STONE[c] || (STONE[c] = kitMat('fxstone', [16, 16, (k, Q) => paGrit(k, Q, { fleck: 16, pit: 5, bump: 3, crack: 1 })], c));
const spikeG = () => geo('spike', () => new THREE.ConeGeometry(.5, 1, 5).translate(0, .5, 0)); // base on the ground, tip at y = 1
const flameG = () => geo('flame', () => new THREE.ConeGeometry(.5, 1, 6, 1, true).translate(0, .5, 0));
// Inferno: the column of flame turning round her (tongues on a rising helix, a ring of fire at her feet)
function firestorm(fx, p, life, radius) {
  const grp = new THREE.Group(), cols = ['#ff4a1a', '#ff8a2a', '#ffd04a', '#ff6a1a'], tongues = [];
  for (let i = 0, N = fxCount(26); i < N; i++) { const o = mesh(flameG(), glow(cols[i % 4], .75), grp); tongues.push({ o, a: i * 2.4, r: .9 + (i % 5) * radius * .16, h: .2 + (i % 7) * .55, ph: Math.random() * 6 }); }
  const base = mesh(ringG(), glow('#ff6a1a', .6), grp), inner = mesh(discG(), glow('#ff3a0a', .22), grp);
  base.rotation.x = inner.rotation.x = -PI / 2; base.position.y = .08; inner.position.y = .06;
  return fx.add(grp, life, (e, k) => {
    grp.position.set(p.pos.x, p.pos.y, p.pos.z);
    const f = fadeIO(k, .12, .2), grow = Math.min(1, k * 5);
    base.scale.setScalar(radius * grow); inner.scale.setScalar(radius * .95 * grow); base.material.opacity = .6 * f; inner.material.opacity = .22 * f;
    for (const T of tongues) {
      const a = T.a + e.t * (5 - T.r * .4), r = T.r * grow, fl = .75 + Math.sin(e.t * 17 + T.ph) * .25;
      T.o.position.set(Math.sin(a) * r, T.h * grow + Math.sin(e.t * 3 + T.ph) * .2, Math.cos(a) * r);
      T.o.scale.set(.55 * fl, (1.4 + T.h * .5) * fl * grow, .55 * fl); T.o.rotation.y = -a; T.o.material.opacity = .75 * f * fl;
    }
    if (Math.random() < .9) { const a = Math.random() * PI * 2, r = Math.random() * radius; fx.g.fx?.spawn(V3(p.pos.x + Math.sin(a) * r, p.pos.y + .2 + Math.random() * 3, p.pos.z + Math.cos(a) * r), 2, { colors: ['#ffd04a', '#ff7a1a', '#ff3a1a', '#3a2a24'], speed: 1.2, gravity: -4, life: .6, size: .16 }); }
  });
}
// one burning rock out of the sky onto (x, z): a red ring marks it, it lands .55 s later
function skyRock(g, s, x, z, i) {
  const fx = g.skillFx, gy = ground(g, x, z), c = V3(x, gy, z), fall = .55, sx = (Math.random() - .5) * 10, sz = -4 - Math.random() * 4;
  fx.ring(c, { r0: 2.6, r1: 3, color: '#ff4a1a', life: fall + .15, opacity: .7 });
  const rock = new THREE.Group(), core = mesh(rockG(), stoneMat('#4a2416'), rock), fire = mesh(ballG(), glow('#ff7a1a', .75), rock), out = mesh(ballG(), glow('#ffd04a', .35), rock);
  core.scale.setScalar(.7); fire.scale.setScalar(.95); out.scale.setScalar(1.35);
  if (i % 3 === 0) sfxo('fire_launch', { vol: .6 });
  fx.add(rock, fall + .05, (e, k) => {
    const u = Math.min(1, e.t / fall), uu = u * u; rock.position.set(x + sx * (1 - uu), gy + .6 + 22 * (1 - uu), z + sz * (1 - uu)); core.rotation.x += .25; core.rotation.y += .17;
    g.fx.spawn(rock.position, 2, { colors: ['#ffd04a', '#ff6a1a', '#3a2a24'], speed: 1, gravity: -2, life: .45, size: .26, spread: .6 });
    if (u >= 1 && !e.boom) {
      e.boom = true; rock.visible = false; fx.explosion(V3(x, gy + .7, z), 3.2); fx.smash(c, 3.6);
      for (const en of foes(g, x, z, 3.2)) { g.hitEnemy(en, s.power, true, c, { magic: true, el: 'fire', knock: 1.4, snd: 'crush' }); if (alive(en)) en.addDot('burn', s.burn * .6 * lvlMul(g), s.time); }
      g.shake(.35); sfxo('fire_boom', { vol: .75 });
      return false;
    }
  });
}
// a wall of flame running out from c to radius R
function fireRing(fx, c, R, life) {
  const grp = new THREE.Group(), n = fxCount(40), tongues = []; grp.position.copy(c);
  for (let i = 0; i < n; i++) tongues.push(mesh(flameG(), glow(i % 3 ? '#ff7a1a' : '#ffd04a', .8), grp));
  return fx.add(grp, life, (e, k) => {
    const r = 1 + (R - 1) * (1 - (1 - k) ** 2), f = 1 - k;
    tongues.forEach((o, i) => { const a = i / n * PI * 2; o.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); const fl = .7 + Math.sin(e.t * 20 + i) * .3; o.scale.set(.9, (2.4 - k * 1.6) * fl, .9); o.material.opacity = .8 * f; });
  });
}
// Gaia: one ring of the quake running out (dust thrown up along it, a ring of light on the ground)
function quakeRing(g, c, r, w) {
  const fx = g.skillFx;
  fx.ring(c, { r0: .5, r1: r, color: w % 2 ? '#e8c890' : '#c8964a', life: .55 + w * .1, opacity: .75 });
  for (let i = 0; i < 18; i++) { const a = i / 18 * PI * 2, d = r * (.5 + Math.random() * .5); fx.after(d / r * .4, () => g.fx.spawn(V3(c.x + Math.sin(a) * d, ground(g, c.x + Math.sin(a) * d, c.z + Math.cos(a) * d) + .2, c.z + Math.cos(a) * d), 3, { colors: ['#8a7058', '#c8a878', '#5a4a3a'], speed: 4, gravity: 10, life: .7, size: .2, spread: .6 })); }
}
// a stone spike bursting out of the ground at (x, z), h metres tall: up in .12 s, holds, sinks back
function earthSpike(g, x, z, h, color) {
  const fx = g.skillFx, gy = ground(g, x, z), grp = new THREE.Group(), o = mesh(spikeG(), stoneMat(color), grp), tip = mesh(spikeG(), stoneMat('#c8b8a0'), grp);
  o.castShadow = true; tip.position.y = .62; if (!fxLow()) addOutline(grp); grp.position.set(x, gy - .1, z); grp.rotation.set((Math.random() - .5) * .35, Math.random() * PI, (Math.random() - .5) * .35);
  const w = .5 + h * .22;
  g.fx.spawn(V3(x, gy + .2, z), 5, { colors: ['#8a7058', '#c8a878', '#5a4a3a'], speed: 3.5, gravity: 12, life: .5, size: .16, spread: .4 });
  return fx.add(grp, 1.25, (e, k) => {
    const up = Math.min(1, e.t / .12), down = e.t > .75 ? Math.min(1, (e.t - .75) / .5) : 0, s = up * (1 - down * .2);
    o.scale.set(w, h * s, w); tip.scale.set(w * .38, h * .38 * s, w * .38); tip.position.y = h * .62 * s;
    grp.position.y = gy - .1 - down * h * .9;
  });
}
// a slab of rock slamming down on a foe
function stoneFist(g, q, size) {
  const fx = g.skillFx, gy = ground(g, q.x, q.z), o = mesh(rockG(), stoneMat('#7a6a58'));
  o.castShadow = true; if (!fxLow()) addOutline(o); o.rotation.set(Math.random(), Math.random() * PI, Math.random());
  fx.ring(V3(q.x, gy, q.z), { r0: size * .9, r1: size, color: '#c8964a', life: .35, opacity: .6 });
  let landed = false;
  return fx.add(o, 1.2, (e) => {
    const u = Math.min(1, e.t / .32), down = e.t > .7 ? (e.t - .7) / .5 : 0;
    o.scale.set(size, size * .8, size); o.position.set(q.x, gy + size * .45 + 9 * (1 - u * u) - down * size * 1.2, q.z);
    if (u >= 1 && !landed) { landed = true; g.fx.spawn(V3(q.x, gy + .3, q.z), 14, { colors: ['#8a7058', '#c8a878', '#5a4a3a'], speed: 6, gravity: 14, life: .6, size: .2, spread: .8 }); fx.smash(V3(q.x, gy, q.z), size * 2); }
  });
}
// where the void opens: on the thickest knot of foes within reach (not right on top of her), else 7 m ahead
function voidSpot(g, p, tgt, s) {
  let best = null, bn = 0;
  const list = foes(g, p.pos.x, p.pos.z, 14);
  for (const e of list) { let n = 0; for (const o of list) if (flatDist(o.pos, e.pos) < 5) n++; if (n > bn || (n === bn && e === tgt)) { bn = n; best = e; } }
  const [fx, fz] = fwd(p);
  if (!best) return { x: p.pos.x + fx * 7, z: p.pos.z + fz * 7 };
  const d = flatDist(best.pos, p.pos);
  if (d < 4) { const a = d > .1 ? Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z) : p.facing; return { x: p.pos.x + Math.sin(a) * 4, z: p.pos.z + Math.cos(a) * 4 }; }
  return { x: best.pos.x, z: best.pos.z };
}
// the black hole: a black core rimmed in violet light, a tilted disc of fire turning round it, two thin jets, a shadow on the
// ground; it drags foes in (bosses barely), gnaws at them every s.tick s, then collapses into a blast
function blackHole(g, s, c, gy) {
  const fx = g.skillFx, R = s.radius, grp = new THREE.Group(); grp.position.copy(c);
  const coreM = new THREE.MeshBasicMaterial({ color: '#000000', fog: false }); coreM.userData.own = true;
  const core = mesh(ballG(), coreM, grp);
  const rim = mesh(ballG(), glow('#d8b0ff', .7), grp), halo = mesh(ballG(), glow('#6a2ac0', .35), grp);
  rim.material.side = THREE.BackSide; halo.material.side = THREE.BackSide;
  const tilt = new THREE.Group(); grp.add(tilt); tilt.rotation.set(.42, 0, .18);
  const spin = new THREE.Group(); tilt.add(spin);
  const diskG = (a, b) => geo('acc' + a + '_' + b, () => new THREE.RingGeometry(a, b, 56, 1));
  const disks = [[1.05, 1.3, '#fff2d8', .9], [1.3, 1.9, '#ffb04a', .65], [1.9, 2.7, '#c0502a', .45], [2.7, 3.6, '#7a2ab0', .3]].map(([a, b, col, op]) => { const m = mesh(diskG(a, b), glow(col, op), spin); m.rotation.x = -PI / 2; return [m, op]; });
  const motes = []; for (let i = 0, N = fxCount(22); i < N; i++) { const m = mesh(ballG(), glow(i % 3 ? '#ffd8a0' : '#c08aff', .9), spin); const r = 1.3 + Math.random() * 2.3; m.scale.setScalar(.06 + Math.random() * .08); motes.push({ m, r, a: Math.random() * PI * 2, y: (Math.random() - .5) * .12 }); }
  const jets = [1, -1].map((sg) => { const j = mesh(boxG(), glow('#c8a0ff', .5), tilt); j.userData.sg = sg; return j; });
  const shadow = mesh(discG(), glow('#000000', .5, false)); shadow.rotation.x = -PI / 2; shadow.position.set(c.x, gy + .07, c.z); fx.add(shadow, s.life + .3, (e, k) => { shadow.scale.setScalar(4.5 * Math.min(1, e.t * 2) * (k > .9 ? (1 - k) / .1 : 1)); });
  fx.ring(V3(c.x, gy, c.z), { r0: R * .97, r1: R, color: '#a05aff', life: s.life, opacity: .45 });
  fx.ring(V3(c.x, gy, c.z), { r0: R, r1: .5, color: '#c08aff', life: 1.1, opacity: .6 });
  g.flash?.(.18, '#2a0a4a'); g.shake(.4); sfxo('void_open'); fx.after(.35, () => sfxo('void_hum'));
  const tickAt = new Map(); let gone = false;
  fx.add(grp, s.life + .45, (e, k, dt) => {
    const T = e.t, grow = Math.min(1, T / .5), end = T > s.life ? Math.min(1, (T - s.life) / .35) : 0, sc = grow * (1 - end * end);
    grp.scale.setScalar(Math.max(.001, sc));
    core.scale.setScalar(1.15); rim.scale.setScalar(1.32 + Math.sin(T * 9) * .04 + end * .6); halo.scale.setScalar(1.9 + Math.sin(T * 3) * .1);
    rim.material.opacity = .7 + end * .3; spin.rotation.y += dt * (2.4 + T * .6);
    for (const [m, op] of disks) m.material.opacity = op * (.8 + Math.sin(T * 7) * .2);
    for (const M of motes) { M.a += dt * 7 / M.r; M.m.position.set(Math.sin(M.a) * M.r, M.y, Math.cos(M.a) * M.r); }
    for (const j of jets) { const l = 5 + Math.sin(T * 11) * .6; j.scale.set(.09, l, .09); j.position.y = j.userData.sg * (l / 2 + 1); j.material.opacity = .5 * grow * (1 - end); }
    if (end <= 0) {
      // the drag: particles sucked in on a swirl, and the foes after them
      const L = g.fx?.live;
      if (L) for (let i = 0; i < 4; i++) {
        const a = Math.random() * PI * 2, r = R * (.35 + Math.random() * .65), q = V3(c.x + Math.sin(a) * r, gy + .3 + Math.random() * 3.2, c.z + Math.cos(a) * r);
        g.fx.spawn(q, 1, { colors: ['#c08aff', '#ffd8a0', '#5a2a8a', '#ffffff'], speed: 1, gravity: 0, life: .9, size: .12 });
        const v = L[L.length - 1]?.userData?.v; if (v) { const dx = c.x - q.x, dy = c.y - q.y, dz = c.z - q.z, l = Math.hypot(dx, dy, dz) || 1, sp = 6 + r * .5; v.set(dx / l * sp + dz / l * 3, dy / l * sp, dz / l * sp - dx / l * 3); }
      }
      for (const en of foes(g, c.x, c.z, R)) {
        const d = flatDist(en.pos, c), boss = en.T?.boss || en.T?.heavy, k2 = boss ? .2 : 1;
        if (d > 1.1) { const sp = s.pull * (.45 + .55 * (1 - d / R)) * k2 * dt; en.moveBy?.((c.x - en.pos.x) / d * sp, (c.z - en.pos.z) / d * sp); }
        if (!boss) en.stunT = Math.max(en.stunT || 0, .3);
        if (T > .4 && g.time >= (tickAt.get(en) ?? 0)) { tickAt.set(en, g.time + s.tick); g.hitEnemy(en, s.power, false, c, { magic: true, knock: 0, snd: 'magic' }); }
      }
    } else if (!gone && end >= .95) {
      gone = true;
      const q = V3(c.x, gy, c.z);
      g.flash?.(.35, '#ffffff'); g.shake(1.2); g.hitstop(.2);
      fx.beam(q, 1, '#c08aff'); fx.ring(q, { r0: .5, r1: R * .9, color: '#ffffff', life: .6 }); fx.ring(q, { r0: R * .3, r1: R * 1.1, color: '#a05aff', life: 1, opacity: .7 });
      fx.ring(q, { r0: .3, r1: R * .6, color: '#ffb04a', life: .45, flat: false, y: 2.6 });
      for (const en of foes(g, c.x, c.z, R * .8)) g.hitEnemy(en, s.final, true, q, { magic: true, stun: s.stun, knock: s.knock, snd: 'crush' });
      g.fx.spawn(V3(c.x, c.y, c.z), 80, { colors: ['#ffffff', '#d8b0ff', '#a05aff', '#ffb04a', '#2a0a4a'], speed: 16, life: 1.1, gravity: 2, size: .22, spread: 1.6 });
      sfxo('void_collapse');
    }
  });
}

// ---------------------------------------------------------------------------------------------
// round 31 (Roy): the pieces of the reworked skills
// ---------------------------------------------------------------------------------------------
// Kampe's Venom Trail: one continuous band of venom along her path (no more separate puddles). A ribbon rebuilt every frame from
// the points she has walked through; each point dries away after `linger` s (the band narrows to nothing at its old end), and a
// roll, a teleport or a fall leaves a gap (brk). What it poisons is still a circle round each point (the caller's hit test).
function venomStrip(fx, half) {
  const g = fx.g, N = 220, pts = [];
  const mk = (color, op, w, y) => {
    const gm = new THREE.BufferGeometry(), pos = new Float32Array(N * 2 * 3), idx = new Uint16Array((N - 1) * 6);
    gm.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gm.setIndex(new THREE.BufferAttribute(idx, 1)); gm.userData.own = true; gm.setDrawRange(0, 0);
    const m = pxify(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })); m.userData.own = true;
    const o = mesh(gm, m); o.renderOrder = 3; return { o, gm, pos, idx, w, y };
  };
  const bands = [mk('#2e6a26', .46, 1, .06), mk('#5aa83e', .3, .55, .075), mk('#b8f08a', .22, .16, .085)];
  const grp = new THREE.Group(); for (const b of bands) grp.add(b.o);
  const S = { pts, add(x, z, end, brk) { if (pts.length >= N) pts.shift(); pts.push({ x, z, end, born: fx.now(), brk: !!brk }); } };
  fx.add(grp, 1e9, () => {
    const now = fx.now();
    while (pts.length && pts[0].end <= now) pts.shift();
    if (S.done && !pts.length) return false;
    const n = pts.length;
    for (const B of bands) {
      let k = 0;
      for (let i = 0; i < n; i++) {
        const P = pts[i], A = pts[Math.max(0, i - 1)], C = pts[Math.min(n - 1, i + 1)];
        let dx = C.x - A.x, dz = C.z - A.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const w = half * B.w * Math.min(1, (P.end - now) / .7) * Math.min(1, (now - P.born) / .12 + .3) * (1 + Math.sin(i * 1.7 + P.born) * .08);
        const lx = P.x - dz * w, lz = P.z + dx * w, rx = P.x + dz * w, rz = P.z - dx * w;
        B.pos.set([lx, ground(g, lx, lz) + B.y, lz, rx, ground(g, rx, rz) + B.y, rz], i * 6);
        if (i > 0 && !P.brk) { const a = (i - 1) * 2; B.idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k); k += 6; }
      }
      B.gm.attributes.position.needsUpdate = true; B.gm.index.needsUpdate = true; B.gm.setDrawRange(0, k);
    }
    bands[1].o.material.opacity = .3 + Math.sin(now * 5) * .05;
    if (n && Math.random() < .35) { const P = pts[Math.floor(Math.random() * n)]; g.fx?.spawn(V3(P.x + (Math.random() - .5) * half, ground(g, P.x, P.z) + .1, P.z + (Math.random() - .5) * half), 1, { colors: ['#8fe05a', '#d8ffb0', '#2a5a1a'], speed: .25, gravity: -1.2, life: .7, size: .1 }); }
  });
  return S;
}
// Prometheus' Arc: blue tongues of fire running along the sweep, then a spray of blue sparks off its rim
function blueFlames(fx, p, R, arc, facing) {
  const g = fx.g, grp = new THREE.Group(), n = 16, tongues = [];
  grp.position.set(p.pos.x, p.pos.y, p.pos.z);
  for (let i = 0; i < n; i++) {
    const a = facing + arc / 2 - arc * (i / (n - 1)), r = R * (.62 + (i % 3) * .14);
    const o = mesh(flameG(), glow(i % 2 ? '#3a8aff' : '#8ad8ff', .85), grp); o.position.set(Math.sin(a) * r, .55 + (i % 2) * .25, Math.cos(a) * r);
    tongues.push({ o, at: i / (n - 1) * .16, h: .9 + Math.random() * .7 });
  }
  for (let i = 0; i < 22; i++) { const a = facing + arc / 2 - arc * Math.random(), r = R * (.5 + Math.random() * .55); fx.after(Math.random() * .2, () => g.fx?.spawn(V3(p.pos.x + Math.sin(a) * r, p.pos.y + .6 + Math.random() * .9, p.pos.z + Math.cos(a) * r), 2, { colors: ['#ffffff', '#8ad8ff', '#3a7aff', '#1a3aaa'], speed: 2.6, gravity: -2.2, life: .55, size: .11 })); }
  return fx.add(grp, .62, (e) => {
    for (const T of tongues) { const u = Math.max(0, e.t - T.at), up = Math.min(1, u * 9), fade = Math.max(0, 1 - u / .4), fl = .7 + Math.sin(e.t * 30 + T.h * 9) * .3; T.o.scale.set(.42 * fl, T.h * up * fl, .42 * fl); T.o.material.opacity = .85 * fade; }
  });
}
// Arachne's Shuttle: the golden cut she leaves along her line, a thin upright blade of light from where she set out to as far as
// she got (it grows with her), and a glow on the ground under it; it fades after she is back
function slashTrail(fx, o, dx, dz, life) {
  const grp = new THREE.Group(), blade = mesh(boxG(), glow('#ffd86a', .7), grp), core = mesh(boxG(), glow('#fffbe0', .95), grp), floor = mesh(boxG(), glow('#ffb43a', .3), grp);
  grp.position.copy(o); grp.rotation.y = Math.atan2(dx, dz);
  const S = { len: .1, flash: 0 };
  fx.add(grp, life, (e, k) => {
    const L = Math.max(.1, S.len), f = k > .7 ? (1 - k) / .3 : 1;
    blade.scale.set(.05, .55 + S.flash * .3, L); blade.position.set(0, 1.05, L / 2);
    core.scale.set(.025, .14, L); core.position.set(0, 1.05, L / 2);
    floor.scale.set(.7, .02, L); floor.position.set(0, .06, L / 2);
    blade.material.opacity = .7 * f; core.material.opacity = .95 * f; floor.material.opacity = .3 * f; S.flash *= .9;
    if (Math.random() < .6 * f) { const u = Math.random() * L; fx.g.fx?.spawn(V3(o.x + dx * u, o.y + .7 + Math.random() * .7, o.z + dz * u), 1, { colors: ['#fff2b0', '#ffd86a', '#ffffff'], speed: .5, gravity: -.6, life: .45, size: .08 }); }
  });
  return S;
}
// Achilles' Spear: the spear of light stuck slantwise in the ground, a column of light over it and a ring that shrinks as its time runs out
function stuckSpear(fx, c, dir, life) {
  const g = fx.g, grp = new THREE.Group(), sp = lightSpear('#ffe08a', 2.4, .08), tilt = new THREE.Group();
  tilt.add(sp); sp.rotation.x = PI / 2 - .35; sp.position.y = .9; grp.add(tilt); grp.position.copy(c); grp.rotation.y = Math.atan2(dir.x, dir.z) + PI;
  const col = mesh(tubeG(), glow('#ffe08a', .2), grp); col.scale.set(.5, 6, .5); col.position.y = 3;
  const ring = mesh(ringG(), glow('#fff2c0', .8), grp), base = mesh(ringG(), glow('#ffd86a', .5), grp);
  ring.rotation.x = base.rotation.x = -PI / 2; ring.position.y = .07; base.position.y = .06; base.scale.setScalar(.7);
  return fx.add(grp, life, (e, k) => {
    const pulse = .75 + Math.sin(e.t * 7) * .25, f = Math.min(1, e.t * 6);
    ring.scale.setScalar(.6 + 1.6 * (1 - k)); ring.material.opacity = .8 * f;
    col.material.opacity = .2 * pulse * f * (k > .8 ? (1 - k) * 5 : 1); base.material.opacity = .5 * pulse * f;
    sp.traverse((o) => { if (o.material) o.material.opacity = o.material.userData.base * (k > .85 && Math.floor(e.t * 10) % 2 ? .4 : 1); });
    if (Math.random() < .3) g.fx?.spawn(V3(c.x + (Math.random() - .5) * .6, c.y + .3 + Math.random() * 1.6, c.z + (Math.random() - .5) * .6), 1, { colors: ['#fff2c0', '#ffe08a'], speed: .3, gravity: -1.5, life: .6, size: .08 });
  });
}
const tubeG = () => geo('tube', () => new THREE.CylinderGeometry(1, 1, 1, 18, 1, true));
// Eye of the Storm: one tornado, a funnel of turning rings that widens upward round a pale core, dust and leaves swept round
// its foot; step(pos, dt) moves it and does its work every frame
function funnel(fx, c0, life, step) {
  const g = fx.g, grp = new THREE.Group(), rings = [], pos = V3(c0.x, c0.y, c0.z);
  const coreM = glow('#e8ffff', .16), core = mesh(geo('funnelCore', () => new THREE.CylinderGeometry(1.5, .25, 4.6, 14, 1, true).translate(0, 2.3, 0)), coreM, grp);
  for (let i = 0; i < 11; i++) { const m = mesh(ringG(), glow(i % 3 === 0 ? '#ffffff' : i % 2 ? '#c8f0f0' : '#8fc8c0', .62 - i * .03), grp); m.rotation.x = -PI / 2; rings.push({ m, y: .12 + i * .44, r: .35 + i * .19, ph: i * .8 }); }
  const dust = mesh(ringG(), glow('#c8b890', .35, false), grp); dust.rotation.x = -PI / 2; dust.position.y = .05;
  return fx.add(grp, life, (e, k, dt) => {
    step(pos, dt, e.t); pos.y = ground(g, pos.x, pos.z); grp.position.copy(pos);
    const f = fadeIO(k, .08, .14), grow = Math.min(1, e.t * 4);
    core.rotation.y += dt * 9; core.scale.set(grow, grow, grow); coreM.opacity = .16 * f;
    for (const R of rings) { const w = Math.sin(e.t * 6 + R.ph) * .14 * (R.y / 4); R.m.position.set(w, R.y * grow, Math.cos(e.t * 5 + R.ph) * .1 * (R.y / 4)); R.m.rotation.z = e.t * (9 + R.y); R.m.scale.setScalar(R.r * (1 + Math.sin(e.t * 4 + R.ph) * .06) * grow); R.m.material.opacity = R.m.material.userData.base * f; }
    dust.scale.setScalar(1.3 + Math.sin(e.t * 8) * .15); dust.material.opacity = .35 * f;
    for (let i = 0; i < 2; i++) { const a = Math.random() * PI * 2, h = Math.random() * 4, r = .4 + h * .38; const q = V3(pos.x + Math.sin(a) * r, pos.y + .1 + h, pos.z + Math.cos(a) * r), L = g.fx?.live; g.fx?.spawn(q, 1, { colors: ['#ffffff', '#c8b890', '#7a9a5a', '#d8f0f0'], speed: .2, gravity: -.5, life: .5, size: .1 }); const v = L?.[L.length - 1]?.userData?.v; if (v) v.set(Math.cos(a) * 6, 1.5, -Math.sin(a) * 6); }
  });
}
// Rise of the Phoenix, Hera's Blessing: a slow ember (or feather) glow round her while a readied or lasting blessing holds; ends when keep() says so
function motes(fx, p, colors, keep, rate = .2) {
  return fx.add(null, 1e9, () => {
    if (!keep()) return false;
    if (Math.random() < rate) fx.g.fx?.spawn(V3(p.pos.x + (Math.random() - .5) * .9, p.pos.y + .3 + Math.random() * 1.5, p.pos.z + (Math.random() - .5) * .9), 1, { colors, speed: .25, gravity: -1.6, life: .8, size: .08 });
  });
}

// ---------------------------------------------------------------------------------------------
// casts: each returns the tick (dt, t) the Player calls while the skill plays
// ---------------------------------------------------------------------------------------------
export const BOOK_CAST = {
  // Charge (round 22; round 23, Roy: "with a shield, the charge is with the shield; without one, the spear or the swords
  // or whatever weapon is in her hand leads the charge"): a 4 m rush that reads as one or the other. Behind the shield
  // it shoves and staggers what it meets (a bash); with the weapon leading, the point lands first and harder, and
  // further ahead of her (a spear's length), with less shove. The look is skills.js (SkillFx.chargeLead, chargePose).
  charge(g, p, s) {
    const lead = chargeLead(g, p), sh = lead.shield || lead.style === 'bare', reach = LEAD_REACH[lead.shield ? 'shield' : lead.style] ?? 1; // (weapons put away in a town: the old shoulder-first shove)
    const hit = new Set(); let moved = 0, stopped = false;
    p.inv = Math.max(p.inv || 0, s.dur * .5);
    g.skillFx.chargeLead?.(p, lead, s.dur + .2); // (it ends itself when the skill does)
    return (dt, t) => {
      if (t < .12 || t > .8 || stopped || moved >= s.range) return;
      const [x, z] = fwd(p), st = Math.min(s.range - moved, s.range / (s.dur * .68) * dt);
      if (!p.moveBy(x * st, z * st)) stopped = true; moved += st;
      if (Math.random() < .7) g.fx.spawn(V3(p.pos.x - x * .4, p.pos.y + .1, p.pos.z - z * .4), 2, { colors: ['#c8b090', '#a08060', '#e8d8b8'], speed: 1.8, gravity: 2, life: .45, size: .15 });
      for (const e of foes(g, p.pos.x + x * reach, p.pos.z + z * reach, s.width)) {
        if (hit.has(e)) continue; hit.add(e);
        const at = V3(e.pos.x - x * (e.radius || .5), p.pos.y + 1.05, e.pos.z - z * (e.radius || .5));
        if (sh) { // the shield meets it: a bronze clang, a ring off the shield's face, a hard shove
          g.hitEnemy(e, s.power, false, p.pos, { knock: s.knock, stagger: s.stagger, snd: 'bash' });
          g.skillFx.ring(at, { r0: .2, r1: 1.3, color: '#ffe2a8', life: .25, flat: false });
          g.fx.spawn(at, 8, { colors: ['#ffe2a8', '#ffffff', '#c8a060'], speed: 3.2, gravity: 4, life: .3, size: .1, spread: .2 });
          g.shake(.14); g.hitstop(.05);
        } else { // the point goes in first: a white spark at the tip, a heavier blow, little shove
          g.hitEnemy(e, s.pointPower, true, p.pos, { knock: s.pointKnock, stagger: s.pointStagger, snd: LEAD_SND[lead.style] });
          streak(g.skillFx, at.clone().addScaledVector(V3(x, 0, z), -.9), at.clone().addScaledVector(V3(x, 0, z), .5), '#e8f4ff', .07, .18);
          g.fx.spawn(at, 10, { colors: ['#ffffff', '#e8f4ff', '#ffd8a0'], speed: 4, gravity: 6, life: .3, size: .09, spread: .15 });
          g.shake(.12); g.hitstop(.06);
        }
      }
    };
  },
  // Pegasus' Bound (round 22): a ring of wind opens ahead, she leaps 8 m through it and lands light (walls still stop her)
  bound(g, p, s) {
    const fx = g.skillFx, [x, z] = fwd(p), far = s.range, c0 = p.pos.clone(); let moved = 0, landed = false;
    p.inv = Math.max(p.inv || 0, s.dur * .6);
    fx.windTrail(p, s.dur * .76, { color: '#bfe8ff', deep: '#9a8cff' });
    hoop(fx, V3(c0.x + x * 2.6, ground(g, c0.x + x * 2.6, c0.z + z * 2.6) + 1.3, c0.z + z * 2.6), p.facing, .7);
    fx.ring(c0, { r0: .3, r1: 1.8, color: '#bfe8ff', life: .35 });
    return (dt, t) => {
      if (t > .08 && t < .72 && moved < far) {
        const u0 = (t - .08) / .64, st = Math.min(far - moved, far / (s.dur * .64) * dt * (1.25 - .5 * u0)); // fast off the ground, easing in to land
        if (!p.moveBy(x * st, z * st)) moved = far; else moved += st;
        p.lift = Math.sin(Math.min(1, u0) * PI) * 1.3;
      }
      if (!landed && t >= .74) {
        landed = true; p.lift = 0;
        fx.ring(p.pos, { r0: .3, r1: 2.2, color: '#e8f8ff', life: .4 }); fx.ring(p.pos, { r0: .2, r1: 1.4, color: '#bfe8ff', life: .3 });
        g.fx.spawn(V3(p.pos.x, p.pos.y + .1, p.pos.z), 8, { colors: ['#e8dcc8', '#c8b8a0'], speed: 2.4, gravity: 3, life: .4, size: .13, spread: .4 });
      }
      if (t >= .99) p.lift = 0;
    };
  },
  // Hades' Veil (round 22): she fades to a see-through shade and walls stop holding her, for s.time seconds (veilOn)
  veil(g, p, s) {
    return once(.3, () => {
      veilOn(g, p, s.time);
      g.skillFx.ring(p.pos, { r0: 2.2, r1: .3, color: '#a8b8f0', life: .45 });
      g.fx.spawn(V3(p.pos.x, p.pos.y + 1, p.pos.z), 22, { colors: ['#2a2c40', '#4a4f78', '#a8b8f0', '#e8ecff'], speed: 2.4, gravity: -1, life: .7, size: .14, spread: .6 });
      g.flash?.(.06, '#a8b8f0');
    });
  },
  // Prometheus' Arc (round 31, Roy; it replaced Ember Burst): one sweep nearly half round her, wreathed in blue fire and half
  // again as long as her weapon reaches; everything in it is struck at once
  bluearc(g, p, s) {
    return once(.42, () => {
      const fx = g.skillFx, f0 = p.facing, R = Math.max(2.6, (g.hero?.W?.reach || 2.3) * s.reachMul);
      sweepArc(fx, p, { r: R, arc: s.arc, color: '#2a6aff', edge: '#d8f4ff', life: .45, y: .95, inner: .3, flip: true });
      sweepArc(fx, p, { r: R * .96, arc: s.arc, color: '#7ad8ff', edge: '#ffffff', life: .32, y: 1.2, inner: .72, tilt: .1, flip: true });
      blueFlames(fx, p, R, s.arc, f0);
      let any = false;
      for (const e of foes(g, p.pos.x, p.pos.z, R)) if (inCone(p, e, R, s.arc / 2 + .12, f0)) {
        any = true; g.hitEnemy(e, s.power, true, p.pos, { knock: .9, magic: true, el: 'fire', snd: 'magic' });
        g.fx.spawn(topOf(e), 8, { colors: ['#ffffff', '#8ad8ff', '#2a6aff'], speed: 3.5, life: .4, gravity: -1, size: .1 });
      }
      if (any) { g.shake(.2); g.hitstop(.05); }
      g.flash?.(.06, '#8ad0ff');
    });
  },
  // Hoplite Thrust: a step in and one long thrust through a line of foes
  pierce(g, p, s) {
    let moved = 0, done = false;
    return (dt, t) => {
      const [x, z] = fwd(p);
      if (t > .1 && t < .4 && moved < s.lunge) { const st = Math.min(s.lunge - moved, s.lunge / (s.dur * .3) * dt); p.moveBy(x * st, z * st); moved += st; }
      if (!done && t >= .36) {
        done = true;
        const a = V3(p.pos.x + x * .6, p.pos.y + 1.05, p.pos.z + z * .6), b = V3(p.pos.x + x * s.range, p.pos.y + 1.05, p.pos.z + z * s.range);
        streak(g.skillFx, a, b, '#e8d8a8', .09, .25); g.skillFx.ring(b, { r0: .2, r1: 1.2, color: '#fff2c0', life: .3, flat: false });
        let any = false;
        for (const e of foes(g, p.pos.x, p.pos.z, s.range + 1)) { const [u, w] = along(e, p.pos.x, p.pos.z, x, z); if (u > -.3 && u < s.range + .4 && w < s.width + (e.radius || .5) * .5) { any = true; g.hitEnemy(e, s.power, true, p.pos, { knock: s.knock, snd: 'spear', ticks: 2 }); } }
        if (any) { g.shake(.15); g.hitstop(.04); }
      }
    };
  },
  // Viper's Bite: two crossing cuts, then the venom. Round 31 (Roy: "the animation must have reach, not hug her"): the cuts sweep
  // out to 3.4 m, a wide band well clear of her body, with a green slash of venom across the far end of each
  fangs(g, p, s) {
    let n = 0;
    return (dt, t) => {
      while (n < 2 && t >= [.25, .55][n]) {
        const last = n === 1, fx = g.skillFx, [x, z] = fwd(p); n++;
        sweepArc(fx, p, { r: s.reach + .3, arc: 2.2, color: '#5ac83a', edge: '#e8ffd0', tilt: last ? -.55 : .55, flip: last, life: .3, y: 1, inner: .5 });
        sweepArc(fx, p, { r: s.reach * .8, arc: 1.9, color: '#b8ff8a', edge: '#ffffff', tilt: last ? -.55 : .55, flip: last, life: .22, y: 1.05, inner: .82 });
        const m = s.reach * .72, cx = p.pos.x + x * m, cz = p.pos.z + z * m, sd = last ? -1 : 1;
        streak(fx, V3(cx - z * 1.5 * sd - x * .5, p.pos.y + 1.6, cz + x * 1.5 * sd - z * .5), V3(cx + z * 1.5 * sd + x * .5, p.pos.y + .45, cz - x * 1.5 * sd + z * .5), '#8fe05a', .07, .26);
        for (let i = 0; i < 10; i++) { const a = p.facing + (Math.random() - .5) * 2, r = s.reach * (.55 + Math.random() * .45); g.fx.spawn(V3(p.pos.x + Math.sin(a) * r, p.pos.y + .7 + Math.random() * .7, p.pos.z + Math.cos(a) * r), 1, { colors: ['#8fe05a', '#d8ffb0', '#2a5a1a'], speed: 1.4, gravity: 3, life: .45, size: .1 }); }
        for (const e of foes(g, p.pos.x, p.pos.z, s.reach)) if (inCone(p, e, s.reach, 1.1)) {
          g.hitEnemy(e, s.power, last, p.pos, { knock: last ? .8 : .3, snd: 'dual', ticks: 2 });
          if (last && alive(e)) { e.addDot('poison', s.poison * lvlMul(g), s.time, 2); g.fx.spawn(topOf(e), 6, { colors: ['#8fe05a', '#3f7a3a'], speed: 2, life: .5 }); }
        }
      }
    };
  },
  // Wide Cleave: one huge flat sweep in front
  cleave(g, p, s) {
    return once(.46, () => {
      furrow(g, p, s.radius, s.arc); // Roy 30.10 ("no attack should look like another"): it was Prometheus' Arc's light crescent in orange; now the axe reaps the ground itself
      let any = false;
      for (const e of foes(g, p.pos.x, p.pos.z, s.radius)) if (inCone(p, e, s.radius, s.arc / 2)) { any = true; g.hitEnemy(e, s.power, true, p.pos, { knock: s.knock, stagger: s.stagger, snd: 'twohand', ticks: 2 }); }
      if (any) { g.shake(.25); g.hitstop(.06); }
    });
  },
  // Skin of Stone: her skin turns to marble for a while (less damage taken)
  stoneskin(g, p, s) {
    return once(.4, () => {
      bless(g, 'stoneskin', { guard: s.guard }, s.time, '#c8b898', '+' + Math.round(s.guard * 100) + '%');
      g.skillFx.ghost(p.rig, '#c8c0b0', .5); g.skillFx.ring(p.pos, { r0: 2.2, r1: .4, color: '#c8b898', life: .4 });
      g.fx.spawn(V3(p.pos.x, p.pos.y + 1, p.pos.z), 22, { colors: ['#c8c4b8', '#8a867c', '#a89880'], speed: 3, gravity: 5, life: .6, size: .14, spread: .8 });
      g.flash?.(.06, '#d8d0c0');
    });
  },
  // Zephyr's Gust: a burst of wind blows foes back, then the wind carries her (speed)
  zephyr(g, p, s) {
    return once(.45, () => {
      const fx = g.skillFx;
      fx.ring(p.pos, { r0: .5, r1: s.radius, color: '#bff0d8', life: .45 }); fx.ring(p.pos, { r0: .3, r1: s.radius * .7, color: '#ffffff', life: .35, y: .5 });
      for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; streak(fx, V3(p.pos.x + Math.sin(a) * .8, p.pos.y + .6 + (i % 3) * .3, p.pos.z + Math.cos(a) * .8), V3(p.pos.x + Math.sin(a) * s.radius, p.pos.y + .6 + (i % 3) * .3, p.pos.z + Math.cos(a) * s.radius), '#bff0d8', .04, .3); }
      g.fx.spawn(V3(p.pos.x, p.pos.y + .6, p.pos.z), 14, { colors: ['#6ab04a', '#a8d060', '#ffffff'], speed: 7, gravity: 1, life: .7, size: .12, spread: 1 });
      for (const e of foes(g, p.pos.x, p.pos.z, s.radius)) g.hitEnemy(e, s.power, false, p.pos, { knock: s.knock, snd: 'magic', magic: true });
      bless(g, 'zephyr', { speed: s.speed }, s.time, '#bff0d8');
    });
  },
  // Arachne's Shuttle (round 31, Roy; it replaced Winter Breath): she flashes out along her strike and straight back down the same
  // line, like a shuttle through the loom; each foe in the way is cut going out and again coming back, and a golden trail of the
  // cut stays along the line a moment
  shuttle(g, p, s) {
    const fx = g.skillFx, f0 = p.facing, [x, z] = fwd(p), o = p.pos.clone(), out = new Set(), back = new Set();
    const T0 = .1, Tm = .48, T1 = .9, ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
    let far = 0, gh = 0, turned = false, home = false;
    p.inv = Math.max(p.inv || 0, s.dur + .15);
    const trail = slashTrail(fx, V3(o.x, o.y, o.z), x, z, s.dur + .7);
    const cut = (set, last) => {
      for (const e of foes(g, p.pos.x, p.pos.z, s.width)) {
        if (set.has(e)) continue; set.add(e);
        g.hitEnemy(e, s.power, last, p.pos, { knock: last ? .9 : .3, snd: 'dual' }); trail.flash = 1;
        const c = topOf(e); streak(fx, V3(c.x - z * .9 - x * .4, c.y + .5, c.z + x * .9 - z * .4), V3(c.x + z * .9 + x * .4, c.y - .4, c.z - x * .9 + z * .4), '#ffd86a', .05, .2);
        g.fx.spawn(c, 6, { colors: ['#fff2b0', '#ffd86a', '#ffffff'], speed: 3.5, life: .3, gravity: 3, size: .09 });
        if (last) g.hitstop(.03);
      }
    };
    return (dt, t) => {
      if (t < T0) return;
      const d = (p.pos.x - o.x) * x + (p.pos.z - o.z) * z;
      if (t < Tm) { // out
        const want = s.range * ease((t - T0) / (Tm - T0)), st = want - d;
        if (st > 1e-3) p.moveBy(x * st, z * st);
        far = Math.max(far, (p.pos.x - o.x) * x + (p.pos.z - o.z) * z); trail.len = far;
        cut(out, false);
      } else if (t < T1) { // and back
        if (!turned) { turned = true; p.facing = f0 + PI; sfxo('shuttle_turn'); }
        const want = far * (1 - ease((t - Tm) / (T1 - Tm))), st = want - d;
        if (st < -1e-3) p.moveBy(x * st, z * st);
        cut(back, true);
      } else if (!home) { home = true; p.facing = f0; if (d > .02) p.moveBy(-x * d, -z * d); }
      if (t < T1 && t > T0 + gh * .09 && gh < 8) { gh++; fx.ghost(p.rig, gh % 2 ? '#ffd86a' : '#fff2c0', .3, .35); }
      if (Math.random() < .8) g.fx.spawn(V3(p.pos.x, p.pos.y + .9, p.pos.z), 1, { colors: ['#ffd86a', '#ffffff'], speed: .6, gravity: 0, life: .3, size: .1 });
    };
  },
  // Riposte (round 31, Roy: "instead of blocking, it takes the enemy's blow and sends it back stronger"): she locks her shield and
  // waits; the first blow that reaches her in that guard is swallowed whole (Player.damage asks p.riposte first) and sent back to
  // whoever struck it, twice as hard, with a stun. Nobody strikes: at the end she answers with the old counter-cut ahead
  riposte(g, p, s) {
    const fx = g.skillFx; let answered = false, cut = false;
    fx.chargeAura?.(p, s.dur * .8);
    const glint = fx.add(null, s.dur, () => { if (answered || p.skillId !== 'riposte') return false; if (Math.random() < .5) g.fx.spawn(V3(p.pos.x + Math.sin(p.facing) * .7, p.pos.y + 1.1 + (Math.random() - .5) * .5, p.pos.z + Math.cos(p.facing) * .7), 1, { colors: ['#fff2c0', '#ffe6a0'], speed: .4, gravity: 0, life: .25, size: .08 }); });
    void glint;
    p.riposte = (amount, from) => {
      if (answered || p.dead || p.skillId !== 'riposte' || p.skillT < 0 || p.skillT > .82) return false;
      let e = null, bd = 4; for (const f of g.enemies || []) { if (!alive(f)) continue; const d = flatDist(f.pos, from) - (f.radius || .5); if (d < bd) { bd = d; e = f; } }
      answered = true; p.inv = Math.max(p.inv || 0, .3);
      const back = Math.max(1, amount * s.ret), at = V3(p.pos.x + Math.sin(p.facing) * .7, p.pos.y + 1.1, p.pos.z + Math.cos(p.facing) * .7);
      fx.ring(at, { r0: .2, r1: 1.6, color: '#fff2c0', life: .3, flat: false }); g.fx.spawn(at, 16, { colors: ['#ffffff', '#ffe6a0', '#ffd04a'], speed: 5, gravity: 6, life: .35, size: .11 });
      sfxo('block_shield', { vol: 1 }); sfxo('parry'); g.flash?.(.1, '#fff2c0'); g.hitstop(.08); g.shake(.2);
      g.floatAt?.(p.pos, { he: 'נבלע!', en: 'Absorbed!' }, 'exp', 2.6);
      if (e) {
        p.facing = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
        fx.after(.1, () => {
          if (!alive(e)) return;
          sweepArc(fx, p, { r: Math.max(2.4, flatDist(e.pos, p.pos) + .8), arc: 1.6, color: '#ffe6a0', edge: '#ffffff', tilt: .25, life: .3, y: 1 });
          streak(fx, at, topOf(e), '#fff2c0', .1, .25);
          g.hitRaw(e, back, p.pos, { stun: s.stunRet, knock: 1.6, snd: 'bash', heavy: true });
          sfxo('swing3'); g.shake(.3); g.flash?.(.08, '#ffffff');
        });
      }
      return true;
    };
    return (dt, t) => {
      if (!cut && t >= .82) {
        cut = true; if (answered) return;
        sfxo('parry', { vol: .7 }); sfxo('swing3');
        sweepArc(fx, p, { r: s.reach, arc: s.cone, color: '#ffe6a0', edge: '#ffffff', tilt: .25, life: .3, y: 1 });
        let any = false;
        for (const e of foes(g, p.pos.x, p.pos.z, s.reach)) if (inCone(p, e, s.reach, s.cone / 2)) { any = true; g.hitEnemy(e, s.power, true, p.pos, { stun: s.stun, knock: 1.2, ticks: 2 }); }
        if (any) { g.shake(.22); g.hitstop(.07); g.flash?.(.06, '#fff2c0'); }
      }
    };
  },
  // Perseus' Leap: up and over to the foe, landing with a shockwave
  leap(g, p, s, tgt) {
    const P = aimAt(g, p, tgt, s.aim, s.range), d = Math.hypot(P.x - p.pos.x, P.z - p.pos.z), far = Math.min(s.range, Math.max(0, d - (P.e ? 1.3 : 0)));
    const dx = d > .01 ? (P.x - p.pos.x) / d : Math.sin(p.facing), dz = d > .01 ? (P.z - p.pos.z) / d : Math.cos(p.facing);
    let moved = 0, landed = false, gh = 0; p.inv = Math.max(p.inv || 0, s.dur * .6); p.facing = Math.atan2(dx, dz);
    return (dt, t) => {
      if (t > .06 && t < .44) {
        const st = Math.min(far - moved, far / (s.dur * .38) * dt); if (st > 0) { p.moveBy(dx * st, dz * st); moved += st; }
        p.lift = Math.sin((t - .06) / .38 * PI) * 1.6;
        if (t > .1 + gh * .1 && gh < 3) { gh++; g.skillFx.ghost(p.rig, '#ffd8a0', .3); }
      }
      if (!landed && t >= .46) {
        landed = true; p.lift = 0;
        const c = V3(p.pos.x, p.pos.y, p.pos.z);
        if (!p.rig?.hovering) g.skillFx.smash(c, s.radius * 1.6); // on the dragon wings (round 26) she comes down to a hover, not onto the ground: no cracks
        g.skillFx.ring(c, { r0: .4, r1: s.radius * 1.3, color: '#ffd8a0', life: .45 });
        for (const e of foes(g, c.x, c.z, s.radius)) g.hitEnemy(e, s.power, true, c, { stun: s.stun, knock: 1.4, snd: 'crush', ticks: 2 });
        g.shake(.35); g.hitstop(.06);
      }
    };
  },
  // Hydra's Venom: a lobbed vial that bursts into a poison pool
  venom(g, p, s, tgt) {
    return once(.45, () => {
      const P = aimAt(g, p, tgt, s.aim, s.range * .85), d = Math.hypot(P.x - p.pos.x, P.z - p.pos.z) || 1, dir = V3((P.x - p.pos.x) / d, 0, (P.z - p.pos.z) / d);
      const vial = new THREE.Group(), b = mesh(ballG(), glow('#5ad84a', .95, false), vial), n = mesh(boxG(), glow('#d8f0c0', .9, false), vial);
      b.scale.setScalar(.2); n.scale.set(.08, .14, .08); n.position.y = .2;
      missile(g.skillFx, V3(p.pos.x + dir.x * .5, p.pos.y + 1.3, p.pos.z + dir.z * .5), dir, { speed: 15, range: Math.min(s.range, Math.max(2, d)), obj: vial, lob: 2.2, endY: ground(g, P.x, P.z) + .2, trail: (q) => g.fx.spawn(q, 1, { colors: ['#8fe05a', '#d8ffb0'], speed: .4, gravity: 1, life: .3, size: .08 }) }, null, (pos) => {
        const c = V3(pos.x, ground(g, pos.x, pos.z), pos.z);
        sfxo('venom_splash'); g.fx.spawn(V3(c.x, c.y + .3, c.z), 22, { colors: ['#8fe05a', '#d8ffb0', '#2a5a1a'], speed: 5, gravity: 8, life: .6, size: .14 });
        for (const e of foes(g, c.x, c.z, s.radius)) g.hitEnemy(e, s.power, false, c, { magic: true, snd: 'water' });
        pool(g.skillFx, c, s.radius, s.time, '#4ab83a', .5, () => {
          for (const e of foes(g, c.x, c.z, s.radius)) { e.addDot('poison', s.poison * lvlMul(g), 1.5, 1); e.slowBy(s.slow, .6); }
        });
      });
    });
  },
  // Kampe's Venom Trail (round 19, Roy: the gift of the Tartarus fight): for 5 s every step she takes leaves venom on the
  // ground, and whatever crosses it is poisoned, ticking for 3 s (crossing again starts the 3 s over). Round 31 (Roy): one
  // continuous band of venom along her path (venomStrip), no more circles; underneath, each point of it still poisons a circle
  venomtrail(g, p, s) {
    return once(.3, () => {
      const fx = g.skillFx, dps = s.poison * lvlMul(g), strip = venomStrip(fx, s.radius * .85), step = .3;
      let lx = p.pos.x, lz = p.pos.z, acc = 0, gap = false;
      fx.ring(p.pos, { r0: .3, r1: 1.7, color: '#8fe05a', life: .4, opacity: .5 });
      g.fx.spawn(V3(p.pos.x, p.pos.y + 1.1, p.pos.z), 10, { colors: ['#8fe05a', '#b8d8a0', '#2a5a1a'], speed: 2.4, gravity: 3, life: .5, size: .1 });
      g.floatAt?.(p.pos, { he: 'שובל ארס', en: 'Venom trail' }, 'exp', 2.9);
      strip.add(lx, lz, fx.now() + s.linger, true);
      fx.add(null, s.time + s.linger, (e, k, dt) => {
        const now = fx.now();
        if (e.t < s.time && !p.dead) {
          const d = Math.hypot(p.pos.x - lx, p.pos.z - lz);
          if (p.swimming || p.mounted || p.boat) gap = true; // (the water washes it off: the band breaks there)
          else if (d > 2.6) { lx = p.pos.x; lz = p.pos.z; strip.add(lx, lz, now + s.linger, true); gap = false; } // a roll, a leap, a flash elsewhere: a new band begins where she lands
          else if (d > step) { lx = p.pos.x; lz = p.pos.z; strip.add(lx, lz, now + s.linger, gap); gap = false; }
        } else strip.done = true;
        acc += dt; if (acc < .2) return; acc = 0;
        const P = strip.pts; if (!P.length) return e.t < s.time ? undefined : false;
        for (const f of g.enemies || []) {
          if (!alive(f)) continue; const r = s.radius + (f.radius || .5) * .5;
          if (!P.some((q) => Math.abs(q.x - f.pos.x) < r && Math.abs(q.z - f.pos.z) < r && Math.hypot(q.x - f.pos.x, q.z - f.pos.z) < r)) continue;
          if (!f.dots?.some((d) => d.kind === 'poison')) g.fx.spawn(topOf(f), 5, { colors: ['#8fe05a', '#3f7a3a'], speed: 1.5, life: .45 });
          f.addDot('poison', dps, s.tick, 1);
        }
      });
    });
  },
  // War Cry of Ares: her blows grow stronger, the foes around flinch
  warcry(g, p, s) {
    return once(.32, () => {
      const fx = g.skillFx;
      fx.ring(p.pos, { r0: .5, r1: s.radius, color: '#ff5a4a', life: .5 }); fx.ring(p.pos, { r0: .3, r1: s.radius * .6, color: '#ffd0a0', life: .4, flat: false });
      fx.after(.12, () => fx.ring(p.pos, { r0: .5, r1: s.radius * 1.1, color: '#ff8a5a', life: .5, opacity: .6 }));
      for (const e of foes(g, p.pos.x, p.pos.z, s.radius)) { if (!e.T?.noStagger && e.state !== 'exposed') { e.state = 'stagger'; e.t = s.stagger; } e.slowBy(s.slow, 3); }
      bless(g, 'warcry', { power: powerOf(g, s.boost) }, s.time, '#ff5a4a', '+25%');
      g.shake(.3); g.flash?.(.1, '#ff6a4a');
    });
  },
  // Chain Lightning (round 31, Roy: "a trigger"): lightning gathers in her weapon. Its first blow that lands opens a 5 s window, and
  // that blow and every one after it inside the window sends lightning on from the struck foe to up to five more (chainProc,
  // called by main.js hitEnemy for her weapon's own blows). Unused, the charge leaves the weapon after s.wait s
  chain(g, p, s) {
    return once(.42, () => {
      const fx = g.skillFx, [x, z] = fwd(p);
      fx.chainArm = { s, until: fx.now() + s.wait, live: 0 };
      fx.bolt(V3(p.pos.x + x * .3 + (Math.random() - .5), p.pos.y + 9, p.pos.z + z * .3), V3(p.pos.x + x * .3, p.pos.y + 1.9, p.pos.z + z * .3), { color: '#a8d8ff', width: .09, jag: .5, segs: 9, life: .3 });
      fx.ring(p.pos, { r0: .3, r1: 2.2, color: '#a8d8ff', life: .35 });
      g.flash?.(.08, '#d8ecff'); g.floatAt?.(p.pos, { he: 'הנשק טעון בברק', en: 'Weapon charged' }, 'exp', 2.9);
      const r = p.rig, tip = V3();
      fx.add(null, 1e9, () => {
        const A = fx.chainArm; if (!A || A.s !== s) return false;
        if (fx.now() > A.until) { fx.chainArm = null; if (A.live) g.floatAt?.(p.pos, { he: 'הברק כבה', en: 'Lightning spent' }, 'miss', 2.6); return false; }
        const W = r?.weaponR || r?.weaponL; if (!W || p.dead) return;
        if (Math.random() < (A.live ? .9 : .45)) { W.localToWorld(tip.set(0, 0, (W.userData?.tip ?? .85) * Math.random())); g.fx.spawn(tip.clone(), 1, { colors: ['#ffffff', '#a8d8ff', '#6aa8ff'], speed: A.live ? 2.2 : 1.2, gravity: 0, life: .18, size: .07 }); }
      });
    });
  },
  // Achilles' Spear (round 31, Roy: a double cast): the spear of light flies its 18 m through everything in its way and sticks in
  // the ground where it ends. While it stands there (s.window s) the skill is ready again, mana-free: the second cast takes her to
  // it in a flash (fx.recasts.impale, castSkill). The cooldown starts after the second cast, or when the window runs out
  impale(g, p, s, tgt) {
    const fx = g.skillFx, H = g.hero;
    return once(.44, () => {
      const P = aimAt(g, p, tgt, s.aim, s.range), d = Math.hypot(P.x - p.pos.x, P.z - p.pos.z) || 1, dir = V3((P.x - p.pos.x) / d, 0, (P.z - p.pos.z) / d);
      const sp = lightSpear('#ffe08a', 2.4, .08), start = V3(p.pos.x + dir.x * .6, p.pos.y + 1.5, p.pos.z + dir.z * .6);
      missile(fx, start, dir, { speed: s.speed, range: s.range, obj: sp, pierce: true, width: s.width, trail: (q) => g.fx.spawn(q, 1, { colors: ['#ffe08a', '#ffffff'], speed: .3, gravity: 0, life: .3, size: .1 }) },
        (e, pos) => { g.hitEnemy(e, s.power, true, start, { knock: s.knock, snd: 'spear', ticks: 2 }); fx.ring(pos, { r0: .2, r1: 1.4, color: '#fff2c0', life: .25, flat: false }); g.shake(.12); },
        (pos) => {
          const c = V3(pos.x, ground(g, pos.x, pos.z), pos.z), until = fx.now() + s.window;
          g.fx.spawn(V3(c.x, c.y + .3, c.z), 12, { colors: ['#ffe08a', '#ffffff', '#c8a878'], speed: 3, gravity: 6, life: .45 }); fx.ring(c, { r0: .2, r1: 1.6, color: '#fff2c0', life: .35 });
          sfxo('hit_spear', { vol: .6 });
          const mark = stuckSpear(fx, c, dir, s.window);
          const R = fx.recasts.impale = { ready: true, until, x: c.x, z: c.z, mark };
          H.cds.impale = 0; g.syncHud?.(true);
          R.fire = () => {
            if (p.dead || p.mounted || p.boat) return false;
            delete fx.recasts.impale; mark.life = 0; H.cds.impale = s.cd;
            const from = p.pos.clone();
            fx.ring(from, { r0: 1.6, r1: .2, color: '#ffe08a', life: .3 }); fx.ghost(p.rig, '#ffe08a', .35, .5);
            g.fx.spawn(V3(from.x, from.y + 1, from.z), 16, { colors: ['#fff2c0', '#ffe08a', '#ffffff'], speed: 3, gravity: -1, life: .5, size: .12, spread: .5 });
            streak(fx, V3(from.x, from.y + 1, from.z), V3(R.x, ground(g, R.x, R.z) + 1, R.z), '#ffe08a', .12, .3);
            if (p.skillT >= 0) { p.skillT = -1; p.anim.skill = null; p.skillTick = null; p.skillId = null; }
            p.pos.set(R.x, ground(g, R.x, R.z), R.z); unstick(g, p);
            p.facing = Math.atan2(dir.x, dir.z); p.inv = Math.max(p.inv || 0, .4);
            const q = p.pos.clone();
            fx.beam(q, .5, '#ffe08a'); fx.ring(q, { r0: .3, r1: 3, color: '#fff2c0', life: .4 }); fx.ring(q, { r0: .2, r1: 1.8, color: '#ffe08a', life: .3 });
            g.fx.spawn(V3(q.x, q.y + .2, q.z), 18, { colors: ['#e8dcc8', '#ffe08a', '#ffffff'], speed: 3.5, gravity: 4, life: .5, size: .13, spread: .5 });
            sfxo('spear_recall'); g.shake(.15); g.flash?.(.06, '#fff2c0'); g.syncHud?.(true);
            return true;
          };
          fx.add(null, s.window + 5, (e) => { if (fx.recasts.impale !== R) return false; if (e.t >= s.window) { delete fx.recasts.impale; H.cds.impale = Math.max(H.cds.impale || 0, s.cd); g.syncHud?.(true); return false; } });
        });
    });
  },
  // Shadow Step: gone in smoke, back behind the foe with a sure critical stab
  blink(g, p, s, tgt) {
    const fx = g.skillFx; let gone = false, struck = false, e = null;
    const puff = (q) => { fx.ring(q, { r0: .3, r1: 1.8, color: '#6a4a9a', life: .35 }); g.fx.spawn(V3(q.x, q.y + .8, q.z), 18, { colors: ['#2e2a3a', '#4a4458', '#b48cff'], speed: 2.5, gravity: -1, life: .6, size: .2, spread: .8 }); };
    return (dt, t) => {
      if (!gone && t >= .3) {
        gone = true; puff(p.pos.clone()); fx.ghost(p.rig, '#b48cff', .4);
        e = alive(tgt) && flatDist(tgt.pos, p.pos) < s.range ? tgt : g.nearestEnemy?.(p.pos, s.range);
        if (e) { const d = flatDist(e.pos, p.pos) || 1, ux = (e.pos.x - p.pos.x) / d, uz = (e.pos.z - p.pos.z) / d, back = (e.radius || .5) + .9; slideTo(p, e.pos.x + ux * back, e.pos.z + uz * back); p.facing = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z); }
        else { const [x, z] = fwd(p); p.moveBy(x * s.range * .6, z * s.range * .6); }
        p.inv = Math.max(p.inv || 0, .5); puff(p.pos.clone());
      }
      if (gone && !struck && t >= .55) {
        struck = true;
        sweepArc(fx, p, { r: 2.4, arc: 2, color: '#b48cff', edge: '#ffffff', tilt: .5, life: .25, y: 1 });
        if (alive(e)) sureCrit(g, () => g.hitEnemy(e, s.power, true, p.pos, { stagger: .5, snd: 'dual', critAdd: 1, ticks: 2 }));
        for (const f of foes(g, p.pos.x, p.pos.z, 2.2)) if (f !== e && inCone(p, f, 2.2, 1)) g.hitEnemy(f, s.power * .5, false, p.pos, { snd: 'dual' });
        g.hitstop(.06);
      }
    };
  },
  // Earth Splitter: a row of stone spikes bursts out along the ground ahead
  earthsplit(g, p, s) {
    return once(.55, () => {
      const [x, z] = fwd(p), o = p.pos.clone(), hit = new Set(), step = 1.1, n = Math.ceil(s.range / step);
      g.skillFx.smash(V3(o.x + x * 1.4, ground(g, o.x + x * 1.4, o.z + z * 1.4), o.z + z * 1.4), 3);
      g.shake(.35); g.hitstop(.06);
      for (let i = 1; i <= n; i++) g.skillFx.after(i * .035, () => {
        const cx = o.x + x * (i * step + .6), cz = o.z + z * (i * step + .6), c = V3(cx, ground(g, cx, cz), cz);
        spike(g.skillFx, c, .9 + Math.random() * .6);
        g.fx.spawn(V3(cx, c.y + .2, cz), 4, { colors: ['#8a7058', '#c8a878'], speed: 3, gravity: 9, life: .5, size: .16 });
        for (const e of foes(g, cx, cz, s.width)) if (!hit.has(e)) { hit.add(e); g.hitEnemy(e, s.power, true, c, { stun: s.stun, knock: .6, snd: 'crush' }); if (alive(e) && !e.T?.heavy) e.vy = 6.5; }
      });
    });
  },
  // Dome of Helios: a dome of sunlight, nothing gets in; whoever stood too close is thrown out
  sunshield(g, p, s) {
    return once(.3, () => {
      p.inv = Math.max(p.inv || 0, s.time);
      dome(g.skillFx, p, 2.6, s.time, '#ffd24a');
      g.skillFx.ring(p.pos, { r0: .5, r1: s.radius, color: '#ffd24a', life: .45 });
      for (const e of foes(g, p.pos.x, p.pos.z, s.radius)) g.hitEnemy(e, s.power, false, p.pos, { knock: s.knock, magic: true, snd: 'magic' });
      g.flash?.(.1, '#fff2b0');
    });
  },
  // Selene's Crescent: a crescent of moonlight flies from the sword
  crescent(g, p, s, tgt) {
    return once(.46, () => {
      const P = aimAt(g, p, tgt, s.aim, s.range), d = Math.hypot(P.x - p.pos.x, P.z - p.pos.z) || 1, dir = V3((P.x - p.pos.x) / d, 0, (P.z - p.pos.z) / d);
      const grp = new THREE.Group(), arcG = geo('cres', () => new THREE.RingGeometry(1.2, 1.9, 20, 1, -PI / 2 - 1.1, 2.2).rotateX(-PI / 2).translate(0, 0, -1.3));
      mesh(arcG, glow('#d8e8ff', .7), grp); const edge = mesh(arcG, glow('#ffffff', .9), grp); edge.scale.set(1.02, 1, .96); edge.position.y = .05;
      missile(g.skillFx, V3(p.pos.x + dir.x * .6, p.pos.y + .9, p.pos.z + dir.z * .6), dir, { speed: s.speed, range: s.range, obj: grp, pierce: true, width: s.width, trail: (q) => g.fx.spawn(q, 1, { colors: ['#d8e8ff', '#ffffff', '#9fb8ff'], speed: .5, gravity: 0, life: .35, size: .1, spread: 2 }) },
        (e, pos) => { g.hitEnemy(e, s.power, true, p.pos, { knock: s.knock, magic: true, ticks: 2 }); g.fx.spawn(topOf(e), 8, { colors: ['#ffffff', '#d8e8ff'], speed: 4, life: .35 }); });
      // Roy 30.10 ("no attack should look like another"): no swept crescent of light round her any more (Prometheus' Arc, Wide
      // Cleave and Titans' Edge all drew one): Selene's moon is the thing that flies; at her blade only a cold flash and moon motes
      g.fx.spawn(V3(p.pos.x + dir.x * .8, p.pos.y + 1, p.pos.z + dir.z * .8), 8, { colors: ['#ffffff', '#d8e8ff', '#9fb8ff'], speed: 1.2, gravity: -1.2, life: .6, size: .09, spread: .6 });
      g.skillFx.ring(V3(p.pos.x + dir.x * .6, p.pos.y + .9, p.pos.z + dir.z * .6), { r0: .2, r1: .9, color: '#d8e8ff', life: .25, flat: false });
    });
  },
  // Boreas' Blizzard (round 31, Roy: "a snowstorm circling round her at a respectable range"): a wide band of driven snow turns
  // round her, from about half the radius out to its edge: flakes streaming round on the wind, three tilted bands of gust, a
  // pale floor of frost under the band; it bites and slows everyone within the radius, then freezes them where they stand
  blizzard(g, p, s) {
    return once(.35, () => {
      const fx = g.skillFx, R = s.radius, grp = new THREE.Group(), flakes = [], gusts = [];
      const floor = mesh(geo('blizFloor', () => new THREE.RingGeometry(.45, 1, 48, 1).rotateX(-PI / 2)), glow('#d8f0ff', .16, false), grp); floor.position.y = .05;
      const fm = [glow('#ffffff', .95), glow('#e0f4ff', .8), glow('#bfe8ff', .7)];
      for (let i = 0, N = fxCount(110); i < N; i++) { const o = mesh(boxG(), fm[i % 3], grp); const sz = .05 + Math.random() * .06; o.scale.set(sz, sz, sz * (2.5 + Math.random() * 3)); flakes.push({ o, a: Math.random() * PI * 2, r: R * (.5 + Math.random() * .55), y: .2 + Math.random() * 2.8, w: 2.2 + Math.random() * 1.6, ph: Math.random() * 6 }); }
      for (let i = 0; i < 3; i++) { const m = mesh(geo('blizGust', () => new THREE.RingGeometry(.93, 1, 48, 1, 0, PI * .9)), glow(i % 2 ? '#ffffff' : '#bfe8ff', .4), grp); m.rotation.x = -PI / 2 + (i - 1) * .12; m.position.y = .5 + i * .8; gusts.push({ m, r: R * (.7 + i * .12), w: 1.8 + i * .5 }); }
      let acc = 0;
      fx.add(grp, s.time, (e, k, dt) => {
        grp.position.copy(p.pos); const f = fadeIO(k, .08, .12), grow = Math.min(1, e.t * 3);
        floor.scale.setScalar(R * grow); floor.material.opacity = .16 * f;
        for (const F of flakes) { F.a += F.w * dt * (1 + .4 * Math.sin(e.t * 3 + F.ph)); const r = F.r * (.6 + .4 * grow); F.o.position.set(Math.sin(F.a) * r, F.y + Math.sin(e.t * 2 + F.ph) * .25, Math.cos(F.a) * r); F.o.rotation.y = F.a + PI / 2; }
        for (const m of fm) m.opacity = m.userData.base * f;
        for (const G of gusts) { G.m.rotation.z = e.t * G.w; G.m.scale.setScalar(G.r * grow); G.m.material.opacity = .4 * f * (.7 + Math.sin(e.t * 4 + G.r) * .3); }
        if (Math.random() < .8) { const a = Math.random() * PI * 2, r = R * (.55 + Math.random() * .45); g.fx.spawn(V3(p.pos.x + Math.sin(a) * r, p.pos.y + .2 + Math.random() * 2.2, p.pos.z + Math.cos(a) * r), 1, { colors: ['#ffffff', '#e0f4ff'], speed: .5, gravity: .8, life: .6, size: .1 }); }
        acc += dt; if (acc >= s.tick) { acc -= s.tick; for (const en of foes(g, p.pos.x, p.pos.z, R)) { g.hitEnemy(en, s.power, false, p.pos, { magic: true, knock: .2, snd: 'magic', el: 'frost' }); if (alive(en)) en.slowBy(s.slow, s.tick + .3); } }
        if (k > .97 && !e.fin) { e.fin = true; for (const en of foes(g, p.pos.x, p.pos.z, R)) freeze(g, en, s.freeze); sfxo('frost'); }
      });
      fx.ring(p.pos, { r0: R * .4, r1: R, color: '#e0f4ff', life: .5 });
      g.flash?.(.06, '#e0f4ff');
    });
  },
  // Bloodthirst: lifesteal and harder blows for a while
  keres(g, p, s) {
    return once(.4, () => {
      bless(g, 'keres', { lifesteal: s.steal, power: powerOf(g, s.boost) }, s.time, '#e03a4a', '+15%');
      g.skillFx.ring(p.pos, { r0: 2.4, r1: .4, color: '#e03a4a', life: .45 }); g.skillFx.ghost(p.rig, '#e03a4a', .45);
      g.fx.spawn(V3(p.pos.x, p.pos.y + 1, p.pos.z), 24, { colors: ['#e03a4a', '#7a0c14', '#2a080c'], speed: 3, gravity: -1.5, life: .8, size: .14, spread: 1 });
      g.flash?.(.1, '#a01a24');
    });
  },
  // Phalanx Wall: three ghost shields stand before her; nothing gets through, they shove, then strike together
  phalanx(g, p, s) {
    const fx = g.skillFx; let pulse = 0, fin = false;
    p.inv = Math.max(p.inv || 0, s.dur + .1);
    shieldWall(fx, p, s.dur);
    return (dt, t) => {
      const [x, z] = fwd(p);
      while (pulse < 4 && t >= .12 + pulse * .17) {
        pulse++; fx.ring(V3(p.pos.x + x * 1.6, p.pos.y, p.pos.z + z * 1.6), { r0: .4, r1: 2.4, color: '#e0a858', life: .3 });
        for (const e of foes(g, p.pos.x, p.pos.z, s.range)) if (inCone(p, e, s.range, s.cone / 2)) g.hitEnemy(e, s.power, false, p.pos, { knock: s.knock, snd: 'bash' });
      }
      if (!fin && t >= .84) {
        fin = true; sweepArc(fx, p, { r: s.range, arc: s.cone, color: '#e0a858', edge: '#fff0c0', life: .3, y: 1 });
        for (const e of foes(g, p.pos.x, p.pos.z, s.range)) if (inCone(p, e, s.range, s.cone / 2)) g.hitEnemy(e, s.wavePower, true, p.pos, { stun: s.stun, knock: 2.2, snd: 'bash' });
        g.shake(.3); g.hitstop(.07);
      }
    };
  },
  // Kronos' Scythe: one reaping spin and a second that cuts down the weak
  harvest(g, p, s) {
    const fx = g.skillFx; let n = 0;
    fx.whirlRing(p, s.dur * .9, s.radius);
    return (dt, t) => {
      while (n < 2 && t >= [.42, .8][n]) {
        const last = n === 1; n++;
        const grp = new THREE.Group(), a = mesh(ringG(), glow(last ? '#ffffff' : '#b080ff', .7), grp); a.rotation.x = -PI / 2; grp.position.set(p.pos.x, p.pos.y + .9, p.pos.z);
        fx.add(grp, .35, (e, k) => { a.scale.setScalar(s.radius * (.6 + k * .5)); a.material.opacity = .7 * (1 - k); });
        let any = false;
        for (const e of foes(g, p.pos.x, p.pos.z, s.radius)) {
          any = true; const weak = last && e.hp / (e.maxHp || 1) < s.execute;
          g.hitEnemy(e, s.power * (last ? 1 : .6) * (weak ? 2 : 1), last, p.pos, { knock: last ? 1.6 : .5, snd: 'twohand', ticks: 2 });
          if (weak) g.fx.spawn(topOf(e), 10, { colors: ['#b080ff', '#ffffff', '#2a0e3a'], speed: 4, life: .5 });
        }
        if (any) { g.shake(last ? .35 : .15); if (last) g.hitstop(.07); }
      }
    };
  },
  // Rain of Spears: spears of light fall over the ground ahead
  spearrain(g, p, s, tgt) {
    return once(.4, () => {
      const P = aimAt(g, p, tgt, s.aim, 6), fx = g.skillFx;
      fx.ring(V3(P.x, ground(g, P.x, P.z), P.z), { r0: s.radius * .9, r1: s.radius, color: '#ffe8a0', life: 1.4, opacity: .5 });
      for (let i = 0; i < s.count; i++) fx.after(.05 + i * .085, () => {
        const a = Math.random() * PI * 2, r = Math.sqrt(Math.random()) * s.radius, x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r, gy = ground(g, x, z);
        const sp = lightSpear('#ffe8a0', 2, .07); sp.rotation.x = PI / 2.2; // pointing down, a little slanted
        fx.add(sp, .45, (e, k) => {
          const fall = Math.min(1, e.t / .16); sp.position.set(x - .9 * (1 - fall), gy + .8 + 9 * (1 - fall), z);
          sp.traverse((o) => { if (o.material) o.material.opacity = o.material.userData.base * (e.t < .16 ? 1 : 1 - (e.t - .16) / .29); });
          if (fall >= 1 && !e.hit) {
            e.hit = true; const c = V3(x, gy, z);
            fx.ring(c, { r0: .2, r1: s.hitR * 1.1, color: '#fff2c0', life: .3 }); g.fx.spawn(V3(x, gy + .2, z), 5, { colors: ['#c8a878', '#fff2c0'], speed: 3, gravity: 9, life: .4, size: .12 });
            for (const en of foes(g, x, z, s.hitR)) g.hitEnemy(en, s.power, false, c, { stun: s.stun, knock: .4, snd: 'spear' });
            if (i % 3 === 0) sfxo('hit_spear', { vol: .5 });
          }
        });
      });
    });
  },
  // Ring of Ice (round 22, Roy; it was the Prison of Ice): a sheet of ice spreads round her and stays; whoever stands on
  // it is hurt and frozen for a moment, then every monster on it slides (iceSheet / tickIce), while she walks as ever
  iceprison(g, p, s) {
    return once(.5, () => {
      const fx = g.skillFx, c = p.pos.clone();
      iceSheet(fx, c, s.radius, s.time);
      fx.ring(c, { r0: .5, r1: s.radius, color: '#b8ecff', life: .5 }); fx.ring(c, { r0: .4, r1: s.radius * .8, color: '#ffffff', life: .4 });
      for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2, q = V3(c.x + Math.sin(a) * s.radius * .95, 0, c.z + Math.cos(a) * s.radius * .95); q.y = ground(g, q.x, q.z); spike(fx, q, .7, i % 2 ? '#bfe8ff' : '#e8f8ff'); }
      for (const e of foes(g, c.x, c.z, s.radius)) { g.hitEnemy(e, s.power, true, c, { magic: true, knock: 0, snd: 'magic', el: 'frost' }); freeze(g, e, s.freeze); } // (no knock: they stay on the ice)
      g.flash?.(.1, '#e0f4ff'); g.shake(.2);
    });
  },
  // A Thousand Cuts: she flickers from foe to foe, two cuts each
  thousand(g, p, s) {
    const fx = g.skillFx, list = foes(g, p.pos.x, p.pos.z, s.range).sort((a, b) => flatDist(a.pos, p.pos) - flatDist(b.pos, p.pos)).slice(0, s.targets);
    p.inv = Math.max(p.inv || 0, s.dur + .2); let i = 0;
    const per = .82 / Math.max(1, list.length || 3);
    return (dt, t) => {
      while (t >= .06 + i * per && i < Math.max(1, list.length || 3)) {
        const e = list[i]; i++;
        fx.ghost(p.rig, '#d8c8ff', .4);
        if (alive(e)) {
          const a = Math.random() * PI * 2, r = (e.radius || .5) + 1; slideTo(p, e.pos.x + Math.sin(a) * r, e.pos.z + Math.cos(a) * r); p.facing = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
          for (let k = 0; k < 2; k++) fx.after(k * .06, () => { if (!alive(e)) return; const c = topOf(e); streak(fx, V3(c.x - 1, c.y + (k ? -.4 : .4), c.z - (k ? 1 : -1)), V3(c.x + 1, c.y + (k ? .4 : -.4), c.z + (k ? 1 : -1)), '#f0e8ff', .05, .18); g.hitEnemy(e, s.power, k === 1, p.pos, { snd: 'dual', knock: .3 }); sfxo('flurry_stab', { n: k + 1 }); });
          sfxo('dash_zip', { vol: .6 });
        } else { const [x, z] = fwd(p); p.moveBy(x * 1.6, z * 1.6); sweepArc(fx, p, { r: 2.2, arc: 2, color: '#f0e8ff', life: .2, tilt: i % 2 ? .6 : -.6 }); }
      }
    };
  },
  // Hephaestus' Meteor: a burning rock from the sky onto the foe
  meteor(g, p, s, tgt) {
    return once(.4, () => {
      const fx = g.skillFx, P = aimAt(g, p, tgt, s.aim, 8), gy = ground(g, P.x, P.z), c = V3(P.x, gy, P.z);
      fx.ring(c, { r0: s.radius * .95, r1: s.radius, color: '#ff4a1a', life: 1, opacity: .7 });
      fx.ring(c, { r0: s.radius, r1: .3, color: '#ff8a3a', life: 1, opacity: .5 });
      const rock = new THREE.Group(), core = mesh(rockG(), glow('#5a2a1a', 1, false), rock), fire = mesh(ballG(), glow('#ff7a1a', .7), rock), out = mesh(ballG(), glow('#ffd04a', .35), rock);
      core.scale.setScalar(.8); fire.scale.setScalar(1.05); out.scale.setScalar(1.4);
      fx.add(rock, 1, (e, k) => { // falls for .9 s, lands at k = .9 (a wide window, so a slow frame cannot skip it)
        const u = Math.min(1, k / .9) ** 2; rock.position.set(c.x - 9 * (1 - u), gy + 20 * (1 - u) + .6, c.z - 4 * (1 - u)); core.rotation.x += .2; core.rotation.y += .13;
        g.fx.spawn(rock.position, 3, { colors: ['#ffd04a', '#ff6a1a', '#3a2a24'], speed: 1, gravity: -2, life: .5, size: .3, spread: .8 });
        if (k >= .9 && !e.boom) {
          e.boom = true; rock.visible = false; fx.explosion(V3(c.x, gy + .8, c.z), s.radius); fx.smash(c, s.radius * 1.4);
          for (const en of foes(g, c.x, c.z, s.radius)) { g.hitEnemy(en, s.power, true, c, { magic: true, knock: s.knock, el: 'fire', snd: 'crush', ticks: 2 }); if (alive(en)) en.addDot('burn', s.burn * lvlMul(g), s.time); }
          g.shake(.6); g.hitstop(.08); g.flash?.(.14, '#ffb050'); sfxo('fire_boom'); sfxo('quake_slam', { vol: .7 });
        }
      });
    });
  },
  // Athena's Spear: a giant spear of light falls on the foe; a shockwave dazzles all around
  athena(g, p, s, tgt) {
    return once(.4, () => {
      const fx = g.skillFx, P = aimAt(g, p, tgt, s.aim, 7), gy = ground(g, P.x, P.z), c = V3(P.x, gy, P.z);
      fx.ring(c, { r0: s.radius * .9, r1: s.radius, color: '#fff2c0', life: .7, opacity: .7 }); fx.beam(c, .6, '#fff2c0');
      const sp = lightSpear('#fff2c0', 7, .28); sp.rotation.x = PI / 2;
      fx.add(sp, 1.3, (e, k) => {
        const fall = Math.min(1, Math.max(0, (e.t - .45) / .2)); sp.position.set(c.x, gy + 3.2 + 16 * (1 - fall), c.z);
        const fade = e.t < .45 ? 0 : e.t > .9 ? 1 - (e.t - .9) / .4 : 1; sp.traverse((o) => { if (o.material) o.material.opacity = o.material.userData.base * fade; });
        if (fall >= 1 && !e.hit) {
          e.hit = true; const hit = new Set();
          fx.smash(c, s.wave * .7); fx.ring(c, { r0: .5, r1: s.wave, color: '#fff2c0', life: .6 }); fx.ring(c, { r0: .3, r1: s.wave * .6, color: '#ffffff', life: .45 }); fx.beam(c, .8, '#ffe8a0');
          for (const en of foes(g, c.x, c.z, s.radius)) { hit.add(en); g.hitEnemy(en, s.power, true, c, { magic: true, knock: 2, snd: 'crush', ticks: 2 }); if (alive(en)) en.slowBy(s.slow, s.time); }
          fx.shock(c, s.wave, .45, (en) => { if (hit.has(en)) return; hit.add(en); g.hitEnemy(en, s.wavePower, true, c, { magic: true, knock: 1.5 }); if (alive(en)) en.slowBy(s.slow, s.time); });
          g.shake(.7); g.hitstop(.1); g.flash?.(.22, '#fff6d8'); sfxo('oath_smash', { vol: .8 });
        }
      });
    });
  },
  // Hera's Blessing (round 31, Roy: an ultimate now): the queen of the gods comes down to her. A column of turquoise and gold
  // light falls on her, the peacock's tail opens behind her, a crown of light settles over her head, and for s.time s her blows
  // land 80% harder and every blow she takes is halved (Hero.temp.ward, Player.damage)
  hera(g, p, s) {
    const fx = g.skillFx; let done = false;
    p.inv = Math.max(p.inv || 0, s.dur + .2);
    fx.glyphs?.(p, s.dur + .4); fx.ring(p.pos, { r0: .4, r1: 6, color: '#5ad8c8', life: 1, opacity: .6 });
    g.flash?.(.1, '#2a6a64');
    return (dt, t) => {
      if (Math.random() < .6 && !done) g.fx.spawn(V3(p.pos.x + (Math.random() - .5) * 3, p.pos.y + 3 + Math.random() * 2, p.pos.z + (Math.random() - .5) * 3), 1, { colors: ['#5ad8c8', '#ffd24a', '#ffffff'], speed: .3, gravity: 3, life: .6, size: .12 });
      if (done || t < .5) return; done = true;
      const H = g.hero;
      bless(g, 'hera', { power: powerOf(g, s.boost), ward: s.ward }, s.time, '#5ad8c8', '+80%');
      peacock(fx, p, 3.4, 1.6);
      fx.beam(p.pos.clone(), 1.1, '#5ad8c8'); fx.pillar?.(p, 1.6);
      fx.ring(p.pos, { r0: .5, r1: 10, color: '#5ad8c8', life: .8 }); fx.ring(p.pos, { r0: .4, r1: 7, color: '#ffd24a', life: .6 }); fx.ring(p.pos, { r0: 9, r1: 11, color: '#ffffff', life: 1, opacity: .5 });
      crown(fx, p, s.time);
      g.fx.spawn(V3(p.pos.x, p.pos.y + 1.4, p.pos.z), 50, { colors: ['#5ad8c8', '#ffd24a', '#2a5ad8', '#ffffff'], speed: 7, gravity: -1, life: 1.1, size: .14, spread: 1.2 });
      g.flash?.(.25, '#c8fff4'); g.shake(.5); g.hitstop(.08);
      const until = fx.now() + s.time;
      motes(fx, p, ['#5ad8c8', '#ffd24a', '#ffffff'], () => fx.now() < until && !p.dead, .3);
      void H;
    };
  },
  // Chimera's Breath: a stream of fire she can walk and aim while it pours
  chimaera(g, p, s) {
    const fx = g.skillFx; let acc = s.tick, glowCone = null;
    return (dt, t) => {
      if (t < .12 || t > .9) { if (glowCone) { glowCone.life = 0; glowCone = null; } return; }
      const [x, z] = fwd(p);
      jet(g, V3(p.pos.x + x * .7, p.pos.y + 1.15, p.pos.z + z * .7), 4, x, z, 11, { colors: ['#ffd04a', '#ff8a2a', '#ff3a1a', '#5a2a1a'], life: .7, gravity: -1.5, size: .18 });
      acc += dt; if (acc < s.tick) return; acc -= s.tick;
      fx.cone(p, s.range, s.cone * 2, '#ff7a1a', s.tick * 1.5);
      for (const e of foes(g, p.pos.x, p.pos.z, s.range)) if (inCone(p, e, s.range, s.cone)) { g.hitEnemy(e, s.power, false, p.pos, { magic: true, el: 'fire', knock: .2 }); if (alive(e)) e.addDot('burn', s.burn * lvlMul(g), s.time); }
    };
  },
  // Titans' Edge: a giant ghost sword sweeps a half circle
  titanedge(g, p, s) {
    return once(.44, () => {
      const fx = g.skillFx, f0 = p.facing;
      giantBlade(fx, p, s.radius, s.arc, .26, f0);
      // Roy 30.10 ("no attack should look like, or be in the style of, another"; Prometheus' Arc swept the same crescent of
      // light): no crescent here. The titan's sword passes alone, two fainter ghosts of it a beat behind, and its point ploughs
      // the ground along the arc, stone chips and grit thrown up as it goes (Prometheus' Arc: a crescent of blue fire)
      for (const [d, op] of [[.05, .45], [.1, .2]]) fx.after(d, () => giantBlade(fx, p, s.radius, s.arc, .26, f0, op));
      for (let i = 0; i < 7; i++) fx.after(.03 + i * .036, () => { const a = f0 + s.arc / 2 - s.arc * (i + .5) / 7, x = p.pos.x + Math.sin(a) * (s.radius + .3), z = p.pos.z + Math.cos(a) * (s.radius + .3); g.fx.spawn(V3(x, p.pos.y + .2, z), 3, { colors: ['#8a8a96', '#5a5a66', '#cfe4ff'], speed: 3, gravity: 9, life: .5, size: .16, spread: .4 }); });
      const hit = new Set();
      for (let k = 0; k < 5; k++) fx.after(k * .055, () => {
        for (const e of foes(g, p.pos.x, p.pos.z, s.radius + .6)) if (!hit.has(e) && inCone(p, e, s.radius + .6, s.arc / 2, f0)) { hit.add(e); g.hitEnemy(e, s.power, true, p.pos, { knock: s.knock, stagger: .6, magic: true, ticks: 2 }); }
        if (k === 4 && hit.size) { g.shake(.45); g.hitstop(.08); }
      });
      g.flash?.(.08, '#d8e8ff');
    });
  },
  // Charge of the Myrmidons: a long spear-first charge with ghost warriors beside her, then a stunning thrust
  myrmidons(g, p, s, tgt) {
    const fx = g.skillFx, hit = new Set(); let moved = 0, gt = 0, fin = false, stopped = false;
    const P = aimAt(g, p, tgt, s.aim, s.range); p.facing = Math.atan2(P.x - p.pos.x, P.z - p.pos.z);
    p.inv = Math.max(p.inv || 0, s.dur + .2); fx.chargeAura?.(p, s.dur * .8);
    return (dt, t) => {
      const [x, z] = fwd(p);
      if (t > .1 && t < .8 && !stopped && moved < s.range) {
        const st = Math.min(s.range - moved, s.range / (s.dur * .7) * dt); if (!p.moveBy(x * st, z * st)) stopped = true; moved += st;
        if ((gt += dt) > .07) { gt = 0; for (const off of [-1.5, 1.5, -2.8, 2.8]) { const e = fx.ghost(p.rig, '#e8b870', .35); e.obj.position.x += z * off - x * Math.abs(off) * .35; e.obj.position.z += -x * off - z * Math.abs(off) * .35; } }
        if (Math.random() < .7) g.fx.spawn(V3(p.pos.x - x * .5, p.pos.y + .1, p.pos.z - z * .5), 2, { colors: ['#c8b090', '#a08060'], speed: 1.6, gravity: 2, life: .45, size: .16, spread: 2 });
        for (const e of foes(g, p.pos.x + x * .8, p.pos.z + z * .8, s.width)) {
          if (hit.has(e)) continue; hit.add(e);
          const side = (e.pos.x - p.pos.x) * z - (e.pos.z - p.pos.z) * x >= 0 ? 1 : -1, from = V3(p.pos.x - z * side * 2, p.pos.y, p.pos.z + x * side * 2);
          g.hitEnemy(e, s.power, true, from, { knock: 1.8, snd: 'spear' }); g.shake(.15);
        }
      }
      if (!fin && t >= .82) {
        fin = true; const a = V3(p.pos.x + x * .6, p.pos.y + 1.05, p.pos.z + z * .6), b = V3(p.pos.x + x * 5, p.pos.y + 1.05, p.pos.z + z * 5);
        streak(fx, a, b, '#ffe0a0', .14, .3); fx.ring(b, { r0: .3, r1: 2.4, color: '#e8b870', life: .35, flat: false });
        for (const e of foes(g, p.pos.x, p.pos.z, 5.5)) if (inCone(p, e, 5.5, .6)) g.hitEnemy(e, s.wavePower, true, p.pos, { stun: s.stun, knock: 2, snd: 'spear' });
        g.shake(.35); g.hitstop(.08);
      }
    };
  },
  // Eye of the Storm (round 31, Roy): one great vertical swing, and where the blade comes down three tornadoes spin out of it.
  // For s.time s they wander from side to side at random (each picks a new sideways drift every moment, a slow walk ahead under
  // it), batter whoever they catch and drag the light ones in a little
  storm(g, p, s) {
    return once(.55, () => {
      const fx = g.skillFx, f0 = p.facing, [x, z] = fwd(p), c = V3(p.pos.x + x * 1.8, 0, p.pos.z + z * 1.8); c.y = ground(g, c.x, c.z);
      fx.ring(c, { r0: .3, r1: 3.2, color: '#c8f0f0', life: .4 }); fx.ring(c, { r0: .2, r1: 2, color: '#ffffff', life: .3 });
      g.fx.spawn(V3(c.x, c.y + .3, c.z), 18, { colors: ['#ffffff', '#c8f0f0', '#a89874'], speed: 6, gravity: 5, life: .55, size: .14, spread: .8 });
      g.shake(.3); g.hitstop(.05); g.flash?.(.06, '#e8ffff');
      for (let i = 0; i < s.count; i++) {
        const side = i - (s.count - 1) / 2, hitAt = new Map();
        let lat = side * 3, want = side * 3 + (Math.random() - .5) * 4, next = .2 + Math.random() * .3, along = 0, snd = 0;
        funnel(fx, V3(c.x + z * side * .8, c.y, c.z - x * side * .8), s.time, (pos, dt, T) => {
          if ((next -= dt) <= 0) { next = .35 + Math.random() * .5; want = (Math.random() < .5 ? -1 : 1) * (1.5 + Math.random() * 3.5); } // a new gust: off to one side or the other
          lat += (want - lat) * Math.min(1, dt * 2.2); along += s.speed * dt * (.5 + .5 * Math.sin(T * 2 + i));
          const sx = Math.cos(f0), sz = -Math.sin(f0); // her right hand (sideways to her line)
          const nx = c.x + x * along + sx * lat, nz = c.z + z * along + sz * lat;
          pos.x += (nx - pos.x) * Math.min(1, dt * 6); pos.z += (nz - pos.z) * Math.min(1, dt * 6);
          for (const e of foes(g, pos.x, pos.z, s.core * 1.6)) {
            const dx = pos.x - e.pos.x, dz = pos.z - e.pos.z, dd = Math.hypot(dx, dz) || 1;
            if (!e.T?.boss && !e.T?.heavy && dd > .5) e.moveBy?.(dx / dd * s.pull * dt, dz / dd * s.pull * dt);
            if (dd < s.core + (e.radius || .5) && g.time >= (hitAt.get(e) ?? 0)) { hitAt.set(e, g.time + s.tick); g.hitEnemy(e, s.power, false, pos, { magic: true, knock: .15, snd: 'magic' }); if (++snd % 3 === 1) sfxo('whirl_spin', { vol: .55 }); }
          }
        });
      }
      sfxo('storm_howl');
    });
  },
  // Heads of the Hydra: nine serpent heads of light lunge at the foes around her
  hydra(g, p, s) {
    const fx = g.skillFx; let n = 0;
    return (dt, t) => {
      while (n < s.hits && t >= .08 + n * (.8 / s.hits)) {
        n++; const list = foes(g, p.pos.x, p.pos.z, s.range), e = list.length ? list[(n - 1) % list.length] : null;
        if (!e) { const a = p.facing + (Math.random() - .5) * 2.4, dummy = { pos: V3(p.pos.x + Math.sin(a) * 4, p.pos.y, p.pos.z + Math.cos(a) * 4), T: { height: 1.4 } }; serpentStrike(fx, p, dummy, '#5aff8a'); continue; }
        serpentStrike(fx, p, e, '#5aff8a');
        fx.after(.14, () => { if (!alive(e)) return; g.hitEnemy(e, s.power, n % 3 === 0, p.pos, { magic: true, knock: .3, snd: 'dual' }); if (alive(e)) e.addDot('poison', s.poison * lvlMul(g), s.time, 3); g.fx.spawn(topOf(e), 6, { colors: ['#5aff8a', '#1a5a2a'], speed: 3, life: .4 }); });
        sfxo('flurry_stab', { n });
      }
    };
  },
  // Kronos' Stillness: time stops for every foe around her (round 31, Roy: they no longer take extra damage while it stands still)
  kronos(g, p, s) {
    return once(.5, () => {
      const fx = g.skillFx;
      clock(fx, p.pos.clone(), 5, s.time * .6); fx.glyphs?.(p, 1.6);
      fx.ring(p.pos, { r0: 1, r1: s.radius, color: '#e8d8a0', life: .8 });
      for (const e of foes(g, p.pos.x, p.pos.z, s.radius)) {
        if (e.T?.boss) { e.slowBy(.7, s.time); continue; }
        e.stunT = Math.max(e.stunT || 0, s.time); e.state = 'chase';
        g.fx.spawn(topOf(e), 8, { colors: ['#e8d8a0', '#ffffff'], speed: 0, gravity: 0, life: s.time * .5, size: .1, spread: 1.4 });
      }
      g.flash?.(.25, '#c8c0a8'); g.shake(.15);
    });
  },
  // Rise of the Phoenix (round 31, Roy): a revive she readies in advance. The cast only readies it (wings flare, then a faint
  // ember glow stays round her); the first blow that would kill her while it is ready is undone at once (cheatDeath, below,
  // called by Player.damage): she rises with s.heal of her health, s.safe s untouchable, a ring of fire round her, and 30% more
  // power that melts away over s.fade s. The 30 minute cooldown runs from the cast; readied, it waits as long as it takes
  phoenix(g, p, s) {
    const fx = g.skillFx;
    return once(.5, () => {
      fx.phoenixArm = { s };
      wings(fx, p, 1.4); fx.pillar?.(p, .8);
      fx.ring(p.pos, { r0: .4, r1: 3, color: '#ff8a2a', life: .5 }); fx.ring(p.pos, { r0: 2.6, r1: .3, color: '#ffd04a', life: .45 });
      g.fx.spawn(V3(p.pos.x, p.pos.y + 1.2, p.pos.z), 24, { colors: ['#ffd04a', '#ff6a1a', '#ffffff'], speed: 3, gravity: -2, life: .7, size: .12, spread: .8 });
      g.flash?.(.1, '#ffb050'); g.floatAt?.(p.pos, { he: 'הפניקס מוכנה', en: 'Phoenix ready' }, 'exp', 2.9);
      motes(fx, p, ['#ffd04a', '#ff8a2a', '#ff5a1a'], () => fx.phoenixArm?.s === s && !p.dead, .12);
    });
  },
  // Fall of the Colossus: a towering leap at the foe and a crushing landing
  colossus(g, p, s, tgt) {
    const fx = g.skillFx, P = aimAt(g, p, tgt, s.aim, s.range * .7), d = Math.hypot(P.x - p.pos.x, P.z - p.pos.z), far = Math.min(s.range, Math.max(0, d - (P.e ? 1.4 : 0)));
    const dx = d > .01 ? (P.x - p.pos.x) / d : Math.sin(p.facing), dz = d > .01 ? (P.z - p.pos.z) / d : Math.cos(p.facing);
    let moved = 0, landed = false; p.inv = Math.max(p.inv || 0, s.dur + .3); p.facing = Math.atan2(dx, dz);
    return (dt, t) => {
      const up = t < .12 ? 0 : t < .45 ? 1 - (1 - (t - .12) / .33) ** 3 : t < .68 ? 1 : t < .78 ? 1 - ((t - .68) / .1) ** 2 : 0;
      p.lift = up * 3.2; if (g.cam) g.cam.kick = 1 + up * .2;
      if (t > .12 && t < .74) { const st = Math.min(far - moved, far / (s.dur * .62) * dt); if (st > 0) { p.moveBy(dx * st, dz * st); moved += st; } }
      if (t > .15 && t < .7 && Math.random() < .6) g.fx.spawn(V3(p.pos.x, p.pos.y + p.lift + .5, p.pos.z), 2, { colors: ['#d8a868', '#fff2c0'], speed: 1, gravity: -1, life: .5, size: .12 });
      if (!landed && t >= .78) {
        landed = true; p.lift = 0; if (g.cam) g.cam.kick = 1;
        const c = V3(p.pos.x, p.pos.y, p.pos.z), hit = new Set();
        fx.smash(c, s.wave * .8); fx.beam(c, .7, '#d8a868'); fx.ring(c, { r0: .5, r1: s.wave, color: '#d8a868', life: .7 }); fx.ring(c, { r0: .4, r1: s.wave * .6, color: '#ffffff', life: .5 });
        for (const e of foes(g, c.x, c.z, s.radius)) { hit.add(e); g.hitEnemy(e, s.power, true, c, { stun: s.stun, knock: 2.4, snd: 'crush' }); }
        fx.shock(c, s.wave, .5, (e) => { if (hit.has(e)) return; hit.add(e); g.hitEnemy(e, s.wavePower, true, c, { stun: s.stun, knock: 1.6, snd: 'crush' }); });
        g.fx.spawn(V3(c.x, c.y + .4, c.z), 44, { colors: ['#d8a868', '#8a7058', '#c8a878', '#5a4a3a'], speed: 10, life: .9, gravity: 12, size: .22, spread: 1.2 });
        g.shake(.9); g.hitstop(.14); g.flash?.(.2, '#ffe0b0');
      }
      if (t >= .99) { p.lift = 0; if (g.cam) g.cam.kick = 1; }
    };
  },
  // ---- round 30 (Roy): three new ultimates ----
  // Inferno of Hephaestus (fire, rank 4): she rises inside a whirling column of flame that burns whoever is close (s.storm m),
  // ten burning rocks rain on the foes around her (the nearest first, then open ground), and a ring of fire bursts out of her
  inferno(g, p, s) {
    const fx = g.skillFx, R = s.radius, c0 = p.pos.clone(), hitStorm = new Map(), rocksAt = [];
    let novaDone = false, k = 0;
    p.inv = Math.max(p.inv || 0, s.dur + .6);
    fx.ring(c0, { r0: .4, r1: s.storm, color: '#ff6a1a', life: .7 }); fx.ring(c0, { r0: R * .96, r1: R, color: '#ff4a1a', life: 2.4, opacity: .55 });
    g.flash?.(.12, '#ff7a2a'); g.shake(.3);
    firestorm(fx, p, s.dur + .3, s.storm);
    for (let i = 0; i < s.rocks; i++) rocksAt.push(.3 + i * .045);
    let ri = 0;
    return (dt, t) => {
      const up = t < .2 ? t / .2 : t < .82 ? 1 : Math.max(0, 1 - (t - .82) / .12);
      p.lift = up * 1.4 + Math.sin(t * 20) * .03 * up; if (g.cam) g.cam.kick = 1 + up * .22;
      // the column burns whoever stands in it, about three times a second each
      if (t > .1 && t < .86) for (const e of foes(g, p.pos.x, p.pos.z, s.storm)) {
        const nx = hitStorm.get(e) ?? 0; if (g.time < nx) continue; hitStorm.set(e, g.time + .33);
        g.hitEnemy(e, s.stormPower, false, p.pos, { magic: true, el: 'fire', knock: .5, snd: 'magic' }); if (alive(e)) e.addDot('burn', s.burn * .4 * lvlMul(g), 2.5);
      }
      while (ri < rocksAt.length && t >= rocksAt[ri]) {
        const list = foes(g, p.pos.x, p.pos.z, R).sort((a, b) => flatDist(a.pos, p.pos) - flatDist(b.pos, p.pos));
        const e = list.length ? list[ri % list.length] : null, a = Math.random() * PI * 2, d = 4 + Math.random() * (R - 4);
        const x = e ? e.pos.x : p.pos.x + Math.sin(a) * d, z = e ? e.pos.z : p.pos.z + Math.cos(a) * d;
        skyRock(g, s, x, z, ri); ri++;
      }
      if (!novaDone && t >= .88) {
        novaDone = true; p.lift = 0; if (g.cam) g.cam.kick = 1;
        const c = V3(p.pos.x, p.pos.y, p.pos.z);
        g.flash?.(.3, '#ffb050'); g.shake(1); g.hitstop(.15);
        fx.beam(c, 1, '#ff7a1a'); fx.explosion(V3(c.x, c.y + 1, c.z), 5);
        fx.ring(c, { r0: .5, r1: R, color: '#ffd04a', life: .7 }); fx.ring(c, { r0: R * .4, r1: R * 1.12, color: '#ff4a1a', life: 1, opacity: .7 });
        fireRing(fx, c, R, .75);
        for (const e of foes(g, c.x, c.z, R)) { g.hitEnemy(e, s.nova, true, c, { magic: true, el: 'fire', knock: s.knock, stun: s.stun, snd: 'crush' }); if (alive(e)) e.addDot('burn', s.burn * lvlMul(g), s.time); }
        g.fx.spawn(V3(c.x, c.y + .6, c.z), 70, { colors: ['#fff2b0', '#ffd04a', '#ff7a1a', '#c8261a', '#3a2a24'], speed: 13, life: 1.1, gravity: 4, size: .24, spread: 1.4 });
        sfxo('inferno_nova'); sfxo('fire_boom', { vol: .9 });
      }
      if (t >= .99) { p.lift = 0; if (g.cam) g.cam.kick = 1; }
      k = t;
    };
  },
  // Wrath of Gaia (earth, rank 5): she leaps and strikes the ground; three rings of stone spikes run out from her to s.radius,
  // flinging every foe they pass into the air (stunned), and then the earth closes on them: one last blow where each one stands
  gaia(g, p, s) {
    const fx = g.skillFx, R = s.radius; let struck = false;
    p.inv = Math.max(p.inv || 0, s.dur + 1.2);
    return (dt, t) => {
      if (struck || t < .44) return; struck = true;
      const c = V3(p.pos.x, p.pos.y, p.pos.z), hit = new Map();
      g.shake(1); g.hitstop(.12); g.flash?.(.18, '#e8c890');
      if (!p.rig?.hovering) fx.smash(c, 6);
      fx.ring(c, { r0: .5, r1: 5, color: '#e8c890', life: .5 }); fx.beam(c, .6, '#c8964a');
      g.fx.spawn(V3(c.x, c.y + .3, c.z), 40, { colors: ['#8a7058', '#c8a878', '#5a4a3a', '#3a2e24'], speed: 9, life: 1, gravity: 14, size: .24, spread: 1.2 });
      for (let w = 0; w < s.waves; w++) fx.after(w * .42, () => {
        const r1 = R * (.55 + w * .225), n = 12 + w * 8;
        quakeRing(g, c, r1, w);
        for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + w * .37, rr = r1 * (.35 + Math.random() * .65); fx.after(rr / R * .55, () => earthSpike(g, c.x + Math.sin(a) * rr, c.z + Math.cos(a) * rr, 1.2 + Math.random() * 1.4 + w * .35, '#8a7a68')); }
        for (const e of foes(g, c.x, c.z, r1)) {
          if ((hit.get(e) || 0) > w) continue; hit.set(e, w + 1);
          const d = flatDist(e.pos, c);
          fx.after(d / R * .55, () => {
            if (!alive(e)) return;
            earthSpike(g, e.pos.x, e.pos.z, 2.6 + (e.radius || .5), '#a89070');
            g.hitEnemy(e, s.power, true, c, { stun: s.stun, knock: 1.2, snd: 'crush' });
            if (alive(e) && !e.T?.heavy && !e.T?.boss) e.vy = 8.5; // flung up off the spike
          });
        }
        sfxo(w ? 'gaia_wave' : 'gaia_rise', { vol: 1 - w * .15 }); g.shake(.55);
      });
      // the earth closes on them: a slab of rock slams down where each one stands
      fx.after(s.waves * .42 + .5, () => {
        const list = foes(g, c.x, c.z, R * 1.05);
        for (const e of list) { const q = e.pos.clone(); stoneFist(g, q, (e.radius || .5) + 1.2); fx.after(.32, () => { if (alive(e)) g.hitEnemy(e, s.final, true, q, { stun: s.stun * .6, knock: s.knock * .5, snd: 'crush' }); }); }
        fx.after(.32, () => { g.shake(.9); g.hitstop(.1); g.flash?.(.14, '#e8c890'); sfxo('quake_slam'); sfxo('rock_land', { vol: .8 }); });
        if (!list.length) for (let i = 0; i < 6; i++) { const a = Math.random() * PI * 2, d = 4 + Math.random() * (R - 4); stoneFist(g, V3(c.x + Math.sin(a) * d, 0, c.z + Math.cos(a) * d), 1.5); }
      });
    };
  },
  // Maw of Chaos (black hole, rank 6): she thrusts her palm and tears open the void a few metres ahead (on the thickest knot of
  // foes in reach, else ahead of her). It drags in everything within s.radius for s.life seconds, gnawing at what it holds,
  // then collapses into a blinding blast
  void(g, p, s, tgt) {
    let opened = false;
    p.inv = Math.max(p.inv || 0, s.dur + .4);
    return (dt, t) => {
      if (opened || t < .32) return; opened = true;
      const P = voidSpot(g, p, tgt, s), gy = ground(g, P.x, P.z);
      blackHole(g, s, V3(P.x, gy + 2.6, P.z), gy);
    };
  },
};

// Chain Lightning's trigger (round 31): main.js hitEnemy calls this for every blow of her weapon that lands. The first one while
// the weapon is charged opens the 5 s window; that blow and every one inside the window sends lightning on from the struck foe
export function chainProc(g, e) {
  const fx = g.skillFx, A = fx?.chainArm; if (!A) return;
  const now = fx.now(), s = A.s;
  if (now > A.until) { fx.chainArm = null; return; }
  if (!A.live) { A.live = now; A.until = now + s.window; g.floatAt?.(g.player.pos, { he: 'שרשרת ברקים!', en: 'Chain lightning!' }, 'exp', 2.9); }
  const done = new Set([e]); let cur = e;
  g.fx.spawn(topOf(e), 6, { colors: ['#ffffff', '#a8d8ff'], speed: 3, life: .25 });
  for (let i = 0; i < s.jumps; i++) {
    let best = null, bd = s.jumpR;
    for (const f of g.enemies || []) { if (!alive(f) || done.has(f) || f.noAim) continue; const d = flatDist(f.pos, cur.pos); if (d < bd) { bd = d; best = f; } }
    if (!best) break;
    done.add(best);
    const a = topOf(cur), tgt = best, src = cur.pos.clone(), pow = s.power * Math.pow(.85, i), n = i + 1;
    fx.after(i * .07, () => {
      fx.bolt(a, topOf(tgt), { color: '#a8d8ff', width: .08, jag: .35, segs: 7, life: .26 });
      if (!alive(tgt)) return;
      g.hitEnemy(tgt, pow, false, src, { magic: true, stun: s.stun, el: 'lightning', snd: 'magic' }); sfxo('proc_chain', { n });
      g.fx.spawn(topOf(tgt), 8, { colors: ['#ffffff', '#a8d8ff'], speed: 4, life: .3 });
    });
    cur = best;
  }
  if (done.size === 1) sfxo('proc_chain', { n: 1, vol: .5 });
}
// Rise of the Phoenix (round 31): Player.damage asks this at the blow that would kill her. Readied: the death is undone, true
export function cheatDeath(g) {
  const fx = g.skillFx, A = fx?.phoenixArm, p = g.player, H = g.hero; if (!A || !p || !H) return false;
  fx.phoenixArm = null; const s = A.s;
  p.dead = false; p.hp = Math.max(1, H.maxHp * s.heal); p.inv = Math.max(p.inv || 0, s.safe);
  const c = p.pos.clone();
  wings(fx, p, 2.6); fx.pillar?.(p, 1.4); fx.beam(c, .9, '#ff8a2a'); fireRing(fx, c, s.radius, .7);
  fx.ring(c, { r0: .5, r1: s.radius, color: '#ff8a2a', life: .6 }); fx.ring(c, { r0: .3, r1: s.radius * .7, color: '#ffd04a', life: .5 });
  g.fx.spawn(V3(c.x, c.y + 1, c.z), 60, { colors: ['#fff2b0', '#ffd04a', '#ff6a1a', '#ffffff', '#3a2a24'], speed: 8, gravity: -1, life: 1, size: .16, spread: 1 });
  for (const e of foes(g, c.x, c.z, s.radius)) { g.hitEnemy(e, s.power, true, c, { magic: true, el: 'fire', knock: 1.6 }); if (alive(e)) e.addDot('burn', s.burn * lvlMul(g), s.time); }
  bless(g, 'phoenix', { power: powerOf(g, s.boost) }, s.fade, '#ff8a2a', null, true);
  g.floatAt?.(p.pos, { he: 'קמה מהאפר! +30%', en: 'Risen from the ashes! +30%' }, 'exp', 3);
  g.flash?.(.3, '#ffb050'); g.shake(.6); g.hitstop?.(.12);
  sfxo('fire_boom'); sfxo('rise_cry', { vol: .8 }); sfxo('heal_bloom');
  g.syncHud?.(true);
  return true;
}

// phase sounds: [t (0..1 of the cast), sfx name, opts] (see PHASE_SND in skills.js)
const each = (n, at, name) => Array.from({ length: n }, (_, i) => [at(i), name, { n: i + 1 }]);
export const BOOK_SND = {
  charge: () => [[0, 'dash_start', { vol: .8 }], [.06, 'aegis_rush', { vol: .6 }]], // (Roy 31.10: the rush twice as quick)
  bound: () => [[0, 'dash_start', { vol: .6 }], [.08, 'dash_zip', { vol: .8 }], [.74, 'dash_stop', { vol: .7 }]],
  veil: () => [[0, 'fog_gather', { vol: .7 }], [.28, 'ward_drain', { vol: .6 }], [.3, 'fog_burst', { vol: .5 }]],
  bluearc: () => [[0, 'charge_start', { vol: .5 }], [.38, 'heavy_swing'], [.4, 'bluearc_flare']],
  pierce: () => [[0, 'dash_start'], [.3, 'spear_thrust'], [.34, 'wh_spear', { vol: 1.2 }]],
  fangs: () => [[.22, 'dual_swing'], [.52, 'dual_swing'], [.56, 'proc_poison']],
  cleave: () => [[0, 'charge_start', { vol: .6 }], [.4, 'heavy_swing'], [.45, 'wh_twohand', { step: 2 }], [.47, 'stone_roll', { vol: .7 }]], // (Roy 30.10: the furrow's earth)
  stoneskin: () => [[0, 'rumble', { vol: .6 }], [.38, 'petrify', { vol: .8 }]],
  zephyr: () => [[0, 'whirl_start'], [.42, 'dash_zip'], [.45, 'wave_rise', { vol: .5 }]],
  shuttle: () => [[0, 'dash_start', { vol: .7 }], [.1, 'shuttle_out'], [.5, 'shuttle_back']],
  riposte: () => [[0, 'aegis_brace'], [.06, 'block_shield', { vol: .5 }]],
  leap: () => [[0, 'oath_crouch', { vol: .7 }], [.08, 'oath_launch', { vol: .7 }], [.46, 'quake_slam']],
  venom: () => [[0, 'fire_conjure', { vol: .5 }], [.43, 'proj_throw']],
  warcry: () => [[0, 'rise_cry'], [.3, 'charge_full'], [.33, 'quake_wave', { vol: .6 }]],
  venomtrail: () => [[0, 'fire_conjure', { vol: .45 }], [.28, 'venom_splash'], [.32, 'proc_poison']],
  chain: () => [[0, 'thunder_call', { vol: .6 }], [.4, 'thunder_bolt', { vol: .7 }], [.44, 'proc_chain', { n: 2 }]],
  impale: () => [[0, 'charge_start', { vol: .6 }], [.42, 'proj_throw'], [.44, 'wh_spear']],
  blink: () => [[0, 'fog_gather', { vol: .6 }], [.28, 'fog_burst'], [.31, 'dash_zip'], [.54, 'flurry_stab']],
  earthsplit: () => [[0, 'quake_lift'], [.55, 'quake_slam'], [.57, 'crack'], [.6, 'rumble']],
  sunshield: () => [[0, 'heal_call', { vol: .7 }], [.28, 'aegis_brace'], [.3, 'oath_beam', { vol: .6 }]],
  crescent: () => [[0, 'charge_start', { vol: .5 }], [.42, 'swing3'], [.46, 'prophecy_reveal', { vol: .5 }]],
  blizzard: () => [[0, 'fate_spin'], [.32, 'frost'], [.36, 'whirl_start', { vol: .7 }]],
  keres: () => [[0, 'ward_drain'], [.38, 'heal_bloom', { vol: .6 }]],
  phalanx: () => [[0, 'aegis_brace'], ...each(4, (i) => .12 + i * .17, 'block_shield'), [.84, 'aegis_rush']],
  harvest: () => [[0, 'whirl_start'], [.38, 'heavy_swing'], [.76, 'heavy_swing'], [.8, 'proc_execute', { vol: .7 }]],
  spearrain: () => [[0, 'thunder_call', { vol: .6 }], [.38, 'oath_beam', { vol: .5 }]],
  iceprison: () => [[0, 'fate_spin'], [.48, 'frost'], [.5, 'petrify']],
  thousand: () => [[0, 'flurry_start']],
  meteor: () => [[0, 'fire_conjure'], [.4, 'thunder_call', { vol: .5 }]],
  athena: () => [[0, 'zeus_rise', { vol: .6 }], [.4, 'oath_beam']],
  hera: () => [[0, 'zeus_rise', { vol: .6 }], [.1, 'heal_call'], [.45, 'prophecy_reveal'], [.5, 'oath_beam', { vol: .7 }], [.52, 'heal_bloom'], [.55, 'charge_full']],
  chimaera: () => [[0, 'fire_conjure'], ...each(6, (i) => .12 + i * .13, 'fire')],
  titanedge: () => [[0, 'charge_full'], [.42, 'heavy_swing'], [.45, 'oath_wave', { vol: .7 }]],
  myrmidons: () => [[0, 'aegis_brace'], [.1, 'aegis_rush'], [.3, 'dash_zip'], [.82, 'spear_thrust'], [.84, 'charge_slam']],
  storm: () => [[0, 'quake_lift', { vol: .7 }], [.5, 'heavy_swing'], [.55, 'quake_slam', { vol: .6 }], [.57, 'whirl_start']],
  hydra: () => [[0, 'boss_hiss', { vol: .5 }]],
  kronos: () => [[0, 'prophecy_call'], [.48, 'bell'], [.5, 'glyph']],
  phoenix: () => [[0, 'fire_conjure'], [.2, 'heal_call'], [.5, 'fire_launch', { vol: .7 }]],
  colossus: () => [[0, 'oath_crouch'], [.12, 'oath_launch'], [.68, 'oath_fall'], [.78, 'oath_smash'], [.8, 'quake_wave']],
  // round 30: the three new ultimates (their own sounds in audio.js: inferno_*, gaia_*, void_*)
  inferno: () => [[0, 'inferno_rise'], [.08, 'zeus_rise', { vol: .5 }], [.2, 'fire_conjure']],
  gaia: () => [[0, 'oath_crouch', { vol: .8 }], [.1, 'oath_launch', { vol: .6 }], [.44, 'quake_slam'], [.45, 'gaia_rise'], [.47, 'crack']],
  void: () => [[0, 'ward_drain', { vol: .7 }], [.12, 'fog_gather', { vol: .8 }]],
};

// ---------------------------------------------------------------------------------------------
// icons: 24 px on the carved tile (weapons.js skillIcon draws the frame and outlines the figure)
// ---------------------------------------------------------------------------------------------
const hexRgb = (c) => { const h = c.replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const shade = (c, k) => { const [r, g, b] = hexRgb(c); const f = (v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
const flame = (d, x, y, h, c1, c2) => { d.poly([[x - 2, y], [x - 1.5, y - h * .5], [x, y - h], [x + 1.5, y - h * .5], [x + 2, y]], c1); d.poly([[x - 1, y], [x, y - h * .55], [x + 1, y]], c2); };
const spearPx = (d, x0, y0, x1, y1, shaft, tip) => { d.line(x0, y0, x1, y1, shaft, 2); const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l; d.poly([[x1 + ux * 3.5, y1 + uy * 3.5], [x1 - uy * 1.8, y1 + ux * 1.8], [x1 + uy * 1.8, y1 - ux * 1.8]], tip); };
const snowflake = (d, cx, cy, r, c) => { for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; d.line(cx, cy, x, y, c); const bx = cx + Math.cos(a) * r * .6, by = cy + Math.sin(a) * r * .6; d.line(bx, by, bx + Math.cos(a + .8) * r * .3, by + Math.sin(a + .8) * r * .3, c); d.line(bx, by, bx + Math.cos(a - .8) * r * .3, by + Math.sin(a - .8) * r * .3, c); } d.disk(cx, cy, 1.2, '#ffffff'); };
const roundShield = (d, cx, cy, r, c) => { d.disk(cx, cy, r, shade(c, .55)); d.disk(cx, cy, r - 1, c); d.ring(cx, cy, r - 1, shade(c, 1.35), PI * 1.1, PI * 1.7); d.disk(cx, cy, 1.4, shade(c, 1.5)); };
export const BOOK_DRAW = {
  charge(d, c) { // two bold chevrons rushing right, speed lines and a kick of dust behind
    for (const [y, x0, x1] of [[6, 1, 6], [12, 1, 4], [18, 1, 6]]) d.line(x0, y, x1, y, '#fff2d8');
    for (const [x, k] of [[7, .8], [13, 1.15]]) d.poly([[x, 3], [x + 4, 3], [x + 10, 12], [x + 4, 21], [x, 21], [x + 6, 12]], shade(c, k));
    d.line(17.5, 4, 22.5, 11, '#ffffff');
    for (const [x, y, r] of [[4, 21, 1.8], [2, 19, 1.2], [7, 22, 1.2]]) d.disk(x, y, r, '#a89070');
  },
  bound(d, c) { // a leap arcing through an upright ring of wind
    for (let a = 0; a < PI * 2; a += .06) d.disk(12 + Math.cos(a) * 4, 10 + Math.sin(a) * 7, .75, shade(c, .75));
    for (let t = 0; t <= 1; t += .03) { const x = 2 + t * 20, y = 21 - Math.sin(t * PI) * 11; if (t > .1) d.disk(x, y, .7, t < .55 ? c : '#ffffff'); }
    for (let a = -PI / 2; a < PI / 2; a += .06) d.disk(12 + Math.cos(a) * 4, 10 + Math.sin(a) * 7, .75, '#ffffff'); // the ring's near side, in front of the arc
    d.poly([[22, 20], [18, 17], [20, 17.5], [18.5, 15], [23, 18.5]], '#ffffff');
  },
  veil(d, c) { // a pale figure half through a stone wall
    d.rect(11, 2, 6, 20, '#6a645a'); for (const y of [5, 9, 13, 17]) d.line(11, y, 16, y, '#4a463e'); for (const [x, y] of [[13, 3], [14, 7], [13, 11], [14, 15], [13, 19]]) d.line(x, y, x, y + 1, '#4a463e');
    d.disk(8, 6, 2.4, shade(c, 1.2)); d.poly([[5, 9], [11, 9], [12, 21], [3, 21]], c); d.poly([[6, 10], [10, 10], [10.5, 20], [5, 20]], shade(c, 1.25));
    d.disk(18, 6, 2.4, shade(c, .7)); d.poly([[16, 9], [20, 9], [22, 21], [16, 21]], shade(c, .6)); d.p(7, 6, '#1a1a2a'); d.p(9, 6, '#1a1a2a');
    for (const [x, y] of [[2, 4], [4, 13], [21, 3], [22, 12]]) d.p(x, y, '#ffffff');
  },
  bluearc(d, c) { // a blade sweeping half a circle of blue fire
    for (let a = PI * .95; a <= PI * 2.05; a += .05) d.disk(12 + Math.cos(a) * 9.5, 16 + Math.sin(a) * 9.5, 1.5, shade(c, .55));
    d.ring(12, 16, 9.2, c, PI * .95, PI * 2.05, 2); d.ring(12, 16, 7.4, '#ffffff', PI * 1.2, PI * 1.8, 1);
    for (const [x, y, h] of [[3.5, 13, 5], [7, 8.5, 6], [12, 7, 6.5], [17, 8.5, 6], [20.5, 13, 5]]) flame(d, x, y, h, '#2a6aff', '#bfe8ff');
    d.line(9, 23, 17, 13, '#d8dce4', 2); d.line(8, 21, 11, 24, '#a87a3a', 2); d.p(18, 12, '#ffffff');
  },
  pierce(d, c) { // a hoplite's round shield and the spear thrust out past it (Roy 30.10, no look-alikes: Achilles' Spear and Arachne's Shuttle are lone diagonal spears)
    for (const [y, x0, x1] of [[5, 1, 7], [20, 2, 7]]) d.line(x0, y, x1, y, shade(c, .8));
    d.disk(8, 13, 6.5, '#8a5a2a'); d.disk(8, 13, 5.2, '#c8902a'); d.ring(8, 13, 3, '#8a5a2a'); d.p(7, 11, '#ffe9a0');
    spearPx(d, 4, 9, 18, 9, '#8a5a30', '#e8ecf2'); d.p(22, 9, '#ffffff');
  },
  fangs(d, c) { // two crossed daggers dripping venom
    for (const s of [1, -1]) { const x0 = s > 0 ? 4 : 20, x1 = s > 0 ? 18 : 6; d.line(x0, 20, x1, 5, '#d8dce4', 2); d.line(x0, 20, x0 + s * 3, 17, '#6a4a2a', 2); d.line(x0 + s * 1, 15, x0 + s * 5, 19, '#a87a3a'); d.p(x1, 4, '#ffffff'); }
    d.disk(12, 12, 1.6, c); for (const [x, y] of [[9, 15], [15, 15], [12, 19], [12, 21]]) d.p(x, y, c); d.p(12, 18, shade(c, 1.3));
  },
  cleave(d, c) { // a broad axe and its wide white arc
    d.ring(12, 13, 9, '#ffffff', PI * .9, PI * 2.05, 1); d.ring(12, 13, 8, shade(c, 1.2), PI * .95, PI * 2, 1);
    d.line(6, 20, 15, 9, '#7a4a28', 2);
    d.poly([[13, 5], [20, 4], [21, 10], [17, 13], [14, 9]], '#d8dce4'); d.poly([[15, 6], [19, 6], [19.5, 9.5], [17, 11]], '#8a909c'); d.line(20, 4, 21, 10, '#ffffff');
  },
  stoneskin(d, c) { // a marble torso, cracked and hard
    d.poly([[6, 21], [5, 12], [8, 7], [12, 5], [16, 7], [19, 12], [18, 21]], '#9a948a'); d.poly([[8, 20], [7, 12], [9, 8.5], [12, 7], [15, 8.5], [17, 12], [16, 20]], '#c8c2b4');
    d.disk(12, 4, 2.4, '#b8b2a4'); d.line(9, 11, 11, 14, '#6a645a'); d.line(11, 14, 10, 17, '#6a645a'); d.line(15, 10, 13, 13, '#6a645a'); d.line(8, 9, 10, 8, '#ffffff');
    for (const [x, y] of [[3, 6], [21, 5], [3, 16], [21, 17]]) d.p(x, y, shade(c, 1.3));
  },
  zephyr(d, c) { // gusts curling round a leaf
    for (const [cy, r, a0] of [[8, 4, .2], [13, 5, 3.4], [18, 4, .4]]) d.ring(12, cy, r, c, a0, a0 + PI * 1.4, 1);
    for (const [y, x0, x1] of [[6, 2, 9], [11, 15, 22], [16, 2, 10], [21, 14, 21]]) d.line(x0, y, x1, y, shade(c, 1.3));
    d.poly([[16, 4], [20, 2], [21, 5], [18, 7]], '#6ab04a'); d.line(16, 4, 21, 3, '#a8d060');
  },
  shuttle(d, c) { // a golden weaver's shuttle flashing out and back along the line of a cut
    for (const r of [4.5, 9]) d.ring(12, 12, r, shade(c, .55)); for (let i = 0; i < 4; i++) { const a = i * PI / 4; d.line(12 - Math.cos(a) * 10, 12 - Math.sin(a) * 10, 12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10, shade(c, .55)); } // (Roy 30.10, no look-alikes: Arachne's web behind the shuttle, not a lone spear like Achilles')
    d.line(3, 17, 21, 7, '#ffffff');
    d.poly([[6, 15.5], [11, 11], [18, 8], [13, 13.2]], '#8a5428'); d.poly([[8, 14.2], [11.5, 11.6], [15.5, 9.6], [12.5, 12.6]], '#c8884a'); d.p(12, 12, '#3a1e0c');
    for (const [x, y] of [[5, 6], [9, 3], [17, 19], [20, 15]]) d.p(x, y, shade(c, 1.3));
  },
  riposte(d, c) { // a round shield, a blade crossing behind it, a spark
    d.line(4, 4, 20, 20, '#d8dce4', 2); d.p(3, 3, '#ffffff'); d.line(17, 21, 21, 17, '#a87a3a', 2);
    roundShield(d, 11, 12, 7, '#c89a4a');
    for (const [x, y] of [[19, 5], [20, 4], [21, 6], [18, 6], [20, 3]]) d.p(x, y, c);
  },
  leap(d, c) { // an arc of flight and the crater it ends in
    for (let t = 0; t <= 1; t += .07) { const x = 3 + t * 15, y = 18 - Math.sin(t * PI) * 13; d.p(x, y, t > .5 ? c : shade(c, .8)); }
    d.poly([[16, 16], [19, 11], [22, 16]], '#e8ecf2'); d.line(19, 11, 19, 6, '#e8ecf2');
    d.rect(10, 20, 13, 2, '#5a4a3a'); for (const [x0, y0, x1, y1] of [[16, 20, 13, 17], [20, 20, 23, 17], [18, 19, 18, 16]]) d.line(x0, y0, x1, y1, shade(c, 1.2));
  },
  venom(d, c) { // a green flask with bubbles
    d.rect(10, 3, 4, 2, '#a87a3a'); d.rect(10.5, 5, 3, 4, '#d8f0e8'); d.disk(12, 15, 6.5, '#d8f0e8'); d.disk(12, 15.5, 5.5, c); d.rect(6.5, 11, 11, 2, '#d8f0e8');
    d.disk(10, 16, 1.2, shade(c, 1.4)); d.disk(14, 14, .9, shade(c, 1.4)); d.p(9, 12, '#ffffff'); d.p(12, 20, shade(c, .6));
  },
  venomtrail(d, c) { // footprints across the tile, each one a green puddle dripping
    for (const [x, y, k] of [[5, 19, .7], [10, 15, .85], [14, 11, 1], [19, 6, 1.15]]) { d.disk(x, y, 2.6, shade(c, k * .55)); d.disk(x, y - .4, 1.9, shade(c, k)); d.p(x - 1, y - 1, '#e8ffd0'); }
    for (const [x, y] of [[7, 22], [12, 18], [17, 14], [21, 10]]) d.p(x, y, shade(c, .8));
  },
  warcry(d, c) { // a crested war helm shouting
    d.poly([[7, 4], [12, 2], [17, 4], [19, 10], [18, 19], [14, 21], [10, 21], [6, 19], [5, 10]], '#c89a4a'); d.poly([[8, 9], [11, 9], [11, 17], [9, 18], [8, 14]], '#2a1a10'); d.poly([[13, 9], [16, 9], [16, 14], [15, 18], [13, 17]], '#2a1a10');
    d.rect(11, 9, 2, 7, '#e0b860'); for (let i = 0; i < 9; i++) d.line(4 + i * 2, 3 - Math.sin(i / 8 * PI) * 2, 4 + i * 2, 6, c);
    for (const [x0, y0, x1, y1] of [[20, 12, 23, 10], [20, 15, 23, 15], [20, 18, 23, 20]]) d.line(x0, y0, x1, y1, '#ffffff');
  },
  chain(d, c) { // lightning jumping between three points
    const P = [[4, 6], [12, 13], [20, 7], [16, 20]];
    for (let i = 0; i < 3; i++) { const [x0, y0] = P[i], [x1, y1] = P[i + 1], mx = (x0 + x1) / 2 + 2, my = (y0 + y1) / 2 - 2; d.line(x0, y0, mx, my, c, 2); d.line(mx, my, x1, y1, c, 2); d.line(x0, y0, mx, my, '#ffffff'); }
    for (const [x, y] of P.slice(1)) { d.disk(x, y, 2, shade(c, .6)); d.disk(x, y, 1, '#ffffff'); }
    d.disk(4, 6, 2.6, '#e8b890');
  },
  impale(d, c) { // a spear of light flying
    for (const [y, x0, x1] of [[9, 1, 8], [13, 2, 10], [17, 1, 7]]) d.line(x0, y, x1, y, shade(c, .7));
    d.line(3, 15, 18, 8, shade(c, .7), 4); spearPx(d, 3, 15, 18, 8, c, '#ffffff'); d.line(5, 14, 17, 8.5, '#ffffff');
  },
  blink(d, c) { // a dagger striking out of a puff of shadow
    for (const [x, y, r] of [[7, 16, 4], [11, 18, 3.5], [5, 11, 3], [9, 12, 3]]) d.disk(x, y, r, shade(c, .45));
    for (const [x, y, r] of [[8, 15, 2], [6, 11, 1.6]]) d.disk(x, y, r, shade(c, .8));
    d.line(10, 14, 20, 4, '#d8dce4', 2); d.p(21, 3, '#ffffff'); d.line(9, 12, 12, 15, '#a87a3a', 2); d.line(14, 13, 22, 21, c); d.line(16, 15, 21, 20, '#ffffff');
  },
  earthsplit(d, c) { // a row of stone spikes bursting from a crack
    d.rect(1, 19, 22, 4, '#5a4a3a'); d.line(2, 20, 22, 20, '#2a1a10');
    for (const [x, h] of [[4, 6], [9, 10], [15, 13], [20, 9]]) { d.poly([[x - 2.5, 20], [x, 20 - h], [x + 2.5, 20]], '#a8967a'); d.line(x, 20 - h, x + 2, 20, '#6a5a48'); d.p(x, 21 - h, '#e8dcc8'); }
    for (const [x, y] of [[7, 4], [13, 3], [18, 6]]) d.p(x, y, c);
  },
  sunshield(d, c) { // the sun inside a dome of light
    d.ring(12, 17, 10, shade(c, 1.3), PI, PI * 2, 2); d.rect(1, 17, 22, 2, shade(c, .6));
    for (let i = 0; i < 8; i++) { const a = PI + i / 7 * PI; d.line(12 + Math.cos(a) * 4, 12 + Math.sin(a) * 4, 12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7, c); }
    d.disk(12, 12, 3.5, c); d.disk(11, 11, 1.5, '#ffffff');
  },
  crescent(d, c) { // a moon crescent flying off a sword
    d.disk(14, 10, 7, c);
    const N = d.c.width, k = N / 24, im = d.x.getImageData(0, 0, N, N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot((x + .5) / k - .5 - 17, (y + .5) / k - .5 - 7.5) < 5.6) im.data[(y * N + x) * 4 + 3] = 0; d.x.putImageData(im, 0, 0); // (N: 48 when drawn fine, Roy 30.10's icon options)
    d.line(3, 21, 11, 13, '#d8dce4', 2); d.line(2, 19, 5, 22, '#a87a3a', 2); d.p(12, 12, '#ffffff');
    for (const [x, y] of [[20, 15], [21, 19], [17, 18]]) d.p(x, y, '#ffffff');
  },
  blizzard(d, c) { // a whirl of snow
    for (let t = 0; t < 8; t += .1) { const a = t * 1.1, r = 1 + t * 1.15; d.p(12 + Math.cos(a) * r, 12 + Math.sin(a) * r * .8, t < 3 ? '#ffffff' : t < 6 ? c : shade(c, .7)); }
    snowflake(d, 6, 6, 3, '#ffffff'); snowflake(d, 18, 17, 3, '#ffffff'); for (const [x, y] of [[19, 5], [4, 18], [13, 21], [21, 11]]) d.p(x, y, '#ffffff');
  },
  keres(d, c) { // a drop of blood between dark wings
    for (const s of [-1, 1]) d.poly([[12, 10], [12 + s * 10, 5], [12 + s * 9, 10], [12 + s * 11, 13], [12 + s * 6, 14]], '#3a1a20');
    for (const s of [-1, 1]) d.line(12, 10, 12 + s * 9, 6, '#6a2a34');
    d.poly([[12, 5], [16, 13], [16, 17], [12, 21], [8, 17], [8, 13]], c); d.disk(12, 16, 4, c); d.disk(10.5, 14.5, 1.2, '#ffb0b0');
  },
  phalanx(d, c) { // three bronze shields side by side
    roundShield(d, 6, 13, 5, shade(c, .8)); roundShield(d, 18, 13, 5, shade(c, .8)); roundShield(d, 12, 12, 6, c);
    for (const x of [6, 12, 18]) d.line(x, 2, x, 5, '#e8ecf2');
  },
  harvest(d, c) { // a great scythe over a dark moon
    d.disk(12, 12, 9, shade(c, .35)); d.line(5, 21, 15, 3, '#7a5a3a', 2);
    d.poly([[15, 3], [7, 5], [3, 10], [6, 8], [12, 6.5], [16, 6]], '#e8ecf2'); d.line(15, 3, 4, 9, '#ffffff');
    d.ring(12, 12, 9, c, PI * .2, PI * .9, 1);
  },
  spearrain(d, c) { // spears falling slantwise
    for (const [x, y] of [[4, 2], [10, 5], [16, 1], [19, 8], [7, 10]]) spearPx(d, x, y, x + 3, y + 8, '#c8a060', c);
    d.rect(1, 21, 22, 2, '#5a4a3a'); for (const x of [8, 14, 20]) d.p(x, 20, '#fff2c0');
  },
  iceprison(d, c) { // a ring of ice on the ground, seen from above, a little figure skidding across it
    d.disk(12, 12, 10, shade(c, .6)); d.disk(12, 12, 9, c); d.disk(12, 12, 4, '#3a2a1a'); d.disk(12, 12, 3, '#5a4a32');
    d.ring(12, 12, 9, '#ffffff', PI * 1.05, PI * 1.6); for (const [x0, y0, x1, y1] of [[16, 9, 20, 6], [7, 15, 4, 18], [15, 16, 18, 20]]) d.line(x0, y0, x1, y1, '#ffffff');
    for (const [x0, y0, x1, y1] of [[17, 13, 20, 16], [16, 15, 19, 18]]) d.line(x0, y0, x1, y1, shade(c, 1.45)); // skid marks
  },
  thousand(d, c) { // many crossing cuts
    for (const [x0, y0, x1, y1] of [[2, 4, 20, 18], [4, 20, 21, 3], [2, 12, 22, 11], [11, 2, 13, 22], [3, 8, 19, 22], [5, 16, 22, 7]]) { d.line(x0, y0, x1, y1, shade(c, .7)); }
    for (const [x0, y0, x1, y1] of [[4, 6, 18, 16], [6, 18, 19, 5]]) d.line(x0, y0, x1, y1, '#ffffff');
    d.disk(12, 12, 1.5, '#ffffff');
  },
  meteor(d, c) { // a burning rock falling straight down onto the ground (Roy 30.10, no look-alikes: Deadly Fireball's comet flies across)
    d.poly([[9, 0], [15, 0], [14, 9], [10, 9]], '#ff4a1a'); d.poly([[11, 1], [13, 1], [13, 8], [11, 8]], '#ffd04a');
    d.disk(12, 13, 4.6, '#5a2a1a'); d.disk(12, 13, 3.4, '#8a4a2a'); d.p(11, 12, '#c87a4a');
    d.rect(1, 20, 22, 3, '#3a2a20'); d.line(7, 19, 3, 15, c); d.line(17, 19, 21, 15, c); d.line(9, 19, 8, 16, '#ffd04a'); d.line(15, 19, 16, 16, '#ffd04a');
  },
  athena(d, c) { // a giant spear of light driven into the ground
    d.rect(10, 1, 4, 18, shade(c, .5)); d.rect(11, 1, 2, 18, c); d.poly([[8, 15], [16, 15], [12, 22]], '#ffffff'); d.line(12, 1, 12, 15, '#ffffff');
    d.rect(2, 21, 20, 2, '#5a4a3a'); for (const [x0, y0, x1, y1] of [[8, 20, 3, 17], [16, 20, 21, 17], [6, 22, 2, 22], [18, 22, 22, 22]]) d.line(x0, y0, x1, y1, c);
  },
  hera(d, c) { // a peacock feather's eye
    d.line(12, 22, 12, 12, '#a87a3a'); for (let i = 0; i < 6; i++) { d.line(12, 20 - i * 2, 7 + i * .3, 15 - i * 2, shade(c, .7)); d.line(12, 20 - i * 2, 17 - i * .3, 15 - i * 2, shade(c, .7)); }
    d.disk(12, 8, 6, c); d.disk(12, 8.5, 4.2, '#ffd24a'); d.disk(12, 9, 3, '#2a8a6a'); d.disk(12, 9.5, 1.8, '#2a3ad8'); d.p(11, 8, '#ffffff');
  },
  chimaera(d, c) { // a beast's head breathing fire
    d.poly([[2, 8], [7, 5], [10, 7], [10, 14], [7, 17], [3, 15]], '#8a5a2a'); d.disk(5, 9, 1, '#ffd04a'); d.poly([[1, 6], [4, 4], [3, 8]], '#5a3a1a');
    d.poly([[10, 10], [22, 5], [20, 12], [23, 17], [10, 14]], shade(c, .9)); d.poly([[10, 11], [19, 8], [18, 12], [20, 15], [10, 13]], '#ffd04a'); d.line(10, 12, 16, 12, '#ffffff');
  },
  titanedge(d, c) { // a giant ghost sword with its sweep
    d.ring(12, 13, 10, shade(c, .8), PI * .8, PI * 2.2, 1);
    d.rect(10, 2, 4, 15, shade(c, .7)); d.rect(11, 2, 2, 15, c); d.poly([[10, 2], [12, 0], [14, 2]], c); d.line(12, 1, 12, 16, '#ffffff');
    d.rect(7, 17, 10, 2, '#d8b060'); d.rect(11, 19, 2, 4, '#7a4a28');
  },
  myrmidons(d, c) { // three spearmen charging in a row
    for (const [o, k] of [[0, .7], [5, .85], [10, 1]]) { spearPx(d, 2 + o * .3, 20 - o, 15 + o * .3, 13 - o, '#8a5a30', '#e8ecf2'); d.disk(5 + o * .3, 18 - o, 2.2, shade(c, k)); d.line(4 + o * .3, 16 - o, 6 + o * .3, 15.5 - o, '#c83a2a'); }
  },
  storm(d, c) { // a twisting funnel of wind
    for (let i = 0; i < 7; i++) { const y = 3 + i * 2.6, r = 9 - i * 1.1, x = 12 + Math.sin(i * .9) * 1.2; d.ring(x, y, r, i % 2 ? c : shade(c, .7), PI * .05, PI * .95, 1); d.line(x - r, y, x - r * .4, y + .5, shade(c, 1.3)); }
    for (const [x, y] of [[3, 15], [20, 18], [5, 21]]) d.p(x, y, '#a89874');
  },
  hydra(d, c) { // three serpent heads rising
    for (const [x, h, k] of [[5, 12, .75], [12, 17, 1], [19, 12, .75]]) { d.line(x, 22, x + (x < 12 ? 2 : x > 12 ? -2 : 0), 22 - h + 3, shade(c, k * .8), 2); d.disk(x, 22 - h + 2, 2.4, shade(c, k)); d.p(x - 1, 22 - h + 1, '#ffe14a'); d.p(x + 1, 22 - h + 1, '#ffe14a'); d.p(x, 22 - h + 4.5, '#ff5a5a'); }
  },
  kronos(d, c) { // an hourglass
    d.rect(5, 2, 14, 2, '#a87a3a'); d.rect(5, 20, 14, 2, '#a87a3a'); d.rect(6, 4, 1, 16, '#c89a5a'); d.rect(17, 4, 1, 16, '#c89a5a');
    d.poly([[8, 4], [16, 4], [12.5, 12], [11.5, 12]], '#d8f0ff'); d.poly([[11.5, 12], [12.5, 12], [16, 20], [8, 20]], '#d8f0ff');
    d.poly([[9.5, 6], [14.5, 6], [12, 11]], c); d.poly([[12, 15], [15, 20], [9, 20]], c); d.line(12, 12, 12, 19, c);
  },
  phoenix(d, c) { // a firebird with spread wings
    for (const s of [-1, 1]) { d.poly([[12, 12], [12 + s * 11, 4], [12 + s * 10, 9], [12 + s * 11, 12], [12 + s * 6, 14]], c); d.poly([[12, 12], [12 + s * 8, 7], [12 + s * 7, 11]], '#ffd04a'); }
    d.poly([[10, 10], [14, 10], [13, 18], [12, 22], [11, 18]], '#ff5a1a'); d.disk(12, 8, 2.2, '#ffd04a'); d.p(13, 7, '#2a1a10'); d.poly([[14, 8], [16, 9], [14, 9]], '#ffe08a');
  },
  colossus(d, c) { // a bronze fist crashing into the ground
    d.rect(9, 1, 6, 9, shade(c, .8)); d.poly([[6, 9], [18, 9], [19, 15], [17, 18], [7, 18], [5, 15]], c); for (const x of [8, 11, 14]) d.line(x, 10, x, 14, shade(c, .6)); d.line(6, 12, 9, 12, shade(c, 1.3));
    d.rect(1, 20, 22, 3, '#5a4a3a'); for (const [x0, y0, x1, y1] of [[6, 20, 2, 17], [18, 20, 22, 17], [12, 21, 12, 23], [4, 21, 1, 22]]) d.line(x0, y0, x1, y1, '#ffd8a0');
  },
  // round 30: the three new ultimates
  inferno(d, c) { // a whirling column of fire with burning rocks falling round it
    flame(d, 12, 22, 19, c, '#ffd04a'); flame(d, 7, 22, 11, '#c8261a', c); flame(d, 17, 22, 12, '#c8261a', c);
    d.ring(12, 15, 7, '#ffd04a', PI * .1, PI * .9, 1); d.ring(12, 10, 5, '#fff2b0', PI * 1.1, PI * 1.9, 1);
    for (const [x, y] of [[3, 4], [20, 2], [22, 9]]) { d.disk(x, y, 1.6, '#5a2a1a'); d.line(x + 1, y - 1, x + 3, y - 3, '#ffd04a'); }
    d.rect(1, 22, 22, 1, '#3a1a0c');
  },
  gaia(d, c) { // stone spikes bursting out of a cracked ground
    d.rect(1, 19, 22, 4, '#4a3a2a'); for (const [x0, y0, x1, y1] of [[3, 20, 7, 22], [12, 19, 10, 22], [17, 20, 21, 22]]) d.line(x0, y0, x1, y1, '#1a120a');
    for (const [x, h, w, k] of [[5, 9, 3, .8], [12, 17, 4, 1], [19, 11, 3, .85]]) { d.poly([[x - w, 20], [x, 20 - h], [x + w, 20]], shade(c, k)); d.poly([[x - w * .2, 20 - h * .6], [x, 20 - h], [x + w * .25, 20 - h * .55]], '#e8d8b8'); d.line(x - w * .5, 20, x - w * .1, 20 - h * .7, shade(c, .6)); }
    for (const [x, y] of [[8, 5], [16, 4], [2, 12], [22, 6]]) d.p(x, y, '#c8a878');
  },
  void(d, c) { // a black sphere in a tilted ring of fire, violet light round its edge
    for (let i = 0; i < 64; i++) { const a = i / 64 * PI * 2, x = 12 + Math.cos(a) * 10.5, y = 12 + Math.sin(a) * 3.6; if (Math.sin(a) < 0 && Math.abs(Math.cos(a)) < .55) continue; d.p(x, y, i % 3 ? '#ffb04a' : '#fff2d8'); d.p(x, y + 1, '#c0502a'); }
    d.disk(12, 12, 6.6, c); d.disk(12, 12, 5.4, '#000000'); d.ring(12, 12, 6, '#e8d0ff', PI * 1.05, PI * 1.6);
    for (let i = 0; i < 40; i++) { const a = i / 40 * PI * 2, x = 12 + Math.cos(a) * 10.5, y = 12 + Math.sin(a) * 3.6; if (Math.sin(a) > 0) { d.p(x, y, i % 3 ? '#ffb04a' : '#fff2d8'); } }
    for (const [x, y] of [[3, 3], [21, 20], [20, 3], [4, 20]]) d.p(x, y, shade(c, 1.4));
  },
};
