import vinext from "vinext";
import { defineConfig } from "vite";

const PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";
const workerName = process.env.CLOUDFLARE_WORKER_NAME || "fama-system";
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || PLACEHOLDER_DATABASE_ID;
const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME || "fama-system";
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  name: workerName,
  main: "./worker/index.js",
  compatibility_date: "2026-09-10",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [
    {
      binding: "DB",
      database_name: databaseName,
      database_id: databaseId,
    },
  ],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
