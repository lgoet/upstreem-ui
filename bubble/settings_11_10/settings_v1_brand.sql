-- settings_v1_brand.sql  (11.10.2026)
-- Settings v1, Schritt 2: Your Brand und Modelle speichern (Vertrag: SETTINGS_V1_VORSCHLAG.md 6.2, 10.2, Abschnitt 12).
-- Als EIN Block ausfuehren. Braucht settings_v1_lesen.sql. Rueckweg: settings_v1_brand_rueckweg.sql
--
-- Neu:
--   settings_brand_save_v1(p_team, p_market_id, p_business_model, p_industry, p_summary, p_name)
--       null = unveraendert, '' = leeren (Name: zurueck auf den Markennamen); Markt Pflichtcode aus app.markets
--   settings_brand_logo_v1(p_team, p_logo_url)   nur https://, hoechstens 500 Zeichen; null/'' = zurueck aufs Markenlogo
--   team_models_set_v1(p_team, p_model_keys)      Zielmenge, Plan und Limit geprueft
--   _set_require_write_v1 (intern): owner/admin, Team mit Zugang (sonst PT402 team_access_<state>), 20 Schreibaufrufe/min
-- Alle schreiben ins Protokoll (brand_settings_changed, brand_logo_changed, models_changed), leeren bei Name/Logo
-- die Seiten-Caches und geben den neuen Stand zurueck (Form wie settings_brand_v1 bzw. Modellzeilen).
-- Bubble-Funktionen (set_own_brand_settings_v5, update_team_model_setting_v1, manage_team_models_v1) bleiben.
-- Im Rollback geprueft 11.10. (settings_v1_brand_echte_antworten.json).
set statement_timeout = '60s';
begin;
-- =====================================================================================
-- 0) Bestand pruefen
-- =====================================================================================
do $g$
begin
  if to_regprocedure('app.settings_brand_v1(uuid)') is null then
    raise exception 'settings_v1_brand: settings_v1_lesen.sql fehlt. Nichts geaendert.';
  end if;
  if to_regprocedure('app.settings_brand_save_v1(uuid,text,text,text,text,text)') is not null then
    raise exception 'settings_v1_brand: settings_brand_save_v1 gibt es schon. Nichts geaendert.';
  end if;
end $g$;

-- =====================================================================================
-- 1) Helfer: Schreibrecht (owner/admin, Team mit Zugang), Team gesperrt
-- =====================================================================================
create function app._set_require_write_v1(p_team uuid, p_area text default 'settings')
 returns text language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_role  text;
  v_has   boolean;
  v_state text;
begin
  v_role := app._set_require_v1(p_team);
  if v_role not in ('owner', 'admin') then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner,admin';
  end if;
  perform app._pi_rate_limit_v1(p_area || '_write', 20, p_area);
  perform 1 from app.team t where t.id = p_team for update;
  select a.has_access, a.access_state into v_has, v_state from app.team_access(p_team) a;
  if not coalesce(v_has, false) then
    raise exception 'team_access_%', coalesce(v_state, 'no_plan') using errcode = 'PT402', hint = coalesce(v_state, 'no_plan');
  end if;
  return v_role;
end;
$f$;

-- =====================================================================================
-- 2) Your Brand speichern
--    null = Feld unveraendert; '' = leeren (Name: zurueck auf den Markennamen).
--    Markt kann nicht geleert werden.
-- =====================================================================================
create function app.settings_brand_save_v1(
  p_team uuid,
  p_market_id text default null,
  p_business_model text default null,
  p_industry text default null,
  p_summary text default null,
  p_name text default null)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user    uuid := auth.uid();
  t         app.team%rowtype;
  v_company uuid;
  v_oldname text;
  v_market  text;
  v_bm      text;
  v_ind     text;
  v_sum     text;
  v_name    text;
  v_changed jsonb := '{}'::jsonb;
  v_brand   jsonb;
begin
  perform app._set_require_write_v1(p_team, 'settings');
  select * into t from app.team x where x.id = p_team;

  -- Werte pruefen
  if p_market_id is not null then
    v_market := upper(btrim(p_market_id));
    if not exists (select 1 from app.markets m where m.alpha2 = v_market) then
      raise exception 'settings_invalid_market' using errcode = '22023', hint = 'p_market_id';
    end if;
  end if;
  if p_business_model is not null then
    v_bm := case lower(btrim(p_business_model))
              when '' then ''
              when 'b2b' then 'B2B'
              when 'b2c' then 'B2C'
              when 'hybrid' then 'hybrid'
              else null end;
    if v_bm is null then
      raise exception 'settings_invalid_business_model' using errcode = '22023', hint = 'b2b,b2c,hybrid';
    end if;
  end if;
  if p_industry is not null then
    v_ind := coalesce(app._set_clean_v1(p_industry, 10000), '');
    if length(v_ind) > 80 then
      raise exception 'settings_too_long' using errcode = '22023', hint = 'industry:80';
    end if;
  end if;
  if p_summary is not null then
    v_sum := coalesce(btrim(regexp_replace(replace(replace(replace(p_summary, chr(96), ''), chr(92), ''), '${', '$ {'),
                                            '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', ' ', 'g')), '');
    if length(v_sum) > 1000 then
      raise exception 'settings_too_long' using errcode = '22023', hint = 'summary:1000';
    end if;
  end if;
  if p_name is not null then
    v_name := coalesce(app._set_clean_v1(p_name, 10000), '');
    if length(v_name) > 80 then
      raise exception 'settings_too_long' using errcode = '22023', hint = 'name:80';
    end if;
  end if;

  -- Team-Felder
  if v_market is not null and v_market is distinct from upper(coalesce(t.default_market, '')) then
    update app.team x set default_market = v_market where x.id = p_team;
    v_changed := v_changed || jsonb_build_object('market', jsonb_build_object('from', t.default_market, 'to', v_market));
  end if;
  if v_bm is not null and nullif(v_bm, '') is distinct from t.business_model then
    update app.team x set business_model = nullif(v_bm, '') where x.id = p_team;
    v_changed := v_changed || jsonb_build_object('business_model', jsonb_build_object('from', t.business_model, 'to', nullif(v_bm, '')));
  end if;
  if v_ind is not null and nullif(v_ind, '') is distinct from t.brand_industry then
    update app.team x set brand_industry = nullif(v_ind, '') where x.id = p_team;
    v_changed := v_changed || jsonb_build_object('industry', jsonb_build_object('from', t.brand_industry, 'to', nullif(v_ind, '')));
  end if;
  if v_sum is not null and nullif(v_sum, '') is distinct from t.summary then
    update app.team x set summary = nullif(v_sum, '') where x.id = p_team;
    v_changed := v_changed || jsonb_build_object('summary', jsonb_build_object('from_length', length(t.summary), 'to_length', length(nullif(v_sum, ''))));
  end if;

  -- Name der eigenen Marke (Override; '' = zurueck auf den Markennamen)
  if v_name is not null then
    select tc.company_id into v_company from app.team_company tc where tc.team_id = p_team and tc.role = 'own' limit 1;
    if v_company is null then
      raise exception 'settings_no_own_brand' using errcode = 'PT404';
    end if;
    select tbp.name_override into v_oldname from app.team_brand_profile tbp where tbp.team_id = p_team and tbp.company_id = v_company;
    if nullif(v_name, '') is distinct from nullif(btrim(v_oldname), '') then
      insert into app.team_brand_profile as tbp (team_id, company_id, name_override)
      values (p_team, v_company, nullif(v_name, ''))
      on conflict (team_id, company_id) do update set name_override = excluded.name_override;
      v_changed := v_changed || jsonb_build_object('name', jsonb_build_object('from', v_oldname, 'to', nullif(v_name, '')));
      perform app._br_clear_caches_v1(p_team);
    end if;
  end if;

  if v_changed <> '{}'::jsonb then
    insert into app.team_audit_log (team_id, actor_user_id, event_type, meta)
    values (p_team, v_user, 'brand_settings_changed', jsonb_build_object('changed', v_changed));
  end if;

  v_brand := app.settings_brand_v1(p_team);
  return jsonb_build_object(
    'meta', (v_brand->'meta') || jsonb_build_object('changed', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(v_changed) k),
                                                    'unchanged', v_changed = '{}'::jsonb),
    'row', v_brand->'row');
end;
$f$;

-- =====================================================================================
-- 3) Logo der eigenen Marke (null oder '' = Override entfernen, zurueck auf das Markenlogo)
-- =====================================================================================
create function app.settings_brand_logo_v1(p_team uuid, p_logo_url text default null)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user    uuid := auth.uid();
  v_company uuid;
  v_old     text;
  v_url     text := nullif(btrim(coalesce(p_logo_url, '')), '');
  v_brand   jsonb;
  v_changed boolean := false;
begin
  perform app._set_require_write_v1(p_team, 'settings');
  if v_url is not null then
    if length(v_url) > 500 then
      raise exception 'settings_too_long' using errcode = '22023', hint = 'logo:500';
    end if;
    if v_url !~ '^https://[^[:space:]<>"''`\\]+$' then
      raise exception 'settings_invalid_logo_url' using errcode = '22023', hint = 'https://';
    end if;
  end if;
  select tc.company_id into v_company from app.team_company tc where tc.team_id = p_team and tc.role = 'own' limit 1;
  if v_company is null then
    raise exception 'settings_no_own_brand' using errcode = 'PT404';
  end if;
  select tbp.logo_override_url into v_old from app.team_brand_profile tbp where tbp.team_id = p_team and tbp.company_id = v_company;

  if v_url is distinct from nullif(btrim(v_old), '') then
    insert into app.team_brand_profile as tbp (team_id, company_id, logo_override_url)
    values (p_team, v_company, v_url)
    on conflict (team_id, company_id) do update set logo_override_url = excluded.logo_override_url;
    insert into app.team_audit_log (team_id, actor_user_id, event_type, meta)
    values (p_team, v_user, 'brand_logo_changed', jsonb_build_object('from', v_old, 'to', v_url));
    perform app._br_clear_caches_v1(p_team);
    v_changed := true;
  end if;

  v_brand := app.settings_brand_v1(p_team);
  return jsonb_build_object('meta', (v_brand->'meta') || jsonb_build_object('unchanged', not v_changed), 'row', v_brand->'row');
end;
$f$;

-- =====================================================================================
-- 4) Modelle setzen (Zielmenge)
-- =====================================================================================
create function app.team_models_set_v1(p_team uuid, p_model_keys text[])
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user  uuid := auth.uid();
  v_plan  uuid;
  v_max   int;
  v_keys  text[];
  v_bad   text[];
  v_on    text[];
  v_off   text[];
begin
  perform app._set_require_write_v1(p_team, 'team');
  perform pg_advisory_xact_lock(hashtextextended(p_team::text, 42));

  select coalesce(array_agg(distinct k order by k), '{}') into v_keys
  from (select lower(btrim(x)) as k from unnest(coalesce(p_model_keys, '{}'::text[])) x) q
  where k <> '';
  if cardinality(v_keys) = 0 then
    raise exception 'team_models_min_one' using errcode = '22023';
  end if;

  select t.billing_plan_id, coalesce(bp.models_max_active, 0) into v_plan, v_max
  from app.team t left join app.billing_plan bp on bp.id = t.billing_plan_id where t.id = p_team;

  select coalesce(array_agg(k order by k), '{}') into v_bad
  from unnest(v_keys) k
  where not exists (select 1 from app.llm_model_catalog mc where mc.key = k and mc.is_active)
     or not exists (select 1 from app.billing_plan_model bpm where bpm.billing_plan_id = v_plan and bpm.model_key = k and bpm.enabled);
  if cardinality(v_bad) > 0 then
    raise exception 'team_models_invalid' using errcode = '22023', hint = array_to_string(v_bad, ',');
  end if;
  if cardinality(v_keys) > v_max then
    raise exception 'team_models_limit' using errcode = '22023', hint = v_max::text;
  end if;

  with up as (
    insert into app.team_model_setting as s (team_id, model_key, enabled, created_at, updated_at)
    select p_team, k, true, now(), now() from unnest(v_keys) k
    on conflict (team_id, model_key) do update set enabled = true, updated_at = now()
      where s.enabled is distinct from true
    returning s.model_key
  )
  select coalesce(array_agg(model_key order by model_key), '{}') into v_on from up;

  with dn as (
    update app.team_model_setting s set enabled = false, updated_at = now()
    where s.team_id = p_team and s.enabled and s.model_key <> all (v_keys)
    returning s.model_key
  )
  select coalesce(array_agg(model_key order by model_key), '{}') into v_off from dn;

  if cardinality(v_on) + cardinality(v_off) > 0 then
    insert into app.team_audit_log (team_id, actor_user_id, event_type, meta)
    values (p_team, v_user, 'models_changed', jsonb_build_object('on', to_jsonb(v_on), 'off', to_jsonb(v_off), 'now', to_jsonb(v_keys)));
  end if;

  return app.js_safe(jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team,
                               'changed', jsonb_build_object('on', to_jsonb(v_on), 'off', to_jsonb(v_off)),
                               'unchanged', cardinality(v_on) + cardinality(v_off) = 0,
                               'models_max', v_max),
    'rows', app._set_models_v1(p_team, true)));
end;
$f$;

-- =====================================================================================
-- 5) Rechte
-- =====================================================================================
revoke all on function
  app._set_require_write_v1(uuid, text),
  app.settings_brand_save_v1(uuid, text, text, text, text, text),
  app.settings_brand_logo_v1(uuid, text),
  app.team_models_set_v1(uuid, text[])
from public, anon, authenticated;
grant execute on function
  app.settings_brand_save_v1(uuid, text, text, text, text, text),
  app.settings_brand_logo_v1(uuid, text),
  app.team_models_set_v1(uuid, text[])
to authenticated, service_role;

commit;

select p.oid::regprocedure::text as funktion, has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.proname in ('settings_brand_save_v1', 'settings_brand_logo_v1', 'team_models_set_v1')
order by 1;
