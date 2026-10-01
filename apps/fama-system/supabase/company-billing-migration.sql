begin;
alter table public.organizations add column if not exists name_key text not null default '';
alter table public.organizations add column if not exists plan text not null default 'inicial';
-- Existing companies retain access; registration explicitly assigns the trial.
alter table public.organizations add column if not exists plan_status text not null default 'active';
alter table public.organizations add column if not exists plan_expires_at text not null default '';
alter table public.organizations add column if not exists billing_cycle text not null default 'monthly';
alter table public.organizations add column if not exists pending_plan text not null default '';
alter table public.organizations add column if not exists pending_billing_cycle text not null default 'monthly';
alter table public.organizations add column if not exists billing_customer_id text not null default '';
alter table public.organizations add column if not exists billing_payment_id text not null default '';
alter table public.organizations add column if not exists billing_provider text not null default '';
update public.organizations
set name_key = trim(regexp_replace(lower(translate(name,
  'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
  'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
)), '[^a-z0-9]+', ' ', 'g'))
where name_key = '';
create unique index if not exists idx_organizations_name_key on public.organizations(name_key) where status <> 'deleted';
create unique index if not exists idx_organizations_billing_payment on public.organizations(billing_payment_id) where billing_payment_id <> '';

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant all on public.platform_settings to service_role;

-- Email-based invitations may bind an unassigned membership, never another account's membership.
create or replace function private.has_org_permission(p_organization_id text, p_permission text)
returns boolean language sql stable security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where auth.uid() is not null
      and m.organization_id = p_organization_id
      and m.status = 'active' and o.status = 'active' and o.deleted_at is null
      and (m.user_id = auth.uid()::text or (
        coalesce(m.user_id, '') = ''
        and lower(m.user_email) = lower(coalesce(auth.jwt()->>'email', ''))
      ))
      and (m.role = 'owner' or m.permissions ? p_permission)
  );
$function$;
commit;
