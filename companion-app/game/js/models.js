import * as THREE from './three.module.min.js';
import { toonRamp, faceRamp, addOutline, LOOK, pxRig, GFX } from './render.js';
import { batchRig } from './rigbatch.js'; // the characters' still parts drawn as one per bone (draw calls)
import { giveHands, updateHands } from './hands.js'; // Roy 29.10: hands with fingers (?hands=final, the default; a|b|c|b1|b2|b3|old)
import { PXART, PAL, paOnce, paTex, stud, rivet } from './pxart.js';
import * as C from './cast.js'; // dress kit (cyclic import: only used inside makers, at call time)
import * as PXK from './pxart.js'; // the creature kit (tiles, skin, eyes) for the beasts below
import { ROPE, makeRope, stepRope, hitSphere, hitSection, hitBox, bendChain } from './rope.js'; // round 33: the shared rope physics (V's braids, hair, capes)
const RF = { willReadFrequently: true }; // painted canvases are read back for the flat mips: keep them in CPU memory

// ---------- materials & geometry caches ----------
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    let m;
    if (opts.basic) m = new THREE.MeshBasicMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, fog: opts.fog ?? true });
    else m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), emissive: opts.emissive || 0x000000, transparent: !!opts.opacity, opacity: opts.opacity ?? 1 });
    matCache.set(key, m);
  }
  return matCache.get(key);
}
const geoCache = new Map();
const SHARED = new WeakSet(); // every cached (shared, never edited) geometry: refineRig only swaps these
const G = (key, make) => { if (!geoCache.has(key)) { const g = make(); geoCache.set(key, g); SHARED.add(g); } return geoCache.get(key); };
const boxGeo = () => G('box', () => new THREE.BoxGeometry(1, 1, 1));
const DET = LOOK.detail || 1; // the HD look rounds every character part: twice the sides, one more subdivision
// round 33 (NPC): a build-detail cap for the crowd's middle level of detail (folk.js): while LOD.cap is set, every part
// built gets at most that many sides and big balls one subdivision (small ones none), refineRig adds nothing and robes
// keep few columns. Off (0) everywhere else, so nothing but the crowd's mid figures is built differently.
export const LOD = { cap: 0 };
const capS = (s) => (LOD.cap ? Math.min(Math.round(s * DET), LOD.cap) : Math.round(s * DET));
const capD = (r, d) => (LOD.cap ? Math.min(d, r >= .14 ? 1 : 0) : d + (DET > 1 ? 1 : 0));
const cylGeo = (rt, rb, h, s) => { const n = capS(s); return G(`c${rt},${rb},${h},${s}${LOD.cap ? '~' + n : ''}`, () => new THREE.CylinderGeometry(rt, rb, h, n)); };
const icoGeo = (r, d) => { const n = capD(r, d); return G(`i${r},${d}${LOD.cap ? '~' + n : ''}`, () => new THREE.IcosahedronGeometry(r, n)); };
const coneGeo = (r, h, s) => { const n = capS(s); return G(`k${r},${h},${s}${LOD.cap ? '~' + n : ''}`, () => new THREE.ConeGeometry(r, h, n)); };
export const HDFACE = /[?&]face=hd\b/.test(location.search); // prototype painted faces (hdFace); off = the box faces
export const PXFACE = !HDFACE && !/[?&]face=box\b/.test(location.search); // pixel-art faces (pxFace, on the hd patches); ?face=box = the old box faces

function mesh(parent, geo, color, x, y, z, opts) {
  const m = new THREE.Mesh(geo, opts && opts.material ? opts.material : mat(color, opts));
  m.position.set(x, y, z); m.castShadow = !(opts && opts.noShadow); parent.add(m); return m;
}
export function box(parent, w, h, d, color, x = 0, y = 0, z = 0, opts) { const m = mesh(parent, boxGeo(), color, x, y, z, opts); m.scale.set(w, h, d); return m; }
export function cyl(parent, r, h, color, x = 0, y = 0, z = 0, seg = 8, opts) { return mesh(parent, cylGeo(r, opts?.r2 ?? r, h, seg), color, x, y, z, opts); }
export function tcyl(parent, rt, rb, h, color, x = 0, y = 0, z = 0, seg = 7, opts) { return mesh(parent, cylGeo(rt, rb, h, seg), color, x, y, z, opts); }
export function ball(parent, r, color, x = 0, y = 0, z = 0, detail = 1, opts) { return mesh(parent, icoGeo(r, detail), color, x, y, z, opts); }
export function cone(parent, r, h, color, x = 0, y = 0, z = 0, seg = 6, opts) { return mesh(parent, coneGeo(r, h, seg), color, x, y, z, opts); }
export function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// ---------- generic humanoid rig (faces +z, ~1.85 tall) ----------
export function humanoid(spec) {
  const s = Object.assign({ skin: '#e2b08c', top: '#7a6a55', bottom: '#5a4a3a', legs: null, boots: '#3a2a20', sleeve: null, scale: 1 }, spec);
  const tint = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  const root = new THREE.Group();
  // the rig is authored with armR/legR on +x, but facing +z that is the anatomical LEFT: mirror the whole body so
  // handR (weapon) is her right hand and elbowL (shield) her left. Local poses are unchanged; world yaw (look) flips.
  const flip = pivot(root, 0, 0, 0); flip.scale.x = -1;
  const body = pivot(flip, 0, 0, 0);
  const hip = pivot(body, 0, .9, 0);
  const legL = pivot(hip, -.11, -.02, 0), legR = pivot(hip, .11, -.02, 0);
  const knees = [];
  for (const L of [legL, legR]) {
    L.rotation.order = 'ZXY'; // splay (z) tilts the plane the leg swings in
    tcyl(L, .095, .075, .44, s.legs || s.skin, 0, -.22, 0);
    const kn = pivot(L, 0, -.44, 0); knees.push(kn);
    ball(kn, .07, s.legs || s.skin, 0, 0, 0, 0, { noShadow: true });
    tcyl(kn, .08, .07, .3, s.boots, 0, -.14, 0);
    box(kn, .13, .09, .24, s.boots, 0, -.34, .04);
  }
  const torso = pivot(hip, 0, 0, 0);
  tcyl(torso, .19, .22, .2, s.bottom, 0, 0, 0, 8);
  const chest = tcyl(torso, .25, .18, .5, s.top, 0, .34, 0, 8); chest.scale.z = .72;
  tcyl(torso, .06, .07, .1, s.faceless ? s.skin : tint(s.skin, '#2a1810', .2), 0, .63, 0, 6); // neck in the chin's shadow
  const head = pivot(torso, 0, .68, 0);
  const skull = ball(head, .2, s.skin, 0, .19, 0, 1); skull.scale.set(1, 1.08, .98);
  const eyes = []; let mouth = null;
  const lid = s.liner || tint(s.skin, '#1c120e', .78), socket = tint(s.skin, '#5a3020', .14), blush = tint(s.skin, '#d8584c', .13);
  const noseSh = tint(s.skin, '#3a1c14', .42), lipLo = tint(s.lips || '#9a5a50', s.skin, .4);
  let hd = null;
  if (!s.faceless && (HDFACE || PXFACE)) ({ mouth, hd } = (PXFACE ? pxFace : hdFace)(head, skull, s, eyes));
  else if (!s.faceless) {
    for (const sx of [-1, 1]) {
      // eye: white, an iris a touch taller than the opening with a catchlight, a dark upper lid that dips at the outer
      // corner (reads as lashes and gives the eye an almond shape at portrait size); a soft socket shade under the brow
      const e = pivot(head, sx * .072, .205, .19); eyes.push(e);
      if (s.liner) box(e, .088, .056, .012, s.liner, 0, .002, -.004, { noShadow: true });
      box(e, .062, .038, .016, s.white || '#f2ece2', 0, -.002, 0, { noShadow: true });
      box(e, .032, .042, .012, s.eyes || '#2a1c18', -sx * .007, -.003, .01, { noShadow: true });
      box(e, .012, .012, .006, '#fffaf0', -sx * .007 + sx * .008, .008, .017, { noShadow: true, basic: true });
      box(e, .072, .013, .014, lid, 0, .02, .006, { noShadow: true });
      box(e, .016, .022, .012, lid, sx * .033, .008, .004, { noShadow: true }).rotation.z = sx * .55;
      box(head, .084, .022, .012, socket, sx * .072, .232, .184, { noShadow: true });
      const br = box(head, .084, .024, .022, s.brow || '#2a1c16', sx * .074, .258, .188, { noShadow: true }); br.rotation.z = -sx * (s.browTilt ?? .14);
      box(head, .046, .024, .02, blush, sx * .112, .136, .165, { noShadow: true }).rotation.y = sx * .55; // warm cheek
      ball(head, .042, s.skin, sx * .2, .18, -.01, 0, { noShadow: true });
    }
    // nose: a wedge (tip out further than the bridge) with a shadow line under it, so it reads against the face
    box(head, .034, .066, .042, s.skin, 0, .158, .196, { noShadow: true }).rotation.x = -.22;
    box(head, .048, .013, .024, noseSh, 0, .124, .204, { noShadow: true });
    mouth = box(head, .07, .018, .02, s.lips || '#9a5a50', 0, .095, .186, { noShadow: true });
    box(head, .044, .014, .016, lipLo, 0, .079, .184, { noShadow: true }); // lower lip
  }
  const armL = pivot(torso, -.29, .56, 0), armR = pivot(torso, .29, .56, 0);
  const elbows = [];
  for (const A of [armL, armR]) {
    ball(A, .085, s.sleeve || s.top, 0, 0, 0, 0);
    tcyl(A, .068, .058, .3, s.sleeve || s.skin, 0, -.16, 0, 6);
    const el = pivot(A, 0, -.3, 0); elbows.push(el);
    ball(el, .054, s.skin, 0, 0, 0, 0, { noShadow: true });
    tcyl(el, .058, .048, .28, s.skin, 0, -.14, 0, 6);
    ball(el, .055, s.skin, 0, -.3, 0, 0);
  }
  const handL = pivot(elbows[0], 0, -.32, .02), handR = pivot(elbows[1], 0, -.32, .02);
  root.scale.setScalar(s.scale);
  return {
    root, flip, body, hip, torso, head, armL, armR, legL, legR, handL, handR, eyes, mouth, phase: Math.random() * 6, blink: 1 + Math.random() * 3, talkT: 0, s,
    elbowL: elbows[0], elbowR: elbows[1], kneeL: knees[0], kneeR: knees[1], skull, ...(hd && { hd, hdLips: hd.lips }),
  };
}

// ---------- HD faces (?face=hd prototype) ----------
// The skull itself wears the painted skin (soft socket/nose/lip/jaw shading, blush) through front-projected UVs, so the
// silhouette and outline stay the skull's. Eyes, brows and lips are small textured patches laid on the skull's own facets
// (eye pivots blink by y-scale, the mouth pivot talks by y-scale and its lips part); a small modelled nose. Every texture
// is canvas-painted once per parameter set and shared; patches are fx (no outline, never flashed, hidden in after-images).
const hdCache = new Map(), once = (k, make) => { if (!hdCache.has(k)) hdCache.set(k, make()); return hdCache.get(k); };
const SKS = [1, 1.08, .98], SKY = .19, FACE_BASE = .86, ES = 1.3, LS = 1.25; // skull scale and centre height in the head (see humanoid); eye, lip patch scale
const css = (c, a = 1) => { const q = new THREE.Color(c); return `rgba(${q.r * 255 | 0},${q.g * 255 | 0},${q.b * 255 | 0},${a})`; };
const mixc = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const bez = (a, b, c, d, t) => { const u = 1 - t; return [0, 1].map((i) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i]); };
// paint(ctx, W, H, bold): with mips, every mip level is painted again at its own size, the small ones bold (bigger,
// simpler shapes, no soft fall-off), and the chain stops at 1/16 so an eye a few pixels across (portraits, play
// distance) is sampled crisp, like the old box eyes, instead of averaging away
function paintTex(key, w, h, paint, mips) {
  return once('t' + key, () => {
    const lv = (W, H, b) => { const c = document.createElement('canvas'); c.width = W; c.height = H; paint(c.getContext('2d', RF), W, H, b); return c; };
    const t = new THREE.CanvasTexture(lv(w, h, 0)); t.anisotropy = 4;
    if (mips) { t.mipmaps = [t.image]; for (let W = w, H = h; W > w / 16 && (W > 1 || H > 1);) { W = Math.max(1, W >> 1); H = Math.max(1, H >> 1); t.mipmaps.push(lv(W, H, Math.min(1, Math.max(0, (.32 - W / w) / .2)))); } t.generateMipmaps = false; }
    return t;
  });
}
function blob(x, cx, cy, rx, ry, col, a, rot = 0) { // soft elliptical dab
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(rx, ry);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, css(col, a)); g.addColorStop(.5, css(col, a * .6)); g.addColorStop(1, css(col, 0));
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore();
}
function fadeEdges(x, W, H) { // nothing reaches a patch's border: alpha falls to 0 over the outer fifth of an inscribed ellipse
  x.save(); x.globalCompositeOperation = 'destination-in'; x.translate(W / 2, H / 2); x.scale(W / 2, H / 2);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(.78, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(-1, -1, 2, 2); x.restore();
}
// a soft-edged fill: the path is drawn far off the canvas and only its blurred shadow lands (canvas filters aren't everywhere)
function soft(x, blur, col, a, path) { x.save(); x.shadowColor = css(col, a); x.shadowBlur = blur; x.shadowOffsetX = 4000; x.translate(-4000, 0); x.fillStyle = '#000'; x.beginPath(); path(); x.fill(); x.restore(); }

// skin paint, multiplied onto the skin colour (FACE_BASE grey = the skin itself); head-space coordinates
function faceTex(kind) { // 'f', 'm', or 'b' (bold: a sculpted, less rosy woman's face, V)
  const fem = kind !== 'm', bold = kind === 'b';
  return paintTex('face' + kind, 512, 512, (x, W, H) => {
    const B = (hx, hy, rx, ry, col, a, rot = 0) => blob(x, (.5 + hx / .44) * W, (.5 - (hy - SKY) / SKS[1] / .44) * H, rx / .44 * W, ry / SKS[1] / .44 * H, col, a, rot);
    const v = Math.round(FACE_BASE * 255); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, 0, W, H);
    const SH = '#7a4c48', DK = '#5a2a2a', BL = '#f0645a', HI = '#ffffff', hw = fem ? .028 : .031;
    for (const sx of [-1, 1]) {
      B(sx * .158, .085, .04, .1, SH, bold ? .36 : fem ? .3 : .22, sx * .5); // jaw contour: a narrower, sculpted lower face
      B(sx * .165, .25, .03, .055, SH, .14); // temples
      B(sx * .082, .246, .058, .016, SH, .4); // lid crease under the brow
      B(sx * .035, .222, .014, .024, SH, .3); // inner sockets beside the bridge
      B(sx * .085, .166, .04, .009, SH, .14); // under the eyes
      B(sx * .016, .172, .007, .03, SH, bold ? .36 : .28); // nose sides
      B(sx * .112, .145, .042, .024, BL, bold ? .2 : fem ? .34 : .14); // cheeks
      if (fem) B(sx * .108, .174, .03, .009, HI, bold ? .28 : .2); // cheekbone sheen
      B(sx * (hw * LS + .002), .1, .006, .006, DK, .22); // mouth corners
    }
    B(0, .131, .018, .007, DK, .45); // under the nose
    B(0, .152, .009, .007, HI, .3); B(0, .19, .006, .02, HI, .14); // nose tip and bridge catch the light
    B(0, .118, .006, .008, SH, .2); // philtrum
    B(0, .079, .026, .007, SH, .45); // under the lower lip
    B(0, .052, .024, .016, HI, .16); B(0, -.005, .11, .04, SH, .45); // chin, and the jaw's underside: a shorter lower face
    B(0, .31, .055, .03, HI, .14); // forehead
  });
}
// eye: almond opening (outer corner = +x, lifted for women), shaded white, rimmed iris and pupil, a thick upper lash line
// with a flick, a thin lower line; smoky = a dark smudge all round (V). Units: head units (x ES), a 0.12 x 0.1 patch.
const EYEW = .12, EYEH = .1, EYE = (f) => ({ i: [-.034, -.003], o: [.035, f ? .007 : .002], u1: [-.023, f ? .016 : .015], u2: [.016, f ? .021 : .018], l1: [.022, -.014], l2: [-.014, -.019] });
function eyeTex(o) {
  return paintTex('eye' + JSON.stringify(o), 300, 250, (x, W, H, bo) => {
    const px = W / 300, k = W / EYEW, gx = 1 + .15 * bo, gy = 1 + .45 * bo, P = (p) => [W / 2 + p[0] * k * gx, H / 2 - p[1] * k * gy], E = EYE(o.fem), N = 24; // small mips: a bigger, simpler eye
    const almond = () => { x.moveTo(...P(E.i)); x.bezierCurveTo(...P(E.u1), ...P(E.u2), ...P(E.o)); x.bezierCurveTo(...P(E.l1), ...P(E.l2), ...P(E.i)); x.closePath(); };
    const lash = o.liner, dark = mixc(lash, '#000000', .3);
    const ring = (sx, sy, dy) => () => { x.save(); x.translate(W / 2 + .003 * k, H / 2 - dy * k); x.scale(sx, sy); x.translate(-W / 2, -H / 2); almond(); x.restore(); };
    const nb = 1 - bo; // small mips: no soft fall-off, the white kept clear
    if (!o.stone && o.smoky) { soft(x, 24 * px, lash, .4 * nb, ring(1.4, 2.4, .004)); soft(x, 12 * px, lash, .6 * nb, ring(1.22, 1.65, .002)); soft(x, 5 * px, lash, .95 * (1 - .5 * bo), ring(1.08, 1.2, .001)); } // V's smoky liner: darkest at the lashes
    else if (!o.stone && o.fem) soft(x, 9 * px, lash, .32 * nb, ring(1.12, 1.35, .003)); // a light wash of shadow on the lid
    x.save(); x.beginPath(); almond(); x.clip();
    x.fillStyle = o.white; x.fillRect(0, 0, W, H);
    let g = x.createLinearGradient(0, P([0, .024])[1], 0, P([0, -.006])[1]); g.addColorStop(0, css(dark, o.glow ? 0 : .6 * (1 - .7 * bo))); g.addColorStop(1, css(dark, 0)); x.fillStyle = g; x.fillRect(0, 0, W, H); // the lid's shadow
    blob(x, ...P([E.i[0] + .004, E.i[1] + .001]), .004 * k, .003 * k, '#c86a64', o.stone || o.glow ? 0 : .6 * nb); // inner corner
    const [cx, cy] = P([.001, .0005]), ir = (o.fem ? .0152 : .0138) * k * (1 + .25 * bo), iris = o.glow || mixc(o.iris, '#000000', .45 * bo);
    g = x.createRadialGradient(cx, cy + ir * .4, ir * .1, cx, cy, ir);
    g.addColorStop(0, mixc(iris, '#ffffff', o.glow ? .7 : .4)); g.addColorStop(.55, iris); g.addColorStop(.88, mixc(iris, '#000000', .4)); g.addColorStop(1, mixc(iris, '#000000', .72));
    x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, ir, ir * 1.06, 0, 0, 7); x.fill();
    if (!o.stone) { x.fillStyle = o.glow ? mixc(o.glow, '#ffffff', .8) : o.slit || '#0a080b'; x.beginPath(); x.ellipse(cx, cy, ir * (o.slit ? .16 : .37), ir * (o.slit ? .86 : .4), 0, 0, 7); x.fill(); }
    g = x.createLinearGradient(0, cy - ir, 0, cy + ir * .2); g.addColorStop(0, css('#000000', o.glow ? 0 : .3 * nb)); g.addColorStop(1, css('#000000', 0)); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.restore();
    // upper lash line, thickening toward the outer corner, with a flick for women
    const up = []; for (let i = 0; i <= N; i++) up.push(bez(E.i, E.u1, E.u2, E.o, i / N));
    const t0 = Math.max((o.smoky ? .003 : o.fem ? .0024 : .0018) * (1 + .3 * bo), bo * 1.5 / k), t1 = Math.max((o.stone ? .002 : o.smoky ? .009 : o.fem ? .0058 : .0034) * (1 + .1 * bo), bo * 2 / k);
    x.fillStyle = o.stone ? css(lash, .6) : lash; x.beginPath(); x.moveTo(...P(up[0])); for (let i = 1; i <= N; i++) x.lineTo(...P(up[i]));
    if (o.fem && !o.stone) x.lineTo(...P([E.o[0] + (o.smoky ? .014 : .011), E.o[1] + (o.smoky ? .01 : .008)]));
    for (let i = N; i >= 0; i--) { const p = up[i], a = up[Math.min(N, i + 1)], b = up[Math.max(0, i - 1)], dx = a[0] - b[0], dy = a[1] - b[1], L = Math.hypot(dx, dy) || 1, th = t0 + (t1 - t0) * Math.pow(i / N, 1.3); x.lineTo(...P([p[0] - dy / L * th, p[1] + dx / L * th])); }
    x.fill();
    // lower line: outer corner to the middle, fading
    const lo = []; for (let i = 0; i <= N; i++) lo.push(bez(E.o, E.l1, E.l2, E.i, i / N));
    const M = Math.round(N * (o.smoky ? .95 : .7)), tl = Math.max(o.smoky ? .0032 : o.fem ? .0016 : .0011, bo * 1.2 / k);
    x.fillStyle = css(lash, o.stone ? .3 : o.fem ? .85 : .55); x.beginPath(); x.moveTo(...P(lo[0])); for (let i = 1; i <= M; i++) x.lineTo(...P(lo[i]));
    for (let i = M; i >= 0; i--) { const p = lo[i], a = lo[Math.min(N, i + 1)], b = lo[Math.max(0, i - 1)], dx = a[0] - b[0], dy = a[1] - b[1], L = Math.hypot(dx, dy) || 1, th = tl * (1 - i / M); x.lineTo(...P([p[0] - dy / L * th, p[1] + dx / L * th])); }
    x.fill();
    // crease line over the lid
    if (!o.smoky && bo < 1) { x.strokeStyle = css(lash, (o.stone ? .2 : .18) * nb); x.lineWidth = .0012 * k; x.lineCap = 'round'; x.beginPath();
      for (let i = 5; i <= N - 3; i++) { const p = up[i]; x.lineTo(...P([p[0] + .001, p[1] + .0052 + .0015 * Math.sin(i / N * Math.PI)])); } x.stroke(); }
    fadeEdges(x, W, H);
  }, true);
}
const catchTex = () => paintTex('catch', 300, 250, (x, W, H) => { // two glints, upper one large (light from above)
  const k = W / EYEW, P = (a, b) => [W / 2 + a * k, H / 2 - b * k];
  blob(x, ...P(-.0035, .0055), .0052 * k, .0052 * k, '#ffffff', .5); x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(...P(-.0035, .0055), .0028 * k, 0, 7); x.fill();
  x.beginPath(); x.arc(...P(.0062, -.0058), .0013 * k, 0, 7); x.fill();
});
// brow: inner end (-) rises to an arch two thirds along and tapers to the tail (+); white, tinted by the material
const browTex = (fem, bw) => paintTex('brow' + fem + bw, 256, 64, (x, W, H, bo) => { // bw: weight (thicker, straighter)
  const k = W / .09, P = (a, b) => [W / 2 + a * k, H / 2 - b * k], N = 30, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, a = -.04 + s * .08, arch = (fem ? .0055 : .0028) / bw * Math.sin(Math.PI * Math.pow(s, .8)), th = Math.max((fem ? .0074 : .0115) * bw * (1 + .3 * bo) * (1 - Math.pow(s, 2.2) * .86) * Math.min(1, .7 + s * 4), bo * 1.2 / k);
    top.push(P(a, arch + th * .55)); bot.push(P(a, arch - th * .45));
  }
  const path = () => { top.forEach((p) => x.lineTo(...p)); for (let i = N; i >= 0; i--) x.lineTo(...bot[i]); x.closePath(); };
  soft(x, 3 * W / 256, '#ffffff', 1, path); x.fillStyle = '#ffffff'; x.beginPath(); path(); x.fill();
  x.globalCompositeOperation = 'destination-in'; const g = x.createLinearGradient(P(-.04, 0)[0], 0, P(-.02, 0)[0], 0); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = g; x.fillRect(0, 0, W, H); // feathered inner end
}, true);
// lips: upper (cupid's bow) in the top half, lower in the bottom half, the mouth line between; in a beard the upper lip
// takes the beard's colour (the moustache) and a small dark lower lip shows under it
function lipsTex(o) {
  return paintTex('lips' + JSON.stringify(o), 256, 128, (x, W, H, bo) => {
    const k = W / .08, P = (a, b) => [W / 2 + a * k, H / 2 - b * k], hw = (o.beard ? .022 : o.fem ? .028 : .031) * (1 + .1 * bo), L = o.beard || o.lips, g = 1 + .5 * bo; // g: fuller at small mips
    const al = o.beard ? .9 : o.fem ? .96 : .6 + .2 * bo, ub = (o.beard ? .003 : o.fem ? .0085 : .006) * g, lb = (o.beard ? .0055 : o.fem ? .0105 : .0078) * g;
    x.fillStyle = css(mixc(L, '#000000', o.fem ? .22 : .12), al); x.beginPath(); x.moveTo(...P(-hw, 0));
    x.bezierCurveTo(...P(-hw * .6, ub * .45), ...P(-hw * .3, ub * 1.1), ...P(-.0062, ub)); x.quadraticCurveTo(...P(0, ub * .55), ...P(.0062, ub));
    x.bezierCurveTo(...P(hw * .3, ub * 1.1), ...P(hw * .6, ub * .45), ...P(hw, 0)); x.quadraticCurveTo(...P(0, -.0014), ...P(-hw, 0)); x.fill();
    x.fillStyle = css(o.beard ? mixc(mixc(o.lips, o.beard, .35), '#000000', .35) : L, al); x.beginPath(); x.moveTo(...P(-hw, 0)); x.quadraticCurveTo(...P(0, -.0014), ...P(hw, 0));
    x.bezierCurveTo(...P(hw * .75, -lb * .7), ...P(hw * .4, -lb), ...P(0, -lb)); x.bezierCurveTo(...P(-hw * .4, -lb), ...P(-hw * .75, -lb * .7), ...P(-hw, 0)); x.fill();
    if (!o.beard) blob(x, ...P(-.003, -lb * .48), .0095 * k, .0026 * k, '#ffffff', (o.fem ? .5 : .16) * (1 - bo)); // gloss on the lower lip
    x.strokeStyle = css(mixc(L, '#000000', .6), .9); x.lineWidth = Math.max((o.fem ? .0013 : .0015) * k * (1 + bo), bo * 1.2); x.lineCap = 'round';
    x.beginPath(); x.moveTo(...P(-hw * .97, .0004)); x.quadraticCurveTo(...P(0, -.0022), ...P(hw * .97, .0004)); x.stroke();
  }, true);
}
const innerTex = (beard) => paintTex('mouthIn' + !!beard, 128, 64, (x, W, H) => {
  x.fillStyle = '#3a1418'; x.beginPath(); x.ellipse(W / 2, H / 2, W * (beard ? .36 : .48), H * .46, 0, 0, 7); x.fill(); if (beard) return; // in a beard: only the dark
  blob(x, W / 2, H * .82, W * .3, H * .22, '#a04848', .8); x.fillStyle = 'rgba(236,228,216,.9)'; x.beginPath(); x.ellipse(W / 2, H * .12, W * .32, H * .2, 0, 0, 7); x.fill();
});
const decal = (map, color = '#ffffff', basic) => {
  const o = { map, color, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
  return basic ? new THREE.MeshBasicMaterial(o) : new THREE.MeshToonMaterial(Object.assign(o, { gradientMap: faceRamp() })); // lit like the skin under it
};
const eyeMat = (o) => once('m' + JSON.stringify(o), () => decal(eyeTex(o), '#ffffff', !!o.glow));
const faceMat = (skin, kind) => once('mf' + skin + kind, () => new THREE.MeshToonMaterial({ color: new THREE.Color(skin).multiplyScalar(1 / FACE_BASE), map: faceTex(kind), gradientMap: faceRamp() }));

// the skull with front-projected UVs (the back of the head maps to the texture's blank side columns)
const faceUV = (geo) => once('uv' + geo.uuid, () => {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(), p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const X = p.getX(i); uv[i * 2] = p.getZ(i) > -.02 ? .5 + X / .44 : X < 0 ? .004 : .996; uv[i * 2 + 1] = .5 + p.getY(i) / .44; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
});
// the skull's front-facing triangles in head space, to lay patches exactly on its facets
const frontTris = (geo) => once('tri' + geo.uuid, () => {
  const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, n = g.attributes.normal, T = [];
  const V = (i) => [p.getX(i) * SKS[0], p.getY(i) * SKS[1] + SKY, p.getZ(i) * SKS[2], n.getX(i) / SKS[0], n.getY(i) / SKS[1], n.getZ(i) / SKS[2]];
  for (let i = 0; i < p.count; i += 3) {
    const a = V(i), b = V(i + 1), c = V(i + 2), d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (d > 1e-9) T.push({ a, b, c, d, x0: Math.min(a[0], b[0], c[0]), x1: Math.max(a[0], b[0], c[0]), y0: Math.min(a[1], b[1], c[1]), y1: Math.max(a[1], b[1], c[1]) });
  }
  return T;
});
function surf(T, x, y) { // [z, nx, ny, nz] of the skull's front surface over (x, y)
  for (const t of T) {
    if (x < t.x0 - 1e-6 || x > t.x1 + 1e-6 || y < t.y0 - 1e-6 || y > t.y1 + 1e-6) continue;
    const { a, b, c, d } = t, u = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / d, v = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / d, w = 1 - u - v;
    if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
    const nx = a[3] * w + b[3] * u + c[3] * v, ny = a[4] * w + b[4] * u + c[4] * v, nz = a[5] * w + b[5] * u + c[5] * v, L = Math.hypot(nx, ny, nz);
    return [a[2] * w + b[2] * u + c[2] * v, nx / L, ny / L, nz / L];
  }
  const q = 1 - (x / SKS[0] / .2) ** 2 - ((y - SKY) / SKS[1] / .2) ** 2; return [Math.sqrt(Math.max(0, q)) * .2 * SKS[2], 0, 0, 1];
}
// a w x h grid laid on the skull round c (head space), its u axis turned th and mirrored for sx = -1 (so u = 1 is always
// the outer end), lifted off the surface, positioned relative to o; vr = the texture rows it shows
function patch(geo, o, c, w, h, sx, th, lift, vr = [0, 1], n = 10, m = 6) {
  return once(['p', geo.uuid, o, c, w, h, sx, th, lift, vr].join(), () => {
    const T = frontTris(geo), ax = sx * Math.cos(th), ay = Math.sin(th), bx = -sx * Math.sin(th), by = Math.cos(th), pos = [], nor = [], uv = [], idx = [];
    for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) {
      const a = (i / n - .5) * w, b = (j / m - .5) * h, x = c[0] + a * ax + b * bx, y = c[1] + a * ay + b * by, S = surf(T, x, y);
      pos.push(x - o[0], y - o[1], S[0] + lift - o[2]); nor.push(S[1], S[2], S[3]); uv.push(i / n, vr[0] + j / m * (vr[1] - vr[0]));
    }
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const p = j * (n + 1) + i, q = p + n + 1; if (sx > 0) idx.push(p, p + 1, q + 1, p, q + 1, q); else idx.push(p, q + 1, p + 1, p, q, q + 1); }
    const g = new THREE.BufferGeometry(); g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  });
}
function hdFace(head, skull, s, eyes) {
  const fem = s.fem ?? !!s.liner, stone = !!s.white && s.white === s.skin, geo = skull.geometry, T = frontTris(geo), Z = (x, y) => surf(T, x, y)[0];
  const fx = (m, ro = -1) => { m.castShadow = false; m.renderOrder = ro; m.userData.fx = m.userData.outline = m.userData.hd = true; return m; };
  const add = (parent, g, material, ro) => { const m = fx(new THREE.Mesh(g, material), ro); parent.add(m); return m; };
  if (!stone) { skull.geometry = faceUV(geo); skull.material = faceMat(s.skin, s.smoky ? 'b' : fem ? 'f' : 'm'); }
  const eo = { iris: s.eyes || '#2a1c18', white: stone ? s.skin : s.white || '#f2ece2', liner: stone ? s.eyes : s.liner || mixc(s.brow || '#2a1c16', '#140c0a', .55), fem, smoky: s.smoky || 0, stone };
  const eyeMeshes = [], catches = [], brows = [], th = Math.round((s.browTilt ?? .14) * .8 / .02) * .02;
  for (const sx of [-1, 1]) {
    const ex = sx * .08, ey = .205, ez = Z(ex, ey), e = pivot(head, ex, ey, ez); eyes.push(e);
    eyeMeshes.push(add(e, patch(geo, [ex, ey, ez], [ex, ey], EYEW * ES, EYEH * ES, sx, 0, .003, [0, 1], 16, 12), eyeMat(eo), -2));
    if (!stone) catches.push(add(e, patch(geo, [ex, ey, ez], [ex, ey], EYEW * ES, EYEH * ES, 1, 0, .0034, [0, 1], 16, 12), once('mc', () => decal(catchTex(), '#ffffff', true))));
    const bx = sx * .084, by = .26, bz = Z(bx, by), col = mixc(s.brow || '#2a1c16', '#000000', stone ? 0 : .18), bw = s.browW || (fem ? 1 : 1.35); // men keep the heavier brow the box faces had
    const bm = add(head, patch(geo, [bx, by, bz], [bx, by], .11, .0275, sx, th, .0026, [0, 1], 14, 4), once('mb' + col + fem + bw, () => decal(browTex(fem, bw), col))); bm.position.set(bx, by, bz);
    brows.push({ m: bm, pts: [-.045, 0, .045].map((a) => { const x = bx + a * sx * Math.cos(th), y = by + a * Math.sin(th); return [x, y, Z(x, y)]; }) });
    ball(head, .042, s.skin, sx * .2, .18, -.01, 0, { noShadow: true }); // ears, as before
  }
  // nose: a slim bridge and a rounded tip (the painted shading does the rest)
  const tip = ball(head, fem ? .0115 : .014, s.skin, 0, .147, Z(0, .147) + (fem ? .0008 : .0018), 1, { noShadow: true }); tip.scale.set(1.3, .8, .95);
  const br = ball(head, .009, s.skin, 0, .176, Z(0, .176) - .0035, 1, { noShadow: true }); br.scale.set(fem ? .8 : 1, 3, .9); br.rotation.x = -.15;
  // mouth: a dark inside, then upper and lower lips that part as the pivot is scaled (animateRig keeps their own height)
  const my = .1, mz = Z(0, my) + .002, mouth = pivot(head, 0, my, mz), lo = { lips: s.lips || '#9a5a50', fem }, eU = .003, eL = .008;
  const inner = add(mouth, patch(geo, [0, my, mz], [0, my], .046 * LS, .012 * LS, 1, 0, .0018, [0, 1], 8, 3), once('mi', () => decal(innerTex())), -3);
  const lm = once('ml' + JSON.stringify(lo), () => decal(lipsTex(lo)));
  const lipU = add(mouth, patch(geo, [0, my + eU, mz], [0, my + .01 * LS], .08 * LS, .02 * LS, 1, 0, .003, [.5, 1], 14, 4), lm), lipL = add(mouth, patch(geo, [0, my - eL, mz], [0, my - .01 * LS], .08 * LS, .02 * LS, 1, 0, .003, [0, .5], 14, 4), lm);
  lipU.position.y = eU; lipL.position.y = -eL;
  return { mouth, hd: { eo, lo, eyeMeshes, catches, brows, lips: [lipU, lipL], inner, mz, fm: !stone && skull.material } };
}
// after the dressers ran (finish): fold what they hung on the old face into the painted one
const _hdRay = new THREE.Raycaster(), _hdO = new THREE.Vector3(), _hdD = new THREE.Vector3();
function hdSettle(r) {
  const h = r.hd, sm = r.skull.material;
  if (h.fm && sm !== h.fm && !sm.map && sm.color && sm.color.equals(new THREE.Color(r.s.skin))) r.skull.material = h.fm; // re-skinned (a hood left open): the paint back
  for (const e of r.eyes) for (const c of e.children) if (c.isMesh && !c.userData.hd) { // lash bars, slit pupils, glowing eyes
    c.visible = false;
    if (c.material.isMeshBasicMaterial) h.eo.glow = '#' + c.material.color.getHexString();
    else if (c.scale.x < .012 && c.scale.y > .03) h.eo.slit = '#' + c.material.color.getHexString();
  }
  if (h.eo.glow || h.eo.slit) { if (h.reLids) h.reLids(); else for (const m of h.eyeMeshes) m.material = eyeMat(h.eo); if (h.eo.glow) for (const m of h.catches) m.visible = false; }
  r.root.updateMatrixWorld(true);
  const kids = r.head.children.filter((c) => (c.isMesh || c.isGroup) && !c.userData.hd && c !== r.skull && c !== r.mouth && !r.eyes.includes(c));
  const front = (x, y) => { // the nearest surface over the skull at (x, y), in head space (hair, veil, beard)
    r.head.localToWorld(_hdO.set(x, y, .6)); r.head.localToWorld(_hdD.set(x, y, 0)).sub(_hdO).normalize(); _hdRay.set(_hdO, _hdD);
    const hit = _hdRay.intersectObjects(kids, true).find((i) => !i.object.userData.hd); return hit ? r.head.worldToLocal(hit.point).z : -1;
  };
  // hair or a veil worn low over the brows: the brows sit on its edge instead of vanishing under it
  for (const b of h.brows) { if (b.fit) { b.fit(front); continue; } let lift = 0; for (const [x, y, z] of b.pts) lift = Math.max(lift, front(x, y) - z); if (lift > 0) b.m.position.z += Math.min(.02, lift + .002); }
  if (r.mouth.material) { // beard(): a dark mouth set on the beard's surface
    h.lo = { ...h.lo, beard: '#' + r.mouth.material.color.getHexString() };
    if (r.beardCol && h.skin && h.skin[2] === 'm' && !h.skin[3].stub) setFace(r, { stub: r.beardCol }); // round 33: the beard's shadow on the jaw round it
    if (h.reMouth) h.reMouth(); else { const lm = once('ml' + JSON.stringify(h.lo), () => decal(lipsTex(h.lo))); for (const l of h.lips) l.material = lm; h.inner.material = once('mib', () => decal(innerTex(1))); }
    const z = front(0, r.mouth.position.y); if (z > h.mz) r.mouth.position.z = z + .003;
  } else if (r.mouth.position.z > h.mz + .01) r.mouth.position.z = h.mz; // goatee: the lips stay on the skin under the moustache
}
// ---------- pixel faces (?face=px): the hd patches, painted as flat pixel art on one texel grid ----------
// A face texel is PT head units on a grid fixed to the head, so the skin paint, eyes, brows and mouth line up. Each
// character gets a few flat colours; textures are nearest-sampled and their small mips keep the darkest texel of each
// 2x2, so lash, iris and brow survive at portrait and play distance. Blink and talk swap sprites (see animateRig).
const PT = .01; // features about the old boxes' size, each drawn with about twice their detail (an eye ~9 x 5 texels)
function pxTex(key, W, H, paint, mips = true) { // paint(set, ctx): set(col, row, colour) fills one texel
  return once('x' + key, () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', RF);
    paint((i, j, col) => { if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } }, x);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    if (mips) { t.minFilter = THREE.NearestMipmapNearestFilter; t.mipmaps = [c]; for (let p = c; p.width > 1 || p.height > 1;) t.mipmaps.push(p = pxHalf(p)); }
    return t;
  });
}
function pxHalf(src) { // the next mip down: each 2x2 block keeps its darkest opaque texel
  const w = src.width, h = src.height, W = Math.max(1, w >> 1), H = Math.max(1, h >> 1), s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', RF), o = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let best = -1, lum = 1e9;
    for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
      const k = (Math.min(h - 1, j * 2 + b) * w + Math.min(w - 1, i * 2 + a)) * 4, l = s[k] * .3 + s[k + 1] * .59 + s[k + 2] * .11;
      if (s[k + 3] > 127 && l < lum) { lum = l; best = k; }
    }
    if (best >= 0) o.data.set([s[best], s[best + 1], s[best + 2], 255], (j * W + i) * 4);
  }
  x.putImageData(o, 0, 0); return c;
}
// 12 x 8 eyes, col 0 = the inner corner: L lash, l lower liner, M smoky shade, W white, D iris dark, I iris, C catchlight;
// m a man's, f a woman's (lash flick), b V's smoky liner; x = shut
const PXEYE = {
  m: ['............', '............', '....LLLLL...', '...LWDDDWL..', '..lWWICIWWl.', '....WIIIW...', '............', '............'],
  f: ['............', '...........L', '....LLLLLLLL', '...LWDDDWLL.', '..LWWICIWWL.', '...lWIIIWl..', '............', '............'],
  b: ['............', '...MMMMMMMML', '..MLLLLLLLL.', '..LLWDDDWLL.', '.MLWWICIWWLM', '..MLWIIIWLM.', '...MLLLLLM..', '....MMMMM...'],
  mx: ['............', '............', '............', '............', '..lLLLLLLLl.', '............', '............', '............'],
  fx: ['............', '............', '............', '...........L', '..LLLLLLLLL.', '............', '............', '............'],
  bx: ['............', '............', '...MMMMMMM..', '..MMMMMMMMML', '.MLLLLLLLLLM', '...MMMMMMM..', '............', '............'],
  // V (round 33, 12 x 10): a big open eye, iris 4 x 4 with its catchlight, a lifted lash wing, a rose lower line
  v: ['..........LL', '...MMMMMMLL.', '..LLLLLLLLL.', '..LWWDDDDWL.', '..WWDCIIDWW.', '..WWDIIIIWW.', '..lWIIIIIWl.', '...lWIIIWl..', '....llll....', '............'],
  vx: ['............', '............', '............', '...MMMMMMM.L', '...MMMMMMML.', '..LLLLLLLLL.', '...lllllll..', '............', '............', '............'],
  // round 33 stage 2 (Roy: "V-style faces for all"): the same big open eye for everyone, 12 x 10, iris 4 x 4 with its
  // catchlight. w a woman's (a clean lash line lifting into a small wing, a rose lower line), u a man's (a straighter lid,
  // no wing, a lower line in the skin's shade); o = an old face (a heavy lid fold over the iris); x = shut
  w: ['............', '...........L', '..LLLLLLLLLL', '..LWWDDDDWL.', '..WWDCIIDWW.', '..WWDIIIIWW.', '..lWIIIIIWl.', '...lWIIIWl..', '....llll....', '............'],
  wx: ['............', '............', '............', '............', '...........L', '..LLLLLLLLL.', '...lllllll..', '............', '............', '............'],
  u: ['............', '............', '...LLLLLLL..', '..LWWDDDDWL.', '..WWDCIIDWW.', '..WWDIIIIWW.', '...WIIIIIW..', '....lllll...', '............', '............'],
  ux: ['............', '............', '............', '............', '............', '..LLLLLLLLL.', '...lllllll..', '............', '............', '............'],
  wo: ['............', '...MMMMMMM.L', '..MLLLLLLLLL', '..LLLLLLLLL.', '..WWDCIIDWW.', '..WWDIIIIWW.', '..lWIIIIIWl.', '...lWIIIWl..', '....llll....', '............'],
  wox: ['............', '............', '...MMMMMMM..', '..MMMMMMMMML', '..MLLLLLLLL.', '..LLLLLLLLL.', '...lllllll..', '............', '............', '............'],
  uo: ['............', '...MMMMMM...', '..MLLLLLLLM.', '..LLLLLLLLL.', '..WWDCIIDWW.', '..WWDIIIIWW.', '...WIIIIIW..', '....lllll...', '............', '............'],
  uox: ['............', '............', '...MMMMMM...', '..MMMMMMMMM.', '..MMMMMMMMM.', '..LLLLLLLLL.', '...lllllll..', '............', '............', '............'],
  // BETA ONLINE (Roy 29.10: "eye type, 3 kinds", js/online/heroes.js setEyes): beside the round ones (V's v, a woman's w, a
  // man's u), almond (ua: longer, the outer corner drawn out to a point) and narrow (wn / un: the lid low over the iris)
  ua: ['............', '............', '............', '....LLLLLLL.', '..LLWDDDDWLL', '.lWWDCIIDWW.', '..lWDIIIIWl.', '...llllll...', '............', '............'],
  wn: ['............', '............', '............', '...........L', '..LLLLLLLLLL', '..LWDCIIDWL.', '..lWIIIIIWl.', '...lllllll..', '............', '............'],
  un: ['............', '............', '............', '............', '..LLLLLLLLL.', '..LWDCIIDWL.', '...lWIIIIWl.', '....llll....', '............', '............'],
};
PXEYE.uax = PXEYE.unx = PXEYE.ux; PXEYE.wnx = PXEYE.wx; // (shut, they close as the round ones do)
function pxEyeTex(o, shut) {
  const big = o.vv || o.st, rows = PXEYE[(o.vv ? 'v' : o.st ? o.st + (o.old ? 'o' : '') : o.smoky ? 'b' : o.fem ? 'f' : 'm') + (shut ? 'x' : '')];
  return pxTex('eye' + JSON.stringify(o) + shut, 12, big ? 10 : 8, (set) => {
    const sk = o.skin, st = o.stone, g = o.glow, sl = o.slit, pc = rows[4].indexOf('C');
    const lo = o.vv ? mixc('#b05a6a', sk, .35) : o.st?.[0] === 'w' ? mixc('#b05a6a', sk, .5) : o.st?.[0] === 'u' ? mixc(o.liner, sk, .62) : mixc(o.liner, sk, .45);
    const P = { L: st ? mixc(sk, '#000000', .3) : o.liner, l: st ? null : lo, M: st ? (o.old ? mixc(sk, '#000000', .14) : null) : mixc(o.liner, sk, o.vv ? .72 : o.old ? .66 : .5),
      W: st ? sk : g ? mixc(g, '#000000', .55) : sl ? o.iris : o.white, I: st ? mixc(sk, '#000000', .12) : g || o.iris,
      D: st ? mixc(sk, '#000000', .2) : g || sl || mixc(o.iris, '#000000', .5), C: st ? mixc(sk, '#000000', .12) : g ? mixc(g, '#ffffff', .7) : '#fffaf0' };
    rows.forEach((r, j) => [...r].forEach((ch, i) => set(i, j, P[sl && 'IDC'.includes(ch) ? (i === pc ? 'D' : 'I') : ch]))); // a slit pupil runs down the iris
  });
}
// 12 x 6 brow, col 0 inner, white (tinted by the material): two texels thick, stepping up per browTilt (+ = stern, the
// inner end low, - = worried); arched = a woman's arch and thin tail, heavy = three texels thick (men's heavier brow)
function pxBrowTex(arched, tilt, heavy, fine) { // fine (round 33): a woman's fine brow, V's: two texels at the inner end, one along the arch
  const R = Math.max(-2, Math.min(2, Math.round(tilt * 6))), L = 9;
  return pxTex('brow' + arched + R + heavy + (fine ? 'f' : ''), 12, 6, (set) => {
    for (let c = 0; c < L; c++) {
      const y = (R >= 0 ? c * (R + 1) : (L - 1 - c) * (1 - R)) / L | 0, th = arched && (c >= L - 2 || (fine && c >= 3)) ? 1 : heavy && c < L - 3 ? 3 : 2; // even steps
      for (let k = 0; k < th; k++) set(1 + c, 3 - y - (arched && c > 2 && c < 7 ? 1 : 0) + k, '#ffffff');
    }
  });
}
// 8 x 4 mouth: U upper lip (shade), P lower lip, K the dark inside; b = in a beard (the moustache is the upper lip)
const PXMOUTH = { c: ['........', '.UUUUUU.', '..PPPP..', '........'], o: ['........', '.UUUUUU.', '..KKKK..', '..PPPP..'],
  bc: ['........', '..KKKK..', '..PPPP..', '........'], bo: ['........', '..KKKK..', '..KKKK..', '..PPPP..'] };
function pxMouthTex(lo, skin, open) {
  return pxTex('mouth' + JSON.stringify(lo) + skin + open, 8, 4, (set) => {
    const L = lo.lips, b = lo.beard, P = b ? { K: mixc(b, '#000000', .6), P: mixc(mixc(L, b, .35), '#000000', .3) }
      : lo.fem ? { U: mixc(L, '#000000', .28), P: L, K: '#3a1418' } : { U: mixc(mixc(L, skin, .3), '#000000', .25), P: mixc(L, skin, .45), K: '#3a1418' };
    PXMOUTH[(b ? 'b' : '') + (open ? 'o' : 'c')].forEach((r, j) => [...r].forEach((ch, i) => set(i, j, P[ch])));
  });
}
function pxFaceTex(skin, fem, jaw, o = {}) { // the skull's front, 50 x 50 texels (texel i, j at column i + 25, row 43 - j): flat skin, the nose's shadow, a blush block for women
  return pxTex('face' + skin + fem + (jaw || '') + (o.old ? 'o' : '') + (o.stub || ''), 50, 50, (set, x) => {
    x.fillStyle = skin; x.fillRect(0, 0, 50, 50);
    const S = (i, j, c) => set(i + 25, 43 - j, c), sh = mixc(skin, '#3a1c14', .3);
    S(0, 14, sh); S(0, 13, sh); S(-1, 13, sh); // the nose: its shaded side and underside
    if (jaw === 'm') { // round 33 stage 2: a man's face in V's manner: a squarer jaw shaded two texels deep, the chin's underside, a lit
      // chin and nose bridge, a longer nose, a faint hollow under the cheekbone, a little warmth on the cheek (no blush)
      const jw = mixc(skin, '#5a2c3c', .26), jw2 = mixc(skin, '#5a2c3c', .13), lt = mixc(skin, '#fff4ec', .3);
      for (let j = 2; j <= 10; j++) { const i = 13 - Math.max(0, 4 - j); S(-i, j, jw); S(i - 1, j, jw); S(-i + 1, j, jw2); S(i - 2, j, jw2); }
      for (let i = -9; i <= 8; i++) S(i, 1, Math.abs(i + .5) < 7 ? jw : jw2); for (let i = -6; i <= 5; i++) S(i, 0, jw);
      S(0, 15, sh); S(-1, 3, lt); S(0, 3, lt); S(-1, 15, lt); S(-1, 16, lt); S(-1, 17, lt);
      for (const [i, j] of [[-10, 10], [-9, 9], [9, 10], [8, 9]]) S(i, j, jw2);
      for (const i of [-12, -11, 10, 11]) S(i, 11, mixc(skin, '#d86050', .09));
      if (o.stub) for (let j = 1; j <= 10; j++) for (let i = -12; i <= 11; i++) { // a shaved beard's shadow round the jaw and chin, flecked
        const ai = Math.abs(i + .5); if ((j > 6 && ai < 7) || ai > 12.5 - Math.max(0, 4 - j) || (j > 8 && ai < 10)) continue;
        if ((i * 3 + j * 5) % 4 < 2) S(i, j, mixc(skin, o.stub, (i + j) % 3 ? .2 : .32));
      }
    } else if (jaw) { // round 33: the Blender Val's jaw and chin: a soft shade along the jawline, a lit chin, a nose-bridge highlight
      const jw = mixc(skin, '#7a3c48', .22), lt = mixc(skin, '#fff4ec', .35);
      for (let j = 2; j <= 9; j++) { const i = 13 - Math.max(0, 6 - j); S(-i, j, jw); S(i - 1, j, jw); if (j < 6) { S(-i + 1, j, jw); S(i - 2, j, jw); } }
      for (let i = -4; i <= 3; i++) S(i, 1, jw);
      S(-1, 4, lt); S(0, 4, lt); S(-1, 15, lt); S(-1, 16, lt);
      for (const i of [-12, -11, -10, 9, 10, 11]) for (const j of [10, 11]) S(i, j, mixc(skin, '#e8606a', .16)); // a wider, softer blush, lower on the cheek
    }
    if (fem && !jaw) for (const i of [-11, -10, 9, 10]) S(i, 13, mixc(skin, '#e05050', .25)); // cheeks
    if (o.old) { // age: a fold under each eye, crow's feet at the outer corners, the lines from nose to mouth, two across the brow
      const wl = mixc(skin, '#5a2c3c', .2);
      for (const sx of [-1, 1]) {
        const X = (i) => (sx < 0 ? -i : i - 1);
        for (let i = 5; i <= 10; i++) S(X(i), 15, wl);
        for (const [i, j] of [[14, 21], [15, 22], [14, 18], [15, 17]]) S(X(i), j, wl);
        for (const [i, j] of [[4, 12], [5, 11], [5, 10], [6, 9], [6, 8]]) S(X(i), j, wl);
      }
      for (const j of [30, 33]) for (let i = -7; i <= 6; i++) if ((i + j) % 5) S(i, j + (Math.abs(i + .5) > 4 ? 1 : 0), wl);
    }
  }, false);
}
const pxUV = (geo) => once('pxuv' + geo.uuid, () => { // head-space x, y straight onto the texel grid: x -.25...25, y -.06...44
  const g = geo.index ? geo.toNonIndexed() : geo.clone(), p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const X = p.getX(i); uv[i * 2] = p.getZ(i) > -.02 ? (X * SKS[0] + .25) * 2 : X < 0 ? .01 : .99; uv[i * 2 + 1] = (p.getY(i) * SKS[1] + SKY + .06) * 2; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
});
export const PXOLD = /[?&]face=small\b/.test(location.search); // the faces before round 33's stage 2 (small eyes), for comparison
const pxSkin = (skin, fem, jaw, o) => once('mpf' + skin + fem + (jaw || '') + (o.old ? 'o' : '') + (o.stub || ''), () => new THREE.MeshToonMaterial({ map: pxFaceTex(skin, fem, jaw, o), gradientMap: faceRamp() }));
// setFace(r, {old, stub}): age a pixel face after it was made (a fold over the eyes, lines round them), or shade a shaved
// or bearded man's jaw with his beard's colour (stub: a colour). The same face otherwise.
export function setFace(r, o = {}) {
  const h = r?.hd; if (!h?.px || !h.skin) return r;
  const [skin, fem, jaw, fo] = h.skin, nf = { ...fo, ...o }; h.skin[3] = nf;
  if (h.fm && r.skull.material === h.fm) r.skull.material = h.fm = pxSkin(skin, fem, jaw, nf);
  if (o.old !== undefined && h.eo.st) { if (o.old) h.eo.old = 1; else delete h.eo.old; h.reLids(); }
  return r;
}
function pxFace(head, skull, s, eyes) {
  const fem = s.fem ?? !!s.liner, stone = !!s.white && s.white === s.skin, geo = skull.geometry, T = frontTris(geo), Z = (x, y) => surf(T, x, y)[0];
  const fx = (m, ro = -1) => { m.castShadow = false; m.renderOrder = ro; m.userData.fx = m.userData.outline = m.userData.hd = true; return m; };
  const add = (parent, g, material, ro) => { const m = fx(new THREE.Mesh(g, material), ro); parent.add(m); return m; };
  const grid = (i0, j0, w, h, sx, lift, dz = 0) => { // a w x h texel patch from texel (i0, j0), mirrored for sx = -1; o = its centre on the skull
    const c = [sx * (i0 + w / 2) * PT, (j0 + h / 2) * PT], o = [c[0], c[1], Z(c[0], c[1]) + dz]; return { o, g: patch(geo, o, c, w * PT, h * PT, sx, 0, lift, [0, 1], w, h) };
  };
  // round 33 stage 2: every face in V's manner (big eyes, a woman's soft jaw and blush, a man's squarer jaw); ?face=small: the old eyes
  const jaw = s.jaw ?? (PXOLD ? 0 : fem ? 1 : 'm'), fo = { old: !!s.old, stub: s.stub || null };
  if (!stone) { skull.geometry = pxUV(geo); skull.material = pxSkin(s.skin, fem, jaw, fo); }
  const eo = { iris: s.eyes || '#2a1c18', white: stone ? s.skin : s.white || '#f2ece2', liner: stone ? s.eyes : s.liner || mixc(s.brow || '#2a1c16', '#140c0a', .55), fem, smoky: s.smoky || 0, stone, skin: s.skin, ...(s.vv ? { vv: 1 } : !PXOLD && { st: fem && !s.smoky ? 'w' : fem ? 0 : 'u', ...(s.old && { old: 1 }) }) };
  if (eo.st === 0) { delete eo.st; eo.vv = 1; } // a smoky-eyed woman: V's own eye
  const em = (o, shut) => once('mpe' + JSON.stringify(o) + shut, () => decal(pxEyeTex(o, shut), '#ffffff', !!o.glow));
  const fine = !PXOLD && fem && !s.vv; // round 33: women's brows fine and a little softer in colour, never a scowl
  const eyeMeshes = [], lids = [], brows = [], bw = s.browW || (fem ? 1 : 1.35), col = fine ? mixc(mixc(s.brow || '#2a1c16', '#000000', .1), s.skin, .18) : mixc(s.brow || '#2a1c16', '#000000', stone ? 0 : .18), tilt = fine ? Math.min(.12, s.browTilt ?? .1) : s.browTilt ?? .14;
  for (const sx of [-1, 1]) {
    const big = eo.vv || eo.st, E = big ? grid(2, 16, 12, 10, sx, .003) : grid(2, 17, 12, 8, sx, .003), e = pivot(head, ...E.o); eyes.push(e);
    const op = add(e, E.g, em(eo, 0), -2), sh = add(e, E.g, em(eo, 1), -2); sh.visible = false;
    eyeMeshes.push(op); lids.push([op, sh, e]);
    const BJ = big ? 26 : 25, B = grid(3, BJ, 12, 6, sx, .0026), bm = add(head, B.g, once('mpb' + col + fem + tilt + bw + fine, () => decal(pxBrowTex(fem && bw <= 1.2, tilt, !fem && bw > 1.2, fine), col))); bm.position.set(...B.o);
    brows.push({ m: bm, fit: (front) => { // a band or veil over the brows: drawn on the skin just under it (up to 3 texels lower), else left out
      for (let k = 0; k <= 3; k++) if ([4.5, 8, 11.5].every((i) => [BJ + 1.5, BJ + 3.5].every((j) => { const x = sx * i * PT, y = (j - k) * PT; return front(x, y) < Z(x, y) + .001; }))) {
        if (k) { const D = grid(3, BJ - k, 12, 6, sx, .0026); bm.geometry = D.g; bm.position.set(...D.o); } return;
      }
      bm.visible = false;
    } });
    ball(head, .042, s.skin, sx * .2, .18, -.01, 0, { noShadow: true }); // ears, as before
  }
  // mouth: a closed and an open sprite on the mouth pivot (animateRig swaps them while talking)
  const M = grid(-4, 7, 8, 4, 1, .003, .002), mz = M.o[2], mouth = pivot(head, ...M.o), lo = { lips: s.lips || '#9a5a50', fem };
  const mm = (lo, open) => once('mpm' + JSON.stringify(lo) + s.skin + open, () => decal(pxMouthTex(lo, s.skin, open)));
  const mc = add(mouth, M.g, mm(lo, 0)), mo = add(mouth, M.g, mm(lo, 1)); mo.visible = false;
  const h = { eo, lo, eyeMeshes, catches: [], brows, mz, fm: !stone && skull.material, px: { lids, mouth: [mc, mo] }, skin: [s.skin, fem, jaw, fo] };
  h.reEye = () => em(h.eo, 0); h.reMouth = () => { mc.material = mm(h.lo, 0); mo.material = mm(h.lo, 1); };
  h.reLids = () => { for (const [op, shut] of lids) { op.material = em(h.eo, 0); shut.material = em(h.eo, 1); } };
  return { mouth, hd: h };
}
export function sword(hand, blade = '#c3c8d2', len = .72) {
  const g = new THREE.Group(); hand.add(g);
  box(g, .05, .05, .2, '#3a2a20', 0, 0, .02);
  box(g, .22, .04, .05, '#80858f', 0, 0, .13);
  box(g, .07, .025, len, blade, 0, 0, .16 + len / 2);
  cone(g, .045, .1, blade, 0, 0, .21 + len, 4, { noShadow: true }).rotation.x = Math.PI / 2;
  return g;
}

export const finish = (r) => { refineRig(r); if (r.hd) hdSettle(r); addOutline(r.root, (m) => !m.castShadow || m.material.isMeshBasicMaterial); return r; };

// ---------- round 33 stage 2 (Roy: "V's upgrade on every humanoid"): rounder parts, finer joints, shaped feet ----------
// Runs once per humanoid rig before its parts are merged (cast.js bake, pxgods.js seal) or outlined (finish). Only shared
// cached geometry is swapped (never a part someone shaped by hand), and geometry parameters stay the same (radiusTop === .25
// and the like still find their parts). Rounder by size: a body-sized cylinder gets 14 sides, a limb 10, a trim 7, a big
// ball (a head of hair, a hood) one more subdivision; low-end devices (GFX low) keep their sides, so crowds stay cheap.
// Then the joints: a slimmer shoulder cap (no knob over a bare arm), hands shaped like hands, feet with a rounded toe and
// heel instead of a block. V has her own (refineV) and is skipped.
const footGeo = () => G('rfoot', () => { // a unit box (groups and uvs kept, so the boot dressers still find their faces) with a rounded toe, a narrower heel, the toe sloping down
  const g = new THREE.BoxGeometry(1, 1, 1, 2, 1, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i); const z = p.getZ(i);
    if (z > .05) x *= 1 - .42 * ((z - .05) / .45) ** 2; else if (z < -.25) x *= 1 - .25 * ((-.25 - z) / .25) ** 2;
    if (y > 0 && z > .15) y -= .45 * (z - .15) / .35;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
});
export function refineRig(r) {
  if (!r?.root || r._rfd || r.isV || !r.armL || !r.kneeL || LOD.cap) return r;
  r._rfd = true;
  const tier = GFX.tier, low = tier === 'low';
  r.root.traverse((o) => {
    if (!o.isMesh || o.userData.fx || o.userData.cloth || !SHARED.has(o.geometry)) return;
    const g = o.geometry, q = g.parameters || {}, k = Math.max(Math.abs(o.scale.x), Math.abs(o.scale.z));
    if (g.type === 'CylinderGeometry' && q.radialSegments <= 10 && q.heightSegments === 1 && q.thetaLength > 6.28) {
      const re = Math.max(q.radiusTop, q.radiusBottom) * k, n = q.radialSegments;
      const t = low ? (re >= .12 ? 10 : n) : re >= .12 ? 14 : re >= .045 ? 10 : re >= .02 ? 7 : n;
      if (t > n) o.geometry = G(`rc${q.radiusTop},${q.radiusBottom},${q.height},${t},${q.openEnded}`, () => new THREE.CylinderGeometry(q.radiusTop, q.radiusBottom, q.height, t, 1, !!q.openEnded));
    } else if (g.type === 'IcosahedronGeometry') {
      const re = q.radius * Math.max(k, Math.abs(o.scale.y));
      if (q.detail === 0 && re >= (low ? .05 : .03)) o.geometry = icoGeo(q.radius, 1);
      else if (q.detail === 1 && tier === 'high' && re >= .19) o.geometry = icoGeo(q.radius, 2);
    }
  });
  // joints: the shoulder cap in line with the upper arm, a hand a little flatter than a ball, feet shaped
  const isR = (o, rad) => o.isMesh && o.geometry.parameters?.radius === rad;
  for (const A of [r.armL, r.armR]) { const c = A.children.find((o) => isR(o, .085)); if (c && c.scale.x === 1) c.scale.set(.86, .84, .86); A.position.x *= .965; }
  for (const E of [r.elbowL, r.elbowR]) { const h = E?.children.find((o) => isR(o, .055) && o.position.y < -.25); if (h && h.scale.x === 1) h.scale.set(.86, 1.08, .78); }
  for (const K of [r.kneeL, r.kneeR]) for (const o of K.children) {
    if (!o.isMesh || o.geometry !== boxGeo() || o.position.y > -.28 || Math.abs(o.position.x) > .03 || o.scale.z < .16 || o.scale.y > .12) continue;
    o.geometry = footGeo(); o.scale.x *= .92; // (outlines come later and share it)
  }
  giveHands(r); // Roy 29.10 ("real fingers"): ?hands= puts a hand with fingers on the hand bone (js/hands.js)
  return r;
}

// ---------- characters ----------
// (o.skin, o.hair [main, dark, light], o.brow: BETA ONLINE's skin tones and hair colours, js/online/heroes.js; without
// them, exactly Val)
export function makeV(o = {}) {
  const SK = o.skin || '#f0cbb4'; // round 33 (Roy): paler, ~40% of the way to the Blender Val
  // round 33 (Roy): the Blender Val's face on her own head: open eyes with a sea-teal iris and a catchlight, a lash line
  // with a lifted wing (the smoky shadow kept light), slimmer arched brows in a deep teal, rose lips, a defined jaw and chin
  const r = humanoid({ skin: SK, top: '#1d1c26', bottom: '#2a1e18', legs: SK, boots: '#2e2019', eyes: '#2a5e9c', liner: '#1c1224', lips: '#9a4a62', brow: o.brow || '#1d6a80', browTilt: .1, vv: 1, browW: 1.1, jaw: 1 });
  const { torso, head, handR } = r;
  const war = [], home = [], W = (o) => { war.push(o); return o; }, H = (o) => { home.push(o); o.visible = false; return o; };
  if (PXART) pxWar(r, W); // ?art=px: the same war outfit as hand-placed pixel art
  else {
    // knee-high boots, as in the reference
    for (const K of [r.kneeL, r.kneeR]) W(tcyl(K, .1, .085, .2, '#2e2019', 0, .06, 0, 7));
    // teal hair: cap, a side-swept fringe, and two thick woven braids that come from behind the ears,
    // lie over the shoulders and rest on the chest, tied off with gold bands
    const [hairC, hairD, hairL] = o.hair || ['#33cbbd', '#1f9a90', '#5ee0d2'];
    const cap = ball(head, .215, hairC, 0, .29, -.05, 1); cap.scale.set(1.02, .8, 1.04);
    r.hair = [cap, ball(head, .17, hairC, 0, .2, -.1, 1)]; // hidden while a helmet is worn (the braids stay)
    const braids = r.braids = []; // lifted off the chest while body armour is worn (see equipGear)
    const fr = box(head, .2, .05, .05, hairC, -.04, .355, .14); fr.rotation.z = .24; r.hair.push(fr);
    const fr2 = box(head, .12, .05, .06, hairL, -.08, .37, .17, { noShadow: true }); fr2.rotation.z = .3; r.hair.push(fr2);
    for (const sx of [-1, 1]) {
      ball(head, .075, hairC, sx * .17, .14, -.06, 1).scale.set(.9, 1.2, 1);
      const P = [[.16, .8, -.04], [.205, .67, .03], [.19, .55, .155], [.172, .42, .158], [.162, .29, .148], [.152, .17, .146]];
      const N = 15;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1) * (P.length - 1), j = Math.min(P.length - 2, Math.floor(u)), f = u - j;
        const x = P[j][0] + (P[j + 1][0] - P[j][0]) * f, y = P[j][1] + (P[j + 1][1] - P[j][1]) * f, z = P[j][2] + (P[j + 1][2] - P[j][2]) * f;
        const rad = .056 - i * .0013, side = i % 2 ? 1 : -1;
        const b = ball(torso, rad, i % 2 ? hairD : hairC, sx * x + side * .012, y, z, 1); b.scale.set(1.05, 1.3, .78); b.rotation.z = side * .45;
        braids.push(b);
      }
      const tie = tcyl(torso, .04, .04, .035, '#e0b04a', sx * .152, .135, .146, 8); tie.rotation.x = .1;
      const tuft = cone(torso, .045, .1, hairC, sx * .152, .07, .144, 6); tuft.rotation.x = Math.PI;
      braids.push(tie, tuft);
    }
    // straps with silver skulls
    for (const sx of [-1, 1]) {
      W(box(torso, .07, .06, .3, '#4a3324', sx * .15, .58, 0));
      W(ball(torso, .035, '#d4d6dc', sx * .15, .6, .13, 0, { noShadow: true }));
    }
    // corset belt with skull + bat
    const belt = W(tcyl(torso, .2, .2, .15, '#4f3726', 0, .17, 0, 8)); belt.scale.z = .78;
    W(ball(torso, .04, '#e1e3e8', 0, .2, .16, 0, { noShadow: true }));
    W(box(torso, .18, .03, .02, '#b4b8c2', 0, .22, .162, { noShadow: true }));
    // pteruges skirt
    // (round 18: panels and strips on hinges, swung clear of her legs by fitFlaps, as in pxWar)
    const under = [];
    for (let i = 0; i < 12; i++) {
      const f = flapOn(r, torso, (i + .5) / 12 * Math.PI * 2, .2, -.03, .3, .32, .15); W(f.pv); under.push(f);
      mesh(f.pv, trapGeo(.8), '#1d1612', 0, 0, 0).scale.set(.155, .3, .02);
    }
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, f = flapOn(r, torso, a, .215, -.04, .3, .36, .07, under[Math.round(i * 1.2 - .5 + 12) % 12]); W(f.pv);
      box(f.pv, .07, .3, .03, i % 2 ? '#3a2a1e' : '#241a14', 0, -.15, 0);
      if (i % 2 === 0) ball(f.pv, .018, '#cdd0d6', 0, -.23, .02, 0, { noShadow: true });
    }
    W(tcyl(r.elbowR, .065, .065, .16, '#4f3726', 0, -.15, 0, 6)); // bracer
  }
  // home clothes (before the abduction): a long cream chiton with a sea-blue key border, a rope belt, a saffron himation
  const CR = '#efe4cc', SEA = '#2f7f9a', SAF = '#d89a3a';
  const bod = H(tcyl(torso, .262, .2, .52, CR, 0, .34, 0, 10)); bod.scale.z = .76;
  H(tcyl(torso, .215, .215, .06, '#b8945a', 0, .16, 0, 10)).scale.z = .8;
  r.dress = H(homeSkirt(r, CR, SEA, '#f4ead4')); // the skirt is cloth her legs push (see fitDress), not a bell they pass through
  W(torso.children[0]); // the rig's dark waist block would show under the dress when she leans in
  const him = H(box(torso, .5, .09, .2, SAF, .02, .5, .02)); him.rotation.z = -.62;
  // (round 33, Roy 27.10: the saffron himation strip that fell down her back is gone: it read as a yellow rectangle on her back)
  for (const E of [r.armL, r.armR]) H(tcyl(E, .11, .1, .16, CR, 0, -.06, 0, 7));
  H(ball(torso, .03, '#e0b04a', .17, .58, .11, 0, { noShadow: true })); // brooch
  r.sword = sword(handR);
  // round shield, sun-moon emblem
  const sh = new THREE.Group(); r.elbowL.add(sh); sh.position.set(-.1, -.12, .04);
  const disc = cyl(sh, .34, .05, '#262832', 0, 0, 0, 12); disc.rotation.z = Math.PI / 2;
  const rim = cyl(sh, .36, .035, '#8a909c', .012, 0, 0, 12); rim.rotation.z = Math.PI / 2;
  const sun = cyl(sh, .12, .06, '#c2c7d0', -.03, 0, 0, 8); sun.rotation.z = Math.PI / 2; sun.userData.boss = true; // (boss: a slung weapon lies across it, see seatWeapon)
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2; const sp = cone(sh, .035, .11, '#c9ced6', -.035, Math.sin(a) * .19, Math.cos(a) * .19, 4, { noShadow: true });
    sp.rotation.x = Math.PI / 2 - a; sp.rotation.order = 'YXZ'; sp.userData.boss = true;
  }
  ball(sh, .05, '#262832', -.06, .02, .03, 0, { noShadow: true }).userData.boss = true;
  if (PXART) pxShield(disc, rim, sun);
  r.shield = sh;
  r.warParts = war; r.homeParts = home;
  // gear sockets: helmSocket = skull centre (see GEAR_DIMS), neckSocket = pendant spot on the upper chest (+z outward)
  r.helmSocket = pivot(head, 0, .19, 0); r.neckSocket = pivot(torso, 0, .5, .175);
  r.isV = true; // her own bearing at rest and while she talks (poiseV)
  refineV(r); // round 33 (Roy, approved): slimmer, rounder body with finishes and physical braids
  giveHands(r, { fem: true, fighter: true }); // Roy 29.10: ?hands= (js/hands.js)
  finish(r);
  return r;
}
// ---------- round 33 (Roy): braids down her back that move by physics ----------
// Two woven braids hang from behind her ears down her back. Each is a rope of points simulated in world space and
// nothing else moves them: gravity, inertia, air drag (wind from her own speed, so it grows with the square of it),
// fixed link lengths, a little bending stiffness, and her skull and back as solid bodies they bounce off. So: standing,
// they hang still on her back; walking, each step's rise and fall gives them a small lift and tap on her back; running,
// they slap her back and jump more; riding or flying, the rush of air streams them out behind her.
// (round 33 stage 2: the physics itself is now the shared rope module, js/rope.js, with these braids' numbers as its defaults)
const BR_N = ROPE.n, BR_L = ROPE.link;
const _vbV = new THREE.Vector3(), _vbW = new THREE.Vector3(), _vbQ = new THREE.Quaternion(), _vbQ2 = new THREE.Quaternion(), _vbU = new THREE.Vector3(0, 1, 0);
const _vbN = new THREE.Vector3(), _vbR = new THREE.Vector3(), _vbM = new THREE.Matrix4();
function vBraids(r) {
  const hide = (o) => Object.defineProperty(o, 'visible', { get: () => false, set: () => {}, configurable: true });
  for (const b of r.braids || []) hide(b);
  r.braids = []; // (the old chest braids: gear and scenes that nudge r.braids now leave them be)
  const mats = PXART ? [paMat('braidC'), paMat('braidD')] : [mat('#33cbbd'), mat('#1f9a90')];
  const gold = PXART ? [paMat('gband'), mat(PAL.gold[2]), mat(PAL.gold[2])] : mat('#d8a040');
  const body = { c0: new THREE.Vector3(), hr: .17, floor: 0, rs: 1 }; // this frame's solid bodies (simBraids fills it)
  // solid bodies: the skull, and her back (with the skirt below it) as an elliptic section in torso space, wider over the
  // skirt (it flares in smoothly: no step to pop a braid out), rounding off over the shoulders
  const sec = (y) => { const top = y > .5 ? Math.sqrt(Math.max(0, 1 - ((y - .5) / .16) ** 2)) : 1, sk = Math.min(1, Math.max(0, (.04 - y) / .14)); return top > 0 && [(.26 + .04 * sk) * top, (.19 + .05 * sk) * top]; };
  const collide = (p, q, rr) => {
    let hit = null;
    const h1 = hitSphere(p, body.c0, body.hr + rr); if (h1) hit = _vbN.copy(h1);
    const h2 = hitSection(p, r.torso, -.34, .66, sec, rr / body.rs); if (h2) hit = _vbN.copy(h2);
    if (body.wings) { // worn wings: part of her back (round 33). They set the braid where it lies without throwing it: q moves along
      _vbW.copy(p); const h3 = wingPush(body.wings, p, rr); if (h3) { hit = _vbN.copy(h3); q.add(_vbW.subVectors(p, _vbW)); }
    }
    if (body.cape) { _vbW.copy(p); const h4 = capePush(body.cape, p, rr); if (h4) { hit = _vbN.copy(h4); q.add(_vbW.subVectors(p, _vbW)); } } // v31b: a cape, the same way
    if (p.y < body.floor) { p.y = body.floor; q.y = Math.max(q.y, body.floor); }
    return hit;
  };
  r.vbr = [-1, 1].map((sx) => {
    const lobes = [], bands = [], off = [];
    for (let i = 0; i < BR_N - 1; i++) {
      const rad = .062 - i * .0018, m = mesh(r.root, icoGeo(1, 1), null, 0, 0, 0, { material: mats[i % 2] });
      m.userData.r = rad; m.userData.side = i % 2 ? 1 : -1; lobes.push(m);
      if (i === 3 || i === 7) bands.push([i, mesh(r.root, cylGeo(1, 1, 1, 12), null, 0, 0, 0, { material: gold, noShadow: true })]);
    }
    const tie = mesh(r.root, cylGeo(1, 1, 1, 12), null, 0, 0, 0, { material: gold, noShadow: true });
    const tuft = mesh(r.root, coneGeo(1, 1, 6), null, 0, 0, 0, { material: PXART ? [paMat('tuft'), mat(PAL.hair[2]), mat(PAL.hair[2])] : mat('#1f9a90') });
    const rope = makeRope({ // from the nape, on her body (a turn of the head does not swing them), down her back just clear of it
      scale: () => body.rs, radius: (i) => lobes[Math.min(i - 1, lobes.length - 1)].userData.r, collide,
      anchor: (out) => r.torso.localToWorld(out.set(sx * .11, .76, -.17)),
      rest: (i, out) => { // (with wings on, the resting line is laid on them too: at rest, and carried through a roll, they lie on the
        // wings; as they fold or open it eases across to its new place over a few frames instead of snapping there)
        out.set(sx * (.11 + i * .004), .76 - i * BR_L * .97, i < 3 ? -.17 - i * .03 : -.27);
        if (body.wings || body.cape || off[i]) {
          const o = off[i] ||= new THREE.Vector3(), inv = _vbM.copy(r.torso.matrixWorld).invert();
          _vbR.copy(out); r.torso.localToWorld(_vbR);
          if (body.wings) wingRest(body.wings, _vbR, lobes[Math.min(i - 1, lobes.length - 1)].userData.r * body.rs);
          if (body.cape) capeRest(body.cape, _vbR, lobes[Math.min(i - 1, lobes.length - 1)].userData.r * body.rs);
          _vbR.applyMatrix4(inv).sub(out); o.lerp(_vbR, 1 - Math.exp(-(body.dt || .016) * 14)); out.add(o);
          if (!body.wings && !body.cape && o.lengthSq() < 1e-8) off[i] = null; // (wings off: back to her own line)
        }
        return r.torso.localToWorld(out);
      },
      hang: (out) => out.set(0, -1, -.3).normalize().applyQuaternion(r.torso.getWorldQuaternion(_vbQ)), // (only to lay them out on the first frame)
    });
    return { sx, lobes, bands, tie, tuft, rope, get p() { return rope.p; }, get r() { return rope.r; } };
  });
  r.vbody = body;
}
function simBraids(r, dt, st = {}) {
  r.root.updateMatrixWorld(true);
  const body = r.vbody; body.rs = r.root.getWorldScale(_vbW).y;
  r.head.localToWorld(body.c0.set(0, .19, 0)); body.hr = .17 * body.rs; // the skull (its back, where the braids leave it)
  body.floor = r.root.getWorldPosition(_vbW).y + .03;
  body.wings = wingBodies(r); body.cape = capeBodies(r); body.dt = dt; // (null without wings / a cape, or with them off: nothing changes)
  for (const B of r.vbr) {
    B.rope.relHit = !!(body.wings || body.cape); // (wings beat and fly, a cape swings: a braid comes off them, and her back, as they move)
    stepRope(B.rope, dt, st);
    // dress the chain: a woven lobe on every link, gold bands, the tie and the tuft at the end
    r.root.getWorldQuaternion(_vbQ2).invert();
    const P = B.rope.p;
    const put = (m, p0, p1, sx, sy, sz) => {
      _vbV.subVectors(p1, p0).normalize(); _vbQ.setFromUnitVectors(_vbU, _vbV);
      m.position.copy(r.root.worldToLocal(_vbW.copy(p0).add(p1).multiplyScalar(.5)));
      m.quaternion.copy(_vbQ2).multiply(_vbQ); m.scale.set(sx, sy, sz);
    };
    B.lobes.forEach((m, i) => { const k = m.userData.r; put(m, P[i], P[i + 1], k * 1.12, k * 1.32, k * .86); m.rotateZ(m.userData.side * .42); });
    for (const [i, m] of B.bands) { const k = B.lobes[i].userData.r + .007; put(m, P[i + 1], P[i + 1].clone().addScaledVector(_vbN.subVectors(P[i + 1], P[i]).normalize(), .001), k * 1.05, .026, k * .9); }
    const e = P[BR_N - 1], dir = _vbN.subVectors(e, P[BR_N - 2]).normalize().clone();
    put(B.tie, e, e.clone().addScaledVector(dir, .03), .04, .034, .04);
    put(B.tuft, e.clone().addScaledVector(dir, .025), e.clone().addScaledVector(dir, .13), .052, .105, .052);
  }
}
// ---------- round 33 (Roy): "the wings, once worn, are part of her body, part of her back: her braids lie on them" ----------
// The wings' harness and each wing (out to WB_X along it, in its own shape space) are solid bodies for her braids, like her
// back. Each wing is measured once from its own meshes, in strips along it: how low and how high it reaches there and where
// its two faces lie (shape space, see wingRig: x out along the wing, z up, +y its back face). A braid is held off the back
// face, always: spread in flight, swept back in a run's glide, and folded back along her (riding, sitting, rolling), when
// the two back faces turn in towards each other and the braids lie between the folded wings, on top of them as one sees
// her from behind. The edges are rounded, so a braid drapes over a wing's edge instead of catching on it, and the wing is
// deepened on her body's side so a braid caught under it near her back comes out on its face. The harness holds them off
// behind it. Near her nape (where the braids leave her head, in front of any wing) it all fades out. A wing sets a braid
// where it lies without throwing it (and slides one caught deep out over a few frames). wingBodies() gives this frame's
// bodies, or null without wings (or with them off, in her home clothes): then nothing at all changes.
const WB_X = 1.2, WB_ROOT = -.12, WB_NB = 24, WB_D = .14, WB_STEP = .006; // the length of wing they lie on (and in past its root to her spine), strips, depth held, the furthest a wing moves a point at a time (m)
const WB_Y0 = .62, WB_Y1 = .72; // (torso heights: the braids leave her nape at .76; they take to the wings below ~.67)
const _wbP = new THREE.Vector3(), _wbM = new THREE.Matrix4();
function wingShape(r, model) { // measured once per piece worn
  r.root.updateMatrixWorld(true);
  const wings = r.wings.map((w) => {
    const f = w.children[0]?.children[0] || w, inv = _wbM.copy(f.matrixWorld).invert(), bw = WB_X / WB_NB;
    const lo = new Array(WB_NB).fill(Infinity), hi = new Array(WB_NB).fill(-Infinity), ylo = lo.slice(), yhi = hi.slice(), m = new THREE.Matrix4();
    const add = (v) => { const k = Math.floor(v.x / bw); if (k < 0 || k >= WB_NB) return; lo[k] = Math.min(lo[k], v.z); hi[k] = Math.max(hi[k], v.z); ylo[k] = Math.min(ylo[k], v.y); yhi[k] = Math.max(yhi[k], v.y); };
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    f.traverse((o) => { // every triangle, sampled finely enough for the strips (a membrane is a few big ones)
      const g = o.isMesh && !o.userData.outline && o.geometry, a = g?.attributes?.position; if (!a) return;
      m.multiplyMatrices(inv, o.matrixWorld);
      const ix = g.index, nt = (ix ? ix.count : a.count) / 3, at = (t) => (ix ? ix.getX(t) : t);
      for (let t = 0; t < nt; t++) {
        A.fromBufferAttribute(a, at(3 * t)).applyMatrix4(m); B.fromBufferAttribute(a, at(3 * t + 1)).applyMatrix4(m); C.fromBufferAttribute(a, at(3 * t + 2)).applyMatrix4(m);
        if (Math.max(A.x, B.x, C.x) < 0 || Math.min(A.x, B.x, C.x) >= WB_X) continue;
        const n = Math.max(1, Math.min(40, Math.ceil(Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)) / (bw * .5))));
        for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) add(_wbP.copy(A).multiplyScalar(1 - (i + j) / n).addScaledVector(B, i / n).addScaledVector(C, j / n));
      }
    });
    return { f, lo, hi, ylo, yhi, inv: new THREE.Matrix4(), sc: 1 };
  });
  let mount = null; const M0 = r.wingMount;
  if (M0) { // the harness: its own meshes (not the wings'), as a box in its space
    const inv = _wbM.copy(M0.matrixWorld).invert(), b = new THREE.Box3(), m = new THREE.Matrix4();
    const walk = (o) => { if (o.userData.wing) return; const a = o.isMesh && !o.userData.outline && o.geometry?.attributes?.position;
      if (a) { m.multiplyMatrices(inv, o.matrixWorld); for (let i = 0; i < a.count; i++) b.expandByPoint(_wbP.fromBufferAttribute(a, i).applyMatrix4(m)); }
      for (const c of o.children) walk(c); };
    walk(M0);
    if (!b.isEmpty()) mount = { o: M0, b, inv: new THREE.Matrix4(), sc: 1 };
  }
  return { model, wings, mount, tinv: new THREE.Matrix4(), s: {} };
}
function wingBodies(r) {
  const model = r.gear?.back;
  if (!r.wings?.length || !model || r.backSock?.visible === false || r.unarmed) return null;
  const W = r._wbod?.model === model ? r._wbod : (r._wbod = wingShape(r, model));
  for (const E of W.wings) { E.inv.copy(E.f.matrixWorld).invert(); E.sc = E.f.matrixWorld.getMaxScaleOnAxis() || 1; }
  const Mn = W.mount; if (Mn) { Mn.inv.copy(Mn.o.matrixWorld).invert(); Mn.sc = Mn.o.matrixWorld.getMaxScaleOnAxis() || 1; }
  W.tinv.copy(r.torso.matrixWorld).invert();
  return W;
}
const _wbLo = new THREE.Vector3(), _wbHi = new THREE.Vector3(), _wbQ0 = new THREE.Vector3(), _wbN2 = new THREE.Vector3(), _wbT = new THREE.Vector3();
const wbSS = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const wbNape = (W, p) => wbSS((WB_Y1 - _wbT.copy(p).applyMatrix4(W.tinv).y) / (WB_Y1 - WB_Y0)); // 0 at her nape, 1 below it
function wbStrip(W, E, x) { // the wing where it is x along: its low and high edge and its front and back faces (W.s), or null
  const u = clamp(x / (WB_X / WB_NB) - .5, 0, WB_NB - 1), k0 = Math.floor(u), k1 = Math.min(WB_NB - 1, k0 + 1), a = u - k0;
  const at = (A) => { const v0 = isFinite(A[k0]) ? A[k0] : A[k1], v1 = isFinite(A[k1]) ? A[k1] : A[k0]; return v0 + (v1 - v0) * a; };
  const S = W.s; S.zl = at(E.lo); S.zh = at(E.hi); S.yl = at(E.ylo); S.yh = at(E.yhi);
  return isFinite(S.zl) && isFinite(S.zh) ? S : null;
}
// the same bodies for a braid's resting line, eased: a resting spot is lifted onto the back face as smoothly as the wing
// moves (fading in over a radius at every edge), so the line a braid is held to never jumps as the wings beat and fold
function wingRest(W, p, rr) {
  const nape = wbNape(W, p); if (nape <= 0) return;
  const Mn = W.mount, ss = wbSS;
  if (Mn) {
    const b = Mn.b, q = _wbP.copy(p).applyMatrix4(Mn.inv), rm = rr / Mn.sc, to = b.min.z - rm;
    const k = nape * ss((q.x - b.min.x + rm) / (2 * rm)) * ss((b.max.x + rm - q.x) / (2 * rm)) * ss((q.y - b.min.y + rm) / (2 * rm)) * ss((b.max.y + rm - q.y) / (2 * rm)) * ss((b.max.z + WB_D - q.z) / (2 * rm));
    if (k > 0 && q.z > to) { q.z += (to - q.z) * k; p.copy(q.applyMatrix4(Mn.o.matrixWorld)); }
  }
  for (const E of W.wings) {
    const q = _wbP.copy(p).applyMatrix4(E.inv), rf = rr / E.sc;
    if (q.x > WB_X) continue;
    const S = wbStrip(W, E, q.x); if (!S) continue;
    const to = S.yh + rf; if (q.y >= to) continue;
    const k = nape * ss((q.x - WB_ROOT + rf) / (2 * rf)) * ss((WB_X - q.x) / (2 * rf)) * ss((q.z - S.zl + rf) / (2 * rf)) * ss((S.zh + rf - q.z) / (2 * rf)) * ss((q.y - S.yl + WB_D + rf) / (2 * rf));
    if (k <= 0) continue;
    q.y += (to - q.y) * k; p.copy(q.applyMatrix4(E.f.matrixWorld));
  }
}
// hold a braid's point p (radius rr, world) off the wings and their harness; the normal it was pushed along, or null.
// Each wing, where p is along it, is a box in its shape space: across, from her spine (past the wing's root, where the
// harness is) outwards; its height there; its thickness, deepened by WB_D on her body's side. A point inside goes out its
// back face, its front (only from deep under it) or its low edge; never up through its top (a point on the top edge is
// held up by the rounded edge). The harness is a box deepened into her back the same way, left only behind it.
function wingPush(W, p, rr) {
  const nape = wbNape(W, p); if (nape <= 0) return null;
  let hit = null; const Mn = W.mount;
  const out = (q, h, mw, sc) => { // (moved at most WB_STEP at a time, and only as far as the nape lets it)
    const mv = q.distanceTo(_wbQ0), cap = WB_STEP / sc; let k = nape; if (mv * k > cap) k = cap / mv;
    if (k < 1) q.lerpVectors(_wbQ0, q, k);
    p.copy(q.applyMatrix4(mw)); hit = _wbN2.copy(h).transformDirection(mw);
  };
  if (Mn) {
    const b = Mn.b, q = _wbP.copy(p).applyMatrix4(Mn.inv); _wbQ0.copy(q);
    const h = hitBox(q, _wbLo.copy(b.min), _wbHi.copy(b.max).setZ(b.max.z + WB_D), rr / Mn.sc, 16);
    if (h) out(q, h, Mn.o.matrixWorld, Mn.sc);
  }
  for (const E of W.wings) {
    const q = _wbP.copy(p).applyMatrix4(E.inv), rf = rr / E.sc;
    if (q.x > WB_X) continue;
    const S = wbStrip(W, E, q.x); if (!S) continue;
    _wbQ0.copy(q);
    const h = hitBox(q, _wbLo.set(WB_ROOT, S.yl - WB_D, S.zl), _wbHi.set(WB_X + 1, S.yh, S.zh), rf, 4 | 8 | 16);
    if (h) out(q, h, E.f.matrixWorld, E.sc);
  }
  return hit;
}
// ---------- round 33 stage 2: hanging chains on any humanoid (hair, ponytails, capes, cloth falls) ----------
// hangChain(r, pivots, o): a chain of hinged pivots (pivots[j + 1] a child of pivots[j], at its end; the last one's end
// at o.end in its own frame) moved by a rope (js/rope.js). The rope hangs from pivots[0]'s hinge; its resting line is the
// chain as it was built, held in o.frame's space (the torso: hair lies down the back whichever way the head turns; the
// hinge itself: a cape follows its hinge, which fitFlaps swings clear of the legs). Solid bodies: the skull and the back.
// o: { frame, end, k, damp, drag, link radius rad, lo, hi, side (bend limits, see bendChain), first ('max' for a hinge
// something else swings), still }. animateRig steps every chain after the pose; a chain sleeps while its rig stands still.
const _hcV = new THREE.Vector3(), _hcW = new THREE.Vector3();
export function hangChain(r, pivots, o = {}) {
  if (!pivots?.length || !r?.torso) return null;
  r.root.updateMatrixWorld(true);
  const F = o.frame || r.torso, inv = new THREE.Matrix4().copy(F.matrixWorld).invert();
  const pts = pivots.map((p) => p.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv));
  pts.push(pivots[pivots.length - 1].localToWorld(new THREE.Vector3(...(o.end || [0, -.2, 0]))).applyMatrix4(inv));
  const rs0 = r.root.getWorldScale(_hcW).y || 1, links = pts.slice(1).map((p, i) => p.distanceTo(pts[i]) / rs0);
  const link = links.reduce((a, b) => a + b, 0) / links.length;
  const body = r._rbody ||= { c0: new THREE.Vector3(), hr: .2, floor: 0, rs: 1 };
  const sec = (y) => { // the back (and a robe's flare below the waist) as an elliptic section, rounding off over the shoulders
    const top = y > .56 ? Math.sqrt(Math.max(0, 1 - ((y - .56) / .16) ** 2)) : 1; if (top <= 0) return false;
    const c = y > .09 ? .18 + .07 * Math.min(1, (y - .09) / .5) : .21 + Math.min(.12, (.09 - y) * .2);
    return [(c + .03) * top, (c * .74 + .045) * top];
  };
  const sk = o.sec ?? .9; // (the section a little inside the back: the chain lies on it at rest, and only a swing in pushes off it)
  const R = makeRope({
    n: pts.length, link, k: o.k ?? 260, damp: o.damp ?? 16, bounce: o.bounce ?? .05, fold: o.fold ?? 1.5, still: o.still ?? .05,
    drag: o.drag || ((v) => (o.air ?? .06) + .12 * Math.min(1, Math.max(0, (v - 11) / 5))), reach: o.reach || ((i) => .08 + i * .12),
    scale: () => body.rs, radius: () => o.rad ?? .04, initRest: true, sub: o.sub ?? ((o.k ?? 260) < 300 ? .011 : .006),
    anchor: (out) => pivots[0].getWorldPosition(out),
    rest: (i, out) => F.localToWorld(out.copy(pts[i])),
    collide: (p, q, rr) => {
      let hit = null;
      const h1 = hitSphere(p, body.c0, body.hr + rr); if (h1) hit = _hcV.copy(h1);
      const h2 = sk && hitSection(p, r.torso, -.5, .72, (y) => { const q = sec(y); return q && [q[0] * sk, q[1] * sk]; }, rr / body.rs); if (h2) hit = _hcV.copy(h2);
      if (p.y < body.floor) { p.y = body.floor; q.y = Math.max(q.y, body.floor); }
      return hit;
    },
  });
  const H = { R, pivots, o: { lo: o.lo ?? -.4, hi: o.hi ?? 1.5, side: o.side ?? .5, first: o.first }, la: new THREE.Vector3(1e9, 0, 0), lr: new THREE.Vector3(), sleep: 0, after: o.after, wake: !!o.wake, r };
  // (o.after(H, dt): puts the chain's meshes on the rope itself instead of bending pivots; o.wake: never sleeps, for a cape that ripples on its own)
  (r.ropes ||= []).push(H); (r.ropePivots ||= []).push(...pivots); // (ropePivots: bake leaves them, and what hangs on them, unmerged across joints)
  return H;
}
function simRopes(r, dt, st) {
  if (!r.root.visible) return; // (culled: it hangs as it was)
  let on = false; for (const H of r.ropes) if (H.pivots[0].parent && visibleUp(H.pivots[0], r.root)) { on = true; break; }
  if (!on) return;
  r.root.updateMatrixWorld(true);
  const body = r._rbody; body.rs = r.root.getWorldScale(_hcW).y || 1;
  r.head.localToWorld(body.c0.set(0, .19, 0)); body.hr = .2 * body.rs * (r.head.scale.y || 1);
  body.floor = r.root.getWorldPosition(_hcW).y + .03;
  const rolling = (st.roll !== undefined && st.roll >= 0) || st.dead === true;
  for (const H of r.ropes) {
    if (!H.pivots[0].parent || !visibleUp(H.pivots[0], r.root)) continue;
    const a = H.R.anchor(_hcV), e = H.R.rest(H.R.n - 1, _hcW);
    if (!rolling && !H.wake && H.sleep > 20 && a.distanceToSquared(H.la) < 1e-4 && e.distanceToSquared(H.lr) < 1e-4 && dt > 0) continue; // asleep: nothing moved it a centimetre (an idle sway carries it, hinged on the body)
    H.la.copy(a); H.lr.copy(e);
    stepRope(H.R, dt, st); if (H.after) H.after(H, dt); else bendChain(H.pivots, H.R, H.o);
    H.sleep = H.R.still ? H.sleep + 1 : 0;
  }
}
const visibleUp = (o, top) => { for (; o && o !== top; o = o.parent) if (!o.visible) return false; return true; };
// ---------- round 33 (Roy): V a little less square ----------
// About 10% narrower through the body (shoulders, chest, hips), rounder limbs and joints (more sides on every low
// cylinder, smooth balls), and a few finishing touches on the war dress: a gold neckline, crossed lacing down the bodice,
// studs round the belt and on the strips, a crimson hem on the underskirt. Lookups by geometry parameters still match.
function refineV(r) {
  const NX = .9, T = r.torso;
  for (const o of [...T.children]) {
    if (o === r.head || o === r.armL || o === r.armR) continue;
    o.position.x *= NX;
    if (o.isMesh && Math.abs(o.position.x) < .02) o.scale.x *= NX; // the centred shells: chest, waist, belt, buckle
  }
  r.armL.position.x *= .92; r.armR.position.x *= .92; r.legL.position.x *= .9; r.legR.position.x *= .9;
  // slimmer legs and boots (the knee-high boots and feet read as blocks from above)
  for (const L of [r.legL, r.legR]) for (const o of L.children) if (o.isMesh) { o.scale.x *= .9; o.scale.z *= .92; }
  for (const K of [r.kneeL, r.kneeR]) for (const o of K.children) if (o.isMesh) { o.scale.x *= .86; o.scale.z *= .92; }
  r.root.traverse((o) => {
    if (!o.isMesh || o.userData.fx) return;
    const g = o.geometry, q = g.parameters || {};
    if (g.type === 'CylinderGeometry' && q.radialSegments <= 10) o.geometry = G(`rv${q.radiusTop},${q.radiusBottom},${q.height},${q.radialSegments},${q.openEnded}`, () => new THREE.CylinderGeometry(q.radiusTop, q.radiusBottom, q.height, Math.max(14, Math.round(q.radialSegments * 1.6)), 1, !!q.openEnded));
    else if (g.type === 'IcosahedronGeometry' && q.detail === 0) o.geometry = icoGeo(q.radius, 1);
  });
  vBraids(r);
  const GOLD = '#d8a040', war = r.warParts || [], under = (r.underArmour ||= []);
  const add = (m, hide) => { war.push(m); if (hide) under.push(m); return m; };
  // gold neckline round the top of the bodice
  const neck = add(mesh(T, G('rvneck', () => new THREE.CylinderGeometry(.254, .253, .024, 18, 1, true)), null, 0, .582, 0, { material: PXART ? paMat('gband') : mat(GOLD) }), true); // an open band, no cap
  neck.scale.set(NX, 1, .74);
  // crossed lacing down the front of the bodice (front of the chest shell: radius .18 at y .09 to .25 at y .59, depth x .72)
  for (const y of [.27, .33, .39, .45]) {
    const z = (.18 + .07 * (y - .09) / .5) * .72 + .006;
    for (const sg of [-1, 1]) { const l = add(box(T, .052, .009, .008, GOLD, 0, y, z, { noShadow: true }), true); l.rotation.z = sg * .62; }
  }
  // steel studs round the belt
  for (let i = 0; i < 10; i++) { const a = (i + .5) / 10 * Math.PI * 2; if (Math.abs(Math.sin(a)) < .25 && Math.cos(a) > 0) continue; add(ball(T, .013, '#d4d6dc', Math.sin(a) * .2 * NX, .17, Math.cos(a) * .2 * .78, 0, { noShadow: true })); }
  // the skirt: a stud at the foot of every leather strip, a crimson hem on every underskirt panel
  for (const f of r.flaps || []) {
    if (f.hw < .05) ball(f.pv, .015, '#cdd0d6', 0, -.27, .02, 0, { noShadow: true });
    else box(f.pv, .15, .02, .026, '#8a2238', 0, -.292, 0, { noShadow: true });
  }
}
// ---------- pixel-art V (?art=px prototype) ----------
// Her war outfit painted as pixel art: every part wears a small canvas texture laid out texel by texel from a 4-6 shade
// palette per material (shadows cooler and purpler, light warmer, white glints on metal), about one texel per game pixel
// in a look=f close-up; a few small pieces carry the silhouette (pauldrons, knee guards, buckle, bracer straps, boot
// cuffs, gold braid bands). Same rig, proportions and part lists (r.hair, r.braids, war parts) as the plain V.
// V's own cloth and leather, a step or two blacker than the shared PAL ones (Roy: "a little blacker"); piping, steel and gold stay bright
const VP = {
  navy: ['#07060c', '#0e0d1b', '#161629', '#20223d', '#30375b', '#4d5888'],
  lea: ['#100810', '#1d1114', '#2d1c18', '#432c21', '#62452c', '#8a6640'],
  dlea: ['#0c070b', '#170e11', '#231715', '#34241c', '#4d3525', '#6e5133'],
  boot: ['#0e080c', '#1a1012', '#281a18', '#3b2920', '#563d2b', '#7d5d3c'],
};
const paMat = (key) => paOnce('m' + key, () => new THREE.MeshToonMaterial({ map: paTex(key, ...PXT[key]), gradientMap: toonRamp() }));
const strip = (Q, studded) => [11, 45, (c) => { // a pteruges strip: stitched border, a lit fold, a rivet at the top, a rounded tip (a steel boss on every other)
  const { R, P, W, H } = c, T = PAL.steel;
  R(0, 0, W, H, Q[2]); R(0, 0, 1, H, Q[0]); R(W - 1, 0, 1, H, Q[0]); R(1, 0, 1, H, Q[3]); R(W - 2, 0, 1, H, Q[1]); R(0, 0, W, 1, Q[1]);
  for (let j = 4; j < H - 5; j += 2) { P(2, j, Q[4]); P(W - 3, j, Q[4]); }
  R(4, 7, 1, H - 17, Q[3]); R(5, 10, 1, H - 24, Q[4]); R(7, 12, 1, H - 26, Q[1]); rivet(c, 5, 1, T);
  R(0, H - 4, W, 4, Q[0]); R(1, H - 4, W - 2, 1, Q[2]); R(2, H - 3, W - 4, 1, Q[1]); R(3, H - 2, W - 6, 1, Q[1]); for (let i = 2; i < W - 2; i += 2) P(i, H - 5, Q[4]);
  if (studded) stud(c, 5, H - 9, T, Q[0]);
}];
const footSide = (toeLeft) => [36, 14, (c) => { // sole and welt, a toe cap with a glint, the heel block
  const { R, W, H } = c, B = VP.boot, X = (i) => toeLeft ? i : W - 1 - i, Q = (i, j, col) => c.P(X(i), j, col), Rx = (i, j, w, h, col) => { for (let k = 0; k < w; k++) R(X(i + k), j, 1, h, col); };
  R(0, 0, W, H, B[2]); R(0, 0, W, 1, B[3]); Rx(0, 1, 11, 9, B[3]); Rx(0, 1, 9, 1, B[4]); Rx(11, 1, 1, 10, B[1]); Q(1, 2, B[5]); Q(2, 2, B[5]); Q(1, 3, B[4]); Q(3, 2, B[4]); Q(0, 2, B[4]);
  for (let i = 13; i < 20; i++) Q(i, 2 + ((i - 13) >> 1), B[1]); for (let i = 14; i < 21; i++) Q(i, 1 + ((i - 14) >> 1), B[3]);
  Rx(27, 7, 9, 4, B[1]); Rx(26, 7, 1, 4, B[0]); Rx(27, 7, 9, 1, B[0]);
  R(0, 10, W, 1, B[1]); for (let i = 1; i < W; i += 2) Q(i, 10, B[4]); R(0, 11, W, 3, B[0]); R(0, 11, W, 1, B[1]);
}];
const braid = (b) => [36, 18, (c) => { // one woven lobe: a lit crown with glints, strands across, a dark crease under (lobes alternate tilt: a herringbone)
  const { R, P, W } = c, Hc = PAL.hair;
  R(0, 0, W, 6, Hc[b + 1]); R(0, 6, W, 5, Hc[b]); R(0, 11, W, 3, Hc[b - 1]); R(0, 14, W, 4, Hc[b - 2]);
  for (let x = 0; x < W; x += 9) { P(x, 3, Hc[b + 2]); P(x + 1, 3, Hc[b + 2]); P(x + 1, 4, Hc[b + 2]); P(x + 2, 4, Hc[b + 1]); for (let t = 0; t < 7; t++) P(x + 4 + t, 5 + t, t < 3 ? Hc[b] : Hc[b - 1]); }
}];
const PXT = {
  chest: [176, 76, (c) => { // laced bodice: V-neck with plum piping, a laced placket, princess seams over a shaded bust, side seams
    const { R, P, S, W, H, F } = c, N = VP.navy, PL = PAL.plum, K = PAL.skin, L = VP.lea, G = PAL.gold;
    const B = (i, j, col) => { P(i, j, col); P(-1 - i, j, col); };
    R(0, 0, W, H, N[2]); R(0, 45, W, 6, N[1]); R(0, 51, W, H - 51, N[0]);
    for (let i = 8; i <= 24; i++) { const d = (i - 16) / 8.6, a = Math.sqrt(Math.max(0, 1 - d * d)), t = Math.round(21 - 7 * a), u = Math.round(21 + 5 * a);
      S(i, t, a > .75 ? N[4] : N[3]); S(i, t + 1, N[3]); if (a > .9) S(i, t + 2, N[3]); if (a > .45) S(i, u, N[1]); }
    for (let j = 1; j < H; j++) { const o = Math.round(15 + 12 * Math.pow(1 - j / H, 1.5)); S(o, j, N[0]); S(o - 1, j, N[3]); B(o + 3, j, N[0]); B(o + 2, j, N[3]); }
    for (const x of [W >> 2, 3 * W >> 2]) { R(x, 0, 1, H, N[0]); R(x + 1, 0, 1, H, N[3]); }
    for (let i = 6; i < 18; i++) for (let j = 6; j < 14 - Math.abs(i - 12) / 2; j++) B(i, j, N[3]); // shoulder blades
    R(0, 0, W, 1, PL[2]); R(0, 1, W, 1, PL[1]);
    for (let j = 0; j < 13; j++) { const hw = Math.round(10 * (1 - j / 16)); for (let i = 0; i < hw; i++) S(i, j, i === hw - 1 ? K[1] : K[2]); S(hw, j, PL[3]); S(hw + 1, j, PL[2]); S(hw + 2, j, PL[1]); }
    for (let j = 13; j < 52; j++) { for (let i = 0; i < 3; i++) S(i, j, N[0]); S(3, j, PL[3]); S(4, j, PL[2]); S(5, j, PL[1]); }
    for (let y = 14; y < 47; y += 6) { for (let t = 0; t < 6; t++) { P(F - 3 + t, y + t, t === 2 || t === 3 ? L[5] : L[4]); P(F + 2 - t, y + t, L[3]); } S(3, y, G[3]); P(F - 4, y, G[4]); }
  }],
  chestCap: [64, 64, (c) => { // the shoulders seen from above: the collar piping runs round the edge
    const { P } = c, N = VP.navy, PL = PAL.plum;
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const r = Math.hypot(i - 31.5, j - 31.5); P(i, j, r > 30.5 ? PL[1] : r > 28.5 ? PL[2] : r > 27.5 ? N[3] : N[2]); }
  }],
  waist: [200, 30, (c) => { // the tunic's gathered skirt under the belt, its hem piped in plum
    const { R, W, H } = c, N = VP.navy, PL = PAL.plum;
    R(0, 0, W, H, N[2]); for (let x = 0; x < W; x += 9) { R(x, 0, 1, 21, N[0]); R(x + 1, 0, 1, 21, N[1]); R(x + 5, 0, 1, 21, N[3]); }
    R(0, 20, W, 1, PL[3]); R(0, 21, W, 1, PL[2]); R(0, 22, W, 1, PL[1]); R(0, 23, W, H - 23, N[0]);
  }],
  belt: [168, 22, (c) => { // wide belt: rolled edges, two rows of stitching, a groove, round studs (none behind the buckle)
    const { R, P, W, H, F } = c, L = VP.lea, T = PAL.steel;
    R(0, 0, W, H, L[2]); R(0, 0, W, 1, L[0]); R(0, 1, W, 1, L[4]); R(0, 2, W, 1, L[3]); R(0, H - 2, W, 1, L[1]); R(0, H - 1, W, 1, L[0]);
    R(0, 10, W, 1, L[1]); R(0, 11, W, 1, L[3]);
    for (let x = 0; x < W; x++) if (x % 3 < 2) { P(x, 4, L[4]); P(x, H - 5, L[4]); }
    for (let x = 6; x < W; x += 12) if (Math.abs(x - F) > 14) stud(c, x, 10, T, L[0]);
  }],
  buckle: [17, 14, (c) => { // steel buckle plate, lit frame, a little skull on the sunken plate
    const { R, P, W, H } = c, T = PAL.steel;
    R(0, 0, W, H, T[1]); R(1, 1, W - 2, H - 2, T[3]); R(1, 1, W - 2, 1, T[4]); R(1, 1, 1, H - 2, T[4]); R(1, H - 2, W - 2, 1, T[2]); R(W - 2, 1, 1, H - 2, T[2]);
    R(2, 1, 3, 1, T[5]); P(1, 2, T[5]); R(3, 3, W - 6, H - 6, T[1]); R(4, 4, W - 8, H - 8, T[2]);
    const SK = ['.XXXXX.', 'XXXXXXX', 'XooXooX', 'XXXnXXX', '.XXXXX.', '.X.X.X.'], col = { X: T[4], o: T[0], n: T[1] };
    SK.forEach((row, j) => [...row].forEach((ch, i) => { if (col[ch]) P(5 + i, 4 + j, col[ch]); }));
    P(6, 4, T[5]); P(5, 5, T[5]);
  }],
  stripA: strip(VP.lea, true), stripB: strip(VP.dlea, false),
  skirtP: [24, 46, (c) => PXT.skirt[2](c)], // one panel of it, two folds wide (round 18: the underskirt hangs in panels)
  skirt: [240, 46, (c) => { // the navy underskirt between the strips: soft pleats, a plum-piped hem notched at each fold
    const { R, P, W, H } = c, N = VP.navy, PL = PAL.plum;
    R(0, 0, W, H, N[1]); for (let x = 0; x < W; x += 12) { R(x, 4, 1, H - 4, N[0]); R(x + 7, 0, 1, H - 5, N[2]); R(x + 8, 8, 1, H - 16, N[3]); }
    R(0, H - 5, W, 1, PL[3]); R(0, H - 4, W, 2, PL[2]); R(0, H - 2, W, 1, PL[1]); R(0, H - 1, W, 1, N[0]); for (let x = 0; x < W; x += 12) R(x, H - 5, 1, 4, PL[0]);
  }],
  strapSide: [45, 9, (c) => { const { R, P, W, H } = c, L = VP.lea; R(0, 0, W, H, L[2]); R(0, 0, W, 1, L[3]); R(0, H - 2, W, 1, L[1]); R(0, H - 1, W, 1, L[0]); for (let x = 0; x < W; x++) if (x % 3 < 2) P(x, 3, L[4]); }],
  strapTop: [11, 45, (c) => {
    const { R, P, W, H } = c, L = VP.lea, T = PAL.steel;
    R(0, 0, W, H, L[2]); R(0, 0, 1, H, L[0]); R(W - 1, 0, 1, H, L[0]); R(1, 0, 1, H, L[3]); R(W - 2, 0, 1, H, L[1]);
    for (let j = 0; j < H; j += 3) { P(2, j, L[4]); P(W - 3, j, L[4]); } for (let j = 5; j < H; j += 11) rivet(c, 4, j, T);
  }],
  strapTab: [10, 15, (c) => { const { R, P, W, H } = c, L = VP.lea; R(0, 0, W, H, L[2]); R(0, 0, 1, H, L[0]); R(W - 1, 0, 1, H, L[0]); R(1, 0, 1, H, L[3]); R(W - 2, 0, 1, H, L[1]); for (let j = 0; j < H - 3; j += 2) { P(2, j, L[4]); P(W - 3, j, L[4]); } R(0, H - 1, W, 1, L[0]); P(1, H - 2, L[0]); P(W - 2, H - 2, L[0]); }],
  armlet: [66, 5, (c) => { const { R, P, W } = c, G = PAL.gold; R(0, 0, W, 1, G[4]); R(0, 1, W, 1, G[3]); R(0, 2, W, 2, G[2]); R(0, 4, W, 1, G[0]); for (let x = 0; x < W; x += 4) { P(x, 2, G[1]); P(x + 1, 3, G[1]); P(x + 2, 2, G[3]); } for (let x = 3; x < W; x += 11) P(x, 1, G[4]); }],
  strapEnd: [11, 9, (c) => { const { R, W, H } = c, L = VP.lea; R(0, 0, W, H, L[2]); R(0, 0, W, 1, L[4]); R(0, 1, W, 1, L[3]); R(0, 0, 1, H, L[0]); R(W - 1, 0, 1, H, L[0]); R(0, H - 1, W, 1, L[0]); }],
  pauldron: [64, 22, (c) => { // three overlapping steel lames (u around, v from the crown down), rivets, white glints up top
    const { R, P, W, H } = c, T = PAL.steel;
    R(0, 0, W, H, T[2]); R(0, 0, W, 6, T[3]); R(0, 0, W, 2, T[4]); R(0, 6, W, 2, T[1]);
    R(0, 8, W, 1, T[0]); R(0, 9, W, 1, T[4]); R(0, 10, W, 1, T[3]); R(0, 13, W, 2, T[1]);
    R(0, 15, W, 1, T[0]); R(0, 16, W, 1, T[4]); R(0, 17, W, 1, T[3]); R(0, 20, W, 1, T[1]); R(0, 21, W, 1, T[0]);
    for (let x = 2; x < W; x += 8) { rivet(c, x, 11, T); rivet(c, x + 4, 18, T); }
    for (let x = 4; x < W; x += 16) { P(x, 2, T[5]); P(x + 1, 2, T[5]); P(x + 1, 3, T[5]); P(x + 2, 3, T[4]); P(x + 2, 4, T[4]); }
  }],
  knee: [40, 12, (c) => { // a domed knee cop seen from the front (v from the boss out to the rim)
    const { R, P, W, H } = c, T = PAL.steel;
    R(0, 0, W, H, T[3]); R(0, 0, W, 3, T[4]); R(0, 0, W, 1, T[5]); R(0, 5, W, 2, T[2]); R(0, 7, W, 1, T[0]); R(0, 8, W, 1, T[4]); R(0, 9, W, 2, T[2]); R(0, 11, W, 1, T[0]);
    for (let x = 0; x < W; x += 10) rivet(c, x + 5, 9, T);
    for (let k = 0; k < 4; k++) { P(28 + k, 2 + k, T[5]); P(29 + k, 2 + k, T[5]); P(27 + k, 3 + k, T[4]); }
  }],
  kstrap: [88, 4, (c) => { const { R, P, W } = c, L = VP.lea; R(0, 0, W, 4, L[1]); R(0, 0, W, 1, L[3]); R(0, 3, W, 1, L[0]); for (let x = 0; x < W; x += 3) P(x, 1 + (x & 1), L[4]); }],
  bootTop: [88, 30, (c) => { // the boot over the knee: a lit front, a back seam, creases behind the knee
    const { R, P, W, H, F } = c, B = VP.boot;
    R(0, 0, W, H, B[2]); R(0, 0, W, 1, B[3]); R(0, 0, 1, H, B[0]); R(1, 0, 1, H, B[3]); R(F - 4, 2, 4, 16, B[3]); R(F - 3, 4, 1, 8, B[4]);
    for (const [xc, y0, hw] of [[-8, 21, 9], [9, 24, 8], [0, 27, 10]]) for (let dx = -hw; dx <= hw; dx++) { const k = 1 - (dx / hw) ** 2, y = y0 - Math.round(1.6 * k); P(xc + dx, y, B[3]); P(xc + dx, y + 1, B[1]); }
  }],
  cuff: [90, 9, (c) => { // the folded-down boot cuff: lit roll on top, stitching, fold notches, shadow under it
    const { R, P, W, H } = c, B = VP.boot;
    R(0, 0, W, H, B[3]); R(0, 0, W, 1, B[5]); R(0, 1, W, 1, B[4]); R(0, H - 2, W, 1, B[1]); R(0, H - 1, W, 1, B[0]);
    for (let x = 0; x < W; x++) if (x % 3 < 2) P(x, 3, B[5]);
    for (let x = 4; x < W; x += 15) { R(x, 4, 1, 3, B[1]); P(x + 1, 5, B[2]); P(x - 1, 6, B[2]); P(x, 2, B[2]); }
  }],
  shin: [72, 45, (c) => { // boot shaft: a glossy front, a back seam, slouched folds round the ankle (each a lit ridge over its shadow)
    const { R, P, W, H, F } = c, B = VP.boot;
    R(0, 0, W, H, B[2]); R(0, 0, 1, H, B[0]); R(1, 0, 1, H, B[3]);
    R(F - 4, 3, 4, 22, B[3]); R(F - 3, 5, 2, 14, B[4]); R(F - 3, 7, 1, 4, B[5]); R(F + 2, 3, 1, 22, B[3]);
    for (const [xc, y0, hw] of [[F - 7, 31, 12], [F + 9, 35, 11], [F - 2, 40, 14], [F + 22, 30, 9], [F - 22, 36, 10], [2, 33, 11], [W - 14, 39, 9], [F + 26, 41, 8]]) for (let dx = -hw; dx <= hw; dx++) {
      const k = 1 - (dx / hw) ** 2, y = y0 - Math.round(2.4 * k); P(xc + dx, y, k > .55 ? B[4] : B[3]); P(xc + dx, y + 1, B[1]); if (k > .3) P(xc + dx, y + 2, B[0]);
    }
    R(0, H - 2, W, 2, B[1]);
  }],
  footA: footSide(true), footB: footSide(false),
  footTop: [20, 36, (c) => { // the instep (back at the top) creased, the toe cap lit
    const { R, P, W, H } = c, B = VP.boot;
    R(0, 0, W, H, B[2]); R(0, 0, W, 4, B[1]); R(0, 0, 1, H, B[1]); R(W - 1, 0, 1, H, B[1]);
    for (const y of [12, 17]) { R(3, y, W - 6, 1, B[1]); R(4, y - 1, W - 8, 1, B[3]); }
    R(1, 24, W - 2, H - 25, B[3]); for (let x = 1; x < W - 1; x++) P(x, 23 + Math.round(Math.abs(x - 9.5) / 4), B[0]);
    R(6, 29, 8, 4, B[4]); R(8, 30, 3, 2, B[5]); R(1, H - 1, W - 2, 1, B[1]);
  }],
  footFront: [20, 14, (c) => { const { R, W, H } = c, B = VP.boot; R(0, 0, W, H, B[3]); R(0, 0, 1, H, B[2]); R(W - 1, 0, 1, H, B[2]); R(6, 2, 7, 3, B[4]); R(8, 2, 3, 1, B[5]); R(0, 10, W, 1, B[1]); for (let i = 1; i < W; i += 2) R(i, 10, 1, 1, B[4]); R(0, 11, W, 3, B[0]); }],
  footBack: [20, 14, (c) => { const { R, W, H } = c, B = VP.boot; R(0, 0, W, H, B[2]); R(9, 0, 2, 8, B[0]); R(0, 7, W, 7, B[1]); R(0, 7, W, 1, B[0]); R(0, 11, W, 3, B[0]); }],
  bracer: [62, 24, (c) => { // laced forearm guard: rolled edges, a tooled diamond, lacing up the inside (the straps are rings)
    const { R, P, W, H, F } = c, L = VP.lea;
    R(0, 0, W, H, L[2]); R(0, 0, W, 1, L[4]); R(0, 1, W, 1, L[3]); R(0, 2, W, 1, L[1]); R(0, H - 3, W, 1, L[1]); R(0, H - 2, W, 1, L[3]); R(0, H - 1, W, 1, L[0]);
    for (const x of [F, 0]) for (let k = -2; k <= 2; k++) { P(x + k, 11 - (2 - Math.abs(k)), L[4]); P(x + k, 11 + (2 - Math.abs(k)), L[1]); }
    for (let j = 3; j < H - 3; j++) { const o = j % 4 < 2 ? j % 4 : 4 - j % 4; P(F + W / 4 - 2 + o, j, L[0]); P(F + W / 4 + 2 - o, j, L[4]); }
  }],
  bstrap: [66, 4, (c) => { const { R, P, W } = c, L = VP.dlea; R(0, 0, W, 4, L[2]); R(0, 0, W, 1, L[4]); R(0, 3, W, 1, L[0]); for (let x = 0; x < W; x += 3) P(x, 2, L[4]); }],
  hair: [128, 48, (c) => { // locks from a parting just off the front (u round, v from the crown): each lit on one side and shaded on the other,
    // dark gaps between, pointed tips over a darker under-layer at different lengths, a ring of sheen; the front locks sweep aside over the brow
    const { P, W, H, rnd } = c, Hc = PAL.hair, n = 15, part = Math.round(W * .68);
    const ws = Array.from({ length: n }, () => 6 + rnd() * 5), sum = ws.reduce((a, b) => a + b); let acc = 0;
    const L = ws.map((wk, k) => { const x0 = part + acc, d = ((x0 - part + W / 2) % W + W) % W - W / 2; acc += wk * W / sum;
      return { x0, k, sw: Math.sign(d || 1) * 10 * Math.max(0, Math.cos((x0 / W - .75) * Math.PI * 2)), tip: 31 + rnd() * 15, hl: 6 + (rnd() * 5 | 0), hn: 4 + (rnd() * 5 | 0), sp: 14 + (rnd() * 6 | 0) }; });
    const xs = (l, j) => l.x0 + l.sw * Math.pow(j / 30, 2) + (l.k % 2 ? 1.4 : -1.4) * Math.sin(j / 46 * Math.PI); // neighbours pinch and part: clumps
    for (let j = 0; j < H; j++) for (let k = 0; k < n; k++) {
      const l = L[k], a = Math.round(xs(l, j)), w = ((Math.round(xs(L[(k + 1) % n], j)) - a) % W + W) % W || W / n, lo = j >= 27;
      for (let i = 0; i < w; i++) {
        const p = (i + .5) / w, t = (l.tip - j) / 7, under = lo ? Hc[1] : Hc[2];
        let col = j < 2 ? Hc[4] : t <= 0 || Math.abs(p - .55) > .5 * Math.min(1, t) ? under : i === 0 ? (lo ? Hc[0] : Hc[1]) : p > .74 ? (lo ? Hc[1] : Hc[2]) : lo ? Hc[2] : Hc[3];
        if (!lo && i > 0 && p > .14 && p < .46 && j >= l.hl && j < l.hl + l.hn && t > 0) col = j < l.hl + 2 && p < .34 ? Hc[5] : Hc[4];
        if (w > 8 && i === Math.round(w * .62) && j >= l.sp && j < l.sp + 9 && t > 1) col = lo ? Hc[1] : Hc[2]; // a lock splitting in two
        P(a + i, j, col);
      }
    }
  }],
  lock: [16, 12, (c) => { const { R, P, W, H } = c, Hc = PAL.hair; R(0, 0, W, H, Hc[3]); R(0, 0, W, 3, Hc[4]); P(2, 0, Hc[5]); P(10, 0, Hc[5]); for (let x = 0; x < W; x += 4) R(x, 2, 1, H - 2, Hc[2]); for (const x of [2, 10]) { R(x, 4, 1, 5, Hc[4]); P(x, 5, Hc[5]); } R(0, H - 2, W, 2, Hc[2]); }],
  toe: [40, 12, (c) => { // the round toe cap (v from the tip back; u .75 is up, .25 down): lit on top, the sole under
    const { R, P, W, H } = c, B = VP.boot;
    R(0, 0, W, H, B[3]); R(0, 0, W, 2, B[4]); R(0, H - 1, W, 1, B[2]); for (let x = 27; x < 33; x++) { P(x, 3, B[5]); P(x + 1, 4, B[4]); }
    R(4, 5, 16, H - 5, B[0]); R(4, 4, 16, 1, B[1]); for (let x = 5; x < 20; x += 2) P(x, 4, B[4]);
  }],
  buckleS: [6, 6, (c) => { const { R } = c, T = PAL.steel; R(0, 0, 6, 6, T[1]); R(0, 0, 6, 1, T[4]); R(0, 0, 1, 6, T[4]); R(0, 0, 2, 1, T[5]); R(2, 2, 2, 2, VP.lea[0]); R(2, 2, 1, 2, T[3]); }],
  shieldFace: [96, 96, (c) => { // painted navy shield: a lit rim groove, a ring of rivets, a dentil ring round the boss
    const { P } = c, S0 = ['#14141e', '#1e1f2c', '#282a3a', '#363a50', '#4c5270'], T = PAL.steel;
    for (let j = 0; j < 96; j++) for (let i = 0; i < 96; i++) {
      const x = i - 47.5, y = j - 47.5, r = Math.hypot(x, y), a = Math.atan2(y, x) / Math.PI / 2 + .5;
      let col = S0[2];
      if (r > 45) col = S0[0]; else if (r > 43) col = y < 0 ? S0[4] : S0[3]; else if (r > 41) col = S0[0]; else if (r > 33 && r < 35) col = S0[1]; else if (r > 31 && r < 33) col = y < 0 ? S0[3] : S0[2]; else if (r < 26 && r > 24) col = S0[1];
      if (r > 36 && r < 41 && Math.abs((a * 16) % 1 - .5) < .07 && Math.abs(r - 38.5) < 1.2) col = y < 0 ? T[4] : T[3];
      P(i, j, col);
    }
  }],
  shieldRim: [170, 6, (c) => { const { R, P, W } = c, T = PAL.steel; R(0, 0, W, 1, T[4]); R(0, 1, W, 1, T[3]); R(0, 2, W, 2, T[2]); R(0, 4, W, 1, T[1]); R(0, 5, W, 1, T[0]); for (let x = 0; x < W; x += 14) rivet(c, x, 2, T); }],
  shieldRing: [64, 64, (c) => { const { P } = c, T = PAL.steel; for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const x = i - 31.5, y = j - 31.5, r = Math.hypot(x, y), a = Math.atan2(y, x) / Math.PI / 2 + .5; P(i, j, r < 29.5 ? T[1] : r > 31.5 ? T[0] : Math.abs((a * 24) % 1 - .5) < .1 ? T[5] : y < 0 ? T[4] : T[3]); } }],
  sunFace: [32, 32, (c) => { const { P } = c, T = PAL.steel; for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const x = i - 15.5, y = j - 15.5, r = Math.hypot(x, y); P(i, j, r > 14.5 ? T[1] : r > 12 ? (y < 0 ? T[4] : T[3]) : r > 11 ? T[1] : r > 6 ? (x + y < -9 && x + y > -13 ? T[5] : T[2]) : T[3]); } }],
  sunSide: [52, 6, (c) => { const { R, W } = c, T = PAL.steel; R(0, 0, W, 2, T[4]); R(0, 2, W, 2, T[3]); R(0, 4, W, 2, T[1]); }],
  braidC: braid(3), braidD: braid(2),
  gband: [32, 5, (c) => { const { R, P, W } = c, G = PAL.gold; R(0, 0, W, 1, G[4]); R(0, 1, W, 1, G[3]); R(0, 2, W, 2, G[2]); R(0, 4, W, 1, G[1]); for (let x = 0; x < W; x += 4) { P(x, 2, G[1]); P(x, 3, G[1]); P(x + 1, 1, G[4]); } }],
  tuft: [24, 14, (c) => { const { R, P, W, H } = c, Hc = PAL.hair; R(0, 0, W, H, Hc[3]); for (let x = 0; x < W; x++) { if (x % 4 === 0) R(x, 0, 1, H, Hc[2]); if (x % 4 === 2) R(x, 0, 1, 5, Hc[4]); } R(0, 10, W, H - 10, Hc[1]); }],
  stud: [16, 8, (c) => { const { R, P } = c, T = PAL.steel; R(0, 0, 16, 2, T[4]); R(0, 2, 16, 2, T[3]); R(0, 4, 16, 2, T[2]); R(0, 6, 16, 2, T[1]); P(12, 2, T[5]); P(11, 2, T[5]); P(12, 3, T[4]); }],
};
const pm = paMat, plain = (col) => mat(col);
function pxWar(r, W) {
  const { torso, head } = r, T = PAL.steel, L = VP.lea, N = VP.navy, B = VP.boot, Hc = PAL.hair, Au = PAL.gold;
  const find = (p, f) => p.children.find((o) => o.isMesh && f(o.geometry.parameters || {}));
  const cylM = (p, rt, rb, h, side, cap, x, y, z, seg = 8, o) => mesh(p, cylGeo(rt, rb, h, seg), null, x, y, z, { ...o, material: [pm(side), plain(cap), plain(cap)] });
  const boxM = (p, w, h, d, mats, x, y, z, o) => { const m = mesh(p, boxGeo(), null, x, y, z, { ...o, material: mats.map((k) => k[0] === '#' ? plain(k) : pm(k)) }); m.scale.set(w, h, d); return m; };
  const dome = () => G('padome', () => new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2));
  // the rig's own chest, shins and feet, re-dressed (turned half round: their texture's front is at u .5)
  const chest = find(torso, (q) => q.radiusTop === .25 && q.height === .5); chest.material = [pm('chest'), pm('chestCap'), plain(N[2])]; chest.rotation.y = Math.PI;
  const waist = torso.children[0]; waist.material = [pm('waist'), plain(N[1]), plain(N[1])]; waist.rotation.y = Math.PI;
  for (const K of [r.kneeL, r.kneeR]) {
    const shin = find(K, (q) => q.radiusTop === .08 && q.height === .3); shin.material = [pm('shin'), plain(B[2]), plain(B[1])]; shin.rotation.y = Math.PI;
    const foot = K.children.find((o) => o.isMesh && o.geometry.type === 'BoxGeometry'); foot.material = ['footA', 'footB', 'footTop', B[0], 'footFront', 'footBack'].map((k) => k[0] === '#' ? plain(k) : pm(k));
    W(cylM(K, .1, .085, .2, 'bootTop', B[1], 0, .06, 0, 10)).rotation.y = Math.PI; // knee-high boots
    W(cylM(K, .096, .089, .06, 'cuff', B[1], 0, -.075, 0, 10)).rotation.y = Math.PI; // folded cuff under the knee
    W(cylM(K, .095, .095, .024, 'kstrap', L[1], 0, .005, 0, 10));
    const kn = mesh(W(pivot(K, 0, 0, 0)), dome(), null, 0, .01, .058, { material: pm('knee') }); kn.rotation.x = Math.PI / 2; kn.scale.set(.064, .046, .072);
    (r.underBoots ||= []).push(kn); // hidden under footwear gear (equipGear), like the pauldrons under a cuirass
    const toe = mesh(K, dome(), null, 0, -.342, .13, { material: pm('toe') }); toe.rotation.x = Math.PI / 2; toe.scale.set(.064, .06, .044); // a round toe
  }
  // teal hair: cap, the back, a side-swept fringe and two woven braids over the shoulders, banded in gold
  const hm = pm('hair'), cap = ball(head, .215, null, 0, .29, -.05, 1, { material: hm }); cap.scale.set(1.02, .8, 1.04);
  r.hair = [cap, ball(head, .17, null, 0, .2, -.1, 1, { material: hm })];
  const braids = r.braids = [], up = new THREE.Vector3(0, 1, 0), dv = new THREE.Vector3();
  // the side-swept fringe: pointed four-sided locks laid over the brow from the parting (a lit and a shaded facet each)
  const capZ = (x, y) => -.05 + .224 * Math.sqrt(Math.max(0, 1 - (x / .219) ** 2 - ((y - .29) / .172) ** 2));
  for (const [bx, by, tx, ty, w] of [[.13, .37, .18, .29, .035], [.1, .375, .04, .295, .04], [.05, .385, -.03, .3, .045], [0, .385, -.09, .305, .045], [-.05, .375, -.14, .3, .04], [-.1, .36, -.18, .27, .035]]) {
    const bz = capZ(bx, by) + .012, tz = capZ(tx, ty) + .022, len = Math.hypot(tx - bx, ty - by, tz - bz);
    const m = mesh(head, coneGeo(w, +len.toFixed(3), 4), null, (bx + tx) / 2, (by + ty) / 2, (bz + tz) / 2, { material: [pm('lock'), hm, hm] });
    m.quaternion.setFromUnitVectors(up, dv.set(tx - bx, ty - by, tz - bz).normalize()); m.scale.z = .55; r.hair.push(m);
  }
  for (const sx of [-1, 1]) {
    ball(head, .075, null, sx * .17, .14, -.06, 1, { material: hm }).scale.set(.9, 1.2, 1);
    const P = [[.16, .8, -.04], [.205, .67, .03], [.19, .55, .155], [.172, .42, .158], [.162, .29, .148], [.152, .17, .146]], N = 15;
    const at = (i) => { const u = i / (N - 1) * (P.length - 1), j = Math.min(P.length - 2, Math.floor(u)), f = u - j; return [0, 1, 2].map((k) => P[j][k] + (P[j + 1][k] - P[j][k]) * f); };
    for (let i = 0; i < N; i++) {
      const [x, y, z] = at(i), rad = .056 - i * .0013, side = i % 2 ? 1 : -1;
      const b = ball(torso, rad, null, sx * x + side * .012, y, z, 1, { material: pm(i % 2 ? 'braidD' : 'braidC') }); b.scale.set(1.05, 1.3, .78); b.rotation.z = side * .45;
      braids.push(b);
      if (i === 3 || i === 8) { // a gold band where this lobe meets the next, square to the braid
        const [x2, y2, z2] = at(i + 1), band = cylM(torso, rad + .006, rad + .006, .026, 'gband', Au[2], sx * (x + x2) / 2, (y + y2) / 2, (z + z2) / 2, 10, { noShadow: true });
        band.quaternion.setFromUnitVectors(up, dv.set(sx * (x2 - x), y2 - y, z2 - z).normalize()); band.scale.set(1, 1, .82); braids.push(band);
      }
    }
    const tie = cylM(torso, .04, .04, .035, 'gband', Au[2], sx * .152, .135, .146, 10); tie.rotation.x = .1;
    const tuft = mesh(torso, coneGeo(.045, .1, 6), null, sx * .152, .07, .144, { material: [pm('tuft'), plain(Hc[2]), plain(Hc[2])] }); tuft.rotation.x = Math.PI;
    braids.push(tie, tuft);
  }
  // leather shoulder straps with a steel stud, small laminated pauldrons that ride the arms
  for (const sx of [-1, 1]) {
    W(boxM(torso, .066, .035, .29, ['strapSide', 'strapSide', 'strapTop', L[0], 'strapEnd', 'strapEnd'], sx * .15, .597, 0));
    W(boxM(torso, .062, .1, .02, [L[1], L[1], L[3], L[0], 'strapTab', L[1]], sx * .15, .54, .148)).rotation.x = -.1; // the strap's end down the chest
    W(ball(torso, .022, null, sx * .15, .508, .162, 1, { noShadow: true, material: pm('stud') }));
  }
  for (const [A, sx] of [[r.armL, -1], [r.armR, 1]]) {
    const pd = mesh(W(pivot(A, sx * .012, .012, 0)), dome(), null, 0, 0, 0, { material: pm('pauldron') }); pd.scale.set(.118, .1, .112); pd.rotation.z = -sx * .55;
    (r.underArmour ||= []).push(pd); // hidden under body armour (equipGear); its pivot is the war part
    W(cylM(A, .071, .068, .032, 'armlet', Au[2], 0, -.115, 0, 10, { noShadow: true })); // a gold armlet
  }
  // belt with a skull buckle, the navy underskirt with its piped hem, the pteruges strips
  const belt = W(cylM(torso, .2, .2, .15, 'belt', L[1], 0, .17, 0, 12)); belt.scale.z = .78; belt.rotation.y = Math.PI;
  W(boxM(torso, .1, .083, .026, [T[2], T[2], T[3], T[1], 'buckle', T[1]], 0, .17, .162));
  // (round 18: the underskirt is a ring of pleated panels and every strip hangs from a hinge, so both swing clear of her
  // legs (fitFlaps) instead of standing as a bell her thighs pass through)
  const under = [];
  for (let i = 0; i < 12; i++) {
    const f = flapOn(r, torso, (i + .5) / 12 * Math.PI * 2, .2, -.03, .3, .32, .15); W(f.pv); under.push(f);
    mesh(f.pv, trapGeo(.8), null, 0, 0, 0, { material: [plain(N[1]), plain(N[1]), plain(N[2]), plain(N[0]), pm('skirtP'), plain(N[0])] }).scale.set(.155, .3, .02);
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, q = i % 2 ? VP.dlea : L, f = flapOn(r, torso, a, .215, -.04, .3, .36, .07, under[Math.round(i * 1.2 - .5 + 12) % 12]); W(f.pv);
    boxM(f.pv, .07, .3, .03, [q[1], q[1], q[2], q[0], i % 2 ? 'stripB' : 'stripA', q[1]], 0, -.15, 0);
  }
  // laced leather bracers on both forearms, each with two strap rings and a steel buckle
  for (const E of [r.elbowL, r.elbowR]) {
    W(cylM(E, .065, .065, .16, 'bracer', L[1], 0, -.15, 0, 10)).rotation.y = Math.PI;
    for (const y of [-.11, -.18]) { W(cylM(E, .07, .07, .024, 'bstrap', VP.dlea[1], 0, y, 0, 10)); W(boxM(E, .026, .03, .014, [T[2], T[2], T[3], T[1], 'buckleS', T[1]], 0, y, .07, { noShadow: true })); }
  }
}
function pxShield(disc, rim, sun) { // her round shield: painted face with a rivet ring, riveted steel rim, a lit steel boss under the sun rays
  const f = paMat('shieldFace'), g = paMat('shieldRing');
  disc.material = [mat('#1e1f2c'), f, f]; rim.material = [paMat('shieldRim'), g, g]; sun.material = [paMat('sunSide'), paMat('sunFace'), paMat('sunFace')];
}
// V's home skirt: a yoke round the hips and a ring of pleat panels, each hinged at the waist and again at the knee.
// fitDress() swings every panel out just far enough to clear her legs in whatever pose she is in.
const DRESS = { n: 12, y0: .06, rx: .2, rz: .18, l1: .4, l2: .4, t1: .3, t2: .24, ov: 1.22, th: .022 };
const trapGeo = (tp) => G('trap' + tp, () => { // unit panel hanging down from its top edge, the top narrower by tp
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, -.5, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > -.5) p.setX(i, p.getX(i) * tp);
  g.computeVertexNormals(); return g;
});
function homeSkirt(r, cr, trim, key) {
  const D = DRESS, root = pivot(r.hip, 0, 0, 0), panels = [];
  tcyl(root, .205, .235, .18, cr, 0, .05, 0, 12).scale.z = .86; // the yoke over the hips, where the panels hang from
  for (let i = 0; i < D.n; i++) {
    const a = i / D.n * Math.PI * 2, top = pivot(root, Math.sin(a) * D.rx, D.y0, Math.cos(a) * D.rz); top.rotation.order = 'YXZ'; top.rotation.y = a;
    const up = mesh(top, trapGeo(.62), cr, 0, 0, 0), low = pivot(top, 0, -D.l1, 0), lo = mesh(low, trapGeo(.76), cr, 0, 0, 0);
    const band = box(low, 1, .07, .032, trim, 0, 0, 0); box(band, .32, .42, .5, key, 0, 0, .55, { noShadow: true }); // sea-blue border, one key each
    top.rotation.x = -D.t1; low.rotation.x = D.t1 - D.t2; up.scale.set(.2, D.l1, D.th); lo.scale.set(.26, D.l2, D.th); band.position.y = .035 - D.l2; band.scale.x = .26; // at rest until fitDress runs
    panels.push({ a, top, up, low, lo, band, th1: D.t1, th2: D.t2, g1: D.t1, g2: D.t2, gl: -D.l2, len: D.l2, kx: 0, ky: 0, kz: 0 });
  }
  root.userData = { panels, pts: [], mv: 0 };
  return root;
}
// hip-space sample spheres down each leg: [x, y, z, radius, 0 = thigh / 1 = shin space]
const LEGPTS = [[0, -.1, 0, .1, 0], [0, -.26, 0, .09, 0], [0, -.44, 0, .085, 0], [0, -.12, 0, .08, 1], [0, -.26, 0, .075, 1], [0, -.34, -.05, .07, 1], [0, -.34, .12, .07, 1]];
const _lm = new THREE.Matrix4(), _pv = new THREE.Vector3();
// Runs after every pose (cutscene ticks included). Each panel swings out to clear her thighs, knees, shins and feet;
// neighbours stay within a step of each other so the skirt bulges round a knee instead of splitting; the cloth snaps
// out at once but falls back slowly; on the ground the hem folds up and spreads instead of sinking in.
function fitDress(r, dt, st) {
  const D = DRESS, S = r.dress.userData, P = S.panels, pts = S.pts, hw = Math.sin(Math.PI / D.n) * D.ov;
  let np = 0;
  for (const [Lg, K] of [[r.legL, r.kneeL], [r.legR, r.kneeR]]) {
    Lg.updateMatrix(); K.updateMatrix(); _lm.multiplyMatrices(Lg.matrix, K.matrix);
    for (const q of LEGPTS) { _pv.set(q[0], q[1], q[2]).applyMatrix4(q[4] ? _lm : Lg.matrix); (pts[np++] ||= new THREE.Vector4()).set(_pv.x, _pv.y, _pv.z, q[3] + .035); }
  }
  S.mv += ((st.moving ? (st.run ? 1 : .5) : 0) - S.mv) * Math.min(1, dt * 4);
  const yg = -(r.hip.position.y + r.body.position.y), fall = 1 - Math.exp(-dt * 9);
  // the tightest angle (from straight down, outward) a segment hinged at (x, y, z) facing a can hang at and miss every
  // sphere; past `cap` it stays at cap and comes up short of the sphere instead (lmax: a heel kicked up under the hem)
  let lmax = 0;
  const clear = (a, x, y, z, len, t, cap = 1.5) => {
    const sx = Math.sin(a), cz = Math.cos(a); lmax = len;
    for (let j = 0; j < np; j++) {
      const v = pts[j], dx = v.x - x, dz = v.z - z, out = dx * sx + dz * cz, ex = Math.abs(dx * cz - dz * sx) - Math.hypot(v.x, v.z) * hw;
      if (ex >= v.w) continue; // off to the side: the next panel's
      const rq = ex > 0 ? Math.sqrt(v.w * v.w - ex * ex) : v.w, drop = y - v.y, d = Math.hypot(out, drop);
      if (d >= len + rq) continue;
      const ph = Math.atan2(out, drop), need = ph + Math.asin(Math.min(1, rq / d));
      if (need <= cap) { t = Math.max(t, need); continue; }
      t = Math.max(t, cap);
      const along = d * Math.cos(ph - cap), perp = d * Math.sin(ph - cap);
      if (along > 0 && perp < rq) lmax = Math.min(lmax, along - Math.sqrt(Math.max(0, rq * rq - perp * perp)));
    }
    return Math.min(cap, t);
  };
  const spread = (k, step) => {
    for (let i = 0; i < 2 * D.n; i++) { const a = P[i % D.n], b = P[(i + 1) % D.n]; b[k] = Math.max(b[k], a[k] - step); }
    for (let i = 2 * D.n; i > 0; i--) { const a = P[i % D.n], b = P[(i - 1) % D.n]; b[k] = Math.max(b[k], a[k] - step); }
  };
  for (const p of P) { // waist to knee
    const h = D.y0 - yg - .03, back = Math.max(0, -Math.cos(p.a));
    p.g1 = clear(p.a, p.top.position.x, D.y0, p.top.position.z, D.l1, Math.max(D.t1 + S.mv * back * .1, h < D.l1 ? Math.acos(Math.max(0, h) / D.l1) : 0));
  }
  spread('g1', .2);
  for (const p of P) {
    p.th1 = p.g1 >= p.th1 ? p.g1 : p.th1 + (p.g1 - p.th1) * fall;
    const s1 = Math.sin(p.th1) * D.l1; p.kx = p.top.position.x + Math.sin(p.a) * s1; p.kz = p.top.position.z + Math.cos(p.a) * s1; p.ky = D.y0 - Math.cos(p.th1) * D.l1;
    const flut = S.mv * (Math.max(0, -Math.cos(p.a)) * .22 + .05 * (1 + Math.sin(r.phase * 2 + p.a * 2))); // the hem trails and lifts as she goes
    p.g2 = clear(p.a, p.kx, p.ky, p.kz, D.l2, D.t2 + flut, p.ky - yg > .4 ? .85 : 1.5); // standing, it never kites out flat
    p.gl = -Math.max(.3 * D.l2, lmax);
  }
  spread('g2', .2); spread('gl', .06);
  for (const p of P) { // knee to hem
    p.th2 = p.g2 >= p.th2 ? p.g2 : p.th2 + (p.g2 - p.th2) * fall;
    p.len = -p.gl <= p.len ? -p.gl : p.len + (-p.gl - p.len) * fall;
    const h = Math.max(0, p.ky - yg - .015); let t = p.th2, len = p.len;
    if (len * Math.cos(t) > h) { len = Math.max(Math.min(len, .72 * D.l2), h / Math.cos(t)); if (len * Math.cos(t) > h) t = Math.acos(h / len); }
    const kr = Math.hypot(p.kx, p.kz), w1 = 2 * kr * hw, w2 = 2 * (kr + len * Math.sin(t)) * hw;
    p.top.rotation.x = -p.th1; p.up.scale.set(w1, D.l1, D.th);
    p.low.rotation.x = p.th1 - t; p.low.position.y = -D.l1; p.lo.scale.set(w2, len, D.th); // (low.position: groundDress may draw it up)
    p.band.position.y = -len + .035; p.band.scale.x = w2 * 1.02;
  }
}
// round 18: the rest of her skirts get what the home dress has. A flap (a war-skirt panel or pteruges strip, a cuirass's
// pteryx) hangs from a hinge on the waist at angle a (0 = front), and fitFlaps swings each one out just far enough to
// clear her legs in whatever pose she is in: out at once, back slowly. over: the flap under it, which it stays outside.
function flapOn(r, parent, a, rad, y, len, tilt, w, over) {
  const pv = pivot(parent, Math.sin(a) * rad, y, Math.cos(a) * rad); pv.rotation.order = 'YXZ'; pv.rotation.set(-tilt, a, 0);
  const f = { pv, a, len, tilt, hw: w / 2, th: tilt, over }; (r.flaps ||= []).push(f); return f;
}
const _fm = new THREE.Matrix4(), _fi = new THREE.Matrix4(), _fp = [];
function fitFlaps(r, dt) {
  let np = 0; // the leg spheres in hip space, as fitDress takes them
  for (const [Lg, K] of [[r.legL, r.kneeL], [r.legR, r.kneeR]]) {
    if (!Lg || !K) return;
    Lg.updateMatrix(); K.updateMatrix(); _lm.multiplyMatrices(Lg.matrix, K.matrix);
    for (const q of LEGPTS) { _pv.set(q[0], q[1], q[2]).applyMatrix4(q[4] ? _lm : Lg.matrix); (_fp[np++] ||= new THREE.Vector4()).set(_pv.x, _pv.y, _pv.z, q[3] + .03); }
  }
  const nLeg = np;
  if (r._flapArms && r.torso && r.elbowL) { // round 23: a cape also keeps off the arms (elbow, forearm, hand), in hip space
    r.torso.updateMatrix();
    for (const [A, E] of [[r.armL, r.elbowL], [r.armR, r.elbowR]]) {
      A.updateMatrix(); E.updateMatrix(); _lm.multiplyMatrices(r.torso.matrix, A.matrix);
      _pv.set(0, -.3, 0).applyMatrix4(_lm); (_fp[np++] ||= new THREE.Vector4()).set(_pv.x, _pv.y, _pv.z, .085);
      _lm.multiply(E.matrix);
      for (const y of [-.15, -.3]) { _pv.set(0, y, 0).applyMatrix4(_lm); (_fp[np++] ||= new THREE.Vector4()).set(_pv.x, _pv.y, _pv.z, .08); }
    }
  }
  const nArm = np;
  let nPush = 0; // (v31b: past it, what is slung over a cape: a lid it stays under)
  const fall = 1 - Math.exp(-dt * 7);
  let space = null; const pts = (r._flapPts ||= []);
  const local = (par) => { // the spheres in this parent's space, through local matrices up to the hip (world ones may be stale)
    if (par === space) return; space = par;
    _fm.identity(); for (let o = par; o && o !== r.hip; o = o.parent) { o.updateMatrix(); _fm.premultiply(o.matrix); }
    _fi.copy(_fm).invert();
    for (let j = 0; j < np; j++) { const v = _fp[j]; _pv.set(v.x, v.y, v.z).applyMatrix4(_fi); (pts[j] ||= new THREE.Vector4()).set(_pv.x, _pv.y, _pv.z, v.w); }
  };
  const fit = (f) => {
    const pv = f.pv, par = pv.parent; if (!par) return;
    local(par);
    const sx = Math.sin(f.a), cz = Math.cos(f.a), x = pv.position.x, y = pv.position.y, z = pv.position.z;
    let t = f.tilt;
    for (let j = 0, nj = f.arms ? (f.cape ? nPush : np) : nLeg; j < nj; j++) {
      const v = pts[j], dx = v.x - x, dz = v.z - z, out = dx * sx + dz * cz, ex = Math.abs(dx * cz - dz * sx) - (j < nLeg ? f.hw : j < nArm ? f.ahw ?? f.hw : f.ohw ?? f.hw);
      if (ex >= v.w) continue; // off to the side: another flap's
      const rq = ex > 0 ? Math.sqrt(v.w * v.w - ex * ex) : v.w, drop = y - v.y, d = Math.hypot(out, drop);
      if (d >= f.len + rq || d < 1e-4) continue;
      t = Math.max(t, Math.atan2(out, drop) + Math.asin(Math.min(1, rq / d)));
    }
    if (f.over) t = Math.max(t, f.over.th + .03);
    t = Math.min(t, 1.45);
    f.th = t >= f.th ? t : f.th + (t - f.th) * fall;
    if (f.cape) { // the shield or a weapon slung over a cape straps it down: it hangs no further out than under them
      let lid = Infinity, ld = 0;
      for (let j = nPush; j < np; j++) {
        const v = pts[j], dx = v.x - x, dz = v.z - z, drop = y - v.y; if (drop <= 0 || drop > f.len) continue;
        if (Math.abs(dx * cz - dz * sx) > f.hw + (f.ohw - f.hw) * drop / f.len + v.w) continue; // (beside the cape there)
        lid = Math.min(lid, Math.atan2(Math.max(0, dx * sx + dz * cz - v.w), drop)); ld = Math.max(ld, drop);
      }
      f.lid = ld ? lid : null; f.lidDrop = ld;
      if (ld && f.th > lid) f.th = lid;
    }
    pv.rotation.x = (f.sgn ?? -1) * f.th; // sgn: a flap built facing front that hangs at the back swings out with +x
    if (pv.scale.y < 1) pv.scale.y = Math.min(1, pv.scale.y + dt * 3); // bunched up on the ground in a roll (groundFlaps)
  };
  for (const list of [r.flaps, r.gearFlaps]) if (list) for (const f of list) fit(f);
  if (r.backFlaps && r.torso) { // v31b: a cape, last: over her legs and arms, what is slung on her back and the hems of the skirts at her back
    r.torso.updateMatrix(); r.hip.updateMatrix?.();
    for (const list of [r.flaps, r.gearFlaps]) if (list) for (const f of list) {
      if (f.cape || !f.pv.parent || Math.abs(wrap(f.a - Math.PI)) > 1.3) continue;
      _fm.identity(); for (let o = f.pv; o && o !== r.hip; o = o.parent) { o.updateMatrix(); _fm.premultiply(o.matrix); }
      _pv.set(0, -f.len, 0).applyMatrix4(_fm); (_fp[np++] ||= new THREE.Vector4()).set(_pv.x, _pv.y, _pv.z, .035);
    }
    nPush = np;
    for (const o of r.capeLid || []) { _pv.set(o[0], o[1], o[2]).applyMatrix4(r.torso.matrix); (_fp[np++] ||= new THREE.Vector4()).set(_pv.x, _pv.y, _pv.z, o[3]); }
    space = null; for (const f of r.backFlaps) fit(f);
  }
}
// ---------- round 23 (Roy: "the weapon effect must be exactly today's size, but always where the weapon's sharp part is") ----------
// The V rigs animated lately (fx.js finds hers by where the swing is) and where her weapon's sharp part is right now, in the
// world: B its point furthest out (tip or edge), A a point on the line of the head back toward the hand (weapons.js sharpPart)
const _vLive = new Set();
export function liveV() { const now = performance.now(); for (const r of _vLive) if (now - r._liveT > 2500 || !r.root.parent) _vLive.delete(r); return _vLive; }
export function edgeAt(r, side, B, A) {
  const w = side === 'L' ? r.weaponL : r.weaponR, e = w?.userData?.edge; if (!e || !w.visible || !w.parent) return false;
  B.fromArray(e.b); A.fromArray(e.a); w.localToWorld(B); w.localToWorld(A); return true;
}
// ---------- round 23 (Roy: "clipping for the clothes, for every character and enemy, so the legs don't pass through") ----------
// A robe, a long chiton or a skirt wound round the hips is a cylinder hung from the waist (cast.js robe, wrapSkirt).
// clothFit gives it its own geometry with rings down its length; fitRobes then pushes each ring out, column by column,
// just far enough to clear the thighs, knees, shins and feet in whatever pose the rig is in. The cloth hangs in a
// straight line from the waist (which never moves) to the furthest point it has to clear and falls straight on from
// there, the way cloth tents over a knee; neighbouring columns stay within a step of each other so it bulges instead of
// splitting; out at once, back slowly. A hem band or key border on it (follow) takes its last ring's shape.
const ROBE_ROWS = 6;
export function clothFit(r, m, follow) {
  if (!r || !m?.geometry?.parameters) return m;
  const q = m.geometry.parameters, geo = new THREE.CylinderGeometry(q.radiusTop, q.radiusBottom, q.height, LOD.cap ? Math.max(8, q.radialSegments) : Math.max(16, q.radialSegments), follow ? 1 : ROBE_ROWS, !!q.openEnded);
  geo.computeBoundingSphere(); geo.boundingSphere.radius += .6; // (pushed out, it still must not be culled)
  for (const c of m.children) if (c.userData.outline && c.geometry === m.geometry) c.geometry = geo; // (an outline shares its mesh's geometry)
  m.geometry = geo;
  const p = geo.attributes.position, n = geo.parameters.radialSegments, rest = Float32Array.from(p.array), col = new Int16Array(p.count), row = new Int16Array(p.count), rr = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), rad = Math.hypot(x, z); rr[i] = rad;
    col[i] = rad < 1e-4 ? -1 : ((Math.round(Math.atan2(x, z) / (Math.PI * 2) * n) % n) + n) % n;
    row[i] = follow ? 0 : Math.round((q.height / 2 - p.getY(i)) / q.height * ROBE_ROWS);
  }
  const C = { m, n, h: q.height, rt: q.radiusTop, rb: q.radiusBottom, rest, col, row, rr, R: new Float32Array(n * (ROBE_ROWS + 1)), key: '' };
  m.userData.cloth = C;
  if (follow?.userData.cloth) { C.of = follow.userData.cloth; (C.of.fol ||= []).push(C); }
  else { (r.robes ||= []).push(C); if (q.height > .6) r.longRobe = true; }
  return m;
}
const _rbs = [];
function fitRobes(r, dt) {
  if (!r.legL || !r.kneeL) return;
  let key = '';
  for (const o of [r.legL, r.legR, r.kneeL, r.kneeR, r.torso, r.hip]) key += o.rotation.x.toFixed(3) + o.rotation.z.toFixed(3) + o.rotation.y.toFixed(2);
  let np = 0;
  for (const [Lg, K] of [[r.legL, r.kneeL], [r.legR, r.kneeR]]) {
    Lg.updateMatrix(); K.updateMatrix(); _lm.multiplyMatrices(Lg.matrix, K.matrix);
    for (const q of LEGPTS) { _pv.set(q[0], q[1], q[2]).applyMatrix4(q[4] ? _lm : Lg.matrix); (_rbs[np++] ||= new THREE.Vector4()).set(_pv.x, _pv.y, _pv.z, q[3] + .03); }
  }
  const fall = 1 - Math.exp(-dt * 6);
  for (const C of r.robes) {
    const m = C.m; if (!m.parent || !m.visible) continue;
    if (C.key === key && !C.moving) continue; C.key = key;
    // the leg spheres in the robe's own (unscaled) space: up the local matrices to the hip, then inverted
    _fm.identity(); for (let o = m; o && o !== r.hip; o = o.parent) { o.updateMatrix(); _fm.premultiply(o.matrix); }
    _fi.copy(_fm).invert();
    const sc = 1 / Math.min(m.scale.x, m.scale.z), n = C.n, NR = ROBE_ROWS, yt = C.h / 2, R = C.R, T = (C.T ||= new Float32Array(R.length));
    const rho = (y) => C.rb + (C.rt - C.rb) * (y + yt) / C.h; // the rest radius at height y
    for (let c = 0; c < n; c++) for (let i = 0; i <= NR; i++) T[c * (NR + 1) + i] = rho(yt - i * C.h / NR);
    for (let j = 0; j < np; j++) {
      if (C.h < .7 && LEGPTS[j % LEGPTS.length][4]) continue; // a knee-length tunic covers the thighs: the shins and feet go out under it
      const v = _rbs[j]; _pv.set(v.x, v.y, v.z).applyMatrix4(_fi); const w0 = v.w * sc, ys = _pv.y;
      if (ys > yt || ys < -yt - .02) continue; // (a foot out under the hem of a short tunic pushes nothing)
      const span = yt - ys, push = (c, ns) => {
        if (ns <= rho(Math.max(-yt, ys))) return;
        for (let i = 0; i <= NR; i++) {
          const y = yt - i * C.h / NR, k = c * (NR + 1) + i;
          const need = y >= ys ? (span > .02 ? C.rt + (ns - C.rt) * (yt - y) / span : C.rt) : ns; // tented from the waist down to it, straight below
          if (need > T[k]) T[k] = need;
        }
      };
      for (let c = 0; c < n; c++) { // a column whose line runs into the sphere goes out past it
        const a = c / n * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a), lat = Math.abs(_pv.x * dz - _pv.z * dx), pr = _pv.x * dx + _pv.z * dz;
        if (lat < w0 && pr > 0) push(c, pr + Math.sqrt(w0 * w0 - lat * lat) + .012);
      }
      // and the two either side of it go out so the flat between them passes outside it too (a knee between two columns)
      const D = Math.hypot(_pv.x, _pv.z) + w0 + .012, ph = Math.atan2(_pv.x, _pv.z), st = Math.PI * 2 / n, c0 = Math.floor(((ph % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / st);
      const need = D * Math.cos(ph - (c0 + .5) * st) / Math.cos(st / 2); push(c0 % n, need); push((c0 + 1) % n, need);
    }
    for (let pass = 0; pass < 2; pass++) for (let c = 0; c < 2 * n; c++) for (let i = 0; i <= NR; i++) { // a step at most between columns
      const a = (c % n) * (NR + 1) + i, b = ((c + 1) % n) * (NR + 1) + i, a2 = ((2 * n - c) % n) * (NR + 1) + i, b2 = ((2 * n - c - 1) % n) * (NR + 1) + i;
      if (T[b] < T[a] - .05) T[b] = T[a] - .05; if (T[b2] < T[a2] - .05) T[b2] = T[a2] - .05;
    }
    let moving = false;
    for (let k = 0; k < R.length; k++) { const t = T[k]; if (!R[k] || t >= R[k]) R[k] = t; else { R[k] += (t - R[k]) * fall; if (R[k] - t > .002) moving = true; } }
    C.moving = moving;
    const p = m.geometry.attributes.position, A = p.array;
    for (let i = 0; i < p.count; i++) {
      const c = C.col[i]; if (c < 0) continue;
      const rw = C.row[i], k0 = C.rest[i * 3 + 1], s = R[c * (NR + 1) + rw] / Math.max(1e-4, rho(k0));
      A[i * 3] = C.rest[i * 3] * s; A[i * 3 + 2] = C.rest[i * 3 + 2] * s;
    }
    p.needsUpdate = true;
    if (C.fol) for (const F of C.fol) { // a hem band: each vertex out as far as the robe's last ring at its angle
      const fp = F.m.geometry.attributes.position, FA = fp.array, dy = (F.m.rotation.y || 0) - (m.rotation.y || 0);
      for (let i = 0; i < fp.count; i++) {
        if (F.col[i] < 0) continue;
        const a = Math.atan2(F.rest[i * 3], F.rest[i * 3 + 2]) + dy, c = (((Math.round(a / (Math.PI * 2) * n)) % n) + n) % n, s = R[c * (NR + 1) + NR] / C.rb;
        FA[i * 3] = F.rest[i * 3] * s; FA[i * 3 + 2] = F.rest[i * 3 + 2] * s;
      }
      fp.needsUpdate = true;
    }
  }
}
// in a long robe nobody runs with their knees up at their chest: the stride is held to what the cloth allows (a thigh
// at most ~.5 rad off the vertical, ~.75 in a knee-length tunic, the knee bent no more than ~.7), so the robe moves with
// the legs instead of ballooning
function robeStride(r, m0) {
  const lim = (v, m) => Math.sign(v) * m * Math.tanh(Math.abs(v) / m);
  for (const L of [r.legL, r.legR]) L.rotation.x = lim(L.rotation.x, m0);
  for (const K of [r.kneeL, r.kneeR]) if (K.rotation.x > 0) K.rotation.x = lim(K.rotation.x, .7);
}
// a cape, a cloak or a fall of cloth down the back (cast.js cape, drape) hung from a hinge pivot at the shoulders: it
// swings back off her legs and arms like a skirt flap does (fitFlaps), out at once and back slowly
export function capeFlap(r, pv, len, w) {
  if (!r || !pv) return pv;
  (r.flaps ||= []).push({ pv, a: Math.PI, len, tilt: pv.rotation.x, hw: w / 2, th: pv.rotation.x, sgn: 1, arms: true });
  r._flapArms = true; return pv;
}
// the home dress in a roll: each panel's upper half, then its lower half, swings out along the ground just far enough
// to keep out of it (fitDress's own floor assumes she is upright), and failing that draws up short
function groundDress(r, rt) {
  const D = DRESS, P = r.dress.userData.panels, bunch = 1 - .5 * win(rt, .03, .2, .76, .96); // tucked, the hem gathers up round her
  r.root.updateMatrixWorld(true);
  const g = r.root.matrixWorld.elements[13] + .045;
  const at = (o, y, hw) => { // the lower of the two corners (a wide hem tilts with her)
    o.updateMatrixWorld(true); const e = o.matrixWorld.elements, cy = e[5] * y + e[13], dy = Math.abs(e[1] * hw);
    return cy - dy;
  };
  for (const p of P) {
    const t = p.th1 - p.low.rotation.x, len = p.lo.scale.y * bunch;
    p.lo.scale.y = len; p.band.position.y = .035 - len;
    const knee = (th) => { p.top.rotation.x = -th; p.low.rotation.x = th - t; return at(p.top, -D.l1, p.up.scale.x / 2); };
    let best = p.th1, by = knee(best);
    if (by < g) {
      for (let a = p.th1 + .15; a <= 1.6; a += .15) { const y = knee(a); if (y > by) { by = y; best = a; } if (y >= g) break; }
      p.th1 = best; knee(best);
      if (by < g) { const e = p.top.matrixWorld.elements, hy = e[13] - Math.abs(e[1] * p.up.scale.x / 2), k = hy > g && hy - by > 1e-3 ? Math.max(.06, (hy - g) / (hy - by)) : .06; p.up.scale.y = D.l1 * k; p.low.position.y = -D.l1 * k; }
    }
    const hem = (a) => { p.low.rotation.x = p.th1 - a; return at(p.low, -len, p.band.scale.x / 2); };
    let bt = t, hy2 = hem(bt);
    if (hy2 >= g) continue;
    for (let a = t + .15; a <= 1.6; a += .15) { const y = hem(a); if (y > hy2) { hy2 = y; bt = a; } if (y >= g) break; }
    p.th2 = bt; hem(bt);
    if (hy2 < g) { const e = p.low.matrixWorld.elements, ky = e[13] - Math.abs(e[1] * p.band.scale.x / 2), k = ky > g && ky - hy2 > 1e-3 ? Math.max(.06, (ky - g) / (ky - hy2)) : .06; p.lo.scale.y = len * k; p.band.position.y = .035 - len * k; p.low.updateMatrixWorld(true); }
  }
}
// a roll brings her skirts down onto the ground: a flap whose hem would pass into it swings out along it (the least it
// takes), and when no swing clears it, bunches up so the hem rests on the ground
const _gfp = new THREE.Vector3();
function groundFlaps(r) {
  r.root.updateMatrixWorld(true);
  const g = r.root.matrixWorld.elements[13] + .045; // (the hem's own width: its corners reach a little lower)
  const tip = (f, th) => { f.pv.rotation.x = (f.sgn ?? -1) * th; f.pv.updateMatrixWorld(true); return _gfp.set(0, -f.len, 0).applyMatrix4(f.pv.matrixWorld).y; };
  for (const list of [r.flaps, r.gearFlaps, r.backFlaps]) if (list) for (const f of list) {
    if (!f.pv.parent) continue;
    f.pv.scale.y = 1;
    let best = f.th, by = tip(f, best);
    if (by >= g) continue;
    for (let t = f.th + .15; t <= 1.6; t += .15) { const y = tip(f, t); if (y > by) { by = y; best = t; } if (y >= g) break; }
    f.th = best; tip(f, best);
    if (by < g) { const hy = f.pv.matrixWorld.elements[13]; f.pv.scale.y = hy > g && hy - by > 1e-3 ? Math.max(.25, (hy - g) / (hy - by)) : .25; f.pv.updateMatrixWorld(true); }
  }
}

// V's outfit: 'home' (chiton, no weapon or shield) until Rain is taken, then 'war'
export function setOutfit(r, kind) {
  if (!r?.warParts) return;
  const home = kind === 'home'; r.unarmed = home;
  const show = (o, v) => { if (!o) return; o.visible = v; if (o.userData?.outlineMesh) o.userData.outlineMesh.visible = v; };
  for (const o of r.warParts) show(o, !home);
  for (const o of r.homeParts) show(o, home);
  for (const k of ['weaponR', 'weaponL', 'shieldL', 'sword']) if (r[k]) r[k].visible = !home;
  // her own shield: in hand for a sword or spear that brings none of its own, on her back for everything else (see equipWeapon)
  if (r.gearShieldOn) { const s = r.shield || r.shieldBack; if (r.shieldBase) r.shieldBase.visible = false; if (s) s.visible = !home && !(s === r.shieldBack && r.wings?.length); } // (round 23: the worn shield, see placeShield)
  else if (r.shieldBase !== undefined ? r.shieldBase : r.shield) (r.shieldBase ?? r.shield).visible = !home && !r.shieldL && !(r.shieldBack && r.wings?.length);
  if (!home && r.dressKind && r.dressKind !== 'war') setDress(r, r.dressKind); // (round 30: the dress she chose stays on when a scene arms her again)
}
// round 30: which dress she wears on the road (her body-slot outfit, weapons.js OUTFITS): 'war', the black battle dress,
// or 'home', her own cream chiton. Only the clothes change: weapons, shield and worn gear stay as they are. Under the
// prologue's home clothes (setOutfit 'home', unarmed) the choice waits for the road
export function setDress(r, kind) {
  if (!r?.warParts) return;
  r.dressKind = kind === 'home' || DRESS_TONES[kind] ? kind : 'war';
  if (r.unarmed) return;
  const home = r.dressKind !== 'war', show = (o, v) => { if (!o) return; o.visible = v; if (o.userData?.outlineMesh) o.userData.outlineMesh.visible = v; };
  for (const o of r.warParts) if (!/^gearSock/.test(o.name || '')) show(o, !home); // (the gear sockets carry what she wears over it)
  for (const o of r.homeParts) show(o, home);
  toneDress(r, r.dressKind); // (the war dress and the white one: the white materials back)
}
// BETA ONLINE (Roy 29.10: "no Dress / Battle dress; three outfits, all super simple: the white dress, a dress of light-brown
// leather, a dress of dark cloth", the same for a man): 'leather' and 'dark' are the white one's own parts (r.homeParts: the
// dress, the sleeves, the belt, the himation, the brooch) in one tone: each material copied once with every colour taken
// to the tone at its own brightness (the cream to the tone itself, the key at the hem and the himation a shade or two
// darker), so the cut, the cloth's physics and the folds stay the white one's. 'home' puts the white materials back.
export const DRESS_TONES = { leather: '#b4865a', dark: '#3a3646' };
const DRESS_REF = .895, dressCache = new Map(); // (the brightness of the white dress's cream, #efe4cc)
const hexRGB = (h) => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
function retone(c, T, out, i) { const f = (.299 * c[0] + .587 * c[1] + .114 * c[2]) / 255 / DRESS_REF, w = Math.max(0, f - 1) * .6; for (let k = 0; k < 3; k++) out[i + k] = Math.min(255, Math.round(T[k] * Math.min(f, 1) + (255 - T[k]) * w)); }
function retoneImage(img, T, tint) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); const im = x.getImageData(0, 0, c.width, c.height), d = im.data, p = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) { p[0] = d[i] * tint[0]; p[1] = d[i + 1] * tint[1]; p[2] = d[i + 2] * tint[2]; retone(p, T, d, i); }
  x.putImageData(im, 0, 0); return c;
}
function dressMat(m, kind) {
  if (m.pxv) m = Object.getPrototypeOf(m); // (a pixel-shaded twin, render.js pxTwin: the material it stands for, so the toned copy is made once per material, however it is worn; the twin of the copy is made where it is drawn)
  const key = m.uuid + kind; if (dressCache.has(key)) return dressCache.get(key);
  const T = hexRGB(DRESS_TONES[kind]), out = m.clone(), img = m.map?.image;
  if (img?.width && m.color) { // a texture: its texels toned (under the material's own colour), the colour then white
    try {
      const tint = [m.color.r, m.color.g, m.color.b], t = m.map.clone(); t.source = new THREE.Source(retoneImage(img, T, tint));
      t.mipmaps = (m.map.mipmaps || []).map((mm) => (mm?.width ? retoneImage(mm, T, tint) : mm)); if (t.mipmaps.length) t.mipmaps[0] = t.image; t.needsUpdate = true;
      out.map = t; out.color.set('#ffffff');
    } catch { out.color.set(DRESS_TONES[kind]); }
  } else if (m.color) { const c = [m.color.r * 255, m.color.g * 255, m.color.b * 255], o = [0, 0, 0]; retone(c, T, o, 0); out.color.setRGB(o[0] / 255, o[1] / 255, o[2] / 255); }
  dressCache.set(key, out); return out;
}
function toneDress(r, kind) {
  const tone = !!DRESS_TONES[kind]; if (!tone && !r._toned) return; r._toned = tone; // (Val in the campaign never gets here)
  for (const p of [...r.homeParts, ...(r.toneParts || [])]) p.traverse((o) => { // (toneParts: a rig's own parts the white one shows as cloth, js/online/heroes.js)
    if (!o.isMesh || o.userData.outline || o.userData.rbProxy || Array.isArray(o.material)) return;
    const m0 = (o.userData.dm0 ??= o.material); o.material = tone ? dressMat(m0, kind) : m0;
  });
}

// pixel art (round 16): the story makers below wear the story cast's textures from cast.js (storyTex: a story or kit kind
// in one colour); spx gives mesh opts (plain colour under ?art=off), sdress re-dresses a part already made (t: turn a cylinder)
const spx = (kind, col, o) => PXART ? { ...o, material: C.storyTex(kind, col) } : o;
const sdress = (m, kind, col, t) => { if (PXART && m) { m.material = C.storyTex(kind, col); if (t) m.rotation.y += Math.PI; } return m; };
const rigPart = (p, f) => p.children.find((o) => o.isMesh && f(o.geometry.parameters || {})); // one of humanoid()'s own parts
// round 23 (Roy: "give him long hair, so he's a little easier to recognise"): his curls grow out into a dark mane past
// the shoulders, side locks framing the face and a heavy fall down his back, the same in the fisherman's clothes and
// the gods'. It is the one shape that reads in silhouette (the dark Olympus hall of the opening leans on it)
function rainHair(r, col) {
  C.locks(r, col, .6, 3, true); // the side locks framing his face, to the shoulders
  const b = C.longHair(r, col, .6, 1.02, { front: false }); b.position.z -= .02; // the fall down his back, to the shoulder blades
  for (const [x, l] of [[-.1, .2], [0, .26], [.1, .2]]) { const t = tcyl(r.head, .06, .015, l, col, x, -.1 - .3 - l / 2 + .04, -.15, 5, C.kx('locks', col)); t.rotation.z = -x * .8; } // its ends, in locks
  for (const sx of [-1, 1]) { const l = tcyl(r.head, .055, .03, .42, col, sx * .2, -.06, -.06, 5, C.kx('locks', col)); l.rotation.z = sx * .16; l.rotation.x = .12; } // a lock over each shoulder
}
export function makeRain(o = {}) { // V's fisherman: dark curls, short beard, cream chiton with a sea-blue border and mantle
  const SK = '#d9a47e', HAIR = '#2c1d14', CH = '#e8dfc8', SEA = '#2f6f9a';
  const r = humanoid({ skin: SK, top: o.god ? '#f4f1ea' : CH, bottom: o.god ? '#f4f1ea' : CH, legs: SK, boots: SK, sleeve: null, eyes: '#3a5a7a', lips: '#9a5a4a', brow: '#2a1a10', browTilt: .12 }); r.npc = true; // round 33 (NPC): shaped body (cast.js sculptNpc)
  C.curls(r, HAIR, { n: 9, s: .062, h: .8 });
  rainHair(r, HAIR);
  C.beard(r, '#3b281b', .07, .95);
  // round 22 (Roy): at the very start he stands on Olympus in the clothes of the gods. The same face and curls, but a
  // long white chiton to the ankles with a gold hem and a sea-blue key, a deep sea-blue himation bordered in gold, a gold
  // laurel, gold at the arms and a gold-strapped pair of high sandals; nothing of the fisherman (no knife, no net rope)
  if (o.god) {
    const WH = '#f4f1ea', GOLD = '#e2b23c', DEEP = '#1f4f86';
    C.chiton(r, WH, { y1: -.8, trim: GOLD, key: SEA });
    C.neckTrim(r, GOLD);
    C.drape(r, DEEP, GOLD, -.74, .22, .38);
    C.belt(r, GOLD, .14, '#f4d060', .06);
    C.wreath(r, GOLD, .33, null, '#f4d060');
    C.armband(r, GOLD); C.bracer(r, GOLD, 'LR', .17);
    C.sandals(r, '#8a5a2a', GOLD, true);
    ball(r.torso, .04, '#e8f4ff', -.2, .58, .13, 0, { basic: true, noShadow: true }); // a pale sea-glass brooch on the himation
    r.god = true;
    return finish(C.bake(r));
  }
  C.chiton(r, CH, { y1: -.44, trim: SEA, key: '#e8e0cc' });
  C.neckTrim(r, SEA);
  C.drape(r, SEA, '#d8b060', -.74, .18, .36);
  C.belt(r, '#6a4a30', .14, '#c8a050', .06);
  const kn = box(r.torso, .05, .2, .04, '#4a3020', .17, .02, .12, spx('sheath', '#4a3020')); kn.rotation.z = .2; // knife in its sheath
  if (PXART) { box(r.torso, .028, .07, .028, '#3a2618', .143, .152, .12, spx('grip', '#5a3a22')).rotation.z = .2; box(r.torso, .06, .014, .036, '#9aa0a8', .149, .12, .12, spx('gold', '#9aa0a8', { noShadow: true })).rotation.z = .2; } // its corded handle and guard above the sheath
  C.necklace(r, '#c8b090', '#f0e6d6');
  C.sandals(r, '#4a3020', '#6a4428', true);
  // round 33 finishes: a worn leather bracer on his net hand and a plain bronze pin where the mantle crosses his shoulder
  C.bracer(r, '#5a3c26', 'L', .12);
  if (PXART) { const pn = tcyl(r.torso, .035, .035, .02, '#b8863c', -.19, .6, .12, 10, spx('gold', '#b8863c', { noShadow: true })); pn.rotation.x = PI / 2 - .3; }
  // coil of net rope on the hip: a solid wound coil (an open ring here read as a hole through his body)
  const rope = sdress(C.torus(r.torso, .13, .035, '#b8a074', -.25, .05, -.06), 'rope', '#b8a074'); rope.rotation.y = PI / 2;
  const core = tcyl(r.torso, .11, .11, .07, '#9a845a', -.25, .05, -.06, 10); core.rotation.z = PI / 2;
  if (PXART) { const e = C.storyTex('coilEnd', '#b8a074'); core.material = [C.storyTex('grip', '#9a845a'), e, e]; } // the wound turns on its ends
  return finish(C.bake(r));
}

export function makePhilon() { // the old wanderer at the camp: bald, grey beard, brown travelling cloak, hat slung on his back
  const SK = '#c99b78', TUN = '#8a7656', CL = '#5b4636', HAIR = '#c8c4bc';
  const r = humanoid({ skin: SK, top: TUN, bottom: TUN, legs: SK, boots: '#4a3020', sleeve: TUN, brow: '#d8d4ca', eyes: '#3a4a5a', lips: '#7a4a40', old: true }); r.npc = true;
  C.baldFringe(r, HAIR, SK);
  C.beard(r, '#d4d0c6', .3, 1.05, { mouth: '#5a3a30' });
  ball(r.head, .06, '#d4d0c6', 0, -.17, .13, 0, { noShadow: true });
  C.chiton(r, TUN, { y1: -.52, trim: '#5a4a32' });
  C.cape(r, CL, 1.15, .52, { flare: .1 });
  const hd = ball(r.torso, .2, CL, 0, .64, -.14, 1, spx('ball', CL)); hd.scale.set(1.25, .55, 1); // the hood, down
  if (PXART) for (const sx of [-1, 1]) ball(r.torso, .026, '#7a5a34', sx * .14, .62, .1, 0, spx('gem', '#7a5a34', { noShadow: true })); // round 33: the cloak's two wooden toggles
  C.drape(r, CL, '#3e3024', -.74, .2, .36);
  const hat = pivot(r.torso, 0, .38, -.3); hat.rotation.x = 1.35; // petasos slung on its cord
  const hb = tcyl(hat, .3, .3, .025, '#b8985a', 0, 0, 0, PXART ? 16 : 12); sdress(tcyl(hat, .12, .15, .11, '#b8985a', 0, -.06, 0, PXART ? 12 : 9), 'straw', '#b8985a', true);
  if (PXART) { const t = C.storyTex('brim', '#b8985a'); hb.material = [C.storyTex('straw', '#b8985a'), t, t]; } // plaited straw, rings on the brim
  C.strap(r.torso, [-.2, .62, .1], [-.05, .38, -.29], .02, .02, '#4a3020', { noShadow: true });
  C.belt(r, '#7a6440', .13, null, .05);
  C.strap(r.torso, [.22, .62, .1], [-.2, .05, .17], .045, .03, '#5a3e24'); // satchel strap
  const bag = box(r.torso, .2, .2, .08, '#6a4a2c', -.24, -.02, .12); bag.rotation.y = -.5;
  if (PXART) { const l = C.storyTex('strap', '#6a4a2c'); bag.material = [l, l, l, l, C.storyTex('satchel', '#6a4a2c'), l]; } // flap, buckle and pocket on its face
  C.boots(r, '#4a3020');
  for (const K of [r.kneeL, r.kneeR]) if (PXART) sdress(tcyl(K, .087, .087, .2, '#8a7656', 0, -.13, 0, 8, { noShadow: true }), 'legWrap', '#8a7656', true); // pixel art: one cut-out wound puttee
    else for (let i = 0; i < 3; i++) tcyl(K, .084, .084, .02, '#8a7656', 0, -.06 - i * .07, 0, 6, { noShadow: true });
  const staff = new THREE.Group(); r.handR.add(staff);
  C.shaft(tcyl(staff, .035, .04, 2, '#6b4e2e', 0, .25, .05, 5), '#6b4e2e', 2);
  const gd = ball(staff, .07, '#b89858', .06, .95, .05, PXART ? 1 : 0, spx('gourd', '#b89858')); gd.scale.set(1, 1.3, 1); // water gourd
  r.staff = staff;
  return finish(C.bake(r));
}

export function makePriestess() { // temple priestess: white chiton with gold key border, purple veil, laurel, gold libation bowl
  const SK = '#cfa180', WH = '#f2ede2', VE = '#5a2a6e', GOLD = '#d8a838';
  const r = humanoid({ skin: SK, top: WH, bottom: WH, legs: SK, boots: SK, sleeve: WH, brow: PXFACE ? '#a9a6a0' : '#6a645c', eyes: '#5a4a3a', liner: '#4a3428', lips: '#a0605a' }); r.npc = true; // px face: slim brows in her silver hair's colour
  C.lashes(r);
  C.hairCap(r, '#a9a6a0', { h: .86 });
  C.locks(r, '#b4b0aa', .5, 1, true);
  const vl = C.veil(r, VE, GOLD, false); if (PXFACE) { vl.position.y += .03; vl.position.z -= .01; } // the veil's edge just above the brows, so hdSettle can show them (as on the other px faces)
  C.wreath(r, '#5a8a3a', .38, null, '#3e6a2a', .25);
  C.chiton(r, WH, { trim: GOLD, key: VE });
  C.bust(r, WH); C.neckTrim(r, GOLD); C.sleeveTrim(r, GOLD);
  C.drape(r, VE, GOLD, .72, .22, .34);
  C.belt(r, GOLD, .3, null, .035, .2);
  C.necklace(r, GOLD, '#b8372f'); C.earrings(r); C.bangles(r);
  if (PXART) { // round 33 finishes: the chiton pinned at each shoulder by a gold disc fibula, a gold pin through her hair
    for (const sx of [-1, 1]) { const f = tcyl(r.torso, .03, .03, .016, GOLD, sx * .19, .64, .06, 10, spx('gold', GOLD, { noShadow: true })); f.rotation.x = PI / 2 - .5; ball(r.torso, .012, '#b8372f', sx * .19, .645, .07, 0, spx('gem', '#b8372f', { noShadow: true })); }
    const hp = tcyl(r.head, .007, .007, .2, GOLD, .13, .33, -.08, 5, spx('gold', GOLD, { noShadow: true })); hp.rotation.z = -1.1; ball(r.head, .016, '#f0d070', .21, .37, -.08, 0, spx('gem', '#f0d070', { noShadow: true }));
  }
  C.sandals(r, '#8a6a3a', GOLD);
  const bowl = C.hold(r, 'L', r.torso, -.18, .26, .32); // gold phiale held out
  const ph = tcyl(bowl, .11, .05, .04, GOLD, 0, .05, 0, PXART ? 16 : 10); ball(bowl, .025, '#f0d070', 0, .07, 0, 0, spx('gem', '#f0d070', { noShadow: true }));
  if (PXART) { const g = C.storyTex('gold', GOLD); ph.material = [g, C.storyTex('phiale', GOLD), g]; } // lobes round the boss inside
  const br = new THREE.Group(); r.handR.add(br); br.position.set(0, -.04, .05); br.rotation.x = -.9; // laurel branch
  tcyl(br, .012, .014, .55, '#6a4a2a', 0, .2, 0, 4, spx('wood', '#6a4a2a'));
  for (let i = 0; i < 7; i++) { const lf = box(br, .07, .015, .035, i % 2 ? '#4a7a32' : '#6a9a3a', (i % 2 ? .04 : -.04), .2 + i * .045, 0, spx('leaf', i % 2 ? '#4a7a32' : '#6a9a3a', { noShadow: true })); lf.rotation.z = i % 2 ? .5 : -.5; }
  r.bowl = bowl; r.branch = br;
  return finish(C.bake(r));
}

// round 26 (Roy: "invest a bit more in the Dark Knight who abducts Roye"): Hades' dark knight, taller and heavier. A deep
// hood over a closed, beaked great-helm with two cold eye slits glowing under a heavy brow; a layered gorget; sculpted
// black plate whose every edge carries a thin cold rim line (unlit, so the shape still reads in the night scene); horned,
// layered pauldrons with skulls; clawed gauntlets, cuisses, spiked knee cops, ridged greaves, pointed sabatons; a skull
// buckle and skull trophies chained to the belt; a long tattered cape lined in old blood that flows with his walk; a
// long war-spear, leaf blade wrapped in the blue grave-flame (r.flame). Its own tick (models.js riderTick) gives him a
// slow, heavy stride (r.onStep(side) on each foot plant), a glowering chin-down stance, the cape and trophies swinging,
// the eyes' slow pulse (r.flare = 1 flares them) and r.glare (a world point, r.glareW 0..1) turns his head to it.
export function makeRider() {
  const BLK = '#0c0c10', BLK2 = '#15151b', PLATE = '#1c1c25', ASH = '#a2a2ac', BONE = '#c4c0b4', VOID = '#040406';
  const RIM = '#3e4558', RIM2 = '#6e7a98', LINE = '#220a0d'; // cold rim lines (unlit), the cape's old-blood lining
  const r = humanoid({ skin: '#09090c', top: BLK, bottom: '#0b0b0e', legs: BLK2, boots: '#08080b', sleeve: BLK2, faceless: true, scale: 1.24 });
  const ln = (p, w, h, d, x, y, z, col = RIM) => box(p, w, h, d, col, x, y, z, { basic: true, noShadow: true }); // a lit edge
  const ring = (p, rad, y, sz = .8, col = RIM, h = .012) => { const m = tcyl(p, rad, rad, h, col, 0, y, 0, 12, { basic: true, noShadow: true }); m.scale.z = sz; return m; };
  const glowM = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  // ---- the hood, deep and peaked, over a closed great-helm
  const HOOD = '#0a0a0d', H = (o) => spx('capelet', HOOD, o);
  r.skull.material = mat('#18181e');
  ball(r.head, .3, HOOD, 0, .24, -.09, 1, H()).scale.set(1.04, 1.13, 1.06);
  ball(r.head, .22, HOOD, 0, .41, .05, 1, H()).scale.set(1.18, .46, .86); // the hood's brow, shading the eyes
  for (const sx of [-1, 1]) ball(r.head, .135, HOOD, sx * .195, .16, .07, 1, H()).scale.set(.6, 1.85, 1.08);
  const pk = cone(r.head, .16, .4, HOOD, 0, .52, -.24, 6, H()); pk.rotation.x = -.75; // the peak falls back
  ball(r.head, .25, HOOD, 0, .03, -.15, 1, H()).scale.set(1.5, .7, 1.05); // falls onto the pauldrons, the gorget left clear in front
  const hr = C.torus(r.head, .205, .011, RIM, 0, .2, .17, { noShadow: true, arc: PI * 1.25, basic: true }); hr.rotation.z = -PI * .125; // the hood's opening, lit
  // the helm's face: two plates meeting in a beak, a heavy brow, breathing holes, a chin guard
  for (const sx of [-1, 1]) {
    const pg = pivot(r.head, sx * .058, .165, .185); pg.rotation.y = sx * .42;
    box(pg, .135, .27, .05, '#22222a', 0, 0, 0, spx('kvisor', '#22222a'));
    ln(pg, .012, .27, .012, sx * .065, 0, .026); // its outer edge
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box(pg, .014, .014, .01, VOID, -sx * .015 + sx * j * .03, -.06 - i * .028, .027, { noShadow: true });
    const sl = box(pg, .085, .02, .012, VOID, -sx * .004, .04, .024, { noShadow: true }); sl.rotation.z = sx * .2; // the slit
    r.eyeCore = box(pg, .07, .011, .01, '#cfe4ff', -sx * .004, .041, .029, { material: (r._eyeM ||= new THREE.MeshBasicMaterial({ color: '#cfe4ff' })), noShadow: true }); r.eyeCore.rotation.z = sx * .2;
    const hl = box(pg, .11, .034, .004, '#4c7cff', -sx * .006, .041, .034, { material: (r._haloM ||= glowM('#4c7cff', .35)), noShadow: true }); hl.rotation.z = sx * .2; // a soft halo round it
  }
  ln(r.head, .014, .28, .014, 0, .165, .216, RIM2); // the beak's ridge
  const brow = box(r.head, .29, .05, .075, PLATE, 0, .245, .18, spx('kdome', PLATE)); brow.rotation.x = .3;
  ln(r.head, .27, .01, .012, 0, .226, .214, RIM2);
  box(r.head, .2, .055, .06, PLATE, 0, .035, .165, spx('kdome', PLATE)); ln(r.head, .19, .01, .012, 0, .008, .196); // chin guard
  r.eyeHalo = r._haloM; r.eyeMat = r._eyeM;
  // ---- the gorget: three lames round the throat
  for (let i = 0; i < 3; i++) { const g0 = tcyl(r.torso, .14 + i * .025, .165 + i * .025, .06, i % 2 ? PLATE : BLK2, 0, .69 - i * .045, 0, 10, spx('klame', BLK2)); g0.scale.z = .85; } ring(r.torso, .217, .571, .85);
  // ---- breastplate: layered, ridged, a skull on it; plated belly lames
  const bp = tcyl(r.torso, .285, .225, .38, BLK2, 0, .4, .0, PXART ? 12 : 8, spx('kplate', BLK2)); bp.scale.z = .82; if (PXART) bp.rotation.y = PI;
  ring(r.torso, .287, .59, .82, RIM2, .014);
  for (const sx of [-1, 1]) { // pectoral plates over it, their lower edges lit, and the plate seams
    const pp = box(r.torso, .2, .15, .05, PLATE, sx * .11, .5, .205, spx('kdome', PLATE)); pp.rotation.set(-.2, sx * .3, sx * .12);
    const pe = ln(r.torso, .2, .012, .012, sx * .112, .427, .225); pe.rotation.set(0, sx * .3, sx * .12);
    const sm = ln(r.torso, .012, .26, .012, sx * .19, .37, .2); sm.rotation.z = sx * .2;
  }
  for (let i = 0; i < 3; i++) { const l = tcyl(r.torso, .238 - i * .006, .23 - i * .006, .07, i % 2 ? BLK2 : BLK, 0, .2 - i * .065, 0, 8, spx('klame', BLK)); l.scale.z = .8; } ring(r.torso, .226, .036, .8);
  C.pxSkull(skull(r.torso, 1.5, BONE, VOID), BONE).position.set(0, .36, .235);
  // ---- pauldrons: four lames each, lit rims, a crown of swept-back horns, a skull
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const pa = ball(r.torso, .188 - i * .016, i % 2 ? BLK2 : PLATE, sx * (.33 + i * .016), .65 - i * .058, 0, 1, spx('kdome', BLK)); pa.scale.set(1.14, .56, 1.14);
      if (i % 3) continue; const ed = C.torus(r.torso, .184 - i * .016, .007, i ? RIM : RIM2, sx * (.33 + i * .016), .63 - i * .058, 0, { noShadow: true, basic: true }); ed.rotation.set(PI / 2, 0, 0); ed.scale.set(1.14, 1.14, 1);
    }
    for (const [z, h, lean] of [[.07, .2, -.2], [-.03, .28, -.45], [-.13, .2, -.7]]) { // horns, raked back
      const hn = cone(r.torso, .04, h, PLATE, sx * .39, .7 + h * .35, z, 5, spx('spike', '#3a3a46')); hn.rotation.set(lean, 0, -sx * .55);
    }
    const sk = C.pxSkull(skull(r.torso, .85, ASH, VOID), ASH); sk.position.set(sx * .4, .6, .16); sk.rotation.set(-.2, sx * .55, 0);
  }
  // ---- faulds and long tassets
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2; const t = box(r.torso, .125, .32, .035, i % 2 ? BLK : PLATE, Math.sin(a) * .255, -.2, Math.cos(a) * .215, spx('ktasset', BLK)); t.rotation.y = a; t.rotation.x = .14 * Math.cos(a);
    const e = ln(r.torso, .125, .012, .04, Math.sin(a) * .262, -.355, Math.cos(a) * .222); e.rotation.y = a;
  }
  // ---- the belt: a skull buckle, and skull trophies hung on chains at his hips
  const bt = tcyl(r.torso, .24, .24, .075, '#1a1a20', 0, .06, 0, 10, spx('klame', '#1a1a20')); bt.scale.z = .8; ring(r.torso, .242, .1, .8);
  box(r.torso, .1, .085, .02, PLATE, 0, .06, .195, spx('kdome', PLATE)); C.pxSkull(skull(r.torso, .62, ASH, VOID), ASH).position.set(0, .065, .208);
  r.trophies = [];
  for (const [a, s] of [[1.15, .7], [-1.25, .62], [2.2, .55]]) {
    const tp = pivot(r.torso, Math.sin(a) * .25, .03, Math.cos(a) * .205); tp.rotation.y = a; r.trophies.push(tp);
    for (let i = 0; i < 3; i++) box(tp, .016, .03, .01, '#3a3a44', 0, -.02 - i * .03, .02, { noShadow: true }).rotation.y = i % 2 ? PI / 2 : 0;
    C.pxSkull(skull(tp, s, BONE, VOID), BONE).position.set(0, -.14, .03);
  }
  // ---- arms: rerebraces, spiked couters, vambraces, clawed gauntlets
  for (const [A, E] of [[r.armL, r.elbowL], [r.armR, r.elbowR]]) {
    C.turn(tcyl(A, .082, .072, .2, PLATE, 0, -.15, 0, 8, spx('kgreave', PLATE))); 
    ball(E, .075, PLATE, 0, .01, -.02, 0, spx('kdome', PLATE));
    cone(E, .028, .13, PLATE, 0, .01, -.1, 4, spx('spike', '#3a3a46')).rotation.x = -PI / 2;
    C.turn(tcyl(E, .068, .062, .22, BLK2, 0, -.15, 0, 8, spx('bracer', BLK2))); ring(E, .064, -.255, 1);
    tcyl(E, .085, .064, .07, PLATE, 0, -.25, 0, 8, spx('kdome', PLATE)); // the gauntlet's flared cuff
    box(E, .1, .12, .11, BLK2, 0, -.335, .01, spx('kdome', BLK2));
    ln(E, .105, .012, .02, 0, -.37, .06, RIM2); // the knuckles
    for (let i = 0; i < 4; i++) cone(E, .011, .05, '#2a2a34', -.036 + i * .024, -.415, .045, 4, { noShadow: true }).rotation.x = PI; // claws
  }
  // ---- legs: cuisses, spiked knee cops, ridged greaves, pointed sabatons
  for (const L of [r.legL, r.legR]) C.turn(tcyl(L, .11, .092, .3, PLATE, 0, -.17, 0, 8, spx('kgreave', PLATE)));
  for (const K of [r.kneeL, r.kneeR]) {
    ball(K, .095, PLATE, 0, .01, .04, 0, spx('kdome', PLATE)); cone(K, .04, .12, PLATE, 0, .03, .13, 4, spx('spike', '#3a3a46')).rotation.x = PI / 2;
    tcyl(K, .094, .082, .26, BLK, 0, -.14, 0, PXART ? 10 : 7, spx('kgreave', BLK)).rotation.y = PXART ? PI : 0;
    ln(K, .012, .24, .012, 0, -.14, .093);
    box(K, .15, .075, .27, PLATE, 0, -.325, .055, spx('kdome', PLATE)); ln(K, .15, .012, .012, 0, -.29, .19, RIM2);
    const toe = cone(K, .05, .1, PLATE, 0, -.335, .22, 4, spx('spike', '#3a3a46')); toe.rotation.x = PI / 2; toe.scale.set(1.4, 1, .6);
  }
  if (PXART) { // the rig's own thighs and upper arms in the same plate
    for (const L of [r.legL, r.legR]) sdress(rigPart(L, (q) => q.radiusTop === .095), 'kgreave', BLK2, true);
    for (const A of [r.armL, r.armR]) sdress(rigPart(A, (q) => q.radiusTop === .068), 'kgreave', BLK2, true);
  }
  // ---- the cape: eight long strips in three hinged lengths, ragged at the hem, lined in old blood; the whole hangs off
  // a hinge that swings it clear of his legs and arms (capeFlap), and riderTick ripples each length and trails it as he walks
  const CL = 1.58, CW = .74, NC = 8, cp = pivot(r.torso, 0, .62, -.2); cp.rotation.x = .16; capeFlap(r, cp, CL, CW);
  for (const sx of [-1, 1]) { const s = ball(r.torso, .13, '#060608', sx * .25, .6, -.04, 0, spx('cape', '#060608')); s.scale.set(1.15, .6, 1.2); }
  r.capeCols = [];
  for (let i = 0; i < NC; i++) {
    const x = -CW / 2 + (i + .5) * CW / NC, col = [], ragged = ((i * 5) % 3) * .07 + (i % 2) * .04, c = i % 2 ? '#060608' : '#0b0b0f';
    let p = pivot(cp, x, 0, 0); p.rotation.z = x * .12;
    for (let j = 0; j < 3; j++) {
      const len = j < 2 ? CL / 3 : CL / 3 - ragged, last = j === 2;
      box(p, CW / NC + .018, len, .04, c, 0, -len / 2, 0, spx(last ? 'tatter' : 'cape', last ? '#16161c' : c));
      box(p, CW / NC + .004, len - .03, .01, LINE, 0, -len / 2 + .01, .024, { noShadow: true }); // the lining
      if (i === 0 || i === NC - 1) ln(p, .012, len - .02, .012, (i ? 1 : -1) * (CW / NC / 2 + .006), -len / 2, -.02); // its edges catch the light
      else if (i % 2 && j < 2) ln(p, .01, len * .9, .008, 0, -len / 2, -.022, '#262c3e'); // and the crown of each fold, faintly
      col.push(p);
      if (!last) p = pivot(p, 0, -len, 0);
    }
    r.capeCols.push(col);
  }
  // ---- the spear: a long dark shaft, a barbed iron collar, a leaf blade wrapped in the blue grave-flame
  const spear = new THREE.Group(); r.handR.add(spear);
  C.shaft(tcyl(spear, .03, .034, 2.5, '#26221f', 0, 0, .55, 6), '#26221f', 2.5).rotation.x = PI / 2;
  tcyl(spear, .05, .042, .1, PLATE, 0, 0, 1.76, 6, spx('gold', '#3a3a46')).rotation.x = PI / 2;
  for (const sx of [-1, 1]) { const b = cone(spear, .022, .14, PLATE, sx * .07, 0, 1.76, 4, spx('spike', '#3a3a46')); b.rotation.z = -sx * PI / 2; b.rotation.y = sx * .5; } // barbs
  C.pxSkull(skull(spear, .5, BONE, VOID), BONE).position.set(0, .045, 1.62);
  const bl = ball(spear, .08, '#2a2a34', 0, 0, 2.02, 0, spx('gold', '#4a4a56')); bl.scale.set(.75, .22, 3.1); // the leaf blade
  ln(spear, .008, .03, .4, 0, 0, 2.03, RIM2);
  cone(spear, .035, .05, PLATE, 0, 0, -.72, 4).rotation.x = -PI / 2; // the butt spike
  r.flame = cone(spear, .1, .5, '#5ab0ff', 0, 0, 2.02, 5, { material: glowM('#5ab0ff', .55) }); r.flame.rotation.x = PI / 2;
  cone(r.flame, .05, .34, '#bfe0ff', 0, -.03, 0, 5, { material: glowM('#bfe0ff', .5) });
  r.spear = spear;
  r.tick = riderTick; r.glowTick = riderGlow; r.glareW = 0; r.flare = 0;
  // round 33: the cape hangs on a rope (rope.js) down its middle: it swings, trails and settles by physics, every
  // column bent along it (fanned a little, each with its own ripple on top, riderCape)
  hangChain(r, r.capeCols[NC / 2 - 1], { end: [0, -CL / 3, 0], k: 55, damp: 5, air: .4, rad: .05, sec: 1, wake: true, after: riderCape });
  return finish(C.bake(r));
}
// the knight's own motion, after animateRig (story ticks chain it first). Offsets he adds are taken back off next frame
// (as far as animateRig's own easing has left them), so they never pile up and the story's poses stack on top unchanged.
const _rq = new THREE.Quaternion(), _rv = new THREE.Vector3(), _rf = new THREE.Vector3();
function riderTick(r, dt, st) {
  if (!(dt > 0)) return;
  const O = (r._off ||= {}), k = 1 - Math.pow(.0005, dt), kh = 1 - Math.pow(.02, dt), kd = 1 - Math.pow(.004, dt);
  const add = (o, p, key, v, keep) => { o[p] += v - (O[key] || 0) * keep; O[key] = v; };
  const mv = !!st.moving, spd = st.speed || 1;
  r._mk = (r._mk || 0) + ((mv ? 1 : 0) - (r._mk || 0)) * Math.min(1, dt * 6); const mk = r._mk;
  if (mv) r.phase -= dt * 10 * spd * .08; // a slower stride
  const s = Math.sin(r.phase), c = Math.cos(r.phase);
  if (mv && r._pc !== undefined && (c > 0) !== (r._pc > 0)) { r._sk = 1; r.onStep?.(c > 0 ? 'L' : 'R'); } // a foot comes down
  r._pc = c; r._sk = Math.max(0, (r._sk || 0) - dt * 4); const sk = r._sk * r._sk;
  // the stride: longer, the swinging leg's knee lifting, the body dropping onto each foot; arms heavy, swinging little
    if (!r._ext) { add(r.kneeL.rotation, 'x', 'kl', Math.max(0, -c) * .45 * mk, 1 - kd); add(r.kneeR.rotation, 'x', 'kr', Math.max(0, c) * .45 * mk, 1 - kd); }
  add(r.legL.rotation, 'z', 'lz', -.07 * (1 - mk), 1); add(r.legR.rotation, 'z', 'rz', .07 * (1 - mk), 1); // a wide stance standing
  r.hip.position.y -= .045 * sk * mk;
  add(r.torso.rotation, 'x', 'tx', (mv ? .06 + sk * .05 : -.04) * (mv ? mk : 1 - mk), 1 - k);
  add(r.torso.rotation, 'y', 'ty', -s * .07 * mk, 1 - k);
  add(r.armL.rotation, 'x', 'ax', s * .7 * .6 * .55 * mk, 1 - k); add(r.armR.rotation, 'x', 'bx', -s * .7 * .6 * .55 * mk, 1 - k);
  add(r.armL.rotation, 'z', 'az', -.11, 1 - k); add(r.armR.rotation, 'z', 'bz', .11, 1 - k); // arms out past the plate
  add(r.head.rotation, 'x', 'hx', .09 - .05 * mk, 1 - kh); // chin down, glowering
  // the glare: his head turns to r.glare (a world point), whatever it was looking at, and his shoulders a little after it
  r._gw = (r._gw || 0) + ((r.glare ? r.glareW ?? 1 : 0) - (r._gw || 0)) * Math.min(1, dt * 4);
  r.head.rotation.y -= (O.hy || 0) * (1 - kh); O.hy = 0; let gy = 0;
  if (r._gw > .01 && r.glare) {
    r.root.getWorldPosition(_rv); r.root.getWorldQuaternion(_rq); _rf.set(0, 0, 1).applyQuaternion(_rq);
    const d = wrap(Math.atan2(r.glare.x - _rv.x, r.glare.z - _rv.z) - Math.atan2(_rf.x, _rf.z));
    gy = -Math.max(-1.3, Math.min(1.3, d)); // (the rig is mirrored: its head turns the other way)
    O.hy = (gy * .8 - r.head.rotation.y) * r._gw; r.head.rotation.y += O.hy;
  }
  add(r.torso.rotation, 'y', 'gy', gy * .25 * r._gw, 1 - k);
  // the cape: each length ripples a little after the one above it, trails back as he walks, swings out on a turn
  r._ct = (r._ct || 0) + dt;
  const yaw = r.root.rotation.y, dy = r._yaw === undefined ? 0 : wrap(yaw - r._yaw); r._yaw = yaw;
  r._sw = (r._sw || 0) + (Math.max(-1, Math.min(1, dy / dt * .25)) - (r._sw || 0)) * Math.min(1, dt * 3);
  const t = r._ct; r._cw = { t, fl: mk * (.1 + .1 * Math.min(1.5, spd)), w: mv ? 4.5 : 1.3, mk, sk }; // (riderCape lays the cape after the physics)
  if (!r.ropes) riderCape(null, dt, r); // (no rope: a rig built before it, laid out as before)
  for (let i = 0; i < r.trophies.length; i++) { const p = r.trophies[i]; p.rotation.x = Math.sin(r.phase + i * 1.3) * .25 * mk + Math.sin(t * 1.4 + i) * .04 - sk * .15; p.rotation.z = Math.cos(r.phase * .5 + i) * .12 * mk; }
  riderGlow(r, dt);
}
// the cape after its rope has moved: every column bent along the rope (its hinge never closer in than capeFlap put the
// whole cape), then each length's own ripple, the fan and the swing of a turn on top
function riderCape(H, dt, r0) {
  const r = H ? H.r : r0, C = r._cw; if (!C) return;
  const { t, fl, w, mk, sk } = C, n = r.capeCols.length;
  for (let i = 0; i < n; i++) {
    const col = r.capeCols[i];
    if (H) { col[0].rotation.x = 0; bendChain(col, H.R, { lo: 0, hi: 1.25, side: .35, first: 'max' }); }
    else for (const p of col) p.rotation.set(0, 0, 0);
    for (let j = 0; j < 3; j++) {
      const p = col[j], wav = Math.sin(t * w + i * .8 - j * 1.1) * (.025 + .035 * j) * (1 + mk * .8);
      p.rotation.x += (j ? .015 : 0) + fl * (.06 + j * .12) + sk * mk * .05 * j + wav;
      p.rotation.y = 0; p.rotation.z = (H ? p.rotation.z * .6 : 0) + (j ? 0 : (i - (n - 1) / 2) * .015) + r._sw * .07 * (j + 1) + Math.sin(t * w * .7 + i * .55 - j * .9) * .015 * (j + 1);
    }
  }
}
// the eye slits' slow cold pulse; r.flare (set to 1) flares them and dies away
function riderGlow(r, dt) {
  r._gt = (r._gt || 0) + dt; r.flare = Math.max(0, (r.flare || 0) - dt * .6);
  const f = r.flare, p = .5 + .5 * Math.sin(r._gt * 1.7);
  if (r.eyeHalo) r.eyeHalo.opacity = Math.min(1, .26 + p * .14 + f * .6);
  if (r.eyeMat) r.eyeMat.color.setRGB(.72 + .28 * f, .84 + .16 * f, 1);
}
// a little bone skull facing +z (dark sockets), for armour and chariots
export function skull(parent, s = 1, bone = '#d8d4c8', hole = '#08080a') {
  const g = new THREE.Group(); parent.add(g);
  ball(g, .07 * s, bone, 0, .015 * s, 0, 1).scale.set(1, .95, .85);
  box(g, .07 * s, .035 * s, .05 * s, bone, 0, -.05 * s, .01 * s);
  for (const sx of [-1, 1]) box(g, .028 * s, .024 * s, .012, hole, sx * .025 * s, .008 * s, .058 * s, { noShadow: true });
  box(g, .012 * s, .02 * s, .012, hole, 0, -.022 * s, .06 * s, { noShadow: true });
  for (let i = -1; i <= 1; i++) box(g, .008 * s, .02 * s, .012, hole, i * .016 * s, -.055 * s, .037 * s, { noShadow: true });
  return g;
}

export function makeShade() {
  const r = humanoid({ skin: '#3e4866', top: '#2c3450', bottom: '#232a40', boots: '#1b2033', sleeve: '#2c3450', faceless: true });
  C.reDress(r, { '#2c3450': ['tunic', 'ball'], '#232a40': ['wrap'], '#1b2033': ['boot', null, 'strap'] }); // pixel art: a rotted tunic with rents, scuffed boots
  box(r.head, .05, .035, .02, '#9fe8ff', -.07, .2, .195, { basic: true });
  box(r.head, .05, .035, .02, '#9fe8ff', .07, .2, .195, { basic: true });
  const helm = ball(r.head, .22, '#6a604e', 0, .26, -.01, 1, spx('helm', '#6a604e')); helm.scale.set(1, .7, 1);
  cone(r.head, .04, .2, '#8a3a26', 0, .44, 0, 4, spx('crest', '#8a3a26'));
  C.turn(tcyl(r.torso, .22, .3, .3, '#262d44', 0, -.16, 0, PXART ? 12 : 8, spx('robeS', '#262d44')));
  const sw = sword(r.handR, '#8a5a3a', .62);
  r.sword = sw;
  return finish(r);
}

// Round 22 (Roy): RISE's risen dead (skills.js calls this). Every one the same dark blue and a little skeletal: a bare
// skull with dark sockets and a cold blue light in them, a row of teeth, ribs over a hollow dark chest, a spine down the
// back, bony shins, and grave rags of the same blue hanging from the shoulders and hips. The seed only varies height,
// rags, a hood, and what the hand holds (a notched sword, a broken spear or nothing); never the colour.
// Returns a humanoid rig (animateRig, finish) with r.risen = true, r.mats (its own materials, nothing shared) and
// r.fade(a) (0..1: rise in / sink away; outlines go with it).
export function makeRisen(seed = 0) {
  const R = C.rng(seed * 13 + 5), DB = '#1c2c5c', DK = '#0b1230', BN = '#3c5c9e', BL = '#5a7cc4', GL = '#7cd0ff', HOLE = '#04060e';
  const r = humanoid({ skin: DB, top: DK, bottom: DK, legs: DB, boots: DB, sleeve: DB, faceless: true, scale: .95 + R() * .12 });
  const { head: hd, torso: T } = r;
  // the skull: brow ridge, sockets with a glow, the nose hole, cheekbones, teeth on a narrow jaw
  box(hd, .3, .04, .06, BN, 0, .26, .16);
  for (const sx of [-1, 1]) {
    box(hd, .075, .065, .03, HOLE, sx * .07, .2, .182, { noShadow: true });
    ball(hd, .02, GL, sx * .07, .2, .196, 0, { basic: true, noShadow: true });
    box(hd, .06, .03, .05, BN, sx * .12, .13, .15, { noShadow: true }).rotation.y = sx * .5;
  }
  box(hd, .03, .045, .02, HOLE, 0, .14, .196, { noShadow: true });
  box(hd, .13, .035, .03, BL, 0, .075, .178, { noShadow: true });
  for (let i = -2; i <= 2; i++) box(hd, .006, .036, .01, HOLE, i * .024, .075, .194, { noShadow: true });
  box(hd, .16, .05, .14, DB, 0, .03, .1);
  if (R() < .45) { const h = ball(hd, .235, DK, 0, .25, -.04, 1); h.scale.set(1.02, .95, 1.08); } // a hood of grave cloth
  // ribs and breastbone over the dark chest, the spine down the back, a pelvis
  box(T, .035, .26, .03, BN, 0, .36, .17, { noShadow: true });
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) { const y = .49 - i * .07, b = box(T, .15 - i * .01, .026, .03, i % 2 ? BN : BL, sx * .085, y, .155 - i * .004, { noShadow: true }); b.rotation.z = sx * -.22; b.rotation.y = sx * .35; }
  for (let i = 0; i < 6; i++) box(T, .04, .04, .03, BN, 0, .55 - i * .085, -.16, { noShadow: true });
  box(T, .26, .07, .05, BN, 0, .03, .14, { noShadow: true });
  // bony shins and forearms laid over the limbs
  for (const K of [r.kneeL, r.kneeR]) { box(K, .04, .26, .04, BN, 0, -.15, .07, { noShadow: true }); ball(K, .055, BL, 0, 0, .05, 0, { noShadow: true }); }
  for (const E of [r.elbowL, r.elbowR]) box(E, .035, .24, .035, BN, 0, -.14, .05, { noShadow: true });
  // rags: strips from the shoulders and the hips, ragged lengths
  for (let i = 0; i < 9; i++) {
    const a = (i + R() * .5) / 9 * Math.PI * 2, len = .22 + R() * .3, f = pivot(T, Math.sin(a) * .22, R() < .5 ? .06 : .58, Math.cos(a) * .17);
    f.rotation.y = a; f.rotation.x = .12; box(f, .07 + R() * .05, len, .02, i % 3 ? DK : DB, 0, -len / 2, 0, { noShadow: true });
  }
  const arm = R();
  if (arm < .4) { r.sword = sword(r.handR, BL, .55 + R() * .15); r.sword.traverse((o) => { if (o.isMesh && o.material.color?.getHexString() !== BL.slice(1)) o.material = mat(o.position.z < .1 ? DK : BN); }); } // a notched blade, blue like the rest
  else if (arm < .7) { const sp = pivot(r.handR, 0, 0, 0); tcyl(sp, .025, .025, 1.3, DB, 0, 0, .3, 5).rotation.x = Math.PI / 2; const c = cone(sp, .05, .2, BL, 0, 0, 1.02, 4); c.rotation.x = Math.PI / 2; r.held = sp; }
  finish(r);
  // its own materials, so each one can fade on its own
  const mats = [], ols = [];
  r.root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.outline) { ols.push(o); return; }
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    for (const m of [].concat(o.material)) { m.userData.base = m.opacity; mats.push(m); }
  });
  r.risen = true; r.mats = mats; r.isRisen = true;
  r.fade = (a) => { for (const m of mats) { m.transparent = a < .999; m.opacity = (m.userData.base ?? 1) * a; m.depthWrite = a > .5; } for (const o of ols) o.visible = a > .9; };
  return r;
}

// ---------- pixel-art beasts (PXART): the hound, raven, war horses, steeds, mimic, heart and flask, dressed with pxart.js tiles
// (skin() swaps each flat colour for a tile sized to one texel size; steeds' coats share neutral tiles tinted per coat) ----------
const bkFur = (hex, cw = 6, ch = 4, L = 2, Q) => PXK.paTile(`fur${hex}${cw}.${ch}.${L}${Q ? 'q' : ''}`, cw * 4, ch * 4, (c) => PXK.paFur(c, Q || PXK.ramp(hex, 6), { cw, ch, long: L }));
const bkFurN = PXK.paTile('furN6.4.2s', 24, 16, (c) => { const N = PXK.NEU; PXK.paFur(c, [N[1], N[2], N[2], N[3], N[4], N[4]], { cw: 6, ch: 4, long: 2, glint: 0 }); }, true); // a soft neutral coat (no near-black hairs), tinted per horse
const bkStr = (hex, gap = 3, wave = 1) => PXK.paTile(`str${hex}${gap}.${wave}`, gap * 9, 24, (c) => PXK.paStrands(c, PXK.ramp(hex, 6), { gap, wave }));
const bkStrN = PXK.paTile('strN3.1', 27, 24, (c) => PXK.paStrands(c, PXK.NEU, { gap: 3, wave: 1 }), true);
// bkSoft: a dark colour's ramp() for coats and plumage, its lights pulled most of the way back to the base and no near-black
// texel, so the marks read as a sheen (ramp() lights are about twice the base on black: specks; a tinted neutral tile: flat)
const bkSoft = (hex, k = .3) => PXK.paOnce(`soft${hex}${k}`, () => { const Q = PXK.ramp(hex, 6), a = new THREE.Color(), b = new THREE.Color(), m = (i, t) => '#' + a.set(Q[3]).lerp(b.set(Q[i]), t).getHexString(); return [Q[0], Q[2], Q[2], Q[3], m(4, k), m(5, k * 1.5)]; });
// a dark bird's plumage: each feather's tip a shaded U under a lit top, staggered and sparse (8 x 6 cells)
const bkPlume = (hex) => PXK.paTile('plumeS' + hex, 24, 24, (c) => {
  const { R, P } = c, Q = bkSoft(hex, .45); R(0, 0, 24, 24, Q[3]);
  for (let y = 0, row = 0; y < 24; y += 6, row++) for (let x = (row & 1) * 4; x < 24; x += 8) { P(x + 2, y, Q[4]); P(x + 3, y, Q[(x + y) % 5 ? 4 : 5]); P(x + 1, y + 1, Q[2]); P(x + 5, y + 1, Q[2]); for (let i = 2; i < 5; i++) P(x + i, y + 2, Q[2]); }
});
const bkGrit = (hex, o, W = 24, H = 24) => PXK.paTile(`grit${hex}${Object.entries(o).join()}`, W, H, (c) => PXK.paGrit(c, PXK.ramp(hex, 6), o));
const bkLea = (hex) => PXK.paTile('lea' + hex, 24, 12, (c) => PXK.paLeather(c, PXK.ramp(hex, 6)));
const bkMetal = (hex) => PXK.paTile('brz' + hex, 24, 12, (c) => PXK.paMetal(c, PXK.ramp(hex, 6), { glint: 8 }));
const bkMirror = (hex) => PXK.paTile('mirror' + hex, 24, 24, (c) => { // silver glass: bright diagonal sheens, a fine dark crack here and there
  const { P, rnd } = c, Q = PXK.ramp(hex, 6);
  for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) { const d = (i + j) % 24; P(i, j, d < 2 ? Q[5] : d < 3 || d === 12 ? Q[4] : d > 20 ? Q[2] : Q[3]); }
  for (let k = 0; k < 3; k++) { let x = rnd() * 24, y = rnd() * 24; for (let n = 0; n < 7; n++) { P(x, y % 24, Q[0]); x += rnd() < .5 ? 1 : -1; y++; } }
});
const bkHeart = () => PXK.paOnce('mHeart', () => new THREE.MeshBasicMaterial({ map: PXK.paTex('heart', 8, 8, (c) => { // each block of the pickup bevelled: lit top and left, a glint, shaded bottom and right
  const { R, P } = c; R(0, 0, 8, 8, '#e0354a'); R(0, 7, 8, 1, '#8a1430'); R(7, 0, 1, 8, '#a81c38'); R(0, 0, 7, 1, '#ff8a94'); R(0, 0, 1, 7, '#ff6a7a'); P(1, 1, '#ffffff'); P(2, 1, '#ffe0e4'); P(1, 2, '#ffe0e4');
}) }));
// the mirror-things of chapter 2: V's own silhouette in polished silver glass (braids, pteruges skirt), a blank cracked
// mirror for a face, shard fingers; a star of cracks on the back marks the spot that opens (r.weak glows) after they roll
export function makeMimic() {
  const SV = '#aab3c6', SVD = '#7c869c', GL = '#eaf2f8', CR = '#262c3a', TEAL = '#34d1bf', HT = '#8ad8cc', HTD = '#5fb4aa';
  const r = humanoid({ skin: SV, top: '#9aa4b8', bottom: SVD, boots: '#687288', sleeve: SV, faceless: true, scale: 1.2 });
  for (const A of [r.armL, r.armR]) A.scale.set(.75, 1.55, .75);
  for (const L of [r.legL, r.legR]) L.scale.set(.8, 1.15, .8);
  const { head, torso } = r, NS = { noShadow: true }, GLINT = { basic: true, noShadow: true };
  // face: a smooth mirror oval with a crack and a glint, a smear of teal where it reflects her hair
  const mask = ball(head, .172, GL, 0, .18, .07, 1); mask.scale.set(1, 1.18, .62);
  box(head, .014, .2, .02, CR, .025, .17, .176, NS).rotation.z = .45;
  box(head, .014, .08, .02, CR, -.03, .1, .172, NS).rotation.z = -.6;
  box(head, .022, .07, .01, '#ffffff', -.07, .24, .174, GLINT).rotation.z = -.5;
  box(head, .05, .018, .01, TEAL, .06, .1, .172, GLINT);
  // her braids (in sea-glass teal, so they read as her copies from the game camera) and her skirt, copied in silver
  ball(head, .19, HT, 0, .27, -.07, 1).scale.set(1.04, .7, 1);
  for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) {
    const u = i / 6, b = ball(torso, .05 - i * .002, i % 2 ? HTD : HT, sx * (.17 - u * .01), .8 - u * .5, -.03 + Math.min(1, u * 1.6) * .18, 0);
    b.scale.set(1, 1.3, .8);
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, st = box(torso, .07, .28, .03, i % 2 ? SVD : SV, Math.sin(a) * .26, -.19, Math.cos(a) * .26); st.rotation.y = a; st.rotation.x = .18 * Math.cos(a);
  }
  box(torso, .2, .02, .01, '#ffffff', -.04, .4, .158, GLINT).rotation.z = .7; // glint across the chest
  // shards: up from the shoulders and the spine, and as fingers
  for (const sx of [-1, 1]) { const c = cone(torso, .045, .22, GL, sx * .22, .66, -.06, 4); c.rotation.z = -sx * .55; c.rotation.x = -.2; }
  for (const [y, z, h] of [[.6, -.16, .24], [.48, -.19, .18]]) cone(torso, .04, h, GL, 0, y, z, 4).rotation.x = -.9;
  for (const H of [r.handL, r.handR]) for (const dx of [-.025, 0, .025]) cone(H, .016, .12, GL, dx, -.06, .01, 3, NS).rotation.x = Math.PI;
  // the back: a star of cracks always shows where to strike; the core glows through it while exposed
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3; box(torso, .012, .12, .012, CR, Math.sin(a) * .06, .4 + Math.cos(a) * .06, -.165, NS).rotation.z = -a; }
  r.weak = new THREE.Group(); torso.add(r.weak); r.weak.position.set(0, .4, -.15);
  ball(r.weak, .1, TEAL, 0, 0, 0, 0, { basic: true });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const c = cone(r.weak, .03, .14, '#9ff5ea', Math.sin(a) * .13, Math.cos(a) * .13, -.02, 3, GLINT); c.rotation.z = -a; }
  r.weak.visible = false;
  if (PXART) PXK.skin(r.root, Object.fromEntries([SV, '#9aa4b8', SVD, '#687288', GL, HT, HTD].map((h) => [h, bkMirror(h)]))); // silver glass with sheens and hairline cracks
  return finish(r);
}

// ---------- round 27 (Roy): the mimic redesigned as a faceless stone hoplite behind a huge shield ----------
// "They should look like a faceless Greek warrior (as if made of stone) and hold a huge shield, almost the size of their
// body. Then when they show their back, you can attack them properly." humanoid() (the same joints, so animateRig works),
// carved in weathered marble: a Corinthian helm over a blank face, a round gorgon aspis nearly body height on the left
// forearm in front, a spear in the right hand, cracks on the back and r.weak (hidden; a gold core glowing through the
// cracks while exposed). Roy chose this one (option A) of three; the enemy type is still 'mimic' (entities.js), and
// animateStoneGuard below is its animate (the shield carry, the spear thrust, the charge, the leap, the exposed slump).
// stoneGuardPose(r, k): the shield carry (shield arm across the front, weapon arm cocked); the shield and weapon are fitted
// to the rig in that pose, so callers blend it in after animateRig. Tools: tools/stone-guards.html.
export const STONE_POSE = { aLx: -.5, aLy: 0, aLz: -.2, eL: -1.25, aRx: -.25, aRy: 0, aRz: .32, eR: -1.05 };
export function stoneGuardPose(r, k = 1) {
  const P = STONE_POSE, l = (o, p, v) => { o[p] += (v - o[p]) * k; };
  l(r.armL.rotation, 'x', P.aLx); l(r.armL.rotation, 'y', P.aLy); l(r.armL.rotation, 'z', P.aLz); l(r.elbowL.rotation, 'x', P.eL);
  l(r.armR.rotation, 'x', P.aRx); l(r.armR.rotation, 'y', P.aRy); l(r.armR.rotation, 'z', P.aRz); l(r.elbowR.rotation, 'x', P.eR);
}
const _sgV = new THREE.Vector3(), _sgQ = new THREE.Quaternion();
// a group laid out in the root's own frame (x = her left, +z = front, y up, unscaled metres of the 1.85 rig), then
// carried by joint j (keeps where it is now, with the rig in stoneGuardPose)
function sgMount(r, j, x, y, z, rx = 0, ry = 0, rz = 0) { const g = pivot(r.root, x, y, z); g.rotation.set(rx, ry, rz); r.root.updateMatrixWorld(true); j.attach(g); return g; }
function sgHandAt(r, side) { r.root.updateMatrixWorld(true); return r.root.worldToLocal(r['hand' + side].getWorldPosition(_sgV)).clone(); }
function stoneBody(r, S, S2, S3) { // the carved hoplite under each option: muscle cuirass, shoulder flaps, pteruges, greaves
  const { torso } = r;
  for (const L of [r.legL, r.legR]) L.scale.set(1.15, 1, 1.15);
  for (const A of [r.armL, r.armR]) { tcyl(A, .085, .07, .26, S, 0, -.14, 0, 7); tcyl(A.children.find((c) => c.isGroup), .07, .062, .24, S, 0, -.13, 0, 7); } // stone limbs, thicker (no scale on the arms: the shield and weapon ride them)
  const cu = tcyl(torso, .29, .23, .48, S, 0, .38, 0, 10); cu.scale.z = .8; // muscle cuirass
  for (const sx of [-1, 1]) { const pc = ball(torso, .13, S3, sx * .1, .5, .15, 1); pc.scale.set(1.05, .75, .5); } // pectorals
  for (let i = 0; i < 2; i++) for (const sx of [-1, 1]) box(torso, .1, .07, .04, S3, sx * .055, .33 - i * .085, .2, { noShadow: true }); // the carved belly
  box(torso, .02, .3, .03, S2, 0, .33, .215, { noShadow: true });
  const col = tcyl(torso, .17, .2, .05, S2, 0, .63, 0, 10); col.scale.z = .85; // collar
  const bl = tcyl(torso, .25, .25, .06, S2, 0, .12, 0, 10); bl.scale.z = .82; // belt
  for (const sx of [-1, 1]) { const f = box(torso, .2, .05, .26, S2, sx * .26, .66, 0); f.rotation.z = -sx * .35; } // linothorax shoulder flaps
  for (let row = 0; row < 2; row++) for (let i = 0; i < 12; i++) { // two rows of pteruges
    const a = (i + row * .5) / 12 * Math.PI * 2, rr = .25 + row * .02, p = box(torso, .085, .2, .035, row ? S2 : S, Math.sin(a) * rr, -.02 - row * .14, Math.cos(a) * rr * .85);
    p.rotation.y = a; p.rotation.x = .15 * Math.cos(a);
  }
  for (const K of [r.kneeL, r.kneeR]) { ball(K, .085, S3, 0, 0, .03, 0); const gv = tcyl(K, .09, .075, .26, S3, 0, -.15, .012, 8); gv.scale.z = .9; } // greaves
}
function stoneBack(r, CR, GLOW, hot) { // the back: cracks always show where to strike; r.weak glows through them while exposed
  const { torso } = r, NS = { noShadow: true }, G = { basic: true, noShadow: true };
  const rays = [[0, .11, .5], [.9, .16, .62], [1.9, .12, .5], [2.8, .15, .55], [3.9, .13, .62], [5, .16, .5]];
  const cr = (p, z, col, o, w = .022) => rays.forEach(([a, len, k]) => {
    const b = box(p, w, len, w, col, Math.sin(a) * len * .5, Math.cos(a) * len * .5, z, o); b.rotation.z = -a;
    const t = box(p, w * .8, len * k, w * .8, col, Math.sin(a) * len + Math.sin(a + .6) * len * k * .5, Math.cos(a) * len + Math.cos(a + .6) * len * k * .5, z, o); t.rotation.z = -a - .6; // a fork at its end
  });
  const back = pivot(torso, 0, .4, -.19); cr(back, 0, CR, NS);
  box(back, .14, .12, .02, CR, 0, 0, -.004, NS).rotation.z = .5; // the broken-in middle
  r.weak = new THREE.Group(); torso.add(r.weak); r.weak.position.set(0, .4, -.2);
  ball(r.weak, .11, GLOW, 0, 0, 0, 0, G); ball(r.weak, .065, hot, 0, 0, -.06, 0, G);
  cr(r.weak, -.012, hot, G, .018);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, c = cone(r.weak, .028, .11, hot, Math.sin(a) * .31, Math.cos(a) * .31, -.03, 3, G); c.rotation.z = -a; } // a ring of sparks round it
  r.weak.visible = false;
}
function stoneSkin(r, tiles) { if (PXART) PXK.skin(r.root, tiles); }

// weathered marble, Corinthian helm, round aspis with a gorgon and a meander rim, spear
export function makeStoneGuardA() {
  const S = '#dfe1e2', S2 = '#b2b5b8', S3 = '#eceeee', FACE = '#f8f6f0', CR = '#3a3834', BZ = '#b08a58', BZ2 = '#8a6a40', BZ3 = '#c8a46c', CREST = '#a4584a', CREST2 = '#82443a';
  const r = humanoid({ skin: S3, top: S, bottom: S2, legs: S, boots: S2, sleeve: S, faceless: true, scale: 1.25 });
  stoneBody(r, S, S2, S3);
  const { head } = r, NS = { noShadow: true };
  // Corinthian helm: a closed shell, the blank marble face seen only through its T opening, a nose guard down the middle
  const hm = ball(head, .238, S, 0, .21, -.01, 1); hm.scale.set(1.02, 1.08, 1.1);
  for (const sx of [-1, 1]) { const ch = box(head, .1, .2, .2, S, sx * .135, .08, .08); ch.rotation.set(.1, sx * .45, sx * .06); } // cheek plates
  box(head, .25, .085, .04, CR, 0, .2, .24, NS); box(head, .1, .17, .04, CR, 0, .1, .238, NS); // the T opening's shadowed edge
  box(head, .22, .06, .04, FACE, 0, .198, .248, NS); box(head, .072, .14, .04, FACE, 0, .1, .246, NS); // the blank face seen through it
  box(head, .05, .12, .05, S, 0, .2, .262); // nose guard
  box(head, .3, .04, .06, S2, 0, .265, .2).rotation.x = -.2; // brow ridge
  const nf = box(head, .34, .14, .1, S, 0, .02, -.17); nf.rotation.x = .55; // the neck guard flaring out at the back
  for (const sx of [-1, 1]) { const fl = box(head, .06, .12, .14, S, sx * .16, -.02, .12); fl.rotation.set(-.2, sx * .5, -sx * .25); } // the cheek plates flaring at the jaw
  // a tall crest on a stilt, fanned front to back, its paint faded to terracotta
  box(head, .04, .12, .04, S2, 0, .44, -.02);
  for (let i = 0; i < 9; i++) { const u = i / 8, c = box(head, .06, .2 + Math.sin(u * Math.PI) * .12, .085, i % 2 ? CREST2 : CREST, 0, .56 + Math.sin(u * Math.PI) * .08, .2 - u * .5); c.rotation.x = -.45 + u * .9; }
  const tl = box(head, .06, .38, .08, CREST, 0, .36, -.32); tl.rotation.x = .25; // the tail down the back
  // pose, then the shield and the spear fitted to it
  stoneGuardPose(r);
  const sh = pivot(r.shield = sgMount(r, r.elbowL, .22, 1.02, .5), 0, 0, 0); sh.scale.setScalar(1.1);
  const face = tcyl(sh, .64, .64, .09, BZ, 0, 0, 0, 16); face.rotation.x = Math.PI / 2; face.scale.z = 1;
  const dome = ball(sh, .56, BZ, 0, 0, -.02, 1); dome.scale.set(1, 1, .16);
  const rim = tcyl(sh, .68, .68, .07, BZ3, 0, 0, .02, 16); rim.rotation.x = Math.PI / 2;
  for (let i = 0; i < 20; i++) { // the meander round the rim: a key, its hook alternating, carved proud
    const a = i / 20 * Math.PI * 2, g = pivot(sh, Math.sin(a) * .56, Math.cos(a) * .56, .065); g.rotation.z = -a;
    box(g, .1, .022, .02, BZ2, 0, .04, 0, NS); box(g, .022, .08, .02, BZ2, .04, 0, 0, NS); box(g, .06, .022, .02, BZ2, .01, -.04, 0, NS); box(g, .022, .04, .02, BZ2, -.02, -.02, 0, NS);
  }
  const ring = tcyl(sh, .47, .47, .02, BZ2, 0, 0, .075, 16, NS); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1, 1);
  const ring2 = tcyl(sh, .45, .45, .025, BZ, 0, 0, .078, 16, NS); ring2.rotation.x = Math.PI / 2;
  // the gorgoneion: a round face, snakes for hair, staring dots and a tongue
  const gf = ball(sh, .17, BZ3, 0, 0, .09, 1); gf.scale.set(1, 1, .45);
  for (let i = 0; i < 10; i++) { const a = (i / 10 - .5) * Math.PI * 1.45, sn = cone(sh, .035, .16, BZ3, Math.sin(a) * .22, Math.cos(a) * .22, .1, 4); sn.rotation.z = -a; sn.rotation.x = .3; }
  for (const sx of [-1, 1]) box(sh, .045, .035, .03, CR, sx * .06, .04, .165, NS);
  box(sh, .1, .03, .03, CR, 0, -.07, .16, NS); box(sh, .03, .05, .03, CREST, 0, -.1, .16, NS);
  // spear: a long marble shaft cocked up over the shield, a leaf blade and a butt spike
  const hp = sgHandAt(r, 'R'), sp = sgMount(r, r.handR, hp.x, hp.y, hp.z, .55, 0, -.08); r.held = sp;
  tcyl(sp, .03, .03, 2.5, S2, 0, .45, 0, 6);
  const bl = ball(sp, .075, S3, 0, 1.82, 0, 1); bl.scale.set(.6, 2.6, .25); cone(sp, .035, .16, S3, 0, 2.06, 0, 4);
  cone(sp, .04, .2, S2, 0, -.88, 0, 4).rotation.x = Math.PI;
  // the clang: a flash over the aspis when a blow glances off it (entities.js damage sets r.clang; animateStoneGuard fades it)
  const fl = new THREE.Mesh(new THREE.CircleGeometry(.7, 20), new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  fl.position.z = .2; fl.userData.fx = fl.userData.outline = true; fl.castShadow = false; fl.visible = false; sh.add(fl); r.shieldFlash = fl; r.clang = 0;
  stoneBack(r, CR, '#ffcf5a', '#fff2b0');
  { // and a halo round the core, so the open back reads from the game camera (behind the torso: the body hides it from in front)
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 1, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,246,200,1)'); gr.addColorStop(.35, 'rgba(255,207,90,.75)'); gr.addColorStop(1, 'rgba(255,170,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    const tx = new THREE.CanvasTexture(c), hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    hs.scale.setScalar(1.2); hs.position.z = -.12; hs.userData.fx = hs.userData.outline = true; r.weak.add(hs);
  }
  stoneSkin(r, Object.fromEntries([S, S2, S3, BZ, BZ2, BZ3, CREST, CREST2].map((h) => [h, bkGrit(h, { fleck: 6, pit: .7, crack: .06 })])));
  r.stone = 'A';
  r._rfd = true; // round 33 (Roy): the Stone Knights stay exactly as they were: refineRig (the rounder joints) leaves them be
  return finish(r);
}

// animateStoneGuard(r, dt, st): the stone hoplite's animate (entities.js ETYPES.mimic.animate). animateRig walks it, rolls
// it (the copied roll), staggers and flinches it, with its own arm swings off; then the arms are laid from STONE_POSE (the
// shield across the front, the spear cocked), every action an offset eased in and out (r._sg), absolute each frame so the
// shield and spear stay where they were fitted. st.mode is the Enemy's state: windup/attack (the spear thrust, low and
// level, the torso twisting into it), sgChargeWind (braced behind the shield), sgCharge (shield shoved forward, leaning
// in), sgCrouch (a deep crouch before the leap), sgAir (knees tucked), sgLand (st.land 1..0: down into the landing),
// exposed (the shield and spear drop, it slumps forward with its back open). r.clang 1..0: the shield knocked back, flashing.
const _sgSt = {};
const SG0 = { aLx: 0, aLz: 0, eL: 0, aRx: 0, aRz: 0, eR: 0, hR: 0, tX: 0, tY: 0, drop: 0, kn: 0, st: 0, hX: 0 };
export function animateStoneGuard(r, dt, st) {
  Object.assign(_sgSt, st); _sgSt.attackT = -1; _sgSt.windup = -1; _sgSt.block = false;
  const O = r._sgO || (r._sgO = [0, 0, 0, 0, 0]); // last frame's offsets on the legs, knees and head: off before animateRig eases them (or they pile up)
  r.legL.rotation.x -= O[0]; r.legR.rotation.x -= O[1]; r.kneeL.rotation.x -= O[2]; r.kneeR.rotation.x -= O[3]; r.head.rotation.x -= O[4]; O.fill(0);
  animateRig(r, dt, _sgSt);
  const S = r._sg || (r._sg = { ...SG0 }), T = { ...SG0 }, m = st.mode, roll = st.roll >= 0;
  // the spear rides the hand leaning forward (fitted that way): a low thrust from the hip lays it level by dropping the
  // forearm (drawn back first, the torso twisted away), then drives the arm through, tip rising toward her chest
  if (m === 'windup') { T.aRx = .75; T.eR = .3; T.tY = -.35; T.tX = .05; }
  else if (m === 'attack') { const c = Math.min(1, Math.max(0, (st.attackT - .08) / .3)), e = c * c * (3 - 2 * c), back = Math.max(0, (st.attackT - .7) / .3), f = 1 - back; T.aRx = (.75 - e * 1.25) * f; T.eR = (.3 + e * .75) * f; T.tY = (-.35 + e * .7) * f; T.tX = .05 + e * .14; T.st = e * f; }
  else if (m === 'sgChargeWind') { T.aLx = -.25; T.tX = .3; T.drop = .1; T.st = 1; T.aRx = .1; }
  else if (m === 'sgCharge') { T.aLx = -.45; T.eL = .3; T.tX = .42; T.drop = .06; }
  else if (m === 'sgCrouch') { T.drop = .28; T.kn = 1; T.tX = .35; T.aLx = .15; T.aRx = .2; }
  else if (m === 'sgAir') { T.kn = 1.25; T.tX = .15; T.aLx = -.2; }
  else if (m === 'sgLand') { const k = st.land || 0; T.drop = .32 * k; T.kn = 1.1 * k; T.tX = .45 * k; T.aLx = .2 * k; T.aRx = .35 * k; }
  else if (m === 'exposed') { T.aLx = .25; T.aLz = -.55; T.eL = .35; T.aRx = .15; T.aRz = .2; T.tX = .42; T.hX = .35; T.drop = .1; T.kn = .45; } // the shield swung out wide like a door, the spear hanging
  else if (m === 'stagger') { T.aLx = .25; T.eL = .4; T.tX = -.1; }
  const fast = m === 'attack' || m === 'sgCharge' || m === 'sgAir' || m === 'sgLand';
  const k = 1 - Math.pow(fast ? 1e-9 : .0005, dt);
  for (const p in S) S[p] += (T[p] - S[p]) * k;
  const P = STONE_POSE, c = r.clang = Math.max(0, (r.clang || 0) - dt * 4.5), cl = c * c;
  r.armL.rotation.set(P.aLx + S.aLx + cl * .35, P.aLy, P.aLz + S.aLz); r.elbowL.rotation.x = P.eL + S.eL + cl * .25;
  r.armR.rotation.set(P.aRx + S.aRx, P.aRy, P.aRz + S.aRz); r.elbowR.rotation.x = P.eR + S.eR;
  r.handR.rotation.x = S.hR; r.handL.rotation.x = 0;
  if (!roll) {
    r.torso.rotation.x = S.tX - cl * .12; r.torso.rotation.y = S.tY;
    r.hip.position.y -= S.drop;
    const kn = Math.min(1.3, S.kn), w = Math.min(1, kn); // a crouch: thighs forward, shins back (pulled toward that, over the walk)
    O[0] = (-.75 * kn - r.legL.rotation.x) * w - .45 * S.st; O[1] = (-.75 * kn - r.legR.rotation.x) * w + .3 * S.st; // the thrust's and the brace's lunge: left foot forward
    O[2] = (1.45 * kn - r.kneeL.rotation.x) * w; O[3] = (1.45 * kn - r.kneeR.rotation.x) * w + .35 * S.st * (1 - w);
    O[4] = S.hX;
    r.legL.rotation.x += O[0]; r.legR.rotation.x += O[1]; r.kneeL.rotation.x += O[2]; r.kneeR.rotation.x += O[3]; r.head.rotation.x += O[4];
  }
  if (r.shieldFlash) { r.shieldFlash.visible = c > .01; r.shieldFlash.material.opacity = c * .9; }
  if (r.weak?.visible) { r._wt = (r._wt || 0) + dt; r.weak.scale.setScalar(1 + Math.sin(r._wt * 11) * .14); }
}

export function makeHound() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const c = '#1a1720';
  const torso = ball(body, .32, c, 0, .6, 0, 1); torso.scale.set(.8, .75, 1.6);
  const head = new THREE.Group(); body.add(head); head.position.set(0, .78, .5);
  const hb = ball(head, .2, c, 0, 0, .06, 1); hb.scale.set(1, .9, 1.1);
  box(head, .14, .12, .26, c, 0, -.05, .3);
  box(head, .05, .035, .02, '#ff3b3b', -.08, .05, .24, { basic: true });
  box(head, .05, .035, .02, '#ff3b3b', .08, .05, .24, { basic: true });
  cone(head, .06, .2, c, -.1, .2, -.02, 4); cone(head, .06, .2, c, .1, .2, -.02, 4);
  const legs = [];
  for (const [x, z] of [[-.14, .3], [.14, .3], [-.14, -.32], [.14, -.32]]) {
    const p = new THREE.Group(); p.position.set(x, .45, z); body.add(p); tcyl(p, .06, .045, .46, c, 0, -.22, 0, 5); legs.push(p);
  }
  const tail = tcyl(body, .04, .02, .5, '#2a2633', 0, .72, -.62, 4); tail.rotation.x = -1;
  if (PXART) { // the hellhound: fangs and a red maw, a ridge of spines, claws; black fur with ember-tipped tufts
    for (const s of [-1, 1]) cone(head, .016, .07, '#efe4d0', s * .045, -.13, .4, 3, { noShadow: true }).rotation.x = Math.PI;
    box(head, .11, .016, .02, '#7a1018', 0, -.1, .432, { noShadow: true });
    for (let i = 0; i < 4; i++) cone(body, .045, .17, c, 0, .83, .3 - i * .17, 4).rotation.x = -.75;
    for (const p of legs) for (const s of [-1, 0, 1]) cone(p, .012, .045, '#3a3040', s * .025, -.44, .05, 3, { noShadow: true }).rotation.x = 2.1;
    PXK.skin(root, { [c]: bkFur(c, 6, 5, 3, ['#07060a', '#0e0c13', '#15121b', '#1d1924', '#3e2632', '#a8452c']), '#2a2633': bkFur('#2a2633', 6, 5, 3) });
  }
  addOutline(root, (m) => m.material.isMeshBasicMaterial);
  return { root, body, head, legs, tail, phase: 0, quad: true };
}

export function makeRaven() {
  const root = new THREE.Group(), K = '#16141c', K2 = '#25222e', SH = '#3a3648';
  const b = ball(root, .18, K, 0, .32, 0, 1); b.scale.set(.85, .85, 1.35);
  ball(root, .14, K2, 0, .3, .12, 1).scale.set(.9, .85, 1); // chest
  const hd = ball(root, .12, K, 0, .5, .22, 1); hd.scale.set(.95, .95, 1.05);
  for (const sx of [-1, 1]) ball(root, .05, K2, sx * .05, .47, .3, 0).scale.set(.8, 1, 1); // throat hackles
  const bk = cone(root, .045, .2, '#2a2830', 0, .48, .4, 4); bk.rotation.x = Math.PI / 2;
  box(root, .03, .03, .02, '#c7a6ff', -.065, .53, .3, { basic: true });
  box(root, .03, .03, .02, '#c7a6ff', .065, .53, .3, { basic: true });
  const wl = new THREE.Group(); wl.position.set(-.13, .4, .02); root.add(wl);
  const wr = new THREE.Group(); wr.position.set(.13, .4, .02); root.add(wr);
  for (const [w, sx] of [[wl, -1], [wr, 1]]) {
    box(w, .3, .035, .32, K2, sx * .14, 0, 0);
    for (let i = 0; i < 4; i++) box(w, .09, .025, .34 - i * .04, i % 2 ? K : SH, sx * (.3 + i * .07), -.005, -.02 - i * .02);
  }
  const tl = new THREE.Group(); tl.position.set(0, .3, -.22); tl.rotation.x = -.25; root.add(tl);
  for (let i = -1; i <= 1; i++) { const f = box(tl, .07, .025, .3, i ? K2 : K, i * .055, 0, -.14); f.rotation.y = -i * .2; }
  for (const sx of [-1, 1]) { tcyl(root, .012, .012, .14, '#3a3440', sx * .06, .1, .02, 4); box(root, .06, .015, .08, '#3a3440', sx * .06, .03, .04); }
  if (PXART) PXK.skin(root, { [K]: bkPlume(K), [K2]: bkPlume(K2), [SH]: bkPlume(SH), '#2a2830': bkGrit('#2a2830', { fleck: 3, bump: .8 }), '#3a3440': bkGrit('#3a3440', { fleck: 4 }) }); // blue-black plumage, a horny beak, scaly feet
  addOutline(root, (m) => m.material.isMeshBasicMaterial); pxRig(root); // the characters' pixel shading (render.js)
  return { root, wl, wr };
}

export function makeHorse(c = '#26252e') { // black war horse (chariot team): muscled, feathered hooves, long mane and tail
  const root = new THREE.Group(), D = new THREE.Color(c).multiplyScalar(.62).getStyle(), HI = '#55545f', MANE = '#111016', IRON = '#8a8a94';
  const b = ball(root, .45, c, 0, 1.28, 0, 1); b.scale.set(.74, .76, 1.62);
  ball(root, .38, c, 0, 1.36, .5, 1).scale.set(.86, .95, .9);   // chest / shoulders
  ball(root, .37, c, 0, 1.36, -.52, 1).scale.set(.9, .92, .95); // rump
  ball(root, .3, D, 0, 1.05, 0, 1).scale.set(.9, .5, 1.6);       // belly shadow
  for (const sx of [-1, 1]) { const m = ball(root, .16, HI, sx * .26, 1.5, .55, 0, { noShadow: true }); m.scale.set(.25, .9, 1); } // shoulder sheen
  const neck = tcyl(root, .19, .3, .86, c, 0, 1.7, .76, 7); neck.rotation.x = .62; neck.scale.x = .8;
  const hp = pivot(root, 0, 2.06, 1.06); hp.rotation.x = .55;
  ball(hp, .17, c, 0, 0, 0, 1).scale.set(.9, 1, 1.1);
  const mz = tcyl(hp, .1, .14, .42, c, 0, -.05, .26, 7); mz.rotation.x = Math.PI / 2 + .1; mz.scale.x = .9;
  ball(hp, .1, D, 0, -.08, .46, 0).scale.set(.95, .8, .8);
  for (const sx of [-1, 1]) {
    box(hp, .03, .03, .02, '#ff5a2a', sx * .12, .04, .12, { basic: true, noShadow: true });
    const ear = cone(hp, .045, .16, c, sx * .07, .18, -.04, 4); ear.rotation.z = -sx * .2;
    box(hp, .02, .02, .02, '#060608', sx * .05, -.1, .5, { noShadow: true });
  }
  // bridle and breast collar, ash-grey studs
  const br = tcyl(hp, .145, .145, .03, '#2a2a30', 0, -.03, .26, 8, { noShadow: true }); br.rotation.x = Math.PI / 2 + .1;
  tcyl(hp, .175, .175, .03, '#2a2a30', 0, .03, .02, 8, { noShadow: true });
  ball(hp, .035, IRON, 0, .15, .1, 0, { noShadow: true });
  const col = tcyl(root, .31, .33, .06, '#2c2c34', 0, 1.36, .6, 8, { noShadow: true }); col.rotation.x = 1.2; col.scale.z = .8;
  for (let i = 0; i < 5; i++) ball(root, .03, IRON, (i - 2) * .12, 1.3 - Math.abs(i - 2) * .03, .83 - Math.abs(i - 2) * .05, 0, { noShadow: true });
  // mane down the crest of the neck (story scales these in the wind), forelock
  // laid out in the neck's own frame (y along the neck, -z the crest): each strand hangs from the crest down the right
  // side along the chord of the neck's curve, lifted by that curve's sag so it rests on the neck, never through it
  const mane = [], crest = pivot(root, 0, 1.7, .76); crest.rotation.x = .62;
  const nR = (y) => (.3 + (.19 - .3) * (y + .43) / .86) * .9; // the heptagonal neck's flat crest face, .9 of its radius
  for (let i = 0; i < 9; i++) {
    const y = .4 - i * .095, r = nR(y), lift = .14 * r + .03;
    const m = pivot(crest, .608 * lift, y, -r - .794 * lift); m.rotation.set(0, -.654, Math.PI / 2); mane.push(m);
    box(m, .13, .95 * r + .06, .045, i % 2 ? MANE : '#2c2a34', 0, -(.95 * r + .06) / 2, 0);
  }
  for (let i = 0; i < 6; i++) { const y = .4 - i * .1; box(crest, .07, .12, .07, MANE, 0, y, -nR(y) - .035); } // the crest ridge
  const fl = box(hp, .07, .2, .05, MANE, .02, .1, .15); fl.rotation.set(.7, 0, .2);
  // tail
  const tp = pivot(root, 0, 1.48, -.98); tp.rotation.x = -.35;
  for (let i = 0; i < 4; i++) { const t = tcyl(tp, .07 - i * .008, .1 - i * .01, .28, i % 2 ? '#24222c' : MANE, 0, -.12 - i * .24, -.06 * i, 6); t.rotation.x = -.18 * i; }
  // legs: pivot at the body, forearm/gaskin, cannon, feathered fetlock, hoof
  const legs = [];
  for (const [x, z, f] of [[-.21, .55, 1], [.21, .55, 1], [-.21, -.55, 0], [.21, -.55, 0]]) {
    const p = pivot(root, x, 1.05, z); legs.push(p);
    const up = tcyl(p, .13, .085, .42, c, 0, -.18, f ? 0 : -.03, 6); up.rotation.x = f ? 0 : .12;
    ball(p, .075, c, 0, -.42, f ? .02 : -.05, 0);
    tcyl(p, .055, .05, .36, D, 0, -.62, f ? .02 : -.04, 6);
    tcyl(p, .065, .1, .15, '#141318', 0, -.84, f ? .02 : -.04, 6); // feathering
    tcyl(p, .075, .085, .07, '#0a0a0c', 0, -.93, f ? .04 : -.02, 6);
  }
  if (PXART) { const Dh = '#' + new THREE.Color(c).multiplyScalar(.62).getHexString(); // a short coat, mane and tail in strands, studded leather
    PXK.skin(root, { [c]: bkFur(c, 6, 4, 2, bkSoft(c)), [Dh]: bkFur(Dh, 6, 4, 2, bkSoft(Dh)), [HI]: bkFur(HI, 6, 4, 2, bkSoft(HI)), [MANE]: bkStr(MANE), '#2c2a34': bkStr('#2c2a34'), '#24222c': bkStr('#24222c'), '#141318': bkStr('#141318', 2, 0),
      '#2a2a30': bkLea('#2a2a30'), '#2c2c34': bkLea('#2c2c34'), [IRON]: bkMetal(IRON), '#0a0a0c': bkGrit('#0a0a0c', { fleck: 4 }) }); }
  addOutline(root, (m) => !m.castShadow || m.material.isMeshBasicMaterial); pxRig(root); // the characters' pixel shading (render.js)
  return { root, mane, legs, head: hp, tail: tp };
}

export function makeStatue(color = '#cfc8b8', faceless = true, o = {}) {
  const dim = new THREE.Color(color).multiplyScalar(.72).getStyle(), mid = new THREE.Color(color).multiplyScalar(.88).getStyle();
  const r = humanoid({ skin: color, top: color, bottom: color, boots: color, sleeve: color, faceless, white: color, eyes: dim, brow: dim, lips: dim });
  // marble drapery: long folded chiton, mantle over one shoulder, curled hair
  C.robe(r, color, { top: .21, bot: .33, y1: -.6, folds: mid, n: 7 });
  C.drape(r, color, null, -.74, .2, .34);
  C.hairCap(r, color, { h: .84 });
  for (let i = 0; i < 7; i++) { const az = -1.1 + i / 6 * 2.2; ball(r.head, .05, mid, Math.sin(az) * .2, .36 - Math.abs(az) * .05, -.03 + Math.cos(az) * .2, 0, { noShadow: true }); }
  C.reDress(r, { [color]: ['marble', 'marble', 'marble'], [mid]: [null, 'marble'] }); if (PXART) { r.skull.material = mat(color); const mm = new Set([color, mid].map((c) => C.storyTex('marble', '#' + new THREE.Color(c).getHexString()))); r.root.traverse((m) => { if (m.isMesh && mm.has(m.material)) C.uvBox(m, 3); }); } // pixel art: the bare marble (limbs, curls) flecked and veined, chisel strokes, at one even size (planar uvs); the face stays smooth
  r.static = true;
  if (o.atropos) fateShears(r);
  return finish(C.bake(r));
}
// round 23 (Roy: "she holds just two rectangles, it isn't clear"): Atropos, the Fate who cuts the thread. Her right hand
// holds a pair of gilded shears up beside her face, the blades open (two long tapered blades crossed at a rivet, two
// finger rings below it, the grip in her fist); her left holds a spindle wound with a ball of silver thread, and the
// thread runs from it into the open blades, about to be cut. Gold and a glowing silver line on the white marble, so
// they read from the play camera. r.shears, r.spindle; r.threadEnd is the point between the blades where the thread is cut.
function fateShears(r) {
  const GOLD = '#d8aa3e', GOLD2 = '#f4d27a', DARK = '#8a6420', SILVER = '#eef4ff';
  armIK(r, 'R', _hR.set(.24, .5, .3)); aimHand(r, 'R', _dR.set(.18, .8, .45), 1, _gp.set(0, .6, .8)); // (the blades open toward the front and the sky: the camera sees the V of them)
  armIK(r, 'L', _hL.set(-.2, .2, .4)); aimHand(r, 'L', _dL.set(-.15, .35, .9));
  const sh = r.shears = pivot(r.handR, 0, 0, .02); sh.scale.setScalar(1.25); // (a touch over life size, like every prop that must read from above)
  const blade = (side) => { // a long blade from the rivet to its point, flat side to the front, its edge bevelled bright
    const p = pivot(sh, 0, 0, .12); p.rotation.y = side * .3;
    const s = new THREE.Shape(); s.moveTo(-.035, 0); s.lineTo(.03, 0); s.lineTo(.012, .36); s.lineTo(-.006, .4); s.lineTo(-.03, .2); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: .018, bevelEnabled: false }); geo.translate(0, 0, -.009); geo.rotateX(Math.PI / 2); // shape y -> +z
    const m = new THREE.Mesh(geo, mat(GOLD, { emissive: '#3a2400' })); m.scale.x = side; m.castShadow = true; p.add(m);
    box(p, .006, .02, .3, GOLD2, side * .022, .002, .2, { basic: true, noShadow: true }).rotation.y = side * -.05; // the edge catching the light
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.055, .014, 6, 12), mat(GOLD)); ring.position.set(-side * .05, 0, -.06); ring.rotation.x = Math.PI / 2; ring.castShadow = true; sh.add(ring); // a finger ring
    box(sh, .024, .02, .1, GOLD, -side * .03, 0, .03).rotation.y = side * .45; // the shank from the ring to the rivet
    return p;
  };
  blade(1); blade(-1);
  ball(sh, .03, DARK, 0, .016, .12, 0, { noShadow: true }); ball(sh, .03, DARK, 0, -.016, .12, 0, { noShadow: true }); // the rivet
  r.threadEnd = pivot(sh, 0, 0, .3);
  // the spindle in her left hand, a ball of silver thread wound on it
  const sp = r.spindle = pivot(r.handL, 0, 0, .02);
  tcyl(sp, .014, .018, .5, '#a07a4a', 0, 0, .12, 6).rotation.x = Math.PI / 2;
  const wh = tcyl(sp, .07, .07, .025, DARK, 0, 0, -.1, 10); wh.rotation.x = Math.PI / 2; // the whorl
  const sk = ball(sp, .085, SILVER, 0, 0, .18, 1, { emissive: '#3a4a60' }); sk.scale.set(1, 1, 1.45);
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.083 - Math.abs(i - 1.5) * .012, .006, 4, 12), mat('#c8d4ea')); t.position.z = .1 + i * .05; sp.add(t); } // its turns
  // the thread itself, from the ball into the blades: a thin glowing line, a straight span between the two hands
  r.root.updateMatrixWorld(true);
  const a = sk.getWorldPosition(new THREE.Vector3()), b = r.threadEnd.getWorldPosition(new THREE.Vector3());
  r.root.worldToLocal(a); r.root.worldToLocal(b);
  const th = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1, 4), mat(SILVER, { basic: true })); th.userData.noOutline = true;
  th.position.copy(a).add(b).multiplyScalar(.5); th.scale.y = a.distanceTo(b); th.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  r.root.add(th); r.thread = th;
}

export function makeHeart() {
  const g = new THREE.Group();
  const c = '#e0354a', B = PXART ? { material: bkHeart() } : { basic: true }; // pixel art: each block bevelled, a glint on its lit corner
  box(g, .16, .16, .1, c, -.09, .1, 0, B); box(g, .16, .16, .1, c, .09, .1, 0, B);
  box(g, .34, .12, .1, c, 0, 0, 0, B); box(g, .2, .1, .1, c, 0, -.1, 0, B); box(g, .08, .08, .1, c, 0, -.18, 0, B);
  return g;
}

// ---------- animation ----------
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
// round 33: V's braids are simulated after every pose is done (her body as it will be drawn this frame)
export function animateRig(r, dt, st0) { if (!r.root?.userData.rb) batchRig(r); const out = animateRig0(r, dt, st0); if (r.hands) updateHands(r, st0); if (r.cape) r._capeSt = st0; if (r.ropes) simRopes(r, dt, st0 || {}); if (r.vbr) simBraids(r, dt, st0); return out; } // (v31b: the ropes first, so a cape is where it is now when the braids lie on it)
function animateRig0(r, dt, st0) {
  pxRig(r.root);
  // round 29 (Roy): in the air on her wings she does not walk or run: arms, hands and weapon stay still and ride with
  // her body (hoverRig lifts, bobs and leans it); the limbs see a still V, the wings and hover still see her real motion
  let st = st0;
  if (r.wings?.length && r._hw > .05 && st0.moving) { st = r._stAir ||= {}; for (const k in st) delete st[k]; Object.assign(st, st0, { moving: false, run: false }); } // characters wear the pixel shading (render.js)
  if (r.quad) return animateQuad(r, dt, st);
  r._fn = (r._fn || 0) + 1; r._pkWas = r._pk; r._pk = r._hipSet = false; // applyPose marks the frames it posed (models' fighting poses)
  r._fwWas = r._fwOn; r._fwOn = false; // and footwork the frames it planted her feet
  r._plWas = r._plOn; r._plOn = false; // and the frames it planted the legs (the stance blends in from elsewhere: motion 29.10)
  xfMode(r, st); // (motion 29.10: before last frame's overlays come off)
  if (r._undo) { for (const [o, q, p] of r._undo) { o.quaternion.copy(q); o.position.copy(p); } r._undo = null; } // last frame's carry, strain and edge roll (carryV, strainV, axeRoll) off first: they lie over the poses, which ease from their own values
  if (r._hov) { r.body.position.y -= r._hov.y; r.body.position.z -= r._hov.z; r.body.rotation.x -= r._hov.rx; r._hov = null; } // last frame's hover (hoverRig) off first
  const moving = st.moving;
  const spd = st.speed || 1;
  const gw = gaitPhase(r, dt, st, moving, spd); // (round 33 physics: the stride follows her real ground speed)
  const sw = moving ? Math.sin(r.phase) * .7 : 0;
  const k = 1 - Math.pow(.0005, dt);
  const lerp = (o, p, v) => { o[p] += (v - o[p]) * k; };
  const idle = !moving && !(st.attackT >= 0) && !(st.roll >= 0);
  const breath = Math.sin(r.phase * .6);
  const ds = r.dress?.visible ? .6 : 1; // in the long dress she takes shorter steps
  lerp(r.legL.rotation, 'x', sw * ds); lerp(r.legR.rotation, 'x', -sw * ds);
  r.hip.position.y = .9 + (moving ? Math.abs(Math.cos(r.phase)) * .045 : breath * .006);
  r.hip.rotation.z = idle ? Math.sin(r.phase * .27) * .025 : 0;
  if (gw > 0) gaitLegs(r, gw, ds); // planted feet: the legs and hips by IK, over the swing above as it blends in
  // arms: swing when walking, hang slightly open and breathe when idle
  let aL = -sw * .6, aR = sw * .6, aRz = idle ? .09 : 0, aLz = idle ? -.09 : 0, tY = 0, tX = moving ? .08 : breath * .015;
  if (idle) { aL += breath * .04; aR -= breath * .04; }
  if (st.block) { aL = -1.35; aLz = .55; }
  // on ice (entities.js iceStep): arms out for balance and a sway in the chest
  const slip = st.slip > .01 && !st.block ? st.slip : 0;
  if (slip) { aLz -= slip * .85; aRz += slip * .85; aL -= slip * .25; aR -= slip * .25; }
  r.torso.rotation.z += ((slip ? Math.sin(r.phase * .7 + 1) * .08 * slip : 0) - r.torso.rotation.z) * k;
  // talking: mouth flaps, small nods, the free hand gestures
  r.talkT = st.talk ? r.talkT + dt : 0;
  if (st.talk && idle && !st.block && !r.isV) { aR = -.35 + Math.sin(r.talkT * 2.3) * .22; aRz = .2; }
  const bare = !!(r.unarmed || r._stowed); // nothing in her hands: home clothes, or the weapons slung on her back
  if (r.mouth) { r.mouthH ??= r.mouth.scale.y; r.mouth.scale.y = r.mouthH * (st.talk && Math.sin(r.talkT * 19) > -.2 ? 2.6 : 1); }
  if (r.hdLips) for (const l of r.hdLips) l.scale.y = r.mouthH / r.mouth.scale.y; // HD lips part without stretching
  // blink
  r.blink -= dt;
  if (r.eyes && r.eyes.length) { const shut = r.blink < .11; for (const e of r.eyes) e.scale.y = shut ? .15 : 1; if (r.blink < 0) r.blink = 2.2 + Math.random() * 3; }
  if (r.hd && r.hd.px) { // pixel faces swap sprites instead of squashing them: shut eyes, an open mouth
    const P = r.hd.px, op = r.mouth.scale.y > r.mouthH * 1.3;
    for (const [o, c, e] of P.lids) { const sh = e.scale.y < .5; o.visible = !sh; c.visible = sh; c.scale.y = 1 / e.scale.y; }
    P.mouth[0].visible = !op; P.mouth[1].visible = op; for (const m of P.mouth) m.scale.y = r.mouthH / r.mouth.scale.y;
  }
  // head: look toward a point of interest
  let hy = 0, hx = (st.talk ? Math.sin(r.talkT * 5.2) * .07 : breath * .02) - (r.poiseW || 0) * .05; // V keeps her chin up
  if (st.look && r.root.parent && r.root.parent.isScene) {
    const p = r.root.position, d = wrap(Math.atan2(st.look.x - p.x, st.look.z - p.z) - r.root.rotation.y);
    if (Math.abs(d) < 1.9) hy = Math.max(-.9, Math.min(.9, d)) * (r.flip ? -1 : 1); // a mirrored rig turns its head the other way
  }
  r.head.rotation.y += (hy - r.head.rotation.y) * (1 - Math.pow(.02, dt));
  r.head.rotation.x += (hx - r.head.rotation.x) * (1 - Math.pow(.02, dt));
  if (st.windup !== undefined && st.windup >= 0) { aR = -2.8; aL = -1.2; }
  if (st.reach) { aL = -1.5; aR = -1.5; }
  if (st.kneel) { r.hip.position.y = .55; r.legL.rotation.x = -1.5; r.legR.rotation.x = .2; }
  lerp(r.armL.rotation, 'x', aL); lerp(r.armL.rotation, 'z', aLz);
  if (st.attackT !== undefined && st.attackT >= 0) {
    // snappy, unsmoothed swing: wind up, cut through, follow through
    const t = st.attackT, combo = st.combo || 0;
    if (combo === 2) {
      const c = ease((t - .18) / .3);
      r.armR.rotation.x = -2.9 + c * 2.5; r.armR.rotation.z = .1;
      r.torso.rotation.y = 0; r.torso.rotation.x = .05 + c * .35;
      r.hip.position.y = .9 - c * .14;
    } else {
      const dir = combo === 1 ? -1 : 1, c = ease((t - .12) / .32);
      r.armR.rotation.x = -1.35 - Math.sin(c * Math.PI) * .25;
      r.armR.rotation.z = dir * (1.0 - c * 1.65);
      r.torso.rotation.y = dir * (.85 - c * 1.75);
      r.torso.rotation.x = .1;
    }
    r.armL.rotation.x = -.6;
    r.handR.rotation.x = 1.25;
  } else {
    // round 24 (Roy: the first sword pointed at the floor): a held sword stands up in the fist, the blade near upright and
    // leaning a little forward (forearm raised, wrist cocked back), the arm swinging only a little as she walks. Other rigs'
    // swords (the old sword(): enemies, props) keep the blade-down rest.
    const held = !!(r.weaponR && r.weaponR === r.sword && !bare && (st.style || r.style || 'blade') === 'blade');
    if (held) { aR = aR * .3 - .32; if (!st.block) lerp(r.elbowR.rotation, 'x', -.72 - (moving ? Math.max(0, sw) * .15 : 0)); r.armR.rotation.z += (.08 - r.armR.rotation.z) * k; aRz = .08; }
    r.handR.rotation.x += ((held ? -.32 : r.sword && !bare ? 1.05 : 0) - r.handR.rotation.x) * k; // rest the blade pointing down
    lerp(r.armR.rotation, 'x', aR); lerp(r.armR.rotation, 'z', aRz);
    lerp(r.torso.rotation, 'y', tY);
    r.torso.rotation.x += (tX - r.torso.rotation.x) * k;
  }
  if (st.roll !== undefined && st.roll >= 0) {
    // a dive roll (Roy, round 20: a light leap forward that is already the roll, and never into the ground): she springs
    // off both feet with her knees coming up, turns over round her hips while still moving forward, curled tight (chin,
    // knees and arms in), rolls over her shoulders and back and opens out onto her feet. rollFloor (after every limb is
    // placed) lifts her body just clear of the ground at each instant, so the ground is where the roll touches.
    const t = st.roll, u = clamp((t - .05) / .85, 0, 1), th = Math.PI * 2 * u * u * (3 - 2 * u), tk = win(t, .03, .2, .76, .96);
    r.body.rotation.x = th; r.body.scale.setScalar(1);
    r.body.position.set(0, .9 - .9 * Math.cos(th), -.9 * Math.sin(th)); // turning round her hips
    r.hip.position.y = .9; r.hip.position.z = 0; // the tuck itself: rollTuck, once everything else has posed her
  } else {
    r.body.rotation.x = wrap(r.body.rotation.x) * (1 - k); r.body.position.multiplyScalar(1 - k); // 2π is upright: never unwind backwards
    r.body.scale.setScalar(r.body.scale.x + (1 - r.body.scale.x) * k);
  }
  r.body.rotation.z = st.stagger ? Math.sin(st.stagger * 30) * .15 : 0;
  // flinch: lean back from a hit
  if (st.flinch) r.body.rotation.x = -st.flinch * 1.6;
  // ---- extensions (weapon styles, skills, riding, sitting, drinking, cheering, held props) ----
  const style = bare ? 'blade' : st.style || r.style || 'blade'; // empty hands hold no guard (it read as a raised hand)
  if ((style !== 'blade' && r.elbowR) || ((st.move || (st.style && on(st.attackT))) && r.elbowR) || (st.block && r.isV && r.elbowR) || st.skill || st.ride || st.sit || on(st.drink) || on(st.cheer) || r.holds || st.drag) animateExt(r, dt, st, style, k);
  else if (r._ext) relaxExt(r, k);
  runPose(r, dt, st, style, moving);
  if (r.isV) poiseV(r, dt, st, k, idle && !slip && !st.block && !st.kneel && !st.reach && !st.sit && !st.ride && !st.skill && !on(st.drink) && !on(st.cheer) && !on(st.windup) && !r.holds && (bare || style === 'blade'), bare);
  if (on(st.roll) && !st.ride) rollTuck(r, st.roll, style, bare); // arms and weapon in, then clear of the ground
  if (r.snakes) wiggleSnakes(r, dt, st);
  if (r.isV) { carryV(r, dt, st, style, bare); strainV(r, dt, st, style, bare); trailV(r, dt, st, style, bare); axeRoll(r, dt, st, bare); } // round 33 (Roy): how she carries and holds her weapons
  xfApply(r, dt); bodyDyn(r, dt, st, idle); // motion 29.10: transitions crossfaded, the body answering its own motion
  if (r.wings?.length) hoverRig(r, dt, st0);
  if (r.tick) r.tick(r, dt, st);
  if (r.dress?.visible) { fitDress(r, dt, st); if (on(st.roll) && !st.ride) groundDress(r, st.roll); } // after every pose, story ticks included
  if (r.flaps || r.gearFlaps || r.backFlaps) fitFlaps(r, dt); // and every other skirt (round 18), and a cape (v31b)
  if (r.robes) { if (!st.sit && !st.ride && !r._pk) robeStride(r, r.longRobe ? .5 : .75); fitRobes(r, dt); } // and every robe (round 23)
  if (r.isV) { r._liveT = performance.now(); _vLive.add(r); } // (fx.js lays her swing's trail along her weapon's sharp part)
  if (on(st.roll) && !st.ride && (r.flaps || r.gearFlaps || r.backFlaps)) groundFlaps(r); // and in a roll, never through the ground
}
// Round 22 (Roy): with the dragon wings on, V hovers a little above the ground and that is her walk and run. She floats
// ~.36 m up (round 26; .3 before) with a slow bob in time with the wing beats, her legs in a flier's pose (one long, one
// bent) trailing behind as she goes, every blow and skill struck from the air (round 26), and she leans
// into her flight the way a flier must: forward with her speed (more at a run, and more while she speeds up, less as she
// slows), banking into her turns (the turn rate is read from the root's yaw). Pitch and bank turn about her middle, not
// her feet. Off for riding, sitting, kneeling, swimming and rolling, and in her home clothes (the wings are war gear).
// r.hovering tells the engine to skip her footsteps (see the round 22 report).
const HOVER_UP = .414; // the float of her flight, metres (round 33: .36 x 1.15)
function hoverRig(r, dt, st) {
  const worn = r.backSock?.visible !== false && !r.unarmed;
  r._swim = st.skill?.id === 'swim'; // (the player's and an online avatar's swim, entities.js / online/avatars.js: the wings fold, wingBeat)
  const fly = worn && r.wingFlight !== false && !st.ride && !st.sit && !st.kneel && !on(st.roll) && !r._swim && !st.dead; // (capes2: only flight wings lift her)
  r._hw = !fly && (on(st.roll) || st.ride || st.sit) ? 0 : clamp((r._hw || 0) + (fly ? dt * 3 : -dt * 3), 0, 1);
  const w = r._hw, sp = st.moving ? (st.run ? 1 : clamp((st.speed || 1) * .55, .2, .8)) : 0;
  r.hovering = w > .5;
  const yaw = r.root.rotation.y, turn = clamp(wrap(yaw - (r._hy ?? yaw)) / Math.max(dt, 1e-3), -5, 5); r._hy = yaw;
  const v = r._hv ||= { sp: 0, acc: 0, bank: 0, t: Math.random() * 6, beat: 0, fw: 0, lat: 0 }, kk = 1 - Math.exp(-dt * 5);
  // round 23 (Roy: "fly in the direction of the keys, sideways too, leaning a little toward where she goes"): the way she
  // really travels, read from the root's own motion and taken into her frame (forward, and across: +x is her left), so a
  // strafe (aiming, guarding: she faces one way and flies another) leans her into it and backing off tips her back.
  // A jump of more than 20 m/s is a teleport, not flight; no root motion at all (a viewer, a scene) falls back on st.
  const P = r.root.position, hp = r._hp ||= P.clone(), id = 1 / Math.max(dt, 1e-3), vx = (P.x - hp.x) * id, vz = (P.z - hp.z) * id; hp.copy(P);
  let fw = vx * Math.sin(yaw) + vz * Math.cos(yaw), lat = vx * Math.cos(yaw) - vz * Math.sin(yaw);
  if (Math.hypot(vx, vz) > 20 || (st.moving && Math.hypot(vx, vz) < .05)) { fw = sp * 6; lat = 0; }
  v.fw += (clamp(fw / 6, -.6, 1.2) - v.fw) * kk; v.lat += (clamp(lat / 6, -1, 1) - v.lat) * kk;
  const spd = clamp(Math.max(Math.abs(v.fw), Math.abs(v.lat)), 0, 1); // how fast, any way she flies (the beat and the legs' trail)
  const acc = (spd - v.sp) / Math.max(dt, 1e-3); v.sp += (spd - v.sp) * kk; v.acc += (clamp(acc, -3, 3) - v.acc) * kk;
  v.bank += (clamp(turn * (.05 + v.sp * .07) + v.lat * .22, -.4, .4) - v.bank) * kk;
  // round 26 (Roy: "attacking with wings, the whole animation must fit flight"): a blow or a skill is struck from the
  // air. v.str swells through the strike (a move's or a skill's own 0..1 time; a held charge is not a strike): the wings
  // beat harder and quicker, she pitches into it and lifts a little with the downstroke, and her legs counter it (the
  // straight leg sweeps back, the bent one draws up) instead of the ground poses' planted stance.
  const at = on(st.attackT) ? st.attackT : st.skill && st.skill.id !== 'chargeHold' && st.skill.id !== 'swim' && on(st.skill.t) ? st.skill.t : -1;
  v.str = (v.str || 0) + ((at >= 0 ? Math.sin(Math.PI * clamp(at * 1.15, 0, 1)) : 0) - (v.str || 0)) * (1 - Math.exp(-dt * 14));
  v.t += dt * (1.2 + v.sp * 1.3 + v.str * 2.2) * Math.PI * 2 * (worn ? 1 : 0); v.beat = Math.sin(v.t);
  wingBeat(r, v, w, dt);
  if (w <= 0) return;
  // round 26 (Roy: "20% higher, it's barely noticeable"): the float is .36 m (was .3), her lowest foot clear by ~.43;
  // round 33 (Roy: "15% higher, the feet roughly touch the floor"): .414 m
  const pitch = (.05 + v.fw * .17 + clamp(v.acc, -2, 2) * .03 * Math.sign(v.fw || 1) + v.str * .14) * w, h = .95, lift = (HOVER_UP + v.beat * (.042 + v.str * .03) + v.sp * .06 + v.str * .04) * w;
  r.body.rotation.z += v.bank * w; r.body.rotation.x += pitch; // (the body sits in the mirrored flip: +z here tips her head to her own left; round 22 had it the wrong way, she leaned out of her turns)
  // the fighting poses' hips: no crouch into a stance and no push over a planted front foot in the air, only a dip
  const H = r.hip, m = (o, p, val) => { o[p] += (val - o[p]) * w; };
  m(H.position, 'y', .9 - (.9 - H.position.y) * .25); m(H.position, 'z', H.position.z * .3);
  const y = lift + h * (1 - Math.cos(pitch)), z = -h * Math.sin(pitch);
  r.body.position.y += y; r.body.position.z += z; r._hov = { y, z, rx: pitch };
  // round 26 (Roy: "one leg stretched and one slightly bent, about 20%"): her flying legs, always (idle, flying, striking;
  // they take over from the walk, the run and the fighting poses' planted feet): the left stretched long, toe pointed down
  // and a little back, the right a little forward with its knee bent ~20% of the way; both trail back the faster she
  // flies, and drift slowly, out of step with each other
  const d = v.t * .32, tr = v.sp * .5, s = v.str;
  m(r.legL.rotation, 'x', .38 + tr * 1.2 + s * .3 + Math.sin(d) * .05); m(r.legR.rotation, 'x', -.3 + tr * 1.5 - s * .12 + Math.sin(d + 1.9) * .06);
  if (r.kneeL) { m(r.kneeL.rotation, 'x', .06 + v.sp * .06); m(r.kneeR.rotation, 'x', .55 + tr * .5 + s * .45 + Math.sin(d + .7) * .04); }
  m(r.legL.rotation, 'z', -.035); m(r.legR.rotation, 'z', .05); m(r.legL.rotation, 'y', 0); m(r.legR.rotation, 'y', 0);
}
// the wings: folded down her back when she isn't flying; hovering, slow full beats; at a walk, quicker; at a run they
// sweep back into a glide with short strokes
const WING_SWIM = [.2, -1.45]; // folded in the water: the sweep back off her back, and the turn down along it (radians)
function wingBeat(r, v, w, dt) {
  const b = v.beat, sp = v.sp, s = v.str || 0; // a strike: deeper, fuller strokes (round 26)
  let sweep = (1.25 * (1 - w) + w * (.45 + sp * .5 - s * .15 + b * (.08 + s * .1))), lift = (-.55 * (1 - w) + w * (.15 + (1 - sp) * .1 + b * (.42 - sp * .25 + s * .3)));
  if (r.wingFlight === false && r.backSock?.visible !== false && !r.unarmed) { // capes2: small wings (for show) never lift her: half open on her back, a slow flutter, quicker as she runs or strikes
    sweep = .78 - sp * .12 - s * .1 + b * (.05 + sp * .05); lift = .02 + b * (.07 + sp * .06 + s * .1);
  }
  // Roy 29.10 ("if you enter the water with wings, the wings should fold nicely, and you can still swim"): swimming, she
  // lies face down, so the standing fold (back and down) stood the wings straight up out of the sea. In the water they
  // close flat along her back instead, tips down past her hips, a little off her (clear of her seat and legs), still: no
  // beat, no flutter. In over ~.3 s (r._wsw, eased), and open again the same way as she comes out (any wings, any rig)
  const sw = r._wsw = clamp((r._wsw || 0) + (r._swim ? dt : -dt) / .3, 0, 1), e = sw * sw * (3 - 2 * sw);
  if (e > 0) { sweep += (WING_SWIM[0] - sweep) * e; lift += (WING_SWIM[1] - lift) * e; }
  const k = 1 - Math.exp(-dt * (sw > 0 ? 24 : 12)); // (in the water the wings follow the fold closely: it is the fold that eases)
  for (const p of r.wings) { const sx = p.userData.wing; p.rotation.y += (sx * sweep - p.rotation.y) * k; p.rotation.z += (sx * lift - p.rotation.z) * k; }
}
// V at rest stands tall: chest up, chin up, weight on the back leg with the front foot turned out, arms close at her
// sides. While she talks a hand now and then comes up with the words, then settles back. Hand targets in torso space
// the roll's arms: hands drawn in to her chest, the weapon held along her body (a long haft still shows past her),
// then the whole body lifted just clear of the ground (V's rolls; any rig with elbows)
const ROLL_PTS = [['head', [0, .44, 0]], ['head', [0, .2, -.21]], ['head', [0, .2, .21]], ['head', [0, .38, -.15]], ['head', [0, .38, .15]], ['head', [0, .05, -.18]], ['torso', [0, .38, -.22]], ['torso', [0, .1, -.24]],
  ['torso', [0, .38, .2]], ['hip', [0, -.08, -.18]], ['armL', [0, 0, 0]], ['armR', [0, 0, 0]], ['elbowL', [0, 0, 0]], ['elbowR', [0, 0, 0]],
  ['handL', [0, 0, 0]], ['handR', [0, 0, 0]], ['kneeL', [0, 0, 0]], ['kneeR', [0, 0, 0]], ['kneeL', [0, -.36, .14]], ['kneeR', [0, -.36, .14]], ['kneeL', [0, -.36, -.08]], ['kneeR', [0, -.36, -.08]]];
const _rlp = new THREE.Vector3();
// the outermost points of a piece of gear in its own space (one per direction of a 26-way star), found once
const _hull = new WeakMap(), HULL_DIRS = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) HULL_DIRS.push(new THREE.Vector3(x, y, z).normalize());
function hullPts(o) {
  let H = _hull.get(o); if (H) return H;
  o.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), best = HULL_DIRS.map(() => [-Infinity, null]);
  o.traverse((c) => {
    const a = c.isMesh && !c.userData.outline && c.geometry?.attributes?.position; if (!a) return;
    m.multiplyMatrices(inv, c.matrixWorld);
    for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m); HULL_DIRS.forEach((d, k) => { const s = v.dot(d); if (s > best[k][0]) best[k] = [s, v.clone()]; }); }
  });
  H = best.filter((b) => b[1]).map((b) => b[1]); _hull.set(o, H); return H;
}
function rollTuck(r, t, style, bare) {
  const tk = win(t, .03, .2, .76, .96);
  r.hip.position.y = .9; r.hip.position.z = 0; r.hip.rotation.y = 0;
  r.legL.rotation.set(-2.05 * tk, 0, -.06); r.legR.rotation.set(-1.9 * tk, 0, .06);
  if (r.kneeL) { r.kneeL.rotation.set(2.25 * tk, 0, 0); r.kneeR.rotation.set(2.15 * tk, 0, 0); }
  r.torso.rotation.set(.85 * tk, 0, 0); r.head.rotation.x = .55 * tk; r.head.rotation.y = 0;
  if (r.elbowR && tk > 0) {
    // blades and hafts held across her, side to side: turning head over heels never swings them into the ground
    const two = style === 'twohand' || style === 'polearm';
    if (two && !bare) twoHands(r, _hR.set(.12, .24, .26), _dR.set(-1, .05, .12), style === 'polearm' ? .3 : -.16, tk);
    else {
      armIK(r, 'R', _hR.set(.12, .24, .24), tk); if (!bare) aimHand(r, 'R', _dR.set(1, .05, .1), tk);
      if (style === 'dual' && !bare) { armIK(r, 'L', _hL.set(-.12, .24, .24), tk); aimHand(r, 'L', _dL.set(-1, .05, .1), tk); }
      else armIK(r, 'L', _hL.set(-.12, .26, .2), tk);
    }
  }
  rollFloor(r, t);
}
function rollFloor(r, t) {
  r.root.updateMatrixWorld(true);
  const base = r.root.matrixWorld.elements[13]; let lo = 9;
  for (const [n, p] of ROLL_PTS) { const o = r[n]; if (!o) continue; _rlp.set(p[0], p[1], p[2]); o.localToWorld(_rlp); lo = Math.min(lo, _rlp.y - base); }
  for (const o of [r.shield, r.shieldBack]) { // a shield, on her arm or slung on her back, rolls with her too
    if (!o?.visible || !o.parent) continue;
    for (const p of hullPts(o)) { _rlp.copy(p).applyMatrix4(o.matrixWorld); lo = Math.min(lo, _rlp.y - base); }
  }
  // her lowest point just touching the ground, plus the spring off it at the start (her feet leave it for the first half)
  r.body.position.y += .04 - lo + .3 * Math.sin(Math.PI * clamp(t / .5, 0, 1));
}
// (right hand; the left mirrors x), b = how much the hand beats with the words.
const POISE_G = [
  { R: [.2, .13, .3], b: .035 }, // an open hand forward
  { R: [.23, .15, .27], L: [-.23, .15, .27], b: .03 }, // both hands, opening out
  { R: [.07, .36, .2], b: .015 }, // a hand to her chest
  { R: [.36, .2, .25], b: .05 }, // a small flick out to the side
  { L: [-.21, .14, .29], b: .035 }, // the other hand forward
];
const _poV = new THREE.Vector3();
function poiseV(r, dt, st, k, on, bare) {
  r.poiseW = (r.poiseW || 0) + ((on ? 1 : 0) - (r.poiseW || 0)) * Math.min(1, dt * (on ? 3 : 12));
  if (!on && !r._pk) { r.armL.rotation.y *= 1 - k; r.armR.rotation.y *= 1 - k; } // the arm twist the hands-at-sides IK leaves (not a fighting pose's)
  const w = r.poiseW; if (w < .003) return;
  const T = r.torso, br = Math.sin(r.phase * .6), G = r.gest || (r.gest = { t: 0, d: 0, i: 0, gap: .3, L: 0, R: 0 });
  T.rotation.x += (-.05 + br * .01 - T.rotation.x) * w;
  // feet: weight on the right leg, the left a little ahead and out
  const hy = r.hip.position.y += (.89 + br * .004 - r.hip.position.y) * w, fy = FOOT_Y - (hy - .02) - r.body.position.y, hz = r.hip.position.z;
  legIK(r, 'L', fy, .08 - hz, -.09, w); legIK(r, 'R', fy, -.03 - hz, .05, w);
  if (!bare) return; // a sword and shield in hand keep their own rest
  // a gesture now and then while the words come (some lines get none)
  if (G.d > 0) { G.t += dt; if (G.t >= G.d) G.d = 0; }
  else if (st.talk && on) { if ((G.gap -= dt) <= 0) { G.gap = .5 + Math.random() * 1.6; if (Math.random() < .75) { G.i = (G.i + 1 + Math.floor(Math.random() * (POISE_G.length - 1))) % POISE_G.length; G.t = 0; G.d = 1 + Math.random() * .8; } } }
  else G.gap = .25 + Math.random() * .4;
  const P = POISE_G[G.i], e = G.d > 0 ? win(G.t / G.d, 0, .3, .66, 1) : 0, beat = Math.sin(G.t * 7.5) * (P.b || 0) * e;
  T.rotation.y += ((P.R && !P.L ? .07 : P.L && !P.R ? -.07 : 0) * e - T.rotation.y) * w; // the shoulder leans into the hand that speaks
  for (const [side, sx] of [['R', 1], ['L', -1]]) {
    const g = P[side], rest = _poV.set(sx * (.305 + br * .004), -.03, .04);
    if (g && e > 0) rest.set(rest.x + (g[0] - rest.x) * e, rest.y + (g[1] - rest.y) * e + beat, rest.z + (g[2] - rest.z) * e);
    armIK(r, side, rest, w);
  }
}
// ---------- round 33 (Roy): how V carries her weapons, out of a fight and in one ----------
// Out of a fight (st.calm, from entities.js; in town she slings them on her back instead):
//  - on foot, a weapon in one hand (a sword, axe or spear with a shield, a two-hander held in one hand by mastery, each of a
//    pair) hangs point-down by her side (CARRY_HANG, a touch forward and out from her leg);
//  - on foot, a weapon held in both hands (a two-hander below mastery) is carried upright in front of her;
//  - hovering on her wings, every weapon points forward and down at 45 degrees (36 for spears).
// Whatever the target, the angle flattens until the point and the middle of the weapon clear the ground under them by
// 12 cm (st.ground: the world's ground height), so long weapons and slopes never go into the floor. Every change eases over
// ~0.3 s, and a fight, a swing, a block, a skill, a ride or a roll hands her back to the fighting poses.
// In a fight (strainV): the fighting poses (weapon up), with the weapon tilted a little to the side and swaying slowly, as
// if it weighed on her. Axes and swords (axeRoll) turn about their haft so the edge faces down when carried low, forward
// when raised, and into the swing while she strikes.
const CARRY_HANG = 1.45, CARRY_UP = -1.32, CARRY_FLY = { spear: .63, polearm: .63 };
const _kcq = new THREE.Vector3(), _kcd = new THREE.Vector3(), _kcw3 = new THREE.Vector3(), _kcm = new THREE.Matrix4(), _kcg = new THREE.Vector3();
const busyV = (r, st) => on(st.attackT) || !!st.skill || !!st.block || !!st.ride || !!st.sit || !!st.kneel || !!st.reach || !!st.drag || !!r.holds
  || on(st.drink) || on(st.cheer) || on(st.roll) || on(st.windup) || !!st.dead;
// the steepest angle (from `a`, flattening) at which a weapon of length L held at torso-space h along root-frame pitch a clears
// the ground; returns the torso-space direction in d
function clearDir(r, st, h, a, L, out, d) {
  const T = r.torso.matrixWorld, hw = _kcq.copy(h).applyMatrix4(T), G = st.ground, sc = r.root.scale.y || 1;
  for (; ; a -= .04) {
    d.set(0, -Math.sin(a), Math.cos(a)).transformDirection(r.root.matrixWorld).transformDirection(_kcm); d.x += out; d.normalize();
    if (!G || a < -1.4) break;
    const wd = _kcw3.copy(d).transformDirection(T);
    const clear = (f) => { const x = hw.x + wd.x * L * sc * f, z = hw.z + wd.z * L * sc * f; return hw.y + wd.y * L * sc * f - G(x, z) >= .12 * sc; };
    if (clear(1) && clear(.6)) break;
  }
  return d;
}
// carryV, strainV and axeRoll lie over the poses: what they change is put back at the start of the next frame (animateRig0),
// so the poses always ease from their own values and nothing of the overlay builds up once it eases out
function keepPose(r) {
  const U = r._undo ||= [];
  for (const o of [r.armR, r.elbowR, r.handR, r.armL, r.elbowL, r.handL]) if (o && !U.some((e) => e[0] === o)) U.push([o, o.quaternion.clone(), o.position.clone()]);
}
// Roy 27.10 (his reference picture, a small knight): "the axe in the game points up instead of down": a one-handed sword
// or axe (style 'blade', with or without a shield) is held low in the right hand, the hand at the hip, the weapon across
// the front of the body, forward and up at about 33 degrees (CARRY_LOW), standing and walking, in a fight too (between
// blows; a blow, a block or a skill still takes the fighting poses); the edge turned down and forward (axeRoll)
const CARRY_LOW = -.66, CARRY_IN = -.5;
function carryV(r, dt, st, style, bare) {
  const W = r.weaponR, armed = !!W && !bare && W.visible !== false;
  const low = style === 'blade' && !r.weaponL; // (a one-handed sword or axe: the low hold in a fight as well)
  const want = !!((st.calm || low) && armed && !busyV(r, st));
  r._cw = on(st.roll) ? 0 : clamp((r._cw || 0) + (want ? dt * 3.5 : -dt * 5), 0, 1); // (motion 29.10: a dodge drops the carry at once, xfApply blends it out: fading under the tuck, the hand flipped over, ~160 degrees in one frame)
  const w = r._cw * r._cw * (3 - 2 * r._cw); if (w < .005) return;
  keepPose(r);
  const fly = r.wings?.length ? clamp(((r._hw || 0) - .2) / .6, 0, 1) : 0, dual = style === 'dual' && r.weaponL;
  const two = !dual && (style === 'twohand' || (style === 'polearm' && !(st.moving && st.run))); // both hands on it (the polearm sprint trails it in one)
  const mv = st.moving ? 1 : 0, ph = r.phase || 0, spearish = style === 'spear' || style === 'polearm';
  const flyA = CARRY_FLY[style] ?? .785, a0 = (two ? CARRY_UP : CARRY_HANG) + ((flyA - (two ? CARRY_UP : CARRY_HANG)) * fly);
  r.torso.updateWorldMatrix(true, false); _kcm.copy(r.torso.matrixWorld).invert();
  if (two) { // upright in front of her, the right hand at her chest and the left on the grip; low and forward in flight
    const h = _hR.set(.1 + .1 * fly, .2 - .1 * fly + mv * Math.abs(Math.cos(ph)) * .012, .24 - .04 * fly);
    const d = clearDir(r, st, h, a0, Math.max(.3, W.userData.tip || 1), .05 + .06 * fly, _kcd);
    armIK(r, 'R', h, w); aimHand(r, 'R', d, w);
    const g = style === 'twohand' ? (r.grip2 ?? -.2) : (spearish && fly < .5 ? .42 : .38);
    handToTorso(r, 'R', _gp.set(0, 0, g), _hL); armIK(r, 'L', _hL, w); aimHand(r, 'L', d, w);
    return;
  }
  if (low) { // in front of her hip, across the body, forward and up (in flight: forward and down, as before)
    const sw = mv * Math.sin(ph) * .025;
    const h = _hR.set(.25 - .04 * fly, .1 + mv * Math.abs(Math.cos(ph)) * .012, .2 + sw);
    const d = clearDir(r, st, h, CARRY_LOW + (flyA - CARRY_LOW) * fly, Math.max(.3, W.userData.tip || 1), CARRY_IN + (.14 - CARRY_IN) * fly, _kcd);
    armIK(r, 'R', h, w); aimHand(r, 'R', d, w);
    return;
  }
  // in one hand (or one in each): at her side, a little forward of the hip, swinging a little as she walks
  for (const [side, sx, Wp] of dual ? [['R', 1, W], ['L', -1, r.weaponL]] : [['R', 1, W]]) {
    const sw = mv * Math.sin(ph + (sx < 0 ? Math.PI : 0)) * .05;
    const h = (sx > 0 ? _hR : _hL).set(sx * .29, .07 + mv * Math.abs(Math.cos(ph)) * .015, .15 + sw);
    const d = clearDir(r, st, h, a0, Math.max(.3, Wp.userData.tip || 1), sx * .14, sx > 0 ? _kcd : _kcg);
    armIK(r, side, h, w); aimHand(r, side, d, w);
  }
}
// in a fight, standing ready (not striking): the weapon a little off upright, toward her weapon side, with a slow sway
const _ksq = new THREE.Quaternion(), _ksq2 = new THREE.Quaternion(), _ksz = new THREE.Vector3(0, 0, 1), _ksp = new THREE.Vector3(), _ksl = new THREE.Vector3();
function strainV(r, dt, st, style, bare) {
  const W = r.weaponR, want = !!(!st.calm && W && !bare && W.visible !== false && !busyV(r, st) && !(style === 'blade' && !r.weaponL)); // (a one-handed sword or axe: held low instead, carryV)
  r._sw = clamp((r._sw || 0) + (want ? dt * 3 : -dt * 6), 0, 1);
  const w = r._sw * r._sw * (3 - 2 * r._sw); if (w < .005) return;
  const t = (r._st = (r._st || 0) + dt), tilt = (.13 + Math.sin(t * 1.6) * .035 + Math.sin(t * 5.3 + 1) * .01) * w;
  const two = style === 'twohand' || style === 'polearm', dual = style === 'dual' && r.weaponL;
  keepPose(r);
  const tiltHand = (side, ang) => {
    const A = side === 'L' ? r.armL : r.armR, E = side === 'L' ? r.elbowL : r.elbowR, H = side === 'L' ? r.handL : r.handR;
    _ksq2.copy(A.quaternion).multiply(E.quaternion); // the hand's parent, in torso space
    _ksq.setFromAxisAngle(_ksz, ang);
    H.quaternion.premultiply(_ksq2).premultiply(_ksq).premultiply(_ksq2.invert());
  };
  if (two) { // turn the weapon in her right hand, then slide the left hand along the haft to its new line
    const pL = handToTorso(r, 'L', _ksl.set(0, 0, 0), _ksl.clone());
    tiltHand('R', -tilt);
    const pR = handToTorso(r, 'R', _ksp.set(0, 0, 0), new THREE.Vector3()), dir = handToTorso(r, 'R', _ksp.set(0, 0, 1), _ksp).sub(pR);
    const tt = pL.clone().sub(pR).dot(dir);
    armIK(r, 'L', pR.addScaledVector(dir, tt), w); aimHand(r, 'L', dir, w); // (motion 29.10: by w, not at once: the elbow swung to another plane in one frame as the stance came in, ~110 degrees)
  } else {
    tiltHand('R', -tilt);
    if (dual) tiltHand('L', tilt);
  }
}
// axes and swords (Roy: "the sharp part toward the floor, not to the sides"): the edge turned about the haft, to face down
// (carried low), forward (raised) or, while she strikes fast enough, along the swing. An axe's edge is the sharp point off
// the haft (weapons.js sharpPart); a sword's two edges lie across the blade's width (found once from its geometry), so
// it turns to whichever edge is nearer. Spears are left as they are.
const _kax = { v: new THREE.Vector3(), t: new THREE.Vector3(), m: new THREE.Matrix4(), z: new THREE.Vector3(), p: new THREE.Vector3() };
export function edgeAxis(W) {
  const U = W.userData; if (U._eAx) return U._eAx;
  const e = U.edge, st = U.style;
  if (!e || !(st === 'blade' || st === 'twohand' || st === 'dual')) return (U._eAx = { none: true });
  if (Math.hypot(e.b[0], e.b[1]) >= .12) return (U._eAx = { ang: Math.atan2(e.b[1], e.b[0]), sym: false }); // an axe: one edge
  // a sword: the blade's spread across x and y, over the outer half of its length
  W.updateWorldMatrix(true, true); _kax.m.copy(W.matrixWorld).invert();
  let sx = 0, sy = 0; const z0 = (U.tip || 1) * .45;
  W.traverse((o) => {
    if (!o.isMesh || o.userData.outline) return; const P = o.geometry.attributes.position; if (!P) return;
    const step = Math.max(1, Math.floor(P.count / 300));
    for (let i = 0; i < P.count; i += step) { const v = _kax.p.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld).applyMatrix4(_kax.m); if (v.z > z0) { sx = Math.max(sx, Math.abs(v.x)); sy = Math.max(sy, Math.abs(v.y)); } }
  });
  return (U._eAx = sx === 0 && sy === 0 ? { none: true } : { ang: sx >= sy ? 0 : Math.PI / 2, sym: true });
}
function axeRoll(r, dt, st, bare) {
  if (bare || r._stowed) return; // (slung on her back: stowWeapons seats it)
  const atk = on(st.attackT) || !!st.skill;
  for (const [W, H] of [[r.weaponR, r.handR], [r.weaponL, r.handL]]) {
    if (!W || !H || W.visible === false || W.parent !== H) continue;
    const X = edgeAxis(W); if (X.none) continue;
    const U = W.userData, roll = U._roll || 0;
    W.updateWorldMatrix(true, false); // the weapon as the pose holds it (no roll: last frame's is off, animateRig0)
    const M = W.matrixWorld, z = _kax.z.set(0, 0, 1).transformDirection(M), tip = _kax.t.set(0, 0, U.tip || 1).applyMatrix4(M);
    const prev = U._tipW ||= tip.clone();
    let v = null;
    if (atk && dt > 0) { v = _kax.v.copy(tip).sub(prev).divideScalar(dt); v.addScaledVector(z, -v.dot(z)); if (v.length() < 4) v = null; }
    prev.copy(tip);
    if (v || !atk) { // (between the fast parts of a blow it keeps the roll it has)
      if (!v) { // at rest: down, a little forward (her root frame), with the haft's own part taken out
        const f = _kax.v.set(0, 0, 1).transformDirection(r.root.matrixWorld);
        v = _kax.v.set(f.x * .3, -1, f.z * .3); v.addScaledVector(z, -v.dot(z));
      }
      // into the weapon's frame: the angle the edge should sit at about the haft (a sword: the nearer of its two edges)
      _kax.m.copy(M).invert(); v.transformDirection(_kax.m);
      let want = wrap(Math.atan2(v.y, v.x) - X.ang - roll);
      if (X.sym && Math.abs(want) > Math.PI / 2) want = wrap(want + Math.PI);
      const mx = .33 * dt * 60; // (Roy 29.10: at most ~20 degrees a frame at 60 fps: into a fast swing the edge turned up to ~110 degrees in one frame)
      U._roll = wrap(roll + clamp(want * (1 - Math.exp(-dt * (atk ? 22 : 8))), -mx, mx));
    }
    if (Math.abs(U._roll || 0) < 1e-4) continue;
    // her wrist turns the weapon about its own haft: the hand rolls about that line, so the grip on it never changes
    keepPose(r);
    const ax = _kax.p.set(0, 0, 1).applyQuaternion(W.quaternion), q = _ksq.setFromAxisAngle(ax, U._roll), wp = W.position;
    const d = _kax.v.copy(wp).applyQuaternion(q).sub(wp).negate().multiply(H.scale).applyQuaternion(H.quaternion);
    H.quaternion.multiply(q); H.position.add(d);
  }
}
// ---------- Roy 26.10 (campaign and online): the fast run, weapon swept back ----------
// Sprinting more than 30% over her base speed (entities.js sets st.trail) she runs
// as in Roy's references: the weapon arm about 95% straight, straight back from the shoulder at about chest height, the
// weapon trailing behind her, the chest pitched hard into the run with the head up, a free fist pumping in front of her
// chest, and a longer stride with the rear foot kicked higher (gaitPhase, gaitLegs). By weapon (TRAIL, her own frame:
// x out to the weapon side, y up, z ahead):
//  - a sword or an axe in one hand (and a two-hander held in one by mastery): the blade back and a little down;
//  - a pair: both arms back, one blade each side, mirrored (Roy: two weapons, both hands back);
//  - a great weapon held in both hands: let go with the left and dragged back in the right, steeper, its point low over
//    the ground (never in it: the same 12 cm clearance as the carry);
//  - a spear or polearm: let go with the left, held about its middle in the right (Roy), the shaft along her side, half
//    behind her and half ahead, a little down to the back.
// The other arm: with a shield on it (a sword or a hoplite spear) the shield is held steady a little forward and across
// her side, it does not pump (Roy: with a shield only the weapon arm goes back); with nothing in it, the fist pumps.
// Not with wings on (she hovers), nor with empty hands or the weapons slung on her back (in a town), nor while she strikes,
// blocks, rolls, casts, rides or slips. Eases in over ~0.4 s and out in ~0.25 s (~0.15 s when a blow takes over), the
// weapon swinging out past her side (swingHand); it lies over the poses like carryV (put back at the start of the next
// frame), so nothing snaps or builds up.
const TRAIL = { // a: the weapon arm's line from the shoulder (nearly straight: armReach from the shoulder), d: the weapon's line
  blade: { a: [.17, -.27, -.95], d: [.13, -.3, -.95] },
  dual: { a: [.21, -.3, -.93], d: [.2, -.32, -.93] },
  twohand: { a: [.17, -.36, -.92], d: [.15, -.5, -.85] }, // (steeper: the point skims the ground, never in it)
  spear: { a: [.17, -.27, -.95], d: [-.02, -.14, -.99], mid: true }, // held about its middle (Roy): half behind her, half ahead along her side at chest height
};
TRAIL.polearm = TRAIL.spear;
const ARM_BEND = .18; // (Roy: the arm about 95% straight: the elbow bent ~10 degrees)
const armReach = () => Math.sqrt(ARM1 * ARM1 + ARM2 * ARM2 + 2 * ARM1 * ARM2 * Math.cos(ARM_BEND)); // shoulder to hand at that bend
const _tr = { o: new THREE.Vector3(), p: new THREE.Vector3(), d: new THREE.Vector3(), w: new THREE.Vector3(), a: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), pole: new THREE.Vector3(),
  c: new THREE.Vector3(), h0: new THREE.Vector3(), s: new THREE.Vector3(), v: new THREE.Vector3(), q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), qa: new THREE.Quaternion() };
const slerpDir = (a, b, u, out) => { // unit a -> b by the share u of the arc between them
  const c = clamp(a.dot(b), -1, 1), th = Math.acos(c);
  if (th < 1e-4) return out.copy(b);
  const s = Math.sin(th); return out.copy(a).multiplyScalar(Math.sin((1 - u) * th) / s).addScaledVector(b, Math.sin(u * th) / s).normalize();
};
// turn a hand so the weapon goes from where the pose holds it (c) to d (torso space) by the share w, swinging out past her
// side (s) on the way: the shortest turn between a weapon held up in front and one trailed behind is near half a turn, and
// would flip from one way round to the other from frame to frame; by the side each half is well under that
function swingHand(r, side, d, s, w) {
  const L = side === 'L', A = L ? r.armL : r.armR, E = L ? r.elbowL : r.elbowR, H = L ? r.handL : r.handR;
  const h0 = handToTorso(r, side, _tr.v.set(0, 0, 0), _tr.h0), c = handToTorso(r, side, _tr.v.set(0, 0, 1), _tr.c).sub(h0).normalize();
  const R = _tr.q1;
  if (w <= .5) R.setFromUnitVectors(c, slerpDir(c, s, w * 2, _tr.v));
  else R.setFromUnitVectors(s, slerpDir(s, d, w * 2 - 1, _tr.v)).multiply(_tr.q2.setFromUnitVectors(c, s));
  _tr.qa.copy(A.quaternion).multiply(E.quaternion); // the hand's parent, in torso space
  H.quaternion.premultiply(_tr.qa).premultiply(R).premultiply(_tr.qa.invert());
}
function trailV(r, dt, st, style, bare) {
  const W = r.weaponR, armed = !!W && !bare && !r._stowed && W.visible !== false;
  const want = !!(st.trail && st.moving && st.run && armed && !r.wings?.length && !busyV(r, st) && !(st.slip > .05));
  const rate = want ? 2.6 : on(st.attackT) || st.skill || st.block || on(st.roll) ? 7 : 4;
  r._tw = clamp((r._tw || 0) + (want ? dt : -dt) * rate, 0, 1);
  const w = r._tw * r._tw * (3 - 2 * r._tw) * Math.min(1, (r.runK || 0) * 1.25); if (w < .005) return;
  const T = TRAIL[style] || TRAIL.blade, dual = style === 'dual' && r.weaponL, sc = r.root.scale.y || 1;
  keepPose(r);
  const U = r._undo; for (const o of [r.torso, r.head, W]) if (o && !U.some((e) => e[0] === o)) U.push([o, o.quaternion.clone(), o.position.clone()]);
  // leaning hard into the run (with the run's own lean, about 30 degrees), the head up and looking ahead
  r.torso.rotation.x += .42 * w; if (r.head) r.head.rotation.x -= .35 * w; // (Roy: a touch more, 26.10)
  if (T.mid && W.userData.butt !== undefined) W.position.z += (-((W.userData.tip || 1) + W.userData.butt) / 2 - W.position.z) * w; // the hand at the shaft's middle
  r.root.updateMatrixWorld(true); _tr.m.copy(r.torso.matrixWorld).invert();
  const R = r.root.matrixWorld, ph = r.phase || 0, bob = Math.abs(Math.cos(ph)) * .025, G = st.ground;
  for (const [side, sx, Wp] of dual ? [['R', 1, W], ['L', -1, r.weaponL]] : [['R', 1, W]]) {
    const A = side === 'L' ? r.armL : r.armR;
    // the hand: straight back from the shoulder along a (her own frame), with a slight bob, into torso space
    A.getWorldPosition(_tr.o);
    _tr.a.set(sx * T.a[0], T.a[1] + bob, T.a[2]).normalize();
    _tr.p.copy(_tr.a).transformDirection(R).multiplyScalar(armReach() * sc).add(_tr.o);
    // the weapon's line, flattened until its point and middle clear the ground by 12 cm
    const L = Math.max(.3, (Wp.userData.tip || 1) + Wp.position.z) * sc, hz = Math.hypot(T.d[0], T.d[2]);
    for (let pitch = Math.atan2(-T.d[1], hz); ; pitch -= .04) {
      _tr.d.set(sx * T.d[0] / hz * Math.cos(pitch), -Math.sin(pitch), T.d[2] / hz * Math.cos(pitch)).transformDirection(R);
      if (!G || pitch < -.3) break;
      const ok = (f) => _tr.p.y + _tr.d.y * L * f - G(_tr.p.x + _tr.d.x * L * f, _tr.p.z + _tr.d.z * L * f) >= .12 * sc;
      if (ok(1) && ok(.6)) break;
    }
    _tr.w.copy(_tr.p).applyMatrix4(_tr.m); _tr.d.transformDirection(_tr.m);
    armIK(r, side, _tr.w, w, _tr.pole.set(sx * .3, .6, -.4));
    swingHand(r, side, _tr.d, _tr.s.set(sx, -.35, -.15).transformDirection(R).transformDirection(_tr.m), w); // (out past her side, a little down and back)
  }
  if (dual) return; // (Roy: two weapons, both arms back)
  const shield = !!r.shield && r.shield.visible !== false && r.shield !== r.shieldBack, s = Math.sin(ph);
  if (shield) { // (Roy: with a shield only the weapon arm goes back) the shield held steady on the forearm, a little forward and across her side
    _tr.q.setFromEuler(_tr.e.set(-.7, 0, .28)); r.armL.quaternion.slerp(_tr.q, w);
    _tr.q.setFromEuler(_tr.e.set(-1.15, 0, 0)); r.elbowL.quaternion.slerp(_tr.q, w);
  } else { // the free arm pumps, fist up in front of her chest (a great weapon's or a spear's left hand let go of the haft)
    _tr.q.setFromEuler(_tr.e.set(-.75 - s * .6, 0, -.1)); r.armL.quaternion.slerp(_tr.q, w);
    _tr.q.setFromEuler(_tr.e.set(-1.55 - Math.max(0, s) * .35, 0, 0)); r.elbowL.quaternion.slerp(_tr.q, w);
  }
  _tr.q.identity(); r.handL.quaternion.slerp(_tr.q, w);
}
// sprinting: a real run laid over the walk, not the walk played faster. Long strides with the trailing shin kicked
// up, the leading knee lifting, elbows bent and pumping against the legs, the chest pitched into the wind.
function runPose(r, dt, st, style, moving) {
  const on = moving && st.run && !(st.attackT >= 0) && !st.skill && !st.ride && !st.block && !(st.roll >= 0) && !st.sit;
  const d = 1 - Math.pow(.004, dt);
  r.runK = (r.runK || 0) + ((on ? 1 : 0) - (r.runK || 0)) * d;
  const gait = (r._gait?.w || 0) > .01; // (round 33: the stride's IK has placed legs, knees and hips: walk and run alike)
  if (!on && r.kneeL) { // settle what only the run bends (the walk leaves knees and hip twist alone)
    if (!r._ext && !gait) { r.kneeL.rotation.x *= 1 - d; r.kneeR.rotation.x *= 1 - d; if (r.elbowL) { r.elbowL.rotation.x *= 1 - d; r.elbowR.rotation.x *= 1 - d; } }
    if (!r._hipSet) r.hip.rotation.y *= 1 - d; // a fighting pose sets the hips' turn itself
  }
  // kneeling on one knee: the front shin straight down, the back shin flat on the ground behind
  if (st.kneel && r.kneeL && !on) { r.legL.rotation.x = -1.45; r.kneeL.rotation.x = 1.5; r.legR.rotation.x = .25; r.kneeR.rotation.x = 1.65; r.hip.position.y = .5; }
  if (r.runK < .01 || !r.kneeL) return;
  const q = r.runK, s = Math.sin(r.phase), c = Math.cos(r.phase), mix = (a, b, w) => a + (b - a) * w;
  const sa = r.dress?.visible ? .62 : 1, ka = r.dress?.visible ? .45 : 1; // the long dress: shorter strides, the heels kept down
  if (!gait && on) { // (motion 29.10: not while she stops: once the stride had faded out this threw the legs back into a run, ~40 degrees in one frame)
    r.legL.rotation.x = mix(r.legL.rotation.x, s * 1.05 * sa - .12, q); r.legR.rotation.x = mix(r.legR.rotation.x, -s * 1.05 * sa - .12, q);
    r.kneeL.rotation.x = mix(r.kneeL.rotation.x, .3 + Math.max(0, s) * 1.45 * ka + Math.max(0, -c) * .25, q);
    r.kneeR.rotation.x = mix(r.kneeR.rotation.x, .3 + Math.max(0, -s) * 1.45 * ka + Math.max(0, c) * .25, q);
    r.hip.position.y = mix(r.hip.position.y, .86 + Math.abs(c) * .1, q);
  }
  r.hip.rotation.y = mix(r.hip.rotation.y, s * .14, q);
  r.torso.rotation.x = mix(r.torso.rotation.x, .32, q); r.torso.rotation.y = mix(r.torso.rotation.y, -s * .16, q);
  if (r.head) r.head.rotation.x = mix(r.head.rotation.x, -.22, q); // keep the eyes on the road while leaning in
  // long hafts stay steady (a great weapon keeps both hands on; the spear is trailed in the right hand, the left pumps)
  // (Roy 29.10: not over a blow's arms: as she stopped to strike, the fading pump swung the sword arm back down through the
  // cut's wind-up, the wrist turning ~70 degrees a frame; the blow's keys take the arms from where the run left them, chase)
  const blow = st.attackT >= 0 && r._pk, aq = blow ? 0 : q * (style === 'twohand' || style === 'polearm' ? 0 : style === 'spear' ? .3 : 1), aqL = blow ? 0 : style === 'polearm' ? q : aq;
  r.armL.rotation.x = mix(r.armL.rotation.x, -s * .95 - .15, aqL); r.armR.rotation.x = mix(r.armR.rotation.x, s * .95 - .15, aq);
  r.armL.rotation.z = mix(r.armL.rotation.z, -.12, aqL); r.armR.rotation.z = mix(r.armR.rotation.z, .12, aq);
  if (r.elbowL) { r.elbowL.rotation.x = mix(r.elbowL.rotation.x, -1.35 - Math.max(0, -s) * .3, aqL); r.elbowR.rotation.x = mix(r.elbowR.rotation.x, -1.35 - Math.max(0, s) * .3, aq); }
}
// ---------- round 33 (physics): a stride that matches the ground speed ----------
// The walk and the run used to swing the legs at a fixed cadence (10 rad/s x speed) through a low-pass that took ~40% of
// the swing away, so a planted foot still slid forward at about half her speed. Now the rig reads how fast its root
// really travels (in its own units, along its facing; backwards walks the cycle backwards) and the cycle follows it:
// each foot is set down ahead, stays where it was set while the body passes over it (it moves back under the hips at
// exactly the ground speed), lifts and swings through. Stride, cadence and the share of the cycle a foot is down come
// from the speed (a stroll: long contact, short steps; a run: a short contact, long strides and a flight between), the
// hips ride lower at the ends of a stride, and a slope she walks up or down (read from the root's own rise over its
// travel) puts each foot target on it. The legs are placed by legIK, so every humanoid with knees gets it; one walking
// in place (a wall, a viewer, a scene) keeps the old cadence from st.speed.
function gaitPhase(r, dt, st, moving, spd) {
  const G = r._gait ||= { x: NaN, y: 0, z: 0, v: 0, sl: 0, w: 0, D: .4, X: .3, H: .1, run: 0 };
  const P = r.root.parent?.isScene || !r.root.parent ? r.root.position : _ga.setFromMatrixPosition(r.root.matrixWorld);
  const sc = r.root.scale.y || 1, yaw = r.root.rotation.y;
  let vf = 0, rise = 0, ok = false;
  if (dt > 0 && G.x === G.x) {
    const dx = P.x - G.x, dz = P.z - G.z, dh = Math.hypot(dx, dz), v = dh / dt / sc;
    if (v < 20) { ok = true; vf = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / dt / sc; const vl = Math.sqrt(Math.max(0, v * v - vf * vf)); vf = Math.sign(vf || 1) * Math.hypot(vf, vl * .7); if (dh > 1e-4) rise = (P.y - G.y) / dh; }
  }
  G.x = P.x; G.y = P.y; G.z = P.z;
  const kv = 1 - Math.exp(-dt * 14);
  if (ok) { G.v += (vf - G.v) * kv; if (Math.abs(rise) < 1.2 && moving) G.sl += (rise - G.sl) * (1 - Math.exp(-dt * 6)); }
  if (!moving) G.sl *= Math.exp(-dt * 6);
  const real = moving && Math.abs(G.v) > .35, has = !!(r.kneeL && r.legL && r.hip);
  G.w = clamp(G.w + (real && has ? dt : -dt) * 9, 0, 1);
  const v = Math.abs(G.v), run = !!st.run;
  G.run += ((run ? 1 : 0) - G.run) * (1 - Math.exp(-dt * 8));
  // the stride for this speed: the share of the cycle a foot is down, how far it reaches ahead (and behind) of the hip
  G.D = clamp(.55 - .04 * v, .25, .5); G.X = clamp(.2 + .04 * v, .25, .46) / (1 + 1.4 * Math.min(.8, Math.abs(G.sl))) * (1 + .3 * (r._tw || 0)); // (shorter, quicker steps up or down a slope)
  G.H = clamp(.04 + .02 * v + .1 * G.run, .06, .3); // (motion 29.10: this sat inside the comment above, so every gait lifted its feet a fixed 10 cm)
  if (real) r.phase += dt * Math.sign(G.v) * Math.min(24, v * Math.PI * G.D / G.X); // the foot down moves X/(pi D) per radian: exactly her speed
  else r.phase += dt * (moving ? 10 * spd : 2);
  return G.w;
}
const _ga = new THREE.Vector3();
// the legs at this phase: each foot's target in the hip's frame (ahead +z), down or in its swing, by legIK (the fast run,
// r._tw from trailV: the rear foot kicked higher; gaitPhase lengthens its stride)
function gaitLegs(r, w, ds = 1) {
  const G = r._gait, D = G.D, tw = r._tw || 0, X = G.X * (ds < 1 ? .8 : 1), H = G.H * (ds < 1 ? .6 : 1) + .1 * tw, PD = Math.PI * D, E = LEG1 + LEG2 - .006;
  const foot = (u) => { // u: this leg's phase, 0 = under the hip in mid-contact
    u = Math.atan2(Math.sin(u), Math.cos(u));
    if (Math.abs(u) <= PD) return [-X * u / PD, 0, true];
    const s = ((u < 0 ? u + Math.PI * 2 : u) - PD) / (Math.PI * 2 - 2 * PD);
    return [-X * Math.cos(Math.PI * s), H * Math.sin(Math.PI * s), false];
  };
  const L = foot(r.phase), R = foot(r.phase + Math.PI);
  // the hips: as high as the leg down allows (the ends of a stride bring them lower), half the way (the rest is the heel and
  // the toe leaving the ground); in a flight between steps they keep the low of the stride's end
  const sl = clamp(G.sl, -.8, .8), zs = L[2] ? Math.abs(L[0]) : R[2] ? Math.abs(R[0]) : X, need = FOOT_Y + .02 + Math.sqrt(Math.max(0, E * E - zs * zs));
  const hy = .9 - Math.max(0, .9 - need) * .5 - .04 * G.run - Math.abs(sl) * X * .6; // (on a slope the downhill foot is further down)
  r.hip.position.y += (hy - r.hip.position.y) * w;
  const base = FOOT_Y - (r.hip.position.y - .02) - r.body.position.y;
  legIK(r, 'L', base + L[1] + sl * L[0], L[0] - r.hip.position.z, -.04, w);
  legIK(r, 'R', base + R[1] + sl * R[0], R[0] - r.hip.position.z, .04, w);
}
// ---------- motion 29.10 (Roy: "see how you make the character's movements smoother and more human") ----------
// 1. A change of what she is doing (setting off or stopping, a run, a guard, a skill, a drink, a cheer, sitting, riding, the
//    end of a blow or a roll) is crossfaded over ~0.1-0.2 s from the pose she showed last (xfMode / xfApply), so no bone jumps:
//    several poses are set outright (a skill's first frame, a stance's legs), and jumped up to ~130 degrees in one frame.
//    The start of a blow or a roll is never delayed (it takes over at once and cancels a blend). Laid over the poses like
//    carryV (put back at the start of the next frame), so the animation underneath runs exactly as before.
// 2. The body answers its own motion (bodyDyn), on springs (frame-rate independent): the chest leans into a start and rocks
//    back on a stop, the chest banks into a turn with the head leading it, the shoulders counter-turn over the hips as she walks
//    (the run had it already), and at rest she breathes (V and the online heroes). Read from the root's real motion, so it
//    works the same for the Player, the online figures and every humanoid that walks; off while she strikes, blocks, rolls,
//    casts, rides, sits, swims or hovers. Gameplay (positions, facing, hit timing) is untouched.
const XF_B = ['torso', 'head', 'armL', 'armR', 'elbowL', 'elbowR', 'handL', 'handR', 'hip', 'legL', 'legR', 'kneeL', 'kneeR'];
const XF_ALL = XF_B.map((_, i) => i), XF_UP = XF_ALL.slice(0, 8), XF_OFF = [2, 4, 6], XF_ARMS = [2, 3, 4, 5, 6, 7]; // (the upper body; the off arm; both arms)
const _xq = new THREE.Quaternion(), _xv = new THREE.Vector3();
function xfMode(r, st) { // before last frame's overlays come off: the bones still hold the pose that was shown
  const sk = st.skill && on(st.skill.t) ? st.skill.id : '', A = on(st.attackT), R = on(st.roll);
  const m = (st.moving ? 1 : 0) | (st.run ? 2 : 0) | (st.block ? 4 : 0) | (A ? 8 : 0) | (R ? 16 : 0) | (on(st.drink) ? 32 : 0) | (on(st.cheer) ? 64 : 0) | (st.sit ? 128 : 0) | (st.ride ? 256 : 0) | (st.kneel ? 512 : 0);
  const pm = r._xm, ps = r._xs; r._xm = m; r._xs = sk;
  if (pm === undefined || (pm === m && ps === sk)) return;
  const X = r._xf ||= { q: [], p: [], t: 0, d: 0 };
  if (A && !(pm & 8)) { // a blow starts now: its keys take over the weapon arm from the pose shown (chase); only the off arm of a sword or
    // hoplite spear (the others' off hand is on the haft), which the guard sets outright (shieldArm: ~60 degrees in one frame), is blended in
    // over 0.1 s; and a pair's or a great weapon's arms over 0.06 s out of their guard (not one of the keyed poses: the chase began from the arms as
    // the frame's first lines had already moved them, ~120 degrees in one frame)
    const sh = (st.style === 'blade' || st.style === 'spear') && !st.ride, du = (st.style === 'dual' || st.style === 'twohand') && !r._pkWas && !st.ride;
    if (!sh && !du) { X.t = X.d; return; }
    // (a sword or axe held low (carryV): the blow's keys take over from the hold as shown, which drops at once: faded out
    // under the keys it pulled the cut back down through its wind-up, ~60 degrees a frame at the wrist)
    if (sh && ((r._cw || 0) > .005 || (r._sw || 0) > .005)) { poseFromRig(r, r._Ps ||= new Array(PN).fill(0)); r._Pon = true; r._cw = r._sw = 0; } // (the hoplite's raised guard, strainV, as well)
    // (a great weapon held upright (calm) or in its swaying guard (strainV): the same, its off hand follows the haft; crossfaded, the blade wove about the
    // vertical, ~60 degrees a frame, the hands up to ~150)
    if (st.style === 'twohand' && !st.ride && ((r._cw || 0) > .005 || (r._sw || 0) > .005)) { poseFromRig(r, r._Ps ||= new Array(PN).fill(0)); r._Pon = true; r._cw = r._sw = 0; X.t = X.d; return; }
    let held = false; if (du && (r._cw || 0) > .005) { r._cw = 0; held = true; } // (a pair or a great weapon out of its calm hold: dropped at once, the arms' crossfade below takes them from it as shown, a little longer)
    X.ix = du ? XF_ARMS : XF_OFF; for (const i of X.ix) { const o = r[XF_B[i]]; if (!o) continue; (X.q[i] ||= new THREE.Quaternion()).copy(o.quaternion); (X.p[i] ||= new THREE.Vector3()).copy(o.position); }
    X.t = 0; X.d = du ? held ? .1 : .06 : .1; return;
  }
  // Roy 31.10: the guard raised out of a weapon held low or swaying (carryV, strainV, both overlays): it eases from the hold as
  // shown, which drops at once (left to fade out under the guard, the keys began from the pose beneath it: the point swung
  // the wrong way first and the guard took ~0.25 s to arrive)
  if ((m & 4) && !(pm & 4) && ((r._cw || 0) > .005 || (r._sw || 0) > .005)) { poseFromRig(r, r._Ps ||= new Array(PN).fill(0)); r._Pon = true; r._cw = r._sw = 0; }
  const ch = m ^ pm, R0 = R && !(pm & 16);
  const d = R0 ? .1 : sk !== ps ? (sk ? .14 : .2) : ch & (32 | 64 | 128 | 256 | 512) ? .2 : ch & 4 ? .1 : .15;
  // the legs only where their own blends do not reach (a skill, a drink, a cheer, sitting, riding, kneeling): setting off and
  // stopping hand the feet to the stride (gaitPhase) and the stance (applyPose), which keep them planted
  X.ix = R0 || sk !== ps || ch & (32 | 64 | 128 | 256 | 512) ? XF_ALL : XF_UP; // (a roll's tuck sets the legs outright)
  for (const i of X.ix) { const o = r[XF_B[i]]; if (!o) continue; (X.q[i] ||= new THREE.Quaternion()).copy(o.quaternion); (X.p[i] ||= new THREE.Vector3()).copy(o.position); }
  X.t = 0; X.d = d;
}
function xfApply(r, dt) {
  const X = r._xf; if (!X || X.t >= X.d) return;
  X.t += dt; const u = smooth(X.t / X.d); if (u >= 1) return;
  const U = r._undo ||= [];
  for (const i of X.ix) {
    const o = r[XF_B[i]]; if (!o || !X.q[i]) continue;
    if (!U.some((e) => e[0] === o)) U.push([o, o.quaternion.clone(), o.position.clone()]);
    _xq.copy(o.quaternion); o.quaternion.copy(X.q[i]).slerp(_xq, u);
    _xv.copy(o.position); o.position.copy(X.p[i]).lerp(_xv, u);
  }
}
// a damped spring toward target (w: stiffness rad/s, z: damping ratio), stepped in pieces of at most 1/60 s
function spring(S, k, target, w, z, dt) {
  for (let n = Math.ceil(dt * 60), h = dt / n; n > 0; n--) { S[k + 'v'] += (w * w * (target - S[k]) - 2 * z * w * S[k + 'v']) * h; S[k] += S[k + 'v'] * h; }
}
function bodyDyn(r, dt, st, idle) {
  const G = r._gait, T = r.torso, Hd = r.head; if (!G || !r.kneeL || !T || !Hd || !(dt > 0)) return;
  const D = r._bd ||= { v: 0, yaw: r.root.rotation.y, yr: 0, w: 0, wi: 0, t: Math.random() * 9, p: 0, pv: 0, b: 0, bv: 0, h: 0, hv: 0 };
  const acc = clamp((G.v - D.v) / dt, -90, 90); D.v = G.v;
  const yaw = r.root.rotation.y, dy = wrap(yaw - D.yaw); D.yaw = yaw;
  D.yr += (clamp(dy / dt, -12, 12) - D.yr) * (1 - Math.exp(-dt * 12));
  const free = !st.ride && !st.sit && !st.kneel && !on(st.roll) && !st.skill && !st.dead && !st.drag && !r.hovering && !(st.slip > .05);
  const want = free && !on(st.attackT) && !st.block && !on(st.windup) && !on(st.drink) && !on(st.cheer) ? 1 : 0;
  D.w += (want - D.w) * (1 - Math.exp(-dt * 8));
  D.wi += ((want && idle && r.isV ? 1 : 0) - D.wi) * (1 - Math.exp(-dt * 3));
  const sp = Math.abs(G.v);
  spring(D, 'p', clamp(acc * .005, -.1, .12) * (G.w > .01 || sp > .3 ? 1 : 0), 10, .45, dt); // lean into a start, back on a stop (and the rock forward after it)
  spring(D, 'b', clamp(-D.yr * Math.min(sp, 9) * .008, -.1, .1), 9, .7, dt); // banked into a turn, more the faster she goes
  spring(D, 'h', clamp(D.yr * .06, -.3, .3), 14, .8, dt); // the head leads a turn
  const w = D.w, wi = D.wi, gw = (G.w || 0) * (1 - (r.runK || 0)) * w;
  if (wi < .003 && (w < .003 || (gw < .003 && Math.abs(D.p) + Math.abs(D.b) + Math.abs(D.h) < .002))) return; // (standing still: nothing laid over, so whatever poses a figure after this frame keeps its say)
  const U = r._undo ||= []; for (const o of [T, Hd]) if (!U.some((e) => e[0] === o)) U.push([o, o.quaternion.clone(), o.position.clone()]);
  const s = Math.sin(r.phase), c = Math.cos(r.phase); // the walk (the run turns hips and shoulders itself: runPose)
  D.t += dt; const br = Math.sin(D.t * 1.55) * wi, sway = Math.sin(D.t * .73) * wi; // a breath every ~4 s, and a slow shift of her weight
  T.rotation.x += D.p * w - br * .022; T.rotation.y += D.h * .3 * w - s * .12 * gw; T.rotation.z += D.b * w + c * .03 * gw + sway * .014;
  Hd.rotation.x += -D.p * .55 * w + br * .012; Hd.rotation.y += D.h * .7 * w + s * .06 * gw; Hd.rotation.z += -D.b * .5 * w - sway * .01;
}
function animateQuad(r, dt, st) {
  r.phase += dt * (st.moving ? 14 : 2);
  const sw = st.moving ? Math.sin(r.phase) * .8 : 0;
  r.legs[0].rotation.x = sw; r.legs[3].rotation.x = sw; r.legs[1].rotation.x = -sw; r.legs[2].rotation.x = -sw;
  r.body.position.y = st.moving ? Math.abs(Math.sin(r.phase)) * .08 : 0;
  r.head.rotation.x = st.windup >= 0 ? -.4 : st.attackT >= 0 ? .3 : 0;
  r.tail.rotation.y = Math.sin(r.phase * .7) * .4;
  if (r.tick) r.tick(r, dt, st);
}

// ======================================================================================
// Extended animation: weapon styles, skills, riding, sitting, drinking, cheering, held props.
// Everything here only runs when one of the new state fields (or rig.style / rig.holds) is set,
// so rigs animated with the original fields behave exactly as before.
// ======================================================================================
const on = (v) => typeof v === 'number' && v >= 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const win = (t, a, b, c, d) => (t < a || t > d ? 0 : t < b ? smooth((t - a) / (b - a)) : t <= c ? 1 : 1 - smooth((t - c) / (d - c)));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3();
const _g = new THREE.Vector3(), _h = new THREE.Vector3(), _w = new THREE.Vector3();
const _m4 = new THREE.Matrix4(), _m5 = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const ARM1 = .3, ARM2 = Math.hypot(.32, .02), LEG1 = .44, LEG2 = .342, FOOT_Y = .1;

// Two-bone arm IK: puts the hand pivot of side 'L'|'R' at `tgt` (torso space). k blends (1 = snap).
const _apo = new THREE.Vector3();
export function armIK(r, side, tgt, k = 1, pole, lean = false) {
  const L = side === 'L', A = L ? r.armL : r.armR, E = L ? r.elbowL : r.elbowR;
  const d = _a.copy(tgt).sub(A.position);
  const dist = clamp(d.length(), .1, ARM1 + ARM2 - .004); d.normalize();
  const bend = Math.PI - Math.acos(clamp((ARM1 * ARM1 + ARM2 * ARM2 - dist * dist) / (2 * ARM1 * ARM2), -1, 1));
  const a1 = Math.acos(clamp((ARM1 * ARM1 + dist * dist - ARM2 * ARM2) / (2 * ARM1 * dist), -1, 1));
  const p = pole ? _b.copy(pole) : _b.set(L ? -.6 : .6, -.5, -1); // elbows point out, down and back
  // (Roy 29.10, motion; the keyed poses of a hand on its own: as the reach lines up with the pole (or against it) the elbow's plane is
  // undefined and the arm turned over in one frame (~100-140 degrees: a pair's overhead chop, the sword's): there the elbow leans out
  // instead (a pair's finisher (2) from further off: both arms come over the top together))
  if (lean) { const pc = Math.abs(d.dot(p.normalize())), a0 = lean === 2 ? .6 : .85; if (pc > a0) p.lerp(_apo.set(L ? -1 : 1, 0, 0), smooth((pc - a0) / (.97 - a0))).normalize(); }
  const n = _c.crossVectors(d, p);
  if (n.lengthSq() < 1e-6) n.set(L ? -1 : 1, 0, 0); n.normalize();
  const u = _d.copy(d).applyAxisAngle(n, a1);
  const y = _e.copy(u).negate(), z = _f.crossVectors(u, n).normalize(), x = _g.crossVectors(y, z);
  _m4.makeBasis(x, y, z); _q1.setFromRotationMatrix(_m4);
  if (k >= 1) A.quaternion.copy(_q1); else A.quaternion.slerp(_q1, k);
  E.rotation.set(E.rotation.x + (-bend - E.rotation.x) * k, E.rotation.y * (1 - k), E.rotation.z * (1 - k));
}
// Orient a hand so its +z (where weapons point) runs along `dir` (torso space).
export function aimHand(r, side, dir, k = 1, up, cont = false) {
  const L = side === 'L', A = L ? r.armL : r.armR, E = L ? r.elbowL : r.elbowR, H = L ? r.handL : r.handR;
  const z = _a.copy(dir).normalize();
  const u = up ? _b.copy(up) : Math.abs(z.y) > .92 ? _b.set(0, 0, -1) : _b.set(0, 1, 0);
  const x = _c.crossVectors(u, z).normalize();
  if (cont) handRoll(r, side, z, x);
  const y = _d.crossVectors(z, x);
  _m4.makeBasis(x, y, z); _q1.setFromRotationMatrix(_m4);
  _q2.copy(A.quaternion).multiply(E.quaternion).invert().multiply(_q1);
  if (k >= 1) H.quaternion.copy(_q2); else H.quaternion.slerp(_q2, k);
}
// Roy 29.10 (motion): the keyed poses' hand roll about the weapon kept continuous. The basis above turns the hand half round
// where the weapon passes aimHand's seam (|y| > .92) or over the top from behind (a great weapon's slam: the hands turned
// ~130-165 degrees in one frame, three times): a jump of over 90 degrees in a frame is taken as that and turned back by a
// half turn (phi), which then eases back out at ~5 degrees a frame once the weapon is clear of the vertical
const _hrx = new THREE.Vector3();
function handRoll(r, side, z, x) {
  const C = (r._hrc ||= {})[side] ||= { x: new THREE.Vector3(), f: -9, phi: 0 };
  if (C.f !== r._fn && C.f !== r._fn - 1) { C.x.copy(x); C.phi = 0; } // fresh: as the basis has it
  else if (C.f !== r._fn && Math.abs(z.y) < .8 && C.phi !== 0) { // once a frame, clear of the vertical: ease the half turn out
    C.phi = wrap(C.phi); C.phi -= Math.sign(C.phi || 1) * Math.min(Math.abs(C.phi), .09);
  }
  const roll = (a, o) => { const c = Math.cos(a), s = Math.sin(a); _hrx.crossVectors(z, o); return o.multiplyScalar(c).addScaledVector(_hrx, s); };
  roll(C.phi, x);
  if (x.dot(C.x) < 0) { C.phi = wrap(C.phi + Math.PI); x.negate(); }
  C.x.copy(x); C.f = r._fn;
}
// Point `p` given in a hand's space, expressed in torso space (from the local matrices, no world update needed).
function handToTorso(r, side, p, out) {
  const L = side === 'L', A = L ? r.armL : r.armR, E = L ? r.elbowL : r.elbowR, H = L ? r.handL : r.handR;
  A.updateMatrix(); E.updateMatrix(); H.updateMatrix();
  _m5.multiplyMatrices(A.matrix, E.matrix).multiply(H.matrix);
  return out.copy(p).applyMatrix4(_m5);
}
// Planar two-bone leg IK; y,z = foot target from the leg pivot (in the leg's splayed plane). Knee bends forward.
export function legIK(r, side, y, z, splay = 0, k = 1) {
  const Lg = side === 'L' ? r.legL : r.legR, K = side === 'L' ? r.kneeL : r.kneeR;
  const dist = clamp(Math.hypot(y, z), .16, LEG1 + LEG2 - .003);
  const phi = Math.atan2(z, -y);
  const a = Math.acos(clamp((LEG1 * LEG1 + dist * dist - LEG2 * LEG2) / (2 * LEG1 * dist), -1, 1));
  const b = Math.PI - Math.acos(clamp((LEG1 * LEG1 + LEG2 * LEG2 - dist * dist) / (2 * LEG1 * LEG2), -1, 1));
  Lg.rotation.x += (-(phi + a) - Lg.rotation.x) * k;
  Lg.rotation.z += (splay - Lg.rotation.z) * k;
  K.rotation.x += (b - K.rotation.x) * k;
}
// feet planted on the floor (FOOT_Y), hip lowered by `drop`, left foot `fwd` ahead, right foot `back` behind
function stance(r, drop, fwd, back, k, splay = .06, lift = 0) {
  const hy = .9 - drop; r.hip.position.y = hy;
  const hz = r.hip.position.z, y = FOOT_Y + lift - (hy - .02) - r.body.position.y;
  legIK(r, 'L', y, fwd - hz, -splay, k); legIK(r, 'R', y, -back - hz, splay, k);
}

// ======================================================================================
// V's fighting poses (round 16 rework: Roy asked for a better spear hold and combos with weight).
// A pose is authored in the body frame (x her right, y up from the hip pivot, z where she faces), whatever the hips and
// chest are doing, and turned into torso space once the twist is set, so a hand stays where it was put while the
// shoulders turn over it. Each rig keeps its live pose (r._P) and eases it toward the target, so guard, walk, block and
// every combo step flow into one another; a new move takes over within its first frames (the strike stays on its frame).
// Fields: h right hand, d its weapon dir, y shoulder-line turn (+: left shoulder forward; the hips take HIPY of it),
// p chest pitch, rz chest roll, dr hips lowered, f/b left foot ahead / right foot behind, l front foot lifted, hz hips
// pushed forward, j hop, s body spin, g where the off hand holds a haft (hand-local z; NaN = free), hl/dl the off hand and
// its dir (dual), sh shield arm (-1 drawn in, 0 carried, 1 rammed out, 2 raised to block), eu elbow up (overhand),
// gs the haft slid in the hand (1: rear hand near the butt, -1: held at the balance), w the feet set wider apart (radians of
// splay added to each leg: the guard's braced stance), e easing into the key
// (0 smooth, 1 strike: fast, settling into the pose, 2 accelerating, 3 even).
// ======================================================================================
const PIX = { h: 1, d: 4, y: 7, p: 8, rz: 9, dr: 10, f: 11, b: 12, l: 13, hz: 14, j: 15, s: 16, g: 17, hl: 18, dl: 21, sh: 24, eu: 25, e: 26, gs: 27, w: 28 }, PN = 29;
function pose(t, o, base) { // a key: fields from o, the rest from base (the key before it); e is never inherited
  const k = base ? base.slice() : new Array(PN).fill(0);
  if (!base) { k[6] = 1; k[17] = NaN; k[18] = k[19] = k[20] = NaN; k[23] = 1; k[27] = 1; }
  k[0] = t; k[26] = 0;
  for (const f in o) { const v = o[f], i = PIX[f]; if (Array.isArray(v)) v.forEach((x, j) => { k[i + j] = x; }); else k[i] = v; }
  return k;
}
// a move: [t, fields] steps, each inheriting from the one before; a step may be a whole pose (a guard to return to)
const seq = (base, ...ks) => { let prev = base; return ks.map(([t, o]) => (prev = Array.isArray(o) ? pose(t, { e: 0 }, o) : pose(t, o, prev))); };
const KS = new Array(PN).fill(0);
function sampleKeys(keys, t) {
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], v = clamp((t - a[0]) / Math.max(1e-4, b[0] - a[0]), 0, 1);
  const u = b[26] === 1 ? 1 - (1 - v) ** 3 : b[26] === 2 ? v * v * v : b[26] === 3 ? v : smooth(v); // (3: even, through a blow at full speed)
  for (let j = 1; j < PN; j++) { const x = a[j], y = b[j]; KS[j] = x !== x ? y : y !== y ? x : x + (y - x) * u; }
  return KS;
}
// ---- the two-handed spear (village_spear and every polearm): rear hand by the right hip near the butt, front hand on
// the mid-shaft, side-on with the left foot forward, point at a foe's face height ----
// (the stances keep the hips high: a deeper knee pushes the front thigh out through the war skirt)
const P_GUARD = pose(0, { h: [.22, .16, -.1], d: [-.13, .62, .78], y: 1.15, p: .08, dr: .03, f: .2, b: .22, g: .74, hz: .02 });
const CARRY = {
  polearm: {
    rest: P_GUARD,
    walk: pose(0, { h: [.24, .17, -.02], d: [-.1, .66, .74], y: .55, p: .05, g: .62 }), // the low port, point high
    run: pose(0, { h: [.3, .08, .06], d: [0, .45, .89], y: 0, p: 0, g: NaN, gs: -1 }), // trailed in one hand at the balance
    block: pose(0, { h: [.24, .24, .12], d: [-.68, .66, .32], y: .55, p: .02, dr: .06, f: .1, b: .2, g: .7 }), // haft across, rising to the left
  },
  // ---- scythes (polearms with a blade across the head, rig.reap): the same hands with the head carried low, so the
  // blade never crosses her face ----
  scythe: {
    rest: pose(0, { h: [.22, .2, -.06], d: [-.25, .5, .83], y: 1.15, p: .08, dr: .03, f: .2, b: .22, g: .6, hz: .02 }),
    walk: pose(0, { h: [.22, .22, .02], d: [-.25, .5, .83], y: .9, p: .05, g: .48 }),
    run: pose(0, { h: [.3, .08, .06], d: [0, .3, .95], y: 0, p: 0, g: NaN, gs: -1 }),
  },
  // ---- hoplite spear and shield: upright at her side at rest, sloped over the shoulder on the march, overhand behind
  // the raised shield when she blocks ----
  spear: {
    rest: pose(0, { h: [.31, .18, .12], d: [.03, .96, .27], y: .2, p: 0, dr: .03, f: .14, b: .12, sh: 0 }),
    walk: pose(0, { h: [.25, .5, .16], d: [.1, .62, -.78], y: .1, p: .03, sh: 0 }),
    block: pose(0, { h: [.31, .8, -.06], d: [0, -.12, 1], y: .25, p: .04, dr: .06, f: .1, b: .22, sh: 2, eu: 1 }),
  },
};
CARRY.spear.run = CARRY.spear.walk; CARRY.scythe.block = CARRY.polearm.block;
const S_HIGH = pose(0, { h: [.32, .8, -.1], d: [0, -.1, 1], y: .3, p: .02, dr: .08, f: .18, b: .2, sh: .3, eu: 1 }); // overhand ready
const B_REST = pose(0, { h: [.3, .12, .14], d: [.1, -.55, .83], y: .1, p: .04, dr: .04, f: .12, b: .12 }); // sword low, ready
const T_REST = pose(0, { h: [.12, .3, .42], d: [-.18, .68, .71], y: .3, p: .05, dr: .04, f: .15, b: .15, g: -.16 }); // great weapon up (left hand at the weapon's grip2)
const D_REST = pose(0, { h: [.3, .2, .2], d: [.12, -.3, .94], hl: [-.3, .2, .2], dl: [-.12, -.3, .94], y: 0, p: .05, dr: .04, f: .14, b: .14 });
const D_FIN = seq(D_REST, [0, {}], // both blades raised high, then driven down together
  // (Roy 29.10: raised a little sooner and brought over the top through a key of its own, then down at an even speed onto
  // the blow (50%, unchanged): straight from behind her head to the front the blades' line went through zero, and both arms
  // turned over in one frame, ~170 degrees)
  [.12, { h: [.24, .66, .3], d: [.12, .9, .4], hl: [-.24, .66, .3], dl: [-.12, .9, .4], y: 0, p: -.1, j: .03, dr: .03, f: .17, b: .15 }], // (up in front of her first)
  [.24, { h: [.2, .98, .02], d: [.15, .6, -.78], hl: [-.2, .98, .02], dl: [-.15, .6, -.78], y: 0, p: -.2, j: .06, dr: .02, f: .2, b: .16 }],
  [.38, { h: [.17, .92, .28], d: [.06, .86, .5], hl: [-.17, .92, .28], dl: [-.06, .86, .5], p: 0, j: .04, dr: .1, f: .28, b: .22, e: 3 }],
  [.5, { h: [.12, .3, .5], d: [-.1, -.6, .8], hl: [-.12, .3, .5], dl: [.1, -.6, .8], p: .42, dr: .3, f: .42, b: .3, hz: .12, j: 0, e: 3 }],
  [.7, { p: .44 }], [1, D_REST]);
// Steps, by the pose index the Player names (STYLE in entities.js; the hit frames there are where each strike lands)
const KEYS = {
  polearm: [
    // a straight thrust: the shaft drawn back through the front hand and the weight onto the back foot, then the hips and
    // shoulders whip square, the front foot steps and the rear hand drives the shaft out to meet the front one
    seq(P_GUARD, [0, {}],
      [.2, { h: [.26, .2, -.3], d: [-.12, .26, .96], y: 1.6, p: 0, dr: .12, f: .22, b: .28, g: .98, hz: -.06, l: .05 }],
      [.38, { h: [.18, .33, .42], d: [-.08, .09, 1], y: .8, p: .22, dr: .16, f: .46, b: .32, g: .34, hz: .15, l: 0, gs: 1.6, e: 1 }],
      [.52, { h: [.17, .33, .46], y: .75, p: .24 }], [1, P_GUARD]),
    // a sweep: the chest coils away to the right and takes the point with it, then the whole body unwinds and the
    // head cuts flat across her front and out to the left
    seq(P_GUARD, [0, {}],
      [.18, { h: [.105, .2, -.18], d: [.56, .12, .81], y: 1.9, p: .05, dr: .13, f: .26, b: .28, g: .72, hz: 0, l: .04 }],
      [.38, { h: [.2, .24, 0], d: [-.13, .1, .98], y: 1.15, p: .14, dr: .17, f: .44, b: .3, g: .66, hz: .12, l: 0, e: 2 }],
      [.52, { h: [.25, .24, .17], d: [-.77, .1, .63], y: .4, p: .14, dr: .16, g: .62, e: 1 }], [1, P_GUARD]),
    // the charged blow: drawn back over the shoulder, swung up over her head and smashed down in front
    seq(P_GUARD, [0, { h: [.22, .62, -.14], d: [.05, .75, .66], y: .7, p: -.15, dr: .2, f: .32, b: .25, g: .42 }],
      [.24, { h: [.22, .66, -.16], d: [.04, .8, .6], p: -.2, dr: .12, g: .33, j: .06 }],
      [.45, { h: [.22, .4, .26], d: [-.14, -.28, .95], y: .75, p: .34, dr: .3, f: .45, b: .35, g: .3, hz: .15, j: 0, e: 1 }],
      [.62, { p: .36 }], [1, P_GUARD]),
  ],
  // hoplite: an overhand thrust over the shield rim, an underhand thrust from the hip, then a leaping overhand lunge
  spear: [
    seq(S_HIGH, [0, {}],
      // (Roy 29.10: raised out by her side, not up through her shoulder (the arm's line undefined there: it turned over in a
      // frame, ~100 degrees), the elbow kept low and out)
      [.11, { h: [.45, .68, .06], d: [.02, .12, .99], y: .4, p: 0, dr: .07, f: .19, b: .21, sh: .3, eu: .2 }],
      [.2, { h: [.38, .82, -.18], d: [0, -.12, 1], y: .45, p: -.02, dr: .08, f: .2, b: .22, sh: .3, eu: .2, l: .04 }],
      [.4, { h: [.22, .64, .78], d: [-.08, -.2, .98], y: -.5, p: .2, dr: .14, f: .4, b: .28, hz: .12, sh: .1, eu: .2, l: 0, e: 3 }],
      [.55, { h: [.22, .63, .8] }], [1, S_HIGH]),
    seq(S_HIGH, [0, {}],
      [.1, { h: [.5, .46, .1], d: [0, .05, 1], y: .42, p: .04, dr: .11, f: .2, b: .22, sh: .35, eu: .55 }], // (Roy 29.10: down by her side from the overhand hold, not through her shoulder: the arm turned over, ~160 degrees)
      [.2, { h: [.34, .12, -.2], d: [0, .18, .98], y: .5, p: .05, dr: .14, f: .22, b: .24, sh: .4, eu: .15, l: .04 }],
      [.4, { h: [.22, .3, .72], d: [-.08, .14, .99], y: -.5, p: .24, dr: .2, f: .44, b: .3, hz: .14, sh: .2, l: 0, e: 1 }],
      [.55, { h: [.22, .3, .75] }], [1, S_HIGH]),
    seq(S_HIGH, [0, {}],
      [.12, { h: [.46, .7, .06], d: [.02, .1, .99], y: .45, p: -.03, dr: .05, f: .17, b: .23, sh: .45, eu: .5 }], // (out by her side, as the thrust)
      [.28, { h: [.38, .88, -.28], d: [0, -.08, 1], y: .65, p: -.08, dr: .04, f: .16, b: .26, sh: .6, eu: 1, l: .08, j: .07 }],
      [.5, { h: [.2, .58, .86], d: [-.08, -.22, .97], y: -.8, p: .32, dr: .26, f: .55, b: .38, hz: .2, sh: -.2, eu: .6, l: 0, j: 0, e: 1 }],
      [.7, { h: [.2, .57, .88] }], [1, S_HIGH]),
  ],
  // sword and shield: a forehand cut from high right to low left, a rising backhand, the charged overhead chop
  blade: [
    seq(B_REST, [0, { h: [.25, .12, .2], d: [-.44, .53, .72], y: .1, p: .04, dr: .04, f: .12, b: .12 }],
      // Roy 29.10 ("smooth the sword's first cut"): from the low hold (carryV, the first key) the blade swings up and out by
      // her right shoulder over the first 15% (it was flicked up in one frame and gone again in two, the hand turning ~75-95
      // degrees a frame), then cuts at an even speed through her front, crossing it at the blow (30%, entities.js STYLE:
      // unchanged), and slows on through to her left; the axe (style blade) shares these keys
      [.15, { h: [.4, .56, 0], d: [.62, .5, .05], y: .6, p: -.05, dr: .06, f: .14, b: .15, sh: -.3, eu: .2, e: 1 }],
      [.3, { h: [.1, .43, .47], d: [-.25, -.1, .96], y: -.25, p: .16, dr: .11, f: .29, b: .2, hz: .07, sh: .15, eu: 0, e: 3 }],
      [.5, { h: [-.12, .26, .36], d: [-.8, -.45, .4], y: -.6, p: .2, dr: .13, hz: .1, e: 1 }], [1, B_REST]),
    seq(B_REST, [0, {}],
      [.14, { h: [-.14, .34, .32], d: [-.75, .05, .66], y: -.7, p: .1, dr: .1, f: .2, b: .18, sh: -.2 }],
      [.3, { h: [.15, .5, .5], d: [.3, .15, .94], y: .25, p: .12, dr: .1, f: .26, b: .2, hz: .06, sh: .2, e: 1 }],
      [.42, { h: [.38, .62, .25], d: [.85, .35, .35], y: .65, p: .05, e: 1 }], [1, B_REST]),
    // (Roy 29.10: raised out by her right side first (straight up from the low hold the hand went through her shoulder,
    // the arm turning over, ~90 degrees a frame), and the chop at an even speed onto the blow (45%, unchanged) with the
    // elbow kept out (~110 degrees in a frame, front-loaded))
    seq(B_REST, [0, { h: [.42, .62, .18], d: [.3, .8, -.1], y: .5, p: -.15, dr: .15, f: .28, b: .22, eu: .4 }],
      [.16, { h: [.22, .9, -.1], d: [0, .55, -.85], y: .55, p: -.2, dr: .2, f: .32, b: .25, eu: .4 }],
      [.3, { h: [.12, 1, .15], d: [0, .9, .4], y: .3, p: -.15, eu: .3 }],
      [.45, { h: [.05, .38, .55], d: [0, -.4, .92], y: -.2, p: .3, dr: .28, f: .44, b: .32, hz: .15, eu: .15, e: 3 }],
      [.62, { p: .32 }], [1, B_REST]),
  ],
  // great weapons: a diagonal cut from over the right shoulder, the reverse sweep back, then the overhead slam
  twohand: [
    seq(T_REST, [0, {}],
      // (Roy 29.10: the cut speeds up over the right shoulder (not straight over the top, where the hand's turn about the
      // blade is undefined) and passes the blow (42%, unchanged) at full speed, instead of covering ~150 degrees in 5 frames,
      // accelerating, ~80 degrees in its last one)
      [.14, { h: [.3, .62, .2], d: [.6, .75, .2], y: .6, p: -.06, dr: .05, f: .18, b: .18, eu: .3 }], // (lifted out by her right shoulder on the way)
      [.27, { h: [.3, .8, -.05], d: [.3, .7, -.65], y: .9, p: -.12, dr: .08, f: .2, b: .2, eu: .5 }],
      [.37, { h: [.3, .62, .25], d: [.55, .62, .56], y: .3, p: .1, dr: .14, f: .3, b: .25, hz: .05, eu: .25, e: 2 }],
      [.42, { h: [.05, .32, .55], d: [-.4, -.25, .88], y: -.25, p: .3, dr: .2, f: .4, b: .3, hz: .1, eu: 0, e: 3 }],
      [.6, { h: [-.02, .28, .5], d: [-.75, -.3, .58], y: -.55, p: .3, dr: .22, e: 1 }], [1, T_REST]),
    seq(T_REST, [0, {}],
      [.28, { h: [-.12, .4, .4], d: [-.8, .25, .55], y: -.6, p: .1, dr: .12, f: .26, b: .22 }],
      [.42, { h: [.15, .42, .64], d: [.28, .05, .96], y: 0, p: .15, dr: .16, f: .38, b: .28, hz: .08, e: 2 }],
      [.6, { h: [.4, .48, .42], d: [.9, .12, .4], y: .7, p: .1, e: 1 }],
      [.8, { h: [.3, .45, .45], d: [.35, .7, .6], y: .5, p: .08 }], [1, T_REST]), // lifted back up to the guard
    // the slam: lifted by the right shoulder, raised overhead with the head hanging down her back, a hop as it comes over
    seq(T_REST, [0, {}],
      [.16, { h: [.26, .72, .12], d: [.2, .9, -.2], y: .5, p: -.1, dr: .06, f: .2, b: .2 }],
      [.32, { h: [.12, 1.06, 0], d: [.08, .55, -.83], y: .25, p: -.22, dr: .05 }],
      [.42, { h: [.1, 1, .18], d: [.04, .92, .38], j: .08 }],
      [.52, { h: [.1, .3, .69], d: [0, -.52, .85], y: 0, p: .32, dr: .32, f: .45, b: .35, hz: .15, j: 0, e: 1 }],
      [.75, { p: .34 }], [1, T_REST]),
  ],
  dual: [null, null, D_FIN, D_FIN],
};
// V's named combo moves (the Player gives them in st.move)
const MOVE_KEYS = {
  // sword 'bash': the shield drawn in and rammed out, then a stab through the gap it opened
  bash: seq(B_REST, [0, {}],
    [.12, { h: [.32, .34, .2], d: [0, .1, 1], y: -.5, p: .02, dr: .1, f: .18, b: .2, sh: -1 }], // (Roy 29.10: the sword hand kept off her shoulder, where the arm turned over)
    [.28, { y: .55, p: .15, f: .36, b: .24, hz: .12, dr: .14, sh: 1, e: 1 }],
    [.4, { sh: .8 }],
    [.48, { h: [.32, .4, .02], d: [0, .05, 1], y: .5, sh: 0 }],
    [.6, { h: [.12, .45, .62], d: [-.05, .02, 1], y: -.6, p: .2, f: .44, b: .3, hz: .16, dr: .16, sh: -.3, e: 3 }],
    [.75, { h: [.11, .45, .64] }], [1, B_REST]),
  // polearm 'spin': coiled low with the shaft across her front, then a full turn with it held out to her left, a hop
  // through the middle of the turn, and down into a low lunge with the point forward
  spin: seq(P_GUARD, [0, {}],
    [.16, { h: [.18, .36, .22], d: [-.85, .1, .5], y: .9, p: .1, dr: .22, f: .3, b: .3, g: .58, s: .6, hz: 0 }],
    [.3, { h: [.12, .34, .26], d: [-1, .06, .12], y: -.2, dr: .18, s: -.6, j: .1 }],
    [.5, { y: -.35, s: -3.3, j: .14 }],
    [.66, { s: -5.6, j: .04 }],
    [.78, { h: [.17, .3, .36], d: [-.07, .05, 1], y: .9, p: .22, dr: .3, f: .46, b: .36, hz: .12, g: .36, s: -6.283, j: 0, gs: 1.6, e: 1 }],
    [1, pose(1, { s: -6.283 }, P_GUARD)]),
  // dual 'cross': the right blade cuts from high right across, then the left from high left across
  cross: seq(D_REST, [0, {}],
    // (Roy 29.10: each blade raised out to its side and up, not back over the shoulder, then cut at full speed through its
    // blow (28% and 78%, unchanged): the old ones turned a blade ~130-150 degrees in one frame)
    [.13, { h: [.4, .52, .12], d: [.6, .6, .5], hl: [-.24, .35, .3], dl: [-.2, .1, .97], y: .45, p: 0, dr: .06, f: .2, b: .16 }],
    [.28, { h: [.02, .42, .45], d: [-.35, -.15, .92], hl: [-.3, .32, .14], dl: [-.35, .25, .9], y: -.25, p: .14, dr: .1, f: .26, b: .2, hz: .06, e: 3 }],
    [.4, { h: [-.06, .36, .4], d: [-.7, -.25, .67], hl: [-.36, .4, .1], dl: [-.6, .5, .5], y: -.45, p: .15, e: 1 }],
    [.6, { h: [.06, .32, .32], d: [-.4, -.3, .85], hl: [-.4, .52, .12], dl: [-.6, .6, .5], y: -.45 }],
    [.78, { hl: [-.02, .42, .45], dl: [.35, -.15, .92], h: [.3, .32, .14], d: [.35, .25, .9], y: .25, p: .14, e: 3 }],
    [.9, { hl: [.06, .36, .4], dl: [.7, -.25, .67], h: [.36, .32, .28], d: [.4, .3, .86], y: .4, p: .15, e: 1 }],
    [1, D_REST]),
  // dual 'flurry': three stabs, right, left, right, the chest turning behind each
  flurry: seq(D_REST, [0, {}],
    // (Roy 29.10: each hand drawn back only to in front of its shoulder (deep down by it, the arm unfolded ~90 degrees in a
    // frame on every stab) and driven out at an even speed onto each blow (15/45/75%, unchanged))
    [.07, { h: [.27, .42, .3], d: [0, 0, 1], hl: [-.2, .42, .32], dl: [0, 0, 1], y: .3, p: .1, dr: .08, f: .24, b: .2 }],
    [.15, { h: [.08, .42, .74], hl: [-.28, .42, .3], y: -.45, p: .25, dr: .12, f: .3, b: .22, hz: .08, e: 3 }],
    [.3, { h: [.27, .42, .3], hl: [-.24, .42, .32], y: .1 }],
    [.45, { h: [.28, .42, .3], hl: [-.08, .42, .74], y: .45, e: 3 }],
    [.6, { h: [.24, .42, .32], hl: [-.27, .42, .3], y: -.1 }],
    [.75, { h: [.08, .42, .74], hl: [-.28, .42, .3], y: -.45, e: 3 }], [1, D_REST]),
};
KEYS.dual[0] = MOVE_KEYS.cross; KEYS.dual[1] = MOVE_KEYS.flurry; // on horseback the moves fall back to these
const HIPY = .38; // share of the shoulder turn the hips take (the waist twists the rest)
// the shield arm by the sh channel: [sh, upper arm x, upper arm z, elbow x] (0 = the hoplite carry, across the body)
const SH = [[-1, -1, .5, -1.2], [0, -.95, .38, -.55], [1, -1.55, .15, -.1], [2, -1.4, .62, -.45]];
function shieldArm(r, s) {
  let i = 0; while (i < SH.length - 2 && s > SH[i + 1][0]) i++;
  const a = SH[i], b = SH[i + 1], u = clamp((s - a[0]) / (b[0] - a[0]), 0, 1), m = (j) => a[j] + (b[j] - a[j]) * u;
  r.armL.rotation.set(m(1), 0, m(2)); r.elbowL.rotation.set(m(3), 0, 0);
}
// the live pose from the rig as it stands (when it was last posed some other way), so the next pose eases from there
const _iq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _pd = new THREE.Vector3(), _po = new THREE.Vector3();
function poseFromRig(r, P) {
  const T = r.torso, H = r.hip;
  P[7] = H.rotation.y + T.rotation.y; P[8] = T.rotation.x; P[9] = T.rotation.z; P[10] = clamp(.9 - H.position.y, -.05, .5);
  P[14] = H.position.z; P[15] = 0; P[16] = r.body.rotation.y;
  _iq.copy(H.quaternion).multiply(T.quaternion);
  handToTorso(r, 'R', _po.set(0, 0, 0), _pp); handToTorso(r, 'R', _po.set(0, 0, 1), _pd).sub(_pp);
  _pp.applyQuaternion(_iq); _pd.applyQuaternion(_iq);
  P[1] = _pp.x; P[2] = _pp.y; P[3] = _pp.z; P[4] = _pd.x; P[5] = _pd.y; P[6] = _pd.z;
}
// ease the rig's live pose toward K (rate 1 = exactly K); NaN (a free off hand) takes over at once
const PFR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16]; // (the fields poseFromRig reads)
function chase(r, K, rate) {
  let P = r._P;
  if (r._Pon) { P = r._P ||= K.slice(); for (const j of PFR) P[j] = r._Ps[j]; } // (the low hold as shown, xfMode: also over a keyed pose under it, the run's)
  else if (!P || !r._pkWas) { P = r._P = K.slice(); poseFromRig(r, P); }
  r._Pon = false;
  for (let j = 1; j < PN; j++) {
    let x = P[j]; const y = K[j];
    if (j === 16) x += Math.round((y - x) / (Math.PI * 2)) * Math.PI * 2; // a finished turn is no turn: never unwind it
    P[j] = x !== x || y !== y ? y : x + (y - x) * rate;
  }
  return P;
}
const POLE_DN = new THREE.Vector3(.6, -.5, -1), POLE_UP = new THREE.Vector3(.8, .75, -.35), _pl = new THREE.Vector3();
const inline = (A, h, d) => _pl.copy(h).addScaledVector(d, -.32).sub(A.position).add(_po.set(0, -.12, 0)); // elbow pole (torso space)
// V's footwork through a combo (Roy, round 20: a small step in with every blow, the legs matching it). Each foot stays
// planted where it stands on the ground while her body moves and turns over it, then lifts and steps to where it will
// rest once the step in is done: the front (left) foot with the blow, the back foot once the move's last blow has landed
// (or sooner, when her hips have left it nearly out of reach). One foot at a time; a chained move carries on from where
// the feet are. F (entities.js Player): x, z, fa where she stands and faces, left the step still to come, hit when the
// move's last blow lands. E: the key the move ends on (its stance). Feet are kept as ground points (x, z).
const FW_THR = .08, FW_SIDE = .159, _fwo = { L: [0, 0, 0], R: [0, 0, 0] }, _fa = new THREE.Vector3();
const toLocal = (F, x, z, out) => { const dx = x - F.x, dz = z - F.z, c = Math.cos(F.fa), s = Math.sin(F.fa); out[0] = dx * c - dz * s; out[1] = dx * s + dz * c; return out; };
// a foot's rest spot in her own frame (x her left, z ahead) for a hip-space stance (hx, hz) under hip turn yaw and hip push pz
const restSpot = (hx, hzz, yaw, pz, out) => { const c = Math.cos(yaw), s = Math.sin(yaw), bx = hx * c + hzz * s, bz = -hx * s + hzz * c + pz; out[0] = -bx; out[1] = bz; return out; };
const _rs = [0, 0], _fl = [0, 0];
function ankleLocal(r, K, Lg, out) { // where the rig has a foot right now, in her own frame
  for (const o of [r.flip, r.body, r.hip, Lg, K]) o.updateMatrix();
  _m5.copy(r.flip.matrix).multiply(r.body.matrix).multiply(r.hip.matrix).multiply(Lg.matrix).multiply(K.matrix);
  _fa.set(0, -LEG2, 0).applyMatrix4(_m5); out[0] = _fa.x; out[1] = _fa.z; return out;
}
function footwork(r, P, F, E, atk, dt, y) {
  const c = Math.cos(F.fa), s = Math.sin(F.fa), sx = s, sz = c, hz = P[14];
  const mz = Math.sqrt(Math.max(.01, (LEG1 + LEG2 - .03) ** 2 - y * y)); // how far ahead or behind the hip a foot still reaches the ground
  let S = r._fw;
  if (!S || !r._fwWas) { // a fresh start: planted where the feet are now
    S = r._fw = { gap: 0 };
    for (const [k, Lg, K] of [['L', r.legL, r.kneeL], ['R', r.legR, r.kneeR]]) { ankleLocal(r, K, Lg, _fl); S[k] = { x: F.x + _fl[0] * c + _fl[1] * s, z: F.z - _fl[0] * s + _fl[1] * c, u: -1, lift: 0 }; }
  }
  r._fwOn = true; S.gap -= dt;
  for (const k of ['L', 'R']) {
    const f = S[k], o = _fwo[k];
    if (f.u >= 0) {
      f.u = Math.min(1, f.u + dt / f.dur); const e = smooth(f.u);
      f.x = f.ax + (f.bx - f.ax) * e; f.z = f.az + (f.bz - f.az) * e; f.lift = Math.sin(Math.PI * f.u) * f.h;
      if (f.u >= 1) { f.u = -1; f.lift = 0; S.gap = .02; }
    }
    toLocal(F, f.x, f.z, o);
    if (f.u < 0 && Math.abs(o[1] - hz) > mz) { const cz = clamp(o[1], hz - mz, hz + mz); f.x += sx * (cz - o[1]); f.z += sz * (cz - o[1]); o[1] = cz; } // out of reach: the planted foot drags after her
    o[2] = f.lift;
  }
  if (S.L.u < 0 && S.R.u < 0 && S.gap <= 0) {
    // how far each foot is from where it will rest when the step in is done
    const yawE = E[7] * HIPY, tL = restSpot(-FW_SIDE, E[11] - E[14], yawE, E[14], [0, 0]), tR = restSpot(FW_SIDE, -E[12] - E[14], yawE, E[14], _rs);
    tL[1] += F.left; tR[1] += F.left;
    const eL = Math.hypot(_fwo.L[0] - tL[0], _fwo.L[1] - tL[1]), eR = Math.hypot(_fwo.R[0] - tR[0], _fwo.R[1] - tR[1]);
    const far = _fwo.R[1] - hz < -mz * .8; // her hips have nearly left the back foot behind
    const goL = eL > FW_THR, goR = eR > FW_THR && (S.last === 'L' || atk >= F.hit - .05 || far || (!goL && F.left < .02) || eR > .5);
    // feet take turns, the front one first; the back foot leads only when it is being left behind
    const k = goR && (!goL || S.last === 'L' || (far && S.last !== 'R')) ? 'R' : goL ? 'L' : null;
    if (k) {
      const f = S[k], o = _fwo[k], t = k === 'L' ? tL : tR, d0 = Math.hypot(t[0] - o[0], t[1] - o[1]), dur = clamp(.075 + d0 * .14, .08, .16);
      t[1] = Math.min(t[1], hz + mz * .95 + F.left * Math.min(1, dur / Math.max(F.rem, .01))); // no further ahead than she reaches when it lands
      const d = Math.hypot(t[0] - o[0], t[1] - o[1]);
      f.ax = f.x; f.az = f.z; f.bx = F.x + t[0] * c + t[1] * s; f.bz = F.z - t[0] * s + t[1] * c; f.u = 0; S.last = k;
      f.dur = clamp(.075 + d * .14, .08, .16); f.h = clamp(.025 + d * .16, .03, .1); // a longer step: a little slower, a little higher
    }
  }
  return _fwo;
}
// a leg reaching for a foot spot (lx, lz) in her own frame: into the turned hips, then the leg's plane and its splay
function plantLeg(r, side, lx, lz, y, yaw, pz) {
  const bx = -lx, bz = lz - pz, c = Math.cos(yaw), s = Math.sin(yaw);
  const hx = bx * c - bz * s, hzz = bx * s + bz * c, dx = hx - (side === 'L' ? -.11 : .11);
  legIK(r, side, -Math.hypot(y, dx), hzz, Math.atan2(dx, -y), 1);
}
// put the rig in pose P. legs: plant the feet (else the walk keeps them); bob: hands' walking bob; o.ride: reins in the left
// fw: footwork for this frame ({F, fEnd, bEnd, atk}, V's combo steps), else the feet go where the pose puts them
function applyPose(r, P, style, legs, dt, ride, bob = 0, fw = null) {
  const T = r.torso, H = r.hip;
  // motion 29.10 (Roy: "smoother and more human"): the hips' share of the shoulder turn and the planted stance ease in
  // (~0.2 s) instead of jumping: a side-on guard put her hips square in one frame as she set off (~25 degrees) and threw her
  // legs from mid-stride into the stance as she stopped (~45 degrees); the turn as a whole is still P's
  r._hs ??= legs ? HIPY : 0; r._hs += ((legs ? HIPY : 0) - r._hs) * Math.min(1, dt * 12);
  const hs = r._hs;
  r._pk = true; r._hipSet = hs > .01;
  if (!ride) r.body.rotation.y = P[16];
  H.rotation.y = P[7] * hs; T.rotation.set(P[8], P[7] * (1 - hs), P[9]);
  if (legs) {
    r._plw = r._plWas ? Math.min(1, (r._plw || 0) + dt * 5) : Math.min(1, dt * 5); r._plOn = true; // (legs posed here last frame: carry on blending)
    const lk = fw ? 1 : smooth(r._plw); // (footwork plants the feet where they already are: nothing to blend)
    if (P[15] > 0) r.body.position.y = P[15];
    const hy = H.position.y += (.9 - P[10] - H.position.y) * lk; H.position.z = P[14];
    const y = FOOT_Y - (hy - .02), W = fw && footwork(r, P, fw.F, fw.E, fw.atk, dt, y);
    if (W) { plantLeg(r, 'L', W.L[0], W.L[1], y + P[13] + W.L[2], H.rotation.y, P[14]); plantLeg(r, 'R', W.R[0], W.R[1], y + W.R[2], H.rotation.y, P[14]); }
    else { legIK(r, 'L', y + P[13], P[11] - P[14], -.07 - P[28], lk); legIK(r, 'R', y, -P[12] - P[14], .07 + P[28], lk); }
  }
  r.head.rotation.y = -.8 * P[7]; r.head.rotation.x = -.6 * P[8]; // eyes stay on the foe
  // the haft slides in the hand: near the butt for two-handed work, at the balance when trailed in one hand
  const w = r.weaponR;
  if (w && r.gripZ && !r._stowed) w.position.z = r.gripZ * P[27];
  _iq.copy(H.quaternion).multiply(T.quaternion).invert();
  _hR.set(P[1], P[2] + bob, P[3]).applyQuaternion(_iq); _dR.set(P[4], P[5], P[6]).normalize().applyQuaternion(_iq);
  // on a haft held in both hands each elbow bends toward the point that would put its forearm in line with the shaft
  const haft = P[17] === P[17];
  armIK(r, 'R', _hR, 1, haft ? inline(r.armR, _hR, _dR) : _pl.copy(POLE_DN).lerp(POLE_UP, P[25]), haft || !r._blow ? 0 : P[18] === P[18] ? r._blow === 2 ? 2 : 0 : 1); aimHand(r, 'R', _dR, 1, null, true);
  r._gw = haft ? Math.min(1, (r._gw || 0) + dt * 7) : 0;
  if (haft) { // the off hand closes on the haft
    const g = style === 'twohand' ? r.grip2 ?? P[17] : P[17];
    handToTorso(r, 'R', _gp.set(0, 0, g), _hL);
    armIK(r, 'L', _hL, r._gw, inline(r.armL, _hL, _dR)); aimHand(r, 'L', _dR, r._gw, null, true);
  } else if (P[18] === P[18]) {
    _hL.set(P[18], P[19] + bob, P[20]).applyQuaternion(_iq); _dL.set(P[21], P[22], P[23]).normalize().applyQuaternion(_iq);
    armIK(r, 'L', _hL, 1, undefined, r._blow === 2 ? 2 : 0); aimHand(r, 'L', _dL, 1, null, true);
  } else if (ride) armIK(r, 'L', _hL.set(-.1, .28, .36), 1);
  else if (style === 'spear' || style === 'blade') shieldArm(r, P[24]);
}
const _hR = new THREE.Vector3(), _dR = new THREE.Vector3(), _hL = new THREE.Vector3(), _dL = new THREE.Vector3(), _gp = new THREE.Vector3(), _fwc = {};
const GUARD = { // idle hand pose (torso space) of the styles without a CARRY: right hand, blade dir, left hand / dir, grip
  twohand: { h: [.06, .3, .32], d: [-.2, .75, .62], g: -.16 },
  dual: { h: [.32, .14, .14], d: [.12, .42, .9], hl: [-.32, .14, .14], dl: [-.12, .42, .9] }, // round 24: blades up and forward, not into the floor
};
// Roy 31.10 ("when she presses the right button she should look like she is really defending herself: now the sword's move
// is almost invisible"): a guard of its own for every weapon, readable from the game camera (~29 m up at 56 degrees), so
// everything is pushed well past where a still figure would hold it: the weapon (or the shield) comes up to her face, she
// sinks into her knees with one foot back and turns her shoulder into the blow. Keys in V's pose fields (pose() above, body
// frame: x her right, y up from the hips, z ahead; the shoulders are at y .56, her face at ~.78).
//   sword or axe and a shield: the shield raised in front of her face (sh 2), the weapon cocked high over its rim, point at the foe
//   sword or axe alone: the blade across her face rising to the left, the off hand braced on its flat (or the axe's haft)
//   great sword / great axe: held flat over her head, the edge up, both hands on the grip, the point out to her right
//   two-handed spear (and a scythe, a staff): the haft barred across her chest at chin height, both hands wide on it
//   hoplite spear and shield: the shield raised, the spear overhand above it (as before, deeper)
//   a pair: both blades crossed in an X in front of her face
//   dagger: the dagger raised high, point at the foe, the free forearm barred across her chest
//   bow, great bow (and a bow with no arrows): the bow raised slantwise across her face as a bar, both hands on it
//   wand: the wand raised over her head toward the foe, the off hand thrust out, palm to the foe (the focus floats by it)
//   empty hands: forearms crossed in front of her face, fists up
// GUARD_IN: how fast she gets there (1 - e^-22t: two thirds in 0.05 s, 95% in 0.14 s); letting go eases back out over
// ~0.25 s (the carries' own rates, and xfMode's crossfade on the block flag).
const GUARD_IN = 22, G_LOW = { dr: .14, f: .18, b: .16, w: .22 }; // (the crouch: hips down 14 cm, the feet wide, the right one back)
const GP = (style, o) => ({ style, k: pose(0, { ...G_LOW, ...o }) });
const GUARD_POSE = {
  bladeShield: GP('blade', { h: [.36, .8, .02], d: [-.22, .68, .7], y: .45, p: .08, sh: 2, eu: .9 }),
  bladeFree: GP('blade', { h: [.3, .66, .3], d: [-.66, .66, .35], y: .3, p: .08, g: .38 }),
  twohand: GP('twohand', { h: [-.04, .76, .28], d: [.9, .28, .33], y: -.2, p: .06, g: -.16 }),
  polearm: GP('polearm', { h: [.32, .44, .22], d: [-.86, .36, .36], y: .35, p: .08, g: .72 }),
  scythe: GP('polearm', { h: [.32, .44, .22], d: [-.8, .52, .3], y: .35, p: .08, g: .62 }),
  spear: GP('spear', { h: [.31, .82, -.04], d: [0, -.14, 1], y: .45, p: .06, sh: 2, eu: 1 }),
  dual: GP('dual', { h: [.1, .58, .38], d: [-.55, .8, .2], hl: [-.1, .58, .38], dl: [.55, .8, .2], y: 0, p: .1 }),
  bare: GP('blade', { h: [.07, .76, .28], d: [-.3, .94, .15], hl: [-.07, .72, .3], dl: [.3, .94, .15], y: .15, p: .1 }),
  dagger: GP('dagger', { h: [.26, .8, .26], d: [-.28, .6, .75], hl: [-.04, .52, .4], dl: [.92, .3, .25], y: .3, p: .1, eu: .8 }),
  bow: GP('bow', { h: [.08, .7, .36], d: [-.74, .62, .25], hl: [-.2, .9, .4], dl: [-.3, .92, .25], y: .2, p: .08 }),
  wand: GP('wand', { h: [.26, .9, .18], d: [-.12, .75, .65], hl: [-.18, .62, .5], dl: [0, .55, .83], y: .15, p: .08, eu: .8 }),
  staff: GP('staff', { h: [.46, .64, .26], d: [-1, .14, .08], y: .2, p: .08, g: .9 }),
};
GUARD_POSE.greatbow = GUARD_POSE.bowmelee = GUARD_POSE.bow;
// the guard this rig takes now (null: none, the older paths go on): by weapon style, a shield on the arm or not
function guardPose(r, style) {
  if (r.unarmed || r._stowed || (!r.weaponR && !r.sword)) return GUARD_POSE.bare;
  if (style === 'blade') return r.shield && r.shield.visible !== false ? GUARD_POSE.bladeShield : GUARD_POSE.bladeFree;
  if (style === 'polearm' && r.reap) return GUARD_POSE.scythe;
  return GUARD_POSE[style] || null;
}
// the key with the recoil of a blow taken on the guard (st.guardHit 1 -> 0, entities.js): the hands driven back toward her
// chest and up, the chest knocked back, the knees giving a little more
const _gk = new Array(PN).fill(0);
function guardTarget(G, st) {
  const j = st.guardHit > 0 ? Math.min(1, st.guardHit) : 0, K = G.k; if (!j) return K;
  for (let i = 0; i < PN; i++) _gk[i] = K[i];
  _gk[3] -= .16 * j; _gk[2] += .05 * j; _gk[8] -= .3 * j; _gk[10] += .06 * j; _gk[14] -= .05 * j;
  if (_gk[18] === _gk[18]) { _gk[20] -= .16 * j; _gk[19] += .05 * j; }
  return _gk;
}
// BETA ONLINE JOBS (js/online/jobarms.js): the new styles' keyframes are added to these at run time, online only
export const POSES = { KEYS, GUARD, GUARD_POSE, CARRY, pose, seq };
export const OFF_MOUNTS = {}; // off hands that are no shield, by model id: { bone, pos, rot } (placeShield)
// right hand at h (torso space) with the weapon along d; the left hand takes the grip `g` units along the weapon
function twoHands(r, h, d, g, k) {
  armIK(r, 'R', h, k); aimHand(r, 'R', d, k);
  if (g === null || g === undefined) return;
  // (motion 29.10: along the haft where the right hand holds it now, by the same weight k: aimed at the final line at once,
  // the off hand turned up to ~170 degrees in one frame as a roll or a blend began)
  const g0 = r.grip2 ?? g; handToTorso(r, 'R', _gp.set(0, 0, g0), _hL); handToTorso(r, 'R', _gp.set(0, 0, g0 + 1), _dH).sub(_hL);
  armIK(r, 'L', _hL, k); aimHand(r, 'L', _dH, k);
}
const _dH = new THREE.Vector3();
function shieldFwd(r, k, lift = 0) { // hoplite carry: shield arm forward across the body
  r.armL.rotation.x += (-.95 - lift - r.armL.rotation.x) * k; r.armL.rotation.y *= 1 - k; r.armL.rotation.z += (.38 - r.armL.rotation.z) * k;
  r.elbowL.rotation.x += (-.55 - r.elbowL.rotation.x) * k;
}
function weaponVisible(r, v) { for (const w of [r.weaponR || r.sword]) if (w) w.visible = v; }

function animateExt(r, dt, st, style, k) {
  r._ext = true;
  const atk = on(st.attackT) ? st.attackT : -1, combo = st.combo || 0;
  const sk = st.skill && on(st.skill.t) ? st.skill : null;
  const two = style === 'twohand' || style === 'polearm', dual = style === 'dual', spear = style === 'spear';
  const T = r.torso, kk = k;
  const hideW = on(st.drink) || (sk && (sk.id === 'prophecy' || sk.id === 'swim'));
  let armsDone = false, legsDone = false, gripG = null, spun = false, keys = null, G = null;
  // ---- lower body: riding / sitting ----
  if (st.ride) {
    const b = st.rideBob || 0;
    r.hip.position.y = .9 + Math.sin(b * Math.PI * 4) * .012; r.hip.position.z *= 1 - k; r.hip.rotation.z = 0;
    legIK(r, 'L', -.56, .14, -.5, k); legIK(r, 'R', -.56, .14, .5, k);
    T.rotation.x += (.1 + Math.sin(b * Math.PI * 2) * .05 - T.rotation.x) * k;
    legsDone = true;
  } else if (st.sit) {
    r.hip.position.y = .47; r.hip.position.z += (-.12 - r.hip.position.z) * k; r.hip.rotation.z = 0;
    const y = FOOT_Y - (.47 - .02);
    legIK(r, 'L', y, .44, -.08, k); legIK(r, 'R', y, .4, .1, k);
    T.rotation.x += (-.04 - T.rotation.x) * k;
    legsDone = true;
  } else r.hip.position.z *= 1 - k;
  if (r.body.position.y > 0 && !(on(st.roll))) r.body.position.y *= 1 - k;

  // ---- actions (highest priority first) ----
  if (sk) {
    skillPose(r, sk.id, sk.t, style, legsDone || !!sk.walk, sk.v || 0); // round 31: walking through a skill, her legs keep the walk (sk.walk, entities.js)
    armsDone = true; legsDone = true;
  } else if (st.drag) { // hauling something heavy on a rope over her right shoulder (giants.js): both fists at the shoulder, leaning into it
    const s = Math.sin(r.phase * 2) * .035 * (st.moving ? 1 : .3);
    T.rotation.x += ((st.moving ? .4 : .18) + s - T.rotation.x) * k; T.rotation.y += (-.16 - T.rotation.y) * k;
    r.head.rotation.x += (-.28 - r.head.rotation.x) * k;
    armIK(r, 'R', _hR.set(.17, .66 + s, .12), 1); armIK(r, 'L', _hL.set(.03, .5 + s, .2), 1);
    armsDone = true;
  } else if (on(st.drink)) {
    const t = st.drink, w = win(t, 0, .22, .82, 1);
    if (!r.flask) r.flask = makeFlask(r.handR);
    r.flask.visible = t < .97; weaponVisible(r, false); r._drinkHid = true;
    if (st.drinkColor && r.flask.userData.liquid) r.flask.userData.liquid.material = mat(st.drinkColor);
    const tilt = win(t, .3, .45, .78, .9), flo = win(t, .8, .88, .96, 1);
    r.flask.scale.setScalar(1.5); // big enough to read from the game camera
    if (r.flask.userData.cork) r.flask.userData.cork.visible = t < .34; // uncorked just before the first gulp
    r.head.rotation.x = -.62 * tilt;
    r.torso.rotation.x += (-.28 * tilt + .12 * flo - r.torso.rotation.x) * Math.min(1, k * 3); // lean back to drain it, then straighten with a flourish
    if (!st.ride && !st.sit) r.hip.position.y -= .05 * tilt;
    armIK(r, 'R', _hR.set(.24 - .2 * w, .28 + .5 * w + .05 * tilt, .2 + .1 * w), 1);
    aimHand(r, 'R', _dR.set(-.35 * w, .3 + .55 * tilt, 1 - 1.6 * w * tilt).normalize(), 1);
    if (!dual && !legsDone && !st.ride) { r.armL.rotation.x += (-.15 - r.armL.rotation.x) * k; r.elbowL.rotation.x += (-.3 - r.elbowL.rotation.x) * k; }
    if (st.ride) armIK(r, 'L', _hL.set(-.1, .28, .36), k);
    armsDone = true;
  } else if (on(st.cheer)) {
    const t = st.cheer, w = win(t, 0, .16, .82, 1), hop = st.ride || st.sit ? 0 : Math.sin(Math.PI * clamp(t / .32, 0, 1));
    if (!legsDone) { r.body.position.y = hop * .22; stance(r, -.02 * w, .08, .08, 1, .1, hop * .12); legsDone = true; }
    const pump = Math.sin(t * Math.PI * 6) * .05 * w;
    if (two) twoHands(r, _hR.set(.08, .55 + .55 * w + pump, .1 + .05 * (1 - w)), _dR.set(0, 1, .15), style === 'polearm' ? .3 : -.16, 1);
    else {
      armIK(r, 'R', _hR.set(.32 + .02 * (1 - w), .22 + .9 * w + pump, .05 + .12 * (1 - w)), 1, _a.set(1, -.2, -.3)); aimHand(r, 'R', _dR.set(.12, 1, .1), 1);
      if (dual) { armIK(r, 'L', _hL.set(-.32, .22 + .9 * w - pump, .05), 1, _a.set(-1, -.2, -.3)); aimHand(r, 'L', _dL.set(-.12, 1, .1), 1); }
      else armIK(r, 'L', _hL.set(-.38, .3 + .45 * w + pump * 2, .12), 1);
    }
    r.head.rotation.x = -.25 * w;
    armsDone = true;
  } else if (atk >= 0 && (keys = st.ride ? style === 'blade' ? null : KEYS[style]?.[combo % KEYS[style].length] : st.move ? MOVE_KEYS[st.move] : KEYS[style]?.[combo % KEYS[style].length])) {
    // every style's steps (blade on horseback keeps the old cut): the live pose takes over from wherever the last move
    // left her by the first 20% of the move, then follows the keys exactly (Roy 29.10: per second, not per frame, and gentler
    // in its first frames: 35% of the way in the first frame moved a hoplite's hand ~120 degrees)
    const E = keys[keys.length - 1], fw = st.feet && !st.ride && st.move !== 'spin' ? (_fwc.F = st.feet, _fwc.E = E, _fwc.atk = atk, _fwc) : null; // the spin turns on its own feet
    r._blow = keys === D_FIN ? 2 : 1; // (a blow's arms: armIK leans an elbow out where its plane is undefined; a pair's only in the overhead finisher)
    applyPose(r, chase(r, sampleKeys(keys, atk), Math.max(1 - Math.exp(-dt * (10 + 300 * atk)), smooth(atk / .2))), style, !legsDone, dt, st.ride, 0, fw);
    r._blow = 0;
    armsDone = legsDone = spun = true;
  } else if (st.block && !st.ride && !st.sit && (G = guardPose(r, style))) {
    // Roy 31.10: the guard, a keyed pose of its own for every weapon (GUARD_POSE): eased in over ~0.12 s, a recoil laid over
    // it when a blow is taken on it (st.guardHit); walking, the legs keep the stride and only the upper body guards
    const legs = !legsDone && !st.moving && !on(st.roll);
    applyPose(r, chase(r, guardTarget(G, st), 1 - Math.exp(-dt * GUARD_IN)), G.style, legs, dt, false, 0);
    if (legs) legsDone = true;
    armsDone = true;
  } else if (atk >= 0) {
    // blade style keeps the original cut; riding keeps the left hand on the reins
    if (st.ride) armIK(r, 'L', _hL.set(-.1, .28, .36), k);
    armsDone = true;
  }
  if (r._drinkHid && !hideW) { weaponVisible(r, true); r._drinkHid = false; if (r.flask) r.flask.visible = false; }

  // ---- idle arms ----
  if (!armsDone) {
    if (st.ride) {
      if (two && style === 'polearm') twoHands(r, _hR.set(.2, .28, .2), _dR.set(-.05, .45, .9), null, k);
      else if (two) twoHands(r, _hR.set(.22, .3, .3), _dR.set(.1, .9, .3), null, k);
      else if (!dual && !two && !(r.weaponR || r.sword)) armIK(r, 'R', _hR.set(.1, .28, .36), k);
      else if (dual) { armIK(r, 'R', _hR.set(.16, .26, .34), k); aimHand(r, 'R', _dR.set(.3, -.3, .9), k); }
      else { armIK(r, 'R', _hR.set(.12, .28, .36), k); r.handR.rotation.x += (.9 - r.handR.rotation.x) * k; }
      if (!dual) armIK(r, 'L', _hL.set(-.1, .28, .36), k);
      else { armIK(r, 'L', _hL.set(-.16, .26, .34), k); aimHand(r, 'L', _dL.set(-.3, -.3, .9), k); }
      armsDone = true;
    } else if (st.sit && !st.talk) {
      armIK(r, 'L', _hL.set(-.18, .05, .28), k); armIK(r, 'R', _hR.set(.18, .05, .28), k);
      armsDone = true;
    } else if (CARRY[style]) { // the spears: guard, march, run and block carries, eased into one another
      const C = r.reap ? CARRY.scythe : CARRY[style], mv = st.moving, legs = !legsDone && !mv && !on(st.roll);
      const bob = mv ? Math.sin(r.phase * 2) * .02 : Math.sin(r.phase * .6) * .008;
      applyPose(r, chase(r, st.block ? C.block : mv && st.run ? C.run : mv ? C.walk : C.rest, Math.min(1, k * (st.block ? 2 : 1))), style, legs, dt, false, bob);
      if (legs) legsDone = true;
      armsDone = true;
    } else if (two || dual) {
      const G = GUARD[style], bob = st.moving ? Math.sin(r.phase * 2) * .02 : Math.sin(r.phase * .6) * .01;
      const mv = st.moving && G.hm; _hR.fromArray(mv ? G.hm : G.h); _hR.y += bob; _dR.fromArray(mv ? G.dm : G.d);
      if (dual) { armIK(r, 'R', _hR, k); aimHand(r, 'R', _dR, k); armIK(r, 'L', _hL.fromArray(G.hl).setY(G.hl[1] + bob), k); aimHand(r, 'L', _dL.fromArray(G.dl), k); }
      else twoHands(r, _hR, _dR, mv ? G.gm : G.g, k);
      if (!st.moving) { T.rotation.y += (.15 - T.rotation.y) * k; if (!legsDone) { stance(r, .03, .12, .12, k); legsDone = true; } }
      armsDone = true;
    }
  }
  // ---- props held with both hands (map, tablet, apple...) ----
  if (r.holds && !armsDone && !st.block) {
    r.root.updateMatrixWorld(true);
    for (const h of r.holds) {
      if (!h.obj || !h.obj.visible || (h.obj.parent && !h.obj.parent.visible)) continue;
      const p = T.worldToLocal(h.obj.getWorldPosition(_w));
      armIK(r, h.side, p, 1, h.pole);
      if (h.dir) aimHand(r, h.side, _a.fromArray(h.dir), 1);
    }
  }
  if (!legsDone) {
    // relax the knees the stance poses may have bent (walk cycle keeps them straight, as before)
    for (const K of [r.kneeL, r.kneeR]) K.rotation.x *= 1 - k;
    r.legL.rotation.z *= 1 - k; r.legR.rotation.z *= 1 - k;
  }
  if (!armsDone && !r.holds) {
    for (const E of [r.elbowL, r.elbowR]) { E.rotation.x *= 1 - k; E.rotation.y *= 1 - k; E.rotation.z *= 1 - k; }
    r.armL.rotation.y *= 1 - k; r.armR.rotation.y *= 1 - k;
    r.handL.rotation.x *= 1 - k; r.handL.rotation.y *= 1 - k; r.handL.rotation.z *= 1 - k;
    r.handR.rotation.y *= 1 - k; r.handR.rotation.z *= 1 - k;
  }
  if (!sk && !spun) r.body.rotation.y = wrap(r.body.rotation.y) * (1 - kk);
}

function relaxExt(r, k) {
  let m = 0;
  for (const J of [r.elbowL, r.elbowR, r.kneeL, r.kneeR, r.handL]) { J.rotation.x *= 1 - k; J.rotation.y *= 1 - k; J.rotation.z *= 1 - k; m = Math.max(m, Math.abs(J.rotation.x)); }
  r.armL.rotation.y *= 1 - k; r.armR.rotation.y *= 1 - k; r.legL.rotation.z *= 1 - k; r.legR.rotation.z *= 1 - k;
  r.handR.rotation.y *= 1 - k; r.handR.rotation.z *= 1 - k;
  r.body.rotation.y = wrap(r.body.rotation.y) * (1 - k); r.hip.position.z *= 1 - k;
  if (r._drinkHid) { weaponVisible(r, true); r._drinkHid = false; if (r.flask) r.flask.visible = false; }
  if (m < 1e-3 && Math.abs(r.body.rotation.y) < 1e-3) r._ext = false;
}

// Roy 30.10 ("no attack should look like, or be in the style of, another"): skills of one job that share a pose (the mage's
// cast x32, the archer's bowshot x17, the rogue's dash x10, the warrior's smash x9...) each play it their own way. A variant
// (js/posevar.js, POSE_VAR[skill]: 1, 2, 3...; 0 = the pose as written) is the base pose with a body laid over it: how she
// stands (kneeling, crouched low, a hop, a lunge, a wide straddle), the chest's turn (twisted left or right, a side bend, a
// whole spin) and its pitch (leaning in, arched back), and where the base pose leaves the off hand free, what both hands
// do (the weapon hand to the sky, at the foe or low at the ground; the free hand up, out at the foe, wide, at the chest or
// swept back). The first 90 variants differ in stance, turn and pitch alone (the hands only add to it), so two variants
// never play the same body even where a two-handed weapon or a pair keeps the hands. Timing is the base pose's own: the
// overlay eases in and out with it (pvW) and leaves the start and the end as they were.
// The joints it moves are kept as the base pose left them in the rig's undo list (r._undo, put back at the start of its
// next frame, as carryV and bodyDyn do), so nothing builds up from frame to frame and every easing works on the pose beneath.
export const PV_LEGS = ['', 'kneel', 'low', 'hop', 'lunge', 'wide'], PV_TURN = ['', 'twistL', 'twistR', 'tilt', 'spin'], PV_PITCH = ['', 'lean', 'arch'];
const PV_HANDS = ['', 'Rfwd', 'Rlow'], PV_OFF = ['', 'Lup', 'Lfwd', 'Lside', 'Lchest', 'Lback'];
const PV_ARMFREE = new Set(['cast', 'heal', 'thunder']); // (the base poses whose free hand only hangs: the hands may vary)
const PV_AIM = new Set(['bowshot', 'throw', 'fireball', 'gaze']); // (a shot or a throw leaves her hand at the foe: no spin, half the twist)
export function pvFeats(n) { // variant n -> its parts; n < 90: a stance x turn x pitch no other n under 90 has
  const A = PV_LEGS.length, B = PV_TURN.length, C = PV_PITCH.length;
  const d0 = n % A, q = Math.floor(n / A), d1 = (q + d0) % B, q2 = Math.floor(q / B), d2 = (q2 + d0 + d1) % C, d3 = (n * 7 + Math.floor(n / 18)) % (PV_HANDS.length * PV_OFF.length); // (the hands step on with every 18th too, so n and n + 18 never hold them alike)
  return { legs: PV_LEGS[d0], turn: PV_TURN[d1], pitch: PV_PITCH[d2], hand: n ? PV_HANDS[d3 % 3] : '', off: n ? PV_OFF[Math.floor(d3 / 3)] : '' };
}
const pvAdd = (r, o, k, d) => { o[k] += d; };
function poseVar(r, id, n, t, style, legs) {
  const F = pvFeats(n), T = r.torso, w = win(t, 0, .16, .84, 1), two = style === 'twohand' || style === 'polearm', dual = style === 'dual';
  const U = r._undo ||= []; for (const o of [T, r.head, r.body, r.hip, r.legL, r.legR, r.kneeL, r.kneeR, r.armL, r.armR, r.elbowL, r.elbowR, r.handL, r.handR]) if (o && !U.some((e) => e[0] === o)) U.push([o, o.quaternion.clone(), o.position.clone()]);
  if (legs) {
    const hz = r.hip.position.z;
    if (F.legs === 'kneel') { const hy = .9 - .36 * w; r.hip.position.y = hy; const y = FOOT_Y - (hy - .02) - r.body.position.y; legIK(r, 'L', y, .3 * w - hz, -.08, 1); legIK(r, 'R', y + .2 * w, -.38 * w - hz, .08, 1); }
    else if (F.legs === 'low') stance(r, .28 * w, .34 * w, .34 * w, 1, .06 + .14 * w);
    else if (F.legs === 'lunge') { pvAdd(r, r.hip.position, 'z', .12 * w); stance(r, .2 * w, .58 * w, .5 * w, 1, .08); }
    else if (F.legs === 'wide') stance(r, .14 * w, .04, .04, 1, .06 + .32 * w);
    else if (F.legs === 'hop') { const h = Math.sin(PI * clamp((t - .1) / .7, 0, 1)); pvAdd(r, r.hip.position, 'y', .34 * h); pvAdd(r, r.legL.rotation, 'x', -.7 * h); pvAdd(r, r.legR.rotation, 'x', -.2 * h); if (r.kneeL) { pvAdd(r, r.kneeL.rotation, 'x', 1.1 * h); pvAdd(r, r.kneeR.rotation, 'x', .6 * h); } }
  }
  const aim = PV_AIM.has(id), tw = aim ? .3 : .62;
  if (F.turn === 'twistL') pvAdd(r, T.rotation, 'y', tw * w);
  else if (F.turn === 'twistR') pvAdd(r, T.rotation, 'y', -tw * w);
  else if (F.turn === 'tilt' || (F.turn === 'spin' && aim)) { const sd = F.turn === 'tilt' ? 1 : -1; pvAdd(r, T.rotation, 'z', .32 * sd * w); pvAdd(r, r.head.rotation, 'z', -.16 * sd * w); } // (a shot's spin: a bend to the other side)
  else if (F.turn === 'spin') pvAdd(r, r.body.rotation, 'y', -PI2 * smooth(clamp((t - .05) / .6, 0, 1)));
  if (F.pitch === 'lean') { pvAdd(r, T.rotation, 'x', .36 * w); pvAdd(r, r.head.rotation, 'x', -.2 * w); }
  else if (F.pitch === 'arch') { pvAdd(r, T.rotation, 'x', -.3 * w); pvAdd(r, r.head.rotation, 'x', -.28 * w); }
  if (PV_ARMFREE.has(id) && !two && !dual) {
    if (F.hand === 'Rfwd') { armIK(r, 'R', _hR.set(.2, .58, .52), w); aimHand(r, 'R', _dR.set(0, .25, 1), w); }
    else if (F.hand === 'Rlow') { armIK(r, 'R', _hR.set(.28, .12, .42), w); aimHand(r, 'R', _dR.set(.1, -.7, .7), w); }
    if (F.off === 'Lup') armIK(r, 'L', _hL.set(-.28, 1.05, .1), w);
    else if (F.off === 'Lfwd') { armIK(r, 'L', _hL.set(-.14, .56, .56), w, _a.set(-1, -.4, -.2)); aimHand(r, 'L', _dL.set(0, 1, .15), w); }
    else if (F.off === 'Lside') armIK(r, 'L', _hL.set(-.62, .55, .02), w);
    else if (F.off === 'Lchest') armIK(r, 'L', _hL.set(-.02, .45, .24), w);
    else if (F.off === 'Lback') armIK(r, 'L', _hL.set(-.34, .14, -.36), w);
  }
}
function skillPose(r, id, t, style, seated, v = 0) {
  const T = r.torso, two = style === 'twohand' || style === 'polearm', dual = style === 'dual';
  const legs = !seated;
  switch (id) {
    case 'swim': { // front crawl: arms windmill, legs flutter, head up out of the water
      const a = t * Math.PI * 2, s1 = Math.sin(a);
      r.head.rotation.x = -1.05; T.rotation.x = 0; T.rotation.y = s1 * .18;
      r.armR.rotation.set(-1.55 + s1 * 1.5, 0, .35); r.elbowR.rotation.set(-.35 - Math.max(0, s1) * .5, 0, 0);
      r.armL.rotation.set(-1.55 - s1 * 1.5, 0, -.35); r.elbowL.rotation.set(-.35 - Math.max(0, -s1) * .5, 0, 0);
      if (legs) { r.hip.position.y = .9; r.legL.rotation.set(Math.sin(a * 3) * .3, 0, 0); r.legR.rotation.set(-Math.sin(a * 3) * .3, 0, 0); if (r.kneeL) { r.kneeL.rotation.set(.25, 0, 0); r.kneeR.rotation.set(.25, 0, 0); } }
      break;
    }
    case 'chargeHold': { // weapon drawn back over the shoulder, weight low, shaking with power when full
      const w = Math.min(1, .35 + t * 2), j = t >= 1 ? Math.sin(performance.now() * .06) * .03 : 0;
      T.rotation.x = -.22 * w; T.rotation.y = .55 * w + j;
      if (legs) stance(r, .2 * w, .32 * w, .25 * w, 1, .12);
      _dR.set(0, .55, -.85).normalize();
      if (two) twoHands(r, _hR.set(.08, .9 + j, -.02), _dR, style === 'polearm' ? .3 : -.16, 1);
      else {
        armIK(r, 'R', _hR.set(.24, .92 + j, -.06), 1); aimHand(r, 'R', _dR, 1);
        if (dual) { armIK(r, 'L', _hL.set(-.24, .92 - j, -.06), 1); aimHand(r, 'L', _dL.set(0, .55, -.85).normalize(), 1); }
        else { r.armL.rotation.set(-.9 * w, 0, -.45 * w); r.elbowL.rotation.set(-.7 * w, 0, 0); }
      }
      break;
    }
    case 'bowshot': { // BETA ONLINE JOBS (js/online/jobt1.js, the archer's bow skills): side-on, the bow out in the right hand, the left draws to the chin and lets go
      const up = win(t, 0, .14, .82, 1), drawn = smooth(clamp((t - .12) / .26, 0, 1)), loose = smooth(clamp((t - .46) / .1, 0, 1));
      T.rotation.y = -1.0 * up; T.rotation.x = .03 * up;
      if (legs) stance(r, .06 * up, .22 * up, .2 * up, 1, .1);
      armIK(r, 'R', _hR.set(.06 * up + .27 * (1 - up), .5 * up + .14 * (1 - up), .52 * up + .2 * (1 - up)), 1); aimHand(r, 'R', _dR.set(.12, .98, .12), 1);
      armIK(r, 'L', _hL.set(.04 - .16 * drawn - .12 * loose, .5 + .03 * drawn + .03 * loose, .46 - .44 * drawn - .14 * loose), up); aimHand(r, 'L', _dL.set(0, 0, 1), up);
      break;
    }
    case 'aegis': { // shield (or weapon guard) rammed forward
      const wind = win(t, 0, .2, .25, .4), hit = win(t, .22, .36, .7, 1);
      T.rotation.y = -.45 * wind + .55 * hit; T.rotation.x = .2 * hit;
      if (legs) { r.hip.position.z = .14 * hit; stance(r, .1 * hit + .05 * wind, .3 * hit, .3 * hit, 1); }
      if (r.shield && r.shield.visible) {
        r.armL.rotation.set(-.6 - .95 * hit - .4 * wind, 0, .5 * wind + .15 * hit); r.elbowL.rotation.set(-1.2 * wind - .1 * hit, 0, 0);
        r.armR.rotation.set(.5 * hit, 0, .25); r.elbowR.rotation.set(-.4, 0, 0); r.handR.rotation.set(1.05, 0, 0);
      } else if (dual) {
        armIK(r, 'R', _hR.set(.06, .45, .3 + .25 * hit), 1); aimHand(r, 'R', _dR.set(-.55, .8, .2), 1);
        armIK(r, 'L', _hL.set(-.06, .45, .3 + .25 * hit), 1); aimHand(r, 'L', _dL.set(.55, .8, .2), 1);
      } else twoHands(r, _hR.set(.25, .55, .15 + .3 * hit), _dR.set(-.96, .22, .12), .45, 1);
      break;
    }
    case 'whirl': { // coil back, then three fast turns with the blade straight out, a little hop on each turn
      const coil = win(t, 0, .1, .13, .2), w = win(t, .1, .18, .86, 1), spin = smooth((t - .13) / .75), turns = 3;
      r.body.rotation.y = .8 * coil - spin * Math.PI * 2 * turns;
      r.body.position.y += Math.abs(Math.sin(spin * Math.PI * turns)) * .14 * w;
      T.rotation.y = -.7 * coil + .2 * w; T.rotation.x = .2 * w + .08 * coil; r.head.rotation.x = .1 * w;
      if (legs) stance(r, .22 * w + .28 * coil, .3 * w + .1 * coil, .3 * w + .1 * coil, 1, .24 * w);
      if (two) twoHands(r, _hR.set(.62 * w + .1, .5 - .08 * coil, .18 - .3 * coil), _dR.set(1, .02, -.15 - .5 * coil).normalize(), style === 'polearm' ? .3 : -.16, 1);
      else {
        armIK(r, 'R', _hR.set(.2 + .48 * w, .62 - .1 * coil, .1 - .3 * coil), 1); aimHand(r, 'R', _dR.set(1, .05, -.2 - .6 * coil).normalize(), 1);
        if (dual) { armIK(r, 'L', _hL.set(-.2 - .48 * w, .62 - .1 * coil, .1 - .3 * coil), 1); aimHand(r, 'L', _dL.set(-1, .05, -.2 - .6 * coil).normalize(), 1); }
        else { r.armL.rotation.set(-.25 * w, 0, -.2 - 1.15 * w); r.elbowL.rotation.set(-.35 * w, 0, 0); }
      }
      break;
    }
    case 'dash': { // low lunge, weapon driven forward
      const w = win(t, 0, .14, .72, 1);
      T.rotation.x = .5 * w; T.rotation.y = -.25 * w;
      if (legs) { r.hip.position.z = .16 * w; stance(r, .3 * w, -.55 * w, -.6 * w, 1, .08); legIK(r, 'L', FOOT_Y - (.9 - .3 * w - .02), -.6 * w - r.hip.position.z, -.08, 1); legIK(r, 'R', FOOT_Y - (.9 - .3 * w - .02), .55 * w - r.hip.position.z, .08, 1); }
      if (two) twoHands(r, _hR.set(.12, .3 + .12 * w, .25 + .3 * w), _dR.set(-.05, .05 - .1 * w, 1), style === 'polearm' ? .1 : -.16, 1);
      else {
        armIK(r, 'R', _hR.set(.2, .32 + .1 * w, .15 + .45 * w), 1); aimHand(r, 'R', _dR.set(0, -.08, 1), 1);
        if (dual) { armIK(r, 'L', _hL.set(-.25, .3, -.1 * w), 1); aimHand(r, 'L', _dL.set(-.2, -.5, -.8), 1); }
        else { r.armL.rotation.set(.7 * w, 0, -.3 * w); r.elbowL.rotation.set(-.4 * w, 0, 0); }
      }
      break;
    }
    case 'ult': { // crouch, raise the weapon overhead for the whole flight, then a huge slam on landing
      const tt = t < .7 ? .44 * Math.min(1, t / .5) : .44 + (t - .7) / .3 * .56;
      skillPose(r, 'smash', tt, style, seated);
      if (t < .12 && legs) stance(r, .35 * Math.sin(t / .12 * Math.PI), .2, .2, 1, .12);
      if (t > .12 && t < .7) { T.rotation.x -= .25; if (legs) { r.legL.rotation.x = -.7; r.legR.rotation.x = .35; if (r.kneeL) { r.kneeL.rotation.x = 1.1; r.kneeR.rotation.x = .6; } } }
      break;
    }
    case 'summon': { // RISE (round 31, Roy): the weapon pointed down at the earth, then raised slowly high over her head, point to the sky, to call the dead up
      const w = win(t, 0, .1, .9, 1), low = win(t, 0, .08, .16, .3), up = smooth(clamp((t - .16) / .32, 0, 1)) * w, j = up > .98 ? Math.sin(t * 95) * .012 : 0;
      r.head.rotation.x = -.55 * up + .3 * low; T.rotation.x = .28 * low - .2 * up; T.rotation.y = -.1 * low;
      if (legs) stance(r, .22 * low + .05 * up, .18 * w, .14 * w, 1, .15);
      const lerp3 = (v, a, b, k) => v.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
      lerp3(_hR, [.24, .22, .34], [.1, 1.2 + j, .1], up); lerp3(_dR, [.02, -.85, .5], [.02, 1, .06], up).normalize();
      if (two) twoHands(r, _hR, _dR, style === 'polearm' ? .3 : -.16, 1);
      else {
        armIK(r, 'R', _hR, 1); aimHand(r, 'R', _dR, 1);
        if (dual) { lerp3(_hL, [-.24, .22, .34], [-.12, 1.15 - j, .1], up); armIK(r, 'L', _hL, 1); aimHand(r, 'L', _dL.set(-_dR.x, _dR.y, _dR.z), 1); }
        else { armIK(r, 'L', lerp3(_hL, [-.36, .2, .22], [-.5, .78, .26], up), 1); aimHand(r, 'L', _dL.set(-.3, 1, .25), 1); } // the free hand lifts too, palm up
      }
      break;
    }
    case 'rise': { // both arms lift slowly from the ground to the sky, palms up, head thrown back
      const w = win(t, 0, .45, .85, 1), k = smooth(Math.min(1, t / .45));
      r.head.rotation.x = -.45 * w; T.rotation.x = -.18 * w;
      if (legs) stance(r, .12 * (1 - k) * w, .1, .1, 1, .14);
      armIK(r, 'R', _hR.set(.45 + .1 * k, .05 + 1.0 * k, .25 - .1 * k), 1); aimHand(r, 'R', _dR.set(.3, 1, .1), 1);
      armIK(r, 'L', _hL.set(-.45 - .1 * k, .05 + 1.0 * k, .25 - .1 * k), 1); aimHand(r, 'L', _dL.set(-.3, 1, .1), 1);
      break;
    }
    case 'fate': { // wind back, fling both arms wide to cast the threads, then pull them tight
      const wind = win(t, 0, .2, .3, .42), fling = win(t, .3, .45, .6, .75), pull = win(t, .6, .78, .95, 1);
      T.rotation.y = -.9 * wind + .7 * fling; T.rotation.x = .1 * fling - .15 * pull; r.head.rotation.x = -.15 * fling;
      if (legs) stance(r, .12 * wind + .05 * pull, .16 * fling + .05, .1 + .12 * pull, 1, .12);
      armIK(r, 'R', _hR.set(.3 + .45 * fling - .1 * wind, .35 + .35 * fling + .1 * pull, .1 - .25 * wind + .1 * fling + .25 * pull), 1); aimHand(r, 'R', _dR.set(.8 * fling + .1, .3, .6), 1);
      armIK(r, 'L', _hL.set(-.3 - .45 * fling - .15 * wind, .35 + .35 * fling + .1 * pull, .1 + .2 * wind + .1 * fling + .25 * pull), 1); aimHand(r, 'L', _dL.set(-.8 * fling - .1, .3, .6), 1);
      break;
    }
    case 'cast': case 'heal': case 'thunder': { // weapon hand raised to the sky
      const w = win(t, 0, .22, .8, 1);
      r.head.rotation.x = -.3 * w; T.rotation.x = -.08 * w;
      if (legs) stance(r, -.03 * w, .05, .05, 1, .08);
      armIK(r, 'R', _hR.set(.3, .3 + .82 * w, .12 + .05 * w), 1, _a.set(1, -.3, -.4)); aimHand(r, 'R', _dR.set(.05, 1, .05), 1);
      armIK(r, 'L', _hL.set(-.42 - .1 * w, .15 + .25 * w, .2 + .15 * w), 1);
      break;
    }
    case 'slam': case 'quake': { // jump, then smash the ground
      const up = t < .42 ? Math.sin(Math.PI * t / .42) : 0, hitW = win(t, .36, .48, .78, 1), raise = win(t, 0, .12, .36, .48);
      r.body.position.y = up * .6;
      if (legs) stance(r, .3 * hitW, .25 * hitW, .25 * hitW, 1, .12 + .1 * up, up * .32);
      T.rotation.x = -.2 * raise + .55 * hitW;
      const hx = .05, hy = .3 + .65 * raise - .1 * hitW, hz = .08 + .44 * hitW;
      _dR.set(0, .6 * raise + .1 * hitW, -.8 * raise + 1 * hitW + .01).normalize();
      if (two) twoHands(r, _hR.set(hx, hy, hz), _dR, style === 'polearm' ? .3 : -.16, 1);
      else {
        armIK(r, 'R', _hR.set(.15, hy, hz), 1); aimHand(r, 'R', _dR, 1);
        if (dual) { armIK(r, 'L', _hL.set(-.15, hy, hz), 1); aimHand(r, 'L', _dL.set(-_dR.x, _dR.y, _dR.z), 1); }
        else { r.armL.rotation.set(-.4 * hitW - .8 * raise, 0, -.7 * hitW - .3 * raise); r.elbowL.rotation.set(-.3, 0, 0); }
      }
      break;
    }
    case 'gaze': { // free palm thrust out at the foe
      const w = win(t, 0, .18, .82, 1);
      T.rotation.y = .4 * w; T.rotation.x = .08 * w; r.head.rotation.x = .05 * w;
      if (legs) stance(r, .06 * w, .2 * w, .16 * w, 1);
      armIK(r, 'L', _hL.set(-.18, .58, .62), 1, _a.set(-1, -.4, -.2));
      aimHand(r, 'L', _dL.set(0, 1, .15), 1);
      if (two) { armIK(r, 'R', _hR.set(.3, .2, .15), 1); aimHand(r, 'R', _dR.set(.1, .9, .4), 1); }
      else { r.armR.rotation.set(.35 * w, 0, .25); r.elbowR.rotation.set(-.3, 0, 0); r.handR.rotation.set(1.05, 0, 0); }
      break;
    }
    case 'charge': { // shield-first rush: shoulder down, shield arm forward, legs pumping
      const w = win(t, 0, .1, .85, 1), run = t * PI2 * 3.5, sn = Math.sin(run);
      T.rotation.x = .42 * w; T.rotation.y = .55 * w;
      if (legs) {
        r.hip.position.y = .9 - .1 * w + Math.abs(sn) * .05 * w; r.hip.position.z = .08 * w;
        r.legL.rotation.set(sn * .9 * w, 0, 0); r.legR.rotation.set(-sn * .9 * w, 0, 0);
        r.kneeL.rotation.x = Math.max(0, -Math.cos(run)) * 1.2 * w + .2 * w; r.kneeR.rotation.x = Math.max(0, Math.cos(run)) * 1.2 * w + .2 * w;
      }
      if (two) twoHands(r, _hR.set(.25, .5, .2 + .15 * w), _dR.set(-.96, .22, .12), .45, 1);
      else if (dual) { armIK(r, 'R', _hR.set(.07, .46, .45), 1); aimHand(r, 'R', _dR.set(-.55, .8, .2), 1); armIK(r, 'L', _hL.set(-.07, .46, .45), 1); aimHand(r, 'L', _dL.set(.55, .8, .2), 1); }
      else {
        r.armL.rotation.set(-1.45 * w, 0, .15 * w); r.elbowL.rotation.set(-.2 * w, 0, 0);
        r.armR.rotation.set(.5 * w, 0, .3); r.elbowR.rotation.set(-.5, 0, 0); r.handR.rotation.set(1.05, 0, 0);
      }
      break;
    }
    case 'smash': { // two-handed overhead raise, slam at ~.55 with a crouch
      const raise = win(t, 0, .35, .44, .55), hitW = win(t, .45, .55, .8, 1), rest = Math.max(0, 1 - raise - hitW);
      T.rotation.x = -.25 * raise + .55 * hitW; T.rotation.y = 0;
      if (legs) stance(r, .05 * raise + .3 * hitW, .06 + .22 * hitW, .06 + .2 * hitW, 1, .12);
      const hy = .3 + .68 * raise - .08 * hitW, hz = .1 - .08 * raise + .42 * hitW;
      _dR.set(0, .55 * raise + .1 * hitW + .2 * rest, -.85 * raise + hitW + .9 * rest).normalize();
      if (dual) { armIK(r, 'R', _hR.set(.15, hy, hz), 1); aimHand(r, 'R', _dR, 1); armIK(r, 'L', _hL.set(-.15, hy, hz), 1); aimHand(r, 'L', _dL.copy(_dR), 1); }
      else twoHands(r, _hR.set(.05, hy, hz), _dR, style === 'polearm' ? .3 : -.16, 1);
      break;
    }
    case 'fireball': { // off hand drawn back, then a palm-forward throw at ~.45
      const wind = win(t, 0, .28, .34, .45), thr = win(t, .36, .46, .8, 1), rest = Math.max(0, 1 - wind - thr);
      T.rotation.y = -.55 * wind + .5 * thr; T.rotation.x = .05 + .12 * thr;
      if (legs) { r.hip.position.z = .08 * thr; stance(r, .06 + .06 * thr, .1 + .22 * thr, .12 + .1 * thr, 1); }
      armIK(r, 'L', _hL.set(-.36 * rest - .42 * wind - .12 * thr, .3 * rest + .38 * wind + .56 * thr, .2 * rest - .28 * wind + .64 * thr), 1, _a.set(-1, -.4, -.3));
      aimHand(r, 'L', _dL.set(0, 1, .2), 1);
      if (two) { armIK(r, 'R', _hR.set(.34, .16, .1), 1); aimHand(r, 'R', _dR.set(.2, -.4, .9), 1); }
      else { armIK(r, 'R', _hR.set(.36, .16 + .1 * wind, -.05 - .08 * thr), 1); aimHand(r, 'R', _dR.set(.25, -.5, .8), 1); }
      break;
    }
    case 'flurry': { // six rapid alternating thrusts, torso leaning in
      const w = win(t, 0, .06, .9, 1), ph = clamp(t / .9, 0, .999) * 6, n = Math.floor(ph), e = Math.sin(PI * (ph - n)) * w;
      const sx = n % 2 ? -1 : 1, main = sx > 0 ? 'R' : 'L', off = sx > 0 ? 'L' : 'R';
      T.rotation.x = .3 * w; T.rotation.y = -sx * .3 * e;
      if (legs) { r.hip.position.z = .06 * w; stance(r, .12 * w, .22 * w, .2 * w, 1); }
      if (two) twoHands(r, _hR.set(.12, .38, .12 + .4 * e), _dR.set(0, 0, 1), style === 'polearm' ? .1 : -.16, 1);
      else {
        armIK(r, main, _hR.set(sx * .13, .42, .15 + .45 * e), 1); aimHand(r, main, _dR.set(-sx * .05, -.05, 1), 1);
        armIK(r, off, _hL.set(-sx * .27, .34, .1), 1); aimHand(r, off, _dL.set(-sx * .2, -.3, .93), 1);
      }
      break;
    }
    case 'fog': { // arms cross, then sweep the cloak wide; low stance
      const cr = win(t, 0, .2, .26, .4), sw = win(t, .28, .5, .8, 1), rest = Math.max(0, 1 - cr - sw);
      T.rotation.x = .1 * cr + .2 * sw; T.rotation.y = .25 * cr - .1 * sw;
      if (legs) stance(r, .08 * cr + .28 * sw, .28 * sw, .28 * sw, 1, .1 + .25 * sw);
      for (const sx of [1, -1]) {
        const side = sx > 0 ? 'R' : 'L';
        armIK(r, side, _hR.set(sx * (.32 * rest - .12 * cr + .62 * sw), .15 * rest + .48 * cr + .36 * sw, .1 * rest + .34 * cr + .2 * sw), 1, _a.set(sx, -.6, -.6));
        aimHand(r, side, _dR.set(sx * (.3 * rest + .8 * sw), .2 - .3 * rest, .9 - .4 * sw), 1);
      }
      break;
    }
    case 'wave': { // both arms sweep up and forward, summoning a wave
      const lo = win(t, 0, .25, .3, .42), up = win(t, .32, .55, .82, 1), rest = Math.max(0, 1 - lo - up);
      T.rotation.x = .25 * lo - .15 * up; r.head.rotation.x = -.25 * up;
      if (legs) stance(r, .2 * lo - .03 * up, .2, .15, 1, .1);
      for (const sx of [1, -1]) {
        const side = sx > 0 ? 'R' : 'L';
        armIK(r, side, _hR.set(sx * (.32 * rest + .3 * lo + .22 * up), .12 * rest + .05 * lo + 1 * up, .1 * rest - .18 * lo + .42 * up), 1, _a.set(sx, -.5, -.5));
        aimHand(r, side, _dR.set(sx * .1, -.4 * rest - .3 * lo + .8 * up, .9 - .3 * up), 1);
      }
      break;
    }
    case 'prophecy': { // fingers to the brow, head up, the other hand open
      const w = win(t, 0, .25, .82, 1);
      r.head.rotation.x = -.38 * w; T.rotation.x = -.06 * w;
      if (legs) stance(r, 0, .06, .06, 1);
      weaponVisible(r, false); r._drinkHid = true;
      armIK(r, 'R', _hR.set(.32 - .26 * w, .12 + .78 * w, .1 + .16 * w), 1, _a.set(1, -.2, -.6));
      aimHand(r, 'R', _dR.set(-.3, .9, .2), 1);
      armIK(r, 'L', _hL.set(-.34 - .12 * w, .12 + .26 * w, .1 + .24 * w), 1);
      aimHand(r, 'L', _dL.set(-.3, .4, .9), 1);
      break;
    }
    case 'sweep': { // the weapon drawn back past the right hip, then one wide level arc round to the left (skill book)
      const k1 = smooth(clamp(t / .3, 0, 1)), k2 = smooth(clamp((t - .32) / .22, 0, 1)), ret = smooth(clamp((t - .78) / .22, 0, 1));
      const w = 1 - ret, a = (.4 + 1.5 * k1 - 2.9 * k2) * w + .4 * ret, R = .52;
      T.rotation.y = (.55 * k1 * (1 - k2) - .5 * k2) * w; T.rotation.x = (.06 + .14 * k2) * w;
      if (legs) stance(r, (.1 + .14 * k2) * w, .26 * w, .26 * w, 1, .18 * w);
      _hR.set(Math.sin(a) * R, .5 - .06 * k2 * w, Math.max(-.22, Math.cos(a) * R)); _dR.set(Math.sin(a), -.06, Math.cos(a)).normalize();
      if (two) twoHands(r, _hR, _dR, style === 'polearm' ? .3 : -.16, 1);
      else {
        armIK(r, 'R', _hR, 1); aimHand(r, 'R', _dR, 1);
        if (dual) { armIK(r, 'L', _hL.set(-.3, .42, .22 + .1 * k2 * w), 1); aimHand(r, 'L', _dL.set(-.4, .1, .9).normalize(), 1); }
        else { r.armL.rotation.set(-.35 * w, 0, -.55 * w); r.elbowL.rotation.set(-.4 * w, 0, 0); }
      }
      break;
    }
    case 'throw': { // javelin throw: weapon hand drawn high and back, the other arm aims, then a hard overhand release
      const wind = win(t, 0, .3, .36, .48), thr = win(t, .38, .5, .72, 1), rest = Math.max(0, 1 - wind - thr);
      T.rotation.y = .6 * wind - .4 * thr; T.rotation.x = -.12 * wind + .3 * thr;
      if (legs) { r.hip.position.z = .1 * thr; stance(r, .08 * wind + .14 * thr, .3 * (wind + thr), .3 * (wind + thr), 1, .14); }
      armIK(r, 'R', _hR.set(.3 * rest + .32 * wind + .12 * thr, .3 * rest + .92 * wind + .62 * thr, .1 * rest - .36 * wind + .55 * thr), 1, _a.set(1, -.3, -.4));
      aimHand(r, 'R', _dR.set(0, .25 * wind - .2 * thr + .3 * rest, 1).normalize(), 1);
      armIK(r, 'L', _hL.set(-.3 * rest - .22 * wind - .32 * thr, .3 * rest + .62 * wind + .3 * thr, .15 * rest + .5 * wind + .05 * thr), 1);
      aimHand(r, 'L', _dL.set(-.1, .2, 1).normalize(), 1);
      break;
    }
    // BETA ONLINE JOBS, each job's tier-2 move (js/online/jobs/mobility.js; Roy 30.10: "every job its own MOBILITY skill", none in
    // another's style): four poses of their own; the other players' figures play them too (avatars.js, by the skill's anim)
    case 'mob_towerrush': { // Ajax's Tower Rush: crouched behind the shield, both arms bracing it in front, short hard strides; planted at the end
      const w = win(t, 0, .08, .82, 1), stop = win(t, .7, .8, .9, 1), run = t * PI2 * 4.5, sn = Math.sin(run) * (1 - stop);
      T.rotation.x = .55 * w - .25 * stop; T.rotation.y = .3 * w; r.head.rotation.x = -.4 * w;
      if (legs) {
        r.hip.position.y = .9 - .2 * w; r.hip.position.z = .1 * w;
        r.legL.rotation.set(sn * .7 * w - .45 * stop, 0, -.06); r.legR.rotation.set(-sn * .7 * w + .55 * stop, 0, .06);
        if (r.kneeL) { r.kneeL.rotation.x = (.45 + Math.max(0, -Math.cos(run)) * .8 * (1 - stop)) * w; r.kneeR.rotation.x = (.45 + Math.max(0, Math.cos(run)) * .8 * (1 - stop)) * w; }
      }
      armIK(r, 'L', _hL.set(-.04, .52, .12 + .34 * w), 1); aimHand(r, 'L', _dL.set(.25, .9, .3).normalize(), 1);
      armIK(r, 'R', _hR.set(.12, .46, .1 + .26 * w), 1); aimHand(r, 'R', _dR.set(-.45, .6, .45).normalize(), 1);
      break;
    }
    case 'mob_tether': { // the Golden Hind's Tether: the bow flung up and forward to loose, then yanked off her feet along the cord, legs tucked; a light crouched landing
      const aim = win(t, 0, .12, .3, .4), fly = win(t, .3, .4, .8, .9), land = win(t, .82, .9, .96, 1);
      T.rotation.y = -.8 * aim; T.rotation.x = -.15 * fly + .25 * land; r.head.rotation.x = -.2 * aim + .15 * fly;
      if (legs) {
        if (fly > .01) { r.hip.position.y = .9; r.legL.rotation.set(-1.1 * fly, 0, -.1); r.legR.rotation.set(-.55 * fly, 0, .1); if (r.kneeL) { r.kneeL.rotation.x = 1.6 * fly; r.kneeR.rotation.x = 1.2 * fly; } }
        else stance(r, .25 * land + .05 * aim, .25 * (aim + land), .25 * (aim + land), 1, .12);
      }
      armIK(r, 'R', _hR.set(.1 + .08 * fly, .55 + .42 * fly, .5), 1); aimHand(r, 'R', _dR.set(.1, .95, .2).normalize(), 1);
      armIK(r, 'L', _hL.set(-.05 - .22 * fly, .5 + .38 * fly - .2 * land, .45), 1); aimHand(r, 'L', _dL.set(0, .3, 1).normalize(), 1);
      break;
    }
    case 'mob_slide': { // Echidna's Slide: dropped low as a serpent, chest over the ground, arms swept back along her sides, legs trailing, the body weaving
      const w = win(t, 0, .12, .8, 1), wv = Math.sin(t * PI2 * 2) * w;
      T.rotation.x = 1.0 * w; T.rotation.y = wv * .35; r.head.rotation.x = -.9 * w; r.head.rotation.y = -wv * .3;
      if (legs) {
        r.hip.position.y = .9 - .46 * w; r.hip.position.z = -.1 * w;
        r.legL.rotation.set(1.0 * w, 0, -.15 - wv * .2); r.legR.rotation.set(.85 * w, 0, .15 - wv * .2);
        if (r.kneeL) { r.kneeL.rotation.x = .3 * w; r.kneeR.rotation.x = .5 * w; }
      }
      armIK(r, 'R', _hR.set(.32, .05 - .1 * w, -.25 * w), 1); aimHand(r, 'R', _dR.set(.2, -.3, -1).normalize(), 1);
      armIK(r, 'L', _hL.set(-.32, .05 - .1 * w, -.25 * w), 1); aimHand(r, 'L', _dL.set(-.2, -.3, -1).normalize(), 1);
      break;
    }
    case 'mob_rainbow': { // Iris' Rainbow Bridge: arms flung up and wide like wings as she rises along the bow, body arched, legs together and trailing; a light landing
      const up = win(t, 0, .2, .75, .9), land = win(t, .78, .9, .95, 1);
      T.rotation.x = -.3 * up + .2 * land; r.head.rotation.x = -.4 * up;
      if (legs) {
        if (up > .05) { r.hip.position.y = .9; r.legL.rotation.set(.35 * up, 0, .02); r.legR.rotation.set(.45 * up, 0, -.02); if (r.kneeL) { r.kneeL.rotation.x = .5 * up; r.kneeR.rotation.x = .3 * up; } }
        else stance(r, .2 * land, .15, .15, 1, .12);
      }
      armIK(r, 'R', _hR.set(.5 + .25 * up, .25 + .75 * up, .1), 1); aimHand(r, 'R', _dR.set(.7, .7, .1).normalize(), 1);
      armIK(r, 'L', _hL.set(-.5 - .25 * up, .25 + .75 * up, .1), 1); aimHand(r, 'L', _dL.set(-.7, .7, .1).normalize(), 1);
      break;
    }
    default: break;
  }
  if (v) poseVar(r, id, v, t, style, legs); // (Roy 30.10: this skill's own way of playing the pose, js/posevar.js)
}
const PI2 = Math.PI * 2, PI = Math.PI;

function makeFlask(hand) {
  const g = new THREE.Group(); hand.add(g); g.position.set(0, 0, .02);
  const glass = ball(g, .06, '#cfe4e8', 0, 0, .08, 1, { opacity: .55 }); glass.scale.set(1, 1, 1.1);
  const liq = ball(g, .05, '#d0283a', 0, -.005, .075, 1, { basic: true }); g.userData.liquid = liq;
  const nk = tcyl(g, .02, .025, .07, '#cfe4e8', 0, 0, .17, 6, { opacity: .55 }); nk.rotation.x = Math.PI / 2;
  const ck = tcyl(g, .022, .022, .03, '#8a5a32', 0, 0, .215, 6); ck.rotation.x = Math.PI / 2; g.userData.cork = ck;
  if (PXART) { // a cork with grain, a glint on the glass and one on the potion
    ck.material = PXK.tileMat(PXK.paTile('wood#8a5a32', 16, 32, (c) => PXK.paWood(c, PXK.ramp('#8a5a32', 6))), 1, 1);
    box(g, .012, .03, .012, '#ffffff', -.046, .04, .075, { basic: true, noShadow: true }).rotation.z = .6; box(g, .01, .01, .01, '#ffffff', -.03, .056, .08, { basic: true, noShadow: true });
  }
  addOutline(g, (m) => m.material.isMeshBasicMaterial || m.material.transparent);
  g.visible = false; return g;
}

function wiggleSnakes(r, dt, st) {
  r.snakeT = (r.snakeT || 0) + dt * (st.attackT >= 0 || st.skill ? 2.2 : 1);
  const t = r.snakeT;
  for (const s of r.snakes) {
    const segs = s.segs;
    for (let j = 0; j < segs.length; j++) {
      const p = t * s.sp + s.ph - j * .9;
      segs[j].rotation.x = s.bx[j] + Math.sin(p) * s.amp;
      segs[j].rotation.z = s.bz[j] + Math.cos(p * .8 + j) * s.amp * .8;
    }
    if (s.tongue) s.tongue.visible = Math.sin(t * 3.1 + s.ph * 5) > .55;
  }
}

// ---------- weapons ----------
// Attach weapon groups (from weapons.js: grip at the origin, blade along +z) to the rig's hands.
// Styles: 'blade' (1-hand + shield), 'spear' (1-hand spear + shield), 'twohand', 'polearm', 'dual'.
// For blade/spear a `left` group is a weapon-specific shield: it replaces the built-in rig.shield and is mounted
// with the same transform (shield space: centre at the origin, disc axis along x, emblem face toward -x).
// Without `left`, the built-in shield shows for blade/spear. For dual, `left` is the second blade in handL.
// rig.sword then points at the new right-hand weapon (keeps the old rest pose code working).
export function equipWeapon(rig, w = {}, style = 'blade') {
  w = w || {};
  if (rig._stowed) stowWeapons(rig, false);
  for (const key of ['weaponR', 'weaponL', 'shieldL']) if (rig[key]) { rig[key].parent?.remove(rig[key]); rig[key] = null; }
  if (rig.sword && rig.sword.parent) rig.sword.parent.remove(rig.sword);
  rig.sword = null;
  shieldHome(rig);
  const base = rig.shieldBase, shieldy = style === 'blade' || style === 'spear', arm = rig._shieldArm;
  // her own shield back on the left arm first (it may hang on her back), so a weapon's shield takes its exact place
  if (base && arm && base.parent !== arm.parent) { arm.parent.add(base); base.position.copy(arm.pos); base.quaternion.copy(arm.q); }
  const prep = (g) => {
    let has = !!g.userData.outlined; g.traverse((o) => { if (o.userData.outline) has = true; });
    if (!has) addOutline(g, (m) => !m.castShadow || m.material.isMeshBasicMaterial || m.material.transparent);
    return g;
  };
  if (w.right) { rig.handR.add(prep(w.right)); rig.weaponR = w.right; rig.sword = w.right; }
  if (w.left && shieldy) {
    const g = prep(w.left);
    if (base && base.parent) { base.parent.add(g); g.position.copy(base.position); g.quaternion.copy(base.quaternion); }
    else if (rig.elbowL) { rig.elbowL.add(g); g.position.set(-.1, -.12, .04); }
    rig.shieldL = g;
  } else if (w.left) { rig.handL.add(prep(w.left)); rig.weaponL = w.left; }
  if (base) base.visible = shieldy && !rig.shieldL;
  rig.shield = rig.shieldL || base;
  // V always carries a shield: a two-hander, polearm or pair of blades leaves it slung on her back, where the
  // stowed-weapon code puts it (only worn there, it never blocks); rig.shield stays the one in her hand (none)
  rig.shieldBack = null;
  if (base && arm && !shieldy && rig.torso) {
    rig.torso.add(base); seatShield(rig, base); // flat against her back (round 22, Roy: it stood off her)
    base.visible = !rig.wings?.length; rig.shield = null; rig.shieldBack = base; // (with the dragon wings on, the wings take her back)
  }
  rig.style = style || 'blade';
  if (rig.gearShieldOn) placeShield(rig); // round 23: the worn shield, not the weapon's own
  if (rig.unarmed) for (const k of ['weaponR', 'weaponL', 'shieldL']) if (rig[k]) rig[k].visible = false;
  if (rig.unarmed && base) base.visible = false;
  // where the left hand holds a two-handed haft (weapon-local z); spears use the per-move slide of the keyframes
  const ud = w.right?.userData || {};
  rig.grip2 = style === 'twohand' ? (ud.grip2 ?? ud.gripL ?? null) : null;
  // a two-handed spear sits with the rear hand near the butt, the front hand on the mid-shaft (applyPose slides it to the
  // balance to trail it in one hand at a run); a great weapon is held low on its handle, the lower hand just above the
  // pommel, so the pommel clears her belly on the swings
  rig.gripZ = !w.right ? 0 : style === 'polearm' ? clamp(-(ud.butt ?? -.5) - .46, 0, .32)
    : style === 'twohand' ? clamp(-(ud.butt ?? -.3) + (rig.grip2 ?? -.2) - .06, 0, .3) : 0;
  if (w.right) w.right.position.z = rig.gripZ;
  rig.reap = style === 'polearm' && /scythe/.test(ud.weapon || ''); // a blade across the head: carried low (CARRY.scythe)
  if (rig._drinkHid) { rig._drinkHid = false; if (rig.flask) rig.flask.visible = false; }
  return rig;
}

// her own shield (V's built-in one) and where it sits on her arm, remembered the first time anything is equipped
function shieldHome(rig) {
  if (rig.shieldBase === undefined) { const b = rig.shieldBase = rig.shield || null; if (b?.parent) rig._shieldArm = { parent: b.parent, pos: b.position.clone(), q: b.quaternion.clone() }; }
}
// Round 23 (Roy: "in the weapon shop she buys the shield too"): the shield is gear of its own (weapons.js GEAR slot
// 'shield'). Once a rig has been given that slot (equipGear, even empty), a weapon's own shield is never shown: she carries
// the worn one, on her left arm with a sword or a one-handed spear, slung on her back with anything two-handed, or none
// at all. Her own sun-and-moon shield (shield_crescent) is the one built into her rig, painted as it always was.
function equipShield(rig, model) {
  const st = rig._stowed; if (st) stowWeapons(rig, false);
  if (rig.gearShield && rig.gearShield !== model && rig.gearShield !== rig.shieldBase) rig.gearShield.parent?.remove(rig.gearShield);
  rig.gearShieldOn = true; rig.gearShield = model || null;
  placeShield(rig);
  if (st) stowWeapons(rig, true);
  (rig.gear ||= {}).shield = model || null;
  return rig;
}
function placeShield(rig) {
  shieldHome(rig);
  const base = rig.shieldBase, arm = rig._shieldArm, shieldy = rig.style === 'blade' || rig.style === 'spear';
  if (rig.shieldL && rig.shieldL !== rig.gearShield) rig.shieldL.parent?.remove(rig.shieldL); // (the weapon's own)
  rig.shieldL = null; rig.shield = null; rig.shieldBack = null;
  if (base && arm && base.parent !== arm.parent) { arm.parent.add(base); base.position.copy(arm.pos); base.quaternion.copy(arm.q); }
  if (base) base.visible = false;
  let sh = rig.gearShield;
  if (sh?.userData.gear === 'shield_crescent' && base) { sh.parent?.remove(sh); sh = base; } // her own
  if (!sh) return;
  if (sh !== base) {
    let has = !!sh.userData.outlined; sh.traverse((o) => { if (o.userData.outline) has = true; });
    if (!has) addOutline(sh, (m) => !m.castShadow || m.material.isMeshBasicMaterial || m.material.transparent);
  }
  // BETA ONLINE JOBS (js/online/jobarms.js): an off hand that is no shield says where it is worn (a quiver on the back, a charm
  // at the belt, a focus floating by the left hand); the campaign's shields have no mount
  const mt = sh.userData.mount || OFF_MOUNTS[sh.userData.shield];
  if (mt && rig[mt.bone]) { rig[mt.bone].add(sh); sh.position.fromArray(mt.pos); sh.rotation.fromArray(mt.rot || [0, 0, 0]); sh.visible = !rig.unarmed; return; }
  if (shieldy) { // on the arm, where a weapon's own shield went
    if (sh !== base) {
      if (arm) { arm.parent.add(sh); sh.position.copy(arm.pos); sh.quaternion.copy(arm.q); }
      else if (rig.elbowL) { rig.elbowL.add(sh); sh.position.set(-.1, -.12, .04); sh.quaternion.identity(); }
      rig.shieldL = sh;
    }
    rig.shield = sh; sh.visible = !rig.unarmed;
  } else if (rig.torso) { // slung on her back, flat (seatShield); the dragon wings take her back from it
    rig.torso.add(sh); seatShield(rig, sh); rig.shieldBack = sh; sh.visible = !rig.wings?.length && !rig.unarmed;
  }
}
// Weapons on the back: the shield flat against the shoulder blades, the weapon slung diagonally over it, hilt above
// the right shoulder (a second blade crosses it). on=false puts everything back in the hands exactly as it was.
// Used while V swims and while she talks somewhere safe.
// Round 22 (Roy: "the shield and weapon on her back stand off her, it looks funny, make them tight"): nothing is placed at
// a fixed depth any more. Each piece is laid on what is under it (seatBack): rays cast at her back from behind find the
// hindmost surface along the piece's footprint (her clothes, a cuirass, a pelt, the wings' harness, then the shield for
// the weapon), the piece is tilted to that slope and set down just clear of it.
const _brq = new THREE.Quaternion(), _brq2 = new THREE.Quaternion(), _brv = new THREE.Vector3(), _be = new THREE.Euler();
const _rc = new THREE.Raycaster(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _bm = new THREE.Matrix4(), _bm2 = new THREE.Matrix4(), _bb = new THREE.Box3(), _bb2 = new THREE.Box3();
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _bc = new THREE.Vector3();
// what can be under a piece on her back: the torso and all it carries (head and hair included), never the arms (they
// swing), the pieces in `skip`, or what is hidden
function backMeshes(rig, skip) {
  const out = [], no = new Set([rig.armL, rig.armR, ...skip].filter(Boolean));
  const walk = (o) => { if (no.has(o) || o.visible === false || o.userData.capeCloth || o.userData.capeHinge) return; if (o.isMesh && !o.userData.outline) out.push(o); for (const c of o.children) walk(c); }; // (a cape goes over what is slung there: v31b)
  walk(rig.torso); return out;
}
// torso-space z of the hindmost surface behind the point (x, y) of her back (null: nothing there)
function backAt(rig, ms, x, y, over) {
  const T = rig.torso; _ro.set(x, y, -1.5).applyMatrix4(T.matrixWorld); _rd.set(0, 0, 1).transformDirection(T.matrixWorld);
  _rc.set(_ro, _rd); const h = _rc.intersectObjects(ms, false)[0];
  let z = h ? T.worldToLocal(h.point).z : null;
  if (z != null && over && rig.cape) z -= capeUnder(rig, h.object, x, y); // (v31b: a piece slung over a cape lies on the cape)
  return z != null && z < -.05 ? z : null; // past the edge of her back a ray finds her front (a braid on her chest): not her back
}
// an object's bounds in its own space (ignoring outlines)
function ownBox(o) {
  o.updateMatrixWorld(true); _bm.copy(o.matrixWorld).invert(); _bb.makeEmpty();
  o.traverse((m) => { if (!m.isMesh || m.userData.outline || !m.geometry) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); _bb.union(_bb2.copy(m.geometry.boundingBox).applyMatrix4(_bm2.multiplyMatrices(_bm, m.matrixWorld))); });
  return _bb;
}
// (what is in her hands hangs from her arms, so only what already lies on her back is under a new piece: the wings'
// harness, then the shield, then a first blade; the wings themselves beat and are never counted)
// the round shield flat on her shoulder blades: centre at torso (0, .3), tilted to the slope of her back
export function seatShield(rig, sh) {
  if (!rig.torso || !sh) return;
  const c = _bc.fromArray(sh.userData.center || [0, 0, 0]), bb = ownBox(sh), inner = bb.max.x - c.x, R = Math.min(.42, Math.max(bb.max.y - c.y, bb.max.z - c.z, .2));
  rig.root.updateMatrixWorld(true);
  const ms = backMeshes(rig, [sh, ...(rig.wings || [])]), yc = .34, pts = [];
  for (const fy of [-.8, -.4, 0, .4, .8]) for (const fx of [-.3, 0, .3]) { const y = yc + fy * R; if (y < .02) continue; const z = backAt(rig, ms, fx * R, y, true); if (z != null) pts.push([fy * R, z]); } // (her skirt below swings clear on its hinges)
  let a = 0, z0 = -.17;
  if (pts.length > 2) { // a plane z = z0 + a*y through the samples, then stood off by the furthest one that pokes through
    const n = pts.length, my = pts.reduce((q, p) => q + p[0], 0) / n, mz = pts.reduce((q, p) => q + p[1], 0) / n;
    const vy = pts.reduce((q, p) => q + (p[0] - my) ** 2, 0); a = clamp(vy > 1e-6 ? pts.reduce((q, p) => q + (p[0] - my) * (p[1] - mz), 0) / vy : 0, -.15, .3);
    z0 = Math.min(...pts.map(([y, z]) => z - a * y));
  }
  const th = Math.atan(a), q = _brq.setFromEuler(_be.set(th, -Math.PI / 2, 0, 'ZXY'));
  sh.quaternion.copy(q);
  sh.position.set(0, yc, z0 - (inner + .01) / Math.cos(th)).sub(_brv.copy(c).applyQuaternion(q));
  if (rig.torso !== sh.parent) rig.torso.add(sh);
}
// a weapon laid along its line on her back: grip at torso (x, y), blade pointing along `ang` in her back's plane (0 = up,
// turning toward her left shoulder), its flat against what is under it (shield included)
function seatWeapon(rig, w, x, y, ang) {
  const ud = w.userData || {}, tip = ud.tip ?? .9, butt = ud.butt ?? -.15, bb = ownBox(w), half = Math.min(.05, Math.max(.015, -bb.min.y, bb.max.y));
  rig.root.updateMatrixWorld(true);
  const ms = backMeshes(rig, [rig.weaponR, rig.weaponL, ...(rig.wings || [])]).filter((m) => !m.userData.boss); // (it lies on the shield's face, across its boss; a pair of blades only touch where they cross)
  const dx = Math.sin(ang), dy = Math.cos(ang), pts = [];
  for (let u = butt; u <= tip + 1e-6; u += Math.max(.06, (tip - butt) / 14)) { const yy = y + dy * u; if (yy < .02 || yy > .7) continue; const z = backAt(rig, ms, x + dx * u, yy, true); if (z != null) pts.push([u, z]); } // her back only: the skirt below swings on hinges, her head turns
  let a = 0, z0 = -.16;
  if (pts.length > 1) {
    const n = pts.length, mu = pts.reduce((q, p) => q + p[0], 0) / n, mz = pts.reduce((q, p) => q + p[1], 0) / n, vu = pts.reduce((q, p) => q + (p[0] - mu) ** 2, 0);
    a = clamp(vu > 1e-6 ? pts.reduce((q, p) => q + (p[0] - mu) * (p[1] - mz), 0) / vu : 0, -.12, .12); // (a long haft past her back would fan out on a steep slope)
    z0 = Math.min(...pts.map(([u, z]) => z - a * u));
  }
  // weapon +z along the blade (its slope out from her back included), weapon +y (its flat) toward her body
  _bz.set(dx, dy, a).normalize(); _by.set(0, 0, 1).addScaledVector(_bz, -_bz.z).normalize(); _bx.crossVectors(_by, _bz);
  w.quaternion.setFromRotationMatrix(_bm.makeBasis(_bx, _by, _bz));
  rig.torso.add(w); w.position.set(x, y, z0 - half - .008);
}
// lay everything on her back again (after a change of armour or wings)
export function seatBack(rig) {
  if (!rig.torso) return;
  if (rig.wingMount) seatWings(rig);
  if (rig._stowed) { stowWeapons(rig, false); stowWeapons(rig, true); }
  else if (rig.shieldBack) seatShield(rig, rig.shieldBack);
  if (rig.cape) seatCape(rig); // (v31b: the cape over all of it)
}
export function stowWeapons(rig, on) {
  if (!!rig._stowed === !!on || !rig.torso) return;
  if (on) {
    rig._stowed = [];
    const keep = (o) => { if (!o || !o.parent || o.visible === false) return false; rig._stowed.push({ o, parent: o.parent, pos: o.position.clone(), q: o.quaternion.clone() }); return true; };
    if (keep(rig.shield)) seatShield(rig, rig.shield);
    const st = rig.style || 'blade';
    // ang: 0 = blade up, PI = blade down; positive turns the blade toward her left (torso -x: the rig is mirrored)
    if (st === 'dual') { // two blades crossed low on the back, hilts out to the sides
      const lg = Math.max(0, (rig.weaponR?.userData?.tip ?? 1) - 1); // round 26: a longer pair (dragon_fangs) sits higher and spreads wider, so the tips stay off the ground
      if (keep(rig.weaponR)) seatWeapon(rig, rig.weaponR, -.16, .34 + lg * .3, Math.PI - .6 - lg * .4);
      if (keep(rig.weaponL)) seatWeapon(rig, rig.weaponL, .16, .34 + lg * .3, Math.PI + .6 + lg * .4);
    } else if (st === 'blade') { // hilt behind the right shoulder, tip down toward the left hip
      if (keep(rig.weaponR)) seatWeapon(rig, rig.weaponR, .2, .62, Math.PI + .5);
    } else if (keep(rig.weaponR)) { // spears, hafts and hammers: head up over the left shoulder, butt by the right hip
      seatWeapon(rig, rig.weaponR, .2, .12, -.45);
    }
  } else {
    for (const s of rig._stowed) { s.parent.add(s.o); s.o.position.copy(s.pos); s.o.quaternion.copy(s.q); }
    rig._stowed = null;
  }
  if (rig.cape) capeLid(rig); // (v31b: the cape is strapped under what is now on her back)
}

// ---------- gear (helmet, amulet, body armour, footwear) ----------
// Head/neck measurements for gear modellers. helmSocket origin = skull centre (head space y .19); the skull is an
// ellipsoid of radii (.2, .216, .196); face plane z ≈ .19, eyes at y +.015, chin at y -.215; V's hair cap reaches
// y +.27 and ±.22 sideways (hidden while a helmet is worn; braids hang from y -.07 at x ±.17).
// neckSocket origin = the pendant spot on the upper chest, +z out of the chest; the neck is a cylinder of radius
// .065 centred at (0, +.13, -.175) from it, the chest front slopes back ~.1 per .1 up.
export const GEAR_DIMS = { skull: [.2, .216, .196], faceZ: .19, eyeY: .015, chinY: -.215, hairTop: .27, hairSide: .22, neckR: .065, neckFromPendant: [0, .13, -.175] };
// Body armour and footwear are authored in torso space (the torso pivot sits at the hip: chest cylinder y .09..59,
// radius .18..25 with z squashed to .72, belt y .17, skirt y -.03..-.33 widening to .3). Parts that must follow a limb
// are groups tagged userData.bone ('armL'/'armR' at (∓.29, .56, 0), 'kneeL'/'kneeR' at (∓.11, -.46, 0)): equipGear
// moves each onto that bone, so boots swing with the legs. In knee space the shin runs y .01..-.29 (radius .08..07),
// the foot is a box .13 x .09 x .24 at (0, -.34, .04) and the ground is at y -.44.
export const GEAR_BONE_REST = { armL: [-.29, .56, 0], armR: [.29, .56, 0], kneeL: [-.11, -.46, 0], kneeR: [.11, -.46, 0] };
function equipLimbGear(rig, slot, model) {
  const socks = (rig.gearSocks ||= {});
  const sock = (bone) => {
    const k = slot + ':' + bone; let s = socks[k];
    if (!s && rig[bone]) {
      s = socks[k] = pivot(rig[bone], 0, 0, 0); s.name = 'gearSock:' + k;
      if (rig.warParts) { rig.warParts.push(s); s.visible = !rig.unarmed; } // V's home clothes (prologue) hide it
    }
    return s;
  };
  for (const [k, s] of Object.entries(socks)) if (k.startsWith(slot + ':')) for (const c of [...s.children]) s.remove(c);
  if (model) {
    let has = !!model.userData.outlined; model.traverse((o) => { if (o.userData.outline) has = true; });
    if (!has) addOutline(model, (m) => !m.castShadow || m.material.isMeshBasicMaterial || m.material.transparent);
    for (const part of [...model.children]) {
      const b = part.userData.bone; if (!b) continue;
      const s = sock(b); if (!s) { model.remove(part); continue; }
      part.position.set(0, 0, 0); s.add(part);
    }
    sock('torso')?.add(model);
  }
  // V's braids rest on her chest: lift them clear of a cuirass
  if (slot === 'body' && rig.braids) for (const b of rig.braids) {
    const z0 = b.userData.z0 ??= b.position.z, y = b.position.y;
    b.position.z = z0 + (model ? .045 * Math.max(0, Math.min(1, (.72 - y) / .14)) : 0);
  }
  if (slot === 'body' && rig.underArmour) for (const o of rig.underArmour) o.visible = !model; // her own pauldrons (?art=px) go under a cuirass's
  if (slot === 'feet' && rig.underBoots) for (const o of rig.underBoots) o.visible = !model; // and her knee cops under greaves or sandals
  if (slot === 'body') { // a cuirass's pteruges swing clear of her legs like her own skirt does (fitFlaps, round 18)
    rig.gearFlaps = [];
    model?.traverse((o) => { const f = o.userData.flap; if (f) rig.gearFlaps.push({ pv: o, ...f, th: f.tilt }); });
  }
  (rig.gear ||= {})[slot] = model || null;
  if (slot === 'body') seatBack(rig); // a cuirass or a pelt changes what the wings, shield and weapons lie on
  return rig;
}
// wings (slot 'back', round 22): the model is authored in torso space; its mount (userData.wingMount) is set against her
// back by seatWings, its two wing pivots (userData.wing = side) are beaten by wingBeat and she hovers (hoverRig)
function equipBack(rig, model) {
  let s = rig.backSock;
  if (!s) { s = rig.backSock = pivot(rig.torso, 0, 0, 0); s.name = 'gearSock:back'; if (rig.warParts) { rig.warParts.push(s); s.visible = !rig.unarmed; } } // V's home clothes (prologue) hide it
  for (const c of [...s.children]) s.remove(c);
  rig.wings = []; rig.wingMount = null;
  if (rig.cape) { unhangCape(rig, rig.cape); rig.cape = null; rig.backFlaps = null; rig.capeLid = null; } // (v31b: a cape off)
  if (model) {
    let has = !!model.userData.outlined; model.traverse((o) => { if (o.userData.outline) has = true; });
    if (!has) addOutline(model, (m) => !m.castShadow || m.material.isMeshBasicMaterial || m.material.transparent);
    s.add(model);
    model.traverse((o) => { if (o.userData.wing) rig.wings.push(o); if (o.userData.wingMount) rig.wingMount = o; if (o.userData.cape) rig.cape = o.userData.cape; });
  }
  rig.wingFlight = !!rig.wings.length && model?.userData.flight !== false; // (capes2: small wings, 30-69, are for show: no hover; any older pair flies as before)
  if (rig.shieldBack) rig.shieldBack.visible = !rig.wings.length && !rig.unarmed; // the slung shield gives her back to the wings
  (rig.gear ||= {}).back = model || null;
  seatBack(rig);
  return rig;
}
function seatWings(rig) { // the harness just clear of her back (or cuirass) between the shoulder blades
  const m = rig.wingMount; if (!m) return;
  rig.root.updateMatrixWorld(true);
  const ms = backMeshes(rig, [rig.backSock, rig.shieldBase, rig.shieldL, rig.weaponR, rig.weaponL].filter((o) => o && o.parent === rig.torso));
  let z = -.12; for (const y of [.3, .4, .5, .6]) for (const x of [-.1, 0, .1]) { const q = backAt(rig, ms, x, y); if (q != null) z = Math.min(z, q); }
  m.position.z = z - .03;
}
// ---------- v31b (Roy: "in the wings' slot, capes, for the lower levels"): capes ----------
// A cape is a back-slot model (gear_capes.js builds it) whose cloth is one closed slab (an outer face, a lining and a hem
// rim) laid each frame over a grid of hinged pivots: a hinge across the top (C.hinge, under the mount set against her
// back), and from it nc + 1 columns of nr hinged lengths each, fanned a little so the hem is wider than the shoulders.
// It moves the way the knight's cape does: the hinge swings out off her legs, arms and anything slung on her back
// (fitFlaps), a rope down its middle (hangChain) swings, trails and settles it by physics, and every column bends along
// that rope with a ripple of its own on top (capeAfter); it flows back with her speed and drapes after a blow. Only the
// generic humanoid bones are used (torso, hip, legs, knees, arms, elbows), so any rig built by humanoid() can wear one.
// C (on the mount's userData.cape): { mount, hinge, cols, mesh, nc, nr, seg, len, w0, w1, th, tilt, wrap, fan }
const _cm = new THREE.Matrix4(), _cm2 = new THREE.Matrix4(), _cv = new THREE.Vector3(), _cw = new THREE.Vector3();
export function capeRig(mount, o, mats) {
  const nc = o.nc || 8, nr = o.nr || 6, len = o.len, seg = len / nr, w0 = o.w0, w1 = o.w1, th = o.th ?? .022, tilt = o.tilt ?? .14, wrapZ = o.wrap ?? .05;
  const hinge = pivot(mount, 0, 0, 0); hinge.rotation.x = tilt; hinge.userData.capeHinge = true;
  const cols = [], fan = [];
  for (let c = 0; c <= nc; c++) {
    const u = c / nc - .5, col = [];
    let p = pivot(hinge, u * w0, 0, wrapZ * 4 * u * u); // (the top edge wraps forward round her shoulders)
    fan.push(Math.atan2(u * (w1 - w0), len)); p.rotation.z = fan[c];
    for (let j = 0; j < nr; j++) { col.push(p); if (j < nr - 1) p = pivot(p, 0, -seg, 0); }
    cols.push(col);
  }
  // the slab: outer face, lining, and a rim of quads round the edge (each quad its own four corners: crisp edges)
  const NV = (nc + 1) * (nr + 1), per = [];
  for (let c = 0; c <= nc; c++) per.push([c, 0]);
  for (let j = 1; j <= nr; j++) per.push([nc, j]);
  for (let c = nc - 1; c >= 0; c--) per.push([c, nr]);
  for (let j = nr - 1; j > 0; j--) per.push([0, j]);
  const NP = per.length, pos = new Float32Array((NV * 2 + NP * 4) * 3), uv = new Float32Array((NV * 2 + NP * 4) * 2), idx = [];
  const vi = (c, j) => c * (nr + 1) + j;
  for (let c = 0; c <= nc; c++) for (let j = 0; j <= nr; j++) { const k = vi(c, j); uv[k * 2] = c / nc; uv[k * 2 + 1] = 1 - j / nr; uv[(NV + k) * 2] = 1 - c / nc; uv[(NV + k) * 2 + 1] = 1 - j / nr; }
  const geo = new THREE.BufferGeometry();
  for (let c = 0; c < nc; c++) for (let j = 0; j < nr; j++) { const a = vi(c, j), b = vi(c + 1, j), d = vi(c, j + 1), e = vi(c + 1, j + 1); idx.push(a, b, d, b, e, d); }
  geo.addGroup(0, idx.length, 0); const n0 = idx.length;
  for (let c = 0; c < nc; c++) for (let j = 0; j < nr; j++) { const a = NV + vi(c, j), b = NV + vi(c + 1, j), d = NV + vi(c, j + 1), e = NV + vi(c + 1, j + 1); idx.push(a, d, b, b, d, e); }
  geo.addGroup(n0, idx.length - n0, 1); const n1 = idx.length;
  for (let i = 0; i < NP; i++) {
    const q = NV * 2 + i * 4; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
    for (let k = 0; k < 4; k++) { uv[(q + k) * 2] = (i + (k & 1)) / NP; uv[(q + k) * 2 + 1] = k >> 1; }
  }
  geo.addGroup(n1, idx.length - n1, 2);
  geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, mats); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.capeCloth = true; mount.add(mesh);
  const C = { mount, hinge, cols, mesh, geo, nc, nr, seg, len, w0, w1, th, tilt, wrap: wrapZ, fan, per, NV, P: new Float32Array(NV * 3), t: Math.random() * 9, mk: 0, sw: 0, atk: 0 };
  mount.userData.cape = C;
  layCape(C);
  geo.computeBoundingSphere(); geo.boundingSphere.radius += .8; // (it swings: never culled while it shows)
  return C;
}
// the cloth laid over the pivots as they are now (local matrices, mount space: world matrices may be a frame stale)
export function layCape(C) {
  const { nc, nr, P, NV, th } = C, A = C.geo.attributes.position.array;
  C.hinge.updateMatrix();
  for (let c = 0; c <= nc; c++) {
    _cm.copy(C.hinge.matrix);
    for (let j = 0; j <= nr; j++) {
      if (j < nr) { const p = C.cols[c][j]; p.updateMatrix(); _cm.multiply(p.matrix); _cv.set(0, 0, 0); } else _cv.set(0, -C.seg, 0);
      _cv.applyMatrix4(_cm); const k = (c * (nr + 1) + j) * 3; P[k] = _cv.x; P[k + 1] = _cv.y; P[k + 2] = _cv.z;
    }
  }
  const at = (c, j, out) => { const k = (Math.max(0, Math.min(nc, c)) * (nr + 1) + Math.max(0, Math.min(nr, j))) * 3; return out.set(P[k], P[k + 1], P[k + 2]); };
  const tx = new THREE.Vector3(), ty = new THREE.Vector3(), n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const outer = new Float32Array(NV * 3), inner = new Float32Array(NV * 3);
  for (let c = 0; c <= nc; c++) for (let j = 0; j <= nr; j++) {
    tx.subVectors(at(c + 1, j, a), at(c - 1, j, b)); ty.subVectors(at(c, j + 1, a), at(c, j - 1, b));
    n.crossVectors(tx, ty).normalize(); // (x along, y down the cape: x cross down = out of her back)
    const k = (c * (nr + 1) + j) * 3, h = th / 2 * (j === nr ? .8 : 1);
    for (let q = 0; q < 3; q++) { outer[k + q] = P[k + q] + n.getComponent(q) * h; inner[k + q] = P[k + q] - n.getComponent(q) * h; }
  }
  A.set(outer, 0); A.set(inner, NV * 3);
  for (let i = 0; i < C.per.length; i++) {
    const [c0, j0] = C.per[i], [c1, j1] = C.per[(i + 1) % C.per.length], k0 = (c0 * (nr + 1) + j0) * 3, k1 = (c1 * (nr + 1) + j1) * 3, q = (NV * 2 + i * 4) * 3;
    for (let s = 0; s < 3; s++) { A[q + s] = outer[k0 + s]; A[q + 3 + s] = outer[k1 + s]; A[q + 6 + s] = inner[k0 + s]; A[q + 9 + s] = inner[k1 + s]; }
  }
  C.geo.attributes.position.needsUpdate = true;
  C.geo.computeVertexNormals();
}
// on: the cape's mount set against her back (her clothes, a cuirass or a pelt; never her head or arms, nor what is slung
// there: the cape goes over a slung shield and stowed weapons), its hinge registered as a flap, its rope hung anew
function seatCape(rig) {
  const C = rig.cape; if (!C || !rig.torso) return;
  rig.root.updateMatrixWorld(true);
  const ms = backMeshes(rig, [rig.backSock, rig.head, rig.shieldBase, rig.shieldL, rig.shieldBack, rig.weaponR, rig.weaponL].filter(Boolean));
  let z = -.16; for (const y of [.5, .57, .63]) for (const x of [-.13, 0, .13]) { const q = backAt(rig, ms, x, y); if (q != null) z = Math.min(z, q); }
  C.mount.position.z = Math.max(-.42, z - .012 - C.th / 2);
  rig.backFlaps = [{ pv: C.hinge, a: Math.PI, len: C.len, tilt: C.tilt, th: C.tilt, hw: Math.min(.15, C.w0 / 2), ahw: .19, ohw: C.w1 / 2, sgn: 1, arms: true, cape: true }];
  rig._flapArms = true;
  if (C.rope) unhangCape(rig, C);
  for (const col of C.cols) for (const p of col) p.rotation.x = 0;
  C.hinge.rotation.x = C.tilt; C.hinge.updateMatrixWorld(true);
  C.rope = hangChain(rig, C.cols[C.nc >> 1], { end: [0, -C.seg, 0], k: 60, damp: 5.5, air: .06, rad: .05, sec: .85, wake: true, after: capeAfter });
  capeLid(rig);
  capeCords(rig, C);
}
// the cords over her shoulders to the clasps on her chest: measured on her (her clothes, a cuirass), whoever wears it
const _UPV = new THREE.Vector3(0, 1, 0), _crO = new THREE.Vector3(), _crD = new THREE.Vector3();
export function placeCord(m, a, b) { _cv.set(a[0], a[1], a[2]); _cw.set(b[0], b[1], b[2]); m.position.copy(_cv).add(_cw).multiplyScalar(.5); m.scale.set(1, Math.max(.001, _cv.distanceTo(_cw)), 1); m.quaternion.setFromUnitVectors(_UPV, _cw.sub(_cv).normalize()); }
export function capeCordPath(C, sx, top = .665, front = .19) { // back corner of the collar -> over the shoulder -> the clasp
  const my = C.mount.position.y, mz = C.mount.position.z;
  return [[sx * (C.w0 / 2 - .02), my + .015, mz + .015], [sx * .155, top + .02, -.035], [sx * .125, .575, front + .014]];
}
function torsoRay(rig, ms, o, d) {
  const T = rig.torso; _crO.copy(o).applyMatrix4(T.matrixWorld); _crD.copy(d).transformDirection(T.matrixWorld);
  _rc.set(_crO, _crD); const h = _rc.intersectObjects(ms, false)[0]; return h ? T.worldToLocal(h.point.clone()) : null;
}
function capeCords(rig, C) {
  if (!C.cords?.length) return;
  const ms = backMeshes(rig, [rig.backSock, rig.head, rig.shieldBase, rig.shieldL, rig.shieldBack, rig.weaponR, rig.weaponL].filter(Boolean));
  for (const k of C.cords) {
    const tp = torsoRay(rig, ms, _cv.set(k.sx * .155, 1.4, -.035), _cw.set(0, -1, 0)), fr = torsoRay(rig, ms, _cv.set(k.sx * .125, .575, 1.5), _cw.set(0, 0, -1));
    const P = capeCordPath(C, k.sx, tp && tp.y < .9 && tp.y > .5 ? tp.y : .665, fr && fr.z > .06 && fr.z < .45 ? fr.z : .19);
    placeCord(k.a, P[0], P[1]); placeCord(k.b, P[1], P[2]);
    if (k.clasp) k.clasp.position.set(P[2][0], P[2][1], P[2][2]);
  }
}
function unhangCape(rig, C) {
  if (!C?.rope) return;
  rig.ropes = (rig.ropes || []).filter((H) => H !== C.rope); if (!rig.ropes.length) rig.ropes = null;
  const set = new Set(C.rope.pivots); rig.ropePivots = (rig.ropePivots || []).filter((p) => !set.has(p));
  C.rope = null;
}
// what lies on her back under the cape (a slung shield, stowed weapons): torso-space spheres the hinge swings clear of
// how much a cape adds under a piece slung on her back where a ray hit `hit` at torso (x, y): its thickness and a little,
// where it covers her (not over the shield or a blade already on it, which lie on the cape themselves)
function capeUnder(rig, hit, x, y) {
  const C = rig.cape; if (!C?.mesh.parent) return 0;
  for (let o = hit; o && o !== rig.torso; o = o.parent) if (o === rig.shieldBack || o === rig.shield || o === rig.weaponR || o === rig.weaponL) return 0;
  const top = C.mount.position.y + (C.mount.parent?.position.y || 0);
  return y < top + .06 && Math.abs(x) < C.w1 / 2 + .04 ? C.th + .016 : 0;
}
function capeLid(rig) { // points along what is slung on her back (torso space, with a radius): the cape stays under them
  if (!rig.cape) { rig.capeLid = null; return; }
  const out = [], T = rig.torso, objs = [];
  if (rig.shieldBack && rig.shieldBack.visible !== false && rig.shieldBack.parent === T) objs.push(rig.shieldBack);
  for (const s of rig._stowed || []) if (s.o.parent === T && s.o.visible !== false && !objs.includes(s.o)) objs.push(s.o);
  rig.root.updateMatrixWorld(true); _cm2.copy(T.matrixWorld).invert();
  for (const o of objs) {
    const b = ownBox(o); if (b.isEmpty()) continue;
    _cm.multiplyMatrices(_cm2, o.matrixWorld);
    const n = ['x', 'y', 'z'].map((k) => clamp(Math.ceil((b.max[k] - b.min[k]) / .1) + 1, 2, 12)); // (every 10 cm along it)
    for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
      _cv.set(b.min.x + (b.max.x - b.min.x) * i / (n[0] - 1), b.min.y + (b.max.y - b.min.y) * j / (n[1] - 1), b.min.z + (b.max.z - b.min.z) * k / (n[2] - 1)).applyMatrix4(_cm);
      if (_cv.z < -.08) out.push([_cv.x, _cv.y, _cv.z, .02]);
    }
  }
  rig.capeLid = out.length ? out : null;
}
// after the rope has moved (simRopes): every column bent along it, then the cape's own life on top: a slow ripple at rest,
// a quicker one and a flow back as she moves, a swing out on a turn, a billow after each blow
const _cq = new THREE.Vector3();
function capeAfter(H, dt) {
  const r = H.r, C = r.cape; if (!C || C.rope !== H) return;
  const st = r._capeSt || {}, k6 = 1 - Math.exp(-dt * 6);
  const mv = st.moving ? (st.run ? 1 : .55) : 0; C.mk += (mv - C.mk) * Math.min(1, dt * 4); const mk = C.mk;
  const yaw = r.root.rotation.y, dy = C.yaw === undefined ? 0 : wrap(yaw - C.yaw); C.yaw = yaw;
  C.sw += (clamp(dy / Math.max(dt, 1e-3) * .2, -1, 1) - C.sw) * Math.min(1, dt * 3);
  const at = st.attackT !== undefined && st.attackT >= 0 && st.attackT <= 1 ? Math.sin(Math.PI * st.attackT) : st.skill && st.skill.t >= 0 && st.skill.t <= 1 ? Math.sin(Math.PI * st.skill.t) * .8 : 0;
  C.atk += (at - C.atk) * (at > C.atk ? k6 * 2 : k6 * .5); // (swells with the blow, settles slowly after it)
  const tw = r.torso.rotation.y, dtw = C.tw === undefined ? 0 : tw - C.tw; C.tw = tw;
  C.twv = (C.twv || 0) + (clamp(dtw / Math.max(dt, 1e-3) * .12, -1, 1) - (C.twv || 0)) * Math.min(1, dt * 5); // the torso's own twist in a swing
  C.t += dt;
  const t = C.t, w = 1.4 + mk * 4, fl = mk * .05 + C.atk * .07, n = C.nc;
  const bl = Math.min(1, mk * .9 + C.atk * .8); // (how full the cloth is of air)
  const top = .22 + C.atk * .3 + mk * .08, held = r.backFlaps?.[0]?.lidDrop || 0; // (strapped under a slung shield or blade down to here: those lengths lie flat)
  for (let i = 0; i <= n; i++) {
    const col = C.cols[i], u = i / n - .5;
    col[0].rotation.x = 0; bendChain(col, H.R, { lo: 0, hi: 1.2, side: .3, first: 'max' });
    for (const p of col) p.rotation.x *= .55; // (wool is heavier than the rope: it lifts about half as far)
    if (col[0].rotation.x > top) { col[1].rotation.x += (col[0].rotation.x - top) * .5; col[0].rotation.x = top; } // (bound at her shoulders, its top lifts only so far: the cloth below curves out instead)
    // capes2 (Roy: "running, it reads as a board"): in a run or a blow the cloth fills like a sail instead of lifting flat:
    // the middle lifts further than the edges (a belly that keeps its depth seen from the side), the edges droop and curl
    // in towards her, the hem fans wider, and the waves along it grow and run across it, so its outline is never straight
    const e = 4 * u * u;
    for (let j = 0; j < col.length; j++) {
      const p = col[j], d = j / Math.max(1, col.length - 1);
      if (held > j * C.seg + .02) { p.rotation.x = 0; p.rotation.z = j ? 0 : C.fan[i]; continue; }
      const wav = Math.sin(t * w + i * 1.1 - j * 1.3) * (.014 + .036 * d) * (1 + mk * 2.4 + C.atk * 1.6)
        + Math.sin(t * w * 1.7 - i * 1.9 + j * .7) * .02 * d * bl; // (a second, crossing wave: the hem ripples, never a straight edge)
      p.rotation.x = p.rotation.x * (1 + bl * (.3 - .75 * e)) + fl * (.4 + d) * (j ? 1 : .5) + wav + C.atk * .05 * d
        - (j ? bl * e * .14 * j : 0) + (j === 1 ? bl * (1 - e) * .08 : 0); // (the belly: the middle lifted, the edges drooping)
      p.rotation.z = p.rotation.z * .6 + (j ? 0 : C.fan[i] * (1 + C.atk * .35 + bl * .3)) - (C.sw + C.twv) * .05 * (j + 1)
        + Math.sin(t * w * .7 + i * .55 - j * .9) * .012 * (j + 1) * (1 + mk) + u * (C.atk * .04 + bl * .05) * (j + 1);
    }
  }
  layCape(C);
}
// the cape as a solid body for V's braids (they lie on it, over it as it swings): its middle column's lengths, each a box
// in its own frame as wide as the cape there, left only out of its outer face; null without a cape (or with it off)
function capeBodies(r) {
  const C = r.cape;
  if (!C || !C.mesh.parent || r.backSock?.visible === false || r.unarmed) return null;
  const col = C.cols[C.nc >> 1], B = (C._bod ||= { C, seg: col.map(() => ({ inv: new THREE.Matrix4(), mw: null, sc: 1 })) });
  col.forEach((p, j) => { const s = B.seg[j]; s.inv.copy(p.matrixWorld).invert(); s.mw = p.matrixWorld; s.sc = p.matrixWorld.getMaxScaleOnAxis() || 1; });
  return B;
}
const _cbLo = new THREE.Vector3(), _cbHi = new THREE.Vector3(), _cbN = new THREE.Vector3();
function capeBox(B, j, rf) { const C = B.C, hw = (C.w0 + (C.w1 - C.w0) * (j + .5) / C.nr) / 2 + rf * .5; _cbLo.set(-hw, -C.seg - (j === C.nr - 1 ? 0 : .02), -C.th / 2); _cbHi.set(hw, j ? .02 : -.03, .3); }
function capePush(B, p, rr) {
  let hit = null;
  B.seg.forEach((s, j) => {
    const q = _cq.copy(p).applyMatrix4(s.inv), rf = rr / s.sc; capeBox(B, j, rf);
    const h = hitBox(q, _cbLo, _cbHi, rf, 16); if (!h) return;
    p.copy(q.applyMatrix4(s.mw)); hit = _cbN.copy(h).transformDirection(s.mw);
  });
  return hit;
}
function capeRest(B, p, rr) { // a braid's resting spot lifted off the cape's outer face (it lies on it, at rest too)
  B.seg.forEach((s, j) => {
    const q = _cq.copy(p).applyMatrix4(s.inv), rf = rr / s.sc; capeBox(B, j, rf);
    if (q.x < _cbLo.x || q.x > _cbHi.x || q.y < _cbLo.y || q.y > _cbHi.y || q.z > _cbHi.z) return;
    const to = _cbLo.z - rf; if (q.z <= to) return;
    q.z = to; p.copy(q.applyMatrix4(s.mw));
  });
}
export function equipGear(rig, slot, model) {
  if (slot === 'body' || slot === 'feet') return equipLimbGear(rig, slot, model);
  if (slot === 'back' || slot === 'wings') return equipBack(rig, model);
  if (slot === 'shield') return equipShield(rig, model);
  const helm = slot === 'helm' || slot === 'helmet' || slot === 'head';
  let sock = helm ? rig.helmSocket : rig.neckSocket;
  if (!sock) {
    sock = helm ? pivot(rig.head, 0, .19, 0) : pivot(rig.torso, 0, .5, .175);
    if (helm) rig.helmSocket = sock; else rig.neckSocket = sock;
  }
  for (const c of [...sock.children]) sock.remove(c);
  if (model) {
    let has = !!model.userData.outlined; model.traverse((o) => { if (o.userData.outline) has = true; });
    if (!has) addOutline(model, (m) => !m.castShadow || m.material.isMeshBasicMaterial || m.material.transparent);
    sock.add(model);
  }
  if (helm && rig.hair) { let keep = false; model?.traverse((o) => { if (o.userData.keepHair) keep = true; }); for (const h of rig.hair) h.visible = !model || keep; } // (keepHair: a circlet, not a helmet: online/staffgear.js)
  (rig.gear ||= {})[helm ? 'helm' : 'neck'] = model || null;
  return rig;
}

// ======================================================================================
// The steed: a riding horse with saddle, bridle and reins, and proper gaits.
// Faces +z, root at the hooves. h.seat: put the rider's root at its world transform (st.ride = true).
// ======================================================================================
const COATS = {
  bay: { body: '#7c4429', mane: '#1d1512', leg: '#2a1c16', muzzle: '#3e281c', mark: 'star', socks: [0, 0, 0, 0], cloth: '#8e2b25' },
  black: { body: '#2a2730', mane: '#121016', leg: '#201e26', muzzle: '#35303a', mark: 'star', socks: [0, 0, 1, 0], cloth: '#2f5a8e' },
  white: { body: '#e8e4da', mane: '#f7f5f0', leg: '#dcd6ca', muzzle: '#9a8e88', mark: null, socks: [0, 0, 0, 0], cloth: '#2f5a8e', hoof: '#6e665c' },
  chestnut: { body: '#a8562a', mane: '#d08a46', leg: '#a8562a', muzzle: '#6e3c22', mark: 'blaze', socks: [1, 0, 0, 1], cloth: '#2f6a4a' },
  grey: { body: '#8c8c94', mane: '#3c3c44', leg: '#4c4c54', muzzle: '#4a4a52', mark: null, socks: [0, 0, 0, 0], cloth: '#8e2b25' },
  dapple: { body: '#a4a4ab', mane: '#e6e6ea', leg: '#5c5c64', muzzle: '#5a5a62', spots: '#d2d2d8', mark: 'blaze', socks: [0, 0, 0, 0], cloth: '#6a2a5a' },
};
const _sa = new THREE.Vector3(), _sz = new THREE.Vector3(0, 0, 1);
function strap(parent, a, b, w, h, color, opts) {
  const d = _sa.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = d.length();
  const m = box(parent, w, h, len, color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, opts);
  m.quaternion.setFromUnitVectors(_sz, d.normalize());
  return m;
}
export function makeSteed(coat = 'bay') {
  const C = COATS[coat] || COATS.bay, bc = C.body, hoofC = C.hoof || '#2b2622';
  const LEATHER = '#3e2617', LEATHER2 = '#5a3720', BRONZE = '#c8913a', SOCK = '#efebe2';
  const root = new THREE.Group();
  const body = pivot(root, 0, 1.1, 0);
  // ---- barrel, chest, quarters ----
  // (round 33 stage 10: rounder, the body's masses one subdivision finer and the limbs and neck with more sides)
  ball(body, .4, bc, 0, 0, 0, 2).scale.set(.68, .8, 1.3);
  ball(body, .36, bc, 0, .02, .44, 2).scale.set(.8, .95, .95);
  const qR = ball(body, .37, bc, 0, .05, -.5, 2); qR.scale.set(.86, .9, .9);
  const qS = [], spotsB = [];
  for (const sx of [-1, 1]) {
    const q = ball(body, .22, bc, sx * .15, -.1, -.55, 1); q.scale.set(.75, 1.15, 1); qS.push(q);
    ball(body, .19, bc, sx * .14, -.06, .48, 1).scale.set(.7, 1.25, .95);
  }
  ball(body, .14, bc, 0, .28, .42, 0).scale.set(.9, .8, 1.5); // withers
  if (C.spots) { // dapples
    let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      const zc = -.6 + rnd() * 1.1, a = (rnd() - .5) * 2.4, sx = rnd() < .5 ? -1 : 1;
      const rz = zc < -.25 ? [.32, .33] : zc > .3 ? [.29, .33] : [.275, .32];
      const sp = ball(body, .045 + rnd() * .03, C.spots, sx * Math.cos(a) * rz[0] * .98, Math.sin(a) * rz[1] * .9 + .02, zc, 0, { noShadow: true });
      sp.scale.set(.5, 1, 1.2); if (zc < -.3) spotsB.push(sp);
    }
  }
  // ---- neck & head ----
  const neck = pivot(body, 0, .2, .6); neck.rotation.order = 'YXZ'; neck.rotation.x = .6;
  tcyl(neck, .13, .21, .8, bc, 0, .34, -.02, 12).scale.x = .7;
  // round 33 stage 10 (SHIP): the mane as eight locks of hair from the crest, lying over to the off side of the neck in round
  // lobes like V's braids; each lock is a short rope (rope.js, steedRopes) that swings with the head and streams back at a
  // gallop. h.mane keeps each lock's root (what the dressed horses hide)
  const mane = [], locks = [];
  for (let i = 0; i < 8; i++) {
    const y = .03 + i * .094, rr = .21 - (.08 * (y + .06)) / .8 + .03;
    const pts = [0, .62, 1.18].map((ph, k) => new THREE.Vector3(Math.sin(ph) * rr * .72, y - k * .03, -Math.cos(ph) * rr));
    let par = neck; const piv = [];
    for (let k = 0; k < 2; k++) {
      const len = pts[k + 1].distanceTo(pts[k]), pv = k ? pivot(par, 0, -pts[1].distanceTo(pts[0]), 0) : pivot(par, pts[0].x, pts[0].y, pts[0].z);
      ball(pv, .05 - k * .012, C.mane, 0, -len * .5, 0, 1, { noShadow: k > 0 }).scale.set(.75, len / (.1 - k * .024) * 1.15, .95);
      piv.push(pv); par = pv;
    }
    mane.push(piv[0]); locks.push({ piv, pts });
  }
  const head = pivot(neck, 0, .72, .02); head.rotation.order = 'YXZ'; head.rotation.x = .3;
  ball(head, .15, bc, 0, .02, .04, 1).scale.set(.8, .9, 1.1);
  ball(head, .13, bc, 0, -.07, .1, 1).scale.set(.75, .85, 1);
  const face = tcyl(head, .085, .115, .38, bc, 0, -.01, .3, 12); face.rotation.x = Math.PI / 2; face.scale.x = .78;
  ball(head, .09, C.muzzle, 0, -.04, .5, 1).scale.set(.85, .8, .9);
  for (const sx of [-1, 1]) {
    box(head, .03, .035, .02, '#140e0c', sx * .045, -.015, .577, { noShadow: true });
    box(head, .022, .05, .066, '#120c0a', sx * .104, .045, .13, { noShadow: true });
    box(head, .012, .016, .016, '#fbf6ee', sx * .117, .062, .152, { noShadow: true });
    box(head, .03, .02, .08, bc, sx * .1, .08, .12, { noShadow: true }); // brow ridge
  }
  const ears = [];
  for (const sx of [-1, 1]) {
    const ep = pivot(head, sx * .06, .13, -.02); ep.rotation.set(-.15, 0, -sx * .18); ears.push(ep);
    cone(ep, .04, .16, bc, 0, .07, 0, 4).scale.z = .7;
  }
  box(head, .09, .03, .18, C.mane, 0, .14, .09).rotation.x = .3; // forelock
  if (C.mark === 'blaze') box(head, .045, .016, .37, SOCK, 0, .1, .3, { noShadow: true }).rotation.x = .17;
  if (C.mark === 'star') { const s = box(head, .055, .016, .055, SOCK, 0, .148, .13, { noShadow: true }); s.rotation.set(.3, Math.PI / 4, 0, 'YXZ'); }
  // bridle
  const nb = tcyl(head, .106, .106, .035, LEATHER, 0, -.01, .38, 8); nb.rotation.x = Math.PI / 2; nb.scale.x = .8;
  box(head, .25, .028, .03, LEATHER, 0, .115, .11);
  const bits = [];
  for (const sx of [-1, 1]) {
    ball(head, .026, BRONZE, sx * .122, .1, .11, 0, { noShadow: true });
    strap(head, [sx * .12, .1, .1], [sx * .082, -.05, .44], .018, .03, LEATHER);
    const bt = tcyl(head, .03, .03, .014, BRONZE, sx * .082, -.06, .46, 8); bt.rotation.z = Math.PI / 2;
    bits.push(pivot(head, sx * .085, -.06, .46));
  }
  // ---- tail ----
  const tail = [];
  for (let i = 0; i < 5; i++) {
    const seg = i === 0 ? pivot(body, 0, .3, -.86) : pivot(tail[i - 1], 0, -.15, 0);
    const m = tcyl(seg, i === 0 ? .055 : .045 + i * .012, .055 + i * .016, .17, i === 0 ? bc : C.mane, 0, -.075, 0, 8); m.scale.x = .8;
    if (i) ball(seg, .05 + i * .014, C.mane, 0, -.1, -.012, 1, { noShadow: true }).scale.set(.95, 1.55, .85); // (round 33: a fuller, rounder fall of hair)
    seg.rotation.x = i === 0 ? .42 : .1; tail.push(seg);
  }
  // ---- legs: [FL, FR, HL, HR] (L = -x side) ----
  const legs = [], joints = [];
  [[-.15, -.18, .48, 0], [.15, -.18, .48, 0], [-.16, -.16, -.55, 1], [.16, -.16, -.55, 1]].forEach(([x, y, z, hind], i) => {
    const low = C.socks[i] ? SOCK : C.leg;
    const L = pivot(body, x, y, z); let kn;
    if (!hind) {
      tcyl(L, .1, .065, .48, bc, 0, -.2, 0, 10);
      kn = pivot(L, 0, -.44, 0);
    } else {
      const g = tcyl(L, .11, .065, .46, bc, 0, -.22, -.07, 10); g.rotation.x = .31;
      kn = pivot(L, 0, -.44, -.14);
    }
    ball(kn, .062, C.leg === bc ? bc : low, 0, 0, 0, 0);
    tcyl(kn, .05, .046, hind ? .33 : .31, low, 0, hind ? -.16 : -.15, 0, 9);
    const ft = pivot(kn, 0, hind ? -.32 : -.3, 0);
    ball(ft, .053, low, 0, 0, 0, 0);
    tcyl(ft, .042, .05, .11, low, 0, -.06, .015, 9).rotation.x = -.25;
    const hf = pivot(ft, 0, -.115, .03); // round 26: the coffin joint, so the hoof can lie flat while the pastern sinks, and flip up in the swing
    tcyl(hf, .06, .075, .085, hoofC, 0, -.025, .005, 10);
    legs.push(L); joints.push({ up: L, knee: kn, fet: ft, hoof: hf, hind: !!hind });
  });
  // ---- saddle with bronze fittings ----
  box(body, .6, .03, .64, C.cloth, 0, .335, 0);
  for (const sx of [-1, 1]) {
    box(body, .03, .3, .62, C.cloth, sx * .25, .2, 0).rotation.z = sx * .3;
    box(body, .035, .035, .64, '#d6a640', sx * .295, .057, 0, { noShadow: true }).rotation.z = sx * .3;
    box(body, .025, .22, .3, LEATHER2, sx * .238, .27, .05).rotation.z = sx * .32;
    const ro = tcyl(body, .045, .045, .02, BRONZE, sx * .27, .27, .05, 8); ro.rotation.z = Math.PI / 2;
    strap(body, [sx * .25, .3, .07], [sx * .375, -.045, .11], .035, .018, LEATHER);
    box(body, .12, .022, .075, BRONZE, sx * .38, -.075, .12);
    strap(body, [sx * .33, -.07, .12], [sx * .37, .0, .115], .016, .016, BRONZE, { noShadow: true });
    strap(body, [sx * .43, -.07, .12], [sx * .385, .0, .115], .016, .016, BRONZE, { noShadow: true });
    strap(body, [sx * .22, .22, .22], [sx * .02, .03, .79], .03, .04, LEATHER);
  }
  for (const sx of [-1, 1]) for (let z = -.27; z <= .28; z += .09) ball(body, .014, BRONZE, sx * .306, .043, z, 0, { noShadow: true }); // (round 33: brass rivets along the cloth's gilt hem)
  box(body, .32, .06, .44, LEATHER, 0, .37, 0);
  box(body, .24, .13, .07, LEATHER, 0, .42, .2).rotation.x = -.35;
  box(body, .3, .12, .06, LEATHER, 0, .42, -.2).rotation.x = .4;
  ball(body, .03, BRONZE, 0, .49, .225, 0, { noShadow: true });
  for (const sx of [-1, 1]) ball(body, .025, BRONZE, sx * .13, .47, -.22, 0, { noShadow: true });
  const gb = tcyl(body, 1, 1, 1, LEATHER, 0, 0, .16, 10); gb.rotation.x = Math.PI / 2; gb.scale.set(.285, .06, .335);
  const md = tcyl(body, .055, .055, .02, BRONZE, 0, .03, .79, 8); md.rotation.x = Math.PI / 2;
  const roll = tcyl(body, .065, .065, .34, '#c8b48a', 0, .42, -.3, 8); roll.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) box(body, .02, .14, .14, LEATHER, sx * .1, .42, -.3, { noShadow: true });
  // round 26: the croup (quarters, hind legs, tail) hangs from the loins on its own pivot, so the back can round and
  // stretch with the gallop stride (the lumbosacral flex)
  const croup = pivot(body, 0, .1, -.32);
  root.updateMatrixWorld(true);
  for (const o of [qR, ...qS, ...legs.slice(2), tail[0], ...spotsB]) croup.attach(o);
  const saddle = pivot(body, 0, .49, -.02); // rider's hip point; counter-rotates part of the body pitch so riders stay upright
  const seat = pivot(saddle, 0, -.9, 0);
  // ---- reins (re-aimed every frame between the bit and the hands) ----
  const reins = [];
  for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(boxGeo(), mat(LEATHER)); m.castShadow = true; body.add(m); reins.push(m); }
  const h = {
    root, body, croup, neck, head, legs, tail, seat, saddle, mane, locks, ears, bits, reins, joints, coat, steed: true,
    cycle: 0, spd: 0, t: Math.random() * 10, gait: 'idle', strike: 0, rear: 0, graze: 0, grazeT: 4 + Math.random() * 6,
    swishT: 2 + Math.random() * 3, swish: 0, earT: [1 + Math.random() * 3, 2 + Math.random() * 3], lastP: [0, 0, 0, 0], rest: 0,
  };
  if (PXART) { // coat, legs, muzzle and socks share one neutral short-hair tile and the mane one strand tile, each tinted per coat
    const N = (hx) => [bkFurN, hx], cl = PXK.paTile('twillN', 16, 16, (c) => { for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) c.P(i, j, PXK.NEU[[2, 4, 3, 3][(i + j) % 4]]); }, true);
    PXK.skin(root, { [bc]: N(bc), [C.leg]: N(C.leg), [C.muzzle]: N(C.muzzle), [SOCK]: N(SOCK), ...(C.spots ? { [C.spots]: N(C.spots) } : {}), [C.mane]: [bkStrN, C.mane], [C.cloth]: [cl, C.cloth],
      [LEATHER]: bkLea(LEATHER), [LEATHER2]: bkLea(LEATHER2), [BRONZE]: bkMetal(BRONZE), '#d6a640': bkMetal('#d6a640'), '#c8b48a': bkStr('#c8b48a', 3, 0), [hoofC]: bkGrit(hoofC, { fleck: 4 }) });
  }
  addOutline(root, (m) => !m.castShadow || m.material.isMeshBasicMaterial); pxRig(root); // the characters' pixel shading (render.js)
  animateSteed(h, 0, {});
  return h;
}

// round 26 (Roy: "the horse gallops strangely"): the gaits rebuilt on real footfalls, with every hoof placed by IK.
// Footfall times T in the stride [FL, FR, HL, HR] (0 = right hind down), written so neighbouring gaits blend without a
// jump: walk 4-beat lateral (RH RF LH LF); trot in diagonal pairs; canter 3-beat, right lead (LH, then RH with LF, then
// RF, a short float); gallop 4-beat transverse, right lead (LH, RH, LF, RF, then the gathered suspension).
// d: duty (share of the stride a hoof is down), f: strides/s at v m/s; lF/lH fetlock lift in the swing (fore/hind),
// fF/fH pastern fold and hF/hH hoof flip (rad, relative), sink: fetlock drop at mid-stance, bo: heel lift at breakover,
// zF/zH: where under the horse each stance is centred (+ forward), sm: the longest stance sweep (m) the legs reach, ov/back: the fore's reach-and-draw-back and the
// early tuck, crouch: lower body; body curves: amplitude, harmonics per stride, phase (bob, pitch nose-down +, neck,
// loins flex; triples, summed), tail lift.
const GAITS = [
  { name: 'walk', T: [.75, .25, .5, 0], d: () => .62, f: (v) => 1 + .25 * v, lF: .17, lH: .13, fF: .8, fH: .6, hF: .5, hH: .4, sink: .08, ph0: .04, bo: .35, zF: -.03, zH: .08, ov: .02, back: .02, crouch: .03, sm: .75,
    bob: [.016, 2, .12], pitch: [.012, 2, 0], neck: [.07, 2, .3], flex: [.01, 2, .1], tail: 0 },
  { name: 'trot', T: [1, .5, .5, 0], d: () => .42, f: (v) => 1.6 + .1 * v, lF: .34, lH: .25, fF: 1.2, fH: .9, hF: .7, hH: .5, sink: .2, ph0: .08, bo: .5, zF: -.06, zH: .12, ov: .04, back: .04, crouch: .05, sm: .85,
    bob: [.035, 2, .2], pitch: [.01, 2, .1], neck: [.025, 2, .27], flex: [.015, 2, .2], tail: .3 },
  { name: 'canter', T: [1, .25, .78, 0], d: () => .3, f: (v) => 1.8 + .04 * v, lF: .42, lH: .26, fF: 1.35, fH: .85, hF: .8, hH: .45, sink: .26, ph0: .1, bo: .6, zF: -.09, zH: .12, ov: .06, back: .06, crouch: .07, sm: 1.15,
    bob: [.05, 1, .14], pitch: [.07, 1, .3], neck: [.12, 1, .4], flex: [.05, 1, .72], tail: .65 },
  { name: 'gallop', T: [1.22, .34, .88, 0], d: (v) => clamp(.31 - .018 * (v - 11), .22, .31), f: (v) => 1.95 + .045 * v, lF: .44, lH: .28, fF: 1.5, fH: .9, hF: .9, hH: .5, sink: .32, ph0: .12, bo: .7, zF: -.1, zH: .13, ov: .08, back: .05, crouch: .09, sm: 1.25,
    bob: [.045, 1, .24, .035, 2, .02], pitch: [.09, 1, .45], neck: [.16, 1, .5], flex: [.07, 1, .78], tail: 1 },
];
const _sgp = [0, 0, 0, 0], GK = ['lF', 'lH', 'fF', 'fH', 'hF', 'hH', 'sink', 'ph0', 'bo', 'zF', 'zH', 'ov', 'back', 'crouch', 'tail', 'sm'], _G = {}, _gw = [0, 0, 0, 0], _gT = [0, 0, 0, 0];
// m/s for the 0..1 speed knob (vehicles' spdParam backwards) when the caller gives no real ground speed
const steedV = (s) => (s <= .35 ? s / .35 * 2.2 : s <= .65 ? 2.2 + (s - .35) / .3 * 2.8 : 5 + (s - .65) / .35 * 9);
function gaitWeights(v, w) {
  const u1 = smooth((v - 2.7) / .8), u2 = smooth((v - 6.2) / 1), u3 = smooth((v - 10.2) / 1.4);
  w[0] = 1 - u1; w[1] = u1 * (1 - u2); w[2] = u2 * (1 - u3); w[3] = u3;
}
const bodyWave = (key, c) => { let r = 0; for (let g = 0; g < 4; g++) if (_gw[g]) for (let j = 0, B = GAITS[g][key]; j < B.length; j += 3) r += _gw[g] * B[j] * Math.cos(Math.PI * 2 * B[j + 1] * (c - B[j + 2])); return r; };
// the leg's rest geometry, read once off the rig: pivot, segment lengths, the scapula / femur swing that carries the
// elbow / stifle toward the hoof (that is what lets a leg reach so far fore and aft), the rest fetlock in the root frame
const SOLE_P = [-.115, .03], SOLE_H = [-.0675, .005]; // fetlock -> coffin joint, coffin joint -> sole (y, z)
function steedIK(h) {
  if (h._ik) return h._ik;
  return (h._ik = h.joints.map((J) => {
    const P0y = J.up.position.y, P0z = J.up.position.z, L1 = J.hind ? Math.hypot(.44, .14) : .44, L2 = J.hind ? .32 : .3, a0 = J.hind ? Math.atan2(.14, .44) : 0;
    const Wy = P0y + (J.hind ? .26 : .44), Wz = P0z + (J.hind ? .13 : -.08), psi0 = Math.atan2(-(P0z - Wz), -(P0y - Wy));
    const Fy = P0y - (J.hind ? .44 + L2 : L1 + L2), Fz = P0z - (J.hind ? .14 : 0);
    return { P0y, P0z, L1, L2, a0, Wy, Wz, Ls: Math.hypot(P0y - Wy, P0z - Wz), psi0, kap: J.hind ? 1 : .9, th0: Math.atan2(-(Fz - Wz), -(Fy - Wy)),
      Fy: (J.hind ? 1.2 : 1.1) + Fy, Fz: (J.hind ? -.32 : 0) + Fz }; // rest fetlock in the root frame (croup at body + (.1, -.32))
  }));
}
const _rot = (y, z, a, o) => { const c = Math.cos(a), s = Math.sin(a); o[0] = y * c - z * s; o[1] = y * s + z * c; return o; };
const _ang = (y, z) => Math.atan2(-z, -y); // a limb's angle from hanging straight down (+ = swung back)
const A_SP = _ang(SOLE_P[0], SOLE_P[1]), A_SH = _ang(SOLE_H[0], SOLE_H[1]);
const _v2 = [0, 0], _v3 = [0, 0], _E = [0, 0], _fr = { y: 0, z: 0, th: 0 }, _st = { Fy: 0, Fz: 0, ph: 0, ps: 0 }, _st0 = { Fy: 0, Fz: 0, ph: 0, ps: 0 }, _st1 = { Fy: 0, Fz: 0, ph: 0, ps: 0 };
// root frame -> the leg's parent frame (_fr: its origin and pitch in the root frame)
const _loc = (y, z, o) => { const dy = y - _fr.y, dz = z - _fr.z, c = Math.cos(_fr.th), s = Math.sin(_fr.th); o[0] = dy * c + dz * s; o[1] = -dy * s + dz * c; return o; };
// the elbow / stifle for a fetlock target (parent frame): the scapula (fore) and femur (hind) swing it along an arc
// about the withers / hip toward the hoof, the way the whole limb turns from there, which is what lets a leg reach so
// far. ws (0..1) instead sets the elbow where the leg below it is just straight (a planted fore leg is a locked column:
// its knee never bends under load, the shoulder takes the give)
function elbowAt(I, ly, lz, o, ws = 0) {
  const psi = I.psi0 + I.kap * clamp(_ang(ly - I.Wy, lz - I.Wz) - I.th0, -1.2, 1.2);
  o[0] = I.Wy - I.Ls * Math.cos(psi); o[1] = I.Wz - I.Ls * Math.sin(psi);
  if (ws > 0) { // where the circle about the withers meets the circle of the straight leg about the fetlock
    const dy = ly - I.Wy, dz = lz - I.Wz, D = Math.hypot(dy, dz), Lw = (I.L1 + I.L2) * .997;
    if (D < I.Ls + Lw && D > Math.abs(I.Ls - Lw)) {
      const a = (I.Ls * I.Ls - Lw * Lw + D * D) / (2 * D), q = Math.sqrt(Math.max(0, I.Ls * I.Ls - a * a)), my = I.Wy + dy * a / D, mz = I.Wz + dz * a / D;
      let y = my - dz / D * q, z = mz + dy / D * q;
      const y2 = my + dz / D * q, z2 = mz - dy / D * q;
      if ((y2 - o[0]) ** 2 + (z2 - o[1]) ** 2 < (y - o[0]) ** 2 + (z - o[1]) ** 2) { y = y2; z = z2; }
      o[0] += (y - o[0]) * ws; o[1] += (z - o[1]) * ws;
    } else if (D >= I.Ls + Lw) { o[0] += (I.Wy + dy / D * I.Ls - o[0]) * ws; o[1] += (I.Wz + dz / D * I.Ls - o[1]) * ws; } // out of reach: all in line
  }
  return o;
}
// a hoof on the ground at stance progress s: it lands at the front of the sweep and stays put while the body passes
// over it (sole at zc + S/2 - S s), the fetlock sinks mid-stance, then the heel lifts and it breaks over the toe. Where
// the limb cannot reach (the stance's two ends), the pastern and then the hoof straighten toward the elbow, as a real
// leg's do at landing and toe-off. Out: fetlock (Fy, Fz) in the root frame, pastern and hoof world angles (+ = tipped back)
function stanceAt(I, s, S, zc, amp, G, o, ws = 0) {
  const bo = smooth((s - .6) / .4) * G.bo * amp, Hy = -.0025 + .03 * bo, Hz = zc + S * (.5 - s), Lmax = I.L1 + I.L2 - .004;
  let ps = bo, ph = -(G.ph0 + G.sink * Math.sin(Math.PI * s)) * amp + bo * (G.ph0 + 1.1);
  const fet = (ph, ps) => { _rot(SOLE_H[0], SOLE_H[1], ps, _v2); _rot(SOLE_P[0], SOLE_P[1], ph, _v3); o.Fy = Hy - _v2[0] - _v3[0]; o.Fz = Hz - _v2[1] - _v3[1]; };
  const miss = () => { _loc(o.Fy, o.Fz, _v2); elbowAt(I, _v2[0], _v2[1], _E, ws); return Math.hypot(_v2[0] - _E[0], _v2[1] - _E[1]) - Lmax; };
  fet(ph, ps);
  if (miss() > 0) { // straighten the pastern toward the elbow, then the hoof
    _loc(Hy - _rot(SOLE_H[0], SOLE_H[1], ps, _v3)[0], Hz - _v3[1], _v3);
    const phS = _ang(_v3[0] - _E[0], _v3[1] - _E[1]) + _fr.th - A_SP, ph0 = ph;
    fet(phS, ps);
    if (miss() <= 0) { let lo = 0, hi = 1; for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; fet(ph0 + (phS - ph0) * m, ps); if (miss() > 0) lo = m; else hi = m; } ph = ph0 + (phS - ph0) * hi; }
    else {
      ph = phS; _loc(Hy, Hz, _v3);
      const psS = _ang(_v3[0] - _E[0], _v3[1] - _E[1]) + _fr.th - A_SH, ps0 = ps;
      let lo = 0, hi = 1; for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; fet(ph, ps0 + (psS - ps0) * m); if (miss() > 0) lo = m; else hi = m; } ps = ps0 + (psS - ps0) * hi;
    }
    fet(ph, ps);
  }
  o.ph = ph; o.ps = ps;
  return o;
}
// two-bone IK in the leg's parent frame (_fr): swings the elbow/stifle, then solves upper leg + cannon to reach the
// fetlock (the fore knee folds forward, the hock back). Returns the cannon's angle in the root frame.
function steedLegIK(J, I, Fy, Fz, ws = 0) {
  _loc(Fy, Fz, _v2); const ly = _v2[0], lz = _v2[1];
  elbowAt(I, ly, lz, _E, ws); const Ey = _E[0], Ez = _E[1];
  J.up.position.y = Ey; J.up.position.z = Ez;
  const ty = ly - Ey, tz = lz - Ez, d = Math.hypot(ty, tz), Lm = I.L1 + I.L2, ds = Lm - .012, tT = Math.atan2(-tz, -ty);
  const dd = d > ds ? ds + .012 * (1 - Math.exp(-(d - ds) / .012)) : Math.max(d, .08); // soft IK: the joint eases straight instead of snapping
  const al = Math.acos(clamp((I.L1 * I.L1 + dd * dd - I.L2 * I.L2) / (2 * I.L1 * dd), -1, 1)), tU = tT + (J.hind ? al : -al);
  const Ky = Ey - I.L1 * Math.cos(tU), Kz = Ez - I.L1 * Math.sin(tU), a = tU - I.a0, b = wrap(Math.atan2(-(lz - Kz), -(ly - Ky)) - a);
  J.up.rotation.x = a; J.knee.rotation.x = b; J._miss = d - Lm + .002;
  return _fr.th + a + b;
}
// the body's frame at stride phase c: height (before any sink) and pitch, the croup's offset and pitch. A rear pivots
// about the hind hips so the hind hooves stay planted.
const _bf = {}, _bf2 = {}, SINK_N = 32, _need = new Float32Array(SINK_N);
function bodyFrame(h, c, amp, R, gz, o) {
  const bob = bodyWave('bob', c) * amp; o.pitch = bodyWave('pitch', c) * amp; o.flex = bodyWave('flex', c) * amp;
  const th = o.th = o.pitch - R * .85 + gz * .07;
  _rot(-.16, -.55, th, _v3);
  o.y = 1.1 - _G.crouch * amp - bob - gz * .03 + (-.16 - _v3[0]); o.z = -.55 - _v3[1];
  o.cr = -o.flex * (1 - R); _rot(h.croup.position.y, h.croup.position.z, th, _v3); o.cdy = _v3[0]; o.cdz = _v3[1]; o.thC = th + o.cr;
  return o;
}
// how far the body must sink at each point of the stride for every planted hoof to be reached (a long stance sweep
// outruns the legs at its two ends), spread out smoothly ahead and behind, so the back settles into each landing and
// rises out of it instead of dropping with a jolt. Recomputed when the speed or the gait changes.
function sinkTable(h, I, amp, d, S) {
  const t = h._sink ||= new Float32Array(SINK_N); h._sinkV = h.v; h._sinkA = amp; h._sinkD = d;
  for (let j = 0; j < SINK_N; j++) {
    const c = j / SINK_N; bodyFrame(h, c, amp, 0, 0, _bf2); let w = 0;
    for (let i = 0; i < 4; i++) {
      const p = (((c - _gT[i]) % 1) + 1) % 1; if (p >= d) continue;
      const L = I[i], hind = h.joints[i].hind;
      _fr.y = _bf2.y + (hind ? _bf2.cdy : 0); _fr.z = _bf2.z + (hind ? _bf2.cdz : 0); _fr.th = hind ? _bf2.thC : _bf2.th;
      const ws = hind ? 0 : 1;
      stanceAt(L, p / d, S, L.Fz + .035 + (hind ? _G.zH : _G.zF) * amp, amp, _G, _st, ws);
      _loc(_st.Fy, _st.Fz, _v2); elbowAt(L, _v2[0], _v2[1], _E, ws);
      w = Math.max(w, Math.hypot(_v2[0] - _E[0], _v2[1] - _E[1]) - L.L1 - L.L2 + .005);
    }
    _need[j] = Math.max(0, w) * 1.4;
  }
  for (let j = 0; j < SINK_N; j++) {
    let e = 0;
    for (let k = 0; k < SINK_N; k++) { let x = Math.abs(j - k) / SINK_N; x = Math.min(x, 1 - x); if (x < .18) e = Math.max(e, _need[k] * Math.cos(x / .18 * Math.PI / 2) ** 2); }
    t[j] = e;
  }
}
const _rp = new THREE.Vector3(), _ra = new THREE.Vector3(), _rb = new THREE.Vector3();
// st: {speed 0..1 (.35 walk, .65 trot, 1 gallop), turn -1..1 (+ = turning left), rear 0..1|bool, graze bool|undefined,
//      mounted bool (reins to the rider's hands), mps (optional real ground speed m/s: the stride is fitted to it so the
//      hooves never skate)}
export function animateSteed(h, dt, st = {}) {
  steedRopesUndo(h);
  h.t += dt;
  const kS = 1 - Math.pow(.03, dt), k = 1 - Math.pow(.002, dt), I = steedIK(h);
  h.spd += (clamp(st.speed || 0, 0, 1) - h.spd) * kS;
  const vt = st.mps > 0 ? st.mps : steedV(clamp(st.speed || 0, 0, 1)) * (st.mps === 0 ? .4 : 1); // (mps 0 with a speed: turning on the spot, short steps)
  h.v = (h.v ?? vt) + (vt - (h.v ?? vt)) * (1 - Math.pow(.004, dt));
  const v = h.v, s = h.spd, moving = v > .05 || s > .03, amp = clamp(Math.max(v / .9, s / .2), 0, 1);
  // ---- gait: blend the neighbouring gaits' parameters by speed ----
  gaitWeights(v, _gw);
  let d = 0, f = 0, dom = 0;
  for (const key of GK) _G[key] = 0;
  _gT.fill(0);
  for (let g = 0; g < 4; g++) {
    const W = _gw[g]; if (!W) continue; const G = GAITS[g];
    if (W > _gw[dom]) dom = g;
    d += W * G.d(v); f += W * G.f(v);
    for (const key of GK) _G[key] += W * G[key];
    for (let i = 0; i < 4; i++) _gT[i] += W * G.T[i];
  }
  f = Math.max(f, v * d / _G.sm); // the stride lengthens with speed up to the legs' reach (sm), then quickens
  if (!(st.mps > 0) && s < .3) f *= .5 + .5 * s / .3;
  const S = moving ? clamp(v * d / f, 0, 1.4) * Math.min(1, amp * 1.5) : 0; // hoof travel while down = speed x stance time
  if (moving) h.cycle = (h.cycle + dt * f) % 1;
  h.gait = !moving ? 'idle' : GAITS[dom].name;
  // rear / graze envelopes
  h.rear += ((st.rear === true ? 1 : +st.rear || 0) - h.rear) * (1 - Math.pow(.004, dt));
  if (st.graze === undefined && !st.mounted && !moving && h.rear < .05) { h.grazeT -= dt; if (h.grazeT < -6 - (h.t % 3)) h.grazeT = 6 + Math.random() * 8; }
  else h.grazeT = Math.max(h.grazeT, 3);
  const grazeOn = st.graze === true || (st.graze === undefined && h.grazeT < 0);
  h.graze += ((grazeOn && !moving ? 1 : 0) - h.graze) * (1 - Math.pow(.15, dt));
  const R = h.rear, gz = h.graze, cyc = h.cycle;
  // ---- body: bob, pitch (the forehand rises as the hinds drive and on the leading fore's push-off), loins flex,
  // and the sink that lets the planted legs reach (sinkTable) ----
  const B = bodyFrame(h, cyc, amp, R, gz, _bf), pitch = B.pitch;
  if (moving && (!h._sink || Math.abs(v - h._sinkV) > .06 || Math.abs(amp - h._sinkA) > .04 || Math.abs(d - h._sinkD) > .004)) sinkTable(h, I, amp, d, S);
  let sink = 0;
  if (h._sink && amp > 0) { const x = cyc * SINK_N, j = Math.floor(x) % SINK_N, u = x - Math.floor(x); sink = (h._sink[j] * (1 - u) + h._sink[(j + 1) % SINK_N] * u) * (1 - R) * Math.min(1, amp / Math.max(h._sinkA, .01)); }
  const breath = Math.sin(h.t * 1.4) * .004, th = B.th;
  const tb = h.body;
  tb.rotation.x = th; tb.rotation.z = -(st.turn || 0) * .1 * s + Math.sin(cyc * Math.PI * 2) * .02 * _gw[0] * amp;
  h.croup.rotation.x = B.cr;
  h.saddle.rotation.x = -pitch * .5 + R * .72 + R * .3; // rider absorbs half the gallop rock and leans forward into a rear
  const y0 = B.y + breath - sink, z0 = B.z, cdy = B.cdy, cdz = B.cdz, thC = B.thC;
  // ---- legs: each hoof down for d of the stride, then folded and carried forward to its next footfall ----
  h.strike = 0;
  for (let i = 0; i < 4; i++) { const p = _sgp[i] = (((cyc - _gT[i]) % 1) + 1) % 1; if (moving) { if (p < h.lastP[i] - .5) h.strike++; h.lastP[i] = p; } }
  const solve = (drop) => {
    tb.position.set(0, y0 - drop, z0);
    const cy0 = tb.position.y + cdy, cz0 = tb.position.z + cdz; let worst = 0;
    h.joints.forEach((J, i) => {
      const L = I[i], G = _G, hind = J.hind, p = _sgp[i];
      const zc = L.Fz + .035 + (hind ? G.zH : G.zF) * amp, wsF = hind ? 0 : 1;
      _fr.y = hind ? cy0 : tb.position.y; _fr.z = hind ? cz0 : tb.position.z; _fr.th = hind ? thC : th;
      let ph, ps, cw, m = 0, fold = 0;
      if (p < d || !moving) {
        const o = stanceAt(L, moving ? p / d : .5, S, zc, amp, G, _st, wsF);
        cw = steedLegIK(J, L, o.Fy, o.Fz, wsF); ph = o.ph; ps = o.ps; J._stn = true;
      } else { // swing: lift and tuck the hoof, then reach forward and set it down where the next stance begins
        const u = (p - d) / (1 - d), a0 = stanceAt(L, 1, S, zc, amp, G, _st0, wsF), a1 = stanceAt(L, 0, S, zc, amp, G, _st1, wsF);
        fold = Math.pow(Math.sin(Math.PI * (1 - Math.pow(1 - u, 1.6))), 1.3) * amp; m = Math.sin(Math.PI * u); // (eased in: no snap at toe-off)
        const lift = (hind ? G.lH : G.lF) * amp;
        let Fz, Fy;
        if (!hind) {
          const E = smooth((u - .22) / .58), ov = G.ov * amp; // the knee stays folded while the forearm swings, then flicks the hoof out
          Fz = a0.Fz + (a1.Fz + ov - a0.Fz) * E - ov * smooth((u - .74) / .26) - G.back * amp * Math.sin(Math.PI * clamp(u / .45, 0, 1));
          Fy = a0.Fy + (a1.Fy - a0.Fy) * u + lift * Math.pow(Math.sin(Math.PI * (1 - Math.pow(1 - u, 1.8))), 1.2); // high early, the leg straight and reaching before it lands
        } else {
          const E = smooth((u - .04) / .84);
          Fz = a0.Fz + (a1.Fz - a0.Fz) * E - G.back * .7 * amp * Math.sin(Math.PI * clamp(u / .4, 0, 1));
          Fy = a0.Fy + (a1.Fy - a0.Fy) * u + lift * Math.sin(Math.PI * (1 - Math.pow(1 - u, 1.35)));
        }
        cw = steedLegIK(J, L, Fy, Fz, wsF * (1 - smooth(u / .4) + smooth((u - .6) / .4))); J._stn = false;
        const e = smooth(u); ph = a0.ph + (a1.ph - a0.ph) * e; ps = a0.ps + (a1.ps - a0.ps) * e;
      }
      // pastern and hoof: world angles on the ground, folded up against the cannon in the swing
      let c = (1 - m) * (ph - cw) + m * (hind ? G.fH : G.fF) * fold;
      let hf = (1 - m) * (ps - ph) + m * (hind ? G.hH : G.hF) * fold;
      let a = J.up.rotation.x, b = J.knee.rotation.x;
      // idle: rest a hind hoof now and then; grazing steps a fore leg forward
      if (!moving && i === 3) { b += -.35 * h.rest; c += .55 * h.rest; hf += .25 * h.rest; a += .08 * h.rest; }
      if (i === 0) { a -= .22 * gz; b += .05 * gz; }
      if (!hind && R > 0) { // rearing: the fore legs leave the IK and paw the air
        const paw = Math.sin(h.t * 8 + i * 2.2) * .4;
        a += (R * (-.55 + paw) - a) * R; b += (R * (1.55 - Math.abs(paw) * .5) - b) * R; c += (R * .9 - c) * R; hf *= 1 - R;
        J.up.position.y += (L.P0y - J.up.position.y) * R; J.up.position.z += (L.P0z - J.up.position.z) * R;
      }
      J.up.rotation.x = a; J.knee.rotation.x = b; J.fet.rotation.x = c; J.hoof.rotation.x = hf;
      if (J._stn && !(i === 3 && h.rest > .05)) worst = Math.max(worst, J._miss);
    });
    return worst;
  };
  // where a planted leg cannot reach its hoof (landing far forward, leaving far behind) the body sinks onto it, the
  // way a horse's back drops into each landing; the sink eases off again between footfalls
  const was = h.drop || 0; let drop = Math.max(0, was - dt * .5), miss = solve(drop);
  if (miss > .003 && R < .5) { // (a leftover the sink table missed: eased in over a few frames, not in one)
    for (let k = 0; k < 2 && miss > .003; k++) { drop += miss * 1.3; miss = solve(drop); }
    drop = was + (drop - was) * (1 - Math.pow(1e-6, dt)); solve(drop);
  }
  h.drop = drop;
  if (!moving) { h.restT = (h.restT ?? 5) - dt; if (h.restT < 0) { h.restOn = !h.restOn; h.restT = h.restOn ? 4 + Math.random() * 5 : 6 + Math.random() * 6; } }
  h.rest += ((!moving && h.restOn && gz < .2 && R < .05 ? 1 : 0) - h.rest) * (1 - Math.pow(.1, dt));
  // ---- neck & head: the neck pumps with the stride (stretching down and forward over the fore stance, up as the
  // hinds drive), the head nodding against it so the face stays steadier ----
  const fast = (_gw[2] + _gw[3]) * amp, nod = bodyWave('neck', cyc) * amp;
  h._nx ??= .6; h._hx ??= .3; h._mv ??= 0;
  h._nx += (.6 + _gw[2] * amp * .22 + _gw[3] * amp * .4 + gz * 1.65 - R * .45 - (st.mounted && !moving ? .08 : 0) - h._nx) * k;
  const nx = h._nx + nod;
  h._nv = dt > 0 ? (nx - h.neck.rotation.x) / dt : 0;
  h.neck.rotation.x = nx;
  h.neck.rotation.y += ((st.turn || 0) * .3 - h.neck.rotation.y) * k;
  const chew = gz > .8 ? Math.sin(h.t * 7) * .04 : 0;
  h._hx += (.3 - _gw[2] * amp * .12 - _gw[3] * amp * .22 + gz * .55 + R * .4 + chew - h._hx) * k;
  h.head.rotation.x = h._hx - nod * .55;
  h.head.rotation.y += ((st.turn || 0) * .2 + (!moving && gz < .1 ? Math.sin(h.t * .37) * .12 : 0) - h.head.rotation.y) * k;
  // ---- tail: hangs, swishes at flies, lifts and streams at speed, a wave running down it with each bound ----
  h.swishT -= dt; if (h.swishT < 0) { h.swish = 1; h.swishT = 2.5 + Math.random() * 4; }
  h.swish = Math.max(0, h.swish - dt * .8);
  const sw = Math.sin(Math.min(1, h.swish) * Math.PI), flow = _G.tail * amp, P2 = Math.PI * 2;
  h.tail.forEach((sg, i) => {
    const wave = Math.sin(P2 * cyc - i * .95 - .6) * (i ? .16 : .1) * flow;
    const x = (i === 0 ? .42 + flow * .8 - R * .3 + B.flex * 1.5 : .1 - flow * .07) + wave;
    sg.rotation.x += (x - sg.rotation.x) * (1 - Math.pow(1e-5, dt));
    sg.rotation.z = Math.sin(h.t * 8 - i * .9) * .35 * sw + Math.sin(P2 * cyc - i * .7) * .06 * amp * (1 - flow) + Math.sin(h.t * 13 - i * 1.3) * .03 * flow;
  });
  // ---- mane: streams back with speed and flips against the neck's pumping; ear flicks ----
  const mv = clamp(-(h._nv || 0) * .12, -.35, .35);
  h._mv += (mv - h._mv) * (1 - Math.pow(.001, dt));
  if (!h.locks) h.mane.forEach((mp, i) => { // (a horse built before round 33's locks: its cards swing as before)
    mp.rotation.z = -.55 + Math.sin(h.t * (6 + 8 * s) + i * .9) * (.04 + .12 * s) + h._mv * .5 * (i / 6);
    mp.rotation.x = -.35 * s * amp + h._mv * (.4 + i * .1) + Math.sin(P2 * cyc - i * .6) * .12 * fast;
  });
  h.ears.forEach((ep, i) => {
    h.earT[i] -= dt; if (h.earT[i] < -.3) h.earT[i] = 1.5 + Math.random() * 4;
    const fl = h.earT[i] < 0 ? Math.sin((h.earT[i] / -.3) * Math.PI) : 0;
    ep.rotation.x = -.15 - .5 * fast - .5 * R - .9 * fl; ep.rotation.y = (i ? -1 : 1) * .5 * fl;
  });
  // ---- reins: from the bit rings to the rider's hands (or draped on the withers) ----
  h.neck.updateMatrix(); h.head.updateMatrix(); _m5.multiplyMatrices(h.neck.matrix, h.head.matrix);
  h.reins.forEach((m, i) => {
    const sx = i ? 1 : -1;
    const a = _rp.copy(h.bits[i].position).applyMatrix4(_m5);
    const b = st.mounted ? _ra.set(sx * .1, .73, .36) : _ra.set(sx * .13, .37, .42);
    const d = _rb.subVectors(b, a); const len = d.length();
    m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(_sz, d.normalize()); m.scale.set(.022, .018, len);
  });
  steedRopes(h, dt, st);
}
// round 33 stage 10 (SHIP): the tail and the mane's locks on rope physics (rope.js), a layer over the pose. The tail's rope
// rests on the posed tail (its swish, its lift at speed) and adds the weight, the lag and the wind: it swings after each
// stride and turn and streams out behind a gallop; it bounces off the quarters and never goes under the ground. Each lock
// of the mane rests on the side of the neck and bounces off it. A rope that has come to rest sleeps; a hidden horse skips
const _srV = new THREE.Vector3(), _srW = new THREE.Vector3(), _srC = new THREE.Vector3();
const neckSec = (y) => { const r = .21 - (.08 * (y + .06)) / .8; return [r * .7, r]; };
function steedRopesUndo(h) {
  const S = h._sr; if (!S?.applied) return;
  h.tail.forEach((J, i) => { const a = S.applied[i], p = S.posed[i]; if (J.rotation.x === a[0]) J.rotation.x = p[0]; if (J.rotation.z === a[1]) J.rotation.z = p[1]; });
  S.applied = null;
}
function steedRopes(h, dt, st) {
  if (!h.root.visible || (dt > 0 && !h.root.parent)) return;
  h.root.updateMatrixWorld(true);
  const S = h._sr ||= (() => {
    const o = { rs: 1, restT: h.tail.map(() => new THREE.Vector3()).concat([new THREE.Vector3()]), floor: -1e9, sleepT: 0, la: new THREE.Vector3(1e9, 0, 0) };
    o.T = makeRope({ n: h.tail.length + 1, link: .15, k: 150, damp: 7, bounce: .05, fold: 1.4, still: .04, sub: .011,
      drag: (v) => .05 + .12 * Math.min(1, Math.max(0, (v - 9) / 6)), reach: (i) => .1 + i * .11, scale: () => o.rs, radius: () => .05,
      anchor: (out) => h.tail[0].getWorldPosition(out), rest: (i, out) => out.copy(o.restT[i]),
      collide: (p, q, rr) => { const hit = hitSphere(p, h.croup.localToWorld(_srC.set(0, -.05, -.18)), .34 * o.rs + rr); if (p.y < o.floor) { p.y = o.floor; q.y = Math.max(q.y, o.floor); } return hit; } });
    o.M = (h.locks || []).map((Lk) => ({ Lk, sleepT: 0, la: new THREE.Vector3(1e9, 0, 0), R: makeRope({ n: 3, link: Lk.pts[1].distanceTo(Lk.pts[0]), k: 240, damp: 11, bounce: .08, fold: 1.3, still: .03, sub: .011,
      reach: (i) => .05 + i * .07, scale: () => o.rs, radius: () => .03, initRest: true,
      anchor: (out) => Lk.piv[0].getWorldPosition(out), rest: (i, out) => h.neck.localToWorld(out.copy(Lk.pts[i])),
      collide: (p, q, rr) => hitSection(p, h.neck, -.06, .8, neckSec, rr / o.rs) }) }));
    return o;
  })();
  S.rs = h.root.getWorldScale(_srV).y || 1; S.floor = h.root.getWorldPosition(_srW).y + .04;
  const rolling = st.dead === true;
  // the tail: its rest line is the posed tail
  S.posed = h.tail.map((J) => [J.rotation.x, J.rotation.z]);
  h.tail.forEach((J, i) => J.getWorldPosition(S.restT[i])); h.tail[h.tail.length - 1].localToWorld(S.restT[h.tail.length].set(0, -.17, 0));
  const a = h.tail[0].getWorldPosition(_srV), moved = a.distanceToSquared(S.la) > 1e-4 || S.restT[h.tail.length].distanceToSquared(S.lr || S.la) > 1e-4;
  if (moved || S.sleepT < 20 || dt <= 0 || rolling) {
    S.la.copy(a); (S.lr ||= new THREE.Vector3()).copy(S.restT[h.tail.length]);
    stepRope(S.T, dt, st); bendChain(h.tail, S.T, { lo: -1.4, hi: 1.6, side: 1 });
    S.sleepT = S.T.still ? S.sleepT + 1 : 0;
  }
  S.applied = h.tail.map((J) => [J.rotation.x, J.rotation.z]);
  // the mane's locks
  for (const M of S.M) {
    if (!M.Lk.piv[0].visible) continue; // (a dressed horse's own mane in its place)
    const a2 = M.R.anchor(_srV);
    if (dt > 0 && M.sleepT > 20 && a2.distanceToSquared(M.la) < 1e-5) continue;
    M.la.copy(a2); stepRope(M.R, dt, st); bendChain(M.Lk.piv, M.R, { lo: -2.4, hi: 2.4, side: 1.6 });
    M.sleepT = M.R.still ? M.sleepT + 1 : 0;
  }
}

// ======================================================================================
// Story poses (cutscenes in story.js). Kept apart from animateRig/animateExt on purpose: each one sets the joints
// outright, so call it after the rig's own animation for the frame (from rig.tick), or on a clone nothing else animates.
// ======================================================================================
const _sp = new THREE.Vector3(), _sd = new THREE.Vector3(), _sq = new THREE.Vector3();
// slide a held weapon along its own axis so its tip (or butt) just touches the floor; h = hand height above the feet,
// dirY = the weapon axis' vertical component. Only for rigs posed for a scene (it moves the weapon in the hand).
function plantWeapon(w, end, dirY, h) {
  if (!w || Math.abs(dirY) < .3) return;
  const ud = w.userData, e = end === 'tip' ? (ud.tip ?? 1.03) : (ud.butt ?? -.3);
  w.position.z = clamp((.03 - h) / dirY - e, -1.1, .35);
}
// standing tall in Charon's boat: feet set, chest out, chin up; the spear stands upright with its butt on the boards
// (a blade rests point-down under her hand, a two-hander under both), the shield hangs easy on the other arm.
export function poseProud(r, t, style = r.style || 'blade') {
  const T = r.torso, breath = Math.sin(t * 1.3);
  r.body.position.set(0, 0, 0); r.body.rotation.set(0, 0, 0); r.body.scale.setScalar(1);
  r.hip.rotation.set(0, 0, 0); r.hip.position.z = 0;
  const drop = .02 + breath * .006, hy = .9 - drop;
  stance(r, drop, .17, .1, 1, .1);
  T.rotation.set(-.07 + breath * .012, .12, 0);
  r.head.rotation.set(-.17 + Math.sin(t * .5) * .03, Math.sin(t * .35) * .32, 0);
  const wR = r.weaponR || r.sword, armed = !r.unarmed && wR && wR.visible !== false;
  const pole = style === 'spear' || style === 'polearm', two = style === 'twohand', dual = style === 'dual';
  if (!armed) { // fists on the hips
    armIK(r, 'R', _sp.set(.25, .05, .03), 1, _sq.set(1, .1, -.9)); armIK(r, 'L', _sp.set(-.25, .05, .03), 1, _sq.set(-1, .1, -.9));
    r.handR.rotation.set(0, 0, 0); r.handL.rotation.set(0, 0, 0);
  } else if (pole) {
    armIK(r, 'R', _sp.set(.35, .22, .1), 1); aimHand(r, 'R', _sd.set(.05, 1, .05).normalize(), 1);
    plantWeapon(wR, 'butt', _sd.y, hy + .22);
  } else if (two) {
    armIK(r, 'R', _sp.set(.04, .06, .3), 1); aimHand(r, 'R', _sd.set(0, -1, .1).normalize(), 1);
    handToTorso(r, 'R', _sq.set(0, 0, -.13), _sp); armIK(r, 'L', _sp, 1); aimHand(r, 'L', _sd, 1);
    plantWeapon(wR, 'tip', _sd.y, hy + .06);
  } else if (dual) {
    armIK(r, 'R', _sp.set(.31, 0, .1), 1); aimHand(r, 'R', _sd.set(.12, -1, .2).normalize(), 1); plantWeapon(wR, 'tip', _sd.y, hy);
    armIK(r, 'L', _sp.set(-.31, 0, .1), 1); aimHand(r, 'L', _sd.set(-.12, -1, .2).normalize(), 1); plantWeapon(r.weaponL, 'tip', _sd.y, hy);
  } else { // one blade: the hand rests on the pommel, point planted beside her front foot
    armIK(r, 'R', _sp.set(.25, .04, .27), 1); aimHand(r, 'R', _sd.set(.06, -1, .1).normalize(), 1);
    plantWeapon(wR, 'tip', _sd.y, hy + .04);
  }
  if (armed && !two && !dual) { armIK(r, 'L', _sp.set(-.34, .14, .13), 1, _sq.set(-1, -.4, -.5)); r.handL.rotation.set(0, 0, 0); }
  // the braids stir in the river wind
  if (r.braids) r.braids.forEach((b, i) => {
    const p0 = b.userData.p0 || (b.userData.p0 = b.position.clone()), u = (i % 17) / 17;
    b.position.set(p0.x + Math.sin(t * 2.3 + i * .45) * .012 * u, p0.y, p0.z - (.01 + Math.sin(t * 1.7 + i * .2) * .008) * u);
  });
}
// reach a hand ('L'|'R') to a world point: a hand on a shoulder, a pat on a head. crouch lowers the hips and leans in,
// stroke runs the hand back and forth. k blends the whole pose in and out (0 = leave the rig as animated).
export function poseReach(r, side, tgt, k = 1, o = {}) {
  if (!(k > .001)) return;
  const T = r.torso, t = o.t || 0, c = (o.crouch || 0) * k;
  if (c > 0) { stance(r, c, .12 + c * .6, .12, 1, .08); T.rotation.x += (c * 1.1 - T.rotation.x) * k; }
  r.root.updateMatrixWorld(true);
  const p = T.worldToLocal(_sp.copy(tgt));
  if (o.stroke) { const s = Math.sin(t * 5.5); p.z += s * o.stroke; p.y += Math.abs(s) * o.stroke * .3; }
  armIK(r, side, p, k);
  if (o.look) r.head.rotation.x += (.25 - r.head.rotation.x) * k;
}
// a big wave over the head with one hand
export function poseWave(r, side, t, k = 1) {
  if (!(k > .001)) return;
  const sx = side === 'L' ? -1 : 1;
  armIK(r, side, _sp.set(sx * (.36 + Math.sin(t * 8) * .13), .98, .08), k, _sq.set(sx, -.3, -.6));
}
