-- alte_mention_detail_zugang.sql (11.10.2026): Altversionen der Antwort-Ansicht absichern
-- Als EIN Block ausfuehren. Rueckweg: alte_mention_detail_zugang_rueckweg.sql
-- 1. get_mention_detail_v7 (Bubble: Shopping, Events) prueft jetzt den Zugang wie v8 und hat einen festen search_path.
--    Fuer Teams mit Zugang aendert sich nichts.
-- 2. get_mention_detail und get_mention_detail_v6 (im Repo nicht mehr referenziert) sind nicht mehr fuer PUBLIC/anon
--    ausfuehrbar; authenticated bleibt, damit nichts in Bubble bricht. Sie kommen auf die Aufraeumliste.

begin;

do $g$
begin
  if md5(pg_get_functiondef('app.get_mention_detail_v7(uuid,uuid)'::regprocedure)) <> '2c95da0a3b6e1c1ab2e4c5e39be3ccfb' then
    raise exception 'alte_mention_detail_zugang: v7 weicht vom gelesenen Stand ab. Nichts geaendert.';
  end if;
end $g$;

CREATE OR REPLACE FUNCTION app.get_mention_detail_v7(p_prompt_run_id uuid, p_team uuid)
 RETURNS TABLE(prompt_run_id uuid, id uuid, run_at timestamp with time zone, run_day date, model text, model_detailed text, prompt_id uuid, prompt_text text, market text, tags jsonb, response_json jsonb, companies jsonb, citations jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
begin

  perform app.check_rate_limit('mention_detail', 30);

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

  -- 11.10.2026: wie v8 nur mit Zugang (Abo/Plan)
  perform app.require_team_access(p_team);

  return query
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
      pr.citations_flat
    from app.prompt_run pr
    join app.prompt p on p.id = pr.prompt_id
    where pr.id      = p_prompt_run_id
      and pr.team_id = p_team
    limit 1
  ),

  -- Tags (v7: + hex_light / hex_dark)
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

  -- Companies (own + competitor) in Recommendations
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

  -- Alle Citations dieses Runs (rc)
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

  -- staged URLs
  stage_urls as (
    select distinct scu.url
    from pr
    join app.staged_citation_urls scu
      on scu.team_id = p_team
     and scu.run_key = pr.run_key
  ),

  -- citations_flat URLs
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
    select
      su.url,
      su.domain,
      su.title,
      su.description,
      sd.favicon
    from stage_urls x
    left join app.source_url    su on su.url    = x.url
    left join app.source_domain sd on sd.domain = su.domain
  ),

  cf_full as (
    select
      su.url,
      su.domain,
      su.title,
      su.description,
      sd.favicon
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

  -- Title Cleaning wie bisher
  picked_sanitized as (
    select
      url,
      domain,
      case
        when nullif(
          trim(
            regexp_replace(
              coalesce(title,''),
              E'^\\s*\\n+',
              '',
              'g'
            )
          ),
          ''
        ) is not null
        then
          left(
            trim(
              regexp_replace(
                coalesce(title,''),
                E'^\\s*\\n+',
                '',
                'g'
              )
            ),
            100
          )
          || case
               when length(
                      trim(
                        regexp_replace(
                          coalesce(title,''),
                          E'^\\s*\\n+',
                          '',
                          'g'
                        )
                      )
                    ) > 100
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

  -- Team Companies (fuer Rollen 'own'/'competitor')
  team_companies as (
    select
      tc.company_id,
      tc.role
    from app.team_company tc
    where tc.team_id = p_team
  ),

  -- URL-Company-Mentions (team-scoped)
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
        order by
          case when u.role = 'own' then 0 else 1 end,
          u.name
      ) as mentions_json
    from uniq u
    group by u.url
  ),

  -- Citations JSON inkl. URL-Mentions
  srcs_json as (
    select jsonb_agg(
           jsonb_build_object(
             'url',         ps.url,
             'domain',      ps.domain,

             'title',
               case
                 when nullif(btrim(coalesce(ps.title_clean,'')), '') is null
                 then ps.domain
                 else ps.title_clean
               end,

             'description',
               case
                 when nullif(btrim(coalesce(ps.description,'')), '') is null
                 then ps.url
                 else ps.description
               end,

             'favicon',     ps.favicon,
             'mentions',    coalesce(um.mentions_json, '[]'::jsonb)
           )
         ) as citations_json
    from picked_sanitized ps
    left join url_mentions um
      on um.url = ps.url
  )

  select
    pr.id              as prompt_run_id,
    pr.id              as id,
    pr.run_at,
    pr.run_day,
    pr.model,
    pr.model_detailed,
    pr.prompt_id,
    app.js_safe_text(pr.prompt_text)                               as prompt_text,
    pr.market,
    app.js_safe(coalesce(tgs.tags_json, '[]'::jsonb))                as tags,
    app.js_safe(pr.response_json)                                    as response_json,
    app.js_safe(coalesce(recos_tracked.companies_json, '[]'::jsonb)) as companies,
    app.js_safe(coalesce(srcs_json.citations_json, '[]'::jsonb))     as citations
  from pr
  left join tgs           on true
  left join recos_tracked on true
  left join srcs_json     on true;

end;
$function$;

revoke all on function app.get_mention_detail_v6(uuid, uuid), app.get_mention_detail(uuid, uuid) from public, anon;
grant execute on function app.get_mention_detail_v6(uuid, uuid), app.get_mention_detail(uuid, uuid) to authenticated, service_role;

commit;

-- Kontrolle: v7_mit_zugang = true, anon_v6 = false, anon_alt = false
select pg_get_functiondef('app.get_mention_detail_v7(uuid,uuid)'::regprocedure) like '%require_team_access%' as v7_mit_zugang,
       has_function_privilege('anon', 'app.get_mention_detail_v6(uuid,uuid)', 'execute') as anon_v6,
       has_function_privilege('anon', 'app.get_mention_detail(uuid,uuid)', 'execute') as anon_alt;
