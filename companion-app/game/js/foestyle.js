// Round 33, stage 4 (FOES): the new V look for every monster, beast, elite and boss.
// What made the new V work, as a kit the foe makers share (bestiary.js, horde.js, pxfoes.js and the other foe files):
//  - vround(root): rounder shapes. Every part keeps its maker's size and its geometry's parameters (radii, heights: the
//    lookups by them still match); only how round it is changes: boxes get bevelled edges (a 3 x 3 x 3 grid pushed onto
//    a rounded box, corners a quarter of each side), low cylinders and cones 1.6x the sides, small balls one more
//    subdivision. Tiny bits (teeth, claws, eyes, lashes) and glowing / fx parts keep their sharp facets. Cheaper on a
//    weak device (GFX.tier 'low': no extra ball subdivision, fewer sides).
//  - vEye(iris, kind): V-style creature eyes: a dark lid line on top, a big iris lit from below, the pupil by kind, a
//    two-texel catchlight up left and a small second one down right, a lower rim (bestiary eyes() wears it).
//  - ropes (tailRope / jiggle / tickRopes): physical motion for tails, manes, hair and tentacles, after V's braids
//    (simBraids in models.js): world-space points with gravity, inertia, air drag, a stiffness back to the animated
//    pose, kept lengths, a rest state that is dead still, and a carry-along on jumps. They bend the rig's own joints
//    (no new meshes), so hit flashes, petrify and night swaps work as before. Generic: CHARS' rope module can take over
//    ropeStep() when it lands (same inputs: anchor, rest points, lengths, dt).
// ?vfoes=0 turns it all off (the round 32 foes), for comparisons.
import * as THREE from './three.module.min.js';
import { GFX, toonRamp } from './render.js';
import { PXART, ramp, paOnce, paTex, paTile, paGrit, skin } from './pxart.js';
import { ball, pivot } from './models.js';

export const VFOES = !/[?&]vfoes=0\b/.test(location.search);
const low = () => GFX && GFX.tier === 'low';

// ------------------------------------------------------------------ rounder geometry
const GC = new Map(), G = (k, make) => { let g = GC.get(k); if (!g) { g = make(); g.userData.vr = 1; GC.set(k, g); } return g; };
export const RB = .24; // a rounded box's corner, as a share of each side
// a unit box (3 x 3 x 3 grid) with its edges and corners rounded: the inner grid lines moved out to 1/2 - f, then every
// vertex outside the inner box pushed onto the rounded surface, normals along the push (smooth across the bevels).
// uvFn(geo) (optional) lays UVs out on the flat box first (pxfoes' wrap round the long axis).
export function roundBoxGeo(f = RB, uvFn = null) {
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, e = .5 - f;
  const rm = (c) => (Math.abs(c) < .4 ? Math.sign(c) * e : c); // the inner grid lines (+-1/6) out to +-(1/2 - f)
  const ru = (t) => (Math.abs(t - 1 / 3) < .01 ? f : Math.abs(t - 2 / 3) < .01 ? 1 - f : t);
  for (let i = 0; i < p.count; i++) { p.setXYZ(i, rm(p.getX(i)), rm(p.getY(i)), rm(p.getZ(i))); uv.setXY(i, ru(uv.getX(i)), ru(uv.getY(i))); }
  if (uvFn) uvFn(g);
  const v = new THREE.Vector3(), q = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); q.set(Math.max(-e, Math.min(e, v.x)), Math.max(-e, Math.min(e, v.y)), Math.max(-e, Math.min(e, v.z)));
    d.subVectors(v, q); const l = d.length();
    if (l > 1e-6) { d.divideScalar(l); p.setXYZ(i, q.x + d.x * f, q.y + d.y * f, q.z + d.z * f); n.setXYZ(i, d.x, d.y, d.z); }
  }
  g.userData.vr = 1; g.userData.round = f;
  return g;
}
const RBOX = () => G('rbox', () => roundBoxGeo());
const _ws = new THREE.Vector3(), _rs = new THREE.Vector3();
const flatOf = (m) => m && !Array.isArray(m) && !m.isMeshBasicMaterial && !m.transparent && !(m.blending > 1);
// vround(root, o): make the rig's parts rounder (see the head of the file). Safe to run twice, before or after finish()
// (an outline hull sharing a part's geometry gets the new one too) and before pxDress (it lays its UVs on the new shapes).
// o.min: the smallest part (metres, in the rig's own scale) that is rounded; o.skip(mesh) keeps a part as it is.
export function vround(root, o = {}) {
  if (!VFOES || !root) return root;
  const lo = low(), min = o.min ?? .028;
  root.updateMatrixWorld(true); root.getWorldScale(_rs);
  const rs = Math.max(1e-6, Math.abs(_rs.y));
  root.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || m.userData.outline || m.userData.fx || m.userData.vr === false || (o.skip && o.skip(m))) return;
    const g = m.geometry, p = g.parameters; if (!p || g.userData.vr) return;
    const mp = Array.isArray(m.material) ? null : m.material?.map; if (mp && mp.wrapT !== THREE.RepeatWrapping) return; // a painted face, an eye, a decal: its UVs are its own
    m.getWorldScale(_ws); const sx = Math.abs(_ws.x) / rs, sy = Math.abs(_ws.y) / rs, sz = Math.abs(_ws.z) / rs;
    let ng = null;
    switch (g.type) {
      case 'BoxGeometry':
        if (p.width === 1 && p.height === 1 && p.depth === 1 && (p.widthSegments || 1) === 1 && flatOf(m.material) && !m.material.map?.userData?.eye && Math.min(sx, sy, sz) >= (lo ? 2.5 : 1.5) * min) ng = RBOX();
        break;
      case 'CylinderGeometry': case 'ConeGeometry': {
        const s = p.radialSegments, R = Math.max(p.radiusTop ?? p.radius ?? 0, p.radiusBottom ?? p.radius ?? 0) * Math.max(sx, sz);
        if (s < 12 && R >= min * .6) {
          const ns = Math.max(lo ? 8 : 10, Math.round(s * (lo ? 1.35 : 1.6)));
          if (ns > s) ng = g.type === 'ConeGeometry'
            ? G(`k${p.radius},${p.height},${ns},${p.heightSegments},${p.openEnded},${p.thetaStart},${p.thetaLength}`, () => new THREE.ConeGeometry(p.radius, p.height, ns, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength))
            : G(`c${p.radiusTop},${p.radiusBottom},${p.height},${ns},${p.heightSegments},${p.openEnded},${p.thetaStart},${p.thetaLength}`, () => new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, ns, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength));
        }
        break;
      }
      case 'IcosahedronGeometry': {
        const R = p.radius * Math.max(sx, sy, sz);
        const d = p.detail === 0 && R >= min * .7 ? 1 : p.detail === 1 && !lo && R >= .24 ? 2 : p.detail;
        if (d !== p.detail) ng = G(`i${p.radius},${d}`, () => new THREE.IcosahedronGeometry(p.radius, d));
        break;
      }
    }
    if (ng) { for (const c of m.children) if (c.userData.outline && c.geometry === g) c.geometry = ng; m.geometry = ng; }
  });
  return root;
}

// ------------------------------------------------------------------ V-style creature eyes
// 12 x 8, col 0 the inner corner: L the lid line (dark), W the white / sclera (or the iris' dark for beasts), I the iris
// (lit from below: i its light), D the pupil, C the catchlight, c the small second catchlight, l the lower rim
const VEYE = {
  round: ['..LLLLLLLL..', '.LLIIDDIIL..', '.WIIDDDDIIW.', '.WIIDCDDIiW.', '.WIIDDDDIiW.', '..IiiDDiiI..', '...lIiiIl...', '....llll....'],
  slit: ['..LLLLLLLL..', '.LLIIDDIIL..', '.WIIIDDIIIW.', '.WIIIDCIIiW.', '.WIIIDDIIiW.', '..IiiDDiiI..', '...lIiiIl...', '....llll....'],
  bar: ['..LLLLLLLL..', '.LLIIIIIIL..', '.WIIIIIIIIW.', '.DDDDCDDDDD.', '.WIIIIIIIiW.', '..IiiiiiiI..', '...lIiiIl...', '....llll....'],
  bead: ['..LLLLLLLL..', '.LDDDDDDDDL.', '.DDDCCDDDDD.', '.DDDCDDDDDD.', '.DDDDDDDcDD.', '..DDDDDDDD..', '...lDDDDl...', '....llll....'],
  // a human eye (o.white; '.' shows o.skin): V's own 12 x 8 shape, a lifted lash wing, whites either side of a 4-wide iris
  human: ['..........LL', '..LLLLLLLLL.', '.LWWDDDDWWL.', '.WWDCIIDWWW.', '.WWDIIiDWW..', '..lWIiiIWl..', '...lllll....', '............'],
  gem: ['..LLLLLLLL..', '.LIIIIIIIIL.', '.IIiiIIIIII.', '.IiCiIIIIDI.', '.IIiIIIIDDI.', '..IIIIDDDI..', '...lIIIIl...', '....llll....'],
};
export function vEyeMat(iris, kind = 'round', o = {}) {
  const k = o.skin && o.white && kind === 'round' ? 'human' : VEYE[kind] ? kind : 'round', key = 'vEye' + iris + k + (o.white || '') + (o.skin || '');
  return paOnce(key, () => {
    const I = ramp(iris, 6), lid = '#140d16', P = { L: lid, W: o.white || I[1], I: I[3], i: I[5], D: '#0e0a12', C: '#ffffff', c: '#e8f0ff', l: o.skin ? '#b05a6a' : I[0] };
    const t = paTex(key, 12, 8, (c) => { c.R(0, 0, 12, 8, o.skin || I[1]); VEYE[k].forEach((row, j) => [...row].forEach((ch, i) => { if (P[ch]) c.P(i, j, P[ch]); })); });
    t.userData.eye = true;
    const m = new THREE.MeshToonMaterial({ gradientMap: toonRamp(), map: t }); m.userData.eye = true; return m;
  });
}

// ------------------------------------------------------------------ ropes: tails, manes, hair, tentacles
// tailRope(r, joints, o): joints = a chain of Object3Ds, each the next one's parent (or not: then each is driven on its
// own); o.axis the local direction each joint's part points in ([0, 0, -1] a tail behind), o.len the length of each
// (metres, in the rig's own units; a number or a list), o.k stiffness back to the pose (1/s^2), o.damp (1/s) damping
// against the body's motion, o.g gravity share, o.drag air drag, o.max how far (radians) a joint may be bent off its pose.
// The rig's animate function poses the joints as before; tickRopes(r, dt) then bends them by the simulation.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const wpos = (o, v) => v.setFromMatrixPosition(o.matrixWorld);
const wquat = (o, q) => { o.matrixWorld.decompose(_s, q, _s); return q; };
// tailRope(r, joints, o): joints = a chain of Object3Ds, each the next one's parent (a tail's segments; one joint is a
// stiff tail or a mane that only swings). The links run joint to joint, the last one o.len (rig units) along o.axis, the
// local direction its part points in ([0, 0, -1]: a tail behind). o.k stiffness back to the pose (1/s^2), o.damp (1/s)
// damping of a swing against the body's own motion, o.g gravity share, o.drag air drag, o.max how far (radians) a joint
// may be bent off its pose. The rig's animate function poses the joints as before; tickRopes(r, dt) then bends them.
export function tailRope(r, joints, o = {}) {
  if (!VFOES || !joints?.length || !r) return null;
  for (let i = 1; i < joints.length; i++) if (joints[i].parent !== joints[i - 1]) { console.warn('tailRope: not a chain'); return null; }
  const R = { joints, axis: new THREE.Vector3(...(o.axis || [0, 0, -1])).normalize(), tip: o.len ?? .3, k: o.k ?? 160, damp: o.damp ?? 9, g: o.g ?? .35,
    drag: o.drag ?? .4, max: o.max ?? .9, p: [], v: [], rest: [], prev: [], live: false };
  (r.ropes ||= []).push(R);
  return R;
}
// a single joint that lags and springs (a mane, a crest, a hanging beard or a belly): a stiff one-link rope
export const jiggle = (r, joint, o = {}) => tailRope(r, [joint], { len: .25, k: 260, damp: 12, g: .15, max: .45, ...o });
const ROPE_FAR = 60; // metres from the camera past which ropes rest (posed as animated)
let ropeCam = null, ropeBudget = 20; const ropeSeen = new Set(); // (a rig ticked twice = a new frame)
export function setRopeCamera(cam) { ropeCam = cam; }
// the posed line: every joint's world position, then the tip of the last part
function ropeRest(R, rs) {
  const n = R.joints.length, rest = R.rest;
  for (let i = 0; i < n; i++) wpos(R.joints[i], rest[i] ||= new THREE.Vector3());
  wquat(R.joints[n - 1], _q); (rest[n] ||= new THREE.Vector3()).copy(R.axis).applyQuaternion(_q).multiplyScalar(R.tip * rs).add(rest[n - 1]);
}
// the simulation (position-based, like simBraids): p[0] rides the anchor; every other point has a velocity, damped against
// how the posed rig carries that spot, pulled back towards it, falling a little, slowed by the air; links keep their length.
// (CHARS' generic rope can take this over: anchor + posed points + lengths in, points out.)
export function ropeStep(R, dt) {
  const n = R.joints.length, P = R.p, V = R.v, rest = R.rest, prev = R.prev;
  if (!R.live || P[0].distanceToSquared(rest[0]) > 4) { // the first frame, or a jump: laid out on the pose
    for (let i = 0; i <= n; i++) { (P[i] ||= new THREE.Vector3()).copy(rest[i]); (V[i] ||= new THREE.Vector3()).set(0, 0, 0); (prev[i] ||= new THREE.Vector3()).copy(rest[i]); }
    R.live = true; return;
  }
  const h = Math.min(Math.max(dt, .001), .04), sub = h > .02 ? 2 : 1, hs = h / sub;
  let moving = false;
  for (let s = 0; s < sub; s++) {
    for (let i = 1; i <= n; i++) {
      const p = P[i], v = V[i];
      _b.subVectors(rest[i], prev[i]).divideScalar(h); if (_b.lengthSq() > 900) _b.set(0, 0, 0); // how the pose carries this spot
      v.sub(_b).multiplyScalar(Math.exp(-R.damp * hs)).add(_b);
      v.addScaledVector(_c.subVectors(rest[i], p), R.k * hs);
      v.y -= 9.8 * R.g * hs; v.multiplyScalar(1 - Math.min(.5, R.drag * hs));
      p.addScaledVector(v, hs);
      if (_c.subVectors(v, _b).lengthSq() > .0025) moving = true;
    }
    for (let i = 1; i <= n; i++) { const L = rest[i].distanceTo(rest[i - 1]); _d.subVectors(P[i], P[i - 1]); const d = _d.length() || 1e-6; P[i].copy(P[i - 1]).addScaledVector(_d, L / d); }
    P[0].copy(rest[0]);
  }
  if (!moving) for (let i = 1; i <= n; i++) V[i].subVectors(rest[i], prev[i]).divideScalar(h); // at rest it is at rest (no creeping)
  for (let i = 0; i <= n; i++) prev[i].copy(rest[i]);
}
// bend each joint so its part points at the next simulated point (root first: each joint's frame follows its parent's)
function ropeApply(R) {
  const n = R.joints.length;
  for (let i = 0; i < n; i++) {
    const J = R.joints[i];
    if (i) J.updateWorldMatrix(false, false);
    wpos(J, _a);
    if (i < n - 1) { R.joints[i + 1].updateWorldMatrix(false, false); wpos(R.joints[i + 1], _b).sub(_a); } // where its part points now
    else { wquat(J, _q); _b.copy(R.axis).applyQuaternion(_q); }
    const lb = _b.length(); if (lb < 1e-6) continue; _b.divideScalar(lb);
    _c.subVectors(R.p[i + 1], _a); const lc = _c.length(); if (lc < 1e-6) continue; _c.divideScalar(lc); // where the rope says
    const ang = Math.acos(Math.max(-1, Math.min(1, _b.dot(_c)))); if (ang < 1e-3) continue;
    _q2.setFromUnitVectors(_b, _c);
    if (ang > R.max) _q2.slerp(_q3.identity(), 1 - R.max / ang); // never further than max off the pose
    wquat(J.parent, _q4); // into the parent's frame: L' = Pw^-1 * D * Pw * L
    J.quaternion.premultiply(_q4).premultiply(_q2).premultiply(_q4.invert());
    J.updateWorldMatrix(false, false);
  }
}
// once a frame per rig, after its animate function: run its ropes. Only near the camera, and at most a dozen or so rigs
// a frame (a crowd beyond that is posed as animated), so a horde on a phone costs no more than a pack.
export function tickRopes(r, dt) {
  if (!r?.ropes || !VFOES) return;
  const root = r.root; if (!root.visible || !root.parent) return;
  if (ropeSeen.has(r)) { ropeSeen.clear(); ropeBudget = low() ? 8 : 20; } ropeSeen.add(r);
  const rest = () => { for (const R of r.ropes) { R.live = false; if (R.applied) R.joints.forEach((J, i) => { const e = J.rotation, a = R.applied[i], p = R.posed[i]; if (e.x === a[0]) e.x = p[0]; if (e.y === a[1]) e.y = p[1]; if (e.z === a[2]) e.z = p[2]; }); R.applied = null; } };
  if (ropeCam) { wpos(root, _pos); if (_pos.distanceToSquared(ropeCam.position) > ROPE_FAR * ROPE_FAR) return rest(); }
  if (ropeBudget-- <= 0) return rest();
  root.updateWorldMatrix(true, false);
  const rs = Math.abs(_d.setFromMatrixScale(root.matrixWorld).y) || 1;
  for (const R of r.ropes) {
    // the rope is a layer over the pose, not a state: a channel the animate function didn't set this frame (it still holds
    // what the rope left in it) goes back to its pose, so nothing creeps from frame to frame
    const E = R.joints.map((J) => J.rotation);
    if (R.applied) E.forEach((e, i) => { const a = R.applied[i], p = R.posed[i]; if (e.x === a[0]) e.x = p[0]; if (e.y === a[1]) e.y = p[1]; if (e.z === a[2]) e.z = p[2]; });
    R.posed = E.map((e) => [e.x, e.y, e.z]);
    const J0 = R.joints[0]; J0.updateWorldMatrix(true, false); for (let i = 1; i < R.joints.length; i++) R.joints[i].updateWorldMatrix(false, false);
    ropeRest(R, rs); ropeStep(R, dt); if (R.live) ropeApply(R);
    R.applied = E.map((e) => [e.x, e.y, e.z]);
  }
}

// hairLocks(r, head, o): o.n locks of hair (or ribbons, weed, feathers) from the back of a head, each o.k woven lobes on
// a chain of joints, a rope that hangs with gravity and swings after her moves (V's braids, lighter). o.at the root
// (head space), o.spread how far apart, o.len, o.r the lobe radius, o.color / o.color2 alternate lobes, o.tip a tie.
export function hairLocks(r, head, o = {}) {
  const n = o.n ?? 3, k = o.k ?? 4, L = o.len ?? .34, sg = L / k, r0 = o.r ?? .05, at = o.at || [0, .2, -.13], sp = o.spread ?? .1, out = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - .5 : 0;
    let par = pivot(head, at[0] + u * sp * 2, at[1] - Math.abs(u) * (o.drop ?? .02), at[2] + Math.abs(u) * (o.wrap ?? .05));
    par.rotation.set(o.tilt ?? .3, 0, -u * (o.fan ?? .45));
    const joints = [par];
    for (let j = 0; j < k; j++) {
      const rr = r0 * (1 - j / k * (o.taper ?? .5));
      ball(par, rr, j % 2 && o.color2 ? o.color2 : o.color, 0, -sg * .5, 0, 1, { noShadow: j > 0 }).scale.set(1, Math.max(1, sg / rr * .62), .82);
      if (j < k - 1) { const p = pivot(par, 0, -sg, 0); joints.push(p); par = p; }
    }
    if (o.tip) ball(par, r0 * .45, o.tip, 0, -sg * 1.02, 0, 0, { noShadow: true });
    if (VFOES) tailRope(r, joints, { axis: [0, -1, 0], len: sg, k: o.stiff ?? 60, damp: o.damp ?? 5, g: o.g ?? .7, max: o.max ?? 1.1, drag: .6 });
    out.push(joints);
  }
  return out;
}

// autoTail(r): a rig's tail (r.tail, and r.tailSeg when its segments hang one from the next) becomes a rope; the way it
// points and its length are read from its meshes
export function autoTail(r) {
  if (!VFOES || r.noRope || !r.tail?.isObject3D || r.ropes?.some((R) => R.joints[0] === r.tail)) return;
  const chain = [r.tail]; for (const sg of r.tailSeg || []) { if (sg.parent === chain[chain.length - 1]) chain.push(sg); else break; }
  const last = chain[chain.length - 1], ax = new THREE.Vector3(); let tip = .12;
  for (const m of last.children) if (m.isMesh) ax.add(m.position); // the way the last part points: towards its meshes
  if (ax.lengthSq() < 1e-6) return; ax.normalize();
  for (const m of last.children) if (m.isMesh) { const g = m.geometry; g.boundingSphere || g.computeBoundingSphere(); tip = Math.max(tip, m.position.dot(ax) + g.boundingSphere.radius * Math.max(Math.abs(m.scale.x), Math.abs(m.scale.y), Math.abs(m.scale.z)) * .7); }
  tailRope(r, chain, { axis: ax.toArray(), len: Math.min(tip, 1.2), k: chain.length > 1 ? 120 : 170, damp: chain.length > 1 ? 7 : 9, g: .3, max: chain.length > 1 ? .7 : .55 });
}

// ------------------------------------------------------------------ the parts no maker dressed
// vskin(root, o): every part still in a flat colour (and big enough to show it: o.min metres, rig scale) gets a quiet
// painted surface on the new palette: the colour itself with a few cool-violet flecks and pits and warm lit bumps, so
// no part of a foe is a flat plastic block next to V's hand-shaded outfit (teeth, claws, nostrils keep their flat colour)
const SOFT = (hex) => paTile('vsoft' + hex, 24, 24, (c) => paGrit(c, vramp(hex), { fleck: 8, pit: .7, bump: .6 }));
export function vskin(root, o = {}) {
  if (!VFOES || !PXART || !root) return root;
  const min = o.min ?? .07, map = {};
  root.updateMatrixWorld(true); root.getWorldScale(_rs); const rs = Math.max(1e-6, Math.abs(_rs.y));
  root.traverse((m) => {
    const mt = m.material;
    if (!m.isMesh || m.userData.outline || m.userData.fx || !mt || Array.isArray(mt) || mt.map || !mt.color || mt.transparent || mt.isMeshBasicMaterial || !mt.isMeshToonMaterial) return;
    if (mt.emissive && (mt.emissive.r + mt.emissive.g + mt.emissive.b) > 0) return;
    const g = m.geometry; g.boundingSphere || g.computeBoundingSphere(); m.getWorldScale(_ws);
    if (g.boundingSphere.radius * 2 * Math.max(Math.abs(_ws.x), Math.abs(_ws.y), Math.abs(_ws.z)) / rs < min) return;
    const hex = '#' + mt.color.getHexString(); map[hex] ||= SOFT(hex);
  });
  skin(root, map);
  return root;
}

// ------------------------------------------------------------------ shared finishes
// a colour's 6-tone ramp with the new V's shading: shades drift to a cool violet, lights to a warm cream
const _x = new THREE.Color(), _y = new THREE.Color();
export const vramp = (hex) => paOnce('vr' + hex, () => {
  const Q = ramp(hex, 6), cool = ['#2e2248', '#3c2f5e', '#4a3d6c'], warm = ['#ffe7b8', '#fff4d6'], k = [.3, .2, .1];
  return Q.map((c, i) => '#' + (i < 3 ? _x.set(c).lerp(_y.set(cool[i]), k[i]) : i > 3 ? _x.set(c).lerp(_y.set(warm[i - 4]), i === 4 ? .1 : .22) : _x.set(c)).getHexString());
});
export { PXART };
