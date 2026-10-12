-- =============================================================================
-- Rückweg zu onboarding_v1.sql  –  als EIN Block ausführen
-- Stellt die alten Definitionen und Rechte wieder her und entfernt alles Neue.
-- Neue Felder (error_code, prompt_selection_key, checkout_trial_days, is_own) und die Tabelle
-- onboarding_trial_claim bleiben stehen: Daten werden nicht gelöscht, sie stören niemanden.
-- Prüfwerte am Ende: md5 submit 5d883157…, broadcast 59733c56…, start_v1 8d0788f9….
-- =============================================================================
begin;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'onboarding-reaper') then
    perform cron.unschedule('onboarding-reaper');
  end if;
end $$;

drop trigger if exists trg_onb_prompt_guard on app.onboarding_suggested_prompt;
grant update, delete on app.onboarding_suggested_prompt to authenticated;

drop function if exists app.onboarding_bundle_v1();
drop function if exists app.onboarding_status_v1(uuid);
drop function if exists app.onboarding_select_v1(uuid,text,uuid[]);
drop function if exists app.onboarding_prompt_add_v1(uuid,text,boolean);
drop function if exists app.onboarding_prompt_remove_v1(uuid,uuid);
drop function if exists app.onboarding_plans_v1();
drop function if exists app._onb_start_v1(uuid,text,text,text,text,text,boolean);
drop function if exists app._onb_prompts_start_v1(uuid,uuid,text[],boolean);
drop function if exists app._onb_checkout_prepare_v1(uuid,uuid,uuid,text);
drop function if exists app._onb_checkout_set_v1(uuid,uuid,uuid,text,text,text,integer);
drop function if exists app._onb_checkout_lookup_v1(uuid,text);
drop function if exists app._onb_trial_register_v1(uuid,text,text,integer);
drop function if exists app._onb_finalize_failed_v1(uuid,text);
drop function if exists app.onboarding_run_context_v1(uuid,uuid);
drop function if exists app.onboarding_run_update_v1(uuid,uuid,integer,text);
drop function if exists app.onboarding_run_finish_analysis_v1(uuid,uuid,jsonb,jsonb,text,text);
drop function if exists app.onboarding_run_finish_prompts_v1(uuid,uuid,jsonb);
drop function if exists app._onb_reaper_v1();
drop function if exists app._onb_prompt_guard_v1();

-- Teil 3: alte Rechte
grant execute on function public.onboarding_get_status(uuid)        to public, anon;
grant execute on function public.onboarding_save_step1(jsonb)       to public, anon;
grant execute on function public.onboarding_save_step1_debug(jsonb) to public, anon;
grant execute on function public.onboarding_submit(jsonb)           to public, anon;
grant execute on function app.get_my_teams_v4()                      to public, anon;
grant execute on function app.fn_onboarding_project_log()            to public;

-- alte Definition app.onboarding_submit (md5 5d883157d26f5e020e5459ec3ff38887)
CREATE OR REPLACE FUNCTION app.onboarding_submit(p_onboarding_id uuid)
 RETURNS TABLE(team_id uuid, status app.onboarding_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Liefert direkt eine Ergebniszeile ins OUT-Table (team_id NULL, status aus DB)
  return query
    update app.onboarding_project p
       set status = 'submitted'::app.onboarding_status,
           updated_at = now()
     where p.id = p_onboarding_id
       and p.user_id = v_uid
     returning null::uuid as team_id, p.status;

  -- Wenn obiges nichts lieferte → NOT FOUND true → explizit Fehler
  if not found then
    raise exception 'Onboarding not found or not owned by user';
  end if;

end
$function$
;

-- alte Definition app.onboarding_broadcast_status (md5 59733c56c59b1a30eaaae35c90eb67fe)
CREATE OR REPLACE FUNCTION app.onboarding_broadcast_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if TG_OP = 'UPDATE'
     and NEW.status           is not distinct from OLD.status
     and NEW.status_phase     is not distinct from OLD.status_phase
     and NEW.status_label     is not distinct from OLD.status_label
     and NEW.progress_percent is not distinct from OLD.progress_percent
     and NEW.last_error       is not distinct from OLD.last_error
  then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'onboarding_id',    NEW.id,
      'status',           NEW.status,
      'status_phase',     NEW.status_phase,
      'status_label',     NEW.status_label,
      'progress_percent', NEW.progress_percent,
      'last_error',       NEW.last_error,
      'updated_at',       NEW.updated_at
    ),
    'onboarding_status',                        -- event
    'onboarding:' || NEW.id::text,              -- topic
    false                                       -- PUBLIC (vorher: true)
  );

  return null;
end;
$function$
;

-- alte Definition app.onboarding_start_v1 (md5 8d0788f9ef24b50bfc2f4257ab3a2d75)
CREATE OR REPLACE FUNCTION app.onboarding_start_v1(p_company_name text, p_website text, p_market text DEFAULT NULL::text, p_business_model text DEFAULT NULL::text, p_timezone text DEFAULT NULL::text, p_mode app.account_mode DEFAULT 'Brand'::app.account_mode)
 RETURNS TABLE(onboarding_id uuid, run_token uuid, status text, website_url text, website_domain text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  v_user_id uuid;
  v_url     text;
  v_domain  text;
  v_id      uuid;
  v_token   uuid := gen_random_uuid();
  v_existing_id uuid;
  v_policy  jsonb;
begin
  v_user_id := coalesce(
    auth.uid(),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  );
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_website), '') = '' then
    raise exception 'website is required' using errcode = 'P0001';
  end if;

  -- URL normalisieren
  v_url := btrim(p_website);
  if v_url !~* '^https?://' then
    v_url := 'https://' || regexp_replace(v_url, '^/+', '');
  end if;
  v_domain := lower(regexp_replace(regexp_replace(v_url, '^https?://', ''), '^www\.', ''));
  v_domain := split_part(split_part(split_part(v_domain, '/', 1), '?', 1), '#', 1);
  v_domain := split_part(v_domain, ':', 1);
  if v_domain = '' or position('.' in v_domain) = 0 then
    raise exception 'invalid website: %', p_website using errcode = 'P0001';
  end if;
  v_url := 'https://' || v_domain || '/';

  -- team_id wird bewusst NICHT gesetzt und die Timezone hier nicht in
  -- app.team geschrieben: zum Startzeitpunkt existiert das Team noch nicht.
  -- Die Timezone wandert im Finalize aus onboarding_project ins neue Team.

  ------------------------------------------------------------------
  -- SERIALISIERUNG PRO USER
  -- Ohne das koennen zwei gleichzeitige Klicks (Doppelklick, zweiter Tab)
  -- beide die Policy als "erlaubt" lesen, beide ein Restart-Log schreiben
  -- und beide den n8n-Workflow starten. Der Advisory Lock greift auch dann,
  -- wenn noch gar keine Zeile existiert - ein FOR UPDATE koennte da nichts
  -- sperren, weil es nichts zu sperren gibt.
  -- Er faellt automatisch beim Transaktionsende.
  ------------------------------------------------------------------
  perform pg_advisory_xact_lock(
    hashtext('onboarding_start:' || v_user_id::text)::bigint
  );

  ------------------------------------------------------------------
  -- RESTART-POLICY
  -- Nur relevant, wenn schon ein Onboarding existiert. Der allererste
  -- Start ist immer erlaubt.
  ------------------------------------------------------------------
  select id into v_existing_id
  from app.onboarding_project
  where user_id = v_user_id
  limit 1
  for update;

  if v_existing_id is not null then
    v_policy := app.onboarding_restart_policy(v_user_id);

    if (v_policy ->> 'allowed')::boolean is not true then
      raise exception 'restart_not_allowed: % (%)',
        v_policy ->> 'reason', v_policy::text
        using errcode = 'P0001';
    end if;
  end if;

  insert into app.onboarding_project (
    user_id, mode, company_name, business_model, brand_industry,
    market, website_input, website_url, website_domain, timezone,
    run_token, status, status_phase, status_label, progress_percent,
    last_error, summary, team_id
  ) values (
    v_user_id, p_mode, nullif(btrim(p_company_name), ''), p_business_model,
    null,                                   -- brand_industry: ermittelt der Workflow
    nullif(btrim(p_market), ''), btrim(p_website), v_url, v_domain,
    nullif(btrim(p_timezone), ''),
    v_token, 'submitted', 1, 'Initializing project', 5,
    null, null, null
  )
  on conflict (user_id) do update set
    mode             = excluded.mode,
    company_name     = excluded.company_name,
    business_model   = excluded.business_model,
    brand_industry   = null,
    market           = excluded.market,
    website_input    = excluded.website_input,
    website_url      = excluded.website_url,
    website_domain   = excluded.website_domain,
    timezone         = excluded.timezone,
    run_token        = excluded.run_token,
    status           = 'submitted',
    status_phase     = 1,
    status_label     = 'Initializing project',
    progress_percent = 5,
    last_error       = null,
    summary          = null,
    team_id          = null,      -- Rueckverweis loesen; das alte Team bleibt bestehen
    -- Reste eines abgebrochenen Checkouts. Ohne das behaelt ein neu
    -- gestartetes Onboarding den Plan und die Stripe-Session des alten
    -- Anlaufs - die UI wuerde einen Plan als gewaehlt anzeigen, der zu
    -- diesem Lauf nie gehoert hat.
    selected_billing_plan_id   = null,
    billing_interval           = null,
    stripe_checkout_session_id = null,
    stripe_checkout_url        = null,
    run_group_uuid             = null,
    updated_at       = now()
  returning id into v_id;

  -- Ergebnisse eines vorherigen Laufs entfernen (Reihenfolge wegen FKs)
  delete from app.onboarding_suggested_prompt      where onboarding_id = v_id;
  delete from app.onboarding_candidate_topic       where onboarding_id = v_id;
  delete from app.onboarding_candidate_competitor  where onboarding_id = v_id;

  -- Restart protokollieren. Das ist gleichzeitig der Zaehler fuer das Limit -
  -- deshalb NUR schreiben, wenn es wirklich ein Neustart war.
  if v_existing_id is not null then
    insert into app.onboarding_status_log (
      onboarding_id, status, status_phase, status_label, progress_percent, note
    ) values (
      v_id, 'submitted'::app.onboarding_status, 1, 'Initializing project', 5, 'restart'
    );
  end if;

  return query
  select v_id, v_token, 'submitted'::text, v_url, v_domain;
end
$function$
;

-- Helfer zuletzt (die alten Definitionen oben nutzen sie nicht mehr)
drop function if exists app._onb_text_v1(text,integer,text);
drop function if exists app._onb_soft_v1(text,integer,boolean);
drop function if exists app._onb_host_try_v1(text);
drop function if exists app._onb_host_v1(text);
drop function if exists app._onb_bm_v1(text);
drop function if exists app._onb_bm_code_v1(text);
drop function if exists app._onb_phase_label_v1(integer);
drop function if exists app._onb_phase_pct_v1(integer);
drop function if exists app._onb_topic_colors_v1(integer,text[]);
drop function if exists app._onb_rl_v1(uuid,text,integer);
drop function if exists app._onb_trial_eligible_v1(uuid,text);
drop function if exists app._onb_restart_v1(uuid);
drop function if exists app._onb_selection_key_v1(uuid);
drop function if exists app._onb_row_v1(uuid,uuid,boolean);
drop function if exists app._onb_uid_v1();

commit;

-- Testabfrage
select md5(pg_get_functiondef('app.onboarding_submit(uuid)'::regprocedure)) as submit_md5_5d883157,
       md5(pg_get_functiondef('app.onboarding_broadcast_status()'::regprocedure)) as broadcast_md5_59733c56,
       md5(pg_get_functiondef('app.onboarding_start_v1(text,text,text,text,text,app.account_mode)'::regprocedure)) as start_md5_8d0788f9,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'app' and p.proname like '\_onb\_%') as onb_helfer_0,
       (select count(*) from cron.job where jobname = 'onboarding-reaper') as reaper_0;
