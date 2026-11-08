-- Explicitly authorized on 2026-11-08. Applied via Supabase migration
-- audit_enable_private_control_tables_rls after the empty-table snapshot and
-- isolated PGlite restore/owner CRUD/unauthorized-role/rollback test passed.
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='15s';
DO $guard$ BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fama_control_runtime' AND c.relname IN ('fama_platform_integrations','fama_provider_activity') AND pg_get_userbyid(c.relowner)='fama_control_backend' AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relacl IS NULL) <> 2 THEN RAISE EXCEPTION 'Private table ownership/ACL/RLS changed since verified backup'; END IF;
 IF EXISTS(SELECT 1 FROM fama_control_runtime.fama_platform_integrations) OR EXISTS(SELECT 1 FROM fama_control_runtime.fama_provider_activity) THEN RAISE EXCEPTION 'Tables no longer empty: refresh backup before migration'; END IF;
END $guard$;
ALTER TABLE fama_control_runtime.fama_platform_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fama_control_runtime.fama_provider_activity ENABLE ROW LEVEL SECURITY;
SET LOCAL ROLE fama_control_backend;
DO $verify$ BEGIN
 IF row_security_active('fama_control_runtime.fama_platform_integrations') OR row_security_active('fama_control_runtime.fama_provider_activity') THEN RAISE EXCEPTION 'Backend access unexpectedly subject to RLS'; END IF;
 PERFORM count(*) FROM fama_control_runtime.fama_platform_integrations;
 PERFORM count(*) FROM fama_control_runtime.fama_provider_activity;
END $verify$;
RESET ROLE;

-- Exact rollback (only security flags, no row/table deletion):
-- ALTER TABLE fama_control_runtime.fama_platform_integrations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE fama_control_runtime.fama_provider_activity DISABLE ROW LEVEL SECURITY;
