// Round 33 (CHARS, from V's braids): a rope or chain of points that moves by physics, for hair, braids, cloaks, capes,
// tails, manes, belts and hanging trophies. Nothing but physics moves the points: gravity, inertia, air drag (wind from
// the body's own speed, growing with its square and much more in a rush of air above ~11 m/s: a gallop, a dragon), fixed
// link lengths, a bending limit, a stiffness back towards a resting line the body carries (so a braid lies down a back
// and a cape hangs from the shoulders), a damping of each point's swing against how the body carries that spot, and solid
// bodies (a skull, a back, legs) it bounces off. A rope at rest sleeps: the last millimetres of drift are let go, so a
// standing figure's hair hangs dead still. A roll or a fall carries it with the body; a teleport lays it out again.
//
//   const R = makeRope({ n: 6, link: .08, anchor: (out) => ..., rest: (i, out) => ..., collide, radius, hang })
//   stepRope(R, dt, st)  // after the pose each frame (animateRig does it for r.ropes); R.p are the points (world space)
//   ropeDress(R, root)   // or put meshes along it yourself: R.p[i] .. R.p[i + 1] is link i
//
// Options (all optional but anchor and rest):
//   n           points, the anchor included (n - 1 links)
//   link        link length at scale 1 (m); scale() the body's world scale (link * scale is used)
//   anchor(out) the root point in world space this frame (a Vector3 to fill); rest(i, out) point i's resting spot (i >= 1)
//   hang        a world direction to lay it out along on the first frame (default straight down)
//   k, damp     stiffness towards the rest line (1/s^2) and damping against the body's motion (1/s)
//   drag(v)     quadratic air drag (1/m) at speed v; bounce: how much speed into a solid body comes back out of it
//   fold        a link and the one after it never close tighter than fold * link (no folding back on itself)
//   reach(i)    the furthest point i may stray from its rest spot while the line holds (m), so a snag never throws it wild
//   collide(p, q, rr) push point p (radius rr) out of the solid bodies and return the surface normal it hit, or null
//   radius(i)   point i's radius at scale 1 (for collide); floor: a world y it never goes under (or null)
//   still       the speed (m/s, relative to the anchor) under which the whole rope is let go to rest
//   sub         the longest substep (s, default .006); soft, slow ropes (cloth, hair) stay stable at ~.011 for half the cost
//   relHit      bounce off the solid bodies as they move (relative to the anchor), not as if they stood still
import * as THREE from './three.module.min.js';
import { WIND } from './wind.js'; // round 33 (physics): the world's one wind (wind.js); R.wind scales its push on this rope (default 1, 0 for none)

export const ROPE = { // V's braids: heavy, thick, a little give and a small bounce
  n: 11, link: .056, k: 700, damp: 38, bounce: .1, fold: 1.7, still: .05,
  drag: (v) => { const t = Math.min(1, Math.max(0, (v - 11) / 5)); return .02 + .1 * t * t * (3 - 2 * t); },
  reach: (i) => .06 + i * .03,
};
const _V = new THREE.Vector3(), _W = new THREE.Vector3(), _N = new THREE.Vector3(), _A = new THREE.Vector3(), _D = new THREE.Vector3();
const _DOWN = new THREE.Vector3(0, -1, 0);

export function makeRope(o) {
  const R = { ...ROPE, ...o, p: [], q: [], v: [], r: null, live: false, hit: null };
  R.radius ||= () => .02; R.scale ||= () => 1;
  return R;
}

// one frame. st: the rig's animation state (st.roll >= 0 rolling, st.dead === true falling: the rope rides with the body)
export function stepRope(R, dt, st = {}) {
  const run = dt > 0, dtv = Math.min(Math.max(dt || .016, .001), .1); dt = Math.min(dtv, .04); // (dtv: the frame's real length, for speeds)
  const N = R.n, rs = R.scale(), L = R.link * rs, a = R.anchor(R._a ||= new THREE.Vector3());
  if (!R.live || R.p[0].distanceTo(a) > 1.5) { // first frame, or a jump (teleport, cut): laid out at rest (along hang, or on its rest line)
    const hang = R.hang ? R.hang(_D) : _D.copy(_DOWN);
    for (let i = 0; i < N; i++) { R.p[i] = R.initRest && i ? R.rest(i, new THREE.Vector3()) : a.clone().addScaledVector(hang, i * L); R.q[i] = R.p[i].clone(); R.v[i] = new THREE.Vector3(); }
    R.live = true; R.vs = null;
  }
  const va = _A.subVectors(a, R.p[0]).divideScalar(dtv).clone(); // how fast the rope's root is moving (over the whole frame: at 20 fps a run read as a gallop)
  if (va.lengthSq() > 400) va.set(0, 0, 0);
  // this frame's resting line and last frame's (to sweep between in the substeps, and for how fast the body carries each spot)
  const Rv = R.r || [], R0 = Rv, R1 = Rv === R._ba ? (R._bb ||= []) : (R._ba ||= []); // (two buffers, this frame's and last frame's)
  for (let i = 0; i < N; i++) R1[i] = i ? R.rest(i, R1[i] || new THREE.Vector3()) : (R1[i] || new THREE.Vector3()).copy(a);
  const a0 = R.p[0].clone(), hits = (R._hits ||= []);
  if ((st.roll !== undefined && st.roll >= 0) || st.dead === true) { // a roll or a fall tumbles the body: the rope rides with it
    const fr = 1 - Math.exp(-40 * dt); for (let i = 1; i < N; i++) { R.p[i].lerp(R1[i], fr); R.q[i].copy(R.p[i]); R.v[i].copy(va); }
  } else if (run) {
    // position-based steps, several per frame (stable at any frame rate), every point with its own velocity (m/s)
    // in a rush of wind the line gives way: a speed kept up for a moment (a gallop, a flight), not one frame's swing of the
    // head round a sharp turn (Motion 49b0961: the head leads a turn, and a sprint's reversal read as a rush for a frame)
    const vs = va.length(); R.vs = R.vs == null ? vs : R.vs + (vs - R.vs) * (1 - Math.exp(-dtv / .1));
    const k = R.k * (1 - .9 * Math.min(1, Math.max(0, (R.vs - 11) / 5)));
    const n = Math.max(1, Math.ceil(dt / (R.sub || .006))), h = dt / n; // (R.sub: the longest substep; a soft cloth takes longer ones)
    const wk = R.wind ?? 1, calm = WIND.s * wk < .55; // (in a strong wind a rope never lies still)
    for (let sub = 1; sub <= n; sub++) {
      const f = sub / n; R.p[0].lerpVectors(a0, a, f);
      for (let i = 1; i < N; i++) {
        const p = R.p[i], v = R.v[i], sp = v.length(), r0 = R0[i] || R1[i];
        const rest = _W.lerpVectors(r0, R1[i], f), vr = _N.subVectors(R1[i], Rv[i] || R1[i]).divideScalar(dtv);
        if (vr.lengthSq() > 400) vr.set(0, 0, 0);
        v.sub(vr).multiplyScalar(Math.exp(-R.damp * h)).add(vr); // damped against how the body carries that spot
        v.addScaledVector(rest.sub(p), k * h);                    // the rope's own stiffness
        v.y -= 9.8 * h; v.addScaledVector(v, -Math.min(.9, R.drag(sp) * sp * h)); // gravity, and drag against the air
        if (wk) { v.x += WIND.ax * wk * h; v.z += WIND.az * wk * h; } // the wind's push (wind.js)
        R.q[i].copy(p); p.addScaledVector(v, h);
      }
      for (let it = 0; it < 3; it++) for (let i = 1; i < N; i++) { // links keep their length (the root end holds)
        const p = R.p[i], pr = R.p[i - 1]; _V.subVectors(p, pr); const d = _V.length() || 1e-6;
        p.copy(pr).addScaledVector(_V, L / d);
        if (i > 1) { const p2 = R.p[i - 2]; _V.subVectors(p, p2); const d2 = _V.length() || 1e-6; if (d2 < R.fold * L) p.copy(p2).addScaledVector(_V, R.fold * L / d2); }
        const hn = R.collide ? R.collide(p, R.q[i], R.radius(i) * rs, i) : null;
        hits[i] = hn ? (hits[i] || new THREE.Vector3()).copy(hn) : null;
      }
      for (let i = 1; i < N; i++) {
        const v = R.v[i]; v.subVectors(R.p[i], R.q[i]).divideScalar(h);
        const nn = hits[i]; if (nn) { const vn = v.dot(nn) - (R.relHit ? va.dot(nn) : 0); if (vn < 0) v.addScaledVector(nn, -vn * (1 + R.bounce)); } // off the body (R.relHit: as it moves)
      }
    }
    // never thrown further than its own reach from where it hangs (no wild pops after a snag)
    if (k > R.k * .5) for (let i = 1; i < N; i++) { const lim = R.reach(i); _V.subVectors(R.p[i], R1[i]); const d = _V.length(); if (d > lim) { R.p[i].copy(R1[i]).addScaledVector(_V, lim / d); R.v[i].multiplyScalar(.5); } }
    // at rest it is at rest: the last millimetres of drift are let go
    let still = true; for (let i = 1; i < N; i++) if (_A.subVectors(R.v[i], va).lengthSq() > R.still * R.still) { still = false; break; }
    if (still && calm) for (let i = 1; i < N; i++) R.v[i].copy(va);
    R.still = still && calm; // (moving only with the body: a caller may let it sleep)
  }
  R.p[0].copy(a); R.r = R1;
  return R;
}

// the usual solid bodies, as collide() helpers: a sphere (a skull) and an elliptic section in a body's frame (a back with a
// skirt below it). Each pushes p out to the surface and returns the outward normal, or null.
const _hitN = new THREE.Vector3(), _pl = new THREE.Vector3(), _q = new THREE.Quaternion();
export function hitSphere(p, c, rad) {
  _V.subVectors(p, c); const d = _V.length();
  if (d >= rad) return null;
  _hitN.copy(_V).divideScalar(d || 1); p.copy(c).addScaledVector(_hitN, rad); return _hitN;
}
// body: an Object3D; sec(y) -> [ax, az] the section's half widths at body-space height y (0 = none); rr / rs: the point's
// radius in body units
export function hitSection(p, body, y0, y1, sec, rrb) {
  const pl = body.worldToLocal(_pl.copy(p));
  if (pl.y <= y0 || pl.y >= y1) return null;
  const s = sec(pl.y); if (!s) return null;
  const ax = s[0] + rrb, az = s[1] + rrb, e = (pl.x / ax) ** 2 + (pl.z / az) ** 2;
  if (e >= 1) return null;
  const k = 1 / Math.sqrt(e || 1e-6); pl.x *= k; pl.z *= k; p.copy(body.localToWorld(pl));
  return _hitN.set(pl.x / (ax * ax), 0, pl.z / (az * az)).normalize().applyQuaternion(body.getWorldQuaternion(_q));
}

// a box in some body's own space (lo, hi its corners; the point q and its radius r in the same units), rounded by r: a
// point within r of it is pushed straight off it (so sliding round an edge or a corner is smooth), and one that got inside
// goes out through the nearest face that exits allows (one bit per face: 1 -x, 2 +x, 4 -y, 8 +y, 16 -z, 32 +z; a body
// that must only ever be left one way, a wing's back face, say, allows only that way). Moves q; the outward normal (in
// that space), or null.
export function hitBox(q, lo, hi, r, exits = 63) {
  const ox = q.x < lo.x ? q.x - lo.x : q.x > hi.x ? q.x - hi.x : 0, oy = q.y < lo.y ? q.y - lo.y : q.y > hi.y ? q.y - hi.y : 0, oz = q.z < lo.z ? q.z - lo.z : q.z > hi.z ? q.z - hi.z : 0;
  const d2 = ox * ox + oy * oy + oz * oz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-12) { const d = Math.sqrt(d2), k = r / d - 1; q.x += ox * k; q.y += oy * k; q.z += oz * k; return _hitN.set(ox / d, oy / d, oz / d); }
  let best = Infinity, face = -1;
  const f = (i, v) => { if (exits & (1 << i) && v < best) { best = v; face = i; } };
  f(0, q.x - lo.x); f(1, hi.x - q.x); f(2, q.y - lo.y); f(3, hi.y - q.y); f(4, q.z - lo.z); f(5, hi.z - q.z);
  if (face < 0) return null;
  const ax = 'xyz'[face >> 1], up = face & 1;
  q[ax] = up ? hi[ax] + r : lo[ax] - r;
  return _hitN.set(0, 0, 0).setComponent(face >> 1, up ? 1 : -1);
}

// lay meshes along a rope: list[i] = { m, i, w, d, t } puts mesh m on link i (between p[i] and p[i+1]), its +y along the
// link, scaled (w, link length * t or a fixed h, d). root: the space the meshes live in (their parent)
const _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0), _m4 = new THREE.Matrix4();
export function putOnLink(m, p0, p1, root, sx, sy, sz) {
  root.getWorldQuaternion(_rq2).invert();
  _V.subVectors(p1, p0).normalize(); _rq.setFromUnitVectors(_UP, _V);
  m.position.copy(root.worldToLocal(_W.copy(p0).add(p1).multiplyScalar(.5)));
  m.quaternion.copy(_rq2).multiply(_rq); if (sx !== undefined) m.scale.set(sx, sy, sz);
  return m;
}
// a chain of hinged pivots (a cape's lengths, a fall of hair, a tail) bent to follow a rope: pivots[j] is hinged at point
// j and hangs along its own -y to point j + 1; pivots[0] sits at the rope's anchor. Each is turned about x (and about z)
// so its -y runs along its link, in its parent's frame: x within [o.lo, o.hi], z within +-o.side. o.first: 'max' turns
// pivots[0] only further out than something else already put it (a cape's hinge clearing the legs), 'skip' leaves it be.
export function bendChain(pivots, R, o = {}) {
  const lo = o.lo ?? -1.2, hi = o.hi ?? 1.5, sd = o.side ?? .6;
  for (let j = 0; j < pivots.length && j + 1 < R.p.length; j++) {
    const pv = pivots[j], par = pv.parent; if (j === 0 && o.first === 'skip') continue;
    par.updateMatrixWorld(true);
    _D.subVectors(R.p[j + 1], R.p[j]).transformDirection(_m4.copy(par.matrixWorld).invert()); // (the parent's whole frame: a mirrored rig stays right)
    const x = Math.max(lo, Math.min(hi, Math.atan2(-_D.z, -_D.y))), z = Math.max(-sd, Math.min(sd, Math.atan2(_D.x, Math.hypot(_D.y, _D.z))));
    if (j === 0 && o.first === 'max') { if (x > pv.rotation.x) pv.rotation.x = x; pv.rotation.z = z * .5; }
    else { pv.rotation.x = x; pv.rotation.z = z; }
    pv.updateMatrixWorld(true);
  }
}
