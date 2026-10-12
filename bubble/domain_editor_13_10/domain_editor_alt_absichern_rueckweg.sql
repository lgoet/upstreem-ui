-- domain_editor_alt_absichern_rueckweg.sql (13.10.2026): Stand vor domain_editor_alt_absichern.sql. Als EIN Block.

begin;

CREATE OR REPLACE FUNCTION app.get_domain_detail_v13(p_team uuid, p_domain text, p_date_from date, p_date_to date, p_models text[] DEFAULT NULL::text[], p_granularity text DEFAULT 'day'::text, p_urlshare text DEFAULT 'no'::text, p_share text DEFAULT 'domain'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_from date;
  v_to   date;
  v_len  integer;
  v_prev_len integer;
  v_from_prev date;
  v_to_prev   date;
  v_dom  text;
  v_granularity text := lower(coalesce(nullif(trim(p_granularity), ''), 'day'));
  v_bucket_from date;
  v_bucket_to   date;
  v_bucket_step interval;
  v_run_tbl text;
  v_run_col text;
  v_dom_tbl text;
  v_dom_col text;
  v_url_tbl text;
  v_url_col text;
  v_rbm_tbl text;
  v_rbm_col text;
  v_share_mode text;
  v_urlshare text;
  v_ush_ctes text := '';
  v_ush_key  text := '';
  v_sql text;
  v_result jsonb;
begin
  perform app.check_rate_limit('domain_detailed', 30);

  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from app.team_member tm
    where tm.team_id = p_team
      and tm.user_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  if coalesce(nullif(trim(p_domain), ''), '') = '' then
    raise exception 'domain required';
  end if;

  if v_granularity not in ('day', 'week', 'month') then
    raise exception 'invalid granularity';
  end if;

  v_share_mode := lower(coalesce(p_share, 'domain'));
  if v_share_mode not in ('global', 'domain') then
    v_share_mode := 'domain';
  end if;
  v_urlshare := case when lower(coalesce(p_urlshare, 'no')) = 'yes' then 'yes' else 'no' end;

  v_dom  := regexp_replace(lower(btrim(p_domain)), '^www\.', '');
  v_from := coalesce(p_date_from, current_date - 6);
  v_to   := coalesce(p_date_to,   current_date);

  if v_to < v_from then
    raise exception 'invalid date range';
  end if;

  -- Bucket-Grenzen + Range-Erweiterung auf volle Kalenderperioden
  v_bucket_from := case v_granularity
    when 'day' then v_from
    when 'week' then date_trunc('week', v_from::timestamp)::date
    when 'month' then date_trunc('month', v_from::timestamp)::date
  end;
  v_bucket_to := case v_granularity
    when 'day' then v_to
    when 'week' then date_trunc('week', v_to::timestamp)::date
    when 'month' then date_trunc('month', v_to::timestamp)::date
  end;
  v_bucket_step := case v_granularity
    when 'day' then interval '1 day'
    when 'week' then interval '1 week'
    when 'month' then interval '1 month'
  end;

  if v_granularity = 'week' then
    v_from := v_bucket_from;
    v_to   := least(v_bucket_to + 6, current_date);
  elsif v_granularity = 'month' then
    v_from := v_bucket_from;
    v_to   := least((v_bucket_to + interval '1 month - 1 day')::date, current_date);
  end if;

  v_len := (v_to - v_from + 1);
  v_prev_len := greatest(least(v_len / 2, 30), 1);
  v_from_prev := v_from - v_prev_len;
  v_to_prev   := v_from - 1;

  v_run_tbl := case v_granularity
    when 'day' then 'app.daily_citation_run_rollup'
    when 'week' then 'app.weekly_citation_run_rollup'
    when 'month' then 'app.monthly_citation_run_rollup'
  end;
  v_dom_tbl := case v_granularity
    when 'day' then 'app.daily_citation_domain_rollup'
    when 'week' then 'app.weekly_citation_domain_rollup'
    when 'month' then 'app.monthly_citation_domain_rollup'
  end;
  v_url_tbl := case v_granularity
    when 'day' then 'app.daily_citation_url_rollup'
    when 'week' then 'app.weekly_citation_url_rollup'
    when 'month' then 'app.monthly_citation_url_rollup'
  end;
  v_run_col := case v_granularity
    when 'day' then 'day' when 'week' then 'week_start' else 'month_start' end;
  v_dom_col := v_run_col;
  v_url_col := v_run_col;
  v_rbm_tbl := case v_granularity
    when 'day' then 'app.daily_runs_by_model'
    when 'week' then 'app.weekly_runs_by_model'
    when 'month' then 'app.monthly_runs_by_model'
  end;
  v_rbm_col := v_run_col;

  perform set_config('jit', 'off', true);
  perform set_config('work_mem', '64MB', true);

  -- $1 p_team, $2 v_dom, $3 p_models,
  -- $4 now-Range from (day: v_from / week+month: v_bucket_from),
  -- $5 now-Range to   (day: v_to   / week+month: v_bucket_to),
  -- $6 v_from_prev, $7 v_to_prev, $8 v_bucket_step, $9 v_granularity,
  -- $10 v_share_mode, $11 v_from, $12 v_to (nur url_share-Block)
  v_sql := $q$
    with
    dom as (
      select
        sd.citation_type::text as citation_type,
        sd.favicon,
        sd.first_seen,
        sd.last_seen
      from app.source_domain sd
      where regexp_replace(lower(sd.domain), '^www\.', '') = $2
      limit 1
    ),

    tdo_role as (
      select t.role
      from app.team_domain_override t
      where t.team_id = $1
        and regexp_replace(lower(t.domain), '^www\.', '') = $2
      limit 1
    ),

    tc_role as (
      select tc.role
      from app.team_company tc
      join app.company c
        on c.id = tc.company_id
      where tc.team_id = $1
        and regexp_replace(
              lower(
                nullif(
                  regexp_replace(coalesce(c.url, ''), '^[a-z]+://([^/]+).*', '\1'),
                  ''
                )
              ),
              '^www\.',
              ''
            ) = $2
      limit 1
    ),

    effective as (
      select
        case
          when (select role from tdo_role) = 'own'        then 'You'
          when (select role from tdo_role) = 'competitor' then 'Competition'
          when (select role from tc_role)  = 'own'        then 'You'
          when (select role from tc_role)  = 'competitor' then 'Competition'
          else (select citation_type from dom)
        end as effective_type
    ),

    runs_now as materialized (
      select
        r.__RUN_COL__ as day,
        sum(r.runs_with_any_citation)::int as total_runs
      from __RUN_TBL__ r
      where r.team_id = $1
        and r.__RUN_COL__ between $4 and $5
        and ($3 is null or cardinality($3) = 0 or r.model = any($3))
      group by r.__RUN_COL__
    ),

    runs_prev as materialized (
      select
        r.day,
        sum(r.runs_with_any_citation)::int as total_runs
      from app.daily_citation_run_rollup r
      where r.team_id = $1
        and r.day between $6 and $7
        and ($3 is null or cardinality($3) = 0 or r.model = any($3))
      group by r.day
    ),

    dom_now as materialized (
      select
        d.__DOM_COL__ as day,
        sum(d.runs_with_domain)::int as dom_runs,
        sum(d.used_total)::int       as dom_inst,
        min(d.first_used_at)         as first_used_at,
        max(d.last_used_at)          as last_used_at
      from __DOM_TBL__ d
      where d.team_id = $1
        and d.__DOM_COL__ between $4 and $5
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
      group by d.__DOM_COL__
    ),

    dom_prev as materialized (
      select
        d.day,
        sum(d.runs_with_domain)::int as dom_runs,
        sum(d.used_total)::int       as dom_inst,
        min(d.first_used_at)         as first_used_at,
        max(d.last_used_at)          as last_used_at
      from app.daily_citation_domain_rollup d
      where d.team_id = $1
        and d.day between $6 and $7
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
      group by d.day
    ),

    model_runs_raw as (
      select
        d.model,
        sum(d.runs_with_domain)::numeric as runs_with_model
      from __DOM_TBL__ d
      where d.team_id = $1
        and d.__DOM_COL__ between $4 and $5
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
      group by d.model
      having sum(d.runs_with_domain) > 0
    ),

    model_runs_ranked as (
      select
        m.model,
        m.runs_with_model,
        sum(m.runs_with_model) over () as runs_with_domain_total,
        row_number() over (
          order by m.runs_with_model desc, m.model asc
        ) as rn,
        count(*) over () as cnt
      from model_runs_raw m
    ),

    model_runs_pct_raw as (
      select
        m.model,
        m.runs_with_model,
        m.runs_with_domain_total,
        m.rn,
        m.cnt,
        case
          when m.runs_with_domain_total > 0
          then round(m.runs_with_model * 100.0 / m.runs_with_domain_total, 2)
          else 0::numeric
        end as model_share_pct_raw
      from model_runs_ranked m
    ),

    model_runs_pct_fixed as (
      select
        p.model,
        p.runs_with_model,
        p.rn,
        p.cnt,
        case
          when p.cnt = 1 then 100::numeric
          when p.rn = p.cnt then greatest(
            0::numeric,
            round(
              100::numeric
              - coalesce(
                  sum(p.model_share_pct_raw) over (
                    order by p.rn
                    rows between unbounded preceding and 1 preceding
                  ),
                  0::numeric
                ),
              2
            )
          )
          else p.model_share_pct_raw
        end as model_share_pct
      from model_runs_pct_raw p
    ),

    model_breakdown as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'model', coalesce(lmc.display_name, p.model),
              'model_logo_url', lmc.logo_url,
              'model_share_pct', p.model_share_pct,
              'color_lightmode', lmc.color_lightmode,
              'color_darkmode', lmc.color_darkmode
            )
            order by p.model_share_pct desc, coalesce(lmc.display_name, p.model) asc
          ),
          '[]'::jsonb
        ) as items
      from model_runs_pct_fixed p
      left join app.llm_model_catalog lmc
        on lmc.key = p.model
      where p.model_share_pct > 0
    ),

    spine_cur as (
      select generate_series($4::timestamp, $5::timestamp, $8)::date as day
    ),

    spine_prev as (
      select generate_series($6, $7, '1 day'::interval)::date as day
    ),

    cur as (
      select
        s.day,
        coalesce(r.total_runs, 0) as total_runs,
        coalesce(d.dom_runs, 0)   as dom_runs,
        coalesce(d.dom_inst, 0)   as dom_inst
      from spine_cur s
      left join runs_now r on r.day = s.day
      left join dom_now  d on d.day = s.day
    ),

    prev as (
      select
        s.day,
        coalesce(r.total_runs, 0) as total_runs,
        coalesce(d.dom_runs, 0)   as dom_runs,
        coalesce(d.dom_inst, 0)   as dom_inst
      from spine_prev s
      left join runs_prev r on r.day = s.day
      left join dom_prev  d on d.day = s.day
    ),

    sum_cur as (
      select
        sum(dom_runs)::int as dom_runs_total,
        sum(total_runs)::int as total_runs_all,
        case
          when sum(total_runs) > 0
          then round((sum(dom_runs)::numeric / sum(total_runs)::numeric) * 100, 2)
          else 0
        end as share_total_runs,
        sum(dom_inst)::int as dom_inst_total
      from cur
    ),

    sum_prev as (
      select
        sum(dom_runs)::int as dom_runs_total_prev,
        sum(total_runs)::int as total_runs_all_prev,
        case
          when sum(total_runs) > 0
          then round((sum(dom_runs)::numeric / sum(total_runs)::numeric) * 100, 2)
          else 0
        end as share_total_runs_prev,
        sum(dom_inst)::int as dom_inst_total_prev
      from prev
    ),

    team_seen as (
      select
        min(d.first_used_at::date) as first_seen,
        max(d.last_used_at::date)  as last_seen
      from (
        select first_used_at, last_used_at, dom_inst from dom_now
        union all
        select first_used_at, last_used_at, dom_inst from dom_prev
      ) d
      where d.dom_inst > 0
    ),

    current_domain_urls as materialized (
      select
        u.url,
        u.domain_norm,
        sum(u.runs_with_url)::int as runs_with_url,
        sum(u.used_total)::bigint as citations_count
      from __URL_TBL__ u
      where u.team_id = $1
        and u.__URL_COL__ between $4 and $5
        and u.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or u.model = any($3))
      group by
        u.url,
        u.domain_norm
    ),

    types_breakdown as materialized (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('type', x.url_type, 'share_pct', x.share_pct)
          order by x.share_pct desc, x.url_type asc
        ), '[]'::jsonb) as items
      from (
        select
          coalesce(su.url_type::text, 'uncategorized') as url_type,
          case when sum(sum(u.citations_count)) over () > 0
               then round((sum(u.citations_count)::numeric * 100.0)
                          / sum(sum(u.citations_count)) over (), 2)
               else 0 end as share_pct
        from current_domain_urls u
        left join app.source_url su on su.url = u.url
        group by coalesce(su.url_type::text, 'uncategorized')
      ) x
    ),

    url_brand_flags as materialized (
      select
        cdu.url,

        bool_or(tc.role = 'own') as mentions_you,
        bool_or(tc.role = 'competitor') as mentions_competitor,
        bool_or(tc.role in ('own', 'competitor')) as mentions_tracked_brand,

        count(distinct case when tc.role = 'own' then tc.company_id end)::int as own_brands_count,
        count(distinct case when tc.role = 'competitor' then tc.company_id end)::int as competitor_brands_count,
        count(distinct case when tc.role in ('own', 'competitor') then tc.company_id end)::int as tracked_brands_count

      from current_domain_urls cdu
      left join app.url_company_mention ucm
        on ucm.url = cdu.url
       and (ucm.team_id is null or ucm.team_id = $1)
      left join app.team_company tc
        on tc.team_id = $1
       and tc.company_id = ucm.company_id
       and tc.role in ('own', 'competitor')
      group by cdu.url
    ),

    source_presence as (
      select
        coalesce((select sc.dom_runs_total from sum_cur sc), 0)::int as ai_searches_citing_domain,

        count(*)::int as cited_urls_count,

        count(*) filter (
          where coalesce(ubf.mentions_tracked_brand, false)
        )::int as urls_with_tracked_brands,

        count(*) filter (
          where coalesce(ubf.mentions_you, false)
        )::int as urls_mentioning_you,

        count(*) filter (
          where coalesce(ubf.mentions_competitor, false)
        )::int as urls_mentioning_competitors,

        count(*) filter (
          where coalesce(ubf.mentions_competitor, false)
            and not coalesce(ubf.mentions_you, false)
        )::int as competitor_only_urls,

        count(*) filter (
          where coalesce(ubf.mentions_competitor, false)
            and coalesce(ubf.mentions_you, false)
        )::int as overlap_urls,

        count(*) filter (
          where not coalesce(ubf.mentions_tracked_brand, false)
        )::int as urls_without_tracked_brands

      from current_domain_urls cdu
      left join url_brand_flags ubf
        on ubf.url = cdu.url
    ),

    source_presence_enriched as (
      select
        sp.*,

        case
          when sp.cited_urls_count > 0
          then round(sp.urls_with_tracked_brands::numeric * 100.0 / sp.cited_urls_count, 2)
          else 0
        end as tracked_brand_presence_pct,

        case
          when sp.cited_urls_count > 0
          then round(sp.urls_mentioning_you::numeric * 100.0 / sp.cited_urls_count, 2)
          else 0
        end as your_url_presence_pct,

        case
          when sp.cited_urls_count > 0
          then round(sp.urls_mentioning_competitors::numeric * 100.0 / sp.cited_urls_count, 2)
          else 0
        end as competitor_url_presence_pct,

        case
          when sp.cited_urls_count > 0
          then round(sp.competitor_only_urls::numeric * 100.0 / sp.cited_urls_count, 2)
          else 0
        end as competitor_only_share_pct,

        case
          when sp.cited_urls_count > 0
          then round(
            (
              (sp.urls_mentioning_competitors::numeric * 100.0 / sp.cited_urls_count)
              -
              (sp.urls_mentioning_you::numeric * 100.0 / sp.cited_urls_count)
            ),
            2
          )
          else 0
        end as opportunity_gap_pct,

        case
          when sp.cited_urls_count > 0
          then round(
            (
              (sp.urls_mentioning_you::numeric * 100.0 / sp.cited_urls_count)
              -
              (sp.urls_mentioning_competitors::numeric * 100.0 / sp.cited_urls_count)
            ),
            2
          )
          else 0
        end as presence_gap_pct

      from source_presence sp
    )__USH_CTES__

    select jsonb_build_object(
      'header', jsonb_build_object(
        'id',                     $2,
        'domain',                 $2,
        'favicon',                (select d.favicon from dom d),
        'citation_type',          (select e.effective_type from effective e),
        'first_seen',
          to_char(
            coalesce(
              (select ts.first_seen from team_seen ts),
              (select d.first_seen::date from dom d)
            ),
            'YYYY-MM-DD'
          ),
        'last_seen',
          to_char(
            coalesce(
              (select ts.last_seen from team_seen ts),
              (select d.last_seen::date from dom d)
            ),
            'YYYY-MM-DD'
          ),
        'total_citations_count',  coalesce((select sc.dom_inst_total from sum_cur sc), 0),
        'total_citations_prev',   coalesce((select sp.dom_inst_total_prev from sum_prev sp), 0),
        'total_citations_delta_pct',
          (
            select
              case
                when sp.dom_inst_total_prev > 0
                then round(
                  ((sc.dom_inst_total - sp.dom_inst_total_prev)::numeric / sp.dom_inst_total_prev::numeric) * 100,
                  2
                )
                else null
              end
            from sum_cur sc, sum_prev sp
          ),
        'current_citation_share', coalesce((select sc.share_total_runs from sum_cur sc), 0),
        'citation_share_prev',    coalesce((select sp.share_total_runs_prev from sum_prev sp), 0),
        'citation_share_delta_pct',
          (
            select
              case
                when coalesce(sp.total_runs_all_prev, 0) > 0
                then sc.share_total_runs - sp.share_total_runs_prev
                else null
              end
            from sum_cur sc, sum_prev sp
          )
      ),

      'model_breakdown',
        coalesce(
          (select mb.items from model_breakdown mb),
          '[]'::jsonb
        ),

      'types_breakdown',
        coalesce(
          (select tb.items from types_breakdown tb),
          '[]'::jsonb
        ),

      'timeseries', jsonb_build_object(
        'citation_share_over_time',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'day',       to_char(c.day, 'YYYY-MM-DD'),
                'share_pct',
                  case
                    when c.total_runs > 0
                    then round((c.dom_runs::numeric / c.total_runs::numeric) * 100, 2)
                    else null
                  end
              )
              order by c.day
            )
            from cur c
          ), '[]'::jsonb),

        'citations_over_time',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'day',   to_char(c.day, 'YYYY-MM-DD'),
                'count', c.dom_inst
              )
              order by c.day
            )
            from cur c
          ), '[]'::jsonb),

        'runs_over_time',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'day',   to_char(c.day, 'YYYY-MM-DD'),
                'count', c.dom_runs
              )
              order by c.day
            )
            from cur c
          ), '[]'::jsonb)
      ),

      'source_presence_funnel',
        (
          select jsonb_build_object(
            'ai_searches_citing_domain',       spe.ai_searches_citing_domain,
            'cited_urls_count',                spe.cited_urls_count,

            'urls_with_tracked_brands',         spe.urls_with_tracked_brands,
            'urls_mentioning_you',             spe.urls_mentioning_you,
            'urls_mentioning_competitors',     spe.urls_mentioning_competitors,

            'competitor_only_urls',            spe.competitor_only_urls,
            'overlap_urls',                    spe.overlap_urls,
            'urls_without_tracked_brands',     spe.urls_without_tracked_brands,

            'tracked_brand_presence_pct',      spe.tracked_brand_presence_pct,
            'your_url_presence_pct',           spe.your_url_presence_pct,
            'competitor_url_presence_pct',     spe.competitor_url_presence_pct,
            'competitor_only_share_pct',       spe.competitor_only_share_pct,

            'opportunity_gap_pct',             spe.opportunity_gap_pct,
            'presence_gap_pct',                spe.presence_gap_pct,
            'opportunity_gap_urls',            spe.competitor_only_urls
          )
          from source_presence_enriched spe
        ),

      __USH_KEY__'granularity', $9
    )
  $q$;

  if v_urlshare = 'yes' then
    v_ush_ctes := $ush$,

    ush_prompt_filter as materialized (
      select p.id
      from app.prompt p
      where p.team_id = $1
    ),

    ush_url_runs as materialized (
      select
        u.__URL_COL__ as day,
        u.url,
        sum(u.runs_with_url)::int as url_runs,
        max(u.last_used_at)       as last_seen_team
      from __URL_TBL__ u
      join ush_prompt_filter pf on pf.id = u.prompt_id
      where u.team_id = $1
        and u.__URL_COL__ between $4 and $5
        and u.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or u.model = any($3))
      group by u.__URL_COL__, u.url
    ),

    ush_total_runs_window as materialized (
      select coalesce(sum(drm.runs_total), 0)::int as cnt
      from __RBM_TBL__ drm
      where drm.team_id = $1
        and drm.__RBM_COL__ between $4 and $5
        and ($3 is null or cardinality($3) = 0 or drm.model = any($3))
    ),

    ush_total_runs_by_day as materialized (
      select
        drm.__RBM_COL__ as day,
        coalesce(sum(drm.runs_total), 0)::int as total_runs
      from __RBM_TBL__ drm
      where drm.team_id = $1
        and drm.__RBM_COL__ between $4 and $5
        and ($3 is null or cardinality($3) = 0 or drm.model = any($3))
      group by drm.__RBM_COL__
    ),

    ush_dom_run_count_window as materialized (
      select coalesce(sum(d.runs_with_domain), 0)::int as cnt
      from __DOM_TBL__ d
      join ush_prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = $1
        and d.__DOM_COL__ between $4 and $5
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
    ),

    ush_dom_runs_by_day as materialized (
      select
        d.__DOM_COL__ as day,
        coalesce(sum(d.runs_with_domain), 0)::int as domain_runs
      from __DOM_TBL__ d
      join ush_prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = $1
        and d.__DOM_COL__ between $4 and $5
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
      group by d.__DOM_COL__
    ),

    ush_url_stats as materialized (
      select
        u.url,
        sum(u.url_runs)::int as url_runs_total,
        max(u.last_seen_team) as last_seen_team,
        case
          when (select cnt from ush_total_runs_window) > 0
          then round(
            sum(u.url_runs)::numeric * 100.0
            / (select cnt from ush_total_runs_window)::numeric,
            4
          )
          else 0
        end as global_share_pct,
        case
          when (select cnt from ush_dom_run_count_window) > 0
          then round(
            sum(u.url_runs)::numeric * 100.0
            / (select cnt from ush_dom_run_count_window)::numeric,
            4
          )
          else 0
        end as domainshare_pct
      from ush_url_runs u
      group by u.url
    ),

    ush_top_urls as materialized (
      select
        s.url,
        s.url_runs_total,
        s.global_share_pct,
        s.domainshare_pct,
        case
          when $10 = 'domain' then s.domainshare_pct
          else s.global_share_pct
        end as share_total_pct
      from ush_url_stats s
      order by
        case when $10 = 'domain' then s.domainshare_pct else s.global_share_pct end desc nulls last,
        s.url_runs_total desc nulls last,
        s.url asc
      limit 5
    ),

    ush_url_meta as materialized (
      select distinct on (su.url)
        su.url,
        su.title,
        su.description
      from app.source_url su
      join ush_top_urls t on t.url = su.url
      order by su.url, su.first_seen
    ),

    ush_grid as materialized (
      select ds.day, t.url
      from spine_cur ds
      cross join ush_top_urls t
    ),

    ush_series as materialized (
      select
        g.day,
        g.url,
        case
          when $10 = 'domain' then
            case
              when coalesce(dr.domain_runs, 0) > 0 and u.url_runs is not null
              then round(u.url_runs::numeric * 100.0 / dr.domain_runs::numeric, 2)
              else null
            end
          else
            case
              when coalesce(rt.total_runs, 0) > 0 and u.url_runs is not null
              then round(u.url_runs::numeric * 100.0 / rt.total_runs::numeric, 2)
              else null
            end
        end as share_pct
      from ush_grid g
      left join ush_url_runs u on u.day = g.day and u.url = g.url
      left join ush_total_runs_by_day rt on rt.day = g.day
      left join ush_dom_runs_by_day dr on dr.day = g.day
    )$ush$;
    v_ush_key := $ushk$'url_share', jsonb_build_object(
        'domain', $2,
        'from',   to_char($11, 'YYYY-MM-DD'),
        'to',     to_char($12, 'YYYY-MM-DD'),
        'top_n',  5,
        'share_mode', $10,
        'points',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'url', left(st.url, 60),
                'title',
                  left(
                    (
                      case
                        when nullif(
                               btrim(regexp_replace(coalesce(um.title, ''), '\s+', ' ', 'g')),
                               ''
                             ) is not null
                        then btrim(regexp_replace(coalesce(um.title, ''), '\s+', ' ', 'g'))
                        else nullif(
                               left(
                                 btrim(regexp_replace(coalesce(um.description, ''), '\s+', ' ', 'g')),
                                 150
                               ),
                               ''
                             )
                      end
                    ),
                    60
                  ),
                'day',       to_char(st.day, 'YYYY-MM-DD'),
                'share_pct', st.share_pct,
                'share_total_pct', tu.share_total_pct,
                'global_share_total_pct', tu.global_share_pct,
                'domain_share_total_pct', tu.domainshare_pct,
                'url_runs_total', tu.url_runs_total
              )
              order by st.day, tu.share_total_pct desc, st.url
            )
            from ush_series st
            join ush_top_urls tu on tu.url = st.url
            left join ush_url_meta um on um.url = st.url
          ), '[]'::jsonb)
      ),

      $ushk$;
  end if;

  v_sql := replace(v_sql, '__USH_CTES__', v_ush_ctes);
  v_sql := replace(v_sql, '__USH_KEY__', v_ush_key);
  v_sql := replace(v_sql, '__RUN_TBL__', v_run_tbl);
  v_sql := replace(v_sql, '__RUN_COL__', v_run_col);
  v_sql := replace(v_sql, '__DOM_TBL__', v_dom_tbl);
  v_sql := replace(v_sql, '__DOM_COL__', v_dom_col);
  v_sql := replace(v_sql, '__URL_TBL__', v_url_tbl);
  v_sql := replace(v_sql, '__URL_COL__', v_url_col);
  v_sql := replace(v_sql, '__RBM_TBL__', v_rbm_tbl);
  v_sql := replace(v_sql, '__RBM_COL__', v_rbm_col);

  execute v_sql
  into v_result
  using
    p_team,                                              -- $1
    v_dom,                                               -- $2
    p_models,                                            -- $3
    case when v_granularity = 'day' then v_from else v_bucket_from end,  -- $4
    case when v_granularity = 'day' then v_to   else v_bucket_to   end,  -- $5
    v_from_prev,                                         -- $6
    v_to_prev,                                           -- $7
    v_bucket_step,                                       -- $8
    v_granularity,                                       -- $9
    v_share_mode,                                        -- $10
    v_from,                                              -- $11
    v_to;                                                -- $12

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION app.get_domain_detail_v14(p_team uuid, p_domain text, p_date_from date, p_date_to date, p_models text[] DEFAULT NULL::text[], p_granularity text DEFAULT 'day'::text, p_urlshare text DEFAULT 'no'::text, p_share text DEFAULT 'domain'::text, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_markets text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_from date;
  v_to   date;
  v_len  integer;
  v_prev_len integer;
  v_from_prev date;
  v_to_prev   date;
  v_dom  text;
  v_granularity text := lower(coalesce(nullif(trim(p_granularity), ''), 'day'));
  v_bucket_from date;
  v_bucket_to   date;
  v_bucket_step interval;
  v_run_tbl text;
  v_run_col text;
  v_dom_tbl text;
  v_dom_col text;
  v_url_tbl text;
  v_url_col text;
  v_rbm_tbl text;
  v_rbm_col text;
  v_share_mode text;
  v_urlshare text;
  v_tagmode text;
  v_ush_ctes text := '';
  v_ush_key  text := '';
  v_sql text;
  v_result jsonb;
begin
  perform app.check_rate_limit('domain_detailed', 30);

  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from app.team_member tm
    where tm.team_id = p_team
      and tm.user_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  if coalesce(nullif(trim(p_domain), ''), '') = '' then
    raise exception 'domain required';
  end if;

  if v_granularity not in ('day', 'week', 'month') then
    raise exception 'invalid granularity';
  end if;

  v_share_mode := lower(coalesce(p_share, 'domain'));
  if v_share_mode not in ('global', 'domain') then
    v_share_mode := 'domain';
  end if;
  v_urlshare := case when lower(coalesce(p_urlshare, 'no')) = 'yes' then 'yes' else 'no' end;

  v_tagmode := lower(coalesce(nullif(trim(p_tagmode), ''), 'or'));
  if v_tagmode not in ('or', 'and') then
    raise exception 'invalid tagmode';
  end if;

  v_dom  := regexp_replace(lower(btrim(p_domain)), '^www\.', '');
  v_from := coalesce(p_date_from, current_date - 6);
  v_to   := coalesce(p_date_to,   current_date);

  if v_to < v_from then
    raise exception 'invalid date range';
  end if;

  -- Bucket-Grenzen + Range-Erweiterung auf volle Kalenderperioden
  v_bucket_from := case v_granularity
    when 'day' then v_from
    when 'week' then date_trunc('week', v_from::timestamp)::date
    when 'month' then date_trunc('month', v_from::timestamp)::date
  end;
  v_bucket_to := case v_granularity
    when 'day' then v_to
    when 'week' then date_trunc('week', v_to::timestamp)::date
    when 'month' then date_trunc('month', v_to::timestamp)::date
  end;
  v_bucket_step := case v_granularity
    when 'day' then interval '1 day'
    when 'week' then interval '1 week'
    when 'month' then interval '1 month'
  end;

  if v_granularity = 'week' then
    v_from := v_bucket_from;
    v_to   := least(v_bucket_to + 6, current_date);
  elsif v_granularity = 'month' then
    v_from := v_bucket_from;
    v_to   := least((v_bucket_to + interval '1 month - 1 day')::date, current_date);
  end if;

  v_len := (v_to - v_from + 1);
  v_prev_len := greatest(least(v_len / 2, 30), 1);
  v_from_prev := v_from - v_prev_len;
  v_to_prev   := v_from - 1;

  v_run_tbl := case v_granularity
    when 'day' then 'app.daily_citation_run_rollup'
    when 'week' then 'app.weekly_citation_run_rollup'
    when 'month' then 'app.monthly_citation_run_rollup'
  end;
  v_dom_tbl := case v_granularity
    when 'day' then 'app.daily_citation_domain_rollup'
    when 'week' then 'app.weekly_citation_domain_rollup'
    when 'month' then 'app.monthly_citation_domain_rollup'
  end;
  v_url_tbl := case v_granularity
    when 'day' then 'app.daily_citation_url_rollup'
    when 'week' then 'app.weekly_citation_url_rollup'
    when 'month' then 'app.monthly_citation_url_rollup'
  end;
  v_run_col := case v_granularity
    when 'day' then 'day' when 'week' then 'week_start' else 'month_start' end;
  v_dom_col := v_run_col;
  v_url_col := v_run_col;
  v_rbm_tbl := case v_granularity
    when 'day' then 'app.daily_runs_by_model'
    when 'week' then 'app.weekly_runs_by_model'
    when 'month' then 'app.monthly_runs_by_model'
  end;
  v_rbm_col := v_run_col;

  perform set_config('jit', 'off', true);
  perform set_config('work_mem', '64MB', true);

  -- $1 p_team, $2 v_dom, $3 p_models,
  -- $4 now-Range from (day: v_from / week+month: v_bucket_from),
  -- $5 now-Range to   (day: v_to   / week+month: v_bucket_to),
  -- $6 v_from_prev, $7 v_to_prev, $8 v_bucket_step, $9 v_granularity,
  -- $10 v_share_mode, $11 v_from, $12 v_to (nur url_share-Block),
  -- $13 p_markets, $14 p_tag_ids, $15 v_tagmode
  v_sql := $q$
    with
    prompt_filter as materialized (
      select p.id
      from app.prompt p
      where p.team_id = $1
        and ($13 is null or cardinality($13) = 0 or p.market::text = any($13))
        and (
          $14 is null or cardinality($14) = 0
          or (
            $15 = 'or'
            and exists (
              select 1 from app.prompt_tag pt
              where pt.prompt_id = p.id and pt.tag_id = any($14)
            )
          )
          or (
            $15 = 'and'
            and (
              select count(distinct pt.tag_id)
              from app.prompt_tag pt
              where pt.prompt_id = p.id and pt.tag_id = any($14)
            ) = cardinality($14)
          )
        )
    ),

    dom as (
      select
        sd.citation_type::text as citation_type,
        sd.favicon,
        sd.first_seen,
        sd.last_seen
      from app.source_domain sd
      where regexp_replace(lower(sd.domain), '^www\.', '') = $2
      limit 1
    ),

    tdo_role as (
      select t.role
      from app.team_domain_override t
      where t.team_id = $1
        and regexp_replace(lower(t.domain), '^www\.', '') = $2
      limit 1
    ),

    tc_role as (
      select tc.role
      from app.team_company tc
      join app.company c
        on c.id = tc.company_id
      where tc.team_id = $1
        and regexp_replace(
              lower(
                nullif(
                  regexp_replace(coalesce(c.url, ''), '^[a-z]+://([^/]+).*', '\1'),
                  ''
                )
              ),
              '^www\.',
              ''
            ) = $2
      limit 1
    ),

    effective as (
      select
        case
          when (select role from tdo_role) = 'own'        then 'You'
          when (select role from tdo_role) = 'competitor' then 'Competition'
          when (select role from tc_role)  = 'own'        then 'You'
          when (select role from tc_role)  = 'competitor' then 'Competition'
          else (select citation_type from dom)
        end as effective_type
    ),

    runs_now as materialized (
      select
        r.__RUN_COL__ as day,
        sum(r.runs_with_any_citation)::int as total_runs
      from __RUN_TBL__ r
      join prompt_filter pf on pf.id = r.prompt_id
      where r.team_id = $1
        and r.__RUN_COL__ between $4 and $5
        and ($3 is null or cardinality($3) = 0 or r.model = any($3))
      group by r.__RUN_COL__
    ),

    runs_prev as materialized (
      select
        r.day,
        sum(r.runs_with_any_citation)::int as total_runs
      from app.daily_citation_run_rollup r
      join prompt_filter pf on pf.id = r.prompt_id
      where r.team_id = $1
        and r.day between $6 and $7
        and ($3 is null or cardinality($3) = 0 or r.model = any($3))
      group by r.day
    ),

    dom_now as materialized (
      select
        d.__DOM_COL__ as day,
        sum(d.runs_with_domain)::int as dom_runs,
        sum(d.used_total)::int       as dom_inst,
        min(d.first_used_at)         as first_used_at,
        max(d.last_used_at)          as last_used_at
      from __DOM_TBL__ d
      join prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = $1
        and d.__DOM_COL__ between $4 and $5
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
      group by d.__DOM_COL__
    ),

    dom_prev as materialized (
      select
        d.day,
        sum(d.runs_with_domain)::int as dom_runs,
        sum(d.used_total)::int       as dom_inst,
        min(d.first_used_at)         as first_used_at,
        max(d.last_used_at)          as last_used_at
      from app.daily_citation_domain_rollup d
      join prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = $1
        and d.day between $6 and $7
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
      group by d.day
    ),

    model_runs_raw as (
      select
        d.model,
        sum(d.runs_with_domain)::numeric as runs_with_model
      from __DOM_TBL__ d
      join prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = $1
        and d.__DOM_COL__ between $4 and $5
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
      group by d.model
      having sum(d.runs_with_domain) > 0
    ),

    model_runs_ranked as (
      select
        m.model,
        m.runs_with_model,
        sum(m.runs_with_model) over () as runs_with_domain_total,
        row_number() over (
          order by m.runs_with_model desc, m.model asc
        ) as rn,
        count(*) over () as cnt
      from model_runs_raw m
    ),

    model_runs_pct_raw as (
      select
        m.model,
        m.runs_with_model,
        m.runs_with_domain_total,
        m.rn,
        m.cnt,
        case
          when m.runs_with_domain_total > 0
          then round(m.runs_with_model * 100.0 / m.runs_with_domain_total, 2)
          else 0::numeric
        end as model_share_pct_raw
      from model_runs_ranked m
    ),

    model_runs_pct_fixed as (
      select
        p.model,
        p.runs_with_model,
        p.rn,
        p.cnt,
        case
          when p.cnt = 1 then 100::numeric
          when p.rn = p.cnt then greatest(
            0::numeric,
            round(
              100::numeric
              - coalesce(
                  sum(p.model_share_pct_raw) over (
                    order by p.rn
                    rows between unbounded preceding and 1 preceding
                  ),
                  0::numeric
                ),
              2
            )
          )
          else p.model_share_pct_raw
        end as model_share_pct
      from model_runs_pct_raw p
    ),

    model_breakdown as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'model', coalesce(lmc.display_name, p.model),
              'model_logo_url', lmc.logo_url,
              'model_share_pct', p.model_share_pct,
              'color_lightmode', lmc.color_lightmode,
              'color_darkmode', lmc.color_darkmode
            )
            order by p.model_share_pct desc, coalesce(lmc.display_name, p.model) asc
          ),
          '[]'::jsonb
        ) as items
      from model_runs_pct_fixed p
      left join app.llm_model_catalog lmc
        on lmc.key = p.model
      where p.model_share_pct > 0
    ),

    spine_cur as (
      select generate_series($4::timestamp, $5::timestamp, $8)::date as day
    ),

    spine_prev as (
      select generate_series($6, $7, '1 day'::interval)::date as day
    ),

    cur as (
      select
        s.day,
        coalesce(r.total_runs, 0) as total_runs,
        coalesce(d.dom_runs, 0)   as dom_runs,
        coalesce(d.dom_inst, 0)   as dom_inst
      from spine_cur s
      left join runs_now r on r.day = s.day
      left join dom_now  d on d.day = s.day
    ),

    prev as (
      select
        s.day,
        coalesce(r.total_runs, 0) as total_runs,
        coalesce(d.dom_runs, 0)   as dom_runs,
        coalesce(d.dom_inst, 0)   as dom_inst
      from spine_prev s
      left join runs_prev r on r.day = s.day
      left join dom_prev  d on d.day = s.day
    ),

    sum_cur as (
      select
        sum(dom_runs)::int as dom_runs_total,
        sum(total_runs)::int as total_runs_all,
        case
          when sum(total_runs) > 0
          then round((sum(dom_runs)::numeric / sum(total_runs)::numeric) * 100, 2)
          else 0
        end as share_total_runs,
        sum(dom_inst)::int as dom_inst_total
      from cur
    ),

    sum_prev as (
      select
        sum(dom_runs)::int as dom_runs_total_prev,
        sum(total_runs)::int as total_runs_all_prev,
        case
          when sum(total_runs) > 0
          then round((sum(dom_runs)::numeric / sum(total_runs)::numeric) * 100, 2)
          else 0
        end as share_total_runs_prev,
        sum(dom_inst)::int as dom_inst_total_prev
      from prev
    ),

    team_seen as (
      select
        min(d.first_used_at::date) as first_seen,
        max(d.last_used_at::date)  as last_seen
      from (
        select first_used_at, last_used_at, dom_inst from dom_now
        union all
        select first_used_at, last_used_at, dom_inst from dom_prev
      ) d
      where d.dom_inst > 0
    ),

    current_domain_urls as materialized (
      select
        u.url,
        u.domain_norm,
        sum(u.runs_with_url)::int as runs_with_url,
        sum(u.used_total)::bigint as citations_count
      from __URL_TBL__ u
      join prompt_filter pf on pf.id = u.prompt_id
      where u.team_id = $1
        and u.__URL_COL__ between $4 and $5
        and u.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or u.model = any($3))
      group by
        u.url,
        u.domain_norm
    ),

    types_breakdown as materialized (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('type', x.url_type, 'share_pct', x.share_pct)
          order by x.share_pct desc, x.url_type asc
        ), '[]'::jsonb) as items
      from (
        select
          coalesce(su.url_type::text, 'uncategorized') as url_type,
          case when sum(sum(u.citations_count)) over () > 0
               then round((sum(u.citations_count)::numeric * 100.0)
                          / sum(sum(u.citations_count)) over (), 2)
               else 0 end as share_pct
        from current_domain_urls u
        left join app.source_url su on su.url = u.url
        group by coalesce(su.url_type::text, 'uncategorized')
      ) x
    ),

    url_brand_flags as materialized (
      select
        cdu.url,

        bool_or(tc.role = 'own') as mentions_you,
        bool_or(tc.role = 'competitor') as mentions_competitor,
        bool_or(tc.role in ('own', 'competitor')) as mentions_tracked_brand,

        count(distinct case when tc.role = 'own' then tc.company_id end)::int as own_brands_count,
        count(distinct case when tc.role = 'competitor' then tc.company_id end)::int as competitor_brands_count,
        count(distinct case when tc.role in ('own', 'competitor') then tc.company_id end)::int as tracked_brands_count

      from current_domain_urls cdu
      left join app.url_company_mention ucm
        on ucm.url = cdu.url
       and (ucm.team_id is null or ucm.team_id = $1)
      left join app.team_company tc
        on tc.team_id = $1
       and tc.company_id = ucm.company_id
       and tc.role in ('own', 'competitor')
      group by cdu.url
    ),

    source_presence as (
      select
        coalesce((select sc.dom_runs_total from sum_cur sc), 0)::int as ai_searches_citing_domain,

        count(*)::int as cited_urls_count,

        count(*) filter (
          where coalesce(ubf.mentions_tracked_brand, false)
        )::int as urls_with_tracked_brands,

        count(*) filter (
          where coalesce(ubf.mentions_you, false)
        )::int as urls_mentioning_you,

        count(*) filter (
          where coalesce(ubf.mentions_competitor, false)
        )::int as urls_mentioning_competitors,

        count(*) filter (
          where coalesce(ubf.mentions_competitor, false)
            and not coalesce(ubf.mentions_you, false)
        )::int as competitor_only_urls,

        count(*) filter (
          where coalesce(ubf.mentions_competitor, false)
            and coalesce(ubf.mentions_you, false)
        )::int as overlap_urls,

        count(*) filter (
          where not coalesce(ubf.mentions_tracked_brand, false)
        )::int as urls_without_tracked_brands

      from current_domain_urls cdu
      left join url_brand_flags ubf
        on ubf.url = cdu.url
    ),

    source_presence_enriched as (
      select
        sp.*,

        case
          when sp.cited_urls_count > 0
          then round(sp.urls_with_tracked_brands::numeric * 100.0 / sp.cited_urls_count, 2)
          else 0
        end as tracked_brand_presence_pct,

        case
          when sp.cited_urls_count > 0
          then round(sp.urls_mentioning_you::numeric * 100.0 / sp.cited_urls_count, 2)
          else 0
        end as your_url_presence_pct,

        case
          when sp.cited_urls_count > 0
          then round(sp.urls_mentioning_competitors::numeric * 100.0 / sp.cited_urls_count, 2)
          else 0
        end as competitor_url_presence_pct,

        case
          when sp.cited_urls_count > 0
          then round(sp.competitor_only_urls::numeric * 100.0 / sp.cited_urls_count, 2)
          else 0
        end as competitor_only_share_pct,

        case
          when sp.cited_urls_count > 0
          then round(
            (
              (sp.urls_mentioning_competitors::numeric * 100.0 / sp.cited_urls_count)
              -
              (sp.urls_mentioning_you::numeric * 100.0 / sp.cited_urls_count)
            ),
            2
          )
          else 0
        end as opportunity_gap_pct,

        case
          when sp.cited_urls_count > 0
          then round(
            (
              (sp.urls_mentioning_you::numeric * 100.0 / sp.cited_urls_count)
              -
              (sp.urls_mentioning_competitors::numeric * 100.0 / sp.cited_urls_count)
            ),
            2
          )
          else 0
        end as presence_gap_pct

      from source_presence sp
    )__USH_CTES__

    select jsonb_build_object(
      'header', jsonb_build_object(
        'id',                     $2,
        'domain',                 $2,
        'favicon',                (select d.favicon from dom d),
        'citation_type',          (select e.effective_type from effective e),
        'first_seen',
          to_char(
            coalesce(
              (select ts.first_seen from team_seen ts),
              (select d.first_seen::date from dom d)
            ),
            'YYYY-MM-DD'
          ),
        'last_seen',
          to_char(
            coalesce(
              (select ts.last_seen from team_seen ts),
              (select d.last_seen::date from dom d)
            ),
            'YYYY-MM-DD'
          ),
        'total_citations_count',  coalesce((select sc.dom_inst_total from sum_cur sc), 0),
        'total_citations_prev',   coalesce((select sp.dom_inst_total_prev from sum_prev sp), 0),
        'total_citations_delta_pct',
          (
            select
              case
                when sp.dom_inst_total_prev > 0
                then round(
                  ((sc.dom_inst_total - sp.dom_inst_total_prev)::numeric / sp.dom_inst_total_prev::numeric) * 100,
                  2
                )
                else null
              end
            from sum_cur sc, sum_prev sp
          ),
        'current_citation_share', coalesce((select sc.share_total_runs from sum_cur sc), 0),
        'citation_share_prev',    coalesce((select sp.share_total_runs_prev from sum_prev sp), 0),
        'citation_share_delta_pct',
          (
            select
              case
                when coalesce(sp.total_runs_all_prev, 0) > 0
                then sc.share_total_runs - sp.share_total_runs_prev
                else null
              end
            from sum_cur sc, sum_prev sp
          )
      ),

      'model_breakdown',
        coalesce(
          (select mb.items from model_breakdown mb),
          '[]'::jsonb
        ),

      'types_breakdown',
        coalesce(
          (select tb.items from types_breakdown tb),
          '[]'::jsonb
        ),

      'timeseries', jsonb_build_object(
        'citation_share_over_time',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'day',       to_char(c.day, 'YYYY-MM-DD'),
                'share_pct',
                  case
                    when c.total_runs > 0
                    then round((c.dom_runs::numeric / c.total_runs::numeric) * 100, 2)
                    else null
                  end
              )
              order by c.day
            )
            from cur c
          ), '[]'::jsonb),

        'citations_over_time',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'day',   to_char(c.day, 'YYYY-MM-DD'),
                'count', c.dom_inst
              )
              order by c.day
            )
            from cur c
          ), '[]'::jsonb),

        'runs_over_time',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'day',   to_char(c.day, 'YYYY-MM-DD'),
                'count', c.dom_runs
              )
              order by c.day
            )
            from cur c
          ), '[]'::jsonb)
      ),

      'source_presence_funnel',
        (
          select jsonb_build_object(
            'ai_searches_citing_domain',       spe.ai_searches_citing_domain,
            'cited_urls_count',                spe.cited_urls_count,

            'urls_with_tracked_brands',         spe.urls_with_tracked_brands,
            'urls_mentioning_you',             spe.urls_mentioning_you,
            'urls_mentioning_competitors',     spe.urls_mentioning_competitors,

            'competitor_only_urls',            spe.competitor_only_urls,
            'overlap_urls',                    spe.overlap_urls,
            'urls_without_tracked_brands',     spe.urls_without_tracked_brands,

            'tracked_brand_presence_pct',      spe.tracked_brand_presence_pct,
            'your_url_presence_pct',           spe.your_url_presence_pct,
            'competitor_url_presence_pct',     spe.competitor_url_presence_pct,
            'competitor_only_share_pct',       spe.competitor_only_share_pct,

            'opportunity_gap_pct',             spe.opportunity_gap_pct,
            'presence_gap_pct',                spe.presence_gap_pct,
            'opportunity_gap_urls',            spe.competitor_only_urls
          )
          from source_presence_enriched spe
        ),

      __USH_KEY__'granularity', $9
    )
  $q$;

  if v_urlshare = 'yes' then
    v_ush_ctes := $ush$,

    ush_prompt_filter as materialized (
      select pf_all.id
      from prompt_filter pf_all
    ),

    ush_url_runs as materialized (
      select
        u.__URL_COL__ as day,
        u.url,
        sum(u.runs_with_url)::int as url_runs,
        max(u.last_used_at)       as last_seen_team
      from __URL_TBL__ u
      join ush_prompt_filter pf on pf.id = u.prompt_id
      where u.team_id = $1
        and u.__URL_COL__ between $4 and $5
        and u.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or u.model = any($3))
      group by u.__URL_COL__, u.url
    ),

    ush_total_runs_window as materialized (
      select coalesce(sum(drm.runs_total), 0)::int as cnt
      from __RBM_TBL__ drm
      where drm.team_id = $1
        and drm.__RBM_COL__ between $4 and $5
        and ($3 is null or cardinality($3) = 0 or drm.model = any($3))
    ),

    ush_total_runs_by_day as materialized (
      select
        drm.__RBM_COL__ as day,
        coalesce(sum(drm.runs_total), 0)::int as total_runs
      from __RBM_TBL__ drm
      where drm.team_id = $1
        and drm.__RBM_COL__ between $4 and $5
        and ($3 is null or cardinality($3) = 0 or drm.model = any($3))
      group by drm.__RBM_COL__
    ),

    ush_dom_run_count_window as materialized (
      select coalesce(sum(d.runs_with_domain), 0)::int as cnt
      from __DOM_TBL__ d
      join ush_prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = $1
        and d.__DOM_COL__ between $4 and $5
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
    ),

    ush_dom_runs_by_day as materialized (
      select
        d.__DOM_COL__ as day,
        coalesce(sum(d.runs_with_domain), 0)::int as domain_runs
      from __DOM_TBL__ d
      join ush_prompt_filter pf on pf.id = d.prompt_id
      where d.team_id = $1
        and d.__DOM_COL__ between $4 and $5
        and d.domain_norm = $2
        and ($3 is null or cardinality($3) = 0 or d.model = any($3))
      group by d.__DOM_COL__
    ),

    ush_url_stats as materialized (
      select
        u.url,
        sum(u.url_runs)::int as url_runs_total,
        max(u.last_seen_team) as last_seen_team,
        case
          when (select cnt from ush_total_runs_window) > 0
          then round(
            sum(u.url_runs)::numeric * 100.0
            / (select cnt from ush_total_runs_window)::numeric,
            4
          )
          else 0
        end as global_share_pct,
        case
          when (select cnt from ush_dom_run_count_window) > 0
          then round(
            sum(u.url_runs)::numeric * 100.0
            / (select cnt from ush_dom_run_count_window)::numeric,
            4
          )
          else 0
        end as domainshare_pct
      from ush_url_runs u
      group by u.url
    ),

    ush_top_urls as materialized (
      select
        s.url,
        s.url_runs_total,
        s.global_share_pct,
        s.domainshare_pct,
        case
          when $10 = 'domain' then s.domainshare_pct
          else s.global_share_pct
        end as share_total_pct
      from ush_url_stats s
      order by
        case when $10 = 'domain' then s.domainshare_pct else s.global_share_pct end desc nulls last,
        s.url_runs_total desc nulls last,
        s.url asc
      limit 5
    ),

    ush_url_meta as materialized (
      select distinct on (su.url)
        su.url,
        su.title,
        su.description
      from app.source_url su
      join ush_top_urls t on t.url = su.url
      order by su.url, su.first_seen
    ),

    ush_grid as materialized (
      select ds.day, t.url
      from spine_cur ds
      cross join ush_top_urls t
    ),

    ush_series as materialized (
      select
        g.day,
        g.url,
        case
          when $10 = 'domain' then
            case
              when coalesce(dr.domain_runs, 0) > 0 and u.url_runs is not null
              then round(u.url_runs::numeric * 100.0 / dr.domain_runs::numeric, 2)
              else null
            end
          else
            case
              when coalesce(rt.total_runs, 0) > 0 and u.url_runs is not null
              then round(u.url_runs::numeric * 100.0 / rt.total_runs::numeric, 2)
              else null
            end
        end as share_pct
      from ush_grid g
      left join ush_url_runs u on u.day = g.day and u.url = g.url
      left join ush_total_runs_by_day rt on rt.day = g.day
      left join ush_dom_runs_by_day dr on dr.day = g.day
    )$ush$;
    v_ush_key := $ushk$'url_share', jsonb_build_object(
        'domain', $2,
        'from',   to_char($11, 'YYYY-MM-DD'),
        'to',     to_char($12, 'YYYY-MM-DD'),
        'top_n',  5,
        'share_mode', $10,
        'points',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'url', left(st.url, 60),
                'title',
                  left(
                    (
                      case
                        when nullif(
                               btrim(regexp_replace(coalesce(um.title, ''), '\s+', ' ', 'g')),
                               ''
                             ) is not null
                        then btrim(regexp_replace(coalesce(um.title, ''), '\s+', ' ', 'g'))
                        else nullif(
                               left(
                                 btrim(regexp_replace(coalesce(um.description, ''), '\s+', ' ', 'g')),
                                 150
                               ),
                               ''
                             )
                      end
                    ),
                    60
                  ),
                'day',       to_char(st.day, 'YYYY-MM-DD'),
                'share_pct', st.share_pct,
                'share_total_pct', tu.share_total_pct,
                'global_share_total_pct', tu.global_share_pct,
                'domain_share_total_pct', tu.domainshare_pct,
                'url_runs_total', tu.url_runs_total
              )
              order by st.day, tu.share_total_pct desc, st.url
            )
            from ush_series st
            join ush_top_urls tu on tu.url = st.url
            left join ush_url_meta um on um.url = st.url
          ), '[]'::jsonb)
      ),

      $ushk$;
  end if;

  v_sql := replace(v_sql, '__USH_CTES__', v_ush_ctes);
  v_sql := replace(v_sql, '__USH_KEY__', v_ush_key);
  v_sql := replace(v_sql, '__RUN_TBL__', v_run_tbl);
  v_sql := replace(v_sql, '__RUN_COL__', v_run_col);
  v_sql := replace(v_sql, '__DOM_TBL__', v_dom_tbl);
  v_sql := replace(v_sql, '__DOM_COL__', v_dom_col);
  v_sql := replace(v_sql, '__URL_TBL__', v_url_tbl);
  v_sql := replace(v_sql, '__URL_COL__', v_url_col);
  v_sql := replace(v_sql, '__RBM_TBL__', v_rbm_tbl);
  v_sql := replace(v_sql, '__RBM_COL__', v_rbm_col);

  execute v_sql
  into v_result
  using
    p_team,                                              -- $1
    v_dom,                                               -- $2
    p_models,                                            -- $3
    case when v_granularity = 'day' then v_from else v_bucket_from end,  -- $4
    case when v_granularity = 'day' then v_to   else v_bucket_to   end,  -- $5
    v_from_prev,                                         -- $6
    v_to_prev,                                           -- $7
    v_bucket_step,                                       -- $8
    v_granularity,                                       -- $9
    v_share_mode,                                        -- $10
    v_from,                                              -- $11
    v_to,                                                -- $12
    p_markets,                                           -- $13
    p_tag_ids,                                           -- $14
    v_tagmode;                                           -- $15

  return app.js_safe(v_result);
end;
$function$;

CREATE OR REPLACE FUNCTION app.get_domain_url_share_over_time_v5(p_team uuid, p_domain text, p_date_from date, p_date_to date, p_models text[] DEFAULT NULL::text[], p_share text DEFAULT 'global'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_from       date;
  v_to         date;
  v_share_mode text;
  v_dom        text;
begin
  perform app.check_rate_limit('domainshare_overtime', 30);

  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from app.team_member tm
    where tm.team_id = p_team
      and tm.user_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  if coalesce(nullif(trim(p_domain), ''), '') = '' then
    raise exception 'domain required';
  end if;

  v_dom := regexp_replace(lower(btrim(p_domain)), '^www\.', '');
  v_from := coalesce(p_date_from, current_date - 6);
  v_to   := coalesce(p_date_to,   current_date);

  if v_to < v_from then
    raise exception 'invalid date range';
  end if;

  v_share_mode := lower(coalesce(p_share, 'global'));
  if v_share_mode not in ('global', 'domain') then
    v_share_mode := 'global';
  end if;

  return (
    with
    url_runs_by_day as (
      select
        u.day,
        u.url,
        sum(u.runs_with_url)::int as url_runs
      from app.daily_citation_url_rollup u
      where u.team_id = p_team
        and u.day between v_from and v_to
        and u.domain_norm = v_dom
        and (p_models is null or cardinality(p_models) = 0 or u.model = any(p_models))
      group by u.day, u.url
    ),

    runs_total_by_day as (
      select
        r.day,
        sum(r.runs_with_any_citation)::int as total_runs
      from app.daily_citation_run_rollup r
      where r.team_id = p_team
        and r.day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
      group by r.day
    ),

    dom_runs_total_by_day as (
      select
        u.day,
        sum(u.url_runs)::int as dom_url_runs_total
      from url_runs_by_day u
      group by u.day
    ),

    date_spine as (
      select generate_series(v_from, v_to, interval '1 day')::date as day
    ),

    summary_by_url as (
      select
        u.url,
        sum(u.url_runs)::int    as url_runs_total,
        sum(rt.total_runs)::int as total_runs_all,
        case
          when sum(rt.total_runs) > 0
          then round((sum(u.url_runs)::numeric / sum(rt.total_runs)::numeric) * 100, 4)
          else 0
        end as share_total_runs
      from url_runs_by_day u
      join runs_total_by_day rt
        on rt.day = u.day
      group by u.url
    ),

    domain_total_window as (
      select coalesce(sum(u.url_runs), 0)::int as dom_url_runs_total_window
      from url_runs_by_day u
    ),

    top_urls as (
      select
        s.url,
        s.share_total_runs,
        s.url_runs_total
      from summary_by_url s
      order by s.share_total_runs desc, s.url
      limit 5
    ),

    url_meta as (
      select distinct on (su.url)
        su.url,
        su.title,
        su.description
      from app.source_url su
      join top_urls t
        on t.url = su.url
      order by su.url, su.first_seen
    ),

    url_day_grid as (
      select
        s.day,
        t.url
      from date_spine s
      cross join top_urls t
    ),

    share_timeseries as (
      select
        g.day,
        g.url,
        case
          when v_share_mode = 'domain' then
            case
              when coalesce(dr.dom_url_runs_total, 0) > 0 and u.url_runs is not null
              then round((u.url_runs::numeric / dr.dom_url_runs_total::numeric) * 100, 2)
              else null
            end
          else
            case
              when coalesce(rt.total_runs, 0) > 0 and u.url_runs is not null
              then round((u.url_runs::numeric / rt.total_runs::numeric) * 100, 2)
              else null
            end
        end as share_pct
      from url_day_grid g
      left join runs_total_by_day rt
        on rt.day = g.day
      left join dom_runs_total_by_day dr
        on dr.day = g.day
      left join url_runs_by_day u
        on u.day = g.day
       and u.url = g.url
    )

    select jsonb_build_object(
      'domain', v_dom,
      'from',   to_char(v_from, 'YYYY-MM-DD'),
      'to',     to_char(v_to,   'YYYY-MM-DD'),
      'top_n',  5,
      'points',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'url', left(st.url, 60),
              'title',
                left(
                  (
                    case
                      when nullif(
                             btrim(regexp_replace(coalesce(um.title, ''), '\s+', ' ', 'g')),
                             ''
                           ) is not null
                      then btrim(regexp_replace(coalesce(um.title, ''), '\s+', ' ', 'g'))
                      else nullif(
                             left(
                               btrim(regexp_replace(coalesce(um.description, ''), '\s+', ' ', 'g')),
                               150
                             ),
                             ''
                           )
                    end
                  ),
                  60
                ),
              'day',       to_char(st.day, 'YYYY-MM-DD'),
              'share_pct', st.share_pct,
              'share_total_pct',
                case
                  when v_share_mode = 'domain' then
                    case
                      when dtw.dom_url_runs_total_window > 0
                      then round(
                        (tu.url_runs_total::numeric / dtw.dom_url_runs_total_window::numeric) * 100,
                        4
                      )
                      else 0
                    end
                  else
                    tu.share_total_runs
                end,
              'url_runs_total', tu.url_runs_total
            )
            order by st.day, st.url
          )
          from share_timeseries st
          join top_urls tu
            on tu.url = st.url
          left join url_meta um
            on um.url = st.url
          cross join domain_total_window dtw
        ), '[]'::jsonb)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION app.get_domain_url_share_over_time_v6(p_team uuid, p_domain text, p_date_from date, p_date_to date, p_models text[] DEFAULT NULL::text[], p_share text DEFAULT 'global'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
declare
  v_from       date;
  v_to         date;
  v_share_mode text;
  v_dom        text;
begin
  perform app.check_rate_limit('domainshare_overtime', 30);

  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from app.team_member tm
    where tm.team_id = p_team
      and tm.user_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  if coalesce(nullif(trim(p_domain), ''), '') = '' then
    raise exception 'domain required';
  end if;

  perform set_config('jit', 'off', true);

  v_dom := regexp_replace(lower(btrim(p_domain)), '^www\.', '');
  v_from := coalesce(p_date_from, current_date - 6);
  v_to   := coalesce(p_date_to,   current_date);

  if v_to < v_from then
    raise exception 'invalid date range';
  end if;

  v_share_mode := lower(coalesce(p_share, 'global'));
  if v_share_mode not in ('global', 'domain') then
    v_share_mode := 'global';
  end if;

  return (
    with

    /*
      Same baseline as get_citation_urls_v29 domain path:
      all prompts of the team, because this RPC has no tag/market/search filters.
    */
    prompt_filter as materialized (
      select p.id
      from app.prompt p
      where p.team_id = p_team
    ),

    dom_norm as (
      select v_dom as domain_l
    ),

    /*
      URL runs inside the selected domain, grouped by day + URL.
      This is the daily source for the linechart.
    */
    url_runs_by_day as materialized (
      select
        u.day,
        u.url,
        sum(u.runs_with_url)::int as url_runs,
        max(u.last_used_at)       as last_seen_team
      from app.daily_citation_url_rollup u
      join prompt_filter pf
        on pf.id = u.prompt_id
      join dom_norm d
        on u.domain_norm = d.domain_l
      where u.team_id = p_team
        and u.day between v_from and v_to
        and (
          p_models is null
          or cardinality(p_models) = 0
          or u.model = any(p_models)
        )
      group by u.day, u.url
    ),

    /*
      Exact get_citation_urls_v29 domain-path global denominator:
      total runs in the selected window from daily_runs_by_model.
    */
    total_runs_window as materialized (
      select coalesce(sum(drm.runs_total), 0)::int as cnt
      from app.daily_runs_by_model drm
      where drm.team_id = p_team
        and drm.day between v_from and v_to
        and (
          p_models is null
          or cardinality(p_models) = 0
          or drm.model = any(p_models)
        )
    ),

    /*
      Daily global denominator for the linechart.
      Same table as v29 denominator, just grouped per day.
    */
    total_runs_by_day as materialized (
      select
        drm.day,
        coalesce(sum(drm.runs_total), 0)::int as total_runs
      from app.daily_runs_by_model drm
      where drm.team_id = p_team
        and drm.day between v_from and v_to
        and (
          p_models is null
          or cardinality(p_models) = 0
          or drm.model = any(p_models)
        )
      group by drm.day
    ),

    /*
      Exact get_citation_urls_v29 domain-path domain denominator:
      runs_with_domain in the selected window.
    */
    dom_run_count_window as materialized (
      select coalesce(sum(d.runs_with_domain), 0)::int as cnt
      from app.daily_citation_domain_rollup d
      join prompt_filter pf
        on pf.id = d.prompt_id
      join dom_norm dn
        on d.domain_norm = dn.domain_l
      where d.team_id = p_team
        and d.day between v_from and v_to
        and (
          p_models is null
          or cardinality(p_models) = 0
          or d.model = any(p_models)
        )
    ),

    /*
      Daily domain denominator for the linechart.
    */
    dom_runs_by_day as materialized (
      select
        d.day,
        coalesce(sum(d.runs_with_domain), 0)::int as domain_runs
      from app.daily_citation_domain_rollup d
      join prompt_filter pf
        on pf.id = d.prompt_id
      join dom_norm dn
        on d.domain_norm = dn.domain_l
      where d.team_id = p_team
        and d.day between v_from and v_to
        and (
          p_models is null
          or cardinality(p_models) = 0
          or d.model = any(p_models)
        )
      group by d.day
    ),

    /*
      Window URL stats.
      This is now aligned with get_citation_urls_v29 domain path:
      - used_total = sum runs_with_url
      - global_share_pct = used_total / total_runs_window
      - domainshare_pct = used_total / dom_run_count_window
    */
    url_stats_window as materialized (
      select
        u.url,
        sum(u.url_runs)::int as url_runs_total,
        max(u.last_seen_team) as last_seen_team,

        case
          when (select cnt from total_runs_window) > 0
          then round(
            sum(u.url_runs)::numeric * 100.0
            / (select cnt from total_runs_window)::numeric,
            4
          )
          else 0
        end as global_share_pct,

        case
          when (select cnt from dom_run_count_window) > 0
          then round(
            sum(u.url_runs)::numeric * 100.0
            / (select cnt from dom_run_count_window)::numeric,
            4
          )
          else 0
        end as domainshare_pct

      from url_runs_by_day u
      group by u.url
    ),

    /*
      Top 5 URLs:
      same ordering semantics as get_citation_urls_v29:
      - p_share = global => global_share_pct desc
      - p_share = domain => domainshare_pct desc
    */
    top_urls as materialized (
      select
        s.url,
        s.url_runs_total,
        s.global_share_pct,
        s.domainshare_pct,
        case
          when v_share_mode = 'domain' then s.domainshare_pct
          else s.global_share_pct
        end as share_total_pct
      from url_stats_window s
      order by
        case when v_share_mode = 'domain' then s.domainshare_pct else s.global_share_pct end desc nulls last,
        s.url_runs_total desc nulls last,
        s.url asc
      limit 5
    ),

    url_meta as materialized (
      select distinct on (su.url)
        su.url,
        su.title,
        su.description
      from app.source_url su
      join top_urls t
        on t.url = su.url
      order by su.url, su.first_seen
    ),

    date_spine as materialized (
      select generate_series(v_from, v_to, interval '1 day')::date as day
    ),

    /*
      Keep stable max 5 lines:
      every day x selected top_urls.
    */
    url_day_grid as materialized (
      select
        ds.day,
        t.url
      from date_spine ds
      cross join top_urls t
    ),

    share_timeseries as materialized (
      select
        g.day,
        g.url,
        case
          when v_share_mode = 'domain' then
            case
              when coalesce(dr.domain_runs, 0) > 0 and u.url_runs is not null
              then round(u.url_runs::numeric * 100.0 / dr.domain_runs::numeric, 2)
              else null
            end
          else
            case
              when coalesce(rt.total_runs, 0) > 0 and u.url_runs is not null
              then round(u.url_runs::numeric * 100.0 / rt.total_runs::numeric, 2)
              else null
            end
        end as share_pct
      from url_day_grid g
      left join url_runs_by_day u
        on u.day = g.day
       and u.url = g.url
      left join total_runs_by_day rt
        on rt.day = g.day
      left join dom_runs_by_day dr
        on dr.day = g.day
    )

    select jsonb_build_object(
      'domain', v_dom,
      'from',   to_char(v_from, 'YYYY-MM-DD'),
      'to',     to_char(v_to,   'YYYY-MM-DD'),
      'top_n',  5,
      'share_mode', v_share_mode,
      'points',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'url', left(st.url, 60),
              'title',
                left(
                  (
                    case
                      when nullif(
                             btrim(regexp_replace(coalesce(um.title, ''), '\s+', ' ', 'g')),
                             ''
                           ) is not null
                      then btrim(regexp_replace(coalesce(um.title, ''), '\s+', ' ', 'g'))
                      else nullif(
                             left(
                               btrim(regexp_replace(coalesce(um.description, ''), '\s+', ' ', 'g')),
                               150
                             ),
                             ''
                           )
                    end
                  ),
                  60
                ),
              'day',       to_char(st.day, 'YYYY-MM-DD'),
              'share_pct', st.share_pct,
              'share_total_pct', tu.share_total_pct,
              'global_share_total_pct', tu.global_share_pct,
              'domain_share_total_pct', tu.domainshare_pct,
              'url_runs_total', tu.url_runs_total
            )
            order by st.day, tu.share_total_pct desc, st.url
          )
          from share_timeseries st
          join top_urls tu
            on tu.url = st.url
          left join url_meta um
            on um.url = st.url
        ), '[]'::jsonb)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION app.add_team_domain_override(p_team uuid, p_domain text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_dom  text := app._url_domain_norm(p_domain);
  v_role text := lower(btrim(p_role));
begin
  perform app.check_rate_limit('create_domainoverride', 30);
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from app.team_member tm
    where tm.team_id = p_team and tm.user_id = v_user
  ) then
    raise exception 'forbidden';
  end if;

  if v_dom is null or v_dom = '' or v_dom !~ '\.' then
    raise exception 'domain required';
  end if;

  if v_role not in ('own','competitor') then
    raise exception 'invalid role (use ''own'' or ''competitor'')';
  end if;

  insert into app.team_domain_override (team_id, domain, role, created_by)
  values (p_team, v_dom, v_role, v_user)
  on conflict (team_id, domain) do update
    set role       = excluded.role,
        created_by = v_user,
        created_at = now();

  return jsonb_build_object('status','ok');
end;
$function$;

CREATE OR REPLACE FUNCTION app.remove_team_domain_override(p_team uuid, p_domain text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_dom  text := app._url_domain_norm(p_domain);
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from app.team_member tm
    where tm.team_id = p_team and tm.user_id = v_user
  ) then
    raise exception 'forbidden';
  end if;

  delete from app.team_domain_override
  where team_id = p_team
    and (lower(domain) = v_dom or lower(domain) = lower(btrim(p_domain)));

  return jsonb_build_object('status','ok');
end;
$function$;

CREATE OR REPLACE FUNCTION app.update_team_company_display_name_v1(p_team uuid, p_company_id uuid, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$declare
  v_uid            uuid := auth.uid();
  v_company_name   text;
  v_new_name       text;
  v_is_linked      boolean;
  v_has_profile    boolean;
  v_effective_name text;
begin
  /* ---------- Auth ---------- */
  if v_uid is null then
    return jsonb_build_object(
      'status', 'error',
      'status_message', 'You need to be logged in.',
      'expected_response', 'status=ok'
    );
  end if;

  /* ---------- Input validation ---------- */
  v_new_name := nullif(btrim(p_name), '');
  if p_team is null or p_company_id is null or v_new_name is null then
    return jsonb_build_object(
      'status', 'error',
      'status_message', 'Team, company, and name are required.',
      'expected_response', 'status=ok'
    );
  end if;

 /* ---------- Team membership + role check (owner/admin) ---------- */
if not exists (
  select 1
  from app.team_member tm
  where tm.team_id = p_team
    and tm.user_id = v_uid
    and tm.role::text in ('owner', 'admin')
) then
  return jsonb_build_object(
    'status', 'error',
    'status_message', 'Only admins or owners can make changes here.',
    'expected_response', 'status=ok'
  );
end if;

  /* ---------- Must be linked as own/competitor ---------- */
  select exists (
    select 1
    from app.team_company tc
    where tc.team_id = p_team
      and tc.company_id = p_company_id
      and tc.role in ('own','competitor')
  ) into v_is_linked;

  if not v_is_linked then
    return jsonb_build_object(
      'status', 'error',
      'status_message', 'This company is not tracked in your team.',
      'expected_response', 'status=ok'
    );
  end if;

  /* ---------- Load global company name ---------- */
  select c.name
    into v_company_name
  from app.company c
  where c.id = p_company_id;

  if v_company_name is null then
    return jsonb_build_object(
      'status', 'error',
      'status_message', 'Company not found.',
      'expected_response', 'status=ok'
    );
  end if;

  /* ---------- Does team_brand_profile row exist? ---------- */
  select exists (
    select 1
    from app.team_brand_profile tbp
    where tbp.team_id = p_team
      and tbp.company_id = p_company_id
  ) into v_has_profile;

  /*
    Main rule:
    - If new name differs from global company.name -> upsert override
    - If same as global -> remove override (set NULL), so UI uses global label again
  */
  if lower(btrim(v_company_name)) <> lower(btrim(v_new_name)) then
    insert into app.team_brand_profile (team_id, company_id, name_override)
    values (p_team, p_company_id, v_new_name)
    on conflict (team_id, company_id)
    do update set
      name_override = excluded.name_override,
      updated_at = now();

    v_effective_name := v_new_name;

    return jsonb_build_object(
      'status', 'ok',
      'status_message', 'Name updated.',
      'expected_response', 'status=ok',
      'team_id', p_team,
      'company_id', p_company_id,
      'name_global', v_company_name,
      'name_override', v_new_name,
      'name_effective', v_effective_name
    );
  else
    -- Same as global: remove override if present (no-op otherwise)
    if v_has_profile then
      update app.team_brand_profile tbp
         set name_override = null,
             updated_at = now()
       where tbp.team_id = p_team
         and tbp.company_id = p_company_id;
    end if;

    v_effective_name := v_company_name;

    return jsonb_build_object(
      'status', 'ok',
      'status_message', 'Name matches the global company name. Using global name.',
      'expected_response', 'status=ok',
      'team_id', p_team,
      'company_id', p_company_id,
      'name_global', v_company_name,
      'name_override', null,
      'name_effective', v_effective_name
    );
  end if;

exception
  when others then
    return jsonb_build_object(
      'status', 'error',
      'status_message', 'Something went wrong while saving the name. Please try again.',
      'expected_response', 'status=ok'
    );
end;$function$;

CREATE OR REPLACE FUNCTION app.add_company_alias_v1(p_team uuid, p_company uuid, p_pattern text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$DECLARE
  v_user uuid := auth.uid();
  v_pattern text;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN

perform app.check_rate_limit('create_alias', 20);

  /* ==== Auth / Team check ==== */
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

 IF NOT EXISTS (
  SELECT 1
  FROM app.team_member tm
  WHERE tm.team_id = p_team
    AND tm.user_id = v_user
    AND tm.role::text IN ('owner', 'admin')
) THEN
  RAISE EXCEPTION 'forbidden';
END IF;


  v_pattern := btrim(COALESCE(p_pattern,''));
  IF v_pattern = '' THEN
    RAISE EXCEPTION 'pattern required';
  END IF;

  /* ==== avoid duplicates (case-insensitive) ==== */
  SELECT ca.id
    INTO v_existing_id
  FROM app.company_alias ca
  WHERE ca.team_id = p_team
    AND ca.company_id = p_company
    AND lower(ca.pattern) = lower(v_pattern)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'alias_id', v_existing_id,
      'pattern',  v_pattern,
      'status',   'exists'
    );
  END IF;

  /* ==== insert with defaults ==== */
  INSERT INTO app.company_alias (
    team_id,
    company_id,
    pattern
  )
  VALUES (
    p_team,
    p_company,
    v_pattern
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'alias_id', v_new_id,
    'pattern',  v_pattern,
    'status',   'inserted'
  );
END;$function$;

CREATE OR REPLACE FUNCTION app.toggle_company_alias_v1(p_team uuid, p_alias_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$DECLARE
  v_user uuid := auth.uid();
  v_new_active boolean;
BEGIN
  /* ==== Auth / Team check ==== */
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM app.team_member tm
    WHERE tm.team_id = p_team
      AND tm.user_id = v_user
      AND tm.role::text IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_alias_id IS NULL THEN
    RAISE EXCEPTION 'alias_id required';
  END IF;

  /* ==== toggle only if alias belongs to team ==== */
  UPDATE app.company_alias ca
  SET is_active = NOT ca.is_active
  WHERE ca.id = p_alias_id
    AND ca.team_id = p_team
  RETURNING ca.is_active INTO v_new_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'alias not found';
  END IF;

  RETURN jsonb_build_object(
    'alias_id',  p_alias_id,
    'is_active', v_new_active,
    'status',    'toggled'
  );
END;$function$;

CREATE OR REPLACE FUNCTION app.delete_company_alias_v1(p_team uuid, p_alias_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$DECLARE
  v_user uuid := auth.uid();
BEGIN
  /* ==== Auth / Team check ==== */
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

IF NOT EXISTS (
  SELECT 1
  FROM app.team_member tm
  WHERE tm.team_id = p_team
    AND tm.user_id = v_user
    AND tm.role::text IN ('owner', 'admin')
) THEN
  RAISE EXCEPTION 'forbidden';
END IF;


  IF p_alias_id IS NULL THEN
    RAISE EXCEPTION 'alias_id required';
  END IF;

  DELETE FROM app.company_alias ca
  WHERE ca.id = p_alias_id
    AND ca.team_id = p_team;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'alias not found';
  END IF;

  RETURN jsonb_build_object(
    'alias_id', p_alias_id,
    'status',   'deleted'
  );
END;$function$;

CREATE OR REPLACE FUNCTION app.set_company_color_override_v1(p_team uuid, p_company uuid, p_color text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$DECLARE
  v_user  uuid := auth.uid();
  v_color text;
BEGIN
  /* ==== Auth / Team check ==== */
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

IF NOT EXISTS (
  SELECT 1
  FROM app.team_member tm
  WHERE tm.team_id = p_team
    AND tm.user_id = v_user
    AND tm.role::text IN ('owner', 'admin')
) THEN
  RAISE EXCEPTION 'forbidden';
END IF;


  IF p_company IS NULL THEN
    RAISE EXCEPTION 'company required';
  END IF;

  /* ==== normalize / validate color ==== */
  v_color := NULLIF(btrim(COALESCE(p_color,'')), '');

  IF v_color IS NOT NULL THEN
    IF v_color !~* '^#?[0-9a-f]{6}$' THEN
      RAISE EXCEPTION 'invalid hex color';
    END IF;

    IF left(v_color,1) <> '#' THEN
      v_color := '#' || v_color;
    END IF;
  END IF;

  /* ==== manual upsert ==== */
  UPDATE app.team_company_settings tcs
  SET color_override = v_color
  WHERE tcs.team_id = p_team
    AND tcs.company_id = p_company;

  IF NOT FOUND THEN
    INSERT INTO app.team_company_settings (
      team_id, company_id, color_override
    )
    VALUES (
      p_team, p_company, v_color
    );
  END IF;

  RETURN jsonb_build_object(
    'company_id',     p_company,
    'color_override', v_color,
    'status',         'saved'
  );
END;$function$;

CREATE OR REPLACE FUNCTION app.clear_company_color_override_v1(p_team uuid, p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$DECLARE
  v_user uuid := auth.uid();
BEGIN
  /* ==== Auth / Team check ==== */
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
  SELECT 1
  FROM app.team_member tm
  WHERE tm.team_id = p_team
    AND tm.user_id = v_user
    AND tm.role::text IN ('owner', 'admin')
) THEN
  RAISE EXCEPTION 'forbidden';
END IF;


  IF p_company IS NULL THEN
    RAISE EXCEPTION 'company required';
  END IF;

  /* ==== UPDATE override to NULL ==== */
  UPDATE app.team_company_settings tcs
  SET color_override = NULL
  WHERE tcs.team_id = p_team
    AND tcs.company_id = p_company;

  /* kein Insert, falls es die row nicht gibt — das ist korrekt,
     denn kein Override == kein Eintrag notwendig */

  RETURN jsonb_build_object(
    'company_id', p_company,
    'color_override', NULL,
    'status', 'cleared'
  );
END;$function$;

revoke all on function app.get_domain_detail_v9(uuid,text,date,date,text[]), app.get_domain_detail_v10(uuid,text,date,date,text[]), app.get_domain_detail_v11(uuid,text,date,date,text[]), app.update_team_company_display_name_v1(uuid,uuid,text), app.add_company_alias_v1(uuid,uuid,text), app.toggle_company_alias_v1(uuid,uuid), app.delete_company_alias_v1(uuid,uuid), app.set_company_color_override_v1(uuid,uuid,text), app.clear_company_color_override_v1(uuid,uuid) from authenticated, service_role;
grant execute on function app.get_domain_detail_v9(uuid,text,date,date,text[]), app.get_domain_detail_v10(uuid,text,date,date,text[]), app.get_domain_detail_v11(uuid,text,date,date,text[]), app.update_team_company_display_name_v1(uuid,uuid,text), app.add_company_alias_v1(uuid,uuid,text), app.toggle_company_alias_v1(uuid,uuid), app.delete_company_alias_v1(uuid,uuid), app.set_company_color_override_v1(uuid,uuid,text), app.clear_company_color_override_v1(uuid,uuid) to public;
revoke all on function app.get_domain_detail_v13(uuid,text,date,date,text[],text,text,text), app.get_domain_detail_v14(uuid,text,date,date,text[],text,text,text,uuid[],text,text[]), app.cached_citation_domain_urls_v1(uuid,text,uuid[],text[],date,date,text,text,integer,integer,text,text,text[],uuid[],text[]) from service_role;
grant execute on function app.get_domain_detail_v13(uuid,text,date,date,text[],text,text,text), app.get_domain_detail_v14(uuid,text,date,date,text[],text,text,text,uuid[],text,text[]), app.cached_citation_domain_urls_v1(uuid,text,uuid[],text[],date,date,text,text,integer,integer,text,text,text[],uuid[],text[]) to public, authenticated;
revoke all on function app.add_team_domain_override(uuid,text,text), app.remove_team_domain_override(uuid,text) from service_role;
grant execute on function app.add_team_domain_override(uuid,text,text), app.remove_team_domain_override(uuid,text) to public, anon, authenticated;

commit;
