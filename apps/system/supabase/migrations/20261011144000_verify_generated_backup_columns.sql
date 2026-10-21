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
  EXECUTE format('CREATE TEMP TABLE %I (LIKE %s INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP',temporary_name,source_name);
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
