import { env } from "cloudflare:workers";
import { signInWithPassword, supabaseAuthRequest, AuthRequestError } from "@/app/chatgpt-auth";
import { companyNameKey, removeCreatedAccount } from "@/lib/admin-accounts";
import { deleteRows, selectOne, selectRows, updateRows } from "@/lib/supabase";
import { logAudit } from "@/lib/security";
import { RequestError } from "@/lib/tenant";
import { POST as createCompany } from "@/app/api/admin/organizations/route";
import { PATCH as changeCompany } from "@/app/api/admin/organizations/[id]/route";
import { POST as createMember } from "@/app/api/admin/organizations/[id]/members/route";
import { PATCH as changeMember } from "@/app/api/admin/members/[id]/route";

const SYSTEM_ORIGIN = "https://fama-system.isaquesoaresfontela8.chatgpt.site";
const ENTITY = "access_validation";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stages = ["start", "members", "access", "cleanup"] as const;
export type ValidationStage = typeof stages[number];
export type ValidationCheck = { id: string; label: string; passed: boolean };
export type ValidationRun = {
  runId: string; organizationId: string; companyName: string; actorId: string;
  stage: ValidationStage; checks: ValidationCheck[]; cleaned: boolean;
  failed: boolean; error?: string; checkedAt: string;
};

function email(runId: string, person: "owner" | "member") {
  return `fama-validation-${runId}-${person}@example.com`;
}

// Test credentials stay in server memory. Neither the browser nor the audit
// receives passwords, session cookies, access tokens or privileged API keys.
async function password(runId: string, person: "owner" | "member") {
  const secret = String((env as unknown as { FAMA_DATA_ENCRYPTION_KEY?: string }).FAMA_DATA_ENCRYPTION_KEY ?? "");
  if (secret.length < 32) throw new RequestError("Configure a proteção de dados antes de validar contas temporárias.", 503);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`fama-access-validation:${runId}:${person}`));
  return `Aa1!${Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function readValidation(actorId: string, runId?: string) {
  if (runId && !UUID.test(runId)) throw new RequestError("Validação inválida.", 400);
  const rows = await selectRows<Record<string, unknown>>("audit_logs", {
    actor_user_id: actorId, entity_type: ENTITY, ...(runId ? { record_id: runId } : {}),
  }, { order: "occurred_at.desc", limit: 1 });
  const run = rows[0]?.metadata as ValidationRun | undefined;
  if (!run || run.actorId !== actorId || !UUID.test(run.runId)) return null;
  return run;
}

async function save(run: ValidationRun) {
  run.checkedAt = new Date().toISOString();
  await logAudit({ actorUserId: run.actorId, eventType: "security", entityType: ENTITY, recordId: run.runId, metadata: { ...run } });
}

function check(run: ValidationRun, id: string, label: string, passed: boolean) {
  run.checks.push({ id, label, passed });
  if (!passed) throw new RequestError(`A validação de “${label}” não foi confirmada.`, 502);
}

function mutation(parent: Request, path: string, method: string, body: Record<string, unknown>) {
  const url = new URL(path, parent.url);
  return new Request(url, { method, headers: { "Content-Type": "application/json", Origin: url.origin }, body: JSON.stringify(body) });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

async function companyPatch(parent: Request, run: ValidationRun, values: Record<string, unknown>) {
  const response = await changeCompany(mutation(parent, `/api/admin/organizations/${run.organizationId}`, "PATCH", values), context(run.organizationId));
  if (!response.ok) throw new RequestError(`A atualização da empresa de teste retornou HTTP ${response.status}.`, 502);
  return response.json() as Promise<Record<string, unknown>>;
}

async function memberPatch(parent: Request, id: string, values: Record<string, unknown>) {
  return changeMember(mutation(parent, `/api/admin/members/${id}`, "PATCH", values), context(id));
}

type TestSession = { cookie: string; accessToken: string };
async function login(run: ValidationRun, person: "owner" | "member"): Promise<TestSession> {
  const response = await fetch(`${SYSTEM_ORIGIN}/api/auth/login`, {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", Origin: SYSTEM_ORIGIN },
    body: JSON.stringify({ email: email(run.runId, person), password: await password(run.runId, person), company: run.companyName }),
  });
  const payload = await response.json().catch(() => ({})) as { authenticated?: boolean };
  if (!response.ok || !payload.authenticated) throw new RequestError(`O login da conta de teste retornou HTTP ${response.status}.`, 502);
  const cookieHeaders = response.headers.getSetCookie();
  const entries = cookieHeaders.flatMap(value => value.split(/,(?=\s*__Host-)/)).map(value => value.trim().split(";")[0]);
  const access = entries.find(value => value.startsWith("__Host-fama-access="));
  if (!access) throw new RequestError("O Fama System não confirmou a sessão da conta de teste.", 502);
  return { cookie: entries.filter(value => value.startsWith("__Host-fama-access=") || value.startsWith("__Host-fama-refresh=")).join("; "), accessToken: access.slice("__Host-fama-access=".length) };
}

async function system(session: TestSession, run: ValidationRun, path: string, body?: Record<string, unknown>, organizationId = run.organizationId) {
  return fetch(`${SYSTEM_ORIGIN}${path}`, {
    method: body ? "POST" : "GET", redirect: "manual", signal: AbortSignal.timeout(20000),
    headers: { Cookie: session.cookie, "x-organization-id": organizationId, Origin: SYSTEM_ORIGIN, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function logout(session: TestSession) {
  await supabaseAuthRequest("/auth/v1/logout?scope=global", { method: "POST" }, session.accessToken);
}

async function temporaryCompany(run: ValidationRun) {
  const row = await selectOne<Record<string, unknown>>("organizations", { id: run.organizationId });
  if (!row) return null;
  const baseName = `Fama Validação ${run.runId}`;
  if (![baseName, `${baseName} Editada`].includes(String(row.name)) || row.billing_payment_id || row.billing_customer_id) {
    throw new RequestError("A remoção foi interrompida: a empresa não corresponde ao cadastro descartável desta validação.", 409);
  }
  const created = await selectOne("audit_logs", { organization_id: run.organizationId, actor_user_id: run.actorId, entity_type: "company_created", record_id: run.organizationId });
  if (!created) throw new RequestError("O proprietário não corresponde ao responsável por esta validação.", 409);
  run.companyName = String(row.name);
  return row;
}

async function cleanup(run: ValidationRun) {
  const row = run.organizationId ? await temporaryCompany(run) : null;
  if (row) {
    const members = await selectRows<Record<string, unknown>>("organization_members", { organization_id: run.organizationId });
    const allowedEmails = [email(run.runId, "owner"), email(run.runId, "member")];
    for (const member of members) {
      if (!allowedEmails.includes(String(member.user_email)) || !UUID.test(String(member.user_id))) throw new RequestError("Uma conta externa foi encontrada na empresa de teste. A remoção automática foi interrompida.", 409);
      const links = await selectRows("organization_members", { user_id: String(member.user_id) });
      if (links.some(link => link.organization_id !== run.organizationId)) throw new RequestError("Uma conta de teste possui outro vínculo. A remoção automática foi interrompida.", 409);
    }
    // Revoke access through current membership before removing Auth identities.
    await updateRows("organizations", { status: "suspended", updated_at: new Date().toISOString() }, { id: run.organizationId });
    await updateRows("organization_members", { status: "inactive", updated_at: new Date().toISOString() }, { organization_id: run.organizationId });
    for (const member of members) await removeCreatedAccount(String(member.user_id));
    // All operational child tables use ON DELETE CASCADE. Only this exact
    // temporary company is deleted; the validation audit has no company FK.
    await deleteRows("organizations", { id: run.organizationId });
    check(run, "cleanup_data", "Empresa, usuários e registros de teste removidos", !(await selectOne("organizations", { id: run.organizationId }))
      && (await selectRows("organization_members", { organization_id: run.organizationId })).length === 0
      && (await selectRows("leads", { organization_id: run.organizationId }, { select: "id" })).length === 0);
    for (const person of ["owner", "member"] as const) {
      try {
        const session = await signInWithPassword(email(run.runId, person), await password(run.runId, person));
        await supabaseAuthRequest("/auth/v1/logout?scope=global", { method: "POST" }, session.access_token);
        throw new RequestError("Uma conta temporária ainda está ativa no serviço de autenticação.", 502);
      } catch (error) {
        if (!(error instanceof AuthRequestError) || ![400, 401].includes(error.status)) throw error;
      }
    }
    check(run, "cleanup_auth", "Contas temporárias não conseguem mais autenticar", true);
  }
  run.cleaned = true;
}

export async function executeValidation(parent: Request, actorId: string, stage: ValidationStage, runId?: string) {
  if (!stages.includes(stage)) throw new RequestError("Etapa inválida.", 400);
  let run: ValidationRun;
  if (stage === "start") {
    const previous = await readValidation(actorId);
    if (previous && !previous.cleaned) throw new RequestError("Remova os dados da validação anterior antes de iniciar outra.", 409);
    const id = crypto.randomUUID();
    run = { runId: id, organizationId: "", companyName: `Fama Validação ${id}`, actorId, stage, checks: [], cleaned: false, failed: false, checkedAt: new Date().toISOString() };
    // Persist the cleanup handle before any resource is created.
    await save(run);
  } else {
    if (!runId) throw new RequestError("Informe a validação que deseja continuar.", 400);
    const stored = await readValidation(actorId, runId);
    if (!stored) throw new RequestError("Validação não encontrada.", 404);
    run = stored;
    if (run.cleaned) return run;
    if (stage !== "cleanup" && (run.failed || stages.indexOf(stage) !== stages.indexOf(run.stage) + 1)) throw new RequestError("Esta etapa não pode ser executada agora.", 409);
    if (stage !== "cleanup" && !(await temporaryCompany(run))) throw new RequestError("Empresa de teste não encontrada.", 409);
  }
  let session: TestSession | undefined;
  try {
    if (stage === "start") {
      const response = await createCompany(mutation(parent, "/api/admin/organizations", "POST", { name: run.companyName, displayName: "Responsável temporário", email: email(run.runId, "owner"), password: await password(run.runId, "owner"), plan: "profissional" }));
      const payload = await response.json() as { organization?: Record<string, unknown> };
      run.organizationId = String(payload.organization?.id ?? "");
      check(run, "company", "Cadastro real de empresa gratuita sem vencimento", response.status === 201 && UUID.test(run.organizationId)
        && payload.organization?.billingEnabled === false && payload.organization?.blockOnExpiry === false && payload.organization?.planExpiresAt === "");
      await save(run);
      session = await login(run, "owner");
      const access = await system(session, run, "/api/access");
      const accessPayload = await access.json() as { access?: { role?: string; billingEnabled?: boolean; blockOnExpiry?: boolean } };
      check(run, "login", "Login real do responsável no Fama System", access.status === 200 && accessPayload.access?.role === "owner" && accessPayload.access.billingEnabled === false && accessPayload.access.blockOnExpiry === false);
      check(run, "bootstrap", "Módulos liberados sem mensalidade", (await system(session, run, "/api/bootstrap")).status === 200);
      check(run, "exemption", "Empresa isenta não pode gerar cobrança de mensalidade", (await system(session, run, "/api/billing", { plan: "profissional", billingCycle: "monthly" })).status === 409);
    } else if (stage === "members") {
      const response = await createMember(mutation(parent, "/api/admin/organizations/test/members", "POST", { displayName: "Colaborador temporário", email: email(run.runId, "member"), password: await password(run.runId, "member"), role: "member", permissions: ["crm"] }), context(run.organizationId));
      const payload = await response.json() as { member?: { id?: string } };
      const memberId = String(payload.member?.id ?? "");
      check(run, "member", "Cadastro real de usuário da empresa", response.status === 201 && UUID.test(memberId));
      const edit = await memberPatch(parent, memberId, { displayName: "Técnico temporário editado", role: "technician", permissions: ["crm"] });
      check(run, "edit", "Edição de nome, função e módulos do usuário", edit.status === 200);
      session = await login(run, "member");
      const access = await system(session, run, "/api/access");
      const accessPayload = await access.json() as { access?: { role?: string; permissions?: string[] } };
      check(run, "role", "Login real respeita a função e os módulos editados", access.status === 200 && accessPayload.access?.role === "technician" && accessPayload.access.permissions?.join(",") === "crm");
      check(run, "deny_module", "Módulos não autorizados são recusados", (await system(session, run, "/api/records", { entity: "transactions", description: "Teste descartável" })).status === 403);
      const created = await system(session, run, "/api/records", { entity: "leads", name: "Lead descartável da validação", phone: "00000000000", interest: "Teste de acesso" });
      const createdPayload = await created.json() as { record?: { id?: string } };
      const loaded = await system(session, run, "/api/bootstrap");
      const loadedPayload = await loaded.json() as { leads?: { id?: string }[] };
      check(run, "allow_module", "Módulo permitido grava e recarrega os dados", created.status === 201 && loaded.status === 200 && Boolean(createdPayload.record?.id) && Boolean(loadedPayload.leads?.some(lead => lead.id === createdPayload.record?.id)));
      const foreign = (await selectRows<Record<string, unknown>>("organizations", { status: "active" }, { select: "id", limit: 2 })).find(row => row.id !== run.organizationId);
      check(run, "isolation", "Acesso a outra empresa é recusado", Boolean(foreign) && (await system(session, run, "/api/bootstrap", undefined, String(foreign?.id))).status === 403);
      const disabled = await memberPatch(parent, memberId, { status: "inactive" });
      check(run, "disable_user", "Desativar usuário interrompe a sessão existente", disabled.status === 200 && (await system(session, run, "/api/access")).status === 403);
      const enabled = await memberPatch(parent, memberId, { status: "active" });
      check(run, "enable_user", "Reativar usuário recupera o acesso", enabled.status === 200 && (await system(session, run, "/api/access")).status === 200);
    } else if (stage === "access") {
      session = await login(run, "owner");
      await companyPatch(parent, run, { name: `${run.companyName} Editada` });
      run.companyName += " Editada";
      await save(run);
      const access = await system(session, run, "/api/access");
      check(run, "edit_company", "Alteração da empresa confirmada no banco", access.status === 200);
      await companyPatch(parent, run, { status: "suspended" });
      check(run, "suspend", "Bloqueio manual interrompe o acesso da empresa", (await system(session, run, "/api/bootstrap")).status === 403);
      await companyPatch(parent, run, { status: "active" });
      check(run, "restore", "Liberação manual recupera o acesso", (await system(session, run, "/api/bootstrap")).status === 200);
      const paid = await companyPatch(parent, run, { billingEnabled: true, blockOnExpiry: true, planExpiresAt: "2020-01-01T00:00:00.000Z" });
      check(run, "billing", "Mensalidade e bloqueio só atuam após ativação", paid.billingEnabled === true && paid.blockOnExpiry === true && paid.planStatus === "pending_payment" && (await system(session, run, "/api/bootstrap")).status === 402);
      await companyPatch(parent, run, { blockOnExpiry: false });
      check(run, "independent", "Desativar bloqueio mantém os módulos liberados", (await system(session, run, "/api/bootstrap")).status === 200);
      const free = await companyPatch(parent, run, { billingEnabled: false });
      check(run, "free_again", "Desativar mensalidade restaura a isenção sem vencimento", free.billingEnabled === false && free.blockOnExpiry === false && free.planExpiresAt === "" && !free.billingPaymentId && (await system(session, run, "/api/billing", { plan: "profissional", billingCycle: "monthly" })).status === 409);
    } else await cleanup(run);
  } catch (error) {
    run.failed = true;
    run.error = error instanceof RequestError ? error.message : "A operação de teste não foi concluída. Os dados temporários podem ser removidos pelo Control.";
    // Recover the exact company if creation committed but the verification
    // response was lost; never search by a user-supplied company or email.
    if (stage === "start" && !run.organizationId) {
      const row = await selectOne<Record<string, unknown>>("organizations", { name_key: companyNameKey(run.companyName) }).catch(() => null);
      if (row && await selectOne("audit_logs", { organization_id: String(row.id), actor_user_id: actorId, entity_type: "company_created", record_id: String(row.id) }).catch(() => null)) run.organizationId = String(row.id);
    }
  } finally {
    if (session) {
      try { await logout(session); } catch { run.failed = true; run.error = "Não foi possível encerrar uma sessão de teste. Remova os dados temporários para revogar o acesso."; }
    }
  }
  run.stage = stage;
  await save(run);
  return run;
}
