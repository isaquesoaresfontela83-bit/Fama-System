import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOCK_ITEMS,DOCK_CATALOG,normalizePreferences,moveItem,allowedCatalog} from './dock-preferences.mjs';
test('legacy layout migrates without suddenly showing every module',()=>{
 const p=normalizePreferences({order:['agenda','home'],hidden:['customers']});
 assert.equal(p.version,2);assert.equal(p.order[0],'agenda');assert.ok(p.hidden.includes('customers'));assert.ok(p.hidden.includes('finance'));assert.ok(p.hidden.includes('inventory'));
 assert.deepEqual(normalizePreferences().order.slice(0,5),DOCK_ITEMS);
});
test('malformed preferences cannot add arbitrary routes or hide More',()=>{
 const p=normalizePreferences({version:2,order:['admin','finance','finance','javascript:evil'],hidden:['more','home','home','admin']});
 assert.equal(p.order[0],'finance');assert.equal(p.order.includes('admin'),false);assert.deepEqual(p.hidden,['home']);
 assert.equal(normalizePreferences({order:'bad',hidden:null}).order.length,DOCK_CATALOG.length);
});
test('any known module can be selected, reordered and persisted',()=>{
 const p=normalizePreferences(),original=p.order.slice();p.hidden=p.hidden.filter(id=>!['finance','inventory','pedidos'].includes(id));
 const next=moveItem(p,'finance',-1,['home','finance']);
 assert.equal(next.order[0],'finance');assert.deepEqual(p.order,original);assert.equal(next.hidden.includes('inventory'),false);
 assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(next))),next);
});
test('permission catalog excludes denied modules and administrative areas',()=>{
 const items=allowedCatalog({role:'member',moduleAccess:['dashboard','quotes','customers'],plan:'inicial'},true).map(x=>x.id);
 assert.ok(items.includes('quotes'));assert.ok(items.includes('pedidos'));assert.ok(items.includes('charts'));assert.ok(items.includes('consultation'));
 for(const denied of ['finance','inventory','settings','members','billing','invoices'])assert.equal(items.includes(denied),false,denied);
 assert.equal(allowedCatalog({role:'owner',moduleAccess:[]},true).some(x=>x.id==='finance'),false);
 assert.deepEqual(allowedCatalog(null,true),[]);
});
test('Pedidos policies and invoice plan features remain independent checks',()=>{
 const access={role:'admin',moduleAccess:['finance','quotes'],plan:'intermediario'};
 assert.equal(allowedCatalog(access,false).some(x=>x.id==='pedidos'),false);
 assert.equal(allowedCatalog(access,true).some(x=>x.id==='invoices'),false);
 assert.ok(allowedCatalog({...access,planFeatures:['invoices']},true).some(x=>x.id==='invoices'));
 assert.equal(allowedCatalog({...access,plan:'profissional',planFeatures:[]},true).some(x=>x.id==='invoices'),false);
});
test('restore default retains More and hides extra functions again',()=>{
 const p=normalizePreferences();assert.equal(p.hidden.includes('more'),false);assert.ok(p.hidden.includes('finance'));
 assert.deepEqual(moveItem(p,'home',-1),p);assert.deepEqual(moveItem(p,'more',1,['home','more']),p);
});
