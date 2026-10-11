-- response_detail_v1_rueckweg.sql: entfernt response_detail_v1 wieder. Als EIN Block ausfuehren.
begin;
drop function if exists app.response_detail_v1(uuid, uuid);
commit;
select to_regprocedure('app.response_detail_v1(uuid,uuid)') is null as entfernt;
