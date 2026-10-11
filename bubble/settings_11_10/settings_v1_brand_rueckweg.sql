-- settings_v1_brand_rueckweg.sql  (11.10.2026)
-- Nimmt settings_v1_brand.sql zurueck (nur Funktionen, keine Daten). Als EIN Block ausfuehren.
set statement_timeout = '30s';
begin;
drop function if exists app.settings_brand_save_v1(uuid, text, text, text, text, text);
drop function if exists app.settings_brand_logo_v1(uuid, text);
drop function if exists app.team_models_set_v1(uuid, text[]);
drop function if exists app._set_require_write_v1(uuid, text);
commit;
select count(*) as verbliebene from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.proname in ('settings_brand_save_v1', 'settings_brand_logo_v1', 'team_models_set_v1', '_set_require_write_v1');
