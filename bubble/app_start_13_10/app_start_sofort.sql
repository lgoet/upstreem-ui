-- =============================================================================
-- App-Start, Sofort-Schritt (13.10.2026)  –  als EIN Block ausführen
-- Rückweg: app_start_sofort_rueckweg.sql (stellt alles aus app._app_start_backup wieder her)
--
-- S1  get_team_brand_header(uuid) (alt): nur noch für Mitglieder des Teams
-- S2  user_settings: Spaltenrechte. authenticated liest und ändert nur noch theme; anon nichts
-- S3  search_path für alle security-definer-Funktionen in app, die keinen haben
-- S4  Funktionen nur für n8n (service_role): für anon, PUBLIC, authenticated gesperrt
-- S5  anon/PUBLIC raus aus allen Funktionen mit Team-Parameter; authenticated und
--     service_role behalten genau die Rechte, die sie vorher hatten
--
-- Vor jeder Änderung wird der alte Stand (Definition, ACL, search_path) in
-- app._app_start_backup gesichert. Nichts wird umbenannt oder entfernt.
-- =============================================================================
begin;

create table if not exists app._app_start_backup (
  id         bigserial primary key,
  step       text not null,           -- 'sofort' | 'v1' | 'zugang'
  kind       text not null,           -- 'def' | 'acl' | 'config' | 'table_acl'
  obj        text not null,           -- regprocedure-Text bzw. Tabellenname
  def        text,                    -- alte Definition (kind = def)
  acl        aclitem[],               -- alte ACL (kind = acl / table_acl)
  config     text[],                  -- alte proconfig (kind = config)
  md5        text,
  created_at timestamptz not null default now()
);
alter table app._app_start_backup enable row level security;
revoke all on app._app_start_backup from public, anon, authenticated, service_role;
revoke all on sequence app._app_start_backup_id_seq from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- S1  get_team_brand_header(uuid): nur Mitglieder (sonst leere Antwort, wie bisher für unbekannte Teams)
-- -----------------------------------------------------------------------------
insert into app._app_start_backup (step, kind, obj, def, md5)
select 'sofort', 'def', 'app.get_team_brand_header(uuid)',
       pg_get_functiondef('app.get_team_brand_header(uuid)'::regprocedure),
       md5(pg_get_functiondef('app.get_team_brand_header(uuid)'::regprocedure));

CREATE OR REPLACE FUNCTION app.get_team_brand_header(p_team uuid)
 RETURNS TABLE(team_id uuid, team_name text, company_id uuid, company_name text, favicon_url text, team_market_focus text, team_business_model text, team_brand_industry text, models jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
  -- 13.10.2026 (app_start_sofort.sql): nur für Mitglieder des Teams. Vorher ohne jede Prüfung.
  with base as (
    select
      t.id   as team_id,
      t.name as team_name,
      c.id   as company_id,
      c.name as company_name,
      coalesce(
        c.favicon_url,
        'https://www.google.com/s2/favicons?domain=' || nullif(t.domain,'') || '&sz=64'
      ) as favicon_url,
      t.market_focus::text   as team_market_focus,
      t.business_model       as team_business_model,
      t.brand_industry       as team_brand_industry,
      t.billing_plan_id
    from app.team t
    join app.team_company tc on tc.team_id = t.id and tc.role = 'own'
    join app.company c       on c.id = tc.company_id
    where t.id = p_team
      and exists (select 1 from app.team_member tm
                  where tm.team_id = t.id and tm.user_id = auth.uid())
    limit 1
  ),
  allowed_by_plan as (
    select jsonb_agg(
             jsonb_build_object(
               'key',          mc.key,
               'provider',     mc.provider,
               'display_name', mc.display_name,
               'logo_url',     mc.logo_url
             )
             order by mc.sort_order, mc.display_name
           ) as models
    from base b
    join app.billing_plan_model bpm
      on bpm.billing_plan_id = b.billing_plan_id
     and bpm.enabled = true
    join app.llm_model_catalog mc
      on mc.key = bpm.model_key
     and mc.is_active = true
  ),
  all_active as (
    select jsonb_agg(
             jsonb_build_object(
               'key',          mc.key,
               'provider',     mc.provider,
               'display_name', mc.display_name,
               'logo_url',     mc.logo_url
             )
             order by mc.sort_order, mc.display_name
           ) as models
    from app.llm_model_catalog mc
    where mc.is_active = true
  ),
  pick as (
    select coalesce(ap.models, aa.models, '[]'::jsonb) as models
    from allowed_by_plan ap
    full join all_active aa on true
  )
  select
    b.team_id,
    b.team_name,
    b.company_id,
    b.company_name,
    b.favicon_url,
    b.team_market_focus,
    b.team_business_model,
    b.team_brand_industry,
    p.models
  from base b
  cross join pick p;
$function$;

-- -----------------------------------------------------------------------------
-- S2  user_settings: authenticated liest und ändert nur theme; anon nichts.
--     (Bubble schreibt per REST ausschließlich theme; last_team_id und mira_settings
--      schreiben nur Funktionen.)
-- -----------------------------------------------------------------------------
insert into app._app_start_backup (step, kind, obj, acl)
select 'sofort', 'table_acl', 'app.user_settings', c.relacl
from pg_class c where c.oid = 'app.user_settings'::regclass;

revoke all on app.user_settings from anon;
revoke insert, update on app.user_settings from authenticated;
grant select on app.user_settings to authenticated;
grant update (theme, updated_at) on app.user_settings to authenticated;

-- -----------------------------------------------------------------------------
-- S3  search_path für security-definer-Funktionen ohne search_path
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid, p.oid::regprocedure::text as fn, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.prosecdef and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    insert into app._app_start_backup (step, kind, obj, config) values ('sofort', 'config', r.fn, r.proconfig);
    execute format('alter function %s set search_path = app, public, extensions, pg_temp', r.fn);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- S4  nur für n8n (service_role). Aufrufe bisher ausschließlich service_role.
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid, p.oid::regprocedure::text as fn, p.proacl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.prokind = 'f'
      and p.proname in ('prepare_urls_for_scrape_v3', 'prepare_urls_for_scrape_v4', 'prepare_urls_for_scrape_v5',
                        'get_due_prompts_with_budget_v4', 'get_due_prompts_with_budget_v5',
                        'cc_claim_and_load', 'get_team_companies_context',
                        'get_competitors_with_visibility', 'get_competitors_with_visibility_ui',
                        'get_top_domains', 'get_top_urls_for_domain', 'get_top_urls_for_domain_opt',
                        'get_team_timezone')
  loop
    insert into app._app_start_backup (step, kind, obj, acl) values ('sofort', 'acl', r.fn, r.proacl);
    execute format('revoke all on function %s from public, anon, authenticated', r.fn);
    execute format('grant execute on function %s to service_role', r.fn);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- S5  anon und PUBLIC raus aus allen Funktionen mit Team-Parameter.
--     authenticated / service_role behalten genau ihr bisheriges Recht.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  had_auth boolean;
  had_svc  boolean;
begin
  for r in
    select p.oid, p.oid::regprocedure::text as fn, p.proacl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.prokind = 'f'
      and coalesce(array_to_string(p.proargnames, ','), '') ~* '(^|,)(p_team|p_team_id|team_id|p_team_ids)(,|$)'
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (select 1 from app._app_start_backup b
                      where b.step = 'sofort' and b.kind = 'acl' and b.obj = p.oid::regprocedure::text)
  loop
    had_auth := has_function_privilege('authenticated', r.oid, 'execute');
    had_svc  := has_function_privilege('service_role', r.oid, 'execute');
    insert into app._app_start_backup (step, kind, obj, acl) values ('sofort', 'acl', r.fn, r.proacl);
    execute format('revoke all on function %s from public, anon', r.fn);
    if had_auth then execute format('grant execute on function %s to authenticated', r.fn); end if;
    if had_svc  then execute format('grant execute on function %s to service_role', r.fn); end if;
  end loop;
end $$;

-- tg_user_settings_on_signup ist ein Trigger (braucht kein EXECUTE für Rollen)
insert into app._app_start_backup (step, kind, obj, acl)
select 'sofort', 'acl', 'app.tg_user_settings_on_signup()', p.proacl from pg_proc p
where p.oid = 'app.tg_user_settings_on_signup()'::regprocedure;
revoke all on function app.tg_user_settings_on_signup() from public, anon, authenticated;

commit;

-- =============================================================================
-- Testabfrage: alle Werte wie in der Spalte angegeben
-- =============================================================================
select
  (select count(*) from app._app_start_backup where step = 'sofort') as gesicherte_eintraege,
  not has_function_privilege('anon', 'app.get_team_brand_header(uuid)', 'execute') as s1_kein_anon,
  has_function_privilege('authenticated', 'app.get_team_brand_header(uuid)', 'execute') as s1_authed_bleibt,
  not has_table_privilege('authenticated', 'app.user_settings', 'INSERT') as s2_kein_insert,
  has_column_privilege('authenticated', 'app.user_settings', 'theme', 'UPDATE') as s2_theme_update,
  not has_column_privilege('authenticated', 'app.user_settings', 'last_team_id', 'UPDATE') as s2_last_team_gesperrt,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')) as s3_ohne_search_path_0,
  not has_function_privilege('anon', 'app.prepare_urls_for_scrape_v3(uuid,jsonb,integer,boolean)', 'execute') as s4_kein_anon,
  has_function_privilege('service_role', 'app.prepare_urls_for_scrape_v3(uuid,jsonb,integer,boolean)', 'execute') as s4_service_bleibt,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.prokind = 'f'
      and coalesce(array_to_string(p.proargnames, ','), '') ~* '(^|,)(p_team|p_team_id|team_id|p_team_ids)(,|$)'
      and has_function_privilege('anon', p.oid, 'execute')) as s5_anon_mit_team_0;
