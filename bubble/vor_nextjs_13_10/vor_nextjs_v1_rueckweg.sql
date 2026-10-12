-- =============================================================================
-- Rückweg zu vor_nextjs_v1.sql  –  als EIN Block ausführen
-- 1. Die vier erweiterten Funktionen bekommen ihre alte Definition zurück (aus app._app_start_backup).
-- 2. Die 32 neuen Funktionen werden entfernt.
-- Es bleiben (keine Daten löschen): Spalte user_settings.prefs und die Tabellen app.quick_search_index /
-- app.quick_search_index_state (abgeleiteter Suchindex; ohne Funktionen liest ihn niemand, löschen beim Aufräumen).
-- =============================================================================
begin;

do $$
declare r record;
begin
  if (select count(*) from app._app_start_backup where step = 'vor_nextjs' and kind = 'def') <> 4 then
    raise exception 'rueckweg: Sicherung step=vor_nextjs unvollständig, abgebrochen';
  end if;
  for r in select * from app._app_start_backup where step = 'vor_nextjs' and kind = 'def' order by id desc loop
    execute r.def;
  end loop;
end $$;

drop function if exists app.opportunity_from_mira_v1(uuid, uuid, text, text, text);
drop function if exists app.export_columns_v1(text);
drop function if exists app.export_brands_v2(uuid, date, date, text[], text[], uuid[], text, text, text, integer, integer);
drop function if exists app.quick_search_v1(uuid, text, text, text, text, text, text, uuid, integer);
drop function if exists app._quick_search_typeahead_v1(uuid, text[], text, integer);
drop function if exists app._quick_search_index_v1(uuid, boolean);
drop function if exists app._quick_search_raw_v1(uuid, text, text, text, text, text, text, text, text, integer, text);
drop function if exists app.cached_impact_event_analysis_v2(uuid, uuid, integer, text[], text[]);
drop function if exists app.delete_impact_event_v2(uuid, uuid);
drop function if exists app.remove_impact_event_url_v2(uuid, uuid, uuid);
drop function if exists app.add_impact_event_url_v2(uuid, uuid, text);
drop function if exists app.update_impact_event_v2(uuid, uuid, text, text, text, text, text, text);
drop function if exists app.create_impact_event_v2(uuid, text, date, text, uuid[], text[], text, text, text, text, text);
drop function if exists app.preview_impact_event_scope_v2(uuid, text, uuid[]);
drop function if exists app.get_impact_event_v2(uuid, uuid);
drop function if exists app._impact_event_analysis_v2(uuid, uuid, integer, text[], text[]);
drop function if exists app._impact_event_check_v2(text, text, text, text, text, text);
drop function if exists app._impact_event_require_v2(uuid, text, integer);
drop function if exists app._impact_event_detail_v2(uuid, uuid);
drop function if exists app.get_ads_filter_options_v2(uuid, date, date);
drop function if exists app.list_ads_prompts_v2(uuid, date, date, text[], text[], uuid[], text[], text[], text, integer, integer, text);
drop function if exists app.list_ads_library_v2(uuid, date, date, text[], text[], uuid[], text[], text[], text, integer, integer);
drop function if exists app.get_ads_advertiser_detail_v2(uuid, text, date, date, text[], text[], uuid[], text[], text[]);
drop function if exists app.list_ads_advertisers_v2(uuid, date, date, text[], text[], uuid[], text[], text[], text, integer, integer, text);
drop function if exists app.get_ads_overview_v2(uuid, date, date, text[], text[], uuid[], text[], text[]);
drop function if exists app.cached_shopping_merchants_v2(uuid, date, date, text[], text[], uuid[], text, text, text, integer, integer);
drop function if exists app.cached_shopping_product_detail_v2(uuid, text, date, date, text[], text[], uuid[], text, integer, integer);
drop function if exists app.cached_shopping_products_v2(uuid, date, date, text[], text[], uuid[], text, text, text, text, uuid, text, integer, integer);
drop function if exists app.cached_shopping_overview_v2(uuid, date, date, text[], text[], uuid[], text, text, text, integer, integer);
drop function if exists app._shopping_cached_v2(text, uuid, jsonb, text);
-- nach dem Zurücksetzen von user_settings_set_v1 und _app_start_build_v1 werden diese beiden nicht mehr gebraucht
drop function if exists app._app_settings_row_v1(text, jsonb);
drop function if exists app._app_settings_allowed_v1();

delete from app._app_start_backup where step = 'vor_nextjs';

commit;

-- Testabfrage: 0 | 0 | false
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app'
     and p.proname in ('opportunity_from_mira_v1', 'export_columns_v1', 'export_brands_v2', 'quick_search_v1',
                       '_quick_search_raw_v1', '_shopping_cached_v2', '_impact_event_detail_v2', '_app_settings_row_v1')) as neue_reste_0,
  (select count(*) from app._app_start_backup where step = 'vor_nextjs') as sicherungen_0,
  pg_get_functiondef('app.team_context_v1(uuid,text[])'::regprocedure) like '%''teams''%' as teams_teil_noch_da;
