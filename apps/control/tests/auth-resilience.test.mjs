import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';

const root = new URL('..', import.meta.url).pathname;
const authFile = existsSync(new URL('../app/system-auth.js', import.meta.url)) ? 'system-auth' : 'system-auth';
const runtime = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', SUPABASE_SECRET_KEY: 'sb_secret_fixture', DATA_BACKEND: 'supabase' };
const cookieValues = new Map();
globalThis.__famaAuthResilience = { runtime, cookies: { get: key => cookieValues.has(key) ? { value: cookieValues.get(key) } : undefined, set: (key, value) => cookieValues.set(key, value), delete: key => cookieValues.delete(key) } };
const originalFetch = globalThis.fetch;
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, ssr: { noExternal: ['next'] }, server: { hmr: false, middlewareMode: true, ws: false }, plugins: [{
  name: 'auth-resilience-fixtures', enforce: 'pre',
  resolveId(id) {
    if (id === 'cloudflare:workers') return '\0resilience-env';
    if (id === 'next/headers') return '\0resilience-cookies';
    if (id.endsWith('/lib/security') || id.endsWith('/lib/security.js')) return '\0resilience-audit';
  },
  load(id) {
    if (id === '\0resilience-env') return 'export const env=globalThis.__famaAuthResilience.runtime;';
    if (id === '\0resilience-cookies') return 'export async function cookies(){return globalThis.__famaAuthResilience.cookies;}';
    if (id === '\0resilience-audit') return 'export async function logAudit(){}; export async function assertRateLimit(){ if(globalThis.__famaAuthResilience.limited) { const {RequestError}=await import("/lib/tenant.js");throw new RequestError("Muitas tentativas.",429); } }';
  }
}] });
const auth = await vite.ssrLoadModule(`/app/${authFile}.js`);
const data = await vite.ssrLoadModule('/lib/supabase.js');
const logout = await vite.ssrLoadModule('/app/api/auth/logout/route.js');
const login = await vite.ssrLoadModule('/app/api/auth/login/route.js');
let requests;
beforeEach(() => {
  cookieValues.clear(); requests = []; globalThis.__famaAuthResilience.limited=false;
  globalThis.fetch=async (input,init={}) => { requests.push({url:String(input),init}); return Response.json({id:'fixture-user',email:'fixture@example.test'}); };
});
after(async () => { globalThis.fetch=originalFetch; delete globalThis.__famaAuthResilience; await vite.close(); });

test('authentication succeeds with a deadline and refuses provider redirects or malformed success', async () => {
  assert.equal((await auth.supabaseAuthRequest('/auth/v1/user')).id,'fixture-user');
  assert.equal(requests[0].init.redirect,'manual'); assert.ok(requests[0].init.signal instanceof AbortSignal);
  const controller=new AbortController();
  await auth.supabaseAuthRequest('/auth/v1/user',{signal:controller.signal}); assert.equal(requests[1].init.signal,controller.signal);
  globalThis.fetch=async (input,init) => { requests.push({url:String(input),init}); return new Response(null,{status:307,headers:{Location:'https://attacker.example/steal'}}); };
  await assert.rejects(auth.supabaseAuthRequest('/auth/v1/user'), error => error.status===503 && error.code==='AUTH_REDIRECT_REJECTED');
  assert.equal(requests.at(-1).url,'https://fixture.supabase.co/auth/v1/user'); assert.equal(requests.length,3);
  globalThis.fetch=async () => new Response('<html>Service unavailable</html>',{status:200});
  await assert.rejects(auth.supabaseAuthRequest('/auth/v1/user'), error => error.status===503 && error.code==='AUTH_INVALID_RESPONSE');
});

test('database reads have a deadline and never follow credential redirects', async () => {
  globalThis.fetch=async (input,init) => { requests.push({url:String(input),init}); return Response.json([]); };
  assert.deepEqual(await data.selectRows('organizations'),[]);
  assert.equal(requests[0].init.redirect,'manual'); assert.ok(requests[0].init.signal instanceof AbortSignal);
  globalThis.fetch=async () => new Response(null,{status:302,headers:{Location:'https://attacker.example/steal'}});
  await assert.rejects(data.selectRows('organizations'), error => error.status===503 && error.code==='SUPABASE_REDIRECT_REJECTED');
  globalThis.fetch=async () => { throw new TypeError('Connection lost'); };
  await assert.rejects(data.selectRows('organizations'), error => error.status===503 && error.code==='SUPABASE_UNAVAILABLE');
});

test('login distinguishes connection failures and rate limits from invalid credentials', async () => {
  const request=() => new Request('https://fama.example/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'fixture@example.test',password:'fixture-password'})});
  globalThis.fetch=async () => { throw new DOMException('Timed out','TimeoutError'); };
  assert.equal((await login.POST(request())).status,503);
  globalThis.fetch=async () => Response.json({message:'Invalid login credentials'},{status:400});
  assert.equal((await login.POST(request())).status,401);
  globalThis.__famaAuthResilience.limited=true;
  assert.equal((await login.POST(request())).status,429);
});

test('logout clears cookies and keeps malicious return addresses on the current site', async () => {
  for (const destination of ['https://attacker.example','//attacker.example','/\\attacker.example','/\n/attacker.example','/api/auth/logout','/callback']) {
    await auth.setSupabaseSession({access_token:'fixture-access',refresh_token:'fixture-refresh'});
    const response=await logout.GET(new Request(`https://fama.example/api/auth/logout?return_to=${encodeURIComponent(destination)}`));
    assert.equal(response.status,303); assert.equal(response.headers.get('location'),'https://fama.example/'); assert.equal(cookieValues.size,0);
    assert.equal(new URL(auth.appSignOutPath(destination),'https://fama.example').searchParams.get('return_to'),'/');
  }
  const response=await logout.GET(new Request('https://fama.example/api/auth/logout?return_to=%2Fentrar%3Fsignup%3D1%23agenda'));
  assert.equal(response.headers.get('location'),'https://fama.example/entrar?signup=1#agenda');
});
