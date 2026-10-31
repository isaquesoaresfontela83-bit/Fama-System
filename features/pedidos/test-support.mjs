import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleOrders } from './api.mjs';
import { ensureSchema } from './storage.mjs';
function database() {
  const raw=new DatabaseSync(':memory:');
  const prepare=(sql,values=[])=>({
    bind(...params){return prepare(sql,params);},
    async all(){return {results:raw.prepare(sql).all(...values)};},
    async first(){return raw.prepare(sql).get(...values)||null;},
    async run(){adapter.beforeRun?.(sql,values);const result=raw.prepare(sql).run(...values);return {meta:{changes:Number(result.changes)}};},
  });
  const adapter={raw,prepare,async batch(statements){raw.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());raw.exec('COMMIT');return results;}catch(error){raw.exec('ROLLBACK');throw error;}}};
  return adapter;
}
async function fixture(){
  const db=database();await ensureSchema(db);
  db.raw.exec(`CREATE TABLE transactions(id TEXT PRIMARY KEY,organization_id TEXT,description TEXT,type TEXT,category TEXT,amount_cents INTEGER,due_date TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE appointments(id TEXT PRIMARY KEY,organization_id TEXT,title TEXT,customer_id TEXT,client_name TEXT,start_at TEXT,address TEXT,technician TEXT,kind TEXT,status TEXT,notes TEXT,created_at TEXT,updated_at TEXT);`);
  const env={DB:db,FAMA_DATA_ENCRYPTION_KEY:'a'.repeat(64),FAMA_DATA_BRIDGE_SECRET:'fixture-bridge-secret',DATA_BACKEND:'d1'};
  const app={async fetch(request){
    const url=new URL(request.url);const cookie=request.headers.get('cookie');
    if(url.pathname==='/api/health')return Response.json({status:'ok',version:'15.20.0'});
    if(cookie==='denied'||!cookie)return Response.json({error:'Autenticação necessária'},{status:401});
    const org=request.headers.get('x-organization-id');
    if(url.pathname==='/api/auth/session')return Response.json({authenticated:true,consent:true,currentUser:{id:'user-a',displayName:'Equipe de teste'},email:'fixture@example.test',organizations:[{id:'org-a',name:'Empresa A'},{id:'org-b',name:'Empresa B'}]});
    if(url.pathname==='/api/access'){
      if(org==='forbidden')return Response.json({error:'Sem vínculo'},{status:403});
      return Response.json({access:{organizationId:org,role:cookie==='technician'?'technician':'owner',plan:'inicial',...(cookie==='expired'?{planStatus:'active',planExpiresAt:'2026-01-01T00:00:00Z'}:{}),moduleAccess:cookie==='no-quotes'?['finance','agenda']:cookie==='no-finance'?['quotes','customers','agenda']:['quotes','orders','finance','agenda','customers']}});
    }
    if(url.pathname==='/api/bootstrap')return Response.json({
      customers:[{id:'customer-a',name:'Cliente de teste',phone:'62999999999',address:'Rua de teste, 10'}],
      quotes:[{id:'quote-a',quoteNumber:'ORC-001',status:'aprovado',clientName:'Cliente de teste',customerId:'customer-a',totalCents:100000,service:'Piscina azul'}],
      employees:[{name:'Motorista de teste',phone:'62999999998',active:true}],
      transactions:db.raw.prepare('SELECT id,amount_cents AS amountCents,status FROM transactions WHERE organization_id=?').all(org),
    });
    if(url.pathname==='/api/admin/organizations')return cookie==='admin'?Response.json({organizations:[{id:'org-a',name:'Empresa A',plan:'inicial'}]}):Response.json({error:'Restrito'},{status:403});
    return Response.json({error:'Rota inexistente'},{status:404});
  }};
  async function request(path,method='GET',data,cookie='owner',org='org-a',origin='https://example.test'){
    const response=await handleOrders(app,new Request('https://example.test'+path,{method,headers:{cookie,'x-organization-id':org,origin,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env,{},'system');
    return {response,status:response.status,data:response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer()};
  }
  const input=(overrides={})=>({requestId:crypto.randomUUID(),clientName:'Cliente de teste',customerId:'customer-a',phone:'62999999999',address:'Rua de teste, 10',seller:'Vendedor A',items:[{name:'Piscina azul',dimensions:'6 × 3 m',color:'Azul',quantity:1,unitPriceCents:100001}],freightCents:1000,discountCents:1,depositCents:10000,installmentCount:3,firstDueDate:'2026-11-30',deliveryDate:'2026-12-10',...overrides});
  async function create(overrides={}){const result=await request('/api/pedidos','POST',input(overrides));assert.equal(result.status,201,JSON.stringify(result.data));return result.data.order;}
  async function action(order,values){return request(`/api/pedidos/${order.id}`,'PATCH',{revision:order.revision,...values});}
  return {db,env,app,request,input,create,action};
}

export { fixture };
