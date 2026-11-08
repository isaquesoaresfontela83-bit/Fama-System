-- Historical proposal: the RLS migration was explicitly authorized, applied and verified
-- on 2026-11-08. Exact guarded SQL and rollback: applied-private-control-rls.sql.
-- Empty table snapshot and isolated restore test were verified beforehand.
-- This file is documentation; use the recorded migration to avoid duplicate execution.

-- ALTER TABLE fama_control_runtime.fama_platform_integrations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fama_control_runtime.fama_provider_activity ENABLE ROW LEVEL SECURITY;
