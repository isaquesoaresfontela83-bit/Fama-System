import { cookies } from "next/headers";

const COOKIE_NAME = "fama_control_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type FamaControlSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

function getSecret() {
  const value = process.env.FAMA_SESSION_SECRET ?? "";
  if (value.length < 32) {
    throw new Error("FAMA_SESSION_SECRET_NOT_CONFIGURED");
  }
  return value;
}

function base64urlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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

async function encryptSession(session: FamaControlSession) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await aesKey(),
      encoder.encode(JSON.stringify(session)),
    ),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return base64urlEncode(packed);
}

async function decryptSession(value: string): Promise<FamaControlSession | null> {
  try {
    const packed = base64urlDecode(value);
    if (packed.length < 13) return null;
    const iv = packed.slice(0, 12);
    const cipher = packed.slice(12);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await aesKey(),
      cipher,
    );
    const session = JSON.parse(decoder.decode(plain)) as FamaControlSession;
    if (!session?.accessToken || !session?.user?.id || !session?.user?.email) return null;
    return session;
  } catch {
    return null;
  }
}

export async function readFamaControlSession() {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;
  return decryptSession(value);
}

export async function writeFamaControlSession(session: FamaControlSession) {
  const store = await cookies();
  store.set(COOKIE_NAME, await encryptSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearFamaControlSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
