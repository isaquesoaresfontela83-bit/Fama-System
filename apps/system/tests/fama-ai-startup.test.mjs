import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const { FamaAiStartup } = await vite.ssrLoadModule('/app/fama-ai-startup.jsx');
const { defaultAssistantSettings } = await vite.ssrLoadModule('/lib/fama-ai-settings.js');
after(() => vite.close());
const props = { data: { appointments: [], transactions: [{ type: 'receita', status: 'pendente', amountCents: 987654321, dueDate: '2000-01-01' }] }, settings: defaultAssistantSettings, allowedSources: ['overview', 'agenda'], scopeLabel: 'Empresa autorizada', loading: false, onNavigate() {} };

test('opening overview shows authorized records and automatic preparation without exposing financial data', () => {
  const html = renderToStaticMarkup(React.createElement(FamaAiStartup, props));
  assert.match(html, /Resumo geral/); assert.match(html, /Agenda de hoje/); assert.match(html, /Empresa autorizada/);
  assert.match(html, /Preparação automática ao abrir/);
  assert.doesNotMatch(html, /A receber|9\.876\.543|Pendências financeiras/);
});

test('loading another company hides all previous values while the summary remains visible at the top', () => {
  const html = renderToStaticMarkup(React.createElement(FamaAiStartup, { ...props, allowedSources: ['overview', 'agenda', 'finance'], loading: true }));
  assert.match(html, /Carregando o resumo/);
  assert.doesNotMatch(html, /9\.876\.543|A receber|Agenda de hoje/);
});

test('disabled administrative setting prevents a startup summary from exposing records', () => {
  const html = renderToStaticMarkup(React.createElement(FamaAiStartup, { ...props, settings: { ...defaultAssistantSettings, enabled: false } }));
  assert.equal(html, '');
});
