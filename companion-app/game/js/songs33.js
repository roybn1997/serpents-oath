// Round 33 (Roy: "the music is not good enough"): the open world's own score. Every town has its own theme and every
// kind of land its own, each with a calm night arrangement and a combat arrangement of the same tune (the same place
// under threat: faster, a driving bass and drums, never the full battle fury; that stays for elites and bosses, see
// battleSong in audio.js). The palette is "Greek 8-bit": soft pulse-wave leads with a little echo and vibrato, a
// triangle bass, pulse arpeggios, a lyre counter-voice and the frame-drum kit, mixed gently for long listening.
// Every melody is 16 bars (12 steps a bar in 6/8, else 16), one chord a bar. Pure data: audio.js prepares the songs.

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
const nm = (m) => NOTE[m % 12] + (Math.floor(m / 12) - 1);
// 'F#m' -> { root midi (octave 2), tones [semitones] }
function chord(name) {
  const r = /^([A-G])(#|b)?(.*)$/.exec(name), q = r[3];
  const root = 36 + SEMI[r[1]] + (r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0);
  const tones = q === 'm' ? [0, 3, 7] : q === 'dim' ? [0, 3, 6] : q === 'sus4' ? [0, 5, 7] : q === '7' ? [0, 4, 7, 10] : q === 'm7' ? [0, 3, 7, 10] : [0, 4, 7];
  return { root, tones };
}
// a chord's tones spread from a floor midi upward: idx 0.. walks up the chord
const voice = (c, floor, n) => { const out = []; let m = c.root; while (m < floor) m += 12; const base = m - ((m - c.root) % 12); for (let o = 0; out.length < n; o += 12) for (const t of c.tones) { const x = base + o + t; if (x >= floor && out.length < n) out.push(x); } return out; };

// arrangement patterns. Each is a function (chord, bar, steps) -> melody string for one bar
const BASS = {
  calm: (c, i, S) => S === 12 ? `${nm(c.root)}:6 ${nm(c.root + 7)}:6` : `${nm(c.root)}:8 ${nm(c.root + 7)}:8`,
  walk: (c, i, S) => S === 12 ? `${nm(c.root)}:4 ${nm(c.root + 7)}:2 ${nm(c.root + 12)}:4 ${nm(c.root + 7)}:2` : `${nm(c.root)}:4 ${nm(c.root + 7)}:4 ${nm(c.root + 12)}:4 ${nm(c.root + 7)}:4`,
  bounce: (c, i, S) => S === 12 ? `${nm(c.root)}:3 r:3 ${nm(c.root + 7)}:3 r:3` : `${nm(c.root)}:2 r:2 ${nm(c.root + 12)}:2 r:2 ${nm(c.root + 7)}:2 r:2 ${nm(c.root + 12)}:2 r:2`,
  drone: (c, i, S) => `${nm(c.root)}:${S}`,
  drive: (c, i, S) => Array(S / 2).fill(0).map((_, k) => `${nm(c.root + (k % 4 === 3 ? 7 : k % 8 === 6 ? 12 : 0))}:2`).join(' '),
};
const ARP = {
  up: (c, i, S) => { const v = voice(c, 55, 4); return S === 12 ? [0, 1, 2, 3, 2, 1].map((k) => `${nm(v[k])}:2`).join(' ') : [0, 1, 2, 3, 2, 1, 2, 3].map((k) => `${nm(v[k])}:2`).join(' '); },
  wave: (c, i, S) => { const v = voice(c, 52, 5); return S === 12 ? [0, 2, 4, 3, 2, 1].map((k) => `${nm(v[k])}:2`).join(' ') : [0, 2, 4, 2, 1, 3, 4, 3].map((k) => `${nm(v[k])}:2`).join(' '); },
  chop: (c, i, S) => { const v = voice(c, 57, 3).map(nm).join('+'); return S === 12 ? `r:3 ${v}:2 r:1 r:3 ${v}:2 r:1` : `r:4 ${v}:2 r:2 r:4 ${v}:2 r:2`; },
  bell: (c, i, S) => { const v = voice(c, 64, 3); return i % 2 ? `r:${S}` : `${nm(v[2] + 12)}:4 r:${S - 4}`; },
  sparse: (c, i, S) => { const v = voice(c, 57, 4); return `${nm(v[0])}:4 r:2 ${nm(v[2])}:4 r:${S - 10}`; },
  fast: (c, i, S) => { const v = voice(c, 60, 4); return Array(S / 1).fill(0).map((_, k) => `${nm(v[[0, 1, 2, 3, 2, 1][k % 6]])}:1`).join(' '); },
};
const PADV = (c) => voice(c, 52, 3).map(nm).join('+');
// frame-drum kit strings, one bar each (k doum, s tek, h jingle, t tambourine, b big drum, c cymbal, r clappers)
const DRUM = {
  16: { calm: 'k.......s.......', walk: 'k.....h.s.....h.', dance: 'k..k..h.s...h.h.', market: 'k.h.k.h.s.h.k.hs', shrine: 'b.......k...s...', dusk: 'k...........s...', combat: 'k.hsk.h.s.hkk.hs', combatHeavy: 'b.hsk.hks.hkb.ss', march: 'b.k.s...b.k.s.k.', fill: 'k.h.s.h.s.s.sss.' },
  12: { calm: 'k.....s.....', march: 'b..k..s..k.s', market: 'k.hk.hs.hk.h', walk: 'k..h.hs..h.h', dance: 'k.hh.hs.hh.h', combat: 'k.hsk.s.hsks', fill: 'k.h.s.s.sss.' },
};
const drumLine = (S, kind, bars) => { const D = DRUM[S], p = D[kind] || D.calm; let out = ''; for (let i = 0; i < bars; i++) out += (i % 8 === 7 && kind !== 'calm' && kind !== 'dusk' && kind !== 'shrine') ? (D.fill || p) : p; return out; };
const bars = (prog, f, S) => prog.map((c, i) => f(chord(c), i, S)).join(' ');
const octave = (mel, d) => mel.replace(/([A-G][#b]?)(-?\d)/g, (_, n, o) => n + (parseInt(o) + d));

// one theme in its three arrangements: explore (day), night, combat
function theme(T) {
  const S = T.steps || 16, P = T.prog, n = P.length, lead = T.lead || 'pulse25';
  const day = { bpm: T.bpm, rev: T.rev ?? .9, ch: [
    { w: lead, v: T.lv ?? .055, vib: 1, echo: .28, cut: T.cut || 3000, pan: -.08, m: T.mel },
    { w: 'lyre', v: .16, ring: .4, pan: .12, m: `r:${S * 8} ${octave(T.mel.split(' ').slice(0, T.halfIdx || 0).join(' ') || '', -1)}`.trim() },
    { w: 'pulse12', v: .03, cut: 2200, env: 'pluck', dec: .22, pan: .28, m: bars(P, ARP[T.arp || 'up'], S) },
    { w: 'triangle', v: .16, cut: 1400, m: bars(P, BASS[T.bass || 'walk'], S) },
    { w: 'pad', v: T.pad ?? .035, cut: 1300, att: .8, rel: 1.2, m: P.map((c) => `${PADV(chord(c))}:${S}`).join(' ') },
    { d: drumLine(S, T.drum || 'walk', n), v: T.dv ?? .4 },
  ] };
  if (!T.halfIdx) day.ch.splice(1, 1); // (a lyre doubling only where a theme asks for one)
  const night = { bpm: Math.round(T.bpm * .88), rev: (T.rev ?? .9) * 1.35, ch: [
    { w: 'aulos', v: .11, cut: 2000, vib: 1.3, pan: -.1, m: T.mel },
    { w: 'lyre', v: .2, ring: .9, pan: .15, m: bars(P, ARP.sparse, S) },
    { w: 'kith', v: .32, sub: .1, ring: 1.2, m: bars(P, BASS.calm, S) },
    { w: 'pad', v: (T.pad ?? .035) * 1.3, cut: 1000, att: 1.4, rel: 2, m: P.map((c) => `${PADV(chord(c))}:${S}`).join(' ') },
    { d: drumLine(S, 'calm', n).replace(/s/g, '.'), v: .3 },
  ] };
  const combat = { bpm: Math.round(T.bpm * (T.cbpm || 1.22)), rev: .55, battle: true, ch: [
    { w: lead, v: (T.lv ?? .055) * 1.05, vib: .6, echo: .18, cut: (T.cut || 3000) * 1.1, pan: -.08, m: T.mel },
    { w: 'pulse12', v: .028, cut: 2400, env: 'pluck', dec: .12, pan: .25, m: bars(P, ARP.fast, S) },
    { w: 'triangle', v: .17, cut: 1500, m: bars(P, BASS.drive, S) },
    { w: 'kith', v: .26, ring: .1, poly: 4, m: bars(P, (c, i, s) => `${nm(c.root)}:${s / 2} ${nm(c.root)}:${s / 2}`, S) },
    { d: drumLine(S, T.cdrum || 'combat', n), v: .48 },
  ] };
  if (T.gain) for (const a of [day, night, combat]) for (const c of a.ch) c.v *= T.gain; // (a quieter theme: Elaia, the home town)
  return { day, night, combat };
}

const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const THEMES = {
  // ----- five town melodies -----
  // 1. the agora: a warm welcome (G major)
  town_agora: theme({ bpm: 100, prog: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'G', 'G'], arp: 'up', bass: 'walk', drum: 'dance', halfIdx: 0,
    mel: 'B4:4 D5:4 G5:6 F#5:2 E5:4 D5:4 A4:8 B4:4 C5:2 B4:2 G4:4 E4:4 G4:6 A4:2 E4:8 B4:4 D5:4 G5:4 B5:4 A5:6 G5:2 F#5:4 E5:4 E5:4 G5:4 E5:2 D5:2 C5:4 D5:12 r:4 '
      + 'G5:6 F#5:2 E5:4 B4:4 C5:4 E5:4 G5:8 D5:6 B4:2 G4:4 B4:4 A4:4 D5:4 F#5:8 E5:4 G5:4 C6:6 B5:2 A5:4 F#5:4 D5:8 B4:2 D5:2 G5:4 F#5:2 E5:2 D5:4 G5:12 r:4' }),
  // 2. the market: bright and bouncing (D major)
  town_market: theme({ bpm: 120, prog: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'A', 'G', 'A', 'F#m', 'Bm', 'G', 'Em', 'A', 'D'], arp: 'chop', bass: 'bounce', drum: 'market', lead: 'pulse50', lv: .045,
    mel: 'A4:2 D5:2 F#5:2 A5:2 r:2 F#5:2 E5:2 D5:2 B4:3 D5:3 G5:2 F#5:4 E5:4 C#5:2 E5:2 A5:4 G5:2 F#5:2 E5:4 F#5:6 D5:2 A4:8 B4:2 D5:2 F#5:2 B5:2 r:2 A5:2 F#5:2 D5:2 G5:3 F#5:3 E5:2 D5:4 B4:4 C#5:2 E5:2 A5:2 E5:2 C#5:2 E5:2 A4:4 E5:12 r:4 '
      + 'D5:4 G5:4 B5:4 A5:2 G5:2 A5:6 E5:2 C#5:8 C#5:4 F#5:4 A5:4 G5:2 F#5:2 F#5:6 E5:2 D5:4 B4:4 G4:2 B4:2 D5:2 G5:2 r:2 F#5:2 G5:2 A5:2 B5:4 A5:2 G5:2 E5:8 C#5:2 D5:2 E5:2 F#5:2 G5:2 A5:2 G5:2 E5:2 D5:12 r:4' }),
  // 3. the harbour: a lilting 6/8 by the water (F major)
  town_harbour: theme({ bpm: 92, steps: 12, prog: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'F', 'F'], arp: 'wave', bass: 'walk', drum: 'dance', lead: 'pulse25', rev: 1.1,
    mel: 'A4:4 C5:2 F5:4 E5:2 G5:4 E5:2 C5:6 D5:4 F5:2 A5:4 G5:2 F5:6 D5:4 r:2 C5:4 F5:2 A5:4 G5:2 E5:4 G5:2 C6:4 Bb5:2 A5:4 G5:2 F5:4 D5:2 E5:10 r:2 '
      + 'F5:4 E5:2 D5:4 A4:2 Bb4:4 D5:2 F5:6 A5:4 G5:2 F5:4 C5:2 E5:4 D5:2 C5:6 D5:4 F5:2 Bb5:4 A5:2 G5:4 E5:2 C5:4 E5:2 F5:4 A5:2 C6:4 A5:2 F5:10 r:2' }),
  // 4. the shrine town of the hills: modal and still (A dorian)
  town_shrine: theme({ bpm: 88, prog: ['Am', 'D', 'Am', 'G', 'Am', 'D', 'F', 'G', 'C', 'G', 'Am', 'Em', 'F', 'G', 'Am', 'Am'], arp: 'wave', bass: 'calm', drum: 'shrine', lead: 'pulse25', rev: 1.3, halfIdx: 0,
    mel: 'E5:4 A5:4 G5:2 F#5:2 E5:4 F#5:6 E5:2 D5:8 C5:4 E5:4 A4:8 B4:4 D5:4 G5:6 F#5:2 E5:6 D5:2 C5:4 E5:4 F#5:4 A5:4 G5:2 F#5:2 E5:4 F5:4 A5:4 C6:4 A5:4 G5:12 r:4 '
      + 'E5:4 G5:4 C6:6 B5:2 B5:4 G5:4 D5:8 C5:4 E5:4 A5:4 G5:2 E5:2 G5:6 F#5:2 E5:8 A4:4 C5:4 F5:4 E5:2 D5:2 D5:4 B4:4 G4:4 B4:4 A4:2 C5:2 E5:2 A5:2 G5:2 F#5:2 E5:4 A4:12 r:4' }),
  // 5. the dusk town: lovely, with a shadow in it (E harmonic minor)
  town_dusk: theme({ bpm: 74, prog: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'D', 'B', 'Am', 'Em', 'C', 'B', 'Am', 'B', 'Em', 'Em'], arp: 'wave', bass: 'calm', drum: 'dusk', lead: 'pulse25', rev: 1.4, pad: .045,
    mel: 'B4:6 E5:2 G5:4 F#5:4 E5:4 G5:4 C5:8 A4:4 C5:4 E5:4 D#5:2 E5:2 F#5:8 D#5:4 B4:4 E5:6 F#5:2 G5:4 B5:4 A5:4 G5:4 E5:8 F#5:4 A5:4 D5:4 F#5:4 D#5:12 r:4 '
      + 'C6:6 B5:2 A5:4 E5:4 G5:6 F#5:2 E5:8 E5:4 G5:4 C6:4 B5:2 A5:2 B5:8 F#5:4 D#5:4 A5:4 C6:4 B5:2 A5:2 G5:4 F#5:4 D#5:4 B4:8 E5:4 G5:4 B5:4 A5:2 G5:2 E5:12 r:4' }),

  // ----- the lands between the towns -----
  // meadows, olive groves and farms: open and pastoral (C major)
  reg_meadow: theme({ bpm: 92, prog: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'C', 'C'], arp: 'up', bass: 'walk', drum: 'walk', lead: 'pulse25',
    mel: 'E5:4 G5:4 C6:4 G5:4 D5:4 G5:4 B5:6 A5:2 A5:4 E5:4 C5:8 F5:4 A5:4 G5:2 F5:2 E5:4 G5:6 E5:2 C5:4 E5:4 D5:4 B4:4 G4:8 A4:4 C5:4 F5:4 A5:4 G5:12 r:4 '
      + 'C6:6 B5:2 A5:4 E5:4 F5:6 E5:2 D5:4 C5:4 E5:4 G5:4 C6:4 E6:4 D6:6 B5:2 G5:8 A5:4 F5:4 C5:4 F5:4 G5:4 D5:4 B4:4 D5:4 C5:2 E5:2 G5:2 C6:2 B5:2 G5:2 E5:4 C5:12 r:4' }),
  // forests and pine woods: flowing and a little secret (E minor)
  reg_grove: theme({ bpm: 84, prog: ['Em', 'D', 'C', 'D', 'Em', 'D', 'C', 'B', 'G', 'D', 'Em', 'C', 'Am', 'D', 'Em', 'Em'], arp: 'wave', bass: 'calm', drum: 'calm', lead: 'pulse25', rev: 1.2,
    mel: 'B4:4 E5:4 F#5:2 G5:2 F#5:4 A5:6 F#5:2 D5:8 E5:4 G5:4 C5:4 E5:4 F#5:12 r:4 G5:4 B5:4 A5:2 G5:2 F#5:4 F#5:4 A5:4 D5:8 C5:4 E5:4 G5:4 E5:4 D#5:12 r:4 '
      + 'D5:4 G5:4 B5:6 A5:2 A5:4 F#5:4 D5:8 E5:4 G5:4 B5:4 G5:4 C6:6 B5:2 G5:8 A5:4 E5:4 C5:4 E5:4 F#5:6 E5:2 D5:8 E5:2 F#5:2 G5:2 B5:2 A5:2 G5:2 F#5:4 E5:12 r:4' }),
  // beaches and shores: bright, breezy, lydian (F)
  reg_coast: theme({ bpm: 104, prog: ['F', 'G', 'C', 'F', 'F', 'G', 'Am', 'C', 'Bb', 'C', 'F', 'Dm', 'G', 'C', 'F', 'F'], arp: 'up', bass: 'bounce', drum: 'walk', lead: 'pulse50', lv: .045, rev: 1.1,
    mel: 'C5:2 F5:2 A5:4 G5:4 F5:4 B5:6 A5:2 G5:4 D5:4 E5:4 G5:4 C6:8 A5:6 G5:2 F5:8 A4:2 C5:2 F5:4 E5:2 F5:2 A5:4 B5:4 D6:4 B5:4 G5:4 A5:4 E5:4 C5:4 E5:4 G5:12 r:4 '
      + 'F5:4 D5:4 Bb4:4 D5:4 E5:4 G5:4 C6:4 G5:4 A5:6 G5:2 F5:4 C5:4 D5:4 F5:4 A5:8 B5:4 A5:2 G5:2 D5:8 E5:4 G5:4 C6:4 E6:4 F6:4 C6:4 A5:4 C6:4 F5:12 r:4' }),
  // hills, rock and the high passes: wide and slow (D mixolydian)
  reg_highland: theme({ bpm: 72, prog: ['D', 'C', 'G', 'D', 'D', 'C', 'Am', 'D', 'C', 'G', 'D', 'C', 'G', 'C', 'D', 'D'], arp: 'sparse', bass: 'drone', drum: 'shrine', lead: 'pulse25', rev: 1.6, pad: .045,
    mel: 'A4:8 D5:4 E5:4 G5:8 E5:4 C5:4 D5:8 B4:4 G4:4 A4:16 F#5:4 A5:4 D6:8 C6:6 B5:2 G5:8 A5:6 G5:2 E5:4 C5:4 D5:16 '
      + 'E5:4 G5:4 C6:4 B5:4 B5:8 G5:4 D5:4 F#5:4 A5:4 D6:4 C6:4 C6:8 G5:8 B5:4 G5:4 D5:4 B4:4 C5:4 E5:4 G5:8 A5:6 G5:2 F#5:4 E5:4 D5:12 r:4' }),
  // marshes: wet, hushed, uneasy (F# minor)
  reg_marsh: theme({ bpm: 70, prog: ['F#m', 'D', 'Bm', 'C#', 'F#m', 'D', 'E', 'C#', 'D', 'Bm', 'F#m', 'C#', 'D', 'E', 'F#m', 'F#m'], arp: 'sparse', bass: 'drone', drum: 'dusk', lead: 'pulse12', lv: .05, rev: 1.6, pad: .05, cbpm: 1.3,
    mel: 'C#5:6 r:2 A4:4 F#4:4 A4:8 r:8 D5:6 C#5:2 B4:8 G#4:12 r:4 F#5:6 E5:2 C#5:8 D5:4 F#5:4 A5:8 G#5:6 F#5:2 E5:8 G#5:12 r:4 '
      + 'A5:6 F#5:2 D5:8 B4:4 D5:4 F#5:8 A5:6 G#5:2 F#5:8 C#5:4 G#4:4 C#5:8 D5:4 F#5:4 A5:4 G#5:4 G#5:6 B5:2 E5:8 F#5:4 A5:4 C#6:8 F#5:12 r:4' }),
  // barrows, the dead heroes' road, scorched and dark lands: spooky bells (D harmonic minor)
  reg_barrow: theme({ bpm: 66, prog: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Gm', 'Dm', 'Bb', 'A', 'Gm', 'A', 'Dm', 'Dm'], arp: 'bell', bass: 'drone', drum: 'dusk', lead: 'pulse12', lv: .05, rev: 1.8, pad: .055, cbpm: 1.35, cdrum: 'combatHeavy',
    mel: 'D5:6 F5:2 A5:8 Bb5:6 A5:2 F5:8 G5:4 Bb5:4 D5:8 C#5:12 r:4 A5:6 G5:2 F5:4 E5:4 D5:4 F5:4 Bb4:8 G4:4 Bb4:4 D5:4 E5:4 C#5:8 E5:4 A5:4 '
      + 'Bb5:6 A5:2 G5:8 F5:6 E5:2 D5:8 D5:4 F5:4 Bb5:4 A5:4 E5:4 G5:4 C#6:8 D6:6 C6:2 Bb5:8 A5:6 G5:2 E5:4 C#5:4 D5:4 F5:4 A5:4 G5:2 E5:2 D5:12 r:4' }),
};

// ----- a theme of its own for every town, landmark and realm -----
// Round 33b (Roy: "every town, not five"; "the underworld too, everything needs music"): the rest of the world's themes
// are composed here from a short brief per place (key, mode, tempo, metre, feel, voices). The composer writes a
// 16-bar song form A A' B A'' over the place's chord progression: a two-bar rhythmic motif and its melodic shape are
// fixed by a hash of the place's name, then carried onto each new chord (the same tune sequenced through the harmony),
// long notes always land on chord tones, the B section climbs higher, phrase ends breathe, and the last bar comes home.
const MODES = { ion: [0, 2, 4, 5, 7, 9, 11], dor: [0, 2, 3, 5, 7, 9, 10], phr: [0, 1, 3, 5, 7, 8, 10], lyd: [0, 2, 4, 6, 7, 9, 11], mix: [0, 2, 4, 5, 7, 9, 10], aeo: [0, 2, 3, 5, 7, 8, 10], hm: [0, 2, 3, 5, 7, 8, 11], hij: [0, 1, 4, 5, 7, 8, 10] };
// progressions as scale degrees (0 = the tonic), one chord a bar, 16 bars
const PROGS = {
  pop: [0, 4, 5, 3, 0, 4, 3, 4, 5, 3, 0, 4, 3, 4, 0, 0], hymn: [0, 3, 4, 0, 5, 3, 4, 4, 3, 4, 5, 2, 3, 4, 0, 0],
  minor: [0, 5, 3, 4, 0, 5, 6, 4, 5, 2, 0, 4, 5, 4, 0, 0], modal: [0, 6, 0, 3, 0, 6, 3, 4, 2, 3, 0, 6, 3, 6, 0, 0],
  dance: [0, 0, 4, 4, 0, 0, 4, 0, 3, 3, 0, 0, 4, 4, 0, 0], walk: [0, 2, 3, 4, 0, 2, 5, 4, 3, 0, 5, 4, 3, 4, 0, 0],
  hijaz: [0, 1, 0, 6, 0, 1, 3, 0, 3, 6, 1, 0, 3, 1, 0, 0], drone: [0, 0, 6, 0, 0, 3, 6, 0, 5, 6, 0, 3, 6, 6, 0, 0],
  lyd: [0, 1, 4, 0, 0, 1, 5, 4, 5, 1, 0, 4, 1, 4, 0, 0], phr: [0, 1, 6, 0, 0, 1, 3, 0, 5, 6, 1, 0, 3, 1, 0, 0],
};
const RHY = {
  16: { lyr: [[4, 4, 6, 2], [6, 2, 8], [4, 4, 8], [2, 2, 4, 8], [8, 4, 4], [6, 2, 4, 4], [4, 2, 2, 8], [4, 4, 4, 4]],
    liv: [[2, 2, 2, 2, 4, 4], [3, 3, 2, 4, 4], [2, 2, 4, 2, 2, 4], [4, 2, 2, 4, 4], [2, 2, 2, 2, 8], [3, 3, 2, 2, 2, 4], [4, 4, 2, 2, 4]],
    endLyr: [[4, 12], [8, 8], [2, 2, 12], [6, 10]], endLiv: [[2, 2, 12], [4, 12], [2, 2, 4, 8], [3, 3, 10]] },
  12: { lyr: [[4, 2, 4, 2], [6, 4, 2], [4, 2, 6], [6, 6], [2, 2, 2, 6]],
    liv: [[2, 2, 2, 4, 2], [4, 2, 4, 2], [3, 1, 2, 4, 2], [2, 2, 2, 2, 2, 2], [4, 2, 2, 2, 2]],
    endLyr: [[6, 6], [4, 2, 6], [12]], endLiv: [[2, 2, 8], [4, 2, 6], [2, 2, 2, 6]] },
};
function rng(seed) { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, L) => L[Math.floor(r() * L.length)];
function compose(id, B) {
  const r = rng('song:' + id), S = B.steps || 16, sc = MODES[B.mode], tonic = SEMI[B.key[0]] + (B.key[1] === '#' ? 1 : B.key[1] === 'b' ? -1 : 0);
  const degs = PROGS[B.prog];
  // chords from the degrees: a triad on each, a minor v raised to a major V where the brief asks (B.V)
  const tri = (d) => { const at = (k) => sc[(d + k) % 7] + ((d + k) >= 7 ? 12 : 0), i3 = at(2) - at(0), i5 = at(4) - at(0);
    let q = i3 === 3 ? (i5 === 6 ? 'dim' : 'm') : ''; if (d === 4 && q === 'm' && B.V) q = ''; return NOTE[(tonic + sc[d]) % 12] + q; };
  const prog = degs.map(tri);
  const T0 = 48 + (tonic % 12);
  const raise = (bar, d) => B.V && degs[bar] === 4 && ((d % 7) + 7) % 7 === 6 ? 1 : 0; // the leading tone over a raised V
  const midi = (i, bar) => T0 + 12 * Math.floor(i / 7) + sc[((i % 7) + 7) % 7] + raise(bar, i);
  const tones = (bar) => [0, 2, 4].map((k) => (degs[bar] + k) % 7);
  const isCT = (i, bar) => tones(bar).includes(((i % 7) + 7) % 7);
  const nearCT = (i, bar, up) => { for (let k = 0; k < 4; k++) for (const s of up ? [k, -k] : [-k, k]) if (isCT(i + s, bar)) return i + s; return i; };
  let LO = 0; while (midi(LO, 0) < 64) LO++; let HI = LO; while (midi(HI + 1, 0) <= 88) HI++; // the lead sings between E4 and E6
  const clamp = (i) => Math.max(LO, Math.min(HI, i)), off = LO - 4;
  const feel = B.feel === 'liv' ? 'liv' : 'lyr', R = RHY[S];
  const rA = pick(r, R[feel]), rB = pick(r, R[feel]), rC = pick(r, R[feel]), rD = pick(r, R[feel]);
  const eA = pick(r, R[feel === 'liv' ? 'endLiv' : 'endLyr']), eB = pick(r, R[feel === 'liv' ? 'endLiv' : 'endLyr']);
  const shape = (n) => { const out = [0]; let last = 0; for (let k = 1; k < n; k++) { let d; const x = r();
    d = Math.abs(last) >= 2 ? -Math.sign(last) * (x < .7 ? 1 : 2) : x < .32 ? 1 : x < .64 ? -1 : x < .76 ? 2 : x < .88 ? -2 : x < .94 ? 0 : (r() < .5 ? 3 : -3); out.push(d); last = d; } return out; };
  const shp = new Map(); const shapeOf = (rh) => { if (!shp.has(rh)) shp.set(rh, shape(rh.length)); return shp.get(rh); };
  // the plan: [rhythm, aim of its first note, kind of ending]
  const fin = S === 16 ? [12] : [10];
  const plan = [[rA, 6], [rB, 7], [rA, 8], [eA, 7, 'half'], [rA, 6], [rB, 7], [rA, 9], [eB, 7, 'half'],
    [rC, 10], [rD, 11], [rC, 10], [eA, 9, 'half'], [rA, 7], [rB, 8], [rA, 7], [fin, 7, 'home']];
  let prev = LO + Math.floor(r() * 3); const mel = [];
  plan.forEach(([rh, aim, end], bar) => {
    const sh = shapeOf(rh); aim += off; let i = nearCT(clamp(Math.round((prev + aim) / 2)), bar, aim > prev);
    rh.forEach((dur, k) => {
      if (k) i = clamp(i + sh[k]);
      const last = k === rh.length - 1;
      if (dur >= 4 || k === 0 || (last && end)) { const up = k ? sh[k] >= 0 : aim >= prev; i = nearCT(i, bar, up); if (k && sh[k] && i === prev) i = clamp(nearCT(i + (up ? 1 : -1), bar, up)); }
      if (i === prev && !(last && end) && r() > .15) { // (a repeated note only now and then: else step on, the way the shape leans)
        const up = (k ? sh[k] >= 0 : aim >= prev) ? (i < HI ? 1 : -1) : (i > LO ? -1 : 1);
        i = dur >= 4 || k === 0 ? (() => { let j = i + up; while (!isCT(j, bar) && Math.abs(j - i) < 4) j += up; return clamp(j); })() : clamp(i + up);
      }
      if (last && end === 'home') { i = Math.round(i / 7) * 7; if (i < LO) i += 7; }
      mel.push(`${nm(midi(i, bar))}:${dur}`); prev = i;
    });
    if (end === 'home') mel.push(`r:${S - fin[0]}`);
  });
  return theme({ ...B, prog, mel: mel.join(' ') });
}
// the briefs. key, mode, bpm, steps (12 = a 6/8 lilt), progression, feel (lyr calm and singing, liv lively),
// lead voice, arpeggio, bass, drums, reverb; cbpm/cdrum shape the combat arrangement
const BRIEFS = {
  // towns
  kirrha: { key: 'G', mode: 'mix', bpm: 96, steps: 12, prog: 'dance', feel: 'liv', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'dance' },
  larisa: { key: 'D', mode: 'dor', bpm: 116, steps: 12, prog: 'modal', feel: 'liv', lead: 'pulse25', arp: 'up', bass: 'bounce', drum: 'dance' }, // the city of horses: a gallop
  dion: { key: 'Eb', mode: 'lyd', bpm: 84, prog: 'lyd', feel: 'lyr', lead: 'pulse25', arp: 'wave', bass: 'calm', drum: 'walk', rev: 1.3 }, // at the foot of Olympus
  dodona: { key: 'B', mode: 'phr', bpm: 76, prog: 'phr', feel: 'lyr', lead: 'pulse12', arp: 'sparse', bass: 'drone', drum: 'shrine', rev: 1.5 }, // the oak oracle
  sparta: { key: 'C', mode: 'aeo', V: 1, bpm: 108, prog: 'minor', feel: 'liv', lead: 'pulse50', lv: .045, arp: 'chop', bass: 'bounce', drum: 'march' },
  olympia: { key: 'F', mode: 'ion', bpm: 120, prog: 'dance', feel: 'liv', lead: 'pulse50', lv: .045, arp: 'up', bass: 'bounce', drum: 'market' }, // the games
  pylos: { key: 'A', mode: 'ion', bpm: 98, steps: 12, prog: 'pop', feel: 'lyr', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'dance', rev: 1.1 },
  argos: { key: 'E', mode: 'dor', bpm: 94, prog: 'walk', feel: 'liv', lead: 'pulse25', arp: 'chop', bass: 'walk', drum: 'walk' },
  knossos: { key: 'E', mode: 'hij', bpm: 96, prog: 'hijaz', feel: 'liv', lead: 'pulse25', arp: 'up', bass: 'bounce', drum: 'dance' }, // Minoan, eastern
  chania: { key: 'G', mode: 'hm', bpm: 100, steps: 12, prog: 'minor', feel: 'liv', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'dance' },
  naxos: { key: 'C', mode: 'lyd', bpm: 104, steps: 12, prog: 'lyd', feel: 'lyr', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'dance', rev: 1.1 },
  mykonos: { key: 'A', mode: 'mix', bpm: 126, prog: 'dance', feel: 'liv', lead: 'pulse50', lv: .045, arp: 'chop', bass: 'bounce', drum: 'market' }, // windy and festive
  hephaistia: { key: 'F', mode: 'hm', bpm: 72, prog: 'minor', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'bell', bass: 'drone', drum: 'dusk', rev: 1.5, pad: .05, cbpm: 1.3 }, // the forge isle
  rhodos: { key: 'Eb', mode: 'ion', bpm: 104, prog: 'hymn', feel: 'liv', lead: 'pulse50', lv: .045, arp: 'up', bass: 'walk', drum: 'market' }, // the Colossus
  mytilene: { key: 'Ab', mode: 'ion', bpm: 80, steps: 12, prog: 'pop', feel: 'lyr', lead: 'aulos', lv: .1, arp: 'wave', bass: 'calm', drum: 'calm', rev: 1.2 }, // Sappho's island
  ithaca: { key: 'D', mode: 'aeo', V: 1, bpm: 82, steps: 12, prog: 'minor', feel: 'lyr', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'calm', rev: 1.2 }, // the long way home
  thera: { key: 'B', mode: 'dor', bpm: 90, prog: 'modal', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'wave', bass: 'calm', drum: 'walk', rev: 1.3 },
  samos: { key: 'G', mode: 'ion', bpm: 110, steps: 12, prog: 'pop', feel: 'liv', lead: 'pulse50', lv: .045, arp: 'up', bass: 'bounce', drum: 'dance' },
  iolkos: { key: 'C', mode: 'mix', bpm: 102, prog: 'walk', feel: 'liv', lead: 'pulse25', arp: 'up', bass: 'walk', drum: 'march' }, // the Argonauts' port
  pella: { key: 'F#', mode: 'aeo', V: 1, bpm: 92, prog: 'minor', feel: 'lyr', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'walk' },
  kastoria: { key: 'Bb', mode: 'lyd', bpm: 78, steps: 12, prog: 'lyd', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'wave', bass: 'calm', drum: 'calm', rev: 1.4 }, // the lake
  kerkyra: { key: 'E', mode: 'ion', bpm: 100, steps: 12, prog: 'hymn', feel: 'liv', lead: 'pulse25', arp: 'up', bass: 'walk', drum: 'dance' },
  trikka: { key: 'F', mode: 'dor', bpm: 86, prog: 'modal', feel: 'lyr', lead: 'pulse25', arp: 'sparse', bass: 'calm', drum: 'shrine', rev: 1.3 }, // Asclepius
  naupaktos: { key: 'A', mode: 'dor', bpm: 112, prog: 'walk', feel: 'liv', lead: 'pulse50', lv: .045, arp: 'chop', bass: 'bounce', drum: 'market' }, // shipyards
  stymphalos: { key: 'C#', mode: 'phr', bpm: 70, prog: 'phr', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'bell', bass: 'drone', drum: 'dusk', rev: 1.6, pad: .05, cbpm: 1.3 }, // the marsh hamlet
  epidauros: { key: 'G', mode: 'lyd', bpm: 88, prog: 'lyd', feel: 'lyr', lead: 'pulse25', arp: 'wave', bass: 'calm', drum: 'shrine', rev: 1.3 }, // healing and theatre
  gytheion: { key: 'Bb', mode: 'mix', bpm: 100, steps: 12, prog: 'modal', feel: 'liv', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'dance' },
  chios: { key: 'D', mode: 'ion', bpm: 106, prog: 'pop', feel: 'liv', lead: 'pulse25', arp: 'chop', bass: 'bounce', drum: 'walk' },
  kos: { key: 'F', mode: 'mix', bpm: 96, steps: 12, prog: 'dance', feel: 'lyr', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'dance', rev: 1.1 },
  zakros: { key: 'A', mode: 'hij', bpm: 90, steps: 12, prog: 'hijaz', feel: 'liv', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'dance' },
  // landmarks
  lm_temple: { key: 'D', mode: 'dor', bpm: 70, prog: 'modal', feel: 'lyr', lead: 'pulse25', arp: 'sparse', bass: 'calm', drum: 'shrine', rev: 1.6, pad: .05 },
  lm_heroes: { key: 'G', mode: 'hm', bpm: 64, prog: 'minor', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'bell', bass: 'drone', drum: 'dusk', rev: 1.8, pad: .055, cbpm: 1.35, cdrum: 'combatHeavy' },
  lm_acheron: { key: 'Bb', mode: 'phr', bpm: 62, prog: 'phr', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'wave', bass: 'drone', drum: 'dusk', rev: 1.8, pad: .05, cbpm: 1.35 },
  lm_library: { key: 'F', mode: 'lyd', bpm: 76, prog: 'lyd', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'sparse', bass: 'calm', drum: 'calm', rev: 1.5 },
  lm_omphalos: { key: 'C#', mode: 'dor', bpm: 72, prog: 'drone', feel: 'lyr', lead: 'pulse25', arp: 'sparse', bass: 'drone', drum: 'shrine', rev: 1.7, pad: .05 },
  lm_olympus: { key: 'C', mode: 'lyd', bpm: 80, prog: 'hymn', feel: 'lyr', lead: 'pulse50', lv: .045, arp: 'up', bass: 'walk', drum: 'shrine', rev: 1.6 },
  lm_labyrinth: { key: 'E', mode: 'hij', bpm: 88, prog: 'hijaz', feel: 'liv', lead: 'pulse12', lv: .05, arp: 'chop', bass: 'drone', drum: 'dusk', rev: 1.4, cbpm: 1.3, cdrum: 'combatHeavy' },
  lm_noreturn: { key: 'B', mode: 'phr', bpm: 66, prog: 'phr', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'bell', bass: 'drone', drum: 'dusk', rev: 1.8, pad: .055, cbpm: 1.35 },
  lm_gorgon: { key: 'F#', mode: 'hm', bpm: 70, prog: 'minor', feel: 'lyr', lead: 'pulse25', arp: 'wave', bass: 'calm', drum: 'dusk', rev: 1.6, cbpm: 1.3, cdrum: 'combatHeavy' },
  lm_hesperides: { key: 'Ab', mode: 'ion', bpm: 82, prog: 'hymn', feel: 'lyr', lead: 'pulse25', arp: 'wave', bass: 'calm', drum: 'calm', rev: 1.4 },
  lm_whirlpool: { key: 'D', mode: 'aeo', V: 1, bpm: 96, steps: 12, prog: 'minor', feel: 'liv', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'dance', rev: 1.4 },
  // realms
  rl_underworld: { key: 'C', mode: 'hm', bpm: 60, prog: 'minor', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'bell', bass: 'drone', drum: 'dusk', rev: 1.9, pad: .06, cbpm: 1.4, cdrum: 'combatHeavy' }, // the halls of Hades
  rl_tartarus: { key: 'A', mode: 'phr', bpm: 76, prog: 'phr', feel: 'liv', lead: 'pulse12', lv: .05, arp: 'chop', bass: 'drone', drum: 'dusk', rev: 1.7, pad: .06, cbpm: 1.35, cdrum: 'combatHeavy' }, // deeper down
  rl_cave: { key: 'Eb', mode: 'aeo', bpm: 66, prog: 'drone', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'sparse', bass: 'drone', drum: 'calm', rev: 1.9, pad: .05, cbpm: 1.35 },
  rl_temple: { key: 'G', mode: 'ion', bpm: 66, prog: 'hymn', feel: 'lyr', lead: 'pulse25', arp: 'sparse', bass: 'calm', drum: 'shrine', rev: 1.8, pad: .05 },
  rl_isle: { key: 'Bb', mode: 'dor', bpm: 92, steps: 12, prog: 'modal', feel: 'liv', lead: 'pulse25', arp: 'wave', bass: 'walk', drum: 'dance', rev: 1.3 }, // the storm isle's shore
  rl_isle_ruin: { key: 'E', mode: 'aeo', V: 1, bpm: 74, prog: 'minor', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'wave', bass: 'calm', drum: 'shrine', rev: 1.6, pad: .05 },
  rl_isle_deep: { key: 'F', mode: 'phr', bpm: 68, prog: 'phr', feel: 'lyr', lead: 'pulse12', lv: .05, arp: 'bell', bass: 'drone', drum: 'dusk', rev: 1.8, pad: .06, cbpm: 1.4, cdrum: 'combatHeavy' },
};
for (const [id, B] of Object.entries(BRIEFS)) THEMES[/^(lm|rl)_/.test(id) ? id : 'town_' + id] = compose(id, B);
// Elaia, where the story begins: its own tender 6/8 home theme (D major), 30% softer than the other towns as heard (Roy; measured: -3 dB under the towns' average)
THEMES.town_elaia = theme({ bpm: 84, steps: 12, prog: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'D', 'D'], arp: 'wave', bass: 'calm', drum: 'calm', lead: 'pulse25', rev: 1.15, gain: .57,
  mel: 'F#4:4 A4:2 D5:4 E5:2 C#5:4 E5:2 A4:6 B4:4 D5:2 F#5:4 E5:2 D5:4 B4:2 G4:6 A4:4 D5:2 F#5:4 A5:2 G5:4 E5:2 C#5:6 D5:4 B4:2 G5:4 F#5:2 E5:10 r:2 '
    + 'F#5:4 D5:2 B4:4 D5:2 G5:6 F#5:4 E5:2 F#5:4 A5:2 D6:4 A5:2 E5:6 C#5:4 E5:2 D5:4 B4:2 G5:4 B5:2 A5:4 G5:2 E5:4 C#5:2 D5:4 F#5:2 A5:4 F#5:2 D5:10 r:2' });

export const SONGS33 = {};
for (const [k, T] of Object.entries(THEMES)) { SONGS33[k] = T.day; SONGS33[k + '_night'] = T.night; SONGS33[k + '_combat'] = T.combat; }

// ----- which theme plays where -----
// the five town melodies, given out once and for all by a hash of the town's id (never rerolled), each town only from the
// themes that suit it: harbours by the sea, the shrine theme in the hills, the dusk theme for the dark and haunted
// places. Two towns on one melody get a different arrangement: another key and another lead voice.
const TOWN_FIT = {
  coast: ['town_harbour', 'town_agora', 'town_market'], inland: ['town_agora', 'town_market', 'town_shrine'], hills: ['town_shrine', 'town_agora'], dark: ['town_dusk'],
};
// the five hand-written town themes stay with the towns they were written for (the agora's now Corinth's); every other
// town has its own composed theme above. A town not in the lists (none today) falls back to a fitting one by hash
const FIXED = { athenai: 'town_market', piraeus: 'town_harbour', delphoi: 'town_shrine', thebai: 'town_dusk', korinthos: 'town_agora' };
export function townTheme(id, place = {}, biome = '') {
  if (FIXED[id]) return FIXED[id];
  if (THEMES['town_' + id]) return 'town_' + id;
  const kind = /dark|heroes|volcanic|marsh/i.test(biome) ? 'dark' : place.coast ? 'coast' : /rock|snow|pine|scrub/i.test(biome) ? 'hills' : 'inland';
  const L = TOWN_FIT[kind]; return L[hash(id) % L.length];
}
// a town's arrangement of its theme: [semitones, lead voice] (only a fallback town sharing a theme gets another one)
export function townVariant(id) { const V = [[0, null], [2, 'pulse50'], [-2, 'pulse12'], [3, 'aulos']]; return FIXED[id] || THEMES['town_' + id] ? V[0] : V[hash(id + '#v') % V.length]; }
// a landmark or a realm with a theme of its own ('lm_heroes', 'rl_underworld' ...)
export const hasTheme = (k) => !!THEMES[k];
// BETA ONLINE JOBS (js/online/jobplaces.js): a landmark's theme from a brief at run time, online only (the four halls); answers
// the songs for audio.addSongs (day, _night, _combat), or null when the id has one already
export function addTheme(id, B) { if (THEMES[id]) return null; const T = (THEMES[id] = compose(id, B)); return { [id]: T.day, [id + '_night']: T.night, [id + '_combat']: T.combat }; }
// the lands: biome name -> theme
export const REGION_OF = { MEADOW: 'reg_meadow', OLIVE: 'reg_meadow', FARM: 'reg_meadow', GARDEN: 'reg_meadow', FOREST: 'reg_grove', PINE: 'reg_grove',
  BEACH: 'reg_coast', SEA: 'reg_coast', SCRUB: 'reg_highland', ROCK: 'reg_highland', SNOW: 'reg_highland', MARSH: 'reg_marsh', DARK: 'reg_barrow', HEROES: 'reg_barrow', VOLCANIC: 'reg_barrow' };
