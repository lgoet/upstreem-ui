-- url_detail_v1.sql (12.10.2026): URL Detail als selbstladender Drawer
-- Als EIN Block im Supabase SQL Editor ausfuehren. Rueckweg: url_detail_v1_rueckweg.sql
-- A. neu: url_detail_v1(p_team, p_url, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode) -> {meta, row}
-- B. cached_dashboard_responses_v1: + p_url, p_domain (am Ende, optional). Bisherige Aufrufe unveraendert.
-- C. export_responses_v1: + p_url, p_domain (am Ende, optional). Bisherige Aufrufe unveraendert.
-- get_url_bundle_v7 bleibt (Bubble).

begin;

do $g$
begin
  if to_regprocedure('app.url_detail_v1(uuid,text,date,date,text[],text[],uuid[],text)') is not null then
    raise exception 'url_detail_v1: gibt es schon. Nichts geaendert.';
  end if;
  if md5(pg_get_functiondef('app._dash_responses_calc_v1(jsonb)'::regprocedure)) <> 'aba13f0ade1ecb15e4f4872f59bcf9c5'
     or md5(pg_get_functiondef('app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text)'::regprocedure)) <> 'f74f20dbc7e9598764799800632e7784'
     or md5(pg_get_functiondef('app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer)'::regprocedure)) <> '4b8532b038050962b364c69370b7e08d'
     or md5(pg_get_functiondef('app.get_url_bundle_v7(uuid,text,text[],date,date,uuid[],text,text[])'::regprocedure)) <> 'b4c37f60f8aec35bb4d2f913e1a148fb' then
    raise exception 'url_detail_v1: Bestand weicht vom gelesenen Stand ab. Nichts geaendert.';
  end if;
end $g$;

-- Helfer
-- Schreibweisen einer Adresse: mit/ohne Schema (https, http), mit/ohne www., mit/ohne / am Ende, ohne Raute.
create function app._url_variants_v1(p_url text)
 returns text[] language plpgsql immutable
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  s    text := btrim(coalesce(p_url, ''));
  core text;
  h    text;
  pth  text;
begin
  if s = '' then
    return '{}'::text[];
  end if;
  s    := regexp_replace(s, '#.*$', '');
  core := regexp_replace(s, '^[a-zA-Z][a-zA-Z0-9+.-]*://', '');
  h    := split_part(core, '/', 1);
  pth  := substr(core, length(h) + 1);
  h    := regexp_replace(lower(h), '^www\.', '');
  pth  := regexp_replace(pth, '/+$', '');
  if h = '' then
    return array[btrim(p_url)];
  end if;
  return array(
    select distinct x from (
      select btrim(p_url) as x
      union all select s
      union all
      select sch || w || h || pth || sl
      from unnest(array['https://', 'http://']) sch,
           unnest(array['', 'www.']) w,
           unnest(array['', '/']) sl
    ) z where x <> '');
end;
$f$;

-- Adresse so finden, wie das Team sie zitiert hat. Erst exakt, sonst die Schreibweise mit den meisten Laeufen.
-- null = das Team hat die Adresse nie zitiert.
create function app._url_resolve_v1(p_team uuid, p_url text)
 returns text language plpgsql stable security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_url  text := btrim(coalesce(p_url, ''));
  v_vars text[];
  v      text;
begin
  if v_url = '' then
    return null;
  end if;
  if exists (select 1 from app.daily_citation_url_rollup r where r.team_id = p_team and r.url = v_url)
     or exists (select 1 from app.staged_citation_urls s where s.team_id = p_team and s.url = v_url) then
    return v_url;
  end if;
  v_vars := app._url_variants_v1(v_url);
  select r.url into v
  from app.daily_citation_url_rollup r
  where r.team_id = p_team and r.url = any(v_vars)
  group by r.url
  order by sum(r.runs_with_url) desc, r.url
  limit 1;
  if v is null then
    select s.url into v from app.staged_citation_urls s
    where s.team_id = p_team and s.url = any(v_vars)
    order by s.url limit 1;
  end if;
  return v;
end;
$f$;

-- Gaengige HTML-Entities zu Klartext
create function app._html_decode_v1(p text)
 returns text language sql immutable
 set search_path to 'app', 'public', 'pg_temp'
as $f$
  select replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
           p, '&nbsp;', ' '), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#34;', '"'),
           '&#39;', ''''), '&#039;', ''''), '&#x27;', ''''), '&apos;', ''''), '&hellip;', '…'), '&amp;', '&')
$f$;

-- Kennzahlen und Conversion (Rechnung aus get_url_bundle_v7, ohne Auth/Ratenlimit, nur intern)
CREATE FUNCTION app._url_metrics_v1(p_team uuid, p_url text, p_models text[] DEFAULT NULL::text[], p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_markets text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_from date := coalesce(p_date_from, current_date - 29);
  v_to   date := coalesce(p_date_to, current_date);
  v_tagmode text := lower(coalesce(nullif(trim(p_tagmode), ''), 'or'));
  v_cutoff  date;
  v_months  date[] := '{}'::date[];
  v_weeks   date[] := '{}'::date[];
  v_days    date[] := '{}'::date[];
  v_missing date[] := '{}'::date[];
begin
  -- intern (url_detail_v1): Pruefungen macht der Aufrufer
  if v_to < v_from then
    raise exception 'invalid date range';
  end if;
  if v_tagmode not in ('or', 'and') then
    raise exception 'invalid tagmode';
  end if;

  ----------------------------------------------------------------------------
  -- Tiling: volle Monate -> monthly, volle Restwochen -> weekly, Rest -> daily
  ----------------------------------------------------------------------------
  v_cutoff := current_date - 2;

  with dd as (
    select generate_series(v_from, v_to, interval '1 day')::date as d
  ),
  cls as (
    select d,
           date_trunc('month', d)::date                                 as ms,
           (date_trunc('month', d) + interval '1 month - 1 day')::date  as me,
           date_trunc('week', d)::date                                  as ws,
           (date_trunc('week', d)::date + 6)                            as we
    from dd
  ),
  t1 as (
    select d, ms, ws,
           (ms >= v_from and me <= v_to and me <= v_cutoff) as is_m,
           (ws >= v_from and we <= v_to and we <= v_cutoff) as is_w_cand
    from cls
  ),
  t as (
    select d, ms, ws, is_m,
           (is_w_cand and not bool_or(is_m) over (partition by ws)) as is_w
    from t1
  )
  select coalesce(array_agg(distinct ms) filter (where is_m),  '{}'::date[]),
         coalesce(array_agg(distinct ws) filter (where is_w),  '{}'::date[]),
         coalesce(array_agg(d) filter (where not is_m and not is_w), '{}'::date[])
    into v_months, v_weeks, v_days
  from t;

  select coalesce(array_agg(m), '{}'::date[]) into v_missing
  from unnest(v_months) m
  where exists (select 1 from app.daily_citation_run_rollup r
                where r.team_id = p_team
                  and r.day >= m and r.day < (m + interval '1 month')::date)
    and not exists (select 1 from app.monthly_citation_run_rollup mm
                    where mm.team_id = p_team and mm.month_start = m);
  if cardinality(v_missing) > 0 then
    v_months := (select coalesce(array_agg(m), '{}'::date[]) from unnest(v_months) m
                 where m <> all(v_missing));
    v_days := v_days || (
      select coalesce(array_agg(g::date), '{}'::date[])
      from unnest(v_missing) m,
           generate_series(m, (m + interval '1 month - 1 day')::date, interval '1 day') g);
  end if;

  select coalesce(array_agg(w), '{}'::date[]) into v_missing
  from unnest(v_weeks) w
  where exists (select 1 from app.daily_citation_run_rollup r
                where r.team_id = p_team and r.day between w and w + 6)
    and not exists (select 1 from app.weekly_citation_run_rollup ww
                    where ww.team_id = p_team and ww.week_start = w);
  if cardinality(v_missing) > 0 then
    v_weeks := (select coalesce(array_agg(w), '{}'::date[]) from unnest(v_weeks) w
                where w <> all(v_missing));
    v_days := v_days || (
      select coalesce(array_agg(g::date), '{}'::date[])
      from unnest(v_missing) w,
           generate_series(w, w + 6, interval '1 day') g);
  end if;

  return app.js_safe((
    with

    prompt_filter as materialized (
      select p.id
      from app.prompt p
      where p.team_id = p_team
        and (p_markets is null or cardinality(p_markets) = 0 or p.market::text = any(p_markets))
        and (
          p_tag_ids is null or cardinality(p_tag_ids) = 0
          or (
            v_tagmode = 'or'
            and exists (
              select 1 from app.prompt_tag pt
              where pt.prompt_id = p.id and pt.tag_id = any(p_tag_ids)
            )
          )
          or (
            v_tagmode = 'and'
            and (
              select count(distinct pt.tag_id)
              from app.prompt_tag pt
              where pt.prompt_id = p.id and pt.tag_id = any(p_tag_ids)
            ) = cardinality(p_tag_ids)
          )
        )
    ),

    url_meta as materialized (
      select
        su.url,
        su.domain,
        su.favicon,
        su.last_seen,
        coalesce(tus.last_scraped_at, su.last_seen) as last_seen_team,
        su.markdown_summary::text as markdown_summary,
        su.url_type::text as url_type,
        case
          when nullif(btrim(regexp_replace(coalesce(su.title,''), '\s+', ' ', 'g')), '') is null
           and nullif(btrim(regexp_replace(coalesce(su.description,''), '\s+', ' ', 'g')), '') is null
          then lower(su.domain)
          when nullif(btrim(regexp_replace(coalesce(su.title,''), '\s+', ' ', 'g')), '') is null
          then left(btrim(regexp_replace(coalesce(su.description,''), '\s+', ' ', 'g')), 100)
          else left(btrim(regexp_replace(su.title, '\s+', ' ', 'g')), 100)
        end as title,
        left(btrim(regexp_replace(coalesce(su.description,''), '\s+', ' ', 'g')), 5000) as description,
        case
          when su.url is null
          then regexp_replace(lower(coalesce(nullif(regexp_replace(p_url,'^[a-z]+://([^/]+).*','\1'),''), p_url)),'^www\.','')
          when nullif(btrim(regexp_replace(coalesce(su.title,''), '\s+', ' ', 'g')), '') is null
           and nullif(btrim(regexp_replace(coalesce(su.description,''), '\s+', ' ', 'g')), '') is null
          then regexp_replace(lower(su.domain),'^www\.','')
          when nullif(btrim(regexp_replace(coalesce(su.title,''), '\s+', ' ', 'g')), '') is null
          then left(btrim(regexp_replace(coalesce(su.description,''), '\s+', ' ', 'g')), 100)
          else left(btrim(regexp_replace(su.title, '\s+', ' ', 'g')), 100)
        end as title_conv
      from (select 1) x
      left join app.source_url su on su.url = p_url
      left join app.team_url_state tus on tus.team_id = p_team and tus.url = p_url
    ),

    dom_norm as (
      select regexp_replace(lower(coalesce(nullif(um.domain,''), nullif(regexp_replace(p_url,'^[a-z]+://([^/]+).*','\1'),''))), '^www\.', '') as domain_l
      from url_meta um
    ),

    team_companies as (
      select tc.role,
        regexp_replace(lower(nullif(regexp_replace(coalesce(c.url,''),'^[a-z]+://([^/]+).*','\1'),'')),'^www\.','') as company_domain
      from app.team_company tc
      join app.company c on c.id = tc.company_id
      where tc.team_id = p_team
    ),
    own_domains  as (select company_domain from team_companies where role='own'        and company_domain is not null),
    comp_domains as (select company_domain from team_companies where role='competitor' and company_domain is not null),
    tdo as (
      select regexp_replace(lower(t.domain),'^www\.','') as domain, t.role
      from app.team_domain_override t where t.team_id = p_team
    ),
    dom_source as (
      select sd.citation_type
      from app.source_domain sd
      where regexp_replace(lower(sd.domain),'^www\.','') = (select domain_l from dom_norm)
      limit 1
    ),
    effective_type as (
      select case
        when exists (select 1 from tdo t where t.domain=(select domain_l from dom_norm) and t.role='own')        then 'You'::app.citation_type
        when exists (select 1 from tdo t where t.domain=(select domain_l from dom_norm) and t.role='competitor') then 'Competition'::app.citation_type
        when exists (select 1 from own_domains  od where od.company_domain=(select domain_l from dom_norm))      then 'You'::app.citation_type
        when exists (select 1 from comp_domains cd where cd.company_domain=(select domain_l from dom_norm))      then 'Competition'::app.citation_type
        else (select citation_type from dom_source)
      end as eff_type
    ),

    url_companies as materialized (
      select
        ucm.company_id,
        tc.role::text                                      as role,
        coalesce(tbp.name_override, c.name)               as company_name,
        coalesce(tbp.logo_override_url, c.favicon_url)    as logo_url
      from app.url_company_mention ucm
      join app.team_company tc  on tc.company_id=ucm.company_id and tc.team_id=p_team and tc.role in ('own','competitor')
      join app.company c        on c.id=ucm.company_id
      left join app.team_brand_profile tbp on tbp.team_id=p_team and tbp.company_id=ucm.company_id
      where ucm.url = p_url and (ucm.team_id is null or ucm.team_id = p_team)
      group by ucm.company_id, tc.role, company_name, logo_url
    ),

    runs_with_any_now as (
      select coalesce(sum(x.runs_with_any_citation),0)::int as cnt
      from (
      select r.runs_with_any_citation
      from app.daily_citation_run_rollup r
      join prompt_filter pf on pf.id = r.prompt_id
      where r.team_id = p_team and r.day = any(v_days)
        and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
      union all
      select r.runs_with_any_citation
      from app.weekly_citation_run_rollup r
      join prompt_filter pf on pf.id = r.prompt_id
      where r.team_id = p_team and r.week_start = any(v_weeks)
        and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
      union all
      select r.runs_with_any_citation
      from app.monthly_citation_run_rollup r
      join prompt_filter pf on pf.id = r.prompt_id
      where r.team_id = p_team and r.month_start = any(v_months)
        and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
      ) x
    ),
    domain_denoms_now as (
      select sum(x.runs_with_domain)::int as runs_with_domain_now
      from (
      select d.runs_with_domain
      from app.daily_citation_domain_rollup d
      join prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = p_team and d.day = any(v_days)
        and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
        and d.domain_norm = (select domain_l from dom_norm)
      union all
      select d.runs_with_domain
      from app.weekly_citation_domain_rollup d
      join prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = p_team and d.week_start = any(v_weeks)
        and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
        and d.domain_norm = (select domain_l from dom_norm)
      union all
      select d.runs_with_domain
      from app.monthly_citation_domain_rollup d
      join prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = p_team and d.month_start = any(v_months)
        and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
        and d.domain_norm = (select domain_l from dom_norm)
      ) x
    ),
    all_urls_ranked as materialized (
      select
        x.url,
        regexp_replace(lower(x.domain_norm), '^www\.', '') as domain_l,
        sum(x.runs_with_url)::int as total_runs
      from (
      select u2.url, u2.domain_norm, u2.runs_with_url
      from app.daily_citation_url_rollup u2
      join prompt_filter pf on pf.id = u2.prompt_id
      where u2.team_id = p_team and u2.day = any(v_days)
        and (p_models is null or cardinality(p_models) = 0 or u2.model = any(p_models))
      union all
      select u2.url, u2.domain_norm, u2.runs_with_url
      from app.weekly_citation_url_rollup u2
      join prompt_filter pf on pf.id = u2.prompt_id
      where u2.team_id = p_team and u2.week_start = any(v_weeks)
        and (p_models is null or cardinality(p_models) = 0 or u2.model = any(p_models))
      union all
      select u2.url, u2.domain_norm, u2.runs_with_url
      from app.monthly_citation_url_rollup u2
      join prompt_filter pf on pf.id = u2.prompt_id
      where u2.team_id = p_team and u2.month_start = any(v_months)
        and (p_models is null or cardinality(p_models) = 0 or u2.model = any(p_models))
      ) x
      group by x.url, x.domain_norm
    ),
    url_this_url as (
      select coalesce(sum(a.total_runs), 0)::int as runs_with_url_now
      from all_urls_ranked a
      where a.url = p_url
    ),
    global_rank_calc as (
      select (
        select count(*)::int + 1
        from all_urls_ranked agg
        where
          agg.total_runs > (select runs_with_url_now from url_this_url)
          or (
            agg.total_runs = (select runs_with_url_now from url_this_url)
            and (
              agg.domain_l < (select regexp_replace(lower(coalesce(um.domain,'')),'^www\.','') from url_meta um limit 1)
              or (
                agg.domain_l = (select regexp_replace(lower(coalesce(um.domain,'')),'^www\.','') from url_meta um limit 1)
                and agg.url < p_url
              )
            )
          )
      ) as global_rank
    ),
    shares_rank as (
      select
        p_url                                       as url,
        (select domain_l from dom_norm)             as domain,
        (select runs_with_url_now from url_this_url) as runs_with_url_now,
        (select runs_with_domain_now from domain_denoms_now) as runs_with_domain_now,
        (select cnt from runs_with_any_now)         as runs_with_any_now,
        case when (select runs_with_domain_now from domain_denoms_now) > 0
          then round(((select runs_with_url_now from url_this_url)::numeric * 100.0)
               / (select runs_with_domain_now from domain_denoms_now), 2)
          else 0 end as domainshare_pct,
        case when (select cnt from runs_with_any_now) > 0
          then round(((select runs_with_url_now from url_this_url)::numeric * 100.0)
               / (select cnt from runs_with_any_now), 2)
          else 0 end as global_share_pct,
        (select global_rank from global_rank_calc)  as global_rank
    ),

    cited_total as materialized (
      select coalesce(sum(a.total_runs), 0)::bigint as cited_runs
      from all_urls_ranked a
      where a.url = p_url
    ),
    runs_cited as materialized (
      select distinct pr.id as run_id
      from app.staged_citation_urls scu
      join app.prompt_run pr
        on pr.team_id = p_team
       and pr.run_key = scu.run_key
       and pr.run_day_berlin between v_from and v_to
       and (p_models is null or cardinality(p_models) = 0 or pr.model = any(p_models))
      join prompt_filter pf on pf.id = pr.prompt_id
      where scu.team_id = p_team
        and scu.url = p_url
    ),
    company_mentions as materialized (
      select
        uc.company_id,
        count(distinct r.prompt_run_id)::bigint as mentioned_runs
      from url_companies uc
      join runs_cited rc on true
      join app.recommendation r
        on r.team_id = p_team
       and r.company_id = uc.company_id
       and r.prompt_run_id = rc.run_id
      group by uc.company_id
    ),

    url_companies_agg as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'company_id',   uc.company_id,
            'company_name', coalesce(uc.company_name, ''),
            'logo_url',     coalesce(uc.logo_url, '')
          ) order by uc.company_name
        ) filter (where uc.company_id is not null),
        '[]'::jsonb
      ) as companies_json
      from url_companies uc
    )

    select jsonb_build_object(

      'url_detailed', (
        select jsonb_build_object(
          'url',              coalesce(um.url, p_url),
          'domain',           regexp_replace(lower(coalesce(um.domain,'')),'^www\.',''),
          'favicon',          coalesce(um.favicon, ''),
          'citation_type',    coalesce((select eff_type from effective_type)::text, ''),
          'title',            coalesce(um.title, ''),
          'description',      coalesce(um.description, ''),
          'first_seen',       null::timestamptz,
          'last_seen',        coalesce(to_jsonb(um.last_seen_team), '""'::jsonb),
          'domain_share',     coalesce(sr.domainshare_pct, 0),
          'global_share',     coalesce(sr.global_share_pct, 0),
          'global_rank',      coalesce(sr.global_rank, 0),
          'cited_runs',       coalesce(sr.runs_with_url_now, 0),
          'markdown_summary', coalesce(um.markdown_summary, ''),
          'url_type',         coalesce(um.url_type, ''),
          'companies',        (select companies_json from url_companies_agg)
        )
        from url_meta um
        left join shares_rank sr on true
        limit 1
      ),

      'conversion', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'url',                    p_url,
            'domain',                 coalesce((select domain_l from dom_norm), ''),
            'title',                  coalesce((select title_conv from url_meta), ''),
            'company_id',             uc.company_id,
            'company_name',           coalesce(uc.company_name, ''),
            'logo_url',               coalesce(uc.logo_url, ''),
            'role',                   coalesce(uc.role, ''),
            'cited_runs',             (select cited_runs from cited_total),
            'mentioned_runs',         coalesce(cm.mentioned_runs, 0),
            'citation_conversion_pct',
              case when (select cited_runs from cited_total) > 0
                then round((coalesce(cm.mentioned_runs,0)::numeric * 100.0) / (select cited_runs from cited_total), 2)
                else 0 end
          )
          order by
            case when (select cited_runs from cited_total) > 0
              then round((coalesce(cm.mentioned_runs,0)::numeric * 100.0) / (select cited_runs from cited_total), 2)
              else 0 end desc,
            coalesce(cm.mentioned_runs, 0) desc,
            uc.company_name asc
        )
        from url_companies uc
        left join company_mentions cm on cm.company_id = uc.company_id
      ), '[]'::jsonb)

    )
  ));
end;
$function$;

-- A. url_detail_v1
create function app.url_detail_v1(
  p_team uuid, p_url text, p_date_from date default null, p_date_to date default null,
  p_models text[] default null, p_markets text[] default null, p_tag_ids uuid[] default null, p_tagmode text default 'or')
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_has     boolean;
  v_state   text;
  v_p       jsonb;
  v_url     text;
  v_m       jsonb;
  v_d       jsonb;
  v_cited   int;
  v_in      boolean;
  v_first   timestamptz;
  v_last    timestamptz;
  v_scraped timestamptz;
  v_sum     text;
  v_brands  jsonb;
  v_conv    jsonb;
begin
  perform app._set_require_v1(p_team);
  select a.has_access, a.access_state into v_has, v_state from app.team_access(p_team) a;
  if not coalesce(v_has, false) then
    raise exception 'team_access_%', coalesce(v_state, 'no_plan') using errcode = 'PT402', hint = coalesce(v_state, 'no_plan');
  end if;
  perform app._pi_rate_limit_v1('url_detail', 120, 'url');
  if p_url is null or btrim(p_url) = '' or length(p_url) > 2048 then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_url';
  end if;
  v_p := app._dash_params_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_tagmode);

  -- nur Adressen, die das Team je zitiert hat (sonst wuerde die globale Quellen-Tabelle fremde Zitate verraten)
  v_url := app._url_resolve_v1(p_team, p_url);
  if v_url is null then
    raise exception 'url_not_found' using errcode = 'PT404';
  end if;

  -- zuerst / zuletzt vom Team zitiert (ganze Historie)
  select min(r.first_used_at), max(r.last_used_at) into v_first, v_last
  from app.daily_citation_url_rollup r where r.team_id = p_team and r.url = v_url;
  if v_last is null then
    select min(s.created_at), max(s.created_at) into v_first, v_last
    from app.staged_citation_urls s where s.team_id = p_team and s.url = v_url;
  end if;
  select tus.last_scraped_at into v_scraped from app.team_url_state tus where tus.team_id = p_team and tus.url = v_url;
  select nullif(btrim(su.markdown_summary->>'summary'), '') into v_sum from app.source_url su where su.url = v_url;

  -- Kennzahlen und Conversion fuer Zeitraum und Filter (Rechnung wie get_url_bundle_v7).
  -- Ist die Adresse im Zeitraum gar nicht zitiert, wird die teure Rechnung uebersprungen.
  if exists (select 1 from app.daily_citation_url_rollup r
             where r.team_id = p_team and r.url = v_url
               and r.day between (v_p->>'date_from')::date and (v_p->>'date_to')::date) then
    v_m := app._url_metrics_v1(p_team, v_url,
             app._citations_jarr_text_v1(v_p->'models'), (v_p->>'date_from')::date, (v_p->>'date_to')::date,
             app._citations_jarr_uuid_v1(v_p->'tag_ids'), v_p->>'tagmode', app._citations_jarr_text_v1(v_p->'markets'));
  else
    -- nur Kopf (Titel, Domain, Typ) ohne Kennzahlen: ein Tag ohne Daten
    v_m := app._url_metrics_v1(p_team, v_url, null, current_date + 1, current_date + 1, null, 'or', null);
  end if;
  v_d     := v_m->'url_detailed';
  v_cited := coalesce((v_d->>'cited_runs')::int, 0);
  v_in    := v_cited > 0;

  -- Marken auf der Seite (nur getrackte), Logo-Regel, eigene zuerst
  with b as (
    select distinct on (c.id)
           c.id as company_id,
           coalesce(nullif(tbp.name_override, ''), c.name) as name,
           tc.role::text as role,
           case when tc.role = 'own'
                then coalesce(nullif(case when tbp.logo_override_url like '//%' then 'https:' || tbp.logo_override_url
                                          else tbp.logo_override_url end, ''), c.favicon_url)
                else c.favicon_url end as logo_url,
           c.favicon_url
    from app.url_company_mention ucm
    join app.team_company tc on tc.company_id = ucm.company_id and tc.team_id = p_team and tc.role in ('own', 'competitor')
    join app.company c on c.id = ucm.company_id
    left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = c.id
    where ucm.url = v_url and (ucm.team_id is null or ucm.team_id = p_team)
    order by c.id
  )
  select coalesce(jsonb_agg(jsonb_build_object('company_id', b.company_id, 'name', b.name, 'role', b.role,
                                               'logo_url', b.logo_url, 'favicon_url', b.favicon_url)
                            order by (b.role = 'own') desc, lower(b.name), b.company_id), '[]'::jsonb),
         coalesce((select jsonb_agg(e || jsonb_build_object('logo_url', bb.logo_url, 'company_name', bb.name) order by o)
                   from jsonb_array_elements(case when v_in then coalesce(v_m->'conversion', '[]'::jsonb) else '[]'::jsonb end)
                        with ordinality x(e, o)
                   left join b bb on bb.company_id = (e->>'company_id')::uuid), '[]'::jsonb)
    into v_brands, v_conv
  from b;
  if v_brands is null then v_brands := '[]'::jsonb; end if;
  if v_conv is null then v_conv := '[]'::jsonb; end if;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'team_id', p_team, 'url', v_url, 'url_requested', p_url,
      'date_from', v_p->'date_from', 'date_to', v_p->'date_to',
      'filters', jsonb_build_object('models', v_p->'models', 'markets', v_p->'markets', 'tag_ids', v_p->'tag_ids', 'tagmode', v_p->'tagmode'),
      'in_range', v_in,
      'data_as_of', now()),
    'row', app.js_safe(jsonb_build_object(
      'url',             v_url,
      'title',           nullif(app._html_decode_v1(v_d->>'title'), ''),
      'domain',          nullif(v_d->>'domain', ''),
      'favicon',         nullif(v_d->>'favicon', ''),
      'url_type',        nullif(v_d->>'url_type', ''),
      'citation_type',   nullif(v_d->>'citation_type', ''),
      'first_cited_at',  v_first,
      'last_cited_at',   v_last,
      'last_scraped_at', v_scraped,
      'in_range',        v_in,
      'cited_runs',      v_cited,
      'domain_share',    case when v_in then v_d->'domain_share' else to_jsonb(0) end,
      'global_share',    case when v_in then v_d->'global_share' else to_jsonb(0) end,
      'global_rank',     case when v_in then v_d->'global_rank' else 'null'::jsonb end,
      'description',     nullif(app._html_decode_v1(v_d->>'description'), ''),
      'summary',         v_sum,
      'brands',          v_brands,
      'conversion',      v_conv)));
end;
$f$;

-- B. Responses: cached_dashboard_responses_v1 + p_url, p_domain (Signatur wird ersetzt, damit PostgREST eindeutig bleibt)
drop function app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text);
CREATE FUNCTION app.cached_dashboard_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_limit integer DEFAULT 15, p_offset integer DEFAULT 0, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text)
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

-- C. Export: export_responses_v1 + p_url, p_domain
drop function app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer);
CREATE FUNCTION app.export_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text)
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

revoke all on function app._url_variants_v1(text), app._url_resolve_v1(uuid, text), app._html_decode_v1(text),
  app._url_metrics_v1(uuid,text,text[],date,date,uuid[],text,text[]) from public, anon, authenticated;
revoke all on function app.url_detail_v1(uuid,text,date,date,text[],text[],uuid[],text),
  app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text),
  app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text)
  from public, anon;
grant execute on function app.url_detail_v1(uuid,text,date,date,text[],text[],uuid[],text),
  app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text),
  app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text)
  to authenticated, service_role;

commit;

-- Kontrolle: alle ok = true
select f, to_regprocedure(f) is not null as da,
       has_function_privilege('anon', f, 'execute') as anon,
       has_function_privilege('authenticated', f, 'execute') as authenticated,
       to_regprocedure(f) is not null and not has_function_privilege('anon', f, 'execute') and has_function_privilege('authenticated', f, 'execute') = a as ok
from (values
  ('app.url_detail_v1(uuid,text,date,date,text[],text[],uuid[],text)', true),
  ('app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text)', true),
  ('app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text)', true),
  ('app._url_metrics_v1(uuid,text,text[],date,date,uuid[],text,text[])', false),
  ('app._url_resolve_v1(uuid,text)', false)) x(f, a);
