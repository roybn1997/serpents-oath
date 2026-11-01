// cores (Roy 29.10: "the game is too heavy for players' PCs"): still things keep their matrices. three works out every
// object's matrix (compose) and world matrix (multiply) every frame, whether it moved or not: in a settled Athens that
// was ~16% of the main thread's work, for ~1300 nodes of houses, walls, stalls and statues that never move. A world
// feature's subtree (overworld.js build) is watched for its first frames; every node that held still all that time stops
// updating its own matrix (matrixAutoUpdate off: its world matrix still follows a parent that moves). Flames, flags and
// anything else seen moving stay as they are. A frozen node is still checked now and then (a few hundred a frame, round
// robin): one that has moved after all (a door opened later) is handed back to three at once, its matrix brought up to
// date, a few frames late at worst and only that once. Nothing about how anything looks or plays changes.
//   (Shadows of small far props were tried too (cores, item 3) and left out: the shadow box is already fitted to what the
//   camera sees (sky.js, Round 33), so three already skips far casters; turning them off saved no draw call: 363 = 363.)
const WATCH_FRAMES = 60, WATCH_MS = 2500, CHECK = 300; // watched for at least this many frames and ms; frozen nodes checked a frame
const S = 10; // numbers per node: position, quaternion, scale
function sig(o, a, k) { const p = o.position, q = o.quaternion, s = o.scale; a[k] = p.x; a[k + 1] = p.y; a[k + 2] = p.z; a[k + 3] = q.x; a[k + 4] = q.y; a[k + 5] = q.z; a[k + 6] = q.w; a[k + 7] = s.x; a[k + 8] = s.y; a[k + 9] = s.z; }
function same(o, a, k) { const p = o.position, q = o.quaternion, s = o.scale; return a[k] === p.x && a[k + 1] === p.y && a[k + 2] === p.z && a[k + 3] === q.x && a[k + 4] === q.y && a[k + 5] === q.z && a[k + 6] === q.w && a[k + 7] === s.x && a[k + 8] === s.y && a[k + 9] === s.z; }

// a character rig (rigbatch.js) learns which of its parts move by watching them, and a part with its matrix frozen would
// read to it as one set by hand (moving): a rig is never frozen, and one batched after its feature froze is thawed first
const FROZEN = new WeakMap(); // node -> its record
const underRig = (o, top) => { for (let a = o; a; a = a.parent) { if (a.userData.rb) return true; if (a === top) return false; } return false; };
export function thawTree(root) {
  root.traverse((o) => {
    const r = FROZEN.get(o); if (!r) return;
    FROZEN.delete(o); o.matrixAutoUpdate = true; o.updateMatrix();
    const i = r.nodes.indexOf(o); r.moving[i] = 1; const j = r.frozen.indexOf(i); if (j >= 0) { r.frozen[j] = r.frozen[r.frozen.length - 1]; r.frozen.pop(); }
  });
}
export class Freezer {
  constructor() { this.recs = []; this.ci = 0; this.cj = 0; this.off = /[?&]nofreeze\b/.test(globalThis.location?.search || ''); }
  // start watching a subtree (a world feature's root, just built)
  add(root) {
    if (this.off || !root) return;
    const nodes = []; root.traverse((o) => { if (o.matrixAutoUpdate && !o.isCamera && !o.isLight) nodes.push(o); });
    if (!nodes.length) return;
    const snap = new Float64Array(nodes.length * S); nodes.forEach((o, i) => sig(o, snap, i * S));
    this.recs.push({ root, nodes, snap, moving: new Uint8Array(nodes.length), frames: 0, t0: performance.now(), frozen: null });
  }
  remove(root) { const i = this.recs.findIndex((r) => r.root === root); if (i >= 0) { this.thaw(this.recs[i]); this.recs.splice(i, 1); } }
  thaw(r) { if (r.frozen) for (const i of r.frozen) { const o = r.nodes[i]; o.matrixAutoUpdate = true; FROZEN.delete(o); } r.frozen = null; }
  // once a frame
  tick() {
    if (this.off) return;
    const now = performance.now();
    for (const r of this.recs) {
      if (r.frozen) continue;
      const { nodes, snap, moving } = r;
      for (let i = 0; i < nodes.length; i++) if (!moving[i] && !same(nodes[i], snap, i * S)) moving[i] = 1;
      if (++r.frames < WATCH_FRAMES || now - r.t0 < WATCH_MS) continue;
      // the watch is over: the still ones freeze, their matrices as they stand now
      r.frozen = [];
      for (let i = 0; i < nodes.length; i++) if (!moving[i]) { const o = nodes[i]; if (underRig(o, r.root)) { moving[i] = 1; continue; } o.updateMatrix(); o.matrixAutoUpdate = false; r.frozen.push(i); FROZEN.set(o, r); }
    }
    // the check: a few hundred frozen nodes a frame, round robin over the subtrees
    let n = CHECK;
    for (let tries = 0; n > 0 && tries < this.recs.length; tries++) {
      if (this.ci >= this.recs.length) { this.ci = 0; this.cj = 0; }
      const r = this.recs[this.ci], F = r.frozen;
      if (!F || !F.length) { this.ci++; this.cj = 0; continue; }
      while (n > 0 && this.cj < F.length) {
        const i = F[this.cj], o = r.nodes[i];
        if (!same(o, r.snap, i * S)) { o.matrixAutoUpdate = true; o.updateMatrix(); FROZEN.delete(o); r.moving[i] = 1; F[this.cj] = F[F.length - 1]; F.pop(); n--; continue; } // it moves after all: three's again
        this.cj++; n--;
      }
      if (this.cj >= F.length) { this.ci++; this.cj = 0; }
    }
  }
  stats() { let watched = 0, frozen = 0; for (const r of this.recs) { watched += r.nodes.length; frozen += r.frozen?.length || 0; } return { roots: this.recs.length, watched, frozen }; }
}
