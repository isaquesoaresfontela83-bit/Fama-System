import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {operationalFixture} from './operational-fixture.mjs';
const f=await operationalFixture(new URL('..',import.meta.url).pathname,'system-auth');
const archive=await f.load('/lib/backup-archive.js'),crypt=await f.load('/lib/crypto.js');
const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE platform_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT)');
const prepare=(sql,values=[])=>({bind(...v){return prepare(sql,v)},async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}}}});f.runtime.DB={prepare};
const id='12345678-1234-1234-1234-123456789abc',objects=new Map();let writes=0,calls=0;
f.runtime.BUCKET={async get(k){const v=objects.get(k);return v===undefined?null:{async text(){return v}}},async put(k,v){writes++;objects.set(k,v)},async list({prefix}){return{objects:[...objects.keys()].filter(k=>k.startsWith(prefix)).sort().map(key=>({key})),truncated:false}},async delete(keys){keys.forEach(k=>objects.delete(k))}};
const bytes=Buffer.from([0,255,128,3,10,13,250,31,77]);
const contents=Array.from({length:11},(_,n)=>n<8?{schema:'public',table:'customers',offset:n,rows:[{id:String(n)}]}:{bucket:'fama-documents',name:'org/file.pdf',mime:'application/pdf',offset:(n-8)*3,size:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex'),data:bytes.subarray((n-8)*3,(n-7)*3).toString('base64')});
const parts=[];for(let n=0;n<contents.length;n++){const plain=JSON.stringify({format:'fama-backup-part-v3',runId:id,number:n,kind:n<8?'postgres-table':'storage-file',content:contents[n]});parts.push({id:`${id}:${n}`,part_number:n,checksum:createHash('sha256').update(plain).digest('hex'),payload:await crypt.encryptText(plain)});}
const manifest={partCount:11,parts:parts.map((p,n)=>({number:n,kind:n<8?'postgres-table':'storage-file',checksum:p.checksum})),verification:{valid:true}};
const run={id,status:'complete',created_at:new Date().toISOString(),manifest,manifest_payload:await crypt.encryptText(JSON.stringify({format:'fama-backup-manifest-v3',runId:id,...manifest}))};
globalThis.fetch=async(input,init)=>{const body=JSON.parse(init.body);calls++;assert.equal(body.p_run_id,id);return Response.json(parts[body.p_offset])};
after(async()=>{await f.close();sqlite.close()});
test('external archive resumes after eight parts and exports every binary chunk without the primary database',async()=>{
 const first=await archive.mirrorBackup(run);assert.equal(first.complete,false);assert.equal(first.cursor,8);
 const second=await archive.mirrorBackup(run);assert.equal(second.complete,true);assert.equal(second.cursor,11);
 const count=calls;await archive.mirrorBackup(run);assert.equal(calls,count);
 globalThis.fetch=async()=>{throw new Error('Primary database unavailable')};
 const exported=await(await archive.downloadArchive(id)).json();assert.equal(exported.parts.length,11);
 const decoded=await Promise.all(exported.parts.map(async p=>JSON.parse(await crypt.decryptText(p.payload))));
 assert.deepEqual(Buffer.concat(decoded.filter(p=>p.kind==='storage-file').map(p=>Buffer.from(p.content.data,'base64'))),bytes);
 assert.equal((await archive.archiveStatus(id)).complete,true);
});
test('external export rejects corrupted parts and truncated manifests',async()=>{
 const key=`fama-backups/${id}/parts/000000.json`,saved=objects.get(key),bad=JSON.parse(saved);bad.payload='fama:v1:broken.invalid';objects.set(key,JSON.stringify(bad));await assert.rejects(async()=>{await(await archive.downloadArchive(id)).json()});objects.set(key,saved);
 const key2=`fama-backups/${id}/manifest.json`,original=objects.get(key2),header=JSON.parse(original);header.partsCount=0;objects.set(key2,JSON.stringify(header));await assert.rejects(()=>archive.downloadArchive(id),/Manifesto/);objects.set(key2,original);
});
test('thirty-day retention preserves current archives and performs cleanup once per day',async()=>{
 const old='12345678-1234-1234-1234-123456789abd';objects.set(`fama-backups/${old}/progress.json`,JSON.stringify({id:old,createdAt:new Date(Date.now()-31*86400000).toISOString()}));objects.set(`fama-backups/${old}/parts/000000.json`,'old');await archive.pruneArchive();assert.equal(objects.has(`fama-backups/${old}/progress.json`),false);assert.equal(objects.has(`fama-backups/${id}/progress.json`),true);const count=writes;await archive.pruneArchive();assert.equal(writes,count);
});
