-- Apply through the database administrator. All access goes through authenticated server routes.
create unique index if not exists fama_whatsapp_member_scope on public.organization_members(id,organization_id);
create table if not exists public.fama_whatsapp_connections (
  id text primary key,
  organization_id text not null unique references public.organizations(id) on delete cascade,
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{5,30}$'),
  display_phone text not null default '',
  token_ciphertext text not null check (token_ciphertext like 'fama:v1:%'),
  app_secret_ciphertext text not null check (app_secret_ciphertext like 'fama:v1:%'),
  verify_token_ciphertext text not null check (verify_token_ciphertext like 'fama:v1:%'),
  assistant_enabled boolean not null default false,
  verified_at timestamptz,
  webhook_verified_at timestamptz,
  last_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.fama_whatsapp_links (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  member_id text not null,
  phone_hash text not null,
  phone_ciphertext text not null check (phone_ciphertext like 'fama:v1:%'),
  active boolean not null default true,
  context_ciphertext text not null default '',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id,phone_hash)
);
create table if not exists public.fama_whatsapp_events (
  connection_id text not null references public.fama_whatsapp_connections(id) on delete cascade,
  message_hash text not null,
  status text not null check (status in ('processing','sending','sent','failed','uncertain','ignored')),
  created_at timestamptz not null default now(),
  primary key (connection_id,message_hash)
);
alter table public.fama_whatsapp_links drop constraint if exists fama_whatsapp_links_member_id_fkey;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='fama_whatsapp_link_member_company_fk' and conrelid='public.fama_whatsapp_links'::regclass) then
    alter table public.fama_whatsapp_links add constraint fama_whatsapp_link_member_company_fk
      foreign key(member_id,organization_id) references public.organization_members(id,organization_id) on delete cascade;
  end if;
end $$;
create index if not exists fama_whatsapp_links_member_idx on public.fama_whatsapp_links(member_id,organization_id);
create index if not exists fama_whatsapp_events_cleanup_idx on public.fama_whatsapp_events(connection_id,created_at);
alter table public.fama_whatsapp_connections enable row level security;
alter table public.fama_whatsapp_links enable row level security;
alter table public.fama_whatsapp_events enable row level security;
revoke all on public.fama_whatsapp_connections,public.fama_whatsapp_links,public.fama_whatsapp_events from public,anon,authenticated;
grant select,insert,update,delete on public.fama_whatsapp_connections,public.fama_whatsapp_links,public.fama_whatsapp_events to service_role;
create or replace function public.fama_whatsapp_member_access(p_organization_id text,p_member_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('member',to_jsonb(m),'organization',to_jsonb(o))
  from public.organization_members m
  join public.organizations o on o.id=m.organization_id
  where m.id=p_member_id and m.organization_id=p_organization_id
    and m.status='active' and o.status='active' and m.user_id<>''
  limit 1;
$$;
revoke all on function public.fama_whatsapp_member_access(text,text) from public,anon,authenticated;
grant execute on function public.fama_whatsapp_member_access(text,text) to service_role;
create or replace function public.fama_whatsapp_claim_event(p_connection_id text,p_message_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.fama_whatsapp_events where connection_id=p_connection_id and created_at<now()-interval '30 days';
  insert into public.fama_whatsapp_events(connection_id,message_hash,status)
    values(p_connection_id,p_message_hash,'processing') on conflict do nothing;
  if found then return true; end if;
  update public.fama_whatsapp_events set status='processing'
    where connection_id=p_connection_id and message_hash=p_message_hash and status='failed';
  return found;
end;
$$;
revoke all on function public.fama_whatsapp_claim_event(text,text) from public,anon,authenticated;
grant execute on function public.fama_whatsapp_claim_event(text,text) to service_role;
