CREATE TABLE public.fama_full_backup_runs (
 id text PRIMARY KEY, source_backup_id text NOT NULL REFERENCES public.fama_control_backups(id),
 status text NOT NULL CHECK(status IN ('running','complete','failed')), scheduled boolean NOT NULL DEFAULT false,
 manifest jsonb NOT NULL DEFAULT '{}', manifest_payload text NOT NULL DEFAULT '', error text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE TABLE public.fama_full_backup_parts (
 id text PRIMARY KEY, run_id text NOT NULL REFERENCES public.fama_full_backup_runs(id) ON DELETE CASCADE,
 part_number integer NOT NULL, payload text NOT NULL, checksum text NOT NULL,
 UNIQUE(run_id,part_number)
);
ALTER TABLE public.fama_full_backup_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fama_full_backup_parts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fama_full_backup_runs,public.fama_full_backup_parts FROM anon,authenticated;
GRANT ALL ON public.fama_full_backup_runs,public.fama_full_backup_parts TO service_role;

-- Capture every application table and identity/storage metadata in one SQL
-- statement, so the archived relationships share the same database snapshot.
CREATE OR REPLACE FUNCTION private.fama_enrich_backup_payload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE item jsonb; inventory jsonb:='[]'; source_inventory jsonb; clauses text[]:='{}'; data jsonb;
 table_key text; source_name text; condition_sql text; row_count bigint;
BEGIN
 source_inventory:=private.fama_backup_inventory();
 FOR item IN SELECT value FROM jsonb_array_elements(source_inventory) LOOP
  IF item->>'schema'='public' AND item->>'name' IN ('fama_control_backups','fama_full_backup_runs','fama_full_backup_parts','request_rate_limits') THEN CONTINUE; END IF;
  IF new.scope='organization' AND NOT coalesce(item->'columns' ? 'organization_id',false) THEN CONTINUE; END IF;
  table_key:=CASE WHEN item->>'schema'='public' THEN item->>'name' ELSE (item->>'schema')||'.'||(item->>'name') END;
  source_name:=format('%I.%I',item->>'schema',item->>'name');
  condition_sql:=CASE WHEN new.scope='organization' THEN format(' WHERE organization_id=%L',new.organization_id) ELSE '' END;
  clauses:=array_append(clauses,format('SELECT %L::text AS key,coalesce(jsonb_agg(to_jsonb(row)),''[]''::jsonb) AS rows FROM (SELECT * FROM %s%s) row',table_key,source_name,condition_sql));
  inventory:=inventory||jsonb_build_array(item||jsonb_build_object('key',table_key));
 END LOOP;
 EXECUTE 'SELECT jsonb_object_agg(key,rows) FROM ('||array_to_string(clauses,' UNION ALL ')||') collections' INTO data;
 source_inventory:='[]';
 FOR item IN SELECT value FROM jsonb_array_elements(inventory) LOOP
  row_count:=jsonb_array_length(data->(item->>'key'));
  source_inventory:=source_inventory||jsonb_build_array(item||jsonb_build_object('count',row_count));
 END LOOP;
 new.payload:=jsonb_build_object('format','fama-database-snapshot-v3','created_at',now(),'scope',new.scope,
   'organization_id',new.organization_id,'inventory',source_inventory,'data',data);
 new.checksum:=encode(extensions.digest(convert_to(new.payload::text,'UTF8'),'sha256'),'hex');
 RETURN new;
END $function$;

CREATE OR REPLACE FUNCTION public.fama_create_backup_snapshot() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE snapshot_id text:=gen_random_uuid()::text;
BEGIN
 INSERT INTO public.fama_control_backups(id,label,scope,payload,checksum,created_by_user_id)
 VALUES(snapshot_id,'Backup completo da plataforma','global','{}','', 'system:full-backup');
 RETURN jsonb_build_object('id',snapshot_id);
END $function$;
CREATE OR REPLACE FUNCTION public.fama_backup_snapshot_meta(p_backup_id text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $function$
 SELECT jsonb_build_object('id',id,'createdAt',created_at,'checksum',checksum,'inventory',payload->'inventory')
 FROM public.fama_control_backups WHERE id=p_backup_id;
$function$;
CREATE OR REPLACE FUNCTION public.fama_backup_snapshot_page(p_backup_id text,p_key text,p_offset integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE source jsonb; result jsonb;
BEGIN
 IF p_offset<0 THEN RAISE EXCEPTION 'Invalid offset'; END IF;
 SELECT payload->'data'->p_key INTO source FROM public.fama_control_backups WHERE id=p_backup_id;
 IF source IS NULL OR jsonb_typeof(source)<>'array' THEN RAISE EXCEPTION 'Unknown snapshot collection'; END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO result
 FROM jsonb_array_elements(source) WITH ORDINALITY a(value,ord) WHERE ord>p_offset AND ord<=p_offset+100;
 RETURN result;
END $function$;
CREATE OR REPLACE FUNCTION public.fama_backup_run_part(p_run_id text,p_offset integer) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $function$
 SELECT to_jsonb(part) FROM (SELECT id,part_number,payload,checksum FROM public.fama_full_backup_parts
 WHERE run_id=p_run_id ORDER BY part_number LIMIT 1 OFFSET greatest(p_offset,0)) part;
$function$;

-- Restore actual rows into PostgreSQL temporary tables. The live tables are
-- only read. Counts, row values, types, checks, uniqueness and archived foreign
-- relationships are verified before a backup is reported as complete.
CREATE OR REPLACE FUNCTION public.fama_verify_backup_snapshot(p_backup_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE snapshot jsonb; item jsonb; mapping jsonb:='{}'; temporary_name text; columns_sql text;
 source_name text; rows_json jsonb; actual_count bigint; differences bigint;
 tables_count integer:=0; records_count bigint:=0; foreign_checks integer:=0;
 fk record; child_name text; parent_name text; join_sql text; not_null_sql text;
BEGIN
 SELECT payload INTO snapshot FROM public.fama_control_backups WHERE id=p_backup_id;
 IF snapshot->>'format'<>'fama-database-snapshot-v3' THEN RAISE EXCEPTION 'Invalid snapshot'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'inventory') LOOP
  source_name:=format('%I.%I',item->>'schema',item->>'name');
  temporary_name:='fama_restore_'||substr(md5(p_backup_id||'.'||(item->>'key')),1,20);
  mapping:=mapping||jsonb_build_object((item->>'schema')||'.'||(item->>'name'),temporary_name);
  EXECUTE format('CREATE TEMP TABLE %I (LIKE %s INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP',temporary_name,source_name);
  SELECT string_agg(format('%I',value),',') INTO columns_sql FROM jsonb_array_elements_text(item->'columns');
  rows_json:=snapshot->'data'->(item->>'key');
  EXECUTE format('INSERT INTO pg_temp.%I (%s) OVERRIDING SYSTEM VALUE SELECT %s FROM jsonb_populate_recordset(NULL::%s,$1)',temporary_name,columns_sql,columns_sql,source_name) USING rows_json;
  EXECUTE format('SELECT count(*) FROM pg_temp.%I',temporary_name) INTO actual_count;
  IF actual_count<>jsonb_array_length(rows_json) THEN RAISE EXCEPTION 'Restoration count mismatch in %',source_name; END IF;
  EXECUTE format('SELECT count(*) FROM ((SELECT to_jsonb(t) AS row FROM pg_temp.%I t EXCEPT ALL SELECT value FROM jsonb_array_elements($1)) UNION ALL (SELECT value FROM jsonb_array_elements($1) EXCEPT ALL SELECT to_jsonb(t) FROM pg_temp.%I t)) difference',temporary_name,temporary_name) INTO differences USING rows_json;
  IF differences<>0 THEN RAISE EXCEPTION 'Restoration data mismatch in %',source_name; END IF;
  tables_count:=tables_count+1; records_count:=records_count+actual_count;
 END LOOP;
 FOR fk IN SELECT c.oid,c.conrelid,c.confrelid,c.conkey,c.confkey,child_ns.nspname||'.'||child.relname AS child_key,parent_ns.nspname||'.'||parent.relname AS parent_key
 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class child ON child.oid=c.conrelid JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid=child.relnamespace
 JOIN pg_catalog.pg_class parent ON parent.oid=c.confrelid JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
 WHERE c.contype='f' LOOP
  child_name:=mapping->>fk.child_key; parent_name:=mapping->>fk.parent_key;
  IF child_name IS NULL OR parent_name IS NULL THEN CONTINUE; END IF;
  SELECT string_agg(format('child.%I=parent.%I',ca.attname,pa.attname),' AND '),string_agg(format('child.%I IS NOT NULL',ca.attname),' AND ')
  INTO join_sql,not_null_sql FROM unnest(fk.conkey,fk.confkey) keys(ca_num,pa_num)
  JOIN pg_catalog.pg_attribute ca ON ca.attrelid=fk.conrelid AND ca.attnum=keys.ca_num
  JOIN pg_catalog.pg_attribute pa ON pa.attrelid=fk.confrelid AND pa.attnum=keys.pa_num;
  EXECUTE format('SELECT count(*) FROM pg_temp.%I child WHERE %s AND NOT EXISTS (SELECT 1 FROM pg_temp.%I parent WHERE %s)',child_name,not_null_sql,parent_name,join_sql) INTO differences;
  IF differences<>0 THEN RAISE EXCEPTION 'Archived foreign relationship mismatch in %',fk.child_key; END IF;
  foreign_checks:=foreign_checks+1;
 END LOOP;
 RETURN jsonb_build_object('valid',true,'tables',tables_count,'records',records_count,'foreignKeys',foreign_checks,'restoredInto','isolated PostgreSQL temporary tables');
END $function$;

DO $grants$
DECLARE procedure record;
BEGIN
 FOR procedure IN SELECT p.oid::regprocedure AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('fama_create_backup_snapshot','fama_backup_snapshot_meta','fama_backup_snapshot_page','fama_backup_run_part','fama_verify_backup_snapshot') LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',procedure.name);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',procedure.name);
 END LOOP;
END $grants$;
