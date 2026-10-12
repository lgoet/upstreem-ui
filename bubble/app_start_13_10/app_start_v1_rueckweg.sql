-- =============================================================================
-- Rückweg zu app_start_v1.sql  –  als EIN Block ausführen
-- Entfernt alle neuen Funktionen. Die neue Spalte user_notification_dismissal.reason bleibt
-- (Daten werden nicht gelöscht; sie stört niemanden).
-- =============================================================================
begin;

-- Reihenfolge der Rückwege: zugang -> v1 -> sofort. team_access nutzt nach app_start_zugang.sql _team_access_v2.
do $$ begin
  if to_regprocedure('app._app_gate_v1(uuid)') is not null
     or exists (select 1 from app._app_start_backup where step = 'zugang') then
    raise exception 'erst app_start_zugang_rueckweg.sql ausführen';
  end if;
end $$;

drop function if exists app.app_start_v1(uuid);
drop function if exists app.team_switch_v1(uuid);
drop function if exists app.team_context_v1(uuid, text[]);
drop function if exists app.markets_all_v1();
drop function if exists app.user_notification_v1(uuid);
drop function if exists app.user_notification_dismiss_v1(uuid, text);
drop function if exists app.user_settings_set_v1(text, text);
drop function if exists app._app_start_build_v1(uuid, uuid, uuid);
drop function if exists app._app_team_row_v1(uuid, uuid);
drop function if exists app._app_teams_v1(uuid);
drop function if exists app._app_user_v1(uuid);
drop function if exists app._app_uid_v1();
drop function if exists app._team_access_v2(uuid);

commit;

-- Testabfrage: 0
select count(*) as neue_funktionen_0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.proname in ('_team_access_v2', '_app_user_v1', '_app_teams_v1', '_app_team_row_v1',
  '_app_start_build_v1', '_app_uid_v1', 'app_start_v1', 'team_switch_v1', 'team_context_v1', 'markets_all_v1',
  'user_notification_v1', 'user_notification_dismiss_v1', 'user_settings_set_v1');
