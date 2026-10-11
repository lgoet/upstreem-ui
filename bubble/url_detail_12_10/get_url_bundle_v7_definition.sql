CREATE OR REPLACE FUNCTION app.get_url_bundle_v7(p_team uuid, p_url text, p_models text[] DEFAULT NULL::text[], p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_markets text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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
  perform app.check_rate_limit('url_detailed', 30);

  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from app.team_member tm
    where tm.team_id = p_team and tm.user_id = v_user
  ) then raise exception 'forbidden'; end if;
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
$function$
