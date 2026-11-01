// What the forum, account and player pages share (forum.html, account.html, user.html): the language (lang.js, but the
// layout stays left-to-right in every language, as in the game: only the words change), the link to Supabase (the
// same project and accounts as the launcher and the game: SITE.SUPABASE_URL / ANON_KEY in updates.js, the library
// supabase-js loaded from jsDelivr at a fixed version), the server's error codes as the player's words, dates, post
// text (plain text, line breaks kept, web links made clickable; never markup), and the rank badge and author card
// every post shows. window.SoF.
(() => {
  const SITE = window.SITE || {}, FT = window.SO_FT || {}, AT = window.SO_AT || {};
  let L = 'en', sb = null, me = null;
  const F = {};

  // ---------- words ----------
  F.lang = () => L;
  F.t = (k, v) => {
    let s = FT[L]?.[k] ?? AT[L]?.[k] ?? FT.en?.[k] ?? AT.en?.[k] ?? k;
    if (typeof s === 'string' && v) s = s.replace(/\{(\w+)\}/g, (m, x) => (x in v ? String(v[x]) : m));
    return s;
  };
  F.el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  // a text with {x} parts filled by nodes (e.g. a link inside a sentence)
  F.tn = (k, parts) => {
    const frag = document.createDocumentFragment(), s = F.t(k);
    for (const bit of s.split(/(\{\w+\})/)) { const m = /^\{(\w+)\}$/.exec(bit); if (m && parts[m[1]] != null) frag.append(parts[m[1]]); else if (bit) frag.append(bit); }
    return frag;
  };
  // the page's language: lang.js picks it (?lang, the last choice, else English) and its globe changes it; the page
  // stays dir="ltr" (Hebrew lines still read right to left: forum.css, as the game's style.css)
  F.boot = (render) => {
    L = window.SoLang ? SoLang.pick() : 'en';
    const paint = () => {
      if (window.SoLang) SoLang.show(L);
      document.documentElement.dir = 'ltr';
      document.querySelectorAll('[data-t]').forEach((e) => { if (!e.closest('.bar')) e.textContent = F.t(e.dataset.t); }); // (the bar: nav.js and nav-auth.js)
      window.SoNav?.paint();
      render();
    };
    paint();
    if (window.SoLang) SoLang.mount((l) => { L = l; paint(); });
  };

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  F.date = (iso) => {
    const d = new Date(iso); if (isNaN(d)) return '';
    return L === 'he' ? `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}` : `${d.getDate()} ${F.t('mon')[d.getMonth()]} ${d.getFullYear()}`;
  };
  F.dateTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${F.date(iso)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  F.timeEl = (iso, withTime = true) => { const e = F.el('time', 'tm ltrnum', withTime ? F.dateTime(iso) : F.date(iso)); e.dateTime = iso; return e; };

  // ---------- Supabase ----------
  const url = String(SITE.SUPABASE_URL || '').trim().replace(/\/+$/, ''), key = String(SITE.ANON_KEY || '').trim();
  F.client = () => {
    if (sb) return sb;
    if (!window.supabase || !window.supabase.createClient || !url || !key) return null;
    sb = window.supabase.createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return sb;
  };
  // the stable code of an error from supabase-js (Auth or the REST API), as the launcher's lib/auth.js toError
  F.code = (e) => {
    if (!e) return 'ERROR';
    if (typeof e === 'string') return e;
    if (e.soCode) return e.soCode;
    const msg = String(e.message || e.msg || e.error_description || ''), c = String(e.code || e.error_code || ''), st = +e.status || 0;
    if (c === 'P0001' && /^[A-Z_]+(:[A-Z_0-9]+)?$/.test(msg)) return msg.split(':')[0];
    if (e.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return 'NETWORK';
    if (c === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'BAD_CREDENTIALS';
    if (c === 'email_not_confirmed') return 'EMAIL_NOT_CONFIRMED';
    if (c === 'user_already_exists' || c === 'email_exists' || /already registered/i.test(msg)) return 'EMAIL_TAKEN';
    if (c === 'weak_password') return 'PASSWORD_WEAK';
    if (c === 'same_password') return 'SAME_PASSWORD';
    if (c === 'email_address_invalid' || (c === 'validation_failed' && /email/i.test(msg))) return 'EMAIL_INVALID';
    if (c === 'signup_disabled' || c === 'email_provider_disabled') return 'SIGNUP_CLOSED';
    if (c === 'provider_disabled' || /provider is not enabled|unsupported provider/i.test(msg)) return 'PROVIDER_OFF';
    if (c === 'otp_expired' || c === 'otp_disabled' || /token has expired or is invalid/i.test(msg)) return 'CODE_INVALID';
    if (c === 'flow_state_not_found' || c === 'flow_state_expired' || c === 'bad_code_verifier') return 'OAUTH_EXPIRED';
    if (c === 'refresh_token_not_found' || c === 'session_not_found' || c === 'bad_jwt' || c === 'PGRST301' || c === 'PGRST303') return 'SESSION_EXPIRED';
    if (st === 429 || c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit' || /rate limit|only request this after/i.test(msg)) return 'RATE_LIMITED';
    if (st === 500 && /saving new user/i.test(msg)) return 'SIGNUP_REJECTED';
    if (c === '42501' || st === 403) return 'FORBIDDEN';
    if (st >= 500) return 'SERVICE';
    return 'ERROR';
  };
  // the player's words for a code: the forum's (e_*), else the account forms' (ae_*), else "something went wrong"
  F.msg = (code) => FT[L]?.['e_' + code] || AT[L]?.['ae_' + code] || FT.en?.['e_' + code] || AT.en?.['ae_' + code] || F.t('e_ERROR');
  F.rpc = async (fn, args) => {
    const c = F.client(); if (!c) { const e = new Error('NOT_CONFIGURED'); e.soCode = 'NOT_CONFIGURED'; throw e; }
    const { data, error } = await c.rpc(fn, args || {});
    if (error) { const e = new Error(error.message); e.soCode = F.code(error); throw e; }
    return data;
  };
  F.session = async () => { const c = F.client(); if (!c) return null; try { const { data } = await c.auth.getSession(); return data.session || null; } catch (e) { return null; } };
  // who is signed in, for the forum: forum_me() ({signed_in, has_profile, username, ready, banned, admin, card}); the bar's link
  F.loadMe = async () => {
    const s = await F.session();
    if (!s) { me = { signed_in: false }; window.SoNav?.set(null); return me; }
    try { me = await F.rpc('forum_me'); } catch (e) { me = { signed_in: true, error: F.code(e) }; }
    window.SoNav?.set(me.username || (me.signed_in ? (s.user?.email || '').split('@')[0] : null));
    return me;
  };
  F.me = () => me;
  // a link back to this page after signing in (only a page of this site)
  F.here = () => location.pathname.split('/').pop() + location.search;
  F.signinHref = () => 'account.html?next=' + encodeURIComponent(F.here());
  F.safeNext = (n) => (typeof n === 'string' && /^(forum|user|account|index|wiki)\.html(\?[^#]*)?$/.test(n) ? n : null);

  // ---------- post text: plain, line breaks kept (CSS pre-wrap), web links clickable ----------
  const LINK = /\bhttps?:\/\/[^\s<>"']+/gi;
  F.body = (text) => {
    const frag = document.createDocumentFragment(), s = String(text || '');
    let at = 0;
    for (const m of s.matchAll(LINK)) {
      let u = m[0]; const tail = /[).,!?;:]+$/.exec(u); if (tail) u = u.slice(0, -tail[0].length);
      if (m.index > at) frag.append(s.slice(at, m.index));
      const a = F.el('a', 'ulink', u); a.href = u; a.target = '_blank'; a.rel = 'nofollow ugc noopener noreferrer'; a.dir = 'ltr';
      frag.append(a); at = m.index + u.length;
    }
    if (at < s.length) frag.append(s.slice(at));
    return frag;
  };

  // ---------- ranks ----------
  F.godName = (god) => (F.t('gods')[god] || [god])[0];
  F.godLine = (god) => (F.t('gods')[god] || ['', ''])[1];
  F.tier = (lv) => (lv >= 12 ? 'zeus' : lv >= 9 ? 'legend' : lv >= 5 ? 'epic' : 'common');
  // the small badge: the level in a satchel chip and the god's name; its hover card says what the rank means
  F.rankBadge = (rank, { big = false, link = true } = {}) => {
    const r = rank || { lv: 1, god: 'hestia', min: 0, next: 5 };
    const a = F.el(link ? 'a' : 'span', `rk t-${F.tier(r.lv)}${big ? ' big' : ''}`);
    if (link) a.href = 'forum.html?view=ranks';
    const b = F.el('b', 'ltrnum', String(r.lv)); b.setAttribute('aria-hidden', 'true');
    a.append(b, F.el('span', 'gd', F.godName(r.god)));
    const tip = F.el('span', 'tip'); tip.setAttribute('role', 'tooltip');
    tip.append(F.el('strong', '', `${F.godName(r.god)} · ${F.t('rank_lv', { n: r.lv })}`), F.el('span', '', F.godLine(r.god)), F.el('em', '', F.t('rank_from', { n: r.min })));
    a.append(tip);
    a.setAttribute('aria-label', `${F.godName(r.god)}, ${F.t('rank_lv', { n: r.lv })}`);
    return a;
  };
  // progress to the next rank: a thin bar and a line
  F.rankProgress = (points, rank, ranks) => {
    const box = F.el('div', 'rprog');
    const next = (ranks || []).find((x) => x.lv === rank.lv + 1);
    const bar = F.el('div', 'rbar'), fill = F.el('i');
    const pct = next ? Math.max(0, Math.min(100, ((points - rank.min) / (next.min - rank.min)) * 100)) : 100;
    fill.style.width = pct.toFixed(1) + '%'; bar.append(fill);
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    box.append(bar, F.el('p', '', next ? F.t(next.min - points === 1 ? 'to_next1' : 'to_next', { n: next.min - points, god: F.godName(next.god) }) : F.t('at_top')));
    return box;
  };
  F.RANKS = [['hestia', 0], ['demeter', 5], ['hephaestus', 15], ['hermes', 30], ['artemis', 60], ['aphrodite', 100], ['ares', 160], ['apollo', 250],
    ['athena', 400], ['poseidon', 600], ['hera', 900], ['zeus', 1300]].map(([god, min], i) => ({ lv: i + 1, god, min }));

  // an author's initial in a satchel slot (its ring the colour of the rank)
  F.avatar = (name, lv) => {
    const d = F.el('span', `av t-${F.tier(lv || 1)}`, [...String(name || '?')][0].toUpperCase());
    d.setAttribute('aria-hidden', 'true'); d.dir = 'auto';
    return d;
  };
  F.userLink = (name, cls = 'uname') => { const a = F.el('a', cls, name); a.href = 'user.html?u=' + encodeURIComponent(name); a.dir = 'auto'; return a; };
  // the card under every post's author: name, rank badge, joined, post count, ADMIN
  F.card = (au) => {
    const box = F.el('div', 'acard');
    if (!au) { box.append(F.avatar('?', 1), F.el('span', 'uname gone', F.t('deleted_user'))); return box; }
    box.append(F.avatar(au.u, au.rank?.lv), F.userLink(au.u));
    if (au.admin) box.append(F.el('span', 'pill gold adm', F.t('admin')));
    box.append(F.rankBadge(au.rank));
    const j = F.el('span', 'meta'); j.append(F.tn('joined', { d: F.timeEl(au.joined, false) })); box.append(j);
    const n = F.el('span', 'meta'); n.append(F.tn('posts_n', { n: F.el('b', 'ltrnum', String(au.posts)) })); box.append(n);
    return box;
  };

  // a page's error box (with the words for its code)
  F.errorBox = (code) => { const p = F.el('div', 'ferr panel'); p.setAttribute('role', 'alert'); p.append(F.el('p', '', F.msg(code))); return p; };
  window.SoF = F;
})();
