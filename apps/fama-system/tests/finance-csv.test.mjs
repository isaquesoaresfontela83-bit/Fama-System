import assert from "node:assert/strict";
import test from "node:test";
import { parseBankStatementCsv } from "../lib/bank-statement.ts";

test("imports a Brazilian semicolon-delimited statement with signed amounts", () => {
  const rows = parseBankStatementCsv("Data;Descrição;Valor\n13/09/2026;Pix recebido;1.234,56\n2026-09-12;Fornecedor; -42,10");
  assert.deepEqual(rows, [
    { postedAt: "2026-09-13", description: "Pix recebido", amountCents: 123456 },
    { postedAt: "2026-09-12", description: "Fornecedor", amountCents: -4210 },
  ]);
});

test("imports credit and debit columns and respects quoted delimiters", () => {
  const rows = parseBankStatementCsv('date,description,credit,debit\n2026-09-01,"Pix, recebido",125.50,\n2026-09-02,Fornecedor,,20.00');
  assert.deepEqual(rows.map((row) => row.amountCents), [12550, -2000]);
  assert.equal(rows[0].description, "Pix, recebido");
});

test("accepts US-formatted currency when the CSV delimiter is semicolon", () => {
  const rows = parseBankStatementCsv("date;description;amount\n2026-09-01;Sale;1,234.56");
  assert.equal(rows[0].amountCents, 123456);
});

test("rejects unknown headers, zero rows, and oversized imports", () => {
  assert.throws(() => parseBankStatementCsv("foo;bar\na;b"), /Cabeçalho não reconhecido/);
  assert.throws(() => parseBankStatementCsv("Data;Descrição;Valor\n2026-09-01;A;0"), /zerado/);
  assert.throws(() => parseBankStatementCsv(`Data,Descrição,Valor\n${"x".repeat(2_000_001)}`), /2 MB/);
});
