begin;

create table if not exists public.suppliers (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  document text not null default '',
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_suppliers_org_name on public.suppliers(organization_id, name);

create table if not exists public.purchases (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  supplier_id text not null default '',
  supplier_name text not null,
  invoice_number text not null default '',
  purchase_date text not null default '',
  due_date text not null default '',
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado')),
  payable_id text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_purchases_org_date on public.purchases(organization_id, purchase_date desc);

create table if not exists public.bank_accounts (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  institution text not null default '',
  account_type text not null default 'corrente' check (account_type in ('corrente', 'poupanca', 'caixa', 'cartao')),
  opening_balance_cents bigint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bank_accounts_org_name on public.bank_accounts(organization_id, name);

create table if not exists public.bank_movements (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  account_id text not null references public.bank_accounts(id) on delete cascade,
  posted_at text not null default '',
  description text not null,
  amount_cents bigint not null,
  status text not null default 'pendente' check (status in ('pendente', 'conciliado')),
  matched_transaction_id text not null default '',
  import_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bank_movements_org_date on public.bank_movements(organization_id, posted_at desc);

alter table public.attachments drop constraint if exists attachments_entity_type_check;
alter table public.attachments add constraint attachments_entity_type_check
  check (entity_type in ('leads', 'quotes', 'appointments', 'workOrders', 'customers', 'inventory', 'transactions', 'employees', 'warranties', 'contracts', 'suppliers', 'purchases'));

do $$ declare table_name text;
begin
  foreach table_name in array array['suppliers', 'purchases', 'bank_accounts', 'bank_movements'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

commit;
