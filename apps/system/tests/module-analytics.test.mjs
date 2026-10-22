import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { operationalFixture } from './operational-fixture.mjs';
const fixture = await operationalFixture(new URL('../', import.meta.url).pathname);
const { moduleCharts, chartsForSection, analyticsSections, analyticsRequestsFor } = await fixture.load('/lib/module-analytics.js');
after(fixture.close);
const empty = () => Object.fromEntries(['leads', 'quotes', 'appointments', 'workOrders', 'customers', 'inventory', 'transactions', 'employees', 'warranties', 'contracts'].map(key => [key, []]));
const all = [...Object.keys(analyticsSections), 'management', 'charts'];
test('every authorized tab has a chart, and the central library contains those same definitions', () => {
    const charts = moduleCharts(empty(), '', '', all);
    for (const section of all) {
        const selected = chartsForSection(charts, section);
        assert.ok(selected.length > 0, section);
        assert.ok(selected.every(chart => chartsForSection(charts, 'charts').includes(chart)), section);
    }
    for (const tab of ['visao', 'contas', 'cobrancas', 'notas', 'asaas', 'bancos', 'compras']) assert.equal(chartsForSection(charts, 'finance', tab).length, 1, tab);
    assert.equal(new Set(charts.map(chart => chart.id)).size, charts.length);
    assert.equal(chartsForSection(charts, 'dashboard').length, 6);
});
test('restricted access cannot expose financial, member, chat or operational values', () => {
    const data = empty();
    data.transactions = [{ amountCents: 998877, type: 'receita', status: 'pago', dueDate: '2026-10-20' }];
    data.workOrders = [{ status: 'aberta', technician: 'Private name', scheduledAt: '2026-10-20' }];
    const charts = moduleCharts(data, '', '', ['dashboard', 'charts', 'manual']);
    assert.ok(charts.every(chart => ['dashboard', 'manual'].includes(chart.section)));
    assert.ok(charts.every(chart => chart.unit === 'count'));
    assert.deepEqual(analyticsRequestsFor('charts', ['dashboard', 'charts']), []);
    assert.deepEqual(analyticsRequestsFor('privacy', ['privacy', 'finance', 'members']), ['privacy']);
    assert.equal(chartsForSection(charts, 'dashboard').length, 1);
});
test('weekday totals use the São Paulo date, period boundaries and the complete selected population', () => {
    const data = empty();
    data.appointments = [{ startAt: '2026-10-20T01:00:00Z' }, { startAt: '2026-10-20T13:00:00Z' }, { startAt: '2026-09-20T13:00:00Z' }];
    const chart = moduleCharts(data, '2026-10-01', '2026-10-31', ['agenda', 'planning']).find(chart => chart.id === 'planning-weekdays');
    assert.equal(chart.points.find(point => point.name === 'Seg').value, 1);
    assert.equal(chart.points.find(point => point.name === 'Ter').value, 1);
    assert.equal(chart.points.reduce((sum, point) => sum + point.value, 0), 2);
});
test('auxiliary errors are distinguished from empty data; invoice and purchase periods use their own dates', () => {
    const context = { finance: { status: 'ready', data: { fiscalInvoices: [{ status: 'emitida', issueDate: '2026-10-02' }, { status: 'rascunho', issueDate: '2026-09-01' }], purchases: [{ status: 'pago', purchaseDate: '2026-10-10' }], bankMovements: [] } }, members: { status: 'error' }, support: { status: 'ready', data: { tickets: [] } } };
    const charts = moduleCharts(empty(), '2026-10-01', '2026-10-31', all, 0, context);
    assert.deepEqual(charts.find(chart => chart.id === 'invoice-status').points, [{ name: 'Emitida', value: 1 }]);
    assert.deepEqual(charts.find(chart => chart.id === 'purchase-status').points, [{ name: 'Pago', value: 1 }]);
    assert.equal(charts.find(chart => chart.id === 'member-roles').state, 'error');
    assert.equal(charts.find(chart => chart.id === 'support-status').state, 'ready');
    assert.deepEqual(charts.find(chart => chart.id === 'support-status').points, []);
    assert.equal(charts.find(chart => chart.id === 'chat-threads').state, 'loading');
});
test('snapshot charts retain all records regardless of date filters and never include hidden sources', () => {
    const data = empty(); data.contracts = [{ status: 'ativo' }, { status: 'ativo' }]; data.employees = [{ active: true }, { active: false }];
    const charts = moduleCharts(data, '2099-01-01', '2099-01-02', ['contracts', 'team', 'assistant']);
    assert.deepEqual(charts.find(chart => chart.id === 'contract-status').points, [{ name: 'Ativo', value: 2 }]);
    assert.deepEqual(charts.find(chart => chart.id === 'team-availability').points.map(point => point.value), [1, 1]);
    assert.deepEqual(charts.find(chart => chart.id === 'assistant-sources').points.map(point => point.name).sort(), ['Contratos', 'Equipe']);
});
