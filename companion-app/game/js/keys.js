// Key bindings (round 23, Roy): one table from physical keys (KeyboardEvent.code) to game actions. Every key check
// in the game goes through it, the keyboard window (keyboard.js) edits it, the save keeps it (main.js, field `keys`).
// A key holds at most one action; an action may sit on several keys (W and the up arrow both walk up) or on none:
// then it waits in the tray under the keyboard until the player binds it again.
// Escape always pauses and closes windows and Enter always moves dialogue on: those two are never rebound.

// the actions, in the order the tray and the help list show them. skill0..skill5 are the skill bar's first six places
// (rpg.js Hero.slots: 0 1 2 regular, 3 the ultimate, 4 5 regular); which skill sits in each is the hero's, the key is ours.
// Round 30 (Roy: "unlimited skill slots"): there are as many places as skills she binds. skill6, skill7, ... are made up on
// demand (ACTION below answers for any skillN); place 3 stays the ultimate's, so only one ultimate is ever on a key.
import { isOnline } from './mode.js';
// BETA ONLINE Phase E: the stats window (js/online/statswin.js) is an online action only, on O (Roy: "a key fairly far to the
// right"). In the campaign the action does not exist: it is not in the table, the keyboard window or the tray.
const ONLINE = isOnline();
export const ACTIONS = [
  { id: 'up', group: 'move', name: { he: 'תנועה למעלה', en: 'Move up' }, short: { he: '▲', en: '▲' } },
  { id: 'left', group: 'move', name: { he: 'תנועה שמאלה', en: 'Move left' }, short: { he: '◀', en: '◀' } },
  { id: 'down', group: 'move', name: { he: 'תנועה למטה', en: 'Move down' }, short: { he: '▼', en: '▼' } },
  { id: 'right', group: 'move', name: { he: 'תנועה ימינה', en: 'Move right' }, short: { he: '▶', en: '▶' } },
  { id: 'sprint', group: 'move', name: { he: 'ריצה (בהחזקה)', en: 'Sprint (hold)' }, short: { he: 'ריצה', en: 'RUN' }, pi: 'chevrons' },
  { id: 'dodge', group: 'fight', name: { he: 'גלגול', en: 'Roll' }, short: { he: 'גלגול', en: 'ROLL' }, pi: 'chevrons' },
  { id: 'attack', group: 'fight', name: { he: 'מכה (בהחזקה: מכה טעונה)', en: 'Strike (hold: charged blow)' }, short: { he: 'מכה', en: 'ATK' }, pi: 'sword' },
  { id: 'block', group: 'fight', name: { he: 'מגן (בהחזקה)', en: 'Shield (hold)' }, short: { he: 'מגן', en: 'BLOCK' }, pi: 'shield' },
  { id: 'interact', group: 'world', name: { he: 'לדבר, להרים, לרכוב, לעלות לסירה', en: 'Talk, pick up, ride, board' }, short: { he: 'פעולה', en: 'USE' }, pi: 'scroll' },
  { id: 'skill0', group: 'skill', slot: 0 }, { id: 'skill1', group: 'skill', slot: 1 }, { id: 'skill2', group: 'skill', slot: 2 },
  { id: 'skill4', group: 'skill', slot: 4 }, { id: 'skill5', group: 'skill', slot: 5 }, { id: 'skill3', group: 'skill', slot: 3 },
  { id: 'potion0', group: 'item', name: { he: 'שיקוי חיים', en: 'Health potion' }, short: { he: 'חיים', en: 'HP' }, pi: 'potion' },
  { id: 'potion1', group: 'item', name: { he: 'שיקוי מאנה', en: 'Mana potion' }, short: { he: 'מאנה', en: 'MP' }, pi: 'potion-mp' },
  { id: 'whistle', group: 'world', name: { he: 'לקרוא לרכוב / לשלוח אותו', en: 'Call / send off your mount' }, short: { he: 'רכוב', en: 'MOUNT' }, pi: 'horseshoe' }, // round 30: the Call mount skill (vehicles.js callMount)
  { id: 'map', group: 'menu', name: { he: 'מפת העולם', en: 'World map' }, short: { he: 'מפה', en: 'MAP' }, pi: 'compass' },
  { id: 'inventory', group: 'menu', name: { he: 'התיק', en: 'Satchel' }, short: { he: 'תיק', en: 'BAG' }, pi: 'bag' },
  { id: 'skills', group: 'menu', name: { he: 'חלון הכישורים', en: 'Skills window' }, short: { he: 'כישורים', en: 'SKILLS' }, pi: 'bolt' }, // round 33 (Roy's spec §20): K
  { id: 'quests', group: 'menu', name: { he: 'יומן המשימות', en: 'Quest log', es: 'Diario de misiones' }, short: { he: 'משימות', en: 'QUESTS', es: 'MISIONES' }, pi: 'quest' }, // Roy 30.10: the quest log (questlog.js): U, beside I, K and O
  ...(ONLINE ? [{ id: 'stats', group: 'menu', name: { he: 'חלון התכונות', en: 'Stats window' }, short: { he: 'תכונות', en: 'STATS' }, pi: 'star' }] : []), // online only: O
  { id: 'pause', group: 'menu', name: { he: 'הפסקה', en: 'Pause' }, short: { he: 'הפסקה', en: 'PAUSE' }, pi: 'pause' },
  { id: 'fast', group: 'menu', name: { he: 'מהירות משחק x1.5 (לא בקרב)', en: 'Game speed x1.5 (not in fights)' }, short: { he: 'x1.5', en: 'x1.5' }, pi: 'chevrons' },
];
// BETA ONLINE Phase I (Roy 26.10): the party (P), guild (G) and friends (B) windows, online only (js/online/social/). Online,
// P leaves the pause (Escape always pauses) and G and B are never handed to a newly learnt skill. The campaign is unchanged.
export const SOCIAL_KEYS = Object.freeze({ KeyP: 'party', KeyG: 'guild', KeyB: 'friends' });
if (ONLINE) ACTIONS.push(
  { id: 'party', group: 'menu', name: { he: 'חלון הפארטי', en: 'Party window' }, short: { he: 'פארטי', en: 'PARTY' }, pi: 'player' },
  { id: 'guild', group: 'menu', name: { he: 'חלון הגילד', en: 'Guild window' }, short: { he: 'גילד', en: 'GUILD' }, pi: 'emblem' },
  { id: 'friends', group: 'menu', name: { he: 'חלון החברים', en: 'Friends window' }, short: { he: 'חברים', en: 'FRIENDS' }, pi: 'star' },
);
// 'skill12' -> 12; anything else -> -1
export const skillSlotOf = (a) => { const m = typeof a === 'string' && /^skill(\d{1,3})$/.exec(a); return m ? +m[1] : -1; };
export const MAX_SKILL_SLOTS = 400; // far more than there are skills: only a guard against a broken save
const BASE = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
const DYN = {};
// every fixed action, and a skill place for any skillN (made the first time it is asked for)
export const ACTION = new Proxy(BASE, {
  get(o, k) {
    if (typeof k !== 'string' || k in o) return o[k];
    const n = skillSlotOf(k); if (n < 0 || n >= MAX_SKILL_SLOTS) return undefined;
    return DYN[k] || (DYN[k] = { id: k, group: 'skill', slot: n });
  },
  has(o, k) { return k in o || (skillSlotOf(k) >= 0 && skillSlotOf(k) < MAX_SKILL_SLOTS); },
});
// the keys a newly learnt skill takes when the default places are full (round 30): near the left hand first
// (online: not O, which is the stats window's, nor G and B, the guild's and the friends'; freeKey also never takes a key that holds anything)
const FREE_KEYS = ['KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyY', 'KeyU', 'KeyO', 'KeyN', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyH'].filter((c) => !ONLINE || (c !== 'KeyO' && !SOCIAL_KEYS[c]));
const SKILL_KEYS = ['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyX', 'KeyZ']; // skill0..skill5 (F is the ultimate's place)

// today's keys: the defaults a new game and every old save start from, and what "Reset to default" brings back
export const DEFAULTS = Object.freeze({
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'dodge', KeyJ: 'attack', KeyL: 'block', KeyT: 'interact', // round 33: the shield moved K -> L (beside J), K opens the skills
  KeyK: 'skills', KeyU: 'quests', // (Roy 30.10: U opens the quest log, questlog.js)
  ...Object.fromEntries(SKILL_KEYS.map((k, i) => [k, 'skill' + i])),
  Digit1: 'potion0', Numpad1: 'potion0', Digit2: 'potion1', Numpad2: 'potion1',
  KeyH: 'whistle', KeyM: 'map', KeyI: 'inventory', Tab: 'inventory', KeyP: 'pause', ControlLeft: 'fast',
  ...(ONLINE ? { KeyO: 'stats', ...SOCIAL_KEYS } : {}), // BETA ONLINE: the stats window; P party (Escape still pauses), G guild, B friends
});
// keys that keep their job whatever the table says (and can't take another)
export const LOCKED = Object.freeze({ Escape: 'pause', Enter: 'advance' });
// keys the browser keeps (reload, fullscreen, developer tools): drawn, never bound
export const BROWSER = Object.freeze({ F5: 1, F11: 1, F12: 1 });
const MODS = new Set(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
export const isModifier = (code) => MODS.has(code);

let map = { ...DEFAULTS };
let rev = null; // action -> [codes], rebuilt on change
const subs = new Set();
const changed = () => { rev = null; for (const f of subs) { try { f(); } catch (e) { console.warn('keys', e); } } };
function reverse() {
  if (rev) return rev;
  rev = {};
  for (const [c, a] of Object.entries(map)) (rev[a] || (rev[a] = [])).push(c);
  return rev;
}
// prefer the main block's key over its numpad / arrow / right-hand twin when one key has to stand for the action
const rank = (c) => (/^Numpad/.test(c) ? 2 : /^Arrow/.test(c) ? 1 : /Right$/.test(c) ? 1 : 0);

export const keys = {
  actionOf: (code) => LOCKED[code] || (BROWSER[code] ? null : map[code]) || null,
  keysOf: (action) => (reverse()[action] || []).slice().sort((a, b) => rank(a) - rank(b)),
  keyOf: (action) => keys.keysOf(action)[0] || null,
  isLocked: (code) => !!(LOCKED[code] || BROWSER[code]),
  // put `action` on `code`. `from`: the key it was picked up from (that key goes blank); `only`: take the action off
  // every other key (a skill moves as a whole). Returns the action the key held before if it is left with no key at all.
  place(action, code, { from = null, only = false } = {}) {
    if (!ACTION[action] || keys.isLocked(code) || !code) return null;
    const prev = map[code] || null;
    if (from && from !== code && map[from] === action) delete map[from];
    if (only) for (const [c, a] of Object.entries(map)) if (a === action && c !== code) delete map[c];
    map[code] = action;
    changed();
    return prev && prev !== action && !keys.keysOf(prev).length ? prev : null;
  },
  // take whatever is on `code` off it; returns that action if it now has no key
  clear(code) {
    const prev = map[code]; if (!prev) return null;
    delete map[code]; changed();
    return keys.keysOf(prev).length ? null : prev;
  },
  reset() { map = { ...DEFAULTS }; changed(); },
  isDefault() { const a = Object.entries(map), b = Object.entries(DEFAULTS); return a.length === b.length && a.every(([c, x]) => DEFAULTS[c] === x); },
  // the actions in `list` that sit on no key: the tray
  unbound: (list) => list.filter((a) => !keys.keysOf(a).length),
  // what the save keeps: null while nothing changed (an old save and a fresh one read the same), else the whole table
  toJSON: () => (keys.isDefault() ? null : { v: ONLINE ? 4 : KEYS_V, q: 1, map: { ...map } }), // (q: saved since the quest log's key; versions untouched, so online keeps reading campaign tables as before)
  load(d) {
    map = { ...DEFAULTS };
    if (d && d.map && typeof d.map === 'object') {
      const m = {};
      for (const [c, a] of Object.entries(d.map)) if (typeof c === 'string' && ACTION[a] && !keys.isLocked(c)) m[c] = a;
      map = (d.v | 0) < 2 ? migrateV1(m) : m;
      if (ONLINE && (d.v | 0) < 3) map = withStats(map); // (online tables are v 3: one saved since then keeps the player's choice)
      if (ONLINE && (d.v | 0) < 4) map = withSocial(map); // (and v 4 since the social windows)
      if (!d.q) map = withQuests(map); // (and the quest log, Roy 30.10)
    }
    changed();
  },
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  // round 30: every skill place that sits on a key now, by place (the ultimate's place 3 left out unless `ult`)
  skillActions(ult = false) {
    const out = new Set();
    for (const a of Object.values(map)) { const n = skillSlotOf(a); if (n >= 0 && (ult || n !== 3)) out.add(a); }
    return [...out].sort((a, b) => skillSlotOf(a) - skillSlotOf(b));
  },
  // a key that holds nothing, for a newly learnt skill (the letters near the hand first, then the number row)
  freeKey() { return FREE_KEYS.find((c) => !map[c] && !keys.isLocked(c)) || null; },
  get table() { return { ...map }; },
};

// Round 33 (Roy's spec §20): K opens the skills window. A table saved before (v 1) had the shield on K: the shield moves to L
// (its new default, beside J's strike) or, if the player has put something on L, to the first key of SHIELD_KEYS nothing holds;
// with every one of them taken it waits in the tray (the right mouse button still raises it). K then takes the skills window.
// A player who had put something else on K keeps it: the skills window then waits in the tray, to be bound wherever they like.
const KEYS_V = 2;
const SHIELD_KEYS = ['KeyL', 'KeyU', 'KeyO', 'KeyN', 'KeyB', 'KeyG', 'KeyY'];
export function migrateV1(m) {
  m = { ...m };
  if (Object.values(m).includes('skills')) return m;
  const shieldOnK = m.KeyK === 'block';
  if (shieldOnK) {
    delete m.KeyK;
    if (!Object.values(m).includes('block')) { const k = SHIELD_KEYS.find((c) => !m[c]); if (k) m[k] = 'block'; }
  }
  if (!m.KeyK) m.KeyK = 'skills';
  return m;
}
// BETA ONLINE: a key table saved before the stats window existed (the online player's own, or the campaign's it started from)
// gets it on O when O holds nothing; otherwise it waits in the tray, to be bound wherever the player likes
export function withStats(m) {
  if (Object.values(m).includes('stats')) return m;
  return m.KeyO ? m : { ...m, KeyO: 'stats' };
}
// BETA ONLINE Phase I: a table saved before the party, guild and friends windows gets each on its key (P, G, B) when that
// key holds nothing or only the old pause (Escape still pauses); otherwise it waits in the tray
export function withSocial(m) {
  const o = { ...m };
  for (const [c, a] of Object.entries(SOCIAL_KEYS)) if (!Object.values(o).includes(a) && (!o[c] || o[c] === 'pause')) o[c] = a;
  return o;
}
// Roy 30.10: a key table saved before the quest log gets it on U when U holds nothing; otherwise it waits in the tray
export function withQuests(m) {
  if (Object.values(m).includes('quests')) return m;
  return m.KeyU ? m : { ...m, KeyU: 'quests' };
}
// how a key is written: `label` on the keyboard window and in help text, `short` on the small HUD caps
const NAMED = {
  Space: ['Space', 'SPC'], Enter: ['Enter', 'ENT'], Escape: ['Esc', 'ESC'], Tab: ['Tab', 'TAB'], Backspace: ['Bksp', 'BKS'],
  CapsLock: ['Caps', 'CAP'], ShiftLeft: ['L-Shift', 'SHF'], ShiftRight: ['R-Shift', 'RSH'], ControlLeft: ['L-Ctrl', 'CTL'],
  ControlRight: ['R-Ctrl', 'RCT'], AltLeft: ['L-Alt', 'ALT'], AltRight: ['R-Alt', 'RAL'], MetaLeft: ['Meta', 'MET'], MetaRight: ['Meta', 'MET'],
  ArrowUp: ['↑', '↑'], ArrowDown: ['↓', '↓'], ArrowLeft: ['←', '←'], ArrowRight: ['→', '→'],
  Backquote: ['`', '`'], Minus: ['-', '-'], Equal: ['=', '='], BracketLeft: ['[', '['], BracketRight: [']', ']'], Backslash: ['\\', '\\'],
  Semicolon: [';', ';'], Quote: ["'", "'"], Comma: [',', ','], Period: ['.', '.'], Slash: ['/', '/'], IntlBackslash: ['\\', '\\'],
  Insert: ['Ins', 'INS'], Delete: ['Del', 'DEL'], Home: ['Home', 'HOM'], End: ['End', 'END'], PageUp: ['PgUp', 'PGU'], PageDown: ['PgDn', 'PGD'],
  NumpadAdd: ['Num +', 'N+'], NumpadSubtract: ['Num -', 'N-'], NumpadMultiply: ['Num *', 'N*'], NumpadDivide: ['Num /', 'N/'],
  NumpadDecimal: ['Num .', 'N.'], NumpadEnter: ['Num Ent', 'NEN'], ContextMenu: ['Menu', 'MNU'],
};
export function keyLabel(code, short = false) {
  if (!code) return short ? '' : '—';
  const n = NAMED[code]; if (n) return n[short ? 1 : 0];
  let m;
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
  if ((m = /^Digit(\d)$/.exec(code))) return m[1];
  if ((m = /^Numpad(\d)$/.exec(code))) return short ? 'N' + m[1] : 'Num ' + m[1];
  if ((m = /^F(\d{1,2})$/.exec(code))) return code;
  return code.replace(/(Left|Right)$/, '').slice(0, short ? 3 : 8);
}
// the key an action sits on, written for text ("—" when it has none)
// (Roy 31.10, the control modes, controls.js): in Controller mode the HUD and the hints name the controller's buttons instead
// of keys: setPadLabels({ action: 'A', ... }) or null for the keys again
let padLabels = null;
export function setPadLabels(m) { padLabels = m || null; changed(); }
export const actionKey = (action, short = false) => padLabels?.[action] || keyLabel(keys.keyOf(action), short);
// a few actions' keys for help lines: "W A S D", "Q E R X Z"
// the regular skills' keys in place order ("Q E R X Z C ...")
export const regSkillActions = () => keys.skillActions(false);
export const actionKeys = (list, short = false) => list.map((a) => keys.keyOf(a)).filter(Boolean).map((c) => keyLabel(c, short)).join(' ') || '—';
