begin;
alter table public.quotes add column if not exists customer_id text;
alter table public.appointments add column if not exists customer_id text;
alter table public.work_orders add column if not exists customer_id text;
alter table public.warranties add column if not exists customer_id text;
alter table public.contracts add column if not exists customer_id text;
create table if not exists public.fama_agenda_settings (
 id text primary key, organization_id text not null unique references public.organizations(id) on delete cascade,
 user_id text not null, enabled boolean not null default false, config text not null, updated_at timestamptz not null default now()
);
create table if not exists public.fama_agenda_deliveries (
 id text primary key, organization_id text not null references public.organizations(id) on delete cascade,
 employee_id text not null, day text not null, status text not null check(status in ('reserved','sent','uncertain')),
 payload text not null, detail text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_fama_agenda_delivery_org_date on public.fama_agenda_deliveries(organization_id,updated_at desc);
alter table public.fama_agenda_settings enable row level security;
alter table public.fama_agenda_deliveries enable row level security;
revoke all on public.fama_agenda_settings,public.fama_agenda_deliveries from anon,authenticated;
grant all on public.fama_agenda_settings,public.fama_agenda_deliveries to service_role;
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
    id, organization_id, title, client_name, customer_id, start_at, address, technician, kind, status, notes, created_at, updated_at
  ) values (
    resolved_appointment_id,
    p_organization_id,
    'Atendimento de garantia ' || warranty_row.warranty_number,
    warranty_row.client_name,
    warranty_row.customer_id,
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
    customer_id = excluded.customer_id,
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
commit;
