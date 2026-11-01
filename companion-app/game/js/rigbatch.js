// Character batching (Roy 27.10: "optimize it as best as you can"). A character rig is built from many small meshes (Val
// alone: 276 parts, 191 outline hulls), and each one costs the GPU driver a draw call in the view, another for its outline
// and another in the shadow pass: on a road Val was ~70% of every draw call in the frame, in a town the people were.
//
// Here the parts that hang still on the same moving bone are drawn as one: per bone and per material, one merged mesh
// (and one outline hull for it). Nothing about the rig changes for the game: every original part stays where it is, keeps
// its material, visibility, layers and raycasts, and code keeps changing them as before. Only while the main renderers
// draw (render.js R.render, through renderHooks) are the originals switched off and the merged copies switched on, and
// after the frame it is the other way round again, so a raycast, a traverse or any other renderer sees the rig as built.
//
// Which bones move is learned by watching: a new rig is drawn as it is for its first frames while the batch notes which
// pivots change; then the parts are merged under the nearest moving ancestor. Every frame the batch checks what it
// merged (each part's own transform, visibility, material, geometry, shadow flags and layers, and the transforms of the
// still pivots in between): a pivot that starts to move becomes a bone of its own, a part that keeps changing is left
// to draw by itself, and any other change re-merges only that bone's parts. Parts with an animated geometry, a shader
// of their own, transparency, skinning or morphs, or children other than their outline hull are never merged.
// ?nobatch turns it off (to compare).
import * as THREE from './three.module.min.js';
import { outlineMat, renderHooks } from './render.js';
import { thawTree } from './freeze.js';

const OFF = typeof location !== 'undefined' && /[?&]nobatch\b/.test(location.search);
const WATCH = 12; // frames a new rig is watched before it is batched
const FLIP_MAX = 6, FLIP_WIN = 90; // a part that changes more than this often in this many frames draws by itself
const batches = new Set();
export const ST = { builds: 0, full: 0, buildMs: 0, syncMs: 0, why: {} }; // (tools/perf-probe.js)
const why = (k) => { ST.why[k] = (ST.why[k] || 0) + 1; };
let frameNo = 0, rafN = 0, synced = -1;
if (typeof requestAnimationFrame !== 'undefined') { const tick = () => { rafN++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); } // (one check per frame, however many renders it makes)

// the merged hulls' material: the outline's own shader and uniforms (render.js sets its width every frame), casting its
// shadow from the front faces like every other part (a back-side material would cast from its back faces)
let HULL = null;
const HULL_VS = `#include <common>
#include <skinning_pars_vertex>
uniform float px;
void main(){
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mv = modelViewMatrix * vec4(transformed, 1.);
  vec3 n = normalize(normalMatrix * objectNormal);
  mv.xyz += n * px * -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const hullMat = () => HULL || (HULL = Object.assign(new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: outlineMat.uniforms, vertexShader: HULL_VS, fragmentShader: outlineMat.fragmentShader }), { shadowSide: THREE.BackSide }));
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3();
const MAT_ORB = THREE.Material.prototype.onBeforeRender, OBJ_ORB = THREE.Object3D.prototype.onBeforeRender;

// a part that can be merged at all (its kind, not its state)
function mergeable(o) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.outline || o.userData.rbProxy) return false;
  if (o.userData.fx || o.userData.cloth || o.userData.dynamic || o.userData.noBatch || o.onBeforeRender !== OBJ_ORB || o.customDepthMaterial) return false;
  const g = o.geometry;
  if (!g?.attributes?.position || g.morphAttributes?.position || g.attributes.tangent || g.drawRange.count !== Infinity || g.drawRange.start) return false;
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of ms) if (!m || m.transparent || m.isShaderMaterial || m.onBeforeRender !== MAT_ORB || m.wireframe) return false;
  if (Array.isArray(o.material) && !g.groups.length) return false;
  for (const c of o.children) if (!(c.userData.outline && c.isMesh && c.material === outlineMat && c.geometry === g && !c.children.length)) return false;
  return true;
}
const hasHull = (o) => o.children.some((c) => c.userData.outline);
// plain coloured materials (no texture, no vertex colours) that differ only in their colour merge into one, the colour
// moving into the vertices: a shared copy with vertex colours and a white base stands in for all of them
const BOC = THREE.Material.prototype.onBeforeCompile;
const canTint = (m) => m.onBeforeCompile === BOC && (m.isMeshToonMaterial || m.isMeshLambertMaterial || m.isMeshBasicMaterial) && !m.map && !m.vertexColors && !m.alphaMap && !m.lightMap && !m.normalMap && !m.bumpMap && !m.emissiveMap && !m.aoMap && !m.envMap;
const tintSig = (m) => [m.type, m.side, m.gradientMap?.id ?? '', m.emissive?.getHex() ?? '', m.emissiveIntensity, m.opacity, m.flatShading, m.fog, m.depthTest, m.depthWrite, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.alphaTest, m.blending, m.colorWrite, m.toneMapped, !!m.pxv, Object.keys(m.defines || {}).sort().join('+')].join(',');
const matKey = (m) => (canTint(m) ? 't:' + tintSig(m) : 'm:' + m.id);
const TINTS = new Map();
function tintMat(m) {
  const k = tintSig(m); let t = TINTS.get(k);
  if (!t) {
    t = m.clone(); t.color.set(1, 1, 1); t.vertexColors = true; t.defines = Object.assign({}, m.defines);
    if (m.pxv) Object.defineProperty(t, 'pxv', { value: true }); // (render.js pxRig: already the pixel-shaded twin)
    TINTS.set(k, t);
  }
  return t;
}
const colSig = (o) => (Array.isArray(o.material) ? o.material.map((m) => m?.color?.getHex()).join() : o.material?.color?.getHex());
const emSig = (o) => (Array.isArray(o.material) ? o.material.map((m) => m?.emissive?.getHex()).join() : o.material?.emissive?.getHex());
const attrSig = (g) => Object.keys(g.attributes).sort().map((k) => `${k}:${g.attributes[k].itemSize}`).join(',');

const kids = (o) => { let n = 0; for (const c of o.children) if (!c.userData.rbProxy) n++; return n; };
// the state of a node the batch relies on, as one array; changed() compares and refreshes it
function snap(o, s = []) {
  const p = o.position, q = o.quaternion, k = o.scale;
  s[0] = p.x; s[1] = p.y; s[2] = p.z; s[3] = q.x; s[4] = q.y; s[5] = q.z; s[6] = q.w; s[7] = k.x; s[8] = k.y; s[9] = k.z;
  s[10] = o.visible; s[11] = o.layers.mask; s[12] = kids(o); s[21] = o.matrixAutoUpdate;
  if (o.isMesh) { s[13] = o.material; s[14] = o.geometry; s[15] = o.geometry?.attributes.position?.version; s[16] = o.castShadow; s[17] = o.receiveShadow; s[18] = o.renderOrder; s[19] = o.frustumCulled; s[20] = o.customDepthMaterial; s[22] = colSig(o); s[23] = emSig(o); }
  return s;
}
// 0 nothing, 1 transform, 2 anything else (visibility, material...), 3 both; 4: its children changed (parts added or taken off)
function changed(o, s) {
  const p = o.position, q = o.quaternion, k = o.scale;
  let r = 0;
  if (s[0] !== p.x || s[1] !== p.y || s[2] !== p.z || s[3] !== q.x || s[4] !== q.y || s[5] !== q.z || s[6] !== q.w || s[7] !== k.x || s[8] !== k.y || s[9] !== k.z) r |= 1;
  if (s[10] !== o.visible || s[11] !== o.layers.mask || s[12] !== kids(o) || s[21] !== o.matrixAutoUpdate) r |= 2;
  else if (o.isMesh && (s[13] !== o.material || s[14] !== o.geometry || s[15] !== o.geometry?.attributes.position?.version || s[16] !== o.castShadow || s[17] !== o.receiveShadow || s[18] !== o.renderOrder || s[19] !== o.frustumCulled || s[20] !== o.customDepthMaterial || s[22] !== colSig(o) || s[23] !== emSig(o))) r |= 2;
  const k4 = s[12] !== kids(o) ? 4 : 0;
  if (r) snap(o, s);
  return r | k4;
}

// pieces of one source mesh in its anchor's space: [{material, geo, start, count, M, det}] (one per geometry group)
function pieces(o, M) {
  const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count, det = M.determinant();
  if (!Array.isArray(o.material)) return [{ material: o.material, g, start: 0, count: n, M, det }];
  return g.groups.map((gr) => ({ material: o.material[gr.materialIndex], g, start: gr.start, count: Math.min(gr.count, n - gr.start), M, det })).filter((p) => p.material && p.count > 0);
}
// one geometry from pieces (all with the same attribute layout), in the anchor's space, as plain triangles
function mergePieces(list, tint, bare) {
  const g0 = list[0].g, names = tint || bare ? ['position', 'normal'] : Object.keys(g0.attributes).filter((k) => k !== 'bend'); // (a plain colour reads no uv; a hull, positions and normals)
  let n = 0; for (const p of list) n += p.count;
  const out = {}; for (const k of names) out[k] = new Float32Array(n * g0.attributes[k].itemSize);
  const cl = tint && !bare ? new Float32Array(n * 3) : null;
  const bw = list.some((p) => p.g.attributes.bend) ? new Float32Array(n) : null; // (a wrist's share of the bone above: see joinParts)
  let w = 0;
  for (const p of list) {
    const idx = p.g.index, nm = _n.getNormalMatrix(p.M), flip = p.det < 0;
    for (let i = 0; i < p.count; i++) {
      // with a mirroring transform the triangle's 2nd and 3rd corners swap, so it still faces out
      let j = p.start + i; if (flip) { const c = i % 3; if (c === 1) j++; else if (c === 2) j--; }
      const v = idx ? idx.getX(j) : j;
      for (const k of names) {
        const a = p.g.attributes[k], s = a.itemSize, d = out[k], o = w * s;
        if (k === 'position') { _v.fromBufferAttribute(a, v).applyMatrix4(p.M); d[o] = _v.x; d[o + 1] = _v.y; d[o + 2] = _v.z; }
        else if (k === 'normal') { _v.fromBufferAttribute(a, v).applyMatrix3(nm).normalize(); d[o] = _v.x; d[o + 1] = _v.y; d[o + 2] = _v.z; }
        else { d[o] = a.getX(v); if (s > 1) d[o + 1] = a.getY(v); if (s > 2) d[o + 2] = a.getZ(v); if (s > 3) d[o + 3] = a.getW(v); }
      }
      if (cl) { const c = p.material.color; cl[w * 3] = c.r; cl[w * 3 + 1] = c.g; cl[w * 3 + 2] = c.b; }
      if (bw && p.g.attributes.bend) bw[w] = p.g.attributes.bend.getX(v);
      w++;
    }
  }
  const geo = new THREE.BufferGeometry();
  for (const k of names) geo.setAttribute(k, new THREE.BufferAttribute(out[k], g0.attributes[k].itemSize));
  if (cl) geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  geo.userData.rb = true; if (bw) geo.userData.bend = bw;
  return geo;
}

// a still part's anchor sign: whether the chain from the anchor up to the root mirrors (a merged piece's corners swap
// once more then, since the merged mesh hangs on the root, not on the anchor)
function chainSign(a, root) { let s = 1; for (let x = a; x && x !== root; x = x.parent) { if (x.matrixAutoUpdate) x.updateMatrix(); if (x.matrix.determinant() < 0) s = -s; } return s; }
const I4 = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4(), _sph = new THREE.Sphere();

class RigBatch {
  constructor(root) {
    this.root = root; this.born = frameNo; this.ready = false; this.seen = frameNo;
    this.moving = new Set([root]); // anchors (bones): the root, pivots seen moving, parts that move themselves
    this.live = new Set(); // parts left to draw by themselves (they keep changing)
    this.flips = new Map(); // part -> frames it changed in (recent)
    this.snaps = new Map(); // node -> snapshot (every node under the root but the batch's own)
    this.cache = new Map(); // anchor -> { groups: Map(key -> {meta, geo, src}), hulls: Map(key -> {meta, geo}), sign }
    this.proxies = []; this.sources = new Set(); this.skeleton = null;
    this.collect();
  }
  collect() {
    this.snaps.clear();
    const walk = (o) => { this.snaps.set(o, snap(o)); for (const c of o.children) if (!c.userData.rbProxy && !c.userData.outline) walk(c); };
    walk(this.root);
  }
  // the nearest anchor above a node and the transform from it, or null when a still parent is hidden on the way. A part
  // that moves itself is its own anchor.
  anchorOf(o) {
    if (!o.visible) return null;
    if (this.moving.has(o)) return [o, new THREE.Matrix4()];
    if (o.matrixAutoUpdate) o.updateMatrix();
    const M = new THREE.Matrix4().copy(o.matrix); let a;
    for (a = o.parent; a && !this.moving.has(a) && !this.live.has(a); a = a.parent) {
      if (!a.visible) return null;
      if (a.matrixAutoUpdate) a.updateMatrix();
      M.premultiply(a.matrix);
    }
    return a ? [a, M] : null;
  }
  // (re)merge the parts under some anchors (a Set), or under all of them; then put the rig's merged meshes together again
  build(only) {
    const t0 = performance.now(); ST.builds++; if (!only) ST.full++;
    try { this.build0(only); this.assemble(); } finally { ST.buildMs += performance.now() - t0; }
  }
  build0(only) {
    const want = new Map(); // anchor -> [source, M][]
    for (const o of this.snaps.keys()) {
      if (o === this.root || this.live.has(o) || !mergeable(o)) continue;
      const am = this.anchorOf(o); if (!am) continue;
      if (only && !only.has(am[0])) continue;
      (want.get(am[0]) || want.set(am[0], []).get(am[0])).push([o, am[1]]);
    }
    for (const a of [...this.cache.keys()]) if (!only || only.has(a)) this.dropAnchor(a);
    for (const [a, list] of want) {
      const sign = chainSign(a, this.root), groups = new Map(), hulls = new Map();
      for (const [o, M] of list) {
        for (const p of pieces(o, M)) {
          const mk = matKey(p.material), tint = mk[0] === 't';
          // (a part with an outline hull casts its shadow through the merged hull, see below)
          const cast = o.castShadow && !hasHull(o);
          const k = `${mk}|${cast}|${o.receiveShadow}|${o.renderOrder}|${o.frustumCulled}|${o.layers.mask}|${tint ? 'pn' : attrSig(o.geometry)}`;
          if (sign < 0) p.det = -p.det;
          const e = groups.get(k) || groups.set(k, { meta: { material: tint ? tintMat(p.material) : p.material, tint, cast, rs: o.receiveShadow, ro: o.renderOrder, fc: o.frustumCulled, lm: o.layers.mask }, list: [], src: new Set() }).get(k);
          e.list.push(p); e.src.add(o);
        }
        // the outline hulls: one for the rig (two when some parts cast a shadow and some don't). The hull also casts the
        // shadow of the parts it outlines: the shadow pass draws its plain geometry (the push outwards is in the outline's
        // own vertex shader, which only the view runs), so the shadow is theirs exactly
        if (hasHull(o)) {
          const k = `${o.castShadow}|${o.layers.mask}`, e = hulls.get(k) || hulls.set(k, { meta: { cast: o.castShadow, lm: o.layers.mask }, list: [] }).get(k);
          const g = o.geometry; e.list.push({ material: null, g, start: 0, count: g.index ? g.index.count : g.attributes.position.count, M, det: M.determinant() * sign });
        }
      }
      const rec = { groups: new Map(), hulls: new Map(), sources: new Set(), bend: bendOf(a, list) };
      for (const [k, e] of groups) { rec.groups.set(k, { meta: e.meta, geo: mergePieces(e.list, e.meta.tint) }); for (const s of e.src) rec.sources.add(s); }
      for (const [k, e] of hulls) rec.hulls.set(k, { meta: e.meta, geo: mergePieces(e.list, false, true) });
      if (rec.sources.size) this.cache.set(a, rec);
    }
  }
  dropAnchor(a) { const rec = this.cache.get(a); if (!rec) return; for (const e of rec.groups.values()) e.geo.dispose(); for (const e of rec.hulls.values()) e.geo.dispose(); this.cache.delete(a); }
  // an anchor whose chain up to the root is all shown
  shownChain(a) { for (let x = a; x && x !== this.root; x = x.parent) if (!x.visible) return false; return true; }
  // the rig's merged meshes: per material (and shadow flags), the pieces of every shown anchor in one skinned mesh whose
  // bones are the anchors themselves, so the GPU puts each piece where its bone is this frame
  assemble() {
    this.dropProxies();
    const bones = [], inv = [], by = new Map(), hb = new Map(), root = this.root;
    for (const [a, rec] of this.cache) {
      if (!this.shownChain(a)) continue;
      const bi = bones.push(a) - 1; inv.push(new THREE.Matrix4());
      // a bending part (a wrist): the bone above once more, its vertices taken there as they lie with the anchor unturned
      const bj = rec.bend ? (inv.push(rec.bend.rest), bones.push(rec.bend.to) - 1) : -1;
      for (const s of rec.sources) this.sources.add(s);
      for (const [k, e] of rec.groups) (by.get(k) || by.set(k, { meta: e.meta, parts: [] }).get(k)).parts.push([bi, e.geo, bj]);
      for (const [k, e] of rec.hulls) (hb.get(k) || hb.set(k, { meta: e.meta, parts: [] }).get(k)).parts.push([bi, e.geo, bj]);
    }
    if (!bones.length) return;
    this.skeleton = new THREE.Skeleton(bones, inv);
    // the bounds, in the root's space, from where each bone stands now (with room for the limbs to swing)
    root.updateWorldMatrix(true, false); _inv.copy(root.matrixWorld).invert();
    const sphere = (parts) => { const S = new THREE.Sphere(); S.makeEmpty(); for (const [bi, g] of parts) { bones[bi].updateWorldMatrix(true, false); _rel.multiplyMatrices(_inv, bones[bi].matrixWorld); _sph.copy(g.boundingSphere).applyMatrix4(_rel); S.union(_sph); } S.radius = S.radius * 1.15 + .5; return S; };
    const make = (meta, parts, mat, hull) => {
      const geo = joinParts(parts), m = new THREE.SkinnedMesh(geo, mat);
      m.bind(this.skeleton, I4); m.boundingSphere = sphere(parts);
      m.castShadow = meta.cast; m.receiveShadow = hull ? false : meta.rs; m.renderOrder = meta.ro || 0; m.frustumCulled = meta.fc ?? true;
      m.layers.mask = meta.lm; m.visible = false; m.raycast = () => {};
      m.userData.rbProxy = true; if (hull) m.userData.outline = true; m.name = hull ? 'rbhull' : 'rb';
      root.add(m); this.proxies.push(m);
    };
    for (const e of by.values()) make(e.meta, e.parts, e.meta.material, false);
    for (const e of hb.values()) make(e.meta, e.parts, hullMat(), true);
  }
  dropProxies() { for (const m of this.proxies) { m.parent?.remove(m); m.geometry.dispose(); } this.proxies.length = 0; this.sources.clear(); this.skeleton?.dispose(); this.skeleton = null; }
  dispose() { this.dropProxies(); for (const a of [...this.cache.keys()]) this.dropAnchor(a); }
  // the anchor whose merged parts a change under node o touches
  ownerAnchor(o) { for (let a = o.parent; a; a = a.parent) if (this.moving.has(a) || this.live.has(a)) return a; return this.root; }
  sync() {
    if (frameNo - this.born < WATCH) { // watching: which pivots and parts move (a node set by hand, matrixAutoUpdate off, counts as moving)
      let grew = false;
      for (const [o, s] of this.snaps) {
        const c = changed(o, s); if (c & 4) grew = true;
        if (c & 1 || !o.matrixAutoUpdate) this.moving.add(o);
      }
      if (grew) this.collect();
      return;
    }
    if (!this.ready) { this.ready = true; this.collect(); this.build(); return; }
    let full = false, join = false; const touched = new Set();
    for (const [o, s] of this.snaps) {
      const c = changed(o, s); if (!c) continue;
      if (c & 4) { full = true; why('parts added/removed'); break; }
      if (o === this.root || this.live.has(o)) continue;
      if (this.moving.has(o)) { // a bone: its pieces follow it as they are; shown or hidden, the rig's meshes are put together again
        if (!(c & 2)) continue;
        if (o.isMesh) { this.flip(o, c); touched.add(o); } else { join = true; why('bone shown/hidden'); }
        continue;
      }
      if (c & 1 || !o.matrixAutoUpdate) { this.moving.add(o); touched.add(this.ownerAnchor(o)); touched.add(o); why(o.isMesh ? 'part moves' : 'pivot moves'); continue; }
      if (o.isMesh) this.flip(o, c); else why('pivot shown/hidden');
      touched.add(this.ownerAnchor(o));
    }
    if (full) { this.dispose(); this.collect(); this.build(); return; }
    if (touched.size) this.build(touched); else if (join) { const t0 = performance.now(); ST.builds++; this.assemble(); ST.buildMs += performance.now() - t0; }
  }
  // a part changed (material, visibility...): one that keeps changing is left to draw by itself
  flip(o, c) {
    const f = (this.flips.get(o) || []).filter((t) => frameNo - t < FLIP_WIN); f.push(frameNo); this.flips.set(o, f);
    if (f.length > FLIP_MAX) { this.live.add(o); why('part flips'); } else why('part changed');
  }
  attached() { let a = this.root; while (a.parent) a = a.parent; return a.isScene; }
  show(on) {
    for (const m of this.proxies) m.visible = on;
    for (const s of this.sources) s.visible = !on;
  }
}
// a part may bend (hands.js, Roy 29.10: "a ball isn't necessary to connect the hand and the wrist"): a geometry attribute
// 'bend' (0..1 per vertex) gives each vertex's share of the pivot userData.bend (the forearm), the part's anchor's parent;
// that share goes where the vertex would be if the anchor (the hand) had not turned. Only a part hung straight on its
// anchor, the anchor on that pivot; drawn by itself (not merged) such a part is simply rigid.
function bendOf(a, list) {
  for (const [o, M] of list) {
    const to = o.userData.bend; if (!to || !o.geometry.attributes.bend || o.parent !== a || a.parent !== to || !M.equals(I4)) continue;
    return { to, rest: new THREE.Matrix4().compose(a.position, _q0, a.scale) };
  }
  return null;
}
const _q0 = new THREE.Quaternion();
// one skinned geometry from per-bone merged geometries (the same attributes): each vertex on its bone, weight 1 (or shared
// with the bone above, for a bending part)
function joinParts(parts) {
  const g0 = parts[0][1], names = Object.keys(g0.attributes); let n = 0;
  for (const [, g] of parts) n += g.attributes.position.count;
  const geo = new THREE.BufferGeometry();
  for (const k of names) {
    const a0 = g0.attributes[k], out = new Float32Array(n * a0.itemSize); let w = 0;
    for (const [, g] of parts) { const arr = g.attributes[k].array; out.set(arr, w); w += arr.length; }
    geo.setAttribute(k, new THREE.BufferAttribute(out, a0.itemSize));
  }
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); let w = 0;
  for (const [bi, g, bj] of parts) {
    const b = bj >= 0 ? g.userData.bend : null;
    for (let i = 0, c = g.attributes.position.count; i < c; i++, w++) { const t = b ? b[i] : 0; si[w * 4] = bi; sw[w * 4] = 1 - t; if (t) { si[w * 4 + 1] = bj; sw[w * 4 + 1] = t; } }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.userData.rb = true;
  return geo;
}

// the main loop's hook (render.js renderHooks): before a renderer draws, every batch is checked and swapped in; after,
// swapped back. A rig that has left the scene for a while is let go.
let shown = [];
let enabled = true;
export function setRigBatch(on) { enabled = !!on; } // (tests: the same frame with and without)
renderHooks.pre.push(() => {
  if (!enabled) { shown = []; return; }
  const check = synced !== rafN; synced = rafN; if (check) frameNo++;
  shown = [];
  for (const b of batches) {
    if (!b.attached()) { if (frameNo - b.seen > 600) { b.dispose(); batches.delete(b); b.root.userData.rb = null; } continue; }
    b.seen = frameNo;
    if (!b.root.visible) continue;
    try { if (check) { const t0 = performance.now(); b.sync(); ST.syncMs += performance.now() - t0; } b.show(true); shown.push(b); } catch (e) { console.warn('[rigbatch]', e); b.show(false); b.dispose(); batches.delete(b); b.root.userData.rb = 'off'; }
  }
});
renderHooks.post.push(() => { for (const b of shown) b.show(false); shown = []; });

// a rig to batch (models.js animateRig: every character the game animates)
export function batchRig(r) {
  const root = r?.root; if (OFF || !root || root.userData.rb) return;
  thawTree(root); // (cores: a rig in a town's subtree that freeze.js froze while it stood still is watched as it really is)
  const b = new RigBatch(root); root.userData.rb = b; batches.add(b);
}
// a rig taken out of the game for good (js/online/avatars.js remove): its merged copies let go at once
export function releaseRig(root) { const b = root?.userData.rb; if (!b || typeof b !== 'object') return; b.dispose(); batches.delete(b); root.userData.rb = null; }
export const rigBatchStats = () => { let p = 0, s = 0, bn = 0, w = 0; for (const b of batches) { p += b.proxies.length; s += b.sources.size; bn += b.skeleton?.bones.length || 0; if (!b.ready && b.root.visible && b.attached()) w++; } return { rigs: batches.size, proxies: p, sources: s, bones: bn, watching: w }; }; // (watching: shown rigs still drawn part by part, tools/perf.mjs waits them out)
// (tools/perf-probe.js) why a rig's parts are or aren't merged
export function rigBatchWhy(root) {
  const b = root?.userData.rb; if (!b || typeof b !== 'object') return null;
  let sample = null; const why = {}, detail = {}, add = (k) => { why[k] = (why[k] || 0) + 1; };
  const merged = b.sources;
  for (const o of b.snaps.keys()) {
    if (!o.isMesh) continue;
    let vis = true; for (let a = o; a; a = a.parent) if (!a.visible) vis = false;
    if (!vis) { add('hidden'); continue; }
    if (merged.has(o)) { add('merged'); continue; }
    if (b.live.has(o)) { add('live'); continue; }
    
    if (!mergeable(o)) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      add(o.userData.fx ? 'fx' : o.userData.cloth ? 'cloth' : ms.some((m) => m?.transparent) ? 'transparent' : ms.some((m) => m?.isShaderMaterial) ? 'shader' : o.children.some((c) => !c.userData.outline) ? 'children' : o.onBeforeRender !== OBJ_ORB ? 'obr' : 'other');
      continue;
    }
    add('alone');
    const ms = Array.isArray(o.material) ? o.material : [o.material], am = b.anchorOf(o);
    let peers = 0; if (am) for (const q of b.snaps.keys()) if (q !== o && q.isMesh && mergeable(q) && !b.live.has(q) && !b.moving.has(q)) { const x = b.anchorOf(q); if (x && x[0] === am[0]) peers++; }
    const k = `${ms.map((m) => (m.map ? 'map' : canTint(m) ? 'tint' : m.onBeforeCompile !== BOC ? 'obc' : 'plain:' + m.type)).join('/')} peers${Math.min(peers, 3)}`;
    detail[k] = (detail[k] || 0) + 1;
    if (peers === 1 && !sample) {
      const q = [...b.snaps.keys()].find((x) => x !== o && x.isMesh && mergeable(x) && !b.live.has(x) && !b.moving.has(x) && b.anchorOf(x)?.[0] === am[0]);
      const desc = (x) => ({ name: x.name, cs: x.castShadow, rs: x.receiveShadow, ro: x.renderOrder, fc: x.frustumCulled, lm: x.layers.mask, hull: hasHull(x), merged: merged.has(x), keys: (Array.isArray(x.material) ? x.material : [x.material]).map(matKey), anchorIsLive: b.live.has(am[0]), anchorType: am[0].type + ':' + am[0].name, anchorRec: !!b.cache.get(am[0]) });
      sample = [desc(o), q && desc(q)];
    }
  }
  return { sample, why, detail, anchors: b.cache.size, moving: b.moving.size, live: b.live.size, proxies: b.proxies.length };
}
