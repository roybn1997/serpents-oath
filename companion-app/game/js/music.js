// Round 33 (Roy's audio spec): the soundtrack in a high-quality 8-bit dress. Pure data and a small arranger, no imports
// (audio.js merges buildMusic() into its SONGS; node can import this file to check every tune, see tools/audio-check.mjs).
//
// What is here
//   REGION_TUNES  every real region of the map (spawner.js REGIONS) and every realm (the Underworld, the Island of No
//                 Return, the caves, the temples): an exploration tune (16 bars, A + B) and a combat tune (an 8-bar riff of
//                 its own, then the exploration motif over its own chords at fighting pace, so a fight still sounds like
//                 that place under threat). Each has its key, mode, tempo, groove and chip palette.
//   TOWN_THEMES   the five principal town melodies (24 or 16 bars) and their combat versions; city variants are built from a
//                 theme and a variant record (audiodata.js CITY_MUSIC: tempo, key, lead, counter-melody, echo, drums).
//   SHIP, KRAKEN  the one sailing theme, and the Kraken's two pieces (its approach, and the encounter itself).
// Song ids: rx_<region> explore, rn_<region> its night version, rc_<region> combat; tw_<theme> / twc_<theme> a town
// theme and its combat version (tw_<city> / twc_<city> for a city's own variant, see citySongs); ship; kraken_rise, kraken.
//
// Notation (as audio.js): "E4:2 r:4 A3+C4+E4:8", lengths in 16th notes (a 4/4 bar is 16, a 3/4 or 6/8 bar 12).
// Chords: 'Dm', 'G', 'C#', 'Bb', 'F#m', 'Dmaj7', 'Daug', 'B7'; 'C.D' splits a bar in two halves.

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function chordTones(sym) {
  const m = /^([A-G])(#|b)?(maj7|m7|m|dim|aug|sus2|sus4|7)?$/.exec(sym);
  if (!m) throw new Error('chord ' + sym);
  const r = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), q = m[3] || '';
  const iv = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10] }[q];
  return { root: (r + 12) % 12, iv };
}
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
// a chord's notes as a close voicing whose lowest note is at or above lo
function voicing(sym, lo = 55, n = 3) {
  const { root, iv } = chordTones(sym), out = [];
  let base = lo - ((lo - root) % 12 + 12) % 12; // the root at or below lo
  const tones = iv.slice(0, Math.max(n, 3)).map((x) => base + x);
  for (let t of tones) { while (t < lo) t += 12; out.push(t); }
  return out.sort((a, b) => a - b).slice(0, n);
}
const bassRoot = (sym, lo = 36) => { const { root } = chordTones(sym); let b = lo + ((root - lo) % 12 + 12) % 12; if (b > 47) b -= 12; return b; };
const chordStr = (ms) => ms.map(nm).join('+');
// a bar list 'D G | Em A' -> [['D'], ['G'], ...] with 'C.D' -> ['C', 'D']
const parseProg = (s) => s.trim().split(/[\s|]+/).filter(Boolean).map((b) => b.split('.'));
const rep = (s, n) => Array(n).fill(s).join(' ');

// ---------------- grooves: bass figure, harmony figure and drum bars per meter ----------------
// bass: [step, len, degree] with R root, 5 fifth, 8 octave, 3 the chord's third, 4 a fourth, b2 a half step up, 7 its seventh
// harm: off (chords on 2 and 4) | brok (broken chord 8ths) | arp (the arp voice, a bar each) | pad | sparse | w23 (3/4: beats 2, 3)
//       | stab (syncopated chord hits) | brok6 (6/8 broken chord)
// dr: drum bars (16 or 12 chars), cycled; fill: the bar before a phrase ends (every 8th)
const GROOVES = {
  // exploration
  sway: { m: 16, bass: [[0, 6, 'R'], [6, 2, 'R'], [8, 6, '5'], [14, 2, '8']], harm: 'off', dr: ['q.......x.......', 'q.......x.....j.'], fill: 'q.......x...x.x.' },
  walk: { m: 16, bass: [[0, 4, 'R'], [4, 4, '5'], [8, 4, '8'], [12, 4, '5']], harm: 'brok', dr: ['q...j...x...j...', 'q...j...x...j.j.'], fill: 'q...j...x.x.x.xx' },
  calm: { m: 16, bass: [[0, 12, 'R'], [12, 4, '5']], harm: 'pad', pl: 'sparse', dr: ['q...............', 'q.......u.......'], fill: 'q.......m...m...' },
  drift: { m: 16, bass: [[0, 16, 'R']], harm: 'pad', pl: 'sparse', dr: ['................', 'm...............'], fill: 'm.......m.......' },
  march: { m: 16, bass: [[0, 2, 'R'], [4, 2, 'R'], [8, 2, '5'], [12, 2, 'R'], [14, 2, '5']], harm: 'off', dr: ['q...x.x.q...x...', 'q...x.x.q.q.x...'], fill: 'q...x.x.q.x.xxxx' },
  gallop: { m: 16, bass: [[0, 2, 'R'], [3, 1, 'R'], [4, 2, '5'], [8, 2, 'R'], [11, 1, 'R'], [12, 2, '5'], [14, 2, '8']], harm: 'brok', dr: ['q..qx...q..qx...', 'q..qx...q..qx.j.'], fill: 'q..qx...q.xxx.xx' },
  maqsum: { m: 16, bass: [[0, 3, 'R'], [3, 3, 'R'], [6, 2, '5'], [8, 4, 'R'], [12, 2, '5'], [14, 2, '4']], harm: 'off', dr: ['q..x..x.q.q.x...', 'q..x..x.q.q.x.p.'], fill: 'q..x..x.q.x.x.xx' },
  jig: { m: 12, bass: [[0, 6, 'R'], [6, 6, '5']], harm: 'brok6', dr: ['q.....x.....', 'q.....x...j.'], fill: 'q.....x.x.x.' },
  barca: { m: 12, bass: [[0, 4, 'R'], [4, 2, '5'], [6, 4, '8'], [10, 2, '5']], harm: 'brok6', dr: ['q...........', 'q.....u.....'], fill: 'q.....m...m.' },
  waltz: { m: 12, bass: [[0, 4, 'R'], [4, 4, '5'], [8, 4, '5']], harm: 'w23', dr: ['q...j...j...', 'q...j...j.j.'], fill: 'q...x...x.x.' },
  // combat
  drive: { m: 16, bass: [[0, 2, 'R'], [2, 2, 'R'], [4, 2, '8'], [6, 2, 'R'], [8, 2, 'R'], [10, 2, 'R'], [12, 2, '8'], [14, 2, '5']], harm: 'arp', dr: ['q.j.x.jqq.j.x.j.', 'q.j.x.j.q.jqx.j.'], fill: 'q.j.x.jqx.x.xxxx' },
  stalk: { m: 16, bass: [[0, 3, 'R'], [3, 3, 'R'], [6, 2, 'b2'], [8, 6, 'R'], [14, 2, '5']], harm: 'stab', dr: ['q.....q.x.......', 'q.....q.x.....j.'], fill: 'q.....q.x.x.xxxx' },
  war: { m: 16, bass: [[0, 2, 'R'], [2, 2, 'R'], [4, 2, 'R'], [6, 2, '5'], [8, 2, 'R'], [10, 2, 'R'], [12, 2, '8'], [14, 2, '5']], harm: 'stab', dr: ['q.m.x.m.q.mmx.m.', 'q.m.x.m.q.m.x.mm'], fill: 'q.m.x.mmx.mmxmxm' },
  gallopc: { m: 16, bass: [[0, 1, 'R'], [1, 1, 'R'], [2, 2, 'R'], [4, 1, '5'], [5, 1, '5'], [6, 2, '5'], [8, 1, 'R'], [9, 1, 'R'], [10, 2, 'R'], [12, 2, '8'], [14, 2, '5']], harm: 'arp', dr: ['q.qqx.qqq.qqx.qq', 'q.qqx.qqq.qqx.jj'], fill: 'q.qqx.qqx.xxxxxx' },
  frenzy: { m: 16, bass: [[0, 2, 'R'], [2, 2, '8'], [4, 2, 'R'], [6, 2, '8'], [8, 2, 'R'], [10, 2, '8'], [12, 2, 'R'], [14, 2, '8']], harm: 'arp', dr: ['q.jjx.jjq.jjx.jj', 'q.jjx.jjq.jjx.jx'], fill: 'q.jjx.jjx.xxx.xx' },
  maqsumc: { m: 16, bass: [[0, 2, 'R'], [2, 1, 'R'], [3, 3, 'R'], [6, 2, '5'], [8, 2, 'R'], [10, 2, 'R'], [12, 2, '5'], [14, 2, 'b2']], harm: 'arp', dr: ['q.px.px.q.q.x.p.', 'q.px.px.q.q.x.pp'], fill: 'q.px.px.x.x.xxxx' },
  jigc: { m: 12, bass: [[0, 2, 'R'], [2, 2, 'R'], [4, 2, '5'], [6, 2, 'R'], [8, 2, 'R'], [10, 2, '8']], harm: 'arp', dr: ['q.jxj.q.jxj.', 'q.jxj.q.jxjj'], fill: 'q.jxj.x.xxxx' },
  waltzc: { m: 12, bass: [[0, 2, 'R'], [2, 2, 'R'], [4, 2, '5'], [6, 2, 'R'], [8, 2, '5'], [10, 2, '8']], harm: 'arp', dr: ['q.j.x.j.x.j.', 'q.j.x.j.x.jj'], fill: 'q.j.x.x.x.xx' },
};
const DEG = { R: 0, 5: 7, 8: 12, 4: 5, b2: 1 };
function bassLine(prog, G, oct = 36) {
  const out = [];
  for (const bar of prog) {
    const halves = bar.length, span = G.m / halves;
    let pos = 0;
    for (const [st, len, d] of G.bass) {
      const ci = Math.min(halves - 1, Math.floor(st / span)), sym = bar[ci], { iv } = chordTones(sym), r = bassRoot(sym, oct);
      const n = d === '3' ? r + iv[1] : d === '7' ? r + (iv[3] ?? 10) : r + (DEG[d] ?? 0);
      if (st > pos) out.push('r:' + (st - pos));
      // a figure note may not run past a chord change inside the bar
      const until = halves > 1 && st < span ? Math.min(len, span - st) : len;
      out.push(nm(n) + ':' + until); if (until < len) out.push('r:' + (len - until));
      pos = st + len;
    }
    if (pos < G.m) out.push('r:' + (G.m - pos));
  }
  return out.join(' ');
}
function harmony(prog, kind, m, lo = 55) {
  const out = [];
  for (const bar of prog) {
    const span = m / bar.length;
    for (const sym of bar) {
      const v = voicing(sym, lo), c = chordStr(v);
      if (kind === 'off') out.push(span === 16 ? `r:4 ${c}:3 r:5 ${c}:3 r:1` : span === 8 ? `r:4 ${c}:3 r:1` : span === 12 ? `r:6 ${c}:4 r:2` : `r:2 ${c}:2 r:2`);
      else if (kind === 'brok') { const p = [v[0], v[1], v[2], v[1]]; for (let i = 0; i < span / 2; i++) out.push(nm(p[i % 4] + (i >= 4 && i % 4 === 2 ? 12 : 0)) + ':2'); }
      else if (kind === 'brok6') { const p = [v[0], v[1], v[2], v[1] + 12, v[2], v[1]]; for (let i = 0; i < span / 2; i++) out.push(nm(p[i % 6]) + ':2'); }
      else if (kind === 'arp') out.push(chordStr(voicing(sym, lo + 5, 3)) + ':' + span);
      else if (kind === 'pad') out.push(chordStr(voicing(sym, 50, 3)) + ':' + span);
      else if (kind === 'sparse') out.push(span >= 12 ? `${nm(v[2] + 12)}:4 r:${span - 4}` : `${nm(v[1] + 12)}:4 r:${span - 4}`);
      else if (kind === 'w23') out.push(span === 12 ? `r:4 ${c}:3 r:1 ${c}:3 r:1` : `r:2 ${c}:3 r:1`);
      else if (kind === 'stab') out.push(span === 16 ? `${c}:2 r:4 ${c}:2 r:4 ${c}:2 r:2` : span === 8 ? `${c}:2 r:4 ${c}:2` : `${c}:2 r:${span - 2}`);
    }
  }
  return out.join(' ');
}
// a quiet inner voice that walks the chords' tones (each the nearest to the last), two notes a bar: the counter-melody
function counterLine(prog, m, start = 64) {
  let last = start; const out = [];
  for (const bar of prog) {
    const span = m / bar.length;
    for (const sym of bar) {
      const { root, iv } = chordTones(sym), cand = [];
      for (let o = 48; o <= 76; o++) if (iv.some((x) => (root + x) % 12 === o % 12)) cand.push(o);
      const pick = (avoid) => cand.filter((x) => x !== avoid).sort((a, b) => Math.abs(a - last) - Math.abs(b - last))[0];
      const a = pick(-1); last = a; const b = span >= 8 ? pick(a) : null;
      if (b != null) { out.push(nm(a) + ':' + span / 2, nm(b) + ':' + span / 2); last = b; } else out.push(nm(a) + ':' + span);
    }
  }
  return out.join(' ');
}
function drumLine(G, bars, opts = {}) {
  const out = [];
  for (let i = 0; i < bars; i++) {
    let b = (i % 8 === 7 && !opts.nofill) ? G.fill : G.dr[i % G.dr.length];
    if (i === 0 && opts.crash) b = 'z' + b.slice(1).replace(/^./, (c) => c);
    if (opts.light) b = b.replace(/[jxpu]/g, '.');
    if (opts.kickOnly) b = b.replace(/[^q]/g, '.').replace(/q/g, (c, k) => (k === 0 ? 'q' : '.'));
    out.push(b);
  }
  return out.join('');
}

// ---------------- palettes: the chip voices of a tune ----------------
const PAL = {
  warm: { lead: { w: 'sq', duty: 25, v: 0.0936, cut: 2800, vib: .8 }, harm: { w: 'pl', duty: 50, v: 0.08, cut: 2200, dk: .3 }, bass: { w: 'tri', v: 0.11, grit: .22 } },
  bright: { lead: { w: 'sq', duty: 25, v: 0.091, cut: 3300, vib: .7 }, harm: { w: 'pl', duty: 25, v: 0.072, cut: 2600, dk: .22 }, bass: { w: 'tri', v: 0.11, grit: .25 } },
  soft: { lead: { w: 'sq', duty: 50, v: 0.0858, cut: 2400, vib: 1 }, harm: { w: 'pl', duty: 25, v: 0.072, cut: 2200, dk: .35 }, bass: { w: 'tri', v: 0.105, grit: .2 } },
  airy: { lead: { w: 'sq', duty: 50, v: 0.0806, cut: 2700, vib: .9, echo: [6, .28, .35] }, harm: { w: 'pl', duty: 25, v: 0.064, cut: 2400, dk: .45 }, bass: { w: 'tri', v: 0.1, grit: .18 } },
  reed: { lead: { w: 'sq', duty: 25, v: 0.0884, cut: 2500, vib: 1.5, slide: .03 }, harm: { w: 'pl', duty: 50, v: 0.072, cut: 2000, dk: .25 }, bass: { w: 'tri', v: 0.11, grit: .25 } },
  dark: { lead: { w: 'sq', duty: 12, v: 0.1, cut: 2200, vib: 1.3, echo: [6, .3, .3] }, harm: { w: 'pl', duty: 50, v: 0.064, cut: 1700, dk: .5 }, bass: { w: 'tri', v: 0.115, grit: .2 } },
  // combat
  hot: { lead: { w: 'sq', duty: 25, v: 0.091, cut: 3300, vib: .6 }, harm: { w: 'arp', duty: 12, v: 0.042, cut: 2400, ar: .5 }, bass: { w: 'tri', v: 0.115, grit: .32 } },
  grim: { lead: { w: 'sq', duty: 12, v: 0.0858, cut: 2300, vib: 1.1 }, harm: { w: 'pl', duty: 50, v: 0.072, cut: 1900, dk: .14 }, bass: { w: 'tri', v: 0.12, grit: .3 } },
  wild: { lead: { w: 'sq', duty: 25, v: 0.0884, cut: 3000, vib: 1.4, slide: .025 }, harm: { w: 'arp', duty: 25, v: 0.042, cut: 2300, ar: .5 }, bass: { w: 'tri', v: 0.115, grit: .3 } },
};
const padCh = (s, v = .03, cut = 1300) => ({ w: 'pad', v, cut, att: .8, rel: 1.2, m: s });

// ---------------- the regions ----------------
// x: exploration (prog A+B, 16 bars; mel A+B), c: combat (prog 8 bars, riff 8 bars). pal / groove per part.
// mood, motif and tempo range are the data the spec asks for (audiodata.js REGION_MUSIC reads them)
export const REGION_TUNES = {
  attica: { mood: 'warm, heroic, home', motif: 'a rising D-major hook (A D E F#)', x: { bpm: 96, groove: 'sway', pal: 'warm', key: 'D major',
    prog: 'D G Em A D Bm G.A D | Bm G D A Bm G Em.A D',
    mel: 'F#4:4 A4:2 D5:6 E5:2 F#5:2 G5:6 F#5:2 E5:4 D5:4 E5:4 B4:4 G4:2 A4:2 B4:4 A4:12 r:4 F#4:4 A4:2 D5:6 E5:2 F#5:2 D5:6 B4:2 F#5:4 D5:4 G5:4 B4:4 C#5:4 E5:4 D5:12 r:4 '
      + 'F#5:6 E5:2 D5:4 C#5:4 B4:6 D5:2 G5:8 F#5:4 A5:4 F#5:2 E5:2 D5:4 E5:8 C#5:4 A4:4 D5:4 F#5:2 B5:6 A5:2 F#5:2 G5:6 F#5:2 E5:4 D5:4 E5:4 G5:4 C#5:4 E5:4 D5:8 A4:4 r:4' },
    c: { bpm: 138, groove: 'drive', pal: 'hot', key: 'D minor', prog: 'Dm Bb C A Dm Bb Gm.A Dm',
      riff: 'D5:2 r:1 D5:1 F5:2 A5:2 G5:2 F5:2 E5:2 D5:2 D5:2 r:1 D5:1 F5:2 Bb5:4 A5:2 G5:2 F5:2 E5:2 G5:2 C6:4 Bb5:2 A5:2 G5:4 A5:6 G5:2 F5:2 E5:2 C#5:4 D5:2 r:1 D5:1 F5:2 A5:2 D6:4 C6:2 A5:2 Bb5:4 A5:2 G5:2 F5:4 D5:4 G5:4 Bb5:4 A5:4 C#6:4 D6:8 A5:4 F5:2 E5:2' } },
  boeotia: { mood: 'curious, riddling (the Sphinx, Thebes)', motif: 'a sly dorian figure (A C E D C B)', x: { bpm: 88, groove: 'walk', pal: 'soft', key: 'A dorian',
    prog: 'Am D Am G F G Am.D Em | F G Am Em F G E Am',
    mel: 'A4:3 C5:1 E5:4 D5:2 C5:2 B4:4 F#4:4 A4:4 D5:6 C5:2 E5:3 G5:1 A5:4 G5:2 E5:2 D5:4 B4:8 D5:4 G4:4 A4:3 C5:1 F5:4 E5:2 D5:2 C5:4 D5:4 B4:4 G4:4 B4:4 C5:4 A4:4 F#4:4 A4:4 B4:12 r:4 '
      + 'C5:4 F5:4 A5:6 G5:2 B5:4 G5:4 D5:4 G5:4 A5:6 G5:2 E5:4 C5:4 B4:6 E5:2 G5:8 A5:4 G5:2 F5:2 E5:4 C5:4 D5:4 G5:4 B5:4 D6:4 G#5:6 F5:2 E5:4 D5:4 C5:4 B4:2 G#4:2 A4:8' },
    c: { bpm: 140, groove: 'stalk', pal: 'grim', key: 'A phrygian', prog: 'Am Bb Am G Am Bb F.E Am',
      riff: 'A4:2 A4:1 C5:1 E5:2 F5:2 E5:2 C5:2 A4:2 B4:2 Bb4:2 Bb4:1 D5:1 F5:2 G5:2 F5:2 D5:2 Bb4:4 E5:2 A5:2 G5:2 F5:2 E5:4 C5:4 D5:4 B4:2 G4:2 B4:4 D5:4 A5:4 G5:2 F5:2 E5:2 F5:2 E5:2 C5:2 D5:4 F5:4 Bb5:4 A5:2 G5:2 A5:2 F5:2 C5:4 G#5:2 E5:2 B4:4 A5:8 E5:4 A4:4' } },
  delphi: { mood: 'sacred, airy, prophetic', motif: 'a lydian rise (B E G# F#, the raised fourth A#)', x: { bpm: 76, groove: 'calm', pal: 'airy', key: 'E lydian',
    prog: 'E F# E B C#m A F# B | A E F# C#m A E F#.B E',
    mel: 'B4:4 E5:4 G#5:6 F#5:2 A#5:8 F#5:4 C#5:4 B5:6 G#5:2 E5:8 D#5:6 F#5:2 B4:8 E5:4 G#5:4 C#6:6 B5:2 A5:6 G#5:2 E5:4 C#5:4 A#5:6 C#6:2 F#5:8 D#5:8 F#5:4 B5:4 '
      + 'C#6:6 B5:2 A5:8 G#5:4 B5:4 E6:8 F#5:4 A#5:4 C#6:4 A#5:4 G#5:8 E5:4 C#5:4 E5:4 A5:4 C#6:6 B5:2 B5:6 G#5:2 E5:8 A#5:4 F#5:4 D#5:4 F#5:4 E5:12 r:4' },
    c: { bpm: 132, groove: 'drive', pal: 'hot', key: 'E minor', prog: 'Em C D B Em C Am.B Em',
      riff: 'E5:2 r:2 E5:2 G5:2 B5:4 A5:2 G5:2 E5:2 r:2 E5:2 G5:2 C6:4 B5:2 A5:2 F#5:4 A5:4 D6:4 C6:2 A5:2 D#6:6 B5:2 F#5:4 D#5:4 G5:2 F#5:2 E5:2 B4:2 E5:2 G5:2 B5:4 C6:4 B5:2 A5:2 G5:4 E5:4 A5:4 C6:4 B5:4 D#6:4 E6:8 B5:4 G5:4' } },
  corinth: { mood: 'bustling, jaunty crossroads', motif: 'a mixolydian skip (D G B A G F)', x: { bpm: 104, groove: 'walk', pal: 'bright', key: 'G mixolydian',
    prog: 'G F G D G F C.D G | C G Am D C G Am.D G',
    mel: 'D5:2 G5:2 B5:4 A5:2 G5:2 F5:4 A5:4 C6:2 A5:2 F5:4 C5:4 B4:2 D5:2 G5:4 F5:2 E5:2 D5:4 A4:4 D5:4 F#5:8 D5:2 G5:2 B5:4 A5:2 G5:2 F5:4 C6:4 A5:2 F5:2 A5:4 G5:4 E5:4 G5:4 F#5:4 A5:4 G5:10 r:2 D5:2 E5:2 '
      + 'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4 B5:4 G5:2 D5:2 B4:8 C5:2 E5:2 A5:4 G5:2 E5:2 C5:4 D5:6 E5:2 F#5:4 A5:4 G5:4 E5:4 C5:2 D5:2 E5:4 D5:4 B4:2 D5:2 G5:8 A5:4 C6:4 A5:4 F#5:4 G5:12 r:4' },
    c: { bpm: 144, groove: 'gallopc', pal: 'hot', key: 'G minor', prog: 'Gm Eb F D Gm Eb Cm.D Gm',
      riff: 'G4:2 Bb4:2 D5:2 G5:2 F5:2 D5:2 Bb4:2 D5:2 Eb5:4 G5:2 Bb5:2 G5:4 Eb5:4 F5:2 A5:2 C6:4 A5:2 F5:2 C5:4 D5:4 F#5:4 A5:6 F#5:2 Bb5:4 A5:2 G5:2 D5:4 G5:4 G5:4 Bb5:4 Eb6:4 D6:2 C6:2 C6:4 Eb6:4 D6:4 F#5:4 G5:8 D5:4 G4:4' } },
  lerna: { mood: 'murky, sinuous marsh (the Hydra)', motif: 'a slithering semitone (G Ab G)', x: { bpm: 80, groove: 'sway', pal: 'dark', key: 'C minor',
    prog: 'Cm Ab Fm G Cm Ab Fm.G Cm | Ab Eb Fm Cm Ab Eb Fm.G G',
    mel: 'G4:4 Ab4:2 G4:2 Eb5:6 D5:2 C5:6 Eb5:2 Ab5:4 G5:4 F5:4 Eb5:2 D5:2 C5:4 Ab4:4 B4:8 D5:4 G4:4 G4:4 Ab4:2 G4:2 G5:6 F5:2 Eb5:6 C5:2 Ab4:4 C5:4 Ab4:4 F4:4 B4:4 D5:4 C5:12 r:4 '
      + 'Eb5:4 C5:4 Ab5:6 G5:2 G5:4 Bb5:4 G5:4 Eb5:4 F5:6 Ab5:2 C6:4 Ab5:4 G5:8 Eb5:4 C5:4 C6:4 Bb5:2 Ab5:2 Eb5:4 C5:4 Bb4:4 Eb5:4 G5:6 F5:2 F5:4 Ab5:4 G5:4 B4:4 D5:8 B4:4 G4:4' },
    c: { bpm: 136, groove: 'drive', pal: 'grim', key: 'C minor', prog: 'Cm Db Cm Bb Ab G Cm.Db G',
      riff: 'C5:2 Eb5:2 G5:2 C6:2 B5:2 G5:2 Eb5:2 D5:2 Db5:2 F5:2 Ab5:2 Db6:2 C6:2 Ab5:2 F5:2 Eb5:2 C5:4 G5:4 Eb5:4 C5:4 D5:4 F5:4 Bb5:6 Ab5:2 C6:4 Ab5:2 Eb5:2 C5:4 Eb5:4 B4:4 D5:4 G5:4 F5:2 D5:2 Eb5:4 G5:4 F5:4 Ab5:4 G5:8 D5:4 B4:4' } },
  stymphalos: { mood: 'quirky, twittering marsh birds', motif: 'staccato chirps (C# C# F# A)', x: { bpm: 92, groove: 'walk', pal: 'bright', key: 'F# minor',
    prog: 'F#m D E C#m F#m D Bm.C# F#m | D A E F#m D A Bm.C# C#',
    mel: 'C#5:1 r:1 C#5:1 r:1 F#5:2 A5:2 G#5:1 r:1 F#5:1 r:1 E5:2 C#5:2 D5:2 F#5:2 A5:4 F#5:2 D5:2 A4:4 B4:1 r:1 B4:1 r:1 E5:2 G#5:2 F#5:1 r:1 E5:1 r:1 D5:2 B4:2 C#5:8 E5:4 G#5:4 '
      + 'A5:1 r:1 A5:1 r:1 C#6:2 A5:2 F#5:2 E5:2 F#5:4 D5:2 E5:2 F#5:2 A5:2 D6:4 C#6:2 A5:2 B5:4 F#5:4 G#5:4 F5:4 F#5:12 r:4 '
      + 'F#5:4 A5:2 F#5:2 D5:4 A4:4 C#5:2 E5:2 A5:4 G#5:2 E5:2 C#5:4 E5:1 r:1 G#5:1 r:1 B5:2 G#5:2 E5:4 B4:4 A5:6 G#5:2 F#5:8 A5:2 F#5:2 D5:2 F#5:2 A5:4 D6:4 C#6:4 B5:2 A5:2 E5:4 C#5:4 D5:4 B4:4 C#5:4 G#5:4 F5:8 G#5:4 C#5:4' },
    c: { bpm: 150, groove: 'frenzy', pal: 'wild', key: 'F# minor', prog: 'F#m G F#m E D E F#m.G C#',
      riff: 'F#5:1 A5:1 C#6:1 A5:1 F#5:1 A5:1 C#6:1 A5:1 F#5:2 E5:2 C#5:4 G5:1 B5:1 D6:1 B5:1 G5:1 B5:1 D6:1 B5:1 G5:2 F#5:2 D5:4 A5:2 C#6:2 F#6:4 E6:2 C#6:2 A5:4 G#5:4 B5:4 E6:6 D6:2 '
        + 'F#5:1 A5:1 D6:1 A5:1 F#5:1 A5:1 D6:1 A5:1 F#5:4 A5:4 G#5:2 B5:2 E6:2 B5:2 G#5:4 E5:4 C#6:4 A5:4 B5:4 D6:4 C#6:4 G#5:4 F5:4 C#5:4' } },
  arcadia: { mood: 'pastoral, lilting (Pan\'s pipes)', motif: 'a 6/8 pipe call (C F A G)', x: { bpm: 84, groove: 'jig', pal: 'soft', key: 'F major', meter: 12,
    prog: 'F Bb F C Dm Bb C F | Dm Am Bb F Dm Gm C C',
    mel: 'C5:4 F5:2 A5:4 G5:2 F5:4 D5:2 Bb4:6 A4:2 C5:2 F5:2 A5:4 C6:2 G5:6 E5:4 r:2 F5:4 D5:2 A5:4 F5:2 D5:4 F5:2 Bb5:4 A5:2 G5:4 E5:2 C5:4 E5:2 F5:10 r:2 '
      + 'A5:4 G5:2 F5:4 E5:2 E5:4 C5:2 A4:6 D5:4 F5:2 Bb5:4 D6:2 C6:6 A5:6 F5:4 A5:2 D6:4 C6:2 Bb5:4 G5:2 D5:4 G5:2 E5:4 G5:2 C6:4 Bb5:2 G5:6 E5:4 C5:2' },
    c: { bpm: 140, groove: 'jigc', pal: 'wild', key: 'D minor', prog: 'Dm C Bb A Dm C Bb.A Dm',
      riff: 'D5:2 F5:2 A5:2 D6:4 A5:2 C6:2 G5:2 E5:2 C5:4 E5:2 D5:2 F5:2 Bb5:2 D6:4 Bb5:2 C#6:4 A5:2 E5:4 C#5:2 F5:2 A5:2 D6:2 F6:4 E6:2 E6:2 C6:2 G5:2 C6:4 G5:2 D6:2 Bb5:2 F5:2 E5:2 C#5:2 A4:2 D5:10 r:2' } },
  laconia: { mood: 'martial, disciplined (Sparta)', motif: 'a dotted call (E E B E F# G)', x: { bpm: 100, groove: 'march', pal: 'warm', key: 'E minor',
    prog: 'Em Em C D Em Am B Em | G D C B Em C Am.B Em',
    mel: 'E5:3 E5:1 B4:4 E5:3 F#5:1 G5:4 G5:3 F#5:1 E5:4 B4:8 C5:3 E5:1 G5:4 C6:6 B5:2 A5:6 F#5:2 D5:8 B5:3 A5:1 G5:4 E5:3 F#5:1 G5:4 A5:3 G5:1 E5:4 C5:8 D#5:3 E5:1 F#5:4 B5:8 E5:12 r:4 '
      + 'D5:3 G5:1 B5:4 A5:3 G5:1 F#5:4 F#5:3 A5:1 D6:8 C6:2 A5:2 G5:3 E5:1 C5:4 E5:3 G5:1 C6:4 B5:6 A5:2 F#5:4 D#5:4 E5:3 G5:1 B5:4 E6:6 D6:2 C6:3 B5:1 G5:4 E5:8 A5:4 C6:4 B5:4 D#5:4 E5:12 r:4' },
    c: { bpm: 144, groove: 'war', pal: 'hot', key: 'E minor', prog: 'Em C Am B Em C D.B Em',
      riff: 'E4:2 G4:2 B4:2 E5:2 G5:4 F#5:2 E5:2 E5:2 G5:2 C6:4 B5:2 A5:2 G5:4 A5:4 E5:2 C5:2 A4:4 C5:4 B4:2 D#5:2 F#5:4 A5:4 F#5:4 G5:3 F#5:1 E5:4 B5:6 G5:2 C6:4 G5:2 E5:2 G5:4 C6:4 D6:4 A5:4 B5:4 D#6:4 E6:8 B5:4 E5:4' } },
  thessaly: { mood: 'open plains, horses running', motif: 'a galloping fourth (F F D F Bb)', x: { bpm: 112, groove: 'gallop', pal: 'bright', key: 'Bb major',
    prog: 'Bb F Gm Eb Bb F Eb.F Bb | Eb Bb Cm F Gm Eb Cm.F F',
    mel: 'F5:3 F5:1 D5:2 F5:2 Bb5:6 A5:2 A5:3 G5:1 F5:4 C5:8 D5:3 D5:1 Bb4:2 D5:2 G5:6 F5:2 G5:6 Eb5:2 Bb4:8 F5:3 F5:1 D5:2 F5:2 Bb5:4 D6:4 C6:3 Bb5:1 A5:4 F5:8 G5:4 Bb5:4 A5:4 C6:4 Bb5:12 r:4 '
      + 'G5:3 Bb5:1 Eb6:6 D6:2 C6:4 D6:6 Bb5:2 F5:8 Eb5:3 G5:1 C6:4 Bb5:2 G5:2 Eb5:4 F5:6 A5:2 C6:8 Bb5:3 A5:1 G5:4 D5:4 G5:4 G5:4 Eb5:2 G5:2 Bb5:8 C6:4 G5:4 A5:4 C6:4 F5:4 A5:4 C6:8' },
    c: { bpm: 152, groove: 'gallopc', pal: 'hot', key: 'G minor', prog: 'Gm F Eb D Gm F Eb.D Gm',
      riff: 'D5:3 D5:1 G5:2 Bb5:2 A5:2 G5:2 D5:4 C5:3 C5:1 F5:2 A5:2 G5:2 F5:2 C5:4 Bb4:3 Bb4:1 Eb5:2 G5:2 Bb5:4 G5:4 A5:3 G5:1 F#5:4 D5:8 G5:3 A5:1 Bb5:4 D6:4 Bb5:4 A5:3 Bb5:1 C6:4 F6:4 C6:4 Eb6:4 Bb5:4 F#5:4 A5:4 G5:8 D5:4 G4:4' } },
  dodona: { mood: 'ancient oak grove, hushed', motif: 'a slow falling third (E D C)', x: { bpm: 70, groove: 'calm', pal: 'soft', key: 'A minor',
    prog: 'Am F C G Am F G Am | F C Dm Am F C E E',
    mel: 'E5:8 D5:4 C5:4 A4:8 C5:4 F5:4 E5:6 D5:2 C5:4 G4:4 D5:12 r:4 E5:6 G5:2 A5:4 C6:4 A5:6 G5:2 F5:4 C5:4 D5:4 G5:4 B4:4 D5:4 A4:12 r:4 '
      + 'F5:8 A5:4 C6:4 G5:6 E5:2 C5:8 D5:4 F5:4 A5:6 G5:2 E5:12 r:4 C6:6 A5:2 F5:4 A5:4 G5:6 E5:2 G5:4 C6:4 B5:6 G#5:2 E5:8 G#5:8 B5:4 E5:4' },
    c: { bpm: 134, groove: 'drive', pal: 'wild', key: 'A minor', prog: 'Am G F E Am G F.E Am',
      riff: 'A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 C5:2 E5:2 D5:2 G5:2 B5:4 A5:2 G5:2 D5:4 C5:2 F5:2 A5:4 G5:2 F5:2 C5:4 B4:4 E5:4 G#5:8 E5:2 A5:2 C6:4 B5:2 A5:2 E5:4 D5:4 G5:4 B5:6 A5:2 A5:4 C6:4 B5:4 G#5:4 A5:12 r:4' } },
  olympus: { mood: 'majestic, high and luminous', motif: 'a lydian fanfare (G C E F#)', x: { bpm: 72, groove: 'calm', pal: 'airy', key: 'C lydian',
    prog: 'C D C G Am D G C | F G Em Am F D G G',
    mel: 'G4:4 C5:4 E5:6 F#5:2 F#5:8 A5:4 D5:4 E5:6 G5:2 C6:8 B5:8 D6:4 G5:4 A5:6 E5:2 C6:4 B5:4 A5:6 F#5:2 D5:8 D5:4 G5:4 B5:4 D6:4 C6:12 r:4 '
      + 'A5:6 C6:2 F6:8 D6:6 B5:2 G5:8 G5:4 B5:4 E6:6 D6:2 C6:8 A5:4 E5:4 F5:4 A5:4 C6:6 B5:2 A5:6 F#5:2 D6:8 B5:4 D6:4 G6:8 D6:8 B5:4 G5:4' },
    c: { bpm: 128, groove: 'drive', pal: 'hot', key: 'C minor', prog: 'Cm Ab Bb G Cm Ab Fm.G Cm',
      riff: 'C5:4 G5:4 Eb5:2 F5:2 G5:4 Ab5:4 Eb5:4 C5:2 Eb5:2 Ab5:4 Bb5:4 F5:4 D5:2 F5:2 Bb5:4 B5:6 A5:2 G5:4 D5:4 Eb6:4 D6:2 C6:2 G5:4 C6:4 C6:4 Bb5:2 Ab5:2 Eb5:4 Ab5:4 Ab5:4 C6:4 B5:4 D6:4 C6:8 G5:4 C5:4' } },
  crete: { mood: 'Minoan, labyrinthine (Eastern Mediterranean colour)', motif: 'a hijaz turn (A Bb A F#)', x: { bpm: 94, groove: 'maqsum', pal: 'reed', key: 'D hijaz',
    prog: 'D Eb D Gm D Cm Eb D | Gm Cm D D Eb D Cm D',
    mel: 'A4:4 Bb4:2 A4:2 F#4:4 A4:4 G4:6 Bb4:2 Eb5:6 D5:2 D5:4 Eb5:2 D5:2 C5:2 Bb4:2 A4:4 G4:8 Bb4:4 D5:4 F#5:4 G5:2 F#5:2 Eb5:4 D5:4 Eb5:6 C5:2 G4:4 C5:4 Bb4:4 Eb5:4 G5:6 F#5:2 D5:12 r:4 '
      + 'D5:4 G5:4 Bb5:6 A5:2 G5:6 Eb5:2 C5:8 A5:4 Bb5:2 A5:2 F#5:4 D5:4 Eb5:2 F#5:2 A5:4 G5:2 F#5:2 Eb5:4 G5:4 Bb5:4 Eb6:6 D6:2 A5:4 Bb5:2 A5:2 F#5:4 D5:4 Eb5:4 G5:4 C6:4 Bb5:2 G5:2 A5:4 F#5:4 D5:8' },
    c: { bpm: 140, groove: 'maqsumc', pal: 'wild', key: 'D hijaz', prog: 'D Eb D C Bb C D.Eb D',
      riff: 'D5:2 Eb5:1 D5:1 C5:2 D5:2 A4:2 Bb4:2 A4:2 F#4:2 G4:2 Bb4:2 Eb5:2 G5:2 F#5:2 Eb5:2 D5:4 A5:4 Bb5:2 A5:2 F#5:2 G5:2 F#5:2 Eb5:2 C5:4 E5:4 G5:4 E5:4 D5:2 F5:2 Bb5:4 A5:2 G5:2 F5:4 E5:2 G5:2 C6:4 Bb5:2 A5:2 G5:4 F#5:4 A5:4 G5:4 Bb5:4 A5:4 F#5:4 D5:8' } },
  aegean: { mood: 'breezy islands, sunlit', motif: 'a syncopated leap (E A C# B A)', x: { bpm: 108, groove: 'sway', pal: 'bright', key: 'A major',
    prog: 'A E F#m D A E D.E A | D A Bm E C#m F#m D.E E',
    mel: 'E5:3 A5:3 C#6:2 B5:2 A5:2 E5:4 G#5:3 B5:3 E6:2 D6:2 B5:2 G#5:4 A5:3 F#5:3 C#5:2 F#5:4 A5:4 F#5:6 E5:2 D5:8 C#6:3 A5:3 E5:2 A5:2 C#6:2 E6:4 D6:3 B5:3 G#5:2 E5:4 G#5:4 F#5:4 A5:4 G#5:4 B5:4 A5:12 r:4 '
      + 'A5:4 F#5:2 A5:2 D6:6 C#6:2 C#6:4 A5:2 E5:2 A5:8 B5:4 D6:2 B5:2 F#5:4 D5:4 E5:6 G#5:2 B5:8 G#5:4 E5:2 G#5:2 C#6:6 B5:2 A5:4 F#5:2 A5:2 C#6:8 D6:4 A5:4 B5:4 G#5:4 E5:4 G#5:4 B5:8' },
    c: { bpm: 146, groove: 'drive', pal: 'hot', key: 'A minor', prog: 'Am F G E Am F Dm.E Am',
      riff: 'E5:2 A5:2 C6:2 A5:2 E5:2 A5:2 B5:2 C6:2 A5:2 F5:2 C5:2 F5:2 A5:4 G5:2 F5:2 G5:2 D5:2 B4:2 D5:2 G5:4 A5:2 B5:2 G#5:6 E5:2 B4:8 C6:2 B5:2 A5:2 E5:2 A5:4 C6:4 A5:4 C6:4 F6:6 E6:2 D6:4 A5:4 B5:4 G#5:4 A5:12 r:4' } },
  forge: { mood: 'the smiths\' islands: hammering, industrious', motif: 'struck repeated notes (F F Db F Bb)', x: { bpm: 100, groove: 'march', pal: 'warm', key: 'Bb dorian', anvil: true,
    prog: 'Bbm Eb Bbm Ab Bbm Eb Gb.Ab Bbm | Gb Db Eb Bbm Gb Db Eb.F F',
    mel: 'F5:2 F5:2 Db5:2 F5:2 Bb5:4 Ab5:4 G5:2 G5:2 Eb5:2 G5:2 Bb5:8 F5:4 Db5:4 Bb4:4 C5:4 Eb5:8 C5:4 Ab4:4 F5:2 F5:2 Bb5:2 F5:2 Db6:4 C6:4 Bb5:4 G5:2 Eb5:2 G5:4 Bb5:4 Bb5:4 Db6:4 C6:4 Eb6:4 Bb5:12 r:4 '
      + 'Db6:6 Bb5:2 Gb5:8 F5:4 Ab5:4 Db6:8 Eb6:4 Db6:2 Bb5:2 G5:4 Eb5:4 F5:8 Db5:4 Bb4:4 Bb4:4 Db5:4 Gb5:6 F5:2 Ab5:4 F5:4 Db5:8 G5:4 Bb5:4 A5:4 C6:4 F5:4 A5:4 C6:8' },
    c: { bpm: 148, groove: 'drive', pal: 'hot', key: 'Bb minor', prog: 'Bbm Gb Ab F Bbm Gb Eb.F Bbm', anvil: true,
      riff: 'Bb4:2 Bb4:1 Bb4:1 Db5:2 F5:2 Bb5:2 Ab5:2 F5:2 Db5:2 Gb5:2 Gb5:1 Gb5:1 Bb5:2 Db6:2 Bb5:4 Gb5:4 Ab5:2 Ab5:1 Ab5:1 C6:2 Eb6:2 C6:4 Ab5:4 A5:4 C6:4 F6:4 E6:2 C6:2 Db6:4 C6:2 Bb5:2 F5:4 Bb5:4 Bb5:4 Gb5:4 Db5:4 Gb5:4 G5:4 Bb5:4 A5:4 C6:4 Bb5:12 r:4' } },
  thera: { mood: 'smouldering, volcanic, tense', motif: 'a slow ember fall (Bb Gb F Eb)', x: { bpm: 82, groove: 'sway', pal: 'dark', key: 'Eb minor',
    prog: 'Ebm B Abm Bb Ebm B Abm.Bb Ebm | B Gb Abm Ebm B Gb Abm.Bb Bb',
    mel: 'Bb4:6 Gb5:2 F5:4 Eb5:4 F#5:8 D#5:4 B4:4 Eb5:6 B4:2 Ab4:8 D5:8 F5:4 Bb4:4 Gb5:6 F5:2 Eb5:4 Bb5:4 B5:6 Bb5:2 F#5:8 B5:4 Ab5:4 Bb5:4 D5:4 Eb5:12 r:4 '
      + 'D#5:4 F#5:4 B5:8 Bb5:6 Gb5:2 Db5:8 B5:4 Ab5:4 Eb5:8 Gb5:6 Bb5:2 Eb6:8 D#6:4 B5:4 F#5:4 B5:4 Db6:6 Bb5:2 Gb5:8 Eb5:4 B4:4 D5:4 F5:4 Bb4:8 D5:4 F5:4' },
    c: { bpm: 140, groove: 'stalk', pal: 'grim', key: 'Eb minor', prog: 'Ebm E Ebm Bb Ebm B Abm.Bb Ebm',
      riff: 'Eb5:2 Eb5:1 Gb5:1 Bb5:2 Eb6:2 D6:2 Bb5:2 Gb5:4 E5:2 E5:1 G#5:1 B5:2 E6:2 D#6:2 B5:2 G#5:4 Gb5:4 F5:2 Eb5:2 Bb4:4 Eb5:4 D5:4 F5:4 Bb5:6 A5:2 Bb5:4 Gb5:2 Eb5:2 Gb5:4 Bb5:4 B5:4 F#5:2 D#5:2 F#5:4 B5:4 B5:4 Ab5:4 Bb5:4 D6:4 Eb6:8 Bb5:4 Eb5:4' } },
  west: { mood: 'longing, seafaring (the Odyssey)', motif: 'a barcarolle rise (D G Bb A)', x: { bpm: 78, groove: 'barca', pal: 'airy', key: 'G minor', meter: 12,
    prog: 'Gm Eb Cm D Gm Eb Cm.D Gm | Bb F Gm D Eb Bb Cm.D D',
    mel: 'D5:4 G5:2 Bb5:4 A5:2 G5:6 Eb5:4 Bb4:2 C5:4 Eb5:2 G5:4 F5:2 F#5:6 D5:4 r:2 Bb5:4 A5:2 G5:4 D5:2 Eb5:4 G5:2 Bb5:4 C6:2 Eb6:2 D6:2 C6:2 A5:2 F#5:2 A5:2 G5:10 r:2 '
      + 'D6:4 C6:2 Bb5:4 F5:2 A5:6 C6:4 A5:2 Bb5:4 G5:2 D5:4 G5:2 F#5:6 A5:6 G5:4 Bb5:2 Eb6:4 D6:2 D6:6 Bb5:4 F5:2 C6:2 Eb6:2 C6:2 A5:2 D6:2 C6:2 A5:6 F#5:4 D5:2' },
    c: { bpm: 138, groove: 'jigc', pal: 'wild', key: 'G minor', prog: 'Gm F Eb D Gm F Eb.D Gm',
      riff: 'G5:2 Bb5:2 D6:2 G6:4 D6:2 F6:2 C6:2 A5:2 F5:4 A5:2 G5:2 Bb5:2 Eb6:2 G6:4 Eb6:2 F#6:4 D6:2 A5:4 F#5:2 Bb5:2 A5:2 G5:2 D5:4 G5:2 A5:2 G5:2 F5:2 C5:4 F5:2 G5:2 Eb5:2 Bb4:2 A4:2 D5:2 F#5:2 G5:10 r:2' } },
  dead: { mood: 'haunted, solemn (the dead heroes, the Acheron)', motif: 'a falling minor sixth with silences (F# D B)', x: { bpm: 64, groove: 'drift', pal: 'dark', key: 'B minor', spooky: true,
    prog: 'Bm G Em F# Bm C Em.F# Bm | G D Em Bm C G Em.F# F#',
    mel: 'F#5:6 r:2 D5:4 B4:4 D5:6 r:2 B4:8 G5:6 r:2 E5:4 B4:4 A#4:12 r:4 B4:4 D5:4 F#5:6 E5:2 E5:6 r:2 C5:4 G4:4 G4:4 B4:4 A#4:4 C#5:4 B4:12 r:4 '
      + 'B5:6 r:2 G5:4 D5:4 F#5:8 r:4 A5:4 G5:6 F#5:2 E5:8 D5:12 r:4 E5:6 G5:2 C6:8 B5:6 A5:2 G5:4 D5:4 E5:4 G5:4 F#5:4 A#5:4 C#6:8 A#5:4 F#5:4' },
    c: { bpm: 120, groove: 'stalk', pal: 'grim', key: 'B minor', prog: 'Bm C Bm F# G C Em.F# Bm',
      riff: 'B4:2 r:1 B4:1 D5:2 F#5:2 C6:4 B5:4 C5:2 r:1 C5:1 E5:2 G5:2 B5:4 C6:4 D6:4 C#6:2 B5:2 F#5:4 D5:4 A#5:6 C#6:2 F#5:8 B5:2 r:1 B5:1 G5:2 D5:2 B4:4 D5:4 E5:4 G5:4 C6:6 B5:2 G5:4 E5:4 F#5:4 A#5:4 B5:12 r:4' } },
  gorgon: { mood: 'beautiful but uncanny (Medusa\'s isle, the Garden of Statues)', motif: 'a sigh over a whole-tone shimmer (C# F# A G#)', x: { bpm: 70, groove: 'calm', pal: 'airy', key: 'F# minor', spooky: true,
    prog: 'F#m Dmaj7 Bm C# F#m Daug E.C# F#m | D A Bm F#m Daug A Bm.C# C#',
    mel: 'C#5:4 F#5:4 A5:6 G#5:2 F#5:6 E5:2 C#5:8 D5:4 F#5:4 B5:6 A5:2 G#5:6 F5:2 C#5:8 A5:4 C#6:4 F#6:6 E6:2 D6:4 A#5:4 F#5:4 D5:4 G#5:4 B5:4 F5:4 G#5:4 F#5:12 r:4 '
      + 'A5:6 F#5:2 D5:8 E5:4 A5:4 C#6:8 B5:6 C6:2 B5:4 F#5:4 A5:12 r:4 F#5:4 A#5:4 D6:8 C#6:6 B5:2 A5:8 D6:4 B5:4 C#6:4 G#5:4 F5:8 G#5:4 C#6:4' },
    c: { bpm: 130, groove: 'stalk', pal: 'grim', key: 'F# minor', prog: 'F#m G F#m C# D G Bm.C# F#m',
      riff: 'F#5:2 G5:2 F#5:2 C#5:2 A5:4 F#5:4 G5:2 A5:2 G5:2 D5:2 B5:4 G5:4 C#6:4 B5:2 A5:2 F#5:4 C#5:4 G#5:4 F5:4 C#5:8 A5:2 Bb5:2 A5:2 F#5:2 D6:4 A5:4 B5:2 C6:2 B5:2 G5:2 D6:4 B5:4 D6:4 B5:4 C#6:4 F5:4 F#5:12 r:4' } },
  hesperides: { mood: 'enchanted golden garden, dreamy', motif: 'a golden arch (G Bb G Eb)', x: { bpm: 80, groove: 'calm', pal: 'airy', key: 'Eb major',
    prog: 'Eb Ab Eb Bb Cm Ab Fm.Bb Eb | Ab Eb Fm Cm Ab Eb Fm.Bb Bb',
    mel: 'G5:4 Bb5:2 G5:2 Eb5:8 C6:4 Eb6:2 C6:2 Ab5:8 Bb5:6 G5:2 Eb5:4 G5:4 F5:8 D5:4 Bb4:4 Eb5:4 G5:4 C6:6 Bb5:2 Ab5:6 G5:2 Eb5:4 C5:4 Ab5:4 C6:4 Bb5:4 D6:4 Eb6:12 r:4 '
      + 'Eb6:6 C6:2 Ab5:8 G5:4 Bb5:4 Eb6:8 F5:4 Ab5:4 C6:6 Bb5:2 G5:8 Eb5:4 C5:4 C6:4 Bb5:2 Ab5:2 Eb5:4 Ab5:4 Bb5:6 G5:2 Eb6:8 Ab5:4 F5:4 D5:4 F5:4 Bb4:4 D5:4 F5:8' },
    c: { bpm: 132, groove: 'drive', pal: 'hot', key: 'C minor', prog: 'Cm Ab Eb Bb Cm Ab Fm.G Cm',
      riff: 'G5:2 C6:2 Eb6:2 C6:2 G5:2 Eb5:2 C5:4 Ab5:2 C6:2 Eb6:2 C6:2 Ab5:2 Eb5:2 C5:4 Bb5:4 G5:2 Eb5:2 G5:4 Bb5:4 D6:6 C6:2 Bb5:4 F5:4 Eb6:4 D6:2 C6:2 G5:4 C6:4 C6:4 Ab5:4 Eb5:4 Ab5:4 Ab5:4 C6:4 B5:4 D6:4 C6:12 r:4' } },
  // ----- the realms -----
  underworld: { mood: 'deep, still, foreboding (Hades\' realm)', motif: 'a low phrygian step (A F D, Eb)', x: { bpm: 60, groove: 'drift', pal: 'dark', key: 'D phrygian', spooky: true,
    prog: 'Dm Eb Dm Bb Dm Eb Gm.A Dm | Bb Gm Eb Dm Bb Gm Eb.A A',
    mel: 'A4:6 r:2 F4:4 D4:4 G4:6 r:2 Bb4:8 A4:4 D5:4 F5:6 E5:2 D5:12 r:4 F5:6 r:2 E5:4 D5:4 Eb5:6 r:2 G4:8 Bb4:4 G4:4 C#5:4 E5:4 D5:12 r:4 '
      + 'F5:8 D5:4 Bb4:4 D5:6 r:2 G5:8 G5:6 F5:2 Eb5:8 F5:12 r:4 D5:4 F5:4 Bb5:6 A5:2 G5:6 r:2 D5:8 Eb5:4 G5:4 E5:4 C#5:4 A4:12 r:4' },
    c: { bpm: 126, groove: 'stalk', pal: 'grim', key: 'D minor', prog: 'Dm Eb Dm C Bb A Gm.A Dm',
      riff: 'D5:2 r:2 D5:2 Eb5:2 D5:4 A4:4 Eb5:2 r:2 Eb5:2 F5:2 G5:4 Bb4:4 F5:4 E5:2 D5:2 A5:4 F5:4 E5:4 G5:4 C6:6 Bb5:2 D6:4 C6:2 Bb5:2 F5:4 D5:4 C#6:6 A5:2 E5:8 G5:4 Bb5:4 A5:4 C#6:4 D6:12 r:4' } },
  isle: { mood: 'storm-lashed, mournful (the Island of No Return)', motif: 'a rising sigh (G# C# E D#)', x: { bpm: 84, groove: 'sway', pal: 'dark', key: 'C# minor', spooky: true,
    prog: 'C#m A E B C#m A F#m.G# C#m | A E F#m C#m A E F#m.G# G#',
    mel: 'G#4:4 C#5:4 E5:6 D#5:2 C#5:6 A4:2 E5:8 B4:4 E5:4 G#5:6 F#5:2 F#5:12 r:4 E5:4 G#5:4 C#6:6 B5:2 A5:6 G#5:2 E5:8 F#5:4 A5:4 G#5:4 C5:4 C#5:12 r:4 '
      + 'E5:6 C#5:2 A4:8 G#5:6 E5:2 B4:8 A5:4 F#5:4 C#6:8 G#5:12 r:4 C#6:6 B5:2 A5:4 E5:4 B5:6 G#5:2 E5:8 A5:4 F#5:4 G#5:4 D#5:4 C6:8 G#5:4 D#5:4' },
    c: { bpm: 140, groove: 'drive', pal: 'grim', key: 'C# minor', prog: 'C#m D C#m G# A B F#m.G# C#m',
      riff: 'C#5:2 E5:2 G#5:2 C#6:2 B5:2 G#5:2 E5:2 G#5:2 D5:2 F#5:2 A5:2 D6:2 C#6:2 A5:2 F#5:2 A5:2 G#5:4 E5:2 C#5:2 E5:4 G#5:4 C6:6 G#5:2 D#5:8 C#6:4 B5:2 A5:2 E5:4 A5:4 D#6:4 B5:2 F#5:2 B5:4 D#6:4 F#6:4 C#6:4 C6:4 G#5:4 C#6:12 r:4' } },
  cave: { mood: 'dripping dark, close walls', motif: 'drops in the dark (B E G)', x: { bpm: 70, groove: 'drift', pal: 'dark', key: 'E minor', spooky: true,
    prog: 'Em C Em B Em Am C.B Em | Am Em C B Am Em C.B B',
    mel: 'B4:2 r:2 E5:2 r:2 G5:4 r:4 E5:2 r:2 G5:2 r:2 C6:4 r:4 B5:4 G5:2 E5:2 B4:8 D#5:8 F#5:4 r:4 G5:2 r:2 B5:2 r:2 E6:4 D6:2 B5:2 C6:6 A5:2 E5:8 G5:4 E5:4 F#5:4 D#5:4 E5:12 r:4 '
      + 'A5:2 r:2 C6:2 r:2 E6:4 r:4 B5:2 r:2 G5:2 r:2 E5:4 r:4 E5:4 G5:4 C6:6 B5:2 F#5:8 D#5:4 B4:4 C6:6 B5:2 A5:4 E5:4 G5:6 F#5:2 E5:8 C5:4 E5:4 D#5:4 F#5:4 B4:12 r:4' },
    c: { bpm: 132, groove: 'stalk', pal: 'grim', key: 'E minor', prog: 'Em F Em D C B Am.B Em',
      riff: 'E5:2 r:1 E5:1 G5:2 F5:2 E5:4 B4:4 F5:2 r:1 F5:1 A5:2 G5:2 F5:4 C5:4 G5:4 B5:4 E6:6 D6:2 F#5:4 A5:4 D6:8 E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 D#5:4 F#5:4 B5:8 C6:4 A5:4 B5:4 D#6:4 E6:12 r:4' } },
  temple: { mood: 'sacred stillness, incense and marble', motif: 'a slow hymn (A D F#)', x: { bpm: 66, groove: 'calm', pal: 'soft', key: 'D major',
    prog: 'D A Bm F#m G D Em.A D | G D Em Bm G D Em.A A',
    mel: 'A4:8 D5:4 F#5:4 E5:8 C#5:4 A4:4 D5:6 F#5:2 B5:8 A5:8 F#5:4 C#5:4 B4:6 D5:2 G5:8 F#5:6 E5:2 D5:8 E5:4 G5:4 E5:4 C#5:4 D5:12 r:4 '
      + 'D6:8 B5:4 G5:4 A5:8 F#5:4 D5:4 G5:6 B5:2 E6:8 D6:8 B5:4 F#5:4 G5:6 A5:2 B5:8 A5:6 F#5:2 D5:8 G5:4 B5:4 A5:4 C#6:4 E5:12 r:4' },
    c: { bpm: 120, groove: 'march', pal: 'hot', key: 'B minor', prog: 'Bm G D A Bm G Em.F# Bm',
      riff: 'B4:3 D5:1 F#5:4 B5:4 A5:2 F#5:2 G5:3 B5:1 D6:4 B5:4 G5:4 A5:3 F#5:1 D5:4 F#5:4 A5:4 C#6:6 B5:2 A5:4 E5:4 D6:3 C#6:1 B5:4 F#5:4 B5:4 B5:4 G5:4 D5:4 G5:4 E5:4 G5:4 F#5:4 A#5:4 B5:12 r:4' } },
};
// sub-areas of a realm with their own version of its tune (the realm's own music getter names them: portals.js, isle.js)
export const REALM_VARIANTS = {
  underworld_deep: { base: 'underworld', tr: -2, bpm: 56, note: 'the hall of the dead (deeper, slower)' },
  isle_temple: { base: 'isle', lead: { w: 'pl', duty: 25, v: .06, dk: .6, echo: [6, .3, .4] }, bpm: 72, note: 'Poseidon\'s drowned temple (bell-like, slower)' },
  isle_cave: { base: 'isle', tr: -3, bpm: 70, light: true, note: 'the Cave of Echoes (sparser, deeper echo)', leadEcho: [3, .45, .5] },
};

// ---------------- the five town themes ----------------
// A memorable melody each, its own harmony, rhythm and voice. a: A, b: B, a2: the closing A (24 bars), or A + B (16).
export const TOWN_THEMES = {
  hearth: { name: { he: 'אח הפוליס', en: 'Hearth of the Polis' }, mood: 'warm, welcoming classical city (a graceful 3/4)', bpm: [100, 112], meter: 12, groove: 'waltz', pal: 'warm', key: 'G major',
    prog: 'G D Em C G D C.D G | C G Am D Bm Em Am.D D | G D Em C G Em Am.D G',
    mel: 'D5:4 G5:4 B5:4 A5:6 F#5:2 D5:4 E5:4 G5:4 B5:2 A5:2 G5:8 E5:4 D5:4 G5:4 B5:4 D6:6 C6:2 A5:4 G5:2 E5:2 C5:2 A4:2 D5:2 F#5:2 G5:8 r:4 '
      + 'E5:4 G5:4 C6:4 B5:6 A5:2 G5:4 A5:4 C6:4 E6:2 D6:2 D6:8 A5:4 F#5:4 B5:4 D6:4 E6:6 D6:2 B5:4 C6:2 B5:2 A5:2 F#5:2 A5:2 C6:2 A5:6 F#5:2 D5:4 '
      + 'D5:4 G5:4 B5:4 A5:6 F#5:2 D5:4 E5:4 G5:4 B5:2 A5:2 G5:8 E5:4 D5:4 G5:4 B5:4 E6:6 D6:2 B5:4 C6:2 B5:2 A5:2 F#5:2 E5:2 F#5:2 G5:8 r:4',
    c: { bpm: 144, groove: 'waltzc', pal: 'hot', prog: 'Gm D Eb D Gm D Cm.D Gm',
      riff: 'D5:2 G5:2 Bb5:2 D6:2 Bb5:2 G5:2 A5:4 F#5:2 D5:2 F#5:2 A5:2 G5:2 Bb5:2 Eb6:4 D6:2 Bb5:2 A5:6 F#5:2 D5:4 D5:2 G5:2 Bb5:2 D6:2 G6:4 F#6:4 D6:2 A5:2 F#5:4 Eb6:2 C6:2 G5:2 F#5:2 A5:2 D6:2 G5:8 r:4',
      progB: 'G D Em C G D C.D G' } },
  agora: { name: { he: 'המולת האגורה', en: 'Bustle of the Agora' }, mood: 'bright market town, gently adventurous', bpm: [116, 126], meter: 16, groove: 'walk', pal: 'bright', key: 'C major',
    prog: 'C Am F G C Am Dm.G C | F C Dm G Em Am Dm.G G | C Am F G C Am Dm.G C',
    mel: 'E5:2 G5:2 r:1 G5:1 A5:2 G5:2 E5:2 C5:4 A4:2 C5:2 r:1 C5:1 E5:2 D5:2 C5:2 A4:4 F5:2 A5:2 r:1 A5:1 C6:2 B5:2 A5:2 F5:4 G5:6 D5:2 B4:4 G4:4 '
      + 'E5:2 G5:2 r:1 G5:1 C6:2 B5:2 G5:2 E5:4 C6:3 B5:1 A5:2 E5:2 A5:4 C6:4 D6:2 C6:2 A5:2 F5:2 D5:2 G5:2 B5:4 C6:10 r:2 G5:2 A5:2 '
      + 'A5:4 F5:2 A5:2 C6:4 A5:4 G5:4 E5:2 G5:2 C6:8 F5:4 D5:2 F5:2 A5:4 F5:4 G5:6 A5:2 B5:4 D6:4 E6:4 D6:2 B5:2 G5:4 B5:4 C6:4 B5:2 A5:2 E5:4 A5:4 F5:4 A5:4 G5:4 B5:4 D6:4 B5:2 G5:2 F5:4 D5:4 '
      + 'E5:2 G5:2 r:1 G5:1 A5:2 G5:2 E5:2 C5:4 A4:2 C5:2 r:1 C5:1 E5:2 D5:2 C5:2 A4:4 F5:2 A5:2 r:1 A5:1 C6:2 B5:2 A5:2 F5:4 G5:6 D5:2 B4:4 G4:4 '
      + 'E5:2 G5:2 r:1 G5:1 C6:2 B5:2 G5:2 E5:4 C6:3 B5:1 A5:2 E5:2 A5:4 C6:4 D6:2 C6:2 A5:2 F5:2 D5:2 G5:2 B5:4 C6:12 r:4',
    c: { bpm: 148, groove: 'drive', pal: 'hot', prog: 'Cm Ab Fm G Cm Ab Fm.G Cm',
      riff: 'Eb5:2 G5:2 r:1 G5:1 Ab5:2 G5:2 Eb5:2 C5:4 C5:2 Eb5:2 r:1 Eb5:1 Ab5:2 G5:2 Eb5:2 C5:4 F5:2 Ab5:2 r:1 Ab5:1 C6:2 Bb5:2 Ab5:2 F5:4 G5:6 D5:2 B4:4 G4:4 Eb5:2 G5:2 r:1 G5:1 C6:2 Bb5:2 G5:2 Eb5:4 C6:3 Bb5:1 Ab5:2 Eb5:2 Ab5:4 C6:4 F5:4 Ab5:4 G5:4 B5:4 C6:12 r:4',
      progB: 'C Am F G C Am Dm.G C' } },
  harbor: { name: { he: 'פנס הנמל', en: 'Harbour Lantern' }, mood: 'calm harbour and island town, a slow 6/8 sway', bpm: [72, 82], meter: 12, groove: 'barca', pal: 'airy', key: 'A major',
    prog: 'A F#m D E A F#m Bm.E A | D A Bm F#m D A Bm.E E',
    mel: 'E5:4 C#5:2 A4:4 C#5:2 F#5:6 E5:4 C#5:2 D5:4 F#5:2 A5:4 F#5:2 E5:8 r:2 E5:2 A5:4 G#5:2 A5:4 C#6:2 A5:4 F#5:2 C#5:6 D5:2 F#5:2 B5:2 G#5:2 E5:2 D5:2 C#5:10 r:2 '
      + 'F#5:4 A5:2 D6:4 C#6:2 C#6:6 A5:4 E5:2 D6:4 C#6:2 B5:4 F#5:2 A5:6 C#6:6 A5:4 F#5:2 D5:4 F#5:2 E5:6 C#5:4 A4:2 B4:2 D5:2 F#5:2 E5:2 G#5:2 B5:2 G#5:6 B5:4 E5:2',
    c: { bpm: 140, groove: 'jigc', pal: 'wild', prog: 'F#m D E C# F#m D Bm.C# F#m',
      riff: 'C#5:4 A4:2 F#4:4 A4:2 F#5:6 D5:4 A4:2 E5:4 G#5:2 B5:4 G#5:2 F5:6 C#5:4 G#4:2 F#5:2 A5:2 C#6:2 F#6:4 C#6:2 D6:4 A5:2 F#5:4 A5:2 B5:2 F#5:2 D5:2 C#5:2 F5:2 G#5:2 F#5:10 r:2',
      progB: 'A F#m D E A F#m Bm.E A' } },
  bazaar: { name: { he: 'שוק השמש הקופחת', en: 'Sun-Scorched Bazaar' }, mood: 'hot, dry, Eastern Mediterranean colour (E hijaz, maqsum rhythm)', bpm: [96, 106], meter: 16, groove: 'maqsum', pal: 'reed', key: 'E hijaz',
    prog: 'E F E Dm E F G.F E | Am Dm G C F E Dm.F E',
    mel: 'B4:2 C5:1 B4:1 G#4:2 A4:2 B4:4 E5:4 C5:2 D5:2 A4:2 C5:2 F5:4 E5:4 E5:2 F5:1 E5:1 D5:2 C5:2 B4:2 C5:1 B4:1 G#4:4 A4:6 F4:2 D4:8 G#4:2 A4:2 B4:2 C5:2 D5:2 C5:2 B4:4 A4:2 C5:2 F5:4 E5:2 D5:2 C5:4 B4:4 D5:4 C5:4 A4:4 B4:2 C5:1 B4:1 G#4:4 E4:8 '
      + 'E5:4 A5:2 G#5:2 A5:4 C6:4 D6:2 C6:2 A5:4 F5:4 D5:4 D5:4 G5:2 F5:2 D5:4 B4:4 C5:2 E5:2 G5:4 F5:2 E5:2 C5:4 A5:2 G#5:1 A5:1 C6:4 B5:2 A5:2 F5:4 G#5:4 B5:2 A5:2 G#5:2 F5:2 E5:4 F5:2 E5:2 D5:4 C5:4 A4:4 G#4:2 A4:2 B4:2 C5:2 B4:8',
    c: { bpm: 146, groove: 'maqsumc', pal: 'wild', prog: 'E F E Dm E F G.F E',
      riff: 'E5:2 F5:1 E5:1 G#5:2 B5:2 C6:2 B5:2 G#5:4 F5:2 G#5:1 F5:1 A5:2 C6:2 D6:2 C6:2 A5:4 B5:2 C6:1 B5:1 G#5:2 E5:2 F5:2 E5:2 D5:4 F5:4 D5:4 A4:8 G#5:2 A5:2 B5:2 C6:2 D6:2 C6:2 B5:4 A5:2 C6:2 F6:4 E6:2 D6:2 C6:4 D6:4 B5:4 C6:4 A5:4 B5:2 C6:1 B5:1 G#5:4 E5:8',
      progB: 'E F E Dm E F G.F E' } },
  veiled: { name: { he: 'האקרופוליס המכוסה', en: 'The Veiled Acropolis' }, mood: 'beautiful but slightly unsettling (dark, remote or story-heavy towns)', bpm: [72, 80], meter: 16, groove: 'calm', pal: 'soft', key: 'D minor', musicbox: true,
    prog: 'Dm Bb Gm A Dm Eb Gm.A Dm | F C Dm Bb Gm Eb Gm.A A',
    mel: 'A4:4 D5:4 F5:4 E5:2 D5:2 D5:6 C5:2 Bb4:8 Bb4:4 D5:4 G5:6 F5:2 E5:8 C#5:4 A4:4 F5:4 A5:4 D6:4 C6:2 A5:2 G5:6 Eb5:2 Bb4:8 Bb4:4 D5:4 C#5:4 E5:4 D5:12 r:4 '
      + 'C5:4 F5:4 A5:6 G5:2 G5:6 E5:2 C5:8 D5:4 F5:4 A5:4 D6:4 D6:6 C6:2 Bb5:8 G5:4 Bb5:4 D6:6 C6:2 Bb5:6 G5:2 Eb5:8 D5:4 G5:4 E5:4 C#5:4 A4:8 C#5:4 E5:4',
    c: { bpm: 132, groove: 'stalk', pal: 'grim', prog: 'Dm Eb Dm A Bb Eb Gm.A Dm',
      riff: 'A4:2 D5:2 F5:2 A5:2 G#5:2 A5:2 F5:4 G4:2 Bb4:2 Eb5:2 G5:2 F#5:2 G5:2 Eb5:4 D5:4 F5:4 A5:4 D6:4 C#6:6 A5:2 E5:8 D6:4 Bb5:2 F5:2 D5:4 F5:4 Eb6:4 Bb5:2 G5:2 Eb5:4 G5:4 Bb5:4 D6:4 C#6:4 E6:4 D6:12 r:4',
      progB: 'Dm Bb Gm A Dm Eb Gm.A Dm' } },
};
export const TOWN_THEME_IDS = Object.keys(TOWN_THEMES);

// ---------------- the ship and the Kraken ----------------
// "Wind in the Linen": D minor 6/8 shanty, a bright F-major middle; one tune for every crossing
export const SHIP_TUNE = { name: { he: 'רוח במפרשים', en: 'Wind in the Linen' }, mood: 'sailing, adventurous, a little piratical', bpm: 108, meter: 12, groove: 'jig', pal: 'bright', key: 'D minor',
  prog: 'Dm C Bb A Dm C Bb.A Dm | F C Dm A Bb F Gm.A A',
  mel: 'A4:2 D5:2 D5:2 D5:4 F5:2 E5:4 C5:2 G4:4 C5:2 D5:2 F5:2 F5:2 F5:4 G5:2 A5:6 E5:4 C#5:2 D5:2 F5:2 A5:2 D6:4 C6:2 C6:2 Bb5:2 G5:2 E5:4 G5:2 F5:2 D5:2 Bb4:2 C#5:2 E5:2 A5:2 D5:10 r:2 '
    + 'C5:2 F5:2 F5:2 F5:4 A5:2 G5:4 E5:2 C5:4 E5:2 F5:2 A5:2 A5:2 A5:4 D6:2 C#6:6 A5:4 E5:2 D6:4 C6:2 Bb5:4 F5:2 A5:4 G5:2 F5:4 C5:2 Bb5:2 G5:2 D5:2 C#5:2 E5:2 G5:2 A5:6 E5:4 C#5:2' };

// the arranger -------------------------------------------------------------------------------------------
function arrange(o) {
  const G = GROOVES[o.groove], P = { ...PAL[o.pal] }, m = G.m, prog = parseProg(o.prog), bars = prog.length;
  const lead = { ...P.lead, ...(o.lead || {}), m: o.mel };
  const ch = [lead];
  const hk = o.harm || G.harm;
  if (hk === 'arp') ch.push({ ...(P.harm.w === 'arp' ? P.harm : { w: 'arp', duty: 12, v: .03, cut: 2300, ar: .5 }), m: harmony(prog, 'arp', m) });
  else if (hk === 'pad') { ch.push(padCh(harmony(prog, 'pad', m), o.padV ?? .032)); if (G.pl) ch.push({ ...P.harm, v: P.harm.v * .8, m: harmony(prog, G.pl, m, 62) }); }
  else ch.push({ ...P.harm, m: harmony(prog, hk, m) });
  ch.push({ ...P.bass, m: bassLine(prog, G) });
  if (o.counter) ch.push({ w: 'pl', duty: 50, v: .035, cut: 1800, dk: .7, m: counterLine(prog, m) });
  if (o.padUnder) ch.push(padCh(harmony(prog, 'pad', m), o.padUnder));
  if (!o.noDrums) ch.push({ d: drumLine(G, bars, { crash: o.crash, light: o.light, kickOnly: o.kickOnly }), v: o.drumV ?? .5 });
  if (o.anvil) ch.push({ d: Array.from({ length: bars }, (_, i) => (i % 2 ? '....p.......p...' : '....p.......p.p.').slice(0, m)).join(''), v: .35 });
  return { bpm: o.bpm, rev: o.rev ?? .6, bar: m, chip: true, lv: o.lv ?? 1.4, ch, ...(o.battle ? { battle: true } : {}) };
}
function checkLen(id, s, steps) { let n = 0; for (const t of s.trim().split(/\s+/)) n += parseInt(t.split(':')[1] || '1'); if (n !== steps) throw new Error(`music.js: ${id}: ${n} steps, want ${steps}`); }

// exploration: lead A+B over the 16-bar progression
function exploreSong(id, R, o = {}) {
  const X = R.x, m = X.meter || 16, bars = parseProg(X.prog).length;
  checkLen('rx_' + id, X.mel, bars * m);
  return arrange({ bpm: o.bpm || X.bpm, groove: o.groove || X.groove, pal: X.pal, prog: X.prog, mel: X.mel, rev: X.pal === 'dark' || X.pal === 'airy' ? 1.1 : .7,
    padUnder: X.spooky ? .022 : 0, anvil: X.anvil, crash: false, ...o });
}
// combat: the riff over its own chords, then the place's motif (exploration A) over the exploration chords, at fighting pace
function combatSong(id, R, o = {}) {
  const X = R.x, C = R.c, m = X.meter || 16, cprog = parseProg(C.prog), xprogA = parseProg(X.prog).slice(0, 8);
  checkLen('rc_' + id, C.riff, cprog.length * m);
  const melA = firstBars(X.mel, 8 * m);
  const prog = [...cprog, ...xprogA].map((b) => b.join('.')).join(' ');
  return arrange({ bpm: C.bpm, groove: C.groove, pal: C.pal, prog, mel: C.riff + ' ' + melA, battle: true, rev: .45, crash: true, drumV: .58, anvil: C.anvil, lv: 1.55, ...o });
}
function firstBars(mel, steps) {
  const out = []; let n = 0;
  for (const t of mel.trim().split(/\s+/)) { if (n >= steps) break; const [a, l] = t.split(':'); const len = parseInt(l || '1'); const take = Math.min(len, steps - n); out.push(a + ':' + take); n += take; }
  return out.join(' ');
}
// a night version: the same tune softer and slower, the lead a struck voice with an echo, a pad under it, only the kick
function nightSong(id, R) {
  const X = R.x;
  return exploreSong(id, R, { bpm: Math.round(X.bpm * .9), lead: { w: 'pl', duty: 25, v: .1, cut: 2400, dk: .55, echo: [6, .3, .35], vib: 0 }, padUnder: .028, kickOnly: true, drumV: .35, rev: 1.2 });
}
// a town theme as one city plays it. v: {tr, bpm, lead: 12|25|50, counter, echo, light, harm}
function townSong(themeId, v = {}) {
  const T = TOWN_THEMES[themeId], m = T.meter, bars = parseProg(T.prog).length;
  checkLen('tw_' + themeId, T.mel, bars * m);
  const lead = { duty: v.lead || PAL[T.pal].lead.duty, ...(v.echo ? { echo: [m === 12 ? 6 : 6, .28, .32] } : {}) };
  let s = arrange({ bpm: v.bpm || T.bpm[0], groove: T.groove, pal: T.pal, prog: T.prog, mel: T.mel, lead, counter: v.counter, light: v.light, harm: v.harm, rev: .8,
    padUnder: T.musicbox ? .02 : 0 });
  if (T.musicbox) s.ch.push({ w: 'pl', duty: 12, v: .028, cut: 2600, dk: .5, m: harmony(parseProg(T.prog), 'sparse', m, 67) }); // the music box: high, struck, half there
  if (v.tr) s.tr = v.tr;
  return s;
}
function townCombat(themeId, v = {}) {
  const T = TOWN_THEMES[themeId], C = T.c, m = T.meter, cprog = parseProg(C.prog), bprog = parseProg(C.progB);
  checkLen('twc_' + themeId, C.riff, cprog.length * m);
  const melA = firstBars(T.mel, bprog.length * m), prog = [...cprog, ...bprog].map((b) => b.join('.')).join(' ');
  const s = arrange({ bpm: Math.round(C.bpm * (v.bpm ? v.bpm / T.bpm[0] : 1)), groove: C.groove, pal: C.pal, prog, mel: C.riff + ' ' + melA, battle: true, rev: .45, crash: true, drumV: .58, lv: 1.55,
    lead: { duty: v.lead || PAL[C.pal].lead.duty } });
  if (v.tr) s.tr = v.tr;
  return s;
}
// the city's own pair of songs (sound.js registers them when the city is first heard)
export function citySongs(city, rec) { return { ['tw_' + city]: townSong(rec.theme, rec.v), ['twc_' + city]: townCombat(rec.theme, rec.v) }; }

function shipSong() {
  const S = SHIP_TUNE, bars = parseProg(S.prog).length; checkLen('ship', S.mel, bars * S.meter);
  const s = arrange({ bpm: S.bpm, groove: S.groove, pal: S.pal, prog: S.prog, mel: S.mel, lead: { vib: 1, duty: 25 }, counter: true, rev: .8 });
  // the bosun's whistle: a high answer in the rests of the B half (a quiet echo of the motif)
  s.ch.push({ w: 'sq', duty: 50, v: .03, cut: 2600, vib: .6, m: 'r:96 ' + 'r:6 A5:2 D6:2 D6:2 r:12 r:6 F6:2 E6:2 C6:2 r:12 r:6 A5:2 D6:2 F6:2 r:12 r:12 r:6 C#6:2 E6:2 A5:2' });
  return s;
}
// the Kraken (round 33, Roy: eerie horror 8-bit). A slow creeping ostinato on the triangle (D, its minor second Eb, the
// tritone Ab below), a detuned 12% pulse lead with a deep slow vibrato that sighs in minor seconds and tritones, sparse
// noise hits and swells. It builds as the arms strike: c.lay channels sound only as the song's intensity reaches them
// (audio.js setIntensity, driven by sound.js): layer 1 a canon of the lead an octave up and a little out of tune, a
// rolled cluster and a heartbeat on the toms; layer 2 the drive (kick, snare), tritone stabs and swells every two bars.
// kraken_rise is the approach: the ostinato alone, under swells, a faint lead far off.
function krakenSongs() {
  const osA = 'D2:2 r:2 D2:2 Eb2:2 D2:2 r:2 Ab1:2 r:2', osA2 = 'D2:2 r:2 D2:2 Eb2:2 D2:2 r:2 G#1:2 A1:2';
  const osB = 'Eb2:2 r:2 Eb2:2 E2:2 Eb2:2 r:2 A1:2 r:2', osB2 = 'Eb2:2 r:2 Eb2:2 E2:2 Eb2:2 r:2 A1:2 Bb1:2';
  const fall = 'D2:2 C#2:2 C2:2 B1:2 Bb1:2 A1:2 Ab1:2 A1:2';
  const bass = [osA, osA, osA, osA2, osA, osA, osA, osA2, osB, osB, osB, osB2, osA, osA, osA2, fall].join(' ');
  const lead = 'r:16 A4:12 Bb4:4 Ab4:16 G4:8 r:8 r:8 D5:8 Eb5:12 D5:4 Ab4:8 A4:8 r:16 '
    + 'Bb4:12 A4:4 E5:16 Eb5:8 D5:8 A4:16 r:8 F5:4 E5:4 Eb5:16 D5:8 C#5:4 C5:4 Ab4:12 r:4';
  const canon = 'r:3 ' + firstBars(lead, 253).split(' ').map((x) => { const [n, l] = x.split(':'); if (n === 'r') return x; const m = /^([A-G][#b]?)(\d)$/.exec(n); return m[1] + (+m[2] + 1) + ':' + l; }).join(' ');
  const cl = ['D4+Eb4+Ab4', 'D4+Ab4+A4', 'D4+Eb4+Ab4', 'C#4+D4+Ab4', 'Eb4+E4+A4', 'Eb4+A4+Bb4', 'D4+Eb4+Ab4', 'C#4+D4+G4'];
  const arp = cl.map((c) => c + ':32').join(' ');
  const stab = rep('r:8 Ab5:1 r:1 Ab5:1 r:1 D6:1 r:1 Ab5:1 r:1', 16);
  const swell0 = rep('r:48 A4:16', 4), swell2 = rep('r:16 D5:16', 8);
  const dr0 = ['z...............', '................', '................', '........u.......', '................', '........u.......', '................', '............u...',
    'z...............', '................', '....u...........', '................', '................', '....u.......u...', '................', 'u...u...u.u.u...'].join('');
  const beat = 'm..m............'.repeat(16), drive = 'q...x...q.q.x...'.repeat(7) + 'q...x...q.x.x.xx' + 'q...x...q.q.x...'.repeat(7) + 'q.x.x.x.xxxxzxxx';
  checkLen('kraken lead', lead, 256); checkLen('kraken bass', bass, 256); checkLen('kraken canon', canon, 256);
  const kraken = { bpm: 72, rev: 1.2, bar: 16, chip: true, battle: true, lv: 1.25, ch: [
    { w: 'sq', duty: 12, v: .1, cut: 2000, vib: 2.6, vr: 3.8, det: 9, slide: .06, echo: [6, .35, .32], m: lead },
    { w: 'tri', v: .12, grit: .32, m: bass },
    { w: 'nz', v: .05, cut: 2600, q: 2.5, a: .9, r: .3, m: swell0 },
    { d: dr0, v: .55 },
    { w: 'sq', duty: 25, v: .07, cut: 2200, vib: 3, vr: 4.4, det: -16, slide: .06, lay: 1, m: canon },
    { w: 'arp', duty: 25, v: .05, cut: 1500, ar: 1, lay: 1, m: arp },
    { d: beat, v: .85, lay: 1 },
    { d: drive, v: .75, lay: 2 },
    { w: 'pl', duty: 25, v: .065, cut: 1900, dk: .12, lay: 2, m: stab },
    { w: 'nz', v: .075, cut: 2400, q: 3, a: .85, r: .2, lay: 2, m: swell2 },
  ] };
  const rise = { bpm: 66, rev: 1.5, bar: 16, chip: true, lv: 1.25, ch: [
    { w: 'tri', v: .13, grit: .25, m: [osA, osA, osA, osA2, osA, osA, osA, osA2].join(' ') },
    { w: 'nz', v: .055, cut: 2200, q: 2, a: .9, r: .4, m: rep('r:32 D5:32', 2) },
    { w: 'sq', duty: 12, v: .05, cut: 1600, vib: 3, vr: 3.4, det: 12, slide: .08, echo: [6, .45, .45], m: 'r:48 A4:12 Bb4:4 r:16 r:16 Ab4:24 r:8' },
    { d: 'z...............' + '................'.repeat(3) + '........u.......' + '................'.repeat(2) + 'u.......u...u...', v: .5 },
  ] };
  return { kraken, kraken_rise: rise };
}

// every song this module makes (the cities' own come later, citySongs)
export function buildMusic() {
  const S = {};
  for (const [id, R] of Object.entries(REGION_TUNES)) { S['rx_' + id] = exploreSong(id, R); S['rn_' + id] = nightSong(id, R); S['rc_' + id] = combatSong(id, R); }
  for (const [id, V] of Object.entries(REALM_VARIANTS)) {
    const R = REGION_TUNES[V.base], o = { bpm: V.bpm };
    if (V.lead) o.lead = V.lead; if (V.light) o.light = true; if (V.leadEcho) o.lead = { ...(o.lead || {}), echo: V.leadEcho };
    const s = exploreSong(id, R, o); if (V.tr) s.tr = V.tr; S['rx_' + id] = s;
  }
  for (const id of TOWN_THEME_IDS) { S['tw_' + id] = townSong(id); S['twc_' + id] = townCombat(id); }
  S.ship = shipSong();
  Object.assign(S, krakenSongs());
  return S;
}
// (tools) how well a tune sits on its chords: the share of downbeats that are chord tones
export function chordFit(mel, progStr, m = 16) {
  const prog = parseProg(progStr); let pos = 0, hit = 0, all = 0; const bad = [];
  for (const t of mel.trim().split(/\s+/)) {
    const [a, l] = t.split(':'), len = parseInt(l || '1');
    if (a !== 'r' && pos % (m / 2) === 0) {
      const bar = Math.floor(pos / m), b = prog[bar]; if (b) {
        const sym = b[Math.min(b.length - 1, Math.floor((pos % m) / (m / b.length)))], { root, iv } = chordTones(sym);
        const mm = /^([A-G])(#|b)?(-?\d)$/.exec(a); const pc = (SEMI[mm[1]] + (mm[2] === '#' ? 1 : mm[2] === 'b' ? -1 : 0) + 12) % 12;
        all++; if (iv.some((x) => (root + x) % 12 === pc)) hit++; else bad.push(`bar ${bar + 1} ${a} on ${sym}`);
      }
    }
    pos += len;
  }
  return { fit: all ? hit / all : 1, bad };
}
