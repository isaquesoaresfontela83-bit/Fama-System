import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('..',import.meta.url).pathname,'system-auth');
const {readD1Backup,verifyD1Backup}=await f.load('/lib/d1-backup.js');
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE companies(id TEXT PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE invoices(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),value INTEGER NOT NULL CHECK(value>=0)); INSERT INTO companies VALUES (\'one\',\'Acme\'); INSERT INTO invoices VALUES (\'invoice\',\'one\',123);');
function statement(sql,values=[]){return{bind(...v){return statement(sql,v)},async all(){return{results:sqlite.prepare(sql).all(...values)}},async run(){return{meta:sqlite.prepare(sql).run(...values)}}}}
f.runtime.DB={prepare:statement,async batch(statements){return Promise.all(statements.map(s=>s.run()))}};
sqlite.exec('CREATE TABLE _d1_migrations(id INTEGER PRIMARY KEY, name TEXT); INSERT INTO _d1_migrations VALUES (1,\'initial\');');
after(async()=>{await f.close();sqlite.close()});
test('backup restores real SQLite rows and foreign keys without changing original data',async()=>{
 const snapshot=await readD1Backup(); const result=await verifyD1Backup(snapshot);
 assert.equal(result.valid,true);assert.equal(result.records,3);assert.equal(result.tables,3);
 assert.ok(snapshot.tables.some(table=>table.name==='_d1_migrations'));
 assert.equal(sqlite.prepare('SELECT value FROM invoices').get().value,123);
 assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name LIKE 'fama_restore_%'").get().n,0);
 const invalid=structuredClone(snapshot);invalid.tables.find(t=>t.name==='invoices').rows[0].company_id='missing';
 await assert.rejects(()=>verifyD1Backup(invalid),/FOREIGN KEY/);
 assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name LIKE 'fama_restore_%'").get().n,0);
});
