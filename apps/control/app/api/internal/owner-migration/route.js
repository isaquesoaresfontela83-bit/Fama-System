import { env } from "cloudflare:workers";
import { database } from "@/lib/database";
import { readD1Backup } from "@/lib/d1-backup";
import { migrationAllowed, sealMigration } from "@/lib/migration-export";
const keys = ["ANTHROPIC_API_KEY","CLOUDFLARE_ACCOUNT_ID","DATA_BACKEND","FAMA_AI_CONNECTION_TEST_ENABLED","FAMA_AI_GENERATIVE_ENABLED","FAMA_AI_MAX_TOKENS","FAMA_AI_MODEL","FAMA_AI_PROVIDER","FAMA_AI_PYTHON_TOKEN","FAMA_AI_PYTHON_URL","FAMA_AI_TIMEOUT_MS","FAMA_ASAAS_API_KEY","FAMA_ASAAS_ENVIRONMENT","FAMA_ASAAS_WEBHOOK_TOKEN","FAMA_BACKUP_SERVICE_TOKEN","FAMA_DATA_BRIDGE_SECRET","FAMA_DATA_ENCRYPTION_KEY","FAMA_OPENROUTESERVICE_API_KEY","FAMA_POOL_BRIDGE_SECRET","FAMA_POOL_SITE_SERVICE_TOKEN","FAMA_POOL_WEBHOOK_TOKEN","FAMA_REMINDER_OWNER_ACCOUNT_EMAIL","FAMA_SESSION_SECRET","FIREBASE_SERVICE_ACCOUNT_JSON","FIREBASE_VAPID_KEY","FIREBASE_WEB_CONFIG","PLATFORM_OWNER_EMAIL","PLATFORM_OWNER_USER_ID","PLUGGY_CLIENT_ID","PLUGGY_CLIENT_SECRET","SUPABASE_AUTH_ENABLED","SUPABASE_PUBLISHABLE_KEY","SUPABASE_SECRET_KEY","SUPABASE_STORAGE_BUCKET","SUPABASE_URL"];
export async function POST(request) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!await migrationAllowed(request, env)) return Response.json({ error: "Acesso não autorizado." }, { status: 401, headers });
  try {
    const configuration = Object.fromEntries(keys.filter(key => typeof env[key] === "string" && env[key] !== "").map(key => [key, env[key]]));
    const snapshot = await readD1Backup();
    const supportingSchema = (await database().prepare("SELECT type,name,sql FROM sqlite_schema WHERE type IN ('index','trigger','view') AND sql IS NOT NULL ORDER BY type,name").all()).results;
    const payload = await sealMigration({ configuration, snapshot, supportingSchema, capturedAt: new Date().toISOString() }, JSON.parse(env.FAMA_MIGRATION_RECEIVER_JWK));
    return Response.json(payload, { headers });
  } catch { return Response.json({ error: "Não foi possível preparar a transferência." }, { status: 503, headers }); }
}
