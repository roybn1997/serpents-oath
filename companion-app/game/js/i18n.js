import { actionKeys, regSkillActions } from './keys.js';
import { isOnline } from './mode.js';
export let LANG = 'en';
export function setLang(l) {
  LANG = l;
  document.documentElement.lang = l;
  // Roy 31.10: "nothing in the game changes position according to the game's language, only the language changes": the
  // page is left-to-right in every language (the minimap on the right, the chat on the left, rows and windows as in
  // English). Hebrew text still reads right to left inside its own line (style.css, "Hebrew in a left-to-right page").
  document.documentElement.dir = 'ltr';
}
// The language is the launcher's (Roy, v31b: it is chosen there only, never in the game). In order: ?lang= (tests, dev),
// the launcher's choice (window.soShell.lang from launcher/app/game-preload.js), the player-wide stored language
// 'serpents-oath-lang' (written by the launcher; the launcher's page and the game share file:// localStorage in Electron's
// userData), the launcher's older key 'so-launcher-lang', the legacy 'lang' field of 'serpents-oath-save', the site's
// 'so-lang' (same origin on the web), else English. The browser's language is not consulted: English is the default
// everywhere until the player picks another (Roy, 27.10). Only 'he' and 'en' are accepted, and 'es' in
// online mode (BETA ONLINE: its screens speak Spanish too, js/online/strings.js; the campaign's words fall back to English).
const okLang = (v) => (v === 'he' || v === 'en' || (v === 'es' && isOnline()) ? v : null);
const stored = (k, f = (x) => x) => { try { return okLang(f(localStorage.getItem(k))); } catch { return null; } };
export function resolveLang(param) {
  return okLang(param) || okLang(globalThis.soShell?.lang) || stored('serpents-oath-lang') || stored('so-launcher-lang')
    || stored('serpents-oath-save', (x) => JSON.parse(x || 'null')?.lang) || stored('so-lang') || 'en';
}
export const t = (o) => (o == null ? '' : typeof o === 'string' ? o : (o[LANG] ?? o.en));

export const UI = {
  continue: { he: 'להמשיך מהפרק האחרון', en: 'Continue from last chapter' },
  newGame: { he: 'משחק חדש', en: 'New game' },
  objective: { he: 'משימה', en: 'Objective' },
  contDesk: { he: 'רווח או קליק להמשך', en: 'Space or click to continue' },
  contTouch: { he: 'הקישי להמשך', en: 'Tap to continue' },
  sync: { he: 'ההתקדמות נשמרת בחשבון Claude שלך, אפשר להמשיך מכל מכשיר', en: 'Progress saves to your Claude account, so you can continue on any device' },
  syncLocal: { he: 'ההתקדמות נשמרת בדפדפן הזה', en: 'Progress is saved in this browser' },
  howTitle: { he: 'איך משחקים', en: 'How to play' },
  howGo: { he: 'יוצאים לדרך', en: 'Let\'s go' },
  // the keys are read from the bindings as they are now (keys.js), so a remapped key shows where it went
  howDesk: [
    [() => actionKeys(['up', 'left', 'down', 'right']), { he: 'תנועה', en: 'Move' }],
    ['Mouse', { he: 'כיוון', en: 'Aim' }],
    ['Left click', { he: 'מכה (3 ברצף = קומבו)', en: 'Strike (3 in a row = combo)' }],
    ['Right click', { he: 'מגן (בהחזקה)', en: 'Hold to shield' }],
    [() => actionKeys(['dodge']), { he: 'גלגול / המשך דיאלוג', en: 'Roll / continue dialogue' }],
    [() => actionKeys(regSkillActions()), { he: 'כישורים (עולים מאנה)', en: 'Skills (cost mana)' }],
    [() => actionKeys(['skill3']), { he: 'הכוח העליון (ULT)', en: 'Ultimate' }],
    [() => actionKeys(['potion0']) + ' / ' + actionKeys(['potion1']), { he: 'שיקוי חיים / שיקוי מאנה', en: 'Health potion / mana potion' }],
    [() => actionKeys(['interact']), { he: 'לדבר, להרים, לרכוב, לעלות לסירה', en: 'Talk, pick up, mount, board' }],
    [() => actionKeys(['whistle']), { he: 'לקרוא לרכוב (ושוב: לשלוח אותו)', en: 'Call your mount (again: send it off)' }],
    ...(isOnline() ? [] : [[() => actionKeys(['fast']), { he: 'מהירות משחק x1.5 (לא בזמן קרב)', en: 'Game speed x1.5 (not during fights)' }]]), // (campaign only, Roy 31.10)
    [() => actionKeys(['map']), { he: 'מפת העולם (מסע מהיר מאבני דרך)', en: 'World map (fast travel from waystones)' }],
    [() => actionKeys(['inventory']), { he: 'התיק: ציוד, כישורים ומשימות. ליד כל כישור: BIND לבחירת מקש', en: 'Inventory, skills and quests. Next to each skill: BIND to choose its key' }],
    ['Wheel', { he: 'זום', en: 'Zoom' }],
    [() => ['Esc', ...actionKeys(['pause']).split(' ').filter((k) => k !== '—')].join(' / '), isOnline() ? { he: 'הגדרות (ושם גם: מקשים)', en: 'Settings (and there: key bindings)' } : { he: 'הפסקה (ושם גם: מקשים)', en: 'Pause (and there: key bindings)' }], // nopause: online the settings don't pause
  ],
  howTouch: [
    [{ he: 'ג׳ויסטיק', en: 'Left stick' }, { he: 'תנועה (בצד שמאל של המסך)', en: 'Move (left side of the screen)' }],
    [{ he: 'מכה', en: 'ATK' }, { he: 'מכה (3 ברצף = קומבו)', en: 'Strike (3 in a row = combo)' }],
    [{ he: 'מגן', en: 'SHIELD' }, { he: 'להחזיק כדי לחסום', en: 'Hold to block' }],
    [{ he: 'גלגול', en: 'ROLL' }, { he: 'התחמקות', en: 'Dodge' }],
    [{ he: 'פעולה', en: 'USE' }, { he: 'לדבר, להרים, לרכוב, לעלות לסירה', en: 'Talk, pick up, mount, board' }],
    [{ he: 'קשת הכישורים', en: 'Skill arc' }, { he: 'ארבעה כישורים, כל אחד עולה מאנה', en: 'Four skills, each costs mana' }],
    [{ he: 'בקבוקון', en: 'Flask' }, { he: 'לשתות שיקוי חיים', en: 'Drink a health potion' }],
    [{ he: 'פרסה', en: 'Horseshoe' }, { he: 'לקרוא לרכוב (ושוב: לשלוח אותו)', en: 'Call your mount (again: send it off)' }],
    [{ he: 'מפה', en: 'Map' }, { he: 'נגיעה במפה הקטנה: מפת העולם ומסע מהיר', en: 'Tap the minimap: world map and fast travel' }],
    [{ he: 'תיק', en: 'Bag' }, { he: 'ציוד, כישורים ומשימות', en: 'Inventory, skills and quests' }],
  ],
  fastOn: { he: 'מהירות x1.5 פעילה ({k} לכיבוי)', en: 'Speed x1.5 is on ({k} to turn off)' },
  fastHeld: { he: 'מהירות x1.5 תופעל כשהקרב ייגמר', en: 'Speed x1.5 waits for the fight to end' },
  howObj: { he: 'המשימה הנוכחית והמשימות שבמעקב מופיעות למעלה, ויהלום זהב מסמן לאן ללכת.', en: 'Your objective and tracked quests are shown at the top, and a gold diamond marks where to go.' },
  paused: { he: 'הפסקה', en: 'Paused' },
  resume: { he: 'חזרה למשחק', en: 'Resume' },
  musicOn: { he: 'מוזיקה: פועלת', en: 'Music: on' },
  musicOff: { he: 'מוזיקה: כבויה', en: 'Music: off' },
  sfxOn: { he: 'צלילים: פועלים', en: 'Sound: on' },
  sfxOff: { he: 'צלילים: כבויים', en: 'Sound: off' },
  dispFull: { he: 'תצוגה: מסך מלא', en: 'Display: fullscreen' },
  dispWin: { he: 'תצוגה: חלון', en: 'Display: window' },
  volume: { he: 'עוצמת קול', en: 'Volume' },
  volMaster: { he: 'כללי', en: 'Master' },
  volMusic: { he: 'מוזיקה', en: 'Music' },
  volSfx: { he: 'אפקטים', en: 'Effects' },
  restart: { he: 'להתחיל את הפרק מחדש', en: 'Restart chapter' },
  quit: { he: 'למסך הפתיחה', en: 'Back to title' },
  fell: { he: 'Val נפלה', en: 'Val is down' },
  fellSub: { he: 'ההבטחה עדיין בתוקף.', en: 'The promise still stands.' },
  retry: { he: 'לנסות שוב', en: 'Try again' },
  skip: { he: 'לחיצה להמשך', en: 'Tap to continue' },
  helpDesktop: {
    he: 'WASD תנועה, עכבר לכיוון\nקליק שמאלי מכה, קליק ימני (בהחזקה) מגן\nרווח גלגול, T דיבור ופעולה, Q E R X Z כישורים, F כוח עליון, 1/2 שיקויים\nH סוס, M מפה, I תיק, Ctrl שמאלי מהירות, גלגלת זום, Esc הפסקה',
    en: 'WASD move, mouse to aim\nLeft click strike, hold right click to shield\nSpace roll, T talk and interact, Q E R X Z skills, F ultimate, 1/2 potions\nH mount, M map, I inventory, left Ctrl speed, wheel zoom, Esc pause',
  },
  helpTouch: {
    he: 'ג׳ויסטיק משמאל לתנועה\nכפתורים מימין: מכה, מגן (החזקה), גלגול, פעולה, כישורים, שיקוי, סוס\nנגיעה במפה הקטנה פותחת את מפת העולם',
    en: 'Left stick to move\nRight buttons: attack, shield (hold), roll, use, skills, potion, mount\nTap the minimap for the world map',
  },
  btnAtk: { he: 'מכה', en: 'ATK' },
  btnBlock: { he: 'מגן', en: 'SHIELD' },
  btnDodge: { he: 'גלגול', en: 'ROLL' },
  btnUse: { he: 'פעולה', en: 'USE' },
  endAct: { he: 'סוף מערכה ראשונה', en: 'End of Act One' },
  nextAct: { he: 'מערכה שנייה — ממלכת המתים — בהכנה', en: 'Act Two — The Kingdom of the Dead — still in the works' },
  thanks: { he: 'תודה ששיחקת בגרסה המוקדמת!', en: 'Thanks for playing the early build!' },

  // ---- open-world HUD, map, inventory, quests (UI agent) ----
  btnPotion: { he: 'שיקוי', en: 'POTION' },
  btnWhistle: { he: 'רכוב', en: 'MOUNT' },
  lv: { he: 'רמה', en: 'LV' },
  level: { he: 'רמה', en: 'Level' },
  levelUp: { he: 'עלית רמה!', en: 'Level up!' },
  levelUpSub: { he: 'החיים והמאנה התמלאו', en: 'Health and mana restored' },
  map: { he: 'מפה', en: 'Map' },
  inventory: { he: 'תיק', en: 'Inventory' },
  pause: { he: 'הפסקה', en: 'Pause' },
  close: { he: 'סגירה', en: 'Close' },
  quests: { he: 'משימות', en: 'Quests' },
  tracked: { he: 'במעקב', en: 'Tracked' },
  track: { he: 'לעקוב', en: 'Track' },
  noMana: { he: 'אין מספיק מאנה', en: 'Not enough mana' },
  skTipEmpty: { he: 'אפשר לשבץ כאן כישור בחלון הכישורים ({k})', en: 'Assign a skill here in the skills window ({k})' },
  skTipReady: { he: 'מוכן', en: 'Ready' }, skTipCool: { he: 'בטעינה: עוד {n} שנ׳', en: 'Cooling down: {n}s' },
  skTipUlt: { he: 'כישור על', en: 'Ultimate skill' }, skTipAny: { he: 'בכל נשק', en: 'Any weapon' },
  emptySlot: { he: 'משבצת ריקה', en: 'Empty slot' },
  potionHp: { he: 'שיקוי חיים', en: 'Health potion' },
  potionMp: { he: 'שיקוי מאנה', en: 'Mana potion' },
  received: { he: 'קיבלת', en: 'Received' },
  discovered: { he: 'גילית מקום חדש', en: 'New place discovered' },
  day: { he: 'יום', en: 'Day' },
  night: { he: 'לילה', en: 'Night' },
  miss: { he: 'החטאה', en: 'Miss' },
  rarity: {
    common: { he: 'רגיל', en: 'Common' }, rare: { he: 'נדיר', en: 'Rare' },
    epic: { he: 'אפי', en: 'Epic' }, legendary: { he: 'אגדי', en: 'Legendary' },
  },
  // world map
  worldMap: { he: 'מפת העולם', en: 'World map' },
  legend: { he: 'מקרא', en: 'Legend' },
  zoomIn: { he: 'התקרבות', en: 'Zoom in' },
  zoomOut: { he: 'התרחקות', en: 'Zoom out' },
  centerMe: { he: 'למיקום שלי', en: 'Center on me' },
  mapHintDesk: { he: 'גררי להזזה · גלגלת לזום · קליק על אבן דרך למסע מהיר', en: 'Drag to pan · wheel to zoom · click a waystone to fast travel' },
  mapHintTouch: { he: 'גררי להזזה · צביטה לזום · נגיעה באבן דרך למסע מהיר', en: 'Drag to pan · pinch to zoom · tap a waystone to fast travel' },
  fastTravel: { he: 'מסע מהיר', en: 'Fast travel' },
  travelTo: { he: 'לנסוע לכאן', en: 'Travel here' },
  notAttuned: { he: 'אבן הדרך עוד ישנה. געי בה כדי להעיר אותה.', en: 'This waystone is still asleep. Touch it to wake it up.' },
  mk: {
    player: { he: 'את', en: 'You' }, quest: { he: 'משימה להחזיר / יעד', en: 'Quest to hand in / goal' }, waystone: { he: 'אבן דרך', en: 'Waystone' },
    village: { he: 'כפר', en: 'Village' }, landmark: { he: 'אתר', en: 'Landmark' }, portal: { he: 'שער', en: 'Portal' },
    dock: { he: 'רציף', en: 'Dock' }, ferry: { he: 'מעבורת', en: 'Ferry' }, horse: { he: 'הסוס שלך', en: 'Your horse' }, giant: { he: 'ענק משוטט', en: 'Roaming giant' },
    city: { he: 'עיר', en: 'City' }, town: { he: 'עיירה', en: 'Town' }, home: { he: 'בית', en: 'Home' },
    story: { he: 'אתר בעלילה', en: 'Story site' }, next: { he: 'היעד הבא', en: 'Next destination' },
    unexplored: { he: 'עוד לא ביקרת', en: 'Not visited yet' },
    weaponsmith: { he: 'נשקייה', en: 'Weaponsmith' }, armourer: { he: 'שריונאי', en: 'Armourer' },
    trader: { he: 'סוחר נודד', en: 'Trader' }, alchemist: { he: 'אלכימאי: איחוד פריטים', en: 'Alchemist: fusion' }, crafter: { he: 'אומנית: יצירת ציוד', en: 'Artificer: crafting' }, priest: { he: 'כוהן: כישורים', en: 'Priest: skills' },
    // round 33 (Roy): ? = a quest to take, ! = one to hand in (or the followed goal), dim ? = a quest above her level
    qoffer: { he: 'משימה לקחת', en: 'Quest to take' }, qlock: { he: 'משימה ברמה גבוהה', en: 'Quest above your level' },
    // round 23 (Roy): the wandering trader while he is near, and a tutorial seller V still has to buy from
    merchant: { he: 'סוחר בדרכים', en: 'Travelling trader' }, tutshop: { he: 'קונים כאן', en: 'Buy here' },
  },
  questLeads: { he: 'המשימה במעקב', en: 'Followed quest' },
  // inventory
  tabWeapons: { he: 'נשק', en: 'Weapons' },
  tabItems: { he: 'חפצים', en: 'Items' },
  tabSkills: { he: 'כישורים', en: 'Skills' },
  tabQuests: { he: 'משימות', en: 'Quests' },
  equip: { he: 'להצטייד', en: 'Equip' },
  equipped: { he: 'בשימוש', en: 'Equipped' },
  use: { he: 'להשתמש', en: 'Use' },
  minLevel: { he: 'רמה מינימלית {n}', en: 'Min. level {n}' },
  needLevel: { he: 'דרושה רמה {n}', en: 'Requires level {n}' },
  dmg: { he: 'נזק', en: 'Damage' },
  speed: { he: 'מהירות', en: 'Speed' },
  reach: { he: 'טווח', en: 'Reach' },
  crit: { he: 'קריטי', en: 'Critical' },
  critHit: { he: 'קריטי!', en: 'CRITICAL!' },
  tier: { he: 'דרגה', en: 'Tier' },
  special: { he: 'מיוחד', en: 'Special' },
  styles: {
    blade: { he: 'חרב ומגן', en: 'Sword & shield' }, spear: { he: 'חנית ומגן', en: 'Spear & shield' }, twohand: { he: 'דו־ידני', en: 'Two-handed' },
    polearm: { he: 'רומח', en: 'Polearm' }, dual: { he: 'זוג להבים', en: 'Dual blades' },
  },
  elements: {
    fire: { he: 'אש', en: 'Fire' }, frost: { he: 'כפור', en: 'Frost' }, lightning: { he: 'ברק', en: 'Lightning' },
    poison: { he: 'רעל', en: 'Poison' }, shadow: { he: 'צל', en: 'Shadow' }, holy: { he: 'קודש', en: 'Holy' },
  },
  kinds: {
    potion: { he: 'שיקוי', en: 'Potion' }, quest: { he: 'חפץ משימה', en: 'Quest item' },
    trophy: { he: 'שלל', en: 'Trophy' }, key: { he: 'מפתח', en: 'Key' },
    map: { he: 'מפה', en: 'Map' }, scroll: { he: 'מגילה', en: 'Scroll' }, coin: { he: 'מטבעות', en: 'Coins' }, relic: { he: 'אוצר', en: 'Treasure' },
  },
  mana: { he: 'מאנה', en: 'Mana' },
  cooldown: { he: 'טעינה', en: 'Cooldown' },
  sec: { he: ' שנ׳', en: 's' },
  assign: { he: 'להקצות למקש', en: 'Assign to key' },
  bind: { he: 'BIND', en: 'BIND' }, // Roy's own word for the button, in both languages
  bindAria: { he: 'בחירת מקש לכישור', en: 'Choose a key for' },
  boundTo: { he: 'המקש של הכישור', en: "This skill's key" },
  allKeys: { he: 'כל המקשים', en: 'All keys' },
  allKeysTip: { he: 'לשנות כל מקש: תנועה, גלגול, מגן, שיקויים, מפה...', en: 'Remap any key: move, roll, block, potions, map...' },
  loadout: { he: 'הכישורים שלך', en: 'Your skills' },
  locked: { he: 'נעול', en: 'Locked' },
  active: { he: 'פעילות', en: 'Active' },
  completed: { he: 'הושלמו', en: 'Completed' },
  reward: { he: 'פרס', en: 'Reward' },
  from: { he: 'מאת', en: 'From' },
  nothing: { he: 'עוד אין פה כלום', en: 'Nothing here yet' },
  pickOne: { he: 'בחרי פריט כדי לראות את הפרטים', en: 'Pick an entry to see the details' },
  // quest offer
  newQuest: { he: 'משימה חדשה', en: 'New quest' },
  accept: { he: 'לקבל', en: 'Accept' },
  decline: { he: 'לסרב', en: 'Decline' },
  // round 22 (Roy): every quest has a level; below it the offer can't be taken
  recLevel: { he: 'רמה מומלצת {n}', en: 'Recommended level {n}' },
  comeBack: { he: 'חזרי ברמה {n}', en: 'Come back at level {n}' },
  questLocked: { he: 'המשימה הזאת עוד קשה מדי בשבילך. חזרי כשתגיעי לרמה {n}.', en: 'This quest is still too hard for you. Come back when you reach level {n}.' },
  ok: { he: 'הבנתי', en: 'OK' },
  minimise: { he: 'מזעור', en: 'Minimise' },
  expand: { he: 'הרחבה', en: 'Expand' },
  // first-time explanations (ui.tip) and their switch in the pause menu
  settings: { he: 'הגדרות', en: 'Settings' },
  tipsOn: { he: 'הסברים: פועלים', en: 'Explanations: on' },
  tipsOff: { he: 'הסברים: כבויים', en: 'Explanations: off' },
  tipsHelp: { he: 'הסבר קצר בפעם הראשונה שמשהו נפתח', en: 'A short hint the first time something opens' },
  tipHint: { he: 'הסבר', en: 'Tip' },
  tipGot: { he: 'הבנתי', en: 'Got it' },
  tipNoMore: { he: 'בלי הסברים', en: 'No more tips' },
  tips: {
    satchel: { he: 'התיק: כל מה שיש לך. לחיצה כפולה על פריט מצטיידת בו.', en: 'Your satchel holds everything you own. Double-click an item to equip it.' },
    tab_weapons: { he: 'נשק: מעבר עם העכבר על נשק משווה אותו למה שביד. חץ ירוק: חזק יותר.', en: 'Weapons: hover one to compare it with yours. A green arrow means stronger.' },
    tab_gear: { he: 'שריון: קסדה, שריון גוף, מגפיים, וכנפיים או גלימה. כל אחד מוסיף כוח משלו.', en: 'Armor: helmet, body armour, boots, and wings or a cape. Each adds its own bonus.', es: 'Armadura: casco, armadura de cuerpo, botas, y alas o una capa. Cada pieza añade su propia bonificación.' },
    tab_use: { he: 'שימוש: שיקויים, מפות, מגילות והרכובים שלך. לחיצה כפולה משתמשת.', en: 'Use: potions, maps, scrolls and your mounts. Double-click to use.', es: 'Usar: pociones, mapas, pergaminos y tus monturas. Doble clic para usar.' }, // Roy 28.10
    tab_items: { he: 'חפצים: דברים למשימות, מפתחות, שלל ומטבעות.', en: 'Items: quest things, keys, trophies and coins.' },
    tab_skills: { he: 'כישורים: לחצי על מקש כדי לשים כישור על Q, E, R, X או Z.', en: 'Skills: press a key button to put a skill on Q, E, R, X or Z.' },
    tab_quests: { he: 'משימות: כל מה שלקחת. "לעקוב" מדליק את החץ הצהוב.', en: "Quests: everything you've taken. Track one to light its yellow arrow." },
    map: { he: 'המפה: כוכב הזהב הוא הסיפור, ? זהוב משימה לקחת, ! משימה להחזיר או מישהו לדבר איתו. אבן דרך = מסע מהיר.', en: 'The map: the gold star is the story, a gold ? a quest to take, ! a quest to hand in or someone to talk to. Waystones = fast travel.' },
    tracker: { he: 'לוח המשימות: הצעדים של כל משימה. לחיצה על משימה מכוונת אליה את החץ הצהוב.', en: 'The quest panel lists each quest\'s steps. Click a quest to point the yellow arrow at it.' },
    questOffer: { he: 'משימה: ? זהוב מעל מישהו אומר שיש לו משימה, ו-! שאפשר להחזיר אותה. רמה מומלצת מופיעה למטה.', en: 'A gold ? over someone means a quest to take; a gold ! means one to hand in. Its recommended level is shown below.' },
    shop: { he: 'חנות: הכסף שלך למעלה. אפשר לחזור ולשדרג בהמשך.', en: 'A shop: your money is at the top. Come back later to upgrade.' },
  },
  exp: { he: 'EXP', en: 'EXP' },
  gold: { he: 'זהב', en: 'gold' },
  // world map: chapters and places
  chapterN: { he: 'פרק {n}', en: 'Chapter {n}' },
  nextDest: { he: 'היעד הבא', en: 'Next destination' },
  notVisited: { he: 'עוד לא היית פה.', en: "You haven't been here yet." },
  loading: { he: 'טוען', en: 'Loading' },
  // gear (head, neck, body, feet)
  tabGear: { he: 'ציוד', en: 'Gear' },
  head: { he: 'ראש', en: 'Head' },
  neck: { he: 'צוואר', en: 'Neck' },
  helmets: { he: 'קסדות', en: 'Helmets' },
  amulets: { he: 'קמיעות', en: 'Amulets' },
  body: { he: 'גוף', en: 'Body' },
  feet: { he: 'רגליים', en: 'Feet' },
  armors: { he: 'שריונות', en: 'Armour' },
  boots: { he: 'סנדלים ומגפיים', en: 'Footwear' },
  emptySlotGear: { he: 'ריק', en: 'Empty' },
  remove: { he: 'להסיר', en: 'Take off' },
  bonuses: { he: 'תוספות', en: 'Bonuses' },
  bonus: {
    guard: { he: '{v} הגנה', en: '{v} guard' }, hp: { he: '{v} חיים מרביים', en: '{v} max HP' },
    mp: { he: '{v} מאנה מרבית', en: '{v} max MP' }, power: { he: '{v} עוצמה', en: '{v} power' },
    crit: { he: '{v} סיכוי למכה קטלנית', en: '{v} crit chance' }, mpRegen: { he: '{v} התחדשות מאנה', en: '{v} mana regen' },
    hpRegen: { he: '{v} התחדשות חיים', en: '{v} health regen' }, exp: { he: '{v} EXP', en: '{v} EXP' },
    lifesteal: { he: '{v} שאיבת חיים', en: '{v} lifesteal' }, speed: { he: '{v} מהירות תנועה', en: '{v} move speed' },
    ice: { he: 'לא מחליקים על קרח', en: 'No slipping on ice' }, // (no number: ice boots either grip or they don't)
    block: { he: '{v} חסימה במגן', en: '{v} shield block' }, // round 23: a shield's share of a blocked blow (weapons.js SHIELD_GEAR)
  },
  // skill requirements
  needs: { he: 'דורש: {x}', en: 'Needs: {x}' },
  needsKind: {
    shield: { he: 'מגן', en: 'a shield' }, blade: { he: 'חרב ומגן', en: 'sword & shield' },
    twohand: { he: 'נשק דו־ידני', en: 'a two-handed weapon' }, dual: { he: 'זוג להבים', en: 'dual blades' },
    polearm: { he: 'רומח', en: 'a polearm' },
    light: { he: 'נשק קל (חרב, חנית או זוג להבים)', en: 'a light weapon (sword, spear or blades)' }, sword: { he: 'חרב ומגן', en: 'sword & shield' },
    reach: { he: 'חנית או רומח', en: 'a spear or polearm' },
  },
  wrongWeapon: { he: 'לא זמין עם הנשק שבידך', en: 'Not available with your current weapon' },
  isNew: { he: 'חדש', en: 'New' },
};

export const NAMES = {
  V: { n: 'Val', c: '#34d1bf' },
  rain: { n: 'Roye', c: '#8fb4ff' },
  philon: { n: { he: 'פילון', en: 'Philon' }, c: '#d9a55a' },
  priestess: { n: { he: 'הכוהנת', en: 'The Priestess' }, c: '#f2e6c4' },
  rider: { n: { he: 'הרוכב השחור', en: 'The Black Rider' }, c: '#e0485a' },
  raven: { n: { he: 'העורב', en: 'The Raven' }, c: '#b9a3e8' },
  atropos: { n: { he: 'אטרופוס', en: 'Atropos' }, c: '#cfd6e0' },
  charon: { n: { he: 'כארון', en: 'Charon' }, c: '#9fd08a' },
  voice: { n: { he: 'קול', en: 'A voice' }, c: '#cfd6e0' },
};

// Capes (Roy, v31b: "in the wings' slot, capes, for the lower levels"; capes2: "capes up to level 30"): the seven cloaks worn
// on the back before wings
// (catalog.js CAPES reads these). Hebrew, English and Spanish; the Hebrew never addresses the player by gender.
export const CAPE_TEXT = {
  cat: { he: 'גלימה', en: 'Cape', es: 'Capa' },
  backSlot: { he: 'כנפיים / גלימה', en: 'Wings / Cape', es: 'Alas / Capa' },
  note: { he: 'גלימה: נלבשת על הגב במקום כנפיים, ואינה חלק משום סט.', en: 'A cape: worn on the back in place of wings, and part of no set.', es: 'Una capa: se lleva a la espalda en lugar de las alas y no forma parte de ningún conjunto.' },
  shepherd_chlamys: {
    name: { he: 'כלמיס הרועה', en: "Shepherd's Chlamys", es: 'Clámide del pastor' },
    desc: { he: 'גלימת צמר קצרה ולא צבועה, נעוצה בסיכת ארד על הכתף. חמה בלילות הקרים על ההר.', en: 'A short cloak of undyed wool, pinned with a bronze brooch at the shoulder. Warm on cold nights up on the mountain.', es: 'Una capa corta de lana sin teñir, prendida al hombro con un broche de bronce. Abriga en las noches frías del monte.' },
  },
  hunter_cloak: {
    name: { he: 'גלימת הצייד', en: "Hunter's Cloak", es: 'Capa del cazador' },
    desc: { he: 'צמר ירוק־זית שנצבע בעלי אלון, עם צווארון של פרוות שועל. בין עצי היער כמעט לא רואים אותה.', en: 'Olive wool dyed with oak leaves, with a collar of fox fur. Among the forest trees it can hardly be seen.', es: 'Lana verde oliva teñida con hojas de roble y un cuello de piel de zorro. Entre los árboles del bosque apenas se ve.' },
  },
  hoplite_cloak: {
    name: { he: 'גלימת ההופליט הארגמנית', en: "Hoplite's Crimson Cloak", es: 'Capa carmesí del hoplita' },
    desc: { he: 'ארגמן עמוק עם שפה של מפתח יווני מוזהב, אחוזה בתפסי ארד בדמות ראשי אריות. הגלימה שיוצאים בה אל הפלנקס.', en: 'Deep crimson with a gilded Greek-key hem, held by bronze lion-head clasps. The cloak worn into the phalanx.', es: 'Carmesí profundo con un borde de greca dorada, sujeta con broches de bronce con cabeza de león. La capa con la que se marcha a la falange.' },
  },
  wolf_cloak: {
    name: { he: 'גלימת עור הזאב', en: 'Wolf-Pelt Cloak', es: 'Capa de piel de lobo' },
    desc: { he: 'עור של זאב אפור מהרי ארקדיה, עם צווארון פרווה עבה ושוליים פרועים. עם הגלימה הזאת הולכים בשקט, כמו הלהקה.', en: 'The pelt of a grey wolf from the Arcadian hills, with a thick fur collar and a ragged hem. Whoever wears it walks as quietly as the pack.', es: 'La piel de un lobo gris de los montes de Arcadia, con un grueso cuello de piel y el borde deshilachado. Quien la lleva camina tan callado como la manada.' },
  },
  saffron_himation: {
    name: { he: 'הימטיון הזעפרן', en: 'Saffron Himation', es: 'Himation de azafrán' },
    desc: { he: 'צמר צבוע זעפרן, כמו הגלימות שהכוהנות לובשות בתהלוכה אל האקרופוליס, עם פס גלים כחול וגדילים בפינות.', en: 'Wool dyed with saffron, like the robes the priestesses wear in the procession up to the Acropolis, with a blue wave border and tassels at the corners.', es: 'Lana teñida con azafrán, como los mantos de las sacerdotisas en la procesión a la Acrópolis, con una cenefa azul de olas y borlas en las esquinas.' },
  },
  royal_chlamys: {
    name: { he: 'כלמיס הארגמן המלכותי', en: 'Royal Purple Chlamys', es: 'Clámide de púrpura real' },
    desc: { he: 'ארגמן צור, הצבע היקר בעולם, עם רקמת זהב של שושנות ושמש מקדונית. נעוצה בסיכת זהב, כמו של מלכי פלה.', en: 'Tyrian purple, the costliest dye in the world, embroidered in gold with rosettes and a Macedonian sun. Pinned with a gold brooch, like the kings of Pella.', es: 'Púrpura de Tiro, el tinte más caro del mundo, bordada en oro con rosetas y un sol macedonio. Prendida con un broche de oro, como los reyes de Pela.' },
  },
  fleece_mantle: {
    name: { he: 'גלימת גיזת הזהב', en: 'Golden Fleece Mantle', es: 'Manto del Vellocino de Oro' },
    desc: { he: 'צמר זהב מתולתל מגיזת האיל המעופף, אחוז בסיכה בדמות ראש איל. בלילה הוא זוהר כמו גחלים.', en: 'Curled golden wool from the fleece of the flying ram, held by a ram\'s-head clasp. At night it glows like embers.', es: 'Lana de oro rizada del vellón del carnero volador, sujeta con un broche en forma de cabeza de carnero. De noche brilla como las brasas.' },
  },
};

// Wings by level (Roy, capes2: "small wings from 30 to 70, seen but they don't make you fly; only from 70 do the wings
// fly, and the higher the wing, the bigger and more impressive"): the tooltip's line for each kind (ui.js), he / en / es
export const WING_TEXT = {
  flight: { he: 'מעופפות', en: 'Flight', es: 'Vuelo' },
  flightNote: { he: 'כנפי מעוף: נושאות מעט מעל הקרקע. ככל שהרמה גבוהה יותר, הכנפיים גדולות ומרשימות יותר.', en: 'Flight wings: they carry you a little above the ground. The higher their level, the bigger and grander they grow.', es: 'Alas de vuelo: te llevan un poco por encima del suelo. Cuanto más alto su nivel, más grandes e imponentes son.' },
  small: { he: 'כנפיים קטנות', en: 'Small wings', es: 'Alas pequeñas' },
  smallNote: { he: 'כנפיים קטנות: לנוי בלבד, ואינן מרימות מהקרקע. כנפי מעוף מתחילות מרמה 70.', en: 'Small wings: for show only, they do not lift you off the ground. Flight wings begin at level 70.', es: 'Alas pequeñas: solo de adorno, no te levantan del suelo. Las alas de vuelo empiezan en el nivel 70.' },
};
