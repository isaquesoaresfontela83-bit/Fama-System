import { cookies } from "next/headers";
import { createFamaSession } from "@/lib/fama-session";
import { writeFamaAuthTokens } from "@/lib/fama-auth-tokens";

export const dynamic = "force-dynamic";

const SUPABASE_URL =
  "https://mupnsdqahoybhmkpufmx.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_zIRS_RPPmub36dmBEwp_CA_6iByYsV_";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    const password = String(body.password ?? "");

    if (!email || !password) {
      return Response.json(
        {
          ok: false,
          message: "Informe o e-mail e a senha.",
        },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
        cache: "no-store",
      },
    );

    const auth = await response.json().catch(() => ({}));

    if (
      !response.ok ||
      !auth.access_token ||
      !auth.refresh_token ||
      !auth.user?.id ||
      !auth.user?.email
    ) {
      return Response.json(
        {
          ok: false,
          message: "E-mail ou senha inválidos.",
        },
        { status: 401 },
      );
    }

    const displayName =
      auth.user.user_metadata?.display_name ||
      auth.user.user_metadata?.full_name ||
      auth.user.email;

    const signedSession = await createFamaSession({
      id: String(auth.user.id),
      email: String(auth.user.email).toLowerCase(),
      displayName: String(displayName),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const cookieStore = await cookies();

    cookieStore.set("fama_session", signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    await writeFamaAuthTokens({
      accessToken: String(auth.access_token),
      refreshToken: String(auth.refresh_token),
      expiresAt: Date.now() + Number(auth.expires_in ?? 3600) * 1000,
    });

    return Response.json({
      ok: true,
      user: {
        id: auth.user.id,
        email: auth.user.email,
        displayName,
      },
    });
  } catch (error) {
    console.error("fama_login_failed", error);

    return Response.json(
      {
        ok: false,
        message: "Não foi possível entrar agora.",
      },
      { status: 500 },
    );
  }
}
