-- BETA ONLINE: spontaneous translation of what players write (Roy 30.10; client js/online/translate.js, edge function
-- server/supabase/functions/chat-translate). Safe to run again.
-- The flow: chat_send / whisper keep the line a few minutes in private.chat_recent and answer `tr: true` when some reader
-- wants a translation now. The speaker's game then calls the edge function with the message id only. The function takes
-- the job here (tr_job: the text, the topic, the languages the readers want, the monthly budget), asks the translation
-- service ONCE for all of those languages, and publishes the result through tr_publish as a 'tr' event on the same topic.
-- One paid request per message, whatever the number of readers; same-language readers share it.

-- what each reader wants to read (null = off), refreshed by their game every ten minutes while in the world
create table if not exists private.tr_pref (
  account_id uuid primary key,
  lang       text,
  at         timestamptz not null default now()
);
create index if not exists tr_pref_at on private.tr_pref (at) where lang is not null;

-- the lines of the last minutes (the edge function translates only these, by id: never a text sent to it)
create table if not exists private.chat_recent (
  id         uuid primary key,
  account_id uuid not null,
  topic      text not null,
  event      text not null,
  text       text not null,
  to_account uuid,
  at         timestamptz not null default now(),
  tr_at      timestamptz
);
create index if not exists chat_recent_at on private.chat_recent (at);

-- characters sent to the translation service per month (the budget is checked before each request)
create table if not exists private.tr_usage (
  month date primary key,
  chars bigint not null default 0,
  calls int not null default 0
);
revoke all on private.tr_pref, private.chat_recent, private.tr_usage from public, anon, authenticated;

-- the numbers, tunable without a code change:
--   enabled        false turns every translation off at once
--   monthly_chars  the budget (Azure Translator's free tier is 2,000,000 a month; this stays under it)
--   max_langs      at most this many languages per message (the most wanted first)
--   fresh_min      a reader counts while their game refreshed the setting within this many minutes
--   keep_min       how long a line can still be translated
insert into private.online_config (key, value)
values ('translate', '{"enabled": true, "monthly_chars": 1900000, "max_langs": 8, "fresh_min": 30, "keep_min": 5}'::jsonb)
on conflict (key) do nothing;

-- the languages a reader may ask for (the same list as TR_LANGS in js/online/translate.js)
create or replace function private.tr_lang_ok(p text) returns boolean
language sql immutable set search_path = ''
as $$ select p = any (array['he','en','es','fr','de','it','pt','ru','uk','pl','nl','ro','cs','sv','el','tr','ar','fa','hi','th','vi','id','ja','ko','zh']) $$;
revoke all on function private.tr_lang_ok(text) from public, anon, authenticated;

create or replace function private.tr_cfg() returns jsonb
language sql stable security definer set search_path = ''
as $$ select coalesce((select value from private.online_config where key = 'translate'), '{}'::jsonb) $$;
revoke all on function private.tr_cfg() from public, anon, authenticated;

-- does any reader (other than the speaker) want translations now? (to_account: only that one reader, for a whisper)
create or replace function private.tr_wanted(p_uid uuid, p_to uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((private.tr_cfg() ->> 'enabled')::boolean, true) and exists (
    select 1 from private.tr_pref p
     where p.lang is not null and p.account_id <> p_uid and (p_to is null or p.account_id = p_to)
       and p.at > now() - make_interval(mins => coalesce((private.tr_cfg() ->> 'fresh_min')::int, 30)))
$$;
revoke all on function private.tr_wanted(uuid, uuid) from public, anon, authenticated;

-- keep a line for the translator (and drop the old ones; a handful of rows at any time)
create or replace function private.chat_keep(p_id uuid, p_uid uuid, p_topic text, p_event text, p_text text, p_to uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  delete from private.chat_recent where at < now() - make_interval(mins => coalesce((private.tr_cfg() ->> 'keep_min')::int, 5));
  insert into private.chat_recent (id, account_id, topic, event, text, to_account) values (p_id, p_uid, p_topic, p_event, p_text, p_to)
    on conflict (id) do nothing;
end $$;
revoke all on function private.chat_keep(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- the player's side
-- ---------------------------------------------------------------------------------------------------------------------
-- the language I want to read other players in (null = off)
create or replace function public.set_translate_lang(p_lang text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_SIGNED_IN' using errcode = 'P0001'; end if;
  if p_lang is not null and not private.tr_lang_ok(p_lang) then raise exception 'LANG_INVALID' using errcode = 'P0001'; end if;
  insert into private.tr_pref (account_id, lang, at) values (uid, p_lang, now())
    on conflict (account_id) do update set lang = excluded.lang, at = excluded.at;
end $$;
revoke all on function public.set_translate_lang(text) from public, anon;
grant execute on function public.set_translate_lang(text) to authenticated;

-- chat_send and whisper as before (phase H), plus: the line is kept for the translator, and `tr` says if anyone wants it
create or replace function public.chat_send(p_channel text, p_text text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); c public.characters; t text; msg jsonb; mid uuid := gen_random_uuid(); want boolean;
begin
  c := private.rt_speaker(uid);
  if p_channel is null or p_channel !~ '^(global|zone:[a-z0-9._-]{1,48})$' then raise exception 'CHANNEL_INVALID' using errcode = 'P0001'; end if;
  t := private.chat_text(p_text);
  perform private.chat_take(uid);
  msg := jsonb_build_object('id', mid, 'c', c.id, 'n', c.name, 'text', t, 'ch', p_channel,
    'at', (extract(epoch from now()) * 1000)::bigint);
  perform realtime.send(msg, 'msg', 'chat:' || p_channel, true);
  want := private.tr_wanted(uid, null);
  if want then perform private.chat_keep(mid, uid, 'chat:' || p_channel, 'msg', t, null); end if;
  return msg || jsonb_build_object('tr', want);
end $$;

create or replace function public.whisper(p_to_name text, p_text text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); c public.characters; tgt public.characters; t text; msg jsonb; mid uuid := gen_random_uuid(); want boolean;
begin
  c := private.rt_speaker(uid);
  select * into tgt from public.characters where name_norm = public.norm_name(p_to_name);
  if not found then raise exception 'NO_SUCH_PLAYER' using errcode = 'P0001'; end if;
  if tgt.id = c.id then raise exception 'WHISPER_SELF' using errcode = 'P0001'; end if;
  t := private.chat_text(p_text);
  perform private.chat_take(uid);
  msg := jsonb_build_object('id', mid, 'c', c.id, 'n', c.name, 'to', tgt.id, 'to_n', tgt.name, 'text', t,
    'at', (extract(epoch from now()) * 1000)::bigint);
  perform realtime.send(msg, 'whisper', 'player:' || tgt.id::text, true);
  want := private.tr_wanted(uid, tgt.account_id);
  if want then perform private.chat_keep(mid, uid, 'player:' || tgt.id::text, 'whisper', t, tgt.account_id); end if;
  return msg || jsonb_build_object('tr', want);
end $$;
revoke all on function public.chat_send(text, text), public.whisper(text, text) from public, anon;
grant execute on function public.chat_send(text, text), public.whisper(text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- the edge function's side (service_role only; players cannot call these)
-- ---------------------------------------------------------------------------------------------------------------------
-- take a line to translate: only the speaker's own line, only once, only while it is fresh, only within the budget.
-- Returns null (nothing to do) or { text, topic, langs[], over }.
create or replace function public.tr_job(p_uid uuid, p_msg uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare r private.chat_recent; cfg jsonb := private.tr_cfg(); langs text[]; cost bigint; m date := date_trunc('month', now())::date;
  cap bigint := coalesce((cfg ->> 'monthly_chars')::bigint, 1900000); used bigint;
begin
  if not coalesce((cfg ->> 'enabled')::boolean, true) then return null; end if;
  select * into r from private.chat_recent where id = p_msg for update;
  if not found or r.account_id <> p_uid or r.tr_at is not null then return null; end if;
  update private.chat_recent set tr_at = now() where id = p_msg;
  select array_agg(lang) into langs from (
    select p.lang from private.tr_pref p
     where p.lang is not null and p.account_id <> p_uid and (r.to_account is null or p.account_id = r.to_account)
       and p.at > now() - make_interval(mins => coalesce((cfg ->> 'fresh_min')::int, 30))
     group by p.lang order by count(*) desc, p.lang
     limit greatest(1, coalesce((cfg ->> 'max_langs')::int, 8))) x;
  if langs is null then return null; end if;
  cost := char_length(r.text)::bigint * cardinality(langs);
  insert into private.tr_usage (month) values (m) on conflict (month) do nothing;
  select chars into used from private.tr_usage where month = m for update;
  if used + cost > cap then return jsonb_build_object('over', true, 'langs', '[]'::jsonb); end if;
  update private.tr_usage set chars = chars + cost, calls = calls + 1 where month = m;
  return jsonb_build_object('text', r.text, 'topic', r.topic, 'langs', to_jsonb(langs), 'over', false);
end $$;

-- publish a translation: { id, src, tr: { lang: text } } as a 'tr' event on the line's topic
create or replace function public.tr_publish(p_msg uuid, p_src text, p_tr jsonb) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare r private.chat_recent; k text; v text; tr jsonb := '{}'::jsonb;
begin
  select * into r from private.chat_recent where id = p_msg;
  if not found or p_tr is null or jsonb_typeof(p_tr) <> 'object' then return; end if;
  for k, v in select key, value from jsonb_each_text(p_tr) loop
    if private.tr_lang_ok(k) and v is not null and char_length(v) between 1 and 800 then
      tr := tr || jsonb_build_object(k, btrim(regexp_replace(v, '[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩﻿]', '', 'g')));
    end if;
  end loop;
  if tr = '{}'::jsonb then return; end if;
  perform realtime.send(jsonb_build_object('id', p_msg, 'src', left(coalesce(p_src, ''), 12), 'tr', tr), 'tr', r.topic, true);
end $$;
revoke all on function public.tr_job(uuid, uuid), public.tr_publish(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.tr_job(uuid, uuid), public.tr_publish(uuid, text, jsonb) to service_role;
