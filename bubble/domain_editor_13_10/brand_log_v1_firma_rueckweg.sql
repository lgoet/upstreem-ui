-- brand_log_v1_firma_rueckweg.sql (13.10.2026): Stand vor brand_log_v1_firma.sql. Als EIN Block.

begin;

drop function app.brand_log_v1(uuid,integer,text,text[],uuid);
CREATE FUNCTION app.brand_log_v1(p_team uuid, p_limit integer DEFAULT 50, p_before text DEFAULT NULL::text, p_types text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_temp'
AS $function$
-- 13.10.2026: Protokoll der Marken- und Domain-Aenderungen (wie team_log_v1). Nur owner/admin.
-- p_types: status, name, alias, color, domain (null = alle). Blaettern mit meta.next_before.
declare
  v_role   text;
  v_limit  int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_bts    timestamptz;
  v_bid    uuid;
  v_types  text[];
  v_acts   text[];
  v_rows   jsonb;
  v_more   boolean;
  v_next   text;
begin
  perform app._pi_rate_limit_v1('brand_log', 60, 'team');
  v_role := app._set_require_v1(p_team);
  if v_role not in ('owner', 'admin') then
    raise exception 'team_role_required' using errcode = 'PT403', hint = 'owner,admin';
  end if;
  if p_before is not null and btrim(p_before) <> '' then
    begin
      v_bts := split_part(p_before, '_', 1)::timestamptz;
      v_bid := split_part(p_before, '_', 2)::uuid;
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_before';
    end;
  end if;
  v_types := (select array_agg(distinct lower(btrim(t))) from unnest(p_types) t where nullif(btrim(t), '') is not null);
  if exists (select 1 from unnest(v_types) t where t not in ('status', 'name', 'alias', 'color', 'domain')) then
    raise exception 'team_invalid_param' using errcode = '22023', hint = 'p_types: status, name, alias, color, domain';
  end if;
  if v_types is not null then
    v_acts := array(select a from unnest(array['add','activate','deactivate','delete','rename','alias_add','alias_activate',
                                                'alias_deactivate','alias_delete','color_set','color_reset',
                                                'domain_own','domain_competitor','domain_auto']) a
                    where (case when a in ('add','activate','deactivate','delete') then 'status'
                                when a = 'rename' then 'name'
                                when a like 'alias_%' then 'alias'
                                when a like 'color_%' then 'color'
                                else 'domain' end) = any(v_types));
  end if;

  with page as (
    select l.*, row_number() over (order by l.created_at desc, l.id desc) as rn
    from (select * from app.brand_activity_log l0
          where l0.team_id = p_team
            and (v_acts is null or l0.action = any(v_acts))
            and (v_bts is null or (l0.created_at, l0.id) < (v_bts, v_bid))
          order by l0.created_at desc, l0.id desc
          limit v_limit + 1) l
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'log_id', p.id, 'created_at', p.created_at, 'action', p.action,
           'type', case when p.action in ('add','activate','deactivate','delete') then 'status'
                        when p.action = 'rename' then 'name'
                        when p.action like 'alias_%' then 'alias'
                        when p.action like 'color_%' then 'color'
                        else 'domain' end,
           'actor_user_id', p.user_id,
           'actor_email', (select lower(u.email::text) from auth.users u where u.id = p.user_id),
           'actor_display_name', case when p.user_id is null then null
                                      else coalesce(app._set_user_name_v1(p.user_id), 'deleted user') end,
           'by_system', p.user_id is null,
           'n', p.n,
           'companies', coalesce((select jsonb_agg(jsonb_build_object(
                                     'company_id', c.id, 'name', coalesce(nullif(btrim(tbp.name_override), ''), c.name),
                                     'favicon_url', app._citations_abs_url_v1(c.favicon_url)) order by c.name)
                                  from app.company c
                                  left join app.team_brand_profile tbp on tbp.team_id = p_team and tbp.company_id = c.id
                                  where c.id = any(p.company_ids)), '[]'::jsonb),
           'details', p.details)
         order by p.created_at desc, p.id desc) filter (where p.rn <= v_limit), '[]'::jsonb),
         bool_or(p.rn > v_limit),
         max(to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '_' || p.id::text) filter (where p.rn = v_limit)
    into v_rows, v_more, v_next
  from page p;

  return app.js_safe(jsonb_build_object(
    'meta', jsonb_build_object('team_id', p_team, 'limit', v_limit, 'types', to_jsonb(v_types),
                               'available_types', jsonb_build_array('status', 'name', 'alias', 'color', 'domain'),
                               'next_before', case when coalesce(v_more, false) then v_next end),
    'rows', v_rows));
end;
$function$;
revoke all on function app.brand_log_v1(uuid,integer,text,text[]) from public, anon;
grant execute on function app.brand_log_v1(uuid,integer,text,text[]) to authenticated, service_role;

commit;
