-- brand_detail_v1.sql (12.10.2026): Brand-Drawer. Als EIN Block ausfuehren.
-- Rueckweg: brand_detail_v1_rueckweg.sql
-- Neu: brand_detail_v1 (Kopf). p_brand (letzter Parameter, optional) in cached_dashboard_responses_v1,
-- export_responses_v1, cached_citations_overview_v1, _domains_v1, _urls_v1, export_citations_domains_v1, _urls_v1.
-- Ohne p_brand rechnet alles wie bisher. Citations mit p_brand: Zitate aus Antworten, die die Marke nennen
-- (Marken-Kopien der Citations-Rechnung: _citations_fb_*/_gb_*, Temp-Tabellen aus _citations_brand_build_v1).

begin;

do $g$
begin
  if md5(pg_get_functiondef('app._dash_responses_base_v1(uuid,uuid[],text[],text[],integer,integer,text,text,uuid,date,date,text,text,uuid,text,uuid[],smallint,smallint,integer,integer,text,text,uuid,uuid)'::regprocedure)) <> '983a0fe2be95f8669a30f5f6c0b490a7'
     or md5(pg_get_functiondef('app._dash_responses_calc_v1(jsonb)'::regprocedure)) <> '572a524936cc4cc6d6e5168efe714485'
     or md5(pg_get_functiondef('app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid)'::regprocedure)) <> 'e299ceda9b15403979c9b626c99276e2'
     or md5(pg_get_functiondef('app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text,uuid)'::regprocedure)) <> '79b9175074e32a13a09be2c3df26bd49'
     or md5(pg_get_functiondef('app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,uuid)'::regprocedure)) <> '9c09ddbeec09ee943ca9bedf58b6c128'
     or md5(pg_get_functiondef('app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid)'::regprocedure)) <> '3d093902bcdec1fbfd98430a705d347e'
     or md5(pg_get_functiondef('app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid)'::regprocedure)) <> '25fa6c45f47332c088cae9d26b8cfa87'
     or md5(pg_get_functiondef('app.export_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer)'::regprocedure)) <> '9842ca1e668518eadde8c7b9c359a87e'
     or md5(pg_get_functiondef('app.export_citations_urls_v1(uuid,text,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer)'::regprocedure)) <> '1087ab5a8d87ae5f2b9652c4ca05d27e'
     or md5(pg_get_functiondef('app._citations_f_scope_v1(jsonb,jsonb)'::regprocedure)) <> '8e51f8d2843e360c859f3361e87074bd'
     or md5(pg_get_functiondef('app._citations_f_overview_calc_v1(jsonb)'::regprocedure)) <> 'fcc4905aad306e66145793986596b6ab'
     or md5(pg_get_functiondef('app._citations_g_domains_calc_v1(jsonb)'::regprocedure)) <> 'f96779d49fb0960fcbf74f822c6dafed'
     or md5(pg_get_functiondef('app._citations_g_urls_calc_v1(jsonb)'::regprocedure)) <> 'c1594a5117ca632d4e987d9dc5c98ff3'
     or md5(pg_get_functiondef('app._citations_g_n_v1(uuid,uuid[],text[],date[],date[],date[],date,date)'::regprocedure)) <> '1563bdd152393fd9c7dac3d04f18ef25'
     or md5(pg_get_functiondef('app._citations_g_tiles_v1(uuid,date,date)'::regprocedure)) <> '52fb96172e7e4eb90924c38a348f673a' then
    raise exception 'brand_detail_v1: Bestand weicht ab. Nichts geaendert.';
  end if;
  if to_regprocedure('app.brand_detail_v1(uuid,uuid)') is not null then
    raise exception 'brand_detail_v1: schon eingespielt. Nichts geaendert.';
  end if;
end $g$;

set local check_function_bodies = off;  -- _citations_gb_n_v1 liest Temp-Tabellen, die erst beim Aufruf entstehen

CREATE OR REPLACE FUNCTION app._citations_brand_build_v1(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 12.10.2026 (Brand-Drawer): Zitate nur aus Antworten, die die Marke nennen. Baut Temp-Tabellen mit
-- denselben Spalten wie die Citations-Rollups (gleiche Rechnung wie backfill_citation_rollups_v3),
-- nur je Tag. Woche/Monat bleiben leer; die Kachel-Logik faellt dann auf Tage zurueck.
-- Marke, die das Team nicht (mehr) verfolgt, oder fremde Marke -> leere Tabellen.
declare
  v_team  uuid := (p->>'team_id')::uuid;
  v_brand uuid := nullif(p->>'brand', '')::uuid;
  v_from  date := (p->>'date_from')::date;
  v_to    date := (p->>'date_to')::date;
  v_pf    date;
  v_ok    boolean;
begin
  v_pf := v_from - greatest(least((v_to - v_from + 1) / 2, 30), 1);
  v_ok := v_brand is not null
          and exists (select 1 from app.team_company tc where tc.team_id = v_team and tc.company_id = v_brand);

  drop table if exists _cb_runs;
  create temp table _cb_runs on commit drop as
  select pr.id, pr.prompt_id, pr.model, pr.run_day_berlin as day, pr.run_at, pr.run_key, pr.has_user_brand
  from app.prompt_run pr
  where v_ok
    and pr.team_id = v_team
    and pr.prompt_id is not null
    and pr.run_day_berlin between v_pf and v_to
    and nullif(btrim(pr.run_key), '') is not null
    and exists (select 1 from app.recommendation r
                where r.prompt_run_id = pr.id and r.team_id = v_team and r.company_id = v_brand);

  drop table if exists _cb_pairs;
  create temp table _cb_pairs on commit drop as
  select distinct r.day, r.prompt_id, r.model, r.id as run_id, r.run_at, r.has_user_brand, scu.url
  from _cb_runs r
  join app.staged_citation_urls scu on scu.team_id = v_team and scu.run_key = r.run_key;

  -- Domain je Adresse einmal nachschlagen (nicht je Zitat)
  drop table if exists _cb_dom;
  create temp table _cb_dom on commit drop as
  select u.url, regexp_replace(lower(su.domain), '^www\.', '') as domain_norm
  from (select distinct url from _cb_pairs) u
  join app.source_url su on su.url = u.url
  where nullif(btrim(regexp_replace(lower(su.domain), '^www\.', '')), '') is not null;

  drop table if exists _cb_cit;
  create temp table _cb_cit on commit drop as
  select v_team as team_id, p0.day, p0.prompt_id, p0.model, p0.run_id, p0.run_at, p0.has_user_brand, p0.url, d.domain_norm
  from _cb_pairs p0
  join _cb_dom d on d.url = p0.url;

  drop table if exists _cb_daily_citation_run_rollup;
  create temp table _cb_daily_citation_run_rollup on commit drop as
  select c.team_id, c.day, c.prompt_id, c.model,
         count(distinct c.run_id)::int as runs_with_any_citation,
         count(distinct c.run_id) filter (where c.has_user_brand is true)::int as runs_with_any_citation_yes,
         count(distinct c.run_id) filter (where c.has_user_brand is not true)::int as runs_with_any_citation_no,
         now() as updated_at
  from _cb_cit c
  group by c.team_id, c.day, c.prompt_id, c.model;

  drop table if exists _cb_daily_citation_domain_rollup;
  create temp table _cb_daily_citation_domain_rollup on commit drop as
  select c.team_id, c.day, c.prompt_id, c.model, c.domain_norm,
         count(*)::int as used_total, count(distinct c.run_id)::int as runs_with_domain,
         min(c.run_at) as first_used_at, max(c.run_at) as last_used_at, now() as updated_at
  from _cb_cit c
  group by c.team_id, c.day, c.prompt_id, c.model, c.domain_norm;

  drop table if exists _cb_daily_citation_url_rollup;
  create temp table _cb_daily_citation_url_rollup on commit drop as
  select c.team_id, c.day, c.prompt_id, c.model, c.url, c.domain_norm,
         count(*)::int as used_total, count(distinct c.run_id)::int as runs_with_url,
         min(c.run_at) as first_used_at, max(c.run_at) as last_used_at, now() as updated_at
  from _cb_cit c
  group by c.team_id, c.day, c.prompt_id, c.model, c.url, c.domain_norm;
  create index on _cb_daily_citation_url_rollup (url);

  drop table if exists _cb_weekly_citation_run_rollup;
  create temp table _cb_weekly_citation_run_rollup (like app.weekly_citation_run_rollup) on commit drop;
  drop table if exists _cb_weekly_citation_domain_rollup;
  create temp table _cb_weekly_citation_domain_rollup (like app.weekly_citation_domain_rollup) on commit drop;
  drop table if exists _cb_weekly_citation_url_rollup;
  create temp table _cb_weekly_citation_url_rollup (like app.weekly_citation_url_rollup) on commit drop;
  drop table if exists _cb_monthly_citation_run_rollup;
  create temp table _cb_monthly_citation_run_rollup (like app.monthly_citation_run_rollup) on commit drop;
  drop table if exists _cb_monthly_citation_domain_rollup;
  create temp table _cb_monthly_citation_domain_rollup (like app.monthly_citation_domain_rollup) on commit drop;
  drop table if exists _cb_monthly_citation_url_rollup;
  create temp table _cb_monthly_citation_url_rollup (like app.monthly_citation_url_rollup) on commit drop;

  analyze _cb_daily_citation_run_rollup;
  analyze _cb_daily_citation_domain_rollup;
  analyze _cb_daily_citation_url_rollup;
end;
$function$;

CREATE OR REPLACE FUNCTION app.brand_detail_v1(p_team uuid, p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 12.10.2026: Kopf des Brand-Drawers. Kennzahlen kommen aus cached_dashboard_overview_v1 (p_companies).
declare
  v_has    boolean;
  v_state  text;
  v_role   text;
  v_status text;
  v_deact  timestamptz;
  v_c      app.company%rowtype;
  v_nameo  text;
  v_logoo  text;
  v_color  text;
  v_since  timestamptz;
  v_last   timestamptz;
begin
  perform app._set_require_v1(p_team);
  select a.has_access, a.access_state into v_has, v_state from app.team_access(p_team) a;
  if not coalesce(v_has, false) then
    raise exception 'team_access_%', coalesce(v_state, 'no_plan') using errcode = 'PT402', hint = coalesce(v_state, 'no_plan');
  end if;
  perform app._pi_rate_limit_v1('brand_detail', 120, 'brand');
  if p_company is null then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_company';
  end if;

  -- aktiv: im Team; inaktiv: im Archiv des Teams; sonst (fremd, unbekannt) nicht gefunden
  select tc.role::text into v_role from app.team_company tc
  where tc.team_id = p_team and tc.company_id = p_company limit 1;
  if v_role is not null then
    v_status := 'active';
  else
    select a.role, a.deactivated_at into v_role, v_deact from app.team_competitor_archive a
    where a.team_id = p_team and a.company_id = p_company
    order by a.deactivated_at desc nulls last limit 1;
    if found then
      v_status := 'inactive';
      v_role := coalesce(v_role, 'competitor');
    end if;
  end if;
  select * into v_c from app.company c where c.id = p_company;
  if v_status is null or not found then
    raise exception 'brand_not_found' using errcode = 'PT404';
  end if;

  select tbp.name_override, tbp.logo_override_url into v_nameo, v_logoo
  from app.team_brand_profile tbp where tbp.team_id = p_team and tbp.company_id = p_company;
  select tcs.color_override into v_color
  from app.team_company_settings tcs where tcs.team_id = p_team and tcs.company_id = p_company limit 1;

  -- beobachtet seit: Beginn des laufenden (sonst des letzten) Zeitraums
  select tp.started_at into v_since from app.team_company_tracking_period tp
  where tp.team_id = p_team and tp.company_id = p_company
  order by (tp.ended_at is null) desc, tp.started_at desc limit 1;

  -- zuletzt genannt: aus der Tagesstatistik (letzter Tag mit Nennung, dort der spaeteste Lauf)
  select max(s.last_seen_run_at) into v_last
  from app.daily_company_prompt_model_stats s
  where s.team_id = p_team and s.company_id = p_company and s.mention_runs > 0
    and s.day = (select max(s2.day) from app.daily_company_prompt_model_stats s2
                 where s2.team_id = p_team and s2.company_id = p_company and s2.mention_runs > 0);

  return jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'company_id', p_company, 'data_as_of', now()),
    'row', app.js_safe(jsonb_build_object(
      'company_id',        v_c.id,
      'name',              coalesce(nullif(btrim(v_nameo), ''), v_c.name),
      'domain',            app._url_domain_norm(v_c.url),
      'logo_url',          case when v_role = 'own' and nullif(btrim(v_logoo), '') is not null
                                then app._citations_abs_url_v1(v_logoo)
                                else app._citations_abs_url_v1(v_c.favicon_url) end,
      'favicon_url',       app._citations_abs_url_v1(v_c.favicon_url),
      'role',              v_role,
      'status',            v_status,
      'color',             coalesce(nullif(btrim(v_color), ''), v_c.default_color),
      'tracked_since',     v_since,
      'last_mentioned_at', v_last,
      'deactivated_at',    case when v_status = 'inactive' then v_deact end)));
end;
$function$;

CREATE OR REPLACE FUNCTION app._citations_fb_scope_v1(p jsonb, p_need jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_team     uuid   := (p->>'team_id')::uuid;
  v_from     date   := (p->>'date_from')::date;
  v_to       date   := (p->>'date_to')::date;
  v_models   text[] := app._citations_jarr_text_v1(p->'models');
  v_markets  text[] := app._citations_jarr_text_v1(p->'markets');
  v_tags     uuid[] := app._citations_jarr_uuid_v1(p->'tag_ids');
  v_tagmode  text   := coalesce(p->>'tagmode', 'or');
  v_prev_len int;
  v_prompt   uuid   := nullif(p->>'prompt_id', '')::uuid;
  v_cutoff   date   := current_date - 2;
  v_months   date[] := '{}';
  v_weeks    date[] := '{}';
  v_days     date[] := '{}';
  v_missing  date[] := '{}';
  v_n        int;
  v_n_prev   int;
  v_t        timestamptz := clock_timestamp();
  v_need_prev  boolean := coalesce((p_need->>'url_prev')::boolean, false);
  v_need_type  boolean := coalesce((p_need->>'url_type')::boolean, false);
  v_need_title boolean := coalesce((p_need->>'title_all')::boolean, false);
  v_need_own   boolean := coalesce((p_need->>'own')::boolean, true);
begin
  perform set_config('work_mem', '128MB', true);
  perform set_config('jit', 'off', true);

  v_prev_len := greatest(least((v_to - v_from + 1) / 2, 30), 1);

  -- Prompts
  drop table if exists _cs_prompts;
  create temp table _cs_prompts on commit drop as
  select p0.id from app.prompt p0
  where p0.team_id = v_team
    and (v_prompt is null or p0.id = v_prompt)
    and (v_markets is null or p0.market::text = any(v_markets))
    and (v_tags is null
         or (v_tagmode = 'or' and exists (select 1 from app.prompt_tag pt where pt.prompt_id = p0.id and pt.tag_id = any(v_tags)))
         or (v_tagmode = 'and' and (select count(distinct pt.tag_id) from app.prompt_tag pt
                                    where pt.prompt_id = p0.id and pt.tag_id = any(v_tags)) = cardinality(v_tags)));
  create unique index on _cs_prompts (id);
  analyze _cs_prompts;
  v_t := app._citations_f_prof_v1('prompts', v_t);

  -- Kacheln (wie get_citation_domains_v17 / get_citation_urls_v33)
  with dd as (select generate_series(v_from, v_to, interval '1 day')::date as d),
  cls as (select d, date_trunc('month', d)::date as ms,
                 (date_trunc('month', d) + interval '1 month - 1 day')::date as me,
                 date_trunc('week', d)::date as ws, date_trunc('week', d)::date + 6 as we from dd),
  t1 as (select d, ms, ws, (ms >= v_from and me <= v_to and me <= v_cutoff) as is_m,
                (ws >= v_from and we <= v_to and we <= v_cutoff) as is_w_cand from cls),
  t as (select d, ms, ws, is_m, (is_w_cand and not bool_or(is_m) over (partition by ws)) as is_w from t1)
  select coalesce(array_agg(distinct ms) filter (where is_m), '{}'),
         coalesce(array_agg(distinct ws) filter (where is_w), '{}'),
         coalesce(array_agg(d) filter (where not is_m and not is_w), '{}')
    into v_months, v_weeks, v_days
  from t;

  select coalesce(array_agg(m), '{}') into v_missing from unnest(v_months) m
  where exists (select 1 from pg_temp._cb_daily_citation_run_rollup r where r.team_id = v_team and r.day >= m and r.day < (m + interval '1 month')::date)
    and not exists (select 1 from pg_temp._cb_monthly_citation_run_rollup mm where mm.team_id = v_team and mm.month_start = m);
  if cardinality(v_missing) > 0 then
    v_months := (select coalesce(array_agg(m), '{}') from unnest(v_months) m where m <> all(v_missing));
    v_days := v_days || (select coalesce(array_agg(g::date), '{}') from unnest(v_missing) m,
                         generate_series(m, (m + interval '1 month - 1 day')::date, interval '1 day') g);
  end if;
  select coalesce(array_agg(w), '{}') into v_missing from unnest(v_weeks) w
  where exists (select 1 from pg_temp._cb_daily_citation_run_rollup r where r.team_id = v_team and r.day between w and w + 6)
    and not exists (select 1 from pg_temp._cb_weekly_citation_run_rollup ww where ww.team_id = v_team and ww.week_start = w);
  if cardinality(v_missing) > 0 then
    v_weeks := (select coalesce(array_agg(w), '{}') from unnest(v_weeks) w where w <> all(v_missing));
    v_days := v_days || (select coalesce(array_agg(g::date), '{}') from unnest(v_missing) w,
                         generate_series(w, w + 6, interval '1 day') g);
  end if;

  v_t := app._citations_f_prof_v1('kacheln', v_t);

  -- Nenner
  select coalesce(sum(x.c), 0)::int into v_n from (
    select sum(r.runs_with_any_citation) c from pg_temp._cb_daily_citation_run_rollup r join _cs_prompts pf on pf.id = r.prompt_id
    where r.team_id = v_team and r.day = any(v_days) and (v_models is null or r.model = any(v_models))
    union all
    select sum(r.runs_with_any_citation) from pg_temp._cb_weekly_citation_run_rollup r join _cs_prompts pf on pf.id = r.prompt_id
    where r.team_id = v_team and r.week_start = any(v_weeks) and (v_models is null or r.model = any(v_models))
    union all
    select sum(r.runs_with_any_citation) from pg_temp._cb_monthly_citation_run_rollup r join _cs_prompts pf on pf.id = r.prompt_id
    where r.team_id = v_team and r.month_start = any(v_months) and (v_models is null or r.model = any(v_models))) x;

  select coalesce(sum(r.runs_with_any_citation), 0)::int into v_n_prev
  from pg_temp._cb_daily_citation_run_rollup r join _cs_prompts pf on pf.id = r.prompt_id
  where r.team_id = v_team and r.day between v_from - v_prev_len and v_from - 1
    and (v_models is null or r.model = any(v_models));

  v_t := app._citations_f_prof_v1('nenner', v_t);

  drop table if exists _cs_meta;
  create temp table _cs_meta on commit drop as
  select v_team as team_id, v_from as date_from, v_to as date_to,
         v_from - v_prev_len as prev_from, v_from - 1 as prev_to, v_n as n, v_n_prev as n_prev;

  -- Domains
  drop table if exists _cs_dom_now;
  create temp table _cs_dom_now on commit drop as
  select x.domain_norm as domain, sum(x.runs_with_domain)::int as runs_with, sum(x.used_total)::bigint as used_total,
         min(x.first_used_at) as first_used_at, max(x.last_used_at) as last_used_at
  from (
    select d.domain_norm, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at
    from pg_temp._cb_daily_citation_domain_rollup d join _cs_prompts pf on pf.id = d.prompt_id
    where d.team_id = v_team and d.day = any(v_days) and (v_models is null or d.model = any(v_models))
    union all
    select d.domain_norm, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at
    from pg_temp._cb_weekly_citation_domain_rollup d join _cs_prompts pf on pf.id = d.prompt_id
    where d.team_id = v_team and d.week_start = any(v_weeks) and (v_models is null or d.model = any(v_models))
    union all
    select d.domain_norm, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at
    from pg_temp._cb_monthly_citation_domain_rollup d join _cs_prompts pf on pf.id = d.prompt_id
    where d.team_id = v_team and d.month_start = any(v_months) and (v_models is null or d.model = any(v_models))) x
  group by x.domain_norm;
  create unique index on _cs_dom_now (domain);
  analyze _cs_dom_now;
  v_t := app._citations_f_prof_v1('dom_now', v_t);

  drop table if exists _cs_dom_prev;
  create temp table _cs_dom_prev on commit drop as
  select d.domain_norm as domain, sum(d.runs_with_domain)::int as runs_with
  from pg_temp._cb_daily_citation_domain_rollup d join _cs_prompts pf on pf.id = d.prompt_id
  where d.team_id = v_team and d.day between v_from - v_prev_len and v_from - 1
    and (v_models is null or d.model = any(v_models))
  group by d.domain_norm;
  create unique index on _cs_dom_prev (domain);
  v_t := app._citations_f_prof_v1('dom_prev', v_t);

  -- URLs
  drop table if exists _cs_url_now;
  create temp table _cs_url_now on commit drop as
  select x.url, min(x.domain_norm) as domain, sum(x.runs_with_url)::int as runs_with, sum(x.used_total)::bigint as used_total,
         min(x.first_used_at) as first_used_at, max(x.last_used_at) as last_used_at
  from (
    select u.url, u.domain_norm, u.runs_with_url, u.used_total, u.first_used_at, u.last_used_at
    from pg_temp._cb_daily_citation_url_rollup u join _cs_prompts pf on pf.id = u.prompt_id
    where u.team_id = v_team and u.day = any(v_days) and (v_models is null or u.model = any(v_models))
    union all
    select u.url, u.domain_norm, u.runs_with_url, u.used_total, u.first_used_at, u.last_used_at
    from pg_temp._cb_weekly_citation_url_rollup u join _cs_prompts pf on pf.id = u.prompt_id
    where u.team_id = v_team and u.week_start = any(v_weeks) and (v_models is null or u.model = any(v_models))
    union all
    select u.url, u.domain_norm, u.runs_with_url, u.used_total, u.first_used_at, u.last_used_at
    from pg_temp._cb_monthly_citation_url_rollup u join _cs_prompts pf on pf.id = u.prompt_id
    where u.team_id = v_team and u.month_start = any(v_months) and (v_models is null or u.model = any(v_models))) x
  group by x.url;
  create unique index on _cs_url_now (url);
  create index on _cs_url_now (domain);
  analyze _cs_url_now;
  v_t := app._citations_f_prof_v1('url_now', v_t);

  drop table if exists _cs_url_prev;
  create temp table _cs_url_prev (url text primary key, runs_with int) on commit drop;
  if v_need_prev then
    insert into _cs_url_prev (url, runs_with)
    select u.url, sum(u.runs_with_url)::int
    from pg_temp._cb_daily_citation_url_rollup u join _cs_prompts pf on pf.id = u.prompt_id
    join _cs_url_now n on n.url = u.url
    where u.team_id = v_team and u.day between v_from - v_prev_len and v_from - 1
      and (v_models is null or u.model = any(v_models))
    group by u.url;
  end if;
  v_t := app._citations_f_prof_v1('url_prev', v_t);

  -- Effektiv-Typ + Favicon je Domain
  drop table if exists _cs_team;
  create temp table _cs_team on commit drop as
  select tc.role::text as role, app._url_domain_norm(c.url) as host
  from app.team_company tc join app.company c on c.id = tc.company_id
  where tc.team_id = v_team and app._url_domain_norm(c.url) is not null;

  drop table if exists _cs_domtype;
  -- perf_5: Team-Overrides und Team-Hosts einmal vorab (Hash-Join statt Suche je Domain)
  create temp table _cs_domtype on commit drop as
  with ovr as (
    select distinct on (regexp_replace(lower(tdo.domain), '^www\.', ''))
           regexp_replace(lower(tdo.domain), '^www\.', '') as domain, tdo.role::text as role
    from app.team_domain_override tdo
    where tdo.team_id = v_team
  ), hosts as (
    select distinct on (ti0.host) ti0.host, ti0.role
    from _cs_team ti0
    order by ti0.host, case ti0.role when 'own' then 0 else 1 end
  )
  select d.domain, sd.favicon,
         coalesce(case o.role when 'own' then 'You' when 'competitor' then 'Competition' end,
                  case h.role when 'own' then 'You' when 'competitor' then 'Competition' end,
                  sd.citation_type::text, 'Misc') as citation_type
  from (select domain from _cs_dom_now union select domain from _cs_url_now) d
  left join lateral (select sd0.favicon, sd0.citation_type from app.source_domain sd0
                     where regexp_replace(lower(sd0.domain), '^www\.', '') = d.domain limit 1) sd on true
  left join ovr o on o.domain = d.domain
  left join hosts h on h.host = d.domain;
  create unique index on _cs_domtype (domain);
  v_t := app._citations_f_prof_v1('domtype', v_t);

  -- URL-Typ (nur wenn gebraucht; source_url_type = schlanke Kopie von source_url.url_type)
  drop table if exists _cs_url_type;
  create temp table _cs_url_type (url text primary key, url_type text) on commit drop;
  if v_need_type then
    insert into _cs_url_type (url, url_type)
    select u.url, coalesce(st.url_type::text, 'uncategorized')
    from _cs_url_now u left join app.source_url_type st on st.url = u.url;
  end if;
  v_t := app._citations_f_prof_v1('url_type', v_t);

  -- Titel + Favicon: fuer alle URLs nur bei Suche, sonst nur fuer ausgegebene Zeilen
  drop table if exists _cs_url_title;
  create temp table _cs_url_title (url text primary key, title text, favicon text) on commit drop;
  if v_need_title then
    perform app._citations_f_titles_v1(null);
  end if;
  v_t := app._citations_f_prof_v1('titles', v_t);

  -- URLs mit eigener Marke (nur wenn gebraucht)
  drop table if exists _cs_own_urls;
  create temp table _cs_own_urls (url text primary key) on commit drop;
  if v_need_own then
    -- perf_5: Schnittmenge per Hash statt Index-Suche je Erwaehnung
    insert into _cs_own_urls (url)
    select u.url from _cs_url_now u
    intersect
    select ucm.url
    from app.url_company_mention ucm
    join app.team_company tc on tc.team_id = v_team and tc.company_id = ucm.company_id and tc.company_id = nullif(p->>'brand', '')::uuid
    where ucm.team_id = v_team;
  end if;
  v_t := app._citations_f_prof_v1('own', v_t);
end;
$function$;

CREATE OR REPLACE FUNCTION app._citations_fb_overview_calc_v1(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_team   uuid   := (p->>'team_id')::uuid;
  v_mode   text   := p->>'mode';
  v_gran   text   := p->>'granularity';
  v_lim    int    := (p->>'series_limit')::int;
  v_models text[] := app._citations_jarr_text_v1(p->'models');
  v_ign    text[] := '{}';
  v_from date; v_to date; v_n int;
  v_keys   text[];
  v_series jsonb; v_types jsonb; v_ts jsonb; v_kpis jsonb;
  v_step   interval;
begin
  perform app._citations_brand_build_v1(p);
  perform app._citations_fb_scope_v1(p, jsonb_build_object('url_type', v_mode = 'url',
                                                          'own', coalesce(p->>'mentioned', 'all') <> 'all'));
  if v_mode = 'domain' then
    -- url_types wirken im Domain-Modus nicht
    if jsonb_array_length(coalesce(p->'url_types', '[]')) > 0 then
      v_ign := array['url_types'];
    end if;
    perform app._citations_f_sets_v1(p - 'url_types', true);
  else
    perform app._citations_f_sets_v1(p, true);
  end if;
  select date_from, date_to, n into v_from, v_to, v_n from _cs_meta;

  -- KPIs
  select jsonb_build_object(
    'runs_with_any',   v_n,
    'citations_total', case when v_mode = 'domain'
                            then (select coalesce(sum(used_total), 0) from _cs_dom_x where pass_base and pass_ctype)
                            else (select coalesce(sum(used_total), 0) from _cs_url_x where pass_base and pass_ctype and pass_utype) end,
    'domains_total',   (select count(*) from _cs_dom_x where pass_base and pass_ctype),
    'urls_total',      (select count(*) from _cs_url_x where pass_base and pass_ctype and pass_utype))
    into v_kpis;

  -- Serien = erste N Zeilen der Tabelle bei share_desc
  if v_mode = 'domain' then
    select array_agg(domain order by runs_with desc, domain asc),
           jsonb_agg(jsonb_build_object(
             'key', domain, 'domain', domain, 'favicon', app._citations_abs_url_v1(favicon),
             'citation_type', citation_type,
             'citation_type_label', app.citation_type_label(citation_type::app.citation_type),
             'share_pct', coalesce(round(runs_with * 100.0 / nullif(v_n, 0), 2), 0),
             'runs_with', runs_with) order by runs_with desc, domain asc)
      into v_keys, v_series
    from (select * from _cs_dom_x where pass_base and pass_ctype order by runs_with desc, domain asc limit v_lim) t;

    -- Typ-Verteilung (Citation Type), ohne den eigenen Typ-Filter
    with g as (
      select citation_type as t, sum(used_total)::bigint as c from _cs_dom_x where pass_base group by citation_type
    ), r as (
      select g.t, g.c, round(g.c * 100.0 / nullif(sum(g.c) over (), 0), 2) as s,
             row_number() over (order by g.c desc, g.t) as rn from g where g.c > 0
    ), a as (
      select r.*, case when r.rn = 1 then 100 - sum(r.s) over () + r.s else r.s end as s2 from r
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'type', a.t, 'label', app.citation_type_label(a.t::app.citation_type),
             'count', a.c, 'share_pct', a.s2) order by a.rn), '[]'::jsonb)
      into v_types from a;
  else
    perform app._citations_f_titles_v1(array(select x.url from _cs_url_x x where x.pass_base and x.pass_ctype and x.pass_utype
                                              order by x.runs_with desc, x.url asc limit v_lim));
    select array_agg(url order by runs_with desc, url asc),
           jsonb_agg(jsonb_build_object(
             'key', url, 'url', url, 'title', title, 'domain', domain,
             'favicon', app._citations_abs_url_v1(favicon),
             'citation_type', citation_type,
             'citation_type_label', app.citation_type_label(citation_type::app.citation_type),
             'url_type', url_type,
             'url_type_label', case when url_type = 'uncategorized' then null else app.url_type_label(url_type::app.url_type) end,
             'share_pct', coalesce(round(runs_with * 100.0 / nullif(v_n, 0), 2), 0),
             'runs_with', runs_with) order by runs_with desc, url asc)
      into v_keys, v_series
    from (select x.*, ti.title, ti.favicon from _cs_url_x x left join _cs_url_title ti on ti.url = x.url
          where x.pass_base and x.pass_ctype and x.pass_utype order by x.runs_with desc, x.url asc limit v_lim) t;

    -- Typ-Verteilung (URL Type), ohne den eigenen Typ-Filter
    with g as (
      select url_type as t, sum(used_total)::bigint as c from _cs_url_x where pass_base and pass_ctype group by url_type
    ), r as (
      select g.t, g.c, round(g.c * 100.0 / nullif(sum(g.c) over (), 0), 2) as s,
             row_number() over (order by g.c desc, g.t) as rn from g where g.c > 0
    ), a as (
      select r.*, case when r.rn = 1 then 100 - sum(r.s) over () + r.s else r.s end as s2 from r
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'type', a.t, 'label', case when a.t = 'uncategorized' then null else app.url_type_label(a.t::app.url_type) end,
             'count', a.c, 'share_pct', a.s2) order by a.rn), '[]'::jsonb)
      into v_types from a;
  end if;

  -- p_series_limit 0 (Dashboard v1): keine Zeitreihe
  if v_lim = 0 then
    v_ts := '[]'::jsonb;
  else
    -- Zeitreihe: Buckets (Berliner Tage), angeschnittene Buckets mit bucket_from/bucket_to
    v_step := case v_gran when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end;
    drop table if exists _cs_buckets;
    create temp table _cs_buckets on commit drop as
    select b.bucket,
           greatest(b.bucket, v_from) as bfrom,
           least(b.bucket_end, v_to) as bto,
           (greatest(b.bucket, v_from) > b.bucket or least(b.bucket_end, v_to) < b.bucket_end) as partial
    from (select g::date as bucket,
                 case v_gran when 'day' then g::date
                             when 'week' then g::date + 6
                             else (g + interval '1 month - 1 day')::date end as bucket_end
          from generate_series(date_trunc(case v_gran when 'day' then 'day' when 'week' then 'week' else 'month' end, v_from::timestamp),
                               v_to::timestamp, v_step) g) b;

    with nb as (
      select b.bucket, coalesce(sum(r.runs_with_any_citation), 0)::int as n
      from _cs_buckets b
      left join (select r0.day, r0.runs_with_any_citation from pg_temp._cb_daily_citation_run_rollup r0
                 join _cs_prompts pf on pf.id = r0.prompt_id
                 where r0.team_id = v_team and r0.day between v_from and v_to
                   and (v_models is null or r0.model = any(v_models))) r on r.day between b.bfrom and b.bto
      group by b.bucket
    ), eb as (
      select b.bucket, k.key, coalesce(sum(e.runs), 0)::int as runs
      from _cs_buckets b
      cross join unnest(coalesce(v_keys, '{}'::text[])) with ordinality k(key, ord)
      left join (
        select d0.day, d0.domain_norm as key, d0.runs_with_domain as runs
        from pg_temp._cb_daily_citation_domain_rollup d0 join _cs_prompts pf on pf.id = d0.prompt_id
        where v_mode = 'domain' and d0.team_id = v_team and d0.day between v_from and v_to
          and d0.domain_norm = any(v_keys) and (v_models is null or d0.model = any(v_models))
        union all
        select u0.day, u0.url, u0.runs_with_url
        from pg_temp._cb_daily_citation_url_rollup u0 join _cs_prompts pf on pf.id = u0.prompt_id
        where v_mode = 'url' and u0.team_id = v_team and u0.day between v_from and v_to
          and u0.url = any(v_keys) and (v_models is null or u0.model = any(v_models))
      ) e on e.key = k.key and e.day between b.bfrom and b.bto
      group by b.bucket, k.key, k.ord
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'bucket', b.bucket, 'bucket_from', b.bfrom, 'bucket_to', b.bto, 'partial', b.partial,
             'key', eb.key, 'share_pct', coalesce(round(eb.runs * 100.0 / nullif(nb.n, 0), 2), 0),
             'runs_with', eb.runs, 'runs_with_any', nb.n)
             order by b.bucket, array_position(v_keys, eb.key)), '[]'::jsonb)
      into v_ts
    from _cs_buckets b join nb on nb.bucket = b.bucket join eb on eb.bucket = b.bucket;
  end if;

  return jsonb_build_object(
    'meta', app._citations_f_meta_v1(p, v_ign) || jsonb_build_object('brand_id', p->'brand',
              'mode', v_mode, 'granularity', v_gran, 'series_limit', v_lim),
    'kpis', v_kpis,
    'series', coalesce(v_series, '[]'::jsonb),
    'timeseries', v_ts,
    'types', v_types);
end;
$function$;

CREATE OR REPLACE FUNCTION app._citations_gb_domains_calc_v1(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_team    uuid   := (p->>'team_id')::uuid;
  v_from    date   := (p->>'date_from')::date;
  v_to      date   := (p->>'date_to')::date;
  v_models  text[] := app._citations_jarr_text_v1(p->'models');
  v_ment    text   := coalesce(p->>'mentioned', 'all');
  v_brands  uuid[] := app._citations_jarr_uuid_v1(p->'mentioned_brands');
  v_ct      text[] := app._citations_jarr_text_v1(p->'citation_types');
  v_search  text   := nullif(p->>'search', '');
  v_order   text   := coalesce(p->>'order', 'share_desc');
  v_limit   int    := coalesce((p->>'_limit')::int, 100);
  v_offset  int    := coalesce((p->>'_offset')::int, 0);
  v_ign     text[] := case when jsonb_array_length(coalesce(p->'url_types', '[]')) > 0 then array['url_types'] else '{}' end;
  v_prompts uuid[];
  v_days date[]; v_weeks date[]; v_months date[];
  v_pf date; v_pt date;
  v_n int; v_np int;
  v_pat text; v_pat_n text; v_pat_f text;
  v_total bigint;
  v_page  jsonb;
  v_rows  jsonb;
begin
  perform set_config('work_mem', '128MB', true);
  perform set_config('jit', 'off', true);
  perform app._citations_brand_build_v1(p);
  v_pf := v_from - greatest(least((v_to - v_from + 1) / 2, 30), 1);
  v_pt := v_from - 1;
  v_prompts := app._citations_g_prompts_v1(p);
  select t.days, t.weeks, t.months into v_days, v_weeks, v_months from app._citations_gb_tiles_v1(v_team, v_from, v_to) t;
  select x.n, x.n_prev into v_n, v_np from app._citations_gb_n_v1(v_team, v_prompts, v_models, v_days, v_weeks, v_months, v_pf, v_pt) x;
  if v_search is not null then
    v_pat   := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_pat_n := app._citations_f_pat_v1(v_search, true);
    v_pat_f := app._citations_f_pat_v1(v_search, false);
  end if;

  with dn as materialized (
    select x.domain_norm as domain, sum(x.runs_with_domain)::int as runs_with, sum(x.used_total)::bigint as used_total,
           min(x.first_used_at) as first_used_at, max(x.last_used_at) as last_used_at
    from (
      select d.domain_norm, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at
      from pg_temp._cb_daily_citation_domain_rollup d
      where d.team_id = v_team and d.day = any(v_days) and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))
      union all
      select d.domain_norm, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at
      from pg_temp._cb_weekly_citation_domain_rollup d
      where d.team_id = v_team and d.week_start = any(v_weeks) and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))
      union all
      select d.domain_norm, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at
      from pg_temp._cb_monthly_citation_domain_rollup d
      where d.team_id = v_team and d.month_start = any(v_months) and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))) x
    group by x.domain_norm
  ), dp as (
    select d.domain_norm as domain, sum(d.runs_with_domain)::int as runs_with
    from pg_temp._cb_daily_citation_domain_rollup d
    where d.team_id = v_team and d.day between v_pf and v_pt and d.prompt_id = any(v_prompts)
      and (v_models is null or d.model = any(v_models))
    group by d.domain_norm
  ), uu as materialized (
    select x.url, min(x.domain_norm) as domain
    from (
      select u.url, u.domain_norm from pg_temp._cb_daily_citation_url_rollup u
      where u.team_id = v_team and u.day = any(v_days) and u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))
      union all
      select u.url, u.domain_norm from pg_temp._cb_weekly_citation_url_rollup u
      where u.team_id = v_team and u.week_start = any(v_weeks) and u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))
      union all
      select u.url, u.domain_norm from pg_temp._cb_monthly_citation_url_rollup u
      where u.team_id = v_team and u.month_start = any(v_months) and u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))) x
    group by x.url
  ), own as materialized (
    select uu.url from uu
    intersect
    select ucm.url from app.url_company_mention ucm
    join app.team_company tc on tc.team_id = v_team and tc.company_id = ucm.company_id and tc.company_id = nullif(p->>'brand', '')::uuid
    where ucm.team_id = v_team
  ), brand as materialized (
    select distinct ucm.url
    from uu
    join app.url_company_mention ucm on ucm.url = uu.url and ucm.team_id = v_team
    join app.team_company tc on tc.team_id = v_team and tc.company_id = ucm.company_id
    where v_brands is not null and ucm.company_id = any(v_brands)
  ), f as (
    select uu.domain, count(*)::int as urls_count, bool_or(o.url is not null) as has_own, bool_or(b.url is not null) as has_brand
    from uu left join own o on o.url = uu.url left join brand b on b.url = uu.url
    group by uu.domain
  ), dt as materialized (
    -- Effektiv-Typ fuer alle Domains nur, wenn danach gefiltert wird
    select t.* from app._citations_g_domtype_v1(v_team, array(select dn.domain from dn)) t where v_ct is not null
  ), x as (
    select dn.*, coalesce(dp.runs_with, 0) as runs_prev,
           coalesce(f.urls_count, 0)::int as urls_count, coalesce(f.has_own, false) as is_mentioned,
           dt.citation_type as ct_all,
           coalesce(round(dn.runs_with * 100.0 / nullif(v_n, 0), 2), 0) as share,
           case when v_np > 0 then round(coalesce(dp.runs_with, 0) * 100.0 / v_np, 2) end as share_prev
    from dn
    left join dp on dp.domain = dn.domain
    left join f on f.domain = dn.domain
    left join dt on dt.domain = dn.domain
    where (v_ment = 'all' or (v_ment = 'yes') = coalesce(f.has_own, false))
      and (v_brands is null or coalesce(f.has_brand, false))
      and (v_pat is null
           or dn.domain ilike v_pat or dn.domain ilike v_pat_n or dn.domain ilike v_pat_f
           or (octet_length(dn.domain) <> char_length(dn.domain)
               and (app._suche_norm(dn.domain) like v_pat_n or app._suche_fold(dn.domain) like v_pat_f)))
      and (v_ct is null or coalesce(dt.citation_type, 'Misc') = any(v_ct))
  ), d as (
    select x.*, x.share - x.share_prev as delta from x
  ), s as (
    select d.*, count(*) over () as total,
           row_number() over (order by
             case when v_order = 'share_desc'       then d.runs_with end desc nulls last,
             case when v_order = 'share_asc'        then d.runs_with end asc  nulls last,
             case when v_order = 'share_delta_desc' then d.delta end desc nulls last,
             case when v_order = 'share_delta_asc'  then d.delta end asc  nulls last,
             case when v_order = 'last_used_desc'   then d.last_used_at end desc nulls last,
             case when v_order = 'last_used_asc'    then d.last_used_at end asc  nulls last,
             case when v_order = 'domain_desc'      then d.domain end desc nulls last,
             case when v_order = 'urls_count_desc'  then d.urls_count end desc nulls last,
             case when v_order = 'urls_count_asc'   then d.urls_count end asc  nulls last,
             d.domain asc) as rn
    from d
  )
  select coalesce(max(s.total), 0),
         coalesce(jsonb_agg(to_jsonb(s) - 'total') filter (where s.rn > v_offset and s.rn <= v_offset + v_limit), '[]'::jsonb)
    into v_total, v_page
  from s;

  -- Seite: Favicon + Effektiv-Typ nur fuer die ausgegebenen Domains
  with pg as (
    select r.* from jsonb_to_recordset(v_page) as r(domain text, runs_with int, used_total bigint, first_used_at timestamptz,
                                                    last_used_at timestamptz, urls_count int, is_mentioned boolean,
                                                    share numeric, share_prev numeric, delta numeric, rn bigint)
  ), t as (
    select * from app._citations_g_domtype_v1(v_team, array(select pg.domain from pg))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'domain',              pg.domain,
           'favicon',             app._citations_abs_url_v1(t.favicon),
           'citation_type',       coalesce(t.citation_type, 'Misc'),
           'citation_type_label', app.citation_type_label(coalesce(t.citation_type, 'Misc')::app.citation_type),
           'share_pct',           pg.share,
           'share_prev_pct',      pg.share_prev,
           'share_delta_pct',     pg.delta,
           'runs_with_domain',    pg.runs_with,
           'used_total',          pg.used_total,
           'urls_count',          pg.urls_count,
           'is_mentioned',        pg.is_mentioned,
           'first_used_at',       pg.first_used_at,
           'last_used_at',        pg.last_used_at) order by pg.rn), '[]'::jsonb)
    into v_rows
  from pg left join t on t.domain = pg.domain;

  return jsonb_build_object(
    'meta', app._citations_g_meta_v1(p, v_n, v_np, v_pf, v_pt, v_ign) || jsonb_build_object('brand_id', p->'brand',
              'total_count', v_total, 'limit', v_limit, 'offset', v_offset,
              'order', v_order, 'search', p->'search'),
    'rows', v_rows);
end;
$function$;

CREATE OR REPLACE FUNCTION app._citations_gb_urls_calc_v1(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_team    uuid   := (p->>'team_id')::uuid;
  v_from    date   := (p->>'date_from')::date;
  v_to      date   := (p->>'date_to')::date;
  v_models  text[] := app._citations_jarr_text_v1(p->'models');
  v_ment    text   := coalesce(p->>'mentioned', 'all');
  v_brands  uuid[] := app._citations_jarr_uuid_v1(p->'mentioned_brands');
  v_ct      text[] := app._citations_jarr_text_v1(p->'citation_types');
  v_ut      text[] := app._citations_jarr_text_v1(p->'url_types');
  v_search  text   := nullif(p->>'search', '');
  v_dom     text   := nullif(p->>'domain', '');
  v_order   text   := coalesce(p->>'order', case when p ? 'domain' then 'domainshare_desc' else 'share_desc' end);
  v_limit   int    := coalesce((p->>'_limit')::int, 100);
  v_offset  int    := coalesce((p->>'_offset')::int, 0);
  v_prompts uuid[];
  v_days date[]; v_weeks date[]; v_months date[];
  v_pf date; v_pt date;
  v_n int; v_np int;
  v_pat text; v_pat_n text; v_pat_f text;
  v_total bigint;
  v_page  jsonb;
  v_rows  jsonb;
  v_meta  jsonb;
  v_dom_runs int;
  v_t timestamptz := clock_timestamp();
  v_nl text;
begin
  perform set_config('work_mem', '128MB', true);
  perform set_config('jit', 'off', true);
  perform app._citations_brand_build_v1(p);
  v_pf := v_from - greatest(least((v_to - v_from + 1) / 2, 30), 1);
  v_pt := v_from - 1;
  v_prompts := app._citations_g_prompts_v1(p);
  select t.days, t.weeks, t.months into v_days, v_weeks, v_months from app._citations_gb_tiles_v1(v_team, v_from, v_to) t;
  select x.n, x.n_prev into v_n, v_np from app._citations_gb_n_v1(v_team, v_prompts, v_models, v_days, v_weeks, v_months, v_pf, v_pt) x;
  if v_search is not null then
    v_pat   := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_pat_n := app._citations_f_pat_v1(v_search, true);
    v_pat_f := app._citations_f_pat_v1(v_search, false);
  end if;
  v_t := app._citations_f_prof_v1('vorbereitung', v_t);

  -- g_8: Fuer die Liste keine Verknuepfung per Einzelsuche (Nested Loop). Die Datenbank
  -- unterschaetzt die Zeilenzahl nach Filtern und vergleicht sonst jede Zeile mit der
  -- ganzen Vorperiode. Gilt nur fuer diese Abfrage, danach wieder Standard.
  v_nl := current_setting('enable_nestloop');
  perform set_config('enable_nestloop', 'off', true);

  with un as materialized (
    -- URL-Aggregat; in der Domain-Ansicht nur die Zeilen dieser Domain
    select x.url, min(x.domain_norm) as domain, sum(x.runs_with_url)::int as runs_with, sum(x.used_total)::bigint as used_total,
           min(x.first_used_at) as first_used_at, max(x.last_used_at) as last_used_at
    from (
      select u.url, u.domain_norm, u.runs_with_url, u.used_total, u.first_used_at, u.last_used_at
      from pg_temp._cb_daily_citation_url_rollup u
      where u.team_id = v_team and u.day = any(v_days) and u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))
        and (v_dom is null or u.domain_norm = v_dom)
      union all
      select u.url, u.domain_norm, u.runs_with_url, u.used_total, u.first_used_at, u.last_used_at
      from pg_temp._cb_weekly_citation_url_rollup u
      where u.team_id = v_team and u.week_start = any(v_weeks) and u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))
        and (v_dom is null or u.domain_norm = v_dom)
      union all
      select u.url, u.domain_norm, u.runs_with_url, u.used_total, u.first_used_at, u.last_used_at
      from pg_temp._cb_monthly_citation_url_rollup u
      where u.team_id = v_team and u.month_start = any(v_months) and u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))
        and (v_dom is null or u.domain_norm = v_dom)) x
    group by x.url
  ), up as materialized (
    -- g_5: einmal rechnen (sonst rechnet die Datenbank sie bei wenigen Zeilen je Zeile neu)
    select u.url, sum(u.runs_with_url)::int as runs_with
    from pg_temp._cb_daily_citation_url_rollup u
    join un on un.url = u.url
    where u.team_id = v_team and u.day between v_pf and v_pt and u.prompt_id = any(v_prompts)
      and (v_models is null or u.model = any(v_models))
      and (v_dom is null or u.domain_norm = v_dom)
    group by u.url
  ), own as materialized (
    -- eigene Marke fuer alle URLs nur, wenn danach gefiltert wird
    select un.url from un where v_ment <> 'all'
    intersect
    select ucm.url from app.url_company_mention ucm
    join app.team_company tc on tc.team_id = v_team and tc.company_id = ucm.company_id and tc.company_id = nullif(p->>'brand', '')::uuid
    where ucm.team_id = v_team and v_ment <> 'all'
  ), brand as materialized (
    select distinct ucm.url
    from un
    join app.url_company_mention ucm on ucm.url = un.url and ucm.team_id = v_team
    join app.team_company tc on tc.team_id = v_team and tc.company_id = ucm.company_id
    where v_brands is not null and ucm.company_id = any(v_brands)
  ), dt as materialized (
    select t.* from app._citations_g_domtype_v1(v_team, array(select distinct un.domain from un)) t where v_ct is not null
  ), ty as materialized (
    select un.url, coalesce(st.url_type::text, 'uncategorized') as url_type
    from un left join app.source_url_type st on st.url = un.url
    where v_ut is not null
  ), x as (
    select un.*, coalesce(up.runs_with, 0) as runs_prev,
           case when v_ment <> 'all' then (o.url is not null) end as is_mentioned,
           dt.citation_type as ct_all, ty.url_type as ut_all,
           coalesce(round(un.runs_with * 100.0 / nullif(v_n, 0), 2), 0) as share,
           case when v_np > 0 then round(coalesce(up.runs_with, 0) * 100.0 / v_np, 2) end as share_prev
    from un
    left join up on up.url = un.url
    left join own o on o.url = un.url
    left join brand b on b.url = un.url
    left join dt on dt.domain = un.domain
    left join ty on ty.url = un.url
    where (v_ment = 'all' or (v_ment = 'yes') = (o.url is not null))
      and (v_brands is null or b.url is not null)
      -- g_4: Suche nur in der URL (wie die alten RPCs), mit Umlaut-Faltung
      and (v_pat is null
           or un.url ilike v_pat or un.url ilike v_pat_n or un.url ilike v_pat_f
           or (octet_length(un.url) <> char_length(un.url)
               and (app._suche_norm(un.url) like v_pat_n or app._suche_fold(un.url) like v_pat_f)))
      and (v_dom is null or un.domain = v_dom)
      and (v_ct is null or coalesce(dt.citation_type, 'Misc') = any(v_ct))
      and (v_ut is null or ty.url_type = any(v_ut))
  ), d as (
    select x.*, x.share - x.share_prev as delta from x
  ), s as (
    select d.*, count(*) over () as total,
           row_number() over (order by
             case when v_order in ('share_desc', 'domainshare_desc') then d.runs_with end desc nulls last,
             case when v_order in ('share_asc', 'domainshare_asc')   then d.runs_with end asc  nulls last,
             case when v_order = 'share_delta_desc' then d.delta end desc nulls last,
             case when v_order = 'share_delta_asc'  then d.delta end asc  nulls last,
             case when v_order = 'last_used_desc'   then d.last_used_at end desc nulls last,
             case when v_order = 'last_used_asc'    then d.last_used_at end asc  nulls last,
             case when v_order = 'domain_asc'       then d.domain end asc nulls last,
             d.url asc) as rn
    from d
  )
  select coalesce(max(s.total), 0),
         coalesce(jsonb_agg(to_jsonb(s) - 'total') filter (where s.rn > v_offset and s.rn <= v_offset + v_limit), '[]'::jsonb)
    into v_total, v_page
  from s;
  perform set_config('enable_nestloop', v_nl, true);
  v_t := app._citations_f_prof_v1('liste', v_t);

  -- Seite: Details nur fuer die ausgegebenen Zeilen
  with pg as materialized (
    select r.* from jsonb_to_recordset(v_page) as r(url text, domain text, runs_with int, used_total bigint,
                                                    first_used_at timestamptz, last_used_at timestamptz, runs_prev int,
                                                    is_mentioned boolean, ct_all text, ut_all text,
                                                    share numeric, share_prev numeric, delta numeric, rn bigint)
  ), dtp as (
    select * from app._citations_g_domtype_v1(v_team, array(select pg.domain from pg))
  ), dnp as (
    -- Domain-Runs (fuer domainshare) nur fuer die Domains der Seite
    select x.domain_norm as domain, sum(x.runs_with_domain)::int as runs_with
    from (
      select d.domain_norm, d.runs_with_domain from pg_temp._cb_daily_citation_domain_rollup d
      where d.team_id = v_team and d.domain_norm = any(array(select distinct pg.domain from pg)) and d.day = any(v_days)
        and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))
      union all
      select d.domain_norm, d.runs_with_domain from pg_temp._cb_weekly_citation_domain_rollup d
      where d.team_id = v_team and d.domain_norm = any(array(select distinct pg.domain from pg)) and d.week_start = any(v_weeks)
        and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))
      union all
      select d.domain_norm, d.runs_with_domain from pg_temp._cb_monthly_citation_domain_rollup d
      where d.team_id = v_team and d.domain_norm = any(array(select distinct pg.domain from pg)) and d.month_start = any(v_months)
        and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))) x
    group by x.domain_norm
  ), tip as (
    select pg.url,
           case when c.t <> '' then left(c.t, 200) when c.dsc <> '' then left(c.dsc, 100) else pg.domain end as title,
           su.favicon
    from pg
    left join app.source_url su on su.url = pg.url
    cross join lateral (select btrim(regexp_replace(coalesce(su.title, ''), '\s+', ' ', 'g')) as t) ct
    cross join lateral (select ct.t,
                               case when ct.t = '' then btrim(regexp_replace(coalesce(su.description, ''), '\s+', ' ', 'g')) else '' end as dsc) c
  ), men as (
    select z.url, z.company_id, z.name, z.logo, z.role,
           row_number() over (partition by z.url order by case when z.role = 'own' then 0 else 1 end, z.name, z.company_id) as rn2,
           count(*) over (partition by z.url) as cnt
    from (select distinct pg.url, ucm.company_id, coalesce(tbp.name_override, c.name) as name,
                 coalesce(tbp.logo_override_url, c.favicon_url) as logo, tc.role::text as role
          from pg
          join app.url_company_mention ucm on ucm.url = pg.url and ucm.team_id = v_team
          join app.team_company tc on tc.team_id = v_team and tc.company_id = ucm.company_id
          join app.company c on c.id = ucm.company_id
          left join app.team_brand_profile tbp on tbp.team_id = v_team and tbp.company_id = ucm.company_id) z
  ), menj as (
    select men.url, max(men.cnt)::int as cnt,
           jsonb_agg(jsonb_build_object('company_id', men.company_id, 'name', men.name, 'role', men.role,
                                        'logo_url', app._citations_abs_url_v1(men.logo)) order by men.rn2)
             filter (where men.rn2 <= 4) as list,
           bool_or(men.company_id = nullif(p->>'brand', '')::uuid) as has_own
    from men group by men.url
  ), r as (
    select pg.*,
           coalesce(pg.ct_all, dtp.citation_type, 'Misc') as citation_type,
           coalesce(pg.ut_all, (select st.url_type::text from app.source_url_type st where st.url = pg.url), 'uncategorized') as url_type,
           tip.title as title_x,
           tip.favicon as favicon_x,
           coalesce(round(pg.runs_with * 100.0 / nullif(dnp.runs_with, 0), 2), 0) as dshare,
           coalesce(pg.is_mentioned, coalesce(mj.has_own, false)) as is_mentioned_x,
           mj.list, mj.cnt
    from pg
    left join dtp on dtp.domain = pg.domain
    left join dnp on dnp.domain = pg.domain
    left join tip on tip.url = pg.url
    left join menj mj on mj.url = pg.url
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'url',                 r.url,
           'title',               r.title_x,
           'domain',              r.domain,
           'favicon',             app._citations_abs_url_v1(r.favicon_x),
           'citation_type',       r.citation_type,
           'citation_type_label', app.citation_type_label(r.citation_type::app.citation_type),
           'url_type',            r.url_type,
           'url_type_label',      case when r.url_type = 'uncategorized' then null
                                       else app.url_type_label(r.url_type::app.url_type) end,
           'global_share_pct',    r.share,
           'share_prev_pct',      r.share_prev,
           'share_delta_pct',     r.delta,
           'domainshare_pct',     r.dshare,
           'runs_with_url',       r.runs_with,
           'is_mentioned',        r.is_mentioned_x,
           'mentions',            coalesce(r.list, '[]'::jsonb),
           'mentions_total',      coalesce(r.cnt, 0),
           'first_used_at',       r.first_used_at,
           'last_used_at',        r.last_used_at) order by r.rn), '[]'::jsonb)
    into v_rows
  from r;
  v_t := app._citations_f_prof_v1('seite', v_t);

  v_meta := app._citations_g_meta_v1(p, v_n, v_np, v_pf, v_pt, '{}') || jsonb_build_object('brand_id', p->'brand',
              'total_count', v_total, 'limit', v_limit, 'offset', v_offset,
              'order', v_order, 'search', p->'search');
  if p ? 'domain' then
    select coalesce(sum(x.r), 0)::int into v_dom_runs from (
      select sum(d.runs_with_domain) r from pg_temp._cb_daily_citation_domain_rollup d
      where d.team_id = v_team and d.domain_norm = p->>'domain' and d.day = any(v_days)
        and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))
      union all
      select sum(d.runs_with_domain) from pg_temp._cb_weekly_citation_domain_rollup d
      where d.team_id = v_team and d.domain_norm = p->>'domain' and d.week_start = any(v_weeks)
        and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))
      union all
      select sum(d.runs_with_domain) from pg_temp._cb_monthly_citation_domain_rollup d
      where d.team_id = v_team and d.domain_norm = p->>'domain' and d.month_start = any(v_months)
        and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))) x;
    v_meta := v_meta || jsonb_build_object('domain', p->'domain', 'runs_with_domain', v_dom_runs);
  end if;
  v_t := app._citations_f_prof_v1('meta', v_t);
  return jsonb_build_object('meta', v_meta, 'rows', v_rows);
end;
$function$;

CREATE OR REPLACE FUNCTION app._citations_gb_n_v1(p_team uuid, p_prompts uuid[], p_models text[], p_days date[], p_weeks date[], p_months date[], p_pf date, p_pt date, OUT n integer, OUT n_prev integer)
 RETURNS record
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
  select
    (select coalesce(sum(x.c), 0)::int from (
       select sum(r.runs_with_any_citation) c from pg_temp._cb_daily_citation_run_rollup r
       where r.team_id = p_team and r.day = any(p_days) and r.prompt_id = any(p_prompts) and (p_models is null or r.model = any(p_models))
       union all
       select sum(r.runs_with_any_citation) from pg_temp._cb_weekly_citation_run_rollup r
       where r.team_id = p_team and r.week_start = any(p_weeks) and r.prompt_id = any(p_prompts) and (p_models is null or r.model = any(p_models))
       union all
       select sum(r.runs_with_any_citation) from pg_temp._cb_monthly_citation_run_rollup r
       where r.team_id = p_team and r.month_start = any(p_months) and r.prompt_id = any(p_prompts) and (p_models is null or r.model = any(p_models))) x),
    (select coalesce(sum(r.runs_with_any_citation), 0)::int
     from pg_temp._cb_daily_citation_run_rollup r
     where r.team_id = p_team and r.day between p_pf and p_pt and r.prompt_id = any(p_prompts)
       and (p_models is null or r.model = any(p_models)))
$function$;

CREATE OR REPLACE FUNCTION app._citations_gb_tiles_v1(p_team uuid, p_from date, p_to date, OUT days date[], OUT weeks date[], OUT months date[])
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_cutoff  date := current_date - 2;
  v_missing date[];
begin
  with dd as (select generate_series(p_from, p_to, interval '1 day')::date as d),
  cls as (select d, date_trunc('month', d)::date as ms,
                 (date_trunc('month', d) + interval '1 month - 1 day')::date as me,
                 date_trunc('week', d)::date as ws, date_trunc('week', d)::date + 6 as we from dd),
  t1 as (select d, ms, ws, (ms >= p_from and me <= p_to and me <= v_cutoff) as is_m,
                (ws >= p_from and we <= p_to and we <= v_cutoff) as is_w_cand from cls),
  t as (select d, ms, ws, is_m, (is_w_cand and not bool_or(is_m) over (partition by ws)) as is_w from t1)
  select coalesce(array_agg(distinct ms) filter (where is_m), '{}'),
         coalesce(array_agg(distinct ws) filter (where is_w), '{}'),
         coalesce(array_agg(d) filter (where not is_m and not is_w), '{}')
    into months, weeks, days
  from t;

  select coalesce(array_agg(m), '{}') into v_missing from unnest(months) m
  where exists (select 1 from pg_temp._cb_daily_citation_run_rollup r where r.team_id = p_team and r.day >= m and r.day < (m + interval '1 month')::date)
    and not exists (select 1 from pg_temp._cb_monthly_citation_run_rollup mm where mm.team_id = p_team and mm.month_start = m);
  if cardinality(v_missing) > 0 then
    months := (select coalesce(array_agg(m), '{}') from unnest(months) m where m <> all(v_missing));
    days := days || (select coalesce(array_agg(g::date), '{}') from unnest(v_missing) m,
                     generate_series(m, (m + interval '1 month - 1 day')::date, interval '1 day') g);
  end if;
  select coalesce(array_agg(w), '{}') into v_missing from unnest(weeks) w
  where exists (select 1 from pg_temp._cb_daily_citation_run_rollup r where r.team_id = p_team and r.day between w and w + 6)
    and not exists (select 1 from pg_temp._cb_weekly_citation_run_rollup ww where ww.team_id = p_team and ww.week_start = w);
  if cardinality(v_missing) > 0 then
    weeks := (select coalesce(array_agg(w), '{}') from unnest(weeks) w where w <> all(v_missing));
    days := days || (select coalesce(array_agg(g::date), '{}') from unnest(v_missing) w,
                     generate_series(w, w + 6, interval '1 day') g);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION app._dash_responses_base_v1(p_team uuid, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_markets text[] DEFAULT NULL::text[], p_models text[] DEFAULT NULL::text[], p_limit integer DEFAULT 15, p_offset integer DEFAULT 0, p_order text DEFAULT 'run_at_desc'::text, p_mentioned text DEFAULT 'all'::text, p_prompt_id uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_domain text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_company uuid DEFAULT NULL::uuid, p_tagmode text DEFAULT 'or'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min smallint DEFAULT NULL::smallint, p_sentiment_max smallint DEFAULT NULL::smallint, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_brand_name_raw_search text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_event_id uuid DEFAULT NULL::uuid, p_event_url_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(prompt_run_id uuid, run_at timestamp with time zone, model text, prompt_id uuid, prompt_text text, user_rank integer, user_sentiment smallint, has_user_brand text, companies_preview_totalcount bigint, companies_preview jsonb, sources_totalcount bigint, sources_preview jsonb, total_count bigint, response_preview text, matched_event_url_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_own_company uuid;
  v_own_name text;
  v_metric_company uuid;
  v_metric_name text;
  v_mentioned text;
  v_order text;
  v_domain_lower text;
  v_from date;
  v_to date;
  v_company_ids uuid[];
  v_has_company_filter boolean;
  v_tagmode text;
  v_limit integer := least(greatest(coalesce(p_limit, 15), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_brand_name_raw_search text;
  v_needs_recommendation_prefilter boolean;
begin
  -- (Rate-Limit macht der Wrapper cached_dashboard_responses_v1)
  perform set_config('jit', 'off', true);
  perform set_config('work_mem', '128MB', true);

  -- (Zugriffspruefung macht der Wrapper cached_dashboard_responses_v1)

  if p_event_url_id is not null and p_event_id is null then
    raise exception 'impact_event_url_not_found';
  end if;
  if p_event_id is not null then
    if not exists (select 1 from app.impact_event e where e.id = p_event_id and e.team_id = p_team) then
      raise exception 'impact_event_not_found';
    end if;
    if p_event_url_id is not null
       and not exists (select 1 from app.impact_event_url u where u.id = p_event_url_id and u.event_id = p_event_id) then
      raise exception 'impact_event_url_not_found';
    end if;
  end if;

  v_mentioned := lower(coalesce(nullif(btrim(p_mentioned), ''), 'all'));
  if v_mentioned not in ('yes', 'no', 'all') then
    v_mentioned := 'all';
  end if;

  v_order := lower(coalesce(p_order, 'run_at_desc'));
  if v_order not in (
    'run_at_desc', 'run_at_asc', 'sentiment_asc', 'sentiment_desc',
    'rank_asc', 'rank_desc'
  ) then
    v_order := 'run_at_desc';
  end if;

  v_tagmode := lower(coalesce(p_tagmode, 'or'));
  if v_tagmode not in ('or', 'and') then
    v_tagmode := 'or';
  end if;

  v_domain_lower := lower(p_domain);
  v_from := coalesce(p_date_from, current_date - 29);
  v_to := coalesce(p_date_to, current_date);
  if v_to < v_from then
    raise exception 'invalid date range';
  end if;

  v_brand_name_raw_search := nullif(
    lower(btrim(regexp_replace(coalesce(p_brand_name_raw_search, ''), '\s+', ' ', 'g'))),
    ''
  );

  select coalesce(array_agg(distinct x), '{}'::uuid[])
  into v_company_ids
  from unnest(
    coalesce(p_company_ids, '{}'::uuid[])
  ) as u(x)
  where x is not null;

  v_has_company_filter := cardinality(v_company_ids) > 0;

  -- 12.10.2026 (Brand-Drawer): p_company ist ein UND-Filter (die Antwort nennt diese Marke) und die Messmarke
  -- fuer Rang und Stimmung. Marken, die das Team nicht (mehr) verfolgt, liefern nichts.
  if p_company is not null and not exists (select 1 from app.team_company tcb
                                           where tcb.team_id = p_team and tcb.company_id = p_company) then
    return;
  end if;

  v_needs_recommendation_prefilter :=
       p_sentiment_min is not null
    or p_sentiment_max is not null
    or p_rank_min is not null
    or p_rank_max is not null
    or v_brand_name_raw_search is not null
    or v_order in ('sentiment_asc', 'sentiment_desc', 'rank_asc', 'rank_desc');

  select tc.company_id
  into v_own_company
  from app.team_company tc
  where tc.team_id = p_team and tc.role = 'own'
  limit 1;

  if v_own_company is not null then
    select coalesce(tbp.name_override, c.name)
    into v_own_name
    from app.company c
    left join app.team_brand_profile tbp
      on tbp.team_id = p_team and tbp.company_id = c.id
    where c.id = v_own_company
    limit 1;
  end if;

  v_metric_company := coalesce(p_company, v_own_company);

  if v_metric_company is not null then
    select coalesce(tbp.name_override, c.name)
    into v_metric_name
    from app.company c
    left join app.team_brand_profile tbp
      on tbp.team_id = p_team and tbp.company_id = c.id
    where c.id = v_metric_company
    limit 1;
  else
    v_metric_name := v_own_name;
  end if;

  if not v_needs_recommendation_prefilter then
    return query
    with
    comp_runs as materialized (
      select distinct r_comp.prompt_run_id as run_id
      from app.recommendation r_comp
      where v_has_company_filter
        and r_comp.team_id = p_team
        and r_comp.company_id = any(v_company_ids)
    ),
    domain_run_keys as materialized (
      select distinct scu.run_key
      from app.source_url su
      join app.staged_citation_urls scu
        on scu.team_id = p_team and scu.url = su.url
      where p_domain is not null
        and lower(su.domain) = v_domain_lower
    ),
    url_run_keys as materialized (
      select distinct scu.run_key
      from app.staged_citation_urls scu
      where p_url is not null
        and scu.team_id = p_team
        and scu.url = p_url
    ),
    ev_urls as materialized (
      select u.id as eu_id, u.url_norm as eu_url, u.created_at as eu_created
      from app.impact_event_url u
      where p_event_id is not null and u.event_id = p_event_id
    ),
    ev_prompts as materialized (
      select c.prompt_id as ep_prompt_id
      from app.impact_event_prompt c
      where p_event_id is not null and c.event_id = p_event_id and c.cohort = 'affected'
    ),
    filtered as materialized (
    select
      pr.id           as pr_id,
      pr.run_at       as f_run_at,
      pr.model        as f_model,
      pr.prompt_id    as f_prompt_id,
      pr.prompt_text  as f_prompt_text,
      pr.run_key      as f_run_key
    from app.prompt_run pr
    join app.prompt p on p.id = pr.prompt_id
    where pr.team_id = p_team
      and (p_prompt_id is null or pr.prompt_id = p_prompt_id)
      and (p_company is null or exists (select 1 from app.recommendation r_b
                                        where r_b.prompt_run_id = pr.id and r_b.team_id = p_team and r_b.company_id = p_company))
      and pr.run_day_berlin >= v_from
      and pr.run_day_berlin <= v_to
      and (
        p_search is null
        or btrim(p_search) = ''
        or pr.prompt_text ilike '%' || p_search || '%'
      )
      and (
        v_mentioned = 'all'
        or (v_mentioned = 'yes' and pr.has_user_brand = true)
        or (v_mentioned = 'no' and coalesce(pr.has_user_brand, false) = false)
      )
      and (p_models is null or cardinality(p_models) = 0 or pr.model = any(p_models))
      and (p_markets is null or cardinality(p_markets) = 0 or p.market::text = any(p_markets))
      and (
        p_tag_ids is null
        or cardinality(p_tag_ids) = 0
        or (
          v_tagmode = 'or'
          and exists (
            select 1 from app.prompt_tag t
            where t.prompt_id = p.id and t.tag_id = any(p_tag_ids)
          )
        )
        or (
          v_tagmode = 'and'
          and (
            select count(distinct t.tag_id) from app.prompt_tag t
            where t.prompt_id = p.id and t.tag_id = any(p_tag_ids)
          ) = cardinality(p_tag_ids)
        )
      )
      and (
        not v_has_company_filter
        or pr.id in (select cr.run_id from comp_runs cr)
      )
      and (
        p_domain is null
        or pr.run_key in (select dk.run_key from domain_run_keys dk)
      )
      and (
        p_url is null
        or pr.run_key in (select uk.run_key from url_run_keys uk)
      )
      and (
        p_event_id is null
        or (
          pr.prompt_id in (select ep.ep_prompt_id from ev_prompts ep)
          and exists (
            select 1
            from app.staged_citation_urls scu
            join ev_urls eu on eu.eu_url = scu.url
            where scu.team_id = p_team
              and scu.run_key = pr.run_key
              and (p_event_url_id is null or eu.eu_id = p_event_url_id)
          )
        )
      )
    ),
    numbered as (
      select
        f.*,
        count(*) over()::bigint as f_total_count,
        row_number() over (
          order by
            case when v_order = 'run_at_desc' then f.f_run_at end desc,
            case when v_order = 'run_at_asc' then f.f_run_at end asc,
            f.f_run_at desc,
            f.pr_id asc
        ) as rn
      from filtered f
    ),
    paged as (
      select n.* from numbered n
      where n.rn > v_offset and n.rn <= v_offset + v_limit
    )
    select
      pg.pr_id                                                as prompt_run_id,
      pg.f_run_at                                             as run_at,
      pg.f_model::text                                        as model,
      pg.f_prompt_id                                          as prompt_id,
      pg.f_prompt_text                                        as prompt_text,
      r_metric.rank::int                                      as user_rank,
      r_metric.sentiment::smallint                            as user_sentiment,
      case when coalesce(pr_full.has_user_brand, false) = true then 'yes'
           else 'no' end                                      as has_user_brand,
      coalesce(companies.total_count, 0)::bigint              as companies_preview_totalcount,
      coalesce(companies.data, '[]'::jsonb)                   as companies_preview,
      coalesce(srcs_all.totalcount, 0)::bigint                as sources_totalcount,
      coalesce(srcs_all.data, '[]'::jsonb)                    as sources_preview,
      pg.f_total_count                                        as total_count,
      left(coalesce(pr_full.response_json->>'text',''), 100)  as response_preview,
    case when p_event_id is null then null::uuid[] else array(
      select eu.eu_id from ev_urls eu
      where exists (
        select 1 from app.staged_citation_urls scu
        where scu.team_id = p_team and scu.run_key = pg.f_run_key and scu.url = eu.eu_url)
      order by eu.eu_created, eu.eu_id
    ) end                                                   as matched_event_url_ids
    from paged pg
    join app.prompt_run pr_full on pr_full.id = pg.pr_id
    left join lateral (
      select
        r.rank::int as rank,
        r.sentiment::smallint as sentiment
      from app.recommendation r
      where r.prompt_run_id = pg.pr_id
        and r.team_id = p_team
        and (
          (v_metric_company is not null and r.company_id = v_metric_company)
          or (
            v_metric_company is null
            and v_metric_name is not null
            and r.company_id is null
            and lower(coalesce(r.brand_name_raw, '')) = lower(v_metric_name)
          )
        )
      order by r.rank asc nulls last, r.id asc
      limit 1
    ) r_metric on true
  left join lateral (
    with company_rows as (
      select
        r.company_id,
        coalesce(tbp.name_override, c.name, r.brand_name_raw) as name,
        coalesce(tbp.logo_override_url, c.favicon_url) as favicon_url,
        r.rank,
        r.brand_name_raw,
        (v_own_company is not null and r.company_id = v_own_company) as is_own,
        row_number() over (order by r.rank asc nulls last, r.id asc) as rn
      from app.recommendation r
      join app.company c on c.id = r.company_id
      left join app.team_brand_profile tbp
        on tbp.team_id = p_team and tbp.company_id = c.id
      join app.team_company tc
        on tc.company_id = r.company_id
       and tc.team_id = p_team
       and tc.role in ('own','competitor')
      where r.prompt_run_id = pg.pr_id
        and r.team_id = p_team
    ),
    flags as (
      select
        count(*)::bigint as f_total_count,
        bool_or(is_own) as own_mentioned,
        bool_or(is_own and rn <= 4) as own_already_in_preview
      from company_rows
    ),
    picked as (
      select cr.*
      from company_rows cr
      cross join flags f
      where
        (
          (coalesce(f.own_mentioned, false) = false
           or coalesce(f.own_already_in_preview, false) = true)
          and cr.rn <= 4
        )
        or
        (
          coalesce(f.own_mentioned, false) = true
          and coalesce(f.own_already_in_preview, false) = false
          and (cr.rn <= 3 or cr.is_own = true)
        )
    )
    select
      coalesce(f.f_total_count, 0)::bigint as total_count,
      (
        select jsonb_agg(
          jsonb_build_object(
            'company_id',     p.company_id,
            'name',           p.name,
            'favicon_url',    p.favicon_url,
            'rank',           p.rank,
            'brand_name_raw', p.brand_name_raw
          )
          order by
            case
              when coalesce(f.own_mentioned, false) = true
               and coalesce(f.own_already_in_preview, false) = false
               and p.is_own = true
              then 999999
              else p.rn
            end
        )
        from picked p
      ) as data
    from flags f
  ) companies on true

  left join lateral (
    with
    stage_urls as (
      select distinct scu.url
      from app.staged_citation_urls scu
      where scu.team_id = p_team
        and scu.run_key = pg.f_run_key
    ),
    stage_full as (
      select
        su.url,
        lower(su.domain) as domain,
        sd.favicon,
        su.title,
        row_number() over (order by su.url) as pos
      from stage_urls x
      left join app.source_url su on su.url = x.url
      left join app.source_domain sd on sd.domain = su.domain
    )
    select
      (select count(*)::bigint from stage_urls) as totalcount,
      (
        select jsonb_agg(
          jsonb_build_object(
            'url',     sf.url,
            'domain',  sf.domain,
            'title',   coalesce(sf.title, sf.domain),
            'favicon', sf.favicon,
            'pos',     sf.pos
          )
          order by sf.pos
        )
        from stage_full sf
        where sf.pos <= 5
      ) as data
  ) srcs_all on true;
    return;
  end if;

  return query
  with
  comp_runs as materialized (
    select distinct r_comp.prompt_run_id as run_id
    from app.recommendation r_comp
    where v_has_company_filter
      and r_comp.team_id = p_team
      and r_comp.company_id = any(v_company_ids)
  ),
  domain_run_keys as materialized (
    select distinct scu.run_key
    from app.source_url su
    join app.staged_citation_urls scu
      on scu.team_id = p_team and scu.url = su.url
    where p_domain is not null
      and lower(su.domain) = v_domain_lower
  ),
  url_run_keys as materialized (
    select distinct scu.run_key
    from app.staged_citation_urls scu
    where p_url is not null
      and scu.team_id = p_team
      and scu.url = p_url
  ),
    ev_urls as materialized (
      select u.id as eu_id, u.url_norm as eu_url, u.created_at as eu_created
      from app.impact_event_url u
      where p_event_id is not null and u.event_id = p_event_id
    ),
    ev_prompts as materialized (
      select c.prompt_id as ep_prompt_id
      from app.impact_event_prompt c
      where p_event_id is not null and c.event_id = p_event_id and c.cohort = 'affected'
    ),
  filtered_base as materialized (
    select
      pr.id           as pr_id,
      pr.run_at       as f_run_at,
      pr.model        as f_model,
      pr.prompt_id    as f_prompt_id,
      pr.prompt_text  as f_prompt_text,
      pr.run_key      as f_run_key
    from app.prompt_run pr
    join app.prompt p on p.id = pr.prompt_id
    where pr.team_id = p_team
      and (p_prompt_id is null or pr.prompt_id = p_prompt_id)
      and (p_company is null or exists (select 1 from app.recommendation r_b
                                        where r_b.prompt_run_id = pr.id and r_b.team_id = p_team and r_b.company_id = p_company))
      and pr.run_day_berlin >= v_from
      and pr.run_day_berlin <= v_to
      and (
        p_search is null
        or btrim(p_search) = ''
        or pr.prompt_text ilike '%' || p_search || '%'
      )
      and (
        v_mentioned = 'all'
        or (v_mentioned = 'yes' and pr.has_user_brand = true)
        or (v_mentioned = 'no' and coalesce(pr.has_user_brand, false) = false)
      )
      and (p_models is null or cardinality(p_models) = 0 or pr.model = any(p_models))
      and (p_markets is null or cardinality(p_markets) = 0 or p.market::text = any(p_markets))
      and (
        p_tag_ids is null
        or cardinality(p_tag_ids) = 0
        or (
          v_tagmode = 'or'
          and exists (
            select 1 from app.prompt_tag t
            where t.prompt_id = p.id and t.tag_id = any(p_tag_ids)
          )
        )
        or (
          v_tagmode = 'and'
          and (
            select count(distinct t.tag_id) from app.prompt_tag t
            where t.prompt_id = p.id and t.tag_id = any(p_tag_ids)
          ) = cardinality(p_tag_ids)
        )
      )
      and (
        not v_has_company_filter
        or pr.id in (select cr.run_id from comp_runs cr)
      )
      and (
        p_domain is null
        or pr.run_key in (select dk.run_key from domain_run_keys dk)
      )
      and (
        p_url is null
        or pr.run_key in (select uk.run_key from url_run_keys uk)
      )
      and (
        p_event_id is null
        or (
          pr.prompt_id in (select ep.ep_prompt_id from ev_prompts ep)
          and exists (
            select 1
            from app.staged_citation_urls scu
            join ev_urls eu on eu.eu_url = scu.url
            where scu.team_id = p_team
              and scu.run_key = pr.run_key
              and (p_event_url_id is null or eu.eu_id = p_event_url_id)
          )
        )
      )
  ),
  metric_recs as materialized (
    select
      r.prompt_run_id,
      r.company_id,
      r.rank::integer as rank,
      r.sentiment::smallint as sentiment,
      r.brand_name_raw,
      row_number() over (
        partition by r.prompt_run_id
        order by
          case when v_order = 'sentiment_asc' then r.sentiment end asc nulls last,
          case when v_order = 'sentiment_desc' then r.sentiment end desc nulls last,
          case when v_order = 'rank_asc' then r.rank end asc nulls last,
          case when v_order = 'rank_desc' then r.rank end desc nulls last,
          r.rank asc nulls last,
          r.id asc
      ) as rn
    from app.recommendation r
    where r.team_id = p_team
      and r.prompt_run_id in (select fb0.pr_id from filtered_base fb0)
      and (
        (v_metric_company is not null and r.company_id = v_metric_company)
        or (
          v_metric_company is null
          and v_metric_name is not null
          and r.company_id is null
          and lower(coalesce(r.brand_name_raw, '')) = lower(v_metric_name)
        )
      )
      and (p_sentiment_min is null or r.sentiment >= p_sentiment_min)
      and (p_sentiment_max is null or r.sentiment <= p_sentiment_max)
      and (p_rank_min is null or r.rank >= p_rank_min)
      and (p_rank_max is null or r.rank <= p_rank_max)
      and (
        v_brand_name_raw_search is null
        or lower(regexp_replace(coalesce(r.brand_name_raw, ''), '\s+', ' ', 'g'))
           like '%' || v_brand_name_raw_search || '%'
      )
  ),
  filtered as materialized (
    select
      fb.*,
      sr.company_id as f_selected_company_id,
      sr.rank as f_selected_rank,
      sr.sentiment as f_selected_sentiment,
      sr.brand_name_raw as f_selected_brand_name_raw
    from filtered_base fb
    join metric_recs sr
      on sr.prompt_run_id = fb.pr_id and sr.rn = 1
  ),
  numbered as (
    select
      f.*,
      count(*) over()::bigint as f_total_count,
      row_number() over (
        order by
          case when v_order = 'sentiment_asc' then f.f_selected_sentiment end asc nulls last,
          case when v_order = 'sentiment_desc' then f.f_selected_sentiment end desc nulls last,
          case when v_order = 'rank_asc' then f.f_selected_rank end asc nulls last,
          case when v_order = 'rank_desc' then f.f_selected_rank end desc nulls last,
          case when v_order = 'run_at_desc' then f.f_run_at end desc,
          case when v_order = 'run_at_asc' then f.f_run_at end asc,
          f.f_run_at desc,
          f.pr_id asc
      ) as rn
    from filtered f
  ),
  paged as (
    select n.* from numbered n
    where n.rn > v_offset and n.rn <= v_offset + v_limit
  )
  select
    pg.pr_id                                                as prompt_run_id,
    pg.f_run_at                                             as run_at,
    pg.f_model::text                                        as model,
    pg.f_prompt_id                                          as prompt_id,
    pg.f_prompt_text                                        as prompt_text,
    pg.f_selected_rank::integer                             as user_rank,
    pg.f_selected_sentiment::smallint                       as user_sentiment,
    case when coalesce(pr_full.has_user_brand, false) = true then 'yes'
         else 'no' end                                      as has_user_brand,
    coalesce(companies.total_count, 0)::bigint              as companies_preview_totalcount,
    coalesce(companies.data, '[]'::jsonb)                   as companies_preview,
    coalesce(srcs_all.totalcount, 0)::bigint                as sources_totalcount,
    coalesce(srcs_all.data, '[]'::jsonb)                    as sources_preview,
    pg.f_total_count                                        as total_count,
    left(coalesce(pr_full.response_json->>'text',''), 100)  as response_preview,
    case when p_event_id is null then null::uuid[] else array(
      select eu.eu_id from ev_urls eu
      where exists (
        select 1 from app.staged_citation_urls scu
        where scu.team_id = p_team and scu.run_key = pg.f_run_key and scu.url = eu.eu_url)
      order by eu.eu_created, eu.eu_id
    ) end                                                   as matched_event_url_ids
  from paged pg
  join app.prompt_run pr_full on pr_full.id = pg.pr_id
  left join lateral (
    with company_rows as (
      select
        r.company_id,
        coalesce(tbp.name_override, c.name, r.brand_name_raw) as name,
        coalesce(tbp.logo_override_url, c.favicon_url) as favicon_url,
        r.rank,
        r.brand_name_raw,
        (v_own_company is not null and r.company_id = v_own_company) as is_own,
        row_number() over (order by r.rank asc nulls last, r.id asc) as rn
      from app.recommendation r
      join app.company c on c.id = r.company_id
      left join app.team_brand_profile tbp
        on tbp.team_id = p_team and tbp.company_id = c.id
      join app.team_company tc
        on tc.company_id = r.company_id
       and tc.team_id = p_team
       and tc.role in ('own','competitor')
      where r.prompt_run_id = pg.pr_id
        and r.team_id = p_team
    ),
    flags as (
      select
        count(*)::bigint as f_total_count,
        bool_or(is_own) as own_mentioned,
        bool_or(is_own and rn <= 4) as own_already_in_preview
      from company_rows
    ),
    picked as (
      select cr.*
      from company_rows cr
      cross join flags f
      where
        (
          (coalesce(f.own_mentioned, false) = false
           or coalesce(f.own_already_in_preview, false) = true)
          and cr.rn <= 4
        )
        or
        (
          coalesce(f.own_mentioned, false) = true
          and coalesce(f.own_already_in_preview, false) = false
          and (cr.rn <= 3 or cr.is_own = true)
        )
    )
    select
      coalesce(f.f_total_count, 0)::bigint as total_count,
      (
        select jsonb_agg(
          jsonb_build_object(
            'company_id',     p.company_id,
            'name',           p.name,
            'favicon_url',    p.favicon_url,
            'rank',           p.rank,
            'brand_name_raw', p.brand_name_raw
          )
          order by
            case
              when coalesce(f.own_mentioned, false) = true
               and coalesce(f.own_already_in_preview, false) = false
               and p.is_own = true
              then 999999
              else p.rn
            end
        )
        from picked p
      ) as data
    from flags f
  ) companies on true

  left join lateral (
    with
    stage_urls as (
      select distinct scu.url
      from app.staged_citation_urls scu
      where scu.team_id = p_team
        and scu.run_key = pg.f_run_key
    ),
    stage_full as (
      select
        su.url,
        lower(su.domain) as domain,
        sd.favicon,
        su.title,
        row_number() over (order by su.url) as pos
      from stage_urls x
      left join app.source_url su on su.url = x.url
      left join app.source_domain sd on sd.domain = su.domain
    )
    select
      (select count(*)::bigint from stage_urls) as totalcount,
      (
        select jsonb_agg(
          jsonb_build_object(
            'url',     sf.url,
            'domain',  sf.domain,
            'title',   coalesce(sf.title, sf.domain),
            'favicon', sf.favicon,
            'pos',     sf.pos
          )
          order by sf.pos
        )
        from stage_full sf
        where sf.pos <= 5
      ) as data
  ) srcs_all on true;
end;
$function$;

CREATE OR REPLACE FUNCTION app._dash_responses_calc_v1(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_rows  jsonb;
  v_total bigint;
begin
  select coalesce(jsonb_agg(
           (x.j - 'matched_event_url_ids' - 'total_count' - 'ordinality')
           || jsonb_build_object(
                'own_mentioned', x.j->>'has_user_brand' = 'yes',
                'companies_preview', coalesce((
                   select jsonb_agg(case when e ? 'favicon_url'
                                         then e || jsonb_build_object('favicon_url', app._citations_abs_url_v1(e->>'favicon_url'))
                                         else e end order by o)
                   from jsonb_array_elements(coalesce(x.j->'companies_preview', '[]'::jsonb)) with ordinality t(e, o)), '[]'::jsonb),
                'sources_preview', coalesce((
                   select jsonb_agg(case when e ? 'favicon'
                                         then e || jsonb_build_object('favicon', app._citations_abs_url_v1(e->>'favicon'))
                                         else e end order by o)
                   from jsonb_array_elements(coalesce(x.j->'sources_preview', '[]'::jsonb)) with ordinality t(e, o)), '[]'::jsonb))
           order by x.o), '[]'::jsonb),
         max((x.j->>'total_count')::bigint)
    into v_rows, v_total
  from (
    select to_jsonb(t) as j, t.ordinality as o
    from app._dash_responses_base_v1(
      (p->>'team_id')::uuid,
      app._citations_jarr_uuid_v1(p->'tag_ids'),
      app._citations_jarr_text_v1(p->'markets'),
      app._citations_jarr_text_v1(p->'models'),
      coalesce((p->>'limit')::int, 100),
      coalesce((p->>'offset')::int, 0),
      p->>'order',
      p->>'mentioned',
      nullif(p->>'prompt_id', '')::uuid,
      (p->>'date_from')::date,
      (p->>'date_to')::date,
      nullif(p->>'domain', ''), nullif(p->>'url', ''), nullif(p->>'brand', '')::uuid,
      p->>'tagmode',
      app._citations_jarr_uuid_v1(p->'company_ids'),
      (p->>'sentiment_min')::smallint,
      (p->>'sentiment_max')::smallint,
      (p->>'rank_min')::int,
      (p->>'rank_max')::int,
      null::text,
      nullif(p->>'search', ''),
      null::uuid, null::uuid) with ordinality t
  ) x;

  return jsonb_build_object(
    'meta', (app._dash_meta_v1(p) - 'prev_from' - 'prev_to')
            || jsonb_build_object(
                 'filters', jsonb_build_object(
                   'models', p->'models', 'markets', p->'markets', 'tag_ids', p->'tag_ids', 'tagmode', p->'tagmode',
                   'mentioned', p->'mentioned', 'company_ids', p->'company_ids',
                   'sentiment_min', p->'sentiment_min', 'sentiment_max', p->'sentiment_max',
                   'rank_min', p->'rank_min', 'rank_max', p->'rank_max', 'search', p->'search',
                   'url', p->'url', 'domain', p->'domain', 'prompt_id', p->'prompt_id', 'brand', p->'brand'),
                 'total_count', coalesce(v_total, 0)),
    'rows', v_rows);
end;
$function$;

drop function app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid);
drop function app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text,uuid);
drop function app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,uuid);
drop function app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid);
drop function app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid);
drop function app.export_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer);
drop function app.export_citations_urls_v1(uuid,text,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer);

CREATE FUNCTION app.cached_dashboard_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_limit integer DEFAULT 15, p_offset integer DEFAULT 0, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text, p_prompt_id uuid DEFAULT NULL::uuid, p_brand uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_p      jsonb;
  v_full   jsonb;
  v_page   jsonb;
  v_order  text := lower(coalesce(nullif(btrim(p_order), ''), 'run_at_desc'));
  v_ment   text := lower(coalesce(nullif(btrim(p_mentioned), ''), 'all'));
  v_limit  int  := coalesce(p_limit, 15);
  v_offset int  := coalesce(p_offset, 0);
  v_search text := nullif(left(btrim(coalesce(p_search, '')), 200), '');
begin
  perform app._dash_rate_limit_v1('dashboard_responses', 60);
  perform app._dash_require_v1(p_team);
  v_p := app._dash_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode);
  -- 12.10.2026: auf einen Prompt einschraenken (Prompt-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Prompt gleich bleiben.
  if p_prompt_id is not null then
    v_p := v_p || jsonb_build_object('prompt_id', p_prompt_id);
  end if;
  -- 12.10.2026: Sicht einer Marke (Brand-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Marke gleich bleiben.
  if p_brand is not null then
    v_p := v_p || jsonb_build_object('brand', p_brand);
  end if;
  if v_order not in ('run_at_desc', 'run_at_asc', 'rank_asc', 'rank_desc', 'sentiment_asc', 'sentiment_desc') then
    raise exception 'dashboard_invalid_param' using errcode = '22023',
      hint = 'p_order: run_at_desc, run_at_asc, rank_asc, rank_desc, sentiment_asc, sentiment_desc';
  end if;
  if v_ment not in ('all', 'yes', 'no') then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_mentioned: all, yes, no';
  end if;
  if v_limit not between 1 and 100 then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_limit: 1-100';
  end if;
  if v_offset < 0 then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_offset: >= 0';
  end if;
  if p_sentiment_min not between 0 and 100 or p_sentiment_max not between 0 and 100
     or p_sentiment_min > p_sentiment_max then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_sentiment_min/p_sentiment_max: 0-100, min <= max';
  end if;
  if p_rank_min < 1 or p_rank_max < 1 or p_rank_min > p_rank_max then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_rank_min/p_rank_max: >= 1, min <= max';
  end if;
  v_p := v_p || jsonb_build_object(
    'order',         v_order,
    'mentioned',     v_ment,
    'company_ids',   coalesce(to_jsonb(app._citations_jarr_uuid_v1(to_jsonb(p_company_ids))), '[]'::jsonb),
    'sentiment_min', p_sentiment_min,
    'sentiment_max', p_sentiment_max,
    'rank_min',      p_rank_min,
    'rank_max',      p_rank_max,
    'search',        v_search);
  -- 12.10.2026: Antworten, die eine Adresse bzw. Domain zitieren (URL-/Domain-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel des Dashboards gleich bleiben.
  if nullif(btrim(coalesce(p_url, '')), '') is not null then
    if length(p_url) > 2048 then
      raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_url';
    end if;
    v_p := v_p || jsonb_build_object('url', coalesce(app._url_resolve_v1(p_team, p_url), btrim(p_url)));
  end if;
  if nullif(btrim(coalesce(p_domain, '')), '') is not null then
    if length(p_domain) > 255 then
      raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_domain';
    end if;
    v_p := v_p || jsonb_build_object('domain', lower(btrim(p_domain)));
  end if;

  -- gecacht werden die ersten 100 Zeilen; dahinter wird direkt gerechnet
  v_full := app._dash_cached_v1('dashboard_responses_v1', p_team, v_p, '_dash_responses_calc_v1');
  if v_offset + v_limit <= 100 then
    v_page := app._dash_slice_v1(v_full->'rows', v_limit, v_offset);
  else
    v_page := app._dash_responses_calc_v1(v_p || jsonb_build_object('limit', v_limit, 'offset', v_offset))->'rows';
  end if;
  return jsonb_build_object(
    'meta', (v_full->'meta') || jsonb_build_object('limit', v_limit, 'offset', v_offset, 'order', v_order),
    'rows', v_page);
end;
$function$;

CREATE FUNCTION app.export_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text, p_prompt_id uuid DEFAULT NULL::uuid, p_brand uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_p       jsonb;
  v_order   text := lower(coalesce(nullif(btrim(p_order), ''), 'run_at_desc'));
  v_ment    text := lower(coalesce(nullif(btrim(p_mentioned), ''), 'all'));
  v_search  text := nullif(left(btrim(coalesce(p_search, '')), 200), '');
  v_from    date;
  v_to      date;
  v_models  text[];
  v_markets text[];
  v_tags    uuid[];
  v_tagmode text;
  v_comp    uuid[];
  v_own     uuid;
  v_ownname text;
  v_brand_ok boolean := p_brand is null or exists (select 1 from app.team_company tcb
                                                   where tcb.team_id = p_team and tcb.company_id = p_brand);
  v_pref    boolean;
  v_total   bigint;
  v_rows    jsonb;
  v_url     text;
  v_domain  text;
begin
  perform app._pi_rate_limit_v1('export_responses', 60, 'exports');
  perform app._ex_require_v1(p_team, p_offset, p_limit, 2000);  -- volle Antworttexte: 1.000 Zeilen ~ 3 MB
  v_p := app._dash_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode);
  if v_order not in ('run_at_desc', 'run_at_asc', 'rank_asc', 'rank_desc', 'sentiment_asc', 'sentiment_desc') then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_order';
  end if;
  if v_ment not in ('all', 'yes', 'no') then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_mentioned: all, yes, no';
  end if;
  if p_sentiment_min not between 0 and 100 or p_sentiment_max not between 0 and 100 or p_sentiment_min > p_sentiment_max then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_sentiment_min/p_sentiment_max: 0-100, min <= max';
  end if;
  if p_rank_min < 1 or p_rank_max < 1 or p_rank_min > p_rank_max then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_rank_min/p_rank_max: >= 1, min <= max';
  end if;
  if cardinality(p_company_ids) > 200 then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_company_ids';
  end if;
  -- 12.10.2026: nur Antworten, die eine Adresse bzw. Domain zitieren (wie cached_dashboard_responses_v1)
  if nullif(btrim(coalesce(p_url, '')), '') is not null then
    if length(p_url) > 2048 then
      raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_url';
    end if;
    v_url := coalesce(app._url_resolve_v1(p_team, p_url), btrim(p_url));
  end if;
  if nullif(btrim(coalesce(p_domain, '')), '') is not null then
    if length(p_domain) > 255 then
      raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_domain';
    end if;
    v_domain := lower(btrim(p_domain));
  end if;

  v_from    := (v_p->>'date_from')::date;
  v_to      := (v_p->>'date_to')::date;
  v_models  := app._citations_jarr_text_v1(v_p->'models');
  v_markets := app._citations_jarr_text_v1(v_p->'markets');
  v_tags    := app._citations_jarr_uuid_v1(v_p->'tag_ids');
  v_tagmode := v_p->>'tagmode';
  v_comp    := coalesce(app._citations_jarr_uuid_v1(to_jsonb(p_company_ids)), '{}');
  v_pref    := p_sentiment_min is not null or p_sentiment_max is not null or p_rank_min is not null or p_rank_max is not null
               or v_order in ('sentiment_asc', 'sentiment_desc', 'rank_asc', 'rank_desc');

  select tc.company_id into v_own from app.team_company tc where tc.team_id = p_team and tc.role = 'own' limit 1;
  if v_own is not null then
    select coalesce(tbp.name_override, c.name) into v_ownname
    from app.company c left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = c.id
    where c.id = v_own limit 1;
  end if;

  perform set_config('jit', 'off', true);
  perform set_config('work_mem', '128MB', true);

  with comp_runs as materialized (
    select distinct r.prompt_run_id as run_id
    from app.recommendation r
    where cardinality(v_comp) > 0 and r.team_id = p_team and r.company_id = any(v_comp)
  ), f as materialized (
    select pr.id as pr_id, pr.run_at, pr.model, pr.prompt_id, pr.prompt_text, pr.run_key
    from app.prompt_run pr
    join app.prompt p on p.id = pr.prompt_id
    where pr.team_id = p_team
      and pr.run_day_berlin >= v_from and pr.run_day_berlin <= v_to
      and (v_search is null or pr.prompt_text ilike '%' || v_search || '%')
      and (v_ment = 'all'
           or (v_ment = 'yes' and pr.has_user_brand = true)
           or (v_ment = 'no' and coalesce(pr.has_user_brand, false) = false))
      and (v_models is null or pr.model = any(v_models))
      and (v_markets is null or p.market::text = any(v_markets))
      and (v_tags is null
           or (v_tagmode = 'or' and exists (select 1 from app.prompt_tag t where t.prompt_id = p.id and t.tag_id = any(v_tags)))
           or (v_tagmode = 'and' and (select count(distinct t.tag_id) from app.prompt_tag t
                                      where t.prompt_id = p.id and t.tag_id = any(v_tags)) = cardinality(v_tags)))
      and (cardinality(v_comp) = 0 or pr.id in (select cr.run_id from comp_runs cr))
      and (v_url is null or exists (select 1 from app.staged_citation_urls scu
                                    where scu.team_id = p_team and scu.run_key = pr.run_key and scu.url = v_url))
      and (v_domain is null or exists (select 1 from app.staged_citation_urls scu
                                       join app.source_url su on su.url = scu.url
                                       where scu.team_id = p_team and scu.run_key = pr.run_key and lower(su.domain) = v_domain))
      and (p_prompt_id is null or pr.prompt_id = p_prompt_id)
      -- 12.10.2026 (Brand-Drawer): nur Antworten, die die Marke nennen; nicht verfolgte Marke -> leer
      and (p_brand is null or (v_brand_ok and exists (select 1 from app.recommendation rb
                                                     where rb.prompt_run_id = pr.id and rb.team_id = p_team and rb.company_id = p_brand)))
  ), mr as materialized (
    select r.prompt_run_id, r.rank::int as rank, r.sentiment::smallint as sentiment,
           row_number() over (partition by r.prompt_run_id order by
             case when v_order = 'sentiment_asc'  then r.sentiment end asc nulls last,
             case when v_order = 'sentiment_desc' then r.sentiment end desc nulls last,
             case when v_order = 'rank_asc'       then r.rank end asc nulls last,
             case when v_order = 'rank_desc'      then r.rank end desc nulls last,
             r.rank asc nulls last, r.id asc) as rn
    from app.recommendation r
    where r.team_id = p_team
      and r.prompt_run_id in (select f.pr_id from f)
      and ((p_brand is not null and r.company_id = p_brand)
           or (p_brand is null and v_own is not null and r.company_id = v_own)
           or (p_brand is null and v_own is null and v_ownname is not null and r.company_id is null
               and lower(coalesce(r.brand_name_raw, '')) = lower(v_ownname)))
      and (p_sentiment_min is null or r.sentiment >= p_sentiment_min)
      and (p_sentiment_max is null or r.sentiment <= p_sentiment_max)
      and (p_rank_min is null or r.rank >= p_rank_min)
      and (p_rank_max is null or r.rank <= p_rank_max)
  ), x as (
    select f.*, m.rank, m.sentiment
    from f left join mr m on m.prompt_run_id = f.pr_id and m.rn = 1
    where not v_pref or m.prompt_run_id is not null
  ), n as materialized (
    select x.*, count(*) over () as total,
           row_number() over (order by
             case when v_order = 'sentiment_asc'  then x.sentiment end asc nulls last,
             case when v_order = 'sentiment_desc' then x.sentiment end desc nulls last,
             case when v_order = 'rank_asc'       then x.rank end asc nulls last,
             case when v_order = 'rank_desc'      then x.rank end desc nulls last,
             case when v_order = 'run_at_desc'    then x.run_at end desc,
             case when v_order = 'run_at_asc'     then x.run_at end asc,
             x.run_at desc, x.pr_id asc) as rn
    from x
  ), pg as (
    select n.* from n where n.rn > p_offset and n.rn <= p_offset + p_limit
  )
  select (select coalesce(max(n.total), 0) from n),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'prompt_run_id',   pg.pr_id,
                    'run_at',          pg.run_at,
                    'model',           pg.model::text,
                    'prompt_id',       pg.prompt_id,
                    'prompt_text',     app.csv_safe_v1(pg.prompt_text),
                    'user_rank',       pg.rank,
                    'user_sentiment',  pg.sentiment,
                    'has_user_brand',  case when coalesce(full_.has_user_brand, false) then 'yes' else 'no' end,
                    'own_mentioned',   coalesce(full_.has_user_brand, false),
                    'companies_count', coalesce(co.cnt, 0),
                    'companies',       app.csv_safe_v1(coalesce(co.names, '')),
                    'sources_count',   coalesce(so.cnt, 0),
                    'response_text',   app.csv_safe_v1(coalesce(full_.response_json->>'text', '')))
                  order by pg.rn)
           from pg
           join app.prompt_run full_ on full_.id = pg.pr_id
           left join lateral (
             select count(*)::int as cnt,
                    string_agg(coalesce(tbp.name_override, c.name, r.brand_name_raw), ', ' order by r.rank asc nulls last, r.id asc) as names
             from app.recommendation r
             join app.company c on c.id = r.company_id
             left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = c.id
             join app.team_company tc on tc.company_id = r.company_id and tc.team_id = p_team and tc.role in ('own', 'competitor')
             where r.prompt_run_id = pg.pr_id and r.team_id = p_team) co on true
           left join lateral (
             select count(distinct scu.url)::int as cnt
             from app.staged_citation_urls scu
             where scu.team_id = p_team and scu.run_key = pg.run_key) so on true), '[]'::jsonb)
    into v_total, v_rows;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'export',     'responses',
      'team_id',    p_team,
      'date_from',  v_from,
      'date_to',    v_to,
      'timezone',   'Europe/Berlin',
      'order',      v_order,
      'filters',    jsonb_build_object('models', v_p->'models', 'markets', v_p->'markets', 'tag_ids', v_p->'tag_ids',
                                       'tagmode', v_tagmode, 'mentioned', v_ment, 'company_ids', to_jsonb(v_comp),
                                       'sentiment_min', p_sentiment_min, 'sentiment_max', p_sentiment_max,
                                       'rank_min', p_rank_min, 'rank_max', p_rank_max, 'search', v_search,
                                       'url', v_url, 'domain', v_domain, 'prompt_id', p_prompt_id, 'brand', p_brand),
      'total_count', v_total,
      'offset',     p_offset,
      'limit',      p_limit,
      'has_more',   p_offset + p_limit < v_total,
      'generated_at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    'rows', v_rows);
end;
$function$;

CREATE FUNCTION app.cached_citations_overview_v1(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_mode text DEFAULT 'domain'::text, p_granularity text DEFAULT 'day'::text, p_series_limit integer DEFAULT 7, p_prompt_id uuid DEFAULT NULL::uuid, p_brand uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_p    jsonb;
  v_mode text := lower(coalesce(nullif(btrim(p_mode), ''), 'domain'));
  v_gran text := lower(coalesce(nullif(btrim(p_granularity), ''), 'day'));
begin
  perform app._citations_rate_limit_v1('citations_overview');
  perform app.require_team_access(p_team);
  v_p := app._citations_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode,
                                  p_mentioned, p_mentioned_brands, p_citation_types, p_url_types);
  -- 12.10.2026: auf einen Prompt einschraenken (Prompt-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Prompt gleich bleiben.
  if p_prompt_id is not null then
    v_p := v_p || jsonb_build_object('prompt_id', p_prompt_id);
  end if;
  -- 12.10.2026: Sicht einer Marke (Brand-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Marke gleich bleiben.
  if p_brand is not null then
    v_p := v_p || jsonb_build_object('brand', p_brand);
  end if;
  if v_mode not in ('domain', 'url') then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_mode';
  end if;
  if v_gran not in ('day', 'week', 'month') then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_granularity';
  end if;
  -- p_series_limit 0 (Dashboard v1): nur kpis und types, keine Serien und keine Zeitreihe
  if coalesce(p_series_limit, 7) not between 0 and 10 then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_series_limit';
  end if;
  v_p := v_p || jsonb_build_object('mode', v_mode, 'granularity', v_gran, 'series_limit', coalesce(p_series_limit, 7));
  return app._citations_f_cached_v1('citations_overview_v1', p_team, v_p, case when p_brand is null then '_citations_f_overview_calc_v1' else '_citations_fb_overview_calc_v1' end);
end;
$function$;

CREATE FUNCTION app.cached_citations_domains_v1(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT 'share_desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_prompt_id uuid DEFAULT NULL::uuid, p_brand uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_p      jsonb;
  v_order  text := lower(coalesce(nullif(btrim(p_order), ''), 'share_desc'));
  v_limit  int  := coalesce(p_limit, 25);
  v_offset int  := coalesce(p_offset, 0);
begin
  perform app._citations_rate_limit_v1('citations_domains');
  perform app.require_team_access(p_team);
  v_p := app._citations_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode,
                                  p_mentioned, p_mentioned_brands, p_citation_types, p_url_types);
  -- 12.10.2026: auf einen Prompt einschraenken (Prompt-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Prompt gleich bleiben.
  if p_prompt_id is not null then
    v_p := v_p || jsonb_build_object('prompt_id', p_prompt_id);
  end if;
  -- 12.10.2026: Sicht einer Marke (Brand-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Marke gleich bleiben.
  if p_brand is not null then
    v_p := v_p || jsonb_build_object('brand', p_brand);
  end if;
  if v_order not in ('share_desc', 'share_asc', 'share_delta_desc', 'share_delta_asc', 'last_used_desc', 'last_used_asc',
                     'domain_asc', 'domain_desc', 'urls_count_desc', 'urls_count_asc') then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_order';
  end if;
  if v_limit not between 1 and 100 then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_limit';
  end if;
  if v_offset < 0 then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_offset';
  end if;
  v_p := v_p || jsonb_build_object('search', left(nullif(btrim(p_search), ''), 200), 'order', v_order);
  if v_offset + v_limit <= 100 then  -- Cache haelt die ersten 100 Zeilen
    return app._citations_page_v1(
      app._citations_f_cached_v1('citations_domains_v1', p_team, v_p, case when p_brand is null then '_citations_g_domains_calc_v1' else '_citations_gb_domains_calc_v1' end), v_limit, v_offset);
  end if;
  if p_brand is not null then
    return app._citations_gb_domains_calc_v1(v_p || jsonb_build_object('_limit', v_limit, '_offset', v_offset));
  end if;
  return app._citations_g_domains_calc_v1(v_p || jsonb_build_object('_limit', v_limit, '_offset', v_offset));
end;
$function$;

CREATE FUNCTION app.cached_citations_urls_v1(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT 'share_desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_prompt_id uuid DEFAULT NULL::uuid, p_brand uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_p      jsonb;
  v_order  text := lower(coalesce(nullif(btrim(p_order), ''), 'share_desc'));
  v_limit  int  := coalesce(p_limit, 25);
  v_offset int  := coalesce(p_offset, 0);
begin
  perform app._citations_rate_limit_v1('citations_urls');
  perform app.require_team_access(p_team);
  v_p := app._citations_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode,
                                  p_mentioned, p_mentioned_brands, p_citation_types, p_url_types);
  -- 12.10.2026: auf einen Prompt einschraenken (Prompt-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Prompt gleich bleiben.
  if p_prompt_id is not null then
    v_p := v_p || jsonb_build_object('prompt_id', p_prompt_id);
  end if;
  -- 12.10.2026: Sicht einer Marke (Brand-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Marke gleich bleiben.
  if p_brand is not null then
    v_p := v_p || jsonb_build_object('brand', p_brand);
  end if;
  if v_order not in ('share_desc', 'share_asc', 'share_delta_desc', 'share_delta_asc', 'last_used_desc', 'last_used_asc',
                     'domain_asc', 'url_asc') then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_order';
  end if;
  if v_limit not between 1 and 100 then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_limit';
  end if;
  if v_offset < 0 then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_offset';
  end if;
  v_p := v_p || jsonb_build_object('search', left(nullif(btrim(p_search), ''), 200), 'order', v_order);
  if v_offset + v_limit <= 100 then  -- Cache haelt die ersten 100 Zeilen
    return app._citations_page_v1(
      app._citations_f_cached_v1('citations_urls_v1', p_team, v_p, case when p_brand is null then '_citations_g_urls_calc_v1' else '_citations_gb_urls_calc_v1' end), v_limit, v_offset);
  end if;
  if p_brand is not null then
    return app._citations_gb_urls_calc_v1(v_p || jsonb_build_object('_limit', v_limit, '_offset', v_offset));
  end if;
  return app._citations_g_urls_calc_v1(v_p || jsonb_build_object('_limit', v_limit, '_offset', v_offset));
end;
$function$;

CREATE FUNCTION app.export_citations_domains_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT 'share_desc'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 5000, p_brand uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_p     jsonb;
  v_order text := lower(coalesce(nullif(btrim(p_order), ''), 'share_desc'));
  v_res   jsonb;
  v_total bigint;
begin
  perform app._pi_rate_limit_v1('export_citations_domains', 60, 'exports');
  perform app._ex_require_v1(p_team, p_offset, p_limit, 10000);
  v_p := app._citations_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode,
                                  p_mentioned, p_mentioned_brands, p_citation_types, p_url_types);
  -- 12.10.2026: Sicht einer Marke (Brand-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Marke gleich bleiben.
  if p_brand is not null then
    v_p := v_p || jsonb_build_object('brand', p_brand);
  end if;
  if v_order not in ('share_desc', 'share_asc', 'share_delta_desc', 'share_delta_asc', 'last_used_desc', 'last_used_asc',
                     'domain_asc', 'domain_desc', 'urls_count_desc', 'urls_count_asc') then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_order';
  end if;
  v_p := v_p || jsonb_build_object('search', left(nullif(btrim(p_search), ''), 200), 'order', v_order,
                                   '_limit', p_limit, '_offset', p_offset);
  v_res := case when p_brand is null then app._citations_g_domains_calc_v1(v_p)
                else app._citations_gb_domains_calc_v1(v_p) end;
  v_total := coalesce((v_res->'meta'->>'total_count')::bigint, 0);
  return jsonb_build_object(
    'meta', (v_res->'meta') || jsonb_build_object('export', 'citations_domains', 'offset', p_offset, 'limit', p_limit,
                                                  'has_more', p_offset + p_limit < v_total),
    'rows', coalesce((select jsonb_agg(e || jsonb_build_object('domain', app.csv_safe_v1(e->>'domain')) order by o)
                      from jsonb_array_elements(v_res->'rows') with ordinality t(e, o)), '[]'::jsonb));
end;
$function$;

CREATE FUNCTION app.export_citations_urls_v1(p_team uuid DEFAULT NULL::uuid, p_domain text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 2000, p_brand uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_p     jsonb;
  v_dom   text := app._url_domain_norm(p_domain);
  v_order text;
  v_res   jsonb;
  v_total bigint;
begin
  perform app._pi_rate_limit_v1('export_citations_urls', 60, 'exports');
  perform app._ex_require_v1(p_team, p_offset, p_limit, 5000);
  if p_domain is not null and coalesce(v_dom, '') = '' then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_domain';
  end if;
  v_p := app._citations_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode,
                                  p_mentioned, p_mentioned_brands, p_citation_types, p_url_types);
  -- 12.10.2026: Sicht einer Marke (Brand-Drawer). Nur gesetzt, wenn angegeben,
  -- damit die Cache-Schluessel ohne Marke gleich bleiben.
  if p_brand is not null then
    v_p := v_p || jsonb_build_object('brand', p_brand);
  end if;
  if v_dom is null then
    v_order := lower(coalesce(nullif(btrim(p_order), ''), 'share_desc'));
    if v_order not in ('share_desc', 'share_asc', 'share_delta_desc', 'share_delta_asc', 'last_used_desc', 'last_used_asc',
                       'domain_asc', 'url_asc') then
      raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_order';
    end if;
    v_p := v_p || jsonb_build_object('search', left(nullif(btrim(p_search), ''), 200), 'order', v_order);
  else
    v_order := lower(coalesce(nullif(btrim(p_order), ''), 'domainshare_desc'));
    if v_order not in ('domainshare_desc', 'domainshare_asc', 'share_delta_desc', 'share_delta_asc', 'last_used_desc', 'url_asc') then
      raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_order';
    end if;
    v_p := v_p || jsonb_build_object('domain', v_dom, 'search', left(nullif(btrim(p_search), ''), 200), 'order', v_order);
  end if;
  v_res := case when p_brand is null
                then app._citations_g_urls_calc_v1(v_p || jsonb_build_object('_limit', p_limit, '_offset', p_offset))
                else app._citations_gb_urls_calc_v1(v_p || jsonb_build_object('_limit', p_limit, '_offset', p_offset)) end;
  v_total := coalesce((v_res->'meta'->>'total_count')::bigint, 0);
  return jsonb_build_object(
    'meta', (v_res->'meta') || jsonb_build_object('export', 'citations_urls', 'offset', p_offset, 'limit', p_limit,
                                                  'has_more', p_offset + p_limit < v_total),
    'rows', coalesce((
      select jsonb_agg(r.e || jsonb_build_object(
                         'url',          app.csv_safe_v1(r.e->>'url'),
                         'title',        app.csv_safe_v1(r.e->>'title'),
                         'domain',       app.csv_safe_v1(r.e->>'domain'),
                         'mentions_all', app.csv_safe_v1(coalesce(m.names, ''))) order by r.o)
      from jsonb_array_elements(v_res->'rows') with ordinality r(e, o)
      left join lateral (
        select string_agg(z.name, ', ' order by case when z.role = 'own' then 0 else 1 end, z.name, z.company_id) as names
        from (select distinct ucm.company_id, coalesce(tbp.name_override, c.name) as name, tc.role::text as role
              from app.url_company_mention ucm
              join app.team_company tc on tc.team_id = p_team and tc.company_id = ucm.company_id
              join app.company c on c.id = ucm.company_id
              left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = ucm.company_id
              where ucm.url = r.e->>'url' and ucm.team_id = p_team) z) m on true), '[]'::jsonb));
end;
$function$;

revoke all on function app._citations_brand_build_v1(jsonb), app._citations_fb_scope_v1(jsonb,jsonb), app._citations_fb_overview_calc_v1(jsonb), app._citations_gb_domains_calc_v1(jsonb), app._citations_gb_urls_calc_v1(jsonb), app._citations_gb_n_v1(uuid,uuid[],text[],date[],date[],date[],date,date), app._citations_gb_tiles_v1(uuid,date,date) from public, anon, authenticated;

grant execute on function app._citations_brand_build_v1(jsonb), app._citations_fb_scope_v1(jsonb,jsonb), app._citations_fb_overview_calc_v1(jsonb), app._citations_gb_domains_calc_v1(jsonb), app._citations_gb_urls_calc_v1(jsonb), app._citations_gb_n_v1(uuid,uuid[],text[],date[],date[],date[],date,date), app._citations_gb_tiles_v1(uuid,date,date) to service_role;

revoke all on function app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid,uuid), app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text,uuid,uuid), app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,uuid,uuid), app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid,uuid), app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid,uuid), app.export_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid), app.export_citations_urls_v1(uuid,text,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid), app.brand_detail_v1(uuid,uuid) from public, anon;

grant execute on function app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid,uuid), app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text,uuid,uuid), app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,uuid,uuid), app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid,uuid), app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid,uuid), app.export_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid), app.export_citations_urls_v1(uuid,text,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid), app.brand_detail_v1(uuid,uuid) to authenticated, service_role;

commit;

select to_regprocedure('app.brand_detail_v1(uuid,uuid)') is not null as brand_detail_da,
       to_regprocedure('app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid,uuid)') is not null as responses_mit_brand,
       to_regprocedure('app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid,uuid)') is not null as citations_urls_mit_brand,
       has_function_privilege('anon', 'app.brand_detail_v1(uuid,uuid)', 'execute') as anon_darf;
