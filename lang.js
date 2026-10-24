// The site's language menu (Roy, 24.10): a pixel globe in the top bar opens a small menu, עברית / English / Español.
// Used by index.html and wiki.html. The choice is kept in localStorage 'so-lang'. Hebrew is right-to-left, the others
// left-to-right. Order: ?lang=he|en|es, the visitor's last choice, the browser's language, English.
(() => {
  const CODES = ['he', 'en', 'es'];
  const ARIA = { he: 'שפה: עברית', en: 'Language: English', es: 'Idioma: español' };
  const ok = (v) => (CODES.includes(v) ? v : null);
  function pick() {
    const q = ok(new URLSearchParams(location.search).get('lang'));
    if (q) return q;
    try { const s = ok(localStorage.getItem('so-lang')); if (s) return s; } catch (e) { /* storage off */ }
    for (const n of [...(navigator.languages || []), navigator.language || '']) {
      const c = String(n).slice(0, 2).toLowerCase();
      if (c === 'iw') return 'he';
      if (ok(c)) return c;
    }
    return 'en';
  }
  // wires the globe (#lang) and its menu (#lang-menu); onChange(L) redraws the page in the chosen language
  function mount(onChange) {
    const btn = document.getElementById('lang'), menu = document.getElementById('lang-menu');
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
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1].focus(); }
      else if (e.key === 'Tab') open(false);
    });
    document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !e.target.closest('.langw')) open(false); });
  }
  // marks the current language (call after every change)
  function show(L) {
    const h = document.documentElement; h.lang = L; h.dir = L === 'he' ? 'rtl' : 'ltr';
    const btn = document.getElementById('lang');
    btn.setAttribute('aria-label', ARIA[L]); btn.title = ARIA[L];
    for (const b of document.querySelectorAll('#lang-menu [data-l]')) b.setAttribute('aria-checked', String(b.dataset.l === L));
  }
  window.SoLang = { pick, mount, show };
})();
