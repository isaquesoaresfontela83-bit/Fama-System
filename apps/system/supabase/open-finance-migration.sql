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
  amount_cents bigint not null default 0,
  status text not null default 'pendente',
  payable_id text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_purchases_org_date on public.purchases(organization_id, purchase_date);

create table if not exists public.bank_accounts (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  institution text not null default '',
  account_type text not null default 'corrente',
  opening_balance_cents bigint not null default 0,
  active boolean not null default true,
  provider text not null default '',
  provider_connection_id text not null default '',
  provider_account_id text not null default '',
  current_balance_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bank_accounts_org_name on public.bank_accounts(organization_id, name);

create table if not exists public.bank_movements (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  account_id text not null,
  posted_at text not null default '',
  description text not null,
  amount_cents bigint not null,
  status text not null default 'pendente',
  matched_transaction_id text not null default '',
  import_id text not null default '',
  provider text not null default '',
  provider_transaction_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bank_movements_org_date on public.bank_movements(organization_id, posted_at);

alter table public.bank_accounts
  add column if not exists provider text not null default '',
  add column if not exists provider_connection_id text not null default '',
  add column if not exists provider_account_id text not null default '',
  add column if not exists current_balance_cents bigint not null default 0;

alter table public.bank_movements
  add column if not exists provider text not null default '',
  add column if not exists provider_transaction_id text not null default '';

create table if not exists public.bank_connections (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  provider text not null,
  item_hash text not null,
  encrypted_item_id text not null,
  institution text not null default '',
  status text not null default 'ATIVA',
  last_synced_at text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, item_hash)
);

create index if not exists idx_bank_connections_org on public.bank_connections(organization_id, provider);
create unique index if not exists idx_bank_accounts_provider_account
  on public.bank_accounts(organization_id, provider, provider_connection_id, provider_account_id)
  where provider_account_id <> '';
create unique index if not exists idx_bank_movements_provider_transaction
  on public.bank_movements(organization_id, account_id, provider, provider_transaction_id)
  where provider_transaction_id <> '';

alter table public.bank_connections enable row level security;
revoke all on table public.bank_connections from anon, authenticated;
grant all on table public.bank_connections to service_role;
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_movements enable row level security;
revoke all on table public.suppliers, public.purchases, public.bank_accounts, public.bank_movements from anon, authenticated;
grant all on table public.suppliers, public.purchases, public.bank_accounts, public.bank_movements to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['suppliers', 'purchases', 'bank_accounts', 'bank_movements', 'bank_connections'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

commit;
