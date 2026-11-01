// The Serpent's Oath: candidate sound sets for V's weapons (round 34; Roy: "give me 5 sounds for each weapon type I
// choose, the sound now is not good"). Five per weapon type of catalog.js WEAPON_TYPES, each a different character (a
// crisp steel shing, a meaty chop, an airy whip, a bronze ring, a dull thud and crunch...), and each a full set:
//   sw  the swing (every swing, hit or miss; a miss is the swing alone)      th  a spear's thrust (its swing on steps 0-1)
//   ch  the charged strike's release                                         hit the weapon's bite in a blow on a body
//   fl  the body's answer when it is flesh (other bodies keep audio.js MAT)  hv  added when the blow is a heavy one
//   sl  the charged strike's slam
// audiodata.js WEAPON_SOUND_PICK picks one per type (0 keeps the game's own sound, audio.js wSwing / wHit); audio.js
// setWeaponSound(type, n) overrides it at runtime. audio.js sfxPlay asks weaponSoundDef(name, opts, engine) for every
// sfx and plays the def it returns in place of its own: V's swings (wh_<style>, wh_charge), her blows (hit_<style>,
// charge_slam), the miss tail (wc_miss: a set's swing already carries its tail) and the shield bash (hit_bash on a body,
// and the sword-and-shield finisher's shove when a shield is in her off hand: audio.setOffhand).
// Layers: [instrument, params]. In a swing every time (at, a, h, d, dur, the points of a frequency path) is a fraction of
// the swing's length; in a blow they are seconds. f is scaled by the play's pitch; v by the set's level (CAL).

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
let LIB = { MAT: {}, ELEM: {} };
export function setBodyLib(lib) { LIB = lib; } // audio.js hands over its MAT (bodies) and ELEM (weapon elements)

// ---------------------------------------------------------------- instruments
// gain envelope: a rise over a (lin, or 'cos': a smooth swell), a hold, a fall of 60 dB over d, then silence
function env(p, t, a, h, d, v, shape) {
  p.setValueAtTime(0, t); a = Math.max(.0005, a);
  if (shape === 'cos') for (const u of [.2, .4, .6, .8, 1]) p.linearRampToValueAtTime(v * (.5 - .5 * Math.cos(Math.PI * u)), t + a * u);
  else p.linearRampToValueAtTime(v, t + a);
  const t1 = t + a + (h || 0); if (h > 0) p.setValueAtTime(v, t1);
  p.exponentialRampToValueAtTime(Math.max(v * .001, 1e-6), t1 + d); p.linearRampToValueAtTime(0, t1 + d + .005);
  return t1 + d + .005;
}
const fpath = (p, t, f) => { p.setValueAtTime(f[0][1], t + f[0][0]); for (let i = 1; i < f.length; i++) p.exponentialRampToValueAtTime(Math.max(20, f[i][1]), t + f[i][0]); };
const f0 = (f) => (typeof f === 'number' ? f : f[0][1]);
function out(A, g, t, len, pan) {
  const dest = A._o.out; if (pan == null || !A.ctx.createStereoPanner) { g.connect(dest); return; }
  const P = A.ctx.createStereoPanner(), p0 = Array.isArray(pan) ? pan[0] : pan; P.pan.setValueAtTime(clamp(p0, -1, 1), t);
  if (Array.isArray(pan)) P.pan.linearRampToValueAtTime(clamp(pan[1], -1, 1), t + len);
  g.connect(P); P.connect(dest);
}
const INST = {
  // filtered noise: {buf: white|pink|brown, f (band centre: Hz or a path), q, f2/q2 (a second band), hp, lp, a, h, d, v, shape, am: [Hz, depth], pan}
  noise(A, t, p) {
    const buf = A[p.buf || 'pink'], s = A.S(buf, true); let n = s;
    const add = (type, f, q) => { const F = A.F(type, f0(f), q); if (typeof f !== 'number') fpath(F.frequency, t, f); n.connect(F); n = F; };
    if (p.hp) add('highpass', p.hp, .7);
    if (p.f) add('bandpass', p.f, p.q ?? 1);
    if (p.f2) add('bandpass', p.f2, p.q2 ?? 1);
    if (p.lp) add('lowpass', p.lp, .7);
    const g = A.G(0), end = env(g.gain, t, p.a ?? .002, p.h, p.d ?? .1, p.v ?? .3, p.shape);
    if (p.am) { const m = A.G(1 - p.am[1]), o = A.O(p.am[2] || 'sine', p.am[0]), og = A.G(p.am[1]); o.connect(og); og.connect(m.gain); n.connect(m); m.connect(g); o.start(t); o.stop(end + .02); }
    else n.connect(g);
    out(A, g, t, end - t, p.pan); s.start(t, rnd(0, Math.max(0, buf.duration - 1))); s.stop(end + .02); A._mark(end);
  },
  // an oscillator: {w, f (Hz or path), a, h, d, v, lp, pan}
  tone(A, t, p) {
    const o = A.O(p.w || 'sine', f0(p.f)); if (typeof p.f !== 'number') fpath(o.frequency, t, p.f);
    const g = A.G(0), end = env(g.gain, t, p.a ?? .002, p.h, p.d ?? .15, p.v ?? .3, p.shape); let n = o;
    if (p.lp) { const F = A.F('lowpass', p.lp, .7); n.connect(F); n = F; }
    n.connect(g); out(A, g, t, end - t, p.pan); o.start(t); o.stop(end + .02); A._mark(end);
  },
  // struck metal: the modes of a bar / a bronze plate / a dull iron head / a bell, each a sine with its own fall.
  // {f, m, d (the lowest mode's fall), v, a}
  ring(A, t, p) {
    const M = MODES[p.m || 'steel'], sr = A.ctx.sampleRate; let end = t;
    for (const [r, amp, dm] of M) {
      const f = p.f * r; if (f > sr * .42 || f < 30) continue;
      const o = A.O('sine', f * rnd(.998, 1.002)), g = A.G(0), e = env(g.gain, t, p.a ?? .0015, 0, p.d * dm, p.v * amp);
      o.connect(g); out(A, g, t, e - t, p.pan); o.start(t); o.stop(e + .02); end = Math.max(end, e);
    }
    A._mark(end);
  },
  // grains of filtered noise (a wet squelch, a gristle crunch, a leather creak): {dur, f, q, lp, v, dt: [min, max] s between
  // grains, fall (how fast it dies over dur), swell: rises and falls instead}
  grains(A, t, p) {
    const s = A.S(A.white, true), F = A.F('bandpass', f0(p.f), p.q ?? 1.2), L = A.F('lowpass', p.lp || 6000, .7), g = A.G(0), dur = p.dur || .06, dt = p.dt || [.003, .01];
    if (typeof p.f !== 'number') fpath(F.frequency, t, p.f);
    g.gain.setValueAtTime(0, t);
    for (let x = t; x < t + dur; x += rnd(dt[0], dt[1])) { const u = (x - t) / dur, e = p.swell ? Math.sin(Math.PI * u) : Math.pow(1 - u, p.fall ?? 1.4); g.gain.setTargetAtTime(p.v * e * Math.pow(Math.random(), 1.3), x, p.tc ?? .0012); }
    g.gain.setTargetAtTime(0, t + dur, .003);
    s.connect(F); F.connect(L); L.connect(g); out(A, g, t, dur, p.pan); s.start(t, rnd(0, 1)); s.stop(t + dur + .04); A._mark(t + dur + .03);
  },
  // a crackle (debris, splinters): engine crk {dur, dens: n/s or [from, to], v, f, type, q}
  crk(A, t, p) { A.crk(t, p.dur || .1, p.dens || 200, p.v, p.f || 1500, p.type || 'bandpass', p.q ?? .9); },
  // a knock on wood: {f, v, d}
  knock(A, t, p) {
    const f = p.f, v = p.v ?? .4;
    INST.tone(A, t, { w: 'triangle', f: [[0, f * 1.12], [.015, f]], a: .0008, d: p.d || .08, v, pan: p.pan });
    INST.tone(A, t, { f: f * 2.62, a: .0006, d: .035, v: v * .35, pan: p.pan });
    INST.noise(A, t, { buf: 'white', f: f * 2.1, q: 3, a: .0005, d: .03, v: v * .6, pan: p.pan });
  },
};
// the modes [ratio, level, fall] of the struck bodies: a steel bar (free-free modes, each with a close twin that beats),
// a bronze plate (closer, warmer), an iron head (few, short: a clank, not a bell), a bell (hum, prime, minor third...)
const MODES = {
  steel: [[1, 1, 1], [1.0041, .7, .95], [2.756, .5, .55], [2.771, .35, .5], [5.404, .26, .3], [8.933, .1, .18]],
  bronze: [[1, 1, 1], [1.0027, .75, .95], [1.594, .55, .8], [2.136, .45, .6], [2.152, .35, .58], [2.917, .24, .42], [3.6, .14, .3]],
  iron: [[1, 1, 1], [1.432, .6, .55], [2.21, .38, .35], [2.95, .22, .25]],
  bell: [[.5, .45, 1.5], [1, 1, 1], [1.19, .55, .8], [1.5, .35, .6], [2, .45, .5], [2.52, .2, .32], [3.01, .12, .22]],
};
// play layers at t. c: {k: pitch, sc: time scale (a swing's length; 1 for blows), v: level, pan: the swing's sweep}
function play(A, t, layers, c) {
  for (const [type, p0] of layers || []) {
    const p = { ...p0 }, sc = p.abs ? 1 : c.sc || 1, k = p.fix ? 1 : c.k || 1;
    for (const key of ['at', 'a', 'h', 'd', 'dur']) if (p[key] != null) p[key] *= sc;
    for (const key of ['f', 'f2']) if (p[key] != null) p[key] = typeof p[key] === 'number' ? p[key] * k : p[key].map(([x, y]) => [x * sc, y * k]);
    p.v = (p.v ?? .3) * (c.v ?? 1);
    if (p.pan === true) p.pan = c.pan; else if (p.pan == null && c.pan0 != null) p.pan = c.pan0;
    try { INST[type](A, t + (p.at || 0), p); } catch (e) { /* a sound must never break the game */ }
  }
}

// ---------------------------------------------------------------- the bodies (a blow on flesh)
const FL = {
  std: (z = 1) => [['tone', { f: [[0, 150 / Math.pow(z, .3)], [.09, 55]], d: .13, v: .5, fix: 1 }], ['noise', { buf: 'pink', f: 650, q: 1, d: .07, v: .45 }], ['grains', { at: .003, dur: .055, f: 1250, q: 1.2, v: .28, lp: 4500 }]],
  wet: () => [['tone', { f: [[0, 170], [.06, 70]], d: .08, v: .32, fix: 1 }], ['noise', { buf: 'pink', f: 900, q: .9, d: .05, v: .35 }], ['grains', { at: .002, dur: .1, f: [[0, 1700], [.1, 900]], q: 1.1, v: .5, dt: [.003, .008], lp: 5000 }]],
  meaty: (z = 1) => [['tone', { f: [[0, 135 / Math.pow(z, .3)], [.12, 46]], d: .19, v: .7, fix: 1 }], ['noise', { buf: 'pink', f: 420, q: 1.1, d: .1, v: .6 }], ['grains', { at: .004, dur: .075, f: 1050, q: 1.3, v: .32, lp: 3800 }]],
  dull: (z = 1) => [['tone', { f: [[0, 105 / Math.pow(z, .25)], [.15, 38]], d: .24, v: .8, fix: 1 }], ['noise', { buf: 'brown', lp: 480, d: .12, v: .7 }], ['grains', { at: .005, dur: .06, f: 900, q: 1.4, v: .22, lp: 3000 }]],
  tight: () => [['tone', { f: [[0, 240], [.05, 85]], d: .07, v: .42, fix: 1 }], ['noise', { buf: 'pink', f: 800, q: 1.3, d: .045, v: .38 }], ['grains', { at: .002, dur: .07, f: 1150, q: 1.4, v: .36, lp: 4200 }]],
};

// ---------------------------------------------------------------- the characters (z: the weapon's size, 1 = a one-handed blade)
const P = (z, e = .6) => 1 / Math.pow(z, e); // a bigger weapon sounds lower
const CH = {
  // a crisp steel shing: a bright bladed whoosh with its whistle, a clean slice and a ringing edge
  steel: (z = 1) => ({ fl: FL.std(z),
    sw: [['noise', { buf: 'pink', f: [[0, 800 * P(z)], [.45, 2600 * P(z)], [1, 1100 * P(z)]], q: 1.1, lp: 6000, a: .45, d: .75, v: .45, shape: 'cos', pan: true }],
      ['noise', { buf: 'white', f: [[0, 2000 * P(z)], [.45, 3200 * P(z)], [1, 2200 * P(z)]], q: 14, lp: 6500, a: .45, d: .6, v: .7, shape: 'cos', pan: true }],
      ['noise', { buf: 'pink', f: [[0, 300], [.45, 700], [1, 330]], q: .8, a: .4, d: .7, v: .22 * z, shape: 'cos' }],
      ['ring', { at: .34, f: 3300 * P(z, .4), m: 'steel', d: .14 * z, v: .012 }]],
    hit: [['noise', { buf: 'white', hp: 2500, lp: 7500, a: .0005, d: .012, v: .3 }],
      ['noise', { buf: 'white', f: [[0, 5600], [.035, 1900]], q: 1.6, lp: 9500, a: .001, d: .045, v: .5 }],
      ['ring', { at: .002, f: 2350 * P(z, .5), m: 'steel', d: .45 * z, v: .05 }]],
    hv: [['tone', { f: [[0, 120], [.18, 40]], d: .25, v: .4, fix: 1 }], ['ring', { f: 1400 * P(z, .5), m: 'steel', d: .7 * z, v: .035 }]],
    sl: [['noise', { buf: 'white', f: [[0, 5000], [.06, 1500]], q: 1.2, lp: 9000, a: .001, d: .08, v: .6 }], ['ring', { f: 1150 * P(z, .4), m: 'steel', d: 1.2 * z, v: .08 }],
      ['tone', { f: [[0, 110], [.4, 32]], d: .5, v: .7, fix: 1 }], ['noise', { buf: 'brown', lp: 900, d: .35, v: .5 }], ['grains', { at: .01, dur: .12, f: 1600, q: 1.6, v: .3, lp: 4000 }]],
    rv: { sw: .07, hit: .12, sl: .3 } }),
  // a clean razor slice: quick and airy, a thin whisper of an edge, the cut itself wet, nothing rings
  razor: (z = 1) => ({ fl: FL.wet(), dk: .85,
    sw: [['noise', { buf: 'pink', f: [[0, 1100 * P(z)], [.4, 3000 * P(z)], [1, 1500 * P(z)]], q: .7, lp: 5000, a: .4, d: .5, v: .55, shape: 'cos', pan: true }],
      ['noise', { buf: 'white', f: [[0, 2400 * P(z)], [.4, 3400 * P(z)], [1, 2600 * P(z)]], q: 20, lp: 5500, a: .42, d: .4, v: .55, shape: 'cos', pan: true }]],
    hit: [['noise', { buf: 'white', f: [[0, 5200], [.025, 2200]], q: 2, lp: 8000, a: .0008, d: .03, v: .45 }],
      ['noise', { at: .012, buf: 'white', f: [[0, 4200], [.03, 1500]], q: 1.5, lp: 8000, a: .001, d: .04, v: .32 }]],
    hv: [['grains', { at: .01, dur: .12, f: [[0, 1300], [.12, 700]], q: 1.2, v: .35, lp: 4000 }], ['tone', { f: [[0, 140], [.12, 50]], d: .16, v: .4, fix: 1 }]],
    sl: [['noise', { buf: 'white', f: [[0, 5200], [.03, 2000]], q: 1.8, lp: 8000, a: .0008, d: .04, v: .55 }], ['noise', { at: .03, buf: 'white', f: [[0, 5000], [.05, 1600]], q: 1.4, lp: 9000, a: .001, d: .06, v: .45 }],
      ['grains', { at: .01, dur: .2, f: [[0, 1600], [.2, 700]], q: 1.1, v: .5, lp: 4500 }], ['tone', { f: [[0, 95], [.35, 34]], d: .4, v: .6, fix: 1 }]],
    rv: { sw: .05, hit: .08, sl: .22 } }),
  // a bronze ring: a warm round whoosh, a blow that rings low and long like struck bronze
  bronze: (z = 1, rf = 820) => ({ fl: FL.std(z),
    sw: [['noise', { buf: 'pink', f: [[0, 500 * P(z)], [.45, 1700 * P(z)], [1, 650 * P(z)]], q: 1, a: .45, d: .8, v: .55, shape: 'cos', pan: true }],
      ['noise', { buf: 'pink', f: [[0, 900 * P(z)], [.45, 1500 * P(z)], [1, 950 * P(z)]], q: 8, a: .45, d: .6, v: .5, shape: 'cos', pan: true }],
      ['ring', { at: .4, f: rf * 2.4 * P(z, .4), m: 'bronze', d: .2, v: .01 }]],
    hit: [['noise', { buf: 'white', f: 3500, q: 1, a: .0005, d: .012, v: .25 }], ['noise', { buf: 'pink', f: 1800, q: 1.5, a: .001, d: .03, v: .35 }],
      ['ring', { at: .001, f: rf * P(z, .5), m: 'bronze', d: .9 * z, v: .07 }]],
    hv: [['tone', { f: [[0, 115], [.2, 40]], d: .26, v: .45, fix: 1 }], ['ring', { f: rf * .5 * P(z, .5), m: 'bronze', d: 1.2 * z, v: .04 }]],
    sl: [['ring', { f: rf * .37 * P(z, .3), m: 'bronze', d: 1.8, v: .11 }], ['ring', { f: rf * 1.12 * P(z, .3), m: 'bronze', d: .9, v: .05 }], ['noise', { buf: 'pink', f: 1500, q: 1, a: .001, d: .05, v: .5 }],
      ['tone', { f: [[0, 105], [.4, 34]], d: .5, v: .7, fix: 1 }], ['noise', { buf: 'brown', lp: 700, d: .3, v: .45 }]],
    rv: { sw: .08, hit: .18, sl: .35 } }),
  // a heavy meaty chop: a low whump of air, a deep bite into the body, no ring
  meaty: (z = 1) => ({ fl: FL.meaty(z), dk: 1.1,
    sw: [['noise', { buf: 'pink', f: [[0, 240 * P(z, .5)], [.5, 900 * P(z, .5)], [1, 280 * P(z, .5)]], q: .9, a: .5, d: .7, v: .7, shape: 'cos', pan: true }],
      ['noise', { buf: 'brown', lp: [[0, 250], [.5, 600], [1, 250]], a: .5, d: .6, v: .45 * z, shape: 'cos' }],
      ['tone', { f: [[0, 95 * P(z, .3)], [1, 55]], a: .5, d: .5, v: .1 * z, shape: 'cos', fix: 1 }],
      ['grains', { abs: 1, dur: .09, f: 850, q: 2, v: .05, dt: [.006, .02], swell: 1 }]],
    hit: [['noise', { buf: 'white', f: [[0, 2600], [.03, 900]], q: 1.2, lp: 6000, a: .0008, d: .035, v: .35 }],
      ['tone', { f: [[0, 130 * P(z, .3)], [.12, 45]], d: .2, v: .35, fix: 1 }], ['crk', { at: .004, dur: .06, dens: 160, v: .12, f: 1500, q: 1.1 }]],
    hv: [['tone', { f: [[0, 100], [.25, 34]], d: .3, v: .5, fix: 1 }], ['grains', { at: .006, dur: .1, f: 1400, q: 1.8, v: .3, dt: [.002, .006], lp: 3500 }]],
    sl: [['tone', { f: [[0, 100], [.5, 30]], d: .6, v: .9, fix: 1 }], ['noise', { buf: 'pink', f: 300, q: 1, d: .22, v: .7 }], ['noise', { buf: 'white', f: [[0, 2200], [.05, 700]], q: 1.1, lp: 5000, a: .001, d: .06, v: .4 }],
      ['grains', { at: .008, dur: .16, f: 1300, q: 1.6, v: .4, dt: [.002, .007], lp: 3500 }], ['noise', { buf: 'brown', lp: 260, a: .01, d: .6, v: .6 }]],
    rv: { sw: .06, hit: .1, sl: .28 } }),
  // an airy whip: a fast whistling "fwip" that cracks at the end, a snapping blow
  whip: (z = 1) => ({ fl: FL.tight(), dk: .8,
    sw: [['noise', { buf: 'white', f: [[0, 800 * P(z)], [.55, 3300 * P(z)], [1, 1000 * P(z)]], q: 9, lp: 6500, a: .55, d: .35, v: .9, shape: 'cos', pan: true }],
      ['noise', { buf: 'pink', hp: 700, f: [[0, 1500 * P(z)], [.55, 3500 * P(z)], [1, 1500 * P(z)]], q: .7, a: .5, d: .4, v: .3, shape: 'cos', pan: true }],
      ['noise', { at: .55, buf: 'white', hp: 2000, lp: 6000, a: .002, d: .03, v: .05 }]],
    hit: [['noise', { buf: 'white', hp: 2500, lp: 9000, a: .0003, d: .008, v: .6 }], ['tone', { f: [[0, 230 * P(z, .3)], [.05, 70]], d: .07, v: .4, fix: 1 }],
      ['noise', { at: .003, buf: 'white', f: [[0, 4200], [.02, 1800]], q: 1.4, lp: 8000, a: .0008, d: .025, v: .3 }]],
    hv: [['tone', { f: [[0, 130], [.18, 42]], d: .22, v: .45, fix: 1 }], ['noise', { buf: 'white', hp: 1800, lp: 7000, a: .0003, d: .015, v: .35 }]],
    sl: [['noise', { buf: 'white', hp: 2200, lp: 9000, a: .0003, d: .012, v: .8 }], ['noise', { at: .01, buf: 'white', f: [[0, 3500], [.1, 900]], q: 4, lp: 8000, a: .002, d: .14, v: .5 }],
      ['tone', { f: [[0, 120], [.45, 30]], d: .55, v: .85, fix: 1 }], ['noise', { buf: 'brown', lp: 500, d: .3, v: .5 }]],
    rv: { sw: .05, hit: .1, sl: .3 } }),
  // a low dull thud and crunch: a dark push of air, a blow that lands like a club and breaks bone under it
  thud: (z = 1) => ({ fl: FL.dull(z), dk: 1.1,
    sw: [['noise', { buf: 'brown', lp: [[0, 180], [.5, 520 * P(z, .3)], [1, 190]], a: .5, d: .5, v: .9 * Math.sqrt(z), shape: 'cos', pan: true }],
      ['noise', { buf: 'pink', f: [[0, 200 * P(z, .4)], [.5, 600 * P(z, .4)], [1, 220 * P(z, .4)]], q: .9, a: .5, d: .45, v: .45, shape: 'cos', pan: true }],
      ['tone', { f: [[0, 70], [1, 45]], a: .5, d: .4, v: .16 * z, shape: 'cos', fix: 1 }]],
    hit: [['tone', { f: [[0, 95 * P(z, .3)], [.15, 38]], d: .25, v: .45, fix: 1 }], ['grains', { at: .004, dur: .09, f: 1700, q: 2, v: .4, dt: [.002, .006], lp: 4000 }],
      ['crk', { at: .006, dur: .12, dens: [400, 60], v: .22, f: 1400, q: 1 }]],
    hv: [['tone', { f: [[0, 80], [.3, 30]], d: .35, v: .55, fix: 1 }], ['grains', { at: .02, dur: .12, f: 1500, q: 2, v: .3, dt: [.003, .01], lp: 3500 }]],
    sl: [['tone', { f: [[0, 80], [.7, 28]], d: .75, v: 1, fix: 1 }], ['noise', { buf: 'brown', lp: 600, d: .3, v: .8 }], ['grains', { at: .005, dur: .25, f: 1600, q: 1.8, v: .45, dt: [.002, .008], lp: 3800 }],
      ['crk', { at: .03, dur: .5, dens: [120, 15], v: .2, f: 900, type: 'lowpass', q: .7 }], ['noise', { buf: 'brown', lp: 200, a: .02, d: .8, v: .6 }]],
    rv: { sw: .06, hit: .12, sl: .35 } }),
  // a dull iron clank: an axe head on a haft, a short non-singing clank and a chop
  clank: (z = 1) => ({ fl: FL.meaty(z),
    sw: [['noise', { buf: 'pink', f: [[0, 350 * P(z, .5)], [.45, 1300 * P(z, .5)], [1, 400 * P(z, .5)]], q: 1.1, a: .45, d: .7, v: .6, shape: 'cos', pan: true }],
      ['grains', { abs: 1, dur: .16, f: 900, q: 2.2, v: .08, dt: [.008, .022], swell: 1 }],
      ['ring', { at: .42, f: 1700 * P(z, .4), m: 'iron', d: .08, v: .012 }]],
    hit: [['ring', { at: .001, f: 1300 * P(z, .5), m: 'iron', d: .22 * z, v: .1 }], ['noise', { buf: 'white', f: 2400, q: 2.5, a: .0006, d: .03, v: .42 }],
      ['tone', { f: [[0, 160 * P(z, .3)], [.08, 60]], d: .14, v: .35, fix: 1 }]],
    hv: [['ring', { f: 800 * P(z, .5), m: 'iron', d: .35 * z, v: .07 }], ['tone', { f: [[0, 105], [.22, 36]], d: .28, v: .5, fix: 1 }]],
    sl: [['ring', { f: 700 * P(z, .4), m: 'iron', d: .55 * z, v: .12 }], ['noise', { buf: 'white', f: 2000, q: 2, a: .0006, d: .05, v: .5 }], ['tone', { f: [[0, 105], [.45, 32]], d: .55, v: .85, fix: 1 }],
      ['grains', { at: .01, dur: .18, f: 1400, q: 1.8, v: .35, dt: [.002, .008], lp: 3500 }], ['noise', { buf: 'brown', lp: 400, d: .4, v: .5 }]],
    rv: { sw: .06, hit: .12, sl: .3 } }),
  // a wooden haft: the shaft hums low through the air and a creak of the grip; the blow lands as a knock and a thud
  wood: (z = 1, kf = 430) => ({ fl: FL.std(z),
    sw: [['noise', { buf: 'pink', f: [[0, 320 * P(z, .4)], [.5, 620 * P(z, .4)], [1, 340 * P(z, .4)]], q: 6, a: .5, d: .6, v: .9, shape: 'cos', pan: true }],
      ['noise', { buf: 'pink', f: [[0, 500 * P(z)], [.5, 1500 * P(z)], [1, 600 * P(z)]], q: .9, a: .5, d: .7, v: .35, shape: 'cos', pan: true }],
      ['grains', { abs: 1, dur: .14, f: 700, q: 2.5, v: .1, dt: [.01, .03], swell: 1 }]],
    hit: [['knock', { f: kf * P(z, .5), v: .5, d: .08 }], ['tone', { f: [[0, 140 * P(z, .3)], [.1, 50]], d: .16, v: .35, fix: 1 }], ['crk', { at: .003, dur: .05, dens: 200, v: .12, f: 2200, q: 1.2 }]],
    hv: [['knock', { f: kf * .6 * P(z, .5), v: .4, d: .12 }], ['tone', { f: [[0, 100], [.25, 36]], d: .3, v: .5, fix: 1 }]],
    sl: [['knock', { f: kf * .55, v: .7, d: .15 }], ['tone', { f: [[0, 95], [.5, 30]], d: .6, v: .9, fix: 1 }], ['grains', { at: .01, dur: .2, f: 1500, q: 1.8, v: .35, dt: [.002, .008], lp: 3500 }],
      ['crk', { at: .02, dur: .3, dens: [300, 30], v: .18, f: 2000, q: 1 }], ['noise', { buf: 'brown', lp: 350, d: .45, v: .5 }]],
    rv: { sw: .06, hit: .12, sl: .3 } }),
  // steel that rends: a gritty rasp in the swing, the blow a tearing scrape and a ring
  rasp: (z = 1) => ({ fl: FL.wet(),
    sw: [['noise', { buf: 'pink', f: [[0, 800 * P(z)], [.45, 2400 * P(z)], [1, 1000 * P(z)]], q: 1, lp: 6000, a: .45, d: .7, v: .5, shape: 'cos', pan: true }],
      ['noise', { buf: 'white', f: [[0, 2400 * P(z, .4)], [.5, 3800 * P(z, .4)], [1, 2600 * P(z, .4)]], q: 4, lp: 8000, a: .5, d: .5, v: .3, shape: 'cos', am: [70, .8, 'sawtooth'], pan: true }],
      ['noise', { buf: 'pink', f: [[0, 300], [.45, 700], [1, 330]], q: .8, a: .4, d: .7, v: .2 * z, shape: 'cos' }]],
    hit: [['noise', { buf: 'white', f: [[0, 3000], [.07, 4200]], q: 3, lp: 8000, a: .001, d: .08, v: .45, am: [110, .9, 'sawtooth'] }], ['ring', { at: .004, f: 1900 * P(z, .5), m: 'steel', d: .5 * z, v: .045 }],
      ['tone', { f: [[0, 140], [.1, 50]], d: .16, v: .4, fix: 1 }]],
    hv: [['noise', { at: .03, buf: 'white', f: [[0, 2600], [.12, 3800]], q: 3, lp: 7500, a: .005, d: .12, v: .3, am: [90, .9, 'sawtooth'] }], ['tone', { f: [[0, 110], [.22, 38]], d: .28, v: .5, fix: 1 }]],
    sl: [['noise', { buf: 'white', f: [[0, 2600], [.2, 4200]], q: 3, lp: 8000, a: .002, d: .22, v: .55, am: [95, .9, 'sawtooth'] }], ['ring', { f: 1300 * P(z, .4), m: 'steel', d: 1.1 * z, v: .08 }],
      ['tone', { f: [[0, 105], [.45, 32]], d: .55, v: .85, fix: 1 }], ['grains', { at: .01, dur: .15, f: 1300, q: 1.5, v: .35, lp: 4000 }], ['noise', { buf: 'brown', lp: 400, d: .4, v: .45 }]],
    rv: { sw: .07, hit: .14, sl: .3 } }),
  // thunder: a sub-heavy push of air you feel more than hear, a blow like a dropped boulder
  boom: (z = 1) => ({ fl: FL.dull(z), dk: 1.1,
    sw: [['tone', { f: [[0, 60], [.5, 95], [1, 50]], a: .5, d: .45, v: .3 * z, shape: 'cos', fix: 1 }],
      ['noise', { buf: 'brown', lp: [[0, 150], [.5, 700], [1, 160]], a: .5, d: .5, v: .9 * Math.sqrt(z), shape: 'cos', pan: true }],
      ['noise', { buf: 'pink', f: [[0, 260 * P(z, .4)], [.5, 800 * P(z, .4)], [1, 280 * P(z, .4)]], q: 1.2, a: .5, d: .45, v: .3, shape: 'cos', pan: true }]],
    hit: [['tone', { f: [[0, 90 * P(z, .2)], [.3, 30]], d: .4, v: .6, fix: 1 }], ['noise', { buf: 'white', hp: 2000, lp: 7000, a: .0004, d: .01, v: .35 }], ['noise', { buf: 'brown', lp: 700, d: .2, v: .5 }]],
    hv: [['tone', { f: [[0, 70], [.4, 26]], d: .5, v: .55, fix: 1 }], ['noise', { buf: 'brown', lp: 250, a: .01, d: .5, v: .35 }]],
    sl: [['tone', { f: [[0, 70], [.8, 25]], d: 1, v: 1, fix: 1 }], ['noise', { buf: 'white', hp: 1800, lp: 7000, a: .0004, d: .014, v: .5 }], ['noise', { buf: 'brown', lp: 220, a: .01, d: 1.1, v: .8, am: [7, .4] }],
      ['crk', { at: .05, dur: .6, dens: [90, 10], v: .2, f: 800, type: 'lowpass', q: .7 }], ['noise', { buf: 'brown', lp: 900, d: .25, v: .6 }]],
    rv: { sw: .08, hit: .16, sl: .4 } }),
  // two bronze bells: a silvery whoosh, and each blade's blow rings its own note (a fourth apart)
  bells: (z = 1) => ({ fl: FL.tight(), alt: 1.335,
    sw: [['noise', { buf: 'pink', f: [[0, 800], [.45, 2400], [1, 1000]], q: 1.2, lp: 6000, a: .45, d: .7, v: .5, shape: 'cos', pan: true }],
      ['noise', { buf: 'white', f: [[0, 2400], [.45, 3500], [1, 2600]], q: 16, lp: 7000, a: .45, d: .5, v: .4, shape: 'cos', pan: true }]],
    hit: [['noise', { buf: 'white', f: 4000, q: 1.2, a: .0005, d: .012, v: .3 }], ['ring', { at: .001, f: 1320, m: 'bell', d: .7, v: .05 }], ['ring', { at: .001, f: 1320 * 2.01, m: 'steel', d: .2, v: .012 }]],
    hv: [['tone', { f: [[0, 140], [.15, 48]], d: .2, v: .4, fix: 1 }], ['ring', { f: 660, m: 'bell', d: 1, v: .04 }]],
    sl: [['ring', { f: 660, m: 'bell', d: 1.6, v: .08 }], ['ring', { at: .03, f: 880, m: 'bell', d: 1.4, v: .06 }], ['noise', { buf: 'white', f: [[0, 5000], [.05, 1600]], q: 1.4, lp: 9000, a: .001, d: .06, v: .45 }],
      ['tone', { f: [[0, 110], [.35, 34]], d: .45, v: .65, fix: 1 }]],
    rv: { sw: .07, hit: .2, sl: .35 } }),
};
// a spear's thrust in each character: what goes forward (a hiss, a hum, a whip...), and the sweep is the character's swing
const THRUST = {
  steel: [['noise', { buf: 'white', f: [[0, 700], [.7, 3000], [1, 2600]], q: 2.5, lp: 6500, a: .7, d: .3, v: .55, shape: 'cos' }], ['noise', { buf: 'white', f: [[0, 1200], [.75, 3000], [1, 2600]], q: 12, lp: 8000, a: .72, d: .25, v: .45, shape: 'cos' }],
    ['tone', { f: [[0, 220], [1, 120]], a: .5, d: .5, v: .08, fix: 1 }]],
  wood: [['noise', { buf: 'pink', f: [[0, 260], [.7, 700], [1, 600]], q: 5, a: .7, d: .35, v: .9, shape: 'cos' }], ['noise', { buf: 'pink', f: [[0, 600], [.7, 1800], [1, 1500]], q: 1, a: .7, d: .35, v: .35, shape: 'cos' }],
    ['grains', { abs: 1, dur: .08, f: 750, q: 2.5, v: .1, dt: [.01, .025], swell: 1 }]],
  bronze: [['noise', { buf: 'pink', f: [[0, 500], [.7, 2000], [1, 1700]], q: 1.4, a: .7, d: .35, v: .6, shape: 'cos' }], ['noise', { buf: 'pink', f: [[0, 800], [.7, 1500], [1, 1400]], q: 9, a: .7, d: .3, v: .5, shape: 'cos' }],
    ['ring', { at: .75, f: 2100, m: 'bronze', d: .15, v: .01 }]],
  whip: [['noise', { buf: 'white', f: [[0, 800], [.6, 3400], [1, 2600]], q: 8, lp: 6500, a: .6, d: .2, v: .9, shape: 'cos' }], ['noise', { at: .6, buf: 'white', hp: 2500, lp: 8000, a: .002, d: .03, v: .07 }]],
  meaty: [['noise', { buf: 'pink', f: [[0, 280], [.7, 1200], [1, 1000]], q: 1, a: .7, d: .35, v: .75, shape: 'cos' }], ['noise', { buf: 'brown', lp: [[0, 250], [.7, 650], [1, 500]], a: .7, d: .3, v: .5, shape: 'cos' }],
    ['tone', { f: [[0, 100], [1, 60]], a: .6, d: .4, v: .12, fix: 1 }]],
};
// the spear's own blow: a tight puncture (with the character's bite on top)
const PIERCE = [['noise', { buf: 'white', f: [[0, 2600], [.03, 900]], q: 2.2, lp: 7000, a: .0008, d: .04, v: .4 }], ['tone', { f: [[0, 260], [.05, 90]], d: .07, v: .3, fix: 1 }]];
// the shield bash: the shove of the shield through the air, then the bash in its own character
const SHOVE = (k = 1, x = []) => [['noise', { buf: 'pink', f: [[0, 250 * k], [.5, 800 * k], [1, 300 * k]], q: .9, a: .5, d: .6, v: .6, shape: 'cos', pan: true }],
  ['noise', { buf: 'brown', lp: [[0, 200], [.5, 500], [1, 200]], a: .5, d: .5, v: .4, shape: 'cos' }], ...x];
const BASH = {
  bronze: { he: 'מגן ארד מהדהד', en: 'Bronze aspis boom', fl: FL.dull(1.2),
    sw: SHOVE(1, [['grains', { abs: 1, dur: .15, f: 850, q: 2.2, v: .08, dt: [.01, .025], swell: 1 }]]),
    hit: [['ring', { at: .001, f: 340, m: 'bronze', d: .8, v: .1 }], ['noise', { buf: 'pink', lp: 1600, a: .0008, d: .06, v: .5 }], ['tone', { f: [[0, 125], [.2, 44]], d: .22, v: .5, fix: 1 }]],
    hv: [['ring', { f: 230, m: 'bronze', d: 1.1, v: .07 }], ['tone', { f: [[0, 95], [.35, 32]], d: .4, v: .55, fix: 1 }]], rv: { sw: .06, hit: .25 } },
  wood: { he: 'לוח עץ', en: 'Wooden board thud', fl: FL.dull(1),
    sw: SHOVE(.9, [['grains', { abs: 1, dur: .12, f: 650, q: 2.6, v: .1, dt: [.012, .03], swell: 1 }]]),
    hit: [['knock', { f: 230, v: .6, d: .12 }], ['noise', { buf: 'pink', f: 800, q: 1, a: .001, d: .05, v: .45 }], ['tone', { f: [[0, 120], [.18, 42]], d: .2, v: .45, fix: 1 }]],
    hv: [['knock', { f: 170, v: .45, d: .16 }], ['crk', { at: .005, dur: .15, dens: [350, 40], v: .2, f: 2000, q: 1 }]], rv: { sw: .05, hit: .14 } },
  iron: { he: 'שפת ברזל מקרקשת', en: 'Iron rim clang', fl: FL.std(1.2),
    sw: SHOVE(1.1, [['ring', { at: .45, f: 1500, m: 'iron', d: .08, v: .012 }]]),
    hit: [['ring', { at: .001, f: 900, m: 'iron', d: .35, v: .13 }], ['noise', { buf: 'white', f: 2600, q: 2, a: .0006, d: .035, v: .45 }], ['tone', { f: [[0, 140], [.12, 50]], d: .18, v: .45, fix: 1 }]],
    hv: [['ring', { f: 560, m: 'iron', d: .5, v: .08 }], ['tone', { f: [[0, 100], [.3, 34]], d: .35, v: .5, fix: 1 }]], rv: { sw: .06, hit: .22 } },
  shove: { he: 'דחיפה עמומה', en: 'Dull meaty shove', fl: FL.meaty(1.3),
    sw: SHOVE(.8),
    hit: [['tone', { f: [[0, 100], [.2, 38]], d: .28, v: .6, fix: 1 }], ['noise', { buf: 'brown', lp: 650, a: .001, d: .1, v: .7 }], ['noise', { buf: 'pink', f: 500, q: 1, a: .001, d: .06, v: .4 }]],
    hv: [['tone', { f: [[0, 80], [.35, 28]], d: .45, v: .6, fix: 1 }], ['noise', { buf: 'brown', lp: 300, a: .005, d: .35, v: .4 }]], rv: { sw: .04, hit: .1 } },
  leather: { he: 'עור וריסוק', en: 'Leather slap and crunch', fl: FL.tight(),
    sw: SHOVE(1, [['grains', { abs: 1, dur: .2, f: 1000, q: 1.6, v: .09, dt: [.006, .018], swell: 1 }]]),
    hit: [['noise', { buf: 'white', f: 1300, q: .8, lp: 6000, a: .0005, d: .03, v: .5 }], ['grains', { at: .002, dur: .07, f: 1100, q: 1.5, v: .3, dt: [.003, .008], lp: 4500 }],
      ['grains', { at: .01, dur: .1, f: 1900, q: 2.2, v: .35, dt: [.002, .006], lp: 4500 }], ['tone', { f: [[0, 130], [.12, 46]], d: .17, v: .45, fix: 1 }]],
    hv: [['crk', { at: .01, dur: .18, dens: [500, 60], v: .25, f: 1600, q: 1 }], ['tone', { f: [[0, 95], [.3, 32]], d: .35, v: .5, fix: 1 }]], rv: { sw: .05, hit: .12 } },
};

// ---------------------------------------------------------------- the five candidates of each weapon type
const S = (ch, he, en, x = {}) => ({ ...ch, he, en, ...x });
const spear = (ch, th, he, en, x) => { const c = S(ch, he, en, x); c.th = THRUST[th]; c.hit = [...PIERCE, ...c.hit.map(([n, p]) => [n, { ...p, v: (p.v ?? .3) * .7 }])]; return c; };
export const WEAPON_SOUND_VARIANTS = {
  shield: { 1: BASH.bronze, 2: BASH.wood, 3: BASH.iron, 4: BASH.shove, 5: BASH.leather },
  sword1: {
    1: S(CH.steel(1), 'שינג פלדה חד', 'Crisp steel shing'),
    2: S(CH.razor(1), 'חתך תער נקי', 'Clean razor slice'),
    3: S(CH.bronze(1, 900), 'ארד מצלצל', 'Bronze ring'),
    4: S(CH.meaty(.9), 'להב כבד ובשרני', 'Heavy meaty blade'),
    5: S(CH.whip(1), 'שוט אוויר מהיר', 'Fast air whip'),
  },
  axe1: {
    1: S(CH.meaty(1.1), 'קיצוץ בשרני', 'Meaty chop'),
    2: S(CH.clank(1.1), 'ראש ברזל מקרקש', 'Iron head clank'),
    3: S(CH.thud(1.05), 'חבטה עמומה וריסוק', 'Dull thud and crunch'),
    4: S(CH.bronze(1.15, 700), 'נשיכת לאבריס מארד', 'Bronze labrys bite'),
    5: S(CH.wood(1.05, 520), 'קת עץ וטפיחה יבשה', 'Wooden haft, dry thwack'),
  },
  sword2: {
    1: S(CH.steel(1.45), 'פלדה ארוכה שרה', 'Long singing steel'),
    2: S(CH.rasp(1.4), 'פלדה קורעת', 'Rending steel rasp'),
    3: S(CH.meaty(1.45), 'ביקוע כבד', 'Heavy cleave'),
    4: S(CH.bronze(1.45, 760), 'להב ארד גדול', 'Great bronze blade'),
    5: S(CH.boom(1.35), 'רעם עמוק', 'Deep thunder'),
  },
  axe2: {
    1: S(CH.thud(1.6), 'מבקע אדמה', 'Earth-splitter thud'),
    2: S(CH.meaty(1.65), 'קיצוץ התליין', "Executioner's chop"),
    3: S(CH.clank(1.6), 'ברזל מבקע', 'Iron cleaver clank'),
    4: S(CH.boom(1.6), 'רעם וסלעים', 'Thunder and rubble'),
    5: S(CH.whip(1.7), 'סערה מסתחררת', 'Whirling storm'),
  },
  spear2: {
    1: spear(CH.steel(1.1), 'steel', 'שריקת דקירה', 'Piercing steel hiss'),
    2: spear(CH.wood(1.2, 380), 'wood', 'מוט אשור מזמזם', 'Humming ash shaft'),
    3: spear(CH.bronze(1.1, 1000), 'bronze', 'חוד ארד', 'Bronze dory tip'),
    4: spear(CH.whip(1.1), 'whip', 'דקירת שוט', 'Whip-crack thrust'),
    5: spear(CH.meaty(1.2), 'meaty', 'שיפוד כבד', 'Heavy skewer'),
  },
  dualSword: {
    1: S(CH.steel(.8), 'שינג כפול', 'Twin steel shing'),
    2: S(CH.razor(.8), 'לחישת תערים', 'Razor whisper'),
    3: S(CH.bells(.8), 'פעמוני ארד', 'Bronze bells'),
    4: S(CH.rasp(.8), 'מספריים של פלדה', 'Steel scissors scrape'),
    5: S(CH.whip(.8), 'מטח שוטים', 'Whip flurry'),
  },
  dualAxe: {
    1: S(CH.meaty(.9), 'קיצוץ כפול', 'Double meaty chop'),
    2: S(CH.wood(.9, 560), 'גרזיני עץ יבשים', 'Dry hatchet thwacks'),
    3: S(CH.bronze(.95, 820), 'נשיכה כפולה בארד', 'Twin bronze bite'),
    4: S(CH.thud(.95), 'סכיני ריסוק', 'Crunching cleavers'),
    5: S(CH.clank(.9), 'ברזל מקרקש', 'Clanking iron hatchets'),
  },
};
// each candidate's level for its swing, its charged release, its blow and its slam: matched (tools/weapon-sounds.html, its loudness check) to
// the game's own sound for that type, so a pick changes the character and not how loud a fight is
export const CAL = {
  shield: { 1: { sw: 1.24, ch: 1.02, hit: 0.95, sl: 0.48 }, 2: { sw: 1.5, ch: 1.95, hit: 1.07, sl: 2.99 }, 3: { sw: 1.3, ch: 0.95, hit: 3.37, sl: 0.92 }, 4: { sw: 1.43, ch: 1, hit: 1.76, sl: 0.5 }, 5: { sw: 1.26, ch: 0.77, hit: 3.5, sl: 0.41 } },
  sword1: { 1: { sw: 1.37, ch: 1.43, hit: 1.58, sl: 2.13 }, 2: { sw: 2.08, ch: 2.19, hit: 1.76, sl: 2.5 }, 3: { sw: 2.23, ch: 2.05, hit: 0.68, sl: 0.69 }, 4: { sw: 0.74, ch: 0.72, hit: 0.32, sl: 1.39 }, 5: { sw: 1.45, ch: 1.56, hit: 3.5, sl: 1.85 } },
  axe1: { 1: { sw: 0.62, ch: 0.6, hit: 0.25, sl: 1.33 }, 2: { sw: 2.72, ch: 2.19, hit: 0.71, sl: 0.38 }, 3: { sw: 0.48, ch: 0.44, hit: 0.19, sl: 0.92 }, 4: { sw: 2.87, ch: 2.19, hit: 0.63, sl: 0.33 }, 5: { sw: 2.48, ch: 1.79, hit: 2.17, sl: 0.19 } },
  sword2: { 1: { sw: 1.92, ch: 1.03, hit: 3.5, sl: 0.12 }, 2: { sw: 2.27, ch: 1.13, hit: 3.5, sl: 0.12 }, 3: { sw: 0.56, ch: 0.56, hit: 3.5, sl: 0.88 }, 4: { sw: 3.14, ch: 1.11, hit: 2.79, sl: 0.12 }, 5: { sw: 0.28, ch: 0.27, hit: 0.77, sl: 0.41 } },
  axe2: { 1: { sw: 0.42, ch: 0.39, hit: 3.5, sl: 0.46 }, 2: { sw: 0.59, ch: 0.47, hit: 3.5, sl: 0.26 }, 3: { sw: 3.56, ch: 1.38, hit: 3.5, sl: 0.12 }, 4: { sw: 0.26, ch: 0.25, hit: 1.3, sl: 0.53 }, 5: { sw: 2.12, ch: 1.58, hit: 3.5, sl: 0.33 } },
  spear2: { 1: { sw: 1.4, ch: 1.46, hit: 1.88, sl: 1.7 }, 2: { sw: 3.75, ch: 2.15, hit: 0.9, sl: 0.12 }, 3: { sw: 2.65, ch: 1.86, hit: 1.63, sl: 0.22 }, 4: { sw: 2.06, ch: 1.89, hit: 3.5, sl: 0.69 }, 5: { sw: 1.04, ch: 1.01, hit: 0.51, sl: 1.01 } },
  dualSword: { 1: { sw: 1.4, ch: 1.46, hit: 1.65, sl: 1.98 }, 2: { sw: 1.74, ch: 1.91, hit: 3.5, sl: 3.59 }, 3: { sw: 1.97, ch: 1.98, hit: 2.26, sl: 1.54 }, 4: { sw: 1.78, ch: 1.79, hit: 1.77, sl: 1.19 }, 5: { sw: 1.22, ch: 1.32, hit: 3.47, sl: 2.15 } },
  dualAxe: { 1: { sw: 0.77, ch: 0.74, hit: 0.24, sl: 1.12 }, 2: { sw: 2.92, ch: 2.23, hit: 1.54, sl: 0.25 }, 3: { sw: 2.32, ch: 2.08, hit: 0.54, sl: 0.54 }, 4: { sw: 0.52, ch: 0.46, hit: 0.18, sl: 0.81 }, 5: { sw: 2.8, ch: 2.46, hit: 0.66, sl: 0.59 } },
};
const lv = (type, n, key) => (CAL[type] && CAL[type][n] && CAL[type][n][key]) || 1;

// ---------------------------------------------------------------- the sfx defs
const STYLE_OF = { sword1: 'blade', axe1: 'blade', sword2: 'twohand', axe2: 'twohand', spear2: 'polearm', dualSword: 'dual', dualAxe: 'dual' };
const SWING_SFX = { blade: ['wh_blade'], twohand: ['wh_twohand'], polearm: ['wh_polearm', 'wh_spear'], dual: ['wh_dual'] };
const HIT_SFX = { blade: ['hit_blade'], twohand: ['hit_twohand'], polearm: ['hit_polearm', 'hit_spear'], dual: ['hit_dual'] };
const BASE = { blade: .19, twohand: .4, polearm: .4, dual: .12, shield: .3 }; // a swing's length at speed 1 (s)
const CHARGE = { blade: .42, twohand: .75, polearm: .5, dual: .36 };
const QUIET = { gap: 0, f() {} };
const cache = new Map();
function defs(type, n) {
  const key = type + n; if (cache.has(key)) return cache.get(key);
  const V = WEAPON_SOUND_VARIANTS[type] && WEAPON_SOUND_VARIANTS[type][n]; if (!V) return null;
  const st = type === 'shield' ? 'shield' : STYLE_OF[type], rv = V.rv || {};
  const body = (A, t, o, k, v) => {
    if (o.mat && o.mat !== 'flesh' && LIB.MAT[o.mat]) LIB.MAT[o.mat](A, t, (o.heavy ? 1.15 : 1) * v, k);
    else play(A, t, V.fl, { k, v: v * (o.heavy ? 1.15 : 1) });
    if (o.el && LIB.ELEM[o.el]) LIB.ELEM[o.el](A, t + .01, .9 * v);
  };
  const D = {
    sw: { rv: rv.sw ?? .06, gap: .04, f(A, t, o) {
      const s = o.step | 0, sp = clamp(o.sp || 1, .5, 2.4), g = lv(type, n, 'sw'); let k = rnd(.94, 1.06);
      if (st === 'dual') {
        const both = s >= 3, d = (both ? .2 : BASE.dual) * (V.dk || 1) / sp, w = both ? .025 : .06 / sp, sd = s % 2 ? -1 : 1;
        play(A, t, V.sw, { k, sc: d, v: g, pan: [-.35 * sd, .35 * sd] });
        play(A, t + w, V.sw, { k: k * .86, sc: d, v: g * .85, pan: [.35 * sd, -.1 * sd] });
      } else if (st === 'polearm' && s !== 2 && V.th) play(A, t, V.th, { k, sc: .14 * (V.dk || 1) / sp, v: g, pan0: 0 });
      else {
        const big = s === 2 && st !== 'shield', d = BASE[st] * (V.dk || 1) * (big ? 1.4 : 1) / sp, p = s % 2 ? -.35 : .35;
        play(A, t, V.sw, { k: k * (big ? .86 : 1), sc: d, v: g * (big ? 1.1 : 1), pan: [p, -p] });
      }
    } },
    ch: { rv: (rv.sw ?? .06) + .1, gap: .1, f(A, t) {
      const d = (CHARGE[st] || .42) * (V.dk || 1), g = lv(type, n, 'ch');
      play(A, t, V.sw, { k: .8, sc: d, v: g * 1.15, pan: [.3, -.3] });
      play(A, t, [['tone', { f: [[0, 85], [1, 45]], a: .4, d: .6, v: .22, shape: 'cos', fix: 1 }]], { sc: d, v: g });
    } },
    hit: { rv: rv.hit ?? .12, gap: .025, f(A, t, o) {
      const g = lv(type, n, 'hit'); let k = rnd(.93, 1.07);
      if (V.alt) { A._wAlt = !A._wAlt; if (A._wAlt) k *= V.alt; } // the pair's other blade rings its own note
      body(A, t, o, k, g); play(A, t, V.hit, { k, v: g });
      if (o.heavy) play(A, t, V.hv, { k, v: g });
    } },
    sl: { rv: rv.sl ?? .3, gap: .1, f(A, t) { play(A, t, V.sl || V.hv, { k: rnd(.96, 1.04), v: lv(type, n, 'sl') }); } },
  };
  cache.set(key, D); return D;
}
// audio.js sfxPlay: the def that plays in place of sfx `name` (null: the game's own). o: the sfx opts (o.wc: the weapon type in her hand)
export function weaponSoundDef(name, o, A) {
  if (name === 'hit_bash' || (name === 'wh_blade' && (o.step | 0) === 2 && A.offShield)) {
    const D = defs('shield', A.weaponSoundOf('shield'));
    if (D) return name === 'hit_bash' ? (o.mat ? D.hit : null) : D.sw; // (a hit_bash with no body is a foe's bash on V: not hers)
    if (name === 'hit_bash') return null;
  }
  const st = STYLE_OF[o.wc]; if (!st) return null;
  const D = defs(o.wc, A.weaponSoundOf(o.wc)); if (!D) return null;
  if (name === 'wc_miss') return QUIET; // a set's swing carries its own tail
  if (name === 'wh_charge') return D.ch;
  if (name === 'charge_slam') return D.sl;
  if (SWING_SFX[st].includes(name)) return D.sw;
  if (HIT_SFX[st].includes(name)) return D.hit;
  return null;
}
// the candidates' names for a picker: {type: [{n, he, en}]}
export const weaponSoundNames = () => Object.fromEntries(Object.entries(WEAPON_SOUND_VARIANTS).map(([k, V]) => [k, Object.entries(V).map(([n, v]) => ({ n: +n, he: v.he, en: v.en }))]));
