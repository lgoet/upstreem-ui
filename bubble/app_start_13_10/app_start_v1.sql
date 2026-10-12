-- =============================================================================
-- App-Start v1 (13.10.2026)  –  als EIN Block ausführen (nach app_start_sofort.sql)
-- Rückweg: app_start_v1_rueckweg.sql
-- Vertrag: APP_START_V1_VERTRAG.md
--
-- Neu (nichts Bestehendes wird geändert, außer einer neuen Spalte):
--   _team_access_v2(p_team)                   Zugangszustand, richtig gerechnet
--   app_start_v1(p_team_hint)                 alles fürs erste Bild, schreibt nichts
--   team_context_v1(p_team, p_parts)          Speicher des Teams (brands, topics, markets, models, events)
--   markets_all_v1()                          globale Marktliste
--   team_switch_v1(p_team)                    einziger Weg, der last_team_id aus der App schreibt
--   user_notification_v1(p_team)              eine Benachrichtigung, cta_url nur https
--   user_notification_dismiss_v1(p_id, p_reason)
--   user_settings_set_v1(p_key, p_value)      zunächst nur theme
--   user_notification_dismissal.reason        neue Spalte (close | secondary | primary)
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 0  Spalte
-- -----------------------------------------------------------------------------
alter table app.user_notification_dismissal add column if not exists reason text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_notification_dismissal_reason_check') then
    alter table app.user_notification_dismissal add constraint user_notification_dismissal_reason_check
      check (reason is null or reason in ('close', 'secondary', 'primary'));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1  Zugangszustand (die alte team_access bleibt unverändert; viele Funktionen hängen daran)
--    has_access ist nur ausdrücklich false gesperrt.
--    access_state: active | canceling | trial_ended | past_due | unpaid | ended | no_plan | deleted
-- -----------------------------------------------------------------------------
create or replace function app._team_access_v2(p_team uuid)
returns table(has_access boolean, access_state text, access_ended_at timestamptz)
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
  select x.has_access, x.access_state, x.access_ended_at
  from (
    select
      case
        when coalesce(t.is_deleted, false)                                   then false
        when tb.team_id is null and t.billing_plan_id is null               then false
        when tb.team_id is null                                              then true   -- Plan ohne Stripe (Legacy, manuell)
        when tb.status = 'active'                                            then true
        when tb.status = 'trialing'
             and (tb.trial_ends_at is null or tb.trial_ends_at > now() - interval '1 day') then true
        when tb.access_ends_at is not null and tb.access_ends_at > now()     then true
        else false
      end as has_access,
      case
        when coalesce(t.is_deleted, false)                                   then 'deleted'
        when tb.team_id is null and t.billing_plan_id is null               then 'no_plan'
        when tb.team_id is null                                              then 'active'
        when tb.status = 'active' and coalesce(tb.cancel_at_period_end, false) then 'canceling'
        when tb.status = 'active'                                            then 'active'
        when tb.status = 'trialing'
             and (tb.trial_ends_at is null or tb.trial_ends_at > now() - interval '1 day')
             and coalesce(tb.cancel_at_period_end, false)                    then 'canceling'
        when tb.status = 'trialing'
             and (tb.trial_ends_at is null or tb.trial_ends_at > now() - interval '1 day') then 'active'
        when tb.status = 'trialing'                                          then 'trial_ended'
        when tb.status = 'unpaid'                                            then 'unpaid'
        when tb.status in ('past_due', 'incomplete')                         then 'past_due'
        when tb.access_ends_at is not null and tb.access_ends_at > now()     then 'canceling'
        else 'ended'
      end as access_state,
      case
        when coalesce(t.is_deleted, false) then coalesce(t.deleted_at, t.deletion_requested_at)
        when tb.team_id is null then null
        when tb.status = 'active' and coalesce(tb.cancel_at_period_end, false) then coalesce(tb.access_ends_at, tb.current_period_end)
        when tb.status in ('active') then null
        when tb.status = 'trialing' and (tb.trial_ends_at is null or tb.trial_ends_at > now() - interval '1 day') then
          case when coalesce(tb.cancel_at_period_end, false) then coalesce(tb.access_ends_at, tb.trial_ends_at) end
        else coalesce(tb.access_ends_at, tb.ended_at, tb.canceled_at, tb.trial_ends_at)
      end as access_ended_at
    from app.team t
    left join app.team_billing tb on tb.team_id = t.id
    where t.id = p_team
  ) x
$function$;

-- -----------------------------------------------------------------------------
-- 2  Bausteine des Starts (intern, keine Rechte)
-- -----------------------------------------------------------------------------
create or replace function app._app_user_v1(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'id',           u.id,
    'email',        u.email,
    'display_name', nullif(left(btrim(regexp_replace(coalesce(
                      u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name',
                      u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'Display name', ''),
                      '[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]', '', 'g')), 100), ''),
    'avatar_url',   case when length(x.a) <= 2000 then x.a end)
  from auth.users u
  cross join lateral (select app._br_https_v1(coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')) a) x
  where u.id = p_uid
$function$;

-- Teams des Nutzers: gelöschte nur für den Owner (zum Wiederherstellen)
create or replace function app._app_teams_v1(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'name', coalesce(nullif(btrim(tbp.name_override), ''), t.name),
           'domain', nullif(t.domain, ''),
           'favicon_url', app._br_logo_v1('own', tbp.logo_override_url, c.favicon_url,
                                          coalesce(app._br_url_host_v1(c.url), app._br_url_host_v1(t.domain))),
           'role', tm.role::text,
           'has_access', ta.has_access,
           'access_state', ta.access_state,
           'created_at', t.created_at)
         order by t.created_at, t.id), '[]'::jsonb)
  from app.team_member tm
  join app.team t on t.id = tm.team_id
  left join app.team_company tc on tc.team_id = t.id and tc.role = 'own'
  left join app.company c on c.id = tc.company_id
  left join app.team_brand_profile tbp on tbp.team_id = t.id and tbp.company_id = tc.company_id
  cross join lateral app._team_access_v2(t.id) ta
  where tm.user_id = p_uid
    and (not coalesce(t.is_deleted, false) or tm.role::text = 'owner')
$function$;

-- Das aktive Team: Rolle, eigene Marke, Standardmarkt, Zugang, Quota
create or replace function app._app_team_row_v1(p_uid uuid, p_team uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  t   app.team;
  bp  app.billing_plan;
  v_role text;
  v_own jsonb;
  ta  record;
  v_interval text;
  v_used int; v_comp int; v_models int;
  v_name text;
begin
  select tm.role::text into v_role from app.team_member tm where tm.team_id = p_team and tm.user_id = p_uid;
  if v_role is null then
    return null;
  end if;
  select * into t from app.team where id = p_team;
  select * into bp from app.billing_plan where id = t.billing_plan_id;
  select * into ta from app._team_access_v2(p_team);
  select tb.billing_interval into v_interval from app.team_billing tb where tb.team_id = p_team;
  select e into v_own from jsonb_array_elements(app._br_brands_v1(p_team)) e where e ->> 'role' = 'own' limit 1;
  select count(*)::int into v_used from app.prompt p where p.team_id = p_team and p.is_active;
  select count(*)::int into v_comp from app.team_company tc join app.company c on c.id = tc.company_id
   where tc.team_id = p_team and tc.role = 'competitor' and c.is_active;
  select count(*)::int into v_models from app.team_model_setting s where s.team_id = p_team and s.enabled;
  -- Anzeigename wie in der Teamliste: Override der eigenen Marke, sonst team.name
  v_name := coalesce((select nullif(btrim(tbp.name_override), '') from app.team_brand_profile tbp
                      join app.team_company tc on tc.team_id = tbp.team_id and tc.company_id = tbp.company_id and tc.role = 'own'
                      where tbp.team_id = t.id limit 1), t.name);

  return jsonb_build_object(
    'team_id',   t.id,
    'team_name', v_name,
    'role',      v_role,
    'own_brand', case when v_own is null then null else jsonb_build_object(
                   'company_id', v_own -> 'company_id', 'name', v_own -> 'name', 'logo_url', v_own -> 'logo_url',
                   'domain', v_own -> 'domain', 'color', v_own -> 'color') end,
    'default_market', (select jsonb_build_object('alpha2', m.alpha2, 'name', m.name, 'flag_url', m.flag_url)
                       from app.markets m where m.alpha2 = t.default_market),
    'timezone',  t.timezone,
    'access', jsonb_build_object(
      'team_id', t.id, 'team_name', v_name,
      'has_access', ta.has_access, 'access_state', ta.access_state, 'access_ended_at', ta.access_ended_at,
      'can_manage_billing', v_role in ('owner', 'admin'),
      'plan_id', bp.id, 'plan_name', bp.name, 'billing_interval', v_interval,
      'monthly_price_eur', bp.monthly_price_eur, 'yearly_price_eur', bp.yearly_price_eur),
    'quota', jsonb_build_object(
      'used', v_used, 'total', bp.prompts_per_day, 'plan', bp.name,
      'competitors_used', v_comp, 'competitors_total', bp.competitors_max_active,
      'models_used', v_models, 'models_total', bp.models_max_active));
end
$function$;

-- Antwort bauen. p_forced: Team aus team_switch_v1 (schon geprüft). Sonst Regel hint > last > first.
create or replace function app._app_start_build_v1(p_uid uuid, p_hint uuid, p_forced uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_teams jsonb := app._app_teams_v1(p_uid);
  v_last  uuid;
  v_theme text;
  v_active uuid;
  v_reason text := 'none';
begin
  select us.last_team_id, us.theme::text into v_last, v_theme from app.user_settings us where us.user_id = p_uid;

  if p_forced is not null and exists (select 1 from jsonb_array_elements(v_teams) e where (e ->> 'id')::uuid = p_forced) then
    v_active := p_forced; v_reason := 'last';
  end if;
  if v_active is null and p_hint is not null and exists (
       select 1 from jsonb_array_elements(v_teams) e where (e ->> 'id')::uuid = p_hint and e ->> 'access_state' <> 'deleted') then
    v_active := p_hint; v_reason := 'hint';
  end if;
  if v_active is null and v_last is not null and exists (
       select 1 from jsonb_array_elements(v_teams) e where (e ->> 'id')::uuid = v_last and e ->> 'access_state' <> 'deleted') then
    v_active := v_last; v_reason := 'last';
  end if;
  if v_active is null then
    select (e ->> 'id')::uuid into v_active from jsonb_array_elements(v_teams) with ordinality x(e, i)
    where (e ->> 'has_access')::boolean and e ->> 'access_state' <> 'deleted' order by i limit 1;
    if v_active is not null then v_reason := 'first'; end if;
  end if;
  if v_active is null then
    select (e ->> 'id')::uuid into v_active from jsonb_array_elements(v_teams) with ordinality x(e, i)
    where e ->> 'access_state' <> 'deleted' order by i limit 1;
    if v_active is not null then v_reason := 'first'; end if;
  end if;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'user', app._app_user_v1(p_uid),
      'settings', jsonb_build_object('theme', coalesce(v_theme, 'system')),
      'teams', v_teams,
      'active_team_id', v_active,
      'active_reason', v_reason,
      'data_as_of', now()),
    'row', case when v_active is null then null else app._app_team_row_v1(p_uid, v_active) end);
end
$function$;

create or replace function app._app_uid_v1()
returns uuid
language plpgsql
stable
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'app_not_authenticated' using errcode = '28000';
  end if;
  return v;
end
$function$;

-- -----------------------------------------------------------------------------
-- 3  Öffentliche Funktionen (authenticated)
-- -----------------------------------------------------------------------------

-- 3.1 Start: schreibt nichts (außer dem Ratenlimit-Zähler)
create or replace function app.app_start_v1(p_team_hint uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare v_uid uuid := app._app_uid_v1();
begin
  perform app._pi_rate_limit_v1('app_start', 60, 'app');
  return app._app_start_build_v1(v_uid, p_team_hint, null);
end
$function$;

-- 3.2 Teamwechsel: der einzige Weg, der last_team_id aus der App schreibt
create or replace function app.team_switch_v1(p_team uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := app._app_uid_v1();
  v_role text;
  v_deleted boolean;
begin
  perform app._pi_rate_limit_v1('app_switch', 30, 'app');
  if p_team is null then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_team';
  end if;
  select tm.role::text, coalesce(t.is_deleted, false) into v_role, v_deleted
  from app.team_member tm join app.team t on t.id = tm.team_id
  where tm.team_id = p_team and tm.user_id = v_uid;
  if v_role is null or (v_deleted and v_role <> 'owner') then
    raise exception 'team_forbidden' using errcode = '42501';
  end if;
  insert into app.user_settings (user_id, last_team_id, updated_at)
  values (v_uid, p_team, now())
  on conflict (user_id) do update set last_team_id = excluded.last_team_id, updated_at = now()
  where app.user_settings.last_team_id is distinct from excluded.last_team_id;
  return app._app_start_build_v1(v_uid, null, p_team);
end
$function$;

-- 3.3 Speicher des Teams. p_parts ⊂ brands, topics, markets, models, events (null = alle)
create or replace function app.team_context_v1(p_team uuid, p_parts text[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := app._app_uid_v1();
  v_parts text[] := coalesce(p_parts, array['brands', 'topics', 'markets', 'models', 'events']);
  ta record;
  v_row jsonb := '{}'::jsonb;
  v_plan uuid;
begin
  perform app._pi_rate_limit_v1('app_context', 120, 'app');
  if p_team is null then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_team';
  end if;
  if cardinality(v_parts) = 0 or exists (select 1 from unnest(v_parts) x
       where x is null or x not in ('brands', 'topics', 'markets', 'models', 'events')) then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_parts';
  end if;
  if not exists (select 1 from app.team_member tm where tm.team_id = p_team and tm.user_id = v_uid) then
    raise exception 'team_forbidden' using errcode = '42501';
  end if;
  select * into ta from app._team_access_v2(p_team);
  if not coalesce(ta.has_access, false) then
    raise exception '%', 'team_access_' || coalesce(ta.access_state, 'no_plan')
      using errcode = 'PT402', hint = coalesce(ta.access_state, 'no_plan');
  end if;

  if 'brands' = any(v_parts) then
    v_row := v_row || jsonb_build_object('brands', app._br_brands_v1(p_team));
  end if;

  if 'topics' = any(v_parts) then
    v_row := v_row || jsonb_build_object('topics', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id, 'name', g.name, 'emoji', g.emoji, 'hex_light', g.hex_light, 'hex_dark', g.hex_dark,
               'is_active', g.is_active, 'prompt_count', coalesce(u.cnt, 0), 'created_at', g.created_at)
             order by g.created_at desc, g.id)
      from app.tag g
      left join (select pt.tag_id, count(distinct pt.prompt_id)::int cnt
                 from app.prompt_tag pt join app.prompt p on p.id = pt.prompt_id and p.team_id = p_team
                 group by pt.tag_id) u on u.tag_id = g.id
      where g.team_id = p_team), '[]'::jsonb));
  end if;

  if 'markets' = any(v_parts) then
    v_row := v_row || jsonb_build_object('markets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'alpha2', x.market, 'name', coalesce(m.name, x.market), 'flag_url', m.flag_url,
               'region', m.region, 'subregion', m.subregion,
               'prompt_count', x.cnt, 'last_used_at', x.last_used_at)
             order by x.cnt desc, x.market)
      from (select p.market, count(*)::int cnt, max(p.created_at) last_used_at
            from app.prompt p
            where p.team_id = p_team and p.is_active and nullif(btrim(p.market), '') is not null
            group by p.market) x
      left join app.markets m on m.alpha2 = x.market), '[]'::jsonb));
  end if;

  if 'models' = any(v_parts) then
    if exists (select 1 from app.team_model_setting s where s.team_id = p_team) then
      v_row := v_row || jsonb_build_object('models', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'key', mc.key, 'display_name', mc.display_name, 'logo_url', mc.logo_url, 'provider', mc.provider,
                 'is_active', mc.is_active, 'color_lightmode', mc.color_lightmode, 'color_darkmode', mc.color_darkmode)
               order by mc.sort_order, mc.display_name)
        from app.team_model_setting s join app.llm_model_catalog mc on mc.key = s.model_key
        where s.team_id = p_team and s.enabled), '[]'::jsonb));
    else
      -- noch keine Team-Einstellung: Modelle des Plans (ohne etwas anzulegen)
      select t.billing_plan_id into v_plan from app.team t where t.id = p_team;
      v_row := v_row || jsonb_build_object('models', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'key', mc.key, 'display_name', mc.display_name, 'logo_url', mc.logo_url, 'provider', mc.provider,
                 'is_active', mc.is_active, 'color_lightmode', mc.color_lightmode, 'color_darkmode', mc.color_darkmode)
               order by mc.sort_order, mc.display_name)
        from app.billing_plan_model bpm join app.llm_model_catalog mc on mc.key = bpm.model_key
        where bpm.billing_plan_id = v_plan and bpm.enabled and mc.is_active), '[]'::jsonb));
    end if;
  end if;

  if 'events' = any(v_parts) then
    v_row := v_row || jsonb_build_object('events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'event_date', to_char(e.event_date, 'YYYY-MM-DD'), 'name', e.name,
               'event_type', e.event_type, 'color', e.color, 'icon', e.icon)
             order by e.event_date desc, e.created_at desc)
      from app.impact_event e where e.team_id = p_team), '[]'::jsonb));
  end if;

  return jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'parts', to_jsonb(v_parts), 'data_as_of', now()),
    'row', v_row);
end
$function$;

-- 3.4 Globale Marktliste
create or replace function app.markets_all_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
begin
  perform app._app_uid_v1();
  return jsonb_build_object(
    'meta', jsonb_build_object('count', (select count(*) from app.markets), 'data_as_of', now()),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
                        'alpha2', m.alpha2, 'name', m.name, 'flag_url', m.flag_url, 'region', m.region,
                        'subregion', m.subregion, 'language_code', m.language_code) order by m.name)
                      from app.markets m), '[]'::jsonb));
end
$function$;

-- 3.5 Benachrichtigung: höchstens eine; cta_url nur https; fremdes Team = wie ohne Team
create or replace function app.user_notification_v1(p_team uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := app._app_uid_v1();
  v_team uuid := p_team;
  v_plan uuid;
  r record;
begin
  if v_team is not null and not exists (select 1 from app.team_member tm where tm.team_id = v_team and tm.user_id = v_uid) then
    v_team := null;
  end if;
  select t.billing_plan_id into v_plan from app.team t where t.id = v_team;
  select n.* into r
  from app.user_notification n
  where n.is_active and n.starts_at <= now() and (n.ends_at is null or n.ends_at > now())
    and not exists (select 1 from app.user_notification_dismissal d where d.user_id = v_uid and d.notification_id = n.id)
    and (n.target_team_ids is null or cardinality(n.target_team_ids) = 0 or v_team = any(n.target_team_ids))
    and (n.target_plan_ids is null or cardinality(n.target_plan_ids) = 0 or v_plan = any(n.target_plan_ids))
  order by n.priority desc, n.starts_at desc, n.created_at desc, n.id desc
  limit 1;
  return jsonb_build_object(
    'meta', jsonb_build_object('team_id', v_team, 'data_as_of', now()),
    'row', case when r.id is null then null else jsonb_build_object(
      'id', r.id, 'title', r.title, 'body', r.body,
      'color', case when r.color ~ '^#[0-9A-Fa-f]{6}$' then r.color else '#2384e2' end,
      'cta_label', r.cta_label,
      'cta_url', case when r.cta_url ~ '^https://[^\s<>"''`]+$' and length(r.cta_url) <= 2000 then r.cta_url end,
      'notification_type', r.notification_type, 'priority', r.priority, 'created_at', r.created_at) end);
end
$function$;

-- 3.6 Wegklicken: nur Benachrichtigungen, die dem Nutzer gezeigt werden dürfen
create or replace function app.user_notification_dismiss_v1(p_id uuid, p_reason text default 'close')
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare v_uid uuid := app._app_uid_v1();
begin
  perform app._pi_rate_limit_v1('app_notification', 30, 'app');
  if p_reason is null or p_reason not in ('close', 'secondary', 'primary') then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_reason';
  end if;
  if p_id is null or not exists (
       select 1 from app.user_notification n
       where n.id = p_id and n.is_active and n.starts_at <= now() and (n.ends_at is null or n.ends_at > now())
         and (n.target_team_ids is null or cardinality(n.target_team_ids) = 0
              or exists (select 1 from app.team_member tm where tm.user_id = v_uid and tm.team_id = any(n.target_team_ids)))
         and (n.target_plan_ids is null or cardinality(n.target_plan_ids) = 0
              or exists (select 1 from app.team_member tm join app.team t on t.id = tm.team_id
                         where tm.user_id = v_uid and t.billing_plan_id = any(n.target_plan_ids)))) then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_id';
  end if;
  insert into app.user_notification_dismissal (user_id, notification_id, reason)
  values (v_uid, p_id, p_reason)
  on conflict (user_id, notification_id) do nothing;
  return jsonb_build_object('meta', jsonb_build_object('notification_id', p_id, 'reason', p_reason), 'row', null);
end
$function$;

-- 3.7 Einstellungen: zunächst nur theme
create or replace function app.user_settings_set_v1(p_key text, p_value text)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := app._app_uid_v1();
  v_theme text;
begin
  perform app._pi_rate_limit_v1('app_settings', 30, 'app');
  if p_key is distinct from 'theme' then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_key';
  end if;
  if p_value is null or p_value not in ('dark', 'light', 'system') then
    raise exception 'app_invalid_param' using errcode = '22023', hint = 'p_value';
  end if;
  insert into app.user_settings (user_id, theme, updated_at)
  values (v_uid, p_value::app.theme_pref, now())
  on conflict (user_id) do update set theme = excluded.theme, updated_at = now()
  returning theme::text into v_theme;
  return jsonb_build_object('meta', jsonb_build_object('key', 'theme'), 'row', jsonb_build_object('theme', v_theme));
end
$function$;

-- -----------------------------------------------------------------------------
-- 4  Rechte
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['app._team_access_v2(uuid)', 'app._app_user_v1(uuid)', 'app._app_teams_v1(uuid)',
    'app._app_team_row_v1(uuid,uuid)', 'app._app_start_build_v1(uuid,uuid,uuid)', 'app._app_uid_v1()'] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  foreach f in array array['app.app_start_v1(uuid)', 'app.team_switch_v1(uuid)', 'app.team_context_v1(uuid,text[])',
    'app.markets_all_v1()', 'app.user_notification_v1(uuid)', 'app.user_notification_dismiss_v1(uuid,text)',
    'app.user_settings_set_v1(text,text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

commit;

-- =============================================================================
-- Testabfrage
-- =============================================================================
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app'
    and p.proname in ('_team_access_v2', '_app_user_v1', '_app_teams_v1', '_app_team_row_v1', '_app_start_build_v1', '_app_uid_v1',
                      'app_start_v1', 'team_switch_v1', 'team_context_v1', 'markets_all_v1', 'user_notification_v1',
                      'user_notification_dismiss_v1', 'user_settings_set_v1')) as funktionen_13,
  has_function_privilege('authenticated', 'app.app_start_v1(uuid)', 'execute') as start_authed,
  not has_function_privilege('anon', 'app.app_start_v1(uuid)', 'execute') as start_kein_anon,
  not has_function_privilege('authenticated', 'app._team_access_v2(uuid)', 'execute') as helfer_intern,
  (select count(*) from information_schema.columns where table_schema = 'app' and table_name = 'user_notification_dismissal' and column_name = 'reason') as spalte_reason_1;
