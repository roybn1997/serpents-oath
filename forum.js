// The forum (forum.html). One page, its view chosen by the address:
//   forum.html                 the categories, by section, with their counts and newest posts
//   forum.html?c=quests&p=2    a category's topics, 25 a page (pinned first, then by the last post)
//   forum.html?t=12&p=3        a topic and its posts, 20 a page (p=last: the last page), the reply box, an admin's tools
//   forum.html?new=quests      a new topic
//   forum.html?view=ranks      the ranks (the twelve Olympians) and how points are counted
// Everything is read and written through the server's forum_* functions (game repo
// server/supabase/migrations/20261111120000_forum.sql), which check every rule again; what players write is always set
// as text, never as markup. A language switch redraws from what was loaded (what is being typed is kept).
(() => {
  const F = window.SoF, el = F.el, t = F.t, $ = (s) => document.querySelector(s);
  const Q = new URLSearchParams(location.search);
  const route = { c: Q.get('c'), t: parseInt(Q.get('t'), 10) || null, p: Q.get('p') === 'last' ? 0 : Math.max(1, parseInt(Q.get('p'), 10) || 1), neu: Q.get('new'), view: Q.get('view') };
  const CFG = { titleMin: 3, titleMax: 120, bodyMin: 2, bodyMax: 10000 };
  const ICON = { gstar: 'assets/pi-gstar.png', emblem: 'assets/emblem.png', compass: 'assets/pi-compass.png', sword: 'assets/pi-sword.png', axe: 'assets/pi-axe.png',
    spear: 'assets/pi-spear.png', medal: 'assets/medal.png', gold: 'assets/mz-gold.png', horse: 'assets/pi-horse.png', scroll: 'assets/pi-scroll.png' };
  const SECTIONS = ['news', 'game', 'community', 'support'];
  let data = null, home = null, state = 'loading', errCode = null, words = null, editing = null, flash = null;

  const loc = (o) => (o && (o[F.lang()] || o.en)) || '';
  const view = () => $('#view');
  const link = (href, text, cls) => { const a = el('a', cls, text); a.href = href; return a; };
  const auto = (e) => { e.dir = 'auto'; return e; };

  // ---------- loading ----------
  async function load() {
    state = 'loading'; render();
    const meP = F.loadMe();
    try {
      if (!F.client()) throw Object.assign(new Error('NOT_CONFIGURED'), { soCode: 'NOT_CONFIGURED' });
      if (route.view === 'ranks') data = await F.rpc('forum_ranks');
      else if (route.t) data = await F.rpc('forum_topic', { p_topic: route.t, p_page: route.p });
      else if (route.c) data = await F.rpc('forum_topics', { p_category: route.c, p_page: route.p });
      else data = await F.rpc('forum_home');
      if (route.neu || route.t) home = home || await F.rpc('forum_home').catch(() => null);
      await meP;
      state = 'ok';
    } catch (e) { await meP; state = 'err'; errCode = F.code(e); }
    render();
    if (state === 'ok' && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }
  // the word list for the instant check (the server checks again whatever happens)
  async function loadWords() {
    if (words) return words;
    try { words = SoFilter.compile(await F.rpc('forum_filter_words')); } catch (e) { words = []; }
    return words;
  }

  // ---------- drawing ----------
  function render() {
    // keep what is being typed across a redraw (a language switch)
    const keep = {}; document.querySelectorAll('[data-keep]').forEach((e) => { keep[e.dataset.keep] = e.value; });
    const v = view(); v.textContent = '';
    v.setAttribute('aria-busy', String(state === 'loading'));
    if (state === 'loading') { v.append(el('p', 'loading', t('loading'))); return; }
    if (state === 'err') { v.append(crumbs([]), F.errorBox(errCode)); document.title = `${t('f_title')} · The Serpent's Oath`; return; }
    if (route.view === 'ranks') drawRanks(v);
    else if (route.t) drawTopic(v);
    else if (route.c) drawCategory(v);
    else if (route.neu) drawCompose(v);
    else drawHome(v);
    document.querySelectorAll('[data-keep]').forEach((e) => { if (keep[e.dataset.keep] != null) { e.value = keep[e.dataset.keep]; e.dispatchEvent(new Event('input')); } });
  }
  function crumbs(parts) {
    const n = el('nav', 'crumbs'); n.setAttribute('aria-label', 'Breadcrumb');
    const all = [[t('f_title'), parts.length ? 'forum.html' : null], ...parts];
    all.forEach(([label, href], i) => {
      if (i) n.append(el('span', 'sep', '›'));
      n.append(href ? link(href, label) : auto(el('span', 'cur', label)));
    });
    return n;
  }
  function head(title, sub, btn) {
    const h = el('div', 'fhead'), tt = el('div', 'tt'), h1 = auto(el('h1', '', title));
    tt.append(h1); if (sub) tt.append(el('p', '', sub));
    h.append(tt); if (btn) h.append(btn);
    return h;
  }
  function pager(page, pages, hrefOf) {
    const n = el('nav', 'pager'); if (pages <= 1) return n;
    n.setAttribute('aria-label', t('page', { n: page, m: pages }));
    if (page > 1) n.append(link(hrefOf(page - 1), t('prev'), 'wd'));
    const show = new Set([1, pages, page - 1, page, page + 1].filter((x) => x >= 1 && x <= pages));
    let last = 0;
    for (const x of [...show].sort((a, b) => a - b)) {
      if (x - last > 1) n.append(el('span', 'gap', '…'));
      if (x === page) { const s = el('span', 'on', String(x)); s.setAttribute('aria-current', 'page'); n.append(s); } else n.append(link(hrefOf(x), String(x)));
      last = x;
    }
    if (page < pages) n.append(link(hrefOf(page + 1), t('next'), 'wd'));
    return n;
  }
  function catIcon(c) { const d = el('span', 'cicon'), i = el('img'); i.src = ICON[c.icon] || ICON.scroll; i.alt = ''; i.width = 28; i.height = 28; d.append(i); return d; }

  // the side column: who you are (or sign in), the forum's numbers, the ranks
  function side(stats) {
    const s = el('aside', 'side'), me = F.me() || {};
    const box = el('section', 'sbox panel');
    if (!me.signed_in) {
      box.append(el('h3', '', t('sign_in_to_post')), el('p', '', t('sign_in_to_post_p')));
      box.append(link(F.signinHref(), t('nav_signin'), 'btn gold'), link('account.html?mode=register&next=' + encodeURIComponent(F.here()), t('g_register_link'), 'btn'));
    } else if (!me.has_profile || !me.ready) {
      box.append(el('h3', '', t('finish_to_post')), el('p', '', t('finish_to_post_p')), link('account.html?next=' + encodeURIComponent(F.here()), t('finish_btn_go'), 'btn gold'));
    } else {
      const c = me.card || {};
      box.append(el('h3', '', t('you')));
      const who = el('div', 'who'); who.append(F.avatar(me.username, c.rank?.lv), F.userLink(me.username)); box.append(who);
      if (me.admin) box.append(el('span', 'pill gold', t('admin')));
      const r = el('p'); r.append(F.rankBadge(c.rank)); box.append(r, F.rankProgress(c.points || 0, c.rank || F.RANKS[0], F.RANKS));
      if (me.banned) box.append(el('p', 'fnote warn', t('banned_note')));
      box.append(link('user.html?u=' + encodeURIComponent(me.username), t('your_page'), 'btn'));
    }
    s.append(box);
    if (stats) {
      const b = el('section', 'sbox panel'), dl = el('dl');
      b.append(el('h3', '', t('stats')));
      for (const [k, v] of [['stats_members', stats.members], ['stats_topics', stats.topics], ['stats_posts', stats.posts]]) dl.append(el('dt', '', t(k)), el('dd', '', String(v ?? 0)));
      if (stats.newest) { const dd = el('dd'); dd.append(F.userLink(stats.newest)); dl.append(el('dt', '', t('stats_newest')), dd); }
      b.append(dl); s.append(b);
    }
    const rb = el('section', 'sbox panel');
    rb.append(el('h3', '', t('ranks')), el('p', '', t('ranks_sub')), link('forum.html?view=ranks', t('ranks_link'), 'btn'));
    s.append(rb);
    return s;
  }

  // ---------- the front page ----------
  function drawHome(v) {
    document.title = `${t('f_title')} · The Serpent's Oath`;
    v.append(head(t('f_title'), t('f_sub')));
    const g = el('div', 'fgrid'), main = el('div', 'fmain');
    for (const sec of SECTIONS) {
      const cats = data.categories.filter((c) => c.section === sec);
      if (!cats.length) continue;
      const box = el('section', 'fsec panel'); box.setAttribute('aria-labelledby', 'sec-' + sec);
      const h = el('h2', '', t('sec_' + sec)); h.id = 'sec-' + sec; box.append(h);
      const cols = el('div', 'cols'); cols.setAttribute('aria-hidden', 'true');
      cols.append(el('span'), el('span'), el('span', '', t('c_topics')), el('span', '', t('c_posts')), el('span', '', t('c_last'))); box.append(cols);
      for (const c of cats) {
        const row = el('div', 'crow' + (sec === 'news' ? ' news' : '')), m = el('div', 'cmain');
        const a = link('forum.html?c=' + encodeURIComponent(c.id), loc(c.name), 'cname'); m.append(a);
        if (c.admin_only) m.append(el('span', 'pill', t('admins_only')));
        m.append(el('p', '', loc(c.blurb)));
        const n1 = el('div', 'cnum topics', String(c.topics)), n2 = el('div', 'cnum posts', String(c.posts));
        n1.setAttribute('aria-label', `${c.topics} ${t('c_topics')}`); n2.setAttribute('aria-label', `${c.posts} ${t('c_posts')}`);
        const last = el('div', 'clast');
        if (c.last) {
          last.append(auto(link(`forum.html?t=${c.last.topic}&p=last`, c.last.title, 'tl')));
          const by = el('span'); if (c.last.by) by.append(F.tn('by', { u: F.userLink(c.last.by) }), ' · '); by.append(F.timeEl(c.last.at)); last.append(by);
        } else last.append(el('span', '', t('c_none')));
        row.append(catIcon(c), m, n1, n2, last); box.append(row);
      }
      main.append(box);
    }
    g.append(main, side(data.stats)); v.append(g);
  }

  // ---------- a category ----------
  function drawCategory(v) {
    const c = data.category, me = F.me() || {};
    document.title = `${loc(c.name)} · ${t('f_title')} · The Serpent's Oath`;
    v.append(crumbs([[loc(c.name), null]]));
    let btn = null;
    if (data.can_post) btn = link('forum.html?new=' + encodeURIComponent(c.id), '+ ' + t('new_topic'), 'btn gold');
    else if (!me.signed_in && !c.admin_only) btn = link('account.html?next=' + encodeURIComponent('forum.html?new=' + c.id), '+ ' + t('new_topic'), 'btn gold');
    v.append(head(loc(c.name), loc(c.blurb), btn));
    if (c.admin_only && !data.admin) v.append(el('p', 'fnote spaced', t('admin_only_note')));
    const g = el('div', 'fgrid'), main = el('div', 'fmain'), box = el('section', 'tlist panel');
    if (!data.topics.length) box.append(el('p', 'empty', t('no_topics')));
    else {
      const cols = el('div', 'cols'); cols.setAttribute('aria-hidden', 'true');
      cols.append(el('span', '', t('th_topic')), el('span', '', t('th_replies')), el('span', '', t('th_last'))); box.append(cols);
      for (const tp of data.topics) box.append(topicRow(tp));
    }
    main.append(pager(data.page, data.pages, (p) => `forum.html?c=${encodeURIComponent(c.id)}&p=${p}`), box, pager(data.page, data.pages, (p) => `forum.html?c=${encodeURIComponent(c.id)}&p=${p}`));
    g.append(main, side(null)); v.append(g);
  }
  function topicRow(tp) {
    const row = el('div', 'trow' + (tp.pinned ? ' pin' : '')), ttl = el('div', 'ttl');
    if (tp.pinned) ttl.append(el('span', 'pill gold flag', t('pinned')));
    if (tp.locked) ttl.append(el('span', 'pill flag', t('locked')));
    ttl.append(auto(link(`forum.html?t=${tp.id}`, tp.title, 'tname')));
    const sub = el('div', 'sub');
    sub.append(F.tn('th_started', { u: tp.author ? F.userLink(tp.author.u) : el('span', '', t('deleted_user')), d: F.timeEl(tp.created_at, false) }));
    if (tp.author) sub.append(F.rankBadge(tp.author.rank));
    ttl.append(sub);
    const n = el('div', 'cnum', String(tp.replies)); n.setAttribute('aria-label', tp.replies === 1 ? t('reply_1') : t('replies_n', { n: tp.replies }));
    const last = el('div', 'clast'), when = link(`forum.html?t=${tp.id}&p=last`, '', 'tl'); when.append(F.timeEl(tp.last_post_at)); last.append(when);
    if (tp.last_by) { const by = el('span'); by.append(F.tn('by', { u: F.userLink(tp.last_by) })); last.append(by); }
    row.append(ttl, n, last);
    return row;
  }

  // ---------- a topic ----------
  function drawTopic(v) {
    const tp = data.topic, c = data.category, me = F.me() || {};
    document.title = `${tp.title} · ${t('f_title')} · The Serpent's Oath`;
    v.append(crumbs([[loc(c.name), 'forum.html?c=' + encodeURIComponent(c.id)], [tp.title, null]]));
    const h = head(tp.title, null);
    const flags = el('p', 'flags');
    if (tp.pinned) flags.append(el('span', 'pill gold', t('pinned')), ' ');
    if (tp.locked) flags.append(el('span', 'pill', t('locked')));
    if (flags.childNodes.length) h.querySelector('.tt').append(flags);
    v.append(h);
    if (data.admin) v.append(modBar(tp, c));
    const list = el('div', 'posts');
    const hrefOf = (p) => `forum.html?t=${tp.id}&p=${p}`;
    list.append(pager(data.page, data.pages, hrefOf));
    data.posts.forEach((p, i) => list.append(postEl(p, (data.page - 1) * data.per_page + i + 1)));
    list.append(pager(data.page, data.pages, hrefOf));
    v.append(list);
    // the reply box, or why there is none
    if (data.can_reply) v.append(replyForm(tp));
    else if (!me.signed_in) v.append(signinBox());
    else if (!me.has_profile || !me.ready) v.append(noteBox('finish_to_post', 'finish_to_post_p', 'account.html?next=' + encodeURIComponent(F.here()), 'finish_btn_go'));
    else if (me.banned) v.append(el('p', 'fnote warn', t('banned_note')));
    else if (tp.locked) v.append(el('p', 'fnote', t('locked_note')));
  }
  function signinBox() { return noteBox('sign_in_to_post', 'sign_in_to_post_p', F.signinHref(), 'nav_signin'); }
  function noteBox(hk, pk, href, bk) {
    const b = el('div', 'signin-box panel'), d = el('div');
    d.append(el('h3', '', t(hk)), el('p', '', t(pk))); b.append(d, link(href, t(bk), 'btn gold'));
    return b;
  }
  function postEl(p, n) {
    const art = el('article', 'post panel' + (p.op ? ' op' : '')); art.id = 'p' + p.id;
    art.append(F.card(p.author));
    const m = el('div', 'pmain'), ph = el('div', 'phead');
    ph.append(F.timeEl(p.created_at));
    if (p.edited_at) { const e = el('span', 'ed'); e.append(F.tn('edited', { d: F.timeEl(p.edited_at) })); ph.append(e); }
    const num = link('#p' + p.id, '#' + n, 'num'); ph.append(num);
    m.append(ph);
    if (editing === p.id) m.append(editForm(p));
    else {
      const body = auto(el('div', 'body')); body.append(F.body(p.body)); m.append(body);
      const foot = el('div', 'pfoot');
      if (data.can_reply && p.author) foot.append(btnLnk(t('quote'), () => quote(p)));
      if (p.mine && (!data.topic.locked || data.admin)) foot.append(btnLnk(t('edit'), () => { editing = p.id; render(); document.getElementById('edit-body')?.focus(); }));
      if ((p.mine && (!data.topic.locked || data.admin)) || data.admin) foot.append(btnLnk(t('delete'), () => del(p), 'danger'));
      if (foot.childNodes.length) m.append(foot);
    }
    art.append(m);
    return art;
  }
  function btnLnk(label, fn, cls = '') { const b = el('button', 'lnk ' + cls, label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function quote(p) {
    const ta = document.getElementById('reply-body'); if (!ta) return;
    const q = p.body.split('\n').slice(0, 6).map((l) => '> ' + l).join('\n');
    ta.value = (ta.value ? ta.value.replace(/\s*$/, '\n\n') : '') + `> ${p.author.u}:\n${q}\n\n`;
    ta.dispatchEvent(new Event('input')); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  async function del(p) {
    if (!confirm(t(p.op ? 'confirm_delete_topic' : 'confirm_delete'))) return;
    try {
      const r = await F.rpc('forum_delete', { p_post: p.id });
      if (r && r.topic_deleted) { location.href = 'forum.html?c=' + encodeURIComponent(data.category.id); return; }
      await reloadTopic();
    } catch (e) { alert(F.msg(F.code(e))); }
  }
  async function reloadTopic(page, hash) {
    if (page != null) route.p = page;
    const url = `forum.html?t=${route.t}${route.p !== 1 ? '&p=' + (route.p || 'last') : ''}`;
    history.replaceState(null, '', url + (hash ? '#' + hash : ''));
    data = await F.rpc('forum_topic', { p_topic: route.t, p_page: route.p });
    render();
    if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'center' });
  }
  function modBar(tp, c) {
    const bar = el('div', 'modbar panel');
    bar.append(el('b', '', t('mod_tools')));
    const act = (a, cat) => async () => {
      if (a === 'delete' && !confirm(t('confirm_delete_topic'))) return;
      try { await F.rpc('forum_mod', { p_topic: tp.id, p_action: a, p_category: cat || null }); if (a === 'delete') { location.href = 'forum.html?c=' + encodeURIComponent(cat || c.id); return; } await reloadTopic(); }
      catch (e) { alert(F.msg(F.code(e))); }
    };
    bar.append(btnLnk(t(tp.pinned ? 'mod_unpin' : 'mod_pin'), act(tp.pinned ? 'unpin' : 'pin')), btnLnk(t(tp.locked ? 'mod_unlock' : 'mod_lock'), act(tp.locked ? 'unlock' : 'lock')));
    const sel = el('select'); sel.setAttribute('aria-label', t('mod_move'));
    sel.append(new Option(t('mod_move'), ''));
    for (const k of (home?.categories || [])) if (k.id !== c.id) sel.append(new Option(loc(k.name), k.id));
    sel.addEventListener('change', () => { if (sel.value) act('move', sel.value)(); });
    bar.append(sel, btnLnk(t('mod_delete'), act('delete'), 'danger'));
    return bar;
  }

  // ---------- writing: the shared parts ----------
  // a text box with its counter and the instant word check
  function field(id, label, { area = false, max, keep, value = '' } = {}) {
    const f = el('div', 'fld'), lb = el('label', '', label), inp = el(area ? 'textarea' : 'input');
    lb.htmlFor = id; inp.id = id; inp.dir = 'auto'; inp.maxLength = max + 50; inp.dataset.keep = keep; inp.value = value;
    if (!area) inp.type = 'text';
    const row = el('div', 'frow'), msg = el('div', 'ferrm grow'), cnt = el('span', 'count ltrnum');
    msg.id = id + '-err'; msg.setAttribute('aria-live', 'polite'); inp.setAttribute('aria-describedby', msg.id);
    row.append(msg, cnt);
    const check = () => {
      const n = [...inp.value].length; cnt.textContent = t('chars', { n, m: max }); cnt.classList.toggle('over', n > max);
      const bad = words && SoFilter.problem(inp.value, words);
      msg.textContent = bad ? t('filter_live') : ''; f.classList.toggle('bad', !!bad || n > max);
    };
    inp.addEventListener('input', check); loadWords().then(check); check();
    f.append(lb, inp, row);
    return { f, inp };
  }
  // the client's own check before sending (the server checks again): null or an error code
  function problems(title, body) {
    if (title != null) { const n = [...title.trim()].length; if (n < CFG.titleMin || n > CFG.titleMax) return 'TITLE_LENGTH'; }
    const b = [...body.trim()].length; if (b < CFG.bodyMin || b > CFG.bodyMax) return 'BODY_LENGTH';
    if (words && (SoFilter.problem(body, words) || (title != null && SoFilter.problem(title, words)))) return 'PROFANITY';
    return null;
  }
  function sending(form, on) { form.querySelectorAll('button, input, textarea, select').forEach((x) => { x.disabled = on; }); form.setAttribute('aria-busy', String(on)); }
  function showMsg(box, code, ok = false) { box.className = 'fmsg ' + (ok ? 'ok' : 'err'); box.textContent = ok ? t(code) : F.msg(code); box.setAttribute('role', ok ? 'status' : 'alert'); }

  function replyForm(tp) {
    const form = el('form', 'fform panel reply-box'); form.noValidate = true;
    form.append(el('h2', '', t('write_reply')));
    const b = field('reply-body', t('t_body'), { area: true, max: CFG.bodyMax, keep: 'reply-' + tp.id });
    const msg = el('p', 'fmsg'); msg.id = 'reply-msg';
    const row = el('div', 'frow'), hint = el('span', 'hint grow', t('compose_hint')), go = el('button', 'btn gold', t('post_reply')); go.type = 'submit';
    row.append(hint, go);
    form.append(b.f, msg, row);
    if (flash) { showMsg(msg, flash, true); flash = null; }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await loadWords();
      const pr = problems(null, b.inp.value); if (pr) { showMsg(msg, pr); b.inp.focus(); return; }
      sending(form, true);
      try {
        const r = await F.rpc('forum_reply', { p_topic: tp.id, p_body: b.inp.value });
        b.inp.value = ''; flash = 'reply_ok';
        await reloadTopic(r.page, 'p' + r.id);
      } catch (err) { sending(form, false); showMsg(msg, F.code(err)); }
    });
    return form;
  }
  function editForm(p) {
    const form = el('form', 'fform editf'); form.noValidate = true;
    let ti = null;
    if (p.op) { ti = field('edit-title', t('t_title'), { max: CFG.titleMax, keep: 'edit-title-' + p.id, value: data.topic.title }); form.append(ti.f); }
    const b = field('edit-body', t('t_body'), { area: true, max: CFG.bodyMax, keep: 'edit-' + p.id, value: p.body });
    const msg = el('p', 'fmsg'), row = el('div', 'frow'), save = el('button', 'btn gold', t('save')), cancel = el('button', 'btn', t('cancel'));
    save.type = 'submit'; cancel.type = 'button'; cancel.addEventListener('click', () => { editing = null; render(); });
    row.append(el('span', 'grow'), cancel, save);
    form.append(b.f, msg, row);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); await loadWords();
      const pr = problems(ti ? ti.inp.value : null, b.inp.value); if (pr) { showMsg(msg, pr); return; }
      sending(form, true);
      try { await F.rpc('forum_edit', { p_post: p.id, p_body: b.inp.value, p_title: ti ? ti.inp.value : null }); editing = null; await reloadTopic(null, 'p' + p.id); }
      catch (err) { sending(form, false); showMsg(msg, F.code(err)); }
    });
    return form;
  }

  // ---------- a new topic ----------
  function drawCompose(v) {
    const me = F.me() || {}, cats = (data.categories || []), cat = cats.find((c) => c.id === route.neu) || cats.find((c) => c.id === 'general');
    document.title = `${t('compose_title')} · ${t('f_title')} · The Serpent's Oath`;
    v.append(crumbs(cat ? [[loc(cat.name), 'forum.html?c=' + encodeURIComponent(cat.id)], [t('new_topic'), null]] : [[t('new_topic'), null]]));
    v.append(head(t('compose_title'), null));
    const g = el('div', 'fgrid'), main = el('div', 'fmain');
    if (!me.signed_in) main.append(signinBox());
    else if (!me.has_profile || !me.ready) main.append(noteBox('finish_to_post', 'finish_to_post_p', 'account.html?next=' + encodeURIComponent(F.here()), 'finish_btn_go'));
    else if (me.banned) main.append(el('p', 'fnote warn', t('banned_note')));
    else {
      const form = el('form', 'fform panel'); form.noValidate = true;
      const cf = el('div', 'fld'), cl = el('label', '', t('t_category')), sel = el('select');
      cl.htmlFor = 'new-cat'; sel.id = 'new-cat'; sel.dataset.keep = 'new-cat';
      for (const c of cats) if (!c.admin_only || me.admin) sel.append(new Option(loc(c.name), c.id, false, c.id === (cat && cat.id)));
      cf.append(cl, sel);
      const ti = field('new-title', t('t_title'), { max: CFG.titleMax, keep: 'new-title' });
      const b = field('new-body', t('t_body'), { area: true, max: CFG.bodyMax, keep: 'new-body' });
      const msg = el('p', 'fmsg'); msg.id = 'new-msg';
      const row = el('div', 'frow'), hint = el('span', 'hint grow', t('compose_hint')), go = el('button', 'btn gold', t('post_topic')); go.type = 'submit';
      row.append(hint, go);
      form.append(cf, ti.f, b.f, msg, row);
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); await loadWords();
        const pr = problems(ti.inp.value, b.inp.value); if (pr) { showMsg(msg, pr); return; }
        sending(form, true);
        try { const r = await F.rpc('forum_new_topic', { p_category: sel.value, p_title: ti.inp.value, p_body: b.inp.value }); location.href = `forum.html?t=${r.id}`; }
        catch (err) { sending(form, false); showMsg(msg, F.code(err)); }
      });
      main.append(form);
    }
    g.append(main, side(null)); v.append(g);
  }

  // ---------- the ranks ----------
  function drawRanks(v) {
    const me = F.me() || {}, c = me.card;
    document.title = `${t('ranks_title')} · The Serpent's Oath`;
    v.append(crumbs([[t('ranks'), null]]), head(t('ranks_title'), t('ranks_sub')));
    const intro = el('section', 'ranks-intro panel');
    intro.append(el('p', '', t('ranks_how', { t: data.points_topic, r: data.points_reply })), el('p', 'ranks-why', t('ranks_why')));
    if (c) {
      const you = el('p'); you.append(el('b', '', t('you_are', { god: F.godName(c.rank.god), lv: c.rank.lv, pts: c.points })));
      intro.append(you, F.rankProgress(c.points, c.rank, data.ranks));
    }
    v.append(intro);
    const box = el('section', 'ranks panel'), tb = el('table'), thead = el('thead'), tr = el('tr');
    for (const k of ['rank_th_lv', 'rank_th_god', 'rank_th_pts']) tr.append(el('th', '', t(k)));
    thead.append(tr); tb.append(thead);
    const body = el('tbody');
    for (const r of [...data.ranks].reverse()) {
      const row = el('tr', c && c.rank.lv === r.lv ? 'me' : '');
      const a = el('td', 'n'); a.append(F.rankBadge(r, { link: false }));
      const g = el('td'); g.append(el('span', 'gn', F.godName(r.god)), el('span', '', F.godLine(r.god)));
      row.append(a, g, el('td', 'p', String(r.min))); body.append(row);
    }
    tb.append(body); box.append(tb); v.append(box);
  }

  F.boot(render);
  load();
})();
