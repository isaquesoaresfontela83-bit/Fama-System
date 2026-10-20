ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS public.support_messages (
 id text PRIMARY KEY,
 ticket_id text NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
 organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 author_kind text NOT NULL CHECK (author_kind IN ('customer','admin')),
 author_name text NOT NULL,
 body text NOT NULL CHECK (length(body) BETWEEN 1 AND 3000),
 internal boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_org_thread ON public.support_messages(organization_id,ticket_id,created_at);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.support_messages TO service_role;
NOTIFY pgrst, 'reload schema';
