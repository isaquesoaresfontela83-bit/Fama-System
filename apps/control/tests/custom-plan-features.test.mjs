import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const vite=await createServer({configFile:false,root,server:{middlewareMode:true,hmr:false,ws:false}});
const f=await vite.ssrLoadModule('/lib/plan-features.js');
const p=await vite.ssrLoadModule('/lib/plan-policy.js');
const c=await vite.ssrLoadModule('/lib/plan-catalog.js');
const b=await vite.ssrLoadModule('/lib/fama-blocks.js');
test.after(()=>vite.close());
test('explicit selections override tier defaults and reject unknown resources',()=>{
 assert.equal(f.planIncludesFeature('inicial','assistant'),false);
 assert.equal(f.planIncludesFeature('inicial','assistant',['dashboard','assistant']),true);
 assert.equal(f.planIncludesFeature('profissional','assistant',['dashboard']),false);
 assert.equal(f.planIncludesFeature('inicial','unknown',['unknown']),false);
});
test('catalog accepts custom features and rejects unknown, duplicates and missing dashboard',()=>{
 const plans=c.defaultPlanCatalog.map(p=>({...p,featureIds:['dashboard','assistant','finance']}));
 assert.ok(p.normalizePolicyPlans(plans)[0].featureIds.includes('assistant'));
 for(const ids of [['dashboard','unknown'],['dashboard','dashboard'],['assistant']])assert.throws(()=>p.normalizePolicyPlans(plans.map((p,i)=>i?p:{...p,featureIds:ids})));
});
test('configured resources still respect explicit member module removals',()=>{
 const rules=Object.fromEntries(['global','organization','member'].map(k=>[k,{overrides:{},revision:0,updatedAt:null}]));
 assert.ok(b.resolveBlockAccess('owner',[],rules,'inicial',['dashboard','finance']).includes('finance'));
 rules.member.overrides.finance=false;
 assert.ok(!b.resolveBlockAccess('owner',[],rules,'inicial',['dashboard','finance']).includes('finance'));
 assert.ok(!b.resolveBlockAccess('owner',[],rules,'inicial',['dashboard']).includes('finance'));
});
