// BETA ONLINE: "Spontaneous translation" (Roy 30.10). In Settings > Game the player turns it on and picks the language
// they want to READ. Nobody picks the language they write in: what anyone types goes out as it is, and every reader with
// the setting on sees it in their own language.
// How a line gets translated (one paid call per message, never one per reader):
//   1. chat_send / whisper work as before (the original reaches everyone at once, nothing waits on a translation), and
//      keep the text a few minutes in private.chat_recent. Their answer says `tr: true` when some reader wants one.
//   2. Only then the SPEAKER's game calls the edge function chat-translate with the message id (never the text: the
//      server reads its own copy, so no one can use it to translate arbitrary text for free).
//   3. The function asks the server which languages the readers want now (private.tr_pref, refreshed every few
//      minutes by the readers' games), sends ONE request to the translation service for all of them, and publishes
//      { id, src, tr: { he: '…', es: '…' } } as a 'tr' event on the same topic.
//   4. Each reader swaps in its own language when that event comes (usually under a second later). If anything fails,
//      the original simply stays.
// The server keeps a monthly character budget (online_config 'translate'); past it, lines stay untranslated.
// Any other text surface (a trade note, party or guild chat later) can use track(id, element) the same way.
import { L } from '../text.js';
import { t, LANG } from '../i18n.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const TR = { key: 'so_translate', refreshMs: 10 * 60 * 1000, keepIds: 300, waitMs: 20000 };

// the languages a reader can pick, each in its own name (codes as ISO 639-1; the edge function maps them per service)
export const TR_LANGS = [
  ['he', 'עברית'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'],
  ['pt', 'Português'], ['ru', 'Русский'], ['uk', 'Українська'], ['pl', 'Polski'], ['nl', 'Nederlands'], ['ro', 'Română'],
  ['cs', 'Čeština'], ['sv', 'Svenska'], ['el', 'Ελληνικά'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['fa', 'فارسی'],
  ['hi', 'हिन्दी'], ['th', 'ไทย'], ['vi', 'Tiếng Việt'], ['id', 'Bahasa Indonesia'], ['ja', '日本語'], ['ko', '한국어'], ['zh', '中文'],
];
const NAME = Object.fromEntries(TR_LANGS);
const okLang = (l) => (NAME[l] ? l : null);

const TX = {
  on: L('תרגום ספונטני: פועל', 'Spontaneous translation: On'),
  off: L('תרגום ספונטני: כבוי', 'Spontaneous translation: Off'),
  pick: L('להציג הודעות של שחקנים בשפה:', 'Show players\' messages in:'),
  help: L('הודעות של שחקנים אחרים (צ׳אט ולחישות) יופיעו בשפה שנבחרה כאן. מה שכותבים יוצא כמו שהוא, וכל מי שהפעיל תרגום קורא אותו בשפה שלו.',
    'Other players\' messages (chat and whispers) show in the language you pick. What you type goes out as it is; anyone who turned this on reads it in their own language.'),
  from: L('תורגם מ{lang}. ללחוץ לטקסט המקורי.', 'Translated from {lang}. Click for the original.'),
  orig: L('המקור. ללחוץ לתרגום.', 'Original. Click for the translation.'),
};
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

// ---------- the setting (this computer; the server learns it through set_translate_lang) ----------
export function translatePref() {
  try { const p = JSON.parse(localStorage.getItem(TR.key) || 'null'); if (p && typeof p === 'object') return { on: !!p.on, lang: okLang(p.lang) || okLang(LANG) || 'en' }; } catch { /* */ }
  return { on: false, lang: okLang(LANG) || 'en' };
}
const listeners = new Set();
export function setTranslatePref(p) {
  const v = { on: !!p.on, lang: okLang(p.lang) || 'en' };
  try { localStorage.setItem(TR.key, JSON.stringify(v)); } catch { /* storage blocked: it lasts for this page */ }
  for (const fn of listeners) { try { fn(v); } catch (e) { console.error(e); } }
  return v;
}

// Settings > Game: one button turns it on or off; when on, the list of languages shows under it
export function translateSettingsRow(pane, { sfx = () => {} } = {}) {
  if (!pane) return null;
  const box = document.createElement('div'); box.className = 'trset';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'slab ghost'; b.dataset.a = 'translate';
  const row = document.createElement('label'); row.className = 'trpick';
  const cap = document.createElement('span'); cap.textContent = t(TX.pick);
  const sel = document.createElement('select'); sel.name = 'trlang';
  for (const [code, name] of TR_LANGS) { const o = document.createElement('option'); o.value = code; o.textContent = name; o.lang = code; sel.appendChild(o); }
  const help = document.createElement('p'); help.className = 'help'; help.textContent = t(TX.help);
  row.append(cap, sel); box.append(b, row, help);
  const show = () => { const p = translatePref(); b.textContent = t(p.on ? TX.on : TX.off); b.setAttribute('aria-pressed', String(p.on)); sel.value = p.lang; row.hidden = !p.on; help.hidden = !p.on; };
  b.onclick = () => { const p = translatePref(); setTranslatePref({ ...p, on: !p.on }); show(); sfx('ui'); if (!p.on) setTimeout(() => sel.focus(), 0); };
  sel.onchange = () => { setTranslatePref({ ...translatePref(), lang: sel.value }); sfx('ui'); };
  sel.addEventListener('keydown', (e) => e.stopPropagation()); // arrows choose a language, they don't move the menu's focus
  show();
  const sync = pane.querySelector('.sync'); // (above the line about where progress is kept)
  if (sync) sync.before(box); else pane.appendChild(box);
  return box;
}

// ---------- in the world ----------
// installTranslate(rt, client, { overhead }) -> { sent(m), track(id, el, original, speaker), dispose() }
// chat.js calls sent(m) after its own chat_send / whisper succeeded, and track() for every line it shows.
export function installTranslate(rt, client, { overhead = null, fetchImpl = (...a) => globalThis.fetch(...a) } = {}) {
  const lines = new Map(); // message id -> { els: [{ el, original }], speaker, at }
  const early = new Map(); // translations that came before their line (rare): id -> payload
  let refreshT = null;

  // the server keeps what each reader wants for half an hour; a game in the world refreshes it every ten minutes
  async function tellServer() {
    clearTimeout(refreshT); refreshT = null;
    const p = translatePref();
    try { await client.rpc('set_translate_lang', { p_lang: p.on ? p.lang : null }); } catch (e) { console.warn('translate: set_translate_lang', e?.code || e); }
    if (p.on) refreshT = setTimeout(tellServer, TR.refreshMs);
  }
  listeners.add(tellServer);
  tellServer();

  // my own line went out and some reader wants a translation: ask the edge function (fire and forget)
  async function sent(m) {
    if (!m?.id || !m.tr) return;
    try {
      const token = await client.accessToken();
      const h = { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: 'Bearer ' + token };
      const res = await fetchImpl(SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/chat-translate', { method: 'POST', headers: h, body: JSON.stringify({ id: m.id }) });
      if (!res.ok) console.warn('translate: chat-translate', res.status);
    } catch (e) { console.warn('translate: chat-translate', e?.message || e); }
  }

  function apply(id, p) {
    const rec = lines.get(id), pref = translatePref();
    if (!rec || !pref.on) return;
    const text = p?.tr?.[pref.lang];
    if (typeof text !== 'string' || !text.trim() || p.src === pref.lang) return;
    const from = NAME[p.src] || p.src || '?';
    for (const it of rec.els) {
      const el = it.el; if (!el.isConnected) continue;
      el.textContent = text; el.dir = 'auto'; el.lang = pref.lang;
      el.classList.add('tr'); el.dataset.tr = '1'; el.title = fmt(t(TX.from), { lang: from });
      el.onclick = (e) => { // click: the original, click again: the translation
        e.stopPropagation();
        const showing = el.dataset.tr === '1';
        el.textContent = showing ? it.original : text; el.dataset.tr = showing ? '0' : '1';
        el.lang = showing ? (p.src || '') : pref.lang;
        el.title = showing ? t(TX.orig) : fmt(t(TX.from), { lang: from });
      };
    }
    if (rec.speaker && overhead?.say) overhead.say(rec.speaker, text); // the bubble over the speaker too
  }

  function track(id, el, original, speaker = null) {
    if (!id || !el) return;
    let rec = lines.get(id);
    if (!rec) { rec = { els: [], speaker, at: Date.now() }; lines.set(id, rec); }
    rec.els.push({ el, original });
    while (lines.size > TR.keepIds) lines.delete(lines.keys().next().value);
    if (early.has(id)) { const p = early.get(id); early.delete(id); apply(id, p); }
  }

  function onTr(p, meta) {
    if (meta.event !== 'tr' || meta.signed || !p?.id) return; // only the server publishes 'tr' (tr_publish), never a player
    if (lines.has(p.id)) return apply(p.id, p);
    early.set(p.id, p); setTimeout(() => early.delete(p.id), TR.waitMs);
  }
  const offs = [rt.on('chat:global', onTr), rt.on('player:' + rt.meId(), onTr)];

  return {
    sent, track,
    dispose() { for (const f of offs) f?.(); listeners.delete(tellServer); clearTimeout(refreshT); lines.clear(); early.clear(); },
  };
}
