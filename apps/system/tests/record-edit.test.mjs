import assert from "node:assert/strict";
import test, { beforeEach, after } from "node:test";
import { fileURLToPath } from "node:url";
import { operationalFixture } from "./operational-fixture.mjs";
const f = await operationalFixture(fileURLToPath(new URL("..", import.meta.url)));
const [route, crypto, fields] = await Promise.all(["/app/api/records/[id]/route.js", "/lib/crypto.js", "/lib/record-edit-fields.js"].map(f.load));
beforeEach(() => f.reset());
after(() => f.close());
const notes = JSON.stringify({ text: "Histórico anterior", details: { sourceQuoteId: "quote-original", completionReport: "preservar", duration: "1h30" } });
function row(table, values = {}) {
    const stored = { id: "record-one", organization_id: "org-one", updated_at: "2026-10-21T10:00:00Z", ...values };
    f.tables[table] = [stored];
    return stored;
}
async function edit(entity, expected, changes) {
    return route.PATCH(f.request("PATCH", "/api/records/record-one", { entity, action: "edit", expected, ...changes }), f.context("record-one"));
}
test("customer editing preserves identity, links and encrypted notes without inserting", async () => {
    row("customers", { name: "Ana", phone: "61999999999", email: "old@example.test", notes });
    const response = await edit("customers", { id: "record-one", name: "Ana", notes }, { name: "Ana Silva", phone: "61988888888", email: "new@example.test", notes: "Novo histórico", clientDocument: "12345678901", id: "forged", organizationId: "foreign" });
    assert.equal(response.status, 200);
    const { record } = await response.json();
    assert.equal(record.id, "record-one"); assert.equal(record.organizationId, "org-one"); assert.equal(record.phone, "61988888888");
    assert.equal(JSON.parse(record.notes).details.sourceQuoteId, "quote-original");
    assert.equal(JSON.parse(record.notes).details.completionReport, "preservar");
    assert.notEqual(f.tables.customers[0].phone, record.phone);
    assert.equal(f.businessWrites().filter(call => call.method === "POST").length, 0);
});
test("all remaining operational entities edit only their allowed fields", async () => {
    const cases = [
        ["leads", "leads", { name: "Ana", phone: "61", interest: "Piscina", status: "novo" }, { nextAction: "Ligar", estimatedValue: "699,00" }, "estimatedValueCents", 69900],
        ["appointments", "appointments", { title: "Visita", notes }, { kind: "Execução de serviço", startAt: "2026-10-22T09:30", notes: "Executar manutenção" }, "startAt", "2026-10-22T12:30:00.000Z"],
        ["workOrders", "work_orders", { status: "aberta", notes, amount_cents: 10000 }, { service: "Limpeza completa", ph: "7,2" }, "ph", 7.2],
        ["inventory", "inventory_items", { name: "Cloro", quantity: 3 }, { quantity: "5", minimumQuantity: "2", cost: "39,90" }, "costCents", 3990],
        ["transactions", "transactions", { description: "Serviço", status: "pendente" }, { amount: "100,01", dueDate: "2026-10-25" }, "amountCents", 10001],
        ["employees", "employees", { name: "Carlos", active: true }, { role: "Técnico", active: "false" }, "active", false],
        ["contracts", "contracts", { start_date: "2026-10-21", end_date: "2027-10-21", contract_number: "CTR-1" }, { monthly: "350", paymentDay: "15" }, "monthlyCents", 35000],
        ["warranties", "warranties", { purchase_date: "2026-10-21", expires_at: "2027-10-21", appointment_id: "appointment-original", warranty_number: "GAR-1" }, { item: "Bomba substituída", notes: "Cobertura atualizada" }, "appointmentId", "appointment-original"],
    ];
    for (const [entity, table, values, changes, key, expectedValue] of cases) {
        f.reset(); row(table, values);
        const response = await edit(entity, { id: "record-one" }, changes);
        assert.equal(response.status, 200, `${entity}: ${await response.clone().text()}`);
        const { record } = await response.json(); assert.equal(record[key], expectedValue, entity);
    }
});
test("edits reject foreign tenants, revoked permissions and stale form values", async () => {
    row("customers", { name: "Ana", organization_id: "other" });
    assert.equal((await edit("customers", { id: "record-one" }, { name: "Wrong" })).status, 404);
    f.reset(); row("customers", { name: "Updated" });
    assert.equal((await edit("customers", { id: "record-one", name: "Old" }, { name: "Overwrite" })).status, 409);
    f.member().role = "technician"; f.member().permissions = [];
    assert.equal((await edit("customers", { id: "record-one" }, { name: "No access" })).status, 403);
    assert.equal(f.businessWrites().length, 0);
});
test("concurrent changes between read and write return conflict", async () => {
    row("inventory_items", { name: "Cloro", quantity: 5 });
    f.beforeRequest = call => { if (call.method === "PATCH" && call.url.pathname.endsWith("/inventory_items")) f.tables.inventory_items[0].updated_at = "2026-10-21T11:00:00Z"; };
    assert.equal((await edit("inventory", { id: "record-one" }, { quantity: "9" })).status, 409);
    assert.equal(f.tables.inventory_items[0].quantity, 5);
});
test("invalid values cannot write or bypass the signed completion flow", async () => {
    row("work_orders", { status: "aberta", amount_cents: 10000, notes });
    for (const changes of [{ ph: "15" }, { ph: "abc" }, { amount: "-5" }])
        assert.equal((await edit("workOrders", { id: "record-one" }, changes)).status, 400);
    f.tables.work_orders[0].status = "concluida";
    assert.equal((await edit("workOrders", { id: "record-one" }, { service: "Modify signed report" })).status, 409);
    assert.equal(f.businessWrites().length, 0);
});
test("starting a service records the time once and preserves its source", async () => {
    row("work_orders", { status: "aberta", notes });
    const start = () => route.PATCH(f.request("PATCH", "/api/records/record-one", { entity: "workOrders", action: "start" }), f.context("record-one"));
    const first = await start(); assert.equal(first.status, 200);
    const { record } = await first.json(); assert.equal(record.status, "em_execucao");
    const details = JSON.parse(record.notes).details;
    assert.equal(details.sourceQuoteId, "quote-original"); assert.ok(details.executionStartedAt);
    assert.equal(details.executionStartedBy, "user-one");
    const second = await start(); assert.equal(second.status, 200);
    assert.equal(JSON.parse((await second.json()).record.notes).details.executionStartedAt, details.executionStartedAt);
    assert.equal(f.businessWrites().length, 1);
});
test("operators without finance permission can edit service details while costs stay protected", async () => {
    row("work_orders", { status: "aberta", amount_cents: 10000, service: "Limpeza", notes });
    f.member().role = "technician"; f.member().permissions = ["orders"];
    assert.equal((await edit("workOrders", { id: "record-one" }, { amount: "500" })).status, 403);
    assert.equal((await edit("workOrders", { id: "record-one" }, { productCost: "20" })).status, 403);
    assert.equal((await edit("workOrders", { id: "record-one" }, { service: "Limpeza revisada", amount: "100,00" })).status, 200);
});
test("form prefilling converts cents and Brasília time and retains quote lines", () => {
    const record = { id: "one", scheduledAt: "2026-10-22T12:30:00Z", amountCents: 69900, notes: JSON.stringify({ text: "Preservar", details: { duration: "1h30" } }) };
    const values = fields.recordEditFields("workOrders", record);
    assert.equal(values.scheduledAt, "2026-10-22T09:30"); assert.equal(values.amount, "699.00"); assert.equal(values.notes, "Preservar"); assert.equal(values.duration, "1h30");
});
test("quote editing recalculates trusted catalog prices and keeps references and status", async () => {
    row("quotes", { quote_number: "ORC-1", status: "aprovado", notes });
    const response = await edit("quotes", { id: "record-one", status: "aprovado" }, { clientName: "Ana Silva", poolItems: JSON.stringify([{ category: "Piscinas", name: "Piscina de concreto", dimensions: { length: "2", width: "3" }, totalCents: 1, unitPrice: 0.01 }]), labor: "100", travel: "50", discount: "20", urgency: "urgente", paymentMethod: "pix", installments: "1", cardRate: "0", notes: "Orçamento revisado" });
    assert.equal(response.status, 200, await response.clone().text());
    const { record } = await response.json();
    assert.equal(record.quoteNumber, "ORC-1"); assert.equal(record.status, "aprovado");
    assert.equal(record.materialsCents, 1332000); assert.equal(record.totalCents, 1479700);
    assert.equal(JSON.parse(record.notes).details.sourceQuoteId, "quote-original");
});
test("legacy quotes retain existing item descriptions while their editable totals recalculate", async () => {
    row("quotes", { quote_number: "ORC-old", service: "Manutenção avulsa", materials_cents: 10000, notes: "Observação antiga", status: "enviado" });
    const response = await edit("quotes", { id: "record-one" }, { clientName: "Ana", service: "Manutenção revisada", materials: "100", labor: "50", travel: "20", discount: "10", urgency: "normal", notes: "Preservado" });
    assert.equal(response.status, 200, await response.clone().text());
    const { record } = await response.json(); assert.equal(record.totalCents, 16000); assert.equal(record.status, "enviado"); assert.equal(record.service, "Manutenção revisada");
});
test("completed reports cannot be reopened through status or the execution action", async () => {
    row("work_orders", { status: "concluida", notes });
    for (const changes of [{ status: "aberta" }, { status: "em_execucao" }, { action: "start" }]) {
        const response = await route.PATCH(f.request("PATCH", "/api/records/record-one", { entity: "workOrders", ...changes }), f.context("record-one"));
        assert.equal(response.status, 409);
    }
    assert.equal(f.businessWrites().length, 0);
});
