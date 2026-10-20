import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('..',import.meta.url).pathname,'system-auth');
const backup=await f.load('/lib/platform-backup.js');const crypt=await f.load('/lib/crypto.js');
const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE settings(id TEXT PRIMARY KEY,value TEXT NOT NULL); INSERT INTO settings VALUES (\'one\',\'Encrypted fiscal settings\')');
const prepare=(sql,values=[])=>({bind(...v){return prepare(sql,v)},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return {meta:sqlite.prepare(sql).run(...values)}}});
f.runtime.DB={prepare,async batch(items){return Promise.all(items.map(i=>i.run()))}};f.runtime.FAMA_BACKUP_SERVICE_TOKEN='fixture-backup-only';
const content=new TextEncoder().encode('A real attachment fixture');let temp=null,sourcePresent=true,run;
const inventory=[{schema:'public',name:'organizations',key:'organizations',count:1,columns:['id']},{schema:'storage',name:'objects',key:'storage.objects',count:1,columns:['id','bucket_id','name','metadata']}];
const source={organizations:[{id:'one'}],'storage.objects':[{id:'file',bucket_id:'fama-documents',name:'one/invoice.pdf',metadata:{size:content.length}}]};
const parts=[];let corrupted=false;
f.tables.fama_full_backup_runs=[];
globalThis.fetch=async(input,init={})=>{
 const url=new URL(String(input));const body=typeof init.body==='string'?JSON.parse(init.body):init.body;
 if(url.origin==='https://famasystem.online'){assert.equal(new Headers(init.headers).get('Authorization'),'Bearer fixture-backup-only');return Response.json({snapshot:{capturedAt:'now',tables:[]},verification:{valid:true,tables:0,records:0}})}
 if(url.pathname.includes('/storage/v1/object/')){
  const method=init.method??'GET';if(method==='POST'){assert.ok(url.pathname.includes('__fama_backup_verify/'));temp=new Uint8Array(body);return Response.json({ok:true})}
  if(method==='DELETE'){assert.ok(body.prefixes[0].startsWith('__fama_backup_verify/'));temp=null;return Response.json({ok:true})}
  return new Response(url.pathname.includes('__fama_backup_verify/')?temp:content,{headers:{'Content-Type':'application/pdf'}});
 }
 const name=url.pathname.split('/').at(-1);
 if(name==='fama_start_full_backup'){run={id:'run-one',source_backup_id:'source-one',scheduled:false,status:'running',created_at:new Date().toISOString(),error:'',manifest:{source:{id:'source-one',inventory,createdAt:'now'},stage:'postgres',index:0,offset:0,partCount:0,parts:[],fileCount:0},manifest_payload:''};return Response.json(run)}
 if(name==='fama_claim_backup_run')return Response.json(run);
 if(name==='fama_backup_snapshot_page')return Response.json(source[body.p_key].slice(body.p_offset,body.p_offset+100));
 if(name==='fama_put_backup_part'){parts[body.p_number]={id:`run-one:${body.p_number}`,part_number:body.p_number,payload:body.p_payload,checksum:body.p_checksum};return Response.json(true)}
 if(name==='fama_verify_backup_snapshot')return Response.json({valid:true,tables:2,records:2,foreignKeys:1});
 if(name==='fama_backup_run_part'){const value=parts[body.p_offset];return Response.json(value&&corrupted?{...value,payload:'fama:v1:corrupted.invalid'}:value??null)}
 if(name==='fama_commit_backup_run'){Object.assign(run,{status:body.p_status,manifest:body.p_manifest,manifest_payload:body.p_manifest_payload,error:body.p_error});return Response.json(true)}
 throw new Error(`Unexpected backup request: ${url.pathname}`);
};
after(async()=>{await f.close();sqlite.close()});
test('resumable backup preserves database, both local stores, and the real attachment bytes',async()=>{
 await backup.startBackup();for(let i=0;i<10&&run.status==='running';i++)await backup.stepBackup(run.id);
 assert.equal(run.status,'complete');assert.equal(run.manifest.verification.valid,true);assert.equal(run.manifest.fileCount,1);assert.equal(temp,null);assert.equal(sourcePresent,true);
 const archive=await backup.downloadBackup(run).json();assert.equal(archive.parts.length,5);
 const decoded=await Promise.all(archive.parts.map(async part=>JSON.parse(await crypt.decryptText(part.payload))));
 assert.ok(decoded.some(p=>p.kind==='d1-control'));assert.ok(decoded.some(p=>p.kind==='d1-system'));
 const file=decoded.find(p=>p.kind==='storage-file');assert.deepEqual(Buffer.from(file.content.data,'base64'),Buffer.from(content));
 assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name LIKE 'fama_restore_%'").get().n,0);
});
test('a corrupted saved part cannot be marked as a complete backup',async()=>{
 parts.length=0;corrupted=true;await backup.startBackup();
 await assert.rejects(async()=>{for(let i=0;i<10&&run.status==='running';i++)await backup.stepBackup(run.id)});
 assert.equal(run.status,'failed');assert.equal(run.manifest_payload,'');assert.equal(temp,null);
});
