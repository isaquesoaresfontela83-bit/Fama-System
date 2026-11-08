-- APPLIED through Supabase migration audit_pin_pure_json_helpers_search_path on 2026-11-08 UTC.
-- Narrower approved alternative after the combined RLS proposal was rejected.
-- Six invoker/IMMUTABLE JSON functions; built-ins only; no body, ownership, privilege or data changes.
-- All six baseline and post-change SELECT assertions passed; six advisor warnings were removed.

ALTER FUNCTION fama_system_runtime.fama_json_valid(text) SET search_path = '';
ALTER FUNCTION fama_system_runtime.fama_json_set(text,text,text,text,text) SET search_path = '';
ALTER FUNCTION fama_system_runtime.fama_json_object(text,text,text,numeric) SET search_path = '';
ALTER FUNCTION fama_control_runtime.fama_json_valid(text) SET search_path = '';
ALTER FUNCTION fama_control_runtime.fama_json_set(text,text,text,text,text) SET search_path = '';
ALTER FUNCTION fama_control_runtime.fama_json_object(text,text,text,numeric) SET search_path = '';

-- Exact configuration rollback, only if a verified regression requires it:
-- ALTER FUNCTION fama_system_runtime.fama_json_valid(text) RESET search_path;
-- ALTER FUNCTION fama_system_runtime.fama_json_set(text,text,text,text,text) RESET search_path;
-- ALTER FUNCTION fama_system_runtime.fama_json_object(text,text,text,numeric) RESET search_path;
-- ALTER FUNCTION fama_control_runtime.fama_json_valid(text) RESET search_path;
-- ALTER FUNCTION fama_control_runtime.fama_json_set(text,text,text,text,text) RESET search_path;
-- ALTER FUNCTION fama_control_runtime.fama_json_object(text,text,text,numeric) RESET search_path;
