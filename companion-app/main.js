// The Companion: sign in with the game's account, pick one of its characters, walk the village, fish, sell, use the bank.
// Everything that counts (time, fish, tokens, the bank, the character lock) is decided by the server.
import { rpc, signIn, signOut, signedIn, ApiError } from './api.js';
import { T, FISH_NAMES, RARITY, pickLang, fmt } from './i18n.js';
import { createVillage } from './village.js';

let L = pickLang(); const t = (k, v) => fmt((T[L] || T.en)[k] ?? T.en[k] ?? k, v);
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c))); return e; };
const SESSION = (() => { let s = ''; try { s = sessionStorage.getItem('so-companion-sid') || ''; } catch { /* */ } if (!s) { const b = crypto.getRandomValues(new Uint8Array(12)); s = [...b].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 24); try { sessionStorage.setItem('so-companion-sid', s); } catch { /* */ } } return s; })();
const uuid = () => crypto.randomUUID();

let village = null, me = null, st = null, bank = null, hb = 0, tick = 0, chars = [];
const fishName = (id) => FISH_NAMES[L]?.[id] || FISH_NAMES.en[id] || id.replace(/_/g, ' ');
const rarityOf = (id) => st?.fish?.find((f) => f.id === id)?.rarity || 'common';
const errText = (e) => { const c = (e.code || '').toLowerCase(); return (T[L] || T.en)[c] || (T[L] || T.en)[c + '_err'] || t('unexpected'); };

function applyLang() { document.documentElement.lang = L; try { localStorage.setItem('so-lang', L); } catch { /* */ } for (const n of document.querySelectorAll('[data-t]')) n.textContent = t(n.dataset.t); if (village) village.setNames({ banker: t('banker').split(',')[0], fisher: t('fisher').split(',')[0] }); $('install').textContent = t('install') + '. ' + t('install_help'); }
const show = (id) => { for (const s of ['s-login', 's-chars', 's-blocked', 's-load', 's-game']) $(s).hidden = s !== id; };
function toast(msg) { const x = $('toast'); x.textContent = msg; x.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { x.hidden = true; }, 3200); }

// ---- a pixel icon per fish, drawn here (a body, a tail and an eye in the rarity's colour)
const iconCache = new Map();
function fishIcon(id, kind = 'f') {
  const key = kind + id; if (iconCache.has(key)) return iconCache.get(key).cloneNode(true);
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); const col = kind === 'f' ? RARITY[rarityOf(id)] : '#8d8266';
  x.fillStyle = col; for (const [px, py, w, h] of [[3, 6, 9, 5], [4, 5, 6, 1], [4, 11, 6, 1], [12, 5, 2, 7], [14, 4, 1, 2], [14, 10, 1, 2]]) x.fillRect(px, py, w, h);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(3, 10, 9, 1); x.fillStyle = '#fff'; x.fillRect(5, 7, 2, 2); x.fillStyle = '#140b11'; x.fillRect(6, 8, 1, 1);
  if (kind !== 'f') { x.fillStyle = '#140b11'; x.fillRect(4, 5, 8, 6); x.fillStyle = col; x.fillRect(5, 6, 6, 4); }
  iconCache.set(key, c); return c.cloneNode(true);
}
const prettyId = (id) => id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// ---- the sheet (dialogues, bag, bank)
const sheet = { open(node) { $('sheet-body').replaceChildren(node); $('sheet').hidden = false; }, close() { $('sheet').hidden = true; $('sheet-body').replaceChildren(); view = null; }, get isOpen() { return !$('sheet').hidden; } };
let view = null;
$('sheet-x').addEventListener('click', sheet.close); $('sheet').addEventListener('pointerdown', (e) => { if (e.target === $('sheet')) sheet.close(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.isOpen) sheet.close(); });

// ---- the server calls; each change is retried safely with its key
async function act(name, body, { keyed = false } = {}) {
  try { return await rpc(name, keyed ? { ...body, p_key: uuid() } : body); }
  catch (e) {
    if (e.code === 'NO_LEASE') { try { await enter(); return await rpc(name, body); } catch { /* fall through */ } }
    if (e.code === 'SESSION_EXPIRED' || e.code === 'SIGNED_OUT') { await toLogin(t('session_expired')); throw e; }
    toast(errText(e)); throw e;
  }
}
const setState = (s) => { st = s; renderHud(); if (view) view.refresh?.(); };
async function enter() { setState(await rpc('companion_enter', { p_char: me.id, p_session: SESSION })); }

function renderHud() {
  $('h-name').textContent = me.name; $('h-lv').textContent = t('level', { n: me.level });
  $('h-tok').textContent = `${st?.tokens ?? 0} ◈`; $('h-tok').title = t('tokens');
  const a = st?.afk, chip = $('h-afk'); chip.hidden = !a;
  if (a) { const ready = readyNow(); chip.textContent = a.full ? t('fishing_full') : `${t('fishing_badge')} · ${ready}`; }
}
// the attempts waiting, as the server counts them (its own clock, carried by 'now'): the page only displays
const clockSkew = () => (st?.afk ? Date.parse(st.afk.now) - Date.now() : 0);
function readyNow() { const a = st?.afk; if (!a) return 0; const el = Math.min(a.cap_s, Math.max(0, (Date.now() + clockSkew() - Date.parse(a.last_at)) / 1000)); return Math.floor(el / a.interval_s); }

// ---- screens
async function toLogin(msg = '') { stopBeat(); village?.stop(); sheet.close(); show('s-login'); $('login-err').textContent = msg; }
$('f-login').addEventListener('submit', async (e) => {
  e.preventDefault(); const b = e.submitter; b.disabled = true; $('login-err').textContent = '';
  try { await signIn($('in-user').value, $('in-pass').value); $('in-pass').value = ''; await toChars(); }
  catch (err) { $('login-err').textContent = errText(err); } finally { b.disabled = false; }
});
$('b-out').addEventListener('click', async () => { await signOut(); toLogin(); });

async function toChars() {
  stopBeat(); village?.stop(); sheet.close(); show('s-chars'); $('chars-err').textContent = '';
  try { chars = await rpc('companion_characters'); }
  catch (e) { if (e.code === 'SESSION_EXPIRED' || e.code === 'SIGNED_OUT') return toLogin(t('session_expired')); $('chars-err').textContent = errText(e); chars = []; }
  const ul = $('chars'); ul.replaceChildren(); $('chars-empty').hidden = chars.length > 0;
  for (const c of chars) ul.append(el('li', {}, el('button', { type: 'button', onclick: () => pick(c) },
    el('b', {}, c.name, el('small', {}, `${t('level', { n: c.level })} · ${c.job || t('job_none')}`)),
    c.in_game ? el('span', { class: 'badge warn' }, t('in_game')) : c.fishing ? el('span', { class: 'badge' }, t('fishing_badge')) : null)));
}
async function pick(c) {
  me = c; show('s-load');
  try { await enter(); }
  catch (e) {
    if (e.code === 'CHARACTER_IN_GAME' || e.code === 'CHARACTER_IN_USE') { $('blk-name').textContent = c.name; $('blk-msg').textContent = e.code === 'CHARACTER_IN_GAME' ? t('blocked_game') : t('blocked_use'); show('s-blocked'); return; }
    if (e.code === 'SESSION_EXPIRED') return toLogin(t('session_expired'));
    show('s-chars'); $('chars-err').textContent = errText(e); return;
  }
  if (!village) { village = createVillage($('cv'), { onNear: (id) => { nearNpc = id; const b = $('b-talk'); b.hidden = !id || sheet.isOpen; if (id) b.textContent = `${t('talk')}: ${t(id).split(',')[0]}`; }, onTap: (id) => talk(id) }); village.setNames({ banker: t('banker').split(',')[0], fisher: t('fisher').split(',')[0] }); bindJoy(); }
  village.setHero({ appearance: c.appearance, gear: c.gear, weapon: c.weapon }); village.size();
  show('s-game'); $('hint').style.opacity = 1; setTimeout(() => { $('hint').style.opacity = 0; }, 6000);
  village.start(); startBeat(); renderHud();
  if (st.afk) village.startFishing();
  if (st.afk && readyNow() > 0 && !st.afk.full) { /* the fisher's welcome-back summary is shown when the player talks to him */ }
}
$('blk-retry').addEventListener('click', () => pick(me)); $('blk-back').addEventListener('click', toChars);
let nearNpc = null;
$('b-talk').addEventListener('click', () => nearNpc && talk(nearNpc));
$('b-bag').addEventListener('click', () => openBag()); $('b-set').addEventListener('click', () => openSettings());

// the lock is kept with a heartbeat; leaving tells the server at once, a crash lets it run out by itself
function startBeat() { stopBeat(); hb = setInterval(() => { rpc('companion_enter', { p_char: me.id, p_session: SESSION }).then(setState).catch((e) => { if (e.code === 'CHARACTER_IN_GAME' || e.code === 'CHARACTER_IN_USE') { stopBeat(); village.stop(); sheet.close(); $('blk-name').textContent = me.name; $('blk-msg').textContent = e.code === 'CHARACTER_IN_GAME' ? t('blocked_game') : t('blocked_use'); show('s-blocked'); } }); }, 30000); tick = setInterval(() => st && renderHud(), 10000); }
function stopBeat() { clearInterval(hb); clearInterval(tick); }
function leave() { if (me && signedIn()) rpc('companion_leave', { p_char: me.id, p_session: SESSION }, { keepalive: true }).catch(() => {}); }
addEventListener('pagehide', leave);
document.addEventListener('visibilitychange', () => { if (!village) return; if (document.hidden) village.stop(); else if (!$('s-game').hidden) { village.start(); rpc('companion_enter', { p_char: me.id, p_session: SESSION }).then(setState).catch(() => {}); } });

// ---- the joystick
function bindJoy() {
  const j = $('joy'), k = $('joy-k'); let id = null;
  const move = (e) => { const r = j.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } village.joy.x = dx; village.joy.y = dy; k.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`; };
  j.addEventListener('pointerdown', (e) => { id = e.pointerId; j.setPointerCapture(id); move(e); e.preventDefault(); });
  j.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const up = (e) => { if (e.pointerId !== id) return; id = null; village.joy.x = village.joy.y = 0; k.style.transform = ''; };
  j.addEventListener('pointerup', up); j.addEventListener('pointercancel', up);
}

// ---- dialogues
function talk(id) { if (sheet.isOpen) return; $('b-talk').hidden = true; if (id === 'fisher') openFisher(); else if (id === 'banker') openBank(); }
const slot = (id, n, { kind = 'f', sel = false, dim = false, onclick } = {}) => { const b = el('button', { type: 'button', class: 'slot' + (sel ? ' sel' : '') + (dim ? ' dim' : ''), style: `--rc:${kind === 'f' ? RARITY[rarityOf(id)] : '#6b6050'}`, 'aria-label': `${kind === 'f' ? fishName(id) : prettyId(id)} ${n}`, onclick }, fishIcon(id, kind), el('small', {}, n > 1 ? n : '')); return b; };

function openBag() {
  const inv = st.inv, ids = Object.keys(inv);
  const body = el('div', {}, el('h2', {}, t('bag')), el('p', {}, `${st.tokens} ◈ ${t('tokens')}`));
  if (!ids.length) body.append(el('p', {}, t('empty_bag')));
  else { const g = el('div', { class: 'grid' }); for (const id of ids) g.append(slot(id, inv[id])); body.append(g); for (const id of ids) body.append(el('div', { class: 'line' }, el('b', {}, fishName(id)), el('span', {}, `${inv[id]} · ${t('price', { n: st.fish.find((f) => f.id === id).price })}`))); }
  view = { refresh: openBagIfOpen }; sheet.open(body);
  function openBagIfOpen() { if (sheet.isOpen && view?.refresh === openBagIfOpen) openBag(); }
}

function openSettings() {
  const lang = el('div', { class: 'seg', role: 'group', 'aria-label': t('language') }, ['he', 'en', 'es'].map((c) => el('button', { type: 'button', 'aria-pressed': String(c === L), onclick: () => { L = c; applyLang(); openSettings(); renderHud(); } }, { he: 'עברית', en: 'English', es: 'Español' }[c])));
  const q = Number(localStorage.getItem('so-companion-quality') || .5);
  const qual = el('div', { class: 'seg', role: 'group' }, [[.35, 'Low'], [.5, 'Normal'], [.8, 'High']].map(([v, n]) => el('button', { type: 'button', 'aria-pressed': String(Math.abs(q - v) < .01), onclick: () => { try { localStorage.setItem('so-companion-quality', String(v)); } catch { /* */ } village.size(); openSettings(); } }, n)));
  sheet.open(el('div', {}, el('h2', {}, t('settings')), el('p', {}, t('language')), lang, el('p', {}, 'Graphics'), qual, el('p', {}, t('leave_note')),
    el('div', { class: 'acts' }, el('button', { class: 'btn', type: 'button', onclick: async () => { sheet.close(); await rpc('companion_leave', { p_char: me.id, p_session: SESSION }).catch(() => {}); toChars(); } }, t('switch')), el('button', { class: 'btn quiet', type: 'button', onclick: async () => { sheet.close(); await rpc('companion_leave', { p_char: me.id, p_session: SESSION }).catch(() => {}); await signOut(); toLogin(); } }, t('sign_out')))));
}

// ---- the fisherman
function openFisher(summary = null, tab = 'main') {
  const body = el('div', {}); const a = st.afk;
  body.append(el('h2', {}, t('fisher').split(',')[0]));
  const render = () => {
    const A = st.afk, ready = readyNow(); body.replaceChildren(el('h2', {}, t('fisher').split(',')[0]));
    if (tab === 'main') {
      body.append(el('p', {}, summary ? '' : t('fisher_hi')));
      if (summary) { body.append(el('p', {}, el('b', {}, t('away')), ` · ${t('attempts', { n: summary.attempts })}`)); const ids = Object.keys(summary.caught); if (!ids.length) body.append(el('p', {}, t('away_none'))); else { const g = el('div', { class: 'grid' }); for (const id of ids) g.append(slot(id, summary.caught[id])); body.append(g); } }
      body.append(el('p', {}, A ? (A.full ? t('fishing_full') : t('fishing_now', { m: Math.round(A.interval_s / 60), h: Math.round(A.cap_s / 3600) })) : t('not_fishing')));
      const acts = el('div', { class: 'acts' });
      if (!A) acts.append(el('button', { class: 'btn gold', type: 'button', onclick: async () => { try { setState(await act('companion_fish_start', { p_char: me.id })); summary = null; village.startFishing(); sheet.close(); toast(t('leave_note')); } catch { /* shown */ } } }, t('start_fishing')));
      else { acts.append(el('button', { class: 'btn gold', type: 'button', onclick: async () => collect(false) }, ready ? t('collect', { n: ready }) : t('collect0'))); acts.append(el('button', { class: 'btn', type: 'button', onclick: async () => collect(true) }, t('stop_fishing'))); }
      acts.append(el('button', { class: 'btn', type: 'button', onclick: () => { tab = 'sell'; render(); } }, t('sell_fish')), el('button', { class: 'btn', type: 'button', onclick: () => { tab = 'book'; render(); } }, t('fish_book')));
      body.append(acts);
    } else if (tab === 'sell') {
      body.append(el('p', {}, `${st.tokens} ◈`)); const inv = st.inv; const ids = Object.keys(inv);
      if (!ids.length) body.append(el('p', {}, t('empty_bag')));
      for (const id of ids) { const f = st.fish.find((x) => x.id === id); body.append(el('div', { class: 'line' }, el('span', {}, el('b', {}, fishName(id)), ` ×${inv[id]} · ${t('price', { n: f.price })}`), el('span', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: async () => { setState(await act('companion_sell', { p_char: me.id, p_item: id, p_n: 1 }, { keyed: true })); render(); } }, `${t('sell')} 1`), inv[id] > 1 ? el('button', { class: 'btn', type: 'button', onclick: async () => { setState(await act('companion_sell', { p_char: me.id, p_item: id, p_n: inv[id] }, { keyed: true })); render(); } }, t('sell_all')) : null))); }
      body.append(el('div', { class: 'acts' }, el('button', { class: 'btn quiet', type: 'button', onclick: () => { tab = 'main'; render(); } }, '←')));
    } else {
      for (const f of st.fish) { const n = st.book[f.id] || 0; body.append(el('div', { class: 'line' }, el('span', { style: `color:${RARITY[f.rarity]}` }, el('b', {}, n ? fishName(f.id) : '???'), ` · ${t('rarity_' + f.rarity)} · ${t('chance', { n: f.chance })}`), el('span', {}, n ? t('book_caught', { n }) : t('book_unknown')))); }
      body.append(el('div', { class: 'acts' }, el('button', { class: 'btn quiet', type: 'button', onclick: () => { tab = 'main'; render(); } }, '←')));
    }
  };
  async function collect(stop) { try { const r = await act('companion_fish_claim', { p_char: me.id, p_stop: stop }, { keyed: true }); setState(r.state); summary = { attempts: r.attempts, caught: r.caught }; if (stop) village.stopFishing(); tab = 'main'; render(); } catch { /* shown */ } }
  view = { refresh: render }; sheet.open(body); render();
  if (a && readyNow() > 0 && !summary) { /* shown on demand: Collect */ }
}

// ---- the banker: two clear sections (bag, bank) behind a switch, tap an item, choose how many
async function openBank() {
  try { bank = await act('companion_bank', {}); } catch { return; }
  let side = 'bag', sel = null, qty = 1; const body = el('div', {});
  const used = () => bank.items.length;
  const render = () => {
    body.replaceChildren(el('h2', {}, t('banker').split(',')[0]), el('p', {}, t('banker_hi')));
    body.append(el('div', { class: 'seg' }, ['bag', 'bank'].map((s) => el('button', { type: 'button', 'aria-pressed': String(side === s), onclick: () => { side = s; sel = null; qty = 1; render(); } }, s === 'bag' ? t('in_bag') : `${t('bank')} · ${used()} / 10`))));
    if (side === 'bank') body.append(el('p', {}, t('in_bank')));
    const g = el('div', { class: 'grid' });
    if (side === 'bag') { for (const id of Object.keys(st.inv)) g.append(slot(id, st.inv[id], { sel: sel?.id === id, onclick: () => { sel = { id, kind: 'f', max: st.inv[id] }; qty = 1; render(); } })); if (!Object.keys(st.inv).length) body.append(el('p', {}, t('empty_bag'))); }
    else { for (let i = 0; i < 10; i++) { const it = bank.items.find((x) => x.slot === i); if (!it) g.append(el('div', { class: 'slot empty', 'aria-hidden': 'true' })); else { const mine = it.kind === 'f'; g.append(slot(it.id, it.n, { kind: it.kind, dim: !mine, sel: sel?.slot === i, onclick: () => { if (!mine) { toast(t('game_item')); return; } sel = { id: it.id, kind: 'f', slot: i, max: it.n }; qty = 1; render(); } })); } } }
    body.append(g);
    if (sel) {
      const name = sel.kind === 'f' ? fishName(sel.id) : prettyId(sel.id);
      const inp = el('input', { type: 'number', inputmode: 'numeric', min: 1, max: sel.max, value: qty, 'aria-label': t('amount'), oninput: (e) => { qty = Math.max(1, Math.min(sel.max, parseInt(e.target.value || '1', 10) || 1)); } });
      body.append(el('div', { class: 'line' }, el('b', {}, name), el('span', {}, `×${sel.max}`)), el('div', { class: 'qty' }, el('button', { class: 'btn', type: 'button', onclick: () => { qty = Math.max(1, qty - 1); inp.value = qty; } }, '−'), inp, el('button', { class: 'btn', type: 'button', onclick: () => { qty = Math.min(sel.max, qty + 1); inp.value = qty; } }, '+'), el('button', { class: 'btn quiet', type: 'button', onclick: () => { qty = sel.max; inp.value = qty; } }, t('max'))));
      body.append(el('div', { class: 'acts' }, el('button', { class: 'btn gold', type: 'button', onclick: async () => {
        try { const r = await act(side === 'bag' ? 'companion_bank_deposit' : 'companion_bank_withdraw', { p_char: me.id, p_item: sel.id, p_n: qty }, { keyed: true }); bank = r.bank; setState(r.state); sel = null; qty = 1; render(); } catch { /* shown */ } } }, side === 'bag' ? t('deposit') : t('withdraw'))));
    } else body.append(el('p', {}, t('select_item')));
  };
  view = { refresh: () => { if (sheet.isOpen) render(); } }; sheet.open(body); render();
}

// ---- start
applyLang();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
(async () => { if (signedIn()) { try { await toChars(); } catch { toLogin(); } } else toLogin(); })();
window.__companion = { get st() { return st; }, get me() { return me; }, village: () => village, talk };
