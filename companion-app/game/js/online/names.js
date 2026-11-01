// BETA ONLINE name rules, the browser's copy. The server's copy decides (server/supabase/migrations/*_phase_b.sql:
// username_problem, character_name_problem, username_local_part, norm_name); the browser checks first only so the
// player gets a quick, clear message. server/supabase/test/db.test.mjs runs both copies on the same names.
// Pure module: no DOM, no storage (node can import it).

const HE = 'א-ת'; // Hebrew letters U+05D0..U+05EA (the final forms are inside the range)
export const USERNAME = { min: 3, max: 16 };
export const CHAR_NAME = { min: 3, max: 16 };
const RESERVED_USER = ['admin', 'administrator', 'gm', 'moderator', 'mod', 'system', 'support', 'root', 'serpents_oath'];
const RESERVED_CHAR = ['val', 'rain', 'philon', 'athena', 'zeus', 'hades', 'poseidon', 'admin', 'gm', 'moderator', 'system'];

const nfkc = (s) => String(s).normalize('NFKC');
// the comparable form: NFKC, lower case
export const normName = (raw) => nfkc(raw).toLowerCase();
const len = (s) => [...s].length; // code points, like Postgres char_length

// a username's problem, or null: EMPTY, LENGTH, CHARS, START, RESERVED
export function usernameProblem(raw) {
  if (raw == null || raw === '') return 'EMPTY';
  const n = nfkc(raw);
  if (len(n) < USERNAME.min || len(n) > USERNAME.max) return 'LENGTH';
  if (!new RegExp(`^[A-Za-z0-9_${HE}]+$`).test(n)) return 'CHARS';
  if (!new RegExp(`^[A-Za-z${HE}]`).test(n)) return 'START';
  if (RESERVED_USER.includes(n.toLowerCase())) return 'RESERVED';
  return null;
}

// a character name's problem, or null: EMPTY, LENGTH, SPACES, CHARS, NO_LETTER, RESERVED
export function characterNameProblem(raw) {
  if (raw == null || raw === '') return 'EMPTY';
  const n = nfkc(raw);
  if (len(n) < CHAR_NAME.min || len(n) > CHAR_NAME.max) return 'LENGTH';
  if (/^[ _]|[ _]$|[ _]{2}/.test(n)) return 'SPACES';
  if (!new RegExp(`^[A-Za-z0-9${HE} _]+$`).test(n)) return 'CHARS';
  if (!new RegExp(`[A-Za-z${HE}]`).test(n)) return 'NO_LETTER';
  if (RESERVED_CHAR.includes(n.toLowerCase().replace(/[ _]/g, ''))) return 'RESERVED';
  return null;
}

// the local part of the account's sign-in address (Supabase Auth needs an email; players never see it)
export function usernameLocalPart(norm) {
  if (/^[a-z0-9_]+$/.test(norm)) return norm;
  return 'x-' + [...new TextEncoder().encode(norm)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const usernameEmail = (raw, domain) => `${usernameLocalPart(normName(raw))}@${domain}`;
