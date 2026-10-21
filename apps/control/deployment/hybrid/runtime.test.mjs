import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { HybridPostgres, postgresSql, runtimeSchema } from '../../server/hybrid-postgres.mjs';
import { migrateRuntime } from '../../scripts/migrate-hybrid-runtime.mjs';

function poolFor(engine) {
 let tail=Promise.resolve();
 return {async connect(){const before=tail;let release;tail=new Promise(resolve=>{release=resolve;});await before;return {query:(...args)=>engine.query(...args),release};},async end(){}};
}

test('migration preserves encrypted records; private schemas isolate applications and reject overwrites', async () => {
 const sqlite=new DatabaseSync(':memory:');
 const engine=new PGlite();
 try {
  for(const name of (await readdir(new URL('../../drizzle/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort()) sqlite.exec(await readFile(new URL('../../drizzle/'+name,import.meta.url),'utf8'));
  sqlite.exec('CREATE TABLE fama_fixture(id TEXT PRIMARY KEY, encrypted_config TEXT NOT NULL);CREATE TABLE fama_child(id TEXT PRIMARY KEY,parent TEXT REFERENCES fama_fixture(id));');
  sqlite.exec('CREATE UNIQUE INDEX fixture_encrypted_unique ON fama_fixture(encrypted_config)');
  sqlite.prepare('INSERT INTO fama_fixture VALUES(?,?)').run('kept','encrypted:fixture-preserved');
  sqlite.prepare('INSERT INTO fama_child VALUES(?,?)').run('child','kept');
  await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated');
  await migrateRuntime(engine,sqlite,'fama_system_runtime');
  const db=new HybridPostgres(poolFor(engine),'fama_system_runtime');
  await db.check();
  assert.equal((await db.prepare('SELECT encrypted_config AS encryptedConfig FROM fama_fixture WHERE id=?').bind('kept').first()).encryptedConfig,'encrypted:fixture-preserved');
  await assert.rejects(db.prepare('INSERT INTO fama_fixture VALUES(?,?)').bind('another','encrypted:fixture-preserved').run());
  const columns=(await db.prepare('PRAGMA table_info(fama_fixture)').all()).results;
  assert.equal(columns.find(column=>column.name==='id').pk,1);
  await assert.rejects(db.batch([
   db.prepare('INSERT INTO fama_fixture VALUES(?,?)').bind('rolled-back','one'),
   db.prepare('INSERT INTO fama_fixture VALUES(?,?)').bind('kept','duplicate'),
  ]));
  assert.equal(await db.prepare('SELECT id FROM fama_fixture WHERE id=?').bind('rolled-back').first(),null);
  await db.prepare('INSERT OR IGNORE INTO fama_fixture VALUES(?,?)').bind('kept','overwritten').run();
  assert.equal(await db.prepare('SELECT encrypted_config FROM fama_fixture WHERE id=?').bind('kept').first('encrypted_config'),'encrypted:fixture-preserved');
  const snapshot=await db.captureSnapshot();
  assert.equal((await db.verifySnapshot(snapshot)).valid,true);
  const invalid=structuredClone(snapshot);invalid.tables.find(table=>table.name==='fama_child').rows[0].parent='missing';
  await assert.rejects(db.verifySnapshot(invalid));
  assert.equal(await db.prepare('SELECT parent FROM fama_child').first('parent'),'kept');
  await assert.rejects(migrateRuntime(engine,sqlite,'fama_system_runtime'),/sobrescreve/);
  await engine.query('SET ROLE anon');
  await assert.rejects(engine.query('SELECT * FROM fama_system_runtime.fama_fixture'),/permission denied/);
  await engine.query('RESET ROLE');
  await migrateRuntime(engine,null,'fama_control_runtime');
  const control=new HybridPostgres(poolFor(engine),'fama_control_runtime');
  await assert.rejects(control.prepare('SELECT * FROM fama_fixture').all(),/does not exist/);
  assert.equal((await db.prepare("SELECT '?' AS placeholder, ? AS boundValue").bind('private').first()).boundValue,'private');
  assert.equal(postgresSql("CREATE TABLE example(amount real, label text DEFAULT 'real AS privateValue json_set(')"),"CREATE TABLE example(amount double precision, label text DEFAULT 'real AS privateValue json_set(')");
  assert.throws(()=>runtimeSchema('public'),/inválido/);
  assert.equal(postgresSql("SELECT '?' AS question, ? AS totalValue"),"SELECT '?' AS question, $1 AS \"totalValue\"");
 } finally {sqlite.close();await engine.close();}
});
