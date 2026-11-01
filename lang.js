// The site's language: עברית / English / Español, chosen from the globe in the top bar.
// Used by every page. The choice is kept in localStorage 'so-lang'. Order: ?lang=he|en|es, the visitor's last choice,
// else English. The layout never flips: <html dir> stays ltr and each text block is unicode-bidi: plaintext (site.css),
// so Hebrew reads right-to-left inside the same layout as English and Spanish (Roy's rule).
(() => {
  const CODES = ['he', 'en', 'es'];
  const ARIA = { he: 'שפה: עברית', en: 'Language: English', es: 'Idioma: español' };
  const ok = (v) => (CODES.includes(v) ? v : null);
  function pick() {
    const q = ok(new URLSearchParams(location.search).get('lang'));
    if (q) return q;
    try { const s = ok(localStorage.getItem('so-lang')); if (s) return s; } catch (e) { /* storage off */ }
    return 'en';
  }
  function mount(onChange) {
    const btn = document.getElementById('lang'), menu = document.getElementById('lang-menu');
    if (!btn || !menu) return;
    const items = [...menu.querySelectorAll('[data-l]')];
    const open = (on, focusBtn) => {
      menu.hidden = !on; btn.setAttribute('aria-expanded', String(on));
      if (on) (items.find((b) => b.getAttribute('aria-checked') === 'true') || items[0]).focus();
      else if (focusBtn) btn.focus();
    };
    btn.addEventListener('click', () => open(menu.hidden));
    for (const b of items) b.addEventListener('click', () => {
      const L = b.dataset.l;
      try { localStorage.setItem('so-lang', L); } catch (e) { /* storage off */ }
      open(false, true); onChange(L);
    });
    menu.addEventListener('keydown', (e) => {
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); open(false, true); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
      else if (e.key === 'Tab') open(false);
    });
    document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !e.target.closest('.langw')) open(false); });
  }
  function show(L) {
    const h = document.documentElement; h.lang = L; h.dir = 'ltr';
    const btn = document.getElementById('lang');
    if (btn) { btn.setAttribute('aria-label', ARIA[L]); btn.title = ARIA[L]; }
    for (const b of document.querySelectorAll('#lang-menu [data-l]')) b.setAttribute('aria-checked', String(b.dataset.l === L));
    document.dispatchEvent(new CustomEvent('so-lang', { detail: L }));
  }
  // fills every [data-t] (text) and [data-h] (fixed markup) from a strings table
  function fill(T, L, vars) {
    const t = T[L] || T.en;
    // Hebrew strings get a leading RLM, so unicode-bidi: plaintext reads them right-to-left even when they open with Latin
    const sub = (s) => (L === 'he' ? '\u200f' : '') + String(s).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
    for (const n of document.querySelectorAll('[data-t]')) { const k = n.dataset.t; if (k in t) n.textContent = sub(t[k]); }
    for (const n of document.querySelectorAll('[data-h]')) { const k = n.dataset.h; if (k in t) n.innerHTML = sub(t[k]); }
    for (const n of document.querySelectorAll('[data-ta]')) { const k = n.dataset.ta; if (k in t) n.setAttribute('aria-label', t[k]); }
    for (const n of document.querySelectorAll('[data-tp]')) { const k = n.dataset.tp; if (k in t) n.setAttribute('placeholder', t[k]); }
  }
  // the date, in the language
  function fmt(iso, L) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    try { return dt.toLocaleDateString(L === 'he' ? 'he-IL' : L === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return `${d}.${m}.${y}`; }
  }
  window.SoLang = { pick, mount, show, fill, fmt };
})();
