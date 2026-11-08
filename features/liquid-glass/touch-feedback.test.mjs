import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installTouchFeedback} from './touch-feedback.mjs';
function setup({disabled=false,reduced=false}={}) {
  const events={},calls=[];
  const element={isConnected:true,closest:()=>disabled,contains:()=>true,animate(frames,options){const a={cancel(){a.cancelled=true;}};calls.push({frames,options,a});return a;}};
  const target={closest:()=>element};
  const doc={addEventListener(name,fn){events[name]=fn;}};
  const win={matchMedia:()=>({matches:reduced,addEventListener(){}}),addEventListener(){}};
  installTouchFeedback(doc,win);
  const fire=(name,extra={})=>events[name]({target,pointerType:'touch',pointerId:1,clientX:0,clientY:0,...extra});
  return {fire,calls};
}
test('quick taps retain a visible release animation and support repeated taps',()=>{
  const {fire,calls}=setup();fire('pointerdown');fire('pointerup');assert.equal(calls.length,2);assert.equal(calls[1].options.duration,320);assert.equal(calls[0].a.cancelled,true);
  fire('pointerdown');assert.equal(calls[1].a.cancelled,true);fire('pointerup');assert.equal(calls.length,4);
});
test('scrolling and cancelled gestures do not bounce on release',()=>{
  for(const action of ['pointermove','pointercancel']){const {fire,calls}=setup();fire('pointerdown');fire(action,{clientX:30});fire('pointerup');assert.equal(calls.length,1);assert.equal(calls[0].a.cancelled,true);}
});
test('disabled controls, reduced motion and mouse clicks do not animate',()=>{
  for(const options of [{disabled:true},{reduced:true}]){const {fire,calls}=setup(options);fire('pointerdown');fire('pointerup');assert.equal(calls.length,0);}
  const {fire,calls}=setup();fire('pointerdown',{pointerType:'mouse'});fire('pointerup',{pointerType:'mouse'});assert.equal(calls.length,0);
});
