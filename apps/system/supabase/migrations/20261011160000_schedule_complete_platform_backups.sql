-- The matching bearer token is kept in Supabase Vault and Sites secrets.
-- This migration contains no credential.
CREATE OR REPLACE FUNCTION private.fama_invoke_full_backup() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE service_token text;
BEGIN
 SELECT decrypted_secret INTO service_token FROM vault.decrypted_secrets WHERE name='fama_backup_service_token';
 IF coalesce(service_token,'')='' THEN RAISE EXCEPTION 'Full backup service token is not configured'; END IF;
 RETURN net.http_post(url:='https://control.famasystem.online/api/internal/backup',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_token),
   body:='{}'::jsonb,timeout_milliseconds:=30000);
END $function$;
REVOKE ALL ON FUNCTION private.fama_invoke_full_backup() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.fama_prune_full_backups() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
BEGIN
 DELETE FROM public.fama_full_backup_runs WHERE scheduled AND status IN ('complete','failed') AND created_at<now()-interval '30 days';
 DELETE FROM public.fama_control_backups source WHERE source.created_by_user_id='system:full-backup' AND source.created_at<now()-interval '30 days'
 AND NOT EXISTS(SELECT 1 FROM public.fama_full_backup_runs run WHERE run.source_backup_id=source.id);
END $function$;
REVOKE ALL ON FUNCTION private.fama_prune_full_backups() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('fama-full-platform-backup','* * * * *','SELECT private.fama_invoke_full_backup();');
SELECT cron.schedule('fama-full-platform-backup-retention','30 6 * * *','SELECT private.fama_prune_full_backups();');
