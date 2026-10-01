-- Buckets e políticas da instalação atual. Aplicar após 01-estrutura-completa-supabase.sql.

BEGIN;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('fama-documents','fama-documents',false,10485760,ARRAY['image/png','application/octet-stream','image/webp','image/jpeg','application/pdf']::text[]) ON CONFLICT(id) DO UPDATE SET name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('pool-service-photos','pool-service-photos',false,10485760,ARRAY['image/jpeg','image/png','image/webp']::text[]) ON CONFLICT(id) DO UPDATE SET name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

DROP POLICY IF EXISTS "pool_service_photos_delete" ON "storage"."objects";

CREATE POLICY "pool_service_photos_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'pool-service-photos'::text) AND private.has_org_permission((storage.foldername(name))[1], 'orders'::text)));

DROP POLICY IF EXISTS "pool_service_photos_insert" ON "storage"."objects";

CREATE POLICY "pool_service_photos_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'pool-service-photos'::text) AND private.has_org_permission((storage.foldername(name))[1], 'orders'::text)));

DROP POLICY IF EXISTS "pool_service_photos_select" ON "storage"."objects";

CREATE POLICY "pool_service_photos_select" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'pool-service-photos'::text) AND private.has_org_permission((storage.foldername(name))[1], 'orders'::text)));

DROP POLICY IF EXISTS "pool_service_photos_update" ON "storage"."objects";

CREATE POLICY "pool_service_photos_update" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'pool-service-photos'::text) AND private.has_org_permission((storage.foldername(name))[1], 'orders'::text))) WITH CHECK (((bucket_id = 'pool-service-photos'::text) AND private.has_org_permission((storage.foldername(name))[1], 'orders'::text)));

COMMIT;
