// The little village: one square, four houses, a temple, a dock and a lake that runs on past the edge of the world.
// The player's real character is drawn with the game's own character code (app/game, a frozen copy).
import * as THREE from './game/js/three.module.min.js';
import { heroOf, makeHero, settle } from './game/js/online/heroes.js';
import { animateRig } from './game/js/models.js';

const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); return m; };
export const NPCS = [
  { id: 'banker', x: 3.2, z: 2.0, look: { body: 'f', hair: 'f_bun', skin: 'skin_2', outfit: 'f_white_dress', weapon: 'sword' }, face: -2.4 },
  { id: 'fisher', x: 0, z: -9.6, look: { body: 'm', hair: 'm_curls', skin: 'skin_3', outfit: 'm_leather_chiton', weapon: 'sword' }, face: 0 },
];
export const DOCK_SPOT = { x: 1.2, z: -10.4 };
const LIMIT = 21;                                        // the walkable circle; trees and the lake close the rest

export function createVillage(canvas, { onNear, onTap }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9cc8d8); scene.fog = new THREE.Fog(0x9cc8d8, 38, 70);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.5, 120);
  scene.add(new THREE.HemisphereLight(0xfff2d8, 0x6a7a5a, 1.9)); const sun = new THREE.DirectionalLight(0xffe2b0, 1.7); sun.position.set(-12, 22, 10); scene.add(sun);

  // ground, the square, paths
  const ground = new THREE.Mesh(new THREE.CircleGeometry(34, 48), mat(0x6f9a4c)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const sq = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, .12, 20), mat(0xcdbf9c)); sq.position.y = .04; scene.add(sq);
  for (const [x, z, w, d] of [[0, -5.5, 1.8, 6], [-8, 0.2, 7, 1.6], [8, 0.2, 7, 1.6], [0, 8, 1.8, 7]]) scene.add(box(w, .1, d, 0xcdbf9c, x, .03, z));
  // the lake: wide, running off past the horizon on the far side; two sheets drift a little
  const lake = []; for (let i = 0; i < 2; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), new THREE.MeshLambertMaterial({ color: i ? 0x4f9ec7 : 0x3d86b0, transparent: true, opacity: i ? .55 : 1 })); l.rotation.x = -Math.PI / 2; l.position.set(0, i ? .06 : .02, -58 + i * .01); scene.add(l); lake.push(l); }
  const shore = new THREE.Mesh(new THREE.RingGeometry(0, 0, 4), mat(0xd9c88e)); void shore;
  scene.add(box(80, .1, 2.5, 0xd9c88e, 0, .03, -13.3));        // the sand along the water
  // the dock
  for (let i = 0; i < 8; i++) scene.add(box(2.4, .16, .62, i % 2 ? 0x8a6238 : 0x9a7040, 0, .3, -11.4 - i * .66));
  for (const [x, z] of [[-1.1, -12], [1.1, -12], [-1.1, -15], [1.1, -15], [-1.1, -17.4], [1.1, -17.4]]) scene.add(box(.2, .9, .2, 0x5e4023, x, .05, z));
  // houses
  const house = (x, z, rot, wall, roof) => { const g = new THREE.Group(); g.add(box(5, 3, 4, wall, 0, 1.5, 0)); const r = new THREE.Mesh(new THREE.ConeGeometry(3.9, 2, 4), mat(roof)); r.position.y = 4; r.rotation.y = Math.PI / 4; r.scale.set(1, 1, .8); g.add(r); g.add(box(1, 1.8, .1, 0x5a3a22, 0, .9, 2.02)); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); };
  house(-12, -3, .3, 0xe6d3a8, 0xb5532f); house(12, -4, -.3, 0xdccaa0, 0xa44a2c); house(-11, 9, .5, 0xe0cfa6, 0xb85c35); house(11, 10, -.5, 0xe8d6ab, 0xae5030);
  // the temple (the shrine): steps, columns, a roof; a statue in front
  const temple = new THREE.Group(); temple.add(box(7, .5, 5, 0xe9e3d3, 0, .25, 0)); temple.add(box(6, .3, 4, 0xf1ecdd, 0, .65, 0));
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.34, .38, 3.2, 8), mat(0xf4efe0)); c.position.set(-2.5 + i * 1.25, 2.4, 1.6); temple.add(c); }
  temple.add(box(6.6, .5, 4.2, 0xe2dccb, 0, 4.2, 0)); const ped = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.5, 3), mat(0xd9d2bd)); ped.rotation.set(Math.PI / 2, 0, Math.PI / 2); ped.scale.set(.9, 1, 1); ped.position.set(0, 5.1, 1.7); temple.add(ped);
  temple.add(box(5.8, 3.4, 3.2, 0xdad2bd, 0, 2.2, -.6)); temple.position.set(0, 0, 17); temple.rotation.y = Math.PI; scene.add(temple);
  // trees, a fence, flowers
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const tree = (x, z, s = 1) => { const t = new THREE.Group(); t.add(box(.5 * s, 1.6 * s, .5 * s, 0x6b4a2b, 0, .8 * s, 0)); const k = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 * s, 0), mat(rng() > .5 ? 0x3f7a3a : 0x4a8a41)); k.position.y = 2.6 * s; t.add(k); t.position.set(x, 0, z); scene.add(t); };
  for (let i = 0; i < 46; i++) { const a = rng() * Math.PI * 2, r = 24 + rng() * 8; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (z < -10) continue; tree(x, z, .8 + rng() * .7); }
  for (const [x, z] of [[-6, 4], [6, 5], [-5, -6], [14, 2], [-15, 4]]) tree(x, z, .9);
  for (let i = 0; i < 14; i++) scene.add(box(.14, .8, .14, 0x8a6a42, -18 + i * 1.0, .4, 13)); scene.add(box(14, .12, .1, 0x9a7a4e, -11.5, .65, 13));
  const flowers = new THREE.Group(); for (let i = 0; i < 80; i++) { const a = rng() * Math.PI * 2, r = 7 + rng() * 14; if (Math.sin(a) < -.35) continue; flowers.add(box(.18, .18, .18, [0xf2d65a, 0xe86a8c, 0xf4f4ea, 0xb98cf0][i % 4], Math.cos(a) * r, .12, Math.sin(a) * r)); } scene.add(flowers);
  // a few clouds
  const clouds = []; for (let i = 0; i < 5; i++) { const c = new THREE.Group(); for (let j = 0; j < 4; j++) c.add(box(3 + rng() * 2, 1, 1.6, 0xffffff, j * 2.2, rng() * .5, rng())); c.position.set(-40 + i * 22, 22 + rng() * 6, -20 - rng() * 30); scene.add(c); clouds.push(c); }

  // people: NPCs (drawn the same way as players) and the player
  const labelOf = (text) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = '600 26px Rubik, sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(20,11,17,.72)'; x.fillRect(8, 8, 240, 48); x.fillStyle = '#f6d67a'; x.fillText(text, 128, 42); const t = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(3, .75, 1); s.renderOrder = 10; return s; };
  const npcs = new Map();
  const blob = () => { const b = new THREE.Mesh(new THREE.CircleGeometry(.55, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .28 })); b.rotation.x = -Math.PI / 2; b.position.y = .09; return b; };
  const addNpc = (n, name) => { const r = makeHero(n.look, { weapon: false }); settle(r); r.root.position.set(n.x, 0, n.z); r.root.rotation.y = n.face; scene.add(r.root); const l = labelOf(name); l.position.set(n.x, 2.5, n.z); scene.add(l); const b = blob(); b.position.x = n.x; b.position.z = n.z; scene.add(b); npcs.set(n.id, { ...n, r, l }); };
  let hero = null; const me = { x: 0, z: 5, face: Math.PI, speed: 0, target: null, fishing: false }; let heroBlob = blob(); scene.add(heroBlob);
  const rod = new THREE.Group(); rod.add(box(.05, .05, 2.2, 0x6b4a2b, 0, 0, 1.1)); const line = box(.012, 1.6, .012, 0xffffff, 0, -.8, 2.2); rod.add(line); rod.add(box(.12, .12, .12, 0xe34b3b, 0, -1.6, 2.2)); rod.visible = false; scene.add(rod);

  function setHero(row) { if (hero) hero.root.removeFromParent(); hero = heroOf(row); settle(hero); scene.add(hero.root); me.x = 0; me.z = 5; me.target = null; me.fishing = false; }
  function setNames(names) { for (const [id, n] of npcs) { n.l.material.map.dispose(); n.l.material.map = labelOf(names[id]).material.map; } }
  const names0 = { banker: 'Chrysa', fisher: 'Nikon' }; for (const n of NPCS) addNpc(n, names0[n.id]);

  // input: a joystick (the page draws it), the keyboard, a tap on the ground or a person
  const keys = new Set(); addEventListener('keydown', (e) => keys.add(e.key.toLowerCase())); addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  const joy = { x: 0, y: 0 }; const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let yaw = 0;                                           // the camera sits behind the player's heading: fixed, simple
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect(); ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    let best = null; for (const [id, n] of npcs) { const hit = ray.ray.distanceSqToPoint(new THREE.Vector3(n.x, 1.1, n.z)); if (hit < 1.1 && (!best || hit < best.d)) best = { id, d: hit }; }
    if (best) { const n = npcs.get(best.id); me.target = { x: n.x, z: n.z + (n.id === 'fisher' ? 1.6 : 1.4), talk: best.id }; return; }
    const pt = new THREE.Vector3(); if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) me.target = { x: pt.x, z: pt.z };
  }
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' || e.isPrimary) pick(e.clientX, e.clientY); });

  let near = null, last = performance.now(), t = 0, ready = false;
  function walkTo(x, z, then) { me.target = { x, z, then }; me.fishing = false; rod.visible = false; }
  function nearest() { let b = null; for (const [id, n] of npcs) { const d = Math.hypot(n.x - me.x, n.z - me.z); if (d < 3 && (!b || d < b.d)) b = { id, d }; } return b?.id || null; }
  function frame(now) {
    const dt = Math.max(.001, Math.min(.05, (now - last) / 1000)); last = now; t += dt;
    if (hero) {
      let ix = joy.x + (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), iz = joy.y + (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      const mag = Math.hypot(ix, iz);
      if (mag > .12) { me.target = null; me.fishing = false; rod.visible = false; ix /= Math.max(1, mag); iz /= Math.max(1, mag); me.speed = 3.1 * Math.min(1, mag); me.x += ix * me.speed * dt; me.z += iz * me.speed * dt; me.face = Math.atan2(ix, iz); }
      else if (me.target) { const dx = me.target.x - me.x, dz = me.target.z - me.z, d = Math.hypot(dx, dz); if (d < .25) { const tg = me.target; me.target = null; me.speed = 0; if (tg.talk) onTap?.(tg.talk); tg.then?.(); } else { me.speed = 3.1; me.x += dx / d * 3.1 * dt; me.z += dz / d * 3.1 * dt; me.face = Math.atan2(dx, dz); } }
      else me.speed = 0;
      // the walkable ground: the circle, and the lake past the sand except along the dock
      const r = Math.hypot(me.x, me.z); if (r > LIMIT) { me.x *= LIMIT / r; me.z *= LIMIT / r; }
      if (me.z < -12.4 && Math.abs(me.x) > 1.0) me.x = Math.sign(me.x) * 1.0; if (me.z < -9.4 && me.z > -12.4 && Math.abs(me.x) > 20) me.x = Math.sign(me.x) * 20; if (me.z < -17.2) me.z = -17.2;
      for (const h of [[-12, -3], [12, -4], [-11, 9], [11, 10], [0, 17]]) { const dx = me.x - h[0], dz = me.z - h[1], rr = h[1] === 17 ? 4.6 : 3.4; if (Math.hypot(dx, dz) < rr) { const k = rr / Math.max(.001, Math.hypot(dx, dz)); me.x = h[0] + dx * k; me.z = h[1] + dz * k; } }
      hero.root.position.set(me.x, 0, me.z);
      let ry = hero.root.rotation.y, want = me.face, dy = ((want - ry + Math.PI * 3) % (Math.PI * 2)) - Math.PI; hero.root.rotation.y = ry + dy * Math.min(1, dt * 12);
      animateRig(hero, Math.max(dt, .001), { moving: me.speed > .2, run: false, speed: me.speed, calm: !me.fishing });
      heroBlob.position.set(me.x, .09, me.z);
      if (me.fishing) { rod.visible = true; rod.position.set(me.x, 1.05, me.z); rod.rotation.y = hero.root.rotation.y; line.position.y = -.8 + Math.sin(t * 2) * .05; } else rod.visible = false;
      const n = nearest(); if (n !== near) { near = n; onNear?.(n); }
      cam.position.lerp(new THREE.Vector3(me.x * .85, 12.5, me.z + 11.5), Math.min(1, dt * 4)); cam.lookAt(me.x * .85, 1.0, me.z - .5);
    }
    for (const [, n] of npcs) animateRig(n.r, dt, { moving: false, calm: true });
    lake[0].position.x = Math.sin(t * .3) * .6; lake[1].position.x = Math.cos(t * .25) * .8; lake[1].position.y = .06 + Math.sin(t * .8) * .01;
    clouds.forEach((c, i) => { c.position.x += dt * (.5 + i * .1); if (c.position.x > 60) c.position.x = -60; });
    renderer.render(scene, cam);
  }
  let running = false, raf = 0;
  const loop = (now) => { if (!running) return; frame(now); raf = requestAnimationFrame(loop); };
  function size() { const q = Number(localStorage.getItem('so-companion-quality') || .5), w = canvas.clientWidth, h = canvas.clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * q); renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
  addEventListener('resize', size); size();
  return {
    setHero, setNames, joy, walkTo, size, DOCK_SPOT,
    startFishing() { walkTo(DOCK_SPOT.x, DOCK_SPOT.z, () => { me.face = 0; me.fishing = true; }); },
    stopFishing() { me.fishing = false; rod.visible = false; },
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    stop() { running = false; cancelAnimationFrame(raf); },
    where: () => ({ x: me.x, z: me.z, fishing: me.fishing }),
  };
}
