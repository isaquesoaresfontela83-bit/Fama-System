import assert from 'node:assert/strict';
import test,{after,beforeEach} from 'node:test';
import {operationalFixture} from './operational-fixture.mjs';
const root=new URL('..',import.meta.url).pathname,f=await operationalFixture(root),config=await f.load('/lib/baileys-config.js'),internal=await f.load('/app/api/internal/baileys/route.js');
let saved,providerCalls;
beforeEach(()=>{
    f.reset();saved=null;providerCalls=[];f.runtime.FAMA_DATA_BRIDGE_SECRET='internal-fixture';
    f.runtime.DB={prepare:()=>({bind(...args){return {first:async()=>saved?{value:saved}:null,run:async()=>{saved=args[1];return {success:true};}};}})};
    globalThis.fetch=async(url,init)=>{providerCalls.push({url,init});return Response.json({provider:'baileys',ok:true});};
});
after(async()=>await f.close());
test('service URL rejects private targets, credentials, paths and redirects',async()=>{
    for(const url of ['http://public.server.com','https://127.0.0.1','https://[::1]','https://localhost','https://machine.local','https://user:pass@public.server.com','https://public.server.com/path','https://public.server.com:3010'])assert.throws(()=>config.serviceOrigin(url));
    globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://another.server.com'}});
    await assert.rejects(config.saveBaileysConfig('https://public.server.com','k'.repeat(64)));assert.equal(saved,null);
});
test('configuration is encrypted and saved only after a compatible health response',async()=>{
    const token='private-fixture-token-'.repeat(3);await config.saveBaileysConfig('https://public.server.com',token);
    assert.ok(saved.startsWith('fama:v1:'));assert.ok(!saved.includes(token));assert.deepEqual(await config.readBaileysConfig(),{url:'https://public.server.com',token});
    assert.equal(providerCalls[0].url,'https://public.server.com/health');assert.equal(providerCalls[0].init.redirect,'manual');
});
test('internal bridge rejects unauthorized and arbitrary operations before calling the provider',async()=>{
    const body={organizationId:'11111111-1111-4111-8111-111111111111',action:'connect'};
    const request=(value,token='wrong')=>new Request('https://control.example.test/api/internal/baileys',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(value)});
    assert.equal((await internal.POST(request(body))).status,401);assert.equal(providerCalls.length,0);
    assert.equal((await internal.POST(request({...body,action:'https://evil.test'},'internal-fixture'))).status,400);assert.equal(providerCalls.length,0);
    assert.equal((await internal.POST(request({...body,action:'configured'},'internal-fixture'))).status,200);assert.equal(providerCalls.length,0);
});
