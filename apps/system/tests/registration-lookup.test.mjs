import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { operationalFixture } from './operational-fixture.mjs';

const f = await operationalFixture(new URL('..', import.meta.url).pathname);
const route = await f.load('/app/api/registration-lookup/route.js');
let providerCalls, quotaCalls, reply, sequence = 0;
const nextCep = () => String(90000000 + ++sequence);
const nextCnpj = () => '19131243000' + String(++sequence).padStart(3, '0');
const lookup = (type, provider, value, headers) => route.POST(f.request('POST', '/api/registration-lookup', { type, provider, value }, headers));
function vendorPayload(url) {
  const parts = url.pathname.split('/').filter(Boolean), code = url.hostname === 'viacep.com.br' ? parts[1] : parts.at(-1);
  if (url.hostname === 'viacep.com.br') return { cep: code.slice(0,5) + '-' + code.slice(5), logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' };
  if (url.pathname.includes('/cep/')) return { cep: code, street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP', location: { ignored: true } };
  const common = { cnpj: code, cep: '01311-902', logradouro: 'Av. Paulista', numero: '100', bairro: 'Bela Vista', municipio: 'São Paulo', uf: 'SP', qsa: [{ ignored: 'Not exposed' }] };
  return url.hostname === 'receitaws.com.br' ? { ...common, status: 'OK', nome: 'Empresa de exemplo', fantasia: 'Exemplo', telefone: '(11) 3000-0000', email: 'public@example.test', situacao: 'ATIVA' } : { ...common, razao_social: 'Empresa de exemplo', nome_fantasia: 'Exemplo', ddd_telefone_1: '1130000000', email: 'public@example.test', descricao_situacao_cadastral: 'ATIVA' };
}
beforeEach(() => {
  f.reset(); providerCalls = []; quotaCalls = []; reply = url => Response.json(vendorPayload(url));
  const databaseFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (['brasilapi.com.br', 'viacep.com.br', 'receitaws.com.br'].includes(url.hostname)) {
      assert.equal(url.protocol, 'https:'); assert.equal(init.redirect, 'manual');
      assert.equal(new Headers(init.headers).get('authorization'), null); assert.equal(new Headers(init.headers).get('cookie'), null);
      providerCalls.push({ url, init }); return reply(url, init);
    }
    if (url.pathname === '/rest/v1/rpc/fama_consume_rate_limit' && JSON.parse(init.body).p_action === 'lookup_receitaws_public') {
      quotaCalls.push(JSON.parse(init.body)); return Response.json(quotaCalls.length <= 3);
    }
    return databaseFetch(input, init);
  };
});
after(f.close);

for (const [type, provider, path] of [['cep','brasilapi','/api/cep/v2/'],['cnpj','receitaws','/v1/cnpj/']]) test(`${provider} ${type}: authenticated lookup normalizes only public registration fields`, async () => {
  const value = type === 'cep' ? nextCep() : nextCnpj(), response = await lookup(type, provider, value);
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const data = await response.json(); assert.equal(data.value, value); assert.equal(data.provider, provider);
  assert.equal(data.city, 'São Paulo'); assert.match(data.address, /São Paulo\/SP/); assert.equal(data.cached, false);
  assert.equal(data.qsa, undefined); assert.equal(data.location, undefined); assert.equal(providerCalls.length, 1); assert.ok(providerCalls[0].url.pathname.startsWith(path));
  if (type === 'cnpj') { assert.equal(data.name, 'Empresa de exemplo'); assert.equal(data.email, 'public@example.test'); }
  assert.equal(f.businessWrites().length, 0, 'lookup must not create a customer');
});

test('anonymous, cross-site, foreign-company and revoked module requests cannot reach any provider', async () => {
  globalThis.__operationUser = null; assert.equal((await lookup('cep','brasilapi',nextCep())).status,401);
  globalThis.__operationUser = f.user; assert.equal((await lookup('cep','brasilapi',nextCep(),{Origin:'https://attacker.example.test'})).status,403);
  assert.equal((await lookup('cep','brasilapi',nextCep(),{'x-organization-id':'org-two'})).status,403);
  f.member().role = 'member'; f.member().permissions = []; assert.equal((await lookup('cep','brasilapi',nextCep())).status,403);
  f.member().role = 'owner'; f.rules.organization.overrides.customers = false; assert.equal((await lookup('cep','brasilapi',nextCep())).status,403);
  assert.equal(providerCalls.length,0);
});

test('invalid documents, provider combinations and user-supplied URLs are rejected locally', async () => {
  for (const body of [
    {type:'cep',provider:'receitaws',value:nextCep()}, {type:'cnpj',provider:'viacep',value:nextCnpj()}, {type:'cnpj',provider:'brasilapi',value:nextCnpj()},
    {type:'cep',provider:'https://attacker.example.test',value:nextCep()}, {type:'cep',provider:'viacep',value:'01001000?callback=x'},
    {type:'cnpj',provider:'brasilapi',value:'https://example.test/123'}, {type:'cep',provider:'viacep',value:'123'},
    {type:'cnpj',provider:'brasilapi',value:'12ABC34501DEXX'}, {type:'cep',provider:'viacep',value:nextCep(),url:'https://attacker.example.test'},
  ]) assert.equal((await route.POST(f.request('POST','/api/registration-lookup',body))).status,400);
  assert.equal(providerCalls.length,0);
});

test('provider not-found, wrong identity, oversized body and redirect return safe errors without saving', async () => {
  for (const [status, response] of [
    [404,()=>Response.json({erro:true})], [404,()=>new Response('',{status:404})],
    [502,()=>Response.json({cep:'00000000',localidade:'São Paulo',uf:'SP'})],
    [502,()=>new Response('x'.repeat(64001))], [502,()=>new Response('',{status:302,headers:{Location:'https://attacker.example.test'}})],
    [502,()=>Response.json({cep:nextCep(),localidade:'São Paulo',uf:'SP'})],
  ]) { reply=response; const result=await lookup('cep','brasilapi',nextCep()); assert.equal(result.status,status); assert.ok((await result.json()).error); }
  reply=()=>Response.json({status:'ERROR',message:'CNPJ inválido'}); assert.equal((await lookup('cnpj','receitaws',nextCnpj())).status,404);
  assert.equal(f.businessWrites().length,0);
});

test('simultaneous ReceitaWS lookups share one provider call and cache hits do not spend the public quota', async () => {
  let release, reached;
  const started = new Promise(resolve => reached=resolve);
  reply = url => new Promise(resolve => { release=()=>resolve(Response.json(vendorPayload(url))); reached(); });
  const value=nextCnpj(), one=lookup('cnpj','receitaws',value), two=lookup('cnpj','receitaws',value);
  await started; release();
  for(const response of await Promise.all([one,two])) assert.equal(response.status,200);
  const cached=await lookup('cnpj','receitaws',value); assert.equal(cached.status,200); assert.equal((await cached.json()).cached,true);
  assert.equal(providerCalls.length,1); assert.equal(quotaCalls.length,1);
});

test('the ReceitaWS limit is shared across callers and CEP lookup remains available after it is reached', async () => {
  for(let index=0;index<3;index++) assert.equal((await lookup('cnpj','receitaws',nextCnpj(),{'cf-connecting-ip':`192.0.2.${index+1}`})).status,200);
  const result=await lookup('cnpj','receitaws',nextCnpj(),{'cf-connecting-ip':'192.0.2.99'});
  assert.equal(result.status,429); assert.match((await result.json()).error,/Aguarde/); assert.equal(providerCalls.length,3);
  assert.equal(new Set(quotaCalls.map(call=>call.p_key_hash)).size,1); assert.ok(quotaCalls.every(call=>call.p_limit===3&&call.p_window_seconds===60));
  assert.equal((await lookup('cep','brasilapi',nextCep())).status,200);
});

test('permissions revoked while a provider is running prevent its result from being returned', async () => {
  let release, reached; const started=new Promise(resolve=>reached=resolve);
  reply=url=>new Promise(resolve=>{release=()=>resolve(Response.json(vendorPayload(url)));reached();});
  const value=nextCep(), operation=lookup('cep','brasilapi',value); await started;
  f.rules.organization.overrides.customers=false; release();
  const result=await operation; assert.equal(result.status,403); assert.equal((await result.json()).address,undefined);
  assert.equal((await lookup('cep','brasilapi',value)).status,403); assert.equal(providerCalls.length,1);
});

test('alphanumeric CNPJ is preserved by BrasilAPI and cannot consume a ReceitaWS request',async()=>{
  const value='12ABC34501DE35'; assert.equal((await lookup('cnpj','receitaws',value)).status,400);
  assert.equal(quotaCalls.length,0); assert.equal(providerCalls.length,0);
  const result=await lookup('cnpj','brasilapi','12.abc.345/01de-35'); assert.equal(result.status,200);
  assert.equal((await result.json()).value,value); assert.ok(providerCalls[0].url.pathname.endsWith(value));
});

test('requests without a provider use fixed services', async()=>{
  for(const type of ['cep','cnpj']) {
    const response=await route.POST(f.request('POST','/api/registration-lookup',{type,value:type==='cep'?nextCep():nextCnpj()}));
    assert.equal(response.status,200);assert.equal((await response.json()).provider,type==='cep'?'brasilapi':'receitaws');
  }
});
