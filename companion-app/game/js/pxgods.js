// Pixel-art gods and heroes (round 16): their own parts painted texel by texel like V's war outfit (pxWar in models.js):
// crowns and helms, armour and aegis, wings, weapons and attributes, special robes, glowing things. The cast.js makers
// build these under PXART (the shared dress kit, robes, beards, sandals..., is dressed by the kit itself).
// Painters take a palette (darkest first), so one painter serves every god's colours; every texture and material is cached.
// Shapes with holes (feathers, flames, bolts, leaves) are cut-outs: transparent texels, alphaTest, both sides, no outline
// (the dark edge is painted in) and fx (never flashed white). seal(r) merges the parts per joint and material with their
// UVs and lists them in r.pxParts, so bake() leaves them alone.
import * as THREE from './three.module.min.js';
import { mat, box, tcyl, ball, cone, pivot, refineRig } from './models.js';
import { toonRamp } from './render.js';
import { PXART, ramp, paOnce, paTex, stud, rivet, paScallops, paFur, paGrit, paLeather, pxEye, paTile, skin as tileSkin } from './pxart.js';
export { PXART };
const PI = Math.PI;

// ---------- palettes, darkest first (shades drift purple, lights warm, metals end in a white glint) ----------
export const AU = ['#4a2414', '#8a4a1c', '#c8862e', '#eab448', '#f8dc78', '#fffbe0']; // gold (T[3], the base, is the game's gold)
export const BZ = ['#3a1c14', '#6e3c1c', '#a8682e', '#cf9a48', '#ecc472', '#fff4c8']; // bronze
export const AG = ['#24263a', '#4c5068', '#868ea8', '#bcc4d8', '#e4eaf4', '#ffffff']; // silver
export const FE = ['#121218', '#262630', '#40424e', '#626674', '#9298a6', '#d4d8e2']; // iron
export const AQ = ['#1a2a40', '#2e5070', '#4f86a6', '#86bcd4', '#c4e6f0', '#ffffff']; // sea silver
export const WD = ['#1c1012', '#3a2118', '#5a3820', '#7c542c', '#a07438', '#c49a58']; // wood
const R6 = (h) => _fc.set(h).getHSL(_fh).l > .78 ? FP(h) : ramp(h, 6), X = (h) => typeof h === 'string' ? R6(h) : h; // (pale colours: FP below)
// feathers: ramp() flattens near-white and near-black (a white wing came out all white with brown seams), so plumage gets
// shades scaled from its own lightness, cooled toward violet like the rig's shade, and highlights toward white
const _fc = new THREE.Color(), _fh = {};
const FP = (hex) => paOnce('gFP' + hex, () => { _fc.set(hex).getHSL(_fh); const { h, s, l } = _fh, C = s * (1 - Math.abs(2 * l - 1)), to = ((.72 - h + 1.5) % 1) - .5;
  return [.38, .6, .8, 1, -.3, -.55].map((f) => { const L = f > 0 ? l * f : l + (1 - l) * -f, d = f > 0 ? 1 - f : 0; // (chroma kept, not HSL saturation: a white's shade is grey-violet, not brown)
    return '#' + _fc.setHSL(d && (C < .12 || l > .78) ? .68 : (h + to * d * .5 + 1) % 1, d && (C < .12 || l > .78) ? .1 + d * .15 : Math.min(1, C / Math.max(.05, 1 - Math.abs(2 * L - 1)) + d * .25), L).getHexString(); }); }); // (pale or grey: shade to a soft violet grey)

// ---------- materials ----------
// a spec is [key, W, H, paint]; the key names the painter and its palette, so equal specs share one texture
const M = (s) => paOnce('gM' + s[0], () => new THREE.MeshToonMaterial({ map: paTex('g.' + s[0], s[1], s[2], s[3]), gradientMap: toonRamp() }));
const MB = (s, o = {}) => paOnce('gB' + s[0] + JSON.stringify(o), () => new THREE.MeshBasicMaterial({ map: paTex('g.' + s[0], s[1], s[2], s[3]), ...o }));
const MC = (s, basic, o = {}) => paOnce('gC' + s[0] + !!basic + JSON.stringify(o), () => { const q = { map: cutTex(s[0], s[1], s[2], s[3]), alphaTest: .5, side: THREE.DoubleSide, ...o }; return basic ? new THREE.MeshBasicMaterial(q) : new THREE.MeshToonMaterial({ ...q, gradientMap: toonRamp() }); });
const flat = (c) => mat(c);
// ico balls (models.js ball): three's polyhedron UVs (v flipped again on upload) put canvas row 0 at the ball's TOP, the
// front at u .75 (checked on a render: r16/gods/uvtest). The ball painters below are drawn bottom-up (row 0 = the underside,
// lit rows last), so up() turns each over: its rows mirrored, its key changed (one test render showed them all upside down)
const up = (s) => ['^' + s[0], s[1], s[2], (c) => { const H = c.H, P = (i, j, col) => c.P(i, H - 1 - Math.round(j), col);
  s[3]({ ...c, P, R: (i, j, w, h, col) => c.R(i, H - j - h, w, h, col), S: (i, j, col) => { P(c.F + i, j, col); P(c.F - 1 - i, j, col); } }); }];
function cutTex(key, W, H, paint) { // paTex for cut-outs: unpainted texels stay clear; far-off mips keep the shape (a block is solid if any texel is)
  return paOnce('gT' + key, () => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { willReadFrequently: true }); // (cutHalf reads it back: keep it off the GPU)
    let seed = 7; for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647 || 1;
    const R = (i, j, w, h, col) => { x.fillStyle = col; x.fillRect(i, j, w, h); };
    const P = (i, j, col) => { i = Math.round(i); j = Math.round(j); if (i >= 0 && j >= 0 && i < W && j < H) R(i, j, 1, 1, col); }, F = W >> 1;
    paint({ W, H, F, R, P, S: (i, j, col) => { P(F + i, j, col); P(F - 1 - i, j, col); }, rnd: () => (seed = seed * 16807 % 2147483647) / 2147483647, cut: true });
    const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; t.generateMipmaps = false;
    t.mipmaps = [cv]; for (let m = cv; m.width > 1 || m.height > 1;) t.mipmaps.push(m = cutHalf(m));
    return t;
  });
}
function cutHalf(src) {
  const w = src.width, h = src.height, W = Math.max(1, w >> 1), H = Math.max(1, h >> 1), s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }), o = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let best = -1, bn = 0;
    for (let q = 0; q < 4; q++) {
      const k = (Math.min(h - 1, j * 2 + (q >> 1)) * w + Math.min(w - 1, i * 2 + (q & 1))) * 4; if (s[k + 3] < 128) continue;
      let n = 0; for (let u = 0; u < 4; u++) { const k2 = (Math.min(h - 1, j * 2 + (u >> 1)) * w + Math.min(w - 1, i * 2 + (u & 1))) * 4; if (s[k2 + 3] >= 128 && s[k2] === s[k] && s[k2 + 1] === s[k + 1] && s[k2 + 2] === s[k + 2]) n++; }
      if (n > bn) { best = k; bn = n; }
    }
    if (best >= 0) o.data.set([s[best], s[best + 1], s[best + 2], 255], (j * W + i) * 4);
  }
  x.putImageData(o, 0, 0); return c;
}

// ---------- building: every part made here is collected, then merged or kept by seal() ----------
let OWN = [], LIVE = [];
const own = (m) => (OWN.length > 3000 && (OWN = OWN.slice(-1500)), OWN.push(m), m); // (bounded: rigs that use the shared helpers but never seal, e.g. winged monsters, must not pile up here)
export const live = (m) => (LIVE.length > 600 && (LIVE = LIVE.slice(-300)), LIVE.push(m), m); // animated by the god's tick: never merged
// models.js builders wearing material(s) mt; cylinders and cones are turned half round so their texture's front (u .5) faces +z
// (rotation order ZXY: the half turn applies first, so a later .rotation.x / .z tilts the part as it would the plain one)
export const cy = (p, rt, rb, h, mt, x = 0, y = 0, z = 0, seg = 10, o) => { const m = own(tcyl(p, rt, rb, h, null, x, y, z, seg, { ...o, material: mt })); m.rotation.order = 'ZXY'; m.rotation.y = PI; return m; };
export const bx = (p, w, h, d, mt, x = 0, y = 0, z = 0, o) => own(box(p, w, h, d, null, x, y, z, { ...o, material: mt }));
export const bl = (p, rad, mt, x = 0, y = 0, z = 0, det = 1, o) => own(ball(p, rad, null, x, y, z, det, { ...o, material: mt }));
export const cn = (p, rad, h, mt, x = 0, y = 0, z = 0, seg = 6, o) => { const m = own(cone(p, rad, h, null, x, y, z, seg, { ...o, material: mt })); m.rotation.order = 'ZXY'; m.rotation.y = PI; return m; };
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export const aim = (m, x, y, z) => { m.quaternion.setFromUnitVectors(_up, _d.set(x, y, z).normalize()); return m; }; // point a part's +y along (x, y, z)
let qGeo = null;
export const quad = (p, w, h, mt, x = 0, y = 0, z = 0) => { const q = new THREE.Mesh(qGeo ||= new THREE.PlaneGeometry(1, 1), mt); q.scale.set(w, h, 1); q.position.set(x, y, z); q.castShadow = false; q.userData.fx = true; p.add(q); return own(q); };
const NS = { noShadow: true };
export function seal(r) { // merge my static parts per joint + material (with UVs); r.pxParts lists everything (bake keeps its hands off)
  refineRig(r); // round 33: rounder parts before they are merged (models.js)
  const groups = new Map(), live = new Set(LIVE), under = (m) => { for (let o = m; o; o = o.parent) if (o === r.root) return true; return false; }, keep = LIVE.filter(under);
  for (const m of OWN) {
    if (live.has(m) || !under(m)) continue; // (parts of a rig that never sealed, e.g. another maker's wings: bake() takes those)
    m.updateMatrix();
    if (!m.parent || Array.isArray(m.material) || m.children.length || m.matrix.determinant() < 0) { keep.push(m); continue; }
    const k = m.parent.uuid + m.material.uuid + m.castShadow; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m);
  }
  for (const list of groups.values()) {
    if (list.length < 2) { keep.push(list[0]); continue; }
    const parts = list.map((m) => { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
    const n = parts.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0; for (const g of parts) { const A = g.attributes; pos.set(A.position.array, o * 3); nor.set(A.normal.array, o * 3); if (A.uv) uv.set(A.uv.array, o * 2); o += A.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m0 = list[0], mm = new THREE.Mesh(geo, m0.material); mm.castShadow = m0.castShadow; mm.userData.fx = m0.userData.fx; m0.parent.add(mm);
    for (const m of list) m.removeFromParent(); keep.push(mm);
  }
  (r.pxParts ||= []).push(...keep); OWN = []; LIVE = [];
  return r;
}

// ---------- painting helpers (c: the paTex kit, R / P / S / W / H / F / rnd) ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function line(c, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (let n = 0; n < 999; n++) { c.P(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
// a tapered stroke from (x0, y0) to (x1, y1), half-width w0 -> w1; f(t along 0..1, s across -1..1, edge) gives a colour or null
function stroke(c, x0, y0, x1, y1, w0, w1, f) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, m = Math.max(w0, w1) + 1;
  for (let j = Math.floor(Math.min(y0, y1) - m); j <= Math.ceil(Math.max(y0, y1) + m); j++) for (let i = Math.floor(Math.min(x0, x1) - m); i <= Math.ceil(Math.max(x0, x1) + m); i++) {
    const px = i + .5, py = j + .5, t = clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1), w = w0 + (w1 - w0) * t, d = Math.hypot(px - x0 - dx * t, py - y0 - dy * t);
    if (d > w) continue;
    const sd = Math.sign((px - x0) * dy - (py - y0) * dx) || 1, col = f(t, sd * d / w, w - d < 1); if (col) c.P(i, j, col);
  }
}
function ell(c, cx, cy, rx, ry, f) { // filled ellipse; f(nx, ny, edge) -> colour or null
  for (let j = Math.floor(cy - ry - 1); j <= cy + ry + 1; j++) for (let i = Math.floor(cx - rx - 1); i <= cx + rx + 1; i++) {
    const nx = (i + .5 - cx) / rx, ny = (j + .5 - cy) / ry, d = nx * nx + ny * ny; if (d > 1) continue;
    const col = f(nx, ny, Math.hypot((i + .5 - cx) / Math.max(1, rx - 1), (j + .5 - cy) / Math.max(1, ry - 1)) > 1); if (col) c.P(i, j, col);
  }
}
const tile = (c, rows, x0, y0, col) => rows.forEach((row, j) => [...row].forEach((ch, i) => { const k = col[ch]; if (k) c.P(x0 + i, y0 + j, k); }));
// ASCII motifs (X = groove / mark, o = highlight)
const TILE = {
  key: ['.XXXXXX.', '.X....X.', '.X.XX.X.', '.X..X.X.', '.XXXX.X.', 'XX....XX'],
  bead: ['......', '.XX..X', 'XXXX.X', 'XXXX.X', '.XX..X', '......'],
  zig: ['X.....', '.X...X', '..X.X.', '...X..'],
  egg: ['.XXX.X', 'X...XX', 'X...XX', 'X...XX', '.XXX.X', '..X..X'],
};

// ---------- painters: each returns a spec [key, W, H, paint] ----------
// a metal band round a cylinder (crowns, collars, rings): lit roll on top, dark lip under, an engraved running motif,
// optionally a set gem at the front
export const trim = (T, motif = 'key', H = 10, G = null, W = 128) => ['trim' + T + motif + H + G + W, W, H, (c) => {
  const { R, P, W: w, F } = c;
  R(0, 0, w, H, T[3]); R(0, 0, w, 1, T[5]); R(0, 1, w, 1, T[4]); R(0, H - 3, w, 1, T[2]); R(0, H - 2, w, 1, T[1]); R(0, H - 1, w, 1, T[0]);
  for (let x = 3; x < w; x += 16) { P(x, 1, T[5]); P(x + 1, 1, T[5]); }
  const body = H - 4, y0 = 2;
  if (motif === 'wave') for (let x = 0; x < w; x++) { const y = y0 + Math.round((body - 1) / 2 + (body - 2) / 2 * Math.sin(x / 8 * PI * 2)); P(x, y, T[1]); P(x, y + 1, T[4]); if (x % 8 === 2) { P(x + 1, y + 1, T[1]); P(x, y + 2, T[5]); } }
  else if (motif === 'dots') for (let x = 2; x < w; x += 5) { R(x, y0 + (body >> 1) - 1, 2, 2, T[4]); P(x + 1, y0 + (body >> 1), T[1]); P(x, y0 + (body >> 1) - 1, T[5]); }
  else if (TILE[motif]) { const t = TILE[motif], th = t.length, tw = t[0].length, oy = y0 + Math.max(0, (body - th) >> 1); for (let x = 0; x < w; x += tw) tile(c, t.slice(0, body), x, oy, { X: T[1] }); for (let x = 0; x < w; x++) for (let j = oy + 1; j < y0 + body; j++) if (t[j - oy - 1] && t[j - oy - 1][x % tw] === 'X' && !(t[j - oy] && t[j - oy][x % tw] === 'X')) P(x, j, T[4]); }
  if (G) { // a cabochon in a lit setting, a white glint top left
    const gh = H - 2, gw = Math.max(4, gh - 1);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const nx = (i + .5) / gw * 2 - 1, ny = (j + .5) / gh * 2 - 1, d = nx * nx + ny * ny; if (d > 1.15) continue;
      P(F - (gw >> 1) + i, 1 + j, d > .7 ? (ny < 0 ? T[4] : T[1]) : nx + ny < -.6 ? G[4] : nx + ny > .5 ? G[1] : G[2]); }
    P(F - (gw >> 1) + 1, 2, '#ffffff');
  }
}];
// a spike or point (crown points, prong tips) on a cone: a lit facet beside a ridge, a white glint up the tip
export const spike = (T) => ['spike' + T, 16, 24, (c) => {
  const { R, P, F, W, H } = c;
  R(0, 0, W, H, T[3]); R(F - 6, 0, 6, H, T[4]); R(F - 1, 0, 1, H, T[5]); R(F + 1, 0, 4, H, T[2]); R(0, 0, 3, H, T[2]); R(W - 3, 0, 3, H, T[2]);
  R(0, 0, W, 3, T[4]); R(F - 2, 0, 3, 5, T[5]); R(0, H - 3, W, 2, T[1]); R(0, H - 1, W, 1, T[0]);
  for (let j = 6; j < H - 4; j += 4) P(F - 3, j, T[5]);
}];
// small metal parts (bars, collars, prongs): lit top, shaded foot, a glint and a few hammer dents
export const metal = (T, W = 16, H = 16) => ['metal' + T + W + H, W, H, (c) => {
  const { R, P, rnd } = c;
  R(0, 0, W, H, T[3]); R(0, 0, W, 2, T[4]); R(0, 0, W, 1, T[5]); R(0, H - 4, W, 2, T[2]); R(0, H - 2, W, 1, T[1]); R(0, H - 1, W, 1, T[0]);
  R(0, 0, 1, H, T[2]); R(W - 1, 0, 1, H, T[1]); R(2, 2, 2, 1, T[5]); P(2, 3, T[4]);
  for (let k = 0; k < W * H / 40; k++) { const x = 1 + (rnd() * (W - 2) | 0), y = 3 + (rnd() * (H - 7) | 0); P(x, y, T[2]); P(x + 1, y + 1, T[4]); }
}];
// a metal ball (studs, finials, pommels) on a models.js ico ball (drawn bottom-up, turned over by up(); the front at u .75)
export const orb = (T, W = 32, H = 16) => up(['orb' + T + W + H, W, H, (c) => {
  const { R, P } = c, f = Math.round(W * .75);
  for (let j = 0; j < H; j++) { const t = j / (H - 1); R(0, j, W, 1, t > .85 ? T[4] : t > .6 ? T[3] : t > .3 ? T[2] : t > .12 ? T[1] : T[0]); }
  R(f - 4, H - 4, 3, 2, T[5]); P(f - 2, H - 5, T[4]); R(f - 6, H - 6, 2, 1, T[4]);
}]);
// a faceted gem ball (same UVs): a deep body, lit facets up top, a white glint, a dark sparkle line
export const gem = (G) => up(['gem' + G, 32, 16, (c) => {
  const { R, P } = c, f = 24;
  for (let j = 0; j < 16; j++) R(0, j, 32, 1, j > 12 ? G[4] : j > 8 ? G[3] : j > 4 ? G[2] : G[1]);
  for (let x = 0; x < 32; x += 4) { P(x, 10, G[4]); P(x + 1, 6, G[1]); P(x + 2, 3, G[0]); }
  R(f - 4, 12, 3, 2, '#ffffff'); P(f - 1, 13, G[5] || '#ffffff');
}]);
// bare god's torso on the chest cylinder (128 x 48, u .5 front): collarbones, the pecs' shadow, a six-pack beside the
// linea alba, obliques, the navel; the spine and shoulder blades behind. The base is the skin colour itself (arms match).
export const skinTorso = (SK) => ['skin' + SK, 128, 48, (c) => {
  const { R, P, S, W, H, F } = c, K = R6(SK), hi = K[4], sh = K[2], dp = K[1];
  R(0, 0, W, H, SK);
  for (let i = 4; i < 22; i++) { const y = 2 + Math.round(i * .1); S(i, y, sh); if (i % 3) S(i, y - 1, hi); } // collarbones
  for (let i = 0; i < 24; i++) { const y = 20 + Math.round(2.5 * Math.sqrt(Math.max(0, 1 - ((i - 11) / 13) ** 2))); S(i, y, sh); S(i, y + 1, K[3]); } // under the pecs
  for (let j = 21; j < 44; j++) { S(0, j, sh); if (j % 2) S(1, j, K[3]); } // linea alba
  for (const [y0, y1] of [[23, 29], [30, 36], [37, 43]]) { // three rows of abs each side
    for (let i = 2; i < 9; i++) { S(i, y1, sh); if (i < 8) S(i, y0, hi); }
    for (let j = y0; j <= y1; j++) { S(9, j, sh); if (j > y0 && j < y1 - 1) S(2, j, hi); }
    S(3, y0 + 1, hi); S(8, y1 - 1, K[3]);
  }
  for (let k = 0; k < 4; k++) for (let t = 0; t < 4; t++) S(12 + t + k * 2, 24 + k * 5 + t, sh); // serratus / obliques
  for (let i = 0; i < 12; i++) S(10 + i, 46 - Math.round(i * .5), sh); // iliac line
  R(F - 1, 44, 2, 2, dp); P(F - 1, 43, sh); P(F, 46, hi); // navel
  for (let j = 6; j < 42; j++) { P(0, j, sh); if (j % 3) P(1, j, hi); } // spine (u 0 = back)
  for (const sx of [-1, 1]) for (let t = 0; t < 14; t++) { const a = t / 13 * PI; P(sx * (8 + Math.round(6 * Math.sin(a))), 8 + t, sh); }
}];
// a muscle cuirass on the chest cylinder (128 x 48): sculpted pecs and abs in relief, a central groove, rolled neck,
// arm and hem rims, side hinges with rivets; o.gorgon a tiny gorgoneion on the breast, o.lin: linen (corslet) instead of metal
export const cuirass = (T, o = {}) => ['cuir' + T + JSON.stringify(o), 128, 48, (c) => {
  const { R, P, S, W, H, F } = c;
  R(0, 0, W, H, T[2]);
  for (let i = 0; i < 26; i++) for (let j = 4; j < 22; j++) { // the pecs: a domed plate each side, lit from top left
    const nx = (i - 12) / 13, ny = (j - 12) / 9, d = nx * nx + ny * ny; if (d > 1) continue;
    S(i, j, d > .82 ? (ny > 0 ? T[0] : T[3]) : ny < -.35 && nx < .3 ? T[4] : ny > .5 ? T[1] : T[3]);
  }
  for (let i = 0; i < 26; i++) { const y = 12 + Math.round(9 * Math.sqrt(Math.max(0, 1 - ((i - 12) / 13) ** 2))); S(i, y + 1, T[1]); }
  for (const sx of [-1, 1]) { P(F + sx * 12 - (sx < 0 ? 1 : 0), 13, T[0]); P(F + sx * 12 - (sx < 0 ? 1 : 0), 12, T[4]); } // nipples
  for (let j = 3; j < 46; j++) { P(F, j, T[0]); P(F - 1, j, j < 22 ? T[1] : T[3]); } // the central groove
  for (const [y0, y1] of [[24, 30], [31, 37], [38, 43]]) for (let i = 1; i < 9; i++) for (let j = y0; j < y1; j++) { // abs in relief
    const e = i === 1 || i === 8 || j === y0 || j === y1 - 1; S(i, j, e ? (j === y1 - 1 || i === 8 ? T[1] : T[4]) : j === y0 + 1 && i < 6 ? T[4] : T[3]);
  }
  for (let i = 0; i < 14; i++) { S(10 + i, 44 - Math.round(i * .45), T[0]); S(10 + i, 43 - Math.round(i * .45), T[4]); } // iliac edge
  R(0, 0, W, 1, T[4]); R(0, 1, W, 1, T[3]); R(0, 2, W, 1, T[0]); // rolled neck rim
  R(0, H - 3, W, 1, T[4]); R(0, H - 2, W, 1, T[3]); R(0, H - 1, W, 1, T[0]); // hem rim
  for (const x of [W >> 2, 3 * W >> 2]) { // side seams: hinged, riveted
    for (let j = 3; j < H - 3; j++) { P(x, j, T[0]); P(x + 1, j, T[4]); }
    for (let j = 8; j < H - 6; j += 9) rivet(c, x - 3, j, [T[0], T[1], T[2], T[3], T[4], T[5]]);
  }
  for (let i = 0; i < W; i += 12) rivet(c, i + 6, H - 6, T); // a row of rivets above the hem
  if (o.gorgon) { const G = { o: T[0], s: '#3f7a32', f: T[4], e: '#ffffff', k: '#1a0e0e', m: '#a8241e' };
    tile(c, ['.s.s.s.', 's.ooo.s', '.offfo.', 'ofefefo', 'offkffo', '.ommmo.', '..ooo..'], F - 4, 13, G); }
  for (let j = 4; j < 22; j++) { P(0, j, T[1]); P(1, j, T[3]); } // the back plate's spine
}];
// leather or linen pteruges: a stitched border, a lit fold, a rivet on top, a rounded tip (a boss on studded ones)
export const strip = (Q, studded, T = AG) => ['strip' + Q + studded + T, 11, 40, (c) => {
  const { R, P, W, H } = c;
  R(0, 0, W, H, Q[2]); R(0, 0, 1, H, Q[0]); R(W - 1, 0, 1, H, Q[0]); R(1, 0, 1, H, Q[3]); R(W - 2, 0, 1, H, Q[1]); R(0, 0, W, 1, Q[1]);
  for (let j = 4; j < H - 5; j += 2) { P(2, j, Q[4]); P(W - 3, j, Q[4]); }
  R(4, 7, 1, H - 17, Q[3]); R(5, 10, 1, H - 24, Q[4]); R(7, 12, 1, H - 26, Q[1]); rivet(c, 5, 1, T);
  R(0, H - 4, W, 4, Q[0]); R(1, H - 4, W - 2, 1, Q[2]); R(2, H - 3, W - 4, 1, Q[1]); R(3, H - 2, W - 6, 1, Q[1]); for (let i = 2; i < W - 2; i += 2) P(i, H - 5, Q[4]);
  if (studded) stud(c, 5, H - 9, T, Q[0]);
}];
// laminated shoulder plates on a ball (ico UVs drawn bottom-up, turned by up()): three lames, each lit along its top, riveted
export const lames = (T) => up(['lames' + T, 48, 24, (c) => {
  const { R, P, W, H } = c;
  R(0, 0, W, H, T[1]); R(0, H - 5, W, 5, T[4]); R(0, H - 2, W, 2, T[5]);
  for (const y of [H - 6, H - 12, H - 18]) { R(0, y, W, 1, T[0]); R(0, y - 1, W, 1, T[4]); R(0, y - 3, W, 2, T[3]); R(0, y - 5, W, 2, T[2]); for (let x = 2; x < W; x += 8) P(x + (y % 4), y - 3, T[5]); }
}]);
// cloth with soft folds and a hemmed border, for a god's own draperies (u around a cylinder, or a box face; row 0 the top):
// o.hem: a trim palette and motif along the bottom; o.tilt: folds lean
export const cloth = (C, o = {}) => ['cloth' + C + JSON.stringify(o), o.W || 96, o.H || 48, (c) => {
  const { R, P, W, H, rnd } = c, tilt = o.tilt || 0, hy = o.hem ? H - (o.hemH || 8) : H;
  R(0, 0, W, H, C[3]); R(0, 0, W, 1, C[4]);
  for (let x = 0; x < W; x += 8 + (rnd() * 5 | 0)) for (let j = 1; j < hy; j++) { const xx = x + Math.round(j * tilt); P(xx, j, C[1]); P(xx + 1, j, C[2]); if (j > 2 && j < hy - 3) P(xx - 1, j, C[4]); if ((j + x) % 9 === 0) P(xx + 2, j, C[2]); }
  if (o.hem) { const T = X(o.hem[0]); R(0, hy, W, H - hy, T[2]); R(0, hy, W, 1, T[4]); R(0, H - 1, W, 1, T[0]); R(0, H - 2, W, 1, T[1]);
    const t = TILE[o.hem[1] || 'key']; if (t) for (let x = 0; x < W; x += t[0].length) tile(c, t.slice(0, H - hy - 3), x, hy + 1, { X: T[0] }); }
}];
// overlapping scales (aegis, scale armour, serpents): each lit top left with a dark lower rim; rows offset
export const scales = (T, sw = 6, shh = 8, W = 96, H = 32, rim) => ['scales' + T + sw + shh + W + H + rim, W, H, (c) => {
  paScallops(c, T, { w: sw, h: shh, step: Math.max(2, Math.round(shh * .5)), glint: .35, rim: 0 });
  if (rim) { const Q = X(rim), { R } = c; R(0, 0, W, 1, Q[5]); R(0, 1, W, 1, Q[4]); R(0, 2, W, 1, Q[1]); R(0, H - 2, W, 1, Q[4]); R(0, H - 1, W, 1, Q[0]); }
}];
// a medallion on a cylinder cap (the cap is the inscribed disc): beaded rim, a sunk field and a motif
const MOTIF = {
  eagle: ['..X....X..', '.XXX..XXX.', 'XXXXXXXXXX', 'X.XXXXXX.X', '...XXXX...', '...XXXX...', '..XX..XX..', '..X....X..'],
  shell: ['...XXXX...', '..XoXoXX..', '.XoXoXoXX.', 'XoXoXoXoXX', 'XoXoXoXoXX', '.XXXXXXXX.', '...XXXX...', '....XX....'],
  bolt: ['....XX', '...XX.', '..XXXX', '....XX', '...XX.', '..XX..', '.XX...', 'XX....'],
  owl: ['X......X', 'XX....XX', 'XXXXXXXX', 'XooXXooX', 'XokXXkoX', 'XXXooXXX', '.XXXXXX.', '.XoXXoX.', '..XXXX..'],
  sun: ['X..X..X', '.X.X.X.', '..XXX..', 'XXXoXXX', '..XXX..', '.X.X.X.', 'X..X..X'],
};
export const medal = (T, motif, F2) => ['medal' + T + motif + F2, 32, 32, (c) => {
  const { P } = c, Fd = F2 ? X(F2) : T;
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
    const x = i - 15.5, y = j - 15.5, r = Math.hypot(x, y), a = Math.atan2(y, x);
    P(i, j, r > 15 ? T[0] : r > 13 ? (Math.abs(((a / PI * 8) % 1 + 1) % 1 - .5) < .22 ? T[5] : y < 0 ? T[4] : T[3]) : r > 12 ? T[0] : (x + y < -8 && r > 9 ? Fd[3] : Fd[2]));
  }
  const t = MOTIF[motif]; if (t) { const ox = 16 - (t[0].length >> 1), oy = 16 - (t.length >> 1); tile(c, t, ox + 1, oy + 1, { X: Fd[0] }); tile(c, t, ox, oy, { X: T[4], o: T[2], k: T[0] }); }
}];
// a Corinthian helm's bowl (ico UVs drawn bottom-up, turned by up(); front u .75): a lit dome, an engraved brow band, a ridge front to back,
// a spiral on each temple
export const helmBowl = (T) => up(['helm' + T, 64, 32, (c) => {
  const { R, P } = c, W = 64, H = 32, f = 48, b = 16;
  for (let j = 0; j < H; j++) { const t = j / (H - 1); R(0, j, W, 1, t > .88 ? T[5] : t > .7 ? T[4] : t > .4 ? T[3] : T[2]); }
  for (const x of [f, b]) for (let j = 12; j < H; j++) { P(x, j, T[5]); P(x + 1, j, T[1]); P(x - 1, j, T[4]); }
  R(0, 12, W, 1, T[0]); R(0, 13, W, 1, T[4]); R(0, 15, W, 1, T[1]); for (let x = 0; x < W; x += 4) { P(x, 14, T[1]); P(x + 1, 14, T[4]); } // brow band
  for (const sx of [0, 32]) { const cx = sx + 1, cy = 20; for (let k = 0; k < 18; k++) { const a = k * .7, rr = 1 + k * .2; P(cx + Math.round(Math.cos(a) * rr), cy + Math.round(Math.sin(a) * rr * .8), T[1]); } }
  for (let x = 0; x < W; x += 6) P(x, 10, T[5]);
}]);
// the visor pushed up (its front face): two almond eye holes, a nose guard, lit brow, rivets
export const visor = (T) => ['visor' + T, 32, 12, (c) => {
  const { R, P, S, W, H } = c;
  R(0, 0, W, H, T[3]); R(0, 0, W, 1, T[5]); R(0, 1, W, 1, T[4]); R(0, H - 1, W, 1, T[0]); R(0, H - 2, W, 1, T[1]);
  for (let i = 3; i < 12; i++) { const h = Math.round(1.4 * Math.sin((i - 3) / 9 * PI)); for (let j = 6 - h; j <= 6 + h; j++) S(i, j, '#140c0a'); S(i, 7 + h, T[5]); S(i, 5 - h, T[1]); }
  for (let j = 2; j < H - 1; j++) { S(0, j, j > 4 ? T[5] : T[4]); S(1, j, T[2]); S(2, j, T[1]); }
  for (const i of [13, 14]) rivet(c, c.F + i, 3, T); rivet(c, c.F - 16, 3, T);
}];
// horsehair on a crest (a thin ball, ico UVs): strands down from the ridge, lit on top, dark at the roots
export const crest = (C) => up(['crest' + C, 48, 24, (c) => {
  const { R, P, W, H, rnd } = c;
  R(0, 0, W, H, C[3]); // (a shade brighter than the dye: the rig's cool shade darkens it again)
  for (let x = 0; x < W; x++) { const k = rnd(), top = H - 2 - (rnd() * 4 | 0); for (let j = 0; j < H; j++) { const t = j / H; P(x, j, j >= top ? C[4] : x % 3 === 0 ? C[2] : t > .55 ? (k > .5 ? C[3] : C[4]) : t > .2 ? C[3] : C[2]); } }
  R(0, H - 1, W, 1, C[5] || C[4]);
}]);
// a wooden shaft (u around, row 0 the top): grain streaks, a knot or two; o.grip [v0, v1] a leather binding; o.rings [[v, palette]]
export const wood = (Wd, o = {}) => ['wood' + Wd + JSON.stringify(o), o.W || 8, o.H || 96, (c) => {
  const { R, P, W, H, rnd } = c;
  R(0, 0, W, H, Wd[3]); for (let x = 0; x < W; x += 2) for (let j = 0; j < H; j++) if ((j + x * 7) % 11 < 6) P(x, j, Wd[2]);
  R(0, 0, 1, H, Wd[4]); R(W - 1, 0, 1, H, Wd[1]);
  for (let k = 0; k < 3; k++) { const y = 10 + (rnd() * (H - 20) | 0); P(3, y, Wd[1]); P(4, y, Wd[0]); P(3, y - 1, Wd[4]); }
  if (o.grip) { const L = ['#1c1018', '#3e2a22', '#6e4a30', '#93693e'], y0 = Math.round(o.grip[0] * H), y1 = Math.round(o.grip[1] * H); for (let j = y0; j < y1; j++) { R(0, j, W, 1, j % 3 === 0 ? L[0] : j % 3 === 1 ? L[3] : L[2]); } }
  for (const [v, pal] of o.rings || []) { const T = X(pal), y = Math.round(v * H); R(0, y, W, 1, T[4]); R(0, y + 1, W, 1, T[3]); R(0, y + 2, W, 1, T[1]); }
}];
// a leaf-shaped blade on a stretched ball (ico UVs drawn bottom-up, the tip at the canvas bottom: up() puts it on top): a bright midrib each face, honed edges
export const blade = (T) => up(['blade' + T, 32, 24, (c) => {
  const { R, P, W, H } = c;
  for (let x = 0; x < W; x++) { const a = Math.abs(((x / W * 4) % 2) - 1); R(x, 0, 1, H, a > .8 ? T[5] : a > .55 ? T[4] : a > .25 ? T[3] : a > .1 ? T[2] : T[4]); }
  R(0, 0, W, 2, T[1]); for (let x = 0; x < W; x += 8) P(x + 1, H - 3, T[5]);
}]);
// a cut-out lightning bolt: a white-hot core, yellow flesh, an orange rim, two forks
export const bolt = () => ['bolt2', 24, 60, (c) => {
  const pts = [[14, 1], [8, 19], [16, 22], [8, 39], [15, 42], [7, 59]], Y = ['#d88a18', '#ffd040', '#fff6a0', '#ffffff'];
  const seg = (a, b, w0, w1, core = .45) => stroke(c, a[0], a[1], b[0], b[1], w0, w1, (t, s, e) => e ? Y[0] : Math.abs(s) < core ? Y[3] : Math.abs(s) < .75 ? Y[2] : Y[1]);
  seg([16, 22], [22, 31], 1.8, .9, .3); seg([15, 42], [20, 51], 1.6, .8, .3); seg([8, 19], [3, 11], 1.5, .8, .3);
  for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], 4 - i * .35, 3.7 - i * .35);
}];
// a soft pixel glow (unlit, see-through): rings fading out with a checker dither at each step
export const glow = (G, W = 32) => ['glow2' + G + W, W, W, (c) => { // (cut-out: the dither's holes are see-through)
  const h = W / 2;
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { const r = Math.hypot(i + .5 - h, j + .5 - h) / h; if (r > 1 || (r > .72 && (i % 2 || j % 2)) || (r > .45 && r <= .72 && (i + j) % 2)) continue; c.P(i, j, r < .25 ? G[4] : r < .45 ? G[3] : r < .72 ? G[2] : G[1]); }
}];
// sea foam on a torus (u along the ring, v round the tube): white crests broken by blue troughs
export const foam = () => ['foam', 64, 8, (c) => {
  const { R, P, W } = c, F = ['#2f7ac0', '#5fb6ea', '#9fe0ff', '#e8fbff', '#ffffff'];
  R(0, 0, W, 8, F[1]); for (let x = 0; x < W; x++) { const k = (x * 5) % 13; P(x, 1 + (k % 3), F[3]); P(x, 2 + (k % 2), F[2]); if (k < 4) P(x, 0, F[4]); if (k > 9) { P(x, 5, F[0]); P(x, 6, F[0]); } }
}];
// a curly lock (Zeus's storm of hair, beards): swirls of lit strands with shadowed hollows; ico UVs
export const curl = (Hc) => up(['curl' + Hc, 32, 16, (c) => {
  const { R, P, W, H } = c; R(0, 0, W, H, Hc[3]);
  for (let x = 0; x < W; x += 8) for (let k = 0; k < 10; k++) { const a = k * .62, rr = 1 + k * .3, i = x + 4 + Math.round(Math.cos(a) * rr), j = 8 + Math.round(Math.sin(a) * rr); P(i, j, Hc[1]); P(i, j + 1, Hc[4]); }
  R(0, H - 3, W, 3, Hc[4]); for (let x = 0; x < W; x += 5) P(x, H - 1, Hc[5]); R(0, 0, W, 3, Hc[2]);
}]);
// serpents: green scales with a dark belly line, for snake hair, aegis fringes, the caduceus
// a ball of curly hair (ico UVs drawn bottom-up, turned by up()): shaded by height, a few locks each a curved shadow line with a glint (sparse:
// the kit's curl tile, a regular strand pattern, read as dice on a ball)
export const curlBall = (Q) => up(['curlB3' + Q, 48, 24, (c) => {
  const { R, P, rnd } = c;
  for (let j = 0; j < 24; j++) R(0, j, 48, 1, j < 4 ? Q[1] : j < 9 ? Q[2] : j < 18 ? Q[3] : Q[4]);
  for (let k = 0; k < 9; k++) { const cx = (k * 5.3 + rnd() * 2) | 0, cy = 8 + (k % 3) * 5 + (rnd() * 2 | 0); // a few locks: a shaded lower curve, a glint above it
    for (let t = 0; t < 6; t++) P(cx + t, cy - Math.round(Math.sin(t / 5 * PI) * 2), cy > 14 ? Q[2] : Q[1]); P(cx + 2, cy + 1, Q[5]); P(cx + 3, cy + 1, Q[4]); }
}]);
export const curlMat = (hex) => M(curlBall(R6(hex))); // a curly lock in a hair colour
export const snake = (Sg = '#3f7a32') => scales(X(Sg), 4, 5, 32, 16);

// ---------- shared god pieces ----------
// re-dress the humanoid's chest cylinder (a bare torso or a cuirass), turned so the texture's front faces forward
const chestOf = (r) => r.torso.children.find((o) => o.isMesh && o.geometry.parameters?.radiusTop === .25 && o.geometry.parameters?.height === .5);
export function chest(r, spec, cap) { const m = chestOf(r); if (!m) return; m.material = [M(spec), flat(cap), flat(cap)]; m.rotation.y = PI; own(m); return m; }
export const skin = (r, SK) => chest(r, skinTorso(SK), SK);
// a medallion brooch: disc with a beaded rim and a motif, tilted to face out
export function brooch(p, rad, T, motif, x, y, z, tilt = PI / 2 - .3, F2) { const m = cy(p, rad, rad, .03, [M(metal(T)), M(medal(T, motif, F2)), M(medal(T, motif, F2))], x, y, z, 12, NS); m.rotation.set(tilt, PI / 2, 0); return m; } // the cap's motif upright
// a crown: a band with a running motif (a gem in front) and points round the brow (the front one taller)
export function crown(head, T, o = {}) {
  const rad = o.rad ?? .222, y = o.y ?? .36, h = o.h ?? .06, z = o.z ?? -.03, n = o.n ?? 7, sp = o.spread ?? .42, G = o.gem && X(o.gem);
  const b = cy(head, rad, rad + (o.flare || 0), h, M(trim(T, o.motif || 'key', o.H || 10, G)), 0, y, z, 12); b.scale.z = o.sz ?? 1;
  const sm = M(spike(T));
  for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * sp, mid = i === (n - 1) >> 1 && n % 2; const k = cn(head, o.pr ?? .035, (o.ph ?? .13) + (mid ? o.mid ?? .06 : 0), sm, Math.sin(a) * rad, y + h / 2 + ((o.ph ?? .13) + (mid ? o.mid ?? .06 : 0)) / 2 - .01, z + Math.cos(a) * rad * (o.sz ?? 1), 4); k.rotation.set(Math.cos(a) * (o.lean ?? .12), PI + a, -Math.sin(a) * (o.lean ?? .12)); /* lit face out, leaning out */ if (G && mid) bl(head, .022, M(gem(G)), Math.sin(a) * (rad + .01), y + h / 2 + .03, z + Math.cos(a) * (rad + .01), 0, NS); }
  return b;
}
// a staff or spear shaft along the hand's y (like cast.js staff()): textured wood with a grip, rings, a butt cap
export function shaft(hand, Wd, len, top, o = {}) { const g = new THREE.Group(); hand.add(g); const v = (top + len / 2) / len; cy(g, o.r ?? .032, (o.r ?? .032) * 1.18, len, M(wood(Wd, { grip: [v - .06, v + .07], rings: o.rings })), 0, top, .03, 6); return g; }
// a leaf-bladed spearhead with a socket collar
export function spearHead(g, T, y, s = 1) { const b = bl(g, .06 * s, M(blade(T)), 0, y + .15 * s, .03, 1); b.scale.set(1, 3.4, .32); cy(g, .04 * s, .05 * s, .09 * s, M(trim(T, 'dots', 8, null, 32)), 0, y - .04 * s, .03, 8); return b; }

// ================================================= the gods =================================================
export function poseidon(r, o) { // o: { BLUE, foam: his foam tori }; returns the trident
  const SEA = R6('#3aa4c4');
  crown(r.head, AU, { motif: 'wave', gem: SEA, y: .36, h: .06, ph: .13, mid: .07, lean: .14 });
  for (let i = 0; i < 6; i++) { const a = (i - 2.5) * .42; bl(r.head, .016, M(orb(AG)), Math.sin(a) * .225, .4, -.03 + Math.cos(a) * .225, 0, NS); } // pearls between the points
  brooch(r.torso, .06, AU, 'shell', -.22, .6, .13);
  const B = R6(o.BLUE), bk = bx(r.torso, .2, .7, .04, [flat(B[2]), flat(B[2]), flat(B[3]), flat(B[1]), M(cloth(B, { W: 24, H: 64, hem: [AU, 'key'] })), M(cloth(B, { W: 24, H: 64, hem: [AU, 'key'] }))], -.1, .2, -.19); bk.rotation.z = -.2;
  // the trident: sea-worn bronze shaft, gold bands, barbed prongs
  const tr = shaft(r.handR, R6('#4c7a8a'), 2.5, .3, { r: .03, rings: [[.08, AU], [.28, AU]] });
  cy(tr, .05, .05, .07, M(trim(AU, 'dots', 8, SEA, 32)), 0, 1.5, .03, 8);
  const pm = M(metal(AQ, 16, 32)), sm = M(spike(AU));
  bx(tr, .34, .05, .05, M(trim(AU, 'wave', 8, null, 64)), 0, 1.56, .03);
  for (const sx of [-1, 0, 1]) {
    bx(tr, .045, sx ? .3 : .38, .045, pm, sx * .15, sx ? 1.72 : 1.76, .03);
    cn(tr, .055, .14, sm, sx * .15, sx ? 1.93 : 2.01, .03, 4);
    for (const bs of [-1, 1]) { if (sx && bs === -sx) continue; aim(cn(tr, .02, .07, sm, sx * .15 + bs * .045, sx ? 1.86 : 1.94, .03, 4), bs * .5, -.86, 0); } // barbs
  }
  const fm = MB(foam(), { transparent: true, opacity: .85 });
  for (const f of o.foam) f.material = fm;
  return tr;
}
export function zeus(r) { // gold key band with a palmette and bolt over the brow, eagle brooch
  const b = cy(r.head, .226, .226, .045, M(trim(AU, 'key', 8, null)), 0, .34, -.02, 12);
  const orn = quad(r.head, .1, .12, MC(['zorn', 12, 14, (c) => { tile(c, ['.....XX.....', '....XooX....', '...XoXXoX...', '..XoX..XoX..', '.XoXXXXXXoX.', 'XooooooooooX', '.XXXXXXXXXX.'], 0, 7, { X: AU[1], o: AU[4] }); tile(c, ['....XXX.', '...XXX..', '..XXXXX.', '....XX..', '...XX...', '..X.....', '.X......'], 2, 0, { X: '#fff3a0' }); }], true), 0, .41, .2); // gold palmette and bolt over the brow
  orn.rotation.x = -.15;
  brooch(r.torso, .065, AU, 'eagle', -.21, .6, .13);
  return b;
}
export function zeusBolt(hand) { // the thunderbolt: two crossed cut-out bolts, white-hot, and a flickering glow behind
  const g = new THREE.Group(); hand.add(g); g.position.set(0, -.05, .05);
  const bm = MC(bolt(), true), gm = paOnce('gBzglow', () => new THREE.MeshBasicMaterial({ map: cutTex(...glow(['#000000', '#ffc040', '#ffe880', '#fff6c0', '#ffffff']).slice(0, 4)), alphaTest: .5, transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }));
  for (const a of [0, PI / 2]) { const q = quad(g, .34, .85, bm, 0, .12, 0); q.rotation.y = a; }
  live(quad(g, .5, .5, gm, 0, .12, -.03));
  return { g, glowMat: gm };
}
export function athena(r, o) { // o: { BLUE, RED }: the helm, aegis with gorgoneion, himation, spear, owl shield
  const T = BZ, C = R6(o.RED);
  // Corinthian helm pushed up: engraved bowl, visor with eye holes, a crest of red horsehair on a dark holder
  const hm = bl(r.head, .225, M(helmBowl(T)), 0, .34, -.05, 1); hm.scale.set(1.02, .78, 1.08);
  const vz = bx(r.head, .3, .1, .14, [M(metal(T)), M(metal(T)), M(metal(T)), flat(T[1]), M(visor(T)), flat(T[1])], 0, .42, .14); vz.rotation.x = -.35;
  bx(r.head, .04, .05, .46, M(metal(T)), 0, .53, -.05);
  const cr = bl(r.head, .3, M(crest(C)), 0, .6, -.06, 1); cr.scale.set(.13, .55, 1.05);
  const tail = bl(r.head, .16, M(crest(C)), 0, .42, -.31, 1); tail.scale.set(.2, 1.2, .35); tail.rotation.x = .4;
  // the golden aegis: scales over the shoulders, a ring of snakes, the gorgoneion
  const ae = cy(r.torso, .24, .32, .22, M(scales([AU[2], AU[2], AU[2], AU[3], AU[4], AU[5]], 8, 9, 112, 28, AU)), 0, .55, 0, 12); ae.scale.z = .82;
  const sn = M(snake());
  for (let i = 1; i < 14; i++) { const a = i / 14 * PI * 2; aim(cn(r.torso, .028, .1, sn, Math.sin(a) * .31, .405, Math.cos(a) * .25, 4, NS), Math.sin(a) * .35, -1, Math.cos(a) * .35); bl(r.torso, .018, M(orb(R6('#3f7a32'))), Math.sin(a) * .33, .36, Math.cos(a) * .27, 0, NS); }
  const gm = cy(r.torso, .078, .078, .03, [M(metal(AU)), M(gorgon()), M(gorgon())], 0, .48, .262, 14, NS); gm.rotation.set(PI / 2 - .35, PI / 2, 0); // on the aegis
  // the blue himation wound round the hips, its border in gold key
  const B = R6(o.BLUE), him = cy(r.torso, .26, .33, .42, [M(cloth(B, { W: 96, H: 40, tilt: .15, hem: [AU, 'key'], hemH: 9 })), flat(B[2]), flat(B[1])], 0, -.12, 0, 12); him.scale.z = .82; him.rotation.z = .12;
  // spear: ash shaft, bronze leaf blade and butt spike
  const sp = shaft(r.handR, WD, 2.5, .4, { rings: [[.12, T]] });
  spearHead(sp, T, 1.62, 1.1); cn(sp, .035, .12, M(spike(T)), 0, -.88, .03, 4).rotation.x = PI;
  return sp;
}
// a round shield like cast.js roundShield (disc axis along x, the face toward -x): painted face with an emblem, riveted rim, a boss
export function shield(parent, rad, T, emb, o = {}) {
  const g = new THREE.Group(); parent.add(g); const F2 = o.field, fm = M(o.face || shFace(T, emb, F2)); // o.face: a painted face of its own (Achilles', Perseus's mirror)
  cy(g, rad, rad, .05, [M(metal(T)), fm, fm], 0, 0, 0, 16).rotation.set(0, 0, PI / 2);
  cy(g, rad + .025, rad + .025, .035, [M(shRim(T)), flat(T[1]), flat(T[1])], .012, 0, 0, 16).rotation.set(0, 0, PI / 2);
  if (o.boss) { const b = bl(g, rad * .26, M(orb(T)), -.03, 0, 0, 1); b.scale.set(.5, 1, 1); }
  return g;
}
// a shield's face on its cap (96 x 96, row 0 up): a lit rim groove, rivet ring, a sunk field with an emblem
const EMB = {
  owl: ['..XX..........XX..', '..XXX........XXX..', '...XXXXXXXXXXXX...', '..XXXXXXXXXXXXXX..', '.XXX....XX....XXX.', '.XX..oo.XX.oo..XX.', '.XX.oook..kooo.XX.', '.XX..oo.XX.oo..XX.', '.XXX....XX....XXX.', '..XXXXXXooXXXXXX..', '..XXXXXXXXXXXXXX..', '.XXXoXXoXXoXXoXXX.', 'XXXXXXXXXXXXXXXXXX', 'XXoXXoXXoXXoXXoXXX', '.XXXXXXXXXXXXXXXX.', '..XXXoXXoXXoXXXX..', '...XXXXXXXXXXXX...', '....XXXXXXXXXX....', '....XX.X..X.XX....', '...XX..X..X..XX...'],
  serpent: ['......XXXX......', '....XX....XX....', '...X..XXXX..X...', '..X.XX....X..X..', '..X.X..XX..X.X..', '..X.X.X..X.X.X..', '..X.X.X.oX.X.X..', '..X..X.XX..X.X..', '...X..X...X..X..', '....XX.XXX..X...', '.......X...X....', '......X..XX.....', '.....X.XX.......', '...XX.X.........', '..XoXX..........', '..XXX...........'],
};
export const shFace = (T, emb, F2) => ['shf' + T + emb + F2, 96, 96, (c) => {
  const { P } = c, Fd = F2 ? X(F2) : T;
  for (let j = 0; j < 96; j++) for (let i = 0; i < 96; i++) {
    const x = i - 47.5, y = j - 47.5, r = Math.hypot(x, y), a = Math.atan2(y, x) / PI / 2 + .5;
    let col = Fd[2];
    if (r > 45) col = T[0]; else if (r > 42) col = y < 0 ? T[4] : T[3]; else if (r > 40) col = T[1]; else if (r > 33 && r < 35) col = Fd[1]; else if (r < 33 && x + y < -20) col = Fd[3];
    if (r > 36 && r < 40 && Math.abs((a * 18) % 1 - .5) < .1 && Math.abs(r - 38) < 1.3) col = y < 0 ? T[5] : T[4];
    P(i, j, col);
  }
  const t = EMB[emb]; if (t) { const s = 3, ox = 48 - (t[0].length * s >> 1), oy = 48 - (t.length * s >> 1); t.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; c.R(ox + i * s, oy + j * s, s, s, ch === 'X' ? '#1c1014' : ch === 'k' ? T[1] : T[4]); })); }
}];
export const shRim = (T) => ['shr' + T, 170, 8, (c) => { const { R, W } = c; R(0, 0, W, 2, T[4]); R(0, 2, W, 2, T[3]); R(0, 4, W, 2, T[2]); R(0, 6, W, 1, T[1]); R(0, 7, W, 1, T[0]); for (let x = 0; x < W; x += 14) rivet(c, x, 3, T); }];
// Medusa's face for a gorgoneion on a cap (32 x 32): snake locks round a round face, staring eyes, a tusked grin, tongue out
export const gorgon = () => ['gorgon', 32, 32, (c) => {
  const { P } = c, S = ['#1e3a1a', '#3f7a32', '#7ab84a'], K = AU, Fc = ['#7a3c1c', '#c88a5a', '#ecc09a'];
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const x = i - 15.5, y = j - 15.5, r = Math.hypot(x, y), a = Math.atan2(y, x);
    P(i, j, r > 15 ? K[0] : r > 13.5 ? (y < 0 ? K[4] : K[3]) : r > 12.5 ? K[1] : r > 9 ? ((Math.sin(a * 9 + r * 1.3) > .2) ? S[2] : (Math.sin(a * 9 + r * 1.3) > -.4 ? S[1] : S[0])) : r > 8.4 ? Fc[0] : Fc[2]); }
  tile(c, ['.WW.....WW.', 'WkkW...WkkW', '.WW.....WW.', '.....n.....', '....nnn....', '.MMMMMMMMM.', '.MTMTTTMTM.', '..MMtttMM..', '....ttt....', '.....t.....'], 11, 10, { W: '#ffffff', k: '#1a0a0a', n: Fc[1], M: '#5a1018', T: '#ffffff', t: '#d04050' });
}];

// ---------- more painters: feathers, flames, plants, fur, stone, bone and the gods' attributes ----------
// a half-open wing as one cut-out (64 x 64, the shoulder at the top left, feathers fanning down and out): a lit leading
// edge, two rows of coverts, secondaries under the arm, long primaries off the wrist; each feather lit on one side with a
// light quill and a dark edge, B (optional) the colour of the tips
export const wing = (A, B) => ['wing2' + A + B, 64, 64, (c) => {
  const T = B || A, m = new Uint8Array(4096), c2 = { ...c, P: (i, j, col) => { i = Math.round(i); j = Math.round(j); if (i < 0 || j < 0 || i > 63 || j > 63) return; m[j * 64 + i] = 1; c.P(i, j, col); } };
  const fe = (x0, y0, x1, y1, w) => stroke(c2, x0, y0, x1, y1, w, w * .7, (t, s, e) => e ? A[1] : Math.abs(s) < .14 && t < .85 ? A[5] : t > .72 ? (s < 0 ? T[3] : T[2]) : s < -.35 ? A[4] : s > .5 ? A[2] : A[3]);
  for (let k = 5; k >= 0; k--) { const a = .95 + k * .17, L = 44 + k * 3; fe(40 + k * 2, 8 + k, 40 + k * 2 + Math.cos(a) * L * .55, 8 + k + Math.sin(a) * L, 4.3); } // primaries
  for (let k = 0; k < 7; k++) { const x = 6 + k * 5, L = 26 + k * 2.2; fe(x, 12, x + 4 + k * .8, 12 + L, 4); } // secondaries
  for (const [y, n, w] of [[14, 9, 3.6], [8, 10, 3.2]]) for (let k = 0; k < n; k++) { const x = 3 + k * 4.4; fe(x, y - 4, x + 2, y + 6, w); } // coverts
  stroke(c2, 0, 3, 46, 9, 4, 3, (t, s, e) => e ? A[1] : s < -.3 ? A[5] : A[4]); // the leading edge
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const k = j * 64 + i; if (m[k] && (!i || !j || i > 62 || j > 62 || !m[k - 1] || !m[k + 1] || !m[k - 64] || !m[k + 64])) c.P(i, j, A[0]); } // the darkest line only round the silhouette (feathers part in a mid shade)
}];
// a spread wing (the back's wings) as one cut-out (128 x 80, the shoulder at the left edge, x 3 y 46): the arm's lit leading
// edge rising through the elbow to the wrist, small coverts in scallops along it, a band of greater coverts, broad secondaries
// hanging off the arm and long primaries fanning out off the hand. Each feather lit on its outer side with a light quill, each
// band a step darker than the one over it, the flight feathers' tips (the trailing edge) darkest; B (optional) the tips' colour.
// (The half-open wing above hung in long strips on a big rig: Typhon's read as a curtain, not wings)
export const spreadWing = (A, B) => ['wing3' + A + B, 128, 80, (c) => {
  const T = B || A, m = new Uint8Array(128 * 80), c2 = { ...c, P: (i, j, col) => { i = Math.round(i); j = Math.round(j); if (i < 0 || j < 0 || i > 127 || j > 79) return; m[j * 128 + i] = 1; c.P(i, j, col); } };
  const arm = (x) => x < 46 ? 46 - (x - 3) * 26 / 43 : Math.max(8, 20 - (x - 46) * 10 / 32); // shoulder (3,46), elbow (46,20), wrist (78,10)
  const fe = (x, y, a, L, w, lo, hi, q, tip) => stroke(c2, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, w, w * (tip ? .6 : .72), (t, s, e) => e ? A[1] : tip && t > .78 ? (s > .3 ? T[2] : T[1]) : q && Math.abs(s) < .14 && t < .9 ? q : s > .35 ? hi : lo);
  for (let k = 7; k >= 0; k--) { const u = k / 7, x = 72 + u * 18; fe(x, arm(x) + 2 - u * 2, 1 - u * 1.12, 30 + u * 5, 4.4, A[2], A[3], A[4], 1); } // primaries fanning from down to out-and-up, the outermost first
  for (let k = 11; k >= 0; k--) { const u = k / 11, x = 6 + u * 62, y = arm(x) + 3, a = 1.5 - .35 * u; fe(x, y, a, (74 - 36 * u ** 1.5 - y) / Math.sin(a), 4.8, A[2], A[3], A[4], 1); } // secondaries: the trailing edge sweeps up to the hand
  for (let k = 4; k >= 0; k--) { const u = k / 4, x = 72 + u * 16; fe(x, arm(x) + 1 - u * 2, .95 - u * .7, 13, 3.8, A[3], A[4], 0, 0); } // primary coverts
  for (let k = 12; k >= 0; k--) { const u = k / 12, x = 4 + u * 68; fe(x, arm(x) + 1, 1.45 - .4 * u, 16 - u * 4, 4, A[3], A[4], 0, 0); } // greater coverts
  for (let x = 4; x < 88; x += 4.5) fe(x, arm(x) - 1, 1.3, 7, 3, A[4], A[5], 0, 0); // lesser coverts, scalloped along the arm
  for (const [x0, y0, x1, y1] of [[2, 46, 46, 19], [46, 19, 78, 9], [78, 9, 93, 7]]) stroke(c2, x0, y0, x1, y1, 3, 2.6, (t, s, e) => e ? A[2] : s > .3 ? A[5] : A[4]); // the leading edge
  for (let j = 0; j < 80; j++) for (let i = 0; i < 128; i++) { const k = j * 128 + i; if (m[k] && (!i || !j || i > 126 || j > 78 || !m[k - 1] || !m[k + 1] || !m[k - 128] || !m[k + 128])) c.P(i, j, A[0]); } // the silhouette
}];
// a flame tongue as an unlit cut-out (16 x 24, tip up), white-gold at the root through orange to a red rim; frames 0..2 lick
// differently (a god's tick swaps them)
export const flame = (k = 0, G = ['#a8240c', '#e85a14', '#ff9a26', '#ffd84a', '#fff8d0']) => ['flame' + k + G, 16, 24, (c) => {
  const { P } = c, ph = k * 2.1;
  for (let j = 0; j < 24; j++) { const t = j / 23, w = 7.5 * Math.sin(Math.min(1, t * 1.15) * PI * .62) * (t > .8 ? 1 - (t - .8) * 2.2 : 1) + 1, cx = 8 + Math.sin(t * 5 + ph) * (1 - t) * 2.2;
    for (let i = 0; i < 16; i++) { const d = Math.abs(i + .5 - cx) / w; if (d > 1 || (j < 6 && Math.sin(i * 1.7 + ph + j) > .6 - t)) continue; P(i, j, d > .8 ? G[0] : d > .58 ? G[1] : t < .3 ? G[2] : d > .3 ? G[2] : t > .7 ? G[4] : G[3]); } }
}];
// a leaf (8 x 12 cut-out, tip up): lit on one side of the midrib, the other in shade, a dark rim
export const leaf = (Lf) => ['leaf' + Lf, 8, 12, (c) => ell(c, 4, 6.5, 3.6, 5.8, (nx, ny, e) => e ? Lf[0] : Math.abs(nx) < .16 && ny > -.8 ? Lf[4] : nx < 0 ? Lf[3] : Lf[2])];
// a wheat ear (8 x 28 cut-out): plump grains in pairs up the ear, awns flaring off, a stalk
export const wheat = () => ['wheat', 8, 28, (c) => {
  const { P, R } = c, Q = ['#5a3410', '#9a6420', '#d8a240', '#f0c860', '#fff0a8'];
  R(3, 14, 2, 14, Q[1]); R(3, 14, 1, 14, Q[2]);
  for (let k = 0; k < 6; k++) { const y = 3 + k * 2; for (const s of [-1, 1]) { const x = s < 0 ? 1 : 4; R(x, y, 3, 2, Q[3]); P(x + (s < 0 ? 0 : 2), y, Q[4]); P(x + (s < 0 ? 2 : 0), y + 1, Q[1]); P(s < 0 ? x - 1 : x + 3, y - 2, Q[2]); } }
  P(3, 0, Q[3]); P(4, 1, Q[3]); P(3, 1, Q[4]);
}];
// a peacock feather (12 x 32 cut-out): bronze-green barbs off a light quill, the eye at the top: blue heart, teal ring, bronze ring
export const peacock = () => ['peacock', 12, 32, (c) => {
  const { P } = c;
  for (let j = 10; j < 32; j++) { const w = 1 + (32 - j) / 7; for (let i = 0; i < 12; i++) { const d = Math.abs(i + .5 - 6); if (d > w) continue; P(i, j, d < .7 ? '#e8e0b0' : (i + j) % 3 ? '#3a7a3a' : '#7a8a2a'); } }
  ell(c, 6, 7, 5.6, 6.6, (nx, ny, e) => { const d = Math.hypot(nx, ny); return e ? '#2a4a2a' : d < .32 ? '#14205a' : d < .5 ? '#2a60c0' : d < .7 ? '#2aa8a0' : d < .85 ? '#c8a040' : '#3a8a3a'; });
  P(5, 5, '#a0d8ff');
}];
// a scallop shell (24 x 20 cut-out, hinge at the bottom): ribs fanning up from the hinge, pearl-pink, lit to the left
export const shell = (Sh = ['#7a3a4a', '#c06a80', '#eaa0b0', '#f8d0d4', '#fff4f0']) => ['shell' + Sh, 24, 20, (c) => {
  const { P } = c;
  for (let j = 0; j < 20; j++) for (let i = 0; i < 24; i++) { const x = i + .5 - 12, y = 17.5 - j, r = Math.hypot(x, y), a = Math.atan2(x, y); if (y < -2 || r > 17 || Math.abs(a) > 1.25) { if (j >= 16 && j < 20 && Math.abs(x) < 6) P(i, j, j === 19 ? Sh[0] : Sh[2]); continue; }
    const rib = Math.abs(((a / .22) % 1 + 1) % 1 - .5); P(i, j, r > 15.8 || Math.abs(a) > 1.18 ? Sh[0] : rib < .14 ? Sh[1] : rib < .28 ? Sh[2] : x < 0 ? Sh[4] : Sh[3]); }
}];
// a sun ray (8 x 24 unlit cut-out, tip up): a white-gold core flaring through gold to an orange rim
export const ray = (G) => ['ray' + G, 8, 24, (c) => { const { P } = c; for (let j = 0; j < 24; j++) { const w = 3.6 * (j + 2) / 25; for (let i = 0; i < 8; i++) { const d = Math.abs(i + .5 - 4) / w; if (d > 1) continue; P(i, j, d > .7 ? G[1] : d > .35 ? G[2] : j > 12 ? G[4] : G[3]); } } }];
// glowing bands (halo rings, crescents, ambrosia): unlit, a bright core between two deep seams; u along the band
export const shine = (G, W = 64) => ['shine' + G + W, W, 8, (c) => { const { R, P } = c; R(0, 0, W, 8, G[2]); R(0, 0, W, 1, G[1]); R(0, 7, W, 1, G[1]); R(0, 3, W, 2, G[4]); R(0, 2, W, 1, G[3]); R(0, 5, W, 1, G[3]); for (let x = 0; x < W; x += 9) { P(x, 3, '#ffffff'); P(x + 1, 3, '#ffffff'); } }];
// a sparkle (8 x 8 unlit cut-out): a four-pointed star
export const sparkle = (G) => ['spark' + G, 9, 9, (c) => { const { P } = c; for (let k = -4; k <= 4; k++) { const a = Math.abs(k); P(4 + k, 4, a < 2 ? G[3] : G[2]); P(4, 4 + k, a < 2 ? G[3] : G[2]); } P(3, 3, G[1]); P(5, 5, G[1]); P(5, 3, G[1]); P(3, 5, G[1]); P(4, 4, '#ffffff'); }];
// night cloth: deep folds, scattered stars (a few with crosses), faint constellation lines; o.hem a border palette
export const starCloth = (N, o = {}) => ['stars' + N + JSON.stringify(o), o.W || 96, o.H || 64, (c) => {
  const { R, P, W, H, rnd } = c, hy = o.hem ? H - 6 : H;
  R(0, 0, W, H, N[2]); for (let x = 0; x < W; x += 9 + (rnd() * 4 | 0)) for (let j = 0; j < hy; j++) { P(x + Math.round(j * .08), j, N[1]); if (j % 4) P(x + 1 + Math.round(j * .08), j, N[3]); }
  const st = []; for (let k = 0; k < W * hy / 60; k++) { const x = rnd() * W | 0, y = 1 + rnd() * (hy - 2) | 0; st.push([x, y]); P(x, y, rnd() < .3 ? '#fff6c0' : '#dfe8ff'); }
  for (let k = 0; k + 1 < st.length; k += 5) { const [x0, y0] = st[k], [x1, y1] = st[k + 1]; if (Math.hypot(x1 - x0, y1 - y0) < 18) line(c, x0, y0, x1, y1, N[3]); P(x0, y0, '#ffffff'); P(x1, y1, '#ffffff'); }
  for (let k = 0; k < 6; k++) { const x = rnd() * W | 0, y = 3 + rnd() * (hy - 6) | 0; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) P(x + dx, y + dy, dx || dy ? '#b8c8ff' : '#ffffff'); }
  if (o.hem) { const T = X(o.hem); R(0, hy, W, H - hy, T[3]); R(0, hy, W, 1, T[5]); R(0, H - 1, W, 1, T[0]); for (let x = 0; x < W; x += 6) { P(x + 2, hy + 2, T[5]); P(x + 2, hy + 3, T[4]); P(x + 3, hy + 3, T[5]); } }
}];
// tattered dark cloth (u around, row 0 the top): long tears, darned patches, frayed bottom edge cut out with o.cut
export const tatter = (C) => ['tatter' + C, 64, 48, (c) => {
  const { R, P, W, H, rnd } = c; R(0, 0, W, H, C[3]);
  for (let x = 0; x < W; x += 5 + (rnd() * 4 | 0)) { const y0 = rnd() * 10 | 0; for (let j = y0; j < H; j++) { P(x, j, C[1]); if (j % 3) P(x + 1, j, C[4]); } }
  for (let k = 0; k < 6; k++) { const x = rnd() * W | 0, y = 8 + rnd() * (H - 20) | 0; R(x, y, 4, 3, C[2]); P(x, y, C[0]); P(x + 3, y + 2, C[0]); }
  for (let x = 0; x < W; x++) { const d = (Math.sin(x * 1.3) + Math.sin(x * .41)) * 2.5 + 4; for (let j = H - Math.round(d); j < H; j++) P(x, j, j === H - Math.round(d) ? C[0] : C[1]); }
}];
// bone (a skull's ball, ico UVs): ivory, cracks with lit lips, darker toward the jaw
export const bone = () => up(['bone', 32, 16, (c) => {
  const { R, P, rnd } = c, B = ['#3a3038', '#6e6268', '#a49a94', '#d8d2c4', '#f0eadc', '#ffffff'];
  for (let j = 0; j < 16; j++) R(0, j, 32, 1, j > 12 ? B[4] : j > 5 ? B[3] : j > 2 ? B[2] : B[1]);
  for (let k = 0; k < 3; k++) { let x = rnd() * 32 | 0, y = 14; for (let s = 0; s < 6; s++) { P(x, y, B[1]); P(x + 1, y, B[5]); x += Math.round(rnd() * 2 - 1); y--; } }
  R(24, 13, 2, 1, B[5]);
}]);
// fur (the kit's tufts) and a lion's or leopard's coat over it: o.mane longer darker locks, o.spots leopard rosettes
export const fur = (F, o = {}) => ['fur' + F + JSON.stringify(o), o.W || 48, o.H || 32, (c) => {
  paFur(c, F, { cw: o.mane ? 4 : 6, ch: o.mane ? 6 : 5, long: o.mane ? 5 : 3, glint: .25 });
  if (o.spots) { const { P, W, H, rnd } = c; for (let k = 0; k < W * H / 70; k++) { const x = rnd() * W | 0, y = rnd() * H | 0; for (const [dx, dy] of [[0, -1], [1, -1], [2, 0], [2, 1], [1, 2], [0, 2], [-1, 1], [-1, 0]]) if (rnd() < .8) P(x + dx, y + dy, '#2a1408'); P(x, y, F[2]); P(x + 1, y + 1, F[2]); } }
}];
// stone (Atlas): the kit's grit with cracks, a few lichen flecks
export const stone = (S) => ['stone2' + S, 32, 32, (c) => { paGrit(c, [S[1], S[2], S[2], S[3], S[4], S[4]], { fleck: 9, pit: .8, bump: .8, crack: .2 }); const { P, rnd } = c; for (let k = 0; k < 4; k++) { const x = rnd() * 32 | 0, y = rnd() * 32 | 0; P(x, y, '#7a8a52'); P(x + 1, y, '#5a6a3a'); } }];
// horn (ram or goat): ridged rings round a cone, lit on top, darker to the tip; row 0 the root
export const horn = (Hn) => ['horn' + Hn, 16, 24, (c) => { const { R, P } = c; R(0, 0, 16, 24, Hn[3]); for (let j = 0; j < 24; j += 3) { R(0, j, 16, 1, Hn[1]); R(0, j + 1, 16, 1, Hn[4]); } R(0, 0, 4, 24, Hn[4]); R(10, 0, 6, 24, Hn[2]); for (let j = 1; j < 24; j += 3) P(2, j, Hn[5] || Hn[4]); }];
// reed pipes (u round a pipe, row 0 the top): green-gold cane with a dark node band and a lit stripe
export const reed = () => ['reed', 8, 24, (c) => { const { R } = c, Q = ['#3a3010', '#6a6020', '#a89a48', '#d8c878', '#f4ecb0']; R(0, 0, 8, 24, Q[3]); R(2, 0, 1, 24, Q[4]); R(6, 0, 2, 24, Q[2]); R(0, 0, 8, 1, Q[0]); for (const y of [9, 18]) { R(0, y, 8, 1, Q[1]); R(0, y + 1, 8, 1, Q[4]); } }];
// a hoof (box faces): dark horn with a cleft and a lit rim
export const hoof = () => ['hoof', 16, 12, (c) => { const { R, P } = c, Q = ['#0e0a0a', '#221816', '#3a2a24', '#5a4434', '#7a6048']; R(0, 0, 16, 12, Q[2]); R(0, 0, 16, 2, Q[3]); R(0, 0, 16, 1, Q[4]); R(7, 3, 2, 9, Q[0]); R(0, 10, 16, 2, Q[1]); for (let x = 1; x < 16; x += 5) P(x, 4, Q[3]); }];
// a scythe or harpe blade (cut-out, the edge along the bottom of a curve): steel lit along its back, a bright honed edge
export const curveBlade = (T, k = 'scythe') => ['cb' + T + k, 48, 24, (c) => {
  const { P } = c, hook = k === 'harpe';
  for (let i = 0; i < 48; i++) { const t = i / 47, yc = hook ? 6 + 14 * Math.pow(t, 2.2) : 4 + 10 * t * t, w = (hook ? 4.5 : 5) * (1 - t * .85) + .8;
    for (let j = 0; j < 24; j++) { const d = j + .5 - yc; if (Math.abs(d) > w) continue; const e = Math.abs(d) > w - 1; P(i, j, e ? (d > 0 ? T[5] : T[0]) : d < -w * .3 ? T[4] : d > w * .45 ? T[2] : T[3]); } }
}];
// a smith's apron (u around, row 0 the top): scorched leather, stitched edges, rivets, a pocket with tongs' handles poking out
export const apron = (L) => ['apron' + L, 96, 64, (c) => {
  const { R, P, W, H, F, rnd } = c; paLeather(c, L, { edge: false, stitch: false });
  for (let x = 0; x < W; x++) if (x % 3 < 2) { P(x, 2, L[5]); P(x, H - 3, L[5]); } R(0, H - 1, W, 1, L[0]);
  for (let k = 0; k < 12; k++) { const x = rnd() * W | 0, y = 6 + rnd() * (H - 12) | 0; R(x, y, 3, 2, '#1e1210'); P(x + 1, y - 1, L[1]); P(x + 3, y + 1, L[2]); } // scorch marks
  R(F - 10, 26, 20, 16, L[2]); R(F - 10, 26, 20, 1, L[4]); for (let j = 27; j < 42; j++) { if (j % 3) { P(F - 10, j, L[5]); P(F + 9, j, L[5]); } } R(F - 10, 41, 20, 1, L[0]); // pocket
  R(F - 4, 20, 2, 7, '#40424e'); R(F + 2, 20, 2, 7, '#40424e'); P(F - 4, 20, '#9298a6'); P(F + 2, 20, '#9298a6'); // tongs
  for (const x of [F - 30, F + 29]) for (const y of [5, H - 6]) rivet(c, x, y, ['#3a3030', '#6a6060', '#9a948a', '#c8c0b0', '#e8e2d8', '#ffffff']);
}];
// a hammer's iron head (box faces): dark iron, a striking face glowing from the forge
export const hammerHead = (hot) => ['hammer' + hot, 16, 16, (c) => { const { R, P } = c, T = FE; R(0, 0, 16, 16, T[2]); R(0, 0, 16, 2, T[4]); R(0, 0, 16, 1, T[5]); R(0, 14, 16, 2, T[1]); R(0, 0, 1, 16, T[3]); for (let x = 2; x < 16; x += 5) { P(x, 6, T[1]); P(x + 1, 7, T[3]); } if (hot) { R(2, 2, 12, 12, '#a8240c'); R(4, 4, 8, 8, '#ff7a1a'); R(6, 6, 4, 4, '#ffd84a'); } }];
// the tortoise-shell soundbox of a lyre (ico UVs): plates outlined dark, each lit at its top
export const tortoise = () => ['tortoise', 32, 16, (c) => { const { R, P } = c, Q = ['#2a1810', '#4e2e18', '#7a4a24', '#a8743a', '#d0a060']; R(0, 0, 32, 16, Q[2]); for (let y = 0; y < 16; y += 5) for (let x = (y / 5 % 2) * 3; x < 32; x += 6) { R(x, y, 6, 1, Q[0]); R(x, y, 1, 5, Q[0]); R(x + 1, y + 1, 4, 1, Q[4]); P(x + 2, y + 2, Q[3]); } }];
// a quiver (u around, row 0 the top): tooled leather, a gold lip and bands, a running tooled pattern
export const quiverTex = (L, T = AU) => ['quiver' + L + T, 32, 48, (c) => {
  const { R, P, W, H } = c; paLeather(c, L, { edge: false });
  R(0, 0, W, 3, T[3]); R(0, 0, W, 1, T[5]); R(0, 3, W, 1, T[1]); for (const y of [16, 36]) { R(0, y, W, 2, T[3]); R(0, y, W, 1, T[4]); R(0, y + 2, W, 1, T[1]); }
  for (let x = 0; x < W; x += 4) for (let k = 0; k < 4; k++) { P(x + k, 22 + k, L[1]); P(x + k, 30 - k, L[1]); }
  R(0, H - 2, W, 2, L[0]);
}];
// fletching (8 x 10 cut-out): a pair of vanes and a nock
export const fletch = (Fc) => ['fletch' + Fc, 8, 12, (c) => { const { P, R } = c; for (let j = 0; j < 9; j++) { const w = 1 + Math.round(j * .35); for (let i = 0; i < w; i++) { P(3 - i, 1 + j, i === w - 1 ? Fc[1] : Fc[3]); P(4 + i, 1 + j, i === w - 1 ? Fc[0] : Fc[2]); } } R(3, 0, 2, 12, '#7a5430'); P(3, 0, '#2a1810'); P(4, 0, '#2a1810'); }];
// a ball's surface patterns (ico UVs drawn bottom-up, turned by up()): a grape, a pomegranate, an ember, a magic orb's swirl
export const fruit = (k) => up(['fruit' + k, 32, 16, (c) => {
  const { R, P } = c;
  if (k === 'grape') { const Q = ['#1e0e2a', '#3a1a4e', '#5a2a7a', '#8a4aa8', '#c8a0e0']; for (let j = 0; j < 16; j++) R(0, j, 32, 1, j > 11 ? Q[3] : j > 5 ? Q[2] : Q[1]); R(22, 12, 3, 2, Q[4]); for (let x = 0; x < 32; x += 5) P(x, 8, Q[3]); }
  else if (k === 'pom') { const Q = ['#3a0812', '#6a1020', '#a8243a', '#d8485a', '#f8b0a0']; for (let j = 0; j < 16; j++) R(0, j, 32, 1, j > 12 ? Q[3] : j > 4 ? Q[2] : Q[1]); for (let x = 18; x < 30; x++) P(x, 11 + (x % 2), Q[4]); R(22, 13, 3, 1, '#ffe8d0'); for (let x = 0; x < 32; x += 3) P(x, 3, Q[0]); }
  else if (k === 'coal') { R(0, 0, 32, 16, '#3a0e08'); for (let x = 0; x < 32; x++) for (let j = 0; j < 16; j++) { const v = Math.sin(x * 1.3 + j * .7) + Math.sin(x * .5 - j * 1.9); if (v > 1.1) P(x, j, '#ffd84a'); else if (v > .5) P(x, j, '#ff7a1a'); else if (v > -.2) P(x, j, '#a8240c'); } }
  else { const G = X(k); for (let x = 0; x < 32; x++) for (let j = 0; j < 16; j++) { const v = Math.sin(x / 32 * PI * 4 + j * .55); P(x, j, v > .75 ? G[5] || G[4] : v > .2 ? G[4] : v > -.4 ? G[3] : G[2]); } }
}]);
// a polished mirror shield's face (96 x 96, row 0 up): bright silver with diagonal reflection streaks and a dim ghost of a face
export const mirror = (T) => ['mirror' + T, 96, 96, (c) => {
  const { P } = c;
  for (let j = 0; j < 96; j++) for (let i = 0; i < 96; i++) { const x = i - 47.5, y = j - 47.5, r = Math.hypot(x, y), s = x + y;
    P(i, j, r > 45 ? T[0] : r > 42 ? (y < 0 ? T[5] : T[3]) : r > 40 ? T[1] : Math.abs(s + 30) < 5 || Math.abs(s + 14) < 2 ? T[5] : Math.abs(s - 26) < 3 ? T[4] : s < -10 ? T[4] : s > 30 ? T[2] : T[3]); }
}];
// the shield of Achilles (96 x 96): rings of the world: Ocean's waves at the rim, a ring of dancers, fields and cities, sun and moon in the middle
export const achShield = () => ['achsh', 96, 96, (c) => {
  const { P } = c, T = AU, B = BZ, K = '#1c1014';
  for (let j = 0; j < 96; j++) for (let i = 0; i < 96; i++) { const x = i - 47.5, y = j - 47.5, r = Math.hypot(x, y), a = Math.atan2(y, x), u = ((a / PI / 2 + .5) * 1) % 1;
    let col = B[3];
    if (r > 45) col = T[0]; else if (r > 42.5) col = y < 0 ? T[5] : T[4]; else if (r > 41.5) col = T[1];
    else if (r > 35) col = Math.sin(u * PI * 2 * 14 + r * .9) > .3 ? '#3a78a8' : '#86bcd4'; // Ocean
    else if (r > 34) col = T[1]; else if (r > 26) { const k = (u * 24) % 1; col = k < .18 || (k < .5 && Math.abs(r - 30) < 1.5) ? K : T[3]; } // dancers hand in hand
    else if (r > 25) col = T[1]; else if (r > 16) col = ((u * 12) | 0) % 2 ? '#8a6a2a' : '#c8a040'; // fields and vineyards
    else if (r > 15) col = T[1]; else if (r > 6) col = Math.hypot(x + 5, y + 4) < 4 ? '#f8f0d0' : Math.hypot(x - 5, y + 3) < 3 && Math.hypot(x - 6.5, y + 4) > 2.5 ? '#e4eaf4' : '#2a3a6a'; // sun, moon, sky
    else col = r < 2.5 ? T[5] : T[4];
    if (r > 6 && r < 15 && (i * 7 + j * 13) % 23 === 0) col = '#fff6c0'; P(i, j, col); }
}];
// a closed Corinthian helm (a ball over the head, ico UVs, front u .75): the T-shaped face opening and almond eyes, cheek
// pieces, an engraved brow, a ridge front to back
export const helmClosed = (T, eye = '#140c0a') => up(['helmc' + T + eye, 64, 32, (c) => {
  const { R, P } = c, W = 64, H = 32, f = 48;
  for (let j = 0; j < H; j++) { const t = j / (H - 1); R(0, j, W, 1, t > .88 ? T[5] : t > .7 ? T[4] : t > .35 ? T[3] : T[2]); }
  R(0, 19, W, 1, T[1]); R(0, 20, W, 1, T[4]); for (let x = 0; x < W; x += 4) P(x + 2, 21, T[1]);
  for (const x of [f, 16]) for (let j = 21; j < H; j++) { P(x, j, T[5]); P(x + 1, j, T[1]); }
  for (const s of [-1, 1]) for (let i = 2; i < 9; i++) { const h = Math.round(1.3 * Math.sin((i - 2) / 7 * PI)); for (let j = 16 - h; j <= 16 + h; j++) P(f + s * i - (s < 0 ? 1 : 0), j, eye); P(f + s * i - (s < 0 ? 1 : 0), 17 + h, T[1]); P(f + s * i - (s < 0 ? 1 : 0), 15 - h, T[5]); }
  for (let j = 2; j < 15; j++) { P(f - 2, j, eye); P(f + 1, j, eye); } R(f - 1, 6, 2, 9, T[4]); // the mouth slot either side of the nose guard
  for (let j = 0; j < 4; j++) R(f - 2, j, 4, 1, eye);
  for (const s of [-1, 1]) for (let j = 2; j < 14; j++) P(f + s * 10, j, T[1]); // cheek piece edges
}]);
// laced leather corslet on the chest cylinder (128 x 48): shoulder-flap seams, scale-stitched panels, a laced front
export const corslet = (L, T = BZ) => ['corslet' + L + T, 128, 48, (c) => {
  const { R, P, S, W, H, F } = c; paLeather(c, L, { edge: false });
  for (const y of [14, 28, 40]) { R(0, y, W, 1, L[1]); R(0, y + 1, W, 1, L[4]); for (let x = 0; x < W; x += 3) P(x, y - 2, L[5]); }
  for (let j = 2; j < H - 2; j++) { S(0, j, L[0]); if (j % 4 === 0) { S(1, j, '#e8dcc0'); S(2, j + 1, '#e8dcc0'); } }
  R(0, 0, W, 2, T[3]); R(0, 0, W, 1, T[5]); R(0, H - 2, W, 2, T[2]); R(0, H - 1, W, 1, T[0]);
  for (let x = 6; x < W; x += 12) for (const y of [8, 21, 34]) rivet(c, x + (y % 2) * 6, y, T);
  for (let i = 0; i < 20; i++) { S(i, 12 - Math.round(i * .3), L[1]); S(i, 11 - Math.round(i * .3), L[4]); } // shoulder flaps' edges
}];
// a vine (8 x 32 cut-out): a twisting green stem with leaves either side, a tendril
export const vine = (G = ['#1e3a14', '#2e5a1e', '#4a8a2a', '#7ab84a', '#b8e07a']) => ['vine' + G, 10, 32, (c) => {
  const { P } = c;
  for (let j = 0; j < 32; j++) { const x = 5 + Math.round(Math.sin(j * .4) * 1.5); P(x, j, G[1]); P(x - 1, j, G[2]); }
  for (let k = 0; k < 5; k++) { const y = 3 + k * 6, s = k % 2 ? 1 : -1; for (let t = 0; t < 4; t++) for (let w = -1; w <= 1; w++) P(5 + s * (1 + t), y + w + (t > 2 ? 1 : 0), w === -1 ? G[4] : w === 1 ? G[2] : G[3]); }
}];
// Hecate's key (6 x 20 cut-out): a ring bow, a long shank, two bits
export const keyTex = (T) => ['key' + T, 7, 20, (c) => { const { P, R } = c; for (let a = 0; a < 16; a++) P(3 + Math.round(Math.cos(a / 16 * PI * 2) * 2.4), 3 + Math.round(Math.sin(a / 16 * PI * 2) * 2.4), a < 8 ? T[2] : T[4]); R(3, 6, 1, 14, T[4]); R(2, 6, 1, 14, T[2]); R(4, 15, 2, 2, T[3]); R(4, 18, 2, 2, T[3]); }];
// a poppy (12 x 12 cut-out): four red petals round a dark seed head
export const poppy = () => ['poppy', 12, 12, (c) => ell(c, 6, 6, 5.6, 5.4, (nx, ny, e) => { const d = Math.hypot(nx, ny); return e ? '#5a0810' : d < .3 ? '#1a0e1a' : d < .42 ? '#3a2a1a' : Math.abs(nx) < .08 || Math.abs(ny) < .08 ? '#8a1018' : nx + ny < -.3 ? '#ff6a5a' : '#d82a2a'; })];

// ---------- shared god pieces (cast.js's god helpers call these under PXART) ----------
const geo = (k, make) => paOnce('gG' + k, make);
const torusM = (p, R, r, arc, mt, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo(`t${R},${r},${arc}`, () => new THREE.TorusGeometry(R, r, 4, 20, arc)), mt); m.position.set(x, y, z); m.castShadow = false; p.add(m); return own(m); };
// a strap from a to b (box), wearing mt
const _sa = new THREE.Vector3(), _Z = new THREE.Vector3(0, 0, 1);
export function strapM(p, a, b, w, h, mt, o) { _sa.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = _sa.length(), m = bx(p, w, h, L, mt, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, o); m.quaternion.setFromUnitVectors(_Z, _sa.normalize()); return m; }
export const stripMats = (Q, studded) => [flat(Q[2]), flat(Q[2]), flat(Q[3]), flat(Q[1]), M(strip(Q, studded)), flat(Q[1])]; // a pteruges box: its outer face painted
export const metalMat = (T, W, H) => M(metal(X(T), W, H));
export const orbMat = (T) => M(orb(X(T)));
export const lamesMat = (T) => M(lames(X(T)));
export const wingMat = (col, tip) => MC(wing(FP(col), tip && FP(tip)));
// wings on the back, spread: per side a pivot at the shoulder (returned, as cast.js wings(); callers scale it) holding the
// spread wing in two cut-out panels folded at the wrist (u .6), the hand swept further back, so the wing has depth from the side
const wPanel = (u0, u1) => geo('wp' + u0 + u1, () => { const g = new THREE.PlaneGeometry(1, 1), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0)); return g; });
export const spreadMat = (col, tip) => MC(spreadWing(R6(col), tip && R6(tip))); // (R6: a dark wing on ramp(), whose light steps stay dark; FP's lit a black wing grey)
export function wings(r, col, tip, span = 1, y = .5, par = r.torso) {
  const m = spreadMat(col, tip), out = [], W = 1.05 * span, H = W * .625, F = .6, r0 = .027, v0 = .419; // (u, v) of the shoulder in the texture
  for (const sx of [-1, 1]) {
    const w = pivot(par, sx * .1, y, -.17); w.rotation.set(-.12, sx * .3, sx * .1); out.push(w); // raised a little, swept back, leaning back
    const hand = pivot(w, sx * (F - r0) * W, 0, 0); hand.rotation.y = sx * .45;
    for (const [p, u0, u1, x] of [[w, 0, F, F / 2 - r0], [hand, F, 1, (1 - F) / 2]]) { const q = new THREE.Mesh(wPanel(u0, u1), m); q.scale.set(sx * (u1 - u0) * W, H, 1); q.position.set(sx * x * W, (.5 - v0) * H, 0); q.castShadow = false; q.userData.fx = true; p.add(q); own(q); }
  }
  return out;
}
// a little wing (hat, heels, caduceus): one cut-out, its root at (x, y, z), pointing out to side sx and back
export function winglet(p, s, sx, x, y, z, col = '#f6f4ee') { const q = quad(p, s * sx, -s * .8, wingMat(col), x + sx * s * .4, y + s * .36, z - s * .2); q.rotation.set(0, sx * .6, sx * .3); return q; } // (flipped: the feathers sweep up and back, as on Hermes' hat and heels)
// flames: two crossed unlit cut-outs in a pivot the god's tick flickers (cast.js goldFlicker) and re-licks (flick)
let FLM = null; const FL = () => FLM ||= [0, 1, 2].map((k) => MC(flame(k), true));
export function flames(r, parent, h, x = 0, y = 0, z = 0) {
  const g = pivot(parent, x, y, z), f = FL();
  for (const a of [0, PI / 2]) { const q = live(quad(g, h * .66, h, f[0], 0, h / 2, 0)); q.rotation.y = a; (r.pxFlames ||= []).push(q); }
  (r.flames ||= []).push(g); return g;
}
export function flick(r, dt) { if (!r.pxFlames) return; r.pxT = (r.pxT || 0) + dt; const f = FL(), k = Math.floor(r.pxT * 10); for (let i = 0; i < r.pxFlames.length; i++) r.pxFlames[i].material = f[(k + i) % 3]; }
export function torch(hand, r) {
  const g = new THREE.Group(); hand.add(g); g.position.set(0, -.04, .05);
  cy(g, .03, .025, .5, M(wood(WD)), 0, .15, 0, 6);
  cy(g, .054, .042, .1, M(trim(R6('#7a5434'), 'zig', 8, null, 32)), 0, .42, 0, 8); // the pitch-soaked wrapping
  flames(r, g, .3, 0, .45, 0); return g;
}
// sun rays round the head (cast.js halo): cut-out rays, alternately long and short, round a glowing ring
export function halo(r, col, n = 12, rad = .36, len = .16) {
  const g = pivot(r.head, 0, .22, -.08), G = R6(col), rm = MC(ray(G), true);
  for (let i = 0; i < n; i++) { const a = i / n * PI * 2, L = (len + (i % 2) * .06) * 1.25, d = rad + L / 2 - .03, q = quad(g, L * .42, L, rm, Math.sin(a) * d, Math.cos(a) * d, 0); q.rotation.z = -a; }
  torusM(g, rad - .04, .022, PI * 2, MB(shine(G, 96)));
  return g;
}
export function crescent(p, col, x, y, z, s = 1) { const m = torusM(p, .1 * s, .025 * s, PI * 1.3, MB(shine(R6(col), 32)), x, y, z); m.rotation.z = PI * .85; return m; }
// a bow (cast.js bow): the arc with gilded tips and a bound grip, a taut string
export const bowTex = (Wd, T) => ['bow' + Wd + T, 64, 8, (c) => { const { R, P } = c; R(0, 0, 64, 8, Wd[3]); R(0, 0, 64, 2, Wd[4]); R(0, 6, 64, 2, Wd[1]); for (let x = 0; x < 64; x += 4) P(x, 4, Wd[2]); for (const x0 of [0, 57]) { R(x0, 0, 7, 8, T[3]); R(x0, 0, 7, 1, T[5]); R(x0, 7, 7, 1, T[1]); } R(28, 0, 8, 8, '#3e2a22'); for (let x = 28; x < 36; x += 2) R(x, 0, 1, 8, '#7a5634'); }];
export function bow(hand, col, T = AU) {
  const g = new THREE.Group(); hand.add(g); g.position.set(0, -.05, .05);
  const a = torusM(g, .55, .025, PI * .9, M(bowTex(R6(col), T)), -.55, 0, 0); a.rotation.z = -PI * .45; a.castShadow = true; // the grip (the belly's middle) in the hand, the limbs curving out
  bx(g, .006, 1.08, .006, flat('#f2ecd8'), -.464, 0, 0, NS); return g; // the string from tip to tip
}
export function quiver(r, col, fl, T = AU) {
  const q = pivot(r.torso, .12, .45, -.22), L = R6(col), fm = MC(fletch(R6(fl))); q.rotation.z = -.45;
  cy(q, .07, .06, .5, M(quiverTex(L, T)), 0, 0, 0, 10);
  for (let i = 0; i < 4; i++) { const x = (i - 1.5) * .028; cy(q, .006, .006, .12, flat('#7a5430'), x, .28, 0, 4, NS); for (const a of [0, PI / 2]) quad(q, .05, .08, fm, x, .36, 0).rotation.y = a; }
  strapM(r.torso, [.2, .62, .1], [-.18, .12, .17], .035, .025, M(trim(L, 'dots', 6, null, 16)), NS);
  return q;
}
export function caduceus(hand) {
  const g = new THREE.Group(); hand.add(g);
  cy(g, .026, .03, 1.1, M(wood(AU, { rings: [[.12, AU], [.55, AU], [.95, AU]] })), 0, .25, .03, 6);
  bl(g, .055, M(orb(AU)), 0, .82, .03, 1);
  for (const sx of [-1, 1]) winglet(g, .2, sx, sx * .03, .8, .03);
  const sm = M(snake('#4a8a3a'));
  for (const ph of [0, PI]) { // two serpents twined up the rod (a scaled tube each), heads facing at the top
    const tg = geo('cad' + ph, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => new THREE.Vector3(Math.cos(i * .85 + ph) * .048 * (1 - i / 30), .1 + i * .058, .03 + Math.sin(i * .85 + ph) * .034))), 44, .017, 5));
    const t = new THREE.Mesh(tg, sm); t.castShadow = false; g.add(t); own(t);
    const h = bl(g, .034, sm, Math.cos(ph + 11 * .85) * .05, .76, .07, 1, NS); h.scale.set(.9, .8, 1.4); }
  return g;
}
export function club(hand, col) {
  const g = new THREE.Group(); hand.add(g); g.rotation.x = 1.05; const Q = R6(col);
  cy(g, .045, .1, .9, M(wood(Q, { W: 24, H: 64 })), 0, .4, .03, 8);
  for (let i = 0; i < 5; i++) { const a = i * 2.3; bl(g, .045, M(orb(Q)), Math.sin(a) * .08, .48 + i * .09, .03 + Math.cos(a) * .07, 1, NS); }
  g.rotation.set(1.5, 0, 0); return g;
}
export function scythe(hand, len = 2.2, T = AG) {
  const g = new THREE.Group(); hand.add(g); const top = len * .6;
  cy(g, .032, .038, len, M(wood(R6('#3a2e26'), { rings: [[.08, FE], [.16, FE]] })), 0, .3, .03, 6);
  const b = quad(g, -.66, .33, MC(curveBlade(T)), -.31, top - .08, .03); b.rotation.z = -.12;
  cy(g, .045, .045, .06, M(metal(FE)), 0, top + .02, .03, 8);
  return g;
}
// a closed Corinthian helm over the face (cast.js corinth, visor down): the face opening painted on the bowl, a horsehair crest
// on its holder, a tail down the back
export function helmDown(r, T, crestCol, y = .22) {
  const C = R6(crestCol), hm = bl(r.head, .232, M(helmClosed(T)), 0, y, -.04, 1); hm.scale.set(1.02, .8, 1.08);
  bx(r.head, .04, .05, .46, M(metal(T)), 0, y + .19, -.05);
  const cr = bl(r.head, .3, M(crest(C)), 0, y + .27, -.06, 1); cr.scale.set(.13, .55, 1.05);
  const tl = bl(r.head, .16, M(crest(C)), 0, y + .08, -.3, 1); tl.scale.set(.2, 1.2, .35); tl.rotation.x = .4;
  return hm;
}
// the lion of Nemea worn as a hood and cape: the head over his own with eyes, muzzle and fangs, a dark mane, the pelt down
// his back with paws, the forelegs knotted on his chest
export const lionFace = () => ['lionface', 16, 8, (c) => { const { R, P } = c; R(0, 0, 16, 8, '#c8963a'); R(5, 0, 6, 3, '#2a1410'); R(6, 0, 4, 1, '#5a3420'); R(7, 3, 2, 2, '#2a1410'); R(4, 5, 8, 1, '#2a1410'); for (const x of [2, 4, 11, 13]) P(x, 3, '#5a3420'); R(0, 7, 16, 1, '#8a5a24'); }];
export function lionPelt(r) {
  const P = R6('#c8963a'), Mn = R6('#8a5a24'), fm = M(fur(P)), mm = M(fur(Mn, { mane: 1 }));
  const hd = bl(r.head, .26, fm, 0, .34, -.06, 1); hd.scale.set(1.05, .78, 1.08);
  for (const sx of [-1, 1]) { bl(r.head, .06, fm, sx * .14, .48, .06, 1); bx(r.head, .05, .035, .02, pxEye('#e0a020'), sx * .07, .42, .21, NS); aim(cn(r.head, .02, .07, M(metal(['#3a3038', '#6e6268', '#a49a94', '#e8e2d4', '#f6f2e8', '#ffffff'])), sx * .05, .3, .22, 4, NS), 0, -1, .1); }
  bx(r.head, .16, .08, .12, [fm, fm, fm, fm, M(lionFace()), fm], 0, .36, .18);
  for (let i = 0; i < 8; i++) { const a = (i / 7 - .5) * 2.6; bl(r.head, .085, mm, Math.sin(a) * .25, .25, -.11 + Math.cos(a) * .2, 1, NS); }
  const p = pivot(r.torso, 0, .62, -.17); p.rotation.x = .1;
  bx(p, .5, .95, .045, fm, 0, -.475, 0);
  for (const sx of [-1, 1]) { bl(p, .07, fm, sx * .22, -.93, .02, 1).scale.set(1, .7, .8); const s = bl(r.torso, .12, fm, sx * .25, .6, -.02, 1); s.scale.set(1.15, .6, 1.2); }
  for (const sx of [-1, 1]) { const l = bx(r.torso, .09, .3, .05, fm, sx * .1, .52, .2); l.rotation.z = sx * .5; bl(r.torso, .05, fm, -sx * .02, .4, .21, 1).scale.set(1.2, .8, .7); }
  return hd;
}
// a shining band of light (ambrosia swirls, mists): an unlit sparkle cut-out
export const sparkMat = (col) => MC(sparkle(R6(col)), true);
export const glowMat = (col, op = .5) => paOnce('gBglow' + col + op, () => new THREE.MeshBasicMaterial({ map: cutTex(...glow(R6(col)).slice(0, 4)), alphaTest: .5, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
export const lift = (Q) => [Q[1], Q[2], Q[3], Q[3], Q[4], Q[5]]; // a palette a step lighter: pale cloth on painters that lay their base in Q[2]
export { M as texMat, MC as cutMat, MB as glowTexMat, R6, FP as soft }; // soft(hex): FP's shades for whites and pale cloth (ramp() browns them)
// a trident (cast.js trident, Ouranos's): a banded shaft, a chased crossbar, prongs with barbed points
export function trident(hand, shaftHex, T, len = 2.5, P2 = AU) {
  const tr = shaft(hand, R6(shaftHex), len, .3, { r: .03, rings: [[.08, P2], [.3, P2]] }), top = len * .6, pm = M(metal(T, 16, 32)), sm = M(spike(T));
  cy(tr, .05, .05, .07, M(trim(P2, 'dots', 8, null, 32)), 0, top, .03, 8);
  bx(tr, .34, .05, .05, M(trim(P2, 'wave', 8, null, 64)), 0, top + .06, .03);
  for (const sx of [-1, 0, 1]) {
    bx(tr, .045, sx ? .3 : .38, .045, pm, sx * .15, top + (sx ? .22 : .26), .03);
    cn(tr, .055, .14, sm, sx * .15, top + (sx ? .43 : .51), .03, 4);
    for (const bs of [-1, 1]) if (!sx || bs === sx) aim(cn(tr, .02, .07, sm, sx * .15 + bs * .045, top + (sx ? .36 : .44), .03, 4), bs * .5, -.86, 0);
  }
  return tr;
}
// re-dress a cast.js lyre(): tortoise-shell soundbox, gilded horn arms and yoke, bright strings
export function lyre(g) {
  for (const m of g.children) { if (!m.isMesh) continue; const t = m.geometry.type;
    m.material = /Ico/.test(t) ? M(tortoise()) : /Cone/.test(t) ? M(spike(AU)) : m.scale.x < .02 ? flat('#fff8e8') : m.scale.y > .2 ? M(metal(AU, 8, 32)) : M(trim(AU, 'dots', 8, null, 32)); own(m); }
}
// leather cross-wrapped round a shin or a grip (u around, row 0 the top)
export const wraps = (L) => ['wraps' + L, 32, 32, (c) => { const { R, P, W, H } = c; R(0, 0, W, H, L[2]); for (let j = 0; j < H; j++) for (let x = 0; x < W; x++) { const a = (x + j) % 8, b = (x - j + 64) % 8; if (a === 0) P(x, j, L[4]); else if (a === 1) P(x, j, L[3]); else if (b === 0) P(x, j, L[1]); } R(0, 0, W, 1, L[4]); R(0, H - 1, W, 1, L[0]); }];
// re-dress the meshes a kit call just added under p (from index n0 on) with material mt (a god's special garment)
export function redress(p, n0, mt, turn = true) { for (let i = n0; i < p.children.length; i++) { const m = p.children[i]; if (!m.isMesh) continue; m.material = mt; if (turn && /Cyl/.test(m.geometry.type)) { m.rotation.order = 'ZXY'; m.rotation.y += PI; } own(m); } }
// Atlas's living stone: a bare torso carved in grit (the skin painter's muscles over the stone), and every flat part of
// colour cols wearing tiled stone (the kit's skin(): whole repeats, no seams)
const fine = (h) => ramp(h, 9).slice(1, 7); // the six steps nearest a colour: stone's grain stays subtle (a 6-step ramp read as camouflage)
export const stoneTorso = (S) => ['stoneT2' + S, 128, 48, (c) => { { const Q = fine(S); paGrit(c, [Q[1], Q[2], Q[2], Q[3], Q[4], Q[4]], { fleck: 9, pit: .8, bump: .6, crack: .08 }); } let k = 0; const R0 = c.R; skinTorso(S)[3]({ ...c, R: (...a) => k++ ? R0(...a) : 0 }); }];
export function stoneSkin(r, cols) { tileSkin(r.root, Object.fromEntries(cols.map((h) => [h, paOnce('gTstone' + h, () => paTile('gstone3' + h, 32, 32, stone(fine(h))[3]))])), 64); }
// a broken chain hanging from a shackle: n links, each turned a quarter from the last (wrought iron)
export function chain(p, n, x, y, z, T = FE) { const mt = M(metal(T, 8, 8)); for (let i = 0; i < n; i++) torusM(p, .022, .008, PI * 2, mt, x, y - i * .034, z).rotation.y = i % 2 ? PI / 2 : 0; }
// dream mist (Morpheus): a soft cloud ball (ico UVs drawn bottom-up, turned by up()): shaded underside, lit top, curling wisps; translucent
export const cloud = (Q) => up(['cloud2' + Q, 32, 16, (c) => { const { R, P } = c; for (let j = 0; j < 16; j++) R(0, j, 32, 1, j < 4 ? Q[2] : j < 10 ? Q[3] : Q[4]); for (let k = 0; k < 4; k++) { const x0 = k * 8 + (k % 2) * 3, y0 = 9 + (k % 2) * 3; for (let t = 0; t < 5; t++) P(x0 + t, y0 + Math.round(Math.sin(t / 4 * PI) * 1.5), Q[5]); } }]); // (a few soft wisps: stronger ones striped the balls)
export const mistMat = (col) => paOnce('gMist' + col, () => { const s = cloud(R6(col)); return new THREE.MeshToonMaterial({ map: paTex('g.' + s[0], s[1], s[2], s[3]), gradientMap: toonRamp(), transparent: true, opacity: .85, emissive: new THREE.Color('#1a2a4a') }); });

