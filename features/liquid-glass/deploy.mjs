/** Run through the authenticated Cloudflare connection; no credentials on disk. */
export async function deployGlass(cloudflare, accountId, input, activate = false) {
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const prepared=[];
  for (const kind of ['system','control']) {
    const worker=`fama-${kind}-app`,path=`/accounts/${accountId}/workers/scripts/${worker}`;
    const [script,settings,deployment]=await Promise.all([
      cloudflare.request({method:'GET',path}),
      cloudflare.request({method:'GET',path:path+'/settings'}),
      cloudflare.request({method:'GET',path:path+'/deployments'}),
    ]);
    const expected=input.baseline[kind];
    const active=deployment.result.deployments[0].versions;
    if(active.length!==1||active[0].version_id!==expected.version||active[0].percentage!==100)throw Error('Production changed: '+worker);
    const boundary=script.split('\r\n')[0];
    const parts=script.split(boundary).flatMap(part=>{const split=part.indexOf('\r\n\r\n'),name=part.slice(0,split).match(/name="([^"]+)"/)?.[1];return name?[{name,body:part.slice(split+4).replace(/\r\n$/,'')}]:[];}).sort((a,b)=>a.name.localeCompare(b.name));
    if(parts.length!==expected.count||await digest(JSON.stringify(parts))!==expected.sha256)throw Error('Module integrity mismatch: '+worker);
    if(!parts.some(p=>p.name==='pedidos-main.mjs'))throw Error('Unexpected entry: '+worker);
    const glassNames=['glass-main.mjs','glass-core.mjs','glass-styles.mjs'];
    if(parts.some(p=>p.name.startsWith('glass-')&&!glassNames.includes(p.name)))throw Error('Unknown glass module: '+worker);
    const preserved=parts.filter(p=>!glassNames.includes(p.name));
    const additions=[
      {name:'glass-main.mjs',body:"import app from './pedidos-main.mjs';\nimport {withLiquidGlass} from './glass-core.mjs';\nimport css from './glass-styles.mjs';\nexport default withLiquidGlass(app,css);\n"},
      {name:'glass-core.mjs',body:input.entry},
      {name:'glass-styles.mjs',body:'export default '+JSON.stringify(input.css)+';\n'},
    ];
    const s=settings.result;
    const metadata={main_module:'glass-main.mjs',bindings:s.bindings.map(b=>({name:b.name,type:'inherit'})),keep_assets:true,compatibility_date:s.compatibility_date,compatibility_flags:s.compatibility_flags,observability:s.observability,usage_model:s.usage_model,logpush:s.logpush,tail_consumers:s.tail_consumers,tags:s.tags};
    if(s.limits)metadata.limits=s.limits;
    const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
    for(const p of [...preserved,...additions])form.append(p.name,new Blob([p.body],{type:'application/javascript+module'}),p.name);
    prepared.push({worker,path,form,expected,summary:{worker,preservedModules:preserved.length,extensionModules:3,bindings:s.bindings.length,cssSha256:await digest(input.css)}});
  }
  if(!activate)return {verified:true,packages:prepared.map(p=>p.summary)};
  const published=[];
  try {
    for(const p of prepared){const r=await cloudflare.request({method:'PUT',path:p.path,body:p.form});if(!r.success)throw Error(JSON.stringify(r.errors));published.push(p);}
  } catch(error) {
    const rollbacks=[];
    for(const p of published){const r=await cloudflare.request({method:'POST',path:p.path+'/deployments',body:{strategy:'percentage',versions:[{version_id:p.expected.version,percentage:100}]}});rollbacks.push({worker:p.worker,success:r.success});}
    return {success:false,error:String(error),rollbacks};
  }
  const versions=[];
  for(const p of prepared){const r=await cloudflare.request({method:'GET',path:p.path+'/deployments'});versions.push({worker:p.worker,deployment:r.result.deployments[0]});}
  return {success:true,packages:prepared.map(p=>p.summary),versions};
}
