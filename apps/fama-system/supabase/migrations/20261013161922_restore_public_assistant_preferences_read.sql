-- The 2026-10-11 hardening revoked access to every operational table, including
-- this intentionally public table. Both Sites read these shared preferences
-- using the publishable key; no tenant records or credentials belong here.
-- Restore read-only access after hardening without enabling direct writes.
ALTER TABLE public.fama_ai_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.fama_ai_settings TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.fama_ai_settings FROM anon, authenticated;

-- The existing assistant_preferences_read policy permits only id = 'global'.
-- Saving still requires the service-only fama_save_ai_settings RPC.
NOTIFY pgrst, 'reload schema';
