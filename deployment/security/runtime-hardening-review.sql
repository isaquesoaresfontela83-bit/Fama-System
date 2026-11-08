-- PROPOSED ONLY. Automatic approval review rejected applying this production change.
-- No production schema or function setting was changed by this audit.
-- The functions below use only PostgreSQL built-ins; their six baseline SELECT checks passed.
-- The two tables are owned by fama_control_backend and have no anon/authenticated SELECT grant.
-- Before any future approval: recheck ownership, grants, function definitions and a verified backup.

ALTER FUNCTION fama_system_runtime.fama_json_valid(text) SET search_path = '';
ALTER FUNCTION fama_system_runtime.fama_json_set(text,text,text,text,text) SET search_path = '';
ALTER FUNCTION fama_system_runtime.fama_json_object(text,text,text,numeric) SET search_path = '';
ALTER FUNCTION fama_control_runtime.fama_json_valid(text) SET search_path = '';
ALTER FUNCTION fama_control_runtime.fama_json_set(text,text,text,text,text) SET search_path = '';
ALTER FUNCTION fama_control_runtime.fama_json_object(text,text,text,numeric) SET search_path = '';
ALTER TABLE fama_control_runtime.fama_platform_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fama_control_runtime.fama_provider_activity ENABLE ROW LEVEL SECURITY;

-- Verification must confirm the functions still return the expected JSON and backend reads work.
-- Rollback for this exact captured configuration, only if this change was applied:
-- ALTER FUNCTION fama_system_runtime.fama_json_valid(text) RESET search_path;
-- ALTER FUNCTION fama_system_runtime.fama_json_set(text,text,text,text,text) RESET search_path;
-- ALTER FUNCTION fama_system_runtime.fama_json_object(text,text,text,numeric) RESET search_path;
-- ALTER FUNCTION fama_control_runtime.fama_json_valid(text) RESET search_path;
-- ALTER FUNCTION fama_control_runtime.fama_json_set(text,text,text,text,text) RESET search_path;
-- ALTER FUNCTION fama_control_runtime.fama_json_object(text,text,text,numeric) RESET search_path;
-- ALTER TABLE fama_control_runtime.fama_platform_integrations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE fama_control_runtime.fama_provider_activity DISABLE ROW LEVEL SECURITY;
