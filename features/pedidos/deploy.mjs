/** Executed only through the authenticated Cloudflare connector. No tokens on disk. */
export async function deployOrders(cloudflare,accountId,input,activate=false){
  const encoder=new TextEncoder();
  const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const prepared=[];
  for(const kind of ['system','control']){
    const worker=`fama-${kind}-app`,path=`/accounts/${accountId}/workers/scripts/${worker}`;
    const [script,settings,deployment]=await Promise.all([
      cloudflare.request({method:'GET',path}),cloudflare.request({method:'GET',path:path+'/settings'}),cloudflare.request({method:'GET',path:path+'/deployments',query:{per_page:1}}),
    ]);
    if(!script.success||!settings.success||!deployment.success)throw new Error(`Cannot read ${worker}`);
    const expectedVersion=input.baseline[kind+'VersionId'];
    const active=deployment.result.deployments[0]?.versions;
    if(active?.length!==1||active[0].version_id!==expectedVersion||active[0].percentage!==100)throw new Error(`Production changed for ${worker}; rebase before publishing.`);
    const boundary=script.result.split('\r\n')[0];
    const parts=script.result.split(boundary).flatMap(part=>{const split=part.indexOf('\r\n\r\n'),name=part.slice(0,split).match(/name="([^"]+)"/)?.[1];return name?[{name,body:part.slice(split+4).replace(/\r\n$/,'')}]:[];});
    const expected=input.baseline.workers[worker].parts;
    if(parts.length!==expected.length)throw new Error(`Module count changed for ${worker}`);
    for(const part of parts){
      const prior=expected.find(item=>item.name===part.name);
      if(!prior||prior.size!==encoder.encode(part.body).length||prior.sha256!==await digest(part.body))throw new Error(`Module changed: ${worker}/${part.name}`);
    }
    const additions=[{name:'pedidos-main.mjs',body:input.modules[kind+'-main.mjs']},{name:'pedidos-core.mjs',body:input.modules['pedidos-core.mjs']},{name:'pedidos-resources.mjs',body:input.modules['pedidos-resources.mjs']}];
    for(const part of additions)if(!part.body||parts.some(item=>item.name===part.name))throw new Error('Missing or conflicting extension module');
    const inherited=settings.result.bindings.map(binding=>({name:binding.name,type:'inherit'}));
    if(!inherited.some(b=>b.name==='DB')||!inherited.some(b=>b.name==='ASSETS'))throw new Error('Existing bindings missing');
    const metadata={main_module:'pedidos-main.mjs',bindings:inherited,keep_assets:true,compatibility_date:settings.result.compatibility_date,compatibility_flags:settings.result.compatibility_flags,observability:settings.result.observability,usage_model:settings.result.usage_model};
    const uploadBoundary='fama-pedidos-'+crypto.randomUUID();
    const fields=[{name:'metadata',body:JSON.stringify(metadata),type:'application/json'},...parts.map(part=>({...part,type:'application/javascript+module'})),...additions.map(part=>({...part,type:'application/javascript+module'}))];
    const upload=fields.map(part=>`--${uploadBoundary}\r\nContent-Disposition: form-data; name="${part.name}"; filename="${part.name}"\r\nContent-Type: ${part.type}\r\n\r\n${part.body}\r\n`).join('')+`--${uploadBoundary}--\r\n`;
    prepared.push({kind,worker,path,uploadBoundary,upload,expectedVersion,summary:{worker,preservedModules:parts.length,addedModules:additions.length,bindings:inherited.length,uploadBytes:encoder.encode(upload).length,extensionSha256:await digest(input.modules['pedidos-core.mjs'])}});
  }
  if(!activate)return {verified:true,packages:prepared.map(item=>item.summary)};
  const published=[];
  try{
    for(const item of prepared){
      const response=await cloudflare.request({method:'PUT',path:item.path,body:item.upload,contentType:`multipart/form-data; boundary=${item.uploadBoundary}`,rawBody:true});
      if(!response.success)throw new Error(`Upload failed for ${item.worker}: ${JSON.stringify(response.errors)}`);
      published.push(item);
    }
  }catch(error){
    const rollbacks=[];
    for(const item of published){const rollback=await cloudflare.request({method:'POST',path:item.path+'/deployments',body:{strategy:'percentage',versions:[{version_id:item.expectedVersion,percentage:100}]}});rollbacks.push({worker:item.worker,success:rollback.success,errors:rollback.errors});}
    return {success:false,error:String(error.message),rollbacks};
  }
  const versions=[];
  for(const item of prepared){const result=await cloudflare.request({method:'GET',path:item.path+'/deployments',query:{per_page:1}});versions.push({worker:item.worker,success:result.success,deployment:result.result?.deployments?.[0]});}
  return {success:true,packages:prepared.map(item=>item.summary),versions};
}
