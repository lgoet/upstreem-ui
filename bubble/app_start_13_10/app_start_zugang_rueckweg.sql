-- =============================================================================
-- Rückweg zu app_start_zugang.sql  –  als EIN Block ausführen
-- Setzt jede geänderte Funktion (inkl. team_access) auf die gesicherte alte Definition
-- zurück und entfernt danach app._app_gate_v1. Rechte bleiben unverändert
-- (create or replace ändert keine ACL).
-- =============================================================================
begin;

do $$
declare r record;
begin
  for r in select * from app._app_start_backup where step = 'zugang' and kind = 'def' order by id desc loop
    execute r.def;
  end loop;
  -- Sicherheitsnetz: es darf nichts mehr auf die Sperre zeigen
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'app' and p.proname <> '_app_gate_v1' and pg_get_functiondef(p.oid) ~ '_app_gate_v1\(') then
    raise exception 'rueckweg: es gibt noch Aufrufe von _app_gate_v1, abgebrochen';
  end if;
  delete from app._app_start_backup where step = 'zugang';
end $$;

drop function if exists app._app_gate_v1(uuid);

commit;

-- Testabfrage: 0 | 0
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and pg_get_functiondef(p.oid) ~ '_app_gate_v1') as aufrufe_sperre_0,
  (select count(*) from app._app_start_backup where step = 'zugang') as sicherungen_0;
