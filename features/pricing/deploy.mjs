/** Runs through the authenticated connector; credentials and bindings stay at Cloudflare. */
export async function deployPricing(cloudflare,accountId,input,activate=false){
 const digest=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const prepared=[];
 for(const kind of ['system','control']){
  const path=`/accounts/${accountId}/workers/scripts/fama-${kind}-app`;
  const [raw,settings,dep]=await Promise.all([cloudflare.request({method:'GET',path}),cloudflare.request({method:'GET',path:path+'/settings'}),cloudflare.request({method:'GET',path:path+'/deployments'})]);
  const version=dep.result.deployments[0].versions;if(version.length!==1||version[0].percentage!==100)throw Error('Split deployment');
  if(version[0].version_id!==input.versions[kind])throw Error('Production changed: '+kind);
  const boundary=raw.split('\r\n')[0];const parts=raw.split(boundary).flatMap(p=>{const i=p.indexOf('\r\n\r\n'),name=p.slice(0,i).match(/name="([^"]+)"/)?.[1];return name?[{name,body:p.slice(i+4).replace(/\r\n$/,'')}]:[];});
  const before=await digest(JSON.stringify([...parts].sort((a,b)=>a.name.localeCompare(b.name))));const changed=[];
  if(!parts.some(p=>p.name==='seo-main.mjs'))throw Error('Missing current SEO entry');
  if(kind==='system')for(const patch of input.patches){const target=parts.find(p=>patch.scope==='backend'?p.name==='index.js':p.name.includes(patch.scope));if(!target||target.body.split(patch.old).length!==2)throw Error('Patch mismatch '+patch.scope+': '+patch.old.slice(0,50));target.body=target.body.replace(patch.old,patch.new);if(!changed.includes(target.name))changed.push(target.name);}
  parts.push({name:'pricing-main.mjs',body:`import app from './seo-main.mjs';import {withPricing} from './pricing-core.mjs';import assets from './pricing-assets.mjs';import css from './pricing-styles.mjs';export default withPricing(app,'${kind}',assets,css);`},{name:'pricing-core.mjs',body:input.entry},{name:'pricing-assets.mjs',body:'export default '+JSON.stringify(kind==='system'?input.assets:{})+';\n'},{name:'pricing-styles.mjs',body:'export default '+JSON.stringify(kind==='system'?input.css:'')+';\n'});
  const s=settings.result;const metadata={main_module:'pricing-main.mjs',bindings:s.bindings.map(b=>({name:b.name,type:'inherit'})),keep_assets:true,compatibility_date:s.compatibility_date,compatibility_flags:s.compatibility_flags,observability:s.observability,usage_model:s.usage_model,logpush:s.logpush,tail_consumers:s.tail_consumers,tags:s.tags};if(s.limits)metadata.limits=s.limits;if(s.placement)metadata.placement=s.placement;
  const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));for(const p of parts)form.append(p.name,new Blob([p.body],{type:'application/javascript+module'}),p.name);
  prepared.push({path,form,kind,version:version[0].version_id,summary:{kind,before,modules:parts.length,changed,bindings:s.bindings.length}});
 }
 if(!activate)return {verified:true,packages:prepared.map(p=>p.summary)};
 const published=[];try{for(const p of prepared){const r=await cloudflare.request({method:'PUT',path:p.path,body:p.form});if(!r.success)throw Error(JSON.stringify(r.errors));published.push(p);}}catch(e){const rollback=[];for(const p of published)rollback.push(await cloudflare.request({method:'POST',path:p.path+'/deployments',body:{strategy:'percentage',versions:[{version_id:p.version,percentage:100}]}}));return {success:false,error:String(e),rollback};}
 const deployments=[];for(const p of prepared){const r=await cloudflare.request({method:'GET',path:p.path+'/deployments'});deployments.push({kind:p.kind,deployment:r.result.deployments[0]});}return {success:true,packages:prepared.map(p=>p.summary),deployments};
}
