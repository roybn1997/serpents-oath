// BETA ONLINE: the character creator's choices (spec 6.3), as stable ids. The server keeps the same list
// (server/supabase/migrations/*_phase_cd.sql valid_appearance); server/supabase/test/db.test.mjs checks they agree.
// Pure data and pure functions: node can import it. Display names live in js/online/strings.js.
//   body     f | m
//   hair     3 per body               skin  4, shared by both bodies (Roy 29.10: pale first, dark last)
//   hair_color  teal | black | brown | auburn | blonde | white, for both (Roy 26.10 18:50; optional on the server: a look
//               stored without one has its body's default, teal for a woman as Val, black for a man)
//   outfit   3 per body (Roy 29.10: "no Dress / Battle dress": three simple ones, the white one, light-brown leather, dark cloth)
//   eyes     round | almond | narrow  eye_color  brown | blue | green (Roy 29.10; both optional on the server: a look stored
//            without them has round eyes, blue as Val's)
//   weapon   sword | spear | axe      (no shield: one can be bought in the world later)

export const BODIES = ['f', 'm'];
export const HAIRS = { f: ['f_braids', 'f_bun', 'f_loose'], m: ['m_crop', 'm_curls', 'm_locks'] };
export const OUTFITS = { f: ['f_white_dress', 'f_leather_dress', 'f_dark_dress'], m: ['m_white_chiton', 'm_leather_chiton', 'm_dark_chiton'] };
export const SKINS = ['skin_1', 'skin_2', 'skin_3', 'skin_4'];
export const EYES = ['round', 'almond', 'narrow'];
export const EYE_COLORS = ['brown', 'blue', 'green'];
export const EYE_DEFAULT = { eyes: 'round', eye_color: 'blue' };
// the iris of each eye colour (blue: Val's own, models.js makeV)
export const EYE_HEX = { brown: '#5a3820', blue: '#2a5e9c', green: '#3a7a52' };
// Roy 29.10: the battle dress / battle kit are no longer a choice: a look stored with one wears the dark cloth instead (the
// black one's nearest), on the server too (migrations/20261107150000_creator_looks.sql rewrites the stored rows)
export const LEGACY_OUTFIT = { f_battle_dress: 'f_dark_dress', m_battle_kit: 'm_dark_chiton' };
export const WEAPONS = ['sword', 'spear', 'axe'];
export const HAIR_COLORS = ['teal', 'black', 'brown', 'auburn', 'blonde', 'white'];
export const HAIR_DEFAULT = { f: 'teal', m: 'black' };

// the order the creator shows the skins in (Roy 29.10: exactly four, "Pale" first, "Dark" last): Val's own light tone first
// (it is the default), then tan, brown, dark (skin_4 is new, between tan and the old deep tone, which is a shade darker now)
export const SKIN_ORDER = ['skin_2', 'skin_1', 'skin_4', 'skin_3'];
// the skins' colours (the rig's skin; the face is painted from it). skin_2 is Val's own (models.js makeV)
export const SKIN_HEX = { skin_1: '#cf9a74', skin_2: '#f0cbb4', skin_4: '#a87250', skin_3: '#7a4c30' };
// each hair colour: six shades dark to light, standing in for the six of Val's teal (pxart.js PAL.hair) wherever her rig
// paints its hair, the base colour the townsfolk kit shapes other hairstyles from, and the brows
export const HAIR_TONES = {
  teal: { base: '#33cbbd', brow: '#1d6a80', shades: null }, // (Val's own: her rig as it is)
  black: { base: '#2a1d16', brow: '#1a120e', shades: ['#08060a', '#140e10', '#211816', '#30241e', '#46362c', '#62503f'] },
  brown: { base: '#6a4428', brow: '#3a2416', shades: ['#1c0f08', '#341d10', '#4f2e19', '#6b4226', '#8d5a36', '#b27e54'] },
  auburn: { base: '#a03c22', brow: '#5a1e12', shades: ['#2a0a06', '#4e160c', '#782614', '#a03a20', '#c8583a', '#e8845e'] },
  blonde: { base: '#d8b058', brow: '#8a6424', shades: ['#5a3e14', '#8a6424', '#b88e3e', '#dcb45a', '#f0d488', '#fff0c0'] },
  white: { base: '#dcd8de', brow: '#a8a2aa', shades: ['#5e5a64', '#8a8590', '#b4b0b8', '#d6d3d9', '#ecebee', '#ffffff'] },
};
export const hairColorOf = (a) => (HAIR_COLORS.includes(a?.hair_color) ? a.hair_color : HAIR_DEFAULT[a?.body] || 'teal');
// the game's items behind the choices: the weapon in hand, and the body-slot outfit worn (weapons.js OUTFITS: 'home' is
// Val's white dress, 'war' her black battle dress; a man's rig has the matching white chiton and battle kit)
export const WEAPON_ITEM = { sword: 'village_blade', spear: 'village_spear', axe: 'village_axe' };
// (Roy 29.10: three outfits, the white one ('home') and two simple ones cut the same, models.js setDress 'leather' / 'dark';
// each is its own body-slot item, weapons.js OUTFIT. 'battle_dress' is no creation outfit any more: a world that still holds
// it gets the dark one in its place, play.js onlineSave)
export const OUTFIT_DRESS = { f_white_dress: 'home', f_leather_dress: 'leather', f_dark_dress: 'dark', m_white_chiton: 'home', m_leather_chiton: 'leather', m_dark_chiton: 'dark' };
export const OUTFIT_ITEM = { home: 'val_dress', leather: 'leather_chiton', dark: 'dark_chiton' };
export const LEGACY_OUTFIT_ITEM = { battle_dress: 'dark_chiton' };

// Val's look: the creator's default (spec 6.1: her white dress and the sword, no shield)
export const VAL_LOOK = Object.freeze({ body: 'f', hair: 'f_braids', hair_color: 'teal', skin: 'skin_2', eyes: 'round', eye_color: 'blue', outfit: 'f_white_dress', weapon: 'sword' });

export function validAppearance(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
  if (!SKINS.includes(a.skin) || !WEAPONS.includes(a.weapon) || !BODIES.includes(a.body)) return false;
  if (a.hair_color !== undefined && !HAIR_COLORS.includes(a.hair_color)) return false;
  if (a.eyes !== undefined && !EYES.includes(a.eyes)) return false;
  if (a.eye_color !== undefined && !EYE_COLORS.includes(a.eye_color)) return false;
  return HAIRS[a.body].includes(a.hair) && OUTFITS[a.body].includes(a.outfit);
}
export const eyesOf = (a) => (EYES.includes(a?.eyes) ? a.eyes : EYE_DEFAULT.eyes);
export const eyeColorOf = (a) => (EYE_COLORS.includes(a?.eye_color) ? a.eye_color : EYE_DEFAULT.eye_color);
// only the known keys, as the server stores them (the hair colour and the eyes always written out)
export const cleanAppearance = (a) => ({ body: a.body, hair: a.hair, hair_color: hairColorOf(a), skin: a.skin, eyes: eyesOf(a), eye_color: eyeColorOf(a), outfit: a.outfit, weapon: a.weapon });
// a look stored before Roy 29.10 (the battle dress / kit): the same look in the dark cloth
export const upgradeAppearance = (a) => (a && typeof a === 'object' && LEGACY_OUTFIT[a.outfit] ? { ...a, outfit: LEGACY_OUTFIT[a.outfit] } : a);
// a stored look that is somehow not valid (an older id, a hand-edited row): shown as Val's, never as nothing
export const safeAppearance = (a) => { a = upgradeAppearance(a); return validAppearance(a) ? cleanAppearance(a) : { ...VAL_LOOK }; };

// switching the body keeps what carries over: the same position in the hair and outfit lists (spec 6.3: "switching
// gender selects valid hair and clothing for that gender"; skin and weapon stay as they are)
export function withBody(a, body) {
  if (a.body === body) return { ...a };
  const hi = Math.max(0, HAIRS[a.body]?.indexOf(a.hair) ?? 0), oi = Math.max(0, OUTFITS[a.body]?.indexOf(a.outfit) ?? 0);
  const hc = hairColorOf(a) === HAIR_DEFAULT[a.body] ? HAIR_DEFAULT[body] : hairColorOf(a); // (a colour chosen stays; the default follows the body)
  return { ...a, body, hair: HAIRS[body][hi] || HAIRS[body][0], hair_color: hc, outfit: OUTFITS[body][oi] || OUTFITS[body][0] };
}
// the creator's rows, in order: [key, the choices for this look]
export const ROWS = (a) => [['body', BODIES], ['hair', HAIRS[a.body]], ['hair_color', HAIR_COLORS], ['skin', SKIN_ORDER], ['eyes', EYES], ['eye_color', EYE_COLORS], ['outfit', OUTFITS[a.body]], ['weapon', WEAPONS]];
// one step along a row (wrapping), as the arrow keys do
export function step(a, key, d) {
  const list = ROWS(a).find(([k]) => k === key)?.[1]; if (!list) return a;
  const i = list.indexOf(a[key]), v = list[((i < 0 ? 0 : i) + d + list.length) % list.length];
  return key === 'body' ? withBody(a, v) : { ...a, [key]: v };
}

// THE ONLINE SPAWN (Roy 26.10 18:21), the one place to change it: where and with what a new online character starts.
// near / at: the hamlet laid out just outside Elaia's wall for it online (poi.js startHamlet, Roy 27.10: "next to Elaia"),
// else the hamlet (poi.js planHamlets: a few farms, a well, a shrine) nearest Elaia, if one
// stands within `within` metres of it; else a clear spot on the road `fallback` metres out of Elaia (play.js onlineSpawn).
// skills: none: no Dash (the campaign's 'charge'), only the basic attack; the tutorial phase hands them out later.
// The server keeps the same entry (private.online_config 'start', migrations/*_phase_cd.sql) and gives the same skills.
export const START = { near: 'elaia', at: 'hamlet', within: 1500, fallback: 320, skills: [] };
