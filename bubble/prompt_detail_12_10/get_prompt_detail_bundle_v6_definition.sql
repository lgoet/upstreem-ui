CREATE OR REPLACE FUNCTION app.get_prompt_detail_bundle_v6(p_team uuid, p_prompt_id uuid, p_date_from date, p_date_to date, p_models text[] DEFAULT NULL::text[], p_limit integer DEFAULT 15, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
declare
  v_from        date;
  v_to          date;
  v_len         integer;
  v_own_company uuid;
  v_own_name    text;
begin

  perform app.check_rate_limit('prompt_detail', 30);

  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from app.team_member tm
    where tm.team_id = p_team and tm.user_id = auth.uid()
  ) then raise exception 'forbidden'; end if;

  v_from := coalesce(p_date_from, current_date - 6);
  v_to   := coalesce(p_date_to,   current_date);
  if v_to < v_from then raise exception 'invalid date range'; end if;
  v_len := (v_to - v_from + 1);

  select tc.company_id into v_own_company
  from app.team_company tc
  where tc.team_id = p_team and tc.role = 'own'
  limit 1;

  if v_own_company is not null then
    select c.name into v_own_name
    from app.company c where c.id = v_own_company;
  end if;

  return (
    with

    prompt_header as (
      select
        p.id            as prompt_id,
        p.prompt_text,
        p.market::text  as market,
        p.created_at,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id, 'name', t.name, 'emoji', t.emoji,
            'hex_light', t.hex_light, 'hex_dark', t.hex_dark
          ) order by t.name)
          from app.prompt_tag pt
          join app.tag t on t.id = pt.tag_id
          where pt.prompt_id = p.id
        ), '[]'::jsonb) as tags
      from app.prompt p
      where p.id = p_prompt_id and p.team_id = p_team
      limit 1
    ),

    date_spine as (
      select generate_series(v_from, v_to, interval '1 day')::date as day
    ),

    /* ============================================================
       TIMESERIES — daily stats, Zähler + Nenner getrennt
       Nenner: daily_runs_by_prompt_model (alle runs, kein company filter)
       Zähler: daily_company_prompt_model_stats (only own company)
       Getrennt → kein INNER JOIN Bug (Tage ohne Erwähnung bleiben im Nenner)
    ============================================================ */
    daily_total_runs as (
      -- Nenner: alle Runs pro Tag für diesen Prompt
      select day, sum(runs_total)::int as total_runs
      from app.daily_runs_by_prompt_model
      where team_id  = p_team
        and prompt_id = p_prompt_id
        and day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or model = any(p_models))
      group by day
    ),
    daily_mentioned_runs as (
      -- Zähler: Runs wo own company erwähnt, pro Tag
      select day, sum(mention_runs)::int as mentioned_runs
      from app.daily_company_prompt_model_stats
      where team_id    = p_team
        and prompt_id  = p_prompt_id
        and company_id = v_own_company
        and day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or model = any(p_models))
      group by day
    ),

    runs_per_day as (
      -- Zusammenführen per date_spine → LEFT JOIN hält Tage ohne Erwähnung
      select
        ds.day,
        coalesce(dt.total_runs, 0)     as total_runs,
        coalesce(dm.mentioned_runs, 0) as mentioned_runs
      from date_spine ds
      left join daily_total_runs    dt on dt.day = ds.day
      left join daily_mentioned_runs dm on dm.day = ds.day
    ),

    ts_vis as (
      select
        r.day,
        case
          when r.total_runs = 0 then null
          else round((r.mentioned_runs::numeric * 100.0) / r.total_runs)::int
        end as visibility_pct
      from runs_per_day r
    ),

    /* ===== TREND — aggregiert aus daily CTEs ===== */
    vis_now as (
      select
        coalesce(sum(dt.total_runs),     0)::int as total_runs_now,
        coalesce(sum(dm.mentioned_runs), 0)::int as mentioned_runs_now
      from daily_total_runs dt
      full outer join daily_mentioned_runs dm on dm.day = dt.day
    ),

    -- Vorperiode: eigene daily CTEs
    daily_total_runs_prev as (
      select day, sum(runs_total)::int as total_runs
      from app.daily_runs_by_prompt_model
      where team_id   = p_team
        and prompt_id = p_prompt_id
        and day between (v_from - v_len) and (v_from - 1)
        and (p_models is null or cardinality(p_models) = 0 or model = any(p_models))
      group by day
    ),
    daily_mentioned_runs_prev as (
      select day, sum(mention_runs)::int as mentioned_runs
      from app.daily_company_prompt_model_stats
      where team_id    = p_team
        and prompt_id  = p_prompt_id
        and company_id = v_own_company
        and day between (v_from - v_len) and (v_from - 1)
        and (p_models is null or cardinality(p_models) = 0 or model = any(p_models))
      group by day
    ),
    vis_prev as (
      select
        coalesce(sum(dt.total_runs),     0)::int as total_runs_prev,
        coalesce(sum(dm.mentioned_runs), 0)::int as mentioned_runs_prev
      from daily_total_runs_prev dt
      full outer join daily_mentioned_runs_prev dm on dm.day = dt.day
    ),

    /* ===== MODEL SPLIT — unverändert (schon daily) ===== */
    model_split_raw as (
      select d.model, sum(d.mentions)::bigint as mentions
      from app.daily_company_prompt_model_stats d
      where d.team_id   = p_team
        and d.prompt_id = p_prompt_id
        and d.day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
      group by d.model
    ),
    model_tot as (
      select coalesce(sum(mentions), 0) as total_mentions from model_split_raw
    ),

    /* ===== RANK SUMMARY =====
       avg_rank: aus daily_company_prompt_model_stats (sum_rank/count_rank)
       r1-r5 Breakdown: muss prompt_run bleiben (kein daily dafür)
    ===== */
    avg_rank_daily as (
      select
        case when sum(d.count_rank) > 0
             then round(sum(d.sum_rank)::numeric / sum(d.count_rank)::numeric, 2)
             else null end as avg_rank,
        sum(d.count_rank)::bigint as total_with_brand
      from app.daily_company_prompt_model_stats d
      where d.team_id    = p_team
        and d.prompt_id  = p_prompt_id
        and d.company_id = v_own_company
        and d.day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
    ),

    -- prompt_run: NUR noch für r1-r5 Breakdown
    pr_filtered as (
      select pr.id
      from app.prompt_run pr
      where pr.team_id   = p_team
        and pr.prompt_id = p_prompt_id
        and pr.run_day_berlin between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or pr.model = any(p_models))
    ),
    own_ranks as (
      select r.rank
      from app.recommendation r
      where r.team_id = p_team
        and r.prompt_run_id in (select id from pr_filtered)
        and (
          (v_own_company is not null and r.company_id = v_own_company)
          or (
            v_own_company is null and v_own_name is not null
            and r.company_id is null
            and lower(r.brand_name_raw) = lower(v_own_name)
          )
        )
    ),
    rank_counts as (
      select
        sum(case when rank = 1 then 1 else 0 end)::bigint as r1,
        sum(case when rank = 2 then 1 else 0 end)::bigint as r2,
        sum(case when rank = 3 then 1 else 0 end)::bigint as r3,
        sum(case when rank = 4 then 1 else 0 end)::bigint as r4,
        sum(case when rank = 5 then 1 else 0 end)::bigint as r5
      from own_ranks
    ),

    /* ===== SENTIMENT (prompt_run — kein daily) ===== */
    recent_30d_runs as (
      select pr.id
      from app.prompt_run pr
      where pr.team_id   = p_team
        and pr.prompt_id = p_prompt_id
        and pr.run_day_berlin between (current_date - 29) and current_date
    ),
    sentiment_30d as (
      select round(avg(r.sentiment)::numeric, 2) as avg_sentiment_30d
      from recent_30d_runs rr
      join app.recommendation r
        on r.prompt_run_id = rr.id
       and r.team_id       = p_team
       and r.sentiment     is not null
      where (
        (v_own_company is not null and r.company_id = v_own_company)
        or (
          v_own_company is null and v_own_name is not null
          and r.company_id is null
          and lower(r.brand_name_raw) = lower(v_own_name)
        )
      )
    )

    select jsonb_build_object(
      'header', (
        select jsonb_build_object(
          'prompt_id',   ph.prompt_id,
          'prompt_text', ph.prompt_text,
          'market',      ph.market,
          'created_at',  ph.created_at,
          'tags',        ph.tags
        )
        from prompt_header ph
      ),
      'date_from',     to_char(v_from, 'YYYY-MM-DD'),
      'date_to',       to_char(v_to,   'YYYY-MM-DD'),
      'models_filter', coalesce(to_jsonb(p_models), '[]'::jsonb),

      'timeseries', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'day',        to_char(v.day, 'YYYY-MM-DD'),
            'visibility', to_jsonb(v.visibility_pct)
          )
          order by v.day
        ), '[]'::jsonb)
        from ts_vis v
      ),

      'trend', (
        select jsonb_build_object(
          'visibility_now_pct',
            case when vn.total_runs_now > 0
                 then round((vn.mentioned_runs_now::numeric * 100.0) / vn.total_runs_now, 2)
                 else 0 end,
          'visibility_prev_pct',
            case when vp.total_runs_prev > 0
                 then round((vp.mentioned_runs_prev::numeric * 100.0) / vp.total_runs_prev, 2)
                 else 0 end,
          'visibility_delta_pct', (
            case when vn.total_runs_now > 0
                 then round((vn.mentioned_runs_now::numeric * 100.0) / vn.total_runs_now, 2)
                 else 0 end
            -
            case when vp.total_runs_prev > 0
                 then round((vp.mentioned_runs_prev::numeric * 100.0) / vp.total_runs_prev, 2)
                 else 0 end
          )
        )
        from vis_now vn, vis_prev vp
      ),

      'model_split', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'model',    ms.model,
            'share',    case when mt.total_mentions > 0
                             then round((ms.mentions::numeric * 100.0) / mt.total_mentions, 2)
                             else 0 end,
            'mentions', ms.mentions
          )
          order by ms.mentions desc
        ), '[]'::jsonb)
        from model_split_raw ms, model_tot mt
      ),

      'rank_summary', (
        select jsonb_build_object(
          'r1',               rc.r1,
          'r2',               rc.r2,
          'r3',               rc.r3,
          'r4',               rc.r4,
          'r5',               rc.r5,
          'avg_rank',         ard.avg_rank,
          'total_with_brand', ard.total_with_brand
        )
        from rank_counts rc, avg_rank_daily ard
      ),

      'avg_sentiment_30d', (
        select s.avg_sentiment_30d from sentiment_30d s
      )
    )
  );
end;
$function$
