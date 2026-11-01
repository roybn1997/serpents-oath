// The Serpent's Oath · home.js: the home page. Texts in Hebrew, English and Spanish (data-t fills text, data-h fixed
// markup), the feature strips, the screenshots, the hall of fame (SITE.SUPABASE_URL + ANON_KEY, read-only RPC
// leaderboard_top), the updates timeline (window.UPDATES from updates.js) and the viewer for the trailer and shots.
(() => {
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const SETUPF = `<span class="file">SerpentsOath-Setup.exe</span>`;
const MACF = `<span class="file">SerpentsOath-Launcher-Mac.zip</span>`;

const T = {
  he: {
    nav_menu: 'תפריט', nav_game: 'המשחק', nav_lb: 'היכל התהילה', nav_upd: 'עדכונים', nav_wiki: 'ויקי', nav_forum: 'פורום', nav_account: 'כניסה', nav_dl: 'הורדה',
    tagline: 'המסע של Val להחזיר את Roye הביתה. הרפתקה בעולם פתוח ביוון העתיקה, חינם.',
    dl_btn: 'הורדה ל-Windows', dl_sub: 'חינם · ', mac_btn: 'הורדה ל-Mac', mac_sub: 'בטא · ',
    trailer: 'לצפות בטריילר', ver: 'גרסה', mb: 'MB',
    req: 'Windows 10 או 11, 64 ביט. Mac בבטא. המשגר מתקין ומעדכן את המשחק לבד. <a href="#run">איך זה עובד?</a>',
    run_h: 'הורדה והפעלה', run_sub: 'שלושה צעדים. את ההתקנה והעדכונים עושה המשגר.',
    s1_h: 'מורידים את המשגר', s1_p: `לוחצים על כפתור ההורדה ושומרים את ${SETUPF} (בערך <span class="ltr">{mb}MB</span>). זו ההורדה היחידה: את המשחק עצמו מוריד המשגר.`,
    s2_h: 'מריצים ומתקינים', s2_p: 'לחיצה כפולה על הקובץ. אם מופיע החלון הכחול <b class="ltr">"Windows protected your PC"</b>, לוחצים <span class="key">More info</span> ואז <span class="key">Run anyway</span>. בוחרים שפה ולוחצים <b>התקן</b>. בסוף המשגר נפתח לבד.',
    s3_h: 'לוחצים התקנה, ואז קמפיין או ONLINE', s3_p: 'המשגר מוריד ומתקין את המשחק, בודק כל קובץ, ומאז מעדכן אותו לבד בכל פתיחה. בפעמים הבאות פותחים אותו מהקיצור <b class="ltr">The Serpent\'s Oath</b>.',
    notes_h: 'טוב לדעת',
    n_ss_h: 'החלון הכחול של Windows', n_ss: 'החלון <b class="ltr">"Windows protected your PC"</b> מופיע כי תוכנת ההתקנה עוד לא חתומה דיגיטלית. לוחצים <span class="key">More info</span> ואז <span class="key">Run anyway</span> וההתקנה ממשיכה.',
    n_mac_h: 'התקנה ב-Mac', mac_p: `מורידים את ${MACF} (למעבדי Apple silicon; <a class="intel" href="#">למחשבי Mac עם Intel</a>), מחלצים ופותחים את <span class="ltr">The Serpent's Oath.app</span>. בפעם הראשונה macOS מבקש אישור: הגדרות המערכת › פרטיות ואבטחה › <span class="ltr">Open Anyway</span>, כי האפליקציה לא אושרה (notarized) על ידי Apple.`,
    n_upd_h: 'עדכונים אוטומטיים', n_upd: 'בכל פתיחה המשגר בודק אם יש גרסה חדשה ומוריד רק את הקבצים שהשתנו. ההתקדמות נשמרת. כשהמשגר מודיע על גרסה חדשה של המשגר עצמו, מורידים ומריצים שוב את תוכנת ההתקנה: היא מעדכנת אותו במקום, והמשחק והשמירות נשארים.',
    n_req_h: 'דרישות, שמירות ומסך מלא', n_req: 'Windows 10 או 11, 64 ביט. לא צריך הרשאות מנהל: המשגר והמשחק מותקנים בתיקיית המשתמש. הסרה דרך הגדרות › אפליקציות.',
    n_save: 'השמירות נשמרות ב-<span class="path">%APPDATA%\\SerpentsOath</span>, ולא בתיקיית המשחק.', n_full: '<span class="key">F11</span> או <span class="key">Alt+Enter</span> עוברים בין מסך מלא לחלון.',
    n_online_h: 'איך מצטרפים ל-ONLINE', bo_p: 'פותחים את המשגר, לוחצים על החץ הקטן ליד <span class="key">ONLINE</span> ובוחרים <span class="key">BETA ONLINE</span>, ואז נרשמים ויוצרים דמות. אותו חשבון משמש גם <a href="forum.html">בפורום</a>.',
    about_h: 'המשחק',
    about_p1: 'Val היא אישה רגילה מכפר קטן לחוף הים האגאי. בלילה שבו נעלמו הכוכבים, מרכבה שחורה לקחה ממנה את Roye, והיא יוצאת אחריו: דרך ערי יוון המוקפות חומות, הרים ומערות, אל הנהר של המתים ועד לשאול. בדרך היא מגלה שמדוזה, היצור שכולם לימדו אותה לפחד ממנו, היא לא מה שחשבה.',
    f_fight_h: 'קרבות עם משקל', f_fight_p: '4 מקצועות: לוחם, קשת, נוכל ואשף. בכל מקצוע 5 עבודות, 12 סוגי נשק, קומבו זורם ואולטימייט.', f_fight_m: 'עוד על הקרבות',
    f_fight_x: 'כל נשק מגן אחרת ומכה אחרת: חרב ומגן, חנית, גרזן דו-ידני, קשת, פגיון, שרביט או מטה. ברמה 30 נשבעים שבועה שנייה ובוחרים מקצוע, ועץ הכישורים נפתח לפיו: 217 כישורים בארבעה מקצועות. כישורים מופעלים ב-<span class="key">Q</span> <span class="key">E</span> <span class="key">R</span> <span class="key">X</span> וה-ULT ב-<span class="key">F</span>. הסטטים, הכישורים והסטים המלאים: בוויקי.',
    f_ride_h: 'עולם פתוח אחד גדול', f_ride_p: 'מאליאה על החוף, דרך אתונה, קורינתוס ותבאי, אל נהר אכרון ולשאול. 36 ערים, 46 אזורים ב-ONLINE, ו-321 מפלצות. על סוס זה מהיר יותר.', f_ride_m: 'עוד על העולם',
    f_ride_x: 'ערים מוקפות חומה עם סוחרים, מקדשים, ספרייה נשכחת, איים ומערות. כל מקום ברמה משלו, ובכל עיר יש מה לקנות ולמי לדבר. מפת העולם המלאה נמצאת בוויקי.',
    f_story_h: 'סיפור בפרקים', f_story_p: 'שיחות עם אלים וגיבורים, בחירות, וארבעה פרקים שמובילים מהכפר הקטן עד לממלכת הדס.', f_story_m: 'עוד על הסיפור',
    f_story_x: 'הסיפור בעברית ובאנגלית, עם דיבוב טקסט ומוזיקה שנכתבה למשחק. קווסטים ראשיים ומשניים, ודמויות שחוזרות לאורך הדרך.',
    f_inv_h: 'ציוד, מסחר ותיק', f_inv_p: 'מסחר בין שחקנים עם צ\'אט, 67 נשקים וסטים של כל מקצוע, ותיק של 48 משבצות בכל לשונית.', f_inv_m: 'עוד על הציוד',
    f_inv_x: 'פריטים בדרגות נדירות עד אגדי, סטים עם בונוסים, בגדים וצבעים, וחנויות בכל עיר. ב-ONLINE אפשר לסחור עם שחקנים אחרים ולהיכנס להיכל התהילה.',
    wiki_cta: 'כל המפלצות, הנשקים, הכישורים והמקומות: לוויקי',
    shots_h: 'מהמשחק', shot_1: 'השוק באליאה', shot_2: 'קרב בשדה', shot_3: 'חוצים את נהר המתים', shot_4: 'הדרך לאתונה', shot_5: 'יצירת דמות', shot_6: 'עץ הכישורים של הקשת', shot_7: 'מסחר עם שחקן', shot_8: 'סט המלאך בקרב',
    lb_h: 'היכל התהילה', lb_sub: 'חמש הדמויות ברמה הגבוהה ביותר ב-BETA ONLINE, ואיך הן נראות.',
    lb_soon_h: 'ההיכל עוד ריק', lb_soon: 'הדמויות הראשונות יופיעו כאן ברגע שיתחילו לעלות ברמות.', lb_none: 'עוד אין כאן אף דמות. הראשונות יופיעו ברגע שיתחילו לעלות ברמות.',
    lb_load: 'טוען…', lb_rank: 'מקום', lb_lv: 'רמה', lb_since: 'מאז {d}', lb_pic: 'הדמות {n}', lb_w: { sword: 'חרב', spear: 'חנית', axe: 'גרזן', bow: 'קשת', greatbow: 'קשת גדולה', dagger: 'פגיון', wand: 'שרביט', staff: 'מטה', scythe: 'חרמש', greatsword: 'חרב דו-ידנית', greataxe: 'גרזן דו-ידני' },
    upd_h: 'עדכונים', upd_sub: '{n} גרסאות מאז 14.10.2026, החדשה למעלה. לוחצים על גרסה כדי לפתוח אותה.', upd_more: 'כל הגרסאות', upd_less: 'פחות', upd_n: '{n} שינויים', soon: 'בקרוב',
    com_comp_h: 'אפליקציית Companion', com_comp_p: 'כפר קטן שבו הדמות שלך דגה ועובדת גם כשאת/ה לא במשחק. בפיתוח.', com_h: 'קהילה', com_forum_h: 'פורום', com_forum_p: 'שאלות, בילדים, פריטים וקווסטים. אותו חשבון כמו במשחק.', com_wiki_h: 'ויקי', com_wiki_p: 'כל מפלצת, נשק, סט, כישור, סוס, אדם ומקום במשחק.', com_acc_h: 'החשבון שלך', com_acc_p: 'כניסה, הרשמה ודף שחקן עם הדרגה שלך.',
    cta_h: 'מוכנים לצאת לדרך?',
    foot: 'משחק הרפתקאות חינמי ל-Windows (ול-Mac בבטא). המשגר מתקין ומעדכן אותו.', privacy: 'פרטיות', terms: 'תנאי שימוש', releases: 'כל ההורדות', top: 'למעלה', social_x: 'X', social_ig: 'Instagram', social_fb: 'Facebook', social_soon: 'בקרוב',
  },
  en: {
    nav_menu: 'Menu', nav_game: 'The game', nav_lb: 'Hall of Fame', nav_upd: 'Updates', nav_wiki: 'Wiki', nav_forum: 'Forum', nav_account: 'Sign in', nav_dl: 'Download',
    tagline: "Val's journey to bring Roye home. A free open-world adventure through ancient Greece.",
    dl_btn: 'Download for Windows', dl_sub: 'Free · ', mac_btn: 'Download for Mac', mac_sub: 'Beta · ',
    trailer: 'Watch the trailer', ver: 'Version', mb: 'MB',
    req: 'Windows 10 or 11, 64-bit. Mac in beta. The launcher installs and updates the game by itself. <a href="#run">How does it work?</a>',
    run_h: 'Download and play', run_sub: 'Three steps. The launcher does the installing and the updating.',
    s1_h: 'Download the launcher', s1_p: `Click the download button and save ${SETUPF} (about {mb} MB). It is the only download: the launcher fetches the game itself.`,
    s2_h: 'Run it to install', s2_p: 'Double-click the file. If a blue <b>"Windows protected your PC"</b> window appears, click <span class="key">More info</span>, then <span class="key">Run anyway</span>. Pick a language and click <b>Install</b>. At the end the launcher opens by itself.',
    s3_h: 'Click INSTALL, then CAMPAIGN or ONLINE', s3_p: 'The launcher downloads and installs the game, checks every file, and from then on updates it whenever you open it. Next time, open it from the <b>The Serpent\'s Oath</b> shortcut.',
    notes_h: 'Good to know',
    n_ss_h: 'The blue Windows window', n_ss: 'The <b>"Windows protected your PC"</b> window appears because the setup isn\'t digitally signed yet. <span class="key">More info</span>, then <span class="key">Run anyway</span> continues the install.',
    n_mac_h: 'Installing on a Mac', mac_p: `Download ${MACF} (Apple silicon; <a class="intel" href="#">Intel Macs</a>), extract it and open <span class="ltr">The Serpent's Oath.app</span>. The first time, macOS asks you to confirm in System Settings › Privacy &amp; Security › <b>Open Anyway</b>, because the app is not notarized by Apple.`,
    n_upd_h: 'Updates are automatic', n_upd: 'Every time it opens, the launcher checks for a new version and downloads only the files that changed. Progress carries over. When the launcher says a newer launcher is out, download and run the setup again: it updates the launcher in place and keeps the game and your saves.',
    n_req_h: 'Requirements, saves and full screen', n_req: 'Windows 10 or 11, 64-bit. No admin rights needed: the launcher and the game install into your user folder. Uninstall from Settings › Apps.',
    n_save: 'Your saves live in <span class="path">%APPDATA%\\SerpentsOath</span>, not in the game folder.', n_full: '<span class="key">F11</span> or <span class="key">Alt+Enter</span> switches between full screen and a window.',
    n_online_h: 'How to join ONLINE', bo_p: 'Open the launcher, click the small arrow next to <span class="key">ONLINE</span>, choose <span class="key">BETA ONLINE</span>, then create an account and make your hero. The same account signs you into <a href="forum.html">the forum</a>.',
    about_h: 'The game',
    about_p1: 'Val is an ordinary woman from a small village on the Aegean coast. On the night the stars went out, a black chariot took Roye from her, and she goes after him: through walled Greek cities, mountains and caves, to the river of the dead and down into the underworld. Along the way she learns that Medusa, the creature everyone taught her to fear, is not what she seemed.',
    f_fight_h: 'Combat with weight', f_fight_p: 'Four jobs: warrior, archer, rogue and mage. Five tiers in every job, twelve weapon kinds, a flowing combo and an ultimate.', f_fight_m: 'More about combat',
    f_fight_x: 'Each weapon guards and strikes differently: sword and shield, spear, great axe, bow, dagger, wand or staff. At level 30 you swear a second oath and pick a job, and the skill tree opens along it: four jobs, five tiers each, 217 skills in all. Skills go on <span class="key">Q</span> <span class="key">E</span> <span class="key">R</span> <span class="key">X</span>, the ultimate on <span class="key">F</span>. Every stat, skill and set is in the wiki.',
    f_ride_h: 'One big open world', f_ride_p: 'From Elaia on the coast, through Athens, Corinth and Thebes, to the Acheron and the underworld. 36 towns, 46 online regions and 321 monsters. Faster on a horse.', f_ride_m: 'More about the world',
    f_ride_x: 'Walled cities with merchants and temples, a forgotten library, islands and caves. Every place has its own level, and every city has something to buy and someone to talk to. The full world map is in the wiki.',
    f_story_h: 'A story in chapters', f_story_p: 'Conversations with gods and heroes, choices, and four chapters that lead from a small village to the realm of Hades.', f_story_m: 'More about the story',
    f_story_x: 'The story is in Hebrew and English, with music written for the game. Main and side quests, and characters who return along the way.',
    f_inv_h: 'Gear, trading and the satchel', f_inv_p: 'Player-to-player trading with chat, 67 weapons and a set for every job, and a satchel of 48 slots per tab.', f_inv_m: 'More about gear',
    f_inv_x: 'Items from common to legendary, sets with bonuses, outfits and dyes, and a shop in every city. Online, trade with other players and climb into the Hall of Fame.',
    wiki_cta: 'Every monster, weapon, skill and place: open the wiki',
    shots_h: 'From the game', shot_1: 'The market in Elaia', shot_2: 'A fight in the fields', shot_3: 'Crossing the river of the dead', shot_4: 'The road to Athens', shot_5: 'Creating a character', shot_6: 'The archer\'s skill tree', shot_7: 'Trading with a player', shot_8: 'The Seraph set in combat',
    lb_h: 'Hall of Fame', lb_sub: 'The five highest-level characters in BETA ONLINE, and how they look.',
    lb_soon_h: 'The hall is still empty', lb_soon: 'The first heroes will appear here as soon as they start to level up.', lb_none: 'No heroes here yet. The first ones will appear as soon as they start to level up.',
    lb_load: 'Loading…', lb_rank: 'Rank', lb_lv: 'Level', lb_since: 'Since {d}', lb_pic: 'The character {n}', lb_w: { sword: 'Sword', spear: 'Spear', axe: 'Axe', bow: 'Bow', greatbow: 'Greatbow', dagger: 'Dagger', wand: 'Wand', staff: 'Staff', scythe: 'Scythe', greatsword: 'Greatsword', greataxe: 'Great axe' },
    upd_h: 'Updates', upd_sub: '{n} versions since 14 Oct 2026, newest first. Click a version to open it.', upd_more: 'All versions', upd_less: 'Fewer', upd_n: '{n} changes', soon: 'Coming soon',
    com_comp_h: 'Companion app', com_comp_p: 'A little village where your character fishes and works while you are away from the game. In development.', com_h: 'Community', com_forum_h: 'Forum', com_forum_p: 'Questions, builds, items and quests. The same account as in the game.', com_wiki_h: 'Wiki', com_wiki_p: 'Every monster, weapon, set, skill, mount, person and place in the game.', com_acc_h: 'Your account', com_acc_p: 'Sign in, sign up, and a player page with your rank.',
    cta_h: 'Ready to set out?',
    foot: 'A free adventure game for Windows (and Mac, in beta). The launcher installs and updates it.', privacy: 'Privacy', terms: 'Terms', releases: 'All downloads', top: 'Back to top', social_x: 'X', social_ig: 'Instagram', social_fb: 'Facebook', social_soon: 'Coming soon',
  },
  es: {
    nav_menu: 'Menú', nav_game: 'El juego', nav_lb: 'Salón de la fama', nav_upd: 'Novedades', nav_wiki: 'Wiki', nav_forum: 'Foro', nav_account: 'Entrar', nav_dl: 'Descargar',
    tagline: 'El viaje de Val para traer a Roye a casa. Una aventura gratuita de mundo abierto por la antigua Grecia.',
    dl_btn: 'Descargar para Windows', dl_sub: 'Gratis · ', mac_btn: 'Descargar para Mac', mac_sub: 'Beta · ',
    trailer: 'Ver el tráiler', ver: 'Versión', mb: 'MB',
    req: 'Windows 10 u 11, 64 bits. Mac en beta. El launcher instala y actualiza el juego solo. <a href="#run">¿Cómo funciona?</a>',
    run_h: 'Descargar y jugar', run_sub: 'Tres pasos. El launcher se encarga de instalar y actualizar.',
    s1_h: 'Descarga el launcher', s1_p: `Pulsa el botón de descarga y guarda ${SETUPF} (unos {mb} MB). Es la única descarga: el juego lo descarga el propio launcher.`,
    s2_h: 'Ejecútalo para instalar', s2_p: 'Haz doble clic en el archivo. Si aparece la ventana azul <b>«Windows protegió su PC»</b>, pulsa <span class="key">Más información</span> y luego <span class="key">Ejecutar de todas formas</span>. Elige el idioma y pulsa <b>Install</b>. Al terminar, el launcher se abre solo.',
    s3_h: 'Pulsa INSTALL y luego CAMPAIGN u ONLINE', s3_p: 'El launcher descarga e instala el juego, comprueba cada archivo y, desde entonces, lo actualiza cada vez que lo abres. La próxima vez, ábrelo desde el acceso directo <b>The Serpent\'s Oath</b>.',
    notes_h: 'Conviene saber',
    n_ss_h: 'La ventana azul de Windows', n_ss: 'La ventana <b>«Windows protegió su PC»</b> aparece porque el instalador aún no tiene firma digital. <span class="key">Más información</span> y luego <span class="key">Ejecutar de todas formas</span> continúan la instalación.',
    n_mac_h: 'Instalar en Mac', mac_p: `Descarga ${MACF} (Apple silicon; <a class="intel" href="#">Mac con Intel</a>), descomprímelo y abre <span class="ltr">The Serpent's Oath.app</span>. La primera vez, macOS te pide confirmarlo en Ajustes del Sistema › Privacidad y seguridad › <b>Abrir igualmente</b>, porque Apple no ha notarizado la app.`,
    n_upd_h: 'Las actualizaciones son automáticas', n_upd: 'Cada vez que se abre, el launcher busca una versión nueva y descarga solo los archivos que han cambiado. El progreso se conserva. Cuando el launcher avise de que hay un launcher nuevo, descarga y ejecuta otra vez el instalador: lo actualiza en su sitio y conserva el juego y tus partidas.',
    n_req_h: 'Requisitos, partidas y pantalla completa', n_req: 'Windows 10 u 11, 64 bits. No hacen falta permisos de administrador: el launcher y el juego se instalan en tu carpeta de usuario. Se desinstala desde Configuración › Aplicaciones.',
    n_save: 'Tus partidas se guardan en <span class="path">%APPDATA%\\SerpentsOath</span>, no en la carpeta del juego.', n_full: '<span class="key">F11</span> o <span class="key">Alt+Enter</span> cambia entre pantalla completa y ventana.',
    n_online_h: 'Cómo unirse a ONLINE', bo_p: 'Abre el launcher, pulsa la flechita junto a <span class="key">ONLINE</span>, elige <span class="key">BETA ONLINE</span>, y luego crea una cuenta y tu héroe. La misma cuenta sirve para <a href="forum.html">el foro</a>.',
    about_h: 'El juego',
    about_p1: 'Val es una mujer corriente de un pequeño pueblo de la costa del Egeo. La noche en que se apagaron las estrellas, un carro negro se llevó a Roye, y ella sale tras él: por ciudades griegas amuralladas, montañas y cuevas, hasta el río de los muertos y el inframundo. Por el camino descubre que Medusa, la criatura a la que todos le enseñaron a temer, no es lo que parecía.',
    f_fight_h: 'Combate con peso', f_fight_p: 'Cuatro profesiones: guerrero, arquero, pícaro y mago. Cinco rangos en cada una, doce tipos de arma, un combo fluido y una definitiva.', f_fight_m: 'Más sobre el combate',
    f_fight_x: 'Cada arma defiende y golpea de forma distinta: espada y escudo, lanza, hacha a dos manos, arco, daga, varita o bastón. Al nivel 30 juras un segundo juramento y eliges profesión, y el árbol de habilidades se abre con ella: cuatro profesiones, cinco rangos en cada una, 217 habilidades en total. Las habilidades van en <span class="key">Q</span> <span class="key">E</span> <span class="key">R</span> <span class="key">X</span> y la definitiva en <span class="key">F</span>. Cada estadística, habilidad y conjunto está en la wiki.',
    f_ride_h: 'Un gran mundo abierto', f_ride_p: 'Desde Elaia, en la costa, pasando por Atenas, Corinto y Tebas, hasta el Aqueronte y el inframundo. 36 ciudades, 46 regiones online y 321 monstruos. A caballo es más rápido.', f_ride_m: 'Más sobre el mundo',
    f_ride_x: 'Ciudades amuralladas con mercaderes y templos, una biblioteca olvidada, islas y cuevas. Cada lugar tiene su nivel y en cada ciudad hay algo que comprar y alguien con quien hablar. El mapa completo está en la wiki.',
    f_story_h: 'Una historia por capítulos', f_story_p: 'Conversaciones con dioses y héroes, decisiones y cuatro capítulos que llevan de un pequeño pueblo al reino de Hades.', f_story_m: 'Más sobre la historia',
    f_story_x: 'La historia está en hebreo e inglés, con música compuesta para el juego. Misiones principales y secundarias, y personajes que vuelven a lo largo del camino.',
    f_inv_h: 'Equipo, comercio y zurrón', f_inv_p: 'Comercio entre jugadores con chat, 67 armas y un conjunto por profesión, y un zurrón de 48 casillas por pestaña.', f_inv_m: 'Más sobre el equipo',
    f_inv_x: 'Objetos de comunes a legendarios, conjuntos con bonificaciones, atuendos y tintes, y una tienda en cada ciudad. Online, comercia con otros jugadores y sube al salón de la fama.',
    wiki_cta: 'Todos los monstruos, armas, habilidades y lugares: abre la wiki',
    shots_h: 'Del juego', shot_1: 'El mercado de Elaia', shot_2: 'Una pelea en el campo', shot_3: 'Cruzando el río de los muertos', shot_4: 'El camino a Atenas', shot_5: 'Crear un personaje', shot_6: 'El árbol de habilidades del arquero', shot_7: 'Comercio con un jugador', shot_8: 'El conjunto Serafín en combate',
    lb_h: 'Salón de la fama', lb_sub: 'Los cinco personajes de mayor nivel de BETA ONLINE, y su aspecto.',
    lb_soon_h: 'El salón aún está vacío', lb_soon: 'Los primeros héroes aparecerán aquí en cuanto empiecen a subir de nivel.', lb_none: 'Aún no hay ningún héroe. Los primeros aparecerán en cuanto empiecen a subir de nivel.',
    lb_load: 'Cargando…', lb_rank: 'Puesto', lb_lv: 'Nivel', lb_since: 'Desde el {d}', lb_pic: 'El personaje {n}', lb_w: { sword: 'Espada', spear: 'Lanza', axe: 'Hacha', bow: 'Arco', greatbow: 'Gran arco', dagger: 'Daga', wand: 'Varita', staff: 'Bastón', scythe: 'Guadaña', greatsword: 'Espadón', greataxe: 'Gran hacha' },
    upd_h: 'Novedades', upd_sub: '{n} versiones desde el 14 oct 2026, la más reciente primero. Pulsa una versión para abrirla.', upd_more: 'Todas las versiones', upd_less: 'Menos', upd_n: '{n} cambios', soon: 'Próximamente',
    com_comp_h: 'App Companion', com_comp_p: 'Una pequeña aldea donde tu personaje pesca y trabaja mientras estás fuera del juego. En desarrollo.', com_h: 'Comunidad', com_forum_h: 'Foro', com_forum_p: 'Preguntas, builds, objetos y misiones. La misma cuenta que en el juego.', com_wiki_h: 'Wiki', com_wiki_p: 'Cada monstruo, arma, conjunto, habilidad, montura, persona y lugar del juego.', com_acc_h: 'Tu cuenta', com_acc_p: 'Entrar, registrarse y una página de jugador con tu rango.',
    cta_h: '¿Todo listo para partir?',
    foot: 'Un juego de aventuras gratuito para Windows (y Mac, en beta). El launcher lo instala y lo actualiza.', privacy: 'Privacidad', terms: 'Condiciones', releases: 'Todas las descargas', top: 'Volver arriba', social_x: 'X', social_ig: 'Instagram', social_fb: 'Facebook', social_soon: 'Próximamente',
  },
};
window.T = T;

const SITE = window.SITE || {}, UPDATES = Array.isArray(window.UPDATES) ? window.UPDATES : [];
let L = SoLang.pick();
const R = (s) => (L === 'he' ? '\u200f' : '') + s; // Hebrew text under unicode-bidi: plaintext starts with an RLM
const latest = UPDATES.find((u) => !u.upcoming && u.v);

// ---------- the social links in the footer: the URL from SITE.SOCIAL; an empty one shows the icon as not linked yet ----------
document.querySelectorAll('.social a[data-social]').forEach((a) => {
  const url = (SITE.SOCIAL || {})[a.dataset.social];
  if (url) { a.href = url; a.target = '_blank'; } else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.classList.add('off'); }
});

// ---------- download buttons ----------
document.querySelectorAll('.dlbtn').forEach((a) => { a.href = SITE.LAUNCHER_URL || '#'; });
document.querySelectorAll('.macbtn').forEach((a) => { if (SITE.MAC_URL) a.href = SITE.MAC_URL; else a.hidden = true; });
document.querySelectorAll('.winsz').forEach((s) => { s.textContent = SITE.LAUNCHER_MB ? `${SITE.LAUNCHER_MB} MB` : ''; });
document.querySelectorAll('.macsz').forEach((s) => { s.textContent = SITE.MAC_MB ? `${SITE.MAC_MB} MB` : ''; });

// ---------- the top bar ----------
(() => {
  const nav = $('#mainnav');
  // the current section, underlined in the bar
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const secs = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) for (const a of links) { if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
    }, { rootMargin: '-40% 0px -55% 0px' });
    secs.forEach((s) => io.observe(s));
  }
})();

// ---------- the hero video: a still on slow connections or when motion is reduced ----------
(() => {
  const hero = $('.hero'), v = $('#bgv');
  const slow = navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || ''));
  if (slow || matchMedia('(prefers-reduced-motion: reduce)').matches) { hero.classList.add('lite'); v.removeAttribute('autoplay'); v.pause(); }
})();

// ---------- the feature strips ----------
const FEATS = [
  { k: 'fight', icon: 'assets/pi-sword.png' }, { k: 'ride', icon: 'assets/pi-horse.png' },
  { k: 'story', icon: 'assets/pi-scroll.png' }, { k: 'inv', icon: 'assets/pi-compass.png' },
];
const CLIP = { fight: 'clip-fight', ride: 'clip-ride', story: 'clip-story', inv: 'clip-inventory' };
function feats() {
  const box = $('#feats'); box.textContent = '';
  for (const f of FEATS) {
    const art = el('article', 'feat'), fv = el('div', 'fv'), v = el('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.poster = `assets/${CLIP[f.k]}.jpg`; v.setAttribute('aria-hidden', 'true');
    for (const [ext, type] of [['webm', 'video/webm'], ['mp4', 'video/mp4']]) { const s = el('source'); s.src = `assets/${CLIP[f.k]}.${ext}`; s.type = type; v.append(s); }
    const pp = el('button', 'pp'); pp.type = 'button'; pp.setAttribute('aria-pressed', 'true'); pp.append(el('i')); pp.setAttribute('aria-label', 'Pause');
    pp.addEventListener('click', () => { if (v.paused) { v.play(); pp.setAttribute('aria-pressed', 'true'); } else { v.pause(); pp.setAttribute('aria-pressed', 'false'); } });
    fv.append(v, pp);
    const ft = el('div', 'ft'), ic = el('img', 'ico'); ic.src = f.icon; ic.alt = ''; ic.width = 30; ic.height = 30;
    const d = el('details', 'acc'), sm = el('summary'), bd = el('div', 'body'), p = el('p');
    sm.dataset.t = `f_${f.k}_m`; p.dataset.h = `f_${f.k}_x`; bd.append(p); d.append(sm, bd);
    const h = el('h3'); h.dataset.t = `f_${f.k}_h`; const pp2 = el('p'); pp2.dataset.t = `f_${f.k}_p`;
    ft.append(ic, h, pp2, d);
    art.append(fv, ft); box.append(art);
    // plays only while on screen
    if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      new IntersectionObserver((es) => { for (const e of es) { if (e.isIntersecting && pp.getAttribute('aria-pressed') === 'true') v.play().catch(() => {}); else v.pause(); } }, { threshold: .35 }).observe(fv);
    } else pp.setAttribute('aria-pressed', 'false');
  }
}
feats();

// ---------- the screenshots ----------
function shots() {
  const g = $('#shotgrid'); g.textContent = '';
  for (let i = 1; i <= 8; i++) {
    const fig = el('figure', 'shot'), b = el('button'), im = el('img'), cap = el('figcaption');
    b.type = 'button'; im.src = `assets/shot-${i}.jpg`; im.loading = 'lazy'; im.width = 1280; im.height = 720; im.alt = '';
    cap.dataset.t = `shot_${i}`; b.append(im); fig.append(b, cap); g.append(fig);
    b.addEventListener('click', () => view('img', `assets/shot-${i}.jpg`));
  }
}
shots();

// ---------- the viewer: trailer and screenshots ----------
const viewer = $('#viewer'), vbody = $('#vbody');
function view(kind, src) {
  vbody.textContent = '';
  if (kind === 'video') {
    const v = el('video'); v.controls = true; v.autoplay = true; v.playsInline = true; v.poster = 'assets/hero.jpg';
    for (const [ext, type] of [['webm', 'video/webm'], ['mp4', 'video/mp4']]) { const s = el('source'); s.src = `${src}.${ext}`; s.type = type; v.append(s); }
    vbody.append(v);
  } else { const im = el('img'); im.src = src; im.alt = ''; vbody.append(im); }
  if (typeof viewer.showModal === 'function') viewer.showModal(); else viewer.setAttribute('open', '');
}
function unview() { vbody.textContent = ''; if (viewer.open) viewer.close(); }
$('#vclose').addEventListener('click', unview);
viewer.addEventListener('click', (e) => { if (e.target === viewer) unview(); });
viewer.addEventListener('close', () => { vbody.textContent = ''; });
// the trailer: the launcher's cinematic (assets/trailer.webm/.mp4) when it is there, else the hero clip
$('#trailer-btn').addEventListener('click', () => view('video', SITE.TRAILER || 'assets/hero'));

// ---------- the hall of fame ----------
const LB = { state: 'off', list: [] };
const WEAPON_ICON = { sword: 'assets/pi-sword.png', spear: 'assets/pi-spear.png', axe: 'assets/pi-axe.png' };
function heroRow(r) {
  if (!r || typeof r !== 'object') return null;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 40) : '', level = Math.floor(Number(r.level));
  if (!name || !Number.isFinite(level) || level < 1) return null;
  let png = typeof r.portrait_png_base64 === 'string' ? r.portrait_png_base64.replace(/^data:image\/png;base64,/, '').replace(/\s+/g, '') : '';
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(png)) png = '';
  const at = r.reached_at ? new Date(r.reached_at) : null;
  return { name, level, weapon: typeof r.weapon === 'string' ? r.weapon.trim().toLowerCase().slice(0, 24) : '', png, at: at && !isNaN(at) ? at : null };
}
async function loadHeroes() {
  const url = String(SITE.SUPABASE_URL || '').trim().replace(/\/+$/, ''), key = String(SITE.ANON_KEY || '').trim();
  if (!url || !key) return;
  LB.state = 'busy'; heroes();
  const ac = 'AbortController' in window ? new AbortController() : null, stop = setTimeout(() => ac?.abort(), 8000);
  try {
    const res = await fetch(url + '/rest/v1/rpc/leaderboard_top', {
      method: 'POST', cache: 'no-store', signal: ac?.signal,
      // a publishable key goes in apikey alone; a legacy anon key (a JWT) also as the bearer
      headers: { apikey: key, ...(/^eyJ/.test(key) ? { Authorization: 'Bearer ' + key } : {}), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_limit: 5 }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('not a list');
    LB.list = data.map(heroRow).filter(Boolean).slice(0, 5);
    LB.state = 'ok';
  } catch (e) { LB.state = 'off'; LB.list = []; }
  clearTimeout(stop);
  heroes();
}
function silhouette() { const d = el('div', 'sil'); d.setAttribute('aria-hidden', 'true'); return d; }
function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function heroes() {
  const t = T[L], box = $('#lb'); box.textContent = '';
  box.setAttribute('aria-busy', String(LB.state === 'busy'));
  if (LB.state === 'ok' && LB.list.length) {
    // the podium: 2, 1, 3, 4, 5 from left to right on wide screens
    const ol = el('ol', 'lb');
    const order = LB.list.length >= 3 ? [1, 0, 2, 3, 4] : [0, 1, 2, 3, 4];
    for (const i of order) {
      const h = LB.list[i]; if (!h) continue;
      const li = el('li', 'hc panel' + (i ? '' : ' r1')), pt = el('div', 'pt'), rk = el('span', 'rk', String(i + 1));
      rk.setAttribute('aria-hidden', 'true');
      li.append(el('span', 'sr', `${t.lb_rank} ${i + 1}: `), rk);
      if (h.png) {
        const img = el('img'); img.alt = t.lb_pic.replace('{n}', h.name); img.decoding = 'async';
        img.addEventListener('error', () => img.replaceWith(silhouette()), { once: true });
        img.src = 'data:image/png;base64,' + h.png; pt.append(img);
      } else pt.append(silhouette());
      const nm = el('p', 'nm', h.name); nm.title = h.name;
      const lv = el('p', 'lv'); lv.append(el('span', '', t.lb_lv), el('b', '', String(h.level)));
      li.append(pt, nm, lv);
      if (h.weapon) {
        const wp = el('span', 'wp'), icon = WEAPON_ICON[h.weapon];
        if (icon) { const im = el('img'); im.src = icon; im.alt = ''; im.width = 18; im.height = 18; wp.append(im); }
        wp.append(el('span', '', t.lb_w[h.weapon] || h.weapon)); li.append(wp);
      }
      if (h.at) { const iso = isoOf(h.at), tm = el('time', '', SoLang.fmt(iso, L)); tm.dateTime = iso; const p = el('p', 'since'), [a, b] = t.lb_since.split('{d}'); p.append(a, tm, b || ''); li.append(p); }
      ol.append(li);
    }
    box.append(ol); return;
  }
  const wrap = el('div', 'lb-empty panel' + (LB.state === 'busy' ? ' busy' : '')), gh = el('ol', 'ghosts');
  gh.setAttribute('aria-hidden', 'true');
  for (let i = 1; i <= 5; i++) { const li = el('li'), pt = el('div', 'pt' + (i === 1 ? ' g1' : '')); pt.append(silhouette()); li.append(pt); gh.append(li); }
  wrap.append(gh);
  if (LB.state === 'busy') wrap.append(el('p', '', t.lb_load));
  else wrap.append(el('h3', '', R(t.lb_soon_h)), el('p', '', R(LB.state === 'ok' ? t.lb_none : t.lb_soon)));
  box.append(wrap);
}

// ---------- the updates timeline ----------
let showAll = false;
const FIRST = 6;
function updates() {
  const t = T[L], log = $('#log'), more = $('#upd-more'); log.textContent = '';
  const list = showAll ? UPDATES : UPDATES.slice(0, FIRST);
  let firstReal = true;
  list.forEach((u, i) => {
    const x = u[L] || u.en; if (!x) return;
    const d = el('details', 'upd' + (u.upcoming ? ' soon' : firstReal ? ' latest' : ''));
    if (!u.upcoming) firstReal = false;
    if (i === 0 || (i === 1 && list[0].upcoming)) d.open = true;
    const sm = el('summary'), v = el('span', 'v', u.v ? 'v' + u.v : '·'), tt = el('div', 'tt'), h = el('h3', '', x.title);
    tt.append(h);
    if (u.upcoming) tt.append(el('span', 'soonl', t.soon));
    else if (u.date) { const tm = el('time', '', SoLang.fmt(u.date, L)); tm.dateTime = u.date; tt.append(tm); }
    sm.append(v, tt, el('span', 'cnt', t.upd_n.replace('{n}', String((x.items || []).length))));
    const ul = el('ul'); for (const it of x.items || []) ul.append(el('li', '', R(it)));
    d.append(sm, ul); log.append(d);
  });
  more.hidden = UPDATES.length <= FIRST;
  more.querySelector('span').textContent = showAll ? t.upd_less : t.upd_more;
}
$('#upd-more').addEventListener('click', () => { showAll = !showAll; updates(); if (!showAll) $('#updates').scrollIntoView({ block: 'start' }); });

// ---------- language ----------
function draw() {
  SoLang.show(L);
  const t = T[L];
  SoLang.fill(T, L, { mb: SITE.LAUNCHER_MB || '' });
  document.querySelectorAll('.intel').forEach((a) => { a.href = SITE.MAC_INTEL_URL || SITE.MAC_URL || '#'; });
  const meta = $('#meta'); meta.textContent = '';
  if (latest) { meta.append(`${t.ver} `); meta.append(el('b', 'ltr', latest.v)); if (latest.date) { const tm = el('time', '', SoLang.fmt(latest.date, L)); tm.dateTime = latest.date; meta.append(' · ', tm); } }
  $('#upd-sub').textContent = R(t.upd_sub).replace('{n}', String(UPDATES.filter((u) => !u.upcoming).length));
  document.title = { he: 'The Serpent\'s Oath · הרפתקה בפיקסל-ארט ביוון העתיקה', en: 'The Serpent\'s Oath · Free pixel-art adventure in ancient Greece', es: 'The Serpent\'s Oath · Aventura en pixel art por la antigua Grecia' }[L];
  updates(); heroes();
}
SoLang.mount((nl) => { L = nl; draw(); });
draw();
loadHeroes();
})();

// the top bar is see-through over the hero video and turns darker once the page scrolls past the top
(() => { const b = document.querySelector('.bar'); if (!b) return; const f = () => b.classList.toggle('solid', scrollY > innerHeight * .6); addEventListener('scroll', f, { passive: true }); f(); })();
