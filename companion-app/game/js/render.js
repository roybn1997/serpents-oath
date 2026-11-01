import * as THREE from './three.module.min.js';

THREE.ColorManagement.enabled = false;

// Look presets (round 16 preview, ?look=a|b): the same art, brighter and happier colours and a finer pixel grid.
// rows = game pixels on the short side of the screen, minPx = the smallest css px per game px.
const LOOKS = {
  base: { classic: true, rows: 420, minPx: 1.5, exp: 1, lift: 0, sat: 1.12, vib: 0, con: 0, vig: .9, levels: 24, outlinePx: .9, sun: 1, hemi: 1, skySat: 1 },
  a: { rows: 620, minPx: 1.2, exp: 1.08, lift: .02, sat: 1.28, vib: .35, con: 0, vig: .45, levels: 30, outlinePx: 1.1, sun: 1.06, hemi: 1.14, skySat: 1.25 },
  b: { rows: 860, minPx: 1, exp: 1.12, lift: .02, sat: 1.36, vib: .45, con: .16, vig: .3, levels: 40, outlinePx: 1.35, sun: 1.1, hemi: 1.2, skySat: 1.45 },
};
// c = b's colours at the screen's own resolution (one game px per device px, devicePixelRatio aware), smoother models
LOOKS.c = { ...LOOKS.b, rows: 0, minPx: 0, native: true, levels: 48, outlinePx: 1.6, detail: 2, shadow: 4096, pcf: true };
// d and e = c's sharpness with the 8-bit language back: faceted models, hard stepped shadows, banded colour with a visible
// ordered dither and 2px lines. olw = how many screen px the post outline reaches, dcell = the dither cell in screen px.
LOOKS.d = { ...LOOKS.c, detail: 1, pcf: false, levels: 34, dither: .55, dcell: 1, outlinePx: 2.1, olw: 2 };
LOOKS.e = { ...LOOKS.c, detail: 1, pcf: false, shadow: 2048, levels: 24, dither: .85, dcell: 2, outlinePx: 2.8, olw: 2 };
// f = pixel art: an exact 2x pixel grid (2 css px per game px, no uneven pixels), flat colour bands with no dither, and
// painterly shading: cool purple shade, warm light and a bright lit edge, like hand-shaded sprites (see pixelShading below).
// the world keeps b's colour grade and light (the owner's pick for the towns and the land); the pixel shading is for characters only.
LOOKS.f = { ...LOOKS.b, rows: 0, minPx: 0, px: 2, dither: 0, outlinePx: 1, pixelShade: true,
  shade: [.86, .86, 1.06], light: [1.04, 1, .94], rim: .55, amb: [.93, .93, 1.05],
  // Roy 27.10 ("better graphics"), the crisp sun: more sun, less sky fill light, a touch more punch and a brighter lit edge
  // on the world, so shapes and shadows read more clearly (was sun 1.1, hemi 1.2, con .16, worldRim .22)
  sun: 1.34, hemi: .96, con: .2, worldRim: .3 };
// round 33: Roy's new V is the default (refineV / vBraids in models.js); NEWV stays exported, always true, for old imports
export const NEWV = true;
export const LOOK = { ...(LOOKS[(/[?&]look=(base|[a-f])\b/.exec(location.search) || [])[1] || window.SO_LOOK] || LOOKS.f) }; // f, the pixel-art look, since round 16
// tuning aid: ?lk=sat:1.4,amb:.7/.74/1 overrides look values (numbers, or triples joined by /)
for (const kv of ((/[?&]lk=([^&]+)/.exec(location.search) || [])[1] || '').split(',')) { const [k, v] = kv.split(':'); if (k && v) LOOK[k] = v.includes('/') ? v.split('/').map(Number) : Number(v); }
const v3 = (a) => `vec3( ${a.map((x) => x.toFixed(3)).join(', ')} )`;

// ---------------- graphics quality (round 33, Roy: "the game must keep running well on a phone") ----------------
// One setting, in the pause menu, kept in this browser: auto (default) | high | medium | low. Nothing it saves on shows as
// coarser pixels during play: the pixel grid is chosen from the screen (2 device px per game px, a step coarser only when
// the screen holds more game pixels than the tier's budget), and the rest is spent where the eye doesn't look: how far
// the dense grass and flowers reach round her and how thick they grow, how far the land is drawn, the shadow map's size
// and whether small things (grass, bushes, small rocks) cast shadows at all.
// In auto, a governor (createRenderer) watches the frame time and slides GFX.load (1 = full, down to .5) to thin the far
// grass and pull the land in a little while frames are slow, and gives it back when they are quick again; never pixels.
const TIERS = {
  high: { cap: 2.4e6, shadow: 2048, grassR: 30, grassD: 1, drawR: 1, castSmall: true },
  medium: { cap: .7e6, shadow: 2048, grassR: 22, grassD: .72, drawR: .9, castSmall: true },
  // (Roy 27.10, a friend's game looked blurrier: low's budget was .26e6, which put a 1080p computer on 3 device px per game
  // px, coarser than everyone else's 2. Now 1080p stays at 2 on every tier; low saves on grass, shadows and distance only)
  low: { cap: .55e6, shadow: 1024, grassR: 15, grassD: .45, drawR: .76, castSmall: false },
};
export const GFX_LEVELS = ['auto', 'high', 'medium', 'low'];
const GFX_KEY = 'so_gfx';
const urlGfx = (/[?&]gfx=(auto|high|medium|low)\b/.exec(location.search) || [])[1]; // dev / tests: forced, not kept
function readGfx() { if (urlGfx) return urlGfx; try { const v = localStorage.getItem(GFX_KEY); if (GFX_LEVELS.includes(v)) return v; } catch (e) { /* storage off */ } return 'auto'; }
// what the device most likely manages, for auto: phones and tablets start at medium (low on weak GPUs), computers at high
let autoT = null;
function autoTier() {
  if (autoT) return autoT;
  let gpu = '';
  try { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) { /* no gl info */ }
  const touch = window.matchMedia?.('(pointer: coarse)').matches, mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 4;
  const weak = /Mali-(4|T[67])|Adreno \(TM\) ?[345]\d\d|PowerVR SGX|Intel\(R\) HD Graphics( [2-4]\d{3})?$|GMA|llvmpipe|SwiftShader/i.test(gpu) || mem <= 2;
  return (autoT = weak ? 'low' : touch ? (mem >= 6 && cores >= 8 && /Adreno \(TM\) ?[67]\d\d/i.test(gpu) ? 'high' : 'medium') : 'high');
}
const gfxSubs = new Set();
export const GFX = { setting: readGfx(), tier: 'high', load: 1, ...TIERS.high };
function resolveGfx() {
  GFX.tier = GFX.setting === 'auto' ? autoTier() : GFX.setting;
  Object.assign(GFX, TIERS[GFX.tier]);
  if (GFX.setting !== 'auto') GFX.load = 1;
}
resolveGfx();
// change the setting (the pause menu): kept in this browser, applied at once (pixels, shadows, grass, draw distance)
export function setGfx(level) {
  if (!GFX_LEVELS.includes(level)) return;
  GFX.setting = level; GFX.load = 1;
  try { localStorage.setItem(GFX_KEY, level); } catch (e) { /* storage off: this session only */ }
  resolveGfx();
  for (const f of gfxSubs) f(GFX);
}
export function onGfx(f) { gfxSubs.add(f); return () => gfxSubs.delete(f); }

// pixel shading. Round 16 gave it to the characters only; round 33 (Roy: "uniform lighting and outlines for the whole
// world", in the new V's language: cool violet shade, warm light) gives the same split to every toon surface. Characters
// (the PXSHADE define, through pxRig/pxTwin) keep the full sunlit edge; the world takes the same tints with a softer edge.
if (LOOK.pixelShade) {
  const C = THREE.ShaderChunk, plain = 'vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;',
    amb = 'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
  const shade = (rim) => `float g = getGradientIrradiance( geometryNormal, directLight.direction ).r;
	vec3 irradiance = g * directLight.color * mix( ${v3(LOOK.shade)}, ${v3(LOOK.light)}, smoothstep( .5, .95, g ) );
	float rim = 1. - saturate( dot( geometryNormal, geometryViewDir ) ), lit = saturate( dot( geometryNormal, directLight.direction ) );
	irradiance += directLight.color * vec3( 1.0, .95, .82 ) * step( .5, rim * lit ) * ${rim.toFixed(3)};`;
  C.lights_toon_pars_fragment = C.lights_toon_pars_fragment
    .replace(plain, `#ifdef PXSHADE
	${shade(LOOK.rim)}
#else
	${shade(LOOK.worldRim ?? .22)}
#endif`)
    .replace(amb, `reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor ) * ${v3(LOOK.amb)};`);
}
// a toon material's pixel-shaded twin: it inherits everything from the original through the prototype (colour, maps,
// opacity, later changes to them), so code that tweaks the original still drives the twin; only the define is its own
const pxTwins = new WeakMap();
let pxIds = 1e6;
export function pxTwin(m) {
  if (!LOOK.pixelShade || !m || m.pxv || !m.isMeshToonMaterial) return m;
  let t = pxTwins.get(m);
  if (!t) {
    t = Object.create(m);
    Object.defineProperties(t, { id: { value: pxIds++ }, uuid: { value: THREE.MathUtils.generateUUID() }, pxv: { value: true } });
    t.defines = Object.assign({}, m.defines, { PXSHADE: '' }); t._listeners = {};
    pxTwins.set(m, t);
  }
  return t;
}
// gives every toon material under a character's root its twin; cheap enough to run every frame, so materials swapped in
// later (gear, faces, hit flashes put back) are caught on the next frame
export function pxRig(root) {
  if (!LOOK.pixelShade || !root) return;
  root.traverse((o) => {
    if (!o.isMesh || o.userData.outline && !o.userData.hd) return;
    const m = o.material;
    if (Array.isArray(m)) { if (m.some((x) => x && !x.pxv && x.isMeshToonMaterial)) o.material = m.map(pxTwin); }
    else if (m && !m.pxv && m.isMeshToonMaterial) o.material = pxTwin(m);
  });
}

// Post pass: depth-based silhouette outlines, colour banding with ordered dither, vignette, fades.
const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const POST_FS = `
precision highp float;
uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 res; uniform float levels; uniform float fade; uniform float flash;
uniform vec3 flashColor; uniform float vig; uniform float sat; uniform float cNear; uniform float cFar; uniform float outline; uniform float alphaBg; uniform float dither;
uniform float split; uniform float fogN; uniform float fogF; uniform float hurt; uniform float expo; uniform float lift; uniform float vib; uniform float con; uniform float olw; uniform float dcell;
varying vec2 vUv;
const float B[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
float lin(float d){ float z = d * 2. - 1.; return (2. * cNear * cFar) / (cFar + cNear - z * (cFar - cNear)); }
void main(){
  vec2 px = olw / res;
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float d0 = lin(texture2D(tDepth, vUv).r);
  float dl = lin(texture2D(tDepth, vUv - vec2(px.x, 0.)).r);
  float dr = lin(texture2D(tDepth, vUv + vec2(px.x, 0.)).r);
  float du = lin(texture2D(tDepth, vUv + vec2(0., px.y)).r);
  float dd = lin(texture2D(tDepth, vUv - vec2(0., px.y)).r);
  // round 33 (Roy: one outline language for the whole world): a lower, depth-relative threshold, so houses, trees,
  // rocks and props get the dark line the characters' hulls give them (grass stays clean); the line itself is the
  // characters' violet-black, mixed with a little of the colour under it
  float thr = .022 * d0 + ${(LOOK.olThr ?? .3).toFixed(3)};
  float edge = step(thr, max(max(dl, dr), max(du, dd)) - d0);
  edge *= 1. - smoothstep(fogN, fogF, d0); // lines fade into the haze with everything else
  c = mix(c, c * .3 + vec3(.03, .02, .06), edge * outline);
  c = pow(c, vec3(.9));
  c *= expo; c += lift * (1. - c); // brighter look: exposure and lifted shadows
  if (expo > 1.001) c = mix(c, .82 + .18 * (1. - exp(-(c - .82) / .18)), step(.82, c)); // soft shoulder, whites don't clip
  c = mix(c, c * c * (3. - 2. * c), con); // a little punch
  float l = dot(c, vec3(.299,.587,.114));
  float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, sat + vib * (1. - smoothstep(.0, .5, chroma))); // vibrance: dull colours gain the most
  // gentle split toning: cool shadows, warm light, for a painted sense of depth
  c *= mix(vec3(1.) - vec3(.06, .03, -.05) * split, vec3(1.) + vec3(.03, .01, -.04) * split, smoothstep(.15, .75, l));
  vec2 p = floor(vUv * res / dcell);
  int i = int(mod(p.x, 4.)) + int(mod(p.y, 4.)) * 4;
  float dth = (B[i] / 16. - .5) / levels * dither;
  c = floor((c + dth) * levels + .5) / levels;
  vec2 q = vUv - .5; c *= 1. - dot(q, q) * vig;
  c = mix(c, vec3(.6, .03, .05), hurt * smoothstep(.07, .3, dot(q, q))); // Val is hit: the screen's rim pulses blood red
  c = mix(c, flashColor, flash);
  c *= (1. - fade);
  float a = alphaBg > .5 && texture2D(tDepth, vUv).r > .99999 ? 0. : 1.;
  gl_FragColor = vec4(c, a);
}`;

// before and after each frame a renderer draws (rigbatch.js swaps the characters' merged parts in and out)
export const renderHooks = { pre: [], post: [] };
export function createRenderer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: !!opts.alpha, premultipliedAlpha: false });
  renderer.setPixelRatio(1);
  // (Roy 27.10, stutters: three asks the driver for every new shader's compile log, which makes the browser wait for the
  // compile right there; the game's shaders are known good, so only ?glcheck asks)
  renderer.debug.checkShaderErrors = /[?&]glcheck\b/.test(location.search);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.shadowMap.enabled = opts.shadows !== false;
  if (opts.alpha) renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.type = LOOK.pcf ? THREE.PCFShadowMap : THREE.BasicShadowMap; // c filters the edges; the 8-bit looks keep the stair-steps

  const depthTex = new THREE.DepthTexture(4, 4); depthTex.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, depthTexture: depthTex });
  const camera = new THREE.PerspectiveCamera(opts.fov || 30, 1, 4, 160);
  const post = new THREE.ShaderMaterial({
    vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false, transparent: !!opts.alpha,
    uniforms: {
      tDiffuse: { value: rt.texture }, tDepth: { value: depthTex }, res: { value: new THREE.Vector2(4, 4) }, levels: { value: LOOK.levels }, dither: { value: LOOK.dither ?? .4 }, olw: { value: opts.fixed ? 1 : LOOK.olw || 1 }, dcell: { value: opts.fixed ? 1 : LOOK.dcell || 1 }, alphaBg: { value: opts.alpha ? 1 : 0 },
      fade: { value: 0 }, flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) }, vig: { value: opts.fixed ? .9 : LOOK.vig }, sat: { value: 1.12 }, hurt: { value: 0 }, expo: { value: LOOK.exp }, lift: { value: LOOK.lift }, vib: { value: LOOK.vib }, con: { value: LOOK.con },
      split: { value: LOOK.split ?? 1 }, cNear: { value: camera.near }, cFar: { value: camera.far }, outline: { value: 1 }, fogN: { value: 1e5 }, fogF: { value: 2e5 },
    },
  });
  const postScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post); quad.frustumCulled = false; postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const R = { renderer, rt, post, camera, w: 4, h: 4, aspect: 1, q: 1 };
  R.resize = () => {
    if (opts.fixed) {
      const [w, h] = opts.fixed; R.w = w; R.h = h; R.aspect = w / h;
      renderer.setSize(w, h, false); rt.setSize(w, h); post.uniforms.res.value.set(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix(); return;
    }
    const W = window.innerWidth, H = window.innerHeight, S = Math.min(W, H), dpr = window.devicePixelRatio || 1;
    let w, h;
    if (LOOK.px) {
      // round 33 (Roy: "LOOK.px is in css px, so on a sharp screen every pixel is 4x4"): the grid is counted in device px,
      // LOOK.px device px per game px, in whole steps (a step coarser only while the screen holds more game pixels than
      // the quality tier's budget, GFX.cap), so a phone or a retina laptop gets the same fine pixels as a plain monitor
      const dw = W * dpr, dh = H * dpr; let k = LOOK.px;
      while (k < 8 && (dw / k) * (dh / k) > GFX.cap) k++;
      R.pxd = k; w = Math.max(160, Math.round(dw / k)); h = Math.max(160, Math.round(dh / k));
    } else {
      // the older looks (?look=base|a..e, previews only): their own grids, in css px
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      const scale = LOOK.native ? 1 / Math.min(2, dpr) : LOOK.classic ? Math.max(coarse ? 1.65 : 1.5, Math.min(S / 420, (S >= 950 ? 3 : 2) / 1.2)) : Math.max(coarse ? LOOK.minPx + .15 : LOOK.minPx, S / LOOK.rows);
      w = Math.max(160, Math.round(W / scale)); h = Math.max(160, Math.round(H / scale));
      const cap = (LOOK.native ? 4.2e6 : 1.4e6) / (w * h); if (cap < 1) { w = Math.round(w * Math.sqrt(cap)); h = Math.round(h * Math.sqrt(cap)); }
    }
    R.w = w; R.h = h; R.aspect = w / h;
    renderer.setSize(w, h, false);
    rt.setSize(w, h);
    post.uniforms.res.value.set(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  R.resize();
  if (!opts.fixed) window.addEventListener('resize', R.resize);

  if (!opts.fixed) {
    onGfx(R.resize);
    // dragged to another screen (a new devicePixelRatio): the grid follows
    const watchDpr = () => window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener?.('change', () => { R.resize(); watchDpr(); }, { once: true });
    watchDpr();
  }
  // round 33: the old dynamic resolution (autoRes: after 3 slow seconds a pixel grid one step coarser, 3x3, for good) is
  // gone. In its place, in auto quality only, the load governor: the mean frame time over 2.5 s windows slides GFX.load
  // (what chunks.js reads for the grass round her and the draw distance) down a tenth when slow, up a tenth when quick
  let lastT = 0, winT = 0, winN = 0; const born = performance.now();
  const govern = !opts.fixed && !/[?&]fullres\b/.test(location.search);
  R.render = (scene) => {
    if (govern && GFX.setting === 'auto') {
      const now = performance.now(), dt = now - lastT; lastT = now;
      if (now - born > 6000 && dt < 400) { winT += dt; winN++; } // start-up hitches (shader compiles, first chunks) don't count
      if (winT > 2500) {
        const mean = winT / winN; winT = 0; winN = 0;
        if (mean > 30 && GFX.load > .5) GFX.load = Math.max(.5, GFX.load - .1);
        else if (mean < 21 && GFX.load < 1) GFX.load = Math.min(1, GFX.load + .1);
      }
    }
    outlineMat.uniforms.px.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / R.h * (opts.outlinePx ?? LOOK.outlinePx);
    for (const f of renderHooks.pre) f(R);
    try {
      renderer.setRenderTarget(rt);
      if (opts.alpha) renderer.clear();
      renderer.render(scene, camera);
    } finally { for (const f of renderHooks.post) f(R); }
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  };
  return R;
}

// shared toon ramp
let ramp = null;
export function toonRamp() {
  if (ramp) return ramp;
  const data = new Uint8Array([90, 90, 90, 255, 165, 165, 165, 255, 230, 230, 230, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  return ramp;
}

// faces: the lit half of the head is one flat tone, so no shading band cuts across the eyes and mouth
let fRamp = null;
export function faceRamp() {
  if (fRamp) return fRamp;
  fRamp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
  fRamp.minFilter = fRamp.magFilter = THREE.NearestFilter; fRamp.generateMipmaps = false; fRamp.needsUpdate = true;
  return fRamp;
}

// Inverted-hull outline for characters: back faces pushed out along the normal by a constant number of screen pixels.
export const outlineMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { px: { value: .002 }, color: { value: new THREE.Color('#0d0b14') } },
  vertexShader: `uniform float px;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      vec3 n = normalize(normalMatrix * normal);
      mv.xyz += n * px * -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.); }',
});
export function addOutline(root, skip) {
  const list = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.outline && !(skip && skip(o))) list.push(o); });
  for (const m of list) {
    const ol = new THREE.Mesh(m.geometry, outlineMat);
    ol.userData.outline = true; ol.castShadow = false; ol.receiveShadow = false; ol.raycast = () => {};
    m.add(ol);
  }
  return root;
}
