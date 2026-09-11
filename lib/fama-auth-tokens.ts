import { cookies } from "next/headers";

const COOKIE_NAME = "fama_auth_tokens";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SUPABASE_URL = "https://mupnsdqahoybhmkpufmx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zIRS_RPPmub36dmBEwp_CA_6iByYsV_";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type FamaAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

function getSecret() {
  const value = process.env.FAMA_SESSION_SECRET ?? "";
  if (value.length < 32) throw new Error("FAMA_SESSION_SECRET_NOT_CONFIGURED");
  return value;
}

function base64urlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function aesKey() {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(getSecret()));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptTokens(tokens: FamaAuthTokens) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await aesKey(),
      encoder.encode(JSON.stringify(tokens)),
    ),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return base64urlEncode(packed);
}

async function decryptTokens(value: string): Promise<FamaAuthTokens | null> {
  try {
    const packed = base64urlDecode(value);
    if (packed.length < 13) return null;
    const iv = packed.slice(0, 12);
    const cipher = packed.slice(12);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await aesKey(), cipher);
    const tokens = JSON.parse(decoder.decode(plain)) as FamaAuthTokens;
    if (!tokens?.accessToken || !tokens?.refreshToken || !tokens?.expiresAt) return null;
    return tokens;
  } catch {
    return null;
  }
}

export async function writeFamaAuthTokens(tokens: FamaAuthTokens) {
  const store = await cookies();
  store.set(COOKIE_NAME, await encryptTokens(tokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearFamaAuthTokens() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function readFamaAuthTokens() {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;
  return decryptTokens(value);
}

export async function getValidFamaAccessToken() {
  let tokens = await readFamaAuthTokens();
  if (!tokens) return null;
  if (tokens.expiresAt > Date.now() + 60_000) return tokens.accessToken;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: tokens.refreshToken }),
    cache: "no-store",
  });
  const refreshed = await response.json().catch(() => null) as null | {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !refreshed?.access_token) {
    await clearFamaAuthTokens();
    return null;
  }

  tokens = {
    accessToken: String(refreshed.access_token),
    refreshToken: String(refreshed.refresh_token ?? tokens.refreshToken),
    expiresAt: Date.now() + Number(refreshed.expires_in ?? 3600) * 1000,
  };
  await writeFamaAuthTokens(tokens);
  return tokens.accessToken;
}
