import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { disableVerification, verifiedFactors } from './flow.mjs';

const oldFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = oldFetch; });
const fixture = [{ id: 'factor-one-123', type: 'totp', status: 'verified', name: 'Celular' }];
function server({ factors = fixture, badCode = false, failDeleteAt = -1, changeOnVerify = false, unauthorized = false } = {}) {
 let current = structuredClone(factors), removed = 0;
 const calls = [];
 globalThis.fetch = async (path, init = {}) => {
  assert.equal(path, '/api/auth/mfa');
  assert.equal(init.credentials, 'same-origin');
  assert.equal(init.cache, 'no-store');
  if (unauthorized) return Response.json({ error: 'Faça login novamente.' }, { status: 401 });
  if (!init.method) { calls.push('GET'); return Response.json({ available: true, factors: current }); }
  const body = JSON.parse(init.body);
  calls.push(body.action + ':' + body.factorId);
  if (body.action === 'challenge') return Response.json({ challengeId: 'challenge-123' });
  if (body.action === 'verify') {
   if (badCode) return Response.json({ error: 'Código inválido.' }, { status: 400 });
   if (changeOnVerify) current.push({ id: 'factor-new-123', type: 'totp', status: 'verified' });
   return Response.json({ verified: true });
  }
  if (body.action === 'unenroll') {
   if (removed++ === failDeleteAt) return Response.json({ error: 'Falha ao remover.' }, { status: 503 });
   current = current.filter(factor => factor.id !== body.factorId);
   return Response.json({ removed: true });
  }
  throw Error('Unexpected request');
 };
 return { calls, remaining: () => current };
}

test('checks the current account, verifies a fresh code, removes all TOTP factors, then confirms status', async () => {
 const factors = [...fixture, { id: 'factor-two-456', type: 'totp', status: 'verified', name: 'Reserva' }];
 const mock = server({ factors });
 await disableVerification({ factors, factorId: factors[0].id, code: '123456' });
 assert.deepEqual(mock.calls, ['GET','challenge:factor-one-123','verify:factor-one-123','GET','unenroll:factor-one-123','unenroll:factor-two-456','GET']);
 assert.equal(mock.remaining().length, 0);
});

test('wrong code leaves all factors intact', async () => {
 const mock = server({ badCode: true });
 await assert.rejects(disableVerification({ factors: fixture, factorId: fixture[0].id, code: '000000' }), /Código inválido/);
 assert.equal(mock.calls.some(call => call.startsWith('unenroll:')), false);
 assert.equal(mock.remaining().length, 1);
});

test('missing session or a changed factor list cannot remove a factor', async () => {
 let mock = server({ unauthorized: true });
 await assert.rejects(disableVerification({ factors: fixture, factorId: fixture[0].id, code: '123456' }), /Faça login/);
 assert.equal(mock.calls.some(call => call.startsWith('unenroll:')), false);
 mock = server({ changeOnVerify: true });
 await assert.rejects(disableVerification({ factors: fixture, factorId: fixture[0].id, code: '123456' }), /autenticadores foram alterados/i);
 assert.equal(mock.calls.some(call => call.startsWith('unenroll:')), false);
});

test('unsupported methods and malformed input are rejected before any request', async () => {
 const mock = server();
 await assert.rejects(disableVerification({ factors: [{ ...fixture[0], type: 'phone' }], factorId: fixture[0].id, code: '123456' }), /método/);
 await assert.rejects(disableVerification({ factors: fixture, factorId: fixture[0].id, code: '12' }), /código/);
 assert.deepEqual(mock.calls, []);
});

test('partial failures are reported and do not pretend that verification is disabled', async () => {
 const factors = [...fixture, { id: 'factor-two-456', type: 'totp', status: 'verified', name: 'Reserva' }];
 const mock = server({ factors, failDeleteAt: 1 });
 await assert.rejects(disableVerification({ factors, factorId: factors[0].id, code: '123456' }), /não terminou como esperado/);
 assert.equal(mock.remaining().length, 1);
 assert.equal((await verifiedFactors()).length, 1);
});
