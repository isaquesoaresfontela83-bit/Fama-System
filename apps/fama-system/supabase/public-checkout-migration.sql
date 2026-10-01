begin;

create table if not exists public.subscription_checkouts (
  id text primary key,
  plan text not null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_document text not null default '',
  buyer_phone text not null default '',
  payment_id text not null default '',
  customer_id text not null default '',
  provider text not null default 'manual_pix',
  proof_text text not null default '',
  proof_submitted_at text not null default '',
  reviewed_at text not null default '',
  reviewed_by text not null default '',
  admin_notes text not null default '',
  status text not null default 'pending_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscription_checkouts_payment on public.subscription_checkouts(payment_id);
create index if not exists idx_subscription_checkouts_email on public.subscription_checkouts(buyer_email);

alter table public.subscription_checkouts add column if not exists provider text not null default 'manual_pix';
alter table public.subscription_checkouts add column if not exists proof_text text not null default '';
alter table public.subscription_checkouts add column if not exists proof_submitted_at text not null default '';
alter table public.subscription_checkouts add column if not exists reviewed_at text not null default '';
alter table public.subscription_checkouts add column if not exists reviewed_by text not null default '';
alter table public.subscription_checkouts add column if not exists admin_notes text not null default '';

alter table public.subscription_checkouts enable row level security;
revoke all on table public.subscription_checkouts from anon, authenticated;
grant all on table public.subscription_checkouts to service_role;

commit;
