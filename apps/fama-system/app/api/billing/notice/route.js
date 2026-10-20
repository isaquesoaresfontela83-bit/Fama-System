import { requireTenant, tenantError } from "@/lib/tenant";
import { readPlanPolicyRecord } from "@/lib/plan-policy-server";
import { parsePlanPolicy } from "@/lib/plan-policy";
export async function GET(request) {
    try {
        await requireTenant(request);
        const policy = parsePlanPolicy((await readPlanPolicyRecord())?.value);
        const entry = policy?.pending ?? policy?.history.at(-1);
        return Response.json({ revision: policy?.revision ?? 0, notice: entry ? { text: "notice" in entry ? entry.notice : "", effectiveAt: entry.effectiveAt } : null }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (error) {
        return tenantError(error, "Não foi possível consultar os avisos do plano.");
    }
}
