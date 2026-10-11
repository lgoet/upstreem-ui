-- settings_v1_rest_rueckweg.sql (11.10.2026): macht settings_v1_rest.sql rueckgaengig.
-- Als EIN Block ausfuehren. Nur noetig, wenn etwas nicht passt.
-- Vorher die Edge Functions team-invite-send und team-billing-portal nicht mehr aufrufen (sie liefern sonst settings_failed).
--
-- Was passiert:
--   1. Die neuen Funktionen werden entfernt.
--   2. _invite_find_id_v1 und team_invites_v1 bekommen ihre alte Definition (Stand vor settings_v1_rest.sql).
--   3. Der alte Status-Check kommt zurueck, als NOT VALID: vorhandene Zeilen mit 'send_failed' bleiben unangetastet
--      (keine Daten werden geaendert), neue Zeilen muessen wieder die alten Werte haben.
--   4. Die neuen Felder an app.team_invite BLEIBEN (Regel: nichts entfernen; sie stoeren die alten Funktionen nicht,
--      alle haben Standardwerte).

begin;

drop function if exists app.team_invite_create_v1(uuid, text, text, text);
drop function if exists app.team_invite_resend_v1(uuid, uuid, text);
drop function if exists app.team_invite_revoke_v1(uuid, uuid);
drop function if exists app._team_invite_mark_sent_v1(uuid, text, uuid);
drop function if exists app._team_invite_send_failed_v1(uuid, text, text, uuid);
drop function if exists app.team_member_remove_v1(uuid, uuid);
drop function if exists app.team_member_role_v1(uuid, uuid, text);
drop function if exists app.billing_portal_prepare_v1(uuid);
drop function if exists app.team_leave_v1(uuid, text);
drop function if exists app.team_delete_v1(uuid, text);
drop function if exists app._set_next_team_v1(uuid, uuid);
drop function if exists app._set_confirm_name_v1(uuid, text);
drop function if exists app._set_reauth_v1(integer);
drop function if exists app._set_wait_seconds_v1(timestamptz);

-- alte Definition (vor settings_v1_rest.sql)
CREATE OR REPLACE FUNCTION app._invite_find_id_v1(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'app', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_id uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select ti.id into v_id
  from app.team_invite ti
  where ti.token_hash = p_token
     or ti.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  order by ti.created_at desc
  limit 1;
  return v_id;
end;
$function$;

-- alte Definition (Stand settings_v1_lesen.sql)
CREATE OR REPLACE FUNCTION app.team_invites_v1(p_team uuid, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
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
    select ti.*,
           case when ti.status = 'pending' and ti.expires_at <= now() then 'expired' else ti.status end as status_eff,
           (select count(*) from app.team_audit_log l
             where l.team_id = ti.team_id and l.meta->>'invite_id' = ti.id::text
               and (l.event_type = 'invite_resent' or (l.event_type = 'member_invited' and l.meta->>'action' = 'resent')))::int as resent_n,
           (select max(l.created_at) from app.team_audit_log l
             where l.team_id = ti.team_id and l.event_type in ('member_invited', 'invite_resent')
               and l.meta->>'invite_id' = ti.id::text) as last_log_at
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
  select coalesce(jsonb_agg(jsonb_build_object(
           'invite_id', i.id,
           'invited_email', lower(i.invited_email),
           'invited_role', lower(i.invited_role),
           'status', i.status_eff,
           'created_at', i.created_at,
           'created_by_email', (select lower(u.email::text) from auth.users u where u.id = i.created_by),
           'expires_at', i.expires_at,
           'resend_count', i.resent_n,
           'last_sent_at', coalesce(i.last_log_at, i.created_at),
           'send_state', case when i.status_eff = 'send_failed' then 'failed' else 'sent' end)
         order by (i.status_eff = 'pending') desc, i.created_at desc, i.id desc), '[]'::jsonb)
    into v_rows
  from sel i;

  select count(*) into v_open from app.team_invite ti
  where ti.team_id = p_team and ti.status = 'pending' and ti.expires_at > now();

  return app.js_safe(jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'count', jsonb_array_length(v_rows), 'open_count', v_open,
                               'status', coalesce(v_status, 'all')),
    'rows', v_rows));
end;
$function$;

-- team_invites_v1 nutzt _set_invite_row_v1 jetzt nicht mehr, darum erst hier entfernen
drop function if exists app._set_invite_row_v1(uuid);

alter table app.team_invite drop constraint team_invite_status_check;
alter table app.team_invite add constraint team_invite_status_check
  check (status = any (array['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text])) not valid;

commit;

-- Kontrolle: alle neuen Funktionen weg (0 Zeilen), team_invites_v1 und _invite_find_id_v1 da
select p.oid::regprocedure::text as noch_da
from pg_proc p
where p.pronamespace = 'app'::regnamespace
  and p.proname in ('team_invite_create_v1', 'team_invite_resend_v1', 'team_invite_revoke_v1', '_team_invite_mark_sent_v1',
                    '_team_invite_send_failed_v1', 'team_member_remove_v1', 'team_member_role_v1', 'billing_portal_prepare_v1',
                    'team_leave_v1', 'team_delete_v1', '_set_next_team_v1', '_set_confirm_name_v1', '_set_reauth_v1',
                    '_set_wait_seconds_v1', '_set_invite_row_v1');
