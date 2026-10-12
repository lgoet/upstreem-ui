-- brand_detail_v1_rueckweg.sql (12.10.2026): stellt den Stand vor brand_detail_v1.sql her. Als EIN Block.

begin;

drop function app.brand_detail_v1(uuid,uuid);
drop function app._citations_brand_build_v1(jsonb);
drop function app._citations_fb_scope_v1(jsonb,jsonb);
drop function app._citations_fb_overview_calc_v1(jsonb);
drop function app._citations_gb_domains_calc_v1(jsonb);
drop function app._citations_gb_urls_calc_v1(jsonb);
drop function app._citations_gb_n_v1(uuid,uuid[],text[],date[],date[],date[],date,date);
drop function app._citations_gb_tiles_v1(uuid,date,date);

drop function app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid,uuid);
drop function app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text,uuid,uuid);
drop function app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,uuid,uuid);
drop function app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid,uuid);
drop function app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid,uuid);
drop function app.export_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid);
drop function app.export_citations_urls_v1(uuid,text,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid);

CREATE FUNCTION app.cached_dashboard_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_limit integer DEFAULT 15, p_offset integer DEFAULT 0, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text, p_prompt_id uuid DEFAULT NULL::uuid)
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

CREATE FUNCTION app.export_responses_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_order text DEFAULT 'run_at_desc'::text, p_mentioned text DEFAULT 'all'::text, p_company_ids uuid[] DEFAULT NULL::uuid[], p_sentiment_min integer DEFAULT NULL::integer, p_sentiment_max integer DEFAULT NULL::integer, p_rank_min integer DEFAULT NULL::integer, p_rank_max integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_url text DEFAULT NULL::text, p_domain text DEFAULT NULL::text, p_prompt_id uuid DEFAULT NULL::uuid)
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
      and (p_prompt_id is null or pr.prompt_id = p_prompt_id)
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
                                       'url', v_url, 'domain', v_domain, 'prompt_id', p_prompt_id),
      'total_count', v_total,
      'offset',     p_offset,
      'limit',      p_limit,
      'has_more',   p_offset + p_limit < v_total,
      'generated_at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    'rows', v_rows);
end;
$function$;

CREATE FUNCTION app.cached_citations_overview_v1(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_mode text DEFAULT 'domain'::text, p_granularity text DEFAULT 'day'::text, p_series_limit integer DEFAULT 7, p_prompt_id uuid DEFAULT NULL::uuid)
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

CREATE FUNCTION app.cached_citations_domains_v1(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT 'share_desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_prompt_id uuid DEFAULT NULL::uuid)
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

CREATE FUNCTION app.cached_citations_urls_v1(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT 'share_desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_prompt_id uuid DEFAULT NULL::uuid)
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

CREATE FUNCTION app.export_citations_domains_v1(p_team uuid DEFAULT NULL::uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT 'share_desc'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 5000)
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
  if v_order not in ('share_desc', 'share_asc', 'share_delta_desc', 'share_delta_asc', 'last_used_desc', 'last_used_asc',
                     'domain_asc', 'domain_desc', 'urls_count_desc', 'urls_count_asc') then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_order';
  end if;
  v_p := v_p || jsonb_build_object('search', left(nullif(btrim(p_search), ''), 200), 'order', v_order,
                                   '_limit', p_limit, '_offset', p_offset);
  v_res := app._citations_g_domains_calc_v1(v_p);
  v_total := coalesce((v_res->'meta'->>'total_count')::bigint, 0);
  return jsonb_build_object(
    'meta', (v_res->'meta') || jsonb_build_object('export', 'citations_domains', 'offset', p_offset, 'limit', p_limit,
                                                  'has_more', p_offset + p_limit < v_total),
    'rows', coalesce((select jsonb_agg(e || jsonb_build_object('domain', app.csv_safe_v1(e->>'domain')) order by o)
                      from jsonb_array_elements(v_res->'rows') with ordinality t(e, o)), '[]'::jsonb));
end;
$function$;

CREATE FUNCTION app.export_citations_urls_v1(p_team uuid DEFAULT NULL::uuid, p_domain text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_mentioned text DEFAULT 'all'::text, p_mentioned_brands uuid[] DEFAULT NULL::uuid[], p_citation_types text[] DEFAULT NULL::text[], p_url_types text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_order text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 2000)
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
  v_res := app._citations_g_urls_calc_v1(v_p || jsonb_build_object('_limit', p_limit, '_offset', p_offset));
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
    (case when p_company is null then '{}'::uuid[] else array[p_company] end)
    || coalesce(p_company_ids, '{}'::uuid[])
  ) as u(x)
  where x is not null;

  v_has_company_filter := cardinality(v_company_ids) > 0;

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
                   'url', p->'url', 'domain', p->'domain', 'prompt_id', p->'prompt_id'),
                 'total_count', coalesce(v_total, 0)),
    'rows', v_rows);
end;
$function$;

revoke all on function app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid), app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text,uuid), app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,uuid), app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid), app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid), app.export_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer), app.export_citations_urls_v1(uuid,text,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer) from public, anon;

grant execute on function app.cached_dashboard_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,integer,integer,text,uuid[],integer,integer,integer,integer,text,text,text,uuid), app.export_responses_v1(uuid,date,date,text[],text[],uuid[],text,text,text,uuid[],integer,integer,integer,integer,text,integer,integer,text,text,uuid), app.cached_citations_overview_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,uuid), app.cached_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid), app.cached_citations_urls_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer,uuid), app.export_citations_domains_v1(uuid,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer), app.export_citations_urls_v1(uuid,text,date,date,text[],text[],uuid[],text,text,uuid[],text[],text[],text,text,integer,integer) to authenticated, service_role;


commit;

select to_regprocedure('app.brand_detail_v1(uuid,uuid)') is null as brand_detail_weg;
