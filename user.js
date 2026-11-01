// A player's page (user.html?u=<username>): anyone sees the join date, the forum rank and the counts; the player
// themself also sees their characters (profile.js draws it; account.html shows the same for the signed-in player).
(() => {
  const F = window.SoF, el = F.el, t = F.t;
  const name = (new URLSearchParams(location.search).get('u') || '').trim().slice(0, 32);
  let state = 'loading', u = null, chars = null, charsErr = null, err = null;

  async function load() {
    await F.loadMe();
    try {
      if (!F.client()) throw Object.assign(new Error(''), { soCode: 'NOT_CONFIGURED' });
      if (!name) throw Object.assign(new Error(''), { soCode: 'NOT_FOUND' });
      u = await F.rpc('forum_user', { p_username: name });
      if (u.me) {
        const { data, error } = await F.client().from('characters').select('name,level,active_job,jobs,appearance,slot,portrait_png').order('slot');
        if (error) charsErr = t('u_chars_err'); else chars = data || [];
      }
      state = 'ok';
    } catch (e) { state = 'err'; err = F.code(e); }
    render();
  }
  function render() {
    const v = document.getElementById('view'); v.textContent = '';
    const cr = el('nav', 'crumbs'), a = el('a', '', t('f_title')); a.href = 'forum.html';
    cr.append(a, el('span', 'sep', '›'), Object.assign(el('span', 'cur', u ? u.username : name || t('u_title')), { dir: 'auto' }));
    if (state === 'loading') { v.append(el('p', 'loading', t('loading'))); return; }
    v.append(cr);
    if (state === 'err') { v.append(F.errorBox(err === 'NOT_FOUND' ? 'NOT_FOUND_USER' : err)); return; }
    document.title = `${u.username} · The Serpent's Oath`;
    const side = el('aside', 'side'), b = el('section', 'sbox panel');
    if (u.me) {
      b.append(el('h3', '', t('my_account')), el('p', '', t('signed_in_as', { u: u.username })));
      const acc = el('a', 'btn', t('my_account')); acc.href = 'account.html'; b.append(acc);
    } else {
      b.append(el('h3', '', t('ranks')), el('p', '', t('ranks_sub')));
      const r = el('a', 'btn', t('ranks_link')); r.href = 'forum.html?view=ranks'; b.append(r);
    }
    const f = el('a', 'btn', t('go_forum')); f.href = 'forum.html'; b.append(f);
    side.append(b);
    SoProfile.draw(v, u, { own: !!u.me, chars, charsErr, side });
  }
  // (the "no such player" text)
  window.SO_FT.en.e_NOT_FOUND_USER = window.SO_FT.en.u_not_found; window.SO_FT.he.e_NOT_FOUND_USER = window.SO_FT.he.u_not_found; window.SO_FT.es.e_NOT_FOUND_USER = window.SO_FT.es.u_not_found;
  F.boot(render);
  load();
})();
