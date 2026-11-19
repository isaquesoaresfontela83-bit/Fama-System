export async function deployPreview(cloudflare,accountId,input,activate=false){
 const sha=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const parse=raw=>{const b=raw.split('\r\n')[0];return raw.split(b).flatMap(p=>{const i=p.indexOf('\r\n\r\n'),name=p.slice(0,i).match(/name="([^"]+)"/)?.[1];return name?[{name,body:p.slice(i+4).replace(/\r\n$/,'')}]:[];});};
 const packages=[];
 for(const kind of ['system','control']){
  const path=`/accounts/${accountId}/workers/scripts/fama-${kind}-app`;
  const[raw,settings,deployments]=await Promise.all([cloudflare.request({method:'GET',path}),cloudflare.request({method:'GET',path:path+'/settings'}),cloudflare.request({method:'GET',path:path+'/deployments'})]);
  const active=deployments.result.deployments[0].versions;
  if(active.length!==1||active[0].percentage!==100||active[0].version_id!==input.versions[kind])throw Error('Production version mismatch '+kind);
  const parts=parse(raw);if(parts.some(p=>p.name.startsWith('optical-preview-')))throw Error('Preview already installed');if(!parts.some(p=>p.name==='pricing-main.mjs'))throw Error('Missing current entry');
  const beforeHash=await sha(JSON.stringify([...parts].sort((a,b)=>a.name.localeCompare(b.name))));
  parts.push({name:'optical-preview-main.mjs',body:`import app from './pricing-main.mjs';import {withOpticalPreview} from './optical-preview-core.mjs';import resources from './optical-preview-resources.mjs';export default withOpticalPreview(app,'${kind}',resources);`},{name:'optical-preview-core.mjs',body:input.entry},{name:'optical-preview-resources.mjs',body:'export default '+JSON.stringify(kind==='system'?input.resources:{})+';\n'});
  const s=settings.result,metadata={main_module:'optical-preview-main.mjs',bindings:s.bindings.map(b=>({name:b.name,type:'inherit'})),keep_assets:true,compatibility_date:s.compatibility_date,compatibility_flags:s.compatibility_flags,observability:s.observability,usage_model:s.usage_model,logpush:s.logpush,tail_consumers:s.tail_consumers,tags:s.tags};if(s.placement)metadata.placement=s.placement;if(s.limits)metadata.limits=s.limits;
  const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));for(const p of parts)form.append(p.name,new Blob([p.body],{type:'application/javascript+module'}),p.name);
  packages.push({kind,path,form,beforeHash,count:parts.length,bindings:s.bindings.length});
 }
 if(!activate)return{verified:true,packages:packages.map(({kind,count,bindings,beforeHash})=>({kind,count,bindings,beforeHash}))};
 const uploaded=[];try{for(const p of packages){const current=(await cloudflare.request({method:'GET',path:p.path+'/deployments'})).result.deployments[0].versions;if(current.length!==1||current[0].version_id!==input.versions[p.kind])throw Error('Production changed');const r=await cloudflare.request({method:'PUT',path:p.path,body:p.form});if(!r.success)throw Error(JSON.stringify(r.errors));uploaded.push(p);}}
 catch(error){const rollback=[];for(const p of uploaded){const r=await cloudflare.request({method:'POST',path:p.path+'/deployments',body:{strategy:'percentage',versions:[{version_id:input.versions[p.kind],percentage:100}]}});rollback.push({kind:p.kind,success:r.success});}return{success:false,error:String(error),rollback};}
 const results=[];for(const p of packages){const raw=await cloudflare.request({method:'GET',path:p.path});const parts=parse(raw);const hash=await sha(JSON.stringify(parts.filter(x=>!x.name.startsWith('optical-preview-')).sort((a,b)=>a.name.localeCompare(b.name))));if(hash!==p.beforeHash)throw Error('Readback integrity mismatch '+p.kind);const d=(await cloudflare.request({method:'GET',path:p.path+'/deployments'})).result.deployments[0];results.push({kind:p.kind,modules:parts.length,preserved:parts.length-3,integrity:true,bindings:p.bindings,deployment:d});}return{success:true,results};
}
