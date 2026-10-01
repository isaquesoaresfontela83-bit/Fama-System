import { database, optionalText } from "@/lib/database";
import { camelizeRow, selectOne, selectRows, updateRows, usesSupabase } from "@/lib/supabase";
import { RequestError, requirePlatformAdmin, tenantError } from "@/lib/tenant";
import { companyNameKey, companyPlans } from "@/lib/admin-accounts";
import { logAudit } from "@/lib/security";
import { isTrustedMutation } from "@/lib/request-security";

const statuses = new Set(["active", "suspended", "deleted"]);
const planStatuses = new Set(["trial", "pending_payment", "active", "payment_attention", "expired", "cancelled"]);
const cycleMonths: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

async function ensureBillingColumns() {
  if (usesSupabase()) return;
  const db = database();
  const info = await db.prepare("PRAGMA table_info(organizations)").all<{ name: string }>();
  const columns = new Set(info.results.map((entry) => entry.name));
  for (const [name, fallback] of [["plan", "inicial"], ["billing_cycle", "monthly"], ["pending_plan", ""], ["pending_billing_cycle", "monthly"], ["billing_provider", ""], ["billing_payment_id", ""]]) {
    if (!columns.has(name)) await db.prepare(`ALTER TABLE organizations ADD COLUMN ${name} TEXT NOT NULL DEFAULT '${fallback}'`).run();
  }
  if (!columns.has("plan_status")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'trial'").run();
  if (!columns.has("plan_expires_at")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_expires_at TEXT NOT NULL DEFAULT ''").run();
  if (!columns.has("billing_enabled")) await db.prepare("ALTER TABLE organizations ADD COLUMN billing_enabled INTEGER NOT NULL DEFAULT 1").run();
  if (!columns.has("block_on_expiry")) await db.prepare("ALTER TABLE organizations ADD COLUMN block_on_expiry INTEGER NOT NULL DEFAULT 1").run();
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin();
    if (!isTrustedMutation(request)) throw new RequestError("Origem da solicitação inválida.", 403);
    await ensureBillingColumns();
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const current = usesSupabase()
      ? await selectOne<Record<string, unknown>>("organizations", { id })
      : await database().prepare("SELECT * FROM organizations WHERE id = ?").bind(id).first<Record<string, unknown>>();
    if (!current) throw new RequestError("Empresa não encontrada.", 404);
    if (body.action === "grantFreeAccess") Object.assign(body, { status: "active", plan: body.plan ?? "profissional", planStatus: "active", billingEnabled: false, blockOnExpiry: false, planExpiresAt: "" });
    const extra: Record<string, unknown> = {};
    if ("name" in body) {
      const name = String(body.name ?? "").trim(), nameKey = companyNameKey(name);
      if (name.length < 2 || name.length > 80 || nameKey.length < 2) throw new RequestError("O nome da empresa deve ter entre 2 e 80 caracteres.", 400);
      if (usesSupabase()) {
        const duplicates = await selectRows("organizations", { name_key: nameKey });
        if (duplicates.some(row => row.id !== id && row.status !== "deleted")) throw new RequestError("Já existe uma empresa com esse nome.", 409);
        extra.name_key = nameKey;
      }
      extra.name = name;
    }
    if ("plan" in body) {
      if (!companyPlans.includes(body.plan as typeof companyPlans[number])) throw new RequestError("Escolha um plano válido.", 400);
      extra.plan = body.plan;
    }
    if ("billingCycle" in body) {
      if (typeof body.billingCycle !== "string" || !Object.hasOwn(cycleMonths, body.billingCycle)) throw new RequestError("Escolha um ciclo de cobrança válido.", 400);
      extra.billing_cycle = body.billingCycle;
    }
    for (const key of ["billingEnabled", "blockOnExpiry"]) if (key in body && typeof body[key] !== "boolean") throw new RequestError("As opções de cobrança devem ser ativadas ou desativadas.", 400);
    const wasBillable = current.billing_enabled !== false && current.billing_enabled !== 0;
    const billingEnabled = "billingEnabled" in body ? body.billingEnabled === true : wasBillable;
    const wasBlocking = current.block_on_expiry !== false && current.block_on_expiry !== 0;
    const blockOnExpiry = billingEnabled && ("blockOnExpiry" in body ? body.blockOnExpiry === true : wasBlocking);
    if (!billingEnabled && body.blockOnExpiry === true) throw new RequestError("Habilite a mensalidade antes de ativar o bloqueio por vencimento.", 400);
    if ((!wasBillable && billingEnabled) || (!wasBlocking && blockOnExpiry)) {
      if (!body.planExpiresAt || !Number.isFinite(Date.parse(String(body.planExpiresAt)))) throw new RequestError("Defina o vencimento antes de ativar a mensalidade ou o bloqueio automático.", 400);
    }
    if ("billingEnabled" in body || "blockOnExpiry" in body) {
      extra.billing_enabled = billingEnabled; extra.block_on_expiry = blockOnExpiry;
      if (!billingEnabled) {
        Object.assign(extra, { plan_status: "active", plan_expires_at: "", pending_plan: "", pending_billing_cycle: "monthly" });
      } else if (!wasBillable) {
        extra.plan_status = "pending_payment";
        if (current.billing_provider === "courtesy") extra.billing_provider = "";
      }
    }
    const status = optionalText(body.status);
    const planStatus = optionalText(body.planStatus);
    let planExpiresAt = optionalText(body.planExpiresAt);
    if (status && !statuses.has(status)) return Response.json({ error: "Situação inválida." }, { status: 400 });
    if (planStatus && !planStatuses.has(planStatus)) return Response.json({ error: "Situação do plano inválida." }, { status: 400 });
    if (!status && !planStatus && !("planExpiresAt" in body) && !Object.keys(extra).length) return Response.json({ error: "Informe o que deseja atualizar." }, { status: 400 });
    const now = new Date().toISOString();
    if (planExpiresAt && !Number.isFinite(Date.parse(planExpiresAt))) return Response.json({ error: "Informe uma validade de plano válida." }, { status: 400 });
    const pendingPlan = String(current?.pending_plan ?? "");
    const applyPending = planStatus === "active" && !("plan" in body) && ["inicial", "intermediario", "profissional"].includes(pendingPlan);
    const pendingCycle = String(current?.pending_billing_cycle ?? "monthly");
    const billingCycle = Object.hasOwn(cycleMonths, pendingCycle) ? pendingCycle : "monthly";
    if (planStatus === "active" && !("planExpiresAt" in body) && current?.billing_provider === "courtesy") {
      planExpiresAt = String(current.plan_expires_at ?? "");
    } else if (planStatus === "active" && !("planExpiresAt" in body)) {
      const existingExpiry = Date.parse(String(current?.plan_expires_at ?? ""));
      const extendCurrent = applyPending && current?.plan === pendingPlan && current?.plan_status === "active" && Number.isFinite(existingExpiry) && existingExpiry > Date.now();
      const next = extendCurrent ? new Date(existingExpiry) : new Date();
      const day = next.getUTCDate();
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + (applyPending ? cycleMonths[billingCycle] : 1));
      const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(day, lastDay));
      planExpiresAt = next.toISOString();
    }
    if (usesSupabase()) {
      const update: Record<string, unknown> = { ...extra, updated_at: now };
      if (status) {
        update.status = status;
        update.deleted_at = status === "deleted" ? now : null;
      }
      if (planStatus) update.plan_status = planStatus;
      if (applyPending) Object.assign(update, { plan: pendingPlan, billing_cycle: billingCycle, pending_plan: "", pending_billing_cycle: "monthly" });
      if ("planExpiresAt" in body || planStatus === "active") update.plan_expires_at = planExpiresAt;
      if (!billingEnabled) { update.plan_expires_at = ""; update.plan_status = "active"; }
      const result = await updateRows("organizations", update, { id });
      if (!result.length) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
      const stored = await selectOne<Record<string, unknown>>("organizations", { id });
      if (!stored || Object.entries(update).some(([key, value]) => key !== "updated_at" && stored[key] !== value)) throw new RequestError("O banco não confirmou a alteração. Recarregue a lista para conferir os dados.", 409);
      await logAudit({ organizationId: id, actorUserId: admin.id, eventType: "security", entityType: "organizations", recordId: id, metadata: { action: "admin_company_edit", fields: Object.keys(update).filter(key => key !== "updated_at"), billingEnabled, blockOnExpiry } }).catch(() => console.warn("admin_company_edit_audit_unavailable"));
      return Response.json({ updated: true, verified: true, ...camelizeRow<Record<string, unknown>>(stored) });
    }
    const db = database();
    const updates: string[] = ["updated_at = ?"];
    const bindings: unknown[] = [now];
    for (const [key, value] of Object.entries(extra)) {
      if ((key === "plan_expires_at" && ("planExpiresAt" in body || planStatus === "active")) || (key === "plan_status" && planStatus)) continue;
      updates.push(`${key} = ?`); bindings.push(typeof value === "boolean" ? Number(value) : value);
    }
    if (status) {
      updates.push("status = ?");
      bindings.push(status);
    }
    if (planStatus) {
      updates.push("plan_status = ?");
      bindings.push(planStatus);
    }
    if ("planExpiresAt" in body || planStatus === "active") {
      updates.push("plan_expires_at = ?");
      bindings.push(billingEnabled ? planExpiresAt : "");
    }
    if (applyPending) {
      updates.push("plan = ?", "billing_cycle = ?", "pending_plan = ''", "pending_billing_cycle = 'monthly'");
      bindings.push(pendingPlan, billingCycle);
    }
    const result = await db.prepare(`UPDATE organizations SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings, id).run();
    if (!result.meta.changes) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
    return Response.json({ updated: true, verified: true, id, status, planStatus, planExpiresAt, billingEnabled, blockOnExpiry });
  } catch (error) {
    return tenantError(error, "Não foi possível atualizar a empresa.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    if (!isTrustedMutation(request)) throw new RequestError("Origem da solicitação inválida.", 403);
    const { id } = await context.params;
    if (usesSupabase()) {
      const organization = await selectOne<Record<string, unknown>>("organizations", { id }, { select: "id,status" });
      if (!organization) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
      await updateRows("organizations", { status: "deleted", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { id });
      return Response.json({ deleted: true, softDeleted: true, id });
    }
    const db = database();
    const organization = await db.prepare("SELECT id FROM organizations WHERE id = ?").bind(id).first<{ id: string }>();
    if (!organization) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });

    await db.prepare("UPDATE organizations SET status = ?, updated_at = ? WHERE id = ?").bind("suspended", new Date().toISOString(), id).run();
    return Response.json({ deleted: true, softDeleted: true, id });
  } catch (error) {
    return tenantError(error, "Não foi possível excluir a empresa.");
  }
}
