import assert from "node:assert/strict";
import test from "node:test";
import { asaasMovement, parseAsaasEnvironment, validateAsaasKey } from "../lib/asaas.ts";

test("separa produção e sandbox", () => {
  assert.equal(parseAsaasEnvironment("production"), "production");
  assert.equal(parseAsaasEnvironment("sandbox"), "sandbox");
  assert.equal(parseAsaasEnvironment("outro"), "sandbox");
});

test("recusa chave do ambiente incorreto", () => {
  assert.throws(() => validateAsaasKey("$aact_prod_123456789012345678901234567890", "sandbox"));
  assert.doesNotThrow(() => validateAsaasKey("$aact_hmlg_123456789012345678901234567890", "sandbox"));
});

test("normaliza movimentação Asaas sem depender de tipos fechados", () => {
  assert.deepEqual(asaasMovement({ id: "txn_1", date: "2026-09-19", description: "Pix recebido", value: 125.45, type: "PIX_TRANSACTION_CREDIT" }), {
    providerTransactionId: "txn_1",
    postedAt: "2026-09-19",
    description: "Pix recebido",
    amountCents: 12545,
  });
  assert.equal(asaasMovement({ id: "", date: "2026-09-19", value: 10 }), null);
});
