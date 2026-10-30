// BETA ONLINE: spontaneous translation (Roy 30.10). The speaker's game calls this with { id } right after its own
// chat_send / whisper said `tr: true` (js/online/translate.js). This function:
//   1. finds out who is calling (their access token, through Auth),
//   2. takes the job from the database (public.tr_job: only the caller's own line, once, fresh, within the monthly budget;
//      the text comes from the server's copy, never from the request),
//   3. sends ONE request to the translation service for all the languages the readers want,
//   4. publishes the result (public.tr_publish -> a 'tr' event on the line's own topic).
// Secrets (Supabase dashboard > Edge Functions > Secrets), never in the game:
//   TRANSLATE_PROVIDER   azure (default) | google | deepl
//   AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION   (Azure AI Translator; the F0 tier is free up to 2M characters a month)
//   GOOGLE_TRANSLATE_KEY                            (Cloud Translation Basic v2)
//   DEEPL_KEY                                       (a key ending in ":fx" is the free API)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are given to every edge function by Supabase itself.
// Deploy: supabase functions deploy chat-translate --no-verify-jwt   (the token is checked here, see config.toml)

const CORS = {
  'access-control-allow-origin': '*', // the launcher loads the game from file:// (origin "null")
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
const env = (k: string) => (globalThis as any).Deno?.env.get(k) ?? (globalThis as any).process?.env?.[k] ?? '';

// the game's codes -> each service's codes
const AZURE: Record<string, string> = { zh: 'zh-Hans' };
const GOOGLE: Record<string, string> = { zh: 'zh-CN', he: 'iw' };
const DEEPL: Record<string, string> = { en: 'EN-US', pt: 'PT-BR', zh: 'ZH-HANS' };
const base = (code: string) => String(code || '').toLowerCase().split('-')[0].replace(/^iw$/, 'he');

// Text written only in a script that belongs to one language is clearly in that language: those readers need nothing.
// (Latin, Cyrillic and Arabic script are shared by many languages: there the service detects the language itself.)
const SCRIPT_LANG: [RegExp, string][] = [[/\p{Script=Hebrew}/u, 'he'], [/\p{Script=Greek}/u, 'el'], [/\p{Script=Thai}/u, 'th'], [/\p{Script=Hangul}/u, 'ko']];
export function plainScriptLang(text: string): string | null {
  const letters = [...text].filter((ch) => /\p{L}/u.test(ch));
  if (!letters.length) return null;
  for (const [re, lang] of SCRIPT_LANG) if (letters.every((ch) => re.test(ch))) return lang;
  return null;
}
export const hasLetters = (text: string) => /\p{L}/u.test(text);

type Result = { src: string; tr: Record<string, string> };

async function azure(text: string, langs: string[], fetchImpl = fetch): Promise<Result> {
  const q = langs.map((l) => 'to=' + encodeURIComponent(AZURE[l] || l)).join('&');
  const res = await fetchImpl('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&' + q, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': env('AZURE_TRANSLATOR_KEY'), 'Ocp-Apim-Subscription-Region': env('AZURE_TRANSLATOR_REGION') || 'global', 'content-type': 'application/json' },
    body: JSON.stringify([{ Text: text }]),
  });
  if (!res.ok) throw new Error('azure ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const d = (await res.json())?.[0] || {};
  const src = base(d.detectedLanguage?.language);
  const tr: Record<string, string> = {};
  for (const t of d.translations || []) { const l = langs.find((x) => (AZURE[x] || x).toLowerCase() === String(t.to).toLowerCase()); if (l) tr[l] = t.text; }
  return { src, tr };
}

async function google(text: string, langs: string[], fetchImpl = fetch): Promise<Result> {
  let src = '';
  const tr: Record<string, string> = {};
  await Promise.all(langs.map(async (l) => {
    const res = await fetchImpl('https://translation.googleapis.com/language/translate/v2?key=' + encodeURIComponent(env('GOOGLE_TRANSLATE_KEY')), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: text, target: GOOGLE[l] || l, format: 'text' }),
    });
    if (!res.ok) throw new Error('google ' + res.status);
    const t = (await res.json())?.data?.translations?.[0];
    if (t) { tr[l] = t.translatedText; src ||= base(t.detectedSourceLanguage); }
  }));
  return { src, tr };
}

async function deepl(text: string, langs: string[], fetchImpl = fetch): Promise<Result> {
  const key = env('DEEPL_KEY'), host = /:fx$/.test(key) ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  let src = '';
  const tr: Record<string, string> = {};
  await Promise.all(langs.map(async (l) => {
    const res = await fetchImpl(host + '/v2/translate', {
      method: 'POST', headers: { authorization: 'DeepL-Auth-Key ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ text: [text], target_lang: DEEPL[l] || l.toUpperCase() }),
    });
    if (!res.ok) return; // (a language DeepL does not have: that reader keeps the original)
    const t = (await res.json())?.translations?.[0];
    if (t) { tr[l] = t.text; src ||= base(t.detected_source_language); }
  }));
  return { src, tr };
}

export const PROVIDERS: Record<string, typeof azure> = { azure, google, deepl };

// the whole job, with the outside world passed in (so it can be tested without Supabase or a translation service)
export async function handle(req: Request, { fetchImpl = fetch, provider = env('TRANSLATE_PROVIDER') || 'azure' } = {}): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'METHOD' }, 405);
  const url = env('SUPABASE_URL').replace(/\/+$/, ''), service = env('SUPABASE_SERVICE_ROLE_KEY');
  const svc = { apikey: service, 'content-type': 'application/json', ...(/^eyJ/.test(service) ? { authorization: 'Bearer ' + service } : {}) };
  const rpc = async (fn: string, args: unknown) => {
    const r = await fetchImpl(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: svc, body: JSON.stringify(args) });
    if (!r.ok) throw new Error(fn + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const t = await r.text(); return t ? JSON.parse(t) : null;
  };

  // who is asking
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/.test(auth)) return json({ error: 'SIGNED_OUT' }, 401);
  const who = await fetchImpl(`${url}/auth/v1/user`, { headers: { apikey: service, authorization: auth } });
  if (!who.ok) return json({ error: 'SIGNED_OUT' }, 401);
  const uid = (await who.json())?.id;
  let id = '';
  try { id = String((await req.json())?.id || ''); } catch { /* */ }
  if (!uid || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'BAD_REQUEST' }, 400);

  // the job
  const job = await rpc('tr_job', { p_uid: uid, p_msg: id });
  if (!job || job.over || !job.langs?.length) return json({ done: false, over: !!job?.over });
  const text = String(job.text || '');
  if (!hasLetters(text)) return json({ done: false }); // numbers, emoji, "!!!": the same in every language
  const known = plainScriptLang(text);
  const langs = (job.langs as string[]).filter((l) => l !== known);
  if (!langs.length) return json({ done: false });

  // the translation, then the readers
  const run = PROVIDERS[provider] || azure;
  let out: Result;
  try { out = await run(text, langs, fetchImpl); } catch (e) { console.error('translate', String(e)); return json({ done: false, error: 'PROVIDER' }, 502); }
  const src = known || out.src;
  for (const l of Object.keys(out.tr)) if (l === src || out.tr[l] === text) delete out.tr[l]; // already in that language
  if (!Object.keys(out.tr).length) return json({ done: false, src });
  await rpc('tr_publish', { p_msg: id, p_src: src, p_tr: out.tr });
  return json({ done: true, src, langs: Object.keys(out.tr) });
}

(globalThis as any).Deno?.serve((req: Request) => handle(req).catch((e) => { console.error(e); return json({ error: 'UNEXPECTED' }, 500); }));
