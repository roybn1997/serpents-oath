// Pixel-art dress for the foes and bosses (round 16): the same rigs, every part re-dressed in a small hand-shaded texture
// (bone with cracks and pits, rotten rags, engraved and riveted plate, overlapping scales, fur, charred hide with glowing
// seams, flame tongues, eyes with a hot core...). pxDress(r, rules) swaps each part's flat colour for the painter its
// colour names, sizing the texture to the part (about one texel per game pixel at V's camera, like her own outfit),
// and merges same-material parts again (bake() in cast.js drops UVs, so dressed parts are merged here, with them).
// Textures and materials are cached per painter, colour and size; nothing runs per frame.
import * as THREE from './three.module.min.js';
import { toonRamp, pxRig } from './render.js';
import { PXART, ramp, paOnce, paTex, stud, rivet, paFolds, paHem, paLeather, paWood, paHair, paScallops, paFur, paGrit } from './pxart.js';
import { vround, vskin, roundBoxGeo } from './foestyle.js'; // round 33: the new V's rounder shapes for every dressed foe
export { PXART };

// ------------------------------------------------------------------ drawing helpers (on the paTex kit c)
const ln = (c, x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) c.P(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), col); };
const dot = (c, cx, cy, rx, ry, col) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / (rx + .5)) ** 2 + (y / (ry + .5)) ** 2 <= 1) c.P(cx + x, cy + y, col); };
// a crack: a jagged dark line wandering down with a lit lip under it (light from the top left)
function crack(c, x, y, len, dk, lit, G, rim) { // (a glowing crack, drawn with G, gets a dark rim beside it so it reads as a split)
  let dx = c.rnd() < .5 ? -1 : 1;
  for (let i = 0; i < len; i++) {
    if (G && rim) { c.P(x - 1, y, rim); c.P(x + 1, y + 1, rim); } (G || c.P)(x, y, dk); if (lit && !G) c.P(x + 1, y + 1, lit);
    if (c.rnd() < .35) dx = -dx; if (c.rnd() < .7) x += dx; y += c.rnd() < .75 ? 1 : 0;
    if (c.rnd() < .12 && len > 5) { let bx = x, by = y; for (let k = 0; k < 3; k++) { bx -= dx; by++; (G || c.P)(bx, by, dk); } }
  }
}
// small rune glyphs (3 x 5) in a row: the King's marks, the dead's runes
const GLYPH = ['xxx.x.x.x.x', 'x.xxxxx.x.x', 'x..xx.x.xx.', '.x.xxx.x.x.', 'xx.x.x.xx.x', 'x.x.x.xxx.x', 'xxx..x.x.xx'];
function runes(c, y, col, step = 7, x0 = 2) { for (let x = x0, i = 0; x < c.W - 3; x += step, i++) [...GLYPH[i % GLYPH.length]].forEach((ch, k) => { if (ch === 'x') c.G(x + k % 3, y + (k / 3 | 0), col); }); }

// ------------------------------------------------------------------ painters: (c, Q = ramp(colour, 6) darkest first, o)
// canvas top = the part's top (or its tip / far end), u wraps round it with the front at the middle (c.F). Where the shared
// kit in pxart.js has the look (folds, hems, leather, wood, hair, scales, fur, grit) it paints it, so foes match the rest.
export const PAINT = {
  cloth(c, Q, o) { // cloth hanging in folds, a stitched hem (or a coloured hem band) at the bottom
    const { R, P, W, H } = c, hb = o.hem && H > 12;
    R(0, 0, W, H, Q[3]); paFolds(c, Q, { n: Math.max(2, Math.round(W / 9)), y0: 1, y1: hb ? H - 4 : H }); R(0, 0, W, 1, Q[2]);
    if (hb) paHem(c, ramp(o.hem, 6), H - 4); else if (H > 6) { for (let x = 0; x < W; x += 3) P(x, H - 3, Q[4]); R(0, H - 1, W, 1, Q[1]); }
  },


  rag(c, Q, o) { // rotten cloth: folds, a few mould stains, moth holes and slits, tatters at the hem
    const { R, P, W, H, rnd } = c;
    PAINT.cloth(c, Q, {});
    const rot = o.rot ? ramp(o.rot, 4) : null;
    for (let n = Math.max(1, Math.min(8, W * H / 500 | 0)); n--;) { const x = rnd() * W | 0, y = rnd() * H | 0, rx = 1 + (rnd() * 3 | 0); dot(c, x, y, rx, Math.max(1, rx - 1), Q[2]); if (rot) dot(c, x, y + 1, Math.max(0, rx - 2), 0, rot[1]); }
    for (let n = Math.max(1, Math.min(6, W * H / 700 | 0)); n--;) { const x = rnd() * W | 0, y = 2 + rnd() * (H - 6) | 0; if (rnd() < .5) { R(x, y, 2, 2, Q[0]); P(x - 1, y, Q[4]); P(x, y - 1, Q[4]); } else { R(x, y, 1, 3 + (rnd() * 3 | 0), Q[0]); P(x + 1, y, Q[4]); } }
    if (H > 8) for (let x = 0; x < W; x++) { const d = (rnd() * 3 | 0) + (x % 5 === 2 ? 3 : 0); R(x, H - d, 1, d, Q[0]); if (d) P(x, H - d - 1, Q[1]); }
  },

  bone(c, Q) { // old bone: grit, pits and a crack or two, a few streaks along the length, knobby rims at the ends
    const { R, W, H, rnd } = c;
    paGrit(c, Q, { fleck: 3, pit: .8, crack: .35 });
    for (let x = rnd() * 3 | 0; x < W; x += 5 + (rnd() * 5 | 0)) R(x, rnd() * H | 0, 1, 2 + (rnd() * H * .3 | 0), Q[4]);
    if (H > 5) { R(0, 0, W, 1, Q[2]); R(0, 1, W, 1, Q[4]); R(0, H - 1, W, 1, Q[1]); R(0, H - 2, W, 1, Q[2]); }
  },


  metal(c, Q, o) { // plate: a lit top edge, an engraved groove under it and over the bottom edge, rivets, a few glinting scratches and dents; rust or verdigris
    const { R, P, W, H, rnd } = c;
    R(0, 0, W, H, Q[3]);
    if (H >= 8) {
      R(0, 0, W, 1, Q[5]); R(0, 1, W, 1, Q[4]); R(0, H - 1, W, 1, Q[0]); R(0, H - 2, W, 1, Q[1]);
      if (H >= 14) { R(0, 4, W, 1, Q[1]); R(0, 5, W, 1, Q[4]); R(0, H - 6, W, 1, Q[1]); R(0, H - 5, W, 1, Q[4]); if (o.rivets !== false) for (let x = 3; x < W; x += 8) { rivet(c, x, 2, Q); rivet(c, x + 4, H - 4, Q); } }
    } else { R(0, 0, W, 1, Q[4]); R(0, H - 1, W, 1, Q[1]); }
    if (o.gild && H >= 20) { const G = ramp(o.gild, 5), y = H >> 1; R(0, y - 3, W, 7, Q[1]); R(0, y - 3, W, 1, G[2]); R(0, y + 3, W, 1, G[1]); for (let x = 0; x < W; x++) { const w = [0, -1, -1, 0, 1, 1][x % 6]; P(x, y + w, G[3]); P(x, y + w - 1, G[4]); } } // an inlaid gold wave
    if (o.runes && H >= 16) { const G = ramp(o.runes, 5), y = (H >> 1) - 2; R(0, y - 1, W, 7, Q[1]); runes(c, y, G[4]); }
    for (let n = Math.max(1, W * H / 300 | 0); n--;) { const x = rnd() * W | 0, y = 3 + rnd() * (H - 6) | 0; ln(c, x, y, x + 2, y + 1, Q[5]); P(x + 1, y + 1, Q[2]); }
    for (let n = W * H / 600 | 0; n--;) { const x = rnd() * W | 0, y = rnd() * H | 0; R(x, y, 2, 2, Q[2]); P(x + 1, y + 1, Q[1]); P(x, y - 1, Q[4]); }
    if (o.rust) { const Z = ramp(o.rust, 5); for (let n = Math.max(1, W * H / 450 * (o.rustK ?? 1) | 0); n--;) { const x = rnd() * W | 0, y = rnd() < .6 ? H - 3 - (rnd() * H * .25 | 0) : rnd() * H | 0, r = rnd() < .7 ? 1 : 2; dot(c, x, y, r + 1, r, Z[2]); dot(c, x + 1, y, r - 1, Math.max(0, r - 1), Z[1]); P(x - r, y - 1, Z[3]); } }
  },

  scale(c, Q, o) { paScallops(c, Q, { w: o.sw || 6, h: (o.sh || 4) + 3, glint: .25, rim: 0 }); }, // overlapping scales (the shared kit's drops)

  belly(c, Q) { // belly plates across the length: each a lit top, a shaded underside, a dark seam
    const { R, P, W, H } = c;
    R(0, 0, W, H, Q[3]); for (let y = 0; y < H; y += 5) { R(0, y, W, 1, Q[0]); R(0, y + 1, W, 1, Q[5]); R(0, y + 2, W, 1, Q[4]); R(0, y + 4, W, 1, Q[2]); }
    for (let x = 0; x < W; x += 6) for (let y = 0; y < H; y += 5) P(x + (y % 10 ? 3 : 0), y + 3, Q[2]);
  },
  lames(c, Q, o) { // overlapping plates (a pauldron's lames): o.n bands, each lit along its top edge and shading down to a dark seam, rivets
    const { R, W, H } = c, st = Math.max(5, H / (o.n || 4) | 0);
    R(0, 0, W, H, Q[3]);
    for (let y = 0; y < H; y += st) { R(0, y, W, 1, Q[5]); R(0, y + 1, W, 1, Q[4]); R(0, y + st - 3, W, 2, Q[2]); R(0, y + st - 1, W, 1, Q[0]); for (let x = 3; x < W; x += 12) rivet(c, x, y + (st >> 1) - 1, Q); }
  },
  fur(c, Q, o) { paFur(c, Q, { long: o.long || 4, cw: o.cw, ch: o.ch, glint: .15 }); }, // shaggy fur (the shared kit's tufts)

  skin(c, Q, o) { // a monster's hide: grit and bumps; veins and patches of small scales if asked
    const { P, W, H, rnd } = c;
    paGrit(c, Q, { fleck: 2.5, bump: .5, pit: .3 });
    if (o.vein) { // veins: drifting down in long lazy curves, now and then a short branch
      const V = ramp(o.vein, 4);
      for (let n = Math.max(1, W * H / 650 | 0); n--;) {
        let x = rnd() * W, y = rnd() * H * .5, dx = (rnd() - .5) * .8;
        for (let k = H * (.25 + rnd() * .4) | 0; k--; y++) {
          dx = Math.max(-.9, Math.min(.9, dx + (rnd() - .5) * .3)); x += dx; P(x | 0, y, V[2]);
          if (rnd() < .05) { let bx = x; const bd = dx > 0 ? -.8 : .8; for (let j = 1; j < 5; j++) P((bx += bd) | 0, y + j, V[2]); }
        }
      }
    }
    if (o.scales) { // patches of small scales: rows of 3-texel plates, a lit top and a dark seam under each, no bright speckle
      const S = ramp(o.scales, 5);
      for (let n = Math.max(1, W * H / 420 | 0); n--;) { const cx = rnd() * W | 0, cy = rnd() * H | 0, k = 2 + (rnd() * 2 | 0); for (let j = 0; j < k; j++) for (let i = 0; i < 4 - (j & 1); i++) if (rnd() < .85) { const x = cx + i * 4 + (j & 1) * 2, y = cy + j * 3; P(x, y, S[3]); P(x + 1, y, S[3]); P(x + 2, y, S[2]); P(x, y + 1, S[2]); P(x + 1, y + 1, S[2]); P(x + 2, y + 1, S[1]); P(x + 1, y + 2, S[0]); } }
    }
  },


  leather(c, Q) { paLeather(c, Q); }, // grain, rolled edges, stitching (the shared kit's)
  hide(c, Q, o) { // a broad piece of tanned leather (an apron): smooth, a few creases with a lit lip, scuffs (or scorch blotches), stitched hems
    const { R, P, W, H, rnd } = c;
    R(0, 0, W, H, Q[3]); R(0, 0, W, 1, Q[4]); R(0, H - 1, W, 1, Q[1]);
    for (let n = Math.max(2, W / 10 | 0); n--;) { let x = rnd() * W | 0; const y0 = rnd() * H * .4 | 0, len = H * (.3 + rnd() * .5) | 0; for (let j = 0; j < len; j++) { if (rnd() < .25) x += rnd() < .5 ? -1 : 1; P(x, y0 + j, Q[2]); P(x + 1, y0 + j, Q[4]); } }
    for (let n = Math.max(1, W * H / 450 | 0); n--;) { const cx = rnd() * W | 0, cy = rnd() * H | 0, rr = 2 + (rnd() * 3 | 0); dot(c, cx, cy, rr, rr - 1, o.scorch ? Q[1] : Q[4]); if (o.scorch) dot(c, cx, cy, rr >> 1, 0, Q[0]); }
    for (let n = W * H / 70 | 0; n--;) P(rnd() * W | 0, rnd() * H | 0, rnd() < .5 ? Q[2] : Q[4]);
    if (H > 8) for (let x = 1; x < W; x += 3) { P(x, 2, Q[5]); P(x, H - 3, Q[5]); }
  },

  wood(c, Q) { paWood(c, Q); }, // grain along the length (the shared kit's)

  stone(c, Q, o) { // weathered stone: grit, chips, long cracks (glowing if o.glow)
    const { W, H, rnd } = c, G = o.glow ? ramp(o.glow, 5) : null;
    paGrit(c, Q, { fleck: 6, pit: .8, bump: .5 });
    for (let n = Math.max(1, W * H / (G ? 170 : 260) | 0); n--;) crack(c, rnd() * W | 0, rnd() * H * .6 | 0, 4 + (rnd() * Math.min(G ? 20 : 14, H * .6) | 0), G ? G[3] : Q[0], Q[5], G ? c.G : null, Q[1]);
  },

  ember(c, Q, o) { // charred hide split by seams of fire (the seams glow: they are drawn in the emissive layer too)
    const { R, P, W, H, rnd } = c, G = ramp(o.glow || '#ff6a14', 5);
    R(0, 0, W, H, Q[2]); for (let n = W * H / 40 | 0; n--;) P(rnd() * W | 0, rnd() * H | 0, rnd() < .6 ? Q[1] : Q[3]);
    for (let n = Math.max(2, W * H / 170 | 0); n--;) {
      let x = rnd() * W | 0, y = rnd() * H | 0, dx = rnd() < .5 ? -1 : 1; const l = 5 + (rnd() * 9 | 0);
      for (let i = 0; i < l; i++) { c.G(x, y, i > 1 && i < l - 2 && i % 3 === 1 ? G[3] : G[1]); P(x, y - 1, Q[0]); P(x + dx, y + 1, Q[1]); if (rnd() < .35) dx = -dx; x += dx; if (rnd() < .55) y++; }
    }
    for (let n = W * H / 120 | 0; n--;) { const x = rnd() * W | 0, y = rnd() * H | 0; R(x, y, 2, 1, Q[4]); }
  },

  flame(c, Q) { // flame tongues (an unlit material): a hot foot, licks rising through it, dark-red tips
    const { R, P, W, H, rnd } = c;
    R(0, 0, W, H, Q[3]); R(0, H - Math.ceil(H * .35), W, Math.ceil(H * .35), Q[4]);
    for (let x = 0; x < W; x += 3) { const h = Math.round(H * (.3 + rnd() * .5)); for (let y = 0; y < h; y++) { const w = Math.max(0, Math.round((1 - y / h) * 1.3)); for (let i = -w; i <= w; i++) P(x + 1 + i, H - 1 - y, y < h * .5 ? Q[5] : Q[4]); } }
    for (let x = 0; x < W; x++) { const d = 1 + (rnd() * Math.max(1, H * .25) | 0); R(x, 0, 1, d, Q[2]); P(x, d, Q[3]); }
  },
  eye(c, Q) { const { R, P, W, H, F } = c; R(0, 0, W, H, Q[3]); R(0, 0, W, 1, Q[2]); if (W > 2) R(1, 1, W - 2, Math.max(1, H - 2), Q[4]); P(F, H >> 1, '#ffffff'); P(F - 1, (H >> 1), Q[5]); },
  hair(c, Q) { paHair(c, Q, { n: Math.max(4, Math.round(c.W / 6)), tip0: c.H * .7 }); }, // locks lit on one side, shaded on the other (the shared kit's)


  horn(c, Q) { // ringed horn: ridges round it, fine striations along it, a paler tip
    const { R, P, W, H, rnd } = c;
    R(0, 0, W, H, Q[3]); for (let x = 0; x < W; x += 2 + (rnd() * 2 | 0)) R(x, 0, 1, H, rnd() < .5 ? Q[2] : Q[4]);
    for (let y = 2; y < H; y += 3) { R(0, y, W, 1, Q[1]); R(0, y - 1, W, 1, Q[4]); }
    R(0, 0, W, 2, Q[5]);
  },
  cloud(c, Q) { // storm cloud: round billows, lit along the top, a dark rim under each; painted top down so the lower ones overlap
    const { R, P, W, H, rnd } = c, Pw = (x, y, col) => P((x % W + W) % W, y, col), B = [];
    R(0, 0, W, H, Q[2]);
    for (let n = Math.max(4, W * H / 110 | 0); n--;) B.push([rnd() * W | 0, rnd() * H | 0, 3 + (rnd() * 5 | 0)]);
    B.sort((a, b) => a[1] - b[1]);
    for (const [cx, cy, r] of B) {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y * 1.15); if (d <= r + .4) Pw(cx + x, cy + y, d > r - .6 && y > 0 ? Q[1] : d > r - 1.7 && y < -r * .15 && x < r * .5 ? Q[4] : Q[3]); }
      Pw(cx - (r >> 1), cy - r + 1, Q[5]); Pw(cx - (r >> 1) + 1, cy - r + 1, Q[5]);
    }
  },
  ghost(c, Q) { // ghost-stuff: wavering streaks, brighter wisps, the ends gone thin and dark
    const { R, P, W, H, rnd } = c;
    R(0, 0, W, H, Q[3]);
    for (let x0 = 0; x0 < W; x0 += 3) { const ph = rnd() * 6, col = rnd() < .5 ? Q[4] : Q[2]; for (let y = rnd() * 4 | 0; y < H; y += 1) if (rnd() < .8) P(x0 + Math.round(Math.sin(y / 4 + ph)), y, col); }
    for (let n = W * H / 60 | 0; n--;) P(rnd() * W | 0, rnd() * H | 0, Q[5]);
  },
  chitin(c, Q) { // segmented shell: glossy plates with a highlight dash, dark seams between
    const { R, P, W, H } = c, s = Math.max(4, Math.min(8, H >> 2));
    R(0, 0, W, H, Q[3]);
    for (let y = 0; y < H; y += s) { R(0, y, W, 1, Q[0]); R(0, y + 1, W, 1, Q[4]); R(0, y + s - 2, W, 1, Q[2]); R(0, y + s - 1, W, 1, Q[1]); for (let x = 2; x < W; x += 8) { R(x, y + 2, 3, 1, Q[5]); P(x + 1, y + 3, Q[4]); } }
  },
  membrane(c, Q) { // a wing's skin: branching veins, a dark trailing edge
    const { R, P, W, H, rnd } = c;
    R(0, 0, W, H, Q[3]);
    for (let n = W * H / 120 | 0; n--;) R(rnd() * W | 0, rnd() * H | 0, 2, 1, Q[4]);
    for (let n = Math.max(2, W / 10 | 0); n--;) { let x = rnd() * W | 0, y = 0; while (y < H) { P(x, y, Q[1]); P(x + 1, y, Q[2]); y++; if (rnd() < .3) x += rnd() < .5 ? -1 : 1; if (rnd() < .06) { let bx = x, by = y; for (let k = 0; k < 6; k++) P(bx += 1, by += rnd() < .6 ? 1 : 0, Q[1]); } } }
    R(0, H - 2, W, 2, Q[1]);
  },

  disc(c, Q, o) { // a round face seen on a cylinder's cap (the texture's square is the disc): rim, a ring of rivets, a worn field
    const { P, W, H, rnd } = c, F2 = o.field ? ramp(o.field, 6) : Q, Z = o.rust ? ramp(o.rust, 5) : null;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = (i + .5) / W * 2 - 1, y = (j + .5) / H * 2 - 1, r = Math.hypot(x, y), up = y < 0; let col;
      if (r > .94) col = Q[0]; else if (r > .84) col = up ? Q[5] : Q[3]; else if (r > .8) col = Q[1];
      else if (o.ring && r > .62 && r < .74) col = up ? F2[2] : F2[1]; else if (o.ring && r > .58 && r < .62) col = up ? F2[4] : F2[3];
      else col = F2[3];
      if (r < .8 && r > .74 && up) col = F2[2]; // the field's lip in the rim's shadow
      P(i, j, col);
    }
    if (Z) for (let n = Math.max(2, W * H / 500 | 0); n--;) { const a = rnd() * 6.3, d = .3 + rnd() * .6, x = Math.round(W / 2 + Math.cos(a) * d * W / 2), y = Math.round(H / 2 + Math.sin(a) * d * H / 2), rr = rnd() < .7 ? 1 : 2; dot(c, x, y, rr + 1, rr, Z[2]); dot(c, x + 1, y, rr - 1, Math.max(0, rr - 1), Z[1]); P(x - rr, y - 1, Z[3]); }
    for (let n = Math.max(1, W * H / 400 | 0); n--;) { const x = W * .25 + rnd() * W * .5 | 0, y = H * .25 + rnd() * H * .5 | 0; ln(c, x, y, x + 3, y + 1, F2[4]); }
    const n = o.rivets ?? 16; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = Math.round(W / 2 + Math.cos(a) * W * .445 - 1), y = Math.round(H / 2 + Math.sin(a) * H * .445 - 1); rivet(c, x, y, Q); }
  },
  drape(c, Q, o) { // carved stone drapery: cloth folds in a stone palette, speckle, cracks (glowing if o.glow)
    PAINT.cloth(c, Q, {}); const { P, W, H, rnd } = c, G = o.glow ? ramp(o.glow, 5) : null;
    for (let n = W * H / 14 | 0; n--;) P(rnd() * W | 0, rnd() * H | 0, rnd() < .5 ? Q[2] : Q[4]);
    for (let n = Math.max(1, W * H / 250 | 0); n--;) crack(c, rnd() * W | 0, rnd() * H * .6 | 0, 4 + (rnd() * Math.min(18, H * .6) | 0), G ? G[3] : Q[0], Q[5], G ? c.G : null, Q[1]);
  },
  feather(c, Q) { paScallops(c, Q, { w: 5, h: 9, quill: 1, glint: .2 }); }, // feathers with a lit quill (the shared kit's drops)
  rope(c, Q) { const { R, P, W, H } = c; R(0, 0, W, H, Q[2]); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (x + y) % 4; if (k === 0) P(x, y, Q[4]); else if (k === 1) P(x, y, Q[3]); else if (k === 3) P(x, y, Q[1]); } },
  weed(c, Q) { const { R, P, W, H, rnd } = c; R(0, 0, W, H, Q[3]); R(c.F, 0, 1, H, Q[4]); for (let y = 0; y < H; y += 3) { P(rnd() * W | 0, y, Q[1]); P(0, y + 1, Q[1]); P(W - 1, y + 2, Q[1]); } for (let n = W * H / 20 | 0; n--;) P(rnd() * W | 0, rnd() * H | 0, Q[2]); },
  water(c, Q) { // foam rings: white crests over blue troughs (unlit)
    const { R, P, W, H, rnd } = c;
    R(0, 0, W, H, Q[3]);
    for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x++) { const k = (x + y * 3) % 10; if (k < 3) P(x, y + (k === 1 ? -1 : 0), Q[5]); else if (k < 5) P(x, y, Q[4]); else if (k > 7) P(x, y + 1, Q[2]); }
    for (let n = W * H / 30 | 0; n--;) P(rnd() * W | 0, rnd() * H | 0, '#ffffff');
  },
};
// glowing painters: also painted into an emissive layer through c.G (a no-op mark everywhere else)
const GLOWING = { ember: 1, stone: (o) => !!o.glow, drape: (o) => !!o.glow, metal: (o) => !!o.runes };

// ------------------------------------------------------------------ textures and materials
const seedOf = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 2147483647 || 1; return h; };
function pfTex(name, hex, W, H, o, glow, bg) {
  const ok = o.k || JSON.stringify(o), key = `pf:${name}:${hex}:${W}x${H}:${ok}`;
  return paTex(key + (glow ? ':g' + bg : ''), W, H, (c) => {
    let s = seedOf(key); const rnd = () => (s = s * 16807 % 2147483647) / 2147483647, nop = () => {};
    const k = glow ? { ...c, rnd, R: nop, P: nop, S: nop, G: c.P } : { ...c, rnd, G: c.P };
    if (glow) c.R(0, 0, W, H, bg);
    PAINT[name](k, ramp(hex, 6), o);
  });
}
// the material for one painter, colour and size, keeping what the flat one had (unlit, see-through, emissive, two-sided)
export function pfMat(spec, hex, W, H, base = {}) {
  const [name, o = {}] = Array.isArray(spec) ? spec : [spec];
  const em = base.emissive && (base.emissive.r || base.emissive.g || base.emissive.b) ? '#' + base.emissive.getHexString() : null;
  const gl = typeof GLOWING[name] === 'function' ? GLOWING[name](o) : !!GLOWING[name];
  const key = `pm:${name}:${hex}:${W}x${H}:${o.k || JSON.stringify(o)}:${base.isMeshBasicMaterial ? 'b' : 't'}${em}:${base.transparent ? base.opacity : 1}:${base.side || 0}:${base.blending || 1}`;
  return paOnce(key, () => {
    const map = pfTex(name, hex, W, H, o), q = { map, transparent: !!base.transparent, opacity: base.opacity ?? 1, side: base.side ?? THREE.FrontSide };
    if (base.isMeshBasicMaterial) return new THREE.MeshBasicMaterial({ ...q, fog: base.fog ?? true, blending: base.blending ?? THREE.NormalBlending, depthWrite: base.depthWrite ?? true });
    const m = new THREE.MeshToonMaterial({ ...q, gradientMap: toonRamp() });
    if (gl) { m.emissive.set('#ffffff'); m.emissiveMap = pfTex(name, hex, W, H, o, true, em || '#000000'); } else if (em) m.emissive.set(em);
    return m;
  });
}

// ------------------------------------------------------------------ UVs: u round the part (front at u .5), v along it
const geoCache = new Map(), G = (k, make) => { if (!geoCache.has(k)) geoCache.set(k, make()); return geoCache.get(k); };
// a unit box wrapped like a four-sided cylinder round its long axis ax ('y' upright, 'z' or 'x' lying), sizes (dS, dF, dA)
function boxUV(ax, dS, dF, dA, round) { // (round: a bevelled box, round 33 (foestyle.js), UVs laid out on it the same way)
  const q = (x) => Math.round(x * 20) / 20, k = `bx${ax}${q(dS / (dS + dF))}${q(dF / dA)}${round ? 'r' : ''}`;
  if (round) return G(k, () => roundBoxGeo(undefined, (g) => wrapBox(g, ax, dS, dF, dA)));
  return G(k, () => wrapBox(new THREE.BoxGeometry(1, 1, 1), ax, dS, dF, dA));
}
function wrapBox(g, ax, dS, dF, dA) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const [A, F, S] = { y: [1, 2, 0], z: [2, 1, 0], x: [0, 2, 1] }[ax], P = 2 * dS + 2 * dF, kb = Math.min(.5, dF / Math.max(.001, dA));
    for (let i = 0; i < p.count; i++) {
      const c = [p.getX(i), p.getY(i), p.getZ(i)], nn = [n.getX(i), n.getY(i), n.getZ(i)], pS = c[S], pF = c[F], pA = c[A];
      let s, v = pA + .5;
      if (nn[F] < -.5) s = -pS * dS; else if (nn[S] < -.5) s = dS / 2 + (pF + .5) * dF; else if (nn[F] > .5) s = dS / 2 + dF + (pS + .5) * dS; else if (nn[S] > .5) s = 1.5 * dS + dF + (.5 - pF) * dF;
      else { s = P / 2 + pS * dS; v = nn[A] > 0 ? 1 - (.5 - pF) * kb : (pF + .5) * kb; }
      uv.setXY(i, s / P, v);
    }
    return g;
}
// turn the texture round a cylinder, cone or ball (n = how many vertices are its side: a cylinder's caps keep their own disc)
const shiftU = (geo, du, n = geo.attributes.uv.count) => G(geo.uuid + 'u' + du, () => { const g = geo.clone(), uv = g.attributes.uv; for (let i = 0; i < n; i++) uv.setX(i, uv.getX(i) + du); return g; });
const QS = [4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256];
const qz = (n, max) => { n = Math.min(max, n); let b = QS[0]; for (const s of QS) if (s <= max && Math.abs(s - n) < Math.abs(b - n)) b = s; return b; };
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
// the part's texture size (texels round, texels along) and the geometry with its UVs laid out for it
function layout(m, D, max) {
  m.matrixWorld.decompose(_p, _q, _s); const sx = Math.abs(_s.x), sy = Math.abs(_s.y), sz = Math.abs(_s.z), g = m.geometry, pr = g.parameters || {};
  let W, H, geo = g;
  switch (g.type) {
    case 'CylinderGeometry': case 'ConeGeometry': { const r = Math.max(pr.radiusTop ?? pr.radius ?? 0, pr.radiusBottom ?? pr.radius ?? 0); geo = shiftU(g, .5, ((pr.radialSegments || 8) + 1) * ((pr.heightSegments || 1) + 1)); W = Math.PI * r * (sx + sz) * D; H = pr.height * sy * D; break; }
    case 'IcosahedronGeometry': case 'OctahedronGeometry': case 'DodecahedronGeometry': geo = shiftU(g, -.25); W = Math.PI * pr.radius * (sx + sz) * D; H = Math.PI * pr.radius * sy * D; break;
    case 'SphereGeometry': geo = shiftU(g, .25); W = Math.PI * pr.radius * (sx + sz) * D; H = Math.PI * pr.radius * sy * D; break;
    case 'TorusGeometry': W = 2 * Math.PI * pr.radius * Math.max(sx, sy, sz) * D; H = 2 * Math.PI * pr.tube * Math.max(sx, sy, sz) * D; break;
    case 'BoxGeometry': if (pr.width === 1 && pr.height === 1 && pr.depth === 1) {
      const ax = sy >= Math.max(sx, sz) * .6 ? 'y' : sz >= sx ? 'z' : 'x', [dS, dF, dA] = ax === 'y' ? [sx, sz, sy] : ax === 'z' ? [sx, sy, sz] : [sy, sz, sx];
      geo = boxUV(ax, dS, dF, dA, !!g.userData.vr); W = (2 * dS + 2 * dF) * D; H = dA * D; break;
    } // falls through: a box of its own size keeps its UVs
    default: {
      if (!g.attributes.uv) { g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, a = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { a[i * 2] = (p.getX(i) - b.min.x) / Math.max(1e-4, b.max.x - b.min.x); a[i * 2 + 1] = (p.getY(i) - b.min.y) / Math.max(1e-4, b.max.y - b.min.y); } g.setAttribute('uv', new THREE.BufferAttribute(a, 2)); }
      g.computeBoundingBox(); const b = g.boundingBox; W = (b.max.x - b.min.x) * sx * D; H = (b.max.y - b.min.y) * sy * D;
    }
  }
  if (m.userData.pxWH) [W, H] = m.userData.pxWH;
  return { W: qz(W, max), H: qz(H, max), geo };
}

// merge same-material dressed parts under each joint (keeps UVs); parts the rig names (r.jaw, r.sting...) stay apart
function merge(r) {
  const keep = new Set(), mark = (v, d = 0) => {
    if (!v || d > 2) return;
    if (v.isObject3D) keep.add(v); else if (Array.isArray(v)) v.forEach((x) => mark(x, d + 1)); else if (typeof v === 'object' && v.constructor === Object) for (const k in v) mark(v[k], d + 1);
  };
  for (const k in r) if (k !== 'root' && k !== 's' && k !== 'info') mark(r[k]);
  const parents = []; r.root.traverse((o) => { if (o.children.length) parents.push(o); });
  for (const p of parents) {
    const groups = new Map();
    for (const c of p.children) {
      if (!c.isMesh || !c.userData.pf || c.children.length || keep.has(c) || !c.visible) continue;
      const key = c.material.uuid + (c.castShadow ? 's' : 'n'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      let n = 0; const parts = list.map((m) => { m.updateMatrix(); const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix); n += g.attributes.position.count; return g; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
      for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const mm = new THREE.Mesh(geo, list[0].material); mm.castShadow = list[0].castShadow; mm.userData.pf = true; p.add(mm);
      for (const m of list) p.remove(m);
    }
  }
}

// pxDress(r, rules, o): rules map a flat colour ('#rrggbb') to a painter name or [name, opts]; a part can name its own
// with userData.px. o.D = texels per metre (100 = V's outfit), o.max = the largest texture side. Call before finish()/bake().
export function pxDress(r, rules, o = {}) {
  if (o.round !== false) vround(r.root);
  if (!PXART) return r;
  const D = o.D ?? 100, max = o.max ?? 128, R = {}; for (const k in rules) R[k.toLowerCase()] = rules[k];
  r.root.updateMatrixWorld(true);
  const list = []; r.root.traverse((m) => { if (m.isMesh && !m.userData.outline && !m.userData.fx && !Array.isArray(m.material) && !m.material.map && m.material.color && !m.isInstancedMesh) list.push(m); });
  for (const m of list) {
    const hex = '#' + m.material.color.getHexString(), spec = m.userData.px || R[hex]; if (!spec) continue;
    const { W, H, geo } = layout(m, D, max); m.geometry = geo; m.material = pfMat(spec, m.userData.pxHex || hex, W, H, m.material); m.userData.pf = true;
  }
  if (o.round !== false) vskin(r.root); // round 33: what no rule names gets the new palette's quiet surface
  if (o.merge !== false) merge(r);
  return r;
}

// a soft additive glow round an eye or a flame (a sprite: never flashed or outlined); shared texture and materials
let _gt = null;
const glowTex = () => _gt ??= (() => {
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const d = Math.hypot(i - 7.5, j - 7.5) / 8, a = d < .3 ? 1 : d < .55 ? .5 : d < .8 ? .2 : 0; if (a) { x.fillStyle = `rgba(255,255,255,${a})`; x.fillRect(i, j, 1, 1); } } // stepped rings, like a sprite's glow
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; return t;
})();
// entities.js swaps a petrified (or hit-flashed) body's mesh materials but never sees a sprite: so the glow watches one
// body mesh (found on its first draw, after bake) and goes out while that mesh wears another material (render.js's
// pixel-shaded twin of a material counts as the material itself: it is made from it by Object.create)
const unTwin = (m) => (m && m.pxv ? Object.getPrototypeOf(m) : m);
function glowCheck() {
  const u = this.userData;
  if (u.anchor === undefined) { let r = this; while (r.parent && !r.parent.isScene) r = r.parent; u.anchor = null; r.traverse((o) => { if (!u.anchor && o.isMesh && !o.userData.fx && !o.userData.outline) u.anchor = o; }); u.mat0 = unTwin(u.anchor?.material); }
  const k = u.anchor && unTwin(u.anchor.material) !== u.mat0 ? 1e-4 : u.size; if (this.scale.x !== k) this.scale.setScalar(k);
}
export function eyeGlow(parent, color, size, x = 0, y = 0, z = 0, op = .6) {
  const mt = paOnce('eg' + color + op, () => new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
  const s = new THREE.Sprite(mt); s.scale.setScalar(size); s.position.set(x, y, z); s.userData.fx = s.userData.outline = true; s.userData.size = size; s.onBeforeRender = glowCheck; parent.add(s); return s;
}
export { stud, rivet, ramp, pxRig };
