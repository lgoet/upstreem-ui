-- =============================================================================
-- App-Start, Zugang (13.10.2026)  –  als EIN Block ausführen
-- Reihenfolge: app_start_sofort.sql -> app_start_v1.sql -> diese Datei
-- Rückweg: app_start_zugang_rueckweg.sql (stellt alles aus app._app_start_backup wieder her)
--
-- Z1  app._app_gate_v1(p_team): Zugangssperre
--       - ohne Nutzer (n8n / service_role)     -> nichts (Jobs laufen weiter)
--       - Nutzer ist nicht Mitglied             -> nichts (die Funktion prüft wie bisher selbst
--                                                  und meldet ihren gewohnten Fehler; kein Hinweis
--                                                  auf den Zustand fremder Teams)
--       - Mitglied, Team ohne Zugang            -> PT402 'team_access_<state>', hint = state
--     Zugang wird mit app._team_access_v2 gerechnet (aus app_start_v1.sql).
--
-- Z2  app.team_access(uuid): rechnet has_access jetzt mit _team_access_v2
--     (abgelaufener Trial nach 1 Tag Karenz gesperrt). Die alten Zustandswörter bleiben
--     (canceling -> active, unpaid -> past_due), damit Bubble nichts Neues sieht.
--     Heute ohne Wirkung: es gibt keine team_billing-Zeile (12 Teams mit Plan aktiv, 2 no_plan).
--
-- Z3  In jede plpgsql-Funktion mit Team-Parameter (p_team | p_team_id | team_id, uuid),
--     die authenticated ausführen darf und noch keinen Zugangs-Check hat, wird direkt nach
--     dem ersten begin eingefügt:
--         perform app._app_gate_v1(<param>);
--     Ausgenommen (müssen ohne Zugang funktionieren): Start, Benachrichtigung, Billing,
--     Teamverwaltung, Einstellungen, Onboarding, Portfolio (p_team_ids).
-- Z4  SQL-Funktionen mit Team-Parameter: 'select app._app_gate_v1(<param>);' als erste Anweisung.
--
-- Jede alte Definition wird mit md5 in app._app_start_backup (step = 'zugang') gesichert.
-- Nichts wird umbenannt oder entfernt, keine Signatur ändert sich.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- Z1  Sperre
-- -----------------------------------------------------------------------------
create or replace function app._app_gate_v1(p_team uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_has boolean;
  v_state text;
begin
  if v_uid is null or p_team is null then
    return;
  end if;
  if not exists (select 1 from app.team_member tm where tm.team_id = p_team and tm.user_id = v_uid) then
    return;
  end if;
  select a.has_access, a.access_state into v_has, v_state from app._team_access_v2(p_team) a;
  if not coalesce(v_has, false) then
    raise exception '%', 'team_access_' || coalesce(v_state, 'no_plan')
      using errcode = 'PT402', hint = coalesce(v_state, 'no_plan');
  end if;
end
$function$;
revoke all on function app._app_gate_v1(uuid) from public, anon;
grant execute on function app._app_gate_v1(uuid) to authenticated, service_role;   -- nötig für security-invoker-Funktionen

-- -----------------------------------------------------------------------------
-- Z2  team_access(uuid) auf die richtige Rechnung, alte Zustandswörter
-- -----------------------------------------------------------------------------
insert into app._app_start_backup (step, kind, obj, def, md5)
select 'zugang', 'def', 'app.team_access(uuid)',
       pg_get_functiondef('app.team_access(uuid)'::regprocedure),
       md5(pg_get_functiondef('app.team_access(uuid)'::regprocedure));

create or replace function app.team_access(p_team uuid)
returns table(has_access boolean, access_state text, access_ended_at timestamptz)
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
  -- 13.10.2026 (app_start_zugang.sql): Rechnung aus _team_access_v2, Zustandswörter wie bisher
  select a.has_access,
         case a.access_state when 'canceling' then 'active' when 'unpaid' then 'past_due' else a.access_state end,
         a.access_ended_at
  from app._team_access_v2(p_team) a
$function$;

-- -----------------------------------------------------------------------------
-- Z3  Sperre in die Funktionen einsetzen
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_def text;
  v_new text;
  v_n int := 0;
begin
  for r in
    with f as (
      select p.oid, p.proname, p.oid::regprocedure::text as fn, pg_get_functiondef(p.oid) as def,
             -- nur Eingabe-Parameter (OUT-Spalten wie team_id einer returns table zählen nicht)
             (select a.n from unnest(p.proargnames, coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality a(n, t, i)
               where a.n in ('p_team', 'p_team_id', 'team_id') and a.t = 'uuid'::regtype
                 and coalesce(p.proargmodes[a.i], 'i') in ('i', 'b')
               order by array_position(array['p_team', 'p_team_id', 'team_id'], a.n) limit 1) as tparam
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'app' and p.prokind = 'f' and l.lanname = 'plpgsql'
        and has_function_privilege('authenticated', p.oid, 'execute')
        and not ('p_team_ids' = any(coalesce(p.proargnames, '{}')))
        and p.proname not in (
          -- Start / Benachrichtigung / Header (Bubble heute)
          'get_active_user_notification_v1', 'get_team_brand_header_v9', 'get_team_companies_v1',
          'get_team_model_settings_v1', 'get_team_plan_quota', 'get_team_plan_quota_v2',
          -- Billing
          'get_team_billing_status_v1', 'billing_plans_v1', 'billing_checkout_prepare_v1', 'billing_portal_prepare_v1',
          -- Teamverwaltung / Einstellungen
          'create_team_invite_v1', 'delete_team_v3', 'get_team_audit_log_v1', 'get_team_invites_v1',
          'get_team_organisation_v4', 'kick_team_member_v1', 'leave_team_v1', 'resend_team_invite_v1',
          'revoke_team_invite_v1', 'set_team_member_role_v1', 'settings_brand_v1', 'settings_brand_logo_v1',
          'settings_brand_save_v1', 'team_delete_v1', 'team_invite_create_v1', 'team_invite_resend_v1',
          'team_invite_revoke_v1', 'team_invites_v1', 'team_leave_v1', 'team_log_v1', 'team_member_remove_v1',
          'team_member_role_v1',
          -- Onboarding
          'onboarding_submit',
          -- neu aus app_start_v1.sql (prüfen selbst)
          'team_context_v1', 'team_switch_v1', 'user_notification_v1', '_app_gate_v1')
    )
    select * from f
    where tparam is not null
      and def !~ '(require_team_access|team_access\(|_team_access_v2\(|_app_gate_v1\(|_require_v1\(|_require_write_v1\()'
    order by fn
  loop
    v_def := r.def;
    v_new := regexp_replace(v_def, '(AS \$function\$.*?\mbegin\M)',
               '\1' || E'\n  perform app._app_gate_v1(' || quote_ident(r.tparam) || ');  -- 13.10.2026 app_start_zugang.sql', 'i');
    if v_new = v_def then
      raise exception 'zugang: kein begin gefunden in %', r.fn;
    end if;
    insert into app._app_start_backup (step, kind, obj, def, md5) values ('zugang', 'def', r.fn, v_def, md5(v_def));
    execute v_new;
    v_n := v_n + 1;
  end loop;
  raise notice 'zugang: % Funktionen mit Sperre', v_n;
end $$;

-- -----------------------------------------------------------------------------
-- Z4  dasselbe für SQL-Funktionen: vor den bisherigen Text kommt die Anweisung
--         select app._app_gate_v1(<param>);
--     Eine SQL-Funktion liefert das Ergebnis ihrer letzten Anweisung, die Antwort bleibt also gleich.
--     (betrifft u. a. get_tags, get_tags_v2, get_markets_v2, get_inactive_competitors_v1,
--      list_suggested_prompts, list_suggested_prompts_v2, get_domain_mentions)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_new text;
  v_n int := 0;
begin
  for r in
    with f as (
      select p.oid, p.proname, p.oid::regprocedure::text as fn, pg_get_functiondef(p.oid) as def,
             (select a.n from unnest(p.proargnames, coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality a(n, t, i)
               where a.n in ('p_team', 'p_team_id', 'team_id') and a.t = 'uuid'::regtype
                 and coalesce(p.proargmodes[a.i], 'i') in ('i', 'b')
               order by array_position(array['p_team', 'p_team_id', 'team_id'], a.n) limit 1) as tparam
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'app' and p.prokind = 'f' and l.lanname = 'sql'
        and has_function_privilege('authenticated', p.oid, 'execute')
        and not ('p_team_ids' = any(coalesce(p.proargnames, '{}')))
        and p.proname not in ('get_team_brand_header', 'team_access', '_team_access_v2', '_app_teams_v1', '_app_user_v1')
    )
    select * from f
    where tparam is not null
      and def ~ 'AS \$function\$'
      and def !~ '(require_team_access|team_access\(|_team_access_v2\(|_app_gate_v1\(|_require_v1\(|_require_write_v1\()'
    order by fn
  loop
    v_new := regexp_replace(r.def, 'AS \$function\$',
               'AS $function$' || E'\n  select app._app_gate_v1(' || quote_ident(r.tparam) || ');  -- 13.10.2026 app_start_zugang.sql\n');
    insert into app._app_start_backup (step, kind, obj, def, md5) values ('zugang', 'def', r.fn, r.def, md5(r.def));
    execute v_new;
    v_n := v_n + 1;
  end loop;
  raise notice 'zugang: % SQL-Funktionen mit Sperre', v_n;
end $$;

commit;

-- =============================================================================
-- Testabfrage: funktionen_mit_sperre = aufrufe_sperre (Stand 13.10.: 177), sperre_kein_anon = true,
-- team_access_zustaende = active=12, no_plan=2
-- =============================================================================
select
  (select count(*) from app._app_start_backup where step = 'zugang' and obj <> 'app.team_access(uuid)') as funktionen_mit_sperre,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname <> '_app_gate_v1' and pg_get_functiondef(p.oid) ~ '_app_gate_v1\(') as aufrufe_sperre,
  not has_function_privilege('anon', 'app._app_gate_v1(uuid)', 'execute') as sperre_kein_anon,
  (select string_agg(x.access_state || '=' || x.n, ', ' order by x.access_state)
     from (select a.access_state, count(*) n from app.team t cross join lateral app.team_access(t.id) a group by 1) x) as team_access_zustaende;
