CREATE OR REPLACE FUNCTION public.fama_commit_backup_run(p_run_id text,p_lease_id text,p_manifest jsonb,p_status text,p_manifest_payload text DEFAULT '',p_error text DEFAULT '') RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE changed integer;
BEGIN
 IF p_status NOT IN ('running','complete','failed') THEN RAISE EXCEPTION 'Invalid backup status'; END IF;
 IF p_status='complete' AND ((p_manifest->'verification'->>'valid') IS DISTINCT FROM 'true' OR coalesce(p_manifest_payload,'') NOT LIKE 'fama:v1:%') THEN RAISE EXCEPTION 'Unverified backup cannot be completed'; END IF;
 UPDATE public.fama_full_backup_runs SET manifest=p_manifest,status=p_status,manifest_payload=p_manifest_payload,error=p_error,
 completed_at=CASE WHEN p_status='complete' THEN now() ELSE NULL END,lease_id='',lease_until=NULL
 WHERE id=p_run_id AND status='running' AND lease_id=p_lease_id;
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $function$;