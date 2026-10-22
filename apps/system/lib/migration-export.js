// Temporary, encrypted handoff for the owner's hosting migration.
// This module is excluded from the final independent release.
export async function migrationAllowed(request, values, now = Date.now()) {
  const expected = String(values.FAMA_MIGRATION_EXPORT_TOKEN ?? "");
  const expires = Date.parse(String(values.FAMA_MIGRATION_EXPIRES_AT ?? ""));
  const actual = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(actual) || !Number.isFinite(expires) || expires <= now || expires - now > 3600000) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(expected), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const challenge = encoder.encode("fama-owner-migration");
  const supplied = await crypto.subtle.importKey("raw", encoder.encode(actual), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", supplied, challenge);
  return crypto.subtle.verify("HMAC", key, signature, challenge);
}
const base64 = bytes => { let output = ""; for (let i = 0; i < bytes.length; i += 8192) output += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(output); };
export async function sealMigration(payload, publicJwk) {
  const receiver = await crypto.subtle.importKey("jwk", publicJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const rawKey = crypto.getRandomValues(new Uint8Array(32)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const wrappedKey = await crypto.subtle.encrypt("RSA-OAEP", receiver, rawKey);
  return { algorithm: "RSA-OAEP-256+A256GCM", iv: base64(iv), wrappedKey: base64(new Uint8Array(wrappedKey)), ciphertext: base64(new Uint8Array(ciphertext)) };
}
