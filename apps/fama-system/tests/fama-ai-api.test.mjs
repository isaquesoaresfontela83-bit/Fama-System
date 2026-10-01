import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const routeSource = await readFile(new URL('../app/api/assistant/route.ts', import.meta.url), 'utf8');
const platform = routeSource.includes('requirePlatformAdmin');
const originalFetch = globalThis.fetch;
globalThis.__copilotRuntime = {};
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false }, plugins: [{ name: 'copilot-server-fixtures', enforce: 'pre', resolveId(id) {
  if (id.startsWith('\0copilot-')) return id;
  if (id === 'cloudflare:workers') return '\0copilot-env';
  if (id.endsWith('/lib/tenant') || id.endsWith('/lib/tenant.ts')) return '\0copilot-auth';
  if (id.endsWith('/lib/security') || id.endsWith('/lib/security.ts')) return '\0copilot-rate';
  if (id.endsWith('/ai-settings/route')) return '\0copilot-settings';
  if (id.endsWith('/bootstrap/route')) return '\0copilot-bootstrap';
  for (const name of ['organizations', 'members', 'audit', 'privacy']) if (id.endsWith(`/admin/${name}/route`)) return `\0copilot-admin-${name}`;
}, load(id) {
  if (id === '\0copilot-env') return 'export const env = globalThis.__copilotRuntime;';
  if (id === '\0copilot-auth') return `export class RequestError extends Error { constructor(message,status) { super(message); this.status=status; } }
  export async function requireTenant(request) { if (!globalThis.__copilotState.auth) throw new RequestError('Entre no sistema',401); if (request.headers.get('x-organization-id') !== 'org-a') throw new RequestError('Empresa não autorizada',403); if (globalThis.__copilotState.blocked) throw new RequestError('Acesso bloqueado',402); return { user:{id:'user-a'}, organization:{id:'org-a',role:globalThis.__copilotState.role,permissions:globalThis.__copilotState.permissions} }; }
  export async function requirePlatformAdmin() { if (!globalThis.__copilotState.auth) throw new RequestError('Entre no sistema',401); if (!globalThis.__copilotState.platformAdmin) throw new RequestError('Acesso restrito',403); return {id:'platform-owner'}; }
  export function tenantError(error,fallback) { return Response.json({error:error instanceof RequestError?error.message:fallback},{status:error instanceof RequestError?error.status:500}); }`;
  if (id === '\0copilot-rate') return 'import {RequestError} from "\\0copilot-auth"; export async function assertRateLimit() { if (!globalThis.__copilotState.rateAllowed) throw new RequestError("Muitas tentativas",429); }';
  if (id === '\0copilot-settings') return 'export async function GET() { if (!globalThis.__copilotState.preferencesAvailable) return Response.json({error:"unavailable"},{status:503}); return Response.json({settings:globalThis.__copilotState.settings,revision:1,updatedAt:"2026-10-01T12:00:00Z"}); }';
  if (id === '\0copilot-bootstrap') return 'export async function GET(request) { globalThis.__copilotState.reads.push(request.headers.get("x-organization-id")); return Response.json(globalThis.__copilotState.records); }';
  if (id.startsWith('\0copilot-admin-')) { const name=id.split('-').at(-1); return `export async function GET() { globalThis.__copilotState.reads.push('${name}'); return Response.json(globalThis.__copilotState.administrative['${name}']); }`; }
} }] });
const api = await vite.ssrLoadModule('/app/api/assistant/route.ts');
const { defaultAssistantSettings: defaults } = await vite.ssrLoadModule('/lib/fama-ai-settings.ts');
let providerRequests;
beforeEach(() => {
  Object.keys(globalThis.__copilotRuntime).forEach(key => delete globalThis.__copilotRuntime[key]);
  globalThis.__copilotState = { auth: true, platformAdmin: true, blocked: false, role: 'owner', permissions: [], rateAllowed: true, preferencesAvailable: true, settings: structuredClone(defaults), reads: [], records: { appointments: [], transactions: [{ id: 'finance-a', description: 'Valor da empresa A', type: 'receita', status: 'pago', amountCents: 45000, dueDate: '2026-10-01' }], customers: [{ id: 'c-a', name: 'Cliente A' }] }, administrative: { organizations: { organizations: [{ id:'org-a',name:'Empresa A',status:'active',ownerEmail:'PRIVATE_EMAIL' }] }, members: { members: [{id:'member-a',displayName:'Equipe',email:'PRIVATE_EMAIL',role:'admin',status:'active'}] }, audit: {audit:[{id:'event',eventType:'security',occurredAt:'2026-10-01T10:00:00Z',metadata:{secret:'PRIVATE_METADATA'}}]}, privacy:{requests:[{id:'request',requestType:'access',status:'open',contact:'PRIVATE_CONTACT',details:'PRIVATE_DETAILS'}]} } };
  providerRequests = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    providerRequests.push(JSON.parse(init.body));
    return providerRequests.length === 1 ? Response.json({output:[{type:'function_call',name:'query_system',call_id:'call',arguments:JSON.stringify({source:platform?'overview':'finance',question:platform?'Resumo da gestão':'Resumo financeiro'})}]}) : Response.json({output:[{type:'message',content:[{type:'output_text',text:'Confira os registros autorizados.'}]}]});
  };
});
after(async () => { globalThis.fetch = originalFetch; await vite.close(); delete globalThis.__copilotRuntime; delete globalThis.__copilotState; });
const statusRequest = () => new Request('https://fama.example.test/api/assistant',{headers:{'x-organization-id':'org-a'}});
const post = (body = {question:'Resumo da gestão',source:'overview'}, headers = {}) => api.POST(new Request('https://fama.example.test/api/assistant',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://fama.example.test','x-organization-id':'org-a',...headers},body:JSON.stringify(body)}));
const activate = () => Object.assign(globalThis.__copilotRuntime,{OPENAI_API_KEY:'server-provider-fixture',FAMA_AI_GENERATIVE_ENABLED:'true'});

test('connection status is authenticated, uncached and never exposes secrets', async () => {
  const response=await api.GET(statusRequest()); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store'); assert.deepEqual(await response.json(),{configured:false});
  activate(); assert.deepEqual(await (await api.GET(statusRequest())).json(),{configured:true});
  globalThis.__copilotState.auth=false; assert.equal((await api.GET(statusRequest())).status,401);
  assert.equal(providerRequests.length,0);
});

test('unconfigured provider requires no record reads or outgoing model requests', async () => {
  assert.equal((await post()).status,503); assert.deepEqual(globalThis.__copilotState.reads,[]); assert.equal(providerRequests.length,0);
  globalThis.__copilotRuntime.OPENAI_API_KEY='server-provider-fixture';
  assert.equal((await post()).status,503); assert.equal(providerRequests.length,0);
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

test('model facts come from the authenticated server area and exclude private administrative fields', async () => {
  activate(); const response=await post(); assert.equal(response.status,200); const payload=await response.json(); assert.equal(payload.answer.engine,'generative');
  assert.equal(providerRequests.length,2); assert.doesNotMatch(JSON.stringify(payload),/server-provider-fixture/);
  if (platform) {
    assert.deepEqual(globalThis.__copilotState.reads.sort(),['audit','members','organizations','privacy']);
    assert.doesNotMatch(JSON.stringify(providerRequests),/PRIVATE_EMAIL|PRIVATE_METADATA|PRIVATE_CONTACT|PRIVATE_DETAILS/);
    assert.equal((await post({question:'Meu financeiro',source:'finance'})).status,403);
  } else {
    assert.deepEqual(globalThis.__copilotState.reads,['org-a']); assert.equal(payload.answer.items[0].id,'finance-a');
    const tool=providerRequests[1].input.find(item=>item.type==='function_call_output'); assert.match(tool.output,/450,00/);
    providerRequests=[]; globalThis.__copilotState.role='admin'; globalThis.__copilotState.permissions=['customers'];
    assert.equal((await post({question:'Resumo financeiro',source:'finance'})).status,403); assert.equal(providerRequests.length,0);
  }
});
