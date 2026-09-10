import { writeFamaControlSession } from "@/lib/fama-control-session";

export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://mupnsdqahoybhmkpufmx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zIRS_RPPmub36dmBEwp_CA_6iByYsV_";
const CONTROL_API = `${SUPABASE_URL}/functions/v1/fama-control`;

function response(status: number, body: unknown) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: Request) {
  let input: { email?: string; password?: string } = {};
  try {
    input = await request.json();
  } catch {
    return response(400, { ok: false, message: "Requisição inválida." });
  }

  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (!email || !password) {
    return response(400, { ok: false, message: "Informe e-mail e senha." });
  }

  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  let auth: any = null;
  try {
    auth = await authResponse.json();
  } catch {}

  if (!authResponse.ok || !auth?.access_token || !auth?.user?.id) {
    return response(401, {
      ok: false,
      message: auth?.message || auth?.error_description || "E-mail ou senha inválidos.",
    });
  }

  const accessToken = String(auth.access_token);
  const bootstrapResponse = await fetch(CONTROL_API, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "x-access-token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "bootstrap", access_token: accessToken }),
    cache: "no-store",
  });

  let bootstrap: any = null;
  try {
    bootstrap = await bootstrapResponse.json();
  } catch {}

  if (
    !bootstrapResponse.ok ||
    !(bootstrap?.ok || bootstrap?.success || bootstrap?.authorized)
  ) {
    return response(403, {
      ok: false,
      message: bootstrap?.message || "Este e-mail não está autorizado para o Fama Control.",
    });
  }

  const metadata = auth.user.user_metadata ?? {};
  const displayName =
    String(metadata.full_name ?? metadata.name ?? "").trim() || email;

  await writeFamaControlSession({
    accessToken,
    refreshToken: String(auth.refresh_token ?? ""),
    expiresAt: Date.now() + Number(auth.expires_in ?? 3600) * 1000,
    user: {
      id: String(auth.user.id),
      email,
      displayName,
    },
  });

  return response(200, {
    ok: true,
    user: { id: String(auth.user.id), email, displayName },
  });
}
