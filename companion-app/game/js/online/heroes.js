// BETA ONLINE: an online character's body, from its appearance ids (js/online/appearance.js). The game's own rigs, never
// a look-alike: a woman is Val's rig itself (models.js makeV, with the chosen skin; her braids, or a bun or loose hair in
// the same teal), a man is the shared humanoid rig dressed from the townsfolk kit (cast.js) to the same finish. Both
// carry the two outfits as Val does (warParts / homeParts, models.js setDress): the white one ('home': Val's dress, or a
// man's white chiton with the same sea-blue key and saffron himation) and the battle one ('war': her black battle dress,
// or a dark leather kit with the same gold neckline, studs, pteruges and bracers: worn under body armour). So the game's
// gear code (helmets, sockets, the body-slot outfits) works on both, and Val herself is never changed. Roy 29.10: the
// creator's three outfits are the white one and the same cut in light-brown leather or dark cloth ('leather' / 'dark').
// No shield (spec 6.3): the shield slot is given and left empty (models.js equipShield), so no weapon brings one.
import * as THREE from '../three.module.min.js';
import { humanoid, makeV, setDress, equipWeapon, equipGear, finish, pivot, box, ball, tcyl, animateRig, armIK, aimHand } from '../models.js';
import { addOutline } from '../render.js';
import * as C from '../cast.js';
import { WEAPONS, GEAR, makeWeapon, makeGearModel, forgedWeapon, itemOf } from '../weapons.js';
import { PAL } from '../pxart.js';
import { SKIN_HEX, HAIR_TONES, hairColorOf, WEAPON_ITEM, OUTFIT_DRESS, OUTFIT_ITEM, LEGACY_OUTFIT_ITEM, EYE_HEX, eyesOf, eyeColorOf, safeAppearance } from './appearance.js';
import { registerStarterAxe } from './axe.js';
import { registerStaffItems } from './staffitems.js'; // (STAFF, Roy 31.10: a staff hero's Seraph set is drawn in her pictures too)

const PI = Math.PI;
// the parts a builder adds: every new object whose parent was already there
function track(r, fn) {
  const before = new Set(); r.root.traverse((o) => before.add(o));
  fn();
  const out = []; r.root.traverse((o) => { if (!before.has(o) && before.has(o.parent)) out.push(o); });
  return out;
}
const outline = (o) => addOutline(o, (m) => !m.castShadow || m.material.isMeshBasicMaterial);

// ---- hair colours (Roy 26.10 18:50): Val's rig paints her hair from the six teal shades of pxart.js PAL.hair (and, in the
// plain look, three teal colours); a hero with another colour gets copies of exactly those materials and textures with each
// teal shade swapped for the same shade of the chosen colour, texel for texel. Nothing else of hers is touched (the sea-blue
// of her dress and her eyes are other colours), and the shared materials are never changed.
const VAL_PLAIN = { '#33cbbd': 3, '#1f9a90': 2, '#5ee0d2': 4 }, VAL_BROW = '#1d6a80';
const hairCache = new Map();
function hairSwap(tone) {
  const to = new Map(PAL.hair.map((h, i) => [h.toLowerCase(), tone.shades[i]]));
  for (const [h, i] of Object.entries(VAL_PLAIN)) to.set(h, tone.shades[i]);
  to.set(VAL_BROW, tone.brow);
  return to;
}
function recolorCanvas(cv, to) {
  const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
  const x = c.getContext('2d'); x.drawImage(cv, 0, 0); const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  const rgb = new Map([...to].map(([k, v]) => [parseInt(k.slice(1), 16), parseInt(v.slice(1), 16)]));
  for (let i = 0; i < d.length; i += 4) { const v = rgb.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); if (v != null) { d[i] = v >> 16; d[i + 1] = (v >> 8) & 255; d[i + 2] = v & 255; } }
  x.putImageData(im, 0, 0); return c;
}
// the share of a texture's texels that are hair shades (a hair texture is all hair; a face has a few teal texels in the eyes)
function hairShare(cv, to) {
  try {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0, k = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; n++; if (to.has('#' + ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, '0'))) k++; }
    return n ? k / n : 0;
  } catch { return 0; }
}
function swapMaterial(m, id, to) {
  if (!m) return m;
  const key = m.uuid + id; if (hairCache.has(key)) return hairCache.get(key);
  let out = m;
  const img = m.map?.image;
  if (img && img.getContext && hairShare(img, to) > .6) {
    const t = m.map.clone(); t.source = new THREE.Source(recolorCanvas(img, to)); /* (a source of its own: clone() shares the original's) */ t.mipmaps = (m.map.mipmaps || []).map((mm) => (mm.getContext ? recolorCanvas(mm, to) : mm)); if (t.mipmaps.length) t.mipmaps[0] = t.image; t.needsUpdate = true;
    out = m.clone(); out.map = t;
  } else if (!img && m.color && to.has('#' + m.color.getHexString())) { out = m.clone(); out.color.set(to.get('#' + m.color.getHexString())); }
  hairCache.set(key, out); return out;
}
function recolorHair(r, id) {
  const tone = HAIR_TONES[id]; if (!tone?.shades) return;
  const to = hairSwap(tone);
  r.root.traverse((o) => { if (!o.isMesh || !o.material) return; o.material = Array.isArray(o.material) ? o.material.map((m) => swapMaterial(m, id, to)) : swapMaterial(o.material, id, to); });
}

// ---- a woman: Val's own rig
function makeWoman(a) {
  const hc = hairColorOf(a);
  const r = makeV({ skin: SKIN_HEX[a.skin] });
  if (a.hair !== 'f_braids') {
    for (const b of r.vbr || []) for (const m of [...b.lobes, ...b.bands.map((x) => x[1]), b.tie, b.tuft]) m.removeFromParent(); // her two braids go
    r.vbr = null; r.vbody = null;
    const T = HAIR_TONES[hc].base, parts = track(r, () => {
      if (a.hair === 'f_bun') { // gathered up high at the back of her head, a gold band round its root
        ball(r.head, .13, T, 0, .36, -.25, 1, C.kx('bun', T)).scale.set(1, .92, .9);
        C.turn(tcyl(r.head, .095, .1, .05, '#d8a040', 0, .33, -.17, 10, C.kx('trim', '#d8a040', { noShadow: true }))).rotation.x = -1.1;
      } else C.longHair(r, T, .62, .8); // loose down her back, a lock either side of her face
    });
    for (const o of parts) outline(o);
    r.hair.push(...parts.filter((o) => o.parent === r.head));
  }
  recolorHair(r, hc); // (her cap, fringe and brows: the chosen colour)
  return r;
}

// ---- a man: the shared rig, dressed to Val's finish
const CR = '#efe4cc', SEA = '#2f7f9a', SAF = '#d89a3a', ROPE = '#b8945a'; // Val's dress: cream, the sea-blue key, the saffron himation, the rope belt
const NAVY = '#1d1c26', LEA = '#4f3726', LEA_D = '#2d1c18', BOOT = '#2e2019', GOLD = '#d8a040', STEEL = '#cdd0d6'; // her battle dress
function makeMan(a) {
  const SK = SKIN_HEX[a.skin], TONE = HAIR_TONES[hairColorOf(a)], HAIR = TONE.base;
  const r = humanoid({ skin: SK, top: CR, bottom: CR, legs: SK, boots: SK, sleeve: null, eyes: '#2a4e7c', lips: '#8e5248', brow: TONE.brow, browTilt: .16 });
  r.npc = true; // the shaped limbs and shoulders of the people of the world (cast.js sculptNpc)
  const chest = r.torso.children[1]; chest.scale.x *= 1.07; // a broader chest and shoulders than hers
  for (const A of [r.armL, r.armR]) A.position.x *= 1.04;
  // hair (hidden under a helmet: r.hair)
  const hair = track(r, () => {
    if (a.hair === 'm_crop') C.hairCap(r, HAIR, { h: .72 });
    else if (a.hair === 'm_curls') C.curls(r, HAIR, { n: 9, s: .06, h: .8 });
    else { C.hairCap(r, HAIR, { h: .8, locks: 'part' }); C.locks(r, HAIR, .44, 2, false); }
  });
  // the white chiton: knee length, the sea-blue border with its cream key, a saffron himation from the left shoulder, a rope belt, sandals
  const home = track(r, () => {
    C.chiton(r, CR, { y1: -.5, trim: SEA, key: '#efe4cc' });
    C.neckTrim(r, SEA);
    C.drape(r, SAF, '#b8863c', -.72, .2, .36);
    C.belt(r, ROPE, .14, null, .045);
    C.sandals(r, '#6a4428', '#8a5a30', true);
    ball(r.torso, .03, '#e0b04a', .17, .58, .12, 0, { noShadow: true }); // the brooch
  });
  // the battle kit: a dark tunic, a leather cuirass with her gold neckline, studded straps and belt, pteruges, bracers, knee boots
  const war = track(r, () => {
    C.chiton(r, NAVY, { y1: -.34, top: .215, bot: .29 });
    const cu = C.turn(tcyl(r.torso, .266, .228, .52, LEA_D, 0, .32, 0, 10, C.kx('linen', LEA_D))); cu.scale.z = .76; // (down over the tunic's top: no gap at the waist)
    C.hem(r, GOLD, .565, .26, .76, .03);
    for (const [A, sx] of [[r.armL, -1], [r.armR, 1]]) { // leather shoulder guards with a gold rim, where hers are steel
      const pd = ball(A, .118, LEA, sx * .01, .01, 0, 1, C.kx('strap', LEA)); pd.scale.set(1, .82, .95); pd.rotation.z = -sx * .5;
      C.turn(tcyl(A, .1, .1, .025, GOLD, 0, -.06, 0, 10, C.kx('trim', GOLD, { noShadow: true })));
    }
    for (const sx of [-1, 1]) { box(r.torso, .07, .035, .3, LEA, sx * .16, .6, 0, C.kx('strap', LEA)); ball(r.torso, .024, STEEL, sx * .16, .6, .15, 0, C.kx('gem', STEEL, { noShadow: true })); }
    C.belt(r, LEA, .09, STEEL, .08, .235);
    for (let i = 0; i < 12; i++) {
      const an = i / 12 * PI * 2, c = i % 2 ? '#3a2a1e' : '#241a14';
      const st = box(r.torso, .075, .24, .03, c, Math.sin(an) * .25, -.08, Math.cos(an) * .22, C.kx('strip', c)); st.rotation.y = an; st.rotation.x = .15 * Math.cos(an);
    }
    C.bracer(r, LEA, 'LR', .15);
    for (const K of [r.kneeL, r.kneeR]) {
      C.turn(tcyl(K, .094, .086, .3, BOOT, 0, -.13, 0, 10, C.kx('boot', BOOT)));
      box(K, .148, .1, .26, BOOT, 0, -.34, .045, C.kx('sole', BOOT));
      C.turn(tcyl(K, .098, .098, .03, '#3a2a1e', 0, .01, 0, 10, C.kx('belt', '#3a2a1e', { noShadow: true }))); // the cuff under the knee
    }
  });
  r.hair = hair.filter((o) => o.parent === r.head); r.braids = [];
  r.warParts = war; r.homeParts = home;
  r.toneParts = [r.torso.children[0], r.torso.children[1]]; // (Roy 29.10: the rig's own cream waist and chest are the white chiton's top: the leather and dark ones tone them too, models.js setDress)
  // gear sockets where Val has hers: helmSocket at the skull's centre, neckSocket on the upper chest
  r.helmSocket = pivot(r.head, 0, .19, 0); r.neckSocket = pivot(r.torso, 0, .5, .175);
  r.male = true;
  finish(C.bake(r));
  r.isV = true; // the hero's bearing and how the hero carries a weapon (models.js poiseV / carryV); after finish, which refines only townsfolk
  return r;
}

// a character's rig: body, hair, skin, outfit and weapon from its appearance (an unknown look is shown as Val's)
export function makeHero(appearance, { weapon = true } = {}) {
  const a = safeAppearance(appearance);
  registerStarterAxe();
  const r = a.body === 'm' ? makeMan(a) : makeWoman(a);
  r.online = true; r.look = a;
  setEyes(r, a);
  setDress(r, OUTFIT_DRESS[a.outfit]);
  equipGear(r, 'shield', null); // the shield slot given and empty: no weapon brings its own shield
  if (weapon) armHero(r, a.weapon);
  return r;
}
// the eyes (Roy 29.10: "eye type, 3 kinds, and eye colour, 3 colours"): the pixel eye's shape (models.js PXEYE: a woman's
// round one is Val's own, a man's the shared rig's; almond and narrow drawn for each) and its iris, on the eyes the rig has
const EYE_STYLE = { f: { round: { vv: 1 }, almond: { st: 'w' }, narrow: { st: 'wn' } }, m: { round: { st: 'u' }, almond: { st: 'ua' }, narrow: { st: 'un' } } };
export function setEyes(r, a) {
  const h = r.hd; if (!h?.eo || !h.reLids) return r; // (only the pixel faces, the game's own; ?face=box / hd keep theirs)
  const eo = { ...h.eo, iris: EYE_HEX[eyeColorOf(a)] }; delete eo.vv; delete eo.st;
  h.eo = Object.assign(eo, EYE_STYLE[a.body === 'm' ? 'm' : 'f'][eyesOf(a)]); h.reLids();
  return r;
}
export function armHero(r, weapon) {
  const id = WEAPON_ITEM[weapon] || WEAPON_ITEM.sword, w = WEAPONS[id];
  equipWeapon(r, makeWeapon(id), w?.style || 'blade'); r.weaponId = id;
  return r;
}
// what the character wears and holds now (Roy 26.10 18:08: the whole character, with its gear as it is today): the save's
// hero.gear and hero.weapon over the creator's look, put on the way the game puts them on (entities.js Player.wearGear:
// a body piece that is one of the two outfits changes the dress, any other is an armour model over the battle dress)
export const GEAR_SLOTS = ['head', 'body', 'feet', 'back', 'shield'];
// a worn piece's record, when `id` is a real piece of that slot (the game's tables or the catalogue: weapons.js itemOf), else null
export function gearPiece(id, slot) {
  if (typeof id !== 'string' || !id || id.length > 80) return null;
  let G = null; try { G = GEAR[id] || itemOf(id); } catch { G = null; }
  return G && G.slot === slot ? G : null;
}
// the gear `gear` ({ head, body, feet, back, shield }: ids) put on rig r the way the game puts the heroine's on (entities.js
// Player.wearGear: a body piece that is one of the two outfits changes the dress, any other is an armour model over the
// battle dress; an empty slot takes the piece off). worn: what r wears now (slot -> id), so only the changes are made;
// an id that is not a real piece of its slot is left off. Returns what it wears after.
export function wearGear(r, gear, worn = {}) {
  const out = { ...worn };
  for (const slot of GEAR_SLOTS) {
    let want = gear?.[slot];
    if (slot === 'body' && r.online && LEGACY_OUTFIT_ITEM[want]) want = OUTFIT_ITEM[OUTFIT_DRESS[r.look?.outfit]] || LEGACY_OUTFIT_ITEM[want]; // (Roy 29.10: an old save's battle dress: the look's own outfit)
    const G = gearPiece(want, slot), id = G ? want : null;
    if ((out[slot] ?? null) === id) continue;
    const look = slot === 'body' && G?.outfit;
    let m = null; if (id && !look) try { m = makeGearModel(id); } catch (e) { console.warn('gear', id, e); }
    equipGear(r, slot, m); out[slot] = id;
    if (slot === 'body') setDress(r, look || 'war');
  }
  return out;
}
export function dressHero(r, { gear, weapon } = {}) {
  registerStaffItems();
  const has = {}; for (const slot of GEAR_SLOTS) if (gearPiece(gear?.[slot], slot)) has[slot] = gear[slot];
  wearGear(r, has, {});
  if (weapon && (WEAPONS[weapon] || forgedWeapon(weapon))) { try { equipWeapon(r, makeWeapon(weapon), (WEAPONS[weapon] || forgedWeapon(weapon))?.style || 'blade'); r.weaponId = weapon; } catch (e) { console.warn('weapon', weapon, e); } }
  return r;
}
// a character's rig as it is now: its look, and the gear and weapon of its last save (row: appearance, gear, weapon)
export function heroOf(row) {
  const r = makeHero(row?.appearance);
  if (row?.gear || row?.weapon) dressHero(r, { gear: row.gear, weapon: row.weapon });
  return r;
}
// let the rig settle into its standing pose (cloth, hair and braids hang) before a still picture
export function settle(r, frames = 40, st = { moving: false, calm: true }) {
  for (let i = 0; i < frames; i++) animateRig(r, 1 / 60, st);
  if (st.calm && !st.moving) holdAside(r);
  return r;
}
// standing for a picture (the sanctuary, the creator, the Hall of Fame; Roy 26.10 18:50: the face clear, the weapon beside
// the body; 26.10 later: the sword held higher, so it reads, heroic): a one-handed weapon (sword, axe) is held at the
// hip, a little forward, its blade raised up and out to the side, away from the face; a two-handed one (the spear), which
// the game carries upright in front of the chest, is held upright beside the body instead. The other hand at rest. Only
// the still poses: the game's own animation of the hero in the world is untouched (the next frame of animateRig puts it
// back).
const _ha = new THREE.Vector3(), _hd = new THREE.Vector3();
function holdAside(r) {
  const W = r.weaponR; if (!W || W.visible === false) return;
  if (['twohand', 'polearm'].includes(r.style)) {
    armIK(r, 'R', _ha.set(.31, -.04, .1)); aimHand(r, 'R', _hd.set(.05, 1, .06).normalize());
    armIK(r, 'L', _ha.set(-.27, -.02, .05)); aimHand(r, 'L', _hd.set(-.08, -1, .1).normalize());
  } else if (r.style === 'blade') {
    const axe = /axe/.test(r.weaponId || '');
    armIK(r, 'R', _ha.set(.3, axe ? -.2 : -.14, .2)); aimHand(r, 'R', axe ? _hd.set(.5, .78, .32).normalize() : _hd.set(.42, .8, .38).normalize());
  }
}
// let a rig go: its geometry is shared (cached) and its textures too, so only the scene graph is dropped
export function dropHero(r) { r?.root?.removeFromParent(); }
export { THREE };
