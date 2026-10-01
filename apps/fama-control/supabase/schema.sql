begin;

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  plan text not null default 'inicial',
  plan_status text not null default 'trial' check (plan_status in ('trial', 'pending_payment', 'active', 'payment_attention', 'expired', 'cancelled')),
  plan_expires_at timestamptz,
  billing_provider text not null default '',
  billing_payment_id text not null default '',
  created_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id text not null default '',
  user_email text not null,
  display_name text not null default '',
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'technician')),
  permissions jsonb not null default '["dashboard","crm","quotes","agenda","mobile","orders","warranties","customers","contracts","inventory","finance","team"]'::jsonb,
  status text not null default 'invited' check (status in ('active', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_email)
);

create index if not exists idx_org_members_user_id on public.organization_members(user_id);
create index if not exists idx_org_members_organization on public.organization_members(organization_id);

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

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text not null default '',
  source text not null default '',
  interest text not null default '',
  status text not null default 'novo' check (status in ('novo', 'contato', 'visita', 'proposta', 'ganho')),
  estimated_value_cents bigint not null default 0,
  next_action text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_org_created_at on public.leads(organization_id, created_at desc);

create table if not exists public.quotes (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  quote_number text not null,
  client_name text not null,
  service text not null,
  materials_cents bigint not null default 0,
  labor_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  total_cents bigint not null default 0,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aprovado', 'recusado')),
  valid_until text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_number)
);
create index if not exists idx_quotes_org_created_at on public.quotes(organization_id, created_at desc);

create table if not exists public.appointments (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  title text not null,
  client_name text not null,
  start_at text not null,
  address text not null default '',
  technician text not null default '',
  kind text not null default 'Manutenção',
  status text not null default 'agendado' check (status in ('agendado', 'em_rota', 'concluido')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_appointments_org_start_at on public.appointments(organization_id, start_at);

create table if not exists public.work_orders (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  os_number text not null,
  client_name text not null,
  service text not null,
  scheduled_at text not null default '',
  technician text not null default '',
  status text not null default 'aberta' check (status in ('aberta', 'em_execucao', 'concluida')),
  ph double precision,
  chlorine double precision,
  alkalinity double precision,
  products_used text not null default '',
  notes text not null default '',
  amount_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, os_number)
);
create index if not exists idx_work_orders_org_scheduled_at on public.work_orders(organization_id, scheduled_at desc);

create table if not exists public.customers (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  pool_type text not null default '',
  pool_volume integer,
  plan text not null default '',
  status text not null default 'ativo',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_org_name on public.customers(organization_id, name);

create table if not exists public.inventory_items (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text not null default '',
  unit text not null default 'unidade',
  quantity double precision not null default 0,
  minimum_quantity double precision not null default 0,
  cost_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inventory_org_name on public.inventory_items(organization_id, name);

create table if not exists public.transactions (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  description text not null,
  type text not null check (type in ('receita', 'despesa')),
  category text not null default '',
  amount_cents bigint not null default 0,
  due_date text not null default '',
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_transactions_org_due_date on public.transactions(organization_id, due_date desc);

create table if not exists public.employees (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  role text not null default '',
  phone text not null default '',
  color text not null default 'aqua',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_employees_org_name on public.employees(organization_id, name);

create table if not exists public.warranties (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  warranty_number text not null,
  client_name text not null,
  item text not null,
  origin_reference text not null default '',
  purchase_date text not null default '',
  expires_at text not null default '',
  scheduled_at text not null default '',
  appointment_id text not null default '',
  technician text not null default '',
  status text not null default 'ativa' check (status in ('ativa', 'agendada', 'concluida', 'expirada')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, warranty_number)
);
create index if not exists idx_warranties_org_expires_at on public.warranties(organization_id, expires_at);

create table if not exists public.contracts (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  contract_number text not null,
  client_name text not null,
  client_document text not null default '',
  client_address text not null default '',
  service text not null,
  start_date text not null default '',
  end_date text not null default '',
  frequency text not null default 'mensal',
  monthly_cents bigint not null default 0,
  payment_day integer check (payment_day between 1 and 31),
  status text not null default 'rascunho' check (status in ('rascunho', 'ativo', 'suspenso', 'encerrado')),
  terms text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_number)
);
create index if not exists idx_contracts_org_created_at on public.contracts(organization_id, created_at desc);

create table if not exists public.attachments (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('leads', 'quotes', 'appointments', 'workOrders', 'customers', 'inventory', 'transactions', 'employees', 'warranties', 'contracts')),
  entity_id text not null,
  file_name text not null,
  object_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_by_user_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_attachments_record on public.attachments(organization_id, entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'organization_members', 'leads', 'quotes', 'appointments',
    'work_orders', 'customers', 'inventory_items', 'transactions', 'employees',
    'warranties', 'contracts'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.schedule_warranty(
  p_organization_id text,
  p_warranty_id text,
  p_scheduled_at text,
  p_technician text,
  p_appointment_id text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  warranty_row public.warranties%rowtype;
  appointment_row public.appointments%rowtype;
  resolved_appointment_id text;
begin
  select * into warranty_row
  from public.warranties
  where id = p_warranty_id and organization_id = p_organization_id
  for update;

  if warranty_row.id is null then
    raise exception 'Garantia não encontrada.' using errcode = 'P0002';
  end if;

  resolved_appointment_id := case when warranty_row.appointment_id <> '' then warranty_row.appointment_id else p_appointment_id end;

  insert into public.appointments (
    id, organization_id, title, client_name, start_at, address, technician, kind, status, notes, created_at, updated_at
  ) values (
    resolved_appointment_id,
    p_organization_id,
    'Atendimento de garantia ' || warranty_row.warranty_number,
    warranty_row.client_name,
    p_scheduled_at,
    '',
    p_technician,
    'Garantia',
    'agendado',
    'Cobertura: ' || warranty_row.item,
    p_now,
    p_now
  )
  on conflict (id) do update set
    title = excluded.title,
    client_name = excluded.client_name,
    start_at = excluded.start_at,
    technician = excluded.technician,
    kind = excluded.kind,
    status = excluded.status,
    notes = excluded.notes,
    updated_at = excluded.updated_at
  returning * into appointment_row;

  update public.warranties set
    scheduled_at = p_scheduled_at,
    appointment_id = resolved_appointment_id,
    technician = p_technician,
    status = 'agendada',
    updated_at = p_now
  where id = p_warranty_id and organization_id = p_organization_id
  returning * into warranty_row;

  return jsonb_build_object('warranty', to_jsonb(warranty_row), 'appointment', to_jsonb(appointment_row));
end;
$$;

revoke all on function public.schedule_warranty(text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.schedule_warranty(text, text, text, text, text, timestamptz) to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'organization_members', 'leads', 'quotes', 'appointments',
    'work_orders', 'customers', 'inventory_items', 'transactions', 'employees',
    'warranties', 'contracts', 'attachments'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fama-documents',
  'fama-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
