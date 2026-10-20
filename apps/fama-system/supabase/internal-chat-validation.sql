begin;
insert into public.organizations(id,name,slug,status,created_by_user_id,name_key) values('qa-chat-org','QA chat transaction','qa-chat-transaction','active','qa-chat-admin','qa-chat-transaction'),('qa-chat-other','QA other transaction','qa-chat-other','active','qa-other','qa-chat-other');
insert into public.organization_members(id,organization_id,user_id,user_email,display_name,role,status) values
('qa-chat-admin','qa-chat-org','qa-admin','qa-admin@invalid.test','QA Admin','admin','active'),
('qa-chat-tech','qa-chat-org','qa-tech','qa-tech@invalid.test','QA Tech','technician','active'),
('qa-chat-outsider','qa-chat-org','qa-out','qa-out@invalid.test','QA Observer','admin','active'),
('qa-chat-foreign','qa-chat-other','qa-foreign','qa-foreign@invalid.test','QA Foreign','admin','active');
set local role service_role;
do $$
declare thread uuid;channel uuid;m jsonb;again jsonb;n bigint;failed boolean;
begin
 thread=(public.fama_internal_chat('direct','qa-chat-org','qa-chat-admin',p_recipient_id=>'qa-chat-tech')->>'id')::uuid;
 if (public.fama_internal_chat('direct','qa-chat-org','qa-chat-tech',p_recipient_id=>'qa-chat-admin')->>'id')::uuid<>thread then raise exception 'duplicate DM';end if;
 m=public.fama_internal_chat('send','qa-chat-org','qa-chat-admin',p_thread_id=>thread,p_body=>'encrypted QA payload',p_client_id=>'11111111-1111-4111-8111-111111111111');
 again=public.fama_internal_chat('send','qa-chat-org','qa-chat-admin',p_thread_id=>thread,p_body=>'encrypted QA payload',p_client_id=>'11111111-1111-4111-8111-111111111111');
 if m->>'id'<>again->>'id' then raise exception 'duplicate send';end if;
 if jsonb_array_length(public.fama_internal_chat('inbox','qa-chat-org','qa-chat-outsider'))<>0 then raise exception 'private conversation leaked';end if;
 failed=false;begin perform public.fama_internal_chat('page','qa-chat-org','qa-chat-outsider',p_thread_id=>thread);exception when insufficient_privilege then failed=true;end;if not failed then raise exception 'admin could read private DM';end if;
 failed=false;begin perform public.fama_internal_chat('page','qa-chat-other','qa-chat-foreign',p_thread_id=>thread);exception when insufficient_privilege then failed=true;end;if not failed then raise exception 'cross-tenant read';end if;
 perform public.fama_internal_chat('read','qa-chat-org','qa-chat-tech',p_thread_id=>thread,p_cursor=>(m->>'sequence')::bigint);
 if (public.fama_internal_chat('page','qa-chat-org','qa-chat-admin',p_thread_id=>thread)->0->>'read_count')::int<>1 then raise exception 'read receipt failed';end if;
 perform public.fama_internal_chat('read','qa-chat-org','qa-chat-tech',p_thread_id=>thread,p_cursor=>0);
 if (select last_sequence from public.fama_internal_reads where member_id='qa-chat-tech' and thread_id=thread)<>(m->>'sequence')::bigint then raise exception 'read cursor went backwards';end if;
 channel=(public.fama_internal_chat('channel','qa-chat-org','qa-chat-admin',p_title=>'Avisos QA',p_announcements=>true)->>'id')::uuid;
 failed=false;begin perform public.fama_internal_chat('send','qa-chat-org','qa-chat-tech',p_thread_id=>channel,p_body=>'blocked',p_client_id=>gen_random_uuid());exception when insufficient_privilege then failed=true;end;if not failed then raise exception 'technician posted announcement';end if;
 failed=false;begin perform public.fama_internal_chat('send','qa-chat-org','qa-chat-admin',p_thread_id=>channel,p_body=>'blocked reply',p_client_id=>gen_random_uuid(),p_reply_id=>(m->>'id')::uuid);exception when invalid_parameter_value then failed=true;end;if not failed then raise exception 'cross-thread reply accepted';end if;
 perform public.fama_internal_chat('pin','qa-chat-org','qa-chat-tech',p_thread_id=>thread,p_reply_id=>(m->>'id')::uuid,p_pinned=>true);
 if jsonb_array_length(public.fama_internal_chat('pinned','qa-chat-org','qa-chat-admin',p_thread_id=>thread))<>1 then raise exception 'pin failed';end if;
 insert into public.fama_internal_messages(organization_id,thread_id,sender_id,author,body_ciphertext,client_id) select 'qa-chat-org',thread,'qa-chat-admin','QA','encrypted',gen_random_uuid() from generate_series(1,82);
 if jsonb_array_length(public.fama_internal_chat('page','qa-chat-org','qa-chat-admin',p_thread_id=>thread))<>81 then raise exception 'pagination unbounded';end if;
 if exists(select 1 from pg_class where relname like 'fama_internal_%' and relkind='r' and not relrowsecurity) then raise exception 'RLS missing';end if;
 if has_function_privilege('authenticated','public.fama_internal_chat(text,text,text,uuid,text,text,boolean,text,uuid,uuid,boolean,bigint,boolean)','execute') then raise exception 'browser RPC exposure';end if;
end;$$;
select 'PASS: private messages, tenant isolation, idempotency, read cursors, announcements, replies, pins, pagination and RLS' as validation;
rollback;
