import { env } from "cloudflare:workers";

const PREFIX = "fama:v1:";
const KEY_BYTES = 32;

function configuredValue() {
  const runtime = env as unknown as { FAMA_DATA_ENCRYPTION_KEY?: string };
  return String(runtime.FAMA_DATA_ENCRYPTION_KEY ?? "").trim();
}

function encryptionRequired() {
  const runtime = env as unknown as { DATA_BACKEND?: string };
  return String(runtime.DATA_BACKEND ?? "").trim().toLowerCase() === "supabase";
}

function decode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function keyMaterial() {
  const value = configuredValue();
  if (!value) throw new Error("FAMA_DATA_ENCRYPTION_KEY não configurada.");
  if (/^[0-9a-f]{64}$/i.test(value)) return Uint8Array.from(value.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
  const bytes = decode(value);
  if (bytes.length !== KEY_BYTES) throw new Error("FAMA_DATA_ENCRYPTION_KEY deve ter 32 bytes.");
  return bytes;
}

async function secretKey() {
  return crypto.subtle.importKey("raw", keyMaterial(), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function isDataEncryptionConfigured() {
  try { keyMaterial(); return true; } catch { return false; }
}

export async function encryptText(value: string) {
  if (!value) return "";
  if (value.startsWith(PREFIX)) return value;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await secretKey(), new TextEncoder().encode(value));
  return `${PREFIX}${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}

export async function decryptText(value: string) {
  if (!value || !value.startsWith(PREFIX)) return value;
  const [ivEncoded, payloadEncoded] = value.slice(PREFIX.length).split(".");
  if (!ivEncoded || !payloadEncoded) throw new Error("Valor criptografado inválido.");
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(ivEncoded) }, await secretKey(), decode(payloadEncoded));
  return new TextDecoder().decode(decrypted);
}

export async function encryptRecordFields<T extends Record<string, unknown>>(record: T, fields: string[]) {
  if (!isDataEncryptionConfigured()) {
    const containsSensitiveValue = fields.some((field) => typeof record[field] === "string" && Boolean(record[field]));
    if (encryptionRequired() && containsSensitiveValue) {
      throw new Error("A criptografia obrigatória do servidor não está configurada.");
    }
    return record;
  }
  const protectedRecord: Record<string, unknown> = { ...record };
  for (const field of fields) {
    const value = protectedRecord[field];
    if (typeof value === "string" && value) protectedRecord[field] = await encryptText(value);
  }
  return protectedRecord as T;
}

export async function decryptRecordFields<T extends Record<string, unknown>>(record: T, fields: string[]) {
  const clearRecord: Record<string, unknown> = { ...record };
  for (const field of fields) {
    const value = clearRecord[field];
    if (typeof value === "string" && value.startsWith(PREFIX)) clearRecord[field] = await decryptText(value);
  }
  return clearRecord as T;
}

export const encryptionPrefix = PREFIX;

export const encryptedFieldsByEntity: Record<string, string[]> = {
  leads: ["phone"],
  quotes: ["notes"],
  appointments: ["address", "notes"],
  workOrders: ["productsUsed", "notes"],
  customers: ["phone", "email", "address", "notes"],
  transactions: ["description", "category"],
  employees: ["phone"],
  warranties: ["originReference", "notes"],
  contracts: ["clientDocument", "clientAddress", "terms"],
};
