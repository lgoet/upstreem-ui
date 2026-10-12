-- =============================================================================
-- Onboarding v1 (13.10.2026)  –  als EIN Block ausführen
-- Rückweg: onboarding_v1_rueckweg.sql
-- Vertrag: ONBOARDING_V1_VERTRAG.md
--
-- Inhalt
--   1  Felder und Tabelle (nur neu; nichts umbenannt oder entfernt)
--   2  Helfer (Text, Website, Geschäftsmodell, Phasen, Farben, Testphase, Rate-Limit)
--   3  Altbestand absichern (Trigger auf REST-Prompts, onboarding_submit, onboarding_start_v1,
--      anon-Rechte, Broadcast mit error_code)
--   4  Nutzer-RPCs: onboarding_bundle_v1, onboarding_status_v1, onboarding_select_v1,
--      onboarding_prompt_add_v1, onboarding_prompt_remove_v1, onboarding_plans_v1
--   5  Edge-RPCs (service_role): _onb_start_v1, _onb_prompts_start_v1, _onb_checkout_prepare_v1,
--      _onb_checkout_set_v1, _onb_checkout_lookup_v1, _onb_trial_register_v1,
--      _onb_finalize_failed_v1
--   6  n8n-RPCs (service_role, Token Pflicht): onboarding_run_context_v1, onboarding_run_update_v1,
--      onboarding_run_finish_analysis_v1, onboarding_run_finish_prompts_v1
--   7  Aufräumer für hängende Läufe + Cron
--   8  Rechte
-- =============================================================================
begin;

-- =============================================================================
-- 1  Felder und Tabelle
-- =============================================================================
alter table app.onboarding_project
  add column if not exists error_code text,
  add column if not exists prompt_selection_key text,
  add column if not exists checkout_trial_days smallint;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'onboarding_project_error_code_check') then
    alter table app.onboarding_project add constraint onboarding_project_error_code_check
      check (error_code is null or error_code in (
        'website_unreachable', 'website_blocked', 'website_empty', 'website_invalid',
        'analysis_failed', 'prompts_failed', 'timeout', 'start_failed',
        'finalize_failed', 'finalize_state'));
  end if;
end $$;

alter table app.onboarding_candidate_topic
  add column if not exists is_own boolean not null default false;
alter table app.onboarding_suggested_prompt
  add column if not exists is_own boolean not null default false;

create table if not exists app.onboarding_trial_claim (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null,
  onboarding_id          uuid,
  website_domain         text,
  card_fingerprint       text,
  stripe_subscription_id text not null unique,
  trial_days             smallint not null,
  ended_early            boolean not null default false,
  created_at             timestamptz not null default now()
);
create index if not exists onboarding_trial_claim_user_idx on app.onboarding_trial_claim (user_id);
create index if not exists onboarding_trial_claim_domain_idx on app.onboarding_trial_claim (website_domain);
create index if not exists onboarding_trial_claim_card_idx on app.onboarding_trial_claim (card_fingerprint);
alter table app.onboarding_trial_claim enable row level security;
revoke all on app.onboarding_trial_claim from public, anon, authenticated;

create index if not exists onboarding_status_log_note_idx
  on app.onboarding_status_log (note, created_at) where note is not null;

-- =============================================================================
-- 2  Helfer (keine Rechte für Nutzer)
-- =============================================================================

-- 2.1 Nutzereingabe prüfen: NFKC, Leerraum zusammenfassen, unsichtbare Zeichen entfernen,
--     sonst abweisen statt kürzen. hint = <feld>_empty | <feld>_too_long | <feld>_characters
create or replace function app._onb_text_v1(p text, p_max int, p_field text)
returns text
language plpgsql
immutable
set search_path to 'app', 'pg_temp'
as $function$
declare
  v text;
begin
  v := normalize(coalesce(p, ''), NFKC);
  -- unsichtbare Zeichen und Bidi-Steuerung still entfernen
  v := regexp_replace(v, '[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿￹-￻]', '', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  if v = '' then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = p_field || '_empty';
  end if;
  if v ~ '[\u0001-\u001f\u007f-\u009f]'
     or v ~ '[\U000e0000-\U000e007f\U0001f000-\U0001faff☀-➿⬀-⯿]'
     or v ~ '[<>`\\]' or position('${' in v) > 0
     or v ~ '^[=+@-]' then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = p_field || '_characters';
  end if;
  if char_length(v) > p_max then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = p_field || '_too_long';
  end if;
  return v;
end
$function$;

-- 2.2 Modell-Ausgabe säubern (nie werfen): Zeichen entfernen, an einer Wortgrenze kürzen.
create or replace function app._onb_soft_v1(p text, p_max int, p_multiline boolean default false)
returns text
language plpgsql
immutable
set search_path to 'app', 'pg_temp'
as $function$
declare
  v text;
  cut int;
begin
  if p is null then return null; end if;
  v := normalize(p, NFKC);
  v := regexp_replace(v, '</?[a-zA-Z!][^<>]{0,200}>', ' ', 'g');            -- HTML-Tags ganz entfernen
  v := regexp_replace(v, '[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿￹-￻]', '', 'g');
  v := regexp_replace(v, '[\U000e0000-\U000e007f\U0001f000-\U0001faff☀-➿⬀-⯿]', '', 'g');
  v := regexp_replace(v, '[<>`\\]', '', 'g');
  v := replace(v, '${', '$ {');
  if p_multiline then
    v := regexp_replace(v, '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]', ' ', 'g');
    v := regexp_replace(v, '[ \t]+', ' ', 'g');
  else
    v := regexp_replace(v, '[\u0001-\u001f\u007f-\u009f]', ' ', 'g');
    v := regexp_replace(v, '\s+', ' ', 'g');
  end if;
  v := btrim(v);
  v := regexp_replace(v, '^[=+@\-\s]+', '');
  if char_length(v) > p_max then
    cut := length(substring(left(v, p_max) from '^(.*)\s'));
    if cut is not null and cut >= (p_max * 0.6)::int then
      v := left(v, cut);
    else
      v := left(v, p_max);
    end if;
    v := regexp_replace(btrim(v), '[\s,;:\-–—]+$', '');
  end if;
  return nullif(btrim(v), '');
end
$function$;

-- 2.3 Website/Domain prüfen. Liefert den Host ohne www. (ASCII; Umlautdomains kommen als Punycode).
--     hint website_invalid | website_blocked
create or replace function app._onb_host_v1(p text)
returns text
language plpgsql
immutable
set search_path to 'app', 'pg_temp'
as $function$
declare
  s    text := lower(btrim(coalesce(p, '')));
  host text;
  port text;
begin
  if s = '' or char_length(s) > 255 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'website_invalid';
  end if;
  if s ~ '^[a-z][a-z0-9+.-]*://' then
    if s !~ '^https?://' then
      raise exception 'onboarding_invalid' using errcode = '22023', hint = 'website_invalid';
    end if;
    s := regexp_replace(s, '^https?://', '');
  end if;
  host := split_part(split_part(split_part(s, '/', 1), '?', 1), '#', 1);
  if position('@' in host) > 0 or host like '[%' then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'website_invalid';
  end if;
  if position(':' in host) > 0 then
    port := split_part(host, ':', 2);
    if port not in ('', '80', '443') then
      raise exception 'onboarding_invalid' using errcode = '22023', hint = 'website_invalid';
    end if;
    host := split_part(host, ':', 1);
  end if;
  host := regexp_replace(regexp_replace(host, '\.+$', ''), '^www\.', '');
  if host ~ '^[0-9.]+$' then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'website_blocked';
  end if;
  if char_length(host) > 253
     or host !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.(?:[a-z]{2,63}|xn--[a-z0-9-]+)$'
     or exists (select 1 from unnest(string_to_array(host, '.')) l where char_length(l) > 63) then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'website_invalid';
  end if;
  if host ~ '(^|\.)(localhost|local|internal|lan|home|corp|intranet|test|example|invalid|onion|arpa|localdomain|home\.arpa)$'
     or host ~ '\.supabase\.(co|in)$'
     or host ~ '(^|\.)(nip\.io|sslip\.io|xip\.io|localtest\.me|lvh\.me)$' then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'website_blocked';
  end if;
  return host;
end
$function$;

create or replace function app._onb_host_try_v1(p text)
returns text
language plpgsql
immutable
set search_path to 'app', 'pg_temp'
as $function$
begin
  return app._onb_host_v1(p);
exception when others then
  return null;
end
$function$;

-- 2.4 Geschäftsmodell: Code oder Bezeichnung -> gespeicherte Bezeichnung (wie n8n sie erwartet)
create or replace function app._onb_bm_v1(p text)
returns text
language sql
immutable
set search_path to 'app', 'pg_temp'
as $function$
  select case lower(btrim(coalesce(p, '')))
    when 'b2b' then 'B2B'
    when 'b2c' then 'B2C'
    when 'hybrid' then 'Hybrid (B2B & B2C)'
    when 'hybrid (b2b & b2c)' then 'Hybrid (B2B & B2C)'
    when 'citiesregions' then 'Cities & Regions'
    when 'cities & regions' then 'Cities & Regions'
    else null end
$function$;

create or replace function app._onb_bm_code_v1(p text)
returns text
language sql
immutable
set search_path to 'app', 'pg_temp'
as $function$
  select case p
    when 'B2B' then 'B2B' when 'B2C' then 'B2C'
    when 'Hybrid (B2B & B2C)' then 'Hybrid' when 'Cities & Regions' then 'CitiesRegions'
    else null end
$function$;

-- 2.5 Phasen: Label und Prozent (bestätigte Tabelle)
create or replace function app._onb_phase_label_v1(p_phase int)
returns text
language sql
immutable
set search_path to 'app', 'pg_temp'
as $function$
  select case p_phase
    when 1 then 'Initializing project' when 2 then 'Scanning website' when 3 then 'Reading pages'
    when 4 then 'Analyzing brand' when 5 then 'Done' when 6 then 'Creating prompts'
    when 7 then 'Prompts ready' when 95 then 'Creating Workspace' when 100 then 'Completed' end
$function$;

create or replace function app._onb_phase_pct_v1(p_phase int)
returns smallint
language sql
immutable
set search_path to 'app', 'pg_temp'
as $function$
  select (case p_phase
    when 1 then 5 when 2 then 20 when 3 then 45 when 4 then 70 when 5 then 100
    when 6 then 60 when 7 then 100 when 95 then 95 when 100 then 100 end)::smallint
$function$;

-- 2.6 Themenfarben: dieselbe Palette und Verteilung wie bisher im n8n-Workflow
create or replace function app._onb_topic_colors_v1(p_n int, p_used text[] default '{}')
returns text[]
language plpgsql
immutable
set search_path to 'app', 'pg_temp'
as $function$
declare
  pal text[] := array[
    array['#de1b22','#b65616','#8d6a11','#108440','#107c84','#1b6eda','#9145e8','#d51a8b','#666666','#7d7d7d'],
    array['#ab2b2f','#8b4c23','#725a1d','#1b6a3c','#1b656a','#295ea3','#7a33cc','#a32972','#575757','#6f6f6f'],
    array['#b47476','#a87b5d','#988552','#4f926b','#509195','#6a88af','#977ab8','#b27098','#787878','#949494']];
  used text[] := coalesce(p_used, '{}');
  out  text[] := '{}';
  i int; hue int; grp int; h int; g int; hex text; found text;
begin
  for i in 0 .. greatest(p_n, 0) - 1 loop
    hue := (round(i * 8.0 / greatest(p_n, 1)))::int % 8;
    grp := i % 3;
    hex := pal[grp + 1][hue + 1];
    if hex = any(used) then
      found := null;
      <<outer>>
      for h in 0 .. 9 loop
        for g in 0 .. 2 loop
          if not (pal[g + 1][((hue + h) % 10) + 1] = any(used)) then
            found := pal[g + 1][((hue + h) % 10) + 1];
            exit outer;
          end if;
        end loop;
      end loop;
      hex := coalesce(found, hex);
    end if;
    used := used || hex;
    out := out || hex;
  end loop;
  return out;
end
$function$;

-- 2.7 Rate-Limit je Nutzer und Minute (für service_role-Aufrufe mit p_user; gleiche Tabelle wie _rl_hit_v1)
create or replace function app._onb_rl_v1(p_user uuid, p_key text, p_limit int)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_count int;
begin
  if coalesce(current_setting('app.warming', true), '') = 'on' then
    return;
  end if;
  delete from app.rate_limit_hit h
  where h.ctid in (select h2.ctid from app.rate_limit_hit h2
                   where h2.user_id = p_user and h2.fn_name = p_key and h2.at < v_window - interval '1 minute'
                   for update skip locked);
  insert into app.rate_limit_hit (user_id, fn_name, at) values (p_user, p_key, clock_timestamp());
  select count(*) into v_count from app.rate_limit_hit h
  where h.user_id = p_user and h.fn_name = p_key and h.at >= v_window;
  if v_count > p_limit then
    raise exception 'onboarding_rate_limited' using errcode = 'PT429',
      hint = (60 - floor(extract(second from clock_timestamp())))::int::text;
  end if;
end
$function$;

-- 2.8 Testphase erlaubt? Nein, wenn Nutzer oder Website-Domain schon eine hatten
--     (neue Tabelle) oder früher ein Monats-Onboarding mit Testphase abgeschlossen haben.
create or replace function app._onb_trial_eligible_v1(p_user uuid, p_domain text)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
  select not exists (
           select 1 from app.onboarding_trial_claim c
           where c.user_id = p_user
              or (p_domain is not null and c.website_domain = p_domain))
     and not exists (
           select 1 from app.onboarding_project op
           join app.billing_plan bp on bp.id = op.selected_billing_plan_id
           where op.status = 'completed'
             and op.billing_interval = 'monthly'
             and coalesce(bp.trial_days, 0) > 0
             and (op.user_id = p_user or (p_domain is not null and op.website_domain = p_domain)))
$function$;

-- 2.9 Neustart-Regel mit freiem Neustart nach einem gescheiterten Lauf
create or replace function app._onb_restart_v1(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v jsonb := app.onboarding_restart_policy(p_user);
  v_status text := v ->> 'status';
begin
  if (v ->> 'has_onboarding')::boolean and v_status = 'failed' and coalesce(v ->> 'reason', '') = 'rate_limited' then
    v := v || jsonb_build_object('allowed', true, 'reason', null, 'next_allowed_at', null, 'free_restart', true);
  else
    v := v || jsonb_build_object('free_restart', coalesce(v_status = 'failed', false));
  end if;
  return v;
end
$function$;

-- 2.10 Schlüssel der Themenauswahl (gleiche Auswahl -> kein neuer Promptlauf)
create or replace function app._onb_selection_key_v1(p_onboarding uuid)
returns text
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
  select md5(coalesce(string_agg(t.id::text, ',' order by t.id), ''))
  from app.onboarding_candidate_topic t
  where t.onboarding_id = p_onboarding and t.selected
$function$;

-- 2.11 Projekt eines Nutzers holen (fremd oder unbekannt -> onboarding_not_found)
create or replace function app._onb_row_v1(p_user uuid, p_onboarding uuid, p_lock boolean default false)
returns app.onboarding_project
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  r app.onboarding_project;
begin
  if p_lock then
    select * into r from app.onboarding_project where id = p_onboarding and user_id = p_user for update;
  else
    select * into r from app.onboarding_project where id = p_onboarding and user_id = p_user;
  end if;
  if not found then
    raise exception 'onboarding_not_found' using errcode = 'PT404';
  end if;
  return r;
end
$function$;

create or replace function app._onb_uid_v1()
returns uuid
language plpgsql
stable
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'onboarding_not_authenticated' using errcode = '28000';
  end if;
  return v;
end
$function$;

-- =============================================================================
-- 3  Altbestand absichern (Bubble nutzt ihn bis zur Umstellung)
-- =============================================================================

-- 3.1 Eigene Prompts per REST (Bubble): gleiche Regeln wie onboarding_prompt_add_v1
create or replace function app._onb_prompt_guard_v1()
returns trigger
language plpgsql
security invoker
set search_path to 'app', 'pg_temp'
as $function$
-- security invoker mit Absicht: current_user ist die Rolle des Aufrufers.
-- Direkt über REST = authenticated; in einer RPC (security definer) = Eigentümer; n8n = service_role.
declare
  v_status app.onboarding_status;
  v_market text;
  v_own int;
  v_sel int;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('onb_prompt:' || new.onboarding_id::text)::bigint);
  select op.status, op.market into v_status, v_market
  from app.onboarding_project op
  where op.id = new.onboarding_id and op.user_id = auth.uid();
  if not found then
    raise exception 'onboarding_not_found' using errcode = 'PT404';
  end if;
  if v_status not in ('ready', 'awaiting_billing') then
    raise exception 'onboarding_busy' using errcode = 'PT409', hint = v_status::text;
  end if;
  new.prompt_text := app._onb_text_v1(new.prompt_text, 300, 'prompt');
  if char_length(new.prompt_text) < 3 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'prompt_empty';
  end if;
  select count(*) filter (where p.is_own or p.onboarding_candidate_topic_id is null),
         count(*) filter (where p.selected)
    into v_own, v_sel
  from app.onboarding_suggested_prompt p
  where p.onboarding_id = new.onboarding_id;
  if v_own >= 10 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_prompts';
  end if;
  if coalesce(new.selected, false) and v_sel >= 15 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_selected';
  end if;
  new.onboarding_candidate_topic_id := null;
  new.is_own := true;
  new.market := v_market;
  return new;
end
$function$;

revoke all on function app._onb_prompt_guard_v1() from public, anon;
grant execute on function app._onb_prompt_guard_v1() to authenticated;

drop trigger if exists trg_onb_prompt_guard on app.onboarding_suggested_prompt;
create trigger trg_onb_prompt_guard
  before insert on app.onboarding_suggested_prompt
  for each row execute function app._onb_prompt_guard_v1();

revoke update, delete on app.onboarding_suggested_prompt from authenticated, anon;

-- 3.2 onboarding_submit: nur draft/failed -> submitted (vorher jeder Status, auch nach der Kasse)
--     Alte Definition (md5 5d883157d26f5e020e5459ec3ff38887) im Rückweg.
CREATE OR REPLACE FUNCTION app.onboarding_submit(p_onboarding_id uuid)
 RETURNS TABLE(team_id uuid, status app.onboarding_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- 13.10.2026: Nur ein Entwurf oder ein fehlgeschlagener Lauf wird eingereicht.
  -- Jeder andere Status bleibt unverändert und wird nur zurückgegeben.
  return query
    update app.onboarding_project p
       set status = 'submitted'::app.onboarding_status,
           updated_at = now()
     where p.id = p_onboarding_id
       and p.user_id = v_uid
       and p.status in ('draft'::app.onboarding_status, 'failed'::app.onboarding_status)
     returning null::uuid as team_id, p.status;

  if not found then
    return query
      select null::uuid, p.status
      from app.onboarding_project p
      where p.id = p_onboarding_id
        and p.user_id = v_uid;

    if not found then
      raise exception 'Onboarding not found or not owned by user';
    end if;
  end if;
end
$function$;

-- 3.3 onboarding_start_v1 (Bubble): Name und Website wie in v1 prüfen; sonst unverändert.
--     Alte Definition (md5 8d0788f9…) im Rückweg.
CREATE OR REPLACE FUNCTION app.onboarding_start_v1(p_company_name text, p_website text, p_market text DEFAULT NULL::text, p_business_model text DEFAULT NULL::text, p_timezone text DEFAULT NULL::text, p_mode app.account_mode DEFAULT 'Brand'::app.account_mode)
 RETURNS TABLE(onboarding_id uuid, run_token uuid, status text, website_url text, website_domain text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  v_user_id uuid;
  v_url     text;
  v_domain  text;
  v_id      uuid;
  v_token   uuid := gen_random_uuid();
  v_existing_id uuid;
  v_policy  jsonb;
  v_name    text;
begin
  v_user_id := coalesce(
    auth.uid(),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  );
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_website), '') = '' then
    raise exception 'website is required' using errcode = 'P0001';
  end if;

  -- 13.10.2026: Website (nur http/https, keine IP, keine internen Hosts) und Name (max. 60) wie v1
  v_domain := app._onb_host_v1(p_website);
  v_url := 'https://' || v_domain || '/';
  v_name := case when coalesce(btrim(p_company_name), '') = '' then null
                 else app._onb_text_v1(p_company_name, 60, 'name') end;

  perform pg_advisory_xact_lock(
    hashtext('onboarding_start:' || v_user_id::text)::bigint
  );

  select id into v_existing_id
  from app.onboarding_project
  where user_id = v_user_id
  limit 1
  for update;

  if v_existing_id is not null then
    v_policy := app.onboarding_restart_policy(v_user_id);

    if (v_policy ->> 'allowed')::boolean is not true then
      raise exception 'restart_not_allowed: % (%)',
        v_policy ->> 'reason', v_policy::text
        using errcode = 'P0001';
    end if;
  end if;

  insert into app.onboarding_project (
    user_id, mode, company_name, business_model, brand_industry,
    market, website_input, website_url, website_domain, timezone,
    run_token, status, status_phase, status_label, progress_percent,
    last_error, summary, team_id
  ) values (
    v_user_id, p_mode, v_name, p_business_model,
    null,
    nullif(btrim(p_market), ''), btrim(p_website), v_url, v_domain,
    nullif(btrim(p_timezone), ''),
    v_token, 'submitted', 1, 'Initializing project', 5,
    null, null, null
  )
  on conflict (user_id) do update set
    mode             = excluded.mode,
    company_name     = excluded.company_name,
    business_model   = excluded.business_model,
    brand_industry   = null,
    market           = excluded.market,
    website_input    = excluded.website_input,
    website_url      = excluded.website_url,
    website_domain   = excluded.website_domain,
    timezone         = excluded.timezone,
    run_token        = excluded.run_token,
    status           = 'submitted',
    status_phase     = 1,
    status_label     = 'Initializing project',
    progress_percent = 5,
    last_error       = null,
    error_code       = null,
    summary          = null,
    team_id          = null,
    selected_billing_plan_id   = null,
    billing_interval           = null,
    stripe_checkout_session_id = null,
    stripe_checkout_url        = null,
    checkout_trial_days        = null,
    prompt_selection_key       = null,
    run_group_uuid             = null,
    updated_at       = now()
  returning id into v_id;

  delete from app.onboarding_suggested_prompt      where onboarding_id = v_id;
  delete from app.onboarding_candidate_topic       where onboarding_id = v_id;
  delete from app.onboarding_candidate_competitor  where onboarding_id = v_id;

  if v_existing_id is not null then
    insert into app.onboarding_status_log (
      onboarding_id, status, status_phase, status_label, progress_percent, note
    ) values (
      v_id, 'submitted'::app.onboarding_status, 1, 'Initializing project', 5, 'restart'
    );
  end if;

  return query
  select v_id, v_token, 'submitted'::text, v_url, v_domain;
end
$function$;

-- 3.4 Rechte: anon und PUBLIC raus aus den alten Hüllen
revoke execute on function public.onboarding_get_status(uuid)        from public, anon;
revoke execute on function public.onboarding_save_step1(jsonb)       from public, anon;
revoke execute on function public.onboarding_save_step1_debug(jsonb) from public, anon;
revoke execute on function public.onboarding_submit(jsonb)           from public, anon;
revoke execute on function app.get_my_teams_v4()                      from public, anon;
revoke execute on function app.fn_onboarding_project_log()            from public, anon;
grant execute on function public.onboarding_get_status(uuid)        to authenticated, service_role;
grant execute on function public.onboarding_save_step1(jsonb)       to authenticated, service_role;
grant execute on function public.onboarding_save_step1_debug(jsonb) to authenticated, service_role;
grant execute on function public.onboarding_submit(jsonb)           to authenticated, service_role;
grant execute on function app.get_my_teams_v4()                      to authenticated;

-- 3.5 Broadcast: zusätzlich error_code. Die übrigen Felder bleiben, bis Bubble umgestellt ist.
--     Alte Definition (md5 59733c56c59b1a30eaaae35c90eb67fe) im Rückweg.
CREATE OR REPLACE FUNCTION app.onboarding_broadcast_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if TG_OP = 'UPDATE'
     and NEW.status           is not distinct from OLD.status
     and NEW.status_phase     is not distinct from OLD.status_phase
     and NEW.status_label     is not distinct from OLD.status_label
     and NEW.progress_percent is not distinct from OLD.progress_percent
     and NEW.last_error       is not distinct from OLD.last_error
     and NEW.error_code       is not distinct from OLD.error_code
  then
    return null;
  end if;

  -- 13.10.2026: error_code dazu. v1-Oberflaeche liest nur status, status_phase,
  -- progress_percent, error_code; der Rest bleibt fuer die alte Bubble-Seite.
  perform realtime.send(
    jsonb_build_object(
      'onboarding_id',    NEW.id,
      'status',           NEW.status,
      'status_phase',     NEW.status_phase,
      'progress_percent', NEW.progress_percent,
      'error_code',       NEW.error_code,
      'status_label',     NEW.status_label,
      'last_error',       NEW.last_error,
      'updated_at',       NEW.updated_at
    ),
    'onboarding_status',
    'onboarding:' || NEW.id::text,
    false
  );

  return null;
end;
$function$;

-- =============================================================================
-- 4  Nutzer-RPCs (authenticated)
-- =============================================================================

-- 4.1 Bündel
create or replace function app.onboarding_bundle_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := app._onb_uid_v1();
  p app.onboarding_project;
  v_restart jsonb;
  v_meta jsonb;
begin
  select * into p from app.onboarding_project where user_id = v_uid;
  v_restart := app._onb_restart_v1(v_uid);

  v_meta := jsonb_build_object(
    'data_as_of', now(),
    'restart', jsonb_build_object(
      'has_onboarding',  coalesce((v_restart ->> 'has_onboarding')::boolean, false),
      'run_in_progress', coalesce((v_restart ->> 'run_in_progress')::boolean, false),
      'allowed',         coalesce((v_restart ->> 'allowed')::boolean, true),
      'reason',          v_restart ->> 'reason',
      'remaining',       (v_restart ->> 'remaining')::int,
      'limit',           (v_restart ->> 'limit')::int,
      'window_hours',    (v_restart ->> 'window_hours')::int,
      'next_allowed_at', v_restart -> 'next_allowed_at',
      'free_restart',    coalesce((v_restart ->> 'free_restart')::boolean, false)),
    'limits', jsonb_build_object(
      'name_max', 60, 'website_max', 255,
      'competitors_max', 5, 'topics_selected_max', 8, 'own_topics_max', 5, 'topic_max', 40,
      'prompts_selected_max', 15, 'own_prompts_max', 10, 'prompt_min', 3, 'prompt_max', 300,
      'prompt_runs_per_day', 5),
    'markets', coalesce((select jsonb_agg(jsonb_build_object('code', m.alpha2, 'name', m.name, 'flag_url', m.flag_url,
                                                               'language_code', m.language_code) order by m.name)
                         from app.markets m), '[]'::jsonb),
    'timezones', coalesce((select jsonb_agg(z.name order by z.name) from pg_timezone_names z
                           where z.name ~ '^(Africa|America|Antarctica|Asia|Atlantic|Australia|Europe|Indian|Pacific)/'
                              or z.name = 'UTC'), '[]'::jsonb),
    'business_models', jsonb_build_array(
      jsonb_build_object('code', 'B2B', 'label', 'B2B'),
      jsonb_build_object('code', 'B2C', 'label', 'B2C'),
      jsonb_build_object('code', 'Hybrid', 'label', 'Hybrid (B2B & B2C)'),
      jsonb_build_object('code', 'CitiesRegions', 'label', 'Cities & Regions')));

  if p.id is null then
    return jsonb_build_object('meta', v_meta, 'row', null);
  end if;

  return jsonb_build_object('meta', v_meta, 'row', jsonb_build_object(
    'project', jsonb_build_object(
      'onboarding_id', p.id, 'status', p.status, 'status_phase', p.status_phase,
      'progress_percent', p.progress_percent, 'error_code', p.error_code,
      'company_name', p.company_name, 'website_input', p.website_input,
      'website_url', p.website_url, 'website_domain', p.website_domain,
      'market', p.market, 'timezone', p.timezone,
      'business_model', app._onb_bm_code_v1(p.business_model),
      'industry', p.brand_industry, 'summary', p.summary,
      'selected_plan_id', p.selected_billing_plan_id, 'billing_interval', p.billing_interval,
      'checkout_open', (p.status = 'awaiting_billing' and p.stripe_checkout_session_id is not null),
      'team_id', p.team_id, 'created_at', p.created_at, 'updated_at', p.updated_at),
    'competitors', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'domain', c.domain,
                                          'favicon_url', c.favicon_url, 'selected', c.selected)
                       order by c.created_at, c.name)
      from app.onboarding_candidate_competitor c where c.onboarding_id = p.id), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'description', null,
                                          'hex_light', t.hex_light, 'hex_dark', t.hex_dark,
                                          'selected', t.selected, 'is_own', t.is_own)
                       order by t.is_own, t.sort_order, t.name)
      from app.onboarding_candidate_topic t where t.onboarding_id = p.id), '[]'::jsonb),
    'prompts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'prompt_text', s.prompt_text, 'market', s.market,
               'topic_ids', coalesce((select jsonb_agg(l.candidate_topic_id order by l.is_primary desc, t2.sort_order)
                                      from app.onboarding_suggested_prompt_topic l
                                      join app.onboarding_candidate_topic t2 on t2.id = l.candidate_topic_id
                                      where l.suggested_prompt_id = s.id), '[]'::jsonb),
               'primary_topic_id', s.onboarding_candidate_topic_id,
               'selected', s.selected,
               'is_own', (s.is_own or s.onboarding_candidate_topic_id is null))
             order by (s.is_own or s.onboarding_candidate_topic_id is null), s.sort_order, s.created_at)
      from app.onboarding_suggested_prompt s where s.onboarding_id = p.id), '[]'::jsonb)));
end
$function$;

-- 4.2 Status (nach einem Wiederverbinden)
create or replace function app.onboarding_status_v1(p_onboarding uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  p app.onboarding_project := app._onb_row_v1(app._onb_uid_v1(), p_onboarding);
begin
  return jsonb_build_object(
    'meta', jsonb_build_object('data_as_of', now()),
    'row', jsonb_build_object(
      'onboarding_id', p.id, 'status', p.status, 'status_phase', p.status_phase,
      'progress_percent', p.progress_percent, 'error_code', p.error_code, 'team_id', p.team_id,
      'checkout_open', (p.status = 'awaiting_billing' and p.stripe_checkout_session_id is not null),
      'updated_at', p.updated_at));
end
$function$;

-- 4.3 Auswahl: die VOLLSTÄNDIGE Auswahl einer Art
create or replace function app.onboarding_select_v1(p_onboarding uuid, p_kind text, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := app._onb_uid_v1();
  p app.onboarding_project;
  v_ids uuid[];
  v_max int;
  v_n int;
  v_rows jsonb;
begin
  perform app._pi_rate_limit_v1('onboarding_select', 120, 'onboarding');
  if p_kind is null or p_kind not in ('competitors', 'topics', 'prompts') then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'kind';
  end if;
  p := app._onb_row_v1(v_uid, p_onboarding, true);
  if p.status not in ('ready', 'awaiting_billing') then
    raise exception 'onboarding_busy' using errcode = 'PT409', hint = p.status::text;
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_ids, '{}')) x where x is not null;

  if p_kind = 'competitors' then
    v_max := 5;
    select coalesce(array_agg(c.id), '{}') into v_ids from app.onboarding_candidate_competitor c
    where c.onboarding_id = p.id and c.id = any(v_ids);
    if cardinality(v_ids) > v_max then
      raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_competitors';
    end if;
    update app.onboarding_candidate_competitor c set selected = (c.id = any(v_ids))
    where c.onboarding_id = p.id and c.selected is distinct from (c.id = any(v_ids));
    select coalesce(jsonb_agg(c.id order by c.created_at, c.name), '[]') into v_rows
    from app.onboarding_candidate_competitor c where c.onboarding_id = p.id and c.selected;
  elsif p_kind = 'topics' then
    v_max := 8;
    select coalesce(array_agg(t.id), '{}') into v_ids from app.onboarding_candidate_topic t
    where t.onboarding_id = p.id and t.id = any(v_ids);
    if cardinality(v_ids) > v_max then
      raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_topics';
    end if;
    update app.onboarding_candidate_topic t set selected = (t.id = any(v_ids))
    where t.onboarding_id = p.id and t.selected is distinct from (t.id = any(v_ids));
    select coalesce(jsonb_agg(t.id order by t.is_own, t.sort_order, t.name), '[]') into v_rows
    from app.onboarding_candidate_topic t where t.onboarding_id = p.id and t.selected;
  else
    v_max := 15;
    select coalesce(array_agg(s.id), '{}') into v_ids from app.onboarding_suggested_prompt s
    where s.onboarding_id = p.id and s.id = any(v_ids);
    if cardinality(v_ids) > v_max then
      raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_prompts_selected';
    end if;
    update app.onboarding_suggested_prompt s set selected = (s.id = any(v_ids))
    where s.onboarding_id = p.id and s.selected is distinct from (s.id = any(v_ids));
    select coalesce(jsonb_agg(s.id order by s.sort_order, s.created_at), '[]') into v_rows
    from app.onboarding_suggested_prompt s where s.onboarding_id = p.id and s.selected;
  end if;

  update app.onboarding_project set updated_at = now() where id = p.id;
  v_n := jsonb_array_length(v_rows);
  return jsonb_build_object(
    'meta', jsonb_build_object('onboarding_id', p.id, 'kind', p_kind, 'count', v_n, 'max', v_max),
    'rows', v_rows);
end
$function$;

-- 4.4 Eigener Prompt
create or replace function app.onboarding_prompt_add_v1(p_onboarding uuid, p_text text, p_selected boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := app._onb_uid_v1();
  p app.onboarding_project;
  v_text text;
  v_own int; v_sel int;
  r app.onboarding_suggested_prompt;
begin
  perform app._pi_rate_limit_v1('onboarding_prompt_add', 30, 'onboarding');
  p := app._onb_row_v1(v_uid, p_onboarding, true);
  if p.status not in ('ready', 'awaiting_billing') or p.status_phase <> 7 then
    raise exception 'onboarding_busy' using errcode = 'PT409', hint = p.status::text;
  end if;
  v_text := app._onb_text_v1(p_text, 300, 'prompt');
  if char_length(v_text) < 3 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'prompt_empty';
  end if;
  select count(*) filter (where s.is_own or s.onboarding_candidate_topic_id is null),
         count(*) filter (where s.selected)
    into v_own, v_sel
  from app.onboarding_suggested_prompt s where s.onboarding_id = p.id;
  if v_own >= 10 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_prompts';
  end if;
  if coalesce(p_selected, true) and v_sel >= 15 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_prompts_selected';
  end if;
  if exists (select 1 from app.onboarding_suggested_prompt s
             where s.onboarding_id = p.id and lower(btrim(s.prompt_text)) = lower(v_text)) then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'prompt_duplicate';
  end if;
  insert into app.onboarding_suggested_prompt (onboarding_id, prompt_text, market, selected, is_own, sort_order)
  values (p.id, v_text, p.market, coalesce(p_selected, true), true, 1000)
  returning * into r;
  update app.onboarding_project set updated_at = now() where id = p.id;
  return jsonb_build_object(
    'meta', jsonb_build_object('onboarding_id', p.id, 'own_count', v_own + 1, 'own_max', 10),
    'row', jsonb_build_object('id', r.id, 'prompt_text', r.prompt_text, 'market', r.market,
                              'topic_ids', '[]'::jsonb, 'primary_topic_id', null,
                              'selected', r.selected, 'is_own', true));
end
$function$;

create or replace function app.onboarding_prompt_remove_v1(p_onboarding uuid, p_prompt uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := app._onb_uid_v1();
  p app.onboarding_project;
  v_n int;
begin
  perform app._pi_rate_limit_v1('onboarding_prompt_add', 30, 'onboarding');
  p := app._onb_row_v1(v_uid, p_onboarding, true);
  if p.status not in ('ready', 'awaiting_billing') then
    raise exception 'onboarding_busy' using errcode = 'PT409', hint = p.status::text;
  end if;
  delete from app.onboarding_suggested_prompt s
  where s.id = p_prompt and s.onboarding_id = p.id and (s.is_own or s.onboarding_candidate_topic_id is null);
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'onboarding_not_found' using errcode = 'PT404', hint = 'prompt';
  end if;
  update app.onboarding_project set updated_at = now() where id = p.id;
  return jsonb_build_object('meta', jsonb_build_object('onboarding_id', p.id, 'removed', p_prompt), 'row', null);
end
$function$;

-- 4.5 Tarife für die Kasse, mit Testphase für DIESEN Nutzer
create or replace function app.onboarding_plans_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := app._onb_uid_v1();
  v_domain text;
  v_eligible boolean;
begin
  select website_domain into v_domain from app.onboarding_project where user_id = v_uid;
  v_eligible := app._onb_trial_eligible_v1(v_uid, v_domain);
  return jsonb_build_object(
    'meta', jsonb_build_object('trial_eligible', v_eligible, 'currency', 'EUR'),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', bp.id, 'name', bp.name,
               'monthly_price_eur', bp.monthly_price_eur, 'yearly_price_eur', bp.yearly_price_eur,
               'prompts_per_day', bp.prompts_per_day,
               'ai_responses_per_month', bp.prompts_per_day * coalesce(bp.models_max_active, 1) * 30,
               'competitors_max_active', bp.competitors_max_active,
               'models_max_active', bp.models_max_active,
               'trial_days', coalesce(bp.trial_days, 0),
               'trial_days_effective', case when v_eligible then coalesce(bp.trial_days, 0) else 0 end,
               'sort_order', bp.sort_order)
             order by bp.sort_order, bp.monthly_price_eur)
      from app.billing_plan bp where bp.is_active), '[]'::jsonb));
end
$function$;

-- =============================================================================
-- 5  Edge-RPCs (nur service_role; der Nutzer kommt als p_user aus dem geprüften JWT)
-- =============================================================================

-- 5.1 Großer Lauf: anlegen oder neu starten. Antwort an die Edge Function, nie an den Browser.
create or replace function app._onb_start_v1(
  p_user uuid, p_company_name text, p_website text, p_market text, p_timezone text,
  p_business_model text, p_checkout_cleared boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_name text; v_domain text; v_market text; v_tz text; v_bm text;
  p app.onboarding_project;
  v_restart jsonb;
  v_token uuid := gen_random_uuid();
  v_id uuid;
  v_note text;
  v_n int;
begin
  if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'onboarding_not_authenticated' using errcode = '28000';
  end if;

  -- Eingaben (abweisen statt kürzen)
  v_name := app._onb_text_v1(p_company_name, 60, 'name');
  v_domain := app._onb_host_v1(p_website);
  v_market := upper(btrim(coalesce(p_market, '')));
  if not exists (select 1 from app.markets m where m.alpha2 = v_market) then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'market';
  end if;
  v_tz := btrim(coalesce(p_timezone, ''));
  if not exists (select 1 from pg_timezone_names z where z.name = v_tz) then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'timezone';
  end if;
  v_bm := app._onb_bm_v1(p_business_model);
  if v_bm is null then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'business_model';
  end if;

  perform app._onb_rl_v1(p_user, 'onboarding_start', 5);
  perform pg_advisory_xact_lock(hashtext('onboarding_start:' || p_user::text)::bigint);

  select * into p from app.onboarding_project where user_id = p_user for update;

  if p.id is not null then
    -- Ein Lauf läuft: den laufenden zurückgeben
    if p.status in ('submitted', 'processing') and p.updated_at > now() - interval '15 minutes' then
      return jsonb_build_object('onboarding_id', p.id, 'status', p.status, 'status_phase', p.status_phase,
                                'reused', true);
    end if;
    if p.status in ('finalizing', 'billing_completed') then
      raise exception 'onboarding_busy' using errcode = 'PT409', hint = p.status::text;
    end if;
    -- Offene Kasse: erst die Edge Function prüfen und verwerfen lassen
    if p.status = 'awaiting_billing' and p.stripe_checkout_session_id is not null and not coalesce(p_checkout_cleared, false) then
      return jsonb_build_object('onboarding_id', p.id, 'checkout_check', p.stripe_checkout_session_id);
    end if;
    v_restart := app._onb_restart_v1(p_user);
    if not coalesce((v_restart ->> 'allowed')::boolean, false) then
      raise exception 'onboarding_restart_limited' using errcode = 'PT429',
        hint = coalesce(v_restart ->> 'next_allowed_at', v_restart ->> 'reason');
    end if;
    v_note := case when p.status = 'failed' then 'restart_free' else 'restart' end;
  end if;

  -- Kosten: global höchstens 60 Starts je Stunde, je Website-Domain 5 je Tag (über alle Nutzer)
  select count(*) into v_n from app.onboarding_status_log l
  where l.note like 'run_start %' and l.created_at > now() - interval '1 hour';
  if v_n >= 60 then
    raise exception 'onboarding_rate_limited' using errcode = 'PT429', hint = 'global';
  end if;
  select count(*) into v_n from app.onboarding_status_log l
  where l.note = 'run_start ' || v_domain and l.created_at > now() - interval '24 hours';
  if v_n >= 5 then
    raise exception 'onboarding_rate_limited' using errcode = 'PT429', hint = 'website';
  end if;

  insert into app.onboarding_project (
    user_id, mode, company_name, business_model, brand_industry, market, website_input, website_url,
    website_domain, timezone, run_token, status, status_phase, status_label, progress_percent,
    last_error, error_code, summary, team_id)
  values (
    p_user, 'Brand', v_name, v_bm, null, v_market, btrim(p_website), 'https://' || v_domain || '/',
    v_domain, v_tz, v_token, 'submitted', 1, 'Initializing project', 5, null, null, null, null)
  on conflict (user_id) do update set
    mode = 'Brand', company_name = excluded.company_name, business_model = excluded.business_model,
    brand_industry = null, market = excluded.market, website_input = excluded.website_input,
    website_url = excluded.website_url, website_domain = excluded.website_domain,
    timezone = excluded.timezone, run_token = excluded.run_token,
    status = 'submitted', status_phase = 1, status_label = 'Initializing project', progress_percent = 5,
    last_error = null, error_code = null, summary = null, team_id = null,
    selected_billing_plan_id = null, billing_interval = null,
    stripe_checkout_session_id = null, stripe_checkout_url = null, checkout_trial_days = null,
    prompt_selection_key = null, run_group_uuid = null, updated_at = now()
  returning id into v_id;

  delete from app.onboarding_suggested_prompt     where onboarding_id = v_id;
  delete from app.onboarding_candidate_topic      where onboarding_id = v_id;
  delete from app.onboarding_candidate_competitor where onboarding_id = v_id;

  if v_note is not null then
    insert into app.onboarding_status_log (onboarding_id, status, status_phase, status_label, progress_percent, note)
    values (v_id, 'submitted', 1, 'Initializing project', 5, v_note);
  end if;
  insert into app.onboarding_status_log (onboarding_id, status, status_phase, status_label, progress_percent, note)
  values (v_id, 'submitted', 1, 'Initializing project', 5, 'run_start ' || v_domain);

  return jsonb_build_object('onboarding_id', v_id, 'run_token', v_token, 'status', 'submitted',
                            'status_phase', 1, 'reused', false, 'website_url', 'https://' || v_domain || '/');
end
$function$;

-- 5.2 Promptlauf: eigene Themen anlegen, Auswahl prüfen, Phase 6 setzen
create or replace function app._onb_prompts_start_v1(
  p_user uuid, p_onboarding uuid, p_new_topics text[], p_checkout_cleared boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  p app.onboarding_project;
  v_name text;
  v_names text[] := '{}';
  v_own int;
  v_sel int;
  v_key text;
  v_n int;
  v_colors text[];
  v_used text[];
  v_token uuid := gen_random_uuid();
  i int;
begin
  if p_user is null then
    raise exception 'onboarding_not_authenticated' using errcode = '28000';
  end if;
  perform app._onb_rl_v1(p_user, 'onboarding_prompts', 10);
  p := app._onb_row_v1(p_user, p_onboarding, true);

  if p.status = 'processing' and p.status_phase = 6 and p.updated_at > now() - interval '15 minutes' then
    return jsonb_build_object('onboarding_id', p.id, 'status', p.status, 'status_phase', p.status_phase, 'reused', true);
  end if;
  if p.status not in ('ready', 'awaiting_billing') or p.status_phase not in (5, 7) then
    raise exception 'onboarding_busy' using errcode = 'PT409', hint = p.status::text;
  end if;

  -- eigene Themen: höchstens 5 insgesamt, je höchstens 40 Zeichen
  if p_new_topics is not null and cardinality(p_new_topics) > 0 then
    if cardinality(p_new_topics) > 5 then
      raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_own_topics';
    end if;
    foreach v_name in array p_new_topics loop
      v_name := app._onb_text_v1(v_name, 40, 'topic');
      if not (lower(v_name) = any(select lower(x) from unnest(v_names) x)) then
        v_names := v_names || v_name;
      end if;
    end loop;
    -- Name schon vorhanden -> dieses Thema auswählen statt neu anlegen
    update app.onboarding_candidate_topic t set selected = true
    where t.onboarding_id = p.id and lower(btrim(t.name)) = any(select lower(x) from unnest(v_names) x);
    v_names := array(select x from unnest(v_names) x
                     where not exists (select 1 from app.onboarding_candidate_topic t
                                       where t.onboarding_id = p.id and lower(btrim(t.name)) = lower(x)));
    select count(*) into v_own from app.onboarding_candidate_topic t where t.onboarding_id = p.id and t.is_own;
    if v_own + cardinality(v_names) > 5 then
      raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_own_topics';
    end if;
    if cardinality(v_names) > 0 then
      select coalesce(array_agg(t.hex_light), '{}') into v_used from app.onboarding_candidate_topic t where t.onboarding_id = p.id;
      select count(*) into v_n from app.onboarding_candidate_topic t where t.onboarding_id = p.id;
      v_colors := app._onb_topic_colors_v1(v_n + cardinality(v_names));
      for i in 1 .. cardinality(v_names) loop
        insert into app.onboarding_candidate_topic (onboarding_id, name, hex_light, hex_dark, sort_order, selected, is_own)
        values (p.id, v_names[i], v_colors[v_n + i], v_colors[v_n + i], (100 + v_own + i)::smallint, true, true);
      end loop;
    end if;
  end if;

  select count(*) into v_sel from app.onboarding_candidate_topic t where t.onboarding_id = p.id and t.selected;
  if v_sel = 0 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'topics_empty';
  end if;
  if v_sel > 8 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_topics';
  end if;

  -- gleiche Auswahl wie beim letzten fertigen Lauf -> nichts neu erzeugen
  v_key := app._onb_selection_key_v1(p.id);
  if p.status_phase = 7 and p.prompt_selection_key = v_key
     and exists (select 1 from app.onboarding_suggested_prompt s where s.onboarding_id = p.id and not s.is_own
                 and s.onboarding_candidate_topic_id is not null) then
    return jsonb_build_object('onboarding_id', p.id, 'status', p.status, 'status_phase', p.status_phase, 'reused', true);
  end if;

  -- Kosten: höchstens 5 Promptläufe je Onboarding und Tag
  select count(*) into v_n from app.onboarding_status_log l
  where l.onboarding_id = p.id and l.note = 'prompt_run' and l.created_at > now() - interval '24 hours';
  if v_n >= 5 then
    raise exception 'onboarding_rate_limited' using errcode = 'PT429', hint = 'prompt_runs';
  end if;

  -- Offene Kasse zuerst verwerfen lassen (sonst passt die bezahlte Auswahl nicht mehr)
  if p.status = 'awaiting_billing' and p.stripe_checkout_session_id is not null and not coalesce(p_checkout_cleared, false) then
    return jsonb_build_object('onboarding_id', p.id, 'checkout_check', p.stripe_checkout_session_id);
  end if;

  update app.onboarding_project set
    status = 'processing', status_phase = 6, status_label = app._onb_phase_label_v1(6),
    progress_percent = app._onb_phase_pct_v1(6), last_error = null, error_code = null,
    run_token = v_token, stripe_checkout_session_id = null, stripe_checkout_url = null,
    checkout_trial_days = null, updated_at = now()
  where id = p.id;
  insert into app.onboarding_status_log (onboarding_id, status, status_phase, status_label, progress_percent, note)
  values (p.id, 'processing', 6, app._onb_phase_label_v1(6), app._onb_phase_pct_v1(6), 'prompt_run');

  return jsonb_build_object('onboarding_id', p.id, 'run_token', v_token, 'status', 'processing',
                            'status_phase', 6, 'reused', false);
end
$function$;

-- 5.3 Kasse vorbereiten: alles aus der DB
create or replace function app._onb_checkout_prepare_v1(p_user uuid, p_onboarding uuid, p_plan uuid, p_interval text)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  p app.onboarding_project;
  bp app.billing_plan;
  v_comp int; v_sel int;
  v_trial int;
  v_email text;
begin
  if p_user is null then
    raise exception 'onboarding_not_authenticated' using errcode = '28000';
  end if;
  perform app._onb_rl_v1(p_user, 'onboarding_checkout', 10);
  if p_interval is null or p_interval not in ('monthly', 'yearly') then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'billing_interval';
  end if;
  p := app._onb_row_v1(p_user, p_onboarding);
  if p.status not in ('ready', 'awaiting_billing') or p.status_phase <> 7 then
    raise exception 'onboarding_busy' using errcode = 'PT409', hint = p.status::text;
  end if;
  select * into bp from app.billing_plan where id = p_plan and is_active;
  if bp.id is null then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'plan';
  end if;
  if (case when p_interval = 'monthly' then bp.stripe_monthly_price_id else bp.stripe_yearly_price_id end) is null then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'plan';
  end if;
  select count(*) into v_comp from app.onboarding_candidate_competitor c where c.onboarding_id = p.id and c.selected;
  if v_comp > 5 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_competitors';
  end if;
  select count(*) into v_sel from app.onboarding_suggested_prompt s where s.onboarding_id = p.id and s.selected;
  if v_sel < 1 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'prompts_empty';
  end if;
  if v_sel > 15 then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'too_many_prompts_selected';
  end if;
  if p.market is null or not exists (select 1 from app.markets m where m.alpha2 = p.market) then
    raise exception 'onboarding_invalid' using errcode = '22023', hint = 'market';
  end if;
  v_trial := case when p_interval = 'monthly' and app._onb_trial_eligible_v1(p_user, p.website_domain)
                  then coalesce(bp.trial_days, 0) else 0 end;
  select email into v_email from auth.users where id = p_user;
  return jsonb_build_object(
    'onboarding_id', p.id, 'plan_id', bp.id, 'plan_name', bp.name, 'billing_interval', p_interval,
    'price_id', case when p_interval = 'monthly' then bp.stripe_monthly_price_id else bp.stripe_yearly_price_id end,
    'trial_days', v_trial, 'previous_session_id', p.stripe_checkout_session_id, 'email', v_email,
    'selected_prompts', v_sel, 'selected_competitors', v_comp);
end
$function$;

-- 5.4 Kasse merken (optimistischer Lock auf den Quellzustand)
create or replace function app._onb_checkout_set_v1(
  p_user uuid, p_onboarding uuid, p_plan uuid, p_interval text, p_session_id text, p_url text, p_trial_days int)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
begin
  update app.onboarding_project set
    status = 'awaiting_billing', selected_billing_plan_id = p_plan, billing_interval = p_interval,
    stripe_checkout_session_id = p_session_id, stripe_checkout_url = p_url,
    checkout_trial_days = coalesce(p_trial_days, 0)::smallint, error_code = null, last_error = null,
    updated_at = now()
  where id = p_onboarding and user_id = p_user and status in ('ready', 'awaiting_billing') and status_phase = 7
  returning id into v_id;
  if v_id is null then
    raise exception 'onboarding_busy' using errcode = 'PT409', hint = 'state_changed';
  end if;
  return jsonb_build_object('onboarding_id', v_id, 'status', 'awaiting_billing');
end
$function$;

-- 5.5 Sitzung nach der Rückkehr finden
create or replace function app._onb_checkout_lookup_v1(p_user uuid, p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  p app.onboarding_project;
begin
  select * into p from app.onboarding_project where user_id = p_user;
  if p.id is null then
    raise exception 'onboarding_not_found' using errcode = 'PT404';
  end if;
  return jsonb_build_object(
    'onboarding_id', p.id, 'status', p.status, 'status_phase', p.status_phase, 'team_id', p.team_id,
    'error_code', p.error_code, 'plan_id', p.selected_billing_plan_id, 'billing_interval', p.billing_interval,
    'session_matches', (p.stripe_checkout_session_id = p_session_id));
end
$function$;

-- 5.6 Testphase festhalten; end_trial = true, wenn Karte, Nutzer oder Domain schon eine hatten
create or replace function app._onb_trial_register_v1(
  p_onboarding uuid, p_subscription text, p_fingerprint text, p_trial_days int)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  p app.onboarding_project;
  v_dup boolean;
begin
  if coalesce(p_trial_days, 0) <= 0 or p_subscription is null then
    return jsonb_build_object('registered', false, 'end_trial', false);
  end if;
  if exists (select 1 from app.onboarding_trial_claim where stripe_subscription_id = p_subscription) then
    return jsonb_build_object('registered', false, 'end_trial',
      (select ended_early from app.onboarding_trial_claim where stripe_subscription_id = p_subscription));
  end if;
  select * into p from app.onboarding_project where id = p_onboarding;
  v_dup := exists (select 1 from app.onboarding_trial_claim c
                   where c.user_id = p.user_id
                      or (p.website_domain is not null and c.website_domain = p.website_domain)
                      or (p_fingerprint is not null and c.card_fingerprint = p_fingerprint));
  insert into app.onboarding_trial_claim (user_id, onboarding_id, website_domain, card_fingerprint,
                                          stripe_subscription_id, trial_days, ended_early)
  values (p.user_id, p.id, p.website_domain, p_fingerprint, p_subscription, p_trial_days, v_dup);
  return jsonb_build_object('registered', true, 'end_trial', v_dup);
end
$function$;

-- 5.7 Finalize gescheitert: nur ein Code, nie der Rohtext
create or replace function app._onb_finalize_failed_v1(p_onboarding uuid, p_code text)
returns void
language sql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
  update app.onboarding_project
     set error_code = case when p_code in ('finalize_state', 'finalize_failed') then p_code else 'finalize_failed' end,
         last_error = case when p_code in ('finalize_state', 'finalize_failed') then p_code else 'finalize_failed' end,
         updated_at = now()
   where id = p_onboarding and status <> 'completed';
$function$;

-- =============================================================================
-- 6  n8n-RPCs (nur service_role, Token Pflicht, erlaubte Übergänge)
-- =============================================================================

-- 6.1 Kontext für einen Lauf
create or replace function app.onboarding_run_context_v1(p_onboarding uuid, p_run_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  p app.onboarding_project;
begin
  select * into p from app.onboarding_project where id = p_onboarding;
  if p.id is null or p_run_token is null or p.run_token is distinct from p_run_token then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;
  if p.status in ('submitted', 'processing') and p.status_phase between 1 and 4 then
    return jsonb_build_object('ok', true, 'kind', 'analysis', 'onboarding_id', p.id,
      'company_name', p.company_name, 'website_url', p.website_url, 'website_domain', p.website_domain,
      'business_model', p.business_model, 'market', p.market, 'market_focus', p.market_focus,
      'timezone', p.timezone, 'status_phase', p.status_phase);
  end if;
  if p.status = 'processing' and p.status_phase = 6 then
    return jsonb_build_object('ok', true, 'kind', 'prompts', 'onboarding_id', p.id,
      'company_name', p.company_name, 'website_domain', p.website_domain,
      'business_model', p.business_model, 'market', p.market, 'industry', p.brand_industry,
      'summary', p.summary, 'status_phase', p.status_phase,
      'topics', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)
                                           order by t.is_own, t.sort_order, t.name)
                          from app.onboarding_candidate_topic t
                          where t.onboarding_id = p.id and t.selected), '[]'::jsonb));
  end if;
  return jsonb_build_object('ok', false, 'reason', 'wrong_state', 'status', p.status, 'status_phase', p.status_phase);
end
$function$;

-- 6.2 Phase melden oder Fehler (nur Code)
create or replace function app.onboarding_run_update_v1(
  p_onboarding uuid, p_run_token uuid, p_phase int default null, p_error_code text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  p app.onboarding_project;
  v_code text;
  v_back int;
begin
  select * into p from app.onboarding_project where id = p_onboarding for update;
  if p.id is null or p_run_token is null or p.run_token is distinct from p_run_token then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;

  if p_error_code is not null then
    if p.status in ('submitted', 'processing') and p.status_phase between 1 and 4 then
      v_code := case when p_error_code in ('website_unreachable', 'website_blocked', 'website_empty',
                                           'website_invalid', 'analysis_failed', 'timeout', 'start_failed')
                     then p_error_code else 'analysis_failed' end;
      update app.onboarding_project set status = 'failed', error_code = v_code, last_error = v_code,
             updated_at = now() where id = p.id;
      return jsonb_build_object('ok', true, 'status', 'failed', 'status_phase', p.status_phase, 'error_code', v_code);
    elsif p.status = 'processing' and p.status_phase = 6 then
      v_code := case when p_error_code in ('prompts_failed', 'timeout', 'start_failed') then p_error_code
                     else 'prompts_failed' end;
      v_back := case when exists (select 1 from app.onboarding_suggested_prompt s where s.onboarding_id = p.id
                                  and not s.is_own and s.onboarding_candidate_topic_id is not null) then 7 else 5 end;
      update app.onboarding_project set status = 'ready', status_phase = v_back,
             status_label = app._onb_phase_label_v1(v_back), progress_percent = app._onb_phase_pct_v1(v_back),
             error_code = v_code, last_error = v_code, updated_at = now() where id = p.id;
      return jsonb_build_object('ok', true, 'status', 'ready', 'status_phase', v_back, 'error_code', v_code);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'wrong_state');
  end if;

  if p_phase is null or p_phase not in (2, 3, 4) then
    return jsonb_build_object('ok', false, 'reason', 'phase');
  end if;
  if p.status not in ('submitted', 'processing') or p.status_phase not between 1 and 4 then
    return jsonb_build_object('ok', false, 'reason', 'wrong_state');
  end if;
  if p_phase > p.status_phase then
    update app.onboarding_project set status = 'processing', status_phase = p_phase,
           status_label = app._onb_phase_label_v1(p_phase), progress_percent = app._onb_phase_pct_v1(p_phase),
           updated_at = now() where id = p.id;
  else
    update app.onboarding_project set updated_at = now() where id = p.id;
  end if;
  return jsonb_build_object('ok', true, 'status', 'processing', 'status_phase', greatest(p_phase, p.status_phase));
end
$function$;

-- 6.3 Analyse fertig: Wettbewerber, Themen, Zusammenfassung, Branche in EINEM Schritt; Phase 5
create or replace function app.onboarding_run_finish_analysis_v1(
  p_onboarding uuid, p_run_token uuid, p_competitors jsonb, p_topics jsonb, p_summary text, p_industry text)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  p app.onboarding_project;
  e jsonb;
  v_name text; v_host text;
  v_hosts text[] := '{}';
  v_tnames text[] := '{}';
  v_comp int := 0;
  v_colors text[];
  i int;
begin
  select * into p from app.onboarding_project where id = p_onboarding for update;
  if p.id is null or p_run_token is null or p.run_token is distinct from p_run_token then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;
  if p.status not in ('submitted', 'processing') or p.status_phase not between 1 and 4 then
    return jsonb_build_object('ok', false, 'reason', 'wrong_state');
  end if;

  delete from app.onboarding_suggested_prompt     where onboarding_id = p.id;
  delete from app.onboarding_candidate_topic      where onboarding_id = p.id;
  delete from app.onboarding_candidate_competitor where onboarding_id = p.id;

  -- Wettbewerber: Name säubern (max. 60), Domain prüfen, eigene Domain und Dubletten raus, max. 10
  if jsonb_typeof(p_competitors) = 'array' then
    for e in select x from jsonb_array_elements(p_competitors) x loop
      exit when v_comp >= 10;
      v_name := app._onb_soft_v1(case when jsonb_typeof(e) = 'object' then e ->> 'name' end, 60);
      v_host := app._onb_host_try_v1(case when jsonb_typeof(e) = 'object'
                                          then coalesce(e ->> 'domain', e ->> 'url') end);
      continue when v_name is null or v_host is null;
      continue when v_host = p.website_domain or v_host = any(v_hosts);
      v_hosts := v_hosts || v_host;
      insert into app.onboarding_candidate_competitor (onboarding_id, name, domain, url, favicon_url, selected)
      values (p.id, v_name, v_host, 'https://' || v_host || '/',
              'https://www.google.com/s2/favicons?domain=' || v_host || '&sz=64', false);
      v_comp := v_comp + 1;
    end loop;
  end if;

  -- Themen: max. 8, je max. 40 Zeichen, ohne Dubletten; Farben aus der Palette
  if jsonb_typeof(p_topics) = 'array' then
    for e in select x from jsonb_array_elements(p_topics) x loop
      exit when cardinality(v_tnames) >= 8;
      v_name := app._onb_soft_v1(case when jsonb_typeof(e) = 'string' then e #>> '{}'
                                      when jsonb_typeof(e) = 'object' then e ->> 'name' end, 40);
      v_name := regexp_replace(coalesce(v_name, ''), '[.,;:]+$', '');
      continue when v_name = '' or lower(v_name) = any(select lower(x) from unnest(v_tnames) x);
      v_tnames := v_tnames || v_name;
    end loop;
  end if;
  if cardinality(v_tnames) = 0 then
    update app.onboarding_project set status = 'failed', error_code = 'analysis_failed', last_error = 'analysis_failed',
           updated_at = now() where id = p.id;
    return jsonb_build_object('ok', false, 'reason', 'no_topics', 'status', 'failed', 'error_code', 'analysis_failed');
  end if;
  v_colors := app._onb_topic_colors_v1(cardinality(v_tnames));
  for i in 1 .. cardinality(v_tnames) loop
    insert into app.onboarding_candidate_topic (onboarding_id, name, hex_light, hex_dark, sort_order, selected, is_own)
    values (p.id, v_tnames[i], v_colors[i], v_colors[i], (i - 1)::smallint, false, false);
  end loop;

  update app.onboarding_project set
    summary = app._onb_soft_v1(p_summary, 800, true),
    brand_industry = app._onb_soft_v1(p_industry, 30),
    status = 'ready', status_phase = 5, status_label = app._onb_phase_label_v1(5),
    progress_percent = app._onb_phase_pct_v1(5), error_code = null, last_error = null, updated_at = now()
  where id = p.id;

  return jsonb_build_object('ok', true, 'status', 'ready', 'status_phase', 5,
                            'competitors', v_comp, 'topics', cardinality(v_tnames));
end
$function$;

-- 6.4 Prompts fertig: generierte Prompts ersetzen (eigene bleiben), Phase 7
create or replace function app.onboarding_run_finish_prompts_v1(p_onboarding uuid, p_run_token uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  p app.onboarding_project;
  e jsonb;
  v_text text;
  v_topics uuid[];
  v_vol smallint;
  v_id uuid;
  v_ins int := 0;
  v_skip int := 0;
  v_back int;
  i int;
begin
  select * into p from app.onboarding_project where id = p_onboarding for update;
  if p.id is null or p_run_token is null or p.run_token is distinct from p_run_token then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;
  if p.status <> 'processing' or p.status_phase <> 6 then
    return jsonb_build_object('ok', false, 'reason', 'wrong_state');
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    p_rows := '[]'::jsonb;
  end if;

  delete from app.onboarding_suggested_prompt s
  where s.onboarding_id = p.id and not s.is_own and s.onboarding_candidate_topic_id is not null;

  for e in select x from jsonb_array_elements(p_rows) x loop
    exit when v_ins >= 15;
    v_text := app._onb_soft_v1(case when jsonb_typeof(e) = 'object' then coalesce(e ->> 'prompt_text', e ->> 'text') end, 300);
    if v_text is null or char_length(v_text) < 3 then v_skip := v_skip + 1; continue; end if;
    select coalesce(array_agg(t.id order by x.ord), '{}') into v_topics
    from jsonb_array_elements_text(case when jsonb_typeof(e -> 'topic_ids') = 'array' then e -> 'topic_ids' else '[]' end)
         with ordinality x(val, ord)
    join app.onboarding_candidate_topic t on t.onboarding_id = p.id and t.selected
     and t.id::text = x.val;
    if cardinality(v_topics) = 0 then v_skip := v_skip + 1; continue; end if;
    v_topics := v_topics[1:3];
    v_vol := case when (e ->> 'estimated_volume') ~ '^\d+(\.\d+)?$'
                  then greatest(0, least(100, round((e ->> 'estimated_volume')::numeric)))::smallint end;
    begin
      insert into app.onboarding_suggested_prompt (onboarding_id, prompt_text, market, onboarding_candidate_topic_id,
                                                   estimated_volume, sort_order, selected, is_own)
      values (p.id, v_text, p.market, v_topics[1], v_vol, v_ins::smallint, false, false)
      returning id into v_id;
    exception when unique_violation then
      v_skip := v_skip + 1; continue;
    end;
    for i in 1 .. cardinality(v_topics) loop
      insert into app.onboarding_suggested_prompt_topic (suggested_prompt_id, candidate_topic_id, is_primary)
      values (v_id, v_topics[i], i = 1) on conflict do nothing;
    end loop;
    v_ins := v_ins + 1;
  end loop;

  if v_ins = 0 then
    v_back := 5;
    update app.onboarding_project set status = 'ready', status_phase = v_back,
           status_label = app._onb_phase_label_v1(v_back), progress_percent = app._onb_phase_pct_v1(v_back),
           error_code = 'prompts_failed', last_error = 'prompts_failed', updated_at = now() where id = p.id;
    return jsonb_build_object('ok', false, 'reason', 'no_prompts', 'status', 'ready', 'status_phase', v_back,
                              'error_code', 'prompts_failed', 'skipped', v_skip);
  end if;

  update app.onboarding_project set status = 'ready', status_phase = 7,
         status_label = app._onb_phase_label_v1(7), progress_percent = app._onb_phase_pct_v1(7),
         error_code = null, last_error = null, prompt_selection_key = app._onb_selection_key_v1(p.id),
         updated_at = now()
  where id = p.id;
  return jsonb_build_object('ok', true, 'status', 'ready', 'status_phase', 7, 'inserted', v_ins, 'skipped', v_skip);
end
$function$;

-- =============================================================================
-- 7  Aufräumer: hängende Läufe nach 10 Minuten ohne Änderung
-- =============================================================================
create or replace function app._onb_reaper_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_a int; v_p int;
begin
  -- großer Lauf (Phase 1-4): failed/timeout; der nächste Start zählt nicht als Neustart
  with a as (
    update app.onboarding_project op
       set status = 'failed', error_code = 'timeout', last_error = 'timeout', updated_at = now()
     where op.id in (select x.id from app.onboarding_project x
                     where x.status in ('submitted', 'processing') and x.status_phase between 1 and 4
                       and x.updated_at < now() - interval '10 minutes'
                     for update skip locked)
    returning 1)
  select count(*) into v_a from a;

  -- Promptlauf (Phase 6): zurück auf die Auswahl, Fehlercode timeout
  with b as (
    update app.onboarding_project op
       set status = 'ready',
           status_phase = case when exists (select 1 from app.onboarding_suggested_prompt s
                                            where s.onboarding_id = op.id and not s.is_own
                                              and s.onboarding_candidate_topic_id is not null) then 7 else 5 end,
           progress_percent = 100,
           status_label = case when exists (select 1 from app.onboarding_suggested_prompt s
                                            where s.onboarding_id = op.id and not s.is_own
                                              and s.onboarding_candidate_topic_id is not null)
                               then 'Prompts ready' else 'Done' end,
           error_code = 'timeout', last_error = 'timeout', updated_at = now()
     where op.id in (select x.id from app.onboarding_project x
                     where x.status = 'processing' and x.status_phase = 6
                       and x.updated_at < now() - interval '10 minutes'
                     for update skip locked)
    returning 1)
  select count(*) into v_p from b;

  return jsonb_build_object('analysis', v_a, 'prompts', v_p);
end
$function$;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'onboarding-reaper') then
    perform cron.unschedule('onboarding-reaper');
  end if;
  perform cron.schedule('onboarding-reaper', '* * * * *', 'select app._onb_reaper_v1()');
end $$;

-- =============================================================================
-- 8  Rechte
-- =============================================================================
do $$
declare f text;
begin
  -- interne Helfer: niemand außer Eigentümer (und service_role, wo nötig)
  foreach f in array array[
    'app._onb_text_v1(text,integer,text)', 'app._onb_soft_v1(text,integer,boolean)', 'app._onb_host_v1(text)',
    'app._onb_host_try_v1(text)', 'app._onb_bm_v1(text)', 'app._onb_bm_code_v1(text)',
    'app._onb_phase_label_v1(integer)', 'app._onb_phase_pct_v1(integer)',
    'app._onb_topic_colors_v1(integer,text[])', 'app._onb_rl_v1(uuid,text,integer)',
    'app._onb_trial_eligible_v1(uuid,text)', 'app._onb_restart_v1(uuid)', 'app._onb_selection_key_v1(uuid)',
    'app._onb_row_v1(uuid,uuid,boolean)', 'app._onb_uid_v1()', 'app._onb_reaper_v1()'] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;

  -- Nutzer
  foreach f in array array[
    'app.onboarding_bundle_v1()', 'app.onboarding_status_v1(uuid)', 'app.onboarding_select_v1(uuid,text,uuid[])',
    'app.onboarding_prompt_add_v1(uuid,text,boolean)', 'app.onboarding_prompt_remove_v1(uuid,uuid)',
    'app.onboarding_plans_v1()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  -- Edge Functions und n8n
  foreach f in array array[
    'app._onb_start_v1(uuid,text,text,text,text,text,boolean)',
    'app._onb_prompts_start_v1(uuid,uuid,text[],boolean)',
    'app._onb_checkout_prepare_v1(uuid,uuid,uuid,text)',
    'app._onb_checkout_set_v1(uuid,uuid,uuid,text,text,text,integer)',
    'app._onb_checkout_lookup_v1(uuid,text)',
    'app._onb_trial_register_v1(uuid,text,text,integer)',
    'app._onb_finalize_failed_v1(uuid,text)',
    'app.onboarding_run_context_v1(uuid,uuid)', 'app.onboarding_run_update_v1(uuid,uuid,integer,text)',
    'app.onboarding_run_finish_analysis_v1(uuid,uuid,jsonb,jsonb,text,text)',
    'app.onboarding_run_finish_prompts_v1(uuid,uuid,jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;

  -- Der Prompt-Trigger (3.1) läuft als Aufrufer und braucht die reine Textprüfung
  grant execute on function app._onb_text_v1(text,integer,text) to authenticated;
end $$;

commit;

-- =============================================================================
-- Testabfrage (nach dem Einspielen): alles true, Zahlen wie angegeben
-- =============================================================================
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and (p.proname like '\_onb\_%' or p.proname like 'onboarding\_%\_v1')
      and p.proname not in ('onboarding_start_v1', 'onboarding_set_candidate_selected_v1',
        'onboarding_set_topic_selected_v1', 'onboarding_set_prompt_selected_v1', 'onboarding_insert_prompts_v1',
        'onboarding_prompts_claim_v1', 'onboarding_get_prompt_context_v1', 'onboarding_finalize_after_billing_v1')) as neue_funktionen_34,
  has_function_privilege('authenticated', 'app.onboarding_bundle_v1()', 'execute') as bundle_authed,
  not has_function_privilege('anon', 'app.onboarding_bundle_v1()', 'execute') as bundle_kein_anon,
  not has_function_privilege('authenticated', 'app._onb_start_v1(uuid,text,text,text,text,text,boolean)', 'execute') as start_nur_service,
  (select count(*) = 1 from cron.job where jobname = 'onboarding-reaper') as reaper_da,
  (select count(*) = 1 from pg_trigger where tgname = 'trg_onb_prompt_guard') as guard_da,
  not has_function_privilege('anon', 'app.get_my_teams_v4()', 'execute') as teams_kein_anon,
  md5(pg_get_functiondef('app.onboarding_submit(uuid)'::regprocedure)) as submit_md5;
