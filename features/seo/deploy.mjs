export const baseline = {
 system:{version:'29da1dc5-156d-4a12-bd9b-f5f1d0ce5231',count:131,sha256:'e4d295d9d4204e5f79c2e90f0193e070aa2d8833d39ce79ce67ccb488e18e144'},
 control:{version:'c9338df9-528a-48c0-aecb-0bc9eeeb33f0',count:64,sha256:'52d43d26379c7abf7a4b3bd11b732d2f8ebc52228f5d6dfcdf260a3993263dfc'},
};
export async function deploySEO(cloudflare,accountId,source,activate=false) {
 const digest=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const parse=raw=>{const boundary=raw.split('\r\n')[0];return raw.split(boundary).flatMap(p=>{const i=p.indexOf('\r\n\r\n');const name=p.slice(0,i).match(/name="([^"]+)"/)?.[1];return name?[{name,body:p.slice(i+4).replace(/\r\n$/,'')}]:[]}).sort((a,b)=>a.name.localeCompare(b.name));};
 if(!source.includes('export function withSEO'))throw Error('Missing SEO module');
 const packages=[];
 for(const kind of ['system','control']) {
  const path=`/accounts/${accountId}/workers/scripts/fama-${kind}-app`;
  const [raw,settings,deployments]=await Promise.all([
   cloudflare.request({method:'GET',path:path+'/content/v2',query:{module:'index.js'}}),
   cloudflare.request({method:'GET',path:path+'/settings'}),
   cloudflare.request({method:'GET',path:path+'/deployments'}),
  ]);
  const expected=baseline[kind];const active=deployments.result.deployments[0].versions;
  if(active.length!==1||active[0].version_id!==expected.version||active[0].percentage!==100)throw Error('Active version changed: '+kind);
  const parts=parse(raw);
  if(parts.length!==expected.count||await digest(JSON.stringify(parts))!==expected.sha256)throw Error('Baseline mismatch: '+kind);
  if(parts.some(p=>p.name.startsWith('seo-'))||!parts.some(p=>p.name==='account-access-main.mjs'))throw Error('Unexpected entry: '+kind);
  const main=`import app from './account-access-main.mjs';\nimport {withSEO} from './seo-entry.mjs';\nexport default withSEO(app,'${kind}');\n`;
  const all=[...parts,{name:'seo-entry.mjs',body:source},{name:'seo-main.mjs',body:main}];
  const s=settings.result;
  const metadata={main_module:'seo-main.mjs',bindings:s.bindings.map(b=>({name:b.name,type:'inherit'})),keep_assets:true};
  for(const key of ['compatibility_date','compatibility_flags','observability','usage_model','logpush','tail_consumers','tags','limits','placement'])if(s[key]!==undefined)metadata[key]=s[key];
  const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
  for(const p of all)form.append(p.name,new Blob([p.body],{type:'application/javascript+module'}),p.name);
  packages.push({path,expected,form,all,summary:{kind,modules:all.length,preserved:parts.length,bindings:s.bindings.length}});
 }
 if(!activate)return {verified:true,packages:packages.map(p=>p.summary)};
 // Recheck both active versions immediately before the first mutation.
 for(const p of packages){const d=await cloudflare.request({method:'GET',path:p.path+'/deployments'});if(d.result.deployments[0].versions[0].version_id!==p.expected.version)throw Error('Production changed before activation');}
 const published=[];
 try {
  for(const p of packages){const result=await cloudflare.request({method:'PUT',path:p.path,query:{bindings_inherit:'strict'},body:p.form});if(!result.success)throw Error(JSON.stringify(result.errors));published.push(p);}
  const verified=[];
  for(const p of packages){
   const back=parse(await cloudflare.request({method:'GET',path:p.path+'/content/v2',query:{module:'index.js'}}));
   const sorted=[...p.all].sort((a,b)=>a.name.localeCompare(b.name));
   if(await digest(JSON.stringify(back))!==await digest(JSON.stringify(sorted)))throw Error('Read-back mismatch');
   const d=await cloudflare.request({method:'GET',path:p.path+'/deployments'});
   verified.push({...p.summary,deployment:d.result.deployments[0]});
  }
  return {success:true,verified};
 }catch(error){
  const rollbacks=[];
  for(const p of published){const r=await cloudflare.request({method:'POST',path:p.path+'/deployments',body:{strategy:'percentage',versions:[{version_id:p.expected.version,percentage:100}]}});rollbacks.push({path:p.path,success:r.success});}
  return {success:false,error:String(error),rollbacks};
 }
}
