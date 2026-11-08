import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
const rows=[],summary={};
async function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','dist','.next','.git','.sites-runtime','.wrangler'].includes(entry.name))continue;const path=dir+'/'+entry.name;if(entry.isDirectory())out.push(...await files(path));else out.push(path);}return out;}
for(const app of ['system','control']){
  const all=await files('apps/'+app),tests=all.filter(path=>path.includes('/tests/')&&path.endsWith('.test.mjs'));
  const sources=await Promise.all(tests.map(async path=>({path,source:await readFile(path,'utf8')})));
  const routes=all.filter(path=>/\/app\/api\/.*\/route\.[jt]s$/.test(path));
  summary[app]={files:all.length,javascript:all.filter(path=>/\.[mc]?jsx?$/.test(path)).length,routeFiles:routes.length,testFiles:tests.length};
  for(const file of routes){const source=await readFile(file,'utf8'),path=file.split('/app')[1].replace(/\/route\.[jt]s$/,'');
    const methods=[...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g)].map(match=>match[1]);
    const references=sources.filter(test=>test.source.includes(path.replace(/\[id\]/g,'fixture'))||test.source.includes(file.split('/app/')[1])).map(test=>test.path);
    rows.push({application:app,path,methods,file,sourceTestReferences:references,executionStatus:'See audit report; source references do not prove runtime coverage'});
  }
}
for(const path of ['/api/pedidos','/api/pedidos/context','/api/pedidos/[id]','/api/pedidos/[id]/attachments','/api/pedidos/[id]/attachments/[attachmentId]','/api/internal/pedidos-policy','/api/pedidos-admin'])rows.push({application:path.endsWith('-admin')?'control':'system',path,file:'features/pedidos/api.mjs',executionStatus:'Automated isolated integration tests; no authenticated production session'});
await mkdir('docs/audit',{recursive:true});
await writeFile('docs/audit/inventory.json',JSON.stringify({summary,routes:rows},null,2));
console.log(JSON.stringify({summary,totalRouteEntries:rows.length},null,2));
