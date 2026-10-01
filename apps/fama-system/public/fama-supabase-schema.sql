begin;

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  deleted_at timestamptz,
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
  permissions jsonb not null default '["dashboard","crm","quotes","agenda","orders","warranties","customers","contracts","inventory","finance","team"]'::jsonb,
  status text not null default 'invited' check (status in ('active', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_email)
);

create index if not exists idx_org_members_user_id on public.organization_members(user_id);
create index if not exists idx_org_members_organization on public.organization_members(organization_id);

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

create table if not exists public.legal_consents (
  id text primary key,
  user_id text not null,
  email_hash text not null,
  terms_version text not null,
  privacy_version text not null,
  source text not null default 'web',
  ip_hash text not null default '',
  user_agent_hash text not null default '',
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_legal_consents_user_version on public.legal_consents(user_id, terms_version, privacy_version, accepted_at desc);

create table if not exists public.privacy_requests (
  id text primary key,
  organization_id text references public.organizations(id) on delete set null,
  requester_user_id text not null,
  requester_email_hash text not null,
  contact_encrypted text not null default '',
  request_type text not null check (request_type in ('access', 'correction', 'export', 'deletion', 'revocation')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'rejected')),
  details text not null default '',
  resolution text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_privacy_requests_requester on public.privacy_requests(requester_user_id, created_at desc);
create index if not exists idx_privacy_requests_status on public.privacy_requests(status, created_at desc);
create index if not exists idx_privacy_requests_organization on public.privacy_requests(organization_id, created_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id text,
  actor_user_id text,
  event_type text not null check (event_type in ('insert', 'update', 'delete', 'security', 'login', 'logout', 'export', 'restore')),
  entity_type text not null,
  record_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_organization_time on public.audit_logs(organization_id, occurred_at desc);
create index if not exists idx_audit_logs_entity_record on public.audit_logs(entity_type, record_id, occurred_at desc);
create index if not exists idx_audit_logs_event_time on public.audit_logs(event_type, occurred_at desc);

create table if not exists public.recovery_snapshots (
  id text primary key,
  organization_id text not null,
  entity_type text not null,
  record_id text not null,
  encrypted_payload text not null,
  deleted_by_user_id text not null,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  restored_at timestamptz,
  restored_by_user_id text
);
create index if not exists idx_recovery_snapshots_available on public.recovery_snapshots(organization_id, deleted_at desc) where restored_at is null;
create index if not exists idx_recovery_snapshots_expiry on public.recovery_snapshots(expires_at) where restored_at is null;

create table if not exists public.request_rate_limits (
  key_hash text not null,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (key_hash, action)
);
create index if not exists idx_request_rate_limits_updated on public.request_rate_limits(updated_at);

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

create or replace function public.fama_consume_rate_limit(p_key_hash text, p_action text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare allowed boolean;
begin
  if p_key_hash is null or length(p_key_hash) < 16 or p_action is null or length(p_action) < 2 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters';
  end if;
  insert into public.request_rate_limits (key_hash, action, window_started_at, request_count, updated_at)
  values (p_key_hash, p_action, now(), 1, now())
  on conflict (key_hash, action) do update set
    request_count = case when public.request_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1 else public.request_rate_limits.request_count + 1 end,
    window_started_at = case when public.request_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now() else public.request_rate_limits.window_started_at end,
    updated_at = now()
  returning request_count <= p_limit into allowed;
  return allowed;
end;
$$;
revoke all on function public.fama_consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.fama_consume_rate_limit(text, text, integer, integer) to service_role;

create or replace function public.fama_audit_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare row_data jsonb; previous_data jsonb; resolved_organization_id text; resolved_record_id text; metadata_value jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous_data := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  resolved_organization_id := coalesce(nullif(row_data->>'organization_id', ''), case when tg_table_name = 'organizations' then nullif(row_data->>'id', '') else null end);
  resolved_record_id := coalesce(row_data->>'id', '');
  metadata_value := jsonb_strip_nulls(jsonb_build_object('operation', lower(tg_op), 'status_before', case when previous_data is null then null else previous_data->>'status' end, 'status_after', case when tg_op = 'DELETE' then null else row_data->>'status' end));
  insert into public.audit_logs (organization_id, actor_user_id, event_type, entity_type, record_id, metadata)
  values (resolved_organization_id, null, lower(tg_op), tg_table_name, resolved_record_id, metadata_value);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.fama_audit_change() from public, anon, authenticated;
grant execute on function public.fama_audit_change() to service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations', 'organization_members', 'leads', 'quotes', 'appointments', 'work_orders',
    'customers', 'inventory_items', 'transactions', 'employees', 'warranties', 'contracts',
    'attachments', 'privacy_requests', 'recovery_snapshots'
  ] loop
    execute format('drop trigger if exists fama_audit_%I on public.%I', table_name, table_name);
    execute format('create trigger fama_audit_%I after insert or update or delete on public.%I for each row execute function public.fama_audit_change()', table_name, table_name);
  end loop;
end;
$$;

drop trigger if exists set_privacy_requests_updated_at on public.privacy_requests;
create trigger set_privacy_requests_updated_at before update on public.privacy_requests for each row execute function public.set_updated_at();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'organization_members', 'leads', 'quotes', 'appointments',
    'work_orders', 'customers', 'inventory_items', 'transactions', 'employees',
    'warranties', 'contracts', 'attachments', 'legal_consents', 'privacy_requests',
    'audit_logs', 'recovery_snapshots', 'request_rate_limits'
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
