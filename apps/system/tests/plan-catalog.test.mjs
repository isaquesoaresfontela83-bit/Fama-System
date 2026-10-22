import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';

const originalFetch = globalThis.fetch;
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ configFile: false, root, server: { middlewareMode: true, hmr: false, ws: false } });
const { getPlanCatalog, cyclePriceCents } = await vite.ssrLoadModule('/lib/plans.js');
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });

test('System follows edited Control prices, descriptions, limits and feature lines without stale cache', async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://control.famasystem.online/api/public/plans');
    assert.equal(options.cache, 'no-store');
    calls++;
    return Response.json({ plans: [{ id: 'profissional', name: 'Pro', price: calls === 1 ? 35000 : 36000, description: 'Descrição publicada pelo Control', users: 'Até 10 usuários', clients: 'Até 5.000 clientes', modules: 'Consulta de CEP\nFrete automático' }] });
  };
  const first = (await getPlanCatalog()).profissional;
  assert.equal(first.priceCents, 35000);
  assert.equal(first.description, 'Descrição publicada pelo Control');
  assert.deepEqual(first.limits, { users: 10, customers: 5000 });
  assert.deepEqual(first.highlights, ['Até 10 usuários', 'Até 5.000 clientes', 'Consulta de CEP', 'Frete automático']);
  assert.equal((await getPlanCatalog()).profissional.priceCents, 36000);
  assert.equal(cyclePriceCents(first.priceCents, 'quarterly'), 99750);
  assert.equal(cyclePriceCents(first.priceCents, 'semiannual'), 189000);
  assert.equal(cyclePriceCents(first.priceCents, 'annual'), 357000);
});

test('unavailable or invalid Control catalog keeps the approved prices and capacity', async () => {
  globalThis.fetch = async () => { throw new Error('Fixture offline'); };
  const plans = await getPlanCatalog();
  assert.deepEqual(Object.values(plans).map(plan => plan.priceCents), [9900, 19900, 35000]);
  assert.equal(plans.profissional.limits.users, 10);
  globalThis.fetch = async () => Response.json({ plans: [{ id: 'profissional', price: -1, users: '', clients: '' }, { id: 'unknown', price: 1 }] });
  assert.equal((await getPlanCatalog()).profissional.priceCents, 35000);
});

test('current fallback describes planning, barcode inventory and voice without moving paid modules', async () => {
  globalThis.fetch = async () => { throw new Error('Fixture offline'); };
  const catalog = await getPlanCatalog();
  assert.match(catalog.inicial.highlights.join('\n'), /clima/);
  assert.doesNotMatch(catalog.inicial.highlights.join('\n'), /Financeiro|Fama IA|Frete automático/);
  assert.match(catalog.intermediario.highlights.join('\n'), /código de barras/);
  assert.doesNotMatch(catalog.intermediario.highlights.join('\n'), /Fama IA|Frete automático/);
  assert.match(catalog.profissional.highlights.join('\n'), /Fama IA com voz/);
  globalThis.fetch = async () => Response.json({ plans: [{ id: 'profissional', modules: 'Preparação e arquivo de notas fiscais; emissão de NFS-e pela Asaas com configuração fiscal' }] });
  assert.equal((await getPlanCatalog()).profissional.highlights.length, 3);
});
