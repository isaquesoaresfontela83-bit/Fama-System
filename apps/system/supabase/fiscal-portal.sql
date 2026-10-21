begin;

alter table public.attachments add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.attachments drop constraint attachments_entity_type_check;
alter table public.attachments add constraint attachments_entity_type_check
  check (entity_type in ('leads', 'quotes', 'appointments', 'workOrders', 'customers', 'inventory', 'transactions', 'employees', 'warranties', 'contracts', 'suppliers', 'purchases', 'fiscalInvoices'));

-- XML is stored as opaque download bytes. Keep existing bucket settings and MIME types.
update storage.buckets
set allowed_mime_types = case when allowed_mime_types is null then null
  else array(select distinct value from unnest(allowed_mime_types || array['application/octet-stream']) as value) end
where id = 'fama-documents';

commit;
