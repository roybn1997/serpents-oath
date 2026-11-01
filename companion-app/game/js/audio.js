// The Serpent's Oath audio engine. WebAudio only: every sound is synthesized at runtime.
// Instruments: Karplus-Strong lyre / kithara (rendered once per pitch and cached), an aulos reed
// lead (one persistent voice per channel), pads and an "aah" choir, a frame-drum + tambourine kit
// (rendered at init), a generated-impulse convolution reverb, ambience loops and one-shot sfx.
// Every public method is a silent no-op before init() and for unknown names.

import { buildMusic } from './music.js';
import { WEAPON_AUDIO, WEAPON_SOUND_PICK } from './audiodata.js';
import * as AD from './audiodata.js'; // (round 33b: AD.MUSIC_SET, read live)
import { weaponSoundDef, setBodyLib } from './weaponsfx.js';
// round 33b (Roy's approved package): every town, landmark, land and realm its own theme (songs33.js), and the towns'
// murmur as a real recording (crowdrec.js). audiodata.js MUSIC_SET picks between these and our own round-33 score
import { SONGS33, townTheme, townVariant, REGION_OF, hasTheme } from './songs33.js';
import { CROWD_MP3, CROWD_LEN } from './crowdrec.js';
export { REGION_OF, hasTheme };

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const nz = () => Math.random() * 2 - 1;
function midiOf(n) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) return null;
  return 12 * (parseInt(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
// "E4:2 r:4 A3+C4+E4:8" -> notes [{step,len,m:[midi..],f}], chords joined with '+'
function parseMel(str) {
  const out = []; let step = 0;
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok) continue;
    const [n, l] = tok.split(':'); const len = parseInt(l || '1');
    if (n !== 'r') {
      const ms = n.split('+').map(midiOf).filter((x) => x != null);
      if (ms.length) out.push({ step, len, m: ms, f: mtof(ms[0]) });
    }
    step += len;
  }
  return { notes: out, length: step };
}
const rep = (s, n) => Array(n).fill(s).join(' ');
const V = (s) => s.split(' ');
const arp = (vo, pat, len = 2) => pat.map((i) => `${vo[i]}:${len}`).join(' ');
const hits = (len, map) => { const a = Array(len).fill('.'); for (const k in map) a[+k] = map[k]; return a.join(''); };

// ---------------- songs ----------------
// Channel fields: w = instrument (lyre | kith | aulos | pad | choir | legacy pulse12/25/50, triangle, saw),
// v = level, m = melody (16 steps per 4/4 bar), d = drum string (k doum, s tek, h jingle, t tambourine,
// b big drum, c finger cymbals, r clappers; uppercase = accent). Each channel loops on its own length.
// lyre/kith: ring (s after note end), strum, sub (sustaining triangle under it), poly.
// aulos: cut (lowpass Hz), vib (vibrato depth multiplier). pad/choir: cut, att, rel.
// Song: bpm, rev (reverb send multiplier).
const OD = (() => {
  const VO = { D: V('D3 A3 D4 F#4'), C: V('C3 G3 C4 E4'), G: V('D3 G3 B3 D4'), Am: V('E3 A3 C4 E4'), Em: V('E3 B3 E4 G4'), A: V('E3 A3 C#4 E4') };
  const BASS = { D: 'D2:8 A2:8', C: 'C2:8 G2:8', G: 'G2:8 D2:8', Am: 'A2:8 E2:8', Em: 'E2:8 B2:8', A: 'A2:8 E2:8' };
  const PAD = { D: 'D4+F#4+A4', C: 'C4+E4+G4', G: 'B3+D4+G4', Am: 'A3+C4+E4', Em: 'B3+E4+G4', A: 'A3+C#4+E4' };
  const A1 = ['D', 'C', 'G', 'D', 'D', 'C', 'Am', 'D'], A2 = ['D', 'C', 'G', 'D', 'D', 'C', 'G', 'D'], B = ['G', 'D', 'C', 'D', 'G', 'Em', 'A', 'A'];
  const prog = [...A1, ...A2, ...B, ...A1];
  const arps = prog.map((c, i) => (i >= 16 && i < 24 ? arp(VO[c], [0, 2, 1, 3], 4) : arp(VO[c], [0, 1, 2, 3, 2, 1, 2, 3]))).join(' ');
  const mel7 = 'A4:6 F#4:2 G4:4 A4:4 B4:4 C5:4 B4:2 A4:2 G4:4 A4:6 G4:2 F#4:4 E4:4 F#4:8 D4:4 r:4 A4:6 F#4:2 G4:4 A4:4 C5:4 E5:4 D5:2 C5:2 B4:4 A4:4 C5:2 B4:2 A4:4 G4:4';
  const melA2 = 'D5:6 C5:2 B4:4 A4:4 G4:4 E4:4 G4:2 A4:2 C5:4 B4:6 A4:2 G4:4 B4:4 A4:8 F#4:4 r:4 F#4:2 G4:2 A4:4 D5:4 C5:4 E5:6 D5:2 C5:4 B4:4 D5:4 B4:2 A4:2 G4:4 B4:4 A4:4 G4:2 F#4:2 D4:8';
  const lyreB = 'B4:2 D5:2 G5:4 F#5:2 E5:2 D5:4 A4:2 D5:2 F#5:4 E5:2 D5:2 A4:4 G4:2 C5:2 E5:4 D5:2 C5:2 G4:4 F#4:2 A4:2 D5:8 r:4 B4:2 D5:2 G5:4 A5:2 G5:2 F#5:2 E5:2 E5:4 G5:4 F#5:2 E5:2 B4:4 C#5:4 E5:4 D5:2 C#5:2 A4:4 E5:8 C#5:4 r:4';
  const sparse = 'k.......s.......', p1 = 'k.....h.s...h...', p2 = 'k.....h.s...h.h.', pj = 'k.h.h.h.s.h.h.h.', fill = 'k.....h.s.s.sss.';
  const drums = [...Array(7).fill(sparse), 'k.......s...s.s.', p1, p1, p1, p2, p1, p1, p1, p2, pj, pj, pj, fill, pj, pj, pj, fill, p1, p1, p1, p2, p1, p1, p2, fill].join('');
  return { bpm: 84, rev: .9, ch: [
    { w: 'aulos', v: .15, cut: 3400, pan: -.1, m: `${mel7} A4:12 r:4 ${melA2} r:64 D5:16 B4:16 C#5:16 A4:8 r:8 ${mel7} F#4:4 E4:2 F#4:2 D4:8` },
    { w: 'lyre', v: .34, pan: .15, ring: .6, m: `r:256 ${lyreB} r:128` },
    { w: 'lyre', v: .2, pan: .25, ring: .5, m: arps },
    { w: 'kith', v: .42, sub: .1, ring: 1, m: prog.map((c) => BASS[c]).join(' ') },
    { w: 'pad', v: .045, cut: 1500, att: .8, rel: 1.2, m: 'r:128 ' + prog.slice(8).map((c) => PAD[c] + ':16').join(' ') },
    { d: drums, v: .5 },
  ] };
})();

const SEA = (() => {
  const A = ['Dm', 'C', 'Dm', 'Am', 'Dm', 'C', 'Bb', 'A'], B = ['F', 'C', 'Dm', 'Am', 'Bb', 'F', 'Gm', 'A'];
  const prog = [...A, ...B, ...A];
  const VO = { Dm: V('D3 A3 D4 F4'), C: V('C3 G3 C4 E4'), Am: V('A2 E3 A3 C4'), Bb: V('Bb2 F3 Bb3 D4'), A: V('A2 E3 A3 C#4'), F: V('F2 C3 F3 A3'), Gm: V('G2 D3 G3 Bb3') };
  const BASS = { Dm: 'D2:6 A2:6', C: 'C2:6 G2:6', Am: 'A1:6 E2:6', Bb: 'Bb1:6 F2:6', A: 'A1:6 E2:6', F: 'F2:6 C2:6', Gm: 'G2:6 D2:6' };
  const PAD = { Dm: 'D4+F4+A4', C: 'C4+E4+G4', Am: 'A3+C4+E4', Bb: 'Bb3+D4+F4', A: 'A3+C#4+E4', F: 'A3+C4+F4', Gm: 'Bb3+D4+G4' };
  const melA = 'A4:4 D5:2 F5:4 E5:2 E5:4 D5:2 C5:4 G4:2 A4:4 F4:2 D4:4 E4:2 C5:6 A4:6 A4:4 D5:2 F5:4 G5:2 E5:4 G5:2 E5:4 C5:2 D5:4 C5:2 Bb4:4 A4:2';
  const melB = 'C5:4 A4:2 F4:4 A4:2 G4:4 C5:2 E5:4 C5:2 D5:4 F5:2 A5:4 F5:2 E5:6 C5:6 D5:4 F5:2 Bb5:4 A5:2 A5:4 G5:2 F5:4 C5:2 Bb4:4 D5:2 G5:4 F5:2 E5:6 C#5:6';
  const pA = 'k...h.s...h.', pB = 'k.h.h.s.h.h.', f6 = 'k.h.h.s.s.ss';
  return { bpm: 100, rev: .9, ch: [
    { w: 'aulos', v: .14, cut: 3000, pan: -.1, m: `${melA} A4:12 ${melB} ${melA} C#5:4 D5:2 E5:6` },
    { w: 'lyre', v: .2, pan: .2, ring: .5, m: prog.map((c) => arp(VO[c], [0, 1, 2, 3, 2, 1])).join(' ') },
    { w: 'kith', v: .4, sub: .1, ring: .8, m: prog.map((c) => BASS[c]).join(' ') },
    { w: 'pad', v: .04, cut: 1300, att: .8, rel: 1, m: 'r:96 ' + prog.slice(8).map((c) => PAD[c] + ':12').join(' ') },
    { d: rep(pA, 7) .replace(/ /g, '') + f6 + rep(pB, 7).replace(/ /g, '') + f6 + rep(pA, 7).replace(/ /g, '') + f6, v: .45 },
  ] };
})();

const TOWN = (() => {
  // kalamatianos dance in 7/8 (3+2+2 eighths = 14 steps per bar)
  const A = ['G', 'G', 'C', 'G', 'D', 'C', 'G', 'D'], B = ['Em', 'Em', 'C', 'D', 'Em', 'Am', 'D', 'G'];
  const prog = [...A, ...B, ...A];
  const BASS = { G: 'G2:6 D2:4 G2:4', C: 'C3:6 G2:4 C3:4', D: 'D2:6 A2:4 D2:4', Em: 'E2:6 B2:4 E2:4', Am: 'A2:6 E2:4 A2:4' };
  const CH = { G: 'B3+D4+G4', C: 'C4+E4+G4', D: 'A3+D4+F#4', Em: 'B3+E4+G4', Am: 'A3+C4+E4' };
  const melA = 'D5:4 B4:2 G4:2 A4:2 B4:2 C5:2 D5:4 G5:2 F#5:2 E5:2 D5:4 E5:4 C5:2 E5:2 G5:2 E5:2 C5:2 D5:4 B4:2 A4:2 G4:2 B4:4 A4:4 D5:2 C5:2 B4:2 A4:2 F#4:2 G4:4 E4:2 G4:2 C5:2 B4:2 A4:2 B4:4 D5:2 B4:2 G4:2 A4:2 B4:2 A4:6 F#4:4 D4:4';
  const melB = 'B4:4 E5:2 D5:2 E5:2 G5:2 E5:2 F#5:4 E5:2 D5:2 B4:2 D5:4 E5:4 C5:2 B4:2 A4:2 G4:2 A4:2 F#4:4 A4:2 D5:2 C5:2 A4:4 G4:4 B4:2 E5:2 D5:2 B4:2 G4:2 A4:4 C5:2 E5:2 D5:2 C5:2 A4:2 B4:4 A4:2 F#4:2 E4:2 F#4:2 A4:2 G4:6 D4:4 G4:4';
  const p7 = 'k.h.h.s.h.s.h.', f7 = 'k.h.h.s.s.s.ss', pr = 'k.r.h.s.r.s.h.';
  return { bpm: 112, rev: .5, ch: [
    { w: 'aulos', v: .15, cut: 4000, pan: -.15, m: `${melA} ${melB} r:112` },
    { w: 'lyre', v: .3, pan: .2, ring: .35, m: `r:224 ${melA}` },
    { w: 'lyre', v: .17, pan: .25, ring: .12, strum: .016, m: prog.map((c) => `r:6 ${CH[c]}:4 ${CH[c]}:4`).join(' ') },
    { w: 'kith', v: .45, ring: .2, m: prog.map((c) => BASS[c]).join(' ') },
    { d: p7.repeat(7) + f7 + pr.repeat(7) + f7 + p7.repeat(7) + f7, v: .55 },
  ] };
})();

const DANGER = (() => {
  const prog = ['E', 'E', 'E', 'E', 'F', 'F', 'E', 'E', 'D', 'C', 'D', 'E', 'E', 'F', 'E', 'E'];
  const OST = { E: 'E2:1 E2:1 B2:1 E2:1 E2:1 C3:1 E2:1 B2:1', F: 'F2:1 F2:1 C3:1 F2:1 F2:1 D3:1 F2:1 C3:1', D: 'D2:1 D2:1 A2:1 D2:1 D2:1 Bb2:1 D2:1 A2:1', C: 'C2:1 C2:1 G2:1 C2:1 C2:1 A2:1 C2:1 G2:1' };
  const PAD = { E: 'E3+B3+G4', F: 'F3+C4+A4', D: 'D3+A3+F4', C: 'C3+G3+E4' }; // round 22: E-F and F-G# clashes out of the pad
  const mel = 'r:32 E5:2 r:2 E5:2 F5:2 E5:4 r:4 E5:2 r:2 E5:2 G#5:2 F5:4 E5:4 F5:6 E5:2 D5:4 C5:4 B4:8 C5:4 D5:4 E5:12 r:4 G#4:2 A4:2 B4:2 C5:2 D5:2 E5:2 F5:2 G#5:2 A5:8 F5:4 D5:4 E5:8 C5:4 A4:4 F5:6 E5:2 D5:4 F5:4 E5:16 B4:2 C5:2 B4:2 G#4:2 E4:8 F4:2 G#4:2 A4:2 B4:2 C5:8 B4:4 G#4:4 F4:4 E4:4 E4:2 r:2 E4:2 r:2 E5:4 r:4';
  const bb = 'b..k..k.s...k.s.', q1 = 'K..k..k.s...k.s.', q2 = 'K..k..k.s..kk.ss';
  return { bpm: 132, rev: .5, ch: [
    { w: 'aulos', v: .15, cut: 4200, pan: -.1, m: mel },
    { w: 'kith', v: .4, ring: .06, poly: 6, m: prog.map((c) => rep(OST[c], 2)).join(' ') },
    { w: 'pad', v: .05, cut: 1200, att: .3, rel: .6, m: prog.map((c) => PAD[c] + ':16').join(' ') },
    { d: (bb + q1 + q1 + q2).repeat(4), v: .65 },
    { d: 'h.h.h.h.h.h.h.h.'.repeat(16), v: .18 },
  ] };
})();

// round 18: the underworld in a spooky metal dress, all 8-bit: a sawtooth chug in E phrygian with the flat-two and a
// tritone, a pulse-wave lead with vibrato, a ghostly choir, a gallop kick and backbeat snare (16 steps to a bar)
const UNDERMETAL = (() => {
  const chug = 'E2:2 E2:2 E2:2 E2:1 F2:1 E2:2 E2:2 E2:4 E2:2 E2:2 E2:2 E2:1 F2:1 E2:2 Bb1:2 B1:4';
  const lead = 'r:2 E5:2 F5:2 E5:4 D5:2 C5:2 r:2 Bb4:4 A4:4 G#4:2 A4:2 B4:4 E5:2 F5:2 E5:2 Bb4:2 C5:4 r:4 D5:2 Eb5:2 E5:4 r:2 B4:2 r:4';
  const gallop = 'k.k.s.k.k.k.s.kk', hats = 'h.h.h.h.h.h.h.h.', crash = 'c' + '.'.repeat(127);
  return { bpm: 140, rev: .6, ch: [
    { w: 'saw', v: .07, cut: 1800, m: rep(chug, 8) },
    { w: 'pulse12', v: .085, vib: 1.2, pan: .15, m: rep(lead, 4) },
    { w: 'choir', v: .035, att: 3, rel: 3, m: 'E3+B3+G4:64 F3+A3+C4:64 D3+A3+F4:64 E3+B3+G4:64' }, // round 22: plain triads (the chug keeps its tritone)
    { d: gallop.repeat(16), v: .62 },
    { d: hats.repeat(16), v: .14 },
    { d: crash.repeat(2), v: .5 },
  ] };
})();

const BOSS = (() => {
  const prog = ['D', 'D', 'D', 'D', 'Eb', 'Eb', 'D', 'D', 'Gm', 'Gm', 'Eb', 'D', 'Gm', 'Eb', 'D', 'D'];
  const OST = { D: 'D2:1 D2:1 A2:1 D2:1 D2:1 Eb2:1 D2:1 A2:1', Eb: 'Eb2:1 Eb2:1 Bb2:1 Eb2:1 Eb2:1 F2:1 Eb2:1 Bb2:1', Gm: 'G2:1 G2:1 D3:1 G2:1 G2:1 A2:1 G2:1 D3:1' };
  const PAD = { D: 'D3+F#3+A3', Eb: 'Eb3+G3+Bb3', Gm: 'G3+Bb3+D4' };
  const mel = 'r:32 D5:2 Eb5:2 F#5:4 G5:2 F#5:2 Eb5:4 D5:2 Eb5:2 F#5:2 A5:2 G5:4 F#5:4 G5:6 F#5:2 Eb5:4 D5:4 C5:4 Bb4:4 C5:4 Eb5:4 D5:12 Eb5:2 D5:2 C5:2 Bb4:2 A4:2 G4:2 F#4:2 Eb4:2 D4:4 G4:4 Bb4:4 D5:4 G5:4 F#5:4 G5:4 A5:4 Bb5:4 G5:6 F#5:2 Eb5:8 D5:4 F#5:4 A5:8 Bb5:6 A5:2 G5:4 F#5:4 G5:4 Eb5:4 C5:4 Bb4:4 A4:4 Bb4:2 C5:2 D5:4 Eb5:4 D5:8 r:8';
  const low = 'r:128 G3:4 Bb3:4 D4:4 G4:4 F#4:4 G4:4 A4:4 Bb4:4 G4:6 F#4:2 Eb4:8 D4:4 F#4:4 A4:8 Bb4:6 A4:2 G4:4 F#4:4 G4:4 Eb4:4 C4:4 Bb3:4 A3:4 Bb3:2 C4:2 D4:4 Eb4:4 D4:8 r:8';
  const pb = 'b.k.s.k.b.k.s.kk', px = 'b.k.s.k.b.kks.ss';
  const d2 = 'h.h.h.h.h.h.h.h.'.repeat(16).split(''); d2[0] = 'c'; d2[128] = 'c';
  return { bpm: 152, rev: .5, ch: [
    { w: 'aulos', v: .14, cut: 4500, pan: -.1, m: mel },
    { w: 'lyre', v: .2, pan: .2, ring: .2, m: low },
    { w: 'kith', v: .36, ring: .05, poly: 6, m: prog.map((c) => rep(OST[c], 2)).join(' ') },
    { w: 'pad', v: .05, cut: 1600, att: .2, rel: .5, m: prog.map((c) => PAD[c] + ':16').join(' ') },
    { d: (pb + pb + pb + px).repeat(4), v: .55 },
    { d: d2.join(''), v: .25 },
  ] };
})();

const OLYMPUS = (() => {
  const prog = ['D', 'A', 'Bm', 'G', 'D', 'F#m', 'G', 'A', 'G', 'D', 'Em', 'A', 'Bm', 'G', 'E', 'A'];
  const VO = { D: V('D3 A3 D4 F#4 A4'), A: V('C#3 E3 A3 C#4 E4'), Bm: V('B2 F#3 B3 D4 F#4'), G: V('G2 D3 G3 B3 D4'), 'F#m': V('F#2 C#3 F#3 A3 C#4'), Em: V('E3 B3 E4 G4 B4'), E: V('E3 B3 E4 G#4 B4') };
  const CHO = { D: 'D4+F#4+A4', A: 'C#4+E4+A4', Bm: 'B3+D4+F#4', G: 'B3+D4+G4', 'F#m': 'A3+C#4+F#4', Em: 'B3+E4+G4', E: 'B3+E4+G#4' };
  const mel = 'F#4:8 A4:4 D5:4 C#5:8 B4:4 A4:4 B4:6 C#5:2 D5:4 F#5:4 G5:8 F#5:4 E5:4 F#5:6 E5:2 D5:4 A4:4 C#5:8 A4:4 F#4:4 B4:6 A4:2 G4:4 B4:4 A4:12 r:4 D5:6 E5:2 F#5:4 G5:4 A5:8 F#5:4 D5:4 E5:6 F#5:2 G5:4 B5:4 A5:8 G5:4 E5:4 F#5:6 E5:2 D5:4 B4:4 D5:6 E5:2 B4:8 G#5:8 F#5:4 E5:4 E5:12 r:4';
  return { bpm: 70, rev: 1.5, ch: [
    { w: 'aulos', v: .14, cut: 3400, pan: -.1, m: mel },
    { w: 'lyre', v: .22, pan: .2, ring: .8, m: prog.map((c) => arp(VO[c], [0, 1, 2, 3, 4, 3, 2, 1])).join(' ') },
    { w: 'choir', v: .06, att: .6, rel: 1.2, m: prog.map((c) => CHO[c] + ':16').join(' ') },
    { w: 'kith', v: .45, sub: .2, ring: 1.5, m: 'D2:16 C#2:16 B1:16 G1:16 D2:16 F#1:16 G1:16 A1:16 G1:16 D2:16 E2:16 A1:16 B1:16 G1:16 E2:16 A1:16' },
    { d: 'b.......k.......'.repeat(15) + 'b.......k...k.k.', v: .55 },
    { d: hits(256, { 0: 'c', 128: 'c' }), v: .35 },
  ] };
})();

// ---- battle themes, one per monster family (picked by battleSong below; elites keep 'boss') ----
// a variation of a theme: o.tr transposes it (semitones), o.bpm / o.rev; o.ch {index: overrides, or null to drop}; o.add: more channels
const vary = (base, o) => ({ bpm: o.bpm || base.bpm, rev: o.rev ?? base.rev, battle: true, tr: (base.tr || 0) + (o.tr || 0),
  ch: [...base.ch.map((c, i) => (o.ch && i in o.ch ? o.ch[i] && { ...c, ...o.ch[i] } : { ...c })).filter(Boolean), ...(o.add || [])] });
const BATTLE = (() => {
  const per = (prog, map) => prog.map((c) => map[c]).join(' ');
  const S = {};
  // beasts (wolves, hounds, boars): the hunt. E phrygian in a galloping 12/8, kithara ostinato, pounding frame drums
  {
    const prog = ['Em', 'F', 'Em', 'D', 'Em', 'F', 'G', 'F'];
    const OST = { Em: 'E2:2 E2:1 B2:1 E2:2 E2:1 F2:1 E2:2 D2:2', F: 'F2:2 F2:1 C3:1 F2:2 F2:1 G2:1 F2:2 E2:2', D: 'D2:2 D2:1 A2:1 D2:2 D2:1 E2:1 D2:2 C2:2', G: 'G2:2 G2:1 D3:1 G2:2 G2:1 A2:1 G2:2 F2:2' };
    const PAD = { Em: 'E3+B3:12', F: 'F3+C4:12', D: 'D3+A3:12', G: 'G3+D4:12' };
    const mel = 'E5:3 F5:1 G5:2 F5:3 E5:3 F5:3 G5:1 A5:2 G5:2 F5:2 E5:2 E5:2 B4:2 C5:2 B4:3 A4:3 D5:6 C5:3 B4:3 E5:3 G5:1 B5:2 A5:3 G5:3 A5:3 G5:1 F5:2 E5:3 F5:3 G5:2 F5:2 E5:2 D5:3 B4:3 C5:3 B4:3 E5:6';
    S.b_beast = { bpm: 150, rev: .45, battle: true, ch: [
      { w: 'aulos', v: .15, cut: 3800, pan: -.1, m: mel },
      { w: 'kith', v: .42, ring: .1, poly: 6, m: per(prog, OST) },
      { w: 'pad', v: .045, cut: 900, att: .2, rel: .4, m: per(prog, PAD) },
      { d: 'K..k..s.kk.s'.repeat(7) + 'K..k..s.ssss', v: .65 },
      { d: 'h.hh.hh.hh.h'.repeat(8), v: .18 },
    ] };
  }
  // harpies and fliers: talons. shrill aulos high over a fluttering lyre, tambourine, A hijaz at a run
  {
    const prog = ['A', 'A', 'Bb', 'A', 'A', 'G', 'Bb', 'A'];
    const OST = { A: 'A2:1 A2:1 E3:1 A2:1 C#3:1 A2:1 E3:1 A2:1', Bb: 'Bb2:1 Bb2:1 F3:1 Bb2:1 D3:1 Bb2:1 F3:1 Bb2:1', G: 'G2:1 G2:1 D3:1 G2:1 B2:1 G2:1 D3:1 G2:1' };
    const mel = 'A5:2 Bb5:2 C#6:4 Bb5:2 A5:2 G5:4 A5:4 F5:2 E5:2 F5:4 E5:4 D5:2 E5:2 F5:4 G5:2 F5:2 E5:4 C#5:4 E5:4 A5:8 E6:2 D6:2 C#6:4 Bb5:2 A5:2 Bb5:4 G5:2 F5:2 E5:4 D5:4 B4:4 D5:2 F5:2 Bb5:4 A5:2 G5:2 F5:4 E5:4 C#5:4 A4:8';
    S.b_wing = { bpm: 160, rev: .5, battle: true, ch: [
      { w: 'aulos', v: .14, cut: 5000, vib: .6, pan: -.15, m: mel },
      { w: 'lyre', v: .1, pan: .3, ring: .05, m: rep('A5:1 E5:1 C#6:1 E5:1', 32) },
      { w: 'kith', v: .36, ring: .05, poly: 6, m: prog.map((c) => OST[c] + ' ' + OST[c]).join(' ') },
      { d: 'k.t.s.t.k.t.s.tt'.repeat(7) + 'k.t.s.t.s.s.ssss', v: .55 },
    ] };
  }
  // serpents: the charmer's tune. D hijaz, maqsum rhythm, a wavering aulos over a drone
  {
    const prog = ['D', 'D', 'Gm', 'D', 'Eb', 'D', 'Gm', 'D'];
    const OST = { D: 'D2:6 A2:2 D2:4 Eb2:4', Gm: 'G2:6 D3:2 G2:4 A2:4', Eb: 'Eb2:6 Bb2:2 Eb2:4 D2:4' };
    const mel = 'A4:4 Bb4:2 A4:2 F#4:4 G4:2 F#4:2 Eb4:2 F#4:2 D4:12 G4:2 A4:2 Bb4:4 C5:2 Bb4:2 A4:4 Bb4:2 A4:2 G4:2 F#4:2 Eb4:4 D4:4 D5:4 Eb5:2 D5:2 C5:4 Bb4:2 C5:2 D5:2 C5:2 Bb4:2 A4:2 Bb4:4 A4:4 G4:2 Bb4:2 D5:4 C5:2 Bb4:2 A4:4 F#4:4 Eb4:2 F#4:2 D4:8';
    S.b_serpent = { bpm: 104, rev: .7, battle: true, ch: [
      { w: 'aulos', v: .15, cut: 3200, vib: 1.7, pan: -.1, m: mel },
      { w: 'lyre', v: .14, pan: .25, ring: .4, m: rep('r:4 A4:2 r:2 D5:2 r:6', 8) },
      { w: 'kith', v: .42, sub: .1, ring: .5, m: per(prog, OST) },
      { w: 'pad', v: .05, cut: 800, att: .5, rel: .8, m: 'D3+A3:32 G3+D4:16 D3+A3:16 Eb3+Bb3:16 D3+A3:16 G3+D4:16 D3+A3:16' },
      { d: 'k.s...s.k...s.h.'.repeat(7) + 'k.s.s.s.k.k.sss.', v: .6 },
    ] };
  }
  // the dead (skeletons, shades, lost souls): bone clappers, a cold choir, C minor sliding to diminished
  {
    const prog = ['C', 'C', 'Ab', 'B', 'C', 'C', 'Ab', 'B'];
    const OST = { C: 'C2:4 r:4 C2:2 r:2 G1:4', Ab: 'Ab1:4 r:4 Ab1:2 r:2 Eb2:4', B: 'B1:4 r:4 B1:2 r:2 D2:4' };
    const mel = 'G4:4 Ab4:4 G4:4 Eb4:4 F4:4 Eb4:4 C4:8 C5:4 Bb4:2 Ab4:2 G4:4 Ab4:4 B4:8 D5:4 F5:4 G5:4 F5:2 Eb5:2 D5:4 C5:4 Eb5:4 D5:2 C5:2 G4:8 Ab4:4 C5:4 Eb5:4 D5:4 C5:8 B4:8';
    S.b_undead = { bpm: 96, rev: 1.1, battle: true, ch: [
      { w: 'aulos', v: .13, cut: 1900, vib: 1.4, pan: -.1, m: mel },
      { w: 'choir', v: .05, att: .4, rel: .8, m: rep('C4+Eb4+G4:16 C4+Eb4+Ab4:16 Ab3+C4+Eb4:16 B3+D4+G4:16', 2) }, // round 22: no diminished chords
      { w: 'kith', v: .45, ring: .6, sub: .12, m: per(prog, OST) },
      { w: 'lyre', v: .12, pan: .3, ring: 1.5, m: rep('r:12 C6:4', 4) + ' ' + rep('r:12 G5:4', 4) },
      { d: 'b...r.r.k...r.rr'.repeat(7) + 'b...r.r.k.r.rrrr', v: .6 },
    ] };
  }
  // stone soldiers and other armoured things: a march. G minor, big drum and cymbals, horn-like aulos
  {
    const prog = ['Gm', 'Gm', 'Eb', 'F', 'Gm', 'Eb', 'D', 'D'];
    const OST = { Gm: 'G2:2 G2:2 D3:2 G2:2 G2:2 G2:2 Bb2:2 A2:2', Eb: 'Eb2:2 Eb2:2 Bb2:2 Eb2:2 Eb2:2 Eb2:2 G2:2 F2:2', F: 'F2:2 F2:2 C3:2 F2:2 F2:2 F2:2 A2:2 G2:2', D: 'D2:2 D2:2 A2:2 D2:2 D2:2 D2:2 F#2:2 E2:2' };
    const mel = 'G4:6 D5:2 D5:4 Bb4:4 C5:4 Bb4:2 A4:2 G4:8 Eb5:6 D5:2 C5:4 Bb4:4 A4:4 C5:4 F5:8 G5:6 F5:2 D5:4 Bb4:4 Eb5:4 D5:2 C5:2 G5:8 F#5:4 E5:2 D5:2 A4:4 C5:4 D5:8 F#4:8';
    S.b_stone = { bpm: 108, rev: .6, battle: true, ch: [
      { w: 'aulos', v: .15, cut: 3000, pan: -.1, m: mel },
      { w: 'kith', v: .42, ring: .15, poly: 6, m: per(prog, OST) },
      { w: 'pad', v: .045, cut: 1100, att: .3, rel: .6, m: 'G3+Bb3+D4:32 Eb3+G3+Bb3:16 F3+A3+C4:16 G3+Bb3+D4:16 Eb3+G3+Bb3:16 D3+F#3+A3:32' },
      { d: 'b...k...b...k.k.'.repeat(7) + 'b...k...b.k.ssss', v: .65 },
      { d: hits(128, { 0: 'c', 64: 'c' }), v: .3 },
    ] };
  }
  // giants (cyclops): slow and crushing. F minor, the big drum, a low growling aulos
  {
    const prog = ['Fm', 'Fm', 'Db', 'Eb', 'Fm', 'Db', 'C', 'C'];
    const OST = { Fm: 'F1:6 F1:2 C2:8', Db: 'Db2:6 Db2:2 Ab1:8', Eb: 'Eb2:6 Eb2:2 Bb1:8', C: 'C2:6 C2:2 G1:8' };
    const mel = 'C4:8 Ab3:4 F3:4 G3:4 Ab3:4 Bb3:4 C4:4 Db4:8 C4:4 Bb3:4 Eb4:8 G3:8 F4:8 Eb4:4 C4:4 Db4:4 C4:4 Bb3:4 Ab3:4 G3:8 E3:4 G3:4 C4:16';
    S.b_giant = { bpm: 80, rev: .8, battle: true, ch: [
      { w: 'aulos', v: .15, cut: 1800, vib: .8, pan: -.1, m: mel },
      { w: 'kith', v: .5, ring: .8, sub: .2, m: per(prog, OST) },
      { w: 'pad', v: .07, cut: 700, att: .4, rel: .8, m: 'F2+C3+Ab3:32 Db3+Ab3:16 Eb3+Bb3:16 F2+C3+Ab3:16 Db3+Ab3:16 C3+E3+G3:32' },
      { d: 'b.......b..k....'.repeat(7) + 'b.......b.b.b.bb', v: .75 },
      { d: hits(128, { 0: 'c', 64: 'c' }), v: .3 },
    ] };
  }
  // satyrs and centaurs: a wild revel in 7/8. A dorian, strummed lyre, tambourine
  {
    const prog = ['Am', 'G', 'Am', 'D', 'Am', 'G', 'Em', 'Am'];
    const BASS = { Am: 'A2:6 E2:4 A2:4', G: 'G2:6 D2:4 G2:4', D: 'D2:6 A2:4 D2:4', Em: 'E2:6 B2:4 E2:4' };
    const CH = { Am: 'A3+C4+E4', G: 'G3+B3+D4', D: 'F#3+A3+D4', Em: 'G3+B3+E4' };
    const mel = 'E5:2 D5:2 C5:2 B4:2 C5:2 D5:4 B4:4 A4:2 G4:4 B4:4 A4:2 C5:2 E5:2 F#5:2 E5:2 D5:2 C5:2 D5:6 F#5:4 A5:4 G5:2 F#5:2 E5:2 D5:2 E5:2 C5:4 D5:2 B4:2 G4:2 A4:2 B4:2 D5:4 E5:6 G5:4 B4:4 A4:10 r:4';
    S.b_wild = { bpm: 138, rev: .45, battle: true, ch: [
      { w: 'aulos', v: .15, cut: 4200, pan: -.15, m: mel },
      { w: 'lyre', v: .17, pan: .25, ring: .1, strum: .014, m: prog.map((c) => `r:6 ${CH[c]}:4 ${CH[c]}:4`).join(' ') },
      { w: 'kith', v: .44, ring: .15, m: per(prog, BASS) },
      { d: 'k.t.h.s.t.s.h.'.repeat(7) + 'k.t.h.s.s.s.ss', v: .55 },
    ] };
  }
  // crabs and scorpions: clattering pincers. B minor, clappers, staccato lyre lead
  {
    const prog = ['Bm', 'Bm', 'G', 'A', 'Bm', 'G', 'F#', 'F#'];
    const OST = { Bm: 'B1:1 r:1 B1:1 r:1 F#2:1 r:1 B1:1 D2:1', G: 'G1:1 r:1 G1:1 r:1 D2:1 r:1 G1:1 B1:1', A: 'A1:1 r:1 A1:1 r:1 E2:1 r:1 A1:1 C#2:1', 'F#': 'F#1:1 r:1 F#1:1 r:1 C#2:1 r:1 F#1:1 A#1:1' };
    const mel = 'B4:2 D5:2 F#5:2 D5:2 B4:2 C#5:2 D5:4 E5:2 D5:2 C#5:2 B4:2 A#4:4 B4:4 G5:2 F#5:2 E5:2 D5:2 B4:4 D5:4 C#5:2 E5:2 A5:4 G5:2 F#5:2 E5:4 F#5:2 B5:2 A5:2 F#5:2 D5:2 E5:2 F#5:4 G5:4 E5:2 D5:2 B4:4 G4:4 F#4:2 A#4:2 C#5:2 E5:2 F#5:4 C#5:4 A#4:4 C#5:4 F#5:8';
    S.b_shell = { bpm: 128, rev: .45, battle: true, ch: [
      { w: 'lyre', v: .3, pan: .15, ring: .08, m: mel },
      { w: 'aulos', v: .1, cut: 2600, pan: -.2, m: 'D5:16 B4:16 D5:16 C#5:16 D5:16 B4:16 A#4:32' },
      { w: 'kith', v: .4, ring: .05, poly: 6, m: prog.map((c) => OST[c] + ' ' + OST[c]).join(' ') },
      { d: 'k.r.s.rrk.r.s.r.'.repeat(7) + 'k.r.s.rrk.s.ssss', v: .6 },
    ] };
  }
  // ---- round 15 (Roy: every monster type has its own music): the types within a family get their own variation of
  // its theme (key, tempo, lead line, groove). Melodies are written in the family's key; `tr` moves the whole song.
  const choirOf = (m) => ({ w: 'choir', v: .05, att: .4, rel: .8, m });
  // black hounds: a growling low line a half step down, faster, bone clappers in the gallop
  S.b_hound = vary(S.b_beast, { tr: -1, bpm: 158, ch: {
    0: { cut: 2800, vib: 1.3, m: 'B4:2 B4:1 C5:1 B4:2 G4:3 E4:3 F4:2 A4:1 C5:1 F5:4 E5:2 C5:2 B4:3 G4:3 E4:2 F4:1 G4:1 B4:2 A4:4 F4:2 D4:6 E5:2 E5:1 F5:1 E5:2 D5:2 B4:2 G4:2 A4:2 C5:2 F5:2 E5:2 F5:2 A5:2 G5:3 F5:1 E5:2 D5:3 B4:3 C5:2 B4:2 A4:2 F4:3 E4:3' },
    3: { d: 'K.rk..s.kr.s'.repeat(7) + 'K.rk.rs.ssss' } } });
  // boars: heavy stomping, low and slow, the big drum on the beat
  S.b_boar = vary(S.b_beast, { tr: -3, bpm: 132, ch: {
    0: { cut: 2200, m: 'E4:3 E4:3 G4:2 F4:2 E4:2 F4:3 F4:3 A4:2 G4:2 F4:2 E4:2 G4:2 B4:4 A4:2 G4:2 F4:3 E4:3 D4:6 B4:3 B4:3 C5:2 B4:2 A4:2 C5:3 A4:3 F4:2 G4:2 A4:2 B4:3 D5:3 B4:2 A4:2 G4:2 A4:4 G4:2 F4:3 E4:3' },
    3: { d: 'b..k..s.b.k.'.repeat(7) + 'b..k..s.b.bb' }, 4: null } });
  // shades: a cold choir sings the line, no clappers, slower and wider
  S.b_shade = vary(S.b_undead, { tr: 2, bpm: 84, rev: 1.4, ch: {
    0: { w: 'choir', v: .08, att: .35, rel: .9, m: 'C4:8 Eb4:8 D4:4 C4:4 G3:8 Ab3:8 C4:4 Eb4:4 D4:12 B3:4 C4:4 G4:4 Eb4:4 D4:4 C4:8 Bb3:4 G3:4 Ab3:4 C4:4 F4:8 D4:8 B3:8' },
    1: { v: .035 }, 4: { d: 'b.......k.......'.repeat(8), v: .45 } } });
  // lost souls: a high wailing reed over soft jingles
  S.b_soul = vary(S.b_undead, { tr: 3, bpm: 100, ch: {
    0: { cut: 2600, vib: 2.2, m: 'Eb5:6 D5:2 C5:8 G5:4 F5:2 Eb5:2 D5:8 C5:4 Eb5:4 Ab5:6 G5:2 F5:8 D5:8 G5:6 Ab5:2 G5:4 Eb5:4 F5:4 Eb5:4 D5:4 C5:4 Ab4:4 C5:4 Eb5:4 F5:4 D5:12 B4:4' },
    4: { d: 'h...h...k...h...'.repeat(8), v: .4 } } });
  // the Mormo: a tritone away, slow, almost silent between the strokes of the big drum
  S.b_mormo = vary(S.b_undead, { tr: 6, bpm: 72, rev: 1.5, ch: {
    0: { cut: 1600, vib: 2, v: .11, m: 'r:16 G5:12 r:4 r:16 F5:8 Eb5:8 r:16 G5:12 F5:4 B4:16 r:16' },
    4: { d: 'b...........k...'.repeat(8), v: .55 } } });
  // mimics: the march turned sly, a plucked staccato lead and clappers
  S.b_mimic = vary(S.b_stone, { tr: 1, bpm: 118, ch: {
    0: { w: 'lyre', v: .28, ring: .06, pan: .1, m: 'G4:2 Bb4:2 D5:2 Bb4:2 G4:2 r:2 D5:2 Eb5:2 D5:2 C5:2 Bb4:2 A4:2 G4:4 r:4 Eb5:2 G5:2 Bb5:2 G5:2 Eb5:2 r:2 Bb4:2 G4:2 F5:2 A5:2 C6:2 A5:2 F5:4 r:4 G5:2 F5:2 D5:2 Bb4:2 G4:2 A4:2 Bb4:2 D5:2 Eb5:4 r:2 Bb4:2 G4:4 r:4 F#4:2 A4:2 D5:2 F#5:2 A5:4 F#5:4 D5:2 r:2 A4:2 r:2 F#4:8' },
    3: { d: 'k.r.s.r.k.rrs.r.'.repeat(7) + 'k.r.s.r.k.s.ssss' } } });
  // centaurs: the revel at a gallop, a step higher, its own tune
  S.b_centaur = vary(S.b_wild, { tr: 2, bpm: 152, ch: {
    0: { m: 'A4:2 C5:2 E5:4 D5:2 C5:2 B4:2 D5:4 B4:2 G4:2 A4:2 B4:2 D5:2 E5:2 A5:2 G5:2 E5:2 D5:2 C5:2 E5:2 F#5:6 E5:2 D5:2 A4:4 C5:2 E5:2 A5:4 G5:2 E5:2 C5:2 B4:2 D5:2 G5:4 F#5:2 E5:2 D5:2 E5:4 G5:2 B5:2 A5:2 G5:2 E5:2 A5:6 E5:2 C5:2 A4:4' },
    3: { d: 'k.kk.k.s.kk.s.'.repeat(7) + 'k.kk.k.s.s.sss' } } });
  // scorpions: the desert. A reed sings a phrygian line, the lyre keeps the long notes
  S.b_scorpion = vary(S.b_shell, { tr: -2, bpm: 116, ch: {
    0: { w: 'aulos', v: .14, cut: 3000, vib: 1.5, pan: -.1, m: 'B4:4 C5:2 B4:2 F#5:4 E5:2 D5:2 C5:2 B4:2 A4:2 B4:2 D5:8 G5:4 F#5:2 E5:2 D5:4 C5:2 B4:2 C#5:4 E5:4 A4:8 F#5:4 G5:2 F#5:2 E5:2 D5:2 C5:2 B4:2 D5:4 B4:2 G4:2 B4:4 D5:4 C#5:4 A#4:4 F#4:4 A#4:4 C#5:2 E5:2 C#5:2 A#4:2 F#4:8' },
    1: { w: 'lyre', v: .12, ring: .6, pan: .2 }, 3: { d: 'k...s.r.k.k.s.r.'.repeat(7) + 'k...s.r.k.s.ssss' } } });
  // the five giants: their base monster's theme, lower, slower and heavier, with a choir
  S.b_erymanthos = vary(S.b_boar, { tr: -2, bpm: 116, rev: .8, add: [choirOf('E3+G3+B3:12 F3+A3+C4:12 E3+G3+B3:12 D3+F#3+A3:12 E3+G3+B3:12 F3+A3+C4:12 G3+B3+D4:12 F3+A3+C4:12')] });
  S.b_lykaon = vary(S.b_beast, { tr: -5, bpm: 138, rev: .7, ch: { 3: { d: 'B..k..b.kk.s'.repeat(7) + 'B..k..b.ssss' } },
    add: [choirOf('E3+G3+B3:12 F3+A3+C4:12 E3+G3+B3:12 D3+F#3+A3:12 E3+G3+B3:12 F3+A3+C4:12 G3+B3+D4:12 F3+A3+C4:12')] });
  S.b_polyphemos = vary(S.b_giant, { tr: -2, bpm: 70, rev: 1, add: [choirOf('F3+Ab3+C4:32 Db3+F3+Ab3:16 Eb3+G3+Bb3:16 F3+Ab3+C4:16 Db3+F3+Ab3:16 C3+E3+G3:32')] });
  S.b_talos = vary(S.b_stone, { tr: 2, bpm: 100, rev: .8, ch: { 4: { d: hits(128, { 0: 'c', 32: 'c', 64: 'c', 96: 'c' }) } },
    add: [{ w: 'lyre', v: .12, ring: .8, pan: .3, m: S.b_stone.ch[0].m }] }); // bronze: a bell-like lyre doubles the march
  S.b_colossus = vary(S.b_stone, { tr: -3, bpm: 84, rev: 1, ch: { 3: { d: 'b.......b...k...'.repeat(7) + 'b.......b.b.bbbb', v: .7 } },
    add: [choirOf('G3+Bb3+D4:32 Eb3+G3+Bb3:16 F3+A3+C4:16 G3+Bb3+D4:16 Eb3+G3+Bb3:16 D3+F#3+A3:32')] });
  return S;
})();
// which battle theme each monster type calls up (round 15: one per type). Bosses keep 'boss'; a type not listed here
// (a new monster) gets a variation made for it from the family its traits suggest (themeOf).
export const BATTLE_OF = {
  wolf: 'b_beast', hound: 'b_hound', boar: 'b_boar',
  harpy: 'b_wing',
  serpent: 'b_serpent',
  skeleton: 'b_undead', shade: 'b_shade', lostsoul: 'b_soul', mormo: 'b_mormo',
  stoneSoldier: 'b_stone', mimic: 'b_mimic',
  cyclops: 'b_giant',
  satyr: 'b_wild', centaur: 'b_centaur',
  crab: 'b_shell', scorpion: 'b_scorpion',
  giant_erymanthos: 'b_erymanthos', giant_lykaon: 'b_lykaon', giant_polyphemos: 'b_polyphemos', giant_talos: 'b_talos', giant_colossus: 'b_colossus',
  kampe: 'boss', hadesLord: 'boss',
};
// types other modules add to BATTLE_OF (underfoes.js, isle_foes.js) name a family theme: they get their own variation of it
const OWN = new Set(Object.keys(BATTLE_OF));
export function themeOf(type, T = {}) {
  const set = BATTLE_OF[type];
  if (set && (OWN.has(type) || set === 'boss' || set.startsWith('t_') || !SONGS[set] || !SONGS[set].battle)) return set;
  const r = T.ranged && T.ranged.kind, base = T.giant && T.giant.base;
  const fam = set || (base && BATTLE_OF[base]) ? set || BATTLE_OF[base] : T.flying ? 'b_wing' : r === 'wisp' || /shade|soul|ghost|wraith|spirit|dead|bone/i.test(type) ? 'b_undead'
    : T.swims ? 'b_serpent' : T.heavy || (T.hp || 0) >= 120 ? 'b_giant' : T.quad || T.leap || T.charge ? 'b_beast' : r === 'arrow' || r === 'rock' ? 'b_wild' : 'b_stone';
  let h = 7; for (const ch of String(type)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const key = 't_' + type, F = SONGS[fam];
  SONGS[key] = prepSong(vary(F, { tr: [-3, -2, -1, 1, 2, 3, 4][h % 7], bpm: Math.round(F.bpm * (.9 + (h >>> 3) % 5 * .05)) }));
  return (BATTLE_OF[type] = key);
}
// the fight's theme is the strongest type present (Roy): each engaged foe weighs maxHp x damage (its level and elite
// boost included) and a type counts its strongest one. A theme holds 4 s at least while its type is still in the
// fight (unless one twice as strong arrives), then yields to a type 15% stronger, so it doesn't flip between near-equal packs.
const BSEL = { song: null, at: -1e9 };
export function battleSong(foes, pos, now) {
  const score = {};
  for (const e of foes) {
    if (e.animal) continue;
    const k = themeOf(e.type, e.T || {}), v = (e.maxHp || 40) * (e.dmg || (e.T && e.T.dmg) || 10);
    if (!(score[k] >= v)) score[k] = v;
  }
  let best = null, bs = -1;
  for (const k in score) if (score[k] > bs) { bs = score[k]; best = k; }
  const cur = BSEL.song;
  if (cur && score[cur] && ((now - BSEL.at < 4 && bs < score[cur] * 2) || score[cur] * 1.15 >= bs)) return cur;
  if (best && best !== cur) { BSEL.song = best; BSEL.at = now; }
  return best || 'danger';
}

// title theme: D minor, a quiet intro on lyre and choir, then the aulos sings the oath (20 bars, ~63 s loop)
const THEME = (() => {
  const VO = { Dm: V('D3 A3 D4 F4'), Bb: V('Bb2 F3 Bb3 D4'), C: V('C3 G3 C4 E4'), Gm: V('G2 D3 G3 Bb3'), A: V('A2 E3 A3 C#4'), F: V('F2 C3 F3 A3') };
  const BASS = { Dm: 'D2:8 A2:8', Bb: 'Bb1:8 F2:8', C: 'C2:8 G2:8', Gm: 'G1:8 D2:8', A: 'A1:8 E2:8', F: 'F2:8 C2:8' };
  const CHO = { Dm: 'D4+F4+A4', Bb: 'Bb3+D4+F4', C: 'C4+E4+G4', Gm: 'Bb3+D4+G4', A: 'A3+C#4+E4', F: 'A3+C4+F4' };
  const intro = ['Dm', 'Bb', 'Gm', 'A'], A = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Bb', 'Gm', 'A'], B = ['F', 'C', 'Dm', 'Bb', 'Gm', 'Dm', 'Bb', 'A'];
  const prog = [...intro, ...A, ...B];
  const melA = 'A4:6 D5:2 F5:4 E5:4 D5:4 C5:2 D5:2 A4:8 Bb4:6 C5:2 D5:4 F5:4 E5:8 D5:4 C5:4 A4:6 D5:2 F5:4 A5:4 G5:6 F5:2 E5:4 D5:4 Bb4:4 D5:4 G5:4 F5:4 E5:12 r:4';
  const melB = 'C5:4 F5:4 A5:6 G5:2 G5:4 E5:4 C5:8 D5:4 F5:4 A5:4 D6:4 C6:6 Bb5:2 A5:4 F5:4 G5:6 A5:2 Bb5:4 G5:4 F5:6 E5:2 D5:4 A4:4 Bb4:4 D5:4 F5:4 E5:2 D5:2 C#5:8 E5:4 r:4';
  const soft = 'k...............', pA = 'k.....h.s.......', pB = 'k.....h.s...h.h.', fl = 'k.....h.s.s.s.ss';
  const drums = [soft, soft, soft, 'k.......k...s.s.', pA, pA, pA, pA, pA, pA, pA, fl, pB, pB, pB, pB, pB, pB, pB, fl].join('');
  return { bpm: 76, rev: 1.4, ch: [
    { w: 'aulos', v: .14, cut: 3200, vib: 1.2, pan: -.1, m: `r:64 ${melA} ${melB}` },
    { w: 'lyre', v: .2, pan: .2, ring: .7, m: `r:192 ${melB}` },
    { w: 'lyre', v: .2, pan: .25, ring: .6, m: prog.map((c) => arp(VO[c], [0, 1, 2, 3, 2, 1, 2, 3])).join(' ') },
    { w: 'kith', v: .42, sub: .16, ring: 1.4, m: prog.map((c) => BASS[c]).join(' ') },
    { w: 'choir', v: .055, att: 1, rel: 1.5, m: prog.map((c) => CHO[c] + ':16').join(' ') },
    { d: drums, v: .4 },
    { d: hits(320, { 0: 'c', 64: 'c', 192: 'c' }), v: .3 },
  ] };
})();

export const SONGS = {
  // ----- story songs (melodies kept, re-voiced) -----
  title: { bpm: 84, rev: 1.1, ch: [
    { w: 'aulos', v: .15, cut: 3400, m: 'E4:4 F4:2 G#4:2 A4:6 G#4:2 F4:4 E4:4 r:4 B4:4 C5:2 B4:2 A4:4 G#4:4 F4:2 G#4:2 E4:8 r:8' },
    { w: 'kith', v: .45, sub: .16, ring: 1.2, m: 'E2:8 E2:8 F2:8 F2:8 D2:8 D2:8 E2:16' },
    { w: 'lyre', v: .2, pan: .2, ring: .5, m: rep('E4:2 G#4:2 B4:2 G#4:2', 2) + ' ' + rep('F4:2 A4:2 C5:2 A4:2', 2) + ' ' + rep('D4:2 F4:2 A4:2 F4:2', 2) + ' ' + rep('E4:2 G#4:2 B4:2 D5:2', 2) },
    { d: 'k...............k.......k.......k...............k.......k...h...', v: .5 },
  ] },
  village: { bpm: 76, rev: 1, ch: [
    { w: 'aulos', v: .14, cut: 3200, m: 'A4:4 C5:4 B4:2 A4:2 G4:4 E4:8 r:8 G4:4 A4:2 B4:2 C5:4 B4:4 A4:12 r:4' },
    { w: 'kith', v: .45, sub: .18, ring: 1.5, m: 'A2:16 F2:16 C3:16 E2:16' },
    { w: 'lyre', v: .2, pan: .2, ring: .5, m: rep('A3:2 E4:2 A4:2 E4:2', 2) + ' ' + rep('F3:2 C4:2 F4:2 C4:2', 2) + ' ' + rep('C3:2 G3:2 C4:2 G3:2', 2) + ' ' + rep('E3:2 B3:2 E4:2 G#3:2', 2) },
  ] },
  dread: { bpm: 120, rev: 1.2, ch: [
    { w: 'lyre', v: .3, ring: 1.5, m: 'r:12 F5:1 r:3 r:12 E5:1 r:3' },
    { w: 'kith', v: .5, ring: .25, m: 'E2:2 r:2 F2:2 r:2 E2:2 r:6 E2:2 r:2 F2:2 r:2 A#1:4 r:4' },
    { w: 'pad', v: .08, cut: 700, att: .6, rel: .8, m: 'E3:16 F3:16' },
    { d: 'k...k...k...k..sk...k...k...kkss', v: .6 },
  ] },
  // round 24 (Roy: the opening's sound didn't fit; dark music, with thunder): the night sky over Olympus. Low drones
  // a semitone apart (D against Eb), a low choir that never resolves, slow kithara strokes in the bass, far drums
  omen: { bpm: 60, rev: 1.9, ch: [
    { w: 'pad', v: .1, cut: 480, att: .7, rel: 2.5, m: 'D2+A2:32 Eb2+Bb2:16 D2+A2:16' },
    { w: 'choir', v: .045, att: 1.2, rel: 2, m: 'D3+F3:24 r:8 Db3+E3:16 r:16' },
    { w: 'kith', v: .5, sub: .3, ring: 3, m: 'D2:12 r:4 D2:4 Eb2:4 r:8 D2:16 r:8 Eb2:4 D2:4' },
    { w: 'pad', v: .03, cut: 900, att: 2, rel: 2, m: 'r:16 G#3:16 r:16 A3:16' },
    { d: hits(64, { 0: 'b', 12: 'b', 32: 'b', 40: 'k', 44: 'b' }), v: .55 },
  ] },
  temple: { bpm: 66, rev: 1.6, ch: [
    { w: 'aulos', v: .14, cut: 3000, vib: 1.3, m: 'D5:6 C#5:2 A4:8 Bb4:4 A4:2 G4:2 F4:8 E4:4 F4:4 G4:4 A4:4 C#5:8 D5:8' },
    { w: 'kith', v: .45, sub: .18, ring: 1.5, m: 'D2:16 Bb1:16 G2:16 A2:16' },
    { w: 'lyre', v: .2, pan: .2, ring: .6, m: rep('D4:2 F4:2 A4:2 F4:2', 2) + ' ' + rep('Bb3:2 D4:2 F4:2 D4:2', 2) + ' ' + rep('G3:2 Bb3:2 D4:2 Bb3:2', 2) + ' ' + rep('A3:2 C#4:2 E4:2 C#4:2', 2) },
  ] },
  battle: { bpm: 142, rev: .5, ch: [
    { w: 'aulos', v: .15, cut: 4200, m: 'E4:2 F4:2 G#4:2 B4:4 A4:2 G#4:2 F4:2 E4:4 r:2 E4:1 F4:1 G#4:2 A4:2 B4:4 C5:2 B4:2 A4:2 G#4:4 F4:2 G#4:2 A4:2 B4:6 A4:2 G#4:4 F4:2 E4:2' },
    { w: 'kith', v: .45, ring: .12, poly: 6, m: rep('E2:2 E2:1 E3:1 E2:2 F2:2 E2:2 E2:1 E3:1 G#2:2 F2:2', 3) + ' D2:2 D2:1 D3:1 D2:2 F2:2 C2:2 C2:1 C3:1 B1:2 F2:2' },
    { w: 'lyre', v: .12, pan: .25, ring: .1, m: rep('E5:1 B4:1 G#4:1 B4:1', 16) },
    { d: rep('k.h.s.h.k.k.s.hh', 4).replace(/ /g, ''), v: .6 },
  ] },
  valley: { bpm: 92, rev: 1, ch: [
    { w: 'aulos', v: .14, cut: 3400, m: 'E4:4 A4:4 B4:2 C5:2 B4:4 A4:4 G4:4 E4:8 F4:4 E4:2 D4:2 E4:4 C4:4 B3:4 E4:8 r:4' },
    { w: 'kith', v: .45, sub: .12, ring: 1, m: 'A2:8 A2:8 G2:8 G2:8 F2:8 F2:8 E2:8 E2:8' },
    { w: 'lyre', v: .2, pan: .2, ring: .5, m: rep('A3:2 C4:2 E4:2 C4:2', 2) + ' ' + rep('G3:2 B3:2 D4:2 B3:2', 2) + ' ' + rep('F3:2 A3:2 C4:2 A3:2', 2) + ' ' + rep('E3:2 G#3:2 B3:2 G#3:2', 2) },
    { d: rep('k.......h.......', 4).replace(/ /g, ''), v: .45 },
  ] },
  fate: { bpm: 60, rev: 1.6, ch: [
    { w: 'aulos', v: .12, cut: 2200, vib: 1.4, m: 'B4:4 r:4 C5:2 B4:2 r:4 F4:8 r:8' },
    { w: 'kith', v: .45, sub: .2, ring: 2, m: 'E2:16 F2:16' },
    { w: 'pad', v: .06, cut: 900, att: 1, rel: 1.2, m: 'E4:16 F4:16' },
  ] },
  hope: { bpm: 72, rev: 1.2, ch: [
    { w: 'aulos', v: .14, cut: 3400, m: 'E4:4 G#4:4 B4:4 C#5:4 B4:6 A4:2 G#4:8 F#4:4 G#4:4 A4:4 B4:4 G#4:12 r:4' },
    { w: 'kith', v: .45, sub: .18, ring: 1.5, m: 'E2:16 C#2:16 A1:16 B1:16' },
    { w: 'lyre', v: .2, pan: .2, ring: .5, m: rep('E4:2 G#4:2 B4:2 G#4:2', 2) + ' ' + rep('C#4:2 E4:2 G#4:2 E4:2', 2) + ' ' + rep('A3:2 C#4:2 E4:2 C#4:2', 2) + ' ' + rep('B3:2 D#4:2 F#4:2 D#4:2', 2) },
  ] },
  // ----- open world -----
  overworld_day: OD,
  overworld_night: { bpm: 64, rev: 1.4, ch: [
    { w: 'lyre', v: .45, ring: 1.2, pan: .1, m: 'A3:4 E4:4 B4:8 F3:4 C4:4 E4:8 A3:4 E4:4 C5:4 B4:4 E3:4 B3:4 G4:8 D3:4 A3:4 F4:8 A3:4 E4:4 A4:8 F3:4 C4:4 A4:4 G4:4 E3:4 G#3:4 B3:8 A3:4 E4:4 B4:4 E5:4 F3:4 C4:4 G4:4 A4:4 A3:4 E4:4 C5:8 E3:4 B3:4 E4:4 G4:4 D3:4 A3:4 D4:4 F4:4 A3:4 C4:4 E4:8 F3:4 A3:4 C4:4 E4:4 E3:4 B3:4 G#4:8' },
    { w: 'aulos', v: .16, cut: 1800, pan: -.2, m: 'r:64 r:4 D5:6 C5:2 A4:4 B4:8 A4:8 C5:6 B4:2 A4:4 G4:4 G#4:12 r:4 r:64 F4:4 A4:4 D5:8 C5:6 B4:2 A4:8 G4:4 A4:4 C5:4 B4:4 B4:8 G#4:8' },
    { w: 'pad', v: .08, cut: 900, att: 1.5, rel: 2, m: 'A2+E3:64 D3+A3:16 A2+E3:16 F2+C3:16 E2+B2:16 A2+E3:64 D3+A3:16 A2+E3:16 F2+C3:16 E2+B2:16' },
    { w: 'lyre', v: .2, ring: 2, pan: .4, m: 'r:12 E6:4 r:48 r:40 B5:4 r:20 r:28 A5:4 E6:4 r:28 r:56 G#5:4 r:4' },
    { d: hits(256, { 0: 'c', 128: 'c' }), v: .25 },
  ] },
  sea: SEA,
  mountain: { bpm: 58, rev: 1.7, ch: [
    { w: 'pad', v: .06, cut: 1100, att: 2, rel: 2.5, m: 'D2+A2+E3:64 E2+B2+F#3:64 B1+F#2+D3:64 A1+E2+B2:64' },
    { w: 'lyre', v: .3, ring: 2, pan: .2, m: 'r:8 A4:4 E5:4 F#5:8 r:8 r:8 E5:4 A4:4 D5:16 r:8 B4:4 F#5:4 G#5:8 r:8 r:8 F#5:4 B4:4 E5:16 r:8 F#4:4 D5:4 C#5:8 r:8 r:8 B4:4 F#4:4 B4:16 r:8 E4:4 B4:4 C#5:8 r:8 r:8 E5:4 A5:4 A4:16' },
    { w: 'aulos', v: .12, cut: 2200, vib: 1.5, pan: -.2, m: 'r:64 B4:24 G#4:8 F#4:16 E4:16 r:64 C#5:24 B4:8 A4:32' },
    { w: 'kith', v: .4, sub: .2, ring: 3, m: rep('D2:16', 4) + ' ' + rep('E2:16', 4) + ' ' + rep('B1:16', 4) + ' ' + rep('A1:16', 4) },
    { d: hits(256, { 0: 'b', 64: 'c', 128: 'b', 192: 'c' }), v: .35 },
  ] },
  town: TOWN,
  danger: DANGER,
  underworld: { bpm: 54, rev: 1.9, ch: [
    { w: 'pad', v: .07, cut: 500, att: 3, rel: 3, m: 'D2+A2:64 Bb1+F2:64 D2+A2:64 A1+E2:64' }, // round 22: consonant (was D-Ab, C#-G#)
    { w: 'choir', v: .03, att: 2, rel: 2, m: 'r:32 F3+A3:32 r:32 F3+Bb3:32 r:32 F3+A3:32 r:32 E3+A3:32' },
    { w: 'kith', v: .5, ring: 2.5, sub: .2, m: 'D2:16 r:16 F2:8 r:24 Bb1:16 r:48 D2:16 r:16 A1:8 r:24 A1:16 r:48' },
    { w: 'aulos', v: .1, cut: 1400, vib: 1.4, m: 'r:64 F4:12 E4:4 D4:16 r:32 r:64 A4:12 G4:4 F4:8 E4:8 D4:32' },
    { d: hits(256, { 0: 'b', 128: 'b', 224: 'c' }), v: .5 },
  ] },
  underworld_metal: UNDERMETAL,
  boss: BOSS,
  olympus: OLYMPUS,
  theme: THEME,
  // ferry.js (round 30): the kraken. Drones a semitone apart (D against Eb) under a slow swell like the sea's heave,
  // low brass stabs, deep kithara strokes, a choir that never resolves, a low reed motif and far drums
  kraken: { bpm: 74, rev: 1.7, ch: [
    { w: 'pad', v: .1, cut: 420, att: .8, rel: 2.5, m: 'D2+A2:64 Eb2+Bb2:32 D2+A2:32' },
    { w: 'pad', v: .07, cut: 320, att: 3, rel: 3, m: 'D3+F3:32 Db3+E3:32 D3+F3:32 C3+Eb3:32' },
    { w: 'saw', v: .055, cut: 900, m: 'D3+A3+D4:3 r:13 r:16 r:8 Eb3+Bb3:2 D3+A3:4 r:2 r:16 D3+A3+D4:3 r:13 r:12 F3+C4:2 E3+B3:2 Eb3+Bb3+Eb4:6 r:10 r:16' },
    { w: 'kith', v: .5, sub: .3, ring: 2.5, m: 'D2:8 r:8 D2:4 Eb2:4 r:8 D2:12 r:4 A1:8 r:8 D2:8 r:8 D2:4 Eb2:4 r:8 Bb1:16 A1:16' },
    { w: 'choir', v: .04, att: 1.5, rel: 2, m: 'r:32 D3+F3:24 r:8 r:32 Eb3+G3:16 D3+F3:16' },
    { w: 'aulos', v: .1, cut: 1400, vib: 1.3, m: 'r:64 D4:6 Eb4:2 F4:4 Eb4:4 D4:12 r:4 A3:6 Bb3:2 C4:4 Bb3:4 A3:16' },
    { d: hits(128, { 0: 'b', 24: 'k', 32: 'b', 64: 'b', 88: 'k', 96: 'b', 104: 'b', 120: 'c' }), v: .55 },
  ] },
  ...BATTLE,
};
const LEGACY = new Set(['pulse12', 'pulse25', 'pulse50', 'triangle', 'saw']);
// round 15 (gentler music): low-pass per music channel kind (Hz), and drum levels by key (jingles, cymbals and tek pulled back most)
// round 19 (Roy: still too harsh): lower again, and the jingles, cymbals, tambourine and tek pulled back further
// round 22 (Roy: still not pleasant enough): lower again, the jingles, cymbals, tambourine and clappers well back
const SOFT_LP = { lyre: 3000, kith: 2200, drum: 3300 };
const DRUM_SOFT = { k: .82, b: .8, s: .45, h: .32, t: .32, c: .3, r: .42, q: .6, x: .42, j: .2, o: .16, u: .2, m: .55, z: .22, p: .22 };
// round 33: the chip voices (see Audio._chipNote). sq = pulse lead, pl = pulse pluck (a struck note that dies away),
// arp = a chord rolled fast on one pulse voice, tri = the triangle bass. Each channel passes its own low-pass (cut).
const CHIP = new Set(['sq', 'pl', 'arp', 'tri', 'nz']);
const layerGain = (lay, k) => clamp(k - lay + 1, 0, 1);
const CHIP_CUT = { sq: 3000, pl: 2600, arp: 2300, tri: 1600, nz: 3000 }; // nz: a noise swell, its band centred on the note
function prepSong(s) {
  s.len = 0;
  for (const c of s.ch) {
    if (c.m) {
      const p = parseMel(c.m); c.notes = p.notes; c.len = p.length; c.byStep = new Map();
      if (s.tr) for (const n of c.notes) { n.m = n.m.map((x) => x + s.tr); n.f = mtof(n.m[0]); } // a variation in another key
      for (const n of c.notes) c.byStep.set(n.step, n);
      const N = c.notes.length;
      c.notes.forEach((n, i) => { const nx = c.notes[(i + 1) % N], end = n.step + n.len; n.slur = !!nx && (nx.step === end || (i === N - 1 && nx.step === 0 && end === c.len)); });
      c.notes.forEach((n, i) => { const pv = c.notes[(i - 1 + N) % N]; n.leg = N > 1 && pv.slur; });
    } else c.len = c.d.length;
    s.len = Math.max(s.len, c.len);
  }
  // round 19: the lead (the first reed or chip voice) rests in the quiet verses; a change of key waits for songs whose
  // channels all come round together, so no part is caught halfway through a phrase
  s.lead = s.ch.findIndex((c) => c.m && (c.w === 'aulos' || c.w === 'sq' || /^pulse/.test(c.w || '')));
  s.aligned = s.ch.every((c) => s.len % c.len === 0);
  return s;
}
// round 19 (Roy: a longer tune, less repetitive): each time a song comes round it takes the next shape: as written,
// a quiet verse (the lead rests and the drums keep only their downbeats), up a fourth, and as written again.
// A battle alternates as written and a step higher. So the open-world themes run three to six minutes before repeating.
const SHAPES = [{ tr: 0 }, { tr: 0, quiet: true }, { tr: 5 }, { tr: 0 }], BSHAPES = [{ tr: 0 }, { tr: 2 }];
// round 33: the chip tunes already sit high, so their third pass goes a step down (warmer), never up a fourth
const CSHAPES = [{ tr: 0 }, { tr: 0, quiet: true }, { tr: -2 }, { tr: 0 }], CBSHAPES = [{ tr: 0 }, { tr: -2 }];
function shapeOf(def, pass) {
  const L = def.chip ? (def.battle ? CBSHAPES : CSHAPES) : def.battle ? BSHAPES : SHAPES, sh = L[pass % L.length];
  return def.aligned ? sh : { ...sh, tr: 0 };
}
// round 33: the chip soundtrack (music.js): every region and realm, the five town themes, the ship and the Kraken
try { Object.assign(SONGS, buildMusic()); } catch (e) { console.warn('music.js', e); }
for (const s of Object.values(SONGS)) prepSong(s);
// songs made later (a city's own variant of its town theme, sound.js); an id already there is kept
export function addSongs(obj) { for (const [k, s] of Object.entries(obj || {})) if (!SONGS[k]) { try { SONGS[k] = prepSong(s); } catch (e) { /* a bad song is skipped */ } } }
// round 33b: the package's score (songs33.js: 180 songs, each place's theme, its _night and _combat), always there;
// sound.js plays them when audiodata.js MUSIC_SET is 'songs33'. (No id overlaps ours: addSongs would keep ours.)
addSongs(SONGS33);
// Elaia's theme is 30% softer than the other towns' (Roy): songs33 sets it at .57, but our music bus's gentle compressor
// gives some of that back (measured as heard: -2.5 dB under the towns' average); this trim brings it to -3 dB (x.70)
for (const k of ['town_elaia', 'town_elaia_night', 'town_elaia_combat']) if (SONGS[k]) SONGS[k].lv = .9;
// a town's song (mode '', '_night' or '_combat'): its theme from songs33.js in the town's own arrangement (another key
// and lead voice where two towns share a theme: only a town added later, today every town has its own), made once and kept
export function townSong(id, place, biome, mode = '') {
  const base = townTheme(id, place, biome) + mode, [tr, lead] = townVariant(id);
  if (!tr && !lead) return base;
  const key = 'tw33_' + id + mode; // (tw33_: our own cities' songs are tw_<city>)
  if (!SONGS[key]) { const B = SONGS[base]; SONGS[key] = prepSong({ bpm: B.bpm, rev: B.rev, battle: B.battle, tr, ch: B.ch.map((c, i) => ({ ...c, notes: undefined, byStep: undefined, ...(i === 0 && lead && !mode && { w: lead, v: lead === 'aulos' ? .12 : c.v }) })) }); }
  return key;
}
// a channel's echo, in either form: our chip voices' [steps, feedback, wet] (a delay line in _chipChan) or songs33's
// plain number (the wet level of one dotted-eighth repeat, played as a second note in note()). Each channel gets exactly
// one: an array never reaches note()'s repeat, a number never builds a delay with feedback
function echoOf(c) {
  if (Array.isArray(c.echo)) return [c.echo[0] || 3, c.echo[1] ?? .3, c.echo[2] ?? .35];
  if (typeof c.echo === 'number' && c.echo > 0) return [3, 0, c.echo];
  return null;
}

// ---------------- offline DSP (pre-rendered buffers) ----------------
function BQ(type, f, q = .707, sr = 44100, db = 0) {
  const o = { z1: 0, z2: 0 };
  o.set = (fr, q2 = q) => {
    fr = Math.min(fr, sr * .45);
    const w = 2 * Math.PI * fr / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q2);
    let b0, b1, b2, a0, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
    if (type === 'pk') { const A = Math.pow(10, db / 40); b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a2 = 1 - al / A; }
    else { a0 = 1 + al; a2 = 1 - al; }
    o.b0 = b0 / a0; o.b1 = b1 / a0; o.b2 = b2 / a0; o.a1 = -2 * c / a0; o.a2 = a2 / a0;
  };
  o.set(f);
  o.run = (x) => { const y = o.b0 * x + o.z1; o.z1 = o.b1 * x - o.a1 * y + o.z2; o.z2 = o.b2 * x - o.a2 * y; return y; };
  return o;
}
function normalize(a, peak = .9) {
  let m = 0; for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; }
  if (m > 0) { const k = peak / m; for (let i = 0; i < a.length; i++) a[i] *= k; }
  return a;
}
function fadeOut(a, sr, secs = .03) { const n = Math.min(a.length, Math.floor(secs * sr)); for (let i = 0; i < n; i++) a[a.length - 1 - i] *= i / n; return a; }
// render N + X samples, then fold the extra X into the head with an equal-power crossfade -> seamless loop
function loopify(a, X) {
  const N = a.length - X, out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = a[i];
  for (let i = 0; i < X; i++) { const u = i / X; out[i] = a[i] * Math.sqrt(u) + a[N + i] * Math.sqrt(1 - u); }
  return out;
}

// Karplus-Strong pluck. The buffer sample rate is chosen so the loop length is an integer number of
// samples at exactly the note's pitch (sr = f * (L + loop filter delay)), so tuning is exact.
function renderPluck(midi, kind) {
  const f = mtof(midi), three = kind === 'kith' || midi < 57, D = three ? 1 : .5;
  const L = Math.max(2, Math.ceil(24000 / f - D)), sr = Math.round(f * (L + D));
  const T60 = kind === 'kith' ? clamp(4.6 - (midi - 36) * .07, 1.4, 4.6) : clamp(3.4 - (midi - 52) * .06, .8, 3.2);
  const dur = Math.min(T60 * .8, 3.2), N = Math.ceil(dur * sr), y = new Float32Array(N);
  const bright = kind === 'kith' ? .25 : .4, P = L + 2; // round 22: a softer finger (was .28 / .5)
  const ex = new Float32Array(P); let lp = 0;
  for (let i = 0; i < P; i++) { lp += bright * (nz() - lp); ex[i] = lp; }
  const pp = Math.max(1, Math.round(P * (kind === 'kith' ? .18 : .13)));
  let mean = 0;
  for (let i = 0; i < P; i++) { y[i] = ex[i] - (i >= pp ? ex[i - pp] : 0); mean += y[i]; }
  mean /= P; for (let i = 0; i < P; i++) y[i] -= mean;
  const g = Math.pow(10, -3 / (T60 * f));
  if (three) for (let n = P; n < N; n++) y[n] = g * (.25 * y[n - L] + .5 * y[n - L - 1] + .25 * y[n - L - 2]);
  else for (let n = P; n < N; n++) y[n] = g * .5 * (y[n - L] + y[n - L - 1]);
  // body: DC block, wooden warmth, gut-string presence, soften the top
  const hp = BQ('hp', 55, .7, sr), b1 = BQ('pk', 230, 1.1, sr, 3.5), b2 = BQ('pk', 2600, 1.4, sr, kind === 'kith' ? -1 : .5), l2 = BQ('lp', 5800, .7, sr);
  for (let i = 0; i < N; i++) y[i] = l2.run(b2.run(b1.run(hp.run(y[i]))));
  fadeOut(y, sr, .04);
  return { data: normalize(y, .85 * (midi > 76 ? Math.max(.6, 1 - (midi - 76) * .02) : 1)), sr };
}

function renderDrum(k, sr) {
  const dur = { k: .5, s: .2, h: .16, t: .4, b: 1, c: 1.4, r: .1 }[k], N = Math.ceil(dur * sr), y = new Float32Array(N);
  if (k === 'k' || k === 'b') {
    const big = k === 'b', lp = BQ('lp', big ? 300 : 600, .7, sr); let ph = 0;
    for (let i = 0; i < N; i++) {
      const t = i / sr, f = big ? 48 + 42 * Math.exp(-t / .05) : 72 + 58 * Math.exp(-t / .025);
      ph += 2 * Math.PI * f / sr;
      y[i] = Math.sin(ph) * Math.exp(-t / (big ? .38 : .17)) + Math.sin(ph * (big ? 1.5 : 1.59)) * Math.exp(-t / (big ? .12 : .06)) * .3 + lp.run(nz()) * Math.exp(-t / (big ? .02 : .012)) * .5;
    }
  } else if (k === 's') {
    const hp = BQ('hp', 2000, .7, sr), bp = BQ('bp', 1700, 1.2, sr);
    // round 22: the tek is more skin than snare now (the noise was 0.6 + 1.4, a hiss that cut through everything)
    for (let i = 0; i < N; i++) { const t = i / sr; y[i] = hp.run(nz()) * Math.exp(-t / .004) * .25 + (Math.sin(2 * Math.PI * 360 * t) * .7 + Math.sin(2 * Math.PI * 610 * t) * .4) * Math.exp(-t / .04) + bp.run(nz()) * Math.exp(-t / .02) * .7; }
  } else if (k === 'h' || k === 't') {
    const open = k === 't', parts = [5300, 6720, 7900, 9250, 10600].filter((f) => f < sr * .45).map((f) => [f * rnd(.98, 1.02), rnd(0, 6)]);
    const ons = open ? [0, .01, .022, .05, .09] : [0, .007, .016], dec = open ? .11 : .035, bp = BQ('bp', 7000, 1.5, sr), sl = BQ('bp', 450, 1.5, sr);
    for (let i = 0; i < N; i++) {
      const t = i / sr; let e = 0; ons.forEach((o, j) => { if (t >= o) e += Math.exp(-(t - o) / dec) * (1 - j * .15); });
      let m = 0; for (const [f, p] of parts) m += Math.sin(2 * Math.PI * f * t + p);
      y[i] = (m * .25 + bp.run(nz()) * 1.2) * e + (open ? sl.run(nz()) * Math.exp(-t / .02) * .8 : 0);
    }
  } else if (k === 'c') {
    const P = [[2650, .8, 1.1], [3720, .6, .9], [5180, .5, .7], [6830, .35, .5], [8650, .25, .35]].filter((p) => p[0] < sr * .45), hp = BQ('hp', 4000, .7, sr);
    for (let i = 0; i < N; i++) { const t = i / sr; let m = 0; for (const [f, a, d] of P) m += Math.sin(2 * Math.PI * f * t) * a * Math.exp(-t / (d / 3)); y[i] = m + hp.run(nz()) * Math.exp(-t / .004) * .5; }
  } else if (k === 'r') {
    const b1 = BQ('bp', 1900, 4, sr), b2 = BQ('bp', 900, 3, sr);
    for (let i = 0; i < N; i++) { const t = i / sr; let e = Math.exp(-t / .008); if (t > .028) e += Math.exp(-(t - .028) / .008) * .6; const n = nz(); y[i] = (b1.run(n) * 2 + b2.run(n) * .8) * e; }
  }
  fadeOut(y, sr, .02);
  return normalize(y, .9);
}

// round 33 (Roy's audio spec: a high-quality 8-bit soundtrack): the chip kit. Keys apart from the frame-drum kit's
// (kshtbcr): q kick (a triangle swept down with a soft click), x snare (noise and a short tone body), j closed hat,
// o open hat, u shaker, m tom, z soft crash, p "short-mode" metallic tick (the console's periodic noise). Everything
// passes a low-pass and the hats sit well back (DRUM_SOFT): pleasant over long sessions, never sizzling.
function renderChipDrum(k, sr) {
  const dur = { q: .32, x: .2, j: .06, o: .26, u: .09, m: .3, z: 1.1, p: .07 }[k], N = Math.ceil(dur * sr), y = new Float32Array(N);
  const tri = (ph) => { const x = (ph / (2 * Math.PI)) % 1; return 4 * Math.abs(x - .5) - 1; };
  let ph = 0;
  if (k === 'q') {
    const lp = BQ('lp', 1400, .7, sr);
    for (let i = 0; i < N; i++) { const t = i / sr, f = 46 + 110 * Math.exp(-t / .028); ph += 2 * Math.PI * f / sr; y[i] = (tri(ph) * .75 + Math.sin(ph) * .4) * Math.exp(-t / .12) + lp.run(nz()) * Math.exp(-t / .006) * .35; }
  } else if (k === 'x') {
    const bp = BQ('bp', 1900, .8, sr), lp = BQ('lp', 4800, .7, sr);
    for (let i = 0; i < N; i++) { const t = i / sr, f = 190 * (1 - .25 * Math.min(1, t / .05)); ph += 2 * Math.PI * f / sr; y[i] = lp.run(bp.run(nz()) * Math.exp(-t / .055) * 1.3) + tri(ph) * Math.exp(-t / .03) * .55; }
  } else if (k === 'j' || k === 'o' || k === 'u') {
    const f0 = k === 'u' ? 3600 : 5600, bp = BQ('bp', f0, k === 'u' ? 1.1 : .9, sr), lp = BQ('lp', 7500, .7, sr), dec = k === 'o' ? .085 : k === 'u' ? .03 : .016;
    for (let i = 0; i < N; i++) { const t = i / sr, a = k === 'u' ? Math.min(1, t / .012) : 1; y[i] = lp.run(bp.run(nz())) * a * Math.exp(-t / dec); }
  } else if (k === 'm') {
    for (let i = 0; i < N; i++) { const t = i / sr, f = 105 + 120 * Math.exp(-t / .05); ph += 2 * Math.PI * f / sr; y[i] = tri(ph) * Math.exp(-t / .11); }
  } else if (k === 'z') {
    const lp = BQ('lp', 6000, .6, sr), hp = BQ('hp', 900, .7, sr);
    for (let i = 0; i < N; i++) { const t = i / sr; y[i] = lp.run(hp.run(nz())) * Math.min(1, t / .004) * Math.exp(-t / .32); }
  } else if (k === 'p') {
    // a 93-step LFSR loop (the 2A03's short noise): a buzzy, almost pitched tick
    let r = 1; const seq = []; for (let i = 0; i < 93; i++) { const b = ((r >> 0) ^ (r >> 6)) & 1; r = (r >> 1) | (b << 14); seq.push(r & 1 ? 1 : -1); }
    const rate = 1100 * 93 / sr, lp = BQ('lp', 3200, .7, sr); let pos = 0;
    for (let i = 0; i < N; i++) { const t = i / sr; pos += rate; y[i] = lp.run(seq[Math.floor(pos) % 93]) * Math.exp(-t / .022); }
  }
  fadeOut(y, sr, .01);
  return normalize(y, .9);
}

function renderIR(ctx, secs = 2.1, decay = 1.9) {
  const sr = ctx.sampleRate, N = Math.floor(secs * sr), buf = ctx.createBuffer(2, N, sr), pre = Math.floor(.012 * sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = pre; i < N; i++) { const t = (i - pre) / sr, a = .12 + .75 * Math.exp(-t / .3); lp += a * (nz() - lp); d[i] = lp * Math.exp(-6.9 * t / decay); }
    for (const [t, g] of [[.019, .5], [.027, .35], [.039, .3], [.051, .22], [.068, .18]]) d[Math.floor((t + ch * .0031) * sr)] += g * (Math.random() < .5 ? -1 : 1);
    fadeOut(d, sr, .1);
  }
  return buf;
}

// footsteps / hooves: short one-shots, several random variants per surface
function renderImpact(surface, sr, hoof, hi) {
  const dur = surface === 'water' ? .34 : hoof ? .26 : { grass: .17, dirt: .15, stone: .13, marble: .2, sand: .2, wood: .22, snow: .24 }[surface] || .18;
  const N = Math.ceil(dur * sr), y = new Float32Array(N), k = hoof ? (hi ? rnd(1.08, 1.2) : rnd(.85, .97)) : rnd(.88, 1.14);
  const grains = (count, t0, t1, f, q, dec, amp) => {
    const bq = BQ('bp', f * k, q, sr), env = new Float32Array(N);
    for (let g = 0; g < count; g++) { const st = Math.floor(rnd(t0, t1) * sr), a = amp * rnd(.4, 1), d = dec * rnd(.6, 1.4) * sr; for (let i = st; i < N && i < st + d * 6; i++) env[i] += a * Math.exp(-(i - st) / d); }
    for (let i = 0; i < N; i++) y[i] += bq.run(nz()) * env[i];
  };
  const burst = (t0, type, f, q, dec, amp, att = .001) => {
    const bq = BQ(type, f * k, q, sr), st = Math.floor(t0 * sr), A = Math.max(1, att * sr), D = dec * sr;
    for (let i = st; i < N; i++) { const u = i - st; y[i] += bq.run(nz()) * (u < A ? u / A : Math.exp(-(u - A) / D)) * amp; }
  };
  const ring = (t0, f, dec, amp) => { const st = Math.floor(t0 * sr); for (let i = st; i < N; i++) { const u = (i - st) / sr; y[i] += Math.sin(2 * Math.PI * f * k * u) * Math.exp(-u / dec) * amp * Math.min(1, u * sr / 8); } };
  const bloop = (t0, f0, d, amp) => { const st = Math.floor(t0 * sr), L = Math.floor(d * sr); let ph = 0; for (let j = 0; j < L && st + j < N; j++) { const u = j / L; ph += 2 * Math.PI * f0 * (1 + .9 * u) / sr; y[st + j] += Math.sin(ph) * Math.min(1, u * 12) * Math.exp(-u * 3.5) * amp; } };
  if (!hoof) switch (surface) {
    case 'grass': burst(0, 'lp', 260, .7, .025, .5, .004); grains(5, 0, .07, 3800, .8, .009, .7); grains(3, .01, .09, 1800, 1, .006, .35); break;
    case 'dirt': burst(0, 'lp', 320, .7, .022, .9, .002); grains(6, 0, .05, 1100, .9, .007, .6); grains(4, .005, .06, 2600, 1, .004, .35); break;
    case 'stone': burst(0, 'hp', 2200, .7, .004, .8); burst(0, 'lp', 700, .8, .014, .9); grains(2, .004, .03, 3200, 1.2, .003, .3); break;
    case 'marble': burst(0, 'hp', 3000, .7, .003, .7); ring(0, 2350, .035, .25); ring(0, 3900, .02, .12); burst(0, 'lp', 520, .8, .012, .7); break;
    case 'sand': burst(0, 'bp', 2300, .6, .05, .9, .015); grains(6, .005, .09, 1500, .8, .01, .4); burst(0, 'lp', 200, .7, .02, .3, .005); break;
    case 'wood': burst(0, 'hp', 1800, .7, .003, .5); ring(0, 210, .045, .7); ring(0, 520, .025, .35); burst(0, 'lp', 400, .8, .015, .5); break;
    case 'water': burst(0, 'bp', 900, .8, .06, .9, .008); burst(.01, 'hp', 2500, .7, .08, .35, .01); bloop(rnd(.03, .1), rnd(400, 700), .035, .3); bloop(rnd(.08, .18), rnd(500, 900), .03, .22); break;
    case 'snow': grains(18, 0, .13, 3200, 1, .006, .55); grains(8, 0, .1, 1500, 1, .008, .35); burst(0, 'lp', 220, .7, .03, .5, .006); break;
  } else switch (surface) {
    case 'stone': case 'marble': burst(0, 'hp', 2500, .7, .003, .9); ring(0, 620, .03, .8); ring(0, 1350, .018, .45); burst(0, 'lp', 260, .8, .03, .7, .002); if (surface === 'marble') ring(0, 2600, .045, .2); break;
    case 'wood': burst(0, 'hp', 2000, .7, .003, .6); ring(0, 180, .07, 1); ring(0, 410, .045, .5); ring(0, 750, .03, .3); burst(0, 'lp', 300, .8, .03, .6); break;
    case 'grass': burst(0, 'lp', 260, .8, .04, 1, .003); ring(0, 80, .05, .55); grains(5, 0, .08, 3500, .8, .01, .35); break;
    case 'sand': burst(0, 'lp', 200, .8, .05, 1, .008); burst(0, 'bp', 2000, .6, .07, .5, .02); break;
    case 'snow': burst(0, 'lp', 220, .8, .04, .9, .006); grains(16, 0, .12, 3000, 1, .007, .5); break;
    case 'water': burst(0, 'bp', 800, .8, .1, 1, .006); burst(.01, 'hp', 2500, .7, .12, .4, .01); for (let i = 0; i < 3; i++) bloop(rnd(.04, .2), rnd(350, 900), rnd(.025, .045), .25); break;
    default: burst(0, 'lp', 300, .8, .035, 1, .002); ring(0, 85, .05, .6); grains(6, 0, .06, 1100, .9, .008, .45); // dirt
  }
  fadeOut(y, sr, .02);
  return normalize(y, .9);
}

// round 22 (Roy: a walking / running sound for every kind of ground): V's footsteps. A walking step is a heel strike
// and a softer toe roll 50-75 ms later; a running step lands harder on the forefoot and kicks the ground up behind it
// (the spray: grass swish, gravel scatter, sand hiss, a splash). Four variants per surface and gait, rendered on first use.
const STEP_DUR = { water: .45, wade: .6, mud: .38, snow: .3, sand: .28, leaves: .26, gravel: .26, ice: .26, cave: .24, marble: .24, wood: .24, floor: .22, grass: .22, dirt: .2, stone: .18, rug: .16 };
function renderStep(surface, sr, run) {
  const dur = (STEP_DUR[surface] || .2) + (run ? .04 : .07), N = Math.ceil(dur * sr), y = new Float32Array(N), k = rnd(.9, 1.1);
  const grains = (count, t0, t1, f, q, dec, amp) => {
    const bq = BQ('bp', f * k, q, sr), env = new Float32Array(N);
    for (let g = 0; g < count; g++) { const st = Math.floor(rnd(t0, t1) * sr), a = amp * rnd(.4, 1), d = dec * rnd(.6, 1.4) * sr; for (let i = st; i < N && i < st + d * 6; i++) env[i] += a * Math.exp(-(i - st) / d); }
    for (let i = 0; i < N; i++) y[i] += bq.run(nz()) * env[i];
  };
  const burst = (t0, type, f, q, dec, amp, att = .001) => {
    const bq = BQ(type, f * k, q, sr), st = Math.floor(t0 * sr), A = Math.max(1, att * sr), D = dec * sr;
    for (let i = st; i < N; i++) { const u = i - st; y[i] += bq.run(nz()) * (u < A ? u / A : Math.exp(-(u - A) / D)) * amp; }
  };
  const ring = (t0, f, dec, amp) => { const st = Math.floor(t0 * sr); for (let i = st; i < N; i++) { const u = (i - st) / sr; y[i] += Math.sin(2 * Math.PI * f * k * u) * Math.exp(-u / dec) * amp * Math.min(1, u * sr / 8); } };
  const bloop = (t0, f0, d, amp, up = .9) => { const st = Math.floor(t0 * sr), L = Math.floor(d * sr); let ph = 0; for (let j = 0; j < L && st + j < N; j++) { const u = j / L; ph += 2 * Math.PI * f0 * (1 + up * u) / sr; y[st + j] += Math.sin(ph) * Math.min(1, u * 12) * Math.exp(-u * 3.5) * amp; } };
  // [the impact (t0, amp), the spray kicked up when running (t0, amp)]
  const S = {
    grass: [(t, a) => { burst(t, 'lp', 260, .7, .025, .5 * a, .004); grains(5, t, t + .07, 3800, .8, .009, .7 * a); grains(3, t + .01, t + .09, 1800, 1, .006, .35 * a); },
      (t, a) => grains(9, t, t + .13, 4300, .8, .01, .55 * a)],
    leaves: [(t, a) => { burst(t, 'lp', 240, .7, .02, .45 * a, .004); grains(14, t, t + .09, 3000, 1.2, .003, .8 * a); grains(6, t, t + .08, 5200, 1, .002, .45 * a); },
      (t, a) => { grains(12, t, t + .15, 3600, 1.1, .003, .5 * a); grains(5, t + .02, t + .15, 1900, 1, .006, .3 * a); }],
    dirt: [(t, a) => { burst(t, 'lp', 320, .7, .022, .9 * a, .002); grains(6, t, t + .05, 1100, .9, .007, .6 * a); grains(4, t + .005, t + .06, 2600, 1, .004, .35 * a); },
      (t, a) => grains(7, t, t + .1, 1600, .9, .006, .35 * a)],
    gravel: [(t, a) => { burst(t, 'lp', 300, .7, .02, .7 * a, .002); grains(16, t, t + .07, 2400, 1.5, .003, .75 * a); grains(8, t, t + .06, 4200, 1.2, .002, .45 * a); },
      (t, a) => { grains(15, t + .01, t + .14, 2800, 1.3, .003, .5 * a); grains(5, t + .02, t + .15, 1500, 1.2, .004, .3 * a); }],
    mud: [(t, a) => { burst(t, 'lp', 220, .7, .035, .9 * a, .006); bloop(t + .012, rnd(170, 240), .06, .5 * a, .5); burst(t + .004, 'bp', 700, 1.2, .03, .4 * a, .01); },
      (t, a) => { bloop(t + .07, rnd(280, 400), .05, .4 * a); burst(t + .07, 'bp', 1200, 1.4, .025, .25 * a, .008); }],
    sand: [(t, a) => { burst(t, 'bp', 2300, .6, .05, .9 * a, .015); grains(6, t + .005, t + .09, 1500, .8, .01, .4 * a); burst(t, 'lp', 200, .7, .02, .3 * a, .005); },
      (t, a) => { burst(t + .01, 'bp', 3000, .6, .06, .5 * a, .02); grains(8, t + .01, t + .14, 2200, .8, .008, .3 * a); }],
    stone: [(t, a) => { burst(t, 'hp', 2200, .7, .004, .8 * a); burst(t, 'lp', 700, .8, .014, .9 * a); grains(2, t + .004, t + .03, 3200, 1.2, .003, .3 * a); },
      (t, a) => { grains(4, t, t + .06, 2600, 1.4, .002, .3 * a); burst(t + .005, 'hp', 3500, .7, .03, .15 * a, .01); }],
    cave: [(t, a) => { burst(t, 'hp', 1900, .7, .004, .6 * a); burst(t, 'lp', 600, .8, .016, .9 * a); grains(5, t + .004, t + .05, 1800, 1.3, .003, .35 * a); },
      (t, a) => { grains(6, t, t + .1, 2300, 1.4, .002, .3 * a); ring(t + rnd(.04, .1), rnd(2200, 3000), .02, .12 * a); }], // a pebble skitters off
    marble: [(t, a) => { burst(t, 'hp', 2700, .7, .0035, .75 * a); burst(t, 'lp', 620, .8, .012, .85 * a); burst(t, 'bp', 1500, 1.1, .006, .3 * a); burst(t + .006, 'bp', 1100, .8, .07, .04 * a, .015); },
      (t, a) => burst(t + .004, 'hp', 3300, .7, .01, .16 * a, .003)], // round 24 (Roy): tiles, a plain heel-toe tap and a little room, no ringing
    wood: [(t, a) => { burst(t, 'hp', 1800, .7, .003, .5 * a); ring(t, 210, .045, .7 * a); ring(t, 520, .025, .35 * a); burst(t, 'lp', 400, .8, .015, .5 * a); },
      (t, a) => { ring(t + .005, 175, .06, .3 * a); burst(t, 'hp', 1800, .7, .003, .2 * a); }], // the boards boom
    floor: [(t, a) => { burst(t, 'hp', 1600, .7, .003, .4 * a); ring(t, 160, .05, .6 * a); ring(t, 390, .03, .3 * a); burst(t, 'lp', 350, .8, .015, .45 * a); },
      (t, a) => { ring(t + .01, 140, .05, .25 * a); burst(t, 'hp', 2400, .7, .02, .1 * a, .005); }],
    rug: [(t, a) => { burst(t, 'lp', 200, .7, .03, .7 * a, .005); grains(4, t, t + .05, 900, .8, .01, .2 * a); }, (t, a) => burst(t, 'lp', 500, .7, .03, .2 * a, .005)],
    snow: [(t, a) => { grains(18, t, t + .13, 3200, 1, .006, .55 * a); grains(8, t, t + .1, 1500, 1, .008, .35 * a); burst(t, 'lp', 220, .7, .03, .5 * a, .006); },
      (t, a) => { grains(14, t, t + .12, 2600, 1, .006, .45 * a); burst(t + .01, 'hp', 3000, .7, .05, .15 * a, .01); }],
    ice: [(t, a) => { burst(t, 'hp', 3200, .7, .002, .7 * a); ring(t, 3100, .02, .15 * a); ring(t, 5200, .012, .08 * a); burst(t, 'lp', 500, .8, .01, .5 * a); },
      (t, a) => burst(t + .01, 'bp', 2500, 2, .07, .3 * a, .02)], // the sole skids
    water: [(t, a) => { burst(t, 'bp', 900, .8, .06, .9 * a, .008); burst(t + .01, 'hp', 2500, .7, .08, .35 * a, .01); bloop(t + rnd(.03, .1), rnd(400, 700), .035, .3 * a); bloop(t + rnd(.08, .18), rnd(500, 900), .03, .22 * a); },
      (t, a) => { burst(t + .02, 'hp', 2500, .7, .1, .45 * a, .01); bloop(t + rnd(.1, .2), rnd(450, 800), .03, .25 * a); bloop(t + rnd(.15, .28), rnd(600, 1000), .025, .2 * a); }],
    wade: [(t, a) => { burst(t, 'bp', 600, .7, .12, 1 * a, .02); burst(t, 'lp', 300, .7, .1, .6 * a, .03); burst(t + .03, 'hp', 2200, .7, .15, .3 * a, .02); for (let i = 0; i < 3; i++) bloop(t + rnd(.08, .35), rnd(300, 800), rnd(.025, .045), .25 * a); },
      (t, a) => { burst(t + .05, 'hp', 2000, .7, .18, .4 * a, .03); for (let i = 0; i < 3; i++) bloop(t + rnd(.15, .45), rnd(500, 1000), .03, .2 * a); }],
  };
  const [hit, spray] = S[surface] || S.dirt;
  if (run) { hit(0, 1.15); spray(.008, 1); }
  else { hit(0, 1); hit(rnd(.05, .075), .38); } // heel, then toe
  fadeOut(y, sr, .025);
  return normalize(y, .9);
}

// a loaded, heavy step's low thud and an armour harness's clink (layered over a step)
function renderThump(sr) {
  const N = Math.ceil(.16 * sr), y = new Float32Array(N), f0 = rnd(70, 90); let ph = 0;
  for (let i = 0; i < N; i++) { const t = i / sr; ph += 2 * Math.PI * (f0 * (.6 + .4 * Math.exp(-t / .03))) / sr; y[i] = Math.sin(ph) * Math.exp(-t / .045) * Math.min(1, i / 30); }
  return normalize(y, .9);
}
function renderClink(sr) {
  const N = Math.ceil(.18 * sr), y = new Float32Array(N), P = [[rnd(2400, 2900), .5], [rnd(3900, 4500), .3], [rnd(5600, 6400), .2]];
  for (const o of [0, rnd(.012, .03), rnd(.04, .07)]) { const st = Math.floor(o * sr), a = rnd(.4, 1); for (let i = st; i < N; i++) { const u = (i - st) / sr; let m = 0; for (const [f, g] of P) m += Math.sin(2 * Math.PI * f * u) * g; y[i] += m * a * Math.exp(-u / .025); } }
  fadeOut(y, sr, .02);
  return normalize(y, .9);
}

// ambience textures (22.05 kHz, seamless loops)
const TSR = 22050;
function renderRustle(dur) {
  const X = Math.floor(.3 * TSR), N = Math.floor(dur * TSR) + X, y = new Float32Array(N), env = new Float32Array(N);
  const bp = BQ('bp', 3600, .7, TSR), hp = BQ('hp', 1400, .7, TSR), ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
  const w = (t) => clamp(.5 + .3 * Math.sin(2 * Math.PI * t / dur + ph[0]) + .2 * Math.sin(4 * Math.PI * t / dur + ph[1]) + .15 * Math.sin(6 * Math.PI * t / dur + ph[2]), .05, 1);
  for (let i = 0; i < N; i++) env[i] = .15 * w(i / TSR);
  let t = 0;
  while (t < N / TSR) { const s = Math.floor(t * TSR), a = rnd(.15, .8) * w(t), d = rnd(.004, .02) * TSR; for (let i = s; i < N && i < s + d * 5; i++) env[i] += a * Math.exp(-(i - s) / d); t += -Math.log(1 - Math.random()) / Math.max(4, 30 * w(t)); }
  for (let i = 0; i < N; i++) y[i] = hp.run(bp.run(nz())) * env[i];
  return normalize(loopify(y, X));
}
function renderCrickets(f, period, count, pulses, pl, pg) {
  const N = Math.floor(period * count * TSR), y = new Float32Array(N);
  for (let c = 0; c < count; c++) {
    const t0 = c * period + rnd(0, period * .12), amp = rnd(.75, 1);
    for (let p = 0; p < pulses; p++) {
      const st = Math.floor((t0 + p * (pl + pg)) * TSR), L = Math.floor(pl * TSR), ff = f * rnd(.995, 1.005);
      for (let j = 0; j < L; j++) { const u = j / L, e = Math.pow(Math.sin(Math.PI * u), 2) * amp * (p === 0 ? .7 : 1), tt = j / TSR; y[(st + j) % N] += e * (Math.sin(2 * Math.PI * ff * tt) + .12 * Math.sin(4 * Math.PI * ff * tt)); }
    }
  }
  return normalize(y);
}
function renderRiver(dur) {
  const X = Math.floor(.3 * TSR), N = Math.floor(dur * TSR) + X, y = new Float32Array(N), b = BQ('bp', 520, .6, TSR), h = BQ('hp', 2400, .7, TSR);
  for (let i = 0; i < N; i++) y[i] = b.run(nz()) * .55 + h.run(nz()) * .07;
  for (let k = 0, n = Math.floor(34 * dur); k < n; k++) {
    const st = Math.floor(rnd(0, N - .05 * TSR)), f0 = 280 * Math.pow(2, rnd(0, 2.3)), L = Math.floor(rnd(.012, .04) * TSR), amp = rnd(.04, .22); let ph = 0;
    for (let j = 0; j < L; j++) { const u = j / L; ph += 2 * Math.PI * f0 * (1 + .9 * u) / TSR; y[st + j] += Math.sin(ph) * Math.min(1, u * 12) * Math.exp(-u * 3.5) * amp; }
  }
  return normalize(loopify(y, X));
}
function renderFire(dur) {
  const X = Math.floor(.3 * TSR), N = Math.floor(dur * TSR) + X, y = new Float32Array(N), lp = BQ('lp', 380, .7, TSR), hs = BQ('hp', 3200, .7, TSR), hc = BQ('hp', 1800, .7, TSR), bp = BQ('bp', 650, 2, TSR);
  let br = 0;
  for (let i = 0; i < N; i++) { const t = i / TSR; br = .985 * br + .06 * nz(); y[i] = lp.run(br) * (.55 + .25 * Math.sin(2 * Math.PI * 2 * t / dur) + .1 * Math.sin(2 * Math.PI * 7 * t / dur)) + hs.run(nz()) * .025; }
  const imp = (rate, fn) => { let t = rnd(0, .05); while (t < N / TSR - .03) { fn(Math.floor(t * TSR)); t += -Math.log(1 - Math.random()) / rate; } };
  imp(16, (s) => { const a = .15 + .85 * Math.pow(Math.random(), 3), L = rnd(.0008, .004) * TSR; for (let j = 0; j < L * 4; j++) y[s + j] += hc.run(nz()) * a * Math.exp(-j / L) * 1.5; });
  imp(1.1, (s) => { const a = rnd(.3, .7); for (let j = 0; j < .05 * TSR; j++) y[s + j] += bp.run(nz()) * a * 3 * Math.exp(-j / (.012 * TSR)); });
  return normalize(loopify(y, X));
}
function renderCreak(dur) {
  const N = Math.floor(dur * TSR), y = new Float32Array(N), imp = new Float32Array(N);
  const r1 = BQ('bp', rnd(550, 750), 14, TSR), r2 = BQ('bp', rnd(1250, 1600), 16, TSR), r3 = BQ('bp', rnd(2600, 3100), 12, TSR);
  const p0 = rnd(1 / 110, 1 / 80), p1 = rnd(1 / 60, 1 / 40); let next = 0;
  while (next < N) { const u = next / N, per = (p0 + (p1 - p0) * (u < .5 ? u * 2 : 2 - u * 2)) * rnd(.85, 1.15); if (Math.random() > .08) imp[Math.floor(next)] = rnd(.5, 1); next += per * TSR; }
  const A = .06 * TSR, R = .12 * TSR;
  for (let i = 0; i < N; i++) { const e = Math.min(1, i / A, (N - i) / R), x = imp[i] * e; y[i] = r1.run(x) + r2.run(x) * .7 + r3.run(x) * .35; }
  return normalize(y);
}
function renderFlap() {
  const N = Math.floor(.55 * TSR), y = new Float32Array(N), lp = BQ('lp', 1600, .7, TSR), bp = BQ('bp', 200, 1.5, TSR);
  let t = 0, amp = 1;
  for (let w = 0, n = 3 + (Math.random() * 3 | 0); w < n; w++) {
    const s = Math.floor(t * TSR), d = rnd(.025, .045) * TSR;
    for (let j = 0; s + j < N; j++) { const e = Math.min(1, j / (.002 * TSR)) * Math.exp(-j / d) * amp; const n2 = nz(); y[s + j] += (lp.run(n2) + bp.run(n2) * 1.4) * e; }
    t += rnd(.055, .09); amp *= rnd(.55, .75);
  }
  fadeOut(y, TSR, .05);
  return normalize(y);
}
function renderBabble(dur) {
  const X = Math.floor(.4 * TSR), N = Math.floor(dur * TSR) + X, y = new Float32Array(N);
  const VW = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [660, 1720], [440, 1020]];
  for (let k = 0; k < 7; k++) {
    const f0 = rnd(105, 230), b1 = BQ('bp', 700, 6, TSR), b2 = BQ('bp', 1200, 8, TSR); let i = Math.floor(rnd(0, .3 * TSR)), ph = 0;
    while (i < N) {
      const L = Math.floor(rnd(.07, .22) * TSR), v = VW[Math.random() * VW.length | 0]; b1.set(v[0] * rnd(.9, 1.1)); b2.set(v[1] * rnd(.9, 1.1));
      const p0 = f0 * rnd(.85, 1.2), p1 = p0 * rnd(.85, 1.1), amp = rnd(.4, 1);
      for (let j = 0; j < L && i < N; j++, i++) { const u = j / L; ph += (p0 + (p1 - p0) * u) / TSR; if (ph >= 1) ph -= 1; const src = 2 * ph - 1 + nz() * .1; y[i] += (b1.run(src) + .6 * b2.run(src)) * Math.pow(Math.sin(Math.PI * u), .7) * amp; }
      i += Math.floor((Math.random() < .15 ? rnd(.3, .9) : rnd(.02, .12)) * TSR);
    }
  }
  const lp = BQ('lp', 2200, .7, TSR); for (let i = 0; i < N; i++) y[i] = lp.run(y[i]);
  return normalize(loopify(y, X));
}

// ---- combat layers shared by the hit_* / wh_* sounds ----
// a band-passed noise sweep (f: [start, peak, end] Hz) that peaks at 40% of dur; pan: [from, to]
function whoosh(A, t, { f, dur, q = 1.5, v = .7, pan, buf }) {
  const r = A.nz(t, { buf, type: 'bandpass', q, fc: [[0, f[0]], [dur * .45, f[1]], [dur, f[2]]], a: dur * .4, d: dur * .7, v, pan: pan ? pan[0] : undefined });
  if (pan && r.p && r.p.pan) { r.p.pan.setValueAtTime(clamp(pan[0], -1, 1), t); r.p.pan.linearRampToValueAtTime(clamp(pan[1], -1, 1), t + dur); }
  return r;
}
// what the struck body sounds like
const MAT = {
  flesh(A, t, v, k) { A.tone(t, { fc: [[0, 150 * k], [.1, 52]], a: .002, d: .13, v: .55 * v }); A.nz(t, { type: 'bandpass', f: 750 * k, q: 1.1, d: .07, v: .42 * v }); A.nz(t + .004, { buf: 'pink', type: 'lowpass', f: 1400, d: .09, v: .3 * v }); },
  bone(A, t, v, k) { A.nz(t, { type: 'bandpass', f: 2300 * k, q: 4, d: .035, v: .55 * v }); A.nz(t + .012, { type: 'bandpass', f: 1400 * k, q: 5, d: .03, v: .4 * v }); A.tone(t, { fc: [[0, 420 * k], [.05, 260]], d: .05, v: .2 * v }); A.crk(t + .01, .08, 140, .22 * v, 2600); },
  stone(A, t, v, k) { A.nz(t, { type: 'lowpass', f: 520 * k, d: .1, v: .6 * v }); A.tone(t, { fc: [[0, 120 * k], [.1, 60]], d: .12, v: .45 * v }); A.crk(t + .005, .18, [160, 30], .3 * v, 1800, 'bandpass', .9); A.metal(t, 1180 * k, [1, 1.73], [.5, .25], [.06, .04], .07 * v); },
  shell(A, t, v, k) { A.nz(t, { type: 'bandpass', f: 1700 * k, q: 3, d: .045, v: .55 * v }); A.tone(t, { w: 'triangle', fc: [[0, 480 * k], [.06, 300]], d: .06, v: .25 * v }); A.crk(t, .07, 220, .25 * v, 3000); A.tone(t, { fc: [[0, 130 * k], [.08, 60]], d: .08, v: .3 * v }); },
  spirit(A, t, v, k) { A.nz(t, { type: 'bandpass', q: 3, fc: [[0, 3200 * k], [.18, 500]], a: .004, d: .18, v: .4 * v }); A.tone(t, { f: 880 * k, a: .003, d: .3, v: .07 * v, vib: [9, 40, .02] }); A.tone(t, { f: 1318 * k, a: .003, d: .22, v: .04 * v }); },
};
// the weapon's element ringing on after the blow
const ELEM = {
  fire(A, t, v) { A.nz(t, { type: 'lowpass', fc: [[0, 600], [.08, 2400], [.3, 500]], a: .01, d: .25, v: .3 * v }); A.crk(t + .02, .22, 30, .16 * v, 2600); },
  frost(A, t, v) { for (let i = 0; i < 3; i++) A.tone(t + rnd(0, .06), { f: rnd(3200, 6000), a: .001, d: .08, v: .045 * v }); A.crk(t, .1, 70, .14 * v, 5000); },
  poison(A, t, v) { A.nz(t + .01, { type: 'bandpass', f: 1400, q: 2.5, a: .02, d: .16, v: .16 * v, am: [11, .6] }); const f = rnd(220, 380); A.tone(t + .03, { fc: [[0, f], [.05, f * 1.6]], d: .06, v: .14 * v }); },
  lightning(A, t, v) { const z = A.tone(t, { w: 'sawtooth', f: 160, a: .002, d: .1, v: .12 * v, filt: ['bandpass', 2400, 1] }); A.lfo(t, .12, 43, 90, z.osc.frequency, 'square'); A.crk(t, .1, 120, .2 * v, 3500); },
  holy(A, t, v) { A.tone(t + .01, { f: 1760 * rnd(.98, 1.02), a: .004, d: .35, v: .05 * v }); A.tone(t + .03, { f: 2637, a: .004, d: .3, v: .03 * v }); },
  shadow(A, t, v) { A.nz(t, { buf: 'pink', type: 'bandpass', q: 2, fc: [[0, 300], [.2, 900]], a: .02, d: .2, v: .22 * v }); A.tone(t, { w: 'sawtooth', fc: [[0, 110], [.2, 70]], a: .01, d: .18, v: .05 * v, filt: ['lowpass', 500, 1] }); },
};
setBodyLib({ MAT, ELEM }); // the weapon sound sets (weaponsfx.js) strike the same bodies
function hitCore(A, t, o, k, vm = 1) {
  const v = (o.heavy ? 1.15 : 1) * vm; (MAT[o.mat] || MAT.flesh)(A, t, v, k * (o.heavy ? .88 : 1));
  if (o.el && ELEM[o.el]) ELEM[o.el](A, t + .01, .9 * vm);
  if (o.heavy) A.tone(t, { fc: [[0, 80], [.2, 38]], a: .002, d: .22, v: .35 * vm });
}
// ---- round 22 (Roy: the weapons sound wrong. Metal must sound like metal, a big weapon push a stronger rush of air,
// a wooden one sound like wood). A weapon's voice is {wm: material, ws: size}: from W.sound {mat, size} (or W.mat /
// W.size) when the weapon data gives one, else the table below, else guessed from its id and style. V's swings (wh_*)
// and blows (hit_*) take it from opts.w (a weapon, or a {wm, ws}), else from the last audio.setWeapon(W).
export const WEAPON_MATS = ['iron', 'bronze', 'wood', 'stone', 'bone', 'crystal'];
export const WEAPON_SIZES = ['small', 'medium', 'large', 'huge'];
const WVOICE = {
  village_spear: ['bronze', 'large'], village_blade: ['iron', 'medium'], bronze_kopis: ['bronze', 'medium'], olive_club: ['wood', 'medium'], hoplite_dory: ['iron', 'medium'],
  harbor_daggers: ['iron', 'small'], minoan_labrys: ['bronze', 'medium'], cyclops_maul: ['stone', 'huge'], amazon_sagaris: ['iron', 'small'], hermes_blades: ['iron', 'small'],
  perseus_harpe: ['iron', 'medium'], asterion_axe: ['bronze', 'large'], poseidon_trident: ['bronze', 'medium'], medusa_fangs: ['bone', 'small'], athena_xiphos: ['iron', 'medium'],
  hephaestus_hammer: ['iron', 'huge'], hades_axe: ['iron', 'large'], erinyes_sickles: ['iron', 'small'], keraunos: ['crystal', 'large'], ares_warbringer: ['iron', 'huge'],
  kronos_scythe: ['iron', 'large'], sun_and_moon: ['iron', 'small'], keres_scythe: ['iron', 'large'], tide_trident: ['bronze', 'medium'],
};
const STYLE_SIZE = { dual: 'small', blade: 'medium', spear: 'medium', polearm: 'large', twohand: 'large' };
const WMAT_ALIAS = { metal: 'iron', steel: 'iron', adamant: 'iron', dragon: 'iron', gold: 'bronze', copper: 'bronze', brass: 'bronze', timber: 'wood', oak: 'wood', rock: 'stone', obsidian: 'stone', glass: 'crystal', ice: 'crystal', ivory: 'bone', horn: 'bone', tooth: 'bone' };
export function weaponVoice(W) {
  if (!W) return { wm: 'iron', ws: 'medium' };
  if (W.wm) return { wm: WMAT_ALIAS[W.wm] || (WEAPON_MATS.includes(W.wm) ? W.wm : 'iron'), ws: WEAPON_SIZES.includes(W.ws) ? W.ws : 'medium' };
  const id = String(W.id || ''), t = WVOICE[id] || WVOICE[W.base];
  let wm = (W.sound && W.sound.mat) || W.mat || (t && t[0]), ws = (W.sound && W.sound.size) || W.size || (t && t[1]);
  if (!wm) wm = /club|staff|wood|stick|oak|olive|branch|cudgel/.test(id) ? 'wood' : /maul|stone|rock|boulder|obsidian/.test(id) ? 'stone' : /bone|fang|tooth|tusk|claw/.test(id) ? 'bone'
    : /crystal|glass|ice/.test(id) ? 'crystal' : /bronze|labrys|kopis|trident/.test(id) ? 'bronze' : 'iron';
  if (!ws) ws = /maul|hammer|great|warbringer|colossal|titan/.test(id) ? 'huge' : /dagger|knife|fang|sickle|claw/.test(id) ? 'small' : STYLE_SIZE[W.style] || 'medium';
  return { wm: WMAT_ALIAS[wm] || (WEAPON_MATS.includes(wm) ? wm : 'iron'), ws: WEAPON_SIZES.includes(ws) ? ws : 'medium' };
}
const WSZ = { small: .8, medium: 1, large: 1.25, huge: 1.55 };
// the swing: what the weapon adds to the rush of air (d: the whoosh's length). Metal sings a faint "shing", bronze a
// warmer one, wood is a hollow rough whump with a creak of the grip, stone a heavy low push, bone a dry rattle, crystal a chime
const WSWING = {
  iron(A, t, d, k, z) { A.metal(t + d * .35, 3600 * k / Math.pow(z, .3), [1, 1.5, 2.13], [.4, .25, .15], [.2 * z, .14 * z, .09 * z], .022); A.nz(t + d * .25, { type: 'highpass', f: 6200, a: d * .15, d: d * .3, v: .07 }); },
  bronze(A, t, d, k, z) { A.metal(t + d * .35, 2500 * k / Math.pow(z, .3), [1, 1.58, 2.3], [.4, .25, .15], [.22 * z, .15 * z, .1 * z], .02); },
  wood(A, t, d, k, z) { A.nz(t, { buf: 'pink', type: 'bandpass', q: .9, fc: [[0, 260 / z], [d * .45, 720 / z], [d, 270 / z]], a: d * .4, d: d * .6, v: .3 }); A.crinkle(t, .05, .07, 1100, 1.2, .01, .02); },
  stone(A, t, d) { A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 200], [d * .45, 650], [d, 200]], a: d * .4, d: d * .6, v: .45 }); },
  bone(A, t, d) { A.crk(t + d * .2, d * .4, 60, .05, 3000); },
  crystal(A, t, d) { A.tone(t + d * .2, { fc: [[0, 2637], [d, 2960]], a: d * .3, d: d * .6, v: .016 }); A.tone(t + d * .25, { f: 3951, a: d * .3, d: d * .5, v: .009 }); },
};
// a big weapon shoves a column of air: a low pink rush and a sub-thump under the whoosh (none for small and medium ones)
function airPush(A, t, d, z) {
  if (z <= 1) return;
  A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 170], [d * .45, 640], [d, 190]], a: d * .42, d: d * .6, v: .55 * (z - 1) });
  A.tone(t + .02, { fc: [[0, 88], [d * .8, 44]], a: d * .35, d: d * .5, v: .32 * (z - 1) });
}
// the blow: what the weapon itself sounds like on the body (the body's own sound is hitCore's)
const WHIT = {
  iron(A, t, v, k, z) { A.nz(t, { type: 'highpass', fc: [[0, 6500 * k], [.05, 2600 * k]], d: .05, v: .4 * v }); A.metal(t + .003, 3400 * k / Math.pow(z, .4), [1, 1.47, 2.09, 2.76], [.5, .3, .2, .12], [.15 * z, .1 * z, .075 * z, .05 * z], .065 * v); },
  bronze(A, t, v, k, z) { A.nz(t, { type: 'bandpass', f: 3200 * k, q: 1.2, d: .04, v: .32 * v }); A.metal(t + .003, 2300 * k / Math.pow(z, .4), [1, 1.58, 2.24, 2.92], [.5, .32, .2, .12], [.2 * z, .14 * z, .1 * z, .07 * z], .065 * v); },
  wood(A, t, v, k, z) { A.tone(t, { fc: [[0, 560 * k / z], [.05, 420 * k / z]], a: .001, d: .07, v: .38 * v }); A.tone(t + .002, { f: 1250 * k / z, a: .001, d: .035, v: .14 * v }); A.nz(t, { type: 'bandpass', f: 1000 * k / z, q: 2.2, d: .04, v: .45 * v }); A.nz(t, { type: 'lowpass', f: 600, d: .05, v: .3 * v }); },
  stone(A, t, v, k) { A.nz(t, { type: 'lowpass', f: 650 * k, d: .14, v: .55 * v }); A.tone(t, { fc: [[0, 105 * k], [.14, 45]], d: .16, v: .45 * v }); A.crk(t + .004, .16, [180, 30], .25 * v, 1700, 'bandpass', .9); },
  bone(A, t, v, k) { A.nz(t, { type: 'bandpass', f: 2600 * k, q: 4, d: .025, v: .45 * v }); A.nz(t + .01, { type: 'bandpass', f: 1500 * k, q: 4, d: .025, v: .3 * v }); A.crk(t + .005, .06, 160, .18 * v, 2800); },
  crystal(A, t, v, k) { A.nz(t, { type: 'highpass', f: 5000, d: .02, v: .3 * v }); A.metal(t, 2200 * k, [1, 2.76, 5.4], [.5, .35, .2], [.45, .3, .2], .04 * v); },
};
function wHit(A, t, o, k, v = 1) {
  const z = WSZ[o.ws] || 1, C = WEAPON_AUDIO[o.wc]; (WHIT[o.wm] || WHIT.iron)(A, t, v * (C ? .75 + .25 * C.ring : 1), k, z);
  if (C) catHit(A, t, C, k, v); // round 33: the category's own blow (a chop, a puncture, a bash)
  if (z > 1) A.tone(t, { fc: [[0, 120 / z], [.18 * z, 38]], a: .002, d: .16 * z, v: .3 * (z - 1) * v }); // the weight behind it
}
// the shared body of every V swing: a whoosh sized to the weapon, the big ones' air push, the material's layer
function wSwing(A, t, o, k, { f, dur, q, v, pan }) {
  const C = WEAPON_AUDIO[o.wc]; if (C) { f = f.map((x) => x * C.swing.k); dur *= C.swing.len; } // round 33: the weapon category (axes lower and longer, spears quicker)
  const z = WSZ[o.ws] || 1, fz = 1 / Math.pow(z, .8), d = dur * Math.pow(z, .7), wood = o.wm === 'wood' || o.wm === 'stone';
  whoosh(A, t, { f: f.map((x) => x * fz * (wood ? .85 : 1)), dur: d, q: q * (wood ? .7 : o.wm === 'bone' ? 1.2 : 1), v: v * (.85 + .15 * z), pan });
  airPush(A, t, d, z); (WSWING[o.wm] || WSWING.iron)(A, t, d, k, z);
  if (C) catSwing(A, t, d, C, k);
  return d;
}

// ---------------- sound effects ----------------
// Each entry: f(A, t, opts) builds nodes on A (engine) starting at t; rv = reverb send, duck = [level, secs].
const SFX = {
  // ----- combat (kept names) -----
  swing: { f(A, t) { const k = rnd(.9, 1.1); A.nz(t, { type: 'bandpass', q: 1.6, fc: [[0, 700 * k], [.07, 2600 * k], [.18, 900 * k]], a: .05, d: .14, v: .8 }); } },
  swing3: { rv: .08, f(A, t) { A.nz(t, { type: 'bandpass', q: 1.3, fc: [[0, 450], [.1, 2000], [.27, 500]], a: .08, d: .2, v: .75 }); A.tone(t + .02, { fc: [[0, 160], [.2, 70]], a: .03, d: .2, v: .18 }); } },
  heavy_swing: { rv: .1, f(A, t) { A.nz(t, { type: 'bandpass', q: 1.2, fc: [[0, 260], [.14, 1100], [.36, 280]], a: .11, d: .26, v: .9 }); A.nz(t, { buf: 'pink', type: 'lowpass', f: 500, a: .1, d: .22, v: .4 }); A.tone(t + .03, { fc: [[0, 95], [.3, 48]], a: .06, d: .3, v: .28 }); } },
  dual_swing: { f(A, t) { for (const [w, k] of [[0, 1], [.075, .85]]) A.nz(t + w, { type: 'bandpass', q: 2, fc: [[0, 1100 * k], [.05, 3400 * k], [.11, 1500 * k]], a: .025, d: .09, v: .75 }); } },
  spear_thrust: { f(A, t) { A.nz(t, { type: 'bandpass', q: 2.5, fc: [[0, 600], [.09, 3200]], a: .02, h: .03, d: .08, v: .85 }); A.metal(t + .05, 2800, [1, 1.47], [.6, .3], [.12, .08], .06); A.tone(t, { fc: [[0, 220], [.1, 90]], a: .01, d: .1, v: .12 }); } },
  hit: { gap: .02, f(A, t) { const k = rnd(.9, 1.1); A.tone(t, { fc: [[0, 170 * k], [.09, 55]], a: .002, d: .14, v: .7 }); A.nz(t, { type: 'bandpass', f: 900 * k, q: 1, d: .06, v: .5 }); A.nz(t, { type: 'lowpass', f: 2500, d: .04, v: .4 }); } },
  crit: { rv: .35, f(A, t) { A.tone(t, { fc: [[0, 190], [.1, 50]], a: .002, d: .3, v: .6 }); A.nz(t, { type: 'highpass', f: 1500, d: .035, v: .6 }); A.nz(t, { type: 'bandpass', f: 900, q: 1, d: .08, v: .5 }); A.metal(t, 1850, [1, 1.47, 2.11], [.5, .35, .25], [.35, .25, .18], .18); } },
  clang: { rv: .3, gap: .05, f(A, t) { const k = rnd(.94, 1.06); A.metal(t, 820 * k, [1, 1.6, 2.61, 3.62, 4.4], [.5, .4, .35, .25, .15], [.5, .4, .3, .22, .15], .22); A.nz(t, { type: 'highpass', f: 4000, d: .04, v: .35 }); } },
  hurt: { f(A, t) { A.tone(t, { fc: [[0, 150], [.2, 50]], a: .002, d: .2, v: .6 }); A.nz(t, { type: 'bandpass', f: 1200, q: .8, d: .07, v: .4 }); A.tone(t + .01, { w: 'sawtooth', fc: [[0, 180], [.12, 120]], a: .01, d: .12, v: .15, filt: ['bandpass', 600, 2] }); } },
  dodge: { f(A, t) { A.nz(t, { type: 'bandpass', q: 1.1, fc: [[0, 350], [.1, 1500], [.2, 600]], a: .06, d: .14, v: .75 }); A.nz(t + .12, { type: 'lowpass', f: 3000, d: .06, v: .2 }); } },
  die: { rv: .2, f(A, t) { A.tone(t, { w: 'sawtooth', fc: [[0, 260], [.5, 55]], a: .01, d: .45, v: .3, filt: ['lowpass', 900, 1] }); A.nz(t, { type: 'lowpass', fc: [[0, 1400], [.5, 150]], a: .01, d: .5, v: .5 }); A.tone(t + .22, { fc: [[0, 120], [.25, 45]], a: .002, d: .25, v: .5 }); } },
  break: { rv: .15, f(A, t) { for (let i = 0; i < 5; i++) A.nz(t + i * .025, { type: 'bandpass', f: rnd(1500, 4000), q: 1.5, d: .05, v: .45 }); A.tone(t, { fc: [[0, 230], [.08, 180]], d: .08, v: .3 }); A.crk(t + .08, .35, 30, .25, 2500); } },
  pickup: { rv: .4, f(A, t) { [76, 80, 83].forEach((m, i) => A.pl(t + i * .07, m, .5)); A.tone(t + .2, { f: 2637, a: .005, d: .3, v: .05, vib: [7, 15] }); } },
  text: { gap: .025, f(A, t) { A.tone(t, { w: 'triangle', f: [880, 988, 1175, 1319][Math.random() * 4 | 0], a: .002, d: .03, v: .07, filt: ['lowpass', 3000, .7] }); } },
  ui: { rv: .1, f(A, t) { A.nz(t, { type: 'highpass', f: 3000, d: .01, v: .2 }); A.tone(t, { f: 1320, a: .002, d: .07, v: .18 }); A.tone(t, { f: 1980, a: .002, d: .04, v: .06 }); } },
  rumble: { rv: .3, f(A, t) { A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 320], [1.6, 50]], a: .25, d: 1.4, v: 1.2 }); A.tone(t, { fc: [[0, 55], [1.6, 30]], a: .2, d: 1.4, v: .35 }); A.crk(t + .2, 1.1, 12, .15, 1500, 'bandpass', 1); } },
  crack: { rv: .35, f(A, t) { A.nz(t, { type: 'highpass', f: 800, d: .08, v: .8 }); A.nz(t, { type: 'lowpass', fc: [[0, 1800], [.5, 100]], a: .005, d: .5, v: .7 }); A.tone(t, { fc: [[0, 120], [.6, 30]], d: .6, v: .5 }); A.crk(t + .05, .4, 40, .3, 2500); } },
  glyph: { rv: .7, f(A, t) { A.tone(t, { fc: [[0, 220], [1.2, 880]], a: .3, h: .4, d: .6, v: .12, vib: [6, 10, .3] }); A.tone(t + .1, { fc: [[0, 330], [1.2, 1320]], a: .3, h: .4, d: .6, v: .08 }); [69, 76, 81].forEach((m, i) => A.pl(t + .9 + i * .08, m, .3)); } },
  magic: { rv: .6, f(A, t) { for (let i = 0; i < 4; i++) { const f = 523 * Math.pow(1.26, i); A.tone(t + i * .08, { f, d: .5, v: .14 }); A.tone(t + i * .08, { f: f * 2, d: .3, v: .04 }); } } },
  caw: { rv: .3, f(A, t) { for (const w of [0, .24]) A.tone(t + w, { w: 'sawtooth', fc: [[0, 620], [.05, 700], [.2, 430]], a: .01, d: .2, v: .5, filt: ['bandpass', 1300, 2.5], am: [70, .4] }); } },
  // round 24 (the opening): thunder in the clouds. The crack of the bolt (a split snap and a buzz of crackle), then the
  // long roll, wobbling as it travels. opts.far: no crack, a lower and later roll (lightning seen far off)
  thunder: { rv: .7, f(A, t, o) {
    const far = !!o.far, r0 = far ? .18 : .04;
    if (!far) {
      A.nz(t, { type: 'highpass', f: 1400, d: .07, v: 1 }); A.crk(t, .35, [160, 40], .55, 2200);
      A.nz(t + .01, { buf: 'pink', type: 'lowpass', fc: [[0, 3200], [.4, 400]], a: .003, d: .45, v: .8 });
      A.tone(t, { fc: [[0, 110], [.5, 38]], a: .004, d: .55, v: .6 });
    }
    const r = A.nz(t + r0, { buf: 'brown', type: 'lowpass', fc: [[0, far ? 260 : 520], [3.6, 70]], a: far ? .5 : .12, h: .6, d: 3, v: far ? 1.3 : 1.6 }); A.wobble(r.g2, t + r0, 3.6, .18, .2);
    const r2 = A.nz(t + r0 + .5, { buf: 'brown', type: 'lowpass', fc: [[0, 180], [2.5, 50]], a: .4, d: 2.4, v: .9 }); A.wobble(r2.g2, t + r0 + .5, 2.8, .25, .3);
    A.tone(t + r0, { fc: [[0, 46], [3, 28]], a: .2, h: .5, d: 2.5, v: .45 });
    A.crk(t + r0 + .2, 2, [30, 4], .12, 900, 'bandpass', 1);
  } },
  // round 24 (the opening, the one in the dark at work): small sounds of hands busy with something. opts.k picks one
  // (else a random one): 0 cloth rustling, 1 a thin metal tick (a pin, a link), 2 thread drawn tight, 3 a small thing
  // set down on stone, 4 a tiny chain of clinks
  fiddle: { rv: .3, gap: .08, f(A, t, o) {
    const k = o.k ?? (Math.random() * 5 | 0);
    if (k === 0) { A.crinkle(t, rnd(.25, .5), .22, rnd(700, 1100), .8, .012, .035); A.nz(t, { buf: 'pink', type: 'lowpass', f: 600, a: .08, d: .25, v: .08 }); }
    else if (k === 1) { A.metal(t, rnd(3200, 4200), [1, 1.53, 2.4], [.5, .3, .15], [.09, .06, .04], .05); A.nz(t, { type: 'highpass', f: 5000, d: .006, v: .1 }); }
    else if (k === 2) { A.nz(t, { type: 'bandpass', q: 6, fc: [[0, rnd(1800, 2400)], [.18, rnd(3000, 3800)]], a: .03, d: .16, v: .14 }); A.crk(t, .18, 60, .05, 3500); }
    else if (k === 3) { A.tone(t, { fc: [[0, 260], [.05, 170]], a: .001, d: .06, v: .14, filt: ['lowpass', 900, .7] }); A.nz(t, { type: 'bandpass', f: rnd(1200, 1800), q: 2, d: .025, v: .16 }); A.metal(t + .005, rnd(1900, 2400), [1, 2.7], [.3, .15], [.05, .03], .04); }
    else for (let i = 0; i < 3 + (Math.random() * 3 | 0); i++) A.metal(t + i * rnd(.04, .08), rnd(4200, 5400), [1, 1.41], [.5, .25], [.05, .03], .03);
  } },
  thread: { rv: .6, f(A, t) { A.pl(t, 88, .5); A.tone(t, { f: 1760, a: .05, d: .6, v: .08, vib: [5.5, 6] }); A.nz(t + .45, { type: 'highpass', fc: [[0, 6000], [.3, 2000]], d: .3, v: .12 }); } },

  // ----- progression / items / ui -----
  levelup: { rv: .55, duck: [.4, 2.4], f(A, t) {
    [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => A.pl(t + i * .05, m, .5 - i * .03));
    const t2 = t + .38, lp = A.F('lowpass', 2400, .6), cg = A.G(0);
    cg.gain.setValueAtTime(0, t2); cg.gain.linearRampToValueAtTime(.06, t2 + .15); cg.gain.setValueAtTime(.06, t2 + 1); cg.gain.setTargetAtTime(0, t2 + 1, .25);
    A.chain(lp, cg, A._o.out);
    for (const m of [62, 66, 69, 74]) for (const d of [-8, 8]) { const o = A.O('sawtooth', mtof(m)); o.detune.value = d; o.connect(lp); o.start(t2); o.stop(t2 + 2.4); }
    for (const f of [1760, 2349.3, 2960]) A.tone(t2 + rnd(0, .2), { f, a: .3, d: 1.6, v: .035, am: [9, .5] });
    A.dr(t2, 'b', .7); A.dr(t2, 'c', .3); A._mark(t2 + 2.4);
  } },
  discover: { rv: .55, duck: [.45, 1.8], f(A, t) {
    [76, 71, 76, 80, 83].forEach((m, i) => A.pl(t + i * .085, m, .45));
    const t2 = t + .34; A.pl(t2, 88, .3);
    for (const f of [987.77, 1975.5]) A.tone(t2, { f, a: .05, h: .3, d: 1, v: .045, vib: [6, 8, .2] });
    A.dr(t2, 'c', .25);
  } },
  quest_accept: { rv: .35, f(A, t) { A.crinkle(t, .25, .35, 3000, .8); A.pl(t + .08, 69, .45); A.pl(t + .2, 76, .5); A.dr(t + .2, 'k', .3); } },
  quest_done: { rv: .5, duck: [.45, 2.2], f(A, t) {
    for (const w of [0, .11, .22]) A.pl(t + w, 74, .35);
    const t2 = t + .33; [62, 66, 69, 74, 78].forEach((m, i) => A.pl(t2 + i * .025, m, .3)); A.pl(t2, 81, .45);
    for (const f of [440, 293.66]) A.tone(t2, { w: 'sawtooth', f, a: .04, h: .5, d: .5, v: .05, filt: ['lowpass', 1800, .7], vib: [5, 8, .2] });
    A.dr(t, 't', .4); A.dr(t2, 'b', .5); A.dr(t2, 'c', .3);
  } },
  item: { rv: .4, f(A, t) { A.pl(t, 81, .45); A.pl(t + .07, 88, .45); A.tone(t + .1, { f: 3520, d: .25, v: .04 }); A.tone(t + .16, { f: 4186, d: .25, v: .04 }); } },
  equip: { rv: .2, f(A, t) { A.nz(t, { type: 'bandpass', q: 3, fc: [[0, 2200], [.22, 8000]], a: .01, d: .22, v: .7 }); A.metal(t, 3150, [1, 1.5, 2], [.6, .4, .3], [.3, .22, .15], .08); A.nz(t, { type: 'lowpass', f: 400, d: .05, v: .4 }); } },
  potion: { rv: .2, f(A, t) {
    A.tone(t, { fc: [[0, 350], [.03, 1100]], a: .001, d: .04, v: .25 }); A.nz(t, { type: 'highpass', f: 2000, d: .01, v: .2 });
    for (const w of [.22, .44, .64]) { A.tone(t + w, { fc: [[0, 280], [.07, 150]], a: .01, d: .1, v: .5, filt: ['lowpass', 600, .7] }); A.nz(t + w, { type: 'bandpass', f: 450, q: 3, a: .005, d: .06, v: .3 }); }
    [1318.5, 1760, 2637].forEach((f, i) => A.tone(t + .85 + i * .05, { f, d: .4, v: .05 }));
  } },
  chest: { rv: .35, f(A, t) {
    A.bufp(t, A._tex('creak0'), .5, .9);
    A.tone(t + .5, { fc: [[0, 150], [.12, 80]], d: .12, v: .4 }); A.nz(t + .5, { type: 'bandpass', f: 320, q: 4, d: .15, v: .4 });
    [84, 88, 91, 96].forEach((m, i) => A.pl(t + .6 + i * .06, m, .35));
    A.tone(t + .6, { f: 2093, a: .1, d: .9, v: .03, am: [8, .5] });
  } },
  map_open: { rv: .15, f(A, t) { A.crinkle(t, .38, .45, 2600, .7); A.nz(t, { type: 'lowpass', f: 700, a: .02, d: .12, v: .3 }); A.pl(t + .25, 74, .2); } },
  map_close: { rv: .1, f(A, t) { A.crinkle(t, .22, .35, 2400, .7); A.nz(t + .18, { type: 'lowpass', f: 400, d: .06, v: .4 }); } },
  inv_open: { rv: .1, f(A, t) { A.crinkle(t, .3, .7, 1100, .9, .014, .03); A.metal(t + .12, 2900, [1, 1.41], [.6, .3], [.08, .06], .08); A.metal(t + .19, 3300, [1, 1.41], [.6, .3], [.08, .06], .06); } },
  inv_close: { rv: .1, f(A, t) { A.crinkle(t, .2, .6, 1000, .9, .014, .03); A.nz(t + .16, { type: 'lowpass', f: 350, d: .06, v: .4 }); A.metal(t + .05, 3100, [1, 1.41], [.6, .3], [.08, .06], .06); } },
  bell: { rv: .7, f(A, t) { A.metal(t, 330, [.5, 1, 1.19, 1.5, 2, 2.5, 3, 4.2], [.3, .45, .3, .2, .4, .15, .1, .06], [3.5, 2.8, 2.2, 1.8, 1.5, 1, .8, .5], .25); A.nz(t, { type: 'highpass', f: 2000, d: .015, v: .3 }); } },
  // round 22 (Roy: the doors don't sound good, and each kind of door needs its own sound): door_<kind>, opts.open
  // (default true; false = it shuts). audio.door(kind, open) picks one; 'door' alone (opts.kind) stays for old callers.
  door: { rv: .3, f(A, t, o) { SFX['door_' + doorKind(o.kind)].f(A, t, o); } },
  // a wooden house door: the latch lifts, the hinges creak, air moves; shut: a short creak, the wooden thud, the latch drops
  door_house: { rv: .25, f(A, t, o) {
    const latch = (x, v = 1) => { A.nz(x, { type: 'bandpass', f: 2600, q: 4, d: .015, v: .4 * v }); A.metal(x, 2900 * rnd(.95, 1.05), [1, 1.6], [.5, .3], [.04, .03], .045 * v); };
    if (o.open !== false) {
      latch(t); A.nz(t + .055, { type: 'bandpass', f: 1800, q: 4, d: .012, v: .25 });
      A.bufp(t + .1, A._tex('creak0'), .3, rnd(.85, 1.05)); A.nz(t + .12, { buf: 'pink', type: 'lowpass', f: 500, a: .25, d: .35, v: .12 });
    } else {
      A.bufp(t, A._tex('creak1'), .2, 1.25); A.nz(t, { buf: 'pink', type: 'lowpass', f: 450, a: .12, d: .15, v: .14 });
      A.tone(t + .3, { fc: [[0, 120], [.12, 70]], a: .002, d: .14, v: .5 }); A.nz(t + .3, { type: 'bandpass', f: 240, q: 1.4, d: .1, v: .55 }); A.nz(t + .3, { type: 'bandpass', f: 1100, q: 2, d: .03, v: .25 });
      latch(t + .34, .8);
    }
  } },
  // a temple's bronze double doors: a slow deep groan, the bronze humming in its frame, a scrape over the stone floor and
  // a boom where they come to rest; shut: the groan, then the great boom
  door_temple: { rv: .6, f(A, t, o) {
    const boom = (x, v) => { A.tone(x, { fc: [[0, 75], [.6, 38]], a: .003, d: .7, v: .5 * v }); A.metal(x, 140 * rnd(.97, 1.03), [1, 2.4, 3.9], [.5, .3, .2], [1.2, .9, .6], .07 * v); A.nz(x, { type: 'lowpass', f: 420, d: .3, v: .45 * v }); };
    if (o.open !== false) {
      A.bufp(t, A._tex('creak2'), .4, .45); A.bufp(t + .18, A._tex('creak0'), .26, .55);
      A.metal(t + .05, 160, [1, 2.32, 3.7, 4.9, 6.1], [.5, .35, .25, .18, .1], [1.8, 1.4, 1.1, .8, .6], .05);
      const r = A.nz(t + .1, { buf: 'brown', type: 'bandpass', f: 320, q: 1, a: .3, h: .6, d: .5, v: .35 }); A.wobble(r.g2, t + .1, 1.2, .08, .06);
      boom(t + 1.25, .7);
    } else {
      A.bufp(t, A._tex('creak2'), .32, .55);
      const r = A.nz(t, { buf: 'brown', type: 'bandpass', f: 300, q: 1, a: .2, h: .3, d: .3, v: .3 }); A.wobble(r.g2, t, .7, .08, .06);
      boom(t + .7, 1); A.crk(t + .72, .5, [80, 8], .1, 2000);
    }
  } },
  // a big gate (wood strapped with iron: town, fort, arena gateways): two creaking leaves, the strapping and chain rattling,
  // the beams rolling; it stops with a thud. Shut: a slam, then the iron bolt
  door_gate: { rv: .45, f(A, t, o) {
    if (o.open !== false) {
      A.bufp(t, A._tex('creak1'), .32, .62); A.bufp(t + .12, A._tex('creak2'), .26, .7);
      A.crinkle(t + .05, .8, .14, 3200, 3, .02, .05);
      const r = A.nz(t, { buf: 'brown', type: 'bandpass', f: 200, q: 1, a: .25, h: .5, d: .4, v: .3 }); A.wobble(r.g2, t, 1, .08, .06);
      A.tone(t + 1.1, { fc: [[0, 90], [.2, 55]], a: .003, d: .25, v: .45 }); A.nz(t + 1.1, { type: 'bandpass', f: 300, q: 1.3, d: .15, v: .45 });
    } else {
      A.bufp(t, A._tex('creak1'), .26, .8);
      const x = t + .45; A.tone(x, { fc: [[0, 100], [.35, 45]], a: .002, d: .4, v: .7 }); A.nz(x, { type: 'bandpass', f: 260, q: 1.2, d: .25, v: .7 }); A.nz(x, { type: 'bandpass', f: 1200, q: 2, d: .05, v: .35 });
      A.metal(x + .17, 900, [1, 2.1, 3.3], [.5, .3, .2], [.3, .2, .12], .1); A.nz(x + .17, { type: 'highpass', f: 3000, d: .02, v: .3 });
    }
  } },
  // a stone slab (tombs, vaults, sealed doors of old): a gritty grinding slide with a low rumble, a heavy clunk at the end
  door_stone: { rv: .5, f(A, t, o) {
    const L = o.open !== false ? 1.4 : .7;
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', f: 380, a: .15, h: L - .3, d: .35, v: .28 }); A.wobble(r.g2, t, L + .1, .06, .04);
    A.crk(t, L, 90, .13, 1500, 'bandpass', 1.2); A.nz(t, { type: 'bandpass', f: 900, q: 1.5, a: .15, h: L - .3, d: .3, v: .1 });
    A.tone(t, { f: 48, a: .2, h: L - .4, d: .4, v: .12 });
    const x = t + L + .05; A.tone(x, { fc: [[0, 85], [.3, 42]], a: .002, d: .35, v: o.open !== false ? .45 : .6 }); A.nz(x, { type: 'lowpass', f: 600, d: .2, v: .5 }); A.crk(x, .45, [60, 5], .12, 2200);
  } },
  // iron bars / a portcullis: raised on a ratcheting chain (clicks and a hum of links); dropped: a rattle and the iron slam
  door_bars: { rv: .4, f(A, t, o) {
    if (o.open !== false) {
      for (let i = 0; i < 14; i++) { const x = t + i * .075 + rnd(0, .01); A.metal(x, rnd(1900, 2300), [1, 1.5], [.5, .3], [.04, .03], .045); A.nz(x, { type: 'highpass', f: 3000, d: .008, v: .12 }); }
      A.crinkle(t, 1.1, .12, 2600, 2, .015, .04); A.tone(t, { f: 110, a: .2, h: .7, d: .3, v: .06, filt: ['lowpass', 400, .7] });
    } else {
      A.crinkle(t, .35, .2, 2800, 2, .01, .02);
      const x = t + .35; A.metal(x, 210, [1, 1.83, 2.76, 3.9, 5.3], [.5, .4, .3, .2, .1], [.9, .7, .5, .35, .25], .13);
      A.tone(x, { fc: [[0, 70], [.5, 35]], a: .002, d: .5, v: .55 }); A.nz(x, { type: 'lowpass', f: 1500, d: .08, v: .5 }); A.crk(x + .02, .3, [200, 20], .12, 3000);
    }
  } },
  // heavy iron doors (the gate of the underworld): a rusty hinge squeal over a huge iron body humming, a clang at the stop
  door_iron: { rv: .55, f(A, t, o) {
    const op = o.open !== false, L = op ? 1.2 : .6;
    A.tone(t, { w: 'sawtooth', fc: [[0, 620], [L * .45, 760], [L, 690]], a: .08, h: L * .6, d: .25, v: .022, filt: ['bandpass', 1400, 4], am: [17, .5] });
    A.bufp(t + .05, A._tex('creak0'), .25, .9);
    A.metal(t, 95, [1, 2.7, 4.2, 5.9], [.5, .3, .2, .12], [1.6, 1.1, .8, .5], .05);
    const x = t + L; A.metal(x, 180, [1, 2.45, 3.6, 5.2], [.5, .35, .2, .12], [1.1, .8, .55, .35], op ? .1 : .14);
    A.tone(x, { fc: [[0, 80], [.5, 38]], a: .002, d: .55, v: op ? .4 : .6 }); A.nz(x, { type: 'lowpass', f: 900, d: .1, v: .45 });
  } },
  // a cave mouth (no door): the air changes (a low rush that swells and settles), pebbles under the boots, a drip within
  door_cave: { rv: .5, f(A, t, o) {
    const L = o.open !== false ? 1 : .8;
    A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 150], [L * .4, 520], [L, 170]], a: L * .4, d: L * .6, v: .45 });
    A.crk(t + .08, .5, 25, .1, 2500);
    for (let i = 0; i < 3; i++) A.tone(t + rnd(.1, .5), { f: rnd(2000, 3000), a: .001, d: .02, v: .03 });
    A.tone(t + rnd(.45, .75), { fc: [[0, 1200], [.04, 2200]], a: .001, d: .05, v: .05 });
  } },
  // a lock (a chest, a cell, a door unlocked): the key goes in, turns in two clicks, the bolt slides and clunks home
  door_lock: { rv: .2, f(A, t, o) {
    const click = (x, f) => A.metal(x, f, [1, 1.7], [.5, .3], [.05, .03], .06);
    const clunk = (x) => { A.tone(x, { fc: [[0, 220], [.06, 140]], a: .001, d: .07, v: .3 }); A.metal(x, 900, [1, 2.2], [.5, .3], [.12, .08], .07); };
    const slide = (x, up) => A.nz(x, { type: 'bandpass', fc: up ? [[0, 1200], [.12, 1800]] : [[0, 1800], [.12, 1200]], q: 2, a: .02, d: .12, v: .28 });
    A.nz(t, { type: 'bandpass', f: 3000, q: 3, d: .03, v: .18 });
    if (o.open !== false) { click(t + .12, 2500); click(t + .2, 2250); slide(t + .25, true); clunk(t + .38); }
    else { slide(t + .08, false); clunk(t + .2); click(t + .3, 2400); }
  } },
  // a cart's or chariot's little door / side-board: a latch, a small creak, a wooden knock
  door_cart: { rv: .1, f(A, t, o) {
    const latch = (x) => { A.nz(x, { type: 'bandpass', f: 2400, q: 4, d: .012, v: .35 }); A.metal(x, 2700, [1, 1.6], [.5, .3], [.03, .02], .04); };
    const knock = (x, v) => { A.tone(x, { fc: [[0, 170], [.08, 95]], a: .001, d: .09, v: .42 * v }); A.nz(x, { type: 'bandpass', f: 650, q: 1.5, d: .06, v: .4 * v }); };
    if (o.open !== false) { latch(t); A.bufp(t + .06, A._tex('creak2'), .14, 1.4); knock(t + .3, .5); }
    else { A.bufp(t, A._tex('creak1'), .1, 1.5); knock(t + .16, 1); latch(t + .19); }
  } },

  // ----- travel / portals / horse / boat -----
  portal_enter: { rv: .8, f(A, t) {
    A.nz(t, { type: 'bandpass', q: 2.5, fc: [[0, 250], [.9, 3200]], a: .55, d: .45, v: .7 });
    [440, 659.3, 880, 1108.7, 1318.5, 1760].forEach((f, i) => A.tone(t + i * .04, { fc: [[0, f], [1, f * 2]], a: .35, h: .2, d: .6, v: .035, am: [7, .5] }));
    A.tone(t, { fc: [[0, 110], [.8, 220]], a: .3, d: .5, v: .25 });
    A.nz(t + .95, { type: 'lowpass', f: 900, a: .01, d: .4, v: .4 }); A.pl(t + .95, 93, .25);
  } },
  portal_exit: { rv: .8, f(A, t) {
    A.nz(t, { type: 'bandpass', q: 2.5, fc: [[0, 3200], [.8, 300]], a: .1, d: .7, v: .7 });
    [440, 659.3, 880, 1108.7, 1318.5, 1760].forEach((f, i) => A.tone(t + i * .04, { fc: [[0, f * 2], [.9, f]], a: .05, h: .2, d: .7, v: .035, am: [7, .5] }));
    A.tone(t, { fc: [[0, 220], [.6, 90]], a: .05, d: .6, v: .25 });
    A.tone(t + .8, { fc: [[0, 90], [.2, 45]], d: .2, v: .5 }); A.nz(t + .8, { type: 'lowpass', f: 300, d: .1, v: .4 });
  } },
  fast_travel: { rv: .9, duck: [.5, 2.5], f(A, t) {
    A.nz(t, { type: 'bandpass', q: 2.2, fc: [[0, 200], [1.4, 3500], [2.2, 600]], a: .9, d: 1.2, v: .6 });
    A.choir(t + .2, [62, 69, 74, 78], .4, .6, 1, .22);
    [587.3, 880, 1174.7, 1480].forEach((f, i) => A.tone(t + .3 + i * .07, { fc: [[0, f], [1.2, f * 2]], a: .4, h: .3, d: .8, v: .03, am: [8, .5] }));
    A.pl(t + 1.6, 86, .35); A.dr(t + 1.6, 'c', .3);
  } },
  whistle: { rv: .45, f(A, t) {
    const k = rnd(.97, 1.03), t2 = t + .32;
    A.tone(t, { fc: [[0, 1550 * k], [.16, 2350 * k]], a: .03, h: .07, d: .07, v: .2 });
    A.tone(t, { fc: [[0, 3100 * k], [.16, 4700 * k]], a: .03, h: .07, d: .07, v: .012 });
    A.tone(t2, { fc: [[0, 2250 * k], [.05, 2480 * k], [.34, 2420 * k], [.48, 1850 * k]], a: .02, h: .32, d: .12, v: .2, vib: [6, 14, .12] });
    A.tone(t2, { fc: [[0, 4500 * k], [.05, 4960 * k], [.34, 4840 * k], [.48, 3700 * k]], a: .02, h: .32, d: .12, v: .012 });
    A.nz(t, { type: 'bandpass', f: 2300, q: 2, a: .03, h: .12, d: .1, v: .05 }); A.nz(t2, { type: 'bandpass', f: 2400, q: 2, a: .02, h: .3, d: .12, v: .05 });
  } },
  neigh: { rv: .3, gap: .5, f(A, t) {
    const k = rnd(.92, 1.08), dur = 1.45, o = A.O('sawtooth', 520 * k), F = o.frequency;
    F.setValueAtTime(520 * k, t); F.exponentialRampToValueAtTime(1000 * k, t + .12); F.exponentialRampToValueAtTime(880 * k, t + .45); F.exponentialRampToValueAtTime(430 * k, t + 1.3);
    const wob = A.O('sine', 13), wg = A.G(0); wob.frequency.setValueAtTime(13, t); wob.frequency.linearRampToValueAtTime(8, t + 1.3);
    wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(70 * k, t + .35); wg.gain.linearRampToValueAtTime(45 * k, t + 1.3); wob.connect(wg); wg.connect(F);
    const am = A.G(.8), ag = A.G(0); ag.gain.setValueAtTime(0, t); ag.gain.linearRampToValueAtTime(.12, t + .4); ag.gain.linearRampToValueAtTime(.4, t + 1.2); wob.connect(ag); ag.connect(am.gain);
    for (const [type, f, q, g] of [['bandpass', 1150, 3, 1.4], ['bandpass', 2600, 4, .8], ['lowpass', 1600, .7, .35]]) { const b = A.F(type, f, q), bg = A.G(g); o.connect(b); b.connect(bg); bg.connect(am); }
    const env = A.G(0); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(.55, t + .05); env.gain.setValueAtTime(.5, t + .9); env.gain.linearRampToValueAtTime(0, t + dur);
    A.chain(am, env, A.F('lowpass', 4200, .7), A._o.out);
    A.nz(t, { type: 'bandpass', f: 1800, q: .8, a: .4, h: .7, d: .4, v: .12 });
    A.nz(t + 1.25, { type: 'lowpass', f: 1200, a: .03, d: .35, v: .35, am: [24, .5] });
    o.start(t); wob.start(t); o.stop(t + dur + .05); wob.stop(t + dur + .05); A._mark(t + 1.7);
  } },
  // round 19 (giants.js): Damalis' bellow (a low saw through a closed mouth that opens to "oo" and shuts, a growl in the throat),
  // and a heavy load dragged over dirt
  moo: { rv: .45, gap: .9, f(A, t) {
    const k = rnd(.9, 1.1), dur = 1.75, o = A.O('sawtooth', 110 * k), F = o.frequency;
    F.setValueAtTime(100 * k, t); F.exponentialRampToValueAtTime(152 * k, t + .35); F.exponentialRampToValueAtTime(138 * k, t + 1.15); F.exponentialRampToValueAtTime(86 * k, t + dur);
    const lp = A.F('lowpass', 280, 2.2), LF = lp.frequency; LF.setValueAtTime(280, t); LF.linearRampToValueAtTime(980, t + .45); LF.linearRampToValueAtTime(720, t + 1.2); LF.linearRampToValueAtTime(240, t + dur);
    const bp = A.F('bandpass', 430, 2.4), bg = A.G(1.2), env = A.G(0);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(.7, t + .14); env.gain.setValueAtTime(.62, t + 1.2); env.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp); lp.connect(bp); bp.connect(bg); bg.connect(env); lp.connect(env);
    A.chain(env, A.F('lowpass', 2400, .7), A._o.out);
    A.nz(t + .08, { buf: 'brown', type: 'bandpass', f: 240, q: 1.2, a: .25, h: .8, d: .5, v: .4, am: [29, .6] });
    o.start(t); o.stop(t + dur + .05); A._mark(t + 2);
  } },
  drag: { rv: .1, gap: .2, f(A, t) { A.nz(t, { buf: 'brown', type: 'bandpass', f: rnd(320, 460), q: .9, a: .06, h: .18, d: .3, v: .55 }); A.crk(t, .4, 30, .05, 1800, 'bandpass', 1); } },
  snort: { rv: .15, gap: .3, f(A, t) { A.nz(t, { type: 'lowpass', f: 1300, a: .02, h: .1, d: .2, v: .7, am: [27, .8] }); A.nz(t, { type: 'bandpass', f: 600, q: 1, a: .01, d: .25, v: .3 }); A.tone(t, { fc: [[0, 110], [.2, 80]], d: .2, v: .1 }); } },
  mount: { rv: .1, f(A, t) { A.bufp(t, A._tex('creak2'), .25, 1.3); A.tone(t + .18, { fc: [[0, 110], [.12, 55]], d: .12, v: .5 }); A.nz(t + .18, { type: 'lowpass', f: 400, d: .08, v: .5 }); A.metal(t + .2, 3600, [1, 1.3, 1.7], [.5, .4, .3], [.1, .08, .06], .06); A.dr(t + .2, 'h', .25); } },
  dismount: { rv: .1, f(A, t) { A.bufp(t, A._tex('creak2'), .2, 1.4); A.tone(t + .05, { fc: [[0, 90], [.15, 45]], d: .15, v: .6 }); A.nz(t + .05, { type: 'lowpass', f: 300, d: .1, v: .55 }); A.nz(t + .06, { type: 'bandpass', f: 1500, d: .08, v: .2 }); } },
  board: { rv: .25, f(A, t) { A.tone(t, { fc: [[0, 165], [.2, 150]], d: .2, v: .4 }); A.tone(t, { f: 380, d: .1, v: .15 }); A.nz(t, { type: 'bandpass', f: 180, q: 6, d: .2, v: .6 }); A.nz(t + .05, { type: 'lowpass', f: 900, a: .03, d: .3, v: .35 }); A.bufp(t + .15, A._tex('creak0'), .2, .8); } },
  splash: { rv: .25, f(A, t) {
    A.nz(t, { type: 'bandpass', f: 1500, q: .7, a: .003, d: .15, v: .7 }); A.nz(t, { type: 'highpass', f: 3000, a: .01, d: .4, v: .3 }); A.nz(t, { type: 'lowpass', f: 600, a: .02, d: .3, v: .4 });
    for (let i = 0; i < 6; i++) { const f = rnd(400, 1200); A.tone(t + .05 + rnd(0, .35), { fc: [[0, f], [.04, f * 1.6]], a: .002, d: .05, v: .08 }); }
  } },
  gull: { rv: .3, f(A, t) { [0, .3, .55].forEach((w, i) => A.tone(t + w, { w: 'sawtooth', fc: [[0, 1250], [.05, 1750], [i === 2 ? .14 : .22, 1050]], a: .012, d: i === 2 ? .14 : .22, v: .7, filt: ['bandpass', 2100, 2], am: [55, .35] })); } },

  // ----- elements -----
  fire: { rv: .15, f(A, t) { A.nz(t, { type: 'lowpass', fc: [[0, 400], [.12, 2600], [.45, 600]], a: .03, d: .4, v: .7 }); A.crk(t + .05, .35, 25, .3, 2500); A.tone(t, { fc: [[0, 90], [.2, 60]], d: .2, v: .2 }); } },
  frost: { rv: .45, f(A, t) { for (let i = 0; i < 6; i++) A.tone(t + rnd(0, .12), { f: rnd(3000, 7000), a: .001, d: rnd(.08, .15), v: .06 }); A.tone(t, { f: 2637, a: .01, d: .5, v: .05 }); A.tone(t, { f: 2650, a: .01, d: .5, v: .05 }); A.crk(t, .2, 60, .3, 4500); } },
  poison: { rv: .2, f(A, t) { for (let i = 0; i < 6; i++) { const f = rnd(180, 450); A.tone(t + i * .06 + rnd(0, .03), { fc: [[0, f], [.05, f * 1.5]], a: .003, d: .07, v: .25 }); } A.nz(t, { type: 'bandpass', f: 1600, q: 2, a: .05, d: .3, v: .3, am: [9, .6] }); } },
  lightning: { rv: .3, f(A, t) { const z = A.tone(t, { w: 'sawtooth', f: 180, a: .002, d: .25, v: .4, filt: ['bandpass', 2000, .8] }); A.lfo(t, .3, 37, 140, z.osc.frequency, 'square'); A.crk(t, .25, 80, .4, 3000); A.nz(t, { type: 'highpass', f: 2000, d: .02, v: .5 }); } },
  petrify: { rv: .3, f(A, t) { A.crk(t, .7, [8, 70], .4, 2800); A.nz(t, { buf: 'brown', type: 'lowpass', f: 220, a: .2, d: .6, v: 1.2, am: [13, .6] }); A.nz(t + .72, { type: 'bandpass', f: 1600, q: 2, d: .03, v: .6 }); A.tone(t + .72, { f: 320, d: .05, v: .25 }); A.tone(t + .72, { fc: [[0, 100], [.15, 60]], d: .15, v: .35 }); } },

  // ----- skills -----
  skill_aegis: { rv: .45, f(A, t) { A.metal(t, 180, [1, 1.62, 2.31, 2.93, 3.64, 4.72, 5.9], [.5, .45, .4, .3, .25, .15, .1], [1.2, 1, .8, .6, .45, .3, .2], .3); A.tone(t, { fc: [[0, 110], [.25, 42]], a: .001, d: .25, v: .6 }); A.nz(t, { type: 'lowpass', f: 2000, d: .04, v: .5 }); A.nz(t, { type: 'highpass', f: 3500, d: .03, v: .3 }); } },
  skill_fate: { rv: .7, f(A, t) {
    [88, 85, 81, 76, 73, 69].forEach((m, i) => A.pl(t + i * .035, m, .35));
    A.tone(t, { f: 1318.5, a: .1, h: .4, d: .9, v: .06, vib: [5, 10] }); A.tone(t, { f: 1321.8, a: .1, h: .4, d: .9, v: .06 });
    A.tone(t, { fc: [[0, 196], [.8, 98]], a: .1, d: .7, v: .2 }); A.nz(t, { type: 'highpass', f: 7000, a: .2, d: .8, v: .08 });
  } },
  skill_whirl: { rv: .2, f(A, t) {
    const n = A.nz(t, { type: 'bandpass', f: 1400, q: 2.5, a: .06, h: .35, d: .4, v: .8, am: [6.5, .7], pan: 0 });
    const l = A.lfo(t, .9, 6.5, 900, n.f.frequency); l.frequency.linearRampToValueAtTime(8, t + .8);
    if (n.p && n.p.pan) { const lp = A.lfo(t + 1 / 26, .9, 6.5, .7, n.p.pan); lp.frequency.linearRampToValueAtTime(8, t + .8); }
    A.metal(t, 2600, [1, 1.5], [.6, .3], [.15, .1], .05); A.tone(t, { fc: [[0, 120], [.6, 90]], a: .1, d: .6, v: .1 });
  } },
  skill_dash: { rv: .15, f(A, t) { A.nz(t, { type: 'bandpass', q: 4, fc: [[0, 600], [.12, 6000]], a: .005, h: .04, d: .1, v: .7 }); A.tone(t, { fc: [[0, 1800], [.18, 400]], a: .005, d: .16, v: .1 }); A.tone(t + .15, { fc: [[0, 140], [.15, 55]], d: .15, v: .6 }); A.nz(t + .15, { type: 'lowpass', f: 1500, d: .05, v: .5 }); A.metal(t + .15, 3000, [1, 1.47], [.5, .3], [.1, .08], .05); } },
  skill_heal: { rv: .8, f(A, t) {
    A.choir(t, [57, 61, 64, 69], .3, .7, 1, .25);
    for (let i = 0; i < 8; i++) A.tone(t + rnd(0, 1.5), { f: rnd(2000, 5000), d: .2, v: .04 });
    [81, 88, 93].forEach((m, i) => A.pl(t + .1 + i * .1, m, .3));
  } },
  skill_quake: { rv: .4, f(A, t) {
    A.tone(t, { fc: [[0, 68], [.6, 28]], a: .003, d: 1, v: .75 }); A.nz(t, { type: 'lowpass', f: 400, d: .25, v: .6 });
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', f: 180, a: .05, h: .3, d: 1.5, v: 1 }); A.wobble(r.g2, t, 1.8, .08, .2);
    A.crk(t + .15, 1.2, 10, .3, 1800, 'bandpass', 1);
  } },
  skill_thunder: { rv: .5, f(A, t) {
    A.nz(t, { type: 'highpass', f: 1000, d: .06, v: 1 });
    const z = A.tone(t, { w: 'sawtooth', f: 120, a: .002, d: .15, v: .3, filt: ['bandpass', 1800, .8] }); A.lfo(t, .2, 41, 100, z.osc.frequency, 'square');
    A.crk(t, .25, 90, .5, 2500);
    const r = A.nz(t + .05, { buf: 'brown', type: 'lowpass', fc: [[0, 400], [2.2, 120]], a: .05, d: 2, v: 1.6 }); A.wobble(r.g2, t + .05, 2.2, .1, .15);
    A.tone(t, { fc: [[0, 50], [1.2, 30]], a: .01, d: 1.2, v: .5 });
  } },
  skill_gaze: { rv: .45, f(A, t) {
    A.nz(t, { type: 'highpass', f: 4000, q: .7, a: .12, h: .2, d: .45, v: .5 });
    for (const f of [466.2, 493.9, 932.3]) A.tone(t, { f, a: .2, h: .2, d: .7, v: .06, am: [7, .6], filt: ['lowpass', 2000, .7] });
    A.crk(t + .25, .6, [10, 60], .3, 3000); A.nz(t + .3, { buf: 'brown', type: 'lowpass', f: 250, a: .1, d: .5, v: .6 });
  } },
  skill_fireball: { rv: .3, f(A, t) {
    A.nz(t, { type: 'bandpass', q: 1.5, fc: [[0, 300], [.26, 1800]], a: .16, d: .14, v: .6 });
    A.nz(t, { buf: 'pink', type: 'lowpass', f: 900, a: .1, h: .12, d: .15, v: .45, am: [17, .4] });
    const t2 = t + .3;
    A.tone(t2, { fc: [[0, 95], [.4, 38]], a: .003, d: .45, v: .6 });
    A.nz(t2, { buf: 'pink', type: 'lowpass', fc: [[0, 3200], [.65, 380]], a: .006, d: .65, v: .85 });
    A.nz(t2, { type: 'highpass', f: 2500, d: .05, v: .35 });
    A.crk(t2 + .02, .55, [45, 12], .35, 2200);
  } },
  skill_flurry: { rv: .1, gap: .2, f(A, t) {
    for (let i = 0; i < 6; i++) {
      const w = t + i * .075 + rnd(0, .008), k = (i % 2 ? .88 : 1.05) * rnd(.95, 1.05);
      A.nz(w, { type: 'bandpass', q: 2.5, fc: [[0, 900 * k], [.045, 3800 * k]], a: .01, d: .05, v: .6 });
      A.tone(w + .035, { fc: [[0, 230 * k], [.05, 90]], a: .002, d: .05, v: .28 });
      A.metal(w + .035, 2600 * k, [1, 1.5], [.5, .3], [.06, .04], .04);
    }
  } },
  skill_fog: { rv: .6, f(A, t) {
    A.nz(t, { type: 'bandpass', f: 1800, q: .6, a: .25, h: .3, d: .8, v: .35 });
    A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 200], [.6, 700], [1.5, 250]], a: .6, h: .2, d: .9, v: .75, am: [2.6, .35] });
    A.tone(t, { f: 65.4, a: .5, h: .2, d: 1, v: .14, am: [3, .3] });
    A.tone(t + .1, { w: 'sawtooth', fc: [[0, 98], [1.4, 82]], a: .5, d: 1, v: .05, filt: ['lowpass', 400, 1] });
  } },
  skill_wave: { rv: .4, f(A, t) {
    A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 250], [.7, 2200]], a: .65, h: .05, d: .4, v: .7 });
    const t2 = t + .7;
    A.nz(t2, { type: 'bandpass', f: 1200, q: .5, a: .03, d: .85, v: .8 });
    A.nz(t2, { type: 'highpass', f: 3500, a: .05, d: 1, v: .35 });
    A.tone(t2, { fc: [[0, 80], [.4, 45]], a: .005, d: .4, v: .4 });
    for (let i = 0; i < 6; i++) { const f = rnd(450, 1300); A.tone(t2 + rnd(.1, .7), { fc: [[0, f], [.04, f * 1.6]], a: .002, d: .05, v: .07 }); }
  } },
  skill_prophecy: { rv: .8, f(A, t) {
    A.pl(t, 88, .4); A.pl(t + .12, 89, .3);
    A.metal(t, 1318.5, [1, 2.4, 3.9], [.6, .3, .15], [1.6, 1, .6], .09);
    for (const f of [659.3, 698.5, 987.8]) A.tone(t + .05, { f, a: .3, h: .4, d: 1, v: .045, am: [6.5, .5], vib: [4, 12, .4] });
    for (let i = 0; i < 5; i++) A.nz(t + .25 + i * rnd(.13, .2), { type: 'bandpass', f: [900, 1400, 2300, 1100, 1800][i], q: 4, a: .05, d: .15, v: .18 });
    [[440, 660], [523.3, 784], [392, 587.3]].forEach(([a, b], i) => A.tone(t + .35 + i * .25, { fc: [[0, a], [.3, b]], a: .05, d: .35, v: .04 }));
  } },
  skill_charge: { rv: .3, f(A, t) {
    A.nz(t, { buf: 'pink', type: 'bandpass', q: 1, fc: [[0, 200], [.5, 900]], a: .4, d: .15, v: .7 });
    for (const w of [0, .14, .28]) { A.tone(t + w, { fc: [[0, 100], [.08, 60]], a: .002, d: .08, v: .3 }); A.nz(t + w, { type: 'lowpass', f: 300, d: .05, v: .3 }); }
    const t2 = t + .5;
    A.metal(t2, 200, [1, 1.62, 2.31, 2.93, 3.64, 4.72], [.5, .45, .4, .3, .2, .12], [1, .8, .65, .5, .35, .25], .25);
    A.tone(t2, { fc: [[0, 120], [.3, 40]], a: .001, d: .3, v: .6 });
    A.nz(t2, { type: 'lowpass', f: 2500, d: .04, v: .5 });
    A.crk(t2 + .02, .25, 30, .2, 2500);
  } },
  skill_smash: { rv: .4, f(A, t) {
    A.nz(t, { type: 'bandpass', q: 1.2, fc: [[0, 220], [.25, 1200], [.4, 300]], a: .2, d: .2, v: .85 });
    const t2 = t + .4;
    A.tone(t2, { fc: [[0, 75], [.7, 30]], a: .003, d: .7, v: .75 });
    A.nz(t2, { type: 'lowpass', f: 500, d: .2, v: .6 });
    const r = A.nz(t2, { buf: 'brown', type: 'lowpass', f: 200, a: .02, h: .1, d: .8, v: .9 }); A.wobble(r.g2, t2, 1, .08, .1);
    A.crk(t2 + .05, .8, [20, 6], .3, 2000, 'bandpass', 1);
  } },
  gear_equip: { rv: .15, f(A, t) {
    A.crinkle(t, .18, .45, 900, .9, .014, .03);
    A.nz(t + .1, { type: 'lowpass', f: 400, d: .05, v: .3 });
    A.metal(t + .1, 2100, [1, 1.52, 2.4, 3.3], [.6, .4, .3, .2], [.25, .18, .12, .08], .1);
    A.metal(t + .17, 2700, [1, 1.47], [.6, .3], [.12, .08], .06);
  } },
  // ===== V's blows: whooshes per weapon style and combo step =====
  // opts: {step: combo index, sp: weapon speed (shorter swing when faster)}
  // round 22: every swing goes through wSwing (the weapon's size and material, see weaponVoice); wv: the style whose
  // default voice is used when no weapon is known
  wh_blade: { rv: .08, gap: .05, wv: 'blade', f(A, t, o) {
    const k = rnd(.92, 1.08), s = o.step | 0, sp = clamp(o.sp || 1, .6, 2);
    if (s === 2) {
      wSwing(A, t, o, k, { f: [420 * k, 2100 * k, 480 * k], dur: .3 / sp, q: 1.3, v: .8, pan: [.45, -.45] });
      A.tone(t + .03, { fc: [[0, 160], [.22, 70]], a: .03, d: .2, v: .18 });
    } else wSwing(A, t, o, k, { f: s ? [760 * k, 3100 * k, 1000 * k] : [600 * k, 2700 * k, 900 * k], dur: (s ? .15 : .17) / sp, q: 1.6, v: .75, pan: s ? [-.35, .35] : [.35, -.35] });
  } },
  wh_spear: { rv: .06, gap: .05, wv: 'spear', f(A, t, o) {
    const k = rnd(.92, 1.08), sp = clamp(o.sp || 1, .6, 2);
    if ((o.step | 0) === 2) {
      wSwing(A, t, o, k, { f: [380 * k, 1900 * k, 420 * k], dur: .3 / sp, q: 1.3, v: .8, pan: [-.4, .4] });
      A.tone(t + .02, { fc: [[0, 150], [.2, 70]], a: .03, d: .2, v: .16 });
    } else {
      const d = wSwing(A, t, o, k, { f: [650 * k, 3600 * k, 1500 * k], dur: .13 / sp, q: 2.6, v: .8 }); // a thrust: a short rising hiss
      A.tone(t, { fc: [[0, 220], [.1, 90]], a: .01, d: .1, v: .13 });
      A.crinkle(t, .06, .18, 1300, 1.2, .008, .015);
      if (o.wm !== 'wood') A.tone(t + d * .4, { fc: [[0, 1300 * k], [.1, 1850 * k]], a: .02, d: .09, v: .03 });
    }
  } },
  wh_twohand: { rv: .12, gap: .08, wv: 'twohand', f(A, t, o) {
    const k = rnd(.92, 1.06), sp = clamp(o.sp || 1, .5, 2), big = (o.step | 0) === 2;
    const d = wSwing(A, t, o, k, { f: big ? [190 * k, 900 * k, 210 * k] : [250 * k, 1100 * k, 270 * k], dur: (big ? .5 : .4) / sp, q: 1.2, v: .92, pan: big ? [0, 0] : [.3, -.3] });
    A.tone(t + .03, { fc: [[0, 95], [d * .8, 46]], a: d * .3, d: d * .5, v: big ? .3 : .2 });
    if (big) A.crinkle(t, .12, .3, 900, .9, .012, .03);
  } },
  wh_polearm: { rv: .08, gap: .05, wv: 'polearm', f(A, t, o) {
    const k = rnd(.92, 1.08), sp = clamp(o.sp || 1, .6, 2);
    if ((o.step | 0) === 2) {
      wSwing(A, t, o, k, { f: [330 * k, 1700 * k, 380 * k], dur: .4 / sp, q: 1.2, v: .85, pan: [-.65, .65] });
      A.tone(t + .05, { fc: [[0, 130], [.3, 65]], a: .06, d: .25, v: .2 });
      if (o.wm !== 'wood') A.tone(t + .03, { fc: [[0, 880 * k], [.18 / sp, 1400 * k], [.38 / sp, 760 * k]], a: .1, h: .1, d: .16, v: .03 }); // the long haft hums
    } else {
      wSwing(A, t, o, k, { f: [580 * k, 3000 * k, 1300 * k], dur: .15 / sp, q: 2.2, v: .82 });
      A.tone(t, { fc: [[0, 200], [.12, 85]], a: .01, d: .12, v: .14 });
    }
  } },
  wh_dual: { rv: .06, gap: .04, wv: 'dual', f(A, t, o) {
    const k = rnd(.93, 1.07), s = o.step | 0, sp = clamp(o.sp || 1, .6, 2.4), sd = s % 2 ? -1 : 1;
    if (s >= 3) {
      for (const [w, kk, p] of [[0, 1, -.4], [.025, .84, .4]]) wSwing(A, t + w, o, k * kk, { f: [800 * k * kk, 3000 * k * kk, 900 * k * kk], dur: .2 / sp, q: 1.6, v: .7, pan: [p, -p] });
      A.tone(t + .02, { fc: [[0, 180], [.18, 80]], a: .02, d: .16, v: .14 });
    } else for (const [w, kk, p] of [[0, 1, -.35 * sd], [.06 / sp, .86, .35 * sd]]) wSwing(A, t + w, o, k * kk, { f: [1100 * k * kk, 3500 * k * kk, 1400 * k * kk], dur: .1 / sp, q: 2, v: .7, pan: [p, p * .3] });
  } },
  // charged strike: wind-up, ready, release, slam
  charge_start: { rv: .2, gap: .4, f(A, t) {
    A.nz(t, { type: 'bandpass', q: 3, fc: [[0, 300], [.7, 1500]], a: .55, h: .1, d: .3, v: .22 });
    A.tone(t, { fc: [[0, 196], [.8, 392]], a: .5, h: .1, d: .3, v: .035, am: [11, .4] });
    A.tone(t, { f: 98, a: .3, h: .3, d: .3, v: .08 });
    A.crinkle(t, .16, .25, 900, .9, .012, .03);
  } },
  charge_full: { rv: .5, gap: .3, f(A, t) {
    A.pl(t, 81, .32); A.pl(t + .05, 88, .3);
    A.metal(t, 2637, [1, 1.5, 2.0], [.5, .3, .2], [.5, .35, .25], .05);
    A.nz(t, { type: 'highpass', fc: [[0, 4000], [.3, 9000]], a: .01, d: .35, v: .08 });
  } },
  wh_charge: { rv: .2, gap: .1, wv: 'blade', f(A, t, o) {
    wSwing(A, t, o, 1, { f: [180, 1500, 230], dur: .42, q: 1, v: 1, pan: [.3, -.3] });
    A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 300], [.2, 1500], [.4, 300]], a: .15, d: .25, v: .55 });
    A.tone(t, { fc: [[0, 80], [.4, 35]], a: .12, d: .3, v: .4 });
    A.nz(t + .14, { type: 'highpass', f: 3500, a: .005, d: .05, v: .3 });
  } },
  charge_slam: { rv: .35, gap: .1, wv: 'blade', f(A, t, o) { wHit(A, t, o, 1, .7);
    A.nz(t, { type: 'highpass', f: 900, d: .06, v: .7 });
    A.tone(t, { fc: [[0, 130], [.45, 32]], a: .002, d: .5, v: .75 });
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 1800], [.55, 120]], a: .003, d: .55, v: .9 }); A.wobble(r.g2, t, .6, .07, .08);
    A.crk(t + .03, .4, [70, 10], .3, 2200);
    A.metal(t, 1500, [1, 1.47, 2.11], [.5, .3, .2], [.35, .25, .15], .08);
  } },

  // ===== impacts on foes. opts: {mat: flesh|bone|stone|shell|spirit, heavy, el: weapon element} =====
  // round 22: the weapon's own sound on impact is wHit (its material and size, see weaponVoice)
  hit_blade: { gap: .03, wv: 'blade', f(A, t, o) { const k = rnd(.9, 1.1); hitCore(A, t, o, k); wHit(A, t, o, k); } },
  hit_spear: { gap: .03, wv: 'spear', f(A, t, o) { const k = rnd(.9, 1.1); hitCore(A, t, o, k); A.nz(t, { type: 'bandpass', q: 2.2, fc: [[0, 2700 * k], [.04, 1100 * k]], d: .045, v: .45 }); A.tone(t, { fc: [[0, 250 * k], [.06, 90]], a: .001, d: .07, v: .35 }); wHit(A, t, o, k, .7); } },
  hit_twohand: { rv: .15, gap: .04, wv: 'twohand', f(A, t, o) {
    const k = rnd(.9, 1.08); hitCore(A, t, { ...o, heavy: true }, k);
    A.tone(t, { fc: [[0, 115 * k], [.25, 36]], a: .002, d: .3, v: .42 });
    A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 2400], [.22, 280]], d: .22, v: .5 });
    A.crk(t + .01, .15, [220, 40], .22, 2200, 'bandpass', .9);
    wHit(A, t, o, k);
  } },
  hit_polearm: { rv: .08, gap: .03, wv: 'polearm', f(A, t, o) { const k = rnd(.9, 1.1); hitCore(A, t, o, k); A.nz(t, { type: 'bandpass', f: 1250 * k, q: 1.4, d: .06, v: .4 }); A.tone(t, { fc: [[0, 190 * k], [.08, 70]], d: .09, v: .3 }); wHit(A, t, o, k, .85); } },
  hit_dual: { gap: .025, wv: 'dual', f(A, t, o) { const k = rnd(.9, 1.12); hitCore(A, t, o, k, .75); wHit(A, t, o, k, .6); wHit(A, t + .022, o, k * 1.07, .5); } },
  hit_bash: { rv: .3, gap: .05, f(A, t, o) {
    const k = rnd(.94, 1.06); (MAT[o.mat] || MAT.flesh)(A, t, .7, k);
    A.metal(t, 300 * k, [1, 1.58, 2.24, 2.92, 3.8], [.5, .4, .3, .2, .12], [.6, .45, .32, .22, .15], .2);
    A.tone(t, { fc: [[0, 105], [.2, 45]], a: .001, d: .22, v: .6 }); A.nz(t, { type: 'lowpass', f: 1800, d: .05, v: .5 });
  } },
  hit_crush: { rv: .25, gap: .04, f(A, t, o) {
    const k = rnd(.9, 1.1); (MAT[o.mat] || MAT.flesh)(A, t, .6, k);
    A.tone(t, { fc: [[0, 92 * k], [.3, 32]], a: .002, d: .3, v: .55 });
    A.crk(t, .25, [120, 20], .3, 1500, 'bandpass', 1); A.nz(t, { buf: 'brown', type: 'lowpass', f: 420, d: .25, v: .6 });
  } },
  hit_magic: { rv: .25, gap: .03, f(A, t, o) {
    const k = rnd(.9, 1.1); (MAT[o.mat] || MAT.flesh)(A, t, .5, k);
    A.tone(t, { fc: [[0, 210 * k], [.12, 70]], d: .12, v: .38 }); A.nz(t, { type: 'bandpass', q: 1.5, fc: [[0, 3000 * k], [.12, 700]], d: .12, v: .3 });
    if (o.el && ELEM[o.el]) ELEM[o.el](A, t, .8);
  } },
  hit_water: { rv: .25, gap: .04, f(A, t, o) {
    const k = rnd(.9, 1.1); (MAT[o.mat] || MAT.flesh)(A, t, .5, k);
    A.nz(t, { type: 'bandpass', f: 900 * k, q: .8, d: .13, v: .55 }); A.nz(t + .01, { type: 'highpass', f: 3000, d: .2, v: .25 });
    for (let i = 0; i < 3; i++) { const f = rnd(450, 1100); A.tone(t + .03 + rnd(0, .15), { fc: [[0, f], [.04, f * 1.6]], a: .002, d: .05, v: .08 }); }
  } },
  hit_spirit: { rv: .45, gap: .05, f(A, t, o) {
    const k = rnd(.88, 1.12); (MAT[o.mat] || MAT.flesh)(A, t, .55, k);
    A.nz(t, { type: 'bandpass', q: 2, fc: [[0, 1800 * k], [.07, 4200 * k], [.2, 900]], a: .01, d: .2, v: .32 });
    A.tone(t, { f: 660 * k, a: .004, d: .26, v: .05, vib: [7, 30, .02] });
  } },
  // layers on top of an impact
  hit_crit: { rv: .4, gap: .04, f(A, t) {
    const k = rnd(.95, 1.05);
    A.nz(t, { type: 'highpass', f: 2500, d: .025, v: .65 }); A.tone(t, { fc: [[0, 230], [.12, 48]], a: .001, d: .3, v: .55 });
    A.metal(t + .005, 1900 * k, [1, 1.47, 2.11, 2.76], [.5, .35, .25, .15], [.5, .35, .25, .18], .16);
    A.nz(t + .02, { type: 'highpass', fc: [[0, 9000], [.4, 4000]], d: .35, v: .08 });
  } },
  kill_blow: { rv: .45, gap: .06, f(A, t, o) {
    const big = !!o.heavy;
    A.tone(t, { fc: [[0, big ? 110 : 150], [.35, big ? 28 : 38]], a: .002, d: big ? .6 : .4, v: big ? .7 : .55 });
    A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 3000], [.5, 200]], a: .003, d: .45, v: .45 });
    A.nz(t + .02, { type: 'bandpass', q: 2, fc: [[0, 2400], [.3, 500]], d: .3, v: .22 });
    A.pl(t + .03, [38, 45, 41][Math.random() * 3 | 0], .3, 'kith');
    if (big) { A.metal(t, 98, [1, 1.6, 2.3], [.5, .35, .2], [1, .7, .5], .1); A.crk(t + .05, .5, [50, 6], .3, 1500, 'bandpass', 1); }
  } },
  // weapon specials when they trigger
  proc_burn: { rv: .2, gap: .15, f(A, t) { A.nz(t, { type: 'lowpass', fc: [[0, 300], [.1, 3000], [.45, 500]], a: .02, d: .45, v: .55 }); A.crk(t + .05, .4, [50, 15], .25, 2400); A.tone(t, { fc: [[0, 80], [.3, 55]], d: .3, v: .2 }); } },
  proc_poison: { rv: .2, gap: .15, f(A, t) { for (let i = 0; i < 5; i++) { const f = rnd(200, 460); A.tone(t + i * .05 + rnd(0, .02), { fc: [[0, f], [.05, f * 1.55]], a: .003, d: .06, v: .22 }); } A.nz(t, { type: 'bandpass', f: 1500, q: 2, a: .04, d: .28, v: .26, am: [10, .6] }); } },
  proc_chill: { rv: .45, gap: .15, f(A, t) { A.crk(t, .15, 90, .3, 5000); A.metal(t, 2800, [1, 1.34, 1.79, 2.41], [.4, .3, .25, .2], [.35, .28, .2, .15], .06); A.nz(t, { type: 'highpass', fc: [[0, 5000], [.3, 9000]], d: .3, v: .12 }); for (let i = 0; i < 4; i++) A.tone(t + rnd(0, .1), { f: rnd(3500, 7000), a: .001, d: .1, v: .04 }); } },
  proc_chain: { rv: .35, gap: .1, f(A, t, o) {
    const n = clamp(o.n || 1, 1, 6);
    for (let i = 0; i < n; i++) {
      const w = t + i * .07, z = A.tone(w, { w: 'sawtooth', f: 140 + i * 25, a: .002, d: .12, v: .26, filt: ['bandpass', 2200, .8], pan: rnd(-.5, .5) });
      A.lfo(w, .14, 41 + i * 6, 120, z.osc.frequency, 'square'); A.crk(w, .12, 110, .35, 3000); A.nz(w, { type: 'highpass', f: 2200, d: .02, v: .4 });
    }
    A.tone(t, { fc: [[0, 70], [.4, 40]], d: .4, v: .25 });
  } },
  proc_stagger: { gap: .2, f(A, t) { A.tone(t, { fc: [[0, 210], [.15, 80]], d: .15, v: .4 }); A.nz(t, { type: 'lowpass', f: 700, d: .06, v: .4 }); A.tone(t + .05, { fc: [[0, 1250], [.35, 900]], d: .35, v: .045, vib: [12, 70, .02] }); } },
  proc_execute: { rv: .4, gap: .2, f(A, t) { A.metal(t, 520, [1, 2.01, 2.98], [.5, .3, .2], [.6, .4, .3], .12); A.tone(t, { w: 'sawtooth', fc: [[0, 110], [.4, 55]], a: .005, d: .4, v: .08, filt: ['lowpass', 700, 1] }); A.nz(t, { type: 'bandpass', q: 3, fc: [[0, 3000], [.3, 600]], d: .3, v: .2 }); } },
  dot_burn: { gap: .3, f(A, t) { A.crk(t, .18, 60, .2, 2600); A.nz(t, { type: 'lowpass', fc: [[0, 500], [.08, 1600], [.2, 400]], a: .02, d: .16, v: .22 }); } },
  dot_poison: { gap: .3, f(A, t) { const f = rnd(220, 380); A.tone(t, { fc: [[0, f], [.05, f * 1.6]], a: .003, d: .06, v: .3 }); A.nz(t, { type: 'bandpass', f: 1600, q: 3, a: .02, d: .12, v: .22 }); } },

  // ===== foes that shrug a blow off =====
  deflect: { rv: .25, gap: .05, f(A, t) { const k = rnd(.94, 1.06); A.metal(t, 520 * k, [1, 1.41, 2.2, 3.1], [.5, .3, .2, .12], [.25, .18, .1, .06], .15); A.tone(t, { fc: [[0, 150], [.1, 70]], d: .1, v: .45 }); A.nz(t, { type: 'lowpass', f: 900, d: .05, v: .4 }); A.nz(t, { type: 'highpass', f: 5000, d: .02, v: .25 }); } },
  ward_hit: { rv: .6, gap: .06, f(A, t) {
    const k = rnd(.96, 1.04);
    A.metal(t, 990 * k, [1, 1.5, 2.0, 2.5, 3.01], [.4, .3, .3, .2, .15], [.8, .6, .5, .4, .3], .1);
    A.tone(t, { f: 1975 * k, a: .003, d: .5, v: .04, vib: [6, 25, .05] });
    A.tone(t, { f: 70, a: .02, d: .4, v: .2 }); A.nz(t, { type: 'bandpass', f: 2500, q: 6, d: .3, v: .1 }); A.nz(t, { type: 'lowpass', f: 700, d: .04, v: .35 });
  } },
  ward_drain: { rv: .5, gap: .05, f(A, t) { A.tone(t, { fc: [[0, 1500 * rnd(.9, 1.1)], [.12, 700]], d: .12, v: .1 }); A.nz(t, { type: 'highpass', f: 3000, d: .05, v: .22 }); } },
  ward_break: { rv: .7, duck: [.5, 1.6], f(A, t) {
    for (let i = 0; i < 16; i++) A.tone(t + rnd(0, .5), { f: rnd(2500, 7500), a: .001, d: rnd(.1, .3), v: .05 });
    A.nz(t, { type: 'highpass', fc: [[0, 6000], [.5, 2500]], d: .45, v: .5 }); A.tone(t, { fc: [[0, 95], [.8, 30]], a: .002, d: .9, v: .7 });
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 900], [1.2, 120]], d: 1.2, v: 1 }); A.wobble(r.g2, t, 1.2, .1, .1);
    A.metal(t, 660, [1, 1.5, 2.0, 2.5], [.4, .3, .25, .2], [1.2, .9, .7, .5], .1); A.crk(t, .7, [120, 10], .3, 4000);
  } },

  // ===== V gets hit / blocks =====
  v_hurt: { rv: .1, gap: .08, f(A, t, o) {
    const k = rnd(.92, 1.08);
    A.tone(t, { fc: [[0, 160 * k], [.2, 52]], a: .002, d: .2, v: .6 }); A.nz(t, { type: 'bandpass', f: 1100 * k, q: .8, d: .07, v: .42 });
    A.crinkle(t, .1, .3, 1400, .9, .008, .02);
    // her breath: a short voiced "uh" (formants of a female voice), kept low in the mix
    const z = A.tone(t + .015, { w: 'sawtooth', fc: [[0, 310 * k], [.14, 225 * k]], a: .012, d: .15, v: .09, filt: ['bandpass', 850, 3] });
    if (z && z.filt) { const b = A.F('bandpass', 1450, 4), bg = A.G(.5); z.osc.connect(b); b.connect(bg); bg.connect(z.g); }
    A.nz(t + .01, { type: 'bandpass', f: 1700, q: 1.5, a: .01, d: .12, v: .06 });
    if (o.heavy) { A.tone(t, { fc: [[0, 75], [.35, 30]], a: .002, d: .35, v: .5 }); A.crk(t, .2, [80, 10], .25, 1800, 'bandpass', 1); }
  } },
  block_shield: { rv: .3, gap: .05, f(A, t, o) {
    const k = rnd(.94, 1.06), hv = o.heavy ? 1.3 : 1;
    A.metal(t, 260 * k, [1, 1.6, 2.3, 3.0, 4.1], [.5, .4, .3, .2, .12], [.55, .4, .3, .2, .12], .2 * hv);
    A.tone(t, { fc: [[0, 125], [.1, 60]], d: .1, v: .5 * hv }); A.nz(t, { type: 'lowpass', f: 1500, d: .04, v: .45 }); A.nz(t, { type: 'highpass', f: 4000, d: .03, v: .3 });
    if (o.heavy) { A.tone(t, { fc: [[0, 80], [.3, 35]], d: .3, v: .45 }); A.crk(t + .02, .15, 60, .2, 2000); }
  } },
  parry: { rv: .3, gap: .05, f(A, t, o) {
    const k = rnd(.94, 1.06);
    if ((WEAPON_AUDIO[o.wc] || {}).block === 'haft') { A.tone(t, { fc: [[0, 380 * k], [.06, 260 * k]], a: .001, d: .08, v: .3 }); A.nz(t, { type: 'bandpass', f: 1100 * k, q: 2, d: .05, v: .3 }); A.metal(t, 1300 * k, [1, 1.58, 2.3], [.5, .3, .2], [.2, .14, .1], .09); A.tone(t, { fc: [[0, 150], [.08, 75]], d: .08, v: o.heavy ? .45 : .28 }); return; } // round 33: an axe's or a spear's haft takes it
    A.metal(t, 1100 * k, [1, 1.52, 2.4, 3.3, 4.6], [.5, .4, .3, .2, .12], [.45, .35, .25, .18, .12], .17);
    A.nz(t, { type: 'bandpass', q: 3, fc: [[0, 5000], [.12, 2500]], d: .12, v: .22 }); A.nz(t, { type: 'highpass', f: 4500, d: .02, v: .35 });
    A.tone(t, { fc: [[0, 160], [.08, 80]], d: .08, v: o.heavy ? .5 : .3 });
  } },
  en_swing: { gap: .06, f(A, t, o) {
    const k = rnd(.9, 1.1);
    if (o.heavy) { whoosh(A, t, { f: [200 * k, 850 * k, 220 * k], dur: .4, q: 1.2, v: .6 }); A.tone(t + .05, { fc: [[0, 80], [.3, 40]], a: .08, d: .25, v: .25 }); }
    else whoosh(A, t, { f: [380 * k, 1500 * k, 480 * k], dur: .2, q: 1.4, v: .42 });
  } },
  shade_swing: { rv: .45, gap: .07, f(A, t) { const k = rnd(.85, 1.2); whoosh(A, t, { f: [900 * k, 2400 * k, 700 * k], dur: .25, q: 2, v: .26, pan: [rnd(-.5, .5), rnd(-.5, .5)] }); A.tone(t, { f: 520 * k, a: .05, d: .2, v: .025, vib: [6, 25] }); } },

  // ===== skills, one sound per phase (timed by PHASE_SND in skills.js) =====
  aegis_brace: { rv: .25, f(A, t) {
    A.crinkle(t, .14, .4, 1200, .9, .008, .02);
    A.metal(t + .05, 2400, [1, 1.5, 2.2], [.5, .3, .2], [.15, .1, .06], .07);
    A.nz(t, { type: 'bandpass', q: 1.2, fc: [[0, 250], [.1, 900]], a: .07, d: .06, v: .35 });
    A.tone(t, { fc: [[0, 70], [.1, 110]], a: .05, d: .08, v: .2 });
  } },
  aegis_rush: { rv: .15, f(A, t) {
    for (const w of [0, .12, .24]) { A.tone(t + w, { fc: [[0, 115], [.08, 55]], a: .002, d: .08, v: .38 }); A.nz(t + w, { type: 'lowpass', f: 380, d: .05, v: .35 }); A.crinkle(t + w, .05, .2, 2200, .8, .006, .015); }
    A.nz(t, { buf: 'pink', type: 'bandpass', q: .8, fc: [[0, 300], [.3, 1200], [.42, 500]], a: .08, h: .22, d: .12, v: .55 });
    A.tone(t, { w: 'sawtooth', fc: [[0, 90], [.4, 140]], a: .05, h: .25, d: .1, v: .04, filt: ['lowpass', 600, 1] });
  } },
  dash_start: { rv: .2, f(A, t) {
    const fl = A._tex('flap' + (Math.random() * 3 | 0)); if (fl) A.bufp(t, fl, .45, 1.7);
    A.tone(t, { fc: [[0, 125], [.06, 60]], a: .002, d: .06, v: .4 }); A.nz(t, { type: 'lowpass', f: 600, d: .04, v: .35 });
    A.tone(t + .01, { fc: [[0, 1760], [.08, 2640]], a: .01, d: .08, v: .04 });
  } },
  dash_zip: { rv: .15, f(A, t) {
    const r = A.nz(t, { type: 'bandpass', q: 4, fc: [[0, 700], [.18, 6500], [.3, 2500]], a: .01, h: .15, d: .12, v: .62, pan: -.5 });
    if (r.p && r.p.pan) { r.p.pan.setValueAtTime(-.5, t); r.p.pan.linearRampToValueAtTime(.5, t + .3); }
    A.tone(t, { fc: [[0, 1900], [.3, 480]], a: .01, d: .28, v: .08 });
    A.metal(t + .03, 3600, [1, 1.5], [.4, .25], [.15, .1], .03);
  } },
  dash_stop: { rv: .1, f(A, t) { A.nz(t, { type: 'bandpass', f: 2200, q: 1, a: .005, d: .16, v: .32 }); A.crinkle(t, .15, .3, 3000, .8, .006, .014); A.tone(t, { fc: [[0, 100], [.08, 50]], d: .08, v: .38 }); } },
  whirl_start: { rv: .2, f(A, t) {
    A.metal(t, 2900, [1, 1.5, 2.1], [.5, .3, .2], [.4, .3, .2], .06);
    A.nz(t, { type: 'bandpass', q: 3, fc: [[0, 3000], [.15, 7000]], a: .01, d: .14, v: .22 });
    A.tone(t, { fc: [[0, 80], [.15, 120]], a: .05, d: .12, v: .14 });
  } },
  whirl_spin: { rv: .2, gap: .08, f(A, t, o) {
    const n = o.n || 1, k = (1 + (n - 1) * .09) * rnd(.97, 1.03), last = !!o.last;
    const r = A.nz(t, { type: 'bandpass', q: 1.8, fc: [[0, 480 * k], [.1, 2500 * k], [.24, 650 * k]], a: .06, d: .18, v: last ? .9 : .72, pan: -.6 });
    if (r.p && r.p.pan) { r.p.pan.setValueAtTime(-.6, t); r.p.pan.linearRampToValueAtTime(.6, t + .11); r.p.pan.linearRampToValueAtTime(-.3, t + .24); }
    A.tone(t, { fc: [[0, 140 * k], [.2, 80]], a: .05, d: .16, v: .12 });
    if (last) { A.tone(t + .05, { fc: [[0, 95], [.35, 38]], a: .03, d: .32, v: .38 }); A.metal(t + .06, 2600, [1, 1.5, 2.1], [.5, .3, .2], [.35, .2, .12], .06); }
  } },
  fate_spin: { rv: .5, f(A, t) {
    A.tone(t, { w: 'triangle', fc: [[0, 330], [.42, 660]], a: .06, h: .25, d: .12, v: .06, am: [22, .7] });
    A.nz(t, { type: 'bandpass', q: 6, fc: [[0, 1500], [.42, 3200]], a: .1, h: .2, d: .12, v: .12, am: [22, .6] });
    [69, 73, 76, 81].forEach((m, i) => A.pl(t + i * .1, m, .18));
  } },
  fate_bind: { rv: .7, f(A, t, o) {
    SFX.skill_fate.f(A, t);
    const n = clamp(o.n | 0, 0, 6);
    for (let i = 0; i < n; i++) { const w = t + .08 + i * .055; A.pl(w, [81, 84, 88, 91, 93, 96][i], .22); A.tone(w, { fc: [[0, 1250], [.15, 900]], a: .002, d: .15, v: .04 }); }
  } },
  heal_call: { rv: .7, f(A, t) {
    A.tone(t, { fc: [[0, 440], [.24, 880]], a: .15, d: .18, v: .05, vib: [5, 8] });
    A.nz(t, { type: 'highpass', f: 6000, a: .15, d: .15, v: .05 }); A.pl(t, 69, .2); A.pl(t + .08, 73, .2); A.pl(t + .16, 76, .2);
  } },
  heal_bloom: { rv: .8, f(A, t) { SFX.skill_heal.f(A, t); A.tone(t, { f: 220, a: .2, h: .6, d: .8, v: .07, am: [5, .3] }); } },
  heal_tick: { rv: .6, gap: .1, f(A, t, o) {
    const i = (o.i | 0) % 5; A.pl(t, [76, 79, 81, 83, 88][i], .35);
    A.tone(t + .01, { f: 2637 * Math.pow(1.06, i), a: .004, d: .3, v: .05 }); A.nz(t, { type: 'highpass', f: 7000, d: .08, v: .04 });
  } },
  quake_lift: { rv: .2, f(A, t) {
    A.crinkle(t, .2, .35, 1000, .9, .012, .03);
    A.nz(t, { type: 'bandpass', q: 1.2, fc: [[0, 200], [.3, 900], [.42, 300]], a: .28, d: .12, v: .55 });
    A.nz(t + .33, { type: 'bandpass', q: 1.3, fc: [[0, 1300], [.14, 240]], a: .04, d: .1, v: .72 });
    A.tone(t, { fc: [[0, 60], [.45, 92]], a: .3, d: .1, v: .15 });
  } },
  quake_slam: { rv: .4, duck: [.6, .8], f(A, t) {
    A.tone(t, { fc: [[0, 82], [.7, 28]], a: .002, d: .75, v: .8 }); A.nz(t, { type: 'lowpass', f: 600, d: .2, v: .7 });
    A.nz(t, { type: 'highpass', f: 1500, d: .04, v: .5 }); A.crk(t + .02, .5, [80, 8], .35, 2000, 'bandpass', 1);
    A.metal(t, 150, [1, 1.7, 2.6], [.5, .3, .2], [.3, .2, .12], .1);
  } },
  quake_wave: { rv: .4, f(A, t) {
    const r = A.nz(t + .04, { buf: 'brown', type: 'lowpass', fc: [[0, 220], [.2, 520], [.6, 150]], a: .05, h: .2, d: .5, v: 1 }); A.wobble(r.g2, t + .04, .8, .07, .1);
    A.crk(t + .05, .6, [40, 8], .25, 1500, 'bandpass', 1);
    for (let i = 0; i < 8; i++) { const f = rnd(500, 1500); A.tone(t + rnd(.15, .7), { fc: [[0, f], [.03, f * .7]], a: .001, d: .04, v: .05 }); }
  } },
  thunder_call: { rv: .5, f(A, t) {
    A.crk(t, .45, [10, 90], .18, 3500);
    A.nz(t, { type: 'highpass', fc: [[0, 2000], [.45, 6000]], a: .4, d: .05, v: .12 });
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', f: 160, a: .3, h: .1, d: .4, v: .7 }); A.wobble(r.g2, t, .7, .08, .12);
    A.tone(t, { fc: [[0, 110], [.45, 220]], a: .35, d: .1, v: .04, am: [30, .5] });
  } },
  thunder_bolt: { rv: .4, gap: .05, f(A, t) {
    A.nz(t, { type: 'highpass', f: 1200, d: .05, v: 1 });
    const z = A.tone(t, { w: 'sawtooth', f: 150, a: .002, d: .12, v: .3, filt: ['bandpass', 1800, .8], pan: rnd(-.4, .4) }); A.lfo(t, .14, 41, 100, z.osc.frequency, 'square');
    A.crk(t, .2, 100, .5, 2500);
    A.tone(t, { fc: [[0, 95], [.3, 35]], d: .35, v: .55 }); A.nz(t, { buf: 'brown', type: 'lowpass', f: 500, d: .3, v: .7 });
  } },
  thunder_roll: { rv: .6, f(A, t) {
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 420], [2.2, 110]], a: .1, d: 2.1, v: 1.4 }); A.wobble(r.g2, t, 2.2, .1, .15);
    A.tone(t, { fc: [[0, 48], [1.4, 30]], a: .05, d: 1.4, v: .4 });
  } },
  gaze_charge: { rv: .45, f(A, t) {
    for (let i = 0; i < 3; i++) A.nz(t + i * .07, { type: 'highpass', f: 4500 + i * 500, a: .04, h: .06, d: .12, v: .17, am: [30 + i * 4, .4], pan: [-.5, .5, 0][i] });
    for (const f of [466.2, 493.9, 932.3]) A.tone(t, { f, a: .2, h: .05, d: .2, v: .05, am: [7, .6], filt: ['lowpass', 2000, .7] });
    A.tone(t, { f: 58, a: .2, d: .2, v: .15 });
  } },
  gaze_flash: { rv: .5, f(A, t) {
    A.nz(t, { type: 'bandpass', q: 2, fc: [[0, 1500], [.2, 6000]], a: .01, d: .25, v: .35 });
    A.metal(t, 1661, [1, 1.06, 2.3], [.4, .4, .2], [.6, .6, .3], .07);
    A.tone(t, { f: 98, a: .01, d: .5, v: .2 }); A.nz(t + .05, { buf: 'brown', type: 'lowpass', f: 250, a: .05, d: .4, v: .5 });
  } },
  fire_conjure: { rv: .2, f(A, t) {
    A.nz(t, { type: 'lowpass', fc: [[0, 200], [.24, 1800]], a: .2, d: .06, v: .45, am: [17, .4] });
    A.crk(t + .02, .23, [10, 60], .2, 2600); A.tone(t, { fc: [[0, 60], [.24, 110]], a: .2, d: .05, v: .2 });
  } },
  fire_launch: { rv: .25, f(A, t) {
    A.nz(t, { type: 'bandpass', q: 1.3, fc: [[0, 1800], [.15, 700], [.6, 300]], a: .01, h: .1, d: .5, v: .6 });
    A.nz(t, { buf: 'pink', type: 'lowpass', f: 900, a: .01, h: .2, d: .4, v: .45, am: [19, .35] });
    A.crk(t, .5, 30, .2, 2400); A.tone(t, { fc: [[0, 140], [.2, 70]], d: .2, v: .25 });
  } },
  fire_boom: { rv: .35, gap: .08, duck: [.7, .6], f(A, t) {
    A.tone(t, { fc: [[0, 95], [.4, 35]], a: .003, d: .5, v: .7 });
    A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 3200], [.65, 380]], a: .006, d: .7, v: .9 });
    A.nz(t, { type: 'highpass', f: 2500, d: .05, v: .4 }); A.crk(t + .02, .6, [50, 10], .35, 2200);
    A.nz(t + .01, { type: 'bandpass', f: 400, q: 1, d: .3, v: .4 });
  } },
  flurry_start: { rv: .15, f(A, t) {
    A.nz(t, { type: 'bandpass', q: 3, fc: [[0, 2500], [.12, 7000]], a: .01, d: .1, v: .45, pan: -.3 });
    A.nz(t + .03, { type: 'bandpass', q: 3, fc: [[0, 2700], [.12, 7500]], a: .01, d: .1, v: .45, pan: .3 });
    A.metal(t + .02, 3600, [1, 1.47], [.4, .25], [.12, .08], .07);
  } },
  flurry_stab: { rv: .1, gap: .05, f(A, t, o) {
    const n = o.n || 1, last = !!o.last, k = (n % 2 ? .9 : 1.05) * rnd(.95, 1.05), pan = n % 2 ? -.35 : .35;
    A.nz(t, { type: 'bandpass', q: 2.6, fc: [[0, 900 * k], [.05, 3800 * k]], a: .008, d: .05, v: last ? 1 : .85, pan });
    A.tone(t + .03, { fc: [[0, 240 * k], [.05, 90]], a: .002, d: .05, v: .35, pan });
    A.metal(t + .03, 2700 * k, [1, 1.5], [.5, .3], [.06, .04], .06);
    if (last) { A.tone(t + .03, { fc: [[0, 160], [.25, 50]], a: .002, d: .25, v: .4 }); A.metal(t + .04, 3100, [1, 1.47, 2.11], [.5, .3, .2], [.35, .25, .15], .06); }
  } },
  fog_gather: { rv: .5, f(A, t) {
    A.nz(t, { buf: 'pink', type: 'bandpass', q: 1, fc: [[0, 1200], [.28, 300]], a: .25, d: .06, v: .45 });
    A.tone(t, { f: 65, a: .25, d: .1, v: .1 }); A.tone(t, { w: 'sawtooth', f: 87, a: .25, d: .1, v: .03, filt: ['lowpass', 400, 1] });
  } },
  fog_burst: { rv: .6, f(A, t) {
    A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 900], [.6, 200]], a: .01, d: .7, v: .8 });
    A.nz(t, { type: 'bandpass', f: 1800, q: .6, a: .05, h: .3, d: .8, v: .3 });
    A.tone(t, { f: 65.4, a: .05, h: .2, d: 1, v: .14, am: [3, .3] });
    A.tone(t + .1, { w: 'sawtooth', fc: [[0, 98], [1.4, 82]], a: .3, d: 1, v: .05, filt: ['lowpass', 400, 1] });
  } },
  fog_linger: { rv: .6, gap: 1, f(A, t) {
    A.nz(t, { buf: 'pink', type: 'bandpass', q: 1.5, fc: [[0, 500], [2.5, 900], [5, 400]], a: .6, h: 3.2, d: 1.5, v: .16, am: [.7, .5] });
    A.tone(t, { f: 55, a: 1, h: 3, d: 1.5, v: .05, am: [.4, .4] });
  } },
  wave_rise: { rv: .35, f(A, t) {
    A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 250], [.32, 1600]], a: .3, d: .05, v: .6 });
    for (let i = 0; i < 4; i++) { const f = rnd(300, 700); A.tone(t + i * .07, { fc: [[0, f], [.05, f * 1.7]], a: .002, d: .05, v: .07 }); }
    A.tone(t, { fc: [[0, 55], [.32, 80]], a: .3, d: .05, v: .15 });
  } },
  wave_crash: { rv: .45, f(A, t) {
    A.nz(t, { type: 'bandpass', f: 1100, q: .5, a: .04, h: .5, d: .6, v: .8 });
    A.nz(t, { type: 'highpass', f: 3500, a: .1, h: .4, d: .7, v: .35 });
    A.tone(t, { fc: [[0, 80], [.4, 45]], a: .005, d: .4, v: .4 });
    A.nz(t + .62, { type: 'lowpass', f: 800, a: .01, d: .4, v: .5 });
    for (let i = 0; i < 6; i++) { const f = rnd(450, 1300); A.tone(t + rnd(.1, .8), { fc: [[0, f], [.04, f * 1.6]], a: .002, d: .05, v: .07 }); }
  } },
  prophecy_call: { rv: .7, f(A, t) {
    A.choir(t, [57, 64], .25, .15, .4, .12);
    for (const f of [659.3, 698.5]) A.tone(t, { f, a: .2, h: .1, d: .3, v: .03, am: [6.5, .5] });
    A.tone(t, { fc: [[0, 130], [.06, 70]], d: .06, v: .35 }); A.nz(t, { type: 'bandpass', f: 900, q: 3, d: .05, v: .35 });
  } },
  prophecy_reveal: { rv: .8, f(A, t) { SFX.skill_prophecy.f(A, t); A.nz(t, { type: 'bandpass', q: 2, fc: [[0, 600], [.5, 3000]], a: .1, d: .5, v: .2 }); } },
  prophecy_mark: { rv: .7, gap: .2, f(A, t, o) {
    const n = clamp(o.n | 0, 1, 6);
    for (let i = 0; i < n; i++) { A.tone(t + .1 + i * .06, { f: [1318.5, 1568, 1760, 1975.5, 2349.3, 2637][i], a: .004, d: .35, v: .05 }); A.nz(t + .1 + i * .06, { type: 'highpass', f: 6000, d: .03, v: .05 }); }
  } },
  oath_crouch: { rv: .3, f(A, t) {
    A.tone(t, { w: 'sawtooth', fc: [[0, 55], [.2, 70]], a: .15, d: .1, v: .1, filt: ['lowpass', 300, 1] });
    A.nz(t, { type: 'highpass', f: 5000, a: .1, d: .15, v: .15, am: [35, .4] });
    A.crinkle(t, .15, .35, 1000, .9, .012, .03);
    A.nz(t, { type: 'bandpass', q: 1.2, fc: [[0, 200], [.2, 600]], a: .2, d: .05, v: .4 });
  } },
  oath_launch: { rv: .45, f(A, t) {
    A.nz(t, { type: 'bandpass', q: 1.1, fc: [[0, 200], [.5, 2600]], a: .05, h: .3, d: .25, v: .8 });
    A.nz(t, { buf: 'pink', type: 'lowpass', f: 600, d: .2, v: .6 });
    A.tone(t, { fc: [[0, 100], [.15, 40]], d: .2, v: .6 });
    for (let j = 0; j < 3; j++) { const r = A.nz(t + .05 + j * .08, { type: 'bandpass', q: 5, fc: [[0, 3500], [.5, 6000]], a: .1, h: .25, d: .2, v: .12, am: [24 + j * 5, .5], pan: 0 }); if (r.p && r.p.pan) A.lfo(t, .7, 2.2 + j * .4, .8, r.p.pan); }
    A.choir(t + .1, [62, 69], .4, .1, .3, .1);
  } },
  oath_hang: { rv: .8, duck: [.6, 1.2], f(A, t) {
    A.metal(t, 587.3, [1, 2, 3, 4.2, 5.4], [.5, .35, .25, .15, .1], [1.5, 1.2, .9, .6, .4], .12);
    A.choir(t, [62, 66, 69, 74], .05, .3, .5, .2); A.pl(t, 86, .35);
    A.nz(t, { type: 'highpass', f: 7000, a: .05, d: .6, v: .08 });
  } },
  oath_fall: { rv: .3, f(A, t) {
    A.tone(t, { fc: [[0, 2400], [.18, 600]], a: .02, d: .16, v: .12 });
    A.nz(t, { type: 'bandpass', q: 2, fc: [[0, 3000], [.18, 400]], a: .05, d: .13, v: .6 });
  } },
  oath_smash: { rv: .5, duck: [.45, 2], f(A, t) {
    A.tone(t, { fc: [[0, 70], [1, 24]], a: .002, d: 1.1, v: .95 }); A.nz(t, { type: 'highpass', f: 1200, d: .06, v: .8 });
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 2000], [.9, 120]], a: .003, d: .9, v: 1.2 }); A.wobble(r.g2, t, 1, .08, .1);
    A.crk(t + .02, 1, [90, 6], .4, 2000, 'bandpass', 1);
    A.metal(t, 110, [1, 1.6, 2.3, 3.1], [.5, .4, .3, .2], [1.2, .9, .6, .4], .15); A.dr(t, 'b', .8);
  } },
  oath_beam: { rv: .8, f(A, t) {
    for (const f of [880, 1318.5, 1760]) A.tone(t, { fc: [[0, f], [.6, f * 1.02]], a: .01, h: .3, d: .5, v: .05 });
    A.nz(t, { type: 'highpass', f: 6000, a: .01, d: .6, v: .1 }); A.choir(t, [74, 78, 81], .02, .2, .6, .12);
  } },
  oath_wave: { rv: .5, f(A, t) { SFX.quake_wave.f(A, t); A.tone(t, { fc: [[0, 45], [1.2, 28]], a: .05, d: 1.2, v: .3 }); A.crk(t + .1, .9, [30, 5], .2, 1200, 'bandpass', 1); } },
  rise_summon: { rv: .9, duck: [.5, 2.5], f(A, t) {
    A.choir(t, [50, 57, 62], .5, .6, 1, .14);
    A.nz(t, { buf: 'pink', type: 'bandpass', q: 2, fc: [[0, 300], [1, 800]], a: .4, h: .5, d: .8, v: .35, am: [1.5, .4] });
    A.tone(t, { f: 41.2, a: .3, h: .8, d: .8, v: .2 });
    A.metal(t, 196, [1, 2.01, 2.76, 3.9], [.5, .3, .2, .1], [2, 1.5, 1, .6], .08);
  } },
  rise_shade: { rv: .6, gap: .04, f(A, t) {
    const k = rnd(.85, 1.2);
    A.nz(t, { type: 'bandpass', q: 4, fc: [[0, 600 * k], [.4, 2200 * k]], a: .08, d: .35, v: .16, pan: rnd(-.7, .7) });
    A.tone(t, { fc: [[0, 330 * k], [.4, 520 * k]], a: .1, d: .3, v: .035, vib: [6, 30] });
  } },
  rise_quake: { rv: .3, gap: .15, f(A, t) { A.tone(t, { fc: [[0, 70], [.3, 35]], d: .3, v: .45 }); A.crk(t, .3, [60, 10], .25, 1600, 'bandpass', 1); A.nz(t, { buf: 'brown', type: 'lowpass', f: 300, d: .3, v: .5 }); } },
  // ----- Kampe, warden of Tartarus -----
  boss_roar: { rv: .8, duck: [.5, 1.6], f(A, t) {
    const r = A.nz(t, { buf: 'brown', type: 'bandpass', q: 1.2, fc: [[0, 180], [.4, 420], [1.5, 120]], a: .12, h: .6, d: .9, v: 1.3 }); A.wobble(r.g2, t, 1.5, .09, .25);
    const z = A.tone(t, { w: 'sawtooth', fc: [[0, 70], [.35, 96], [1.5, 52]], a: .1, h: .6, d: .8, v: .32, filt: ['lowpass', 700, 1] }); A.lfo(t, 1.5, 23, 9, z.osc.frequency);
    A.nz(t + .05, { type: 'highpass', f: 2600, a: .2, h: .3, d: .7, v: .18, am: [31, .7] });
    A.tone(t, { fc: [[0, 48], [1.5, 30]], a: .2, h: .8, d: .6, v: .3 });
  } },
  boss_hiss: { rv: .3, f(A, t) { A.nz(t, { type: 'highpass', fc: [[0, 3200], [.5, 5200]], a: .05, h: .25, d: .3, v: .45 }); A.nz(t, { type: 'bandpass', f: 1800, q: 3, a: .08, d: .45, v: .25, am: [17, .5] }); } },
  boss_spit: { rv: .25, gap: .05, f(A, t) { A.nz(t, { type: 'bandpass', fc: [[0, 900], [.12, 2400]], q: 1.5, a: .005, d: .16, v: .55 }); A.tone(t, { fc: [[0, 220], [.12, 520]], a: .002, d: .12, v: .2 }); } },
  venom_splash: { rv: .25, gap: .06, f(A, t) {
    A.nz(t, { type: 'lowpass', fc: [[0, 2200], [.3, 500]], a: .002, d: .3, v: .6 });
    for (let i = 0; i < 5; i++) { const f = rnd(200, 520); A.tone(t + rnd(0, .14), { fc: [[0, f], [.06, f * 1.7]], a: .003, d: .08, v: .18 }); }
    A.nz(t + .05, { type: 'bandpass', f: 1500, q: 2, a: .02, d: .5, v: .18, am: [11, .6] });
  } },
  tail_strike: { rv: .3, duck: [.7, .4], f(A, t) {
    A.nz(t, { type: 'bandpass', fc: [[0, 500], [.18, 2600]], q: 1, a: .12, d: .05, v: .5 });
    A.tone(t + .17, { fc: [[0, 120], [.3, 40]], a: .002, d: .35, v: .7 }); A.crk(t + .17, .35, [70, 8], .35, 1800, 'bandpass', 1);
    A.nz(t + .17, { type: 'lowpass', f: 900, d: .2, v: .6 });
  } },
  // ----- monsters' ranged attacks -----
  proj_bow: { rv: .2, gap: .05, f(A, t) {
    A.tone(t, { w: 'triangle', fc: [[0, 330], [.18, 300]], a: .002, d: .2, v: .2, vib: [38, 14] });
    A.nz(t + .02, { type: 'bandpass', fc: [[0, 3000], [.2, 1400]], q: 2, a: .01, d: .2, v: .25 });
  } },
  proj_throw: { rv: .2, gap: .05, f(A, t) { A.nz(t, { type: 'bandpass', fc: [[0, 500], [.25, 1600]], q: 1.4, a: .06, d: .16, v: .45 }); } },
  proj_cast: { rv: .5, gap: .06, f(A, t) { A.tone(t, { fc: [[0, 520], [.3, 880]], a: .03, d: .3, v: .14, vib: [9, 25] }); A.nz(t, { type: 'highpass', f: 3000, a: .05, d: .3, v: .14 }); } },
  proj_hit: { rv: .2, gap: .05, f(A, t) { A.nz(t, { type: 'lowpass', fc: [[0, 1800], [.1, 400]], a: .001, d: .12, v: .5 }); A.tone(t, { fc: [[0, 180], [.1, 70]], a: .001, d: .12, v: .35 }); } },
  rock_land: { rv: .35, gap: .08, duck: [.8, .3], f(A, t) {
    A.tone(t, { fc: [[0, 110], [.35, 38]], a: .002, d: .4, v: .7 }); A.crk(t, .3, [60, 10], .3, 1400, 'bandpass', 1);
    A.nz(t, { buf: 'brown', type: 'lowpass', f: 600, d: .35, v: .6 });
  } },
  pounce: { rv: .2, gap: .1, f(A, t) { A.nz(t, { type: 'bandpass', fc: [[0, 400], [.3, 1200]], q: 1.2, a: .08, d: .2, v: .4 }); A.tone(t, { w: 'sawtooth', fc: [[0, 160], [.25, 240]], a: .03, d: .2, v: .12, filt: ['lowpass', 900, 1] }); } },
  rise_cry: { rv: .9, f(A, t) { A.choir(t, [62, 69, 74], .15, .3, .8, .16); A.pl(t, 74, .3); A.pl(t + .08, 81, .3); } },
  zeus_rise: { rv: .7, duck: [.5, 3], f(A, t) {
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', f: 130, a: .5, h: 1, d: 1, v: 1 }); A.wobble(r.g2, t, 2.2, .12, .2);
    A.tone(t, { f: 36, a: .5, h: 1, d: .8, v: .3 });
    A.nz(t, { type: 'bandpass', q: 2, fc: [[0, 300], [.7, 1500]], a: .35, h: .5, d: .5, v: .28 });
    A.crk(t + .1, .7, [5, 40], .2, 3500); A.choir(t, [45, 52], .4, .6, .8, .1);
  } },
  zeus_wave: { rv: .5, gap: .2, f(A, t, o) {
    const k = 1 + ((o.n || 1) - 1) * .08;
    for (let i = 0; i < 4; i++) {
      const w = t + (i ? rnd(.03, .28) : 0), z = A.tone(w, { w: 'sawtooth', f: 140 * k, a: .002, d: .12, v: .25, filt: ['bandpass', 1900, .8], pan: rnd(-.6, .6) });
      A.lfo(w, .14, 41 + i * 5, 100, z.osc.frequency, 'square'); A.nz(w, { type: 'highpass', f: 1500, d: .04, v: i ? .5 : .8 }); A.crk(w, .12, 90, .4, 2600);
    }
    A.tone(t, { fc: [[0, 90 * k], [.5, 30]], a: .002, d: .5, v: .6 });
    const r = A.nz(t + .03, { buf: 'brown', type: 'lowpass', fc: [[0, 600], [.9, 140]], d: .8, v: .9 }); A.wobble(r.g2, t, .9, .08, .1);
  } },
  zeus_clap: { rv: .8, duck: [.4, 2.5], f(A, t) {
    A.nz(t, { type: 'highpass', f: 900, d: .08, v: 1 }); A.tone(t, { fc: [[0, 120], [1.4, 24]], a: .002, d: 1.4, v: .95 });
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 2500], [2, 100]], a: .003, d: 2, v: 1.4 }); A.wobble(r.g2, t, 2.2, .1, .12);
    A.crk(t, .4, 140, .5, 2500); A.metal(t, 98, [1, 1.6, 2.3, 3.1], [.5, .4, .3, .2], [1.5, 1.1, .8, .5], .14);
    A.choir(t + .05, [62, 69, 74, 81], .02, .3, 1, .14); A.dr(t, 'b', .9);
  } },
  // round 30: the three new ultimates (skillbook.js inferno, gaia, void)
  inferno_rise: { rv: .5, duck: [.6, 2], f(A, t) { // a furnace roaring up around her: a rising fire-roar, crackle, a low swell
    const r = A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 300], [.8, 2400], [2, 900]], a: .5, h: .9, d: .7, v: .9, am: [13, .35] }); A.wobble(r.g2, t, 2, .07, .08);
    A.nz(t, { type: 'bandpass', q: 1.2, fc: [[0, 500], [1.2, 1800]], a: .6, h: .6, d: .6, v: .3 });
    A.crk(t + .1, 1.9, [30, 120], .3, 2600); A.tone(t, { fc: [[0, 45], [1.2, 70]], a: .6, h: .6, d: .6, v: .35 });
  } },
  inferno_nova: { rv: .7, duck: [.4, 1.5], f(A, t) { // the ring of fire bursting out
    A.tone(t, { fc: [[0, 110], [1, 28]], a: .002, d: 1, v: .9 }); A.nz(t, { type: 'highpass', f: 1800, d: .08, v: .7 });
    const r = A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 4000], [1.4, 300]], a: .004, d: 1.4, v: 1.2 }); A.wobble(r.g2, t, 1.4, .06, .1);
    A.crk(t + .02, 1.2, [120, 15], .45, 2200); A.choir(t + .05, [50, 57, 62], .02, .2, .9, .1);
  } },
  gaia_rise: { rv: .5, duck: [.5, 1.5], f(A, t) { // stone tearing up out of the earth: a deep groan, grinding, cracks
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 160], [.4, 420], [1.3, 120]], a: .05, h: .3, d: 1, v: 1.3 }); A.wobble(r.g2, t, 1.4, .06, .08);
    A.tone(t, { w: 'sawtooth', fc: [[0, 38], [.5, 55], [1.2, 30]], a: .05, h: .3, d: .9, v: .22, filt: ['lowpass', 200, 1] });
    A.crk(t, 1.1, [70, 10], .5, 1300, 'bandpass', 1); A.metal(t + .05, 120, [1, 1.9, 2.7], [.4, .3, .2], [.4, .3, .2], .08);
  } },
  gaia_wave: { rv: .45, gap: .2, f(A, t) { // a further ring of spikes: a shorter groan and a burst of cracks
    const r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 260], [.6, 130]], a: .02, d: .7, v: 1 }); A.wobble(r.g2, t, .8, .06, .08);
    A.crk(t + .03, .6, [50, 8], .4, 1500, 'bandpass', 1); A.tone(t, { fc: [[0, 70], [.6, 30]], a: .005, d: .6, v: .5 });
  } },
  void_open: { rv: .9, duck: [.4, 1], f(A, t) { // space tearing: an inward rush, a sub drop, a dissonant choir sucked down
    A.nz(t, { type: 'bandpass', q: 2, fc: [[0, 6000], [.7, 300]], a: .02, d: .7, v: .55 });
    A.tone(t, { fc: [[0, 160], [.9, 26]], a: .01, h: .2, d: .8, v: .75 }); A.tone(t, { w: 'sawtooth', fc: [[0, 220], [.9, 40]], a: .01, d: .9, v: .08, filt: ['lowpass', 600, 2] });
    A.choir(t, [61, 62, 68], .05, .3, .6, .08);
  } },
  void_hum: { rv: .8, f(A, t) { // the void turning: a beating sub drone and a slow whirl of air for about 3.5 s
    A.tone(t, { f: 41, a: .4, h: 2.6, d: .6, v: .45, am: [3.1, .5] }); A.tone(t, { f: 43.5, a: .4, h: 2.6, d: .6, v: .3 });
    const r = A.nz(t, { buf: 'pink', type: 'bandpass', q: 3, fc: [[0, 400], [1.5, 1400], [3.2, 300]], a: .5, h: 2.2, d: .8, v: .4, am: [.9, .7] }); A.wobble(r.g2, t, 3.4, .25, .2);
    A.tone(t, { w: 'triangle', fc: [[0, 880], [3.4, 220]], a: .8, h: 1.8, d: .8, v: .03, vib: [5, 30, 1] });
  } },
  void_collapse: { rv: 1, duck: [.3, 2.5], f(A, t) { // the swallow and the blast: a short reversed swell, silence, then the boom
    A.nz(t, { type: 'bandpass', q: 1.5, fc: [[0, 300], [.3, 5000]], a: .3, d: .02, v: .6 });
    A.tone(t + .3, { fc: [[0, 140], [1.6, 22]], a: .002, d: 1.6, v: 1 }); A.nz(t + .3, { type: 'highpass', f: 1200, d: .1, v: .9 });
    const r = A.nz(t + .3, { buf: 'brown', type: 'lowpass', fc: [[0, 3000], [2, 90]], a: .003, d: 2, v: 1.5 }); A.wobble(r.g2, t + .3, 2.2, .1, .12);
    A.crk(t + .3, .5, 140, .5, 2600); A.metal(t + .3, 70, [1, 1.5, 2.2, 3.3], [.5, .4, .3, .2], [1.6, 1.2, .8, .5], .12);
  } },
  // ---- round 31: the new skills' own sounds
  bluearc_flare: { rv: .3, f(A, t) { // Prometheus' Arc: a whoosh of fire swept round in a half circle, with a cold blue shimmer over it
    const r = A.nz(t, { type: 'bandpass', q: 1.4, fc: [[0, 500], [.12, 2600], [.34, 700]], a: .02, h: .08, d: .3, v: .8, pan: -.6 });
    if (r.p && r.p.pan) { r.p.pan.setValueAtTime(-.6, t); r.p.pan.linearRampToValueAtTime(.6, t + .3); }
    A.nz(t, { buf: 'pink', type: 'lowpass', f: 1200, a: .02, h: .12, d: .3, v: .4, am: [23, .4] }); A.crk(t + .02, .35, 40, .18, 3200);
    A.tone(t + .02, { w: 'triangle', fc: [[0, 1320], [.3, 1980]], a: .02, d: .3, v: .05, vib: [7, 40, 1] }); A.tone(t + .02, { w: 'triangle', f: 2637, a: .03, d: .35, v: .025 });
  } },
  shuttle_out: { rv: .15, f(A, t) { // Arachne's Shuttle: a taut string's zip going out
    const r = A.nz(t, { type: 'bandpass', q: 5, fc: [[0, 900], [.2, 7000]], a: .005, h: .06, d: .1, v: .6, pan: -.4 });
    if (r.p && r.p.pan) { r.p.pan.setValueAtTime(-.4, t); r.p.pan.linearRampToValueAtTime(.5, t + .2); }
    A.tone(t, { w: 'triangle', fc: [[0, 660], [.18, 1760]], a: .005, d: .2, v: .07 }); A.metal(t + .02, 3200, [1, 1.5], [.4, .25], [.15, .1], .04);
  } },
  shuttle_back: { rv: .15, f(A, t) { // and the zip back, a little lower, a bright ring as the cut closes
    const r = A.nz(t, { type: 'bandpass', q: 5, fc: [[0, 6000], [.2, 800]], a: .005, h: .06, d: .1, v: .6, pan: .5 });
    if (r.p && r.p.pan) { r.p.pan.setValueAtTime(.5, t); r.p.pan.linearRampToValueAtTime(-.4, t + .2); }
    A.tone(t, { w: 'triangle', fc: [[0, 1760], [.18, 880]], a: .005, d: .2, v: .07 }); A.metal(t + .2, 2400, [1, 1.47, 2.1], [.45, .3, .2], [.3, .2, .12], .07);
  } },
  shuttle_turn: { rv: .1, f(A, t) { A.nz(t, { type: 'bandpass', q: 2, f: 1800, a: .003, d: .06, v: .4 }); A.tone(t, { fc: [[0, 220], [.06, 120]], d: .07, v: .2 }); } },
  spear_recall: { rv: .4, f(A, t) { // Achilles' Spear, the second cast: a bright snap of light and a landing thump at the spear
    A.nz(t, { type: 'bandpass', q: 3, fc: [[0, 6000], [.14, 1200]], a: .003, d: .14, v: .55 });
    A.tone(t, { w: 'triangle', fc: [[0, 1568], [.12, 2349]], a: .005, d: .3, v: .07 }); A.tone(t + .01, { w: 'triangle', f: 3136, a: .01, d: .35, v: .03 });
    A.tone(t + .12, { fc: [[0, 120], [.12, 55]], a: .002, d: .14, v: .45 }); A.nz(t + .12, { type: 'lowpass', f: 700, d: .08, v: .35 });
  } },
  storm_howl: { rv: .6, f(A, t) { // Eye of the Storm: the three tornadoes' howl for about three seconds
    for (let i = 0; i < 3; i++) { const r = A.nz(t + i * .1, { buf: 'pink', type: 'bandpass', q: 4, fc: [[0, 350 + i * 120], [1.2, 900 + i * 200], [2.8, 400]], a: .3, h: 2, d: .7, v: .32, am: [2.3 + i, .5], pan: (i - 1) * .6 }); A.wobble?.(r.g2, t, 3, .3, .2); }
    A.tone(t, { f: 55, a: .3, h: 2.2, d: .6, v: .25, am: [1.7, .4] });
  } },
};
// ---------------- round 33 (Roy's audio spec): weapon categories, skill signatures, monsters, stone knights, the Kraken ----------------
// The weapon categories (audiodata.js WEAPON_AUDIO) shade V's swings and blows (wSwing / wHit read o.wc, which sfxPlay
// fills from setWeapon). A chop: a heavy head's thud in the air and in the body; a thrust: a narrow rising hiss.
function catSwing(A, t, d, C, k) {
  if (C.chop) { A.nz(t + d * .15, { buf: 'pink', type: 'lowpass', fc: [[0, 150], [d * .5, 520], [d, 160]], a: d * .45, d: d * .55, v: .32 * C.chop }); A.tone(t + d * .3, { fc: [[0, 120 * k], [d * .6, 62]], a: d * .25, d: d * .45, v: .12 * C.chop }); }
  if (C.thrust) A.nz(t, { type: 'bandpass', q: 3.2, fc: [[0, 900 * k], [d * .7, 2400 * k]], a: d * .5, d: d * .35, v: .16 * C.thrust });
}
function catHit(A, t, C, k, v = 1) {
  if (C.hit === 'chop') { A.tone(t, { fc: [[0, 210 * k], [.07, 85]], a: .001, d: .09, v: .3 * v * (.5 + C.chop) }); A.nz(t + .003, { buf: 'pink', type: 'bandpass', f: 520 * k, q: 1.4, d: .07, v: .35 * v * (.5 + C.chop) }); A.crk(t + .006, .06, 120, .14 * v, 1600, 'bandpass', 1.1); }
  else if (C.hit === 'pierce') { A.nz(t, { type: 'bandpass', q: 3, fc: [[0, 1900 * k], [.03, 900 * k]], d: .035, v: .3 * v }); A.tone(t + .01, { fc: [[0, 300 * k], [.05, 120]], d: .05, v: .18 * v }); }
  else if (C.hit === 'bash') { A.tone(t, { fc: [[0, 140], [.12, 55]], a: .001, d: .14, v: .35 * v }); A.nz(t, { type: 'lowpass', f: 900, d: .06, v: .3 * v }); }
}
// equip: the sound of taking the weapon up (sound.js plays it when the weapon in hand changes)
const EQUIP_CAT = {
  draw(A, t, z) { A.nz(t, { type: 'bandpass', q: 4, fc: [[0, 1800], [.18 * z, 3600]], a: .03, d: .18 * z, v: .16 }); A.metal(t + .17 * z, 2400 / z, [1, 1.51, 2.2], [.5, .3, .2], [.25, .18, .1], .05); },
  draw2(A, t) { EQUIP_CAT.draw(A, t, 1.5); A.tone(t + .26, { fc: [[0, 140], [.15, 70]], d: .14, v: .12 }); },
  haft(A, t, z = 1) { A.tone(t, { fc: [[0, 420 / z], [.05, 300 / z]], a: .001, d: .07, v: .22 }); A.nz(t, { type: 'bandpass', f: 900 / z, q: 2, d: .05, v: .25 }); A.crinkle(t + .06, .12, .25, 800, .9, .012, .03); A.metal(t + .12, 1700 / z, [1, 1.58], [.5, .3], [.12, .08], .04); },
  haft2(A, t) { EQUIP_CAT.haft(A, t, 1.35); A.tone(t + .15, { fc: [[0, 110], [.2, 50]], d: .2, v: .2 }); },
  shaft(A, t) { A.tone(t, { fc: [[0, 520], [.04, 380]], a: .001, d: .05, v: .2 }); A.nz(t + .02, { type: 'bandpass', q: 2, fc: [[0, 600], [.2, 1400]], a: .08, d: .14, v: .18 }); },
  strap(A, t) { A.crinkle(t, .2, .4, 850, .9, .012, .03); A.tone(t + .16, { fc: [[0, 180], [.1, 90]], a: .001, d: .12, v: .3 }); A.metal(t + .16, 520, [1, 1.6, 2.3], [.5, .3, .2], [.3, .2, .12], .06); },
};
// ---- skill signatures (audiodata.js SKILL_AUDIO): a short motif in the element's own voice, quiet, under the cast
const SKV = {
  fire(A, t, f, d, v, p) { A.tone(t, { w: 'sawtooth', f, a: .012, d, v: v * .95, filt: ['lowpass', Math.min(1600, f * 3), .8], pan: p }); A.crk(t, d * .8, 40, .05 * v, 2200); },
  ice(A, t, f, d, v, p) { A.tone(t, { f, a: .002, d: d * 1.6, v: v * .7, pan: p }); A.tone(t, { f: f * 2.76, a: .002, d: d * .7, v: v * .12, pan: p }); },
  storm(A, t, f, d, v, p) { A.tone(t, { w: 'square', f, a: .004, d, v: v * .85, filt: ['bandpass', f * 2.2, 1.2], am: [27, .6], pan: p }); },
  holy(A, t, f, d, v, p) { A.tone(t, { f, a: .003, d: d * 2, v: v * .7, pan: p }); A.tone(t, { f: f * 2, a: .003, d: d * 1.2, v: v * .18, pan: p }); A.tone(t, { f: f * 3.01, a: .003, d: d * .8, v: v * .06, pan: p }); },
  shadow(A, t, f, d, v, p) { for (const dt of [-9, 9]) { const r = A.tone(t, { w: 'triangle', f: f / 2, a: d * .3, d: d * 1.3, v: v * .45, filt: ['lowpass', 900, .7], pan: p }); r.osc.detune.value = dt; } },
  earth(A, t, f, d, v, p) { A.tone(t, { w: 'triangle', fc: [[0, f / 2 * 1.08], [d, f / 2]], a: .002, d: d * 1.2, v: v * .8, pan: p }); A.nz(t, { buf: 'brown', type: 'lowpass', f: 280, d: d * .6, v: v * .7, pan: p }); },
  water(A, t, f, d, v, p) { A.tone(t, { fc: [[0, f * .8], [d * .4, f]], a: .004, d: d * 1.3, v: v * .65, am: [9, .3], pan: p }); },
  wind(A, t, f, d, v, p) { A.nz(t, { buf: 'pink', type: 'bandpass', f: Math.min(2400, f * 1.5), q: 9, a: d * .4, d: d * 1.2, v: v * 1.4, pan: p }); A.tone(t, { f, a: d * .3, d, v: v * .2, pan: p }); },
  venom(A, t, f, d, v, p) { A.tone(t, { w: 'square', fc: [[0, f * 1.05], [d, f * .85]], a: .003, d, v: v * .3, filt: ['lowpass', 1300, 2], am: [13, .5], pan: p }); },
  steel(A, t, f, d, v, p) { A.metal(t, Math.min(2600, f * 2), [1, 1.5, 2.13], [.5, .28, .15], [d * 1.5, d, d * .6], v * .55); A.tone(t, { f, a: .002, d, v: v * .3, pan: p }); },
  time(A, t, f, d, v, p) { A.crk(t, .012, 400, .2 * v, 3000); A.tone(t, { f, a: .002, d: d * 1.5, v: v * .55, pan: p }); A.tone(t, { f: f * 1.5, a: .002, d: d * .6, v: v * .12, pan: p }); },
  spirit(A, t, f, d, v, p) { A.tone(t, { w: 'triangle', f, a: d * .35, d: d * 1.4, v: v * .5, vib: [5.5, 18, .05], filt: ['lowpass', 1800, .7], pan: p }); A.tone(t, { f: f * 1.5, a: d * .4, d: d * 1.2, v: v * .15, pan: p }); },
  stone(A, t, f, d, v, p) { A.nz(t, { buf: 'brown', type: 'bandpass', f: Math.max(160, f / 2), q: 1.2, a: .01, d: d * 1.1, v: v * 1.1, pan: p }); A.tone(t, { w: 'triangle', f: f / 2, a: .004, d, v: v * .5, pan: p }); },
};
const SK_STEP = { strike: .05, aoe: .07, proj: .055, buff: .085, move: .045, summon: .09, ult: .1, call: .07 };
const ELEM_HIT = {
  fire(A, t, v) { A.nz(t, { type: 'lowpass', fc: [[0, 500], [.06, 1800], [.25, 400]], a: .01, d: .22, v: .3 * v }); A.crk(t + .02, .2, 30, .14 * v, 1700, 'bandpass', 1); },
  ice(A, t, v) { for (let i = 0; i < 3; i++) A.tone(t + i * .025, { f: [1760, 2217, 2637][i], a: .001, d: .12, v: .04 * v }); A.nz(t, { type: 'bandpass', f: 2400, q: 3, d: .05, v: .1 * v }); }, // (gentler than the old frost sparkle)
  storm(A, t, v) { const z = A.tone(t, { w: 'sawtooth', f: 120, a: .002, d: .09, v: .1 * v, filt: ['bandpass', 1600, 1] }); A.lfo(t, .1, 41, 70, z.osc.frequency, 'square'); A.crk(t, .08, 90, .12 * v, 1800, 'bandpass', 1); }, holy: (A, t, v) => ELEM.holy(A, t, v), shadow: (A, t, v) => ELEM.shadow(A, t, v),
  venom: (A, t, v) => ELEM.poison(A, t, v), spirit: (A, t, v) => ELEM.spirit ? ELEM.spirit(A, t, v) : ELEM.holy(A, t, v * .7),
  earth(A, t, v) { A.tone(t, { fc: [[0, 110], [.15, 48]], a: .002, d: .16, v: .4 * v }); A.nz(t, { buf: 'brown', type: 'lowpass', f: 400, d: .14, v: .5 * v }); },
  stone(A, t, v) { MAT.stone(A, t, .6 * v, 1); },
  water(A, t, v) { A.nz(t, { type: 'lowpass', fc: [[0, 2600], [.18, 500]], d: .18, v: .3 * v }); A.tone(t + .02, { fc: [[0, 500], [.06, 900]], d: .06, v: .08 * v }); },
  wind(A, t, v) { A.nz(t, { buf: 'pink', type: 'bandpass', q: 1.4, fc: [[0, 500], [.08, 1600], [.2, 600]], a: .04, d: .16, v: .4 * v }); },
  steel(A, t, v) { A.metal(t, 2300, [1, 1.47, 2.09], [.5, .3, .2], [.15, .1, .07], .05 * v); },
  time(A, t, v) { A.tone(t, { f: 1318, a: .002, d: .18, v: .05 * v }); A.crk(t, .01, 500, .15 * v, 3000); },
};
// ---- monsters: a voice per family timbre (audiodata.js MONSTER_FAMILIES), pitched and weighted by size
// o: {voice, f0 (Hz), w (weight), kind: idle|aggro|attack|hurt|die}
const MVOICE = {
  growl(A, t, f, w, k) { const d = k === 'die' ? .7 : k === 'hurt' ? .18 : k === 'idle' ? .45 : .6; const fe = k === 'hurt' ? [[0, f * 2], [d, f * 1.2]] : k === 'die' ? [[0, f * 1.4], [d, f * .6]] : [[0, f * .9], [d * .5, f * 1.1], [d, f * .85]];
    A.tone(t, { w: 'sawtooth', fc: fe, a: .03, d, v: .11 * w, filt: ['lowpass', Math.min(1500, f * 5), 1.2], am: [rnd(22, 34), .55] }); A.nz(t, { buf: 'pink', type: 'bandpass', f: f * 3, q: 2, a: .03, d, v: .1 * w, am: [rnd(22, 34), .5] }); },
  snarl(A, t, f, w, k) { const d = k === 'hurt' ? .2 : k === 'die' ? .8 : .5; A.nz(t, { type: 'bandpass', q: 1.6, fc: [[0, f * 4], [d, f * 2.5]], a: .02, d, v: .2 * w, am: [rnd(30, 45), .6] }); A.tone(t, { w: 'sawtooth', fc: [[0, f], [d, f * (k === 'die' ? .5 : .8)]], a: .02, d, v: .08 * w, filt: ['lowpass', f * 6, 1] }); },
  grunt(A, t, f, w, k) { const n = k === 'idle' ? 2 : k === 'die' ? 1 : 1, d = k === 'die' ? .6 : k === 'hurt' ? .14 : .2; for (let i = 0; i < n; i++) A.tone(t + i * .22, { w: 'sawtooth', fc: [[0, f * (k === 'hurt' ? 1.6 : 1.05)], [d, f * (k === 'die' ? .55 : .8)]], a: .01, d, v: .14 * w, filt: ['lowpass', Math.min(1100, f * 5), 1.4], am: [rnd(16, 24), .5] }); A.nz(t, { buf: 'brown', type: 'lowpass', f: 500, d: d * .8, v: .2 * w }); },
  roar(A, t, f, w, k) { const d = k === 'die' ? 1.4 : k === 'hurt' ? .35 : k === 'idle' ? .6 : 1.0; A.tone(t, { w: 'sawtooth', fc: [[0, f * .9], [d * .3, f * 1.15], [d, f * (k === 'die' ? .5 : .8)]], a: d * .15, d, v: .13 * w, filt: ['lowpass', Math.min(900, f * 5), .9], vib: [5, 25, .2] });
    A.nz(t, { buf: 'pink', type: 'bandpass', q: .9, f: Math.min(1200, f * 4), a: d * .15, d, v: .22 * w, am: [rnd(14, 22), .4] }); A.tone(t, { f: f / 2, a: d * .2, d, v: .1 * w }); },
  screech(A, t, f, w, k) { const d = k === 'hurt' ? .16 : k === 'die' ? .5 : .3; A.tone(t, { w: 'triangle', fc: [[0, f], [d * .3, f * 1.35], [d, f * (k === 'die' ? .6 : .9)]], a: .01, d, v: .1 * w, vib: [16, 60, .02], filt: ['lowpass', 2600, .7] }); A.nz(t, { type: 'bandpass', q: 4, f: Math.min(2400, f * 2), a: .01, d: d * .6, v: .05 * w }); },
  rattle(A, t, f, w, k) { const d = k === 'die' ? .6 : .3; A.crk(t, d, [90, 30], .25 * w, 1800, 'bandpass', 2); A.tone(t, { w: 'triangle', fc: [[0, f], [d, f * .8]], a: .01, d: d * .6, v: .07 * w, filt: ['bandpass', f * 2, 2] }); if (k === 'die') A.crk(t + .25, .5, [60, 10], .3 * w, 1400, 'bandpass', 1.5); },
  wail(A, t, f, w, k) { const d = k === 'die' ? 1.4 : k === 'hurt' ? .3 : .9; A.tone(t, { fc: [[0, f * .9], [d * .5, f * 1.12], [d, f * (k === 'die' ? .5 : .95)]], a: d * .3, d, v: .07 * w, vib: [4.5, 30, .2] }); A.tone(t + .05, { fc: [[0, f * 1.5], [d, f * 1.4]], a: d * .4, d: d * .8, v: .025 * w }); },
  shout(A, t, f, w, k) { const d = k === 'die' ? .55 : k === 'hurt' ? .16 : .28, sw = A.tone(t, { w: 'sawtooth', fc: [[0, f * (k === 'hurt' ? 1.3 : 1)], [d, f * (k === 'die' ? .7 : .95)]], a: .015, d, v: .1 * w, filt: ['bandpass', 750, 2.2] });
    A.tone(t, { w: 'sawtooth', fc: [[0, f], [d, f * .95]], a: .015, d, v: .05 * w, filt: ['bandpass', 1250, 3] }); return sw; },
  hiss(A, t, f, w, k) { const d = k === 'die' ? .9 : k === 'hurt' ? .2 : .55; A.nz(t, { buf: 'pink', type: 'bandpass', q: 1.3, fc: [[0, 1900], [d, 2500]], a: d * .2, d, v: .2 * w, am: [rnd(9, 13), .3] }); A.nz(t, { type: 'lowpass', f: 4000, a: d * .3, d: d * .7, v: .025 * w }); },
  chitter(A, t, f, w, k) { const d = k === 'die' ? .5 : .25; A.crk(t, d, [160, 60], .3 * w, Math.min(2600, f * 2), 'bandpass', 3); A.tone(t, { w: 'square', f: f / 2, a: .002, d: .05, v: .03 * w, am: [40, .9], filt: ['lowpass', 1600, 1] }); },
  click(A, t, f, w) { for (const dt of [0, .07]) A.nz(t + dt, { type: 'bandpass', f: Math.min(2400, f * 2), q: 5, d: .02, v: .3 * w }); },
  grind(A, t, f, w, k) { const d = k === 'die' ? 1.2 : .5; const r = A.nz(t, { buf: 'brown', type: 'bandpass', q: 1.2, f: Math.max(140, f * 2.5), a: .05, d, v: .45 * w }); A.wobble(r.g2, t, d, .05, .02); A.crk(t, d, 50, .12 * w, 1300, 'bandpass', 1.2); },
  gurgle(A, t, f, w, k) { const d = k === 'die' ? 1 : .45; for (let i = 0; i < 5; i++) A.tone(t + i * d / 5 + rnd(0, .03), { fc: [[0, f * rnd(1.5, 3)], [.06, f * rnd(3, 5)]], a: .002, d: .06, v: .05 * w }); A.nz(t, { buf: 'brown', type: 'lowpass', f: 600, d, v: .25 * w }); },
  creak(A, t, f, w, k) { const d = k === 'die' ? .9 : .4; A.tone(t, { w: 'sawtooth', fc: [[0, f], [d, f * .7]], a: .02, d, v: .06 * w, am: [rnd(28, 40), .9], filt: ['bandpass', f * 3, 3] }); A.crinkle(t, d * .7, .2 * w, 1000, 1, .01, .03); },
  roarFire(A, t, f, w, k) { MVOICE.roar(A, t, f, w, k); A.crk(t + .05, .5, 50, .1 * w, 2200); },
};
const MSTEP = {
  pad(A, t, w, k) { A.tone(t, { fc: [[0, 120 * k], [.06, 60 * k]], a: .002, d: .07, v: .14 * w }); A.nz(t, { buf: 'pink', type: 'lowpass', f: 600, d: .05, v: .12 * w }); },
  hoof(A, t, w, k) { A.tone(t, { fc: [[0, 330 * k], [.04, 170 * k]], a: .001, d: .05, v: .16 * w }); A.nz(t, { type: 'bandpass', f: 900 * k, q: 2, d: .035, v: .2 * w }); },
  bone(A, t, w, k) { A.nz(t, { type: 'bandpass', f: 1800 * k, q: 4, d: .025, v: .16 * w }); A.tone(t, { fc: [[0, 300 * k], [.04, 200 * k]], d: .04, v: .06 * w }); },
  foot(A, t, w, k) { A.nz(t, { buf: 'pink', type: 'lowpass', f: 900 * k, d: .06, v: .14 * w }); A.tone(t, { fc: [[0, 110 * k], [.06, 70 * k]], d: .06, v: .08 * w }); },
  quake(A, t, w, k) { A.tone(t, { fc: [[0, 70 * k], [.3, 34]], a: .004, d: .3, v: .2 * w }); A.nz(t, { buf: 'brown', type: 'lowpass', f: 260, d: .35, v: .26 * w }); A.crk(t + .02, .2, [80, 10], .08 * w, 1500); },
  slither(A, t, w, k) { A.nz(t, { buf: 'pink', type: 'bandpass', q: 1.5, fc: [[0, 700 * k], [.25, 1100 * k]], a: .08, d: .2, v: .07 * w }); },
  chitin(A, t, w, k) { for (const dt of [0, .035]) A.nz(t + dt, { type: 'bandpass', f: 2000 * k, q: 4, d: .015, v: .1 * w }); },
  stone(A, t, w, k) { A.tone(t, { fc: [[0, 95 * k], [.12, 45]], a: .002, d: .13, v: .25 * w }); A.nz(t, { buf: 'brown', type: 'lowpass', f: 450, d: .1, v: .35 * w }); A.crk(t, .06, 120, .06 * w, 1600); },
  splash(A, t, w, k) { A.nz(t, { type: 'lowpass', fc: [[0, 1800 * k], [.15, 400]], d: .15, v: .14 * w }); },
  flap(A, t, w, k) { A.nz(t, { buf: 'pink', type: 'bandpass', q: 1.1, fc: [[0, 350 * k], [.07, 900 * k], [.16, 300 * k]], a: .05, d: .12, v: .18 * w }); },
  rustle(A, t, w) { A.crinkle(t, .15, .12 * w, 1100, .9, .01, .025); },
  none() {},
};
const NEW_SFX = {
  // V's weapon: a missed blow's thin tail of air (her swing is already the whoosh), and taking a weapon up
  wc_miss: { gap: .08, f(A, t, o) { const C = WEAPON_AUDIO[o.wc] || WEAPON_AUDIO.sword1, k = C.swing.k * rnd(.95, 1.05); A.nz(t, { buf: 'pink', type: 'bandpass', q: 2.2, fc: [[0, 1300 * k], [.18, 700 * k]], a: .02, d: .2, v: .12 }); } },
  wc_equip: { rv: .15, gap: .2, f(A, t, o) { const C = WEAPON_AUDIO[o.wc] || WEAPON_AUDIO.sword1; (EQUIP_CAT[C.equip] || EQUIP_CAT.draw)(A, t, 1); } },
  // the stone knights' shield slam (entities.js calls 'bash'), their grinding wind-ups, the rolling charge, the leap
  bash: { rv: .25, gap: .08, loud: true, f(A, t) { MAT.stone(A, t, 1.1, .9); A.metal(t, 240, [1, 1.6, 2.3], [.5, .3, .2], [.35, .25, .15], .1); A.tone(t, { fc: [[0, 90], [.25, 38]], a: .002, d: .28, v: .55 }); A.crk(t + .01, .3, [200, 20], .2, 1500, 'bandpass', .9); } },
  stone_grind: { rv: .15, gap: .3, f(A, t, o) { const d = o.dur || .6, r = A.nz(t, { buf: 'brown', type: 'bandpass', q: 1.1, fc: [[0, 220], [d, 380]], a: d * .3, d: d * .8, v: .5 }); A.wobble(r.g2, t, d, .04, .015); A.crk(t, d, [40, 90], .12, 1400, 'bandpass', 1.1); A.tone(t, { w: 'triangle', fc: [[0, 55], [d, 62]], a: d * .3, d, v: .1 }); } },
  stone_roll: { rv: .15, gap: .3, loud: true, f(A, t, o) {
    const d = clamp(o.dur || 1, .3, 2.5), sp = clamp(o.speed || 13, 4, 20), r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 180], [d * .3, 420], [d, 220]], a: .08, h: d * .6, d: d * .4, v: .42 });
    A.wobble(r.g2, t, d, .03, .01); A.crk(t, d, [70, 110], .16, 1300, 'bandpass', .9); // grit under it
    for (let x = 0; x < d; x += 2.1 / sp) A.tone(t + x, { fc: [[0, 85], [.08, 48]], a: .002, d: .09, v: .2 }); // the shield's rim catching the ground, turn after turn
  } },
  stone_whoosh: { rv: .1, gap: .2, f(A, t, o) { const d = o.dur || .45; A.nz(t, { buf: 'pink', type: 'lowpass', fc: [[0, 160], [d * .5, 700], [d, 180]], a: d * .45, d: d * .55, v: .6 }); A.tone(t, { fc: [[0, 70], [d, 45]], a: d * .4, d: d * .6, v: .2 }); } },
  // skills (sound.js): sig {el, kind, root, motif}; hit {el, root}; tick {el, root}
  sk_sig: { rv: .3, gap: .06, f(A, t, o) {
    const el = SKV[o.el] ? o.el : 'steel', st = SK_STEP[o.kind] || .06, root = clamp(o.root || 60, 36, 88), M = o.motif || [0, 7], vv = .09 * (o.kind === 'ult' ? 1.2 : 1);
    M.forEach((s, i) => { const m = clamp(root + s, 33, 93), last = i === M.length - 1; SKV[el](A, t + i * st, mtof(m), last ? st * 3 : st * 1.6, vv * (last ? 1 : .8), (i % 2 ? .12 : -.12)); });
  } },
  sk_hit: { rv: .2, gap: .05, grp: 'skhit', f(A, t, o) { const el = ELEM_HIT[o.el] ? o.el : 'steel'; ELEM_HIT[el](A, t, .7); if (o.root) A.tone(t + .005, { f: mtof(clamp(o.root + 12, 48, 88)), a: .002, d: .09, v: .035 }); } },
  sk_tick: { gap: .12, grp: 'skhit', f(A, t, o) { const f = mtof(clamp((o.root || 60) + 12, 48, 88)); A.tone(t, { f, a: .004, d: .07, v: .028, filt: ['lowpass', 2000, .7] }); } },
  // monsters (sound.js): mon_voice {voice, f0, w, kind}, mon_step {step, w, k}
  // (the weight grows the low end more than the loudness: a giant is deeper and heavier, not three times as loud)
  mon_voice: { rv: .22, gap: .02, grp: 'mon', f(A, t, o) { (MVOICE[o.voice] || MVOICE.growl)(A, t, clamp(o.f0 || 150, 25, 1400), Math.pow(clamp(o.w || 1, .2, 2.4), .55), o.kind || 'idle'); } },
  mon_step: { rv: .08, gap: .015, grp: 'mstep', f(A, t, o) { (MSTEP[o.step] || MSTEP.foot)(A, t, Math.pow(clamp(o.w || 1, .2, 2.4), .6), clamp(o.k || 1, .4, 1.8)); } },
  // the Kraken (sound.js, on ferry.js's voyage state): huge, wet, low
  kraken_rise_sfx: { rv: .4, gap: 2, loud: true, f(A, t) { const r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 120], [1.6, 420], [3, 160]], a: 1.4, d: 1.8, v: .5 }); A.wobble(r.g2, t, 3, .2, .1); for (let i = 0; i < 9; i++) A.tone(t + 1 + rnd(0, 1.8), { fc: [[0, rnd(140, 260)], [.08, rnd(300, 500)]], a: .003, d: .08, v: .05 }); A.tone(t + .4, { fc: [[0, 40], [2.4, 34]], a: .8, d: 1.8, v: .3 }); } },
  kraken_roar: { rv: .45, gap: 1.2, loud: true, f(A, t, o) { const d = o.short ? .8 : 1.8, f = o.short ? 62 : 48; A.tone(t, { w: 'sawtooth', fc: [[0, f], [d * .3, f * 1.25], [d, f * .7]], a: d * .15, d, v: .2, filt: ['lowpass', 420, 1.1], vib: [3.5, 30, .3], am: [rnd(11, 15), .35] });
    A.nz(t, { buf: 'pink', type: 'bandpass', q: .8, f: 380, a: d * .2, d, v: .35, am: [rnd(9, 13), .4] }); A.tone(t, { f: f / 2, a: d * .2, d, v: .25 }); for (let i = 0; i < 6; i++) A.tone(t + rnd(.1, d), { fc: [[0, rnd(120, 220)], [.07, rnd(260, 420)]], a: .003, d: .07, v: .05 }); } },
  kraken_arm: { rv: .3, gap: .5, f(A, t) { A.nz(t, { type: 'lowpass', fc: [[0, 300], [.5, 2400], [1.1, 500]], a: .4, d: .7, v: .35 }); A.nz(t + .45, { buf: 'pink', type: 'lowpass', fc: [[0, 3000], [.5, 400]], d: .5, v: .3 }); A.tone(t + .1, { fc: [[0, 60], [.8, 90]], a: .3, d: .6, v: .15 }); } },
  kraken_slam: { rv: .35, gap: .4, loud: true, f(A, t) { A.tone(t, { fc: [[0, 75], [.4, 32]], a: .003, d: .45, v: .6 }); A.nz(t, { buf: 'brown', type: 'lowpass', f: 600, d: .35, v: .6 }); A.crk(t + .01, .35, [260, 30], .28, 1500, 'bandpass', .9); A.nz(t + .06, { type: 'lowpass', fc: [[0, 3200], [.6, 450]], d: .6, v: .32 }); } },
  kraken_grab: { rv: .25, gap: .4, f(A, t) { for (let i = 0; i < 7; i++) A.tone(t + i * .06 + rnd(0, .02), { fc: [[0, rnd(300, 500)], [.03, rnd(150, 250)]], a: .002, d: .04, v: .07 }); A.bufp(t + .1, A._tex('creak' + (Math.random() * 3 | 0)), .35, rnd(.6, .8)); } },
  kraken_hurt: { rv: .4, gap: .6, f(A, t) { A.tone(t, { w: 'sawtooth', fc: [[0, 90], [.15, 130], [.55, 70]], a: .03, d: .55, v: .16, filt: ['lowpass', 520, 1.2], am: [17, .4] }); A.nz(t, { buf: 'pink', type: 'bandpass', q: 1, f: 500, d: .5, v: .25 }); } },
  kraken_sink: { rv: .5, gap: 3, f(A, t) { A.tone(t, { w: 'sawtooth', fc: [[0, 60], [3, 28]], a: .3, d: 3, v: .15, filt: ['lowpass', 300, 1] }); const r = A.nz(t, { buf: 'brown', type: 'lowpass', fc: [[0, 500], [3.5, 150]], a: .3, d: 3.5, v: .55 }); A.wobble(r.g2, t, 3.5, .25, .12); for (let i = 0; i < 16; i++) A.tone(t + rnd(.3, 3.4), { fc: [[0, rnd(120, 240)], [.08, rnd(260, 480)]], a: .003, d: .08, v: .04 }); } },
  // a townsperson talking (sound.js, positioned, on the voices bus): a soft murmur of syllables, never words
  chat: { rv: .2, gap: .05, grp: 'chat', bus: 'voice', f(A, t, o) {
    const p = clamp(o.p || 1, .6, 1.6), n = 3 + (Math.random() * 5 | 0); let x = t;
    for (let i = 0; i < n; i++) { const d = rnd(.07, .16), f1 = rnd(450, 800) * p, f0 = rnd(110, 150) * p;
      A.tone(x, { w: 'sawtooth', fc: [[0, f0], [d, f0 * rnd(.9, 1.1)]], a: .02, d, v: .05, filt: ['bandpass', f1, 2.2] });
      A.tone(x, { w: 'sawtooth', f: f0, a: .02, d, v: .025, filt: ['bandpass', f1 * rnd(1.8, 2.4), 3] }); x += d + rnd(.02, .07); }
  } },
};
for (const k in NEW_SFX) SFX[k] = NEW_SFX[k];
// the loudest effects step back under "reduce intense effects" (Audio.opt.reduce; sfxPlay)
const INTENSE = new Set(['boss_roar', 'quake_slam', 'thunder_bolt', 'thunder', 'kill_blow', 'fire_boom', 'charge_slam', 'zeus_clap', 'zeus_wave', 'inferno_nova', 'gaia_wave', 'void_collapse', 'oath_smash', 'rise_quake', 'rock_land', 'crack', 'storm_howl', 'hit_crit', 'crit', 'ward_break']);
// at most this many of a group at once (sfxPlay): a pack of wolves, a dozen burning foes, a market square
const GRP_MAX = { mon: 4, mstep: 5, skhit: 3, chat: 3 };
export const SFX_NAMES = ['step', ...Object.keys(SFX)];
export const addSfx = (name, def) => { SFX[name] = def; }; // round 30: sounds defined by other modules (mounts.js)
// round 22: the doors audio.door(kind, open) knows, and other names for them
export const DOOR_KINDS = ['house', 'temple', 'gate', 'stone', 'bars', 'iron', 'cave', 'lock', 'cart'];
export const DOOR_ALIAS = { wood: 'house', wooden: 'house', home: 'house', inn: 'house', shop: 'house', bronze: 'temple', shrine: 'temple', palace: 'temple', fort: 'gate', town: 'gate',
  arena: 'bars', portcullis: 'bars', grate: 'bars', cell: 'bars', cage: 'bars', underworld: 'iron', hades: 'iron', vault: 'stone', tomb: 'stone', rock: 'stone', mural: 'stone',
  slab: 'stone', mouth: 'cave', tunnel: 'cave', chest: 'lock', unlock: 'lock', key: 'lock', chariot: 'cart', wagon: 'cart', hatch: 'cart' };
function doorKind(k) { return DOOR_ALIAS[k] || (DOOR_KINDS.includes(k) ? k : 'house'); }
// round 22: every ground has its own step (see renderStep). wood = outdoor boards (decks, bridges, piers), floor = a
// room's planks, cave = a cave's damp stone (with its echo), wade = knee-deep water, ice = a frozen glaze
export const SURFACES = ['grass', 'leaves', 'dirt', 'gravel', 'mud', 'sand', 'stone', 'cave', 'marble', 'wood', 'floor', 'rug', 'snow', 'ice', 'water', 'wade'];
// other names callers may use for them
export const SURFACE_ALIAS = { meadow: 'grass', forest: 'leaves', needles: 'leaves', path: 'dirt', earth: 'dirt', road: 'gravel', pebbles: 'gravel', swamp: 'mud', marsh: 'mud',
  beach: 'sand', rock: 'stone', cobble: 'stone', dungeon: 'cave', tunnel: 'cave', underworld: 'cave', tile: 'marble', temple: 'marble', deck: 'wood', bridge: 'wood', pier: 'wood',
  plank: 'wood', interior: 'floor', house: 'floor', indoor: 'floor', carpet: 'rug', glaze: 'ice', frost: 'ice', shallows: 'water', shallow: 'water', puddle: 'water', deep: 'wade',
  ash: 'gravel', volcanic: 'gravel', scree: 'gravel', cinder: 'gravel', paving: 'stone', jetty: 'wood', dune: 'sand' }; // (round 33: the volcanic ground, town paving, jetties)
export const stepSurface = (s) => (STEP_LV[s] ? s : STEP_LV[SURFACE_ALIAS[s]] ? SURFACE_ALIAS[s] : 'dirt');
// footsteps sit up front in the mix: the owner wants to hear the walk (grass, gravel, stone) more than the music
// v31 T1 (Roy 23.10: "the walking sound should be 50% of what it is now" and later "really really loud, lower it by 30%"):
// both applied, STEP_GAIN = .5 * .7 = .35 of the round-33 level, on her steps themselves (not the sliders)
export const STEP_GAIN = .35;
const STEP_LV = { grass: .85, leaves: .8, dirt: .9, gravel: .85, mud: .85, sand: .7, stone: .9, cave: .85, marble: .85, wood: 1, floor: .85, rug: .6, snow: .8, ice: .8, water: .9, wade: .85 };
const STEP_VERB = { cave: .5, marble: .35, floor: .12, wood: .15, stone: .06 };
const HOOF_OF = { leaves: 'grass', gravel: 'dirt', mud: 'dirt', cave: 'stone', floor: 'wood', rug: 'dirt', ice: 'marble', wade: 'water' }; // (hooves keep the old eight)
const GAITS = { walk: [.55, 1], trot: [.7, 1], canter: [.8, .97], gallop: [.95, .94] };

// ---------------- ambience loops ----------------
// build(A, L): wire nodes into L.in; A._lsrc/_lfo/_wander/_event register what the loop owns.
const LOOPS = {
  sea: { rv: .12, build(A, L) {
    for (const [pan, r1, r2, off] of [[-.6, .071, .113, 0], [.6, .083, .127, 1.9]]) {
      const s = A._lsrc(L, A.brown, 1, off), lp = A.F('lowpass', 420, .5), g = A.G(.5), p = A.P(pan);
      A.chain(s, lp, g, p, L.in);
      const o = A._lfo(L, r1, .22, g.gain); A._lfo(L, r2, .13, g.gain);
      const lg = A.G(240); o.connect(lg); lg.connect(lp.frequency);
    }
    const f = A._lsrc(L, A.pink, 1, .7), bp = A.F('bandpass', 1500, .5), fg = A.G(.06); A.chain(f, bp, fg, L.in); A._lfo(L, .071, .045, fg.gain);
  } },
  surf: { rv: .15, build(A, L) {
    const s = A._lsrc(L, A.brown, 1, 2.3), lp = A.F('lowpass', 300, .5), g = A.G(.25); A.chain(s, lp, g, L.in);
    A._event(L, 5.5, 9.5, (t) => {
      const p = A.P(rnd(-.45, .45)); p.connect(L.in);
      const w = A.S(A.pink, true), lf = A.F('lowpass', 250, .7), wg = A.G(0);
      lf.frequency.setValueAtTime(250, t); lf.frequency.setTargetAtTime(2300, t + .8, .35); lf.frequency.setTargetAtTime(450, t + 1.9, 1.2);
      wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(.22, t + 1.25); wg.gain.linearRampToValueAtTime(.75, t + 1.65); wg.gain.setTargetAtTime(0, t + 1.75, 1);
      A.chain(w, lf, wg, p); w.start(t, rnd(0, 3)); w.stop(t + 7);
      const fz = A.S(A.white, true), hf = A.F('highpass', 3200, .7), fzg = A.G(0);
      fzg.gain.setValueAtTime(0, t + 1.55); fzg.gain.linearRampToValueAtTime(.13, t + 1.75); fzg.gain.setTargetAtTime(0, t + 1.85, .8);
      A.chain(fz, hf, fzg, p); fz.start(t + 1.5, rnd(0, 1)); fz.stop(t + 6.5);
    }, .3);
  } },
  // round 22 (Roy: far too much wind noise): the level follows the gain main.js asks for to the power 1.7, so the
  // everywhere-breeze (.16) sits ~18 dB under what it was and the heights (.7) ~11 dB; and a softer voice: pink noise
  // through wide low bands (Q 1-1.4, was 7-9: those narrow bands whistled), slower gusts, the low rush underneath
  // v31 T2 (Roy 23.10: wind and rain at 20% of what they are now): .065 -> .013 here, and rain below gets lvl .2 * g
  wind: { rv: .05, lvl: (g) => .013 * Math.pow(g, 1.9), // round 25 (Roy: still unbearable): about 10 dB quieter again; round 30 ("unbearable" still): halved again (-6 dB)
    build(A, L) {
    const gust = A.G(.6); gust.connect(L.in); A._wander(L, gust.gain, .35, 1, 2.5, 6, 1.6);
    const w1 = A._lsrc(L, A.pink, 1, 0), b1 = A.F('bandpass', 520, 1.1), g1 = A.G(.9), p1 = A.P(-.3);
    A.chain(w1, b1, A.F('lowpass', 1400, .5), g1, p1, gust); A._wander(L, b1.frequency, 330, 760, 2, 4.5, 1.3); A._wander(L, g1.gain, .5, 1.2, 1.5, 4, 1.1);
    const w2 = A._lsrc(L, A.pink, .97, 1.9), b2 = A.F('bandpass', 900, 1.4), g2 = A.G(.3), p2 = A.P(.35);
    A.chain(w2, b2, A.F('lowpass', 1800, .5), g2, p2, gust); A._wander(L, b2.frequency, 650, 1250, 1.8, 4, 1.2); A._wander(L, g2.gain, .12, .45, 1.5, 4, 1.1);
    const w3 = A._lsrc(L, A.brown, 1, 1.3), lp = A.F('lowpass', 320, .6), g3 = A.G(.9);
    A.chain(w3, lp, g3, gust); A._wander(L, lp.frequency, 200, 480, 2, 4.5, 1.4);
  } },
  forest: { rv: .15, build(A, L) {
    const buf = A._tex('rustle'), gust = A.G(.8); gust.connect(L.in); A._wander(L, gust.gain, .45, 1, 1.5, 4, 1);
    for (const [pan, rate, off] of [[-.5, 1, 0], [.5, .93, 2.7]]) A.chain(A._lsrc(L, buf, rate, off), A.G(.6), A.P(pan), gust);
  } },
  birds: { rv: .35, build(A, L) { A._event(L, 1, 4.5, (t) => A._bird(L.in, t), .5); } },
  night: { rv: .35, build(A, L) {
    const ca = A._tex('crickA'), cb = A._tex('crickB');
    for (const [buf, pan, rate, v] of [[ca, -.55, 1, .22], [cb, .6, .97, .18], [ca, .15, 1.04, .1]]) A.chain(A._lsrc(L, buf, rate, rnd(0, 2)), A.G(v), A.P(pan), L.in);
    const w = A._lsrc(L, A.white, 1, .4), bp = A.F('bandpass', 4700, 14), am = A.G(.5), g = A.G(.9);
    A.chain(w, bp, am, g, L.in); A._lfo(L, 31, .5, am.gain); A._wander(L, g.gain, .4, 1.1, 2, 5, 1.2);
    A._event(L, 9, 22, (t) => A._owl(L.in, t), rnd(3, 8));
  } },
  river: { rv: .1, build(A, L) {
    const buf = A._tex('river');
    for (const [pan, rate, off] of [[-.4, 1, 0], [.4, 1.07, 2.4]]) A.chain(A._lsrc(L, buf, rate, off), A.G(.55), A.P(pan), L.in);
    const b = A._lsrc(L, A.brown, 1, .5), bp = A.F('bandpass', 300, .7), g = A.G(.3); A.chain(b, bp, g, L.in); A._wander(L, g.gain, .15, .4, 1, 3, .6);
  } },
  fire: { rv: .08, build(A, L) {
    const buf = A._tex('fire'), g1 = A.G(.6);
    A.chain(A._lsrc(L, buf, 1, 0), g1, A.P(-.2), L.in); A.chain(A._lsrc(L, buf, 1.12, 2.9), A.G(.35), A.P(.25), L.in);
    A._wander(L, g1.gain, .45, .7, .3, 1.2, .2);
  } },
  portal: { rv: .75, build(A, L) {
    const sw = A.G(.7); sw.connect(L.in); A._lfo(L, .13, .25, sw.gain);
    const vox = A.G(1);
    for (const [f, q, gg] of [[700, 4, 1], [1150, 5, .7], [2600, 6, .25]]) A.chain(vox, A.F('bandpass', f, q), A.G(gg), sw);
    const l1 = A._lfo(L, .17, 9, null), l2 = A._lfo(L, .23, 7, null);
    [146.83, 220, 293.66, 329.63, 440].forEach((f, i) => { const o = A.O('sawtooth', f); o.detune.value = rnd(-4, 4); (i % 2 ? l1 : l2).g.connect(o.detune); A.chain(o, A.G(.09), vox); o.start(); L.keep.push(o); });
    const sh = A.G(.5); A._lfo(L, 5.3, .5, sh.gain);
    for (const f of [1760, 2637]) { const o = A.O('sine', f); o.connect(sh); o.start(); L.keep.push(o); }
    A.chain(sh, A.G(.025), L.in);
    const sub = A.O('sine', 73.42); A.chain(sub, A.G(.12), L.in); sub.start(); L.keep.push(sub);
  } },
  boat: { rv: .12, build(A, L) {
    const b = A._lsrc(L, A.brown, 1, 3), lp = A.F('lowpass', 520, .6), g = A.G(.28); A.chain(b, lp, g, L.in); A._wander(L, g.gain, .15, .35, 1, 2.5, .5);
    A._event(L, .45, 1.3, (t) => {
      const p = A.P(rnd(-.35, .35)); p.connect(L.in); const v = rnd(.4, 1);
      A.nz(t, { buf: 'brown', type: 'bandpass', f: rnd(280, 650), q: 1.3, a: .07, d: .3, v: v * .9, dest: p });
      if (Math.random() < .3) A.tone(t + .04, { fc: [[0, rnd(120, 160)], [.12, 90]], a: .005, d: .14, v: v * .14, dest: p });
    }, .2);
    A._event(L, 2.5, 7, (t) => A.bufp(t, A._tex('creak' + (Math.random() * 3 | 0)), rnd(.15, .35), rnd(.7, 1.1), L.in, rnd(-.5, .5)), rnd(1, 3));
  } },
  sail: { rv: .1, build(A, L) {
    const w = A._lsrc(L, A.white, 1, 1.1), bp = A.F('bandpass', 900, .8), g = A.G(.06); A.chain(w, bp, g, L.in); A._wander(L, g.gain, .03, .1, 1, 3, .6);
    A._event(L, 1.4, 4.5, (t) => A.bufp(t, A._tex('flap' + (Math.random() * 3 | 0)), rnd(.3, .6), rnd(.85, 1.15), L.in, rnd(-.3, .3)), .6);
    A._event(L, 4, 10, (t) => A.bufp(t, A._tex('creak' + (Math.random() * 3 | 0)), .1, rnd(1.3, 1.6), L.in, rnd(-.4, .4)), 3);
  } },
  underworld: { rv: .7, build(A, L) {
    const lp = A.F('lowpass', 260, 2); A.chain(lp, A.G(.09), L.in); A._lfo(L, .05, 120, lp.frequency);
    for (const [f, d] of [[55, 7], [55, -7], [77.78, 0]]) { const o = A.O('sawtooth', f); o.detune.value = d; o.connect(lp); o.start(); L.keep.push(o); }
    const sub = A.O('sine', 41.2); A.chain(sub, A.G(.12), L.in); sub.start(); L.keep.push(sub);
    const b = A._lsrc(L, A.brown, 1, .8), bp = A.F('bandpass', 220, .8), bg = A.G(.3); A.chain(b, bp, bg, L.in); A._wander(L, bg.gain, .12, .4, 2, 5, 1.2);
    A._event(L, 6, 14, (t) => A._moan(L.in, t), rnd(1.5, 4));
  } },
  // rain: a hiss of many drops, a low roar under it, and single drops ticking close by
  rain: { rv: .15, lvl: (g) => .2 * g, build(A, L) {
    const w = A._lsrc(L, A.pink, 1, 0), hp = A.F('highpass', 900, .5), lp = A.F('lowpass', 7000, .5), g = A.G(.8);
    A.chain(w, hp, lp, g, L.in); A._wander(L, g.gain, .6, .95, 1, 3, 1);
    const w2 = A._lsrc(L, A.white, 1, .7), bp = A.F('bandpass', 3800, 1.2), g2 = A.G(.22); A.chain(w2, bp, g2, A.P(.3), L.in);
    const b = A._lsrc(L, A.brown, 1, 1.1), lp2 = A.F('lowpass', 320, .7), g3 = A.G(.45); A.chain(b, lp2, g3, L.in);
    A._event(L, .04, .16, (t) => A.tone(t, { fc: [[0, rnd(2600, 5200)], [.03, rnd(1100, 2000)]], a: .001, d: .04, v: rnd(.015, .05), pan: rnd(-.8, .8), dest: L.in }), .1);
  } },
  // round 33: the regions' own air (audiodata.js AMBIENCE). Cicadas: a soft dry shimmer in swells (band-limited well under
  // the piercing range), a marsh's frogs and bubbles, a cave's drips, a volcano's low roar and embers
  cicadas: { rv: .2, lvl: (g) => .55 * g, build(A, L) {
    for (const [f, pan, rate, off] of [[3400, -.5, 37, 0], [3900, .55, 43, 1.3]]) {
      const w = A._lsrc(L, A.pink, 1, off), bp = A.F('bandpass', f, 5), lp = A.F('lowpass', 4600, .6), am = A.G(.5), sw = A.G(.0), p = A.P(pan);
      A.chain(w, bp, lp, am, sw, p, L.in); A._lfo(L, rate, .5, am.gain, 'triangle'); A._wander(L, sw.gain, 0, .5, 2, 6, 1.5);
    }
  } },
  marsh: { rv: .3, build(A, L) {
    const b = A._lsrc(L, A.brown, 1, .3), lp = A.F('lowpass', 380, .6), g = A.G(.15); A.chain(b, lp, g, L.in);
    A._event(L, .9, 3.2, (t) => { const f = rnd(170, 330), n = 2 + (Math.random() * 4 | 0), pn = rnd(-.7, .7);
      for (let i = 0; i < n; i++) A.tone(t + i * rnd(.13, .2), { w: 'triangle', fc: [[0, f * 1.1], [.09, f]], a: .005, d: .1, v: .035, am: [rnd(28, 40), .8], filt: ['lowpass', 900, .8], pan: pn, dest: L.in }); }, .5);
    A._event(L, 1.5, 4, (t) => A.tone(t, { fc: [[0, rnd(160, 260)], [.05, rnd(300, 520)]], a: .002, d: .05, v: .04, pan: rnd(-.6, .6), dest: L.in }), 1);
  } },
  drips: { rv: .8, build(A, L) {
    const b = A._lsrc(L, A.brown, 1, 2.2), lp = A.F('lowpass', 200, .6), g = A.G(.12); A.chain(b, lp, g, L.in);
    A._event(L, .5, 2.4, (t) => { const f = rnd(700, 1500); A.tone(t, { fc: [[0, f * 1.6], [.03, f]], a: .001, d: .07, v: rnd(.03, .07), pan: rnd(-.8, .8), dest: L.in }); }, .4);
  } },
  embers: { rv: .2, build(A, L) {
    const b = A._lsrc(L, A.brown, 1, 1.6), lp = A.F('lowpass', 160, .8), g = A.G(.45); A.chain(b, lp, g, L.in); A._wander(L, g.gain, .25, .55, 2, 5, 1.5);
    const buf = A._tex('fire'); A.chain(A._lsrc(L, buf, .8, 1.1), A.F('lowpass', 2400, .6), A.G(.18), A.P(.3), L.in);
    A._event(L, 6, 15, (t) => { const r = A.nz(t, { buf: 'brown', type: 'lowpass', f: 120, a: 1, d: 2, v: .5, dest: L.in }); }, 4);
  } },
  // round 33b (Roy: "just take a recording of people talking"): with MUSIC_SET 'songs33' the town's murmur is a real
  // recording (crowdrec.js, a public-domain restaurant ambience): one copy only, looped seamlessly, swaying gently in
  // level and a little across the stereo field. Roy: "blur the people's voices about 20%": a gentle low-pass (5 kHz)
  // and a high shelf (-4 dB above 2.5 kHz) take the edge off the consonants, and a little more of it goes to the reverb
  // (rv .32, was .2), so it reads as a crowd, not as words. Measured offline: the spectral centroid (magnitude-weighted)
  // falls about 22% against the recording as the package played it (21.5% over 12 s, 23.3% over 15 s). (The first
  // guess, 3.5 kHz and -5 dB above 2 kHz, took it down 34%: too dull for "about 20%".)
  // How loud it is (the town's heart, the zoom, the hour) is sound.js air()'s to say, through setLoop.
  // With 'r33' the old synthesized babble plays (crowdBabble below, kept as it was).
  crowd: { get rv() { return AD.MUSIC_SET === 'songs33' ? CROWD_BLUR.rv : .25; }, build(A, L) {
    if (AD.MUSIC_SET !== 'songs33') { LOOPS.crowdBabble.build(A, L); return; }
    const g = A.G(1), pn = A.P(0); let head = g;
    if (A.crowdBlur !== false) { // (A.crowdBlur = false: the raw recording, for the listening page's A/B only)
      const lp = A.F('lowpass', CROWD_BLUR.lp, .5), sh = A.F('highshelf', CROWD_BLUR.shelfF); sh.gain.value = CROWD_BLUR.shelfDb;
      A.chain(g, lp, sh); head = sh;
    }
    A.chain(head, pn, L.in); A._wander(L, g.gain, .8, 1, 3, 7, 2); A._lfo(L, .025, .2, pn.pan);
    const go = (buf) => {
      if (L.dead || !buf) return; const s = A.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      s.loopStart = A.crowdOff; s.loopEnd = A.crowdOff + CROWD_LEN; s.connect(g); s.start(A.ctx.currentTime, A.crowdOff + rnd(0, CROWD_LEN - 1)); L.keep.push(s);
    };
    if (A.crowdBuf) go(A.crowdBuf); else A._crowdP?.then(go); // (still decoding at the very start: it joins in a moment later)
  } },
};
// round 33b: the blur on the crowd recording (Roy: "about 20%"); see the crowd loop above
export const CROWD_BLUR = { lp: 5000, shelfF: 2500, shelfDb: -4, rv: .32 };
// (kept, round 33's synthesized babble: the 'crowd' loop's voice while MUSIC_SET is 'r33'; not a loop of its own)
Object.defineProperty(LOOPS, 'crowdBabble', { enumerable: false, value: { rv: .25, build(A, L) {
  const buf = A._tex('babble');
  for (const [pan, rate, off] of [[-.4, 1, 0], [.4, .96, 3.3]]) A.chain(A._lsrc(L, buf, rate, off), A.G(.6), A.P(pan), L.in);
  A._event(L, 2.5, 7, (t) => A.metal(t, rnd(2600, 4200), [1, 1.47, 2.03], [.6, .35, .2], [.12, .08, .06], .05, L.in), 1.5);
} } });
export const LOOP_NAMES = Object.keys(LOOPS);

// ---------------- engine ----------------
const MAX_SFX = 28;
// volume sliders (0..1 each), kept in this browser; the bus gain follows a squared curve so 50% sounds like half
// round 15 (Roy: gentler music): music bus x0.7 (.5 -> .35, about 3 dB), its reverb return too (MUSIC_WET)
// round 19 (Roy: softer still): .35 -> .25 (about 3 dB more), and a shelf takes the bite off everything above 3 kHz
// round 22: the music compressor (init) adds its own make-up gain (~+6 dB on the quiet open-world songs): taken back here so
// the open-world themes sit where they were, and the busy battle themes come out ~3-4 dB under their old peaks
// round 33 (Roy's audio spec): five buses, each with its slider and its mute: master, music, sfx (effects), amb (wind, rain,
// birds, sea...), voice (the townsfolk's chatter). Options: reduce (loud, intense effects about 5 dB softer), calm (ambience
// at half), mono (both speakers get the same mix). All saved together in this browser (VOL_KEY); old saves keep their three.
const MUSIC_TRIM = .6;
const VOL_KEY = 'so_volume', MUSIC_BASE = .2, MUSIC_WET = .416, MASTER_BASE = .8; // music sits under the world's own sounds
const AMB_BASE = .7, VOICE_BASE = .55;
export const BUSES = ['master', 'music', 'sfx', 'amb', 'voice'];
export const AUDIO_OPTS = ['reduce', 'calm', 'mono'];
export const VOL_DEFAULT = { master: 1, music: 1, sfx: 1, amb: 1, voice: 1 };
const volCurve = (x) => clamp(x, 0, 1) ** 2;
function loadVol() {
  const v = { ...VOL_DEFAULT }, mute = {}, opt = {};
  try {
    const s = JSON.parse(localStorage.getItem(VOL_KEY) || 'null');
    if (s) {
      for (const k in v) if (typeof s[k] === 'number' && isFinite(s[k])) v[k] = clamp(s[k], 0, 1);
      if (s.amb == null && typeof s.sfx === 'number') v.amb = v.sfx; // (before round 33 the ambience followed the effects slider)
      for (const k of BUSES) if (s.mute && s.mute[k]) mute[k] = true;
      for (const k of AUDIO_OPTS) if (s.opt && s.opt[k]) opt[k] = true;
    }
  } catch (e) { /* storage blocked */ }
  return { v, mute, opt };
}
class Audio {
  constructor() {
    this.ctx = null; this.song = null; this.pending = null; this.loops = {}; this.surface = 'dirt';
    const L = loadVol(); this.vol = L.v; this.mute = L.mute; this.opt = L.opt;
    this.voiceDuck = 1; this.lis = { x: 0, z: 0, rx: 1, rz: 0 }; this.grp = {}; this.wcat = null; this.memo = {}; this.fading = []; this.emit = {};
  }
  // (kept) the pause menu's two switches: music on/off and effects on/off are the music and sfx mutes
  get musicOn() { return !this.mute.music; }
  set musicOn(v) { this.mute.music = !v; }
  get sfxOn() { return !this.mute.sfx; }
  set sfxOn(v) { this.mute.sfx = !v; }
  // kind: one of BUSES; v 0..1. Saved, and applied at once (smoothly) if audio runs.
  getVolume(kind) { return this.vol[kind] ?? 1; }
  setVolume(kind, v) { if (!(kind in this.vol)) return; this.vol[kind] = clamp(Number(v) || 0, 0, 1); this._saveVol(); this._applyVol(.06); }
  getMute(kind) { return !!this.mute[kind]; }
  setMute(kind, on) { if (!BUSES.includes(kind)) return; this.mute[kind] = !!on; this._saveVol(); this._applyVol(.08); }
  getOpt(k) { return !!this.opt[k]; }
  setOpt(k, on) { if (!AUDIO_OPTS.includes(k)) return; this.opt[k] = !!on; this._saveVol(); this._applyVol(.08); }
  // every slider back to full, no mutes, no options
  resetVolume() { this.vol = { ...VOL_DEFAULT }; this.mute = {}; this.opt = {}; this._saveVol(); this._applyVol(.1); }
  _saveVol() { try { localStorage.setItem(VOL_KEY, JSON.stringify({ ...this.vol, mute: this.mute, opt: this.opt })); } catch (e) { /* storage blocked */ } }
  _on(k) { return this.mute[k] ? 0 : 1; }
  _musicGain() { return MUSIC_BASE * (this.mLevel ?? 1) * volCurve(this.vol.music) * this._on('music'); }
  _busGains() {
    const fx = volCurve(this.vol.sfx) * this._on('sfx'), am = volCurve(this.vol.amb) * this._on('amb') * (this.opt.calm ? .5 : 1), vo = volCurve(this.vol.voice) * this._on('voice') * this.voiceDuck;
    return { master: MASTER_BASE * volCurve(this.vol.master) * this._on('master'), music: this._musicGain(), musicW: MUSIC_WET * volCurve(this.vol.music) * this._on('music'), fx, am, vo };
  }
  _applyVol(tc = .05) {
    if (!this.ctx || !this.master) return; const t = this.ctx.currentTime, B = this._busGains();
    for (const [g, v] of [[this.master, B.master], [this.music, B.music], [this.musicW, B.musicW], [this.sfx, B.fx], [this.sfxW, B.fx], [this.amb, AMB_BASE * B.am], [this.ambW, B.am],
      [this.voice, VOICE_BASE * B.vo], [this.voiceW, .5 * B.vo]]) if (g) g.gain.setTargetAtTime(v, t, tc);
    if (this.monoNode) { try { this.monoNode.channelCount = this.opt.mono ? 1 : 2; } catch (e) { /* old browser */ } }
  }
  // the townsfolk's chatter steps back while someone speaks to V (sound.js): 1 = full
  setVoiceDuck(k) { k = clamp(k, 0, 1); if (Math.abs(k - this.voiceDuck) < .01) return; this.voiceDuck = k; this._applyVol(.25); }
  // round 33: where the ear is (the camera's focus) and which way is "right" on screen, for positioned sounds (opts.pos)
  _spatial(pos, max = 40) {
    const L = this.lis; if (!L || L.x == null || pos.x == null) return { g: 1, pan: 0, lp: 0 };
    const dx = pos.x - L.x, dz = pos.z - L.z, d = Math.hypot(dx, dz); if (d > max) return null;
    const near = 4, g = (d < near ? 1 : Math.pow(near / d, 1.05)) * Math.min(1, (max - d) / (max * .25)); // a soft edge at the far limit
    const pan = clamp((dx * L.rx + dz * L.rz) / Math.max(6, d), -1, 1) * .55; // never hard to one side
    const lp = d > 12 ? 900 + 15000 * Math.pow(Math.max(0, 1 - (d - 12) / Math.max(1, max - 12)), 2) : 0;
    return { g, pan, lp };
  }
  setListener(x, z, rx = 1, rz = 0) { const L = this.lis; L.x = x; L.z = z; const n = Math.hypot(rx, rz) || 1; L.rx = rx / n; L.rz = rz / n; }

  // opts (tests only): {ctx: OfflineAudioContext, offline: true, raw: true (no compressor/limiter)}
  init(opts = {}) {
    if (this.ctx) { if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume(); return; }
    let ctx = opts.ctx;
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
    }
    this.ctx = ctx; this.offline = !!opts.offline;
    this.active = []; this.lastSfx = {}; this.tex = {}; this.ks = new Map(); this.steps = {}; this.lastStep = -1; this.stepVar = {}; this.hoofN = 0;
    // master: glue compressor -> fast limiter -> soft clipper that can never exceed 0.95 -> (round 33) the mono switch
    this.master = this.G(MASTER_BASE * volCurve(this.vol.master) * this._on('master'));
    this.monoNode = this.G(1); try { this.monoNode.channelCountMode = 'explicit'; this.monoNode.channelInterpretation = 'speakers'; this.monoNode.channelCount = this.opt.mono ? 1 : 2; } catch (e) { /* old browser */ }
    this.monoNode.connect(ctx.destination);
    if (opts.raw) this.master.connect(this.monoNode);
    else {
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = .006; comp.release.value = .25;
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .08;
      const sh = ctx.createWaveShaper(), n = 2048, cv = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a < .75 ? a : .75 + .2 * Math.tanh((a - .75) / .2)); }
      sh.curve = cv;
      this.chain(this.master, comp, lim, sh, this.monoNode);
    }
    // reverb
    this.verbIn = this.G(1); const conv = ctx.createConvolver(); conv.buffer = renderIR(ctx); this.chain(this.verbIn, conv, this.G(.9), this.master);
    // buses: X (dry) and XW (reverb send); musicIn/musicWIn carry the ducking
    const B = this._busGains();
    this.musicIn = this.G(1); this.music = this.G(B.music);
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 3000; shelf.gain.value = -6;
    // round 22 (Roy: more pleasant): a slow, gentle compressor evens the music out (no drum hit or reed swell jumps out)
    const mc = ctx.createDynamicsCompressor(); mc.threshold.value = -26; mc.knee.value = 12; mc.ratio.value = 2; mc.attack.value = .03; mc.release.value = .35;
    this.chain(this.musicIn, mc, shelf, this.G(MUSIC_TRIM), this.music, this.master); // (the trim takes back the compressor's own make-up gain)
    this.musicWIn = this.G(1); this.musicW = this.G(B.musicW); this.chain(this.musicWIn, this.musicW, this.verbIn);
    this.sfx = this.G(B.fx); this.sfx.connect(this.master);
    this.sfxW = this.G(B.fx); this.sfxW.connect(this.verbIn);
    this.amb = this.G(AMB_BASE * B.am); this.amb.connect(this.master);
    this.ambW = this.G(B.am); this.ambW.connect(this.verbIn);
    // round 33: the townsfolk's voices on their own bus (slider, mute, and the duck while someone speaks to V)
    this.voice = this.G(VOICE_BASE * B.vo); this.voice.connect(this.master);
    this.voiceW = this.G(.5 * B.vo); this.voiceW.connect(this.verbIn);
    this._crowdP = this._decodeCrowd(); // round 33b: the towns' murmur, a real recording (crowdrec.js), decoded once
    // waveforms
    this.waves = {};
    for (const [k, duty] of [['pulse12', .125], ['pulse25', .25], ['pulse50', .5]]) {
      const N = 40, re = new Float32Array(N), im = new Float32Array(N);
      for (let i = 1; i < N; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
      this.waves[k] = ctx.createPeriodicWave(re, im);
      // round 33b (the package's softer 8-bit tone): the same pulse with its upper partials eased off (above the 6th),
      // a rounder, kinder voice. Only the legacy chip note (note(): the battle themes and songs33) takes it, and only
      // while MUSIC_SET is 'songs33'; our round-33 chip voices (_chipNote) keep the plain pulse
      const sr = new Float32Array(N); for (let i = 1; i < N; i++) sr[i] = re[i] * (i > 6 ? Math.pow(6 / i, 1.3) : 1);
      this.waves[k + 's'] = ctx.createPeriodicWave(sr, new Float32Array(N));
    }
    { // double-reed: odd harmonics dominant (cylindrical bore), even ones present. round 22 (Roy: more pleasant): a
      // steeper fall (1/n^1.15, was 1/n^.75, and gone faster above the 7th) for a warm, duduk-like reed, not a nasal one
      const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let i = 1; i < N; i++) { let a = (i % 2 ? 1 : .55) / Math.pow(i, 1.15); if (i > 7) a *= Math.pow(7 / i, 1.6); im[i] = a; }
      this.waves.reed = ctx.createPeriodicWave(re, im);
      // pads and the choir: soft waves in place of the sawtooth's buzz (pad ~1/n^1.9; the choir keeps more upper partials for its vowels)
      for (const [k, e, M] of [['warm', 1.9, 14], ['warm2', 1.25, 28]]) { const r2 = new Float32Array(M), i2 = new Float32Array(M); for (let i = 1; i < M; i++) i2[i] = 1 / Math.pow(i, e); this.waves[k] = ctx.createPeriodicWave(r2, i2); }
    }
    // noise
    const sr = ctx.sampleRate, mk = (secs, fn) => { const b = ctx.createBuffer(1, Math.floor(secs * sr), sr), d = b.getChannelData(0); fn(d); normalize(d, .9); return b; };
    this.white = mk(2, (d) => { for (let i = 0; i < d.length; i++) d[i] = nz(); });
    this.noise = this.white;
    this.pink = mk(4, (d) => { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = nz(); b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = b0 + b1 + b2 + w * .1848; } });
    this.brown = mk(4, (d) => { let b = 0; for (let i = 0; i < d.length; i++) { b = (b + .02 * nz()) / 1.02; d[i] = b; } });
    for (const b of [this.white, this.pink, this.brown]) fadeOut(b.getChannelData(0), sr, .002);
    this.drums = {};
    for (const k of 'kshtbcr') this.drums[k] = this._buf(renderDrum(k, sr), sr);
    for (const k of 'qxjoumzp') this.drums[k] = this._buf(renderChipDrum(k, sr), sr); // round 33: the chip kit
    if (!this.offline) {
      this.timer = setInterval(() => this.tick(), 25);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!this.ctx) return; document.hidden ? this.ctx.suspend() : this.ctx.resume(); });
      // a context made before any gesture starts suspended (browser autoplay rules): the very first key, click or tap
      // anywhere wakes it, and whatever is already playing (the title theme) sounds at once
      if (typeof window !== 'undefined' && ctx.state !== 'running') {
        const evs = ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'keydown', 'click'];
        const wake = () => { if (this.ctx.state === 'running') { evs.forEach((n) => window.removeEventListener(n, wake, true)); return; } this.ctx.resume?.().then(() => this.tick()).catch(() => {}); };
        evs.forEach((n) => window.addEventListener(n, wake, true));
      }
    }
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
  }
  // music swell: 1 = full, lower = softer; follows setMusic's on/off
  setMusicLevel(l, tc = 2) {
    this.mLevel = l; if (!this.ctx || !this.music) return;
    this.music.gain.setTargetAtTime(this._musicGain(), this.ctx.currentTime, tc);
  }
  setMusic(on) { this.setMute('music', !on); }
  setSfx(on) { this.setMute('sfx', !on); }
  // lower the music for a moment (stingers duck it automatically)
  duck(level = .4, hold = 1.5) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (const g of [this.musicIn, this.musicWIn]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(clamp(level, 0, 1), t, .06); g.gain.setTargetAtTime(1, t + hold, .4); }
  }

  // ---------- node helpers ----------
  G(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  F(type, f, q = .707) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  P(p) { if (this.ctx.createStereoPanner) { const s = this.ctx.createStereoPanner(); s.pan.value = clamp(p, -1, 1); return s; } return this.G(1); }
  O(type, f) { const o = this.ctx.createOscillator(); if (this.waves[type]) o.setPeriodicWave(this.waves[type]); else o.type = type === 'saw' ? 'sawtooth' : type; o.frequency.value = f; return o; }
  S(buf, loop, rate) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = !!loop; if (rate) s.playbackRate.value = rate; return s; }
  chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
  _buf(data, sr) { const b = this.ctx.createBuffer(1, data.length, sr); b.getChannelData(0).set(data); return b; }
  _mark(end) { if (this._o && end > this._o.end) this._o.end = end; }
  _env(p, t, a, h, d, v) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(v, t + a); if (h > 0) p.setValueAtTime(v, t + a + h); p.setTargetAtTime(0, t + a + h, d / 5); return t + a + h + d; }
  _curve(p, t, pts) { p.setValueAtTime(pts[0][1], t + pts[0][0]); for (let i = 1; i < pts.length; i++) p.exponentialRampToValueAtTime(Math.max(1e-4, pts[i][1]), t + pts[i][0]); }
  _out(g, o) { const dest = o.dest || this._o.out; if (o.pan != null) { const p = this.P(o.pan); g.connect(p); p.connect(dest); return p; } g.connect(dest); return null; }
  _am(node, t, end, am) { const g = this.G(1 - am[1]), l = this.O(am[2] || 'sine', am[0]), lg = this.G(am[1]); l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(end + .05); node.connect(g); return g; }
  // oscillator voice: {w, f | fc:[[dt,f]..], a, h, d, v, filt:[type,f,q], vib:[rate,cents,delay], am:[rate,depth], pan, dest}
  tone(t, o) {
    const osc = this.O(o.w || 'sine', o.f || o.fc[0][1]);
    if (o.fc) this._curve(osc.frequency, t, o.fc);
    const g = this.G(0), end = this._env(g.gain, t, o.a ?? .005, o.h || 0, o.d ?? .2, o.v ?? .2);
    if (o.vib) { const l = this.O('sine', o.vib[0]), lg = this.G(0); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib[1], t + (o.vib[2] ?? .1)); l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(end + .05); }
    let node = osc, filt = null;
    if (o.filt) { filt = this.F(o.filt[0], o.filt[1], o.filt[2] ?? 1); node.connect(filt); node = filt; }
    if (o.am) node = this._am(node, t, end, o.am);
    node.connect(g); const p = this._out(g, o);
    osc.start(t); osc.stop(end + .05); this._mark(end);
    return { osc, g, filt, p };
  }
  // filtered noise burst: {buf:'white'|'pink'|'brown', type, f | fc, q, a, h, d, v, am, pan, dest}; returns g2 (extra gain) for wobble
  nz(t, o) {
    const buf = o.buf === 'brown' ? this.brown : o.buf === 'pink' ? this.pink : this.white, s = this.S(buf, true, o.rate);
    const g = this.G(0), end = this._env(g.gain, t, o.a ?? .002, o.h || 0, o.d ?? .1, o.v ?? .2);
    let node = s, f = null;
    if (o.type) { f = this.F(o.type, o.f || o.fc[0][1], o.q ?? 1); if (o.fc) this._curve(f.frequency, t, o.fc); node.connect(f); node = f; }
    if (o.am) node = this._am(node, t, end, o.am);
    const g2 = this.G(1); node.connect(g2); g2.connect(g); const p = this._out(g, o);
    s.start(t, Math.random() * Math.max(0, buf.duration - 1)); s.stop(end + .05); this._mark(end);
    return { s, g, g2, f, p };
  }
  // random clicks (crackle): dens = clicks/s or [start, end]
  crk(t, dur, dens, v, f = 2500, type = 'highpass', q = .8, dest) {
    const s = this.S(this.white, true), fl = this.F(type, f, q), g = this.G(0), d0 = Array.isArray(dens) ? dens[0] : dens, d1 = Array.isArray(dens) ? dens[1] : dens;
    let x = t + Math.random() * .01;
    while (x < t + dur) { const w = rnd(.0008, .004); g.gain.setValueAtTime(v * (.2 + .8 * Math.random() ** 2), x); g.gain.setValueAtTime(0, x + w); x += w - Math.log(1 - Math.random()) / (d0 + (d1 - d0) * (x - t) / dur); }
    this.chain(s, fl, g, dest || this._o.out); s.start(t, rnd(0, 1)); s.stop(t + dur + .05); this._mark(t + dur);
  }
  // paper / leather crinkle: rapid random gain steps
  crinkle(t, dur, v, f, q, dtA = .008, dtB = .025, dest) {
    const s = this.S(this.white, true), fl = this.F('bandpass', f, q), g = this.G(0);
    for (let x = t; x < t + dur; x += rnd(dtA, dtB)) g.gain.setValueAtTime(v * Math.pow(Math.random(), 1.5) * Math.sqrt(Math.sin(Math.PI * (x - t) / dur)), x);
    g.gain.setValueAtTime(0, t + dur);
    this.chain(s, fl, g, dest || this._o.out); s.start(t, rnd(0, 1)); s.stop(t + dur + .05); this._mark(t + dur);
  }
  // slow random amplitude movement on a gain param (thunder roll, quake rumble)
  wobble(p, t, dur, dt, tc) { if (p && p.gain) p = p.gain; for (let x = t; x < t + dur; x += dt * rnd(.6, 1.5)) p.setTargetAtTime(rnd(.35, 1.25), x, tc); }
  metal(t, f0, ratios, amps, decays, v, dest) {
    const out = dest || this._o.out; let end = t;
    ratios.forEach((r, i) => {
      if (f0 * r > this.ctx.sampleRate * .45) return;
      const o = this.O('sine', f0 * r), g = this.G(0), d = decays[i] ?? .3;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime((amps[i] ?? .3) * v, t + .002); g.gain.setTargetAtTime(0, t + .002, d / 5);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .05); end = Math.max(end, t + d);
    });
    this._mark(end);
  }
  lfo(t, dur, rate, depth, param, type = 'sine') { const l = this.O(type, rate), g = this.G(depth); l.connect(g); g.connect(param); l.start(t); l.stop(t + dur); return l; }
  pl(t, midi, v = .4, kind = 'lyre', dest, rate = 1) { const buf = this._ks(midi, kind), s = this.S(buf, false, rate), g = this.G(v); s.connect(g); g.connect(dest || this._o.out); s.start(t); this._mark(t + buf.duration / rate); return { s, g }; }
  dr(t, key, v = .7, dest) { const buf = this.drums[key]; if (!buf) return; const s = this.S(buf), g = this.G(v); s.connect(g); g.connect(dest || this._o.out); s.start(t); this._mark(t + buf.duration); }
  bufp(t, buf, v, rate = 1, dest, pan) { const s = this.S(buf, false, rate), g = this.G(v); s.connect(g); this._out(g, { dest, pan }); s.start(t); this._mark(t + buf.duration / rate); }
  choir(t, ms, a, h, d, v, dest) {
    const env = this.G(0), end = this._env(env.gain, t, a, h, d, v), vox = this.G(1);
    for (const [f, q, gg] of [[730, 5, 2.2], [1090, 6, 1.3], [2440, 8, .6]]) this.chain(vox, this.F('bandpass', f, q), this.G(gg), env);
    env.connect(dest || this._o.out);
    const l = this.O('sine', 5), lg = this.G(10); l.connect(lg); l.start(t); l.stop(end + .1);
    for (const m of ms) for (const dt of [-9, 8]) { const o = this.O('sawtooth', mtof(m)); o.detune.value = dt; lg.connect(o.detune); this.chain(o, this.G(.3), vox); o.start(t); o.stop(end + .1); }
    this._mark(end);
  }
  _ks(midi, kind = 'lyre') {
    const key = kind + midi; let b = this.ks.get(key);
    if (!b) { const r = renderPluck(midi, kind); b = this._buf(r.data, r.sr); if (this.ks.size > 110) this.ks.delete(this.ks.keys().next().value); this.ks.set(key, b); }
    return b;
  }
  _tex(key) {
    if (this.tex[key]) return this.tex[key];
    let d;
    if (key === 'rustle') d = renderRustle(6.1);
    else if (key === 'crickA') d = renderCrickets(4400, .58, 6, 3, .018, .017);
    else if (key === 'crickB') d = renderCrickets(4900, .74, 5, 4, .014, .02);
    else if (key === 'river') d = renderRiver(5.3);
    else if (key === 'fire') d = renderFire(5.7);
    else if (key === 'babble') d = renderBabble(7.3);
    else if (key.startsWith('creak')) d = renderCreak(rnd(.5, .85));
    else if (key.startsWith('flap')) d = renderFlap();
    else return null;
    return (this.tex[key] = this._buf(d, TSR));
  }
  // round 33b: the crowd recording (crowdrec.js, an MP3 in base64) decoded once into one buffer that every 'crowd'
  // loop shares; resolves null where it cannot be decoded (the loop then stays silent rather than breaking anything)
  _decodeCrowd() {
    let ab; try { const bin = atob(CROWD_MP3); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); ab = u.buffer; } catch (e) { return Promise.resolve(null); }
    return new Promise((res) => { try { const p = this.ctx.decodeAudioData(ab, res, () => res(null)); if (p && p.catch) p.catch(() => res(null)); } catch (e) { res(null); } })
      .then((buf) => {
        if (!buf) return null;
        // an MP3 decoder may leave the encoder's few ms of silence at the head: the loop starts at the first sound
        const d = buf.getChannelData(0); let i = 0; while (i < d.length && Math.abs(d[i]) < 1e-4 && i < buf.sampleRate * .2) i++;
        this.crowdOff = Math.min(i / buf.sampleRate, Math.max(0, buf.duration - CROWD_LEN)); this.crowdBuf = buf; return buf;
      });
  }
  _prune(now) { if (this.active.length) this.active = this.active.filter((e) => e > now); }

  // ---------- sfx ----------
  // whether an sfx name exists (works before init)
  has(name) { return name === 'step' || Object.prototype.hasOwnProperty.call(SFX, name); }
  // round 22: a door opening (open true) or shutting; kind one of DOOR_KINDS or a DOOR_ALIAS name; opts {vol, pan, delay}
  door(kind = 'house', open = true, opts) { this.sfxPlay('door_' + doorKind(kind), { ...(typeof opts === 'number' ? { vol: opts } : opts || {}), open: open !== false }); }
  // round 22: V's weapon, so her swings and blows sound of its material and size (see weaponVoice). Cheap: call it every
  // frame with g.hero.W, or on equip. Works before init. Round 33: cat, its category (audiodata.js WEAPON_AUDIO; sound.js)
  setWeapon(W, cat) { if (cat !== undefined) this.wcat = WEAPON_AUDIO[cat] ? cat : null; const key = W ? (W.id || '') + '|' + (W.style || '') : ''; if (key === this.wKey) return; this.wKey = key; this.wv = W ? weaponVoice(W) : null; }
  // the weapon sound sets (weaponsfx.js): which candidate a weapon type uses (0 = the sound above). n omitted: back to
  // audiodata.js WEAPON_SOUND_PICK. shield: whether a shield is in her off hand (the sword-and-shield finisher's bash)
  setWeaponSound(cat, n) { this.wPick = this.wPick || {}; if (n == null) delete this.wPick[cat]; else this.wPick[cat] = n | 0; }
  weaponSoundOf(cat) { return (this.wPick && this.wPick[cat] != null ? this.wPick[cat] : WEAPON_SOUND_PICK[cat]) | 0; }
  setOffhand(shield) { this.offShield = !!shield; }
  // opts: number (volume) or {vol, pan, delay, verb}
  sfxPlay(name, opts) {
    if (!this.ctx) return;
    if (name === 'step') return this.step(opts && opts.surface || this.surface, opts || {});
    let def = SFX[name]; if (!def) return;
    const now = this.ctx.currentTime; let o = typeof opts === 'number' ? { vol: opts } : (opts || {});
    if (def.wv) o = { ...o, ...(o.w || o.wm ? weaponVoice(o.w || o) : this.wv || weaponVoice({ style: def.wv })) }; // V's weapon (round 22)
    if (o.wc == null && this.wcat) o = { ...o, wc: this.wcat }; // round 33: the weapon category in her hand (setWeapon)
    { const vd = weaponSoundDef(name, o, this); if (vd) def = vd; } // a picked weapon sound set takes over her swings and blows (weaponsfx.js)
    if (now - (this.lastSfx[name] ?? -9) < (def.gap ?? .035)) return;
    this._prune(now); if (this.active.length >= MAX_SFX) return;
    // round 33: a sound with a place (o.pos {x, z}) is quieter, duller and to one side with distance from the ear (setListener);
    // past o.max (40 m) it is not played at all. A group (def.grp) has its own ceiling (GRP_MAX). Under "reduce intense
    // effects" the loudest ones step back ~4.5 dB.
    let vol = clamp(o.vol ?? 1, 0, 2), pan = o.pan || 0, lp = 0;
    if (o.pos) { const sp = this._spatial(o.pos, o.max); if (!sp) return; vol *= sp.g; pan = clamp(pan + sp.pan, -1, 1); lp = sp.lp; }
    if (this.opt.reduce && (def.loud || INTENSE.has(name))) vol *= .6;
    let gl = null; if (def.grp) { gl = this.grp[def.grp] = (this.grp[def.grp] || []).filter((e) => e > now); if (gl.length >= (GRP_MAX[def.grp] || 4)) return; }
    this.lastSfx[name] = now;
    const out = this.G(vol); let node = out;
    if (lp) { const f = this.F('lowpass', lp, .6); node.connect(f); node = f; }
    if (pan) { const pn = this.P(pan); node.connect(pn); node = pn; }
    const voice = def.bus === 'voice' || o.bus === 'voice';
    node.connect(voice ? this.voice : this.sfx);
    const rv = (def.rv || 0) * (o.verb ?? 1); let send = null;
    if (rv > 0) { send = this.G(rv); node.connect(send); send.connect(voice ? this.voiceW : this.sfxW); }
    const t = now + .005 + (o.delay || 0);
    this._o = { out, end: t + .05 };
    try { def.f(this, t, o); } catch (e) { /* a sound must never break the game */ }
    const end = this._o.end; this._o = null; this.active.push(end); if (gl) gl.push(end);
    if (def.duck) this.duck(def.duck[0], def.duck[1]);
    if (!this.offline) setTimeout(() => { try { node.disconnect(); out.disconnect(); } catch (e) {} }, (end - now + 2.5) * 1000);
  }
  _oneShot(buf, v, rate, pan, verb, delay = 0, lp) {
    const ctx = this.ctx, s = this.S(buf, false, rate), g = this.G(v), p = this.P(pan);
    if (lp) this.chain(s, this.F('lowpass', lp, .6), g); else s.connect(g);
    this.chain(g, p, this.sfx); if (verb) { const w = this.G(verb); p.connect(w); w.connect(this.sfxW); }
    s.start(ctx.currentTime + .003 + delay); this.active.push(ctx.currentTime + delay + buf.duration / rate);
  }
  _impacts(surface, hoof) {
    const key = (hoof ? 'h_' : 's_') + surface;
    if (!this.steps[key]) this.steps[key] = [0, 1, 2, 3].map((i) => this._buf(renderImpact(surface, TSR, hoof, i % 2 === 0), TSR));
    return this.steps[key];
  }
  _stepBufs(surface, run) {
    const key = (run ? 'r_' : 'w_') + surface;
    return this.steps[key] || (this.steps[key] = [0, 1, 2, 3].map(() => this._buf(renderStep(surface, TSR, run), TSR)));
  }
  // round 22: V's footstep, once per foot plant. surface: one of SURFACES (or a SURFACE_ALIAS name; unknown -> dirt).
  // o: {run (a running step: harder, with the ground kicked up), heavy (a slow loaded step: lower and weightier),
  // armor ('plate' | 'mail': a faint clink of the harness), vol}. A number for o is the volume (the old footstep call).
  step(surface, o = {}) {
    if (!this.ctx) return;
    if (typeof o === 'number') o = { vol: o };
    const s = stepSurface(surface); this.surface = s;
    const now = this.ctx.currentTime; if (now - this.lastStep < .06) return; this.lastStep = now;
    this._prune(now); if (this.active.length >= MAX_SFX - 6) return;
    const run = !!o.run, bufs = this._stepBufs(s, run), vk = (run ? 'r' : 'w') + s;
    let i = Math.random() * 4 | 0; if (i === this.stepVar[vk]) i = (i + 1) % 4; this.stepVar[vk] = i;
    this.stepSide = -(this.stepSide || .07);
    const hv = o.heavy ? 1 : 0, v = clamp(o.vol ?? 1, 0, 2) * STEP_LV[s] * .5 * STEP_GAIN * rnd(.82, 1) * (run ? 1.2 : 1) * (hv ? 1.15 : 1);
    const rate = rnd(.93, 1.07) * (hv ? .86 : 1), verb = STEP_VERB[s] || 0;
    this._oneShot(bufs[i], v, rate, this.stepSide, verb);
    if (s === 'cave') this._oneShot(bufs[i], v * .22, rate * .97, -this.stepSide * 2, verb, .085, 1400); // the near wall answers
    if (hv) { const tb = this.steps.thump || (this.steps.thump = [0, 1].map(() => this._buf(renderThump(TSR), TSR))); this._oneShot(tb[Math.random() * 2 | 0], v * .7, rnd(.9, 1.1), 0, 0); }
    if (o.armor) { const ab = this.steps.armor || (this.steps.armor = [0, 1, 2].map(() => this._buf(renderClink(TSR), TSR))); this._oneShot(ab[Math.random() * 3 | 0], v * (o.armor === 'plate' ? .5 : .32), rnd(.92, 1.08) * (o.armor === 'plate' ? .85 : 1.1), this.stepSide, .1, .02); }
  }
  // (kept) the old call: a walking step at this volume
  footstep(surface, vol = 1) { this.step(surface, { vol }); }
  // gait: 'walk'|'trot'|'canter'|'gallop' or speed 0..1. Call once per hoof strike.
  hoof(surface, gait = 'walk', vol = 1) {
    if (!this.ctx) return;
    let s = stepSurface(surface); s = HOOF_OF[s] || s;
    const gk = typeof gait === 'number' ? (gait < .5 ? 'walk' : gait < .8 ? 'trot' : gait < .95 ? 'canter' : 'gallop') : GAITS[gait] ? gait : 'walk';
    const now = this.ctx.currentTime; this._prune(now); if (this.active.length >= MAX_SFX - 4) return;
    const bufs = this._impacts(s, true), n = this.hoofN = (this.hoofN + 1) % 4, i = (n % 2) + (Math.random() < .5 ? 0 : 2);
    const [lv, rate] = GAITS[gk];
    this._oneShot(bufs[i], clamp(vol, 0, 2) * lv * .55 * rnd(.85, 1), rate * rnd(.94, 1.06), n < 2 ? -.12 : .12, s === 'marble' || s === 'stone' ? .2 : s === 'wood' ? .15 : 0);
  }

  // ---------- music ----------
  // round 33: a real crossfade. The song going out keeps playing (scheduled as before) while its gain falls, and stops
  // once it is silent; the one coming in rises over the same time. Only the newest leaving song and the current one are
  // ever heard: a third request inside a fade cuts the oldest short (no pile of half-faded tracks when she crosses a
  // border twice). A song she left less than a minute ago comes back where it was (from its bar), not from the top.
  // opts: {fade (s), from: 'top' (always from the beginning)}
  play(name, opts) {
    if (!this.ctx) { this.pending = name; return; }
    if (name && !SONGS[name]) return;
    if (this.song && this.song.name === name) return;
    if (!this.song && !name) return;
    const t = this.ctx.currentTime, fade = clamp(opts && opts.fade != null ? opts.fade : this.song && this.song.name === 'theme' ? 3.5 : this.song && this.song.def.battle && SONGS[name] && SONGS[name].battle ? 2 : 1.2, .05, 10);
    if (this.song) this._endSong(this.song, t, fade);
    this.song = null;
    if (!name) return;
    // the same song fading out right now: take it back up instead of starting a second copy
    const back = this.fading.find((s) => s.name === name);
    if (back) {
      this.fading = this.fading.filter((s) => s !== back); back.endAt = 0;
      back.bus.gain.cancelScheduledValues(t); back.bus.gain.setTargetAtTime(back.def.lv ?? 1, t, fade / 4);
      this.song = back; return;
    }
    const def = SONGS[name], bus = this.G(0), lv = def.lv ?? 1;
    for (const c of def.ch) c._dt = 60 / def.bpm / 4; // (round 33b: one step, for the legacy chip note's echo)
    bus.gain.setValueAtTime(0, t); bus.gain.setTargetAtTime(lv, t + .05, fade / 4); bus.connect(this.musicIn);
    const send = this.G(.3 * (def.rev ?? 1)); bus.connect(send); send.connect(this.musicWIn);
    const t0 = t + .08, m = this.memo[name], bar = def.bar || 16;
    const step = m && (!opts || opts.from !== 'top') && t - m.at < 60 ? m.step - (m.step % bar) : 0;
    this.song = { name, def, bus, send, step, next: t0, endAt: 0, chans: def.ch.map((c) => this._chan(c, bus, t0, def)) };
  }
  // round 33: how far the playing song has built (0 = its base, 1 = its first layer in, 2 = everything): the Kraken's
  // theme thickens as its arms strike (sound.js). Layers fade in and out over ~tc s.
  setIntensity(k, tc = .6) {
    this.intensity = clamp(Number(k) || 0, 0, 3); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const s of [this.song, ...this.fading]) if (s) for (const rc of s.chans) if (rc.layG) { rc.layG.gain.cancelScheduledValues(t); rc.layG.gain.setTargetAtTime(layerGain(rc.c.lay, this.intensity), t, tc / 3); }
  }
  // the name of the song playing (null: none)
  get current() { return this.song ? this.song.name : null; }
  _endSong(s, t, fade) {
    s.bus.gain.cancelScheduledValues(t); s.bus.gain.setTargetAtTime(0, t, fade / 4);
    s.endAt = t + fade * 1.25 + .1; this.memo[s.name] = { step: s.step, at: t };
    this.fading.push(s);
    while (this.fading.length > 1) { // only one song may be fading out at a time: an older one goes now
      const o = this.fading.shift(); o.bus.gain.cancelScheduledValues(t); o.bus.gain.setTargetAtTime(0, t, .06); o.endAt = Math.min(o.endAt, t + .35);
    }
  }
  _stopSong(s, t) {
    for (const rc of s.chans) { for (const n of rc.stops) { try { n.stop(t + .05); } catch (e) {} } }
    const done = () => { try { s.bus.disconnect(); s.send.disconnect(); for (const rc of s.chans) rc.out.disconnect(); } catch (e) {} };
    if (!this.offline) setTimeout(done, 1500);
  }
  _chan(c, bus, t, def = {}) {
    const kind = c.d ? 'drum' : (c.w || 'lyre'), rc = { c, kind, ring: [], stops: [] };
    // round 33: a layer (c.lay 1, 2...) sounds only as the song's intensity reaches it (setIntensity: the Kraken builds)
    if (c.lay) { const lg = this.G(layerGain(c.lay, this.intensity || 0)); lg.connect(bus); bus = lg; rc.layG = lg; }
    if (CHIP.has(kind)) return this._chipChan(rc, c, bus, t, def);
    const out = this.G(c.d ? (c.v ?? .6) : LEGACY.has(kind) ? 1 : (c.v ?? .2));
    // round 15 (gentler): plucks and drums pass a soft low-pass, so string attacks and jingles don't bite
    const sf = SOFT_LP[c.d ? 'drum' : kind] || (LEGACY.has(kind) ? (c.cut || 2400) * .75 : 0); let tail = out; // round 22: the 8-bit voices too
    if (sf) { tail = this.F('lowpass', sf, .5); out.connect(tail); }
    if (c.pan) this.chain(tail, this.P(c.pan), bus); else tail.connect(bus);
    rc.out = out;
    if (kind === 'aulos') {
      const osc = this.O('reed', 440), vib = this.O('sine', 5.1), vg = this.G(0), env = this.G(0);
      vib.connect(vg); vg.connect(osc.frequency);
      // round 22 (Roy: more pleasant): far less breath hiss (it was white noise at 2.6 kHz) and a darker, rounder tone
      const br = this.S(this.pink, true), bg = this.G(.025);
      this.chain(br, this.F('bandpass', 1500, .7), bg, env); osc.connect(env);
      const p1 = this.F('peaking', 1100, 1.6); p1.gain.value = 1.5; // was +5, then +3 at 1250 Hz and +1.5 at 2.8 kHz
      this.chain(env, this.F('highpass', 160, .7), p1, this.F('lowpass', (c.cut || 3600) * .66, .5), out);
      osc.start(t); vib.start(t); br.start(t, Math.random());
      rc.stops.push(osc, vib, br); rc.voice = { osc, vg, env, bg };
    } else if (kind === 'pad' || kind === 'choir') {
      let input;
      if (kind === 'pad') { input = this.F('lowpass', c.cut || 1400, .5); input.connect(out); }
      else { input = this.G(1.2); for (const [f, q, gg] of [[730, 5, 2.2], [1090, 6, 1.3], [2440, 8, .35]]) this.chain(input, this.F('bandpass', f, q), this.G(gg), out); }
      rc.in = input;
      const l = this.O('sine', kind === 'choir' ? 4.6 : .3), lg = this.G(kind === 'choir' ? 7 : 5); l.connect(lg); l.start(t); rc.stops.push(l); rc.lfo = lg;
    }
    return rc;
  }
  tick(h = .12) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.song) this._sched(this.song, now, h);
    if (this.fading.length) this.fading = this.fading.filter((s) => { if (now > s.endAt) { this._stopSong(s, now); return false; } this._sched(s, now, Math.min(h, s.endAt - now)); return true; });
    this._loopTick(now, Math.max(h, .35));
  }
  _sched(s, now, h) {
    const def = s.def, dt = 60 / def.bpm / 4;
    if (s.next < now - .5) s.next = now + .05; // resync after a stall
    while (s.next < now + h) {
      const sh = shapeOf(def, Math.floor(s.step / def.len));
      s.chans.forEach((rc, i) => {
        const c = rc.c, st = s.step % c.len;
        if (c.d) { const ch = c.d[st]; if (ch !== '.' && (!sh.quiet || ch !== ch.toLowerCase() || ('kbq'.includes(ch) && st % 8 === 0))) this._drum(rc.out, ch, s.next + (c.sw && st % 2 ? dt * c.sw : 0)); return; }
        if (sh.quiet && i === def.lead) { if (rc.voice && !rc.hushed) { rc.voice.env.gain.setTargetAtTime(0, s.next, .08); rc.hushed = true; } return; } // a held reed lets go
        let n = c.byStep.get(st); if (!n) return; rc.hushed = false;
        if (sh.tr) n = { ...n, m: n.m.map((x) => x + sh.tr), f: n.f * Math.pow(2, sh.tr / 12) };
        this._note(rc, n, s.next + (c.sw && st % 2 ? dt * c.sw : 0), n.len * dt, dt);
      });
      s.step++; s.next += dt;
    }
  }
  update(h) { this.tick(h); } // alias (tests schedule far ahead with a large horizon)
  _drum(dest, ch, t) {
    const key = ch.toLowerCase(), buf = this.drums[key]; if (!buf) return;
    const s = this.S(buf, false, rnd(.985, 1.015)), g = this.G((ch !== key ? 1.06 : 1) * (DRUM_SOFT[key] ?? 1) * rnd(.84, .95));
    s.connect(g); g.connect(dest); s.start(t + rnd(0, .004));
  }
  // round 33: a chip channel: its notes -> a low-pass (cut) -> [an echo, the old consoles' trick of a second, quieter
  // copy a beat behind] -> level -> pan -> the song's bus. c.echo = [steps, feedback, wet].
  _chipChan(rc, c, bus, t, def) {
    const out = this.G(c.v ?? .08), lp = this.F('lowpass', c.cut || CHIP_CUT[rc.kind], .55);
    rc.in = lp; lp.connect(out); rc.out = out;
    const E = echoOf(c); // (round 33b: either form of c.echo; see echoOf)
    if (E) {
      const step = 60 / (def.bpm || 120) / 4, dl = this.ctx.createDelay(2), fb = this.G(clamp(E[1], 0, .55)), wet = this.G(E[2]), dlp = this.F('lowpass', 1800, .5);
      dl.delayTime.value = clamp(E[0] * step, .02, 1.9);
      lp.connect(dl); this.chain(dl, dlp, fb, dl); dlp.connect(wet); wet.connect(out);
    }
    if (c.pan) this.chain(out, this.P(c.pan), bus); else out.connect(bus);
    return rc;
  }
  _note(rc, n, t, dur, sdt = .12) {
    const c = rc.c, k = rc.kind;
    if (CHIP.has(k)) { this._chipNote(rc, n, t, dur, sdt); return; }
    if (k === 'lyre' || k === 'kith') {
      const strum = c.strum ?? .022, ring = c.ring ?? .45;
      n.m.forEach((m, j) => this._pluck(rc, m, k, t + j * strum + rnd(0, .006), rnd(.82, 1), dur + ring - j * strum));
      if (c.sub) this.tone(t, { w: 'triangle', f: mtof(n.m[0]), a: .03, h: Math.max(0, dur - .1), d: .5, v: c.sub, dest: rc.out });
    } else if (k === 'aulos') this._aulosNote(rc, n, t, dur);
    else if (k === 'pad' || k === 'choir') this._padNote(rc, n, t, dur);
    else this.note(rc.out, c, n.f, t, dur);
  }
  _pluck(rc, m, kind, t, vel, keep) {
    const buf = this._ks(m, kind), s = this.S(buf), g = this.G(0); s.connect(g); g.connect(rc.out); s.start(t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .009); // a 9 ms ramp takes the click off the pluck
    const rec = { s, g, end: t + buf.duration };
    if (keep < buf.duration) { const e = t + Math.max(.05, keep); g.gain.setValueAtTime(vel, e); g.gain.setTargetAtTime(0, e, .06); try { s.stop(e + .4); } catch (er) {} rec.end = e + .4; }
    const now = this.ctx.currentTime; rc.ring = rc.ring.filter((r) => r.end > now); rc.ring.push(rec);
    while (rc.ring.length > (rc.c.poly || 8)) { const r = rc.ring.shift(); r.g.gain.cancelScheduledValues(t); r.g.gain.setTargetAtTime(0, t, .03); try { r.s.stop(t + .2); } catch (er) {} }
  }
  _aulosNote(rc, n, t, dur) {
    const v = rc.voice, f = n.f, F = v.osc.frequency, Gn = v.env.gain, vel = rnd(.9, 1);
    if (n.leg) { F.setTargetAtTime(f, t, .014); Gn.setTargetAtTime(vel * .62, t, .01); Gn.setTargetAtTime(vel, t + .035, .03); }
    else { F.setValueAtTime(f * .985, t); F.setTargetAtTime(f, t, .035); Gn.setTargetAtTime(vel, t, .06); v.bg.gain.setValueAtTime(.045, t); v.bg.gain.setTargetAtTime(.025, t + .02, .06); } // a softer tongue
    v.vg.gain.setTargetAtTime(0, t, .02);
    if (dur > .3) v.vg.gain.setTargetAtTime(f * .005 * (rc.c.vib ?? 1), t + Math.min(.3, dur * .45), .16); // a slower, shallower vibrato
    if (!n.slur) Gn.setTargetAtTime(0, t + Math.max(.04, dur - Math.min(.09, dur * .3)), .03);
  }
  _padNote(rc, n, t, dur) {
    const c = rc.c, a = c.att ?? .5, r = c.rel ?? 1, lv = 1 / Math.sqrt(n.m.length);
    for (const m of n.m) {
      const g = this.G(0); g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(lv, t, a / 3); g.gain.setTargetAtTime(0, t + dur, r / 3); g.connect(rc.in);
      for (const d of [-7, 7]) { const o = this.O(rc.kind === 'pad' ? 'warm' : 'warm2', mtof(m)); o.detune.value = d + rnd(-2, 2); if (rc.lfo) rc.lfo.connect(o.detune); o.connect(g); o.start(t); o.stop(t + dur + r * 1.6); } // round 22: soft waves, not sawtooths
    }
  }
  // round 33: one chip note. sq: attack, a short fall to the sustain, release before the next note (a legato note
  // slides in from the last pitch); vib delayed so short notes stay clean. pl: struck, dies away by c.dk. arp: the
  // chord's notes in turn every c.ar steps' fraction (default a 32nd). tri: plain triangle, c.grit adds a quiet pulse an
  // octave up so the bass still speaks on small speakers.
  _chipNote(rc, n, t, dur, sdt) {
    if (rc.kind === 'nz') { // a swell of noise: it rises over the note (c.a: the share of it spent rising) and falls away fast
      const c = rc.c, s = this.S(c.pink ? this.pink : this.white, true), bp = this.F('bandpass', mtof(n.m[0]), c.q ?? 3), g = this.G(0), up = dur * (c.a ?? .8), end = t + dur + (c.r ?? .25);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + up); g.gain.setTargetAtTime(0, t + up, (c.r ?? .25) / 3);
      this.chain(s, bp, g, rc.in); s.start(t, rnd(0, 1)); s.stop(end + .1); return;
    }
    const c = rc.c, k = rc.kind, ctx = this.ctx, acc = (n.step % 16 === 0 ? 1.06 : n.step % 4 === 0 ? 1 : .93) * rnd(.95, 1.03);
    const wave = k === 'tri' ? 'triangle' : 'pulse' + (c.duty || (k === 'arp' ? 25 : k === 'pl' ? 25 : 50));
    const notes = k === 'arp' || c.poly ? n.m : [n.m[0]];
    const rel = Math.min(c.r ?? (k === 'tri' ? .03 : .06), dur * .4), a = c.a ?? (k === 'tri' ? .004 : .007);
    const mk = (m, t0, d, v, slideFrom) => {
      const f = mtof(m), o = this.O(wave, f), g = this.G(0);
      if (slideFrom) { o.frequency.setValueAtTime(slideFrom, t0); o.frequency.setTargetAtTime(f, t0, c.slide ?? .018); }
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + a);
      let end;
      if (k === 'pl') { g.gain.setTargetAtTime(0, t0 + a, (c.dk ?? .16) / 3); end = t0 + Math.min(d + rel, (c.dk ?? .16) * 2.2); g.gain.setTargetAtTime(0, Math.max(t0 + a, end - .03), .01); }
      else { g.gain.setTargetAtTime(v * (c.s ?? .72), t0 + a, (c.dk ?? .12) / 3); const r0 = Math.max(t0 + a + .005, t0 + d - rel); g.gain.setTargetAtTime(0, r0, rel / 3); end = r0 + rel * 1.4; }
      if (c.vib && d > .28) { const l = this.O('sine', c.vr || 5.6), lg = this.G(0); lg.gain.setValueAtTime(0, t0); lg.gain.setValueAtTime(0, t0 + Math.min(.22, d * .4)); lg.gain.linearRampToValueAtTime(c.vib * 10, t0 + Math.min(.5, d * .7)); l.connect(lg); lg.connect(o.detune); l.start(t0); l.stop(end + .05); }
      if (c.det) o.detune.value = c.det;
      o.connect(g); g.connect(rc.in); o.start(t0); o.stop(end + .05);
      if (k === 'tri' && c.grit) { const o2 = this.O('pulse50', f * 2), g2 = this.G(0), lp = this.F('lowpass', 900, .5); g2.gain.setValueAtTime(0, t0); g2.gain.linearRampToValueAtTime(v * c.grit, t0 + a); g2.gain.setTargetAtTime(0, Math.max(t0 + a, end - rel * 1.4), rel / 3); this.chain(o2, lp, g2, rc.in); o2.start(t0); o2.stop(end + .05); }
      return f;
    };
    const vel = acc * (c.vel ?? 1);
    if (k === 'arp' && notes.length > 1) {
      const st = sdt * (c.ar ?? .5), cnt = Math.max(1, Math.round(dur / st));
      // one oscillator stepping through the chord (as a console would), so it never thickens into a cluster
      const o = this.O(wave, mtof(notes[0])), g = this.G(0), end = t + cnt * st;
      for (let i = 0; i < cnt; i++) o.frequency.setValueAtTime(mtof(notes[(c.up === false ? notes.length - 1 - (i % notes.length) : i % notes.length)]), t + i * st);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.setTargetAtTime(vel * (c.s ?? .6), t + a, .05); g.gain.setTargetAtTime(0, end - Math.min(.04, rel), .015);
      o.connect(g); g.connect(rc.in); o.start(t); o.stop(end + .1);
      return;
    }
    const lv = vel / Math.sqrt(notes.length);
    notes.forEach((m, j) => { const from = j === 0 && n.leg && rc.lastF && k === 'sq' ? rc.lastF : 0; const f = mk(m, t + j * (c.strum || 0), dur, lv, from); if (j === 0) rc.lastF = f; });
    if (c.oct) mk(notes[0] + 12, t, dur, lv * c.oct, 0); // a quiet octave double (a brighter, fuller lead)
  }
  // legacy chip voice (pulse12/25/50, triangle, saw)
  // round 33b (the package): echo (internal) is the wet level when this call is a channel's echo; c.echo a number (songs33)
  // repeats the note once a dotted eighth later, softer; c.env 'pluck' (with c.dec) strikes it and lets it die away.
  note(bus, c, f, t, dur, echo) {
    const ctx = this.ctx, s33 = AD.MUSIC_SET === 'songs33', o = this.O(s33 && /^pulse(12|25|50)$/.test(c.w) ? c.w + 's' : c.w, f), g = ctx.createGain();
    const E = !echo && c._dt && echoOf(c);
    if (E) this.note(bus, c, f, t + c._dt * E[0], Math.min(dur, c._dt * E[0]), E[2]); // one repeat, softer (never an echo of an echo)
    if (c.env === 'pluck' || echo) { // a plucked chip note: a quick attack, then it dies away
      const v = c.v * (echo || 1), d = Math.min(dur, c.dec || .3);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.setTargetAtTime(0, t + .01, d / 2.5);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + d * 2 + .05); return;
    }
    if (c.vib && dur > .25) { const l = this.O('sine', 5.5), lg = this.G(0); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .012, t + .2); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
    const v = c.v, rel = Math.min(.08, dur * .3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.setValueAtTime(v * .8, t + Math.max(.01, dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .02);
  }
  drum(bus, k, t) { if (this.ctx) this._drum(bus, k, t); }

  // ---------- ambience loops ----------
  // gain 0..1 (smoothed ~0.5 s). Nodes start lazily and stop after ~4 s at 0.
  setLoop(name, gain = 1) {
    if (!this.ctx) return; const def = LOOPS[name]; if (!def) return;
    const g = clamp(Number(gain) || 0, 0, 1.5); let L = this.loops[name];
    if (!L) { if (g <= 0) return; L = this._startLoop(name, def); }
    if (Math.abs(g - L.target) < .005) return;
    const now = this.ctx.currentTime; L.target = g; if (g <= 0) L.zeroAt = now;
    L.out.gain.setTargetAtTime(def.lvl ? def.lvl(g) : g, now, .16); // (a loop may bend the asked-for gain, see wind)
  }
  stopLoops() { for (const k in this.loops) this.setLoop(k, 0); }
  _startLoop(name, def) {
    const out = this.G(0); out.connect(this.amb);
    if (def.rv) { const s = this.G(def.rv); out.connect(s); s.connect(this.ambW); }
    const L = { name, out, in: this.G(1), target: 0, zeroAt: 0, keep: [], wanders: [], events: [] };
    L.in.connect(out);
    try { def.build(this, L); } catch (e) { /* ignore */ }
    this.loops[name] = L; return L;
  }
  _lsrc(L, buf, rate = 1, off = 0) { const s = this.S(buf, true, rate); s.start(this.ctx.currentTime, off % buf.duration); L.keep.push(s); return s; }
  _lfo(L, rate, depth, param, type = 'sine') { const o = this.O(type, rate), g = this.G(depth); o.connect(g); if (param) g.connect(param); o.start(); L.keep.push(o); o.g = g; return o; }
  _wander(L, p, lo, hi, t0, t1, tc) { L.wanders.push({ p, lo, hi, t0, t1, tc, next: this.ctx.currentTime }); }
  _event(L, t0, t1, fn, first) { L.events.push({ t0, t1, fn, next: this.ctx.currentTime + (first ?? rnd(.2, t1 * .5)) }); }
  _loopTick(now, h) {
    for (const name in this.loops) {
      const L = this.loops[name];
      if (L.target <= 0 && now - L.zeroAt > 4) {
        L.dead = true; for (const n of L.keep) try { n.stop(now + .05); } catch (e) {} // (dead: a crowd recording still decoding never starts)
        if (!this.offline) setTimeout(() => { try { L.out.disconnect(); } catch (e) {} }, 300);
        delete this.loops[name]; continue;
      }
      for (const w of L.wanders) { if (w.next < now - 1) w.next = now; while (w.next < now + h) { w.p.setTargetAtTime(rnd(w.lo, w.hi), Math.max(w.next, now), w.tc); w.next += rnd(w.t0, w.t1); } }
      for (const e of L.events) { if (e.next < now - 1) e.next = now; while (e.next < now + h) { const tt = Math.max(e.next, now + .01); if (L.target > 0) try { e.fn(tt); } catch (er) {} e.next = tt + rnd(e.t0, e.t1); } }
    }
  }
  _bird(dest, t) {
    const g = this.G(rnd(1.3, 2.4)); this.chain(g, this.P(rnd(-.8, .8)), dest);
    const r = Math.random();
    if (r < .35) { const n = 2 + (Math.random() * 4 | 0), f0 = rnd(2800, 4200), gap = rnd(.08, .13); for (let i = 0; i < n; i++) this.tone(t + i * gap, { fc: [[0, f0 * .85], [.022, f0 * 1.18], [.06, f0 * .92]], a: .006, d: .055, v: .1, dest: g }); }
    else if (r < .55) { const d = rnd(.4, .9), rate = rnd(18, 26), x = this.tone(t, { f: rnd(4000, 5200), a: .03, h: d * .6, d: d * .4, v: .07, dest: g, am: [rate, .5] }); this.lfo(t, d + .1, rate, rnd(300, 600), x.osc.frequency); }
    else if (r < .9) { const n = 3 + (Math.random() * 4 | 0), sc = [2200, 2600, 2950, 3300, 3700]; let tt = t; for (let i = 0; i < n; i++) { const f = sc[Math.random() * sc.length | 0] * rnd(.96, 1.04), d = rnd(.07, .17); this.tone(tt, { fc: [[0, f], [d, f * rnd(.88, 1.15)]], a: .012, h: d * .5, d: d * .5, v: .09, dest: g }); tt += d + rnd(.03, .08); } }
    else { const f = rnd(480, 560); let tt = t; for (const [d, k] of [[.3, 1], [.45, 1.04], [.28, .97], [.3, .95]]) { this.tone(tt, { fc: [[0, f * k * .95], [.08, f * k], [d, f * k * .93]], a: .06, h: d * .4, d: d * .5, v: .12, filt: ['lowpass', 1100, .7], dest: g }); tt += d + .12; } }
  }
  _owl(dest, t) {
    const lp = this.F('lowpass', 1300, .6); this.chain(lp, this.P(rnd(-.7, .7)), dest);
    const f = rnd(340, 400), t2 = t + rnd(1.4, 2);
    this.tone(t, { fc: [[0, f * .93], [.09, f * 1.02], [.5, f * .96]], a: .07, h: .22, d: .28, v: .16, dest: lp });
    for (let i = 0; i < 3; i++) this.tone(t2 + i * .15, { f: f * 1.03, a: .025, h: .03, d: .08, v: .1, dest: lp });
    this.tone(t2 + .5, { fc: [[0, f * 1.04], [.9, f * .9]], a: .08, h: .55, d: .35, v: .15, am: [11, .35], dest: lp });
  }
  _moan(dest, t) {
    const lp = this.F('lowpass', 1400, .6), g = this.G(0); this.chain(lp, g, this.P(rnd(-.65, .65)), dest);
    const f0 = rnd(130, 200), dur = rnd(2.4, 3.4), o = this.O('sawtooth', f0);
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * rnd(.72, .85), t + dur);
    const vib = this.O('sine', rnd(4, 5.5)), vg = this.G(f0 * .012); vib.connect(vg); vg.connect(o.frequency);
    for (const [f, q, k] of [[rnd(300, 380), 5, 1], [rnd(780, 900), 6, .5]]) this.chain(o, this.F('bandpass', f, q), this.G(k * 2), lp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.25, t + dur * .35); g.gain.setTargetAtTime(0, t + dur * .55, dur * .15);
    o.start(t); vib.start(t); o.stop(t + dur + .3); vib.stop(t + dur + .3);
  }
}
export { Audio as AudioEngine };
export const audio = new Audio();
