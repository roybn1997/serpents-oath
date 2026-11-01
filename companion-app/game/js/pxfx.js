// Round 33, graphics stage 9 (Roy: "every skill, attack, hit and explosion in the new palette and pixel style"): the one
// look every effect shares, in the new V's language. Effects were smooth additive glows (soft gradients, alpha fading
// evenly to nothing), which read as a blur next to her hand-shaded pixels. Every effect material now goes through pxify():
//  - colour in five stepped tones of its own hue: a cool violet shade (FX_SHADE) at the rim, its own colour, a warm light
//    (FX_LIGHT) where it faces the eye; on a ring or a disc the steps run across it (a ring's leading edge the brightest)
//  - transparency in four hard steps with an ordered (Bayer 4 x 4) dither on the game's pixel grid, so a fade is a
//    pixel-art dissolve, never a smooth wash
// One small shader patch shared by every effect (one program per kind of material), so it costs nothing on a phone.
import * as THREE from './three.module.min.js';
import { GFX } from './render.js';

export const FX_SHADE = '#35265e', FX_LIGHT = '#fff0c4', FX_INK = '#160f24'; // violet shade, warm light, the outline ink
const SHADE = { value: new THREE.Color(FX_SHADE) }, LIGHT = { value: new THREE.Color(FX_LIGHT) };
// modes: how the tone steps are laid out over a surface
export const PX = { solid: 0, ring: 1, disc: 2, band: 3, flat: 4 };

const VERT_PARS = 'varying vec3 vPxN;\nvarying vec3 vPxV;\nvarying vec2 vPxUv;\n';
const FRAG_PARS = `uniform vec3 pxShade;
uniform vec3 pxLight;
uniform float pxMode;
uniform float pxInner;
uniform float pxLift;
varying vec3 vPxN;
varying vec3 vPxV;
varying vec2 vPxUv;
float pxB2(vec2 p) { return mod(2.0 * p.x + 3.0 * p.y, 4.0); } // the 2 x 2 ordered matrix [0 2; 3 1]
float pxBayer(vec2 f) { vec2 p = mod(floor(f), 4.0); return (4.0 * pxB2(mod(p, 2.0)) + pxB2(floor(p / 2.0)) + 0.5) / 16.0; } // 4 x 4, on the game's pixels
`;
const FRAG_MAIN = `
  {
    float pxT;
    if (pxMode < 0.5) { pxT = abs(dot(normalize(vPxN), normalize(vPxV))) * 1.2 - 0.12; }
    else if (pxMode < 1.5) { float q = (length(vPxUv * 2.0 - 1.0) - pxInner) / max(0.001, 1.0 - pxInner); pxT = q > 0.84 ? 0.0 : 0.25 + q * 0.85; } // a ring: shade inside, light toward its leading edge, an ink rim
    else if (pxMode < 2.5) { float r = length(vPxUv * 2.0 - 1.0); pxT = r > 0.93 ? 0.0 : 1.0 - r * 0.8; } // a disc: light at the heart, an ink rim
    else if (pxMode < 3.5) { pxT = vPxUv.y * 0.8 + vPxUv.x * 0.45 - 0.2; diffuseColor.a *= clamp(vPxUv.x * 1.8, 0.0, 1.0); }
    else { pxT = 0.62; }
    pxT = clamp(pxT + pxLift, 0.0, 0.999);
    float pxB = floor(pxT * 5.0);
    // the tones are worked out near display space (square roots) so a dark colour's light stays dark and a pale one's shade
    // stays pale: shades darken and lean violet, lights brighten and warm a little
    vec3 pxG = sqrt(max(diffuseColor.rgb, vec3(0.0))), pxVg = sqrt(pxShade), pxWg = sqrt(pxLight);
    pxG = pxB < 0.5 ? mix(pxG * 0.45, pxVg, 0.45) : pxB < 1.5 ? mix(pxG * 0.76, pxVg, 0.16) : pxB < 2.5 ? pxG : pxB < 3.5 ? pxG * 1.12 + pxWg * 0.06 : pxG * 1.26 + pxWg * 0.12;
    pxG = min(pxG, vec3(1.0));
    diffuseColor.rgb = pxG * pxG;
    diffuseColor.a = floor(clamp(diffuseColor.a, 0.0, 1.0) * 4.0 + pxBayer(gl_FragCoord.xy)) / 4.0;
    if (diffuseColor.a <= 0.0) discard;
  }
`;
function patch(sh, u) {
  sh.uniforms.pxShade = SHADE; sh.uniforms.pxLight = LIGHT; sh.uniforms.pxMode = u.mode; sh.uniforms.pxInner = u.inner; sh.uniforms.pxLift = u.lift;
  sh.vertexShader = VERT_PARS + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vPxN = normalize(normalMatrix * normal); vPxV = -mvPosition.xyz; vPxUv = uv;');
  sh.fragmentShader = FRAG_PARS + sh.fragmentShader.replace('#include <alphahash_fragment>', '#include <alphahash_fragment>' + FRAG_MAIN);
}
const cacheKey = () => 'pxfx1';
// give a basic material the stepped look (mode: PX.*; inner: a ring's inner radius over its outer; lift: shift the tones
// toward the light (+) or the shade (-)). Its colour, opacity and blending stay its own and can change every frame.
export function pxify(m, mode = PX.solid, inner = 0, lift = 0) {
  if (!m || m.userData.pxU) return m;
  const u = m.userData.pxU = { mode: { value: mode }, inner: { value: inner }, lift: { value: lift } };
  m.onBeforeCompile = (sh) => patch(sh, u); m.customProgramCacheKey = cacheKey; // (u held here: a caller may replace userData)
  return m;
}
// set the steps' layout from the geometry the material is first worn on (a ring or a disc steps across, the rest by facing)
export function pxTag(o) {
  const m = o?.material, u = m?.userData?.pxU, G = o.geometry; if (!u || u.tagged) return o;
  const P = G?.parameters || {};
  if (G?.type === 'RingGeometry') { u.mode.value = PX.ring; u.inner.value = P.innerRadius / P.outerRadius; }
  else if (G?.type === 'CircleGeometry') { if ((P.thetaLength ?? 7) < 6.28) { u.mode.value = PX.ring; u.inner.value = 0; } else u.mode.value = PX.disc; } // a fan (a gaze, a breath) brightens toward its reach
  else if (G?.type === 'PlaneGeometry') u.mode.value = PX.flat;
  u.tagged = true; return o;
}
// the effect material every skill uses: a basic material, stepped (additive where it glows)
// Laid over the ground, never added to it (round 33: an added glow washed toward white on sand, snow and in a crowd of
// effects, and its violet shade steps vanished; laid over, each effect keeps its own palette and its dark rim reads against
// any ground from the high camera). ?fxblend=add brings back the old adding for a comparison
const BLEND = (/[?&]fxblend=(add|normal)\b/.exec(location.search) || [])[1] || 'normal';
export function pxGlow(color, opacity = 1, additive = true) {
  const add = BLEND === 'add' && additive;
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.userData.own = true; m.userData.base = opacity; return pxify(m);
}
// how many of `n` particles a tier can afford (low: phones)
export const fxCount = (n) => (GFX.tier === 'low' ? Math.max(1, Math.round(n * .5)) : GFX.tier === 'medium' ? Math.max(1, Math.round(n * .8)) : n);
export const fxLow = () => GFX.tier === 'low';

// a colour's tones, darkest first, in the effects' own ramp (the shader's five steps, for things painted on the CPU)
const _a = new THREE.Color(), _s = new THREE.Color(FX_SHADE), _l = new THREE.Color(FX_LIGHT);
const rampCache = new Map();
export function fxRamp(hex) {
  let r = rampCache.get(hex); if (r) return r;
  _a.set(hex);
  const g = (c) => [Math.sqrt(c.r), Math.sqrt(c.g), Math.sqrt(c.b)], A = g(_a), V = g(_s), Wm = g(_l);
  const mk = (f) => { const o = A.map((x, i) => Math.min(1, f(x, i))); return new THREE.Color(o[0] * o[0], o[1] * o[1], o[2] * o[2]); };
  r = [mk((x, i) => x * .45 * .55 + V[i] * .45), mk((x, i) => x * .76 * .84 + V[i] * .16), _a.clone(), mk((x, i) => x * 1.12 + Wm[i] * .06), mk((x, i) => x * 1.26 + Wm[i] * .12)]; // (the shader's five steps)
  rampCache.set(hex, r); return r;
}

// pixel sprites painted texel by texel: a hit spark (a four-point burst with short diagonal rays, a white-hot core, gold,
// ember, and a violet ink rim) and a mote (a small diamond). NearestFilter, no mips: hard pixels like the rest of the kit
function pixSprite(W, rows, pal) {
  const c = document.createElement('canvas'); c.width = W; c.height = rows.length; const x = c.getContext('2d');
  rows.forEach((row, y) => { for (let i = 0; i < row.length; i++) { const k = row[i]; if (k !== '.' && pal[k]) { x.fillStyle = pal[k]; x.fillRect(i, y, 1, 1); } } });
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const SPARK_PAL = { o: FX_INK, v: '#5a3a8a', e: '#e0601e', g: '#ffb83a', y: '#ffe680', w: '#ffffff' };
export function sparkTexture() {
  return pixSprite(16, [
    '.......o........',
    '......ovo.......',
    '.o....oeo....o..',
    '.ovo..ogo...ovo.',
    '..oeo.ogo..oeo..',
    '...ogoyyyoogo...',
    '....oyywyyyo....',
    'ovegggywwyyggevo',
    '.oo.oyywwyyo.oo.',
    '....ogyyyyygo...',
    '...oeo.ygo.oeo..',
    '..ovo..ogo..ovo.',
    '..o....oeo....o.',
    '.......ovo......',
    '........o.......',
    '................'], SPARK_PAL);
}
export function moteTexture() {
  return pixSprite(8, [
    '...o....',
    '..oyo...',
    '.oywyo..',
    'oywwwyo.',
    '.oywyo..',
    '..oyo...',
    '...o....',
    '........'], { o: '#7a6a9a', y: '#ffe9a0', w: '#ffffff' });
}
