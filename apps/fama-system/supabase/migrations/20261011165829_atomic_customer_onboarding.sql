-- The server verifies the session and current payment before calling this procedure.
-- A service-only transaction serializes first access and creates the company and owner together.
CREATE OR REPLACE FUNCTION public.fama_create_customer_company(p_organization jsonb, p_member jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor text := p_member->>'user_id';
  company_id text := p_organization->>'id';
  created public.organizations%ROWTYPE;
BEGIN
  IF coalesce(actor,'') = '' OR p_organization->>'created_by_user_id' IS DISTINCT FROM actor
    OR p_member->>'organization_id' IS DISTINCT FROM company_id
    OR p_member->>'role' IS DISTINCT FROM 'owner' OR p_member->>'status' IS DISTINCT FROM 'active'
    OR p_organization->>'plan' NOT IN ('inicial','intermediario','profissional')
    OR p_organization->>'plan_status' NOT IN ('active','trial')
    OR p_organization->>'status' IS DISTINCT FROM 'active'
    OR coalesce(p_organization->>'plan_expires_at','') = '' THEN
    RAISE EXCEPTION 'FAMA_INVALID_ONBOARDING';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fama-customer-company:' || actor, 0));
  IF EXISTS (SELECT 1 FROM public.organizations WHERE created_by_user_id=actor)
    OR EXISTS (SELECT 1 FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id
      WHERE (m.user_id=actor OR lower(m.user_email)=lower(p_member->>'user_email')) AND m.status='active' AND o.status<>'deleted') THEN
    RAISE EXCEPTION 'FAMA_ACCOUNT_HAS_COMPANY';
  END IF;
  INSERT INTO public.organizations(id,name,slug,status,created_by_user_id,created_at,updated_at,name_key,
    plan,plan_status,plan_expires_at,billing_cycle,billing_payment_id,billing_customer_id,billing_provider)
  VALUES(company_id,p_organization->>'name',p_organization->>'slug','active',actor,
    (p_organization->>'created_at')::timestamptz,(p_organization->>'updated_at')::timestamptz,p_organization->>'name_key',
    p_organization->>'plan',p_organization->>'plan_status',p_organization->>'plan_expires_at',
    p_organization->>'billing_cycle',coalesce(p_organization->>'billing_payment_id',''),
    coalesce(p_organization->>'billing_customer_id',''),coalesce(p_organization->>'billing_provider','')) RETURNING * INTO created;
  INSERT INTO public.organization_members(id,organization_id,user_id,user_email,display_name,role,status,created_at,updated_at)
  VALUES(p_member->>'id',company_id,actor,lower(p_member->>'user_email'),p_member->>'display_name','owner','active',
    (p_member->>'created_at')::timestamptz,(p_member->>'updated_at')::timestamptz);
  RETURN pg_catalog.to_jsonb(created);
END;
$$;
REVOKE ALL ON FUNCTION public.fama_create_customer_company(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fama_create_customer_company(jsonb,jsonb) TO service_role;
