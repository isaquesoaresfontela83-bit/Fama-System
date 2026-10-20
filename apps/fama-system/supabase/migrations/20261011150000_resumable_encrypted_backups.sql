ALTER TABLE public.fama_full_backup_runs ADD COLUMN lease_id text NOT NULL DEFAULT '', ADD COLUMN lease_until timestamptz;
CREATE OR REPLACE FUNCTION public.fama_start_full_backup(p_scheduled boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE active_run public.fama_full_backup_runs; source_id text; meta jsonb; run_id text:=gen_random_uuid()::text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('fama-full-backup-start',0));
 SELECT * INTO active_run FROM public.fama_full_backup_runs WHERE status='running' ORDER BY created_at LIMIT 1;
 IF FOUND THEN RETURN to_jsonb(active_run); END IF;
 source_id:=public.fama_create_backup_snapshot()->>'id'; meta:=public.fama_backup_snapshot_meta(source_id);
 INSERT INTO public.fama_full_backup_runs(id,source_backup_id,status,scheduled,manifest)
 VALUES(run_id,source_id,'running',p_scheduled,jsonb_build_object('source',meta,'stage','postgres','index',0,'offset',0,'partCount',0,'parts','[]'::jsonb,'fileCount',0)) RETURNING * INTO active_run;
 RETURN to_jsonb(active_run);
END $function$;
CREATE OR REPLACE FUNCTION public.fama_claim_backup_run(p_run_id text,p_lease_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE active_run public.fama_full_backup_runs;
BEGIN
 UPDATE public.fama_full_backup_runs SET lease_id=p_lease_id,lease_until=now()+interval '2 minutes'
 WHERE id=p_run_id AND status='running' AND (lease_until IS NULL OR lease_until<now()) RETURNING * INTO active_run;
 RETURN CASE WHEN active_run.id IS NULL THEN NULL ELSE to_jsonb(active_run) END;
END $function$;
CREATE OR REPLACE FUNCTION public.fama_put_backup_part(p_run_id text,p_lease_id text,p_number integer,p_payload text,p_checksum text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fama_full_backup_runs WHERE id=p_run_id AND status='running' AND lease_id=p_lease_id AND lease_until>=now()) THEN RAISE EXCEPTION 'Backup lease expired'; END IF;
 IF p_number<0 OR length(p_payload)>6000000 OR p_payload NOT LIKE 'fama:v1:%' THEN RAISE EXCEPTION 'Invalid encrypted backup part'; END IF;
 INSERT INTO public.fama_full_backup_parts(id,run_id,part_number,payload,checksum)
 VALUES(p_run_id||':'||p_number,p_run_id,p_number,p_payload,p_checksum)
 ON CONFLICT(run_id,part_number) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum;
 RETURN true;
END $function$;
CREATE OR REPLACE FUNCTION public.fama_commit_backup_run(p_run_id text,p_lease_id text,p_manifest jsonb,p_status text,p_manifest_payload text DEFAULT '',p_error text DEFAULT '') RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE changed integer;
BEGIN
 IF p_status NOT IN ('running','complete','failed') THEN RAISE EXCEPTION 'Invalid backup status'; END IF;
 IF p_status='complete' AND (p_manifest->'verification'->>'valid'<>'true' OR p_manifest_payload NOT LIKE 'fama:v1:%') THEN RAISE EXCEPTION 'Unverified backup cannot be completed'; END IF;
 UPDATE public.fama_full_backup_runs SET manifest=p_manifest,status=p_status,manifest_payload=p_manifest_payload,error=p_error,
 completed_at=CASE WHEN p_status='complete' THEN now() ELSE NULL END,lease_id='',lease_until=NULL
 WHERE id=p_run_id AND status='running' AND lease_id=p_lease_id;
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $function$;
DO $grants$
DECLARE procedure record;
BEGIN
 FOR procedure IN SELECT p.oid::regprocedure AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('fama_start_full_backup','fama_claim_backup_run','fama_put_backup_part','fama_commit_backup_run') LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',procedure.name);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',procedure.name);
 END LOOP;
END $grants$;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
