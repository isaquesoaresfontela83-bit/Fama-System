import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';

const root = new URL('..', import.meta.url).pathname;
const originalFetch = globalThis.fetch;
const vite = await createServer({ appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{hmr:false,middlewareMode:true,ws:false} });
const passwords = await vite.ssrLoadModule('/lib/password-security.js');
let requests;
beforeEach(()=>{requests=[];globalThis.fetch=async (input,init)=>{requests.push({url:String(input),init});return new Response('0'.repeat(35)+':1\r\n'+'F'.repeat(35)+':0');};});
after(async()=>{globalThis.fetch=originalFetch;await vite.close();});
const safe='A unique phrase! 74';
const suffix=password=>createHash('sha1').update(password).digest('hex').toUpperCase().slice(5);

test('new passwords require 8 characters and respect the provider UTF-8 size limit',async()=>{
 for(const value of ['short','x'.repeat(7),'é'.repeat(7),'x'.repeat(73),'é'.repeat(37)]) await assert.rejects(passwords.assertPasswordSafe(value),error=>error.status===400);
 assert.equal(requests.length,0);
 await passwords.assertPasswordSafe('Eight!42');
 await passwords.assertPasswordSafe('é'.repeat(8));
 await passwords.assertPasswordSafe('é'.repeat(36));
});
test('only a five-character hash prefix is sent after submission, with padding and no credentials',async()=>{
 await passwords.assertPasswordSafe(safe);
 const request=requests[0];
 assert.equal(request.url,'https://api.pwnedpasswords.com/range/'+createHash('sha1').update(safe).digest('hex').toUpperCase().slice(0,5));
 assert.equal(request.init.redirect,'manual');assert.ok(request.init.signal instanceof AbortSignal);
 const headers=new Headers(request.init.headers);assert.equal(headers.get('Add-Padding'),'true');
 assert.equal(request.init.body,undefined);assert.equal(headers.get('Authorization'),null);
 assert.ok(!JSON.stringify(request).includes(safe));
});
test('breached passwords are refused but zero-count padding does not block a safe password',async()=>{
 globalThis.fetch=async()=>new Response(suffix(safe)+':984\r\n');
 await assert.rejects(passwords.assertPasswordSafe(safe),error=>error.status===400&&error.message.includes('vazamentos'));
 globalThis.fetch=async()=>new Response(suffix(safe)+':0\r\n');
 await passwords.assertPasswordSafe(safe);
});
for(const status of [301,403,429,500]) test('password screening rejects provider HTTP '+status,async()=>{
 globalThis.fetch=async()=>new Response('Unavailable',{status});
 await assert.rejects(passwords.assertPasswordSafe(safe),error=>error.status===503);
});
for(const body of ['', '<html>error</html>', '0'.repeat(34)+':1', '0'.repeat(35)+':-1', '0'.repeat(35)+':1\r\ninvalid']) test('password screening rejects malformed responses '+JSON.stringify(body).slice(0,40),async()=>{
 globalThis.fetch=async()=>new Response(body);
 await assert.rejects(passwords.assertPasswordSafe(safe),error=>error.status===503);
});
test('password screening bounds the streamed response and handles connection failures',async()=>{
 globalThis.fetch=async()=>new Response('X'.repeat(201*1024));
 await assert.rejects(passwords.assertPasswordSafe(safe),error=>error.status===503);
 globalThis.fetch=async()=>{throw new TypeError('Connection lost');};
 await assert.rejects(passwords.assertPasswordSafe(safe),error=>error.status===503);
});
