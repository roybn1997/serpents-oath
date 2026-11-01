// The top bar on every page: its texts in the three languages, the menu button on narrow screens, and the sign-in
// link (nav-auth.js, from the forum, swaps it for the player's name once they are signed in). Loaded after lang.js;
// it listens for the 'so-lang' event that SoLang.show sends on every language change.
(() => {
  const NAV = {
    he: { nav_game: 'המשחק', nav_lb: 'היכל התהילה', nav_upd: 'עדכונים', nav_wiki: 'ויקי', nav_comp: 'Companion', nav_forum: 'פורום', nav_account: 'כניסה', nav_dl: 'הורדה', nav_menu: 'תפריט' },
    en: { nav_game: 'The game', nav_lb: 'Hall of Fame', nav_upd: 'Updates', nav_wiki: 'Wiki', nav_comp: 'Companion', nav_forum: 'Forum', nav_account: 'Sign in', nav_dl: 'Download', nav_menu: 'Menu' },
    es: { nav_game: 'El juego', nav_lb: 'Salón de la fama', nav_upd: 'Novedades', nav_wiki: 'Wiki', nav_comp: 'Companion', nav_forum: 'Foro', nav_account: 'Entrar', nav_dl: 'Descargar', nav_menu: 'Menú' },
  };
  function fill(L) {
    const t = NAV[L] || NAV.en, pre = L === 'he' ? '‏' : '';
    for (const n of document.querySelectorAll('.bar [data-t]')) { const k = n.dataset.t; if (k in t && !n.dataset.nav) n.textContent = pre + t[k]; }
    const tg = document.getElementById('navtg'); if (tg) tg.setAttribute('aria-label', t.nav_menu);
  }
  // (the Forum and Sign-in links carry data-nav: nav-auth.js paints them, with the player's name once signed in)
  const tg = document.getElementById('navtg'), nav = document.getElementById('mainnav');
  if (tg && nav) {
    tg.addEventListener('click', () => { const on = nav.hidden; nav.hidden = !on; tg.setAttribute('aria-expanded', String(on)); });
    nav.addEventListener('click', (e) => { if (e.target.closest('a') && innerWidth <= 900) { nav.hidden = true; tg.setAttribute('aria-expanded', 'false'); } });
  }
  document.addEventListener('so-lang', (e) => fill(e.detail));
  fill(document.documentElement.lang || 'en');
  window.SoBar = { fill };
})();
