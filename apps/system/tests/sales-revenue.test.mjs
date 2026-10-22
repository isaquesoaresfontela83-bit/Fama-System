import test from "node:test";
import assert from "node:assert/strict";
import { saleRevenueForWorkOrder } from "../lib/sales-revenue.js";
test("creates pending revenue in the Brazil calendar month", () => {
    const entry = saleRevenueForWorkOrder({ id: "os-1", osNumber: "1", service: "Limpeza", clientName: "Cliente", amountCents: 12500, createdAt: "2026-10-01T02:30:00.000Z", notes: "" });
    assert.equal(entry.id, "auto-sale:workOrder:os-1");
    assert.equal(entry.type, "receita");
    assert.equal(entry.status, "pendente");
    assert.equal(entry.amountCents, 12500);
    assert.equal(entry.dueDate, "2026-09-30");
});
test("uses quote identity on conversion and skips free work orders", () => {
    const order = { id: "os-2", osNumber: "2", service: "Reparo", clientName: "Cliente", amountCents: 9000, createdAt: "2026-10-22T12:00:00.000Z", notes: JSON.stringify({ details: { sourceQuoteId: "quote-7" } }) };
    assert.equal(saleRevenueForWorkOrder(order).id, "auto-sale:quote:quote-7");
    assert.equal(saleRevenueForWorkOrder({ ...order, amountCents: 0 }), null);
});
