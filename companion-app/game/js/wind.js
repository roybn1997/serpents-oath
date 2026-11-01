// Round 33 (physics): the one wind the whole world shares. Hair, braids, capes and cloth (rope.js), the trees and the
// grass (chunks.js shaders) and the slant of the rain (weather.js) all read it, so everything leans the same way at the
// same moment and nothing gets its own random gusts.
//   WIND.x, WIND.z  the direction it blows toward (unit, world xz)
//   WIND.s          strength now, gusts included: ~.3 a fair-weather breeze, ~.5 on a high ridge or a beach, up to ~1.2
//                   in a storm (a shower's rain, the storm isle's squall); near 0 indoors and in still realms
//   WIND.base       the strength without the gusts; WIND.ax, WIND.az: the push it gives loose cloth and hair (m/s^2),
//                   rope.js multiplies it by each rope's own `wind` (long loose hair more, a heavy cape less)
// The prevailing wind is the Aegean's summer north wind (it blows toward the south, +z) wandering slowly a little either
// side; gusts are smooth sums of slow sines of the game clock, so they are the same for every body and every frame rate.
export const WIND = { x: .26, z: .97, s: .3, base: .3, ax: 0, az: 0, gust: 0, t: 0, shader: { value: null } };

const smooth = (a, b, k) => a + (b - a) * k;
const GAIN = 14; // m/s^2 of push on loose cloth per unit of strength (a storm leans a cape ~5 cm, a braid ~2 cm)

export function updateWind(g, dt) {
  if (!(dt > 0)) return WIND;
  const W = g.world, p = g.player, realm = W?.realm, T = (WIND.t += dt);
  // where it blows: the north wind, swinging up to ~25 degrees either way over a few minutes
  const a = .27 + Math.sin(T * .011) * .3 + Math.sin(T * .029 + 1.3) * .14; // (the way it travels: 0 is +z, south)
  WIND.x = Math.sin(a); WIND.z = Math.cos(a);
  // how hard: a breeze, more up high and on the open shore, a storm with the rain; a realm sets its own
  let want = .3;
  if (realm) { // (a cave or a temple is still air; the ferry's deck is the open sea; the storm isle blows until its wind is calmed)
    const k = realm.kind || '';
    want = realm.wind ?? (k === 'cave' || k === 'temple' || /^interior/.test(realm.id || '') ? .03 : realm.rain ? .45 + realm.rain * .75 + (realm.windCalm === false ? .15 : 0) : realm.sea ? .5 : realm.id === 'underworld' ? .1 : .2);
  }
  else if (p) {
    const y = W.ground(p.pos.x, p.pos.z), wl = W.waterLevel?.(p.pos.x, p.pos.z);
    want += Math.min(.25, Math.max(0, (y - 30) / 160)); // a ridge or a peak
    if (wl != null || W.surfaceAt?.(p.pos.x, p.pos.z) === 'sand') want += .12; // the shore and the open sea
    want += (W.sky?.rain || 0) * .75; // a shower comes in on a wind
  }
  WIND.base = smooth(WIND.base, want, Math.min(1, dt * .35));
  // gusts: slow swells and a quicker flutter on top, stronger the windier it is
  const gu = .55 * Math.sin(T * .37) * Math.sin(T * .113 + 2) + .3 * Math.sin(T * 1.31 + .7) * Math.max(0, Math.sin(T * .21));
  WIND.gust = gu;
  WIND.s = Math.max(0, WIND.base * (1 + gu * (.5 + WIND.base * .4)));
  WIND.ax = WIND.x * WIND.s * GAIN; WIND.az = WIND.z * WIND.s * GAIN;
  // the vegetation shaders' uniform: (dir x, dir z, strength, base) - chunks.js
  const u = WIND.shader.value; if (u) u.set(WIND.x, WIND.z, WIND.s, WIND.base);
  return WIND;
}
