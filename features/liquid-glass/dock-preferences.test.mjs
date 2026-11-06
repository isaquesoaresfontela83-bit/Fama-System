import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOCK_ITEMS,normalizePreferences,moveItem} from './dock-preferences.mjs';
test('malformed or untrusted preferences cannot add navigation or hide More',()=>{
 assert.deepEqual(normalizePreferences(),{order:DOCK_ITEMS,hidden:[]});
 assert.deepEqual(normalizePreferences({order:['admin','agenda','agenda'],hidden:['more','admin','home','home']}),{order:['agenda','home','new','customers','more'],hidden:['home']});
 assert.deepEqual(normalizePreferences({order:'invalid',hidden:null}),{order:DOCK_ITEMS,hidden:[]});
});
test('reordering retains hidden preferences and never mutates source data',()=>{
 const p={order:[...DOCK_ITEMS],hidden:['customers']};
 const next=moveItem(p,'agenda',-1);assert.equal(next.order[0],'agenda');assert.equal(p.order[0],'home');assert.deepEqual(next.hidden,['customers']);
 assert.deepEqual(moveItem(p,'home',-1),p);assert.deepEqual(moveItem(p,'more',1),p);
});
test('saved layout survives JSON roundtrip; reset restores all defaults',()=>{
 const p=normalizePreferences({order:['new','customers','more','agenda','home'],hidden:['home','agenda','new','customers','more']});
 assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(p))),p);
 assert.equal(p.hidden.includes('more'),false);assert.deepEqual(normalizePreferences(null),{order:DOCK_ITEMS,hidden:[]});
});
test('reorder only moves between permitted shortcuts, without enabling missing modules',()=>{
 const next=moveItem({order:DOCK_ITEMS,hidden:['customers']},'customers',-1,['home','customers','more']);
 assert.deepEqual(next.order,['customers','agenda','new','home','more']);assert.deepEqual(next.hidden,['customers']);
});
