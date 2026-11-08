import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './test-support.mjs';
import {normalizeOrder,validatePolicy,policyDefaults,text,date,transition,isOverdue,installments,resolvePolicy} from './model.mjs';

test('money and quantities reject overflow, fractions, negative values and missing products',async()=>{
  const f=await fixture(),base=f.input();
  for(const input of [null,[],{}, {...base,items:[]},{...base,items:Array(31).fill(base.items[0])},...[-1,0,1.5,101,Infinity].map(quantity=>({...base,items:[{...base.items[0],quantity}]})),{...base,discountCents:1e9},{...base,depositCents:1e9},{...base,installmentCount:37},{...base,items:[{...base.items[0],unitPriceCents:2}],depositCents:0,freightCents:0,discountCents:0,installmentCount:3}])assert.throws(()=>normalizeOrder(input));
  const full=normalizeOrder({...base,depositCents:101000});assert.equal(full.installmentCount,0);assert.equal(installments(full).length,1);
  const unpaid=normalizeOrder({...base,depositCents:0,installmentCount:1,paymentMethod:'invalid',firstDueDate:'',deliveryDate:''});assert.equal(unpaid.paymentMethod,'pix');assert.equal(installments(unpaid)[0].sequence,1);
  assert.equal(text(null),'');assert.equal(text(' 12345 ',3),'123');
  for(const value of ['2026-02-30','2026-1-01',7,null])assert.throws(()=>date(value,'Data'));
  assert.equal(date(null,'Data',true),'');
});
test('terminal states, lateness and administrative role lists fail closed',()=>{
  assert.equal(isOverdue({deliveryDate:'2026-01-01',status:'pronto'},'2026-02-01'),true);
  for(const status of ['entregue','cancelado']){assert.equal(isOverdue({deliveryDate:'2026-01-01',status},'2026-02-01'),false);assert.throws(()=>transition(status,'confirmado'));}
  assert.equal(isOverdue({},'2026-02-01'),false);assert.throws(()=>transition('unknown','pronto'));
  for(const input of [null,{}, {...policyDefaults(),editRoles:['root']},{...policyDefaults(),financeRoles:null}])assert.throws(()=>validatePolicy(input));
  assert.deepEqual(validatePolicy({...policyDefaults(),editRoles:['owner','owner']}).editRoles,['owner']);
  const access={organizationId:'a',plan:'inicial',role:'technician',permissions:['quotes','finance']};
  assert.equal(resolvePolicy([],access,'u').edit,false);
  assert.equal(resolvePolicy([],{...access,permissions:undefined},'u').enabled,false);
});
