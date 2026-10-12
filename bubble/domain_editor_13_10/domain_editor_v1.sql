-- domain_editor_v1.sql (13.10.2026): Domain-Drawer und Marken-Editor. Als EIN Block ausfuehren.
-- Rueckweg: domain_editor_v1_rueckweg.sql
-- Neu: domain_detail_v1, domain_detail_stats_v1, domain_url_share_v1, domain_classify_v1, brand_edit_v1,
-- brand_rename_v1, brand_alias_add_v1, brand_alias_set_v1, brand_alias_delete_v1, brand_color_set_v1, brand_log_v1.
-- brand_activity_log kennt weitere Aktionen (Name, Alias, Farbe, Domain). p_domain in Responses/Export wird normalisiert.

begin;

do $g$
begin
  if md5(pg_get_functiondef('app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid,uuid)'::regprocedure)) <> '344cf24aa787ceb3167f3a071d30e465'
     or md5(pg_get_functiondef('app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text,uuid,uuid)'::regprocedure)) <> 'a8c0b0789735bf0b42bff9223b414b81' then
    raise exception 'domain_editor_v1: Bestand weicht ab. Nichts geaendert.';
  end if;
  if to_regprocedure('app.domain_detail_v1(uuid,text)') is not null then
    raise exception 'domain_editor_v1: schon eingespielt. Nichts geaendert.';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'brand_activity_log_action_check' and conrelid = 'app.brand_activity_log'::regclass)) <> $c$CHECK ((action = ANY (ARRAY['add'::text, 'activate'::text, 'deactivate'::text, 'delete'::text])))$c$ then
    raise exception 'domain_editor_v1: Check von brand_activity_log weicht ab. Nichts geaendert.';
  end if;
end $g$;

alter table app.brand_activity_log drop constraint brand_activity_log_action_check;
alter table app.brand_activity_log add constraint brand_activity_log_action_check check (action = any (array['add', 'activate', 'deactivate', 'delete', 'rename', 'alias_add', 'alias_activate', 'alias_deactivate', 'alias_delete', 'color_set', 'color_reset', 'domain_own', 'domain_competitor', 'domain_auto']));

CREATE OR REPLACE FUNCTION app._domain_param_v1(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'app', 'pg_temp'
AS $function$
  -- 13.10.2026: Domain aus freier Eingabe (Adresse, Link, mit/ohne www.) -> normalisiert oder null
  select case when d is not null and char_length(d) <= 253 and d ~ '^[[:alnum:]_-]+(\.[[:alnum:]_-]+)+$' then d end
  from (select app._url_domain_norm(left(p, 2048)) as d) x
$function$;

CREATE OR REPLACE FUNCTION app._team_caches_clear_v1(p_team uuid, p_all boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Caches eines Teams leeren (nach Override, Name, Farbe). p_all: auch Dashboard.
begin
  delete from app.citations_cache where team_id = p_team;
  delete from app.rpc_cache where team_id = p_team;
  if p_all then
    delete from app.dashboard_cache where team_id = p_team;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION app._brand_log_v1(p_team uuid, p_action text, p_company uuid, p_details jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
  insert into app.brand_activity_log (team_id, user_id, action, n, company_ids, details)
  values (p_team, auth.uid(), p_action, 1, case when p_company is null then '{}'::uuid[] else array[p_company] end, p_details)
$function$;

CREATE OR REPLACE FUNCTION app._domain_detail_row_v1(p_team uuid, p_dom text, p_user_role text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
  with ov as (
    select o.role, o.created_at
    from app.team_domain_override o
    where o.team_id = p_team and regexp_replace(lower(o.domain), '^www\.', '') = p_dom
    limit 1
  ), br as (
    select tc.company_id, tc.role::text as role, coalesce(nullif(btrim(tbp.name_override), ''), c.name) as name
    from app.team_company tc
    join app.company c on c.id = tc.company_id
    left join app.team_brand_profile tbp on tbp.team_id = tc.team_id and tbp.company_id = tc.company_id
    where tc.team_id = p_team and app._url_domain_norm(c.url) = p_dom
    order by case tc.role::text when 'own' then 0 else 1 end, c.name
    limit 1
  ), sd as (
    select sd0.favicon, sd0.citation_type::text as ct
    from app.source_domain sd0
    where regexp_replace(lower(sd0.domain), '^www\.', '') = p_dom
    limit 1
  ), seen as (
    -- erster und letzter Tag ueber den Index, dort die genaue Zeit
    select (select min(d.first_used_at) from app.daily_citation_domain_rollup d
            where d.team_id = p_team and d.domain_norm = p_dom
              and d.day = (select min(d2.day) from app.daily_citation_domain_rollup d2
                           where d2.team_id = p_team and d2.domain_norm = p_dom)) as f,
           (select max(d.last_used_at) from app.daily_citation_domain_rollup d
            where d.team_id = p_team and d.domain_norm = p_dom
              and d.day = (select max(d2.day) from app.daily_citation_domain_rollup d2
                           where d2.team_id = p_team and d2.domain_norm = p_dom)) as l
  ), t as (
    select coalesce(case (select role from br) when 'own' then 'You' when 'competitor' then 'Competition' end,
                    (select ct from sd), 'Misc') as auto,
           (select role from ov) as ovr
  ), e as (
    select t.*, coalesce(case t.ovr when 'own' then 'You' when 'competitor' then 'Competition' end, t.auto) as eff from t
  )
  select jsonb_build_object(
    'domain',                   p_dom,
    'favicon_url',              (select case when app._citations_abs_url_v1(sd.favicon) like 'https://%'
                                             then app._citations_abs_url_v1(sd.favicon) end from sd),
    'citation_type',            e.eff,
    'citation_type_label',      app.citation_type_label(e.eff::app.citation_type),
    'citation_type_auto',       e.auto,
    'citation_type_auto_label', app.citation_type_label(e.auto::app.citation_type),
    'override',                 e.ovr,
    'override_set_at',          (select created_at from ov),
    'can_override',             coalesce(p_user_role in ('owner', 'admin'), false),
    'first_seen',               (select f from seen),
    'last_seen',                (select l from seen),
    'company',                  (select jsonb_build_object('company_id', br.company_id, 'name', br.name, 'role', br.role) from br))
  from e
$function$;

CREATE OR REPLACE FUNCTION app.domain_detail_v1(p_team uuid, p_domain text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Kopf des Domain-Drawers (ohne Zeitraum). Zahlen: domain_detail_stats_v1.
declare
  v_role  text;
  v_has   boolean;
  v_state text;
  v_dom   text;
begin
  v_role := app._set_require_v1(p_team);
  select a.has_access, a.access_state into v_has, v_state from app.team_access(p_team) a;
  if not coalesce(v_has, false) then
    raise exception 'team_access_%', coalesce(v_state, 'no_plan') using errcode = 'PT402', hint = coalesce(v_state, 'no_plan');
  end if;
  perform app._pi_rate_limit_v1('domain_detail', 120, 'domain');
  v_dom := app._domain_param_v1(p_domain);
  if v_dom is null then
    raise exception 'domain_not_found' using errcode = 'PT404', hint = 'p_domain';
  end if;
  return jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'domain', v_dom, 'data_as_of', now()),
    'row', app.js_safe(app._domain_detail_row_v1(p_team, v_dom, v_role)));
end;
$function$;

CREATE OR REPLACE FUNCTION app._domain_stats_calc_v1(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Zahlen des Domain-Drawers. Gleiche Kacheln und Nenner wie cached_citations_domains_v1,
-- damit current_citation_share = share_pct der Domain-Liste (in jedem Modus).
declare
  v_team    uuid   := (p->>'team_id')::uuid;
  v_dom     text   := p->>'domain';
  v_from    date   := (p->>'date_from')::date;
  v_to      date   := (p->>'date_to')::date;
  v_gran    text   := p->>'granularity';
  v_models  text[] := app._citations_jarr_text_v1(p->'models');
  v_prompts uuid[];
  v_days date[]; v_weeks date[]; v_months date[];
  v_pf date; v_pt date;
  v_n int; v_np int;
  v_runs int; v_used bigint; v_first timestamptz; v_last timestamptz;
  v_runs_p int; v_used_p bigint;
  v_share numeric; v_share_p numeric;
  v_ts jsonb; v_mb jsonb; v_tb jsonb; v_fun jsonb;
begin
  perform set_config('jit', 'off', true);
  v_pf := v_from - greatest(least((v_to - v_from + 1) / 2, 30), 1);
  v_pt := v_from - 1;
  v_prompts := app._citations_g_prompts_v1(p);
  select t.days, t.weeks, t.months into v_days, v_weeks, v_months from app._citations_g_tiles_v1(v_team, v_from, v_to) t;
  select x.n, x.n_prev into v_n, v_np from app._citations_g_n_v1(v_team, v_prompts, v_models, v_days, v_weeks, v_months, v_pf, v_pt) x;

  drop table if exists _ds_mod;
  create temp table _ds_mod on commit drop as
  select x.model, sum(x.runs_with_domain)::int as runs, sum(x.used_total)::bigint as used,
         min(x.first_used_at) as f, max(x.last_used_at) as l
  from (
    select d.model, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at from app.daily_citation_domain_rollup d
    where d.team_id = v_team and d.domain_norm = v_dom and d.day = any(v_days) and d.prompt_id = any(v_prompts)
      and (v_models is null or d.model = any(v_models))
    union all
    select d.model, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at from app.weekly_citation_domain_rollup d
    where d.team_id = v_team and d.domain_norm = v_dom and d.week_start = any(v_weeks) and d.prompt_id = any(v_prompts)
      and (v_models is null or d.model = any(v_models))
    union all
    select d.model, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at from app.monthly_citation_domain_rollup d
    where d.team_id = v_team and d.domain_norm = v_dom and d.month_start = any(v_months) and d.prompt_id = any(v_prompts)
      and (v_models is null or d.model = any(v_models))) x
  group by x.model;

  select coalesce(sum(runs), 0)::int, coalesce(sum(used), 0)::bigint, min(f), max(l)
    into v_runs, v_used, v_first, v_last from _ds_mod;
  select coalesce(sum(d.runs_with_domain), 0)::int, coalesce(sum(d.used_total), 0)::bigint into v_runs_p, v_used_p
  from app.daily_citation_domain_rollup d
  where d.team_id = v_team and d.domain_norm = v_dom and d.day between v_pf and v_pt and d.prompt_id = any(v_prompts)
    and (v_models is null or d.model = any(v_models));
  v_share   := coalesce(round(v_runs * 100.0 / nullif(v_n, 0), 2), 0);
  v_share_p := case when v_np > 0 then round(v_runs_p * 100.0 / v_np, 2) end;

  -- Modelle (Anteil an den Antworten mit dieser Domain, Summe 100)
  with r as (
    select m.model, m.runs, round(m.runs * 100.0 / nullif(sum(m.runs) over (), 0), 2) as s,
           row_number() over (order by m.runs desc, m.model) as rn
    from _ds_mod m where m.runs > 0
  ), a as (
    select r.*, case when r.rn = 1 then 100 - sum(r.s) over () + r.s else r.s end as s2 from r
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'model', a.model, 'model_label', coalesce(lmc.display_name, a.model), 'model_logo_url', lmc.logo_url,
           'color_lightmode', lmc.color_lightmode, 'color_darkmode', lmc.color_darkmode,
           'runs_with', a.runs, 'model_share_pct', a.s2) order by a.rn), '[]'::jsonb)
    into v_mb
  from a left join app.llm_model_catalog lmc on lmc.key = a.model;

  -- URLs der Domain (gleiche Kacheln)
  drop table if exists _ds_urls;
  create temp table _ds_urls on commit drop as
  select x.url, sum(x.runs_with_url)::int as runs, sum(x.used_total)::bigint as used
  from (
    select u.url, u.runs_with_url, u.used_total from app.daily_citation_url_rollup u
    where u.team_id = v_team and u.domain_norm = v_dom and u.day = any(v_days) and u.prompt_id = any(v_prompts)
      and (v_models is null or u.model = any(v_models))
    union all
    select u.url, u.runs_with_url, u.used_total from app.weekly_citation_url_rollup u
    where u.team_id = v_team and u.domain_norm = v_dom and u.week_start = any(v_weeks) and u.prompt_id = any(v_prompts)
      and (v_models is null or u.model = any(v_models))
    union all
    select u.url, u.runs_with_url, u.used_total from app.monthly_citation_url_rollup u
    where u.team_id = v_team and u.domain_norm = v_dom and u.month_start = any(v_months) and u.prompt_id = any(v_prompts)
      and (v_models is null or u.model = any(v_models))) x
  group by x.url;

  -- URL-Typen (Anteil an den Zitaten, Summe 100)
  with g as (
    select coalesce(st.url_type::text, 'uncategorized') as t, sum(u.used)::bigint as c
    from _ds_urls u left join app.source_url_type st on st.url = u.url
    group by 1
  ), r as (
    select g.t, g.c, round(g.c * 100.0 / nullif(sum(g.c) over (), 0), 2) as s,
           row_number() over (order by g.c desc, g.t) as rn from g where g.c > 0
  ), a as (
    select r.*, case when r.rn = 1 then 100 - sum(r.s) over () + r.s else r.s end as s2 from r
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'type', a.t, 'label', case when a.t = 'uncategorized' then null else app.url_type_label(a.t::app.url_type) end,
           'citations', a.c, 'share_pct', a.s2) order by a.rn), '[]'::jsonb)
    into v_tb from a;

  -- Source Funnel (Seiten, die eigene Marke / Wettbewerber erwaehnen)
  with f as (
    select u.url, coalesce(bool_or(tc.role::text = 'own'), false) as you,
           coalesce(bool_or(tc.role::text = 'competitor'), false) as comp
    from _ds_urls u
    left join app.url_company_mention ucm on ucm.url = u.url and ucm.team_id = v_team
    left join app.team_company tc on tc.team_id = v_team and tc.company_id = ucm.company_id
    group by u.url
  ), c as (
    select count(*)::int as n_urls,
           count(*) filter (where you or comp)::int as tracked,
           count(*) filter (where you)::int as you,
           count(*) filter (where comp)::int as comp,
           count(*) filter (where comp and not you)::int as comp_only,
           count(*) filter (where comp and you)::int as overlap,
           count(*) filter (where not you and not comp)::int as untracked
    from f
  )
  select jsonb_build_object(
           'ai_searches_citing_domain',   v_runs,
           'cited_urls_count',            c.n_urls,
           'urls_with_tracked_brands',    c.tracked,
           'urls_without_tracked_brands', c.untracked,
           'urls_mentioning_you',         c.you,
           'urls_mentioning_competitors', c.comp,
           'competitor_only_urls',        c.comp_only,
           'overlap_urls',                c.overlap,
           'tracked_brand_presence_pct',  coalesce(round(c.tracked * 100.0 / nullif(c.n_urls, 0), 2), 0),
           'your_url_presence_pct',       coalesce(round(c.you * 100.0 / nullif(c.n_urls, 0), 2), 0),
           'competitor_url_presence_pct', coalesce(round(c.comp * 100.0 / nullif(c.n_urls, 0), 2), 0),
           'competitor_only_share_pct',   coalesce(round(c.comp_only * 100.0 / nullif(c.n_urls, 0), 2), 0),
           'opportunity_gap_pct',         coalesce(round((c.comp - c.you) * 100.0 / nullif(c.n_urls, 0), 2), 0))
    into v_fun from c;

  -- Zeitreihe (Berliner Tage; angeschnittene Buckets mit bucket_from/bucket_to)
  with b as (
    select g::date as bucket,
           greatest(g::date, v_from) as bfrom,
           least(case v_gran when 'day' then g::date when 'week' then g::date + 6
                             else (g + interval '1 month - 1 day')::date end, v_to) as bto
    from generate_series(date_trunc(v_gran, v_from::timestamp), v_to::timestamp,
                         case v_gran when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end) g
  ), nb as (
    select b.bucket, coalesce(sum(r.runs_with_any_citation), 0)::int as n
    from b left join app.daily_citation_run_rollup r
      on r.team_id = v_team and r.day between b.bfrom and b.bto and r.prompt_id = any(v_prompts)
     and (v_models is null or r.model = any(v_models))
    group by b.bucket
  ), db as (
    select b.bucket, coalesce(sum(d.runs_with_domain), 0)::int as runs, coalesce(sum(d.used_total), 0)::int as used
    from b left join app.daily_citation_domain_rollup d
      on d.team_id = v_team and d.domain_norm = v_dom and d.day between b.bfrom and b.bto and d.prompt_id = any(v_prompts)
     and (v_models is null or d.model = any(v_models))
    group by b.bucket
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', b.bucket, 'bucket_from', b.bfrom, 'bucket_to', b.bto,
           'partial', (b.bfrom > b.bucket or b.bto < case v_gran when 'day' then b.bucket when 'week' then b.bucket + 6
                                                         else (b.bucket + interval '1 month - 1 day')::date end),
           'share_pct', case when nb.n > 0 then round(db.runs * 100.0 / nb.n, 2) end,
           'runs_with', db.runs, 'citations', db.used, 'runs_with_any', nb.n) order by b.bucket), '[]'::jsonb)
    into v_ts
  from b join nb on nb.bucket = b.bucket join db on db.bucket = b.bucket;

  return jsonb_build_object(
    'meta', app._citations_g_meta_v1(p, v_n, v_np, v_pf, v_pt, '{}') || jsonb_build_object('domain', v_dom, 'granularity', v_gran),
    'row', jsonb_build_object(
      'domain',                    v_dom,
      'current_citation_share',    v_share,
      'citation_share_prev',       v_share_p,
      'citation_share_delta_pct',  v_share - v_share_p,
      'runs_with_domain',          v_runs,
      'runs_with_domain_prev',     v_runs_p,
      'total_citations_count',     v_used,
      'total_citations_prev',      v_used_p,
      'total_citations_delta_pct', case when v_used_p > 0 then round((v_used - v_used_p) * 100.0 / v_used_p, 2) end,
      'first_used_at',             v_first,
      'last_used_at',              v_last,
      'timeseries',                v_ts,
      'model_breakdown',           v_mb,
      'types_breakdown',           v_tb,
      'source_presence_funnel',    v_fun));
end;
$function$;

CREATE OR REPLACE FUNCTION app.domain_detail_stats_v1(p_team uuid DEFAULT NULL::uuid, p_domain text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_granularity text DEFAULT 'day'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Domain Detail (Kurve, grosse Zahl, Funnel, Typen, Modelle). Gecacht wie Citations.
declare
  v_p    jsonb;
  v_dom  text := app._domain_param_v1(p_domain);
  v_gran text := lower(coalesce(nullif(btrim(p_granularity), ''), 'day'));
begin
  perform app._citations_rate_limit_v1('domain_stats');
  perform app.require_team_access(p_team);
  if v_dom is null then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_domain';
  end if;
  if v_gran not in ('day', 'week', 'month') then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_granularity';
  end if;
  v_p := app._citations_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode,
                                  'all', null, null, null)
         || jsonb_build_object('domain', v_dom, 'granularity', v_gran);
  return app._citations_f_cached_v1('domain_stats_v1', p_team, v_p, '_domain_stats_calc_v1');
end;
$function$;

CREATE OR REPLACE FUNCTION app._domain_url_share_calc_v1(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Anteil je URL einer Domain ueber die Zeit (Top N nach Antworten im Zeitraum).
declare
  v_team    uuid   := (p->>'team_id')::uuid;
  v_dom     text   := p->>'domain';
  v_from    date   := (p->>'date_from')::date;
  v_to      date   := (p->>'date_to')::date;
  v_gran    text   := p->>'granularity';
  v_top     int    := (p->>'top_n')::int;
  v_models  text[] := app._citations_jarr_text_v1(p->'models');
  v_prompts uuid[];
  v_days date[]; v_weeks date[]; v_months date[];
  v_pf date; v_pt date; v_n int; v_np int; v_dom_runs int;
  v_urls jsonb; v_rows jsonb;
begin
  perform set_config('jit', 'off', true);
  v_pf := v_from - greatest(least((v_to - v_from + 1) / 2, 30), 1);
  v_pt := v_from - 1;
  v_prompts := app._citations_g_prompts_v1(p);
  select t.days, t.weeks, t.months into v_days, v_weeks, v_months from app._citations_g_tiles_v1(v_team, v_from, v_to) t;
  select x.n, x.n_prev into v_n, v_np from app._citations_g_n_v1(v_team, v_prompts, v_models, v_days, v_weeks, v_months, v_pf, v_pt) x;

  select coalesce(sum(x.r), 0)::int into v_dom_runs from (
    select sum(d.runs_with_domain) r from app.daily_citation_domain_rollup d
    where d.team_id = v_team and d.domain_norm = v_dom and d.day = any(v_days) and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))
    union all
    select sum(d.runs_with_domain) from app.weekly_citation_domain_rollup d
    where d.team_id = v_team and d.domain_norm = v_dom and d.week_start = any(v_weeks) and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))
    union all
    select sum(d.runs_with_domain) from app.monthly_citation_domain_rollup d
    where d.team_id = v_team and d.domain_norm = v_dom and d.month_start = any(v_months) and d.prompt_id = any(v_prompts) and (v_models is null or d.model = any(v_models))) x;

  drop table if exists _dus_top;
  create temp table _dus_top on commit drop as
  select x.url, sum(x.runs_with_url)::int as runs
  from (
    select u.url, u.runs_with_url from app.daily_citation_url_rollup u
    where u.team_id = v_team and u.domain_norm = v_dom and u.day = any(v_days) and u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))
    union all
    select u.url, u.runs_with_url from app.weekly_citation_url_rollup u
    where u.team_id = v_team and u.domain_norm = v_dom and u.week_start = any(v_weeks) and u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))
    union all
    select u.url, u.runs_with_url from app.monthly_citation_url_rollup u
    where u.team_id = v_team and u.domain_norm = v_dom and u.month_start = any(v_months) and u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))) x
  group by x.url
  order by sum(x.runs_with_url) desc, x.url
  limit v_top;

  select coalesce(jsonb_agg(jsonb_build_object(
           'url', t.url,
           'title', case when ti.t <> '' then left(ti.t, 200) else v_dom end,
           'runs_with', t.runs,
           'share_total_pct', coalesce(round(t.runs * 100.0 / nullif(v_n, 0), 2), 0),
           'domain_share_total_pct', coalesce(round(t.runs * 100.0 / nullif(v_dom_runs, 0), 2), 0))
         order by t.runs desc, t.url), '[]'::jsonb)
    into v_urls
  from _dus_top t
  left join app.source_url su on su.url = t.url
  cross join lateral (select btrim(regexp_replace(coalesce(su.title, ''), '\s+', ' ', 'g')) as t) ti;

  -- Tageswerte der Top-URLs einmal holen (Index team_id, url, day)
  drop table if exists _dus_day;
  create temp table _dus_day on commit drop as
  select u.day, u.url, sum(u.runs_with_url)::int as runs
  from _dus_top t
  join app.daily_citation_url_rollup u on u.team_id = v_team and u.url = t.url and u.day between v_from and v_to
  where u.prompt_id = any(v_prompts) and (v_models is null or u.model = any(v_models))
  group by u.day, u.url;

  with b as (
    select g::date as bucket,
           greatest(g::date, v_from) as bfrom,
           least(case v_gran when 'day' then g::date when 'week' then g::date + 6
                             else (g + interval '1 month - 1 day')::date end, v_to) as bto
    from generate_series(date_trunc(v_gran, v_from::timestamp), v_to::timestamp,
                         case v_gran when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end) g
  ), nb as (
    select b.bucket, coalesce(sum(r.runs_with_any_citation), 0)::int as n
    from b left join app.daily_citation_run_rollup r
      on r.team_id = v_team and r.day between b.bfrom and b.bto and r.prompt_id = any(v_prompts)
     and (v_models is null or r.model = any(v_models))
    group by b.bucket
  ), db as (
    select b.bucket, coalesce(sum(d.runs_with_domain), 0)::int as runs
    from b left join app.daily_citation_domain_rollup d
      on d.team_id = v_team and d.domain_norm = v_dom and d.day between b.bfrom and b.bto and d.prompt_id = any(v_prompts)
     and (v_models is null or d.model = any(v_models))
    group by b.bucket
  ), ub as (
    select b.bucket, t.url, coalesce(sum(u.runs), 0)::int as runs
    from b cross join _dus_top t
    left join _dus_day u on u.url = t.url and u.day between b.bfrom and b.bto
    group by b.bucket, t.url
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', b.bucket, 'bucket_from', b.bfrom, 'bucket_to', b.bto, 'url', ub.url,
           'share_pct', case when nb.n > 0 then round(ub.runs * 100.0 / nb.n, 2) end,
           'domain_share_pct', case when db.runs > 0 then round(ub.runs * 100.0 / db.runs, 2) end,
           'runs_with', ub.runs) order by b.bucket, ub.url), '[]'::jsonb)
    into v_rows
  from b join nb on nb.bucket = b.bucket join db on db.bucket = b.bucket join ub on ub.bucket = b.bucket;

  return jsonb_build_object(
    'meta', app._citations_g_meta_v1(p, v_n, v_np, v_pf, v_pt, '{}')
            || jsonb_build_object('domain', v_dom, 'granularity', v_gran, 'top_n', v_top, 'runs_with_domain', v_dom_runs),
    'urls', v_urls,
    'rows', v_rows);
end;
$function$;

CREATE OR REPLACE FUNCTION app.domain_url_share_v1(p_team uuid DEFAULT NULL::uuid, p_domain text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_granularity text DEFAULT 'day'::text, p_top_n integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: URL Share im Domain-Drawer. Gecacht wie Citations.
declare
  v_p    jsonb;
  v_dom  text := app._domain_param_v1(p_domain);
  v_gran text := lower(coalesce(nullif(btrim(p_granularity), ''), 'day'));
begin
  perform app._citations_rate_limit_v1('domain_url_share');
  perform app.require_team_access(p_team);
  if v_dom is null then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_domain';
  end if;
  if v_gran not in ('day', 'week', 'month') then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_granularity';
  end if;
  if coalesce(p_top_n, 7) not between 1 and 10 then
    raise exception 'citations_invalid_param' using errcode = '22023', hint = 'p_top_n';
  end if;
  v_p := app._citations_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode,
                                  'all', null, null, null)
         || jsonb_build_object('domain', v_dom, 'granularity', v_gran, 'top_n', coalesce(p_top_n, 7));
  return app._citations_f_cached_v1('domain_url_share_v1', p_team, v_p, '_domain_url_share_calc_v1');
end;
$function$;

CREATE OR REPLACE FUNCTION app.domain_classify_v1(p_team uuid, p_domain text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: "Diese Domain zaehlt als ..." (own / competitor / null = Automatik). Nur owner/admin.
-- Wirkt nur fuer dieses Team und rueckwirkend (der Typ gilt beim Rechnen, nicht beim Speichern).
declare
  v_urole  text;
  v_has    boolean;
  v_state  text;
  v_dom    text;
  v_role   text := lower(nullif(btrim(coalesce(p_role, '')), ''));
  v_before text;
  v_name   text;
begin
  v_urole := app._set_require_v1(p_team);
  select a.has_access, a.access_state into v_has, v_state from app.team_access(p_team) a;
  if not coalesce(v_has, false) then
    raise exception 'team_access_%', coalesce(v_state, 'no_plan') using errcode = 'PT402', hint = coalesce(v_state, 'no_plan');
  end if;
  if v_urole not in ('owner', 'admin') then
    raise exception 'domain_classify_forbidden' using errcode = '42501', hint = 'owner,admin';
  end if;
  perform app._pi_rate_limit_v1('domain_classify', 30, 'domain_classify');
  v_dom := app._domain_param_v1(p_domain);
  if v_dom is null then
    raise exception 'domain_classify_invalid' using errcode = '22023', hint = 'domain';
  end if;
  if v_role is not null and v_role not in ('own', 'competitor') then
    raise exception 'domain_classify_invalid' using errcode = '22023', hint = 'role';
  end if;

  -- Widerspruch zu verfolgten Marken (deren Website-Domain). Overrides des Nutzers selbst zaehlen nicht.
  if v_role = 'own' then
    select coalesce(nullif(btrim(tbp.name_override), ''), c.name) into v_name
    from app.team_company tc join app.company c on c.id = tc.company_id
    left join app.team_brand_profile tbp on tbp.team_id = tc.team_id and tbp.company_id = tc.company_id
    where tc.team_id = p_team and tc.role::text = 'competitor' and app._url_domain_norm(c.url) = v_dom
    limit 1;
    if v_name is not null then
      raise exception 'domain_classify_invalid' using errcode = '22023', hint = 'tracked_competitor', detail = v_name;
    end if;
  elsif v_role = 'competitor' then
    select coalesce(nullif(btrim(tbp.name_override), ''), c.name) into v_name
    from app.team_company tc join app.company c on c.id = tc.company_id
    left join app.team_brand_profile tbp on tbp.team_id = tc.team_id and tbp.company_id = tc.company_id
    where tc.team_id = p_team and tc.role::text = 'own' and app._url_domain_norm(c.url) = v_dom
    limit 1;
    if v_name is not null then
      raise exception 'domain_classify_invalid' using errcode = '22023', hint = 'own_brand', detail = v_name;
    end if;
  end if;

  select o.role into v_before from app.team_domain_override o
  where o.team_id = p_team and regexp_replace(lower(o.domain), '^www\.', '') = v_dom
  for update;

  if v_role is distinct from v_before then
    if v_role is null then
      delete from app.team_domain_override o
      where o.team_id = p_team and regexp_replace(lower(o.domain), '^www\.', '') = v_dom;
    else
      if v_before is null and (select count(*) from app.team_domain_override o where o.team_id = p_team) >= 100 then
        raise exception 'domain_classify_invalid' using errcode = '22023', hint = 'limit', detail = '100';
      end if;
      insert into app.team_domain_override (team_id, domain, role, created_by)
      values (p_team, v_dom, v_role, auth.uid())
      on conflict (team_id, domain) do update set role = excluded.role, created_by = excluded.created_by, created_at = now();
    end if;
    perform app._brand_log_v1(p_team, 'domain_' || coalesce(v_role, 'auto'), null,
                              jsonb_build_object('domain', v_dom, 'before', v_before, 'after', v_role));
    perform app._team_caches_clear_v1(p_team, false);
  end if;

  return jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'domain', v_dom, 'changed', v_role is distinct from v_before, 'data_as_of', now()),
    'row', app.js_safe(app._domain_detail_row_v1(p_team, v_dom, v_urole)));
end;
$function$;

CREATE OR REPLACE FUNCTION app._brand_text_v1(p text, p_kind text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'app', 'pg_temp'
AS $function$
-- 13.10.2026: Name/Alias pruefen. NFKC, Leerraum zusammenfassen; abweisen statt still kuerzen.
-- p_kind 'name' -> brand_name_invalid, 'alias' -> brand_alias_invalid (hint = Grund).
declare
  v_err text := case when p_kind = 'name' then 'brand_name_invalid' else 'brand_alias_invalid' end;
  v     text;
  n     int;
begin
  if p is null then
    return null;
  end if;
  v := btrim(regexp_replace(normalize(p, NFKC), '\s+', ' ', 'g'));
  if v = '' then
    raise exception '%', v_err using errcode = '22023', hint = case when p_kind = 'name' then 'empty' else 'too_short' end;
  end if;
  -- Steuer- und unsichtbare Zeichen, Bidi, Variation Selectors, Tags, Emoji, Backtick/Backslash/${, Formel-Anfang
  if v ~ '[\u0001-\u001f\u007f-\u009f­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿￹-￻]'
     or v ~ '[\U000e0000-\U000e007f\U0001f000-\U0001faff☀-➿⬀-⯿]'
     or v ~ '[`\\]' or position('${' in v) > 0
     or v ~ '^[=+@-]' then
    raise exception '%', v_err using errcode = '22023', hint = 'characters';
  end if;
  n := char_length(v);
  if n > 60 then
    raise exception '%', v_err using errcode = '22023', hint = 'too_long';
  end if;
  if p_kind = 'alias' then
    if v !~ '[[:alpha:]]' then
      raise exception '%', v_err using errcode = '22023', hint = 'characters';
    end if;
    -- 2 Zeichen nur in Grossbuchstaben/Ziffern (VW, NH); 1 Zeichen nie
    if n < 2 or (n = 2 and v !~ '^[[:upper:][:digit:]]{2}$') then
      raise exception '%', v_err using errcode = '22023', hint = 'too_short';
    end if;
  end if;
  return v;
end;
$function$;

CREATE OR REPLACE FUNCTION app._brand_key_v1(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'app', 'pg_temp'
AS $function$
  -- Vergleichsschluessel: NFKC, klein, nur Buchstaben/Ziffern durch je ein Leerzeichen getrennt
  select btrim(regexp_replace(lower(normalize(coalesce(p, ''), NFKC)), '[^[:alnum:]]+', ' ', 'g'))
$function$;

CREATE OR REPLACE FUNCTION app._brand_taken_v1(p_team uuid, p_company uuid, p_text text, p_kind text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
  -- 13.10.2026: Gehoert der Text (Name oder Alias) schon einer anderen verfolgten Marke des Teams?
  -- Name: gleich Name/globaler Name/Alias einer anderen Marke. Alias: zusaetzlich, wenn er den Namen einer
  -- anderen Marke als ganze Woerter enthaelt ("BMW Mercedes Benz") oder darin steckt ("Mercedes" bei
  -- "Mercedes Benz"). Rueckgabe: Name der Marke.
  with o as (
    select tc.company_id, coalesce(nullif(btrim(tbp.name_override), ''), c.name) as name,
           array_remove(array[app._brand_key_v1(tbp.name_override), app._brand_key_v1(c.name)]
                        || coalesce((select array_agg(app._brand_key_v1(ca.pattern)) from app.company_alias ca
                                     where ca.team_id = p_team and ca.company_id = tc.company_id), '{}'), '') as keys,
           array_remove(array[app._brand_key_v1(tbp.name_override), app._brand_key_v1(c.name)], '') as name_keys
    from app.team_company tc
    join app.company c on c.id = tc.company_id
    left join app.team_brand_profile tbp on tbp.team_id = tc.team_id and tbp.company_id = tc.company_id
    where tc.team_id = p_team and tc.company_id <> p_company
  ), k as (select app._brand_key_v1(p_text) as key)
  select o.name
  from o, k
  where k.key <> ''
    and (k.key = any(o.keys)
         or (p_kind = 'alias' and exists (select 1 from unnest(o.name_keys) nk
                                          where char_length(nk) >= 2
                                            and ((' ' || k.key || ' ') like ('% ' || nk || ' %')
                                                 or (' ' || nk || ' ') like ('% ' || k.key || ' %')))))
  order by o.name
  limit 1
$function$;

CREATE OR REPLACE FUNCTION app._brand_edit_row_v1(p_team uuid, p_company uuid, p_user_role text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
  with tc as (
    select tc0.role::text as role, 'active'::text as status from app.team_company tc0
    where tc0.team_id = p_team and tc0.company_id = p_company
    union all
    select coalesce(a.role, 'competitor'), 'inactive' from app.team_competitor_archive a
    where a.team_id = p_team and a.company_id = p_company
      and not exists (select 1 from app.team_company x where x.team_id = p_team and x.company_id = p_company)
    limit 1
  )
  select jsonb_build_object(
    'meta', jsonb_build_object(
      'team_id', p_team, 'company_id', p_company,
      'can_edit', coalesce(p_user_role in ('owner', 'admin'), false) and (select status from tc) = 'active',
      'limits', jsonb_build_object('name_max', 60, 'alias_min', 2, 'alias_max', 60, 'aliases_max', 20),
      'data_as_of', now()),
    'row', app.js_safe(jsonb_build_object(
      'company_id',     c.id,
      'name',           coalesce(nullif(btrim(tbp.name_override), ''), c.name),
      'name_override',  nullif(btrim(tbp.name_override), ''),
      'global_name',    c.name,
      'domain',         app._url_domain_norm(c.url),
      'favicon_url',    case when app._citations_abs_url_v1(c.favicon_url) like 'https://%' then app._citations_abs_url_v1(c.favicon_url) end,
      'role',           (select role from tc),
      'status',         (select status from tc),
      'default_color',  c.default_color,
      'color_override', tcs.color_override,
      'effective_color', coalesce(tcs.color_override, c.default_color),
      'aliases', coalesce((select jsonb_agg(jsonb_build_object('alias_id', ca.id, 'pattern', ca.pattern,
                                                               'is_active', ca.is_active, 'created_at', ca.created_at)
                                            order by lower(ca.pattern), ca.id)
                           from app.company_alias ca where ca.team_id = p_team and ca.company_id = p_company), '[]'::jsonb),
      'tracking_periods', coalesce((select jsonb_agg(jsonb_build_object('started_at', tp.started_at, 'ended_at', tp.ended_at,
                                                                        'start_reason', tp.start_reason, 'end_reason', tp.end_reason)
                                                     order by tp.started_at desc)
                                    from app.team_company_tracking_period tp where tp.team_id = p_team and tp.company_id = p_company), '[]'::jsonb))))
  from app.company c
  left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = c.id
  left join lateral (select s.color_override from app.team_company_settings s
                     where s.team_id = p_team and s.company_id = c.id limit 1) tcs on true
  where c.id = p_company
$function$;

CREATE OR REPLACE FUNCTION app._brand_edit_require_v1(p_team uuid, p_company uuid, p_write boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: gemeinsame Pruefung des Marken-Editors. Rueckgabe: Rolle des Nutzers.
declare
  v_urole text;
  v_has   boolean;
  v_state text;
begin
  v_urole := app._set_require_v1(p_team);
  select a.has_access, a.access_state into v_has, v_state from app.team_access(p_team) a;
  if not coalesce(v_has, false) then
    raise exception 'team_access_%', coalesce(v_state, 'no_plan') using errcode = 'PT402', hint = coalesce(v_state, 'no_plan');
  end if;
  if p_write then
    if v_urole not in ('owner', 'admin') then
      raise exception 'brand_edit_forbidden' using errcode = '42501', hint = 'owner,admin';
    end if;
    perform app._pi_rate_limit_v1('brand_edit', 30, 'brand_edit');
  else
    perform app._pi_rate_limit_v1('brand_edit_read', 120, 'brand');
  end if;
  if p_company is null then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_company';
  end if;
  if not exists (select 1 from app.team_company tc where tc.team_id = p_team and tc.company_id = p_company) then
    if exists (select 1 from app.team_competitor_archive a where a.team_id = p_team and a.company_id = p_company) then
      if p_write then
        raise exception 'brand_edit_forbidden' using errcode = '42501', hint = 'inactive';
      end if;
    else
      raise exception 'brand_not_found' using errcode = 'PT404';
    end if;
  end if;
  return v_urole;
end;
$function$;

CREATE OR REPLACE FUNCTION app.brand_edit_v1(p_team uuid, p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Marken-Editor lesen (jedes Mitglied; can_edit nur owner/admin bei aktiver Marke).
declare
  v_urole text;
begin
  v_urole := app._brand_edit_require_v1(p_team, p_company, false);
  return app._brand_edit_row_v1(p_team, p_company, v_urole);
end;
$function$;

CREATE OR REPLACE FUNCTION app.brand_rename_v1(p_team uuid, p_company uuid, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Anzeigename im Team. null/leer = zurueck zum globalen Namen.
declare
  v_urole  text;
  v_name   text;
  v_global text;
  v_before text;
  v_taken  text;
begin
  v_urole := app._brand_edit_require_v1(p_team, p_company, true);
  select c.name into v_global from app.company c where c.id = p_company;
  select nullif(btrim(tbp.name_override), '') into v_before
  from app.team_brand_profile tbp where tbp.team_id = p_team and tbp.company_id = p_company for update;

  if nullif(btrim(coalesce(p_name, '')), '') is not null then
    v_name := app._brand_text_v1(p_name, 'name');
    v_taken := app._brand_taken_v1(p_team, p_company, v_name, 'name');
    if v_taken is not null then
      raise exception 'brand_name_invalid' using errcode = '22023', hint = 'taken', detail = v_taken;
    end if;
    if app._brand_key_v1(v_name) = app._brand_key_v1(v_global) and v_name = v_global then
      v_name := null;
    end if;
  end if;

  if v_name is distinct from v_before then
    insert into app.team_brand_profile (team_id, company_id, name_override)
    values (p_team, p_company, v_name)
    on conflict (team_id, company_id) do update set name_override = excluded.name_override, updated_at = now();
    perform app._brand_log_v1(p_team, 'rename', p_company, jsonb_build_object('before', coalesce(v_before, v_global), 'after', coalesce(v_name, v_global)));
    perform app._team_caches_clear_v1(p_team, true);
  end if;
  return app._brand_edit_row_v1(p_team, p_company, v_urole);
end;
$function$;

CREATE OR REPLACE FUNCTION app.brand_alias_add_v1(p_team uuid, p_company uuid, p_pattern text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Alias hinzufuegen. Gilt fuer kuenftige Laeufe. Gleicher Alias derselben Marke: keine Aenderung.
declare
  v_urole text;
  v_pat   text;
  v_taken text;
  v_n     int;
  v_id    uuid;
begin
  v_urole := app._brand_edit_require_v1(p_team, p_company, true);
  v_pat := app._brand_text_v1(coalesce(p_pattern, ''), 'alias');
  if exists (select 1 from app.company_alias ca where ca.team_id = p_team and ca.company_id = p_company
             and app._brand_key_v1(ca.pattern) = app._brand_key_v1(v_pat)) then
    return app._brand_edit_row_v1(p_team, p_company, v_urole);
  end if;
  if exists (select 1 from app.company c
             left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = c.id
             where c.id = p_company
               and app._brand_key_v1(v_pat) in (app._brand_key_v1(c.name), app._brand_key_v1(tbp.name_override))) then
    raise exception 'brand_alias_invalid' using errcode = '22023', hint = 'duplicate';
  end if;
  v_taken := app._brand_taken_v1(p_team, p_company, v_pat, 'alias');
  if v_taken is not null then
    raise exception 'brand_alias_invalid' using errcode = '22023', hint = 'collides', detail = v_taken;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('brand_alias|' || p_team::text || '|' || p_company::text, 0));
  select count(*) into v_n from app.company_alias ca where ca.team_id = p_team and ca.company_id = p_company;
  if v_n >= 20 then
    raise exception 'brand_alias_limit' using errcode = '22023', hint = '20';
  end if;
  insert into app.company_alias (team_id, company_id, pattern)
  values (p_team, p_company, v_pat)
  on conflict do nothing
  returning id into v_id;
  if v_id is not null then
    perform app._brand_log_v1(p_team, 'alias_add', p_company, jsonb_build_object('alias_id', v_id, 'alias', v_pat));
  end if;
  return app._brand_edit_row_v1(p_team, p_company, v_urole);
end;
$function$;

CREATE OR REPLACE FUNCTION app.brand_alias_set_v1(p_team uuid, p_company uuid, p_alias_id uuid, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Alias an/aus (Zielwert, nicht umdrehen; doppelte Klicks sind harmlos).
declare
  v_urole  text;
  v_pat    text;
  v_before boolean;
  v_taken  text;
begin
  v_urole := app._brand_edit_require_v1(p_team, p_company, true);
  if p_active is null then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_active';
  end if;
  select ca.pattern, ca.is_active into v_pat, v_before from app.company_alias ca
  where ca.id = p_alias_id and ca.team_id = p_team and ca.company_id = p_company
  for update;
  if not found then
    raise exception 'brand_alias_not_found' using errcode = 'PT404';
  end if;
  if p_active and not v_before then
    v_taken := app._brand_taken_v1(p_team, p_company, v_pat, 'alias');
    if v_taken is not null then
      raise exception 'brand_alias_invalid' using errcode = '22023', hint = 'collides', detail = v_taken;
    end if;
  end if;
  if p_active is distinct from v_before then
    update app.company_alias set is_active = p_active where id = p_alias_id;
    perform app._brand_log_v1(p_team, case when p_active then 'alias_activate' else 'alias_deactivate' end, p_company,
                              jsonb_build_object('alias_id', p_alias_id, 'alias', v_pat));
  end if;
  return app._brand_edit_row_v1(p_team, p_company, v_urole);
end;
$function$;

CREATE OR REPLACE FUNCTION app.brand_alias_delete_v1(p_team uuid, p_company uuid, p_alias_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Alias loeschen.
declare
  v_urole text;
  v_pat   text;
begin
  v_urole := app._brand_edit_require_v1(p_team, p_company, true);
  delete from app.company_alias ca
  where ca.id = p_alias_id and ca.team_id = p_team and ca.company_id = p_company
  returning ca.pattern into v_pat;
  if v_pat is null then
    raise exception 'brand_alias_not_found' using errcode = 'PT404';
  end if;
  perform app._brand_log_v1(p_team, 'alias_delete', p_company, jsonb_build_object('alias_id', p_alias_id, 'alias', v_pat));
  return app._brand_edit_row_v1(p_team, p_company, v_urole);
end;
$function$;

CREATE OR REPLACE FUNCTION app.brand_color_set_v1(p_team uuid, p_company uuid, p_color text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Markenfarbe im Team. null = zuruecksetzen. Nur #rrggbb (ohne # wird ergaenzt), gespeichert klein.
declare
  v_urole  text;
  v_color  text;
  v_before text;
begin
  v_urole := app._brand_edit_require_v1(p_team, p_company, true);
  if p_color is not null then
    if btrim(p_color) !~ '^#?[0-9A-Fa-f]{6}$' then
      raise exception 'brand_color_invalid' using errcode = '22023', hint = '#rrggbb';
    end if;
    v_color := '#' || lower(right(btrim(p_color), 6));
  end if;
  select lower(s.color_override) into v_before from app.team_company_settings s
  where s.team_id = p_team and s.company_id = p_company limit 1 for update;
  if v_color is distinct from v_before then
    update app.team_company_settings set color_override = v_color where team_id = p_team and company_id = p_company;
    if not found and v_color is not null then
      insert into app.team_company_settings (team_id, company_id, color_override) values (p_team, p_company, v_color);
    end if;
    perform app._brand_log_v1(p_team, case when v_color is null then 'color_reset' else 'color_set' end, p_company,
                              jsonb_build_object('before', v_before, 'after', v_color));
    perform app._team_caches_clear_v1(p_team, true);
  end if;
  return app._brand_edit_row_v1(p_team, p_company, v_urole);
end;
$function$;

CREATE OR REPLACE FUNCTION app.brand_log_v1(p_team uuid, p_limit integer DEFAULT 50, p_before text DEFAULT NULL::text, p_types text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Protokoll der Marken- und Domain-Aenderungen (wie team_log_v1). Nur owner/admin.
-- p_types: status, name, alias, color, domain (null = alle). Blaettern mit meta.next_before.
declare
  v_role   text;
  v_limit  int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_bts    timestamptz;
  v_bid    uuid;
  v_types  text[];
  v_acts   text[];
  v_rows   jsonb;
  v_more   boolean;
  v_next   text;
begin
  perform app._pi_rate_limit_v1('brand_log', 60, 'team');
  v_role := app._set_require_v1(p_team);
  if v_role not in ('owner', 'admin') then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner,admin';
  end if;
  if p_before is not null and btrim(p_before) <> '' then
    begin
      v_bts := split_part(p_before, '_', 1)::timestamptz;
      v_bid := split_part(p_before, '_', 2)::uuid;
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_before';
    end;
  end if;
  v_types := (select array_agg(distinct lower(btrim(t))) from unnest(p_types) t where nullif(btrim(t), '') is not null);
  if exists (select 1 from unnest(v_types) t where t not in ('status', 'name', 'alias', 'color', 'domain')) then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_types: status, name, alias, color, domain';
  end if;
  if v_types is not null then
    v_acts := array(select a from unnest(array['add','activate','deactivate','delete','rename','alias_add','alias_activate',
                                                'alias_deactivate','alias_delete','color_set','color_reset',
                                                'domain_own','domain_competitor','domain_auto']) a
                    where (case when a in ('add','activate','deactivate','delete') then 'status'
                                when a = 'rename' then 'name'
                                when a like 'alias_%' then 'alias'
                                when a like 'color_%' then 'color'
                                else 'domain' end) = any(v_types));
  end if;

  with page as (
    select l.*, row_number() over (order by l.created_at desc, l.id desc) as rn
    from (select * from app.brand_activity_log l0
          where l0.team_id = p_team
            and (v_acts is null or l0.action = any(v_acts))
            and (v_bts is null or (l0.created_at, l0.id) < (v_bts, v_bid))
          order by l0.created_at desc, l0.id desc
          limit v_limit + 1) l
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'log_id', p.id, 'created_at', p.created_at, 'action', p.action,
           'type', case when p.action in ('add','activate','deactivate','delete') then 'status'
                        when p.action = 'rename' then 'name'
                        when p.action like 'alias_%' then 'alias'
                        when p.action like 'color_%' then 'color'
                        else 'domain' end,
           'actor_user_id', p.user_id,
           'actor_email', (select lower(u.email::text) from auth.users u where u.id = p.user_id),
           'actor_display_name', case when p.user_id is null then null
                                      else coalesce(app._set_user_name_v1(p.user_id), 'deleted user') end,
           'by_system', p.user_id is null,
           'n', p.n,
           'companies', coalesce((select jsonb_agg(jsonb_build_object(
                                     'company_id', c.id, 'name', coalesce(nullif(btrim(tbp.name_override), ''), c.name),
                                     'favicon_url', app._citations_abs_url_v1(c.favicon_url)) order by c.name)
                                  from app.company c
                                  left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = c.id
                                  where c.id = any(p.company_ids)), '[]'::jsonb),
           'details', p.details)
         order by p.created_at desc, p.id desc) filter (where p.rn <= v_limit), '[]'::jsonb),
         bool_or(p.rn > v_limit),
         max(to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '_' || p.id::text) filter (where p.rn = v_limit)
    into v_rows, v_more, v_next
  from page p;

  return app.js_safe(jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'limit', v_limit, 'types', to_jsonb(v_types),
                               'available_types', jsonb_build_array('status', 'name', 'alias', 'color', 'domain'),
                               'next_before', case when coalesce(v_more, false) then v_next end),
    'rows', v_rows));
end;
$function$;

CREATE OR REPLACE FUNCTION app.cached_dashboard_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_limit integer DEFAULT 15, p_offset integer DEFAULT 0, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text, p_prompt_id uuid DEFAULT NULL::uuid, p_brand uuid DEFAULT NULL::uuid)
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
    -- 13.10.2026: Domain wie in Citations normalisieren (Schema, Pfad, www. weg)
    if app._domain_param_v1(p_domain) is null then
      raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_domain';
    end if;
    v_p := v_p || jsonb_build_object('domain', app._domain_param_v1(p_domain));
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

CREATE OR REPLACE FUNCTION app.export_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text, p_prompt_id uuid DEFAULT NULL::uuid, p_brand uuid DEFAULT NULL::uuid)
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
    -- 13.10.2026: Domain wie in Citations normalisieren (Schema, Pfad, www. weg)
    v_domain := app._domain_param_v1(p_domain);
    if v_domain is null then
      raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_domain';
    end if;
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

revoke all on function app._domain_param_v1(text), app._team_caches_clear_v1(uuid,boolean), app._brand_log_v1(uuid,text,uuid,jsonb), app._domain_detail_row_v1(uuid,text,text), app._domain_stats_calc_v1(jsonb), app._domain_url_share_calc_v1(jsonb), app._brand_text_v1(text,text), app._brand_key_v1(text), app._brand_taken_v1(uuid,uuid,text,text), app._brand_edit_row_v1(uuid,uuid,text), app._brand_edit_require_v1(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function app._domain_param_v1(text), app._team_caches_clear_v1(uuid,boolean), app._brand_log_v1(uuid,text,uuid,jsonb), app._domain_detail_row_v1(uuid,text,text), app._domain_stats_calc_v1(jsonb), app._domain_url_share_calc_v1(jsonb), app._brand_text_v1(text,text), app._brand_key_v1(text), app._brand_taken_v1(uuid,uuid,text,text), app._brand_edit_row_v1(uuid,uuid,text), app._brand_edit_require_v1(uuid,uuid,boolean) to service_role;
revoke all on function app.domain_detail_v1(uuid,text), app.domain_detail_stats_v1(uuid,text,date,date,text[],text[],uuid[],text,text), app.domain_url_share_v1(uuid,text,date,date,text[],text[],uuid[],text,text,integer), app.domain_classify_v1(uuid,text,text), app.brand_edit_v1(uuid,uuid), app.brand_rename_v1(uuid,uuid,text), app.brand_alias_add_v1(uuid,uuid,text), app.brand_alias_set_v1(uuid,uuid,uuid,boolean), app.brand_alias_delete_v1(uuid,uuid,uuid), app.brand_color_set_v1(uuid,uuid,text), app.brand_log_v1(uuid,integer,text,text[]) from public, anon;
grant execute on function app.domain_detail_v1(uuid,text), app.domain_detail_stats_v1(uuid,text,date,date,text[],text[],uuid[],text,text), app.domain_url_share_v1(uuid,text,date,date,text[],text[],uuid[],text,text,integer), app.domain_classify_v1(uuid,text,text), app.brand_edit_v1(uuid,uuid), app.brand_rename_v1(uuid,uuid,text), app.brand_alias_add_v1(uuid,uuid,text), app.brand_alias_set_v1(uuid,uuid,uuid,boolean), app.brand_alias_delete_v1(uuid,uuid,uuid), app.brand_color_set_v1(uuid,uuid,text), app.brand_log_v1(uuid,integer,text,text[]) to authenticated, service_role;

commit;

select to_regprocedure('app.domain_detail_v1(uuid,text)') is not null as domain_detail_da,
       to_regprocedure('app.brand_edit_v1(uuid,uuid)') is not null as brand_edit_da,
       has_function_privilege('anon', 'app.brand_rename_v1(uuid,uuid,text)', 'execute') as anon_darf;
