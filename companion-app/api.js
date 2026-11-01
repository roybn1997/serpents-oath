// The Companion's only talk to the server: sign in (the game's own accounts) and the companion_* functions.
// No game table is read or written from here; the server functions are the only doors.
import { SUPABASE_URL, SUPABASE_KEY, EMAIL_DOMAIN } from './config.js';
import { usernameEmail } from './game/js/online/names.js';
const KEY = 'so-companion-session', base = SUPABASE_URL.replace(/\/+$/, '');
let session = null; try { session = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* storage blocked */ }
const keep = (s) => { session = s; try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* the session lives for this page */ } };
export class ApiError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }

async function call(path, { body, token, method = 'POST', keepalive = false } = {}) {
  const h = { apikey: SUPABASE_KEY, 'content-type': 'application/json' };
  if (token) h.authorization = 'Bearer ' + token;
  let r;
  try { r = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), keepalive }); }
  catch { throw new ApiError('OFFLINE', 0); }
  const text = await r.text(); let d = null; try { d = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!r.ok) {
    const msg = String(d?.message || d?.msg || d?.error_description || d?.error || ''), c = d?.error_code || d?.code || '';
    if (/^[A-Z_]{4,40}$/.test(msg)) throw new ApiError(msg, r.status);                    // our functions raise their code as the message
    if (c === 'invalid_credentials' || /invalid login/i.test(msg)) throw new ApiError('BAD_CREDENTIALS', r.status);
    if (c === 'PGRST301' || c === 'PGRST303' || r.status === 401) throw new ApiError('SESSION_EXPIRED', r.status);
    if (r.status === 429) throw new ApiError('RATE_LIMITED', r.status);
    throw new ApiError(r.status >= 500 ? 'SERVICE' : 'UNEXPECTED', r.status);
  }
  return d;
}
const toSession = (d) => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), user: { id: d.user?.id } });
let refreshing = null;
async function token() {
  if (!session) throw new ApiError('SIGNED_OUT', 401);
  if (session.expires_at - Date.now() / 1000 > 60) return session.access_token;
  refreshing ||= (async () => {
    try { keep(toSession(await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } }))); }
    catch (e) { if (e.code !== 'OFFLINE' && e.code !== 'SERVICE') keep(null); throw session ? e : new ApiError('SESSION_EXPIRED', 401); }
    finally { refreshing = null; }
  })();
  await refreshing; return session.access_token;
}
export const rpc = async (name, body = {}, opts = {}) => {
  try { return await call('/rest/v1/rpc/' + name, { body, token: await token(), ...opts }); }
  catch (e) { if (e.code === 'SESSION_EXPIRED' && session) { session.expires_at = 0; return call('/rest/v1/rpc/' + name, { body, token: await token(), ...opts }); } throw e; }
};
export const signedIn = () => !!session;
export async function signIn(username, password) {
  const u = String(username || '').trim();
  if (u.length < 3 || !password) throw new ApiError('BAD_CREDENTIALS', 400);
  let d;
  try { d = await call('/auth/v1/token?grant_type=password', { body: { email: usernameEmail(u, EMAIL_DOMAIN), password } }); }
  catch (e) {
    if (e.code !== 'BAD_CREDENTIALS') throw e;
    const addr = await call('/rest/v1/rpc/login_email', { body: { p_username: u, p_password: password } }).catch(() => null);   // a launcher account has a real address
    if (typeof addr !== 'string' || !addr) throw e;
    d = await call('/auth/v1/token?grant_type=password', { body: { email: addr, password } });
  }
  keep(toSession(d));
}
export async function signOut() { const s = session; keep(null); if (s) { try { await call('/auth/v1/logout?scope=local', { token: s.access_token }); } catch { /* offline */ } } }
