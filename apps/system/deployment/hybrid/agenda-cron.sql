-- Executar após validar as duas APIs e armazenar no Vault:
-- fama_agenda_endpoint = URL HTTPS da API System + /api/internal/daily-agenda
-- fama_agenda_cron_secret = mesmo segredo de FAMA_AGENDA_CRON_SECRET no backend.
-- Não colocar valores dos segredos neste arquivo ou no frontend.
-- Nenhuma preferência de empresa é ativada por este script.
select cron.schedule('fama-daily-agenda','*/5 * * * *',$job$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='fama_agenda_endpoint' limit 1),
   headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='fama_agenda_cron_secret' limit 1)),
   body := '{}'::jsonb,timeout_milliseconds := 60000
 )
 where exists (
   select 1 from public.fama_agenda_settings s
   join public.employees e on e.organization_id=s.organization_id and e.active
   where s.enabled
     and (s.config::jsonb->'days') @> jsonb_build_array(extract(dow from now() at time zone 'America/Sao_Paulo')::int)
     and (now() at time zone 'America/Sao_Paulo')::time - (s.config::jsonb->>'time')::time >= interval '0 minutes'
     and (now() at time zone 'America/Sao_Paulo')::time - (s.config::jsonb->>'time')::time < interval '3 hours'
     and (jsonb_array_length(s.config::jsonb->'employeeIds')=0 or (s.config::jsonb->'employeeIds') ? e.id)
     and not exists(select 1 from public.fama_agenda_deliveries d where d.organization_id=s.organization_id and d.employee_id=e.id and d.day=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD'))
 )
 and exists(select 1 from vault.decrypted_secrets where name='fama_agenda_endpoint' and decrypted_secret like 'https://%/api/internal/daily-agenda')
 and exists(select 1 from vault.decrypted_secrets where name='fama_agenda_cron_secret' and length(decrypted_secret)>=32);
$job$);
