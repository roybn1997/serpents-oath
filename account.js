// The account on the website (account.html), the same account as the launcher and the game (Roy 31.10: "Make the site
// have Sign in and Register, so it can be done from the website too"). The same steps as the launcher
// (game repo launcher/app/lib/account.js), through supabase-js:
//   * sign in with a username or an email and the password (a username: public.login_email() hands back the address
//     only with the right password); an address never confirmed goes to the code step with a fresh code;
//   * register: invitation code (8 letters and digits, sent as the sign-up's invite_code; BETA), username, email, password (8+), date of birth, gender, the terms (the launcher's own form and rules,
//     account-rules.js); the sign-up trigger makes the same profile the game reads. "Confirm email" is on: Supabase mails
//     a 6-digit code ({{ .Token }}), typed here (verifyOtp type 'signup');
//   * forgot password: a mailed code (verifyOtp type 'recovery') or its link back to this page, then the new password;
//   * Google / Facebook (OAuth, back to this page); a first OAuth sign-in or an older account finishes here
//     (redeem_invite when account_status.needs_invite, then complete_profile: username, birth date, gender, the terms), as in the launcher;
//   * signed in: your own page (profile.js) with your characters, and Sign out.
// ?next=<forum.html?...> comes back to that page after signing in; ?mode=register opens the registration.
(() => {
  const F = window.SoF, R = window.SO_RULES, el = F.el, t = F.t;
  const Q = new URLSearchParams(location.search);
  const next = F.safeNext(Q.get('next'));
  const S = { view: 'loading', notice: null, noticeOk: false, busy: false, legal: { terms_version: '2026-10-30', min_age: 13 }, providers: null,
    email: '', confirmFrom: 'register', sentAt: 0, resendAt: 0, status: null, user: null, me: null, chars: null, charsErr: null, recoveryLink: false };
  const draft = {}; // what is typed, kept across views and language switches
  const FIELD = { USERNAME_TAKEN: 'username', USERNAME_INVALID: 'username', EMAIL_TAKEN: 'email', EMAIL_INVALID: 'email', TOO_YOUNG: 'birthDate',
    BIRTH_DATE_INVALID: 'birthDate', BIRTH_DATE_LOCKED: 'birthDate', GENDER_INVALID: 'gender', TERMS_REQUIRED: 'acceptTerms', TERMS_OUTDATED: 'acceptTerms',
    BAD_CREDENTIALS: 'password', PASSWORD_WEAK: 'password', SAME_PASSWORD: 'password', CODE_INVALID: 'code', CODE_WRONG: 'code', CODE_EXPIRED: 'code',
    INVITE_REQUIRED: 'inviteCode', INVITE_INVALID: 'inviteCode', INVITE_FORMAT: 'inviteCode' };
  const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const nfkc = (s) => String(s == null ? '' : s).trim().normalize('NFKC');
  const sb = () => F.client();
  const absUrl = (p) => new URL(p, location.href).href;
  const back = () => absUrl('account.html' + (next ? '?next=' + encodeURIComponent(next) : ''));

  // ---------- small form parts ----------
  let errs = {}; // field -> code
  function fld(id, labelKey, input, { hint } = {}) {
    const f = el('div', 'fld' + (errs[id] ? ' bad' : '')); f.dataset.f = id;
    const lb = el('label', '', t(labelKey)); lb.htmlFor = 'a-' + id;
    input.id = 'a-' + id;
    const m = el('div', 'ferrm', errs[id] ? feText(errs[id]) : ''); m.id = 'a-' + id + '-err'; input.setAttribute('aria-describedby', m.id);
    if (errs[id]) input.setAttribute('aria-invalid', 'true');
    f.append(lb, input);
    if (hint) f.append(el('span', 'hint', hint));
    f.append(m);
    return f;
  }
  const feText = (code) => t('fe_' + code) !== 'fe_' + code ? t('fe_' + code) : F.msg(code);
  function inp(name, type = 'text', auto = '') {
    const i = el('input'); i.type = type; i.name = name; if (auto) i.autocomplete = auto;
    if (draft[name] != null && type !== 'password') i.value = draft[name];
    i.addEventListener('input', () => { draft[name] = i.value; });
    if (type === 'email' || name === 'identifier' || name === 'username') { i.dir = 'auto'; i.spellcheck = false; i.autocapitalize = 'off'; }
    if (name === 'inviteCode') { // 8 capitals, no spaces, left to right in every language
      i.dir = 'ltr'; i.spellcheck = false; i.autocapitalize = 'characters'; i.maxLength = 16; i.placeholder = 'XXXXXXXX'; i.classList.add('invite');
      i.style.textTransform = 'uppercase'; i.style.letterSpacing = '.2em'; i.style.textAlign = 'left';
      i.value = R.cleanInvite(draft[name]).slice(0, R.INVITE_LENGTH);
      i.addEventListener('input', () => { const v = R.cleanInvite(i.value).slice(0, R.INVITE_LENGTH); if (v !== i.value) i.value = v; draft[name] = v; });
    }
    return i;
  }
  function form(onSubmit) {
    const f = el('form', 'fform'); f.noValidate = true;
    f.addEventListener('submit', (e) => { e.preventDefault(); if (!S.busy) onSubmit(f); });
    return f;
  }
  function submit(labelKey) { const b = el('button', 'btn gold wide', t(labelKey)); b.type = 'submit'; return b; }
  function textBtn(labelKey, fn) { const b = el('button', 'tlink', t(labelKey)); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function noticeEl() { const p = el('p', 'fmsg' + (S.notice ? (S.noticeOk ? ' ok' : ' err') : '')); if (S.notice) { p.textContent = S.noticeOk ? S.notice : F.msg(S.notice); p.setAttribute('role', S.noticeOk ? 'status' : 'alert'); } return p; }
  function go(view, patch = {}) { Object.assign(S, { notice: null, noticeOk: false }, patch, { view }); errs = patch.errs || {}; render(); focusFirst(); }
  function focusFirst() { setTimeout(() => { const x = document.querySelector('#view .fld.bad input, #view .fld.bad select, #view form input:not([type=hidden]):not([type=checkbox]):not([type=radio])'); x?.focus(); }, 0); }
  function fail(e) {
    const code = F.code(e), f = FIELD[code];
    errs = e && e.fields ? e.fields : f ? { [f]: code } : {};
    S.notice = code; S.noticeOk = false; S.busy = false; render(); focusFirst();
  }
  async function run(fn) {
    if (S.busy) return; S.busy = true; render();
    try { await fn(); } catch (e) { fail(e); return; }
    S.busy = false; render();
  }

  // the birth date: day / month / year (as the launcher)
  function birthPicker(locked) {
    const wrap = el('div', 'dob'), [y0, m0, d0] = String(draft.birthDate || '').split('-');
    const mk = (name, label, opts, val) => { const s = el('select'); s.name = name; s.setAttribute('aria-label', t(label)); s.append(new Option(t(label), '')); for (const [v, l] of opts) s.append(new Option(l, v, false, v === val)); s.disabled = !!locked; return s; };
    const now = new Date().getFullYear();
    const days = mk('day', 'g_day', Array.from({ length: 31 }, (_, i) => [String(i + 1).padStart(2, '0'), String(i + 1)]), d0);
    const mons = mk('month', 'g_month', Array.from({ length: 12 }, (_, i) => [String(i + 1).padStart(2, '0'), F.lang() === 'he' ? MONTHS_HE[i] : (t('mon') || [])[i] || String(i + 1)]), m0);
    const years = mk('year', 'g_year', Array.from({ length: now - 1899 }, (_, i) => [String(now - i), String(now - i)]), y0);
    const sync = () => { draft.birthDate = years.value && mons.value && days.value ? `${years.value}-${mons.value}-${days.value}` : ''; };
    for (const s of [days, mons, years]) s.addEventListener('change', sync);
    wrap.append(days, mons, years);
    wrap.id = 'a-birthDate-box';
    return wrap;
  }
  function genderPicker() {
    const box = el('div', 'radios'); box.setAttribute('role', 'radiogroup');
    for (const g of ['male', 'female', 'other']) {
      const l = el('label', 'radio'), r = el('input'); r.type = 'radio'; r.name = 'gender'; r.value = g; r.checked = draft.gender === g;
      r.addEventListener('change', () => { draft.gender = g; });
      l.append(r, el('span', '', t('g_g_' + g))); box.append(l);
    }
    return box;
  }
  function acceptBox() {
    const f = el('div', 'fld' + (errs.acceptTerms ? ' bad' : '')), l = el('label', 'check'), c = el('input');
    c.type = 'checkbox'; c.name = 'acceptTerms'; c.id = 'a-acceptTerms'; c.checked = draft.acceptTerms === true;
    c.addEventListener('change', () => { draft.acceptTerms = c.checked; });
    const lt = el('a', '', t('g_terms_link')); lt.href = 'terms.html'; lt.target = '_blank'; lt.rel = 'noopener';
    const lp = el('a', '', t('g_privacy_link')); lp.href = 'privacy.html'; lp.target = '_blank'; lp.rel = 'noopener';
    const sp = el('span'); sp.append(F.tn('g_accept', { age: String(S.legal.min_age || 13), terms: lt, privacy: lp }));
    l.append(c, sp); f.append(l);
    f.append(el('div', 'ferrm', errs.acceptTerms ? feText(errs.acceptTerms) : ''));
    return f;
  }
  function strength(input) {
    const box = el('div', 'pstr'), bar = el('i'), lab = el('span');
    const upd = () => { const s = R.passwordScore(input.value); box.dataset.s = s; bar.style.width = (s * 25) + '%'; lab.textContent = s ? t('g_strength_l', { s: t('g_strength')[s] }) : ''; };
    input.addEventListener('input', upd); upd();
    const track = el('span', 'trk'); track.append(bar); box.append(track, lab);
    return box;
  }
  // the six code boxes (a paste fills them all)
  function codeBoxes() {
    const wrap = el('div', 'code6' + (errs.code ? ' bad' : '')); wrap.id = 'a-code'; wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', t('g_confirm_code'));
    const boxes = [];
    for (let i = 0; i < R.CODE_LENGTH; i++) {
      const b = el('input'); b.type = 'text'; b.inputMode = 'numeric'; b.autocomplete = i ? 'off' : 'one-time-code'; b.maxLength = 1; b.dir = 'ltr';
      b.setAttribute('aria-label', t('g_digit', { n: i + 1, m: R.CODE_LENGTH })); b.value = (draft.code || '')[i] || '';
      b.addEventListener('input', () => {
        const d = b.value.replace(/\D/g, '');
        if (d.length > 1) { fill(d); return; }
        b.value = d; draft.code = boxes.map((x) => x.value).join('');
        if (d && boxes[i + 1]) boxes[i + 1].focus();
        if (draft.code.length === R.CODE_LENGTH) wrap.closest('form')?.requestSubmit();
      });
      b.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) { boxes[i - 1].focus(); boxes[i - 1].value = ''; draft.code = boxes.map((x) => x.value).join(''); e.preventDefault(); } });
      b.addEventListener('paste', (e) => { const d = (e.clipboardData?.getData('text') || '').replace(/\D/g, ''); if (d) { e.preventDefault(); fill(d); } });
      boxes.push(b); wrap.append(b);
    }
    function fill(d) { boxes.forEach((x, j) => { x.value = d[j] || ''; }); draft.code = boxes.map((x) => x.value).join(''); (boxes[Math.min(d.length, R.CODE_LENGTH - 1)]).focus(); if (draft.code.length === R.CODE_LENGTH) wrap.closest('form')?.requestSubmit(); }
    return wrap;
  }
  function oauthButtons() {
    const box = el('div', 'oauth');
    for (const p of ['google', 'facebook']) {
      const b = el('button', 'btn oa ' + p); b.type = 'button';
      const ic = el('span', 'oi ' + p); ic.setAttribute('aria-hidden', 'true'); ic.textContent = p === 'google' ? 'G' : 'f';
      b.append(ic, el('span', '', t('g_' + p)));
      b.addEventListener('click', () => oauth(p));
      box.append(b);
    }
    return box;
  }

  // ---------- the views ----------
  function shell(titleKey, subText, body, { wide = false } = {}) {
    const grid = el('div', 'acct-grid' + (wide ? ' wide' : ''));
    const box = el('section', 'acct-box panel');
    box.append(el('h1', '', t(titleKey)));
    if (subText) box.append(el('p', 'sub', subText));
    box.append(body);
    grid.append(box, infoPanel());
    return grid;
  }
  // the right-hand panel: what the account is for
  function infoPanel() {
    const p = el('aside', 'acct-info panel');
    const img = el('img'); img.src = 'assets/icon-256.png'; img.alt = ''; img.width = 96; img.height = 96;
    p.append(img, el('h2', '', 'The Serpent\'s Oath'), el('p', '', t('g_sub_register')));
    const ul = el('ul');
    for (const [icon, k] of [['pi-scroll', 'f_title'], ['pi-gstar', 'ranks'], ['pi-sword', 'u_chars']]) {
      const li = el('li'), i = el('img'); i.src = `assets/${icon}.png`; i.alt = ''; i.width = 22; i.height = 22; li.append(i, el('span', '', t(k))); ul.append(li);
    }
    p.append(ul);
    return p;
  }

  function vSignin() {
    const f = form(signIn);
    const id = inp('identifier', 'text', 'username'), pw = inp('password', 'password', 'current-password');
    f.append(fld('identifier', 'g_identifier', id), fld('password', 'g_password', pw));
    const row = el('div', 'frow'); row.append(el('span', 'grow'), textBtn('g_forgot_link', () => go('forgot'))); f.append(row);
    f.append(noticeEl(), submit('g_signin_btn'), el('p', 'or', t('g_or')), oauthButtons());
    const sw = el('p', 'switch'); sw.append(t('g_new_here') + ' ', textBtn('g_register_link', () => go('register'))); f.append(sw);
    return shell('g_title_signin', t('g_sub_signin'), f);
  }
  function vRegister() {
    const f = form(register);
    const un = inp('username', 'text', 'username'), em = inp('email', 'email', 'email'), pw = inp('password', 'password', 'new-password'), pw2 = inp('password2', 'password', 'new-password');
    f.append(fld('inviteCode', 'g_invite', inp('inviteCode', 'text', 'off'), { hint: t('g_invite_hint') }), fld('username', 'g_username', un, { hint: t('g_username_hint') }), fld('email', 'g_email', em));
    const pf = fld('password', 'g_password', pw); pf.insertBefore(strength(pw), pf.querySelector('.ferrm')); f.append(pf, fld('password2', 'g_password2', pw2));
    const bd = el('div', 'fld' + (errs.birthDate ? ' bad' : '')); bd.append(el('span', 'lbl', t('g_birth')), birthPicker(false), el('div', 'ferrm', errs.birthDate ? feText(errs.birthDate) : '')); f.append(bd);
    const gd = el('div', 'fld' + (errs.gender ? ' bad' : '')); gd.append(el('span', 'lbl', t('g_gender')), genderPicker(), el('div', 'ferrm', errs.gender ? feText(errs.gender) : '')); f.append(gd);
    f.append(acceptBox(), el('p', 'hint', t('g_parent')), noticeEl(), submit('g_register_btn'), el('p', 'or', t('g_or')), oauthButtons());
    const sw = el('p', 'switch'); sw.append(t('g_have_account') + ' ', textBtn('g_signin_link', () => go('signin'))); f.append(sw);
    return shell('g_title_register', t('g_sub_register'), f);
  }
  function vConfirm() {
    const f = form(verify);
    f.append(fld('code', 'g_confirm_code', codeBoxes(), { hint: t('g_confirm_hint') }));
    f.append(noticeEl(), submit('g_confirm_btn'));
    const row = el('div', 'frow');
    const rs = textBtn('g_confirm_resend', resend);
    // the countdown changes only this button (redrawing the form would take the typing out of the code boxes)
    const tick = () => {
      if (!rs.isConnected && tick.started) return;
      tick.started = true;
      const wait = Math.max(0, Math.ceil((S.resendAt - Date.now()) / 1000));
      rs.disabled = !!wait || S.busy; rs.textContent = wait ? t('g_confirm_resend_in', { s: wait }) : t('g_confirm_resend');
      if (wait) setTimeout(tick, 1000);
    };
    tick();
    row.append(rs, el('span', 'grow'), textBtn('g_back', () => { draft.identifier = S.email; go('signin'); }));
    f.append(row);
    const em = el('b', 'ltrnum', S.email);
    const sub = el('p', 'sub'); sub.append(F.tn(S.confirmFrom === 'signin' ? 'g_confirm_sub_signin' : 'g_confirm_sub', { email: em }));
    const g = shell('g_confirm_title', null, f); g.querySelector('h1').after(sub);
    return g;
  }
  function vForgot() {
    const f = form(forgot);
    f.append(fld('email', 'g_email', inp('email', 'email', 'email')), noticeEl(), submit('g_send'));
    const row = el('div', 'frow'); row.append(el('span', 'grow'), textBtn('g_back', () => go('signin'))); f.append(row);
    return shell('g_forgot_title', t('g_forgot_sub'), f);
  }
  function vReset() {
    const f = form(reset);
    if (!S.recoveryLink) f.append(fld('code', 'g_code', codeBoxes()));
    const pw = inp('password', 'password', 'new-password');
    const pf = fld('password', 'g_new_password', pw); pf.insertBefore(strength(pw), pf.querySelector('.ferrm'));
    f.append(pf, fld('password2', 'g_password2', inp('password2', 'password', 'new-password')), noticeEl(), submit('g_reset_btn'));
    const row = el('div', 'frow'); row.append(el('span', 'grow'), textBtn('g_back', () => go('signin'))); f.append(row);
    const sub = el('p', 'sub');
    if (S.recoveryLink) sub.textContent = t('g_reset_sub_link'); else sub.append(F.tn('g_reset_sub', { email: el('b', 'ltrnum', S.email) }));
    const g = shell('g_reset_title', null, f); g.querySelector('h1').after(sub);
    return g;
  }
  function vFinish() {
    const st = S.status || {}, f = form(finish);
    const who = el('p', 'hint'); who.append(F.tn('g_finish_who', { who: el('b', '', st.username || (S.user && S.user.email) || '') }), ' ');
    who.append(textBtn('g_not_you', signOut)); f.append(who);
    if (st.needs_invite) f.append(fld('inviteCode', 'g_invite', inp('inviteCode', 'text', 'off'), { hint: t('g_invite_hint') }));
    if (!st.has_profile) f.append(fld('username', 'g_username', inp('username', 'text', 'username'), { hint: t('g_username_hint') }));
    if (st.birth_date) draft.birthDate = st.birth_date;
    if (st.gender && !draft.gender) draft.gender = st.gender;
    const bd = el('div', 'fld' + (errs.birthDate ? ' bad' : '')); bd.append(el('span', 'lbl', t('g_birth')), birthPicker(!!st.birth_date), el('div', 'ferrm', errs.birthDate ? feText(errs.birthDate) : '')); f.append(bd);
    const gd = el('div', 'fld' + (errs.gender ? ' bad' : '')); gd.append(el('span', 'lbl', t('g_gender')), genderPicker(), el('div', 'ferrm', errs.gender ? feText(errs.gender) : '')); f.append(gd);
    f.append(acceptBox(), noticeEl(), submit('g_finish_btn'));
    return shell('g_finish_title', st.problem === 'TERMS_OUTDATED' ? t('g_finish_sub_terms') : t('g_finish_sub'), f);
  }
  function vMe() {
    const box = el('div', 'me-wrap');
    const side = el('aside', 'side'), b = el('section', 'sbox panel');
    b.append(el('h3', '', t('my_account')), el('p', '', t('signed_in_as', { u: S.me.username })));
    if (S.user && S.user.email && !/\.invalid$/.test(S.user.email)) { const e = el('p', 'hint ltrnum', S.user.email); b.append(e); }
    const fo = el('a', 'btn gold', t('go_forum')); fo.href = 'forum.html';
    const so = el('button', 'btn', t('sign_out')); so.type = 'button'; so.addEventListener('click', signOut);
    b.append(fo, so); side.append(b);
    SoProfile.draw(box, S.me, { own: true, chars: S.chars, charsErr: S.charsErr, side });
    return box;
  }

  function render() {
    const v = document.getElementById('view'); v.textContent = '';
    v.setAttribute('aria-busy', String(S.busy || S.view === 'loading'));
    if (S.view === 'loading') { v.append(el('p', 'loading', t('g_checking'))); return; }
    const titles = { signin: 'g_title_signin', register: 'g_title_register', confirm: 'g_confirm_title', forgot: 'g_forgot_title', reset: 'g_reset_title', finish: 'g_finish_title', me: 'my_account', fatal: 'my_account' };
    document.title = `${t(titles[S.view] || 'my_account')} · The Serpent's Oath`;
    if (S.view === 'fatal') { v.append(F.errorBox(S.notice)); return; }
    const view = { signin: vSignin, register: vRegister, confirm: vConfirm, forgot: vForgot, reset: vReset, finish: vFinish, me: vMe }[S.view]();
    v.append(view);
    if (S.busy) v.querySelectorAll('button, input, select').forEach((x) => { x.disabled = true; });
  }

  // ---------- the actions ----------
  async function signIn() {
    errs = R.signInProblems({ identifier: draft.identifier, password: val('password') });
    if (Object.keys(errs).length) { S.notice = 'FORM'; render(); focusFirst(); return; }
    const pw = val('password');
    await run(async () => {
      let email = String(draft.identifier).trim();
      if (!R.looksLikeEmail(email)) {
        email = await F.rpc('login_email', { p_username: nfkc(email), p_password: pw });
        if (!email) throw Object.assign(new Error(''), { soCode: 'BAD_CREDENTIALS' });
      }
      const { data, error } = await sb().auth.signInWithPassword({ email, password: pw });
      if (error) {
        if (F.code(error) === 'EMAIL_NOT_CONFIRMED') { await toConfirm(email, 'signin'); return; }
        throw error;
      }
      await adopt(data.session);
    });
  }
  async function register() {
    const f = { inviteCode: draft.inviteCode, username: draft.username, email: draft.email, password: val('password'), password2: val('password2'), birthDate: draft.birthDate, gender: draft.gender, acceptTerms: draft.acceptTerms === true };
    errs = R.registerProblems(f, new Date());
    if (Object.keys(errs).length) { S.notice = 'FORM'; render(); focusFirst(); return; }
    await run(async () => {
      const username = nfkc(f.username), email = String(f.email).trim();
      const st = await F.rpc('username_status', { p_username: username });
      if (st === 'TAKEN') throw Object.assign(new Error(''), { soCode: 'USERNAME_TAKEN', fields: { username: 'TAKEN' } });
      if (typeof st === 'string' && st.startsWith('INVALID:')) throw Object.assign(new Error(''), { soCode: 'USERNAME_INVALID', fields: { username: st.slice(8) } });
      const { data, error } = await sb().auth.signUp({ email, password: f.password, options: { emailRedirectTo: back(),
        data: { username, birth_date: f.birthDate, gender: f.gender, terms_version: S.legal.terms_version, invite_code: R.cleanInvite(f.inviteCode) } } });
      if (error) throw error;
      delete draft.inviteCode; // (used up)
      // an address already registered: Supabase answers with a user that has no identities (and sends nothing)
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw Object.assign(new Error(''), { soCode: 'EMAIL_TAKEN' });
      if (data.session) { await adopt(data.session); return; }
      await toConfirm(email, 'register');
    });
  }
  async function toConfirm(email, from) {
    const now = Date.now();
    Object.assign(S, { email, confirmFrom: from, sentAt: from === 'register' ? now : 0, resendAt: from === 'register' ? now + 60000 : 0 });
    if (from === 'signin') {
      const { error } = await sb().auth.resend({ type: 'signup', email, options: { emailRedirectTo: back() } });
      if (!error || F.code(error) === 'RATE_LIMITED') { S.sentAt = now; S.resendAt = now + 60000; }
    }
    draft.code = ''; S.busy = false;
    go('confirm');
  }
  async function verify() {
    const p = R.codeProblem(draft.code);
    if (p) { errs = { code: p }; S.notice = 'FORM'; render(); return; }
    await run(async () => {
      const { data, error } = await sb().auth.verifyOtp({ email: S.email, token: R.cleanCode(draft.code), type: 'signup' });
      if (error) {
        if (F.code(error) === 'CODE_INVALID') { const c = !S.sentAt ? 'CODE_INVALID' : Date.now() - S.sentAt > 3600000 ? 'CODE_EXPIRED' : 'CODE_WRONG'; throw Object.assign(new Error(''), { soCode: c }); }
        throw error;
      }
      await adopt(data.session);
    });
  }
  async function resend() {
    if (S.resendAt > Date.now()) return;
    await run(async () => {
      const { error } = await sb().auth.resend({ type: 'signup', email: S.email, options: { emailRedirectTo: back() } });
      if (error) throw error;
      S.sentAt = Date.now(); S.resendAt = S.sentAt + 60000; S.notice = t('g_confirm_sent'); S.noticeOk = true;
    });
  }
  async function forgot() {
    const e = R.emailProblem(draft.email);
    if (e) { errs = { email: e }; S.notice = 'FORM'; render(); return; }
    await run(async () => {
      const email = String(draft.email).trim();
      const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: back() });
      if (error) throw error;
      S.email = email; S.recoveryLink = false; draft.code = ''; S.busy = false;
      go('reset', { notice: t('g_sent'), noticeOk: true });
    });
  }
  async function reset() {
    const f = { email: S.email || 'x@x.xx', code: S.recoveryLink ? '000000' : draft.code, password: val('password'), password2: val('password2') };
    errs = R.resetProblems(f);
    if (Object.keys(errs).length) { S.notice = 'FORM'; render(); return; }
    await run(async () => {
      if (!S.recoveryLink) {
        const { error } = await sb().auth.verifyOtp({ email: S.email, token: R.cleanCode(draft.code), type: 'recovery' });
        if (error) throw error;
      }
      const { error } = await sb().auth.updateUser({ password: f.password });
      if (error) throw error;
      S.recoveryLink = false;
      const { data } = await sb().auth.getSession();
      await adopt(data.session);
    });
  }
  async function oauth(provider) {
    if (S.providers && S.providers[provider] === false) { S.notice = 'PROVIDER_OFF'; S.noticeOk = false; render(); return; }
    await run(async () => {
      const { error } = await sb().auth.signInWithOAuth({ provider, options: { redirectTo: back() } });
      if (error) throw error; // (otherwise the browser is on its way to the provider)
    });
  }
  async function finish() {
    const st = S.status || {};
    const f = { inviteCode: draft.inviteCode, username: draft.username, birthDate: st.birth_date || draft.birthDate, gender: draft.gender, acceptTerms: draft.acceptTerms === true };
    errs = R.finishProblems(f, { needUsername: !st.has_profile, needInvite: !!st.needs_invite }, new Date());
    if (Object.keys(errs).length) { S.notice = 'FORM'; render(); focusFirst(); return; }
    await run(async () => {
      if (!st.has_profile) {
        const u = await F.rpc('username_status', { p_username: nfkc(f.username) });
        if (u === 'TAKEN') throw Object.assign(new Error(''), { soCode: 'USERNAME_TAKEN', fields: { username: 'TAKEN' } });
      }
      if (st.needs_invite) { // Google / Facebook: the code first, once the form and the username are right (a good code is used up for good)
        S.status = await F.rpc('redeem_invite', { p_code: R.cleanInvite(f.inviteCode) });
        delete draft.inviteCode;
      }
      S.status = await F.rpc('complete_profile', { p_username: st.has_profile ? null : nfkc(f.username), p_birth_date: f.birthDate, p_gender: f.gender, p_terms_version: S.legal.terms_version });
      if (!S.status.ready) throw Object.assign(new Error(''), { soCode: S.status.problem || 'ERROR' });
      await afterReady();
    });
  }
  async function signOut() {
    try { await sb().auth.signOut({ scope: 'local' }); } catch (e) { /* offline: the local session goes anyway */ }
    window.SoNav?.set(null);
    Object.keys(draft).forEach((k) => delete draft[k]);
    go('signin', { notice: t('ae_SIGNED_OUT'), noticeOk: true, status: null, me: null, user: null });
  }
  const val = (name) => document.querySelector(`#view input[name="${name}"]`)?.value || '';

  // a session: is the account ready (profile, age, terms)? then your page, or back to where you came from
  async function adopt(session) {
    if (!session) throw Object.assign(new Error(''), { soCode: 'SESSION_EXPIRED' });
    S.user = session.user;
    S.status = await F.rpc('account_status');
    if (!S.status.ready) { window.SoNav?.set(S.status.username || null); S.busy = false; go('finish'); return; }
    await afterReady();
  }
  async function afterReady() {
    if (next) { window.SoNav?.set(S.status.username); location.replace(next); return; }
    S.me = await F.rpc('forum_user', { p_username: S.status.username });
    window.SoNav?.set(S.me.username);
    const { data, error } = await sb().from('characters').select('name,level,active_job,jobs,appearance,slot,portrait_png').order('slot');
    S.chars = error ? null : data || []; S.charsErr = error ? t('u_chars_err') : null;
    S.busy = false; go('me');
  }

  // ---------- start ----------
  async function start() {
    if (!sb()) { go('fatal', { notice: 'NOT_CONFIGURED' }); return; }
    sb().auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { S.recoveryLink = true; S.busy = false; S.view = 'reset'; setTimeout(() => go('reset'), 0); } });
    F.rpc('legal_info').then((l) => { if (l && l.terms_version) S.legal = l; }).catch(() => {});
    // which sign-in providers the project has turned on (the Facebook button says "not available yet" until it is)
    fetch(String(window.SITE.SUPABASE_URL).replace(/\/+$/, '') + '/auth/v1/settings', { headers: { apikey: window.SITE.ANON_KEY } })
      .then((r) => (r.ok ? r.json() : null)).then((s) => { if (s && s.external) S.providers = s.external; }).catch(() => {});
    // an error coming back from Google / Facebook or an old link
    const h = new URLSearchParams(location.hash.slice(1));
    const oerr = Q.get('error_description') || h.get('error_description') || Q.get('error') || h.get('error');
    let session = null;
    try { const { data } = await sb().auth.getSession(); session = data.session; } catch (e) { /* the code in the address could not be used */ }
    if (Q.has('code') || Q.has('error') || h.has('error') || h.has('access_token')) history.replaceState(null, '', location.pathname + (next ? '?next=' + encodeURIComponent(next) : ''));
    if (S.view === 'reset') return; // (a password-reset link: choose the new password first)
    if (session) { try { await adopt(session); } catch (e) { S.view = 'signin'; fail(e); } return; }
    window.SoNav?.set(null);
    go(Q.get('mode') === 'register' ? 'register' : 'signin');
    if (oerr) { S.notice = /expired|flow_state/i.test(oerr) ? 'OAUTH_EXPIRED' : 'OAUTH_DENIED'; render(); }
  }
  F.boot(render);
  start();
})();
