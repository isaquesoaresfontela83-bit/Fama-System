-- Opcional: pg_cron. Os horários preservam o cronograma capturado; confira cron.timezone.

-- As tarefas são criadas DESATIVADAS no destino. Ative apenas após configurar o novo ambiente.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule('fama-control-daily-backup', '0 6 * * *', 'select private.fama_control_daily_backup()');

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='fama-control-daily-backup'), active := false);

SELECT cron.schedule('fama-control-followup-reminders', '0 9 * * *', 'select private.fama_generate_followups()');

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='fama-control-followup-reminders'), active := false);

SELECT cron.schedule('fama-control-recurring-billing', '15 9 * * *', 'select private.fama_recurring_billing()');

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='fama-control-recurring-billing'), active := false);

SELECT cron.schedule('fama-control-visit-delays', '*/15 * * * *', 'select private.fama_update_visit_delays()');

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='fama-control-visit-delays'), active := false);
