-- Opcional: requer privilégios para event triggers no Supabase.

-- O RLS das tabelas existentes já está configurado em 01; isto cobre tabelas criadas futuramente.

CREATE EVENT TRIGGER "ensure_rls" ON ddl_command_end WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') EXECUTE FUNCTION "public"."rls_auto_enable"();
