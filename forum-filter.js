// The forum's word filter, the browser's copy (an instant message while typing). The server's copy decides:
// private.forum_problem() in the game repo's server/supabase/migrations/20261111120000_forum.sql, run by a trigger on every
// topic title and post. Both take the same steps on the same list (public.forum_filter_words() hands it out), and the
// game repo's tests/forum_sql.mjs runs this file and the server on the same texts.
//   1. normalize: NFKC, lower case, no Hebrew points, Hebrew final letters made ordinary, no accents (ñ kept), no quote
//      marks or geresh, @ -> a, $ -> s, ! before a letter -> i
//   2. words: split at everything but letters and digits (digits read as letters in a word with a Latin letter), each run
//      between spaces with its inside punctuation dropped, and runs of single letters joined
//   3. a listed word must be a whole word (each letter may repeat; a Hebrew one may carry up to two of ו ה ב ל ש כ in
//      front), a phrase whole words in a row, a stem anywhere in a word
// Pure: no DOM (node can load it).
(function (root, make) {
  const F = make();
  if (typeof module === 'object' && module.exports) module.exports = F; else root.SoFilter = F;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const tr = (s, from, to) => { const a = [...from], b = [...to]; return [...s].map((c) => { const i = a.indexOf(c); return i < 0 ? c : (b[i] ?? ''); }).join(''); };
  function norm(p) {
    let s = String(p == null ? '' : p).normalize('NFKC');
    s = tr(s, 'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÝÑ', 'áàâäãåéèêëíìîïóòôöõúùûüçýñ').toLowerCase();
    s = s.replace(/[֑-ׇ]/g, '');
    s = tr(s, 'ךםןףץ', 'כמנפצ');
    s = tr(s, 'áàâäãåéèêëíìîïóòôöõúùûüçý', 'aaaaaaeeeeiiiiooooouuuucy');
    s = s.replace(/['’‘׳״"`]/g, '').replace(/@/g, 'a').replace(/\$/g, 's').replace(/!(?=[a-z])/g, 'i');
    return s;
  }
  const leet = (w) => (/[a-z]/.test(w) ? tr(w, '013457', 'oieast') : w);
  // the regular expression of a listed word (the server's private.forum_word_re)
  function wordRe(word, kind) {
    let body = '';
    const cs = [...word];
    for (let i = 0; i < cs.length;) {
      let n = 1; while (i + n < cs.length && cs[i + n] === cs[i]) n++;
      body += cs[i] === ' ' ? ' ' : `${cs[i]}{${n},}`;
      i += n;
    }
    const pre = /^[א-ת]/.test(word) && kind !== 's' ? '[והבלשכ]{0,2}' : '';
    return new RegExp(kind === 'w' ? `^${pre}${body}$` : kind === 'p' ? `(^| )${pre}${body}( |$)` : body);
  }
  // compile the list once: [{w, k}] from forum_filter_words()
  function compile(list) {
    return (Array.isArray(list) ? list : []).filter((x) => x && typeof x.w === 'string' && /^[a-zñא-ת]+( [a-zñא-ת]+)*$/.test(x.w) && ['w', 'p', 's'].includes(x.k))
      .map((x) => ({ k: x.k, re: wordRe(x.w, x.k) }));
  }
  function readings(text) {
    const s = norm(text);
    const words = s.split(/[^a-z0-9ñא-ת]+/).filter(Boolean).map(leet);
    const cands = words.slice();
    for (const chunk of s.split(/\s+/)) { const t = leet(chunk.replace(/[^a-z0-9ñא-ת]/g, '')); if (t) cands.push(t); }
    let run = '', len = 0;
    for (const t of [...words, '']) {
      if ([...t].length === 1) { run += t; len++; } else { if (len >= 2) cands.push(run); run = ''; len = 0; }
    }
    return { cands, line: words.join(' ') };
  }
  // 'PROFANITY' or null
  function problem(text, compiled) {
    if (!compiled || !compiled.length) return null;
    const { cands, line } = readings(text);
    if (!cands.length) return null;
    for (const w of compiled) {
      if (w.k === 'p' ? w.re.test(line) : cands.some((c) => w.re.test(c))) return 'PROFANITY';
    }
    return null;
  }
  return { norm, compile, problem, wordRe };
}));
