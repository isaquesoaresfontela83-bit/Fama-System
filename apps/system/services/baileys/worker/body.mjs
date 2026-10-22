const fail=(message,status=400)=>Object.assign(new Error(message),{status});
async function readBody(request,{allowEmpty=false}={}){
    if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || ''))throw fail('Envie JSON.',415);
    const reader=request.body?.getReader();if(!reader){if(allowEmpty)return {};throw fail('Envie uma solicitação válida.');}
    const chunks=[];let size=0;
    try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>24000)throw fail('Solicitação muito grande.',413);chunks.push(item.value);}}
    finally{await reader.cancel().catch(()=>{});}
    if(allowEmpty && size===0)return {};
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value || typeof value!=='object' || Array.isArray(value))throw new Error();return value;}catch{throw fail('JSON inválido.');}
}
export async function companyRequestBody(request,action){
 const body=request.method==='POST' && ['session','messages'].includes(action)?await readBody(request,{allowEmpty:action==='session'}):{};
 const keys=action==='session'?['reconnect']:['phone','text','clientId'];
 if(Object.keys(body).some(key=>!keys.includes(key))||(action==='session'&&body.reconnect!==undefined&&typeof body.reconnect!=='boolean'))throw fail('Solicitação inválida.');
 return body;
}
