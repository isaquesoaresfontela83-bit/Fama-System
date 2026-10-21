-- Additive migration, already applied to the shared Fama Supabase project.
-- Existing self-service/paid companies keep their original billing behavior.
alter table public.organizations add column if not exists billing_enabled boolean not null default true;
alter table public.organizations add column if not exists block_on_expiry boolean not null default true;

create or replace function public.fama_admin_create_company(
  p_id text, p_name text, p_name_key text, p_slug text, p_plan text,
  p_member_id text, p_user_id text, p_email text, p_display_name text,
  p_permissions jsonb, p_actor_id text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if p_plan not in ('inicial', 'intermediario', 'profissional')
    or length(trim(p_name)) < 2 or jsonb_typeof(p_permissions) <> 'array'
  then raise exception 'Invalid company data' using errcode = '22023'; end if;
  insert into public.organizations
    (id, name, name_key, slug, status, plan, plan_status, plan_expires_at,
     billing_enabled, block_on_expiry, created_by_user_id)
  values (p_id, p_name, p_name_key, p_slug, 'active', p_plan, 'active', '', false, false, p_user_id);
  insert into public.organization_members
    (id, organization_id, user_id, user_email, display_name, role, status, permissions)
  values (p_member_id, p_id, p_user_id, lower(p_email), p_display_name, 'owner', 'active', p_permissions);
  insert into public.audit_logs
    (organization_id, actor_user_id, event_type, entity_type, record_id, metadata)
  values (p_id, p_actor_id, 'security', 'company_created', p_id,
    jsonb_build_object('billingEnabled', false, 'blockOnExpiry', false));
  return jsonb_build_object('id', p_id, 'memberId', p_member_id);
end;
$$;
revoke all on function public.fama_admin_create_company(text,text,text,text,text,text,text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.fama_admin_create_company(text,text,text,text,text,text,text,text,text,jsonb,text) to service_role;
notify pgrst, 'reload schema';
