import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const security = new URL('../../../deployment/security/', import.meta.url);
const snapshot = JSON.parse(await readFile(new URL('control-private-tables-backup-2026-11-08.json', security), 'utf8'));
const restore = await readFile(new URL('control-private-tables-restore-empty.sql', security), 'utf8');
const enable = 'ALTER TABLE fama_control_runtime.fama_platform_integrations ENABLE ROW LEVEL SECURITY; ALTER TABLE fama_control_runtime.fama_provider_activity ENABLE ROW LEVEL SECURITY;';

test('empty private-table backup restores structure and owner access survives RLS and rollback', async () => {
  assert.equal(snapshot.tables.length, 2);
  assert.ok(snapshot.tables.every(table => table.row_count === 0 && table.owner === 'fama_control_backend' && !table.rls && !table.force_rls));
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE fama_control_backend; CREATE ROLE fama_system_backend; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    await db.exec(restore);
    await db.exec('GRANT USAGE ON SCHEMA fama_control_runtime TO fama_control_backend, fama_system_backend, anon, authenticated, service_role;');
    for (const table of snapshot.tables) {
      const columns = (await db.query(`SELECT a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS not_null, pg_get_expr(d.adbin,d.adrelid) AS "default" FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, [`fama_control_runtime.${table.name}`])).rows;
      assert.deepEqual(columns, table.columns.map(({name,type,not_null,default:defaultValue}) => ({name,type,not_null,default:defaultValue})));
      // PostgreSQL 18 also records NOT NULL in pg_constraint; the live snapshot
      // is PostgreSQL 17. Column nullability was compared separately above.
      const constraints = (await db.query("SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=$1::regclass AND contype<>'n' ORDER BY conname", [`fama_control_runtime.${table.name}`])).rows;
      assert.deepEqual(constraints, table.constraints);
      assert.equal((await db.query(`SELECT count(*)::int AS count FROM fama_control_runtime.${table.name}`)).rows[0].count, 0);
    }
    await db.exec(enable);
    await db.exec('SET ROLE fama_control_backend');
    assert.equal((await db.query("SELECT row_security_active('fama_control_runtime.fama_platform_integrations') AS active")).rows[0].active, false);
    await db.exec("INSERT INTO fama_control_runtime.fama_platform_integrations VALUES ('fixture','encrypted-fixture',1,'2026-11-08'); UPDATE fama_control_runtime.fama_platform_integrations SET revision=2 WHERE provider='fixture'; INSERT INTO fama_control_runtime.fama_provider_activity (id,provider,action,scope,status,created_at) VALUES ('fixture','fixture','test','local','ok','2026-11-08');");
    assert.equal((await db.query("SELECT revision FROM fama_control_runtime.fama_platform_integrations WHERE provider='fixture'")).rows[0].revision, 2);
    await db.exec("DELETE FROM fama_control_runtime.fama_platform_integrations WHERE provider='fixture'; DELETE FROM fama_control_runtime.fama_provider_activity WHERE id='fixture'; RESET ROLE;");
    for (const role of ['anon','authenticated','fama_system_backend','service_role']) {
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(db.query('SELECT * FROM fama_control_runtime.fama_platform_integrations'), /permission denied/);
      await assert.rejects(db.query('SELECT * FROM fama_control_runtime.fama_provider_activity'), /permission denied/);
      await db.exec('RESET ROLE');
    }
    await db.exec('ALTER TABLE fama_control_runtime.fama_platform_integrations DISABLE ROW LEVEL SECURITY; ALTER TABLE fama_control_runtime.fama_provider_activity DISABLE ROW LEVEL SECURITY;');
    const state = (await db.query("SELECT relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid IN ('fama_control_runtime.fama_platform_integrations'::regclass,'fama_control_runtime.fama_provider_activity'::regclass)")).rows;
    assert.ok(state.every(row => !row.relrowsecurity && !row.relforcerowsecurity && row.owner === 'fama_control_backend'));
  } finally { await db.close(); }
});
