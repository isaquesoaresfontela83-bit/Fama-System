BEGIN;
DO $test$
DECLARE org_id text:=gen_random_uuid()::text; customer_id text:=gen_random_uuid()::text; plan_id text:=gen_random_uuid()::text;
 subscription_id text:=gen_random_uuid()::text; disabled_id text:=gen_random_uuid()::text;
 due_on date:=(date_trunc('month',now())-interval '1 day')::date;
 anchor_on date:=make_date(extract(year FROM now())::integer-1,1,31);
 expected_due date:=(date_trunc('month',now())+interval '1 month'-interval '1 day')::date;
BEGIN
 INSERT INTO public.organizations(id,name,slug,name_key,created_by_user_id,billing_enabled,block_on_expiry)
 VALUES(org_id,'Teste transacional de cobrança',org_id,org_id,'system:rollback-test',false,false);
 INSERT INTO public.customers(id,organization_id,name) VALUES(customer_id,org_id,'Teste de cobrança');
 INSERT INTO public.maintenance_plans(id,organization_id,name,monthly_cents) VALUES(plan_id,org_id,'Teste',10000);
 INSERT INTO public.customer_subscriptions(id,organization_id,customer_id,plan_id,starts_on,next_due_on,monthly_cents,auto_billing)
 VALUES(subscription_id,org_id,customer_id,plan_id,anchor_on,due_on,10000,true),
       (disabled_id,org_id,customer_id,plan_id,anchor_on,due_on,10000,false);
 INSERT INTO public.transactions(id,organization_id,description,type,category,amount_cents,due_date,status)
 VALUES(gen_random_uuid()::text,org_id,'Data inválida','receita','teste',1,'2026-99-99','pendente');
 PERFORM private.fama_recurring_billing();
 PERFORM private.fama_recurring_billing();
 IF (SELECT count(*) FROM public.transactions tx WHERE tx.organization_id=org_id AND tx.subscription_id IS NOT NULL)<>1
 THEN RAISE EXCEPTION 'Recorrência não idempotente'; END IF;
 IF (SELECT cs.next_due_on FROM public.customer_subscriptions cs WHERE cs.id=disabled_id)<>due_on
 THEN RAISE EXCEPTION 'Cobrança automática desativada foi alterada'; END IF;
 IF (SELECT cs.next_due_on FROM public.customer_subscriptions cs WHERE cs.id=subscription_id)<>expected_due
 THEN RAISE EXCEPTION 'Âncora mensal incorreta'; END IF;
 IF private.fama_safe_due_date('2026-99-99') IS NOT NULL THEN RAISE EXCEPTION 'Data inválida aceita'; END IF;
END $test$;
ROLLBACK;
SELECT jsonb_build_object('passed',true,'rolled_back',true,'checks',array['no_ambiguity','one_charge_after_two_runs','disabled_auto_billing','month_end_anchor','malformed_due_date']) AS verification;
