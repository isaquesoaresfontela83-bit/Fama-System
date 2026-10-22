-- Live database regression, with disposable records and automatic rollback.
begin;
create temporary table fama_wa_qa_state(org_a text,org_b text,member_a text,member_b text,connection_id text);
create temporary table fama_wa_qa_results(check_name text primary key,passed boolean not null);
do $$ declare
  a text := 'qa-wa-a-'||gen_random_uuid(); b text := 'qa-wa-b-'||gen_random_uuid();
  ma text := 'qa-wa-ma-'||gen_random_uuid(); mb text := 'qa-wa-mb-'||gen_random_uuid();
  c text := gen_random_uuid()::text; u text;
begin
  select id::text into u from auth.users where deleted_at is null and (banned_until is null or banned_until<=now()) limit 1;
  if u is null then raise exception 'A verified existing identity is needed for this disposable regression'; end if;
  insert into public.organizations(id,name,name_key,slug,status,created_by_user_id,plan_status,billing_enabled,block_on_expiry)
    values(a,'WhatsApp QA A',a,a,'active',u,'active',false,false),(b,'WhatsApp QA B',b,b,'active',u,'active',false,false);
  insert into public.organization_members(id,organization_id,user_id,user_email,display_name,role,status,permissions)
    values(ma,a,u,'wa-qa-a@example.test','WhatsApp QA','owner','active','[]'),(mb,b,u,'wa-qa-b@example.test','WhatsApp QB','member','active','[]');
  insert into public.fama_whatsapp_connections(id,organization_id,phone_number_id,token_ciphertext,app_secret_ciphertext,verify_token_ciphertext)
    values(c,a,'99999'||floor(random()*1000000000000)::text,'fama:v1:fixture','fama:v1:fixture','fama:v1:fixture');
  insert into fama_wa_qa_state values(a,b,ma,mb,c);
end $$;
grant select on fama_wa_qa_state to service_role;
grant select,insert on fama_wa_qa_results to service_role;
set local role service_role;
insert into fama_wa_qa_results values
 ('server_role_reads_connection',(select count(*)=1 from public.fama_whatsapp_connections where id=(select connection_id from fama_wa_qa_state))),
 ('same_company_member_access',(select public.fama_whatsapp_member_access(org_a,member_a)->'member'->>'id'=member_a from fama_wa_qa_state)),
 ('foreign_member_denied',(select public.fama_whatsapp_member_access(org_a,member_b) is null from fama_wa_qa_state)),
 ('first_event_claim',(select public.fama_whatsapp_claim_event(connection_id,'fixture-message') from fama_wa_qa_state)),
 ('duplicate_event_denied',(select not public.fama_whatsapp_claim_event(connection_id,'fixture-message') from fama_wa_qa_state));
update public.fama_whatsapp_events set status='failed' where connection_id=(select connection_id from fama_wa_qa_state);
insert into fama_wa_qa_results values('failed_before_send_can_retry',(select public.fama_whatsapp_claim_event(connection_id,'fixture-message') from fama_wa_qa_state));
update public.fama_whatsapp_events set status='uncertain' where connection_id=(select connection_id from fama_wa_qa_state);
insert into fama_wa_qa_results values('uncertain_send_cannot_repeat',(select not public.fama_whatsapp_claim_event(connection_id,'fixture-message') from fama_wa_qa_state));
update public.organization_members set status='inactive' where id=(select member_a from fama_wa_qa_state);
insert into fama_wa_qa_results values('inactive_member_denied',(select public.fama_whatsapp_member_access(org_a,member_a) is null from fama_wa_qa_state));
update public.organization_members set status='active' where id=(select member_a from fama_wa_qa_state);
update public.organizations set status='suspended' where id=(select org_a from fama_wa_qa_state);
insert into fama_wa_qa_results values('suspended_company_denied',(select public.fama_whatsapp_member_access(org_a,member_a) is null from fama_wa_qa_state));
update public.organizations set status='active' where id=(select org_a from fama_wa_qa_state);
do $$ declare s record; begin
  select * into s from fama_wa_qa_state;
  begin
    insert into public.fama_whatsapp_links(id,organization_id,member_id,phone_hash,phone_ciphertext)
      values(gen_random_uuid()::text,s.org_a,s.member_b,'fixture-phone','fama:v1:fixture');
    insert into fama_wa_qa_results values('foreign_membership_fk',false);
  exception when foreign_key_violation then insert into fama_wa_qa_results values('foreign_membership_fk',true); end;
  begin
    update public.fama_whatsapp_connections set token_ciphertext='plaintext-fixture' where id=s.connection_id;
    insert into fama_wa_qa_results values('plaintext_token_rejected',false);
  exception when check_violation then insert into fama_wa_qa_results values('plaintext_token_rejected',true); end;
  insert into public.fama_whatsapp_events(connection_id,message_hash,status,created_at) values(s.connection_id,'old-fixture','sent',now()-interval '31 days');
  perform public.fama_whatsapp_claim_event(s.connection_id,'new-fixture');
  insert into fama_wa_qa_results values('old_metadata_cleanup',not exists(select 1 from public.fama_whatsapp_events where connection_id=s.connection_id and message_hash='old-fixture'));
end $$;
reset role;
insert into fama_wa_qa_results values
 ('private_tables_have_rls',(select bool_and(relrowsecurity) from pg_class where oid in ('public.fama_whatsapp_connections'::regclass,'public.fama_whatsapp_links'::regclass,'public.fama_whatsapp_events'::regclass))),
 ('anon_cannot_read_tables',not has_table_privilege('anon','public.fama_whatsapp_connections','select') and not has_table_privilege('anon','public.fama_whatsapp_links','select') and not has_table_privilege('anon','public.fama_whatsapp_events','select')),
 ('authenticated_cannot_read_secrets',not has_table_privilege('authenticated','public.fama_whatsapp_connections','select')),
 ('public_roles_cannot_call_member_access',not has_function_privilege('anon','public.fama_whatsapp_member_access(text,text)','execute') and not has_function_privilege('authenticated','public.fama_whatsapp_member_access(text,text)','execute')),
 ('public_roles_cannot_claim_events',not has_function_privilege('anon','public.fama_whatsapp_claim_event(text,text)','execute') and not has_function_privilege('authenticated','public.fama_whatsapp_claim_event(text,text)','execute')),
 ('functions_do_not_bypass_rls',(select bool_and(not prosecdef) from pg_proc where oid in ('public.fama_whatsapp_member_access(text,text)'::regprocedure,'public.fama_whatsapp_claim_event(text,text)'::regprocedure)));
select count(*)::int as checks,count(*) filter(where passed)::int as passed,count(*) filter(where not passed)::int as failed from fama_wa_qa_results;
rollback;
