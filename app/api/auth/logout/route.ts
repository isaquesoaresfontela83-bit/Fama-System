import { cookies } from "next/headers";
import { clearFamaAuthTokens } from "@/lib/fama-auth-tokens";

export async function GET(request: Request) {
  const cookieStore = await cookies();

  cookieStore.set("fama_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  await clearFamaAuthTokens();

  const url = new URL(request.url);

  return Response.redirect(
    new URL("/", url.origin),
    303,
  );
}
