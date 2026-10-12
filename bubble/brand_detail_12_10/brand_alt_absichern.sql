-- brand_alt_absichern.sql (12.10.2026): Altversionen des Brand-Drawers absichern. Als EIN Block.
-- Rueckweg: brand_alt_absichern_rueckweg.sql
-- get_company_detailed_overview_v4, get_company_detailed_chart_v3/v4, get_company_brand_name_variations_v2 pruefen
-- den Zugang (Abo/Plan); chart_v4 bekommt einen festen search_path. get_company_edit_v2 liefert fuer fremde Marken
-- brand_not_found statt der Firma. Alle sieben (mit export_domains_v1/export_urls_v1) nicht mehr fuer PUBLIC/anon.

begin;

do $g$
begin
  if md5(pg_get_functiondef('app.get_company_detailed_overview_v4(uuid,uuid,uuid[],text,text[],text[],date,date,uuid)'::regprocedure)) <> 'b0a30348e09e6b2e7ba99e2da2d61b91'
     or md5(pg_get_functiondef('app.get_company_detailed_chart_v3(uuid,uuid,uuid[],text,text[],text[],date,date,uuid,text)'::regprocedure)) <> '8c0c7f0db8c8d95cd7bbf91c409f848a'
     or md5(pg_get_functiondef('app.get_company_detailed_chart_v4(uuid,uuid,uuid[],text,text[],text[],date,date,uuid,text,text)'::regprocedure)) <> 'fbaceea85d782be767332cb7c4ca5913'
     or md5(pg_get_functiondef('app.get_company_brand_name_variations_v2(uuid,uuid,uuid[],text,text[],text[],date,date,uuid)'::regprocedure)) <> 'a4e70797d067cabe2bbf193b8d045347'
     or md5(pg_get_functiondef('app.get_company_edit_v2(uuid,uuid)'::regprocedure)) <> '55a353fc878c2ea37cdec3ac2c11a363'
     or md5(pg_get_functiondef('app.export_domains_v1(uuid,bigint,bigint,text[],uuid[],text,text,text,text,integer,integer)'::regprocedure)) <> '4e4765a3a0b8ae7a49721d3e1762e656'
     or md5(pg_get_functiondef('app.export_urls_v1(uuid,bigint,bigint,text[],uuid[],text,text,text,text,text,integer,integer)'::regprocedure)) <> '0b40308f964c4f21c2f6bf8ab544341f' then
    raise exception 'brand_alt_absichern: Bestand weicht ab. Nichts geaendert.';
  end if;
end $g$;

CREATE OR REPLACE FUNCTION app.get_company_detailed_overview_v4(p_team uuid, p_company uuid, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_markets text[] DEFAULT NULL::text[], p_models text[] DEFAULT NULL::text[], p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_prompt_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(company_id uuid, name text, logo_url text, domain text, role text, color text, aliases jsonb, avg_visibility_pct numeric, avg_visibility_prev_pct numeric, avg_visibility_delta_pct numeric, avg_rank numeric, avg_rank_prev numeric, avg_rank_delta numeric, avg_sentiment numeric, avg_sentiment_prev numeric, avg_sentiment_delta numeric, total_runs_now integer, total_runs_prev integer, mentions_now integer, mentions_prev integer, overall_rank_visibility integer, overall_companies_count integer, last_seen_run_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$declare
  v_user       uuid := auth.uid();
  v_from       date;
  v_to         date;
v_len        integer;
v_prev_len   integer;
  v_has_market boolean;
  v_has_tag    boolean;
  v_has_prompt boolean;
begin

  perform app.check_rate_limit('company_detailed', 30);

  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from app.team_member tm
    where tm.team_id = p_team and tm.user_id = v_user
  ) then raise exception 'forbidden'; end if;
  -- 12.10.2026: wie die neuen Seiten nur mit Zugang (Abo/Plan)
  perform app.require_team_access(p_team);

  v_from       := coalesce(p_date_from, current_date - 6);
  v_to         := coalesce(p_date_to,   current_date);
v_len        := (v_to - v_from + 1);
v_prev_len   := greatest(least(v_len / 2, 30), 1);
  v_has_market := (p_markets  is not null and cardinality(p_markets)  > 0);
  v_has_tag    := (p_tag_ids  is not null and cardinality(p_tag_ids)  > 0);
  v_has_prompt := (p_prompt_id is not null);

  if v_to < v_from then raise exception 'invalid date range'; end if;

  return query
  with

  /* ===== Team Companies ===== */
  team_companies as (
    select
      tc.company_id,
      tc.role,
      coalesce(tbp.name_override, c.name)            as name,
      coalesce(tbp.logo_override_url, c.favicon_url) as logo_url,
      case
        when nullif(tcs.color_override, '') is not null then tcs.color_override
        when nullif(c.default_color, '')    is not null then c.default_color
        else null
      end as color,
      lower(nullif(regexp_replace(coalesce(c.url, ''), '^[a-z]+://([^/]+).*', '\1'), '')) as domain
    from app.team_company tc
    join app.company c on c.id = tc.company_id
    left join app.team_brand_profile tbp
      on tbp.team_id = p_team and tbp.company_id = tc.company_id
    left join app.team_company_settings tcs
      on tcs.team_id = p_team and tcs.company_id = tc.company_id
    where tc.team_id = p_team
      and tc.role in ('own', 'competitor')
  ),

  /* ===== Aliases ===== */
  aliases_cte as (
    select ca.company_id,
      coalesce(jsonb_agg(
        jsonb_build_object('id', ca.id, 'pattern', ca.pattern, 'mode', ca.mode, 'priority', ca.priority)
        order by ca.priority asc, ca.created_at asc
      ), '[]'::jsonb) as aliases
    from app.company_alias ca
    where ca.team_id = p_team and ca.is_active = true
    group by ca.company_id
  ),

  /* ===== Tracking Periods (für p_company) ===== */
  tracking_periods as (
    select
      tp.company_id,
      tp.started_at::date                                       as start_day,
      coalesce(tp.ended_at::date, 'infinity'::date)             as end_day
    from app.team_company_tracking_period tp
    where tp.team_id = p_team
  ),

  -- Tracking Windows: Schnittmenge mit Abfragezeitraum, pro company
  tracking_window_now as materialized (
    select
      tp.company_id,
      greatest(tp.start_day, v_from)   as window_from,
      least(tp.end_day, v_to)          as window_to
    from tracking_periods tp
    where tp.company_id = p_company
      and greatest(tp.start_day, v_from) <= least(tp.end_day, v_to)
  ),
tracking_window_prev as materialized (
  select
    tp.company_id,
    greatest(tp.start_day, (v_from - v_prev_len))   as window_from,
    least(tp.end_day, (v_from - 1))                 as window_to
  from tracking_periods tp
  where tp.company_id = p_company
    and greatest(tp.start_day, (v_from - v_prev_len)) <= least(tp.end_day, (v_from - 1))
),

  /* ===== Prompt Filter ===== */
  prompt_filter as materialized (
    select p.id
    from app.prompt p
    where p.team_id = p_team
      and (not v_has_market or p.market::text = any(p_markets))
      and (
        (v_has_prompt and p.id = p_prompt_id)
        or (not v_has_prompt and (
          not v_has_tag
          or (
            (p_tagmode is null or p_tagmode = 'or')
            and exists (select 1 from app.prompt_tag pt where pt.prompt_id = p.id and pt.tag_id = any(p_tag_ids))
          )
          or (
            p_tagmode = 'and'
            and (select count(distinct pt.tag_id) from app.prompt_tag pt
                 where pt.prompt_id = p.id and pt.tag_id = any(p_tag_ids)) = cardinality(p_tag_ids)
          )
        ))
      )
  ),

  /* ============================================================
     VISIBILITY — Daily Stats
     Zähler (mention_runs) und Nenner (total_runs) GETRENNT
     aggregiert — verhindert den INNER JOIN Bug wo Tage ohne
     Company-Erwähnung den Nenner zu klein machen würden.
  ============================================================ */

  -- PATH A: Kein Filter → daily_company_model_stats
  mention_model_now as (
    select coalesce(sum(d.mention_runs), 0)::int as mention_runs
    from app.daily_company_model_stats d
    where not v_has_market and not v_has_prompt and not v_has_tag
      and d.team_id    = p_team
      and d.company_id = p_company
      and d.day between v_from and v_to
      and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
      and exists (select 1 from tracking_window_now w where d.day between w.window_from and w.window_to)
  ),
  runs_model_now as (
    select coalesce(sum(r.runs_total), 0)::int as total_runs
    from app.daily_runs_by_model r
    where not v_has_market and not v_has_prompt and not v_has_tag
      and r.team_id = p_team
      and r.day between v_from and v_to
      and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
      and exists (select 1 from tracking_window_now w where r.day between w.window_from and w.window_to)
  ),

  mention_model_prev as (
    select coalesce(sum(d.mention_runs), 0)::int as mention_runs
    from app.daily_company_model_stats d
    where not v_has_market and not v_has_prompt and not v_has_tag
      and d.team_id    = p_team
      and d.company_id = p_company
and d.day between (v_from - v_prev_len) and (v_from - 1)
      and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
      and exists (select 1 from tracking_window_prev w where d.day between w.window_from and w.window_to)
  ),
  runs_model_prev as (
    select coalesce(sum(r.runs_total), 0)::int as total_runs
    from app.daily_runs_by_model r
    where not v_has_market and not v_has_prompt and not v_has_tag
      and r.team_id = p_team
and r.day between (v_from - v_prev_len) and (v_from - 1)
      and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
      and exists (select 1 from tracking_window_prev w where r.day between w.window_from and w.window_to)
  ),

  -- PATH B/C: Prompt/Tag Filter → daily_company_prompt_model_stats
  mention_prompt_now as (
    select coalesce(sum(d.mention_runs), 0)::int as mention_runs
    from app.daily_company_prompt_model_stats d
    where (v_has_prompt or v_has_tag) and not v_has_market
      and d.team_id    = p_team
      and d.company_id = p_company
      and d.day between v_from and v_to
      and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
      and exists (select 1 from prompt_filter pf where pf.id = d.prompt_id)
      and exists (select 1 from tracking_window_now w where d.day between w.window_from and w.window_to)
  ),
  runs_prompt_now as (
    select coalesce(sum(r.runs_total), 0)::int as total_runs
    from app.daily_runs_by_prompt_model r
    where (v_has_prompt or v_has_tag) and not v_has_market
      and r.team_id = p_team
      and r.day between v_from and v_to
      and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
      and exists (select 1 from prompt_filter pf where pf.id = r.prompt_id)
      and exists (select 1 from tracking_window_now w where r.day between w.window_from and w.window_to)
  ),

  mention_prompt_prev as (
    select coalesce(sum(d.mention_runs), 0)::int as mention_runs
    from app.daily_company_prompt_model_stats d
    where (v_has_prompt or v_has_tag) and not v_has_market
      and d.team_id    = p_team
      and d.company_id = p_company
      and d.day between (v_from - v_len) and (v_from - 1)
      and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
      and exists (select 1 from prompt_filter pf where pf.id = d.prompt_id)
      and exists (select 1 from tracking_window_prev w where d.day between w.window_from and w.window_to)
  ),
  runs_prompt_prev as (
    select coalesce(sum(r.runs_total), 0)::int as total_runs
    from app.daily_runs_by_prompt_model r
    where (v_has_prompt or v_has_tag) and not v_has_market
      and r.team_id = p_team
 and r.day between (v_from - v_prev_len) and (v_from - 1)
      and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
      and exists (select 1 from prompt_filter pf where pf.id = r.prompt_id)
      and exists (select 1 from tracking_window_prev w where r.day between w.window_from and w.window_to)
  ),

  -- PATH D: Market Filter → prompt_run fallback (kein daily für market)
  runs_now as materialized (
    select pr.id, pr.run_day_berlin as day, pr.model, pr.prompt_id
    from app.prompt_run pr
    where pr.team_id = p_team
      and pr.run_day_berlin between v_from and v_to
      and (p_models is null or cardinality(p_models) = 0 or pr.model = any(p_models))
      and exists (select 1 from prompt_filter pf where pf.id = pr.prompt_id)
      and not exists (
        select 1 from app.prompt_run_ignore_log il
        where il.team_id = p_team and il.prompt_run_id = pr.id
      )
  ),
  runs_prev as materialized (
    select pr.id, pr.run_day_berlin as day, pr.model, pr.prompt_id
    from app.prompt_run pr
    where pr.team_id = p_team
and pr.run_day_berlin between (v_from - v_prev_len) and (v_from - 1)
      and (p_models is null or cardinality(p_models) = 0 or pr.model = any(p_models))
      and exists (select 1 from prompt_filter pf where pf.id = pr.prompt_id)
      and not exists (
        select 1 from app.prompt_run_ignore_log il
        where il.team_id = p_team and il.prompt_run_id = pr.id
      )
  ),

  -- Market visibility: tracked runs für p_company
  tracked_runs_market_now as (
    select rn.id as run_id
    from tracking_window_now w
    join runs_now rn on rn.day between w.window_from and w.window_to
  ),
  tracked_runs_market_prev as (
    select rp.id as run_id
    from tracking_window_prev w
    join runs_prev rp on rp.day between w.window_from and w.window_to
  ),

  vis_market_now as (
    select
      count(distinct trn.run_id)::int as mention_runs,
      (select count(distinct run_id)::int from tracked_runs_market_now) as total_runs
    from tracked_runs_market_now trn
    where exists (
      select 1 from app.recommendation r
      where r.prompt_run_id = trn.run_id and r.team_id = p_team and r.company_id = p_company
    )
  ),
  vis_market_prev as (
    select
      count(distinct trp.run_id)::int as mention_runs,
      (select count(distinct run_id)::int from tracked_runs_market_prev) as total_runs
    from tracked_runs_market_prev trp
    where exists (
      select 1 from app.recommendation r
      where r.prompt_run_id = trp.run_id and r.team_id = p_team and r.company_id = p_company
    )
  ),

  -- Unified Visibility
  vis_now as (
    select
      case
        when v_has_market then (select mention_runs from vis_market_now)
        when v_has_prompt or v_has_tag then (select mention_runs from mention_prompt_now)
        else (select mention_runs from mention_model_now)
      end as mention_runs,
      case
        when v_has_market then (select total_runs from vis_market_now)
        when v_has_prompt or v_has_tag then (select total_runs from runs_prompt_now)
        else (select total_runs from runs_model_now)
      end as total_runs
  ),
  vis_prev as (
    select
      case
        when v_has_market then (select mention_runs from vis_market_prev)
        when v_has_prompt or v_has_tag then (select mention_runs from mention_prompt_prev)
        else (select mention_runs from mention_model_prev)
      end as mention_runs,
      case
        when v_has_market then (select total_runs from vis_market_prev)
        when v_has_prompt or v_has_tag then (select total_runs from runs_prompt_prev)
        else (select total_runs from runs_model_prev)
      end as total_runs
  ),

  /* ============================================================
     RANK — daily_company_*_model_stats (unverändert v3)
  ============================================================ */
  daily_now_union as (
    select d.day, d.model, d.company_id, d.mentions, d.sum_rank, d.count_rank, d.last_seen_run_at
    from app.daily_company_prompt_model_stats d
    join prompt_filter pf on pf.id = d.prompt_id
    where d.team_id = p_team
      and d.day between v_from and v_to
      and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
      and (
        v_has_prompt
        or (not v_has_prompt and (v_has_tag or v_has_market))
      )
    union all
    select d.day, d.model, d.company_id, d.mentions, d.sum_rank, d.count_rank, d.last_seen_run_at
    from app.daily_company_model_stats d
    where not v_has_prompt and not v_has_tag and not v_has_market
      and d.team_id = p_team
      and d.day between v_from and v_to
      and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
  ),
  daily_prev_union as (
    select d.day, d.model, d.company_id, d.mentions, d.sum_rank, d.count_rank
    from app.daily_company_prompt_model_stats d
    join prompt_filter pf on pf.id = d.prompt_id
    where d.team_id = p_team
and d.day between (v_from - v_prev_len) and (v_from - 1)
      and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
      and (v_has_prompt or (not v_has_prompt and (v_has_tag or v_has_market)))
    union all
    select d.day, d.model, d.company_id, d.mentions, d.sum_rank, d.count_rank
    from app.daily_company_model_stats d
    where not v_has_prompt and not v_has_tag and not v_has_market
      and d.team_id = p_team
and d.day between (v_from - v_prev_len) and (v_from - 1)
      and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
  ),

  company_rank_now as (
    select
      dnu.company_id,
      sum(dnu.sum_rank)         as sum_rank_now,
      sum(dnu.count_rank)       as count_rank_now,
      max(dnu.last_seen_run_at) as last_seen_run_at
    from daily_now_union dnu
    join tracking_periods tp
      on tp.company_id = dnu.company_id
     and dnu.day between greatest(tp.start_day, v_from) and least(tp.end_day, v_to)
    group by dnu.company_id
  ),
company_rank_prev as (
  select
    dpu.company_id,
    sum(dpu.sum_rank)   as sum_rank_prev,
    sum(dpu.count_rank) as count_rank_prev
  from daily_prev_union dpu
  join tracking_periods tp
    on tp.company_id = dpu.company_id
   and dpu.day between greatest(tp.start_day, (v_from - v_prev_len)) and least(tp.end_day, (v_from - 1))
  group by dpu.company_id
),

  /* ============================================================
     SENTIMENT — prompt_run (unverändert v3)
     tracked_runs_now/prev: Runs im Tracking-Window für p_company
     Für market-filter: runs_now/prev bereits materialized oben
     Für andere paths: eigene CTEs
  ============================================================ */
  sentiment_runs_now as (
    select rn.id as run_id
    from runs_now rn
    join tracking_window_now w on rn.day between w.window_from and w.window_to
  ),
  sentiment_runs_prev as (
    select rp.id as run_id
    from runs_prev rp
    join tracking_window_prev w on rp.day between w.window_from and w.window_to
  ),

  sentiment_now_cte as (
    select round(avg(r.sentiment::numeric), 2) as sentiment_now
    from sentiment_runs_now trn
    join app.recommendation r
      on r.prompt_run_id = trn.run_id
     and r.team_id       = p_team
     and r.company_id    = p_company
     and r.sentiment     is not null
  ),
  sentiment_prev_cte as (
    select round(avg(r.sentiment::numeric), 2) as sentiment_prev
    from sentiment_runs_prev trp
    join app.recommendation r
      on r.prompt_run_id = trp.run_id
     and r.team_id       = p_team
     and r.company_id    = p_company
     and r.sentiment     is not null
  ),

  /* ============================================================
     METRICS + RANKING (alle team companies für den Rank)
  ============================================================ */
  metrics as (
    select
      tc.company_id,
      tc.name,
      tc.logo_url,
      tc.role,
      tc.color,
      tc.domain,

      -- Visibility für DIESE company (p_company) aus daily
      -- Für andere companies: auch daily (mentor_runs / total_runs nach company_id)
      -- Da wir den Rank über alle companies berechnen müssen:
      -- visibility_pct für alle companies aus daily_company_model_stats
      case
        when not v_has_market and not v_has_prompt and not v_has_tag then (
          select
            case when coalesce(sum(r2.runs_total), 0) > 0
                 then round((coalesce(sum(d2.mention_runs), 0)::numeric * 100.0)
                            / sum(r2.runs_total)::numeric, 2)
                 else null end
          from app.daily_runs_by_model r2
          left join app.daily_company_model_stats d2
            on d2.team_id = r2.team_id and d2.day = r2.day and d2.model = r2.model
           and d2.company_id = tc.company_id
          where r2.team_id = p_team
            and r2.day between v_from and v_to
            and (p_models is null or cardinality(p_models) = 0 or r2.model = any(p_models))
            and exists (
              select 1 from tracking_periods tp2
              where tp2.company_id = tc.company_id
                and r2.day between greatest(tp2.start_day, v_from) and least(tp2.end_day, v_to)
            )
        )
        when (v_has_prompt or v_has_tag) and not v_has_market then (
          select
            case when coalesce(sum(r2.runs_total), 0) > 0
                 then round((coalesce(sum(d2.mention_runs), 0)::numeric * 100.0)
                            / sum(r2.runs_total)::numeric, 2)
                 else null end
          from app.daily_runs_by_prompt_model r2
          left join app.daily_company_prompt_model_stats d2
            on d2.team_id = r2.team_id and d2.day = r2.day
           and d2.prompt_id = r2.prompt_id and d2.model = r2.model
           and d2.company_id = tc.company_id
          where r2.team_id = p_team
            and r2.day between v_from and v_to
            and (p_models is null or cardinality(p_models) = 0 or r2.model = any(p_models))
            and exists (select 1 from prompt_filter pf where pf.id = r2.prompt_id)
            and exists (
              select 1 from tracking_periods tp2
              where tp2.company_id = tc.company_id
                and r2.day between greatest(tp2.start_day, v_from) and least(tp2.end_day, v_to)
            )
        )
        else null  -- market: zu komplex für alle companies, bleibt null für ranking
      end as visibility_pct_all,

      -- Mentions (Zähler) für diese company
      coalesce(
        case
          when v_has_market then (select mention_runs from vis_now)
          when v_has_prompt or v_has_tag then (select mention_runs from mention_prompt_now)
          else (select mention_runs from mention_model_now)
        end,
        0
      ) as mentions_now_val,

      coalesce(
        case
          when v_has_market then (select mention_runs from vis_prev)
          when v_has_prompt or v_has_tag then (select mention_runs from mention_prompt_prev)
          else (select mention_runs from mention_model_prev)
        end,
        0
      ) as mentions_prev_val

    from team_companies tc
  ),

  ranked as (
    select
      m.*,
      -- Visibility für p_company aus vis_now/prev
      case when (select total_runs from vis_now) > 0
           then round(((select mention_runs from vis_now)::numeric * 100.0)
                      / (select total_runs from vis_now)::numeric, 2)
           else null end as visibility_pct,
      case when (select total_runs from vis_prev) > 0
           then round(((select mention_runs from vis_prev)::numeric * 100.0)
                      / (select total_runs from vis_prev)::numeric, 2)
           else null end as visibility_prev_pct,
      (select total_runs from vis_now)  as total_runs_now_val,
      (select total_runs from vis_prev) as total_runs_prev_val,
      -- Rank über alle companies basierend auf visibility_pct_all
      rank() over (
        order by m.visibility_pct_all desc nulls last, m.name asc
      )::int as rank_vis,
      count(*) over ()::int as companies_count
    from metrics m
  )

  select
    tc.company_id,
    tc.name,
    tc.logo_url,
    tc.domain,
    tc.role::text,
    tc.color,
    coalesce(a.aliases, '[]'::jsonb),

    r.visibility_pct,
    r.visibility_prev_pct,
    case when r.visibility_pct is not null and r.visibility_prev_pct is not null
         then round(r.visibility_pct - r.visibility_prev_pct, 2) else null end,

    case when coalesce(crn.count_rank_now, 0) > 0
         then round(crn.sum_rank_now::numeric / crn.count_rank_now::numeric, 2) else null end,
    case when coalesce(crp.count_rank_prev, 0) > 0
         then round(crp.sum_rank_prev::numeric / crp.count_rank_prev::numeric, 2) else null end,
    case when coalesce(crn.count_rank_now, 0) > 0 and coalesce(crp.count_rank_prev, 0) > 0
         then round(
           (crn.sum_rank_now::numeric / crn.count_rank_now::numeric) -
           (crp.sum_rank_prev::numeric / crp.count_rank_prev::numeric), 2)
         else null end,

    sn.sentiment_now,
    sp.sentiment_prev,
    case when sn.sentiment_now is not null and sp.sentiment_prev is not null
         then round(sn.sentiment_now - sp.sentiment_prev, 2) else null end,

    coalesce(r.total_runs_now_val, 0)::int,
    coalesce(r.total_runs_prev_val, 0)::int,
    r.mentions_now_val::int,
    r.mentions_prev_val::int,

    r.rank_vis,
    r.companies_count,
    crn.last_seen_run_at

  from team_companies tc
  join ranked r on r.company_id = tc.company_id
  left join aliases_cte a         on a.company_id = tc.company_id
  left join company_rank_now  crn on crn.company_id = tc.company_id
  left join company_rank_prev crp on crp.company_id = tc.company_id
  left join sentiment_now_cte sn  on true
  left join sentiment_prev_cte sp on true
  where tc.company_id = p_company;

end;$function$;

CREATE OR REPLACE FUNCTION app.get_company_detailed_chart_v3(p_team uuid, p_company uuid, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_markets text[] DEFAULT NULL::text[], p_models text[] DEFAULT NULL::text[], p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_prompt_id uuid DEFAULT NULL::uuid, p_mode text DEFAULT 'visibility'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
declare
  v_user       uuid := auth.uid();
  v_from       date;
  v_to         date;
  v_len        integer;
  v_mode       text;
  v_has_market boolean;
  v_has_tag    boolean;
  v_has_prompt boolean;
begin

  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from app.team_member tm
    where tm.team_id = p_team and tm.user_id = v_user
  ) then raise exception 'forbidden'; end if;
  -- 12.10.2026: wie die neuen Seiten nur mit Zugang (Abo/Plan)
  perform app.require_team_access(p_team);

  v_from       := coalesce(p_date_from, current_date - 6);
  v_to         := coalesce(p_date_to,   current_date);
  v_len        := (v_to - v_from + 1);
  v_mode       := lower(coalesce(p_mode, 'visibility'));
  v_has_market := (p_markets  is not null and cardinality(p_markets)  > 0);
  v_has_tag    := (p_tag_ids  is not null and cardinality(p_tag_ids)  > 0);
  v_has_prompt := (p_prompt_id is not null);

  if v_to < v_from then raise exception 'invalid date range'; end if;
  if v_mode not in ('visibility', 'rank', 'sentiment') then v_mode := 'visibility'; end if;

  return (
    with

    /* ===== Prompt Filter ===== */
    prompt_filter as materialized (
      select p.id
      from app.prompt p
      where p.team_id = p_team
        and (not v_has_market or p.market::text = any(p_markets))
        and (
          (v_has_prompt and p.id = p_prompt_id)
          or (not v_has_prompt and (
            not v_has_tag
            or (
              (p_tagmode is null or p_tagmode = 'or')
              and exists (select 1 from app.prompt_tag pt where pt.prompt_id = p.id and pt.tag_id = any(p_tag_ids))
            )
            or (
              p_tagmode = 'and'
              and (select count(distinct pt.tag_id) from app.prompt_tag pt
                   where pt.prompt_id = p.id and pt.tag_id = any(p_tag_ids)) = cardinality(p_tag_ids)
            )
          ))
        )
    ),

    /* ============================================================
       VISIBILITY — Daily Stats, Zähler + Nenner getrennt pro Tag
       Kein Tracking Window (Chart zeigt alle Tage im Range)
    ============================================================ */

    -- PATH A: Kein Filter
    -- Zähler pro Tag (nur Rows wo p_company erwähnt)
    mention_by_day_model as (
      select d.day, sum(d.mention_runs)::int as mention_runs
      from app.daily_company_model_stats d
      where not v_has_market and not v_has_prompt and not v_has_tag
        and d.team_id    = p_team
        and d.company_id = p_company
        and d.day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
      group by d.day
    ),
    -- Nenner pro Tag (alle Runs des Teams, unabhängig von p_company)
    runs_by_day_model as (
      select r.day, sum(r.runs_total)::int as total_runs
      from app.daily_runs_by_model r
      where not v_has_market and not v_has_prompt and not v_has_tag
        and r.team_id = p_team
        and r.day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
      group by r.day
    ),

    -- PATH B/C: Prompt/Tag Filter
    mention_by_day_prompt as (
      select d.day, sum(d.mention_runs)::int as mention_runs
      from app.daily_company_prompt_model_stats d
      where (v_has_prompt or v_has_tag) and not v_has_market
        and d.team_id    = p_team
        and d.company_id = p_company
        and d.day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
        and exists (select 1 from prompt_filter pf where pf.id = d.prompt_id)
      group by d.day
    ),
    runs_by_day_prompt as (
      select r.day, sum(r.runs_total)::int as total_runs
      from app.daily_runs_by_prompt_model r
      where (v_has_prompt or v_has_tag) and not v_has_market
        and r.team_id = p_team
        and r.day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or r.model = any(p_models))
        and exists (select 1 from prompt_filter pf where pf.id = r.prompt_id)
      group by r.day
    ),

    -- PATH D: Market Filter → prompt_run fallback
    runs_now as materialized (
      select pr.id, pr.run_day_berlin as day, pr.model, pr.prompt_id
      from app.prompt_run pr
      where v_has_market
        and pr.team_id = p_team
        and pr.run_day_berlin between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or pr.model = any(p_models))
        and exists (select 1 from prompt_filter pf where pf.id = pr.prompt_id)
        and not exists (
          select 1 from app.prompt_run_ignore_log il
          where il.team_id = p_team and il.prompt_run_id = pr.id
        )
    ),
    runs_by_day_market as (
      select day, count(distinct id)::int as total_runs
      from runs_now
      group by day
    ),
    mention_by_day_market as (
      select rn.day, count(distinct rn.id)::int as mention_runs
      from runs_now rn
      where exists (
        select 1 from app.recommendation r
        where r.prompt_run_id = rn.id
          and r.team_id       = p_team
          and r.company_id    = p_company
      )
      group by rn.day
    ),

    -- Unified: aktiven Path zusammenführen
    mention_by_day as (
      select day, mention_runs from mention_by_day_model  where not v_has_market and not v_has_prompt and not v_has_tag
      union all
      select day, mention_runs from mention_by_day_prompt where (v_has_prompt or v_has_tag) and not v_has_market
      union all
      select day, mention_runs from mention_by_day_market where v_has_market
    ),
    runs_by_day as (
      select day, total_runs from runs_by_day_model  where not v_has_market and not v_has_prompt and not v_has_tag
      union all
      select day, total_runs from runs_by_day_prompt where (v_has_prompt or v_has_tag) and not v_has_market
      union all
      select day, total_runs from runs_by_day_market where v_has_market
    ),

    /* ============================================================
       RANK — daily_company_*_model_stats (unverändert v2)
    ============================================================ */
    daily_union as (
      select d.day, d.company_id, d.sum_rank, d.count_rank
      from app.daily_company_prompt_model_stats d
      join prompt_filter pf on pf.id = d.prompt_id
      where d.team_id    = p_team
        and d.company_id = p_company
        and d.day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
        and (
          v_has_prompt
          or (not v_has_prompt and (v_has_tag or v_has_market))
        )

      union all

      select d.day, d.company_id, d.sum_rank, d.count_rank
      from app.daily_company_model_stats d
      where not v_has_prompt and not v_has_tag and not v_has_market
        and d.team_id    = p_team
        and d.company_id = p_company
        and d.day between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or d.model = any(p_models))
    ),
    rank_by_day as (
      select
        du.day,
        sum(du.sum_rank)::numeric   as sum_rank,
        sum(du.count_rank)::numeric as count_rank
      from daily_union du
      group by du.day
    ),

    /* ============================================================
       SENTIMENT — prompt_run (kein daily dafür)
       runs_now bereits materialized oben (für market und sentiment)
       Für nicht-market paths: eigene sentiment_runs CTE
    ============================================================ */
    sentiment_runs as materialized (
      select pr.id, pr.run_day_berlin as day
      from app.prompt_run pr
      where not v_has_market  -- market hat runs_now schon
        and pr.team_id = p_team
        and pr.run_day_berlin between v_from and v_to
        and (p_models is null or cardinality(p_models) = 0 or pr.model = any(p_models))
        and exists (select 1 from prompt_filter pf where pf.id = pr.prompt_id)
        and not exists (
          select 1 from app.prompt_run_ignore_log il
          where il.team_id = p_team and il.prompt_run_id = pr.id
        )
    ),
    -- Alle Runs (market: aus runs_now, sonst: aus sentiment_runs)
    all_runs_for_sentiment as (
      select id, day from sentiment_runs where not v_has_market
      union all
      select id, day from runs_now      where v_has_market
    ),
    sentiment_by_day as (
      select
        ar.day,
        round(avg(r.sentiment)::numeric, 2) as avg_sentiment
      from all_runs_for_sentiment ar
      join app.recommendation r
        on r.prompt_run_id = ar.id
       and r.team_id       = p_team
       and r.company_id    = p_company
       and r.sentiment     is not null
      group by ar.day
    ),

    /* ===== Date Spine + Series ===== */
    date_spine as (
      select generate_series(v_from, v_to, interval '1 day')::date as day
    ),

    series as (
      select
        ds.day,
        case when coalesce(rt.total_runs, 0) > 0
             then round((coalesce(m.mention_runs, 0)::numeric * 100.0) / rt.total_runs, 2)
             else 0
        end as visibility_pct,
        case when rb.count_rank > 0
             then round(rb.sum_rank / rb.count_rank, 2)
             else null end as avg_rank,
        sb.avg_sentiment
      from date_spine ds
      left join runs_by_day    rt on rt.day = ds.day
      left join mention_by_day m  on m.day  = ds.day
      left join rank_by_day    rb on rb.day = ds.day
      left join sentiment_by_day sb on sb.day = ds.day
    )

    select jsonb_build_object(
      'company_id', p_company,
      'mode',       v_mode,
      'series',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'day',   to_char(se.day, 'YYYY-MM-DD'),
              'value',
                case
                  when v_mode = 'rank'      then se.avg_rank
                  when v_mode = 'sentiment' then se.avg_sentiment
                  else                           se.visibility_pct
                end
            )
            order by se.day
          )
          from series se
        ), '[]'::jsonb)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION app.get_company_detailed_chart_v4(p_team uuid, p_company uuid, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_markets text[] DEFAULT NULL::text[], p_models text[] DEFAULT NULL::text[], p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_prompt_id uuid DEFAULT NULL::uuid, p_mode text DEFAULT 'visibility'::text, p_granularity text DEFAULT 'day'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
declare
  v_user        uuid := auth.uid();
  v_from        date;
  v_to          date;
  v_mode        text;
  v_has_market  boolean;
  v_has_tag     boolean;
  v_has_prompt  boolean;
  v_granularity text := lower(coalesce(nullif(btrim(p_granularity), ''), 'day'));
  v_sql         text;
  v_result      jsonb;
begin
  perform app.check_rate_limit('company_chart', 30);
  perform set_config('jit', 'off', true);
  perform set_config('work_mem', '128MB', true);

  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from app.team_member tm
    where tm.team_id = p_team and tm.user_id = v_user
  ) then raise exception 'forbidden'; end if;
  -- 12.10.2026: wie die neuen Seiten nur mit Zugang (Abo/Plan)
  perform app.require_team_access(p_team);

  v_from       := coalesce(p_date_from, current_date - 6);
  v_to         := coalesce(p_date_to,   current_date);
  v_mode       := lower(coalesce(p_mode, 'visibility'));
  v_has_market := (p_markets  is not null and cardinality(p_markets)  > 0);
  v_has_tag    := (p_tag_ids  is not null and cardinality(p_tag_ids)  > 0);
  v_has_prompt := (p_prompt_id is not null);

  if v_to < v_from then raise exception 'invalid date range'; end if;
  if v_mode not in ('visibility', 'rank', 'sentiment') then v_mode := 'visibility'; end if;
  if v_granularity not in ('day', 'week', 'month') then
    raise exception 'invalid granularity';
  end if;

  if v_granularity = 'week' then
    v_from := date_trunc('week', v_from::timestamp)::date;
    v_to   := least(date_trunc('week', v_to::timestamp)::date + 6, current_date);
  elsif v_granularity = 'month' then
    v_from := date_trunc('month', v_from::timestamp)::date;
    v_to   := least((date_trunc('month', v_to::timestamp) + interval '1 month - 1 day')::date, current_date);
  end if;

  v_sql := $q$
  with
    prompt_filter as materialized (
      select p.id
      from app.prompt p
      where p.team_id = $1
        and (not $10 or p.market::text = any($6))
        and (
          ($11 and p.id = $9)
          or (not $11 and (
            not $12
            or (
              ($8 is null or $8 = 'or')
              and exists (select 1 from app.prompt_tag pt where pt.prompt_id = p.id and pt.tag_id = any($7))
            )
            or (
              $8 = 'and'
              and (select count(distinct pt.tag_id) from app.prompt_tag pt
                   where pt.prompt_id = p.id and pt.tag_id = any($7)) = cardinality($7)
            )
          ))
        )
    ),
    mention_by_day_model as (
      select d.__DCOL__ as day, sum(d.mention_runs)::int as mention_runs
      from app.__CMS__ d
      where not $10 and not $11 and not $12
        and $13 = 'visibility'
        and d.team_id    = $1
        and d.company_id = $2
        and d.__DCOL__ between $3 and $4
        and ($5 is null or cardinality($5) = 0 or d.model = any($5))
      group by d.__DCOL__
    ),
    runs_by_day_model as (
      select r.__DCOL__ as day, sum(r.runs_total)::int as total_runs
      from app.__RBM__ r
      where not $10 and not $11 and not $12
        and $13 = 'visibility'
        and r.team_id = $1
        and r.__DCOL__ between $3 and $4
        and ($5 is null or cardinality($5) = 0 or r.model = any($5))
      group by r.__DCOL__
    ),
    mention_by_day_prompt as (
      select d.__DCOL__ as day, sum(d.mention_runs)::int as mention_runs
      from app.__CPMS__ d
      where ($11 or $12) and not $10
        and $13 = 'visibility'
        and d.team_id    = $1
        and d.company_id = $2
        and d.__DCOL__ between $3 and $4
        and ($5 is null or cardinality($5) = 0 or d.model = any($5))
        and exists (select 1 from prompt_filter pf where pf.id = d.prompt_id)
      group by d.__DCOL__
    ),
    runs_by_day_prompt as (
      select r.__DCOL__ as day, sum(r.runs_total)::int as total_runs
      from app.__RBPM__ r
      where ($11 or $12) and not $10
        and $13 = 'visibility'
        and r.team_id = $1
        and r.__DCOL__ between $3 and $4
        and ($5 is null or cardinality($5) = 0 or r.model = any($5))
        and exists (select 1 from prompt_filter pf where pf.id = r.prompt_id)
      group by r.__DCOL__
    ),
    runs_now as materialized (
      select pr.id, date_trunc('__TRUNC__', pr.run_day_berlin::timestamp)::date as day, pr.model, pr.prompt_id
      from app.prompt_run pr
      where $10
        and $13 in ('visibility', 'sentiment')
        and pr.team_id = $1
        and pr.run_day_berlin between $3 and $4
        and ($5 is null or cardinality($5) = 0 or pr.model = any($5))
        and exists (select 1 from prompt_filter pf where pf.id = pr.prompt_id)
        and not exists (
          select 1 from app.prompt_run_ignore_log il
          where il.team_id = $1 and il.prompt_run_id = pr.id
        )
    ),
    runs_by_day_market as (
      select day, count(distinct id)::int as total_runs
      from runs_now
      group by day
    ),
    mention_by_day_market as (
      select rn.day, count(distinct rn.id)::int as mention_runs
      from runs_now rn
      where exists (
        select 1 from app.recommendation r
        where r.prompt_run_id = rn.id
          and r.team_id       = $1
          and r.company_id    = $2
      )
      group by rn.day
    ),
    mention_by_day as materialized (
      select day, mention_runs from mention_by_day_model  where not $10 and not $11 and not $12
      union all
      select day, mention_runs from mention_by_day_prompt where ($11 or $12) and not $10
      union all
      select day, mention_runs from mention_by_day_market where $10
    ),
    runs_by_day as materialized (
      select day, total_runs from runs_by_day_model  where not $10 and not $11 and not $12
      union all
      select day, total_runs from runs_by_day_prompt where ($11 or $12) and not $10
      union all
      select day, total_runs from runs_by_day_market where $10
    ),
    daily_union as (
      select d.__DCOL__ as day, d.company_id, d.sum_rank, d.count_rank
      from app.__CPMS__ d
      join prompt_filter pf on pf.id = d.prompt_id
      where d.team_id    = $1
        and d.company_id = $2
        and d.__DCOL__ between $3 and $4
        and ($5 is null or cardinality($5) = 0 or d.model = any($5))
        and $13 = 'rank'
        and (
          $11
          or (not $11 and ($12 or $10))
        )
      union all
      select d.__DCOL__ as day, d.company_id, d.sum_rank, d.count_rank
      from app.__CMS__ d
      where not $11 and not $12 and not $10
        and $13 = 'rank'
        and d.team_id    = $1
        and d.company_id = $2
        and d.__DCOL__ between $3 and $4
        and ($5 is null or cardinality($5) = 0 or d.model = any($5))
    ),
    rank_by_day as materialized (
      select
        du.day,
        sum(du.sum_rank)::numeric   as sum_rank,
        sum(du.count_rank)::numeric as count_rank
      from daily_union du
      group by du.day
    ),
    sentiment_runs as materialized (
      select pr.id, date_trunc('__TRUNC__', pr.run_day_berlin::timestamp)::date as day
      from app.prompt_run pr
      where not $10
        and $13 = 'sentiment'
        and pr.team_id = $1
        and pr.run_day_berlin between $3 and $4
        and ($5 is null or cardinality($5) = 0 or pr.model = any($5))
        and exists (select 1 from prompt_filter pf where pf.id = pr.prompt_id)
        and not exists (
          select 1 from app.prompt_run_ignore_log il
          where il.team_id = $1 and il.prompt_run_id = pr.id
        )
    ),
    all_runs_for_sentiment as (
      select id, day from sentiment_runs where not $10 and $13 = 'sentiment'
      union all
      select id, day from runs_now      where $10 and $13 = 'sentiment'
    ),
    sentiment_by_day as materialized (
      select
        ar.day,
        round(avg(r.sentiment)::numeric, 2) as avg_sentiment
      from all_runs_for_sentiment ar
      join app.recommendation r
        on r.prompt_run_id = ar.id
       and r.team_id       = $1
       and r.company_id    = $2
       and r.sentiment     is not null
      group by ar.day
    ),
    date_spine as (
      select generate_series($3, $4, interval '__STEP__')::date as day
    ),
    series as (
      select
        ds.day,
        case when coalesce(rt.total_runs, 0) > 0
          then round((coalesce(m.mention_runs, 0)::numeric * 100.0) / rt.total_runs, 2)
          else 0
        end as visibility_pct,
        case when rb.count_rank > 0
          then round(rb.sum_rank / rb.count_rank, 2)
          else null end as avg_rank,
        sb.avg_sentiment
      from date_spine ds
      left join runs_by_day    rt on rt.day = ds.day
      left join mention_by_day m  on m.day  = ds.day
      left join rank_by_day    rb on rb.day = ds.day
      left join sentiment_by_day sb on sb.day = ds.day
    )
  select jsonb_build_object(
    'company_id', $2,
    'mode',       $13,
    'granularity', $14,
    'series',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'day',   to_char(se.day, 'YYYY-MM-DD'),
            'value',
              case
                when $13 = 'rank'      then se.avg_rank
                when $13 = 'sentiment' then se.avg_sentiment
                else                        se.visibility_pct
              end
          )
          order by se.day
        )
        from series se
      ), '[]'::jsonb)
  )
  $q$;

  v_sql := replace(v_sql, '__CMS__',  case v_granularity when 'day' then 'daily_company_model_stats'        when 'week' then 'weekly_company_model_stats'        else 'monthly_company_model_stats'        end);
  v_sql := replace(v_sql, '__CPMS__', case v_granularity when 'day' then 'daily_company_prompt_model_stats' when 'week' then 'weekly_company_prompt_model_stats' else 'monthly_company_prompt_model_stats' end);
  v_sql := replace(v_sql, '__RBM__',  case v_granularity when 'day' then 'daily_runs_by_model'              when 'week' then 'weekly_runs_by_model'              else 'monthly_runs_by_model'              end);
  v_sql := replace(v_sql, '__RBPM__', case v_granularity when 'day' then 'daily_runs_by_prompt_model'       when 'week' then 'weekly_runs_by_prompt_model'       else 'monthly_runs_by_prompt_model'       end);
  v_sql := replace(v_sql, '__DCOL__', case v_granularity when 'day' then 'day' when 'week' then 'week_start' else 'month_start' end);
  v_sql := replace(v_sql, '__STEP__', case v_granularity when 'day' then '1 day' when 'week' then '1 week' else '1 month' end);
  v_sql := replace(v_sql, '__TRUNC__', v_granularity);

  execute v_sql
  into v_result
  using
    p_team, p_company, v_from, v_to, p_models, p_markets, p_tag_ids,
    p_tagmode, p_prompt_id, v_has_market, v_has_prompt, v_has_tag,
    v_mode, v_granularity;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION app.get_company_brand_name_variations_v2(p_team uuid, p_company uuid, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_markets text[] DEFAULT NULL::text[], p_models text[] DEFAULT NULL::text[], p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_prompt_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(company_id uuid, name text, mentioned_count bigint, mentioned_runs bigint, mentions_total bigint, share_of_voice_pct numeric, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$declare
  v_user    uuid := auth.uid();
  v_from    date := coalesce(p_date_from, current_date - 6);
  v_to      date := coalesce(p_date_to, current_date);
  v_tagmode text := lower(coalesce(p_tagmode, 'or'));
begin
 
  perform app.check_rate_limit('brand_variations', 30);
 
  -- Auth
  if v_user is null then
    raise exception 'not authenticated';
  end if;
 
  if not exists (
    select 1 from app.team_member tm
    where tm.team_id = p_team and tm.user_id = v_user
  ) then
    raise exception 'forbidden';
  end if;
  -- 12.10.2026: wie die neuen Seiten nur mit Zugang (Abo/Plan)
  perform app.require_team_access(p_team);
 
  if not exists (
    select 1 from app.team_company tc
    where tc.team_id = p_team and tc.company_id = p_company
  ) then
    raise exception 'company not in team';
  end if;
 
  if v_to < v_from then
    raise exception 'invalid date range';
  end if;
 
  if v_tagmode not in ('or', 'and') then
    raise exception 'invalid tagmode';
  end if;
 
  -- EXECUTE...USING: verhindert Generic Plan Caching bei wechselnden Datebereichen
  -- Query-Restrukturierung:
  --   - tracking_periods: NOT EXISTS wird einmalig als boolean materialisiert
  --   - Anti-join für ignore_log: LEFT JOIN ... IS NULL statt NOT EXISTS (besser planbar)
  --   - recommendation wird direkt über (prompt_run_id, team_id, company_id) gejoint
  --     → nutzt idx_recommendation_run_company_team
  return query execute $q$
  with
  -- Einmalig prüfen ob tracking periods existieren (vermeidet wiederholtes NOT EXISTS)
  has_tracking as (
    select exists (
      select 1
      from app.team_company_tracking_period tp
      where tp.team_id = $1 and tp.company_id = $2
    ) as has_periods
  ),
 
  tracking_periods as (
    select
      tp.started_at::date as start_day,
      coalesce(tp.ended_at::date, 'infinity'::date) as end_day
    from app.team_company_tracking_period tp
    where tp.team_id = $1 and tp.company_id = $2
 
    union all
 
    -- Fallback: kein Tracking definiert → alles erlaubt
    select date '1900-01-01', 'infinity'::date
    from has_tracking
    where not has_periods
  ),
 
  prompt_filter as (
    select p.id
    from app.prompt p
    where p.team_id = $1
      and (
        $7 is null or cardinality($7) = 0
        or p.market::text = any($7)
      )
      and (
        ($8 is not null and p.id = $8)
        or (
          $8 is null
          and (
            $3 is null or cardinality($3) = 0
            or (
              $9 = 'or'
              and exists (
                select 1 from app.prompt_tag pt
                where pt.prompt_id = p.id and pt.tag_id = any($3)
              )
            )
            or (
              $9 = 'and'
              and (
                select count(distinct pt.tag_id)
                from app.prompt_tag pt
                where pt.prompt_id = p.id and pt.tag_id = any($3)
              ) = cardinality($3)
            )
          )
        )
      )
  ),
 
  -- LEFT JOIN statt NOT EXISTS für ignore_log → besser für den Planner
  runs_now as (
    select
      pr.id       as run_id,
      pr.run_day_berlin as day
    from app.prompt_run pr
    join prompt_filter pf on pf.id = pr.prompt_id
    left join app.prompt_run_ignore_log il
      on il.team_id = $1 and il.prompt_run_id = pr.id
    where pr.team_id = $1
      and pr.run_day_berlin between $4 and $5
      and ($6 is null or cardinality($6) = 0 or pr.model = any($6))
      and il.prompt_run_id is null   -- anti-join: nur nicht-ignorierte runs
  ),
 
  -- Nur runs die in einem aktiven Tracking-Zeitraum liegen
  tracked_runs as (
    select distinct rn.run_id
    from runs_now rn
    join tracking_periods tp
      on rn.day between tp.start_day and tp.end_day
  ),
 
  -- Direkt auf recommendation joinen mit company_id filter im JOIN
  -- Nutzt idx_recommendation_run_company_team (prompt_run_id, team_id, company_id)
  brand_mentions_raw as (
    select
      nullif(lower(btrim(r.brand_name_raw)), '')  as name_key,
      nullif(btrim(r.brand_name_raw), '')          as name_original,
      tr.run_id
    from tracked_runs tr
    join app.recommendation r
      on  r.prompt_run_id = tr.run_id
      and r.team_id       = $1
      and r.company_id    = $2
    where nullif(lower(btrim(coalesce(r.brand_name_raw, ''))), '') is not null
  ),
 
  -- Erst pro (name_key, name_original) zaehlen - vermeidet nested aggregate
  brand_mentions_counted as (
    select
      name_key,
      name_original,
      count(*)::bigint               as variant_count,
      count(distinct run_id)::bigint as variant_runs
    from brand_mentions_raw
    group by name_key, name_original
  ),
 
  -- Dann pro name_key aggregieren; Schreibweise mit hoeChstem variant_count gewinnt
  brand_mentions as (
    select
      name_key,
      (array_agg(name_original order by variant_count desc, name_original asc))[1] as name,
      sum(variant_count)::bigint as mentioned_count,
      sum(variant_runs)::bigint  as mentioned_runs
    from brand_mentions_counted
    group by name_key
  ),
 
  mentions_total_cte as (
    select coalesce(sum(bm.mentioned_count), 0)::bigint as mentions_total
    from brand_mentions bm
  ),
 
  final_rows as (
    select
      $2::uuid as company_id,
      bm.name,
      bm.mentioned_count,
      bm.mentioned_runs,
      mt.mentions_total,
      case
        when coalesce(mt.mentions_total, 0) > 0
        then round((bm.mentioned_count::numeric / mt.mentions_total::numeric) * 100, 2)
        else 0
      end as share_of_voice_pct
    from brand_mentions bm
    cross join mentions_total_cte mt
  )
 
  select
    fr.company_id,
    fr.name,
    fr.mentioned_count,
    fr.mentioned_runs,
    fr.mentions_total,
    fr.share_of_voice_pct,
    count(*) over ()::bigint as total_count
  from final_rows fr
  order by
    fr.share_of_voice_pct desc nulls last,
    fr.mentioned_count desc,
    fr.name asc
  limit 100
  $q$
  using
    p_team,       -- $1
    p_company,    -- $2
    p_tag_ids,    -- $3
    v_from,       -- $4
    v_to,         -- $5
    p_models,     -- $6
    p_markets,    -- $7
    p_prompt_id,  -- $8
    v_tagmode;    -- $9
 
end;$function$;

CREATE OR REPLACE FUNCTION app.get_company_edit_v2(p_team uuid, p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
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
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_company IS NULL THEN
    RAISE EXCEPTION 'company required';
  END IF;

  -- 12.10.2026: nur Marken des Teams (aktiv oder archiviert); fremde verraten nichts
  IF NOT EXISTS (SELECT 1 FROM app.team_company tc WHERE tc.team_id = p_team AND tc.company_id = p_company)
     AND NOT EXISTS (SELECT 1 FROM app.team_competitor_archive a WHERE a.team_id = p_team AND a.company_id = p_company) THEN
    RAISE EXCEPTION 'brand_not_found' USING ERRCODE = 'PT404';
  END IF;

  RETURN (
    WITH
    base_company AS (
      SELECT
        c.id AS company_id,
        COALESCE(tbp.name_override, c.name)            AS name,
        COALESCE(tbp.logo_override_url, c.favicon_url) AS favicon_url,
        lower(
          nullif(
            regexp_replace(coalesce(c.url, ''), '^[a-z]+://([^/]+).*', '\1'),
            ''
          )
        ) AS domain,
        c.default_color    AS default_color,
        tcs.color_override AS color_override
      FROM app.company c
      LEFT JOIN app.team_brand_profile tbp
        ON tbp.team_id = p_team
       AND tbp.company_id = c.id
      LEFT JOIN app.team_company_settings tcs
        ON tcs.team_id = p_team
       AND tcs.company_id = c.id
      WHERE c.id = p_company
      LIMIT 1
    ),

    aliases AS (
      SELECT
        ca.id         AS alias_id,
        ca.pattern    AS pattern,
        ca.mode::text AS mode,
        ca.priority   AS priority,
        ca.is_active  AS is_active,
        ca.created_at AS created_at
      FROM app.company_alias ca
      WHERE ca.team_id = p_team
        AND ca.company_id = p_company
      ORDER BY ca.priority ASC, ca.pattern ASC
    ),

    tracking_periods AS (
      SELECT
        tcp.started_at   AS started_at,
        tcp.ended_at     AS ended_at,
        tcp.start_reason AS start_reason
      FROM app.team_company_tracking_period tcp
      WHERE tcp.team_id = p_team
        AND tcp.company_id = p_company
      ORDER BY tcp.started_at DESC, tcp.created_at DESC
    )

    SELECT jsonb_build_object(
      'company',
        (
          SELECT jsonb_build_object(
            'company_id',      bc.company_id,
            'name',            bc.name,
            'favicon_url',     bc.favicon_url,
            'domain',          bc.domain,
            'default_color',   bc.default_color,
            'color_override',  bc.color_override,
            'effective_color', COALESCE(bc.color_override, bc.default_color)
          )
          FROM base_company bc
        ),
      'aliases',
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'alias_id',   a.alias_id,
                'pattern',    a.pattern,
                'mode',       a.mode,
                'priority',   a.priority,
                'is_active',  a.is_active,
                'created_at', a.created_at
              )
              ORDER BY a.priority ASC, a.pattern ASC
            )
            FROM aliases a
          ),
          '[]'::jsonb
        ),
      'tracking_periods',
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'started_at',   tp.started_at,
                'ended_at',     tp.ended_at,
                'start_reason', tp.start_reason
              )
              ORDER BY tp.started_at DESC
            )
            FROM tracking_periods tp
          ),
          '[]'::jsonb
        )
    )
  );
END;
$function$;

revoke all on function app.get_company_detailed_overview_v4(uuid,uuid,uuid[],text,text[],text[],date,date,uuid), app.get_company_detailed_chart_v3(uuid,uuid,uuid[],text,text[],text[],date,date,uuid,text), app.get_company_detailed_chart_v4(uuid,uuid,uuid[],text,text[],text[],date,date,uuid,text,text), app.get_company_brand_name_variations_v2(uuid,uuid,uuid[],text,text[],text[],date,date,uuid), app.get_company_edit_v2(uuid,uuid), app.export_domains_v1(uuid,bigint,bigint,text[],uuid[],text,text,text,text,integer,integer), app.export_urls_v1(uuid,bigint,bigint,text[],uuid[],text,text,text,text,text,integer,integer) from public, anon;
grant execute on function app.get_company_detailed_overview_v4(uuid,uuid,uuid[],text,text[],text[],date,date,uuid), app.get_company_detailed_chart_v3(uuid,uuid,uuid[],text,text[],text[],date,date,uuid,text), app.get_company_detailed_chart_v4(uuid,uuid,uuid[],text,text[],text[],date,date,uuid,text,text), app.get_company_brand_name_variations_v2(uuid,uuid,uuid[],text,text[],text[],date,date,uuid), app.get_company_edit_v2(uuid,uuid), app.export_domains_v1(uuid,bigint,bigint,text[],uuid[],text,text,text,text,integer,integer), app.export_urls_v1(uuid,bigint,bigint,text[],uuid[],text,text,text,text,text,integer,integer) to authenticated, service_role;


commit;

select pg_get_functiondef('app.get_company_detailed_overview_v4(uuid,uuid,uuid[],text,text[],text[],date,date,uuid)'::regprocedure) like '%require_team_access%' as v4_mit_zugang,
       has_function_privilege('anon', 'app.get_company_edit_v2(uuid,uuid)', 'execute') as anon_edit;
