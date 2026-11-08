import {mkdir,writeFile} from 'node:fs/promises';
const checks=[];
for(const origin of ['https://famasystem.online','https://control.famasystem.online']){
  const page=origin.includes('control.')?'/':'/entrar';
  for(const path of [page,'/api/health','/api/access','/api/pedidos','/api/admin/organizations','/api/internal/pedidos-policy']){
    const start=performance.now();
    try{
      const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'x-organization-id':'audit-nonexistent-organization'}});
      const result={origin,path,status:response.status,elapsedMs:Math.round(performance.now()-start),headers:Object.fromEntries(['cache-control','x-content-type-options','x-frame-options','referrer-policy','content-security-policy','strict-transport-security','access-control-allow-origin'].map(name=>[name,response.headers.get(name)]))};
      if(path==='/api/health'&&response.ok){const payload=await response.json();result.version=payload.version;result.releaseId=payload.releaseId;}else await response.body?.cancel();
      checks.push(result);
    }catch(error){checks.push({origin,path,error:error.name});}
  }
}
await mkdir('artifacts/security',{recursive:true});await writeFile('artifacts/security/production-readonly-smoke.json',JSON.stringify(checks,null,2));
console.log(JSON.stringify(checks.map(({origin,path,status,version,error})=>({origin,path,status,version,error})),null,2));
if(checks.some(check=>check.error||(['/api/health'].includes(check.path)&&check.status!==200)))process.exitCode=1;
