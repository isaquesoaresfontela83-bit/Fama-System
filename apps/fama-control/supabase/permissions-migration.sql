-- Fama Control: acesso individual por módulo.
-- Execute uma única vez no SQL Editor do projeto Supabase.
alter table public.organization_members
  add column if not exists permissions jsonb not null default '["dashboard","crm","quotes","agenda","mobile","orders","warranties","customers","contracts","inventory","finance","team"]'::jsonb;

alter table public.organization_members
  alter column permissions set default '["dashboard","crm","quotes","agenda","mobile","orders","warranties","customers","contracts","inventory","finance","team"]'::jsonb;

update public.organization_members
set permissions = '["dashboard","crm","quotes","agenda","mobile","orders","warranties","customers","contracts","inventory","finance","team"]'::jsonb
where permissions is null or (permissions = '[]'::jsonb and role not in ('owner', 'admin'));

alter table public.organization_members
  drop constraint if exists organization_members_permissions_is_array;

alter table public.organization_members
  add constraint organization_members_permissions_is_array
  check (jsonb_typeof(permissions) = 'array');

alter table public.organization_members enable row level security;
revoke all on table public.organization_members from anon, authenticated;
grant all on table public.organization_members to service_role;
