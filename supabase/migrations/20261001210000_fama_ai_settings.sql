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
-- Only the authenticated Fama Control admin Edge action uses service_role
-- to change preferences. Browsers and company members cannot write directly.
INSERT INTO public.fama_ai_settings (id, config) VALUES ('global', '{
  "enabled": true, "name": "Fama IA interna",
  "welcome": "Consulte compromissos, pendências, estoque e os demais módulos disponíveis. Para buscar um nome, use “buscar: nome”.",
  "maxItems": 20, "allowNavigation": true, "allowCreate": true, "detectConflicts": true,
  "sources": {"overview":true,"agenda":true,"crm":true,"quotes":true,"orders":true,"customers":true,"inventory":true,"finance":true,"team":true,"warranties":true,"contracts":true,"companies":true,"users":true,"audit":true,"backup":true,"privacy":true},
  "commands": []
}');
