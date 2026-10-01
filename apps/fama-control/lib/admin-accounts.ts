import { env } from "cloudflare:workers";
import { isPlatformAdmin, RequestError } from "@/lib/tenant";

export const FREE_ACCESS_INDEFINITE = "9999-12-31T23:59:59.000Z";
export const companyPlans = ["inicial", "intermediario", "profissional"] as const;

export function assertCompanyIdentity(email: string, id = "") {
  if (isPlatformAdmin({ id, email, displayName: "", fullName: null, provider: "supabase", aal: null })) {
    throw new RequestError("A conta da administração da plataforma é protegida. Use uma conta própria da empresa.", 400);
  }
}

export function companyNameKey(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function accountInput(body: Record<string, unknown>) {
  const displayName = String(body.displayName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (displayName.length < 2 || displayName.length > 100) throw new RequestError("Informe o nome da pessoa, de 2 a 100 caracteres.", 400);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RequestError("Informe um e-mail válido.", 400);
  if (password.length < 8 || new TextEncoder().encode(password).byteLength > 72) throw new RequestError("Use uma senha de pelo menos 8 caracteres e até 72 bytes.", 400);
  return { displayName, email, password };
}

export function freeAccessExpiry(value: unknown) {
  if (value === undefined || value === null || value === "") return FREE_ACCESS_INDEFINITE;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now()) {
    throw new RequestError("Informe uma data futura ou deixe o prazo em branco.", 400);
  }
  return new Date(value).toISOString();
}

async function authAdmin(path: string, method: "POST" | "PUT" | "DELETE", body?: Record<string, unknown>) {
  const runtime = env as unknown as { SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string };
  const url = String(runtime.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = String(runtime.SUPABASE_SECRET_KEY ?? "").trim();
  if (!url.startsWith("https://") || !key) throw new RequestError("O serviço de criação de contas ainda não está configurado.", 503);
  const headers = new Headers({ apikey: key, "Content-Type": "application/json" });
  if (key.startsWith("eyJ")) headers.set("Authorization", `Bearer ${key}`);
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/admin/users${path}`, {
      method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000), redirect: "manual",
    });
  } catch { throw new RequestError("Não foi possível acessar o serviço de contas. Tente novamente.", 503); }
  if (response.status >= 300 && response.status < 400) throw new RequestError("O serviço de contas retornou um redirecionamento inesperado.", 502);
  // Retrying cleanup after a partial failure must tolerate an already removed
  // identity; every caller supplies the ID of its newly created account.
  if (method === "DELETE" && response.status === 404) return {};
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const code = String(payload.error_code ?? payload.code ?? "");
    const reason = String(payload.msg ?? payload.message ?? "");
    if (["email_exists", "user_already_exists"].includes(code) || /already.*registered|already.*exists/i.test(reason)) {
      throw new RequestError("Este e-mail já possui uma conta. Use outro e-mail; a senha existente não foi alterada.", 409);
    }
    if (response.status === 429) throw new RequestError("Muitas alterações de conta. Aguarde um pouco e tente novamente.", 429);
    if (["weak_password", "validation_failed", "email_address_invalid"].includes(code)) throw new RequestError("O serviço de contas recusou os dados. Confira o e-mail e use uma senha mais forte.", 400);
    throw new RequestError("Não foi possível salvar a conta no serviço de autenticação.", response.status >= 500 ? 502 : 503);
  }
  return payload;
}

export async function createAccount(input: ReturnType<typeof accountInput>) {
  assertCompanyIdentity(input.email);
  const result = await authAdmin("", "POST", { email: input.email, password: input.password, email_confirm: true, user_metadata: { display_name: input.displayName, full_name: input.displayName } });
  const user = result.user && typeof result.user === "object" ? result.user as Record<string, unknown> : result;
  const id = String(user.id ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new RequestError("O serviço de contas não confirmou o cadastro.", 502);
  return { id, email: input.email, displayName: input.displayName };
}

export async function updateAccount(id: string, input: { email?: string; password?: string; displayName?: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new RequestError("A conta de acesso deste usuário não foi localizada.", 409);
  const values: Record<string, unknown> = {};
  if (input.email !== undefined) Object.assign(values, { email: input.email, email_confirm: true });
  if (input.password) values.password = input.password;
  if (input.displayName !== undefined) values.user_metadata = { display_name: input.displayName, full_name: input.displayName };
  const result = await authAdmin(`/${encodeURIComponent(id)}`, "PUT", values);
  const user = result.user && typeof result.user === "object" ? result.user as Record<string, unknown> : result;
  if (user.id !== id || (input.email !== undefined && String(user.email).toLowerCase() !== input.email)) {
    throw new RequestError("O serviço de autenticação não confirmou a atualização da conta.", 502);
  }
}

// Undo a newly created account after a failed write or a disposable validation.
export async function removeCreatedAccount(id: string) {
  await authAdmin(`/${encodeURIComponent(id)}`, "DELETE", { should_soft_delete: false });
}
