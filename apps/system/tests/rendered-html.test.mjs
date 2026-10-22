import assert from "node:assert/strict";
import test, { before, after } from "node:test";

const originalFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "https://control.famasystem.online/api/public/plans");
    return Response.json({ plans: [] });
  };
});
after(() => { globalThis.fetch = originalFetch; });

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

function visibleHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<meta[^>]*>/gi, "");
}

test("renders production branding without development metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /Fama System/);
  assert.doesNotMatch(html, developmentPreviewMeta);
});

test("renders public plans with free-trial-first links", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-plans`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/planos", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Começar teste grátis/);
  assert.match(html, /href="\/entrar\?signup=1&amp;plan=inicial"/);
  assert.match(html, /href="\/entrar\?signup=1&amp;plan=profissional"/);
  assert.match(html, /Pagar agora sem teste/);
  assert.match(visibleHtml(html), /R\$\s*99,00/);
  assert.match(visibleHtml(html), /R\$\s*199,00/);
  assert.match(visibleHtml(html), /R\$\s*350,00/);
  assert.match(visibleHtml(html), /\(61\) 99138-8546/);
  assert.match(visibleHtml(html), /sempre com aviso prévio/);
  assert.match(html, /href="https:\/\/wa\.me\/5561991388546\?text=/);
  assert.doesNotMatch(visibleHtml(html), /\b(undefined|null|NaN)\b/);
});

test("renders public checkout as optional payment after trial", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-checkout`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/assinar/profissional", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Comece sem pagar agora/);
  assert.match(html, /Pagar agora sem usar o teste grátis/);
  assert.match(html, /CPF\/CNPJ do pagador/);
  assert.match(html, /<input(?=[^>]*\bname="buyerDocument")(?=[^>]*\brequired="")[^>]*>/);
  assert.match(html, /R\$\s*350,00/);
  assert.match(visibleHtml(html), /sempre com aviso prévio/);
  assert.match(visibleHtml(html), /\(61\) 99138-8546/);
  assert.doesNotMatch(visibleHtml(html), /\b(undefined|null|NaN)\b/);
});
