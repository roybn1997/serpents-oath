// Pixel-art kit for the round-16 look: small canvas textures painted texel by texel from flat palettes, shown with
// NearestFilter, plus hand-made mips that keep flat palette colours far off (no shimmer). Used by every character maker
// (models.js, cast.js, bestiary...), so a rig's parts can be dressed like hand-shaded sprites.
import * as THREE from './three.module.min.js';
import { toonRamp } from './render.js';
const RF = { willReadFrequently: true }; // painted canvases are read back for the flat mips: keep them in CPU memory

export const PXART = !/[?&]art=off\b/.test(location.search); // the pixel-art outfits; ?art=off = the old flat-coloured ones

// shared palettes, darkest first: shadows cooler and purpler, light warmer, white glints on metal
export const PAL = {
  navy: ['#0f0e1e', '#1a1a36', '#26274a', '#363a66', '#4c5590', '#6c7ab0'],
  plum: ['#2c1434', '#4a2050', '#6c3474', '#94509a'],
  lea: ['#1c1018', '#33201f', '#4f3326', '#6e4a30', '#93693e', '#b88c54'],
  dlea: ['#170d12', '#2a1a1c', '#3e2a22', '#56392a', '#744f34', '#987044'],
  boot: ['#1a1016', '#2e1e1e', '#46302a', '#62452f', '#82603c', '#a8834e'],
  steel: ['#1c1e2a', '#40444f', '#70747e', '#a6a9b0', '#dcdcd8', '#ffffff'],
  gold: ['#4a2a12', '#8a5620', '#c88a30', '#e8b84a', '#fff0a0'],
  // round 33 (Roy: the original V, ~40% towards the Blender Val): a bluer, brighter turquoise and paler skin
  hair: ['#0e3757', '#156688', '#1f95a5', '#31c7c9', '#66e3de', '#abf5e3'],
  skin: ['#9a6165', '#cb9284', '#efc7ad'],
};

// ramp(hex, n): an n-shade palette around one base colour, darkest first, hue-shifted like hand-made pixel art:
// shades drift towards blue-purple and gain saturation, lights drift towards yellow and lose a little.
const _c = new THREE.Color(), _h = {};
export function ramp(hex, n = 5) {
  return paOnce('r' + hex + n, () => {
    _c.set(hex).getHSL(_h); const out = [], mid = (n - 1) * .55;
    for (let i = 0; i < n; i++) {
      const t = (i - mid) / Math.max(1, n - 1); // < 0 shade, > 0 light
      const to = (g) => ((g - _h.h + 1.5) % 1) - .5; // the short way round the hue circle
      const hue = _h.h + (t < 0 ? to(.72) * Math.min(.3, -t * .5) : to(.14) * Math.min(.25, t * .4));
      const sat = Math.min(1, Math.max(0, _h.s * (t < 0 ? 1 - t * .35 : 1 - t * .3)));
      const lig = Math.min(.96, Math.max(.03, _h.l + t * (t < 0 ? _h.l * 1.5 : (1 - _h.l) * 1.1)));
      out.push('#' + _c.setHSL(((hue % 1) + 1) % 1, sat, lig).getHexString());
    }
    return out;
  });
}

export const paCache = new Map(), paOnce = (k, make) => { if (!paCache.has(k)) paCache.set(k, make()); return paCache.get(k); };
// paint(c): c.R(x, y, w, h, col) a block, c.P(x, y, col) one texel (x wraps round), c.S(i, y, col) a texel mirrored about
// the front centre F (i = 0 the first texel right of it), c.rnd() seeded. Cylinders are turned half round so u .5 faces front.
export function paTex(key, W, H, paint) {
  return paOnce('t' + key, () => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', RF);
    let seed = 1; for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647 || 1;
    const R = (i, j, w, h, col) => { x.fillStyle = col; x.fillRect(i, j, w, h); };
    const P = (i, j, col) => R((Math.round(i) % W + W) % W, Math.round(j), 1, 1, col), F = W >> 1;
    paint({ W, H, F, R, P, S: (i, j, col) => { P(F + i, j, col); P(F - 1 - i, j, col); }, rnd: () => (seed = seed * 16807 % 2147483647) / 2147483647 });
    const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; t.generateMipmaps = false; t.wrapS = THREE.RepeatWrapping;
    t.mipmaps = [cv]; for (let m = cv; m.width > 1 || m.height > 1;) t.mipmaps.push(m = paHalf(m)); // far off: fewer, still flat texels, no shimmer
    return t;
  });
}
function paHalf(src) { // the next mip down: each 2x2 block keeps its most common colour (the darker on a tie), so it stays flat palette colours
  const w = src.width, h = src.height, W = Math.max(1, w >> 1), H = Math.max(1, h >> 1), s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', RF), o = x.createImageData(W, H), ks = [0, 0, 0, 0];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    for (let q = 0; q < 4; q++) ks[q] = (Math.min(h - 1, j * 2 + (q >> 1)) * w + Math.min(w - 1, i * 2 + (q & 1))) * 4;
    let best = ks[0], bn = 0, bl = 1e9;
    for (const k of ks) {
      let n = 0; for (const q of ks) if (s[q] === s[k] && s[q + 1] === s[k + 1] && s[q + 2] === s[k + 2] && s[q + 3] === s[k + 3]) n++;
      const l = s[k] * .3 + s[k + 1] * .59 + s[k + 2] * .11; if (n > bn || (n === bn && l < bl)) { best = k; bn = n; bl = l; }
    }
    o.data.set([s[best], s[best + 1], s[best + 2], s[best + 3]], (j * W + i) * 4); // alpha kept: cut-out textures stay cut out
  }
  x.putImageData(o, 0, 0); return c;
}
// pxMat(key, W, H, paint): a cached toon material wearing a painted texture (paint gets the paTex canvas kit)
export const pxMat = (key, W, H, paint) => paOnce('m' + key, () => new THREE.MeshToonMaterial({ map: paTex(key, W, H, paint), gradientMap: toonRamp() }));
export const stud = (c, x, y, T, sh) => { // a 3 x 3 domed rivet lit from the top left, its shadow down and right
  c.R(x - 1, y - 1, 3, 3, T[3]); c.P(x - 1, y - 1, T[5]); c.P(x, y - 1, T[4]); c.P(x - 1, y, T[4]); c.P(x + 1, y, T[2]); c.P(x, y + 1, T[2]); c.P(x + 1, y + 1, T[1]);
  if (sh) { c.P(x, y + 2, sh); c.P(x + 1, y + 2, sh); c.P(x + 2, y + 1, sh); c.P(x + 2, y, sh); }
};
export const rivet = (c, x, y, T) => { c.P(x, y, T[5]); c.P(x + 1, y, T[3]); c.P(x, y + 1, T[3]); c.P(x + 1, y + 1, T[1]); };

// ---------- painters for the dress kit (cast.js) and any other maker ----------
// Each paints with Q, a 6-shade palette darkest first whose Q[3] is the piece's own colour (a PAL entry, ramp(hex, 6) or NEU).
// kitMat(key, [W, H, paint], hex, o) wears one: painted once on NEU and tinted with hex, so one texture serves every colour of
// the crowd's cloth; o.ramp paints it per colour on ramp(hex, 6) (hair, leather, metal: lights a dark colour can't be tinted
// up to); o.cut = a cut-out (texels left unpainted are see-through).
export const NEU = ['#5d567a', '#8b85a4', '#aba7bb', '#c7c7c7', '#e6e0c4', '#fff9de']; // neutral: shades cool and purple, lights warm
const NB = 199 / 255; // NEU[3]: a tinted material's colour is hex / NB, so its base texels show hex itself
export function kitMat(key, [W, H, paint], hex, o = {}) {
  return paOnce('k' + key + hex + (o.cut ? '~' : ''), () => {
    const m = new THREE.MeshToonMaterial({ map: o.ramp ? paTex(key + hex, W, H, (c) => paint(c, ramp(hex, 6))) : paTex(key, W, H, (c) => paint(c, NEU)), gradientMap: toonRamp(), alphaTest: o.cut ? .5 : 0 });
    if (!o.ramp) m.color.set(hex).multiplyScalar(1 / NB);
    m.userData.hex = new THREE.Color(hex).getHexString(); // the colour it stands for (its .color is a tint, or white for ramps)
    return m;
  });
}
// cloth: n vertical folds over rows y0..y1, each a tube with a lit ridge on its left (a glint partway down), a shaded right side
// into a dark crease, starting at staggered depths and widening as they fall (fan); each crease notches row y1 (the hem dips)
export function paFolds(c, Q, { y0 = 0, y1 = c.H, n = 8, fan = .6, x0 = 0, x1 = c.W } = {}) {
  const { P, rnd } = c, L = y1 - y0, U = (x1 - x0) / n;
  for (let k = 0; k < n; k++) {
    const x = x0 + (k + .25 + rnd() * .5) * U, w = U * (.6 + rnd() * .3), s = y0 + Math.floor(rnd() * L * .35), g = 3 + Math.floor(rnd() * L * .3), gl = 2 + (L >> 3);
    let cx = 0, hw = 1;
    for (let j = s; j < y1; j++) {
      const d = j - s; hw = Math.max(1, Math.round(w * (1 - fan + fan * (j - y0) / L) / 2)); cx = Math.round(x + Math.sin(j * .2 + k * 2.3) * .7);
      if (d < 3) { P(cx + hw, j, Q[2]); continue; }
      for (let i = 1; i < hw; i++) P(cx + i, j, Q[2]);
      P(cx + hw, j, y1 - j < 4 && hw > 2 ? Q[0] : Q[1]); P(cx - hw, j, d >= g && d < g + gl ? Q[5] : Q[4]); if (hw > 3) P(cx - hw + 1, j, Q[4]);
    }
    if (y1 < c.H) { P(cx + hw, y1, Q[0]); P(cx + hw - 1, y1, Q[1]); P(cx + hw + 1, y1, Q[1]); }
  }
}
// a rolled hem over rows y..y+3: the lit roll, a row of stitches, its shadow, the dark edge
export function paHem(c, Q, y, x0 = 0, x1 = c.W) {
  const { R, P } = c, w = x1 - x0; R(x0, y, w, 1, Q[4]); R(x0, y + 1, w, 1, Q[3]); R(x0, y + 2, w, 1, Q[2]); R(x0, y + 3, w, 1, Q[0]);
  for (let x = x0; x < x1; x += 3) P(x, y + 1, Q[2]);
}
export const paStitch = (c, col, y, x0 = 0, x1 = c.W, step = 3) => { for (let x = x0; x < x1; x++) if ((x - x0) % step < step - 1) c.P(x, y, col); }; // a running stitch
// woven trim: a lit top edge, a dark bottom edge, a motif between (Q[1], or Q[5] with o.light); o.cut paints the motif alone
// (lit on its upper strokes), to lay one colour's pattern over another's band
export const MOTIF = { key: ['XXXXX.', 'X...X.', 'X.XXX.', 'X.....', 'XXXXXX'], teeth: ['X...', 'XX..', 'XXX.'], dots: ['.X.', '...'], check: ['XX..', 'XX..', '..XX', '..XX'], wave: ['..XX..', '.X..X.', 'X...X.', '....XX'] };
export function paBand(c, Q, motif = 'dots', o = {}) {
  const { R, P, W, H } = c, M = MOTIF[motif], mw = M[0].length, y0 = Math.max(0, (H - M.length) >> 1);
  if (!o.cut) { R(0, 0, W, H, Q[3]); R(0, 0, W, 1, Q[4]); R(0, H - 1, W, 1, Q[1]); if (H > 5) R(0, H - 2, W, 1, Q[2]); }
  for (let x = 0; x < W; x++) M.forEach((row, j) => { if (row[x % mw] === 'X') P(x, y0 + j, o.cut ? (j && M[j - 1][x % mw] === 'X' ? Q[3] : Q[4]) : Q[o.light ? 5 : 1]); });
}
// leather: grain specks, a lit rolled top edge and a darker lower one, stitching along both (o.stitch false: none)
export function paLeather(c, Q, o = {}) {
  const { R, P, W, H, rnd } = c;
  R(0, 0, W, H, Q[3]); for (let i = 0; i < W * H / 28; i++) P(rnd() * W | 0, rnd() * H | 0, rnd() < .7 ? Q[2] : Q[4]);
  if (o.edge !== false) { R(0, 0, W, 1, Q[4]); R(0, H - 1, W, 1, Q[1]); if (H > 7) { R(0, 1, W, 1, Q[3]); R(0, H - 2, W, 1, Q[2]); } }
  if (o.stitch !== false && H > 5) { paStitch(c, Q[5], 2); paStitch(c, Q[5], H - 3); }
}
// metal round a band or plate: a bright lip, a glint every o.glint texels, a darker lower half, a dark edge; o.rivets: a rivet every n
export function paMetal(c, Q, o = {}) {
  const { R, P, W, H } = c, h2 = H >> 1;
  R(0, 0, W, H, Q[3]); R(0, h2 + 1, W, H - h2 - 2, Q[2]); R(0, 0, W, 1, Q[5]); if (H > 3) R(0, 1, W, 1, Q[4]); R(0, H - 1, W, 1, Q[0]);
  for (let x = 3; x < W; x += o.glint || 12) { P(x, 2, Q[5]); P(x + 1, 2, Q[5]); P(x + 1, 3, Q[4]); P(x + 2, 3, Q[4]); }
  if (o.rivets) for (let x = 2; x < W; x += o.rivets) rivet(c, x, h2, Q);
}
// hair: n locks round the head from the crown (row 0) down, of varied widths, each with a dark gap on its left, its body and a
// shaded right side, a lit block with a glint partway down, and a pointed tip at its own length (rows tip0..tip1) over a darker
// under-layer; from row o.lo down (the nape, the underside) everything a shade darker; o.wave sways the locks (beards, curls)
export function paHair(c, Q, o = {}) {
  const { P, W, H, rnd } = c, n = o.n || 14, t0 = o.tip0 ?? H * .6, t1 = o.tip1 ?? H, sw = o.wave || 0, lo0 = o.lo ?? Math.round(H * .56);
  const ws = Array.from({ length: n }, () => 6 + rnd() * 5), sum = ws.reduce((a, b) => a + b); let acc = 0;
  const L = ws.map((wk) => { const x0 = acc; acc += wk * W / sum; return { x0, tip: t0 + rnd() * (t1 - t0), hl: Math.round(H * (o.sheen ?? .14) + rnd() * 4), hn: 3 + (rnd() * 4 | 0), ph: rnd() * 6 }; });
  const xs = (l, j) => Math.round(l.x0 + sw * Math.sin(j * .5 + l.ph));
  for (let j = 0; j < H; j++) for (let k = 0; k < n; k++) {
    const l = L[k], a = xs(l, j), w = ((xs(L[(k + 1) % n], j) - a) % W + W) % W || 1, lo = j >= lo0, t = (l.tip - j) / 6;
    for (let i = 0; i < w; i++) {
      const p = (i + .5) / w;
      let col = j < 2 ? Q[4] : t <= 0 || Math.abs(p - .55) > .5 * Math.min(1, t) ? (lo ? Q[1] : Q[2]) : i === 0 ? (lo ? Q[0] : Q[1]) : p > .74 ? (lo ? Q[1] : Q[2]) : lo ? Q[2] : Q[3];
      if (!lo && i > 0 && p > .14 && p < .46 && j >= l.hl && j < l.hl + l.hn && t > 0) col = j < l.hl + 2 && p < .34 ? Q[5] : Q[4];
      P(a + i, j, col);
    }
  }
}
// one curl or knot of hair round a small ball (row 0 the top, front at u .75), size-driven so a bigger canvas (a big rig's)
// keeps the texel size: shaded by height, and a spiral lock every ~12 texels round it - a dark crease curling round a lit
// swell, a glint on its crown - so the knots read as curls rather than banded dice
export function paCurl(c, Q) {
  const { R, P, W, H } = c, m = Math.max(2, Math.round(W / 12)), U = W / m;
  for (let j = 0; j < H; j++) R(0, j, W, 1, j < H * .2 ? Q[4] : j < H * .6 ? Q[3] : j < H * .85 ? Q[2] : Q[1]);
  for (let k = 0; k < m; k++) {
    const cx = (k + .5) * U, cy = H * (.4 + (k % 2) * .12), rr = U * .4;
    for (let t = 0; t <= 30; t++) { const a = .4 + t / 30 * 5.2, r0 = rr * (1 - t / 42); P(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * .75, Q[1]); P(cx + Math.cos(a) * (r0 - 1), cy + Math.sin(a) * (r0 - 1) * .75 - 1, a < 3.6 ? Q[4] : Q[3]); }
    P(cx - 1, cy - rr * .6, Q[5]); P(cx, cy - rr * .6, Q[5]);
  }
}
// a beard, or any hair hanging straight down: locks of varied width (about o.lw texels, size-driven, so a bigger canvas gets
// more locks of the same texel size) side by side and overlapping, each a dark parting on its left, a continuous lit ridge
// with a glint partway down, its body (a second strand line on a wide lock) and a shaded right side, swaying gently and
// ending in a pointed tip at its own length (rows tip0..tip1) over the darker under-layer; the roots (top rows) in shade
export function paBeard(c, Q, o = {}) {
  const { P, R, W, H, rnd } = c, lw = o.lw || 6, t0 = o.tip0 ?? H * .6, t1 = o.tip1 ?? H, ws = [];
  for (let sum = 0; sum < W;) { const w = Math.min(W - sum, Math.max(3, Math.round(lw * (.6 + rnd() * .9)))); if (w < 3 && ws.length) ws[ws.length - 1] += w; else ws.push(w); sum += w; }
  R(0, 0, W, H, Q[1]);
  let x0 = 0;
  for (const w of ws) {
    const tip = t0 + rnd() * (t1 - t0), g0 = Math.round(H * (.15 + rnd() * .35)), ph = rnd() * 6, amp = .5 + rnd() * 1.2, rg = Math.max(1, Math.round(w * .3)), s2 = w >= 7 ? Math.round(w * .65) : -1;
    for (let j = 0; j < Math.min(H, Math.ceil(tip)); j++) {
      const tw = Math.min(1, (tip - j) / 5), off = Math.round(amp * Math.sin(j * .18 + ph));
      for (let i = 0; i < w; i++) {
        const p = (i + .5) / w; if (Math.abs(p - .5) > tw * .5) continue;
        P(x0 + i + off, j, i === 0 ? Q[1] : i === rg ? (j >= g0 && j < g0 + 3 ? Q[5] : Q[4]) : i === rg - 1 ? Q[4] : i === s2 || p > .78 ? Q[2] : Q[3]);
      }
    }
    x0 += w;
  }
  R(0, 0, W, Math.max(1, H >> 4), Q[2]);
}
// wood along v (a shaft, handle or plank): wavy grain, a knot or two, a lit stripe
export function paWood(c, Q) {
  const { R, P, W, H, rnd } = c;
  R(0, 0, W, H, Q[3]); R(W >> 2, 0, 1, H, Q[4]);
  for (let k = 1; k < W; k += 3) { const ph = rnd() * 6; for (let j = 0; j < H; j++) if (Math.sin(j * .3 + ph) > -.2) P(k + Math.round(Math.sin(j * .11 + ph)), j, Q[2]); }
  for (let i = 0; i < Math.max(1, H / 20); i++) { const x = rnd() * W | 0, y = 2 + rnd() * (H - 4) | 0; P(x, y, Q[0]); P(x + 1, y, Q[1]); P(x, y - 1, Q[4]); P(x, y + 1, Q[2]); }
}
// cut-out lacing round a limb (sandal straps, bindings): w-texel straps crossing in front every `step` rows from y0 to y1, each
// lit along its upper edge and dark along its lower one (wear it with kitMat's o.cut)
export function paLaces(c, Q, { y0 = 0, y1 = c.H, step = 8, w = 2 } = {}) {
  const { P, W } = c;
  for (let y = y0; y < y1; y += step) for (let x = 0; x < W; x++) for (const s of [1, -1]) {
    const yy = y + Math.round(((s * (x - W / 2) + W) % W) / W * step);
    for (let k = 0; k < w; k++) if (yy + k < y1) P(x, yy + k, k === 0 ? Q[4] : k === w - 1 ? Q[1] : Q[3]);
  }
}

// ---------- creature kit (bestiary.js, the beasts in models.js): seamless tiles and painted eyes ----------
// A tile repeats over every part of a rig built in one flat colour; skin() sizes the repeat per part, so one texel stays about
// the same size on a big body and a thin leg. Tiles paint with Q as above (6 shades darkest first, Q[3] the base).
const wrapP = (c) => (i, j, col) => c.P(i, ((Math.round(j) % c.H) + c.H) % c.H, col); // P wrapping both ways (seamless tiles)
// staggered rows of overlapping drops (scales, feathers), the lower rows first so each row's tips lie over the roots below it:
// lit upper left, shaded right, a dark rim (Q[o.rim], default 1). w x h a drop, o.step the row pitch, o.quill a lit shaft down
// each drop (feathers), o.glint the share of drops with a glint
export function paScallops(c, Q, o = {}) {
  const P = wrapP(c), { W, H, rnd } = c, w = o.w || 6, h = o.h || 8, st = o.step || Math.max(2, Math.round(h * .55)), n = Math.round(H / st), rim = Q[o.rim ?? 1];
  c.R(0, 0, W, H, rim);
  for (let r = n - 1; r >= -1; r--) for (let x = (r & 1) * (w >> 1); x < W; x += w) { // row -1: the last row again, over the first one's roots
    const y = r * st;
    for (let j = Math.max(0, -y); j < h; j++) {
      const t = j / (h - 1), v = j - (h - st), hw = w / 2 * Math.sqrt(Math.max(0, 1 - Math.max(0, (t - .3) / .7) ** 2));
      for (let i = 0; i < w; i++) {
        const d = Math.abs(i + .5 - w / 2); if (d > hw + .2) continue;
        let col = d > hw - .8 || j === h - 1 ? rim : v >= 0 && v < 2 && i < w / 2 ? Q[4] : i + .5 > w * .62 ? Q[2] : Q[3];
        if (o.quill && d < .6 && j < h - 2) col = Q[4];
        P(x + i, y + j, col);
      }
    }
    if (r >= 0 && o.glint && rnd() < o.glint) P(x + (w >> 2), y + h - st, Q[5]);
  }
}
// fur: a tuft in each cw x ch cell (rows staggered): a dark strand hooking down and right under a lit tip, now and then a deep
// root or a glint; o.long the strand length (shaggy coats), o.glint the share of tufts with a glint
export function paFur(c, Q, o = {}) {
  const P = wrapP(c), { W, H, rnd } = c, cw = o.cw || 6, ch = o.ch || 5, L = o.long || 3;
  c.R(0, 0, W, H, Q[3]);
  for (let y0 = 0, row = 0; y0 < H; y0 += ch, row++) for (let x0 = (row & 1) * (cw >> 1); x0 < W + cw; x0 += cw) {
    const x = x0 + 1 + (rnd() * (cw - 2) | 0), y = y0 + (rnd() * (ch - 1) | 0);
    for (let k = 0; k < L; k++) P(x + (k * 2 >= L ? 1 : 0), y + k, k === 0 && rnd() < .4 ? Q[1] : Q[2]);
    P(x - 1, y - 1, Q[4]); P(x - 1, y, Q[4]); if (L > 3) P(x, y - 1, Q[4]);
    if (rnd() < (o.glint ?? .2)) P(x - 2, y - 1, Q[5]);
  }
}
// a flat ground (Q[3]) with flecks, pits, bumps lit upper left and cracks with a lit lip (o.fleck, o.pit, o.bump, o.crack:
// how many per 100 texels): hide, stone, bone, chitin
export function paGrit(c, Q, o = {}) {
  const P = wrapP(c), { W, H, rnd } = c, n = (k) => Math.round(W * H / 100 * (o[k] ?? 0));
  c.R(0, 0, W, H, Q[3]);
  for (let k = n('fleck'); k-- > 0;) P(rnd() * W, rnd() * H, rnd() < .55 ? Q[2] : Q[4]);
  for (let k = n('pit'); k-- > 0;) { const x = rnd() * W | 0, y = rnd() * H | 0; P(x, y, Q[1]); P(x + 1, y, Q[2]); P(x, y + 1, Q[2]); P(x + 1, y + 1, Q[4]); }
  for (let k = n('bump'); k-- > 0;) { const x = rnd() * W | 0, y = rnd() * H | 0; P(x, y, Q[5]); P(x + 1, y, Q[4]); P(x, y + 1, Q[4]); P(x + 2, y + 1, Q[2]); P(x + 1, y + 2, Q[2]); P(x + 2, y + 2, Q[1]); }
  for (let k = n('crack'); k-- > 0;) { let x = rnd() * W, y = rnd() * H; for (let s = 5 + rnd() * 8; s > 0; s--) { P(x, y, Q[0]); P(x + 1, y, Q[4]); x += Math.round(rnd() * 2 - 1); y++; } }
}
// paTile(key, W, H, paint, neu): a tile (neu: painted on NEU, to be tinted); tileMat(tile, ru, rv, tint): a cached toon material
// wearing it ru x rv times, tinted with a colour (a neu tile's base texels then show the tint itself, as kitMat does)
export const paTile = (key, W, H, paint, neu) => ({ key, W, H, paint, neu });
export const tileMat = (T, ru = 1, rv = 1, tint) => paOnce(`m${T.key}@${ru}x${rv}${tint || ''}`, () => {
  const t = paTex(T.key, T.W, T.H, T.paint).clone(); t.wrapT = THREE.RepeatWrapping; t.repeat.set(ru, rv); t.needsUpdate = true;
  const m = new THREE.MeshToonMaterial({ map: t, gradientMap: toonRamp() }); if (tint) m.color.set(tint).multiplyScalar(T.neu ? 1 / NB : 1); return m;
});
// strands down a seamless tile (hair, manes, horsehair, rags, grain): o.gap texels apart, lit, shaded and deep in turn, each
// swaying o.wave texels o.waves times down the tile (W a multiple of 3 gaps)
export function paStrands(c, Q, o = {}) {
  const P = wrapP(c), { W, H, rnd } = c, g = o.gap || 3, a = o.wave ?? 1, nw = o.waves || 1;
  c.R(0, 0, W, H, Q[3]);
  for (let x = 0; x < W; x += g) {
    const ph = rnd() * 6.283, k = (x / g) % 3, col = k === 0 ? Q[4] : k === 1 ? Q[2] : Q[1];
    for (let y = 0; y < H; y++) { const xx = x + Math.round(Math.sin(y / H * 6.283 * nw + ph) * a); P(xx, y, col); if (k === 0 && (y * 7 + x) % 13 === 0) P(xx, y, Q[5]); }
  }
}
// skin(root, map, D): every mesh under root still in a flat colour that map names ({ '#rrggbb': tile, or [tile, tint] }) wears
// that tile, repeated to about D texels a metre (whole repeats round balls and cylinders, so no seam shows; a part smaller
// than the tile shows just a piece of it; a disc such as a shield is sized by its face, not its rim)
const _ws = new THREE.Vector3(), _rs = new THREE.Vector3();
export function skin(root, map, D = 100) {
  root.updateMatrixWorld(true); root.getWorldScale(_rs);
  root.traverse((o) => {
    const m = o.material, e = o.isMesh && !o.userData.outline && !o.userData.fx && m?.color && !m.map && !m.transparent && !m.isMeshBasicMaterial && map['#' + m.color.getHexString()];
    if (!e) return;
    const [T, tint] = e.key ? [e] : e, p = o.geometry.parameters || {}, ty = o.geometry.type; o.getWorldScale(_ws).divide(_rs);
    const R = p.radius ?? Math.max(p.radiusTop ?? 0, p.radiusBottom ?? 0), rd = Math.max(_ws.x, _ws.z);
    const [u, v] = /Icosa|Sphere|Dodeca|Octa/.test(ty) ? [2 * Math.PI * R * rd, Math.PI * R * _ws.y] : /Cyl|Cone/.test(ty) ? (p.height * _ws.y < R * rd * .25 ? [2 * R * rd, 2 * R * rd] : [2 * Math.PI * R * rd, p.height * _ws.y]) : [rd, Math.max(_ws.y, Math.min(_ws.x, _ws.z))];
    const fit = (n, wrap) => (n >= 1 || wrap ? Math.max(1, Math.round(n)) : Math.max(.25, Math.round(n * 8) / 8)); // a part smaller than the tile shows a piece of it, not all of it squeezed
    o.material = tileMat(T, fit(u * D / T.W, R > 0), fit(v * D / T.H), tint);
  });
}
// pxEye(iris, kind): a painted eye for an eye box: the lid's shadow, the iris lit from below, the pupil ('round', 'slit' for
// snakes and harpies, 'bar' for goats, 'bead' all dark for birds, 'gem' all iris for bugs and crabs) and a white glint up left
export const pxEye = (iris, kind = 'round') => paOnce('mEye' + iris + kind, () => new THREE.MeshToonMaterial({ gradientMap: toonRamp(), map: paTex('eye' + iris + kind, 8, 6, (c) => {
  const { R, P } = c, I = ramp(iris, 4), K = '#140d14', G = '#ffffff';
  R(0, 0, 8, 6, kind === 'bead' ? K : I[1]); if (kind !== 'bead') { R(1, 3, 6, 2, I[2]); R(2, 4, 4, 1, I[3]); }
  if (kind === 'gem') { R(0, 0, 8, 6, I[2]); R(1, 1, 6, 4, I[3]); R(4, 3, 3, 2, I[1]); }
  R(0, 0, 8, 1, K);
  if (kind === 'round') { R(3, 1, 2, 4, K); R(2, 2, 4, 2, K); } else if (kind === 'slit') R(3, 1, 2, 5, K); else if (kind === 'bar') R(1, 2, 6, 2, K);
  P(2, 1, G); P(3, 1, G); P(2, 2, G); if (kind === 'bead') P(5, 4, '#4a3c58');
}) }));
