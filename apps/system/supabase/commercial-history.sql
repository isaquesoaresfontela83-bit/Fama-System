CREATE TABLE IF NOT EXISTS public.fama_subscription_events (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 old_plan_status text,
 new_plan_status text NOT NULL,
 billing_enabled boolean NOT NULL,
 billing_provider text NOT NULL,
 billing_payment_id text NOT NULL DEFAULT '',
 source text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fama_subscription_events_org_date ON public.fama_subscription_events(organization_id,occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fama_subscription_events_baseline ON public.fama_subscription_events(organization_id) WHERE source='baseline';
ALTER TABLE public.fama_subscription_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fama_subscription_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fama_subscription_events TO service_role;
CREATE OR REPLACE FUNCTION private.fama_track_subscription_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' OR ROW(OLD.plan_status,OLD.plan,OLD.billing_enabled,OLD.billing_provider,OLD.billing_payment_id) IS DISTINCT FROM ROW(NEW.plan_status,NEW.plan,NEW.billing_enabled,NEW.billing_provider,NEW.billing_payment_id) THEN
  INSERT INTO public.fama_subscription_events (organization_id,old_plan_status,new_plan_status,billing_enabled,billing_provider,billing_payment_id,source)
  VALUES (NEW.id,CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.plan_status END,coalesce(NEW.plan_status,'trial'),coalesce(NEW.billing_enabled,true),coalesce(NEW.billing_provider,''),coalesce(NEW.billing_payment_id,''),CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'change' END);
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.fama_track_subscription_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS fama_track_subscription_event ON public.organizations;
CREATE TRIGGER fama_track_subscription_event AFTER INSERT OR UPDATE OF plan_status,plan,billing_enabled,billing_provider,billing_payment_id ON public.organizations FOR EACH ROW EXECUTE FUNCTION private.fama_track_subscription_event();
INSERT INTO public.fama_subscription_events (organization_id,old_plan_status,new_plan_status,billing_enabled,billing_provider,billing_payment_id,source)
SELECT id,NULL,coalesce(plan_status,'trial'),coalesce(billing_enabled,true),coalesce(billing_provider,''),coalesce(billing_payment_id,''),'baseline' FROM public.organizations
ON CONFLICT DO NOTHING;
NOTIFY pgrst, 'reload schema';
