import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { hmr: false, middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("enforces the selected modules for administrators and other users", async () => {
  const {
    effectiveFeaturePermissions,
    hasFeaturePermission,
    normalizePermissions,
  } = await vite.ssrLoadModule("/lib/permissions.ts");

  assert.deepEqual(normalizePermissions(["crm", "crm", "invalid", "warranties"]), ["crm", "warranties"]);
  assert.equal(effectiveFeaturePermissions(null).length, 12);
  assert.equal(hasFeaturePermission("owner", [], "finance"), true);
  assert.equal(hasFeaturePermission("admin", ["crm", "warranties"], "crm"), true);
  assert.equal(hasFeaturePermission("admin", ["crm", "warranties"], "quotes"), false);
  assert.equal(hasFeaturePermission("member", [], "dashboard"), false);
  assert.equal(hasFeaturePermission("technician", ["agenda"], "agenda"), true);
});

test("rejects cross-origin browser mutations", async () => {
  const { isTrustedMutation } = await vite.ssrLoadModule("/lib/request-security.ts");

  assert.equal(isTrustedMutation(new Request("https://fama.example/api/records")), true);
  assert.equal(isTrustedMutation(new Request("https://fama.example/api/records", {
    method: "POST",
    headers: { origin: "https://fama.example", "sec-fetch-site": "same-origin" },
  })), true);
  assert.equal(isTrustedMutation(new Request("https://fama.example/api/records", {
    method: "POST",
    headers: { origin: "https://attacker.example" },
  })), false);
  assert.equal(isTrustedMutation(new Request("https://fama.example/api/records", {
    method: "DELETE",
    headers: { "sec-fetch-site": "cross-site" },
  })), false);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});
