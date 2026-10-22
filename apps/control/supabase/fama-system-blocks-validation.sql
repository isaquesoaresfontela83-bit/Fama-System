-- All fixtures, rule writes and audit entries are rolled back. No real access changes.
BEGIN;
CREATE TEMP TABLE block_checks(label text,passed boolean);
DO $$
DECLARE org_a text:=gen_random_uuid()::text; org_b text:=gen_random_uuid()::text;
  member_a text:=gen_random_uuid()::text; member_b text:=gen_random_uuid()::text;
  bundle jsonb; revision_before integer; audit_before bigint;
BEGIN
  INSERT INTO public.organizations(id,name,name_key,slug,status,created_by_user_id)
    VALUES(org_a,'Fama Block Validation A','fama block validation '||org_a,'block-validation-'||org_a,'active','blocks-validation'),
          (org_b,'Fama Block Validation B','fama block validation '||org_b,'block-validation-'||org_b,'active','blocks-validation');
  INSERT INTO public.organization_members(id,organization_id,user_id,user_email,display_name,role,status,permissions)
    VALUES(member_a,org_a,'','blocks-a-'||member_a||'@example.test','Temporary owner','owner','active','[]'),
          (member_b,org_b,'','blocks-b-'||member_b||'@example.test','Temporary member','member','active','["crm"]');
  INSERT INTO block_checks VALUES('Private storage denies browser reads and writes',NOT has_table_privilege('anon','public.platform_settings','SELECT') AND NOT has_table_privilege('authenticated','public.platform_settings','UPDATE'));
  INSERT INTO block_checks VALUES('Read and save functions are service-only',NOT has_function_privilege('anon','public.fama_get_block_rules(text,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.fama_save_block_rule(text,text,text,jsonb,integer,text)','EXECUTE') AND has_function_privilege('service_role','public.fama_save_block_rule(text,text,text,jsonb,integer,text)','EXECUTE'));
  bundle:=public.fama_get_block_rules(org_a,member_a);
  INSERT INTO block_checks VALUES('New companies and people inherit without new rules',bundle->'organization'->'overrides'='{}'::jsonb AND bundle->'member'->'overrides'='{}'::jsonb);
  revision_before:=(bundle->'global'->>'revision')::integer;
  bundle:=public.fama_save_block_rule('global','','','{"finance":false,"assistant":false}',revision_before,'blocks-validation');
  INSERT INTO block_checks VALUES('Global changes persist with revision confirmation',bundle->'global'->'overrides'='{"finance":false,"assistant":false}'::jsonb AND (bundle->'global'->>'revision')::integer=revision_before+1);
  bundle:=public.fama_save_block_rule('organization',org_a,'','{"finance":true}',0,'blocks-validation');
  INSERT INTO block_checks VALUES('Company exception preserves inherited global settings',bundle->'global'->'overrides'->>'assistant'='false' AND bundle->'organization'->'overrides'->>'finance'='true');
  bundle:=public.fama_save_block_rule('member',org_a,member_a,'{"finance":false,"assistant":true}',0,'blocks-validation');
  INSERT INTO block_checks VALUES('Owner can receive individual block rules',bundle->'member'->'overrides'='{"finance":false,"assistant":true}'::jsonb AND (SELECT role FROM public.organization_members WHERE id=member_a)='owner');
  bundle:=public.fama_get_block_rules(org_b,member_b);
  INSERT INTO block_checks VALUES('Company and person exceptions do not leak to another tenant',bundle->'organization'->'overrides'='{}'::jsonb AND bundle->'member'->'overrides'='{}'::jsonb);
  SELECT count(*) INTO audit_before FROM public.audit_logs WHERE actor_user_id='blocks-validation';
  bundle:=public.fama_save_block_rule('member',org_a,member_a,'{"crm":true}',0,'blocks-validation');
  INSERT INTO block_checks VALUES('Stale edits cannot overwrite newer rules or add audits',bundle IS NULL AND (SELECT count(*) FROM public.audit_logs WHERE actor_user_id='blocks-validation')=audit_before AND public.fama_get_block_rules(org_a,member_a)->'member'->'overrides'='{"finance":false,"assistant":true}'::jsonb);
  BEGIN
    PERFORM public.fama_save_block_rule('member',org_a,member_b,'{"finance":true}',0,'blocks-validation');
    INSERT INTO block_checks VALUES('Foreign member writes rejected',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO block_checks VALUES('Foreign member writes rejected',true); END;
  BEGIN
    PERFORM public.fama_get_block_rules(org_a,member_b);
    INSERT INTO block_checks VALUES('Foreign member reads rejected',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO block_checks VALUES('Foreign member reads rejected',true); END;
  BEGIN
    PERFORM public.fama_save_block_rule('organization',org_a,'','{"unknown":true}',1,'blocks-validation');
    INSERT INTO block_checks VALUES('Unknown blocks rejected at database boundary',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO block_checks VALUES('Unknown blocks rejected at database boundary',true); END;
  BEGIN
    PERFORM public.fama_save_block_rule('organization',org_a,'','{"crm":"true"}',1,'blocks-validation');
    INSERT INTO block_checks VALUES('Nonboolean rules rejected at database boundary',false);
  EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO block_checks VALUES('Nonboolean rules rejected at database boundary',true); END;
  bundle:=public.fama_save_block_rule('member',org_a,member_a,'{}',1,'blocks-validation');
  INSERT INTO block_checks VALUES('Restoring inheritance keeps a monotonic revision',bundle->'member'->'overrides'='{}'::jsonb AND bundle->'member'->>'revision'='2');
  INSERT INTO block_checks VALUES('Profile permissions remain unchanged', (SELECT permissions FROM public.organization_members WHERE id=member_a)='[]'::jsonb AND (SELECT permissions FROM public.organization_members WHERE id=member_b)='["crm"]'::jsonb);
  INSERT INTO block_checks VALUES('Every saved rule has an audit event', (SELECT count(*) FROM public.audit_logs WHERE actor_user_id='blocks-validation')=4);
  IF EXISTS(SELECT 1 FROM block_checks WHERE NOT passed OR passed IS NULL) THEN RAISE EXCEPTION 'Block validation failed'; END IF;
END; $$;
SELECT count(*) as checks,count(*) FILTER(WHERE passed) as passed,jsonb_agg(label ORDER BY label) as verified FROM block_checks;
ROLLBACK;
