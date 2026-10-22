import {readFile,mkdir,writeFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createDecipheriv,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
if(!args.includes('--backup')||!args.includes('--key-file'))throw new Error('Use --backup arquivo.json --key-file chave.json e --out pasta vazia, ou --verify-only.');
const backup=JSON.parse(await readFile(option('--backup'),'utf8')),savedKey=JSON.parse(await readFile(option('--key-file'),'utf8'));
const key=/^[0-9a-f]{64}$/i.test(savedKey.key)?Buffer.from(savedKey.key,'hex'):Buffer.from(savedKey.key,'base64url');if(key.length!==32)throw new Error('Chave inválida.');
const decrypt=value=>{if(typeof value!=='string'||!value.startsWith('fama:v1:'))throw new Error('Parte sem criptografia.');const [iv,data]=value.slice(8).split('.'),bytes=Buffer.from(data,'base64url');const c=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));c.setAuthTag(bytes.subarray(-16));return Buffer.concat([c.update(bytes.subarray(0,-16)),c.final()]).toString('utf8')};
const hash=value=>createHash('sha256').update(value).digest('hex');
const manifest=JSON.parse(decrypt(backup.manifest));if(backup.format!=='fama-platform-backup-v3'||manifest.verification?.valid!==true||!Array.isArray(backup.parts)||backup.parts.length!==manifest.partCount)throw new Error('Backup incompleto ou não validado.');
const verified=[];for(let n=0;n<backup.parts.length;n++){const p=backup.parts[n],plain=decrypt(p.payload),body=JSON.parse(plain);if(p.part_number!==n||body.number!==n||body.runId!==manifest.runId||hash(plain)!==p.checksum||p.checksum!==manifest.parts[n]?.checksum)throw new Error('Parte corrompida.');verified.push(body)}
const checkOnly=args.includes('--verify-only');if(!checkOnly&&!args.includes('--out'))throw new Error('Informe --out pasta vazia.');
const output=checkOnly?await mkdtemp(join(tmpdir(),'fama-restore-')):resolve(option('--out'));await mkdir(output,{recursive:true,mode:0o700});if((await readdir(output)).length)throw new Error('A pasta de recuperação precisa estar vazia.');
const quote=name=>{if(!/^[a-z_][a-z0-9_]*$/i.test(name))throw new Error('Nome de tabela inválido.');return '"'+name+'"'};
let tables=0,rows=0,files=0;
try{
 for(const part of verified.filter(p=>p.kind==='d1-control'||p.kind==='d1-system')){
  const db=new DatabaseSync(join(output,part.kind+'.sqlite'));db.exec('PRAGMA foreign_keys=ON');const pending=[...part.content.tables],done=new Set();
  try{while(pending.length){const i=pending.findIndex(t=>(t.foreignKeys??[]).every(f=>done.has(f.table)||!part.content.tables.some(t=>t.name===f.table)));if(i<0)throw new Error('Relação circular no banco local.');const table=pending.splice(i,1)[0];if(!/^\s*CREATE\s+TABLE\b/i.test(table.sql))throw new Error('Estrutura inválida.');db.exec(table.sql);const insert=db.prepare(`INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(',')}) VALUES (${table.columns.map(()=>'?').join(',')})`);for(const row of table.rows)insert.run(...table.columns.map(k=>row[k]??null));if(db.prepare(`SELECT count(*) AS n FROM ${quote(table.name)}`).get().n!==table.rows.length)throw new Error('Restauração local incompleta.');tables++;rows+=table.rows.length;done.add(table.name)}if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Relação local inválida.');}finally{db.close()}
 }
 const grouped=new Map();for(const p of verified.filter(p=>p.kind==='storage-file')){const c=p.content,k=c.bucket+'/'+c.name;const group=grouped.get(k)??[];group.push(c);grouped.set(k,group)}
 for(const [path,pieces] of grouped){pieces.sort((a,b)=>a.offset-b.offset);let offset=0;const chunks=[];for(const piece of pieces){const b=Buffer.from(piece.data,'base64');if(piece.offset!==offset||piece.size!==pieces[0].size||piece.checksum!==pieces[0].checksum)throw new Error('Sequência do arquivo inválida.');chunks.push(b);offset+=b.length}const data=Buffer.concat(chunks);if(data.length!==pieces[0].size||hash(data)!==pieces[0].checksum)throw new Error('Arquivo corrompido.');const base=join(output,'files'),target=resolve(base,path);if(!target.startsWith(base+sep)||path.split('/').some(x=>x==='..'||x==='.'||!x))throw new Error('Caminho inválido.');await mkdir(resolve(target,'..'),{recursive:true,mode:0o700});await writeFile(target,data,{mode:0o600});files++}
 const postgres=verified.filter(p=>p.kind==='postgres-table');await writeFile(join(output,'postgres-rows.jsonl'),postgres.map(p=>JSON.stringify(p.content)).join('\n')+'\n',{mode:0o600});
 const literal=s=>"'"+s.replaceAll("'","''")+"'";
 const collections=new Map();for(const p of postgres){const c=p.content,k=c.schema+'.'+c.table;const item=collections.get(k)??{schema:c.schema,table:c.table,rows:[]};item.rows.push(...c.rows);collections.set(k,item)}
 // Work only in existing schemas, insert missing primary keys, and retry FK
 // dependencies. Storage bytes are uploaded separately through the Storage API.
 const data=[...collections.values()].filter(t=>['public','auth'].includes(t.schema));
 const encodedData=JSON.stringify(data);let delimiter='$fama_restore_'+hash(encodedData).slice(0,24)+'$';while(encodedData.includes(delimiter))delimiter=delimiter.slice(0,-1)+'_$';
 const sql=`SET standard_conforming_strings=on;\nDO ${delimiter}\nDECLARE task jsonb; row_data jsonb; pending jsonb := ${literal(encodedData)}::jsonb; retry jsonb; columns_sql text; relation regclass; pass integer;\nBEGIN\nFOR pass IN 1..100 LOOP\nretry := '[]'::jsonb;\nFOR task IN SELECT value FROM jsonb_array_elements(pending) LOOP\nBEGIN\nrelation := to_regclass(format('%I.%I',task->>'schema',task->>'table')); IF relation IS NULL THEN RAISE EXCEPTION 'Schema missing: %',task->>'table'; END IF;\nSELECT string_agg(format('%I',attname),',' ORDER BY attnum) INTO columns_sql FROM pg_catalog.pg_attribute WHERE attrelid=relation AND attnum>0 AND NOT attisdropped AND attgenerated='';\nFOR row_data IN SELECT value FROM jsonb_array_elements(task->'rows') LOOP\nEXECUTE format('INSERT INTO %I.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::%I.%I,$1) ON CONFLICT DO NOTHING',task->>'schema',task->>'table',columns_sql,columns_sql,task->>'schema',task->>'table') USING row_data;\nEND LOOP;\nEXCEPTION WHEN foreign_key_violation THEN retry := retry || jsonb_build_array(task);\nEND;\nEND LOOP;\nIF jsonb_array_length(retry)=0 THEN RETURN; END IF; pending := retry;\nEND LOOP; RAISE EXCEPTION 'Unresolved foreign keys; restore rolled back';\nEND ${delimiter};\n`;
 await writeFile(join(output,'restore-missing-postgres.sql'),sql,{mode:0o600});
 console.log(JSON.stringify({valid:true,localTables:tables,localRows:rows,postgresTables:data.length,postgresRows:data.reduce((n,t)=>n+t.rows.length,0),files,...(!checkOnly?{output}:{} )}));
}finally{if(checkOnly)await rm(output,{recursive:true,force:true})}
