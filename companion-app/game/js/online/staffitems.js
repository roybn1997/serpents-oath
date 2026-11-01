// BETA ONLINE, STAFF (Roy 31.10): the SERAPH set's catalog entries (js/online/staff.js has the rules and the commands;
// staffgear.js the models). Apart so that a picture of a hero (heroes.js: the select, the Hall of Fame) can draw the set
// without the game's rules: registerStaffItems() is all it takes, and it registers once.
import { WEAPONS } from '../weapons.js';
import { BASES, IMPACTS, EQUIP_TEXT, resolve, makeId } from '../catalog.js';
import { registerStaffModels } from './staffgear.js';

export const L3 = (he, en, es) => ({ he, en, es: es ?? en });
export const ONLY = L3('רק GM או אדמין יכולים ללבוש את זה.', 'Only a GM or an admin can wear this.', 'Solo un GM o un admin puede llevar esto.');
// the set: [id, catalog category, name, description]
export const STAFF_SET = [
  ['sa_staff_halo', 'helmet', L3('הילת השרף', "Seraph's Halo", 'Aureola del Serafín'),
    L3('נזר זהב עם כנפיים קטנות ברקות, וטבעת של אור שמרחפת מעל הראש ומסתובבת לאט.', 'A gold circlet with small wings at the temples, and a ring of light that floats over the head, slowly turning.', 'Una diadema de oro con pequeñas alas en las sienes y un anillo de luz que flota sobre la cabeza, girando despacio.')],
  ['sa_staff_robe', 'body', L3('גלימת האור של השרף', "Seraph's Robe of Light", 'Túnica de luz del Serafín'),
    L3('שריון לבן וזהב מעל גלימה לבנה ארוכה, כתפיות של נוצות זהב, כוכב בוער על החזה ופסים של אור.', 'White and gold plate over a long white robe, pauldrons of gold feathers, a burning star on the breast and lines of light.', 'Placas blancas y doradas sobre una larga túnica blanca, hombreras de plumas de oro, una estrella ardiente en el pecho y líneas de luz.')],
  ['sa_staff_sandals', 'boots', L3('סנדלי השרף', "Seraph's Sandals", 'Sandalias del Serafín'),
    L3('מגני שוק לבנים, ברכי זהב וכנף של נוצות בכל קרסול. הצעדים לא נוגעים בעפר.', 'White greaves, golden knees and a feathered wing at each ankle. Her steps never touch the dust.', 'Grebas blancas, rodillas de oro y un ala de plumas en cada tobillo. Sus pasos nunca tocan el polvo.')],
  ['sa_staff_wings', 'wings', L3('כנפי השרף', "Seraph's Wings", 'Alas del Serafín'),
    L3('כנפיים ענקיות של נוצות לבנות בשולי זהב, ואור רך זורם לאורך הקצוות. הגדולות שבכנפיים.', 'Huge wings of white feathers rimmed in gold, soft light running along their edges. The greatest wings of all.', 'Alas enormes de plumas blancas con bordes de oro y una luz suave a lo largo de sus bordes. Las alas más grandes de todas.')],
  ['sa_staff_blades', 'dualSword', L3('להבי האור התאומים', 'Twin Blades of Light', 'Espadas gemelas de luz'),
    L3('שני להבים של אור טהור, ליבה לבנה ולוהטת והילה רכה סביבה, ניצב של כנפי זהב. להב בכל יד.', 'Two blades of pure light, a white-hot core in a soft glow, a guard of golden wings. A blade in each hand.', 'Dos hojas de luz pura, un núcleo blanco y ardiente en un suave resplandor, una guarda de alas doradas. Una hoja en cada mano.')],
];
export const STAFF_IDS = STAFF_SET.map(([id]) => id);
export const STAFF_LEVEL = 300;
export const isStaffItem = (id) => typeof id === 'string' && /^sa_staff_/.test(id);
// the id she gets of each (Legendary, the only grade they come in)
export const staffGiveId = (base) => makeId(base, STAFF_LEVEL, 2);

// ------------------------------------------------------------------------------------------------ the catalog
let registered = false;
export function registerStaffItems() {
  if (registered) return; registered = true;
  registerStaffModels();
  for (const [id, cat, name, desc] of STAFF_SET) {
    if (BASES[id]) continue;
    BASES[id] = { id, kind: 'staff', staffOnly: true, setId: null, cat, lvl: STAFF_LEVEL, max: STAFF_LEVEL, family: cat === 'dualSword' ? 'olympian' : null,
      name, desc: L3(`${desc.he} ${ONLY.he}`, `${desc.en} ${ONLY.en}`, `${desc.es} ${ONLY.es}`), quality: 1, tilt: cat === 'wings' ? { defense: 1.2 } : {}, noRoll: true, flight: cat === 'wings' ? true : undefined };
    for (const gr of [0, 1, 2]) {
      const x = resolve(makeId(id, STAFF_LEVEL, gr)); if (!x) continue;
      Object.assign(x, { gift: true, staffOnly: true, legendaryOnly: true, source: L3('לצוות המשחק בלבד (GM / אדמין)', 'For the game\'s staff only (GM / admin)', 'Solo para el staff del juego (GM / admin)') });
      if (WEAPONS[x.id] === x) x.trail = ['#ffffff', '#ffe27a'];
    }
    if (cat === 'dualSword') IMPACTS[id] = { id, motif: 'olympian', shape: 'cross', colors: ['#ffffff', '#ffe27a', '#cfe8ff'], variant: 1, spin: 1, scale: 1.4 };
  }
  EQUIP_TEXT.staffOnly = ONLY;
}
