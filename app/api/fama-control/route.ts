import {
  clearFamaControlSession,
  readFamaControlSession,
  writeFamaControlSession,
} from "@/lib/fama-control-session";

export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://mupnsdqahoybhmkpufmx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zIRS_RPPmub36dmBEwp_CA_6iByYsV_";
const CONTROL_API = `${SUPABASE_URL}/functions/v1/fama-control`;

function json(status: number, body: unknown) {
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

async function refreshSession(refreshToken: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {}

  if (!response.ok || !data?.access_token) return null;
  return data;
}

async function sendToControl(accessToken: string, payload: Record<string, unknown>) {
  return fetch(CONTROL_API, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "x-access-token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, access_token: accessToken }),
    cache: "no-store",
  });
}

export async function POST(request: Request) {
  let session = await readFamaControlSession();
  if (!session) {
    return json(401, { ok: false, message: "Sessão expirada. Entre novamente." });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await request.json();
  } catch {
    return json(400, { ok: false, message: "Requisição inválida." });
  }

  if (typeof payload.action !== "string" || !payload.action) {
    return json(400, { ok: false, message: "Ação inválida." });
  }

  if (session.expiresAt <= Date.now() + 60_000) {
    const refreshed = session.refreshToken ? await refreshSession(session.refreshToken) : null;
    if (!refreshed?.access_token) {
      await clearFamaControlSession();
      return json(401, { ok: false, message: "Sessão expirada. Entre novamente." });
    }

    session = {
      ...session,
      accessToken: String(refreshed.access_token),
      refreshToken: String(refreshed.refresh_token ?? session.refreshToken),
      expiresAt: Date.now() + Number(refreshed.expires_in ?? 3600) * 1000,
    };
    await writeFamaControlSession(session);
  }

  let upstream = await sendToControl(session.accessToken, payload);

  if (upstream.status === 401 && session.refreshToken) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed?.access_token) {
      session = {
        ...session,
        accessToken: String(refreshed.access_token),
        refreshToken: String(refreshed.refresh_token ?? session.refreshToken),
        expiresAt: Date.now() + Number(refreshed.expires_in ?? 3600) * 1000,
      };
      await writeFamaControlSession(session);
      upstream = await sendToControl(session.accessToken, payload);
    }
  }

  let data: unknown = {};
  try {
    data = await upstream.json();
  } catch {
    data = { ok: false, message: `Falha no Fama Control (${upstream.status}).` };
  }

  if (upstream.status === 401) await clearFamaControlSession();
  return json(upstream.status, data);
}
