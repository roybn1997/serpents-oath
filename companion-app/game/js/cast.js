// The Serpent's Oath: story cast, townsfolk and helpers (Cast agent).
// Every humanoid comes from humanoid() in models.js, so it animates with animateRig and takes finish() outlines.
// Extra rig fields: r.holds (hands kept on a held prop), r.snakes (Medusa), r.tick (per-rig idle life), r.lean.
import * as THREE from './three.module.min.js';
import { mat, box, tcyl, ball, cone, pivot, humanoid, finish, sword, makeSteed, animateSteed, armIK, aimHand, legIK, skull, PXFACE, clothFit, capeFlap, refineRig, setFace, hangChain, LOD } from './models.js';
import { addOutline } from './render.js';
import { fitWrists } from './hands.js'; // Roy 29.10 ("a ball isn't necessary to connect the hand and the wrist"): ?hands=b1-b3 and final
import * as PG from './pxgods.js'; // the gods' and heroes' own parts as pixel art (round 16)
import { PXART, ramp, rivet, kitMat, paFolds, paHem, paStitch, paBand, paLeather, paMetal, paHair, paCurl, paBeard, paWood, paLaces } from './pxart.js';
import { pxDress, eyeGlow, pxRig } from './pxfoes.js'; // the monsters' pixel art (Cerberus, the Minotaur, Typhon, Scylla, Charybdis)
export { makeSteed, animateSteed };

// ---------- small helpers ----------
const PI = Math.PI;
export function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];
const torusCache = new Map();
function torus(parent, R, r, color, x = 0, y = 0, z = 0, opts) {
  const key = `${R},${r},${opts?.arc ?? 0}`;
  if (!torusCache.has(key)) torusCache.set(key, new THREE.TorusGeometry(R, r, 4, 12, opts?.arc ?? PI * 2));
  const m = new THREE.Mesh(torusCache.get(key), mat(color, opts)); m.position.set(x, y, z); m.castShadow = !(opts && opts.noShadow); parent.add(m); return m;
}
const _u = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);
function strap(parent, a, b, w, h, color, opts) {
  _u.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _u.length();
  const m = box(parent, w, h, len, color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, kx('strap', color, opts));
  m.quaternion.setFromUnitVectors(_Z, _u.normalize()); return m;
}
// a pivot holding a hand target; r.holds keeps that hand on it every frame
function hold(r, side, parent, x, y, z) { const p = pivot(parent, x, y, z); (r.holds ||= []).push({ side, obj: p }); return p; }

// ---------- pixel-art dress (round 16): the kit's textures ----------
// Every kit piece wears a small painted texture: [W, H, paint(c, Q), o]. Cloth and trims are painted once on NEU and tinted
// per colour; hair, leather and metal per colour on ramp() (o.ramp), for lights a dark colour can't be tinted up to (kitMat,
// pxart.js). Q[3] is the piece's own colour. Cylinders are turned half round (turn) so the texture's middle faces front;
// balls face front at u .75. ?art=off: none of this, the flat colours as before.
const fill = (c, col) => c.R(0, 0, c.W, c.H, col), RP = { ramp: true }, CUT = { ramp: true, cut: true };
const gathers = (c, Q, y, h, step = 3) => { for (let x = 0; x < c.W; x += step) { c.R(x, y, 1, h, Q[2]); c.R(x + 1, y, 1, h - 1, Q[4]); } }; // cloth gathered under a belt or pin
const arcs = (c, Q, list, k = 1.6) => { for (const [xc, y0, hw] of list) for (let dx = -hw; dx <= hw; dx++) { const y = y0 - Math.round(k * (1 - (dx / hw) ** 2)); c.P(xc + dx, y, Q[4]); c.P(xc + dx, y + 1, Q[1]); } }; // slouch creases
const KIT = {
  // ---- cloth (tinted)
  robeL: [160, 80, (c, Q) => { fill(c, Q[3]); gathers(c, Q, 0, 4); paHem(c, Q, c.H - 4); paFolds(c, Q, { y0: 2, y1: c.H - 4, n: 9, fan: .75 }); }],
  robeS: [144, 40, (c, Q) => { fill(c, Q[3]); gathers(c, Q, 0, 3); paHem(c, Q, c.H - 4); paFolds(c, Q, { y0: 1, y1: c.H - 4, n: 8, fan: .5 }); }],
  bodice: [112, 48, (c, Q) => { // the garment's top on the rig's chest: a rolled neck, folds falling from the shoulder pins, side seams, blousing at the waist
    const { R, P, S, W, H, F } = c; fill(c, Q[3]); R(0, 0, W, 1, Q[4]); R(0, 1, W, 1, Q[2]);
    for (const [a, b, e] of [[18, 7, 30], [24, 12, 36], [12, 4, 24], [30, 20, 34]]) for (let j = 2; j < e; j++) { const i = Math.round(a + (b - a) * j / e); S(i, j, j < 5 ? Q[2] : Q[1]); if (j > 3) S(i - 1, j, Q[4]); }
    for (const [a, b] of [[18, 10], [26, 20]]) for (let j = 2; j < 30; j++) { const i = Math.round(a + (b - a) * j / 30); P(F + W / 2 + i, j, Q[2]); P(F + W / 2 - 1 - i, j, Q[2]); } // the back
    for (const x of [F - (W >> 2), F + (W >> 2)]) { R(x, 2, 1, H - 2, Q[1]); R(x + 1, 2, 1, H - 2, Q[4]); }
    R(0, H - 8, W, 1, Q[4]); for (let x = 0; x < W; x += 4) { P(x, H - 7, Q[2]); P(x, H - 6, Q[1]); P(x + 1, H - 7, Q[4]); } R(0, H - 3, W, 1, Q[2]); R(0, H - 2, W, 2, Q[1]);
  }],
  sleeve: [32, 20, (c, Q) => { fill(c, Q[3]); c.R(0, 0, c.W, 1, Q[4]); paHem(c, Q, c.H - 4); paFolds(c, Q, { y0: 1, y1: c.H - 4, n: 3, fan: .3 }); }],
  drape: [144, 20, (c, Q) => { // a himation band round the body: tension folds along it (a lit ridge over a dark crease, sloping a little), rolled edges
    const { R, P, W, H, rnd } = c; fill(c, Q[3]); R(0, 0, W, 1, Q[4]); R(0, H - 2, W, 1, Q[2]); R(0, H - 1, W, 1, Q[0]);
    for (let k = 0; k < 10; k++) { const x0 = rnd() * W, len = 18 + rnd() * 30, y0 = 4 + rnd() * (H - 9), sl = (rnd() - .5) * .3; for (let t = 0; t < len; t++) { const y = Math.round(y0 + t * sl); P(x0 + t, y, t < 2 || t > len - 3 ? Q[2] : Q[1]); if (t > 2 && t < len - 4) P(x0 + t, y - 1, Q[4]); } }
  }],
  fall: [24, 64, (c, Q) => { fill(c, Q[3]); gathers(c, Q, 0, 3, 4); paHem(c, Q, c.H - 4); paFolds(c, Q, { y0: 2, y1: c.H - 4, n: 3, fan: .6 }); }], // cloth hanging down a back
  cape: [48, 96, (c, Q) => { fill(c, Q[3]); gathers(c, Q, 0, 5); paHem(c, Q, c.H - 4); paFolds(c, Q, { y0: 3, y1: c.H - 4, n: 5, fan: .8 }); }],
  wrap: [160, 44, (c, Q) => { // cloth wound round the hips: long folds slanting round it (a shaded crease under a lit ridge), the hem below
    const { P, W, H, rnd } = c; fill(c, Q[3]); paHem(c, Q, H - 4);
    for (let k = 0; k < 7; k++) { const x0 = k * W / 7 + rnd() * 6, y0 = 2 + rnd() * 9, len = 40 + rnd() * 30;
      for (let t = 0; t < len; t++) { const y = Math.round(y0 + t * .4), e = t < 4 || t > len - 5; if (y > H - 6) break; P(x0 + t, y, e ? Q[2] : Q[1]); if (!e) { P(x0 + t, y + 1, Q[2]); P(x0 + t, y - 1, Q[4]); } } }
  }],
  over: [152, 24, (c, Q) => { // the peplos' folded-down top: short folds, a zig-zag hem
    const { P, W, H } = c; fill(c, Q[3]); paHem(c, Q, H - 4); paFolds(c, Q, { y0: 0, y1: H - 4, n: 10, fan: .35 });
    for (let x = 0; x < W; x++) { const d = Math.abs((x % 10) - 5); if (d > 2) P(x, H - 1, Q[2]); if (d > 3) P(x, H - 2, Q[0]); }
  }],
  ball: [48, 24, (c, Q) => { // cloth on a round part (front at u .75): soft folds from above, the shaded underside
    const { R, H } = c; fill(c, Q[3]); R(0, 0, c.W, 3, Q[4]); paFolds(c, Q, { y0: 4, y1: H - 3, n: 5, fan: .4 }); R(0, H - 3, c.W, 2, Q[2]); R(0, H - 1, c.W, 1, Q[1]);
  }],
  hood: [96, 48, (c, Q) => { fill(c, Q[3]); c.R(0, 0, c.W, 2, Q[4]); paHem(c, Q, c.H - 4); paFolds(c, Q, { y0: 2, y1: c.H - 4, n: 8, fan: .7 }); }],
  hem: [160, 7, (c, Q) => paBand(c, Q, 'dots')], // a woven border
  trim: [64, 5, (c, Q) => paBand(c, Q, 'check')], // small trims: neck, sleeves, fillets, ribbons
  keyCut: [160, 5, (c, Q) => paBand(c, Q, 'key', { cut: true }), { cut: true }], // a Greek key in a second colour laid over a hem
  ribbon: [24, 24, (c, Q) => { fill(c, Q[3]); c.R(0, 0, c.W, 1, Q[4]); c.R(0, c.H - 1, c.W, 1, Q[1]); c.R(0, 0, 1, c.H, Q[4]); c.R(c.W - 1, 0, 1, c.H, Q[1]); paStitch(c, Q[2], 2, 2, c.W - 2); }], // a narrow cloth band seen on a box
  crest: [16, 24, (c, Q) => { const { R, P, W, H } = c; fill(c, Q[3]); for (let x = 0; x < W; x++) { if (x % 3 === 0) R(x, 0, 1, H, Q[1]); if (x % 3 === 1) R(x, 0, 1, H >> 1, Q[4]); } R(0, 0, W, 1, Q[5]); for (let x = 1; x < W; x += 3) P(x, H - 1, Q[0]); }], // horsehair
  leaf: [12, 16, (c, Q) => { // a pointed leaf, lit on one side of its bright midrib, veined, on the shade between leaves
    const { P, W, H } = c; fill(c, Q[1]);
    for (let j = 0; j < H; j++) { const hw = 5.6 * Math.sin(PI * (j + .5) / H) ** .8; for (let i = 0; i < W; i++) { const d = i + .5 - W / 2; if (Math.abs(d) <= hw) P(i, j, Math.abs(d) < .6 ? Q[5] : Math.abs(d) > hw - 1 ? Q[2] : d < 0 ? Q[4] : Q[3]); } }
    for (let j = 3; j < H - 2; j += 3) { P(W / 2 - 3, j, Q[3]); P(W / 2 + 2, j + 1, Q[2]); }
  }],
  pec: [32, 16, (c, Q) => { const { R, W, H } = c; fill(c, Q[3]); R(0, 0, W, 3, Q[4]); R(18, 1, 5, 1, Q[5]); R(0, H - 5, W, 3, Q[2]); R(0, H - 2, W, 2, Q[1]); }], // a modelled muscle (pec, deltoid): lit above, shaded under its lower edge
  straw: [64, 16, (c, Q) => { const { R, P, W, H } = c; fill(c, Q[3]); for (let j = 0; j < H; j += 4) { R(0, j + 3, W, 1, Q[1]); for (let x = (j >> 1) % 4; x < W; x += 4) { P(x, j, Q[4]); P(x + 1, j + 1, Q[4]); P(x + 2, j + 2, Q[2]); } } R(0, 0, W, 1, Q[5]); }], // woven straw
  brim: [48, 48, (c, Q) => { // a hat brim's top as a disc (a cylinder cap's uv): plaited rings, a dark crown seat, the lit outer edge
    const { P } = c; for (let j = 0; j < 48; j++) for (let i = 0; i < 48; i++) { const r = Math.hypot(i - 23.5, j - 23.5), a = Math.atan2(j - 23.5, i - 23.5);
      P(i, j, r > 22.5 ? Q[1] : r > 21 ? Q[4] : r < 9 ? Q[2] : r < 10 ? Q[0] : (Math.round(r) % 3 === 0 ? Q[2] : (Math.round(a * 8 + r) % 4 === 0 ? Q[4] : Q[3]))); }
  }],
  felt: [48, 24, (c, Q) => { const { R, P, W, H, rnd } = c; fill(c, Q[3]); for (let i = 0; i < W * H / 9; i++) P(rnd() * W | 0, rnd() * H | 0, rnd() < .5 ? Q[2] : Q[4]); for (let x = 6; x < W; x += 12) { R(x, 2, 1, H - 4, Q[1]); R(x + 1, 2, 1, H - 4, Q[4]); } R(0, 0, W, 1, Q[4]); paHem(c, Q, H - 4); }],
  skin: [112, 48, (c, Q) => { // a bare chest: collarbones, the pectorals' lower edges, the breastbone, abdominal blocks, a navel; spine and shoulder blades behind
    const { R, P, S, W, H, F } = c; fill(c, Q[3]);
    for (let i = 2; i < 17; i++) { S(i, 3 + Math.round(i * .12), Q[4]); S(i, 4 + Math.round(i * .12), Q[2]); }
    for (let i = 0; i < 19; i++) { const y = 21 - Math.round(5 * Math.sin(i / 19 * Math.PI) * (i < 9 ? 1 : .8)); S(i, y, Q[1]); S(i, y - 1, Q[2]); S(i, y + 1, Q[4]); }
    for (let j = 6; j < 20; j++) S(0, j, Q[2]); for (const y of [26, 32, 38]) for (let i = 1; i < 7; i++) { S(i, y, Q[2]); S(i, y + 1, Q[4]); } for (let j = 24; j < 42; j++) S(0, j, Q[2]);
    S(0, 44, Q[1]); P(F, 45, Q[2]);
    R(0, 4, 1, H - 8, Q[2]); R(1, 4, 1, H - 8, Q[4]); for (const s of [1, -1]) for (let k = 0; k < 10; k++) { P(s * (10 + k * .3) + (s < 0 ? W : 0), 8 + k, Q[2]); P(s * (14 - k) + (s < 0 ? W : 0), 18, Q[2]); }
  }],
  fleece: [64, 32, (c, Q) => { const { P, W, H, rnd } = c; fill(c, Q[3]); for (let i = 0; i < 150; i++) { const x = rnd() * W | 0, y = rnd() * H | 0; P(x, y, Q[4]); P(x + 1, y, Q[4]); P(x + 2, y + 1, Q[2]); P(x - 1, y + 1, Q[2]); P(x, y + 2, Q[1]); P(x + 1, y + 2, Q[2]); } }], // curly wool
  net: [32, 32, (c, Q) => { const { P } = c; fill(c, Q[2]); for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const a = (i + j) % 8, b = (i - j + 32) % 8; if (!a || !b) P(i, j, Q[4]); if (!a && !b) P(i, j, Q[5]); if (a === 1 || b === 1) P(i, j, Q[1]); } }],
  rug: [32, 32, (c, Q) => { const { R, P } = c; fill(c, Q[3]); for (const [y, h, k] of [[2, 2, 1], [6, 1, 5], [9, 3, 0], [14, 1, 4], [17, 3, 0], [22, 1, 5], [25, 2, 1], [29, 1, 4]]) R(0, y, 32, h, Q[k]); for (let x = 0; x < 32; x += 4) { P(x, 11, Q[5]); P(x + 2, 19, Q[5]); } }], // woven stripes
  burlap: [32, 32, (c, Q) => { const { P } = c; fill(c, Q[3]); for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { if ((i + (j >> 1)) % 4 === 0) P(i, j, Q[2]); else if ((i * 3 + j) % 7 === 0) P(i, j, Q[4]); } c.R(0, 0, 32, 2, Q[1]); }],
  paper: [32, 12, (c, Q) => { const { R, P, rnd } = c; fill(c, Q[4]); R(0, 0, 32, 1, Q[5]); R(0, 11, 32, 1, Q[2]); for (const y of [3, 5, 7, 9]) for (let x = 2; x < 30; x++) if (rnd() < .6) P(x, y, Q[1]); }], // a written scroll
  linen: [112, 48, (c, Q) => { // a soldier's linen cuirass: layered linen with stitched seams, the shoulder pieces' edges, side lacing
    const { R, P, S, W, H, F } = c; fill(c, Q[3]); R(0, 0, W, 2, Q[4]);
    for (const y of [10, 22, 34]) { R(0, y, W, 1, Q[2]); R(0, y + 1, W, 1, Q[4]); paStitch(c, Q[1], y + 3); }
    for (let j = 0; j < 12; j++) { S(14 + (j >> 1), j, Q[1]); S(13 + (j >> 1), j, Q[4]); } R(0, H - 2, W, 2, Q[1]);
    for (let j = 4; j < H - 4; j += 3) { P(F + (W >> 2) + 1, j, Q[1]); P(F + (W >> 2) - 1, j + 1, Q[1]); }
  }],
  strip: [8, 24, (c, Q) => { const { R, P, W, H } = c; fill(c, Q[3]); R(0, 0, 1, H, Q[1]); R(W - 1, 0, 1, H, Q[1]); R(2, 2, 1, H - 6, Q[4]); R(0, 0, W, 1, Q[4]); for (let x = 0; x < W; x++) { P(x, H - 1, x % 2 ? Q[0] : Q[4]); P(x, H - 2, x % 2 ? Q[1] : Q[3]); } }], // a pteruges strip, fringed
  // ---- hair (per colour)
  hair: [128, 56, (c, Q) => paHair(c, Q, { n: 15, tip0: 30, tip1: 52 }), RP],
  lock: [16, 12, (c, Q) => { const { R, P, W, H } = c; fill(c, Q[3]); R(0, 0, W, 3, Q[4]); P(2, 0, Q[5]); P(10, 0, Q[5]); for (let x = 0; x < W; x += 4) R(x, 2, 1, H - 2, Q[2]); for (const x of [2, 10]) { R(x, 4, 1, 5, Q[4]); P(x, 5, Q[5]); } R(0, H - 2, W, 2, Q[2]); }, RP], // a pointed lock (a cone: apex at the top)
  locks: [48, 40, (c, Q) => paHair(c, Q, { n: 7, tip0: 30, tip1: 40, sheen: .12 }), RP],
  beard: [64, 32, (c, Q) => paBeard(c, Q, { lw: 6, tip0: c.H * .62 }), RP], // locks hanging to pointed tips (size-driven: see kt's d)
  mous: [24, 6, (c, Q) => { const { R, P, W, H } = c; fill(c, Q[3]); R(0, 0, W, 1, Q[4]); R(0, H - 2, W, 1, Q[2]); R(0, H - 1, W, 1, Q[1]); R((W >> 1) - 1, 0, 2, H, Q[1]); for (let x = 1; x < W - 1; x += 3) { P(x, 1 + (x % 2), Q[2]); P(x + (x < W / 2 ? -1 : 1), 2 + (x % 2), Q[4]); } }, RP], // a moustache: swept halves, parted
  curl: [48, 24, paCurl, RP],
  braid: [24, 12, (c, Q) => { const { R, P, W } = c; R(0, 0, W, 4, Q[4]); R(0, 4, W, 4, Q[3]); R(0, 8, W, 2, Q[2]); R(0, 10, W, 2, Q[1]); for (let x = 0; x < W; x += 6) { P(x, 2, Q[5]); P(x + 1, 2, Q[5]); for (let t = 0; t < 6; t++) P(x + 3 + t, 4 + t, Q[1]); } }, RP], // one woven lobe
  bun: [32, 16, (c, Q) => { const { R, P, W, H } = c; fill(c, Q[3]); R(0, 0, W, 3, Q[4]); R(0, H - 3, W, 3, Q[1]); for (let x = 0; x < W; x += 4) for (let t = 0; t < 10; t++) { P(x + t, 2 + t, Q[1]); P(x + t + 1, 2 + t, Q[4]); } P(W * .75, 1, Q[5]); }, RP], // wound strands
  // ---- leather (per colour)
  belt: [128, 8, (c, Q) => paLeather(c, Q), RP],
  strap: [16, 16, (c, Q) => { const { R } = c; paLeather(c, Q, { edge: false, stitch: false }); R(0, 0, 16, 1, Q[4]); R(0, 15, 16, 1, Q[1]); R(0, 0, 1, 16, Q[4]); R(15, 0, 1, 16, Q[1]); paStitch(c, Q[5], 2, 2, 14); paStitch(c, Q[5], 13, 2, 14); }, RP],
  bracer: [48, 16, (c, Q) => { const { P, H, F } = c; paLeather(c, Q); for (let k = -2; k <= 2; k++) { P(F + k, 8 - (2 - Math.abs(k)), Q[4]); P(F + k, 8 + (2 - Math.abs(k)), Q[1]); } for (let j = 3; j < H - 3; j++) { const o = j % 4 < 2 ? j % 4 : 4 - j % 4; P(F + 12 - 2 + o, j, Q[0]); P(F + 12 + 2 - o, j, Q[5]); } }, RP], // laced on the inside, a tooled diamond
  boot: [48, 32, (c, Q) => { // a boot shaft: a lit front, a back seam, slouch creases round the ankle, the rolled top
    const { R, W, H, F } = c; paLeather(c, Q, { stitch: false }); R(F - 3, 2, 3, H - 12, Q[4]); R(F - 2, 4, 1, 8, Q[5]); R(0, 0, 1, H, Q[0]); R(1, 0, 1, H, Q[2]);
    arcs(c, Q, [[F - 6, 22, 7], [F + 7, 25, 6], [F, 28, 8], [6, 24, 6], [W - 8, 27, 6]]); R(0, H - 1, W, 1, Q[1]);
  }, RP],
  footS: [24, 10, (c, Q) => { const { R, H } = c; paLeather(c, Q, { stitch: false, edge: false }); R(0, 0, 24, 1, Q[4]); R(0, H - 3, 24, 1, Q[1]); paStitch(c, Q[5], H - 3, 1, 23, 2); R(0, H - 2, 24, 2, Q[0]); }, RP], // the upper, a stitched welt, the sole
  footT: [12, 24, (c, Q) => { const { R, P } = c; paLeather(c, Q, { stitch: false, edge: false }); R(0, 0, 12, 4, Q[2]); for (const y of [8, 12]) { R(2, y, 8, 1, Q[1]); R(3, y - 1, 6, 1, Q[4]); } R(1, 16, 10, 7, Q[4]); R(3, 18, 4, 2, Q[5]); P(2, 22, Q[3]); }, RP], // the instep creased, the toe lit
  sole: [24, 8, (c, Q) => { paLeather(c, Q, { stitch: false }); paStitch(c, Q[5], 2, 1, 23, 2); }, RP],
  laces: [48, 32, (c, Q) => paLaces(c, Q, { step: 8, w: 2 }), CUT], // sandal straps criss-crossed up the leg
  lacesLo: [48, 16, (c, Q) => paLaces(c, Q, { step: 8, w: 2 }), CUT],
  pouch: [32, 16, (c, Q) => { const { R, P, W } = c; paLeather(c, Q, { stitch: false, edge: false }); R(0, 0, W, 2, Q[4]); for (let x = 0; x < W; x++) { const d = Math.abs(x - 24), y = 7 - Math.round(Math.max(0, 6 - d) * .5); R(x, 2, 1, y - 2, Q[4]); P(x, y, Q[1]); if (x % 3) P(x, y - 2, Q[5]); } R(0, 14, W, 2, Q[1]); }, RP], // the flap, stitched
  apron: [64, 64, (c, Q) => { // a smith's leather apron: scorched, riveted at the corners, a stitched pocket
    const { R, P, W, H, rnd } = c; paLeather(c, Q, { edge: false, stitch: false }); paStitch(c, Q[5], 2); paStitch(c, Q[5], H - 3); R(0, H - 1, W, 1, Q[0]);
    for (let i = 0; i < 9; i++) { const x = rnd() * W | 0, y = 8 + rnd() * (H - 16) | 0; R(x, y, 3, 2, Q[1]); P(x + 1, y, Q[0]); P(x + 3, y + 1, Q[2]); }
    for (let i = 0; i < W; i += 16) for (const y of [6, H - 7]) rivet(c, i + 5, y, ramp('#b8b0a0', 6));
  }, RP],
  // ---- metal (per colour)
  gold: [32, 6, (c, Q) => paMetal(c, Q, { glint: 8 }), RP], // bands, bangles, necklaces, rims
  plate: [16, 16, (c, Q) => { const { R } = c; fill(c, Q[2]); R(0, 0, 16, 1, Q[5]); R(0, 0, 1, 16, Q[4]); R(15, 0, 1, 16, Q[1]); R(0, 15, 16, 1, Q[0]); R(3, 3, 10, 10, Q[3]); R(3, 3, 10, 1, Q[4]); R(4, 4, 2, 1, Q[5]); R(3, 12, 10, 1, Q[1]); }, RP], // a buckle or clasp
  gem: [8, 8, (c, Q) => { const { R, P } = c; fill(c, Q[3]); R(0, 0, 8, 2, Q[4]); R(0, 6, 8, 2, Q[1]); P(5, 1, Q[5]); P(6, 1, Q[5]); P(6, 2, Q[4]); }, RP], // a bead or stone
  greave: [48, 32, (c, Q) => { // a bronze greave: a lit ridge down the shin, the knee's curved top, the calf's swell, rolled rims
    const { R, P, S, W, H, F } = c; fill(c, Q[3]); R(F - 8, 0, 6, H, Q[4]); R(F - 6, 3, 2, H - 8, Q[5]); R(F + 2, 0, 1, H, Q[2]); R(F + 10, 0, W - F - 10, H, Q[2]); R(0, 0, F - 14, H, Q[2]);
    for (let i = 0; i < 12; i++) { const y = 7 - Math.round(4 * Math.sin(i / 12 * Math.PI / 2 + Math.PI / 2)); S(i, y, Q[1]); S(i, y - 1, Q[5]); }
    for (let j = 10; j < 24; j++) { const i = 13 + Math.round(2 * Math.sin((j - 10) / 14 * Math.PI)); S(i, j, Q[1]); S(i - 1, j, Q[4]); }
    R(0, 0, W, 1, Q[5]); R(0, H - 2, W, 1, Q[4]); R(0, H - 1, W, 1, Q[0]); for (let x = 2; x < W; x += 8) P(x, H - 2, Q[5]);
  }, RP],
  helm: [64, 32, (c, Q) => { // a bronze helmet dome (front at u .75): a lit crown, a ridge front to back, a riveted band, the dark rim
    const { R, P, W, H } = c; fill(c, Q[3]); R(0, 0, W, 5, Q[4]); R(0, 18, W, H - 18, Q[2]); for (const x of [48, 16]) { R(x - 1, 0, 1, 18, Q[5]); R(x + 1, 0, 1, 18, Q[1]); }
    R(0, 14, W, 1, Q[1]); R(0, 15, W, 1, Q[4]); for (let x = 2; x < W; x += 6) rivet(c, x, 16, Q); R(0, H - 2, W, 2, Q[0]); for (let k = 0; k < 4; k++) { P(42 + k, 3 + k, Q[5]); P(43 + k, 3 + k, Q[5]); }
  }, RP],
  shield: [64, 64, (c, Q) => { // a round shield's face as a disc: a lit rim groove, a ring of rivets, a raised ring round the boss, light from the top left
    const { P } = c; for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const x = i - 31.5, y = j - 31.5, r = Math.hypot(x, y), a = Math.atan2(y, x) / Math.PI / 2 + .5;
      let col = x + y < -20 && r < 28 ? Q[4] : x + y > 26 ? Q[2] : Q[3];
      if (r > 30.5) col = Q[1]; else if (r > 29) col = y < 0 ? Q[5] : Q[4]; else if (r > 27.5) col = Q[1]; else if (r > 15 && r < 16.5) col = Q[1]; else if (r > 13.5 && r <= 15) col = y < 0 ? Q[5] : Q[4];
      if (r > 23.5 && r < 26 && Math.abs((a * 16) % 1 - .5) < .1) col = y < 0 ? Q[5] : Q[0]; P(i, j, col); }
  }, RP],
  cuirass: [112, 48, (c, Q) => { // a bronze muscle cuirass: chased pectorals and belly, the lit centre, a rolled neck and lower edge
    const { R, P, S, W, H, F } = c; fill(c, Q[3]); R(F - 10, 4, 6, H - 10, Q[4]); R(F - 8, 6, 2, 14, Q[5]); R(0, 0, F - 26, H, Q[2]); R(F + 26, 0, W - F - 26, H, Q[2]);
    for (let i = 0; i < 19; i++) { const y = 20 - Math.round(5 * Math.sin(i / 19 * Math.PI)); S(i, y, Q[0]); S(i, y - 1, Q[5]); }
    for (let j = 6; j < H - 4; j++) S(0, j, Q[1]); for (const y of [27, 33, 39]) for (let i = 1; i < 8; i++) { S(i, y, Q[1]); S(i, y - 1, Q[4]); }
    R(0, 0, W, 1, Q[5]); R(0, 1, W, 1, Q[2]); R(0, H - 2, W, 1, Q[4]); R(0, H - 1, W, 1, Q[0]); P(F, H - 6, Q[0]);
  }, RP],
  // ---- wood and pottery (per colour)
  wood: [16, 64, (c, Q) => paWood(c, Q), RP],
  jar: [32, 32, (c, Q) => { // glazed terracotta, black-figure: tongues round the shoulder, an incised line, the glaze's lit stripe, rays above the foot
    const { R, P, W, H } = c, K = '#2a1a14'; fill(c, Q[3]);
    R(0, 0, W, 6, K); for (let x = 0; x < W; x += 4) { R(x + 1, 0, 2, 4, Q[3]); P(x + 1, 4, Q[3]); P(x + 2, 1, Q[4]); }
    R(0, 6, W, 1, Q[1]); R(0, 7, W, 1, Q[4]); R(18, 8, 2, 14, Q[4]); R(19, 10, 1, 6, Q[5]);
    R(0, 22, W, 10, Q[2]); for (let x = 0; x < W; x += 4) for (let j = 22; j < H; j++) { const hw = Math.round((j - 22) * .2); for (let i = -hw; i <= hw; i++) P(x + 2 + i, j, K); }
    R(0, H - 1, W, 1, Q[0]);
  }, RP],
  tondo: [32, 32, (c, Q) => { // a kylix's painted tondo (a cylinder cap): a clay rim, a ring of dots, a clay rosette on the black glaze
    const { P } = c, K = '#1a1210';
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const x = i - 15.5, y = j - 15.5, d = Math.hypot(x, y), a = Math.atan2(y, x);
      P(i, j, d > 15 ? Q[1] : d > 13.2 ? Q[3] : d > 12 ? K : d > 10.6 ? (Math.cos(a * 16) > .3 ? Q[3] : K) : d < 1.5 ? Q[2] : d < 6.5 && Math.cos(a * 6) > d / 6.5 - .35 ? (y < 0 ? Q[4] : Q[3]) : K); }
  }, RP],
  fish: [16, 32, (c, Q) => { const { R, P } = c; fill(c, Q[3]); R(0, 0, 16, 32, Q[3]); for (let j = 4; j < 28; j += 3) for (let i = (j % 2) * 2; i < 16; i += 4) { P(i, j, Q[2]); P(i + 1, j + 1, Q[2]); P(i + 2, j, Q[4]); } R(11, 0, 3, 32, Q[1]); R(3, 2, 2, 28, Q[5]); R(0, 0, 16, 3, Q[2]); }, RP], // scales, a dark back, a silver flank
  jarBand: [64, 6, (c, Q) => { const { R, P, W } = c; fill(c, Q[3]); R(0, 0, W, 1, Q[1]); R(0, 5, W, 1, Q[1]); for (let x = 0; x < W; x += 8) { R(x + 1, 2, 3, 2, Q[5]); P(x + 4, 2, Q[4]); P(x + 5, 3, Q[4]); P(x + 2, 1, Q[4]); } }, RP], // a frieze of little figures
  wicker: [32, 16, (c, Q) => { const { R, P } = c; fill(c, Q[3]); for (let j = 0; j < 16; j += 2) for (let x = (j >> 1) % 2 * 2; x < 32; x += 4) { R(x, j, 2, 2, Q[4]); P(x + 1, j + 1, Q[2]); } R(0, 0, 32, 1, Q[5]); R(0, 15, 32, 1, Q[1]); }, RP],
};
// pale hair and beards (white, grey, fair): the two darkest steps lifted toward the mid shade, so the strands stay soft
// instead of streaking dark like birch bark; dark hair keeps its full ramp
const HAIRK = new Set(['hair', 'lock', 'locks', 'beard', 'mous', 'curl', 'braid', 'bun']), _hsl = {};
const softQ = (Q) => { const m = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); return [m(Q[0], Q[2], .53), m(Q[1], Q[2], .55), ...Q.slice(2)]; };
// d: texel density, 2 on a big rig (dens) so its texels stay the size of V's; painters that draw by size (beard, mous,
// curl) then paint more locks or curls instead of bigger ones
const kt = (kind, col, d = 1) => { // a kit piece's material in one colour
  const K = KIT[kind], pale = HAIRK.has(kind) && new THREE.Color(col).getHSL(_hsl).l > .55;
  return kitMat('kit:' + kind + (d > 1 ? '@' + d : ''), [K[0] * d, K[1] * d, pale ? (c, Q) => K[2](c, softQ(Q)) : K[2]], col, K[3]);
};
const kx = (kind, col, o, d) => PXART ? { ...o, material: kt(kind, col, d) } : o; // mesh opts: the piece wears its texture (pixel art) or plain colour
const dens = (r) => ((r.root && r.root.scale.x) || 1) > 1.4 ? 2 : 1; // a big rig (a cyclops, a titan): double texel density
const turn = (m) => { if (PXART) m.rotation.y = PI; return m; }; // a cylinder's texture front (u .5) to the front

// round 33 stage 2: a length j of n of a hanging piece (a cape, a fall of cloth or hair): a unit box whose texture rows are
// that length's share, so the folds and the hem run on unbroken down the whole piece
const segBoxes = new Map();
function segBox(j, n) {
  const k = j + '/' + n; if (segBoxes.has(k)) return segBoxes.get(k);
  const g = new THREE.BoxGeometry(1, 1, 1), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (j + 1) / n + uv.getY(i) / n);
  segBoxes.set(k, g); return g;
}
const segCyls = new Map();
function segCyl(rt, rb, h, seg, j, n) { // the same for a tapered cylinder (a fall of hair)
  const k = [rt, rb, h, seg, j, n].join(); if (segCyls.has(k)) return segCyls.get(k);
  const g = new THREE.CylinderGeometry(rt, rb, h, seg), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (j + 1) / n + uv.getY(i) / n);
  segCyls.set(k, g); return g;
}
// a hanging piece in n hinged lengths from pivot p (each length a box w x len/n x d, hanging down its pivot's -y), moved by
// the rope physics (models.js hangChain); returns the pivots (the last one carries the hem)
function hangBoxes(r, p, col, kind, len, w, d, n, o = {}) {
  const L = len / n, segs = [p]; let par = p;
  for (let j = 0; j < n; j++) {
    const m = box(par, w, L + (j < n - 1 ? .006 : 0), d, col, 0, -L / 2, 0, kx(kind, col)); if (n > 1) m.geometry = segBox(j, n);
    if (o.lining) { const ln = box(par, w * .94, L - (j === n - 1 ? .04 : -.004), .02, o.lining, 0, -L / 2 + (j === n - 1 ? .02 : 0), .035, o.liningOpts || { noShadow: true }); if (n > 1 && PXART) ln.geometry = segBox(j, n); }
    if (j < n - 1) { par = pivot(par, 0, -L, 0); segs.push(par); }
  }
  if (n > 1) hangChain(r, segs, { frame: o.frame || p, end: [0, -L, 0], k: o.k ?? 55, damp: o.damp ?? 5, air: o.air ?? .45, rad: .03, sec: 0, lo: o.lo ?? 0, hi: 1.25, side: .35, first: o.first ?? 'max' });
  p.userData.segs = segs; p.userData.end = par; p.userData.segLen = L;
  return segs;
}

// hair, beards, clothes
function hairCap(r, col, o = {}) {
  const cap = ball(r.head, .215, col, 0, o.y ?? .29, -.05, 1, kx('hair', col)); cap.scale.set(1.03, o.h ?? .8, 1.05);
  ball(r.head, .175, col, 0, .2, -.1, 1, kx('hair', col)).scale.set(1.08, 1, 1);
  if (PXART && o.locks !== false) { // pixel art: pointed locks over the brow, the hair's own edge (side-swept, parted or short)
    const cy = o.y ?? .29, ry = .215 * (o.h ?? .8), Y = (y) => cy + (y - .29) * ry / .172, cz = (x, y) => -.05 + .226 * Math.sqrt(Math.max(0, 1 - (x / .221) ** 2 - ((y - cy) / ry) ** 2));
    for (const [bx, by0, tx, ty0, w] of FRINGE[o.fringe ? 'side' : o.locks || 'short']) {
      const by = Y(by0), ty = Y(ty0), bz = cz(bx, by) + .012, tz = cz(tx, ty) + .022;
      const m = cone(r.head, w, +Math.hypot(tx - bx, ty - by, tz - bz).toFixed(3), col, (bx + tx) / 2, (by + ty) / 2, (bz + tz) / 2, 4, kx('lock', col));
      m.quaternion.setFromUnitVectors(_Y, _u.set(tx - bx, ty - by, tz - bz).normalize()); m.scale.z = .55;
    }
  } else if (o.fringe) box(r.head, .3, .06, .06, col, 0, .35, .15, kx('locks', col)).rotation.x = -.35;
  if (o.locks === 'part' || o.fringe || o.side) for (const sx of [-1, 1]) ball(r.head, .075, col, sx * .17, .15, -.06, 1, kx('hair', col)).scale.set(.9, 1.2, 1); // round 33: soft volume behind the ears, as V's hair has
  return cap;
}
const FRINGE = { // [base x, y on the cap, tip x, y, width] for a cap at y .29, .172 tall (the rest scale to it)
  side: [[.13, .37, .18, .29, .035], [.1, .375, .04, .295, .04], [.05, .385, -.03, .3, .045], [0, .385, -.09, .305, .045], [-.05, .375, -.14, .3, .04], [-.1, .36, -.18, .27, .035]],
  part: [[.025, .39, .1, .32, .04], [.07, .38, .16, .3, .04], [.12, .36, .19, .27, .035], [-.025, .39, -.1, .32, .04], [-.07, .38, -.16, .3, .04], [-.12, .36, -.19, .27, .035]],
  short: [[-.14, .355, -.165, .3, .035], [-.08, .372, -.09, .325, .04], [-.02, .38, -.015, .335, .04], [.04, .378, .055, .33, .04], [.1, .366, .12, .318, .038], [.155, .345, .175, .292, .032]],
};
function longHair(r, col, len = .55, w = 1, o = {}) {
  const b = hairFall(r, col, len, w, .2, .18, -.12);
  if (o.front !== false) for (const sx of [-1, 1]) { const s = tcyl(r.head, .06, .075, len * .62, col, sx * .17, .2 - len * .28, .02, 6, kx('locks', col)); s.rotation.z = sx * .1; }
  return b;
}
// round 33 stage 2: a fall of hair down the back, from the crown (y0 on the head) to len below it: the part over the skull
// stays put, the rest hangs in hinged lengths from the nape that the rope physics swings (models.js hangChain); top / bot:
// its half width at the crown and at the ends, z its line behind the head. Returns the crown piece (move it, and the
// fall moves with it: the hanging lengths are its children)
function hairFall(r, col, len, w, bot, top, z, y0 = .22) {
  const cut = Math.min(len * .5, y0 + .02), tw = (k) => (top + (bot - top) * k) * w; // the skull's share (to just below the nape)
  const cr = pivot(r.head, 0, 0, 0), c = tcyl(cr, tw(cut / len), tw(0), cut, col, 0, y0 - cut / 2, z, 8, kx('locks', col)); c.scale.z = .6;
  const rest = len - cut, n = rest > .3 ? 3 : 2, L = rest / n, segs = []; let par = pivot(cr, 0, y0 - cut, z);
  for (let j = 0; j < n; j++) {
    segs.push(par);
    const k0 = (cut + j * L) / len, k1 = (cut + (j + 1) * L) / len;
    const m = tcyl(par, tw(k0), tw(k1), L + .008, col, 0, -L / 2, 0, 8, kx('locks', col)); m.scale.z = .6; m.geometry = segCyl(tw(k0), tw(k1), L + .008, 10, j + 1, n + 1);
    if (j < n - 1) par = pivot(par, 0, -L, 0);
  }
  c.geometry = segCyl(tw(cut / len), tw(0), cut, 10, 0, n + 1); // (the texture's tips stay at the bottom of the whole fall)
  hangChain(r, segs, { end: [0, -L, 0], k: 240, damp: 14, air: .08, rad: .03, sec: .82, lo: -.5, hi: 1.4, side: .5 });
  cr.userData.segs = segs; return cr;
}
function bun(r, col, y = .34, z = -.17) { ball(r.head, .1, col, 0, y, z, 1, kx('bun', col)).scale.set(1, .9, .9); }
function beard(r, col, len = .25, wide = 1, o = {}) {
  const h = r.head, d = dens(r); r.beardCol = col; // (round 33: the face shades the jaw round it in this colour, models.js hdSettle)
  ball(h, .14 * wide, col, 0, .1, .1, 1, kx('beard', col, undefined, d)).scale.set(1.05, .78, .82);
  const b = tcyl(h, .145 * wide, .03 + .03 * wide, len, col, 0, .085 - len / 2, .12, 7, kx('beard', col, undefined, d)); b.scale.z = .72; b.rotation.x = o.tilt ?? .12;
  const mu = box(h, .15, .035, .045, o.mous || col, 0, .128, .2, kx('mous', o.mous || col, { noShadow: true }, d));
  if (r.mouth) { r.mouth.position.set(0, .096, .222); r.mouth.material = mat(o.mouth || '#4a2a24'); }
  return { b, mu };
}
function robe(r, col, o = {}) {
  const top = o.top ?? .21, bot = o.bot ?? .36, y0 = o.y0 ?? .06, y1 = o.y1 ?? -.8, len = y0 - y1;
  const m = turn(tcyl(r.torso, top, bot, len, col, 0, (y0 + y1) / 2, o.z ?? 0, 10, kx(len > .6 ? 'robeL' : 'robeS', col))); m.scale.z = o.sz ?? .85;
  if (y1 < -.2) clothFit(o.rig || r, m); // round 23 (Roy): the legs push the cloth out, they never pass through it (models.js fitRobes)
  if (o.folds && !PXART) { // (pixel art: the texture paints the folds)
    const n = o.n ?? 7, slope = Math.atan((bot - top) / len), rm = (top + bot) / 2 + .012;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + (o.fa ?? .2);
      const f = box(r.torso, .028, len * .9, .02, o.folds, Math.sin(a) * rm, (y0 + y1) / 2 - len * .03, Math.cos(a) * rm * (o.sz ?? .85), { noShadow: true });
      f.rotation.set(-slope, a, 0, 'YXZ');
    }
  }
  return m;
}
function belt(r, col, y = .14, buckle, w = .065, rad = .205) {
  const b = turn(tcyl(r.torso, rad, rad, w, col, 0, y, 0, 8, kx('belt', col))); b.scale.z = .78;
  if (PXART && w >= .045) { // round 33: studs round a working belt, as on V's (bright metal on a dark belt, dark on a light one)
    const lt = new THREE.Color(col).getHSL(_hsl).l > .5, sc = buckle || (lt ? '#6a5040' : '#c8ccd4');
    for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * PI * 2; if (Math.cos(a) > .8) continue; ball(r.torso, .012, sc, Math.sin(a) * (rad + .004), y, Math.cos(a) * (rad + .004) * .78, 0, kx('gem', sc, { noShadow: true })); }
  }
  if (buckle) box(r.torso, .08, w + .02, .025, buckle, 0, y, rad * .78 + .01, kx('plate', buckle, { noShadow: true }));
  else if (PXART) { // pixel art: a knot at the front and its two ends hanging, off the middle
    const z = rad * .78 + .012, x = .05, k = Math.max(.035, w * .9);
    box(r.torso, k, k, .03, col, x, y, z, kx('strap', col, { noShadow: true })).rotation.z = .5;
    for (const [dx, a, l] of [[-.012, .18, .1], [.014, -.12, .085]]) { const e = box(r.torso, .022, l, .014, col, x + dx + Math.sin(a) * l / 2, y - l / 2 - .01, z + .004, kx('strap', col, { noShadow: true })); e.rotation.z = a; }
  }
  return b;
}
function sash(r, col, w = .14, tilt = .75, y = .34) { // cloth band from one shoulder across the chest to the other hip
  const s = tcyl(r.torso, .265, .265, w, col, 0, y, 0, 10, kx('drape', col)); s.scale.z = .78; s.rotation.z = tilt;
  const sh = ball(r.torso, .11, col, -Math.sign(tilt) * .22, .6, 0, 0, kx('ball', col)); sh.scale.set(1.1, .55, 1.1);
  return s;
}
function bracer(r, col, sides = 'LR', len = .15) {
  for (const c of sides) turn(tcyl(c === 'L' ? r.elbowL : r.elbowR, .066, .06, len, col, 0, -.16, 0, PXART ? 8 : 6, kx('bracer', col)));
}
function cape(r, col, len = .9, w = .44, o = {}) {
  const p = pivot(r.torso, 0, .62, -.17); p.rotation.x = o.flare ?? .12;
  if (!o.still) capeFlap(r, p, len, w); // round 23 (Roy): it swings back off her legs and arms, never through them (models.js fitFlaps)
  hangBoxes(r, p, col, 'cape', len, w, .045, o.still ? 1 : len > .7 ? 3 : 2, o); // round 33: in hinged lengths that trail, swing and settle (rope physics)
  for (const sx of [-1, 1]) { const s = ball(r.torso, .12, col, sx * .25, .6, -.02, 0, kx('ball', col)); s.scale.set(1.15, .6, 1.2); }
  return p;
}
function hood(r, col, o = {}) {
  r.skull.material = mat(o.void || '#07070b');
  const h = ball(r.head, .27, col, 0, .22, -.1, 1, kx('hood', col)); h.scale.set(1.04, 1.1, 1);
  ball(r.head, .2, col, 0, .375, .06, 1, kx('ball', col)).scale.set(1.2, .42, .85); // brow of the hood
  for (const sx of [-1, 1]) ball(r.head, .12, col, sx * .175, .17, .08, 1, kx('ball', col)).scale.set(.62, 1.75, 1.05);
  const pk = cone(r.head, .12, .22, col, 0, .45, -.2, 5, kx('hood', col)); pk.rotation.x = -.6;
  ball(r.head, .2, col, 0, .1, -.12, 1, kx('hood', col)).scale.set(1.3, .7, 1.2); // drapes onto the shoulders
  return h;
}
function petasos(r, col, band = '#5a3a24', tilt = 0) {
  const p = pivot(r.head, 0, .36, -.02); p.rotation.x = tilt;
  tcyl(p, .36, .36, .025, col, 0, 0, 0, PXART ? 16 : 12, kx('brim', col));
  tcyl(p, .13, .17, .13, col, 0, .07, 0, 9, kx('straw', col));
  tcyl(p, .172, .172, .03, band, 0, .02, 0, 9, kx('trim', band));
  return p;
}
function batSkull(parent, s = 1, bone = '#e4e2dc', wing = '#a9adb6') { // facing +z
  const g = new THREE.Group(); parent.add(g);
  ball(g, .045 * s, bone, 0, .01 * s, 0, 0, { noShadow: true }).scale.set(1, .95, .7);
  box(g, .05 * s, .025 * s, .03 * s, bone, 0, -.03 * s, .005 * s, { noShadow: true });
  for (const sx of [-1, 1]) {
    box(g, .016 * s, .016 * s, .01, '#1a1416', sx * .016 * s, .012 * s, .03 * s, { noShadow: true });
    const w1 = box(g, .08 * s, .03 * s, .012, wing, sx * .07 * s, .02 * s, -.005, { noShadow: true }); w1.rotation.z = sx * .35;
    const w2 = box(g, .06 * s, .022 * s, .012, wing, sx * .125 * s, .045 * s, -.005, { noShadow: true }); w2.rotation.z = sx * .7;
    for (let i = 0; i < 3; i++) box(g, .015 * s, .03 * s, .012, wing, sx * (.06 + i * .03) * s, -.005 * s, -.005, { noShadow: true });
  }
  return g;
}
function roundShield(parent, rad, face, rim, o = {}) { // disc axis along x (like V's): face toward -x unless o.out = 1
  const g = new THREE.Group(); parent.add(g);
  const dir = o.out || -1;
  cyl(g, rad, .05, face, 0, 0, 0, 14, kx('shield', face)).rotation.z = PI / 2;
  cyl(g, rad + .025, .035, rim, -.012 * dir, 0, 0, 14, kx('gold', rim)).rotation.z = PI / 2;
  if (o.boss) cyl(g, rad * .28, .07, o.boss, .03 * dir, 0, 0, 10, kx('shield', o.boss)).rotation.z = PI / 2;
  if (o.rivets) for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; ball(g, .025, o.rivets, .03 * dir, Math.sin(a) * rad * .82, Math.cos(a) * rad * .82, 0, kx('gem', o.rivets, { noShadow: true })); }
  return g;
}
function cyl(parent, r, h, color, x, y, z, seg, opts) { return tcyl(parent, r, r, h, color, x, y, z, seg, opts); }
function staff(hand, col, len = 2, top = .25) { const g = new THREE.Group(); hand.add(g); tcyl(g, .032, .038, len, col, 0, top, .03, 5, kx('wood', col)); return g; }
function eyeSlit(r, col = '#100c06') { for (const e of r.eyes) box(e, .008, .038, .012, col, 0, 0, .018, { noShadow: true }); }
function lashes(r, col = '#1a1010') { r.eyes.forEach((e, i) => { const sx = i ? 1 : -1; box(e, .07, .012, .014, col, 0, .026, .004, { noShadow: true }); box(e, .02, .014, .012, col, sx * .038, .022, .002, { noShadow: true }).rotation.z = sx * .5; }); }
function pecs(r, col, w = 1) {
  for (const sx of [-1, 1]) { const p = ball(r.torso, .12 * w, col, sx * .1, .48, .1, 1, kx('pec', col)); p.scale.set(1.05, .8, .62); }
  for (const sx of [-1, 1]) { const d = ball(r.torso, .11 * w, col, sx * .28, .585, 0, 1, kx('pec', col)); d.scale.set(.8, .84, .86); } // deltoids (round 33: rounded into the arm, no knob)
  if (PXART) dressChest(r, col, 'skin');
}
function toga(r, col, fold, o = {}) { // draped cloth over the left shoulder, long skirt
  robe(r, col, { top: .23, bot: o.bot ?? .35, y1: o.y1 ?? -.8, folds: fold, n: 6 });
  sash(r, col, o.w ?? .2, -.72, .36);
}
function goldFlicker(m, t, i) { m.scale.setScalar(.92 + Math.sin(t * 13 + i * 2.7) * .1 + Math.sin(t * 31 + i) * .05); }

// ---------- dress kit (townsfolk, gods, heroes) ----------
// all trims are noShadow (no outline, one draw call); bake() then merges same-material parts per joint.
const sph = (az, el, rad = .215, cy = .24, cz = -.03) => [Math.sin(az) * Math.cos(el) * rad, cy + Math.sin(el) * rad, cz + Math.cos(az) * Math.cos(el) * rad];
function hem(r, col, y, rad, sz = .85, h = .045, par = r.torso) { // a coloured band round a robe edge
  const m = turn(tcyl(par, rad, rad + .006, h, col, 0, y, 0, 10, kx(h > .036 ? 'hem' : 'trim', col, { noShadow: true }))); m.scale.z = sz; return m;
}
function meander(r, col, y, rad, sz = .85, n = 12, par = r.torso) { // little key-pattern blocks on a hem band
  if (PXART) { const m = turn(tcyl(par, rad + .004, rad + .01, .04, col, 0, y, 0, 10, kx('keyCut', col, { noShadow: true }))); m.scale.z = sz; return m; } // a woven key, cut out over the band
  for (let i = 0; i < n; i++) { const a = (i + .5) / n * PI * 2; const b = box(par, .035, .03, .012, col, Math.sin(a) * (rad + .01), y, Math.cos(a) * (rad + .01) * sz, { noShadow: true }); b.rotation.y = a; }
}
function chiton(r, col, o = {}) { // robe + hem trim (+ key pattern), returns {y1, bot}
  const y1 = o.y1 ?? -.82, bot = o.bot ?? (y1 < -.6 ? .35 : .3), top = o.top ?? .21, sz = o.sz ?? .85;
  const rm = robe(r, col, { top, bot, y0: o.y0, y1, folds: o.folds ?? shade(col, .82), n: o.n ?? 7, sz, rig: o.rig });
  if (PXART) dressChest(r, col, 'bodice');
  if (o.trim) {
    const len = (o.y0 ?? .06) - y1, rad = bot - (bot - top) * (.05 / len) + .004;
    clothFit(r, hem(r, o.trim, y1 + .03, rad, sz, .055), rm); // (the band goes out with the hem it edges)
    if (o.key) { const k = meander(r, o.key, y1 + .03, rad + .006, sz, 12); if (k) clothFit(r, k, rm); }
  }
  return { y1, bot };
}
function neckTrim(r, col, y = .575) { const m = turn(tcyl(r.torso, .205, .245, .045, col, 0, y, 0, 10, kx('trim', col, { noShadow: true }))); m.scale.z = .74; return m; }
function sleeveTrim(r, col) { for (const A of [r.armL, r.armR]) turn(tcyl(A, .074, .072, .04, col, 0, -.28, 0, PXART ? 8 : 6, kx('trim', col, { noShadow: true }))); }
// pixel art: the rig's own chest, shoulders and sleeves, where they are this garment's colour, wear its texture (a chiton's
// top, a bare chest...), turned so the texture's front faces front
function dressChest(r, col, kind) {
  const plain = mat(col), is = (o, f) => o.isMesh && o.material === plain && f(o.geometry.parameters || {});
  for (const o of r.torso.children) if (is(o, (q) => q.radiusTop === .25 && q.height === .5)) { o.material = kt(kind, col); o.rotation.y = PI; }
  for (const A of [r.armL, r.armR]) for (const o of A.children) {
    if (kind === 'skin') continue;
    if (is(o, (q) => q.radius === .085)) o.material = kt('ball', col);
    else if (is(o, (q) => q.radiusTop === .068)) { o.material = kt('sleeve', col); o.rotation.y = PI; }
  }
}
function overfold(r, col, trim) { // peplos apoptygma: the folded-down top layer
  const o = turn(tcyl(r.torso, .258, .3, .26, col, 0, .43, 0, 10, kx('over', col))); o.scale.z = .74;
  if (trim) hem(r, trim, .31, .3, .74, .035);
  return o;
}
function drape(r, col, trim, tilt = -.72, w = .2, y = .34) { // himation band from one shoulder across the body, with a border
  const p = pivot(r.torso, 0, y, 0); p.rotation.z = tilt;
  const s = tcyl(p, .268, .268, w, col, 0, 0, 0, 10, kx('drape', col)); s.scale.z = .78;
  if (trim) { const t = tcyl(p, .273, .273, .03, trim, 0, -w / 2 + .012, 0, 10, kx('trim', trim, { noShadow: true })); t.scale.z = .79; }
  const sx = -Math.sign(tilt);
  const sh = ball(r.torso, .115, col, sx * .22, .6, 0, 0, kx('ball', col)); sh.scale.set(1.1, .55, 1.15);
  const fp = pivot(r.torso, sx * .12, .59, -.19); fp.rotation.z = sx * .12; // fall of cloth down the back, hung from the shoulder
  capeFlap(r, fp, .78, .2); // round 23: a long stride swings it back off her legs instead of through it
  hangBoxes(r, fp, col, 'fall', .78, .2, .045, 2, { k: 70, air: .35 }); // round 33: in two hinged lengths (rope physics)
  if (trim) box(fp.userData.end, .2, .04, .05, trim, 0, -.37, 0, kx('ribbon', trim, { noShadow: true }));
  return p;
}
function wrapSkirt(r, col, trim, y1 = -.8) { // himation wound round the hips over a chiton
  const m = tcyl(r.torso, .25, .37, .5, col, 0, y1 + .45, 0, 10, kx('wrap', col)); m.scale.z = .86; m.rotation.z = .1; clothFit(r.rig || r, m); // (round 23: fitted to the legs like a robe)
  if (trim) { const t = tcyl(r.torso, .365, .372, .04, trim, 0, y1 + .22, 0, 10, kx('hem', trim, { noShadow: true })); t.scale.z = .86; t.rotation.z = .1; clothFit(r, t, m); }
  return m;
}
function chlamys(r, col, trim, len = .62) { // short riding cloak pinned on the right shoulder
  const c = cape(r, col, len, .46, { flare: .1 });
  if (trim) box(c.userData.end, .46, .035, .05, trim, 0, -c.userData.segLen + .02, 0, kx('ribbon', trim, { noShadow: true })); // (on the last length)
  ball(r.torso, .04, '#e0b040', .23, .62, .12, 0, kx('gem', '#e0b040', { noShadow: true }));
  return c;
}
function sandals(r, sole = '#5a3a22', strap = '#7a4e2a', high = false) {
  for (const K of [r.kneeL, r.kneeR]) {
    box(K, .145, .03, .255, sole, 0, -.39, .04, kx('sole', sole));
    box(K, .14, .022, .028, strap, 0, -.335, .1, kx('strap', strap, { noShadow: true }));
    tcyl(K, .074, .074, .022, strap, 0, -.27, 0, 6, kx('belt', strap, { noShadow: true }));
    if (PXART) { turn(high ? tcyl(K, .085, .077, .26, strap, 0, -.14, 0, 10, kx('laces', strap, { noShadow: true })) : tcyl(K, .08, .076, .12, strap, 0, -.23, 0, 10, kx('lacesLo', strap, { noShadow: true }))); continue; } // straps laced up the leg
    if (high) { tcyl(K, .079, .079, .022, strap, 0, -.18, 0, 6, { noShadow: true }); tcyl(K, .083, .083, .022, strap, 0, -.09, 0, 6, { noShadow: true }); }
  }
}
function boots(r, col, cuff) { for (const K of [r.kneeL, r.kneeR]) { tcyl(K, .086, .08, .07, cuff || shade(col, 1.2), 0, -.03, 0, 6, kx('belt', cuff || shade(col, 1.2), { noShadow: true })); if (PXART) dressBoot(K, col); } }
function dressBoot(K, col) { // pixel art: the rig's own shin and foot, where they are the boot's colour, as a leather boot
  const plain = mat(col);
  for (const o of K.children) if (o.isMesh && o.material === plain) {
    if (o.geometry.parameters?.radiusTop === .08) { o.material = kt('boot', col); o.rotation.y = PI; }
    else if (o.geometry.type === 'BoxGeometry') { const S = kt('footS', col); o.material = [S, S, kt('footT', col), mat(shade(col, .5)), S, S]; }
  }
}
function greaves(r, col = '#c9963c') { for (const K of [r.kneeL, r.kneeR]) { const g = turn(tcyl(K, .088, .078, .26, col, 0, -.12, .006, PXART ? 8 : 7, kx('greave', col))); g.scale.z = 1.05; } }
function bust(r, col) { const b = ball(r.torso, .16, col, 0, .43, .07, 1, kx('ball', col)); b.scale.set(1.15, .55, .62); }
function necklace(r, col = '#e0b040', bead) { tcyl(r.torso, .085, .1, .025, col, 0, .6, .015, 8, kx('gold', col, { noShadow: true })); if (bead) ball(r.torso, .026, bead, 0, .565, .135, 0, kx('gem', bead, { noShadow: true })); }
function earrings(r, col = '#e8c050') { for (const sx of [-1, 1]) ball(r.head, .022, col, sx * .205, .1, .02, 0, kx('gem', col, { noShadow: true })); }
function bangles(r, col = '#e0b040', sides = 'LR') { for (const c of sides) tcyl(c === 'L' ? r.elbowL : r.elbowR, .058, .056, .035, col, 0, -.24, 0, 6, kx('gold', col, { noShadow: true })); }
function armband(r, col = '#e0b040', sides = 'LR') { for (const c of sides) tcyl(c === 'L' ? r.armL : r.armR, .074, .072, .035, col, 0, -.12, 0, 6, kx('gold', col, { noShadow: true })); }
function pouch(r, col = '#6a4428', side = 1) { const p = ball(r.torso, .06, col, side * .2, .06, .1, 0, kx('pouch', col)); p.scale.set(.9, 1.1, .7); box(r.torso, .03, .03, .02, '#c8a050', side * .2, .11, .15, kx('plate', '#c8a050', { noShadow: true })); }
// -- hair --
function curls(r, col, o = {}) { // tight Greek curls: a cap ringed with little knots
  hairCap(r, col, { h: o.h ?? .82, locks: false }); // (the ring of curls is its edge)
  const n = o.n ?? 9, rad = o.rad ?? .222, s = o.s ?? .06;
  const cm = kx('curl', col, { noShadow: true }, dens(r)), d = PXART ? 1 : 0; // pixel art: rounder knots, each a lit crown over a spiralling crease
  for (let i = 0; i < n; i++) { const az = -1.15 + i / (n - 1) * 2.3; const [x, y, z] = sph(az, .6 + Math.abs(az) * -.18, rad, .24, -.04); ball(r.head, s, col, x, y, z, d, cm); }
  for (let i = 0; i < (o.back ?? 7); i++) { const az = 1.5 + i / 6 * (2 * PI - 3); const [x, y, z] = sph(az, .15 + (i % 2) * .3, rad, .22, -.06); ball(r.head, s * 1.1, col, x, y, z, d, cm); }
  if (o.top !== false) for (const [az, el] of [[0, 1.05], [1.6, 1], [-1.6, 1], [3.1, .95], [.8, 1.2], [-.8, 1.2]]) { const [x, y, z] = sph(az, el, rad, .24, -.05); ball(r.head, s * 1.05, col, x, y, z, d, cm); }
}
function locks(r, col, len = .5, n = 3, sideOnly) { // loose wavy locks falling to the shoulders/back
  for (const sx of [-1, 1]) for (let i = 0; i < n; i++) {
    const p = tcyl(r.head, .05, .04, len, col, sx * (.17 + i * .012), .2 - len / 2 + i * .02, .02 - i * .07, 5, kx('locks', col)); p.rotation.z = sx * (.08 + i * .03);
  }
  if (!sideOnly) hairFall(r, col, len, .96, .2, .17, -.13, .2); // (round 33: it hangs and swings, see hairFall)
}
function ponytail(r, col, band) {
  const pv = pivot(r.head, 0, .3, -.2); pv.rotation.x = .5;
  // round 33: each lobe on its own hinge, swung by the rope physics (models.js hangChain): it bobs as she walks, flies as she runs
  const segs = []; let par = pv;
  for (let i = 0; i < 4; i++) { const p = i ? pivot(par, 0, -.09, -.025) : pivot(pv, 0, 0, 0); segs.push(p); ball(p, .07 - i * .008, col, 0, 0, 0, PXART ? 1 : 0, kx('braid', col)); par = p; }
  if (band) tcyl(pv, .05, .05, .03, band, 0, .03, 0, 6, kx('trim', band, { noShadow: true }));
  hangChain(r, segs, { end: [0, -.08, -.02], k: 160, damp: 10, air: .1, rad: .045, sec: .9, lo: -.3, hi: 1.8, side: .6 });
}
function braids(r, col, band, n = 5) {
  for (const sx of [-1, 1]) {
    for (let i = 0; i < n; i++) { const bc = i % 2 ? shade(col, .85) : col, b = ball(r.head, .052 - i * .003, bc, sx * (.17 + i * .004), .13 - i * .085, .02 + i * .018, PXART ? 1 : 0, kx('braid', bc, { noShadow: i > 0 })); if (PXART) { b.scale.set(1.05, 1.3, .8); b.rotation.z = (i % 2 ? 1 : -1) * .4; } } // woven lobes, alternately tilted
    if (band) ball(r.head, .03, band, sx * (.17 + n * .004), .13 - n * .085, .02 + n * .018, 0, kx('gem', band, { noShadow: true }));
  }
}
function baldFringe(r, col, skin) { const f = ball(r.head, .212, col, 0, .2, -.06, 1, kx('beard', col, undefined, dens(r))); f.scale.set(1.03, .7, 1.04); ball(r.head, .182, skin, 0, .27, .0, 1).scale.set(1, .78, 1); }
function fillet(r, col, y = .33, gem, rad = .222) { const f = turn(tcyl(r.head, rad, rad, .032, col, 0, y, -.02, 10, kx('trim', col, { noShadow: true }))); f.scale.z = 1.04; if (gem) ball(r.head, .026, gem, 0, y, rad * .95, 0, kx('gem', gem, { noShadow: true })); return f; }
function wreath(r, leaf = '#5a8a3a', y = .33, berries, leaf2, rad = .225) {
  for (let i = 0; i < 13; i++) {
    const a = (i - 6) * .3, lc = i % 2 && leaf2 ? leaf2 : leaf, lf = box(r.head, .07, .022, .11, lc, Math.sin(a) * rad, y + Math.abs(i - 6) * .004, -.03 + Math.cos(a) * rad, kx('leaf', lc, { noShadow: true })); lf.rotation.set(.35, a + (i % 2 ? .35 : -.35), 0, 'YXZ');
    if (berries && i % 3 === 0) ball(r.head, .02, berries, Math.sin(a) * (rad + .013), y + .02, -.03 + Math.cos(a) * (rad + .013), 0, kx('gem', berries, { noShadow: true }));
  }
}
function flowerHair(r, col, x = -.17, y = .33, z = .07) { ball(r.head, .04, col, x, y, z, 0, { noShadow: true }); ball(r.head, .018, '#f6e070', x + Math.sign(x) * .01, y + .01, z + .035, 0, { noShadow: true }); }
function pilos(r, col) { const c = cone(r.head, .2, .3, col, 0, .5, -.03, 8, kx('felt', col)); tcyl(r.head, .213, .213, .05, shade(col, .8), 0, .36, -.03, 10, kx('felt', shade(col, .8))); return c; }
function veil(r, col, trim, lift = PXFACE) { // lift (px faces): the whole veil 3 cm up and 1 cm back, its edge clear of the brows
  const ly = lift ? .03 : 0, lz = lift ? -.01 : 0;
  const v = ball(r.head, .24, col, 0, .27 + ly, -.07 + lz, 1, kx('hood', col)); v.scale.set(1.04, .95, 1.08);
  // round 33: its back fall hangs in two lengths on a rope (rope.js), in the head's own frame: it trails and sways
  const vp = pivot(r.head, 0, .206 + ly, -.165 + lz); vp.rotation.x = .18;
  hangBoxes(r, vp, col, 'fall', .5, .38, .045, 2, { frame: r.head, first: 'free', k: 90, air: .3 });
  for (const sx of [-1, 1]) { const s = box(r.head, .05, .4, .1, col, sx * .2, .05 + ly, -.05 + lz, kx('fall', col)); s.rotation.z = sx * .08; }
  if (trim) { const t = torus(r.head, .225, .018, trim, 0, .25 + ly, .03 + lz, { noShadow: true, arc: PI }); t.rotation.set(0, 0, 0); t.rotation.x = -.35; }
  return v;
}
function sakkos(r, col, band) { const s = ball(r.head, .16, col, 0, .28, -.15, 1, kx('net', col)); s.scale.set(1.15, .95, 1); if (band) fillet(r, band, .32); }
function corinth(r, bronze = '#c9963c', crest = '#b42a2a', up = true) { // Corinthian helm, pushed up to bare the face
  const y = up ? .34 : .22;
  const hm = ball(r.head, .232, bronze, 0, y, -.04, 1, kx('helm', bronze)); hm.scale.set(1.02, .8, 1.08);
  const vz = box(r.head, .3, .1, .14, bronze, 0, y + .07, .15, kx('plate', bronze)); vz.rotation.x = -.35;
  box(r.head, .05, .06, .5, '#2c2018', 0, y + .19, -.05, kx('strap', '#2c2018'));
  for (let i = 0; i < 7; i++) { const cc = i % 2 ? crest : shade(crest, 1.15), c = box(r.head, .07, .15 + Math.sin(i / 6 * PI) * .08, .09, cc, 0, y + .26 + Math.sin(i / 6 * PI) * .04, .19 - i * .07, kx('crest', cc)); c.rotation.x = -.3 + i * .1; }
  const tail = box(r.head, .07, .3, .08, crest, 0, y + .08, -.3, kx('crest', crest)); tail.rotation.x = .4;
  return hm;
}
// -- held things --
function scroll(hand, col = '#e8d8a8') { const g = new THREE.Group(); hand.add(g); g.position.set(0, -.06, .05); const s = tcyl(g, .035, .035, .26, col, 0, 0, 0, 6, kx('paper', col)); s.rotation.z = PI / 2; for (const sx of [-1, 1]) { const k = tcyl(g, .022, .022, .03, '#8a5a2a', sx * .145, 0, 0, 5, { noShadow: true }); k.rotation.z = PI / 2; } return g; }
function lyre(parent, x, y, z) {
  const g = new THREE.Group(); parent.add(g); g.position.set(x, y, z);
  const sb = ball(g, .1, '#8a5a2e', 0, 0, 0, 1); sb.scale.set(1.05, .75, .4);
  for (const sx of [-1, 1]) { const a = box(g, .035, .3, .035, '#d8b060', sx * .08, .15, 0); a.rotation.z = -sx * .28; cone(g, .025, .06, '#d8b060', sx * .13, .31, 0, 4, { noShadow: true }); }
  box(g, .26, .03, .035, '#a8743a', 0, .27, 0);
  for (let i = 0; i < 5; i++) box(g, .008, .26, .008, '#f4ecd8', (i - 2) * .025, .14, .03, { noShadow: true });
  return g;
}
function bouquet(hand, cols) { const g = new THREE.Group(); hand.add(g); g.position.set(0, -.05, .05); g.rotation.x = -1.2; for (let i = 0; i < 3; i++) { tcyl(g, .008, .008, .26, '#4a7a2a', (i - 1) * .03, .1, 0, 4, { noShadow: true }); ball(g, .04, cols[i % cols.length], (i - 1) * .045, .24 + (i % 2) * .03, 0, 0, { noShadow: true }); } return g; }
function kylix(hand, col = '#b5653a') { const g = new THREE.Group(); hand.add(g); g.position.set(0, -.04, .08); tcyl(g, .1, .04, .04, col, 0, .03, 0, 8, kx('jar', col)); tcyl(g, .015, .015, .05, col, 0, -.01, 0, 5, kx('jar', col, { noShadow: true })); tcyl(g, .095, .095, .01, '#1a1210', 0, .052, 0, 8, kx('tondo', col, { noShadow: true })); return g; } // (pixel art: black-figure clay, a painted tondo)
function distaff(hand) { const g = new THREE.Group(); hand.add(g); g.position.set(0, -.05, .05); g.rotation.x = -.5; tcyl(g, .015, .018, .7, '#8a6a42', 0, .25, 0, 4); const w = ball(g, .085, '#f2eee4', 0, .5, 0, 1); w.scale.set(1, 1.5, 1); return g; }
function toolOnShoulder(r, kind) {
  const t = new THREE.Group(); r.torso.add(t); t.position.set(.2, .66, -.08); t.rotation.set(-.35, 0, -.4);
  tcyl(t, .025, .03, 1.55, '#7a5a3a', 0, 0, 0, 5, kx('wood', '#7a5a3a'));
  const M = '#7a7e86';
  if (kind === 'hoe') { box(t, .2, .05, .16, M, 0, .76, .07, kx('plate', M)); }
  else if (kind === 'rake') { box(t, .32, .04, .04, '#6a4a2a', 0, .76, 0); for (let i = 0; i < 5; i++) box(t, .02, .02, .1, '#6a4a2a', (i - 2) * .07, .76, .06, { noShadow: true }); }
  else if (kind === 'fork') { box(t, .2, .03, .03, '#6a4a2a', 0, .76, 0); for (let i = 0; i < 3; i++) box(t, .022, .22, .022, '#6a4a2a', (i - 1) * .09, .88, 0); }
  else { const p = box(t, .42, .05, .05, M, 0, .76, 0, kx('plate', M)); p.rotation.z = .12; }
  hold(r, 'R', t, 0, -.22, .02); r.prop = t; return t;
}
function hydria(r, onHead) {
  const a = amphora(onHead ? r.head : r.torso, 0, 0, 0);
  if (onHead) { a.position.set(0, .7, -.02); a.scale.setScalar(.85); hold(r, 'L', r.head, -.17, .58, 0); }
  else { a.position.set(-.34, .08, .08); a.rotation.set(.1, 0, -.25); hold(r, 'L', a, .02, .3, .02); }
  r.prop = a; return a;
}
function breadTray(r) {
  const g = new THREE.Group(); r.head.add(g); g.position.set(0, .44, 0);
  box(g, .4, .03, .3, '#a8743a', 0, 0, 0, kx('wicker', '#a8743a'));
  for (const [x, z] of [[-.1, -.06], [.1, -.06], [0, .07], [-.12, .08], [.12, .08]]) ball(g, .065, '#d89a48', x, .05, z, 0).scale.set(1.2, .7, 1);
  hold(r, 'R', r.head, .2, .48, 0); r.prop = g; return g;
}
function woodBundle(r) {
  const g = new THREE.Group(); r.torso.add(g); g.position.set(0, .45, -.3);
  for (let i = 0; i < 5; i++) { const wc = i % 2 ? '#7a5434' : '#8a6440', l = tcyl(g, .045, .045, .7, wc, (i % 3 - 1) * .07, Math.floor(i / 3) * .08, (i % 2) * .03, 5, kx('wood', wc)); l.rotation.z = PI / 2 + (i - 2) * .05; }
  for (const sx of [-1, 1]) strap(r.torso, [sx * .16, .6, .14], [sx * .16, .4, -.26], .03, .025, '#6a4a2a', { noShadow: true });
  return g;
}
function sack(r, col = '#c8b48a') {
  const s = ball(r.torso, .22, col, .02, .42, -.3, 1, kx('burlap', col)); s.scale.set(1, 1.15, .75);
  tcyl(r.torso, .05, .07, .1, col, .02, .68, -.28, 6, kx('burlap', col));
  strap(r.torso, [.22, .6, .1], [-.18, .1, .17], .04, .025, '#7a5a3a', { noShadow: true });
  return s;
}
// ---------- round 33 (NPC, Roy's NPC addendum: "no unfinished assemblies of cubes, spheres, cylinders") ----------
// The people V meets (r.npc: townsfolk, the trades, the crowd, the friendly story cast) are shaped before their parts
// merge: limbs with a deltoid, a biceps, a forearm that swells below the elbow and a slim wrist, a thigh that tapers to
// the knee, a calf and a narrow ankle (inward everywhere a sleeve, bracer, lace or boot sits over them, so nothing pokes
// through); the shoulders slope from the neck down to the arm (every piece worn on the chest bends with them, so the
// layers stay in order); long robes fall in pleats and flare a little to an uneven hem. Enemies and V are untouched.
const SCULPT = new Map();
const bump = (t, c, w) => { const d = (t - c) / w; return d * d < 1 ? (1 - d * d) ** 2 : 0; };
const sstep = (a, b, t) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const LIMBS = [ // [pivot key, radiusTop, radiusBottom, height, profile(t 0 top..1 bottom, f = front-ness -1..1) -> radial scale]
  ['arm', .068, .058, .3, (t, f) => 1 + .2 * bump(t, .12, .24) + .13 * bump(t, .5, .26) * Math.max(0, f) - .16 * sstep(.75, 1, t)],
  ['elbow', .058, .048, .28, (t, f) => 1 + .16 * bump(t, .2, .24) * (.55 + .45 * Math.abs(f)) - .26 * sstep(.45, 1, t)],
  ['leg', .095, .075, .44, (t, f) => 1 + .07 * bump(t, .3, .3) * (f > 0 ? 1 : .4) - .12 * sstep(.68, 1, t)],
  ['knee', .08, .07, .3, (t, f) => 1 + .045 * bump(t, .28, .2) * Math.max(0, -f) - .2 * sstep(.6, 1, t)],
];
function limbGeo(q, prof, flip) {
  const key = [q.radiusTop, q.radiusBottom, q.height, q.radialSegments, flip].join();
  if (SCULPT.has(key)) return SCULPT.get(key);
  const g = new THREE.CylinderGeometry(q.radiusTop, q.radiusBottom, q.height, q.radialSegments, 5, q.openEnded), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rr = Math.hypot(x, z); if (rr < 1e-5) continue;
    const t = (q.height / 2 - y) / q.height, k = prof(t, (flip ? -z : z) / rr);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals(); SCULPT.set(key, g); return g;
}
const _sm = new THREE.Matrix4(), _si = new THREE.Matrix4(), _sv = new THREE.Vector3();
function relMatrix(o, top, out) { out.identity(); for (let p = o; p && p !== top; p = p.parent) { p.updateMatrix(); out.premultiply(p.matrix); } return out; }
const yokeDY = (x, y, z) => { // the shoulders' slope (torso space: y up from the hips, the neck at x 0)
  const w = sstep(.44, .6, y); if (!w) return 0;
  const ax = Math.min(1, Math.max(0, Math.abs(x) - .06) / .2), bz = Math.min(1, Math.max(0, Math.abs(z) - .09) / .1);
  return -w * (.068 * ax ** 1.3 + .022 * bz * bz);
};
function sculptNpc(r) {
  if (!r.npc || r._sculpt || !r.torso || !r.armL) return r;
  r._sculpt = true;
  // limbs
  if (!LOD.cap) for (const [key, rt, rb, h, prof] of LIMBS) for (const side of ['L', 'R']) {
    const J = r[key + side]; if (!J) continue;
    for (const o of J.children) {
      const q = o.isMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters; if (!q || q.radiusTop !== rt || q.radiusBottom !== rb || q.height !== h) continue;
      const flip = Math.abs(Math.abs(o.rotation.y) - PI) < .3;
      const g = limbGeo(q, prof, flip); for (const c of o.children) if (c.userData.outline && c.geometry === o.geometry) c.geometry = g; o.geometry = g;
    }
  }
  // the yoke: every piece on the chest, bent with the shoulders (not the arms, the head or the robes below)
  const skip = new Set([r.armL, r.armR, r.head].filter(Boolean));
  const list = [];
  (function walk(o) { for (const c of o.children) { if (skip.has(c)) continue; if (c.isMesh && !c.userData.cloth && !c.userData.outline) list.push(c); walk(c); } })(r.torso);
  r.torso.updateMatrixWorld(true);
  for (const m of list) {
    const pos = m.geometry.attributes.position; if (!pos) continue;
    relMatrix(m, r.torso, _sm); _si.copy(_sm).invert();
    let hit = false;
    for (let i = 0; i < pos.count && !hit; i++) { _sv.fromBufferAttribute(pos, i).applyMatrix4(_sm); if (_sv.y > .44) hit = true; }
    if (!hit) continue;
    const g = m.geometry.clone(), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { _sv.fromBufferAttribute(p, i).applyMatrix4(_sm); _sv.y += yokeDY(_sv.x, _sv.y, _sv.z); _sv.applyMatrix4(_si); p.setXYZ(i, _sv.x, _sv.y, _sv.z); }
    g.computeVertexNormals(); g.computeBoundingSphere(); m.geometry = g;
  }
  for (const A of [r.armL, r.armR]) A.position.y -= .016; // the arm hangs from the lower shoulder
  // ...and the sleeve's (and upper arm's) top bends down with it, so its flat cap stays tucked under the shoulder, not
  // showing as a lit disc from above
  for (const A of [r.armL, r.armR]) for (const m of A.children) {
    if (!m.isMesh || m.userData.outline || !m.geometry.attributes.position) continue;
    relMatrix(m, r.torso, _sm); _si.copy(_sm).invert();
    const g = m.geometry.clone(), p = g.attributes.position; let moved = false;
    for (let i = 0; i < p.count; i++) {
      _sv.fromBufferAttribute(p, i).applyMatrix4(m.matrix); const k = sstep(-.12, -.02, _sv.y); if (!k) continue; // (arm space: 0 at the pivot)
      _sv.fromBufferAttribute(p, i).applyMatrix4(_sm); _sv.y += k * Math.min(0, yokeDY(_sv.x, _sv.y + .016, _sv.z) + .016); _sv.applyMatrix4(_si); p.setXYZ(i, _sv.x, _sv.y, _sv.z); moved = true;
    }
    if (!moved) { g.dispose(); continue; }
    g.computeVertexNormals(); g.computeBoundingSphere(); for (const c of m.children) if (c.userData.outline && c.geometry === m.geometry) c.geometry = g; m.geometry = g;
  }
  if (!r.hands) for (const E of [r.elbowL, r.elbowR]) { const h = E?.children.find((o) => o.isMesh && o.geometry.parameters?.radius === .055 && o.position.y < -.25); if (h) { h.scale.y *= 1.22; h.scale.z *= .9; h.position.y -= .012; } } // a hand, longer than it is thick
  // robes: pleats and a flared, uneven hem on the outermost garment of each height (an inner one stays put under it)
  const robes = (r.robes || []).filter((C) => C.m.parent);
  const span = (C) => { relMatrix(C.m, r.torso, _sm); const y = _sm.elements[13]; return [y - C.h / 2, y + C.h / 2, (C.rt + C.rb) / 2 * Math.max(C.m.scale.x, C.m.scale.z)]; };
  const sp = robes.map(span);
  robes.forEach((C, j) => {
    const [a0, a1, rad] = sp[j];
    const covered = sp.some(([b0, b1, rb], k) => k !== j && rb > rad + .005 && Math.min(a1, b1) - Math.max(a0, b0) > (a1 - a0) * .5);
    const A = covered ? 0 : .07, F = covered ? .012 : .04, ph = (r.info?.seed || 1) * 1.7, NR = Math.max(...C.row);
    const fac = (c, t) => 1 + t ** 1.4 * (A * (c % 2 ? -1 : 1) + F);
    const P = C.m.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const c = C.col[i]; if (c < 0) continue;
      const t = C.row[i] / NR, f = fac(c, t);
      C.rest[i * 3] *= f; C.rest[i * 3 + 2] *= f;
      if (C.row[i] === NR) C.rest[i * 3 + 1] += .014 * Math.sin(c / C.n * PI * 6 + ph) * (covered ? .3 : 1);
      P.setXYZ(i, C.rest[i * 3], C.rest[i * 3 + 1], C.rest[i * 3 + 2]);
    }
    P.needsUpdate = true; C.m.geometry.computeVertexNormals();
    for (const F2 of C.fol || []) { // its hem band and key: out with the pleats at its angle
      const dy = (F2.m.rotation.y || 0) - (C.m.rotation.y || 0), FP = F2.m.geometry.attributes.position;
      for (let i = 0; i < FP.count; i++) {
        if (F2.col[i] < 0) continue;
        const a = Math.atan2(F2.rest[i * 3], F2.rest[i * 3 + 2]) + dy, c = (((Math.round(a / (PI * 2) * C.n)) % C.n) + C.n) % C.n, f = fac(c, 1);
        F2.rest[i * 3] *= f; F2.rest[i * 3 + 2] *= f; F2.rest[i * 3 + 1] += .014 * Math.sin(c / C.n * PI * 6 + ph) * (covered ? .3 : 1);
        FP.setXYZ(i, F2.rest[i * 3], F2.rest[i * 3 + 1], F2.rest[i * 3 + 2]);
      }
      FP.needsUpdate = true; F2.m.geometry.computeVertexNormals();
    }
  });
  return r;
}

// merge same-material static parts under each joint into one mesh: far fewer draw calls for detailed rigs
function bake(r) {
  refineRig(r); // round 33: rounder parts before they are merged (models.js)
  sculptNpc(r); // round 33 (NPC): shaped limbs, sloped shoulders, pleated robes for the people V meets
  fitWrists(r); // (Roy 29.10, ?hands=b1-b3 and final: the wrist from the forearm's rim as it now is)
  const keep = new Set();
  const mark = (v, d = 0) => {
    if (!v || d > 2) return;
    if (v.isObject3D) keep.add(v);
    else if (Array.isArray(v)) v.forEach((x) => mark(x, d + 1));
    else if (typeof v === 'object' && v.constructor === Object) for (const k in v) mark(v[k], d + 1);
  };
  for (const k in r) if (k !== 'root' && k !== 's' && k !== 'info') mark(r[k]);
  const parents = []; r.root.traverse((o) => { if (o.children.length) parents.push(o); });
  for (const p of parents) {
    const groups = new Map();
    for (const c of p.children) {
      if (!c.isMesh || c.children.length || keep.has(c) || Array.isArray(c.material) || c.material.transparent || !c.visible) continue;
      const key = c.material.uuid + (c.castShadow ? 's' : 'n');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const parts = []; let n = 0;
      for (const m of list) { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix); parts.push(g); n += g.attributes.position.count; }
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = parts.every((g) => g.attributes.uv) && new Float32Array(n * 2); let o = 0; // uvs kept: the pixel-art textures
      for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const mm = new THREE.Mesh(geo, list[0].material); mm.castShadow = list[0].castShadow; p.add(mm);
      for (const m of list) p.remove(m);
    }
  }
  return r;
}
const done = (r) => finish(bake(r));
export { kx, turn, bake, chiton, drape, wrapSkirt, chlamys, sandals, boots, hem, meander, neckTrim, sleeveTrim, overfold, bust, curls, locks, ponytail, braids, baldFringe, wreath, fillet, veil, pilos, corinth,
  hairCap, longHair, beard, bun, robe, belt, cape, sash, hood, lashes, pecs, bracer, staff, hold, torus, strap, petasos, scroll, necklace, earrings, bangles, armband, pouch, sack };

// ======================================================================================
// MAIN STORY CAST
// ======================================================================================
// ---------- the story cast in pixel art (round 16): each character's own pieces ----------
// Armour, crowns, props and the ferry, painted like the kit (KIT above): STORY entries are [W, H, paint(c, Q), o] on a
// 6-shade palette Q (darkest first, Q[3] the piece's colour), tinted from NEU unless o.ramp. pt(kind, col) is a material
// (a STORY or a KIT kind), px(kind, col, o) mesh opts (plain colour under ?art=off), pd(m, kind, col) re-dresses a part.
import * as PXA from './pxart.js';
const RQ = { ramp: true }, CQ = { ramp: true, cut: true }, CT = { cut: true }, NSH = { noShadow: true };
const KN = ['#030305', '#0a0a0e', '#121218', '#1c1c24', '#363642', '#a4a4b6']; // the dark rider's plate: near black, read by a bright edge
const bevel = (c, Q, x, y, w, h) => { c.R(x, y, w, 1, Q[5]); c.R(x, y + 1, 1, h - 1, Q[4]); c.R(x + w - 1, y + 1, 1, h - 1, Q[1]); c.R(x, y + h - 1, w, 1, Q[0]); }; // a plate's edge lit from the top left
const lames = (c, Q, ys) => { for (const y of ys) { c.R(0, y - 1, c.W, 1, Q[0]); c.R(0, y, c.W, 1, Q[5]); c.R(0, y + 1, c.W, 1, Q[4]); } }; // overlapping plates: a dark seam, the next plate's lit lip
const disc = (c, f) => { for (let j = 0; j < c.H; j++) for (let i = 0; i < c.W; i++) { const x = i + .5 - c.W / 2, y = j + .5 - c.H / 2; c.P(i, j, f(Math.hypot(x, y), Math.atan2(y, x), x, y)); } }; // a cylinder cap's face
const STORY = {
  // ---- bone, horn, scales
  bone: [32, 16, (c, Q) => { // a skull's crown (front at u .75): lit top with a glint, a hairline crack at the temple, a few pits, the shaded underside
    const { R, P, W, H } = c; R(0, 0, W, H, Q[3]); R(0, 0, W, 4, Q[4]); R(0, H - 4, W, 2, Q[2]); R(0, H - 2, W, 2, Q[1]);
    for (let y = 4, x = 28; y < 9; y++, x += y & 1) P(x, y, Q[2]); for (const [x, y] of [[6, 7], [14, 9], [19, 6]]) P(x, y, Q[2]); P(21, 1, Q[5]); P(22, 1, Q[5]); P(21, 2, Q[5]);
  }, RQ],
  teeth: [16, 8, (c, Q) => { const { R, P, W, H } = c; R(0, 0, W, H, Q[3]); R(0, 0, W, 2, Q[1]); R(0, H - 1, W, 1, Q[1]); for (let x = 1; x < W; x += 3) { R(x, 2, 1, H - 3, Q[1]); P(x + 1, 2, Q[5]); } }, RQ],
  scales: [24, 12, (c, Q) => PXA.paScallops(c, Q, { w: 4, h: 5, glint: .3 }), RQ], // a snake's hide
  scalp: [128, 48, (c, Q) => PXA.paScallops(c, Q, { w: 6, h: 7, glint: .25 }), RQ],
  horn: [32, 16, (c, Q) => { // a ringed horn: ridges lit on top over a groove, a lit stripe down the front, the far side dark
    const { R, P, W, H, F } = c; R(0, 0, W, H, Q[2]); for (let y = 0; y < H; y += 4) { R(0, y, W, 1, Q[4]); R(0, y + 1, W, 1, Q[3]); R(0, y + 3, W, 1, Q[0]); }
    R(F - 5, 0, 2, H, Q[4]); for (let y = 0; y < H; y += 4) P(F - 4, y, Q[5]); R(F + 6, 0, 5, H, Q[1]);
  }, RQ],
  spike: [16, 16, (c, Q) => { const { R, P, W, H } = c; R(0, 0, W, H, Q[2]); R(3, 0, 2, H, Q[4]); R(4, 0, 1, H >> 1, Q[5]); R(10, 0, 4, H, Q[1]); R(0, H - 1, W, 1, Q[0]); }, RQ], // a spike or point, a lit edge down one side
  // ---- iron, gold
  iron: [24, 24, (c, Q) => { // a forged plate: bevelled edge, a sunken field, rivets at the corners, a scratch
    const { R, P, W, H } = c; R(0, 0, W, H, Q[2]); R(3, 3, W - 6, H - 6, Q[3]); R(3, 3, W - 6, 1, Q[1]); R(3, H - 4, W - 6, 1, Q[4]); bevel(c, Q, 0, 0, W, H);
    for (const [x, y] of [[1, 1], [W - 3, 1], [1, H - 3], [W - 3, H - 3]]) PXA.rivet(c, x, y, Q); for (let k = 0; k < 4; k++) P(8 + k, 9 + k, Q[4]); P(12, 13, Q[1]);
  }, RQ],
  ironDome: [48, 24, (c, Q) => { // a pauldron (front at u .75): three lames, a row of rivets, a glint on the crown
    const { R, P, W, H } = c; R(0, 0, W, H, Q[2]); R(0, 0, W, 5, Q[3]); R(0, 0, W, 2, Q[4]); lames(c, Q, [9, 15, 20]); R(0, H - 1, W, 1, Q[0]);
    for (let x = 2; x < W; x += 6) PXA.rivet(c, x, 11, Q); for (let k = 0; k < 3; k++) { P(34 + k, 2 + k, Q[5]); P(35 + k, 2 + k, Q[5]); }
  }, RQ],
  circlet: [96, 8, (c, Q) => { // an iron band: lit lip, dark lower edge, a carved mark every 8 texels
    const { R, P, W } = c; PXA.paMetal(c, Q, { glint: 24 }); const G = ['X.X', 'XXX', '.X.'];
    for (let x = 2; x < W; x += 8) G.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') { P(x + i, 3 + j, Q[0]); P(x + i + 1, 4 + j, Q[4]); } }));
  }, RQ],
  brooch: [32, 32, (c, Q) => disc(c, (r, a) => { const s = (r - a * 1.6 + 40) % 5; return r > 15 ? Q[1] : r > 13.5 ? Q[4] : r < 2 ? Q[5] : s < 1.4 ? Q[1] : s < 2.4 ? Q[4] : Q[3]; }), RQ], // a coiled snake on a ringed disc
  phiale: [48, 48, (c, Q) => disc(c, (r, a) => { // a libation bowl's inside: the lit rim, a ring of lobes round the boss
    if (r > 23) return Q[1]; if (r > 21) return Q[5]; if (r > 20) return Q[2]; if (r < 6) return Q[4]; if (r < 8) return Q[1];
    const t = Math.cos(a * 14); return t > .55 ? Q[4] : t < -.6 ? Q[1] : Q[3];
  }), RQ],
  // ---- cloth
  tatter: [12, 28, (c, Q) => { // a torn strip of cloth (cut out): a fold down it, a ragged end
    const { R, P, W, H, rnd } = c;
    for (let x = 0; x < W; x++) { const e = H - 1 - (rnd() * 8 | 0) - (x % 5 === 2 ? 5 : 0); R(x, 0, 1, e, x === 0 || x === 4 ? Q[4] : x === W - 1 || x === 3 || x === 8 ? Q[1] : Q[3]); P(x, e - 1, Q[1]); }
    R(0, 0, W, 1, Q[2]);
  }, CQ],
  capelet: [128, 40, (c, Q) => { // a ferryman's shoulder cape: gathered at the neck, folds, moth holes, a frayed hem
    const { R, P, W, H, rnd } = c; R(0, 0, W, H, Q[3]); R(0, 0, W, 1, Q[4]); for (let x = 0; x < W; x += 3) { R(x, 1, 1, 3, Q[2]); R(x + 1, 1, 1, 2, Q[4]); }
    PXA.paFolds(c, Q, { y0: 3, y1: H - 5, n: 9, fan: .7 });
    for (let x = 0; x < W; x++) { const e = H - 2 - (x % 7 === 3 ? 3 : (rnd() * 2 | 0)); P(x, H - 5, Q[2]); R(x, e, 1, H - e, Q[0]); if (e < H - 2) P(x, e - 1, Q[1]); }
    for (let i = 0; i < 7; i++) { const x = rnd() * W | 0, y = 8 + rnd() * (H - 18) | 0; P(x, y, Q[0]); P(x + 1, y, Q[1]); P(x, y + 1, Q[1]); P(x - 1, y - 1, Q[4]); }
  }, RQ],
  regal: [128, 40, (c, Q) => { // a fallen king's mantle: gathered at the neck, folds, a woven key band and rolled hem, worn through here and there
    const { R, P, W, H, rnd } = c, M = PXA.MOTIF.key; R(0, 0, W, H, Q[3]); R(0, 0, W, 1, Q[4]); for (let x = 0; x < W; x += 3) { R(x, 1, 1, 3, Q[2]); R(x + 1, 1, 1, 2, Q[4]); }
    PXA.paFolds(c, Q, { y0: 3, y1: H - 11, n: 9, fan: .7 });
    const y = H - 11; R(0, y, W, 7, Q[2]); R(0, y, W, 1, Q[4]); R(0, y + 6, W, 1, Q[0]);
    for (let x = 0; x < W; x++) M.forEach((row, j) => { if (row[x % 6] === 'X' && rnd() > .12) P(x, y + 1 + j, Q[4]); });
    PXA.paHem(c, Q, H - 4); for (let x = 5; x < W; x += 13) { P(x, H - 1, Q[0]); P(x, H - 2, Q[1]); }
  }, RQ],
  wideSleeve: [48, 24, (c, Q) => { const { R, W, H } = c; R(0, 0, W, H, Q[3]); R(0, 0, W, 1, Q[4]); PXA.paFolds(c, Q, { y0: 1, y1: H - 5, n: 4, fan: .8 }); R(0, H - 5, W, 1, Q[4]); R(0, H - 4, W, 3, Q[2]); PXA.paStitch(c, Q[4], H - 3); R(0, H - 1, W, 1, Q[0]); }, RQ],
  stole: [24, 96, (c, Q) => { // a long woven panel down the front: edges, two folds, a band with a key, a knotted fringe
    const { R, P, W, H } = c, M = PXA.MOTIF.key; R(0, 0, W, H, Q[3]); R(0, 0, 1, H, Q[4]); R(W - 1, 0, 1, H, Q[1]); R(1, 0, 1, H, Q[2]); PXA.paStitch(c, Q[5], 0); R(8, 4, 1, H - 24, Q[1]); R(9, 6, 1, H - 28, Q[4]); R(16, 10, 1, H - 30, Q[2]);
    for (const y of [H - 20, H - 32]) { R(0, y, W, 9, Q[1]); R(0, y, W, 1, Q[4]); for (let x = 0; x < W; x++) M.forEach((row, j) => { if (row[(x + 3) % 6] === 'X') P(x, y + 2 + j, Q[4]); }); }
    for (let x = 0; x < W; x++) { R(x, H - 5, 1, 5, x % 2 ? Q[1] : Q[4]); P(x, H - 6, Q[2]); }
  }],
  wrapL: [96, 12, (c, Q) => { const { R, P, W, H } = c; R(0, 0, W, H, Q[3]); R(0, 0, W, 1, Q[4]); R(0, H - 1, W, 1, Q[1]); for (let x = 0; x < W; x++) for (let k = 0; k < 3; k++) { const y = (Math.floor(x / 4) + k * 4) % H; P(x, y, Q[1]); P(x, y - 1, Q[4]); } }], // a linen band wound round and round
  legWrap: [48, 32, (c, Q) => { const { P, W, H } = c; for (let y0 = -6; y0 < H; y0 += 6) for (let x = 0; x < W; x++) { const y = y0 + Math.round(x / W * 6); for (let k = 0; k < 4; k++) if (y + k >= 0 && y + k < H) P(x, y + k, k === 0 ? Q[4] : k === 3 ? Q[1] : Q[3]); } }, CT], // cloth puttees wound up the leg (cut out)
  tunic: [112, 48, (c, Q) => { // a shade's rotted tunic: folds from the shoulders, rents with dark edges, a frayed seam at the waist
    const { R, P, S, W, H, F, rnd } = c; R(0, 0, W, H, Q[3]); R(0, 0, W, 2, Q[4]); PXA.paFolds(c, Q, { y0: 3, y1: H - 6, n: 10, fan: .5 });
    for (const [x, y, l] of [[F + 9, 16, 9], [F - 24, 24, 7], [F + 30, 30, 8], [6, 12, 10]]) for (let k = 0; k < l; k++) { P(x + (k >> 1), y + k, Q[0]); P(x + (k >> 1) + 1, y + k, Q[1]); P(x + (k >> 1) - 1, y + k, Q[4]); }
    for (let x = 0; x < W; x++) { R(x, H - 5, 1, 1, Q[2]); if (rnd() < .4) P(x, H - 4, Q[1]); } R(0, H - 3, W, 3, Q[1]); S(0, 4, Q[1]); S(0, 5, Q[2]);
  }, RQ],
  wisp: [32, 32, (c, Q) => { // a ghost's glow: streaks rising in light and shade, a few bright motes
    const { R, P, W, H, rnd } = c; R(0, 0, W, H, Q[3]);
    for (let k = 0; k < 14; k++) { const x = rnd() * W | 0, y = rnd() * H | 0, l = 4 + rnd() * 10 | 0, col = k % 3 ? Q[4] : Q[2]; for (let t = 0; t < l; t++) P(x + Math.round(Math.sin((y + t) * .4 + k)), (y + t) % H, col); }
    for (let k = 0; k < 6; k++) P(rnd() * W | 0, rnd() * H | 0, Q[5]);
  }],
  // ---- wood, rope, stone, paper
  planks: [128, 16, (c, Q) => { // one strake of the hull: a lit lap on top, grain, butt joints, nails at each rib, the shadow of the strake below
    const { R, P, W, H, rnd } = c; R(0, 0, W, H, Q[3]); R(0, 0, W, 1, Q[4]); R(0, H - 2, W, 1, Q[1]); R(0, H - 1, W, 1, Q[0]);
    for (let k = 0; k < 5; k++) { const y = 2 + k * 2 + (rnd() * 2 | 0), ph = rnd() * 6; for (let x = 0; x < W; x++) if (Math.sin(x * .09 + ph) > -.3) P(x, y + Math.round(Math.sin(x * .05 + ph)), Q[2]); }
    for (const x of [0, 77]) { R(x, 1, 1, H - 2, Q[0]); R(x + 1, 1, 1, H - 2, Q[4]); }
    for (let x = 12; x < W; x += 32) for (const y of [3, H - 5]) { P(x, y, Q[0]); P(x + 1, y, Q[1]); P(x, y - 1, Q[5]); }
    for (let i = 0; i < 3; i++) { const x = rnd() * W | 0, y = 4 + rnd() * 7 | 0; P(x, y, Q[0]); P(x + 1, y, Q[1]); P(x - 1, y, Q[2]); P(x, y - 1, Q[4]); }
  }, RQ],
  boards: [64, 16, (c, Q) => { // a board's grain along u (laid on by uvBox): wavy grain, a knot, worn lighter on top
    const { R, P, W, H, rnd } = c; R(0, 0, W, H, Q[3]);
    for (let k = 0; k < 6; k++) { const y = 1 + k * 2.6 | 0, ph = rnd() * 6; for (let x = 0; x < W; x++) if (Math.sin(x * .13 + ph) > -.4) P(x, y + Math.round(Math.sin(x * .07 + ph) * .8), k % 2 ? Q[2] : Q[4]); }
    const x = 20 + rnd() * 20 | 0; P(x, 8, Q[0]); P(x + 1, 8, Q[1]); P(x - 1, 8, Q[2]); P(x, 7, Q[4]); P(x + 1, 9, Q[2]);
  }, RQ],
  rope: [32, 8, (c, Q) => { const { P, W, H } = c; for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { const t = (x + y * 2) % 6; P(x, y, t === 0 ? Q[0] : t === 1 ? Q[5] : t < 3 ? Q[4] : t < 5 ? Q[3] : Q[2]); } }, RQ], // twisted strands (u along the rope)
  coilEnd: [32, 32, (c, Q) => disc(c, (r, a) => { const k = r % 3.2, t = ((Math.round(a * r * .9) % 3) + 3) % 3; return r > 15.5 || r < 3 ? Q[1] : k < .8 ? Q[0] : k < 1.7 ? (t ? Q[4] : Q[5]) : t === 1 ? Q[2] : Q[3]; }), RQ], // a coil of rope seen end on: the wound turns, each twisted
  grip: [16, 8, (c, Q) => { const { P, W, H } = c; for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { const t = (x + y) % 4; P(x, y, t === 0 ? Q[1] : t === 1 ? Q[4] : Q[3]); } }, RQ], // a cord or leather wrap
  stone: [32, 32, (c, Q) => PXA.paGrit(c, Q, { fleck: 16, pit: 3, bump: 2, crack: .5 }), RQ],
  marble: [32, 32, (c, Q) => { // carved marble (laid on by uvBox, tinted): a fine fleck, two faint veins, chisel strokes
    const { P, W, H, rnd } = c; PXA.paGrit(c, Q, { fleck: 5, pit: .6 });
    for (let k = 0; k < 2; k++) { let x = rnd() * W, y = 0; for (; y < H; y++) { P(x, y, rnd() < .25 ? Q[1] : Q[2]); x += rnd() < .5 ? 1 : rnd() < .3 ? -1 : 0; } }
    for (let k = 0; k < 6; k++) { const x = rnd() * W | 0, y = rnd() * H | 0; P(x, y, Q[4]); P(x + 1, y + 1, Q[4]); P(x + 2, y + 1, Q[2]); }
  }],
  parch: [16, 16, (c, Q) => { const { R, P, W, H, rnd } = c; R(0, 0, W, H, Q[3]); for (let i = 0; i < 30; i++) P(rnd() * W | 0, rnd() * H | 0, rnd() < .5 ? Q[2] : Q[4]); R(0, 0, W, 1, Q[2]); R(0, H - 1, W, 1, Q[1]); }, RQ],
  map: [96, 64, (c, Q) => { // Medusa's map: worn parchment, an inked border, islands with hills, wave marks, a dotted route to a red cross, a compass star
    const { R, P, W, H, rnd } = c, ink = '#4a2c1a', red = '#b0281c', land = [[22, 22, 15, 10], [34, 30, 8, 9], [62, 42, 13, 8], [74, 18, 9, 6], [50, 14, 5, 4], [16, 48, 6, 5]];
    const isL = (i, j) => land.some(([x, y, a, b]) => ((i - x) / a) ** 2 + ((j - y) / b) ** 2 < 1 + .18 * Math.sin(i * 1.3 + j * .7));
    R(0, 0, W, H, Q[3]); for (let i = 0; i < 260; i++) P(rnd() * W | 0, rnd() * H | 0, rnd() < .5 ? Q[2] : Q[4]);
    for (let j = 6; j < H - 6; j++) for (let i = 6; i < W - 6; i++) if (isL(i, j)) P(i, j, !isL(i - 1, j) || !isL(i + 1, j) || !isL(i, j - 1) || !isL(i, j + 1) ? ink : !isL(i, j + 2) ? Q[2] : Q[4]);
    for (const [x, y] of [[20, 20], [26, 24], [64, 41], [72, 17], [33, 29]]) { P(x, y, ink); P(x - 1, y + 1, ink); P(x + 1, y + 1, ink); P(x + 1, y, Q[5]); }
    for (let k = 0; k < 16; k++) { const x = 8 + rnd() * (W - 20) | 0, y = 8 + rnd() * (H - 16) | 0; if (!isL(x, y) && !isL(x + 3, y)) { P(x, y, Q[1]); P(x + 1, y - 1, Q[1]); P(x + 2, y, Q[1]); P(x + 3, y - 1, Q[1]); } }
    for (let t = 0; t < 1; t += .025) { const x = 28 + t * 34 + Math.sin(t * 6) * 4, y = 34 + t * 6 - Math.sin(t * 3) * 10; if ((t * 40 | 0) % 2) P(x, y, red); }
    for (let k = -2; k <= 2; k++) { P(63 + k, 40 + k, red); P(63 + k, 40 - k, red); }
    for (let k = -4; k <= 4; k++) { P(82 + k, 50, ink); P(82, 50 + k, ink); } for (let k = -2; k <= 2; k++) { P(82 + k, 50 + k, Q[1]); P(82 + k, 50 - k, Q[1]); } P(82, 45, red);
    for (const d of [3, 5]) { R(d, d, W - 2 * d, 1, ink); R(d, H - 1 - d, W - 2 * d, 1, ink); R(d, d, 1, H - 2 * d, ink); R(W - 1 - d, d, 1, H - 2 * d, ink); }
    R(0, 0, W, 2, Q[1]); R(0, H - 2, W, 2, Q[1]); R(0, 0, 2, H, Q[1]); R(W - 2, 0, 2, H, Q[1]); R(0, 0, W, 1, Q[0]); R(0, H - 1, W, 1, Q[0]);
  }, RQ],
  tablet: [48, 64, (c, Q) => { // the nameless king's slab: a raised border, rows of carved signs (each cut dark with a lit lower lip), cracks right through
    const { R, P, W, H, rnd } = c; PXA.paGrit(c, Q, { fleck: 8, pit: 1 }); bevel(c, Q, 0, 0, W, H); R(3, 3, W - 6, 1, Q[1]); R(3, 3, 1, H - 6, Q[1]); R(3, H - 4, W - 6, 1, Q[4]); R(W - 4, 3, 1, H - 6, Q[4]);
    const G = [['XX.', 'X..', 'XX.', '..X'], ['X.X', 'XXX', 'X.X', 'X.X'], ['XXX', '.X.', '.X.', 'XXX'], ['X..', 'XX.', 'X.X', 'XXX'], ['.X.', 'X.X', '.X.', 'X.X'], ['XXX', 'X..', 'XX.', 'X..']];
    for (let y = 7; y < H - 9; y += 7) for (let x = 7; x < W - 8; x += 5) { const g = G[rnd() * G.length | 0]; if (rnd() < .12) continue; g.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') { P(x + i, y + j, Q[1]); P(x + i + 1, y + j + 1, Q[4]); } })); }
    for (const [x0, y0, l, s] of [[10, 2, 30, 1], [40, 20, 26, -1], [4, 44, 20, 1]]) { let x = x0; for (let k = 0; k < l; k++) { const y = y0 + k; P(x, y, Q[0]); P(x + 1, y, Q[4]); if (rnd() < .5) x += s; } }
  }, RQ],
  satchel: [24, 24, (c, Q) => { // a satchel's face: the flap with a stitched edge, its strap and a brass buckle, the scuffed pocket under it
    const { R, P, W, H } = c, Bs = PXA.ramp('#c8a050', 6); PXA.paLeather(c, Q, { edge: false, stitch: false }); R(0, 0, W, 14, Q[4]); R(0, 14, W, 1, Q[1]); R(0, 15, W, 1, Q[2]);
    for (let x = 1; x < W - 1; x += 2) P(x, 12, Q[5]); R(0, 0, W, 1, Q[5]); R(10, 0, 4, 19, Q[2]); R(10, 0, 1, 19, Q[4]); R(9, 15, 6, 5, Bs[3]); R(10, 16, 4, 3, Q[1]); P(9, 15, Bs[5]); R(0, H - 1, W, 1, Q[0]);
  }, RQ],
  sheath: [8, 24, (c, Q) => { const { R, P, H } = c, T = PXA.PAL.steel; R(0, 0, 8, H, Q[3]); R(0, 0, 1, H, Q[4]); R(7, 0, 1, H, Q[1]); for (let y = 3; y < H - 5; y += 2) P(5, y, Q[5]); R(0, 0, 8, 2, Q[4]); R(0, H - 5, 8, 5, T[2]); R(0, H - 5, 8, 1, T[4]); P(1, H - 4, T[5]); }, RQ], // a knife sheath, stitched, a steel chape
  gourd: [32, 16, (c, Q) => { const { R, P, W, H } = c; R(0, 0, W, H, Q[3]); for (let x = 0; x < W; x += 6) R(x, 3, 1, H - 5, Q[2]); R(21, 4, 2, 6, Q[4]); P(22, 5, Q[5]); R(0, 0, W, 2, Q[1]); for (let x = 0; x < W; x += 2) P(x, 1, Q[4]); R(0, H - 2, W, 2, Q[1]); }, RQ], // a water gourd, a cord tied round its neck
  apple: [32, 16, (c, Q) => { const { R, P, W, H } = c; R(0, 0, W, H, Q[3]); R(0, 0, W, 2, Q[2]); R(0, H - 4, W, 2, Q[2]); R(0, H - 2, W, 2, Q[1]); R(20, 3, 4, 3, Q[4]); P(21, 4, Q[5]); P(22, 4, Q[5]); for (let x = 2; x < W; x += 8) P(x, 8, Q[4]); }, RQ], // a golden apple: lit up left, a dimple round the stalk
  // ---- the dark rider's plate (fixed near-black palette, read by its bright edges)
  kplate: [112, 48, (c) => { // breastplate: a ridge down the middle, engraved double lines under the chest, plate seams, rivets round the neck
    const { R, P, S, W, H, F } = c, K = KN; R(0, 0, W, H, K[2]); R(F - 26, 2, 52, H - 4, K[3]); R(F - 1, 0, 2, H, K[5]); R(F + 1, 0, 1, H, K[1]); R(F - 2, 0, 1, H, K[4]);
    for (let i = 2; i < 24; i++) { const y = 18 + Math.round(6 * Math.sin(i / 24 * Math.PI)); S(i, y, K[5]); S(i, y + 1, K[0]); S(i, y + 3, K[4]); }
    for (const x of [F - 30, F + 30]) { R(x, 0, 1, H, K[0]); R(x + 1, 0, 1, H, K[4]); }
    R(0, 0, W, 1, K[5]); R(0, 1, W, 1, K[0]); for (let x = 3; x < W; x += 9) PXA.rivet(c, x, 3, K); R(0, H - 2, W, 1, K[4]); R(0, H - 1, W, 1, K[0]);
    for (const x of [F - 8, F + 6]) for (let k = 0; k < 5; k++) P(x + k, 8 + k, K[4]);
  }, RQ],
  klame: [64, 8, (c) => { const { R, W, H } = c, K = KN; R(0, 0, W, H, K[2]); R(0, 0, W, 1, K[5]); R(0, 1, W, 1, K[4]); R(0, H - 1, W, 1, K[0]); for (let x = 4; x < W; x += 10) PXA.rivet(c, x, 3, K); }, RQ],
  ktasset: [12, 28, (c) => { const { R, P, W, H } = c, K = KN; R(0, 0, W, H, K[2]); bevel(c, K, 0, 0, W, H); R(5, 2, 1, H - 4, K[4]); R(6, 2, 1, H - 4, K[1]); PXA.rivet(c, 2, 3, K); PXA.rivet(c, W - 4, 3, K); R(0, H - 3, W, 1, K[4]); for (let x = 1; x < W - 1; x += 3) P(x, 12, K[4]); }, RQ],
  kvisor: [24, 28, (c) => { // the great-helm's face: a lit centre ridge, two rows of breathing holes, a bright rim
    const { R, P, W, H } = c, K = KN; R(0, 0, W, H, K[3]); R(11, 0, 1, H, K[5]); R(12, 0, 1, H, K[1]); bevel(c, K, 0, 0, W, H);
    for (let y = 15; y < H - 3; y += 3) for (const x of [4, 7, 16, 19]) { P(x, y, K[0]); P(x + 1, y + 1, K[4]); }
    for (let k = 0; k < 4; k++) P(3 + k, 3 + k, K[4]);
  }, RQ],
  kdome: [48, 24, (c) => { const { R, P, W, H } = c, K = KN; R(0, 0, W, H, K[2]); R(0, 0, W, 3, K[3]); lames(c, K, [7, 13, 19]); for (let x = 3; x < W; x += 8) PXA.rivet(c, x, 9, K); for (let k = 0; k < 3; k++) { P(34 + k, 2 + k, K[5]); P(35 + k, 2 + k, K[4]); } R(0, H - 1, W, 1, K[0]); }, RQ],
  kgreave: [48, 32, (c) => { const { R, P, W, H, F } = c, K = KN; R(0, 0, W, H, K[2]); R(F - 6, 0, 4, H, K[3]); R(F - 1, 0, 1, H, K[5]); R(F, 0, 1, H, K[1]); R(0, 0, W, 1, K[5]); R(0, H - 1, W, 1, K[0]); for (const y of [8, 20]) { R(0, y, W, 1, K[0]); R(0, y + 1, W, 1, K[4]); } for (let x = 2; x < W; x += 8) PXA.rivet(c, x, 4, K); P(F - 4, 3, K[5]); }, RQ],
};
const pt = (kind, col) => STORY[kind] ? kitMat('st:' + kind, STORY[kind], col, STORY[kind][3]) : kt(kind, col); // a story or kit texture in one colour
const shaftT = (col) => PXA.paTile('st:shaft' + col, 8, 64, (c) => { // a pole's grain along its length (lit down one side, a knot), repeated along a long shaft
  const { R, P, H } = c, Q = PXA.ramp(col, 6); R(0, 0, 8, H, Q[3]); R(1, 0, 2, H, Q[4]); R(5, 0, 2, H, Q[2]); R(7, 0, 1, H, Q[1]);
  for (const [x, y, l] of [[3, 4, 9], [1, 22, 6], [4, 34, 12], [6, 50, 8], [2, 54, 5]]) R(x, y, 1, l, Q[2]); P(4, 28, Q[0]); P(5, 28, Q[1]); P(4, 27, Q[4]); P(3, 29, Q[2]);
});
function shaft(m, col, len) { if (PXART) m.material = PXA.tileMat(shaftT(col), 1, Math.max(1, Math.round(len * 1.2))); return m; } // len: the shaft's length in metres
const px = (kind, col, o) => PXART ? { ...o, material: pt(kind, col) } : o;
const pd = (m, kind, col, t) => { if (PXART && m) { m.material = pt(kind, col); if (t) m.rotation.y += PI; } return m; }; // t: turn a cylinder so its texture's front faces front
const _ua = new THREE.Vector3(), _ub = new THREE.Vector3(), _uc = new THREE.Vector3();
function uvBox(m, d = 1) { // planar uvs from the part's own scaled shape, u along its longest side, d texture repeats a metre: even texels on any proportions
  if (!PXART) return m;
  const s = m.scale, S = [s.x, s.y, s.z], g0 = m.geometry;
  m.geometry = PXA.paOnce('uvBox' + g0.uuid + S.join() + d, () => {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(), p = g.attributes.position, uv = new Float32Array(p.count * 2);
    g.computeBoundingBox(); const e = g.boundingBox.getSize(_uc).multiply(s).toArray(), L = e.indexOf(Math.max(...e));
    for (let i = 0; i < p.count; i += 3) {
      _ua.fromBufferAttribute(p, i).multiply(s); _ub.fromBufferAttribute(p, i + 1).multiply(s).sub(_ua); _uc.fromBufferAttribute(p, i + 2).multiply(s).sub(_ua); _ub.cross(_uc);
      const n = [Math.abs(_ub.x), Math.abs(_ub.y), Math.abs(_ub.z)], N = n.indexOf(Math.max(...n)), U = L !== N ? L : (N + 1) % 3, V = 3 - N - U;
      for (let k = i; k < i + 3; k++) { uv[k * 2] = p.getComponent(k, U) * S[U] * d; uv[k * 2 + 1] = p.getComponent(k, V) * S[V] * d; }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
  });
  const mm = m.material, t = mm?.map; if (t && t.wrapT !== THREE.RepeatWrapping) { t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; } // (only the story textures go through here)
  return m;
}
function pxSkull(g, bone, wing) { // a skull from skull() or batSkull(): bone crown and jaw (teeth on its face), a bat skull's wings as metal
  if (!PXART) return g;
  const B = '#' + new THREE.Color(bone).getHexString(), Wg = wing && '#' + new THREE.Color(wing).getHexString(), bm = pt('bone', B);
  for (const m of g.children) if (m.isMesh) {
    const col = '#' + m.material.color.getHexString();
    if (col === B) m.material = m.geometry.parameters?.radius ? bm : [bm, bm, bm, bm, pt('teeth', B), bm];
    else if (col === Wg) m.material = pt('gold', Wg);
  }
  return g;
}
function reDress(r, kinds) { // pixel art: the rig's own plain parts of a listed colour wear a texture by shape, kinds[hex] = [cylinder, ball, box]; a straight cylinder is turned so the front faces front
  if (!PXART) return; const K = {}; for (const h in kinds) K['#' + new THREE.Color(h).getHexString()] = kinds[h];
  r.root.traverse((m) => {
    const c = m.isMesh && !m.userData.hd && m.material?.color && '#' + m.material.color.getHexString(), k = c && K[c], i = k ? ['CylinderGeometry', 'IcosahedronGeometry', 'BoxGeometry'].indexOf(m.geometry.type) : -1;
    if (i < 0 || !k[i]) return; m.material = pt(k[i], c); if (!i && !m.rotation.x && !m.rotation.z) m.rotation.y += PI;
  });
}
export { pt as storyTex, uvBox, pxSkull, shaft, reDress }; // the story makers in models.js (Rain, Philon, the priestess, the rider, shades, statues) wear these too
export function makeMedusa() {
  const SK = '#97b884', DRESS = '#dccfa8', DRESS2 = '#c4b48a', MANTLE = '#5a3a24', BRONZE = '#b77b38';
  const r = humanoid({ skin: SK, top: DRESS, bottom: DRESS, legs: SK, boots: '#6a4a2c', sleeve: null, eyes: '#d9b51c', white: '#efe6b4', liner: '#22331c', lips: '#3f5a36', brow: '#2c4426', browTilt: .24 });
  eyeSlit(r); lashes(r, '#1a2614');
  // scalp + snake hair
  const sc = ball(r.head, .215, '#3c6e30', 0, .29, -.05, 1, px('scalp', '#3c6e30')); sc.scale.set(1.04, .82, 1.06);
  ball(r.head, .17, '#3c6e30', 0, .2, -.1, 1, px('scalp', '#3c6e30')).scale.set(1.08, 1, 1);
  r.snakes = [];
  const rows = [[68, [0, 60, 120, 180, 240, 300]], [28, [42, 82, 122, 162, 202, 242, 282, 318]], [84, [150]]];
  let n = 0;
  for (const [el, azs] of rows) for (const azd of azs) {
    const az = azd * PI / 180, e = el * PI / 180, i = n++;
    const nrm = new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e));
    const sp = pivot(r.head, nrm.x * .19, .27 + nrm.y * .17, -.04 + nrm.z * .19);
    const out = new THREE.Vector3(Math.sin(az), el > 60 ? .9 : .35, Math.cos(az)).normalize(); // radiate outward like a mane
    sp.quaternion.setFromUnitVectors(_Y, out);
    const segs = [], col = ['#4f8a3c', '#3d7a30', '#5f9c46'][i % 3], belly = '#9cc46a';
    let par = sp;
    const L = el < 40 ? 4 : 3;
    for (let j = 0; j < L; j++) {
      const sg = j === 0 ? pivot(sp, 0, 0, 0) : pivot(par, 0, .09, 0);
      tcyl(sg, .032 - j * .003, .037 - j * .003, .1, j % 2 ? col : belly, 0, .05, 0, 5, px('scales', j % 2 ? col : belly));
      segs.push(sg); par = sg;
    }
    const hp = pivot(par, 0, .095, 0); segs.push(hp);
    const hd = ball(hp, .046, col, 0, .035, 0, PXART ? 1 : 0, px('scales', col)); hd.scale.set(1.1, 1.5, .85);
    for (const sx of [-1, 1]) box(hp, .014, .014, .012, '#f2d23a', sx * .03, .045, .02, { basic: true, noShadow: true });
    const tg = box(hp, .008, .06, .006, '#d0303a', 0, .09, .01, { noShadow: true });
    const curl = el < 40 ? -1 : 1, s1 = i % 2 ? 1 : -1;
    const bx = el < 40 ? [.5, .55, -.75, -.8, -.7] : [.2, .6, -.7, -.8, -.6];
    const bz = [0, .5 * s1, -.45 * s1, .35 * s1, 0].map((v) => v * curl);
    r.snakes.push({ segs, bx, bz, ph: i * 1.7, sp: 1.6 + (i % 4) * .25, amp: .18, tongue: tg });
  }
  // cream chiton with drapery folds, dark brown mantle, bronze brooch
  robe(r, DRESS, { top: .22, bot: .37, y1: -.82, folds: DRESS2, n: 8 }); if (PXART) dressChest(r, DRESS, 'bodice');
  cape(r, MANTLE, 1.05, .46, { flare: .1 });
  const fr = box(r.torso, .12, .62, .04, MANTLE, -.2, .3, .15, px('fall', MANTLE)); fr.rotation.set(-.08, 0, .22); // mantle end down the front
  tcyl(r.torso, .1, .07, .12, MANTLE, -.27, .6, .02, 6, px('drape', MANTLE));
  for (const sx of [-1, 1]) { const tr = box(r.torso, .03, .04, .3, '#7a5432', sx * .26, .66, -.02, px('strap', '#7a5432', NSH)); tr.rotation.z = sx * .4; }
  const br = tcyl(r.torso, .05, .05, .025, BRONZE, .2, .62, .12, PXART ? 12 : 8, PXART ? { material: [pt('gold', BRONZE), pt('brooch', BRONZE), pt('brooch', BRONZE)] } : undefined); br.rotation.x = PI / 2 - .3; // a coiled snake
  // bronze bat-skull belt
  belt(r, '#6b4428', .12, null, .08);
  const bs = pxSkull(batSkull(r.torso, 1.2, '#e0dcd0', BRONZE), '#e0dcd0', BRONZE); bs.position.set(0, .13, .18);
  bracer(r, '#9a6230', 'R', .13);
  tcyl(r.elbowL, .062, .062, .04, BRONZE, 0, -.22, 0, 6, px('gold', BRONZE));
  // round shield slung at the right hip, bat-skull emblem
  const sh = roundShield(r.torso, .25, '#4a2e1c', '#a8743a', { out: 1, boss: null });
  sh.position.set(.34, -.14, .04); sh.rotation.set(0, -.4, -.12);
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; ball(sh, .018, '#c8924a', .03, Math.sin(a) * .21, Math.cos(a) * .21, 0, px('gem', '#c8924a', NSH)); }
  const em = pxSkull(batSkull(sh, 2, '#e8e4dc', '#9aa0aa'), '#e8e4dc', '#9aa0aa'); em.position.set(.035, 0, 0); em.rotation.y = PI / 2;
  r.shield = sh;
  // the map, held open with both hands
  const map = new THREE.Group(); r.torso.add(map); map.position.set(.05, .3, .38); map.rotation.set(-.55, -.18, .06);
  const pa = PXART && pt('parch', '#dcbc80');
  box(map, .46, .32, .012, '#dcbc80', 0, 0, 0, PXART ? { material: [pa, pa, pa, pa, pt('map', '#dcbc80'), pa] } : undefined); // pixel art: the islands, route and cross are painted on
  if (!PXART) {
    for (const [x, y, w, h, c] of [[-.12, .06, .1, .07, '#a8743e'], [.08, -.05, .13, .06, '#9a6634'], [.13, .09, .06, .05, '#b98446'], [-.05, -.09, .07, .04, '#a8743e'], [-.18, -.06, .05, .08, '#b98446']])
      box(map, w, h, .01, c, x, y, .008, { noShadow: true });
    box(map, .1, .012, .01, '#8a3020', .02, .02, .012, { noShadow: true }).rotation.z = .6;
    box(map, .1, .012, .01, '#8a3020', .02, .02, .012, { noShadow: true }).rotation.z = -.6;
  }
  for (const [x, y] of [[-.235, .1], [.235, -.08], [.1, .165], [-.08, -.165]]) box(map, .05, .05, .012, '#dcbc80', x, y, 0, px('parch', '#dcbc80')).rotation.z = .7;
  hold(r, 'L', map, -.22, -.05, -.02); hold(r, 'R', map, .22, -.03, -.02);
  r.map = map;
  return done(r);
}

export function makeNamelessKing() {
  const C = '#25252d', C2 = '#30303a', C3 = '#1b1b22';
  const r = humanoid({ skin: '#3d3d46', top: C, bottom: C, boots: C3, sleeve: C2, faceless: true, scale: 1.14 });
  hood(r, C2);
  for (const sx of [-1, 1]) box(r.head, .05, .022, .02, '#d8c27a', sx * .06, .205, .19, { basic: true, noShadow: true });
  robe(r, C, { top: .23, bot: .46, y1: -.86, folds: C3, n: 9 });
  const cp = turn(tcyl(r.torso, .3, .44, .52, C2, 0, .4, -.02, PXART ? 14 : 10, px('regal', C2))); cp.scale.z = .8; // capelet over the shoulders
  for (const E of [r.elbowL, r.elbowR]) turn(tcyl(E, .075, .13, .24, C2, 0, -.15, 0, 7, px('wideSleeve', C2))); // wide sleeves
  cape(r, C3, 1.3, .54, { flare: .14 });
  // the cracked stone tablet
  const tab = new THREE.Group(); r.torso.add(tab); tab.position.set(.03, .26, .4); tab.rotation.set(-.32, .22, -.16);
  uvBox(box(tab, .36, .46, .07, '#8f979e', 0, 0, 0, px('stone', '#8f979e')), 2.5);
  const tf = box(tab, .32, .42, .02, '#b4bcc2', 0, 0, .036); if (PXART) { const st = pt('stone', '#b4bcc2'); tf.material = [st, st, st, st, pt('tablet', '#b4bcc2'), st]; } // glyphs and cracks painted on its face
  if (!PXART) for (const [x, y, l, a] of [[-.05, .08, .2, .9], [.06, -.02, .24, -.6], [-.02, -.13, .18, .3], [.1, .13, .12, -1.2], [-.11, -.05, .1, 1.6]])
    box(tab, l, .014, .012, '#4c535c', x, y, .048, { noShadow: true }).rotation.z = a;
  hold(r, 'R', tab, -.17, .1, .0); hold(r, 'L', tab, .16, -.16, .0);
  r.tablet = tab; r.lean = .04;
  return done(r);
}

// Hades, 40% bigger than he was (owner's call): spiked iron pauldrons, a high collar, a crown of spikes burning with
// soul-fire, smoke at his hem, and a bident far taller than he is. Two of him: the lord on the skull throne in his hall
// (seated: true; pose 'throne', the bident stuck in the floor at his right; rise() stands him up and puts it in his
// hand, sit() seats him again), and the one who fights in the trial (no pose): bident at his side, heaved overhead in
// the wind-up, slammed down into the floor (see hadesTick; story.js passes the Enemy state in anim.mode).
// HADES_SEAT is what the throne in portals.js is built to: rig units from his root, before its scale.
export const HADES_SEAT = { scale: 2.1, hip: .6, hz: -.04, seat: .4, armX: .5, armY: .68, armZ: [-.62, .26], plant: [-.7, 1.05, .5], step: 1 }; // v31 (Roy: his legs were inside the seat): the seat .1 shallower and him .08 further forward on it (hz), so his knees come out past its front edge and his shins drop straight down in front of it // hz: his hip's z, seated // round 18: hip up and the seat shallower, so the thighs rest on it and the shins clear its front edge // step: he stands up this far in front of the seat
export function makeHades(o = {}) {
  const SK = '#676b77', BLK = '#1e1d24', BLK2 = '#2e2d35', IRON = '#2c2b33', IRON2 = '#56556a', LINE = '#3a2450', SOUL = '#b07aff';
  const CH = '#1b1a21', CH2 = '#2a2832', HIM = '#4a2258', HIM2 = '#6a3680', BRZ = '#b08a4a'; // round 23: a black chiton, a deep grave-purple himation, dull bronze borders
  const r = humanoid({ skin: SK, top: CH, bottom: CH, legs: SK, boots: '#141318', sleeve: null, eyes: '#ff3a30', white: '#2a1a1c', brow: '#0e0e12', browTilt: .36, lips: '#2a2a30', scale: HADES_SEAT.scale });
  for (const e of r.eyes) box(e, .05, .03, .012, '#ff4a3a', 0, 0, .012, { basic: true, noShadow: true });
  // round 23 (Roy: "a man's dress for Hades, don't be shy, and a little more muscular, he isn't threatening enough"): the
  // chiton covers his chest, pinned on the left shoulder like a fighter's exomis, so the right shoulder, pec and the bident
  // arm stay bare and heavy; thick arms, a bull neck and traps; the himation over the left shoulder and wound round his hips
  if (PXART) dressChest(r, CH, 'bodice');
  for (const A of [r.armL, r.armR]) A.scale.set(1.2, 1, 1.2); // thick arms (x and z only: the reach the throne and his blows are posed for is the same)
  for (const E of [r.elbowL, r.elbowR]) E.scale.set(1.12, 1, 1.12);
  const pR = ball(r.torso, .135, SK, .11, .47, .1, 1, kx('pec', SK)); pR.scale.set(1.1, .82, .62); // the bare right pec, the chiton's edge across under it
  const dR = ball(r.armR, .125, SK, .02, -.02, 0, 1, kx('pec', SK)); dR.scale.set(1, 1.05, 1.05); // a big deltoid on the bare shoulder
  const dL = ball(r.armL, .125, CH, -.02, -.01, 0, 1, kx('ball', CH)); dL.scale.set(1.05, .9, 1.05); // the left one under the pinned cloth
  for (const A of [r.armL, r.armR]) { const b = ball(A, .085, SK, 0, -.13, .035, 1, kx('ball', SK)); b.scale.set(1, 1.5, .95); } // biceps
  for (const sx of [-1, 1]) { const t = ball(r.torso, .1, sx > 0 ? SK : CH, sx * .13, .6, -.06, 1, kx('ball', sx > 0 ? SK : CH)); t.scale.set(1.25, .62, 1); } // traps: the neck sits down in them
  turn(tcyl(r.torso, .085, .1, .1, SK, 0, .64, 0, 7, kx('ball', SK))); // a bull neck
  ball(r.torso, .045, BRZ, -.2, .62, .1, 0, kx('gem', BRZ, NSH)); // the pin on the left shoulder
  hairCap(r, '#121116', { h: .78 }); longHair(r, '#121116', .7, 1.1, { front: false });
  beard(r, '#121116', .32, .92, { mouth: '#1a1418' });
  // horned iron circlet, and behind it a crown of spikes with soul-fire on their points
  const hb = turn(tcyl(r.head, .215, .22, .07, IRON, 0, .33, -.02, 10, px('circlet', IRON))); hb.scale.z = 1.02;
  box(r.head, .06, .08, .03, '#8a8c96', 0, .34, .2, px('plate', '#8a8c96', NSH));
  for (const sx of [-1, 1]) {
    let p = pivot(r.head, sx * .17, .38, .02); p.rotation.set(-.1, 0, -sx * 1.1);
    for (let i = 0; i < 4; i++) {
      turn(tcyl(p, .045 - i * .01, .06 - i * .01, .13, i < 2 ? '#3a3840' : '#8a8690', 0, .06, 0, 5, px('horn', i < 2 ? '#3a3840' : '#8a8690')));
      p = pivot(p, 0, .12, 0); p.rotation.set(-.15, 0, sx * (.55 + i * .1));
    }
  }
  r.fires = [];
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * .5, h = i === 2 ? .34 : i % 2 ? .26 : .2, p = pivot(r.head, Math.sin(a) * .19, .35, -.03 - Math.cos(a) * .19);
    p.rotation.set(-.25 * Math.cos(a), 0, -.3 * Math.sin(a));
    cone(p, .04, h, IRON2, 0, h / 2, 0, 4, px('spike', IRON2));
    r.fires.push(cone(p, .05, .17, SOUL, 0, h + .07, 0, 4, { basic: true, noShadow: true }));
  }
  // spiked iron pauldrons, a skull riveted to the left one
  for (const [A, sx] of [[r.armL, -1], [r.armR, 1]]) {
    const pd = pivot(A, 0, .03, 0);
    ball(pd, .15, IRON, 0, .02, 0, 1, px('ironDome', IRON)).scale.set(1.2, .72, 1.12);
    box(pd, .27, .05, .27, IRON2, sx * .03, -.06, 0, px('iron', IRON2)).rotation.z = sx * .3;
    box(pd, .24, .05, .25, IRON, sx * .05, -.12, 0, px('iron', IRON)).rotation.z = sx * .42;
    for (const [z, h] of [[-.07, .22], [.05, .16]]) cone(pd, .04, h, IRON2, sx * .06, .08 + h / 2, z, 4, px('spike', IRON2)).rotation.z = -sx * .45;
  }
  const ps = pxSkull(skull(r.armL, 1.5, '#d6d0c0'), '#d6d0c0'); ps.position.set(-.14, -.04, 0); ps.rotation.y = -PI / 2;
  // a high collar fanned up behind his head, lined in purple
  for (let i = 0; i < 7; i++) {
    const p = pivot(r.torso, 0, .64, -.02); p.rotation.y = (i - 3) * .36;
    box(p, .12, .36, .035, i % 2 ? BLK2 : BLK, 0, .14, -.2, px('iron', i % 2 ? BLK2 : BLK)).rotation.x = -.4;
    box(p, .1, .3, .01, LINE, 0, .13, -.18, px('fall', LINE, NSH)).rotation.x = -.4;
  }
  // black robes (their own group: seated, the lap drape takes over), sash, a long cape lined in purple; skull belt
  r.robeG = pivot(r.torso, 0, 0, 0);
  const rg = Object.assign(Object.create(r), { torso: r.robeG, rig: r }); // (the chiton's skirt and the wrap go in robeG: seated, the lap drape takes over)
  chiton(rg, CH, { y1: -.88, bot: .42, top: .22, folds: CH2, n: 9, trim: BRZ, key: HIM2, rig: r }); // the long chiton, to his ankles
  const hw = tcyl(r.robeG, .29, .47, .58, HIM, 0, -.5, 0, 12, kx('wrap', HIM)); hw.scale.z = .9; hw.rotation.z = .12; clothFit(r, hw); // the himation wound round his hips and thighs, over the chiton
  const ht = tcyl(r.robeG, .465, .472, .05, BRZ, 0, -.77, 0, 12, kx('hem', BRZ, NSH)); ht.scale.z = .9; ht.rotation.z = .12; clothFit(r, ht, hw);
  // seated, the robes are one drape over his lap (v31, Roy: "a robe that sits well over the chair, his style 1 to 1, detailed
  // like V's, no clipping"). In the hip's frame (the seat's top is .2 under the hip, its front edge .3 ahead of it, his
  // knees .42 ahead and .14 down): the himation laid over both thighs and rolled over the knees, a fold of it slanting
  // across his lap, and its fall in front of his shins, all of it in front of the seat's edge
  r.lap = pivot(r.hip, 0, 0, 0); r.lap.visible = false;
  { const L = r.lap, lw = .56;
    const top = box(L, lw, .07, .5, HIM, 0, .055, .19, px('drape', HIM)); top.rotation.x = .16; // over the thighs, sloping down to the knees
    for (const sx of [-1, 1]) { const e = tcyl(L, .045, .05, .5, HIM2, sx * lw / 2, .02, .19, 6, kx('wrap', HIM2)); e.rotation.x = PI / 2 + .16; } // its rolled outer edges
    const knee = tcyl(L, .075, .075, lw + .04, HIM, 0, -.11, .43, 8, kx('wrap', HIM)); knee.rotation.z = PI / 2; // rolled over the knees
    const fold = box(L, .2, .05, .56, HIM2, -.05, .1, .17, px('drape', HIM2)); fold.rotation.set(.16, .55, 0); // a fold slanting across the lap
    box(L, .04, .045, .5, BRZ, .045, .125, .16, px('ribbon', BRZ, NSH)).rotation.set(.16, .55, 0); // its bronze border
    // below the knees the himation falls on in deep pleats to mid-shin, edged in bronze, and under it the black chiton to a
    // bronze hem just over his boots: cloth hanging clear of the seat's front, never the seat's own black
    const fall = box(L, .58, .25, .05, HIM, 0, -.255, .545, px('fall', HIM)); fall.rotation.x = -.05;
    for (let i = 0; i < 6; i++) { const x = -.235 + i * .094, pl = box(L, .034, .24 - (i % 2) * .03, .03, HIM2, x, -.25 - (i % 2) * .015, .575, px('fall', HIM2)); pl.rotation.set(-.05, 0, x * .25); } // the pleats, fanning out a touch
    box(L, .6, .035, .07, BRZ, 0, -.38, .55, px('ribbon', BRZ, NSH)); // its bronze border
    box(L, .56, .13, .045, CH, 0, -.45, .535, px('fall', CH));
    for (let i = 0; i < 5; i++) box(L, .028, .12, .02, CH2, -.2 + i * .1, -.45, .56, px('fall', CH2)); // the chiton's folds
    box(L, .6, .04, .075, BRZ, 0, -.515, .535, px('ribbon', BRZ, NSH)); // its hem
    for (const sx of [-1, 1]) { const sd = box(L, .05, .26, .24, HIM, sx * .3, -.25, .43, px('fall', HIM)); sd.rotation.z = -sx * .08; } // the drape's sides, wrapping back to the seat's edge
  }
  drape(r, HIM, BRZ, .72, .26, .36); // and its upper end thrown over the left shoulder, across the chest, down the back
  cape(r, BLK2, 1.5, .64, { flare: .1, lining: LINE, liningOpts: px('cape', LINE, NSH) }); // (round 33: lined length by length, so the lining bends with it)
  belt(r, '#26252b', .12, null, .1);
  const bs = pxSkull(batSkull(r.torso, 1.4, '#d6d8de', '#9da2ac'), '#d6d8de', '#9da2ac'); bs.position.set(0, .13, .185);
  for (const sx of [-1, 1]) pxSkull(skull(r.torso, 1.1, '#cfc8b8'), '#cfc8b8').position.set(sx * .17, .03, .19);
  bracer(r, IRON, 'LR');
  // smoke curling up round his feet
  r.smoke = [];
  for (let i = 0; i < 9; i++) { const s = ball(r.root, .15, i % 3 ? '#1a1222' : '#3a2450', 0, 0, 0, 0, { basic: true, opacity: .5, noShadow: true }); s.userData.a = i / 9 * PI * 2; s.userData.ph = (i * .37) % 1; r.smoke.push(s); }
  // the bident: in a socket in his right hand that turns its shaft (+y) onto the hand's +z, where aimHand points
  r.grip = pivot(r.handR, 0, 0, .02); r.grip.rotation.x = PI / 2;
  r.bident = hadesBident(); r.tip = r.bident.userData.tip; r.grip.add(r.bident);
  r.frameWhole = true; // (talk shots: twice her size, but framed whole beside her, not by his face like a giant)
  r.bident.userData.noFrame = true; // (a prop, not his body: planted by the throne it would make him a giant to the talk camera)
  r.pose = null; r.poseT = 0; r.t = 0;
  r.rise = () => { r.pose = 'rise'; r.poseT = 0; };
  r.sit = () => { r.pose = 'throne'; r.held = false; r.root.add(r.bident); r.bident.position.fromArray(HADES_SEAT.plant); r.bident.rotation.set(.05, 0, .07); r.bident.scale.setScalar(1); };
  r.tick = hadesTick;
  if (o.seated) r.sit();
  done(r);
  if (r.hd?.reMouth) { r.hd.lo = { lips: '#a8707e', fem: false }; r.hd.reMouth(); } // a lit lip line, so his mouth reads in the black beard
  return r;
}
function hadesBident() { // shaft along +y with the grip at the origin: 1.2 below the hand, 2.2 above it to the fork's points
  const g = new THREE.Group(), IR = '#2c2b33', IR2 = '#5c5b6a', GL = '#c9a4ff';
  shaft(tcyl(g, .045, .055, 2.55, '#1e191c', 0, .075, 0, 6), '#2a2226', 2.55);
  for (const y of [-1.1, -.45, .3, .95]) tcyl(g, .062, .062, .08, IR2, 0, y, 0, 6, px('gold', IR2));
  cone(g, .06, .2, IR2, 0, -1.3, 0, 4, px('spike', IR2)).rotation.x = PI;
  // the fork: a collar, a broad yoke, two long barbed prongs, a skull where they part, soul-light along their edges
  tcyl(g, .07, .1, .18, IR, 0, 1.42, 0, 6, px('gold', IR));
  uvBox(box(g, .64, .1, .1, IR, 0, 1.53, 0, px('iron', IR)), 2.5);
  for (const sx of [-1, 1]) {
    box(g, .14, .14, .12, IR2, sx * .31, 1.53, 0, px('iron', IR2)).rotation.z = sx * .5;
    let p = pivot(g, sx * .3, 1.57, 0); p.rotation.z = sx * .06;
    for (let i = 0; i < 3; i++) { box(p, .075 - i * .01, .17, .075 - i * .01, IR, 0, .085, 0, px('iron', IR)); p = pivot(p, 0, .16, 0); p.rotation.z = -sx * .07; }
    cone(p, .07, .24, IR2, 0, .11, 0, 4, px('spike', IR2));
    cone(p, .035, .16, IR2, -sx * .06, -.08, 0, 4, px('spike', IR2)).rotation.z = sx * 2.5; // barb
    box(g, .025, .46, .025, GL, sx * .25, 1.82, .045, { basic: true, noShadow: true });
  }
  pxSkull(skull(g, 2.2, '#d6d0c0'), '#d6d0c0').position.set(0, 1.66, .03);
  g.userData.tip = pivot(g, 0, 2.15, 0);
  return g;
}
const _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3(), _h3 = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hpole = new THREE.Vector3(-.8, -.8, .3);
const sm1 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
// a point in his root's frame (rig units, before the mirror) as the torso sees it
function rootToTorso(r, v) { v.x = -v.x; v.sub(r.body.position).sub(r.hip.position); return v.applyQuaternion(_hq.copy(r.torso.quaternion).invert()); }
// seated (u 1) to standing (u 0); chin 1: slouched toward the left armrest, his jaw on his left fist. lx, ly: extra lean
function hadesBody(r, u, chin, lx = 0, ly = 0) {
  const H = HADES_SEAT, hy = .9 + (H.hip - .9) * u, hz = H.hz * u, c = chin * u;
  r.body.position.set(0, 0, H.step * (1 - u)); r.hip.position.set(0, hy, hz); r.hip.rotation.set(0, 0, 0);
  const fy = .1 - (hy - .02);
  legIK(r, 'L', fy, .5 * u - hz, -.06 - .1 * u, 1); legIK(r, 'R', fy, .42 * u - hz, .06 + .1 * u, 1); // (seated: shins straight down in front of the seat, under his robe)
  r.torso.rotation.set(.04 + .24 * c + lx, .12 * c + ly, .26 * c);
  r.head.rotation.z = .14 * c; r.head.rotation.x = .04 + .1 * c;
  return c;
}
function hadesSeat(r, u, chin, lx, ly) {
  const H = HADES_SEAT, c = hadesBody(r, u, chin, lx, ly);
  // the right hand rests on its armrest; the left comes off the other one up under his jaw
  armIK(r, 'R', rootToTorso(r, _h1.set(-H.armX, H.armY + .06, .26)), 1);
  rootToTorso(r, _h2.set(H.armX, H.armY + .06, .26));
  if (c > 0) { r.head.updateMatrix(); _h3.set(-.05, 0, .28).applyMatrix4(r.head.matrix); _h2.lerp(_h3, c); }
  armIK(r, 'L', _h2, 1, c > .5 ? _hpole : undefined);
}
// standing with the bident: at his side (idle), overhead (wind-up), slammed down into the floor (attack)
const HOLD = { idle: [.3, .2, .14], wind: [.1, 1.0, 0], slam: [.06, .2, .6] };
function hadesHold(r, st, k = 1, lx = 0, ly = 0) {
  const T = r.torso, mode = st.mode, melee = !mode || mode === 'windup' || mode === 'attack';
  let w = 0, a = 0, back = 0;
  if (melee && st.windup >= 0) { if (!(r.wPrev >= 0) || st.windup > r.wPrev) r.wMax = Math.max(.05, st.windup); w = sm1(1 - st.windup / r.wMax); }
  r.wPrev = melee && st.windup >= 0 ? st.windup : -1;
  if (melee && st.attackT >= 0) { a = sm1(st.attackT / .38); back = sm1((st.attackT - .7) / .3); }
  const idle = HOLD.idle, A = a > 0 ? HOLD.wind : idle, B = a > 0 ? HOLD.slam : HOLD.wind, f = a > 0 ? a : w;
  _h1.set(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f);
  if (back > 0) _h1.lerp(_h2.fromArray(idle), back);
  // the shaft's angle from straight up, toward his front: up at rest, back over his head, then down past level
  let phi = a > 0 ? -1.25 + 2.85 * a : .1 - 1.35 * w; if (back > 0) phi += (.1 - phi) * back; // (ends with the prongs in the floor)
  const two = a > 0 ? 1 - back : w; let pitch = a > 0 ? -.2 + .5 * a : .04 - .24 * w; pitch += (.04 - pitch) * back;
  T.rotation.set(pitch + lx, ly, 0);
  if (two > 0 || a > 0) { // a planted stance under the blow
    const drop = (.04 * w + .2 * a) * (1 - back), hy = .9 - drop; r.hip.position.y = hy;
    legIK(r, 'L', .1 - (hy - .02), .34 * a * (1 - back), -.1, 1); legIK(r, 'R', .1 - (hy - .02), -.26 * a * (1 - back), .1, 1);
  }
  _h3.set(0, Math.cos(phi), Math.sin(phi));
  armIK(r, 'R', _h1, k); aimHand(r, 'R', _h3, k);
  if (two > .02) armIK(r, 'L', _h2.copy(_h1).addScaledVector(_h3, -.42), Math.min(1, two * 2) * k);
  else if (mode === 'aim' || mode === 'loose') armIK(r, 'L', _h2.set(-.16, .5, .52), k); // a wisp flung from the open hand
  else armIK(r, 'L', _h2.set(-.33, -.06, .1 + (st.moving ? Math.sin(r.phase) * .12 : 0)), k);
}
function hadesTick(r, dt, st) {
  const t = r.t += dt;
  r.fires.forEach((f, i) => f.scale.set(1, .8 + Math.sin(t * 13 + i * 2.1) * .2 + Math.sin(t * 29 + i) * .1, 1));
  for (const s of r.smoke) { const k = (t * .3 + s.userData.ph) % 1, a = s.userData.a + t * .25; s.position.set(Math.sin(a) * (.36 + k * .3), .04 + k * .75, Math.cos(a) * (.3 + k * .3)); s.scale.setScalar(Math.sin(PI * k) * 1.3 + .05); }
  const P = r.pose, H = HADES_SEAT;
  if (P === 'throne') { r.lap.visible = true; r.robeG.visible = false; hadesSeat(r, 1, 1); return; }
  if (P === 'rise') {
    // lift his chin, push up off the armrests, turn and reach for the bident, pull it out of the floor
    const q = r.poseT = Math.min(1, r.poseT + dt / 2.6), chin = 1 - sm1(q / .14), up = sm1((q - .12) / .3), u = 1 - up;
    const reach = sm1((q - .38) / .2) * (1 - sm1((q - .66) / .22)), lx = .4 * Math.sin(PI * up) + .3 * reach, ly = -.45 * reach;
    r.lap.visible = u > .5; r.robeG.visible = !r.lap.visible;
    if (q < .62) {
      hadesSeat(r, u, chin, lx, ly);
      const g = sm1((q - .38) / .2);
      if (g > 0) armIK(r, 'R', rootToTorso(r, _h1.set(-H.armX, H.armY + .06, .26)).lerp(rootToTorso(r, _h2.fromArray(H.plant)), g), 1);
      if (up > .7) armIK(r, 'L', _h2.set(-.33, -.06, .1), sm1((up - .7) / .3));
      return;
    }
    if (!r.held) { r.held = true; r.root.updateMatrixWorld(true); r.grip.attach(r.bident); r.bident.scale.setScalar(1); }
    const e = 1 - Math.pow(.0005, dt); r.bident.position.multiplyScalar(1 - e); r.bident.quaternion.slerp(_hq.identity(), e);
    hadesBody(r, 0, 0); hadesHold(r, {}, sm1((q - .62) / .3), lx, ly);
    if (q >= 1) r.pose = 'stand';
    return;
  }
  r.lap.visible = false; r.robeG.visible = true;
  if (P === 'stand') r.body.position.z = H.step; // risen off the throne: he stays where he stood up (animateRig eases the body home)
  hadesHold(r, st);
}

// ---------- Cerberus ----------
// Built along +z with his paws on y=0 (portals.js scales him up). body > fore (deep chest, front legs, the three necks)
// and hind (croup, haunches, hind legs, serpent tail), so the spine twists in the gait.
// Legs are joint chains: shoulder/elbow/wrist or hip/stifle/hock, each ending in a paw pivot kept flat on the ground.
const CB = { fur: '#29252f', fur2: '#3a3543', dark: '#17151c', iron: '#5c5c66', spike: '#9a9aa4', bone: '#ece4d0', gum: '#7a1f2a',
  maw: '#7a1810', tan: '#5e3022', eye: '#ff4a22', eye2: '#ffd25a', sn: '#2d3b2c', sn2: '#56683a', snEye: '#d8ff5a' };
const NOSH = { noShadow: true }, GLOW = { basic: true, noShadow: true };
function cbPaw(parent, w = 1) {
  const p = pivot(parent, 0, 0, 0);
  box(p, .15 * w, .07, .2 * w, CB.tan, 0, -.035, .035);
  for (const sx of [-1, -.34, .34, 1]) {
    ball(p, .036 * w, CB.fur2, sx * .052 * w, -.03, .125 * w, 0);
    cone(p, .014, .055, CB.bone, sx * .052 * w, -.045, .165 * w, 4, NOSH).rotation.x = PI / 2;
  }
  return p;
}
function cbLeg(parent, x, y, z, front) {
  const F = CB.fur, [u, l, m] = front ? [.36, .38, .12] : [.42, .4, .26];
  const a = pivot(parent, x, y, z);
  if (front) ball(a, .2, F, 0, -.05, .02, 1).scale.set(.62, 1.15, .95); // shoulder
  else ball(a, .27, F, 0, -.1, .03, 1).scale.set(.62, 1.1, 1.05); // haunch
  tcyl(a, front ? .13 : .14, front ? .1 : .105, u, F, 0, -u / 2, 0, 7);
  const b = pivot(a, 0, -u, 0);
  ball(b, .08, F, 0, 0, front ? -.035 : .025, 0); // the elbow points back, the stifle forward
  tcyl(b, front ? .1 : .105, .07, l, F, 0, -l / 2, 0, 6);
  if (front) cone(b, .04, .16, CB.fur2, 0, -.14, -.07, 4).rotation.x = -2.3; // feathered fur behind the forearm
  else ball(b, .09, F, 0, -.1, -.04, 0).scale.set(.8, 1.4, .9); // calf
  const c = pivot(b, 0, -l, 0);
  if (!front) ball(c, .055, CB.fur2, 0, 0, -.03, 0); // hock point
  tcyl(c, .066, .072, m, F, 0, -m / 2, 0, 6);
  const d = cbPaw(pivot(c, 0, -m, 0), front ? 1.2 : 1.1);
  return { a, b, c, d, front, rest: front ? [.5, -.6, .1] : [-.75, 1.45, -.75], lie: front ? [-1.05, -.4, -.05] : [-1, 2.3, -2.75] };
}
// one dog head on the end of its neck, facing +z. o: { ears (rest tilt), brow (scowl), torn, scar }
function cbHead(hp, s, o) {
  const g = pivot(hp, 0, 0, 0); g.scale.setScalar(s);
  const F = CB.fur, F2 = CB.fur2;
  ball(g, .18, F, 0, .02, -.01, 1).scale.set(1.05, .88, 1.1); // skull
  for (const sx of [-1, 1]) ball(g, .1, CB.tan, sx * .1, -.06, .07, 0).scale.set(.85, .9, 1.25); // jowls
  box(g, .15, .1, .27, F, 0, -.035, .25); // muzzle
  box(g, .1, .035, .25, F2, 0, .02, .23).rotation.x = .1; // bridge of the nose
  box(g, .09, .056, .05, '#0b0a0d', 0, -.005, .39);
  box(g, .145, .03, .22, CB.gum, 0, -.09, .25, NOSH); // bared gums
  box(g, .12, .02, .24, CB.maw, 0, -.1, .2, GLOW); // the furnace inside
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) box(g, .018, .028, .018, CB.bone, sx * .062, -.11, .19 + k * .05, NOSH);
    cone(g, .022, .1, CB.bone, sx * .058, -.13, .345, 4, NOSH).rotation.x = PI; // fangs
    box(g, .1, .04, .06, CB.dark, sx * .075, .095, .16).rotation.z = sx * o.brow;
    box(g, .065, .035, .02, CB.eye, sx * .08, .048, .175, GLOW).rotation.z = sx * .25;
    box(g, .026, .02, .01, CB.eye2, sx * .082, .049, .187, GLOW);
  }
  const jaw = pivot(g, 0, -.1, .06);
  box(jaw, .13, .05, .3, CB.tan, 0, -.035, .15);
  box(jaw, .118, .02, .27, CB.gum, 0, -.005, .155, NOSH);
  box(jaw, .07, .016, .21, '#a83444', 0, .004, .12, NOSH); // tongue
  for (const sx of [-1, 1]) cone(jaw, .018, .08, CB.bone, sx * .048, .03, .27, 4, NOSH);
  const ears = [];
  for (const sx of [-1, 1]) {
    const ep = pivot(g, sx * .1, .13, -.04); ep.rotation.set(o.ears, 0, -sx * .32); ep.userData.x0 = o.ears; ears.push(ep);
    const e = cone(ep, .07, .25, F, 0, .11, 0, 4); e.scale.z = .55;
    const ei = cone(ep, .045, .17, '#4a1c24', 0, .09, .022, 4, NOSH); ei.scale.z = .4;
    if (o.torn && sx > 0) { e.scale.y = ei.scale.y = .62; e.position.y = .07; ei.position.y = .06; }
  }
  for (let k = 0; k < 3; k++) cone(g, .035, .14, CB.dark, (k - 1) * .05, .14 - k * .01, -.1 - k * .03, 4).rotation.x = -1.2; // crest
  if (o.scar) box(g, .018, .16, .012, '#6a4a54', .085, .07, .18, NOSH).rotation.z = .35;
  return { jaw, ears };
}

export function makeCerberus() {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0), F = CB.fur, F2 = CB.fur2;
  const fore = pivot(body, 0, 1, .15), hind = pivot(body, 0, 1, -.35);
  // deep chest (it breathes), forechest, the tucked waist, and the croup
  const ribs = pivot(fore, 0, .03, .07);
  ball(ribs, .5, F, 0, 0, 0, 1).scale.set(.78, .78, .86);
  ball(ribs, .25, CB.tan, 0, -.02, .34, 1).scale.set(.95, 1, .62); // rust chest blaze
  const waist = tcyl(body, .33, .22, .62, F, 0, 1.06, -.2, 8); waist.rotation.x = PI / 2; waist.scale.x = .85;
  ball(hind, .37, F, 0, .06, -.25, 1).scale.set(.86, .85, 1);
  // spiky ridge down the spine
  for (let i = 0; i < 9; i++) {
    const z = .32 - i * .14, fr = z > -.08;
    cone(fr ? fore : hind, .05, .2 - (i % 2) * .05, i % 2 ? F2 : CB.dark, 0, .36, fr ? z - .15 : z + .35, 4).rotation.x = -1.1;
  }
  // legs: [front left, front right, hind left, hind right]
  const limbs = [cbLeg(fore, -.29, -.1, .3, true), cbLeg(fore, .29, -.1, .3, true), cbLeg(hind, -.24, -.04, -.25, false), cbLeg(hind, .24, -.04, -.25, false)];
  // the three necks, each with a spiked collar and a ruff of spiky fur, on a common root that turns to look
  const head = pivot(fore, 0, .26, .42);
  const heads = [], jaws = [], necks = [];
  const NK = [{ x: -.28, y: -.05, yaw: -.5, len: .48, s: 1, ears: -.55, brow: .5, scar: false, torn: false },
    { x: 0, y: .04, yaw: 0, len: .52, s: 1.1, ears: -.1, brow: .38, scar: true, torn: false },
    { x: .28, y: -.05, yaw: .5, len: .48, s: 1, ears: .12, brow: .3, scar: false, torn: true }];
  NK.forEach((q, i) => {
    const nk = pivot(head, q.x, q.y, -Math.abs(q.x) * .25); nk.rotation.order = 'YXZ';
    tcyl(nk, .15 * q.s, .22 * q.s, q.len, F, 0, 0, q.len / 2, 8).rotation.x = PI / 2;
    ball(nk, .2 * q.s, F, 0, -.03, .06, 1).scale.set(1, .9, 1.2);
    const cz = q.len * .58, cr = .195 * q.s;
    tcyl(nk, cr, cr, .07, CB.iron, 0, 0, cz, 9).rotation.x = PI / 2;
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * PI * 2;
      cone(nk, .03, .1, CB.spike, Math.sin(a) * (cr + .03), Math.cos(a) * (cr + .03), cz, 4, NOSH).rotation.z = -a;
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 8 - .5) * PI * 1.5, sp = cone(nk, .05, .2 + (k % 2) * .06, k % 2 ? CB.dark : F2, Math.sin(a) * .2 * q.s, Math.cos(a) * .2 * q.s, .05, 4);
      sp.quaternion.setFromUnitVectors(_Y, _u.set(Math.sin(a), Math.cos(a), -.8).normalize());
    }
    const hp = pivot(nk, 0, 0, q.len); hp.rotation.order = 'YXZ';
    const hd = cbHead(hp, q.s, q);
    heads.push(hp); jaws.push(hd.jaw);
    necks.push({ nk, hp, yaw: q.yaw, pitch: -.55, ears: hd.ears, lag: 0 });
  });
  // serpent tail: two furred segments, then scales, then a hissing head looking back
  const tail = pivot(hind, 0, .17, -.58); tail.rotation.order = 'YXZ';
  const tailSegs = []; let tp = tail;
  for (let j = 0; j < 7; j++) {
    if (j) { tp = pivot(tp, 0, 0, -.11); tp.rotation.order = 'YXZ'; }
    tailSegs.push(tp);
    tcyl(tp, .075 - j * .0065, .075 - (j + 1) * .0065, .12, j < 2 ? F : j % 2 ? CB.sn2 : CB.sn, 0, 0, -.055, 6).rotation.x = PI / 2;
    if (j >= 2) cone(tp, .02, .05, CB.dark, 0, .05 - j * .003, -.05, 3, NOSH).rotation.x = -1.1;
    tp.userData.x0 = [.55, -.15, -.2, -.2, -.05, .3, .4][j];
  }
  const th = pivot(tp, 0, 0, -.12); th.rotation.y = PI; tailSegs.push(th); th.userData.x0 = -.3;
  ball(th, .06, CB.sn, 0, .01, -.01, 0).scale.set(1.1, .8, 1.2);
  box(th, .08, .045, .1, CB.sn, 0, 0, .06);
  const tj = pivot(th, 0, -.02, .02); box(tj, .07, .02, .09, CB.sn2, 0, -.01, .05);
  for (const sx of [-1, 1]) {
    box(th, .02, .018, .014, CB.snEye, sx * .035, .028, .06, GLOW);
    cone(th, .008, .045, CB.bone, sx * .024, -.03, .095, 3, NOSH).rotation.x = PI;
  }
  const r = { root, body, fore, hind, ribs, head, heads, jaws, necks, limbs, legs: limbs.map((l) => l.a), tail, tailSegs, tailJaw: tj,
    phase: 0, quad: true, t: 0, gait: 0, tph: 0, lie: 0, calmK: 0, growlK: 0, restK: 0, walkK: 0, hx: 0, hy: 0 };
  r.pose = (dt, o) => animateCerberus(r, dt, o);
  r.tick = (r, dt, st) => animateCerberus(r, dt, { mode: st.mode || (st.windup >= 0 || st.attackT >= 0 ? 'growl' : 'guard'), moving: st.moving, speed: st.speed ?? 1, look: st.look });
  animateCerberus(r, 0, { mode: 'guard' });
  if (PXART) { // pixel art: shaggy black fur, riveted iron collars, scaled serpent tail, the furnace glowing in each pair of eyes
    for (const hp of heads) for (const sx of [-1, 1]) eyeGlow(hp.children[0], '#ff6a3a', .14, sx * .08, .048, .2, .55);
    { const nk = necks[1].nk, cz = NK[1].len * .58, cr = .195 * NK[1].s; // a broken chain from the middle collar: he was bound at this gate once
      for (let i = 0; i < 4; i++) { const k = torus(nk, .034, .011, CB.iron, i * .006, -cr - .02 - i * .052, cz + .01, i === 3 ? { arc: PI * 1.4 } : undefined); k.rotation.set(0, i % 2 ? PI / 2 : 0, i === 3 ? .6 : 0); } }
    pxDress(r, { [CB.fur]: ['fur', { long: 6, cw: 9, ch: 6 }], [CB.fur2]: ['fur', { long: 6, cw: 9, ch: 6 }], [CB.dark]: ['fur', { long: 5, cw: 8, ch: 6 }], [CB.tan]: ['fur', { long: 4, cw: 7, ch: 5 }], [CB.iron]: ['metal', { rust: '#7a4a2c' }], [CB.spike]: 'metal', [CB.bone]: 'bone', [CB.gum]: 'skin',
      [CB.sn]: ['scale', { sw: 5, sh: 3 }], [CB.sn2]: ['scale', { sw: 5, sh: 3 }], [CB.eye]: 'eye', [CB.snEye]: 'eye', '#4a1c24': 'skin', '#a83444': 'skin', '#6a4a54': 'skin' }, { D: 200, max: 256 });
  }
  addOutline(root, (m) => !m.castShadow || m.material.isMeshBasicMaterial);
  pxRig(root); // the realm poses him without animateRig, so he takes the characters' pixel shading here (nothing swaps his materials later)
  return r;
}
// o: { mode: 'guard' | 'growl' | 'calm' | 'rest' | 'walk', moving, speed (1 = full trot), look (yaw to turn the heads to, or null) }.
// Trot: the diagonal pairs swing together, elbows/stifles fold and paws curl on the way forward, flat on the ground in
// stance; the body bobs twice a stride, rolls and twists with the pairs; the heads bob and sway a beat apart.
const mixA = (a, b, w) => a + (b - a) * w;
export function animateCerberus(r, dt, o) {
  const m = o.mode || 'guard', t = (r.t += dt), k = 1 - Math.pow(.03, dt), e = 1 - Math.pow(.12, dt);
  const bl = (key, want, rate) => (r[key] += (want - r[key]) * rate);
  const L = bl('lie', m === 'calm' || m === 'rest' ? 1 : 0, e), C = bl('calmK', m === 'calm' ? 1 : 0, e), Rs = bl('restK', m === 'rest' ? 1 : 0, e);
  const G = bl('growlK', m === 'growl' ? 1 : 0, 1 - Math.pow(.02, dt)), W = bl('walkK', o.moving ? 1 : 0, 1 - Math.pow(.005, dt));
  if (o.moving || W > .02) r.gait += dt * 5.4 * Math.max(.45, Math.min(1.3, o.speed ?? 1));
  const ph = r.gait, S = Math.sin(ph), Cs = Math.cos(ph), br = Math.sin(t * (1.6 + G * 3.4)), up = 1 - L;
  // body: down on the belly, crouched to growl, or bobbing along
  const B = r.body;
  B.position.y = -.015 - .53 * L - .045 * G * up + W * (Math.abs(Cs) * .05 - .025);
  B.rotation.x = .05 * G * up + W * Math.sin(ph * 2) * .015;
  B.rotation.z = W * S * .035 + G * Math.sin(t * 37) * .008;
  r.fore.rotation.y = W * S * .07; r.hind.rotation.y = -W * S * .06;
  r.ribs.scale.set(1 + br * .025, 1 + br * .03, 1);
  // legs
  r.limbs.forEach((lb, i) => {
    const q = ph + (i === 0 || i === 3 ? 0 : PI), lift = Math.max(0, Math.cos(q)) * W, sw = -Math.sin(q) * W * (lb.front ? .4 : .36);
    const [ra, rb, rc] = lb.rest, [la, lb2, lc] = lb.lie;
    let a, b, c;
    if (lb.front) { a = ra + sw + .2 * G; b = rb + lift * 1.15 - .3 * G; c = rc + lift * 1.1; }
    else { a = ra + sw - .12 * G; b = rb + lift * .8 + .22 * G; c = rc - lift * .5 - .1 * G; }
    a = mixA(a, la, L); b = mixA(b, lb2, L); c = mixA(c, lc, L);
    lb.a.rotation.x = a; lb.b.rotation.x = b; lb.c.rotation.x = c;
    lb.d.rotation.x = -(a + b + c + B.rotation.x) + lift * (lb.front ? .9 : .5);
  });
  // heads: the common root follows dog.look; each neck catches up at its own pace and sways on its own
  r.hy += ((o.look ?? 0) - r.hy) * k;
  r.hx += (Rs * .32 + (m === 'guard' ? -.06 : 0) + G * .22 - r.hx) * k;
  r.head.rotation.set(r.hx, r.hy * .55, 0);
  r.necks.forEach((n, i) => {
    const mid = i === 1, side = i - 1, bob = W * Math.cos(ph * 2 + i * .8);
    n.lag += (r.hy * .45 - n.lag) * (1 - Math.pow(.02 + i * .05, dt));
    n.nk.rotation.y = n.yaw * (1 - .4 * G - .85 * C) + n.lag + Math.sin(t * .9 + i * 2.1) * .1 * (1 - G) + W * Math.sin(ph + i * .9) * .07;
    n.nk.rotation.x = n.pitch + Math.sin(t * 1.3 + i) * .05 * (1 - C) + br * .02 + bob * .07 + G * .12 + C * (mid ? .95 : .3) + Rs * (mid ? .05 : .3);
    n.hp.rotation.x = -n.pitch - G * (.15 - Math.sin(t * 11 + i * 2) * .05) - C * (mid ? .7 : .05) - Rs * .15 - bob * .05;
    n.hp.rotation.z = C * (mid ? Math.sin(t * 2.2) * .12 : -side * .35) + Math.sin(t * .6 + i * 1.7) * .05;
    n.hp.rotation.y = -side * .15 * (1 - C);
    const jaw = G > .3 ? .42 + Math.sin(t * 16 + i * 2) * .14 : C > .5 ? .2 + Math.max(0, Math.sin(t * 9 + i * 2)) * .2
      : m === 'rest' ? .04 + Math.max(0, Math.sin(t * .7 + i * 2.5)) * .05 : .08 + (i === 0 ? .08 : 0) + Math.max(0, Math.sin(t * 2 + i * 2)) * .07 + W * .1;
    r.jaws[i].rotation.x += (jaw - r.jaws[i].rotation.x) * Math.min(1, dt * 14);
    n.ears.forEach((ep, j) => { ep.rotation.x = ep.userData.x0 - G * .9 - C * .45 - Rs * .3 + Math.pow(Math.max(0, Math.sin(t * .8 + i * 2.3 + j * 1.1)), 30) * .5; });
  });
  // tail: lazy curl at rest, swishing in stride, wagging hard when calmed
  r.tph += dt * (1.4 + W * 5.2 + C * 15);
  const amp = .07 + W * .06 + C * .1, lift = (m === 'guard' ? .1 : 0) + G * .2 - L * .7 + C * .35;
  r.tailSegs.forEach((sg, j) => {
    sg.rotation.y = (j === 7 ? PI : 0) + Math.sin(r.tph - j * .6) * amp * (j ? 1 : .7);
    sg.rotation.x = sg.userData.x0 + (j === 0 ? lift : j < 4 ? L * .15 : 0) + (j === 7 ? Math.sin(t * 1.1) * .15 : 0);
  });
  r.tailJaw.rotation.x = .1 + Math.max(0, Math.sin(t * 1.3)) * .35 + G * .3;
}

export function makeCharon() {
  const C = '#2b2a31', C2 = '#38363f', C3 = '#1f1e24';
  const r = humanoid({ skin: '#4a4850', top: C, bottom: C, boots: C3, sleeve: C2, faceless: true, scale: 1.06 });
  hood(r, C2, { void: '#050507' });
  robe(r, C, { top: .23, bot: .42, y1: -.84, folds: C3, n: 8 });
  for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + .3; const tt = box(r.torso, .09, .1 + (i % 3) * .05, .03, C, Math.sin(a) * .41, -.86 - (i % 3) * .02, Math.cos(a) * .36, px('tatter', C, PXART ? NSH : undefined)); tt.rotation.y = a; }
  const cp = turn(tcyl(r.torso, .28, .42, .5, C2, 0, .4, -.02, 10, px('capelet', C2))); cp.scale.z = .8;
  for (const E of [r.elbowL, r.elbowR]) turn(tcyl(E, .075, .12, .24, C2, 0, -.15, 0, 7, px('wideSleeve', C2)));
  cape(r, C3, 1.3, .52);
  // round 33: the finishes, at V's level: a hemp rope girdle knotted at the robe's top, the bone clasp of his capelet with
  // a hanging obol, and the pouch of the dead's coins at his hip (a few bronze obols showing at its mouth)
  belt(r, '#6a5a44', .07, null, .04, .24);
  ball(r.torso, .038, '#cfc6b0', 0, .6, .25, 1, px('gem', '#cfc6b0', { noShadow: true })).scale.z = .6;
  tcyl(r.torso, .028, .028, .008, '#b8863c', 0, .54, .262, 8, px('gold', '#b8863c', { noShadow: true })).rotation.x = PI / 2;
  const pch = ball(r.torso, .07, '#3e3228', -.25, .0, .13, 1, px('pouch', '#3e3228')); pch.scale.set(.85, 1.1, .7);
  for (const [x, z] of [[-.27, .15], [-.235, .16]]) { const o = tcyl(r.torso, .018, .018, .006, '#c8963c', x, .075, z, 7, px('gold', '#c8963c', { noShadow: true })); o.rotation.x = 1.1; }
  r.lean = .12;
  // the long oar, held across the body with both hands
  const oar = new THREE.Group(); r.torso.add(oar); oar.position.set(.06, .32, .36);
  oar.quaternion.setFromUnitVectors(_Y, new THREE.Vector3(.46, .87, -.12).normalize());
  shaft(tcyl(oar, .03, .035, 2.4, '#5a4029', 0, -.1, 0, 6), '#5a4029', 2.4);
  box(oar, .2, .46, .035, '#6a4c30', 0, -1.33, 0, px('wood', '#6a4c30'));
  tcyl(oar, .045, .045, .1, '#3a2a1c', 0, 1.08, 0, 6, px('grip', '#3a2a1c'));
  hold(r, 'R', oar, 0, .12, 0); hold(r, 'L', oar, 0, -.22, 0);
  r.oar = oar; r.mode = 'row'; r.tick = charonTick;
  return done(r);
}
const _cv = new THREE.Vector3(), _cw = new THREE.Vector3(), _cl = new THREE.Vector3(), _cr = new THREE.Vector3();
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// Charon in his boat (r.boat, from makeFerryBoat). r.mode: 'tie' (waiting: turned to the stern, bent over the bitt
// working the line round it, with a hard pull now and then), 'face' (turned to r.faceAt, a world point, hands folded:
// he speaks to her face to face), 'row' (the ferry ride poses him at the oar itself)
function charonTick(r, dt, st) {
  const m = r.mode || 'row', B = r.boat, R = r.root, T = r.torso;
  r.oar.visible = m === 'row' || !B;
  if (!B) return;
  B.oarRest.visible = B.line.visible = m !== 'row';
  if (m === 'work') { B.tail.visible = false; workPose(r, dt, st); return; }
  if (m === 'row') { R.rotation.y = 0; if (r.homeZ != null) R.position.z = r.homeZ; B.tail.visible = false; r.tieK = 0; return; }
  r.homeZ ??= R.position.z;
  const t = r.t = (r.t || 0) + dt, e = 1 - Math.pow(.05, dt);
  let want = PI;
  if (m === 'face' && r.faceAt && R.parent) { R.parent.worldToLocal(_cv.copy(r.faceAt)); want = Math.atan2(_cv.x - R.position.x, _cv.z - R.position.z); }
  R.rotation.y += wrapA(want - R.rotation.y) * e;
  const tie = m === 'tie' && Math.abs(wrapA(PI - R.rotation.y)) < .6;
  const k = r.tieK = (r.tieK || 0) + ((tie ? 1 : 0) - (r.tieK || 0)) * (1 - Math.pow(.03, dt));
  R.position.z += (r.homeZ - .15 * k - R.position.z) * e;
  const pull = Math.pow(Math.max(0, Math.sin(t * 1.1)), 12), hy = .9 - .12 * k;
  r.hip.position.set(0, hy, 0); r.hip.rotation.set(0, 0, 0);
  legIK(r, 'L', .1 - (hy - .02), .12 * k, -.08, 1); legIK(r, 'R', .1 - (hy - .02), -.12 * k, .08, 1);
  T.rotation.set(.06 + (.62 - .22 * pull) * k, 0, 0);
  r.head.rotation.x = .25 * k;
  // hands: looping the line round the bitt (its place in his torso's frame), or folded in front of him
  T.updateWorldMatrix(true, false); B.bitt.getWorldPosition(_cv); T.worldToLocal(_cv);
  const ph = t * 3.6;
  _cl.set(-.07 + Math.cos(ph) * .06, .03 + Math.sin(ph) * .05, -.04).add(_cv);
  _cr.set(.07 - Math.cos(ph) * .06, .05 - Math.sin(ph) * .05, -.04).add(_cv);
  if (pull > .02) { _cl.lerp(_cw.set(-.12, .32, .2), pull * .8); _cr.lerp(_cw.set(.1, .36, .18), pull * .8); }
  _cl.lerp(_cw.set(-.07, .1, .27), 1 - k); _cr.lerp(_cw.set(.07, .13, .27), 1 - k);
  if (st.talk) _cr.lerp(_cw.set(.24, .3 + Math.sin(t * 2.3) * .06, .3), (1 - k) * .8);
  armIK(r, 'L', _cl, 1); armIK(r, 'R', _cr, 1);
  // the loose end of the line runs from the bitt into his right hand
  B.tail.visible = k > .6;
  if (B.tail.visible) { r.handR.updateWorldMatrix(true, false); B.root.worldToLocal(r.handR.getWorldPosition(_cw)); spanTo(B.tail, B.bittL, _cw); }
}
// ---- round 19 (Roy: Charon shouldn't just lie in his boat): on the landing he works. He shuttles a crate between the
// stack by the shore end and a spot halfway out, and coils a line between loads; when V comes near he sets down what he
// holds, walks to the shore end of the landing and turns to her. charonWork moves him (call it each frame with his root
// a child of the dock, deck top at y .5, the dock running out along +z); charonTick's 'work' mode poses him from r.work.
const DECK = .5, WALK = .85;
const W_SPOTS = { stack: { x: .55, y: 1.1, z: .7 }, mid: { x: .5, y: DECK, z: 3.9 } }, W_COIL = { x: .65, y: DECK + .12, z: 2.0 };
// where he stands to handle a crate (beside it, on the walkway side) and which way he then faces
const standBy = (c) => { const sx = c.x > -.1 ? -1 : 1, x = Math.max(-.7, Math.min(.7, c.x + sx * .62)); return { x, z: c.z, face: Math.atan2(c.x - x, 0) }; };
export function charonWork(r, dt, o) {
  const R = r.root, crate = o.crate;
  let w = r.work;
  if (!w) {
    w = r.work = { job: 'go', t: 0, to: null, then: 'lift', next: 'mid', carry: false, at: { ...W_SPOTS.stack }, rot: .3, bend: 0, coil: 0, attend: 0, hold: 0, away: 9 };
    R.position.set(-.1, DECK, 1.6); R.rotation.y = 0; r.workCrate = crate;
    crate.position.set(w.at.x, w.at.y, w.at.z); crate.rotation.set(0, w.rot, 0);
  }
  const e = 1 - Math.pow(.02, dt);
  w.t += dt;
  // V near (or a scene with him in it): stop, put the crate down, come to the shore end and face her
  w.away = o.attend ? 0 : w.away + dt;
  const want = o.attend || w.away < 1.5;
  if (want && w.job !== 'attend' && w.job !== 'toV' && w.job !== 'drop') {
    if (w.carry) { const f = R.rotation.y; w.at = { x: Math.max(-.6, Math.min(.6, R.position.x + Math.sin(f) * .5)), y: DECK, z: Math.max(.5, Math.min(5.4, R.position.z + Math.cos(f) * .5)) }; w.rot = f; w.job = 'drop'; w.t = 0; w.then = 'toV'; }
    else { w.job = 'toV'; w.t = 0; }
  }
  if (!want && (w.job === 'attend' || w.job === 'toV')) { w.job = 'go'; w.to = standBy(w.at); w.then = 'lift'; w.t = 0; }
  let moving = false, face = null;
  const walkTo = (p, speed = WALK) => {
    const dx = p.x - R.position.x, dz = p.z - R.position.z, d = Math.hypot(dx, dz);
    if (d < .06) return true;
    const st = Math.min(d, speed * dt); R.position.x += dx / d * st; R.position.z += dz / d * st; face = Math.atan2(dx, dz); moving = true;
    return false;
  };
  switch (w.job) {
    case 'go': if (!w.to) w.to = standBy(w.at); if (walkTo(w.to)) { face = w.to.face; if (w.t > .4 && Math.abs(wrapA(w.to.face - R.rotation.y)) < .25) { w.job = w.then; w.t = 0; } } else w.t = 0; break;
    case 'lift': // bend, take it in both hands half way down, straighten up with it
      face = standBy(w.at).face;
      if (!w.carry && w.t > .55) { r.torso.attach(crate); w.carry = true; }
      if (w.t > 1.15) { const tgt = W_SPOTS[w.next]; w.job = 'carry'; w.to = standBy(tgt); w.t = 0; }
      break;
    case 'carry': if (walkTo(w.to, WALK * .8)) { face = w.to.face; if (Math.abs(wrapA(w.to.face - R.rotation.y)) < .25) { w.at = { ...W_SPOTS[w.next] }; w.rot = (Math.random() - .5) * .5; w.job = 'drop'; w.then = 'coil'; w.t = 0; } } break;
    case 'drop':
      face = w.carry ? R.rotation.y : face;
      if (w.carry && w.t > .55) { o.dock.attach(crate); w.carry = false; }
      if (w.t > 1.1) { w.job = w.then; w.t = 0; if (w.job === 'coil') { w.next = w.next === 'mid' ? 'stack' : 'mid'; w.to = { x: .02, z: W_COIL.z, face: Math.PI / 2 }; } }
      break;
    case 'coil': // walk over to the line and coil it down, a good while, before the next load
      if (walkTo(w.to)) { face = w.to.face; if (w.t > 6.5) { w.job = 'go'; w.to = standBy(w.at); w.then = 'lift'; w.t = 0; } } else w.t = Math.min(w.t, .5);
      break;
    case 'toV': { const v = o.vLocal; const to = { x: v ? Math.max(-.5, Math.min(.5, v.x)) * .6 : 0, z: .75 }; if (walkTo(to)) { w.job = 'attend'; w.t = 0; } break; }
    case 'attend': default: break;
  }
  if (w.job === 'attend' && o.vLocal) face = Math.atan2(o.vLocal.x - R.position.x, o.vLocal.z - R.position.z);
  if (face != null) R.rotation.y += wrapA(face - R.rotation.y) * (1 - Math.pow(.004, dt));
  R.position.x = Math.max(-.85, Math.min(.85, R.position.x)); R.position.z = Math.max(.35, Math.min(5.6, R.position.z)); R.position.y = DECK;
  // the crate settles where it was put down, or rides in his hands
  if (w.carry) { crate.position.lerp(_cw.set(0, -.08, .4), e); crate.quaternion.slerp(_cq.identity(), e); }
  else { crate.position.lerp(_cw.set(w.at.x, w.at.y, w.at.z), e); crate.quaternion.slerp(_cq.setFromAxisAngle(_Y, w.rot), e); }
  // pose weights (workPose reads them): a bend that dips at the middle of a lift or a put-down, the coiling crouch, attending
  const bendT = w.job === 'lift' || w.job === 'drop' ? Math.sin(Math.min(1, w.t / 1.1) * Math.PI) : 0;
  w.bend += (bendT - w.bend) * Math.min(1, dt * 10);
  w.coil += ((w.job === 'coil' && !moving ? 1 : 0) - w.coil) * e;
  w.attend += ((w.job === 'attend' ? 1 : 0) - w.attend) * e;
  w.hold += ((w.carry ? 1 : 0) - w.hold) * Math.min(1, dt * 8);
  w.coilAt ??= new THREE.Vector3(); o.dock.localToWorld(w.coilAt.set(W_COIL.x, W_COIL.y, W_COIL.z));
  r.anim.moving = moving; r.anim.speed = .5;
}
const _cq = new THREE.Quaternion();
function workPose(r, dt, st) {
  const w = r.work; if (!w) return;
  const T = r.torso, t = r.t = (r.t || 0) + dt, b = w.bend, c = w.coil, a = w.attend;
  if (!st.moving) {
    const hy = .9 - .34 * b - .3 * c;
    r.hip.position.y = hy; r.hip.rotation.set(0, 0, 0);
    legIK(r, 'L', -(hy - .12), .12 * (b + c), -.08, 1); legIK(r, 'R', -(hy - .12), -.1 * (b + c), .08, 1);
  }
  T.rotation.set(.06 + .8 * b + .55 * c + (w.hold > .5 && !b ? -.08 : 0), 0, 0);
  r.head.rotation.x = .3 * b + .35 * c - .05 * a;
  const k = Math.max(b, c, a, w.hold);
  if (k < .02) return; // walking empty-handed: the arms swing as animateRig left them
  T.updateWorldMatrix(true, false);
  // the crate's two sides (held, or about to be lifted / just set down), folded hands, or hands working the coil
  if (w.hold > .02 || b > .02) {
    const cr = r.workCrate; cr.updateWorldMatrix(true, false);
    for (const [side, sx] of [['L', -1], ['R', 1]]) {
      cr.localToWorld(_cv.set(sx * .27, .22, 0)); T.worldToLocal(_cv);
      armIK(r, side, _cv, Math.min(1, Math.max(w.hold, b * 1.6)));
    }
    return;
  }
  if (c > .02) {
    T.worldToLocal(_cv.copy(w.coilAt)); const ph = t * 3.2;
    _cl.set(-.08 + Math.cos(ph) * .08, .05 + Math.sin(ph) * .06, -.06).add(_cv);
    _cr.set(.08 - Math.cos(ph) * .08, .07 - Math.sin(ph) * .06, -.06).add(_cv);
    armIK(r, 'L', _cl, c); armIK(r, 'R', _cr, c);
    return;
  }
  _cl.set(-.07, .1, .27); _cr.set(.07, .13, .27);
  if (st.talk) _cr.lerp(_cw.set(.24, .3 + Math.sin(t * 2.3) * .06, .3), .8);
  armIK(r, 'L', _cl, a); armIK(r, 'R', _cr, a);
}
// Charon's ferry: a small, long wooden boat, bow +z, waterline at y .25 and floorboards at .22 (where V and Charon
// stand). A planked hull whose sheer sweeps up to a scrolled stern post and a prow that carries a lantern; ribs, two
// thwarts, a bitt on the little stern deck where the line is made fast, a spare oar for when he isn't rowing.
// moor(world point) runs the line ashore; tail is the loose end Charon works round the bitt (see charonTick).
const ROPE = '#8c7a56';
function spanTo(m, a, b) { _u.subVectors(b, a); const len = _u.length() || 1e-3; m.position.copy(a).addScaledVector(_u, .5); m.quaternion.setFromUnitVectors(_Z, _u.divideScalar(len)); m.scale.z = len; return m; }
export function makeFerryBoat() {
  const root = new THREE.Group(), Z0 = -1.65, Z1 = 3.35, ZM = (Z0 + Z1) / 2, HL = (Z1 - Z0) / 2, N = 20, ST = [];
  for (let i = 0; i <= N; i++) {
    const z = Z0 + (Z1 - Z0) * i / N, u = (z - ZM) / HL, au = Math.abs(u);
    const w = Math.max(.03, .6 * Math.pow(Math.max(0, 1 - au ** 2.4), .55)), gy = .6 + .3 * au ** 3 + (u > 0 ? .1 * u ** 3 : 0), by = -.1 + .34 * au ** 2.6;
    ST.push({ z, w, gy, by, sec: [[w, gy], [w * .96, gy - (gy - by) * .4], [w * .7, by + (gy - by) * .13], [0, by]] });
  }
  const halfAt = (s, y) => { const P = s.sec; if (y <= P[3][1]) return 0; for (let k = 3; k > 0; k--) { const a = P[k], b = P[k - 1]; if (y <= b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); } return P[0][0]; };
  // the planking: three strakes a side, outside and in, one mesh per colour
  const tris = new Map(), uvs = new Map(), add = (col, uv, ...v) => { if (!tris.has(col)) { tris.set(col, []); uvs.set(col, []); } tris.get(col).push(...v); uvs.get(col).push(...uv); };
  const OUT = ['#5e4431', '#4f3828', '#3b2a1e'], IN = ['#433021', '#3a2a1c', '#302218'];
  for (const sx of [-1, 1]) for (const inner of [0, 1]) for (let k = 0; k < 3; k++) for (let i = 0; i < N; i++) {
    const P = (s, j) => [sx * Math.max(0, s.sec[j][0] - inner * .045), s.sec[j][1] + (inner && j === 3 ? .04 : 0), s.z];
    const a0 = P(ST[i], k), b0 = P(ST[i], k + 1), a1 = P(ST[i + 1], k), b1 = P(ST[i + 1], k + 1), col = (inner ? IN : OUT)[k];
    const ua = ST[i].z * .78, ub = ST[i + 1].z * .78; // pixel art: one strake of the plank texture each, u along the hull
    if (sx * (inner ? -1 : 1) > 0) add(col, [ua, 1, ub, 1, ua, 0, ua, 0, ub, 1, ub, 0], ...a0, ...a1, ...b0, ...b0, ...a1, ...b1); else add(col, [ua, 1, ua, 0, ub, 1, ub, 1, ua, 0, ub, 0], ...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
  }
  for (const [col, v] of tris) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    if (PXART) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.get(col), 2));
    const m = new THREE.Mesh(geo, PXART ? pt('planks', col) : mat(col)); m.castShadow = true; root.add(m);
  }
  const wd = (m, col = '#' + m.material.color?.getHexString(), d = 1.3) => { if (PXART) { m.material = pt('boards', col); uvBox(m, d); } return m; }; // a board or beam: grain along it
  // gunwale rails, ribs, floorboards, two thwarts
  for (const sx of [-1, 1]) for (let i = 0; i < N; i++) { const a = ST[i], b = ST[i + 1]; wd(strap(root, [sx * (a.w - .02), a.gy + .02, a.z], [sx * (b.w - .02), b.gy + .02, b.z], .09, .06, '#6e4e34'), '#6e4e34'); }
  for (let i = 2; i <= N - 2; i += 2) for (const sx of [-1, 1]) {
    const s = ST[i], P = s.sec.map(([x, y]) => [sx * Math.max(.02, x - .07), y + .02, s.z]);
    for (let j = 3; j > 0; j--) wd(strap(root, P[j], P[j - 1], .06, .05, '#4a3424'), '#4a3424');
  }
  for (let i = 0; i < N; i++) {
    const a = ST[i], b = ST[i + 1], zc = (a.z + b.z) / 2, hw = Math.min(halfAt(a, .22), halfAt(b, .22)) - .05;
    if (zc > -1.3 && zc < 2.9 && hw > .08) wd(box(root, hw * 2, .04, b.z - a.z - .03, i % 2 ? '#5a4232' : '#4e3a2a', 0, .22, zc));
  }
  for (const z of [.05, 2.1]) {
    const s = ST[Math.round((z - Z0) / (Z1 - Z0) * N)], hw = halfAt(s, .52) - .02;
    wd(box(root, hw * 2, .06, .28, '#64483a', 0, .52, z)); for (const sx of [-1, 1]) wd(box(root, .05, .26, .05, '#4a3424', sx * (hw - .07), .38, z));
  }
  // the stern deck with its bitt, the line turned round it; the scrolled stern post, the prow with its lantern
  wd(box(root, halfAt(ST[1], .86) * 2 + .04, .05, .34, '#5a4232', 0, .86, Z0 + .22));
  wd(tcyl(root, .07, .08, .34, '#4a3424', 0, 1.03, Z0 + .26, 6)); wd(box(root, .26, .05, .05, '#6e4e34', 0, 1.12, Z0 + .26));
  for (const y of [.95, 1.0, 1.05]) pd(torus(root, .085, .022, ROPE, 0, y, Z0 + .26), 'rope', ROPE).rotation.x = PI / 2;
  for (const y of [.26, .31]) pd(torus(root, .17, .035, ROPE, .2, y, Z0 + .62), 'rope', ROPE).rotation.x = PI / 2; // a coil of spare line
  const bitt = pivot(root, 0, 1.0, Z0 + .26), bittL = new THREE.Vector3(0, 1.0, Z0 + .32);
  const post = (pts) => { for (let i = 1; i < pts.length; i++) wd(strap(root, pts[i - 1], pts[i], .11, .11, '#3e2c1f'), '#3e2c1f'); };
  post([[0, .2, Z0 + .02], [0, .92, Z0 - .06], [0, 1.25, Z0 - .02], [0, 1.45, Z0 + .1], [0, 1.52, Z0 + .26], [0, 1.44, Z0 + .36]]);
  post([[0, .25, Z1 - .02], [0, 1.02, Z1 + .08], [0, 1.32, Z1 + .2], [0, 1.5, Z1 + .36], [0, 1.56, Z1 + .5]]);
  cone(root, .07, .2, '#3e2c1f', 0, 1.56, Z1 + .6, 4, px('wood', '#3e2c1f')).rotation.x = PI / 2;
  pd(strap(root, [0, 1.5, Z1 + .42], [0, 1.74, Z1 + .8], .045, .045, '#2a2a30'), 'gold', '#2a2a30'); pd(strap(root, [0, 1.74, Z1 + .8], [0, 1.62, Z1 + .84], .025, .025, '#2a2a30'), 'gold', '#2a2a30');
  box(root, .2, .04, .2, '#2a2a30', 0, 1.6, Z1 + .84, px('iron', '#2a2a30')); box(root, .2, .04, .2, '#2a2a30', 0, 1.32, Z1 + .84, px('iron', '#2a2a30'));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(root, .025, .28, .025, '#2a2a30', sx * .09, 1.46, Z1 + .84 + sz * .09, px('gold', '#2a2a30'));
  const lantern = box(root, .15, .24, .15, '#b6ff8a', 0, 1.46, Z1 + .84, { basic: true, noShadow: true });
  if (PXART) lantern.material = PXA.paOnce('m:st:lantern', () => new THREE.MeshBasicMaterial({ map: PXA.paTex('st:lantern', 8, 12, (c) => { // leaded panes round a pale green flame, brightest low in the middle
    const { R, P } = c; R(0, 0, 8, 12, '#2a2a30'); R(1, 1, 6, 10, '#6ec85a'); R(2, 3, 4, 7, '#b6ff8a'); R(3, 5, 2, 4, '#eaffc8'); P(3, 6, '#ffffff'); R(0, 6, 8, 1, '#2a2a30'); R(4, 0, 1, 12, '#2a2a30'); P(1, 1, '#d8ffb0');
  }) }));
  // the spare oar lies along the thwarts
  const oarRest = pivot(root, .27, .6, .9); oarRest.rotation.set(PI / 2 - .04, 0, .05);
  shaft(tcyl(oarRest, .03, .035, 2.4, '#5a4029', 0, 0, 0, 6), '#5a4029', 2.4); box(oarRest, .035, .46, .2, '#6a4c30', 0, -1.23, 0, px('wood', '#6a4c30'));
  // the mooring line (moor() lays it out) and the loose end
  const line = new THREE.Group(); root.add(line);
  const tail = box(root, .035, .035, 1, ROPE, 0, 0, 0, { noShadow: true });
  const moor = (w) => {
    line.clear(); root.updateWorldMatrix(true, false); const end = root.worldToLocal(w.clone());
    const a = new THREE.Vector3(0, .98, Z0 + .2), s = new THREE.Vector3(0, .95, Z0 - .12), pts = [a, s];
    for (let i = 1; i <= 5; i++) { const f = i / 5; pts.push(new THREE.Vector3().lerpVectors(s, end, f).add(_u.set(0, -Math.sin(PI * f) * .3, 0))); }
    for (let i = 1; i < pts.length; i++) spanTo(box(line, .035, .035, 1, ROPE, 0, 0, 0, { noShadow: true }), pts[i - 1], pts[i]);
  };
  const b = { root, bitt, bittL, line, tail, oarRest, lantern, moor };
  bake(b);
  return b;
}

export function makePoseidon() {
  const SK = '#e4a874', BLUE = '#3a86c4', BLUE2 = '#5fb0e4', GOLD = '#e0b03c', HAIR = '#eeeef2';
  const r = humanoid({ skin: SK, top: SK, bottom: BLUE, legs: SK, boots: '#9a6a3a', sleeve: null, eyes: '#2a5a8a', brow: '#e0e0e6', browTilt: .3, lips: '#9a5a4a', scale: 1.15 });
  pecs(r, SK, 1.15);
  if (!PXART) for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) box(r.torso, .07, .05, .03, '#d39462', sx * .045, .3 - i * .07, .165, { noShadow: true }); // (pixel art: the skin's own abs)
  hairCap(r, HAIR, { h: .85 }); longHair(r, HAIR, .62, 1.12);
  for (const sx of [-1, 1]) (PXART ? PG.bl(r.head, .1, PG.curlMat(HAIR), sx * .17, .22, -.02, 1) : ball(r.head, .1, HAIR, sx * .17, .22, -.02, 0)).scale.set(.8, 1.3, 1);
  beard(r, HAIR, .42, 1.15, { tilt: .18 });
  // blue drape over the left shoulder, gold belt and bracers
  robe(r, BLUE, { top: .23, bot: .36, y1: -.6, folds: BLUE2, n: 7 });
  sash(r, BLUE, .22, -.78, .34);
  belt(r, GOLD, .1, '#f2cc58', .1, .215);
  bracer(r, GOLD, 'LR', .17);
  // sea foam curling at his feet
  const foam = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * PI * 2, f = torus(r.root, .12 + (i % 2) * .05, .03, i % 2 ? '#9fe0ff' : '#5fb6ea', Math.sin(a) * .42, .1, Math.cos(a) * .42, { basic: true, opacity: .75, noShadow: true, arc: PI * 1.3 });
    f.rotation.set(PI / 2 - .3, 0, a); foam.push(f);
  }
  let tr;
  if (PXART) tr = PG.poseidon(r, { BLUE, foam }); // wave-chased crown with pearls, shell brooch, hemmed back drape, barbed trident, painted foam
  else {
    // golden crown
    tcyl(r.head, .222, .222, .06, GOLD, 0, .36, -.03, 10);
    for (let i = 0; i < 7; i++) { const a = (i - 3) * .42; cone(r.head, .035, .13 + (i === 3 ? .06 : 0), GOLD, Math.sin(a) * .21, .44, -.03 + Math.cos(a) * .21, 4); }
    const bk = box(r.torso, .2, .7, .04, BLUE, -.1, .2, -.19); bk.rotation.z = -.2;
    const br = tcyl(r.torso, .06, .06, .03, GOLD, -.22, .6, .13, 8); br.rotation.x = PI / 2 - .3;
    // trident
    tr = staff(r.handR, '#6d8ca2', 2.5, .3);
    tcyl(tr, .05, .05, .07, GOLD, 0, 1.5, .03, 6);
    box(tr, .34, .05, .05, '#86a8c0', 0, 1.56, .03);
    for (const sx of [-1, 0, 1]) {
      box(tr, .045, sx ? .3 : .38, .045, '#86a8c0', sx * .15, sx ? 1.72 : 1.76, .03);
      cone(tr, .055, .14, '#a4c4d8', sx * .15, sx ? 1.93 : 2.01, .03, 4);
    }
  }
  r.trident = tr; r.foam = foam; r.t = 0;
  r.tick = (r, dt) => { r.t += dt; r.foam.forEach((f, i) => { f.rotation.z += dt * (1.5 + i * .2); f.position.y = .08 + Math.sin(r.t * 2 + i) * .05; }); };
  if (PXART) PG.seal(r);
  return done(r);
}

export function makeTiresias() {
  const SK = '#d7ac88', CREAM = '#dccdaa', BROWN = '#7a4e2c', BROWN2 = '#5e3a20', WH = '#ecebe6';
  const r = humanoid({ skin: SK, top: CREAM, bottom: CREAM, boots: '#5a3e28', sleeve: CREAM, brow: WH, eyes: '#cfc6b8', lips: '#8a5a4a', old: true }); r.npc = true;
  const h = r.head;
  const hr = ball(h, .208, '#d8d6d0', 0, .2, -.05, 1, px('hair', '#d8d6d0')); hr.scale.set(1.03, .78, 1.05); // white fringe around a bald crown
  ball(h, .175, SK, 0, .26, .02, 1).scale.set(1, .8, 1);
  beard(r, WH, .4, 1.05, { tilt: .1 });
  for (const e of r.eyes) e.visible = false;
  const bf = turn(tcyl(h, .218, .218, .09, '#f7f4ee', 0, .205, .0, PXART ? 16 : 12, px('wrapL', '#f7f4ee'))); bf.scale.z = 1.03; // blindfold
  box(h, .2, .014, .02, '#c8c0b0', 0, .17, .222, { noShadow: true });
  for (const sx of [-1, 1]) { const tl = box(h, .04, .14, .02, '#f4f1ea', sx * .04, .14, -.22, px('ribbon', '#f4f1ea')); tl.rotation.z = sx * .3; }
  robe(r, CREAM, { top: .21, bot: .34, y1: -.82, folds: '#c4b48c', n: 6 });
  if (PXART) dressChest(r, CREAM, 'bodice');
  sash(r, BROWN, .26, -.7, .34);
  const fp = box(r.torso, .2, 1.05, .04, BROWN, -.13, -.15, .2, px('stole', BROWN)); fp.rotation.set(-.08, 0, .06);
  cape(r, BROWN2, 1.25, .46);
  belt(r, BROWN2, .1, null, .05);
  // crooked staff
  const st = new THREE.Group(); r.handR.add(st);
  let p = pivot(st, 0, -.8, .03);
  const kinks = [[.0, .06], [.08, -.1], [-.06, .08], [.1, -.05], [-.04, .1], [.06, 0]];
  for (const [ax, az] of kinks) { shaft(tcyl(p, .034, .042, .38, '#6a4a2a', 0, .19, 0, 5), '#6a4a2a', .38); p = pivot(p, 0, .36, 0); p.rotation.set(ax, 0, az); }
  for (let i = 0; i < 4; i++) { shaft(tcyl(p, .034, .036, .12, '#6a4a2a', 0, .06, 0, 5), '#6a4a2a', .12); p = pivot(p, 0, .11, 0); p.rotation.z = -.75; }
  // scroll in the left hand
  const sc = new THREE.Group(); r.torso.add(sc); sc.position.set(-.2, .18, .36); sc.rotation.set(-.4, .3, 0);
  const sh = box(sc, .26, .3, .01, '#e8d8a8'); if (PXART) { const pa = pt('parch', '#e8d8a8'); sh.material = [pa, pa, pa, pa, pt('paper', '#e8d8a8'), pa]; } // inked lines painted on
  if (!PXART) for (let i = 0; i < 5; i++) box(sc, .18 - (i % 2) * .04, .012, .01, '#6a5034', -.01, .09 - i * .045, .008, { noShadow: true });
  for (const sy of [-1, 1]) { const rl = tcyl(sc, .028, .028, .3, '#d8c48e', 0, sy * .16, .01, 6, px('wood', '#d8c48e')); rl.rotation.z = PI / 2; }
  hold(r, 'L', sc, .02, -.1, -.03);
  r.scroll = sc; r.staff = st; r.lean = .14;
  return done(r);
}

export function makeMinotaur() {
  const FUR = '#6e3c22', FUR2 = '#58301b', MUZ = '#8c5c3c', HORN = '#e8dcc0', IRON = '#8e969f';
  const r = humanoid({ skin: FUR, top: FUR, bottom: '#4a2e1c', legs: FUR, boots: '#2a1c14', sleeve: null, faceless: true, scale: 1.5 });
  r.skull.scale.set(1.1, 1, 1.05);
  pecs(r, FUR, 1.25);
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) box(r.torso, .075, .055, .03, FUR2, sx * .05, .3 - i * .075, .165, { noShadow: true });
  ball(r.torso, .2, FUR, 0, .7, -.08, 1).scale.set(1.3, .8, 1); // bull neck hump
  const h = r.head;
  const mz = tcyl(h, .12, .15, .22, MUZ, 0, .1, .17, 8); mz.rotation.x = PI / 2 - .25; mz.scale.x = 1.05;
  box(h, .2, .1, .08, MUZ, 0, .07, .29);
  for (const sx of [-1, 1]) {
    box(h, .04, .03, .02, '#1a0e0a', sx * .045, .085, .335, { noShadow: true });
    box(h, .06, .035, .02, '#160c0a', sx * .085, .24, .19, { noShadow: true });
    box(h, .024, .02, .012, '#ff4a30', sx * .085, .245, .2, { basic: true, noShadow: true });
    const bw = box(h, .09, .03, .04, FUR2, sx * .085, .28, .18, { noShadow: true }); bw.rotation.z = sx * .35;
    const ear = cone(h, .06, .16, FUR, sx * .25, .25, -.02, 4); ear.rotation.z = sx * 1.75; ear.scale.z = .5;
    let p = pivot(h, sx * .17, .34, .0); p.rotation.set(.1, 0, -sx * 1.25);
    for (let i = 0; i < 4; i++) { tcyl(p, .055 - i * .012, .07 - i * .012, .13, HORN, 0, .06, 0, 6); p = pivot(p, 0, .12, 0); p.rotation.set(.1, 0, sx * (.5 + i * .12)); }
  }
  const ring = torus(h, .045, .012, '#d8a840', 0, .03, .335, { noShadow: true }); ring.rotation.x = .2;
  box(h, .12, .08, .08, FUR2, 0, .36, .1).rotation.x = .4; // forelock tuft
  // loincloth, iron belt, wrist bands, hooves
  robe(r, '#6a4628', { top: .22, bot: .32, y1: -.36, folds: '#4e321c', n: 6 });
  box(r.torso, .22, .46, .04, '#5a3a22', 0, -.28, .24).rotation.x = -.08;
  belt(r, IRON, .1, '#b8bec6', .09, .215);
  bracer(r, IRON, 'LR', .13);
  for (const K of [r.kneeL, r.kneeR]) box(K, .14, .05, .1, '#1c120c', 0, -.39, .1);
  // iron round shield
  const sh = roundShield(r.elbowL, .48, IRON, '#6e7680', { boss: '#a8b0b8', rivets: '#b6bec6' });
  sh.position.set(-.12, -.12, .04); r.shield = sh;
  if (PXART) { for (const sx of [-1, 1]) eyeGlow(h, '#ff6a3a', .1, sx * .085, .245, .21, .5); pxDress(r, { [FUR]: ['fur', { long: 5, cw: 8, ch: 6 }], [FUR2]: ['fur', { long: 5, cw: 8, ch: 6 }], [MUZ]: 'skin', [HORN]: 'horn', [IRON]: ['metal', { rust: '#7a4a2c' }], '#4a2e1c': 'leather', '#2a1c14': 'leather', '#1c120c': 'horn', '#d8a840': 'metal', '#5a3a22': 'leather', '#6a4628': 'cloth', '#4e321c': 'cloth', '#6e7680': 'metal', '#a8b0b8': 'metal', '#b6bec6': 'metal', '#b8bec6': 'metal', '#ff4a30': 'eye' }); } // pixel art: fur, ringed horns, iron
  return done(r);
}

const HESP = [
  { skin: '#e8b996', hair: '#5a321e', eyes: '#4a2c1c', style: 'long' },
  { skin: '#f0caa8', hair: '#e2c374', eyes: '#3a6a8e', style: 'straight' },
  { skin: '#eab48e', hair: '#b45e2a', eyes: '#3e6a3e', style: 'bun' },
];
export function makeHesperid(i = 0) {
  const H = HESP[((i % 3) + 3) % 3], DR = '#efe8d6', DR2 = '#d6ccb4', GOLD = '#d8a838';
  const r = humanoid({ skin: H.skin, top: DR, bottom: DR, legs: H.skin, boots: '#c09868', sleeve: null, eyes: H.eyes, liner: '#4a2a20', lips: '#b45a52', brow: H.hair === '#e2c374' ? '#a8843a' : H.hair, browTilt: .1, scale: .96 }); r.npc = true;
  lashes(r);
  hairCap(r, H.hair, { h: .84 });
  if (H.style === 'bun') { bun(r, H.hair, .38, -.13); for (const sx of [-1, 1]) tcyl(r.head, .03, .04, .3, H.hair, sx * .19, .08, .04, 5, px('braid', H.hair)); }
  else longHair(r, H.hair, H.style === 'long' ? .8 : .66, H.style === 'long' ? 1.08 : .98);
  const TR = ['#3f8a5a', '#c45a7a', '#d08a2e'][((i % 3) + 3) % 3];
  chiton(r, DR, { top: .2, bot: .35, y1: -.84, folds: DR2, n: 8, trim: TR, key: GOLD });
  bust(r, DR); neckTrim(r, GOLD);
  drape(r, TR, GOLD, (i % 2 ? 1 : -1) * .72, .14, .38);
  belt(r, GOLD, .3, null, .03, .2);
  for (const sx of [-1, 1]) box(r.torso, .05, .03, .26, DR, sx * .14, .62, 0, px('ribbon', DR)); // shoulder ties
  tcyl(r.armL, .07, .07, .035, GOLD, 0, -.2, 0, PXART ? 10 : 6, px('gold', GOLD));
  for (let k = 0; k < 7; k++) { const a = (k - 3) * .45; flowerHair(r, ['#f4f0f4', '#f2d23a', '#e84a5a'][(k + i) % 3], Math.sin(a) * .2, .34 + Math.abs(k - 3) * -.01, -.03 + Math.cos(a) * .2); }
  earrings(r); necklace(r, GOLD); sandals(r, '#8a6a3a', GOLD);
  // golden apple held out in the right hand
  const anchor = hold(r, 'R', r.torso, .2, .24, .3);
  const ap = ball(anchor, .075, '#f0be2c', 0, .07, .03, 1, PXART ? { material: PXA.paOnce('st:appleGlow', () => { const m = pt('apple', '#f0be2c').clone(); m.emissive.set('#3a2400'); return m; }) } : { emissive: '#3a2400' });
  tcyl(anchor, .008, .01, .05, '#5a3a1a', 0, .15, .03, 4, px('wood', '#5a3a1a'));
  box(anchor, .05, .012, .03, '#4a8a2a', .03, .16, .03, px('leaf', '#4a8a2a', NSH)).rotation.z = -.4;
  r.apple = ap;
  return done(r);
}

export function makeZeus() {
  const SK = '#e2a878', WH = '#f2efe8', WH2 = '#d8d2c6', GOLD = '#e2b23c', HAIR = '#f4f4f6';
  const r = humanoid({ skin: SK, top: SK, bottom: WH, legs: SK, boots: '#b08a4a', sleeve: null, eyes: '#4a6a98', brow: '#ececf0', browTilt: .32, lips: '#9a5a4a', scale: 1.17 });
  pecs(r, SK, 1.2);
  if (!PXART) for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) box(r.torso, .07, .05, .03, '#cf9464', sx * .045, .3 - i * .07, .165, { noShadow: true });
  // storm of white hair and beard, gold band
  const cap = hairCap(r, HAIR, { h: .95 }); cap.scale.x = 1.12;
  longHair(r, HAIR, .7, 1.2);
  const puff = (s, x, y, z) => PXART ? PG.bl(r.head, s, PG.curlMat(HAIR), x, y, z, 1) : ball(r.head, s, HAIR, x, y, z, 0); // pixel art: curly locks
  for (const [x, y, z, s] of [[-.2, .3, -.02, .11], [.2, .3, -.02, .11], [-.17, .42, -.08, .09], [.17, .42, -.08, .09], [0, .48, -.06, .1], [-.22, .16, -.06, .1], [.22, .16, -.06, .1]]) puff(s, x, y, z);
  const bd = beard(r, HAIR, .46, 1.25, { tilt: .14 });
  puff(.1, -.07, -.1, .14); puff(.1, .07, -.12, .13);
  if (PXART) PG.zeus(r); else tcyl(r.head, .226, .226, .04, GOLD, 0, .34, -.02, 10);
  ball(r.head, .03, '#fff0a0', 0, .345, .225, 0, { basic: true, noShadow: true });
  // white toga, gold belt, bracers, brooch
  toga(r, WH, WH2, { w: .24 });
  belt(r, GOLD, .1, '#f4d060', .11, .218);
  bracer(r, GOLD, 'LR', .17);
  let bolt, glow;
  if (PXART) ({ g: bolt, glowMat: glow } = PG.zeusBolt(r.handR)); // the bolt as hand-drawn cut-outs, white-hot core, a dithered glow
  else {
    const br = tcyl(r.torso, .065, .065, .03, GOLD, -.21, .6, .13, 8); br.rotation.x = PI / 2 - .3;
    // the lightning bolt, glowing
    bolt = new THREE.Group(); r.handR.add(bolt); bolt.position.set(0, -.05, .05);
    const pts = [[0, -.35], [.08, -.12], [-.05, -.02], [.09, .2], [-.04, .3], [.06, .55]];
    glow = new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: .45, depthWrite: false });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = [pts[i][0], pts[i][1], 0], b = [pts[i + 1][0], pts[i + 1][1], 0];
      strap(bolt, a, b, .05, .05, '#fffbe0', { basic: true, noShadow: true });
      const g = strap(bolt, a, b, .12, .12, '#fff3a0', { basic: true, noShadow: true }); g.material = glow;
    }
    cone(bolt, .05, .16, '#fffbe0', .06, .62, 0, 4, { basic: true, noShadow: true });
  }
  r.bolt = bolt; r.t = 0;
  r.tick = (r, dt) => { r.t += dt; glow.opacity = .3 + Math.abs(Math.sin(r.t * 9) * Math.sin(r.t * 23)) * .45; };
  if (PXART) PG.seal(r);
  return done(r);
}

export function makeAthena() {
  const SK = '#ebc09c', WH = '#efeadf', WH2 = '#d6cdb9', BLUE = '#35588e', BRONZE = '#c9963c', GOLD = '#e0b440';
  const r = humanoid({ skin: SK, top: WH, bottom: WH, legs: SK, boots: '#8a6a3a', sleeve: null, eyes: '#7c8c9c', liner: '#2e2626', lips: '#a8585a', brow: '#3e2818', browTilt: .2, scale: 1.04 });
  lashes(r);
  hairCap(r, '#3e2616', { h: .8 }); longHair(r, '#3e2616', .66, 1.02, { front: false });
  robe(r, WH, { top: .21, bot: .36, y1: -.84, folds: WH2, n: 8 });
  belt(r, GOLD, .14, null, .04);
  bracer(r, BRONZE, 'R', .14);
  if (PXART) { // engraved helm and horsehair crest, scaled aegis fringed with snakes round a gorgoneion, hemmed himation, leaf-bladed spear, owl shield
    r.spear = PG.athena(r, { BLUE, RED: '#b42a2a' });
    const sh = PG.shield(r.elbowL, .36, PG.BZ, 'owl'); sh.position.set(-.12, -.12, .04); r.shield = sh;
  } else {
    // Corinthian helm pushed up, tall red crest
    const hm = ball(r.head, .225, BRONZE, 0, .34, -.05, 1); hm.scale.set(1.02, .78, 1.08);
    const vz = box(r.head, .3, .1, .14, BRONZE, 0, .42, .14); vz.rotation.x = -.35;
    for (const sx of [-1, 1]) box(r.head, .03, .028, .02, '#2a1c10', sx * .07, .43, .21, { noShadow: true });
    box(r.head, .05, .06, .5, '#2c2018', 0, .53, -.05);
    for (let i = 0; i < 7; i++) { const c = box(r.head, .07, .16 + Math.sin(i / 6 * PI) * .08, .09, i % 2 ? '#b42a2a' : '#c83a34', 0, .6 + Math.sin(i / 6 * PI) * .04, .2 - i * .07); c.rotation.x = -.3 + i * .1; }
    const tail = box(r.head, .07, .3, .08, '#b42a2a', 0, .44, -.3); tail.rotation.x = .4;
    // blue himation, golden aegis with the gorgon's head
    const him = tcyl(r.torso, .26, .33, .42, BLUE, 0, -.12, 0, 10); him.scale.z = .82; him.rotation.z = .12;
    const ae = tcyl(r.torso, .24, .32, .22, GOLD, 0, .55, 0, 10); ae.scale.z = .82;
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; const sc = cone(r.torso, .03, .09, '#3f7a32', Math.sin(a) * .31, .41, Math.cos(a) * .25, 4, { noShadow: true }); sc.rotation.x = PI; }
    const gm = tcyl(r.torso, .075, .075, .03, BRONZE, 0, .45, .2, 8); gm.rotation.x = PI / 2 - .2;
    ball(r.torso, .045, '#8fb07a', 0, .45, .215, 0, { noShadow: true });
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; box(r.torso, .015, .04, .012, '#3f7a32', Math.sin(a) * .06, .45 + Math.cos(a) * .06, .22, { noShadow: true }).rotation.z = -a; }
    // spear
    const sp = staff(r.handR, '#6a4a2a', 2.5, .4);
    cone(sp, .06, .3, BRONZE, 0, 1.78, .03, 4); tcyl(sp, .045, .045, .06, BRONZE, 0, 1.6, .03, 6);
    r.spear = sp;
    const sh = roundShield(r.elbowL, .36, '#c9963c', '#8a5a24', { boss: null });
    sh.position.set(-.12, -.12, .04);
    const gf = ball(sh, .09, '#8fb07a', -.035, 0, 0, 0, { noShadow: true }); gf.scale.set(.4, 1, 1);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; box(sh, .02, .03, .09, '#3f7a32', -.035, Math.sin(a) * .13, Math.cos(a) * .13, { noShadow: true }).rotation.x = -a; }
    r.shield = sh;
  }
  sandals(r, '#6a4a2a', BRONZE, true); sleeveTrim(r, BLUE); hem(r, BLUE, -.81, .355, .85, .05);
  if (PXART) PG.seal(r);
  return done(r);
}

export function makeLostSoul() {
  const C = '#a6ece6', C2 = '#7fd2cc', o = { opacity: .74, emissive: '#1d4f55' };
  const r = humanoid({ skin: C, top: C, bottom: C, faceless: true });
  const ws = (col) => PXA.paOnce('st:wisp~' + col, () => { const m = pt('wisp', col).clone(); Object.assign(m, { transparent: true, opacity: o.opacity }); m.emissive.set(o.emissive); return m; }); // pixel art: rising streaks and motes, still see-through
  const wo = (col) => PXART ? { material: ws(col) } : o;
  r.root.traverse((m) => { if (m.isMesh) { m.material = PXART ? ws('#' + m.material.color.getHexString()) : mat(m.material.color.getStyle(), o); m.castShadow = false; } });
  r.legL.visible = r.legR.visible = false;
  for (const sx of [-1, 1]) { const e = ball(r.head, .05, '#0e2e36', sx * .075, .2, .185, 0, { noShadow: true }); e.scale.set(.8, 1.4, .5); e.rotation.z = sx * .25; }
  const mo = ball(r.head, .045, '#0e2e36', 0, .065, .18, 0, { noShadow: true }); mo.scale.set(.85, 1.6, .5);
  const hd = ball(r.head, .24, C2, 0, .3, -.12, 1, wo(C2)); hd.scale.set(1.05, .95, 1); hd.castShadow = false;
  // trailing ghost tail
  const tail = []; let p = pivot(r.torso, 0, .02, 0);
  for (let i = 0; i < 5; i++) {
    const rt = .26 - i * .035, rb = .22 - i * .045;
    const m = tcyl(p, rt, Math.max(.03, rb), .26, i % 2 ? C2 : C, 0, -.13, 0, 9, wo(i % 2 ? C2 : C)); m.castShadow = false; m.scale.z = .85;
    tail.push(p); p = pivot(p, 0, -.24, 0);
  }
  for (const E of [r.elbowL, r.elbowR]) for (let k = 0; k < 3; k++) { const w = cone(E, .04, .22, C2, (k - 1) * .04, -.36, -.03, 4, wo(C2)); w.rotation.x = PI + .3; w.castShadow = false; }
  r.tail = tail; r.t = Math.random() * 6;
  r.tick = (r, dt, st) => {
    r.t += dt;
    r.body.position.y = .28 + Math.sin(r.t * 2.1) * .1;
    r.tail.forEach((s, i) => { s.rotation.x = (i ? .25 : .5) + (st.moving ? .2 : 0) + Math.sin(r.t * 2.4 - i * .8) * .12; s.rotation.z = Math.sin(r.t * 1.7 - i) * .12; });
    if (!(st.attackT >= 0)) { r.armL.rotation.x = -.7 + Math.sin(r.t * 1.6) * .15; r.armR.rotation.x = -.6 + Math.sin(r.t * 1.6 + 1) * .15; r.elbowL.rotation.x = r.elbowR.rotation.x = -.5; }
  };
  return done(r);
}

export function makeSealGuardian(kind = 'stone') {
  if (kind === 'stone') {
    const S = '#7d6d5a', S2 = '#6a5b4a', S3 = '#93836e', EYE = '#ff9a32';
    const r = humanoid({ skin: S, top: S, bottom: S2, legs: S, boots: S2, sleeve: S, faceless: true, scale: 1.4 });
    reDress(r, { [S]: ['stone', 'stone', 'stone'], [S2]: ['stone', 'stone', 'stone'] }); // pixel art: gritty, pitted, cracked rock
    r.skull.visible = false;
    const hd = ball(r.head, .22, S3, 0, .16, 0, PXART ? 1 : 0, px('stone', S3)); hd.scale.set(1.1, .95, 1);
    for (const sx of [-1, 1]) box(r.head, .07, .04, .03, EYE, sx * .08, .19, .2, { basic: true, noShadow: true });
    box(r.head, .26, .05, .08, S2, 0, .25, .17, px('stone', S2)).rotation.x = .3;
    const rocks = [[r.torso, .2, -.12, .52, .02], [r.torso, .2, .12, .48, .06], [r.torso, .16, 0, .3, .12], [r.torso, .17, -.08, .12, .1], [r.torso, .18, .1, .15, .04],
      [r.torso, .17, -.32, .62, 0], [r.torso, .17, .32, .62, 0], [r.torso, .15, 0, .5, -.14], [r.elbowL, .13, 0, -.3, 0], [r.elbowR, .13, 0, -.3, 0],
      [r.elbowL, .1, 0, -.12, .02], [r.elbowR, .1, 0, -.12, .02], [r.legL, .12, 0, -.2, .02], [r.legR, .12, 0, -.2, .02], [r.kneeL, .1, 0, -.15, .02], [r.kneeR, .1, 0, -.15, .02], [r.armL, .14, -.03, 0, 0], [r.armR, .14, .03, 0, 0]];
    rocks.forEach(([p, s, x, y, z], i) => { const b = ball(p, s, i % 3 ? S : S3, x, y, z, 0, px('stone', i % 3 ? S : S3)); b.rotation.set(i, i * 2, 0); });
    for (const [x, y, a] of [[-.05, .35, .6], [.08, .2, -.9], [0, .55, 1.4]]) box(r.torso, .14, .02, .02, '#ff8a2a', x, y, .25, { basic: true, noShadow: true }).rotation.z = a;
    if (PXART) { const sm = new Set([S, S2, S3].map((c) => pt('stone', c))); r.root.traverse((m) => { if (m.isMesh && sm.has(m.material)) uvBox(m, 3); }); } // the grit at one even size on every rock facet and limb (their own uvs blew it up into blotches)
    r.kind = 'stone';
    return done(r);
  }
  const STEEL = '#7c838e', STEEL2 = '#5a606a', DARK = '#2a2c34';
  const fire = kind === 'fire', GLOW = fire ? '#ff8a24' : '#5ac8ff';
  const r = humanoid({ skin: STEEL, top: STEEL, bottom: STEEL2, legs: STEEL2, boots: STEEL2, sleeve: STEEL, faceless: true, scale: 1.32 });
  reDress(r, { [STEEL]: ['greave', 'ironDome', 'iron'], [STEEL2]: ['greave', 'ironDome', 'iron'] }); // pixel art: the limbs in ridged, rimmed plate
  r.flames = [];
  const flame = (p, x, y, z, s, cols) => { cols.forEach((c, i) => { const f = cone(p, s * (1 - i * .3), s * (2.6 - i * .5), c, x, y + i * s * .2, z, 5, { basic: true, noShadow: true }); r.flames.push(f); }); };
  // breastplate, faulds, pauldrons
  const bp = turn(tcyl(r.torso, .28, .22, .42, STEEL, 0, .38, 0, PXART ? 12 : 8, px('cuirass', STEEL))); bp.scale.z = .8;
  box(r.torso, .05, .34, .03, STEEL2, 0, .38, .23, px('iron', STEEL2));
  ball(r.torso, .07, GLOW, 0, .44, .2, 0, { basic: true, noShadow: true });
  for (let i = 0; i < 3; i++) { const f = tcyl(r.torso, .23 + i * .025, .25 + i * .025, .08, i % 2 ? STEEL2 : STEEL, 0, .02 - i * .08, 0, 8, px('gold', i % 2 ? STEEL2 : STEEL)); f.scale.z = .82; }
  for (const sx of [-1, 1]) {
    const pa = ball(r.torso, .17, STEEL, sx * .33, .6, 0, 1, px('ironDome', STEEL)); pa.scale.set(1.1, .7, 1.1);
    const pa2 = ball(r.torso, .15, STEEL2, sx * .35, .52, 0, 1, px('ironDome', STEEL2)); pa2.scale.set(1.05, .6, 1.05);
  }
  bracer(r, STEEL2, 'LR', .2);
  for (const K of [r.kneeL, r.kneeR]) { ball(K, .085, STEEL, 0, 0, .04, 0, px('ironDome', STEEL)); turn(tcyl(K, .09, .08, .2, STEEL, 0, -.13, 0, PXART ? 10 : 6, px('greave', STEEL))); }
  for (const E of [r.elbowL, r.elbowR]) ball(E, .085, STEEL2, 0, -.3, 0, 0, px('ironDome', STEEL2)); // gauntlets
  if (fire) {
    const hm = turn(tcyl(r.head, .2, .2, .36, STEEL, 0, .2, 0, PXART ? 14 : 10, px('iron', STEEL))); hm.scale.z = 1.05;
    ball(r.head, .2, STEEL, 0, .38, 0, 1, px('helm', STEEL)).scale.set(1, .5, 1.05);
    box(r.head, .26, .03, .02, GLOW, 0, .23, .205, { basic: true, noShadow: true });
    box(r.head, .03, .16, .02, STEEL2, 0, .16, .21, px('iron', STEEL2));
    for (let i = 0; i < 5; i++) flame(r.head, (i - 2) * .07, .48 + (2 - Math.abs(i - 2)) * .04, -.02, .08, ['#ff6a1a', '#ffb02a', '#fff0a0']);
    for (const E of [r.elbowL, r.elbowR]) for (let i = 0; i < 3; i++) flame(E, (i - 1) * .05, -.25, .02, .06, ['#ff6a1a', '#ffc040']);
    for (const sx of [-1, 1]) flame(r.torso, sx * .34, .7, 0, .06, ['#ff6a1a', '#ffc040']);
  } else {
    const wo = { opacity: .78, emissive: '#1a4a7a' }, wet = (col) => PXART ? { material: PXA.paOnce('st:wet~' + col, () => { const m = pt('wisp', col).clone(); Object.assign(m, { transparent: true, opacity: wo.opacity }); m.emissive.set(wo.emissive); return m; }) } : wo; // pixel art: streaming water, still see-through
    r.skull.material = PXART ? wet('#3a8ad8').material : mat('#3a8ad8', wo);
    for (const sx of [-1, 1]) box(r.head, .07, .035, .03, '#e8faff', sx * .07, .2, .19, { basic: true, noShadow: true });
    const crest = []; for (let i = 0; i < 5; i++) { const c = cone(r.head, .07, .3 - Math.abs(i - 2) * .05, i % 2 ? '#7ad0ff' : '#3a9ae8', (i - 2) * .06, .45, -.08 - Math.abs(i - 2) * .02, 5, wet(i % 2 ? '#7ad0ff' : '#3a9ae8')); c.rotation.x = -.5; c.castShadow = false; crest.push(c); r.flames.push(c); }
    for (const E of [r.elbowL, r.elbowR]) { const wa = tcyl(E, .08, .07, .32, '#3a9ae8', 0, -.16, 0, 7, wet('#3a9ae8')); wa.castShadow = false; }
    const ring = torus(r.root, .45, .06, '#5ab8f0', 0, .08, 0, { basic: true, opacity: .7, noShadow: true }); ring.rotation.x = PI / 2; r.flames.push(ring);
  }
  r.kind = kind; r.t = 0;
  r.tick = (r, dt) => { r.t += dt; r.flames.forEach((f, i) => { f.scale.y = .85 + Math.sin(r.t * 14 + i * 1.9) * .18; f.rotation.y += dt * (fire ? 0 : 1); }); };
  return done(r);
}

// ======================================================================================
// TOWNSFOLK
// ======================================================================================
const SKINS = ['#eabf9c', '#deac86', '#cf9a74', '#bf8862', '#e3b48e', '#a97452', '#f0caa8', '#8e5e3e', '#d8a47c'];
const HAIRS = ['#2a1c14', '#3a2618', '#4a3020', '#1a1412', '#6a4a2a', '#7a5a32', '#8a4a24', '#5a3420', '#1e1612'];
const HAIRS_F = ['#2a1c14', '#3a2618', '#5a3420', '#1a1412', '#7a4a26', '#a85a2a', '#d0a458', '#8a3a1e', '#4a2c1a'];
const GREYS = ['#c8c4bc', '#e2ded6', '#a29e96', '#d6d2ca', '#eeece6'];
const CLOTH = ['#b8a27a', '#8a6a48', '#a0522d', '#6b7a4a', '#c9b58a', '#7a4a3a', '#5a6a7a', '#b07a3a', '#9a8a6a', '#d6ccb2', '#8a3a2e', '#6a5a42', '#4e6e8e', '#7a8a4a'];
const FINE = ['#ece6d8', '#e2d6b6', '#3f6fb0', '#b8372f', '#4f8a3e', '#7b4a9a', '#d08a2e', '#2f8a86', '#c45a7a', '#e8e2d2', '#c9a24a', '#5a4a8a'];
const TRIMS = ['#e0b040', '#b8372f', '#2e4f8a', '#2a2622', '#e8e0cc', '#3f7a3a', '#7b3a8a', '#d06a2a'];
const BOOTS = ['#5a3e28', '#6a4a30', '#4a3222', '#7a5a3a'];
const FLOWERS = ['#e84a5a', '#f2d23a', '#f4f0f4', '#c86ad8', '#f08a3a', '#6aa8f0'];
const shade = (c, f) => '#' + new THREE.Color(c).multiplyScalar(f).getHexString();
const other = (R, a, not) => { let c = pick(R, a); for (let i = 0; i < 4 && c === not; i++) c = pick(R, a); return c === not ? shade(c, .72) : c; };

function basket(parent, x, y, z) {
  const g = new THREE.Group(); parent.add(g); g.position.set(x, y, z);
  tcyl(g, .17, .12, .16, '#b08850', 0, 0, 0, 9, kx('wicker', '#b08850')); tcyl(g, .18, .18, .03, '#8a6436', 0, .08, 0, 9, kx('belt', '#8a6436'));
  for (let i = 0; i < 3; i++) tcyl(g, .165 - i * .016, .16 - i * .016, .012, '#8a6436', 0, -.04 + i * .04 - .02, 0, 9, { noShadow: true });
  for (const [c, dx] of [['#c84a3a', -.05], ['#8aa83a', .06], ['#e8b830', 0]]) ball(g, .055, c, dx, .1, (dx ? .03 : -.05), 0, { noShadow: true });
  const hd = torus(g, .15, .014, '#8a6436', 0, .1, 0, { arc: PI }); hd.rotation.y = PI / 2;
  return g;
}
function amphora(parent, x, y, z, col = '#b5653a') {
  const g = new THREE.Group(); parent.add(g); g.position.set(x, y, z);
  ball(g, .15, col, 0, 0, 0, 1, kx('jar', col)).scale.set(1, 1.35, 1);
  tcyl(g, .06, .09, .14, col, 0, .22, 0, 8, kx('jar', col)); tcyl(g, .085, .085, .03, shade(col, .88), 0, .3, 0, 8);
  cone(g, .08, .16, col, 0, -.25, 0, 7, kx('jar', col)).rotation.x = PI;
  tcyl(g, .152, .152, .06, '#2a1a14', 0, .04, 0, 10, kx('jarBand', '#2a1a14', { noShadow: true })); // a painted band (pixel art: a red-figure frieze)
  tcyl(g, .145, .145, .02, '#2a1a14', 0, -.08, 0, 10, { noShadow: true });
  for (const sx of [-1, 1]) torus(g, .06, .015, shade(col, .88), sx * .1, .2, 0).rotation.y = PI / 2;
  return g;
}

// one recipe per seed: sex, age and trade pick the clothes; colours, hair and props vary within them
// round 33: the first draws of a villager's look (who, skin, hair, the two cloth colours, the trim), shared by makeVillager
// and the town crowd (folk.js), whose distant figures wear the same colours as the full figure seen up close
export function villagerLook(seed = 1, region) {
  if (region && RLOOK[region]) return regionLook(seed, region); // round 33 (NPC): the folk of other lands (below)
  const R = rng(seed + 17);
  const female = R() < .46, roll = R(), elder = roll > .78, child = !elder && roll < .1;
  const kind = child ? 'child' : elder ? 'elder' : female ? pick(R, ['peplos', 'peplos', 'chiton', 'veiled', 'chiton'])
    : pick(R, ['worker', 'worker', 'worker', 'citizen', 'citizen', 'traveller', 'merchant', 'soldier']);
  const skin = pick(R, SKINS), hair = elder ? pick(R, GREYS) : pick(R, female ? HAIRS_F : HAIRS);
  const fine = kind === 'citizen' || kind === 'chiton' || kind === 'merchant' || R() < .25;
  const c1 = pick(R, fine ? FINE : CLOTH), c2 = other(R, fine ? FINE : CLOTH, c1), trim = other(R, TRIMS, c1);
  return { R, female, elder, child, kind, skin, hair, fine, c1, c2, trim };
}
export function makeVillager(seed = 1, region) {
  if (region && RLOOK[region]) return regionVillager(seed, region);
  const { R, female, elder, child, kind, skin, hair, fine, c1, c2, trim } = villagerLook(seed);
  const bare = kind === 'worker' && R() < .6, sandal = kind !== 'soldier' && R() < .8;
  const r = humanoid({
    skin, top: bare ? skin : kind === 'soldier' ? '#e6dcc0' : c1, bottom: c1, legs: skin, boots: sandal ? skin : pick(R, BOOTS),
    sleeve: !bare && !female && R() < .3 ? c1 : null,
    eyes: pick(R, ['#3a2a1e', '#4a3a28', '#2a3a4a', '#3a4a2e', '#5a3a1e']), brow: elder ? shade(hair, .75) : shade(hair, .85), browTilt: .06 + R() * .2,
    lips: female ? pick(R, ['#b05a50', '#a04a48', '#c0605a', '#9a4a4a']) : '#8a5a4a', liner: female ? '#3a2420' : null,
    scale: child ? .72 + R() * .06 : (female ? .93 : 1) + (R() - .5) * .08,
  });
  r.info = { female, elder, child, seed, kind }; r.npc = true;
  if (elder) setFace(r, { old: true }); // round 33: an old face (lids, lines)
  const chest = r.torso.children[1];
  if (female) { lashes(r); chest.scale.x = .93; }
  if (child) r.head.scale.setScalar(1.13);
  { // round 33: builds and heights (a second stream, so every draw above and below stays as it was): slim to broad
    const R2 = rng(seed * 7 + 3), w = .9 + R2() * .2, hgt = .96 + R2() * .08;
    if (!child) { chest.scale.x *= w; r.armL.position.x *= .96 + (w - .9) * .4; r.armR.position.x *= .96 + (w - .9) * .4; r.root.scale.multiplyScalar(hgt); }
  }
  let stout = false;
  if (!female && !child && (stout = R() < .3)) { chest.scale.x *= 1.1; const b = ball(r.torso, .2, bare ? skin : c1, 0, .2, .07, 1, bare ? undefined : kx('ball', c1)); b.scale.set(1.05, .9, .8); } // stout
  if (sandal) sandals(r, pick(R, ['#5a3a22', '#4a2e1a', '#6a4428']), pick(R, ['#7a4e2a', '#8a5a30', '#5a3a22']), female && R() < .4); else boots(r, r.s.boots);

  // ---- clothes ----
  const belted = (y, w, col = pick(R, ['#5a3a24', '#7a5a3a', '#c8b48a', '#3a2a1e', trim])) => belt(r, col, y, null, w);
  if (kind === 'peplos') {
    chiton(r, c1, { trim, key: R() < .4 ? c2 : null });
    overfold(r, shade(c1, 1.06), trim); bust(r, shade(c1, 1.06));
    belted(.3, .035); neckTrim(r, trim);
    if (R() < .45) drape(r, c2, trim, (R() < .5 ? -1 : 1) * .72, .17, .36);
  } else if (kind === 'chiton') {
    chiton(r, c1, { trim: R() < .7 ? trim : null }); bust(r, c1);
    belted(.3, .03, trim); neckTrim(r, trim); sleeveTrim(r, trim);
    drape(r, c2, R() < .6 ? trim : null, -.72, .2, .3); wrapSkirt(r, c2, null, -.82);
  } else if (kind === 'veiled') {
    chiton(r, c1, { trim }); bust(r, c1); belted(.3, .03); neckTrim(r, trim);
    drape(r, c2, trim, .72, .2, .34);
  } else if (kind === 'worker') {
    if (bare) { chiton(r, c1, { y0: .3, y1: -.42, top: stout && PXART ? .29 : .25, trim: R() < .4 ? trim : null }); drape(r, c1, null, -.78, .2, .42); pecs(r, skin, .95); }
    else { chiton(r, c1, { y1: -.42, trim: R() < .5 ? trim : null }); neckTrim(r, shade(c1, .8)); }
    belted(.12, .055); if (R() < .5) pouch(r, pick(R, BOOTS), R() < .5 ? 1 : -1);
    if (R() < .3) bracer(r, '#6a4a2c', 'LR', .12);
  } else if (kind === 'citizen') {
    const long = R() < .65;
    chiton(r, c1, { y1: long ? -.82 : -.44, trim: long ? null : trim }); neckTrim(r, trim);
    drape(r, c2, trim, -.74, .22, .34); if (long) wrapSkirt(r, c2, trim, -.82);
    belted(.12, .045, trim);
  } else if (kind === 'merchant') {
    chiton(r, c1, { y1: -.7, trim, key: c2 }); neckTrim(r, trim); sleeveTrim(r, trim);
    belted(.12, .08, c2); pouch(r, '#7a4a28', 1); pouch(r, '#5a3a24', -1);
    if (R() < .6) chlamys(r, c2, trim, .75);
  } else if (kind === 'traveller') {
    chiton(r, c1, { y1: -.44, trim: R() < .5 ? trim : null }); belted(.12, .05);
    chlamys(r, c2, trim, .7); bracer(r, '#6a4a2c', 'LR', .12);
  } else if (kind === 'soldier') {
    const cloak = pick(R, ['#b42a2a', '#8a2a2a', '#2e4f8a', '#6a2a5a']);
    chiton(r, cloak, { y1: -.4, trim: null });
    const lc = turn(tcyl(r.torso, .27, .23, .44, '#e6dcc0', 0, .36, 0, 8, kx('linen', '#e6dcc0'))); lc.scale.z = .78; // linen cuirass
    hem(r, trim, .52, .265, .78, .04); hem(r, trim, .17, .238, .78, .03);
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, sc = i % 2 ? '#e6dcc0' : '#d4c8a6', st = box(r.torso, .075, .22, .03, sc, Math.sin(a) * .25, -.06, Math.cos(a) * .22, kx('strip', sc)); st.rotation.y = a; st.rotation.x = .15 * Math.cos(a); }
    for (const sx of [-1, 1]) box(r.torso, .12, .05, .3, '#e6dcc0', sx * .17, .6, 0, kx('strap', '#e6dcc0'));
    belted(.14, .05, '#6a4428'); greaves(r);
    chlamys(r, cloak, null, .75);
  } else if (kind === 'elder') {
    chiton(r, c1, { trim: female ? trim : null }); if (female) bust(r, c1);
    drape(r, c2, trim, female ? .72 : -.74, .22, .34); if (!female) wrapSkirt(r, c2, trim, -.82);
    belted(.14, .04);
    r.lean = .08 + R() * .12;
  } else { // child
    const col = pick(R, FINE);
    chiton(r, col, { y1: female ? -.6 : -.38, trim: R() < .6 ? trim : null }); belted(female ? .28 : .12, .04);
    if (female) neckTrim(r, trim);
  }

  // ---- hair, beard, headwear ----
  let hat = false;
  if (female) {
    const hs = elder ? pick(R, ['bun', 'bun', 'veil']) : child ? pick(R, ['braids', 'pony', 'long', 'curls']) : pick(R, ['bun', 'bun', 'long', 'pony', 'braids', 'curls', 'sakkos']);
    if (kind === 'veiled' || hs === 'veil') { hairCap(r, hair, { h: .84, locks: 'part' }); veil(r, c2, trim); hat = true; }
    else if (hs === 'bun') { curls(r, hair, { n: 7, s: .05, top: false, back: 4 }); bun(r, hair, .38, -.16); if (R() < .7) fillet(r, pick(R, [trim, '#e0b040', c2]), .33); if (R() < .4) locks(r, hair, .3, 1, true); }
    else if (hs === 'long') { hairCap(r, hair, { h: .86, fringe: R() < .3, locks: 'part' }); locks(r, hair, .55 + R() * .2, 2); if (R() < .5) fillet(r, trim, .33); }
    else if (hs === 'pony') { hairCap(r, hair, { h: .84, locks: 'part' }); ponytail(r, hair, trim); }
    else if (hs === 'braids') { hairCap(r, hair, { h: .84, locks: 'part' }); braids(r, hair, trim, child ? 4 : 6); }
    else if (hs === 'curls') { curls(r, hair, { n: 9, s: .062 }); locks(r, hair, .35, 2, true); }
    else { hairCap(r, hair, { h: .84, locks: 'part' }); sakkos(r, c2, trim); }
    if (!hat && R() < .45) flowerHair(r, pick(R, FLOWERS), R() < .5 ? -.17 : .17);
    if (!child && R() < .6) earrings(r);
    if (!child && R() < .5) necklace(r, '#e0b040', R() < .5 ? pick(R, ['#b8372f', '#2f8a86', '#3f6fb0']) : null);
    if (R() < .4) bangles(r);
  } else {
    const bald = elder && R() < .55;
    const hs = bald ? 'bald' : child ? pick(R, ['curls', 'short', 'curls']) : pick(R, ['short', 'curls', 'curls', 'short', 'long', 'topknot']);
    if (hs === 'bald') baldFringe(r, hair, skin);
    else if (hs === 'curls') curls(r, hair, { n: 8 + Math.floor(R() * 3), s: .055 + R() * .015, h: .78 });
    else if (hs === 'long') { hairCap(r, hair, { h: .8 }); locks(r, hair, .38, 1, false); }
    else if (hs === 'topknot') { hairCap(r, hair, { h: .78 }); ball(r.head, .08, hair, 0, .42, -.08, PXART ? 1 : 0, kx('bun', hair)); fillet(r, trim, .33); }
    else hairCap(r, hair, { h: .7 + R() * .12, fringe: R() < .35 });
    if (!child) {
      const bk = elder ? (R() < .85 ? 'long' : 'short') : pick(R, ['none', 'short', 'short', 'full', 'full', 'goatee', 'none']);
      const bc = elder ? pick(R, GREYS) : shade(hair, 1.05);
      if (bk === 'long') { beard(r, bc, .3 + R() * .18, 1 + R() * .15); ball(r.head, .07, bc, 0, -.14, .14, 0, { noShadow: true }); }
      else if (bk === 'full') { beard(r, bc, .2 + R() * .08, 1.08); for (const sx of [-1, 0, 1]) ball(r.head, .055, bc, sx * .07, -.02 - Math.abs(sx) * -.03, .15, 0, { noShadow: true }); }
      else if (bk === 'short') beard(r, bc, .08, .95);
      else if (bk === 'goatee') { box(r.head, .15, .035, .045, bc, 0, .128, .2, { noShadow: true }); const g = box(r.head, .07, .1, .06, bc, 0, .02, .17); g.rotation.x = .25; if (r.mouth) r.mouth.position.z = .21; }
    }
    if (kind === 'soldier') { corinth(r, '#c9963c', pick(R, ['#b42a2a', '#1e1a18', '#e8e0cc'])); hat = true; }
    else if (!child && (kind === 'worker' || kind === 'traveller' || kind === 'merchant') && R() < (kind === 'traveller' ? .85 : .45)) {
      if (kind !== 'merchant' && R() < .55) petasos(r, pick(R, ['#c8a868', '#b8985a', '#7a5a3a', '#d8c088']), pick(R, ['#5a3a24', trim]), (R() - .5) * .2);
      else pilos(r, pick(R, ['#8a5a34', '#6a4a30', '#a0522d', c2]));
      hat = true;
    }
    if (!hat && (kind === 'citizen' || elder) && R() < .5) wreath(r, pick(R, ['#5a8a3a', '#4a7a32', '#6a9a3a']), .33, R() < .3 ? '#2a2a3a' : null, '#3e6a2a');
    else if (!hat && R() < .2) fillet(r, trim, .32);
  }

  // ---- something to carry ----
  const c = R();
  if (elder) { if (R() < .75) { const st = staff(r.handR, pick(R, ['#6a4a2a', '#7a5a34', '#5a3a22']), 1.75, .25); if (R() < .4) ball(st, .05, '#c8a040', 0, 1.13, .03, 0); r.staff = st; } else scroll(r.handR); }
  else if (child) { if (c < .3) { const b = ball(r.handR, .07, pick(R, ['#c84a3a', '#3f6fb0', '#e0b040']), 0, -.08, .05, 1); r.prop = b; } else if (c < .5 && !female) { const sw = new THREE.Group(); r.handR.add(sw); sw.rotation.x = 1.05; box(sw, .05, .03, .4, '#a07a4a', 0, 0, .2); box(sw, .14, .03, .03, '#7a5a3a', 0, 0, .04); r.prop = sw; } else if (c < .65) { const t = torus(r.handL, .2, .02, '#a07a4a', 0, -.12, .12); t.rotation.y = PI / 2; r.prop = t; } }
  else if (kind === 'soldier') { const sp = staff(r.handR, '#6a4a2a', 2.4, .4); cone(sp, .055, .26, '#c9963c', 0, 1.72, .03, 4, kx('gold', '#c9963c')); r.spear = sp; }
  else if (female) {
    if (c < .18) hydria(r, true); else if (c < .32) hydria(r, false);
    else if (c < .48) { const b = basket(r.torso, -.34, -.02, .14); hold(r, 'L', b, .02, .02, .02); r.prop = b; }
    else if (c < .58) breadTray(r); else if (c < .68) r.prop = distaff(r.handL);
    else if (c < .78) r.prop = bouquet(r.handR, [pick(R, FLOWERS), pick(R, FLOWERS), pick(R, FLOWERS)]);
    else if (c < .84) { const l = lyre(r.torso, -.12, .3, .32); l.rotation.set(-.2, .3, .2); hold(r, 'L', l, -.06, -.02, -.02); hold(r, 'R', l, .04, .14, .04); r.prop = l; }
  } else if (kind === 'worker') {
    if (c < .45) toolOnShoulder(r, pick(R, ['hoe', 'rake', 'fork', 'pick']));
    else if (c < .6) hydria(r, false); else if (c < .72) { const b = basket(r.torso, -.34, -.02, .14); hold(r, 'L', b, .02, .02, .02); r.prop = b; }
    else if (c < .84) r.prop = woodBundle(r); else r.prop = sack(r);
  } else if (kind === 'citizen') { if (c < .3) r.prop = scroll(r.handR); else if (c < .55) r.staff = staff(r.handR, '#6a4a2a', 1.75, .25); else if (c < .7) r.prop = kylix(r.handR); else if (c < .8) { const l = lyre(r.torso, -.12, .3, .32); l.rotation.set(-.2, .3, .2); hold(r, 'L', l, -.06, -.02, -.02); hold(r, 'R', l, .04, .14, .04); r.prop = l; } }
  else if (kind === 'merchant') { if (c < .4) hydria(r, false); else if (c < .65) r.prop = sack(r, '#a8885a'); else r.prop = scroll(r.handR, '#d8c48e'); }
  else if (kind === 'traveller') { r.staff = staff(r.handR, '#6a4a2a', 1.8, .3); if (c < .5) r.prop = sack(r, '#9a8462'); }
  return done(r);
}

// ======================================================================================
// round 33 (NPC, Roy's NPC addendum: "a sailor in a coastal settlement should not be dressed like a desert priest"):
// the folk of the other lands. Attica (and the mainland round it) keeps the kit above exactly as it was; these regions
// draw from their own trades, cloth, cuts and headwear (npcs.js REGIONS says which town is which):
//   isles   the Aegean and Ionian islands: sun-bleached linen and sea blues, sailors in short exomis tunics and felt pilos
//           caps with a coil of rope or an oar, island women veiled against the wind, many barefoot
//   crete   Minoan: men bare-chested in short patterned kilts with a thick rolled belt and long black locks, women in
//           tiered flounced skirts and short-sleeved bodices, bright reds, saffrons and blues, gold at the arms
//   north   Thessaly, Macedonia, Epirus and Olympus: wool in browns, greens and greys, long sleeves, boots, cloaks pinned
//           at the shoulder, the flat Macedonian kausia or a petasos, herders with a fleece over the shoulder
//   sparta  Laconia: short tunics, the crimson cloak, long-haired bearded men (no moustache), soldiers with the red
//           crest and a bronze shield slung on the back, women in the short Spartan peplos
// The first draw is still the sex, so a townsman's name (poi.js, by sex) never changes with the land he lives in.
// ======================================================================================
const RLOOK = {
  isles: { cloth: ['#e8e4da', '#d6d0c0', '#3f6f9a', '#2e4f7a', '#c9b58a', '#8a6a48', '#5a7a8a', '#e0d4b4', '#4e6e8e', '#b8a27a'],
    fine: ['#f2efe8', '#3f6fb0', '#2e4f8a', '#e8e2d2', '#c9a24a', '#2f8a86', '#7b4a9a'], trims: ['#2e4f8a', '#e0b040', '#b8372f', '#e8e0cc', '#2f8a86', '#1e2a4a'],
    kindsM: ['sailor', 'sailor', 'sailor', 'worker', 'citizen', 'merchant'], kindsF: ['peplos', 'veiled', 'veiled', 'chiton', 'veiled'], bare: .45 },
  crete: { cloth: ['#c84a2a', '#e0a030', '#2e5fa0', '#e8dcc0', '#8a3a2e', '#d07a2a', '#3a7a6a', '#f0e6cc'],
    fine: ['#e04a2a', '#f0b030', '#2e6fc0', '#f2eee4', '#7a3a8a', '#2a9a8a'], trims: ['#1e2a5a', '#e0b040', '#b8372f', '#f2eee4', '#2a2622', '#2a9a8a'],
    kindsM: ['kilt', 'kilt', 'kilt', 'citizen', 'merchant'], kindsF: ['flounce', 'flounce', 'flounce', 'chiton'], bare: .55,
    skinsM: ['#b8764a', '#a9683e', '#c4865a', '#9a5e38', '#b07048'], skinsF: ['#f0caa8', '#eabf9c', '#e3b48e', '#deac86'], hairM: ['#1a1412', '#1e1612', '#2a1c14', '#14100e'] },
  north: { cloth: ['#6a5a42', '#7a4a3a', '#5a6a4a', '#4e5a6a', '#8a6a48', '#6b4a2e', '#5a3a2a', '#7a7a6a', '#8a7a5a'],
    fine: ['#8a3a2e', '#4a6a3a', '#3a4a6a', '#a0522d', '#c9b58a', '#6a4a6a'], trims: ['#c9963c', '#2a2622', '#8a2a2a', '#e8e0cc', '#3f5a3a'],
    kindsM: ['traveller', 'herder', 'worker', 'worker', 'citizen', 'herder'], kindsF: ['peplos', 'veiled', 'chiton', 'peplos', 'veiled'], bare: .1,
    skinsM: ['#eabf9c', '#deac86', '#f0caa8', '#cf9a74', '#e3b48e'], skinsF: ['#f0caa8', '#eabf9c', '#e3b48e', '#f4d2b4'] },
  sparta: { cloth: ['#9a2a24', '#b8372f', '#8a6a48', '#c9b58a', '#7a4a3a', '#6a5a42', '#e0d4b4'],
    fine: ['#b42a2a', '#d8c8a0', '#8a2a2a', '#e8e0cc', '#c9963c'], trims: ['#c9963c', '#2a2622', '#e8e0cc', '#7a1e1a'],
    kindsM: ['soldier', 'soldier', 'citizen', 'worker', 'traveller'], kindsF: ['spartan', 'spartan', 'peplos', 'spartan'], bare: .3 },
};
function regionLook(seed, region) {
  const P = RLOOK[region], R = rng(seed + 17);
  const female = R() < .46, roll = R(), elder = roll > .8, child = !elder && roll < .09;
  const kind = child ? 'child' : elder ? 'elder' : pick(R, female ? P.kindsF : P.kindsM);
  const skin = pick(R, (female ? P.skinsF : P.skinsM) || SKINS), hair = elder ? pick(R, GREYS) : pick(R, !female && P.hairM || (female ? HAIRS_F : HAIRS));
  const fine = kind === 'citizen' || kind === 'chiton' || kind === 'merchant' || kind === 'flounce' || R() < .25;
  const c1 = pick(R, fine ? P.fine : P.cloth), c2 = other(R, fine ? P.fine : P.cloth, c1), trim = other(R, P.trims, c1);
  return { R, female, elder, child, kind, skin, hair, fine, c1, c2, trim, region };
}
function kausia(r, col) { // the Macedonian felt beret: a wide flat crown over a rolled band
  const c = ball(r.head, .25, col, 0, .37, -.04, 1, kx('felt', col)); c.scale.set(1.08, .36, 1.08);
  const b = turn(tcyl(r.head, .226, .232, .06, shade(col, .82), 0, .32, -.03, 12, kx('felt', shade(col, .82)))); b.scale.z = 1.03;
  return c;
}
function fleece(r, col = '#ece4cc') { // a sheepskin over the left shoulder
  const f = tcyl(r.torso, .27, .34, .3, col, 0, .48, -.02, 10, kx('fleece', col)); f.scale.z = .8; f.rotation.z = -.22;
  for (let i = 0; i < 7; i++) { const a = -1.2 + i * .4; ball(r.torso, .06, i % 2 ? col : shade(col, .92), Math.sin(a) * .3 - .03, .36 + (i % 3) * .05, Math.cos(a) * .25, PXART ? 1 : 0, kx('fleece', col, { noShadow: true })); }
}
function ropeCoil(r, col = '#b8a074') { const t = torus(r.torso, .16, .035, col, -.04, .42, .02); t.rotation.set(0, 0, .95); return t; } // over the shoulder, across the chest
function oar(r) {
  const t = new THREE.Group(); r.torso.add(t); t.position.set(.2, .66, -.1); t.rotation.set(-.3, 0, -.38);
  tcyl(t, .025, .028, 1.9, '#8a6a42', 0, -.1, 0, 5, kx('wood', '#8a6a42')); box(t, .16, .5, .03, '#9a7a4a', 0, .95, 0, kx('wood', '#9a7a4a'));
  hold(r, 'R', t, 0, -.22, .02); r.prop = t; return t;
}
function regionVillager(seed, region) {
  const L = villagerLook(seed, region), { R, female, elder, child, kind, skin, hair, c1, c2, trim } = L, P = RLOOK[region];
  const bareFoot = R() < (child ? .6 : P.bare * .7), north = region === 'north', crete = region === 'crete', isles = region === 'isles', sparta = region === 'sparta';
  const bareChest = kind === 'kilt' || kind === 'sailor' && R() < .55 || kind === 'worker' && R() < (crete ? .7 : .4);
  const boot = north && !child && !bareFoot ? pick(R, BOOTS) : null;
  const r = humanoid({
    skin, top: bareChest ? skin : kind === 'soldier' ? '#e6dcc0' : kind === 'flounce' ? c2 : c1, bottom: c1, legs: skin, boots: boot || skin,
    sleeve: north && !bareChest && !child ? c1 : kind === 'flounce' ? c2 : null,
    eyes: pick(R, ['#3a2a1e', '#4a3a28', '#2a3a4a', '#3a4a2e', '#5a3a1e']), brow: shade(hair, elder ? .75 : .85), browTilt: .06 + R() * .2,
    lips: female ? pick(R, ['#b05a50', '#a04a48', '#c0605a', '#9a4a4a']) : '#8a5a4a', liner: female ? '#3a2420' : null,
    scale: child ? .72 + R() * .06 : (female ? .93 : 1) + (R() - .5) * .08,
  });
  r.info = { female, elder, child, seed, kind, region }; r.npc = true;
  if (elder) setFace(r, { old: true });
  const chest = r.torso.children[1];
  if (female) { lashes(r); chest.scale.x = .93; }
  if (child) r.head.scale.setScalar(1.13);
  { const R2 = rng(seed * 7 + 3), w = .9 + R2() * .2, hgt = .96 + R2() * .08; if (!child) { chest.scale.x *= w * (crete && !female ? .94 : 1); r.root.scale.multiplyScalar(hgt); } }
  if (kind === 'kilt') pecs(r, skin, 1); // (the bare chest's own shape)
  if (!bareFoot && !boot) sandals(r, pick(R, ['#5a3a22', '#4a2e1a', '#6a4428']), pick(R, ['#7a4e2a', '#8a5a30', '#5a3a22']), female && R() < .5);
  else if (boot) boots(r, boot, north ? shade(c1, .9) : null);
  const belted = (y, w, col = pick(R, ['#5a3a24', '#7a5a3a', '#c8b48a', '#3a2a1e', trim])) => belt(r, col, y, null, w);
  // ---- clothes ----
  if (kind === 'kilt') { // Minoan: a short wrapped kilt with a patterned hem, a thick rolled belt cinching the waist
    chiton(r, c1, { y0: .14, y1: -.3, top: .2, bot: .27, trim, key: R() < .6 ? c2 : null });
    const rb = turn(tcyl(r.torso, .2, .2, .08, c2, 0, .14, 0, 12, kx('belt', c2))); rb.scale.z = .82; hem(r, trim, .17, .205, .82, .02); hem(r, trim, .11, .205, .82, .02);
    const fl = box(r.torso, .12, .22, .03, c1, 0, -.08, .23, kx('robeS', c1)); fl.rotation.x = -.12; // the kilt's front flap
    armband(r, '#e0b040'); bangles(r, '#e0b040'); if (R() < .5) necklace(r, '#e0b040', pick(R, ['#2e6fc0', '#b8372f']));
  } else if (kind === 'flounce') { // tiered flounces, each edged, under a short-sleeved bodice laced at the front
    const tiers = [[.06, -.24, .21, .28, c1], [-.2, -.52, .26, .33, c2], [-.48, -.82, .3, .38, c1]];
    for (const [y0, y1, top, bot, col] of tiers) chiton(r, col, { y0, y1, top, bot, trim });
    bust(r, c2); neckTrim(r, trim); sleeveTrim(r, trim);
    const rb = turn(tcyl(r.torso, .2, .2, .07, trim, 0, .12, 0, 12, kx('belt', trim))); rb.scale.z = .8;
    for (let i = 0; i < 3; i++) box(r.torso, .12, .012, .02, '#e0b040', 0, .42 - i * .07, .185, kx('gold', '#e0b040', { noShadow: true })); // the bodice's laces
    necklace(r, '#e0b040', '#2e6fc0'); bangles(r, '#e0b040');
  } else if (kind === 'spartan') { // the short Spartan peplos, open at the side, pinned at the shoulders
    chiton(r, c1, { y1: -.5, trim: R() < .5 ? trim : null }); overfold(r, shade(c1, 1.06), trim); bust(r, shade(c1, 1.06));
    belted(.3, .035); neckTrim(r, trim);
    for (const sx of [-1, 1]) ball(r.torso, .03, '#c9963c', sx * .17, .6, .1, 0, kx('gem', '#c9963c', { noShadow: true }));
  } else if (kind === 'sailor') { // a short exomis knotted on one shoulder, a sash, often a rope coil
    if (bareChest) { chiton(r, c1, { y0: .3, y1: -.38, top: .25, trim: R() < .5 ? trim : null }); drape(r, c1, null, -.78, .2, .42); pecs(r, skin, .95); }
    else { chiton(r, c1, { y1: -.4, trim: R() < .5 ? trim : null }); neckTrim(r, shade(c1, .8)); }
    belted(.12, .06, pick(R, [c2, trim, '#3a2a1e']));
    if (R() < .4) bracer(r, '#6a4a2c', 'LR', .12);
  } else if (kind === 'herder') { // a short wool tunic, a fleece over the shoulder
    chiton(r, c1, { y1: -.46, trim: R() < .4 ? trim : null }); fleece(r, pick(R, ['#ece4cc', '#d8ccb0', '#5a4a3a'])); belted(.12, .05);
  } else if (kind === 'peplos') {
    chiton(r, c1, { trim, key: R() < .4 ? c2 : null }); overfold(r, shade(c1, 1.06), trim); bust(r, shade(c1, 1.06)); belted(.3, .035); neckTrim(r, trim);
    if (R() < .45 || north) drape(r, c2, trim, (R() < .5 ? -1 : 1) * .72, .17, .36);
  } else if (kind === 'chiton') {
    chiton(r, c1, { trim: R() < .7 ? trim : null }); bust(r, c1); belted(.3, .03, trim); neckTrim(r, trim); sleeveTrim(r, trim);
    drape(r, c2, R() < .6 ? trim : null, -.72, .2, .3); wrapSkirt(r, c2, null, -.82);
  } else if (kind === 'veiled') {
    chiton(r, c1, { trim }); bust(r, c1); belted(.3, .03); neckTrim(r, trim); drape(r, c2, trim, .72, .2, .34);
  } else if (kind === 'worker') {
    if (bareChest) { chiton(r, c1, { y0: .3, y1: -.42, top: .25, trim: R() < .4 ? trim : null }); drape(r, c1, null, -.78, .2, .42); pecs(r, skin, .95); }
    else { chiton(r, c1, { y1: -.42, trim: R() < .5 ? trim : null }); neckTrim(r, shade(c1, .8)); }
    belted(.12, .055); if (R() < .5) pouch(r, pick(R, BOOTS), R() < .5 ? 1 : -1);
  } else if (kind === 'citizen' || kind === 'merchant' || kind === 'traveller') {
    const long = kind === 'merchant' || (kind === 'citizen' && R() < .6 && !sparta);
    chiton(r, c1, { y1: long ? -.78 : -.44, trim, key: kind === 'merchant' ? c2 : null }); neckTrim(r, trim);
    if (kind === 'citizen') drape(r, c2, trim, -.74, .22, .34);
    belted(.12, kind === 'merchant' ? .08 : .045, trim); if (kind === 'merchant') { pouch(r, '#7a4a28', 1); pouch(r, '#5a3a24', -1); }
    if (kind === 'traveller') bracer(r, '#6a4a2c', 'LR', .12);
  } else if (kind === 'soldier') {
    const cloak = sparta ? pick(R, ['#a8261e', '#b42a2a', '#8a1e1a']) : pick(R, ['#b42a2a', '#2e4f8a']);
    chiton(r, cloak, { y1: -.4, trim: null });
    const lc = turn(tcyl(r.torso, .27, .23, .44, sparta ? '#c9963c' : '#e6dcc0', 0, .36, 0, 8, kx(sparta ? 'cuirass' : 'linen', sparta ? '#c9963c' : '#e6dcc0'))); lc.scale.z = .78;
    hem(r, trim, .52, .265, .78, .04); hem(r, trim, .17, .238, .78, .03);
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, sc = i % 2 ? '#7a4a28' : '#8a5a30', st = box(r.torso, .075, .2, .03, sc, Math.sin(a) * .25, -.06, Math.cos(a) * .22, kx('strip', sc)); st.rotation.y = a; }
    belted(.14, .05, '#6a4428'); greaves(r);
    if (sparta) { const sh = roundShield(r.torso, .36, '#c9963c', '#7a4a1e', { boss: '#a8261e', rivets: '#e8c870' }); sh.position.set(0, .3, -.3); sh.rotation.y = PI / 2; }
  } else if (kind === 'elder') {
    chiton(r, c1, { trim: female ? trim : null }); if (female) bust(r, c1);
    drape(r, c2, trim, female ? .72 : -.74, .22, .34); if (!female) wrapSkirt(r, c2, trim, -.82);
    belted(.14, .04); r.lean = .08 + R() * .12;
  } else { const col = pick(R, P.fine); chiton(r, col, { y1: female ? -.6 : crete && !female ? -.3 : -.38, trim: R() < .6 ? trim : null }); belted(female ? .28 : .12, .04); }
  // a cloak against the weather (the north) or the crimson (Sparta)
  if (!child && (north && R() < .6 || sparta && !female && kind !== 'soldier' && R() < .7) && kind !== 'herder' && kind !== 'kilt' && kind !== 'flounce')
    chlamys(r, sparta ? pick(R, ['#a8261e', '#b42a2a', '#8a1e1a']) : pick(R, [c2, '#5a3a2a', '#4e5a6a', '#6a5a42']), north ? trim : null, north ? .82 : .7);
  if (kind === 'soldier') chlamys(r, sparta ? '#a8261e' : '#b42a2a', null, .75);
  // ---- hair, beard, headwear ----
  let hat = false;
  if (female) {
    const hs = crete ? pick(R, ['locks', 'locks', 'curls']) : elder ? pick(R, ['bun', 'veil']) : child ? pick(R, ['braids', 'pony', 'long']) : pick(R, ['bun', 'long', 'pony', 'braids', 'bun']);
    if (kind === 'veiled' || hs === 'veil' || isles && !child && R() < .3) { hairCap(r, hair, { h: .84, locks: 'part' }); veil(r, kind === 'veiled' ? c2 : pick(R, [c2, '#2e4f7a', '#e8e4da']), trim); hat = true; }
    else if (hs === 'locks') { curls(r, hair, { n: 9, s: .055, top: false, back: 5 }); locks(r, hair, .6 + R() * .15, 3); fillet(r, pick(R, [trim, '#e0b040']), .33); }
    else if (hs === 'bun') { curls(r, hair, { n: 7, s: .05, top: false, back: 4 }); bun(r, hair, .38, -.16); if (R() < .7) fillet(r, pick(R, [trim, '#e0b040', c2]), .33); }
    else if (hs === 'long') { hairCap(r, hair, { h: .86, fringe: R() < .3, locks: 'part' }); locks(r, hair, .55 + R() * .2, 2); }
    else if (hs === 'pony') { hairCap(r, hair, { h: .84, locks: 'part' }); ponytail(r, hair, trim); }
    else if (hs === 'braids') { hairCap(r, hair, { h: .84, locks: 'part' }); braids(r, hair, trim, child ? 4 : 6); }
    else { curls(r, hair, { n: 9, s: .062 }); locks(r, hair, .35, 2, true); }
    if (!hat && R() < (crete ? .6 : .3)) flowerHair(r, pick(R, FLOWERS), R() < .5 ? -.17 : .17);
    if (!child && R() < (crete ? .8 : .45)) earrings(r);
  } else {
    const bald = elder && R() < .5;
    const hs = bald ? 'bald' : crete || sparta ? 'long' : child ? 'curls' : pick(R, ['short', 'curls', 'curls', 'short']);
    if (hs === 'bald') baldFringe(r, hair, skin);
    else if (hs === 'curls') curls(r, hair, { n: 8 + Math.floor(R() * 3), s: .055 + R() * .015, h: .78 });
    else if (hs === 'long') { curls(r, hair, { n: 8, s: .055, h: .8, top: !sparta }); locks(r, hair, crete ? .55 : .42, crete ? 3 : 2, false); }
    else hairCap(r, hair, { h: .7 + R() * .12, fringe: R() < .35 });
    if (!child) {
      const bk = elder ? 'long' : crete ? (R() < .8 ? 'none' : 'short') : sparta ? 'spartan' : north ? pick(R, ['full', 'full', 'short', 'long']) : pick(R, ['none', 'short', 'full', 'goatee']);
      const bc = elder ? pick(R, GREYS) : shade(hair, 1.05);
      if (bk === 'long') beard(r, bc, .3 + R() * .15, 1.05);
      else if (bk === 'full') { beard(r, bc, .2 + R() * .08, 1.08); for (const sx of [-1, 0, 1]) ball(r.head, .055, bc, sx * .07, .01 + Math.abs(sx) * .03, .15, 0, { noShadow: true }); }
      else if (bk === 'spartan') { const { mu } = beard(r, bc, .28, 1.05); mu.visible = false; } // the Spartan beard: no moustache
      else if (bk === 'short') beard(r, bc, .08, .95);
      else if (bk === 'goatee') { const g = box(r.head, .07, .1, .06, bc, 0, .02, .17); g.rotation.x = .25; }
    }
    if (kind === 'soldier') { corinth(r, '#c9963c', sparta ? '#a8261e' : pick(R, ['#b42a2a', '#1e1a18'])); hat = true; }
    else if (!child && (kind === 'sailor' || isles && R() < .35)) { pilos(r, pick(R, ['#2e4f7a', '#8a5a34', '#5a6a7a', '#a0522d', '#e8e4da'])); hat = true; }
    else if (!child && north && R() < .6) { if (R() < .6) kausia(r, pick(R, ['#5a4a3a', '#7a5a3a', '#4a4a3a', '#8a2a2a'])); else petasos(r, pick(R, ['#c8a868', '#b8985a', '#7a5a3a']), '#5a3a24', (R() - .5) * .2); hat = true; }
    if (!hat && crete && R() < .6) fillet(r, pick(R, [trim, '#e0b040']), .32);
    else if (!hat && (kind === 'citizen' || elder) && R() < .4) wreath(r, pick(R, ['#5a8a3a', '#4a7a32']), .33, null, '#3e6a2a');
  }
  // ---- something to carry ----
  const c = R();
  if (elder) { if (R() < .75) { const st = staff(r.handR, pick(R, ['#6a4a2a', '#7a5a34', '#5a3a22']), 1.75, .25); r.staff = st; } else scroll(r.handR); }
  else if (child) { if (c < .35) { const b = ball(r.handR, .07, pick(R, ['#c84a3a', '#3f6fb0', '#e0b040']), 0, -.08, .05, 1); r.prop = b; } }
  else if (kind === 'soldier') { const sp = staff(r.handR, '#6a4a2a', 2.4, .4); cone(sp, .055, .26, '#c9963c', 0, 1.72, .03, 4, kx('gold', '#c9963c')); r.spear = sp; }
  else if (kind === 'sailor') { if (c < .35) oar(r); else if (c < .7) r.prop = ropeCoil(r); else { const b = basket(r.torso, -.34, -.02, .14); hold(r, 'L', b, .02, .02, .02); r.prop = b; } }
  else if (kind === 'herder') { const ck = staff(r.handR, '#7a5a34', 1.9, .35); let p = pivot(ck, 0, 1.3, .03); for (let i = 0; i < 4; i++) { tcyl(p, .03, .032, .1, '#7a5a34', 0, .05, 0, 5, kx('wood', '#7a5a34')); p = pivot(p, 0, .09, 0); p.rotation.z = .62; } r.staff = ck; }
  else if (female) {
    if (c < .25) hydria(r, true); else if (c < .4) hydria(r, false);
    else if (c < .58) { const b = basket(r.torso, -.34, -.02, .14); hold(r, 'L', b, .02, .02, .02); r.prop = b; }
    else if (c < .68) r.prop = distaff(r.handL); else if (c < .78) breadTray(r);
  } else if (kind === 'worker' || kind === 'kilt') {
    if (c < .4) toolOnShoulder(r, pick(R, ['hoe', 'rake', 'fork', 'pick'])); else if (c < .55) hydria(r, false);
    else if (c < .7) r.prop = woodBundle(r); else if (c < .82) r.prop = sack(r);
  } else if (kind === 'citizen') { if (c < .35) r.prop = scroll(r.handR); else if (c < .6) r.staff = staff(r.handR, '#6a4a2a', 1.75, .25); }
  else if (kind === 'merchant') { if (c < .5) hydria(r, false); else r.prop = sack(r, '#a8885a'); }
  else if (kind === 'traveller') { r.staff = staff(r.handR, '#6a4a2a', 1.8, .3); if (c < .5) r.prop = sack(r, '#9a8462'); }
  return done(r);
}
export function makeBlacksmith() {
  const SK = '#c08a62', LEATHER = '#6a4428', IRON = '#4a4c54', SOOT = '#3a3634';
  const r = humanoid({ skin: SK, top: SK, bottom: '#4a4038', legs: SK, boots: '#3a2a1e', sleeve: null, eyes: '#3a2a1e', brow: '#1e1612', browTilt: .3, lips: '#7a4a3a', scale: 1.08 }); r.npc = true;
  pecs(r, SK, 1.15); r.torso.children[1].scale.x = 1.08;
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) box(r.torso, .07, .05, .03, '#a87452', sx * .045, .3 - i * .07, .165, { noShadow: true });
  // curly black hair and beard, felt pilos cap (Hephaestus' own)
  curls(r, '#1e1612', { n: 8, s: .055, h: .74 });
  pilos(r, '#5a4a3e');
  beard(r, '#1e1612', .24, 1.1); for (const sx of [-1, 0, 1]) ball(r.head, .055, '#1e1612', sx * .07, -.01 + Math.abs(sx) * .03, .15, PXART ? 1 : 0, kx('curl', '#1e1612', { noShadow: true }));
  box(r.head, .04, .02, .012, SOOT, .1, .18, .198, { noShadow: true }); box(r.head, .03, .02, .012, SOOT, -.08, .3, .19, { noShadow: true });
  // short work skirt, heavy leather apron with a pocket and rivets
  chiton(r, '#5a5048', { y1: -.42, trim: null });
  const ap = turn(tcyl(r.torso, .235, .31, .95, LEATHER, 0, -.08, .03, 10, kx('apron', LEATHER))); ap.scale.z = .88;
  box(r.torso, .32, .32, .04, LEATHER, 0, .42, .17, kx('apron', LEATHER));
  box(r.torso, .18, .12, .02, shade(LEATHER, .8), .06, .05, .27, kx('strap', shade(LEATHER, .8), { noShadow: true }));
  for (const [x, y] of [[-.12, .55], [.12, .55], [-.12, .3], [.12, .3]]) ball(r.torso, .018, '#b8b0a0', x, y, .195, 0, kx('gem', '#b8b0a0', { noShadow: true }));
  for (const sx of [-1, 1]) strap(r.torso, [sx * .14, .56, .17], [sx * .12, .68, -.05], .04, .03, '#4a2e1c');
  belt(r, '#3a2416', .1, '#9a9aa2', .07);
  bracer(r, '#4a2e1c', 'LR', .16); bangles(r, '#8a8c94', 'L');
  boots(r, '#3a2a1e');
  for (const K of [r.kneeL, r.kneeR]) turn(tcyl(K, .084, .078, .26, '#3a2a1e', 0, -.12, 0, PXART ? 8 : 6, kx('boot', '#3a2a1e')));
  // hammer and tongs
  const hm = new THREE.Group(); r.handR.add(hm); hm.rotation.x = -1.05;
  tcyl(hm, .025, .03, .42, '#6a4a2a', 0, 0, .1, 5, kx('wood', '#6a4a2a')).rotation.x = PI / 2;
  box(hm, .1, .1, .22, IRON, 0, 0, .32, kx('plate', IRON)).rotation.y = PI / 2;
  box(hm, .06, .06, .06, '#6a6c74', .12, 0, .32, { noShadow: true });
  const tg = new THREE.Group(); r.handL.add(tg); tg.position.set(0, -.04, .04);
  for (const sx of [-1, 1]) { const b = box(tg, .02, .5, .02, IRON, sx * .02, -.22, 0); b.rotation.z = sx * .05; }
  box(tg, .06, .05, .04, '#ff8a2a', 0, -.48, 0, { basic: true, noShadow: true });
  r.hammer = hm; r.tongs = tg;
  return done(r);
}

export function makeFisherman() {
  const SK = '#b47e54', TUN = '#4e7aa0', HAIR = '#6a5a48';
  const r = humanoid({ skin: SK, top: SK, bottom: TUN, legs: SK, boots: SK, sleeve: null, eyes: '#2a3a4a', brow: '#5a4a3a', lips: '#8a5040' }); r.npc = true;
  pecs(r, SK, .95);
  hairCap(r, HAIR, { h: .72 });
  beard(r, '#7a6a58', .18, 1.04); for (const sx of [-1, 1]) ball(r.head, .05, '#7a6a58', sx * .06, .0, .15, PXART ? 1 : 0, kx('curl', '#7a6a58', { noShadow: true }));
  // knotted red cap, exomis tunic tied on one shoulder
  const cp = ball(r.head, .215, '#a8382a', 0, .32, -.06, 1, kx('felt', '#a8382a')); cp.scale.set(1.05, .6, 1.07);
  ball(r.head, .06, '#a8382a', 0, .36, -.24, 0, kx('bun', '#a8382a')).scale.set(1, 1, 1.5);
  chiton(r, TUN, { y0: .3, y1: -.42, top: .25, trim: '#e8e0cc' });
  drape(r, TUN, null, -.78, .2, .42);
  belt(r, '#c8b48a', .12, null, .045);
  sandals(r, '#4a3020', '#6a4428');
  // net bundle over the shoulder with cork floats, a fish in hand, rod
  const net = ball(r.torso, .2, '#b8a07a', .1, .62, -.2, 1, kx('net', '#b8a07a')); net.scale.set(1.4, .8, .9);
  for (let i = 0; i < 6; i++) box(r.torso, .02, .02, .3, '#7a6448', -.12 + i * .07, .7, -.2, { noShadow: true }).rotation.z = .2;
  for (let i = 0; i < 4; i++) ball(r.torso, .035, '#d8a050', -.1 + i * .1, .5 + (i % 2) * .06, -.3, 0, kx('gem', '#d8a050', { noShadow: true }));
  const fish = new THREE.Group(); r.handL.add(fish); fish.position.set(0, -.08, .04);
  const fb = ball(fish, .06, '#a8b8c4', 0, -.12, 0, 1, kx('fish', '#a8b8c4')); fb.scale.set(.6, 2.2, 1);
  box(fish, .04, .2, .02, '#7a90a4', 0, -.12, .05, { noShadow: true });
  cone(fish, .06, .1, '#8a9cac', 0, -.3, 0, 4).rotation.x = PI;
  const rod = staff(r.handR, '#8a6a42', 2.3, .7); rod.rotation.x = -.35;
  r.fish = fish; r.rod = rod;
  return done(r);
}

export function makeShepherd() {
  const SK = '#c9946c', TUN = '#8a7a4a', WOOL = '#ece4cc';
  const r = humanoid({ skin: SK, top: TUN, bottom: TUN, legs: SK, boots: SK, sleeve: TUN, eyes: '#3a2a1e', brow: '#4a3020', lips: '#9a5a4a', scale: .98 }); r.npc = true;
  curls(r, '#4a3020', { n: 8, s: .055 });
  beard(r, '#4a3020', .08, .9);
  petasos(r, '#c8a868', '#6a4a2a', -.12);
  chiton(r, TUN, { y1: -.46, trim: '#5a4a2a' });
  // sheepskin cloak
  const fl = tcyl(r.torso, .3, .42, .52, WOOL, 0, .42, -.04, 10, kx('fleece', WOOL)); fl.scale.z = .8;
  for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2, wc = i % 2 ? WOOL : '#dcd2b6'; ball(r.torso, .075, wc, Math.sin(a) * .37, .28 + (i % 3) * .08, Math.cos(a) * .3 - .03, PXART ? 1 : 0, kx('fleece', wc, { noShadow: i % 3 !== 0 })); }
  belt(r, '#6a4a2a', .12, null, .05);
  ball(r.torso, .08, '#7a5a34', .27, -.08, .06, PXART ? 1 : 0, kx('pouch', '#7a5a34')).scale.set(.7, 1.1, .6); // water skin
  sandals(r, '#4a3020', '#6a4428', true);
  // panpipes on a cord
  const pp = pivot(r.torso, -.12, .3, .2); pp.rotation.z = .3;
  for (let i = 0; i < 5; i++) tcyl(pp, .014, .014, .16 - i * .022, '#d8b878', i * .03, -(i * .011), 0, 4, { noShadow: true });
  // crook
  const ck = staff(r.handR, '#7a5a34', 2, .4);
  let p = pivot(ck, 0, 1.38, .03);
  for (let i = 0; i < 5; i++) { tcyl(p, .03, .032, .1, '#7a5a34', 0, .05, 0, 5, kx('wood', '#7a5a34')); p = pivot(p, 0, .09, 0); p.rotation.z = .62; }
  r.crook = ck;
  return done(r);
}

export function makeElder() {
  const SK = '#d9ab86', WH = '#ece6d8', PURP = '#6a2a6a', GOLD = '#d8a838', HAIR = '#eceae4';
  const r = humanoid({ skin: SK, top: WH, bottom: WH, boots: SK, legs: SK, sleeve: WH, eyes: '#4a3a2a', brow: HAIR, browTilt: .1, lips: '#8a5a4a', old: true }); r.npc = true;
  baldFringe(r, HAIR, SK);
  beard(r, HAIR, .42, 1.1, { tilt: .1 }); ball(r.head, .08, HAIR, 0, -.2, .13, PXART ? 1 : 0, kx('beard', HAIR, { noShadow: true }));
  for (const sx of [-1, 1]) ball(r.head, .07, HAIR, sx * .19, .16, -.04, PXART ? 1 : 0, kx('curl', HAIR));
  wreath(r, '#4a7a32', .34, null, '#6a9a3a');
  // white chiton, purple-bordered himation, gold meander (a magistrate)
  chiton(r, WH, { trim: PURP, key: GOLD });
  drape(r, PURP, GOLD, -.74, .24, .34);
  wrapSkirt(r, '#efe8da', PURP, -.82);
  neckTrim(r, GOLD); sleeveTrim(r, PURP);
  belt(r, GOLD, .12, '#f0d070', .04);
  sandals(r, '#5a3a22', '#8a5a30', true);
  const st = staff(r.handR, '#5a3a22', 1.95, .3);
  ball(st, .065, GOLD, 0, 1.28, .03, 1, kx('gem', GOLD)); tcyl(st, .04, .04, .05, GOLD, 0, 1.2, .03, 6, kx('gold', GOLD, { noShadow: true }));
  r.staff = st; r.lean = .06;
  return done(r);
}

// ======================================================================================
// TOWN SERVICES: the same four trades in every town, dressed alike so V knows them on sight. The face, hair and
// build change with the seed; `tint` is the town's own colour, worn only on a trim so the uniform still reads.
//   priest      (temple or shrine: skills)          white robe, sky-blue stole, gold laurel, a lit oil lamp
//   weaponsmith (the forge: weapons)                iron-grey tunic, red headband, two swords crossed on the back, one in hand
//   armourer    (a market stall: gear)              bronze cuirass over a red chiton, helm pushed up, a bronze shield
//   trader      (the market: everything, for relics) saffron robe, deep purple hooded cloak, a big pack on the back
// ======================================================================================
function serviceBody(R, female, o = {}) {
  const skin = pick(R, SKINS), hair = o.grey ? pick(R, GREYS) : pick(R, female ? HAIRS_F : HAIRS);
  const r = humanoid({ skin, top: o.bare ? skin : o.top, bottom: o.top, legs: skin, boots: skin, sleeve: o.sleeve ?? null, eyes: pick(R, ['#3a2a1e', '#4a3a28', '#2a3a4a', '#3a4a2e']),
    brow: shade(hair, .85), browTilt: .08 + R() * .15, lips: female ? pick(R, ['#b05a50', '#a04a48', '#c0605a']) : '#8a5a4a', liner: female ? '#3a2420' : null, scale: (female ? .95 : 1.02) + (R() - .5) * .06 });
  if (female) { lashes(r); r.torso.children[1].scale.x = .93; }
  if (o.grey) setFace(r, { old: true });
  r.info = { female, kind: o.kind }; r.npc = true;
  return { r, skin, hair };
}
export function makeTemplePriest(seed = 1, tint = '#d8a838', o = {}) {
  const R = rng(seed + 401), female = R() < .5, WH = '#f2ede2', BLUE = '#3a6ab0', GOLD = '#e0b040';
  const { r, hair } = serviceBody(R, female, { top: WH, sleeve: WH, kind: 'priest', grey: R() < .35 });
  if (female) { longHair(r, hair, .6); bun(r, hair); } else { hairCap(r, hair); if (R() < .7) beard(r, hair, .3, 1); }
  wreath(r, GOLD, .34, null, '#f0d070');
  chiton(r, WH, { trim: tint, key: GOLD }); wrapSkirt(r, '#ece6d8', tint, -.82);
  sash(r, BLUE, .16, .7); neckTrim(r, GOLD); sleeveTrim(r, BLUE);
  belt(r, GOLD, .12, '#f0d070', .04); sandals(r, '#5a3a22', '#8a5a30', female);
  // a little bronze oil lamp, always lit
  const lp = new THREE.Group(); r.handL.add(lp); lp.position.set(0, -.08, .08);
  ball(lp, .07, '#c08436', 0, 0, 0, 1, kx('gem', '#c08436')).scale.set(1.3, .55, .9); box(lp, .05, .03, .1, '#c08436', 0, .01, .1, kx('plate', '#c08436'));
  const fl = cone(lp, .035, .12, '#ffb03a', 0, .07, .14, 5, { basic: true, noShadow: true }); (r.flames ||= []).push(fl);
  r.tick = flamesTick;
  if (o.broom) r.broom = broom(r.handR); // round 33 (NPC): the temple keeper sweeps the steps (npcs.js 'sweep')
  return done(r);
}
function broom(hand) { // a besom: a long handle, a bound bundle of twigs (held at its middle, the bundle down and ahead)
  const g = new THREE.Group(); hand.add(g); g.position.set(0, -.04, .03); g.rotation.x = -.35;
  tcyl(g, .02, .024, 1.35, '#8a6a42', 0, -.2, 0, 5, kx('wood', '#8a6a42'));
  const b = cone(g, .2, .46, '#d8bc70', 0, -1.0, 0, 8, kx('straw', '#d8bc70')); b.rotation.x = PI; b.scale.z = .4; // a fan of twigs
  for (const y of [-.8, -.88]) tcyl(g, .06 + (y + .8) * -.6, .07 + (y + .8) * -.6, .035, '#6a4a2a', 0, y, 0, 8, kx('belt', '#6a4a2a', { noShadow: true })).scale.z = .5;
  return g;
}
// ======================================================================================
// round 33 (NPC): three more of the people a Greek town has, each telling its trade at a glance from the game's camera
//   guard   the town watch at the gate and on the square: a crested helm worn up off the face, a cuirass, greaves, a
//           cloak, a round shield with the town's colour on its boss, a spear grounded at the foot. Laconia's in bronze
//           and crimson, the north's in dark wool, the isles' and Crete's in linen
//   scholar a philosopher or physician of the stoa: a long himation wound over a chiton, a scroll open in the hands, a
//           wax tablet and stylus at the belt, a leather case of scrolls on the back
//   farmer  the village field hand: a short tunic knotted on one shoulder, a broad straw hat, a sickle in the hand, a
//           basket of the harvest on the hip
// ======================================================================================
const GUARD_KIT = { // [cloak, cuirass, cuirass texture, crest]
  attica: ['#2e4f8a', '#e6dcc0', 'linen', '#b42a2a'], sparta: ['#a8261e', '#c9963c', 'cuirass', '#a8261e'], north: ['#4a3a2a', '#8a6a48', 'linen', '#2a2622'],
  isles: ['#2e5f8a', '#e8e4da', 'linen', '#e8e0cc'], crete: ['#c84a2a', '#e8dcc0', 'linen', '#1e2a5a'],
};
export function makeGuard(seed = 1, tint = '#b42a2a', region = 'attica') {
  const R = rng(seed + 907), female = R() < .2, K = GUARD_KIT[region] || GUARD_KIT.attica, BR = '#c9963c';
  const { r, hair } = serviceBody(R, female, { top: K[0], kind: 'guard' });
  if (female) { hairCap(r, hair, { locks: 'part' }); ponytail(r, hair, tint); } else { curls(r, hair, { n: 8, s: .055, h: .74 }); if (R() < .7) beard(r, hair, .16 + R() * .1, 1.05); }
  corinth(r, BR, K[3], true);
  chiton(r, K[0], { y1: -.4, trim: tint });
  const cu = turn(tcyl(r.torso, .27, .23, .44, K[1], 0, .36, 0, 8, kx(K[2], K[1]))); cu.scale.z = .78;
  hem(r, tint, .52, .265, .78, .04); hem(r, BR, .17, .238, .78, .03);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, sc = i % 2 ? '#7a4a28' : '#8a5a30', st = box(r.torso, .075, .2, .03, sc, Math.sin(a) * .25, -.06, Math.cos(a) * .22, kx('strip', sc)); st.rotation.y = a; }
  for (const sx of [-1, 1]) box(r.torso, .12, .05, .3, K[1], sx * .17, .6, 0, kx('strap', K[1]));
  belt(r, '#5a3a22', .14, BR, .06); greaves(r, BR); boots(r, '#5a3a22');
  chlamys(r, K[0], tint, .8);
  const sh = roundShield(r.elbowL, .36, BR, '#7a4a1e', { boss: tint, rivets: '#e8c870' }); sh.position.set(-.12, -.12, .04); r.shield = sh;
  const sp = staff(r.handR, '#5a3a22', 2.5, .45); cone(sp, .05, .28, '#d0d6e0', 0, 1.85, .03, 4, kx('gold', '#d0d6e0')); tcyl(sp, .035, .03, .1, BR, 0, -.78, .03, 5, kx('gold', BR, { noShadow: true })); r.spear = sp;
  return done(r);
}
export function makeScholar(seed = 1, region = 'attica') {
  const R = rng(seed + 1013), female = R() < .3, WOOL = pick(R, ['#e8e2d2', '#d8d0bc', '#c8c4b4', '#e0d4b4']), BORD = pick(R, ['#3a4a6a', '#6a2a3a', '#2a5a5a', '#5a4a2a']);
  const { r, hair, skin } = serviceBody(R, female, { top: WOOL, sleeve: WOOL, kind: 'scholar', grey: R() < .6 });
  if (female) { curls(r, hair, { n: 7, s: .05, top: false, back: 4 }); bun(r, hair, .38, -.16); fillet(r, BORD, .33); }
  else { if (R() < .55) baldFringe(r, hair, skin); else hairCap(r, hair, { h: .74 }); beard(r, hair, .26 + R() * .16, 1.05, { tilt: .08 }); }
  chiton(r, WOOL, { trim: null }); if (female) bust(r, WOOL);
  drape(r, shade(WOOL, .92), BORD, -.74, .26, .34); wrapSkirt(r, shade(WOOL, .92), BORD, -.82); neckTrim(r, BORD);
  belt(r, '#5a3a22', .14, null, .04); sandals(r, '#5a3a22', '#7a4e2a', female);
  const tb = box(r.torso, .14, .18, .025, '#8a6a42', .18, .02, .17, kx('wood', '#8a6a42')); tb.rotation.set(.08, .45, .1); // a wax tablet at the belt
  box(r.torso, .1, .13, .01, '#3a3226', .18 + .012, .02, .186, { noShadow: true }).rotation.set(.08, .45, .1);
  const case_ = tcyl(r.torso, .08, .08, .42, '#6a4428', -.1, .46, -.28, 8, kx('belt', '#6a4428')); case_.rotation.z = .5; // a case of scrolls on the back
  for (let i = 0; i < 3; i++) { const e = tcyl(r.torso, .025, .025, .05, '#e8d8a8', -.1 - .2 * Math.sin(.5) + (i - 1) * .04, .46 + .2 * Math.cos(.5) + .02, -.28 + (i - 1) * .02, 5, kx('paper', '#e8d8a8', { noShadow: true })); e.rotation.z = .5; }
  strap(r.torso, [.2, .62, .1], [-.2, .12, .17], .035, .02, '#5a3a22', { noShadow: true });
  // an open scroll, read with both hands at the chest: two rolls and the sheet between
  const sc = new THREE.Group(); r.torso.add(sc); sc.position.set(0, .22, .34); sc.rotation.x = -.75;
  box(sc, .26, .2, .006, '#efe2b8', 0, 0, 0, kx('paper', '#efe2b8', { noShadow: true }));
  for (const sx of [-1, 1]) { const k = tcyl(sc, .028, .028, .24, '#e8d8a8', sx * .14, 0, 0, 6, kx('paper', '#e8d8a8')); for (const e of [-1, 1]) tcyl(k, .018, .018, .03, '#8a5a2a', 0, e * .13, 0, 5, { noShadow: true }); }
  hold(r, 'L', sc, -.14, -.02, .02); hold(r, 'R', sc, .14, -.02, .02); r.prop = sc; r.reading = sc;
  return done(r);
}
export function makeFarmer(seed = 1, region = 'attica') {
  const R = rng(seed + 1117), female = R() < .4, c1 = pick(R, ['#a08a5a', '#8a6a48', '#6b7a4a', '#b8a27a', '#7a4a3a']), HAT = pick(R, ['#d8c088', '#c8a868', '#e0cc94']);
  const { r, hair, skin } = serviceBody(R, female, { top: c1, bare: !female, kind: 'farmer' });
  if (female) { hairCap(r, hair, { h: .84, locks: 'part' }); bun(r, hair, .36, -.17); }
  else { hairCap(r, hair, { h: .74 }); if (R() < .6) beard(r, shade(hair, 1.05), .1 + R() * .1, 1); }
  petasos(r, HAT, '#7a5a3a', (R() - .5) * .2);
  if (female) { chiton(r, c1, { y1: -.7, trim: null }); bust(r, c1); belt(r, '#6a4a2a', .3, null, .035); const ap = box(r.torso, .34, .5, .03, '#d8ccb0', 0, -.2, .27, kx('robeS', '#d8ccb0')); ap.rotation.x = -.08; } // and a work apron
  else { chiton(r, c1, { y0: .3, y1: -.42, top: .25, trim: null }); drape(r, c1, null, -.78, .2, .42); pecs(r, skin, .95); belt(r, '#6a4a2a', .12, null, .05); }
  if (R() < .5) sandals(r, '#4a3020', '#6a4428'); else boots(r, '#5a3e28');
  const sk = new THREE.Group(); r.handR.add(sk); sk.position.set(0, -.04, .04); sk.rotation.x = -1.2; // a sickle
  tcyl(sk, .02, .022, .18, '#7a5a3a', 0, .06, 0, 5, kx('wood', '#7a5a3a'));
  const bl = torus(sk, .15, .024, '#c8ccd4', 0, .28, .12, { arc: PI * 1.15 }); bl.rotation.set(0, PI / 2, -.5); bl.scale.x = .5;
  const b = basket(r.torso, -.34, -.02, .14); hold(r, 'L', b, .02, .02, .02); r.prop = b; r.sickle = sk;
  return done(r);
}
export function makeArmourer(seed = 1, tint = '#b42a2a') {
  const R = rng(seed + 502), female = R() < .35, RED = '#9a2a24', BRONZE = '#c9963c';
  const { r, hair } = serviceBody(R, female, { top: RED, kind: 'armourer' });
  if (female) { longHair(r, hair, .45); } else { curls(r, hair, { n: 8, s: .055, h: .74 }); if (R() < .6) beard(r, hair, .2, 1.05); }
  corinth(r, BRONZE, tint, true);
  chiton(r, RED, { y1: -.42, trim: BRONZE });
  const cu = turn(tcyl(r.torso, .26, .23, .46, BRONZE, 0, .36, 0, 8, kx('cuirass', BRONZE))); cu.scale.z = .8; // muscle cuirass
  for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2, sc = i % 2 ? '#7a4a28' : '#8a5a30', st = box(r.torso, .075, .2, .03, sc, Math.sin(a) * .24, -.04, Math.cos(a) * .2, kx('strip', sc)); st.rotation.y = a; }
  bracer(r, '#7a4a28', 'LR', .15); boots(r, '#5a3a22'); greaves(r, BRONZE);
  // gear, not weapons: a bronze shield on the arm (the swords are the weaponsmith's)
  const sh = roundShield(r.elbowL, .34, BRONZE, '#7a4a1e', { boss: tint, rivets: '#e8c870' }); sh.position.set(-.12, -.12, .04); r.shield = sh;
  return done(r);
}
export function makeWeaponsmith(seed = 1, tint = '#b42a2a') {
  const R = rng(seed + 704), female = R() < .35, IRON = '#4e5260', LEATHER = '#5a3a22', STEEL = '#d0d6e0';
  const { r, hair } = serviceBody(R, female, { top: IRON, kind: 'weaponsmith' });
  if (female) { hairCap(r, hair, { locks: 'part' }); ponytail(r, hair, '#b42a2a'); } else { curls(r, hair, { n: 8, s: .055, h: .74 }); if (R() < .6) beard(r, hair, .2, 1.05); }
  fillet(r, '#c0302a', .3); // the red headband of the forge
  chiton(r, IRON, { y1: -.42, trim: tint });
  // two baldrics crossing the chest, and the two swords they carry crossed on the back (the sign's own blades)
  for (const sx of [-1, 1]) strap(r.torso, [sx * .19, .6, .15], [-sx * .2, .02, .15], .055, .03, LEATHER);
  const bk = pivot(r.torso, 0, .62, -.24);
  for (const sx of [-1, 1]) { const p = pivot(bk, 0, 0, 0); p.rotation.z = sx * .8; const s = sword(p, STEEL, .62); s.rotation.x = PI / 2; s.position.y = .24; }
  belt(r, LEATHER, .12, '#b8b0a0', .07); pouch(r, LEATHER, -1);
  bracer(r, LEATHER, 'LR', .16); boots(r, LEATHER);
  for (const K of [r.kneeL, r.kneeR]) turn(tcyl(K, .084, .078, .24, LEATHER, 0, -.12, 0, PXART ? 8 : 6, kx('boot', LEATHER)));
  // a fresh blade in hand, held out point first
  const hs = sword(r.handR, STEEL, .66); hs.rotation.x = -1.15; r.blade = hs;
  return done(r);
}
// round 28 (Roy): the fusion NPC of every town, the alchemist: a sea-green robe with a violet sash, a wreath of herbs and a leather
// apron of phials, a glowing retort in the hand (the lit flask is its own sign). Three of a thing become one of a finer grade.
export function makeAlchemist(seed = 1, tint = '#3ab89a') {
  const R = rng(seed + 811), female = R() < .5, TEAL = '#2e8a78', VIOL = '#5a2a7a', APRON = '#6a4a2a', GLASS = '#9ae8d0';
  const { r, hair } = serviceBody(R, female, { top: TEAL, sleeve: TEAL, kind: 'alchemist', grey: R() < .3 });
  if (female) { longHair(r, hair, .5); } else { hairCap(r, hair); if (R() < .6) beard(r, hair, .26, 1); }
  wreath(r, '#5aa84a', .33, null, '#c8e070');
  chiton(r, TEAL, { y1: -.78, trim: VIOL, key: tint }); sash(r, VIOL, .16, .7); neckTrim(r, '#e8c050');
  const ap = box(r.torso, .46, .6, .06, APRON, 0, .25, .2, kx('apron', APRON)); ap.rotation.x = -.04;
  for (let i = 0; i < 4; i++) { const c = [GLASS, '#e8a040', '#c04a8a', '#7ad060'][i]; ball(r.torso, .05, c, -.15 + i * .1, .3, .245, PXART ? 1 : 0, kx('gem', c)); }
  belt(r, APRON, .12, '#e8c050', .05); pouch(r, '#5a3a24', 1); sandals(r, '#5a3a22', '#8a5a30', female);
  // a retort of glowing liquid, always bubbling
  const lp = new THREE.Group(); r.handR.add(lp); lp.position.set(0, -.08, .1);
  ball(lp, .1, GLASS, 0, 0, 0, 1, kx('gem', GLASS)).scale.set(1, .9, 1); tcyl(lp, .03, .035, .12, GLASS, 0, .12, 0, 6, kx('gem', GLASS));
  const fl = cone(lp, .04, .12, '#7affd0', 0, .24, 0, 5, { basic: true, noShadow: true }); (r.flames ||= []).push(fl);
  r.tick = flamesTick;
  return done(r);
}
// BETA ONLINE (Roy 27.10: "an NPC in every city who does the CRAFT"): the artificer, online only (poi.js plans her only online;
// js/online/craft/). A forge-mistress: a soot-dark ember-red chiton under a heavy leather apron with a hammer at the belt, a
// copper fillet over braided hair, thick bracers, and an ingot glowing white-hot in the tongs she holds (the glow is her sign).
export function makeCrafter(seed = 1, tint = '#e86a2a') {
  const R = rng(seed + 1213), EMBER = '#7a2a1a', LEATHER = '#5a3a22', COPPER = '#d07a3a', IRON = '#4a4c54';
  const { r, hair } = serviceBody(R, true, { top: EMBER, sleeve: null, kind: 'crafter' });
  hairCap(r, hair, { locks: 'part' }); ponytail(r, hair, COPPER); fillet(r, COPPER, .31, '#ffb04a');
  chiton(r, EMBER, { y1: -.6, trim: tint }); bust(r, EMBER);
  const ap = box(r.torso, .44, .78, .05, LEATHER, 0, .1, .23, kx('apron', LEATHER)); ap.rotation.x = -.05;
  for (const [x, y] of [[-.15, .44], [.15, .44]]) ball(r.torso, .02, COPPER, x, y, .26, 0, kx('gem', COPPER, { noShadow: true }));
  for (const sx of [-1, 1]) strap(r.torso, [sx * .15, .48, .22], [sx * .12, .66, -.06], .04, .03, '#3a2416');
  belt(r, '#3a2416', .1, COPPER, .07); pouch(r, LEATHER, -1);
  const hm = new THREE.Group(); r.torso.add(hm); hm.position.set(.22, -.02, .1); hm.rotation.z = .25; // a hammer hung at the belt
  tcyl(hm, .02, .022, .3, '#6a4a2a', 0, -.12, 0, 5, kx('wood', '#6a4a2a')); box(hm, .14, .07, .07, IRON, 0, .03, 0, kx('plate', IRON));
  bracer(r, LEATHER, 'LR', .17); boots(r, '#3a2a1e');
  // tongs in the right hand, an ingot glowing at their jaws
  const tg = new THREE.Group(); r.handR.add(tg); tg.position.set(0, -.04, .05); tg.rotation.x = -.9;
  for (const sx of [-1, 1]) { const b = box(tg, .018, .46, .018, IRON, sx * .018, .2, 0); b.rotation.z = sx * .04; }
  const ig = box(tg, .1, .05, .06, '#ffd27a', 0, .45, 0, { basic: true, noShadow: true }); (r.flames ||= []).push(ig);
  cone(tg, .035, .1, '#ff8a2a', 0, .52, 0, 5, { basic: true, noShadow: true });
  r.tick = flamesTick;
  return done(r);
}
export function makeTrader(seed = 1, tint = '#e8b040') {
  const R = rng(seed + 603), female = R() < .45, SAFF = '#e0a030', PURP = '#4a1e5a', GOLD = '#e8c050';
  const { r, hair, skin } = serviceBody(R, female, { top: SAFF, sleeve: SAFF, kind: 'trader' });
  if (!female && R() < .7) beard(r, hair, .28, 1.05);
  hood(r, PURP); r.skull.material = mat(skin); // the hood leaves the face in the open
  chiton(r, SAFF, { y1: -.78, trim: PURP, key: tint }); neckTrim(r, GOLD);
  cape(r, PURP, .95, .48, { flare: .14 }); belt(r, tint, .12, GOLD, .07);
  necklace(r, GOLD, '#3ac06a'); earrings(r, GOLD); pouch(r, '#7a4a28', 1); pouch(r, '#5a3a24', -1);
  // the pack: a frame of rolled rugs and a few jars
  const pk = new THREE.Group(); r.torso.add(pk); pk.position.set(0, .5, -.38);
  box(pk, .5, .62, .26, '#7a5434', 0, 0, 0, kx('strap', '#7a5434')); for (let i = 0; i < 3; i++) { const rc = [tint, '#3a6ab0', '#b42a2a'][i]; tcyl(pk, .07, .07, .6, rc, 0, .38 + i * .13, -.02, 7, kx('rug', rc)).rotation.z = PI / 2; }
  ball(pk, .09, '#c46a34', .15, -.18, .16, PXART ? 1 : 0, kx('jar', '#c46a34')); ball(pk, .08, '#2a6a8a', -.15, -.18, .16, PXART ? 1 : 0, kx('jar', '#2a6a8a'));
  for (const sx of [-1, 1]) strap(r.torso, [sx * .15, .62, .16], [sx * .16, .4, -.26], .035, .025, '#5a3a24', { noShadow: true });
  sandals(r, '#5a3a22', '#8a5a30', female);
  return done(r);
}
// BETA ONLINE Phase I (online only: js/online/social/npc.js places one in Elaia): the guild master, who founds guilds.
// A herald of the guilds: a deep-blue chiton with a gold key hem, a white himation on the shoulders, a gold laurel, and a
// tall herald's staff with a square banner (a gold roundel on blue: the sign that a guild can be made here).
export function makeGuildmaster(seed = 1, tint = '#2e6ab0') {
  const R = rng(seed + 977), female = R() < .45, BLUE = '#1e3a7a', WH = '#f2ede2', GOLD = '#e8c050';
  const { r, hair } = serviceBody(R, female, { top: BLUE, sleeve: BLUE, kind: 'guildmaster', grey: R() < .3 });
  if (female) { longHair(r, hair, .5); bun(r, hair); } else { hairCap(r, hair); if (R() < .7) beard(r, hair, .24, 1); }
  wreath(r, GOLD, .34, null, '#f0d070');
  chiton(r, BLUE, { y1: -.78, trim: GOLD, key: tint }); neckTrim(r, GOLD);
  cape(r, WH, .8, .46, { flare: .1 }); belt(r, GOLD, .12, '#f0d070', .05); pouch(r, '#5a3a24', 1);
  sandals(r, '#5a3a22', '#8a5a30', female);
  // the herald's staff and its banner
  const st = staff(r.handR, '#6a4a2a', 2.3, .45); r.staff = st;
  ball(st, .06, GOLD, 0, 1.62, .03, 0);
  const bn = new THREE.Group(); st.add(bn); bn.position.set(0, 1.28, .05);
  box(bn, .5, .04, .04, GOLD, .25, .2, 0); // the cross-bar
  box(bn, .46, .5, .02, BLUE, .25, -.06, 0, kx('rug', BLUE));
  box(bn, .2, .2, .03, GOLD, .25, -.04, 0); box(bn, .1, .1, .04, '#bd2b2b', .25, -.04, 0);
  for (let i = 0; i < 3; i++) box(bn, .1, .08, .02, BLUE, .1 + i * .15, -.35, 0); // a fringed hem
  return done(r);
}

// ======================================================================================
// OLYMPIANS, HEROES, TITANS AND THE REST OF THE SHEET (for the chapters to come)
// ======================================================================================
function wings(r, col, tip, span = 1, y = .5, par = r.torso) { // feathered wings on the back, half open
  if (PXART) return PG.wings(r, col, tip, span, y, par); // painted feather panels
  const out = [];
  for (const sx of [-1, 1]) {
    const w = pivot(par, sx * .1, y, -.17); w.rotation.set(-.15, sx * -.5, sx * -.35); out.push(w);
    for (let i = 0; i < 5; i++) { const f = box(w, .07, .07 + i * .02 * span, (.55 - i * .07) * span, i % 2 ? tip : col, sx * (.04 + i * .1) * span, .22 - i * .08, -(.26 - i * .03) * span); f.rotation.set(-.9 + i * .28, 0, sx * .2); }
    const arm = box(w, .32 * span, .08, .08, col, sx * .16 * span, .26, -.04); arm.rotation.z = sx * -.35;
  }
  return out;
}
function anklets(r, col = '#eef2f4') { if (PXART) { for (const K of [r.kneeL, r.kneeR]) for (const sx of [-1, 1]) PG.winglet(K, .13, sx, sx * .07, -.27, -.04, col); return; } for (const K of [r.kneeL, r.kneeR]) for (const sx of [-1, 1]) { const f = box(K, .015, .05, .12, col, sx * .085, -.26, -.03, { noShadow: true }); f.rotation.set(-.6, 0, sx * -.5); } }
function trident(hand, shaft = '#6d8ca2', metal = '#86a8c0', len = 2.5) {
  if (PXART) return PG.trident(hand, shaft, PG.R6(metal), len);
  const tr = staff(hand, shaft, len, .3), top = len * .6;
  box(tr, .34, .05, .05, metal, 0, top + .06, .03);
  for (const sx of [-1, 0, 1]) { box(tr, .045, sx ? .3 : .38, .045, metal, sx * .15, top + (sx ? .22 : .26), .03); cone(tr, .055, .14, metal, sx * .15, top + (sx ? .43 : .51), .03, 4); }
  return tr;
}
function bow(hand, col = '#8a5a2a') {
  if (PXART) return PG.bow(hand, col);
  const g = new THREE.Group(); hand.add(g); g.position.set(0, -.05, .05);
  const a = torus(g, .55, .025, col, .3, 0, 0, { arc: PI * .9 }); a.rotation.z = PI * .55;
  box(g, .006, 1.06, .006, '#f2ecd8', -.22, 0, 0, { noShadow: true });
  return g;
}
function quiver(r, col = '#7a4a28', fl = '#e8e0cc') {
  if (PXART) return PG.quiver(r, col, fl);
  const q = pivot(r.torso, .12, .45, -.22); q.rotation.z = -.45;
  tcyl(q, .07, .06, .5, col, 0, 0, 0, 6);
  for (let i = 0; i < 4; i++) box(q, .03, .1, .015, i % 2 ? fl : '#c84a3a', (i - 1.5) * .03, .3, 0, { noShadow: true });
  strap(r.torso, [.2, .62, .1], [-.18, .12, .17], .035, .025, col, { noShadow: true });
  return q;
}
function caduceus(hand) {
  if (PXART) return PG.caduceus(hand); // gold rod, twin serpents, winglets
  const g = staff(hand, '#d8a838', 1.1, .25);
  ball(g, .05, '#f0d070', 0, .82, .03, 0); for (const sx of [-1, 1]) { const w = box(g, .14, .04, .02, '#f2f2f2', sx * .08, .78, .03); w.rotation.z = sx * .4; }
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) ball(g, .028, '#4a8a3a', sx * Math.cos(i * 1.6) * .04, .2 + i * .14, .03 + Math.sin(i * 1.6) * .02, 0, { noShadow: true });
  return g;
}
function club(hand, col = '#7a5434') { if (PXART) return PG.club(hand, col); const g = new THREE.Group(); hand.add(g); g.rotation.x = 1.05; tcyl(g, .045, .1, .9, col, 0, .4, .03, 6); for (let i = 0; i < 4; i++) ball(g, .045, shade(col, .8), (i % 2 ? .07 : -.07), .5 + i * .1, .03, 0, { noShadow: true }); g.rotation.set(1.5, 0, 0); return g; }
function scythe(hand, blade = '#b8bec8', len = 2.2) {
  if (PXART) return PG.scythe(hand, len, PG.R6(blade));
  const g = staff(hand, '#3a2e26', len, .3), top = len * .6;
  const b = box(g, .55, .08, .03, blade, -.26, top + .02, .03); b.rotation.z = -.2;
  cone(g, .04, .18, blade, -.55, top - .06, .03, 4).rotation.z = PI * .65;
  return g;
}
function torch(hand, r) {
  if (PXART) return PG.torch(hand, r); // pitch-wrapped head, licking cut-out flames
  const g = new THREE.Group(); hand.add(g); g.position.set(0, -.04, .05);
  tcyl(g, .03, .025, .5, '#6a4a2a', 0, .15, 0, 5); tcyl(g, .05, .04, .08, '#3a2a1e', 0, .42, 0, 6);
  const fl = [cone(g, .07, .2, '#ff7a1a', 0, .55, 0, 5, { basic: true, noShadow: true }), cone(g, .045, .14, '#ffd04a', 0, .55, 0, 5, { basic: true, noShadow: true })];
  (r.flames ||= []).push(...fl); return g;
}
function flamesTick(r, dt) { r.t = (r.t || 0) + dt; (r.flames || []).forEach((f, i) => goldFlicker(f, r.t, i)); if (PXART) PG.flick(r, dt); }
function halo(r, col = '#ffd04a', n = 12, rad = .36, len = .16) { // sun rays round the head
  if (PXART) return PG.halo(r, col, n, rad, len);
  const g = pivot(r.head, 0, .22, -.08);
  for (let i = 0; i < n; i++) { const a = i / n * PI * 2; const c = cone(g, .035, len + (i % 2) * .06, col, Math.sin(a) * rad, Math.cos(a) * rad, 0, 4, { basic: true, noShadow: true }); c.rotation.z = -a; }
  torus(g, rad - .04, .02, col, 0, 0, 0, { basic: true, noShadow: true });
  return g;
}
function crescent(parent, col, x, y, z, s = 1) { if (PXART) return PG.crescent(parent, col, x, y, z, s); const c = torus(parent, .1 * s, .025 * s, col, x, y, z, { arc: PI * 1.3, basic: true, noShadow: true }); c.rotation.z = PI * .85; return c; }
function lionPelt(r) {
  if (PXART) return PG.lionPelt(r); // furred head with eyes and fangs, dark mane, the pelt with its paws
  const P = '#c8963a', P2 = '#a8762a', M = '#8a5a24';
  const hd = ball(r.head, .26, P, 0, .34, -.06, 1); hd.scale.set(1.05, .78, 1.08);
  for (const sx of [-1, 1]) { ball(r.head, .06, P2, sx * .14, .48, .06, 0); box(r.head, .05, .03, .02, '#2a1a10', sx * .07, .42, .21, { noShadow: true }); }
  box(r.head, .16, .08, .12, P, 0, .36, .18); for (const sx of [-1, 1]) cone(r.head, .02, .07, '#f2ecd8', sx * .05, .3, .22, 4, { noShadow: true }).rotation.x = PI;
  for (let i = 0; i < 8; i++) { const a = (i / 7 - .5) * 2.6; ball(r.head, .08, M, Math.sin(a) * .25, .25, -.06 + Math.cos(a) * .2 - .05, 0, { noShadow: true }); }
  cape(r, P, .95, .5, { flare: .1 });
  for (const sx of [-1, 1]) { const l = box(r.torso, .09, .3, .05, P2, sx * .1, .52, .2); l.rotation.z = sx * .5; }
  return hd;
}
function abs(r, col) { if (PXART) return; /* the painted chest has them */ for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) box(r.torso, .07, .05, .03, col, sx * .045, .3 - i * .07, .165, { noShadow: true }); }
function godBody(spec) { const r = humanoid(Object.assign({ legs: spec.skin, boots: spec.skin, sleeve: null, lips: '#9a5a4a' }, spec)); if (spec.female) { lashes(r); r.torso.children[1].scale.x = .93; } return r; }

export function makeApollo() {
  const SK = '#e8b48a', GOLD = '#e8b440', HAIR = '#e8c04a', WH = '#f2ede2';
  const r = godBody({ skin: SK, top: SK, bottom: WH, eyes: '#3a6a9a', brow: '#c89a3a', scale: 1.08 });
  pecs(r, SK, 1.05); abs(r, '#d49c72');
  curls(r, HAIR, { n: 10, s: .065, h: .84 }); locks(r, HAIR, .3, 1, true);
  wreath(r, '#5a8a3a', .34, null, '#e0b040');
  chiton(r, WH, { y0: .3, top: .25, y1: -.8, trim: GOLD, key: '#b8372f' });
  drape(r, WH, GOLD, -.76, .22, .42);
  belt(r, GOLD, .14, '#f4d060', .05); armband(r, GOLD); sandals(r, '#8a5a2a', GOLD, true);
  const l = lyre(r.torso, -.15, .3, .3); l.rotation.set(-.2, .3, .25); l.scale.setScalar(1.15);
  hold(r, 'L', l, -.07, -.02, -.02); r.lyre = l;
  halo(r, '#ffe27a', 10, .33, .1).visible = true;
  if (PXART) { PG.lyre(l); PG.brooch(r.torso, .05, PG.AU, 'sun', .2, .6, .13); PG.seal(r); } // tortoise-shell lyre, a sun brooch on the himation
  return done(r);
}
export function makeAres() {
  const SK = '#c8936a', BRONZE = '#b8823a', RED = '#a8241e', LEATHER = '#5a3a24';
  const r = godBody({ skin: SK, top: BRONZE, bottom: RED, eyes: '#3a1a12', brow: '#1a1210', browTilt: .32, scale: 1.18 });
  hairCap(r, '#1a1210', { h: .76 }); beard(r, '#1a1210', .14, 1.05);
  const AB = PXART && ['#2a1210', '#552818', '#84481e', '#b07434', '#d8a454', '#f8e0a0']; // his darker, blooded bronze
  if (PXART) { PG.helmDown(r, AB, '#c82a22'); PG.chest(r, PG.cuirass(AB), AB[3]); } // closed helm with the face opening chased in, a muscle cuirass in relief
  else { corinth(r, BRONZE, '#c82a22', false); for (const sx of [-1, 1]) box(r.head, .07, .025, .015, '#0a0806', sx * .07, .23, .225, { noShadow: true }); pecs(r, BRONZE, 1.1); abs(r, '#9a6a2a'); }
  hem(r, '#d8a848', .57, .262, .72, .03);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, c = i % 2 ? LEATHER : '#7a4a2a'; const st = PXART ? PG.bx(r.torso, .075, .26, .03, PG.stripMats(PG.R6(c), i % 2), Math.sin(a) * .25, -.1, Math.cos(a) * .22) : box(r.torso, .075, .26, .03, c, Math.sin(a) * .25, -.1, Math.cos(a) * .22); st.rotation.y = a; st.rotation.x = .15 * Math.cos(a); }
  for (const sx of [-1, 1]) { const pa = PXART ? PG.bl(r.torso, .15, PG.lamesMat(AB), sx * .32, .6, 0, 1) : ball(r.torso, .15, BRONZE, sx * .32, .6, 0, 1); pa.scale.set(1.1, .6, 1.1); }
  cape(r, RED, 1.15, .52, { flare: .14 }); belt(r, LEATHER, .12, '#d8a848', .07);
  greaves(r, BRONZE); sandals(r, LEATHER, LEATHER); bracer(r, BRONZE, 'LR', .16);
  r.sword = sword(r.handR, '#c3c8d2', .7);
  const sh = PXART ? PG.shield(r.elbowL, .4, AB, 'serpent', { boss: true, field: RED }) : roundShield(r.elbowL, .4, BRONZE, '#7a4a1e', { boss: '#d8a848' }); sh.position.set(-.12, -.12, .04); r.shield = sh; // pixel art: a black serpent on a blood-red field
  if (PXART) PG.seal(r);
  return done(r);
}
// BETA ONLINE JOBS (js/online/jobcast.js): the hall masters and sellers are dressed from the same kit
export const CASTKIT = { godBody: (o) => godBody(o), serviceBody: (R, f, o) => serviceBody(R, f, o), bow: (h, c) => bow(h, c), quiver: (r, c, f) => quiver(r, c, f), crescent: (...a) => crescent(...a), torch: (h, r) => torch(h, r),
  flamesTick: (r, dt) => flamesTick(r, dt), done: (r) => done(r), greaves: (r, c) => greaves(r, c), roundShield: (...a) => roundShield(...a), pecs: (...a) => pecs(...a), abs: (r, c) => abs(r, c), lyre: (...a) => lyre(...a) };
export function makeArtemis() {
  const SK = '#e8bc98', GR = '#4f8a3e', GR2 = '#3a6a2e', HAIR = '#e2c47a', SILVER = '#dfe6ee';
  const r = godBody({ skin: SK, top: GR, bottom: GR, eyes: '#3a6a3e', brow: '#a8843a', liner: '#3a2a1a', lips: '#b45a52', female: true, scale: 1.0 });
  hairCap(r, HAIR, { h: .84 }); ponytail(r, HAIR, SILVER); locks(r, HAIR, .3, 1, true);
  fillet(r, SILVER, .34); crescent(r.head, SILVER, 0, .43, .14, .8);
  chiton(r, GR, { y1: -.44, trim: '#e8e0cc', folds: GR2 }); bust(r, GR); neckTrim(r, '#e8e0cc');
  drape(r, '#e8e0cc', SILVER, .74, .12, .38);
  belt(r, '#6a4428', .14, SILVER, .05); bracer(r, '#6a4428', 'L', .16);
  sandals(r, '#6a4428', '#7a4e2a', true);
  if (PXART) { PG.quiver(r, '#7a4a28', '#e8e0cc', PG.AG); r.bow = PG.bow(r.handL, '#8a5a2a', PG.AG); PG.seal(r); } // silver-banded quiver and silver-tipped bow
  else { quiver(r); r.bow = bow(r.handL); }
  return done(r);
}
export function makeHermes() {
  const SK = '#e2ad84', GOLD = '#e0b040', CL = '#d8a03a', HAIR = '#8a5a2a';
  const r = godBody({ skin: SK, top: '#f0ead8', bottom: '#f0ead8', eyes: '#4a6a3a', brow: '#6a4020', scale: 1.04 });
  curls(r, HAIR, { n: 9, s: .058 });
  const pt = petasos(r, GOLD, '#b8823a', -.1); pt.scale.set(.75, 1, .75);
  for (const sx of [-1, 1]) { if (PXART) { PG.winglet(r.head, .26, sx, sx * .19, .42, -.04); continue; } const w = pivot(r.head, sx * .2, .42, -.04); w.rotation.set(0, sx * .3, sx * -.5); for (let i = 0; i < 3; i++) box(w, .04, .03, .2 - i * .04, i % 2 ? '#dfe6ee' : '#fafafa', sx * (.02 + i * .04), .04 + i * .04, -.04, { noShadow: true }).rotation.x = -.5 + i * .2; }
  chiton(r, '#f0ead8', { y1: -.42, trim: GOLD }); neckTrim(r, GOLD);
  chlamys(r, CL, GOLD, .6); belt(r, '#7a4a28', .14, GOLD, .05);
  sandals(r, '#8a5a2a', GOLD, true); anklets(r);
  r.caduceus = caduceus(r.handL); pouch(r, '#8a5a2a', 1);
  if (PXART) PG.seal(r);
  return done(r);
}
export function makeHephaestus() {
  const SK = '#b47a50', LEATHER = '#5a3a22', IRON = '#3e4048';
  const r = godBody({ skin: SK, top: SK, bottom: '#4a4038', eyes: '#3a2a1e', brow: '#2a1a12', browTilt: .28, scale: 1.15 });
  pecs(r, SK, 1.2); abs(r, '#9a6844'); r.torso.children[1].scale.x = 1.1;
  hairCap(r, '#8a8680', { h: .76 }); beard(r, '#8a8680', .3, 1.15); for (const sx of [-1, 0, 1]) (PXART ? PG.bl(r.head, .06, PG.curlMat('#8a8680'), sx * .07, -.02 + Math.abs(sx) * .03, .15, 1, { noShadow: true }) : ball(r.head, .06, '#8a8680', sx * .07, -.02 + Math.abs(sx) * .03, .15, 0, { noShadow: true }));
  chiton(r, '#4a4038', { y0: .2, top: .24, y1: -.46, trim: null });
  const LQ = PXART && PG.R6(LEATHER);
  const ap = PXART ? PG.cy(r.torso, .235, .31, .7, [PG.texMat(PG.apron(LQ)), mat(LQ[2]), mat(LQ[1])], 0, -.14, .04, 12) : tcyl(r.torso, .235, .31, .7, LEATHER, 0, -.14, .04, 10); ap.scale.z = .88; // pixel art: scorched, stitched, riveted, tongs in the pocket
  if (PXART) PG.strapM(r.torso, [.2, .62, .12], [-.18, .1, .2], .06, .03, PG.texMat(PG.wraps(LQ))); else strap(r.torso, [.2, .62, .12], [-.18, .1, .2], .06, .03, LEATHER);
  belt(r, '#3a2416', .12, '#b8b0a0', .08); bracer(r, LEATHER, 'LR', .2);
  boots(r, LEATHER); for (const K of [r.kneeL, r.kneeR]) PXART ? PG.cy(K, .084, .078, .26, PG.texMat(PG.wraps(LQ)), 0, -.12, 0, 8) : tcyl(K, .084, .078, .26, LEATHER, 0, -.12, 0, 6);
  const hm = new THREE.Group(); r.handR.add(hm); hm.rotation.x = -1.05;
  if (PXART) { // an ash haft bound at the grip, the iron head's striking face still glowing from the forge
    PG.cy(hm, .03, .035, .55, PG.texMat(PG.wood(PG.WD, { grip: [.55, .85] })), 0, 0, .14, 6).rotation.x = PI / 2;
    const F = PG.texMat(PG.hammerHead(0)); PG.bx(hm, .14, .14, .3, [F, F, F, F, PG.texMat(PG.hammerHead(1)), F], 0, 0, .42).rotation.y = PI / 2;
    PG.seal(r);
  } else { tcyl(hm, .03, .035, .55, '#6a4a2a', 0, 0, .14, 5).rotation.x = PI / 2; box(hm, .14, .14, .3, IRON, 0, 0, .42).rotation.y = PI / 2; }
  r.hammer = hm; r.lean = .06;
  return done(r);
}
export function makeAphrodite() {
  const SK = '#f2c8a8', HAIR = '#ecc868', WH = '#f6f0ea', PINK = '#e88aa8', GOLD = '#e8c050';
  const r = godBody({ skin: SK, top: WH, bottom: WH, eyes: '#3a7aa8', brow: '#b8903a', liner: '#3a2420', lips: '#d04a6a', female: true, scale: 1.0 });
  hairCap(r, HAIR, { h: .88 }); locks(r, HAIR, .7, 3); curls(r, HAIR, { n: 7, s: .05, top: false, back: 0, h: .86 });
  flowerHair(r, PINK, -.18, .32, .07); flowerHair(r, '#f4f0f4', -.13, .37, .11);
  chiton(r, WH, { trim: PINK, key: GOLD, y0: .3, top: .24 }); bust(r, WH);
  drape(r, PINK, GOLD, .72, .14, .4); belt(r, GOLD, .3, null, .03, .2);
  necklace(r, GOLD, '#e84a7a'); earrings(r); bangles(r); armband(r, GOLD, 'L');
  sandals(r, '#c09868', GOLD, true);
  const sh = new THREE.Group(); r.handL.add(sh); sh.position.set(0, -.05, .06); // scallop shell mirror
  if (PXART) { // a ribbed pearl-pink shell with a pearl at its hinge; shell brooches pinning her chiton
    PG.quad(sh, .22, .19, PG.cutMat(PG.shell()), 0, .08, 0); PG.bl(sh, .022, PG.orbMat(['#6a5a6a', '#a898a8', '#d8ccd8', '#f4eef4', '#ffffff', '#ffffff']), 0, -.01, .01, 1, { noShadow: true });
    for (const sx of [-1, 1]) PG.brooch(r.torso, .036, PG.AU, 'shell', sx * .15, .6, .12);
    PG.seal(r);
  } else for (let i = 0; i < 5; i++) { const f = box(sh, .04, .14, .02, '#f4d8d0', (i - 2) * .035, .06, 0); f.rotation.z = (i - 2) * -.25; }
  return done(r);
}
export function makeHestia() {
  const SK = '#eabc98', HAIR = '#c0502a', WH = '#f2ede2', RED = '#b8372f', GOLD = '#e0b040';
  const r = godBody({ skin: SK, top: WH, bottom: WH, eyes: '#5a3a1e', brow: '#9a3a1a', liner: '#3a2420', lips: '#b04a48', female: true });
  hairCap(r, HAIR, { h: .86 }); locks(r, HAIR, .55, 2); fillet(r, GOLD, .33);
  veil(r, RED, GOLD);
  chiton(r, WH, { trim: RED, key: GOLD }); bust(r, WH); neckTrim(r, GOLD);
  drape(r, RED, GOLD, -.72, .16, .36); belt(r, GOLD, .3, null, .03, .2); sandals(r, '#8a5a2a', GOLD);
  const br = hold(r, 'R', r.torso, .14, .3, .34); // brazier bowl of fire held before her
  if (PXART) { // a bronze bowl chased with egg-and-dart, glowing coals, licking flames
    PG.cy(br, .12, .07, .08, [PG.texMat(PG.trim(PG.BZ, 'egg', 10, null, 64)), PG.glowTexMat(PG.fruit('coal')), mat('#3a1c14')], 0, .03, 0, 12);
    PG.cy(br, .03, .04, .06, PG.metalMat(PG.BZ), 0, -.04, 0, 8); PG.flames(r, br, .28, 0, .06, 0);
  } else {
    tcyl(br, .12, .07, .08, '#c9963c', 0, .03, 0, 8); tcyl(br, .03, .03, .06, '#c9963c', 0, -.04, 0, 5);
    r.flames = [cone(br, .08, .22, '#ff7a1a', 0, .16, 0, 5, { basic: true, noShadow: true }), cone(br, .05, .15, '#ffd04a', 0, .14, 0, 5, { basic: true, noShadow: true })];
  }
  hold(r, 'L', br, -.12, 0, 0);
  r.tick = flamesTick;
  if (PXART) PG.seal(r);
  return done(r);
}
export function makeDemeter() {
  const SK = '#a8c48e', HAIR = '#5a3a1e', GR = '#4f8a3e', WH = '#f0ead6', GOLD = '#d8a838', WHEAT = '#e0b860';
  const r = godBody({ skin: SK, top: WH, bottom: GR, eyes: '#3a2a1a', brow: '#4a2a14', liner: '#2a3a1e', lips: '#8a4a3a', female: true });
  hairCap(r, HAIR, { h: .86 }); locks(r, HAIR, .55, 2);
  if (PXART) for (let i = 0; i < 9; i++) { const a = (i - 4) * .32, q = PG.quad(r.head, .07, .24, PG.cutMat(PG.wheat()), Math.sin(a) * .23, .44, -.03 + Math.cos(a) * .23); q.rotation.set(-.3 * Math.cos(a), a, -Math.sin(a) * .5, 'YXZ'); } // a crown of wheat ears
  else for (let i = 0; i < 9; i++) { const a = (i - 4) * .32; const w = box(r.head, .03, .14, .03, WHEAT, Math.sin(a) * .22, .38, -.03 + Math.cos(a) * .22, { noShadow: true }); w.rotation.set(-.3 * Math.cos(a), 0, -Math.sin(a) * .5); }
  chiton(r, GR, { trim: GOLD, key: WHEAT, folds: '#3a6a2e' }); bust(r, WH);
  const t = PXART ? PG.cy(r.torso, .25, .22, .46, [PG.texMat(PG.cloth(PG.lift(PG.soft(WH)), { W: 96, H: 40, hem: [PG.R6(GOLD), 'egg'], hemH: 8 })), mat(WH), mat(WH)], 0, .34, 0, 10) : tcyl(r.torso, .25, .22, .46, WH, 0, .34, 0, 8); t.scale.z = .74;
  drape(r, GR, GOLD, .72, .2, .36); belt(r, GOLD, .14, null, .04); sandals(r, '#6a4a2a', GOLD);
  torch(r.handL, r);
  const sh = new THREE.Group(); r.handR.add(sh); sh.position.set(0, -.05, .06); sh.rotation.x = -.8; // sheaf of wheat
  if (PXART) { for (let i = 0; i < 7; i++) { const q = PG.quad(sh, .08, .62, PG.cutMat(PG.wheat()), (i - 3) * .022, .22, (i % 2) * .01); q.rotation.set(0, i * .45, (i - 3) * .07); } PG.cy(sh, .035, .035, .04, PG.texMat(PG.trim(PG.AU, 'dots', 8, null, 32)), 0, .08, 0, 8); PG.seal(r); } // ears with their stalks, bound in gold
  else for (let i = 0; i < 5; i++) { const st = box(sh, .015, .5, .015, WHEAT, (i - 2) * .02, .15, 0, { noShadow: true }); st.rotation.z = (i - 2) * .08; box(sh, .04, .1, .04, '#d8a848', (i - 2) * .04, .42, 0, { noShadow: true }); }
  r.tick = flamesTick;
  return done(r);
}
export function makeHera() {
  const SK = '#ecc0a0', HAIR = '#6a3a1e', TEAL = '#2f8a96', WH = '#f4efe6', GOLD = '#e0b040';
  const r = godBody({ skin: SK, top: WH, bottom: WH, eyes: '#2a5a6a', brow: '#4a2a14', liner: '#2a1a14', lips: '#b04a4a', female: true, scale: 1.06 });
  hairCap(r, HAIR, { h: .88 }); bun(r, HAIR, .36, -.16); locks(r, HAIR, .45, 1, true);
  if (PXART) PG.crown(r.head, PG.AU, { rad: .22, flare: -.02, y: .37, h: .09, z: -.02, n: 5, spread: .4, ph: .1, mid: .04, motif: 'egg', H: 14, gem: TEAL, sz: 1.04 }); // polos: egg-and-dart band, a teal gem
  else { const cr = tcyl(r.head, .22, .2, .09, GOLD, 0, .37, -.02, 10); cr.scale.z = 1.04; // polos crown
  for (let i = 0; i < 5; i++) { const a = (i - 2) * .4; cone(r.head, .03, .1, GOLD, Math.sin(a) * .21, .45, -.02 + Math.cos(a) * .21, 4, { noShadow: true }); }
  ball(r.head, .03, '#2f8a96', 0, .37, .21, 0, { noShadow: true }); }
  chiton(r, WH, { trim: TEAL, key: GOLD }); bust(r, WH); neckTrim(r, GOLD); sleeveTrim(r, TEAL);
  drape(r, TEAL, GOLD, .72, .2, .36); wrapSkirt(r, TEAL, GOLD, -.82);
  belt(r, GOLD, .3, null, .03, .2); necklace(r, GOLD, TEAL); earrings(r); sandals(r, '#8a6a3a', GOLD);
  if (PXART) { // gilded sceptre, an orb, a fan of peacock eyes; a peacock-eye brooch where the himation pins
    const sc = PG.shaft(r.handR, PG.AU, 1.9, .3, { rings: [[.1, PG.AU], [.45, PG.AU]] }); PG.bl(sc, .065, PG.texMat(PG.orb(PG.AU)), 0, 1.15, .03, 1);
    PG.cy(sc, .05, .03, .06, PG.texMat(PG.trim(PG.AU, 'dots', 8, null, 32)), 0, 1.08, .03, 8);
    const pf = PG.cutMat(PG.peacock()); for (let i = 0; i < 7; i++) { const a = (i - 3) * .3; PG.quad(sc, .1, .27, pf, Math.sin(a) * .14, 1.17 + Math.cos(a) * .14, .02).rotation.z = -a; }
    PG.bl(r.torso, .04, PG.texMat(PG.gem(PG.R6(TEAL))), -.22, .62, .1, 1, { noShadow: true });
    PG.seal(r); return done(r);
  }
  const sc = staff(r.handR, GOLD, 1.9, .3); ball(sc, .06, '#f0d070', 0, 1.15, .03, 1);
  for (let i = 0; i < 5; i++) { const a = (i - 2) * .35; const f = box(sc, .04, .2, .02, i % 2 ? '#2f8a96' : '#3a6aa8', Math.sin(a) * .1, 1.24 + Math.cos(a) * .08, .03, { noShadow: true }); f.rotation.z = -a; } // peacock fan
  return done(r);
}
export function makeDionysus() {
  const SK = '#e2a882', PURP = '#7b3a9a', PURP2 = '#5a2a7a', HAIR = '#2a1a2a', LEO = '#d8a848';
  const r = godBody({ skin: SK, top: SK, bottom: PURP, eyes: '#5a2a3a', brow: '#2a1a2a', lips: '#a8384a', scale: 1.04 });
  pecs(r, SK, .95);
  curls(r, HAIR, { n: 9, s: .06 }); beard(r, HAIR, .1, .95);
  wreath(r, '#4a8a2a', .34, null, '#5a9a3a');
  if (PXART) { const gm = PG.texMat(PG.fruit('grape')); for (let i = 0; i < 6; i++) { const a = (i - 2.5) * .45, x = Math.sin(a) * .235, z = -.03 + Math.cos(a) * .235; for (const [dx, dy, s] of [[-.025, .31, .03], [.025, .31, .03], [0, .27, .03], [0, .23, .024]]) PG.bl(r.head, s, gm, x + dx * Math.cos(a), dy, z - dx * Math.sin(a), 1, { noShadow: true }); } } // bunches of grapes
  else for (let i = 0; i < 6; i++) { const a = (i - 2.5) * .45; ball(r.head, .035, PURP2, Math.sin(a) * .23, .3, -.03 + Math.cos(a) * .23, 0, { noShadow: true }); ball(r.head, .03, '#9a5ab8', Math.sin(a) * .23, .26, -.03 + Math.cos(a) * .23, 0, { noShadow: true }); }
  chiton(r, PURP, { y0: .3, top: .25, y1: -.8, trim: '#e0b040', folds: PURP2 });
  const n0 = r.torso.children.length, dp = drape(r, LEO, '#8a5a24', -.76, .2, .42);
  if (PXART) { const fm = PG.texMat(PG.fur(PG.R6(LEO), { spots: 1 })); for (const m of [...dp.children, ...r.torso.children.slice(n0)]) if (m.isMesh && m.castShadow) m.material = fm; } // the nebris: a leopard skin, rosettes painted in
  else for (let i = 0; i < 6; i++) ball(r.torso, .025, '#5a3a1a', -.18 + i * .07, .35 + (i % 3) * .06, .2, 0, { noShadow: true }); // leopard spots
  belt(r, '#e0b040', .14, null, .04); sandals(r, '#6a3a2a', '#e0b040');
  r.cup = kylix(r.handR, '#c8a040');
  const am = amphora(r.handL, 0, -.18, .05, '#4a7a3a'); am.scale.setScalar(.6); // wine jar
  if (PXART) PG.seal(r);
  return done(r);
}
export function makeHeracles() {
  const SK = '#7a4a2e', HAIR = '#1a1210';
  const r = godBody({ skin: SK, top: SK, bottom: '#6a4a2a', eyes: '#2a1a12', brow: HAIR, browTilt: .28, lips: '#5a3024', scale: 1.24 });
  pecs(r, SK, 1.3); abs(r, '#5e3a24'); r.torso.children[1].scale.x = 1.12;
  for (const A of [r.armL, r.armR]) A.scale.set(1.18, 1, 1.18);
  curls(r, HAIR, { n: 9, s: .06 }); beard(r, HAIR, .22, 1.12);
  lionPelt(r);
  chiton(r, '#8a6a3a', { y1: -.42, trim: '#c8963a' }); belt(r, '#5a3a22', .12, '#d8a848', .07);
  sandals(r, '#4a2e1a', '#6a4428', true); bracer(r, '#5a3a22', 'LR', .14);
  r.club = club(r.handR);
  if (PXART) PG.seal(r);
  return done(r);
}
export function makeAchilles() {
  const SK = '#e2ad84', BRONZE = '#d0a040', RED = '#b42a2a', HAIR = '#d8b060';
  const r = godBody({ skin: SK, top: BRONZE, bottom: RED, eyes: '#3a5a7a', brow: '#a8843a', scale: 1.1 });
  hairCap(r, HAIR, { h: .8 }); locks(r, HAIR, .3, 1, true);
  if (PXART) { PG.helmDown(r, PG.BZ, RED); PG.chest(r, PG.cuirass(PG.BZ, { gorgon: true }), PG.BZ[3]); } // closed helm, a muscle cuirass with a gorgoneion
  else { corinth(r, BRONZE, RED, false);
  for (const sx of [-1, 1]) box(r.head, .07, .025, .015, '#0a0806', sx * .07, .23, .225, { noShadow: true });
  pecs(r, BRONZE, 1.1); abs(r, '#a87a2a'); }
  hem(r, '#f0d070', .57, .262, .72, .03);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, c = i % 2 ? '#e6dcc0' : RED; const st = PXART ? PG.bx(r.torso, .075, .26, .03, PG.stripMats(i % 2 ? PG.lift(PG.soft(c)) : PG.R6(c), !(i % 2)), Math.sin(a) * .25, -.1, Math.cos(a) * .22) : box(r.torso, .075, .26, .03, c, Math.sin(a) * .25, -.1, Math.cos(a) * .22); st.rotation.y = a; st.rotation.x = .15 * Math.cos(a); }
  for (const sx of [-1, 1]) if (PXART) PG.bl(r.torso, .14, PG.lamesMat(BRONZE), sx * .3, .6, 0, 1).scale.set(1.1, .6, 1.1); else box(r.torso, .13, .05, .3, BRONZE, sx * .17, .6, 0);
  cape(r, RED, 1.0, .48); belt(r, '#5a3a22', .12, BRONZE, .06);
  greaves(r, BRONZE); sandals(r, '#5a3a22', '#5a3a22');
  if (PXART) { // the ash spear of Peleus; the shield Hephaestus made: Ocean round the rim, dancers, fields, sun and moon
    const sp = PG.shaft(r.handR, PG.WD, 2.5, .4, { rings: [[.04, PG.BZ], [.96, PG.BZ]] }); PG.spearHead(sp, PG.BZ, 1.65); r.spear = sp;
    const sh = PG.shield(r.elbowL, .4, PG.AU, null, { face: PG.achShield() }); sh.position.set(-.12, -.12, .04); r.shield = sh;
    PG.seal(r); return done(r);
  }
  const sp = staff(r.handR, '#6a4a2a', 2.5, .4); cone(sp, .06, .3, BRONZE, 0, 1.78, .03, 4); r.spear = sp;
  const sh = roundShield(r.elbowL, .4, BRONZE, '#8a5a24', { boss: '#f0d070', rivets: '#f0d070' }); sh.position.set(-.12, -.12, .04); r.shield = sh;
  return done(r);
}
export function makeOdysseus() {
  const SK = '#d09a70', HAIR = '#5a3a20', CL = '#c86a2a', TUN = '#e2d6b6';
  const r = godBody({ skin: SK, top: TUN, bottom: TUN, eyes: '#3a4a5a', brow: '#4a2e18', browTilt: .2, scale: 1.05 });
  curls(r, HAIR, { n: 9, s: .058 }); beard(r, HAIR, .22, 1.08); for (const sx of [-1, 0, 1]) ball(r.head, .052, HAIR, sx * .07, -.02 + Math.abs(sx) * .03, .15, 0, { noShadow: true });
  fillet(r, '#8a2a2a', .33);
  chiton(r, TUN, { y1: -.44, trim: '#8a2a2a' }); neckTrim(r, '#8a2a2a');
  drape(r, CL, '#7a3a1a', -.74, .24, .4); chlamys(r, CL, '#7a3a1a', .8);
  belt(r, '#5a3a22', .13, '#c8a050', .06); bracer(r, '#5a3a22', 'LR', .14);
  sandals(r, '#4a2e1a', '#6a4428', true);
  r.sword = sword(r.handR, '#c3c8d2', .6);
  if (PXART) { PG.brooch(r.torso, .05, PG.AU, 'owl', .23, .62, .135); const bw = PG.bow(r.torso, '#5a3a20', PG.BZ); bw.position.set(.17, .44, -.28); bw.rotation.z = .75; PG.seal(r); } // Athena's owl pins his cloak; the great bow across his back
  return done(r);
}
export function makePerseus() {
  const SK = '#e0aa82', HAIR = '#3a2214', LEATHER = '#8a5a30', BRONZE = '#c9963c';
  const r = godBody({ skin: SK, top: LEATHER, bottom: '#6a4428', eyes: '#3a4a2a', brow: HAIR, browTilt: .22, scale: 1.06 });
  curls(r, HAIR, { n: 9, s: .058 }); fillet(r, '#b8372f', .33);
  if (PXART) PG.chest(r, PG.corslet(PG.R6(LEATHER)), LEATHER); // a laced leather corslet, riveted in bronze
  else { pecs(r, LEATHER, 1); for (let i = 0; i < 3; i++) hem(r, '#6a4020', .2 + i * .14, .24 - i * .005, .72, .02); }
  for (const sx of [-1, 1]) { const pa = PXART ? PG.bl(r.torso, .13, PG.lamesMat('#a8b0b8'), sx * .3, .6, 0, 1) : ball(r.torso, .13, '#a8b0b8', sx * .3, .6, 0, 1); pa.scale.set(1.1, .6, 1.1); }
  chiton(r, '#e2d6b6', { y1: -.42, trim: '#b8372f' });
  for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; const st = PXART ? PG.bx(r.torso, .08, .22, .03, PG.stripMats(PG.R6(LEATHER), !!(i % 2)), Math.sin(a) * .25, -.1, Math.cos(a) * .22) : box(r.torso, .08, .22, .03, LEATHER, Math.sin(a) * .25, -.1, Math.cos(a) * .22); st.rotation.y = a; }
  belt(r, '#5a3a22', .12, BRONZE, .06); bracer(r, '#5a3a22', 'LR', .16);
  sandals(r, '#5a3a22', BRONZE, true); anklets(r, '#f2f2f2');
  r.sword = sword(r.handR, '#d8dce4', .62);
  if (PXART) { // the polished mirror-shield; the kibisis, a woven bag on a strap, at his hip
    const sh = PG.shield(r.elbowL, .34, PG.AG, null, { face: PG.mirror(PG.AG) }); sh.position.set(-.12, -.12, .04); r.shield = sh;
    const bm = PG.texMat(PG.wraps(PG.R6('#8a6a44'))); PG.bl(r.torso, .11, bm, .25, -.08, .02, 1).scale.set(.8, 1, .7); PG.cy(r.torso, .045, .06, .05, PG.texMat(PG.trim(PG.AG, 'dots', 8, null, 32)), .25, .04, .02, 8);
    PG.strapM(r.torso, [-.2, .62, .1], [.25, .05, .1], .03, .02, PG.texMat(PG.trim(PG.R6('#5a3a22'), 'dots', 6, null, 16)), { noShadow: true });
    PG.seal(r); return done(r);
  }
  const sh = roundShield(r.elbowL, .34, '#d8dce4', BRONZE, { boss: null }); sh.position.set(-.12, -.12, .04); r.shield = sh; // the polished mirror-shield
  return done(r);
}
export function makeHecate() {
  const C = '#1e1a26', C2 = '#2a2434', C3 = '#141019';
  const r = humanoid({ skin: '#3d3846', top: C, bottom: C, boots: C3, sleeve: C2, faceless: true, scale: 1.08 });
  hood(r, C2, { void: '#050407' });
  for (const sx of [-1, 1]) box(r.head, .045, .02, .02, '#c8a8ff', sx * .06, .2, .19, { basic: true, noShadow: true });
  const rb = robe(r, C, { top: .23, bot: .44, y1: -.86, folds: C3, n: 9 });
  if (PXART) { const hm = PG.texMat(PG.starCloth(PG.R6(C2), { W: 64, H: 32, hem: '#8a6ac8' })); rb.material = PG.texMat(PG.starCloth(PG.R6(C), { hem: '#8a6ac8' }));
    PG.cy(r.torso, .28, .42, .5, hm, 0, .4, -.02, 10).scale.z = .8; for (const E of [r.elbowL, r.elbowR]) PG.cy(E, .075, .13, .24, hm, 0, -.15, 0, 8); }
  else { const cp = tcyl(r.torso, .28, .42, .5, C2, 0, .4, -.02, 10); cp.scale.z = .8;
  for (const E of [r.elbowL, r.elbowR]) tcyl(E, .075, .13, .24, C2, 0, -.15, 0, 7); }
  cape(r, C3, 1.3, .52); belt(r, '#5a4a6a', .12, '#c8a8ff', .04);
  crescent(r.torso, '#e8e4f0', 0, .4, .2, .7);
  torch(r.handL, r); torch(r.handR, r);
  r.tick = flamesTick;
  if (PXART) { const km = PG.cutMat(PG.keyTex(PG.AG)); for (const [x, rz] of [[.1, .15], [.15, -.1]]) PG.quad(r.torso, .06, .17, km, x, .01, .175).rotation.z = rz; PG.seal(r); } // the keys of the crossroads at her belt
  return done(r);
}
export function makeAtlas() {
  const ST = '#7a7670', ST2 = '#5e5a56';
  const r = godBody({ skin: ST, top: ST, bottom: ST2, eyes: '#1a1814', white: '#cfc8bc', brow: '#3a3632', browTilt: .3, lips: '#3a3632', scale: 1.5 });
  pecs(r, ST, 1.35); abs(r, ST2); r.torso.children[1].scale.x = 1.15;
  for (const A of [r.armL, r.armR]) A.scale.set(1.25, 1, 1.25);
  ball(r.torso, .22, ST, 0, .66, -.1, 1).scale.set(1.5, .8, 1);
  hairCap(r, ST2, { h: .7 }); beard(r, ST2, .2, 1.1);
  chiton(r, ST2, { y1: -.36, trim: null, folds: '#4a4642' });
  belt(r, '#4a4642', .1, null, .07); bracer(r, ST2, 'LR', .14);
  if (PXART) { PG.chest(r, PG.stoneTorso(ST), ST); PG.stoneSkin(r, [ST, ST2]); PG.seal(r); return done(r); } // carved stone: grit, chips and cracks painted in
  for (let i = 0; i < 6; i++) box(r.torso, .1, .015, .015, '#4a4642', (i % 3 - 1) * .12, .2 + Math.floor(i / 3) * .25, .18, { noShadow: true }).rotation.z = i; // cracks
  return done(r);
}
export function makePrometheus() {
  const SK = '#d89a6c', HAIR = '#a8542a', WH = '#efe8d8';
  const r = godBody({ skin: SK, top: SK, bottom: WH, eyes: '#4a2a1a', brow: '#8a3a1a', browTilt: .2, scale: 1.16 });
  pecs(r, SK, 1.15); abs(r, '#c08458');
  curls(r, HAIR, { n: 9, s: .062 }); beard(r, HAIR, .26, 1.1);
  chiton(r, WH, { y0: .3, top: .25, y1: -.8, trim: '#b8372f' });
  drape(r, WH, '#b8372f', -.76, .22, .42);
  belt(r, '#7a4a28', .14, null, .05); sandals(r, '#6a4428', '#7a4e2a');
  if (PXART) for (const E of [r.elbowL, r.elbowR]) { PG.cy(E, .07, .066, .08, PG.texMat(PG.trim(PG.FE, 'dots', 8, null, 32)), 0, -.22, 0, 8); PG.chain(E, 3, 0, -.29, -.065); } // broken shackles, a few links still hanging
  else for (const E of [r.elbowL, r.elbowR]) { tcyl(E, .066, .062, .08, '#6a6c74', 0, -.22, 0, 6); box(E, .02, .1, .02, '#6a6c74', 0, -.3, -.06, { noShadow: true }); } // broken shackles
  const fire = hold(r, 'R', r.torso, .22, .62, .2); // the stolen fire raised on his palm
  if (PXART) { PG.bl(fire, .045, PG.glowTexMat(PG.fruit('coal')), 0, .02, 0, 1, { noShadow: true }); PG.flames(r, fire, .34, 0, 0, 0); PG.seal(r); } // an ember with fire licking off it
  else r.flames = [cone(fire, .09, .26, '#ff6a1a', 0, .12, 0, 5, { basic: true, noShadow: true }), cone(fire, .06, .18, '#ffd04a', 0, .1, 0, 5, { basic: true, noShadow: true })];
  r.tick = flamesTick;
  return done(r);
}
export function makeCirce() {
  const SK = '#9cc48a', HAIR = '#5a2a1a', PURP = '#6a2a7a', GOLD = '#e0b040';
  const r = godBody({ skin: SK, top: PURP, bottom: PURP, eyes: '#d8b020', white: '#efe6b4', brow: '#3a1a10', liner: '#1a2a14', lips: '#7a3a4a', female: true });
  hairCap(r, HAIR, { h: .88 }); locks(r, HAIR, .75, 3); curls(r, HAIR, { n: 7, s: .05, top: false, back: 0, h: .86 });
  fillet(r, GOLD, .33, '#4ae08a');
  chiton(r, PURP, { trim: GOLD, key: '#4ae08a', folds: '#4a1a5a' }); bust(r, PURP); neckTrim(r, GOLD);
  belt(r, GOLD, .3, null, .03, .2); necklace(r, GOLD, '#4ae08a'); earrings(r); bangles(r);
  sandals(r, '#4a2a3a', GOLD);
  if (PXART) { // a gnarled staff, gold claws round a swirling green orb in a halo; a spell of gold light in her other hand
    const st = PG.shaft(r.handR, PG.R6('#5a3a2a'), 1.9, .3, { rings: [[.06, PG.AU], [.5, PG.AU]] }), cm = PG.texMat(PG.spike(PG.AU));
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + .4; PG.aim(PG.cn(st, .016, .12, cm, Math.sin(a) * .055, 1.13, .03 + Math.cos(a) * .055, 4, { noShadow: true }), Math.sin(a) * .5, 1, Math.cos(a) * .5); }
    const orb = PG.live(PG.bl(st, .07, PG.glowTexMat(PG.fruit('#6aff9a')), 0, 1.18, .03, 1, { noShadow: true }));
    for (const a of [0, PI / 2]) PG.quad(st, .34, .34, PG.glowMat('#6aff9a', .4), 0, 1.18, .03).rotation.y = a;
    const glow = hold(r, 'L', r.torso, -.22, .3, .32); const gl = PG.live(PG.bl(glow, .05, PG.glowTexMat(PG.fruit('#ffd84a')), 0, .04, 0, 1, { noShadow: true }));
    for (const a of [0, PI / 2]) PG.quad(glow, .16, .16, PG.sparkMat('#ffd84a'), 0, .04, 0).rotation.y = a;
    r.flames = [orb, gl]; r.tick = flamesTick; PG.seal(r); return done(r);
  }
  const st = staff(r.handR, '#5a3a2a', 1.9, .3); const orb = ball(st, .07, '#6aff9a', 0, 1.18, .03, 1, { basic: true, noShadow: true });
  const glow = hold(r, 'L', r.torso, -.22, .3, .32); ball(glow, .06, '#ffd84a', 0, .04, 0, 0, { basic: true, noShadow: true });
  r.flames = [orb]; r.tick = flamesTick;
  return done(r);
}
export function makePan() {
  const SK = '#c08a5e', FUR = '#6a4428', FUR2 = '#4a2e1a', HORN = '#d8ccb0';
  const r = godBody({ skin: SK, top: SK, bottom: FUR, legs: FUR, boots: FUR, eyes: '#c8a020', white: '#efe6b4', brow: FUR2, browTilt: .35, lips: '#6a3a2a' });
  pecs(r, SK, .95);
  curls(r, FUR2, { n: 8, s: .055 }); beard(r, FUR2, .26, .8);
  const hm = PXART && PG.texMat(PG.horn(PG.R6(HORN))), fm = PXART && PG.texMat(PG.fur(PG.R6(FUR))); // (pixel art: ridged horn, goat hair, hooves, cane pipes)
  for (const sx of [-1, 1]) { let p = pivot(r.head, sx * .1, .38, -.02); p.rotation.set(-.4, 0, -sx * .3); for (let i = 0; i < 3; i++) { if (PXART) PG.cy(p, .03 - i * .007, .045 - i * .008, .12, hm, 0, .05, 0, 6); else tcyl(p, .03 - i * .007, .045 - i * .008, .12, HORN, 0, .05, 0, 5); p = pivot(p, 0, .11, 0); p.rotation.set(-.5, 0, 0); } const ear = cone(r.head, .05, .14, SK, sx * .23, .23, -.03, 4); ear.rotation.z = sx * 1.6; }
  for (const L of [r.legL, r.legR]) { const t = PXART ? PG.bl(L, .13, fm, 0, -.18, 0, 1) : ball(L, .13, FUR, 0, -.18, 0, 1); t.scale.set(1, 1.6, 1.1); }
  for (const K of [r.kneeL, r.kneeR]) { (PXART ? PG.bl(K, .1, fm, 0, -.1, -.03, 1) : ball(K, .1, FUR, 0, -.1, -.03, 0)).scale.set(1, 1.5, 1); if (PXART) PG.bx(K, .12, .08, .14, PG.texMat(PG.hoof()), 0, -.36, .04); else box(K, .12, .08, .14, '#2a1a10', 0, -.36, .04); }
  belt(r, FUR2, .1, null, .05); const rb = robe(r, FUR, { top: .21, bot: .28, y1: -.3, folds: FUR2, n: 6 }); if (PXART) rb.material = PG.texMat(PG.fur(PG.R6(FUR), { mane: 1 }));
  const pp = hold(r, 'L', r.torso, -.06, .62, .3); pp.rotation.z = .2; // pipes at his lips
  for (let i = 0; i < 6; i++) if (PXART) PG.cy(pp, .016, .016, .2 - i * .025, PG.texMat(PG.reed()), i * .032 - .08, -(i * .012), 0, 5, { noShadow: i > 0 }); else tcyl(pp, .016, .016, .2 - i * .025, '#d8b878', i * .032 - .08, -(i * .012), 0, 4, { noShadow: i > 0 });
  if (PXART) { PG.bx(pp, .2, .02, .036, PG.texMat(PG.wraps(PG.R6('#8a5a2a'))), .0, -.02, 0, { noShadow: true }); for (const J of [r.legL, r.legR, r.kneeL, r.kneeR]) for (const o of J.children) if (o.isMesh && o.material === mat(FUR)) o.material = fm; PG.seal(r); } // a binding across the pipes; his goat legs all hair
  return done(r);
}
export function makeEros() {
  const SK = '#f2caa8', HAIR = '#ecc868', WH = '#f6f0ea';
  const r = godBody({ skin: SK, top: SK, bottom: WH, eyes: '#3a7aa8', brow: '#b8903a', lips: '#d05a6a', scale: .78 });
  r.head.scale.setScalar(1.15);
  curls(r, HAIR, { n: 9, s: .065 });
  chiton(r, WH, { y0: .1, y1: -.38, trim: '#e88aa8' }); sash(r, '#e88aa8', .08, -.72, .36);
  sandals(r, '#c09868', '#e0b040');
  wings(r, '#f8f6f2', '#dfe6ee', .9);
  r.bow = bow(r.handL, '#e0b040'); quiver(r, '#e88aa8', '#f8f6f2');
  if (PXART) PG.seal(r);
  return done(r);
}
export function makePersephone() {
  const SK = '#f0caa8', HAIR = '#8a2a1e', RED = '#a8242e', GOLD = '#e0b040';
  const r = godBody({ skin: SK, top: RED, bottom: RED, eyes: '#3a5a2a', brow: '#6a1a12', liner: '#2a1414', lips: '#a8243a', female: true });
  hairCap(r, HAIR, { h: .88 }); locks(r, HAIR, .7, 3); curls(r, HAIR, { n: 7, s: .052, top: false, back: 0, h: .86 });
  for (let i = 0; i < 6; i++) { const a = (i - 2.5) * .45; flowerHair(r, i % 2 ? '#f4f0f4' : '#e84a7a', Math.sin(a) * .21, .34, -.03 + Math.cos(a) * .21); }
  chiton(r, RED, { trim: GOLD, folds: '#7a1a22' }); bust(r, RED); neckTrim(r, GOLD);
  const n0 = r.torso.children.length, dp = drape(r, '#2a1a2a', GOLD, .72, .14, .38), n1 = r.torso.children.length; belt(r, GOLD, .3, null, .03, .2);
  if (PXART) { const nm = PG.texMat(PG.starCloth(PG.R6('#3a1a3a'), { W: 64, H: 32 })); for (const m of [...dp.children, ...r.torso.children.slice(n0, n1)]) if (m.isMesh && m.castShadow) m.material = nm; } // the queen of the dead: a mantle of the underworld's night
  necklace(r, GOLD, '#e84a5a'); earrings(r); sandals(r, '#5a2a2a', GOLD);
  const pm = hold(r, 'L', r.torso, -.2, .26, .32); // the pomegranate
  if (PXART) { PG.bl(pm, .07, PG.texMat(PG.fruit('pom')), 0, .05, 0, 1); PG.cn(pm, .03, .05, PG.texMat(PG.spike(PG.R6('#8a1a2a'))), 0, .12, 0, 6, { noShadow: true }); PG.seal(r); return done(r); } // its crown-shaped calyx
  ball(pm, .07, '#b8243a', 0, .05, 0, 1); cone(pm, .03, .05, '#8a1a2a', 0, .12, 0, 5, { noShadow: true });
  return done(r);
}
export function makeHebe() {
  const SK = '#f2caa8', HAIR = '#ecc868', WH = '#f6f0ea', SKY = '#6aa8e0';
  const r = godBody({ skin: SK, top: WH, bottom: WH, eyes: '#3a7aa8', brow: '#b8903a', liner: '#3a2420', lips: '#c85a6a', female: true, scale: .95 });
  hairCap(r, HAIR, { h: .88 }); locks(r, HAIR, .6, 2); fillet(r, '#e0b040', .33);
  chiton(r, WH, { trim: SKY, key: '#e0b040' }); bust(r, WH); neckTrim(r, SKY); belt(r, '#e0b040', .3, null, .03, .2);
  sandals(r, '#c09868', '#e0b040');
  r.cup = kylix(r.handR, '#e0b040');
  const sp = hold(r, 'L', r.torso, -.24, .32, .3); // a swirl of ambrosia light
  if (PXART) { const km = PG.sparkMat('#9ad8ff'); for (let i = 0; i < 6; i++) { const s = .07 + i * .016; PG.quad(sp, s, s, km, Math.cos(i * 1.3) * .07, i * .055, Math.sin(i * 1.3) * .07).rotation.set(0, i * .9, i * .4); } PG.seal(r); return done(r); } // glints of ambrosia rising
  for (let i = 0; i < 5; i++) ball(sp, .025 + i * .006, '#9ad8ff', Math.cos(i * 1.3) * .06, i * .05, Math.sin(i * 1.3) * .06, 0, { basic: true, noShadow: true });
  return done(r);
}
export function makeMorpheus() {
  const SK = '#8ab0e0', SK2 = '#5a80c0', o = { opacity: .85, emissive: '#1a2a4a' };
  const r = godBody({ skin: SK, top: SK, bottom: SK2, eyes: '#1a2a4a', white: '#c8dcf8', brow: '#3a5a9a', lips: '#3a5a9a', scale: 1.05 });
  eyeSlit(r, '#1a2a4a');
  curls(r, '#c8d8f0', { n: 9, s: .06 });
  if (PXART) for (const sx of [-1, 1]) { PG.winglet(r.head, .26, sx, sx * .2, .3, -.04, '#e8f0ff'); PG.quad(r.head, .1, .1, PG.cutMat(PG.poppy()), sx * .19, .37, .05).rotation.y = sx * .9; } // a dream-pale wing and a poppy at each temple
  else for (const sx of [-1, 1]) { const w = pivot(r.head, sx * .2, .3, -.02); w.rotation.z = sx * -.6; for (let i = 0; i < 3; i++) box(w, .03, .025, .16 - i * .03, '#e8f0ff', sx * (.02 + i * .03), .03 + i * .03, -.03, { noShadow: true }).rotation.x = -.4 + i * .2; }
  const n0 = r.torso.children.length; chiton(r, '#3a4a8a', { y0: .3, top: .25, trim: '#c8d8f0', folds: '#2a3a6a' });
  if (PXART) { const sm = PG.texMat(PG.starCloth(PG.R6('#3a4a8a'), { hem: '#c8d8f0' })); for (const m of r.torso.children.slice(n0)) if (m.isMesh && m.castShadow) m.material = sm; } // the night sky of sleep, sewn with stars
  r.mist = [];
  for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; const m = PXART ? PG.live(PG.bl(r.root, .26 + (i % 3) * .06, PG.mistMat(i % 2 ? '#9ab8e8' : '#c8d8f4'), Math.sin(a) * .55, .2 + (i % 4) * .15, Math.cos(a) * .4, 1)) : ball(r.root, .26 + (i % 3) * .06, i % 2 ? '#9ab8e8' : '#c8d8f4', Math.sin(a) * .55, .2 + (i % 4) * .15, Math.cos(a) * .4, 1, o); m.castShadow = false; r.mist.push(m); }
  for (const E of [r.elbowL, r.elbowR]) { const w = PXART ? PG.live(PG.bl(E, .12, PG.mistMat('#c8d8f4'), 0, -.3, 0, 1)) : ball(E, .12, '#c8d8f4', 0, -.3, 0, 1, o); w.castShadow = false; r.mist.push(w); }
  r.t = 0; r.tick = (r, dt) => { r.t += dt; r.mist.forEach((m, i) => { m.scale.setScalar(.85 + Math.sin(r.t * 1.4 + i) * .15); }); };
  if (PXART) PG.seal(r);
  return done(r);
}
export function makeThanatos() {
  const C = '#1a1a20', C2 = '#26262e', BONE = '#d8d4c8';
  const r = humanoid({ skin: BONE, top: C, bottom: C, boots: '#101014', sleeve: C2, faceless: true, scale: 1.1 });
  hood(r, C2, { void: '#050507' });
  const dz = PXART ? .05 : 0; // (pixel art: the bone skull comes forward out of the hood's dark, so the face reads)
  const sk = PXART ? PG.bl(r.head, .16, PG.texMat(PG.bone()), 0, .2, .04 + dz, 1) : ball(r.head, .16, BONE, 0, .2, .04, 1); sk.scale.set(1, 1.1, .9);
  for (const sx of [-1, 1]) box(r.head, .05, .05, .02, '#050507', sx * .055, .22, .19 + dz, { noShadow: true });
  box(r.head, .02, .035, .02, '#050507', 0, .16, .195 + dz, { noShadow: true });
  for (let i = -2; i <= 2; i++) box(r.head, .012, .03, .02, '#050507', i * .022, .1, .18 + dz, { noShadow: true });
  const rb = robe(r, C, { top: .23, bot: .44, y1: -.86, folds: '#0e0e12', n: 9 }), tm = PXART && PG.texMat(PG.tatter(PG.R6('#2a2a34')));
  if (PXART) rb.material = tm; // (pixel art: torn shroud cloth, long rents, a frayed hem)
  for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + .3; const tt = PXART ? PG.bx(r.torso, .09, .1 + (i % 3) * .05, .03, tm, Math.sin(a) * .43, -.88 - (i % 3) * .02, Math.cos(a) * .37) : box(r.torso, .09, .1 + (i % 3) * .05, .03, C, Math.sin(a) * .43, -.88 - (i % 3) * .02, Math.cos(a) * .37); tt.rotation.y = a; }
  for (const E of [r.elbowL, r.elbowR]) if (PXART) PG.cy(E, .075, .13, .24, tm, 0, -.15, 0, 8); else tcyl(E, .075, .13, .24, C2, 0, -.15, 0, 7);
  wings(r, '#2a2a32', '#3e3e48', 1.15, .52);
  r.scythe = scythe(r.handR);
  if (PXART) PG.seal(r);
  return done(r);
}
export function makeKronos() {
  const SK = '#c8a080', WH = '#eceae4', GOLD = '#d8a838', RED = '#7a2a2a';
  const r = godBody({ skin: SK, top: '#e2d6b6', bottom: '#e2d6b6', sleeve: '#e2d6b6', eyes: '#4a3a2a', brow: WH, browTilt: .3, scale: 1.2, old: true });
  baldFringe(r, WH, SK); for (const sx of [-1, 1]) ball(r.head, .08, WH, sx * .19, .16, -.04, 0);
  beard(r, WH, .5, 1.15, { tilt: .08 }); ball(r.head, .08, WH, 0, -.24, .12, 0, { noShadow: true });
  if (PXART) PG.crown(r.head, PG.AU, { rad: .2, flare: .01, y: .34, h: .07, z: -.02, n: 7, spread: .52, ph: .09, mid: .04, motif: 'zig', H: 12, gem: '#a8242e', sz: 1.04 }); // the old king's crown: a zigzag band, a garnet
  else { const cr = tcyl(r.head, .2, .21, .07, GOLD, 0, .34, -.02, 8); cr.scale.z = 1.04;
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; cone(r.head, .03, .09, GOLD, Math.sin(a) * .2, .41, -.02 + Math.cos(a) * .2, 4, { noShadow: true }); } }
  chiton(r, '#e2d6b6', { trim: RED, key: GOLD }); drape(r, RED, GOLD, -.74, .24, .34); wrapSkirt(r, RED, GOLD, -.82);
  belt(r, GOLD, .12, null, .05); sandals(r, '#5a3a22', GOLD);
  if (PXART) { // the harpe: an adamant sickle on a banded haft, a gold collar
    const hp = PG.shaft(r.handR, PG.WD, 2, .3, { rings: [[.04, PG.AU], [.2, PG.AU]] }); PG.cy(hp, .045, .045, .07, PG.texMat(PG.trim(PG.AU, 'dots', 8, null, 32)), 0, 1.3, .03, 8);
    const bq = PG.quad(hp, -.62, .36, PG.cutMat(PG.curveBlade(PG.AU, 'harpe')), -.29, 1.24, .03); bq.rotation.z = -.1;
    r.lean = .1; r.harpe = hp; PG.seal(r); return done(r);
  }
  const hp = staff(r.handR, '#6a4a2a', 2, .3); // harpe: the great sickle
  const bl = torus(hp, .26, .035, GOLD, -.22, 1.3, .03, { arc: PI * .9 }); bl.rotation.z = .2;
  r.lean = .1; r.harpe = hp;
  return done(r);
}
export function makeOuranos() {
  const SK = '#d8a880', NIGHT = '#1e2a5a', STAR = '#f4f0d0', WH = '#eef0f6';
  const r = godBody({ skin: SK, top: SK, bottom: NIGHT, eyes: '#3a5a9a', brow: WH, browTilt: .3, scale: 1.22, old: true });
  pecs(r, SK, 1.15); abs(r, '#c08a62');
  hairCap(r, WH, { h: .92 }); locks(r, WH, .6, 2); beard(r, WH, .46, 1.2, { tilt: .14 });
  const n0 = r.torso.children.length; chiton(r, NIGHT, { y0: .3, top: .25, y1: -.82, trim: '#6a8ae0', folds: '#141c40' });
  const dp = drape(r, NIGHT, '#6a8ae0', -.76, .22, .42);
  if (PXART) { // he is the sky: his robe and mantle are the night itself, stars and their lines; a diadem of stars
    const sm = PG.texMat(PG.starCloth(PG.R6(NIGHT), { hem: '#6a8ae0' })), dm = PG.texMat(PG.starCloth(PG.R6(NIGHT), { W: 64, H: 32 }));
    for (const m of [...r.torso.children.slice(n0), ...dp.children]) if (m.isMesh && m.castShadow) m.material = m.parent === dp || m.geometry.type === 'BoxGeometry' || m.geometry.type === 'IcosahedronGeometry' ? dm : sm;
    PG.cy(r.head, .224, .224, .035, PG.texMat(PG.trim(PG.AG, 'bead', 7, null, 64)), 0, .34, -.02, 12).scale.z = 1.04;
    const km = PG.sparkMat(STAR); for (let i = 0; i < 5; i++) { const a = (i - 2) * .45; PG.quad(r.head, i === 2 ? .13 : .09, i === 2 ? .13 : .09, km, Math.sin(a) * .235, .4 + (i === 2 ? .02 : 0), -.02 + Math.cos(a) * .24).rotation.y = a; }
  } else for (let i = 0; i < 14; i++) { const a = i * 2.39, y = -.75 + (i / 14) * 1.0; box(r.torso, .03, .03, .03, STAR, Math.sin(a) * .33, y, Math.cos(a) * .29, { basic: true, noShadow: true }); }
  belt(r, '#c8b880', .14, null, .05); sandals(r, '#3a2a4a', '#c8b880');
  r.trident = trident(r.handR, '#4a5a8a', '#c8d4f0');
  if (PXART) PG.seal(r);
  return done(r);
}
export function makeHelios() {
  const SK = '#f0b880', HAIR = '#f4c040', GOLD = '#ffcf40', WH = '#fff8e8';
  const r = godBody({ skin: SK, top: SK, bottom: WH, eyes: '#d88a20', white: '#fff6d8', brow: '#d8a030', scale: 1.12 });
  pecs(r, SK, 1.05); abs(r, '#d89a68');
  curls(r, HAIR, { n: 10, s: .065 });
  const h = halo(r, GOLD, 14, .4, .2); r.halo = h;
  chiton(r, WH, { y0: .3, top: .25, y1: -.8, trim: GOLD, key: '#e86a2a' }); drape(r, GOLD, '#e86a2a', -.76, .2, .42);
  belt(r, GOLD, .14, null, .05); armband(r, GOLD); sandals(r, '#a8743a', GOLD, true);
  r.t = 0; r.tick = (r, dt) => { r.t += dt; r.halo.rotation.z += dt * .4; r.halo.scale.setScalar(1 + Math.sin(r.t * 3) * .04); };
  if (PXART) { PG.brooch(r.torso, .055, PG.AU, 'sun', .22, .62, .1); PG.seal(r); } // a sun-disc brooch pins his mantle
  return done(r);
}
export function makeSelene() {
  const SK = '#c8d8f0', HAIR = '#eef2fa', GOWN = '#dfe8f6', SILVER = '#ffffff';
  const r = godBody({ skin: SK, top: GOWN, bottom: GOWN, eyes: '#5a7ab8', white: '#f4f8ff', brow: '#b8c8e0', liner: '#4a5a8a', lips: '#8a8ab8', female: true });
  hairCap(r, HAIR, { h: .9 }); locks(r, HAIR, .75, 3);
  fillet(r, '#c8d4f0', .33); crescent(r.head, SILVER, 0, .48, .0, 1.3);
  chiton(r, GOWN, { trim: '#8aa4e0', key: SILVER, folds: '#b8c8e8' }); bust(r, GOWN);
  drape(r, '#8aa4e0', SILVER, .72, .14, .38); belt(r, '#c8d4f0', .3, null, .03, .2); sandals(r, '#8a9ab8', SILVER);
  for (const sx of [-1, 1]) { const c = crescent(r.torso, '#e8f0ff', sx * .62, .6, -.1, 1.4); c.rotation.z = sx > 0 ? PI * .35 : PI * 1.35; }
  if (PXART) { const km = PG.sparkMat('#eef2fa'); for (const [x, y, z, s] of [[-.5, .9, -.1, .12], [.55, .95, -.1, .1], [-.7, .35, -.12, .08], [.68, .3, -.12, .09]]) PG.quad(r.torso, s, s, km, x, y, z); PG.seal(r); } // stars about her
  return done(r);
}
export function makeGaia() {
  const SK = '#7aa868', HAIR = '#3a6a2a', GR = '#5a8a3e', BR = '#6a4a2a';
  const r = godBody({ skin: SK, top: GR, bottom: GR, eyes: '#2a4a1a', white: '#e6f0d0', brow: '#2a4a1a', liner: '#1a2a10', lips: '#4a6a3a', female: true, scale: 1.1 });
  hairCap(r, HAIR, { h: .9 }); locks(r, HAIR, .8, 3); curls(r, HAIR, { n: 9, s: .065, h: .9 });
  if (PXART) { const lm = [PG.cutMat(PG.leaf(PG.R6('#4a8a2a'))), PG.cutMat(PG.leaf(PG.R6('#8ac05a')))]; for (let i = 0; i < 11; i++) { const a = (i - 5) * .3; PG.quad(r.head, .11, .17, lm[i % 2], Math.sin(a) * .25, .4 + (i % 2) * .03, -.04 + Math.cos(a) * .25).rotation.set(-.3, a, (i % 2 - .5) * .4, 'YXZ'); } } // a crown of leaves
  else for (let i = 0; i < 9; i++) { const a = (i - 4) * .35; const lf = box(r.head, .08, .02, .12, i % 2 ? '#8ac05a' : '#4a8a2a', Math.sin(a) * .25, .36, -.04 + Math.cos(a) * .25, { noShadow: true }); lf.rotation.set(.5, a, 0, 'YXZ'); }
  for (let i = 0; i < 4; i++) flowerHair(r, ['#f4f0f4', '#f2d23a', '#e84a5a', '#c86ad8'][i], (i - 1.5) * .12, .38, .16);
  chiton(r, GR, { trim: BR, folds: '#3a6a2a', bot: .4 }); bust(r, GR);
  drape(r, BR, '#8ac05a', .72, .18, .36); belt(r, BR, .3, null, .04, .2);
  if (PXART) { const vm = PG.cutMat(PG.vine()); for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; PG.quad(r.torso, .13, .42, vm, Math.sin(a) * .41, -.66, Math.cos(a) * .36).rotation.set(0, a, (i % 2 - .5) * .3, 'YXZ'); } PG.seal(r); return done(r); } // vines climbing her hem
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const v = box(r.torso, .05, .35, .03, '#4a7a2a', Math.sin(a) * .4, -.7, Math.cos(a) * .35, { noShadow: true }); v.rotation.y = a; } // roots and vines at the hem
  return done(r);
}
export function makeOracle() { // the Pythia: hooded, grey-bearded seer with a gnarled staff (as on the sheet)
  const SK = '#c8a080', CL = '#d8ccb0', CL2 = '#b8aa8a', WH = '#e8e6e0';
  const r = godBody({ skin: SK, top: CL, bottom: CL, sleeve: CL, eyes: '#e8e6e0', white: '#e8e6e0', brow: WH, scale: 1.02, old: true });
  hood(r, CL2, { void: SK }); r.skull.material = mat(SK);
  beard(r, WH, .42, 1.05, { tilt: .08 });
  robe(r, CL, { top: .22, bot: .4, y1: -.84, folds: CL2, n: 8 });
  if (PXART) dressChest(r, CL, 'bodice');
  drape(r, '#8a6a42', '#5a3a22', -.74, .2, .34); belt(r, '#5a3a22', .12, null, .05);
  const st = new THREE.Group(); r.handR.add(st);
  let p = pivot(st, 0, -.8, .03);
  for (const [ax, az] of [[0, .06], [.08, -.1], [-.06, .08], [.1, -.05], [-.04, .1], [.06, 0]]) { shaft(tcyl(p, .034, .042, .38, '#6a4a2a', 0, .19, 0, 5), '#6a4a2a', .38); p = pivot(p, 0, .36, 0); p.rotation.set(ax, 0, az); }
  ball(p, .08, '#6a4a2a', 0, .04, 0, 0, px('wood', '#6a4a2a')); r.staff = st; r.lean = .12;
  return done(r);
}
export function makeTyphon() {
  const SK = '#3a3448', SK2 = '#2a2436', HORN = '#c8c0b0', EYE = '#ff5a2a';
  const r = godBody({ skin: SK, top: SK, bottom: SK2, legs: SK, boots: SK2, faceless: true, scale: 1.9 });
  pecs(r, SK, 1.4); abs(r, SK2); r.torso.children[1].scale.x = 1.2;
  for (const A of [r.armL, r.armR]) A.scale.set(1.35, 1, 1.35);
  ball(r.torso, .26, SK, 0, .66, -.1, 1).scale.set(1.6, .9, 1.1);
  const h = r.head; r.skull.scale.set(1.15, 1, 1.1);
  box(h, .26, .14, .16, SK2, 0, .06, .16);
  for (const sx of [-1, 1]) {
    box(h, .06, .035, .02, EYE, sx * .08, .22, .2, { basic: true, noShadow: true });
    const bw = box(h, .1, .04, .05, SK2, sx * .08, .27, .18); bw.rotation.z = sx * .4;
    for (let i = 0; i < 2; i++) cone(h, .02, .07, '#f2ecd8', sx * (.04 + i * .05), .02, .25, 4, { noShadow: true }).rotation.x = PI;
    let p = pivot(h, sx * .16, .34, -.02); p.rotation.set(-.2, 0, -sx * .9);
    for (let i = 0; i < 4; i++) { tcyl(p, .04 - i * .008, .055 - i * .01, .13, HORN, 0, .06, 0, 5); p = pivot(p, 0, .12, 0); p.rotation.set(-.2, 0, sx * .45); }
  }
  for (let i = 0; i < 6; i++) cone(r.torso, .05, .2, '#4a4058', (i % 2 ? .08 : -.08), .72 - i * .1, -.24, 4).rotation.x = -1.2;
  const wg = wings(r, '#2a2436', '#3a3448', 1.3, .55); for (const w of wg) w.scale.set(1.2, 1.2, 1.2);
  belt(r, '#1a1622', .1, null, .08); robe(r, SK2, { top: .22, bot: .3, y1: -.34, folds: '#1a1622', n: 6 });
  for (const E of [r.elbowL, r.elbowR]) for (let i = -1; i <= 1; i++) cone(E, .02, .08, HORN, i * .035, -.38, .04, 4, { noShadow: true }).rotation.x = PI;
  const tail = pivot(r.torso, 0, -.1, -.22); tail.rotation.x = -2.3;
  for (let i = 0; i < 4; i++) tcyl(tail, .1 - i * .02, .12 - i * .02, .3, SK2, 0, .14 + i * .27, -i * .04, 6);
  if (PXART) { // pixel art: dark scaled hide, ringed horns, feathered wings, a scaled tail, eyes like coals
    for (const w of wg) w.traverse((m) => { if (m.isMesh) m.userData.px = 'feather'; }); for (const m of tail.children) m.userData.px = ['scale', { sw: 5, sh: 3 }];
    for (const sx of [-1, 1]) eyeGlow(h, '#ff6a2a', .14, sx * .08, .22, .22, .55);
    pxDress(r, { [SK]: ['skin', { scales: '#4a4058' }], [SK2]: ['skin', { scales: '#3a3448' }], [HORN]: 'horn', '#4a4058': 'horn', '#f2ecd8': 'bone', [EYE]: 'eye', '#1a1622': 'leather' }, { max: 192 });
  }
  return done(r);
}
export function makeScylla() { // sea-nymph rising from the waves, sea-serpent necks at her waist
  const SK = '#7ab8b0', HAIR = '#c8342a', SC = '#2f8a86', SC2 = '#1f6a6a';
  const r = godBody({ skin: SK, top: SK, bottom: SC, eyes: '#e8c020', white: '#efe6b4', brow: '#8a2a1a', liner: '#1a3a3a', lips: '#2a5a5a', female: true, scale: 1.1 });
  r.legL.visible = r.legR.visible = false;
  hairCap(r, HAIR, { h: .88 }); locks(r, HAIR, .7, 3); curls(r, HAIR, { n: 8, s: .055, top: false, back: 0, h: .86 });
  bust(r, SK); for (const sx of [-1, 1]) { const s = ball(r.torso, .07, '#e0c8a0', sx * .08, .44, .13, 0, { noShadow: true }); s.scale.set(1, .8, .5); }
  robe(r, SC, { top: .21, bot: .55, y1: -.85, folds: SC2, n: 10 });
  r.necks = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * PI * 2 + .4, p = pivot(r.torso, Math.sin(a) * .35, -.5, Math.cos(a) * .3); p.rotation.set(Math.cos(a) * .7, 0, -Math.sin(a) * .7);
    let q = p; for (let i = 0; i < 4; i++) { tcyl(q, .06 - i * .006, .075 - i * .006, .2, i % 2 ? SC : SC2, 0, .1, 0, 6); q = pivot(q, 0, .19, 0); q.rotation.x = (k % 2 ? .3 : -.3); }
    const hd = ball(q, .09, SC, 0, .04, .04, 1); hd.scale.set(.9, .8, 1.4);
    for (const sx of [-1, 1]) { box(q, .025, .02, .02, '#ffd84a', sx * .05, .07, .1, { basic: true, noShadow: true }); cone(q, .02, .1, '#9ad8d0', sx * .05, .12, -.04, 4, { noShadow: true }).rotation.x = -.6; }
    r.necks.push(p);
  }
  const wv = []; for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2, w = torus(r.root, .2, .05, i % 2 ? '#9fe0ff' : '#5fb6ea', Math.sin(a) * .55, .15, Math.cos(a) * .55, { basic: true, opacity: .8, noShadow: true, arc: PI * 1.2 }); w.rotation.set(PI / 2 - .4, 0, a); wv.push(w); }
  r.t = 0; r.foam = wv;
  r.tick = (r, dt) => { r.t += dt; r.necks.forEach((n, i) => { n.rotation.y = Math.sin(r.t * 1.3 + i * 1.7) * .35; }); r.foam.forEach((f, i) => { f.rotation.z += dt * (1 + i * .2); }); };
  if (PXART) pxDress(r, { [SK]: 'skin', [SC]: ['scale', { sw: 5, sh: 3 }], [SC2]: ['scale', { sw: 5, sh: 3 }], '#e0c8a0': 'bone', '#9ad8d0': 'membrane', '#ffd84a': 'eye', '#9fe0ff': 'water', '#5fb6ea': 'water' }); // pixel art: scales, fins, foam
  return done(r);
}
export function makeCharybdis() { // the maw in the sea: a turning whirlpool with sea-serpent heads rising from it
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0), SC = '#2f7aa0', SC2 = '#1f5a7a';
  const rings = [];
  for (let i = 0; i < 5; i++) { const t = torus(body, .5 + i * .32, .07 + i * .01, i % 2 ? '#5fb6ea' : '#9fe0ff', 0, .05 + i * .05, 0, { basic: true, noShadow: true, arc: PI * 1.6 }); t.rotation.x = PI / 2; rings.push(t); }
  const pit = tcyl(body, .5, .1, .5, '#06141e', 0, -.15, 0, 10); pit.castShadow = false;
  const heads = [];
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * PI * 2, p = pivot(body, Math.sin(a) * .9, 0, Math.cos(a) * .9); p.rotation.set(Math.cos(a) * -.3, 0, Math.sin(a) * .3);
    let q = p; for (let i = 0; i < 5; i++) { tcyl(q, .1 - i * .01, .13 - i * .01, .32, i % 2 ? SC : SC2, 0, .16, 0, 7); for (const sx of [-1, 1]) cone(q, .03, .12, '#9ad8d0', sx * .06, .2, -.08, 4, { noShadow: true }).rotation.x = -.8; q = pivot(q, 0, .3, 0); q.rotation.x = i < 2 ? -.15 : .3; }
    const hd = ball(q, .16, SC, 0, .06, .1, 1); hd.scale.set(.85, .7, 1.4);
    const jw = box(q, .16, .05, .26, SC2, 0, -.06, .2); jw.rotation.x = .4;
    for (const sx of [-1, 1]) { box(q, .04, .03, .02, '#ffd84a', sx * .08, .12, .2, { basic: true, noShadow: true }); cone(q, .03, .2, '#9ad8d0', sx * .08, .2, -.06, 4).rotation.x = -.9; }
    for (let i = 0; i < 4; i++) cone(q, .015, .06, '#f2ecd8', (i - 1.5) * .035, -.02, .3, 4, { noShadow: true }).rotation.x = PI;
    heads.push(p);
  }
  const r = { root, body, heads, rings, t: 0, static: true };
  if (PXART) { // pixel art: foam on the turning rings, scaled necks, finned heads with lit eyes
    for (const h of heads) { let q = h; while (q.children.some((c) => !c.isMesh)) q = q.children.find((c) => !c.isMesh); for (const sx of [-1, 1]) eyeGlow(q, '#ffd84a', .16, sx * .08, .12, .23, .55); }
    pxDress(r, { '#5fb6ea': 'water', '#9fe0ff': 'water', [SC]: ['scale', { sw: 6, sh: 4 }], [SC2]: ['scale', { sw: 6, sh: 4 }], '#9ad8d0': 'membrane', '#ffd84a': 'eye', '#f2ecd8': 'bone' });
  }
  addOutline(root, (m) => !m.castShadow || m.material.isMeshBasicMaterial);
  r.tick = (r, dt) => { r.t += dt; r.rings.forEach((g, i) => { g.rotation.z += dt * (2.2 - i * .3); }); r.heads.forEach((h, i) => { h.rotation.y = Math.sin(r.t * .9 + i * 2) * .4; }); };
  return r;
}

// registry for tools and the engine
export const CAST = {
  medusa: makeMedusa, namelessKing: makeNamelessKing, hades: makeHades, cerberus: makeCerberus, charon: makeCharon,
  poseidon: makePoseidon, tiresias: makeTiresias, minotaur: makeMinotaur, hesperid0: () => makeHesperid(0), hesperid1: () => makeHesperid(1),
  hesperid2: () => makeHesperid(2), zeus: makeZeus, athena: makeAthena, lostSoul: makeLostSoul, guardStone: () => makeSealGuardian('stone'),
  guardFire: () => makeSealGuardian('fire'), guardWater: () => makeSealGuardian('water'), blacksmith: makeBlacksmith, fisherman: makeFisherman,
  shepherd: makeShepherd, elder: makeElder,
  priest: () => makeTemplePriest(3), weaponsmith: () => makeWeaponsmith(3), armourer: () => makeArmourer(3), trader: () => makeTrader(3), alchemist: () => makeAlchemist(3), crafter: () => makeCrafter(3),
  guard: () => makeGuard(3), guardSparta: () => makeGuard(4, '#a8261e', 'sparta'), scholar: () => makeScholar(3), farmer: () => makeFarmer(3), acolyte: () => makeTemplePriest(5, '#d8a838', { broom: true }),
  apollo: makeApollo, ares: makeAres, artemis: makeArtemis, hermes: makeHermes, hephaestus: makeHephaestus, aphrodite: makeAphrodite, hestia: makeHestia,
  demeter: makeDemeter, hera: makeHera, dionysus: makeDionysus, heracles: makeHeracles, achilles: makeAchilles, odysseus: makeOdysseus, perseus: makePerseus,
  hecate: makeHecate, atlas: makeAtlas, prometheus: makePrometheus, circe: makeCirce, pan: makePan, eros: makeEros, persephone: makePersephone, hebe: makeHebe,
  morpheus: makeMorpheus, thanatos: makeThanatos, typhon: makeTyphon, scylla: makeScylla, charybdis: makeCharybdis, oracle: makeOracle, selene: makeSelene,
  gaia: makeGaia, kronos: makeKronos, ouranos: makeOuranos, helios: makeHelios,
};
