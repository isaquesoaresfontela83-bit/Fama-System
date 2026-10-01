const encoder = new TextEncoder();

export type FamaSession = {
  id: string;
  email: string;
  displayName: string;
  exp: number;
};

function secret() {
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
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"],
  );
}

export async function createFamaSession(data: FamaSession) {
  const payload = base64urlEncode(
    encoder.encode(JSON.stringify(data)),
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await hmacKey(),
      encoder.encode(payload),
    ),
  );

  return `${payload}.${base64urlEncode(signature)}`;
}

export async function readFamaSession(
  token: string,
): Promise<FamaSession | null> {
  try {
    const [payload, signature] = token.split(".");

    if (!payload || !signature) return null;

    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      base64urlDecode(signature),
      encoder.encode(payload),
    );

    if (!valid) return null;

    const data = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payload)),
    ) as FamaSession;

    if (!data.id || !data.email) return null;
    if (data.exp < Date.now()) return null;

    return data;
  } catch {
    return null;
  }
}
