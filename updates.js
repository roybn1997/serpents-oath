// The Serpent's Oath site: the download and the updates board. A new release is two edits here:
//   1. point ZIP_URL at the release (the "latest" link below always serves the newest one) and set ZIP_MB;
//   2. add one entry at the TOP of UPDATES (newest first). upcoming: true shows it as "coming soon" and keeps it
//      out of the version line under the download button.
// Each entry: v (version, optional), date (YYYY-MM-DD), he/en: { title, items: [one plain line per change] }.
window.SITE = {
  ZIP_URL: 'https://github.com/serpents-oath/serpents-oath.github.io/releases/latest/download/SerpentsOath.zip',
  MAC_URL: 'https://github.com/serpents-oath/serpents-oath.github.io/releases/latest/download/SerpentsOath-Mac.zip',
  ZIP_MB: 134,
};

window.UPDATES = [
  {
    v: '21', date: '2026-10-19', upcoming: true,
    he: { title: 'סבבים 19 ו-20', items: [
      'מדרגות שאפשר לעלות עליהן, קירות בלי פרצות, ומערות שנפתחות בצלעות הגבעות וההרים',
      'משימת הענקים: דמאליס, אישה־פרה עם קופיץ, נתח בשר שגוררים בחבל, ושני ענקים שמפסיקים לריב',
      'כארון עובד על הסיפון ועוצר כדי לדבר, והנהר מצויר נקי',
      'מסך מלא כברירת מחדל, ומוזיקה שקטה, ארוכה ופחות חוזרת על עצמה',
      'שובל הרעל, כישור חדש אחרי קאמפה, ו-10% סיכוי למכה קריטית',
      'קודים חדשים: MAX נותן את כל הנשקים, הבגדים והכישורים, ו-UNDEAD שומר על V בחיים',
      'הזמן ביום עובר לאט יותר, והצללים כבר לא קופצים בשקיעה ובזריחה',
      // round 20: the rest of the round's changes go here
    ] },
    en: { title: 'Rounds 19 and 20', items: [
      'Stairs you can climb, walls with no gaps, and caves that open into hillsides and mountains',
      "The giants' quest: Damalis the cow-woman and her cleaver, a slab of meat dragged on a rope, and two giants who stop fighting",
      'Charon works on deck and stops to talk, and the river draws cleanly',
      'Full screen by default, and quieter, longer, less repetitive music',
      'Poison Trail, a new skill after Kampe, and a 10% chance of a critical hit',
      'New codes: MAX gives every weapon, outfit and skill, and UNDEAD keeps V alive',
      'Days pass more slowly, and shadows no longer jump at sunset and sunrise',
      // round 20: the rest of the round's changes go here
    ] },
  },
  {
    v: '20', date: '2026-10-18',
    he: { title: 'מוזיקה לשאול ובגדים שזזים', items: [
      'מוזיקת מטאל בסגנון 8-bit לעולם התחתון',
      'הבגדים של V מתנפנפים עם התנועה ולא חודרים לגוף',
      'מכה טעונה עם נשק גדול סודקת את הקרקע, וקשת החרב נראית על הלהב',
      'קופסת בשר משומר היא הדרך לעבור את קרברוס',
      'מכת הסילוף של האדס מזמנת אש סגולה על כל האולם',
      'תוכנת התקנה ל-Windows, ארוזה ב-ZIP',
    ] },
    en: { title: 'Underworld music and moving clothes', items: [
      '8-bit metal music for the underworld',
      "V's clothes sway and flutter as she moves, and never clip through her",
      'A charged blow with a great weapon cracks the ground, and the sword arc follows the blade',
      'A tin of preserved meat is the way past Cerberus',
      "Hades' distortion strike brings purple fire down across the whole hall",
      'A Windows installer, packed in a ZIP',
    ] },
  },
  {
    v: '19', date: '2026-10-18',
    he: { title: 'מקשים חדשים ולהב אטרופוס', items: [
      'Ctrl השמאלי מפעיל ומכבה מהירות x1.5',
      'שני מקשי כישורים חדשים: X ו-Z',
      'להב אטרופוס במקום חוט הגורל: הנשק נצבע בשחור פחמן ומכה חזק ב-50% למשך 7 שניות',
    ] },
    en: { title: "New keys and Atropos' Blade", items: [
      'Left Ctrl turns x1.5 speed on and off',
      'Two new skill keys: X and Z',
      "Atropos' Blade replaces the Thread of Fate: the weapon turns coal-black and hits 50% harder for 7 seconds",
    ] },
  },
  {
    v: '18', date: '2026-10-18',
    he: { title: 'שפת עיצוב חדשה', items: [
      'פיקסל־ארט בפירוט כפול לכל הדמויות, בהשראת התמונה של V',
      'כולם ברמה של V: תושבים, 32 אלים וגיבורים, 18 אויבים ובוסים ו-29 חיות',
      'צבעים ותאורה חדשים בכל העולם',
      'בר החיים מהבהב כשהוא נמוך, ואחיזת החנית והקומבו שופרו',
    ] },
    en: { title: 'A new art direction', items: [
      "Double-detail pixel art for every character, after V's reference image",
      "Everyone at V's level: townsfolk, 32 gods and heroes, 18 enemies and bosses, 29 animals",
      'New colours and lighting across the world',
      'The health bar flashes when low, and spear grips and combos look better',
    ] },
  },
  {
    v: '17', date: '2026-10-18',
    he: { title: 'פרק 4: האי שאין ממנו חזרה', items: [
      'פרק 4, "האי שאין ממנו חזרה"',
      'גלגול עם זינוק, וכישורים תוך כדי תנועה',
      '50 כישורים בחמש דרגות, אצל הכוהנים בערים',
      'מפה קטנה ב-20% עם 123 מערות',
      'מוזיקת קרב משלה לכל סוג מפלצת',
    ] },
    en: { title: 'Chapter 4: The Island of No Return', items: [
      'Chapter 4, "The Island of No Return"',
      'A leaping roll, and skills while moving',
      '50 skills in five tiers, sold by the priests in the cities',
      'A map 20% smaller, with 123 caves',
      'Every kind of monster has its own battle music',
    ] },
  },
  {
    v: '16', date: '2026-10-17',
    he: { title: 'קרב עם משקל', items: [
      'לחיצה ארוכה טוענת מכה חזקה, ושלוש לחיצות עושות קומבו משלו לכל נשק',
      'כשפוגעים ב-V: רעד, הבזק אדום, הדיפה ומספר נזק',
      'HUD מסודר מעל בר הכישורים, עם טקסט גדול וקריא',
      'קאמפה נלחמת עם שוט, זנב ורעל, וכבר לא נתקעת',
    ] },
    en: { title: 'Combat with weight', items: [
      "Hold to charge a heavy blow; three quick presses play each weapon's own combo",
      'When V is hit: a shake, a red flash, knockback and a damage number',
      'A tidier HUD above the skill bar, with larger, clearer text',
      'Kampe fights with whip, tail and venom, and no longer gets stuck',
    ] },
  },
  {
    v: '15', date: '2026-10-17',
    he: { title: 'ערים יווניות', items: [
      'גושי בתי חצר, אגורה עם סטואות ודוכנים, אקרופוליס, תיאטראות ומקדשים',
      'ערי נמל עם ספינות, מזחים ועגורנים, וכפרים ושדות מסביב',
      'ארבעה מוכרים בכל עיר',
      'אירועים בדרכים וסוחרים נודדים על סוס',
      'קודים בתפריט ההשהיה',
    ] },
    en: { title: 'Greek cities', items: [
      'Courtyard blocks, an agora with stoas and stalls, an acropolis, theatres and temples',
      'Harbour towns with ships, piers and cranes, and villages and farmland around them',
      'Four traders in every city',
      'Roadside events and wandering merchants on horseback',
      'Cheat codes in the pause menu',
    ] },
  },
  {
    v: '14', date: '2026-10-17',
    he: { title: 'פתיחה חדשה', items: [
      'הסיפור נפתח בחצר הבית שבעיר, והחטיפה של ריין צולמה מחדש',
      'V מתחילה עם חנית, ואת החרב מקבלים מפילון',
      'חזירים מסתערים, ומכה פוגעת בעד שתי מפלצות',
      'עצים חדשים שזזים ברוח',
      'חוף בשאול, ואפשר לחזור עם כארון',
    ] },
    en: { title: 'A new opening', items: [
      "The story opens in the couple's courtyard in town, and Rain's abduction is restaged",
      'V starts with a spear; Philon gives her the sword',
      'Boars charge, and a blow hits up to two monsters',
      'New trees that sway in the wind',
      'A shore in the underworld, and a way back with Charon',
    ] },
  },
  {
    v: '13', date: '2026-10-16',
    he: { title: 'ערים מוקפות חומה', items: [
      '10 ערים עם חומות, מגדלים, שערים, מצודה ותעלות מים',
      'מקדשים שנכנסים אליהם, ו-44 מערות עם מנהרות, מפלצות ותיבות',
      '20 סצנות רחוקות שמסומנות בעמוד עשן',
      'ענקים משוטטים, והמורמו בלילה',
      'מפות אוצר, מגילות רמז ומשימות ציד',
    ] },
    en: { title: 'Walled cities', items: [
      '10 cities with walls, towers, gates, a citadel and canals',
      'Temples you can enter, and 44 caves with tunnels, monsters and chests',
      '20 distant scenes marked by a column of smoke',
      'Roaming giants, and Mormo at night',
      'Treasure maps, clue scrolls and hunting quests',
    ] },
  },
  {
    date: '2026-10-16',
    he: { title: 'האדס, נשקים וחנויות', items: [
      'קרב שאי אפשר לנצח מול האדס, שמחייה את V ונותן לה חרמש וכישור אש־שאול',
      'נשקים לפי סטים, בשש דרגות איכות',
      'כוהן, נשקייה וסוחר בכל עיר',
      'ציד חיות, גשם עם סאונד וקרברוס חדש',
    ] },
    en: { title: 'Hades, weapons and shops', items: [
      'An unwinnable fight with Hades, who revives V and gives her a scythe and Hellfire',
      'Weapons come in sets, across six quality tiers',
      'A priest, an armoury and a trader in every city',
      'Hunting, rain with sound, and a new Cerberus',
    ] },
  },
  {
    v: '10', date: '2026-10-16',
    he: { title: 'שיחות וסיבוב', items: [
      'בשיחות כולם מסתובבים זה אל זה',
      'כישור הסיבוב החדש: שלושה סיבובים וחמש מכות',
      'סמן עכבר בצורת חץ זהב, וחץ יעד בטורקיז',
    ] },
    en: { title: 'Conversations and the spin', items: [
      'In conversations everyone turns to face each other',
      'The new spin skill: three turns and five blows',
      'A gold arrow cursor and a teal objective arrow',
    ] },
  },
  {
    date: '2026-10-16',
    he: { title: 'טרטרוס', items: [
      'פרק טרטרוס אחרי היכל האדס: מדרגות, מארב וגשר מעל נהר האש',
      'קרב בוס בקאמפה, שומרת טרטרוס',
    ] },
    en: { title: 'Tartarus', items: [
      "A Tartarus chapter after Hades' hall: stairs, an ambush and a bridge over the river of fire",
      'A boss fight with Kampe, warden of Tartarus',
    ] },
  },
  {
    v: '7', date: '2026-10-16',
    he: { title: 'ריצה, אולטימייט וסאונד', items: [
      'אנימציית ריצה אמיתית',
      'שלוש דרגות של אולטימייט, שמשיגים לאורך המשחק',
      'סאונד לכל מכה ולכל שלב בכל כישור, ומחווני עוצמת שמע',
      'נשק מאבד כוח מול מפלצות חזקות ממנו, והמפלצות מתחזקות עם כל הריגה',
      'רשימת משימות בצד המסך',
      'תוכנת התקנה ראשונה ל-Windows',
    ] },
    en: { title: 'Running, ultimates and sound', items: [
      'A real running animation',
      'Three tiers of ultimate, earned along the way',
      'A sound for every blow and every stage of every skill, and volume sliders',
      'Weapons lose power against much stronger monsters, and monsters grow with every kill',
      'A quest list on the side of the screen',
      'The first Windows installer',
    ] },
  },
  {
    v: '6', date: '2026-10-15',
    he: { title: '24 תיקונים', items: [
      'מסך פתיחה עם כל הסיפור חרוט על לוח אבן',
      'שבועת הנחש, חוט הגורל וקומו, הכישור שמקים 20 רוחות',
      'השיט עם כארון אל השאול, ושער האדס נפתח',
      '12 עיירות, 35 משימות צד ופי 10 מפלצות',
      'ריצה ב-Shift ודהירה על הסוס',
    ] },
    en: { title: '24 fixes', items: [
      'A title screen with the whole story carved on a stone tablet',
      "The Serpent's Oath, the Thread of Fate, and Rise, which calls up 20 spirits",
      "The ferry ride with Charon into the underworld, and Hades' gate opens",
      '12 towns, 35 side quests and ten times the monsters',
      'Sprint with Shift, gallop on horseback',
    ] },
  },
  {
    v: '5', date: '2026-10-15',
    he: { title: 'עולם פתוח', items: [
      'שעת הליכה מקצה לקצה, ים שחוצים בסירה וסוסים שאפשר לאלף',
      'מפה (M) עם כל הערים וכוכב על היעד הבא',
      'הפרולוג ופרקים 1 עד 3 בתוך העולם',
      'רמות, ניסיון ומאנה, 20 נשקים ו-13 כישורים',
      '20 משימות צד ב-12 ערים',
    ] },
    en: { title: 'An open world', items: [
      "An hour's walk end to end, seas crossed by boat, and horses to tame",
      'A map (M) with every city and a star on the next goal',
      'The prologue and chapters 1 to 3 inside the world',
      'Levels, EXP and mana, 20 weapons and 13 skills',
      '20 side quests in 12 cities',
    ] },
  },
  {
    v: '2–4', date: '2026-10-14',
    he: { title: 'מראה ותחושה', items: [
      'בלי קוביות: קרקע חלקה, דשא, מים וקווי מתאר',
      'מצלמה אלכסונית כמו במשחקי MMO',
      'מסך "איך משחקים" ויהלום זהב שמסמן לאן ללכת',
      'קרב חד יותר: הבזק לבן, ניצוצות והדיפה',
      'פנים חיות לכל הדמויות, ודיוקן בכל שורת דיאלוג',
    ] },
    en: { title: 'Look and feel', items: [
      'No more blocks: smooth ground, grass, water and outlines',
      'A diagonal camera, as in MMO games',
      'A how-to-play screen and a gold diamond that shows where to go',
      'Sharper combat: a white flash, sparks and knockback',
      'Living faces for every character, and a portrait on every line of dialogue',
    ] },
  },
  {
    v: '1', date: '2026-10-14',
    he: { title: 'הגרסה הראשונה', items: [
      'בחירה בין עברית לאנגלית',
      'הפרולוג: הלילה שבו הכוכבים נעלמים והחטיפה של ריין',
      'פרק 1 במקדש אתנה, ופרק 2 בעמק עם פילון וכארון',
      '8 מנגינות 8-bit מקוריות',
      'מקלדת ועכבר במחשב, ג׳ויסטיק על המסך בטלפון',
    ] },
    en: { title: 'The first build', items: [
      'Hebrew or English',
      "The prologue: the night the stars vanish, and Rain's abduction",
      "Chapter 1 at Athena's temple, and chapter 2 in the valley with Philon and Charon",
      '8 original 8-bit themes',
      'Keyboard and mouse on PC, an on-screen joystick on phone',
    ] },
  },
];
