import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'vite';
const originalFetch=globalThis.fetch;
const sqlite=new DatabaseSync(':memory:');
const runtime={DATA_BACKEND:'d1',FAMA_ASAAS_API_KEY:'$aact_hmlg_'+'a'.repeat(40),FAMA_ASAAS_ENVIRONMENT:'sandbox'};
globalThis.__saleRuntime=runtime;
const root=new URL('..',import.meta.url).pathname;
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{hmr:false,middlewareMode:true,ws:false},plugins:[{
 name:'sales-fixtures',enforce:'pre',resolveId(id){if(id==='cloudflare:workers')return '\0sales-env';if(id.endsWith('/app/system-auth')||id.endsWith('/app/system-auth.js'))return '\0sales-auth';},
 load(id){if(id==='\0sales-env')return 'export const env=globalThis.__saleRuntime;';if(id==='\0sales-auth')return 'export async function getFamaUser(){return globalThis.__saleUser;}';}
}]});
runtime.DB={prepare(sql){const stmt=sqlite.prepare(sql);let values=[];const p={bind(...next){values=next;return p;},async first(){return stmt.get(...values)??null;},async all(){return {results:stmt.all(...values)};},async run(){return {meta:{changes:Number(stmt.run(...values).changes)}};}};return p;}};
const checkout=await vite.ssrLoadModule('/lib/subscription-checkout.js');
const billing=await vite.ssrLoadModule('/lib/billing.js');
const route=await vite.ssrLoadModule('/app/api/public/checkout/route.js');
const intent=await vite.ssrLoadModule('/lib/onboarding-intent.js');
const {MANUAL_PIX}=await vite.ssrLoadModule('/lib/manual-pix.js');
await checkout.ensureSubscriptionCheckoutTable();
const id='10000000-0000-4000-8000-000000000001';
let row,payment,calls;
beforeEach(()=>{
 sqlite.exec('DELETE FROM subscription_checkouts');calls=[];
 row={id,plan:'profissional',billing_cycle:'annual',installments:1,provider:'asaas',buyer_name:'Pessoa',buyer_email:'sale@example.invalid',payment_id:'pay_sale',customer_id:'cus_sale',status:'paid',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 const keys=Object.keys(row);sqlite.prepare(`INSERT INTO subscription_checkouts (${keys}) VALUES (${keys.map(()=>'?')})`).run(...Object.values(row));
 payment={id:'pay_sale',customer:'cus_sale',externalReference:`checkout:${id}:profissional:annual:1`,status:'CONFIRMED'};
 globalThis.fetch=async(input,init={})=>{calls.push({url:String(input),init});if(String(input).endsWith('/api/public/plans'))return Response.json({plans:[]});assert.equal(String(input),'https://api-sandbox.asaas.com/v3/payments/pay_sale');return Response.json(payment);};
});
after(async()=>{globalThis.fetch=originalFetch;await vite.close();sqlite.close();delete globalThis.__saleRuntime;delete globalThis.__saleUser;});
for (const buyerDocument of ['', '123', '111.111.111-11', '24971563793', '00000000000000', '<24971563792>']) test('billing refuses an invalid or missing payer document before contacting the provider: '+buyerDocument,async()=>{
 await assert.rejects(()=>billing.createAsaasPixCheckout({organizationId:'org',organizationName:'Empresa',plan:'inicial',buyerName:'Pessoa',buyerEmail:'sale@example.invalid',buyerDocument}),error=>error.status===400&&/CPF ou CNPJ/.test(error.message));
 assert.equal(calls.length,0);
});
test('billing preserves alphanumeric CNPJ when creating the payer',async()=>{
 let customer;
 globalThis.fetch=async(input,init={})=>{
  const url=String(input);if(url.endsWith('/api/public/plans'))return Response.json({plans:[]});
  if(url.endsWith('/customers')){customer=JSON.parse(init.body);return Response.json({id:'cus_sale'});}
  if(url.endsWith('/payments'))return Response.json({id:'pay_sale'});
  if(url.endsWith('/pixQrCode'))return Response.json({payload:'fixture'});
  throw new Error('Unexpected request '+url);
 };
 await billing.createAsaasPixCheckout({organizationId:'org',organizationName:'Empresa',plan:'inicial',buyerName:'Pessoa',buyerEmail:'sale@example.invalid',buyerDocument:'12.ABC.345/01DE-35'});
 assert.equal(customer.cpfCnpj,'12ABC34501DE35');
});
test('an already-paid checkout is rechecked and a refund removes its activation link',async()=>{
 payment.status='REFUNDED';const response=await route.GET(new Request(`https://fama.example/api/public/checkout?id=${id}`));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.checkout.status,'payment_attention');assert.equal(data.checkout.signupUrl,'');assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal(sqlite.prepare('SELECT status FROM subscription_checkouts WHERE id=?').get(id).status,'payment_attention');
});
for(const changed of [{id:'pay_other'},{customer:'cus_other'},{externalReference:`checkout:${id}:inicial:annual:1`}])test('checkout rejects mismatched provider identity '+Object.keys(changed),async()=>{
 Object.assign(payment,changed);const response=await route.GET(new Request(`https://fama.example/api/public/checkout?id=${id}`));assert.equal(response.status,409);
});
test('a deleted payment never activates a company even when its old status is confirmed',async()=>{payment.deleted=true;assert.equal((await checkout.refreshSubscriptionCheckout(row)).status,'payment_attention');});
test('manual approval is preserved and Asaas refuses a manual proof',async()=>{
 const response=await route.PATCH(new Request('https://fama.example/api/public/checkout',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,proofText:'unverified proof'})}));assert.equal(response.status,400);assert.equal(calls.length,0);
 row.provider='manual_pix';assert.equal((await checkout.refreshSubscriptionCheckout(row)).status,'paid');assert.equal(calls.length,0);
});
test('the paid plan and checkout survive sign-in redirects without accepting external destinations',()=>{
 assert.equal(intent.onboardingPath({plan:'profissional',checkout:id,return_to:'https://evil.example'}),`/?plan=profissional&checkout=${id}`);
 assert.equal(intent.onboardingPath({plan:'unknown',checkout:'https://evil.example'}),'/');
 assert.deepEqual(intent.onboardingIntent({plan:['profissional'],checkout:['bad']}),{plan:'inicial',checkout:''});
});
test('the manual Pix copy-and-paste matches the actual QR code and has a valid EMV checksum',()=>{
 const payload=MANUAL_PIX.copyPaste;assert.match(payload,/^000201.*6304[0-9A-F]{4}$/);
 let crc=0xffff;for(const byte of new TextEncoder().encode(payload.slice(0,-4))){crc^=byte<<8;for(let i=0;i<8;i++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}
 assert.equal(crc.toString(16).toUpperCase().padStart(4,'0'),payload.slice(-4));
 let position=0;while(position<payload.length){const length=Number(payload.slice(position+2,position+4));assert.ok(Number.isInteger(length));position+=4+length;}assert.equal(position,payload.length);
});
