import { database, optionalText } from "@/lib/database";
import { isPlanCode } from "@/lib/plans";
import { selectOne, updateRows, usesSupabase } from "@/lib/supabase";
import { requirePlatformAdmin, tenantError } from "@/lib/tenant";

const statuses = new Set(["active", "suspended", "deleted"]);
const planStatuses = new Set(["trial", "pending_payment", "active", "payment_attention", "expired", "cancelled"]);

async function ensureAdminBillingColumns() {
  if (usesSupabase()) return;
  const db = database();
  const info = await db.prepare("PRAGMA table_info(organizations)").all<{ name: string }>();
  const columns = new Set(info.results.map((entry) => entry.name));
  for (const [name, fallback] of [["plan", "inicial"], ["billing_cycle", "monthly"], ["pending_plan", ""], ["pending_billing_cycle", "monthly"]]) {
    if (!columns.has(name)) await db.prepare(`ALTER TABLE organizations ADD COLUMN ${name} TEXT NOT NULL DEFAULT '${fallback}'`).run();
  }
  if (!columns.has("plan")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan TEXT NOT NULL DEFAULT 'inicial'").run();
  if (!columns.has("plan_status")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'trial'").run();
  if (!columns.has("plan_expires_at")) await db.prepare("ALTER TABLE organizations ADD COLUMN plan_expires_at TEXT NOT NULL DEFAULT ''").run();
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    await ensureAdminBillingColumns();
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const status = optionalText(body.status);
    const plan = optionalText(body.plan);
    const planStatus = optionalText(body.planStatus);
    let planExpiresAt = optionalText(body.planExpiresAt);
    if (status && !statuses.has(status)) return Response.json({ error: "Situação inválida." }, { status: 400 });
    if (plan && !isPlanCode(plan)) return Response.json({ error: "Plano inválido." }, { status: 400 });
    if (planStatus && !planStatuses.has(planStatus)) return Response.json({ error: "Situação do plano inválida." }, { status: 400 });
    if (!status && !plan && !planStatus && !("planExpiresAt" in body)) return Response.json({ error: "Informe o que deseja atualizar." }, { status: 400 });
    const now = new Date().toISOString();
    if (planExpiresAt && !Number.isFinite(Date.parse(planExpiresAt))) return Response.json({ error: "Informe uma validade de plano válida." }, { status: 400 });
    const current = planStatus === "active"
      ? usesSupabase()
        ? await selectOne<Record<string, unknown>>("organizations", { id })
        : await database().prepare("SELECT plan, plan_status, plan_expires_at, pending_plan, pending_billing_cycle FROM organizations WHERE id = ?").bind(id).first<Record<string, unknown>>()
      : null;
    const pendingPlan = String(current?.pending_plan ?? "");
    const applyPending = ["inicial", "intermediario", "profissional"].includes(pendingPlan);
    const pendingCycle = String(current?.pending_billing_cycle ?? "monthly");
    const cycleMonths: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
    const billingCycle = Object.hasOwn(cycleMonths, pendingCycle) ? pendingCycle : "monthly";
    if (planStatus === "active" && !("planExpiresAt" in body)) {
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
      const update: Record<string, unknown> = { updated_at: now };
      if (status) {
        update.status = status;
        update.deleted_at = status === "deleted" ? now : null;
      }
      if (plan) update.plan = plan;
      if (planStatus) update.plan_status = planStatus;
      if (applyPending) Object.assign(update, { plan: pendingPlan, billing_cycle: billingCycle, pending_plan: "", pending_billing_cycle: "monthly" });
      if ("planExpiresAt" in body || planStatus === "active") update.plan_expires_at = planExpiresAt;
      const result = await updateRows("organizations", update, { id });
      if (!result.length) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
      return Response.json({ updated: true, id, status, plan, planStatus, planExpiresAt });
    }
    const db = database();
    const updates: string[] = ["updated_at = ?"];
    const bindings: unknown[] = [now];
    if (status) {
      updates.push("status = ?");
      bindings.push(status);
    }
    if (plan) {
      updates.push("plan = ?");
      bindings.push(plan);
    }
    if (planStatus) {
      updates.push("plan_status = ?");
      bindings.push(planStatus);
    }
    if ("planExpiresAt" in body || planStatus === "active") {
      updates.push("plan_expires_at = ?");
      bindings.push(planExpiresAt);
    }
    if (applyPending) {
      updates.push("plan = ?", "billing_cycle = ?", "pending_plan = ''", "pending_billing_cycle = 'monthly'");
      bindings.push(pendingPlan, billingCycle);
    }
    const result = await db.prepare(`UPDATE organizations SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings, id).run();
    if (!result.meta.changes) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
    return Response.json({ updated: true, id, status, plan, planStatus, planExpiresAt });
  } catch (error) {
    return tenantError(error, "Não foi possível atualizar a empresa.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    if (usesSupabase()) {
      const organization = await selectOne<Record<string, unknown>>("organizations", { id }, { select: "id" });
      if (!organization) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
      await updateRows("organizations", { status: "deleted", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { id });
      return Response.json({ deleted: true, recoverable: true, id });
    }
    const db = database();
    const organization = await db.prepare("SELECT id FROM organizations WHERE id = ?").bind(id).first<{ id: string }>();
    if (!organization) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });

    await db.prepare("UPDATE organizations SET status = 'suspended', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    return Response.json({ deleted: true, recoverable: true, id });
  } catch (error) {
    return tenantError(error, "Não foi possível excluir a empresa.");
  }
}
