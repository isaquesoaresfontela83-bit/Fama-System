-- RLS PROPOSED ONLY. Automatic review rejected this part of the combined production proposal.
-- The six pure JSON function settings were approved separately, applied and verified.
-- Their exact SQL and rollback are in applied-json-search-path.sql.
-- The two tables are owned by fama_control_backend and have no anon/authenticated SELECT grant.
-- Before any future approval: recheck ownership, grants, function definitions and a verified backup.

ALTER TABLE fama_control_runtime.fama_platform_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fama_control_runtime.fama_provider_activity ENABLE ROW LEVEL SECURITY;

-- Verification must confirm the functions still return the expected JSON and backend reads work.
-- Rollback for this exact captured configuration, only if this change was applied:
-- ALTER TABLE fama_control_runtime.fama_platform_integrations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE fama_control_runtime.fama_provider_activity DISABLE ROW LEVEL SECURITY;
