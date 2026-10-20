import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { createServer } from 'vite';
const root = new URL('..', import.meta.url).pathname, originalFetch = globalThis.fetch;
globalThis.__blocksRuntime = { DATA_BACKEND:'supabase', SUPABASE_URL:'https://fixture.supabase.co', SUPABASE_SECRET_KEY:'sb_secret_fixture', PLATFORM_OWNER_EMAIL:'platform@fixture.test' };
const vite = await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false,ws:false},plugins:[{name:'blocks-api-fixtures',enforce:'pre',resolveId(id){if(id==='cloudflare:workers')return '\0blocks-env';if(id.endsWith('/app/system-auth')||id.endsWith('/app/system-auth.js'))return '\0blocks-auth';},load(id){if(id==='\0blocks-env')return 'export const env=globalThis.__blocksRuntime';if(id==='\0blocks-auth')return 'export async function getFamaUser(){return globalThis.__blocksUser}';}}]});
const api = await vite.ssrLoadModule('/app/api/admin/blocks/route.js');
const bridge = await vite.ssrLoadModule('/app/api/internal/data/route.js');
let current, writes, reads, rate, outage, conflict, tamper;
const empty = () => ({overrides:{},revision:0,updatedAt:null});
beforeEach(() => {
  globalThis.__blocksUser = {id:'platform-owner',email:'platform@fixture.test',displayName:'Plataforma'};
  current = {global:empty(),organization:empty(),member:empty()}; writes=[]; reads=[]; rate=true; outage=false; conflict=false; tamper=false;
  globalThis.fetch = async(input,init={}) => {
    const url = new URL(String(input)); assert.equal(url.host,'fixture.supabase.co'); const body = init.body ? JSON.parse(init.body) : null;
    reads.push(url.pathname);
    if(url.pathname==='/rest/v1/rpc/fama_consume_rate_limit') return Response.json(rate);
    if(url.pathname==='/rest/v1/organizations') return Response.json(url.searchParams.get('id')==='eq.org-a'?[{id:'org-a',status:'active'}]:[]);
    if(url.pathname==='/rest/v1/organization_members') return Response.json(url.searchParams.get('id')==='eq.owner-a'&&url.searchParams.get('organization_id')==='eq.org-a'?[{id:'owner-a',organization_id:'org-a',role:'owner'}]:[]);
    if(url.pathname==='/rest/v1/rpc/fama_get_block_rules') return outage ? Response.json({message:'offline'},{status:503}) : Response.json(current);
    if(url.pathname==='/rest/v1/rpc/fama_save_block_rule') {
      writes.push(body); if(conflict || current[body.p_scope].revision!==body.p_revision) return Response.json(null);
      current[body.p_scope]={overrides:body.p_overrides,revision:body.p_revision+1,updatedAt:'2026-10-03T12:00:00Z'};
      return Response.json(tamper ? {...current,[body.p_scope]:{...current[body.p_scope],overrides:{}}}:current);
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  };
});
after(async()=>{globalThis.fetch=originalFetch;delete globalThis.__blocksRuntime;delete globalThis.__blocksUser;await vite.close();});
const post=(body,extra={})=>api.POST(new Request('https://control.fixture.test/api/admin/blocks',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://control.fixture.test',...extra},body:JSON.stringify(body)}));
const input=(scope='global',overrides={finance:false})=>({scope,organizationId:scope==='global'?'':'org-a',memberId:scope==='member'?'owner-a':'',revision:0,overrides});

test('anonymous visitors and company owners cannot read or write central block rules',async()=>{
  globalThis.__blocksUser=null;assert.equal((await post(input())).status,401);
  globalThis.__blocksUser={id:'owner-a',email:'company@fixture.test'};assert.equal((await api.GET(new Request('https://control.fixture.test/api/admin/blocks?scope=global'))).status,403);assert.equal((await post(input())).status,403);assert.deepEqual(reads,[]);assert.deepEqual(writes,[]);
});
test('global, company and owner-specific changes are confirmed with the platform actor and revision',async()=>{
  for(const scope of ['global','organization','member']) { const response=await post(input(scope));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);const saved=await response.json();assert.equal(saved.verified,true);assert.equal(saved.rules[scope].revision,1);assert.deepEqual(saved.rules[scope].overrides,{finance:false}); }
  assert.equal(writes.length,3);assert.ok(writes.every(write=>write.p_actor_user_id==='platform-owner'));
});
test('foreign members, deleted companies, arbitrary blocks and forged actors are rejected before persistence',async()=>{
  for(const payload of [{...input('member'),memberId:'foreign-member'}, {...input('organization'),organizationId:'missing'}, {...input(),organizationId:'org-a'}, {...input(),overrides:{unknown:true}}, {...input(),actorId:'forged'}, {...input(),revision:-1}]) assert.ok([400,404].includes((await post(payload)).status));
  assert.equal(writes.length,0);
});
test('foreign origins, non-JSON bodies, oversized requests and rate limits are rejected',async()=>{
  assert.equal((await post(input(),{Origin:'https://foreign.test'})).status,403);
  assert.equal((await post(input(),{'Content-Type':'text/plain'})).status,415);
  assert.equal((await post(input(),{'Content-Length':'7000'})).status,413);
  rate=false;assert.equal((await post(input())).status,429);assert.equal(writes.length,0);
});
test('concurrent edits do not overwrite newer rules and unconfirmed saves are not reported as success',async()=>{
  conflict=true;assert.equal((await post(input())).status,409);assert.equal(current.global.revision,0);
  conflict=false;tamper=true;assert.equal((await post(input())).status,502);
});
test('read outages do not return inherited defaults and the System bridge cannot save central rules',async()=>{
  outage=true;assert.equal((await api.GET(new Request('https://control.fixture.test/api/admin/blocks?scope=global'))).status,503);
  assert.equal(bridge.allowedDataPath('/rest/v1/rpc/fama_get_block_rules','POST'),true);
  assert.equal(bridge.allowedDataPath('/rest/v1/rpc/fama_save_block_rule'),false);
});
