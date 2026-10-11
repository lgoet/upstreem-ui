-- plan_limits_v1.sql (11.10.2026): Plan-Limits hart durchsetzen
-- Als EIN Block im Supabase SQL Editor ausfuehren. Laeuft in einer Transaktion.
-- Rueckweg: plan_limits_v1_rueckweg.sql
--
-- Regel: Ist ein Team ueber dem Limit seines Plans, werden die zuletzt hinzugefuegten pausiert
-- (Wettbewerber, aktive Prompts, Modelle). Nichts wird geloescht, die Historie bleibt.
-- Wann: sofort bei jedem Planwechsel am Team (Trigger auf app.team.billing_plan_id),
--       also auch, wenn Stripe einen Downgrade meldet. Ein Upgrade holt nichts automatisch zurueck.
-- Neue Felder (nur dazu): team_competitor_archive.deactivated_reason, prompt.plan_paused_at,
--       team_model_setting.plan_paused_at
-- Jetzt angewendet: nur auf das Team upstreem (12 von 10 Wettbewerbern -> Kompyte und Finseo pausiert).
--       Allianz (12 von 10) bleibt unberuehrt, bis sich sein Plan aendert.

begin;

do $g$
begin
  if to_regprocedure('app._plan_limits_enforce_v1(uuid,boolean)') is not null then
    raise exception 'plan_limits_v1: _plan_limits_enforce_v1 gibt es schon. Nichts geaendert.';
  end if;
  if to_regprocedure('app._br_clear_caches_v1(uuid)') is null
     or to_regprocedure('app._pi_clear_caches_v1(uuid,text)') is null
     or to_regprocedure('app._pi_log_v1(uuid,text,jsonb)') is null then
    raise exception 'plan_limits_v1: Helfer aus Brands v1 / Prompt Insights v1 fehlen. Nichts geaendert.';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'app.team'::regclass and tgname = 'trg_team_plan_limits_v1') then
    raise exception 'plan_limits_v1: Trigger gibt es schon. Nichts geaendert.';
  end if;
end $g$;

-- Felder nur dazu: woran man erkennt, dass das System wegen des Plan-Limits pausiert hat
alter table app.team_competitor_archive add column deactivated_reason text;
alter table app.prompt add column plan_paused_at timestamptz;
alter table app.team_model_setting add column plan_paused_at timestamptz;
comment on column app.team_competitor_archive.deactivated_reason is 'null = von Hand; plan_limit = vom System beim Planwechsel pausiert';
comment on column app.prompt.plan_paused_at is 'gesetzt, wenn das System den Prompt wegen des Plan-Limits pausiert hat';
comment on column app.team_model_setting.plan_paused_at is 'gesetzt, wenn das System das Modell wegen des Plan-Limits abgeschaltet hat';

-- Plan-Limits hart durchsetzen. Regel: Was ueber dem Limit ist, wird pausiert, die zuletzt
-- hinzugefuegten zuerst. Nichts wird geloescht; Historie bleibt.
--   Wettbewerber: Beginn der offenen Tracking-Periode (ohne Periode = gilt als alt, bleibt)
--   Prompts:      created_at
--   Modelle:      updated_at (zuletzt eingeschaltet); mindestens ein Modell bleibt an
-- Teams ohne Plan oder geloeschte Teams: nichts (sie laufen ohnehin nicht).
create function app._plan_limits_enforce_v1(p_team uuid, p_dry_run boolean default false)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_plan   app.billing_plan%rowtype;
  v_del    boolean;
  v_actor  uuid;
  v_comp   uuid[];
  v_prom   uuid[];
  v_mod    text[];
  v_cn     int;
  v_pn     int;
  v_mn     int;
begin
  select coalesce(t.is_deleted, false) into v_del from app.team t where t.id = p_team for update;
  if not found then
    raise exception 'team_not_found' using errcode = 'PT404';
  end if;
  select bp.* into v_plan from app.team t join app.billing_plan bp on bp.id = t.billing_plan_id where t.id = p_team;
  if not found or v_del then
    return jsonb_build_object('team_id', p_team, 'skipped', case when v_del then 'team_deleted' else 'no_plan' end);
  end if;

  -- Wettbewerber
  select count(*)::int into v_cn from app.team_company tc where tc.team_id = p_team and tc.role = 'competitor';
  if v_plan.competitors_max_active is not null and v_cn > v_plan.competitors_max_active then
    select array_agg(x.company_id order by x.added desc nulls last, x.company_id desc) into v_comp
    from (select tc.company_id,
                 (select max(tp.started_at) from app.team_company_tracking_period tp
                   where tp.team_id = tc.team_id and tp.company_id = tc.company_id and tp.ended_at is null) as added
          from app.team_company tc where tc.team_id = p_team and tc.role = 'competitor'
          order by added desc nulls last, tc.company_id desc
          limit v_cn - v_plan.competitors_max_active) x;
  end if;

  -- Prompts
  select count(*)::int into v_pn from app.prompt p where p.team_id = p_team and p.is_active and p.deleted_at is null;
  if v_plan.prompts_per_day is not null and v_pn > v_plan.prompts_per_day then
    select array_agg(x.id order by x.created_at desc, x.id desc) into v_prom
    from (select p.id, p.created_at from app.prompt p
          where p.team_id = p_team and p.is_active and p.deleted_at is null
          order by p.created_at desc, p.id desc
          limit v_pn - v_plan.prompts_per_day) x;
  end if;

  -- Modelle (mindestens eins bleibt an)
  select count(*)::int into v_mn from app.team_model_setting s where s.team_id = p_team and s.enabled;
  if v_plan.models_max_active is not null and v_mn > greatest(v_plan.models_max_active, 1) then
    select array_agg(x.model_key order by x.updated_at desc, x.model_key desc) into v_mod
    from (select s.model_key, s.updated_at from app.team_model_setting s
          where s.team_id = p_team and s.enabled
          order by s.updated_at desc, s.model_key desc
          limit v_mn - greatest(v_plan.models_max_active, 1)) x;
  end if;

  if not p_dry_run then
    -- Pflichtfelder fuer "wer" (Archiv, Team-Protokoll): erster owner des Teams; der Grund steht jeweils dabei
    select tm.user_id into v_actor from app.team_member tm
    where tm.team_id = p_team order by (tm.role::text = 'owner') desc, tm.created_at, tm.user_id limit 1;
    if v_comp is not null then
      if v_actor is null then
        v_comp := null;
      else
        insert into app.team_competitor_archive (team_id, company_id, role, deactivated_at, deactivated_by, deactivated_reason)
        select p_team, x, 'competitor', now(), v_actor, 'plan_limit' from unnest(v_comp) x
        on conflict (team_id, company_id) do update
          set role = excluded.role, deactivated_at = excluded.deactivated_at,
              deactivated_by = excluded.deactivated_by, deactivated_reason = excluded.deactivated_reason;
        delete from app.team_company_tracking_period tp
         where tp.team_id = p_team and tp.company_id = any(v_comp) and tp.ended_at is null and tp.started_at >= now();
        update app.team_company_tracking_period tp set ended_at = now(), end_reason = 'deactivated'
         where tp.team_id = p_team and tp.company_id = any(v_comp) and tp.ended_at is null;
        delete from app.team_company tc where tc.team_id = p_team and tc.company_id = any(v_comp) and tc.role = 'competitor';
        insert into app.brand_activity_log (team_id, user_id, action, n, company_ids, details)
        values (p_team, null, 'deactivate', cardinality(v_comp), v_comp,
                jsonb_build_object('reason', 'plan_limit', 'plan', v_plan.name, 'limit', v_plan.competitors_max_active));
        perform app._br_clear_caches_v1(p_team);
      end if;
    end if;
    if v_prom is not null then
      update app.prompt p set is_active = false, plan_paused_at = now()
       where p.team_id = p_team and p.id = any(v_prom);
      perform app._pi_log_v1(p_team, 'prompts_plan_limit_paused',
        jsonb_build_object('reason', 'plan_limit', 'plan', v_plan.name, 'limit', v_plan.prompts_per_day,
                           'n', cardinality(v_prom), 'prompt_ids', to_jsonb(v_prom)));
      perform app._pi_clear_caches_v1(p_team, 'prompts');
    end if;
    if v_mod is not null then
      update app.team_model_setting s set enabled = false, plan_paused_at = now(), updated_at = now()
       where s.team_id = p_team and s.model_key = any(v_mod);
      if v_actor is not null then
        insert into app.team_audit_log (team_id, actor_user_id, event_type, meta)
        values (p_team, v_actor, 'models_changed',
                jsonb_build_object('off', to_jsonb(v_mod), 'reason', 'plan_limit', 'plan', v_plan.name, 'by', 'system'));
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'team_id', p_team, 'plan', v_plan.name, 'dry_run', p_dry_run,
    'competitors', jsonb_build_object('limit', v_plan.competitors_max_active, 'active_before', v_cn,
                     'paused', coalesce((select jsonb_agg(jsonb_build_object('company_id', c.id, 'name', c.name) order by o.n)
                                         from unnest(v_comp) with ordinality o(id, n) join app.company c on c.id = o.id), '[]'::jsonb)),
    'prompts', jsonb_build_object('limit', v_plan.prompts_per_day, 'active_before', v_pn,
                 'paused', coalesce(cardinality(v_prom), 0), 'prompt_ids', coalesce(to_jsonb(v_prom), '[]'::jsonb)),
    'models', jsonb_build_object('limit', v_plan.models_max_active, 'active_before', v_mn,
                'paused', coalesce(to_jsonb(v_mod), '[]'::jsonb)));
end;
$f$;

-- Planwechsel am Team (Stripe-Webhook, Kasse, Support) setzt die Limits sofort durch.
-- Ein Fehler hier darf den Planwechsel nicht verhindern: nur Warnung.
create function app._trg_team_plan_limits_v1()
 returns trigger language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
begin
  begin
    perform app._plan_limits_enforce_v1(new.id, false);
  exception when others then
    raise warning 'plan_limits_enforce failed for team %: %', new.id, sqlerrm;
  end;
  return null;
end;
$f$;

create trigger trg_team_plan_limits_v1
  after update of billing_plan_id on app.team
  for each row
  when (new.billing_plan_id is distinct from old.billing_plan_id and new.billing_plan_id is not null)
  execute function app._trg_team_plan_limits_v1();

revoke all on function app._plan_limits_enforce_v1(uuid, boolean), app._trg_team_plan_limits_v1() from public, anon, authenticated;
grant execute on function app._plan_limits_enforce_v1(uuid, boolean) to service_role;

-- upstreem jetzt hart auf das Limit setzen
create temp table _plan_limits_result as
select app._plan_limits_enforce_v1('2735aac6-d2cb-4110-976c-f6ac4dec8d5a'::uuid) as ergebnis;

commit;

-- Kontrolle: was pausiert wurde (erwartet: Kompyte, Finseo) und der neue Stand
select r.ergebnis->'competitors'->'paused' as pausiert,
       (select count(*) from app.team_company tc where tc.team_id = '2735aac6-d2cb-4110-976c-f6ac4dec8d5a' and tc.role = 'competitor') as wettbewerber_aktiv,
       (select count(*) from pg_trigger where tgrelid = 'app.team'::regclass and tgname = 'trg_team_plan_limits_v1') as trigger_da
from _plan_limits_result r;
