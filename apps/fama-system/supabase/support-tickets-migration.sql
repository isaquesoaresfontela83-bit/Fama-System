begin;

create table if not exists public.support_tickets (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  organization_name text not null default '',
  user_id text not null default '',
  user_email text not null default '',
  type text not null default 'melhoria' check (type in ('melhoria', 'erro', 'duvida', 'financeiro')),
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'critica')),
  title text not null,
  message text not null,
  status text not null default 'aberto' check (status in ('aberto', 'em_analise', 'resolvido')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_org_created on public.support_tickets(organization_id, created_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets(status);

alter table public.support_tickets enable row level security;
revoke all on table public.support_tickets from anon, authenticated;
grant all on table public.support_tickets to service_role;

commit;
