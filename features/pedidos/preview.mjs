// Local QA only. No production services, real accounts or real customer data.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fixture } from './test-support.mjs';
import { handleOrders } from './api.mjs';
const f=await fixture();let order=await f.create();
f.env.FAMA_SYSTEM={fetch:request=>handleOrders(f.app,request,f.env,{},'system')};
order=(await f.action(order,{action:'confirm'})).data.order;
const assets={
 '/assets/fama-pedidos-15.21.0.mjs':['client.mjs','application/javascript'],
 '/assets/fama-pedidos-model-15.21.0.mjs':['model.mjs','application/javascript'],
 '/assets/fama-pedidos-15.21.0.css':['styles.css','text/css'],
};
const server=createServer(async(req,res)=>{
 try{
  const base=req.headers.origin||`http://${req.headers.host}`;const url=new URL(req.url,base);
  if(url.pathname==='/mobile'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><head><title>Pedidos — 390 px</title></head><body style="margin:0;background:#e8edf4;padding:18px;display:flex;justify-content:center"><iframe title="Pedidos no celular" src="/?pedidos=1" style="width:390px;height:844px;border:1px solid #bbc7d8;border-radius:16px;background:white"></iframe></body></html>');return;
  }
  if(assets[url.pathname]){const [name,type]=assets[url.pathname];res.writeHead(200,{'Content-Type':type});res.end(await readFile(new URL(name,import.meta.url)));return;}
  if(url.pathname.startsWith('/api/')){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const input=new Request(url,{method:req.method,headers:{...req.headers,cookie:url.pathname==='/api/pedidos-admin'?'admin':'owner',origin:base},body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const response=await handleOrders(f.app,input,f.env,{},url.pathname==='/api/pedidos-admin'?'control':'system');
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const control=url.searchParams.has('control');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pedidos · conferência local</title><link rel="stylesheet" href="/assets/fama-pedidos-15.21.0.css"><style>*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f5f7fb;color:#162540}.qa-shell{display:flex;min-height:100vh}.qa-sidebar{width:220px;flex-shrink:0;background:white;border-right:1px solid #e1e8f2;padding:24px 15px}.qa-sidebar h2{font-size:20px;margin:4px 10px 30px}.qa-sidebar small{display:block;color:#75839a;margin:0 10px 14px}.qa-sidebar ul{padding:0;list-style:none}.qa-sidebar a,.qa-sidebar button{font:inherit;text-decoration:none;display:flex;align-items:center;gap:10px;padding:12px;color:#465b76;border:0;background:white;width:100%;border-radius:8px;margin-bottom:8px;cursor:pointer}.qa-main{flex:1;min-width:0}.qa-top{height:75px;border-bottom:1px solid #e1e8f2;display:flex;align-items:center;justify-content:space-between;background:white;padding:20px 30px}.qa-top select{padding:9px;border:1px solid #e1e8f2;border-radius:8px}main{padding:28px}.control-nav{display:grid}@media(max-width:800px){.qa-sidebar{width:150px;padding:18px 7px}.qa-sidebar h2{font-size:17px}.qa-sidebar a,.qa-sidebar button{padding:11px 7px}.qa-top{padding:12px 15px}main{padding:16px}}@media(max-width:500px){.qa-shell{display:block}.qa-sidebar{width:100%;padding:10px 14px;border:0}.qa-sidebar h2{margin:0 0 9px}.qa-sidebar small{display:none}.qa-sidebar ul,.qa-sidebar nav{display:flex;margin:0;gap:8px;overflow:auto}.qa-sidebar li{min-width:100px}.qa-sidebar a,.qa-sidebar button{white-space:nowrap;width:auto;margin:0}.qa-top{height:58px}}</style></head><body><div class="qa-shell"><aside class="qa-sidebar"><h2>Fama ${control?'Control':'System'}</h2><small>AMBIENTE DE CONFERÊNCIA</small>${control?'<nav class="control-nav"><a href="#companies">Empresas</a><a href="#blocks">Blocos Fama System</a></nav>':'<div class="workspace-navigation-content"><ul><li><button>Visão geral</button></li><li><button>Orçamentos</button></li><li><button>Agenda</button></li></ul></div>'}</aside><div class="qa-main"><header class="qa-top"><span>Gestão para piscinas</span><select class="company-switcher" aria-label="Empresa ativa"><option value="org-a">Empresa A</option><option value="org-b">Empresa B</option></select></header><main class="${control?'control-main':'workspace'}"><h1>Conferência do módulo Pedidos</h1><p>Use a aba Pedidos no menu.</p></main></div></div><script type="module" src="/assets/fama-pedidos-15.21.0.mjs?app=${control?'control':'system'}"></script></body></html>`);
 }catch(error){res.writeHead(500,{'Content-Type':'text/plain'});res.end(error.message);}
});
const portIndex=process.argv.indexOf('--port');
server.listen(Number(portIndex>=0?process.argv[portIndex+1]:process.env.PORT)||5173,'0.0.0.0',()=>console.log('Pedidos QA: servidor pronto'));
