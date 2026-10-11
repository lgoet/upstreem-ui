-- settings_v1_rest.sql (11.10.2026), Settings v1 Schritte 3 bis 6
-- Als EIN Block im Supabase SQL Editor ausfuehren. Laeuft in einer Transaktion: geht etwas schief, bleibt alles wie vorher.
-- Voraussetzung: settings_v1_lesen.sql und settings_v1_brand.sql sind drin (wird unten geprueft).
-- Rueckweg: settings_v1_rest_rueckweg.sql
--
-- Neu (alle security definer, search_path fest, Nutzer aus dem JWT):
--   Einladen:   team_invite_create_v1, team_invite_resend_v1, team_invite_revoke_v1, team_invites_v1 (ersetzt)
--               _team_invite_mark_sent_v1, _team_invite_send_failed_v1 (nur service_role, fuer Edge Function team-invite-send)
--   Mitglieder: team_member_remove_v1, team_member_role_v1
--   Billing:    billing_portal_prepare_v1 (fuer Edge Function team-billing-portal)
--   Verlassen:  team_leave_v1, team_delete_v1
--   Helfer:     _set_reauth_v1, _set_invite_row_v1, _set_wait_seconds_v1, _set_next_team_v1, _set_confirm_name_v1
--   _invite_find_id_v1 (ersetzt): findet auch den neuen Link waehrend "erneut senden"
-- Tabelle app.team_invite: nur neue Felder (send_tracked, sent_at, last_sent_at, send_failed_at, send_error,
--   send_attempts, resend_count, token_hash_next) und Status 'send_failed'. Nichts umbenannt, nichts entfernt.
-- Alte Bubble-Funktionen (create_team_invite_v1, send-team-invite, accept_team_invite_by_token_v2 ...) bleiben unveraendert.

begin;

-- =====================================================================================
-- 0) Bestand pruefen
-- =====================================================================================
do $g$
begin
  if to_regprocedure('app.settings_brand_save_v1(uuid,text,text,text,text,text)') is null then
    raise exception 'settings_v1_rest: settings_v1_brand.sql fehlt. Nichts geaendert.';
  end if;
  if to_regprocedure('app.team_invite_create_v1(uuid,text,text,text)') is not null then
    raise exception 'settings_v1_rest: team_invite_create_v1 gibt es schon. Nichts geaendert.';
  end if;
  if md5(pg_get_functiondef('app._invite_find_id_v1(text)'::regprocedure)) <> '28431056216502d4692789aefcb2b1c6'
     or md5(pg_get_functiondef('app.team_invites_v1(uuid,text)'::regprocedure)) <> '0544701aeb1386dc87ec8726a8619577'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint
         where conrelid = 'app.team_invite'::regclass and conname = 'team_invite_status_check') <> '655723ac2fa2789c49a09defa4bf32d0' then
    raise exception 'settings_v1_rest: Bestand weicht vom gelesenen Stand ab. Nichts geaendert.';
  end if;
end $g$;

-- =====================================================================================
-- 1) Einladungen: Versandstand an der Einladung (Felder nur dazu)
-- =====================================================================================
alter table app.team_invite
  add column send_tracked    boolean not null default false,
  add column sent_at         timestamptz,
  add column last_sent_at    timestamptz,
  add column send_failed_at  timestamptz,
  add column send_error      text,
  add column send_attempts   int not null default 0,
  add column resend_count    int not null default 0,
  add column token_hash_next text;
comment on column app.team_invite.send_tracked is
  'true = angelegt ueber team-invite-send (Versandstand wird gefuehrt). false = alter Weg (Bubble), gilt als versendet.';

alter table app.team_invite drop constraint team_invite_status_check;
alter table app.team_invite add constraint team_invite_status_check
  check (status = any (array['pending', 'accepted', 'revoked', 'expired', 'send_failed']::text[]));

-- Bestand: erneut-gesendet-Zaehler und letzter Versand aus dem Protokoll uebernehmen
update app.team_invite ti
   set resend_count = coalesce(x.n, 0),
       last_sent_at = coalesce(x.last_at, ti.created_at)
  from (select ti2.id,
               (select count(*) from app.team_audit_log l
                 where l.team_id = ti2.team_id and l.meta->>'invite_id' = ti2.id::text
                   and l.event_type = 'member_invited' and l.meta->>'action' = 'resent')::int as n,
               (select max(l.created_at) from app.team_audit_log l
                 where l.team_id = ti2.team_id and l.meta->>'invite_id' = ti2.id::text
                   and l.event_type = 'member_invited') as last_at
        from app.team_invite ti2) x
 where x.id = ti.id;

-- Token-Suche: auch der neue Token eines laufenden Erneut-Sendens gilt
CREATE OR REPLACE FUNCTION app._invite_find_id_v1(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_id   uuid;
  v_hash text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  select ti.id into v_id
  from app.team_invite ti
  where ti.token_hash = p_token
     or ti.token_hash = v_hash
     or ti.token_hash_next = v_hash
  order by ti.created_at desc
  limit 1;
  return v_id;
end;
$function$;

-- =====================================================================================
-- 2) Helfer
-- =====================================================================================
-- Neu anmelden verlangt: juengste Anmeldung (amr.timestamp im JWT) hoechstens p_max_minutes alt
create function app._set_reauth_v1(p_max_minutes int default 15)
 returns void language plpgsql stable security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_amr jsonb := auth.jwt()->'amr';
  v_ts  bigint;
begin
  if jsonb_typeof(v_amr) = 'array' then
    select max((e->>'timestamp')::bigint) into v_ts
    from jsonb_array_elements(v_amr) e
    where e->>'timestamp' ~ '^[0-9]+$';
  end if;
  if v_ts is null or to_timestamp(v_ts) < now() - make_interval(mins => p_max_minutes) then
    raise exception 'settings_reauth_required' using errcode = 'PT403', hint = p_max_minutes::text;
  end if;
end;
$f$;

-- Einladung als Zeile fuer Antworten
create function app._set_invite_row_v1(p_invite uuid)
 returns jsonb language sql stable security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
  select jsonb_build_object(
    'invite_id', ti.id,
    'invited_email', lower(ti.invited_email),
    'invited_role', lower(ti.invited_role),
    'status', case when ti.status = 'pending' and ti.expires_at <= now() then 'expired' else ti.status end,
    'created_at', ti.created_at,
    'created_by_email', (select lower(u.email::text) from auth.users u where u.id = ti.created_by),
    'expires_at', ti.expires_at,
    'resend_count', ti.resend_count,
    'sent_at', case when ti.send_tracked then ti.sent_at else ti.created_at end,
    'last_sent_at', coalesce(ti.last_sent_at, case when ti.send_tracked then ti.sent_at else ti.created_at end),
    'send_state', case
       when ti.status = 'send_failed' then 'failed'
       when not ti.send_tracked then 'sent'
       when ti.sent_at is null then 'unknown'
       else 'sent' end)
  from app.team_invite ti where ti.id = p_invite
$f$;

-- Sekunden, bis eine Tagesgrenze wieder frei ist
create function app._set_wait_seconds_v1(p_oldest timestamptz)
 returns int language sql stable
 set search_path to 'app', 'public', 'pg_temp'
as $f$
  select greatest(1, ceil(extract(epoch from (p_oldest + interval '1 day') - now()))::int)
$f$;

-- =====================================================================================
-- 3) Einladungen (Aufruf ueber die Edge Function team-invite-send, mit dem JWT des Nutzers)
-- =====================================================================================
create function app.team_invite_create_v1(p_team uuid, p_email text, p_role text, p_token_hash text)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user   uuid := auth.uid();
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_role   text := lower(btrim(coalesce(p_role, 'member')));
  v_ex     app.team_invite%rowtype;
  v_id     uuid;
  v_oldest timestamptz;
begin
  perform app._set_require_write_v1(p_team, 'team');
  if v_email = '' or length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or v_email ~ '[<>`\\"'']|\$\{' then
    raise exception 'team_invalid_email' using errcode = '22023';
  end if;
  if v_role not in ('member', 'admin') then
    raise exception 'team_invalid_role' using errcode = '22023', hint = 'member,admin';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_token_hash';
  end if;
  if exists (select 1 from auth.users u join app.team_member tm on tm.user_id = u.id and tm.team_id = p_team
             where lower(u.email) = v_email) then
    raise exception 'team_already_member' using errcode = 'PT409';
  end if;

  update app.team_invite ti set status = 'expired'
  where ti.team_id = p_team and ti.status = 'pending' and ti.expires_at <= now();

  select * into v_ex from app.team_invite ti
  where ti.team_id = p_team and ti.status = 'pending' and lower(ti.invited_email) = v_email
  limit 1;
  if found then
    return jsonb_build_object(
      'meta', jsonb_build_object('team_id', p_team, 'unchanged', true, 'team_name', app._set_team_name_v1(p_team)),
      'row', app._set_invite_row_v1(v_ex.id));
  end if;

  if (select count(*) from app.team_invite ti where ti.team_id = p_team and ti.status = 'pending') >= 50 then
    raise exception 'team_invite_rate_limited' using errcode = 'PT429', hint = '3600';
  end if;
  select min(ti.created_at) into v_oldest from (
    select ti0.created_at from app.team_invite ti0
    where ti0.team_id = p_team and ti0.created_at > now() - interval '1 day'
    order by ti0.created_at desc offset 19 limit 1) ti;
  if v_oldest is not null then
    raise exception 'team_invite_rate_limited' using errcode = 'PT429', hint = app._set_wait_seconds_v1(v_oldest)::text;
  end if;
  select min(ti.created_at) into v_oldest from (
    select ti0.created_at from app.team_invite ti0
    where ti0.created_by = v_user and ti0.created_at > now() - interval '1 day'
    order by ti0.created_at desc offset 29 limit 1) ti;
  if v_oldest is not null then
    raise exception 'team_invite_rate_limited' using errcode = 'PT429', hint = app._set_wait_seconds_v1(v_oldest)::text;
  end if;

  insert into app.team_invite (team_id, invited_email, invited_role, token_hash, status, expires_at, created_by, send_tracked)
  values (p_team, v_email, v_role, p_token_hash, 'pending', now() + interval '7 days', v_user, true)
  returning id into v_id;

  return jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'unchanged', false, 'team_name', app._set_team_name_v1(p_team)),
    'row', app._set_invite_row_v1(v_id));
end;
$f$;

create function app.team_invite_resend_v1(p_team uuid, p_invite_id uuid, p_token_hash_next text)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_inv  app.team_invite%rowtype;
  v_last timestamptz;
begin
  perform app._set_require_write_v1(p_team, 'team');
  if p_token_hash_next is null or p_token_hash_next !~ '^[0-9a-f]{64}$' then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_token_hash_next';
  end if;
  select * into v_inv from app.team_invite ti where ti.id = p_invite_id and ti.team_id = p_team for update;
  if not found then
    raise exception 'team_invite_not_found' using errcode = 'PT404';
  end if;
  -- Abgelaufene Einladungen duerfen erneut gesendet werden (gelten danach wieder 7 Tage),
  -- solange es fuer die Adresse keine andere offene Einladung gibt.
  if v_inv.status not in ('pending', 'expired') then
    raise exception 'team_invite_not_pending' using errcode = 'PT409', hint = v_inv.status;
  end if;
  if exists (select 1 from app.team_invite o
             where o.team_id = p_team and o.id <> v_inv.id and o.status = 'pending' and o.expires_at > now()
               and lower(o.invited_email) = lower(v_inv.invited_email)) then
    raise exception 'team_invite_pending' using errcode = 'PT409', hint = 'other_invite';
  end if;
  if exists (select 1 from auth.users u join app.team_member tm on tm.user_id = u.id and tm.team_id = p_team
             where lower(u.email) = lower(v_inv.invited_email)) then
    raise exception 'team_already_member' using errcode = 'PT409';
  end if;
  if v_inv.resend_count >= 5 then
    raise exception 'team_invite_rate_limited' using errcode = 'PT429', hint = 'max';
  end if;
  v_last := coalesce(v_inv.last_sent_at, v_inv.sent_at, v_inv.created_at);
  if v_last > now() - interval '5 minutes' then
    raise exception 'team_invite_rate_limited' using errcode = 'PT429',
      hint = greatest(1, ceil(extract(epoch from (v_last + interval '5 minutes') - now())))::int::text;
  end if;
  update app.team_invite ti set token_hash_next = p_token_hash_next, send_tracked = true where ti.id = v_inv.id;
  return jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'team_name', app._set_team_name_v1(p_team)),
    'row', app._set_invite_row_v1(v_inv.id));
end;
$f$;

-- Nur Edge Function (service_role): Versand bestaetigen bzw. Fehlschlag festhalten
create function app._team_invite_mark_sent_v1(p_invite_id uuid, p_kind text, p_actor uuid)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_inv app.team_invite%rowtype;
begin
  select * into v_inv from app.team_invite ti where ti.id = p_invite_id for update;
  if not found then
    raise exception 'team_invite_not_found' using errcode = 'PT404';
  end if;
  if p_kind = 'create' then
    update app.team_invite ti
       set sent_at = coalesce(ti.sent_at, now()), last_sent_at = now(), send_attempts = ti.send_attempts + 1, send_error = null
     where ti.id = p_invite_id;
    insert into app.team_audit_log (team_id, actor_user_id, event_type, target_email, meta)
    values (v_inv.team_id, coalesce(p_actor, v_inv.created_by), 'member_invited', lower(v_inv.invited_email),
            jsonb_build_object('invite_id', v_inv.id, 'invited_role', v_inv.invited_role, 'via', 'team-invite-send'));
  elsif p_kind = 'resend' then
    -- abgelaufene Einladung wieder oeffnen; liegengebliebene offene Einladungen derselben Adresse vorher schliessen
    update app.team_invite o set status = 'expired'
     where o.team_id = v_inv.team_id and o.id <> v_inv.id and o.status = 'pending' and o.expires_at <= now()
       and lower(o.invited_email) = lower(v_inv.invited_email);
    update app.team_invite ti
       set status = case when ti.status = 'expired'
                          and not exists (select 1 from app.team_invite o
                                          where o.team_id = ti.team_id and o.id <> ti.id and o.status = 'pending'
                                            and lower(o.invited_email) = lower(ti.invited_email))
                         then 'pending' else ti.status end,
           token_hash = coalesce(ti.token_hash_next, ti.token_hash), token_hash_next = null,
           sent_at = coalesce(ti.sent_at, now()), last_sent_at = now(), resend_count = ti.resend_count + 1,
           send_attempts = ti.send_attempts + 1, expires_at = now() + interval '7 days', send_error = null
     where ti.id = p_invite_id;
    insert into app.team_audit_log (team_id, actor_user_id, event_type, target_email, meta)
    values (v_inv.team_id, coalesce(p_actor, v_inv.created_by), 'invite_resent', lower(v_inv.invited_email),
            jsonb_build_object('invite_id', v_inv.id, 'resend_count', v_inv.resend_count + 1));
  else
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_kind';
  end if;
  return jsonb_build_object('ok', true, 'row', app._set_invite_row_v1(p_invite_id));
end;
$f$;

create function app._team_invite_send_failed_v1(p_invite_id uuid, p_kind text, p_error text, p_actor uuid)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_inv app.team_invite%rowtype;
begin
  select * into v_inv from app.team_invite ti where ti.id = p_invite_id for update;
  if not found then
    raise exception 'team_invite_not_found' using errcode = 'PT404';
  end if;
  if p_kind = 'create' then
    update app.team_invite ti
       set status = case when ti.status = 'pending' and ti.sent_at is null then 'send_failed' else ti.status end,
           send_failed_at = now(), send_error = left(coalesce(p_error, 'unknown'), 500), send_attempts = ti.send_attempts + 1
     where ti.id = p_invite_id;
  elsif p_kind = 'resend' then
    update app.team_invite ti
       set token_hash_next = null, send_failed_at = now(), send_error = left(coalesce(p_error, 'unknown'), 500),
           send_attempts = ti.send_attempts + 1
     where ti.id = p_invite_id;
  else
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_kind';
  end if;
  insert into app.team_audit_log (team_id, actor_user_id, event_type, target_email, meta)
  values (v_inv.team_id, coalesce(p_actor, v_inv.created_by), 'invite_send_failed', lower(v_inv.invited_email),
          jsonb_build_object('invite_id', v_inv.id, 'kind', p_kind, 'error', left(coalesce(p_error, 'unknown'), 200)));
  return jsonb_build_object('ok', true, 'row', app._set_invite_row_v1(p_invite_id));
end;
$f$;

create function app.team_invite_revoke_v1(p_team uuid, p_invite_id uuid)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_inv  app.team_invite%rowtype;
begin
  v_role := app._set_require_v1(p_team);
  if v_role not in ('owner', 'admin') then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner,admin';
  end if;
  perform app._pi_rate_limit_v1('team_write', 20, 'team');
  select * into v_inv from app.team_invite ti where ti.id = p_invite_id and ti.team_id = p_team for update;
  if not found then
    raise exception 'team_invite_not_found' using errcode = 'PT404';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'team_invite_not_pending' using errcode = 'PT409', hint = v_inv.status;
  end if;
  update app.team_invite ti
     set status = 'revoked', revoked_by = v_user, revoked_at = now(), token_hash_next = null
   where ti.id = p_invite_id;
  insert into app.team_audit_log (team_id, actor_user_id, event_type, target_email, meta)
  values (p_team, v_user, 'invite_revoked', lower(v_inv.invited_email), jsonb_build_object('invite_id', v_inv.id));
  return app.js_safe(jsonb_build_object('meta', jsonb_build_object('team_id', p_team), 'row', app._set_invite_row_v1(p_invite_id)));
end;
$f$;

-- Liste: Versandstand aus den neuen Feldern
CREATE OR REPLACE FUNCTION app.team_invites_v1(p_team uuid, p_status text default null)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $f$
declare
  v_role   text;
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_rows   jsonb;
  v_open   int;
begin
  perform app._pi_rate_limit_v1('team_invites', 60, 'team');
  v_role := app._set_require_v1(p_team);
  if v_role not in ('owner', 'admin') then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner,admin';
  end if;
  if v_status is not null and v_status not in ('open', 'pending', 'accepted', 'revoked', 'expired', 'send_failed') then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_status';
  end if;
  with inv as (
    select ti.id, ti.created_at,
           case when ti.status = 'pending' and ti.expires_at <= now() then 'expired' else ti.status end as status_eff
    from app.team_invite ti
    where ti.team_id = p_team
  ),
  sel as (
    select * from inv
    where (v_status is null and inv.status_eff <> 'send_failed')
       or (v_status in ('open', 'pending') and inv.status_eff = 'pending')
       or inv.status_eff = v_status
    order by (inv.status_eff = 'pending') desc, inv.created_at desc, inv.id desc
    limit 200
  )
  select coalesce(jsonb_agg(app._set_invite_row_v1(s.id)
                   order by (s.status_eff = 'pending') desc, s.created_at desc, s.id desc), '[]'::jsonb)
    into v_rows
  from sel s;
  select count(*) into v_open from app.team_invite ti
  where ti.team_id = p_team and ti.status = 'pending' and ti.expires_at > now();
  return app.js_safe(jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'count', jsonb_array_length(v_rows), 'open_count', v_open,
                               'status', coalesce(v_status, 'all')),
    'rows', v_rows));
end;
$f$;

-- =====================================================================================
-- 4) Mitglieder
-- =====================================================================================
create function app.team_member_remove_v1(p_team uuid, p_user_id uuid)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user   uuid := auth.uid();
  v_role   text;
  v_target text;
  v_owners int;
  v_email  text;
begin
  v_role := app._set_require_v1(p_team);
  if v_role not in ('owner', 'admin') then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner,admin';
  end if;
  perform app._pi_rate_limit_v1('team_write', 20, 'team');
  perform 1 from app.team t where t.id = p_team for update;
  if p_user_id is null then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_user_id';
  end if;
  if p_user_id = v_user then
    raise exception 'team_cannot_remove_self' using errcode = 'PT409', hint = 'team_leave_v1';
  end if;
  select tm.role::text into v_target from app.team_member tm where tm.team_id = p_team and tm.user_id = p_user_id;
  if v_target is null then
    raise exception 'team_member_not_found' using errcode = 'PT404';
  end if;
  if v_role = 'admin' and v_target <> 'member' then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner';
  end if;
  if v_target = 'owner' then
    select count(*) into v_owners from app.team_member tm where tm.team_id = p_team and tm.role::text = 'owner';
    if v_owners <= 1 then
      raise exception 'team_last_owner' using errcode = 'PT409';
    end if;
  end if;
  select lower(u.email::text) into v_email from auth.users u where u.id = p_user_id;
  delete from app.team_member tm where tm.team_id = p_team and tm.user_id = p_user_id;
  update app.user_settings s set last_team_id = null where s.user_id = p_user_id and s.last_team_id = p_team;
  insert into app.team_audit_log (team_id, actor_user_id, event_type, target_user_id, target_email, meta)
  values (p_team, v_user, 'member_removed', p_user_id, v_email, jsonb_build_object('target_role', v_target, 'via', 'team_member_remove_v1'));
  return app.team_members_v1(p_team);
end;
$f$;

create function app.team_member_role_v1(p_team uuid, p_user_id uuid, p_role text)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user   uuid := auth.uid();
  v_role   text;
  v_new    text := lower(btrim(coalesce(p_role, '')));
  v_target text;
  v_owners int;
  v_email  text;
  v_res    jsonb;
begin
  v_role := app._set_require_v1(p_team);
  if v_role not in ('owner', 'admin') then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner,admin';
  end if;
  perform app._pi_rate_limit_v1('team_write', 20, 'team');
  if v_new not in ('member', 'admin', 'owner') then
    raise exception 'team_invalid_role' using errcode = '22023', hint = 'member,admin,owner';
  end if;
  perform 1 from app.team t where t.id = p_team for update;
  if p_user_id is null then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_user_id';
  end if;
  if p_user_id = v_user then
    raise exception 'team_cannot_change_self' using errcode = 'PT409';
  end if;
  select tm.role::text into v_target from app.team_member tm where tm.team_id = p_team and tm.user_id = p_user_id;
  if v_target is null then
    raise exception 'team_member_not_found' using errcode = 'PT404';
  end if;
  if v_role = 'admin' and (v_target = 'owner' or v_new = 'owner') then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner';
  end if;
  if v_target = v_new then
    v_res := app.team_members_v1(p_team);
    return jsonb_build_object('meta', (v_res->'meta') || jsonb_build_object('unchanged', true), 'rows', v_res->'rows');
  end if;
  if v_new = 'owner' then
    perform app._set_reauth_v1(15);
  end if;
  if v_target = 'owner' then
    select count(*) into v_owners from app.team_member tm where tm.team_id = p_team and tm.role::text = 'owner';
    if v_owners <= 1 then
      raise exception 'team_last_owner' using errcode = 'PT409';
    end if;
  end if;
  select lower(u.email::text) into v_email from auth.users u where u.id = p_user_id;
  update app.team_member tm set role = v_new::app.team_role where tm.team_id = p_team and tm.user_id = p_user_id;
  insert into app.team_audit_log (team_id, actor_user_id, event_type, target_user_id, target_email, meta)
  values (p_team, v_user, case when v_new = 'owner' then 'owner_transferred' else 'role_changed' end, p_user_id, v_email,
          jsonb_build_object('from', v_target, 'to', v_new, 'via', 'team_member_role_v1'));
  v_res := app.team_members_v1(p_team);
  return jsonb_build_object('meta', (v_res->'meta') || jsonb_build_object('unchanged', false), 'rows', v_res->'rows');
end;
$f$;

-- =====================================================================================
-- 5) Billing: Portal vorbereiten (Edge Function team-billing-portal)
-- =====================================================================================
create function app.billing_portal_prepare_v1(p_team uuid)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_cust text;
begin
  v_role := app._set_require_v1(p_team);
  if v_role not in ('owner', 'admin') then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner,admin';
  end if;
  perform app._pi_rate_limit_v1('billing_portal', 5, 'billing');
  select coalesce(tb.stripe_customer_id, (select c.stripe_customer_id from app.billing_team_customer c where c.team_id = p_team))
    into v_cust
  from app.team t left join app.team_billing tb on tb.team_id = t.id
  where t.id = p_team;
  if v_cust is null then
    raise exception 'billing_no_customer' using errcode = 'PT409', hint = 'checkout';
  end if;
  insert into app.team_audit_log (team_id, actor_user_id, event_type, meta)
  values (p_team, v_user, 'billing_portal_opened', '{}'::jsonb);
  return jsonb_build_object('meta', jsonb_build_object('team_id', p_team), 'row', jsonb_build_object('stripe_customer_id', v_cust));
end;
$f$;

-- =====================================================================================
-- 6) Verlassen und Loeschen
-- =====================================================================================
create function app._set_next_team_v1(p_user uuid, p_exclude uuid)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_next uuid;
  v_n    int;
begin
  select count(*) into v_n
  from app.team_member tm join app.team t on t.id = tm.team_id
  where tm.user_id = p_user and tm.team_id <> p_exclude and not coalesce(t.is_deleted, false);
  select tm.team_id into v_next
  from app.team_member tm join app.team t on t.id = tm.team_id
  where tm.user_id = p_user and tm.team_id <> p_exclude and not coalesce(t.is_deleted, false)
  order by tm.created_at, tm.team_id
  limit 1;
  insert into app.user_settings (user_id, last_team_id, updated_at) values (p_user, v_next, now())
  on conflict (user_id) do update set last_team_id = excluded.last_team_id, updated_at = now();
  return jsonb_build_object('remaining_teams', v_n, 'next_team_id', v_next);
end;
$f$;

create function app._set_confirm_name_v1(p_team uuid, p_confirm_name text)
 returns void language plpgsql stable security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
begin
  if p_confirm_name is null
     or lower(btrim(p_confirm_name)) is distinct from lower(btrim(coalesce(app._set_team_name_v1(p_team), ''))) then
    raise exception 'team_confirm_name_mismatch' using errcode = '22023', hint = 'p_confirm_name';
  end if;
end;
$f$;

create function app.team_leave_v1(p_team uuid, p_confirm_name text)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user   uuid := auth.uid();
  v_role   text;
  v_owners int;
  v_next   jsonb;
begin
  v_role := app._set_require_v1(p_team);
  perform app._pi_rate_limit_v1('team_write', 20, 'team');
  perform app._set_confirm_name_v1(p_team, p_confirm_name);
  perform 1 from app.team t where t.id = p_team for update;
  if v_role = 'owner' then
    select count(*) into v_owners from app.team_member tm where tm.team_id = p_team and tm.role::text = 'owner';
    if v_owners <= 1 then
      raise exception 'team_last_owner' using errcode = 'PT409', hint = 'transfer_or_delete';
    end if;
  end if;
  delete from app.team_member tm where tm.team_id = p_team and tm.user_id = v_user;
  insert into app.team_audit_log (team_id, actor_user_id, event_type, target_user_id, target_email, meta)
  values (p_team, v_user, 'member_left', v_user, (select lower(u.email::text) from auth.users u where u.id = v_user),
          jsonb_build_object('role', v_role, 'via', 'team_leave_v1'));
  v_next := app._set_next_team_v1(v_user, p_team);
  return jsonb_build_object('meta', jsonb_build_object('team_id', p_team),
                            'row', jsonb_build_object('left', true) || v_next);
end;
$f$;

create function app.team_delete_v1(p_team uuid, p_confirm_name text)
 returns jsonb language plpgsql security definer
 set search_path to 'app', 'public', 'pg_temp'
as $f$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_res  jsonb;
  v_next jsonb;
begin
  v_role := app._set_require_v1(p_team);
  if v_role <> 'owner' then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner';
  end if;
  perform app._pi_rate_limit_v1('team_write', 20, 'team');
  perform app._set_confirm_name_v1(p_team, p_confirm_name);
  perform app._set_reauth_v1(15);
  v_res := app.delete_team_v3(p_team);
  v_next := app._set_next_team_v1(v_user, p_team);
  return jsonb_build_object('meta', jsonb_build_object('team_id', p_team),
                            'row', jsonb_build_object('deleted', true,
                                                      'purge_after', v_res->'purge_after',
                                                      'stripe_cancel', v_res->'stripe_cancel') || v_next);
end;
$f$;

-- =====================================================================================
-- 7) Rechte
-- =====================================================================================
revoke all on function
  app._set_reauth_v1(int), app._set_invite_row_v1(uuid), app._set_wait_seconds_v1(timestamptz),
  app.team_invite_create_v1(uuid, text, text, text), app.team_invite_resend_v1(uuid, uuid, text),
  app._team_invite_mark_sent_v1(uuid, text, uuid), app._team_invite_send_failed_v1(uuid, text, text, uuid),
  app.team_invite_revoke_v1(uuid, uuid),
  app.team_member_remove_v1(uuid, uuid), app.team_member_role_v1(uuid, uuid, text),
  app.billing_portal_prepare_v1(uuid),
  app._set_next_team_v1(uuid, uuid), app._set_confirm_name_v1(uuid, text),
  app.team_leave_v1(uuid, text), app.team_delete_v1(uuid, text)
from public, anon, authenticated;
grant execute on function
  app.team_invite_create_v1(uuid, text, text, text), app.team_invite_resend_v1(uuid, uuid, text),
  app.team_invite_revoke_v1(uuid, uuid),
  app.team_member_remove_v1(uuid, uuid), app.team_member_role_v1(uuid, uuid, text),
  app.billing_portal_prepare_v1(uuid),
  app.team_leave_v1(uuid, text), app.team_delete_v1(uuid, text)
to authenticated, service_role;
grant execute on function
  app._team_invite_mark_sent_v1(uuid, text, uuid), app._team_invite_send_failed_v1(uuid, text, text, uuid)
to service_role;

commit;

-- Kontrolle (soll 17 Zeilen mit ok = true liefern)
select f.sig,
       to_regprocedure(f.sig) is not null as vorhanden,
       coalesce(has_function_privilege('anon', f.sig, 'execute'), false) as anon,
       coalesce(has_function_privilege('authenticated', f.sig, 'execute'), false) as authenticated,
       coalesce(has_function_privilege('service_role', f.sig, 'execute'), false) as service_role,
       to_regprocedure(f.sig) is not null
       and not has_function_privilege('anon', f.sig, 'execute')
       and has_function_privilege('authenticated', f.sig, 'execute') = f.auth
       and has_function_privilege('service_role', f.sig, 'execute') = f.svc as ok
from (values
  ('app.team_invite_create_v1(uuid,text,text,text)', true, true),
  ('app.team_invite_resend_v1(uuid,uuid,text)', true, true),
  ('app.team_invite_revoke_v1(uuid,uuid)', true, true),
  ('app.team_invites_v1(uuid,text)', true, true),
  ('app._team_invite_mark_sent_v1(uuid,text,uuid)', false, true),
  ('app._team_invite_send_failed_v1(uuid,text,text,uuid)', false, true),
  ('app.team_member_remove_v1(uuid,uuid)', true, true),
  ('app.team_member_role_v1(uuid,uuid,text)', true, true),
  ('app.billing_portal_prepare_v1(uuid)', true, true),
  ('app.team_leave_v1(uuid,text)', true, true),
  ('app.team_delete_v1(uuid,text)', true, true),
  ('app._set_reauth_v1(integer)', false, false),
  ('app._set_invite_row_v1(uuid)', false, false),
  ('app._set_wait_seconds_v1(timestamp with time zone)', false, false),
  ('app._set_next_team_v1(uuid,uuid)', false, false),
  ('app._set_confirm_name_v1(uuid,text)', false, false),
  ('app._invite_find_id_v1(text)', false, false)
) f(sig, auth, svc)
order by 1;
