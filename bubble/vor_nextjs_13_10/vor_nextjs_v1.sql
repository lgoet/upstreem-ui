-- =============================================================================
-- Vor Next.js v1 (13.10.2026)  –  als EIN Block ausführen (nach den app_start_*.sql)
-- Rückweg: vor_nextjs_v1_rueckweg.sql      Vertrag: VOR_NEXTJS_V1_VERTRAG.md
--
-- 1  Shopping, Ads, Events ohne Umschlag:   *_v2 (Ads mit p_team / p_tag_ids)
-- 2  Quick-Actions-Suche:                   quick_search_v1
-- 3  Exporte:                               export_brands_v2, export_columns_v1
-- 5  Vorlieben im Nutzerkonto:              user_settings.prefs, user_settings_set_v1 (+4 Schlüssel)
-- 6  Mira:                                  opportunity_from_mira_v1
-- 7  Seitenleiste:                          row.prompt_count, team_context_v1 Teile 'teams' und 'counts'
--
-- Erweitert (alte Definition in app._app_start_backup, step = 'vor_nextjs'; Felder kommen nur dazu):
--   team_context_v1, _app_team_row_v1, _app_start_build_v1, user_settings_set_v1
-- Alles andere ist neu. Keine bestehende Funktion wird umbenannt oder entfernt.
-- =============================================================================
begin;

-- Der Aufbau des Suchindex (Abschnitt 9) dauert ca. 20 s; ohne das bricht der SQL-Editor ggf. vorher ab.
set local statement_timeout = '10min';
set local lock_timeout = '30s';

-- -----------------------------------------------------------------------------
-- 0  Sicherung der vier Funktionen, die erweitert werden; neue Spalte
-- -----------------------------------------------------------------------------
insert into app._app_start_backup (step, kind, obj, def, md5)
select 'vor_nextjs', 'def', f, pg_get_functiondef(f::regprocedure), md5(pg_get_functiondef(f::regprocedure))
from unnest(array['app.team_context_v1(uuid,text[])', 'app._app_team_row_v1(uuid,uuid)',
                  'app._app_start_build_v1(uuid,uuid,uuid)', 'app.user_settings_set_v1(text,text)']) f;

alter table app.user_settings add column if not exists prefs jsonb not null default '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- 1a  Shopping ohne Umschlag (gleicher Cache wie v1)
-- -----------------------------------------------------------------------------
create or replace function app._shopping_cached_v2(p_fn text, p_team uuid, p_params jsonb, p_recompute text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
-- 13.10.2026 (vor_nextjs_v1.sql): wie _shopping_cached_v1, aber ohne Umschlag; gleicher Cache-Schlüssel
declare
  v_key    text := md5(p_fn || '|' || p_team::text || '|' || p_params::text);
  v_result jsonb;
  v_ttl    interval;
begin
  perform app._pi_rate_limit_v1(p_fn, 30, 'shopping');
  perform app.require_team_access(p_team);

  select c.result into v_result from app.rpc_cache c where c.cache_key = v_key and c.expires_at > now();
  if v_result is not null then
    update app.rpc_cache c set last_hit_at = now(), hit_count = c.hit_count + 1
     where c.cache_key = v_key and (c.last_hit_at is null or c.last_hit_at < now() - interval '5 minutes');
    return v_result;
  end if;

  execute p_recompute into v_result using p_params;

  v_ttl := app.cache_ttl_for_team(p_team);
  insert into app.rpc_cache
    (cache_key, team_id, fn_name, result, expires_at, params, recompute_sql, user_id, warm, last_hit_at, hit_count)
  values
    (v_key, p_team, p_fn, v_result, now() + v_ttl, p_params, p_recompute, auth.uid(), (v_ttl >= interval '60 minutes'), now(), 1)
  on conflict (cache_key) do update
    set result = excluded.result, expires_at = excluded.expires_at, created_at = now(),
        params = excluded.params, recompute_sql = excluded.recompute_sql, user_id = excluded.user_id,
        warm = excluded.warm, last_hit_at = now(), hit_count = app.rpc_cache.hit_count + 1;

  return v_result;
end;
$function$;

create or replace function app.cached_shopping_overview_v2(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_brand_search text DEFAULT NULL::text, p_brand_order text DEFAULT 'share_of_shelf_desc'::text, p_brand_limit integer DEFAULT 25, p_brand_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select app._app_gate_v1(p_team);
  select app._shopping_cached_v2('shopping_overview_v1', p_team,
    jsonb_build_object('p_team', p_team, 'p_date_from', p_date_from, 'p_date_to', p_date_to, 'p_models', p_models,
                       'p_markets', p_markets, 'p_tag_ids', p_tag_ids, 'p_tagmode', lower(coalesce(p_tagmode, 'or')),
                       'p_brand_search', nullif(btrim(coalesce(p_brand_search, '')), ''),
                       'p_brand_order', lower(coalesce(p_brand_order, 'share_of_shelf_desc')),
                       'p_brand_limit', p_brand_limit, 'p_brand_offset', p_brand_offset),
    $r$ select app.get_shopping_overview_v1(($1->>'p_team')::uuid, ($1->>'p_date_from')::date, ($1->>'p_date_to')::date,
          app.jsonb_to_text_array($1->'p_models'), app.jsonb_to_text_array($1->'p_markets'),
          app.jsonb_to_uuid_array($1->'p_tag_ids'), $1->>'p_tagmode', $1->>'p_brand_search', $1->>'p_brand_order',
          ($1->>'p_brand_limit')::integer, ($1->>'p_brand_offset')::integer) $r$)
$function$;

create or replace function app.cached_shopping_products_v2(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_segment text DEFAULT 'all'::text, p_search text DEFAULT NULL::text, p_merchant text DEFAULT NULL::text, p_company_id uuid DEFAULT NULL::uuid, p_order text DEFAULT 'visibility_desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select app._app_gate_v1(p_team);
  select app._shopping_cached_v2('shopping_products_v1', p_team,
    jsonb_build_object('p_team', p_team, 'p_date_from', p_date_from, 'p_date_to', p_date_to, 'p_models', p_models,
                       'p_markets', p_markets, 'p_tag_ids', p_tag_ids, 'p_tagmode', lower(coalesce(p_tagmode, 'or')),
                       'p_segment', lower(coalesce(p_segment, 'all')), 'p_search', nullif(btrim(coalesce(p_search, '')), ''),
                       'p_merchant', nullif(btrim(coalesce(p_merchant, '')), ''), 'p_company_id', p_company_id,
                       'p_order', lower(coalesce(p_order, 'visibility_desc')), 'p_limit', p_limit, 'p_offset', p_offset),
    $r$ select app.get_shopping_products_v1(($1->>'p_team')::uuid, ($1->>'p_date_from')::date, ($1->>'p_date_to')::date,
          app.jsonb_to_text_array($1->'p_models'), app.jsonb_to_text_array($1->'p_markets'),
          app.jsonb_to_uuid_array($1->'p_tag_ids'), $1->>'p_tagmode', $1->>'p_segment', $1->>'p_search',
          $1->>'p_merchant', ($1->>'p_company_id')::uuid, $1->>'p_order',
          ($1->>'p_limit')::integer, ($1->>'p_offset')::integer) $r$)
$function$;

create or replace function app.cached_shopping_product_detail_v2(p_team uuid, p_source_product_id text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select app._app_gate_v1(p_team);
  select app._shopping_cached_v2('shopping_product_detail_v1', p_team,
    jsonb_build_object('p_team', p_team, 'p_source_product_id', btrim(coalesce(p_source_product_id, '')),
                       'p_date_from', p_date_from, 'p_date_to', p_date_to, 'p_models', p_models,
                       'p_markets', p_markets, 'p_tag_ids', p_tag_ids, 'p_tagmode', lower(coalesce(p_tagmode, 'or')),
                       'p_limit', p_limit, 'p_offset', p_offset),
    $r$ select app.get_shopping_product_detail_v1(($1->>'p_team')::uuid, $1->>'p_source_product_id',
          ($1->>'p_date_from')::date, ($1->>'p_date_to')::date,
          app.jsonb_to_text_array($1->'p_models'), app.jsonb_to_text_array($1->'p_markets'),
          app.jsonb_to_uuid_array($1->'p_tag_ids'), $1->>'p_tagmode',
          ($1->>'p_limit')::integer, ($1->>'p_offset')::integer) $r$)
$function$;

create or replace function app.cached_shopping_merchants_v2(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_tagmode text DEFAULT 'or'::text, p_search text DEFAULT NULL::text, p_order text DEFAULT 'observations_desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select app._app_gate_v1(p_team);
  select app._shopping_cached_v2('shopping_merchants_v1', p_team,
    jsonb_build_object('p_team', p_team, 'p_date_from', p_date_from, 'p_date_to', p_date_to, 'p_models', p_models,
                       'p_markets', p_markets, 'p_tag_ids', p_tag_ids, 'p_tagmode', lower(coalesce(p_tagmode, 'or')),
                       'p_search', nullif(btrim(coalesce(p_search, '')), ''),
                       'p_order', lower(coalesce(p_order, 'observations_desc')),
                       'p_limit', p_limit, 'p_offset', p_offset),
    $r$ select app.get_shopping_merchants_v1(($1->>'p_team')::uuid, ($1->>'p_date_from')::date, ($1->>'p_date_to')::date,
          app.jsonb_to_text_array($1->'p_models'), app.jsonb_to_text_array($1->'p_markets'),
          app.jsonb_to_uuid_array($1->'p_tag_ids'), $1->>'p_tagmode', $1->>'p_search', $1->>'p_order',
          ($1->>'p_limit')::integer, ($1->>'p_offset')::integer) $r$)
$function$;


-- -----------------------------------------------------------------------------
-- 1b  Ads ohne Umschlag, p_team / p_tag_ids
-- -----------------------------------------------------------------------------
create or replace function app.get_ads_overview_v2(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_advertisers text[] DEFAULT NULL::text[], p_ad_formats text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
-- 13.10.2026 (vor_nextjs_v1.sql): wie get_ads_overview_v1, ohne Umschlag, p_team/p_tag_ids
declare
  v_runs  numeric;
  v_ads   numeric;
  m       record;
  v_out   jsonb;
begin
  perform app._app_gate_v1(p_team);
  perform app._pi_rate_limit_v1('ads_overview_v2', 30, 'ads');
  perform app.require_team_access(p_team);
  perform app._ads_scope_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_advertisers, p_ad_formats);
  perform app._ads_advertiser_info_v1(p_team);
  select * into m from _ad_meta;
  select count(*) into v_runs from _ad_runs;
  select count(*) into v_ads from _ad_ads;

  select jsonb_build_object(
    'kpis', jsonb_build_object(
       'ad_coverage_pct',  app._ads_pct((select count(distinct prompt_run_id) from _ad_ads), v_runs),
       'advertisers',      (select count(distinct advertiser_name) from _ad_ads),
       'ad_appearances',   v_ads,
       'prompts_with_ads', (select count(distinct prompt_id) from _ad_ads),
       'tracked_prompts',  (select count(distinct prompt_id) from _ad_runs)),
    'trend', coalesce((
       select jsonb_agg(jsonb_build_object(
                'date',            d.day,
                'total_runs',      d.total_runs,
                'runs_with_ads',   d.runs_with_ads,
                'ad_coverage_pct', app._ads_pct(d.runs_with_ads, d.total_runs),
                'ad_appearances',  d.ad_appearances) order by d.day)
       from (select g::date as day,
                    (select count(*) from _ad_runs r where r.day = g::date) as total_runs,
                    (select count(distinct a.prompt_run_id) from _ad_ads a where a.day = g::date) as runs_with_ads,
                    (select count(*) from _ad_ads a where a.day = g::date) as ad_appearances
             from generate_series(m.date_from, m.date_to, interval '1 day') g) d), '[]'::jsonb),
    'advertiser_share', coalesce((
       select jsonb_agg(jsonb_build_object(
                'advertiser_name', z.advertiser_name,
                'company_id',      ai.company_id,
                'domain',          ai.domain,
                'ad_appearances',  z.n,
                'ad_share_pct',    app._ads_pct(z.n, v_ads)) order by z.n desc, z.advertiser_name)
       from (select advertiser_name, count(*) n from _ad_ads where advertiser_name is not null
             group by 1 order by 2 desc, 1 limit 10) z
       left join _ad_adv ai on ai.advertiser_name = z.advertiser_name), '[]'::jsonb),
    'topics', coalesce((
       select jsonb_agg(jsonb_build_object(
                'topic_id',         t.topic_id,
                'topic_name',       t.topic_name,
                'emoji',            t.topic_emoji,
                'hex_light',        t.topic_hex_light,
                'hex_dark',         t.topic_hex_dark,
                'ad_coverage_pct',  app._ads_pct(t.runs_with_ads, t.total_runs),
                'advertiser_count', t.advertisers,
                'ad_appearances',   t.appearances)
              order by t.appearances desc, app._ads_pct(t.runs_with_ads, t.total_runs) desc nulls last, lower(t.topic_name))
       from (select pt.topic_id, pt.topic_name, pt.topic_emoji, pt.topic_hex_light, pt.topic_hex_dark,
                    (select count(*) from _ad_runs r where r.prompt_id in (select x.prompt_id from _ad_ptags x where x.topic_id = pt.topic_id)) as total_runs,
                    (select count(distinct a.prompt_run_id) from _ad_ads a where a.prompt_id in (select x.prompt_id from _ad_ptags x where x.topic_id = pt.topic_id)) as runs_with_ads,
                    (select count(distinct a.advertiser_name) from _ad_ads a where a.prompt_id in (select x.prompt_id from _ad_ptags x where x.topic_id = pt.topic_id)) as advertisers,
                    (select count(*) from _ad_ads a where a.prompt_id in (select x.prompt_id from _ad_ptags x where x.topic_id = pt.topic_id)) as appearances
             from (select distinct topic_id, topic_name, topic_emoji, topic_hex_light, topic_hex_dark from _ad_ptags
                   where p_tag_ids is null or cardinality(p_tag_ids) = 0 or topic_id = any(p_tag_ids)) pt) t), '[]'::jsonb),
    'recent_ads', coalesce((
       select jsonb_agg(z.item order by z.run_at desc, z.ordinal, z.id)
       from (select * from _ad_ads order by run_at desc, ordinal, id limit 6) z), '[]'::jsonb))
    into v_out;

  return (v_out);
end;
$function$;

create or replace function app.list_ads_advertisers_v2(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_advertisers text[] DEFAULT NULL::text[], p_ad_formats text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_sort text DEFAULT 'ad_appearances_desc'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
-- 13.10.2026 (vor_nextjs_v1.sql): wie list_ads_advertisers_v1, ohne Umschlag, p_team/p_tag_ids
declare
  v_sort   text := lower(coalesce(nullif(btrim(p_sort), ''), 'ad_appearances_desc'));
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_ads    numeric;
  v_total  integer;
  v_items  jsonb;
begin
  perform app._app_gate_v1(p_team);
  if v_sort not in ('ad_appearances_desc', 'ad_appearances_asc', 'prompt_count_desc', 'topic_count_desc',
                    'last_seen_desc', 'first_seen_asc', 'advertiser_name_asc') then
    raise exception 'ads_invalid_param' using errcode = '22023', hint = 'p_sort';
  end if;
  perform app._pi_rate_limit_v1('ads_advertisers_v2', 30, 'ads');
  perform app.require_team_access(p_team);
  perform app._ads_scope_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_advertisers, p_ad_formats);
  perform app._ads_advertiser_info_v1(p_team);
  select count(*) into v_ads from _ad_ads;

  drop table if exists _ad_advrows;
  create temp table _ad_advrows on commit drop as
  select a.advertiser_name,
         count(*)                         as appearances,
         count(distinct a.prompt_id)      as prompt_count,
         (select count(distinct t.topic_id) from _ad_ptags t
          where t.prompt_id in (select distinct x.prompt_id from _ad_ads x where x.advertiser_name = a.advertiser_name)) as topic_count,
         coalesce(jsonb_agg(distinct a.market) filter (where a.market is not null), '[]'::jsonb)       as markets,
         coalesce(jsonb_agg(distinct a.ad_format) filter (where a.ad_format is not null), '[]'::jsonb) as ad_formats,
         min(a.run_at) as first_seen,
         max(a.run_at) as last_seen
  from _ad_ads a
  where a.advertiser_name is not null
  group by a.advertiser_name;

  select count(*) into v_total from _ad_advrows r
  where v_search is null or lower(r.advertiser_name) like '%' || v_search || '%';

  select coalesce(jsonb_agg(z.j order by z.rn), '[]'::jsonb) into v_items
  from (
    select * from (
      select jsonb_build_object(
               'advertiser_name', r.advertiser_name,
               'company_id',      ai.company_id,
               'relationship',    ai.relationship,
               'logo_url',        ai.logo_url,
               'domain',          ai.domain,
               'ad_share_pct',    app._ads_pct(r.appearances, v_ads),
               'ad_appearances',  r.appearances,
               'prompt_count',    r.prompt_count,
               'topic_count',     r.topic_count,
               'markets',         r.markets,
               'ad_formats',      r.ad_formats,
               'first_seen',      r.first_seen,
               'last_seen',       r.last_seen) as j,
             row_number() over (order by
               case when v_sort = 'ad_appearances_desc' then r.appearances end desc nulls last,
               case when v_sort = 'ad_appearances_asc'  then r.appearances end asc  nulls last,
               case when v_sort = 'prompt_count_desc'   then r.prompt_count end desc nulls last,
               case when v_sort = 'topic_count_desc'    then r.topic_count end desc nulls last,
               case when v_sort = 'last_seen_desc'      then r.last_seen end desc nulls last,
               case when v_sort = 'first_seen_asc'      then r.first_seen end asc nulls last,
               case when v_sort = 'advertiser_name_asc' then lower(r.advertiser_name) end asc nulls last,
               r.appearances desc, r.advertiser_name) as rn
      from _ad_advrows r
      left join _ad_adv ai on ai.advertiser_name = r.advertiser_name
      where v_search is null or lower(r.advertiser_name) like '%' || v_search || '%'
    ) q
    order by q.rn
    offset v_offset limit v_limit
  ) z;

  return (jsonb_build_object(
    'items', v_items, 'total_count', v_total, 'limit', v_limit, 'offset', v_offset));
end;
$function$;

create or replace function app.get_ads_advertiser_detail_v2(p_team uuid, p_advertiser_name text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_advertisers text[] DEFAULT NULL::text[], p_ad_formats text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
-- 13.10.2026 (vor_nextjs_v1.sql): wie get_ads_advertiser_detail_v1, ohne Umschlag, p_team/p_tag_ids
declare
  v_name     text := p_advertiser_name;
  m          record;
  v_all_ads  numeric;
  v_company  uuid;
  v_rel      text;
  v_logo     text;
  v_tracked  boolean;
  v_domain   text;
  v_out      jsonb;
begin
  perform app._app_gate_v1(p_team);
  if nullif(btrim(coalesce(v_name, '')), '') is null then
    raise exception 'ads_invalid_param' using errcode = '22023', hint = 'p_advertiser_name';
  end if;
  perform app._pi_rate_limit_v1('ads_advertiser_detail_v2', 30, 'ads');
  perform app.require_team_access(p_team);
  -- Scope ohne Advertiser-Filter (Anteil = Advertiser / alle passenden Ads)
  perform app._ads_scope_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, null, p_ad_formats);
  select * into m from _ad_meta;
  select count(*) into v_all_ads from _ad_ads;

  -- Stammdaten aus allen Ads des Teams mit diesem Namen (nicht nur im Zeitraum)
  select a.company_id into v_company
  from app.prompt_run_ad a
  where a.team_id = p_team and a.advertiser_name = v_name and a.company_id is not null
  group by a.company_id order by count(*) desc, a.company_id limit 1;
  select case tc.role::text when 'own' then 'you' when 'competitor' then 'competitor' end,
         coalesce(nullif(tbp.logo_override_url, ''), c.favicon_url),
         tc.company_id is not null
    into v_rel, v_logo, v_tracked
  from (select v_company as company_id) x
  left join app.team_company tc on tc.team_id = p_team and tc.company_id = x.company_id
  left join app.company c on c.id = x.company_id
  left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = x.company_id;
  if v_company is null then v_logo := null; end if;

  -- Domain: Firma, sonst haeufigste Landing-Domain ueber die ganze Historie
  select app._ads_host_v1(c.url) into v_domain from app.company c where c.id = v_company;
  if v_domain is null then
    select d into v_domain
    from (select app._ads_host_v1(a.landing_domain) d, count(*) n
          from app.prompt_run_ad a
          where a.team_id = p_team and a.advertiser_name = v_name and app._ads_host_v1(a.landing_domain) is not null
          group by 1) z
    order by n desc, d limit 1;
  end if;

  drop table if exists _ad_mine;
  create temp table _ad_mine on commit drop as select * from _ad_ads where advertiser_name = v_name;

  select jsonb_build_object(
    'advertiser', jsonb_build_object(
       'advertiser_name', v_name,
       'company_id',      v_company,
       'relationship',    v_rel,
       'logo_url',        v_logo,
       'domain',          v_domain,
       'landing_domains', coalesce((select jsonb_agg(d order by n desc, d) from
                             (select landing_domain d, count(*) n from _ad_mine where landing_domain is not null group by 1) z), '[]'::jsonb),
       'ad_formats',      coalesce((select jsonb_agg(f order by n desc, f) from
                             (select ad_format f, count(*) n from _ad_mine where ad_format is not null group by 1) z), '[]'::jsonb),
       'first_seen',      (select min(run_at) from _ad_mine),
       'last_seen',       (select max(run_at) from _ad_mine)),
    'summary', jsonb_build_object(
       'ad_appearances', (select count(*) from _ad_mine),
       'prompt_count',   (select count(distinct prompt_id) from _ad_mine),
       'topic_count',    (select count(distinct t.topic_id) from _ad_ptags t where t.prompt_id in (select prompt_id from _ad_mine)),
       'ad_share_pct',   app._ads_pct((select count(*) from _ad_mine), v_all_ads)),
    'trend', coalesce((
       select jsonb_agg(jsonb_build_object(
                'date',           d.day,
                'ad_appearances', d.mine,
                'ad_share_pct',   app._ads_pct(d.mine, d.alls)) order by d.day)
       from (select g::date as day,
                    (select count(*) from _ad_mine a where a.day = g::date) as mine,
                    (select count(*) from _ad_ads a where a.day = g::date)  as alls
             from generate_series(m.date_from, m.date_to, interval '1 day') g) d), '[]'::jsonb),
    'prompts', coalesce((
       select jsonb_agg(jsonb_build_object(
                'prompt_id',              z.prompt_id,
                'prompt_text',            z.prompt_text,
                'topics',                 coalesce(tp.topics, '[]'::jsonb),
                'ad_appearances',         z.n,
                'last_seen',              z.last_seen,
                -- organische Sichtbarkeit nur bei aufgeloester, getrackter Firma
                'organic_visibility_pct', case when v_tracked then app._ads_pct(
                                              (select count(distinct r.run_id) from _ad_runs r
                                               where r.prompt_id = z.prompt_id
                                                 and exists (select 1 from app.recommendation rc
                                                             where rc.prompt_run_id = r.run_id and rc.team_id = p_team
                                                               and rc.company_id = v_company)),
                                              (select count(*) from _ad_runs r where r.prompt_id = z.prompt_id)) end,
                'organic_mentioned',      case when v_tracked then exists (
                                              select 1 from _ad_runs r
                                              join app.recommendation rc on rc.prompt_run_id = r.run_id and rc.team_id = p_team
                                                                         and rc.company_id = v_company
                                              where r.prompt_id = z.prompt_id) end)
              order by z.n desc, z.last_seen desc, z.prompt_id)
       from (select a.prompt_id, max(r.prompt_text) as prompt_text, count(*) n, max(a.run_at) last_seen
             from _ad_mine a join _ad_runs r on r.run_id = a.prompt_run_id
             group by a.prompt_id) z
       left join _ad_ptopics tp on tp.prompt_id = z.prompt_id), '[]'::jsonb),
    'ads', coalesce((
       select jsonb_agg(z.item order by z.run_at desc, z.ordinal, z.id)
       from (select * from _ad_mine order by run_at desc, ordinal, id limit 20) z), '[]'::jsonb))
    into v_out;

  return (v_out);
end;
$function$;

create or replace function app.list_ads_library_v2(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_advertisers text[] DEFAULT NULL::text[], p_ad_formats text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
-- 13.10.2026 (vor_nextjs_v1.sql): wie list_ads_library_v1, ohne Umschlag, p_team/p_tag_ids
declare
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total  integer;
  v_items  jsonb;
begin
  perform app._app_gate_v1(p_team);
  perform app._pi_rate_limit_v1('ads_library_v2', 30, 'ads');
  perform app.require_team_access(p_team);
  perform app._ads_scope_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_advertisers, p_ad_formats);

  select count(*) into v_total from _ad_ads where v_search is null or search_text like '%' || v_search || '%';
  select coalesce(jsonb_agg(z.item order by z.run_at desc, z.ordinal, z.id), '[]'::jsonb) into v_items
  from (select * from _ad_ads
        where v_search is null or search_text like '%' || v_search || '%'
        order by run_at desc, ordinal, id
        offset v_offset limit v_limit) z;

  return (jsonb_build_object(
    'items', v_items, 'total_count', v_total, 'limit', v_limit, 'offset', v_offset));
end;
$function$;

create or replace function app.list_ads_prompts_v2(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_advertisers text[] DEFAULT NULL::text[], p_ad_formats text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_sort text DEFAULT 'ad_coverage_desc'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
-- 13.10.2026 (vor_nextjs_v1.sql): wie list_ads_prompts_v1, ohne Umschlag, p_team/p_tag_ids
declare
  v_sort   text := lower(coalesce(nullif(btrim(p_sort), ''), 'ad_coverage_desc'));
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total  integer;
  v_items  jsonb;
begin
  perform app._app_gate_v1(p_team);
  if v_sort not in ('ad_coverage_desc', 'ad_coverage_asc', 'ad_appearances_desc', 'advertiser_count_desc',
                    'last_ad_seen_desc', 'total_runs_desc', 'prompt_text_asc') then
    raise exception 'ads_invalid_param' using errcode = '22023', hint = 'p_sort';
  end if;
  perform app._pi_rate_limit_v1('ads_prompts_v2', 30, 'ads');
  perform app.require_team_access(p_team);
  perform app._ads_scope_v1(p_team, p_date_from, p_date_to, p_models, p_markets, p_tag_ids, p_advertisers, p_ad_formats);

  drop table if exists _ad_prows;
  create temp table _ad_prows on commit drop as
  select r.prompt_id, max(r.prompt_text) as prompt_text,
         count(*) as total_runs,
         count(*) filter (where exists (select 1 from _ad_ads a where a.prompt_run_id = r.run_id)) as runs_with_ads,
         (select count(distinct a.advertiser_name) from _ad_ads a where a.prompt_id = r.prompt_id) as advertiser_count,
         (select count(*) from _ad_ads a where a.prompt_id = r.prompt_id) as ad_appearances,
         (select max(a.run_at) from _ad_ads a where a.prompt_id = r.prompt_id) as last_ad_seen
  from _ad_runs r
  group by r.prompt_id;

  select count(*) into v_total from _ad_prows p
  where v_search is null or lower(p.prompt_text) like '%' || v_search || '%';

  select coalesce(jsonb_agg(z.j order by z.rn), '[]'::jsonb) into v_items
  from (
    select * from (
      select jsonb_build_object(
               'prompt_id',        p.prompt_id,
               'prompt_text',      p.prompt_text,
               'topics',           coalesce(tp.topics, '[]'::jsonb),
               'ad_coverage_pct',  app._ads_pct(p.runs_with_ads, p.total_runs),
               'advertiser_count', p.advertiser_count,
               'ad_appearances',   p.ad_appearances,
               'last_ad_seen',     p.last_ad_seen,
               'total_runs',       p.total_runs,
               'runs_with_ads',    p.runs_with_ads) as j,
             row_number() over (order by
               case when v_sort = 'ad_coverage_desc'      then app._ads_pct(p.runs_with_ads, p.total_runs) end desc nulls last,
               case when v_sort = 'ad_coverage_asc'       then app._ads_pct(p.runs_with_ads, p.total_runs) end asc  nulls last,
               case when v_sort = 'ad_appearances_desc'   then p.ad_appearances end desc nulls last,
               case when v_sort = 'advertiser_count_desc' then p.advertiser_count end desc nulls last,
               case when v_sort = 'last_ad_seen_desc'     then p.last_ad_seen end desc nulls last,
               case when v_sort = 'total_runs_desc'       then p.total_runs end desc nulls last,
               case when v_sort = 'prompt_text_asc'       then lower(p.prompt_text) end asc nulls last,
               p.ad_appearances desc, p.prompt_id) as rn
      from _ad_prows p
      left join _ad_ptopics tp on tp.prompt_id = p.prompt_id
      where v_search is null or lower(p.prompt_text) like '%' || v_search || '%'
    ) q
    order by q.rn
    offset v_offset limit v_limit
  ) z;

  return (jsonb_build_object(
    'items', v_items, 'total_count', v_total, 'limit', v_limit, 'offset', v_offset));
end;
$function$;

create or replace function app.get_ads_filter_options_v2(p_team uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
-- 13.10.2026 (vor_nextjs_v1.sql): wie get_ads_filter_options_v1, ohne Umschlag, p_team/p_tag_ids
declare
  v_out jsonb;
begin
  perform app._app_gate_v1(p_team);
  perform app._pi_rate_limit_v1('ads_filter_options_v2', 30, 'ads');
  perform app.require_team_access(p_team);
  perform app._ads_scope_v1(p_team, p_date_from, p_date_to, null, null, null, null, null);
  perform app._ads_advertiser_info_v1(p_team);

  select jsonb_build_object(
    'models', coalesce((select jsonb_agg(jsonb_build_object('value', model, 'label', model, 'count', n) order by n desc, model)
                        from (select model, count(*) n from _ad_runs where model is not null group by 1) z), '[]'::jsonb),
    'markets', coalesce((select jsonb_agg(jsonb_build_object('value', market, 'label', market, 'count', n) order by n desc, market)
                         from (select market, count(*) n from _ad_runs where market is not null group by 1) z), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('value', topic_id, 'label', topic_name, 'count', n,
                                                         'emoji', topic_emoji, 'hex_light', topic_hex_light, 'hex_dark', topic_hex_dark)
                                      order by lower(topic_name), topic_id)
                        from (select t.topic_id, t.topic_name, t.topic_emoji, t.topic_hex_light, t.topic_hex_dark, count(*) n
                              from _ad_runs r join _ad_ptags t on t.prompt_id = r.prompt_id
                              group by 1, 2, 3, 4, 5) z), '[]'::jsonb),
    'advertisers', coalesce((select jsonb_agg(jsonb_build_object('value', z.advertiser_name, 'label', z.advertiser_name, 'count', z.n,
                                                              'domain', ai.domain) order by z.n desc, z.advertiser_name)
                             from (select advertiser_name, count(*) n from _ad_ads where advertiser_name is not null group by 1) z
                             left join _ad_adv ai on ai.advertiser_name = z.advertiser_name), '[]'::jsonb),
    'ad_formats', coalesce((select jsonb_agg(jsonb_build_object(
                               'value', ad_format,
                               'label', case ad_format when 'image_card_v2' then 'Image Ad'
                                                       when 'product_card_v2' then 'Product Ad'
                                                       else ad_format end,
                               'count', n) order by n desc, ad_format)
                            from (select ad_format, count(*) n from _ad_ads where ad_format is not null group by 1) z), '[]'::jsonb))
    into v_out;

  return (v_out);
end;
$function$;


-- -----------------------------------------------------------------------------
-- 1c  Events: Analyse ohne js_safe (intern)
-- -----------------------------------------------------------------------------
create or replace function app._impact_event_analysis_v2(p_team uuid, p_event_id uuid, p_window_days integer DEFAULT 30, p_models text[] DEFAULT NULL::text[], p_markets text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
-- 13.10.2026 (vor_nextjs_v1.sql): wie get_impact_event_analysis_v1, ohne js_safe, intern
declare
  e            app.impact_event;
  v_n          integer := greatest(1, least(coalesce(p_window_days, 30), 183));
  v_all_models boolean := (p_models is null or cardinality(p_models) = 0);
  v_all_mkts   boolean := (p_markets is null or cardinality(p_markets) = 0);
  v_bf date; v_bt date; v_af date; v_at date; v_req_at date;
  v_obs_to     date;
  v_aff_all    uuid[];
  v_aff        uuid[];
  v_cmp        uuid[];
  v_aff_models text[];
  v_aff_cmp    uuid[];
  v_cmp_models text[];
  v_cmp_cmp    uuid[];
  v_post_only  integer;
  v_no_data    integer;
  v_deleted    integer;
  v_own        uuid;
  v_urls       text[];
  j_windows    jsonb;
  j_cohort     jsonb;
  j_aff        jsonb;
  j_cmp        jsonb;
  j_cmp_delta  jsonb;
  j_comp       jsonb;
  j_urls       jsonb;
  j_trend      jsonb;
  j_overlaps   jsonb;
  v_first_b date; v_last_b date; v_first_a date; v_last_a date;
  v_days_b integer; v_days_a integer;
begin
  perform app.require_team_access(p_team);
  perform set_config('jit', 'off', true);

  select * into e from app.impact_event x where x.id = p_event_id and x.team_id = p_team;
  if e.id is null then
    raise exception 'impact_event_not_found' using errcode = 'PT404';
  end if;

  -- Fenster: symmetrisch angefragt, Event-Tag ausgeschlossen
  v_bf := e.event_date - v_n;
  v_bt := e.event_date - 1;
  v_af := e.event_date + 1;
  v_req_at := e.event_date + v_n;
  v_at := least(v_req_at, current_date);
  v_obs_to := least(e.event_date + 183, current_date);

  select tc.company_id into v_own from app.team_company tc where tc.team_id = p_team and tc.role = 'own' limit 1;

  -- Kohorten (eingefroren), Markt-Filter auf die Kohorte
  select coalesce(array_agg(c.prompt_id) filter (where c.cohort = 'affected'), '{}'),
         coalesce(array_agg(c.prompt_id) filter (where c.cohort = 'affected'
                    and (v_all_mkts or p.market = any(p_markets))), '{}'),
         coalesce(array_agg(c.prompt_id) filter (where c.cohort = 'comparison'
                    and (v_all_mkts or p.market = any(p_markets))), '{}'),
         count(*) filter (where p.id is null)
    into v_aff_all, v_aff, v_cmp, v_deleted
  from app.impact_event_prompt c
  left join app.prompt p on p.id = c.prompt_id
  where c.event_id = e.id;

  -- Vergleichbarkeit (Stufe 1: Modelle, Stufe 2: Prompts), getrennt je Kohorte
  with cells as (
    select d.prompt_id, d.model,
           sum(d.runs_total) filter (where d.day between v_bf and v_bt) as rb,
           sum(d.runs_total) filter (where d.day between v_af and v_at) as ra
    from app.daily_runs_by_prompt_model d
    where d.team_id = p_team
      and d.prompt_id = any(v_aff || v_cmp)
      and d.day between v_bf and v_at and d.day <> e.event_date
      and (v_all_models or d.model = any(p_models))
    group by d.prompt_id, d.model
  ), lab as (
    select c.*, (c.prompt_id = any(v_aff)) as is_aff from cells c
  ), mdl as (
    select is_aff, model from lab group by is_aff, model
    having coalesce(sum(rb), 0) > 0 and coalesce(sum(ra), 0) > 0
  ), prm as (
    select l.is_aff, l.prompt_id from lab l
    join mdl m on m.is_aff = l.is_aff and m.model = l.model
    group by l.is_aff, l.prompt_id
    having coalesce(sum(l.rb), 0) > 0 and coalesce(sum(l.ra), 0) > 0
  ), any_side as (
    select prompt_id, coalesce(sum(rb), 0) as rb, coalesce(sum(ra), 0) as ra
    from lab where is_aff group by prompt_id
  )
  select
    coalesce((select array_agg(model order by model) from mdl where is_aff), '{}'),
    coalesce((select array_agg(prompt_id) from prm where is_aff), '{}'),
    coalesce((select array_agg(model order by model) from mdl where not is_aff), '{}'),
    coalesce((select array_agg(prompt_id) from prm where not is_aff), '{}'),
    (select count(*) from any_side where rb = 0 and ra > 0),
    cardinality(v_aff) - (select count(*) from any_side where rb > 0 or ra > 0)
  into v_aff_models, v_aff_cmp, v_cmp_models, v_cmp_cmp, v_post_only, v_no_data;

  -- Tatsaechlich belegte Tage (betroffene Kohorte, Filter wie oben)
  select min(d.day) filter (where d.day <= v_bt), max(d.day) filter (where d.day <= v_bt),
         min(d.day) filter (where d.day >= v_af), max(d.day) filter (where d.day >= v_af),
         count(distinct d.day) filter (where d.day <= v_bt), count(distinct d.day) filter (where d.day >= v_af)
    into v_first_b, v_last_b, v_first_a, v_last_a, v_days_b, v_days_a
  from app.daily_runs_by_prompt_model d
  where d.team_id = p_team and d.prompt_id = any(v_aff)
    and d.day between v_bf and v_at and d.day <> e.event_date
    and (v_all_models or d.model = any(p_models))
    and d.runs_total > 0;

  j_windows := jsonb_build_object(
    'window_days',                v_n,
    'event_date',                 e.event_date,
    'requested_before_from',      v_bf,
    'requested_before_to',        v_bt,
    'requested_after_from',       v_af,
    'requested_after_to',         v_req_at,
    'effective_after_to',         v_at,
    'after_complete',             (v_at = v_req_at),
    'actual_first_before',        v_first_b,
    'actual_last_before',         v_last_b,
    'actual_first_after',         v_first_a,
    'actual_last_after',          v_last_a,
    'before_observed_days',       coalesce(v_days_b, 0),
    'after_observed_days',        coalesce(v_days_a, 0),
    'limited_baseline',           (coalesce(v_days_b, 0) < least(7, v_n)),
    'sentiment_before_from',      greatest(v_bf, v_bt - 29),
    'sentiment_after_from',       case when v_at >= v_af then greatest(v_af, v_at - 29) end
  );

  j_cohort := jsonb_build_object(
    'affected_prompt_count',              cardinality(v_aff_all),
    'affected_in_filter_count',           cardinality(v_aff),
    'comparable_prompt_count',            cardinality(v_aff_cmp),
    'post_only_prompt_count',             coalesce(v_post_only, 0),
    'no_data_prompt_count',               greatest(coalesce(v_no_data, 0), 0),
    'deleted_prompt_count',               coalesce(v_deleted, 0),
    'comparable_models',                  to_jsonb(v_aff_models),
    'comparison_prompt_count',            cardinality(v_cmp),
    'comparison_comparable_prompt_count', cardinality(v_cmp_cmp),
    'comparison_comparable_models',       to_jsonb(v_cmp_models)
  );

  -- Marken-Kennzahlen: betroffen (vorher/nachher) auf der vergleichbaren Menge
  with b as (select * from app.impact_brand_kpis_v1(p_team, v_aff_cmp, v_aff_models, v_bf, v_bt)),
       a as (select * from app.impact_brand_kpis_v1(p_team, v_aff_cmp, v_aff_models, v_af, v_at)),
       x as (
         select b.company_id, b.role, b.name, b.logo_url,
                jsonb_build_object(
                  'visibility', jsonb_build_object('before', b.visibility, 'after', a.visibility, 'delta', a.visibility - b.visibility),
                  'rank',       jsonb_build_object('before', b.avg_rank,   'after', a.avg_rank,   'delta', a.avg_rank - b.avg_rank),
                  'sentiment',  jsonb_build_object('before', b.avg_sentiment, 'after', a.avg_sentiment, 'delta', a.avg_sentiment - b.avg_sentiment),
                  'mention_runs', jsonb_build_object('before', b.mention_runs, 'after', a.mention_runs),
                  'total_runs',   jsonb_build_object('before', b.total_runs,   'after', a.total_runs)
                ) as kpis
         from b join a on a.company_id = b.company_id
       )
  select (select x.kpis || jsonb_build_object('company_id', x.company_id, 'name', x.name, 'logo_url', x.logo_url)
          from x where x.role = 'own' limit 1),
         coalesce((select jsonb_agg(x.kpis || jsonb_build_object('company_id', x.company_id, 'name', x.name, 'logo_url', x.logo_url)
                                    order by (x.kpis #>> '{visibility,after}')::numeric desc nulls last, lower(x.name))
                   from x where x.role = 'competitor'), '[]'::jsonb)
    into j_aff, j_comp;

  -- Vergleichs-Kohorte (nur eigene Marke)
  if cardinality(v_cmp_cmp) > 0 then
    with b as (select * from app.impact_brand_kpis_v1(p_team, v_cmp_cmp, v_cmp_models, v_bf, v_bt) where role = 'own'),
         a as (select * from app.impact_brand_kpis_v1(p_team, v_cmp_cmp, v_cmp_models, v_af, v_at) where role = 'own')
    select jsonb_build_object(
             'visibility', jsonb_build_object('before', b.visibility, 'after', a.visibility, 'delta', a.visibility - b.visibility),
             'rank',       jsonb_build_object('before', b.avg_rank,   'after', a.avg_rank,   'delta', a.avg_rank - b.avg_rank),
             'sentiment',  jsonb_build_object('before', b.avg_sentiment, 'after', a.avg_sentiment, 'delta', a.avg_sentiment - b.avg_sentiment),
             'mention_runs', jsonb_build_object('before', b.mention_runs, 'after', a.mention_runs),
             'total_runs',   jsonb_build_object('before', b.total_runs,   'after', a.total_runs))
      into j_cmp
    from b join a on true
    limit 1;
  end if;
  if j_cmp is not null and j_aff is not null then
    j_cmp_delta := jsonb_build_object(
      'visibility', (j_aff #>> '{visibility,delta}')::numeric - (j_cmp #>> '{visibility,delta}')::numeric,
      'rank',       (j_aff #>> '{rank,delta}')::numeric       - (j_cmp #>> '{rank,delta}')::numeric,
      'sentiment',  (j_aff #>> '{sentiment,delta}')::numeric  - (j_cmp #>> '{sentiment,delta}')::numeric);
  end if;

  -- URLs: Global Share vorher/nachher (vergleichbare Menge) + Beobachtung
  -- (Event-Kohorte des Teams, ohne Filter, Event-Tag eingeschlossen, max. 183 Tage)
  select coalesce(array_agg(u.url_norm), '{}') into v_urls from app.impact_event_url u where u.event_id = e.id;
  if cardinality(v_urls) > 0 then
    with sb as (select * from app.impact_url_share_v1(p_team, v_aff_cmp, v_aff_models, v_bf, v_bt, v_urls)),
         sa as (select * from app.impact_url_share_v1(p_team, v_aff_cmp, v_aff_models, v_af, v_at, v_urls)),
         seen as (
           select d.url, bool_or(d.day < e.event_date) as seen_before
           from app.daily_citation_url_rollup d
           where d.team_id = p_team
             and d.url = any(v_urls)
             and d.prompt_id = any(v_aff_all)
             and d.day between e.event_date - 183 and e.event_date - 1
             and d.runs_with_url > 0
           group by d.url
         ),
         -- Erste Beobachtung = konkreter Run: Tage aus dem Rollup (Index team,url,day),
         -- dann der frueheste Run dieser Kohorte an dem Tag, der die URL laut
         -- staged_citation_urls wirklich zitiert (dieselbe Pruefung wie die
         -- Event-Responses in get_mentions_overview_v21). Sortierung run_at, id.
         obs as (
           select u.url, fo.run_id, fo.run_at, fo.day
           from (select distinct x as url from unnest(v_urls) x) u
           left join lateral (
             select pr.id as run_id, pr.run_at, pr.run_day_berlin as day
             from (
               select d.day
               from app.daily_citation_url_rollup d
               where d.team_id = p_team
                 and d.url = u.url
                 and d.prompt_id = any(v_aff_all)
                 and d.day between e.event_date and v_obs_to
                 and d.runs_with_url > 0
               group by d.day
               order by d.day
               limit 31
             ) dd
             join app.prompt_run pr
               on pr.team_id = p_team
              and pr.run_day_berlin = dd.day
              and pr.prompt_id = any(v_aff_all)
             where exists (
               select 1 from app.staged_citation_urls scu
               where scu.team_id = p_team and scu.run_key = pr.run_key and scu.url = u.url)
             order by pr.run_at, pr.id
             limit 1
           ) fo on true
         )
    select jsonb_agg(jsonb_build_object(
             'id',              u.id,
             'url',             u.url_norm,
             'url_input',       u.url_input,
             'team_kannte_url', u.team_kannte_url,
             'global_share',    jsonb_build_object('before', sb.global_share, 'after', sa.global_share,
                                                   'delta', sa.global_share - sb.global_share),
             'runs_with_url',   jsonb_build_object('before', sb.runs_with_url, 'after', sa.runs_with_url),
             'observation', jsonb_build_object(
               'status', case
                           when o.day = e.event_date then 'observed_on_event_day'
                           when o.day > e.event_date then 'first_observed_after_event'
                           when current_date >= e.event_date + 183 then 'not_observed_within_6_months'
                           else 'not_observed_since_event' end,
               'first_observed_day',           o.day,
               'first_observed_at',            o.run_at,
               'first_observed_prompt_run_id', o.run_id,
               'day_number',                   o.day - e.event_date,
               'observed_before_event',        coalesce(sn.seen_before, false),
               'search_until',                 v_obs_to))
           order by u.created_at, u.url_norm)
      into j_urls
    from app.impact_event_url u
    left join sb on sb.url = u.url_norm
    left join sa on sa.url = u.url_norm
    left join obs o on o.url = u.url_norm
    left join seen sn on sn.url = u.url_norm
    where u.event_id = e.id;
  end if;

  -- Trend (taeglich, eigene Marke), gleiche Tagesformeln wie get_company_detailed_chart_v4 (day):
  --   Visibility = mention_runs / runs_total, Rank = sum_rank / count_rank,
  --   Sentiment  = avg(recommendation.sentiment) der Runs des Tages (ohne ignorierte Runs).
  -- Betroffen = ganze betroffene Kohorte inkl. Prompts nur mit Nachher-Daten; Event-Tag enthalten.
  -- Fehlende Daten = null (nie 0), Vergleich ohne Kohorte = null.
  with days as (
    select g::date as day from generate_series(v_bf, greatest(v_at, e.event_date), interval '1 day') g
  ), runs as (
    select d.day, (d.prompt_id = any(v_aff)) as is_aff, sum(d.runs_total)::bigint as runs
    from app.daily_runs_by_prompt_model d
    where d.team_id = p_team and d.prompt_id = any(v_aff || v_cmp) and d.day between v_bf and v_at
      and (v_all_models or d.model = any(p_models))
    group by d.day, (d.prompt_id = any(v_aff))
  ), stats as (
    select d.day, (d.prompt_id = any(v_aff)) as is_aff,
           sum(d.mention_runs)::bigint as m, sum(d.sum_rank)::bigint as sr, sum(d.count_rank)::bigint as cr
    from app.daily_company_prompt_model_stats d
    where d.team_id = p_team and d.company_id = v_own and d.prompt_id = any(v_aff || v_cmp) and d.day between v_bf and v_at
      and (v_all_models or d.model = any(p_models))
    group by d.day, (d.prompt_id = any(v_aff))
  ), sent as (
    select pr.run_day_berlin as day, (pr.prompt_id = any(v_aff)) as is_aff, round(avg(r.sentiment)::numeric, 2) as s
    from app.prompt_run pr
    join app.recommendation r
      on r.prompt_run_id = pr.id and r.team_id = p_team and r.company_id = v_own and r.sentiment is not null
    where pr.team_id = p_team and pr.prompt_id = any(v_aff || v_cmp) and pr.run_day_berlin between v_bf and v_at
      and (v_all_models or pr.model = any(p_models))
      and not exists (select 1 from app.prompt_run_ignore_log il where il.team_id = p_team and il.prompt_run_id = pr.id)
    group by pr.run_day_berlin, (pr.prompt_id = any(v_aff))
  )
  select jsonb_agg(jsonb_build_object(
           'day', dd.day,
           'is_event_day', dd.day = e.event_date,
           'affected_visibility',   case when coalesce(ra.runs, 0) > 0 then round(coalesce(sa.m, 0) * 100.0 / ra.runs, 2) end,
           'affected_rank',         case when coalesce(sa.cr, 0) > 0 then round(sa.sr::numeric / sa.cr, 2) end,
           'affected_sentiment',    ea.s,
           'affected_runs',         coalesce(ra.runs, 0),
           'comparison_visibility', case when coalesce(rc.runs, 0) > 0 then round(coalesce(sc.m, 0) * 100.0 / rc.runs, 2) end,
           'comparison_rank',       case when coalesce(sc.cr, 0) > 0 then round(sc.sr::numeric / sc.cr, 2) end,
           'comparison_sentiment',  ec.s,
           'comparison_runs',       case when cardinality(v_cmp) > 0 then coalesce(rc.runs, 0) end)
         order by dd.day)
    into j_trend
  from days dd
  left join runs  ra on ra.day = dd.day and ra.is_aff
  left join stats sa on sa.day = dd.day and sa.is_aff
  left join sent  ea on ea.day = dd.day and ea.is_aff
  left join runs  rc on rc.day = dd.day and not rc.is_aff
  left join stats sc on sc.day = dd.day and not sc.is_aff
  left join sent  ec on ec.day = dd.day and not ec.is_aff;

  -- Andere Events im Analysezeitraum
  select coalesce(jsonb_agg(jsonb_build_object(
           'event_id', o.id, 'event_date', o.event_date, 'name', o.name,
           'icon', o.icon, 'color', o.color, 'event_type', o.event_type,
           'shared_affected_prompt_count', (
             select count(*) from app.impact_event_prompt a
             join app.impact_event_prompt b on b.prompt_id = a.prompt_id and b.event_id = e.id and b.cohort = 'affected'
             where a.event_id = o.id and a.cohort = 'affected'))
         order by o.event_date, o.created_at), '[]'::jsonb)
    into j_overlaps
  from app.impact_event o
  where o.team_id = p_team and o.id <> e.id and o.event_date between v_bf and v_at;

  return (jsonb_build_object(
    'event_id',         e.id,
    'event_date',       e.event_date,
    'windows',          j_windows,
    'cohort',           j_cohort,
    'affected',         j_aff,
    'comparison',       j_cmp,
    'comparison_delta', j_cmp_delta,
    'competitors',      coalesce(j_comp, '[]'::jsonb),
    'urls',             coalesce(j_urls, '[]'::jsonb),
    'trend',            coalesce(j_trend, '[]'::jsonb),
    'overlaps',         coalesce(j_overlaps, '[]'::jsonb)
  ));
end;
$function$;


-- -----------------------------------------------------------------------------
-- 1c  Events ohne Umschlag
-- -----------------------------------------------------------------------------
-- Detail (intern; der Aufrufer prüft Team und Zugang)
create or replace function app._impact_event_detail_v2(p_team uuid, p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  e      app.impact_event;
  v_role text;
begin
  select * into e from app.impact_event x where x.id = p_event_id and x.team_id = p_team;
  if e.id is null then
    raise exception 'impact_event_not_found' using errcode = 'PT404';
  end if;
  select tm.role::text into v_role from app.team_member tm where tm.team_id = p_team and tm.user_id = v_user;
  return jsonb_build_object(
    'id',          e.id,
    'team_id',     e.team_id,
    'name',        e.name,
    'description', e.description,
    'event_type',  e.event_type,
    'event_date',  e.event_date,
    'icon',        e.icon,
    'color',       e.color,
    'cover',       e.cover,
    'scope_mode',  e.scope_mode,
    'created_by',  e.created_by,
    'created_at',  e.created_at,
    'updated_at',  e.updated_at,
    'can_delete',  (e.created_by = v_user or v_role in ('owner', 'admin')),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.tag_id, 'name', coalesce(tg.name, t.tag_name), 'deleted', tg.id is null)
             order by lower(coalesce(tg.name, t.tag_name)))
      from app.impact_event_tag t
      left join app.tag tg on tg.id = t.tag_id
      where t.event_id = e.id), '[]'::jsonb),
    'selected_topic_count',    case when e.scope_mode = 'topics'
                                    then (select count(*) from app.impact_event_tag t where t.event_id = e.id) end,
    'affected_prompt_count',   (select count(*) from app.impact_event_prompt c where c.event_id = e.id and c.cohort = 'affected'),
    'comparison_prompt_count', (select count(*) from app.impact_event_prompt c where c.event_id = e.id and c.cohort = 'comparison'),
    'affected_url_count',      (select count(*) from app.impact_event_url u where u.event_id = e.id),
    'urls', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'url', u.url_norm, 'url_input', u.url_input,
                                          'team_kannte_url', u.team_kannte_url, 'created_at', u.created_at)
             order by u.created_at, u.url_norm)
      from app.impact_event_url u where u.event_id = e.id), '[]'::jsonb));
end
$function$;

-- Team, Zugang, Ratenlimit (intern)
create or replace function app._impact_event_require_v2(p_team uuid, p_key text, p_limit integer)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
begin
  if p_team is null then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_team';
  end if;
  perform app._pi_rate_limit_v1(p_key, p_limit, 'impact_event');
  perform app._app_gate_v1(p_team);
  perform app.require_team_access(p_team);
end
$function$;

-- Freitext und Darstellungswerte prüfen (intern). null = nicht geprüft (unverändert).
create or replace function app._impact_event_check_v2(p_name text, p_description text, p_event_type text,
                                                     p_icon text, p_color text, p_cover text)
returns void
language plpgsql
immutable
set search_path to 'app', 'public', 'pg_temp'
as $function$
begin
  if p_name is not null and (btrim(p_name) = '' or length(btrim(p_name)) > 120) then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_name: 1-120';
  end if;
  if p_description is not null and length(p_description) > 2000 then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_description: max 2000';
  end if;
  if nullif(btrim(p_event_type), '') is not null and btrim(p_event_type) !~ '^[a-z0-9_]{1,40}$' then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_event_type';
  end if;
  if nullif(btrim(p_icon), '') is not null and btrim(p_icon) !~ '^[a-z0-9_-]{1,40}$' then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_icon';
  end if;
  if nullif(btrim(p_color), '') is not null and btrim(p_color) !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_color';
  end if;
  if nullif(btrim(p_cover), '') is not null
     and btrim(p_cover) !~ '^[a-z0-9_-]{1,60}$'
     and not (btrim(p_cover) ~ '^https://[^\s<>"''`]+$' and length(btrim(p_cover)) <= 2048) then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_cover';
  end if;
end
$function$;

create or replace function app.get_impact_event_v2(p_team uuid, p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
begin
  perform app._impact_event_require_v2(p_team, 'impact_event_read', 120);
  return app._impact_event_detail_v2(p_team, p_event_id);
end
$function$;

create or replace function app.preview_impact_event_scope_v2(p_team uuid, p_scope_mode text, p_tag_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope_mode, '')));
begin
  perform app._impact_event_require_v2(p_team, 'impact_event_preview', 60);
  if v_scope not in ('topics', 'all') then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_scope_mode: topics, all';
  end if;
  if coalesce(cardinality(p_tag_ids), 0) > 200 then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_tag_ids: max 200';
  end if;
  return jsonb_build_object(
    'affected_prompt_count', (select count(*)::int from app.impact_resolve_scope_prompts_v1(p_team, v_scope,
                               (select array_agg(t.id) from app.tag t where t.team_id = p_team and t.id = any(coalesce(p_tag_ids, '{}'))))));
end
$function$;

create or replace function app.create_impact_event_v2(p_team uuid, p_name text, p_event_date date, p_scope_mode text,
  p_tag_ids uuid[] default null, p_urls text[] default null, p_description text default null, p_event_type text default null,
  p_icon text default null, p_color text default null, p_cover text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_user     uuid := auth.uid();
  v_today    date := (now() at time zone 'Europe/Berlin')::date;
  v_scope    text := lower(btrim(coalesce(p_scope_mode, '')));
  v_tags     uuid[];
  v_id       uuid;
  v_affected integer;
  v_urls     text[];
  v_bad      text;
begin
  perform app._impact_event_require_v2(p_team, 'impact_event_write', 30);
  perform app._pi_rate_limit_v1('impact_event_create', 10, 'impact_event');
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'impact_event_name_required' using errcode = '22023', hint = 'p_name';
  end if;
  perform app._impact_event_check_v2(p_name, p_description, p_event_type, p_icon, p_color, p_cover);
  if p_event_date is null or p_event_date > v_today or p_event_date < v_today - 183 then
    raise exception 'impact_event_invalid_date' using errcode = '22023', hint = 'p_event_date: today-183 .. today';
  end if;
  if v_scope not in ('topics', 'all') then
    raise exception 'impact_event_invalid_scope' using errcode = '22023', hint = 'p_scope_mode: topics, all';
  end if;
  -- Obergrenze je Team (Schutz gegen Anlegen in der Schleife)
  perform 1 from app.team t where t.id = p_team for update;
  if (select count(*) from app.impact_event e where e.team_id = p_team) >= 200 then
    raise exception 'impact_event_limit_reached' using errcode = 'PT409', hint = '200';
  end if;

  if v_scope = 'topics' then
    select coalesce(array_agg(distinct t), '{}') into v_tags from unnest(coalesce(p_tag_ids, '{}')) t where t is not null;
    if cardinality(v_tags) = 0 then
      raise exception 'impact_event_topics_required' using errcode = '22023', hint = 'p_tag_ids';
    end if;
    if cardinality(v_tags) > 200
       or (select count(*) from app.tag tg where tg.id = any(v_tags) and tg.team_id = p_team) <> cardinality(v_tags) then
      raise exception 'impact_event_invalid_topics' using errcode = '22023', hint = 'p_tag_ids';
    end if;
  end if;

  if coalesce(cardinality(p_urls), 0) > 500 then
    raise exception 'impact_event_too_many_urls' using errcode = '22023', hint = 'p_urls: max 100';
  end if;
  select u.raw into v_bad
  from unnest(coalesce(p_urls, '{}')) u(raw)
  where nullif(btrim(u.raw), '') is not null and (length(u.raw) > 2048 or app.url_norm_v1(u.raw) is null)
  limit 1;
  if v_bad is not null then
    raise exception 'impact_event_invalid_url' using errcode = '22023', hint = left(v_bad, 200);
  end if;
  select coalesce(array_agg(x.raw order by x.o), '{}') into v_urls
  from (
    select distinct on (app.url_norm_v1(u.raw)) btrim(u.raw) as raw, u.o
    from unnest(coalesce(p_urls, '{}')) with ordinality u(raw, o)
    where nullif(btrim(u.raw), '') is not null
    order by app.url_norm_v1(u.raw), u.o
  ) x;
  if cardinality(v_urls) > 100 then
    raise exception 'impact_event_too_many_urls' using errcode = '22023', hint = 'p_urls: max 100';
  end if;

  insert into app.impact_event
    (team_id, name, description, event_type, event_date, icon, color, cover, scope_mode, created_by)
  values
    (p_team, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
     coalesce(nullif(btrim(coalesce(p_event_type, '')), ''), 'other'),
     p_event_date, nullif(btrim(coalesce(p_icon, '')), ''), nullif(btrim(coalesce(p_color, '')), ''),
     nullif(btrim(coalesce(p_cover, '')), ''), v_scope, v_user)
  returning id into v_id;

  if v_scope = 'topics' then
    insert into app.impact_event_tag (event_id, tag_id, tag_name)
    select v_id, tg.id, tg.name from app.tag tg where tg.id = any(v_tags);
  end if;

  insert into app.impact_event_prompt (event_id, prompt_id, cohort)
  select v_id, x, 'affected'
  from app.impact_resolve_scope_prompts_v1(p_team, v_scope, v_tags) x;
  get diagnostics v_affected = row_count;
  if v_affected = 0 then
    raise exception 'impact_event_no_active_prompts' using errcode = 'PT409';
  end if;

  if v_scope = 'topics' then
    insert into app.impact_event_prompt (event_id, prompt_id, cohort)
    select v_id, p.id, 'comparison'
    from app.prompt p
    where p.team_id = p_team
      and p.is_active
      and not exists (select 1 from app.prompt_tag pt where pt.prompt_id = p.id and pt.tag_id = any(v_tags))
      and not exists (select 1 from app.impact_event_prompt c where c.event_id = v_id and c.prompt_id = p.id)
      and p.market in (
        select pa.market from app.prompt pa
        join app.impact_event_prompt c on c.prompt_id = pa.id
        where c.event_id = v_id and c.cohort = 'affected');
  end if;

  insert into app.impact_event_url (event_id, url_input, url_norm, team_kannte_url, created_by)
  select v_id, u, app.url_norm_v1(u),
         exists (select 1 from app.team_url_state s where s.team_id = p_team and s.url = app.url_norm_v1(u)),
         v_user
  from unnest(v_urls) u;

  return app._impact_event_detail_v2(p_team, v_id);
end
$function$;

-- null = unverändert, '' = leeren (Name kann nicht geleert werden)
create or replace function app.update_impact_event_v2(p_team uuid, p_event_id uuid, p_name text default null,
  p_description text default null, p_event_type text default null, p_icon text default null,
  p_color text default null, p_cover text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
begin
  perform app._impact_event_require_v2(p_team, 'impact_event_write', 30);
  if p_name is not null and btrim(p_name) = '' then
    raise exception 'impact_event_name_required' using errcode = '22023', hint = 'p_name';
  end if;
  perform app._impact_event_check_v2(p_name, p_description, p_event_type, p_icon, p_color, p_cover);
  update app.impact_event e
     set name        = coalesce(btrim(p_name), e.name),
         description = case when p_description is null then e.description else nullif(btrim(p_description), '') end,
         event_type  = case when p_event_type is null then e.event_type else coalesce(nullif(btrim(p_event_type), ''), 'other') end,
         icon        = case when p_icon  is null then e.icon  else nullif(btrim(p_icon), '')  end,
         color       = case when p_color is null then e.color else nullif(btrim(p_color), '') end,
         cover       = case when p_cover is null then e.cover else nullif(btrim(p_cover), '') end
   where e.id = p_event_id and e.team_id = p_team;
  if not found then
    raise exception 'impact_event_not_found' using errcode = 'PT404';
  end if;
  return app._impact_event_detail_v2(p_team, p_event_id);
end
$function$;

create or replace function app.add_impact_event_url_v2(p_team uuid, p_event_id uuid, p_url text)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_norm text;
begin
  perform app._impact_event_require_v2(p_team, 'impact_event_write', 30);
  perform 1 from app.impact_event e where e.id = p_event_id and e.team_id = p_team for update;
  if not found then
    raise exception 'impact_event_not_found' using errcode = 'PT404';
  end if;
  v_norm := case when length(coalesce(p_url, '')) <= 2048 then app.url_norm_v1(p_url) end;
  if v_norm is null then
    raise exception 'impact_event_invalid_url' using errcode = '22023', hint = 'p_url';
  end if;
  if exists (select 1 from app.impact_event_url u where u.event_id = p_event_id and u.url_norm = v_norm) then
    raise exception 'impact_event_url_duplicate' using errcode = 'PT409';
  end if;
  if (select count(*) from app.impact_event_url u where u.event_id = p_event_id) >= 100 then
    raise exception 'impact_event_too_many_urls' using errcode = 'PT409', hint = '100';
  end if;
  begin
    insert into app.impact_event_url (event_id, url_input, url_norm, team_kannte_url, created_by)
    values (p_event_id, btrim(p_url), v_norm,
            exists (select 1 from app.team_url_state s where s.team_id = p_team and s.url = v_norm),
            auth.uid());
  exception when unique_violation then
    raise exception 'impact_event_url_duplicate' using errcode = 'PT409';
  end;
  return app._impact_event_detail_v2(p_team, p_event_id);
end
$function$;

create or replace function app.remove_impact_event_url_v2(p_team uuid, p_event_id uuid, p_url_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
begin
  perform app._impact_event_require_v2(p_team, 'impact_event_write', 30);
  if not exists (select 1 from app.impact_event e where e.id = p_event_id and e.team_id = p_team) then
    raise exception 'impact_event_not_found' using errcode = 'PT404';
  end if;
  delete from app.impact_event_url u where u.id = p_url_id and u.event_id = p_event_id;
  if not found then
    raise exception 'impact_event_url_not_found' using errcode = 'PT404';
  end if;
  return app._impact_event_detail_v2(p_team, p_event_id);
end
$function$;

create or replace function app.delete_impact_event_v2(p_team uuid, p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_user    uuid := auth.uid();
  v_creator uuid;
  v_role    text;
begin
  perform app._impact_event_require_v2(p_team, 'impact_event_write', 30);
  select e.created_by into v_creator from app.impact_event e where e.id = p_event_id and e.team_id = p_team;
  if not found then
    raise exception 'impact_event_not_found' using errcode = 'PT404';
  end if;
  select tm.role::text into v_role from app.team_member tm where tm.team_id = p_team and tm.user_id = v_user;
  if v_creator is distinct from v_user and coalesce(v_role, '') not in ('owner', 'admin') then
    raise exception 'impact_event_forbidden' using errcode = '42501', hint = 'creator,owner,admin';
  end if;
  delete from app.impact_event e where e.id = p_event_id and e.team_id = p_team;
  return jsonb_build_object('ok', true, 'deleted_event_id', p_event_id);
end
$function$;

create or replace function app.cached_impact_event_analysis_v2(p_team uuid, p_event_id uuid, p_window_days integer default 30,
  p_models text[] default null, p_markets text[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_user      uuid := auth.uid();
  v_key       text;
  v_result    jsonb;
  v_ttl       interval;
  v_params    jsonb;
  v_recompute text;
  v_stamp     text;
begin
  perform app._impact_event_require_v2(p_team, 'impact_event_analysis', 30);
  if p_window_days is not null and p_window_days not between 1 and 183 then
    raise exception 'impact_event_invalid_param' using errcode = '22023', hint = 'p_window_days: 1-183';
  end if;
  if not exists (select 1 from app.impact_event e where e.id = p_event_id and e.team_id = p_team) then
    raise exception 'impact_event_not_found' using errcode = 'PT404';
  end if;

  select md5(coalesce(string_agg(u.url_norm, '|' order by u.url_norm), '-'))
    into v_stamp
  from app.impact_event_url u
  where u.event_id = p_event_id;

  v_key := md5(
    'impact_event_analysis_v2' || '|' || p_team::text || '|' || p_event_id::text || '|' ||
    coalesce(p_window_days, 30)::text || '|' ||
    coalesce(array_to_string(p_models, ','), '-') || '|' ||
    coalesce(array_to_string(p_markets, ','), '-') || '|' || v_stamp);

  select c.result into v_result from app.rpc_cache c where c.cache_key = v_key and c.expires_at > now();
  if v_result is not null then
    update app.rpc_cache c set last_hit_at = now(), hit_count = c.hit_count + 1
     where c.cache_key = v_key and (c.last_hit_at is null or c.last_hit_at < now() - interval '5 minutes');
    return v_result;
  end if;

  v_result := app._impact_event_analysis_v2(p_team, p_event_id, p_window_days, p_models, p_markets);

  v_ttl := app.cache_ttl_for_team(p_team);
  v_params := jsonb_build_object('p_team', p_team, 'p_event_id', p_event_id, 'p_window_days', p_window_days,
                                 'p_models', p_models, 'p_markets', p_markets);
  v_recompute := $r$
    select app._impact_event_analysis_v2(
      ($1->>'p_team')::uuid, ($1->>'p_event_id')::uuid, ($1->>'p_window_days')::integer,
      app.jsonb_to_text_array($1->'p_models'), app.jsonb_to_text_array($1->'p_markets'))
  $r$;

  insert into app.rpc_cache
    (cache_key, team_id, fn_name, result, expires_at, params, recompute_sql, user_id, warm, last_hit_at, hit_count)
  values
    (v_key, p_team, 'impact_event_analysis_v2', v_result, now() + v_ttl,
     v_params, v_recompute, v_user, (v_ttl >= interval '60 minutes'), now(), 1)
  on conflict (cache_key) do update
    set result = excluded.result, expires_at = excluded.expires_at, created_at = now(),
        params = excluded.params, recompute_sql = excluded.recompute_sql, user_id = excluded.user_id,
        warm = excluded.warm, last_hit_at = now(), hit_count = app.rpc_cache.hit_count + 1;

  return v_result;
end
$function$;

-- -----------------------------------------------------------------------------
-- 2a  Suche: bisheriger Kern ohne das mit get_you_urls geteilte Limit (intern, für gefilterte/gerankte Suche)
-- -----------------------------------------------------------------------------
create or replace function app._quick_search_raw_v1(p_team uuid, p_search text DEFAULT NULL::text, p_search_folded text DEFAULT NULL::text, p_search_de text DEFAULT NULL::text, p_scope text DEFAULT ''::text, p_rank text DEFAULT ''::text, p_citation_type text DEFAULT ''::text, p_market text DEFAULT ''::text, p_mentioning text DEFAULT ''::text, p_limit integer DEFAULT 5, p_url_type text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
-- 13.10.2026 (vor_nextjs_v1.sql): wie search_quick_actions_v2_raw, ohne das mit get_you_urls geteilte Limit; intern
declare
  v_user       uuid := auth.uid();
  v_scope      text := lower(coalesce(p_scope, ''));
  v_rank       text := lower(coalesce(p_rank, ''));
  v_type       text := coalesce(p_citation_type, '');
  v_urltype    text := btrim(coalesce(p_url_type, ''));
  v_market     text := upper(coalesce(p_market, ''));
  v_mentioning uuid := nullif(btrim(coalesce(p_mentioning, '')), '')::uuid;
  v_limit      integer := greatest(1, least(coalesce(p_limit, 5), 25));
  v_terms      text[];
  v_has_query  boolean;
  v_windowed   boolean;
  v_from       date := current_date - 6;
  v_to         date := current_date;
  v_pfrom      date := current_date - 9;
  v_pto        date := current_date - 7;
  v_own        uuid;
  v_result     jsonb;
begin
  perform set_config('work_mem', '128MB', true);
  perform set_config('jit', 'off', true);

  if v_user is null then
    raise exception 'app_not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from app.team_member tm
    where tm.team_id = p_team and tm.user_id = v_user
  ) then
    raise exception 'team_forbidden' using errcode = '42501';
  end if;

  if v_scope not in ('url', 'domain', 'brand', 'prompt') then
    v_scope := '';
  end if;
  if v_rank not in ('top', 'trending') then
    v_rank := '';
  end if;
  if v_scope = '' then
    v_rank := '';
  end if;

  -- Query-Varianten normalisieren + folden, Duplikate/Kurze raus
  select coalesce(array_agg(distinct t), '{}'::text[])
  into v_terms
  from (
    select app.search_fold(x) as t
    from unnest(array[p_search, p_search_folded, p_search_de]) as x
  ) q
  where length(q.t) >= 2;

  v_has_query := cardinality(v_terms) > 0;
  v_windowed  := v_rank <> '' or v_type <> '' or v_market <> ''
                 or v_mentioning is not null or v_urltype <> '';

  if not v_has_query and v_rank = '' then
    return '[]'::jsonb;
  end if;

  select tc.company_id into v_own
  from app.team_company tc
  where tc.team_id = p_team and tc.role = 'own'
  limit 1;

  ------------------------------------------------------------------
  -- REGIME A: Typeahead (kein Filter, kein Rank) — wie bisher
  ------------------------------------------------------------------
  if not v_windowed then
    with recursive
    brand_candidates as (
      select
        c.id as company_id,
        coalesce(nullif(btrim(tbp.name_override), ''), c.name) as name,
        coalesce(tbp.logo_override_url, c.favicon_url) as logo,
        case
          when app.search_fold(coalesce(nullif(btrim(tbp.name_override), ''), c.name)) = any(v_terms) then 0
          when exists (select 1 from unnest(v_terms) t
                       where app.search_fold(coalesce(nullif(btrim(tbp.name_override), ''), c.name)) like t || '%') then 1
          when exists (select 1 from unnest(v_terms) t
                       where app.search_fold(c.url) like t || '%') then 2
          else 3
        end as sort_score
      from app.team_company tc
      join app.company c on c.id = tc.company_id
      left join app.team_brand_profile tbp
        on tbp.team_id = tc.team_id and tbp.company_id = c.id
      where tc.team_id = p_team
        and (v_scope in ('', 'brand'))
        and exists (
          select 1 from unnest(v_terms) t
          where app.search_fold(coalesce(nullif(btrim(tbp.name_override), ''), c.name)) like '%' || t || '%'
             or app.search_fold(c.name) like '%' || t || '%'
             or app.search_fold(c.url) like '%' || t || '%'
             or app.search_fold(c.slug) like '%' || t || '%'
        )
      order by sort_score asc,
        app.search_fold(coalesce(nullif(btrim(tbp.name_override), ''), c.name)) asc
      limit v_limit
    ),
    team_domains as (
      select (
        select d.domain_norm from app.daily_citation_domain_rollup d
        where d.team_id = p_team order by d.domain_norm limit 1
      ) as domain_norm
      where v_scope in ('', 'domain')
      union all
      select (
        select d.domain_norm from app.daily_citation_domain_rollup d
        where d.team_id = p_team and d.domain_norm > td.domain_norm
        order by d.domain_norm limit 1
      )
      from team_domains td
      where td.domain_norm is not null and v_scope in ('', 'domain')
    ),
    domain_candidates as (
      select td.domain_norm as domain,
        case
          when app.search_fold(td.domain_norm) = any(v_terms) then 0
          when exists (select 1 from unnest(v_terms) t
                       where app.search_fold(td.domain_norm) like t || '%') then 1
          else 2
        end as sort_score
      from team_domains td
      where td.domain_norm is not null
        and exists (select 1 from unnest(v_terms) t
                    where app.search_fold(td.domain_norm) like '%' || t || '%')
      order by sort_score asc, lower(td.domain_norm) asc
      limit v_limit
    ),
    team_urls as (
      select (
        select u.url from app.daily_citation_url_rollup u
        where u.team_id = p_team order by u.url limit 1
      ) as url
      where v_scope in ('', 'url')
      union all
      select (
        select u.url from app.daily_citation_url_rollup u
        where u.team_id = p_team and u.url > tu.url
        order by u.url limit 1
      )
      from team_urls tu
      where tu.url is not null and v_scope in ('', 'url')
    ),
    url_candidates as (
      select tu.url,
        case
          when app.search_fold(tu.url) = any(v_terms) then 0
          when exists (select 1 from unnest(v_terms) t
                       where app.search_fold(tu.url) like t || '%') then 1
          else 3
        end as sort_score
      from team_urls tu
      where tu.url is not null
        and exists (select 1 from unnest(v_terms) t
                    where app.search_fold(tu.url) like '%' || t || '%')
      order by sort_score asc, lower(tu.url) asc
      limit v_limit
    ),
    prompt_candidates as (
      select p.id as prompt_id, p.prompt_text, p.market,
        case
          when app.search_fold(p.prompt_text) = any(v_terms) then 0
          when exists (select 1 from unnest(v_terms) t
                       where app.search_fold(p.prompt_text) like t || '%') then 1
          else 2
        end as sort_score
      from app.prompt p
      where p.team_id = p_team
        and p.is_active is true
        and (v_scope in ('', 'prompt'))
        and exists (select 1 from unnest(v_terms) t
                    where app.search_fold(p.prompt_text) like '%' || t || '%')
      order by sort_score asc, lower(p.prompt_text) asc
      limit v_limit
    ),
    combined as (
      select 10 as group_order, bc.sort_score, bc.name as sort_label,
        jsonb_build_object('type', 'brand', 'id', bc.company_id::text,
                           'name', bc.name, 'logo', coalesce(bc.logo, '')) as item
      from brand_candidates bc
      union all
      select 20, dc.sort_score, dc.domain,
        jsonb_build_object('type', 'domain', 'domain', dc.domain, 'favicon',
          coalesce((select max(sd.favicon) from app.source_domain sd
                    where regexp_replace(lower(sd.domain), '^www\.', '') = dc.domain), ''))
      from domain_candidates dc
      union all
      select 30, uc.sort_score,
        coalesce(nullif(btrim(su.title), ''), uc.url),
        jsonb_build_object('type', 'url', 'url', uc.url,
                           'title', coalesce(su.title, ''), 'favicon', coalesce(su.favicon, ''))
      from url_candidates uc
      left join app.source_url su on su.url = uc.url
      union all
      select 40, pc.sort_score, pc.prompt_text,
        jsonb_build_object('type', 'prompt', 'id', pc.prompt_id::text,
                           'prompt_text', pc.prompt_text, 'market', coalesce(pc.market, ''))
      from prompt_candidates pc
    )
    select coalesce(
      jsonb_agg(c.item order by c.group_order asc, c.sort_score asc, lower(c.sort_label) asc),
      '[]'::jsonb)
    into v_result
    from combined c;

    return v_result;
  end if;

  ------------------------------------------------------------------
  -- REGIME B: Ranked / gefiltert — 30-Tage-Fenster aus den Rollups
  ------------------------------------------------------------------

  if v_scope in ('url', 'domain') then
    with
    -- Filter-Sets EINMAL materialisieren -> gehashte IN-Subplans statt
    -- korrelierter Per-Row-EXISTS (Timeout-Ursache bei grossen Accounts)
    mkt as materialized (
      select p.id from app.prompt p
      where v_market <> '' and p.team_id = p_team
        and upper(p.market::text) = v_market
    ),
    men_urls as materialized (
      select ucm.url
      from app.url_company_mention ucm
      where v_mentioning is not null and v_scope = 'url'
        and ucm.team_id = p_team and ucm.company_id = v_mentioning
    ),
    men_domains as materialized (
      select distinct regexp_replace(lower(su.domain), '^www\.', '') as domain
      from app.url_company_mention ucm
      join app.source_url su on su.url = ucm.url
      where v_mentioning is not null and v_scope = 'domain'
        and ucm.team_id = p_team and ucm.company_id = v_mentioning
    ),
    -- /type: Effective Type auf DOMAIN-Ebene aufloesen (wenige Domains)
    -- und die Rollup-Zeilen VOR der Aggregation filtern — sonst muss bei
    -- scope=url erst das komplette URL-Universum aggregiert werden
    dom_universe as (
      select distinct d.domain_norm as domain
      from app.daily_citation_domain_rollup d
      where v_type <> '' and d.team_id = p_team
        and d.day between v_pfrom and v_to
    ),
    domtype as (
      select d.domain,
        coalesce(
          case t.role when 'own' then 'You' when 'competitor' then 'Competition' end,
          case ti.role when 'own' then 'You' when 'competitor' then 'Competition' end,
          (select min(sd.citation_type)::text from app.source_domain sd
           where regexp_replace(lower(sd.domain), '^www\.', '') = d.domain),
          'Misc'
        ) as effective_type
      from dom_universe d
      left join lateral (
        select tdo.role from app.team_domain_override tdo
        where tdo.team_id = p_team
          and regexp_replace(lower(tdo.domain), '^www\.', '') = d.domain
        limit 1
      ) t on true
      left join lateral (
        select tc.role
        from app.team_company tc
        join app.company c on c.id = tc.company_id
        where tc.team_id = p_team
          and regexp_replace(
                lower(nullif(regexp_replace(coalesce(c.url, ''), '^[a-z]+://([^/]+).*', '\1'), '')),
                '^www\.', ''
              ) = d.domain
        order by case tc.role when 'own' then 0 else 1 end
        limit 1
      ) ti on true
    ),
    typed_domains as materialized (
      select dt.domain from domtype dt where dt.effective_type = v_type
    ),
    any_now as (
      select coalesce(sum(r.runs_with_any_citation), 0)::int as cnt
      from app.daily_citation_run_rollup r
      where r.team_id = p_team and r.day between v_from and v_to
        and (v_market = '' or r.prompt_id in (select id from mkt))
    ),
    any_prev as (
      select coalesce(sum(r.runs_with_any_citation), 0)::int as cnt
      from app.daily_citation_run_rollup r
      where r.team_id = p_team and r.day between v_pfrom and v_pto
        and (v_market = '' or r.prompt_id in (select id from mkt))
    ),
    uni_now as (
      select
        case when v_scope = 'url' then u.url else u.domain_norm end as key,
        u.domain_norm as domain,
        sum(case when v_scope = 'url' then u.runs_with_url else u.runs_with_domain end)::int as runs_now
      from (
        select url, domain_norm, runs_with_url, null::int as runs_with_domain, prompt_id, day
        from app.daily_citation_url_rollup
        where v_scope = 'url' and team_id = p_team and day between v_from and v_to
        union all
        select null, domain_norm, null, runs_with_domain, prompt_id, day
        from app.daily_citation_domain_rollup
        where v_scope = 'domain' and team_id = p_team and day between v_from and v_to
      ) u
      where (v_market = '' or u.prompt_id in (select id from mkt))
        and (v_type = '' or u.domain_norm in (select domain from typed_domains))
      group by 1, 2
    ),
    -- Query-Terme + mentioning ZUERST (reduziert die Kandidaten)
    cand as materialized (
      select n.*
      from uni_now n
      where (not v_has_query or exists (
              select 1 from unnest(v_terms) t
              where app.search_fold(n.key) like '%' || t || '%'))
        and (v_mentioning is null
             or (v_scope = 'url'    and n.key in (select url    from men_urls))
             or (v_scope = 'domain' and n.key in (select domain from men_domains)))
        and (v_urltype = '' or v_scope <> 'url' or exists (
              select 1 from app.source_url su
              where su.url = n.key and su.url_type::text = v_urltype))
    ),
    -- Prev-Fenster nur fuer die verbliebenen Keys aggregieren
    uni_prev as (
      select
        case when v_scope = 'url' then u.url else u.domain_norm end as key,
        sum(case when v_scope = 'url' then u.runs_with_url else u.runs_with_domain end)::int as runs_prev
      from (
        select url, domain_norm, runs_with_url, null::int as runs_with_domain, prompt_id, day
        from app.daily_citation_url_rollup
        where v_scope = 'url' and team_id = p_team and day between v_pfrom and v_pto
        union all
        select null, domain_norm, null, runs_with_domain, prompt_id, day
        from app.daily_citation_domain_rollup
        where v_scope = 'domain' and team_id = p_team and day between v_pfrom and v_pto
      ) u
      where (v_market = '' or u.prompt_id in (select id from mkt))
        and (case when v_scope = 'url' then u.url else u.domain_norm end)
            in (select key from cand)
      group by 1
    ),
    filtered as (
      select n.key, n.domain, n.runs_now, coalesce(pv.runs_prev, 0) as runs_prev,
        case when (select cnt from any_now) > 0
             then round(n.runs_now::numeric * 100.0 / (select cnt from any_now), 2) else 0 end as share_pct,
        case when (select cnt from any_prev) > 0
             then case when (select cnt from any_now) > 0
                       then round(n.runs_now::numeric * 100.0 / (select cnt from any_now), 2) else 0 end
                  - round(coalesce(pv.runs_prev, 0)::numeric * 100.0 / (select cnt from any_prev), 2)
             else null end as trend_pct
      from cand n
      left join uni_prev pv on pv.key = n.key
    ),
    top_n as (
      select * from filtered
      order by
        case when v_rank = 'top' then share_pct end desc nulls last,
        case when v_rank = 'trending' then trend_pct end desc nulls last,
        share_pct desc, key asc
      limit v_limit
    )
    select coalesce(jsonb_agg(
      case when v_scope = 'url' then
        jsonb_build_object('type', 'url', 'url', n.key,
          'title', coalesce(su.title, ''), 'favicon', coalesce(su.favicon, ''),
          'share_pct', n.share_pct, 'trend_pct', round(n.trend_pct, 2))
      else
        jsonb_build_object('type', 'domain', 'domain', n.key,
          'favicon', coalesce((select max(sd.favicon) from app.source_domain sd
            where regexp_replace(lower(sd.domain), '^www\.', '') = n.key), ''),
          'share_pct', n.share_pct, 'trend_pct', round(n.trend_pct, 2))
      end
      order by
        case when v_rank = 'top' then n.share_pct end desc nulls last,
        case when v_rank = 'trending' then n.trend_pct end desc nulls last,
        n.share_pct desc, n.key asc
    ), '[]'::jsonb)
    into v_result
    from top_n n
    left join app.source_url su on v_scope = 'url' and su.url = n.key;

    return v_result;
  end if;

  if v_scope = 'brand' then
    with
    mkt as materialized (
      select p.id from app.prompt p
      where v_market <> '' and p.team_id = p_team
        and upper(p.market::text) = v_market
    ),
    brands as (
      select tc.company_id,
        coalesce(nullif(btrim(tbp.name_override), ''), c.name) as name,
        coalesce(tbp.logo_override_url, c.favicon_url) as logo
      from app.team_company tc
      join app.company c on c.id = tc.company_id
      left join app.team_brand_profile tbp
        on tbp.team_id = p_team and tbp.company_id = tc.company_id
      where tc.team_id = p_team
    ),
    men_now as (
      select s.company_id, sum(s.mention_runs)::int as m
      from app.daily_company_prompt_model_stats s
      where s.team_id = p_team and s.day between v_from and v_to
        and (v_market = '' or s.prompt_id in (select id from mkt))
      group by s.company_id
    ),
    men_prev as (
      select s.company_id, sum(s.mention_runs)::int as m
      from app.daily_company_prompt_model_stats s
      where s.team_id = p_team and s.day between v_pfrom and v_pto
        and (v_market = '' or s.prompt_id in (select id from mkt))
      group by s.company_id
    ),
    tot_now as (
      select coalesce(sum(r.runs_total), 0)::int as cnt
      from app.daily_runs_by_prompt_model r
      where r.team_id = p_team and r.day between v_from and v_to
        and (v_market = '' or r.prompt_id in (select id from mkt))
    ),
    tot_prev as (
      select coalesce(sum(r.runs_total), 0)::int as cnt
      from app.daily_runs_by_prompt_model r
      where r.team_id = p_team and r.day between v_pfrom and v_pto
        and (v_market = '' or r.prompt_id in (select id from mkt))
    ),
    scored as (
      select b.company_id, b.name, b.logo,
        case when (select cnt from tot_now) > 0
             then round(coalesce(mn.m, 0)::numeric * 100.0 / (select cnt from tot_now), 2) else 0 end as share_pct,
        case when (select cnt from tot_prev) > 0
             then case when (select cnt from tot_now) > 0
                       then round(coalesce(mn.m, 0)::numeric * 100.0 / (select cnt from tot_now), 2) else 0 end
                  - round(coalesce(mp.m, 0)::numeric * 100.0 / (select cnt from tot_prev), 2)
             else null end as trend_pct
      from brands b
      left join men_now mn on mn.company_id = b.company_id
      left join men_prev mp on mp.company_id = b.company_id
      where (not v_has_query or exists (
        select 1 from unnest(v_terms) t
        where app.search_fold(b.name) like '%' || t || '%'))
    )
    select coalesce(jsonb_agg(
      jsonb_build_object('type', 'brand', 'id', s.company_id::text,
        'name', s.name, 'logo', coalesce(s.logo, ''),
        'share_pct', s.share_pct, 'trend_pct', round(s.trend_pct, 2))
      order by
        case when v_rank = 'top' then s.share_pct end desc nulls last,
        case when v_rank = 'trending' then s.trend_pct end desc nulls last,
        s.share_pct desc, s.name asc
    ), '[]'::jsonb)
    into v_result
    from (select * from scored
          order by
            case when v_rank = 'top' then share_pct end desc nulls last,
            case when v_rank = 'trending' then trend_pct end desc nulls last,
            share_pct desc, name asc
          limit v_limit) s;

    return v_result;
  end if;

  -- v_scope = 'prompt'
  with
  vis_now as (
    select s.prompt_id, sum(s.mention_runs)::int as m
    from app.daily_company_prompt_model_stats s
    where s.team_id = p_team and s.company_id = coalesce(v_mentioning, v_own)
      and s.day between v_from and v_to
    group by s.prompt_id
  ),
  vis_prev as (
    select s.prompt_id, sum(s.mention_runs)::int as m
    from app.daily_company_prompt_model_stats s
    where s.team_id = p_team and s.company_id = coalesce(v_mentioning, v_own)
      and s.day between v_pfrom and v_pto
    group by s.prompt_id
  ),
  runs_now as (
    select r.prompt_id, sum(r.runs_total)::int as cnt
    from app.daily_runs_by_prompt_model r
    where r.team_id = p_team and r.day between v_from and v_to
    group by r.prompt_id
  ),
  runs_prev as (
    select r.prompt_id, sum(r.runs_total)::int as cnt
    from app.daily_runs_by_prompt_model r
    where r.team_id = p_team and r.day between v_pfrom and v_pto
    group by r.prompt_id
  ),
  scored as (
    select p.id, p.prompt_text, p.market,
      case when coalesce(rn.cnt, 0) > 0
           then round(coalesce(vn.m, 0)::numeric * 100.0 / rn.cnt, 2) else 0 end as share_pct,
      case when coalesce(rp2.cnt, 0) > 0
           then case when coalesce(rn.cnt, 0) > 0
                     then round(coalesce(vn.m, 0)::numeric * 100.0 / rn.cnt, 2) else 0 end
                - round(coalesce(vp.m, 0)::numeric * 100.0 / rp2.cnt, 2)
           else null end as trend_pct
    from app.prompt p
    left join vis_now vn on vn.prompt_id = p.id
    left join vis_prev vp on vp.prompt_id = p.id
    left join runs_now rn on rn.prompt_id = p.id
    left join runs_prev rp2 on rp2.prompt_id = p.id
    where p.team_id = p_team
      and p.is_active is true
      and (v_market = '' or upper(p.market::text) = v_market)
      and (v_mentioning is null or exists (
        select 1 from app.daily_company_prompt_model_stats s
        where s.team_id = p_team and s.prompt_id = p.id
          and s.company_id = v_mentioning
          and s.day between v_from and v_to
          and s.mention_runs > 0))
      and (not v_has_query or exists (
        select 1 from unnest(v_terms) t
        where app.search_fold(p.prompt_text) like '%' || t || '%'))
  )
  select coalesce(jsonb_agg(
    jsonb_build_object('type', 'prompt', 'id', s.id::text,
      'prompt_text', s.prompt_text, 'market', coalesce(s.market, ''),
      'share_pct', s.share_pct, 'trend_pct', round(s.trend_pct, 2))
    order by
      case when v_rank = 'top' then s.share_pct end desc nulls last,
      case when v_rank = 'trending' then s.trend_pct end desc nulls last,
      s.share_pct desc, lower(s.prompt_text) asc
  ), '[]'::jsonb)
  into v_result
  from (select * from scored
        order by
          case when v_rank = 'top' then share_pct end desc nulls last,
          case when v_rank = 'trending' then trend_pct end desc nulls last,
          share_pct desc, lower(prompt_text) asc
        limit v_limit) s;

  return v_result;
end;
$function$;


-- -----------------------------------------------------------------------------
-- 2  Quick-Actions-Suche direkt
--    Beim Tippen (ohne Filter/Rang) las die alte Suche alle URLs und Domains des Teams aus den
--    Tages-Rollups und faltete jede einzeln: 877c hat 65.837 URLs, das kostete 3-8 s je Tastendruck.
--    Neu: gefaltete URLs/Domains je Team in app.quick_search_index (bei jeder Suche höchstens alle
--    10 Minuten um neue Tage ergänzt). Gefilterte/gerankte Suchen laufen wie bisher.
-- -----------------------------------------------------------------------------
create table if not exists app.quick_search_index (
  team_id uuid not null references app.team(id) on delete cascade,
  kind    text not null check (kind in ('url', 'domain')),
  value   text not null,
  folded  text not null
);
create unique index if not exists quick_search_index_key on app.quick_search_index (team_id, kind, md5(value));
alter table app.quick_search_index enable row level security;
revoke all on app.quick_search_index from public, anon, authenticated;

create table if not exists app.quick_search_index_state (
  team_id      uuid primary key references app.team(id) on delete cascade,
  max_day      date,
  rows_total   integer not null default 0,
  refreshed_at timestamptz not null default now(),
  built_at     timestamptz not null default now()
);
alter table app.quick_search_index_state enable row level security;
revoke all on app.quick_search_index_state from public, anon, authenticated;

-- Index eines Teams aufbauen (p_full) oder um neue Tage ergänzen. false = gerade baut ein anderer Aufruf.
create or replace function app._quick_search_index_v1(p_team uuid, p_full boolean default false)
returns boolean
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_from date;
  v_max  date;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('quick_search_index|' || p_team::text, 0)) then
    return false;
  end if;
  select case when p_full then null else s.max_day end into v_from
  from app.quick_search_index_state s where s.team_id = p_team;
  if p_full or v_from is null then
    delete from app.quick_search_index i where i.team_id = p_team;
  end if;
  insert into app.quick_search_index (team_id, kind, value, folded)
  select p_team, 'url', x.url, app.search_fold(x.url)
  from (select distinct u.url from app.daily_citation_url_rollup u
        where u.team_id = p_team and (v_from is null or u.day >= v_from)) x
  on conflict (team_id, kind, md5(value)) do nothing;
  insert into app.quick_search_index (team_id, kind, value, folded)
  select p_team, 'domain', x.domain_norm, app.search_fold(x.domain_norm)
  from (select distinct d.domain_norm from app.daily_citation_domain_rollup d
        where d.team_id = p_team and (v_from is null or d.day >= v_from)) x
  where x.domain_norm is not null
  on conflict (team_id, kind, md5(value)) do nothing;
  select max(u.day) into v_max from app.daily_citation_url_rollup u where u.team_id = p_team;
  insert into app.quick_search_index_state as s (team_id, max_day, rows_total, refreshed_at, built_at)
  values (p_team, v_max, (select count(*) from app.quick_search_index i where i.team_id = p_team), now(), now())
  on conflict (team_id) do update
    set max_day = excluded.max_day, rows_total = excluded.rows_total, refreshed_at = now(),
        built_at = case when p_full or v_from is null then now() else s.built_at end;
  return true;
end
$function$;

-- Treffer beim Tippen: gleiche Auswahl, Sortierung und Form wie search_quick_actions_v2 (Regime A)
create or replace function app._quick_search_typeahead_v1(p_team uuid, p_terms text[], p_scope text, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
  with
  brand_candidates as (
    select c.id as company_id,
           coalesce(nullif(btrim(tbp.name_override), ''), c.name) as name,
           coalesce(tbp.logo_override_url, c.favicon_url) as logo,
           case
             when app.search_fold(coalesce(nullif(btrim(tbp.name_override), ''), c.name)) = any(p_terms) then 0
             when exists (select 1 from unnest(p_terms) t
                          where app.search_fold(coalesce(nullif(btrim(tbp.name_override), ''), c.name)) like t || '%') then 1
             when exists (select 1 from unnest(p_terms) t where app.search_fold(c.url) like t || '%') then 2
             else 3
           end as sort_score
    from app.team_company tc
    join app.company c on c.id = tc.company_id
    left join app.team_brand_profile tbp on tbp.team_id = tc.team_id and tbp.company_id = c.id
    where tc.team_id = p_team
      and p_scope in ('', 'brand')
      and exists (select 1 from unnest(p_terms) t
                  where app.search_fold(coalesce(nullif(btrim(tbp.name_override), ''), c.name)) like '%' || t || '%'
                     or app.search_fold(c.name) like '%' || t || '%'
                     or app.search_fold(c.url) like '%' || t || '%'
                     or app.search_fold(c.slug) like '%' || t || '%')
    order by sort_score asc, app.search_fold(coalesce(nullif(btrim(tbp.name_override), ''), c.name)) asc
    limit p_limit
  ),
  domain_candidates as (
    select i.value as domain,
           case when i.folded = any(p_terms) then 0
                when exists (select 1 from unnest(p_terms) t where i.folded like t || '%') then 1
                else 2 end as sort_score
    from app.quick_search_index i
    where i.team_id = p_team and i.kind = 'domain' and p_scope in ('', 'domain')
      and exists (select 1 from unnest(p_terms) t where i.folded like '%' || t || '%')
    order by sort_score asc, lower(i.value) asc
    limit p_limit
  ),
  url_candidates as (
    select i.value as url,
           case when i.folded = any(p_terms) then 0
                when exists (select 1 from unnest(p_terms) t where i.folded like t || '%') then 1
                else 3 end as sort_score
    from app.quick_search_index i
    where i.team_id = p_team and i.kind = 'url' and p_scope in ('', 'url')
      and exists (select 1 from unnest(p_terms) t where i.folded like '%' || t || '%')
    order by sort_score asc, lower(i.value) asc
    limit p_limit
  ),
  prompt_candidates as (
    select p.id as prompt_id, p.prompt_text, p.market,
           case when app.search_fold(p.prompt_text) = any(p_terms) then 0
                when exists (select 1 from unnest(p_terms) t where app.search_fold(p.prompt_text) like t || '%') then 1
                else 2 end as sort_score
    from app.prompt p
    where p.team_id = p_team and p.is_active is true and p_scope in ('', 'prompt')
      and exists (select 1 from unnest(p_terms) t where app.search_fold(p.prompt_text) like '%' || t || '%')
    order by sort_score asc, lower(p.prompt_text) asc
    limit p_limit
  ),
  combined as (
    select 10 as group_order, bc.sort_score, bc.name as sort_label,
           jsonb_build_object('type', 'brand', 'id', bc.company_id::text, 'name', bc.name, 'logo', coalesce(bc.logo, '')) as item
    from brand_candidates bc
    union all
    select 20, dc.sort_score, dc.domain,
           jsonb_build_object('type', 'domain', 'domain', dc.domain, 'favicon',
             coalesce((select max(sd.favicon) from app.source_domain sd
                       where regexp_replace(lower(sd.domain), '^www\.', '') = dc.domain), ''))
    from domain_candidates dc
    union all
    select 30, uc.sort_score, coalesce(nullif(btrim(su.title), ''), uc.url),
           jsonb_build_object('type', 'url', 'url', uc.url, 'title', coalesce(su.title, ''), 'favicon', coalesce(su.favicon, ''))
    from url_candidates uc
    left join app.source_url su on su.url = uc.url
    union all
    select 40, pc.sort_score, pc.prompt_text,
           jsonb_build_object('type', 'prompt', 'id', pc.prompt_id::text, 'prompt_text', pc.prompt_text, 'market', coalesce(pc.market, ''))
    from prompt_candidates pc
  )
  select coalesce(jsonb_agg(c.item order by c.group_order asc, c.sort_score asc, lower(c.sort_label) asc), '[]'::jsonb)
  from combined c
$function$;

create or replace function app.quick_search_v1(p_team uuid, p_query text default null, p_scope text default null,
  p_rank text default null, p_citation_type text default null, p_url_type text default null,
  p_market text default null, p_mentioning uuid default null, p_limit integer default 5)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_uid   uuid := app._app_uid_v1();
  v_q     text := left(btrim(coalesce(p_query, '')), 200);
  v_low   text;
  v_from  text;
  v_to    text;
  v_terms text[];
  v_state app.quick_search_index_state;
  v_ready boolean;
begin
  if p_team is null then
    raise exception 'search_invalid_param' using errcode = '22023', hint = 'p_team';
  end if;
  perform app._pi_rate_limit_v1('quick_search', 300, 'search');
  perform app._app_gate_v1(p_team);
  if not exists (select 1 from app.team_member tm where tm.team_id = p_team and tm.user_id = v_uid) then
    raise exception 'team_forbidden' using errcode = '42501';
  end if;
  if coalesce(p_scope, '') not in ('', 'url', 'domain', 'brand', 'prompt') then
    raise exception 'search_invalid_param' using errcode = '22023', hint = 'p_scope: url, domain, brand, prompt';
  end if;
  if coalesce(p_rank, '') not in ('', 'top', 'trending') then
    raise exception 'search_invalid_param' using errcode = '22023', hint = 'p_rank: top, trending';
  end if;
  if p_limit is not null and p_limit not between 1 and 25 then
    raise exception 'search_invalid_param' using errcode = '22023', hint = 'p_limit: 1-25';
  end if;
  if coalesce(p_market, '') <> '' and p_market !~ '^[A-Za-z]{2}$' then
    raise exception 'search_invalid_param' using errcode = '22023', hint = 'p_market';
  end if;
  if length(coalesce(p_citation_type, '')) > 60 or length(coalesce(p_url_type, '')) > 60 then
    raise exception 'search_invalid_param' using errcode = '22023', hint = 'p_citation_type, p_url_type: max 60';
  end if;
  v_low  := lower(v_q);
  v_from := replace(replace(replace(v_low, 'ae', 'ä'), 'oe', 'ö'), 'ue', 'ü');                       -- mueller -> müller
  v_to   := replace(replace(replace(replace(v_low, 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss');     -- müller -> mueller

  -- Tippen (ohne Filter und Rang): Index statt Vollscan
  if coalesce(p_rank, '') = '' and coalesce(p_citation_type, '') = '' and coalesce(p_url_type, '') = ''
     and coalesce(p_market, '') = '' and p_mentioning is null then
    select coalesce(array_agg(distinct t), '{}') into v_terms
    from (select app.search_fold(x) as t from unnest(array[v_q, nullif(v_to, v_low), nullif(v_from, v_low)]) x) q
    where length(q.t) >= 2;
    if cardinality(v_terms) = 0 then
      return '[]'::jsonb;
    end if;
    select * into v_state from app.quick_search_index_state s where s.team_id = p_team;
    v_ready := v_state.team_id is not null;
    if v_state.team_id is null or v_state.refreshed_at < now() - interval '10 minutes' then
      v_ready := app._quick_search_index_v1(p_team, false) or v_ready;
    end if;
    if v_ready then
      return app._quick_search_typeahead_v1(p_team, v_terms, coalesce(p_scope, ''), coalesce(p_limit, 5));
    end if;
  end if;

  return app._quick_search_raw_v1(
    p_team, v_q, nullif(v_to, v_low), nullif(v_from, v_low),
    coalesce(p_scope, ''), coalesce(p_rank, ''), coalesce(p_citation_type, ''), coalesce(p_market, ''),
    coalesce(p_mentioning::text, ''), coalesce(p_limit, 5), coalesce(p_url_type, ''));
end
$function$;

-- -----------------------------------------------------------------------------
-- 3  Exporte: Marken in der Bauart der v1-Exporte, Spalten für alle fünf
-- -----------------------------------------------------------------------------
create or replace function app.export_brands_v2(p_team uuid default null, p_date_from date default null,
  p_date_to date default null, p_models text[] default null, p_markets text[] default null,
  p_tag_ids uuid[] default null, p_tagmode text default 'or', p_search text default null,
  p_order text default 'visibility_desc', p_offset integer default 0, p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_order   text := lower(coalesce(nullif(btrim(p_order), ''), 'visibility_desc'));
  v_tagmode text := lower(coalesce(nullif(btrim(p_tagmode), ''), 'or'));
  v_to      date := least(coalesce(p_date_to, current_date), current_date);
  v_from    date := coalesce(p_date_from, least(coalesce(p_date_to, current_date), current_date) - 29);
  v_res     jsonb;
  v_total   bigint;
  v_own     uuid;
begin
  perform app._pi_rate_limit_v1('export_brands', 60, 'exports');
  perform app._app_gate_v1(p_team);
  perform app._ex_require_v1(p_team, p_offset, p_limit, 500);
  if v_order not in ('visibility_desc', 'visibility_asc', 'rank_asc', 'rank_desc', 'sentiment_desc', 'sentiment_asc',
                     'mentions_desc', 'mentions_asc', 'name_asc', 'name_desc') then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_order';
  end if;
  if v_tagmode not in ('or', 'and') then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_tagmode';
  end if;
  if v_from > v_to or v_to - v_from > 365 then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_date_from, p_date_to: max 366 days';
  end if;
  begin
    v_res := app.cached_competition_overview_v19(p_team, left(nullif(btrim(p_search), ''), 200), p_tag_ids, p_models,
                                                 v_from, v_to, p_limit, p_offset, v_order, null, null, v_tagmode, p_markets);
  exception when others then
    if sqlerrm like 'Rate limit%' then
      raise exception 'exports_rate_limited' using errcode = 'PT429', hint = '60';
    end if;
    raise;
  end;
  select tc.company_id into v_own from app.team_company tc where tc.team_id = p_team and tc.role = 'own' limit 1;
  v_total := coalesce((v_res->'companies'->0->>'total_count')::bigint, 0);
  return jsonb_build_object(
    'meta', jsonb_build_object('export', 'brands', 'team_id', p_team, 'date_from', v_from, 'date_to', v_to,
                               'order', v_order, 'offset', p_offset, 'limit', p_limit, 'total_count', v_total,
                               'has_more', p_offset + p_limit < v_total,
                               'generated_at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'position',             (e->>'position')::int,
               'company_id',           e->'company_id',
               'name',                 app.csv_safe_v1(e->>'name'),
               'is_own',               coalesce((e->>'company_id')::uuid = v_own, false),
               'visibility_pct',       e->'visibility_pct',
               'visibility_prev_pct',  e->'visibility_prev_pct',
               'visibility_delta_pct', e->'visibility_delta_pct',
               'avg_rank',             e->'avg_rank',
               'avg_rank_prev',        e->'avg_rank_prev',
               'avg_rank_delta',       e->'avg_rank_delta',
               'sentiment',            e->'sentiment',
               'sentiment_prev',       e->'sentiment_prev',
               'sentiment_delta',      e->'sentiment_delta',
               'mentions',             e->'mentions',
               'mentions_prev',        e->'mentions_prev') order by o)
      from jsonb_array_elements(coalesce(v_res->'companies', '[]'::jsonb)) with ordinality t(e, o)), '[]'::jsonb));
end
$function$;

-- Spalten je Export in CSV-Reihenfolge (Kopfzeile englisch). Jede Textspalte ("type":"text") ist in der
-- Export-Funktion mit csv_safe_v1 geschützt; die übrigen sind Zahlen, Datumswerte, Ja/Nein, IDs oder feste Kürzel.
create or replace function app.export_columns_v1(p_export text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_cols jsonb;
begin
  perform app._app_uid_v1();
  v_cols := case lower(coalesce(p_export, ''))
    when 'prompts' then '[
      {"key":"prompt_text","header":"Prompt","type":"text"},
      {"key":"market","header":"Market","type":"code"},
      {"key":"tags_text","header":"Topics","type":"text"},
      {"key":"is_active","header":"Active","type":"bool"},
      {"key":"source","header":"Source","type":"code"},
      {"key":"created_at","header":"Created","type":"datetime"},
      {"key":"runs_total","header":"Responses","type":"number"},
      {"key":"mentioned_runs","header":"Mentioned","type":"number"},
      {"key":"visibility_pct","header":"Visibility %","type":"number"},
      {"key":"avg_rank","header":"Avg. rank","type":"number"},
      {"key":"avg_sentiment","header":"Sentiment","type":"number"},
      {"key":"top_mentions_text","header":"Top brands","type":"text"},
      {"key":"last_seen_run_at","header":"Last response","type":"datetime"}]'::jsonb
    when 'responses' then '[
      {"key":"run_at","header":"Date","type":"datetime"},
      {"key":"model","header":"Model","type":"code"},
      {"key":"prompt_text","header":"Prompt","type":"text"},
      {"key":"response_text","header":"Response","type":"text"},
      {"key":"own_mentioned","header":"Your brand mentioned","type":"bool"},
      {"key":"companies","header":"Brands","type":"text"},
      {"key":"companies_count","header":"Brands count","type":"number"},
      {"key":"sources_count","header":"Sources","type":"number"},
      {"key":"prompt_id","header":"Prompt ID","type":"id"},
      {"key":"prompt_run_id","header":"Response ID","type":"id"}]'::jsonb
    when 'domains' then '[
      {"key":"domain","header":"Domain","type":"text"},
      {"key":"citation_type_label","header":"Type","type":"code"},
      {"key":"share_pct","header":"Share %","type":"number"},
      {"key":"share_delta_pct","header":"Share change","type":"number"},
      {"key":"used_total","header":"Citations","type":"number"},
      {"key":"urls_count","header":"URLs","type":"number"},
      {"key":"runs_with_domain","header":"Responses","type":"number"},
      {"key":"is_mentioned","header":"Your brand mentioned","type":"bool"},
      {"key":"first_used_at","header":"First seen","type":"datetime"},
      {"key":"last_used_at","header":"Last seen","type":"datetime"}]'::jsonb
    when 'urls' then '[
      {"key":"url","header":"URL","type":"text"},
      {"key":"title","header":"Title","type":"text"},
      {"key":"domain","header":"Domain","type":"text"},
      {"key":"url_type_label","header":"Page type","type":"code"},
      {"key":"citation_type_label","header":"Type","type":"code"},
      {"key":"global_share_pct","header":"Share %","type":"number"},
      {"key":"domainshare_pct","header":"Share of domain %","type":"number"},
      {"key":"share_delta_pct","header":"Share change","type":"number"},
      {"key":"runs_with_url","header":"Responses","type":"number"},
      {"key":"mentions_all","header":"Brands","type":"text"},
      {"key":"is_mentioned","header":"Your brand mentioned","type":"bool"},
      {"key":"first_used_at","header":"First seen","type":"datetime"},
      {"key":"last_used_at","header":"Last seen","type":"datetime"}]'::jsonb
    when 'brands' then '[
      {"key":"position","header":"#","type":"number"},
      {"key":"name","header":"Brand","type":"text"},
      {"key":"is_own","header":"Your brand","type":"bool"},
      {"key":"visibility_pct","header":"Visibility %","type":"number"},
      {"key":"visibility_delta_pct","header":"Visibility change","type":"number"},
      {"key":"avg_rank","header":"Avg. rank","type":"number"},
      {"key":"avg_rank_delta","header":"Rank change","type":"number"},
      {"key":"sentiment","header":"Sentiment","type":"number"},
      {"key":"sentiment_delta","header":"Sentiment change","type":"number"},
      {"key":"mentions","header":"Mentions","type":"number"}]'::jsonb
  end;
  if v_cols is null then
    raise exception 'exports_invalid_param' using errcode = '22023', hint = 'p_export: prompts, responses, domains, urls, brands';
  end if;
  return jsonb_build_object('meta', jsonb_build_object('export', lower(p_export)), 'rows', v_cols);
end
$function$;

-- -----------------------------------------------------------------------------
-- 5  Vorlieben im Nutzerkonto
--    Erlaubte Werte stehen an genau einer Stelle (_app_settings_allowed_v1).
-- -----------------------------------------------------------------------------
create or replace function app._app_settings_allowed_v1()
returns jsonb
language sql
immutable
set search_path to 'app', 'public', 'pg_temp'
as $function$
  select '{
    "theme":         ["dark", "light", "system"],
    "locale":        ["en", "de"],
    "number_format": ["1,234.56", "1.234,56", "1 234,56", "1''234.56"],
    "date_format":   ["DD.MM.YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
    "accent":        "#RRGGBB"
  }'::jsonb
$function$;

-- Einstellungen in der Form von meta.settings (intern)
create or replace function app._app_settings_row_v1(p_theme text, p_prefs jsonb)
returns jsonb
language sql
immutable
set search_path to 'app', 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'theme',         coalesce(p_theme, 'system'),
    'locale',        p_prefs ->> 'locale',
    'number_format', p_prefs ->> 'number_format',
    'date_format',   p_prefs ->> 'date_format',
    'accent',        p_prefs ->> 'accent')
$function$;

create or replace function app.user_settings_set_v1(p_key text, p_value text)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
-- 13.10.2026 (vor_nextjs_v1.sql): zusätzlich locale, number_format, date_format, accent (Spalte prefs).
-- p_value null bei diesen vier = zurück auf Standard. theme wie bisher. Antwort: row = alle Einstellungen.
declare
  v_uid     uuid := app._app_uid_v1();
  v_allowed jsonb := app._app_settings_allowed_v1();
  v_theme   text;
  v_prefs   jsonb;
begin
  perform app._pi_rate_limit_v1('app_settings', 30, 'app');
  if p_key is null or not (v_allowed ? p_key) then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_key';
  end if;

  if p_key = 'theme' then
    if p_value is null or p_value not in ('dark', 'light', 'system') then
      raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_value';
    end if;
    insert into app.user_settings (user_id, theme, updated_at)
    values (v_uid, p_value::app.theme_pref, now())
    on conflict (user_id) do update set theme = excluded.theme, updated_at = now()
    returning theme::text, prefs into v_theme, v_prefs;
  else
    if p_value is not null and not (
         (p_key = 'accent' and p_value ~ '^#[0-9A-Fa-f]{6}$')
      or (p_key <> 'accent' and (v_allowed -> p_key) ? p_value)) then
      raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_value';
    end if;
    insert into app.user_settings (user_id, prefs, updated_at)
    values (v_uid, case when p_value is null then '{}'::jsonb
                        else jsonb_build_object(p_key, case when p_key = 'accent' then lower(p_value) else p_value end) end, now())
    on conflict (user_id) do update
      set prefs = case when p_value is null then app.user_settings.prefs - p_key
                       else app.user_settings.prefs
                            || jsonb_build_object(p_key, case when p_key = 'accent' then lower(p_value) else p_value end) end,
          updated_at = now()
    returning theme::text, prefs into v_theme, v_prefs;
  end if;

  return jsonb_build_object('meta', jsonb_build_object('key', p_key),
    'row', app._app_settings_row_v1(v_theme, v_prefs));
end
$function$;

-- Start: meta.settings mit allen Vorlieben (Felder kommen dazu, theme bleibt)
create or replace function app._app_start_build_v1(p_uid uuid, p_hint uuid, p_forced uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
-- 13.10.2026 (vor_nextjs_v1.sql): meta.settings um locale, number_format, date_format, accent ergänzt
declare
  v_teams jsonb := app._app_teams_v1(p_uid);
  v_last  uuid;
  v_theme text;
  v_prefs jsonb;
  v_active uuid;
  v_reason text := 'none';
begin
  select us.last_team_id, us.theme::text, us.prefs into v_last, v_theme, v_prefs from app.user_settings us where us.user_id = p_uid;

  if p_forced is not null and exists (select 1 from jsonb_array_elements(v_teams) e where (e ->> 'id')::uuid = p_forced) then
    v_active := p_forced; v_reason := 'last';
  end if;
  if v_active is null and p_hint is not null and exists (
       select 1 from jsonb_array_elements(v_teams) e where (e ->> 'id')::uuid = p_hint and e ->> 'access_state' <> 'deleted') then
    v_active := p_hint; v_reason := 'hint';
  end if;
  if v_active is null and v_last is not null and exists (
       select 1 from jsonb_array_elements(v_teams) e where (e ->> 'id')::uuid = v_last and e ->> 'access_state' <> 'deleted') then
    v_active := v_last; v_reason := 'last';
  end if;
  if v_active is null then
    select (e ->> 'id')::uuid into v_active from jsonb_array_elements(v_teams) with ordinality x(e, i)
    where (e ->> 'has_access')::boolean and e ->> 'access_state' <> 'deleted' order by i limit 1;
    if v_active is not null then v_reason := 'first'; end if;
  end if;
  if v_active is null then
    select (e ->> 'id')::uuid into v_active from jsonb_array_elements(v_teams) with ordinality x(e, i)
    where e ->> 'access_state' <> 'deleted' order by i limit 1;
    if v_active is not null then v_reason := 'first'; end if;
  end if;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'user', app._app_user_v1(p_uid),
      'settings', app._app_settings_row_v1(v_theme, coalesce(v_prefs, '{}'::jsonb)),
      'teams', v_teams,
      'active_team_id', v_active,
      'active_reason', v_reason,
      'data_as_of', now()),
    'row', case when v_active is null then null else app._app_team_row_v1(p_uid, v_active) end);
end
$function$;

-- -----------------------------------------------------------------------------
-- 6  Mira: Opportunity aus einer Chat-Aktion
--    Die URL kommt aus der gespeicherten Aktion, nicht vom Client. Titel/Grund darf der Client überschreiben.
--    Doppelklick: Sperre je Team+URL, der zweite Aufruf bekommt status 'exists'.
-- -----------------------------------------------------------------------------
create or replace function app.opportunity_from_mira_v1(p_team uuid, p_action_id uuid, p_lead_url text default null,
  p_title text default null, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid    uuid := app._app_uid_v1();
  v_act    app.mira_chat_message_action;
  v_url    text;
  v_title  text := nullif(btrim(coalesce(p_title, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_res    jsonb;
  v_status text;
  v_id     uuid;
begin
  perform app._opp_rate_limit_v1('opportunity_from_mira', 20);
  perform app._app_gate_v1(p_team);
  perform app._opp_require_v1(p_team);
  if p_action_id is null then
    raise exception 'opportunities_invalid_param' using errcode = '22023', hint = 'p_action_id';
  end if;
  select * into v_act from app.mira_chat_message_action a
  where a.id = p_action_id and a.team_id = p_team and a.action_type = 'create_opportunity';
  if v_act.id is null then
    raise exception 'opportunities_action_not_found' using errcode = 'PT404';
  end if;
  v_url := nullif(btrim(coalesce(v_act.payload ->> 'lead_url', '')), '');
  if v_url is null then
    raise exception 'opportunities_invalid_param' using errcode = '22023', hint = 'lead_url';
  end if;
  if p_lead_url is not null and btrim(p_lead_url) <> v_url then
    raise exception 'opportunities_invalid_param' using errcode = '22023', hint = 'p_lead_url';
  end if;
  if length(coalesce(v_title, '')) > 300 or length(coalesce(v_reason, '')) > 4000 then
    raise exception 'opportunities_invalid_param' using errcode = '22023', hint = 'p_title max 300, p_reason max 4000';
  end if;
  v_title  := coalesce(v_title,  nullif(btrim(coalesce(v_act.payload ->> 'title', '')), ''));
  v_reason := coalesce(v_reason, nullif(btrim(coalesce(v_act.payload ->> 'reason', '')), ''));

  perform pg_advisory_xact_lock(hashtextextended('opp_from_mira|' || p_team::text || '|' || v_url, 0));

  v_res := app.create_mira_source_recommendation_v3(p_team, v_uid, v_url, v_title, v_reason);
  v_res := (v_res ->> 'response')::jsonb;
  v_status := v_res ->> 'status';
  v_id := nullif(v_res #>> '{recommendation,id}', '')::uuid;

  return jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'action_id', p_action_id, 'lead_url', v_url),
    'status', case when v_status = 'Created' and v_id is not null then 'created'
                   when v_status = 'AlreadyExists' and v_id is not null then 'exists'
                   else 'no_data' end,
    'recommendation', case when v_id is not null then app._opp_cards_v1(p_team, array[v_id]) -> 0 end);
end
$function$;

-- -----------------------------------------------------------------------------
-- 7  Seitenleiste: prompt_count im Start, Teile 'teams' und 'counts' im Speicher, Events vollständig
-- -----------------------------------------------------------------------------
create or replace function app._app_team_row_v1(p_uid uuid, p_team uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
-- 13.10.2026 (vor_nextjs_v1.sql): prompt_count (aktive Prompts) ergänzt
declare
  t   app.team;
  bp  app.billing_plan;
  v_role text;
  v_own jsonb;
  ta  record;
  v_interval text;
  v_used int; v_comp int; v_models int;
  v_name text;
begin
  select tm.role::text into v_role from app.team_member tm where tm.team_id = p_team and tm.user_id = p_uid;
  if v_role is null then
    return null;
  end if;
  select * into t from app.team where id = p_team;
  select * into bp from app.billing_plan where id = t.billing_plan_id;
  select * into ta from app._team_access_v2(p_team);
  select tb.billing_interval into v_interval from app.team_billing tb where tb.team_id = p_team;
  select e into v_own from jsonb_array_elements(app._br_brands_v1(p_team)) e where e ->> 'role' = 'own' limit 1;
  select count(*)::int into v_used from app.prompt p where p.team_id = p_team and p.is_active;
  select count(*)::int into v_comp from app.team_company tc join app.company c on c.id = tc.company_id
   where tc.team_id = p_team and tc.role = 'competitor' and c.is_active;
  select count(*)::int into v_models from app.team_model_setting s where s.team_id = p_team and s.enabled;
  v_name := coalesce((select nullif(btrim(tbp.name_override), '') from app.team_brand_profile tbp
                      join app.team_company tc on tc.team_id = tbp.team_id and tc.company_id = tbp.company_id and tc.role = 'own'
                      where tbp.team_id = t.id limit 1), t.name);

  return jsonb_build_object(
    'team_id',   t.id,
    'team_name', v_name,
    'role',      v_role,
    'prompt_count', v_used,
    'own_brand', case when v_own is null then null else jsonb_build_object(
                   'company_id', v_own -> 'company_id', 'name', v_own -> 'name', 'logo_url', v_own -> 'logo_url',
                   'domain', v_own -> 'domain', 'color', v_own -> 'color') end,
    'default_market', (select jsonb_build_object('alpha2', m.alpha2, 'name', m.name, 'flag_url', m.flag_url)
                       from app.markets m where m.alpha2 = t.default_market),
    'timezone',  t.timezone,
    'access', jsonb_build_object(
      'team_id', t.id, 'team_name', v_name,
      'has_access', ta.has_access, 'access_state', ta.access_state, 'access_ended_at', ta.access_ended_at,
      'can_manage_billing', v_role in ('owner', 'admin'),
      'plan_id', bp.id, 'plan_name', bp.name, 'billing_interval', v_interval,
      'monthly_price_eur', bp.monthly_price_eur, 'yearly_price_eur', bp.yearly_price_eur),
    'quota', jsonb_build_object(
      'used', v_used, 'total', bp.prompts_per_day, 'plan', bp.name,
      'competitors_used', v_comp, 'competitors_total', bp.competitors_max_active,
      'models_used', v_models, 'models_total', bp.models_max_active));
end
$function$;

create or replace function app.team_context_v1(p_team uuid, p_parts text[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
-- 13.10.2026 (vor_nextjs_v1.sql): Teile 'teams' (Teams des Nutzers, ohne Zugangsprüfung) und 'counts';
-- events mit allen Feldern der alten list_impact_events_v1. Ohne p_parts wie bisher (ohne 'teams'), plus 'counts'.
declare
  v_uid uuid := app._app_uid_v1();
  v_parts text[] := coalesce(p_parts, array['brands', 'topics', 'markets', 'models', 'events', 'counts']);
  ta record;
  v_row jsonb := '{}'::jsonb;
  v_plan uuid;
  v_role text;
begin
  perform app._pi_rate_limit_v1('app_context', 120, 'app');
  if p_team is null then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_team';
  end if;
  if cardinality(v_parts) = 0 or cardinality(v_parts) > 10 or exists (select 1 from unnest(v_parts) x
       where x is null or x not in ('brands', 'topics', 'markets', 'models', 'events', 'counts', 'teams')) then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_parts';
  end if;
  select tm.role::text into v_role from app.team_member tm where tm.team_id = p_team and tm.user_id = v_uid;
  if v_role is null then
    raise exception 'team_forbidden' using errcode = '42501';
  end if;
  -- 'teams' allein braucht keinen Zugang (Seitenleiste nach "Your Brand" auch im Gate)
  if not (v_parts <@ array['teams']) then
    select * into ta from app._team_access_v2(p_team);
    if not coalesce(ta.has_access, false) then
      raise exception '%', 'team_access_' || coalesce(ta.access_state, 'no_plan')
        using errcode = 'PT402', hint = coalesce(ta.access_state, 'no_plan');
    end if;
  end if;

  if 'teams' = any(v_parts) then
    v_row := v_row || jsonb_build_object('teams', app._app_teams_v1(v_uid));
  end if;

  if 'counts' = any(v_parts) then
    v_row := v_row || jsonb_build_object('counts', (
      select jsonb_build_object('prompt_count', count(*) filter (where p.is_active),
                                'prompt_count_inactive', count(*) filter (where not p.is_active))
      from app.prompt p where p.team_id = p_team));
  end if;

  if 'brands' = any(v_parts) then
    v_row := v_row || jsonb_build_object('brands', app._br_brands_v1(p_team));
  end if;

  if 'topics' = any(v_parts) then
    v_row := v_row || jsonb_build_object('topics', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id, 'name', g.name, 'emoji', g.emoji, 'hex_light', g.hex_light, 'hex_dark', g.hex_dark,
               'is_active', g.is_active, 'prompt_count', coalesce(u.cnt, 0), 'created_at', g.created_at)
             order by g.created_at desc, g.id)
      from app.tag g
      left join (select pt.tag_id, count(distinct pt.prompt_id)::int cnt
                 from app.prompt_tag pt join app.prompt p on p.id = pt.prompt_id and p.team_id = p_team
                 group by pt.tag_id) u on u.tag_id = g.id
      where g.team_id = p_team), '[]'::jsonb));
  end if;

  if 'markets' = any(v_parts) then
    v_row := v_row || jsonb_build_object('markets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'alpha2', x.market, 'name', coalesce(m.name, x.market), 'flag_url', m.flag_url,
               'region', m.region, 'subregion', m.subregion,
               'prompt_count', x.cnt, 'last_used_at', x.last_used_at)
             order by x.cnt desc, x.market)
      from (select p.market, count(*)::int cnt, max(p.created_at) last_used_at
            from app.prompt p
            where p.team_id = p_team and p.is_active and nullif(btrim(p.market), '') is not null
            group by p.market) x
      left join app.markets m on m.alpha2 = x.market), '[]'::jsonb));
  end if;

  if 'models' = any(v_parts) then
    if exists (select 1 from app.team_model_setting s where s.team_id = p_team) then
      v_row := v_row || jsonb_build_object('models', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'key', mc.key, 'display_name', mc.display_name, 'logo_url', mc.logo_url, 'provider', mc.provider,
                 'is_active', mc.is_active, 'color_lightmode', mc.color_lightmode, 'color_darkmode', mc.color_darkmode)
               order by mc.sort_order, mc.display_name)
        from app.team_model_setting s join app.llm_model_catalog mc on mc.key = s.model_key
        where s.team_id = p_team and s.enabled), '[]'::jsonb));
    else
      select t.billing_plan_id into v_plan from app.team t where t.id = p_team;
      v_row := v_row || jsonb_build_object('models', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'key', mc.key, 'display_name', mc.display_name, 'logo_url', mc.logo_url, 'provider', mc.provider,
                 'is_active', mc.is_active, 'color_lightmode', mc.color_lightmode, 'color_darkmode', mc.color_darkmode)
               order by mc.sort_order, mc.display_name)
        from app.billing_plan_model bpm join app.llm_model_catalog mc on mc.key = bpm.model_key
        where bpm.billing_plan_id = v_plan and bpm.enabled and mc.is_active), '[]'::jsonb));
    end if;
  end if;

  if 'events' = any(v_parts) then
    v_row := v_row || jsonb_build_object('events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'event_date', to_char(e.event_date, 'YYYY-MM-DD'), 'name', e.name,
               'event_type', e.event_type, 'color', e.color, 'icon', e.icon,
               'description', e.description, 'cover', e.cover, 'scope_mode', e.scope_mode,
               'selected_topic_count',    case when e.scope_mode = 'topics'
                                               then (select count(*) from app.impact_event_tag t where t.event_id = e.id) end,
               'affected_prompt_count',   (select count(*) from app.impact_event_prompt c where c.event_id = e.id and c.cohort = 'affected'),
               'comparison_prompt_count', (select count(*) from app.impact_event_prompt c where c.event_id = e.id and c.cohort = 'comparison'),
               'affected_url_count',      (select count(*) from app.impact_event_url u where u.event_id = e.id),
               'created_by', e.created_by, 'created_at', e.created_at,
               'can_delete', (e.created_by = v_uid or v_role in ('owner', 'admin')))
             order by e.event_date desc, e.created_at desc)
      from app.impact_event e where e.team_id = p_team), '[]'::jsonb));
  end if;

  return jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'parts', to_jsonb(v_parts), 'data_as_of', now()),
    'row', v_row);
end
$function$;

-- -----------------------------------------------------------------------------
-- 8  Rechte
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  -- intern: niemand direkt
  foreach f in array array[
    'app._shopping_cached_v2(text,uuid,jsonb,text)', 'app._impact_event_detail_v2(uuid,uuid)',
    'app._impact_event_require_v2(uuid,text,integer)', 'app._impact_event_check_v2(text,text,text,text,text,text)',
    'app._impact_event_analysis_v2(uuid,uuid,integer,text[],text[])',
    'app._quick_search_raw_v1(uuid,text,text,text,text,text,text,text,text,integer,text)',
    'app._quick_search_index_v1(uuid,boolean)', 'app._quick_search_typeahead_v1(uuid,text[],text,integer)',
    'app._app_settings_allowed_v1()', 'app._app_settings_row_v1(text,jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  -- öffentlich: nur angemeldete Nutzer
  foreach f in array array[
    'app.cached_shopping_overview_v2(uuid,date,date,text[],text[],uuid[],text,text,text,integer,integer)',
    'app.cached_shopping_products_v2(uuid,date,date,text[],text[],uuid[],text,text,text,text,uuid,text,integer,integer)',
    'app.cached_shopping_product_detail_v2(uuid,text,date,date,text[],text[],uuid[],text,integer,integer)',
    'app.cached_shopping_merchants_v2(uuid,date,date,text[],text[],uuid[],text,text,text,integer,integer)',
    'app.get_ads_overview_v2(uuid,date,date,text[],text[],uuid[],text[],text[])',
    'app.list_ads_advertisers_v2(uuid,date,date,text[],text[],uuid[],text[],text[],text,integer,integer,text)',
    'app.get_ads_advertiser_detail_v2(uuid,text,date,date,text[],text[],uuid[],text[],text[])',
    'app.list_ads_library_v2(uuid,date,date,text[],text[],uuid[],text[],text[],text,integer,integer)',
    'app.list_ads_prompts_v2(uuid,date,date,text[],text[],uuid[],text[],text[],text,integer,integer,text)',
    'app.get_ads_filter_options_v2(uuid,date,date)',
    'app.get_impact_event_v2(uuid,uuid)', 'app.preview_impact_event_scope_v2(uuid,text,uuid[])',
    'app.create_impact_event_v2(uuid,text,date,text,uuid[],text[],text,text,text,text,text)',
    'app.update_impact_event_v2(uuid,uuid,text,text,text,text,text,text)',
    'app.add_impact_event_url_v2(uuid,uuid,text)', 'app.remove_impact_event_url_v2(uuid,uuid,uuid)',
    'app.delete_impact_event_v2(uuid,uuid)', 'app.cached_impact_event_analysis_v2(uuid,uuid,integer,text[],text[])',
    'app.quick_search_v1(uuid,text,text,text,text,text,text,uuid,integer)',
    'app.export_brands_v2(uuid,date,date,text[],text[],uuid[],text,text,text,integer,integer)',
    'app.export_columns_v1(text)',
    'app.opportunity_from_mira_v1(uuid,uuid,text,text,text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 9  Suchindex für alle Teams einmal aufbauen (danach ergänzt jede Suche ihn selbst)
-- -----------------------------------------------------------------------------
select count(*) filter (where app._quick_search_index_v1(t.id, true)) as suchindex_teams
from app.team t where not coalesce(t.is_deleted, false);

commit;

-- =============================================================================
-- Testabfrage: neue_funktionen = 32, sicherungen = 4, prefs_spalte = 1, anon_darf = 0, suchindex_zeilen > 0
-- =============================================================================
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app'
     and p.proname in ('_shopping_cached_v2', 'cached_shopping_overview_v2', 'cached_shopping_products_v2',
       'cached_shopping_product_detail_v2', 'cached_shopping_merchants_v2', 'get_ads_overview_v2', 'list_ads_advertisers_v2',
       'get_ads_advertiser_detail_v2', 'list_ads_library_v2', 'list_ads_prompts_v2', 'get_ads_filter_options_v2',
       '_impact_event_detail_v2', '_impact_event_require_v2', '_impact_event_check_v2', '_impact_event_analysis_v2',
       'get_impact_event_v2', 'preview_impact_event_scope_v2', 'create_impact_event_v2', 'update_impact_event_v2',
       'add_impact_event_url_v2', 'remove_impact_event_url_v2', 'delete_impact_event_v2', 'cached_impact_event_analysis_v2',
       '_quick_search_raw_v1', '_quick_search_index_v1', '_quick_search_typeahead_v1', 'quick_search_v1',
       'export_brands_v2', 'export_columns_v1', '_app_settings_allowed_v1', '_app_settings_row_v1',
       'opportunity_from_mira_v1')) as neue_funktionen,
  (select count(*) from app._app_start_backup where step = 'vor_nextjs') as sicherungen,
  (select count(*) from information_schema.columns where table_schema = 'app' and table_name = 'user_settings' and column_name = 'prefs') as prefs_spalte,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app'
     and p.proname in ('cached_shopping_overview_v2', 'get_ads_overview_v2', 'create_impact_event_v2', 'quick_search_v1',
                       'export_brands_v2', 'export_columns_v1', 'opportunity_from_mira_v1', '_quick_search_raw_v1')
     and has_function_privilege('anon', p.oid, 'execute')) as anon_darf,
  (select count(*) from app.quick_search_index) as suchindex_zeilen;
