import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createCipheriv,randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
const root=new URL('..',import.meta.url).pathname,key=Buffer.alloc(32,7),binary=Buffer.from([0,255,1,128,19,65,250]);
const hash=v=>createHash('sha256').update(v).digest('hex');
const encrypt=s=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),bytes=Buffer.concat([c.update(s),c.final(),c.getAuthTag()]);return 'fama:v1:'+iv.toString('base64url')+'.'+bytes.toString('base64url')};
const id='12345678-1234-1234-1234-123456789abc';
function fixture(){
 const content=[['d1-control',{tables:[{name:'settings',sql:'CREATE TABLE settings(id TEXT PRIMARY KEY,value TEXT NOT NULL)',columns:['id','value'],rows:[{id:'a',value:'Dados reais de teste'}],foreignKeys:[]}]}],['d1-system',{tables:[{name:'customers',sql:'CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT NOT NULL)',columns:['id','name'],rows:[{id:'b',name:'Cliente da recuperação'}],foreignKeys:[]}]}],['storage-file',{bucket:'fama-documents',name:'org/real.pdf',offset:0,size:binary.length,checksum:hash(binary),data:binary.toString('base64')}],['postgres-table',{schema:'public',table:'customers',offset:0,rows:[{id:'b',notes:"$restore$; DELETE FROM customers; -- '"}]}]];
 const parts=content.map(([kind,content],number)=>{const plain=JSON.stringify({format:'fama-backup-part-v3',runId:id,number,kind,content});return {id:`${id}:${number}`,part_number:number,payload:encrypt(plain),checksum:hash(plain)}});
 return {format:'fama-platform-backup-v3',manifest:encrypt(JSON.stringify({runId:id,partCount:parts.length,parts:parts.map(p=>({checksum:p.checksum})),verification:{valid:true}})),parts};
}
async function setup(fn){const dir=await mkdtemp(join(tmpdir(),'fama-backup-test-'));try{const backup=join(dir,'backup.json'),keyFile=join(dir,'key.json');await writeFile(backup,JSON.stringify(fixture()));await writeFile(keyFile,JSON.stringify({key:key.toString('hex')}));await fn({dir,backup,keyFile});}finally{await rm(dir,{recursive:true,force:true})}}
const run=(backup,keyFile,...args)=>spawnSync(process.execPath,[join(root,'scripts/restore-backup.mjs'),'--backup',backup,'--key-file',keyFile,...args],{encoding:'utf8'});
test('offline recovery restores both SQLite stores, binary files and safe PostgreSQL recovery SQL',()=>setup(async({dir,backup,keyFile})=>{
 const out=join(dir,'recovered'),result=run(backup,keyFile,'--out',out);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).files,1);
 const db=new DatabaseSync(join(out,'d1-system.sqlite'));assert.equal(db.prepare('SELECT name FROM customers').get().name,'Cliente da recuperação');db.close();assert.deepEqual(await readFile(join(out,'files/fama-documents/org/real.pdf')),binary);
 const sql=await readFile(join(out,'restore-missing-postgres.sql'),'utf8'),delimiter=sql.match(/DO (\$fama_restore_[\w]+\$)/)[1];assert.equal(sql.split(delimiter).length,3);assert.match(sql,/ON CONFLICT DO NOTHING/);assert.match(sql,/standard_conforming_strings=on/);
}));
test('verification needs no live provider and corruption is rejected before recovery',()=>setup(async({backup,keyFile})=>{
 const good=run(backup,keyFile,'--verify-only');assert.equal(good.status,0,good.stderr);assert.equal(JSON.parse(good.stdout).localRows,2);
 const bad=fixture();bad.parts[0].payload='fama:v1:broken.invalid';await writeFile(backup,JSON.stringify(bad));assert.notEqual(run(backup,keyFile,'--verify-only').status,0);
}));
