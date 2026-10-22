import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('additive agenda migration preserves records, propagates customer links and restricts automation tables',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create table organizations(id text primary key);create table quotes(id text primary key);create table work_orders(id text primary key);create table contracts(id text primary key);create table appointments(id text primary key,organization_id text,title text,client_name text,start_at text,address text,technician text,kind text,status text,notes text,created_at timestamptz,updated_at timestamptz);create table warranties(id text primary key,organization_id text,warranty_number text,client_name text,appointment_id text default '',item text,scheduled_at text,technician text,status text,updated_at timestamptz);insert into organizations values('org-one');insert into quotes values('preserved');`);
 const sql=await readFile(new URL('./customer-agenda.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await db.exec(`insert into warranties(id,organization_id,warranty_number,client_name,item,customer_id) values('w-one','org-one','G01','Cliente','Bomba','customer-one');`);
 const result=await db.query(`select public.schedule_warranty('org-one','w-one','2026-10-22T09:00','Técnico','appointment-one',now()) as value`);
 assert.equal(result.rows[0].value.appointment.customer_id,'customer-one');assert.equal((await db.query('select id from quotes')).rows[0].id,'preserved');
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.fama_agenda_settings'),/permission denied/);await db.exec('reset role');
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.fama_agenda_deliveries'),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
