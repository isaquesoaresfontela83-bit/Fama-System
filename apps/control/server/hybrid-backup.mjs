import { randomUUID } from 'node:crypto';
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const canonical = rows => rows.map(row => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b]) => a.localeCompare(b))))).sort();

export async function capturePostgresSnapshot(database) {
 return database.transaction(async client => {
  await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  const names=await client.query("SELECT tablename AS name FROM pg_tables WHERE schemaname=$1 AND tablename NOT LIKE '\\_fama\\_%' ORDER BY tablename",[database.schema]);
  const tables=[];
  for(const {name} of names.rows){
   const data=await client.query('SELECT * FROM '+quote(name));
   tables.push({name,columns:data.fields.map(field=>field.name),rows:data.rows});
  }
  return {format:'fama-postgres-v1',capturedAt:new Date().toISOString(),tables};
 });
}

export async function verifyPostgresSnapshot(database,snapshot) {
 if(snapshot?.format!=='fama-postgres-v1'||!Array.isArray(snapshot.tables)||snapshot.tables.length>500)throw new Error('Backup PostgreSQL inválido.');
 return database.transaction(async client=>{
  const prefix='fama_restore_'+randomUUID().replaceAll('-','')+'_';
  const tables=new Map();let records=0;
  for(const table of snapshot.tables){
   if(!/^[a-z_][a-z0-9_]*$/.test(table.name)||table.name.startsWith('_fama_')||tables.has(table.name)||!Array.isArray(table.rows))throw new Error('Tabela de backup inválida.');
   const target=prefix+tables.size;
   const existing=await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',[database.schema,table.name]);
   const columns=existing.rows.map(row=>row.column_name);
   if(!columns.length||JSON.stringify(columns)!==JSON.stringify(table.columns))throw new Error('A estrutura atual não corresponde ao backup.');
   await client.query('CREATE TEMP TABLE '+quote(target)+' (LIKE '+quote(database.schema)+'.'+quote(table.name)+' INCLUDING ALL) ON COMMIT DROP');
   for(const row of table.rows){
    if(!row||Object.keys(row).length!==columns.length||columns.some(column=>!Object.hasOwn(row,column)))throw new Error('Registro de backup inválido.');
    await client.query('INSERT INTO '+quote(target)+' ('+columns.map(quote).join(',')+') VALUES ('+columns.map((_,index)=>'$'+(index+1)).join(',')+')',columns.map(column=>row[column]));
   }
   const result=await client.query('SELECT * FROM '+quote(target));
   if(JSON.stringify(canonical(result.rows))!==JSON.stringify(canonical(table.rows)))throw new Error('Os registros restaurados divergiram.');
   tables.set(table.name,target);records+=table.rows.length;
  }
  const foreign=await client.query(`SELECT child.relname AS child,parent.relname AS parent,
   array(SELECT attname FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS source,
   array(SELECT attname FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) AS target
   FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_class parent ON parent.oid=c.confrelid
   JOIN pg_namespace n ON n.oid=child.relnamespace WHERE c.contype='f' AND n.nspname=$1`,[database.schema]);
  for(const key of foreign.rows){
   if(!tables.has(key.child))continue;
   if(!tables.has(key.parent))throw new Error('O backup não contém uma tabela relacionada.');
   await client.query('ALTER TABLE '+quote(tables.get(key.child))+' ADD FOREIGN KEY ('+key.source.map(quote).join(',')+') REFERENCES '+quote(tables.get(key.parent))+' ('+key.target.map(quote).join(',')+')');
  }
  return {valid:true,tables:tables.size,records,restoredInto:'isolated temporary PostgreSQL tables'};
 });
}
