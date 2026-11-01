// The account forms' rules: a copy of the launcher's (game repo launcher/app/ui/rules.js, unchanged below this comment),
// so the website checks a sign-up exactly as the launcher does. The server checks everything again (its answers count).
// The account forms' rules, in one place for the launcher's page (window.SO_RULES, quick messages as the player types)
// and its main process (lib/account.js checks everything again before anything is sent). The server checks them once
// more (server/supabase/migrations/20261109160000_account_profile.sql, and phase B's username_problem): its answers are
// the ones that count. Usernames follow js/online/names.js (3-16 Latin/Hebrew letters, digits, _, starting with a letter).
(function (root, make) {
  const R = make();
  if (typeof module === 'object' && module.exports) module.exports = R; else root.SO_RULES = R;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const USERNAME = { min: 3, max: 16 };
  const PASSWORD = { min: 8, max: 72 }; // 72 bytes: the most bcrypt (Supabase Auth's hash) reads
  const MIN_AGE = 13;
  const GENDERS = ['male', 'female', 'other'];
  const RESERVED = ['admin', 'administrator', 'gm', 'moderator', 'mod', 'system', 'support', 'root', 'serpents_oath'];

  // null, or the rule it breaks: EMPTY, LENGTH, CHARS, START, RESERVED (the server's username_problem)
  function usernameProblem(raw) {
    const n = String(raw == null ? '' : raw).trim().normalize('NFKC');
    if (!n) return 'EMPTY';
    const len = [...n].length;
    if (len < USERNAME.min || len > USERNAME.max) return 'LENGTH';
    if (!/^[A-Za-z0-9_א-ת]+$/.test(n)) return 'CHARS';
    if (!/^[A-Za-zא-ת]/.test(n)) return 'START';
    if (RESERVED.includes(n.toLowerCase())) return 'RESERVED';
    return null;
  }

  // null, EMPTY or FORMAT (a sensible address: something@domain.tld, no spaces, at most 254 characters)
  function emailProblem(raw) {
    const e = String(raw == null ? '' : raw).trim();
    if (!e) return 'EMPTY';
    if (e.length > 254 || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) return 'FORMAT';
    return null;
  }
  const looksLikeEmail = (s) => String(s || '').includes('@');

  // 0 (empty) .. 4 (strong): length and kinds of characters
  function passwordScore(p) {
    p = String(p || '');
    if (!p) return 0;
    let kinds = 0;
    if (/[a-zא-ת]/.test(p)) kinds++;
    if (/[A-Z]/.test(p)) kinds++;
    if (/\d/.test(p)) kinds++;
    if (/[^A-Za-z0-9א-ת]/.test(p)) kinds++;
    const len = [...p].length;
    let s = len >= 12 ? 2 : len >= PASSWORD.min ? 1 : 0;
    s += kinds >= 3 ? 2 : kinds >= 2 ? 1 : 0;
    return Math.max(1, Math.min(4, s));
  }
  // null or: EMPTY, SHORT, LONG, WEAK (needs a letter and a digit or symbol), SAME (the username or the address in it),
  // REPEAT (one character over and over)
  function passwordProblem(p, { username = '', email = '' } = {}) {
    p = String(p == null ? '' : p);
    if (!p) return 'EMPTY';
    if ([...p].length < PASSWORD.min) return 'SHORT';
    const bytes = typeof TextEncoder === 'function' ? new TextEncoder().encode(p).length : Buffer.byteLength(p);
    if (bytes > PASSWORD.max) return 'LONG';
    if (/^(.)\1+$/.test(p)) return 'REPEAT';
    if (!/[A-Za-zא-ת]/.test(p) || !/[^A-Za-zא-ת]/.test(p)) return 'WEAK';
    const low = p.toLowerCase(), u = String(username || '').trim().toLowerCase(), local = String(email || '').trim().toLowerCase().split('@')[0];
    if ((u.length >= 3 && low.includes(u)) || (local.length >= 3 && low.includes(local))) return 'SAME';
    return null;
  }

  // 'YYYY-MM-DD' -> {y, m, d} when it is a real calendar date, else null
  function parseDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { y, m: mo, d };
  }
  const todayParts = (today) => { const t = today || new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; };
  // whole years between the birth date and today (a birthday today counts)
  function ageOn(iso, today) {
    const b = parseDate(iso); if (!b) return null;
    const t = todayParts(today);
    return t.y - b.y - ((t.m < b.m || (t.m === b.m && t.d < b.d)) ? 1 : 0);
  }
  // null or: EMPTY, INVALID, FUTURE, TOO_OLD (before 1900), TOO_YOUNG (under MIN_AGE)
  function birthProblem(iso, today) {
    if (!iso) return 'EMPTY';
    const b = parseDate(iso); if (!b) return 'INVALID';
    if (b.y < 1900) return 'TOO_OLD';
    const t = todayParts(today), pad = (n) => String(n).padStart(2, '0');
    if (iso > `${t.y}-${pad(t.m)}-${pad(t.d)}`) return 'FUTURE';
    if (ageOn(iso, today) < MIN_AGE) return 'TOO_YOUNG';
    return null;
  }
  const genderProblem = (g) => (GENDERS.includes(g) ? null : 'EMPTY');

  // every problem of the registration form, { field: code } (empty object = fine)
  function registerProblems(f, today) {
    const out = {};
    const put = (k, v) => { if (v) out[k] = v; };
    put('username', usernameProblem(f.username));
    put('email', emailProblem(f.email));
    put('password', passwordProblem(f.password, { username: f.username, email: f.email }));
    if (!out.password && f.password !== f.password2) out.password2 = 'MISMATCH';
    put('birthDate', birthProblem(f.birthDate, today));
    put('gender', genderProblem(f.gender));
    if (f.acceptTerms !== true) out.acceptTerms = 'REQUIRED';
    return out;
  }
  // "finish your account": the username only when the account has none yet (a first Google / Facebook sign-in)
  function finishProblems(f, { needUsername = false } = {}, today) {
    const out = {};
    const put = (k, v) => { if (v) out[k] = v; };
    if (needUsername) put('username', usernameProblem(f.username));
    put('birthDate', birthProblem(f.birthDate, today));
    put('gender', genderProblem(f.gender));
    if (f.acceptTerms !== true) out.acceptTerms = 'REQUIRED';
    return out;
  }
  function signInProblems(f) {
    const out = {};
    const id = String(f.identifier || '').trim();
    if (!id) out.identifier = 'EMPTY';
    else if (looksLikeEmail(id)) { const e = emailProblem(id); if (e) out.identifier = e; }
    else { const u = usernameProblem(id); if (u) out.identifier = 'USER_' + u; }
    if (!f.password) out.password = 'EMPTY';
    return out;
  }
  // the one-time codes in Supabase's mails (sign-up confirmation, password reset): 6 digits (Roy 31.10: the project's
  // "Email OTP Length" is set to 6; the code page has six boxes). Spaces and dashes that come with a paste are dropped.
  const CODE_LENGTH = 6;
  const cleanCode = (raw) => String(raw == null ? '' : raw).replace(/[\s\u00a0-]/g, '');
  function codeProblem(raw) {
    const c = cleanCode(raw);
    if (!c) return 'CODE';
    return new RegExp('^\\d{' + CODE_LENGTH + '}$').test(c) ? '' : 'CODE_DIGITS';
  }
  function resetProblems(f) {
    const out = {};
    const c = codeProblem(f.code); if (c) out.code = c;
    const p = passwordProblem(f.password, { email: f.email });
    if (p) out.password = p; else if (f.password !== f.password2) out.password2 = 'MISMATCH';
    return out;
  }

  return { USERNAME, PASSWORD, MIN_AGE, GENDERS, usernameProblem, emailProblem, looksLikeEmail, passwordScore, passwordProblem,
    parseDate, ageOn, birthProblem, genderProblem, registerProblems, finishProblems, signInProblems, resetProblems, cleanCode, codeProblem, CODE_LENGTH };
}));
