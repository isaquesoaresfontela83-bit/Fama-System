import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const sourcePath = new URL("../app/privacy-center.jsx", import.meta.url);
const source = await readFile(sourcePath, "utf8");

test("privacy center bounds API requests and exposes a retry after load failure", () => {
  assert.match(source, /AbortSignal\.timeout\(15_000\)/);
  assert.match(source, /cause\.name === "TimeoutError"/);
  assert.match(source, /setLoadError\(message\)/);
  assert.match(source, /role="alert"/);
  assert.match(source, /onClick=\{\(\) => void load\(\)\}/);
  assert.match(source, /Tentar novamente/);
});
