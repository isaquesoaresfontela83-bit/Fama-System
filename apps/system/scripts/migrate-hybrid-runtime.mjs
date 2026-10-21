import { DatabaseSync } from 'node:sqlite';
import { postgresPool, postgresSql, runtimeSchema } from '../server/hybrid-postgres.mjs';
import { FAMA_RELEASE_ID } from '../lib/fama-release.js';

import { pathToFileURL } from 'node:url';
export async function migrateRuntime(client, source, schema) {
 runtimeSchema(schema);
 if (source && source.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('A cópia SQLite não passou pela integridade.');
 const quote = name => '"' + name.replaceAll('"', '""') + '"';
try {
 await client.query('BEGIN');
 await client.query('CREATE SCHEMA IF NOT EXISTS ' + quote(schema));
 const existing = await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema=$1', [schema]);
 if (existing.rows.length) throw new Error('O esquema já contém tabelas. A migração nunca sobrescreve uma instalação existente.');
 await client.query('REVOKE ALL ON SCHEMA ' + quote(schema) + ' FROM PUBLIC');
 const roles=await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')");
 for (const role of roles.rows) await client.query('REVOKE ALL ON SCHEMA '+quote(schema)+' FROM '+quote(role.rolname));
 await client.query('SET LOCAL search_path TO '+quote(schema)+', pg_catalog');
 await client.query(`CREATE FUNCTION fama_json_valid(value text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN PERFORM value::jsonb; RETURN true; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END $$`);
 await client.query(`CREATE FUNCTION fama_json_set(value text,p1 text,v1 text,p2 text,v2 text) RETURNS text LANGUAGE SQL IMMUTABLE AS $$ SELECT jsonb_set(jsonb_set(value::jsonb,ARRAY[substring(p1 from 3)],to_jsonb(v1),true),ARRAY[substring(p2 from 3)],CASE WHEN p2='$.freightRateCentsPerKm' THEN to_jsonb(v2::numeric) ELSE to_jsonb(v2) END,true)::text $$`);
 await client.query(`CREATE FUNCTION fama_json_object(k1 text,v1 text,k2 text,v2 numeric) RETURNS text LANGUAGE SQL IMMUTABLE AS $$ SELECT jsonb_build_object(k1,v1,k2,v2)::text $$`);
 const pending=source ? source.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all() : [];
 const installed=new Set(); let records=0;
 while(pending.length){
  const index=pending.findIndex(table=>source.prepare('PRAGMA foreign_key_list('+quote(table.name)+')').all().every(key=>key.table===table.name||installed.has(key.table)||!pending.some(parent=>parent.name===key.table)));
  if(index<0)throw new Error('Relações circulares exigem migração assistida.');
  const table=pending.splice(index,1)[0];
  if(!/^[a-z_][a-z0-9_]*$/i.test(table.name))throw new Error('Nome de tabela não suportado.');
  await client.query(postgresSql(table.sql));
  const columns=source.prepare('PRAGMA table_info('+quote(table.name)+')').all().map(column=>column.name);
  const rows=source.prepare('SELECT * FROM '+quote(table.name)).all();
  for(const row of rows)await client.query('INSERT INTO '+quote(table.name)+' ('+columns.map(quote).join(',')+') VALUES ('+columns.map((_,i)=>'$'+(i+1)).join(',')+')',columns.map(column=>row[column]));
  const actual=await client.query('SELECT * FROM '+quote(table.name));
  const canonical = entries => entries.map(row => JSON.stringify(columns.map(column=>row[column]))).sort();
  if(JSON.stringify(canonical(actual.rows))!==JSON.stringify(canonical(rows)))throw new Error('Os registros importados divergiram da origem.');
  await client.query('ALTER TABLE '+quote(table.name)+' ENABLE ROW LEVEL SECURITY');
  installed.add(table.name);records+=rows.length;
 }
 if(source){
  const unsupported=source.prepare("SELECT name FROM sqlite_schema WHERE type IN ('trigger','view') AND sql IS NOT NULL").all();
  if(unsupported.length)throw new Error('Views ou gatilhos exigem migração assistida antes da troca de hospedagem.');
  for(const index of source.prepare("SELECT sql FROM sqlite_schema WHERE type='index' AND sql IS NOT NULL ORDER BY name").all())await client.query(postgresSql(index.sql));
 }
 await client.query('CREATE TABLE _fama_runtime_state(release_id TEXT NOT NULL, imported_tables INTEGER NOT NULL, imported_records INTEGER NOT NULL, imported_at TIMESTAMPTZ NOT NULL DEFAULT now())');
 await client.query('INSERT INTO _fama_runtime_state(release_id,imported_tables,imported_records) VALUES($1,$2,$3)',[FAMA_RELEASE_ID,installed.size,records]);
 await client.query('ALTER TABLE _fama_runtime_state ENABLE ROW LEVEL SECURITY');
 await client.query('REVOKE ALL ON ALL TABLES IN SCHEMA '+quote(schema)+' FROM PUBLIC');
 await client.query('COMMIT');
 console.log('Importação confirmada em esquema privado: '+installed.size+' tabelas e '+records+' registros.');
} catch(error){await client.query('ROLLBACK');throw error;}
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href){
 const input=process.argv[2];
 if(!input)throw new Error('Informe uma cópia SQLite atual ou --empty-test para testes descartáveis.');
 const source=input==='--empty-test'?null:new DatabaseSync(input,{readOnly:true});
 const pool=postgresPool(process.env),client=await pool.connect();
 try{await migrateRuntime(client,source,runtimeSchema(process.env.FAMA_POSTGRES_SCHEMA));}
 finally{client.release();await pool.end();source?.close();}
}
