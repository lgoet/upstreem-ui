-- prompt_detail_v1_rueckweg.sql: macht prompt_detail_v1.sql rueckgaengig. Als EIN Block.
begin;

drop function if exists app.prompt_detail_v1(uuid,uuid);
drop function if exists app.cached_dashboard_visibility_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],integer,uuid);
drop function if exists app.cached_dashboard_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],uuid);
drop function if exists app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid);
drop function if exists app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,uuid);
drop function if exists app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid);
drop function if exists app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid);
drop function if exists app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text,uuid);

CREATE OR REPLACE FUNCTION app._dash_scope_v1(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_team     uuid   := (p->>'team_id')::uuid;
  v_from     date   := (p->>'date_from')::date;
  v_to       date   := (p->>'date_to')::date;
  v_markets  text[] := app._citations_jarr_text_v1(p->'markets');
  v_tags     uuid[] := app._citations_jarr_uuid_v1(p->'tag_ids');
  v_tagmode  text   := coalesce(p->>'tagmode', 'or');
  v_prev_len int;
begin
  perform set_config('jit', 'off', true);
  perform set_config('work_mem', '64MB', true);
  v_prev_len := greatest(least((v_to - v_from + 1) / 2, 30), 1);

  drop table if exists _dd_meta;
  create temp table _dd_meta on commit drop as
  select v_team as team_id, v_from as date_from, v_to as date_to,
         v_from - v_prev_len as prev_from, v_from - 1 as prev_to,
         (v_markets is not null or v_tags is not null) as has_pf,
         (select tc.company_id from app.team_company tc where tc.team_id = v_team and tc.role = 'own' limit 1) as own_company;

  drop table if exists _dd_prompts;
  create temp table _dd_prompts on commit drop as
  select p0.id from app.prompt p0
  where p0.team_id = v_team
    and (v_markets is null or p0.market::text = any(v_markets))
    and (v_tags is null
         or (v_tagmode = 'or' and exists (select 1 from app.prompt_tag pt where pt.prompt_id = p0.id and pt.tag_id = any(v_tags)))
         or (v_tagmode = 'and' and (select count(distinct pt.tag_id) from app.prompt_tag pt
                                    where pt.prompt_id = p0.id and pt.tag_id = any(v_tags)) = cardinality(v_tags)));
  create unique index on _dd_prompts (id);
  analyze _dd_prompts;

  drop table if exists _dd_comp;
  create temp table _dd_comp on commit drop as
  select tc.company_id, tc.role::text as role,
         coalesce(tbp.name_override, c.name) as name,
         app._citations_abs_url_v1(coalesce(tbp.logo_override_url, c.favicon_url)) as logo_url,
         coalesce(nullif(tcs.color_override, ''), nullif(c.default_color, '')) as color
  from app.team_company tc
  join app.company c on c.id = tc.company_id
  left join app.team_brand_profile tbp on tbp.team_id = v_team and tbp.company_id = tc.company_id
  left join app.team_company_settings tcs on tcs.team_id = v_team and tcs.company_id = tc.company_id
  where tc.team_id = v_team and tc.role in ('own', 'competitor');

  drop table if exists _dd_win;
  create temp table _dd_win on commit drop as
  with per as (
    select 'now'::text as per, v_from as f, v_to as t
    union all
    select 'prev'::text, v_from - v_prev_len, v_from - 1
  )
  select per.per, tp.company_id,
         greatest(per.f, (tp.started_at at time zone 'Europe/Berlin')::date) as wfrom,
         least(per.t, coalesce((tp.ended_at at time zone 'Europe/Berlin')::date, per.t)) as wto
  from per
  join app.team_company_tracking_period tp
    on tp.team_id = v_team
   and tp.company_id in (select company_id from _dd_comp)
   and (tp.ended_at is null or (tp.ended_at at time zone 'Europe/Berlin')::date >= per.f)
   and (tp.started_at at time zone 'Europe/Berlin')::date <= per.t
  union all
  select per.per, c.company_id, per.f, per.t
  from per cross join (select distinct company_id from _dd_comp) c
  where not exists (select 1 from app.team_company_tracking_period tp
                    where tp.team_id = v_team and tp.company_id = c.company_id);
end;
$function$;

CREATE OR REPLACE FUNCTION app._citations_f_scope_v1(p jsonb, p_need jsonb)
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
  where exists (select 1 from app.daily_citation_run_rollup r where r.team_id = v_team and r.day >= m and r.day < (m + interval '1 month')::date)
    and not exists (select 1 from app.monthly_citation_run_rollup mm where mm.team_id = v_team and mm.month_start = m);
  if cardinality(v_missing) > 0 then
    v_months := (select coalesce(array_agg(m), '{}') from unnest(v_months) m where m <> all(v_missing));
    v_days := v_days || (select coalesce(array_agg(g::date), '{}') from unnest(v_missing) m,
                         generate_series(m, (m + interval '1 month - 1 day')::date, interval '1 day') g);
  end if;
  select coalesce(array_agg(w), '{}') into v_missing from unnest(v_weeks) w
  where exists (select 1 from app.daily_citation_run_rollup r where r.team_id = v_team and r.day between w and w + 6)
    and not exists (select 1 from app.weekly_citation_run_rollup ww where ww.team_id = v_team and ww.week_start = w);
  if cardinality(v_missing) > 0 then
    v_weeks := (select coalesce(array_agg(w), '{}') from unnest(v_weeks) w where w <> all(v_missing));
    v_days := v_days || (select coalesce(array_agg(g::date), '{}') from unnest(v_missing) w,
                         generate_series(w, w + 6, interval '1 day') g);
  end if;

  v_t := app._citations_f_prof_v1('kacheln', v_t);

  -- Nenner
  select coalesce(sum(x.c), 0)::int into v_n from (
    select sum(r.runs_with_any_citation) c from app.daily_citation_run_rollup r join _cs_prompts pf on pf.id = r.prompt_id
    where r.team_id = v_team and r.day = any(v_days) and (v_models is null or r.model = any(v_models))
    union all
    select sum(r.runs_with_any_citation) from app.weekly_citation_run_rollup r join _cs_prompts pf on pf.id = r.prompt_id
    where r.team_id = v_team and r.week_start = any(v_weeks) and (v_models is null or r.model = any(v_models))
    union all
    select sum(r.runs_with_any_citation) from app.monthly_citation_run_rollup r join _cs_prompts pf on pf.id = r.prompt_id
    where r.team_id = v_team and r.month_start = any(v_months) and (v_models is null or r.model = any(v_models))) x;

  select coalesce(sum(r.runs_with_any_citation), 0)::int into v_n_prev
  from app.daily_citation_run_rollup r join _cs_prompts pf on pf.id = r.prompt_id
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
    from app.daily_citation_domain_rollup d join _cs_prompts pf on pf.id = d.prompt_id
    where d.team_id = v_team and d.day = any(v_days) and (v_models is null or d.model = any(v_models))
    union all
    select d.domain_norm, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at
    from app.weekly_citation_domain_rollup d join _cs_prompts pf on pf.id = d.prompt_id
    where d.team_id = v_team and d.week_start = any(v_weeks) and (v_models is null or d.model = any(v_models))
    union all
    select d.domain_norm, d.runs_with_domain, d.used_total, d.first_used_at, d.last_used_at
    from app.monthly_citation_domain_rollup d join _cs_prompts pf on pf.id = d.prompt_id
    where d.team_id = v_team and d.month_start = any(v_months) and (v_models is null or d.model = any(v_models))) x
  group by x.domain_norm;
  create unique index on _cs_dom_now (domain);
  analyze _cs_dom_now;
  v_t := app._citations_f_prof_v1('dom_now', v_t);

  drop table if exists _cs_dom_prev;
  create temp table _cs_dom_prev on commit drop as
  select d.domain_norm as domain, sum(d.runs_with_domain)::int as runs_with
  from app.daily_citation_domain_rollup d join _cs_prompts pf on pf.id = d.prompt_id
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
    from app.daily_citation_url_rollup u join _cs_prompts pf on pf.id = u.prompt_id
    where u.team_id = v_team and u.day = any(v_days) and (v_models is null or u.model = any(v_models))
    union all
    select u.url, u.domain_norm, u.runs_with_url, u.used_total, u.first_used_at, u.last_used_at
    from app.weekly_citation_url_rollup u join _cs_prompts pf on pf.id = u.prompt_id
    where u.team_id = v_team and u.week_start = any(v_weeks) and (v_models is null or u.model = any(v_models))
    union all
    select u.url, u.domain_norm, u.runs_with_url, u.used_total, u.first_used_at, u.last_used_at
    from app.monthly_citation_url_rollup u join _cs_prompts pf on pf.id = u.prompt_id
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
    from app.daily_citation_url_rollup u join _cs_prompts pf on pf.id = u.prompt_id
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
    join app.team_company tc on tc.team_id = v_team and tc.company_id = ucm.company_id and tc.role::text = 'own'
    where ucm.team_id = v_team;
  end if;
  v_t := app._citations_f_prof_v1('own', v_t);
end;
$function$;

CREATE OR REPLACE FUNCTION app._citations_g_prompts_v1(p jsonb)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
  select coalesce(array_agg(p0.id), '{}')
  from app.prompt p0
  where p0.team_id = (p->>'team_id')::uuid
    and (app._citations_jarr_text_v1(p->'markets') is null or p0.market::text = any(app._citations_jarr_text_v1(p->'markets')))
    and (app._citations_jarr_uuid_v1(p->'tag_ids') is null
         or (coalesce(p->>'tagmode', 'or') = 'or' and exists (
               select 1 from app.prompt_tag pt where pt.prompt_id = p0.id and pt.tag_id = any(app._citations_jarr_uuid_v1(p->'tag_ids'))))
         or (coalesce(p->>'tagmode', 'or') = 'and' and (
               select count(distinct pt.tag_id) from app.prompt_tag pt
               where pt.prompt_id = p0.id and pt.tag_id = any(app._citations_jarr_uuid_v1(p->'tag_ids')))
               = cardinality(app._citations_jarr_uuid_v1(p->'tag_ids'))))
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
      null::uuid,
      (p->>'date_from')::date,
      (p->>'date_to')::date,
      nullif(p->>'domain', ''), nullif(p->>'url', ''), null::uuid,
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
                   'url', p->'url', 'domain', p->'domain'),
                 'total_count', coalesce(v_total, 0)),
    'rows', v_rows);
end;
$function$;

CREATE OR REPLACE FUNCTION app.cached_dashboard_visibility_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_granularity text DEFAULT 'day'::text, p_companies uuid[] DEFAULT NULL::uuid[], p_series_limit integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_p    jsonb;
  v_gran text := lower(coalesce(nullif(btrim(p_granularity), ''), 'day'));
  v_comp uuid[] := app._citations_jarr_uuid_v1(to_jsonb(p_companies));
begin
  perform app._dash_rate_limit_v1('dashboard_visibility', 60);
  perform app._dash_require_v1(p_team);
  v_p := app._dash_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode);
  if v_gran not in ('day', 'week', 'month') then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_granularity: day, week, month';
  end if;
  if coalesce(p_series_limit, 7) not between 1 and 10 then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_series_limit: 1-10';
  end if;
  if coalesce(cardinality(v_comp), 0) > 10 then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_companies: hoechstens 10';
  end if;
  v_p := v_p || jsonb_build_object('granularity', v_gran, 'series_limit', coalesce(p_series_limit, 7),
                                   'companies', coalesce(to_jsonb(v_comp), '[]'::jsonb));
  return app._dash_cached_v1('dashboard_visibility_v1', p_team, v_p, '_dash_visibility_calc_v1');
end;
$function$;

CREATE OR REPLACE FUNCTION app.cached_dashboard_overview_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'visibility_desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text, p_companies uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_p      jsonb;
  v_full   jsonb;
  v_order  text := lower(coalesce(nullif(btrim(p_order), ''), 'visibility_desc'));
  v_limit  int  := coalesce(p_limit, 25);
  v_offset int  := coalesce(p_offset, 0);
  v_search text := nullif(left(btrim(coalesce(p_search, '')), 200), '');
begin
  perform app._dash_rate_limit_v1('dashboard_overview', 60);
  perform app._dash_require_v1(p_team);
  v_p := app._dash_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode);
  if v_order not in ('visibility_desc', 'visibility_asc', 'rank_asc', 'rank_desc', 'sentiment_desc', 'sentiment_asc',
                     'mentions_desc', 'mentions_asc', 'name_asc', 'name_desc') then
    raise exception 'dashboard_invalid_param' using errcode = '22023',
      hint = 'p_order: visibility_desc, visibility_asc, rank_asc, rank_desc, sentiment_desc, sentiment_asc, mentions_desc, mentions_asc, name_asc, name_desc';
  end if;
  if v_limit not between 1 and 100 then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_limit: 1-100';
  end if;
  if v_offset < 0 then
    raise exception 'dashboard_invalid_param' using errcode = '22023', hint = 'p_offset: >= 0';
  end if;
  v_p := v_p || jsonb_build_object(
    'order',     v_order,
    'search',    v_search,
    'companies', coalesce(to_jsonb(app._citations_jarr_uuid_v1(to_jsonb(p_companies))), '[]'::jsonb));
  v_full := app._dash_cached_v1('dashboard_overview_v1', p_team, v_p, '_dash_overview_calc_v1');
  return jsonb_build_object(
    'meta',  (v_full->'meta') || jsonb_build_object('limit', v_limit, 'offset', v_offset, 'order', v_order,
                                                     'search', v_search, 'companies', v_p->'companies'),
    'own',   v_full->'own',
    'field', v_full->'field',
    'rows',  app._dash_slice_v1(v_full->'rows', v_limit, v_offset));
end;
$function$;

CREATE OR REPLACE FUNCTION app.cached_dashboard_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_limit integer DEFAULT 15, p_offset integer DEFAULT 0, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text)
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

CREATE OR REPLACE FUNCTION app.cached_citations_overview_v1(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_mode text DEFAULT 'domain'::text, p_granularity text DEFAULT 'day'::text, p_series_limit integer DEFAULT 7)
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
  return app._citations_f_cached_v1('citations_overview_v1', p_team, v_p, '_citations_f_overview_calc_v1');
end;
$function$;

CREATE OR REPLACE FUNCTION app.cached_citations_domains_v1(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT 'share_desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
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
      app._citations_f_cached_v1('citations_domains_v1', p_team, v_p, '_citations_g_domains_calc_v1'), v_limit, v_offset);
  end if;
  return app._citations_g_domains_calc_v1(v_p || jsonb_build_object('_limit', v_limit, '_offset', v_offset));
end;
$function$;

CREATE OR REPLACE FUNCTION app.cached_citations_urls_v1(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT 'share_desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
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
      app._citations_f_cached_v1('citations_urls_v1', p_team, v_p, '_citations_g_urls_calc_v1'), v_limit, v_offset);
  end if;
  return app._citations_g_urls_calc_v1(v_p || jsonb_build_object('_limit', v_limit, '_offset', v_offset));
end;
$function$;

CREATE OR REPLACE FUNCTION app.export_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text)
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
      and ((v_own is not null and r.company_id = v_own)
           or (v_own is null and v_ownname is not null and r.company_id is null
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
                                       'url', v_url, 'domain', v_domain),
      'total_count', v_total,
      'offset',     p_offset,
      'limit',      p_limit,
      'has_more',   p_offset + p_limit < v_total,
      'generated_at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    'rows', v_rows);
end;
$function$;

revoke all on function
  app.cached_dashboard_visibility_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],integer),
  app.cached_dashboard_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[]),
  app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text),
  app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer),
  app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer),
  app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer),
  app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text)
  from public, anon;
grant execute on function
  app.cached_dashboard_visibility_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],integer),
  app.cached_dashboard_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[]),
  app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text),
  app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer),
  app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer),
  app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer),
  app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text)
  to authenticated, service_role;

-- Cache-Eintraege mit prompt_id (nur von der neuen Fassung angelegt)
delete from app.dashboard_cache where params ? 'prompt_id';

commit;

select md5(pg_get_functiondef('app._dash_scope_v1(jsonb)'::regprocedure)) = '55db09d3a34956c62c01bee7fb883df3' as "_dash_scope_v1",
       md5(pg_get_functiondef('app._citations_f_scope_v1(jsonb,jsonb)'::regprocedure)) = 'e5d97fafaf0955d3a2d55f01cda7a6f7' as "_citations_f_scope_v1",
       md5(pg_get_functiondef('app._citations_g_prompts_v1(jsonb)'::regprocedure)) = 'd7fd6f0f327142d7c3cf15234259f858' as "_citations_g_prompts_v1",
       md5(pg_get_functiondef('app._dash_responses_calc_v1(jsonb)'::regprocedure)) = 'e91d956839d9c9f3a8fa27dc4a855ce2' as "_dash_responses_calc_v1",
       md5(pg_get_functiondef('app.cached_dashboard_visibility_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],integer)'::regprocedure)) = 'c02a5a51f0ad992a0e2bf84020a15393' as "cached_dashboard_visibility_v1",
       md5(pg_get_functiondef('app.cached_dashboard_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[])'::regprocedure)) = '5ab5c61de27387cf74e831ea501c3ac0' as "cached_dashboard_overview_v1",
       md5(pg_get_functiondef('app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text)'::regprocedure)) = '3b1f3faa5403a4fb4a34d37b46a92960' as "cached_dashboard_responses_v1",
       md5(pg_get_functiondef('app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer)'::regprocedure)) = '175487b14dd703b9f9248dc9bd9cc9c3' as "cached_citations_overview_v1",
       md5(pg_get_functiondef('app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer)'::regprocedure)) = '2338392e8c68cb00d632a17671c3ab7a' as "cached_citations_domains_v1",
       md5(pg_get_functiondef('app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer)'::regprocedure)) = '0ff43f463b8d00d13ccf4b2b46b3d75b' as "cached_citations_urls_v1",
       md5(pg_get_functiondef('app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text)'::regprocedure)) = '3609175a31b3da66f6dc2832636075f4' as "export_responses_v1";
