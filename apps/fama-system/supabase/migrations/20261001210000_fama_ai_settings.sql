-- Global assistant preferences, shared with users. Operational records stay in
-- their existing tenant tables; no customer data belongs in this table.
CREATE TABLE public.fama_ai_settings (
  id text PRIMARY KEY CHECK (id = 'global'),
  config jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object' AND octet_length(config::text) <= 50000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fama_ai_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fama_ai_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.fama_ai_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fama_ai_settings TO service_role;
CREATE POLICY assistant_preferences_read ON public.fama_ai_settings
  FOR SELECT TO anon, authenticated USING (id = 'global');
-- Only the authenticated Fama Control server uses service_role
-- to change preferences. Browsers and company members cannot write directly.
INSERT INTO public.fama_ai_settings (id, config) VALUES ('global', '{
  "enabled": true, "name": "Fama IA interna",
  "welcome": "Consulte compromissos, pendências, estoque e os demais módulos disponíveis. Para buscar um nome, use “buscar: nome”.",
  "maxItems": 20, "allowNavigation": true, "allowCreate": true, "detectConflicts": true,
  "sources": {"overview":true,"agenda":true,"crm":true,"quotes":true,"orders":true,"customers":true,"inventory":true,"finance":true,"team":true,"warranties":true,"contracts":true,"companies":true,"users":true,"audit":true,"backup":true,"privacy":true},
  "commands": []
}');

-- Service-only transaction: compare the revision and audit the change atomically.
CREATE FUNCTION public.fama_save_ai_settings(p_settings jsonb, p_revision integer, p_actor_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  saved public.fama_ai_settings%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR pg_catalog.length(p_actor_user_id) = 0
     OR p_revision IS NULL OR p_revision < 1 OR p_revision >= 2147483647
     OR p_settings IS NULL OR pg_catalog.jsonb_typeof(p_settings) <> 'object'
     OR pg_catalog.octet_length(p_settings::text) > 50000 THEN
    RAISE EXCEPTION 'Invalid assistant preferences' USING ERRCODE = '22023';
  END IF;
  UPDATE public.fama_ai_settings
    SET config = p_settings, revision = revision + 1, updated_at = pg_catalog.now()
    WHERE id = 'global' AND revision = p_revision
    RETURNING * INTO saved;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.audit_logs (organization_id, actor_user_id, event_type, entity_type, record_id, metadata, occurred_at)
    VALUES (NULL, p_actor_user_id, 'security', 'fama_ai_settings', 'global',
      pg_catalog.jsonb_build_object('previousRevision', p_revision, 'revision', saved.revision, 'enabled', saved.config -> 'enabled'), pg_catalog.now());
  RETURN pg_catalog.jsonb_build_object('settings', saved.config, 'revision', saved.revision, 'updatedAt', saved.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION public.fama_save_ai_settings(jsonb, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fama_save_ai_settings(jsonb, integer, text) TO service_role;
