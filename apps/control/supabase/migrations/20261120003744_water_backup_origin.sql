DO $migration$
DECLARE
  function_id oid := to_regprocedure('private.fama_invoke_full_backup()');
  definition text;
  old_url constant text := 'https://control.famasystem.online/api/internal/backup';
  new_url constant text := 'https://control.watersystem.online/api/internal/backup';
BEGIN
  IF function_id IS NULL THEN
    RAISE EXCEPTION 'Expected backup function is missing';
  END IF;
  definition := pg_get_functiondef(function_id);
  IF strpos(definition, new_url) > 0 AND strpos(definition, old_url) = 0 THEN
    RETURN;
  END IF;
  IF (length(definition) - length(replace(definition, old_url, ''))) <> length(old_url)
     OR strpos(definition, new_url) > 0 THEN
    RAISE EXCEPTION 'Unexpected destination in backup function';
  END IF;
  EXECUTE replace(definition, old_url, new_url);
END
$migration$;
