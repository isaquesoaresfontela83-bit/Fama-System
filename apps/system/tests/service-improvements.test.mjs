import assert from "node:assert/strict";
import test,{beforeEach,after} from "node:test";
import {fileURLToPath} from "node:url";
import {operationalFixture} from "./operational-fixture.mjs";
const f=await operationalFixture(fileURLToPath(new URL("..",import.meta.url)));
const [profit,api,records,support,reply,crypto,ai,settings,tenant,policy]=await Promise.all([
 "/lib/service-profit.js","/app/api/service-profit/route.js","/app/api/records/[id]/route.js","/app/api/support/route.js","/app/api/support/reply/route.js","/lib/crypto.js","/lib/fama-ai.js","/lib/fama-ai-settings.js","/lib/tenant.js","/lib/plan-policy.js"
].map(f.load));
const order=()=>({id:"os-one",organization_id:"org-one",os_number:"OS-1",client_name:"Ana",service:"Manutenção",scheduled_at:"2026-10-12T10:00:00Z",technician:"Técnico",status:"aberta",ph:null,chlorine:null,alkalinity:null,products_used:"",notes:JSON.stringify({text:"Preservar histórico",details:{completionReport:"relatório anterior"}}),amount_cents:35000,updated_at:"2026-10-01T00:00:00Z"});
beforeEach(()=>{f.reset();f.tables.work_orders=[order()];});
after(()=>f.close());
test("profit distinguishes unknown costs from zero, loss and zero revenue",()=>{
 assert.equal(profit.costCents("1.234,56"),123456);
 for(const value of ["-10","1e3","1,234","Infinity",{},null])assert.equal(profit.costCents(value),null);
 assert.equal(profit.serviceProfit({amountCents:35000,notes:""}).profitCents,null);
 const notes=JSON.stringify({details:{productCost:"100,00",laborCost:"200,00",travelCost:"60,00"}});
 assert.equal(profit.serviceProfit({amountCents:35000,notes}).profitCents,-1000);
 assert.equal(profit.serviceProfit({amountCents:0,notes}).marginPercent,null);
 assert.equal(profit.serviceProfit({amountCents:500,notes:JSON.stringify({details:{productCost:"0",laborCost:0,travelCost:"0"}})}).profitCents,500);
});
test("cost edit persists cents while preserving encrypted service history",async()=>{
 const response=await api.PATCH(f.request("PATCH","/api/service-profit",{id:"os-one",productCost:"100,00",laborCost:"50",travelCost:"25"}));
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(profit.serviceProfit(body.record).profitCents,17500);
 assert.equal(profit.serviceNotes(body.record.notes).text,"Preservar histórico");
 assert.equal(profit.serviceNotes(body.record.notes).details.completionReport,"relatório anterior");
 assert.equal(f.tables.work_orders[0].product_cost_cents,10000);
 assert.notEqual(f.tables.work_orders[0].notes,body.record.notes);
});
test("financial restriction and tenant isolation prevent unauthorized cost updates",async()=>{
 f.tables.organizations[0].plan="inicial";
 assert.equal((await api.PATCH(f.request("PATCH","/api/service-profit",{id:"os-one",productCost:"1",laborCost:"0",travelCost:"0"}))).status,403);
 assert.equal(f.businessWrites().length,0);
 f.reset();f.tables.work_orders=[{...order(),organization_id:"other"}];
 assert.equal((await api.PATCH(f.request("PATCH","/api/service-profit",{id:"os-one",productCost:"1",laborCost:"0",travelCost:"0"}))).status,404);
});
test("a concurrent service change cannot be overwritten by cost editing",async()=>{
 f.beforeRequest=call=>{if(call.method==="PATCH"&&call.url.pathname==="/rest/v1/work_orders")f.tables.work_orders[0].updated_at="2026-10-02T00:00:00Z";};
 assert.equal((await api.PATCH(f.request("PATCH","/api/service-profit",{id:"os-one",productCost:"1",laborCost:"0",travelCost:"0"}))).status,409);
 assert.equal(f.tables.work_orders[0].product_cost_cents,undefined);
});
const signature="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlAAAAABJRU5ErkJggg==";
test("technical completion stores readings, products, costs and customer signature together",async()=>{
 const response=await records.PATCH(f.request("PATCH","/api/records/os-one",{entity:"workOrders",action:"complete",completionReport:{summary:"Atendimento executado",customerName:"Ana",confirmed:true,signature,ph:"7.2",chlorine:"2",alkalinity:"100",productsUsed:"Cloro 200 g",productCost:"10",laborCost:"20",travelCost:"0",checklist:{medir_ph:true,medir_cloro:true}}}),f.context("os-one"));
 assert.equal(response.status,200);const {record}=await response.json();
 assert.equal(record.status,"concluida");assert.equal(record.ph,7.2);assert.equal(record.productsUsed,"Cloro 200 g");
 assert.equal(JSON.parse(profit.serviceNotes(record.notes).details.completionReport).signature,signature);
 assert.equal(profit.serviceProfit(record).profitCents,32000);
});
test("technical completion rejects unsafe signatures and invalid readings",async()=>{
 for(const changes of [{signature:"data:image/svg+xml,<svg/>"},{ph:20},{chlorine:-1}]) {
  const result=await records.PATCH(f.request("PATCH","/api/records/os-one",{entity:"workOrders",action:"complete",completionReport:{summary:"Atendimento executado",customerName:"Ana",confirmed:true,...changes}}),f.context("os-one"));
  assert.equal(result.status,400);
 }
 assert.equal(f.businessWrites().length,0);
});
test("support excludes internal notes and messages belonging to another company",async()=>{
 f.tables.support_tickets=[{id:"ticket",organization_id:"org-one",title:"Ajuda",message:"Preciso de ajuda",status:"aberto",admin_notes:"PRIVATE",created_at:"2026-10-01"}];
 f.tables.support_messages=[{id:"a",ticket_id:"ticket",organization_id:"org-one",internal:true,body:"INTERNAL"},{id:"b",ticket_id:"ticket",organization_id:"org-one",internal:false,body:"Resposta pública"},{id:"c",ticket_id:"other",organization_id:"other",internal:false,body:"OTHER"}];
 const response=await support.GET(f.request("GET","/api/support"));assert.equal(response.status,200);const text=await response.text();
 assert.match(text,/Resposta pública/);assert.doesNotMatch(text,/PRIVATE|INTERNAL|OTHER|adminNotes/);
});
test("customer replies are scoped to the company and reopen a resolved ticket",async()=>{
 f.tables.support_tickets=[{id:"ticket",organization_id:"org-one",status:"resolvido"}];
 assert.equal((await reply.POST(f.request("POST","/api/support/reply",{id:"ticket",message:"Ainda preciso de ajuda",internal:true,authorKind:"admin"}))).status,201);
 assert.equal(f.tables.support_tickets[0].status,"aberto");assert.equal(f.tables.support_messages[0].author_kind,"customer");assert.equal(f.tables.support_messages[0].internal,false);
 assert.equal((await reply.POST(f.request("POST","/api/support/reply",{id:"foreign",message:"teste"}))).status,404);
});
test("shared plan policy disables modules even for the owner",async()=>{
 const state=policy.defaultPlanPolicy();state.current.find(plan=>plan.id==="profissional").featureIds=state.current.find(plan=>plan.id==="profissional").featureIds.filter(id=>id!=="assistant");
 f.tables.platform_settings=[{key:policy.planPolicyKey,value:state}];
 assert.equal((await tenant.requireTenant(f.request("GET","/api/access"))).organization.moduleAccess.includes("assistant"),false);
});
test("AI profit and follow-up analysis uses authorized records without creating data",()=>{
 const notes=JSON.stringify({details:{productCost:"10",laborCost:"20",travelCost:"0"}});
 const data={workOrders:[{id:"o",osNumber:"OS-1",clientName:"Ana",service:"Manutenção",amountCents:10000,notes}],transactions:[],quotes:[{id:"q",quoteNumber:"ORC-1",clientName:"Ana",service:"Piscina",status:"enviado",totalCents:10000,createdAt:"2026-10-01",validUntil:"2026-11-01"}]};
 const answer=ai.answerInternal("Qual o lucro por serviço?",data,"overview",new Date("2026-10-12T10:00:00Z"));
 assert.match(answer.text,/70,00/);assert.equal(answer.source,"finance");
 const restricted=ai.answerInternal("Lucro por serviço",data,"overview",new Date(),settings.restrictAssistantSettings(settings.defaultAssistantSettings,["overview","orders"]));assert.doesNotMatch(restricted.text,/70,00/);
 const followup=ai.answerInternal("Orçamentos sem retorno",data,"overview",new Date("2026-10-12T10:00:00Z"));assert.equal(followup.totalItems,1);assert.equal(followup.actions[0].record.id,"q");assert.equal(f.businessWrites().length,0);
});
