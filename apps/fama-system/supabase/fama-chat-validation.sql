-- Every temporary company, member, rule and audit entry is rolled back.
BEGIN;
CREATE TEMP TABLE chat_checks(label text, passed boolean);
DO $$
DECLARE org_a text := gen_random_uuid()::text; org_b text := gen_random_uuid()::text;
  member_a text := gen_random_uuid()::text; bundle jsonb;
BEGIN
  INSERT INTO public.organizations(id,name,name_key,slug,status,created_by_user_id)
    VALUES (org_a,'Chat Validation A','chat validation '||org_a,'chat-validation-'||org_a,'active','chat-validation'),
           (org_b,'Chat Validation B','chat validation '||org_b,'chat-validation-'||org_b,'active','chat-validation');
  INSERT INTO public.organization_members(id,organization_id,user_id,user_email,display_name,role,status,permissions)
    VALUES (member_a,org_a,'','chat-'||member_a||'@example.test','Temporary owner','owner','active','[]');
  bundle := public.fama_save_block_rule('organization',org_a,'','{"chat":false}',0,'chat-validation');
  INSERT INTO chat_checks VALUES ('Company can remove Chat', bundle->'organization'->'overrides'='{"chat":false}'::jsonb AND bundle->'organization'->>'revision'='1');
  bundle := public.fama_save_block_rule('member',org_a,member_a,'{"chat":true}',0,'chat-validation');
  INSERT INTO chat_checks VALUES ('Individual can add Chat', bundle->'member'->'overrides'='{"chat":true}'::jsonb AND bundle->'member'->>'revision'='1');
  bundle := public.fama_get_block_rules(org_a,member_a);
  INSERT INTO chat_checks VALUES ('Chat rules read back together', bundle->'organization'->'overrides'->>'chat'='false' AND bundle->'member'->'overrides'->>'chat'='true');
  INSERT INTO chat_checks VALUES ('Rules remain isolated by company', public.fama_get_block_rules(org_b,'')->'organization'->'overrides'='{}'::jsonb);
  INSERT INTO chat_checks VALUES ('Stale edits cannot overwrite Chat', public.fama_save_block_rule('member',org_a,member_a,'{"chat":false}',0,'chat-validation') IS NULL AND public.fama_get_block_rules(org_a,member_a)->'member'->'overrides'='{"chat":true}'::jsonb);
  BEGIN
    PERFORM public.fama_save_block_rule('member',org_b,member_a,'{"chat":true}',0,'chat-validation');
    INSERT INTO chat_checks VALUES ('Foreign member rejected',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO chat_checks VALUES ('Foreign member rejected',true); END;
  BEGIN
    PERFORM public.fama_save_block_rule('organization',org_a,'','{"chat":"true"}',1,'chat-validation');
    INSERT INTO chat_checks VALUES ('Nonboolean Chat rule rejected',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO chat_checks VALUES ('Nonboolean Chat rule rejected',true); END;
  INSERT INTO chat_checks VALUES ('Browser roles cannot save rules', NOT has_function_privilege('anon','public.fama_save_block_rule(text,text,text,jsonb,integer,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.fama_save_block_rule(text,text,text,jsonb,integer,text)','EXECUTE') AND has_function_privilege('service_role','public.fama_save_block_rule(text,text,text,jsonb,integer,text)','EXECUTE'));
  INSERT INTO chat_checks VALUES ('Profile permissions preserved', (SELECT permissions FROM public.organization_members WHERE id=member_a)='[]'::jsonb);
  INSERT INTO chat_checks VALUES ('Only successful changes create audits', (SELECT count(*) FROM public.audit_logs WHERE actor_user_id='chat-validation')=2);
  IF (SELECT count(*) FROM chat_checks)<>10 OR EXISTS (SELECT 1 FROM chat_checks WHERE passed IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Chat validation failed'; END IF;
END; $$;
SELECT count(*) AS checks, count(*) FILTER (WHERE passed) AS passed, jsonb_agg(label ORDER BY label) AS verified FROM chat_checks;
ROLLBACK;
SELECT 'All 10 Chat checks passed; temporary rows rolled back' AS result;
