// The top bar's "Forum" and "Sign in" links, on every page of the site (index.html, wiki.html, privacy.html, terms.html,
// and the forum's own pages). Pages without the sign-in library (supabase-js) stay light: this only looks whether a
// session is kept in this browser (supabase-js keeps it in localStorage under sb-<project>-auth-token) and shows the
// username the forum pages last saw (localStorage so-forum-user); with no session it says "Sign in". The words follow
// the page's language (the html lang attribute, which lang.js sets), and change with it.
(() => {
  const WORDS = { he: ['פורום', 'כניסה'], en: ['Forum', 'Sign in'], es: ['Foro', 'Iniciar sesión'] };
  const url = String((window.SITE && window.SITE.SUPABASE_URL) || 'https://exyixhjorhrzunnrxqjs.supabase.co');
  let ref = 'x'; try { ref = new URL(url).hostname.split('.')[0]; } catch (e) { /* keep x */ }
  const KEY = `sb-${ref}-auth-token`;
  function who() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw), u = s && (s.user || (s.currentSession && s.currentSession.user));
      if (!u) return null;
      const name = localStorage.getItem('so-forum-user');
      return typeof name === 'string' && name ? name.slice(0, 16) : ' ';
    } catch (e) { return null; }
  }
  function paint() {
    const L = WORDS[document.documentElement.lang] ? document.documentElement.lang : 'en';
    for (const a of document.querySelectorAll('[data-nav="forum"]')) a.textContent = WORDS[L][0];
    const name = window.SoNavName !== undefined ? window.SoNavName : who();
    for (const a of document.querySelectorAll('[data-nav="acct"]')) {
      a.textContent = name && name.trim() ? name : WORDS[L][1];
      a.classList.toggle('signed', !!(name && name.trim()));
      if (name && name.trim()) { a.dir = 'auto'; a.href = 'account.html'; } else a.removeAttribute('dir');
    }
  }
  // the forum pages tell it who is signed in once they know (null: nobody)
  window.SoNav = { set(name) { window.SoNavName = name; try { if (name) localStorage.setItem('so-forum-user', name); else localStorage.removeItem('so-forum-user'); } catch (e) { /* storage off */ } paint(); }, paint };
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  document.addEventListener('so-lang', paint);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
})();
