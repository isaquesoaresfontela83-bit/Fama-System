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
const { FamaAiResponse } = await vite.ssrLoadModule('/app/fama-ai-panel.tsx');
const { answerInternal } = await vite.ssrLoadModule('/lib/fama-ai.ts');


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

test('financial reply provides accessible chart values, next steps and source limits', () => {
  const answer = answerInternal('Fluxo de caixa', { transactions: [{ id: 'due', description: 'Compra', type: 'despesa', amountCents: 45000, status: 'pendente', dueDate: '2026-10-02' }] }, 'overview', new Date('2026-10-01T12:00'));
  const html = renderToStaticMarkup(React.createElement(FamaAiResponse, { answer, name: 'Fama IA', data: {}, onAsk() {} }));
  assert.match(html, /Entradas e saídas previstas/);
  assert.match(html, /<caption>/); assert.match(html, /<th>Saídas<\/th>/);
  assert.match(html, /450,00/); assert.match(html, /Próximos passos/);
  assert.match(html, /Marcar como conferido/); assert.match(html, /Não soma saldo bancário/);
  assert.doesNotMatch(html, /Conversa livre/);
});

test('prepared reply renders editable fields and a review action without an automatic save', () => {
  const answer = answerInternal('Criar despesa; descrição: Material; valor: 450,00', {}, 'overview', new Date('2026-10-01T12:00'));
  const html = renderToStaticMarkup(React.createElement(FamaAiResponse, { answer, name: 'Fama IA', data: {}, onAsk() {}, onAction() {} }));
  assert.match(html, /Revisar no sistema/); assert.match(html, /value="Material"/); assert.match(html, /value="450.00"/);
  assert.match(html, /só é criado quando você salva/);
  assert.doesNotMatch(html, /name="status"|Salvo com sucesso|Nenhum registro encontrado/);
});
