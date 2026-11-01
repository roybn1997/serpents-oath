// Hands with fingers (Roy 29.10: "I want the characters' hands to be better and more detailed. Send me 3 options. I want
// real fingers and everything, proportional to the body / the rest of the arm."). Until now a hand was one squashed ball
// (r .055, ~.11 across) at the end of the forearm: about a third of the forearm's length, no wider than the wrist, and a
// weapon's grip simply ran through it.
//
// Here a hand is a palm, four fingers and a thumb, built as ONE mesh per hand in the skin's own material on the rig's hand
// bone (rigbatch.js still draws each bone's parts as one: no new draw per character), and re-shaped by swapping in another
// cached geometry when the hand's pose changes: relaxed (slightly curled), grip (the fingers wrapped round whatever the hand
// holds, sized to that handle: a sword's grip, a bow's riser, a staff), fist (empty, running or bearing a shield) and open
// (spread, casting). The pose is chosen every frame from what the rig does (updateHands); nothing in the pose code changes.
// Sizes follow the arm: a hand ~.18 long (palm .085, the middle finger .09), about 0.6 of the forearm, as wide as the wrist.
//   ?hands=a  stylised: each finger one smooth tube bent at two joints, few triangles (~150 a hand)
//   ?hands=b  anatomical: three phalanges a finger, tapered, knuckle bulges, a thenar pad, a hint of nails
//   ?hands=c  heroic: squarer, chunkier fingers (Greek statue / action-figure), a broad palm, and leather hand wraps
//             (himantes) on fighters' hands in their war kit
//   ?hands=b1|b2|b3  B's fingers with a wrist instead of a ball (Roy 29.10, second round: see OPT below)
//   ?hands=final (default) B1 toward Roy's reference picture (see OPT.final)
//   ?hands=old  the ball, as before
import * as THREE from './three.module.min.js';
import { toonRamp } from './render.js';

const Q = typeof location !== 'undefined' ? location.search : '';
export const HANDS = (Q.match(/[?&]hands=(a|b[123]?|c|old|final)\b/) || [])[1] || 'final';
const OPT = {
  // segs: phalanges drawn; sides/cap: a finger's round; fr, fl: finger girth and length; taper: tip/base girth; flat: depth/width;
  // palmW/palmT: palm width/thickness; pSec, sec: cross-section roundness (1 round, lower squarer); bulge: knuckles
  a: { segs: 2, sides: 6, cap: 2, pSides: 8, pRings: 6, taper: .96, flat: .92, fr: 1.2, fl: .88, palmW: 1, palmT: 1.08, pSec: .85, bulge: 0, thenar: false, nails: false, sec: 1, k: 1 },
  b: { segs: 3, sides: 7, cap: 3, pSides: 10, pRings: 8, taper: .7, flat: .8, fr: .94, fl: 1.04, palmW: .98, palmT: .95, pSec: .6, bulge: .2, thenar: true, nails: true, sec: 1, k: 1 },
  // Roy 29.10 (second round): B's fingers, "a ball isn't necessary to connect the hand and the wrist": three wrists, no ball,
  // each one bending with the hand (rigbatch.js: the wrist's vertices shared between the forearm and the hand bone)
  //   b1 taper: the forearm narrows to a wrist (flatter than wide) and flows into the palm, no seam, no bulge
  //   b2 neck: the forearm as it was, then a short, narrow, flattened wrist before the palm (which starts lower)
  //   b3 cuff: b1, and where the forearm wears a bracer it reaches down over the joint (bare arms: b1)
  c: { segs: 3, sides: 8, cap: 1, pSides: 8, pRings: 6, taper: .9, flat: .9, fr: 1.3, fl: .98, palmW: 1.1, palmT: 1.2, pSec: .5, bulge: .12, thenar: true, nails: false, sec: .5, k: 1.07, wraps: true },
};
for (const [id, wrist] of [['b1', 'taper'], ['b2', 'neck'], ['b3', 'cuff']]) OPT[id] = { ...OPT.b, wrist };
// Roy 29.10 (third round, his reference picture: "this is the vibe, just adapt it to our design language"): B1 toward a
// natural, slim hand: slimmer palm and fingers, a back domed a little with the tendons hinted (four low ridges from the
// wrist to the knuckles), a bump at every knuckle (the hand's own and each finger joint), lighter nails, a wrist crease (a
// shallow groove where the wrist meets the hand). Fingers 6-sided to stay near B1's triangles.
OPT.final = { ...OPT.b, wrist: 'taper', lines: true, sides: 6, fr: .86, taper: .64, palmW: .93, palmT: .86, pSec: .72, pSides: 14, pRings: 9, wSides: 10, cap: 2, bulge: .3, back: true, crease: true, nailTint: .72 };
// final: the back of the hand raised along a tendon to each finger (fanning out from the wrist) and at each knuckle, in the
// palm's own surface (a part of its own would draw its outline round every ridge). d along the palm, w across it (unscaled).
function backBump(d, w, P) {
  let h = 0; const t = Math.max(0, Math.min(1, (d - P * .12) / (P * .8)));
  for (const [fw, back] of FINGERS) {
    const dk = P - back, wt = fw * (.4 + .6 * t), g = Math.exp(-(((w - wt) / .0048) ** 2));
    h += g * (.0024 * Math.sin(Math.PI * Math.min(1, t * 1.05)) + .0055 * Math.exp(-(((d - dk) / .007) ** 2)));
  }
  return h;
}
// one finger: [knuckle w (across the palm, + toward the thumb), knuckle set back from the palm's end, radius, phalanges]
const FINGERS = [
  [.03, .004, .0105, [.04, .024, .019]], // index
  [.0095, 0, .011, [.044, .027, .02]], // middle
  [-.0105, .004, .0102, [.041, .026, .019]], // ring
  [-.029, .013, .0088, [.032, .019, .016]], // little
];
const THUMB = { r: .0125, l: [.036, .03], meta: .04 };
const PALM = { len: .085, w0: .036, w1: .044, t: .032 };

// ---------------------------------------------------------------------------------- geometry kit
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
class Builder {
  constructor() { this.p = []; this.n = []; this.ix = []; }
  grid(rings, sides, closed = true) { // rings: arrays of `sides` points; consecutive rings joined, each ring closed round
    const o = this.p.length / 3, P = [];
    for (const r of rings) for (const v of r) P.push(v.x, v.y, v.z);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const ix = [];
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) {
      const j2 = closed ? (j + 1) % sides : j + 1; if (j2 >= sides) continue;
      const a = i * sides + j, b = i * sides + j2, c = (i + 1) * sides + j, d = (i + 1) * sides + j2;
      ix.push(a, c, b, b, c, d);
    }
    g.setIndex(ix); g.computeVertexNormals();
    { // outward? (a ring's winding depends on its frame): test the middle ring against its own centre, flip if not
      const m = rings[rings.length >> 1], c = m.reduce((a, v) => a.add(v), V3()).divideScalar(m.length), N0 = g.attributes.normal;
      let s = 0; m.forEach((v, j) => { const q = (rings.length >> 1) * sides + j; s += (N0.getX(q) * (v.x - c.x) + N0.getY(q) * (v.y - c.y) + N0.getZ(q) * (v.z - c.z)); });
      if (s < 0) { for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.setIndex(ix); g.computeVertexNormals(); }
    }
    const N = g.attributes.normal.array;
    this.p.push(...P); this.n.push(...N); for (const k of ix) this.ix.push(k + o);
    g.dispose();
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(this.p.length / 3 * 2), 2)); // (plain colour; uvs for kits that want them)
    g.setIndex(this.ix); g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
const sgnPow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
// a ring of `sides` points round centre c in the plane (u, v), radii ru (along u) and rv (along v), section exponent e
function ring(c, u, v, ru, rv, sides, e = 1, ph = 0) {
  const out = [];
  for (let j = 0; j < sides; j++) { const a = ph + j / sides * Math.PI * 2, x = sgnPow(Math.cos(a), e), y = sgnPow(Math.sin(a), e); out.push(c.clone().addScaledVector(u, ru * x).addScaledVector(v, rv * y)); }
  return out;
}
// a tube swept through points pts (radii rs) with the flat side facing `up` (the back of the hand), a rounded tip; the base
// is left open (it starts inside the palm). bul: joints bulge (knuckles) by this share, pushed toward the back.
function sweep(B, pts, rs, up, o, bul = 0, marks = null, from = 1) {
  const n = pts.length, T = [], rings = [];
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? pts[i].clone().sub(pts[i - 1]).normalize() : null, b = i < n - 1 ? pts[i + 1].clone().sub(pts[i]).normalize() : null;
    const t = a && b ? a.clone().add(b) : (a || b).clone(); if (t.lengthSq() < 1e-8) t.copy(a || b); T.push(t.normalize());
  }
  let U = up.clone();
  { const t = T[0]; U.addScaledVector(t, -U.dot(t)).normalize(); const L = t.clone().cross(U); rings.push(ring(pts[0].clone().addScaledVector(t, -rs[0] * .5), U, L, rs[0] * .3 * o.flat, rs[0] * .3, o.sides, o.sec)); } // (the closed root)
  for (let i = 0; i < n; i++) {
    U.addScaledVector(T[i], -U.dot(T[i])).normalize(); // carried along the bends
    const L = T[i].clone().cross(U), r = rs[i];
    const bend = i > 0 && i < n - 1 ? pts[i].clone().sub(pts[i - 1]).normalize().dot(pts[i + 1].clone().sub(pts[i]).normalize()) : 1;
    const kb = Math.min(1.35, 1 / Math.max(.5, Math.sqrt((1 + bend) / 2))); // (a ring at a bend widens so the joint keeps its girth)
    const joint = i > 0 && i < n - 1 && pts[i].userData_j;
    const bu = joint ? 1 + bul : 1, c = joint ? pts[i].clone().addScaledVector(U, r * bul * .6) : pts[i];
    rings.push(ring(c, U, L, r * o.flat * bu * (joint ? kb : 1), r * bu, o.sides, o.sec));
    if (marks && joint && i >= from) crease(marks, c, T[i], U, L, r * o.flat * bu * (joint ? kb : 1) * 1.03, r * bu * 1.03, o.sec); // (final: a crease over the knuckle)
  }
  // the tip: a rounded cap
  const tip = pts[n - 1], t = T[n - 1], rt = rs[n - 1];
  U.addScaledVector(t, -U.dot(t)).normalize(); const L = t.clone().cross(U);
  for (let k = 1; k <= o.cap; k++) {
    const a = k / o.cap * Math.PI / 2, c = tip.clone().addScaledVector(t, rt * Math.sin(a) * .9), s = Math.max(.02, Math.cos(a));
    rings.push(ring(c, U, L, rt * o.flat * s, rt * s, o.sides, o.sec));
  }
  B.grid(rings, o.sides);
}
// a crease: a thin band over the back half of a ring (U the back), a hair proud of the surface; skin tinted darker
function crease(B, c, t, U, L, ru, rv, e, w = .0011, arc = 1.5, n = 3) {
  const rs = [-1, 1].map((sd) => { const o = []; for (let j = 0; j <= n; j++) { const a = -arc / 2 + j / n * arc; o.push(c.clone().addScaledVector(t, sd * w).addScaledVector(L, ru * sgnPow(Math.sin(a), e)).addScaledVector(U, rv * sgnPow(Math.cos(a), e))); } return o; });
  B.grid(rs, n + 1, false);
}
// an ellipsoid (radii a along `ax`, ru along u, rv along v), rings x sides
function blob(B, c, ax, u, v, a, ru, rv, sides = 6, rings = 4, e = 1) {
  const rs = [];
  for (let i = 0; i <= rings; i++) { const t = -Math.PI / 2 + i / rings * Math.PI, s = Math.max(.001, Math.cos(t)); rs.push(ring(c.clone().addScaledVector(ax, a * Math.sin(t)), u, v, ru * s, rv * s, sides, e)); }
  B.grid(rs, sides);
}

// ---------------------------------------------------------------------------------- the hand in a pose
// Built for the rig's right hand in its own bone's space (+y up the forearm, the palm toward -x (her body), the thumb
// toward +z, where weapons point); the left hand is the mirror. A held handle lies along +z through the origin.
// Palm frame: O the wrist, D toward the fingers, N out of the palm, W toward the thumb (= +z).
const flexChain = (K, f0, n0, lens, th) => { // forward kinematics: each joint turns the finger toward the palm side n
  const pts = [K.clone()]; let f = f0.clone(), n = n0.clone(), p = K.clone();
  for (let j = 0; j < lens.length; j++) {
    const c = Math.cos(th[j]), s = Math.sin(th[j]), f2 = f.clone().multiplyScalar(c).addScaledVector(n, s), n2 = n.clone().multiplyScalar(c).addScaledVector(f, -s);
    f = f2; n = n2; p = p.clone().addScaledVector(f, lens[j]); pts.push(p);
  }
  return pts;
};
// round a handle of radius R (axis z through c): from K, each joint on the circle, a phalanx's length on from the last
export function hugChain(K, c, R, lens, dir) {
  const pts = [K.clone()]; let cur = new THREE.Vector2(K.x - c.x, K.y - c.y); const z = K.z;
  for (let j = 0; j < lens.length; j++) {
    const l = lens[j], d = cur.length(); let nx;
    if (Math.abs(d - R) < 1e-4 || d < R) { const a = Math.atan2(cur.y, cur.x) + dir * 2 * Math.asin(Math.min(1, l / (2 * Math.max(R, d)))); nx = new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(R); }
    else if (l > d + R || l < d - R) { const a = Math.atan2(cur.y, cur.x) + dir * Math.min(2.4, l / R); nx = new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(R); }
    else {
      const a = (R * R - l * l + d * d) / (2 * d), h = Math.sqrt(Math.max(0, R * R - a * a)), e = cur.clone().divideScalar(d), pr = new THREE.Vector2(-e.y, e.x);
      const p1 = e.clone().multiplyScalar(a).addScaledVector(pr, h), p2 = e.clone().multiplyScalar(a).addScaledVector(pr, -h);
      nx = (cur.x * p1.y - cur.y * p1.x) * dir > 0 ? p1 : p2;
    }
    cur = nx; pts.push(V3(c.x + nx.x, c.y + nx.y, z));
  }
  return pts;
}
const POSES = {
  // [wrist O, finger direction D (normalised), finger flex (base, mid, tip) and the little finger's extra, spread, thumb]
  relaxed: { O: [.004, .04, 0], D: [-.06, -1, 0], th: [.32, .42, .28], extra: .14, spread: .05, thumb: { dir: [.62, .62, .5], th: [.22, .3] } },
  open: { O: [.004, .04, 0], D: [.1, -1, 0], th: [.02, .04, .02], extra: 0, spread: .17, thumb: { dir: [.42, .9, .08], th: [-.05, -.12] } },
  fist: { O: [.012, .044, 0], D: [.16, -1, 0], th: [1.45, 1.75, 1.05], extra: .05, spread: -.02, thumb: { dir: [.3, .28, .9], th: [1.0, .65], tw: [.3, -.55, .4] } },
};
function palmFrame(Oa, Da) {
  const O = V3(...Oa), D = V3(...Da).normalize(), W = V3(0, 0, 1), N = V3(D.y, -D.x, 0).normalize(); // N: out of the palm (toward -x when D is down)
  return { O, D, N, W };
}
// the geometry of one hand: { skin, nail, wrap } (BufferGeometry or null) for option o, pose p ('grip:<radius>' grips)
function buildHand(id, pose, k, M = null, fa = null) {
  const o = OPT[id], S = o.k * k;
  const skin = new Builder(), nail = o.nails ? new Builder() : null, wrap = o.wraps ? new Builder() : null, line = o.lines ? new Builder() : null; // (line, final: the creases, drawn a shade darker)
  if (pose === 'fist') pose = 'grip:0.008'; // (empty: closed round nothing, the fingertips into the palm)
  const grip = pose.startsWith('grip'), rh = grip ? +pose.split(':')[1] : 0;
  const P = PALM.len * S, T = PALM.t * S * o.palmT, fr = o.fr * S;
  let F;
  const zc = grip ? -.006 : -.012; // the palm's middle across: just behind the grip point (the index clears a guard), else over the forearm
  if (grip) {
    // the palm beside the handle (its inner face on the handle's surface), the knuckles' line just below the handle's
    // middle, so the fingers start round its underside; the palm leans in a little toward the forearm's axis at the wrist
    const xp = rh + T / 2 + .002 * S, D = V3(.15, -1, 0).normalize(), K0 = V3(xp, -.006 * S, 0);
    F = palmFrame([K0.x - D.x * P, K0.y - D.y * P, 0], [D.x, D.y, 0]);
  } else { const ps = POSES[pose]; F = palmFrame(ps.O, ps.D); }
  const { O, D, N, W } = F, BK = N.clone().negate(); // BK: the back of the hand
  const at = (d, n, w) => O.clone().addScaledVector(D, d).addScaledVector(N, n).addScaledVector(W, w * S + zc);
  // ---- the palm: a rounded slab, narrower at the wrist, its sides soft (superellipse), capped at both ends
  let wristW = null;
  {
    const rings = [], n = o.pRings, sides = o.pSides, d0 = (o.wrist === 'neck' ? .022 : -.006) * S; // (b2: the palm starts lower, below its wrist)
    for (let i = 0; i <= n; i++) {
      const t = i / n, e = Math.max(.08, Math.pow(1 - Math.pow(Math.abs(2 * t - 1), 4), .25)); // end rounding
      const d = d0 + t * (P + .004 * S - d0 - .006 * S), w = (PALM.w0 + (PALM.w1 - PALM.w0) * Math.min(1, t * 1.4)) * S * o.palmW;
      const c = at(d, (o.thenar ? .002 : 0) * S, -.001);
      const heel = 1 + (o.heel || 0) * Math.max(0, 1 - t / .55) ** 2; // (b1, b3: the heel of the hand fuller where it meets the wrist)
      const rg = ring(c, W, BK, w * e, T / 2 * e * heel, sides, o.pSec);
      if (o.back) for (const v of rg) { const q = v.clone().sub(c), h = q.dot(BK) / (T / 2 * e); if (h > .2) v.addScaledVector(BK, backBump(d / S, q.dot(W) / S - .001, P / S) * S * Math.min(1, (h - .2) * 2.5) * e); } // (final: tendons, knuckles)
      rings.push(rg);
    }
    skin.grid(rings, sides);
    if (o.thenar) { // the ball of the thumb on the palm side, and the heel of the hand opposite it (pressed flat on a handle)
      const g = grip ? .55 : 1;
      const nk = o.wrist === 'neck' ? 1 : 0, c0 = P * (.3 + .14 * nk), l0 = 1 - .25 * nk; // (b2: the balls of the hand below the wrist)
      blob(skin, at(c0, T * .3 * g, .024), D, W, N, P * .3 * l0, .016 * S * o.palmW, T * .34 * g, 6, 3);
      blob(skin, at(c0, T * .24 * g, -.03), D, W, N, P * .26 * l0, .012 * S * o.palmW, T * .26 * g, 5, 3);
    }
  }
  // ---- the fingers
  const ps = POSES[pose] || POSES.relaxed, segsOf = (L) => (o.segs === 2 ? [L[0], L[1] + L[2]] : L);
  const tips = [];
  FINGERS.forEach(([w, back, r0, L0], i) => {
    const L = segsOf(L0.map((x) => x * S * o.fl)), r = r0 * fr, K = at(P - back * S, .001 * S, w);
    let pts;
    if (grip) pts = hugChain(K, V3(0, 0, 0), rh + r * (o.sec < 1 ? 1.22 : 1.1) * (1 + o.bulge), L, -1); // (clear of the handle: a bent joint's ring is a little wider)
    else {
      const sp = ps.spread * (1.5 - i) * (i === 3 ? 1.3 : 1), f0 = D.clone().multiplyScalar(Math.cos(sp)).addScaledVector(W, Math.sin(sp)).normalize();
      const th = ps.th.map((x) => x + (ps.extra * i) / 3);
      const thS = o.segs === 2 ? [th[0], th[1] + th[2] * .7] : th;
      pts = flexChain(K, f0, N, L, thS);
    }
    // the tube starts back inside the palm (closed there too: an open end never shows through the back of the hand)
    const base = pts[0].clone().addScaledVector(D, -.014 * S);
    const all = [base, ...pts]; for (let j = 1; j < all.length - 1; j++) all[j].userData_j = true;
    const rs = all.map((_, j) => r * Math.pow(o.taper, Math.max(0, j - 1) / (all.length - 2) * (o.segs === 2 ? 1 : 1.4)));
    sweep(skin, all, rs, BK, o, o.bulge, line);
    tips.push({ pts: all, r: rs[rs.length - 1] });
  });
  // ---- the thumb: from its root in the heel of the palm, two phalanges
  {
    const r = THUMB.r * fr, L = THUMB.l.map((x) => x * S * o.fl), root = at(P * .08, T * .1, .022), mcp = at(P * .36, T * .55, .04);
    let pts;
    if (grip) { // over the top of the handle and down its far side, a little ahead of the index finger
      const R = rh + r * (o.sec < 1 ? 1.22 : 1.05), zt = (FINGERS[0][0] + .013) * S + zc, a1 = 62 * Math.PI / 180;
      const j1 = V3(Math.cos(a1) * R, Math.sin(a1) * R, zt), rest = hugChain(j1, V3(0, 0, 0), R, L, 1);
      rest.forEach((q, j) => { const t = j / (rest.length - 1); q.z -= .02 * S * t; if (t > .5) q.multiplyScalar(1 + .25 * (t - .5) * FINGERS[0][2] * fr / R).setZ(q.z); }); // (its tip crosses onto the index and middle fingers)
      pts = [root, mcp.lerp(j1, .35), ...rest];
    } else {
      const tp = ps.thumb, f0 = D.clone().multiplyScalar(tp.dir[0]).addScaledVector(W, tp.dir[1]).addScaledVector(N, tp.dir[2]).normalize();
      let n0 = tp.tw ? D.clone().multiplyScalar(tp.tw[0]).addScaledVector(W, tp.tw[1]).addScaledVector(N, tp.tw[2]) : N.clone().multiplyScalar(.7).addScaledVector(W, -.7);
      n0.addScaledVector(f0, -n0.dot(f0)).normalize();
      const m = mcp.clone().addScaledVector(f0, .004 * S);
      pts = [root, ...flexChain(m, f0, n0, L, tp.th)];
    }
    for (let j = 1; j < pts.length - 1; j++) pts[j].userData_j = true;
    const rs = pts.map((_, j) => r * (j === 0 ? 1.12 : Math.pow(o.taper, (j - 1) / (pts.length - 2))));
    const up = pts[2].clone().sub(pts[1]).cross(W).normalize(); if (up.dot(BK) < 0) up.negate();
    sweep(skin, pts, rs, grip ? BK : up.lengthSq() ? up : BK, o, o.bulge, line, 2); // (no crease at its root, in the heel)
    tips.push({ pts, r: rs[rs.length - 1], thumb: true });
  }
  // ---- nails: a thin lighter shell on the back of each fingertip
  if (nail) for (const t of tips) {
    const p = t.pts, n = p.length, a = p[n - 1], b = p[n - 2], ax = a.clone().sub(b).normalize();
    let up = t.thumb ? N.clone().negate() : BK.clone(); up.addScaledVector(ax, -up.dot(ax)).normalize();
    const side = ax.clone().cross(up), len = Math.min(a.distanceTo(b) * .55, .013 * S);
    blob(nail, a.clone().addScaledVector(ax, -len * .25).addScaledVector(up, t.r * o.flat * .86), ax, side, up, len * .62, t.r * .72, t.r * .16, 5, 2);
  }
  // ---- wraps (option c): leather bands round the palm and the wrist
  if (wrap) {
    const sides = o.pSides, band = (d0, d1, inflate) => {
      const rings = [];
      for (const d of [d0, d1]) { const t = d / P, w = (PALM.w0 + (PALM.w1 - PALM.w0) * Math.min(1, t * 1.4)) * S * o.palmW; rings.push(ring(at(d, (o.thenar ? .002 : 0) * S, -.001), W, BK, w * inflate, T / 2 * inflate + .003, sides, o.pSec)); }
      wrap.grid(rings, sides);
    };
    band(P * .5, P * .78, 1.07); band(P * .08, P * .3, 1.1); band(-.022 * S, P * .02, 1.14);
  }
  // turned as a whole (a townsman's upright staff: handGeo 'gripy'), before the wrist is laid from the forearm to it
  if (M) { const nm = new THREE.Matrix3().getNormalMatrix(M), v = V3(); for (const B of [skin, nail, wrap, line]) if (B) for (let i = 0; i < B.p.length; i += 3) { v.fromArray(B.p, i).applyMatrix4(M).toArray(B.p, i); v.fromArray(B.n, i).applyMatrix3(nm).normalize().toArray(B.n, i); } }
  // ---- the wrist (b1-b3): no ball. A sleeve of skin from inside the forearm's end (its own rim, ring for ring, so there is
  // no step) to the palm a little below it, each line of it a curve leaving the forearm along its side and meeting the palm
  // along the palm (no crease); b2 pinches it in the middle (a narrow, flattened wrist). Its weights (attribute 'bend')
  // hand it from the forearm (1) to the hand (0) over its length, so a bent wrist bends (rigbatch.js: two bones).
  if (o.wrist) {
    const rim = fa?.rim || DEF_RIM, n = rim.length, ws = n * Math.max(1, Math.ceil((o.wSides || o.pSides) / n)), fy = rim[0].y, ax = V3(0, fy, rim.reduce((t, q) => t + q.z, 0) / n), ph = Math.atan2(rim[0].x, rim[0].z - ax.z);
    const rimAt = (j) => { const u = j / ws * n, s0 = Math.floor(u) % n; return rim[s0].clone().lerp(rim[(s0 + 1) % n], u - Math.floor(u)); }; // (the rim's polygon, resampled)
    const R0 = Array.from({ length: ws }, (_, j) => rimAt(j)), tp = (q) => (M ? q.applyMatrix4(M) : q), td = (q) => (M ? q.transformDirection(M) : q);
    const palmAt = (d, sc = 1) => { const t = Math.max(0, d / P), w = (PALM.w0 + (PALM.w1 - PALM.w0) * Math.min(1, t * 1.4)) * S * o.palmW, heel = 1 + (o.heel || 0) * Math.max(0, 1 - t / .55) ** 2; return ring(tp(at(d, (o.thenar ? .002 : 0) * S, -.001)), td(W.clone()), td(BK.clone()), w * sc, T / 2 * sc * heel, ws, o.pSec, ph); }; // (in step with the rim)
    const drop = o.wrist === 'neck' ? .034 : .03;
    let dJ = .1 * P; for (let d = 0; d <= P * .6; d += .002) { const q = tp(at(d, 0, 0)); dJ = d; if (q.y < fy - drop) break; }
    const PJ = palmAt(dJ, 1.1), PI = palmAt(dJ + .014 * S, 1.02), Dd = td(D.clone()).normalize(), cJ = PJ.reduce((t, q) => t.add(q), V3()).divideScalar(ws);
    const L = cJ.distanceTo(ax) * .42, down = V3(0, -1, 0);
    const curve = (j, t) => { // a cubic from the rim (straight on down the forearm, its taper drawn in a little) to the palm (along it)
      const p0 = R0[j], p3 = PJ[j], t0 = down;
      const p1 = p0.clone().addScaledVector(t0, L), p2 = p3.clone().addScaledVector(Dd, -L), u = 1 - t;
      return p0.clone().multiplyScalar(u * u * u).addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
    };
    const ts = o.crease ? [.16, .3, .34, .38, .56, .74, .88] : [.16, .33, .5, .67, .84], pinch = (t) => (o.wrist === 'neck' ? 1 - .3 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 2 : o.crease && t === .34 ? .955 : 1); // (final: the crease, one ring drawn in)
    const body = ts.map((t) => { const pts = R0.map((_, j) => curve(j, t)), c = pts.reduce((q, v) => q.add(v), V3()).divideScalar(ws), k = pinch(t); return pts.map((v) => (o.wrist === 'neck' ? v.sub(c).multiply(V3(k * .85, 1, k)).add(c) : k !== 1 ? v.sub(c).multiplyScalar(k).add(c) : v)); });
    const inner = (sc, dy) => R0.map((v) => v.clone().sub(ax).multiplyScalar(sc).add(ax).setY(fy + dy));
    if (line && o.crease && !grip) { // the wrist's crease: a thin ring in the groove, a hair proud of it
      const band = [.33, .35].map((t) => { const pts = R0.map((_, j) => curve(j, t)), c = pts.reduce((q, v) => q.add(v), V3()).divideScalar(ws); return pts.map((v) => v.sub(c).multiplyScalar(.99).add(c)); });
      line.grid(band, ws);
    }
    // a fist: its palm already fills the forearm's end (its root sits up inside it), a sleeve over it would only show its
    // own outline; the open end gets a cap set a little up inside instead
    if (grip) skin.grid([inner(.1, .016), inner(.6, .011), inner(.93, .004), R0.map((v) => v.clone())], ws);
    else { skin.grid([inner(.2, .03), inner(.82, .016), R0.map((v) => v.clone())], ws); skin.grid([R0.map((v) => v.clone()), ...body, PJ, PI, PI.map((v) => v.clone().lerp(PI.reduce((t, q) => t.add(q), V3()).divideScalar(ws), .7))], ws); } // (the cap and the wrist apart: the rim's normals from the wrist's side only, along the forearm's, so their outlines meet)
    wristW = { y0: grip ? tp(at(P, 0, 0)).y : cJ.y, fy, x1: grip ? rh + T * .3 : null }; // (a fist bends over the whole palm: the hand turns about the handle, not the wrist; the fingers round the handle stay on it)
  }
  const g = skin.geometry();
  const lg = line && line.p.length ? line.geometry() : null;
  if (o.wrist) { bendWeights(g, wristW); if (lg) bendWeights(lg, wristW); }
  return { skin: g, nail: nail && nail.geometry(), wrap: wrap && wrap.geometry(), line: lg };
}
// b1-b3: each vertex's share of the forearm bone, by its height alone (so what touches moves together, nothing tears): 1 at
// the forearm's end and above (inside it), easing to 0 where the wrist meets the palm (a fist: at the knuckles)
const BEND = 'bend';
function bendWeights(g, W) {
  const p = g.attributes.position, w = new Float32Array(p.count), { y0, fy, x1 } = W, ss = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  for (let i = 0; i < p.count; i++) w[i] = ss((p.getY(i) - y0) / (fy - y0)) * (x1 ? Math.max(ss(p.getX(i) / x1), ss((p.getY(i) - y0) / (fy - y0) * 2 - 1)) : 1);
  g.setAttribute(BEND, new THREE.BufferAttribute(w, 1));
}
const WRIST_R = .048; // the forearm's end (humanoid(): radius .048 at the bone's -.28; the hand bone sits at -.32, z +.02)
// the forearm's rim in the hand bone's space when the rig's own is not known: humanoid()'s, six sides
const DEF_RIM = Array.from({ length: 6 }, (_, j) => { const a = j / 6 * Math.PI * 2; return V3(WRIST_R * Math.sin(a), .04, -.02 + WRIST_R * Math.cos(a)); });
const cache = new Map();
export function handGeo(id, pose, side, k, fa = null) {
  const key = id + pose + side + k + (fa && OPT[id]?.wrist ? fa.key : '');
  let g = cache.get(key);
  if (!g) {
    if (side === 'L') g = mirror(handGeo(id, pose, 'R', k, fa));
    else if (pose.startsWith('gripy')) { // a pole along the bone's y (the townsfolk's staffs): the fist turned to close round it, wrist up behind
      const [, rr, cz] = pose.split(':'), M = new THREE.Matrix4().makeTranslation(0, -.004, +cz).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      g = buildHand(id, 'grip:' + rr, k, M, fa);
    } else g = buildHand(id, pose, k, null, fa);
    cache.set(key, g);
  }
  return g;
}
function mirror(set) { // the left hand: x mirrored, the triangles turned back the right way out
  const out = {};
  for (const k in set) {
    const g = set[k]; if (!g) { out[k] = null; continue; }
    const m = g.clone(); m.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    const ix = m.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    m.index.needsUpdate = true; m.computeBoundingSphere(); out[k] = m;
  }
  return out;
}
// sizes for the tests: the open hand's length from the forearm's end (y .04) and the knuckles' span across
export const handSize = (id = HANDS) => { const o = OPT[id]; if (!o) return null; const g = handGeo(id, 'open', 'R', 1).skin; g.computeBoundingBox(); return { len: .04 - g.boundingBox.min.y, knuckles: (FINGERS[0][0] - FINGERS[3][0]) * o.k + (FINGERS[0][2] + FINGERS[3][2]) * o.k * o.fr, palm: 2 * PALM.w1 * o.k * o.palmW }; };
export const handTris = (id = HANDS, pose = 'relaxed') => { if (!OPT[id]) return 0; const g = handGeo(id, pose, 'R', 1); let n = 0; for (const k in g) if (g[k]) n += g[k].index.count / 3; return n; };

// ---------------------------------------------------------------------------------- on a rig
const mats = new Map();
const toon = (hex) => { if (!mats.has(hex)) mats.set(hex, new THREE.MeshToonMaterial({ color: hex, gradientMap: toonRamp() })); return mats.get(hex); };
const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const RB = (k) => Math.round(k * 50) / 50; // hand sizes in steps of 2%
// Give rig r hands (option id, default ?hands=): find the old ball hand on each forearm (humanoid(): radius .055 at the
// forearm's end), keep it as a smaller wrist, and hang the hand mesh on the hand bone. Once per rig, before it is outlined
// and before its parts are merged (models.js refineRig / makeV, cast.js bake). Faceless rigs (beasts, shades, statues) keep
// the ball. o: { fem, fighter, k }
export function giveHands(r, o = {}, id = HANDS) {
  if (!OPT[id] || !r?.handL || !r.elbowL || r.hands || r.s?.faceless) return r;
  const opt = OPT[id], fem = o.fem ?? !!(r.s?.female || r.info?.female || r.isV && !r.male), k = RB((o.k ?? 1) * (fem ? .93 : 1.02) * (r.info?.child ? .96 : 1));
  const fighter = o.fighter ?? !!(r.warParts || r.info?.kind === 'soldier');
  const out = {};
  for (const side of ['L', 'R']) {
    const E = r['elbow' + side], H = r['hand' + side];
    const ball = E.children.find((c) => c.isMesh && c.geometry.parameters?.radius === .055 && c.position.y < -.25);
    if (!ball) return r;
    const m0 = ball.material, col = m0.color ? '#' + m0.color.getHexString() : r.s?.skin || '#e2b08c';
    if (opt.wrist) ball.visible = false; // (b1-b3: the hand's own wrist joins the forearm)
    else { ball.scale.set(.7, .56, .66); ball.position.y = -.29; } // (the wrist, under the palm's root)
    if (opt.wrist === 'cuff') cuff(r, E, m0);
    const g = handGeo(id, 'relaxed', side, k);
    const skin = new THREE.Mesh(g.skin, m0); skin.castShadow = true; skin.name = 'hand' + side; skin.userData.hand = side; H.add(skin);
    const nail = g.nail ? new THREE.Mesh(g.nail, toon(mix(col, '#fff0ea', opt.nailTint || .5))) : null;
    if (nail) { nail.castShadow = false; nail.userData.hand = side; H.add(nail); }
    const line = g.line ? new THREE.Mesh(g.line, toon(mix(col, '#5a2a1c', .3))) : null; // (final: the creases; no outline, no shadow)
    if (line) { line.castShadow = false; line.userData.hand = side; H.add(line); }
    const wrap = g.wrap && fighter ? new THREE.Mesh(g.wrap, toon('#6a4a30')) : null; // (the wraps: fighters only)
    if (wrap) { wrap.castShadow = true; wrap.userData.hand = side; H.add(wrap); r.warParts?.push(wrap); }
    out[side] = { skin, nail, wrap, line, pose: 'relaxed', ball };
  }
  r.hands = { id, k, L: out.L, R: out.R, park: !(r.isV || r.male || r.warParts) }; // (heroes: Val, an online man)
  for (const side of ['L', 'R']) seat(r, side, 'relaxed');
  fitWrists(r);
  return r;
}
// b1-b3: the wrist starts from the forearm's own rim (as built, or as cast.js sculptNpc reshaped it: call again after),
// and the forearm loses its bottom cap (the wrist closes it; a cap's outline would draw a ring round the joint). The hand's
// skin knows the forearm bone it bends from (rigbatch.js: userData.bend).
const _fm = new THREE.Matrix4(), _fv = new THREE.Vector3();
export function fitWrists(r) {
  const A = r.hands; if (!A || !OPT[A.id]?.wrist) return r;
  const H = r.handR, skinMat = A.R.skin.material;
  const foreOf = (E) => E.children.find((m) => m.isMesh && m.material === skinMat && m.geometry.parameters?.radiusBottom > .03 && m.geometry.parameters.radiusBottom < .07 && m.position.y < -.08 && m.position.y > -.2);
  for (const E of [r.elbowL, r.elbowR]) { const m = foreOf(E); if (m && !m.geometry.userData.capless) { const cg = wristArm(m.geometry, OPT[A.id].wrist !== 'neck'); m.geometry = cg; for (const c of m.children) if (c.userData.outline) c.geometry = cg; } }
  const fore = foreOf(r.elbowR);
  if (fore) {
    const g = fore.geometry, q = g.parameters, p = g.attributes.position; fore.updateMatrix(); _fm.copy(fore.matrix).premultiply(new THREE.Matrix4().makeTranslation(-H.position.x, -H.position.y, -H.position.z));
    const pts = []; // the side's bottom row: the first (radialSegments + 1) x (heightSegments + 1) vertices are the side, row by row
    const row = q.heightSegments * (q.radialSegments + 1);
    for (let j = 0; j < q.radialSegments; j++) pts.push(_fv.fromBufferAttribute(p, row + j).applyMatrix4(_fm).clone());
    const cz = pts.reduce((t, v) => t + v.z, 0) / pts.length, ang = (v) => (Math.atan2(v.x, v.z - cz) + 2 * Math.PI) % (2 * Math.PI); pts.sort((a, b) => ang(a) - ang(b)); // (round from the thumb's side, whichever way the part was turned)
    A.fa = { rim: pts, key: '|' + pts.map((v) => v.toArray().map((x) => x.toFixed(3)).join()).join(';') };
  }
  for (const side of ['L', 'R']) {
    const h = A[side], g = handGeo(A.id, h.pose, side, A.k, A.fa);
    for (const [m, geo] of [[h.skin, g.skin], [h.nail, g.nail], [h.line, g.line]]) { if (!m || !geo) continue; for (const c of m.children) if (c.userData.outline && c.geometry === m.geometry) c.geometry = geo; m.geometry = geo; }
    h.skin.userData.bend = r['elbow' + side];
  }
  return r;
}
// the forearm for b1-b3: open at the wrist (the hand's wrist closes it), and a plain one (humanoid(): a straight taper)
// narrowed over its lower half to a wrist's section, flatter than wide (WX across the palm's thickness, WZ thumb to little
// finger), so the hand's wrist meets an end its own size. A forearm already shaped (cast.js sculptNpc: rows) keeps its shape.
const WX = .033, WZ = .04, ARMS = [new WeakMap(), new WeakMap()];
function wristArm(g, shape) {
  let c = ARMS[+shape].get(g); if (c) return c;
  const q = g.parameters;
  if (q.heightSegments > 1 || !shape) { c = g.clone(); const gr = g.groups, end = gr.length >= 3 ? gr[2].start : g.index.count; c.setIndex(Array.from(g.index.array).slice(0, end)); c.clearGroups(); }
  else {
    c = new THREE.CylinderGeometry(q.radiusTop, q.radiusBottom, q.height, q.radialSegments, 6, true); const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rr = Math.hypot(x, z), t = Math.min(1, Math.max(0, ((q.height / 2 - y) / q.height - .38) / .62)), k = t * t * (3 - 2 * t);
      const re = 1 / Math.hypot(x / rr / WX, z / rr / WZ), f = 1 + (Math.min(rr, re) / rr - 1) * k; p.setX(i, x * f); p.setZ(i, z * f);
    }
    c.computeVertexNormals();
  }
  c.userData.capless = true; ARMS[+shape].set(g, c); return c;
}
// b3: a bracer or sleeve on the forearm reaches down over the wrist: an open, slightly flared band in its own material on the
// forearm bone (drawn with the bracer: no new draw), shown and hidden with it (r.warParts)
const _cb = new THREE.Box3();
function cuff(r, E, skinMat) {
  let best = null;
  for (const m of E.children) {
    if (!m.isMesh || m.userData.outline || m.userData.hand || m.material === skinMat || !m.geometry?.attributes?.position) continue;
    m.updateMatrix(); if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); _cb.copy(m.geometry.boundingBox).applyMatrix4(m.matrix);
    const rad = (_cb.max.x - _cb.min.x) / 2;
    if (_cb.min.y > -.15 || _cb.min.y < -.3 || rad < .045 || rad > .09 || (best && _cb.min.y > best.y)) continue;
    best = { m, y: _cb.min.y, rad };
  }
  if (!best) return null;
  const y0 = best.y + .014, y1 = -.31, h = y0 - y1;
  const c = new THREE.Mesh(new THREE.CylinderGeometry(best.rad * .97, WRIST_R * 1.13, h, 14, 1, true), best.m.material);
  c.position.set(0, (y0 + y1) / 2, 0); c.castShadow = true; c.userData.cuff = true; E.add(c);
  if (r.warParts?.includes(best.m)) r.warParts.push(c);
  c.visible = best.m.visible; return c;
}
// ---- the pose every frame
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _b = new THREE.Box3();
const held = (H) => { for (const c of H.children) if (c.visible && !c.userData.hand && !c.userData.outline && hasMesh(c)) return c; return null; };
const hasMesh = (o) => { if (o.isMesh) return o.visible; for (const c of o.children) if (c.visible && hasMesh(c)) return true; return false; };
// the radius of what a hand holds at its grip point (the thinnest visible part through the hand's origin, across its long
// axis), measured once per held object (in the hand's space)
const gripCache = new WeakMap();
function gripRadius(H, obj) {
  let r = gripCache.get(obj); if (r !== undefined) return r;
  r = .026; let best = 1, ay = null;
  H.updateMatrixWorld(true); const inv = _m.copy(H.matrixWorld).invert();
  obj.traverse((m) => {
    if (!m.isMesh || m.userData.outline || !m.visible || !m.geometry?.attributes?.position) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    _b.copy(m.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (!_b.containsPoint(_v.set(0, 0, 0)) && _b.distanceToPoint(_v) > .012) return;
    const s = _b.getSize(new THREE.Vector3()); // a handle runs along z (weapons.js); a townsman's staff stands along y; bands, guards and pommels do neither
    if (s.y >= 1.5 * Math.max(s.x, s.z)) { const cr = Math.max(s.x, s.z) / 2; if (cr > .006 && cr < best) { best = cr; r = cr; ay = (_b.min.z + _b.max.z) / 2; } return; }
    if (s.z < 1.5 * Math.max(s.x, s.y)) return;
    const cr = Math.max(s.x, s.y) / 2;
    if (cr > .006 && cr < best) { best = cr; r = cr; ay = null; }
  });
  r = Math.round(Math.min(.045, Math.max(.016, r)) * 250) / 250; // (in 4 mm steps: a few cached shapes)
  r = ay === null ? 'grip:' + r : 'gripy:' + r + ':' + Math.round(ay * 250) / 250;
  gripCache.set(obj, r); return r;
}
// is the left hand on the right hand's haft (a great weapon, a spear in both hands)?
const _hp = new THREE.Vector3();
function onHaft(r) {
  const W = r.weaponR; if (!W || !W.visible || W.parent !== r.handR) return 0;
  r.handL.getWorldPosition(_hp); W.worldToLocal(_hp);
  const on = r.hands?.L.haft, d = Math.hypot(_hp.x, _hp.y); // (in at 7 cm, out past 10: no flicker at the edge)
  if (d > (on ? .1 : .07)) { if (r.hands) r.hands.L.haft = false; return 0; }
  if (r.hands) r.hands.L.haft = true;
  const g = gripRadius(r.handR, W); return g.startsWith('gripy') ? 0 : g;
}
export function handPose(r, side, st = {}) {
  const f = r.handPose?.[side]; if (f) return f;
  const H = r['hand' + side], h = held(H);
  if (h) return gripRadius(H, h);
  if (side === 'L') { const g = onHaft(r); if (g) return g; }
  if (st.skill && !st.skill.done) return 'open';
  if (side === 'L' && r.shield && r.shield.visible && r.shield.parent && r.shield.parent !== r.torso) return 'fist'; // (the shield's grip)
  if (st.moving && st.run) return 'fist';
  return 'relaxed';
}
// Where a hand hangs (draw calls): a townsman's empty hand rides the forearm, at the hand bone's own place, so it is drawn
// with the forearm (rigbatch.js: one draw per moving bone and material); a hand bone that gestures would otherwise be one
// more draw (and hull and shadow) per hand in a crowd. A hand that holds something, and the heroes' hands, ride the hand
// bone itself (it turns the fingers with the weapon; a hero's hand bone carries the weapon's draw already).
function seat(r, side, p) {
  const h = r.hands[side], H = r['hand' + side], E = r['elbow' + side], park = r.hands.park && !p.startsWith('grip'), P = park ? E : H;
  for (const m of [h.skin, h.nail, h.wrap, h.line]) {
    if (!m || m.parent === P) continue;
    P.add(m); if (park) m.position.copy(H.position); else m.position.set(0, 0, 0);
  }
}
// every frame (models.js animateRig): swap a hand's shape when its pose changes (rare: the batch re-merges that bone)
export function updateHands(r, st) {
  const A = r.hands; if (!A) return;
  for (const side of ['L', 'R']) {
    const h = A[side], p = handPose(r, side, st || {});
    if (p === h.pose) continue;
    h.pose = p; seat(r, side, p);
    const g = handGeo(A.id, p, side, A.k, A.fa);
    for (const [m, geo] of [[h.skin, g.skin], [h.nail, g.nail], [h.wrap, g.wrap], [h.line, g.line]]) {
      if (!m || !geo) continue;
      for (const c of m.children) if (c.userData.outline && c.geometry === m.geometry) c.geometry = geo;
      m.geometry = geo;
    }
  }
}
