// Isolated QA fixture. Every account and record here is fictitious; no provider credentials are used.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fixture} from '../pedidos/test-support.mjs';
import {handleOrders} from '../pedidos/api.mjs';
import {VERSION} from '../pedidos/model.mjs';
import {DOCK_CATALOG} from '../liquid-glass/dock-preferences.mjs';
import {input as glass} from '../liquid-glass/build-input.mjs';
import resources from '../pedidos/dist/pedidos-resources.mjs';
const f=await fixture();
f.env.FAMA_SYSTEM={fetch:r=>handleOrders(f.app,r,f.env,{},'system')};
await f.create();
const sections=DOCK_CATALOG.filter(item=>!item.native&&item.id!=='pedidos');
const css=await readFile(new URL('../liquid-glass/styles.css',import.meta.url),'utf8');
const nav=sections.map(item=>`<button class="workspace-nav-link" aria-label="${item.source}" data-section="${item.section}">${item.source}</button>`).join('');
const shell=control=>`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fama — homologação isolada</title><link rel="stylesheet" href="/assets/fama-pedidos-${VERSION}.css"><link rel="stylesheet" data-fama-glass-style href="/qa-glass.css"><style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;color:#193454;background:#f3f7fc}button,input,select{font:inherit}button{cursor:pointer}header.qa-header{padding:14px 24px;background:white;border-bottom:1px solid #d7e4f4;display:flex;justify-content:space-between;gap:12px;align-items:center}.qa-header small{display:block;color:#64748b}.qa-layout{display:flex;min-height:calc(100vh - 70px)}.workspace-navigation,.control-nav{padding:12px;width:210px;flex:none;display:flex;flex-direction:column;gap:4px;background:white}.workspace-nav-link,.control-nav a{padding:9px 12px;color:#234f83;text-align:left;background:transparent;border:0;border-radius:9px;text-decoration:none}.workspace{min-width:0;flex:1;padding:22px}.control-main{min-width:0;flex:1;padding:22px}select.company-switcher{padding:8px;border:1px solid #b9cbe1;border-radius:8px}.workspace-mobile-dock{position:fixed;display:flex;align-items:center;gap:5px;bottom:12px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 20px);overflow-x:auto;padding:7px;border-radius:22px;z-index:40}.workspace-mobile-dock>button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:58px;flex-shrink:0;padding:8px 10px;border:0;border-radius:16px;color:#1d4e86;background:transparent}.workspace-mobile-dock svg{width:21px;height:21px}.workspace-mobile-dock small,.workspace-mobile-dock span{font-size:11px}main{padding-bottom:110px!important}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #1a75eb;outline-offset:3px}.workspace-nav-link:hover{background:#e9f2ff}
@media(max-width:700px){.workspace-navigation{display:none}.qa-layout{display:block}.workspace,.control-main{padding:12px}.qa-header{padding:10px!important}.qa-header strong{font-size:15px}.control-nav{width:auto;flex-direction:row}.fo-heading{gap:12px}.fo-heading h1{font-size:24px}}
</style></head><body><div class="application" data-workspace-section="dashboard"><header class="qa-header"><div><strong>Fama ${control?'Control':'System'}</strong><small>Homologação · dados fictícios</small></div><select class="company-switcher" aria-label="Empresa ativa"><option value="org-a">Empresa A</option><option value="org-b">Empresa B</option></select></header><div class="qa-layout">${control?'<nav class="control-nav"><a href="#companies">Empresas</a><a href="#blocks">Blocos Fama System</a></nav>':`<nav class="workspace-navigation"><div class="workspace-navigation-content">${nav}</div></nav>`}<main class="${control?'control-main':'workspace'}"><h1>Área de homologação</h1><p>Os testes usam registros fictícios e isolados.</p></main></div>${control?'':`<nav class="workspace-mobile-dock" aria-label="Atalhos"><button>Início</button><button>Agenda</button><button class="mobile-dock-new">Novo</button><button>Clientes</button><button>Mais</button></nav>`}</div><script type="module" src="/qa-shell.mjs"></script><script type="module" src="/assets/fama-pedidos-${VERSION}.mjs?app=${control?'control':'system'}"></script><script type="module" src="/assets/fama-dock-client-15.24.0.mjs"></script></body></html>`;
const shellClient=`document.addEventListener('click',event=>{const target=event.target.closest('[data-section]');if(target){document.querySelector('.application').setAttribute('data-workspace-section',target.dataset.section);document.querySelector('main').innerHTML='<h1>Área '+target.textContent+'</h1>';}if(event.target.closest('.workspace-mobile-dock button')?.textContent.trim()==='Mais'){const nav=document.querySelector('.workspace-navigation');nav.style.display=nav.style.display==='flex'?'':'flex';}});`;
const server=createServer(async(req,res)=>{
  try{
    const base=req.headers.origin||`http://${req.headers.host}`,url=new URL(req.url,base);
    let response;
    if(['/mobile','/tablet'].includes(url.pathname)){
      const width=url.pathname==='/mobile'?390:820,height=url.pathname==='/mobile'?844:1180;
      response=new Response(`<!doctype html><html lang="pt-BR"><head><title>Fama · ${width}px</title><style>body{margin:0;background:#e8eff8;font:14px system-ui;padding:14px}iframe{display:block;background:white;border:1px solid #bacce2;border-radius:14px;margin:auto}</style></head><body><p>Homologação isolada · ${width} × ${height} px · dados fictícios</p><iframe title="Fama em ${width} px" src="/?pedidos=1" width="${width}" height="${height}"></iframe></body></html>`,{headers:{'content-type':'text/html; charset=utf-8'}});
    }
    else if(Object.hasOwn(resources,url.pathname)){const asset=resources[url.pathname];response=new Response(asset.body,{headers:{'content-type':asset.type}});}
    else if(Object.hasOwn(glass.resources,url.pathname))response=new Response(glass.resources[url.pathname],{headers:{'content-type':'application/javascript'}});
    else if(url.pathname==='/qa-shell.mjs')response=new Response(shellClient,{headers:{'content-type':'application/javascript'}});
    else if(url.pathname==='/qa-glass.css')response=new Response(css,{headers:{'content-type':'text/css'}});
    else if(url.pathname.startsWith('/api/')){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1_500_000)throw new Error('QA payload too large');chunks.push(chunk);}
      const request=new Request(url,{method:req.method,headers:{...req.headers,cookie:url.pathname==='/api/pedidos-admin'?'admin':'owner',origin:base},body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
      response=await handleOrders(f.app,request,f.env,{},url.pathname==='/api/pedidos-admin'?'control':'system')||await f.app.fetch(request);
    }else response=new Response(shell(url.searchParams.has('control')),{headers:{'content-type':'text/html; charset=utf-8'}});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch(error){res.writeHead(500,{'content-type':'text/plain'});res.end(error.message);}
});
const index=process.argv.indexOf('--port');
server.listen(Number(index<0?process.env.PORT:process.argv[index+1])||5173,process.env.HOST||'0.0.0.0',()=>console.log('Isolated Fama QA ready'));
