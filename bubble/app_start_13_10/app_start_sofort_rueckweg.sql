-- =============================================================================
-- Rückweg zu app_start_sofort.sql  –  als EIN Block ausführen
-- Stellt Definition, ACL und search_path aus app._app_start_backup (step = 'sofort') wieder her.
-- Die Sicherungstabelle bleibt stehen (sie wird auch von den späteren Schritten genutzt).
-- =============================================================================
begin;

do $$
declare
  r record;
  a record;
begin
  -- 1) alte Definitionen
  for r in select * from app._app_start_backup where step = 'sofort' and kind = 'def' order by id desc loop
    execute r.def;
  end loop;

  -- 2) search_path wieder entfernen (vorher hatten diese Funktionen keinen)
  for r in select * from app._app_start_backup where step = 'sofort' and kind = 'config' order by id desc loop
    execute format('alter function %s reset search_path', r.obj);
  end loop;

  -- 3) Funktions-ACLs exakt wiederherstellen
  for r in select * from app._app_start_backup where step = 'sofort' and kind = 'acl' order by id desc loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', r.obj);
    if r.acl is null then
      execute format('grant execute on function %s to public', r.obj);        -- Standard: PUBLIC darf ausführen
    else
      for a in select * from aclexplode(r.acl) loop
        if a.privilege_type = 'EXECUTE' then
          if a.grantee = 0 then
            execute format('grant execute on function %s to public', r.obj);
          else
            execute format('grant execute on function %s to %I', r.obj, pg_get_userbyid(a.grantee));
          end if;
        end if;
      end loop;
    end if;
  end loop;

  -- 4) Tabellenrechte user_settings
  for r in select * from app._app_start_backup where step = 'sofort' and kind = 'table_acl' order by id desc loop
    execute format('revoke all on %s from anon, authenticated', r.obj);
    for a in select * from aclexplode(r.acl) loop
      if pg_get_userbyid(a.grantee) in ('anon', 'authenticated') then
        execute format('grant %s on %s to %I', a.privilege_type, r.obj, pg_get_userbyid(a.grantee));
      end if;
    end loop;
  end loop;

  delete from app._app_start_backup where step = 'sofort';
end $$;

commit;

-- Testabfrage: md5 der alten get_team_brand_header = f157f6b0ac1443506bd7cbd89daac750
select md5(pg_get_functiondef('app.get_team_brand_header(uuid)'::regprocedure)) as header_md5,
       has_function_privilege('anon', 'app.get_team_brand_header(uuid)', 'execute') as anon_wieder,
       has_table_privilege('authenticated', 'app.user_settings', 'INSERT') as insert_wieder;
