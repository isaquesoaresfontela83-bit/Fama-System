-- Recovery snapshot: both tables contained zero rows on 2026-11-08.
-- Restore only in a recovery database where these tables do not exist.
-- Roles must already exist. This script never drops or overwrites a table.
CREATE SCHEMA IF NOT EXISTS fama_control_runtime;
CREATE TABLE fama_control_runtime.fama_platform_integrations (
  provider text NOT NULL,
  encrypted_config text NOT NULL,
  revision integer NOT NULL,
  updated_at text NOT NULL,
  CONSTRAINT fama_platform_integrations_pkey PRIMARY KEY (provider)
);
ALTER TABLE fama_control_runtime.fama_platform_integrations OWNER TO fama_control_backend;
CREATE TABLE fama_control_runtime.fama_provider_activity (
  id text NOT NULL,
  provider text NOT NULL,
  action text NOT NULL,
  scope text NOT NULL,
  payload_hash text DEFAULT ''::text NOT NULL,
  status text NOT NULL,
  result_id text DEFAULT ''::text NOT NULL,
  created_at text NOT NULL,
  CONSTRAINT fama_provider_activity_pkey PRIMARY KEY (id)
);
ALTER TABLE fama_control_runtime.fama_provider_activity OWNER TO fama_control_backend;
REVOKE ALL ON fama_control_runtime.fama_platform_integrations, fama_control_runtime.fama_provider_activity
  FROM PUBLIC, anon, authenticated, service_role, fama_system_backend;
