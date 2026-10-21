-- Private conversation storage. Browsers access it only through authorized Fama routes.
CREATE UNIQUE INDEX IF NOT EXISTS fama_whatsapp_connection_scope ON public.fama_whatsapp_connections(id,organization_id);
CREATE TABLE IF NOT EXISTS public.fama_chat_conversations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id text NOT NULL,
  business_phone_id text NOT NULL CHECK(business_phone_id ~ '^[0-9]{5,30}$'),
  phone_hash text NOT NULL CHECK(phone_hash ~ '^[0-9a-f]{64}$'),
  phone_ciphertext text NOT NULL CHECK(phone_ciphertext LIKE 'fama:v1:%'),
  name_ciphertext text NOT NULL DEFAULT '' CHECK(name_ciphertext='' OR name_ciphertext LIKE 'fama:v1:%'),
  last_message_ciphertext text NOT NULL DEFAULT '',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_inbound_at timestamptz,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id,business_phone_id,phone_hash),
  UNIQUE(id,organization_id,connection_id),
  FOREIGN KEY(connection_id,organization_id) REFERENCES public.fama_whatsapp_connections(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.fama_chat_messages (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL,
  connection_id text NOT NULL,
  conversation_id text NOT NULL,
  direction text NOT NULL CHECK(direction IN ('in','out')),
  kind text NOT NULL CHECK(kind IN ('text','template','image','audio','video','document','sticker','location','contacts','other')),
  body_ciphertext text NOT NULL CHECK(body_ciphertext LIKE 'fama:v1:%'),
  provider_message_id text,
  client_request_id text,
  request_hash text,
  actor_user_id text NOT NULL DEFAULT '',
  status text NOT NULL CHECK(status IN ('received','sending','sent','delivered','read','failed','uncertain')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id,provider_message_id),
  UNIQUE(organization_id,client_request_id),
  FOREIGN KEY(conversation_id,organization_id,connection_id) REFERENCES public.fama_chat_conversations(id,organization_id,connection_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS fama_chat_inbox_idx ON public.fama_chat_conversations(organization_id,connection_id,business_phone_id,last_message_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS fama_chat_messages_page_idx ON public.fama_chat_messages(organization_id,conversation_id,occurred_at DESC,id DESC);
ALTER TABLE public.fama_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fama_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fama_chat_conversations,public.fama_chat_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fama_chat_conversations,public.fama_chat_messages TO service_role;

CREATE OR REPLACE FUNCTION public.fama_chat_record_message(p_connection_id text,p_phone_hash text,p_phone_ciphertext text,p_name_ciphertext text,p_message_id text,p_body_ciphertext text,p_kind text,p_direction text,p_actor_user_id text,p_occurred_at timestamptz)
RETURNS text LANGUAGE plpgsql STRICT SECURITY INVOKER SET search_path='' AS $$
DECLARE company_id text; business_id text; thread public.fama_chat_conversations%ROWTYPE; inserted_id text;
BEGIN
  IF p_phone_hash !~ '^[0-9a-f]{64}$' OR p_phone_ciphertext NOT LIKE 'fama:v1:%'
    OR (p_name_ciphertext<>'' AND p_name_ciphertext NOT LIKE 'fama:v1:%') OR length(p_name_ciphertext)>2000
    OR length(p_message_id) NOT BETWEEN 1 AND 300 OR p_body_ciphertext NOT LIKE 'fama:v1:%' OR octet_length(p_body_ciphertext)>32000
    OR p_kind NOT IN ('text','template','image','audio','video','document','sticker','location','contacts','other')
    OR p_direction NOT IN ('in','out') OR length(p_actor_user_id)>128
    OR p_occurred_at>now()+interval '5 minutes' OR p_occurred_at<now()-interval '30 days' THEN
    RAISE EXCEPTION 'Invalid chat message' USING ERRCODE='22023';
  END IF;
  SELECT c.organization_id,c.phone_number_id INTO company_id,business_id FROM public.fama_whatsapp_connections c JOIN public.organizations o ON o.id=c.organization_id
    WHERE c.id=p_connection_id AND c.verified_at IS NOT NULL AND c.webhook_verified_at IS NOT NULL AND o.status='active';
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.fama_chat_conversations(organization_id,connection_id,business_phone_id,phone_hash,phone_ciphertext,name_ciphertext)
    VALUES(company_id,p_connection_id,business_id,p_phone_hash,p_phone_ciphertext,p_name_ciphertext)
    ON CONFLICT(connection_id,business_phone_id,phone_hash) DO UPDATE SET name_ciphertext=CASE WHEN excluded.name_ciphertext<>'' THEN excluded.name_ciphertext ELSE fama_chat_conversations.name_ciphertext END
    RETURNING * INTO thread;
  INSERT INTO public.fama_chat_messages(organization_id,connection_id,conversation_id,direction,kind,body_ciphertext,provider_message_id,actor_user_id,status,occurred_at)
    VALUES(company_id,p_connection_id,thread.id,p_direction,p_kind,p_body_ciphertext,p_message_id,p_actor_user_id,CASE WHEN p_direction='in' THEN 'received' ELSE 'sent' END,p_occurred_at)
    ON CONFLICT(connection_id,provider_message_id) DO NOTHING RETURNING id INTO inserted_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.fama_chat_conversations SET
    last_message_ciphertext=CASE WHEN last_message_ciphertext='' OR last_message_at<=p_occurred_at THEN p_body_ciphertext ELSE last_message_ciphertext END,
    last_message_at=CASE WHEN last_message_ciphertext='' THEN p_occurred_at ELSE greatest(last_message_at,p_occurred_at) END,
    last_inbound_at=CASE WHEN p_direction='in' THEN greatest(last_inbound_at,p_occurred_at) ELSE last_inbound_at END
    WHERE id=thread.id AND organization_id=company_id;
  RETURN thread.id;
END; $$;

CREATE OR REPLACE FUNCTION public.fama_chat_reserve_send(p_organization_id text,p_connection_id text,p_conversation_id text,p_phone_hash text,p_phone_ciphertext text,p_client_request_id text,p_request_hash text,p_body_ciphertext text,p_kind text,p_actor_user_id text)
RETURNS jsonb LANGUAGE plpgsql STRICT SECURITY INVOKER SET search_path='' AS $$
DECLARE thread public.fama_chat_conversations%ROWTYPE; message public.fama_chat_messages%ROWTYPE; business_id text;
BEGIN
  IF p_client_request_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR p_request_hash !~ '^[0-9a-f]{64}$' OR p_body_ciphertext NOT LIKE 'fama:v1:%' OR octet_length(p_body_ciphertext)>32000
    OR p_kind NOT IN ('text','template') OR length(p_actor_user_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid chat send' USING ERRCODE='22023';
  END IF;
  SELECT c.phone_number_id INTO business_id FROM public.fama_whatsapp_connections c JOIN public.organizations o ON o.id=c.organization_id
    WHERE c.id=p_connection_id AND c.organization_id=p_organization_id AND c.verified_at IS NOT NULL AND c.webhook_verified_at IS NOT NULL AND o.status='active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection not ready' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id||':'||p_client_request_id,0));
  SELECT * INTO message FROM public.fama_chat_messages WHERE organization_id=p_organization_id AND client_request_id=p_client_request_id;
  IF FOUND THEN
    IF message.request_hash<>p_request_hash OR message.actor_user_id<>p_actor_user_id THEN RAISE EXCEPTION 'Request identity conflict' USING ERRCODE='22023'; END IF;
    SELECT * INTO thread FROM public.fama_chat_conversations WHERE id=message.conversation_id AND organization_id=p_organization_id AND connection_id=p_connection_id AND business_phone_id=business_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found' USING ERRCODE='22023'; END IF;
    RETURN pg_catalog.jsonb_build_object('created',false,'message',to_jsonb(message),'conversation',to_jsonb(thread));
  END IF;
  IF p_conversation_id='' AND p_kind='template' THEN
    IF p_phone_hash !~ '^[0-9a-f]{64}$' OR p_phone_ciphertext NOT LIKE 'fama:v1:%' THEN RAISE EXCEPTION 'Invalid contact' USING ERRCODE='22023'; END IF;
    INSERT INTO public.fama_chat_conversations(organization_id,connection_id,business_phone_id,phone_hash,phone_ciphertext)
      VALUES(p_organization_id,p_connection_id,business_id,p_phone_hash,p_phone_ciphertext)
      ON CONFLICT(connection_id,business_phone_id,phone_hash) DO UPDATE SET phone_hash=excluded.phone_hash RETURNING * INTO thread;
  ELSE
    SELECT * INTO thread FROM public.fama_chat_conversations WHERE id=p_conversation_id AND organization_id=p_organization_id AND connection_id=p_connection_id AND business_phone_id=business_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found' USING ERRCODE='22023'; END IF;
  END IF;
  IF p_kind='text' AND (thread.last_inbound_at IS NULL OR thread.last_inbound_at<=now()-interval '24 hours') THEN
    RAISE EXCEPTION 'Customer service window closed' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.fama_chat_messages(organization_id,connection_id,conversation_id,direction,kind,body_ciphertext,client_request_id,request_hash,actor_user_id,status)
    VALUES(p_organization_id,p_connection_id,thread.id,'out',p_kind,p_body_ciphertext,p_client_request_id,p_request_hash,p_actor_user_id,'sending') RETURNING * INTO message;
  UPDATE public.fama_chat_conversations SET last_message_ciphertext=p_body_ciphertext,last_message_at=message.occurred_at WHERE id=thread.id AND organization_id=p_organization_id;
  RETURN pg_catalog.jsonb_build_object('created',true,'message',to_jsonb(message),'conversation',to_jsonb(thread));
END; $$;

CREATE OR REPLACE FUNCTION public.fama_chat_message_page(p_organization_id text,p_connection_id text,p_conversation_id text,p_before_id text DEFAULT '')
RETURNS SETOF public.fama_chat_messages LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE cursor_message public.fama_chat_messages%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.fama_chat_conversations WHERE id=p_conversation_id AND organization_id=p_organization_id AND connection_id=p_connection_id) THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE='22023';
  END IF;
  IF p_before_id<>'' THEN
    SELECT * INTO cursor_message FROM public.fama_chat_messages WHERE id=p_before_id AND organization_id=p_organization_id AND conversation_id=p_conversation_id AND connection_id=p_connection_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Message not found' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN QUERY SELECT m.* FROM public.fama_chat_messages m
    WHERE m.organization_id=p_organization_id AND m.connection_id=p_connection_id AND m.conversation_id=p_conversation_id
      AND (p_before_id='' OR (m.occurred_at,m.id)<(cursor_message.occurred_at,cursor_message.id))
    ORDER BY m.occurred_at DESC,m.id DESC LIMIT 101;
END; $$;

CREATE OR REPLACE FUNCTION public.fama_chat_delivery(p_connection_id text,p_message_id text,p_phone_hash text,p_status text)
RETURNS boolean LANGUAGE plpgsql STRICT SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_status NOT IN ('sent','delivered','read','failed') OR length(p_message_id) NOT BETWEEN 1 AND 300 OR p_phone_hash !~ '^[0-9a-f]{64}$' THEN RETURN false; END IF;
  UPDATE public.fama_chat_messages m SET status=p_status FROM public.fama_chat_conversations c
    WHERE m.connection_id=p_connection_id AND m.provider_message_id=p_message_id AND m.direction='out'
      AND c.id=m.conversation_id AND c.organization_id=m.organization_id AND c.connection_id=m.connection_id AND c.phone_hash=p_phone_hash
      AND CASE p_status WHEN 'read' THEN m.status IN ('sending','sent','uncertain','delivered') WHEN 'delivered' THEN m.status IN ('sending','sent','uncertain')
        WHEN 'sent' THEN m.status IN ('sending','uncertain') ELSE m.status IN ('sending','sent','uncertain') END;
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.fama_chat_record_message(text,text,text,text,text,text,text,text,text,timestamptz),public.fama_chat_reserve_send(text,text,text,text,text,text,text,text,text,text),public.fama_chat_message_page(text,text,text,text),public.fama_chat_delivery(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fama_chat_record_message(text,text,text,text,text,text,text,text,text,timestamptz),public.fama_chat_reserve_send(text,text,text,text,text,text,text,text,text,text),public.fama_chat_message_page(text,text,text,text),public.fama_chat_delivery(text,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';

