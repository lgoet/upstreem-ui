-- plan_limits_v1_rueckweg.sql (11.10.2026): macht plan_limits_v1.sql rueckgaengig.
-- Als EIN Block ausfuehren.
-- 1. Trigger und Funktionen weg.
-- 2. Alles, was das System wegen des Plan-Limits pausiert hat, wird wieder aktiv
--    (Wettbewerber mit neuer Tracking-Periode, Prompts, Modelle). Von Hand pausierte bleiben aus.
-- 3. Die neuen Felder bleiben (nichts entfernen).

begin;

drop trigger if exists trg_team_plan_limits_v1 on app.team;
drop function if exists app._trg_team_plan_limits_v1();
drop function if exists app._plan_limits_enforce_v1(uuid, boolean);

-- Wettbewerber zurueck
create temp table _pl_back on commit drop as
select a.team_id, a.company_id, a.deactivated_by from app.team_competitor_archive a where a.deactivated_reason = 'plan_limit';
insert into app.team_company (team_id, company_id, role)
select b.team_id, b.company_id, 'competitor' from _pl_back b
on conflict (team_id, company_id) do nothing;
select app._br_open_period_v1(b.team_id, b.company_id, 'reactivated', b.deactivated_by) from _pl_back b;
delete from app.team_competitor_archive a using _pl_back b where a.team_id = b.team_id and a.company_id = b.company_id;
select app._br_clear_caches_v1(t) from (select distinct team_id t from _pl_back) x;

-- Prompts und Modelle zurueck
update app.prompt p set is_active = true, plan_paused_at = null where p.plan_paused_at is not null and p.deleted_at is null;
update app.team_model_setting s set enabled = true, plan_paused_at = null, updated_at = now() where s.plan_paused_at is not null;

commit;

-- Kontrolle: upstreem wieder 12 Wettbewerber, Funktion weg
select (select count(*) from app.team_company where team_id = '2735aac6-d2cb-4110-976c-f6ac4dec8d5a' and role = 'competitor') as upstreem_wettbewerber,
       to_regprocedure('app._plan_limits_enforce_v1(uuid,boolean)') is null as funktion_weg;
