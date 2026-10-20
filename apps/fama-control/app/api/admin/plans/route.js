import { database } from "@/lib/database";
import { selectOne, selectRows, insertRow, updateRows, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError, RequestError } from "@/lib/tenant";
import { applyPlanCatalogRelease } from "@/lib/plan-catalog-release";
import { defaultPlanCatalog } from "@/lib/plan-catalog";
import { defaultPlanPolicy, effectivePlans, normalizePolicyPlans, parsePlanPolicy, planPolicyKey } from "@/lib/plan-policy";
import { isTrustedMutation } from "@/lib/request-security";
import { assertRateLimit } from "@/lib/security";
import { readJsonObject } from "@/lib/request-body";
async function loadPolicy() {
    const db = database();
    await applyPlanCatalogRelease(db).catch(error => { if (!usesSupabase())
        throw error; });
    const row = usesSupabase() ? await selectOne("platform_settings", { key: planPolicyKey }) : await db.prepare("SELECT value, updated_at FROM platform_settings WHERE key = ?").bind(planPolicyKey).first();
    let policy = parsePlanPolicy(row?.value);
    if (!policy) {
        let old = null;
        try {
            old = await db.prepare("SELECT value FROM platform_settings WHERE key = 'plan_catalog'").first();
        }
        catch (error) {
            if (!usesSupabase())
                throw error;
        }
        let plans = defaultPlanCatalog;
        try {
            const parsed = JSON.parse(old?.value ?? "null");
            if (Array.isArray(parsed) && parsed.length === 3)
                plans = parsed;
        }
        catch { /* Use the verified catalog. */ }
        policy = defaultPlanPolicy(plans);
    }
    return { policy, row };
}
export async function GET() {
    try {
        await requirePlatformAdmin();
        const { policy } = await loadPolicy();
        const customers = usesSupabase() ? await selectRows("customers", {}, { select: "id,organization_id" }) : [];
        const customerCounts = {};
        for (const customer of customers) {
            const id = String(customer.organization_id);
            customerCounts[id] = (customerCounts[id] ?? 0) + 1;
        }
        return Response.json({ plans: effectivePlans(policy), policy, customerCounts }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (error) {
        return tenantError(error, "Não foi possível carregar os planos.");
    }
}
export async function PATCH(request) {
    try {
        const user = await requirePlatformAdmin();
        if (!isTrustedMutation(request))
            throw new RequestError("Origem da solicitação inválida.", 403);
        await assertRateLimit(request, "plan_policy", user.id, 20, 60);
        const body = await readJsonObject(request);
        let plans;
        try {
            plans = normalizePolicyPlans(body.plans);
        }
        catch (error) {
            throw new RequestError(error instanceof Error ? error.message : "Planos inválidos.", 400);
        }
        const { policy, row } = await loadPolicy();
        if (body.expectedRevision !== undefined && body.expectedRevision !== policy.revision)
            throw new RequestError("Outra alteração foi salva. Atualize os planos antes de editar.", 409);
        const now = new Date().toISOString(), notice = String(body.notice ?? "").trim().slice(0, 2000);
        const requested = String(body.effectiveAt ?? "");
        if (requested && (!Number.isFinite(Date.parse(requested)) || Date.parse(requested) <= Date.now()))
            throw new RequestError("Escolha uma data futura para agendar.", 400);
        if (requested && !notice)
            throw new RequestError("Descreva o aviso aos clientes para a alteração agendada.", 400);
        const effectiveAt = requested || now;
        const next = { revision: policy.revision + 1, current: requested ? effectivePlans(policy) : plans, pending: requested ? { plans, effectiveAt, notice } : null, history: [...policy.history, { revision: policy.revision + 1, savedAt: now, effectiveAt, notice }].slice(-100) };
        if (usesSupabase()) {
            if (row) {
                const changed = await updateRows("platform_settings", { value: next, updated_at: now, updated_by: user.id }, { key: planPolicyKey, updated_at: String(row.updated_at) });
                if (!changed.length)
                    throw new RequestError("Outra alteração foi salva. Atualize e tente novamente.", 409);
            }
            else {
                try {
                    await insertRow("platform_settings", { key: planPolicyKey, value: next, updated_at: now, updated_by: user.id });
                }
                catch (error) {
                    if (error && typeof error === "object" && "code" in error && error.code === "23505")
                        throw new RequestError("Outra alteração foi salva. Atualize e tente novamente.", 409);
                    throw error;
                }
            }
        }
        else {
            await database().prepare("INSERT INTO platform_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(planPolicyKey, JSON.stringify(next), now).run();
        }
        return Response.json({ plans: effectivePlans(next), policy: next });
    }
    catch (error) {
        return tenantError(error, "Não foi possível salvar os planos.");
    }
}
