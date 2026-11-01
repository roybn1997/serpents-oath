// A player's page, drawn the same on user.html?u=<name> (anyone) and on account.html (your own, signed in): the
// username, the date the account was opened, the forum rank (the god, the level, the progress to the next) and the
// counts, the newest topics; and on your OWN page your game characters (read from the game's characters table, which
// lets each player read only their own rows). window.SoProfile.draw(box, user, { own, chars, side }).
(() => {
  const F = window.SoF, el = F.el, t = F.t;
  const loc = (o) => (o && (o[F.lang()] || o.en)) || '';

  // a character's job and tier in the page's language ({tier, job}: "Hoplite", "Warrior"; Hebrew by the body's gender)
  function jobOf(ch) {
    const J = (window.SO_JOBS || {})[ch.active_job];
    if (!J) return null;
    const info = (ch.jobs && ch.jobs[ch.active_job]) || {}, tier = Math.max(0, Math.min(5, Math.floor(+info.tier || 0)));
    const f = ch.appearance && ch.appearance.body === 'f';
    const say = (n) => (F.lang() === 'he' ? n.he[f ? 1 : 0] : n[F.lang()] || n.en);
    let tn = null;
    if (tier >= 1) tn = ch.active_job === 'mage' && tier >= 2 ? ((J.paths[info.path] || J.paths.hecate)[tier - 2]) : J.t[tier - 1];
    return { job: say(J.n), tier: tn ? say(tn) : null };
  }

  function stat(label, value) { const d = el('div', 'ustat'); d.append(el('span', 'k', label)); const v = el('span', 'v'); v.append(value); d.append(v); return d; }

  function charCard(ch) {
    const li = el('li', 'chc panel'), pt = el('div', 'pt');
    let png = typeof ch.portrait_png === 'string' ? ch.portrait_png.replace(/^data:image\/png;base64,/, '').replace(/\s+/g, '') : '';
    if (png && /^[A-Za-z0-9+/]+={0,2}$/.test(png)) { const img = el('img'); img.alt = ''; img.src = 'data:image/png;base64,' + png; img.addEventListener('error', () => img.replaceWith(el('div', 'sil')), { once: true }); pt.append(img); }
    else pt.append(el('div', 'sil'));
    const nm = el('p', 'nm', String(ch.name || '')); nm.dir = 'auto';
    const lv = el('p', 'lv'); lv.append(el('span', '', t('u_lv')), el('b', 'ltrnum', String(ch.level || 1)));
    li.append(pt, nm, lv);
    const j = jobOf(ch);
    const jb = el('p', 'job', j ? (j.tier ? `${j.tier} · ${j.job}` : j.job) : t('u_nojob'));
    li.append(jb);
    return li;
  }

  function draw(box, u, { own = false, chars = null, charsErr = null, side = null } = {}) {
    const head = el('div', 'uhead');
    head.append(F.avatar(u.username, u.rank?.lv));
    const tt = el('div', 'tt'), h1 = el('h1', '', u.username); h1.dir = 'auto';
    tt.append(h1);
    const line = el('p', 'uline'); line.append(F.rankBadge(u.rank, { big: true }));
    if (u.admin) line.append(' ', el('span', 'pill gold', t('admin')));
    tt.append(line); head.append(tt);
    box.append(head);

    const grid = el('div', 'fgrid'), main = el('div', 'fmain');
    // the numbers
    const sp = el('section', 'ustats panel');
    sp.append(stat(t('u_joined'), F.timeEl(u.joined, false)), stat(t('u_points'), el('b', 'ltrnum', String(u.points))),
      stat(t('u_topics'), el('b', 'ltrnum', String(u.topics))), stat(t('u_replies'), el('b', 'ltrnum', String(u.replies))));
    const rk = el('div', 'urank'), g = u.rank || F.RANKS[0];
    rk.append(el('h3', '', t('u_rank')));
    const rl = el('p', 'rline'); rl.append(el('b', '', `${F.godName(g.god)} · ${t('rank_lv', { n: g.lv })}`), el('span', '', F.godLine(g.god))); rk.append(rl);
    rk.append(F.rankProgress(u.points || 0, g, F.RANKS));
    const more = el('a', 'lnk', t('ranks_link')); more.href = 'forum.html?view=ranks'; rk.append(more);
    sp.append(rk);
    main.append(sp);

    // your characters (your own page only)
    if (own) {
      const cp = el('section', 'uchars panel');
      cp.append(el('h2', '', t('u_chars')), el('p', 'hint', t('u_chars_note')));
      if (charsErr) cp.append(el('p', 'fnote warn', charsErr));
      else if (!chars || !chars.length) cp.append(el('p', 'fnote', t('u_chars_none')));
      else { const ol = el('ol', 'chars'); for (const ch of chars) ol.append(charCard(ch)); cp.append(ol); }
      main.append(cp);
    }

    // the newest topics
    const rp = el('section', 'urecent panel');
    rp.append(el('h2', '', t('u_recent')));
    if (!u.recent || !u.recent.length) rp.append(el('p', 'empty', t('u_none')));
    else {
      const ul = el('ul');
      for (const r of u.recent) {
        const li = el('li'), a = el('a', 'tname', r.title); a.href = 'forum.html?t=' + r.id; a.dir = 'auto';
        const sub = el('span', 'sub'); sub.append(loc(r.category.name), ' · ', F.timeEl(r.created_at, false), ' · ', r.replies === 1 ? t('reply_1') : t('replies_n', { n: r.replies }));
        li.append(a, sub); ul.append(li);
      }
      rp.append(ul);
    }
    main.append(rp);
    grid.append(main);
    if (side) grid.append(side);
    box.append(grid);
  }
  window.SoProfile = { draw, jobOf };
})();
