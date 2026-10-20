import assert from "node:assert/strict";
import test,{beforeEach,after} from "node:test";
import {fileURLToPath} from "node:url";
import {operationalFixture} from "./operational-fixture.mjs";
const f=await operationalFixture(fileURLToPath(new URL("..",import.meta.url)),"system-auth");
const [policy,plans,publicPlans,support,metrics,commercial,health,security]=await Promise.all(["/lib/plan-policy.js","/app/api/admin/plans/route.js","/app/api/public/plans/route.js","/app/api/admin/support/route.js","/lib/commercial-metrics.js","/app/api/admin/commercial/route.js","/app/api/admin/health/route.js","/app/api/admin/security/route.js"].map(f.load));
beforeEach(()=>{f.reset();f.runtime.PLATFORM_OWNER_EMAIL=f.user.email;});
after(()=>f.close());
test("plan validation rejects duplicate identifiers, invalid limits and Basic finance",()=>{
 const current=policy.defaultPlanPolicy().current;
 for(const change of [items=>items[1].id=items[0].id,items=>items[0].userLimit=0,items=>items[0].featureIds.push("finance")]){
  const invalid=structuredClone(current);change(invalid);assert.throws(()=>policy.normalizePolicyPlans(invalid));
 }
 assert.equal(policy.normalizePolicyPlans(current)[2].price,35000);
});
test("plan editor saves synchronized feature and capacity changes with a revision",async()=>{
 const current=policy.defaultPlanPolicy().current;current[1].userLimit=8;current[1].featureIds=current[1].featureIds.filter(id=>id!=="contracts");
 const response=await plans.PATCH(f.request("PATCH","/api/admin/plans",{plans:current,expectedRevision:0,notice:"Limite ampliado"}));
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.policy.revision,1);assert.equal(body.plans[1].users,"Até 8 usuários");
 assert.equal(body.plans[1].featureIds.includes("contracts"),false);assert.equal(f.tables.platform_settings[0].key,policy.planPolicyKey);
 assert.equal((await plans.PATCH(f.request("PATCH","/api/admin/plans",{plans:current,expectedRevision:0}))).status,409);
});
test("scheduled catalog changes keep current prices and expose their advance notice",async()=>{
 const state=policy.defaultPlanPolicy();f.tables.platform_settings=[{key:policy.planPolicyKey,value:state,updated_at:"2026-10-01T00:00:00Z"}];
 const changed=structuredClone(state.current);changed[0].price=12000;const effectiveAt=new Date(Date.now()+86400000).toISOString();
 const response=await plans.PATCH(f.request("PATCH","/api/admin/plans",{plans:changed,expectedRevision:0,effectiveAt,notice:"Novo valor a partir de amanhã"}));assert.equal(response.status,200);
 const payload=await (await publicPlans.GET()).json();assert.equal(payload.plans[0].price,9900);assert.match(payload.notice.text,/Novo valor/);
 assert.equal(policy.effectivePlans(f.tables.platform_settings[0].value,Date.parse(effectiveAt)+1)[0].price,12000);
});
test("administrator support changes assignment and priority while keeping a message history",async()=>{
 f.tables.support_tickets=[{id:"ticket",organization_id:"org-one",status:"aberto",priority:"media",admin_notes:"Preservar nota",created_at:"2026-10-01"}];
 const response=await support.PATCH(f.request("PATCH","/api/admin/support",{id:"ticket",status:"em_analise",priority:"alta",assignedTo:"Responsável",reply:"Estamos verificando",internal:true}));
 assert.equal(response.status,200);assert.equal(f.tables.support_tickets[0].assigned_to,"Responsável");assert.equal(f.tables.support_tickets[0].admin_notes,"Preservar nota");
 assert.equal(f.tables.support_messages.filter(message=>message.internal).length,1);
 assert.equal((await (await support.GET()).json()).tickets[0].messages.length,2);
});
test("ordinary users cannot read or modify administrative plans, support or commercial data",async()=>{
 f.runtime.PLATFORM_OWNER_EMAIL="different@example.test";f.runtime.PLATFORM_OWNER_USER_ID="different-user";
 for(const response of [await plans.GET(),await support.GET(),await commercial.GET(f.request("GET","/api/admin/commercial")),await health.GET()])assert.equal(response.status,403);
 assert.equal((await plans.PATCH(f.request("PATCH","/api/admin/plans",{plans:policy.defaultPlanPolicy().current}))).status,403);
 assert.equal(f.businessWrites().length,0);
});
test("commercial metrics exclude courtesy, expired subscriptions and unpaid activations",()=>{
 const now=Date.parse("2026-10-12T12:00:00Z"),base={id:"paid",name:"Pago",status:"active",plan:"intermediario",planStatus:"active",planExpiresAt:"2027-01-01",billingEnabled:true,billingProvider:"asaas",billingPaymentId:"payment",billingCycle:"annual"};
 const companies=[base,{...base,id:"free",billingProvider:"courtesy"},{...base,id:"expired",planExpiresAt:"2026-01-01"},{...base,id:"unpaid",billingPaymentId:""},{...base,id:"trial",planStatus:"trial",billingPaymentId:"",planExpiresAt:"2026-10-15"}];
 const result=metrics.commercialMetrics(companies,policy.defaultPlanPolicy().current,[],now);
 assert.equal(result.paid,1);assert.equal(result.free,1);assert.equal(result.trials,1);assert.equal(result.ending.length,1);assert.equal(result.monthlyEstimateCents,16915);assert.equal(result.conversionPercent,null);
});
test("conversion and cancellation counts use observed events and deduplicate companies",()=>{
 const now=Date.parse("2026-10-12T12:00:00Z"),base={organization_id:"org",billing_enabled:true,billing_provider:"asaas",billing_payment_id:"",source:"change",occurred_at:"2026-10-02T10:00:00Z"};
 const events=[{...base,new_plan_status:"trial",old_plan_status:null,source:"created"},{...base,new_plan_status:"active",old_plan_status:"trial",billing_payment_id:"p",occurred_at:"2026-10-04T10:00:00Z"},{...base,new_plan_status:"active",old_plan_status:"active",billing_payment_id:"p",occurred_at:"2026-10-05T10:00:00Z"},{...base,new_plan_status:"cancelled",old_plan_status:"active",occurred_at:"2026-10-07T10:00:00Z"},{...base,organization_id:"old",source:"baseline",new_plan_status:"trial",old_plan_status:null}];
 const result=metrics.commercialMetrics([],policy.defaultPlanPolicy().current,events,now);
 assert.equal(result.cohortTrials,1);assert.equal(result.converted,1);assert.equal(result.conversionPercent,100);assert.equal(result.cancellations,1);
});
test("health reports unavailable System evidence instead of an all-clear",async()=>{
 f.tables.fama_full_backup_runs=[{id:"b",status:"complete",completed_at:new Date().toISOString()}];
 const response=await health.GET();assert.equal(response.status,200);const payload=await response.json();
 assert.equal(payload.checks.find(item=>item.id==="database").state,"ok");assert.equal(payload.checks.find(item=>item.id==="system").state,"error");
});

test("backup health requires verification and a recent non-future completion",async()=>{for(const [valid,offset,state] of [[false,0,"warning"],[true,-1000,"ok"],[true,86400000,"warning"],[true,-72*3600000,"warning"]]){f.tables.fama_full_backup_runs=[{id:"backup",status:"complete",manifest:{verification:{valid}},completed_at:new Date(Date.now()+offset).toISOString()}];const data=await(await health.GET()).json();assert.equal(data.checks.find(check=>check.id==="backup").state,state);}});

test("security overview never marks unverified, future or stale backups as protected",async()=>{
 for(const [valid,offset,expected] of [[false,-1000,false],[true,-1000,true],[true,86400000,false],[true,-72*3600000,false],[true,NaN,false]]){
  f.tables.fama_full_backup_runs=[{id:"backup",status:"complete",manifest:{verification:{valid}},completed_at:Number.isNaN(offset)?"invalid":new Date(Date.now()+offset).toISOString()}];
  const response=await security.GET();assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.production.backups,expected);assert.equal(data.backup.fresh,expected);
 }
});

test("health uses the internal System service with server authentication",async()=>{
 const token="private-health-fixture-credential",binding={async fetch(url,init){assert.equal(this,binding);assert.equal(url,"https://famasystem.online/api/internal/operation-health");assert.equal(new Headers(init.headers).get("authorization"),"Bearer "+token);return Response.json({checkedAt:new Date().toISOString(),events:[],payments:{configured:false},fiscal:{invoices:[]}});}};
 f.runtime.FAMA_SYSTEM=binding;f.runtime.FAMA_BACKUP_SERVICE_TOKEN=token;
 try{const data=await(await health.GET()).json();assert.equal(data.checks.find(item=>item.id==="system").state,"ok");assert.doesNotMatch(JSON.stringify(data),/private-health-fixture/);}
 finally{delete f.runtime.FAMA_SYSTEM;delete f.runtime.FAMA_BACKUP_SERVICE_TOKEN;}
});
