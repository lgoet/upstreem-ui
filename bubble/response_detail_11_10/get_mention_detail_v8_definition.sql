CREATE OR REPLACE FUNCTION app.get_mention_detail_v8(p_prompt_run_id uuid, p_team uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
declare
  v_result jsonb;
begin
  perform app.check_rate_limit('mention_detail', 30);
  perform app.require_team_access(p_team);

  with pr as (
    select
      pr.id,
      pr.team_id,
      pr.run_at,
      pr.run_day_berlin as run_day,
      pr.model,
      pr.model_detailed,
      pr.prompt_id,
      pr.prompt_text,
      p.market::text as market,
      pr.response_json,
      pr.run_key,
      pr.citations_flat,
      pr.shopping_products_count
    from app.prompt_run pr
    join app.prompt p on p.id = pr.prompt_id
    where pr.id      = p_prompt_run_id
      and pr.team_id = p_team
    limit 1
  ),

  -- Tags (wie v7)
  tgs as (
    select jsonb_agg(
             jsonb_build_object(
               'id',        t.id,
               'name',      t.name,
               'emoji',     t.emoji,
               'hex_light', t.hex_light,
               'hex_dark',  t.hex_dark
             )
             order by t.name
           ) as tags_json
    from pr
    left join app.prompt_tag pt on pt.prompt_id = pr.prompt_id
    left join app.tag t         on t.id = pt.tag_id
  ),

  -- Companies (own + competitor) in Recommendations (wie v7)
  recos_tracked as (
    select jsonb_agg(
             jsonb_build_object(
               'company_id',     c.id,
               'name',           coalesce(tbp.name_override, c.name),
               'brand_name_raw', r.brand_name_raw,
               'favicon_url',    coalesce(tbp.logo_override_url, c.favicon_url),
               'rank',           r.rank,
               'sentiment',      r.sentiment
             )
             order by r.rank
           ) as companies_json
    from pr
    join app.recommendation r
      on r.prompt_run_id = pr.id
     and r.team_id       = p_team
    join app.team_company tc
      on tc.company_id = r.company_id
     and tc.team_id    = p_team
     and tc.role in ('own','competitor')
    join app.company c on c.id = r.company_id
    left join app.team_brand_profile tbp
      on tbp.team_id = p_team
     and tbp.company_id = c.id
  ),

  -- Citations (wie v7)
  rc_all as (
    select distinct
      su.url,
      su.domain,
      su.title,
      su.description,
      sd.favicon
    from pr
    join app.recommendation r
      on r.prompt_run_id = pr.id
     and r.team_id       = p_team
    join app.recommendation_citation rc
      on rc.recommendation_id = r.id
    join app.source_url su
      on su.url = rc.url
    join app.source_domain sd
      on sd.domain = su.domain
  ),

  stage_urls as (
    select distinct scu.url
    from pr
    join app.staged_citation_urls scu
      on scu.team_id = p_team
     and scu.run_key = pr.run_key
  ),

  cf_urls as (
    select distinct u.url
    from pr,
    lateral (
      select jsonb_array_elements_text(pr.citations_flat) as url
      where jsonb_typeof(pr.citations_flat) = 'array'
      union all
      select (elem->>'url') as url
      from jsonb_array_elements(pr.citations_flat) elem
      where jsonb_typeof(pr.citations_flat) = 'array'
        and jsonb_typeof(elem) = 'object'
        and coalesce(elem->>'url','') <> ''
    ) u
    where coalesce(u.url,'') <> ''
  ),

  stage_full as (
    select su.url, su.domain, su.title, su.description, sd.favicon
    from stage_urls x
    left join app.source_url    su on su.url    = x.url
    left join app.source_domain sd on sd.domain = su.domain
  ),

  cf_full as (
    select su.url, su.domain, su.title, su.description, sd.favicon
    from cf_urls x
    left join app.source_url    su on su.url    = x.url
    left join app.source_domain sd on sd.domain = su.domain
  ),

  picked_srcs as (
    select * from rc_all
    union
    select * from stage_full
    union
    select * from cf_full
  ),

  picked_sanitized as (
    select
      url,
      domain,
      case
        when nullif(trim(regexp_replace(coalesce(title,''), E'^\\s*\\n+', '', 'g')), '') is not null
        then
          left(trim(regexp_replace(coalesce(title,''), E'^\\s*\\n+', '', 'g')), 100)
          || case
               when length(trim(regexp_replace(coalesce(title,''), E'^\\s*\\n+', '', 'g'))) > 100
               then '…'
               else ''
             end
        else
          left(coalesce(trim(description),''), 100)
      end as title_clean,
      description,
      favicon
    from picked_srcs
  ),

  team_companies as (
    select tc.company_id, tc.role
    from app.team_company tc
    where tc.team_id = p_team
  ),

  url_mentions as (
    with uniq as (
      select distinct
        ps.url,
        ucm.company_id,
        coalesce(tbp.name_override, c.name) as name,
        coalesce(tbp.logo_override_url, c.favicon_url) as favicon_url,
        tc.role
      from picked_sanitized ps
      join app.url_company_mention ucm
        on ucm.url     = ps.url
       and ucm.team_id = p_team
      join team_companies tc
        on tc.company_id = ucm.company_id
      join app.company c
        on c.id = ucm.company_id
      left join app.team_brand_profile tbp
        on tbp.team_id = p_team
       and tbp.company_id = c.id
    )
    select
      u.url,
      jsonb_agg(
        jsonb_build_object(
          'company_id',  u.company_id,
          'name',        u.name,
          'favicon_url', u.favicon_url,
          'role',        u.role,
          'match_type',  null,
          'count',       1
        )
        order by case when u.role = 'own' then 0 else 1 end, u.name
      ) as mentions_json
    from uniq u
    group by u.url
  ),

  srcs_json as (
    select jsonb_agg(
           jsonb_build_object(
             'url',         ps.url,
             'domain',      ps.domain,
             'title',
               case when nullif(btrim(coalesce(ps.title_clean,'')), '') is null then ps.domain else ps.title_clean end,
             'description',
               case when nullif(btrim(coalesce(ps.description,'')), '') is null then ps.url else ps.description end,
             'favicon',     ps.favicon,
             'mentions',    coalesce(um.mentions_json, '[]'::jsonb)
           )
         ) as citations_json
    from picked_sanitized ps
    left join url_mentions um on um.url = ps.url
  ),

  -- NEU: Shopping-Produkte dieser Antwort (Reihenfolge = ordinal)
  sp as (
    select s.*,
           min(s.shopping_group_ordinal) filter (where s.render_type = 'products' and s.product_index is not null)
             over () as first_grp
    from pr
    join app.prompt_run_shopping_product s
      on s.prompt_run_id = pr.id
     and s.team_id       = p_team
  ),
  prods_json as (
    select jsonb_agg(
             jsonb_build_object(
               'ordinal',                s.ordinal,
               'position',               case when s.render_type = 'products' and s.product_index is not null
                                              then s.product_index + 1 end,
               'is_first',               coalesce(s.render_type = 'products' and s.product_index = 0
                                                  and s.shopping_group_ordinal is not distinct from s.first_grp, false),
               'render_type',            s.render_type,
               'shopping_group_ordinal', s.shopping_group_ordinal,
               'source_product_id',      s.source_product_id,
               'title',                  s.title,
               'listing_title',          case when nullif(btrim(s.provider_title), '') is distinct from s.title
                                              then nullif(btrim(s.provider_title), '') end,
               'brand',                  jsonb_build_object(
                                           'company_id', tc.company_id,
                                           'name',       case when tc.company_id is not null then coalesce(nullif(tbp.name_override, ''), c.name) end,
                                           'logo_url',   case when tc.company_id is not null then coalesce(nullif(tbp.logo_override_url, ''), c.favicon_url) end,
                                           'color',      case when tc.company_id is not null then coalesce(nullif(tcs.color_override, ''), nullif(c.default_color, '')) end,
                                           'type',       case tc.role::text when 'own' then 'own' when 'competitor' then 'competitor' else 'other' end),
               'image_url',              coalesce(nullif(s.thumbnail, ''), s.image_urls[1]),
               'image_urls',             coalesce(to_jsonb(s.image_urls), '[]'::jsonb),
               'price',                  s.price,
               'price_str',              s.price_str,
               'currency',               s.currency,
               'rating',                 s.rating,
               'num_reviews',            s.num_reviews,
               'merchant_name',          s.merchant_name)
             order by s.ordinal
           ) as products_json
    from sp s
    left join app.team_company tc
      on tc.team_id = p_team and tc.company_id = s.company_id
    left join app.company c on c.id = tc.company_id
    left join app.team_brand_profile tbp
      on tbp.team_id = p_team and tbp.company_id = tc.company_id
    left join app.team_company_settings tcs
      on tcs.team_id = p_team and tcs.company_id = tc.company_id
  ),

  -- NEU: Anzeigen dieses Laufs (gleiches Ad-Objekt wie list_ads_library_v1 / recent_ads)
  ad_topics as (
    select coalesce(jsonb_agg(jsonb_build_object('topic_id', t.id, 'topic_name', t.name, 'emoji', t.emoji,
                                                 'hex_light', t.hex_light, 'hex_dark', t.hex_dark)
                              order by lower(t.name), t.id), '[]'::jsonb) as topics
    from pr
    join app.prompt_tag pt on pt.prompt_id = pr.prompt_id
    join app.tag t on t.id = pt.tag_id and t.team_id = p_team
  ),
  ads_json as (
    select jsonb_agg(
             jsonb_build_object(
               'id',              a.id,
               'prompt_run_id',   a.prompt_run_id,
               'advertiser_name', a.advertiser_name,
               'company_id',      a.company_id,
               'title',           a.title,
               'description',     a.description,
               'image_url',       a.image_url,
               'ad_format',       a.ad_format,
               'price',           a.price,
               'price_str',       a.price_str,
               'currency',        a.currency,
               'landing_domain',  a.landing_domain,
               'url',             a.url,
               'utm_campaign',    a.campaign_name,
               'utm_source',      a.utm_source,
               'utm_medium',      a.utm_medium,
               'utm_content',     a.utm_content,
               'utm_term',        a.utm_term,
               'utm_id',          a.utm_id,
               'ad_account_id',   a.ad_account_id,
               'campaign_id',     a.campaign_id,
               'ad_group_id',     a.ad_group_id,
               'ad_id',           a.ad_id,
               'prompt_id',       pr.prompt_id,
               'prompt_text',     p.prompt_text,
               'topics',          (select topics from ad_topics),
               'model',           pr.model,
               'market',          pr.market,
               'observed_at',     pr.run_at,
               -- wie list_ads_advertisers_v1: nur ueber team_company / company, nie aus Namen
               'relationship',    case tc.role::text when 'own' then 'you' when 'competitor' then 'competitor' end,
               'logo_url',        case when a.company_id is not null then coalesce(nullif(tbp.logo_override_url, ''), c.favicon_url) end,
               -- wie die Ads-RPCs: Host der Firmen-URL, sonst haeufigste Landing-Domain des
               -- Werbetreibenden im Team (ganze Historie, Gleichstand alphabetisch), sonst null
               'domain',          coalesce(
                                    case when a.company_id is not null then app._ads_host_v1(c.url) end,
                                    (select z.d from (
                                       select app._ads_host_v1(x.landing_domain) d, count(*) n
                                       from app.prompt_run_ad x
                                       where x.team_id = p_team and x.advertiser_name = a.advertiser_name
                                         and app._ads_host_v1(x.landing_domain) is not null
                                       group by 1) z
                                     order by z.n desc, z.d limit 1)))
             order by a.ordinal nulls last, pr.run_at, a.id
           ) as ads
    from pr
    join app.prompt p on p.id = pr.prompt_id
    join app.prompt_run_ad a on a.prompt_run_id = pr.id and a.team_id = p_team
    left join app.team_company tc on tc.team_id = p_team and tc.company_id = a.company_id
    left join app.company c on c.id = a.company_id
    left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = a.company_id
  )

  select jsonb_build_object(
    'prompt_run_id',           pr.id,
    'id',                      pr.id,
    'run_at',                  pr.run_at,
    'run_day',                 pr.run_day,
    'model',                   pr.model,
    'model_detailed',          pr.model_detailed,
    'prompt_id',               pr.prompt_id,
    'prompt_text',             pr.prompt_text,
    'market',                  pr.market,
    'tags',                    coalesce(tgs.tags_json, '[]'::jsonb),
    'response_json',           pr.response_json,
    'companies',               coalesce(recos_tracked.companies_json, '[]'::jsonb),
    'citations',               coalesce(srcs_json.citations_json, '[]'::jsonb),
    'shopping_products_count', pr.shopping_products_count,
    'shopping_products',       coalesce(prods_json.products_json, '[]'::jsonb),
    'ads',                     coalesce(ads_json.ads, '[]'::jsonb))
    into v_result
  from pr
  left join tgs           on true
  left join recos_tracked on true
  left join srcs_json     on true
  left join prods_json    on true
  left join ads_json      on true;

  if v_result is null then
    raise exception 'mention_not_found';
  end if;

  -- Umschlag: js_safe (wie v7 auf allen Feldern) + Backslashes verdoppelt
  return app.js_json_envelope(v_result);
end;
$function$
