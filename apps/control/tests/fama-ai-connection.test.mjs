import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ configFile: false, root, server: { middlewareMode: true, hmr: false, ws: false } });
after(() => vite.close());
const { assistantProviderStatus, parseAssistantConnectionStatus, assistantConnectionLabels } = await vite.ssrLoadModule('/lib/fama-ai-connection.js');

test('native connection has no provider credentials or activation requirements', () => {
  const ready=assistantProviderStatus(); assert.deepEqual(ready, { configured: true, state: 'ready', engine:'internal' });
  assert.doesNotMatch(JSON.stringify(ready), /key|token|OPENAI/i); assert.match(assistantConnectionLabels.ready.description, /próprio sistema/);
});

test('client refuses contradictory or malformed connection responses and keeps only public status fields', () => {
  for (const value of [null, [], true, {}, { configured: true }, { configured: 'true', state: 'ready' }, { configured: true, state: 'disabled' }, { configured: false, state: 'ready' }, { configured: true, state: 'invented' }]) {
    assert.throws(() => parseAssistantConnectionStatus(value), /indisponível/);
  }
  const value = parseAssistantConnectionStatus({ configured: true, state: 'ready', engine:'internal', secret: 'private-fixture' });
  assert.deepEqual(value, { configured: true, state: 'ready', engine:'internal' });
  assert.doesNotMatch(JSON.stringify(value), /private-fixture/);
});


test('Workers AI connection parsing strips unknown fields and refuses an invalid cloud state', () => {
  const input={configured:true,state:'ready',engine:'internal',cloud:{provider:'cloudflare',state:'ready',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',key:'secret-fixture'},secret:'private'};
  const result=parseAssistantConnectionStatus(input);
  assert.deepEqual(result.cloud,{provider:'cloudflare',state:'ready',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'});
  assert.doesNotMatch(JSON.stringify(result),/secret-fixture|private/);
  for(const cloud of [null,[],{provider:'unknown',state:'ready',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'},{provider:'cloudflare',state:'invented',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'},{provider:'cloudflare',state:'ready',model:'malformed'}])assert.throws(()=>parseAssistantConnectionStatus({...input,cloud}),/indisponível/);
});
