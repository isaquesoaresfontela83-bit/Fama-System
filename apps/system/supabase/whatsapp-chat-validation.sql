-- Test fixtures exist only inside this transaction; no customer messages are sent.
BEGIN;
CREATE TEMP TABLE inbox_checks(label text, passed boolean);
DO $$
DECLARE org_a text:=gen_random_uuid()::text; org_b text:=gen_random_uuid()::text;
  conn_a text:=gen_random_uuid()::text; conn_b text:=gen_random_uuid()::text;
  thread_a text; thread_b text; result jsonb; retry jsonb; message_id text;
  request_id text:=gen_random_uuid()::text; changed boolean; page_size integer; older_size integer; cursor_id text;
BEGIN
  INSERT INTO public.organizations(id,name,name_key,slug,status,created_by_user_id)
    VALUES(org_a,'Chat Inbox Test A','chat inbox '||org_a,'chat-inbox-'||org_a,'active','chat-inbox-validation'),
          (org_b,'Chat Inbox Test B','chat inbox '||org_b,'chat-inbox-'||org_b,'active','chat-inbox-validation');
  INSERT INTO public.fama_whatsapp_connections(id,organization_id,phone_number_id,display_phone,token_ciphertext,app_secret_ciphertext,verify_token_ciphertext,assistant_enabled,verified_at,webhook_verified_at)
    VALUES(conn_a,org_a,'111111111','+5511111111111','fama:v1:test','fama:v1:test','fama:v1:test',false,now(),now()),
          (conn_b,org_b,'222222222','+5522222222222','fama:v1:test','fama:v1:test','fama:v1:test',false,now(),now());
  INSERT INTO inbox_checks VALUES('Storage is private with RLS',NOT has_table_privilege('anon','public.fama_chat_messages','SELECT') AND NOT has_table_privilege('authenticated','public.fama_chat_conversations','SELECT')
    AND (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.fama_chat_conversations'::regclass,'public.fama_chat_messages'::regclass)));
  INSERT INTO inbox_checks VALUES('Only server roles execute chat procedures',NOT has_function_privilege('authenticated','public.fama_chat_reserve_send(text,text,text,text,text,text,text,text,text,text)','EXECUTE')
    AND NOT has_function_privilege('anon','public.fama_chat_record_message(text,text,text,text,text,text,text,text,text,timestamptz)','EXECUTE')
    AND has_function_privilege('service_role','public.fama_chat_reserve_send(text,text,text,text,text,text,text,text,text,text)','EXECUTE')
    AND NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname IN ('fama_chat_record_message','fama_chat_reserve_send','fama_chat_message_page','fama_chat_delivery') AND prosecdef));
  thread_a:=public.fama_chat_record_message(conn_a,repeat('a',64),'fama:v1:phone','fama:v1:name','wamid.validation.in','fama:v1:body','text','in','',now());
  INSERT INTO inbox_checks VALUES('Customer messages work with AI paused',thread_a IS NOT NULL AND (SELECT last_inbound_at IS NOT NULL FROM public.fama_chat_conversations WHERE id=thread_a));
  thread_b:=public.fama_chat_record_message(conn_a,repeat('a',64),'fama:v1:phone','','wamid.validation.in','fama:v1:body','text','in','',now());
  INSERT INTO inbox_checks VALUES('Provider retry is idempotent',thread_b IS NULL AND (SELECT count(*) FROM public.fama_chat_messages WHERE connection_id=conn_a)=1);
  result:=public.fama_chat_reserve_send(org_a,conn_a,thread_a,'','',request_id,repeat('b',64),'fama:v1:reply','text','chat-test-user');
  message_id:=result->'message'->>'id';
  INSERT INTO inbox_checks VALUES('A send is persisted before delivery',result->>'created'='true' AND result->'message'->>'status'='sending');
  retry:=public.fama_chat_reserve_send(org_a,conn_a,thread_a,'','',request_id,repeat('b',64),'fama:v1:reply','text','chat-test-user');
  INSERT INTO inbox_checks VALUES('Repeated request shares the same message',retry->>'created'='false' AND retry->'message'->>'id'=message_id);
  BEGIN
    PERFORM public.fama_chat_reserve_send(org_a,conn_a,thread_a,'','',request_id,repeat('c',64),'fama:v1:changed','text','chat-test-user');
    INSERT INTO inbox_checks VALUES('Changed payload cannot reuse identity',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO inbox_checks VALUES('Changed payload cannot reuse identity',true); END;
  BEGIN
    PERFORM public.fama_chat_reserve_send(org_a,conn_a,thread_a,'','',request_id,repeat('b',64),'fama:v1:reply','text','other-user');
    INSERT INTO inbox_checks VALUES('Another user cannot reuse identity',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO inbox_checks VALUES('Another user cannot reuse identity',true); END;
  UPDATE public.fama_chat_messages SET provider_message_id='wamid.validation.out',status='sent' WHERE id=message_id;
  changed:=public.fama_chat_delivery(conn_a,'wamid.validation.out',repeat('d',64),'read');
  INSERT INTO inbox_checks VALUES('Delivery checks the exact recipient',NOT changed AND (SELECT status FROM public.fama_chat_messages WHERE id=message_id)='sent');
  changed:=public.fama_chat_delivery(conn_a,'wamid.validation.out',repeat('a',64),'delivered');
  changed:=public.fama_chat_delivery(conn_a,'wamid.validation.out',repeat('a',64),'read');
  changed:=public.fama_chat_delivery(conn_a,'wamid.validation.out',repeat('a',64),'sent');
  INSERT INTO inbox_checks VALUES('Read status never regresses',NOT changed AND (SELECT status FROM public.fama_chat_messages WHERE id=message_id)='read');
  BEGIN
    INSERT INTO public.fama_chat_messages(organization_id,connection_id,conversation_id,direction,kind,body_ciphertext,status)
      VALUES(org_b,conn_a,thread_a,'out','text','fama:v1:foreign','sent');
    INSERT INTO inbox_checks VALUES('Composite keys reject foreign company messages',false);
  EXCEPTION WHEN foreign_key_violation THEN INSERT INTO inbox_checks VALUES('Composite keys reject foreign company messages',true); END;
  BEGIN
    PERFORM public.fama_chat_message_page(org_b,conn_a,thread_a,'');
    INSERT INTO inbox_checks VALUES('History rejects foreign company',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO inbox_checks VALUES('History rejects foreign company',true); END;
  UPDATE public.fama_chat_conversations SET last_inbound_at=now()-interval '25 hours' WHERE id=thread_a;
  BEGIN
    PERFORM public.fama_chat_reserve_send(org_a,conn_a,thread_a,'','',gen_random_uuid()::text,repeat('e',64),'fama:v1:late','text','chat-test-user');
    INSERT INTO inbox_checks VALUES('Text requires an open 24 hour window',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO inbox_checks VALUES('Text requires an open 24 hour window',true); END;
  retry:=public.fama_chat_reserve_send(org_a,conn_a,thread_a,'','',gen_random_uuid()::text,repeat('e',64),'fama:v1:template','template','chat-test-user');
  INSERT INTO inbox_checks VALUES('Templates can resume expired conversations',retry->>'created'='true' AND retry->'message'->>'kind'='template');
  INSERT INTO public.fama_chat_messages(organization_id,connection_id,conversation_id,direction,kind,body_ciphertext,status,occurred_at)
    SELECT org_a,conn_a,thread_a,'in','text','fama:v1:history','received',now()-make_interval(secs=>i) FROM generate_series(1,110) AS t(i);
  SELECT count(*) INTO page_size FROM public.fama_chat_message_page(org_a,conn_a,thread_a,'');
  SELECT id INTO cursor_id FROM public.fama_chat_message_page(org_a,conn_a,thread_a,'') OFFSET 99 LIMIT 1;
  SELECT count(*) INTO older_size FROM public.fama_chat_message_page(org_a,conn_a,thread_a,cursor_id);
  INSERT INTO inbox_checks VALUES('History is bounded with a correct older cursor',page_size=101 AND older_size=13);
  UPDATE public.fama_whatsapp_connections SET phone_number_id='333333333' WHERE id=conn_a;
  BEGIN
    PERFORM public.fama_chat_reserve_send(org_a,conn_a,thread_a,'','',request_id,repeat('b',64),'fama:v1:reply','text','chat-test-user');
    INSERT INTO inbox_checks VALUES('Changing the business number prevents old thread sends',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO inbox_checks VALUES('Changing the business number prevents old thread sends',true); END;
  IF (SELECT count(*) FROM inbox_checks)<>16 OR EXISTS(SELECT 1 FROM inbox_checks WHERE passed IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Chat inbox validation failed'; END IF;
END; $$;
SELECT count(*) AS checks,count(*) FILTER(WHERE passed) AS passed,jsonb_agg(label ORDER BY label) AS verified FROM inbox_checks;
ROLLBACK;
SELECT 'All 16 checks passed; temporary rows rolled back' AS result;
