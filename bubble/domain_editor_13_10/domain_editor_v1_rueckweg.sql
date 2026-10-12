-- domain_editor_v1_rueckweg.sql (13.10.2026): Stand vor domain_editor_v1.sql. Als EIN Block.
-- Erst domain_editor_alt_absichern_rueckweg.sql, falls eingespielt (die Altversionen nutzen die neuen Helfer).
-- Protokollzeilen mit neuen Aktionen bleiben erhalten; der alte Check wird deshalb NOT VALID gesetzt.

begin;

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

drop function app.domain_detail_v1(uuid,text);
drop function app.domain_detail_stats_v1(uuid,text,date,date,text[],text[],uuid[],text,text);
drop function app.domain_url_share_v1(uuid,text,date,date,text[],text[],uuid[],text,text,integer);
drop function app.domain_classify_v1(uuid,text,text);
drop function app.brand_edit_v1(uuid,uuid);
drop function app.brand_rename_v1(uuid,uuid,text);
drop function app.brand_alias_add_v1(uuid,uuid,text);
drop function app.brand_alias_set_v1(uuid,uuid,uuid,boolean);
drop function app.brand_alias_delete_v1(uuid,uuid,uuid);
drop function app.brand_color_set_v1(uuid,uuid,text);
drop function app.brand_log_v1(uuid,integer,text,text[]);
drop function app._brand_edit_require_v1(uuid,uuid,boolean);
drop function app._brand_edit_row_v1(uuid,uuid,text);
drop function app._brand_taken_v1(uuid,uuid,text,text);
drop function app._brand_key_v1(text);
drop function app._brand_text_v1(text,text);
drop function app._domain_url_share_calc_v1(jsonb);
drop function app._domain_stats_calc_v1(jsonb);
drop function app._domain_detail_row_v1(uuid,text,text);
drop function app._brand_log_v1(uuid,text,uuid,jsonb);
drop function app._team_caches_clear_v1(uuid,boolean);
drop function app._domain_param_v1(text);
alter table app.brand_activity_log drop constraint brand_activity_log_action_check;
alter table app.brand_activity_log add constraint brand_activity_log_action_check check (action = any (array['add'::text, 'activate'::text, 'deactivate'::text, 'delete'::text])) not valid;

commit;
