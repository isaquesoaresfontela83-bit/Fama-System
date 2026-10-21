-- Browser sessions must use the server APIs, which enforce plan, quota and blocks.
DO $migration$
DECLARE relation record; procedure record;
BEGIN
  FOR relation IN SELECT c.oid::regclass AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','v','m')
      AND c.relname NOT LIKE 'pools_%' AND c.relname NOT LIKE 'pool_quote_%'
  LOOP
    EXECUTE format('REVOKE ALL ON %s FROM anon, authenticated', relation.name);
  END LOOP;
  FOR procedure IN SELECT p.oid::regprocedure AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (p.proname LIKE 'fama_%' OR p.proname='schedule_warranty')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', procedure.name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', procedure.name);
  END LOOP;
END $migration$;

CREATE OR REPLACE FUNCTION private.fama_safe_due_date(value text) RETURNS date
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path='' AS $function$
DECLARE result date;
BEGIN
  IF value !~ '^\d{4}-\d{2}-\d{2}' THEN RETURN NULL; END IF;
  BEGIN result := substring(value FROM 1 FOR 10)::date;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL; END;
  RETURN result;
END $function$;
REVOKE ALL ON FUNCTION private.fama_safe_due_date(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.fama_recurring_billing() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','public','pg_temp' AS $function$
DECLARE subscription_row record; due_on date; following_month date; anchor_day integer;
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  UPDATE public.transactions SET status='atrasado', updated_at=now()
    WHERE status IN ('aberto','pendente') AND private.fama_safe_due_date(due_date)<today;
  FOR subscription_row IN SELECT cs.* FROM public.customer_subscriptions cs
    WHERE cs.status='active' AND cs.auto_billing AND cs.next_due_on<=today
    ORDER BY cs.id FOR UPDATE
  LOOP
    due_on := subscription_row.next_due_on;
    anchor_day := extract(day FROM coalesce(subscription_row.starts_on,due_on));
    WHILE due_on<=today LOOP
      IF NOT EXISTS (SELECT 1 FROM public.transactions tx WHERE tx.organization_id=subscription_row.organization_id
        AND tx.subscription_id=subscription_row.id AND tx.due_date=due_on::text) THEN
        INSERT INTO public.transactions(id,organization_id,description,type,category,amount_cents,due_date,status,customer_id,subscription_id)
          VALUES(gen_random_uuid()::text,subscription_row.organization_id,'Mensalidade de plano','receita','mensalidade',
            subscription_row.monthly_cents,due_on::text,CASE WHEN due_on<today THEN 'atrasado' ELSE 'aberto' END,subscription_row.customer_id,subscription_row.id);
      END IF;
      following_month := (date_trunc('month',due_on)+interval '1 month')::date;
      due_on := following_month + (least(anchor_day,extract(day FROM following_month+interval '1 month'-interval '1 day')::integer)-1);
    END LOOP;
    UPDATE public.customer_subscriptions SET next_due_on=due_on,updated_at=now() WHERE id=subscription_row.id;
  END LOOP;
  UPDATE public.customer_subscriptions cs SET delinquent_since=coalesce(cs.delinquent_since,today),updated_at=now()
    WHERE EXISTS (SELECT 1 FROM public.transactions tx WHERE tx.organization_id=cs.organization_id AND tx.subscription_id=cs.id AND tx.status='atrasado');
  UPDATE public.customer_subscriptions cs SET delinquent_since=NULL,updated_at=now()
    WHERE cs.delinquent_since IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.transactions tx WHERE tx.organization_id=cs.organization_id AND tx.subscription_id=cs.id AND tx.status='atrasado');
END $function$;
REVOKE ALL ON FUNCTION private.fama_recurring_billing() FROM PUBLIC,anon,authenticated;
