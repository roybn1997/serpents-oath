// BETA ONLINE: the starter axe (Roy 26.10: the creator offers sword, spear or axe, and the game had no level-1 axe; the
// first was the Minoan labrys at level 7). Online only: its record is added to the game's weapons at run time, in online
// mode, so no campaign shop, drop or list ever sees it. Its model is weapons.js BUILD.village_axe (the village smithy's
// one-handed bearded axe, bronze on ash, in the village spear's colours), held like a sword ('blade' style, one hand).
// Its numbers follow the sword's at the same level (the shared damage formula): a little slower and harder per blow.
import { WEAPONS, registerWeapon } from '../weapons.js';
import { HEIRLOOMS } from '../catalog.js';

export const AXE_ID = 'village_axe';
export function registerStarterAxe() {
  // a keepsake like the village spear and blade (catalog.js HEIRLOOMS): kept as it is, never turned into a catalog item
  // when a save is loaded (migrateId), and counted as a one-handed axe (axe1: its cleave, its shield beside it)
  HEIRLOOMS[AXE_ID] ||= { cat: 'axe1', family: 'hunter' };
  if (WEAPONS[AXE_ID]) return WEAPONS[AXE_ID];
  return registerWeapon({
    id: AXE_ID, style: 'blade', tier: 1, rarity: 'common', minLevel: 1, dmg: 12, authDmg: 12, speed: .92, reach: 2.25, crit: .07,
    element: null, trail: ['#f4e2b8', '#a8702e'], special: null, specials: [], dps: 11, twoHanded: false, shield: 'round', online: true,
    name: { he: 'גרזן הכפר', en: 'Village Axe', es: 'Hacha de la aldea' },
    desc: {
      he: 'גרזן יד מהנפחייה של הכפר: להב ארד עם זקן קטן על ידית של עץ אפר. כבד קצת יותר מחרב, ונוחת חזק יותר.',
      en: 'A hand axe from the village smithy: a bearded bronze bit on an ash haft. A little heavier than a sword, and it lands harder.',
      es: 'Un hacha de mano de la herrería de la aldea: hoja de bronce con barba sobre un mango de fresno. Algo más pesada que una espada, y golpea más fuerte.',
    },
    source: { he: 'הנשק שאיתו יוצאים לדרך', en: 'The weapon you set out with', es: 'El arma con la que partes' },
  });
}
