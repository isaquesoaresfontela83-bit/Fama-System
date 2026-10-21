import { requirePlatformAdmin, tenantError } from "@/lib/tenant";
import { camelizeRow, selectRows, usesSupabase } from "@/lib/supabase";
import { database } from "@/lib/database";
import { commercialMetrics } from "@/lib/commercial-metrics";
import { parsePlanPolicy, effectivePlans } from "@/lib/plan-policy";
import { readPlanPolicyRecord } from "@/lib/plan-policy-server";
import { defaultPlanCatalog } from "@/lib/plan-catalog";
export async function GET(request) {
    try {
        await requirePlatformAdmin();
        const raw = Number(new URL(request.url).searchParams.get("days") ?? 30);
        const days = [30, 90, 365].includes(raw) ? raw : 30;
        const [companies, events, policyRow] = await Promise.all([
            usesSupabase() ? selectRows("organizations") : database().prepare("SELECT * FROM organizations").all().then(result => result.results),
            usesSupabase() ? selectRows("fama_subscription_events", {}, { order: "occurred_at.asc" }) : Promise.resolve([]),
            readPlanPolicyRecord(),
        ]);
        const policy = parsePlanPolicy(policyRow?.value);
        const plans = policy ? effectivePlans(policy) : defaultPlanCatalog;
        return Response.json({ metrics: commercialMetrics(companies.map(row => camelizeRow(row)), plans, events, Date.now(), days), plans, days, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (error) {
        return tenantError(error, "Não foi possível consultar os indicadores comerciais.");
    }
}
