-- Allow the official WhatsApp Web Chat module in existing block rules.
-- No access rules or company records are changed.
CREATE OR REPLACE FUNCTION public.fama_save_block_rule(p_scope text, p_organization_id text, p_member_id text, p_overrides jsonb, p_revision integer, p_actor_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE key_name text; saved public.platform_settings%ROWTYPE;
BEGIN
  IF p_scope IS NULL OR p_scope NOT IN ('global','organization','member') OR p_revision IS NULL OR p_revision < 0 OR p_revision >= 2147483647
    OR p_actor_user_id IS NULL OR pg_catalog.length(p_actor_user_id) = 0 OR pg_catalog.length(p_actor_user_id) > 128
    OR p_organization_id IS NULL OR p_member_id IS NULL
    OR p_overrides IS NULL OR pg_catalog.jsonb_typeof(p_overrides) <> 'object' OR pg_catalog.octet_length(p_overrides::text) > 4000 THEN
    RAISE EXCEPTION 'Invalid block rule' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(p_overrides) entry WHERE entry.key NOT IN ('dashboard','crm','chat','quotes','agenda','mobile','orders','warranties','customers','contracts','inventory','finance','team','assistant') OR pg_catalog.jsonb_typeof(entry.value) <> 'boolean') THEN
    RAISE EXCEPTION 'Unknown block or invalid option' USING ERRCODE = '22023';
  END IF;
  IF (p_scope = 'global' AND (p_organization_id <> '' OR p_member_id <> '')) OR (p_scope = 'organization' AND (p_organization_id = '' OR p_member_id <> '')) OR (p_scope = 'member' AND (p_organization_id = '' OR p_member_id = '')) THEN
    RAISE EXCEPTION 'Invalid target' USING ERRCODE = '22023';
  END IF;
  IF p_scope <> 'global' AND NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id AND status <> 'deleted') THEN
    RAISE EXCEPTION 'Company not found' USING ERRCODE = '22023';
  END IF;
  IF p_scope = 'member' AND NOT EXISTS (SELECT 1 FROM public.organization_members WHERE id = p_member_id AND organization_id = p_organization_id) THEN
    RAISE EXCEPTION 'Member does not belong to company' USING ERRCODE = '22023';
  END IF;
  key_name := CASE p_scope WHEN 'global' THEN 'fama_blocks:global' WHEN 'organization' THEN 'fama_blocks:organization:' || p_organization_id ELSE 'fama_blocks:member:' || p_member_id END;
  -- INSERT serializes first-write races. The revision update handles later races.
  INSERT INTO public.platform_settings(key,value,updated_at,updated_by)
    SELECT key_name,pg_catalog.jsonb_build_object('overrides','{}'::jsonb,'revision',0,'organizationId',p_organization_id),pg_catalog.now(),p_actor_user_id WHERE p_revision = 0 ON CONFLICT(key) DO NOTHING;
  UPDATE public.platform_settings SET value = pg_catalog.jsonb_build_object('overrides',p_overrides,'revision',p_revision+1,'organizationId',p_organization_id),updated_at=pg_catalog.now(),updated_by=p_actor_user_id
    WHERE key=key_name AND (value->>'revision')::integer=p_revision RETURNING * INTO saved;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.audit_logs(organization_id,actor_user_id,event_type,entity_type,record_id,metadata,occurred_at)
    VALUES (NULLIF(p_organization_id,''),p_actor_user_id,'security','fama_system_blocks',key_name,pg_catalog.jsonb_build_object('scope',p_scope,'previousRevision',p_revision,'revision',p_revision+1,'overrides',p_overrides),pg_catalog.now());
  RETURN public.fama_get_block_rules(p_organization_id,p_member_id);
END; $$;
REVOKE ALL ON FUNCTION public.fama_get_block_rules(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fama_save_block_rule(text,text,text,jsonb,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fama_get_block_rules(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fama_save_block_rule(text,text,text,jsonb,integer,text) TO service_role;
NOTIFY pgrst,'reload schema';
