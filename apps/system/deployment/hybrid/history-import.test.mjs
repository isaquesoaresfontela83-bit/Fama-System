import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { PGlite } from '@electric-sql/pglite';
import { migrateRuntime } from '../../scripts/migrate-hybrid-runtime.mjs';

test('real SQLite migration history preserves dates and the deleted-id high-water mark',async()=>{
 const source=new DatabaseSync(':memory:');
 const target=new PGlite();
 try{
  source.exec('CREATE TABLE history(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,day DATE);CREATE TABLE empty_history(id INTEGER PRIMARY KEY AUTOINCREMENT)');
  source.prepare('INSERT INTO history(id,name,applied_at,day) VALUES(?,?,?,?)').run(1,'kept','2026-10-21 19:57:53','2026-10-21');
  source.prepare('INSERT INTO history(id,name,applied_at) VALUES(?,?,?)').run(9,'deleted','2026-10-21 19:58:00');
  source.exec('DELETE FROM history WHERE id=9');
  await target.exec('CREATE ROLE anon;CREATE ROLE authenticated');
  await migrateRuntime(target,source,'fama_system_runtime');
  const copied=await target.query('SELECT id,name,applied_at,day FROM fama_system_runtime.history');
  assert.deepEqual(copied.rows,[{id:1,name:'kept',applied_at:'2026-10-21 19:57:53',day:'2026-10-21'}]);
  const next=await target.query("INSERT INTO fama_system_runtime.history(name) VALUES('next') RETURNING id,applied_at");
  assert.equal(next.rows[0].id,10);
  assert.equal(typeof next.rows[0].applied_at,'string');
  assert.equal((await target.query('INSERT INTO fama_system_runtime.empty_history DEFAULT VALUES RETURNING id')).rows[0].id,1);
 }finally{source.close();await target.close();}
});

