import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readFamaSession } from "@/lib/fama-session";

export type ChatGPTUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const cookieStore = await cookies();

  const token =
    cookieStore.get("fama_session")?.value;

  if (!token) return null;

  const session = await readFamaSession(token);

  if (!session) return null;

  return {
    id: session.id,
    email: session.email,
    displayName: session.displayName,
    fullName: session.displayName,
  };
}

export async function requireChatGPTUser(
  returnTo = "/",
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();

  if (user) return user;

  redirect(
    `/?return_to=${encodeURIComponent(returnTo)}`,
  );
}

export function chatGPTSignInPath() {
  return "/";
}

export function chatGPTSignOutPath() {
  return "/api/auth/logout";
}
