-- Keep the Vault key private and expose database-encrypted copies only to the server.
CREATE OR REPLACE FUNCTION public.fama_recovery_payload(p_snapshot_id text, p_organization_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  snapshot public.recovery_snapshots%ROWTYPE;
  recovery_key text;
  payload jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso não autorizado.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO snapshot FROM public.recovery_snapshots
  WHERE id = p_snapshot_id AND organization_id = p_organization_id
    AND restored_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO recovery_key FROM vault.decrypted_secrets
  WHERE name = 'fama_recovery_key' ORDER BY created_at DESC LIMIT 1;
  IF recovery_key IS NULL THEN
    RAISE EXCEPTION 'Chave de recuperação indisponível.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    payload := extensions.pgp_sym_decrypt(decode(snapshot.encrypted_payload, 'base64'), recovery_key)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Cópia de recuperação inválida.' USING ERRCODE = '22023';
  END;
  IF jsonb_typeof(payload) <> 'object'
     OR coalesce(payload->>'organization_id', '') <> p_organization_id
     OR coalesce(payload->>'id', '') <> snapshot.record_id THEN
    RAISE EXCEPTION 'Cópia de recuperação inválida.' USING ERRCODE = '22023';
  END IF;
  RETURN payload;
END;
$function$;
REVOKE ALL ON FUNCTION public.fama_recovery_payload(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fama_recovery_payload(text, text) TO service_role;
