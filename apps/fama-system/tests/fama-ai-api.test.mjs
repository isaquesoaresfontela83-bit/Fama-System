import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const routeSource = await readFile(new URL('../app/api/assistant/route.js', import.meta.url), 'utf8');
const platform = routeSource.includes('requirePlatformAdmin');
const originalFetch = globalThis.fetch;
globalThis.__copilotRuntime = {};
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false }, plugins: [{ name: 'copilot-server-fixtures', enforce: 'pre', resolveId(id) {
  if (id.startsWith('\0copilot-')) return id;
  if (id === 'cloudflare:workers') return '\0copilot-env';
  if (id.endsWith('/lib/tenant') || id.endsWith('/lib/tenant.js')) return '\0copilot-auth';
  if (id.endsWith('/lib/security') || id.endsWith('/lib/security.js')) return '\0copilot-rate';
  if (id.endsWith('/ai-settings/route')) return '\0copilot-settings';
  if (id.endsWith('/bootstrap/route')) return '\0copilot-bootstrap';
  for (const name of ['organizations', 'members', 'audit', 'privacy']) if (id.endsWith(`/admin/${name}/route`)) return `\0copilot-admin-${name}`;
}, load(id) {
  if (id === '\0copilot-env') return 'export const env = globalThis.__copilotRuntime;';
  if (id === '\0copilot-auth') return `export class RequestError extends Error { constructor(message,status) { super(message); this.status=status; } }
  export async function requireTenant(request) { if (!globalThis.__copilotState.auth) throw new RequestError('Entre no sistema',401); if (request.headers.get('x-organization-id') !== 'org-a') throw new RequestError('Empresa não autorizada',403); if (globalThis.__copilotState.blocked) throw new RequestError('Acesso bloqueado',402); return { user:{id:'user-a'}, organization:{id:'org-a',plan:'profissional',role:globalThis.__copilotState.role,permissions:globalThis.__copilotState.permissions,moduleAccess:globalThis.__copilotState.moduleAccess} }; }
  export async function requirePlatformAdmin() { if (!globalThis.__copilotState.auth) throw new RequestError('Entre no sistema',401); if (!globalThis.__copilotState.platformAdmin) throw new RequestError('Acesso restrito',403); return {id:'platform-owner'}; }
  export function tenantError(error,fallback) { return Response.json({error:error instanceof RequestError?error.message:fallback},{status:error instanceof RequestError?error.status:500}); }`;
  if (id === '\0copilot-rate') return 'import {RequestError} from "\\0copilot-auth"; export async function assertRateLimit() { if (!globalThis.__copilotState.rateAllowed) throw new RequestError("Muitas tentativas",429); }';
  if (id === '\0copilot-settings') return 'export async function GET() { if (!globalThis.__copilotState.preferencesAvailable) return Response.json({error:"unavailable"},{status:503}); return Response.json({settings:globalThis.__copilotState.settings,revision:1,updatedAt:"2026-10-01T12:00:00Z"}); }';
  if (id === '\0copilot-bootstrap') return 'export async function GET(request) { globalThis.__copilotState.reads.push(request.headers.get("x-organization-id")); return Response.json(globalThis.__copilotState.records); }';
  if (id.startsWith('\0copilot-admin-')) { const name=id.split('-').at(-1); return `export async function GET() { globalThis.__copilotState.reads.push('${name}'); return Response.json(globalThis.__copilotState.administrative['${name}']); }`; }
} }] });
const api = await vite.ssrLoadModule('/app/api/assistant/route.js');
const { defaultAssistantSettings: defaults } = await vite.ssrLoadModule('/lib/fama-ai-settings.js');
let providerRequests;
beforeEach(() => {
  Object.keys(globalThis.__copilotRuntime).forEach(key => delete globalThis.__copilotRuntime[key]);
  globalThis.__copilotState = { auth: true, platformAdmin: true, blocked: false, role: 'owner', permissions: [], rateAllowed: true, preferencesAvailable: true, settings: structuredClone(defaults), reads: [], records: { appointments: [], transactions: [{ id: 'finance-a', description: 'Valor da empresa A', type: 'receita', status: 'pago', amountCents: 45000, dueDate: '2026-10-01' }], customers: [{ id: 'c-a', name: 'Cliente A' }] }, administrative: { organizations: { organizations: [{ id:'org-a',name:'Empresa A',status:'active',ownerEmail:'PRIVATE_EMAIL' }] }, members: { members: [{id:'member-a',displayName:'Equipe',email:'PRIVATE_EMAIL',role:'admin',status:'active'}] }, audit: {audit:[{id:'event',eventType:'security',occurredAt:'2026-10-01T10:00:00Z',metadata:{secret:'PRIVATE_METADATA'}}]}, privacy:{requests:[{id:'request',requestType:'access',status:'open',contact:'PRIVATE_CONTACT',details:'PRIVATE_DETAILS'}]} } };
  providerRequests = [];
  globalThis.fetch = async (url) => { providerRequests.push(url); throw new Error('External model calls are forbidden'); };
});
after(async () => { globalThis.fetch = originalFetch; await vite.close(); delete globalThis.__copilotRuntime; delete globalThis.__copilotState; });
const statusRequest = () => new Request('https://fama.example.test/api/assistant',{headers:{'x-organization-id':'org-a'}});
const post = (body = {question:'Resumo da gestão',source:'overview'}, headers = {}) => api.POST(new Request('https://fama.example.test/api/assistant',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://fama.example.test','x-organization-id':'org-a',...headers},body:JSON.stringify(body)}));
const activate = () => Object.assign(globalThis.__copilotRuntime,{FAMA_AI_PYTHON_TOKEN:'server-provider-fixture-32-characters-long',FAMA_AI_PYTHON_URL:'https://python.example.test',FAMA_AI_PROVIDER:'cloudflare',FAMA_AI_GENERATIVE_ENABLED:'true'});

test('native connection is authenticated, uncached and needs no external credential', async () => {
  const response=await api.GET(statusRequest()); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store'); assert.deepEqual(await response.json(),{configured:true,state:'ready',engine:'internal',cloud:{provider:'cloudflare',state:'awaiting_key',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'}});
  activate(); assert.deepEqual(await (await api.GET(statusRequest())).json(),{configured:true,state:'ready',engine:'internal',cloud:{provider:'cloudflare',state:'ready',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'}});
  globalThis.__copilotState.auth=false; assert.equal((await api.GET(statusRequest())).status,401);
  assert.equal(providerRequests.length,0);
});

test('native queries work with no provider key or activation flag', async () => {
  const result=await post(); assert.equal(result.status,200); assert.equal((await result.json()).answer.engine,'internal'); assert.equal(providerRequests.length,0);
});

test('cross-origin, unauthenticated and forged-scope requests stop before records or model calls', async () => {
  activate(); assert.equal((await post(undefined,{Origin:'https://evil.example.test'})).status,403);
  globalThis.__copilotState.auth=false; assert.equal((await post()).status,401); globalThis.__copilotState.auth=true;
  if (platform) { globalThis.__copilotState.platformAdmin=false; assert.equal((await post()).status,403); }
  else { assert.equal((await post(undefined,{'x-organization-id':'org-b'})).status,403); globalThis.__copilotState.blocked=true; assert.equal((await post()).status,402); }
  assert.deepEqual(globalThis.__copilotState.reads,[]); assert.equal(providerRequests.length,0);
});

test('strict body, settings availability, disabled functions and rate limits fail closed', async () => {
  activate(); assert.equal((await post({question:'Meu dia',context:{balance:99999}})).status,400);
  assert.equal((await post({question:'x'.repeat(2001)})).status,400);
  assert.equal((await post(undefined,{'Content-Type':'text/plain'})).status,415);
  globalThis.__copilotState.preferencesAvailable=false; assert.equal((await post()).status,503); globalThis.__copilotState.preferencesAvailable=true;
  globalThis.__copilotState.settings.enabled=false; assert.equal((await post()).status,403); globalThis.__copilotState.settings.enabled=true;
  globalThis.__copilotState.rateAllowed=false; assert.equal((await post()).status,429);
  assert.equal(providerRequests.length,0); assert.deepEqual(globalThis.__copilotState.reads,[]);
});

test('native facts use only the authenticated server area and omit private administration fields', async () => {
  const response=await post(platform ? undefined : {question:'Resumo financeiro',source:'finance'}); assert.equal(response.status,200); const payload=await response.json(); assert.equal(payload.answer.engine,'internal');
  assert.equal(providerRequests.length,0); assert.doesNotMatch(JSON.stringify(payload),/server-provider-fixture/);
  if (platform) {
    assert.deepEqual(globalThis.__copilotState.reads.sort(),['audit','members','organizations','privacy']);
    assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_EMAIL|PRIVATE_METADATA|PRIVATE_CONTACT|PRIVATE_DETAILS/);
    assert.equal((await post({question:'Meu financeiro',source:'finance'})).status,403);
  } else {
    assert.deepEqual(globalThis.__copilotState.reads,['org-a']); assert.equal(payload.answer.items[0].id,'finance-a'); assert.match(payload.answer.text,/450,00/);
    globalThis.__copilotState.role='admin'; globalThis.__copilotState.permissions=['customers'];
    assert.equal((await post({question:'Resumo financeiro',source:'finance'})).status,403);
    const denied=await (await post({question:'Agenda e financeiro',source:'overview'})).json(); assert.doesNotMatch(JSON.stringify(denied),/450,00|finance-a/);
  }
  assert.equal(providerRequests.length,0);
});


test('central block rules prevent owner assistant queries and remove denied facts from overview answers',async()=>{
  globalThis.__copilotState.moduleAccess=['crm','assistant'];
  assert.equal((await post({question:'Resumo financeiro',source:'finance'})).status,403);
  const overview=await post({question:'Visão geral da empresa',source:'overview'});assert.equal(overview.status,200);assert.doesNotMatch(JSON.stringify(await overview.json()),/finance-a|450,00/);
  globalThis.__copilotState.moduleAccess=[];globalThis.__copilotState.reads=[];
  assert.equal((await api.GET(new Request('https://fama.example.test/api/assistant',{headers:{'x-organization-id':'org-a'}}))).status,403);
  assert.equal((await post()).status,403);assert.deepEqual(globalThis.__copilotState.reads,[]);assert.equal(providerRequests.length,0);
});


test('Workers AI augments server-authorized answers without receiving private administrative fields or denied modules', async () => {
  activate();
  globalThis.fetch = async (url, init) => { providerRequests.push({url, body:JSON.parse(init.body)}); return Response.json({state:'ready',response:'Confira as pendências nos módulos disponíveis e revise os próximos passos.'}); };
  if (!platform) { globalThis.__copilotState.role='admin'; globalThis.__copilotState.permissions=['customers']; }
  const response=await post({question:'Visão geral da gestão',source:'overview'});
  assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.answer.engine,'cloudflare');
  assert.match(payload.answer.cloudNarrative,/Confira as pendências/);assert.equal(providerRequests.length,1);
  assert.equal(providerRequests[0].url,'https://python.example.test/v1/generate');
  const forwarded=JSON.stringify(providerRequests[0].body);
  assert.doesNotMatch(forwarded,/PRIVATE_EMAIL|PRIVATE_METADATA|PRIVATE_CONTACT|PRIVATE_DETAILS|server-provider-fixture/);
  if(!platform)assert.doesNotMatch(forwarded,/450,00|finance-a|Valor da empresa A/);
  assert.doesNotMatch(JSON.stringify(payload),/server-provider-fixture/);
});

test('Workers AI failure preserves authorized native results without revealing an upstream error', async () => {
  activate();globalThis.fetch=async()=>{providerRequests.push('attempt');return Response.json({error:{message:'server-provider-fixture'}},{status:429});};
  const response=await post();assert.equal(response.status,200);const payload=await response.json();
  assert.equal(payload.answer.engine,'internal');assert.equal(payload.answer.cloudState,'unavailable');assert.equal(providerRequests.length,1);
  assert.doesNotMatch(JSON.stringify(payload),/server-provider-fixture/);
});
