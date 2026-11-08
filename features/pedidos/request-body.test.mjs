import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedText,readJsonObject} from './request-body.mjs';

const request=(body,headers={},signal)=>new Request('https://fixture.test',{method:'POST',headers,body,signal,duplex:'half'});
test('JSON media type, syntax, shape and UTF-8 are checked',async()=>{
  assert.deepEqual(await readJsonObject(request('{"name":"á"}',{'content-type':'Application/JSON; charset=utf-8'})),{name:'á'});
  for(const value of ['null','[]','true','1','"text"','{'])await assert.rejects(readJsonObject(request(value,{'content-type':'application/json'})),e=>e.status===400);
  for(const type of ['text/plain','application/jsonp',''])await assert.rejects(readJsonObject(request('{}',{'content-type':type})),e=>e.status===415);
  await assert.rejects(readBoundedText(request(new Uint8Array([255])),10),e=>e.status===400);
});
test('announced and actual byte limits include chunked multibyte input',async()=>{
  await assert.rejects(readBoundedText(request('{}',{'content-length':'11'}),10),e=>e.status===413);
  for(const length of ['-1','NaN','9007199254740992'])await assert.rejects(readBoundedText(request('{}',{'content-length':length}),10),e=>e.status===400);
  await assert.rejects(readBoundedText(request('ááá'),5),e=>e.status===413);
  assert.equal(await readBoundedText(request('áá'),4),'áá');
  await assert.rejects(readBoundedText(request(undefined),10),e=>e.status===400);
});
test('stalled readers time out, cancel and release their lock',async()=>{
  let cancelled=false;
  const stream=new ReadableStream({cancel(){cancelled=true;}});
  await assert.rejects(readBoundedText(request(stream),100,5),e=>e.status===408);
  assert.equal(cancelled,true);assert.equal(stream.locked,false);
});
test('failed reads and aborted requests have explicit errors and release the reader',async()=>{
  const broken=new ReadableStream({start(controller){controller.error(new Error('fixture failure'));}});
  await assert.rejects(readBoundedText(request(broken),100),e=>e.status===400);
  assert.equal(broken.locked,false);
  const controller=new AbortController(),stream=new ReadableStream();
  const read=readBoundedText(request(stream,{},controller.signal),100);
  controller.abort();await assert.rejects(read,e=>e.status===400);assert.equal(stream.locked,false);
  const already=new AbortController();already.abort();
  await assert.rejects(readBoundedText(request(new ReadableStream(),{},already.signal),100),e=>e.status===400);
});
