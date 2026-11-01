// BETA ONLINE, STAFF (Roy 31.10): "clothes that only GM or ADMIN can wear: clothes that make you look like an angel, with
// huge wings and a pair of weapons made of light". The SERAPH set's models, in the game's own kit (weapons.js KIT: the same
// primitives, toon materials, pixel dressing and outlines as every other piece), registered under the items' base ids:
//   sa_staff_halo     a gold circlet with small feathered wings at the temples and a ring of light floating over the head
//   sa_staff_robe     white-and-gold plate over a long white robe (pteruges long to the shins, swung clear of her legs),
//                     feathered gold pauldrons, a burning star on the breast, lines of light down the robe
//   sa_staff_sandals  white greaves, gold knees, a feathered wing at each ankle, light at the instep
//   sa_staff_wings    HUGE white wings (the angel's feathered wing, more feathers, three rows of coverts, half again as big
//                     as any other pair), gold-rimmed primaries, a glowing veil along every edge; beaten, folded in the
//                     water and lifting her like every pair (models.js wingBeat / hoverRig: the same two wing pivots)
//   sa_staff_blades   twin blades of pure light: a white-hot core in a soft additive glow, a gold winged guard, a crystal
//                     at the pommel and motes of light drifting up the blade
// The light parts breathe (opacity, a slow shimmer) and the halo turns and bobs: a mesh's onBeforeRender, so it runs for
// her, for every other player's figure and in the viewers alike, and costs nothing while unseen.
// Importing this file registers nothing; registerStaffModels() does (js/online/staff.js, online only).
import * as THREE from '../three.module.min.js';
import { KIT, BUILD_CTX, wingSpan } from '../weapons.js';

const { box, tcyl, ball, cone, pivot, M, flat, noOL, px, blade, plate, grip, crystal, featherPts, featherWing, wingRig, torusGeo,
  cuirass, cuiBand, onCui, belt, pteruges, cap, bootPair, bootFoot, shin, shinBand, BUILD, GEAR_BUILD, PXACC, HP, PI } = KIT;

export const SERAPH = { white: '#f6f2ea', whiteD: '#dcd6cc', gold: '#e8b840', goldL: '#ffe490', light: '#fff6d0', core: '#ffffff', glow: '#ffe9a0', sky: '#cfe8ff' };
const C = SERAPH;

// ------------------------------------------------------------------------------------------------ light that breathes
const clock = () => performance.now() / 1000;
const lightMats = new Map();
// an additive, unlit, see-through material (shared by colour and strength: every halo breathes in step)
function lightMat(color, op = .5, rate = 1.6, add = true) {
  const key = `${color}|${op}|${rate}|${add}`; let m = lightMats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, side: THREE.DoubleSide });
    m.userData.breathe = { op, rate }; lightMats.set(key, m);
  }
  return m;
}
// every frame the light parts are drawn: their opacity follows a slow sine (one call per material per frame is enough)
let lastT = -1;
function breathe() {
  const T = clock(); if (Math.abs(T - lastT) < .004) return; lastT = T;
  for (const m of lightMats.values()) { const b = m.userData.breathe; m.opacity = b.op * (.72 + .28 * Math.sin(T * b.rate + b.op * 7)); }
}
function lightMesh(parent, geo, color, op, rate, x = 0, y = 0, z = 0, add = true) {
  const m = new THREE.Mesh(geo, lightMat(color, op, rate, add)); m.position.set(x, y, z);
  m.castShadow = false; m.receiveShadow = false; m.renderOrder = 3; m.userData.noOutline = true; m.userData.px = 'none'; m.userData.light = true; m.userData.fx = true; m.raycast = () => {};
  m.onBeforeRender = breathe; parent.add(m); return m;
}
// THE SOFT GLOW (Roy 31.10, "the set should glow, softly, so others see it, not blinding"): a rim of warm light round the
// figure, brightest at its silhouette and clear in the middle (a fresnel shell, additive, no light source, no bloom), breathing
// with the rest. Part of the robe's model, so every player's page that draws the robe draws it too.
let auraMat = null;
export const AURA = { strength: .34, power: 2.4, rate: 1.1 };
function glowMat() {
  if (auraMat) return auraMat;
  auraMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(C.glow) }, uK: { value: AURA.strength }, uP: { value: AURA.power } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uK; uniform float uP; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), uP); gl_FragColor = vec4(uColor, f * uK); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false,
  });
  auraMat.userData.aura = true;
  return auraMat;
}
function aura(parent, sx, sy, sz, y) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glowMat());
  m.scale.set(sx, sy, sz); m.position.y = y;
  m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; m.raycast = () => {};
  Object.assign(m.userData, { noOutline: true, px: 'none', light: true, aura: true, fx: true });
  m.onBeforeRender = () => { const T = clock(); auraMat.uniforms.uK.value = AURA.strength * (.8 + .2 * Math.sin(T * AURA.rate)); };
  parent.add(m); return m;
}
const flatGeoOf = (pts, d) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, -d / 2); g.rotateX(HP); return g; };
const lightFlat = (p, pts, d, color, op, rate, add = true) => lightMesh(p, flatGeoOf(pts, d), color, op, rate, 0, 0, 0, add);
const sphere = (r) => new THREE.IcosahedronGeometry(r, 1);
// something that turns and bobs (the halo, the motes): runs on one of its meshes' draw
function spin(holder, mesh, { ry = 0, bob = 0, y0 = holder.position.y, rate = 1.4 } = {}) {
  const prev = mesh.onBeforeRender;
  mesh.onBeforeRender = (...a) => { prev?.(...a); const T = clock(); if (ry) holder.rotation.y = T * ry; if (bob) holder.position.y = y0 + Math.sin(T * rate) * bob; };
}
// a fan of small sparks (static points, the pixel pass makes them twinkle; they breathe out of step)
function motes(p, n, rad, z0, z1, color, s = .012) {
  for (let i = 0; i < n; i++) { const a = i * 2.39996, z = z0 + (z1 - z0) * ((i * .618) % 1); lightMesh(p, sphere(s + (i % 3) * s * .4), color, .9, 2.4 + (i % 4) * .7, Math.cos(a) * rad, Math.sin(a) * rad * .6, z); }
}

// ------------------------------------------------------------------------------------------------ the halo (head space)
function halo(h) {
  h.userData.keepHair = true; // (a circlet: her hair shows under it, models.js equipGear)
  // a gold circlet, a sun disc at the brow, and a small feathered wing at each temple
  const ring = px(tcyl(h, .262, .268, .045, C.gold, 0, .29, -.02, 14), 'band'); ring.scale.z = 1.08;
  const brow = pivot(h, 0, .3, .27); noOL(ball(brow, .028, C.light, 0, 0, .01, 1, { basic: true }));
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const r = flat(pivot(brow, 0, 0, 0), [[0, -.008], [i % 2 ? .035 : .055, 0], [0, .008]], .008, C.goldL, { emissive: '#4a3000' }); r.parent.rotation.z = a; r.rotation.x = HP; }
  for (const sx of [-1, 1]) {
    const q = pivot(h, sx * .27, .3, -.02); q.rotation.y = sx * (HP + .5);
    for (let i = 0; i < 4; i++) { const q2 = pivot(q, 0, 0, 0); q2.rotation.x = -.25 - i * .28; const q3 = pivot(q2, 0, 0, 0); q3.rotation.z = HP; plate(q3, featherPts(.06, .22 - i * .035), .014, i % 2 ? C.whiteD : C.white, C.gold, .007); }
  }
  // the ring of light over the head: a gold torus, a white-hot inner line and a soft glow round it; it turns and bobs
  const hv = pivot(h, 0, .74, -.03); hv.rotation.x = -.18;
  const hr = pivot(hv, 0, 0, 0);
  const tor = noOL(M(hr, torusGeo(.2, .02), C.goldL, 0, 0, 0, { basic: true })); tor.rotation.x = HP; tor.castShadow = false;
  const g1 = lightMesh(hr, new THREE.TorusGeometry(.2, .05, 6, 28), C.glow, .42, 1.3); g1.rotation.x = HP;
  const g2 = lightMesh(hr, new THREE.TorusGeometry(.2, .07, 6, 28), C.glow, .16, 1.0); g2.rotation.x = HP;
  spin(hr, g1, { ry: .6 }); spin(hv, g2, { bob: .018, rate: 1.7 });
}

// ------------------------------------------------------------------------------------------------ the robe (torso space)
function robe(t, b) {
  cuirass(t, C.white);
  cuiBand(t, .148, .036, C.gold); cuiBand(t, .585, .03, C.gold); cuiBand(t, .37, .018, C.goldL);
  box(onCui(t, .42, 0, .014), .036, .3, .03, C.gold);
  for (const sx of [-1, 1]) ball(onCui(t, .46, sx * .34, -.004), .088, C.white, 0, 0, 0, 1).scale.set(1.05, .6, .38);
  // the burning star on the breast
  const st = pivot(onCui(t, .46, 0, .03), 0, 0, 0);
  for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; const r = flat(pivot(st, 0, 0, 0), [[0, -.011], [i % 2 ? .05 : .09, 0], [0, .011]], .012, C.goldL, { emissive: '#5a3a00' }); r.parent.rotation.z = a; r.rotation.x = HP; }
  noOL(ball(st, .032, C.core, 0, 0, .012, 1, { basic: true }));
  lightMesh(st, sphere(.07), C.glow, .38, 1.9, 0, 0, .02);
  // feathered gold pauldrons
  for (const [sx, nm] of [[-1, 'armL'], [1, 'armR']]) {
    const pv = pivot(b(nm), sx * .015, .01, 0); pv.rotation.z = -sx * .3;
    px(cap(pv, .124, PI * .5, C.white, 0, 0), 'pauldron'); px(tcyl(pv, .12, .126, .03, C.gold, 0, -.02, 0, 10), 'band');
    for (let i = 0; i < 5; i++) { const q = pivot(pv, 0, .03, -.02); q.rotation.set(-.3, sx * (-.45 + i * .26), sx * (1.15 + i * .08)); plate(q, featherPts(.065, .24 - i * .022), .018, i % 2 ? C.whiteD : C.white, C.gold, .008); }
  }
  belt(t, C.gold);
  // the robe: a long white skirt to the shins in two layers (the outer one shorter, gold-hemmed), swung clear of her legs
  pteruges(t, 16, C.white, '#ece6da', C.gold, { h: .62, w: .1, r: .238, tilt: .12 });
  pteruges(t, 12, C.white, C.whiteD, C.goldL, { h: .36, w: .11, r: .262, tilt: .2, y: .08 });
  // lines of light down the front of the robe, and a sash
  const fr = pivot(t, 0, .06, .26);
  for (const x of [-.05, .05]) lightMesh(fr, new THREE.BoxGeometry(.012, .5, .012), C.glow, .55, 1.4, x, -.25, .02);
  const sash = px(tcyl(t, .25, .25, .03, C.goldL, 0, .125, 0, 10), 'band'); sash.scale.z = .84;
  // the soft glow round her, head to shins (one shell; the halo's and the blades' own light add to it where they are)
  aura(t, .5, 1.05, .4, .1);
}

// ------------------------------------------------------------------------------------------------ the sandals (knees)
function sandals(t, b) {
  bootPair(b, (k, sx) => {
    bootFoot(k, C.white, C.gold);
    const g = px(tcyl(k, .098, .086, .3, C.white, 0, -.155, .006, 10), 'greave'); g.scale.z = 1.06;
    shinBand(k, -.02, .03, C.gold); shinBand(k, -.29, .03, C.gold);
    const kn = ball(k, .075, C.gold, 0, .02, .062, 1); kn.scale.set(1, .85, .7);
    box(k, .012, .24, .012, C.goldL, 0, -.16, .098, { basic: true, noShadow: true });
    for (let i = 0; i < 3; i++) { const q = pivot(k, sx * .09, -.27, -.02); q.rotation.y = PI + sx * .3; const q2 = pivot(q, 0, 0, 0); q2.rotation.x = -(.4 + i * .35); const q3 = pivot(q2, 0, 0, 0); q3.rotation.z = HP; plate(q3, featherPts(.05, .18 - i * .035), .014, C.white, C.gold, .007); }
    lightMesh(k, sphere(.05), C.glow, .3, 1.7, 0, -.35, .12);
  });
}

// ------------------------------------------------------------------------------------------------ the wings (torso space)
// a glowing veil along a wing's edge (shape space: x out, z up), drawn on top of the feathers
function veil(f) {
  // a thin rim of light just outside the primaries' tips (shape space: x out, z up), not a sheet over the feathers
  const out = [[.62, .5], [.95, .66], [1.12, .55], [1.08, .3], [.96, .02], [.8, -.22], [.58, -.4]];
  const pts = [...out.map(([x, z]) => [x * 1.05, z * 1.05]), ...out.slice().reverse().map(([x, z]) => [x * .97, z * .97])];
  const m = lightFlat(f, pts, .004, C.glow, .35, 1.1); m.position.y = -.03;
}
const WING_SIZE = 1.95; // the angel's pair is 1.25 (and no level growth); this one is drawn at ~2.5 at level 300
function wings(t) {
  const G = BUILD_CTX.item;
  const tier = G?.flight ? wingSpan(true, G.ilvl || G.minLevel || 300) : 1; // (weapons.js wingTier multiplies by this afterwards)
  const s = WING_SIZE * 1.3 / tier;
  const m = wingRig(t, (f) => {
    featherWing(f, { n1: 13, n2: 12, rows: 3, len: .86, w: 1.6, c: { arm: C.whiteD, a: C.white, b: '#fbf8f2', edge: '#cfc8bc', cov: '#fffdf8', tip: C.gold, em: '#4a4030' } });
    veil(f);
    // a line of light along the arm (no sparks at the wrist: raised, they read as puffs over her head)
    for (const [a, b2] of [[[0, 0, 0], [.3, 0, .24]], [[.3, 0, .24], [.58, 0, .42]]]) {
      const len = Math.hypot(b2[0] - a[0], b2[2] - a[2]), g = lightMesh(f, new THREE.CylinderGeometry(.03, .03, len, 6), C.glow, .5, 1.5, (a[0] + b2[0]) / 2, -.03, (a[2] + b2[2]) / 2);
      g.rotation.z = HP; g.rotation.y = -Math.atan2(b2[2] - a[2], b2[0] - a[0]);
    }
  }, { scale: s, harness: (h) => { box(h, .2, .32, .05, C.gold, 0, -.02, 0); noOL(ball(h, .045, C.core, 0, .05, -.05, 1, { basic: true })); lightMesh(h, sphere(.11), C.glow, .35, 1.6, 0, .05, -.06); } });
  return m;
}

// ------------------------------------------------------------------------------------------------ the blades of light
// authored along +z (the hand at z 0), the blade flat in x-z; the game mirrors it for the left hand (makeWeapon 'dual')
function lightBlade(g) {
  // the hilt: a white grip wound in gold, a crystal pommel, a guard of two small gold wings
  grip(g, -.1, .1, .028, '#f4efe4', C.gold, 3);
  crystal(g, [0, 0, -.11], [0, 0, -1], .1, .03, C.sky, true);
  noOL(ball(g, .03, C.core, 0, 0, -.13, 0, { basic: true, noShadow: true }));
  const gz = .125;
  box(g, .1, .04, .05, C.gold, 0, 0, gz);
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    const a = .15 + i * .26, pv = pivot(g, sx * .04, 0, gz); pv.rotation.y = Math.atan2(sx * Math.cos(a), Math.sin(a)) + sx * .2;
    plate(pv, featherPts(.045, .18 - i * .025), .016, i % 2 ? C.goldL : C.gold, '#a8781e', .006);
  }
  noOL(ball(g, .036, C.light, 0, 0, gz + .01, 1, { basic: true }));
  // the blade: a white-hot core plate, a pale-gold edge, two soft additive shells of light round it, motes drifting up it
  const L = 1.08, z0 = gz + .04;
  const half = [[.044, z0], [.062, z0 + .1], [.058, z0 + L * .55], [.044, z0 + L * .85], [0, z0 + L]];
  const pts = [...half, ...half.slice(0, -1).reverse().map(([x, z]) => [-x, z])];
  // light, not steel: unshaded, a white-hot core over a pale-gold rim, then soft additive shells (strong: a faint glow is
  // lost in the pixel pass's levels). Two plates crossed along the blade, so it reads as a beam from any side (a flat plate
  // seen edge-on is a line). The core writes depth (the select's and the portraits' pictures keep only what does).
  const unlit = (m) => { noOL(m); m.castShadow = false; m.receiveShadow = false; m.userData.px = 'none'; m.userData.light = true; m.onBeforeRender = breathe; return m; };
  for (const rz of [0, HP]) {
    const q = pivot(g, 0, 0, 0); q.rotation.z = rz;
    unlit(flat(q, pts.map(([x, z]) => [x * 1.4, z0 - .012 + (z - z0) * 1.02]), .014, C.goldL, { basic: true, noShadow: true }));
    unlit(flat(q, pts, .022, C.core, { basic: true, noShadow: true }));
    lightFlat(q, pts.map(([x, z]) => [x * 2.4, z0 + (z - z0) * 1.04]), .04, C.glow, .55, 2.1);
    lightFlat(q, pts.map(([x, z]) => [x * 4.6, z0 - .02 + (z - z0) * 1.08]), .02, C.sky, .22, 1.4);
  }
  const rn = pivot(g, 0, 0, 0);
  for (let i = 0; i < 4; i++) noOL(box(rn, .028, .03, .028, C.goldL, 0, 0, z0 + .2 + i * .18, { basic: true, noShadow: true })).rotation.y = PI / 4; // runes of light
  motes(g, 9, .07, z0 + .1, z0 + L * .95, C.core, .01);
}

// ------------------------------------------------------------------------------------------------ registration
let done = false;
export function registerStaffModels() {
  if (done) return; done = true;
  GEAR_BUILD.sa_staff_halo = halo;
  GEAR_BUILD.sa_staff_robe = robe;
  GEAR_BUILD.sa_staff_sandals = sandals;
  GEAR_BUILD.sa_staff_wings = wings;
  BUILD.sa_staff_blades = lightBlade;
  for (const id of ['sa_staff_halo', 'sa_staff_robe', 'sa_staff_sandals', 'sa_staff_wings', 'sa_staff_blades']) PXACC[id] = C.gold;
}
// (for tests: does a built model carry the parts it must)
export const isLightPart = (o) => !!o?.userData?.light;
export const isAuraPart = (o) => !!o?.userData?.aura;
