import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readFamaSession } from "@/lib/fama-session";

export async function getFamaUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("fama_session")?.value;
  if (!token) return null;
  const session = await readFamaSession(token);
  if (!session) return null;
  return { id: session.id, email: session.email, displayName: session.displayName, fullName: session.displayName };
}

export async function requireFamaUser(returnTo = "/") {
  const user = await getFamaUser();
  if (user) return user;
  redirect(`/?return_to=${encodeURIComponent(returnTo)}`);
}

export function famaSignInPath() { return "/"; }
export function famaSignOutPath() { return "/api/auth/logout"; }
