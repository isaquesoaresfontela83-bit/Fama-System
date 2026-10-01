import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
after(() => vite.close());
const { FamaAiPanel } = await vite.ssrLoadModule('/app/fama-ai-panel.tsx');
const { defaultAssistantSettings } = await vite.ssrLoadModule('/lib/fama-ai-settings.ts');

test('workspace renders accessible module choices and hides restricted indicators and prompts', () => {
  const html = renderToStaticMarkup(React.createElement(FamaAiPanel, {
    data: { appointments: [], transactions: [{ description: 'Informação restrita', type: 'receita', status: 'pendente', amountCents: 987654321 }] },
    allowedSources: ['overview', 'agenda'], scopeLabel: 'Empresa autorizada',
  }));
  assert.match(html, /Empresa autorizada/);
  assert.match(html, /aria-label="Módulos da assistente"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Agenda de hoje/);
  assert.match(html, /Sua pergunta para a Fama IA/);
  assert.doesNotMatch(html, /Informação restrita|9\.876\.543|O que está em atraso|A receber/);
  assert.match(html, /<option value="agenda">Agenda<\/option>/);
  assert.doesNotMatch(html, /<option value="finance">/);
});

test('disabled assistant reveals no record values and disables the composer', () => {
  const html = renderToStaticMarkup(React.createElement(FamaAiPanel, {
    data: { organizations: [{ name: 'Registro restrito', status: 'suspended' }] }, settings: { ...defaultAssistantSettings, enabled: false },
  }));
  assert.match(html, /Assistente pausada/);
  assert.match(html, /<textarea[^>]*disabled=""/);
  assert.doesNotMatch(html, /Registro restrito|Empresas cadastradas|Empresas suspensas/);
});
