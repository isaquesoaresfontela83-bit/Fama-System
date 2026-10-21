import test from "node:test";
import assert from "node:assert/strict";
import { forwardPoolWebhook } from "../lib/pool-provider-webhook.js";
const config={webhookToken:"dedicated-webhook-secret-at-least-32-characters",siteServiceToken:"site-service-test-token"};
const request=(reference="pool:test",token=config.webhookToken)=>new Request("https://famasystem.online/api/pool-provider/webhook",{method:"POST",headers:{"asaas-access-token":token},body:JSON.stringify({id:"evt_test",event:"PAYMENT_RECEIVED",payment:{externalReference:reference}})});
test("private Pool ingress preserves both authorization boundaries and a fixed destination",async()=>{
 let calls=0;
 const send=async(url,options)=>{calls++;assert.equal(url,"https://fama-pool-servicos.isaquesoaresfontela8.chatgpt.site/api/asaas/webhook");assert.equal(options.redirect,"manual");const headers=new Headers(options.headers);assert.equal(headers.get("asaas-access-token"),config.webhookToken);assert.equal(headers.get("OAI-Sites-Authorization"),"Bearer "+config.siteServiceToken);assert.equal(headers.get("oai-authenticated-user-id"),null);return Response.json({received:true})};
 assert.equal((await forwardPoolWebhook(request(),config,send)).status,200);assert.equal(calls,1);
 assert.equal((await forwardPoolWebhook(request("erp:invoice"),config,send)).status,200);assert.equal(calls,1);
 assert.equal((await forwardPoolWebhook(request("pool:test","invalid"),config,send)).status,401);assert.equal(calls,1);
});
test("a failed private delivery remains an error so Asaas retries",async()=>{
 assert.equal((await forwardPoolWebhook(request(),config,async()=>new Response("unavailable",{status:503}))).status,503);
 assert.equal((await forwardPoolWebhook(request(),config,async()=>{throw new Error("timeout")})).status,503);
});
